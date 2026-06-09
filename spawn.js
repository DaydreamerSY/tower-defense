/* ============================================================================
   [spawn.js] SPAWN ENEMY
   ----------------------------------------------------------------------------
   Phụ thuộc: state.js (state), data.js (Store, makeEnemyStats), canvas.js (VW, VH).
   ============================================================================ */

function pickEnemyType() {
  const types = Store.balance.enemyTypes;
  const keys = Object.keys(types);
  let total = keys.reduce((s, k) => s + types[k].weight, 0);
  let r = Math.random() * total;
  for (const k of keys) { r -= types[k].weight; if (r <= 0) return k; }
  return keys[0];
}

// Vị trí ngẫu nhiên ngoài mép màn (cách mép `m` px)
function randomEdgePos(m) {
  const side = Math.floor(Math.random() * 4);
  if (side === 0)      return { x: Math.random() * VW, y: -m };
  else if (side === 1) return { x: VW + m, y: Math.random() * VH };
  else if (side === 2) return { x: Math.random() * VW, y: VH + m };
  else                 return { x: -m, y: Math.random() * VH };
}

function spawnEnemy() {
  const stats = makeEnemyStats(pickEnemyType(), state.elapsed);
  const p = randomEdgePos(30);
  state.enemies.push(Object.assign(stats, {
    x: p.x, y: p.y, burnStacks: [], hitFlash: 0, critFlash: 0, stunTimer: 0,
  }));
}

function spawnMiniboss() {
  const type = MINIBOSS_TYPES[Math.floor(Math.random() * MINIBOSS_TYPES.length)].id;
  const stats = makeMinibossStats(type, state.elapsed);
  const p = randomEdgePos(60);
  state.enemies.push(Object.assign(stats, {
    x: p.x, y: p.y, burnStacks: [], hitFlash: 0, critFlash: 0, stunTimer: 0, belly: [],
  }));
}
