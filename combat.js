/* ============================================================================
   [combat.js] BẮN ĐẠN + VA CHẠM + HIỆU ỨNG SKILL KHI TRÚNG
   ----------------------------------------------------------------------------
   Phụ thuộc: state.js (state, lastAim), aim.js (updateAim), skills.js (skillCur,
   bulletSpeedMul, critRoll, bulletColor...), particles.js (spawnExplosion).
   Vòng quét va chạm nằm trong update.js; ở đây là các hàm thao tác đơn lẻ.
   ============================================================================ */

/* ---------------- BẮN ĐẠN ---------------- */
function fire() {
  const P = state.player.stats;
  const baseAng = lastAim; // hướng ngắm đã được updateAim() tính ở đầu frame
  const n = P.bulletCount;
  const spreadRad = P.bulletSpread * Math.PI / 180;
  const speed = P.bulletSpeed * bulletSpeedMul();
  const w2 = skillCur('wind2');
  for (let i = 0; i < n; i++) {
    const offset = n === 1 ? 0 : (i / (n - 1) - 0.5) * spreadRad;
    state.bullets.push(makeBullet(baseAng + offset, speed, P));
    state.shotCount++;
    if (w2 && state.shotCount % w2.every === 0) windGust(w2.r);
    runCustomSkills('everyShots', {}); // Skill Lab: trigger "Mỗi N phát"
  }
}

// Tạo 1 viên đạn: roll độc lập Fire2 / Wind1 / Earth1 (có thể trúng nhiều hệ)
function makeBullet(ang, speed, P) {
  let damage = P.bulletDamage;
  let pierce = P.bulletPierce;
  const elements = [];

  const f2 = skillCur('fire2');
  if (f2 && Math.random() < f2.chance) { elements.push('fire'); damage += f2.bonus * fireDmgMul(); }

  const w1 = skillCur('wind1');
  if (w1 && Math.random() < w1.chance) { elements.push('wind'); pierce += w1.pierce; }

  const e1 = skillCur('earth1');
  if (e1 && Math.random() < e1.chance) { elements.push('earth'); }

  let elecChain = 0, elecDmg = 0;
  const el1 = skillCur('elec1');
  if (el1 && Math.random() < el1.chance) { elements.push('electric'); elecChain = el1.chain; elecDmg = el1.dmg; }

  const wb = skillCur('wbounce');
  const bounces = P.bulletBounces + (wb ? wb.bounces : 0);
  const bspeed = speed * windBulletSpeed(elements); // Wind Sword: đạn gió +20% tốc

  return {
    x: state.player.x, y: state.player.y,
    px: state.player.x, py: state.player.y, // vị trí frame trước (cho reflect chính xác)
    vx: Math.cos(ang) * bspeed, vy: Math.sin(ang) * bspeed,
    radius: 6, damage,
    bouncesLeft: bounces, pierceLeft: pierce,
    alive: true, bounceCount: 0, hitSet: new Set(), // sống theo số lần nảy (không còn theo thời gian)
    elements, color: bulletColor(elements), noSplit: false,
    elecChain, elecDmg,
  };
}

// Đẩy mọi enemy trong bán kính r ra rìa vòng, quanh tâm (px,py)
// nudge: nếu có -> đẩy 1 đoạn cố định (Gale); nếu không -> văng ra rìa bán kính (Wind Pulse)
function pushEnemiesFrom(px, py, r, nudge) {
  for (const e of state.enemies) {
    const dx = e.x - px, dy = e.y - py;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d < r) {
      const nx = dx / d, ny = dy / d;
      const bossMul = e.isBoss ? 0.25 : 1; // boss kháng đẩy
      if (nudge) { e.x += nx * nudge * bossMul; e.y += ny * nudge * bossMul; }
      else if (e.isBoss) { const push = (r - d) * 0.25; e.x += nx * push; e.y += ny * push; }
      else { e.x = px + nx * r; e.y = py + ny * r; }
    }
  }
  state.rings.push({ x: px, y: py, r: 0, maxR: r, life: 0.4, color: ELEMENT_COLORS.wind });
}

