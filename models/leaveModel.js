const db = require('../db');
const { logAudit } = require('./auditLogModel');

// İzin durumu için geçerli değerler
const VALID_STATUSES = ['Beklemede', 'Onaylandı', 'Reddedildi'];

/**
 * Yeni izin talebi oluşturur
 * - Gerekli alanları kontrol eder
 * - Başlangıç tarihi bitiş tarihinden büyük olamaz
 * - Transaction açar
 * - İzin kaydını oluşturur
 * - Audit log kaydını ekler
 * - Commit eder ve oluşturulan kaydı döner
 * @param {Object} param0 İzin bilgileri
 * @returns {Object} Oluşturulan izin kaydı
 */
const createLeaveRequest = async ({ user_id, leave_type_id, start_date, end_date, attachment_url = null, note = null }) => {
  if (!user_id || !leave_type_id || !start_date || !end_date) {
    throw new Error('user_id, leave_type_id, start_date ve end_date zorunludur.');
  }
  if (new Date(start_date) > new Date(end_date)) {
    throw new Error('Başlangıç tarihi bitiş tarihinden sonra olamaz.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Yeni izin talebini insert et
    const { rows } = await client.query(
      `INSERT INTO leave_requests
       (user_id, leave_type_id, start_date, end_date, status, attachment_url, note)
       VALUES ($1, $2, $3, $4, 'Beklemede', $5, $6)
       RETURNING *`,
      [user_id, leave_type_id, start_date, end_date, attachment_url, note]
    );
    const newLeave = rows[0];

    // Audit log kaydı oluştur
    await logAudit({
      user_id,
      action: 'create',
      target_table: 'leave_requests',
      target_id: newLeave.id,
      old_data: null,
      new_data: newLeave,
    });

    await client.query('COMMIT');
    return newLeave;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Varolan izin talebini günceller
 * - id ile izin kaydı kilitlenir (FOR UPDATE) ve güncelleme yapılır
 * - Validasyonlar yapılır (tarih ve status kontrolü)
 * - Audit log kaydı tutulur
 * - Transaction yönetilir
 * @param {number} id İzin talebinin ID'si
 * @param {Object} updates Güncellenecek alanlar
 * @param {number|null} performed_by_user_id Güncelleme yapan kullanıcının ID'si
 * @returns {Object} Güncellenmiş izin kaydı
 */
const updateLeaveRequest = async (id, updates, performed_by_user_id = null) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Güncellenecek izin talebini kilitle ve getir
    const { rows: existingRows } = await client.query(`SELECT * FROM leave_requests WHERE id = $1 FOR UPDATE`, [id]);
    const existing = existingRows[0];
    if (!existing) {
      throw new Error('Güncellenecek izin bulunamadı.');
    }

    // Gelen güncelleme verileri yoksa mevcut veriyi koru
    const {
      leave_type_id = existing.leave_type_id,
      start_date = existing.start_date,
      end_date = existing.end_date,
      status = existing.status,
      attachment_url = existing.attachment_url,
      note = existing.note,
    } = updates;

    // Tarihlerin tutarlı olup olmadığını kontrol et
    if (new Date(start_date) > new Date(end_date)) {
      throw new Error('Başlangıç tarihi bitiş tarihinden sonra olamaz.');
    }

    // Status geçerli mi kontrol et
    if (!VALID_STATUSES.includes(status)) {
      throw new Error('Geçersiz status değeri.');
    }

    // İzin talebini güncelle
    const { rows } = await client.query(
      `UPDATE leave_requests
       SET leave_type_id = $1,
           start_date = $2,
           end_date = $3,
           status = $4,
           attachment_url = $5,
           note = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [leave_type_id, start_date, end_date, status, attachment_url, note, id]
    );

    const updated = rows[0];

    // Güncelleme işlemi audit log'a yazılır
    await logAudit({
      user_id: performed_by_user_id,
      action: 'update',
      target_table: 'leave_requests',
      target_id: id,
      old_data: existing,
      new_data: updated,
    });

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

/**
 * İzin talebini siler.
 * - Kayıt transaction ile kilitlenir ve silinir
 * - Silme işlemi audit log'a yazılır
 * @param {number} id Silinecek izin talebinin ID'si
 * @param {number|null} performed_by_user_id Silme işlemini yapan kullanıcı ID'si
 * @returns {Object} Silinen izin kaydı
 */
const deleteLeaveRequest = async (id, performed_by_user_id = null) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Silinecek kayıt kilitlenir
    const { rows: existingRows } = await client.query(`SELECT * FROM leave_requests WHERE id = $1 FOR UPDATE`, [id]);
    const existing = existingRows[0];
    if (!existing) {
      throw new Error('Silinecek izin bulunamadı.');
    }

    // İzin talebini sil
    const { rows } = await client.query(
      `DELETE FROM leave_requests WHERE id = $1 RETURNING *`,
      [id]
    );

    // Silme işlemi audit log'a yazılır
    await logAudit({
      user_id: performed_by_user_id,
      action: 'delete',
      target_table: 'leave_requests',
      target_id: id,
      old_data: existing,
      new_data: null,
    });

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Belirtilen kullanıcıya ait izin taleplerini getirir
 * @param {number} user_id Kullanıcı ID'si
 * @returns {Array} İzin talepleri listesi
 */
const getLeavesByUser = async (user_id) => {
  if (!user_id) throw new Error('user_id zorunludur.');
  const result = await db.query(
    `SELECT lr.*, lt.name AS leave_type_name
     FROM leave_requests lr
     JOIN leave_types lt ON lr.leave_type_id = lt.id
     WHERE lr.user_id = $1
     ORDER BY lr.created_at DESC`,
    [user_id]
  );
  return result.rows;
};

/**
 * Tek bir izin talebini ID ile getirir
 * @param {number} id İzin talebi ID'si
 * @returns {Object|null} İzin talebi
 */
const getLeaveById = async (id) => {
  if (!id) throw new Error('id zorunludur.');
  const result = await db.query(
    `SELECT lr.*, u.department_id, u.role AS user_role
     FROM leave_requests lr
     JOIN users u ON lr.user_id = u.id
     WHERE lr.id = $1`,
    [id]
  );
  return result.rows[0];
};

/**
 * Tüm izin taleplerini getirir (admin paneli için)
 * Pagination destekler
 * @param {Object} param0 limit ve offset değerleri
 * @returns {Array} İzin talepleri
 */
const getAllLeaves = async ({ limit = 100, offset = 0 } = {}) => {
  const result = await db.query(
    `SELECT lr.id, lr.user_id, lr.leave_type_id, lr.start_date, lr.end_date, lr.status, lr.created_at,
            u.email, u.role, lt.name AS leave_type_name
     FROM leave_requests lr
     JOIN users u ON lr.user_id = u.id
     JOIN leave_types lt ON lr.leave_type_id = lt.id
     ORDER BY lr.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
};

module.exports = {
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  getLeavesByUser,
  getLeaveById,
  getAllLeaves,
};
