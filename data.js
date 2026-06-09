/* ============================================================================
   [data.js] KHO DỮ LIỆU (Store) + LƯU/TẢI + DIỄN GIẢI HIỆU ỨNG
   ----------------------------------------------------------------------------
   Phụ thuộc: config.js (DEFAULT_BALANCE, DEFAULT_UPGRADES, DEFAULT_SETS).
   - Store giữ dữ liệu đang dùng (balance / upgrades / sets).
   - Tự lưu vào localStorage; có export/import JSON; reset về mặc định.
   - applyUpgrade(): "diễn giải" mảng effects thành thay đổi chỉ số.
   - Các helper scaling (difficultyStep, makeEnemyStats...) đọc Store.balance.
   ============================================================================ */

const STORAGE_KEY = 'shuriken_proto_v1';

// Sao chép sâu đơn giản (dữ liệu thuần JSON nên dùng được)
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

const Store = {
  balance:  clone(DEFAULT_BALANCE),
  upgrades: clone(DEFAULT_UPGRADES),
  sets:     clone(DEFAULT_SETS),
  activeSetId: DEFAULT_SETS[0].id,   // set dùng cho level (chọn trong màn Edit)

  // Nạp từ localStorage (nếu có), không thì giữ mặc định
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.balance)     this.balance  = d.balance;
        if (d.upgrades)    this.upgrades = d.upgrades;
        if (d.sets)        this.sets     = d.sets;
        if (d.activeSetId) this.activeSetId = d.activeSetId;
      }
    } catch (e) { /* localStorage có thể bị chặn khi mở file:// — bỏ qua, dùng mặc định */ }
    // Backfill các field mới cho dữ liệu cũ (tránh lỗi khi save cũ chưa có map/moveSpeed/miniboss)
    if (!this.balance.map) this.balance.map = clone(DEFAULT_BALANCE.map);
    if (this.balance.player.moveSpeed == null) this.balance.player.moveSpeed = DEFAULT_BALANCE.player.moveSpeed;
    if (!this.balance.miniboss) this.balance.miniboss = clone(DEFAULT_BALANCE.miniboss);
  },

  // Lưu xuống localStorage
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        balance: this.balance, upgrades: this.upgrades, sets: this.sets, activeSetId: this.activeSetId,
      }));
    } catch (e) { /* bỏ qua nếu bị chặn */ }
  },

  // Xuất JSON (để sao lưu / chia sẻ config)
  exportJSON() {
    return JSON.stringify({ balance: this.balance, upgrades: this.upgrades, sets: this.sets, activeSetId: this.activeSetId }, null, 2);
  },

  // Nhập JSON; trả về true nếu hợp lệ
  importJSON(text) {
    try {
      const d = JSON.parse(text);
      if (!d.balance || !d.upgrades || !d.sets) return false;
      this.balance = d.balance; this.upgrades = d.upgrades; this.sets = d.sets;
      if (d.activeSetId) this.activeSetId = d.activeSetId;
      this.save();
      return true;
    } catch (e) { return false; }
  },

  // Reset toàn bộ về mặc định trong config.js
  reset() {
    this.balance  = clone(DEFAULT_BALANCE);
    this.upgrades = clone(DEFAULT_UPGRADES);
    this.sets     = clone(DEFAULT_SETS);
    this.activeSetId = DEFAULT_SETS[0].id;
    this.save();
  },

  // Tìm upgrade theo id
  getUpgrade(id) { return this.upgrades.find(u => u.id === id); },

  // Set đang dùng cho level (fallback set đầu tiên nếu id không còn)
  getActiveSet() { return this.sets.find(s => s.id === this.activeSetId) || this.sets[0] || null; },
};
Store.load();


/* ---------------------------------------------------------------------------
   DIỄN GIẢI HIỆU ỨNG: biến mảng effects của 1 upgrade thành thay đổi chỉ số.
   P = state.player.stats  (đã có sẵn túi P.fx = {} để chứa hiệu ứng đặc biệt)
   --------------------------------------------------------------------------- */
