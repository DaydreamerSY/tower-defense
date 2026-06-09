/* ============================================================================
   [aim.js] NGẮM
   ----------------------------------------------------------------------------
   Phụ thuộc: state.js (Game, state, lastAim), input.js (mouse).
   updateAim() được gọi đầu mỗi frame trong update.js; fire() đọc lastAim.

   - Auto-play: ngắm thẳng enemy GẦN NHẤT (bản cũ, đơn giản & đáng tin).
   - Tắt auto-play: ngắm theo chuột (360° mượt).
   ============================================================================ */

function findClosestEnemy() {
  let best = null, bd = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - state.player.x) ** 2 + (e.y - state.player.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// Tính hướng ngắm cho frame hiện tại (gọi ở đầu update)
function updateAim() {
  if (Game.autoPlay) {
    const t = findClosestEnemy();
    if (t) lastAim = Math.atan2(t.y - state.player.y, t.x - state.player.x);
    // không có địch -> giữ hướng cũ
    return;
  }
  // Thủ công: ngắm theo chuột
  lastAim = Math.atan2(mouse.y - state.player.y, mouse.x - state.player.x);
}