// Luồng gió (Wind2): đẩy enemy quanh player
function windGust(r) { pushEnemiesFrom(state.player.x, state.player.y, r); }


/* ---------------- VA CHẠM / HIỆU ỨNG ---------------- */
function reflect(b, e) {
  // Pháp tuyến tại ĐIỂM VA CHẠM THỰC trên rìa enemy (giao đoạn [px,py]->[x,y] với vòng tròn R),
  // thay vì dùng vị trí đã "lún" vào trong -> nảy đúng vật lý hơn.
  const R = e.radius + b.radius;
  const ax = b.px, ay = b.py;
  const dx = b.x - ax, dy = b.y - ay;
  const fx = ax - e.x, fy = ay - e.y;
  const A = dx * dx + dy * dy;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - R * R;
  const disc = B * B - 4 * A * C;
  const t = (A > 0 && disc >= 0) ? (-B - Math.sqrt(disc)) / (2 * A) : -1;
  let cx, cy;
  if (t >= 0 && t <= 1) { cx = ax + dx * t; cy = ay + dy * t; } // điểm chạm chính xác
  else { cx = b.x; cy = b.y; }                                  // fallback hiếm gặp
  let nx = cx - e.x, ny = cy - e.y;
  const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
  const dot = b.vx * nx + b.vy * ny;
  b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny;
  b.x = e.x + nx * (R + 0.5);
  b.y = e.y + ny * (R + 0.5);
}

function rawDamage(e, dmg) { e.hp -= dmg; e.hitFlash = 0.08; }
// Sát thương "thường" (phi-điện): bị giảm bởi insulate (Tesla kháng mạnh)
function damageEnemy(e, dmg) { rawDamage(e, dmg * (e.insulate || 1)); }

// Sát thương ĐIỆN: bỏ qua insulate. Trúng Tesla -> arc quanh các cánh sao (×tipCount)
function electricHit(e, dmg) {
  if (e.nodes) { teslaShock(e, dmg); return; }
  rawDamage(e, dmg);
  if (e.hp <= 0 && !e.dead) { e.dead = true; onEnemyKilled(e); }
}
function teslaShock(e, dmg) {
  const tips = e.tipCount || 5, r = e.radius;
  for (let i = 0; i < tips; i++) {            // tia điện chạy vòng quanh các đỉnh sao
    const a1 = -Math.PI/2 + i * 2*Math.PI/tips, a2 = -Math.PI/2 + (i+1) * 2*Math.PI/tips;
    state.bolts.push({ x1: e.x + Math.cos(a1)*r, y1: e.y + Math.sin(a1)*r, x2: e.x + Math.cos(a2)*r, y2: e.y + Math.sin(a2)*r, life: 0.18 });
  }
  rawDamage(e, dmg * tips);                   // mỗi cánh ăn 1 nhịp
  if (e.hp <= 0 && !e.dead) { e.dead = true; onEnemyKilled(e); }
}

