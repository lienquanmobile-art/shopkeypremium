// admin.js
let ADMIN_BOUND = false;
let listeners = {};

window.initAdminPage = function (user) {
  if (ADMIN_BOUND) return;
  ADMIN_BOUND = true;
  bindAdminTabs();
  bindCreateAccount();
  bindBalanceTab();
  bindKeyTabs();
  bindDenomButtons();
  bindBanLogic();
  
  // Bind logic cho Tạo Thẻ
  bindCardLogic();
};

window.refreshAdminData = function() {
  loadBalanceUserOptions();
  loadLogs();
  loadUserTable();
  loadCardList(); // Load danh sách thẻ
  const packs = ['1d', '3d', '7d', '30d'];
  packs.forEach(pack => renderKeyList(pack, `keyList${pack}`));
};

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
      if (target === 'list') loadUserTable();
      if (target === 'listcard') loadCardList();
    });
  });
}

// ================== QUẢN LÝ THẺ NẠP ==================
function generateCardCode() {
  let code = '';
  for(let i=0; i<16; i++) code += Math.floor(Math.random() * 10);
  return code;
}

function bindCardLogic() {
  document.querySelectorAll('.card-preset').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('cardValue').value = btn.dataset.amount;
    };
  });

  document.getElementById('createCardBtn')?.addEventListener('click', async () => {
    const msg = document.getElementById('createCardMsg');
    const value = parseInt(document.getElementById('cardValue').value);
    const day = parseInt(document.getElementById('cardExpDay').value);
    const month = parseInt(document.getElementById('cardExpMonth').value);
    const year = parseInt(document.getElementById('cardExpYear').value);

    if (!value || value < 1000) return msg.textContent = 'Mệnh giá không hợp lệ!';
    if (!day || !month || !year) return msg.textContent = 'Vui lòng nhập đủ ngày tháng năm!';

    const expDate = new Date(year, month - 1, day).getTime();
    if (expDate < Date.now()) return msg.textContent = 'Hạn sử dụng phải ở tương lai!';

    const code = generateCardCode();
    
    // Kiểm tra trùng (xác suất cực thấp nhưng vẫn check)
    const checkSnap = await db.ref(`cards/${code}`).once('value');
    if (checkSnap.exists()) {
      msg.textContent = 'Lỗi trùng mã thẻ, vui lòng bấm tạo lại!';
      return;
    }

    await db.ref(`cards/${code}`).set({
      code: code,
      value: value,
      expDate: expDate,
      status: 'unused',
      createdAt: Date.now()
    });
    
    await writeLog(CURRENT_USER.username, 'CREATE_CARD', `Tạo thẻ ${value}VND: ${code}`);
    
    msg.style.color = '#00ff88';
    msg.textContent = `Tạo thành công thẻ: ${code}`;
    document.getElementById('cardValue').value = '';
  });

  // Nút Nạp Thẻ cho User
  document.getElementById('openCardModalBtn')?.addEventListener('click', () => {
    document.getElementById('redeemCardModal').classList.remove('hidden');
    document.getElementById('redeemCardInput').value = '';
    document.getElementById('redeemCardMsg').textContent = '';
  });

  document.getElementById('closeRedeemBtn')?.addEventListener('click', () => {
    document.getElementById('redeemCardModal').classList.add('hidden');
  });

  document.getElementById('submitRedeemBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('redeemCardInput').value.trim();
    const msg = document.getElementById('redeemCardMsg');
    
    if (!input || input.length !== 16) {
      msg.style.color = '#ff3b5c';
      msg.textContent = 'Vui lòng nhập đúng 16 số!';
      return;
    }

    const cardRef = db.ref(`cards/${input}`);
    const snap = await cardRef.once('value');
    
    if (!snap.exists()) {
      msg.style.color = '#ff3b5c';
      msg.textContent = 'Vui lòng nhập thông tin thẻ chính xác!';
      return;
    }

    const card = snap.val();

    if (card.status === 'used') {
      msg.style.color = '#ff3b5c';
      msg.textContent = 'Thẻ đã sử dụng!';
      return;
    }

    if (Date.now() > card.expDate) {
      msg.style.color = '#ff3b5c';
      msg.textContent = 'Thẻ đã hết hạn!';
      await cardRef.update({ status: 'expired' });
      return;
    }

    // TÍNH XU THEO MỆNH GIÁ
    let coinsToAdd = 0;
    if (card.value === 1000) coinsToAdd = 10000;
    else if (card.value === 5000) coinsToAdd = 60000;
    else if (card.value === 10000) coinsToAdd = 120000;
    else if (card.value === 20000) coinsToAdd = 250000;
    else if (card.value === 50000) coinsToAdd = 625000;
    else if (card.value === 100000) coinsToAdd = 1400000;
    else if (card.value === 200000) coinsToAdd = 3000000;
    else if (card.value === 500000) coinsToAdd = 7500000;
    else coinsToAdd = Math.floor(card.value / 1000) * 10000;

    // Cập nhật trạng thái thẻ
    await cardRef.update({ 
      status: 'used', 
      usedBy: CURRENT_USER.username, 
      usedAt: Date.now() 
    });

    // Cộng xu
    const userRef = db.ref(`users/${CURRENT_USER.username}`);
    const userSnap = await userRef.once('value');
    await userRef.update({ coins: (userSnap.val().coins || 0) + coinsToAdd });

    writeLog(CURRENT_USER.username, 'REDEEM_CARD', `Nạp thẻ ${card.value}VND, nhận ${coinsToAdd} xu`);

    msg.style.color = '#00ff88';
    msg.textContent = `Nạp thành công ${coinsToAdd.toLocaleString('vi-VN')} xu!`;
    
    if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    
    setTimeout(() => {
      document.getElementById('redeemCardModal').classList.add('hidden');
      loadGameData(); // Load lại số xu
    }, 2000);
  });
}

