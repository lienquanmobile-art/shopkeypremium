// game.js — Game Rắn (1 người + 2 người online) — bản viết lại
'use strict';

/* ============================== CẤU HÌNH ============================== */
const TILE_SIZE = 20;
const COLS = 30;
const ROWS = 20;
const TICK_RATE = 200;        // ms mỗi bước
const GAME_TIME = 30;         // giây (chế độ 2P)
const COUNTDOWN_SEC = 3;      // đếm ngược trước khi chạy
const SEARCH_TIMEOUT = 15000; // thời gian chờ ghép trận
const QUEUE_TTL = 20000;      // hàng đợi quá hạn thì coi là "ma"
const MATCH_GRACE = 8000;     // chờ dữ liệu trận xuất hiện tối đa

const VECTORS = {
  UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 }, RIGHT: { x: 1, y: 0 }
};
const OPPOSITE = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };

/* ============================== TRẠNG THÁI ============================== */
let gameUnlocked = false;
let mode = null;      // null | 'local' | 'online'
let local = null;     // state game 1P
let online = null;    // state game 2P
let search = null;    // state đang tìm trận
let serverOffset = 0; // lệch giờ client <-> server Firebase
let offsetReady = false;

/* ============================== TIỆN ÍCH ============================== */
const $ = (id) => document.getElementById(id);
const nowServer = () => Date.now() + serverOffset;
const eq = (a, b) => a.x === b.x && a.y === b.y;
const outside = (c) => c.x < 0 || c.x >= COLS || c.y < 0 || c.y >= ROWS;
const toArr = (v) => (Array.isArray(v) ? v.filter(Boolean) : Object.values(v || {}));
const stepCell = (c, dir) => ({ x: c.x + VECTORS[dir].x, y: c.y + VECTORS[dir].y });

function randomFreeCell(occupied) {
  const taken = new Set(occupied.map((c) => c.x + ',' + c.y));
  const free = [];
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (!taken.has(x + ',' + y)) free.push({ x, y });
  return free.length ? free[Math.floor(Math.random() * free.length)] : { x: 0, y: 0 };
}

async function syncServerOffset() {
  if (offsetReady) return;
  try {
    const s = await db.ref('.info/serverTimeOffset').once('value');
    serverOffset = s.val() || 0;
    offsetReady = true;
  } catch (e) { /* dùng giờ máy */ }
}

function setStatus(text) {
  const el = $('matchStatus');
  if (el) el.textContent = text;
}

/* ============================== COINS / BALANCE (atomic) ============================== */
function addCoins(n) {
  return db.ref(`users/${CURRENT_USER.username}/coins`).transaction((c) => (c || 0) + n);
}

/* ============================== GIAO DIỆN ============================== */
function showBoard(withP2) {
  $('gameSetupArea').classList.add('hidden');
  $('gameMenu').classList.add('hidden');
  const board = $('gameBoard');
  board.classList.remove('hidden');
  board.style.display = 'block';
  $('scoreP2').parentElement.style.display = withP2 ? 'block' : 'none';
  $('gameArea').style.display = 'block';
  document.querySelector('.game-hud').style.display = 'flex';
  const canvas = $('gameCanvas');
  canvas.width = COLS * TILE_SIZE;
  canvas.height = ROWS * TILE_SIZE;
}

function showMenu() {
  const board = $('gameBoard');
  board.classList.add('hidden');
  board.style.display = 'none';
  $('gameSetupArea').classList.add('hidden');
  $('gameMenu').classList.remove('hidden');
  $('scoreP1').textContent = '0';
  $('scoreP2').textContent = '0';
  $('scoreP2').parentElement.style.display = 'block';
}

function showGameSetup() {
  $('gameMenu').classList.add('hidden');
  $('gameSetupArea').classList.remove('hidden');
  $('gameBoard').classList.add('hidden');
  $('gameBoard').style.display = 'none';
  $('scoreP2').parentElement.style.display = 'block';
  setStatus('');
}

