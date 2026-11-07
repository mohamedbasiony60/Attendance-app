const express = require('express');
const router = express.Router();

const Attendance = require('../models/Attendance');
const SalaryCalcCounter = require('../models/SalaryCalcCounter');
const { getEgyptNow, getDaysInMonth, getSalaryWindow } = require('../utils/egyptDate');

const MAX_SALARY_CALC_ATTEMPTS = 3;

const RATES = {
  worker: { dailyBefore: 359.00, dailyAfter: 327.95, nightRate: 150.00 },
  supervisor: { dailyBefore: 377.25, dailyAfter: 344.62, nightRate: 175.00 }
};

// ==== جلب جدول الشهر الحالي كامل (للعرض في التقويم الجانبي) ====
router.get('/month', async (req, res) => {
  const now = getEgyptNow();
  const daysInMonth = getDaysInMonth(now.year, now.month);

  const records = await Attendance.find({
    userId: req.currentUser._id, year: now.year, month: now.month
  });

  const recordsMap = {};
  records.forEach(r => { recordsMap[r.day] = r; });

  const fullMonth = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const r = recordsMap[d];
    fullMonth.push({
      day: d,
      status: r ? r.status : 0,
      is2x: r ? r.is2x : false,
      isNight: r ? r.isNight : false
    });
  }

  res.json({
    year: now.year,
    month: now.month,
    today: now.day,
    days: fullMonth
  });
});

// ==== جلب أو حفظ بيانات يوم معين من الشهر الحالي ====
// مسموح بس للأيام اللي فاتت أو النهارده - الأيام الجاية مقفولة تمامًا
router.get('/day/:day', async (req, res) => {
  const day = parseInt(req.params.day);
  const now = getEgyptNow();

  if (!day || day < 1 || day > now.day) {
    return res.status(403).json({ error: 'day_locked', message: 'مينفعش تشوف أو تعدل يوم لسه ماجاش.' });
  }

  const record = await Attendance.findOne({
    userId: req.currentUser._id, year: now.year, month: now.month, day
  });

  res.json({
    day, year: now.year, month: now.month,
    record: record || { status: 1, is2x: false, isNight: false }
  });
});

router.post('/day/:day', async (req, res) => {
  const day = parseInt(req.params.day);
  const now = getEgyptNow();

  if (!day || day < 1 || day > now.day) {
    return res.status(403).json({ error: 'day_locked', message: 'مينفعش تسجل أو تعدل يوم لسه ماجاش.' });
  }

  const { status, is2x, isNight } = req.body;
  if (![0, 0.5, 1].includes(status)) {
    return res.status(400).json({ error: 'invalid_status', message: 'قيمة الحضور غير صحيحة.' });
  }

  const record = await Attendance.findOneAndUpdate(
    { userId: req.currentUser._id, year: now.year, month: now.month, day },
    { status, is2x: !!is2x, isNight: !!isNight, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  res.json({ message: 'تم التسجيل بنجاح ✅', record });
});

// ==== نافذة حساب المرتب - آخر يوم في الشهر + أول يومين من الشهر الجديد ====
router.get('/salary-window', async (req, res) => {
  const window = getSalaryWindow();

  if (!window.active) {
    return res.json({ active: false });
  }

  const records = await Attendance.find({
    userId: req.currentUser._id, year: window.year, month: window.month
  });

  let presentCount = 0, halfCount = 0, absentCount = 0, nightCount = 0;
  records.forEach(r => {
    if (r.status === 1) presentCount++;
    else if (r.status === 0.5) halfCount++;
    else absentCount++;
    if (r.isNight) nightCount++;
  });

  const daysInTargetMonth = getDaysInMonth(window.year, window.month);
  // الأيام اللي معندهاش سجل أصلاً تتحسب غياب في الملخص
  const recordedDays = records.length;
  absentCount += (daysInTargetMonth - recordedDays);

  const counter = await SalaryCalcCounter.findOne({
    userId: req.currentUser._id, year: window.year, month: window.month
  });
  const attemptsUsed = counter ? counter.attemptsUsed : 0;

  res.json({
    active: true,
    year: window.year,
    month: window.month,
    summary: { presentCount, halfCount, absentCount, nightCount },
    attemptsRemaining: MAX_SALARY_CALC_ATTEMPTS - attemptsUsed
  });
});

// ==== حساب المرتب فعليًا - 3 محاولات بس ====
router.post('/calculate-salary', async (req, res) => {
  const window = getSalaryWindow();

  if (!window.active) {
    return res.status(403).json({ error: 'not_in_window', message: 'حساب المرتب متاح فقط آخر يوم في الشهر وأول يومين من الشهر الجديد.' });
  }

  const { advance } = req.body;

  let counter = await SalaryCalcCounter.findOne({
    userId: req.currentUser._id, year: window.year, month: window.month
  });

  if (!counter) {
    counter = await SalaryCalcCounter.create({
      userId: req.currentUser._id, year: window.year, month: window.month, attemptsUsed: 0
    });
  }

  if (counter.attemptsUsed >= MAX_SALARY_CALC_ATTEMPTS) {
    return res.status(429).json({ error: 'attempts_exhausted', message: 'لقد نفذ عدد محاولاتك لحساب المرتب هذا الشهر.' });
  }

  const records = await Attendance.find({
    userId: req.currentUser._id, year: window.year, month: window.month
  });

  const rates = RATES[req.currentUser.role];
  let weightedDays = 0, nightCount = 0;

  records.forEach(r => {
    const mult = r.is2x ? 2 : 1;
    weightedDays += r.status * mult;
    if (r.isNight) nightCount++;
  });

  const nightsTotal = nightCount * rates.nightRate;
  const grossSalary = (weightedDays * rates.dailyBefore) + nightsTotal;
  const salaryAfterIns = (weightedDays * rates.dailyAfter) + nightsTotal;
  const insuranceDeducted = (weightedDays * rates.dailyBefore) - (weightedDays * rates.dailyAfter);

  const taxableBase = salaryAfterIns - 1666.67;
  let tax = 0, rem = taxableBase;
  if (rem > 0) { const b1 = Math.min(rem, 3333.0); rem -= b1; }
  if (rem > 0) { const b2 = Math.min(rem, 1250.0); tax += b2 * 0.10; rem -= b2; }
  if (rem > 0) { const b3 = Math.min(rem, 1250.0); tax += b3 * 0.15; rem -= b3; }
  if (rem > 0) { tax += rem * 0.20; }

  const martyrsTax = 0.0005 * grossSalary;
  const totalSalary = salaryAfterIns - (tax + martyrsTax);
  const netSalary = totalSalary - (parseFloat(advance) || 0);

  counter.attemptsUsed += 1;
  await counter.save();

  res.json({
    message: 'تم الحساب ✅',
    attemptsRemaining: MAX_SALARY_CALC_ATTEMPTS - counter.attemptsUsed,
    result: {
      weightedDays, nightCount,
      nightsTotal: nightsTotal.toFixed(2),
      grossSalary: grossSalary.toFixed(2),
      salaryAfterIns: salaryAfterIns.toFixed(2),
      insuranceDeducted: insuranceDeducted.toFixed(2),
      tax: tax.toFixed(2),
      martyrsTax: martyrsTax.toFixed(2),
      totalSalary: totalSalary.toFixed(2),
      advance: (parseFloat(advance) || 0).toFixed(2),
      netSalary: netSalary.toFixed(2)
    }
  });
});

module.exports = router;
