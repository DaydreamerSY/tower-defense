/* ============================================================================
   [game.js] ENGINE (màn Play) — vòng lặp, auto-play, va chạm, set→upgrade.
   ----------------------------------------------------------------------------
   Phụ thuộc: config.js, data.js (Store, applyUpgrade, makeEnemyStats...).
   Bình thường không cần sửa khi balance — chỉ chỉnh số trong màn Edit.
   ============================================================================ */

// --- Kích thước map (toạ độ logic) — đọc từ Store, cập nhật khi vào màn Play ---
let VW = Store.balance.map.width, VH = Store.balance.map.height;
function syncMapSize() { VW = Store.balance.map.width; VH = Store.balance.map.height; }
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

// --- Chuột (dùng khi tắt auto-play) ---
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

// --- Bàn phím WASD / phím mũi tên để di chuyển nhân vật ---
const keys = new Set();
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) { keys.add(k); e.preventDefault(); }
});
window.addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); });
// Thả hết phím khi rời cửa sổ (tránh kẹt phím)
window.addEventListener('blur', () => keys.clear());


// --- Cờ điều khiển vòng đời (editor.js bật/tắt khi đổi tab) ---
const Game = {
  active: false,    // có đang ở màn Play không
  autoPlay: true,   // FEATURE: tự ngắm enemy gần nhất
  showDebug: true,  // hiện panel debug thông số
};


// --- Trạng thái game ---
let state;
let lastAim = -Math.PI / 2; // hướng ngắm gần nhất (mặc định hướng lên)

function freshPlayerStats() {
  // Lấy chỉ số gốc từ Store.balance.player + túi hiệu ứng fx
  const s = Object.assign({}, Store.balance.player, { fx: {} });
  if (s.moveSpeed == null) s.moveSpeed = 280; // fallback cho dữ liệu cũ
  return s;
}
function initState() {
  state = {
    running: true, paused: false,
    elapsed: 0, score: 0, kills: 0,
    upgradesTaken: 0,
    nextUpgradeAt: Store.balance.upgrade.baseCost,
    player: { x: VW / 2, y: VH / 2, radius: Store.balance.player.radius, stats: freshPlayerStats(), fireTimer: 0 },
    bullets: [], enemies: [], spawnTimer: 0,
    upgradeLevels: {}, particles: [],
    bolts: [], auraTimer: 0, shotCount: 0, // skill nguyên tố: tia sét, đồng hồ điện trường, đếm phát bắn
    chosenSet: Store.getActiveSet(), // set của level (đặt trong màn Edit) — mọi lần lên cấp random trong set này
  };
}


/* ---------------- NGẮM ----------------
   - Auto-play: quét nhiều góc quanh hướng tới enemy gần nhất, MÔ PHỎNG đường đạn
     (kể cả nảy) cho từng góc, rồi chọn góc trúng được NHIỀU enemy nhất — ưu tiên
     đường đạn vẫn trúng enemy gần nhất để luôn xử lý mối đe doạ trước mắt.
   - Tắt auto-play: ngắm theo chuột. */
function findClosestEnemy() {
  let best = null, bd = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - state.player.x) ** 2 + (e.y - state.player.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// Tham số mô phỏng đường đạn (chỉ dùng cho auto-aim, không ảnh hưởng gameplay)
// stepDeg=2 -> quét 360° thành 180 hướng mỗi frame.
const AIM = { stepDeg: 2, bulletR: 6, maxBounces: 32 };

// Khoảng cách từ (x,y) theo hướng (dx,dy) tới khi ra khỏi màn hình
function distToWall(x, y, dx, dy) {
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (VW - x) / dx); else if (dx < 0) t = Math.min(t, (0 - x) / dx);
  if (dy > 0) t = Math.min(t, (VH - y) / dy); else if (dy < 0) t = Math.min(t, (0 - y) / dy);
  return t;
}


/* ===================== HÌNH HỌC KHỐI TETROMINO =====================
   Mỗi khối = 4 ô vuông (đơn vị 'ô') so với tâm enemy. Va chạm theo từng ô. */
const TETROMINOES = {
  L: [[-0.5,-1],[-0.5,0],[-0.5,1],[0.5,1]],
  J: [[ 0.5,-1],[ 0.5,0],[ 0.5,1],[-0.5,1]],
  S: [[0,-0.5],[1,-0.5],[-1,0.5],[0,0.5]],
  Z: [[-1,-0.5],[0,-0.5],[0,0.5],[1,0.5]],
};
// Tâm ô thứ c của khối e (toạ độ thế giới) + nửa cạnh
function cellRect(e, c) { const h = e.cell / 2; return { cx: e.x + c[0]*e.cell, cy: e.y + c[1]*e.cell, h }; }

