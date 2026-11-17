/* ================= XO GAME ================= */
.xo-lobby, .xo-waiting, .xo-play {
  background: rgba(20, 24, 36, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  padding: 20px;
}

/* Sửa lỗi tràn màn hình trên PC */
#xoModal .modal-content {
  max-height: 95vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
}

#xoModal .modal-content::-webkit-scrollbar {
  width: 6px;
}
#xoModal .modal-content::-webkit-scrollbar-thumb {
  background: rgba(0, 229, 255, 0.3);
  border-radius: 10px;
}

/* Ẩn tiêu đề to khi đang chơi để gọn màn hình */
#xoModal.is-playing .modal-title {
  display: none;
}

/* ===== NHÃN NGƯỜI CHƠI ===== */
.xo-players {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-shrink: 0;
}

.xo-player {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  transition: all 0.3s;
}

.xo-player.is-me {
  border-color: rgba(0, 229, 255, 0.4);
  background: rgba(0, 229, 255, 0.05);
}

.xo-player.is-turn {
  border-color: #00e5ff;
  background: rgba(0, 229, 255, 0.12);
  box-shadow: 0 0 15px rgba(0, 229, 255, 0.3);
  animation: xoPulse 1.5s infinite;
}

@keyframes xoPulse {
  0%, 100% { box-shadow: 0 0 15px rgba(0, 229, 255, 0.3); }
  50% { box-shadow: 0 0 25px rgba(0, 229, 255, 0.6); }
}

.xo-symbol {
  font-size: 22px;
  font-weight: 900;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
}

.xo-symbol.x {
  color: #00e5ff;
  background: rgba(0, 229, 255, 0.15);
  text-shadow: 0 0 10px rgba(0, 229, 255, 0.6);
}

.xo-symbol.o {
  color: #ff3b5c;
  background: rgba(255, 59, 92, 0.15);
  text-shadow: 0 0 10px rgba(255, 59, 92, 0.6);
}

.xo-name {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.xo-you-badge {
  font-size: 10px;
  font-weight: 900;
  padding: 3px 8px;
  border-radius: 6px;
  background: linear-gradient(135deg, #00e5ff, #8a2be2);
  color: #fff;
  letter-spacing: 1px;
  flex-shrink: 0;
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.5);
}

/* ===== BÀN CỜ ===== */
.xo-turn-text {
  text-align: center;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 15px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  flex-shrink: 0;
}

.xo-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
  max-width: 360px;
  margin: 0 auto 20px;
  background: rgba(0, 229, 255, 0.1);
  padding: 8px;
  border-radius: 12px;
  flex-shrink: 0;
}

.xo-cell {
  aspect-ratio: 1 / 1;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 900;
  cursor: default;
  transition: all 0.2s;
  user-select: none;
}

.xo-cell.clickable {
  cursor: pointer;
}

.xo-cell.clickable:hover {
  border-color: #00e5ff;
  background: rgba(0, 229, 255, 0.1);
  transform: scale(1.03);
}

.xo-cell.x-mark {
  color: #00e5ff;
  text-shadow: 0 0 20px rgba(0, 229, 255, 0.8);
}

.xo-cell.o-mark {
  color: #ff3b5c;
  text-shadow: 0 0 20px rgba(255, 59, 92, 0.8);
}

.xo-cell.win-mark {
  background: rgba(255, 215, 0, 0.2);
  border-color: #ffd700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
}

/* ===== LOBBY ===== */
.xo-actions {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  justify-content: center;
}

.xo-join-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 15px;
}

.xo-join-group input {
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-align: center;
  width: 200px;
  outline: none;
}

.xo-join-group input:focus {
  border-color: #00e5ff;
}

.xo-room-code {
  font-size: 30px;
  font-weight: 900;
  color: #ffd700;
  letter-spacing: 4px;
  text-align: center;
  padding: 20px;
  background: rgba(255, 215, 0, 0.1);
  border: 2px dashed #ffd700;
  border-radius: 12px;
  margin: 20px 0;
}

.xo-controls {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
  flex-shrink: 0;
  margin-top: 10px;
}

@media (max-width: 500px) {
  .xo-cell { font-size: 36px; }
  .xo-room-code { font-size: 22px; letter-spacing: 2px; }
  .xo-name { font-size: 12px; }
}
