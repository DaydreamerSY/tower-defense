/* ============================================================================
   [levelup.js] LÊN CẤP & SKILL KHỞI ĐẦU: chọn 1 trong 3 (roguelike)
   ----------------------------------------------------------------------------
   Phụ thuộc: state.js (state), data.js (Store), skills.js (learnSkill,
   describeSkill, elementLabel, skillLvl). Thao tác overlay #levelupOverlay.
   ============================================================================ */

// Skill đủ điều kiện hiện trong pool: chưa max + đã có skill yêu cầu (requires) nếu có
function skillAvailable(s) {
  return s.enabled !== false                                  // pool: bật/tắt trong Skill Lab
    && skillLvl(s.id) < s.maxLevel
    && (!s.requires || skillLvl(s.requires) > 0);
}

// Lên cấp: bốc trong TẤT CẢ skill khả dụng
function offerLevelUp() {
  showSkillChoice(Store.skills.filter(skillAvailable), false);
}

// Vũ khí: chọn 1 skill KHỞI ĐẦU cùng hệ khi vào trận
function offerStarterSkill(element) {
  showSkillChoice(Store.skills.filter(s => s.element === element && skillAvailable(s)), true);
}

// Hiện 3 thẻ skill (starter=true: chọn khởi đầu, không trừ pendingLevelUps)
function showSkillChoice(pool, starter) {
  if (pool.length === 0) { if (!starter) state.pendingLevelUps = 0; resumePlay(); return; }
  state.paused = true;

  const heading = document.querySelector('#levelupOverlay h1');
  if (heading) heading.textContent = starter ? 'Kỹ năng khởi đầu' : 'Lên cấp!';

  const picks = [];
  const tmp = pool.slice();
  while (picks.length < 3 && tmp.length) {
    picks.push(tmp.splice(Math.floor(Math.random() * tmp.length), 1)[0]);
  }

  const wrap = document.getElementById('levelupCards');
  wrap.innerHTML = '';
  picks.forEach(s => {
    const cur = skillLvl(s.id), next = cur + 1;
    const lvlText = cur === 0 ? 'MỚI' : `Cấp ${cur} → ${next}`;
    const color = ELEMENT_COLORS[s.element] || '#4c8dff';
    const div = document.createElement('div');
    div.className = 'card';
    div.style.borderColor = color;
    div.style.borderLeftWidth = '6px';
    div.innerHTML = `<div class="name">${s.name}</div>
                     <div class="desc">${describeSkill(s, next)}</div>
                     <div class="lvl" style="color:${color}">${lvlText} · ${elementLabel(s.element)}</div>`;
    div.onclick = () => chooseSkill(s, starter);
    wrap.appendChild(div);
  });
  document.getElementById('levelupOverlay').classList.add('show');
}

function chooseSkill(s, starter) {
  learnSkill(s.id);
  document.getElementById('levelupOverlay').classList.remove('show');
  if (starter) { resumePlay(); return; }
  state.pendingLevelUps--;
  if (state.pendingLevelUps > 0) offerLevelUp(); // còn cấp chờ -> hiện tiếp
  else resumePlay();
}

function resumePlay() {
  document.getElementById('levelupOverlay').classList.remove('show');
  state.paused = false;
  lastTime = performance.now();
}
