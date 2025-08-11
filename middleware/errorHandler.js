// middleware/errorHandler.js
// -------------------------
// Global hata yakalayıcı middleware'i
// Bu middleware, tüm uygulamada yakalanmayan hataları yakalar ve uygun HTTP yanıtı döner
// Production ortamında stack trace döndürmek güvenlik riski oluşturabilir
// bu yüzden sadece development ortamında stack trace gösterilir

const errorHandler = (err, req, res, next) => {
  // Development ortamında detaylı hata konsola basılır
  if (process.env.NODE_ENV === 'development') {
    console.error('[HATA]:', err);
  } else {
    // Production ortamında sadece hata mesajı ve status kod loglanır (stack trace gizlenir)
    console.error('[HATA]:', { message: err.message, status: err.statusCode || 500 });
  }

  // HTTP status kodu belirlenir, yoksa 500 Internal Server Error varsayılır
  const statusCode = err.statusCode || 500;

  // İstemciye JSON formatında hata yanıtı döner
  res.status(statusCode).json({
    success: false,
    // Eğer hata özel bir mesaj (exposeMessage) içeriyorsa onu döner
    // aksi halde hata mesajı ya da genel sunucu hatası mesajı döner
    message: err.exposeMessage || err.message || 'Sunucu hatası',
    // Sadece development ortamında detaylı stack trace client'a gönderilir
    ...(process.env.NODE_ENV === 'development' ? { error: err.stack } : {}),
  });
};

module.exports = errorHandler;
