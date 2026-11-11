// main.js
let CURRENT_USER = null;
let SELECTED_PACKAGE = null;

const PACKAGES = {
  '1d':  { name: 'Gói 1 ngày',  price: 2500  },
  '3d':  { name: 'Gói 3 ngày',  price: 40000 },
  '7d':  { name: 'Gói 7 ngày',  price: 75000 },
  '30d': { name: 'Gói 30 ngày', price: 250000 }
};

document.addEventListener('DOMContentLoaded', async () => {
  await ensureOwnerAccount();
  bindLoginUI();
  bindHomeUI();
  bindLogout();

  const sess = getSession();
  if (sess) {
    const snap = await db.ref(`users/${sess.username}`).once('value');
    if (snap.exists()) {
      enterApp({ username: sess.username, ...snap.val() });
    } else {
      clearSession();
    }
  }
});

function bindLoginUI() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('normalLogin').classList.toggle('hidden', tab !== 'normal');
      document.getElementById('keyLogin').classList.toggle('hidden', tab !== 'key');
    });
  });

  document.getElementById('loginBtn').addEventListener('click', async () => {
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMsg');
    if(!u || !p) return flash(msg, 'Vui lòng nhập đủ thông tin');
    
    try {
      const user = await loginNormal(u, p);
      await writeLog(u, 'LOGIN', 'Đăng nhập thường');
      enterApp(user);
    } catch (e) {
      flash(msg, e.message);
    }
  });

  document.getElementById('keyLoginBtn').addEventListener('click', async () => {
    const k = document.getElementById('loginKey').value.trim();
    const msg = document.getElementById('loginMsg');
    if(!k) return flash(msg, 'Vui lòng nhập key');
    
    try {
      const user = await loginByKey(k);
      await writeLog(user.username, 'LOGIN_KEY', 'Đăng nhập bằng private key');
      enterApp(user);
    } catch (e) {
      flash(msg, e.message);
    }
  });
}

function enterApp(user) {
  CURRENT_USER = user;
  saveSession({ username: user.username });

  // Ẩn form đăng nhập bằng cả Class và Style phòng hờ CSS lỗi
  const loginScreen = document.getElementById('loginScreen');
  if(loginScreen) {
    loginScreen.classList.add('hidden');
    loginScreen.style.display = 'none'; 
  }

  document.getElementById('header').classList.remove('hidden');
  document.getElementById('mainApp').classList.remove('hidden');

  document.getElementById('userNameLabel').textContent = user.username;
  document.getElementById('roleBadge').textContent = user.role;
  document.getElementById('userBox').style.display = 'flex';

  updateBalanceDisplay(user.balance || 0);
  document.getElementById('balanceBox').style.display = 'inline-block';

  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    document.getElementById('adminNavBtn').classList.remove('hidden');
    if (user.role !== 'OWNER') {
      document.querySelectorAll('.owner-only').forEach(el => el.classList.add('hidden'));
    } else {
      document.querySelectorAll('.owner-only').forEach(el => el.classList.remove('hidden'));
    }
    if (window.initAdminPage) window.initAdminPage(user);
  } else {
    document.getElementById('adminNavBtn').classList.add('hidden');
  }

  db.ref(`users/${user.username}/balance`).on('value', snap => {
    updateBalanceDisplay(snap.val() || 0);
  });
}

function updateBalanceDisplay(val) {
  document.getElementById('balanceValue').textContent = formatMoney(val);
  if (CURRENT_USER) CURRENT_USER.balance = val;
}

function bindLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearSession();
    location.reload();
  });
}

function bindHomeUI() {
  document.querySelectorAll('.home-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.home-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.home;
      document.getElementById('home-buykey').classList.toggle('hidden', target !== 'buykey');
      document.getElementById('home-deposit').classList.toggle('hidden', target !== 'deposit');
    });
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const page = btn.dataset.page;
      document.getElementById('page-home').classList.toggle('hidden', page !== 'home');
      document.getElementById('page-admin').classList.toggle('hidden', page !== 'admin');
    });
  });

  document.querySelectorAll('.package-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      SELECTED_PACKAGE = card.dataset.package;
      const pkg = PACKAGES[SELECTED_PACKAGE];
      document.getElementById('selectedPackageName').textContent = pkg.name;
      document.getElementById('selectedPackagePrice').textContent = formatMoney(pkg.price);
      document.getElementById('buyNowBtn').disabled = false;
    });
  });

  document.getElementById('buyNowBtn').addEventListener('click', handleBuy);
}

async function handleBuy() {
  const msg = document.getElementById('buyMsg');
  if (!CURRENT_USER) return flash(msg, 'Bạn cần đăng nhập');
  if (!SELECTED_PACKAGE) return flash(msg, 'Vui lòng chọn gói');

  const pkg = PACKAGES[SELECTED_PACKAGE];
  const userSnap = await db.ref(`users/${CURRENT_USER.username}`).once('value');
  const userData = userSnap.val();
  const balance = userData.balance || 0;
  
  const isFree = CURRENT_USER.role === 'ADMIN' || CURRENT_USER.role === 'OWNER';
  const cost = isFree ? 0 : pkg.price;

  if (balance < cost) {
    return flash(msg, `Số dư không đủ (cần ${formatMoney(cost)}đ, hiện có ${formatMoney(balance)}đ)`);
  }

  const keyRef = db.ref(`keys/${SELECTED_PACKAGE}`);
  const keySnap = await keyRef.once('value');
  const keysObj = keySnap.val() || {};
  const keyIds = Object.keys(keysObj);
  
  if (keyIds.length === 0) {
    return flash(msg, 'Gói này hiện đã hết key, vui lòng thử gói khác');
  }
  
  const chosenId = keyIds[Math.floor(Math.random() * keyIds.length)];
  const chosenKey = keysObj[chosenId];

  const updates = {};
  if (!isFree) {
    updates[`users/${CURRENT_USER.username}/balance`] = balance - cost;
  }
  
  updates[`keys/${SELECTED_PACKAGE}/${chosenId}`] = null;
  updates[`purchases/${CURRENT_USER.username}/${Date.now()}`] = {
    package: SELECTED_PACKAGE,
    packageName: pkg.name,
    price: cost,
    key: chosenKey,
    note: isFree ? 'Miễn phí (Admin/Owner)' : 'Mua thường'
  };
  
  await db.ref().update(updates);

  const logMsg = isFree 
    ? `Nhận key FREE (${pkg.name}) - key: ${chosenKey}` 
    : `Mua ${pkg.name} - key: ${chosenKey}`;
  await writeLog(CURRENT_USER.username, 'BUY_KEY', logMsg);
  
  const successMsg = isFree 
    ? `Nhận thành công (Miễn phí)! Key của bạn: ${chosenKey}`
    : `Mua thành công! Key của bạn: ${chosenKey}`;
  flash(msg, successMsg, '#00e5ff');
}
