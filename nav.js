/* ============================================================================
   [nav.js] ĐIỀU HƯỚNG TAB Play / Edit + nút auto-play / chơi lại
   ----------------------------------------------------------------------------
   Phụ thuộc: state.js (Game), loop.js (Game.start/stop), lifecycle.js (restart),
   editor-sections.js (renderEditor). Nạp CUỐI CÙNG.
   ============================================================================ */

function showScreen(name) {
  document.getElementById('playScreen').style.display = (name === 'play') ? 'flex' : 'none';
  document.getElementById('labScreen').style.display  = (name === 'lab')  ? 'block' : 'none';
  document.getElementById('editScreen').style.display = (name === 'edit') ? 'block' : 'none';
  document.getElementById('tabPlay').classList.toggle('active', name === 'play');
  document.getElementById('tabLab').classList.toggle('active', name === 'lab');
  document.getElementById('tabEdit').classList.toggle('active', name === 'edit');
  if (name === 'play') { showWeaponSelect(); } // chọn vũ khí trước -> chooseWeapon() mới Game.start()
  else if (name === 'lab')  { Game.stop(); hideOverlays(); renderSkillLab(); }
  else                      { Game.stop(); hideOverlays(); renderEditor(); }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('tabPlay').onclick = () => showScreen('play');
  document.getElementById('tabLab').onclick = () => showScreen('lab');
  document.getElementById('tabEdit').onclick = () => showScreen('edit');

  // Nút bật/tắt auto-play
  const autoBtn = document.getElementById('autoToggle');
  function syncAuto() {
    autoBtn.textContent = Game.autoPlay ? 'Auto-play: BẬT' : 'Auto-play: TẮT (ngắm bằng chuột)';
    autoBtn.classList.toggle('on', Game.autoPlay);
  }
  autoBtn.onclick = () => { Game.autoPlay = !Game.autoPlay; syncAuto(); };
  syncAuto();

  // Nút chơi lại nhanh trong thanh điều khiển
  document.getElementById('replayBtn').onclick = () => restart();

  // Mặc định mở màn Play (auto-play đã bật sẵn)
  showScreen('play');
});
