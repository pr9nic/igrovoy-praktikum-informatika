// «Битва класса» внутри игрового практикума — свой аналог Wayground (Quizizz): викторины всем классом.
// Ученики класса попадают в лобби учителя сами (без кодов и QR). Ответы проверяет сервер (battle_api.py).
// Режимы: классика, под руководством учителя, командный, тест, «Восхождение». 17 типов вопросов, усилители, мемы,
// музыка, вопрос-реванш, чтение вслух, особые условия для учеников, живая таблица учителя, отчёты.
(() => {
  'use strict';
  const ART = 'art/bt/';
  const API = (path, body) => fetch('/results/api/battle/' + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {}), cache: 'no-store'})
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok || d.status !== 'ok') { const e = new Error(d.message || 'сервер не ответил'); e.status = r.status; throw e; } return d; });
  const h = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const btn = (text, cls, fn) => { const b = h('button', cls, text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; };
  const img = (src, cls, alt = '') => { const i = h('img', cls); i.src = src; i.alt = alt; i.loading = 'lazy'; return i; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const MODES = {
    classic: ['Классика', 'Каждый в своём темпе: таблица лидеров, усилители, мемы и вопрос-реванш.'],
    paced: ['Под руководством учителя', 'Вопросы идут на проекторе по команде учителя, ученики отвечают со своих компьютеров.'],
    team: ['Командный', 'Класс делится на команды, счёт команды — средний по участникам.'],
    test: ['Тест', 'Без игровых элементов: ни лидеров, ни мемов, ни усилителей — только вопросы.'],
    peak: ['Восхождение', 'Подъём на вершину: ошибки возвращаются позже, пока не освоишь; привалы с усилителями и мини-играми.']};
  const POWER = {fifty: ['50 на 50', 'убирает половину неверных вариантов'], eraser: ['Ластик', 'убирает один неверный вариант'], double: ['Двойные очки', '×2 за следующий ответ'],
    jeopardy: ['Всё или ничего', '×2 за верный ответ, но ошибка отнимет очки'], immunity: ['Щит', 'ещё одна попытка, если ошибёшься'], freeze: ['Заморозка', 'время не снижает очки за следующий ответ'],
    streak_boost: ['Разгон серии', 'серия верных ответов +2'], streak_saver: ['Спасатель серии', 'одна ошибка не обнулит серию'], supersonic: ['Сверхзвук', 'полный бонус скорости на 3 вопроса'],
    gift: ['Подарок', 'всем одноклассникам по 150 очков'], glitch: ['Глюк', 'у остальных экран дрожит 5 секунд'], powerplay: ['Мощь класса', 'всем +50 % очков на 20 секунд']};
  const TYPES = {single: 'Один ответ', multi: 'Несколько ответов', poll: 'Опрос', fill: 'Ответ в поле', math: 'Числовой ответ', open: 'Открытый ответ', cloud: 'Облако слов',
    match: 'Сопоставление', reorder: 'Порядок', categorize: 'Группы', dragdrop: 'Перетащи слова', dropdown: 'Выпадающие списки', label: 'Подписи на картинке',
    hotspot: 'Область на картинке', graph: 'Точки на плоскости', draw: 'Рисунок', slide: 'Слайд'};
  const TYPE_ICON = {single: '◉', multi: '☑', poll: '📊', fill: '✎', math: '∑', open: '💬', cloud: '☁', match: '⇄', reorder: '⇅', categorize: '▦', dragdrop: '✋', dropdown: '▾', label: '🏷', hotspot: '🎯', graph: '📈', draw: '🎨', slide: '📄'};
  const GOOD = ['Огонь!', 'Так держать!', 'Мозг на максимум!', 'Красота!', 'Ты в ударе!', 'Точно в цель!', 'Гениально!', 'Супер!'];
  const BAD = ['Бывает!', 'Почти!', 'Следующий точно твой', 'Не сдавайся!', 'Ошибка — тоже опыт', 'Ещё чуть-чуть!', 'Соберись!', 'Разберёмся!'];
  const COLORS = ['#e2453c', '#2f7fd0', '#e8a317', '#21a36a', '#9b59d0', '#e0457b', '#16a3b8', '#7a8a99'];
  const SHAPES = ['▲', '◆', '●', '■', '★', '⬟', '⬢', '✚'];
  const TIERS = ['Бронзовая лига', 'Серебряная лига', 'Золотая лига', 'Платиновая лига'];
  const THEMES = {info: 'Пик Информатики', elbrus: 'Эльбрус', fuji: 'Фудзи'};

  /* ---------- звук: музыка и эффекты синтезируются в браузере ---------- */
  const Sound = {ctx: null, on: true, timer: 0, kind: '',
    init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; },
    tone(f, t0, dur, type = 'square', vol = 0.05) { const c = this.ctx; if (!c) return; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02); },
    sfx(name) { if (!this.on || !this.init()) return; const t = this.ctx.currentTime;
      if (name === 'good') [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.07, 0.18, 'triangle', 0.08));
      else if (name === 'bad') [330, 262].forEach((f, i) => this.tone(f, t + i * 0.12, 0.22, 'sawtooth', 0.04));
      else if (name === 'power') [700, 900, 1200].forEach((f, i) => this.tone(f, t + i * 0.05, 0.12, 'sine', 0.07));
      else if (name === 'tick') this.tone(1200, t, 0.04, 'square', 0.02);
      else if (name === 'win') [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.11, 0.25, 'triangle', 0.08)); },
    music(kind) { // простая фоновая петля: бас и арпеджио, 4 такта
      if (kind === this.kind) return; this.stop(); this.kind = kind; if (!this.on || !kind || !this.init()) return;
      const prog = kind === 'lobby' ? [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]] : kind === 'peak' ? [[196, 247, 294], [220, 262, 330], [175, 220, 262], [165, 208, 247]] : [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
      const beat = kind === 'lobby' ? 0.32 : 0.24; let bar = 0;
      const play = () => { const t = this.ctx.currentTime + 0.05, ch = prog[bar++ % prog.length];
        for (let i = 0; i < 8; i++) { this.tone(ch[i % 3] * (i % 4 === 3 ? 2 : 1), t + i * beat, beat * 0.9, 'triangle', 0.025); if (i % 2 === 0) this.tone(ch[0] / 2, t + i * beat, beat * 1.6, 'sine', 0.05); } };
      play(); this.timer = setInterval(play, beat * 8 * 1000); },
    stop() { clearInterval(this.timer); this.timer = 0; this.kind = ''; }};
  const speak = text => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ru-RU'; u.rate = 0.95; speechSynthesis.speak(u); } catch {} };
  const qSpeech = q => [q.text, ...(q.parts ? [q.parts.join(' … ')] : []), ...(q.options || []).map((o, i) => `${i + 1}: ${o}`)].join('. ');

  /* ---------- вопросы: вид и ответ ученика (17 типов) ---------- */
  // renderQ рисует вопрос в host и вызывает submit(answer) — ответ в обозначениях сервера.
  function renderQ(q, host, submit, opts = {}) {
    const box = h('div', 'bq bq-t-' + q.type), removed = new Set(q.removed || []);
    if (q.text) { const t = h('div', 'bq-text'); t.textContent = q.text; box.append(t); }
    const go = (label, fn, cls = 'bq-go') => { const b = btn(label, cls, fn); b.dataset.act = 'bt-submit'; return b; };
    const pic = () => { if (!q.image) return null; const w = h('div', 'bq-pic'); w.append(img(q.image, '', 'картинка к вопросу')); return w; };
    const T = q.type;
    if (T === 'single' || T === 'poll' || T === 'multi') {
      const p = pic(); if (p) box.append(p);
      const grid = h('div', 'bq-opts n' + q.options.length), chosen = new Set();
      q.options.forEach((o, i) => { const b = btn('', 'bq-opt', () => {
          if (T === 'multi') { chosen.has(i) ? chosen.delete(i) : chosen.add(i); b.classList.toggle('on', chosen.has(i)); } else submit(i); });
        b.style.setProperty('--c', COLORS[i % 8]); b.dataset.opt = i; b.append(h('span', 'bq-shape', SHAPES[i % 8]), h('span', 'bq-otext', o));
        if (removed.has(i)) { b.disabled = true; b.classList.add('gone'); } grid.append(b); });
      box.append(grid);
      if (T === 'multi') box.append(h('p', 'bq-hint', 'Выбери все верные варианты'), go('Ответить', () => submit([...chosen].sort((a, b) => a - b))));
    } else if (T === 'fill' || T === 'math' || T === 'cloud') {
      const p = pic(); if (p) box.append(p);
      const row = h('form', 'bq-row'), inp = h('input', 'bq-input'); inp.dataset.field = 'bt-answer'; inp.autocomplete = 'off';
      inp.placeholder = T === 'math' ? 'Число, например 3,5 или 1/4' : T === 'cloud' ? 'Одно-три слова' : 'Твой ответ'; if (T === 'math') inp.inputMode = 'decimal';
      row.append(inp); if (q.unit) row.append(h('span', 'bq-unit', q.unit)); row.append(go('Ответить', null)); row.addEventListener('submit', e => { e.preventDefault(); if (inp.value.trim()) submit(inp.value.trim()); });
      box.append(row); setTimeout(() => inp.focus(), 50);
    } else if (T === 'open') {
      const p = pic(); if (p) box.append(p);
      const ta = h('textarea', 'bq-area'); ta.rows = 5; ta.maxLength = 600; ta.placeholder = 'Ответь своими словами'; ta.dataset.field = 'bt-answer';
      box.append(ta, go('Отправить', () => ta.value.trim() && submit(ta.value.trim()))); setTimeout(() => ta.focus(), 50);
    } else if (T === 'slide') {
      const p = pic(); if (p) box.append(p); box.classList.add('bq-t-slide'); box.append(go('Дальше ▶', () => submit(null)));
    } else if (T === 'match') {
      const ans = q.left.map(() => null); let sel = -1;
      const cols = h('div', 'bq-match'), L = h('div', 'bq-col'), R = h('div', 'bq-col');
      const draw = () => { L.replaceChildren(); R.replaceChildren();
        q.left.forEach((t, i) => { const b = btn(t, 'bq-chip' + (sel === i ? ' sel' : '') + (ans[i] != null ? ' done' : ''), () => { sel = i; draw(); }); b.dataset.left = i; if (ans[i] != null) b.style.setProperty('--c', COLORS[i % 8]); L.append(b); });
        q.right.forEach((t, j) => { const owner = ans.indexOf(j), b = btn(t, 'bq-chip' + (owner >= 0 ? ' done' : ''), () => { if (sel < 0) { if (owner >= 0) { ans[owner] = null; draw(); } return; } const prev = ans.indexOf(j); if (prev >= 0) ans[prev] = null; ans[sel] = j; sel = ans.indexOf(null); draw(); });
          b.dataset.right = j; if (owner >= 0) b.style.setProperty('--c', COLORS[owner % 8]); R.append(b); }); };
      draw(); cols.append(L, h('div', 'bq-mid', '⇄'), R); box.append(h('p', 'bq-hint', 'Щёлкни слева, затем подходящее справа'), cols, go('Ответить', () => submit(ans)));
    } else if (T === 'reorder') {
      const order = q.items.map((_, i) => i), list = h('ol', 'bq-order'); let drag = -1;
      const draw = () => { list.replaceChildren(); order.forEach((it, pos) => { const li = h('li', 'bq-ord'); li.draggable = true; li.dataset.pos = pos;
        li.append(h('span', 'bq-grip', '⋮⋮'), h('span', 'bq-otext', q.items[it]), btn('▲', 'bq-mv', () => { if (pos) { [order[pos - 1], order[pos]] = [order[pos], order[pos - 1]]; draw(); } }), btn('▼', 'bq-mv', () => { if (pos < order.length - 1) { [order[pos + 1], order[pos]] = [order[pos], order[pos + 1]]; draw(); } }));
        li.addEventListener('dragstart', () => { drag = pos; }); li.addEventListener('dragover', e => e.preventDefault());
        li.addEventListener('drop', e => { e.preventDefault(); if (drag >= 0 && drag !== pos) { const [x] = order.splice(drag, 1); order.splice(pos, 0, x); draw(); } }); list.append(li); }); };
      draw(); box.append(h('p', 'bq-hint', 'Перетащи или двигай стрелками: сверху — первый'), list, go('Ответить', () => submit([...order])));
    } else if (T === 'categorize') {
      const ans = q.items.map(() => null); let sel = -1;
      const pool = h('div', 'bq-pool'), cats = h('div', 'bq-cats n' + q.cats.length);
      const chip = i => { const b = btn(q.items[i], 'bq-chip' + (sel === i ? ' sel' : ''), () => { sel = sel === i ? -1 : i; draw(); }); b.draggable = true; b.dataset.item = i; b.addEventListener('dragstart', () => { sel = i; }); return b; };
      const draw = () => { pool.replaceChildren(...q.items.map((_, i) => i).filter(i => ans[i] == null).map(chip)); cats.replaceChildren();
        q.cats.forEach((c, k) => { const z = h('div', 'bq-cat'); z.dataset.cat = k; z.append(h('b', '', c)); q.items.forEach((_, i) => { if (ans[i] === k) z.append(chip(i)); });
          const put = () => { if (sel >= 0) { ans[sel] = k; sel = -1; draw(); } }; z.addEventListener('click', e => { if (e.target === z || e.target.tagName === 'B') put(); }); z.addEventListener('dragover', e => e.preventDefault()); z.addEventListener('drop', e => { e.preventDefault(); put(); }); cats.append(z); }); };
      draw(); box.append(h('p', 'bq-hint', 'Выбери элемент и щёлкни по группе (или перетащи)'), pool, cats, go('Ответить', () => submit(ans)));
    } else if (T === 'dragdrop' || T === 'dropdown') {
      const n = q.parts.length - 1, ans = Array(n).fill(null), line = h('div', 'bq-cloze'), bank = h('div', 'bq-pool'); let sel = -1;
      const draw = () => { line.replaceChildren(); q.parts.forEach((t, b) => { line.append(document.createTextNode(t)); if (b >= n) return;
          if (T === 'dropdown') { const s = h('select', 'bq-sel'); s.dataset.blank = b; s.append(h('option', '', '…')); q.lists[b].forEach((o, i) => { const op = h('option', '', o); op.value = i; s.append(op); }); s.value = ans[b] == null ? '' : ans[b]; if (ans[b] == null) s.selectedIndex = 0; s.addEventListener('change', () => { ans[b] = s.selectedIndex ? Number(s.value) : null; }); line.append(s); }
          else { const slot = btn(ans[b] == null ? '      ' : q.bank[ans[b]], 'bq-slot' + (ans[b] != null ? ' full' : ''), () => { if (sel >= 0) { const prev = ans.indexOf(sel); if (prev >= 0) ans[prev] = null; ans[b] = sel; sel = -1; } else ans[b] = null; draw(); });
            slot.dataset.blank = b; slot.addEventListener('dragover', e => e.preventDefault()); slot.addEventListener('drop', e => { e.preventDefault(); slot.click(); }); line.append(slot); } });
        if (T === 'dragdrop') bank.replaceChildren(...q.bank.map((w, i) => { const c = btn(w, 'bq-chip' + (sel === i ? ' sel' : '') + (ans.includes(i) ? ' used' : ''), () => { sel = sel === i ? -1 : i; draw(); }); c.dataset.word = i; c.draggable = true; c.addEventListener('dragstart', () => { sel = i; }); return c; })); };
      draw(); if (T === 'dragdrop') box.append(h('p', 'bq-hint', 'Выбери слово и щёлкни по пропуску (или перетащи)'), bank); box.append(line, go('Ответить', () => submit(ans)));
    } else if (T === 'label') {
      const ans = q.spots.map(() => null), wrap = h('div', 'bq-pic bq-label'), bank = h('div', 'bq-pool'); let sel = -1; wrap.append(img(q.image, '', 'картинка'));
      const draw = () => { wrap.querySelectorAll('.bq-spot').forEach(x => x.remove()); q.spots.forEach((s, k) => { const d = btn(ans[k] == null ? String(k + 1) : q.labels[ans[k]], 'bq-spot' + (ans[k] != null ? ' full' : ''), () => { if (sel >= 0) { const prev = ans.indexOf(sel); if (prev >= 0) ans[prev] = null; ans[k] = sel; sel = -1; } else ans[k] = null; draw(); });
          d.style.left = s.x + '%'; d.style.top = s.y + '%'; d.dataset.spot = k; d.addEventListener('dragover', e => e.preventDefault()); d.addEventListener('drop', e => { e.preventDefault(); d.click(); }); wrap.append(d); });
        bank.replaceChildren(...q.labels.map((w, i) => { const c = btn(w, 'bq-chip' + (sel === i ? ' sel' : '') + (ans.includes(i) ? ' used' : ''), () => { sel = sel === i ? -1 : i; draw(); }); c.dataset.label = i; c.draggable = true; c.addEventListener('dragstart', () => { sel = i; }); return c; })); };
      draw(); box.append(h('p', 'bq-hint', 'Выбери подпись и щёлкни по точке на картинке'), bank, wrap, go('Ответить', () => submit(ans)));
    } else if (T === 'hotspot') {
      const wrap = h('div', 'bq-pic bq-hot'), mark = h('div', 'bq-mark'); let at = null; wrap.append(img(q.image, '', 'картинка'));
      wrap.addEventListener('click', e => { const r = wrap.querySelector('img').getBoundingClientRect(); at = {x: Math.round(1000 * (e.clientX - r.left) / r.width) / 10, y: Math.round(1000 * (e.clientY - r.top) / r.height) / 10}; mark.style.left = at.x + '%'; mark.style.top = at.y + '%'; if (!mark.isConnected) wrap.append(mark); });
      box.append(h('p', 'bq-hint', 'Щёлкни по нужному месту на картинке'), wrap, go('Ответить', () => at && submit(at)));
    } else if (T === 'graph') {
      const cv = h('canvas', 'bq-cv-graph'), pts = []; cv.width = 440; cv.height = 440; const S = 20, O = 220;
      const draw = () => { const g = cv.getContext('2d'); g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 440, 440); g.font = '11px system-ui'; g.textAlign = 'center';
        for (let k = -10; k <= 10; k++) { g.strokeStyle = k ? '#d9dee8' : '#334'; g.lineWidth = k ? 1 : 2; g.beginPath(); g.moveTo(O + k * S, 0); g.lineTo(O + k * S, 440); g.moveTo(0, O - k * S); g.lineTo(440, O - k * S); g.stroke(); if (k && k % 2 === 0) { g.fillStyle = '#556'; g.fillText(k, O + k * S, O + 13); g.fillText(k, O - 10, O - k * S + 4); } }
        for (const [x, y] of pts) { g.fillStyle = '#e2453c'; g.beginPath(); g.arc(O + x * S, O - y * S, 7, 0, 7); g.fill(); g.fillStyle = '#1b2333'; g.fillText(`(${x}; ${y})`, O + x * S + 26, O - y * S - 9); } };
      cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(), x = Math.round(((e.clientX - r.left) * 440 / r.width - O) / S), y = Math.round((O - (e.clientY - r.top) * 440 / r.height) / S);
        if (Math.abs(x) > 10 || Math.abs(y) > 10) return; const i = pts.findIndex(p => p[0] === x && p[1] === y); if (i >= 0) pts.splice(i, 1); else { if (pts.length >= q.count) pts.shift(); pts.push([x, y]); } draw(); });
      draw(); box.append(h('p', 'bq-hint', `Отметь точек: ${q.count}. Щелчок по точке убирает её.`), cv, go('Ответить', () => pts.length && submit(pts)));
      cv.dataset.graph = '1';
    } else if (T === 'draw') {
      const cv = h('canvas', 'bq-cv-draw'), bar = h('div', 'bq-tools'); cv.width = 640; cv.height = 400; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 640, 400); g.lineCap = g.lineJoin = 'round';
      let color = '#1b2333', size = 4, down = false, last = null;
      if (q.image) { const bg = new Image(); bg.onload = () => g.drawImage(bg, 0, 0, 640, 400); bg.src = q.image; }
      for (const c of ['#1b2333', '#e2453c', '#2f7fd0', '#21a36a', '#e8a317', '#ffffff']) { const b = btn('', 'bq-color' + (c === color ? ' on' : ''), () => { color = c; size = c === '#ffffff' ? 18 : 4; bar.querySelectorAll('.bq-color').forEach(x => x.classList.toggle('on', x === b)); }); b.style.background = c; b.title = c === '#ffffff' ? 'ластик' : 'цвет'; bar.append(b); }
      bar.append(btn('Очистить', 'bq-mv', () => { g.fillStyle = '#fff'; g.fillRect(0, 0, 640, 400); }));
      const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 640 / r.width, (e.clientY - r.top) * 400 / r.height]; };
      cv.addEventListener('pointerdown', e => { down = true; last = at(e); cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', e => { if (!down) return; const p = at(e); g.strokeStyle = color; g.lineWidth = size; g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke(); last = p; });
      cv.addEventListener('pointerup', () => { down = false; });
      box.append(bar, cv, go('Отправить рисунок', () => { let d = cv.toDataURL('image/webp', 0.6); if (!d.startsWith('data:image/webp')) d = cv.toDataURL('image/jpeg', 0.6); submit(d); }));
    }
    host.replaceChildren(box);
    if (location.hostname === '127.0.0.1') window.btSubmit = submit;   // для проверок на стенде
    if (opts.read) speak(qSpeech(q));
    return box;
  }

  // Как выглядит верный ответ — для разбора после ответа и для проектора.
  function solText(q, sol) {
    const T = q.type;
    if (sol == null) return '';
    if (T === 'single') return q.options[sol];
    if (T === 'multi') return sol.map(i => q.options[i]).join('; ');
    if (T === 'fill' || T === 'math') return String(sol);
    if (T === 'match') return q.left.map((l, i) => `${l} — ${q.right[sol[i]]}`).join('; ');
    if (T === 'reorder') return sol.map(i => q.items[i]).join(' → ');
    if (T === 'categorize') return q.cats.map((c, k) => `${c}: ${q.items.filter((_, i) => sol[i] === k).join(', ')}`).join(' · ');
    if (T === 'dragdrop') return q.parts.map((t, b) => t + (b < sol.length ? `[${q.bank[sol[b]]}]` : '')).join('');
    if (T === 'dropdown') return q.parts.map((t, b) => t + (b < sol.length ? `[${q.lists[b][sol[b]]}]` : '')).join('');
    if (T === 'label') return q.spots.map((_, k) => `${k + 1} — ${q.labels[sol[k]]}`).join('; ');
    if (T === 'graph') return sol.map(p => `(${p[0]}; ${p[1]})`).join(', ');
    if (T === 'hotspot') return 'отмеченная область на картинке';
    return '';
  }
  // Подсветка верного ответа прямо в вопросе (варианты, места на картинке).
  function markSolution(box, q, sol, mine) {
    if (!box || sol == null) return;
    if (['single', 'multi'].includes(q.type)) box.querySelectorAll('.bq-opt').forEach((b, i) => { const right = q.type === 'single' ? i === sol : sol.includes(i); b.classList.add(right ? 'right' : 'dim'); if (!right && (mine === i || (Array.isArray(mine) && mine.includes(i)))) b.classList.add('wrong'); b.disabled = true; });
    if (q.type === 'hotspot') { const w = box.querySelector('.bq-hot'); for (const s of sol) { const c = h('div', 'bq-ring'); c.style.left = s.x + '%'; c.style.top = s.y + '%'; c.style.width = c.style.height = (2 * s.r) + '%'; w.append(c); } }
    box.querySelectorAll('.bq-go').forEach(b => { b.disabled = true; });
  }

  /* ---------- праздник: пьедестал и конфетти (без движения, если в системе включено «уменьшить движение») ---------- */
  const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  function confetti(host, ms = 6000) {
    if (calm() || !host) return null;
    const cv = h('canvas', 'bt-confetti'), g = cv.getContext('2d'); if (!g) return null; host.append(cv);
    const W = () => cv.width = host.clientWidth || 800, H = () => cv.height = host.clientHeight || 600; W(); H();
    const bits = Array.from({length: 170}, () => ({x: Math.random() * cv.width, y: -Math.random() * cv.height * 0.8, vx: (Math.random() - 0.5) * 80, vy: 90 + Math.random() * 160, r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, s: 6 + Math.random() * 8, c: COLORS[Math.floor(Math.random() * 7)]}));
    let last = performance.now(); const t0 = last;
    const frame = now => { if (!cv.isConnected) return; const dt = Math.min(0.05, (now - last) / 1000), fade = Math.max(0, Math.min(1, (t0 + ms - now) / 1200)); last = now;
      if (cv.width !== host.clientWidth || cv.height !== host.clientHeight) { W(); H(); } g.clearRect(0, 0, cv.width, cv.height); g.globalAlpha = fade;
      for (const b of bits) { b.x += b.vx * dt + Math.sin(now / 400 + b.s) * 0.6; b.y += b.vy * dt; b.r += b.vr * dt; if (b.y > cv.height + 20 && now - t0 < ms - 1500) { b.y = -20; b.x = Math.random() * cv.width; }
        g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.fillStyle = b.c; g.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); g.restore(); }
      if (fade > 0) requestAnimationFrame(frame); else cv.remove(); };
    requestAnimationFrame(frame); return cv;
  }
  // Пьедестал тройки лидеров: колонны поднимаются по очереди — третье, второе, первое место (анимация — в battle.css).
  function podium(top, climber, cls = '') {
    const pod = h('div', 'bt-podium ' + cls); if (calm()) pod.classList.add('calm');
    for (const [i, k] of [[1, 'silver'], [0, 'gold'], [2, 'bronze']]) { const t = top[i]; if (!t) continue; const c = h('div', 'bt-pod ' + k), col = h('div', 'bt-col');
      c.style.setProperty('--d', [1.1, 0.6, 0.1][i] + 's'); c.dataset.place = i + 1;
      col.append(h('i', '', String(i + 1))); c.append(img(climber(t.avatar), 'bt-podav', ''), h('b', '', t.name), h('span', '', String(t.score)), col); pod.append(c); }
    return pod;
  }

  window.BattleQ = {calm, confetti, podium, speakText: qSpeech, renderQ, solText, markSolution, TYPES, TYPE_ICON, h, btn, img, API, Sound, speak, MODES, POWER, COLORS, SHAPES, TIERS, THEMES, GOOD, BAD, ART, pick};
})();
