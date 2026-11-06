function fmtDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('ar-EG');
}

async function loadAdminData() {
  const secretInput = document.getElementById('adminSecretInput');
  const errEl = document.getElementById('adminError');
  const secret = secretInput.value.trim();

  if (!secret) {
    errEl.textContent = 'اكتب باسورد الأدمن.';
    return;
  }

  errEl.textContent = '';

  const headers = { 'x-admin-secret': secret };

  const [statsRes, usersRes, suggestionsRes] = await Promise.all([
    fetch('/api/admin/stats', { headers }),
    fetch('/api/admin/users', { headers }),
    fetch('/api/admin/suggestions', { headers })
  ]);

  if (statsRes.status === 401) {
    errEl.textContent = 'باسورد الأدمن غلط.';
    return;
  }

  localStorage.setItem('admin_secret', secret);

  const stats = await statsRes.json();
  const usersData = await usersRes.json();
  const suggestionsData = await suggestionsRes.json();

  document.getElementById('statsBox').innerHTML = `
    <div class="stat-box"><b>${stats.totalUsers}</b>إجمالي المسجلين</div>
    <div class="stat-box"><b>${stats.activeSubscriptions}</b>اشتراكات فعالة</div>
    <div class="stat-box"><b>${stats.inTrial}</b>في فترة التجربة</div>
    <div class="stat-box"><b>${stats.totalAttendanceRecords}</b>سجلات الحضور</div>
  `;

  document.getElementById('usersTableBody').innerHTML = usersData.users.map(u => `
    <tr>
      <td>${u.phone}</td>
      <td>${u.role === 'supervisor' ? 'مشرف' : 'عامل'}</td>
      <td>${fmtDate(u.createdAt)}</td>
      <td>${fmtDate(u.trialEnd)}</td>
      <td>${u.subscriptionActive ? '✅' : '❌'}</td>
      <td>${fmtDate(u.subscriptionEnd)}</td>
    </tr>
  `).join('');

  document.getElementById('suggestionsTableBody').innerHTML = suggestionsData.suggestions.map(s => `
    <tr>
      <td>${s.phone || '-'}</td>
      <td style="text-align:right;">${s.text}</td>
      <td>${fmtDate(s.createdAt)}</td>
    </tr>
  `).join('') || '<tr><td colspan="3">لا يوجد اقتراحات بعد</td></tr>';

  document.getElementById('adminLoginBox').style.display = 'none';
  document.getElementById('adminContent').style.display = 'block';
}

window.onload = function () {
  const saved = localStorage.getItem('admin_secret');
  if (saved) {
    document.getElementById('adminSecretInput').value = saved;
    loadAdminData();
  }
};
