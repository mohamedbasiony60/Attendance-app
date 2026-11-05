const mongoose = require('mongoose');

// سجل حضور يوم واحد لمستخدم واحد
const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  year: { type: Number, required: true },
  month: { type: Number, required: true }, // 1-12
  day: { type: Number, required: true },   // 1-31
  status: {
    type: Number, // 1 = حاضر، 0.5 = نصف يوم، 0 = غياب/راحة
    enum: [0, 0.5, 1],
    default: 0
  },
  is2x: { type: Boolean, default: false },   // يوم مضاعف
  isNight: { type: Boolean, default: false }, // سهرة
  updatedAt: { type: Date, default: Date.now }
});

// مينفعش يبقى في سجلين لنفس المستخدم في نفس اليوم بالظبط
attendanceSchema.index({ userId: 1, year: 1, month: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
