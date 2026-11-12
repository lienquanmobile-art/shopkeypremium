// game.js
let gameInterval = null;
let isGameRunning = false;
let myDirection = 'RIGHT';
let matchId = null;
let isPlayer1 = false;
let currentUserSnakeName = "Player";
let gameState = null;
let gameUnlocked = false;
let matchListener = null;
let localTimer = null;

const TILE_SIZE = 20;
const COLS = 30;
const ROWS = 20;
const TICK_RATE = 250; 
const GAME_TIME = 30;

document.addEventListener('DOMContentLoaded', () => {
  const gameTab = document.querySelector('[data-home="game"]');
  if (gameTab) {
    gameTab.addEventListener('click', () => {
      document.getElementById('home-game').classList.remove('hidden');
      loadGameData();
    });
  }

  // Bắt sự kiện phím VÀ CHẶN CUỘN TRANG
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
    
    if (newDir) {
      handleInput(newDir);
    }
  });

  // Bắt sự kiện phím ảo trên điện thoại
  document.querySelectorAll('.dpad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isGameRunning) return;
      handleInput(btn.dataset.dir);
    });
  });

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

  document.getElementById('saveNameBtn')?.addEventListener('click', () => {
    const name = document.getElementById('snakeNameInput').value.trim();
    if (!name) return alert('Vui lòng nhập tên!');
    currentUserSnakeName = name;
    document.getElementById('savedNameMsg').textContent = `Đã lưu tên: ${name}`;
  });

  // Nút Thoát Trận
  document.getElementById('leaveGameBtn')?.addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn thoát trận? Trận đấu sẽ bị hủy.')) {
      if (matchId) {
        db.ref(`matches/${matchId}`).remove();
        matchId = null;
      }
      clearInterval(gameInterval);
      clearInterval(localTimer);
      isGameRunning = false;
      document.getElementById('gameBoard').style.display = 'none';
      document.getElementById('gameMenu').classList.remove('hidden');
    }
  });

  // --- CHẾ ĐỘ 1 PLAYER ---
  document.getElementById('match1PBtn')?.addEventListener('click', () => {
    matchId = null;
    isPlayer1 = true;
    document.getElementById('gameSetupArea').classList.add('hidden');
    document.getElementById('gameBoard').classList.remove('hidden');
    document.getElementById('gameBoard').style.display = 'block';
    document.getElementById('scoreP2').parentElement.style.display = 'none'; 
    document.getElementById('gameArea').style.display = 'block';
    document.querySelector('.game-hud').style.display = 'flex';
    
    let localSnake = [{x: 5, y: 10}, {x: 4, y: 10}, {x: 3, y: 10}];
    let localApple = { x: 15, y: 10 };
    let localScore = 0;
    let localTime = GAME_TIME;
    let localDir = 'RIGHT';
    let localRunning = true;
    
    myDirection = 'RIGHT';
    document.getElementById('scoreP1').textContent = '0';
    document.getElementById('gameTimer').textContent = localTime;
    isGameRunning = true;

    const localMove = () => {
      if (!localRunning) return;

      let head = { ...localSnake[0] };
      if (localDir === 'UP') head.y--;
      if (localDir === 'DOWN') head.y++;
      if (localDir === 'LEFT') head.x--;
      if (localDir === 'RIGHT') head.x++;

      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || localSnake.some(s => s.x === head.x && s.y === head.y)) {
        localRunning = false;
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

    window.mobile1PHandler = (dir) => {
      if (dir === 'UP' && localDir !== 'DOWN') localDir = 'UP';
      if (dir === 'DOWN' && localDir !== 'UP') localDir = 'DOWN';
      if (dir === 'LEFT' && localDir !== 'RIGHT') localDir = 'LEFT';
      if (dir === 'RIGHT' && localDir !== 'LEFT') localDir = 'RIGHT';
    };
    window.localKeyHandler = (e) => {
      let newDir = null;
      if (e.key === 'ArrowUp') newDir = 'UP';
      if (e.key === 'ArrowDown') newDir = 'DOWN';
      if (e.key === 'ArrowLeft') newDir = 'LEFT';
      if (e.key === 'ArrowRight') newDir = 'RIGHT';
      if (newDir) window.mobile1PHandler(newDir);
    };
    window.addEventListener('keydown', window.localKeyHandler);

    setTimeout(localMove, TICK_RATE);
    localTimer = setInterval(() => {
      if (!localRunning) return clearInterval(localTimer);
      localTime--;
      document.getElementById('gameTimer').textContent = localTime;
      if (localTime <= 0) {
        localRunning = false;
        isGameRunning = false;
        clearInterval(localTimer);
        window.removeEventListener('keydown', window.localKeyHandler);
        endLocalGame(localScore);
      }
    }, 1000);
  });

  // --- CHẾ ĐỘ 2 PLAYER (PvP) ---
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
    await queueRef.child(CURRENT_USER.username).remove(); 
    const snap = await queueRef.once('value');
    const queue = snap.val() || {};
    const waitingPlayer = Object.keys(queue).find(k => k !== CURRENT_USER.username);

    if (waitingPlayer) {
      const newMatchId = 'match_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      isPlayer1 = true; 
      
      await db.ref(`matches/${newMatchId}`).set({
        status: 'waiting', 
        p1_name: waitingPlayer,
        p2_name: CURRENT_USER.username,
        p1_ready: false,
        p2_ready: false,
        p1_score: 0, p2_score: 0,
        p1_snake: [{x: 5, y: 10}, {x: 4, y: 10}, {x: 3, y: 10}],
        p2_snake: [{x: 24, y: 10}, {x: 25, y: 10}, {x: 26, y: 10}],
        p1_dir: 'RIGHT', p2_dir: 'LEFT',
        apple: { x: 15, y: 10 },
        timeLeft: GAME_TIME,
        lastTick: Date.now()
      });
      
      await myRef.remove();
      joinMatch(newMatchId, true);
    } else {
      await myRef.set({ timestamp: Date.now() });
      
      const timeout = setTimeout(async () => {
        if (!matchId) {
          await myRef.remove();
          statusTxt.textContent = 'Không có trận đấu nào!';
          if (matchListener) db.ref('matches').off('child_added', matchListener);
        }
      }, 15000);

      matchListener = db.ref('matches').on('child_added', (snap) => {
        const m = snap.val();
        if (m.p1_name === CURRENT_USER.username || m.p2_name === CURRENT_USER.username) {
          clearTimeout(timeout);
          db.ref('matches').off('child_added', matchListener);
          joinMatch(snap.key, m.p1_name === CURRENT_USER.username);
        }
      });
    }
  });
});

