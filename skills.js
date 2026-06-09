/* ============================================================================
   [skills.js] TRUY VẤN SKILL + CHỈ SỐ PHÁI SINH
   ----------------------------------------------------------------------------
   Phụ thuộc: state.js (state), data.js (Store), config.js (ELEMENT_*).
   Cung cấp toàn cục: skillLvl(), skillCur(), hasSkill(), learnSkill(),
   bulletSpeedMul(), critRoll(), bulletColor(), describeSkill(), elementLabel().
   ============================================================================ */

// Mốc đang sở hữu của skill (0 = chưa có)
function skillLvl(id) { return state.skillLevels[id] || 0; }
function hasSkill(id) { return skillLvl(id) > 0; }

// Tham số mốc HIỆN TẠI của skill (null nếu chưa sở hữu)
function skillCur(id) {
  const lvl = skillLvl(id);
  if (!lvl) return null;
  const s = Store.getSkill(id);
  return s ? s.levels[lvl - 1] : null;
}

// Học / nâng skill thêm 1 mốc (không vượt maxLevel)
function learnSkill(id) {
  const s = Store.getSkill(id);
  if (!s) return;
  const cur = skillLvl(id);
  if (cur < s.maxLevel) state.skillLevels[id] = cur + 1;
}


/* ---------------- CHỈ SỐ PHÁI SINH ---------------- */

// Hệ số tốc độ đạn = Tốc-độ-bay × (Đạn nặng → 0.8)
function bulletSpeedMul() {
  let mul = 1;
  const spd = skillCur('spd');     if (spd)   mul *= spd.mul;
  const e2  = skillCur('earth2');  if (e2)    mul *= e2.speedMul;
  return mul;
}

// Roll bạo kích cho 1 đòn trúng
function critRoll() {
  const c = skillCur('crit');
  return !!(c && Math.random() < c.chance);
}

// Hệ số EXP nhận được (Hấp thu EXP)
function expMul() {
  const g = skillCur('expgain');
  return 1 + (g ? g.gain : 0);
}

// Mức đầu tư hệ LỬA (tổng cấp các skill lửa) — dùng cho boss phản ứng theo build
function fireInvest() {
  return skillLvl('fire1') + skillLvl('fire2') + skillLvl('fbounce') + skillLvl('ftrail');
}


/* ---------------- MÀU ĐẠN THEO HỆ ---------------- */

// Màu chính theo thứ tự ưu tiên Lửa → Đất → Gió; không hệ -> đen
function bulletColor(elements) {
  for (const el of ELEMENT_PRIORITY) {
    if (elements.includes(el)) return ELEMENT_COLORS[el];
  }
  return ELEMENT_COLORS.normal;
}

// Màu hệ phụ (hệ kế tiếp theo ưu tiên) để vẽ viền cho viên đa hệ
function bulletSecondaryColor(elements) {
  let found = 0;
  for (const el of ELEMENT_PRIORITY) {
    if (elements.includes(el)) { found++; if (found === 2) return ELEMENT_COLORS[el]; }
  }
  return null;
}


/* ---------------- NHÃN & MÔ TẢ (cho thẻ chọn skill) ---------------- */
function elementLabel(element) {
  return ({ fire:'Hệ Lửa', wind:'Hệ Gió', earth:'Hệ Đất', electric:'Hệ Điện', support:'Phụ trợ' })[element] || '';
}

// Mô tả cụ thể theo mốc 'level' sắp nhận (1-based)
function describeSkill(s, level) {
  const L = s.levels[level - 1];
  if (!L) return s.desc;
  const P = s.levels[level - 2] || null; // mốc hiện tại (null nếu đang là MỚI)
  const hl = (key, text) => (P && P[key] !== L[key]) ? `<span class="hl">${text}</span>` : `${text}`;
  const pct = (key) => hl(key, Math.round(L[key] * 100) + '%');
  switch (s.id) {
    case 'fire1':  return `Mỗi đòn trúng +1 stack bỏng: ${hl('dps', L.dps)} dmg/giây trong ${hl('duration', L.duration + 's')} (cộng dồn).`;
    case 'fire2':  return `${pct('chance')} viên hóa đạn lửa, +${hl('bonus', L.bonus)} sát thương.`;
    case 'wind1':  return `${pct('chance')} viên hóa đạn gió, xuyên thêm ${hl('pierce', L.pierce)} kẻ thù.`;
    case 'wind2':  return `Mỗi ${hl('every', L.every)} phát bắn tạo luồng gió đẩy kẻ thù trong bán kính ${hl('r', L.r)}.`;
    case 'earth1': return `${pct('chance')} viên hóa đạn đất: vũng bùn r=${hl('r', L.r)}, chậm còn ${hl('slowFactor', Math.round(L.slowFactor*100) + '%')} tốc độ trong ${hl('duration', L.duration + 's')}.`;
    case 'earth2': return `Đẩy lùi kẻ thù ${hl('knockback', L.knockback)}px khi trúng (tốc độ bay ${hl('speedMul', '−' + Math.round((1 - L.speedMul) * 100) + '%')}).`;
    case 'spd':    return `Tốc độ đạn ×${hl('mul', L.mul.toFixed(2))}.`;
    case 'crit':   return `${pct('chance')} gây gấp đôi sát thương gốc.`;
    case 'split':  return `${pct('chance')} khi trúng, viên đạn tách làm đôi.`;
    case 'expgain':return `+${hl('gain', Math.round(L.gain*100) + '%')} EXP nhận được khi hạ gục.`;
    case 'elec1':  return `${pct('chance')} viên hóa sét, trúng thì lan sang ${hl('chain', L.chain)} kẻ thù gần (${hl('dmg', L.dmg)} dmg).`;
    case 'elec2':  return `${pct('chance')} đòn trúng làm kẻ thù tê liệt ${hl('duration', L.duration + 's')}.`;
    case 'elec3':  return `Mỗi 0.5s giật ${hl('dmg', L.dmg)} dmg lên kẻ thù trong bán kính ${hl('r', L.r)}.`;
    case 'elec4':  return `Trúng kẻ thù đang tê liệt gây nổ điện ${hl('dmg', L.dmg)} dmg quanh bán kính ${hl('r', L.r)}.`;
    case 'fbounce':return `Mỗi lần đạn nảy gây nổ lửa ${hl('dmg', L.dmg)} dmg quanh bán kính ${hl('r', L.r)}.`;
    case 'wbounce':return `+${hl('bounces', L.bounces)} lần nảy; mỗi lần nảy đạn tăng tốc ${hl('speedup', Math.round(L.speedup*100) + '%')}.`;
    case 'ebounce':return `Mỗi lần đạn nảy +${hl('dmg', L.dmg)} sát thương cho viên đó.`;
    case 'elbounce':return `Mỗi lần đạn nảy phóng sét lan ${hl('chain', L.chain)} kẻ thù (${hl('dmg', L.dmg)} dmg).`;
    case 'ftrail': return `Mỗi lần đạn nảy để lại vệt lửa dài ${hl('len', L.len)} (dày ${hl('r', L.r)}), ${hl('dps', L.dps)} dmg/giây trong ${hl('duration', L.duration + 's')}.`;
    case 'wgust':  return `Mỗi lần đạn nảy đẩy kẻ thù trong bán kính ${hl('r', L.r)} ra xa ${hl('push', L.push)}px.`;
    case 'wall':   return `Mỗi ${hl('cooldown', L.cooldown + 's')} tạo ${hl('count', L.count)} bức tường (tồn tại ${hl('duration', L.duration + 's')}): đạn nảy thêm + chặn kẻ thù.`;
    default:       return s.desc;
  }
}
