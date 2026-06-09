/* ============================================================================
   [skill-lab.js] SKILL LAB — tự chế skill kiểu Scratch + bật/tắt pool
   ----------------------------------------------------------------------------
   Phụ thuộc: editor-dom.js (el/numField/txtField/labeled), config.js
   (TRIGGER_DEFS, EFFECT_DEFS), data.js (Store), skills.js (describeCustomSkill).
   renderSkillLab() được nav.js gọi khi mở tab Skill Lab.
   ============================================================================ */

let labDraft = null;
function defaultDraft() {
  return { name: '', trigger: 'onHit', chance: 0.15, every: 100, effect: 'chain', params: {} };
}
function effectDef(key) { return EFFECT_DEFS.find(e => e.key === key) || EFFECT_DEFS[0]; }

function renderSkillLab() {
  if (!labDraft) labDraft = defaultDraft();
  const root = document.getElementById('labRoot');
  root.innerHTML = '';
  root.appendChild(sectionComposer());
  root.appendChild(sectionPool());
}

/* ---- Khối tô màu (Scratch-style) ---- */
function labBlock(cls, tag, kids) {
  return el('div', { class: 'lab-block ' + cls }, [
    el('div', { class: 'lab-tag' }, tag),
    el('div', { class: 'lab-body' }, kids),
  ]);
}
// Ô % (lưu 0-1, hiển thị 0-100)
function pctField(obj, key) {
  return el('input', {
    type: 'number', step: 1, class: 'num', value: Math.round((obj[key] || 0) * 100),
    oninput: (e) => { const v = parseFloat(e.target.value); obj[key] = isNaN(v) ? 0 : v / 100; },
  });
}

/* ---- A. Khối tạo skill ---- */
function sectionComposer() {
  const d = labDraft;
  const sec = el('section', { class: 'card-block' }, [ el('h2', {}, 'Tạo skill (ghép block)') ]);
  sec.appendChild(el('p', { class: 'hint' }, 'Ghép: KHI NÀO → TỈ LỆ → LÀM GÌ. Đặt tên rồi Lưu — skill vào pool chọn khi lên cấp.'));

  // Block Trigger
  const trigSel = el('select', { class: 'sel', onchange: (e) => { d.trigger = e.target.value; renderSkillLab(); } });
  TRIGGER_DEFS.forEach(t => trigSel.appendChild(el('option', { value: t.key, ...(d.trigger === t.key ? { selected: 'selected' } : {}) }, t.label)));
  sec.appendChild(labBlock('blk-trigger', 'KHI NÀO', [trigSel]));

  // Block Tỉ lệ / Tần suất
  if (d.trigger === 'everyShots') {
    sec.appendChild(labBlock('blk-chance', 'TẦN SUẤT', [labeled('Mỗi N phát bắn', numField(d, 'every', 1))]));
  } else {
    sec.appendChild(labBlock('blk-chance', 'TỈ LỆ', [labeled('% kích hoạt', pctField(d, 'chance'))]));
  }

  // Block Effect + params
  const effSel = el('select', { class: 'sel', onchange: (e) => { d.effect = e.target.value; d.params = {}; renderSkillLab(); } });
  EFFECT_DEFS.forEach(ef => effSel.appendChild(el('option', { value: ef.key, ...(d.effect === ef.key ? { selected: 'selected' } : {}) }, ef.label)));
  const effKids = [effSel];
  effectDef(d.effect).params.forEach(pr => {
    if (d.params[pr.k] === undefined) d.params[pr.k] = pr.def;
    effKids.push(labeled(pr.label, numField(d.params, pr.k, pr.k === 'factor' ? 0.05 : 1)));
  });
  sec.appendChild(labBlock('blk-effect', 'LÀM GÌ', effKids));

  // Tên + Lưu
  sec.appendChild(el('div', { class: 'btn-row' }, [
    labeled('Tên skill', txtField(d, 'name', 'vd: Lightning Shot')),
    el('button', { class: 'mini', onclick: saveDraft }, '＋ Lưu skill'),
  ]));
  return sec;
}

function saveDraft() {
  const d = labDraft;
  if (!d.name.trim()) { alert('Đặt tên skill đã nhé.'); return; }
  let n = 1; while (Store.getSkill('cst_' + n)) n++;
  Store.addCustomSkill({
    id: 'cst_' + n, name: d.name.trim(), element: 'custom', custom: true, maxLevel: 1, enabled: true,
    trigger: d.trigger, chance: d.chance, every: d.every,
    effect: d.effect, params: Object.assign({}, d.params),
  });
  labDraft = defaultDraft();
  renderSkillLab();
}

/* ---- B. Pool: bật/tắt skill xuất hiện khi lên cấp ---- */
function sectionPool() {
  const sec = el('section', { class: 'card-block' }, [ el('h2', {}, 'Pool skill (hiện khi lên cấp)') ]);
  sec.appendChild(el('p', { class: 'hint' }, 'Tích = skill được phép xuất hiện trong bảng chọn-1-trong-3. Bỏ tích = loại khỏi pool.'));
  Store.skills.forEach(s => {
    const on = s.enabled !== false;
    const row = el('div', { class: 'lab-skill' });
    const chk = el('input', { type: 'checkbox', ...(on ? { checked: 'checked' } : {}), onchange: (e) => { s.enabled = e.target.checked; Store.save(); } });
    const desc = s.custom ? describeCustomSkill(s) : (s.desc || '');
    row.appendChild(el('label', { class: 'lab-skill-main' }, [
      chk, el('b', {}, s.name + ' '),
      el('span', { class: 'hint' }, '— [' + elementLabel(s.element) + '] ' + desc),
    ]));
    if (s.custom) {
      row.appendChild(el('button', { class: 'mini danger sm', onclick: () => { if (confirm('Xoá skill "' + s.name + '"?')) { Store.removeSkill(s.id); renderSkillLab(); } } }, 'Xoá'));
    }
    sec.appendChild(row);
  });
  return sec;
}
