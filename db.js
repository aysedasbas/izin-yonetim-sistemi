// db.js

// PostgreSQL veritabanı bağlantısı için merkezi modül
// Pool ve query fonksiyonu dışa aktarılır
// Tüm model dosyaları bu modülü kullanmalıdır

const { Pool } = require('pg');
require('dotenv').config();

// Veritabanı bağlantı havuzu oluşturuluyor
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',          // DB kullanıcı adı
  host: process.env.DB_HOST || 'localhost',         // DB host adresi
  database: process.env.DB_NAME || 'izin',           // DB adı
  password: process.env.DB_PASSWORD || '',           // DB şifresi
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,  // DB port
  max: 20,                                           // Havuzdaki maksimum bağlantı sayısı
  idleTimeoutMillis: 30000,                          // Boşta kalan bağlantının kapatılma süresi (ms)
  connectionTimeoutMillis: 2000,                     // Bağlantı zaman aşımı (ms)
});

// SQL sorgularını çalıştıran yardımcı fonksiyon
const query = async (text, params) => {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    return res;
  } 
  catch (err) {
    // Hata loglanırken parametrelerde hassas veri olabileceği için dikkatli ol
    console.error('DB query error:', { text, err: err.message });
    throw err;
  }
};

module.exports = {
  query,
  pool,
};
