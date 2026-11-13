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
    alert(`Game đã bị xóa\nVui lòng chơi game khác\nChân thành xin lỗi vì sự bất tiện này`);
  });
});
