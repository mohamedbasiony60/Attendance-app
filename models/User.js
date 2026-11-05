const mongoose = require('mongoose');

// كل مستخدم (عميل) بيتسجل برقم موبايله، ومرتبط بجهاز واحد بس
const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true, // رقم الموبايل مينفعش يتكرر لمستخدمين مختلفين
    trim: true
  },
  role: {
    type: String,
    enum: ['worker', 'supervisor'], // عامل أو مشرف
    required: true
  },
  // معرف الجهاز - بيتولد مرة واحدة في متصفح العميل ويتخزن عنده
  // ده بيمنع إن نفس الجهاز ياخد تجربة مجانية تانية لو مسح بيانات المتصفح وسجل برقم جديد
  deviceId: {
    type: String,
    required: true
  },
  // تاريخ بداية التجربة المجانية (بيتحدد أول مرة يسجل فيها)
  trialStart: {
    type: Date,
    default: Date.now
  },
  // تاريخ نهاية التجربة المجانية (أسبوع من تاريخ البداية)
  trialEnd: {
    type: Date,
    default: function () {
      const d = new Date(this.trialStart || Date.now());
      d.setDate(d.getDate() + 7);
      return d;
    }
  },
  // هل الاشتراك شغال؟ وتاريخ انتهاء آخر اشتراك مدفوع (لو موجود)
  subscriptionActive: {
    type: Boolean,
    default: false
  },
  subscriptionEnd: {
    type: Date,
    default: null
  },
  // الكود الشهري الحالي بتاع المستخدم (بيتحدد بعد الدفع)
  currentLicenseCode: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // توكن الجلسة - بيتولد وقت تسجيل الدخول ويُستخدم للتحقق من هوية المستخدم في كل طلب
  sessionToken: {
    type: String,
    default: null
  }
});

module.exports = mongoose.model('User', userSchema);
