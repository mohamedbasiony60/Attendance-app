const mongoose = require('mongoose');

// بنتتبع عدد مرات استخدام زرار "احسب مرتبي" لكل مستخدم في كل شهر
// العداد ده متخزن في قاعدة البيانات (مش في المتصفح) عشان محدش يقدر يلعب فيه
const salaryCalcCounterSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  attemptsUsed: { type: Number, default: 0 } // لحد 3 بس
});

salaryCalcCounterSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('SalaryCalcCounter', salaryCalcCounterSchema);
