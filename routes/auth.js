const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const User = require('../models/User');
const DeviceTrial = require('../models/DeviceTrial');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// تسجيل مستخدم جديد
// بياخد: رقم الموبايل، الدور (عامل/مشرف)، معرف الجهاز
router.post('/signup', async (req, res) => {
  try {
    const { phone, role, deviceId } = req.body;

    if (!phone || !role || !deviceId) {
      return res.status(400).json({ error: 'missing_fields', message: 'لازم تبعت رقم الموبايل والدور ومعرف الجهاز.' });
    }

    if (!['worker', 'supervisor'].includes(role)) {
      return res.status(400).json({ error: 'invalid_role', message: 'الدور لازم يكون عامل أو مشرف.' });
    }

    // هل رقم الموبايل ده مسجل قبل كده؟
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({ error: 'phone_exists', message: 'رقم الموبايل ده مسجل بالفعل. سجل دخول بدل كده.' });
    }

    // هل الجهاز ده استخدم التجربة المجانية قبل كده؟ (حتى لو برقم موبايل مختلف)
    const deviceAlreadyUsedTrial = await DeviceTrial.findOne({ deviceId });

    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + 7);

    const newUser = new User({
      phone,
      role,
      deviceId,
      trialStart,
      // لو الجهاز استخدم التجربة قبل كده، منديهوش تجربة تانية (نخلي trialEnd = trialStart يعني مفيش تجربة)
      trialEnd: deviceAlreadyUsedTrial ? trialStart : trialEnd,
      sessionToken: generateToken()
    });

    await newUser.save();

    // لو الجهاز ده أول مرة، نسجله عشان منديهوش تجربة تانية بعد كده
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

// تسجيل الدخول لمستخدم موجود - لازم يكون من نفس الجهاز اللي سجل بيه
router.post('/login', async (req, res) => {
  try {
    const { phone, deviceId } = req.body;

    if (!phone || !deviceId) {
      return res.status(400).json({ error: 'missing_fields', message: 'لازم تبعت رقم الموبايل ومعرف الجهاز.' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ error: 'not_found', message: 'الرقم ده مش مسجل، سجل حساب جديد الأول.' });
    }

    // التأكد إن الدخول من نفس الجهاز اللي اتسجل بيه الحساب
    if (user.deviceId !== deviceId) {
      return res.status(403).json({
        error: 'device_mismatch',
        message: 'الحساب ده مرتبط بجهاز تاني. لا يمكن استخدامه من هذا الجهاز.'
      });
    }

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
