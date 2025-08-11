// controllers/notificationController.js

// Bildirim endpoint'leri — controller ownership kontrolü model tarafına taşındı

const Notification = require('../models/notificationModel');

exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.getNotificationsByUser(userId);
    return res.status(200).json({ success: true, count: notifications.length, data: notifications });
  } catch (err) {
    console.error("getUserNotifications hata:", err.message);
    return res.status(500).json({ success: false, error: "Bildirimler alınamadı" });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // DB tarafında ownership kontrolü yapılıyor
    const updatedNotification = await Notification.markAsRead(id, userId);
    if (!updatedNotification) {
      // Bildirim yoksa ya da kullanıcıya ait değilse 404 döndürmek mantıklı
      return res.status(404).json({ success: false, error: "Bildirim bulunamadı veya size ait değil" });
    }

    return res.status(200).json({ success: true, data: updatedNotification });
  } catch (err) {
    console.error("markNotificationAsRead hata:", err.message);
    return res.status(500).json({ success: false, error: "Bildirim okunmuş olarak işaretlenemedi" });
  }
};

exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedCount = await Notification.markAllAsReadByUser(userId);
    return res.status(200).json({ success: true, message: `${updatedCount} bildirim okundu olarak işaretlendi.` });
  } catch (err) {
    console.error("markAllNotificationsAsRead hata:", err.message);
    return res.status(500).json({ success: false, error: "Tüm bildirimler okundu olarak işaretlenemedi" });
  }
};
