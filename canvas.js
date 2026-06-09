/* ============================================================================
   [canvas.js] CANVAS + ĐỘ PHÂN GIẢI LOGIC + RESIZE
   ----------------------------------------------------------------------------
   Tách từ game.js. Cung cấp toàn cục: VW, VH, canvas, ctx, resize().
   Phải nạp TRƯỚC input.js / render.js / loop.js (chúng dùng các biến này).
   ============================================================================ */

// --- Logical resolution: 9:16 portrait ---
const VW = 540, VH = 960;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  const margin = 16;
  // Khung Play có thanh điều khiển phía trên ~70px -> chừa chỗ
  let h = window.innerHeight - 110;
  let w = h * (VW / VH);
  if (w > window.innerWidth - margin * 2) {
    w = window.innerWidth - margin * 2;
    h = w * (VH / VW);
  }
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = VW * dpr;
  canvas.height = VH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();