function showResultModal(title, cls, line, coins) {
  $('resultModal')?.remove();
  document.body.insertAdjacentHTML('beforeend', `
    <div class="game-result-modal" id="resultModal">
      <div class="game-result-box">
        <h2 class="${cls}">${title}</h2>
        <p style="font-size: 18px; margin-bottom: 10px;">${line}</p>
        <p style="font-size: 20px; font-weight: bold; color: #ffd700; margin-bottom: 20px;">+${coins} xu</p>
        <button class="btn-primary" id="resultOkBtn">OK</button>
      </div>
    </div>`);
  $('resultOkBtn').addEventListener('click', () => {
    $('resultModal')?.remove();
    loadGameData();
  });
}

/* ============================== VẼ ============================== */
function drawSnake(ctx, snake, color) {
  ctx.fillStyle = color;
  snake.forEach((seg) => ctx.fillRect(seg.x * TILE_SIZE, seg.y * TILE_SIZE, TILE_SIZE - 2, TILE_SIZE - 2));
  if (snake.length) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(snake[0].x * TILE_SIZE + 1, snake[0].y * TILE_SIZE + 1, TILE_SIZE - 4, TILE_SIZE - 4);
  }
}

function drawBoard({ apple, mine, enemy }) {
  const canvas = $('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0d0f17';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width; i += TILE_SIZE) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
  for (let i = 0; i < canvas.height; i += TILE_SIZE) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }

  if (apple) {
    ctx.fillStyle = '#ff3b5c';
    ctx.beginPath();
    ctx.arc(apple.x * TILE_SIZE + TILE_SIZE / 2, apple.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (enemy) drawSnake(ctx, enemy, '#00ff88'); // đối thủ: xanh
  if (mine) drawSnake(ctx, mine, '#ffd700');   // mình: vàng (luôn luôn)
}

/* ============================== INPUT ============================== */
function processInput(dir) {
  if (!VECTORS[dir]) return;
  if (mode === 'local' && local) {
    // chặn quay đầu 180° dựa trên hướng ĐÃ đi ở bước trước
    if (dir !== OPPOSITE[local.lastMoved]) local.nextDir = dir;
  } else if (mode === 'online' && online && online.latest) {
    const st = online.latest.status;
    if (st !== 'playing' && st !== 'countdown') return;
    if (dir === online.lastSentDir) return;
    online.lastSentDir = dir;
    online.ref.child(`${online.me}_dir`).set(dir); // chỉ ghi hướng của chính mình
  }
}

/* ============================== GAME 1 NGƯỜI ============================== */
function startLocalGame() {
  if (mode) return;
  mode = 'local';
  showBoard(false);
  $('gameTimer').textContent = '∞';
  $('scoreP1').textContent = '0';

  local = {
    snake: [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }],
    apple: { x: 15, y: 10 },
    score: 0,
    nextDir: 'RIGHT',
    lastMoved: 'RIGHT',
    timer: null
  };
  drawBoard({ apple: local.apple, mine: local.snake });
  local.timer = setTimeout(localStep, TICK_RATE);
}

function localStep() {
  const s = local;
  if (!s || mode !== 'local') return;

  const dir = s.nextDir;
  s.lastMoved = dir;
  const head = stepCell(s.snake[0], dir);
  const ate = eq(head, s.apple);
  const body = ate ? s.snake : s.snake.slice(0, -1); // đuôi sẽ rời đi nếu không ăn

  if (outside(head) || body.some((c) => eq(c, head))) {
    return endLocalGame(s.score);
  }

  s.snake = [head, ...body];
  if (ate) {
    s.score++;
    $('scoreP1').textContent = s.score;
    s.apple = randomFreeCell(s.snake);
  }
  drawBoard({ apple: s.apple, mine: s.snake });
  s.timer = setTimeout(localStep, TICK_RATE);
}

function stopLocal() {
  if (local) clearTimeout(local.timer);
  local = null;
  if (mode === 'local') mode = null;
}

async function endLocalGame(score) {
  stopLocal();
  showMenu();
  const coins = score * 10;
  if (coins > 0) await addCoins(coins);
  showResultModal('KẾT THÚC!', 'game-win', `Số táo ăn được: ${score}`, coins);
}