function applyUpgrade(P, upgrade) {
  for (const e of (upgrade.effects || [])) {
    if (e.kind === 'stat') {
      if (e.op === 'add')      P[e.target] += e.value;
      else if (e.op === 'mul') P[e.target] *= e.value;
      else if (e.op === 'set') P[e.target]  = e.value;
    } else if (e.kind === 'fx') {
      if (e.fx === 'slow') {
        P.fx.slow = { factor: e.factor, duration: e.duration };
      } else if (e.fx === 'burn') {
        P.fx.burn = P.fx.burn || { dps: 0, duration: e.duration };
        P.fx.burn.dps += e.dps;            // cộng dồn dps
        P.fx.burn.duration = e.duration;
      } else if (e.fx === 'aoe') {
        P.fx.aoe = P.fx.aoe || { radius: e.radius, damage: 0 };
        P.fx.aoe.damage += e.damage;       // cộng dồn dmg
        P.fx.aoe.radius = e.radius;
      } else if (e.fx === 'chain') {       // sét lan (port từ khanhnl)
        P.fx.chain = P.fx.chain || { count: 0, dmg: 0 };
        P.fx.chain.count = Math.max(P.fx.chain.count, e.count);
        P.fx.chain.dmg += e.dmg;
      } else if (e.fx === 'stun') {        // tê liệt
        P.fx.stun = P.fx.stun || { chance: 0, duration: e.duration };
        P.fx.stun.chance = Math.min(1, P.fx.stun.chance + e.chance);
        P.fx.stun.duration = Math.max(P.fx.stun.duration, e.duration);
      } else if (e.fx === 'aura') {        // điện trường quanh người
        P.fx.aura = P.fx.aura || { radius: e.radius, dmg: 0 };
        P.fx.aura.dmg += e.dmg;
        P.fx.aura.radius = Math.max(P.fx.aura.radius, e.radius);
      } else if (e.fx === 'knockback') {   // đẩy lùi khi trúng
        P.fx.knockback = P.fx.knockback || { force: 0 };
        P.fx.knockback.force += e.force;
      } else if (e.fx === 'windpulse') {   // luồng gió định kỳ
        P.fx.windpulse = P.fx.windpulse || { every: e.every, r: e.r };
        P.fx.windpulse.every = Math.min(P.fx.windpulse.every, e.every);
        P.fx.windpulse.r = Math.max(P.fx.windpulse.r, e.r);

      // ----- Đạn nguyên tố (proc mỗi viên) -----
      } else if (e.fx === 'fireshot') {
        P.fx.fireshot = P.fx.fireshot || { chance: 0, bonus: 0 };
        P.fx.fireshot.chance = Math.min(1, P.fx.fireshot.chance + e.chance);
        P.fx.fireshot.bonus += e.bonus;
      } else if (e.fx === 'windshot') {
        P.fx.windshot = P.fx.windshot || { chance: 0, pierce: 0 };
        P.fx.windshot.chance = Math.min(1, P.fx.windshot.chance + e.chance);
        P.fx.windshot.pierce += e.pierce;
      } else if (e.fx === 'earthshot') {
        P.fx.earthshot = P.fx.earthshot || { chance: 0, r: e.r, slowFactor: e.slowFactor, duration: e.duration };
        P.fx.earthshot.chance = Math.min(1, P.fx.earthshot.chance + e.chance);
        P.fx.earthshot.r = Math.max(P.fx.earthshot.r, e.r);
        P.fx.earthshot.slowFactor = Math.min(P.fx.earthshot.slowFactor, e.slowFactor);
        P.fx.earthshot.duration = Math.max(P.fx.earthshot.duration, e.duration);
      } else if (e.fx === 'lightningshot') {
        P.fx.lightningshot = P.fx.lightningshot || { chance: 0, chain: 0, dmg: 0 };
        P.fx.lightningshot.chance = Math.min(1, P.fx.lightningshot.chance + e.chance);
        P.fx.lightningshot.chain = Math.max(P.fx.lightningshot.chain, e.chain);
        P.fx.lightningshot.dmg += e.dmg;

      // ----- Skill khi nảy -----
      } else if (e.fx === 'fbounce') {
        P.fx.fbounce = P.fx.fbounce || { r: e.r, dmg: 0 };
        P.fx.fbounce.dmg += e.dmg; P.fx.fbounce.r = Math.max(P.fx.fbounce.r, e.r);
      } else if (e.fx === 'ftrail') {
        P.fx.ftrail = P.fx.ftrail || { r: e.r, dps: 0, duration: e.duration };
        P.fx.ftrail.dps += e.dps; P.fx.ftrail.r = Math.max(P.fx.ftrail.r, e.r); P.fx.ftrail.duration = Math.max(P.fx.ftrail.duration, e.duration);
      } else if (e.fx === 'wgust') {
        P.fx.wgust = P.fx.wgust || { r: 0 };
        P.fx.wgust.r = Math.max(P.fx.wgust.r, e.r);
      } else if (e.fx === 'ebounce') {
        P.fx.ebounce = P.fx.ebounce || { dmg: 0 };
        P.fx.ebounce.dmg += e.dmg;
      } else if (e.fx === 'elbounce') {
        P.fx.elbounce = P.fx.elbounce || { chain: 0, dmg: 0 };
        P.fx.elbounce.chain = Math.max(P.fx.elbounce.chain, e.chain); P.fx.elbounce.dmg += e.dmg;
      } else if (e.fx === 'wbounce') {
        P.fx.wbounce = P.fx.wbounce || { speedup: 0 };
        P.fx.wbounce.speedup += e.speedup;

      // ----- Skill hỗ trợ -----
      } else if (e.fx === 'crit') {
        P.fx.crit = P.fx.crit || { chance: 0 };
        P.fx.crit.chance = Math.min(1, P.fx.crit.chance + e.chance);
      } else if (e.fx === 'overload') {
        P.fx.overload = P.fx.overload || { r: e.r, dmg: 0 };
        P.fx.overload.dmg += e.dmg; P.fx.overload.r = Math.max(P.fx.overload.r, e.r);
      } else if (e.fx === 'split') {
        P.fx.split = { chance: e.chance };
      } else if (e.fx === 'scoreboost') {
        P.fx.scoreboost = P.fx.scoreboost || { gain: 0 };
        P.fx.scoreboost.gain += e.gain;
      } else if (e.fx === 'wall') {
        P.fx.wall = { count: e.count, duration: e.duration, cooldown: e.cooldown };
      }
    }
  }
}


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
  return {
    type: typeKey, shape: t.shape, color: t.color, radius: t.radius, score: t.score,
    cell: t.cell,            // có giá trị với khối tetromino (px/ô); undefined với loại khác
    maxHp: Math.round(t.baseHp * hpMul),
    hp:    Math.round(t.baseHp * hpMul),
    speed: t.baseSpeed * spMul,
  };
}

function currentSpawnInterval(elapsed) {
  const d = Store.balance.difficulty;
  const step = difficultyStep(elapsed);
  return Math.max(d.spawnMin, d.spawnStart - step * d.spawnRampPerStep);
}

// Chỉ số miniboss — HP cao, scaling theo thời gian như quái thường
function makeMinibossStats(typeKey, elapsed) {
  const t = MINIBOSS_TYPES.find(m => m.id === typeKey) || MINIBOSS_TYPES[0];
  const d = Store.balance.difficulty;
  const step = difficultyStep(elapsed);
  const hpMul = 1 + step * d.hpGrowthPerStep;
  const spMul = Math.min(d.speedCap, 1 + step * d.speedGrowthPerStep);
  return {
    type: typeKey, name: t.name, shape: t.shape, color: t.color, radius: t.radius, score: t.score,
    maxHp: Math.round(t.baseHp * hpMul),
    hp:    Math.round(t.baseHp * hpMul),
    speed: t.baseSpeed * spMul,
    isBoss: true, absorb: !!t.absorb, insulate: t.insulate || 1,
    mudWeak: t.mudWeak || 0, deflect: t.deflect || 0,
  };
}
