function getOrCreateDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    localStorage.setItem('device_id', id);
  }
  return id;
}
const deviceId = getOrCreateDeviceId();

function getToken() { return localStorage.getItem('auth_token'); }
function setToken(t) { localStorage.setItem('auth_token', t); }
function clearToken() { localStorage.removeItem('auth_token'); }

function show(id) {
  document.querySelectorAll('.screen').forEach(el => el.style.display = 'none');
  document.getElementById(id).style.display = 'block';
}

async function apiCall(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ===== الدخول / التسجيل =====
function switchTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
  document.getElementById('loginForm').style.display = tab === 'login' ? 'flex' : 'none';
  document.getElementById('signupForm').style.display = tab === 'signup' ? 'flex' : 'none';
}

let selectedRole = 'worker';
function pickRole(role) {
  selectedRole = role;
  document.getElementById('pickWorker').classList.toggle('selected', role === 'worker');
  document.getElementById('pickSupervisor').classList.toggle('selected', role === 'supervisor');
}

async function doLogin() {
  const phone = document.getElementById('loginPhone').value.trim();
  const pin = document.getElementById('loginPin').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  if (!phone) { errEl.textContent = 'اكتب رقم الموبايل.'; return; }
  if (!/^\d{4}$/.test(pin)) { errEl.textContent = 'الباسورد لازم يكون 4 أرقام.'; return; }

  const { status, data } = await apiCall('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone, pin }) });
  if (status !== 200) { errEl.textContent = data.message || 'حصل خطأ، حاول تاني.'; return; }

  setToken(data.token);
  localStorage.setItem('user_role', data.role);
  await loadMain();
}

async function doSignup() {
  const phone = document.getElementById('signupPhone').value.trim();
  const pin = document.getElementById('signupPin').value.trim();
  const confirmPin = document.getElementById('signupPinConfirm').value.trim();
  const errEl = document.getElementById('signupError');
  errEl.textContent = '';
  if (!phone) { errEl.textContent = 'اكتب رقم الموبايل.'; return; }
  if (!/^\d{4}$/.test(pin)) { errEl.textContent = 'الباسورد لازم يكون 4 أرقام.'; return; }
  if (pin !== confirmPin) { errEl.textContent = 'الباسوردين مش متطابقين.'; return; }
  if (!selectedRole) { errEl.textContent = 'اختار نوع الحساب.'; return; }

  const { status, data } = await apiCall('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ phone, role: selectedRole, deviceId, pin, confirmPin })
  });

  if (status !== 201) { errEl.textContent = data.message || 'حصل خطأ، حاول تاني.'; return; }

  setToken(data.token);
  localStorage.setItem('user_role', data.role);
  await loadMain();
}

function logout() {
  clearToken();
  localStorage.removeItem('user_role');
  location.reload();
}

// ===== الشاشة الرئيسية =====
let currentMult = false;
let currentNight = false;
let selectedDay = null;
let monthData = null; // آخر بيانات شهر محملة

const arabicDayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const monthNamesAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

async function loadMain() {
  // أول حاجة نتأكد إن فيه صلاحية استخدام (مش محتاج اشتراك) عن طريق /month
  const { status, data } = await apiCall('/api/attendance/month');

  if (status === 401) { clearToken(); show('authScreen'); return; }
  if (status === 402) { await showPaywall(data.message); return; }
  if (status !== 200) { show('authScreen'); return; }

  const role = localStorage.getItem('user_role');
  document.getElementById('userRoleDisplay').textContent = role === 'supervisor' ? 'مشرف 👔' : 'عامل 👷';

  monthData = data;
  document.getElementById('currentMonthTitle').textContent = `${monthNamesAr[data.month - 1]} ${data.year}`;

  renderCalendar();
  selectDay(data.today); // افتراضيًا نفتح فورم النهارده

  show('mainScreen');
  await loadSalaryWindow();
}

async function showPaywall(message) {
  document.getElementById('paywallMessage').textContent = message || 'الفترة المجانية انتهت.';
  const { data } = await apiCall('/api/config/payment-link');
  const btn = document.getElementById('paymentLinkBtn');
  const noLinkMsg = document.getElementById('noPaymentLinkMsg');
  if (data.link) {
    btn.href = data.link;
    btn.style.display = 'block';
    noLinkMsg.style.display = 'none';
  } else {
    btn.style.display = 'none';
    noLinkMsg.style.display = 'block';
  }
  show('paywallScreen');
}

function renderCalendar() {
  const grid = document.getElementById('calendarDaysGrid');
  grid.innerHTML = monthData.days.map(d => {
    let cls = 'day-box';
    let tag = '-';

    if (d.day <= monthData.today) {
      if (d.status === 1) { cls += ' present'; tag = 'حاضر'; }
      else if (d.status === 0.5) { cls += ' half'; tag = '½ يوم'; }
      else { cls += ' absent'; tag = 'غياب'; }
      if (d.is2x) { cls += ' x2'; tag += ' x2'; }
      if (d.isNight) tag += ' 🌙';
      cls += ' editable';
    } else {
      cls += ' future';
      tag = '—';
    }

    if (d.day === selectedDay) cls += ' today-box';

    const clickAttr = d.day <= monthData.today ? `onclick="selectDay(${d.day})"` : '';

    return `<div class="${cls}" ${clickAttr}>
      <span class="day-num">${d.day}</span>
      <span class="day-tag">${tag}</span>
    </div>`;
  }).join('');
}

