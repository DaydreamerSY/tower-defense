/* ============================================================================
   [render.js] VẼ KHUNG HÌNH (vũng bùn, enemy, đạn, player, HUD)
   ----------------------------------------------------------------------------
   Phụ thuộc: canvas.js (ctx, VW, VH), state.js (state, lastAim, Game),
   skills.js (bulletSecondaryColor), config.js (ELEMENT_COLORS),
   data.js (difficultyStep).
   ============================================================================ */

function drawEnemy(e) {
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.fillStyle = e.critFlash > 0 ? ELEMENT_COLORS.crit : (e.hitFlash > 0 ? '#ffffff' : e.color);
  ctx.strokeStyle = '#2b2f38'; ctx.lineWidth = e.isBoss ? 4 : 2;
  if (e.absorb) ctx.globalAlpha = 0.5; // Slime: thân trong suốt
  const r = e.radius;
  if (e.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill(); ctx.stroke(); }
  else if (e.shape === 'square') { ctx.beginPath(); ctx.rect(-r,-r,r*2,r*2); ctx.fill(); ctx.stroke(); }
  else if (e.shape === 'hexagon') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI/6 + i*Math.PI/3, px = Math.cos(a)*r, py = Math.sin(a)*r; i ? ctx.lineTo(px,py) : ctx.moveTo(px,py); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  else if (e.shape === 'star') {
    const spikes = 5, inner = r * 0.45;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 ? inner : r, a = -Math.PI/2 + i * Math.PI / spikes;
      const px = Math.cos(a)*rad, py = Math.sin(a)*rad;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  else { ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(r,r); ctx.lineTo(-r,r); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // đạn đã ngậm trong "bụng" (toạ độ tương đối trong local space)
  if (e.belly && e.belly.length) {
    for (const b of e.belly) {
      ctx.fillStyle = b.color || '#2b2f38';
      ctx.beginPath(); ctx.arc(b.ox, b.oy, (b.radius || 6), 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
  // dấu tê liệt: viền vàng quanh enemy
  if (e.stunTimer > 0) {
    ctx.strokeStyle = ELEMENT_COLORS.electric; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 4, 0, Math.PI*2); ctx.stroke();
  }
  if (e.hp < e.maxHp || e.isBoss) {
    const w = e.radius*2, hpw = w*Math.max(0,e.hp)/e.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(e.x-w/2, e.y-e.radius-9, w, 4);
    ctx.fillStyle = '#34c759'; ctx.fillRect(e.x-w/2, e.y-e.radius-9, hpw, 4);
  }
  // số máu trên block
  const hpNum = Math.ceil(Math.max(0, e.hp));
  ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = '#ffffff';
  ctx.strokeText(hpNum, e.x, e.y); ctx.fillText(hpNum, e.x, e.y);
  ctx.textBaseline = 'alphabetic';
}

function drawBullet(b) {
  ctx.fillStyle = b.color;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2); ctx.fill();
  // viên đa hệ: viền màu hệ phụ
  if (b.elements && b.elements.length >= 2) {
    const sec = bulletSecondaryColor(b.elements);
    if (sec) { ctx.strokeStyle = sec; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 2, 0, Math.PI*2); ctx.stroke(); }
  }
}

function render() {
  ctx.clearRect(0, 0, VW, VH);

  // vũng bùn (lớp nền)
  for (const p of state.puddles) {
    ctx.globalAlpha = 0.35; ctx.fillStyle = ELEMENT_COLORS.earth;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
  }
  // vệt lửa (capsule: đoạn thẳng bo tròn 2 đầu)
  ctx.lineCap = 'round'; ctx.strokeStyle = ELEMENT_COLORS.fire;
  for (const z of state.firezones) {
    ctx.globalAlpha = 0.30 * Math.min(1, z.remaining); ctx.lineWidth = z.r * 2;
    ctx.beginPath(); ctx.moveTo(z.x1, z.y1); ctx.lineTo(z.x2, z.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';

  // tường nảy (mờ dần khi sắp hết hạn)
  for (const wall of state.walls) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.min(1, wall.remaining);
    ctx.fillStyle = '#5b6270'; ctx.strokeStyle = '#2b2f38'; ctx.lineWidth = 2;
    ctx.fillRect(wall.x - wall.w/2, wall.y - wall.h/2, wall.w, wall.h);
    ctx.strokeRect(wall.x - wall.w/2, wall.y - wall.h/2, wall.w, wall.h);
  }
  ctx.globalAlpha = 1;

  // Earth Prison (ult): vòng đất
  if (state.prison) {
    const pr = state.prison;
    ctx.globalAlpha = 0.15; ctx.fillStyle = ELEMENT_COLORS.earth;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.85; ctx.strokeStyle = ELEMENT_COLORS.earth; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Wind Tornado (ult): lốc xoáy
  if (state.tornado) {
    const t = state.tornado;
    ctx.globalAlpha = 0.22; ctx.fillStyle = ELEMENT_COLORS.wind;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.7; ctx.strokeStyle = ELEMENT_COLORS.wind; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.6, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // quầng Trường Tĩnh Điện quanh player (nền)
  const aura = skillCur('elec3');
  if (aura && state) {
    ctx.globalAlpha = 0.10; ctx.fillStyle = ELEMENT_COLORS.electric;
    ctx.beginPath(); ctx.arc(state.player.x, state.player.y, aura.r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // vòng lan (luồng gió / nổ điện)
  for (const ring of state.rings) {
    ctx.globalAlpha = Math.max(0, ring.life / (ring.dur || 0.4)) * 0.6;
    ctx.strokeStyle = ring.color || ELEMENT_COLORS.wind;
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI*2); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // tia sét (Đạn Sét / Trường điện / Quá Tải)
  ctx.strokeStyle = ELEMENT_COLORS.electric; ctx.lineWidth = 2.5;
  for (const blt of state.bolts) {
    ctx.globalAlpha = Math.max(0, blt.life / 0.15);
    ctx.beginPath(); ctx.moveTo(blt.x1, blt.y1); ctx.lineTo(blt.x2, blt.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // particles nổ
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life/0.4); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  state.enemies.forEach(drawEnemy);
  state.bullets.forEach(drawBullet);

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
  // Level (trái) + thời gian (phải)
  ctx.fillStyle = '#2b2f38'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`Cấp ${state.level}`, 16, 38);
  const m = Math.floor(state.elapsed/60), s = Math.floor(state.elapsed%60);
  ctx.textAlign = 'right'; ctx.fillText(`${m}:${s.toString().padStart(2,'0')}`, VW-16, 38);

  // Cảnh báo miniboss: 10s trước khi xuất hiện, nằm bên trái đồng hồ (nhấp nháy)
  const lead = state.nextBossAt - state.elapsed;
  if (lead > 0 && lead <= 10 && Math.floor(state.elapsed * 2) % 2 === 0) {
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#ff5277';
    ctx.fillText('Miniboss is coming!', VW - 95, 24);
  }

  // Thanh EXP
  const bx = 16, by = 50, bw = VW-32, bh = 11;
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#4c8dff'; ctx.fillRect(bx, by, bw * Math.min(1, state.exp/state.expToNext), bh);

  // Hạ gục (trái) + độ khó (phải)
  ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#6b7280';
  ctx.textAlign = 'left';  ctx.fillText(`Hạ: ${state.kills}`, 16, 82);
  ctx.textAlign = 'right'; ctx.fillText(`Độ khó: ${difficultyStep(state.elapsed)+1}`, VW-16, 82);

  // Tích lũy Luồng gió (Wind2) — chỉ hiện khi đang sở hữu
  const w2 = skillCur('wind2');
  if (w2) {
    const prog = state.shotCount % w2.every;
    ctx.textAlign = 'left'; ctx.fillStyle = ELEMENT_COLORS.wind;
    ctx.fillText(`Luồng gió: ${prog}/${w2.every}`, 16, 106);
    const gx = 150, gy = 95, gw = 140, gh = 9;
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = ELEMENT_COLORS.wind; ctx.fillRect(gx, gy, gw * prog / w2.every, gh);
  }

  // Thanh nạp ULTIMATE (đáy màn) — chỉ khi đã chọn vũ khí
  if (state.weapon) {
    const w = state.weapon, need = state.ultThreshold;
    const ux = 16, uy = VH - 26, uw = VW - 32, uh = 14;
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(ux, uy, uw, uh);
    const frac = state.ultReady ? 1 : Math.min(1, state.ultKills / need);
    ctx.fillStyle = w.color; ctx.fillRect(ux, uy, uw * frac, uh);
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = state.ultReady ? w.color : '#6b7280';
    ctx.fillText(state.ultReady ? `TAP! ${w.ultName} sẵn sàng` : `ULT ${Math.floor(state.ultKills)}/${need}`, VW/2, uy - 6);
    ctx.textAlign = 'left';
  }
}
