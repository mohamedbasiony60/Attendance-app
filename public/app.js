// ===== إدارة معرف الجهاز =====
// كل جهاز بياخد معرف فريد بيتخزن في المتصفح، وبيتبعت مع كل تسجيل/دخول
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

// ===== دوال مساعدة لطلبات الـ API =====
async function apiCall(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// ===== شاشة الدخول/التسجيل =====
function switchTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabSignup').classList.toggle('active', tab === 'signup');
  document.getElementById('loginForm').style.display = tab === 'login' ? 'flex' : 'none';
  document.getElementById('signupForm').style.display = tab === 'signup' ? 'flex' : 'none';
}

let selectedRole = null;
function pickRole(role) {
  selectedRole = role;
  document.getElementById('pickWorker').classList.toggle('selected', role === 'worker');
  document.getElementById('pickSupervisor').classList.toggle('selected', role === 'supervisor');
}

async function doLogin() {
  const phone = document.getElementById('loginPhone').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  if (!phone) { errEl.textContent = 'اكتب رقم الموبايل.'; return; }

  const { status, data } = await apiCall('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, deviceId })
  });

  if (status !== 200) {
    errEl.textContent = data.message || 'حصل خطأ، حاول تاني.';
    return;
  }

  setToken(data.token);
  localStorage.setItem('user_role', data.role);
  await loadMain();
}

async function doSignup() {
  const phone = document.getElementById('signupPhone').value.trim();
  const errEl = document.getElementById('signupError');
  errEl.textContent = '';

  if (!phone) { errEl.textContent = 'اكتب رقم الموبايل.'; return; }
  if (!selectedRole) { errEl.textContent = 'اختار نوع الحساب (عامل أو مشرف).'; return; }

  const { status, data } = await apiCall('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ phone, role: selectedRole, deviceId })
  });

  if (status !== 201) {
    errEl.textContent = data.message || 'حصل خطأ، حاول تاني.';
    return;
  }

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
let currentIsLastDay = false;
let currentMult = false;
let currentNight = false;

async function loadMain() {
  const { status, data } = await apiCall('/api/attendance/today');

  if (status === 401) {
    clearToken();
    show('authScreen');
    return;
  }

  if (status === 402) {
    document.getElementById('paywallMessage').textContent = data.message || '';
    show('paywallScreen');
    return;
  }

  if (status !== 200) {
    show('authScreen');
    return;
  }

  const role = localStorage.getItem('user_role');
  document.getElementById('userRoleDisplay').textContent = role === 'supervisor' ? 'مشرف' : 'عامل';

  currentIsLastDay = data.isLastDay;

  if (data.isLastDay) {
    document.getElementById('todayView').style.display = 'none';
    document.getElementById('lastDayView').style.display = 'block';
    await loadMonthView();
  } else {
    document.getElementById('todayView').style.display = 'block';
    document.getElementById('lastDayView').style.display = 'none';
    const t = data.today;
    document.getElementById('todayDateTitle').textContent = `📅 اليوم: ${t.day}/${t.month}/${t.year}`;

    document.getElementById('todayStatus').value = data.record.status;
    currentMult = !!data.record.is2x;
    currentNight = !!data.record.isNight;
    updateTodayButtons();
  }

  show('mainScreen');
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
}

// ===== شاشة آخر يوم في الشهر =====
async function loadMonthView() {
  const { status, data } = await apiCall('/api/attendance/month');
  const listEl = document.getElementById('monthDaysList');

  if (status !== 200) {
    listEl.innerHTML = `<p class="error-text">${data.message || 'حصل خطأ في تحميل الجدول.'}</p>`;
    return;
  }

  listEl.innerHTML = data.days.map(d => {
    const statusText = d.status === 1 ? 'حاضر' : (d.status === 0.5 ? 'نصف يوم' : 'غياب');
    const tags = [
      d.is2x ? 'x2' : null,
      d.isNight ? 'سهرة' : null
    ].filter(Boolean).join(' - ');

    return `
      <div class="day-row">
        <div class="day-info">
          <div class="day-number-badge">${d.day}</div>
          <span>${statusText}</span>
        </div>
        <span class="day-tags">${tags}</span>
      </div>
    `;
  }).join('');

  const remaining = data.salaryCalcAttemptsRemaining;
  document.getElementById('attemptsRemainingMsg').textContent = `لديك ${remaining} من 3 محاولات لحساب المرتب هذا الشهر.`;
}

async function calcSalary() {
  const advance = document.getElementById('advanceInput').value;
  const msgEl = document.getElementById('attemptsRemainingMsg');

  const { status, data } = await apiCall('/api/attendance/calculate-salary', {
    method: 'POST',
    body: JSON.stringify({ advance })
  });

  if (status === 429) {
    msgEl.style.color = '#f87171';
    msgEl.textContent = data.message;
    return;
  }

  if (status !== 200) {
    msgEl.style.color = '#f87171';
    msgEl.textContent = data.message || 'حصل خطأ، حاول تاني.';
    return;
  }

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

// ===== بداية التشغيل =====
window.onload = async function () {
  if (getToken()) {
    await loadMain();
  } else {
    show('authScreen');
  }
};
