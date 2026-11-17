// xo.js - Game XO 2 người realtime (có nhãn YOU)
let XO_ROOM_ID = null;
let XO_ROOM_REF = null;
let XO_LISTENER = null;
let XO_MY_SYMBOL = null; // 'X' hoặc 'O'
let XO_OPPONENT_NAME = null;

// ================= TẠO PHÒNG =================
async function createXORoom() {
  if (!CURRENT_USER) return;
  const msg = document.getElementById('xoMsg');

  const roomId = 'XO_' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const roomRef = db.ref(`rooms/${roomId}`);

  await roomRef.set({
    player1: CURRENT_USER.username,
    player2: null,
    board: Array(9).fill(''),
    turn: 'X',
    status: 'waiting',
    winner: null,
    createdAt: Date.now(),
    lastMoveAt: Date.now()
  });

  XO_ROOM_ID = roomId;
  XO_MY_SYMBOL = 'X';
  XO_OPPONENT_NAME = null;

  msg.style.color = '#00ff88';
  msg.textContent = `Đã tạo phòng: ${roomId}. Chờ đối thủ...`;

  document.getElementById('xoRoomCode').textContent = roomId;
  document.getElementById('xoWaitingBox').classList.remove('hidden');
  document.getElementById('xoPlayBox').classList.add('hidden');

  listenXORoom(roomId);
}

// ================= THAM GIA PHÒNG =================
async function joinXORoom() {
  if (!CURRENT_USER) return;
  const msg = document.getElementById('xoMsg');
  const input = document.getElementById('xoJoinInput').value.trim().toUpperCase();

  if (!input) {
    msg.style.color = '#ff3b5c';
    msg.textContent = 'Vui lòng nhập mã phòng!';
    return;
  }

  const roomRef = db.ref(`rooms/${input}`);
  const snap = await roomRef.once('value');

  if (!snap.exists()) {
    msg.style.color = '#ff3b5c';
    msg.textContent = 'Phòng không tồn tại!';
    return;
  }

  const room = snap.val();

  if (room.player2) {
    msg.style.color = '#ff3b5c';
    msg.textContent = 'Phòng đã đầy!';
    return;
  }

  if (room.player1 === CURRENT_USER.username) {
    msg.style.color = '#ff3b5c';
    msg.textContent = 'Bạn không thể tham gia phòng của chính mình!';
    return;
  }

  await roomRef.update({
    player2: CURRENT_USER.username,
    status: 'playing',
    lastMoveAt: Date.now()
  });

  XO_ROOM_ID = input;
  XO_MY_SYMBOL = 'O';
  XO_OPPONENT_NAME = room.player1;

  msg.style.color = '#00ff88';
  msg.textContent = `Đã tham gia phòng: ${input}`;

  document.getElementById('xoWaitingBox').classList.add('hidden');
  document.getElementById('xoPlayBox').classList.remove('hidden');
  document.getElementById('xoRoomCode').textContent = input;

  listenXORoom(input);
}

// ================= LẮNG NGHE PHÒNG =================
function listenXORoom(roomId) {
  if (XO_LISTENER) XO_LISTENER.off();

  XO_ROOM_REF = db.ref(`rooms/${roomId}`);
  XO_LISTENER = XO_ROOM_REF.on('value', snap => {
    const room = snap.val();
    if (!room) return;

    // Xác định tên đối thủ
    XO_OPPONENT_NAME = (room.player1 === CURRENT_USER.username) ? room.player2 : room.player1;

    // Cập nhật bảng
    updateXOUIBoard(room);

    // Cập nhật nhãn người chơi
    updateXOPlayersLabel(room);

    // Cập nhật trạng thái
    if (room.status === 'playing') {
      document.getElementById('xoWaitingBox').classList.add('hidden');
      document.getElementById('xoPlayBox').classList.remove('hidden');
    }

    const turnEl = document.getElementById('xoTurnText');
    if (room.status === 'finished') {
      if (room.winner === 'draw') {
        turnEl.textContent = '🤝 Hòa!';
        turnEl.style.color = '#ffd700';
      } else {
        turnEl.textContent = room.winner === XO_MY_SYMBOL ? '🏆 Bạn thắng!' : '💀 Bạn thua!';
        turnEl.style.color = room.winner === XO_MY_SYMBOL ? '#00ff88' : '#ff3b5c';
      }
    } else if (room.status === 'waiting') {
      turnEl.textContent = '⏳ Chờ đối thủ...';
      turnEl.style.color = '#a0aec0';
    } else if (room.turn === XO_MY_SYMBOL) {
      turnEl.textContent = `🎯 Lượt của bạn (${XO_MY_SYMBOL})`;
      turnEl.style.color = '#00e5ff';
    } else {
      turnEl.textContent = `⏳ Chờ đối thủ (${room.turn})...`;
      turnEl.style.color = '#a0aec0';
    }
  });
}

