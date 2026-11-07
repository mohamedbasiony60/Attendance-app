function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ar-EG');
}

let adminSecret = '';

async function loadAdminData() {
  const secretInput = document.getElementById('adminSecretInput');
  const errEl = document.getElementById('adminError');
  const secret = secretInput.value.trim();

  if (!secret) { errEl.textContent = 'اكتب باسورد الأدمن.'; return; }
  errEl.textContent = '';
  adminSecret = secret;

  const headers = { 'x-admin-secret': secret };

  const [statsRes, usersRes, suggestionsRes] = await Promise.all([
    fetch('/api/admin/stats', { headers }),
    fetch('/api/admin/users', { headers }),
    fetch('/api/admin/suggestions', { headers })
  ]);

  if (statsRes.status === 401) { errEl.textContent = 'باسورد الأدمن غلط.'; return; }

  localStorage.setItem('admin_secret', secret);

  const stats = await statsRes.json();
  const usersData = await usersRes.json();
  const suggestionsData = await suggestionsRes.json();

  document.getElementById('statsBox').innerHTML = `
    <div class="stat-box"><b>${stats.totalUsers}</b>إجمالي المسجلين</div>
    <div class="stat-box"><b>${stats.activeSubscriptions}</b>اشتراكات فعالة</div>
    <div class="stat-box"><b>${stats.totalAttendanceRecords}</b>سجلات الحضور</div>
  `;

  document.getElementById('usersTableBody').innerHTML = usersData.users.map(u => `
    <tr>
      <td>${u.phone}</td>
      <td>${u.role === 'supervisor' ? 'مشرف' : 'عامل'}</td>
      <td>${fmtDate(u.createdAt)}</td>
      <td>
        <input type="text" value="${u.insuranceProvider || ''}" id="ins-${u._id}" style="width:110px; padding:4px; border-radius:6px; border:1px solid #374151; background:#0b1120; color:#fff; text-align:center;">
        <button onclick="saveInsurance('${u._id}')" style="padding:4px 8px; border-radius:6px; border:none; background:#059669; color:#fff; cursor:pointer; font-size:0.7rem;">حفظ</button>
      </td>
      <td>${u.subscriptionActive ? '✅' : '❌'}</td>
      <td>${fmtDate(u.subscriptionEnd)}</td>
      <td>
        <input type="date" id="subend-${u._id}" style="padding:4px; border-radius:6px; border:1px solid #374151; background:#0b1120; color:#fff;">
        <button onclick="activateSubscription('${u._id}')" style="padding:4px 8px; border-radius:6px; border:none; background:#0284c7; color:#fff; cursor:pointer; font-size:0.7rem;">تفعيل</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('suggestionsTableBody').innerHTML = suggestionsData.suggestions.map(s => `
    <tr><td>${s.phone || '-'}</td><td style="text-align:right;">${s.text}</td><td>${fmtDate(s.createdAt)}</td></tr>
  `).join('') || '<tr><td colspan="3">لا يوجد اقتراحات بعد</td></tr>';

  document.getElementById('adminLoginBox').style.display = 'none';
  document.getElementById('adminContent').style.display = 'block';
}

async function saveInsurance(userId) {
  const value = document.getElementById(`ins-${userId}`).value;
  await fetch(`/api/admin/users/${userId}/insurance`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
    body: JSON.stringify({ insuranceProvider: value })
  });
  loadAdminData();
}

async function activateSubscription(userId) {
  const dateVal = document.getElementById(`subend-${userId}`).value;
  if (!dateVal) { alert('اختار تاريخ نهاية الاشتراك الأول.'); return; }
  await fetch(`/api/admin/users/${userId}/subscription`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
    body: JSON.stringify({ subscriptionActive: true, subscriptionEnd: dateVal })
  });
  loadAdminData();
}

window.onload = function () {
  const saved = localStorage.getItem('admin_secret');
  if (saved) {
    document.getElementById('adminSecretInput').value = saved;
    loadAdminData();
  }
};
