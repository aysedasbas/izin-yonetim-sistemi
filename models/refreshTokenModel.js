// models/refreshTokenModel.js

// Güçlendirilmiş refresh token modeli
// - Token'lar HMAC-SHA256 (tercihen) veya SHA-256 ile hash'lenir
// - Upsert için ON CONFLICT (user_id) kullanılır
// - Transaction + audit_logs entegrasyonu sağlanır
// - Fonksiyonlar Promise döner

const db = require('../db'); // db.query
const crypto = require('crypto');

const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || null;

/**
 * Hash token:
 *  - Eğer REFRESH_TOKEN_SECRET tanımlıysa HMAC-SHA256 kullan
 *  - Aksi halde düz SHA-256 ile hashle
 * Sonuç: hex lower-case string
 */
const hashToken = (token) => {
  if (typeof token !== 'string') throw new Error('Token must be a string to hash.');
  if (REFRESH_TOKEN_SECRET) {
    return crypto
      .createHmac('sha256', REFRESH_TOKEN_SECRET)
      .update(token)
      .digest('hex');
  }
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Helper: validate expiresAt param (Date or parseable string)
 */
const ensureValidDate = (d) => {
  if (d instanceof Date && !isNaN(d)) return d;
  const parsed = new Date(d);
  if (!isNaN(parsed)) return parsed;
  throw new Error('expiresAt must be a valid Date or parseable date string.');
};

/**
 * Bir kullanıcı için refresh token kaydeder (veya günceller).
* - user_id: token sahibinin kullanıcı ID'si
* - token: düz (plain) token (sunucu tarafında hashlenir)
* - expiresAt: Geçerlilik bitiş tarihi (Date objesi veya parse edilebilir string)
* - performedBy: (opsiyonel) işlemi yapan kullanıcı ID'si (denetim/audit için)
 * Returns: { id, user_id, created_at, expires_at }
 */
const saveRefreshToken = async (user_id, token, expiresAt, performedBy = null) => {
  if (!user_id) throw new Error('user_id is required');
  if (!token) throw new Error('token is required');

  const expires_at = ensureValidDate(expiresAt);

  const token_hash = hashToken(token);

  // Transaction: eski veriyi oku -> upsert -> audit kaydı
  await db.query('BEGIN');
  try {
    // Mevcut varsa al (audit için)
    const existingRes = await db.query(
      `SELECT id, user_id, token_hash, expires_at, created_at
       FROM refresh_tokens WHERE user_id = $1`,
      [user_id]
    );
    const oldRow = existingRes.rows[0] || null;

    // Upsert (ON CONFLICT user_id)
    const upsertRes = await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
         DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, updated_at = now()
       RETURNING id, user_id, created_at, expires_at`,
      [user_id, token_hash, expires_at]
    );
    const newRow = upsertRes.rows[0];

    // Audit kaydı: action CREATE veya UPDATE
    const action = oldRow ? 'UPDATE' : 'CREATE';
    await db.query(
      `INSERT INTO audit_logs (user_id, action, target_table, target_id, old_data, new_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        performedBy, // audit_logs.user_id = işlemi yapan kişi (nullable)
        action,
        'refresh_tokens',
        newRow.id,
        oldRow ? JSON.stringify(oldRow) : null,
        JSON.stringify(newRow)
      ]
    );

    await db.query('COMMIT');
    return newRow;
  } catch (err) {
    await db.query('ROLLBACK');

    // Eğer race condition sonucu unique_violation olursa (çok nadir)
    // fallback olarak UPDATE dene. (Genelde ON CONFLICT yeterli)
    if (err && err.code === '23505') {
      const upd = await db.query(
        `UPDATE refresh_tokens
         SET token_hash = $2, expires_at = $3, updated_at = now()
         WHERE user_id = $1
         RETURNING id, user_id, created_at, expires_at`,
        [user_id, token_hash, expires_at]
      );
      // (Opsiyonel) burada audit atılabilir ama risk min
      return upd.rows[0];
    }

    throw err;
  }
};

/**
 *Düz (plain) token'a göre refresh token kaydını bulur. Sadece süresi dolmamış kayıtları döner
 * Returns: { id, user_id, expires_at, created_at } or null
 */
const findRefreshToken = async (token) => {
  if (!token) throw new Error('token is required');
  const token_hash = hashToken(token);
  const res = await db.query(
    `SELECT id, user_id, expires_at, created_at
     FROM refresh_tokens
     WHERE token_hash = $1 AND expires_at > now()`,
    [token_hash]
  );
  return res.rows[0] || null;
};

/**
* Düz (plain) token'a göre refresh token kaydını siler.
* - token: düz token
* - performedBy: isteğe bağlı, işlemi yapan kullanıcı id'si (denetim için)
* Returns number of rows deleted (0 veya 1)
*/
const deleteRefreshToken = async (token, performedBy = null) => {
  if (!token) throw new Error('token is required');
  const token_hash = hashToken(token);

  await db.query('BEGIN');
  try {
    // Önce silinecek satırı al (audit için)
    const sel = await db.query(
      `SELECT id, user_id, expires_at, created_at FROM refresh_tokens WHERE token_hash = $1`,
      [token_hash]
    );
    const oldRow = sel.rows[0] || null;

    const del = await db.query(
      `DELETE FROM refresh_tokens WHERE token_hash = $1 RETURNING id, user_id, expires_at, created_at`,
      [token_hash]
    );

    const deletedRow = del.rows[0] || null;

    if (deletedRow) {
      await db.query(
        `INSERT INTO audit_logs (user_id, action, target_table, target_id, old_data, new_data)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          performedBy,
          'DELETE',
          'refresh_tokens',
          deletedRow.id,
          oldRow ? JSON.stringify(oldRow) : null,
          null
        ]
      );
    }

    await db.query('COMMIT');
    return del.rowCount;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
};

/**
* Belirli bir kullanıcıya ait tüm refresh tokenları iptal eder (soft-revoke: expires_at = şu an)
* - user_id: hedef kullanıcı
* - performedBy: isteğe bağlı, işlemi yapan kullanıcı id'si (denetim için)
* Returns number of rows updated
 */
const revokeTokensForUser = async (user_id, performedBy = null) => {
  if (!user_id) throw new Error('user_id is required');

  await db.query('BEGIN');
  try {
    // Eski satırları al for audit
    const sel = await db.query(
      `SELECT id, user_id, expires_at, created_at FROM refresh_tokens WHERE user_id = $1`,
      [user_id]
    );
    const oldRows = sel.rows;

    const upd = await db.query(
      `UPDATE refresh_tokens SET expires_at = now(), updated_at = now() WHERE user_id = $1 RETURNING id, user_id, expires_at, created_at`,
      [user_id]
    );
    const newRows = upd.rows;

    // Audit: birden fazla satır için tek kayıt at (eski/yeni array olarak)
    await db.query(
      `INSERT INTO audit_logs (user_id, action, target_table, target_id, old_data, new_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        performedBy,
        'REVOKE_ALL',
        'refresh_tokens',
        null, // target_id null (çoklu)
        JSON.stringify(oldRows),
        JSON.stringify(newRows)
      ]
    );

    await db.query('COMMIT');
    return upd.rowCount;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
};

module.exports = {
  saveRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  revokeTokensForUser,
  hashToken,
};
