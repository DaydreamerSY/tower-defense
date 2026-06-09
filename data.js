/* ============================================================================
   [data.js] KHO DỮ LIỆU (Store) + LƯU/TẢI + HELPER SCALING
   ----------------------------------------------------------------------------
   Phụ thuộc: config.js (DEFAULT_BALANCE, DEFAULT_SKILLS).
   - Store giữ dữ liệu đang dùng (balance / skills).
   - Tự lưu vào localStorage; có export/import JSON; reset về mặc định.
   - Các helper scaling (difficultyStep, makeEnemyStats, expForLevel...) đọc Store.
   ============================================================================ */

const STORAGE_KEY = 'shuriken_proto_v2';

// Sao chép sâu đơn giản (dữ liệu thuần JSON nên dùng được)
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

const Store = {
  balance: clone(DEFAULT_BALANCE),
  skills:  clone(DEFAULT_SKILLS),

  // Nạp từ localStorage (nếu có), không thì giữ mặc định
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.balance) this.balance = d.balance;
        if (d.skills)  this.skills  = d.skills;
        // Backfill field mới nếu data lưu cũ chưa có (tránh undefined)
        if (this.balance.enemySpeedMul === undefined) this.balance.enemySpeedMul = DEFAULT_BALANCE.enemySpeedMul;
        if (this.balance.miniboss === undefined) this.balance.miniboss = clone(DEFAULT_BALANCE.miniboss);
        // Bổ sung skill mới có trong config nhưng chưa có trong data đã lưu
        // (giữ nguyên tweak cũ, chỉ THÊM skill thiếu — không ghi đè giá trị).
        for (const def of DEFAULT_SKILLS) {
          if (!this.skills.find(s => s.id === def.id)) this.skills.push(clone(def));
        }
      }
    } catch (e) { /* localStorage có thể bị chặn khi mở file:// — bỏ qua, dùng mặc định */ }
  },

  // Lưu xuống localStorage
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        balance: this.balance, skills: this.skills,
      }));
    } catch (e) { /* bỏ qua nếu bị chặn */ }
  },

  // Xuất JSON (để sao lưu / chia sẻ config)
  exportJSON() {
    return JSON.stringify({ balance: this.balance, skills: this.skills }, null, 2);
  },

  // Nhập JSON; trả về true nếu hợp lệ
  importJSON(text) {
    try {
      const d = JSON.parse(text);
      if (!d.balance || !d.skills) return false;
      this.balance = d.balance; this.skills = d.skills;
      this.save();
      return true;
    } catch (e) { return false; }
  },

  // Reset toàn bộ về mặc định trong config.js
  reset() {
    this.balance = clone(DEFAULT_BALANCE);
    this.skills  = clone(DEFAULT_SKILLS);
    this.save();
  },

  // Tìm skill theo id
  getSkill(id) { return this.skills.find(s => s.id === id); },

  // Skill Lab: thêm skill tự chế
  addCustomSkill(skill) { this.skills.push(skill); this.save(); },
  // Xoá 1 skill (chỉ dùng cho custom)
  removeSkill(id) { this.skills = this.skills.filter(s => s.id !== id); this.save(); },
};
Store.load();


/* ---------------------------------------------------------------------------
   HELPER SCALING — đọc Store.balance (để chỉnh balance trong UI có hiệu lực ngay)
   --------------------------------------------------------------------------- */
function difficultyStep(elapsed) {
  return Math.floor(elapsed / Store.balance.difficulty.rampEvery);
}

function makeEnemyStats(typeKey, elapsed) {
  const t = Store.balance.enemyTypes[typeKey];
  const d = Store.balance.difficulty;
  const step = difficultyStep(elapsed);
  const hpMul = 1 + step * d.hpGrowthPerStep;
  const spMul = Math.min(d.speedCap, 1 + step * d.speedGrowthPerStep);
  const globalSpeed = Store.balance.enemySpeedMul ?? 1; // knob tốc độ toàn cục
  return {
    type: typeKey, shape: t.shape, color: t.color, radius: t.radius, exp: t.exp,
    maxHp: Math.round(t.baseHp * hpMul),
    hp:    Math.round(t.baseHp * hpMul),
    speed: t.baseSpeed * spMul * globalSpeed,
  };
}

// Chỉ số miniboss (HP cao, chậm) — scaling theo thời gian như mob thường
function makeMinibossStats(typeKey, elapsed) {
  const t = MINIBOSS_TYPES.find(m => m.id === typeKey) || MINIBOSS_TYPES[0];
  const d = Store.balance.difficulty;
  const step = difficultyStep(elapsed);
  const hpMul = 1 + step * d.hpGrowthPerStep;
  const spMul = Math.min(d.speedCap, 1 + step * d.speedGrowthPerStep);
  const globalSpeed = Store.balance.enemySpeedMul ?? 1;
  return {
    type: typeKey, shape: t.shape, color: t.color, radius: t.radius, exp: t.exp,
    maxHp: Math.round(t.baseHp * hpMul),
    hp:    Math.round(t.baseHp * hpMul),
    speed: t.baseSpeed * spMul * globalSpeed,
    isBoss: true, absorb: !!t.absorb, bellyMax: t.bellyMax || 7,
    insulate: t.insulate, nodes: t.nodes, tipCount: t.tipCount,   // Tesla
    mudWeak: t.mudWeak,                                           // Golem: ăn thêm dmg trong bùn
    deflect: t.deflect, pierceBonus: t.pierceBonus,               // Cyclone: thổi chệch / xuyên full
  };
}

function currentSpawnInterval(elapsed) {
  const d = Store.balance.difficulty;
  const step = difficultyStep(elapsed);
  return Math.max(d.spawnMin, d.spawnStart - step * d.spawnRampPerStep);
}

// EXP cần để vượt 'level' hiện tại (level 1 cần baseExp, sau đó +expStep mỗi cấp)
function expForLevel(level) {
  const L = Store.balance.level;
  return L.baseExp + L.expStep * (level - 1);
}
