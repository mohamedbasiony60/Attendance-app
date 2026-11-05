const { getEgyptNow } = require('../utils/egyptDate');

// الدالة دي بتتأكد: هل المستخدم ده لسه له حق يستخدم الموقع؟
// (إما في فترة التجربة المجانية، أو عنده اشتراك شغال)
function checkSubscription(req, res, next) {
  const user = req.currentUser; // بيتحط قبل كده في middleware التسجيل
  const now = getEgyptNow();
  const nowDate = new Date(now.year, now.month - 1, now.day, now.hour, now.minute);

  const trialStillActive = user.trialEnd && nowDate <= new Date(user.trialEnd);
  const subscriptionStillActive = user.subscriptionActive && user.subscriptionEnd && nowDate <= new Date(user.subscriptionEnd);

  if (trialStillActive || subscriptionStillActive) {
    req.accessType = trialStillActive ? 'trial' : 'subscription';
    return next();
  }

  // لا تجربة سارية ولا اشتراك سارٍ - لازم يدفع
  return res.status(402).json({
    error: 'subscription_required',
    message: 'انتهت فترة التجربة المجانية. من فضلك اشترك للمتابعة.'
  });
}

module.exports = checkSubscription;
