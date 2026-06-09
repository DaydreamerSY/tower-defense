/* ============================================================================
   [config.js] DỮ LIỆU MẶC ĐỊNH (EXP + Hệ skill nguyên tố)
   ----------------------------------------------------------------------------
   Đây là dữ liệu GỐC của game. Khi chạy lần đầu (hoặc bấm "Reset mặc định"),
   game nạp đúng những gì khai báo ở đây. Mọi chỉnh sửa được lưu vào trình
   duyệt (localStorage) — xem data.js.

   2 nhóm dữ liệu:
     DEFAULT_BALANCE  -> chỉ số player nền, enemy (kèm exp rơi ra), scaling,
                         đường cong lên cấp.
     DEFAULT_SKILLS   -> 9 skill (6 nguyên tố + 3 phụ trợ), mỗi skill có
                         mảng levels[] cho từng mốc.
   ============================================================================ */


/* ---------------------------------------------------------------------------
   1) BALANCE — số liệu cân bằng
   --------------------------------------------------------------------------- */
const DEFAULT_BALANCE = {

  // Chỉ số khởi đầu của người chơi (không còn upgrade chỉnh — chỉ skill)
  player: {
    radius: 22,
    fireCooldown: 0.35,   // giây giữa 2 phát bắn (nhỏ hơn = bắn nhanh hơn)
    bulletSpeed: 480,     // px/giây (skill "Tốc độ bay"/"Đạn nặng" nhân thêm)
    bulletDamage: 1,      // dmg mỗi viên
    bulletBounces: 2,     // số lần nảy tối đa mỗi viên
    bulletCount: 1,       // số viên bắn mỗi nhịp
    bulletSpread: 0,      // góc xòe (độ) khi bắn nhiều viên
    bulletLifetime: 2.5,  // giây trước khi viên đạn tự biến mất
    bulletPierce: 0,      // số enemy đạn xuyên nền (Wind1 cộng thêm)
  },

  // Các loại enemy. 'exp' = lượng EXP rơi ra khi hạ gục.
  enemyTypes: {
    triangle: { shape: 'triangle', baseHp: 2, baseSpeed: 95, radius: 16, color: '#ff7a59', exp: 2, weight: 4 },
    circle:   { shape: 'circle',   baseHp: 3, baseSpeed: 70, radius: 18, color: '#4c8dff', exp: 3, weight: 3 },
    square:   { shape: 'square',   baseHp: 6, baseSpeed: 48, radius: 20, color: '#9b59ff', exp: 5, weight: 2 },
  },

  // Scaling theo thời gian: enemy mạnh dần khi player sống lâu
  difficulty: {
    rampEvery: 20,            // mỗi 20s độ khó +1 bậc
    hpGrowthPerStep: 0.25,    // +25% HP mỗi bậc
    speedGrowthPerStep: 0.08, // +8% tốc độ mỗi bậc
    speedCap: 2.2,            // trần hệ số tốc độ
    spawnStart: 1.4,          // giây giữa 2 lần spawn lúc đầu
    spawnMin: 0.35,           // spawn dày nhất
    spawnRampPerStep: 0.12,   // spawn nhanh dần mỗi bậc
  },

  // Đường cong lên cấp: EXP cần để qua cấp = baseExp + expStep*(level-1)
  level: { baseExp: 5, expStep: 5 },

  // Hệ số tốc độ TOÀN BỘ enemy (1 = gốc, <1 = chậm hơn). Knob chỉnh nhanh độ khó.
  enemySpeedMul: 0.7,

  // Miniboss xuất hiện theo thời gian: phút 1, 3, 5, 7, ... (mỗi 2 phút)
  miniboss: {
    firstAt: 60,    // giây xuất hiện con đầu tiên (phút 1)
    every: 120,     // sau đó mỗi 120s thêm 1 con (phút 3, 5, 7, ...)
    sparseMul: 3,   // khi miniboss còn sống, spawn quái thường THƯA gấp 3
  },
};


/* ---------------------------------------------------------------------------
   MINIBOSS — HP cao, di chuyển chậm, to hơn. Mỗi con "tôn vinh" 1 lối build.
   `absorb`: ngậm đạn (đạn chết khi chạm, KHÔNG nảy/xuyên) -> khắc build bounce/
   pierce; nhưng DoT (bỏng) & trail lửa vẫn thiêu bình thường -> lửa toả sáng.
   --------------------------------------------------------------------------- */