/* ============================== GHÉP TRẬN 2P ============================== */
async function findMatch() {
  if (!CURRENT_USER || mode || search) return;
  if (!gameUnlocked) return alert('Bạn chưa mở khóa game!');

  const me = CURRENT_USER.username;
  const queueRef = db.ref('matchmaking/queue');
  const myRef = queueRef.child(me);
  const newMatchId = 'match_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  const mine = { ref: myRef, listener: null, timeout: null, busy: true };
  search = mine;
  setStatus('Đang tìm trận... (15s)');

  try {
    await syncServerOffset();
    await myRef.remove(); // dọn entry cũ của chính mình

    let opponent = null;
    // Transaction trên CẢ hàng đợi => nguyên tử: không thể 2 người cùng chộp 1 đối thủ,
    // và 2 người cùng tìm một lúc cũng chắc chắn ghép được với nhau.
    const res = await queueRef.transaction((q) => {
      opponent = null;
      q = q || {};
      const now = nowServer();
      Object.keys(q).forEach((k) => {
        if (!q[k] || now - (q[k].ts || 0) > QUEUE_TTL) delete q[k]; // xóa entry ma
      });
      const cands = Object.keys(q)
        .filter((k) => k !== me && !q[k].matchId)
        .sort((a, b) => q[a].ts - q[b].ts);
      if (cands.length) {
        opponent = cands[0];
        q[opponent].matchId = newMatchId; // báo cho người đang chờ
        delete q[me];
      } else {
        q[me] = { ts: now };
      }
      return q;
    });

    if (!res.committed) throw new Error('queue transaction aborted');

    if (opponent) {
      // Mình là người "bắt cặp" => P2. Người chờ là P1 (host).
      search = null;
      await db.ref(`matches/${newMatchId}`).set({
        status: 'waiting',
        p1_name: opponent, p2_name: me,
        p1_ready: false, p2_ready: false,
        p1_snake: [{ x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }],
        p2_snake: [{ x: 24, y: 10 }, { x: 25, y: 10 }, { x: 26, y: 10 }],
        p1_dir: 'RIGHT', p2_dir: 'LEFT',
        p1_score: 0, p2_score: 0,
        apple: { x: 15, y: 10 },
        timeLeft: GAME_TIME,
        countdown: COUNTDOWN_SEC
      });
      setStatus('');
      joinMatch(newMatchId, 'p2');
    } else {
      // Mình là người chờ => P1 (host). Lắng nghe matchId do đối thủ ghi vào entry của mình.
      mine.busy = false;
      myRef.onDisconnect().remove();
      mine.listener = myRef.child('matchId').on('value', (snap) => {
        const id = snap.val();
        if (id) onClaimed(id);
      });
      mine.timeout = setTimeout(() => cancelSearch('Không có trận đấu nào!'), SEARCH_TIMEOUT);
    }
  } catch (err) {
    console.error('findMatch error:', err);
    if (search === mine) search = null;
    setStatus('Lỗi ghép trận, thử lại!');
  }
}

function onClaimed(matchIdValue) {
  const s = search;
  if (!s) return;
  search = null;
  clearTimeout(s.timeout);
  s.ref.child('matchId').off('value', s.listener);
  s.ref.onDisconnect().cancel();
  s.ref.remove();
  setStatus('');
  joinMatch(matchIdValue, 'p1');
}

async function cancelSearch(message) {
  const s = search;
  if (!s || s.busy) return;
  search = null;
  clearTimeout(s.timeout);
  if (s.listener) s.ref.child('matchId').off('value', s.listener);
  try {
    // Chỉ xóa nếu chưa ai bắt cặp (tránh race với lúc đối thủ vừa vào)
    const res = await s.ref.transaction((cur) => (cur && !cur.matchId ? null : cur));
    s.ref.onDisconnect().cancel();
    const val = res.snapshot.val();
    if (val && val.matchId) {
      s.ref.remove();
      setStatus('');
      return joinMatch(val.matchId, 'p1');
    }
  } catch (e) { console.error(e); }
  setStatus(message || '');
}

