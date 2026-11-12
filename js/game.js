// game.js
let gameInterval = null;
let isGameRunning = false;
let isLocalGame = false;
let matchId = null;
let isPlayer1 = false;
let gameUnlocked = false;
let matchListener = null;

const TILE_SIZE = 20;
const COLS = 30;
const ROWS = 20;
const TICK_RATE = 200; 
const GAME_TIME = 30;

document.addEventListener('DOMContentLoaded', () => {
  const gameTab = document.querySelector('[data-home="game"]');
  if (gameTab) {
    gameTab.addEventListener('click', () => {
      document.getElementById('home-game').classList.remove('hidden');
      loadGameData();
    });
  }

  // Bắt sự kiện bàn phím
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault(); 
    }
    if (!isGameRunning) return;
    
    let newDir = null;
    if (e.key === 'ArrowUp') newDir = 'UP';
    if (e.key === 'ArrowDown') newDir = 'DOWN';
    if (e.key === 'ArrowLeft') newDir = 'LEFT';
    if (e.key === 'ArrowRight') newDir = 'RIGHT';
    
    if (newDir) processInput(newDir);
  });

  // Bắt sự kiện phím ảo (Mobile) - Đã fix kẹt focus
  document.querySelectorAll('.dpad-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault(); 
      e.stopPropagation();
      if (!isGameRunning) return;
      processInput(btn.dataset.dir);
    });
  });

  function processInput(dir) {
    if (isLocalGame) {
      window.localDir = dir;
    } else if (matchId) {
      const myKey = isPlayer1 ? 'p1_dir' : 'p2_dir';
      const startKey = isPlayer1 ? 'p1_started' : 'p2_started';
      const updates = {};
      updates[myKey] = dir;
      updates[startKey] = true; 
      db.ref(`matches/${matchId}`).update(updates);
    }
  }

  document.getElementById('snakeCard')?.addEventListener('click', async () => {
    if (!CURRENT_USER) return;
    if (gameUnlocked) {
      showGameSetup();
    } else {
      const cost = CURRENT_USER.role === 'ADMIN' || CURRENT_USER.role === 'OWNER' ? 0 : 1000;
      const snap = await db.ref(`users/${CURRENT_USER.username}`).once('value');
      const balance = snap.val().balance || 0;
      if (balance < cost) return alert('Số dư không đủ 1.000đ để mở khóa game!');

      if(confirm(`Bạn có muốn mở khóa Game Rắn với giá ${cost}đ?`)) {
        await db.ref(`users/${CURRENT_USER.username}`).update({ balance: balance - cost, gameUnlocked: true });
        writeLog(CURRENT_USER.username, 'BUY_GAME', 'Mở khóa Game Rắn');
        loadGameData();
        showGameSetup();
      }
    }
  });

  document.getElementById('backToMenuBtn')?.addEventListener('click', () => {
    document.getElementById('gameSetupArea').classList.add('hidden');
    document.getElementById('gameMenu').classList.remove('hidden');
  });

  document.getElementById('leaveGameBtn')?.addEventListener('click', async () => {
    if (confirm('Bạn có chắc muốn thoát trận?')) {
      isGameRunning = false;
      isLocalGame = false;
      clearInterval(gameInterval);
      gameInterval = null;
      if (matchId) {
        await db.ref(`matches/${matchId}`).remove();
        if (matchListener) db.ref('matches').off('child_added', matchListener);
        matchId = null;
      }
      document.getElementById('gameBoard').classList.add('hidden');
      document.getElementById('gameBoard').style.display = 'none';
      document.getElementById('gameMenu').classList.remove('hidden');
      loadGameData();
    }
  });

  document.getElementById('match1PBtn')?.addEventListener('click', () => {
    isLocalGame = true;
    isGameRunning = true;
    matchId = null;
    
    document.getElementById('gameSetupArea').classList.add('hidden');
    document.getElementById('gameBoard').classList.remove('hidden');
    document.getElementById('gameBoard').style.display = 'block';
    document.getElementById('scoreP2').parentElement.style.display = 'none'; 
    document.getElementById('gameArea').style.display = 'block';
    document.querySelector('.game-hud').style.display = 'flex';
    document.getElementById('gameTimer').textContent = '∞'; 
    document.getElementById('scoreP1').textContent = '0';

    let localSnake = [{x: 5, y: 10}, {x: 4, y: 10}, {x: 3, y: 10}];
    let localApple = { x: 15, y: 10 };
    let localScore = 0;
    window.localDir = 'RIGHT';

    const localMove = () => {
      if (!isGameRunning || !isLocalGame) return;

      let head = { ...localSnake[0] };
      if (window.localDir === 'UP') head.y--;
      if (window.localDir === 'DOWN') head.y++;
      if (window.localDir === 'LEFT') head.x--;
      if (window.localDir === 'RIGHT') head.x++;

      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || localSnake.some(s => s.x === head.x && s.y === head.y)) {
        isGameRunning = false;
        return endLocalGame(localScore);
      }

      localSnake.unshift(head);
      if (head.x === localApple.x && head.y === localApple.y) {
        localScore++;
        document.getElementById('scoreP1').textContent = localScore;
        let valid = false;
        while(!valid) {
          localApple = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
          if (!localSnake.some(s => s.x === localApple.x && s.y === localApple.y)) valid = true;
        }
      } else {
        localSnake.pop();
      }

      drawLocalCanvas(localSnake, localApple);
      setTimeout(localMove, TICK_RATE);
    };
    setTimeout(localMove, TICK_RATE);
  });

  document.getElementById('match2PBtn')?.addEventListener('click', async () => {
    const statusTxt = document.getElementById('matchStatus');
    statusTxt.textContent = 'Đang tìm trận... (15s)';
    
    const queueRef = db.ref('matchmaking/queue');
    const myRef = queueRef.child(CURRENT_USER.username);

    if (matchListener) {
      db.ref('matches').off('child_added', matchListener);
      matchListener = null;
    }
    
    // Dọn dẹp hàng đợi cũ
    const allQueues = (await queueRef.once('value')).val() || {};
    const now = Date.now();
    const updatesToDelete = {};
    for (const key in allQueues) {
      if (key === CURRENT_USER.username || (now - allQueues[key].timestamp) > 15000) {
        updatesToDelete[key] = null;
      }
    }
    if (Object.keys(updatesToDelete).length > 0) {
      await queueRef.update(updatesToDelete);
    }

    const cleanQueues = (await queueRef.once('value')).val() || {};
    const waitingPlayer = Object.keys(cleanQueues).find(k => k !== CURRENT_USER.username);

    if (waitingPlayer) {
      // TÌM THẤY NGƯỜI CHỜ -> NGƯỜI TẠO LÀ PLAYER 2
      const newMatchId = 'match_' + Date.now();
      isPlayer1 = false; // QUAN TRỌNG: Người tạo phòng là P2
      
      await db.ref(`matches/${newMatchId}`).set({
        status: 'playing', 
        p1_name: waitingPlayer,
        p2_name: CURRENT_USER.username,
        p1_started: false,
        p2_started: false,
        p1_score: 0, p2_score: 0,
        p1_snake: [{x: 5, y: 10}], 
        p2_snake: [{x: 24, y: 10}], 
        p1_dir: 'RIGHT', p2_dir: 'LEFT',
        apple: { x: 15, y: 10 },
        timeLeft: GAME_TIME,
        lastTick: Date.now()
      });
      
      await myRef.remove();
      joinMatch(newMatchId, false); // false = Player 2
    } else {
      // KHÔNG CÓ AI -> VÀO HÀNG ĐỢI (SẼ LÀ PLAYER 1)
      await myRef.set({ timestamp: now });
      
      const timeout = setTimeout(async () => {
        if (!matchId) {
          await myRef.remove();
          statusTxt.textContent = 'Không có trận đấu nào!';
        }
      }, 15000);

      matchListener = db.ref('matches').on('child_added', (snap) => {
        const m = snap.val();
        // Nếu tên mình là p1 trong trận được tạo -> Mình là Player 1
        if (m.p1_name === CURRENT_USER.username || m.p2_name === CURRENT_USER.username) {
          clearTimeout(timeout);
          db.ref('matches').off('child_added', matchListener);
          joinMatch(snap.key, m.p1_name === CURRENT_USER.username);
        }
      });
    }
  });
});

