/* ============================================================================
   [editor.js] MÀN EDIT + BALANCE và điều hướng tab Play/Edit.
   ----------------------------------------------------------------------------
   Phụ thuộc: config.js (STAT_DEFS, OP_DEFS, FX_DEFS), data.js (Store),
              game.js (Game.start/stop, Game.autoPlay).
   Mọi chỉnh sửa -> cập nhật Store -> Store.save() (tự lưu vào trình duyệt).
   ============================================================================ */

/* ---- Helper tạo DOM ngắn gọn ---- */
function el(tag, props = {}, kids = []) {
  const n = document.createElement(tag);
  for (const k in props) {
    if (k === 'class') n.className = props[k];
    else if (k === 'html') n.innerHTML = props[k];
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), props[k]);
    else if (k === 'value') n.value = props[k];
    else n.setAttribute(k, props[k]);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c => {
    if (c == null) return;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return n;
}

// Ô nhập số gắn với obj[key]; onCommit (tuỳ chọn) gọi nếu cần re-render
function numField(obj, key, step = 1, onCommit = null) {
  return el('input', {
    type: 'number', step, value: obj[key],
    class: 'num',
    oninput: (e) => {
      const v = parseFloat(e.target.value);
      obj[key] = isNaN(v) ? 0 : v;
      Store.save();
      if (onCommit) onCommit();
    },
  });
}
function txtField(obj, key, ph = '') {
  return el('input', {
    type: 'text', value: obj[key] ?? '', placeholder: ph, class: 'txt',
    oninput: (e) => { obj[key] = e.target.value; Store.save(); },
  });
}
function labeled(label, control) {
  return el('label', { class: 'field' }, [ el('span', {}, label), control ]);
}


/* ============================================================================
   RENDER toàn bộ màn Edit từ Store
   ============================================================================ */
function renderEditor() {
  const root = document.getElementById('editRoot');
  root.innerHTML = '';
  root.appendChild(sectionBalance());
  root.appendChild(sectionUpgrades());
  root.appendChild(sectionSets());
  root.appendChild(sectionData());
}

/* ---------------- BALANCE ---------------- */
function sectionBalance() {
  const B = Store.balance;
  if (!B.map) B.map = { width: 720, height: 1280 };  // an toàn cho dữ liệu cũ
  const sec = el('section', { class: 'card-block' }, [ el('h2', {}, '⚖️ Balance') ]);

  // Map
  sec.appendChild(el('h3', {}, 'Map (kích thước, nên giữ tỉ lệ 9:16)'));
  const mg = el('div', { class: 'grid' });
  mg.appendChild(labeled('Rộng (px)', numField(B.map, 'width', 10)));
  mg.appendChild(labeled('Cao (px)', numField(B.map, 'height', 10)));
  sec.appendChild(mg);

  // Player
  const p = B.player;
  sec.appendChild(el('h3', {}, 'Người chơi (chỉ số khởi đầu)'));
  const pg = el('div', { class: 'grid' });
  [['moveSpeed','Tốc độ chạy',10],['fireCooldown','Hồi chiêu (s)',0.01],['bulletSpeed','Tốc độ đạn',10],
   ['bulletDamage','Sát thương',1],['bulletCount','Số viên/nhịp',1],['bulletSpread','Góc xòe (độ)',1],['bulletPierce','Xuyên',1]]
    .forEach(([k,l,s]) => pg.appendChild(labeled(l, numField(p, k, s))));
  sec.appendChild(pg);

  // Difficulty
  const d = B.difficulty;
  sec.appendChild(el('h3', {}, 'Độ khó theo thời gian'));
  const dg = el('div', { class: 'grid' });
  [['rampEvery','Lên bậc mỗi (s)',1],['hpGrowthPerStep','+HP mỗi bậc (×)',0.05],
   ['speedGrowthPerStep','+Tốc độ mỗi bậc (×)',0.02],['speedCap','Trần tốc độ (×)',0.1],
   ['spawnStart','Spawn đầu (s)',0.1],['spawnMin','Spawn nhanh nhất (s)',0.05],
   ['spawnRampPerStep','Spawn nhanh dần (s/bậc)',0.02]]
    .forEach(([k,l,s]) => dg.appendChild(labeled(l, numField(d, k, s))));
  sec.appendChild(dg);

  // Upgrade cost
  sec.appendChild(el('h3', {}, 'Ngưỡng lên cấp'));
  const ug = el('div', { class: 'grid' });
  ug.appendChild(labeled('Điểm gốc', numField(B.upgrade, 'baseCost', 1)));
  ug.appendChild(labeled('Tăng mỗi lần', numField(B.upgrade, 'costStep', 1)));
  sec.appendChild(ug);

  // Enemy types table
  sec.appendChild(el('h3', {}, 'Enemy'));
  sec.appendChild(el('p', { class: 'hint' }, 'Kích thước: bán kính (tròn/vuông/tam giác) hoặc cạnh mỗi ô (khối Tetris).'));
  const tbl = el('table', { class: 'etable' });
  tbl.appendChild(el('tr', {}, [
    el('th', {}, 'Loại'), el('th', {}, 'HP gốc'), el('th', {}, 'Tốc độ'),
    el('th', {}, 'Điểm'), el('th', {}, 'Tỉ lệ ra'), el('th', {}, 'Kích thước'),
  ]));
  Object.keys(B.enemyTypes).forEach(key => {
    const t = B.enemyTypes[key];
    const sizeKey = (t.cell != null) ? 'cell' : 'radius';   // khối Tetris dùng 'cell', còn lại 'radius'
    tbl.appendChild(el('tr', {}, [
      el('td', {}, `${t.shape}`),
      el('td', {}, numField(t, 'baseHp', 1)),
      el('td', {}, numField(t, 'baseSpeed', 1)),
      el('td', {}, numField(t, 'score', 1)),
      el('td', {}, numField(t, 'weight', 1)),
      el('td', {}, numField(t, sizeKey, 1)),
    ]));
  });
  sec.appendChild(tbl);
  return sec;
}

