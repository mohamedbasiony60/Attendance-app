const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, trim: true },
  role: { type: String, enum: ['worker', 'supervisor'], required: true },

  // باسورد الدخول (4 أرقام) - بيتخزن مشفر (hash) مش نص صريح
  pinHash: { type: String, required: true },

  // حماية من محاولات تخمين الباسورد
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },

  // الجهاز اللي سجل بيه أول مرة - بيُستخدم بس لمنع تكرار التجربة المجانية
  // (مش بيُستخدم لمنع الدخول من جهاز تاني، لأن ممكن يكون جهاز مشترك بين العمال)
  deviceId: { type: String, required: true },

  trialStart: { type: Date, default: Date.now },
  trialEnd: {
    type: Date,
    default: function () {
      const d = new Date(this.trialStart || Date.now());
      d.setDate(d.getDate() + 7);
      return d;
    }
  },

  subscriptionActive: { type: Boolean, default: false },
  subscriptionEnd: { type: Date, default: null },
  currentLicenseCode: { type: String, default: null },

  createdAt: { type: Date, default: Date.now },
  sessionToken: { type: String, default: null }
});

module.exports = mongoose.model('User', userSchema);