function loadCardList() {
  const container = document.getElementById('cardListContainer');
  if (!container) return;
  if (listeners['cards']) listeners['cards'].off();
  listeners['cards'] = db.ref('cards');

  listeners['cards'].on('value', snap => {
    const data = snap.val() || {};
    const cards = Object.values(data);
    const now = Date.now();

    // Lọc bỏ thẻ cũ (đã dùng hoặc hết hạn quá 7 ngày)
    cards.forEach(c => {
      if ((c.status === 'used' || c.status === 'expired') && c.usedAt) {
        if (now - c.usedAt > 7 * 24 * 60 * 60 * 1000) {
          db.ref(`cards/${c.code}`).remove(); // Tự động xóa
        }
      }
    });

    // Sắp xếp: unused -> used -> expired
    cards.sort((a, b) => {
      const scoreA = a.status === 'unused' ? 1 : (a.status === 'used' ? 2 : 3);
      const scoreB = b.status === 'unused' ? 1 : (b.status === 'used' ? 2 : 3);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return b.createdAt - a.createdAt;
    });

    container.innerHTML = '';
    if (cards.length === 0) {
      container.innerHTML = '<p style="color:#666">Chưa có thẻ nào.</p>';
      return;
    }

    cards.forEach(card => {
      const d = new Date(card.expDate);
      const expStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
      
      let statusHtml = '';
      if (Date.now() > card.expDate && card.status === 'unused') {
        statusHtml = '<span class="card-status status-expired">Hết hạn</span>';
      } else if (card.status === 'used') {
        statusHtml = '<span class="card-status status-used">Đã sử dụng</span>';
      } else if (card.status === 'expired') {
        statusHtml = '<span class="card-status status-expired">Hết hạn</span>';
      } else {
        statusHtml = '<span class="card-status status-unused">Chưa sử dụng</span>';
      }

      const div = document.createElement('div');
      div.className = 'card-item';
      div.innerHTML = `
        <div class="card-info">
          <p class="card-code">${card.code}</p>
          <p>Mệnh giá: <b style="color:#ffd700">${card.value.toLocaleString('vi-VN')} VND</b></p>
          <p>Hạn: ${expStr}</p>
        </div>
        <div>${statusHtml}</div>
      `;
      container.appendChild(div);
    });
  });
}

// ================== CÁC HÀM CŨ ==================
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
    await db.ref(`users/${username}`).set({ username, password, role: type, privateKey, balance: 0, coins: 0, createdAt: Date.now(), createdBy: CURRENT_USER.username });
    await writeLog(CURRENT_USER.username, 'CREATE_ACCOUNT', `Tạo tài khoản ${type}: ${username}`);

    document.getElementById('resType').textContent = type;
    document.getElementById('resUsername').textContent = username;
    document.getElementById('resPassword').textContent = password;
    document.getElementById('resKey').textContent = privateKey;
    document.getElementById('createResult').classList.remove('hidden');
    document.getElementById('copyKeyBtn').onclick = () => { navigator.clipboard.writeText(privateKey); flash(msg, 'Đã sao chép private key', '#00e5ff'); };
    flash(msg, 'Tạo tài khoản thành công', '#00e5ff');
    document.getElementById('createUsername').value = '';
    document.getElementById('createPassword').value = '';
  });
}

