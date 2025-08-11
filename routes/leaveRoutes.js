// routes/leaveRoutes.js

// İzin (leave) route'ları
// Middleware sıralaması kritik, ownership ve yetki kontrolleri route'ta yapılıyor

const express = require('express');
const router = express.Router();

const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const {
  validateLeaveRequest,
  requireNoteIfOtherType,
  checkLeaveExists,
  verifyLeaveOwnership,
  preventUpdateIfStarted,
  authorizeDepartmentForStatusUpdate
} = require('../middleware/leaveMiddleware');

const {
  addLeaveRequest,
  getOwnLeaveRequests,
  getDepartmentLeaveRequests,
  updateLeave,
  deleteLeave,
  updateLeaveStatus
} = require('../controllers/leaveController');

// Yeni izin talebi oluşturma
// - Kullanıcı doğrulaması yapılır
// - İzin talebi validasyonu yapılır
// - "Diğer" türü için açıklama zorunluluğu kontrol edilir
router.post(
  '/',
  verifyToken,
  validateLeaveRequest,
  requireNoteIfOtherType,
  addLeaveRequest
);

// Kullanıcının kendi izin taleplerini listeleme
// - Kullanıcı doğrulaması yapılır
router.get(
  '/',
  verifyToken,
  getOwnLeaveRequests
);

// Departman bazında izin taleplerini listeleme
// - Sadece admin veya IK rolü erişebilir
router.get(
  '/department',
  verifyToken,
  authorizeRoles('admin', 'ik'),
  getDepartmentLeaveRequests
);

// İzin güncelleme
// - Kullanıcı doğrulaması ve izin kaydı varlığı kontrol edilir
// - Ownership kontrolü yapılır (sahip veya admin olmalı)
// - Başlamış izinler güncellenemez
// - İzin talebi validasyonu ve "Diğer" için not kontrolü yapılır
router.put(
  '/:id',
  verifyToken,
  checkLeaveExists,
  verifyLeaveOwnership,
  preventUpdateIfStarted,
  validateLeaveRequest,
  requireNoteIfOtherType,
  updateLeave
);

// İzin silme
// - Kullanıcı doğrulaması ve izin kaydı kontrol edilir
// - Ownership kontrolü yapılır
router.delete(
  '/:id',
  verifyToken,
  checkLeaveExists,
  verifyLeaveOwnership,
  deleteLeave
);

// İzin durum güncelleme (onay/reddetme)
// - Kullanıcı doğrulaması yapılır
// - Sadece admin veya IK yetkilidir
// - İzin kaydı var mı kontrol edilir
// - Yetkilendirme, departman bazında yapılır (örneğin IK sadece kendi departmanı için)
// - Durum güncellemesi yapılır
router.put(
  '/:id/status',
  verifyToken,
  authorizeRoles('admin', 'ik'),
  checkLeaveExists,
  authorizeDepartmentForStatusUpdate,
  updateLeaveStatus
);

module.exports = router;
