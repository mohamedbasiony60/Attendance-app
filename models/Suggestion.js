const mongoose = require('mongoose');

// اقتراحات وتعليقات العملاء - تظهر للأدمن بس
const suggestionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  phone: { type: String }, // مخزن هنا كمان عشان يسهل عرضه للأدمن من غير ما يعمل ربط كل مرة
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Suggestion', suggestionSchema);