function loadBalanceUserOptions() {
  const sel = document.getElementById('balanceUserSelect');
  if (!sel) return;
  if (listeners['users']) listeners['users'].off();
  listeners['users'] = db.ref('users');
  listeners['users'].on('value', snap => {
    const users = snap.val() || {};
    const currentVal = sel.value; 
    sel.innerHTML = '';
    for (const uname in users) {
      if (users[uname].role === 'USER') {
        const opt = document.createElement('option');
        opt.value = uname;
        opt.textContent = `${uname} (${formatMoney(users[uname].balance || 0)}đ)`;
        sel.appendChild(opt);
      }
    }
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
    await userRef.set((snap.val() || 0) + amount);
    await writeLog(CURRENT_USER.username, 'ADD_BALANCE', `Cộng ${formatMoney(amount)}đ cho ${uname}`);
    flash(msg, `Đã cộng ${formatMoney(amount)}đ cho ${uname}`, '#00e5ff');
    document.getElementById('balanceAmount').value = '';
  });
}

function bindDenomButtons() {
  document.querySelectorAll('.denom:not(.ban-preset):not(.card-preset)').forEach(btn => {
    btn.addEventListener('click', () => { document.getElementById('balanceAmount').value = btn.dataset.amount; });
  });
}

function bindKeyTabs() {
  const map = { '1d': { input: 'keyInput1d', addBtn: 'addKey1d', list: 'keyList1d' }, '3d': { input: 'keyInput3d', addBtn: 'addKey3d', list: 'keyList3d' }, '7d': { input: 'keyInput7d', addBtn: 'addKey7d', list: 'keyList7d' }, '30d': { input: 'keyInput30d', addBtn: 'addKey30d', list: 'keyList30d' } };
  for (const pack in map) {
    const cfg = map[pack];
    const addBtn = document.getElementById(cfg.addBtn);
    if (!addBtn || addBtn.dataset.bound === '1') continue;
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
    if (entries.length === 0) return ul.innerHTML = '<li style="color:#666">Chưa có key nào</li>';
    entries.forEach(([id, key]) => {
      const li = document.createElement('li');
      li.innerHTML = `<code>${key}</code>`;
      const del = document.createElement('button');
      del.textContent = 'Xóa'; del.className = 'btn-secondary';
      del.onclick = async () => {
        await db.ref(`keys/${pack}/${id}`).remove();
        await writeLog(CURRENT_USER.username, 'DELETE_KEY', `Xóa key khỏi gói ${pack}: ${key}`);
      };
      li.appendChild(del);
      ul.appendChild(li);
    });
  });
}

function loadLogs() {
  const ul = document.getElementById('logList');
  if (!ul) return;
  if (listeners['logs']) listeners['logs'].off();
  listeners['logs'] = db.ref('logs');
  listeners['logs'].orderByChild('time').limitToLast(100).on('value', snap => {
    const obj = snap.val() || {};
    ul.innerHTML = '';
    const arr = Object.entries(obj).reverse();
    if (arr.length === 0) return ul.innerHTML = '<li style="color:#666">Chưa có log</li>';
    arr.forEach(([id, log]) => {
      const li = document.createElement('li');
      const t = new Date(log.time).toLocaleString('vi-VN');
      let colorStyle = '';
      if (log.action === 'BUY_BYPASS') colorStyle = 'color: #ff3b5c; font-weight: bold; border: 1px solid rgba(255, 59, 92, 0.3); background: rgba(255, 59, 92, 0.1); border-radius: 8px; padding: 0 6px;';
      if (log.action === 'BAN_ACCOUNT') colorStyle = 'color: #ff3b5c; font-weight: bold;';
      if (log.action === 'CREATE_CARD') colorStyle = 'color: #00e5ff;';
      if (log.action === 'REDEEM_CARD') colorStyle = 'color: #00ff88;';
      li.innerHTML = `<span style="${colorStyle}">[${t}] <b>${log.actor}</b> → ${log.action}</span> <span>${log.detail || ''}</span>`;
      ul.appendChild(li);
    });
  });
}

// BAN LOGIC (Giữ nguyên)
function loadUserTable() {
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;
  if (listeners['usersList']) listeners['usersList'].off();
  listeners['usersList'] = db.ref('users');

  listeners['usersList'].on('value', snap => {
    const users = snap.val() || {};
    tbody.innerHTML = '';
    
    for (const uname in users) {
      const u = users[uname];
      if (u.role === 'OWNER') continue;
      
      const isBanned = u.banUntil && u.banUntil > Date.now();
      const statusHtml = isBanned 
        ? `<span class="status-badge status-banned">Bị khóa</span>` 
        : `<span class="status-badge status-active">Bình thường</span>`;
      
      const actionBtn = isBanned
        ? `<button class="btn-secondary btn-sm btn-unban" data-uname="${uname}">Bỏ cấm</button>`
        : `<button class="btn-secondary btn-sm btn-ban" data-uname="${uname}" style="color: #ff3b5c; border-color: #ff3b5c;">Cấm</button>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${uname}</strong> <br><small style="color:#888">${u.role}</small></td>
        <td style="color: #00e5ff; font-weight: bold;">${formatMoney(u.balance || 0)}đ <br><small style="color:#ffd700">${u.coins || 0} xu</small></td>
        <td>${statusHtml}</td>
        <td>${actionBtn}</td>
      `;
      tbody.appendChild(tr);
    }
    bindTableButtons();
  });
}

