/* ============================================================================
   [weapons.js] VŨ KHÍ: chọn trước trận + passive + ultimate
   ----------------------------------------------------------------------------
   Phụ thuộc: config.js (WEAPONS, ELEMENT_COLORS), state.js (Game, state),
   levelup.js (offerStarterSkill), loop.js (Game.start), combat.js (damageEnemy,
   onEnemyKilled). Nạp sau skills.js (trước combat.js).

   - Helper passive: fireDmgMul / earthZoneMul / windBulletSpeed / elecChainBonus.
   - showWeaponSelect()/chooseWeapon(): chọn vũ khí rồi vào trận.
   - tryTriggerUlt()/triggerUlt(): nạp đủ kill -> TAP để kích ultimate.
   ============================================================================ */

function curWeapon() { return state ? state.weapon : null; }

/* ---------------- PASSIVE theo vũ khí ---------------- */
// Sát thương Lửa +10% (Fire Sword)
function fireDmgMul() { const w = curWeapon(); return (w && w.element === 'fire') ? 1.1 : 1; }
// Vũng bùn & tường +25% kích thước/thời gian (Earth Sword)
function earthZoneMul() { const w = curWeapon(); return (w && w.element === 'earth') ? 1.25 : 1; }
// Đạn gió bay nhanh hơn 20% (Wind Sword) — chỉ áp cho viên mang hệ gió
function windBulletSpeed(elements) {
  const w = curWeapon();
  return (w && w.element === 'wind' && elements.includes('wind')) ? 1.2 : 1;
}
// Sét lan có 15% nhảy thêm 1 mục tiêu (Lightning Sword)
function elecChainBonus() {
  const w = curWeapon();
  return (w && w.element === 'electric' && Math.random() < 0.15) ? 1 : 0;
}


/* ---------------- CHỌN VŨ KHÍ ---------------- */
function showWeaponSelect() {
  Game.stop();
  hideOverlays();
  const wrap = document.getElementById('weaponCards');
  wrap.innerHTML = '';
  WEAPONS.forEach(w => {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.borderColor = w.color;
    div.style.borderLeftWidth = '6px';
    div.innerHTML = `<div class="name">${w.name}</div>
                     <div class="desc">${w.desc}</div>
                     <div class="lvl" style="color:${w.color}">ULT (${w.ultThreshold} kill): ${w.ultName} — ${w.ultDesc}</div>`;
    div.onclick = () => chooseWeapon(w);
    wrap.appendChild(div);
  });
  document.getElementById('weaponOverlay').classList.add('show');
}

function chooseWeapon(w) {
  document.getElementById('weaponOverlay').classList.remove('show');
  Game.start();                 // initState + active (state mới)
  state.weapon = w;
  state.ultThreshold = w.ultThreshold || 50;
  offerStarterSkill(w.element);  // mở bảng chọn 1 trong 3 skill cùng hệ (pause)
}


/* ---------------- ULTIMATE ---------------- */
function tryTriggerUlt() {
  if (!state || !Game.active || !state.running || state.paused) return;
  if (!state.ultReady) return;
  triggerUlt(state.weapon);
  state.ultReady = false;
  state.ultKills = 0;
}

function triggerUlt(w) {
  if (!w) return;
  if (w.element === 'fire')          ultInferno();
  else if (w.element === 'electric') ultThunderstorm();
  else if (w.element === 'earth')    ultEarthPrison();
  else if (w.element === 'wind')     ultTornado();
}

// Fire (tạm): nổ lửa toàn màn + thiêu đốt
function ultInferno() {
  const fm = fireDmgMul();
  for (const e of state.enemies) {
    if (e.dead) continue;
    damageEnemy(e, 5 * fm);
    for (let i = 0; i < 3; i++) e.burnStacks.push({ dps: 1 * fm, remaining: 6 });
    if (e.hp <= 0 && !e.dead) { e.dead = true; onEnemyKilled(e); }
  }
  state.rings.push({ x: state.player.x, y: state.player.y, r: 0, maxR: Math.max(VW, VH), life: 0.6, dur: 0.6, color: ELEMENT_COLORS.fire });
}

// Electric (tạm): sét đánh tất cả kẻ thù + tê liệt
function ultThunderstorm() {
  for (const e of state.enemies) {
    if (e.dead) continue;
    e.stunTimer = Math.max(e.stunTimer, 1.0);
    state.bolts.push({ x1: e.x, y1: 0, x2: e.x, y2: e.y, life: 0.25 });
    electricHit(e, 4);   // sét: bỏ qua insulate, arc cánh nếu là Tesla
  }
}

// Earth: tạo vòng đất nhốt kẻ thù — đạn nảy vô hạn bên trong
function ultEarthPrison() {
  state.prison = { x: state.player.x, y: state.player.y, r: 220, remaining: 5, hadInside: false };
}

// Wind: lốc xoáy di động hút & gây sát thương
function ultTornado() {
  const ang = Math.random() * Math.PI * 2;
  state.tornado = { x: state.player.x, y: state.player.y, vx: Math.cos(ang) * 140, vy: Math.sin(ang) * 140, r: 140, remaining: 8 };
}
