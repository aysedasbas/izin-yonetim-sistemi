// controllers/userController.js

// Kullanıcı oluşturma / silme işlemleri
// Rol bazlı izinler controller katmanında enforce edilir
// Audit loglama yapılır

const { createUser, deleteUserById, findUserById } = require('../models/userModel');
const { logAudit } = require('../models/auditLogModel');

// Yeni kullanıcı oluştur
const addUser = async (req, res, next) => {
  try {
    const { email, password, role, department_id } = req.body;
    const creator = req.user;

    // Basit input validasyonu
    if (!email || !password || !role) {
      return res.error('Email, şifre ve rol zorunludur.', null, 400);
    }
    if (!['admin', 'ik', 'employee'].includes(role)) {
      return res.error('Geçersiz rol değeri.', null, 400);
    }

    // Rol bazlı izin kontrolü
    if (role === 'ik' && creator.role !== 'admin') {
      return res.error('Sadece admin IK oluşturabilir.', null, 403);
    }
    if (role === 'employee' && !['admin', 'ik'].includes(creator.role)) {
      return res.error('Sadece admin veya IK employee oluşturabilir.', null, 403);
    }
    if (role === 'admin') {
      return res.error('Admin oluşturma yetkisi yok.', null, 403);
    }

    // Kullanıcı oluştur (modelde şifre hashlenmeli)
    const newUser = await createUser(email, password, role, department_id);

    // Audit log
    await logAudit({
      user_id: creator.id,
      action: 'create',
      target_table: 'users',
      target_id: newUser.id,
      new_data: {
        email: newUser.email,
        role: newUser.role,
        department_id: newUser.department_id,
      },
    });

    return res.success(newUser, 'Kullanıcı başarıyla eklendi.', 201);
  } catch (err) {
    next(err);
  }
};

// Kullanıcı sil
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleter = req.user;

    // Hedef kullanıcı var mı
    const targetUser = await findUserById(id);
    if (!targetUser) {
      return res.error('Kullanıcı bulunamadı.', null, 404);
    }

    // Admin kullanıcı silinemez
    if (targetUser.role === 'admin') {
      return res.error('Admin kullanıcı silinemez.', null, 403);
    }

    // Silme işlemi
    const deletedUser = await deleteUserById(id);
    if (!deletedUser) {
      return res.error('Kullanıcı silinemedi veya zaten yok.', null, 404);
    }

    // Audit log - silinen kullanıcı verisi eski kullanıcıdan alınıyor
    await logAudit({
      user_id: deleter.id,
      action: 'delete',
      target_table: 'users',
      target_id: id,
      old_data: {
        email: targetUser.email,
        role: targetUser.role,
        department_id: targetUser.department_id,
      },
    });

    return res.success(deletedUser, 'Kullanıcı silindi.');
  } catch (err) {
    next(err);
  }
};

module.exports = { addUser, deleteUser };
