# Shuriken Prototype — Hướng dẫn cho Claude (nhánh `main`)

Tài liệu này để một Claude ở session mới đọc và làm tiếp. Mô tả kiến trúc, cách
config/thêm skill, cấu trúc file của **nhánh `main`**.

> ⚠️ **Có 2 nhánh kiến trúc KHÁC NHAU trong repo này:**
> - **`main`** (tài liệu này): bản 1-thư-mục gọn — engine nằm trong `game.js`, hệ **điểm (score)**,
>   upgrade kiểu **dữ liệu khai báo (`effects`)**. Có enemy Tetris, WASD, auto-aim 360°, miniboss, panel debug.
> - **`khanhnl`** (của coworker): refactor **đa-file** (`combat.js`, `spawn.js`, `render.js`, `update.js`...),
>   hệ **EXP/level + skill nguyên tố theo cấp**. KHÁC engine — đừng trộn code trực tiếp giữa 2 nhánh.
>
> Khi "port skill từ khanhnl sang main", ta **viết lại cơ chế** trong model của main, không copy file.

---

## 1. Game là gì
Auto-shooter survival (roguelike), khung dọc 9:16. Nhân vật ở giữa map, **tự bắn** về phía
enemy (auto-aim) hoặc theo chuột; di chuyển bằng **WASD**. Chạm enemy = thua. Hạ enemy được
**điểm**; đủ điểm thì **lên cấp → chọn 1 upgrade** (bốc ngẫu nhiên trong "set" đã chọn ở màn Edit).
Enemy mạnh dần theo thời gian; **miniboss** xuất hiện định kỳ kèm cảnh báo.

## 2. Chạy & build
- **Static HTML thuần** — mở `index.html` trong trình duyệt. KHÔNG build, KHÔNG dev server.
- Sửa code xong chỉ cần **reload trang**.
- Vì nạp nhiều file `.js` + dùng `localStorage`, một số trình duyệt chặn khi mở bằng `file://`.
  Nếu màn trắng/không lưu được: chạy local server trong thư mục —
  `python3 -m http.server` rồi vào `localhost:8000`.

## 3. Cấu trúc file (thứ tự nạp trong `index.html` RẤT QUAN TRỌNG)
Mỗi file là **script toàn cục** (không phải ES module) → biến/hàm chia sẻ qua global scope,
nên thứ tự nạp quyết định.

| Thứ tự | File | Trách nhiệm |
|---|---|---|
| 1 | `config.js` | **DỮ LIỆU MẶC ĐỊNH** + schema: `DEFAULT_BALANCE` (player, enemyTypes, miniboss, difficulty, map, upgrade-cost), `MINIBOSS_TYPES`, `DEFAULT_UPGRADES`, `DEFAULT_SETS`, và schema cho màn Edit: `STAT_DEFS`, `OP_DEFS`, `FX_DEFS`. **Sửa cân bằng / thêm skill chủ yếu ở đây.** |
| 2 | `data.js` | `Store` (giữ balance/upgrades/sets/activeSetId đang chạy; load/save localStorage; export/import JSON; reset; backfill field mới cho save cũ). `applyUpgrade()` = **bộ diễn giải `effects`**. Helper scaling: `difficultyStep`, `makeEnemyStats`, `makeMinibossStats`, `currentSpawnInterval`. |
| 3 | `game.js` | **ENGINE màn Play**: vòng lặp, trạng thái `state`, bắn/đạn/nảy, va chạm, auto-aim (mô phỏng đường đạn), spawn quái + miniboss, skill/zone/tường, EXP-progress, render, HUD, panel debug, vòng đời (death-delay/restart). |
| 4 | `editor.js` | **Màn Edit + điều hướng tab Play/Edit**. Sinh UI Balance/Upgrades/Sets/Data từ `Store` + schema trong config. Nút auto-play, debug, replay. |

`index.html` = markup (canvas, thanh điều khiển, panel debug, overlay chọn upgrade & thua) + CSS + 4 thẻ `<script>`.

> KHÔNG có `game.js`/`editor.js` "backup" như nhánh khanhnl — ở `main` đây là file ĐANG dùng.

## 4. Mô hình dữ liệu

### Store (data.js) — đang chạy, lưu localStorage (key `shuriken_proto_v1`)
- `Store.balance`     ← `DEFAULT_BALANCE`
- `Store.upgrades`    ← `DEFAULT_UPGRADES`  (mảng các skill/upgrade)
- `Store.sets`        ← `DEFAULT_SETS`      (các nhánh để chọn)
- `Store.activeSetId` ← set dùng cho level (chọn trong màn Edit)
- `Store.load()` tự **backfill** field mới (map, moveSpeed, miniboss) cho save cũ → đổi default
  trong config rồi mà save cũ vẫn còn thì bấm **↺ Reset mặc định** ở màn Edit để lấy bản sạch.

