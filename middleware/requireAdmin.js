// حماية مسارات الأدمن - بتتحقق من باسورد خاص بيك إنت بس (مش حساب مستخدم عادي)
// الباسورد ده بيتحط في إعدادات Bonto/Render كمتغير بيئة اسمه ADMIN_SECRET
function requireAdmin(req, res, next) {
  const secret = req.headers['x-admin-secret'];

  if (!process.env.ADMIN_SECRET) {
    return res.status(500).json({ error: 'admin_not_configured', message: 'لم يتم ضبط باسورد الأدمن في إعدادات السيرفر بعد.' });
  }

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'unauthorized', message: 'باسورد الأدمن غير صحيح.' });
  }

  next();
}

module.exports = requireAdmin;
