// routes/notificationRoutes.js

// Bildirimlere yönelik route'lar
// Tüm endpointlerde kullanıcı doğrulaması (verifyToken) yapılıyor
// Controller fonksiyonları asenkron işlemleri yönetir ve hata kontrolü içerir

const express = require('express');
const router = express.Router();

// Notification controller'ını import ediyoruz
const notificationController = require('../controllers/notificationController');

// Yetkilendirme middleware'i JWT token doğrulaması yapar
const { verifyToken } = require('../middleware/authMiddleware');

// Kullanıcının tüm bildirimlerini getirir
router.get(
  '/', 
  verifyToken, // Kullanıcı doğrulaması yapılmalı
  notificationController.getUserNotifications
);

// Belirli bir bildirimi "okundu" olarak işaretler
router.patch(
  '/:id/read', 
  verifyToken, // Kullanıcı doğrulaması yapılmalı
  notificationController.markNotificationAsRead
);

// Kullanıcının tüm bildirimlerini "okundu" olarak işaretler
router.patch(
  '/read-all', 
  verifyToken, // Kullanıcı doğrulaması yapılmalı
  notificationController.markAllNotificationsAsRead
);

module.exports = router;
