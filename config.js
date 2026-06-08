/* ============================================================================
   [config.js] DỮ LIỆU MẶC ĐỊNH + SCHEMA
   ----------------------------------------------------------------------------
   Đây là dữ liệu GỐC của game. Khi chạy lần đầu (hoặc bấm "Reset mặc định"),
   game nạp đúng những gì khai báo ở đây. Sau đó mọi chỉnh sửa trong màn Edit
   được lưu vào trình duyệt (localStorage) — xem data.js.

   3 nhóm dữ liệu:
     DEFAULT_BALANCE  -> chỉ số player, enemy, scaling độ khó, ngưỡng nâng cấp
     DEFAULT_UPGRADES -> danh sách upgrade (dạng DỮ LIỆU, sửa được trong UI)
     DEFAULT_SETS     -> các "set" upgrade; mỗi set = 1 nhánh để player chọn

   ➜ Bạn có thể sửa trực tiếp ở đây, HOẶC sửa trong màn Edit rồi Export JSON.
   ============================================================================ */


/* ---------------------------------------------------------------------------
   1) BALANCE — số liệu cân bằng
   --------------------------------------------------------------------------- */
const DEFAULT_BALANCE = {

  // Chỉ số khởi đầu của người chơi
  player: {
    radius: 22,
    fireCooldown: 0.35,   // giây giữa 2 phát bắn (nhỏ hơn = bắn nhanh hơn)
    bulletSpeed: 480,     // px/giây
    bulletDamage: 1,      // dmg mỗi viên
    bulletCount: 1,       // số viên bắn mỗi nhịp
    bulletSpread: 0,      // góc xòe (độ) khi bắn nhiều viên
    bulletPierce: 0,      // số enemy đạn xuyên qua (0 = không xuyên, sẽ nảy vô hạn)
    // Ghi chú: đạn nảy VÔ HẠN khi trúng enemy, chỉ biến mất khi chạm tường,
    // nên không còn 'số lần nảy' hay 'thời gian sống đạn'.
  },

  // Các loại enemy (shape phải là 'triangle' | 'circle' | 'square')
  enemyTypes: {
    triangle: { shape: 'triangle', baseHp: 2, baseSpeed: 95, radius: 16, color: '#ff7a59', score: 1, weight: 4 },
    circle:   { shape: 'circle',   baseHp: 3, baseSpeed: 70, radius: 18, color: '#4c8dff', score: 2, weight: 3 },
    square:   { shape: 'square',   baseHp: 6, baseSpeed: 48, radius: 20, color: '#9b59ff', score: 3, weight: 2 },
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

  // Ngưỡng điểm để được lên cấp (chọn nâng cấp)
  // lần sau = lần trước + baseCost + costStep * (số lần đã nâng)
  upgrade: { baseCost: 5, costStep: 4 },
};


/* ---------------------------------------------------------------------------
   2) UPGRADES — dạng dữ liệu (sửa/thêm trong màn Edit)
   ---------------------------------------------------------------------------
   Mỗi upgrade:
     id        : khóa duy nhất (chữ thường, không dấu cách)
     name      : tên hiển thị
     ico       : emoji
     desc      : mô tả ngắn
     maxLevel  : số lần tối đa được chọn (null = vô hạn)
     effects   : MẢNG hiệu ứng — engine sẽ "diễn giải" (xem applyUpgrade ở data.js)

   Mỗi phần tử trong effects có 1 trong 2 dạng:
   (A) Chỉnh chỉ số:
       { kind:'stat', target:'<tên chỉ số>', op:'add'|'mul'|'set', value:<số> }
       target hợp lệ: fireCooldown, bulletSpeed, bulletDamage,
                      bulletCount, bulletSpread, bulletPierce
   (B) Hiệu ứng đặc biệt:
       { kind:'fx', fx:'slow', factor:0.65, duration:2.0 }   // làm chậm
       { kind:'fx', fx:'burn', dps:1, duration:3.0 }         // bỏng (dps cộng dồn)
       { kind:'fx', fx:'aoe',  radius:70, damage:1 }         // nổ khi chết (damage cộng dồn)
   --------------------------------------------------------------------------- */
const DEFAULT_UPGRADES = [
  { id:'firerate',  name:'Bắn nhanh',     ico:'⚡',  desc:'-15% thời gian hồi chiêu.', maxLevel:6,
    effects:[ { kind:'stat', target:'fireCooldown', op:'mul', value:0.85 } ] },

  { id:'damage',    name:'Sát thương +1', ico:'🗡️', desc:'+1 dmg mỗi viên.', maxLevel:null,
    effects:[ { kind:'stat', target:'bulletDamage', op:'add', value:1 } ] },

  { id:'multishot', name:'Đa đạn',        ico:'🎯', desc:'+1 viên mỗi nhịp (xòe quạt).', maxLevel:6,
    effects:[ { kind:'stat', target:'bulletCount', op:'add', value:1 },
              { kind:'stat', target:'bulletSpread', op:'set', value:14 } ] },

  { id:'pierce',    name:'Xuyên thấu',    ico:'➡️', desc:'+1 lần xuyên enemy (đi thẳng thay vì nảy).', maxLevel:4,
    effects:[ { kind:'stat', target:'bulletPierce', op:'add', value:1 } ] },

  { id:'spread',    name:'Nhiều hướng',   ico:'✳️', desc:'+18° góc xòe.', maxLevel:4,
    effects:[ { kind:'stat', target:'bulletSpread', op:'add', value:18 } ] },

  { id:'bulletspeed', name:'Đạn nhanh',   ico:'💨', desc:'+20% tốc độ đạn.', maxLevel:4,
    effects:[ { kind:'stat', target:'bulletSpeed', op:'mul', value:1.2 } ] },

  { id:'slow',  name:'Làm chậm', ico:'🧊', desc:'Đạn làm enemy chậm 35% trong 2s.', maxLevel:1,
    effects:[ { kind:'fx', fx:'slow', factor:0.65, duration:2.0 } ] },

  { id:'burn',  name:'Bỏng (DOT)', ico:'🔥', desc:'1 dmg/giây trong 3s, cộng dồn.', maxLevel:3,
    effects:[ { kind:'fx', fx:'burn', dps:1, duration:3.0 } ] },

  { id:'aoe',   name:'Nổ diện rộng', ico:'💥', desc:'Enemy chết nổ gây 1 dmg quanh đó.', maxLevel:3,
    effects:[ { kind:'fx', fx:'aoe', radius:70, damage:1 } ] },
];


/* ---------------------------------------------------------------------------
   3) SETS — các nhánh nâng cấp
   ---------------------------------------------------------------------------
   Khi player lên cấp: hiện các set bên dưới -> player chọn 1 set ->
   game bốc 'choices' upgrade ngẫu nhiên trong set đó để player chọn 1.

   Mỗi set:
     id         : khóa duy nhất
     name       : tên nhánh
     ico        : emoji
     choices    : số upgrade hiện ra để chọn (vd 3)
     upgradeIds : danh sách id upgrade thuộc set (lấy từ DEFAULT_UPGRADES)
   --------------------------------------------------------------------------- */
const DEFAULT_SETS = [
  { id:'offense', name:'Tấn công', ico:'⚔️', choices:3,
    upgradeIds:['damage','multishot','firerate','bulletspeed'] },

  { id:'control', name:'Khống chế', ico:'🧊', choices:3,
    upgradeIds:['slow','burn','aoe','pierce'] },

  { id:'utility', name:'Hỗ trợ', ico:'✨', choices:3,
    upgradeIds:['pierce','spread','bulletspeed','firerate'] },
];


/* ---------------------------------------------------------------------------
   SCHEMA cho màn Edit (để sinh dropdown). Bình thường không cần đụng.
   --------------------------------------------------------------------------- */
const STAT_DEFS = [
  { key:'fireCooldown',  label:'Hồi chiêu (s)' },
  { key:'bulletSpeed',   label:'Tốc độ đạn' },
  { key:'bulletDamage',  label:'Sát thương' },
  { key:'bulletCount',   label:'Số viên/nhịp' },
  { key:'bulletSpread',  label:'Góc xòe (độ)' },
  { key:'bulletPierce',  label:'Xuyên' },
];
const OP_DEFS = [
  { key:'add', label:'Cộng (+)' },
  { key:'mul', label:'Nhân (×)' },
  { key:'set', label:'Gán (=)' },
];
const FX_DEFS = [
  { key:'slow', label:'Làm chậm', params:[ {k:'factor',label:'Hệ số tốc độ',def:0.65}, {k:'duration',label:'Thời gian (s)',def:2.0} ] },
  { key:'burn', label:'Bỏng (DOT)', params:[ {k:'dps',label:'Dmg/giây',def:1}, {k:'duration',label:'Thời gian (s)',def:3.0} ] },
  { key:'aoe',  label:'Nổ diện rộng', params:[ {k:'radius',label:'Bán kính',def:70}, {k:'damage',label:'Sát thương',def:1} ] },
];