// Va chạm hình tròn (bx,by,br) với ô vuông AABB tâm (cx,cy) nửa cạnh h.
// Trả về { nx,ny (pháp tuyến), qx,qy (điểm gần nhất trên ô) } hoặc null.
function circleAABB(bx, by, br, cx, cy, h) {
  const qx = Math.max(cx - h, Math.min(bx, cx + h));
  const qy = Math.max(cy - h, Math.min(by, cy + h));
  const dx = bx - qx, dy = by - qy, d2 = dx*dx + dy*dy;
  if (d2 > br*br) return null;
  let nx, ny;
  if (d2 > 1e-6) { const d = Math.sqrt(d2); nx = dx/d; ny = dy/d; }
  else { // tâm đạn nằm trong ô -> đẩy ra theo trục cạn nhất
    const ox = h - Math.abs(bx - cx), oy = h - Math.abs(by - cy);
    if (ox < oy) { nx = bx < cx ? -1 : 1; ny = 0; } else { nx = 0; ny = by < cy ? -1 : 1; }
  }
  return { nx, ny, qx, qy };
}

// Tia (ox,oy)+t(dx,dy) cắt ô vuông AABB (đã nới rộng theo bán kính đạn). Trả {t,nx,ny} hoặc null.
function rayAABB(ox, oy, dx, dy, cx, cy, h) {
  const minx = cx-h, maxx = cx+h, miny = cy-h, maxy = cy+h;
  let tmin = -Infinity, tmax = Infinity, nx = 0, ny = 0;
  if (Math.abs(dx) < 1e-9) { if (ox < minx || ox > maxx) return null; }
  else { let t1=(minx-ox)/dx, t2=(maxx-ox)/dx, s=-1; if (t1>t2){const tt=t1;t1=t2;t2=tt;s=1;} if (t1>tmin){tmin=t1;nx=s;ny=0;} if (t2<tmax) tmax=t2; }
  if (Math.abs(dy) < 1e-9) { if (oy < miny || oy > maxy) return null; }
  else { let t1=(miny-oy)/dy, t2=(maxy-oy)/dy, s=-1; if (t1>t2){const tt=t1;t1=t2;t2=tt;s=1;} if (t1>tmin){tmin=t1;nx=0;ny=s;} if (t2<tmax) tmax=t2; }
  if (tmax < Math.max(tmin, 0)) return null;
  if (tmin > 0.001) return { t: tmin, nx, ny };
  return null;
}

// Đạn vs enemy (thật): trả {nx,ny,qx,qy} điểm/pháp tuyến va chạm, hoặc null.
function collideBulletEnemy(b, e) {
  if (e.cells) {
    let best = null, bestPen = -1;
    for (const c of e.cells) {
      const r = cellRect(e, c), col = circleAABB(b.x, b.y, b.radius, r.cx, r.cy, r.h);
      if (col) { const pen = b.radius - Math.hypot(b.x-col.qx, b.y-col.qy); if (pen > bestPen) { bestPen = pen; best = col; } }
    }
    return best;
  }
  if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
    let nx = b.x - e.x, ny = b.y - e.y; const L = Math.hypot(nx, ny) || 1;
    return { nx: nx/L, ny: ny/L, circle: true };
  }
  return null;
}

// Enemy có chạm vào nhân vật không (tetromino: kiểm từng ô)
function enemyHitsPlayer(e) {
  const px = state.player.x, py = state.player.y, pr = state.player.radius;
  if (e.cells) { for (const c of e.cells) { const r = cellRect(e, c); if (circleAABB(px, py, pr, r.cx, r.cy, r.h)) return true; } return false; }
  return Math.hypot(e.x - px, e.y - py) < e.radius + pr;
}

// Tia vs enemy (cho auto-aim): trả {t,nx,ny} giao điểm gần nhất, hoặc null.
function rayEnemy(ox, oy, dx, dy, e) {
  if (e.cells) {
    let best = null;
    for (const c of e.cells) { const r = cellRect(e, c); const hit = rayAABB(ox, oy, dx, dy, r.cx, r.cy, r.h + AIM.bulletR); if (hit && (!best || hit.t < best.t)) best = hit; }
    return best;
  }
  const R = e.radius + AIM.bulletR, ocx = ox - e.x, ocy = oy - e.y;
  const b = ocx*dx + ocy*dy, c = ocx*ocx + ocy*ocy - R*R, disc = b*b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t <= 0.001) return null;
  const px = ox + dx*t, py = oy + dy*t;
  return { t, nx: (px - e.x)/R, ny: (py - e.y)/R };
}

