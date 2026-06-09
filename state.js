/* ============================================================================
   [state.js] TRẠNG THÁI GAME + CỜ ĐIỀU KHIỂN VÒNG ĐỜI
   ----------------------------------------------------------------------------
   Phụ thuộc: canvas.js (VW, VH), data.js (Store, expForLevel).
   Cung cấp toàn cục: Game, state, lastAim, freshPlayerStats(), initState().
   ============================================================================ */

// --- Cờ điều khiển vòng đời (nav bật/tắt khi đổi tab) ---
const Game = {
  active: false,    // có đang ở màn Play không
  autoPlay: true,   // FEATURE: tự ngắm enemy gần nhất
};

// --- Trạng thái game ---
let state;
let lastAim = -Math.PI / 2; // hướng ngắm gần nhất (mặc định hướng lên)

function freshPlayerStats() {
  // Chỉ số nền (skill được đọc riêng qua skillLevels — xem skills.js)
  return Object.assign({}, Store.balance.player);
}

function initState() {
  state = {
    running: true, paused: false,
    dying: false, deathTimer: 0,   // bị chạm -> hiện "!" + đóng băng 3s rồi mới game over
    elapsed: 0, kills: 0,
    level: 1, exp: 0, expToNext: expForLevel(1),
    levelUps: 0,           // tổng số lần đã lên cấp
    pendingLevelUps: 0,    // số lần lên cấp đang chờ chọn skill
    shotCount: 0,          // đếm số phát bắn (cho skill Luồng gió)
    weapon: null,          // vũ khí đã chọn (gán trong chooseWeapon)
    ultThreshold: 50,      // số kill để nạp đầy ultimate
    ultKills: 0,           // kill đã tích cho ultimate
    ultReady: false,       // ultimate đã sẵn sàng (tap để kích)
    prison: null,          // Earth Prison: {x,y,r,remaining}
    tornado: null,         // Wind Tornado: {x,y,vx,vy,r,remaining}
    nextBossAt: Store.balance.miniboss.firstAt, // giây xuất hiện miniboss kế tiếp
    player: { x: VW / 2, y: VH / 2, radius: Store.balance.player.radius, stats: freshPlayerStats(), fireTimer: 0 },
    skillLevels: {},       // id skill -> mốc đang sở hữu (1..max)
    bullets: [], enemies: [], particles: [],
    puddles: [],           // vũng bùn (Earth1): {x,y,r,slowFactor,remaining}
    firezones: [],         // vùng lửa (Vệt Lửa): {x,y,r,dps,remaining}
    walls: [],             // tường nảy (Tường Nảy): {x,y,w,h,remaining}
    wallTimer: 0,          // bộ đếm sinh tường
    rings: [],             // hiệu ứng vòng lan (Luồng gió): {x,y,r,maxR,life}
    bolts: [],             // tia sét (Đạn Sét / Trường điện): {x1,y1,x2,y2,life}
    auraTimer: 0,          // bộ đếm tick cho Trường Tĩnh Điện (mỗi 0.5s)
    spawnTimer: 0,
  };
}
