// game.js

document.addEventListener('DOMContentLoaded', () => {
  const gameTab = document.querySelector('[data-home="game"]');
  if (gameTab) {
    gameTab.addEventListener('click', () => {
      document.getElementById('home-game').classList.remove('hidden');
    });
  }

  // Bắt sự kiện click vào thẻ Rắn Săn Táo
  document.getElementById('snakeCard')?.addEventListener('click', () => {
    alert('Trò chơi Rắn Săn Táo đã bị xóa do lỗi kỹ thuật đồng bộ! Vui lòng quay lại sau.');
  });
});
