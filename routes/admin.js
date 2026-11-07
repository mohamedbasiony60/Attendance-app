const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Suggestion = require('../models/Suggestion');
const Attendance = require('../models/Attendance');

router.get('/users', async (req, res) => {
  const users = await User.find().select('-pinHash -sessionToken').sort({ createdAt: -1 });
  res.json({ count: users.length, users });
});

// تحديث جهة التأمين لعامل معين - نص بس، من غير أي تأثير على حساب المرتب
router.patch('/users/:id/insurance', async (req, res) => {
  const { insuranceProvider } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { insuranceProvider: insuranceProvider || '' },
    { new: true }
  ).select('-pinHash -sessionToken');

  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود.' });
  res.json({ message: 'تم التحديث ✅', user });
});

// تفعيل/تعديل اشتراك مستخدم يدويًا بعد ما تتأكد من استلام الدفع
router.patch('/users/:id/subscription', async (req, res) => {
  const { subscriptionActive, subscriptionEnd } = req.body;
  const update = {};
  if (typeof subscriptionActive === 'boolean') update.subscriptionActive = subscriptionActive;
  if (subscriptionEnd) update.subscriptionEnd = new Date(subscriptionEnd);

  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
    .select('-pinHash -sessionToken');

  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود.' });
  res.json({ message: 'تم تحديث الاشتراك ✅', user });
});

router.get('/suggestions', async (req, res) => {
  const suggestions = await Suggestion.find().sort({ createdAt: -1 }).limit(300);
  res.json({ count: suggestions.length, suggestions });
});

router.get('/stats', async (req, res) => {
  const now = new Date();
  const totalUsers = await User.countDocuments();
  const activeSubscriptions = await User.countDocuments({ subscriptionActive: true, subscriptionEnd: { $gte: now } });
  const totalAttendanceRecords = await Attendance.countDocuments();
  res.json({ totalUsers, activeSubscriptions, totalAttendanceRecords });
});

module.exports = router;