/* ============================== VÀO TRẬN 2P ============================== */
function joinMatch(id, me) {
  if (mode) return;
  mode = 'online';
  showBoard(true);
  $('gameTimer').textContent = '...';
  $('scoreP1').textContent = '0';
  $('scoreP2').textContent = '0';

  const ref = db.ref(`matches/${id}`);
  const o = online = {
    id, ref, me,
    enemy: me === 'p1' ? 'p2' : 'p1',
    isHost: me === 'p1',
    latest: null,
    listener: null,
    loop: null,
    countdownTimer: null,
    graceTimer: null,
    hostStarted: false,
    seen: false,
    handled: false,
    lastSentDir: null,
    hs: null
  };

  // Nếu mãi không thấy dữ liệu trận => hủy, không để treo
  o.graceTimer = setTimeout(() => {
    if (online === o && !o.seen) abortOnline('Không vào được trận, vui lòng thử lại.');
  }, MATCH_GRACE);

  o.listener = ref.on('value', (snap) => {
    if (online !== o) return;
    const data = snap.val();

    if (!data) {
      if (o.seen && !o.handled) abortOnline('Trận đấu đã bị hủy.');
      return; // chưa thấy lần nào => đối thủ đang tạo trận, đợi tiếp
    }

    if (!o.seen) {
      o.seen = true;
      clearTimeout(o.graceTimer);
      ref.child(`${me}_ready`).set(true);
      // mất kết nối => đối thủ thắng
      ref.onDisconnect().update({ status: 'ended', winner: o.enemy, reason: 'disconnect' });
    }

    o.latest = data;
    renderOnline(o, data);

    if (data.status === 'ended') return handleOnlineEnd(o, data);

    if (o.isHost && data.status === 'waiting' && data.p1_ready && data.p2_ready && !o.hostStarted) {
      o.hostStarted = true;
      hostCountdown(o);
    }
  });
}

function renderOnline(o, data) {
  $('scoreP1').textContent = data[`${o.me}_score`] || 0;
  $('scoreP2').textContent = data[`${o.enemy}_score`] || 0;
  if (data.status === 'waiting') $('gameTimer').textContent = '...';
  else if (data.status === 'countdown') $('gameTimer').textContent = data.countdown;
  else $('gameTimer').textContent = data.timeLeft;

  drawBoard({
    apple: data.apple,
    mine: toArr(data[`${o.me}_snake`]),
    enemy: toArr(data[`${o.enemy}_snake`])
  });
}

/* ---------- HOST (P1) chạy toàn bộ logic, state giữ trong RAM ---------- */
function hostCountdown(o) {
  let n = COUNTDOWN_SEC;
  o.ref.update({ status: 'countdown', countdown: n });
  o.countdownTimer = setInterval(() => {
    if (online !== o || (o.latest && o.latest.status === 'ended')) {
      clearInterval(o.countdownTimer);
      return;
    }
    n--;
    if (n > 0) {
      o.ref.update({ countdown: n });
    } else {
      clearInterval(o.countdownTimer);
      hostStartLoop(o);
    }
  }, 1000);
}

function hostStartLoop(o) {
  const L = o.latest;
  o.hs = {
    p1: toArr(L.p1_snake), p2: toArr(L.p2_snake),
    s1: 0, s2: 0,
    apple: L.apple,
    last1: 'RIGHT', last2: 'LEFT',
    endAt: Date.now() + GAME_TIME * 1000
  };
  o.ref.update({ status: 'playing', timeLeft: GAME_TIME });
  o.loop = setInterval(() => hostTick(o), TICK_RATE);
}

