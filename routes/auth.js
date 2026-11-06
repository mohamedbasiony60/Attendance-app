const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const User = require('../models/User');
const DeviceTrial = require('../models/DeviceTrial');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

// تسجيل مستخدم جديد - رقم موبايل + باسورد 4 أرقام + الدور + معرف الجهاز
router.post('/signup', async (req, res) => {
  try {
    const { phone, role, deviceId, pin } = req.body;

    if (!phone || !role || !deviceId || !pin) {
      return res.status(400).json({ error: 'missing_fields', message: 'لازم تبعت كل البيانات المطلوبة.' });
    }

    if (!isValidPin(pin)) {
      return res.status(400).json({ error: 'invalid_pin', message: 'الباسورد لازم يكون 4 أرقام بالظبط.' });
    }

    if (!['worker', 'supervisor'].includes(role)) {
      return res.status(400).json({ error: 'invalid_role', message: 'الدور لازم يكون عامل أو مشرف.' });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({ error: 'phone_exists', message: 'رقم الموبايل ده مسجل بالفعل. سجل دخول بدل كده.' });
    }

    // هل الجهاز ده استخدم التجربة المجانية قبل كده؟ (منع التكرار حتى برقم موبايل مختلف)
    const deviceAlreadyUsedTrial = await DeviceTrial.findOne({ deviceId });

    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + 7);

    const newUser = new User({
      phone,
      role,
      deviceId,
      pinHash: hashPin(pin),
      trialStart,
      trialEnd: deviceAlreadyUsedTrial ? trialStart : trialEnd,
      sessionToken: generateToken()
    });

    await newUser.save();

    if (!deviceAlreadyUsedTrial) {
      await DeviceTrial.create({ deviceId, usedByPhone: phone });
    }

    return res.status(201).json({
      message: deviceAlreadyUsedTrial
        ? 'تم التسجيل، لكن هذا الجهاز استخدم التجربة المجانية من قبل، يجب الاشتراك للمتابعة.'
        : 'تم التسجيل بنجاح! هتشتغل مجانًا لمدة أسبوع.',
      token: newUser.sessionToken,
      role: newUser.role,
      trialEnd: newUser.trialEnd
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error', message: 'حصل خطأ في السيرفر، حاول تاني.' });
  }
});

// تسجيل الدخول - رقم موبايل + باسورد (من غير قفل بالجهاز، عشان الجهاز ممكن يبقى مشترك بين العمال)
router.post('/login', async (req, res) => {
  try {
    const { phone, pin } = req.body;

    if (!phone || !pin) {
      return res.status(400).json({ error: 'missing_fields', message: 'لازم تبعت رقم الموبايل والباسورد.' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ error: 'not_found', message: 'الرقم ده مش مسجل، سجل حساب جديد الأول.' });
    }

    // هل الحساب مقفول مؤقتًا بسبب محاولات غلط كتير؟
    if (user.lockUntil && new Date() < new Date(user.lockUntil)) {
      const minutesLeft = Math.ceil((new Date(user.lockUntil) - new Date()) / 60000);
      return res.status(423).json({
        error: 'account_locked',
        message: `الحساب مقفول مؤقتًا بسبب محاولات دخول خاطئة كتير. حاول تاني بعد ${minutesLeft} دقيقة.`
      });
    }

    const pinMatches = user.pinHash === hashPin(pin);

    if (!pinMatches) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + LOCK_MINUTES);
        user.lockUntil = lockUntil;
        user.failedLoginAttempts = 0;
        await user.save();
        return res.status(423).json({
          error: 'account_locked',
          message: `تم قفل الحساب مؤقتًا بسبب محاولات دخول خاطئة كتير. حاول تاني بعد ${LOCK_MINUTES} دقيقة.`
        });
      }

      await user.save();
      const remaining = MAX_FAILED_ATTEMPTS - user.failedLoginAttempts;
      return res.status(401).json({
        error: 'wrong_pin',
        message: `الباسورد غلط. متبقي لك ${remaining} محاولات قبل قفل الحساب مؤقتًا.`
      });
    }

    // باسورد صح - نصفر عداد المحاولات الغلط
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.sessionToken = generateToken();
    await user.save();

    return res.json({
      message: 'تم تسجيل الدخول بنجاح.',
      token: user.sessionToken,
      role: user.role,
      trialEnd: user.trialEnd,
      subscriptionEnd: user.subscriptionEnd
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error', message: 'حصل خطأ في السيرفر، حاول تاني.' });
  }
});

module.exports = router;
