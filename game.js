/* ============================================================================
   [game.js] ENGINE (màn Play) — vòng lặp, auto-play, va chạm, set→upgrade.
   ----------------------------------------------------------------------------
   Phụ thuộc: config.js, data.js (Store, applyUpgrade, makeEnemyStats...).
   Bình thường không cần sửa khi balance — chỉ chỉnh số trong màn Edit.
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


// --- Cờ điều khiển vòng đời (editor.js bật/tắt khi đổi tab) ---
const Game = {
  active: false,    // có đang ở màn Play không
  autoPlay: true,   // FEATURE: tự ngắm enemy gần nhất
};


// --- Trạng thái game ---
let state;
let lastAim = -Math.PI / 2; // hướng ngắm gần nhất (mặc định hướng lên)

function freshPlayerStats() {
  // Lấy chỉ số gốc từ Store.balance.player + túi hiệu ứng fx
  return Object.assign({}, Store.balance.player, { fx: {} });
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
    pendingSet: null, // set đang chờ chọn upgrade
  };
}


/* ---------------- NGẮM ----------------
   FEATURE auto-play: trả về góc tới enemy gần nhất; nếu tắt thì ngắm theo chuột. */
function findClosestEnemy() {
  let best = null, bd = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - state.player.x) ** 2 + (e.y - state.player.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function aimAngle() {
  if (Game.autoPlay) {
    const t = findClosestEnemy();
    if (t) lastAim = Math.atan2(t.y - state.player.y, t.x - state.player.x);
    return lastAim;
  }
  lastAim = Math.atan2(mouse.y - state.player.y, mouse.x - state.player.x);
  return lastAim;
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
  state.enemies.push(Object.assign(stats, {
    x, y, slowTimer: 0, slowFactor: 1, burnTimer: 0, burnDps: 0, hitFlash: 0,
  }));
}


/* ---------------- BẮN ĐẠN ---------------- */
function fire() {
  const P = state.player.stats;
  const baseAng = aimAngle();
  const n = P.bulletCount;
  const spreadRad = P.bulletSpread * Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const offset = n === 1 ? 0 : (i / (n - 1) - 0.5) * spreadRad;
    const ang = baseAng + offset;
    state.bullets.push({
      x: state.player.x, y: state.player.y,
      vx: Math.cos(ang) * P.bulletSpeed, vy: Math.sin(ang) * P.bulletSpeed,
      radius: 6, damage: P.bulletDamage,
      bouncesLeft: P.bulletBounces, pierceLeft: P.bulletPierce,
      life: P.bulletLifetime, hitSet: new Set(),
    });
  }
}


/* ---------------- VA CHẠM / HIỆU ỨNG ---------------- */
function reflect(b, e) {
  let nx = b.x - e.x, ny = b.y - e.y;
  const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
  const dot = b.vx * nx + b.vy * ny;
  b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
  b.x = e.x + nx * (e.radius + b.radius + 1);
  b.y = e.y + ny * (e.radius + b.radius + 1);
}
function damageEnemy(e, dmg) { e.hp -= dmg; e.hitFlash = 0.08; }