async function selectDay(day) {
  selectedDay = day;
  renderCalendar();

  const { status, data } = await apiCall(`/api/attendance/day/${day}`);
  if (status !== 200) return;

  const dayIndex = new Date(data.year, data.month - 1, data.day).getDay();
  document.getElementById('formDateTitle').textContent = `📅 ${data.day}/${data.month}/${data.year}`;
  document.getElementById('formDayName').textContent = arabicDayNames[dayIndex];
  document.getElementById('pastDayNotice').style.display = (day < monthData.today) ? 'block' : 'none';

  document.getElementById('dayStatus').value = data.record.status;
  currentMult = !!data.record.is2x;
  currentNight = !!data.record.isNight;
  updateDayButtons();
  document.getElementById('daySavedMsg').textContent = '';
}

function toggleDayMult() { currentMult = !currentMult; updateDayButtons(); }
function toggleDayNight() { currentNight = !currentNight; updateDayButtons(); }
function updateDayButtons() {
  document.getElementById('dayMultBtn').classList.toggle('active-mult', currentMult);
  document.getElementById('dayNightBtn').classList.toggle('active-night', currentNight);
}

async function saveDay() {
  const status = parseFloat(document.getElementById('dayStatus').value);
  const msgEl = document.getElementById('daySavedMsg');

  const { status: httpStatus, data } = await apiCall(`/api/attendance/day/${selectedDay}`, {
    method: 'POST',
    body: JSON.stringify({ status, is2x: currentMult, isNight: currentNight })
  });

  if (httpStatus !== 200) {
    msgEl.style.color = '#f87171';
    msgEl.textContent = data.message || 'حصل خطأ، حاول تاني.';
    return;
  }

  msgEl.style.color = '#34d399';
  msgEl.textContent = data.message;

  // نحدث بيانات الشهر والتقويم فورًا
  const monthRes = await apiCall('/api/attendance/month');
  if (monthRes.status === 200) {
    monthData = monthRes.data;
    renderCalendar();
  }
}

// ===== نافذة حساب المرتب =====
async function loadSalaryWindow() {
  const { status, data } = await apiCall('/api/attendance/salary-window');
  const view = document.getElementById('salaryWindowView');

  if (status !== 200 || !data.active) { view.style.display = 'none'; return; }

  view.style.display = 'block';
  document.getElementById('sumPresent').textContent = data.summary.presentCount;
  document.getElementById('sumHalf').textContent = data.summary.halfCount;
  document.getElementById('sumNight').textContent = data.summary.nightCount;
  document.getElementById('sumAbsent').textContent = data.summary.absentCount;
  document.getElementById('attemptsRemainingMsg').textContent =
    `لديك ${data.attemptsRemaining} من 3 محاولات لحساب المرتب هذا الشهر.`;
}

async function calcSalary() {
  const advance = document.getElementById('advanceInput').value;
  const msgEl = document.getElementById('attemptsRemainingMsg');

  const { status, data } = await apiCall('/api/attendance/calculate-salary', {
    method: 'POST',
    body: JSON.stringify({ advance })
  });

  if (status === 429) { msgEl.style.color = '#f87171'; msgEl.textContent = data.message; return; }
  if (status !== 200) { msgEl.style.color = '#f87171'; msgEl.textContent = data.message || 'حصل خطأ، حاول تاني.'; return; }

  msgEl.style.color = '#fbbf24';
  msgEl.textContent = `تم الحساب. متبقي لك ${data.attemptsRemaining} من 3 محاولات.`;

  const r = data.result;
  document.getElementById('resNetSalary').textContent = r.netSalary;
  document.getElementById('resDays').textContent = r.weightedDays;
  document.getElementById('resGross').textContent = r.grossSalary;
  document.getElementById('resIns').textContent = r.insuranceDeducted;
  document.getElementById('resTax').textContent = r.tax;
  document.getElementById('resAdvance').textContent = r.advance;
  document.getElementById('salaryResultBox').style.display = 'block';
}

// ===== الاقتراحات =====
async function sendSuggestion() {
  const textEl = document.getElementById('suggestionText');
  const msgEl = document.getElementById('suggestionMsg');
  const text = textEl.value.trim();

  if (!text) { msgEl.style.color = '#f87171'; msgEl.textContent = 'اكتب اقتراحك الأول.'; return; }

  const { status, data } = await apiCall('/api/suggestion', { method: 'POST', body: JSON.stringify({ text }) });

  if (status !== 200) { msgEl.style.color = '#f87171'; msgEl.textContent = data.message || 'حصل خطأ، حاول تاني.'; return; }

  msgEl.style.color = '#34d399';
  msgEl.textContent = data.message;
  textEl.value = '';
}

window.onload = async function () {
  if (getToken()) { await loadMain(); }
  else { show('authScreen'); }
};