function handleInput(dir) {
  if (matchId) {
    const myKey = isPlayer1 ? 'p1_dir' : 'p2_dir';
    db.ref(`matches/${matchId}/${myKey}`).set(dir);
  } else if (window.mobile1PHandler) {
    window.mobile1PHandler(dir);
  }
}

async function loadGameData() {
  if (!CURRENT_USER) return;
  const snap = await db.ref(`users/${CURRENT_USER.username}`).once('value');
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
}

function showGameSetup() {
  document.getElementById('gameMenu').classList.add('hidden');
  document.getElementById('gameSetupArea').classList.remove('hidden');
  document.getElementById('gameBoard').style.display = 'none';
  document.getElementById('scoreP2').parentElement.style.display = 'block'; 
}

function joinMatch(id, asPlayer1) {
  matchId = id;
  isPlayer1 = asPlayer1;
  document.getElementById('matchStatus').textContent = 'Đã tìm thấy trận! Chuẩn bị...';
  
  setTimeout(() => {
    document.getElementById('gameSetupArea').classList.add('hidden');
    document.getElementById('gameBoard').classList.remove('hidden');
    document.getElementById('gameBoard').style.display = 'block';
    
    let readyBtn = document.getElementById('readyBtn');
    if (!readyBtn) {
      readyBtn = document.createElement('button');
      readyBtn.id = 'readyBtn';
      readyBtn.className = 'btn-primary';
      readyBtn.style.marginTop = '20px';
      readyBtn.textContent = 'SẴN SÀNG';
      document.getElementById('gameBoard').insertBefore(readyBtn, document.getElementById('gameArea'));
    }
    readyBtn.classList.remove('hidden');
    readyBtn.disabled = false;
    readyBtn.textContent = 'SẴN SÀNG';
    
    document.getElementById('gameArea').style.display = 'none';
    document.querySelector('.game-hud').style.display = 'none';

    readyBtn.onclick = async () => {
      readyBtn.disabled = true;
      readyBtn.textContent = 'Đang chờ đối thủ...';
      const myReadyKey = isPlayer1 ? 'p1_ready' : 'p2_ready';
      await db.ref(`matches/${matchId}/${myReadyKey}`).set(true);
    };

    listenMatchStatus();
  }, 1000);
}

function listenMatchStatus() {
  const matchRef = db.ref(`matches/${matchId}`);
  matchRef.on('value', snap => {
    const data = snap.val();
    if (!data) return;

    // Tự động chuyển sang playing nếu cả 2 ready
    if (data.p1_ready && data.p2_ready && data.status === 'waiting') {
      matchRef.update({ status: 'playing' });
    }

    if (data.status === 'playing' && !isGameRunning) {
      const readyBtn = document.getElementById('readyBtn');
      if (readyBtn) readyBtn.classList.add('hidden');
      document.getElementById('gameArea').style.display = 'block';
      document.querySelector('.game-hud').style.display = 'flex';
      startMultiplayerGame(data);
    }

    if (isGameRunning) {
      gameState = data;
      document.getElementById('scoreP1').textContent = isPlayer1 ? data.p1_score : data.p2_score;
      document.getElementById('scoreP2').textContent = isPlayer1 ? data.p2_score : data.p1_score;
      document.getElementById('gameTimer').textContent = data.timeLeft;
      drawCanvas(data);

      if (data.status === 'ended') {
        const iWin = (isPlayer1 && data.p1_score >= data.p2_score) || (!isPlayer1 && data.p2_score >= data.p1_score);
        endGame(iWin, data);
      }
    }
  });
}

