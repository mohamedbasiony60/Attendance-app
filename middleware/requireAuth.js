const User = require('../models/User');

// بيتأكد إن المستخدم مسجل دخول فعلاً (معاه توكن صحيح)
async function requireAuth(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'unauthorized', message: 'لازم تسجل دخول الأول.' });
  }

  const user = await User.findOne({ sessionToken: token });
  if (!user) {
    return res.status(401).json({ error: 'unauthorized', message: 'جلسة الدخول غير صالحة، سجل دخول تاني.' });
  }

  req.currentUser = user;
  next();
}

module.exports = requireAuth;
