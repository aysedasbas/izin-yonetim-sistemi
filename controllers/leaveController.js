// controllers/leaveController.js
// ------------------------------
// İzin işlemleri — controller katmanı yetki ve audit logları burada handle eder

const {
  createLeaveRequest,
  getLeavesByUser,
  getAllLeaves,
  getLeaveById,
  updateLeaveRequest,
  deleteLeaveRequest,
} = require('../models/leaveModel');

const { findUserById } = require('../models/userModel');
const { logAudit } = require('../models/auditLogModel');

// Yeni izin ekle
const addLeaveRequest = async (req, res, next) => {
  try {
    const { leave_type_id, start_date, end_date, attachment_url, note } = req.body;
    const user_id = req.user.id;

    // Model içinde audit log var, burada tekrar loglama yapılmaz
    const leave = await createLeaveRequest({
      user_id,
      leave_type_id,
      start_date,
      end_date,
      attachment_url,
      note,
    });

    return res.success(leave, 'İzin eklendi.', 201);
  } catch (err) {
    next(err);
  }
};

// Kendi izinlerini getir
const getOwnLeaveRequests = async (req, res, next) => {
  try {
    const leaves = await getLeavesByUser(req.user.id);
    return res.success(leaves);
  } catch (err) {
    next(err);
  }
};

// Admin veya IK için tüm izinleri getir (ik -> opsiyonel departman filtrele)
const getDepartmentLeaveRequests = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      const all = await getAllLeaves();
      return res.success(all);
    }
    if (req.user.role === 'ik') {
      // Departman bazlı filtre istersen modele ekleyebilirsin
      const all = await getAllLeaves();
      return res.success(all);
    }
    return res.error('Bu bilgilere erişim yetkiniz yok.', null, 403);
  } catch (err) {
    next(err);
  }
};

// İzin güncelleme (ownership kontrolü burada)
const updateLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { leave_type_id, start_date, end_date, status, attachment_url, note } = req.body;

    const existing = await getLeaveById(id);
    if (!existing) return res.error('İzin kaydı bulunamadı.', null, 404);

    // Sahiplik kontrolü
    if (existing.user_id !== req.user.id) {
      return res.error('Bu işlemi yapmaya yetkiniz yok.', null, 403);
    }

    // Model içinde audit log var, burada tekrar yapmaya gerek yok
    const updated = await updateLeaveRequest(id, {
      leave_type_id,
      start_date,
      end_date,
      status,
      attachment_url,
      note,
    });

    return res.success(updated, 'İzin güncellendi.');
  } catch (err) {
    next(err);
  }
};

// Silme (ownership kontrolü burada)
const deleteLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await getLeaveById(id);
    if (!existing) return res.error('Silinecek kayıt bulunamadı.', null, 404);

    if (existing.user_id !== req.user.id) {
      return res.error('Bu işlemi yapmaya yetkiniz yok.', null, 403);
    }

    // Model içinde audit log var
    await deleteLeaveRequest(id);

    return res.success(null, 'İzin silindi.');
  } catch (err) {
    next(err);
  }
};

// Durum güncelleme: admin veya ik tarafından onay/reddetme
const updateLeaveStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const currentUser = req.user;

    const existing = await getLeaveById(id);
    if (!existing) return res.error('İzin kaydı bulunamadı.', null, 404);

    const leaveOwner = await findUserById(existing.user_id);
    if (!leaveOwner) return res.error('İzin sahibi kullanıcı bulunamadı.', null, 404);

    // Burada ik rolü ya da admin yetkisi middleware'de kontrol edilmeli

    // Model içinde audit log var
    const updated = await updateLeaveRequest(id, {
      leave_type_id: existing.leave_type_id,
      start_date: existing.start_date,
      end_date: existing.end_date,
      attachment_url: existing.attachment_url,
      note: existing.note,
      status,
    });

    // Log action'ı duruma göre ayarla
    const action = status === 'Onaylandı' ? 'approve' : status === 'Reddedildi' ? 'reject' : 'update';
    await logAudit({
      user_id: currentUser.id,
      action,
      target_table: 'leave_requests',
      target_id: id,
      old_data: existing,
      new_data: updated,
    });

    return res.success(updated, 'İzin durumu güncellendi.');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addLeaveRequest,
  getOwnLeaveRequests,
  getDepartmentLeaveRequests,
  updateLeave,
  deleteLeave,
  updateLeaveStatus,
};
