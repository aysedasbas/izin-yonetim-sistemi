// models/userModel.js

// Kullanıcıyla ilgili DB işlemleri
// Dikkat: password sadece auth sırasında elde edilir 
// Diğer çağrılarda password alanı döndürülmez

const db = require('../db');
const bcrypt = require('bcrypt');

const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

/**
 * Yeni kullanıcı oluşturur Email normalize edilir (trim, lowercase)
 * Departman doğrulaması yapılır. Audit log kaydı atılır
 * Dönen veri password içermez
 */
const createUser = async (email, password, role, department_id = null, createdByUserId = null) => {
  const normalized = email.trim().toLowerCase();

  if (!['admin', 'ik', 'employee'].includes(role)) {
    throw new Error('Geçersiz role');
  }

  // Departman kontrolü (FK hatasını önceden yakalamak için)
  if (department_id !== null) {
    const deptExists = await db.query('SELECT 1 FROM departments WHERE id = $1', [department_id]);
    if (!deptExists.rowCount) {
      throw new Error('Departman bulunamadı');
    }
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  // Transaction başlat
  await db.query('BEGIN');
  try {
    const result = await db.query(
      `INSERT INTO users (email, password, role, department_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, department_id, created_at`,
      [normalized, hashedPassword, role, department_id]
    );

    const newUser = result.rows[0];

    // Audit log kaydı
    await db.query(
      `INSERT INTO audit_logs (user_id, action, details, created_by)
       VALUES ($1, $2, $3, $4)`,
      [newUser.id, 'CREATE', JSON.stringify(newUser), createdByUserId]
    );

    await db.query('COMMIT');
    return newUser;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
};

/**
 * Auth için kullanılır — password hash'i bu fonksiyonla elde edilir
 * DİKKAT: Bu fonksiyon password alanını içerir, sadece login flow'da kullanılmalı
 */
const findUserByEmailForAuth = async (email) => {
  const normalized = email.trim().toLowerCase();
  const result = await db.query(
    `SELECT id, email, password, role, department_id, created_at
     FROM users
     WHERE lower(email) = $1`,
    [normalized]
  );
  return result.rows[0];
};

/**
 * Genel kullanım için kullanıcıyı döndürür (password hariç)
 */
const findUserById = async (id) => {
  const result = await db.query(
    `SELECT id, email, role, department_id, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};

/**
 * Admin için kullanıcı listesi (password hariç) — pagination opsiyonel
 */
const getAllUsers = async ({ limit = 100, offset = 0 } = {}) => {
  const result = await db.query(
    `SELECT id, email, role, department_id, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
};

/**
 * Kullanıcı silme — audit log kaydı ile birlikte
 */
const deleteUserById = async (id, deletedByUserId = null) => {
  await db.query('BEGIN');
  try {
    const result = await db.query(
      `DELETE FROM users
       WHERE id = $1
       RETURNING id, email, role, department_id, created_at`,
      [id]
    );

    const deletedUser = result.rows[0];
    if (!deletedUser) {
      throw new Error('Kullanıcı bulunamadı');
    }

    // Audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, details, created_by)
       VALUES ($1, $2, $3, $4)`,
      [deletedUser.id, 'DELETE', JSON.stringify(deletedUser), deletedByUserId]
    );

    await db.query('COMMIT');
    return deletedUser;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
};

module.exports = {
  createUser,
  findUserByEmailForAuth,
  findUserByEmail: findUserByEmailForAuth,
  findUserById,
  getAllUsers,
  deleteUserById,
};