// Mô phỏng CHÍNH XÁC đường đạn bằng giao tia–vòng tròn (khớp đúng vật lý reflect thật).
// Trả về { hits:Set chỉ số enemy nảy trúng, firstDist:khoảng cách tới mục tiêu đầu tiên }.
function simulateHits(angle) {
  const en = state.enemies;
  let ox = state.player.x, oy = state.player.y;
  let dx = Math.cos(angle), dy = Math.sin(angle);
  const hits = new Set();
  let firstDist = Infinity;
  for (let bounce = 0; bounce < AIM.maxBounces; bounce++) {
    // tìm enemy gần nhất mà tia đâm vào (giao điểm t nhỏ nhất > 0)
    let bestT = Infinity, bestI = -1, bnx = 0, bny = 0;
    for (let i = 0; i < en.length; i++) {
      if (hits.has(i)) continue;
      const hit = rayEnemy(ox, oy, dx, dy, en[i]);   // vòng tròn hoặc khối tetromino
      if (hit && hit.t < bestT) { bestT = hit.t; bestI = i; bnx = hit.nx; bny = hit.ny; }
    }
    const tWall = distToWall(ox, oy, dx, dy);
    if (bestI < 0 || bestT > tWall) break;   // ra tường trước khi gặp enemy -> dừng
    if (bounce === 0) firstDist = bestT;
    hits.add(bestI);
    // điểm chạm + phản xạ gương quanh pháp tuyến tại đó
    const cpx = ox + dx * bestT, cpy = oy + dy * bestT;
    const dot = dx * bnx + dy * bny;
    dx -= 2 * dot * bnx; dy -= 2 * dot * bny;
    ox = cpx + bnx * 0.5; oy = cpy + bny * 0.5;
  }
  return { hits, firstDist };
}

// Chọn góc bắn tối ưu: QUÉT TOÀN 360°.
// Ưu tiên: (1) BẮT BUỘC trúng enemy gần nhất -> (2) trúng nhiều enemy nhất -> (3) chạm mục tiêu đầu sớm nhất.
function bestAimAngle() {
  if (!state.enemies.length) return lastAim;
  const closestIdx = state.enemies.indexOf(findClosestEnemy());
  let bestAng = lastAim, bestScore = -1, bestHasClosest = false, bestFirst = Infinity;
  for (let d = 0; d < 360; d += AIM.stepDeg) {
    const a = d * Math.PI / 180;
    const r = simulateHits(a);
    const score = r.hits.size;
    const hasClosest = r.hits.has(closestIdx);
    const better =
      (hasClosest && !bestHasClosest) ||                                            // (1) ưu tiên cứng: trúng enemy gần nhất
      (hasClosest === bestHasClosest && score > bestScore) ||                       // (2) trong số đó: nhiều hit nhất
      (hasClosest === bestHasClosest && score === bestScore && r.firstDist < bestFirst); // (3) chạm sớm nhất
    if (better) { bestAng = a; bestScore = score; bestHasClosest = hasClosest; bestFirst = r.firstDist; }
  }
  return bestAng;
}

// Cập nhật hướng ngắm mỗi frame (gọi trong update)
function updateAim() {
  if (Game.autoPlay) { if (state.enemies.length) lastAim = bestAimAngle(); }
  else { lastAim = Math.atan2(mouse.y - state.player.y, mouse.x - state.player.x); }
}


/* ---------------- SPAWN ENEMY ---------------- */
function pickEnemyType() {
  const types = Store.balance.enemyTypes;
  const keys = Object.keys(types);
  let total = keys.reduce((s, k) => s + types[k].weight, 0);
  let r = Math.random() * total;
  for (const k of keys) { r -= types[k].weight; if (r <= 0) return k; }
  return keys[0];
}
function spawnEnemy() {
  const stats = makeEnemyStats(pickEnemyType(), state.elapsed);
  const m = 30; let x, y;
  const side = Math.floor(Math.random() * 4);
  if (side === 0)      { x = Math.random() * VW; y = -m; }
  else if (side === 1) { x = VW + m; y = Math.random() * VH; }
  else if (side === 2) { x = Math.random() * VW; y = VH + m; }
  else                 { x = -m; y = Math.random() * VH; }
  const e = Object.assign(stats, {
    x, y, slowTimer: 0, slowFactor: 1, burnTimer: 0, burnDps: 0, hitFlash: 0,
  });
  // Khối tetromino: chọn ngẫu nhiên 1 hình + tính bán kính bao (cho broad-phase/HP bar)
  if (e.shape === 'tetromino') {
    const keys = Object.keys(TETROMINOES);
    e.piece = keys[Math.floor(Math.random() * keys.length)];
    e.cells = TETROMINOES[e.piece];
    let rad = 0;
    for (const c of e.cells) rad = Math.max(rad, Math.hypot((Math.abs(c[0]) + 0.5) * e.cell, (Math.abs(c[1]) + 0.5) * e.cell));
    e.radius = rad;
  }
  state.enemies.push(e);
}


