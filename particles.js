/* ============================================================================
   [particles.js] HẠT HIỆU ỨNG (nổ khi enemy chết)
   ----------------------------------------------------------------------------
   Phụ thuộc: state.js (state).
   Cập nhật/di chuyển hạt nằm trong update.js; vẽ nằm trong render.js.
   ============================================================================ */

function spawnExplosion(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 120;
    state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, color });
  }
}
