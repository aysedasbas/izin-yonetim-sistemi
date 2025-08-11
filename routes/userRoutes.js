const express = require('express');
const router = express.Router();

// Auth middleware'den token doğrulama ve rol bazlı yetkilendirme fonksiyonları
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// User controller'dan kullanıcı ekleme ve silme fonksiyonları
const { addUser, deleteUser } = require('../controllers/userController');

/**
 * IK kullanıcı ekleme
 * Sadece 'admin' rolündeki kullanıcılar bu route'u kullanabilir
 */
router.post(
  '/ik',
  verifyToken,          // Token doğrulama middleware'i
  authorizeRoles('admin'),  // Sadece admin rolü izinli
  addUser               // Kullanıcı ekleme işlemi
);

/**
 * Employee kullanıcı ekleme
 * 'admin' ve 'ik' rolleri bu route'u kullanabilir
 */
router.post(
  '/employee',
  verifyToken,
  authorizeRoles('admin', 'ik'),
  addUser
);

/**
 * IK kullanıcı silme
 * Sadece 'admin' rolü 
 * URL parametresi ile silinecek kullanıcının ID'si alınır
 */
router.delete(
  '/ik/:id',
  verifyToken,
  authorizeRoles('admin'),
  deleteUser
);

/**
 * Employee kullanıcı silme
 * 'admin' ve 'ik' rolleri 
 * URL parametresi ile silinecek kullanıcının ID'si alınır
 */
router.delete(
  '/employee/:id',
  verifyToken,
  authorizeRoles('admin', 'ik'),
  deleteUser
);

module.exports = router;
