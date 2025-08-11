// models/notificationModel.js
// --------------------------
// Bildirimlerle ilgili DB işlemleri
// Ownership kontrolleri DB tarafında yapılır (markAsRead id+user_id WHERE ile)

const db = require('../db');

/**
 * Yeni bildirim oluşturur
 * Dönüş: id, user_id, message, link, is_read, created_at
 */
const createNotification = async ({ user_id, message, link = null }) => {
  if (typeof user_id !== 'number' || user_id <= 0) throw new Error('Geçersiz user_id.');
  if (typeof message !== 'string' || message.trim() === '') throw new Error('Geçersiz message.');
  
  // burada link için de basit doğrulama yapılabilir 
  
  const result = await db.query(
    `INSERT INTO notifications (user_id, message, link)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, message, link, is_read, created_at`,
    [user_id, message, link]
  );
  return result.rows[0];
};

/**
 * Kullanıcının bildirimlerini getirir Pagination destekler
 * onlyUnread true ise sadece okunmamışları getirir
 */
const getNotificationsByUser = async (user_id, { limit = 50, offset = 0, onlyUnread = false } = {}) => {
  if (typeof user_id !== 'number' || user_id <= 0) throw new Error('Geçersiz user_id.');
  if (typeof limit !== 'number' || limit <= 0) limit = 50;
  if (typeof offset !== 'number' || offset < 0) offset = 0;

  let sql = `
    SELECT id, message, link, is_read, created_at
    FROM notifications
    WHERE user_id = $1
  `;
  const params = [user_id];

  if (onlyUnread) {
    sql += ' AND is_read = false';
  }

  sql += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
  params.push(limit, offset);

  const result = await db.query(sql, params);
  return result.rows;
};

/**
 * Tek bir bildirimi okundu yapar — ownership DB tarafından doğrulanır
 * Bulamazsa null döner
 */
const markAsRead = async (id, user_id) => {
  if (typeof id !== 'number' || id <= 0) throw new Error('Geçersiz bildirim id.');
  if (typeof user_id !== 'number' || user_id <= 0) throw new Error('Geçersiz user_id.');

  const result = await db.query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id, message, link, is_read, created_at`,
    [id, user_id]
  );
  return result.rows[0] || null;
};

/**
 * Tüm kullanıcının bildirimlerini okundu yapar, güncellenen satır sayısını döner
 */
const markAllAsReadByUser = async (user_id) => {
  if (typeof user_id !== 'number' || user_id <= 0) throw new Error('Geçersiz user_id.');

  const result = await db.query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [user_id]
  );
  return result.rowCount;
};

module.exports = {
  createNotification,
  getNotificationsByUser,
  markAsRead,
  markAllAsReadByUser,
};