/* ---------------- UPGRADES ---------------- */
function sectionUpgrades() {
  const sec = el('section', { class: 'card-block' }, [
    el('div', { class: 'row-head' }, [
      el('h2', {}, '🗡️ Upgrades'),
      el('button', { class: 'mini', onclick: addUpgrade }, '+ Thêm upgrade'),
    ]),
  ]);
  Store.upgrades.forEach(u => sec.appendChild(upgradeCard(u)));
  return sec;
}

function upgradeCard(u) {
  const card = el('div', { class: 'edit-card' });
  const head = el('div', { class: 'grid' }, [
    labeled('ID', txtField(u, 'id', 'id_duy_nhat')),
    labeled('Tên', txtField(u, 'name')),
    labeled('Icon', txtField(u, 'ico')),
    labeled('Max level (trống = ∞)', el('input', {
      type: 'number', value: u.maxLevel ?? '', class: 'num',
      oninput: (e) => { const v = e.target.value; u.maxLevel = v === '' ? null : parseInt(v); Store.save(); },
    })),
  ]);
  card.appendChild(head);
  card.appendChild(labeled('Mô tả', txtField(u, 'desc')));

  // Effects
  card.appendChild(el('div', { class: 'sub' }, 'Hiệu ứng'));
  u.effects = u.effects || [];
  u.effects.forEach((eff, i) => card.appendChild(effectRow(u, eff, i)));
  card.appendChild(el('div', { class: 'btn-row' }, [
    el('button', { class: 'mini', onclick: () => { u.effects.push({ kind:'stat', target:'bulletDamage', op:'add', value:1 }); Store.save(); renderEditor(); } }, '+ Hiệu ứng'),
    el('button', { class: 'mini danger', onclick: () => deleteUpgrade(u) }, '🗑 Xoá upgrade'),
  ]));
  return card;
}