function hostTick(o) {
  if (online !== o) { clearInterval(o.loop); return; }
  const L = o.latest;
  if (!L || L.status === 'ended') { clearInterval(o.loop); o.loop = null; return; }

  const hs = o.hs;

  // Lấy hướng từ DB, bỏ qua hướng không hợp lệ hoặc quay đầu 180°
  let d1 = L.p1_dir, d2 = L.p2_dir;
  if (!VECTORS[d1] || d1 === OPPOSITE[hs.last1]) d1 = hs.last1;
  if (!VECTORS[d2] || d2 === OPPOSITE[hs.last2]) d2 = hs.last2;
  hs.last1 = d1; hs.last2 = d2;

  const h1 = stepCell(hs.p1[0], d1);
  const h2 = stepCell(hs.p2[0], d2);
  const ate1 = eq(h1, hs.apple);
  const ate2 = eq(h2, hs.apple);
  const body1 = ate1 ? hs.p1 : hs.p1.slice(0, -1);
  const body2 = ate2 ? hs.p2 : hs.p2.slice(0, -1);

  const dead1 = outside(h1) || body1.some((c) => eq(c, h1)) || body2.some((c) => eq(c, h1)) || eq(h1, h2);
  const dead2 = outside(h2) || body2.some((c) => eq(c, h2)) || body1.some((c) => eq(c, h2)) || eq(h1, h2);

  if (!dead1) { if (ate1) hs.s1++; hs.p1 = [h1, ...body1]; }
  if (!dead2) { if (ate2) hs.s2++; hs.p2 = [h2, ...body2]; }

  if ((ate1 && !dead1) || (ate2 && !dead2)) {
    hs.apple = randomFreeCell([...hs.p1, ...hs.p2]);
  }

  const timeLeft = Math.max(0, Math.ceil((hs.endAt - Date.now()) / 1000));
  const update = {
    p1_snake: hs.p1, p2_snake: hs.p2,
    p1_score: hs.s1, p2_score: hs.s2,
    apple: hs.apple, timeLeft
  };

  if (dead1 || dead2 || timeLeft <= 0) {
    let winner;
    if (dead1 && !dead2) winner = 'p2';
    else if (dead2 && !dead1) winner = 'p1';
    else winner = hs.s1 > hs.s2 ? 'p1' : hs.s2 > hs.s1 ? 'p2' : 'draw';
    update.status = 'ended';
    update.winner = winner;
    update.reason = (dead1 || dead2) ? 'crash' : 'time';
    clearInterval(o.loop);
    o.loop = null;
    // Host dọn trận sau vài giây (đủ để đối thủ kịp nhận kết quả)
    const mid = o.id;
    setTimeout(() => db.ref(`matches/${mid}`).remove(), 8000);
  }

  o.ref.update(update);
}

/* ---------- Kết thúc / thoát trận ---------- */
function teardownOnline() {
  const o = online;
  if (!o) return;
  online = null;
  mode = null;
  clearInterval(o.loop);
  clearInterval(o.countdownTimer);
  clearTimeout(o.graceTimer);
  if (o.listener) o.ref.off('value', o.listener);
  o.ref.onDisconnect().cancel();
}

function abortOnline(message) {
  teardownOnline();
  showMenu();
  alert(message);
}

async function handleOnlineEnd(o, data) {
  if (o.handled) return;
  o.handled = true;

  const me = o.me, en = o.enemy;
  const myScore = data[`${me}_score`] || 0;
  const enemyScore = data[`${en}_score`] || 0;
  const forfeit = data.reason === 'leave' || data.reason === 'disconnect';
  const result = data.winner === 'draw' ? 'draw' : data.winner === me ? 'win' : 'lose';

  teardownOnline();
  showMenu();

  let coins = 0;
  if (result === 'win') {
    coins = forfeit ? 100 : (myScore >= 10 ? 10000 : 200) + 100;
  } else if (result === 'draw') {
    coins = 100;
  }
  if (coins > 0) await addCoins(coins);

  const title = result === 'win' ? 'CHIẾN THẮNG!' : result === 'draw' ? 'HÒA!' : 'THUA CUỘC!';
  const cls = result === 'lose' ? 'game-lose' : 'game-win';
  const line = forfeit && result === 'win'
    ? 'Đối thủ đã thoát trận'
    : `Tỉ số: Bạn ${myScore} - Địch ${enemyScore}`;
  showResultModal(title, cls, line, coins);

  if (typeof writeLog === 'function') {
    writeLog(CURRENT_USER.username, 'PLAY_GAME', `Chơi game rắn. Kết quả: ${result}. Nhận: ${coins} xu`);
  }
}