/* ---------------- BẮN ĐẠN ---------------- */
function fire() {
  const P = state.player.stats;
  const baseAng = lastAim; // hướng ngắm đã được updateAim() tính ở đầu frame
  const n = P.bulletCount;
  const spreadRad = P.bulletSpread * Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const offset = n === 1 ? 0 : (i / (n - 1) - 0.5) * spreadRad;
    const ang = baseAng + offset;
    state.bullets.push({
      x: state.player.x, y: state.player.y,
      px: state.player.x, py: state.player.y, // vị trí frame trước (để tính điểm va chạm khi nảy)
      vx: Math.cos(ang) * P.bulletSpeed, vy: Math.sin(ang) * P.bulletSpeed,
      radius: 6, damage: P.bulletDamage,
      pierceLeft: P.bulletPierce,  // nảy vô hạn; pierce = số lần đi thẳng xuyên qua
      alive: true, bounceCount: 0, hitSet: new Set(),
    });
  }
  // Luồng gió (gió): cứ mỗi N phát bắn thì đẩy enemy quanh người ra xa
  state.shotCount++;
  const wp = P.fx.windpulse;
  if (wp && state.shotCount % wp.every === 0) pushEnemiesFrom(state.player.x, state.player.y, wp.r, 70);
}


/* ---------------- VA CHẠM / HIỆU ỨNG ---------------- */
function reflect(b, e) {
  // Tính pháp tuyến tại ĐIỂM VA CHẠM THỰC trên rìa enemy (không dùng vị trí đã lún vào trong).
  // Tìm giao điểm của đoạn [vị trí frame trước -> vị trí hiện tại] với vòng tròn bán kính R.
  const R = e.radius + b.radius;
  const ax = b.px, ay = b.py;             // điểm đầu đoạn (ngoài enemy)
  const dx = b.x - ax, dy = b.y - ay;     // vector di chuyển trong frame
  const fx = ax - e.x, fy = ay - e.y;
  const A = dx * dx + dy * dy;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - R * R;
  const disc = B * B - 4 * A * C;
  let cx, cy;
  let t = (A > 0 && disc >= 0) ? (-B - Math.sqrt(disc)) / (2 * A) : -1;
  if (t >= 0 && t <= 1) { cx = ax + dx * t; cy = ay + dy * t; } // điểm chạm chính xác
  else { cx = b.x; cy = b.y; }                                  // fallback hiếm gặp
  let nx = cx - e.x, ny = cy - e.y;
  const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
  // phản xạ gương: góc tới = góc phản xạ quanh pháp tuyến tại điểm chạm
  const dot = b.vx * nx + b.vy * ny;
  b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
  // đặt đạn về đúng điểm chạm rồi đẩy ra ngoài rìa 1 chút để không kẹt
  b.x = e.x + nx * (R + 0.5);
  b.y = e.y + ny * (R + 0.5);
}
// Nảy khỏi 1 ô vuông của khối tetromino: phản xạ quanh pháp tuyến mặt ô, đẩy đạn ra ngoài
function reflectCell(b, col) {
  const dot = b.vx * col.nx + b.vy * col.ny;
  b.vx -= 2 * dot * col.nx; b.vy -= 2 * dot * col.ny;
  b.x = col.qx + col.nx * (b.radius + 0.5);
  b.y = col.qy + col.ny * (b.radius + 0.5);
}
function damageEnemy(e, dmg) { e.hp -= dmg; e.hitFlash = 0.08; }

function applyHitEffects(e) {
  const fx = state.player.stats.fx;
  if (fx.slow) { e.slowTimer = fx.slow.duration; e.slowFactor = fx.slow.factor; }
  if (fx.burn) { e.burnTimer = fx.burn.duration; e.burnDps = fx.burn.dps; }
}

