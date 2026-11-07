function getEgyptNow() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });
  return {
    year: parseInt(map.year), month: parseInt(map.month), day: parseInt(map.day),
    hour: parseInt(map.hour), minute: parseInt(map.minute)
  };
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function isLastDayOfMonth() {
  const now = getEgyptNow();
  return now.day === getDaysInMonth(now.year, now.month);
}

// آخر يوم في الشهر + أول يومين من الشهر الجديد = نافذة ظهور "احسب مرتبي"
// بترجع الشهر المستهدف (اللي هنحسب مرتبه) حسب مكاننا دلوقتي
function getSalaryWindow() {
  const now = getEgyptNow();
  const daysInThisMonth = getDaysInMonth(now.year, now.month);

  if (now.day === daysInThisMonth) {
    return { active: true, year: now.year, month: now.month };
  }

  if (now.day === 1 || now.day === 2) {
    let pmYear = now.year;
    let pmMonth = now.month - 1;
    if (pmMonth === 0) { pmMonth = 12; pmYear -= 1; }
    return { active: true, year: pmYear, month: pmMonth };
  }

  return { active: false };
}

module.exports = { getEgyptNow, getDaysInMonth, isLastDayOfMonth, getSalaryWindow };
