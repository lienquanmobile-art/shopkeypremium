// game.js
let isSpinning = false;

document.addEventListener('DOMContentLoaded', () => {
  const gameTab = document.querySelector('[data-home="game"]');
  if (gameTab) {
    gameTab.addEventListener('click', () => {
      document.getElementById('home-game').classList.remove('hidden');
      loadGameData();
    });
  }

  // Xử lý 404
  document.getElementById('snakeCard')?.addEventListener('click', () => {
    document.getElementById('gameDeletedModal').classList.remove('hidden');
  });
  document.getElementById('closeGameDeletedBtn')?.addEventListener('click', () => {
    document.getElementById('gameDeletedModal').classList.add('hidden');
  });

  // Mở luật Vòng Quay
  document.getElementById('diceCard')?.addEventListener('click', () => {
    document.getElementById('diceRulesModal').classList.remove('hidden');
  });

  document.getElementById('closeRulesBtn')?.addEventListener('click', () => {
    document.getElementById('diceRulesModal').classList.add('hidden');
  });

  // Bắt đầu quay (từ bảng luật)
  document.getElementById('startDiceBtn')?.addEventListener('click', async () => {
    document.getElementById('diceRulesModal').classList.add('hidden');
    const isFree = CURRENT_USER.role === 'ADMIN' || CURRENT_USER.role === 'OWNER';
    
    if (isFree) {
      document.getElementById('dicePlayModal').classList.remove('hidden');
      return;
    }

    const snap = await db.ref(`users/${CURRENT_USER.username}/coins`).once('value');
    const coins = snap.val() || 0;
    
    if (coins < 30000) {
      document.getElementById('notEnoughCoinsModal').classList.remove('hidden');
    } else {
      document.getElementById('dicePlayModal').classList.remove('hidden');
    }
  });

  // SỰ KIỆN ĐÓNG BÀN QUAY (Đã thay alert bằng Modal)
  document.getElementById('closePlayBtn')?.addEventListener('click', () => {
    if (isSpinning) {
      document.getElementById('spinningWarningModal').classList.remove('hidden');
      return;
    }
    document.getElementById('dicePlayModal').classList.add('hidden');
  });

  // Đóng bảng cảnh báo đang quay
  document.getElementById('closeSpinningWarningBtn')?.addEventListener('click', () => {
    document.getElementById('spinningWarningModal').classList.add('hidden');
  });

  // Nút QUAY NGAY
  document.getElementById('spinBtn')?.addEventListener('click', async () => {
    if (isSpinning) return;
    const isFree = CURRENT_USER.role === 'ADMIN' || CURRENT_USER.role === 'OWNER';

    if (!isFree) {
      const snap = await db.ref(`users/${CURRENT_USER.username}/coins`).once('value');
      const coins = snap.val() || 0;
      if (coins < 30000) {
        document.getElementById('dicePlayModal').classList.add('hidden');
        document.getElementById('notEnoughCoinsModal').classList.remove('hidden');
        return;
      }
      await db.ref(`users/${CURRENT_USER.username}/coins`).set(coins - 30000);
      document.getElementById('userCoins').textContent = coins - 30000;
    }

    startSpin();
  });

  // Bảng thông báo hết xu
  document.getElementById('closeNotEnoughBtn')?.addEventListener('click', () => {
    document.getElementById('notEnoughCoinsModal').classList.add('hidden');
  });
  
  document.getElementById('buyCoinsBtn')?.addEventListener('click', () => {
    document.getElementById('notEnoughCoinsModal').classList.add('hidden');
    document.getElementById('exchangeCoinsModal').classList.remove('hidden');
    document.getElementById('exchangeUsername').value = CURRENT_USER.username;
    document.getElementById('exchangeErrorMsg').textContent = '';
    document.getElementById('exchangeAmount').value = '';
  });

  document.getElementById('closeExchangeBtn')?.addEventListener('click', () => {
    document.getElementById('exchangeCoinsModal').classList.add('hidden');
  });

  // Xử lý ĐỔI XU
  document.getElementById('confirmExchangeBtn')?.addEventListener('click', async () => {
    const errorMsg = document.getElementById('exchangeErrorMsg');
    errorMsg.textContent = ''; 

    const vnd = parseInt(document.getElementById('exchangeAmount').value);
    if (!vnd || vnd < 1000) {
      errorMsg.textContent = 'Số tiền tối thiểu là 1.000 VND!';
      return;
    }

    const isFree = CURRENT_USER.role === 'ADMIN' || CURRENT_USER.role === 'OWNER';
    
    let coinsToAdd = 0;
    if (vnd >= 500000) coinsToAdd = Math.floor(vnd / 500000) * 7500000;
    else if (vnd >= 200000) coinsToAdd = Math.floor(vnd / 200000) * 3000000;
    else if (vnd >= 100000) coinsToAdd = Math.floor(vnd / 100000) * 1400000;
    else if (vnd >= 50000) coinsToAdd = Math.floor(vnd / 50000) * 625000;
    else if (vnd >= 20000) coinsToAdd = Math.floor(vnd / 20000) * 250000;
    else if (vnd >= 10000) coinsToAdd = Math.floor(vnd / 10000) * 120000;
    else if (vnd >= 5000) coinsToAdd = Math.floor(vnd / 5000) * 60000;
    else coinsToAdd = Math.floor(vnd / 1000) * 10000;

    const userSnap = await db.ref(`users/${CURRENT_USER.username}`).once('value');
    const u = userSnap.val();
    
    if (!isFree && u.balance < vnd) {
      errorMsg.textContent = 'Số dư VND không đủ!';
      return;
    }

    const updates = {};
    if (!isFree) {
      updates['balance'] = u.balance - vnd;
    }
    updates['coins'] = (u.coins || 0) + coinsToAdd;
    
    await db.ref(`users/${CURRENT_USER.username}`).update(updates);
    writeLog(CURRENT_USER.username, 'EXCHANGE_COINS', `Đổi ${vnd} VND lấy ${coinsToAdd} xu`);
    
    errorMsg.style.color = '#00ff88';
    errorMsg.textContent = `Đổi thành công ${coinsToAdd.toLocaleString('vi-VN')} xu!`;
    
    setTimeout(() => {
      document.getElementById('exchangeCoinsModal').classList.add('hidden');
      document.getElementById('exchangeAmount').value = '';
      errorMsg.textContent = '';
      errorMsg.style.color = '#ff3b5c';
      loadGameData();
    }, 1500);
  });

  // Đóng bảng chúc mừng
  document.getElementById('closeCongratsBtn')?.addEventListener('click', () => {
    document.getElementById('congratsModal').classList.add('hidden');
    isSpinning = false;
    document.getElementById('spinBtn').disabled = false;
    document.getElementById('spinBtn').textContent = 'QUAY NGAY';
    loadGameData();
    document.querySelectorAll('.slot-item').forEach(el => el.classList.remove('win', 'active'));
  });
});

