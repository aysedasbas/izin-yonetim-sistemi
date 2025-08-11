// routes/authRoutes.js

// Kimlik doğrulama (auth) endpoint'leri
// Input doğrulama (validation) express-validator ile yapılıyor
// Login isteğinde email normalize edilip doğrulanır
// Refresh token ve logout endpoint'lerinde refresh token zorunlu
// Validation hatalarında 400 Bad Request döner

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const { login, refreshAccessToken, logout } = require('../controllers/authController');

// POST /login
// Giriş yapma endpoint'i
// email ve password alanları zorunludur
// email normalize edilir (küçük harfe çevirilir boşluklar kırpılır)
router.post(
  '/login',
  // Email alanı boş olamaz geçerli email formatında olmalı temizlenir
  body('email')
    .notEmpty().withMessage('Email zorunludur.')
    .isEmail().withMessage('Geçerli bir email giriniz.')
    .trim()
    .normalizeEmail(),
  // Şifre alanı boş olamaz
  body('password')
    .notEmpty().withMessage('Şifre zorunludur.'),
  // Validation sonucu kontrol edilir hata varsa JSON olarak döner
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
  login
);

// POST /refresh-token
// Refresh token ile yeni access token alma endpoint'i
// refreshToken alanı zorunludur
router.post(
  '/refresh-token',
  // refreshToken boş olamaz
  body('refreshToken')
    .notEmpty().withMessage('Refresh token gerekli.'),
  // Validation sonucu kontrolü
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
  refreshAccessToken
);

// POST /logout
// Logout işlemi endpoint'i
// refreshToken alanı zorunludur ve token iptal edilir
router.post(
  '/logout',
  // refreshToken boş olamaz
  body('refreshToken')
    .notEmpty().withMessage('Refresh token gerekli.'),
  // Validation sonucu kontrolü
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  },
  logout
);

module.exports = router;
