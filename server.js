// السيرفر الأساسي - الهدف منه دلوقتي: التأكد إن كل حاجة متوصلة ببعض
// (Render + GitHub + MongoDB Atlas) قبل ما نبدأ نضيف باقي المميزات

const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// رابط الاتصال بقاعدة البيانات هياخده السيرفر من "متغير بيئة" (Environment Variable)
// مش هنكتب الباسورد جوه الكود نفسه عشان الأمان - هنحطه في إعدادات Render بعدين
const MONGO_URI = process.env.MONGO_URI;

// متغير بسيط نعرف بيه هل احنا متصلين بقاعدة البيانات ولا لأ
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

// صفحة بسيطة نتأكد منها إن السيرفر شغال وحالة الاتصال بقاعدة البيانات
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: Arial; text-align:center; padding: 50px; direction: rtl;">
      <h1>🚀 السيرفر شغال</h1>
      <p>حالة الاتصال بقاعدة البيانات: <b>${dbStatus}</b></p>
    </div>
  `);
});

// نقطة فحص بسيطة (health check) بترجع حالة السيرفر كـ JSON
app.get('/health', (req, res) => {
  res.json({
    server: 'running',
    database: dbStatus
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