function startMultiplayerGame(initialData) {
  isGameRunning = true;
  gameState = initialData;
  document.getElementById('gameArea').style.display = 'block';

  if (isPlayer1) {
    gameInterval = setInterval(async () => {
      if (!gameState || gameState.status !== 'playing') return;
      
      const snap = await db.ref(`matches/${matchId}`).once('value');
      const state = snap.val();
      if (!state) return;

      let p1_snake = state.p1_snake;
      let p2_snake = state.p2_snake;
      let p1_score = state.p1_score;
      let p2_score = state.p2_score;
      let apple = state.apple;
      let timeLeft = state.timeLeft;

      const now = Date.now();
      const dt = now - state.lastTick;
      if (dt >= 1000) timeLeft -= Math.floor(dt / 1000);

      let p1_head = { ...p1_snake[0] };
      if (state.p1_dir === 'UP') p1_head.y--;
      if (state.p1_dir === 'DOWN') p1_head.y++;
      if (state.p1_dir === 'LEFT') p1_head.x--;
      if (state.p1_dir === 'RIGHT') p1_head.x++;

      let p2_head = { ...p2_snake[0] };
      if (state.p2_dir === 'UP') p2_head.y--;
      if (state.p2_dir === 'DOWN') p2_head.y++;
      if (state.p2_dir === 'LEFT') p2_head.x--;
      if (state.p2_dir === 'RIGHT') p2_head.x++;

      let p1_dead = false, p2_dead = false;
      let p1_ate = false, p2_ate = false;

      if (p1_head.x < 0 || p1_head.x >= COLS || p1_head.y < 0 || p1_head.y >= ROWS) p1_dead = true;
      if (p2_head.x < 0 || p2_head.x >= COLS || p2_head.y < 0 || p2_head.y >= ROWS) p2_dead = true;

      if (p1_snake.some(s => s.x === p1_head.x && s.y === p1_head.y)) p1_dead = true;
      if (p2_snake.some(s => s.x === p2_head.x && s.y === p2_head.y)) p2_dead = true;

      if (p1_head.x === p2_head.x && p1_head.y === p2_head.y) { p1_dead = true; p2_dead = true; }
      if (p2_snake.some(s => s.x === p1_head.x && s.y === p1_head.y)) p1_dead = true;
      if (p1_snake.some(s => s.x === p2_head.x && s.y === p2_head.y)) p2_dead = true;

      if (!p1_dead && p1_head.x === apple.x && p1_head.y === apple.y) { p1_score++; p1_ate = true; }
      if (!p2_dead && p2_head.x === apple.x && p2_head.y === apple.y) { p2_score++; p2_ate = true; }

      if (p1_dead || p2_dead || timeLeft <= 0) {
        await db.ref(`matches/${matchId}`).update({ status: 'ended', p1_score, p2_score });
        return;
      }

      if (!p1_dead) { p1_snake.unshift(p1_head); if (!p1_ate) p1_snake.pop(); }
      if (!p2_dead) { p2_snake.unshift(p2_head); if (!p2_ate) p2_snake.pop(); }

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
}

function drawCanvas(state) {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#0d0f17';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for(let i=0; i<canvas.width; i+=TILE_SIZE) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
  for(let i=0; i<canvas.height; i+=TILE_SIZE) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }

  if (state.apple) {
    ctx.fillStyle = '#ff3b5c';
    ctx.beginPath();
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
  ctx.fillStyle = '#0d0f17';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for(let i=0; i<canvas.width; i+=TILE_SIZE) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
  for(let i=0; i<canvas.height; i+=TILE_SIZE) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }

  if (apple) {
    ctx.fillStyle = '#ff3b5c';
    ctx.beginPath();
    ctx.arc((apple.x * TILE_SIZE) + TILE_SIZE/2, (apple.y * TILE_SIZE) + TILE_SIZE/2, TILE_SIZE/2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd700';
  snake.forEach(seg => { ctx.fillRect(seg.x * TILE_SIZE, seg.y * TILE_SIZE, TILE_SIZE-2, TILE_SIZE-2); });
}

async function endLocalGame(score) {
  clearInterval(localTimer);
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
  
  if (matchId) {
    db.ref(`matches/${matchId}`).remove();
    matchId = null;
  }

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
