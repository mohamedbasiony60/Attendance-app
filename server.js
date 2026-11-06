const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const suggestionRoutes = require('./routes/suggestion');
const adminRoutes = require('./routes/admin');

const requireAuth = require('./middleware/requireAuth');
const checkSubscription = require('./middleware/checkSubscription');
const requireAdmin = require('./middleware/requireAdmin');

const app = express();
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI;
let dbStatus = 'لسه مش متصل';

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => {
      dbStatus = 'متصل بنجاح ✅';
      console.log('MongoDB connected successfully');
    })
    .catch((err) => {
      dbStatus = 'فشل الاتصال ❌: ' + err.message;
      console.error('MongoDB connection error:', err.message);
    });
} else {
  dbStatus = 'لم يتم ضبط رابط قاعدة البيانات (MONGO_URI) بعد';
}

// عرض ملفات الواجهة (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// التسجيل والدخول (مفتوحة)
app.use('/api/auth', authRoutes);

// الحضور - محمية: تسجيل دخول + اشتراك/تجربة شغالة
app.use('/api/attendance', requireAuth, checkSubscription, attendanceRoutes);

// الاقتراحات - محمية بتسجيل دخول بس (متاحة حتى لو التجربة خلصت)
app.use('/api/suggestion', requireAuth, suggestionRoutes);

// لوحة الأدمن - محمية بباسورد الأدمن الخاص بيك
app.use('/api/admin', requireAdmin, adminRoutes);

app.get('/status', (req, res) => {
  res.send(`
    <div style="font-family: Arial; text-align:center; padding: 50px; direction: rtl;">
      <h1>🚀 السيرفر شغال</h1>
      <p>حالة الاتصال بقاعدة البيانات: <b>${dbStatus}</b></p>
    </div>
  `);
});

app.get('/health', (req, res) => {
  res.json({ server: 'running', database: dbStatus });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
