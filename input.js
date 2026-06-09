/* ============================================================================
   [input.js] CHUỘT / CẢM ỨNG (dùng khi tắt auto-play)
   ----------------------------------------------------------------------------
   Phụ thuộc: canvas.js (canvas, VW, VH). Cung cấp toàn cục: mouse, updateMouse().
   ============================================================================ */

const mouse = { x: VW / 2, y: VH * 0.3 };

function updateMouse(cx, cy) {
  const r = canvas.getBoundingClientRect();
  mouse.x = (cx - r.left) / r.width * VW;
  mouse.y = (cy - r.top) / r.height * VH;
}

canvas.addEventListener('mousemove', e => updateMouse(e.clientX, e.clientY));
canvas.addEventListener('touchmove', e => {
  if (e.touches[0]) updateMouse(e.touches[0].clientX, e.touches[0].clientY);
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchstart', e => {
  if (e.touches[0]) updateMouse(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

// TAP / click màn hình -> kích Ultimate (nếu đã nạp đầy)
canvas.addEventListener('pointerdown', () => {
  if (typeof tryTriggerUlt === 'function') tryTriggerUlt();
});