function effectRow(u, eff, idx) {
  const row = el('div', { class: 'eff-row' });

  // kind: stat | fx
  const kindSel = el('select', { class: 'sel', onchange: (e) => {
    eff.kind = e.target.value;
    if (eff.kind === 'stat') { Object.assign(eff, { target:'bulletDamage', op:'add', value:1 }); delete eff.fx; }
    else { Object.assign(eff, { fx:'slow', factor:0.65, duration:2.0 }); delete eff.target; delete eff.op; delete eff.value; }
    Store.save(); renderEditor();
  }});
  [['stat','Chỉ số'],['fx','Hiệu ứng đặc biệt']].forEach(([v,l]) =>
    kindSel.appendChild(el('option', { value:v, ...(eff.kind===v?{selected:'selected'}:{}) }, l)));
  row.appendChild(kindSel);

  if (eff.kind === 'stat') {
    const tSel = el('select', { class: 'sel', onchange: (e) => { eff.target = e.target.value; Store.save(); } });
    STAT_DEFS.forEach(s => tSel.appendChild(el('option', { value:s.key, ...(eff.target===s.key?{selected:'selected'}:{}) }, s.label)));
    row.appendChild(tSel);

    const oSel = el('select', { class: 'sel', onchange: (e) => { eff.op = e.target.value; Store.save(); } });
    OP_DEFS.forEach(o => oSel.appendChild(el('option', { value:o.key, ...(eff.op===o.key?{selected:'selected'}:{}) }, o.label)));
    row.appendChild(oSel);

    row.appendChild(numField(eff, 'value', 0.05));
  } else {
    const fSel = el('select', { class: 'sel', onchange: (e) => {
      eff.fx = e.target.value;
      const def = FX_DEFS.find(f => f.key === eff.fx);
      def.params.forEach(pr => eff[pr.k] = pr.def); // reset params về mặc định fx mới
      Store.save(); renderEditor();
    }});
    FX_DEFS.forEach(f => fSel.appendChild(el('option', { value:f.key, ...(eff.fx===f.key?{selected:'selected'}:{}) }, f.label)));
    row.appendChild(fSel);

    const def = FX_DEFS.find(f => f.key === eff.fx);
    def.params.forEach(pr => {
      if (eff[pr.k] === undefined) eff[pr.k] = pr.def;
      row.appendChild(labeled(pr.label, numField(eff, pr.k, 0.05)));
    });
  }

  row.appendChild(el('button', { class: 'mini danger sm', onclick: () => { u.effects.splice(idx,1); Store.save(); renderEditor(); } }, '✕'));
  return row;
}

function addUpgrade() {
  let n = 1; while (Store.getUpgrade('new' + n)) n++;
  Store.upgrades.push({ id:'new'+n, name:'Upgrade mới', ico:'⭐', desc:'', maxLevel:3,
    effects:[ { kind:'stat', target:'bulletDamage', op:'add', value:1 } ] });
  Store.save(); renderEditor();
}
function deleteUpgrade(u) {
  if (!confirm(`Xoá upgrade "${u.name}"?`)) return;
  Store.upgrades = Store.upgrades.filter(x => x !== u);
  // gỡ khỏi mọi set
  Store.sets.forEach(s => s.upgradeIds = (s.upgradeIds||[]).filter(id => id !== u.id));
  Store.save(); renderEditor();
}

/* ---------------- SETS ---------------- */
function sectionSets() {
  const sec = el('section', { class: 'card-block' }, [
    el('div', { class: 'row-head' }, [
      el('h2', {}, '📦 Sets (nhánh nâng cấp)'),
      el('button', { class: 'mini', onclick: addSet }, '+ Thêm set'),
    ]),
    el('p', { class: 'hint' }, 'Chọn 1 set dùng cho level bên dưới. Khi chơi, mỗi lần đủ điểm lên cấp, game random "Số lựa chọn" upgrade trong set đó để player chọn 1.'),
  ]);

  // Chọn SET dùng cho level (thay cho việc chọn lúc chơi)
  const activeSel = el('select', { class: 'sel', onchange: (e) => { Store.activeSetId = e.target.value; Store.save(); renderEditor(); } });
  Store.sets.forEach(s => activeSel.appendChild(el('option', { value:s.id, ...(Store.activeSetId===s.id?{selected:'selected'}:{}) }, `${s.ico||'📦'} ${s.name}`)));
  sec.appendChild(el('div', { class: 'active-set' }, [ el('span', {}, '▶ Set dùng cho level: '), activeSel ]));

  Store.sets.forEach(s => sec.appendChild(setCard(s)));
  return sec;
}
function setCard(s) {
  const isActive = (s.id === Store.activeSetId);
  const card = el('div', { class: 'edit-card' + (isActive ? ' active' : '') });
  if (isActive) card.appendChild(el('div', { class: 'active-badge' }, '▶ Đang dùng cho level'));
  card.appendChild(el('div', { class: 'grid' }, [
    labeled('ID', txtField(s, 'id')),
    labeled('Tên', txtField(s, 'name')),
    labeled('Icon', txtField(s, 'ico')),
    labeled('Số lựa chọn hiện ra', numField(s, 'choices', 1)),
  ]));
  card.appendChild(el('div', { class: 'sub' }, 'Upgrade thuộc set này'));
  const box = el('div', { class: 'chk-box' });
  s.upgradeIds = s.upgradeIds || [];
  Store.upgrades.forEach(u => {
    const on = s.upgradeIds.includes(u.id);
    const chk = el('label', { class: 'chk' + (on ? ' on' : '') }, [
      el('input', { type:'checkbox', ...(on?{checked:'checked'}:{}), onchange: (e) => {
        if (e.target.checked) { if (!s.upgradeIds.includes(u.id)) s.upgradeIds.push(u.id); }
        else { s.upgradeIds = s.upgradeIds.filter(id => id !== u.id); }
        Store.save(); renderEditor();
      }}),
      `${u.ico} ${u.name}`,
    ]);
    box.appendChild(chk);
  });
  card.appendChild(box);
  card.appendChild(el('div', { class: 'btn-row' }, [
    el('button', { class: 'mini danger', onclick: () => deleteSet(s) }, '🗑 Xoá set'),
  ]));
  return card;
}
function addSet() {
  let n = 1; while (Store.sets.find(s => s.id === 'set' + n)) n++;
  Store.sets.push({ id:'set'+n, name:'Set mới', ico:'📦', choices:3, upgradeIds:[] });
  Store.save(); renderEditor();
}
function deleteSet(s) {
  if (!confirm(`Xoá set "${s.name}"?`)) return;
  Store.sets = Store.sets.filter(x => x !== s);
  Store.save(); renderEditor();
}

