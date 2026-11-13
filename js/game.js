// game.js

document.addEventListener('DOMContentLoaded', () => {
  const gameTab = document.querySelector('[data-home="game"]');
  if (gameTab) {
    gameTab.addEventListener('click', () => {
      document.getElementById('home-game').classList.remove('hidden');
    });
  }

  // Bắt sự kiện click vào thẻ Rắn Săn Táo đã chết
  document.getElementById('snakeCard')?.addEventListener('click', () => {
    document.getElementById('gameDeletedModal').classList.remove('hidden');
  });

  // Nút OK để tắt bảng thông báo
  document.getElementById('closeGameDeletedBtn')?.addEventListener('click', () => {
    document.getElementById('gameDeletedModal').classList.add('hidden');
  });
});