/* ===== SKILL NGUYÊN TỐ (port từ nhánh khanhnl) — chỉ kích hoạt khi ĐẠN trúng trực tiếp ===== */
function applyOnHitSkills(e) {
  const fx = state.player.stats.fx;
  // Tê liệt (điện): % cơ hội khiến enemy đứng hình
  if (fx.stun && Math.random() < fx.stun.chance) e.stunTimer = Math.max(e.stunTimer || 0, fx.stun.duration);
  // Đẩy lùi (đất): hất enemy ra xa khỏi nhân vật
  if (fx.knockback) {
    const dx = e.x - state.player.x, dy = e.y - state.player.y, d = Math.hypot(dx, dy) || 1;
    e.x += dx / d * fx.knockback.force; e.y += dy / d * fx.knockback.force;
  }
  // Sét lan (điện): phóng sang vài enemy gần
  if (fx.chain) chainLightning(e, fx.chain.count, fx.chain.dmg);
}

// Sét lan: từ 'src' nhảy sang 'count' enemy gần nhất trong bán kính, mỗi nhịp gây 'dmg'.
function chainLightning(src, count, dmg) {
  const cands = state.enemies
    .filter(o => !o.dead && o !== src)
    .map(o => ({ o, d: Math.hypot(o.x - src.x, o.y - src.y) }))
    .filter(c => c.d <= 220).sort((a, b) => a.d - b.d).slice(0, count);
  let from = src;
  for (const c of cands) {
    state.bolts.push({ x1: from.x, y1: from.y, x2: c.o.x, y2: c.o.y, life: 0.12 });
    damageEnemy(c.o, dmg);
    if (c.o.hp <= 0 && !c.o.dead) { c.o.dead = true; onEnemyKilled(c.o); }
    from = c.o;
  }
}

// Đẩy mọi enemy trong bán kính r ra xa khỏi (px,py) — dùng cho Luồng gió
function pushEnemiesFrom(px, py, r, push) {
  for (const e of state.enemies) {
    if (e.dead) continue;
    const dx = e.x - px, dy = e.y - py, d = Math.hypot(dx, dy);
    if (d <= r && d > 0.01) { const k = push * (1 - d / r); e.x += dx / d * k; e.y += dy / d * k; }
  }
}
function onEnemyKilled(enemy) {
  state.score += enemy.score; state.kills++;
  spawnExplosion(enemy.x, enemy.y, enemy.color);
  const aoe = state.player.stats.fx.aoe;
  if (aoe && aoe.damage > 0) {
    for (const o of state.enemies) {
      if (o === enemy || o.dead) continue;
      if (Math.hypot(o.x - enemy.x, o.y - enemy.y) <= aoe.radius) {
        damageEnemy(o, aoe.damage); applyHitEffects(o);
        if (o.hp <= 0 && !o.dead) { o.dead = true; onEnemyKilled(o); }
      }
    }
  }
}
function spawnExplosion(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 120;
    state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, color });
  }
}


/* ---------------- NÂNG CẤP ----------------
   Set dùng cho level được CHỌN TRONG MÀN EDIT (Store.activeSetId).
   Lúc chơi KHÔNG hỏi set; mỗi lần đủ điểm thì random upgrade trong set đó. */
function upgradesInSet(set) {
  // Trả về các upgrade trong set chưa đạt maxLevel
  return (set.upgradeIds || [])
    .map(id => Store.getUpgrade(id))
    .filter(u => u && (u.maxLevel === null || (state.upgradeLevels[u.id] || 0) < u.maxLevel));
}

