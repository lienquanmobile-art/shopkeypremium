// auth.js
const SESSION_KEY = 'bskp_session';

// Chuyển từ localStorage sang sessionStorage để tự động đăng xuất khi tắt tab
function saveSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}
function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

async function ensureOwnerAccount() {
  const ownerRef = db.ref('users/black');
  const snap = await ownerRef.once('value');
  if (!snap.exists()) {
    await ownerRef.set({
      username: 'black', password: '1', role: 'OWNER', privateKey: 'BLACKOWNER_30102011', balance: 0, createdAt: Date.now()
    });
    await writeLog('system', 'INIT_OWNER', 'Tạo tài khoản Owner mặc định');
  }
}

async function loginNormal(username, password) {
  const snap = await db.ref(`users/${username}`).once('value');
  if (!snap.exists()) throw new Error('Tài khoản không tồn tại');
  const user = snap.val();
  if (user.password !== password) throw new Error('Sai mật khẩu');
  return { username, ...user };
}

async function loginByKey(key) {
  if (!key || !key.startsWith('BLACK')) throw new Error('Private key không hợp lệ');
  const snap = await db.ref('users').once('value');
  const users = snap.val() || {};
  for (const username in users) {
    const u = users[username];
    if (u.privateKey && u.privateKey === key) {
      return { username, ...u };
    }
  }
  throw new Error('Private key không tồn tại hoặc không hợp lệ');
}
