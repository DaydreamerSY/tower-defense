# Shuriken Prototype — Hướng dẫn nhanh

## ⚠️ Thư mục làm việc
- **Folder chính (DÙNG cái này)**: `/Users/khanhnl/Desktop/tower-defense/` — **là git repo** (remote: `github.com/DaydreamerSY/tower-defense`). Mọi chỉnh sửa làm ở đây.
- **`/Users/khanhnl/Desktop/tower-defense-main/`**: bản tải ZIP cũ — **KHÔNG dùng nữa** (giữ làm backup, có thể xoá).

Game **auto-shooter survival** (roguelike). Player đứng giữa màn, tự bắn enemy gần,
né va chạm (chạm = thua), đủ **EXP** thì **lên cấp → chọn 1 trong 3 skill**. Enemy
mạnh dần theo thời gian. Có 2 màn: **Play** và **Edit** (chỉnh balance/skill, lưu localStorage).

## Chạy
- **Static HTML thuần** — mở thẳng `index.html` trong Chrome. KHÔNG build, KHÔNG dev server.
- Sau khi sửa code: chỉ cần **reload Chrome**.

## Quy ước quan trọng
- Mỗi file `.js` là **script toàn cục** (KHÔNG ES module) → **thứ tự nạp trong `index.html` rất quan trọng**.
- **Không dùng icon/emoji trong game** — phân biệt bằng **chữ + màu**.
- localStorage key = `shuriken_proto_v2`. `data.js > Store.load()` có **merge-on-load**:
  skill mới trong `config.js` tự xuất hiện dù đã có data lưu (không đè tweak cũ).
- `game.js`, `editor.js` là **bản gốc cũ giữ làm backup — KHÔNG nạp, KHÔNG dùng**.

## Bản đồ file (theo thứ tự nạp)

### Dữ liệu
| File | Trách nhiệm |
|---|---|
| `config.js` | `DEFAULT_BALANCE` (player nền, enemy + `exp`, difficulty, `level` curve), `ELEMENT_COLORS`, `ELEMENT_PRIORITY`, **`DEFAULT_SKILLS`** (toàn bộ skill) |
| `data.js` | `Store` (balance/skills, load/save/export/import/reset, merge-on-load) + helper scaling: `difficultyStep`, `makeEnemyStats`, `currentSpawnInterval`, `expForLevel` |

### Engine màn Play
| File | Trách nhiệm |
|---|---|
| `canvas.js` | `VW/VH` (540×960), `canvas`, `ctx`, `resize()` |
| `input.js` | `mouse` + listeners (ngắm tay khi tắt auto-play) |
| `state.js` | `Game{active,autoPlay}`, `state`, `lastAim`, `freshPlayerStats()`, `initState()` |
| `skills.js` | Truy vấn skill: `skillLvl/skillCur/hasSkill/learnSkill`; chỉ số phái sinh: `bulletSpeedMul/critRoll/expMul`; màu đạn `bulletColor`; `describeSkill/elementLabel` |
| `aim.js` | Auto-aim **mô phỏng đường đạn** (`updateAim/simulateHits/distToWall`) hoặc ngắm chuột |
| `spawn.js` | `pickEnemyType()`, `spawnEnemy()` (khởi tạo `burnStacks/stunTimer/...`) |
| `particles.js` | `spawnExplosion()` |
| `combat.js` | **Lõi chiến đấu**: `fire/makeBullet`, `reflect` (chính xác qua `px,py`), `bulletHit` (áp mọi hiệu ứng skill khi trúng), `onBounce` (hiệu ứng khi nảy), `chainLightning/electricBurst/aoeDamage`, `windGust/pushEnemiesFrom`, `spawnWall/bulletWallBounce/blockEnemyByWalls`, `onEnemyKilled` |
| `levelup.js` | `offerLevelUp()` (bốc 3 skill chưa max), `chooseSkill()`, `resumePlay()` |
| `lifecycle.js` | `gameOver()`, `restart()`, `hideOverlays()` |
| `update.js` | Vòng cập nhật/frame: bắn, spawn, di chuyển đạn/enemy, va chạm, burn/puddle/firezone/aura/wall, EXP→level |
| `render.js` | Vẽ: zones nền → tia sét → particles → enemy (HP, dấu liệt) → đạn → ngắm → player → HUD (Cấp + thanh EXP + đồng hồ Luồng gió) |
| `loop.js` | `requestAnimationFrame` loop, `Game.start/stop`, biến `lastTime` |

