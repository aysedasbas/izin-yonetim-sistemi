// utils/tokenHash.js

// Basit token hash yardımcı fonksiyonu
// Refresh token'ları veritabanına düz metin yerine hash'leyerek saklamak için kullanılır 
// SHA-256 kullanıyoruz (gerçek secret'lar yerine token
// değerlerinin kendisini hash'liyoruz)
//
// Neden: DB sızıntısında refresh tokenların ele geçirilmesini önler.

const crypto = require('crypto');

/**
 * Token'ı SHA-256 algoritması ile hashler
 * @param {string} token - Hash'lenecek token string
 * @returns {string|null} - Hashlenmiş hex string ya da geçersiz input için null
 */
function hashToken(token) {
  // Token parametresi boş ya da string değilse null döndür
  if (!token || typeof token !== 'string') return null;

  // SHA-256 hash oluştur
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { hashToken };
