const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const requireAuth = require('./middleware/requireAuth');
const checkSubscription = require('./middleware/checkSubscription');

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

// عرض ملفات الواجهة (HTML, CSS, JS) الموجودة في مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// مسارات التسجيل وتسجيل الدخول (مفتوحة، من غير حماية)
app.use('/api/auth', authRoutes);

// مسارات الحضور - محمية: لازم تسجيل دخول + اشتراك/تجربة شغالة
app.use('/api/attendance', requireAuth, checkSubscription, attendanceRoutes);

// صفحة بسيطة للتأكد إن السيرفر شغال ومتصل بقاعدة البيانات
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