### Màn Edit
| File | Trách nhiệm |
|---|---|
| `editor-dom.js` | Helper DOM: `el/numField/txtField/labeled` |
| `editor-sections.js` | `renderEditor()` = Balance + **Skills** (bảng số từng mốc) + Dữ liệu (Export/Import/Reset). `SKILL_KEY_LABEL`/`skillStep` cho UI |
| `nav.js` | Điều hướng tab Play/Edit, nút auto-play, replay (nạp **cuối cùng**) |

## Mô hình dữ liệu

### `Store` (data.js) — đang chạy, lưu localStorage
- `Store.balance` ← `DEFAULT_BALANCE`
- `Store.skills`  ← `DEFAULT_SKILLS`

### `state` (state.js) — reset mỗi ván qua `initState()`
`level/exp/expToNext`, `kills`, `shotCount`, `pendingLevelUps`, `player{stats}`,
`skillLevels{id:mốc}`, `bullets/enemies/particles`, các zone: `puddles/firezones/walls`,
hiệu ứng nhìn: `rings/bolts`, bộ đếm: `auraTimer/wallTimer`.

## Hệ skill (cốt lõi)

Mỗi skill trong `DEFAULT_SKILLS`:
```js
{ id, name, element:'fire|wind|earth|electric|support', type, maxLevel, desc, levels:[{...}] }
```
`type` quyết định nơi xử lý:
- `passiveHit` — áp dụng **mỗi đòn trúng** (xử lý trong `combat.js > bulletHit`)
- `projectile` — roll % **mỗi viên** lúc bắn (trong `combat.js > makeBullet`)
- `counter` — đếm số phát bắn (vd Luồng gió, trong `fire()`)
- `globalMod` — sửa chỉ số/cơ chế khi bắn/nảy (rải trong `combat.js`/`update.js`)

Đọc mốc hiện tại: `skillCur(id)` → trả `levels[mốc-1]` (hoặc `null` nếu chưa có).

### Thêm 1 skill mới — checklist
1. **`config.js`**: thêm entry vào `DEFAULT_SKILLS` (id, name, element, type, maxLevel, `levels[]`).
2. **`combat.js`/`update.js`**: cắm logic đọc `skillCur('id')` đúng nơi:
   - hit → `bulletHit`; bắn → `makeBullet`/`fire`; nảy → `onBounce`; theo thời gian → `update`.
3. **`skills.js > describeSkill`**: thêm `case 'id'` để thẻ chọn skill hiện đúng số.
4. **`editor-sections.js`**: nếu `levels` có **key mới**, thêm vào `SKILL_KEY_LABEL` (+ `skillStep` nếu cần bước nhảy nhỏ).
5. (state mới? thêm mảng vào `initState` + vẽ ở `render.js`.)

## Cơ chế chính
- **EXP/Level**: hạ enemy → `state.exp += enemy.exp * expMul()`. Đủ `expToNext` (=`expForLevel(level)`) → lên cấp (dồn nhiều cấp), gọi `offerLevelUp()`.
- **Nảy (bounce)**: đạn nảy off enemy **giới hạn** theo `bulletBounces` nền; nảy off **tường màn hình** & **Tường Nảy** không tốn lượt. Pierce (Đạn gió) = đi thẳng. Mỗi lần nảy off enemy/tường gọi `onBounce` → kích các skill "Dội"/Vệt Lửa/Cuồng Phong.
- **Hệ & màu**: fire `#ff6b35`, earth `#b5793b`, wind `#38d9c0`, electric `#ffe14d`. 1 viên có thể mang **nhiều hệ** (mỗi hệ roll độc lập); tô màu chính theo `ELEMENT_PRIORITY` + viền hệ phụ.
- **Zones**: `puddles` (Đạn đất, làm chậm), `firezones` (Vệt Lửa capsule, đốt máu), `walls` (Tường Nảy: đạn nảy + chặn quái).
- **Auto-aim** (`aim.js`): mô phỏng đường đạn nhiều hướng, chọn góc trúng nhiều enemy nhất.

## Màn Edit
Tab **Edit** → chỉnh **Balance** (player nền, enemy `exp`, difficulty, đường cong level),
**Skills** (sửa số từng mốc, áp dụng ngay), **Dữ liệu** (Export/Import/Reset JSON).
