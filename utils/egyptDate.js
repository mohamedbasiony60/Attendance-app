// السيرفر ممكن يكون شغال بأي توقيت (UTC غالبًا)
// الدالة دي بترجع تاريخ اليوم بتوقيت القاهرة بالظبط، عشان "اليوم الجديد" يبدأ
// مع الساعة 12 بالليل بتوقيت مصر، مش بتوقيت تاني

function getEgyptNow() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(new Date());
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });

  return {
    year: parseInt(map.year),
    month: parseInt(map.month),
    day: parseInt(map.day),
    hour: parseInt(map.hour),
    minute: parseInt(map.minute)
  };
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function isLastDayOfMonth() {
  const now = getEgyptNow();
  const daysInMonth = getDaysInMonth(now.year, now.month);
  return now.day === daysInMonth;
}

module.exports = { getEgyptNow, getDaysInMonth, isLastDayOfMonth };
