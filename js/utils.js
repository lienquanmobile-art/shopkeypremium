// utils.js

// Định dạng số tiền
function formatMoney(num) {
  return Number(num || 0).toLocaleString('vi-VN');
}

// Sinh chuỗi 8 ký tự chữ + số ngẫu nhiên
function randomSuffix(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Sinh private key theo loại: BLACK<ADMIN/USER>_<8 ký tự>
function generatePrivateKey(type) {
  return `BLACK${type}_${randomSuffix(8)}`;
}

// Ghi log
async function writeLog(actor, action, detail = '') {
  const ref = db.ref('logs').push();
  await ref.set({
    actor: actor || 'system',
    action,
    detail,
    time: Date.now()
  });
}

// Hiển thị thông báo tạm thời
function flash(el, text, color = '#ff5c78') {
  el.textContent = text;
  el.style.color = color;
  setTimeout(() => { el.textContent = ''; }, 4000);
}