const MINIBOSS_TYPES = [
  { id:'slime', name:'Slime', shape:'hexagon', baseHp:90, baseSpeed:30, radius:42, color:'#7bdcb5', exp:25, absorb:true, bellyMax:7 },

  // Tesla (hệ Điện): mọi sát thương KHÔNG phải điện ×insulate (rất nhỏ). Sét chạm vào
  // sẽ arc vòng quanh các cánh sao (mỗi cánh ăn 1 nhịp -> ×tipCount), không nảy sang con khác.
  { id:'tesla', name:'Tesla', shape:'star', baseHp:120, baseSpeed:36, radius:40, color:'#ffe14d', exp:30, insulate:0.15, nodes:true, tipCount:5 },
];


/* ---------------------------------------------------------------------------
   2) MÀU THEO HỆ — mỗi viên đạn theo hệ sẽ có màu riêng
   --------------------------------------------------------------------------- */
const ELEMENT_COLORS = {
  normal:   '#2b2f38',  // đạn thường
  fire:     '#ff6b35',  // lửa (cam-đỏ)
  earth:    '#b5793b',  // đất (nâu)
  wind:     '#38d9c0',  // gió (xanh ngọc)
  electric: '#ffe14d',  // điện (vàng sét)
  crit:     '#ffd23f',  // nhá vàng khi bạo kích
};

// Thứ tự ưu tiên khi 1 viên mang nhiều hệ (để tô màu chính)
const ELEMENT_PRIORITY = ['fire', 'electric', 'earth', 'wind'];


/* ---------------------------------------------------------------------------
   3) SKILLS — 9 skill, mỗi skill có mảng levels[] (index 0 = mốc 1)
   ---------------------------------------------------------------------------
   Mỗi skill:
     id        : khóa duy nhất
     name      : tên hiển thị (KHÔNG dùng icon)
     element   : 'fire' | 'wind' | 'earth' | 'support'
     type      : 'passiveHit'  -> tác động mỗi đòn trúng
                 'projectile'  -> roll % để biến viên đạn thành đạn hệ
                 'counter'     -> đếm số phát bắn
                 'globalMod'   -> sửa chỉ số khi bắn
     maxLevel  : số mốc
     levels    : tham số từng mốc (xem mô tả ở data.js / skills.js)
   --------------------------------------------------------------------------- */