function loadGameData() {
  if (!CURRENT_USER) return;
  db.ref(`users/${CURRENT_USER.username}`).once('value').then(snap => {
    const u = snap.val();
    document.getElementById('userCoins').textContent = u.coins || 0;
    const snakeCard = document.getElementById('snakeCard');
    if (u.gameUnlocked) {
      gameUnlocked = true;
      snakeCard.classList.remove('locked');
      snakeCard.querySelector('.unlock-text').textContent = "Đã mua - Click để chơi";
      snakeCard.querySelector('.unlock-text').style.color = "#00ff88";
    } else {
      gameUnlocked = false;
      snakeCard.classList.add('locked');
      snakeCard.querySelector('.unlock-text').textContent = "Mở khóa: 1.000đ";
      snakeCard.querySelector('.unlock-text').style.color = "#00e5ff";
    }
  });
}

function showGameSetup() {
  document.getElementById('gameMenu').classList.add('hidden');
  document.getElementById('gameSetupArea').classList.remove('hidden');
  document.getElementById('gameBoard').classList.add('hidden');
  document.getElementById('gameBoard').style.display = 'none';
  document.getElementById('scoreP2').parentElement.style.display = 'block'; 
}

function joinMatch(id, asPlayer1) {
  matchId = id;
  isPlayer1 = asPlayer1;
  isLocalGame = false;
  isGameRunning = true;
  gameInterval = null;
  
  document.getElementById('gameSetupArea').classList.add('hidden');
  document.getElementById('gameBoard').classList.remove('hidden');
  document.getElementById('gameBoard').style.display = 'block';
  document.getElementById('gameArea').style.display = 'block';
  document.querySelector('.game-hud').style.display = 'flex';

  const matchRef = db.ref(`matches/${matchId}`);
  matchRef.on('value', snap => {
    const data = snap.val();
    if (!data || data.status === 'ended') return;

    document.getElementById('scoreP1').textContent = isPlayer1 ? data.p1_score : data.p2_score;
    document.getElementById('scoreP2').textContent = isPlayer1 ? data.p2_score : data.p1_score;
    document.getElementById('gameTimer').textContent = data.timeLeft;
    
    drawCanvas(data);

    if (isPlayer1 && (data.p1_started || data.p2_started) && !gameInterval) {
      startServerLoop();
    }

    if (data.status === 'ended') {
      const iWin = (isPlayer1 && data.p1_score >= data.p2_score) || (!isPlayer1 && data.p2_score >= data.p1_score);
      endGame(iWin, data);
    }
  });
}

