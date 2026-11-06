// ===== إدارة معرف الجهاز =====
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

  const { status, data } = await apiCall('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, pin })
  });

  if (status !== 200) { errEl.textContent = data.message || 'حصل خطأ، حاول تاني.'; return; }

  setToken(data.token);
  localStorage.setItem('user_role', data.role);
  await loadMain();
}

async function doSignup() {
  const phone = document.getElementById('signupPhone').value.trim();
  const pin = document.getElementById('signupPin').value.trim();
  const errEl = document.getElementById('signupError');
  errEl.textContent = '';
  if (!phone) { errEl.textContent = 'اكتب رقم الموبايل.'; return; }
  if (!/^\d{4}$/.test(pin)) { errEl.textContent = 'الباسورد لازم يكون 4 أرقام.'; return; }
  if (!selectedRole) { errEl.textContent = 'اختار نوع الحساب.'; return; }

  const { status, data } = await apiCall('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ phone, role: selectedRole, deviceId, pin })
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

async function loadMain() {
  const { status, data } = await apiCall('/api/attendance/today');

  if (status === 401) { clearToken(); show('authScreen'); return; }
  if (status === 402) {
    document.getElementById('paywallMessage').textContent = data.message || 'انتهت فترة التجربة المجانية. من فضلك اشترك للمتابعة.';
    show('paywallScreen');
    return;
  }
  if (status !== 200) { show('authScreen'); return; }

  const role = localStorage.getItem('user_role');
  document.getElementById('userRoleDisplay').textContent = role === 'supervisor' ? 'مشرف 👔' : 'عامل 👷';

  const t = data.today;
  document.getElementById('todayDateTitle').textContent = `📅 تسجيل حضور اليوم: ${t.day}/${t.month}/${t.year}`;

  const arabicDayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const dayIndex = new Date(t.year, t.month - 1, t.day).getDay();
  document.getElementById('todayDayName').textContent = arabicDayNames[dayIndex];

  document.getElementById('todayStatus').value = data.record.status;
  currentMult = !!data.record.is2x;
  currentNight = !!data.record.isNight;
  updateTodayButtons();

  show('mainScreen');

  // تحميل التقويم الجانبي (للعرض فقط) في كل الأحوال
  await loadCalendar();
}

function toggleTodayMult() { currentMult = !currentMult; updateTodayButtons(); }
function toggleTodayNight() { currentNight = !currentNight; updateTodayButtons(); }
function updateTodayButtons() {
  document.getElementById('todayMultBtn').classList.toggle('active-mult', currentMult);
  document.getElementById('todayNightBtn').classList.toggle('active-night', currentNight);
}

async function saveToday() {
  const status = parseFloat(document.getElementById('todayStatus').value);
  const msgEl = document.getElementById('todaySavedMsg');

  const { status: httpStatus, data } = await apiCall('/api/attendance/today', {
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

  // نحدث التقويم الجانبي فورًا عشان يظهر اليوم اللي اتسجل
  await loadCalendar();
}

// ===== التقويم الجانبي - للعرض فقط =====
const monthNamesAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

async function loadCalendar() {
  const { status, data } = await apiCall('/api/attendance/month');
  if (status !== 200) return;

  document.getElementById('currentMonthTitle').textContent = `${monthNamesAr[data.month - 1]} ${data.year}`;

  const grid = document.getElementById('calendarDaysGrid');
  grid.innerHTML = data.days.map(d => {
    let cls = 'day-box';
    let tag = '-';

    if (d.day < data.today) {
      // يوم فات - عرض فقط
      if (d.status === 1) { cls += ' present'; tag = 'حاضر'; }
      else if (d.status === 0.5) { cls += ' half'; tag = '½ يوم'; }
      else { cls += ' absent'; tag = 'غياب'; }
      if (d.is2x) { cls += ' x2'; tag += ' x2'; }
      if (d.isNight) tag += ' 🌙';
    } else if (d.day === data.today) {
      cls += ' today-box';
      tag = 'اليوم';
    } else {
      cls += ' future';
      tag = '—';
    }

    const clickAttr = d.day === data.today ? `onclick="scrollToForm()"` : '';

    return `<div class="${cls}" ${clickAttr}>
      <span class="day-num">${d.day}</span>
      <span class="day-tag">${tag}</span>
    </div>`;
  }).join('');

  // إظهار قسم حساب المرتب فقط في آخر يوم بالشهر
  const lastDayView = document.getElementById('lastDayView');
  if (data.isLastDay) {
    lastDayView.style.display = 'block';
    document.getElementById('attemptsRemainingMsg').textContent =
      `لديك ${data.salaryCalcAttemptsRemaining} من 3 محاولات لحساب المرتب هذا الشهر.`;
  } else {
    lastDayView.style.display = 'none';
  }
}

function scrollToForm() {
  document.querySelector('.main-form-card').scrollIntoView({ behavior: 'smooth' });
}

// ===== حساب المرتب (آخر يوم بس) =====
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
  document.getElementById('resNights').textContent = r.nightCount;
  document.getElementById('resGross').textContent = r.grossSalary;
  document.getElementById('resIns').textContent = r.insuranceDeducted;
  document.getElementById('resTax').textContent = r.tax;
  document.getElementById('resAdvance').textContent = r.advance;
  document.getElementById('salaryResultBox').style.display = 'block';
}

// ===== إرسال اقتراح/تعليق =====
async function sendSuggestion() {
  const textEl = document.getElementById('suggestionText');
  const msgEl = document.getElementById('suggestionMsg');
  const text = textEl.value.trim();

  if (!text) {
    msgEl.style.color = '#f87171';
    msgEl.textContent = 'اكتب اقتراحك الأول.';
    return;
  }

  const { status, data } = await apiCall('/api/suggestion', {
    method: 'POST',
    body: JSON.stringify({ text })
  });

  if (status !== 200) {
    msgEl.style.color = '#f87171';
    msgEl.textContent = data.message || 'حصل خطأ، حاول تاني.';
    return;
  }

  msgEl.style.color = '#34d399';
  msgEl.textContent = data.message;
  textEl.value = '';
}

// ===== بداية التشغيل =====
window.onload = async function () {
  if (getToken()) { await loadMain(); }
  else { show('authScreen'); }
};
