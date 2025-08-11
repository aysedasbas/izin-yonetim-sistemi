// models/auditLogModel.js

// Audit (denetim) loglarını tutan model
// Audit loglama işlemi kritik değil; hata olsa bile uygulama akışı etkilenmez
// Hata durumunda konsola yazılır, ileride farklı davranış eklenebilir

const db = require('../db');

/**
 * Audit log kaydı oluşturur.
 * @param {Object} param0
 * @param {number|null} param0.user_id İşlemi yapan kullanıcı ID'si (opsiyonel)
 * @param {string} param0.action Yapılan işlem (create, update, delete vb.)
 * @param {string} param0.target_table İşlem yapılan tablo adı
 * @param {number|null} param0.target_id İşlem yapılan kaydın ID'si (opsiyonel)
 * @param {Object|null} param0.old_data Güncelleme öncesi veri (opsiyonel)
 * @param {Object|null} param0.new_data Güncelleme sonrası veri (opsiyonel)
 */
const logAudit = async ({ user_id = null, action, target_table, target_id = null, old_data = null, new_data = null }) => {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, target_table, target_id, old_data, new_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user_id, action, target_table, target_id, old_data, new_data]
    );
  } catch (error) {
    // Audit log başarısızlığı ana iş akışını engellemesin hata konsola yazılsın
    console.error('Audit log insert error:', error.message);

    // Kritik durumlarda hatanın fırlatılma için aktif edilebilir
    // throw error;
  }
};

module.exports = { logAudit };