async function leaveGame() {
  if (mode === 'local') {
    stopLocal();
  } else if (mode === 'online' && online) {
    const o = online;
    o.handled = true; // không hiện bảng kết quả cho người thoát
    const mid = o.id;
    try {
      if (!o.latest || o.latest.status !== 'ended') {
        await o.ref.update({ status: 'ended', winner: o.enemy, reason: 'leave' });
      }
    } catch (e) { console.error(e); }
    teardownOnline();
    setTimeout(() => db.ref(`matches/${mid}`).remove(), 10000);
  }
  showMenu();
  loadGameData();
}

/* ============================== DỮ LIỆU USER ============================== */
function loadGameData() {
  if (!CURRENT_USER) return;
  db.ref(`users/${CURRENT_USER.username}`).once('value').then((snap) => {
    const u = snap.val() || {};
    $('userCoins').textContent = u.coins || 0;
    const card = $('snakeCard');
    if (!card) return;
    const txt = card.querySelector('.unlock-text');
    if (u.gameUnlocked) {
      gameUnlocked = true;
      card.classList.remove('locked');
      txt.textContent = 'Đã mua - Click để chơi';
      txt.style.color = '#00ff88';
    } else {
      gameUnlocked = false;
      card.classList.add('locked');
      txt.textContent = 'Mở khóa: 1.000đ';
      txt.style.color = '#00e5ff';
    }
  });
}

async function unlockGame() {
  const username = CURRENT_USER.username;
  const isStaff = CURRENT_USER.role === 'ADMIN' || CURRENT_USER.role === 'OWNER';
  const cost = isStaff ? 0 : 1000;

  const balRef = db.ref(`users/${username}/balance`);
  const snap = await balRef.once('value'); // đồng thời "mồi" cache cho transaction
  const balance = snap.val() || 0;
  if (balance < cost) return alert('Số dư không đủ 1.000đ để mở khóa game!');
  if (!confirm(`Bạn có muốn mở khóa Game Rắn với giá ${cost}đ?`)) return;

  if (cost > 0) {
    const res = await balRef.transaction((b) => ((b || 0) >= cost ? (b || 0) - cost : undefined));
    if (!res.committed) return alert('Số dư không đủ!');
  }
  await db.ref(`users/${username}`).update({ gameUnlocked: true });
  if (typeof writeLog === 'function') writeLog(username, 'BUY_GAME', 'Mở khóa Game Rắn');
  loadGameData();
  showGameSetup();
}

/* ============================== KHỞI TẠO ============================== */
document.addEventListener('DOMContentLoaded', () => {
  const gameTab = document.querySelector('[data-home="game"]');
  if (gameTab) {
    gameTab.addEventListener('click', () => {
      $('home-game').classList.remove('hidden');
      loadGameData();
    });
  }

  const KEYMAP = {
    ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
    w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT'
  };
  window.addEventListener('keydown', (e) => {
    if (!mode) return; // chỉ chặn cuộn trang khi đang chơi
    const dir = KEYMAP[e.key];
    if (!dir) return;
    if (e.key.startsWith('Arrow')) e.preventDefault();
    processInput(dir);
  });

  document.querySelectorAll('.dpad-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      processInput(btn.dataset.dir);
    });
  });

  $('snakeCard')?.addEventListener('click', () => {
    if (!CURRENT_USER) return;
    if (gameUnlocked) showGameSetup();
    else unlockGame();
  });

  $('backToMenuBtn')?.addEventListener('click', () => {
    cancelSearch('');
    $('gameSetupArea').classList.add('hidden');
    $('gameMenu').classList.remove('hidden');
  });

  $('cancelMatchBtn')?.addEventListener('click', () => cancelSearch('Đã hủy tìm trận.'));

  $('leaveGameBtn')?.addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn thoát trận?')) leaveGame();
  });

  $('match1PBtn')?.addEventListener('click', startLocalGame);
  $('match2PBtn')?.addEventListener('click', findMatch);
});