// ================= NHÃN NGƯỜI CHƠI (YOU) =================
function updateXOPlayersLabel(room) {
  const p1El = document.getElementById('xoPlayer1');
  const p2El = document.getElementById('xoPlayer2');

  if (!p1El || !p2El) return;

  const isP1 = room.player1 === CURRENT_USER.username;
  const isP2 = room.player2 === CURRENT_USER.username;

  // Player 1 (X)
  p1El.innerHTML = `
    <span class="xo-symbol x">X</span>
    <span class="xo-name">${room.player1 || '—'}</span>
    ${isP1 ? '<span class="xo-you-badge">YOU</span>' : ''}
  `;
  p1El.classList.toggle('is-me', isP1);
  p1El.classList.toggle('is-turn', room.status === 'playing' && room.turn === 'X');

  // Player 2 (O)
  p2El.innerHTML = `
    <span class="xo-symbol o">O</span>
    <span class="xo-name">${room.player2 || '—'}</span>
    ${isP2 ? '<span class="xo-you-badge">YOU</span>' : ''}
  `;
  p2El.classList.toggle('is-me', isP2);
  p2El.classList.toggle('is-turn', room.status === 'playing' && room.turn === 'O');
}

// ================= VẼ BÀN CỜ =================
function updateXOUIBoard(room) {
  const cells = document.querySelectorAll('.xo-cell');
  cells.forEach((cell, i) => {
    cell.textContent = room.board[i] || '';
    cell.classList.remove('x-mark', 'o-mark', 'win-mark');
    if (room.board[i] === 'X') cell.classList.add('x-mark');
    if (room.board[i] === 'O') cell.classList.add('o-mark');

    // Chỉ cho click khi đúng lượt
    const canClick = room.status === 'playing'
      && room.turn === XO_MY_SYMBOL
      && !room.board[i];
    cell.classList.toggle('clickable', canClick);
  });

  if (room.status === 'finished' && room.winner !== 'draw') {
    const winLine = getWinLine(room.board, room.winner);
    winLine.forEach(i => {
      document.querySelector(`.xo-cell[data-index="${i}"]`)?.classList.add('win-mark');
    });
  }
}

// ================= ĐÁNH CỜ =================
async function makeXOMove(index) {
  if (!XO_ROOM_ID || !XO_ROOM_REF) return;

  const snap = await XO_ROOM_REF.once('value');
  const room = snap.val();

  if (!room || room.status !== 'playing') return;
  if (room.turn !== XO_MY_SYMBOL) return;
  if (room.board[index]) return;

  const newBoard = [...room.board];
  newBoard[index] = XO_MY_SYMBOL;

  const winner = checkXOWinner(newBoard);

  const updates = {
    board: newBoard,
    turn: XO_MY_SYMBOL === 'X' ? 'O' : 'X',
    lastMoveAt: Date.now()
  };

  if (winner) {
    updates.status = 'finished';
    updates.winner = winner;
  }

  await XO_ROOM_REF.update(updates);

  if (winner) {
    await writeLog(CURRENT_USER.username, 'XO_GAME',
      `Kết thúc: ${winner === 'draw' ? 'Hòa' : winner === XO_MY_SYMBOL ? 'Thắng' : 'Thua'}`);
  }
}