async function loadGameData() {
  if (!CURRENT_USER) return;
  const snap = await db.ref(`users/${CURRENT_USER.username}`).once('value');
  const u = snap.val();
  document.getElementById('userCoins').textContent = u.coins || 0;
}

// HÀM QUAY
function startSpin() {
  isSpinning = true;
  const spinBtn = document.getElementById('spinBtn');
  spinBtn.disabled = true;
  spinBtn.textContent = 'ĐANG QUAY...';

  document.querySelectorAll('.slot-item').forEach(el => el.classList.remove('active', 'win'));

  const rand = Math.random() * 100;
  let winIndex = 0;

  if (rand <= 83) winIndex = 0;
  else if (rand <= 83.01) winIndex = 1;
  else if (rand <= 83.0101) winIndex = 2;
  else if (rand <= 83.1101) winIndex = 3;
  else if (rand <= 84.1101) winIndex = 4;
  else if (rand <= 89.1101) winIndex = 5;
  else winIndex = 0;

  let currentIndex = 0;
  let speed = 50;
  const loopCount = 3;
  let totalSteps = (loopCount * 6) + winIndex; 
  let step = 0;

  function animateSpin() {
    document.querySelectorAll('.slot-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`slot-${currentIndex}`).classList.add('active');

    currentIndex = (currentIndex + 1) % 6;
    step++;

    if (step < totalSteps) {
      if (step > totalSteps - 10) speed += 30;
      else if (step > totalSteps - 20) speed += 10;
      setTimeout(animateSpin, speed);
    } else {
      document.querySelectorAll('.slot-item').forEach(el => el.classList.remove('active'));
      const winEl = document.getElementById(`slot-${winIndex}`);
      winEl.classList.add('win');
      giveReward(winIndex);
    }
  }
  
  animateSpin();
}

// HÀM CỘNG THƯỞNG VÀ BẮN PHÁO HOA
async function giveReward(index) {
  const userRef = db.ref(`users/${CURRENT_USER.username}`);
  const snap = await userRef.once('value');
  const u = snap.val();
  
  let rewardText = "";
  let updates = {};

  if (index === 0) {
    rewardText = "10.000 xu";
    updates['coins'] = (u.coins || 0) + 10000;
  } 
  else if (index === 1) {
    rewardText = "10.000.000 xu (JACKPOT)";
    updates['coins'] = (u.coins || 0) + 10000000;
  }
  else if (index === 2) {
    rewardText = "1.000.000 VND (Giải đặc biệt)";
    updates['balance'] = (u.balance || 0) + 1000000;
  }
  else if (index === 3) {
    rewardText = "5.000 VND";
    updates['balance'] = (u.balance || 0) + 5000;
  }
  else if (index === 4) {
    const randomVnd = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
    rewardText = `${randomVnd.toLocaleString('vi-VN')} VND`;
    updates['balance'] = (u.balance || 0) + randomVnd;
  }
  else if (index === 5) {
    const randomCoins = Math.floor(Math.random() * (10000000 - 100000 + 1)) + 100000;
    rewardText = `${randomCoins.toLocaleString('vi-VN')} xu`;
    updates['coins'] = (u.coins || 0) + randomCoins;
  }

  await userRef.update(updates);
  writeLog(CURRENT_USER.username, 'SPIN_LUCKY', `Quay trúng: ${rewardText}`);

  // Hiệu ứng pháo hoa
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#ffd700', '#00e5ff', '#ff3b5c', '#ffffff']
    });
  }

  // Hiển thị bảng chúc mừng
  setTimeout(() => {
    document.getElementById('congratsReward').textContent = rewardText;
    document.getElementById('congratsModal').classList.remove('hidden');
  }, 500);
}
