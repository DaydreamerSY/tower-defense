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
    // Backfill các field mới cho dữ liệu cũ (tránh lỗi khi save cũ chưa có map/moveSpeed)
    if (!this.balance.map) this.balance.map = clone(DEFAULT_BALANCE.map);
    if (this.balance.player.moveSpeed == null) this.balance.player.moveSpeed = DEFAULT_BALANCE.player.moveSpeed;
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