const DEFAULT_SKILLS = [

  // ----- HỆ LỬA -----
  { id:'fire1', name:'Burn', element:'fire', type:'passiveHit', maxLevel:5,
    desc:'Mỗi đòn trúng thêm 1 stack bỏng (cộng dồn vô hạn, mỗi stack có thời gian riêng).',
    levels:[
      { dps:1, duration:6 },
      { dps:1, duration:8 },
      { dps:2, duration:8 },
      { dps:2, duration:10 },
      { dps:3, duration:10 },
    ] },

  { id:'fire2', name:'Fire Shot', element:'fire', type:'projectile', maxLevel:5,
    desc:'% viên đạn hóa đạn lửa, gây thêm sát thương.',
    levels:[
      { chance:0.15, bonus:1 },
      { chance:0.22, bonus:1 },
      { chance:0.30, bonus:2 },
      { chance:0.40, bonus:2 },
      { chance:0.50, bonus:3 },
    ] },

  // ----- HỆ GIÓ -----
  { id:'wind1', name:'Wind Shot', element:'wind', type:'projectile', maxLevel:5,
    desc:'% viên đạn hóa đạn gió, xuyên thêm kẻ thù.',
    levels:[
      { chance:0.15, pierce:1 },
      { chance:0.22, pierce:1 },
      { chance:0.30, pierce:2 },
      { chance:0.40, pierce:2 },
      { chance:0.50, pierce:3 },
    ] },

  { id:'wind2', name:'Wind Pulse', element:'wind', type:'counter', maxLevel:5,
    desc:'Cứ sau N phát bắn tạo luồng gió đẩy kẻ thù quanh người ra xa.',
    levels:[
      { every:100, r:240 },
      { every:80,  r:270 },
      { every:60,  r:300 },
      { every:45,  r:330 },
      { every:30,  r:360 },
    ] },

  // ----- HỆ ĐẤT -----
  { id:'earth1', name:'Earth Shot', element:'earth', type:'projectile', maxLevel:5,
    desc:'% viên đạn hóa đạn đất, khi trúng tạo vũng bùn làm chậm kẻ thù.',
    levels:[
      { chance:0.15, r:60,  slowFactor:0.55, duration:3 },
      { chance:0.22, r:70,  slowFactor:0.50, duration:3 },
      { chance:0.30, r:80,  slowFactor:0.45, duration:3.5 },
      { chance:0.40, r:90,  slowFactor:0.40, duration:4 },
      { chance:0.50, r:100, slowFactor:0.35, duration:4 },
    ] },

  { id:'earth2', name:'Heavy Shot', element:'earth', type:'globalMod', maxLevel:5,
    desc:'Mọi viên đẩy lùi kẻ thù khi trúng, nhưng tốc độ bay giảm 20%.',
    levels:[
      { knockback:30, speedMul:0.8 },
      { knockback:45, speedMul:0.8 },
      { knockback:60, speedMul:0.8 },
      { knockback:80, speedMul:0.8 },
      { knockback:100, speedMul:0.8 },
    ] },

  // ----- HỆ ĐIỆN -----
  { id:'elec1', name:'Lightning Shot', element:'electric', type:'projectile', maxLevel:5,
    desc:'% viên đạn hóa sét, khi trúng lan sang vài kẻ thù gần đó.',
    levels:[
      { chance:0.15, chain:2, dmg:1 },
      { chance:0.22, chain:2, dmg:1 },
      { chance:0.30, chain:3, dmg:2 },
      { chance:0.40, chain:3, dmg:2 },
      { chance:0.50, chain:4, dmg:3 },
    ] },

  { id:'elec2', name:'Paralyze', element:'electric', type:'passiveHit', maxLevel:5,
    desc:'% đòn trúng khiến kẻ thù đứng hình (dừng hẳn) trong giây lát.',
    levels:[
      { chance:0.10, duration:0.6 },
      { chance:0.18, duration:0.8 },
      { chance:0.26, duration:1.0 },
      { chance:0.34, duration:1.2 },
      { chance:0.42, duration:1.5 },
    ] },

  { id:'elec3', name:'Static Field', element:'electric', type:'globalMod', maxLevel:5,
    desc:'Kẻ thù quanh người bị giật điện mỗi 0.5 giây.',
    levels:[
      { r:120, dmg:1 },
      { r:150, dmg:1 },
      { r:180, dmg:2 },
      { r:210, dmg:2 },
      { r:240, dmg:3 },
    ] },

  { id:'elec4', name:'Overload', element:'electric', type:'passiveHit', maxLevel:5,
    desc:'Đánh trúng kẻ thù đang tê liệt sẽ gây nổ điện diện rộng.',
    levels:[
      { dmg:2, r:70 },
      { dmg:3, r:80 },
      { dmg:3, r:90 },
      { dmg:4, r:100 },
      { dmg:5, r:110 },
    ] },

  // ----- NẢY (BOUNCE) -----  kích hoạt mỗi khi viên đạn nảy khỏi kẻ thù
  { id:'fbounce', name:'Fire Bounce', element:'fire', type:'globalMod', maxLevel:5,
    desc:'Mỗi lần đạn nảy gây nổ lửa quanh điểm nảy.',
    levels:[
      { r:50, dmg:1 },
      { r:60, dmg:1 },
      { r:70, dmg:2 },
      { r:80, dmg:2 },
      { r:90, dmg:3 },
    ] },

  { id:'wbounce', name:'Wind Bounce', element:'wind', type:'globalMod', maxLevel:5,
    desc:'Tăng số lần nảy; mỗi lần nảy viên đạn tăng tốc.',
    levels:[
      { bounces:1, speedup:0.10 },
      { bounces:1, speedup:0.15 },
      { bounces:2, speedup:0.15 },
      { bounces:2, speedup:0.20 },
      { bounces:3, speedup:0.25 },
    ] },

  { id:'ebounce', name:'Stone Bounce', element:'earth', type:'globalMod', maxLevel:5,
    desc:'Mỗi lần đạn nảy, viên đó được cộng thêm sát thương.',
    levels:[
      { dmg:1 },
      { dmg:1 },
      { dmg:2 },
      { dmg:2 },
      { dmg:3 },
    ] },

  { id:'elbounce', name:'Spark Bounce', element:'electric', type:'globalMod', maxLevel:5,
    desc:'Mỗi lần đạn nảy phóng sét lan sang kẻ thù gần.',
    levels:[
      { chain:1, dmg:1 },
      { chain:1, dmg:1 },
      { chain:2, dmg:2 },
      { chain:2, dmg:2 },
      { chain:3, dmg:3 },
    ] },

  { id:'ftrail', name:'Fire Trail', element:'fire', type:'globalMod', maxLevel:5,
    desc:'Mỗi lần đạn nảy để lại vệt lửa dài đốt máu kẻ thù chạm vào.',
    levels:[
      { len:90,  r:18, dps:1, duration:2 },
      { len:110, r:20, dps:1, duration:2 },
      { len:130, r:22, dps:2, duration:2.5 },
      { len:150, r:24, dps:2, duration:3 },
      { len:170, r:26, dps:3, duration:3 },
    ] },

  { id:'wgust', name:'Gale', element:'wind', type:'globalMod', maxLevel:5,
    desc:'Mỗi lần đạn nảy tạo luồng gió đẩy kẻ thù quanh điểm nảy ra xa.',
    levels:[
      { r:90 },
      { r:110 },
      { r:130 },
      { r:150 },
      { r:180 },
    ] },

  // ----- PHỤ TRỢ -----
  { id:'spd', name:'Bullet Speed', element:'support', type:'globalMod', maxLevel:5,
    desc:'Tăng tốc độ bay của viên đạn.',
    levels:[
      { mul:1.15 },
      { mul:1.30 },
      { mul:1.45 },
      { mul:1.60 },
      { mul:1.80 },
    ] },

  { id:'crit', name:'Critical', element:'support', type:'passiveHit', maxLevel:5,
    desc:'Tỉ lệ gây gấp đôi sát thương gốc.',
    levels:[
      { chance:0.10 },
      { chance:0.18 },
      { chance:0.26 },
      { chance:0.34 },
      { chance:0.42 },
    ] },

  { id:'split', name:'Split', element:'support', type:'passiveHit', maxLevel:1,
    desc:'33% khi trúng, viên đạn tách làm đôi.',
    levels:[
      { chance:0.33 },
    ] },

  { id:'expgain', name:'EXP Boost', element:'support', type:'globalMod', maxLevel:5,
    desc:'Tăng lượng EXP nhận được khi hạ gục.',
    levels:[
      { gain:0.05 },
      { gain:0.10 },
      { gain:0.15 },
      { gain:0.20 },
      { gain:0.25 },
    ] },

  { id:'wall', name:'Wall', element:'support', type:'globalMod', maxLevel:5,
    desc:'Định kỳ tạo bức tường chữ nhật: đạn nảy thêm và CHẶN kẻ thù.',
    levels:[
      { count:1, duration:6,   cooldown:6 },
      { count:1, duration:6.5, cooldown:5.5 },
      { count:2, duration:7,   cooldown:5 },
      { count:2, duration:7.5, cooldown:4.5 },
      { count:3, duration:8,   cooldown:4 },
    ] },
];


