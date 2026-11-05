const mongoose = require('mongoose');

// بنسجل كل جهاز استخدم التجربة المجانية قبل كده
// حتى لو العميل مسح بيانات المتصفح وسجل برقم تاني، معرف الجهاز هيفضل موجود هنا
// ومش هناخده تجربة تانية
const deviceTrialSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  firstUsedAt: {
    type: Date,
    default: Date.now
  },
  // رقم الموبايل اللي استخدم التجربة أول مرة (للمرجعية فقط)
  usedByPhone: {
    type: String
  }
});

module.exports = mongoose.model('DeviceTrial', deviceTrialSchema);
