const express = require('express');
const router = express.Router();

// رابط الدفع (إنستاباي مثلاً) - بيتحط كمتغير بيئة في إعدادات Bonto
// وتقدر تغيره في أي وقت من غير ما تحتاج تعدل كود
router.get('/payment-link', (req, res) => {
  res.json({ link: process.env.PAYMENT_LINK || null });
});

module.exports = router;