// LÊN CẤP: random 'choices' upgrade trong SET đang dùng cho level
function levelUp() {
  const set = state.chosenSet;
  // Không còn upgrade khả dụng trong set -> đẩy ngưỡng lên để khỏi hiện bảng trống
  if (!set || upgradesInSet(set).length === 0) {
    state.nextUpgradeAt += Store.balance.upgrade.baseCost + Store.balance.upgrade.costStep * (state.upgradesTaken + 1);
    return;
  }
  offerUpgrades(set);
}
function offerUpgrades(set) {
  state.paused = true;
  const pool = upgradesInSet(set).slice();
  const picks = [];
  const n = Math.max(1, set.choices || 3);
  while (picks.length < n && pool.length) {
    picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  const wrap = document.getElementById('upgradeCards');
  wrap.innerHTML = '';
  picks.forEach(u => {
    const lvl = state.upgradeLevels[u.id] || 0;
    const lvlText = u.maxLevel ? `Cấp ${lvl + 1}/${u.maxLevel}` : `Cấp ${lvl + 1}`;
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<div class="ico">${u.ico}</div>
                     <div class="name">${u.name}</div>
                     <div class="desc">${u.desc || ''}</div>
                     <div class="lvl">${lvlText}</div>`;
    div.onclick = () => chooseUpgrade(u);
    wrap.appendChild(div);
  });
  document.getElementById('upgradeOverlay').classList.add('show');
}
function chooseUpgrade(u) {
  applyUpgrade(state.player.stats, u);
  state.upgradeLevels[u.id] = (state.upgradeLevels[u.id] || 0) + 1;
  state.upgradesTaken++;
  state.nextUpgradeAt += Store.balance.upgrade.baseCost + Store.balance.upgrade.costStep * state.upgradesTaken;
  document.getElementById('upgradeOverlay').classList.remove('show');
  state.paused = false;
  lastTime = performance.now();
}


/* ---------------- THUA / RESTART ---------------- */
function gameOver() {
  state.running = false;
  const m = Math.floor(state.elapsed / 60), s = Math.floor(state.elapsed % 60);
  document.getElementById('gameoverStats').textContent =
    `Sống sót ${m}:${s.toString().padStart(2,'0')} • Hạ ${state.kills} • Nâng cấp ${state.upgradesTaken} lần`;
  document.getElementById('gameoverOverlay').classList.add('show');
}
function restart() {
  document.getElementById('gameoverOverlay').classList.remove('show');
  document.getElementById('upgradeOverlay').classList.remove('show');
  initState(); lastTime = performance.now(); // chơi ngay, đợi đủ điểm mới có upgrade
}
document.getElementById('restartBtn').onclick = restart;


/* ---------------- UPDATE ---------------- */
function update(dt) {
  state.elapsed += dt;

  // Di chuyển nhân vật bằng WASD / phím mũi tên
  let mx = 0, my = 0;
  if (keys.has('w') || keys.has('arrowup'))    my -= 1;
  if (keys.has('s') || keys.has('arrowdown'))  my += 1;
  if (keys.has('a') || keys.has('arrowleft'))  mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (mx || my) {
    const L = Math.hypot(mx, my);            // chuẩn hoá để đi chéo không nhanh hơn
    const sp = state.player.stats.moveSpeed, r = state.player.radius;
    state.player.x = Math.max(r, Math.min(VW - r, state.player.x + mx / L * sp * dt));
    state.player.y = Math.max(r, Math.min(VH - r, state.player.y + my / L * sp * dt));
  }

  updateAim(); // tính hướng ngắm (auto-play tối ưu nảy / hoặc theo chuột)

  state.player.fireTimer -= dt;
  if (state.player.fireTimer <= 0) { fire(); state.player.fireTimer = state.player.stats.fireCooldown; }

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) { spawnEnemy(); state.spawnTimer = currentSpawnInterval(state.elapsed); }

  for (const b of state.bullets) {
    b.px = b.x; b.py = b.y;             // lưu vị trí trước khi di chuyển (cho reflect)
    b.x += b.vx * dt; b.y += b.vy * dt;
    // Đạn nảy VÔ HẠN khi trúng enemy; chỉ biến mất khi chạm tường.
    if (b.x < 0 || b.x > VW || b.y < 0 || b.y > VH) { b.alive = false; }
  }

  for (const e of state.enemies) {
    if (e.stunTimer > 0) { e.stunTimer -= dt; }   // tê liệt: đứng hình, không di chuyển
    else {
      let spd = e.speed;
      if (e.slowTimer > 0) { e.slowTimer -= dt; spd *= e.slowFactor; }
      const ang = Math.atan2(state.player.y - e.y, state.player.x - e.x);
      e.x += Math.cos(ang) * spd * dt; e.y += Math.sin(ang) * spd * dt;
    }
    if (e.burnTimer > 0) {
      e.burnTimer -= dt; damageEnemy(e, e.burnDps * dt);
      if (e.hp <= 0 && !e.dead) { e.dead = true; onEnemyKilled(e); }
    }
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (enemyHitsPlayer(e)) { gameOver(); return; }   // tetromino: kiểm từng ô
  }

  for (const b of state.bullets) {
    for (const e of state.enemies) {
      if (e.dead || b.hitSet.has(e)) continue;
      const col = collideBulletEnemy(b, e);   // vòng tròn hoặc từng ô khối tetromino
      if (col) {
        damageEnemy(e, b.damage); applyHitEffects(e); applyOnHitSkills(e); b.hitSet.add(e);
        if (e.hp <= 0) { e.dead = true; onEnemyKilled(e); }
        if (b.pierceLeft > 0) {
          b.pierceLeft--;                 // đi thẳng xuyên qua enemy này
        } else {
          if (col.circle) reflect(b, e);  // vòng tròn: dùng giao đoạn–vòng tròn chính xác
          else reflectCell(b, col);       // khối: nảy theo mặt ô (góc tới = góc phản xạ)
          b.hitSet.clear(); b.hitSet.add(e); // sau khi nảy được phép trúng enemy khác
          if (++b.bounceCount > 300) b.alive = false; // van an toàn chống kẹt vô hạn (gần như không bao giờ chạm)
        }
        break;
      }
    }
  }

  // Điện trường (aura): mỗi 0.5s giật enemy trong bán kính quanh người
  const aura = state.player.stats.fx.aura;
  if (aura) {
    state.auraTimer += dt;
    if (state.auraTimer >= 0.5) {
      state.auraTimer = 0;
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - state.player.x, e.y - state.player.y) <= aura.radius) {
          damageEnemy(e, aura.dmg);
          if (e.hp <= 0 && !e.dead) { e.dead = true; onEnemyKilled(e); }
        }
      }
    }
  }

  state.bullets = state.bullets.filter(b => b.alive);
  state.enemies = state.enemies.filter(e => !e.dead);
  for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  state.particles = state.particles.filter(p => p.life > 0);
  for (const z of state.bolts) z.life -= dt;            // tia sét mờ dần
  state.bolts = state.bolts.filter(z => z.life > 0);

  // Đủ điểm -> lên cấp: random upgrade trong set đã chọn
  if (state.score >= state.nextUpgradeAt) { levelUp(); }
}


/* ---------------- RENDER ---------------- */
function drawEnemy(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
  ctx.strokeStyle = '#2b2f38'; ctx.lineWidth = 2;
  const r = e.radius;
  if (e.shape === 'tetromino') {
    const s = e.cell, h = s / 2;
    for (const c of e.cells) {       // vẽ từng ô vuông của khối
      ctx.beginPath(); ctx.rect(c[0]*s - h, c[1]*s - h, s, s); ctx.fill(); ctx.stroke();
    }
  }
  else if (e.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill(); ctx.stroke(); }
  else if (e.shape === 'square') { ctx.beginPath(); ctx.rect(-r,-r,r*2,r*2); ctx.fill(); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(r,r); ctx.lineTo(-r,r); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  if (e.hp < e.maxHp) {
    const w = e.radius*2, hpw = w*Math.max(0,e.hp)/e.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(e.x-w/2, e.y-e.radius-9, w, 4);
    ctx.fillStyle = '#34c759'; ctx.fillRect(e.x-w/2, e.y-e.radius-9, hpw, 4);
  }
  if (e.stunTimer > 0) {   // dấu tê liệt: chấm vàng trên đầu
    ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.arc(e.x, e.y - e.radius - 14, 3, 0, Math.PI*2); ctx.fill();
  }
}
function render() {
  ctx.clearRect(0, 0, VW, VH);
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life/0.4); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Điện trường: vòng tròn mờ quanh người (skill aura)
  const auraFx = state.player.stats.fx.aura;
  if (auraFx) {
    ctx.strokeStyle = 'rgba(255,225,77,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(state.player.x, state.player.y, auraFx.radius, 0, Math.PI*2); ctx.stroke();
  }

  state.enemies.forEach(drawEnemy);
  ctx.fillStyle = '#2b2f38';
  for (const b of state.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2); ctx.fill(); }

  // Tia sét (skill sét lan) — vẽ đường vàng mờ dần
  ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2;
  for (const z of state.bolts) {
    ctx.globalAlpha = Math.max(0, z.life / 0.12);
    ctx.beginPath(); ctx.moveTo(z.x1, z.y1); ctx.lineTo(z.x2, z.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.lineWidth = 2;

  // đường ngắm
  const aim = lastAim;
  ctx.strokeStyle = Game.autoPlay ? '#ffb84d' : '#b8c0cc';
  ctx.setLineDash([4, 6]); ctx.beginPath();
  ctx.moveTo(state.player.x, state.player.y);
  ctx.lineTo(state.player.x + Math.cos(aim)*VH, state.player.y + Math.sin(aim)*VH);
  ctx.stroke(); ctx.setLineDash([]);

  // player
  ctx.fillStyle = '#ff5277'; ctx.strokeStyle = '#2b2f38'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(state.player.x, state.player.y);
  ctx.lineTo(state.player.x + Math.cos(aim)*state.player.radius, state.player.y + Math.sin(aim)*state.player.radius);
  ctx.lineWidth = 4; ctx.stroke();

  drawHUD();
}
function drawHUD() {
  ctx.fillStyle = '#2b2f38'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`Điểm: ${state.score}`, 16, 32);
  const m = Math.floor(state.elapsed/60), s = Math.floor(state.elapsed%60);
  ctx.textAlign = 'right'; ctx.fillText(`${m}:${s.toString().padStart(2,'0')}`, VW-16, 32);
  ctx.textAlign = 'left'; ctx.font = '13px sans-serif'; ctx.fillStyle = '#6b7280';
  ctx.fillText(`Nâng cấp kế: ${state.score}/${state.nextUpgradeAt}`, 16, 52);
  ctx.textAlign = 'right'; ctx.fillText(`Độ khó: ${difficultyStep(state.elapsed)+1}`, VW-16, 52);
}


/* ---------------- PANEL DEBUG ----------------
   Hiển thị thông số nhân vật + enemy (theo độ khó hiện tại) + thời gian chơi.
   Cập nhật ~10 lần/giây để nhẹ. */
let debugAccum = 0;
function renderDebug() {
  const box = document.getElementById('debugPanel');
  if (!box) return;
  if (!Game.showDebug) { box.style.display = 'none'; return; }
  box.style.display = 'block';

  const P = state.player.stats;
  const m = Math.floor(state.elapsed / 60), s = Math.floor(state.elapsed % 60);
  const step = difficultyStep(state.elapsed);

  // đếm enemy trên màn theo loại
  const counts = {};
  for (const e of state.enemies) counts[e.type] = (counts[e.type] || 0) + 1;

  // FX đặc biệt
  const fx = P.fx, fxLines = [];
  if (fx.slow) fxLines.push(`slow ×${fx.slow.factor} (${fx.slow.duration}s)`);
  if (fx.burn) fxLines.push(`burn ${fx.burn.dps}/s (${fx.burn.duration}s)`);
  if (fx.aoe)  fxLines.push(`aoe r${fx.aoe.radius} ×${fx.aoe.damage}`);

  // dòng enemy theo từng loại, chỉ số đã scale theo thời gian
  const enemyLines = Object.keys(Store.balance.enemyTypes).map(k => {
    const st = makeEnemyStats(k, state.elapsed);
    return `<div class="dbg-row">${st.shape}: HP ${st.maxHp} • spd ${st.speed.toFixed(0)} • điểm ${st.score} • trên màn ${counts[k] || 0}</div>`;
  }).join('');

  box.innerHTML =
    `<div class="dbg-title">⏱ ${m}:${String(s).padStart(2,'0')} &nbsp;•&nbsp; Độ khó bậc ${step + 1}</div>` +
    `<div class="dbg-row">Điểm ${state.score} → kế ${state.nextUpgradeAt} • Hạ ${state.kills} • Nâng cấp ${state.upgradesTaken}</div>` +
    `<div class="dbg-sec">NHÂN VẬT &nbsp;(1 chạm = thua • WASD để di chuyển)</div>` +
    `<div class="dbg-row">Vị trí: ${state.player.x.toFixed(0)},${state.player.y.toFixed(0)} • Tốc chạy ${P.moveSpeed.toFixed(0)} • Map ${VW}×${VH}</div>` +
    `<div class="dbg-row">Nhịp bắn: ${(1 / P.fireCooldown).toFixed(2)}/s &nbsp;(cd ${P.fireCooldown.toFixed(3)}s)</div>` +
    `<div class="dbg-row">Đạn: dmg ${P.bulletDamage} • ${P.bulletCount} viên • xòe ${P.bulletSpread}° • tốc ${P.bulletSpeed.toFixed(0)} • xuyên ${P.bulletPierce}</div>` +
    (fxLines.length ? `<div class="dbg-row">FX: ${fxLines.join(' · ')}</div>` : '') +
    `<div class="dbg-row">Đạn trên màn: ${state.bullets.length} • Set: ${state.chosenSet ? state.chosenSet.name : '—'}</div>` +
    `<div class="dbg-sec">ENEMY &nbsp;(tổng trên màn: ${state.enemies.length})</div>` +
    `<div class="dbg-row">Spawn mỗi ${currentSpawnInterval(state.elapsed).toFixed(2)}s</div>` +
    enemyLines;
}


/* ---------------- VÒNG LẶP ---------------- */
let lastTime = performance.now();
function loop(now) {
  let dt = (now - lastTime) / 1000; lastTime = now;
  dt = Math.min(dt, 0.05);
  if (Game.active && state) {
    if (state.running && !state.paused) update(dt);
    render();
    debugAccum += dt;
    if (debugAccum >= 0.1) { renderDebug(); debugAccum = 0; }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// editor.js gọi khi mở màn Play
Game.start = function () { syncMapSize(); initState(); resize(); Game.active = true; lastTime = performance.now(); };
Game.stop  = function () { Game.active = false; };
