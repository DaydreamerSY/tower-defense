/* ============================================================================
   [update.js] CẬP NHẬT LOGIC MỖI KHUNG HÌNH
   ----------------------------------------------------------------------------
   Phụ thuộc: state.js, combat.js (fire/reflect/damageEnemy/bulletHit/
   onEnemyKilled), spawn.js (spawnEnemy), levelup.js (offerLevelUp),
   lifecycle.js (gameOver), data.js (currentSpawnInterval, expForLevel).
   ============================================================================ */

function update(dt) {
  state.elapsed += dt;

  updateAim(); // hướng ngắm (auto-play mô phỏng đường đạn / hoặc theo chuột)

  state.player.fireTimer -= dt;
  if (state.player.fireTimer <= 0) { fire(); state.player.fireTimer = state.player.stats.fireCooldown; }

  const bossAlive = state.enemies.some(e => e.isBoss);
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    let si = currentSpawnInterval(state.elapsed);
    if (bossAlive) si *= (Store.balance.miniboss.sparseMul ?? 1); // có boss -> quái thường thưa lại
    state.spawnTimer = si;
  }
  // Miniboss theo mốc thời gian
  if (state.elapsed >= state.nextBossAt) {
    spawnMiniboss();
    state.nextBossAt += Store.balance.miniboss.every;
  }

  // Đạn bay
  for (const b of state.bullets) {
    b.px = b.x; b.py = b.y;             // lưu vị trí trước khi di chuyển (cho reflect chính xác)
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.x < 0 || b.x > VW) { b.vx *= -1; b.x = Math.max(0, Math.min(VW, b.x)); }
    if (b.y < 0 || b.y > VH) { b.vy *= -1; b.y = Math.max(0, Math.min(VH, b.y)); }
    // Earth Prison: đạn nảy lại vào trong vòng (không bay ra ngoài)
    if (state.prison) {
      const pr = state.prison, dx = b.x - pr.x, dy = b.y - pr.y, d = Math.hypot(dx, dy);
      if (d > pr.r - b.radius && d > 0) {
        const nx = dx / d, ny = dy / d, dot = b.vx * nx + b.vy * ny;
        if (dot > 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
        b.x = pr.x + nx * (pr.r - b.radius - 0.5); b.y = pr.y + ny * (pr.r - b.radius - 0.5);
      }
    }
  }

  // Nảy đạn khỏi Tường Nảy (tính như 1 lần nảy, kích hiệu ứng on-bounce)
  if (state.walls.length) {
    for (const b of state.bullets) {
      if (b.bouncesLeft <= 0) continue;
      for (const wall of state.walls) {
        if (bulletWallBounce(b, wall)) { onBounce(b, null); b.bouncesLeft--; b.hitSet.clear(); break; }
      }
    }
  }

  // Vũng bùn (Earth1) giảm thời gian
  for (const p of state.puddles) p.remaining -= dt;
  state.puddles = state.puddles.filter(p => p.remaining > 0);

  // Vùng lửa (Vệt Lửa) giảm thời gian
  for (const z of state.firezones) z.remaining -= dt;
  state.firezones = state.firezones.filter(z => z.remaining > 0);

  // Tường Nảy: sinh định kỳ + giảm thời gian
  const wsk = skillCur('wall');
  if (wsk) {
    state.wallTimer += dt;
    if (state.wallTimer >= wsk.cooldown) {
      state.wallTimer = 0;
      for (let i = 0; i < wsk.count; i++) spawnWall(wsk.duration);
    }
  }
  for (const wall of state.walls) wall.remaining -= dt;
  state.walls = state.walls.filter(w => w.remaining > 0);

  // Earth Prison (ult): hết giờ hoặc sạch địch trong vòng -> tan
  if (state.prison) {
    const pr = state.prison; pr.remaining -= dt;
    let inside = 0;
    for (const e of state.enemies) if (!e.dead && Math.hypot(e.x - pr.x, e.y - pr.y) <= pr.r) inside++;
    if (inside > 0) pr.hadInside = true;                       // đã nhốt được quái
    // Tan khi: hết giờ HOẶC (đã từng nhốt quái và giờ đã dọn sạch)
    if (pr.remaining <= 0 || (pr.hadInside && inside === 0)) state.prison = null;
  }

  // Wind Tornado (ult): di chuyển, hút & gây sát thương
  if (state.tornado) {
    const t = state.tornado; t.remaining -= dt;
    t.x += t.vx * dt; t.y += t.vy * dt;
    if (t.x < t.r || t.x > VW - t.r) t.vx *= -1;
    if (t.y < t.r || t.y > VH - t.r) t.vy *= -1;
    t.x = Math.max(t.r, Math.min(VW - t.r, t.x)); t.y = Math.max(t.r, Math.min(VH - t.r, t.y));
    for (const e of state.enemies) {
      if (e.dead) continue;
      const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
      if (d < t.r && d > 0) {
        e.x += dx / d * 120 * dt; e.y += dy / d * 120 * dt; // hút vào tâm
        damageEnemy(e, 4 * dt);
        if (e.hp <= 0 && !e.dead) { e.dead = true; onEnemyKilled(e); }
      }
    }
    if (t.remaining <= 0) state.tornado = null;
  }

  // Vòng lan (Luồng gió / nổ điện) — chỉ hiệu ứng nhìn
  for (const ring of state.rings) { ring.r = ring.maxR * (1 - Math.max(0, ring.life) / (ring.dur || 0.4)); ring.life -= dt; }
  state.rings = state.rings.filter(r => r.life > 0);

  // Tia sét — giảm thời gian
  for (const blt of state.bolts) blt.life -= dt;
  state.bolts = state.bolts.filter(b => b.life > 0);

  // Trường Tĩnh Điện (Elec3): mỗi 0.5s giật kẻ thù quanh player
  const aura = skillCur('elec3');
  if (aura) {
    state.auraTimer += dt;
    if (state.auraTimer >= 0.5) {
      state.auraTimer = 0;
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - state.player.x, e.y - state.player.y) <= aura.r) {
          state.bolts.push({ x1: state.player.x, y1: state.player.y, x2: e.x, y2: e.y, life: 0.15 });
          electricHit(e, aura.dmg);   // sét: bỏ qua insulate, arc cánh nếu là Tesla
        }
      }
    }
  }

  // Enemy di chuyển + bùn làm chậm + bỏng cộng dồn
  for (const e of state.enemies) {
    let spd = e.speed;
    for (const p of state.puddles) {
      if (Math.hypot(e.x - p.x, e.y - p.y) <= p.r) spd = Math.min(spd, e.speed * p.slowFactor);
    }
    if (e.stunTimer > 0) { e.stunTimer -= dt; spd = 0; } // Tê Liệt: đứng hình
    const ang = Math.atan2(state.player.y - e.y, state.player.x - e.x);
    e.x += Math.cos(ang) * spd * dt; e.y += Math.sin(ang) * spd * dt;
    if (state.walls.length) blockEnemyByWalls(e); // Tường Nảy cũng chặn quái
    if (state.prison) {                            // Earth Prison: rào cản 2 chiều
      const pr = state.prison, dx = e.x - pr.x, dy = e.y - pr.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
      if (d <= pr.r) {                             // đang ở TRONG -> giữ lại trong (không thoát ra)
        const lim = pr.r - e.radius;
        if (d > lim) { e.x = pr.x + nx * lim; e.y = pr.y + ny * lim; }
      } else {                                     // đang ở NGOÀI -> chặn, không cho bước vào
        const lim = pr.r + e.radius;
        if (d < lim) { e.x = pr.x + nx * lim; e.y = pr.y + ny * lim; }
      }
    }

    if (e.burnStacks.length) {
      let total = 0;
      for (const s of e.burnStacks) { s.remaining -= dt; if (s.remaining > 0) total += s.dps; }
      e.burnStacks = e.burnStacks.filter(s => s.remaining > 0);
      if (total > 0) {
        damageEnemy(e, total * dt);
        if (e.hp <= 0 && !e.dead) { e.dead = true; onEnemyKilled(e); }
      }
    }

    // Vùng lửa đốt máu enemy đứng trong
    if (state.firezones.length && !e.dead) {
      let fdps = 0;
      for (const z of state.firezones) if (distToSeg(e.x, e.y, z.x1, z.y1, z.x2, z.y2) <= z.r) fdps += z.dps;
      if (fdps > 0) {
        damageEnemy(e, fdps * dt);
        if (e.hp <= 0 && !e.dead) { e.dead = true; onEnemyKilled(e); }
      }
    }

    // Slime "tiêu hoá" đạn -> cháy theo MỨC ĐẦU TƯ HỆ LỬA của người chơi
    // (build lửa càng nặng + ngậm càng nhiều viên -> tan càng nhanh; không phụ thuộc viên nào ngậm)
    if (e.belly && e.belly.length && !e.dead) {
      const fi = fireInvest();
      if (fi > 0) {
        damageEnemy(e, e.belly.length * fi * 0.3 * dt * fireDmgMul());
        if (e.hp <= 0 && !e.dead) { e.dead = true; onEnemyKilled(e); }
      }
    }

    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.critFlash > 0) e.critFlash -= dt;
    if (Math.hypot(e.x - state.player.x, e.y - state.player.y) < e.radius + state.player.radius) { gameOver(); return; }
  }

  // Va chạm đạn ↔ enemy
  for (const b of state.bullets) {
    for (const e of state.enemies) {
      if (e.dead || b.hitSet.has(e)) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
        bulletHit(b, e);
        if (e.absorb && e.belly && e.belly.length < (e.bellyMax || 7)) {
          // Slime ngậm đạn (bụng còn chỗ): lưu vào bụng để thả ra khi chết, không nảy/xuyên
          e.belly.push({
            damage: b.damage, elements: b.elements.slice(), color: b.color, radius: b.radius,
            ox: (Math.random() * 2 - 1) * e.radius * 0.55, oy: (Math.random() * 2 - 1) * e.radius * 0.55,
          });
          // Có Fire Trail -> mỗi viên ngậm để lại vệt lửa NGẮN dẫn tới miệng boss
          const ft = skillCur('ftrail');
          if (ft) {
            const dx = b.x - e.x, dy = b.y - e.y, d = Math.hypot(dx, dy) || 1;
            const ex = e.x + dx / d * e.radius, ey = e.y + dy / d * e.radius; // điểm "miệng" (mép boss)
            const vl = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / vl, uy = b.vy / vl;
            const slen = Math.min(ft.len * 0.5, 70);
            state.firezones.push({ x1: ex - ux * slen, y1: ey - uy * slen, x2: ex, y2: ey, r: ft.r, dps: ft.dps * fireDmgMul(), remaining: ft.duration });
          }
          b.life = 0;
        } else {
          // Bụng đầy (hoặc enemy thường): nảy/xuyên bình thường, kích mọi hiệu ứng
          const inPrison = state.prison && Math.hypot(b.x - state.prison.x, b.y - state.prison.y) < state.prison.r;
          if (b.pierceLeft > 0) { b.pierceLeft--; }
          else if (b.bouncesLeft > 0 || inPrison) {  // trong Prison: nảy vô hạn
            onBounce(b, e); reflect(b, e);
            if (!inPrison) b.bouncesLeft--;
            b.hitSet.clear(); b.hitSet.add(e);
          }
          else { b.life = 0; }
        }
        break;
      }
    }
  }

  state.bullets = state.bullets.filter(b => b.life > 0);
  state.enemies = state.enemies.filter(e => !e.dead);
  for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  state.particles = state.particles.filter(p => p.life > 0);

  // Lên cấp: dồn nhiều cấp nếu nhặt đủ EXP một lúc
  while (state.exp >= state.expToNext) {
    state.exp -= state.expToNext;
    state.level++;
    state.levelUps++;
    state.pendingLevelUps++;
    state.expToNext = expForLevel(state.level);
  }
  if (state.pendingLevelUps > 0 && !state.paused) offerLevelUp();
}
