const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, trim: true },
  role: { type: String, enum: ['worker', 'supervisor'], required: true },

  pinHash: { type: String, required: true },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },

  deviceId: { type: String, required: true },

  // الاشتراك المدفوع - بيتفعل بعد ما الأدمن يأكد استلام الدفع
  subscriptionActive: { type: Boolean, default: false },
  subscriptionEnd: { type: Date, default: null },
  currentLicenseCode: { type: String, default: null },

  // جهة التأمين - نص حر بيحدده الأدمن، مالوش أي تأثير على حساب المرتب
  insuranceProvider: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now },
  sessionToken: { type: String, default: null }
});

module.exports = mongoose.model('User', userSchema);