// ================= KIỂM TRA THẮNG =================
function checkXOWinner(board) {
  const lines = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(cell => cell)) return 'draw';
  return null;
}

function getWinLine(board, symbol) {
  const lines = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  for (const line of lines) {
    if (line.every(i => board[i] === symbol)) return line;
  }
  return [];
}

// ================= RỜI PHÒNG =================
async function leaveXORoom() {
  if (!XO_ROOM_ID || !XO_ROOM_REF) return;

  const snap = await XO_ROOM_REF.once('value');
  const room = snap.val();
  if (!room) {
    resetXOState();
    return;
  }

  if (room.status === 'playing') {
    await XO_ROOM_REF.update({
      status: 'finished',
      winner: XO_MY_SYMBOL === 'X' ? 'O' : 'X'
    });
  }

  if (room.player1 === CURRENT_USER.username && !room.player2) {
    await XO_ROOM_REF.remove();
  }

  resetXOState();
}

function resetXOState() {
  if (XO_LISTENER) XO_LISTENER.off();
  XO_ROOM_ID = null;
  XO_ROOM_REF = null;
  XO_MY_SYMBOL = null;
  XO_OPPONENT_NAME = null;

  document.getElementById('xoWaitingBox').classList.add('hidden');
  document.getElementById('xoPlayBox').classList.add('hidden');
  document.getElementById('xoLobbyBox').classList.remove('hidden');
  const msg = document.getElementById('xoMsg');
  if (msg) msg.textContent = '';
  const joinInput = document.getElementById('xoJoinInput');
  if (joinInput) joinInput.value = '';
}

// ================= RESET VÁN MỚI =================
async function resetXOGame() {
  if (!XO_ROOM_REF) return;
  await XO_ROOM_REF.update({
    board: Array(9).fill(''),
    turn: 'X',
    status: 'playing',
    winner: null,
    lastMoveAt: Date.now()
  });
}

// ================= MỞ/ĐÓNG MODAL =================
function openXOModal() {
  document.getElementById('xoModal').classList.remove('hidden');
  document.getElementById('xoLobbyBox').classList.remove('hidden');
  document.getElementById('xoWaitingBox').classList.add('hidden');
  document.getElementById('xoPlayBox').classList.add('hidden');
  const msg = document.getElementById('xoMsg');
  if (msg) msg.textContent = '';
}

function closeXOModal() {
  if (XO_ROOM_ID) leaveXORoom();
  document.getElementById('xoModal').classList.add('hidden');
}

// ================= BIND UI =================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('xoCard')?.addEventListener('click', openXOModal);
  document.getElementById('xoCreateBtn')?.addEventListener('click', createXORoom);
  document.getElementById('xoJoinBtn')?.addEventListener('click', joinXORoom);
  document.getElementById('xoLeaveBtn')?.addEventListener('click', leaveXORoom);
  document.getElementById('xoLeaveBtn2')?.addEventListener('click', leaveXORoom);
  document.getElementById('xoResetBtn')?.addEventListener('click', resetXOGame);
  document.getElementById('xoCloseBtn')?.addEventListener('click', closeXOModal);

  document.getElementById('xoCopyCodeBtn')?.addEventListener('click', () => {
    const code = document.getElementById('xoRoomCode').textContent;
    navigator.clipboard.writeText(code);
    const btn = document.getElementById('xoCopyCodeBtn');
    btn.textContent = 'Đã chép!';
    setTimeout(() => { btn.textContent = 'Sao chép mã'; }, 2000);
  });

  // Gắn sự kiện click cho các ô cờ
  document.querySelectorAll('.xo-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      makeXOMove(parseInt(cell.dataset.index));
    });
  });
});
