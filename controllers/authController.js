// controllers/authController.js
// -----------------------------
// Kimlik doğrulama (Auth) işlemleri: login, refresh token rotation, logout
// Modeldeki fonksiyonlar kullanılır: hash, save, find, delete
// 
// İşlevler:
// - login: kullanıcı doğrulaması yapar, access + refresh token üretir, refresh token'ı DB'ye hash'lenmiş şekilde kaydeder
// - refreshAccessToken: gelen refresh token DB'de kontrol edilir, jwt.verify ile doğrulanır,
//   eski token DB'den silinir, yenisi oluşturulur ve kaydedilir (rotation)
// - logout: gelen refresh token DB'den silinir
//
// Güvenlik notları:
// - Plain refresh token'lar loglanmamalı
// - Access token kısa ömürlü (15 dakika), refresh token daha uzun (örnek: 7 gün)
// - Production ortamında refresh token'lar httpOnly cookie ile saklanmalı

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

const {
  findUserByEmailForAuth, // email ile kullanıcı ve password hash'i döner
  findUserById,
} = require('../models/userModel');

const {
  saveRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
} = require('../models/refreshTokenModel');

// Access token üretir (payload içinde temel kullanıcı bilgileri)
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      department_id: user.department_id,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '15m',        // 15 dakika geçerli
      issuer: 'izin-api',
      audience: user.id.toString(),
    }
  );
};

// Refresh token üretir (daha uzun geçerlilik)
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }       // 7 gün geçerli
  );
};

/**
 * LOGIN
 * Request Body: { email, password }
 * Response: kullanıcı bilgileri + accessToken, refreshToken
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.error('Email ve şifre gerekli.', null, 400);
    }

    const user = await findUserByEmailForAuth(email);
    if (!user) {
      return res.error('Kullanıcı bulunamadı.', null, 404);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.error('Şifre hatalı.', null, 401);
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 gün sonrası

    // Refresh token'ı DB'ye kaydet (hash'lenmiş haliyle)
    await saveRefreshToken(user.id, refreshToken, expiresAt);

    // Parola bilgisi dönülmez!
    return res.success(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        accessToken,
        refreshToken,
      },
      'Giriş başarılı.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * REFRESH ACCESS TOKEN (Token Rotation)
 * Request Body: { refreshToken }
 *
 * Akış:
 * 1. DB'de geçerli ve süresi dolmamış refresh token aranır
 * 2. Token yapısal olarak doğrulanır (jwt.verify)
 * 3. Kullanıcı DB'den çekilir
 * 4. Eski refresh token DB'den silinir (revoke)
 * 5. Yeni access ve refresh token oluşturulup kaydedilir
 * 6. Yeni tokenlar dönülür
 */
const refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};

    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.error('Refresh token gerekli.', null, 400);
    }

    const stored = await findRefreshToken(refreshToken);
    if (!stored) {
      return res.error('Geçersiz token.', null, 403);
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      // Token invalid ya da süresi dolmuşsa DB'deki kaydı sil
      await deleteRefreshToken(refreshToken).catch(() => {});
      return res.error('Token geçersiz veya süresi dolmuş.', null, 403);
    }

    const user = await findUserById(decoded.id);
    if (!user) {
      // İlgisiz token varsa DB kaydını sil (cleanup)
      await deleteRefreshToken(refreshToken).catch(() => {});
      return res.error('Kullanıcı bulunamadı.', null, 404);
    }

    const deletedCount = await deleteRefreshToken(refreshToken);
    if (process.env.NODE_ENV === 'development') {
      // Dikkat: production ortamında plain token loglama
      console.log(`refreshAccessToken: deletedCount=${deletedCount} for user_id=${user.id}`);
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await saveRefreshToken(user.id, newRefreshToken, expiresAt);

    return res.success(
      {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      'Yeni tokenlar üretildi.'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * LOGOUT
 * Request Body: { refreshToken }
 * Gelen refresh token DB'den silinir
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};

    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.error('Refresh token gerekli.', null, 400);
    }

    const deletedCount = await deleteRefreshToken(refreshToken);

    if (process.env.NODE_ENV === 'development') {
      console.log(`logout: deleted refresh token rows = ${deletedCount}`);
    }

    return res.success(null, 'Çıkış başarılı. Token iptal edildi.');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  refreshAccessToken,
  logout,
};
