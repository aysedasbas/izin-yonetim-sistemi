// middleware/authMiddleware.js

// JWT doğrulama ve rol bazlı yetkilendirme middleware'leri
// - verifyToken: Authorization header'dan JWT tokenı alır, doğrular, geçerliyse
//   kullanıcı bilgisini req.user'a set eder, aksi halde 401 döner
// - isAdmin: Sadece admin rolüne sahip kullanıcılar için izin verir, diğerleri 403
// - authorizeRoles: İzin verilen roller parametre olarak alınır, bu rollerden birine sahip
//   olmayan kullanıcılar 403 döner

const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * JWT token doğrulama middleware
 * 
 * - Authorization header'da 'Bearer <token>' formatında token bekler
 * - Token yoksa 401 Unauthorized döner
 * - Token varsa jwt.verify ile doğrulanır
 * - Başarılıysa token payload'daki user bilgileri req.user'a set edilir
 * - Token geçersiz veya süresi dolmuş ise 401 döner
 */
function verifyToken(req, res, next) {
  try {
    // Authorization header'ı al (küçük/büyük harf duyarlılığına karşı kontrol)
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    // Header 'Bearer token' formatında ise token'ı ayıkla
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      // Token yoksa hata oluştur ve next ile hata handler'a gönder
      const err = new Error('Yetkilendirme tokenı bulunamadı.');
      err.statusCode = 401; // Unauthorized
      return next(err);
    }

    let decoded;
    try {
      // Tokenı doğrula ve decode et
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (verifyErr) {
      // Token geçersiz veya süresi dolmuş ise hata oluştur
      const jwtErr = new Error('Token geçersiz veya süresi dolmuş.');
      jwtErr.statusCode = 401;
      return next(jwtErr);
    }

    // Doğrulanan kullanıcı bilgilerini req.user'a ata
    req.user = {
      id: decoded.id,
      role: decoded.role,
      department_id: decoded.department_id,
    };

    // Middleware zincirine devam et
    next();
  } catch (err) {
    // Beklenmedik hata varsa hata handler'a gönder
    next(err);
  }
}

/**
 * Sadece admin rolüne sahip kullanıcılar için yetkilendirme middleware'i
 * - req.user yoksa veya rol admin değilse 403 Forbidden döner
 * - Aksi halde devam eder
 */
function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    const err = new Error('Yalnızca yöneticiler bu işlemi yapabilir.');
    err.statusCode = 403; // Forbidden
    return next(err);
  }
  next();
}

/**
 * Rol bazlı yetkilendirme middleware'i
 * - allowedRoles parametresi ile izin verilen roller belirtilir
 * - req.user yoksa veya rol allowedRoles içinde değilse 403 döner
 * - Aksi halde devam eder.
 * 
 * Örnek: authorizeRoles('admin', 'ik')
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      const err = new Error('Bu işlem için yetkiniz yok.');
      err.statusCode = 403;
      return next(err);
    }
    next();
  };
}

// Middleware fonksiyonlarını dışa aktar
module.exports = {
  verifyToken,
  isAdmin,
  authorizeRoles,
};