// Áp dụng toàn bộ hiệu ứng skill khi viên 'b' trúng enemy 'e'
function bulletHit(b, e) {
  // Bạo kích: ×2 sát thương gốc
  let dmg = b.damage;
  if (critRoll()) { dmg *= 2; e.critFlash = 0.12; }
  // Cyclone: thổi chệch đạn bắn thẳng (×deflect); đạn xuyên/gió đi thẳng -> ×pierceBonus
  let mult = 1;
  if (e.deflect) {
    const piercing = b.pierceLeft > 0 || b.elements.includes('wind');
    mult = piercing ? (e.pierceBonus || 1) : e.deflect;
  }
  damageEnemy(e, dmg * mult);   // damageEnemy còn tự áp insulate (Tesla)

  // Bỏng (Fire1): thêm 1 stack có timer riêng
  const f1 = skillCur('fire1');
  if (f1) e.burnStacks.push({ dps: f1.dps * fireDmgMul(), remaining: f1.duration });

  // Vũng bùn (Earth1): chỉ khi viên mang hệ Đất
  if (b.elements.includes('earth')) {
    const e1 = skillCur('earth1');
    if (e1) { const em = earthZoneMul(); state.puddles.push({ x: e.x, y: e.y, r: e1.r * em, slowFactor: e1.slowFactor, remaining: e1.duration * em }); }
  }

  // Đạn nặng (Earth2): đẩy lùi theo hướng đạn
  const e2 = skillCur('earth2');
  if (e2) {
    const len = Math.hypot(b.vx, b.vy) || 1;
    const kb = e2.knockback * (e.isBoss ? 0.15 : 1); // boss kháng knockback
    e.x += b.vx / len * kb;
    e.y += b.vy / len * kb;
  }

  // Tê Liệt (Elec2): % làm kẻ thù đứng hình
  const el2 = skillCur('elec2');
  if (el2 && Math.random() < el2.chance) e.stunTimer = Math.max(e.stunTimer, el2.duration);

  // Quá Tải (Elec4): trúng kẻ thù đang tê liệt -> nổ điện diện rộng
  const el4 = skillCur('elec4');
  if (el4 && e.stunTimer > 0) electricBurst(e, el4.r, el4.dmg);

  // Đạn Sét (Elec1): lan sang vài kẻ thù gần
  if (b.elements.includes('electric') && b.elecChain > 0) chainLightning(e, b.elecChain, b.elecDmg);

  // Tách rời (Split): viên đạn tách làm đôi
  const sp = skillCur('split');
  if (sp && !b.noSplit && Math.random() < sp.chance) spawnSplit(b, e);

  runCustomSkills('onHit', { enemy: e, bullet: b }); // Skill Lab: trigger "Khi trúng"

  b.hitSet.add(e);
  if (e.hp <= 0 && !e.dead) { e.dead = true; onEnemyKilled(e); }
}

// Đạn Sét: lan từ enemy 'src' sang 'count' kẻ thù gần nhất chưa trúng
function chainLightning(src, count, dmg) {
  if (src.nodes) { teslaShock(src, dmg); return; } // sét vào Tesla -> arc quanh cánh, không nảy đi
  count += elecChainBonus(); // Lightning Sword: 15% lan thêm 1 mục tiêu
  const RANGE = 220;
  const hit = new Set([src]);
  let from = src;
  for (let i = 0; i < count; i++) {
    let best = null, bd = RANGE * RANGE;
    for (const e of state.enemies) {
      if (e.dead || hit.has(e)) continue;
      const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) break;
    state.bolts.push({ x1: from.x, y1: from.y, x2: best.x, y2: best.y, life: 0.15 });
    electricHit(best, dmg);
    hit.add(best);
    if (best.nodes) break;        // chạm Tesla -> bị hút vào cánh sao, ngừng nảy sang con khác
    from = best;
  }
}

// Kích hoạt hiệu ứng hệ mỗi khi viên 'b' nảy khỏi enemy 'e' (gọi TRƯỚC reflect)
function onBounce(b, e) {
  const fb = skillCur('fbounce');   // Fire Bounce: nổ lửa AoE tại điểm nảy
  if (fb) { aoeDamage(b.x, b.y, fb.r, fb.dmg * fireDmgMul()); spawnExplosion(b.x, b.y, ELEMENT_COLORS.fire); }

  const eb = skillCur('ebounce');   // Đá Dội: viên đạn mạnh dần
  if (eb) b.damage += eb.dmg;

  const wb = skillCur('wbounce');   // Gió Dội: tăng tốc (reflect giữ nguyên độ lớn vận tốc)
  if (wb) { b.vx *= (1 + wb.speedup); b.vy *= (1 + wb.speedup); }

  const elb = skillCur('elbounce'); // Sét Dội: phóng sét lan từ điểm nảy
  if (elb) chainLightning(e || { x: b.x, y: b.y }, elb.chain, elb.dmg);

  const ft = skillCur('ftrail');    // Vệt Lửa: để lại vệt lửa (capsule) dọc hướng đạn
  if (ft) {
    const ang = Math.atan2(b.vy, b.vx), hl = ft.len / 2;
    state.firezones.push({
      x1: b.x - Math.cos(ang) * hl, y1: b.y - Math.sin(ang) * hl,
      x2: b.x + Math.cos(ang) * hl, y2: b.y + Math.sin(ang) * hl,
      r: ft.r, dps: ft.dps * fireDmgMul(), remaining: ft.duration,
    });
  }

  const wg = skillCur('wgust');     // Cuồng Phong: đẩy NHẸ kẻ thù quanh điểm nảy
  if (wg) pushEnemiesFrom(b.x, b.y, wg.r, wg.push);

  runCustomSkills('onBounce', { enemy: e, bullet: b }); // Skill Lab: trigger "Khi nảy"
}