### state (game.js) — reset mỗi ván qua `initState()`
`score`, `kills`, `upgradesTaken`, `nextUpgradeAt`, `lastUpgradeAt` (cho thanh EXP),
`player{x,y,radius,stats,fireTimer}`, `bullets[]`, `enemies[]`, `particles[]`,
`bolts[]` (tia sét), `puddles[]`/`firezones[]`/`walls[]`/`rings[]` (zone & hiệu ứng),
`chosenSet`, `dying`/`deathTimer` (delay màn thua), `nextBossAt`/`bossWarn`/`bossType` (lịch miniboss).

`state.player.stats` = copy của `Store.balance.player` + túi `fx = {}` chứa mọi hiệu ứng skill đặc biệt.

## 5. Hệ UPGRADE / SKILL (cốt lõi — đọc kỹ)

Mỗi upgrade trong `DEFAULT_UPGRADES`:
```js
{ id, name, ico, desc, maxLevel /* null = vô hạn */,
  effects: [ /* 1 hoặc nhiều hiệu ứng */ ] }
```
`effects` có 2 dạng phần tử:

**(A) Chỉnh chỉ số** — cộng/nhân/gán 1 stat của người chơi:
```js
{ kind:'stat', target:'<stat>', op:'add'|'mul'|'set', value:<số> }
```
`target` hợp lệ (= `STAT_DEFS`): `moveSpeed, fireCooldown, bulletSpeed, bulletDamage,
bulletCount, bulletSpread, bulletPierce`.

**(B) Hiệu ứng đặc biệt** — đặt cờ vào `P.fx.<tên>`, engine đọc cờ này:
```js
{ kind:'fx', fx:'<tên>', ...tham số }
```
`applyUpgrade()` (data.js) là nơi DIỄN GIẢI: gom/cộng dồn tham số vào `P.fx`. Mỗi `fx` được
engine (game.js) đọc ở đúng nơi:

| fx | Ý nghĩa | Đọc ở đâu trong game.js |
|---|---|---|
| `slow` | trúng làm chậm | `applyHitEffects` |
| `burn` | bỏng DOT | `applyHitEffects` + vòng update enemy |
| `aoe` | enemy chết nổ quanh đó | `onEnemyKilled` |
| `chain` | trúng phóng sét sang enemy gần (luôn bật) | `applyOnHitSkills` → `chainLightning` |
| `stun` | % trúng làm đứng hình | `applyOnHitSkills` + vòng update (stunTimer) |
| `aura` | điện trường quanh người, dmg mỗi 0.5s | khối "Điện trường" trong `update` |
| `knockback` | trúng đẩy enemy ra xa | `applyOnHitSkills` |
| `windpulse` | mỗi N phát bắn đẩy enemy quanh người | cuối `fire()` |
| `fireshot`/`windshot`/`earthshot`/`lightningshot` | **đạn proc theo %** lúc bắn | `makeBullet()` gắn cờ lên viên đạn → xử lý khi trúng |
| `fbounce`/`ftrail`/`wgust`/`ebounce`/`elbounce`/`wbounce` | hiệu ứng **khi đạn NẢY** | `onBounce(b,e)` |
| `crit` | % gấp đôi dmg | đầu khối va chạm đạn-enemy |
| `overload` | trúng enemy đang tê liệt → nổ điện | `applyOnHitSkills` → `electricBurst` |
| `split` | % trúng thì đạn tách đôi | khối va chạm (gọi `makeBullet`) |
| `scoreboost` | +% điểm khi hạ | `onEnemyKilled` |
| `wall` | định kỳ sinh tường chắn enemy + đạn nảy | khối "Tường" trong `update` (`spawnWalls`/`bulletWallBounce`/`blockEnemyByWalls`) |

### ➜ Thêm 1 SKILL mới — checklist
1. **`config.js > DEFAULT_UPGRADES`**: thêm 1 entry `{id,name,ico,desc,maxLevel,effects:[...]}`.
   - Nếu chỉ chỉnh stat sẵn có → xong luôn (dùng `kind:'stat'`).
   - Nếu cần cơ chế mới → dùng `kind:'fx', fx:'tênMới', ...`.
2. **`data.js > applyUpgrade()`**: thêm nhánh `else if (e.fx === 'tênMới')` để gom tham số vào `P.fx.tênMới`
   (quy ước cộng dồn: chance/dmg cộng dồn, radius/duration lấy max — xem các fx có sẵn).
3. **`game.js`**: cắm logic đọc `state.player.stats.fx.tênMới` đúng nơi:
   - khi trúng → `applyHitEffects`/`applyOnHitSkills`; khi bắn → `fire`/`makeBullet`;
     khi nảy → `onBounce`; theo thời gian → `update`. Thêm render/visual nếu cần (`state.bolts/rings/...`).
4. **`config.js > FX_DEFS`**: thêm `{key:'tênMới', label, params:[{k,label,def}]}` để skill **chỉnh được trong màn Edit**
   (editor tự sinh dropdown từ FX_DEFS — không cần sửa editor.js).
