// middleware/leaveMiddleware.js
// ----------------------------
// İzin talepleri için validation, sahiplik (ownership) doğrulamaları ve izin durum
// güncelleme yetkilendirmeleri
// Bu middleware'ler, controller öncesinde çağrılarak iş akışının güvenli ve tutarlı olmasını sağlar
// checkLeaveExists fonksiyonu izin kaydını DB'den alır ve req.leave içine atar; böylece diğer middleware ve controller'lar bu veriyi kullanabilir

const { getLeaveById } = require('../models/leaveModel');
const { findUserById } = require('../models/userModel');

// "Diğer" izin türünün ID'si sabit olarak tanımlanmıştır
const OTHER_LEAVE_TYPE_ID = 5;

/**
 * İzin talebi için temel validasyonlar:
 * - leave_type_id, start_date, end_date zorunludur
 * - start_date, end_date geçerli tarih formatında olmalı
 * - start_date, end_date karşılaştırılarak başlangıç tarihi bitişten önce olmalı
 * Başarısızlık durumunda 400 Bad Request hatası döner
 */
const validateLeaveRequest = (req, res, next) => {
  const { leave_type_id, start_date, end_date } = req.body;

  if (!leave_type_id || !start_date || !end_date) {
    const err = new Error('İzin türü, başlangıç ve bitiş tarihleri zorunludur.');
    err.statusCode = 400;
    return next(err);
  }

  if (new Date(start_date) > new Date(end_date)) {
    const err = new Error('Başlangıç tarihi, bitiş tarihinden sonra olamaz.');
    err.statusCode = 400;
    return next(err);
  }

  next();
};

/**
 * Eğer izin türü "Diğer" ise (id = 5)
 * açıklama (note) alanının boş olmaması gerekir
 * Aksi halde 400 Bad Request döner
 */
const requireNoteIfOtherType = (req, res, next) => {
  const { leave_type_id, note } = req.body;

  if (parseInt(leave_type_id, 10) === OTHER_LEAVE_TYPE_ID && (!note || note.trim() === '')) {
    const err = new Error('"Diğer" izin türü için açıklama zorunludur.');
    err.statusCode = 400;
    return next(err);
  }

  next();
};

/**
 * İzin kaydının varlığını doğrular
 * - req.params.id'deki izin kaydını DB'den çeker
 * - Bulamazsa 404 Not Found döner
 * - Bulursa izin sahibinin (owner) rol ve departman bilgilerini userModel'den alır
 * - İzin kaydını req.leave içine set eder
 * ID formatı sayısal değilse 400 Bad Request döner
 */
const checkLeaveExists = async (req, res, next) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    const err = new Error('Geçersiz izin ID\'si.');
    err.statusCode = 400;
    return next(err);
  }

  try {
    const existing = await getLeaveById(id);
    if (!existing) {
      const err = new Error('İzin kaydı bulunamadı.');
      err.statusCode = 404;
      return next(err);
    }

    // Sahip kullanıcı bilgilerini al ve izin kaydına ekle
    const owner = await findUserById(existing.user_id);
    existing.owner_role = owner ? owner.role : null;
    existing.owner_department_id = owner ? owner.department_id : null;

    req.leave = existing; // Sonraki middleware ve controller'larda kullanılmak üzere atandı
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * İzin kaydının sahibi olup olmadığını ve rol bazlı yetkileri doğrular
 * - İzin sahibi ise geçer
 * - Admin ise tüm izinler üzerinde yetkili kabul edilir
 * - IK rolü izin CRUD işlemleri yapamaz sadece durum güncelleyebilir (controller'da ayrıca kontrol edilir)
 * - Diğer kullanıcılar 403 Forbidden hatası alır
 */
const verifyLeaveOwnership = (req, res, next) => {
  const user = req.user;
  const leave = req.leave;

  // Sahip ise geç
  if (leave.user_id === user.id) return next();

  // Admin her şeyi yapabilir
  if (user.role === 'admin') return next();

  // IK'ya izin CRUD izni yok
  const err = new Error('Bu izni değiştirme yetkiniz yok.');
  err.statusCode = 403;
  return next(err);
};

/**
 * Başlamış izinlerin güncellenmesini engeller
 * - İzin başlangıç tarihi şu an veya geçmişse 400 Bad Request döner
 */
const preventUpdateIfStarted = (req, res, next) => {
  const leave = req.leave;
  const now = new Date();

  if (new Date(leave.start_date) <= now) {
    const err = new Error('Başlamış bir izin güncellenemez.');
    err.statusCode = 400;
    return next(err);
  }

  next();
};

/**
 * İzin durumunu değiştirme yetkisini kontrol eder
 * - Admin tüm izin durumlarını değiştirebilir
 * - IK sadece 'employee' rolündeki kullanıcıların izin durumlarını değiştirebilir
 * - Opsiyonel olarak IK kendi departmanından olmayan izinleri değiştiremez (yorum satırında)
 * - Diğer roller 403 Forbidden döner.
 */
const authorizeDepartmentForStatusUpdate = async (req, res, next) => {
  const user = req.user;
  const leave = req.leave;
  const ownerRole = leave.owner_role;

  if (user.role === 'admin') return next();

  if (user.role === 'ik') {
    if (ownerRole !== 'employee') {
      const err = new Error('İK yalnızca çalışan izinlerini onaylayabilir.');
      err.statusCode = 403;
      return next(err);
    }

    // IK sadece kendi departmanındaki izinleri onaylayacaksa:
    // if (user.department_id && leave.owner_department_id && user.department_id !== leave.owner_department_id) {
    //   const err = new Error('İK yalnızca kendi departmanındaki izinleri onaylayabilir.');
    //   err.statusCode = 403;
    //   return next(err);
    // }

    return next();
  }

  const err = new Error('İzin durumunu değiştirme yetkiniz yok.');
  err.statusCode = 403;
  return next(err);
};

module.exports = {
  validateLeaveRequest,
  requireNoteIfOtherType,
  checkLeaveExists,
  verifyLeaveOwnership,
  preventUpdateIfStarted,
  authorizeDepartmentForStatusUpdate,
};