/* ---------------- SKILL LAB: engine diễn giải skill tự chế ---------------- */
function runCustomSkills(trigger, ctx) {
  for (const s of Store.skills) {
    if (!s.custom || s.trigger !== trigger || !hasSkill(s.id)) continue;
    if (trigger === 'everyShots') { if (state.shotCount % (s.every || 1) !== 0) continue; }
    else { if (Math.random() >= (s.chance || 0)) continue; }
    applyCustomEffect(s, ctx);
  }
}
function applyCustomEffect(s, ctx) {
  const p = s.params || {}, e = ctx.enemy;
  const x = e ? e.x : state.player.x, y = e ? e.y : state.player.y;
  switch (s.effect) {
    case 'chain': chainLightning(e || { x, y }, p.count, p.dmg); break;
    case 'burn':  if (e) e.burnStacks.push({ dps: p.dps, remaining: p.duration }); break;
    case 'aoe':   aoeDamage(x, y, p.r, p.dmg); break;
    case 'slow':  state.puddles.push({ x, y, r: p.r, slowFactor: p.factor, remaining: p.duration }); break;
    case 'knockback':
      if (e && ctx.bullet) { const L = Math.hypot(ctx.bullet.vx, ctx.bullet.vy) || 1; e.x += ctx.bullet.vx / L * p.knockback; e.y += ctx.bullet.vy / L * p.knockback; }
      break;
  }
}

// Khoảng cách từ điểm (px,py) tới đoạn thẳng (x1,y1)-(x2,y2) — cho vệt lửa capsule
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Gây dmg cho mọi kẻ thù trong bán kính r quanh (x,y)
function aoeDamage(x, y, r, dmg) {
  for (const o of state.enemies) {
    if (o.dead) continue;
    if (Math.hypot(o.x - x, o.y - y) <= r) {
      damageEnemy(o, dmg);
      if (o.hp <= 0 && !o.dead) { o.dead = true; onEnemyKilled(o); }
    }
  }
}

// Quá Tải: nổ điện gây dmg cho mọi kẻ thù trong bán kính r quanh 'center'
function electricBurst(center, r, dmg) {
  for (const o of state.enemies) {
    if (o === center || o.dead) continue;
    if (Math.hypot(o.x - center.x, o.y - center.y) <= r) {
      state.bolts.push({ x1: center.x, y1: center.y, x2: o.x, y2: o.y, life: 0.15 });
      electricHit(o, dmg);   // sét (bỏ qua insulate; arc cánh nếu là Tesla)
    }
  }
  state.rings.push({ x: center.x, y: center.y, r: 0, maxR: r, life: 0.3, dur: 0.3, color: ELEMENT_COLORS.electric });
}

// Sinh 2 viên con khi Tách rời kích hoạt
function spawnSplit(b, e) {
  const baseAng = Math.atan2(b.vy, b.vx);
  const speed = Math.hypot(b.vx, b.vy);
  for (const da of [0.6, -0.6]) { // ~±35°
    const ang = baseAng + da;
    state.bullets.push({
      x: e.x, y: e.y, px: e.x, py: e.y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      radius: 6, damage: b.damage,
      bouncesLeft: 0, pierceLeft: 0,
      alive: true, bounceCount: 0, hitSet: new Set([e]),
      elements: b.elements.slice(), color: b.color, noSplit: true,
      elecChain: 0, elecDmg: 0,
    });
  }
}