function applyHitEffects(e) {
  const fx = state.player.stats.fx;
  if (fx.slow) { e.slowTimer = fx.slow.duration; e.slowFactor = fx.slow.factor; }
  if (fx.burn) { e.burnTimer = fx.burn.duration; e.burnDps = fx.burn.dps; }
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


/* ---------------- NÂNG CẤP: chọn SET trước, rồi chọn UPGRADE ---------------- */
function upgradesInSet(set) {
  // Trả về các upgrade trong set chưa đạt maxLevel
  return (set.upgradeIds || [])
    .map(id => Store.getUpgrade(id))
    .filter(u => u && (u.maxLevel === null || (state.upgradeLevels[u.id] || 0) < u.maxLevel));
}
function setHasChoices(set) { return upgradesInSet(set).length > 0; }

// Bước 1: hiện danh sách SET
function offerSets() {
  const sets = Store.sets.filter(setHasChoices);
  if (sets.length === 0) return false; // hết upgrade khả dụng -> bỏ qua lên cấp
  state.paused = true;
  const wrap = document.getElementById('setCards');
  wrap.innerHTML = '';
  sets.forEach(set => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<div class="ico">${set.ico || '📦'}</div>
                     <div class="name">${set.name}</div>
                     <div class="desc">Chọn ${set.choices} nâng cấp trong nhánh này</div>`;
    div.onclick = () => { document.getElementById('setOverlay').classList.remove('show'); offerUpgrades(set); };
    wrap.appendChild(div);
  });
  document.getElementById('setOverlay').classList.add('show');
  return true;
}

// Bước 2: hiện 'choices' upgrade trong set đã chọn
function offerUpgrades(set) {
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
  document.getElementById('setOverlay').classList.remove('show');
  document.getElementById('upgradeOverlay').classList.remove('show');
  initState(); lastTime = performance.now();
}
document.getElementById('restartBtn').onclick = restart;


/* ---------------- UPDATE ---------------- */
function update(dt) {
  state.elapsed += dt;

  state.player.fireTimer -= dt;
  if (state.player.fireTimer <= 0) { fire(); state.player.fireTimer = state.player.stats.fireCooldown; }

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) { spawnEnemy(); state.spawnTimer = currentSpawnInterval(state.elapsed); }

  for (const b of state.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.x < 0 || b.x > VW) { b.vx *= -1; b.x = Math.max(0, Math.min(VW, b.x)); }
    if (b.y < 0 || b.y > VH) { b.vy *= -1; b.y = Math.max(0, Math.min(VH, b.y)); }
  }

  for (const e of state.enemies) {
    let spd = e.speed;
    if (e.slowTimer > 0) { e.slowTimer -= dt; spd *= e.slowFactor; }
    const ang = Math.atan2(state.player.y - e.y, state.player.x - e.x);
    e.x += Math.cos(ang) * spd * dt; e.y += Math.sin(ang) * spd * dt;
    if (e.burnTimer > 0) {
      e.burnTimer -= dt; damageEnemy(e, e.burnDps * dt);
      if (e.hp <= 0 && !e.dead) { e.dead = true; onEnemyKilled(e); }
    }
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (Math.hypot(e.x - state.player.x, e.y - state.player.y) < e.radius + state.player.radius) { gameOver(); return; }
  }

  for (const b of state.bullets) {
    for (const e of state.enemies) {
      if (e.dead || b.hitSet.has(e)) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
        damageEnemy(e, b.damage); applyHitEffects(e); b.hitSet.add(e);
        if (e.hp <= 0) { e.dead = true; onEnemyKilled(e); }
        if (b.pierceLeft > 0) { b.pierceLeft--; }
        else if (b.bouncesLeft > 0) { reflect(b, e); b.bouncesLeft--; b.hitSet.clear(); b.hitSet.add(e); }
        else { b.life = 0; }
        break;
      }
    }
  }

  state.bullets = state.bullets.filter(b => b.life > 0);
  state.enemies = state.enemies.filter(e => !e.dead);
  for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  state.particles = state.particles.filter(p => p.life > 0);

  // Đủ điểm -> lên cấp: hiện SET trước
  if (state.score >= state.nextUpgradeAt) { offerSets(); }
}


/* ---------------- RENDER ---------------- */
function drawEnemy(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
  ctx.strokeStyle = '#2b2f38'; ctx.lineWidth = 2;
  const r = e.radius;
  if (e.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill(); ctx.stroke(); }
  else if (e.shape === 'square') { ctx.beginPath(); ctx.rect(-r,-r,r*2,r*2); ctx.fill(); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(r,r); ctx.lineTo(-r,r); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  if (e.hp < e.maxHp) {
    const w = e.radius*2, hpw = w*Math.max(0,e.hp)/e.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(e.x-w/2, e.y-e.radius-9, w, 4);
    ctx.fillStyle = '#34c759'; ctx.fillRect(e.x-w/2, e.y-e.radius-9, hpw, 4);
  }
}
function render() {
  ctx.clearRect(0, 0, VW, VH);
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life/0.4); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  state.enemies.forEach(drawEnemy);
  ctx.fillStyle = '#2b2f38';
  for (const b of state.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2); ctx.fill(); }

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


/* ---------------- VÒNG LẶP ---------------- */
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

// editor.js gọi khi mở màn Play
Game.start = function () { initState(); resize(); Game.active = true; lastTime = performance.now(); };
Game.stop  = function () { Game.active = false; };
