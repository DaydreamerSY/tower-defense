/* ============================================================================
   [loop.js] VÒNG LẶP requestAnimationFrame + Game.start/stop
   ----------------------------------------------------------------------------
   Phụ thuộc: state.js (Game, state, initState), update.js (update),
   render.js (render), canvas.js (resize).
   Nạp CUỐI trong nhóm engine. Cung cấp toàn cục: lastTime.
   ============================================================================ */

let lastTime = performance.now();

function loop(now) {
  let dt = (now - lastTime) / 1000; lastTime = now;
  dt = Math.min(dt, 0.05);
  if (Game.active && state) {
    // Chống sập: 1 frame lỗi sẽ log ra Console nhưng KHÔNG giết vòng lặp (hết trắng màn).
    try {
      if (state.running && !state.paused) update(dt);
      render();
    } catch (err) {
      console.error('[loop] lỗi 1 frame (đã bỏ qua, game vẫn chạy):', err);
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// nav.js gọi khi mở màn Play
Game.start = function () { hideOverlays(); initState(); resize(); Game.active = true; lastTime = performance.now(); };
Game.stop  = function () { Game.active = false; };
