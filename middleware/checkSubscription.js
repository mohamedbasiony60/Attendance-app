const { getEgyptNow } = require('../utils/egyptDate');

// النظام الجديد: أول 10 أيام من كل شهر مجانية للجميع (من غير ارتباط بتاريخ التسجيل)
// من يوم 11 لازم اشتراك فعال
function checkSubscription(req, res, next) {
  const now = getEgyptNow();

  // الفترة المجانية الشهرية - مفتوحة للجميع من غير شروط
  if (now.day <= 10) {
    req.accessType = 'monthly_free_window';
    return next();
  }

  const user = req.currentUser;
  const nowDate = new Date(now.year, now.month - 1, now.day, now.hour, now.minute);

  const subscriptionStillActive = user.subscriptionActive && user.subscriptionEnd && nowDate <= new Date(user.subscriptionEnd);

  if (subscriptionStillActive) {
    req.accessType = 'subscription';
    return next();
  }

  return res.status(402).json({
    error: 'subscription_required',
    message: 'الفترة المجانية لهذا الشهر (أول 10 أيام) انتهت. برجاء دفع الاشتراك للمتابعة.'
  });
}

module.exports = checkSubscription;
