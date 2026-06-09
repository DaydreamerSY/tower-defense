/* ============================================================================
   [editor-dom.js] HELPER TẠO DOM cho màn Edit
   ----------------------------------------------------------------------------
   Phụ thuộc: data.js (Store — dùng trong numField/txtField để auto-save).
   Cung cấp toàn cục: el(), numField(), txtField(), labeled().
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
