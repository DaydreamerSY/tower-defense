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
    if (state.running && !state.paused) update(dt);
    render();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// nav.js gọi khi mở màn Play
Game.start = function () { hideOverlays(); initState(); resize(); Game.active = true; lastTime = performance.now(); };
Game.stop  = function () { Game.active = false; };
