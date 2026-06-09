/* ============================================================================
   [lifecycle.js] THUA / RESTART
   ----------------------------------------------------------------------------
   Phụ thuộc: state.js (state, initState), loop.js (lastTime — gán lúc runtime).
   Thao tác overlay #gameoverOverlay / #levelupOverlay và nút #restartBtn.
   ============================================================================ */

function hideOverlays() {
  document.getElementById('weaponOverlay').classList.remove('show');
  document.getElementById('levelupOverlay').classList.remove('show');
  document.getElementById('gameoverOverlay').classList.remove('show');
}

// Bị chạm: chưa thua ngay -> hiện "!" + đóng băng cảnh, đếm ngược (update.js xử lý)
function triggerDeath() {
  if (state.dying) return;
  state.dying = true;
  state.deathTimer = 3;
}

// Hết 3s mới hiện pop-up thua (gọi từ update.js)
function showGameOver() {
  state.running = false;
  const m = Math.floor(state.elapsed / 60), s = Math.floor(state.elapsed % 60);
  document.getElementById('gameoverStats').textContent =
    `Sống sót ${m}:${s.toString().padStart(2,'0')} • Đạt cấp ${state.level} • Hạ ${state.kills}`;
  document.getElementById('gameoverOverlay').classList.add('show');
}

function restart() {
  hideOverlays();
  showWeaponSelect(); // chọn lại vũ khí cho ván mới -> chooseWeapon() sẽ Game.start()
}

document.getElementById('restartBtn').onclick = restart;