function bindTableButtons() {
  document.querySelectorAll('.btn-ban').forEach(btn => {
    btn.onclick = () => openBanModal(btn.dataset.uname);
  });
  document.querySelectorAll('.btn-unban').forEach(btn => {
    btn.onclick = async () => {
      const uname = btn.dataset.uname;
      await db.ref(`users/${uname}`).update({ banUntil: null, banReason: null });
      await writeLog(CURRENT_USER.username, 'UNBAN', `Mở khóa tài khoản ${uname}`);
      loadUserTable();
    };
  });
}

function bindBanLogic() {
  const modal = document.getElementById('banModal');
  const btnCancel = document.getElementById('cancelBanBtn');
  const btnConfirm = document.getElementById('confirmBanBtn');
  const selectReason = document.getElementById('banReasonSelect');
  const inputReason = document.getElementById('banReasonInput');
  const timeInputs = ['banYears', 'banDays', 'banHours', 'banMinutes', 'banSeconds'];

  btnCancel.onclick = () => modal.classList.add('hidden');

  document.querySelectorAll('.ban-preset').forEach(btn => {
    btn.onclick = () => {
      timeInputs.forEach(id => document.getElementById(id).value = '');
      const time = btn.dataset.time;
      if (time === '1d') document.getElementById('banDays').value = 1;
      if (time === '3d') document.getElementById('banDays').value = 3;
      if (time === '7d') document.getElementById('banDays').value = 7;
      if (time === '15d') document.getElementById('banDays').value = 15;
      if (time === '30d') document.getElementById('banDays').value = 30;
      if (time === '3y') document.getElementById('banYears').value = 3;
      if (time === '10y') document.getElementById('banYears').value = 10;
      if (time === '100y') document.getElementById('banYears').value = 100;
    };
  });

  selectReason.onchange = () => {
    if (selectReason.value !== 'custom') {
      inputReason.value = selectReason.value;
      if (selectReason.selectedIndex === 1) {
        timeInputs.forEach(id => document.getElementById(id).value = '');
      } else {
        timeInputs.forEach(id => document.getElementById(id).value = '');
        document.getElementById('banYears').value = 3;
      }
    } else {
      inputReason.value = '';
    }
  };

  btnConfirm.onclick = async () => {
    const uname = document.getElementById('banUsername').value;
    const reason = inputReason.value.trim();
    if (!reason) return alert('Vui lòng nhập lý do cấm!');

    const userRef = db.ref(`users/${uname}`);
    const snap = await userRef.once('value');
    const u = snap.val();

    let banDurationMs = 0;
    
    if (selectReason.selectedIndex === 1) {
      let strike = u.banCount || 0;
      strike++;
      if (strike === 1) banDurationMs = 1 * 24 * 60 * 60 * 1000;
      else if (strike === 2) banDurationMs = 3 * 24 * 60 * 60 * 1000;
      else if (strike === 3) banDurationMs = 7 * 24 * 60 * 60 * 1000;
      else {
        banDurationMs = 3 * 365 * 24 * 60 * 60 * 1000;
        strike = 0;
      }
      await userRef.update({ banCount: strike });
    } else {
      const y = parseInt(document.getElementById('banYears').value) || 0;
      const d = parseInt(document.getElementById('banDays').value) || 0;
      const h = parseInt(document.getElementById('banHours').value) || 0;
      const m = parseInt(document.getElementById('banMinutes').value) || 0;
      const s = parseInt(document.getElementById('banSeconds').value) || 0;
      
      const now = new Date();
      now.setFullYear(now.getFullYear() + y);
      now.setDate(now.getDate() + d);
      now.setHours(now.getHours() + h);
      now.setMinutes(now.getMinutes() + m);
      now.setSeconds(now.getSeconds() + s);
      banDurationMs = now.getTime() - Date.now();
    }

    if (banDurationMs <= 0) return alert('Thời gian cấm không hợp lệ!');

    const banUntil = Date.now() + banDurationMs;
    await userRef.update({ banUntil, banReason: reason });
    await writeLog(CURRENT_USER.username, 'BAN_ACCOUNT', `Cấm ${uname} đến ${new Date(banUntil).toLocaleString('vi-VN')} - Lý do: ${reason}`);
    modal.classList.add('hidden');
    loadUserTable();
  };
}

function openBanModal(uname) {
  document.getElementById('banUsername').value = uname;
  document.getElementById('banReasonSelect').value = 'custom';
  document.getElementById('banReasonInput').value = '';
  ['banYears', 'banDays', 'banHours', 'banMinutes', 'banSeconds'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('banModal').classList.remove('hidden');
}
