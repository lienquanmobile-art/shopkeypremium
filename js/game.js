// game.js
let gameInterval = null;
let isGameRunning = false;
let myDirection = 'RIGHT';
let matchId = null;
let isPlayer1 = false;
let currentUserSnakeName = "Player";
let gameState = null;
let gameUnlocked = false;

const TILE_SIZE = 20;
const COLS = 30;
const ROWS = 20;
const TICK_RATE = 150;
const GAME_TIME = 30;

document.addEventListener('DOMContentLoaded', () => {
  const gameTab = document.querySelector('[data-home="game"]');
  if (gameTab) {
    gameTab.addEventListener('click', () => {
      document.getElementById('home-game').classList.remove('hidden');
      loadGameData();
    });
  }

  // Bắt sự kiện phím
  window.addEventListener('keydown', (e) => {
    if (!isGameRunning || !matchId) return;
    let newDir = null;
    if (e.key === 'ArrowUp') newDir = 'UP';
    if (e.key === 'ArrowDown') newDir = 'DOWN';
    if (e.key === 'ArrowLeft') newDir = 'LEFT';
    if (e.key === 'ArrowRight') newDir = 'RIGHT';
    
    if (newDir) {
      const myKey = isPlayer1 ? 'p1_dir' : 'p2_dir';
      db.ref(`matches/${matchId}/${myKey}`).set(newDir);
    }
  });

  // Sự kiện click vào thẻ Game Rắn
  document.getElementById('snakeCard')?.addEventListener('click', async () => {
    if (!CURRENT_USER) return;
    if (gameUnlocked) {
      showGameSetup();
    } else {
      // Mua game
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

  // Quay lại menu
  document.getElementById('backToMenuBtn')?.addEventListener('click', () => {
    document.getElementById('gameSetupArea').classList.add('hidden');
    document.getElementById('gameMenu').classList.remove('hidden');
  });

  // Lưu tên
  document.getElementById('saveNameBtn')?.addEventListener('click', () => {
    const name = document.getElementById('snakeNameInput').value.trim();
    if (!name) return alert('Vui lòng nhập tên!');
    currentUserSnakeName = name;
    document.getElementById('savedNameMsg').textContent = `Đã lưu tên: ${name}`;
  });

  // Nút chơi
  document.getElementById('match1PBtn')?.addEventListener('click', () => {
    alert('Chế độ 1 Player đang bảo trì! Vui lòng chơi 2 Player.');
  });

  document.getElementById('match2PBtn')?.addEventListener('click', async () => {
    const statusTxt = document.getElementById('matchStatus');
    statusTxt.textContent = 'Đang tìm trận... (15s)';
    
    const queueRef = db.ref('matchmaking/queue');
    const myRef = queueRef.child(CURRENT_USER.username);

    const snap = await queueRef.once('value');
    const queue = snap.val() || {};
    const waitingPlayer = Object.keys(queue).find(k => k !== CURRENT_USER.username);

    if (waitingPlayer) {
      const newMatchId = 'match_' + Date.now();
      isPlayer1 = true; 
      
      await db.ref(`matches/${newMatchId}`).set({
        status: 'playing',
        p1_name: waitingPlayer,
        p2_name: CURRENT_USER.username,
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
        }
      }, 15000);

      db.ref('matches').on('child_added', (snap) => {
        const m = snap.val();
        if (m.p1_name === CURRENT_USER.username || m.p2_name === CURRENT_USER.username) {
          clearTimeout(timeout);
          joinMatch(snap.key, m.p1_name === CURRENT_USER.username);
        }
      });
    }
  });
});

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
}

function joinMatch(id, asPlayer1) {
  matchId = id;
  isPlayer1 = asPlayer1;
  document.getElementById('matchStatus').textContent = 'Đã tìm thấy trận! Chuẩn bị...';
  
  setTimeout(() => {
    document.getElementById('gameSetupArea').classList.add('hidden');
    document.getElementById('gameBoard').style.display = 'block';
    startMultiplayerGame();
  }, 1500);
}

function startMultiplayerGame() {
  isGameRunning = true;
  const matchRef = db.ref(`matches/${matchId}`);
  
  matchRef.on('value', snap => {
    if (!isGameRunning) return;
    const data = snap.val();
    if (!data) return;
    gameState = data;

    document.getElementById('scoreP1').textContent = isPlayer1 ? data.p1_score : data.p2_score;
    document.getElementById('scoreP2').textContent = isPlayer1 ? data.p2_score : data.p1_score;
    document.getElementById('gameTimer').textContent = data.timeLeft;

    drawCanvas(data);

    if (data.status === 'ended') {
      const iWin = (isPlayer1 && data.p1_score >= data.p2_score) || (!isPlayer1 && data.p2_score >= data.p1_score);
      endGame(iWin, data);
    }
  });

  if (isPlayer1) {
    gameInterval = setInterval(async () => {
      if (!gameState || gameState.status === 'ended') return;
      
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
  document.getElementById('gameSetupArea').classList.add('hidden');

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