5. (Tuỳ chọn) thêm `id` vào `DEFAULT_SETS` để nó xuất hiện trong các nhánh chọn.

### SETS (nhánh nâng cấp)
- `DEFAULT_SETS` = danh sách nhánh; mỗi set `{id,name,ico,choices,upgradeIds[]}`.
- Player chọn **1 set dùng cho level** trong **màn Edit** (`Store.activeSetId`). Lúc chơi KHÔNG hỏi set.
- Mỗi lần đủ điểm → `levelUp()` bốc `choices` upgrade ngẫu nhiên trong set đã chọn (loại cái đã max).
- Có set `all` (🎲 Tất cả skill) để brainstorm — bốc từ mọi upgrade.

## 6. Enemy & Miniboss (config.js)
- `DEFAULT_BALANCE.enemyTypes`: `triangle/circle/square` (va chạm hình tròn, dùng `radius`) và
  `tetromino` (khối L/J/S/Z, **va chạm theo từng ô vuông** dùng `cell`; đạn nảy đúng mặt khối).
  Trường: `baseHp, baseSpeed, radius|cell, color, score, weight` (weight = tỉ lệ ra).
- Scaling theo thời gian: `DEFAULT_BALANCE.difficulty` (`rampEvery`, `hpGrowthPerStep`,
  `speedGrowthPerStep`, spawn dày dần...). `makeEnemyStats()` áp scaling.
- **Miniboss**: `DEFAULT_BALANCE.miniboss` (`firstAt`, `every`, `warnLead`, `sparseMul`) +
  `MINIBOSS_TYPES`. Đặc tính: `absorb` (ngậm đạn, không nảy — Slime), `insulate` (×dmg giảm — Tesla),
  `mudWeak` (ăn thêm dmg trong vũng bùn — Golem), `deflect` (thổi chệch đạn thẳng, đạn xuyên bỏ qua — Cyclone).
  Boss kháng đẩy lùi/gió. Có **banner cảnh báo** trước khi vào + **thanh máu boss** trên đầu màn.

## 7. Các hệ thống khác trong game.js (cần biết khi sửa)
- **Auto-aim** (`bestAimAngle`/`simulateHits`/`rayEnemy`): quét 360°, MÔ PHỎNG đường đạn (giao tia–vòng tròn
  và tia–ô vuông cho tetromino) để chọn góc nảy trúng nhiều enemy nhất; ưu tiên cứng là **trúng enemy gần nhất**.
  Sim phải khớp vật lý đạn thật → nếu đổi cơ chế nảy, sửa cả `reflect`/`reflectCell` lẫn `rayEnemy`.
- **Đạn**: nảy **vô hạn** khi trúng enemy (van an toàn 300 lần), chỉ biến mất khi **chạm tường**.
  `reflect` (vòng tròn, dùng `px,py` để lấy điểm chạm chính xác) và `reflectCell` (mặt ô vuông).
- **WASD**: di chuyển nhân vật, `moveSpeed` trong player stats.
- **Death-delay**: chạm enemy → `triggerDeath()` (đóng băng + dấu "!" + đếm ngược) → `showGameOver()`.
- **Loop**: bọc `try/catch` chống 1 frame lỗi làm trắng màn.
- **Panel debug** (`renderDebug`): hiện thông số player/enemy/thời gian; bật/tắt bằng nút.

## 8. Verify (không có test tự động trong repo)
Cách kiểm tra nhanh dùng Node giả lập DOM (mẫu đã dùng nhiều lần): nối `config.js+data.js+game.js`,
mock `document/window/localStorage/performance/requestAnimationFrame`, gọi `initState()` rồi
lặp `update(1/60)` vài nghìn frame; kiểm tra không throw + các fx/zone/boss sinh đúng. Luôn chạy
`node -e "new Function(fs.readFileSync('x.js'))"` để check cú pháp trước.

## 9. Ràng buộc môi trường khi sửa file (Cowork)
File tool (Write/Edit) có thể bị chặn ghi thẳng vào thư mục repo. Cách làm: sửa bản sao trong thư
mục scratch (outputs) rồi `cp` đè vào repo bằng bash; hoặc ghi thẳng bằng bash. Git thao tác bình
thường qua bash. **Push** cần credential GitHub của user (sandbox không có) → user tự `git push` trên máy.

## 10. Việc CHƯA port từ khanhnl (nếu cần làm tiếp)
Đã port phần lớn skill nguyên tố + 4 miniboss (Slime/Tesla/Golem/Cyclone). **Chưa** port: hệ
EXP/level thật (main dùng score), Slime "bụng" nhả quái con (`bellyMax`), Tesla phóng sét theo cánh
(`nodes/tipCount`), một số visual nguyên tố chi tiết. Muốn thêm thì viết lại trong model của main như mục 5.
