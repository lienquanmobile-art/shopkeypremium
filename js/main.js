// main.js

let CURRENT_USER = null;
let SELECTED_PACKAGE = null;

const PACKAGES = {
  '1d':  { name: 'Gói 1 ngày',  price: 2500  },
  '3d':  { name: 'Gói 3 ngày',  price: 40000 },
  '7d':  { name: 'Gói 7 ngày',  price: 75000 },
  '30d': { name: 'Gói 30 ngày', price: 250000 }
};

// ==== KHỞI TẠO ====
document.addEventListener('DOMContentLoaded', async () => {
  await ensureOwnerAccount();
  bindLoginUI();
  bindHomeUI();
  bindLogout();

  const sess = getSession();
  if (sess) {
    // xác thực lại session
    const snap = await db.ref(`users/${sess.username}`).once('value');
    if (snap.exists()) {
      enterApp({ username: sess.username, ...snap.val() });
    } else {
      clearSession();
    }
  }
});

// ==== LOGIN UI ====
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
    try {
      const user = await loginByKey(k);
      await writeLog(user.username, 'LOGIN_KEY', 'Đăng nhập bằng private key');
      enterApp(user);
    } catch (e) {
      flash(msg, e.message);
    }
  });
}

// ==== VÀO APP ====
function enterApp(user) {
  CURRENT_USER = user;
  saveSession({ username: user.username });

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('header').classList.remove('hidden');
  document.getElementById('mainApp').classList.remove('hidden');

  document.getElementById('userNameLabel').textContent = user.username;
  document.getElementById('roleBadge').textContent = user.role;
  document.getElementById('userBox').style.display = 'flex';

  // Hiện số dư nếu là USER/ADMIN/OWNER
  updateBalanceDisplay(user.balance || 0);
  document.getElementById('balanceBox').style.display = 'inline-block';

  // Nếu là OWNER/ADMIN -> hiện tab quản lí
  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    document.getElementById('adminNavBtn').classList.remove('hidden');
    // Chỉ OWNER thấy tab Log
    if (user.role !== 'OWNER') {
      document.querySelectorAll('.owner-only').forEach(el => el.classList.add('hidden'));
    } else {
      document.querySelectorAll('.owner-only').forEach(el => el.classList.remove('hidden'));
    }
    if (window.initAdminPage) window.initAdminPage(user);
  } else {
    document.getElementById('adminNavBtn').classList.add('hidden');
  }

  // Lắng nghe realtime số dư
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

// ==== HOME UI ====
function bindHomeUI() {
  // Tab mua key / nạp tiền
  document.querySelectorAll('.home-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.home-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.home;
      document.getElementById('home-buykey').classList.toggle('hidden', target !== 'buykey');
      document.getElementById('home-deposit').classList.toggle('hidden', target !== 'deposit');
    });
  });

  // Nav chính
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const page = btn.dataset.page;
      document.getElementById('page-home').classList.toggle('hidden', page !== 'home');
      document.getElementById('page-admin').classList.toggle('hidden', page !== 'admin');
    });
  });

  // Chọn gói
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

  // Mua ngay
  document.getElementById('buyNowBtn').addEventListener('click', handleBuy);
}

// ==== MUA KEY ====
async function handleBuy() {
  const msg = document.getElementById('buyMsg');
  if (!CURRENT_USER) return flash(msg, 'Bạn cần đăng nhập');
  if (!SELECTED_PACKAGE) return flash(msg, 'Vui lòng chọn gói');

  const pkg = PACKAGES[SELECTED_PACKAGE];
  const userSnap = await db.ref(`users/${CURRENT_USER.username}`).once('value');
  const userData = userSnap.val();
  const balance = userData.balance || 0;

  if (balance < pkg.price) {
    return flash(msg, `Số dư không đủ (cần ${formatMoney(pkg.price)}đ, hiện có ${formatMoney(balance)}đ)`);
  }

  // Lấy 1 key bất kì trong gói tương ứng
  const keyRef = db.ref(`keys/${SELECTED_PACKAGE}`);
  const keySnap = await keyRef.once('value');
  const keysObj = keySnap.val() || {};
  const keyIds = Object.keys(keysObj);
  if (keyIds.length === 0) {
    return flash(msg, 'Gói này hiện đã hết key, vui lòng thử gói khác');
  }
  const chosenId = keyIds[Math.floor(Math.random() * keyIds.length)];
  const chosenKey = keysObj[chosenId];

  // Trừ tiền, xóa key, ghi log
  const updates = {};
  updates[`users/${CURRENT_USER.username}/balance`] = balance - pkg.price;
  updates[`keys/${SELECTED_PACKAGE}/${chosenId}`] = null;
  updates[`purchases/${CURRENT_USER.username}/${Date.now()}`] = {
    package: SELECTED_PACKAGE,
    packageName: pkg.name,
    price: pkg.price,
    key: chosenKey
  };
  await db.ref().update(updates);

  await writeLog(CURRENT_USER.username, 'BUY_KEY', `Mua ${pkg.name} - key: ${chosenKey}`);
  flash(msg, `Mua thành công! Key của bạn: ${chosenKey}`, '#00e5ff');
}
