// admin.js
let ADMIN_BOUND = false;

// Lưu trữ các listener để có thể ngắt (off) khi chuyển tab, tránh rò rỉ bộ nhớ
let listeners = {};

window.initAdminPage = function (user) {
  if (ADMIN_BOUND) return;
  ADMIN_BOUND = true;

  bindAdminTabs();
  bindCreateAccount();
  bindBalanceTab();
  bindKeyTabs();
  bindDenomButtons();
};

// Hàm này được gọi từ main.js mỗi khi bấm vào tab "Quản lí"
window.refreshAdminData = function() {
  loadBalanceUserOptions();
  loadLogs();
  
  // Load lại tất cả các tab key
  const packs = ['1d', '3d', '7d', '30d'];
  packs.forEach(pack => {
    renderKeyList(pack, `keyList${pack}`);
  });
};

function bindAdminTabs() {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.admin;
      
      document.querySelectorAll('.admin-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(`admin-${target}`).classList.remove('hidden');

      // Kích hoạt load dữ liệu ngay khi bấm vào tab con
      if (target === 'log') loadLogs();
      if (target === 'balance') loadBalanceUserOptions();
    });
  });
}

function bindCreateAccount() {
  document.getElementById('createAccountBtn').addEventListener('click', async () => {
    const msg = document.getElementById('createMsg');
    const type = document.getElementById('createType').value; 
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
  });
}

// ================== REALTIME USER ==================
function loadBalanceUserOptions() {
  const sel = document.getElementById('balanceUserSelect');
  if (!sel) return;
  
  // Ngắt listener cũ trước khi tạo mới
  if (listeners['users']) listeners['users'].off();
  listeners['users'] = db.ref('users');

  listeners['users'].on('value', snap => {
    const users = snap.val() || {};
    const currentVal = sel.value; // Giữ lại lựa chọn hiện tại
    
    sel.innerHTML = '';
    for (const uname in users) {
      if (users[uname].role === 'USER') {
        const opt = document.createElement('option');
        opt.value = uname;
        opt.textContent = `${uname} (${formatMoney(users[uname].balance || 0)}đ)`;
        sel.appendChild(opt);
      }
    }
    // Khôi phục lại lựa chọn cũ nếu có
    if (currentVal && users[currentVal]) sel.value = currentVal;
  });
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
  });
}

function bindDenomButtons() {
  document.querySelectorAll('.denom').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('balanceAmount').value = btn.dataset.amount;
    });
  });
}

// ================== REALTIME KEYS ==================
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

    if (addBtn.dataset.bound === '1') continue;
    addBtn.dataset.bound = '1';

    addBtn.addEventListener('click', async () => {
      const val = document.getElementById(cfg.input).value.trim();
      if (!val) return;
      await db.ref(`keys/${pack}`).push(val);
      await writeLog(CURRENT_USER.username, 'ADD_KEY', `Thêm key vào gói ${pack}: ${val}`);
      document.getElementById(cfg.input).value = '';
    });

    renderKeyList(pack, cfg.list);
  }
}

function renderKeyList(pack, listId) {
  const ul = document.getElementById(listId);
  if (!ul) return;
  
  const refName = `keys_${pack}`;
  if (listeners[refName]) listeners[refName].off();
  listeners[refName] = db.ref(`keys/${pack}`);
  
  listeners[refName].on('value', snap => {
    const obj = snap.val() || {};
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
      };
      li.appendChild(del);
      ul.appendChild(li);
    });
  });
}

// ================== REALTIME LOGS ==================
function loadLogs() {
  const ul = document.getElementById('logList');
  if (!ul) return;
  
  if (listeners['logs']) listeners['logs'].off();
  listeners['logs'] = db.ref('logs');

  listeners['logs'].orderByChild('time').limitToLast(100).on('value', snap => {
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
  });
}
