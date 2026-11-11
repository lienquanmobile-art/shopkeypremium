// utils.js
function formatMoney(num) {
  return Number(num || 0).toLocaleString('vi-VN');
}

function randomSuffix(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function generatePrivateKey(type) {
  return `BLACK${type}_${randomSuffix(8)}`;
}

async function writeLog(actor, action, detail = '') {
  const ref = db.ref('logs').push();
  await ref.set({
    actor: actor || 'system',
    action,
    detail,
    time: Date.now()
  });
}

function flash(el, text, color = '#ff5c78') {
  el.textContent = text;
  el.style.color = color;
  setTimeout(() => { el.textContent = ''; }, 4000);
}
