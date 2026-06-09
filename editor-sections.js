/* ============================================================================
   [editor-sections.js] MÀN EDIT — Balance + Dữ liệu (Export/Import/Reset)
   ----------------------------------------------------------------------------
   Phụ thuộc: editor-dom.js (el/numField/txtField/labeled), data.js (Store).
   Skill là dữ liệu lồng phức tạp -> chỉnh qua Export/Import JSON ở mục Dữ liệu.
   ============================================================================ */

function renderEditor() {
  const root = document.getElementById('editRoot');
  root.innerHTML = '';
  root.appendChild(sectionBalance());
  root.appendChild(sectionSkills());
  root.appendChild(sectionData());
}

/* ---------------- BALANCE ---------------- */
function sectionBalance() {
  const B = Store.balance;
  const sec = el('section', { class: 'card-block' }, [ el('h2', {}, 'Balance') ]);

  // Player
  const p = B.player;
  sec.appendChild(el('h3', {}, 'Người chơi (chỉ số nền)'));
  const pg = el('div', { class: 'grid' });
  [['fireCooldown','Hồi chiêu (s)',0.01],['bulletSpeed','Tốc độ đạn',10],['bulletDamage','Sát thương',1],
   ['bulletBounces','Số lần nảy',1],['bulletCount','Số viên/nhịp',1],['bulletSpread','Góc xòe (độ)',1],
   ['bulletPierce','Xuyên',1]]
    .forEach(([k,l,s]) => pg.appendChild(labeled(l, numField(p, k, s))));
  sec.appendChild(pg);

  // Knob tốc độ quái toàn cục
  sec.appendChild(el('h3', {}, 'Tốc độ quái (toàn cục)'));
  const sg = el('div', { class: 'grid' });
  sg.appendChild(labeled('Hệ số tốc độ quái (×)', numField(B, 'enemySpeedMul', 0.05)));
  sec.appendChild(sg);

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

  // Level curve
  sec.appendChild(el('h3', {}, 'Đường cong lên cấp'));
  const lg = el('div', { class: 'grid' });
  lg.appendChild(labeled('EXP gốc (cấp 1)', numField(B.level, 'baseExp', 1)));
  lg.appendChild(labeled('Tăng mỗi cấp', numField(B.level, 'expStep', 1)));
  sec.appendChild(lg);

  // Miniboss
  sec.appendChild(el('h3', {}, 'Miniboss'));
  const mg = el('div', { class: 'grid' });
  mg.appendChild(labeled('Xuất hiện đầu (s)', numField(B.miniboss, 'firstAt', 1)));
  mg.appendChild(labeled('Mỗi (s)', numField(B.miniboss, 'every', 1)));
  mg.appendChild(labeled('Spawn thường thưa (×)', numField(B.miniboss, 'sparseMul', 0.5)));
  sec.appendChild(mg);

  // Enemy types table (cột EXP)
  sec.appendChild(el('h3', {}, 'Enemy'));
  const tbl = el('table', { class: 'etable' });
  tbl.appendChild(el('tr', {}, [
    el('th', {}, 'Loại'), el('th', {}, 'HP gốc'), el('th', {}, 'Tốc độ'),
    el('th', {}, 'EXP'), el('th', {}, 'Tỉ lệ ra'),
  ]));
  Object.keys(B.enemyTypes).forEach(key => {
    const t = B.enemyTypes[key];
    tbl.appendChild(el('tr', {}, [
      el('td', {}, `${t.shape}`),
      el('td', {}, numField(t, 'baseHp', 1)),
      el('td', {}, numField(t, 'baseSpeed', 1)),
      el('td', {}, numField(t, 'exp', 1)),
      el('td', {}, numField(t, 'weight', 1)),
    ]));
  });
  sec.appendChild(tbl);
  return sec;
}

/* ---------------- SKILLS ---------------- */
// Nhãn cột + bước nhảy ô số cho từng tham số mốc skill
const SKILL_KEY_LABEL = {
  chance:'Tỉ lệ (0-1)', dps:'Dmg/giây', duration:'Thời gian (s)', bonus:'+Sát thương',
  pierce:'+Xuyên', every:'Mỗi N phát', r:'Bán kính', slowFactor:'Hệ số chậm (×)',
  knockback:'Đẩy lùi (px)', speedMul:'×Tốc độ bay', mul:'×Hệ số', gain:'+EXP (0-1)',
  chain:'Số lan', dmg:'Sát thương', bounces:'+Lần nảy', speedup:'×Tăng tốc nảy',
  count:'Số lượng', cooldown:'Hồi (s)', len:'Chiều dài', r:'Bán kính/Dày', push:'Lực đẩy (px)',
};
function skillStep(k) {
  if (['chance','slowFactor','speedMul','mul','gain','speedup'].includes(k)) return 0.01;
  if (k === 'duration' || k === 'cooldown') return 0.1;
  return 1;
}

function sectionSkills() {
  const sec = el('section', { class: 'card-block' }, [ el('h2', {}, 'Skills') ]);
  sec.appendChild(el('p', { class: 'hint' }, 'Chỉnh số từng mốc của skill. Mỗi hàng = 1 mốc (Lv1..max), mỗi cột = 1 tham số. Sửa là áp dụng ngay (kể cả đang chơi).'));
  Store.skills.forEach(s => sec.appendChild(skillCard(s)));
  return sec;
}

function skillCard(s) {
  const card = el('div', { class: 'edit-card' });
  card.appendChild(el('div', { class: 'grid' }, [
    labeled('Tên', txtField(s, 'name')),
    labeled('Hệ', el('input', { class: 'txt', value: elementLabel(s.element), disabled: 'disabled' })),
    labeled('Số mốc', el('input', { class: 'num', value: s.maxLevel, disabled: 'disabled' })),
  ]));
  card.appendChild(labeled('Mô tả', txtField(s, 'desc')));

  const keys = Object.keys(s.levels[0] || {});
  const tbl = el('table', { class: 'etable' });
  tbl.appendChild(el('tr', {}, [ el('th', {}, 'Mốc'), ...keys.map(k => el('th', {}, SKILL_KEY_LABEL[k] || k)) ]));
  s.levels.forEach((lv, i) => {
    tbl.appendChild(el('tr', {}, [
      el('td', {}, `Lv ${i + 1}`),
      ...keys.map(k => el('td', {}, numField(lv, k, skillStep(k)))),
    ]));
  });
  card.appendChild(tbl);
  return card;
}

/* ---------------- DATA (export/import/reset) ---------------- */
function sectionData() {
  const sec = el('section', { class: 'card-block' }, [
    el('h2', {}, 'Dữ liệu'),
    el('p', { class: 'hint' }, 'Sao lưu / khôi phục toàn bộ Balance + Skills bằng JSON. Reset đưa mọi thứ về mặc định trong config.js.'),
  ]);
  const ta = el('textarea', { class: 'json', rows: 8, placeholder: 'Dán JSON vào đây để Import...' });
  sec.appendChild(el('div', { class: 'btn-row' }, [
    el('button', { class: 'mini', onclick: () => { ta.value = Store.exportJSON(); } }, 'Export ra ô dưới'),
    el('button', { class: 'mini', onclick: () => {
      if (Store.importJSON(ta.value)) { alert('Import thành công!'); renderEditor(); }
      else alert('JSON không hợp lệ.');
    }}, 'Import từ ô dưới'),
    el('button', { class: 'mini danger', onclick: () => { if (confirm('Reset toàn bộ về mặc định?')) { Store.reset(); renderEditor(); } } }, 'Reset mặc định'),
  ]));
  sec.appendChild(ta);
  return sec;
}