function startServerLoop() {
  gameInterval = setInterval(async () => {
    if (!matchId) return;
    const snap = await db.ref(`matches/${matchId}`).once('value');
    const state = snap.val();
    if (!state || state.status !== 'playing') return;

    let p1_snake = state.p1_snake;
    let p2_snake = state.p2_snake;
    let p1_score = state.p1_score;
    let p2_score = state.p2_score;
    let apple = state.apple;
    let timeLeft = state.timeLeft;

    const now = Date.now();
    const dt = now - state.lastTick;
    
    if (dt >= 1000 && (state.p1_started || state.p2_started)) {
      timeLeft -= Math.floor(dt / 1000);
    }

    let p1_head = { ...p1_snake[0] };
    let p2_head = { ...p2_snake[0] };

    if (state.p1_started) {
      if (state.p1_dir === 'UP') p1_head.y--;
      if (state.p1_dir === 'DOWN') p1_head.y++;
      if (state.p1_dir === 'LEFT') p1_head.x--;
      if (state.p1_dir === 'RIGHT') p1_head.x++;
    }
    
    if (state.p2_started) {
      if (state.p2_dir === 'UP') p2_head.y--;
      if (state.p2_dir === 'DOWN') p2_head.y++;
      if (state.p2_dir === 'LEFT') p2_head.x--;
      if (state.p2_dir === 'RIGHT') p2_head.x++;
    }

    let p1_dead = false, p2_dead = false, p1_ate = false, p2_ate = false;

    if (state.p1_started) {
      if (p1_head.x < 0 || p1_head.x >= COLS || p1_head.y < 0 || p1_head.y >= ROWS) p1_dead = true;
      if (p1_snake.some(s => s.x === p1_head.x && s.y === p1_head.y)) p1_dead = true;
      if (p1_head.x === p2_head.x && p1_head.y === p2_head.y) { p1_dead = true; p2_dead = true; }
      if (p2_snake.some(s => s.x === p1_head.x && s.y === p1_head.y)) p1_dead = true;
      if (p1_head.x === apple.x && p1_head.y === apple.y) { p1_score++; p1_ate = true; }
    }

    if (state.p2_started) {
      if (p2_head.x < 0 || p2_head.x >= COLS || p2_head.y < 0 || p2_head.y >= ROWS) p2_dead = true;
      if (p2_snake.some(s => s.x === p2_head.x && s.y === p2_head.y)) p2_dead = true;
      if (p1_head.x === p2_head.x && p1_head.y === p2_head.y) { p1_dead = true; p2_dead = true; }
      if (p1_snake.some(s => s.x === p2_head.x && s.y === p2_head.y)) p2_dead = true;
      if (p2_head.x === apple.x && p2_head.y === apple.y) { p2_score++; p2_ate = true; }
    }

    if (p1_dead || p2_dead || timeLeft <= 0) {
      await db.ref(`matches/${matchId}`).update({ status: 'ended', p1_score, p2_score });
      return;
    }

    if (state.p1_started && !p1_dead) { p1_snake.unshift(p1_head); if (!p1_ate) p1_snake.pop(); }
    if (state.p2_started && !p2_dead) { p2_snake.unshift(p2_head); if (!p2_ate) p2_snake.pop(); }

    if (p1_ate || p2_ate) {
      let newApple;
      let valid = false;
      while (!valid) {
        newApple = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
        if (!p1_snake.some(s => s.x === newApple.x && s.y === newApple.y) &&
            !p2_snake.some(s => s.x === newApple.x && s.y === newApple.y)) {
          valid = true;
        }
      }
      apple = newApple;
    }

    await db.ref(`matches/${matchId}`).update({
      p1_snake, p2_snake, p1_score, p2_score, apple, timeLeft, lastTick: now
    });
  }, TICK_RATE);
}