/* ---------------------------------------------------------------------------
   4) WEAPONS — chọn trước trận. Mỗi vũ khí: skill khởi đầu theo hệ + passive + ultimate.
   Ultimate nạp khi giết đủ `ultThreshold` kẻ thù, TAP màn hình để kích.
   `ult` = khóa hệ để chọn hiệu ứng ultimate (xem weapons.js).
   --------------------------------------------------------------------------- */
const WEAPONS = [
  { id:'fire_sword', name:'Fire Sword', element:'fire', color:'#ff6b35', ultThreshold:50,
    desc:'Vào trận nhận ngay 1 skill Lửa. Sát thương Lửa +10%.',
    ultName:'Inferno', ultDesc:'(tạm) Nổ lửa toàn màn + thiêu đốt mọi kẻ thù.' },

  { id:'elec_sword', name:'Lightning Sword', element:'electric', color:'#ffe14d', ultThreshold:50,
    desc:'Vào trận nhận ngay 1 skill Điện. Sét lan có 15% nhảy thêm 1 mục tiêu.',
    ultName:'Thunderstorm', ultDesc:'(tạm) Sét đánh tất cả kẻ thù + làm tê liệt.' },

  { id:'earth_sword', name:'Earth Sword', element:'earth', color:'#b5793b', ultThreshold:50,
    desc:'Vào trận nhận ngay 1 skill Đất. Vũng bùn & tường lớn/lâu hơn 25%.',
    ultName:'Earth Prison', ultDesc:'Nhốt kẻ thù trong vòng đất — đạn nảy vô hạn bên trong.' },

  { id:'wind_sword', name:'Wind Sword', element:'wind', color:'#38d9c0', ultThreshold:50,
    desc:'Vào trận nhận ngay 1 skill Gió. Đạn gió bay nhanh hơn 20%.',
    ultName:'Tornado', ultDesc:'Lốc xoáy di động hút & xé kẻ thù trong 8s.' },
];
