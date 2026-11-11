// admin.js

let ADMIN_BOUND = false;

window.initAdminPage = function (user) {
  if (ADMIN_BOUND) {
    loadBalanceUserOptions();
    bindKeyTabs();
    loadLogs();
    return;
  }
  ADMIN_BOUND = true;

  bindAdminTabs();
  bindCreateAccount();
  bindBalanceTab();
  bindKeyTabs();
  bindDenomButtons();
  loadLogs();
  loadBalanceUserOptions();
};

// ==== TABS ====
function bindAdminTabs() {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.admin;
      document.querySelectorAll('.admin-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(`admin-${target}`).classList.remove('hidden');

      if (target === 'log') loadLogs();
      if (target === 'balance') loadBalanceUserOptions();
    });
  });
}

// ==== TẠO TÀI KHOẢN ====
function bindCreateAccount() {
  document.getElementById('createAccountBtn').addEventListener('click', async () => {
    const msg = document.getElementById('createMsg');
    const type = document.getElementById('createType').value; // USER | ADMIN
    const username = document.getElementById('createUsername').value.trim();
    const password = document.getElementById('createPassword').value;

    if (!username || !password) return flash(msg, 'Vui lòng nhập đủ thông tin');

    const checkSnap = await db.ref(`users/${username}`).once('value');
    if (checkSnap.exists()) return flash(msg, 'Tên đăng nhập đã tồn tại');

    const privateKey = generatePrivateKey(type);

    await db.ref(`users/${username}`).set({
      username,
      password,
      role: type,
      privateKey,
      balance: 0,
      createdAt: Date.now(),
      createdBy: CURRENT_USER.username
    });

    await writeLog(CURRENT_USER.username, 'CREATE_ACCOUNT', `Tạo tài khoản ${type}: ${username}`);

    // Hiển thị kết quả
    document.getElementById('resType').textContent = type;
    document.getElementById('resUsername').textContent = username;
    document.getElementById('resPassword').textContent = password;
    document.getElementById('resKey').textContent = privateKey;
    document.getElementById('createResult').classList.remove('hidden');
    document.getElementById('copyKeyBtn').onclick = () => {
      navigator.clipboard.writeText(privateKey);
      flash(msg, 'Đã sao chép private key', '#00e5ff');
    };

    flash(msg, 'Tạo tài khoản thành công', '#00e5ff');
    document.getElementById('createUsername').value = '';
    document.getElementById('createPassword').value = '';
    loadBalanceUserOptions();
  });
}

// ==== THÊM SỐ DƯ ====
async function loadBalanceUserOptions() {
  const sel = document.getElementById('balanceUserSelect');
  const snap = await db.ref('users').once('value');
  const users = snap.val() || {};
  sel.innerHTML = '';
  for (const uname in users) {
    if (users[uname].role === 'USER') {
      const opt = document.createElement('option');
      opt.value = uname;
      opt.textContent = `${uname} (${formatMoney(users[uname].balance || 0)}đ)`;
      sel.appendChild(opt);
    }
  }
}

function bindBalanceTab() {
  document.getElementById('addBalanceBtn').addEventListener('click', async () => {
    const msg = document.getElementById('balanceMsg');
    const uname = document.getElementById('balanceUserSelect').value;
    const amount = parseInt(document.getElementById('balanceAmount').value, 10);

    if (!uname) return flash(msg, 'Chọn tài khoản User');
    if (!amount || amount <= 0) return flash(msg, 'Số tiền không hợp lệ');

    const userRef = db.ref(`users/${uname}/balance`);
    const snap = await userRef.once('value');
    const cur = snap.val() || 0;
    await userRef.set(cur + amount);

    await writeLog(CURRENT_USER.username, 'ADD_BALANCE', `Cộng ${formatMoney(amount)}đ cho ${uname}`);
    flash(msg, `Đã cộng ${formatMoney(amount)}đ cho ${uname}`, '#00e5ff');
    document.getElementById('balanceAmount').value = '';
    loadBalanceUserOptions();
  });
}

function bindDenomButtons() {
  document.querySelectorAll('.denom').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('balanceAmount').value = btn.dataset.amount;
    });
  });
}

// ==== KEY TABS ====
function bindKeyTabs() {
  const map = {
    '1d':  { input: 'keyInput1d',  addBtn: 'addKey1d',  list: 'keyList1d'  },
    '3d':  { input: 'keyInput3d',  addBtn: 'addKey3d',  list: 'keyList3d'  },
    '7d':  { input: 'keyInput7d',  addBtn: 'addKey7d',  list: 'keyList7d'  },
    '30d': { input: 'keyInput30d', addBtn: 'addKey30d', list: 'keyList30d' }
  };

  for (const pack in map) {
    const cfg = map[pack];
    const addBtn = document.getElementById(cfg.addBtn);
    if (!addBtn) continue;

    // tránh bind 2 lần
    if (addBtn.dataset.bound === '1') {
      renderKeyList(pack, cfg.list);
      continue;
    }
    addBtn.dataset.bound = '1';

    addBtn.addEventListener('click', async () => {
      const val = document.getElementById(cfg.input).value.trim();
      if (!val) return;
      await db.ref(`keys/${pack}`).push(val);
      await writeLog(CURRENT_USER.username, 'ADD_KEY', `Thêm key vào gói ${pack}: ${val}`);
      document.getElementById(cfg.input).value = '';
      renderKeyList(pack, cfg.list);
    });

    renderKeyList(pack, cfg.list);
  }
}

async function renderKeyList(pack, listId) {
  const snap = await db.ref(`keys/${pack}`).once('value');
  const obj = snap.val() || {};
  const ul = document.getElementById(listId);
  ul.innerHTML = '';
  const entries = Object.entries(obj);
  if (entries.length === 0) {
    ul.innerHTML = '<li style="color:#666">Chưa có key nào</li>';
    return;
  }
  entries.forEach(([id, key]) => {
    const li = document.createElement('li');
    li.innerHTML = `<code>${key}</code>`;
    const del = document.createElement('button');
    del.textContent = 'Xóa';
    del.className = 'btn-secondary';
    del.onclick = async () => {
      await db.ref(`keys/${pack}/${id}`).remove();
      await writeLog(CURRENT_USER.username, 'DELETE_KEY', `Xóa key khỏi gói ${pack}: ${key}`);
      renderKeyList(pack, listId);
    };
    li.appendChild(del);
    ul.appendChild(li);
  });
}

// ==== LOG (chỉ OWNER) ====
async function loadLogs() {
  const ul = document.getElementById('logList');
  if (!ul) return;
  const snap = await db.ref('logs').orderByChild('time').limitToLast(100).once('value');
  const obj = snap.val() || {};
  ul.innerHTML = '';
  const arr = Object.entries(obj).reverse();
  if (arr.length === 0) {
    ul.innerHTML = '<li style="color:#666">Chưa có log</li>';
    return;
  }
  arr.forEach(([id, log]) => {
    const li = document.createElement('li');
    const t = new Date(log.time).toLocaleString('vi-VN');
    li.innerHTML = `<span>[${t}] <b>${log.actor}</b> → ${log.action}</span> <span>${log.detail || ''}</span>`;
    ul.appendChild(li);
  });
}
