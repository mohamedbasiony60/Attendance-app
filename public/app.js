// إدارة معرف الجهاز والتوافق مع الحساب
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

// متغيرات حالة اليوم أو اليوم المختار للتعديل
let selectedTargetDate = null;
let currentMult = false;
let currentNight = false;

// تبديل التبويبات في شاشة الدخول
function switchTab(tab) {
  if (tab === 'login') {
    document.getElementById('loginForm').style.display = 'flex';
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabSignup').classList.remove('active');
  } else {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'flex';
    document.getElementById('tabSignup').classList.add('active');
    document.getElementById('tabLogin').classList.remove('active');
  }
}

let selectedRole = 'worker';
function pickRole(role) {
  selectedRole = role;
  if (role === 'worker') {
    document.getElementById('pickWorker').classList.add('selected');
    document.getElementById('pickSupervisor').classList.remove('selected');
  } else {
    document.getElementById('pickSupervisor').classList.add('selected');
    document.getElementById('pickWorker').classList.remove('selected');
  }
}

async function doLogin() {
  const phone = document.getElementById('loginPhone').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  if (!phone) { errEl.textContent = 'أدخل رقم الموبايل من فضلك'; return; }

  const { status, data } = await apiCall('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, deviceId })
  });

  if (status === 200) {
    setToken(data.token);
    await loadMain();
  } else {
    errEl.textContent = data.message || 'حدث خطأ، حاول تاني.';
  }
}

async function doSignup() {
  const phone = document.getElementById('signupPhone').value.trim();
  const errEl = document.getElementById('signupError');
  errEl.textContent = '';
  if (!phone) { errEl.textContent = 'أدخل رقم الموبايل من فضلك'; return; }

  const { status, data } = await apiCall('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ phone, role: selectedRole, deviceId })
  });

  if (status === 200) {
    setToken(data.token);
    await loadMain();
  } else {
    errEl.textContent = data.message || 'حدث خطأ، حاول تاني.';
  }
}

function logout() {
  clearToken();
  show('authScreen');
}

// أزرار المضاعف والسهرة
function toggleTodayMult() {
  currentMult = !currentMult;
  const btn = document.getElementById('todayMultBtn');
  if (currentMult) btn.classList.add('active-mult');
  else btn.classList.remove('active-mult');
}

function toggleTodayNight() {
  currentNight = !currentNight;
  const btn = document.getElementById('todayNightBtn');
  if (currentNight) btn.classList.add('active-night');
  else btn.classList.remove('active-night');
}

// العودة لليوم الحالي
function resetToToday() {
  selectedTargetDate = null;
  document.getElementById('selectedDateNotice').style.display = 'none';
  document.getElementById('resetToTodayBtn').style.display = 'none';
  document.getElementById('todayDateTitle').textContent = 'تسجيل حضور اليوم 📅';
  loadMain();
}

// الشاشة الرئيسية وجلب بيانات الشهر
async function loadMain() {
  const { status, data } = await apiCall('/api/attendance/today');
  if (status === 401) { clearToken(); show('authScreen'); return; }
  if (status === 402) { 
    document.getElementById('paywallMessage').textContent = data.message || ''; 
    show('paywallScreen'); 
    return; 
  }

  show('mainScreen');
  if (data.role) {
    document.getElementById('userRoleDisplay').textContent = data.role === 'supervisor' ? 'مشرف 👔' : 'عامل 👷';
  }

  // رسم التقويم بالبيانات الواردة
  if (data.monthRecords) {
    renderInteractiveCalendar(data.monthRecords, data.todayStr);
  }
}

