const express = require('express');
const router = express.Router();
const Suggestion = require('../models/Suggestion');

// العميل بيبعت اقتراح/تعليق - متاح حتى لو التجربة خلصت (مش محمي بفحص الاشتراك)
router.post('/', async (req, res) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'empty_text', message: 'اكتب الاقتراح الأول.' });
  }

  await Suggestion.create({
    userId: req.currentUser._id,
    phone: req.currentUser.phone,
    text: text.trim()
  });

  res.json({ message: 'تم إرسال اقتراحك بنجاح، شكرًا ليك! 🙏' });
});

module.exports = router;
