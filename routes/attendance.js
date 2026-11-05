const express = require('express');
const router = express.Router();

const Attendance = require('../models/Attendance');
const SalaryCalcCounter = require('../models/SalaryCalcCounter');
const { getEgyptNow, getDaysInMonth, isLastDayOfMonth } = require('../utils/egyptDate');

const MAX_SALARY_CALC_ATTEMPTS = 3;

// إعدادات الأجر - هنعدلها بعدين تبقى قابلة للتعديل من لوحة الأدمن
const RATES = {
  worker: { dailyBefore: 359.00, dailyAfter: 327.95, nightRate: 150.00 },
  supervisor: { dailyBefore: 377.25, dailyAfter: 344.62, nightRate: 175.00 }
};

// ==== 1) جلب بيانات اليوم الحالي بس ====
router.get('/today', async (req, res) => {
  const now = getEgyptNow();
  const existing = await Attendance.findOne({
    userId: req.currentUser._id,
    year: now.year,
    month: now.month,
    day: now.day
  });

  res.json({
    today: { year: now.year, month: now.month, day: now.day },
    isLastDay: isLastDayOfMonth(),
    record: existing || { status: 1, is2x: false, isNight: false }
  });
});

// ==== 2) حفظ بيانات اليوم الحالي بس ====
// العميل مينفعش يبعت تاريخ غير تاريخ النهاردة - السيرفر هو اللي بيحدد التاريخ
router.post('/today', async (req, res) => {
  const { status, is2x, isNight } = req.body;

  if (![0, 0.5, 1].includes(status)) {
    return res.status(400).json({ error: 'invalid_status', message: 'قيمة الحضور غير صحيحة.' });
  }

  const now = getEgyptNow();

  const record = await Attendance.findOneAndUpdate(
    { userId: req.currentUser._id, year: now.year, month: now.month, day: now.day },
    { status, is2x: !!is2x, isNight: !!isNight, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  res.json({
    message: 'تم التسجيل بنجاح ✅',
    record
  });
});

// ==== 3) جلب جدول الشهر كامل - يشتغل بس في آخر يوم في الشهر ====
router.get('/month', async (req, res) => {
  if (!isLastDayOfMonth()) {
    return res.status(403).json({
      error: 'not_last_day',
      message: 'جدول الشهر بالكامل يظهر فقط في آخر يوم من الشهر.'
    });
  }

  const now = getEgyptNow();
  const daysInMonth = getDaysInMonth(now.year, now.month);

  const records = await Attendance.find({
    userId: req.currentUser._id,
    year: now.year,
    month: now.month
  });

  // نبني مصفوفة فيها كل أيام الشهر، حتى لو العميل ما سجلش فيها (تبقى قيمتها صفر)
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

  const counter = await SalaryCalcCounter.findOne({
    userId: req.currentUser._id,
    year: now.year,
    month: now.month
  });

  const attemptsUsed = counter ? counter.attemptsUsed : 0;

  res.json({
    year: now.year,
    month: now.month,
    days: fullMonth,
    salaryCalcAttemptsRemaining: MAX_SALARY_CALC_ATTEMPTS - attemptsUsed
  });
});

// ==== 4) حساب المرتب - 3 محاولات بس، وبيشتغل بس في آخر يوم في الشهر ====
router.post('/calculate-salary', async (req, res) => {
  if (!isLastDayOfMonth()) {
    return res.status(403).json({
      error: 'not_last_day',
      message: 'حساب المرتب متاح فقط في آخر يوم من الشهر.'
    });
  }

  const { advance } = req.body; // قيمة السلفة اللي العميل كاتبها
  const now = getEgyptNow();

  let counter = await SalaryCalcCounter.findOne({
    userId: req.currentUser._id,
    year: now.year,
    month: now.month
  });

  if (!counter) {
    counter = await SalaryCalcCounter.create({
      userId: req.currentUser._id,
      year: now.year,
      month: now.month,
      attemptsUsed: 0
    });
  }

  if (counter.attemptsUsed >= MAX_SALARY_CALC_ATTEMPTS) {
    return res.status(429).json({
      error: 'attempts_exhausted',
      message: 'لقد نفذ عدد محاولاتك لحساب المرتب هذا الشهر.'
    });
  }

  // نحسب المرتب بناءً على بيانات الشهر الفعلية المسجلة في قاعدة البيانات
  const records = await Attendance.find({
    userId: req.currentUser._id,
    year: now.year,
    month: now.month
  });

  const rates = RATES[req.currentUser.role];
  let weightedDays = 0;
  let nightCount = 0;

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
  let tax = 0;
  let rem = taxableBase;
  if (rem > 0) { const b1 = Math.min(rem, 3333.0); rem -= b1; }
  if (rem > 0) { const b2 = Math.min(rem, 1250.0); tax += b2 * 0.10; rem -= b2; }
  if (rem > 0) { const b3 = Math.min(rem, 1250.0); tax += b3 * 0.15; rem -= b3; }
  if (rem > 0) { tax += rem * 0.20; }

  const martyrsTax = 0.0005 * grossSalary;
  const totalSalary = salaryAfterIns - (tax + martyrsTax);
  const netSalary = totalSalary - (parseFloat(advance) || 0);

  // نزود العداد بعد ما نستخدم المحاولة
  counter.attemptsUsed += 1;
  await counter.save();

  res.json({
    message: 'تم الحساب ✅',
    attemptsRemaining: MAX_SALARY_CALC_ATTEMPTS - counter.attemptsUsed,
    result: {
      weightedDays,
      nightCount,
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