// رسم التقويم التفاعلي (السابق متاح للتعديل، القادم مغلق)
function renderInteractiveCalendar(monthData = {}, serverTodayStr) {
  const grid = document.getElementById('calendarDaysGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const todayDate = now.getDate(); // رقم اليوم الحالي

  // أسماء الشهور بالعربي
  const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const monthTitleEl = document.getElementById('currentMonthName');
  if (monthTitleEl) {
    monthTitleEl.textContent = `${monthNames[month]} ${year}`;
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const record = monthData[dayStr];

    const box = document.createElement('div');
    box.className = 'day-box';

    let tagText = '-';
    if (record) {
      if (record.status == 1) {
        box.classList.add('present');
        tagText = 'حاضر';
      } else if (record.status == 0.5) {
        box.classList.add('half');
        tagText = '½ يوم';
      } else {
        box.classList.add('absent');
        tagText = 'غائب';
      }

      if (record.isMult) {
        box.classList.add('x2');
        tagText += ' x2';
      }
      if (record.isNight) {
        tagText += ' 🌙';
      }
    }

    // السماح فقط بالتعديل للأيام السابقة وحتى اليوم الحالي (d <= todayDate)
    if (d <= todayDate) {
      box.classList.add('editable');
      box.onclick = () => selectDayForEditing(dayStr, d, record);
    } else {
      box.classList.add('future');
    }

    box.innerHTML = `<span class="day-num">${d}</span><span class="day-tag">${tagText}</span>`;
    grid.appendChild(box);
  }

  // فحص هل اليوم هو آخر يوم في الشهر لإظهار زر حساب المرتب
  const isLastDay = todayDate === daysInMonth;
  const lastDayView = document.getElementById('lastDayView');
  if (lastDayView) {
    lastDayView.style.display = isLastDay ? 'block' : 'none';
  }
}

// عند الضغط على أي يوم في التقويم لتعديله
function selectDayForEditing(dayStr, dayNum, currentRecord) {
  selectedTargetDate = dayStr;
  document.getElementById('todayDateTitle').textContent = `تعديل يوم: ${dayNum} نوفمبر`;
  const notice = document.getElementById('selectedDateNotice');
  notice.textContent = `أنت تقوم الآن بتعديل بيانات يوم ${dayNum}`;
  notice.style.display = 'block';
  document.getElementById('resetToTodayBtn').style.display = 'block';

  // ملء النموذج بالحياة القديمة إن وجدت
  if (currentRecord) {
    document.getElementById('todayStatus').value = currentRecord.status;
    currentMult = !!currentRecord.isMult;
    currentNight = !!currentRecord.isNight;
  } else {
    document.getElementById('todayStatus').value = "1";
    currentMult = false;
    currentNight = false;
  }

  // تحديث شكل أزرار المضاعف والسهرة
  const multBtn = document.getElementById('todayMultBtn');
  if (currentMult) multBtn.classList.add('active-mult'); else multBtn.classList.remove('active-mult');

  const nightBtn = document.getElementById('todayNightBtn');
  if (currentNight) nightBtn.classList.add('active-night'); else nightBtn.classList.remove('active-night');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// حفظ بيانات الحضور (سواء اليوم الحالي أو يوم تم اختياره من التقويم)
async function saveAttendance() {
  const statusVal = parseFloat(document.getElementById('todayStatus').value);
  const msgEl = document.getElementById('todaySavedMsg');
  msgEl.textContent = '';

  const payload = {
    date: selectedTargetDate, // لو null السيرفر سيعتبره اليوم الحالي
    status: statusVal,
    isMult: currentMult,
    isNight: currentNight
  };

  const res = await apiCall('/api/attendance/save', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (res.status === 200) {
    msgEl.textContent = 'تم الحفظ والتحديث بنجاح ✅';
    await loadMain();
  } else {
    msgEl.style.color = '#f87171';
    msgEl.textContent = res.data.message || 'حدث خطأ أثناء الحفظ';
  }
}

// حساب المرتب (في آخر يوم)
async function calcSalary() {
  const advance = parseFloat(document.getElementById('advanceInput').value) || 0;
  const res = await apiCall('/api/salary/calculate', {
    method: 'POST',
    body: JSON.stringify({ advance })
  });

  if (res.status === 200) {
    const data = res.data;
    document.getElementById('attemptsRemainingMsg').textContent = `متبقي لديك ${data.attemptsRemaining} محاولات للتعديل.`;
    document.getElementById('resNetSalary').textContent = data.netSalary.toFixed(2);
    document.getElementById('resDays').textContent = data.weightedDays;
    document.getElementById('resNights').textContent = data.nightCount;
    document.getElementById('resGross').textContent = data.grossSalary.toFixed(2);
    document.getElementById('resIns').textContent = data.insuranceDeducted.toFixed(2);
    document.getElementById('resTax').textContent = data.tax.toFixed(2);
    document.getElementById('resAdvance').textContent = data.advance.toFixed(2);
    document.getElementById('salaryResultBox').style.display = 'block';
  } else {
    document.getElementById('attemptsRemainingMsg').textContent = res.data.message || 'فشل حساب المرتب';
  }
}

window.onload = async function () {
  if (getToken()) {
    await loadMain();
  } else {
    show('authScreen');
  }
};