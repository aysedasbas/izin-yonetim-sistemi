const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

dotenv.config();

const app = express();

// Güvenlik başlıkları
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});
app.use(limiter);

// Logger
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// CORS ayarları
const configuredWhitelist = (process.env.CORS_WHITELIST || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const devAllowed = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (configuredWhitelist.length && configuredWhitelist.includes(origin)) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV === 'development' && devAllowed.has(origin)) {
      return callback(null, true);
    }

    const err = new Error(`CORS policy: this origin is not allowed (${origin})`);
    err.status = 403;
    return callback(err, false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.options('*', cors());

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Response helper middleware
app.use((req, res, next) => {
  res.success = (data = null, message = 'İşlem başarılı', statusCode = 200) =>
    res.status(statusCode).json({ success: true, message, data });

  res.error = (message = 'Bir hata oluştu', errors = null, statusCode = 500) => {
    const r = { success: false, message };
    if (errors) r.errors = errors;
    return res.status(statusCode).json(r);
  };
  next();
});

// Router'lar doğrudan eklendi

const authRoutes = require('./routes/authRoutes.js');
const leaveRoutes = require('./routes/leaveRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const notificationRoutes = require('./routes/notificationRoutes.js');

app.use('/api/auth', authRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Sağlık kontrolü endpoint'i
app.get('/health', (req, res) => res.send('ok'));

// Global hata yakalayıcı
let errorHandler;
try {
  errorHandler = require('./middlewares/errorHandler');
} catch {
  try {
    errorHandler = require('./middleware/errorHandler');
  } catch {
    errorHandler = (err, req, res, next) => {
      console.error('[HATA fallback]:', err);
      res.status(err.statusCode || err.status || 500).json({
        success: false,
        message: err.message || 'Sunucu hatası'
      });
    };
  }
}
app.use(errorHandler);

// Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});
