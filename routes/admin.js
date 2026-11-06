const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Suggestion = require('../models/Suggestion');
const Attendance = require('../models/Attendance');

// جلب كل المستخدمين - بياناتهم الأساسية وحالة الاشتراك
router.get('/users', async (req, res) => {
  const users = await User.find()
    .select('-pinHash -sessionToken')
    .sort({ createdAt: -1 });

  res.json({ count: users.length, users });
});

// جلب كل الاقتراحات
router.get('/suggestions', async (req, res) => {
  const suggestions = await Suggestion.find().sort({ createdAt: -1 }).limit(300);
  res.json({ count: suggestions.length, suggestions });
});

// إحصائية سريعة: عدد المسجلين، عدد الاشتراكات الفعالة، عدد اللي لسه في التجربة
router.get('/stats', async (req, res) => {
  const now = new Date();
  const totalUsers = await User.countDocuments();
  const activeSubscriptions = await User.countDocuments({
    subscriptionActive: true,
    subscriptionEnd: { $gte: now }
  });
  const inTrial = await User.countDocuments({
    trialEnd: { $gte: now },
    $or: [{ subscriptionActive: false }, { subscriptionActive: { $exists: false } }]
  });
  const totalAttendanceRecords = await Attendance.countDocuments();

  res.json({ totalUsers, activeSubscriptions, inTrial, totalAttendanceRecords });
});

module.exports = router;