/* ---------------- DATA (export/import/reset) ---------------- */
function sectionData() {
  const sec = el('section', { class: 'card-block' }, [ el('h2', {}, '💾 Dữ liệu') ]);
  const ta = el('textarea', { class: 'json', rows: 6, placeholder: 'Dán JSON vào đây để Import...' });
  sec.appendChild(el('div', { class: 'btn-row' }, [
    el('button', { class: 'mini', onclick: () => { ta.value = Store.exportJSON(); } }, '⬆ Export ra ô dưới'),
    el('button', { class: 'mini', onclick: () => {
      if (Store.importJSON(ta.value)) { alert('Import thành công!'); renderEditor(); }
      else alert('JSON không hợp lệ.');
    }}, '⬇ Import từ ô dưới'),
    el('button', { class: 'mini danger', onclick: () => { if (confirm('Reset toàn bộ về mặc định?')) { Store.reset(); renderEditor(); } } }, '↺ Reset mặc định'),
  ]));
  sec.appendChild(ta);
  return sec;
}


/* ============================================================================
   ĐIỀU HƯỚNG TAB Play / Edit
   ============================================================================ */
function showScreen(name) {
  document.getElementById('playScreen').style.display = (name === 'play') ? 'flex' : 'none';
  document.getElementById('editScreen').style.display = (name === 'edit') ? 'block' : 'none';
  document.getElementById('tabPlay').classList.toggle('active', name === 'play');
  document.getElementById('tabEdit').classList.toggle('active', name === 'edit');
  if (name === 'play') { Game.start(); }
  else { Game.stop(); renderEditor(); }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('tabPlay').onclick = () => showScreen('play');
  document.getElementById('tabEdit').onclick = () => showScreen('edit');

  // Nút bật/tắt auto-play
  const autoBtn = document.getElementById('autoToggle');
  function syncAuto() {
    autoBtn.textContent = Game.autoPlay ? '🤖 Auto-play: BẬT' : '🖱️ Auto-play: TẮT (ngắm bằng chuột)';
    autoBtn.classList.toggle('on', Game.autoPlay);
  }
  autoBtn.onclick = () => { Game.autoPlay = !Game.autoPlay; syncAuto(); };
  syncAuto();

  // Nút bật/tắt panel debug
  const dbgBtn = document.getElementById('debugToggle');
  function syncDebug() {
    dbgBtn.textContent = Game.showDebug ? '🐞 Debug: BẬT' : '🐞 Debug: TẮT';
    dbgBtn.classList.toggle('on', Game.showDebug);
  }
  dbgBtn.onclick = () => { Game.showDebug = !Game.showDebug; syncDebug(); };
  syncDebug();

  // Nút chơi lại nhanh trong thanh điều khiển
  document.getElementById('replayBtn').onclick = () => restart();

  // Mặc định mở màn Play (auto-play đã bật sẵn)
  showScreen('play');
});