function onEnemyKilled(enemy) {
  state.exp += enemy.exp * expMul(); state.kills++;
  if (state.weapon && !state.ultReady) {        // nạp Ultimate theo số kill
    state.ultKills++;
    if (state.ultKills >= state.ultThreshold) state.ultReady = true;
  }
  if (enemy.belly && enemy.belly.length) releaseBelly(enemy); // Slime: nhả đạn đã ngậm
  runCustomSkills('onKill', { enemy }); // Skill Lab: trigger "Khi hạ gục"
  spawnExplosion(enemy.x, enemy.y, enemy.color);
}

// Nhả toàn bộ đạn trong bụng Slime ra tứ phía (thành đạn sống, bắn được kẻ khác)
function releaseBelly(e) {
  const n = e.belly.length;
  const speed = 420, P = state.player.stats;
  e.belly.forEach((stored, i) => {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.3;
    state.bullets.push({
      x: e.x, y: e.y, px: e.x, py: e.y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      radius: stored.radius || 6, damage: stored.damage,
      bouncesLeft: P.bulletBounces, pierceLeft: 0,
      alive: true, bounceCount: 0, hitSet: new Set(),
      elements: stored.elements || [], color: stored.color, noSplit: true,
      elecChain: 0, elecDmg: 0,
    });
  });
  e.belly = [];
}


/* ---------------- TƯỜNG NẢY (Wall) ---------------- */
// Sinh 1 bức tường ngẫu nhiên (ngang hoặc dọc) tồn tại 'duration' giây
function spawnWall(duration) {
  const em = earthZoneMul(); // Earth Sword: tường to/lâu hơn
  const horiz = Math.random() < 0.5;
  const len = 130 * em, thick = 16 * em;
  const w = horiz ? len : thick, h = horiz ? thick : len;
  const margin = 90;
  state.walls.push({
    x: margin + Math.random() * (VW - margin * 2),
    y: margin + Math.random() * (VH - margin * 2),
    w, h, remaining: duration * em,
  });
}

// Chặn enemy không cho đi xuyên tường: đẩy ra mép gần nhất (circle vs AABB).
function blockEnemyByWalls(e) {
  for (const w of state.walls) {
    const hw = w.w / 2, hh = w.h / 2;
    const cx = Math.max(w.x - hw, Math.min(e.x, w.x + hw)); // điểm gần nhất trên rìa tường
    const cy = Math.max(w.y - hh, Math.min(e.y, w.y + hh));
    const dx = e.x - cx, dy = e.y - cy;
    const d2 = dx * dx + dy * dy, r = e.radius;
    if (d2 >= r * r) continue; // không chạm
    const d = Math.sqrt(d2);
    if (d > 0.0001) {
      const push = r - d; e.x += dx / d * push; e.y += dy / d * push;
    } else {
      // tâm enemy lọt vào trong tường -> đẩy theo trục thâm nhập nhỏ nhất
      const penX = hw + r - Math.abs(e.x - w.x), penY = hh + r - Math.abs(e.y - w.y);
      if (penX < penY) e.x += (e.x < w.x ? -penX : penX);
      else             e.y += (e.y < w.y ? -penY : penY);
    }
  }
}

// Nảy viên đạn khỏi tường (AABB). Trả về true nếu có va chạm.
function bulletWallBounce(b, wall) {
  const minX = wall.x - wall.w / 2 - b.radius, maxX = wall.x + wall.w / 2 + b.radius;
  const minY = wall.y - wall.h / 2 - b.radius, maxY = wall.y + wall.h / 2 + b.radius;
  if (b.x < minX || b.x > maxX || b.y < minY || b.y > maxY) return false;
  const penL = b.x - minX, penR = maxX - b.x, penT = b.y - minY, penB = maxY - b.y;
  const m = Math.min(penL, penR, penT, penB);
  if (m === penL)      { b.vx = -Math.abs(b.vx); b.x = minX; }
  else if (m === penR) { b.vx =  Math.abs(b.vx); b.x = maxX; }
  else if (m === penT) { b.vy = -Math.abs(b.vy); b.y = minY; }
  else                 { b.vy =  Math.abs(b.vy); b.y = maxY; }
  return true;
}