function drawCanvas(state) {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d0f17'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for(let i=0; i<canvas.width; i+=TILE_SIZE) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
  for(let i=0; i<canvas.height; i+=TILE_SIZE) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }
  
  if (state.apple) {
    ctx.fillStyle = '#ff3b5c'; ctx.beginPath();
    ctx.arc((state.apple.x * TILE_SIZE) + TILE_SIZE/2, (state.apple.y * TILE_SIZE) + TILE_SIZE/2, TILE_SIZE/2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }
  
  const enemySnake = isPlayer1 ? state.p2_snake : state.p1_snake;
  ctx.fillStyle = isPlayer1 ? '#00ff88' : '#ffd700';
  enemySnake.forEach(seg => { ctx.fillRect(seg.x * TILE_SIZE, seg.y * TILE_SIZE, TILE_SIZE-2, TILE_SIZE-2); });
  
  const mySnake = isPlayer1 ? state.p1_snake : state.p2_snake;
  ctx.fillStyle = isPlayer1 ? '#ffd700' : '#00ff88';
  mySnake.forEach(seg => { ctx.fillRect(seg.x * TILE_SIZE, seg.y * TILE_SIZE, TILE_SIZE-2, TILE_SIZE-2); });
}

function drawLocalCanvas(snake, apple) {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d0f17'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for(let i=0; i<canvas.width; i+=TILE_SIZE) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
  for(let i=0; i<canvas.height; i+=TILE_SIZE) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }
  if (apple) {
    ctx.fillStyle = '#ff3b5c'; ctx.beginPath();
    ctx.arc((apple.x * TILE_SIZE) + TILE_SIZE/2, (apple.y * TILE_SIZE) + TILE_SIZE/2, TILE_SIZE/2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd700';
  snake.forEach(seg => { ctx.fillRect(seg.x * TILE_SIZE, seg.y * TILE_SIZE, TILE_SIZE-2, TILE_SIZE-2); });
}

async function endLocalGame(score) {
  isLocalGame = false;
  document.getElementById('gameBoard').style.display = 'none';
  document.getElementById('gameMenu').classList.remove('hidden');
  document.getElementById('scoreP1').textContent = '0';
  let coinsEarned = score * 10;
  if (coinsEarned > 0) {
    const snap = await db.ref(`users/${CURRENT_USER.username}`).once('value');
    const currentCoins = snap.val().coins || 0;
    await db.ref(`users/${CURRENT_USER.username}`).update({ coins: currentCoins + coinsEarned });
  }
  const resultHtml = `
    <div class="game-result-modal" id="resultModal">
      <div class="game-result-box">
        <h2 class="game-win">KẾT THÚC!</h2>
        <p style="font-size: 18px; margin-bottom: 10px;">Số táo ăn được: ${score}</p>
        <p style="font-size: 20px; font-weight: bold; color: #ffd700; margin-bottom: 20px;">+${coinsEarned} xu</p>
        <button class="btn-primary" onclick="document.getElementById('resultModal').remove(); loadGameData();">OK</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', resultHtml);
}

async function endGame(isWin, data) {
  if (!isGameRunning) return;
  isGameRunning = false;
  clearInterval(gameInterval);
  gameInterval = null;

  if (matchId) {
    db.ref(`matches/${matchId}`).remove();
    matchId = null;
  }
  document.getElementById('gameBoard').classList.add('hidden');
  document.getElementById('gameBoard').style.display = 'none';
  document.getElementById('gameMenu').classList.remove('hidden');
  document.getElementById('scoreP1').textContent = '0';
  document.getElementById('scoreP2').textContent = '0';

  let coinsEarned = 0;
  const myScore = isPlayer1 ? data.p1_score : data.p2_score;
  const enemyScore = isPlayer1 ? data.p2_score : data.p1_score;

  if (isWin) {
    coinsEarned = myScore >= 10 ? 10000 : 200;
    coinsEarned += 100;
  }

  if (coinsEarned > 0) {
    const snap = await db.ref(`users/${CURRENT_USER.username}`).once('value');
    const currentCoins = snap.val().coins || 0;
    await db.ref(`users/${CURRENT_USER.username}`).update({ coins: currentCoins + coinsEarned });
  }

  const resultHtml = `
    <div class="game-result-modal" id="resultModal">
      <div class="game-result-box">
        <h2 class="${isWin ? 'game-win' : 'game-lose'}">${isWin ? 'CHIẾN THẮNG!' : 'THUA CUỘC!'}</h2>
        <p style="font-size: 18px; margin-bottom: 10px;">Tỉ số: Bạn ${myScore} - Địch ${enemyScore}</p>
        <p style="font-size: 20px; font-weight: bold; color: #ffd700; margin-bottom: 20px;">+${coinsEarned} xu</p>
        <button class="btn-primary" onclick="document.getElementById('resultModal').remove(); loadGameData();">OK</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', resultHtml);
  writeLog(CURRENT_USER.username, 'PLAY_GAME', `Chơi game rắn. Thắng: ${isWin}. Nhận: ${coinsEarned} xu`);
}
