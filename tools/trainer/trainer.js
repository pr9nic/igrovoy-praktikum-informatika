'use strict';
/* Игровой тренажёр: профили учеников, уровни-механики, отметка в журнал через School4Sections. */
(() => {
  const root = document.getElementById('trainer'), raw = document.getElementById('assignmentData');
  if (!root || !raw) return;
  const data = JSON.parse(raw.textContent), el = School4.element;
  // Ученик, который вошёл в игровой практикум (имя менять в игре нельзя).
  const LOCK = (() => { try { const w = JSON.parse(sessionStorage.getItem('school4-who') || 'null'); if (w && w.grade === data.grade && w.className && w.name && Date.now() - w.at < 20 * 60000) return w; } catch {} return null; })();
  const demo = location.pathname.startsWith('/authoring/') || (location.hostname === '127.0.0.1' && location.port === '18719');
  const storeKey = 'school4-trainer:v1:' + data.slug, sessionKey = 'school4-trainer-player:' + data.slug;
  const SESSION_MS = 90 * 60000;
  let store = {profiles: {}}, player = null, view = {name: 'login'}, token = 0, cleanup = [], debugAnswer = null;
  try { const s = JSON.parse(localStorage.getItem(storeKey)); if (s && s.profiles && typeof s.profiles === 'object') store = s; } catch {}

  function save(sync = true) {
    if (player) player.stamp = Date.now();
    try {
      localStorage.setItem(storeKey, JSON.stringify(store));
      if (player) sessionStorage.setItem(sessionKey, JSON.stringify({key: player.key, stamp: Date.now()}));
    } catch {}
    if (sync) push();
  }
  const norm = s => String(s).trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
  function button(text, cls, action) { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', action); return b; }
  const typing = e => ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
  function keys(handler) { const on = e => { if (!typing(e) && !e.ctrlKey && !e.altKey && !e.metaKey) handler(e); }; document.addEventListener('keydown', on); cleanup.push(() => document.removeEventListener('keydown', on)); }
  /* Стрелки переносят фокус по сетке кнопок; Enter и пробел нажимают кнопку штатно. */
  function roam(box, selector, cols) {
    keys(e => {
      const d = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols}[e.key]; if (!d) return;
      const all = [...box.querySelectorAll(selector)]; if (!all.length) return; e.preventDefault();
      let j = all.indexOf(document.activeElement); if (j < 0) { all.find(n => !n.disabled)?.focus({preventScroll: true}); return; }
      do { j += d; } while (j >= 0 && j < all.length && all[j].disabled && Math.abs(d) === 1);
      if (j >= 0 && j < all.length && !all[j].disabled) all[j].focus({preventScroll: true});
    });
  }
  const keyHint = text => el('p', 't-keys', '⌨ ' + text);
  const ART = {
    gem: '<svg viewBox="0 0 32 32"><path d="M8 5h16l6 8-14 15L2 13z" fill="#3fa9e0"/><path d="M8 5l8 8 8-8M2 13h28M16 13v15" stroke="#fff" stroke-width="1.4" fill="none" opacity=".75"/><path d="M8 5h16l-8 8z" fill="#8fd4f7"/></svg>',
    flag: '<svg viewBox="0 0 32 32"><path d="M9 3v27" stroke="#5b4a2a" stroke-width="3" stroke-linecap="round"/><path d="M10 4h16l-5 6 5 6H10z" fill="#e2483d"/><path d="M10 4h16l-5 6H10z" fill="#f47c6c"/></svg>',
    virus: '<svg viewBox="0 0 40 40"><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M20 3v7M20 30v7M3 20h7M30 20h7M8 8l5 5M27 27l5 5M32 8l-5 5M8 32l5-5"/></g><circle cx="20" cy="20" r="11" fill="currentColor"/><circle cx="16" cy="18" r="3" fill="#fff"/><circle cx="24" cy="18" r="3" fill="#fff"/><circle cx="16" cy="18" r="1.3"/><circle cx="24" cy="18" r="1.3"/><path d="M15 25q5-4 10 0" stroke="#fff" stroke-width="1.6" fill="none"/></svg>',
    guest: '<svg viewBox="0 0 40 44"><path d="M20 8V3" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="3" r="2.5" fill="#f1cf5b"/><rect x="7" y="8" width="26" height="20" rx="7" fill="currentColor"/><circle cx="15" cy="17" r="4" fill="#fff"/><circle cx="25" cy="17" r="4" fill="#fff"/><circle cx="15" cy="17" r="1.8" fill="#173c3a"/><circle cx="25" cy="17" r="1.8" fill="#173c3a"/><rect x="11" y="30" width="18" height="11" rx="4" fill="currentColor" opacity=".8"/><path d="M5 32v7M35 32v7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    truck: '<svg viewBox="0 0 40 30"><rect x="2" y="6" width="22" height="15" rx="2" fill="#e8823a"/><path d="M24 11h8l6 6v4H24z" fill="#f6b26b"/><path d="M27 13h4l3 3h-7z" fill="#dff1fb"/><circle cx="10" cy="23" r="4.5" fill="#2b2b2b"/><circle cx="30" cy="23" r="4.5" fill="#2b2b2b"/><circle cx="10" cy="23" r="1.8" fill="#bbb"/><circle cx="30" cy="23" r="1.8" fill="#bbb"/></svg>',
    folder: '<svg viewBox="0 0 32 26"><path d="M2 5a3 3 0 013-3h7l3 4h12a3 3 0 013 3v12a3 3 0 01-3 3H5a3 3 0 01-3-3z" fill="#e6a934"/><path d="M2 10h28v11a3 3 0 01-3 3H5a3 3 0 01-3-3z" fill="#f6cf62"/></svg>',
    file: '<svg viewBox="0 0 26 32"><path d="M3 3a2 2 0 012-2h11l7 7v21a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="#eef4f8" stroke="#8aa3b5" stroke-width="1.5"/><path d="M16 1v7h7" fill="#cfdde8" stroke="#8aa3b5" stroke-width="1.5"/><path d="M7 15h12M7 20h12M7 25h8" stroke="#8aa3b5" stroke-width="1.6" stroke-linecap="round"/></svg>',
    crate: '<svg viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="3" fill="#c98a4b"/><path d="M2 9h28M2 23h28M9 2v28M23 2v28" stroke="#8a5a2b" stroke-width="2"/><path d="M9 9l14 14M23 9L9 23" stroke="#8a5a2b" stroke-width="2"/></svg>',
    car: '<svg viewBox="0 0 40 64"><rect x="6" y="4" width="28" height="56" rx="10" fill="#e2483d"/><rect x="10" y="14" width="20" height="12" rx="4" fill="#bfe3f5"/><rect x="10" y="40" width="20" height="9" rx="3" fill="#8fc4dc"/><rect x="1" y="12" width="6" height="12" rx="2" fill="#222"/><rect x="33" y="12" width="6" height="12" rx="2" fill="#222"/><rect x="1" y="40" width="6" height="12" rx="2" fill="#222"/><rect x="33" y="40" width="6" height="12" rx="2" fill="#222"/><rect x="10" y="5" width="6" height="3" rx="1" fill="#ffe9a3"/><rect x="24" y="5" width="6" height="3" rx="1" fill="#ffe9a3"/></svg>',
    ship: '<svg viewBox="0 0 48 48"><path d="M24 2l9 22 11 12-12 2-3 8H19l-3-8-12-2 11-12z" fill="#dfe9f2" stroke="#6b8196" stroke-width="2"/><path d="M24 8l5 16H19z" fill="#3fa9e0"/><path d="M19 46l5-8 5 8z" fill="#ffb347"/></svg>',
    ufo: '<svg viewBox="0 0 48 30"><ellipse cx="24" cy="18" rx="22" ry="8" fill="currentColor"/><path d="M12 16a12 12 0 0124 0z" fill="#bfe3f5"/><circle cx="10" cy="19" r="2" fill="#ffe9a3"/><circle cx="24" cy="22" r="2" fill="#ffe9a3"/><circle cx="38" cy="19" r="2" fill="#ffe9a3"/></svg>',
    hero: '<svg viewBox="0 0 40 46"><ellipse cx="20" cy="43" rx="11" ry="3" fill="#0003"/><rect x="11" y="24" width="18" height="16" rx="6" fill="#3a84b8"/><rect x="8" y="26" width="5" height="11" rx="2.5" fill="#f2c9a0"/><rect x="27" y="26" width="5" height="11" rx="2.5" fill="#f2c9a0"/><circle cx="20" cy="15" r="10" fill="#f2c9a0"/><path d="M9 14a11 11 0 0122 0l3 1v3H9z" fill="#e2483d"/><circle cx="16" cy="17" r="1.6" fill="#173c3a"/><circle cx="24" cy="17" r="1.6" fill="#173c3a"/><path d="M16 21q4 3 8 0" stroke="#173c3a" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
    apple: '<svg viewBox="0 0 32 32"><path d="M16 9c-6-4-12 0-12 8 0 7 5 12 9 12 2 0 2-1 3-1s1 1 3 1c4 0 9-5 9-12 0-8-6-12-12-8z" fill="#3fb96a"/><path d="M16 9c0-3 2-6 5-7" stroke="#5b4a2a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    bug: '<svg viewBox="0 0 32 32"><ellipse cx="16" cy="18" rx="9" ry="10" fill="#d9483b"/><circle cx="16" cy="8" r="5" fill="#2b2b2b"/><path d="M16 9v19M5 13l5 3M27 13l-5 3M4 21h6M28 21h-6" stroke="#2b2b2b" stroke-width="2" stroke-linecap="round"/></svg>'};
  const sprite = (name, cls = '') => { const node = el('span', 't-art ' + cls); node.innerHTML = ART[name]; node.setAttribute('aria-hidden', 'true'); return node; };
  function shake(node) { node.classList.remove('t-hit'); void node.offsetWidth; node.classList.add('t-hit'); }
  const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  const times = n => (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) ? 'раза' : 'раз';
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const teacher = () => !!School4.context.teacher;
  const rec = level => player.levels[level.id];
  const worldStars = (world, levels = player.levels) => world.levels.reduce((s, l) => s + (levels[l.id]?.stars || 0), 0);
  function worldMark(world, levels = player.levels) {
    const pct = worldStars(world, levels) / (3 * world.levels.length) * 100, g = data.grading;
    return pct >= g.five ? 5 : pct >= g.four ? 4 : pct >= g.three ? 3 : 2;
  }
  const need = (world, pct) => Math.ceil(3 * world.levels.length * pct / 100 - 1e-9);

  /* ---------- выражения и программы ---------- */
  const PREC = {'<->': 0.3, '->': 0.6, or: 1, and: 2, not: 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '==': 4, '!=': 4, '+': 5, '-': 5, '*': 6, '//': 6, '/': 6, '%': 6, '**': 7};
  const RU_OP = {and: 'и', or: 'или', not: 'не', '//': 'div', '%': 'mod', '==': '=', '!=': '≠', '<=': '≤', '>=': '≥'};
  const L_OP = {and: 'И', or: 'ИЛИ', not: 'НЕ', '->': '→', '<->': '≡'};
  function ev(e, env) {
    if (typeof e === 'number') return e;
    if (typeof e === 'string') { if (!(e in env)) throw new Error('Нет переменной ' + e); return env[e]; }
    const [op, a, b] = e;
    if (op === 'at') return env[a][ev(b, env)];
    if (op === 'len') return env[a].length;
    const x = ev(a, env);
    if (op === 'not') return x ? 0 : 1;
    if (op === '->') return !x || ev(b, env) ? 1 : 0;
    if (op === '<->') return !x === !ev(b, env) ? 1 : 0;
    if (op === 'and') return x && ev(b, env) ? 1 : 0;
    if (op === 'or') return x || ev(b, env) ? 1 : 0;
    const y = ev(b, env);
    switch (op) {
      case '+': return x + y; case '-': return x - y; case '*': return x * y; case '/': return x / y;
      case '//': return Math.floor(x / y); case '%': return ((x % y) + y) % y; case '**': return x ** y;
      case '<': return +(x < y); case '>': return +(x > y); case '<=': return +(x <= y); case '>=': return +(x >= y);
      case '==': return +(x === y); case '!=': return +(x !== y);
    }
    throw new Error('Неизвестная операция ' + op);
  }
  function tx(e, lang, parent = 0, right = false) {
    if (typeof e !== 'object') return String(e);
    const [op, a, b] = e;
    if (op === 'at') return a + '[' + tx(b, lang) + ']';
    if (op === 'len') return 'len(' + a + ')';
    const p = PREC[op], name = lang === 'ru' ? (RU_OP[op] || op) : lang === 'L' ? (L_OP[op] || op) : op;
    const s = op === 'not' ? name + ' ' + tx(a, lang, p) : tx(a, lang, p) + ' ' + name + ' ' + tx(b, lang, p, true);
    return (p < parent || (p === parent && right)) ? '(' + s + ')' : s;
  }
  function codeLines(level, lang) {
    const lines = [], ru = lang === 'ru';
    const W = ru ? {R: 'вправо', L: 'влево', U: 'вверх', D: 'вниз'} : {R: 'вправо()', L: 'влево()', U: 'вверх()', D: 'вниз()'};
    function emit(list, depth, loop) {
      const pad = '    '.repeat(depth);
      for (const s of list) {
        s._line = lines.length;
        if (s.op === 'move') lines.push(pad + W[s.d]);
        else if (s.op === 'repeat') { lines.push(pad + (ru ? `повтори ${s.n} ${times(s.n)}:` : `for ${'ijk'[loop] || 'n'} in range(${s.n}):`)); emit(s.body, depth + 1, loop + 1); }
        else if (s.op === 'for') { lines.push(pad + (ru ? `для ${s.var} от ${s.from} до ${s.to - 1}:` : `for ${s.var} in range(${s.from}, ${s.to}):`)); emit(s.body, depth + 1, loop); }
        else if (s.op === 'set') lines.push(pad + s.var + (ru ? ' := ' : ' = ') + tx(s.expr, lang));
        else if (s.op === 'seta') lines.push(pad + s.arr + '[' + tx(s.idx, lang) + '] = ' + tx(s.expr, lang));
        else if (s.op === 'if') {
          lines.push(pad + (ru ? 'если ' : 'if ') + tx(s.cond, lang) + ':'); emit(s.then, depth + 1, loop);
          if (s.else?.length) { lines.push(pad + (ru ? 'иначе:' : 'else:')); emit(s.else, depth + 1, loop); }
        }
        else if (s.op === 'while') { lines.push(pad + (ru ? 'пока ' : 'while ') + tx(s.cond, lang) + ':'); emit(s.body, depth + 1, loop); }
        else if (s.op === 'call') lines.push(pad + s.name + (ru ? '' : '()'));
      }
    }
    for (const [name, values] of Object.entries(level.init || {})) lines.push(name + ' = ' + (Array.isArray(values) ? '[' + values.join(', ') + ']' : values));
    for (const [name, body] of Object.entries(level.funcs || {})) { lines.push((ru ? 'алгоритм ' : 'def ') + name + (ru ? ':' : '():')); emit(body, 1, 0); lines.push(''); }
    emit(level.program, 0, 0);
    return lines;
  }
  const traceMoves = level => runProgram(level).moves;
  function runProgram(level) {
    const env = JSON.parse(JSON.stringify(level.init || {})), moves = []; let guard = 0;
    function exec(list) {
      for (const s of list) {
        if (++guard > 3000) throw new Error('Слишком длинная программа');
        if (s.op === 'move') moves.push({d: s.d, line: s._line});
        else if (s.op === 'repeat') for (let i = 0; i < s.n; i++) exec(s.body);
        else if (s.op === 'for') for (let i = s.from; i < s.to; i++) { env[s.var] = i; exec(s.body); }
        else if (s.op === 'set') env[s.var] = ev(s.expr, env);
        else if (s.op === 'seta') env[s.arr][ev(s.idx, env)] = ev(s.expr, env);
        else if (s.op === 'if') exec(ev(s.cond, env) ? s.then : (s.else || []));
        else if (s.op === 'while') while (ev(s.cond, env)) { if (++guard > 3000) throw new Error('Цикл не заканчивается'); exec(s.body); }
        else if (s.op === 'call') exec(level.funcs[s.name]);
      }
    }
    exec(level.program);
    return {moves, env};
  }

  /* ---------- робот ---------- */
  const ORDER = 'NESW', DIRS = {N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0]}, STEP_LIMIT = 300;
  const COND_RU = {free: 'впереди свободно', wall: 'впереди стена', left: 'слева свободно', right: 'справа свободно', notgoal: 'не на финише'};
  const COND_PY = {free: 'впереди_свободно()', wall: 'впереди_стена()', left: 'слева_свободно()', right: 'справа_свободно()', notgoal: 'not на_финише()'};
  const BLOCK_RU = {forward: 'вперёд', left: 'налево', right: 'направо', repeat: 'повтори', while: 'пока', if: 'если'};
  function parseGrid(level) {
    const rows = level.grid, g = {w: rows[0].length, h: rows.length, crystals: new Set()};
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === 'S') { g.sx = x; g.sy = y; } else if (c === 'G') { g.gx = x; g.gy = y; } else if (c === '*') g.crystals.add(x + ',' + y);
    }));
    g.open = (x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && rows[y][x] !== '#';
    return g;
  }
  function robotRun(level, program) {
    const g = parseGrid(level), got = new Set(), events = [], edges = new Set();
    let x = g.sx, y = g.sy, d = ORDER.indexOf(level.dir || 'E'), steps = 0, status = '';
    const free = turn => { const [dx, dy] = DIRS[ORDER[(d + turn) % 4]]; return g.open(x + dx, y + dy); };
    const test = c => c === 'free' ? free(0) : c === 'wall' ? !free(0) : c === 'left' ? free(3) : c === 'right' ? free(1) : !(x === g.gx && y === g.gy);
    const push = (n, extra) => events.push({id: n._id, x, y, d, ...extra});
    function exec(list) {
      for (const n of list) {
        if (status) return;
        if (++steps > STEP_LIMIT) { status = 'limit'; return; }
        if (n.op === 'forward') {
          if (!free(0)) { status = 'crash'; push(n, {crash: true}); return; }
          const from = [x, y];
          x += DIRS[ORDER[d]][0]; y += DIRS[ORDER[d]][1];
          const k = x + ',' + y, pick = g.crystals.has(k) && !got.has(k);
          if (pick) got.add(k);
          edges.add([from.join(), k].sort().join('-'));
          push(n, {pick: pick ? k : '', line: [...from, x, y]});
        }
        else if (n.op === 'left') { d = (d + 3) % 4; push(n); }
        else if (n.op === 'right') { d = (d + 1) % 4; push(n); }
        else if (n.op === 'repeat') for (let i = 0; i < n.n && !status; i++) exec(n.body);
        else if (n.op === 'while') while (!status && test(n.cond)) { if (++steps > STEP_LIMIT) { status = 'limit'; return; } exec(n.body); }
        else if (n.op === 'if') exec(test(n.cond) ? n.then : n.else);
      }
    }
    exec(program);
    if (!status && level.target) status = edges.size === level.target.length && level.target.every(k => edges.has(k)) ? 'win' : 'shape';
    if (!status) status = x !== g.gx || y !== g.gy ? 'nogoal' : got.size < g.crystals.size ? 'crystals' : 'win';
    return {events, status};
  }
  const countBlocks = list => list.reduce((s, n) => s + 1 + (n.body ? countBlocks(n.body) : 0) + (n.then ? countBlocks(n.then) + countBlocks(n.else) : 0), 0);
  function robotPython(list, depth = 0, loop = 0, out = []) {
    const pad = '    '.repeat(depth);
    if (!list.length) out.push(pad + (depth ? 'pass' : '# программа пока пуста'));
    for (const n of list) {
      if (n.op === 'repeat') { out.push(pad + `for ${'ijk'[loop] || 'n'} in range(${n.n}):`); robotPython(n.body, depth + 1, loop + 1, out); }
      else if (n.op === 'while') { out.push(pad + `while ${COND_PY[n.cond]}:`); robotPython(n.body, depth + 1, loop, out); }
      else if (n.op === 'if') {
        out.push(pad + `if ${COND_PY[n.cond]}:`); robotPython(n.then, depth + 1, loop, out);
        if (n.else.length) { out.push(pad + 'else:'); robotPython(n.else, depth + 1, loop, out); }
      }
      else out.push(pad + BLOCK_RU[n.op] + '()');
    }
    return out;
  }

  const MECH = {};
  MECH.robot = (area, level, world, api) => {
    const g = parseGrid(level), conds = level.conds || ['free', 'wall', 'notgoal'], program = [];
    let cursor = {list: program, index: 0}, uid = 0, running = false, fast = false;
    const stage = el('div', 't-robot'), boardWrap = el('div', 't-board-wrap'), board = el('div', 't-board'), bot = el('div', 't-bot');
    board.style.setProperty('--cols', g.w); board.style.setProperty('--rows', g.h);
    const cells = {};
    level.grid.forEach((row, y) => [...row].forEach((c, x) => {
      const cell = el('div', 't-cell' + (c === '#' ? ' wall' : c === 'G' ? ' goal' : ''));
      if (c === 'G') cell.append(sprite('flag')); else if (c === '*') cell.append(sprite('gem'));
      if (c === '*') cell.classList.add('crystal');
      cells[x + ',' + y] = cell; board.append(cell);
    }));
    const NS = 'http://www.w3.org/2000/svg', ink = document.createElementNS(NS, 'svg'), drawn = document.createElementNS(NS, 'g');
    const line = (x1, y1, x2, y2, cls) => { const l = document.createElementNS(NS, 'line'); [['x1', x1, g.w], ['y1', y1, g.h], ['x2', x2, g.w], ['y2', y2, g.h]].forEach(([k, v, size]) => l.setAttribute(k, (v + .5) / size * 100)); l.setAttribute('class', cls); return l; };
    if (level.target) {
      ink.setAttribute('viewBox', '0 0 100 100'); ink.setAttribute('preserveAspectRatio', 'none'); ink.setAttribute('class', 't-ink'); ink.setAttribute('aria-hidden', 'true'); board.classList.add('t-draw');
      for (const k of level.target) ink.append(line(...k.split(/[,-]/).map(Number), 'goal'));
      ink.append(drawn); board.append(ink);
    }
    bot.innerHTML = '<svg viewBox="0 0 40 40"><path d="M20 9V3" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="3" r="2.5" fill="#f1cf5b"/><rect x="5" y="9" width="30" height="27" rx="8" fill="currentColor"/><circle cx="13.5" cy="18" r="4.5" fill="#fff"/><circle cx="26.5" cy="18" r="4.5" fill="#fff"/><circle cx="13.5" cy="16.5" r="2" fill="#173c3a"/><circle cx="26.5" cy="16.5" r="2" fill="#173c3a"/><rect x="13" y="27" width="14" height="3" rx="1.5" fill="#fff" opacity=".7"/></svg>';
    bot.setAttribute('aria-hidden', 'true'); board.append(bot); boardWrap.append(board);
    const legend = el('p', 'g-note', level.target ? 'Робот-исполнитель рисует пером. Пунктир — рисунок, который нужно получить: проведите все его линии и ни одной лишней.' : 'Робот смотрит туда, где у него глаза и антенна. Флажок — финиш' + (g.crystals.size ? ', синие кристаллы нужно собрать все' : '') + '. Кирпичные клетки — стены.');
    boardWrap.append(legend);
    function place(x, y, d, crash) {
      bot.style.left = (x + .5) / g.w * 100 + '%'; bot.style.top = (y + .5) / g.h * 100 + '%';
      bot.style.transform = `translate(-50%,-50%) rotate(${d * 90}deg)`; bot.classList.toggle('crash', !!crash);
    }
    function resetBoard() { place(g.sx, g.sy, ORDER.indexOf(level.dir || 'E')); for (const k of g.crystals) cells[k].classList.remove('got'); drawn.replaceChildren(); }
    const side = el('div', 't-editor'), palette = el('div', 't-palette'), editor = el('div', 't-program'), counter = el('p', 't-counter'), code = el('pre', 'g-code t-pycode');
    const runButton = button('▶ Запустить', 'g-primary', run), speed = button('Скорость: обычная', 'g-small', () => { fast = !fast; speed.textContent = 'Скорость: ' + (fast ? 'быстрая' : 'обычная'); });
    const clear = button('Очистить', 'g-small', () => { if (running) return; program.length = 0; cursor = {list: program, index: 0}; draw(); resetBoard(); });
    runButton.dataset.act = 'run'; speed.dataset.act = 'speed';
    for (const op of level.blocks) { const b = button(({forward: '↑ ', left: '↶ ', right: '↷ ', repeat: '⟳ ', while: '⟳ ', if: '◇ '})[op] + BLOCK_RU[op], 't-add t-' + op, () => add(op)); b.dataset.add = op; b.draggable = true; b.addEventListener('dragstart', e => drag(e, 'add:' + op)); b.addEventListener('dragend', dragEnd); palette.append(b); }
    function drag(e, what) { if (running) { e.preventDefault(); return; } e.stopPropagation(); e.dataTransfer.setData('text/plain', what); e.dataTransfer.effectAllowed = 'copyMove'; setTimeout(() => editor.classList.add('dragging'), 0); }
    function dragEnd() { editor.classList.remove('dragging'); }
    function locate(id, list = program) {
      for (let i = 0; i < list.length; i++) { if (list[i]._id === id) return {list, index: i}; for (const inner of [list[i].body, list[i].then, list[i].else]) { const found = inner && locate(id, inner); if (found) return found; } }
      return null;
    }
    const inside = (node, list) => [node.body, node.then, node.else].some(inner => inner && (inner === list || inner.some(child => inside(child, list))));
    function drop(what, list, i) {
      editor.classList.remove('dragging');
      if (running) return;
      if (what.startsWith('add:')) { cursor = {list, index: i}; add(what.slice(4)); return; }
      const from = locate(Number(what.slice(5))); if (!from) return;
      const node = from.list[from.index]; if (inside(node, list)) return;
      from.list.splice(from.index, 1); if (from.list === list && from.index < i) i--;
      list.splice(i, 0, node); cursor = {list, index: i + 1}; draw();
    }
    function add(op) {
      if (running || countBlocks(program) >= level.max) return;
      const n = {op, _id: ++uid};
      if (op === 'repeat') { n.n = 2; n.body = []; } else if (op === 'while') { n.cond = conds[0]; n.body = []; } else if (op === 'if') { n.cond = conds[0]; n.then = []; n.else = []; }
      cursor.list.splice(cursor.index, 0, n);
      cursor = n.body || n.then ? {list: n.body || n.then, index: 0} : {list: cursor.list, index: cursor.index + 1};
      draw();
    }
    function slot(list, i) {
      const active = cursor.list === list && cursor.index === i;
      const b = button(active ? '▸ сюда встанет следующая команда' : '', 't-slot' + (active ? ' active' : ''), () => { if (running) return; cursor = {list, index: i}; draw(); });
      b.setAttribute('aria-label', active ? 'Курсор: сюда встанет следующая команда' : 'Перенести курсор сюда');
      b.addEventListener('dragover', e => { e.preventDefault(); b.classList.add('over'); }); b.addEventListener('dragleave', () => b.classList.remove('over'));
      b.addEventListener('drop', e => { e.preventDefault(); drop(e.dataTransfer.getData('text/plain'), list, i); }); return b;
    }
    function listEl(list) { const box = el('div', 't-list'); list.forEach((n, i) => box.append(slot(list, i), blockEl(n, list, i))); box.append(slot(list, list.length)); return box; }
    function condSelect(n) {
      const s = el('select'); s.setAttribute('aria-label', 'Условие');
      for (const c of conds) { const o = el('option', '', COND_RU[c]); o.value = c; s.append(o); }
      s.value = n.cond; s.addEventListener('change', () => { n.cond = s.value; draw(); }); return s;
    }
    function blockEl(n, list, i) {
      const b = el('div', 't-block t-' + n.op), head = el('div', 't-block-head'); b.dataset.id = n._id;
      b.draggable = true; b.addEventListener('dragstart', e => drag(e, 'move:' + n._id)); b.addEventListener('dragend', dragEnd);
      head.append(el('span', 't-block-name', BLOCK_RU[n.op]));
      if (n.op === 'repeat') {
        const minus = button('−', 't-step', () => { if (!running && n.n > 2) { n.n--; draw(); } }), plus = button('+', 't-step', () => { if (!running && n.n < 12) { n.n++; draw(); } });
        minus.setAttribute('aria-label', 'Меньше повторений'); plus.setAttribute('aria-label', 'Больше повторений'); plus.dataset.plus = '1';
        head.append(minus, el('strong', 't-n', n.n), plus, el('span', '', times(n.n)));
      }
      if (n.op === 'while' || n.op === 'if') head.append(condSelect(n));
      const del = button('✕', 't-del', () => { if (running) return; list.splice(i, 1); cursor = {list, index: i}; draw(); }); del.setAttribute('aria-label', 'Удалить блок «' + BLOCK_RU[n.op] + '»');
      head.append(del); b.append(head);
      if (n.body) b.append(listEl(n.body));
      if (n.op === 'if') b.append(listEl(n.then), el('div', 't-else', 'иначе'), listEl(n.else));
      return b;
    }
    function draw() {
      const used = countBlocks(program);
      editor.replaceChildren(listEl(program));
      counter.textContent = `Блоков: ${used} из ${level.max}. На ★★★ — не больше ${level.par}.`;
      palette.querySelectorAll('button').forEach(b => b.disabled = running || used >= level.max);
      if ((world.lang || 'py') === 'py') code.textContent = robotPython(program).join('\n');
      runButton.disabled = running; clear.disabled = running;
    }
    function run() {
      if (running) return;
      if (!program.length) { api.note('Сначала соберите программу из блоков.'); return; }
      const result = robotRun(level, program), my = token; let i = 0;
      running = true; api.note(''); resetBoard(); draw();
      const tick = () => {
        if (my !== token) return;
        editor.querySelectorAll('.t-block.exec').forEach(b => b.classList.remove('exec'));
        if (i >= result.events.length) { running = false; draw(); finish(result.status); return; }
        const e = result.events[i++]; place(e.x, e.y, e.d, e.crash); sfx(e.crash ? 'boom' : 'step');
        if (e.pick) cells[e.pick].classList.add('got');
        if (level.target && e.line) drawn.append(line(...e.line, 'pen'));
        editor.querySelector(`[data-id="${e.id}"]`)?.classList.add('exec');
        setTimeout(tick, fast ? 80 : 330);
      };
      setTimeout(tick, 150);
    }
    function finish(status) {
      const used = countBlocks(program);
      if (status === 'win') won = true;
      if (status === 'win') api.win(used > level.par ? 1 : 0, used + ' блоков', used > level.par ? `Программа работает! Чтобы получить ★★★, уложитесь в ${level.par} блоков — помогут циклы.` : '');
      else api.fail(({shape: 'Рисунок не совпал с пунктирным образцом: есть лишние или недостающие линии.', crash: level.target ? 'Исполнитель упёрся в край поля. Проверьте число шагов и повороты.' : 'Робот врезался в стену. Посмотрите, на какой команде это случилось, и исправьте программу.', nogoal: 'Программа закончилась, а робот не на финише. Он должен остановиться на клетке ⚑.', crystals: 'Робот дошёл до финиша, но собрал не все кристаллы.', limit: 'Программа выполняется слишком долго — похоже, цикл никогда не заканчивается.'})[status]);
    }
    let won = false;
    const owner = (list, from = program) => { for (const n of from) for (const inner of [n.body, n.then, n.else]) { if (!inner) continue; if (inner === list) return {node: n, parent: from}; const deep = owner(list, inner); if (deep) return deep; } return null; };
    keys(e => {
      if (won || running) return;
      const k = e.key.toLowerCase(), op = {arrowup: 'forward', arrowleft: 'left', arrowright: 'right', r: 'repeat', 'к': 'repeat', w: 'while', 'ц': 'while', i: 'if', 'ш': 'if'}[k];
      if (op && level.blocks.includes(op)) { e.preventDefault(); add(op); }
      else if (e.key === 'Backspace' && cursor.index > 0) { e.preventDefault(); cursor.list.splice(cursor.index - 1, 1); cursor = {list: cursor.list, index: cursor.index - 1}; draw(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); const o = owner(cursor.list); if (o) { cursor = {list: o.parent, index: o.parent.indexOf(o.node) + 1}; draw(); } }
      else if (e.key === '+' || e.key === '=' || e.key === '-') { const o = owner(cursor.list), n = o?.node.op === 'repeat' ? o.node : cursor.list[cursor.index - 1]?.op === 'repeat' ? cursor.list[cursor.index - 1] : null; if (n) { n.n = Math.max(2, Math.min(12, n.n + (e.key === '-' ? -1 : 1))); draw(); } }
      else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); run(); }
    });
    side.append(keyHint('↑ ← → — команды, R — «повтори», + и − — число повторений, ↓ — выйти из блока, Backspace — удалить, Enter — запуск.'));
    side.append(el('h3', '', 'Команды'), palette, el('p', 'g-note', 'Нажмите на команду или перетащите её мышью в программу. Блоки в программе тоже можно перетаскивать.'), el('h3', '', 'Программа'), editor, counter);
    const actions = el('div', 'g-actions'); actions.append(runButton, speed, clear); side.append(actions);
    if ((world.lang || 'py') === 'py') side.append(el('h3', '', 'Та же программа на Python'), code);
    stage.append(boardWrap, side); area.append(stage); resetBoard(); draw();
    debugAnswer = null;
  };

  MECH.draw = MECH.robot;

  /* ---------- исполни программу ---------- */
  MECH.trace = (area, level, world, api) => {
    const lang = world.lang || 'py', lines = codeLines(level, lang), moves = traceMoves(level);
    let x = level.start[0], y = level.start[1], step = 0, mistakes = 0, streak = 0, done = false;
    const stage = el('div', 't-trace'), code = el('pre', 'g-code t-code'), right = el('div'), board = el('div', 't-board t-trace-board'), info = el('p', 't-counter');
    lines.forEach((text, i) => { const row = el('span', 't-line', text || ' '); row.dataset.line = i; code.append(row); });
    board.style.setProperty('--cols', level.w); board.style.setProperty('--rows', level.h);
    const cells = [];
    for (let j = 0; j < level.h; j++) for (let i = 0; i < level.w; i++) { const c = el('div', 't-cell'); cells.push(c); board.append(c); }
    const cell = (cx, cy) => cells[cy * level.w + cx];
    function draw() {
      cells.forEach(c => { c.classList.remove('here'); c.textContent = ''; });
      cell(x, y).classList.add('here', 'trail'); cell(x, y).textContent = '●';
      info.textContent = `Выполнено команд: ${step} из ${moves.length}. Ошибок: ${mistakes}.`;
    }
    const D = {R: [1, 0, '→', 'ArrowRight'], L: [-1, 0, '←', 'ArrowLeft'], U: [0, -1, '↑', 'ArrowUp'], D: [0, 1, '↓', 'ArrowDown']};
    function press(d) {
      if (done) return;
      code.querySelectorAll('.help').forEach(n => n.classList.remove('help'));
      if (moves[step].d !== d) {
        mistakes++; streak++; board.classList.remove('shake'); void board.offsetWidth; board.classList.add('shake');
        if (streak >= 2) { code.querySelector(`[data-line="${moves[step].line}"]`)?.classList.add('help'); api.note('Не та команда. Подсвечена строка, которая выполняется сейчас.'); }
        else api.note('Не та команда. Проследите программу ещё раз: какая строка выполняется сейчас?');
        draw(); return;
      }
      streak = 0; api.note(''); x += D[d][0]; y += D[d][1]; step++; draw();
      if (step === moves.length) { done = true; api.win(mistakes === 0 ? 0 : mistakes <= 2 ? 1 : 2, mistakes ? 'ошибок: ' + mistakes : 'без ошибок', mistakes ? 'Чтобы получить ★★★, выполните программу без единой ошибки.' : ''); }
    }
    const pad = el('div', 't-arrows');
    for (const d of ['U', 'L', 'D', 'R']) { const b = button(D[d][2], 'g-command t-arrow-' + d, () => press(d)); b.dataset.move = d; b.setAttribute('aria-label', ({U: 'Вверх', L: 'Влево', D: 'Вниз', R: 'Вправо'})[d]); pad.append(b); }
    const onKey = e => { const d = Object.keys(D).find(k => D[k][3] === e.key); if (d && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); press(d); } };
    document.addEventListener('keydown', onKey); cleanup.push(() => document.removeEventListener('keydown', onKey));
    right.append(board, info, pad, el('p', 'g-note', 'Вы — исполнитель. Выполняйте программу сами: нажимайте стрелки на клавиатуре или кнопки. Точка ● оставляет след.'), keyHint('Стрелки на клавиатуре — выполнить команду.'));
    const left = el('div'); left.append(el('h3', '', lang === 'py' ? 'Программа на Python' : 'Программа'), code);
    stage.append(left, right); area.append(stage); draw();
    debugAnswer = () => moves.map(m => m.d).join('');
  };

  /* ---------- аркады: общий каркас ---------- */
  let audio = null;
  function sfx(name) {
    if (!store.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const notes = {good: [[660, 0, .08], [880, .08, .12]], bad: [[170, 0, .22, 'sawtooth']], win: [[523, 0, .1], [659, .1, .1], [784, .2, .1], [1047, .3, .28]], step: [[300, 0, .04, 'triangle']], boom: [[90, 0, .3, 'sawtooth']]}[name];
      for (const [freq, at, dur, type] of notes) { const o = audio.createOscillator(), g = audio.createGain(); o.type = type || 'square'; o.frequency.value = freq; g.gain.setValueAtTime(.05, audio.currentTime + at); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + at + dur); o.connect(g).connect(audio.destination); o.start(audio.currentTime + at); o.stop(audio.currentTime + at + dur); }
    } catch {}
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = el('div', 't-confetti'); box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 44; i++) { const p = el('i'); p.style.left = rand(2, 98) + '%'; p.style.background = ['#d6ac4f', '#23665a', '#4b8fbf', '#c0563b', '#8d62b8'][i % 5]; p.style.animationDelay = rand(0, 500) + 'ms'; p.style.animationDuration = rand(1100, 2100) + 'ms'; box.append(p); }
    document.body.append(box); setTimeout(() => box.remove(), 2800);
  }
  function arcade(area, how, begin) {
    const intro = el('div', 't-arcade-intro'); intro.append(el('h3', '', 'Как играть')); for (const line of how) intro.append(el('p', '', line));
    const start = button('▶ Старт', 'g-primary t-start', () => { intro.remove(); begin(); }); start.dataset.act = 'start'; intro.append(start, keyHint('Enter — старт.')); area.append(intro); setTimeout(() => start.focus({preventScroll: true}), 0);
  }
  function hud(area, total, withLives = true) {
    const bar = el('div', 't-hud'), hearts = el('span', 't-hearts'), info = el('span'), left = el('span'); bar.append(hearts, info, left); area.append(bar);
    return {set(lives, done, text = '') { if (withLives) { hearts.textContent = '♥'.repeat(Math.max(lives, 0)) + '♡'.repeat(3 - Math.max(lives, 0)); hearts.setAttribute('aria-label', 'Жизней: ' + lives); } info.textContent = text; left.textContent = `Пройдено ${done} из ${total}`; }};
  }
  function ticker(step) {
    const my = token; let last = performance.now(), stopped = false;
    const frame = now => { if (my !== token || stopped) return; const dt = Math.min(now - last, 120); last = now; step(dt); requestAnimationFrame(frame); };
    requestAnimationFrame(frame); return () => { stopped = true; };
  }
  /* Турникет: гости подходят по одному, пропускаем только тех, для кого условие истинно. */
  function gate(area, api, o) {
    arcade(area, ['К турникету по одному подходят гости. На табло — условие.', 'Пропускайте тех, для кого условие истинно (кнопка или клавиша →), остальных отправляйте обратно (клавиша ←).', 'У вас три жизни. Ошибка или промедление — минус жизнь. С каждым гостем темп растёт.'], () => {
      const total = o.count; let lives = 3, done = 0, streak = 0, card = null, age = 0, pause = 0, limit = o.seconds * 1000, last = -1, over = false;
      const h = hud(area, total), rule = el('p', 't-rule'), belt = el('div', 't-belt'), guest = el('div', 't-guest'), fuse = el('div', 't-fuse'), fill = el('i'), door = el('div', 't-door', 'ВХОД');
      rule.append(el('span', '', o.label), el('strong', '', o.rule)); fuse.append(fill); belt.append(guest, door);
      const no = button('← Не пускать', 't-no', () => answer(false)), yes = button('Пропустить →', 't-yes', () => answer(true)), keys = el('div', 't-gate-keys'); no.dataset.act = 'no'; yes.dataset.act = 'yes'; keys.append(no, yes);
      area.append(rule, belt, fuse, keys, keyHint('→ — пропустить, ← — не пускать.'));
      const onKey = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); answer(e.key === 'ArrowRight'); } };
      document.addEventListener('keydown', onKey); cleanup.push(() => document.removeEventListener('keydown', onKey));
      function next() {
        if (done === total) { finish(); api.win(3 - lives, lives === 3 ? 'без потерь' : 'жизней осталось: ' + lives, lives < 3 ? 'Чтобы получить ★★★, пройдите смену, не потеряв ни одной жизни.' : ''); return; }
        let i; do { i = rand(0, o.cards.length - 1); } while (o.cards.length > 1 && i === last); last = i; card = o.cards[i]; age = 0;
        guest.className = 't-guest'; const face = sprite('guest', 't-face'); face.style.color = `hsl(${rand(0, 11) * 30} 45% 42%)`; guest.replaceChildren(face, el('strong', '', card.title)); for (const line of card.lines) guest.append(el('span', '', line));
        h.set(lives, done, streak > 1 ? 'Серия: ' + streak : '');
      }
      function lose(text) { lives--; streak = 0; sfx('bad'); shake(area); api.note(text); guest.classList.add('wrong'); card = null; pause = 1500; h.set(lives, done); if (lives === 0) { finish(); api.over('Жизни закончились. ' + text); } }
      function answer(allow) {
        if (!card || over) return;
        if (allow !== card.truth) { done++; lose(card.truth ? 'Ошибка: для этого гостя условие истинно — его нужно было пропустить.' : 'Ошибка: для этого гостя условие ложно — пропускать было нельзя.'); return; }
        done++; streak++; sfx('good'); api.note(''); guest.classList.add(allow ? 'in' : 'out'); card = null; pause = 380; limit = Math.max(limit * .96, o.seconds * 550); h.set(lives, done, streak > 1 ? 'Серия: ' + streak : '');
      }
      const stop = ticker(dt => {
        if (pause > 0) { pause -= dt; if (pause <= 0 && !over) next(); return; }
        if (!card) return;
        age += dt; fill.style.width = Math.max(0, 100 - age / limit * 100) + '%'; guest.style.left = Math.min(age / limit, 1) * 62 + '%';
        if (age >= limit) { done++; lose('Гость не дождался решения. Для него условие было ' + (card.truth ? 'истинно.' : 'ложно.')); }
      });
      function finish() { over = true; stop(); no.disabled = yes.disabled = true; }
      debugAnswer = () => card ? card.truth : null; next();
    });
  }
  /* Обезвреживание: у каждой угрозы свой таймер, верный ответ её снимает. */
  function defuse(area, api, o) {
    arcade(area, o.how, () => {
      const total = o.total; let lives = 3, done = 0, made = 0, wait = 0, over = false; const slots = [null, null, null];
      if (o.top) area.append(o.top);
      const h = hud(area, total), grid = el('div', 't-threats'), cells = slots.map(() => { const c = el('div', 't-threat empty', 'свободно'); grid.append(c); return c; });
      const form = el('div', 't-fire'), input = el('input', 'g-number-input'), shoot = button('Обезвредить ↵', 'g-primary', fire); input.type = 'text'; input.inputMode = 'decimal'; input.autocomplete = 'off'; input.maxLength = 12; input.setAttribute('aria-label', 'Ответ для угрозы');
      input.addEventListener('keydown', e => { if (e.key === 'Enter') fire(); }); shoot.dataset.act = 'fire'; form.append(input, shoot); area.append(grid, form, keyHint('Наберите ответ и нажмите Enter.')); input.focus({preventScroll: true});
      function clear(i, cls) { const c = cells[i]; slots[i] = null; c.className = 't-threat ' + cls; setTimeout(() => { if (!slots[i]) { c.className = 't-threat empty'; c.textContent = 'свободно'; } }, 600); }
      function check() { h.set(lives, done); if (!over && done === total) { finish(); api.win(3 - lives, lives === 3 ? 'без потерь' : 'жизней осталось: ' + lives, lives < 3 ? 'Чтобы получить ★★★, не пропустите ни одной угрозы.' : ''); } }
      function fire() {
        if (over) return; const v = input.value.trim().replace(',', '.'); if (v === '' || !Number.isFinite(Number(v))) return;
        const hit = slots.map((c, i) => [c, i]).filter(([c]) => c && Math.abs(c.answer - Number(v)) < 0.005).sort((a, b) => (a[0].limit - a[0].age) - (b[0].limit - b[0].age))[0];
        input.value = '';
        if (!hit) { sfx('bad'); form.classList.remove('miss'); void form.offsetWidth; form.classList.add('miss'); api.note('Мимо: такого ответа нет ни у одной угрозы.'); return; }
        sfx('good'); api.note(''); o.solved?.(hit[0]); done++; clear(hit[1], 'safe'); cells[hit[1]].textContent = '✓ ' + v.replace('.', ','); check();
      }
      const stop = ticker(dt => {
        wait -= dt;
        const free = slots.indexOf(null), active = slots.some(Boolean);
        if (made < total && free >= 0 && (wait <= 0 || !active)) {
          const c = {...o.make(made++), age: 0, limit: o.seconds * 1000}; slots[free] = c; wait = o.gap * 1000;
          const cell = cells[free], bar = el('div', 't-fuse'), fill = el('i'); bar.append(fill); c.fill = fill; cell.className = 't-threat live'; const bug = sprite('virus', 't-virus'); bug.style.color = `hsl(${rand(0, 5) * 60 + 10} 60% 45%)`; cell.replaceChildren(bug, el('p', '', c.text), bar);
        }
        slots.forEach((c, i) => {
          if (!c) return; c.age += dt; c.fill.style.width = Math.max(0, 100 - c.age / c.limit * 100) + '%'; cells[i].classList.toggle('hot', c.age > c.limit * .7);
          if (c.age >= c.limit) { lives--; done++; sfx('boom'); shake(area); api.note('Не успели. Верный ответ: ' + String(Math.round(c.answer * 100) / 100).replace('.', ',') + '. ' + (c.tip || '')); o.solved?.(c); clear(i, 'lost'); cells[i].textContent = '✗'; if (lives === 0) { finish(); api.over('Жизни закончились. Попробуйте ещё раз — задания будут другими.'); } else check(); }
        });
      });
      function finish() { over = true; stop(); input.disabled = shoot.disabled = true; }
      debugAnswer = () => slots.filter(Boolean).map(c => c.answer); h.set(lives, done);
    });
  }
  const SUB = {2: '₂', 8: '₈', 10: '₁₀', 16: '₁₆'};
  function switches(box, bits, opts = {}) {
    const state = Array(bits).fill(0), rack = el('div', 'g-bits t-bits'), readout = el('p', 'g-readout'); readout.hidden = !!opts.compact;
    const value = () => state.reduce((n, b) => n * 2 + b, 0);
    const refresh = () => { readout.textContent = state.join('') + '₂' + (opts.readout ? ' = ' + value() + '₁₀' : ''); };
    for (let i = 0; i < bits; i++) {
      const col = el('div', 'g-bit-column' + (opts.group && (bits - i) % opts.group === 0 && i ? ' t-gap' : ''));
      col.append(el('span', '', opts.weights === false ? ' ' : String(2 ** (bits - 1 - i))));
      const b = button('0', 'g-bit', () => { state[i] = 1 - state[i]; b.textContent = state[i]; b.classList.toggle('on', !!state[i]); b.setAttribute('aria-pressed', String(!!state[i])); refresh(); opts.onChange?.(value()); });
      b.dataset.bit = i; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Разряд ' + (bits - i) + ' справа'); col.append(b); rack.append(col);
    }
    box.append(rack, readout); refresh(); return value;
  }
  function lamps(box, text) { const row = el('div', 't-lamps'); for (const c of text) row.append(el('span', c === '1' ? 'on' : '', c)); row.setAttribute('aria-label', 'Двоичное число ' + text); box.append(row); }
  function field(box, label, verify, mode = 'numeric') {
    const wrap = el('label', 'g-number-label', label), input = el('input', 'g-number-input'); input.type = 'text'; input.inputMode = mode; input.autocomplete = 'off'; input.maxLength = 20;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') verify(); }); wrap.append(input); box.append(wrap); return input;
  }
  /* Двоичный конвейер: строки прибывают всё быстрее, решённые исчезают. */
  MECH.binary = (area, level, world, api) => arcade(area, ['На конвейер одна за другой приезжают заготовки с числами. Решённая заготовка сразу уезжает.', 'Новые прибывают всё быстрее. На конвейере помещается пять заготовок — не дайте ему переполниться.', 'Три звезды — если на конвейере ни разу не скопилось больше двух заготовок.'], () => {
    const total = level.count * 2, cap = 5, bits = level.bits, base = level.base || 16, group = base === 8 ? 3 : 4, mode = level.mode, typed = mode === 'bin2dec' || mode === 'bin2base';
    let made = 0, done = 0, peak = 0, wait = 0, gap = (level.seconds || (bits > 5 ? 20 : 13)) * 1000, over = false, lastValue = -1; const rows = [];
    const h = hud(area, total, false), fuse = el('div', 't-fuse'), fill = el('i'), stack = el('div', 't-stack'); fuse.append(fill); area.append(fuse, stack);
    const bin = n => n.toString(2).padStart(bits, '0');
    if (!typed) { keys(e => { const k = Number(e.key); if (Number.isInteger(k) && k >= 1 && k <= bits && e.key.trim()) { e.preventDefault(); stack.querySelector('.t-row:not(.solved)')?.querySelectorAll('.g-bit')[k - 1]?.click(); } }); area.append(keyHint(`Клавиши 1–${bits} переключают разряды верхней заготовки (слева направо).`)); }
    else area.append(keyHint('Наберите ответ и нажмите Enter.'));
    function solved(row) {
      if (row.gone || over) return; row.gone = true; done++; sfx('good'); row.node.classList.add('solved'); rows.splice(rows.indexOf(row), 1); setTimeout(() => row.node.remove(), 320);
      if (done === total) { finish(); api.win(peak <= 2 ? 0 : peak <= 3 ? 1 : 2, 'на конвейере не больше ' + peak, peak > 2 ? 'Чтобы получить ★★★, решайте быстрее: на конвейере не должно скапливаться больше двух заготовок.' : ''); }
      else stack.querySelector('.t-row:not(.solved) input')?.focus({preventScroll: true});
    }
    function spawn() {
      let value, a, b;
      do { if (mode === 'sum') { a = rand(1, 2 ** (bits - 1) - 1); b = rand(1, 2 ** (bits - 1) - 1); value = a + b; } else value = rand(level.min ?? 1, level.max ?? 2 ** bits - 1); } while (value === lastValue);
      lastValue = value; const row = {id: ++made, value, typed, answer: mode === 'bin2base' ? value.toString(base).toUpperCase() : value}, node = el('div', 't-row'), task = el('div', 't-row-task'), work = el('div', 't-row-work'); row.node = node; node.dataset.rid = row.id;
      if (mode === 'dec2bin') task.append(el('strong', '', value), el('sub', '', '10'));
      else if (mode === 'base2bin') task.append(el('strong', '', value.toString(base).toUpperCase()), el('sub', '', base));
      else if (mode === 'sum') task.append(el('pre', 't-sum', bin(a) + '\n+' + bin(b).padStart(bits)));
      else lamps(task, bin(value));
      if (typed) {
        const input = el('input', 'g-number-input'); input.type = 'text'; input.inputMode = mode === 'bin2dec' ? 'numeric' : 'text'; input.autocomplete = 'off'; input.maxLength = 6; input.placeholder = mode === 'bin2dec' ? 'десятичное' : 'основание ' + base; input.setAttribute('aria-label', 'Ответ');
        input.addEventListener('keydown', e => { if (e.key !== 'Enter') return; const v = input.value.trim().toUpperCase().replace(/^0+(?=.)/, ''); if (!v) return; if (v === String(row.answer)) solved(row); else { sfx('bad'); input.value = ''; node.classList.remove('miss'); void node.offsetWidth; node.classList.add('miss'); } });
        work.append(input); if (rows.length === 0) setTimeout(() => input.focus({preventScroll: true}), 0);
      } else switches(work, bits, {weights: level.weights, readout: level.readout, group: mode === 'base2bin' ? group : 0, compact: !level.readout, onChange: v => { if (v === value) solved(row); }});
      node.append(task, work); stack.append(node); rows.push(row); peak = Math.max(peak, rows.length);
    }
    const stop = ticker(dt => {
      wait -= dt; fill.style.width = made < total ? Math.max(0, wait / gap * 100) + '%' : '0%';
      if (made < total && (wait <= 0 || !rows.length)) {
        if (rows.length >= cap) { finish(); sfx('boom'); api.over('Конвейер переполнен: на нём скопилось пять заготовок. Попробуйте ещё раз — числа будут другими.'); return; }
        spawn(); gap = Math.max(gap * .95, (level.seconds || (bits > 5 ? 20 : 13)) * 600); wait = gap;
      }
      h.set(0, done, `На конвейере: ${rows.length} из ${cap}`);
    });
    function finish() { over = true; stop(); stack.querySelectorAll('button,input').forEach(n => n.disabled = true); }
    debugAnswer = () => rows.map(r => ({id: r.id, value: r.value, answer: r.answer, typed: r.typed}));
  });
  MECH.calc = (area, level, world, api) => {
    let previous = '';
    defuse(area, api, {total: level.count * 2, seconds: level.seconds || 45, gap: level.gap || 11, how: ['На сервер нападают вирусы. У каждого — задача и таймер.', 'Введите ответ и нажмите Enter: вирус с таким ответом будет обезврежен. Порядок любой.', 'Если таймер вируса истёк, вы теряете жизнь. Жизней три.'], make() {
      let t, env, text, guard = 0;
      do { t = level.tasks[rand(0, level.tasks.length - 1)]; env = {}; for (const [name, values] of Object.entries(t.vars || {})) env[name] = values[rand(0, values.length - 1)]; text = t.text.replace(/\{(\w+)\}/g, (_, k) => env[k]); } while (text === previous && ++guard < 20);
      previous = text; return {text, answer: ev(t.answer, env), tip: t.tip};
    }});
  };

  /* ---------- логические схемы ---------- */
  const GATES = {and: ['И', (a, b) => a & b], or: ['ИЛИ', (a, b) => a | b], xor: ['ИСКЛ. ИЛИ', (a, b) => a ^ b], nand: ['И-НЕ', (a, b) => 1 - (a & b)], nor: ['ИЛИ-НЕ', (a, b) => 1 - (a | b)], not: ['НЕ', a => 1 - a], buf: ['провод', a => a]};
  MECH.logic = (area, level, world, api) => {
    const inputs = level.inputs, nodes = level.nodes, byId = Object.fromEntries(nodes.map(n => [n.id, n])), choice = {}, values = Object.fromEntries(inputs.map(n => [n, 0]));
    let mistakes = 0;
    const depth = id => byId[id] ? 1 + Math.max(...byId[id].in.map(depth)) : 0;
    const rowOf = id => byId[id] ? (byId[id].row ?? byId[id].in.reduce((s, k) => s + rowOf(k), 0) / byId[id].in.length) : inputs.indexOf(id);
    const maxDepth = depth(level.out), CW = 132, RH = 84, BW = 92, BH = 46;
    const pos = id => ({x: 14 + depth(id) * CW, y: (rowOf(id) + .5) * RH});
    const height = Math.max(inputs.length, ...nodes.map(n => rowOf(n.id) + 1)) * RH, width = 14 + (maxDepth + 1) * CW + 70;
    function value(id, vals) { if (id in vals) return vals[id]; const n = byId[id], gate = n.gate || choice[id]; if (!gate) return null; const args = n.in.map(k => value(k, vals)); return args.includes(null) ? null : GATES[gate][1](...args); }
    const scroll = el('div', 't-circuit-scroll'), stage = el('div', 't-circuit'); stage.style.width = width + 'px'; stage.style.height = height + 'px';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('width', width); svg.setAttribute('height', height); svg.setAttribute('aria-hidden', 'true'); stage.append(svg);
    const wires = [];
    function wire(from, x2, y2) { const p = pos(from), x1 = p.x + (byId[from] ? BW : 56), mid = x2 - 18 - 8 * wires.filter(w => w.x2 === x2).length; const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', `M${x1} ${p.y}H${mid}V${y2}H${x2}`); svg.append(path); wires.push({from, path, x2}); }
    for (const name of inputs) {
      const p = pos(name), b = button(name + ' = 0', 't-input', () => { values[name] = 1 - values[name]; refresh(); });
      b.style.left = p.x + 'px'; b.style.top = p.y - BH / 2 + 'px'; b.dataset.input = name; stage.append(b);
    }
    for (const n of nodes) {
      const p = pos(n.id), box = el('div', 't-gate' + (n.gate ? ' fixed' : '')); box.style.left = p.x + 'px'; box.style.top = p.y - BH / 2 + 'px';
      n.in.forEach((src, i) => wire(src, p.x, p.y + (n.in.length === 1 ? 0 : (i ? 11 : -11))));
      if (n.gate) box.textContent = GATES[n.gate][0];
      else {
        const s = el('select'), blank = el('option', '', '?'); blank.value = ''; s.append(blank); s.dataset.slot = n.id; s.setAttribute('aria-label', 'Элемент ' + n.id);
        for (const gate of (n.in.length === 1 ? level.gates1 || ['buf', 'not'] : level.gates2 || ['and', 'or'])) { const o = el('option', '', GATES[gate][0]); o.value = gate; s.append(o); }
        s.addEventListener('change', () => { choice[n.id] = s.value || null; refresh(); }); box.append(s);
      }
      stage.append(box);
    }
    const out = pos(level.out), lamp = el('div', 't-lamp', '?'); lamp.style.left = out.x + CW + 'px'; lamp.style.top = out.y - 23 + 'px'; wire(level.out, out.x + CW, out.y); stage.append(lamp);
    const table = el('table', 'g-truth t-truth'), combos = Array.from({length: 2 ** inputs.length}, (_, k) => Object.fromEntries(inputs.map((n, i) => [n, k >> (inputs.length - 1 - i) & 1])));
    const head = el('tr'); for (const h of [...inputs, 'Нужно', 'Ваша схема']) head.append(el('th', '', h)); table.append(head);
    const rows = combos.map((c, k) => { const tr = el('tr'); for (const n of inputs) tr.append(el('td', '', c[n])); tr.append(el('td', 't-target', level.target[k]), el('td', 't-mine', '·')); table.append(tr); return tr; });
    function refresh() {
      for (const name of inputs) { const b = stage.querySelector(`[data-input="${name}"]`); b.textContent = name + ' = ' + values[name]; b.classList.toggle('on', !!values[name]); b.setAttribute('aria-pressed', String(!!values[name])); }
      for (const w of wires) w.path.setAttribute('class', value(w.from, values) === 1 ? 'on' : '');
      const v = value(level.out, values); lamp.textContent = v === null ? '?' : v; lamp.classList.toggle('on', v === 1);
      const k = inputs.reduce((n, name) => n * 2 + values[name], 0); rows.forEach((r, i) => r.classList.toggle('now', i === k));
    }
    keys(e => { const name = {a: 'A', b: 'B', c: 'C', 'ф': 'A', 'и': 'B', 'с': 'C'}[e.key.toLowerCase()]; if (name && inputs.includes(name)) { e.preventDefault(); values[name] = 1 - values[name]; refresh(); } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); check.click(); } });
    const check = button('Проверить схему', 'g-primary', () => {
      if (nodes.some(n => !n.gate && !choice[n.id])) { api.note('Выберите элемент в каждом окошке со знаком «?».'); return; }
      let bad = 0; combos.forEach((c, k) => { const v = value(level.out, c), ok = v === level.target[k]; rows[k].lastChild.textContent = v; rows[k].classList.toggle('bad', !ok); if (!ok) bad++; });
      if (bad) { mistakes++; api.fail(`Схема отличается от задания в ${bad} ${bad === 1 ? 'строке' : 'строках'} таблицы — они отмечены. Проверок с ошибкой: ${mistakes}.`); }
      else api.win(mistakes === 0 ? 0 : mistakes <= 2 ? 1 : 2, mistakes ? 'лишних проверок: ' + mistakes : 'с первой проверки', mistakes ? 'Чтобы получить ★★★, соберите схему с первой проверки.' : '');
    });
    check.dataset.act = 'check';
    scroll.append(stage); const wrap = el('div', 't-logic'); wrap.append(scroll, table);
    area.append(el('p', 'g-note', 'Нажимайте на входы, чтобы подавать 0 или 1, и смотрите на лампу. В окошках «?» выберите логические элементы.'), wrap, check, keyHint('A, B, C — переключить вход, Tab — перейти к окошку, ↑ ↓ — выбрать элемент, Enter — проверить.')); refresh();
    debugAnswer = null;
  };

  /* ---------- пиксельный код ---------- */
  MECH.pixel = (area, level, world, api) => {
    const rows = level.rows, w = rows[0].length, show = level.show || 'bin', state = rows.map(r => Array(w).fill(0)), locked = rows.map(() => false), need = rows.join('').split('1').length - 1;
    let clicks = 0;
    const codeOf = r => show === 'bin' ? r : show === 'hex' ? parseInt(r, 2).toString(16).toUpperCase().padStart(Math.ceil(w / 4), '0') : String(parseInt(r, 2));
    const grid = el('div', 't-pixels'), info = el('p', 't-counter'); grid.style.setProperty('--cols', w);
    if (show !== 'bin' && level.weights !== false) { grid.append(el('span', 't-pcode', 'вес')); for (let x = 0; x < w; x++) grid.append(el('span', 't-weight', show === 'hex' ? 2 ** (3 - x % 4) : 2 ** (w - 1 - x))); }
    const count = () => { info.textContent = `Готово строк: ${locked.filter(Boolean).length} из ${rows.length}. Лишних нажатий: ${Math.max(0, clicks - need)}.`; };
    function settle(y, label, cells) {
      if (state[y].join('') !== rows[y] || locked[y]) return;
      locked[y] = true; sfx('good'); label.classList.add('ok'); cells.forEach(b => { b.disabled = true; b.classList.add('ok'); });
      if (locked.every(Boolean)) { const extra = clicks - need; grid.classList.add('art'); api.win(extra <= 2 ? 0 : extra <= 6 ? 1 : 2, extra > 0 ? 'лишних нажатий: ' + extra : 'без лишних нажатий', extra > 2 ? 'Чтобы получить ★★★, закрашивайте только нужные клетки: сначала раскодируйте строку, потом нажимайте.' : ''); }
    }
    rows.forEach((r, y) => {
      const label = el('span', 't-pcode', codeOf(r)), cells = []; grid.append(label);
      [...r].forEach((_, x) => { const b = button('', 'g-pixel', () => { state[y][x] = 1 - state[y][x]; clicks++; b.classList.toggle('lit', !!state[y][x]); b.setAttribute('aria-pressed', String(!!state[y][x])); settle(y, label, cells); count(); }); b.dataset.cell = y + ',' + x; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', `Строка ${y + 1}, столбец ${x + 1}`); cells.push(b); grid.append(b); });
      if (!r.includes('1')) { locked[y] = true; label.classList.add('ok'); }
    });
    const how = {bin: 'Слева — двоичный код строки: 1 — закрашенный пиксель, 0 — пустой.', hex: 'Слева — шестнадцатеричный код строки. Каждая цифра — это 4 пикселя.', dec: 'Слева — десятичное число. Переведите его в двоичное: 1 — закрашенный пиксель, 0 — пустой.'}[show];
    area.append(el('p', 'g-note', how + ' Верно раскодированная строка загорается и фиксируется. Меньше лишних нажатий — больше звёзд.'), grid, info, keyHint('Стрелки — выбрать клетку, пробел — закрасить.')); count(); roam(grid, '.g-pixel', w);
    debugAnswer = null;
  };

  /* ---------- графы ---------- */
  MECH.graph = (area, level, world, api) => {
    const nodes = level.nodes, byId = Object.fromEntries(nodes.map(n => [n.id, n])), weight = {};
    for (const [a, b, w] of level.edges) weight[a + '|' + b] = weight[b + '|' + a] = w;
    const dist = Object.fromEntries(nodes.map(n => [n.id, Infinity])), todo = new Set(nodes.map(n => n.id)); dist[level.from] = 0;
    while (todo.size) { const u = [...todo].reduce((m, k) => dist[k] < dist[m] ? k : m); todo.delete(u); for (const n of nodes) { const w = weight[u + '|' + n.id]; if (w !== undefined && dist[u] + w < dist[n.id]) dist[n.id] = dist[u] + w; } }
    const best = dist[level.to]; let route = [level.from], mistakes = 0;
    const stage = el('div', 't-graph'), svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true'); stage.append(svg);
    const lines = level.edges.map(([a, b, w]) => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'), A = byId[a], B = byId[b];
      line.setAttribute('x1', A.x); line.setAttribute('y1', A.y); line.setAttribute('x2', B.x); line.setAttribute('y2', B.y); svg.append(line);
      const tag = el('span', 't-weight-tag', w); tag.style.left = (A.x + B.x) / 2 + '%'; tag.style.top = (A.y + B.y) / 2 + '%'; stage.append(tag); return {a, b, line};
    });
    const info = el('p', 't-counter'), buttons = {}, fuse = el('div', 't-fuse'), fill = el('i'), car = sprite('truck', 't-car'); fuse.append(fill); car.setAttribute('aria-hidden', 'true'); stage.append(car);
    const length = () => route.slice(1).reduce((s, id, i) => s + weight[route[i] + '|' + id], 0);
    function draw() {
      const last = route[route.length - 1], left = best - length();
      for (const n of nodes) { const b = buttons[n.id]; b.classList.toggle('in', route.includes(n.id)); b.classList.toggle('last', n.id === last); b.classList.toggle('next', weight[last + '|' + n.id] !== undefined && !route.includes(n.id)); }
      for (const e of lines) { const on = route.some((id, i) => i && ((route[i - 1] === e.a && id === e.b) || (route[i - 1] === e.b && id === e.a))); e.line.setAttribute('class', on ? 'on' : ''); }
      car.style.left = byId[last].x + '%'; car.style.top = byId[last].y + '%'; fill.style.width = Math.max(0, left / best * 100) + '%';
      info.textContent = 'Маршрут: ' + route.map(id => byId[id].label || id).join(' → ') + `. Топлива осталось: ${Math.max(0, left)} из ${best}` + (level.unit ? ' ' + level.unit : '') + '.';
    }
    for (const n of nodes) {
      const b = button(n.label || n.id, 't-node' + (n.id === level.from ? ' from' : n.id === level.to ? ' to' : ''), () => {
        const last = route[route.length - 1];
        if (n.id === last && route.length > 1) route.pop();
        else if (weight[last + '|' + n.id] !== undefined && !route.includes(n.id)) route.push(n.id);
        else { api.note(route.includes(n.id) ? 'Здесь курьер уже был. Нажмите на вершину, где он стоит, чтобы вернуться на шаг.' : 'Отсюда туда нет дороги.'); return; }
        sfx('step'); api.note('');
        if (length() > best) { mistakes++; draw(); api.fail(`Топливо кончилось в пути: этот маршрут длиннее кратчайшего. Курьер возвращается на старт. Неудачных рейсов: ${mistakes}.`); route = [level.from]; setTimeout(() => { if (route.length === 1) draw(); }, 900); return; }
        draw();
        if (n.id === level.to) api.win(mistakes === 0 ? 0 : mistakes <= 2 ? 1 : 2, mistakes ? 'неудачных рейсов: ' + mistakes : 'с первого рейса', mistakes ? 'Чтобы получить ★★★, доставьте посылку с первого рейса: сначала сосчитайте длины маршрутов, потом езжайте.' : '');
      });
      b.style.left = n.x + '%'; b.style.top = n.y + '%'; b.dataset.node = n.id; buttons[n.id] = b; stage.append(b);
    }
    keys(e => { if (e.key === 'Backspace' && route.length > 1) { e.preventDefault(); route.pop(); api.note(''); draw(); return; } const b = Object.values(buttons).find(n => n.textContent.toLocaleUpperCase('ru') === e.key.toLocaleUpperCase('ru')); if (b) { e.preventDefault(); b.click(); } });
    const actions = el('div', 'g-actions'); actions.append(button('Вернуться на старт', 'g-small', () => { route = [level.from]; api.note(''); draw(); }), keyHint('Нажмите букву вершины, чтобы поехать туда (русская раскладка). Backspace — шаг назад.'));
    area.append(el('p', 'g-note', `Курьер везёт посылку из «${byId[level.from].label || level.from}» в «${byId[level.to].label || level.to}». Топлива — ровно на кратчайший путь: ${best}. Нажимайте на соседние вершины, чтобы ехать. Числа на линиях — длины дорог.`), stage, fuse, info, actions); draw();
    debugAnswer = null;
  };

  /* ---------- турникеты: отбор по условию и логические выражения ---------- */
  MECH.filter = (area, level, world, api) => gate(area, api, {label: 'Пропускать, если: ', rule: tx(level.cond, 'ru'), count: level.count || 12, seconds: level.seconds || 10,
    cards: level.rows.map(row => ({title: row[0], lines: level.fields.map((f, i) => `${f}: ${row[i + 1]}`), truth: !!ev(level.cond, Object.fromEntries(level.fields.map((f, i) => [f, row[i + 1]])))}))});

  /* ---------- сортировка обменами ---------- */
  MECH.sort = (area, level, world, api) => {
    const desc = level.order === 'desc', sorted = a => a.every((v, i) => !i || (desc ? a[i - 1] > v : a[i - 1] < v));
    const best = level.values.reduce((n, v, i) => n + level.values.slice(i + 1).filter(u => desc ? u > v : u < v).length, 0), top = Math.max(...level.values);
    let values, swaps, done = false;
    const row = el('div', 't-sort'), info = el('p', 't-counter');
    let draw = () => {
      row.replaceChildren();
      values.forEach((v, i) => {
        const card = el('div', 't-card'), bar = el('div', 't-bar'); bar.style.height = 18 + v / top * 90 + 'px'; card.append(bar, el('strong', '', v)); row.append(card);
        if (i < values.length - 1) { const b = button('⇄', 't-swap', () => { if (done) return; [values[i], values[i + 1]] = [values[i + 1], values[i]]; swaps++; draw(); finish(); }); b.dataset.swap = i; b.setAttribute('aria-label', `Поменять местами ${v} и ${values[i + 1]}`); b.disabled = done; row.append(b); }
      });
      info.textContent = `Обменов: ${swaps}. Лучший результат для этого ряда — ${best}.`;
    };
    function finish() {
      if (!sorted(values)) return; done = true; draw();
      const extra = swaps - best; api.win(extra <= 0 ? 0 : extra <= 2 ? 1 : 2, 'обменов: ' + swaps, extra > 0 ? `Ряд упорядочен! Чтобы получить ★★★, уложитесь в ${best} обменов: не меняйте пары, которые уже стоят правильно.` : '');
    }
    const reset = () => { if (done) return; values = level.values.slice(); swaps = 0; draw(); };
    area.append(el('p', 'g-note', `Расположите числа ${desc ? 'по убыванию' : 'по возрастанию'} слева направо. Менять местами можно только соседние числа — кнопкой ⇄ между ними.`), row, info, button('Начать заново', 'g-small', reset), keyHint('← → — выбрать пару, пробел — поменять местами.')); reset(); roam(row, '.t-swap', 1); let focusAt = 0; row.addEventListener('focusin', e => { if (e.target.dataset.swap) focusAt = Number(e.target.dataset.swap); });
    const redraw = draw; draw = () => { redraw(); if (!done) row.querySelector(`[data-swap="${focusAt}"]`)?.focus({preventScroll: true}); };
    debugAnswer = null;
  };

  /* ---------- шифр сдвига ---------- */
  const ABC = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
  const shiftText = (text, k) => [...text].map(c => ABC[(ABC.indexOf(c) + k + ABC.length * 2) % ABC.length]).join('');
  const CODE_RU = {KeyQ: 'Й', KeyW: 'Ц', KeyE: 'У', KeyR: 'К', KeyT: 'Е', KeyY: 'Н', KeyU: 'Г', KeyI: 'Ш', KeyO: 'Щ', KeyP: 'З', BracketLeft: 'Х', BracketRight: 'Ъ', KeyA: 'Ф', KeyS: 'Ы', KeyD: 'В', KeyF: 'А', KeyG: 'П', KeyH: 'Р', KeyJ: 'О', KeyK: 'Л', KeyL: 'Д', Semicolon: 'Ж', Quote: 'Э', KeyZ: 'Я', KeyX: 'Ч', KeyC: 'С', KeyV: 'М', KeyB: 'И', KeyN: 'Т', KeyM: 'Ь', Comma: 'Б', Period: 'Ю'};
  MECH.cipher = (area, level, world, api) => {
    const crack = level.mode === 'crack', encode = level.mode === 'encode', given = encode ? level.word : shiftText(level.word, level.shift), answer = encode ? shiftText(level.word, level.shift) : level.word;
    const wheel = el('div', 't-wheel'), tape = el('div', 't-tape');
    function drawWheel(k, onPick) {
      wheel.replaceChildren();
      [...ABC].forEach((c, i) => { const coded = ABC[(i + k) % ABC.length], pair = onPick ? button('', 't-pair', () => onPick(encode ? coded : c)) : el('span', 't-pair'); pair.append(el('b', '', c), el('i', '', '↓'), el('b', 't-code-letter', coded)); wheel.append(pair); });
    }
    if (crack) {
      let k = 1, mistakes = 0; const label = el('strong'), out = el('p', 't-decoded'), knob = el('div', 'g-actions');
      const turn = d => { k = (k - 1 + d + 31) % 31 + 1; draw(); sfx('step'); };
      const draw = () => { drawWheel(k); label.textContent = 'Сдвиг: ' + k; out.textContent = shiftText(given, -k); };
      const confirmWord = () => { if (k === level.shift) api.win(mistakes === 0 ? 0 : mistakes <= 2 ? 1 : 2, mistakes ? 'ложных срабатываний: ' + mistakes : 'с первой попытки', mistakes ? 'Чтобы получить ★★★, подтверждайте только осмысленное слово.' : ''); else { mistakes++; api.fail(`«${shiftText(given, -k)}» — не слово. Крутите диск дальше. Ложных срабатываний: ${mistakes}.`); } };
      const minus = button('← −', 't-step', () => turn(-1)), plus = button('+ →', 't-step', () => turn(1)), ok = button('Это сообщение! ↵', 'g-primary', confirmWord); plus.dataset.plus = '1'; ok.dataset.act = 'check'; knob.append(minus, label, plus, ok);
      keys(e => { if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); turn(1); } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); confirmWord(); } });
      area.append(el('p', 't-ask', 'Перехвачено: ' + given), el('p', 'g-note', 'Сдвиг неизвестен. Крутите шифровальный диск: под перехваченным сообщением сразу видна расшифровка. Когда получится осмысленное слово — подтвердите.'), knob, el('p', 'g-note', 'Расшифровка при этом сдвиге:'), out, wheel, keyHint('← → — крутить диск, Enter — подтвердить.')); draw();
      debugAnswer = () => ({shift: level.shift, now: k}); return;
    }
    arcade(area, [encode ? 'Нужно зашифровать слово буква за буквой.' : 'Нужно расшифровать сообщение буква за буквой.', encode ? 'Найдите подсвеченную букву в верхней строке диска и нажмите на клавиатуре букву, стоящую под ней.' : 'Найдите подсвеченную букву в нижней строке диска и нажмите на клавиатуре букву, стоящую над ней.', 'У каждой буквы таймер. Ошибка или промедление — минус жизнь. Жизней три.'], () => {
      let lives = 3, at = 0, age = 0, pause = 0, over = false; const limit = (level.seconds || 14) * 1000, h = hud(area, given.length), fuse = el('div', 't-fuse'), fill = el('i'); fuse.append(fill);
      const cells = [...given].map(c => { const box = el('span', 't-letter'); box.append(el('b', '', c), el('i', '', '?')); tape.append(box); return box; });
      const mark = () => { cells.forEach((c, i) => c.classList.toggle('now', i === at)); h.set(lives, at); };
      function lose(text) { lives--; sfx('bad'); shake(area); api.note(text); pause = 900; age = 0; h.set(lives, at); if (lives === 0) { finish(); api.over('Жизни закончились. ' + text); } }
      function press(letter) {
        if (over || pause > 0) return;
        if (letter !== answer[at]) { cells[at].classList.remove('miss'); void cells[at].offsetWidth; cells[at].classList.add('miss'); lose(`Не та буква. Найдите «${given[at]}» в ${encode ? 'верхней' : 'нижней'} строке диска.`); return; }
        cells[at].lastChild.textContent = letter; cells[at].classList.add('done'); sfx('good'); api.note(''); at++; age = 0;
        if (at === given.length) { finish(); mark(); api.win(3 - lives, lives === 3 ? 'без потерь' : 'жизней осталось: ' + lives, lives < 3 ? 'Чтобы получить ★★★, не потеряйте ни одной жизни.' : ''); } else mark();
      }
      keys(e => { const letter = ABC.includes(e.key.toLocaleUpperCase('ru')) && e.key.length === 1 ? e.key.toLocaleUpperCase('ru') : CODE_RU[e.code]; if (letter) { e.preventDefault(); press(letter); } });
      area.append(el('p', 'g-note', `Сдвиг: ${level.shift}. Верхняя строка диска — буквы исходного текста, нижняя — буквы шифра.`), tape, fuse, wheel, keyHint('Нажимайте буквы на клавиатуре (подойдёт любая раскладка) или щёлкайте по столбикам диска.'));
      drawWheel(level.shift, press); mark();
      const stop = ticker(dt => { if (pause > 0) { pause -= dt; return; } age += dt; fill.style.width = Math.max(0, 100 - age / limit * 100) + '%'; if (age >= limit) lose('Время вышло. Ищите букву быстрее.'); });
      function finish() { over = true; stop(); wheel.querySelectorAll('button').forEach(b => b.disabled = true); }
      debugAnswer = () => over ? null : ({letter: answer[at]});
    });
  };

  /* ---------- змейка: ешь только правильное ---------- */
  MECH.snake = (area, level, world, api) => arcade(area, ['Управляйте змейкой стрелками. На поле лежат карточки.', level.ordered ? 'Собирайте карточки строго по порядку, указанному на табло.' : 'Ешьте только те карточки, которые подходят под правило на табло. Остальные обходите.', 'Три жизни. Неправильная карточка или укус собственного хвоста — минус жизнь. Сквозь края поля змейка проходит насквозь.'], () => {
    const W = 8, H = 6, goods = level.good.slice(), total = goods.length; let lives = 3, eaten = 0, over = false, dir = [1, 0], turn = null, wait = 0, speed = level.speed || 520;
    let snake = [[2, 3], [1, 3], [0, 3]]; const items = [], queue = level.ordered ? goods.slice() : goods.slice().sort(() => Math.random() - .5), junk = level.bad.slice().sort(() => Math.random() - .5);
    const h = hud(area, total), rule = el('p', 't-rule'), board = el('div', 't-snake'), cells = []; rule.append(el('span', '', 'Правило: '), el('strong', '', level.rule));
    for (let i = 0; i < W * H; i++) { const c = el('div', 't-sq'); cells.push(c); board.append(c); }
    const free = () => { let p; do { p = [rand(0, W - 1), rand(0, H - 1)]; } while (snake.some(s => s[0] === p[0] && s[1] === p[1]) || items.some(it => Math.abs(it.x - p[0]) + Math.abs(it.y - p[1]) < 2) || (Math.abs(p[0] - snake[0][0]) + Math.abs(p[1] - snake[0][1]) < 3)); return p; };
    function stock() {
      while (items.filter(it => it.good).length < Math.min(2, queue.length + items.filter(it => it.good).length) && queue.length) { const [x, y] = free(); items.push({x, y, text: queue.shift(), good: true}); }
      while (items.filter(it => !it.good).length < Math.min(2, level.bad.length)) { if (!junk.length) junk.push(...level.bad.slice().sort(() => Math.random() - .5)); const text = junk.shift(); if (items.some(it => it.text === text)) continue; const [x, y] = free(); items.push({x, y, text, good: false}); }
    }
    function paint() {
      cells.forEach(c => { c.className = 't-sq'; c.textContent = ''; });
      for (const it of items) { const c = cells[it.y * W + it.x]; c.classList.add('item'); c.textContent = it.text; }
      snake.forEach((s, i) => cells[s[1] * W + s[0]].classList.add(i ? 'body' : 'head'));
      h.set(lives, eaten);
    }
    function hurt(text) { lives--; sfx('bad'); shake(area); api.note(text); snake = snake.slice(0, 3); if (lives === 0) { finish(); api.over('Жизни закончились. ' + text); } }
    function step() {
      if (turn && (turn[0] !== -dir[0] || turn[1] !== -dir[1])) dir = turn; turn = null;
      const head = [(snake[0][0] + dir[0] + W) % W, (snake[0][1] + dir[1] + H) % H];
      if (snake.slice(0, -1).some(s => s[0] === head[0] && s[1] === head[1])) { hurt('Змейка укусила себя за хвост.'); if (over) return; }
      snake.unshift(head); const k = items.findIndex(it => it.x === head[0] && it.y === head[1]);
      if (k < 0) snake.pop();
      else {
        const it = items.splice(k, 1)[0], right = it.good && (!level.ordered || it.text === goods[eaten]);
        if (right) { eaten++; sfx('good'); api.note(''); speed = Math.max(speed * .97, 300); if (snake.length > 6) snake.pop(); if (eaten === total) { paint(); finish(); api.win(3 - lives, lives === 3 ? 'без потерь' : 'жизней осталось: ' + lives, lives < 3 ? 'Чтобы получить ★★★, не потеряйте ни одной жизни.' : ''); return; } }
        else { snake.pop(); if (it.good) queue.unshift(it.text); hurt(it.good ? `Не по порядку: «${it.text}» идёт позже.` : `«${it.text}» не подходит под правило.`); if (over) return; }
        stock();
      }
      paint();
    }
    const go = d => { turn = d; };
    keys(e => { const d = {ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], 'ц': [0, -1], 'ы': [0, 1], 'ф': [-1, 0], 'в': [1, 0]}[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (d) { e.preventDefault(); go(d); } });
    const pad = el('div', 't-arrows'); for (const [cls, sym, d] of [['U', '↑', [0, -1]], ['L', '←', [-1, 0]], ['D', '↓', [0, 1]], ['R', '→', [1, 0]]]) { const b = button(sym, 'g-command t-arrow-' + cls, () => go(d)); b.setAttribute('aria-label', 'Повернуть'); pad.append(b); }
    area.append(rule, board, pad, keyHint('Стрелки или W A S D — поворот змейки.')); stock(); paint();
    const stop = ticker(dt => { wait += dt; if (wait >= speed) { wait = 0; step(); } });
    function finish() { over = true; stop(); }
    debugAnswer = () => over ? null : ({head: snake[0], body: snake.map(s => s.join()), dir, W, H, want: items.filter(it => it.good && (!level.ordered || it.text === goods[eaten])).map(it => [it.x, it.y]), avoid: items.filter(it => !(it.good && (!level.ordered || it.text === goods[eaten]))).map(it => [it.x, it.y].join())});
    window.School4SnakeTurn = location.hostname === '127.0.0.1' ? go : undefined;
  });

  MECH.truth = (area, level, world, api) => {
    const vars = level.vars, expr = level.cols[level.cols.length - 1];
    gate(area, api, {label: 'Сигнал проходит, если истинно: ', rule: tx(expr, 'L'), count: level.count || 12, seconds: level.seconds || 9,
      cards: Array.from({length: 2 ** vars.length}, (_, k) => { const v = Object.fromEntries(vars.map((n, i) => [n, k >> (vars.length - 1 - i) & 1])); return {title: 'Сигнал', lines: vars.map(n => `${n} = ${v[n]}`), truth: !!ev(expr, v)}; })});
  };

  /* ---------- массивы ---------- */
  MECH.array = (area, level, world, api) => {
    const lines = codeLines(level, 'py'), target = runProgram(level).env[level.ask], isList = Array.isArray(target); let mistakes = 0;
    const code = el('pre', 'g-code t-code', lines.join('\n')), box = el('div', 't-array'), inputs = [];
    const verify = () => {
      const values = inputs.map(i => i.value.trim().replace(',', '.'));
      if (values.some(v => v === '' || !Number.isFinite(Number(v)))) { api.note(isList ? 'Заполните все элементы массива числами.' : 'Сначала введите число.'); return; }
      const bad = values.filter((v, i) => Number(v) !== (isList ? target[i] : target)).length;
      if (bad) { mistakes++; api.fail((isList ? `Неверных элементов: ${bad}.` : 'Не совпало.') + ` Проследите программу по шагам на листке. Проверок с ошибкой: ${mistakes}.`); }
      else api.win(mistakes === 0 ? 0 : mistakes <= 2 ? 1 : 2, mistakes ? 'лишних проверок: ' + mistakes : 'с первой проверки', mistakes ? 'Чтобы получить ★★★, дайте верный ответ с первой проверки.' : '');
    };
    if (isList) target.forEach((_, i) => { const cell = el('label', 't-item', `${level.ask}[${i}]`), input = el('input'); input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.maxLength = 8; input.addEventListener('keydown', e => { if (e.key === 'Enter') verify(); }); cell.append(input); inputs.push(input); box.append(cell); });
    else inputs.push(field(box, `Значение ${level.ask}`, verify));
    const check = button('Проверить', 'g-primary', verify); check.dataset.act = 'check';
    area.append(el('h3', '', 'Программа на Python'), code, el('p', 't-ask', isList ? `Каким станет массив ${level.ask} после выполнения программы?` : `Чему будет равна переменная ${level.ask} после выполнения программы?`), box, check);
    debugAnswer = () => isList ? target : [target];
  };

  /* ---------- электронная таблица ---------- */
  const SHEET_FN = {sum: 'СУММ', avg: 'СРЗНАЧ', min: 'МИН', max: 'МАКС', count: 'СЧЁТ'}, SHEET_OP = {'==': '=', '!=': '<>'};
  function sheetText(e, parent = 0, right = false) {
    if (typeof e !== 'object') return String(e);
    const [op, a, b, c] = e;
    if (SHEET_FN[op]) return `${SHEET_FN[op]}(${a}:${b})`;
    if (op === 'if') return `ЕСЛИ(${sheetText(a)};${sheetText(b)};${sheetText(c)})`;
    const p = PREC[op], s = sheetText(a, p) + (SHEET_OP[op] || op) + sheetText(b, p, true);
    return (p < parent || (p === parent && right)) ? '(' + s + ')' : s;
  }
  function sheetValues(level) {
    const val = {}, cells = level.cells, bare = r => r.replace(/\$/g, '');
    for (const [k, c] of Object.entries(cells)) if (typeof c === 'number') val[k] = c;
    function calc(e) {
      if (typeof e === 'number') return e;
      if (typeof e === 'string') { const k = bare(e); if (!(k in val)) throw new Error('wait'); return val[k]; }
      const [op, a, b, c] = e;
      if (SHEET_FN[op]) {
        const A = bare(a), B = bare(b), xs = [];
        for (let col = A.charCodeAt(0); col <= B.charCodeAt(0); col++) for (let row = +A.slice(1); row <= +B.slice(1); row++) { const k = String.fromCharCode(col) + row; if (!(k in cells) || cells[k].t !== undefined) continue; if (!(k in val)) throw new Error('wait'); xs.push(val[k]); }
        const sum = xs.reduce((s, x) => s + x, 0);
        return op === 'sum' ? sum : op === 'avg' ? sum / xs.length : op === 'min' ? Math.min(...xs) : op === 'max' ? Math.max(...xs) : xs.length;
      }
      if (op === 'if') return calc(a) ? calc(b) : calc(c);
      return ev([op, calc(a), calc(b)], {});
    }
    for (let pass = 0; pass < 12; pass++) for (const [k, c] of Object.entries(cells)) if (c.f !== undefined && !(k in val)) try { val[k] = calc(c.f); } catch {}
    return val;
  }
  MECH.sheet = (area, level, world, api) => {
    const val = sheetValues(level), table = el('table', 'g-table t-sheet'), head = el('tr'), marks = {}, formulas = [];
    head.append(el('th', '', '')); for (const c of level.cols) head.append(el('th', '', c)); table.append(head);
    for (let r = 1; r <= level.rows; r++) {
      const tr = el('tr'); tr.append(el('th', '', r));
      for (const c of level.cols) {
        const k = c + r, cell = level.cells[k], td = el('td');
        if (typeof cell === 'number') td.textContent = cell;
        else if (cell?.t !== undefined) { td.textContent = cell.t; td.className = 't-label'; }
        else if (cell) { td.className = 't-formula'; td.append(el('code', '', '=' + sheetText(cell.f))); marks[k] = td; formulas.push(k); }
        tr.append(td);
      }
      table.append(tr);
    }
    const wrap = el('div', 'g-table-wrap'); wrap.append(table);
    defuse(area, api, {total: formulas.length, seconds: level.seconds || 70, gap: level.gap || 14, top: wrap, how: ['В таблице «зависли» формулы — жёлтые ячейки. Табличный процессор ждёт, что вы вычислите их сами.', 'Введите значение формулы и нажмите Enter. Вычисленное значение появится в таблице и пригодится для следующих формул.', 'У каждой формулы таймер. Не успели — минус жизнь. Жизней три.'],
      make: i => ({key: formulas[i], text: `Ячейка ${formulas[i]}: =${sheetText(level.cells[formulas[i]].f)}`, answer: val[formulas[i]]}),
      solved: c => { marks[c.key].replaceChildren(el('code', '', '=' + sheetText(level.cells[c.key].f)), el('strong', '', String(Math.round(c.answer * 100) / 100).replace('.', ','))); marks[c.key].classList.add('done'); }});
  };

  /* ---------- файловая система ---------- */
  MECH.path = (area, level, world, api) => {
    const goal = level.target.join('\\'), clean = s => s.trim().replace(/\//g, '\\').replace(/\\+/g, '\\').replace(/\\$/, '').toLocaleLowerCase('ru');
    const find = trail => trail.slice(1).reduce((node, name) => node.children.find(c => c.name === name), level.tree);
    if (level.ask === 'type') {
      const tree = el('ul', 't-tree'); let mistakes = 0;
      (function grow(node, list, trail) {
        const here = [...trail, node.name], key = here.join('\\'), li = el('li'), item = el('span', 't-file' + (node.children ? ' folder' : '') + (key === goal ? ' picked' : ''));
        item.append(sprite(node.children ? 'folder' : 'file', 't-ficon'), node.name); li.append(item);
        if (node.children) { const inner = el('ul'); for (const child of node.children) grow(child, inner, here); li.append(inner); }
        list.append(li);
      })(level.tree, tree, []);
      const verify = () => {
        if (!input.value.trim()) { api.note('Сначала введите полное имя.'); return; }
        if (clean(input.value) !== clean(goal)) { mistakes++; api.fail(`Полное имя записано неверно. Начните с диска и перечислите все папки по порядку через знак \\. Проверок с ошибкой: ${mistakes}.`); }
        else api.win(mistakes === 0 ? 0 : mistakes <= 2 ? 1 : 2, mistakes ? 'лишних проверок: ' + mistakes : 'с первой проверки', mistakes ? 'Чтобы получить ★★★, ответьте верно с первой проверки.' : '');
      };
      area.append(el('p', 'g-note', 'Жёлтые значки — папки, белые — файлы. Запишите в адресной строке полное имя выделенного объекта: диск, все папки по порядку и имя, через знак \\.'), tree);
      const input = field(area, 'Адресная строка', verify, 'text'), check = button('Перейти', 'g-primary', verify); check.dataset.act = 'check'; area.append(check);
      debugAnswer = () => ({type: goal}); return;
    }
    let at = (level.start || [level.tree.name]).slice(), steps = 0, wrong = 0, done = false;
    const start = at.slice(), shared = start.findIndex((name, i) => name !== level.target[i]), common = shared < 0 ? start.length : shared, best = (start.length - common) + (level.target.length - common);
    const bar = el('div', 't-address'), list = el('div', 't-folder'), info = el('p', 't-counter');
    function finish() { done = true; const extra = steps + wrong * 2 - best; draw(); api.win(extra <= 0 ? 0 : extra <= 2 ? 1 : 2, 'шагов: ' + steps + (wrong ? ', открыто не тех файлов: ' + wrong : ''), extra > 0 ? `Цель найдена! Чтобы получить ★★★, дойдите за ${best} ${best === 1 ? 'шаг' : 'шагов'} и не открывайте лишние файлы.` : ''); }
    function go(next) { if (done) return; at = next; steps++; sfx('step'); api.note(''); if (at.join('\\') === goal) finish(); else draw(); }
    function draw() {
      const here = find(at); bar.replaceChildren(el('span', '', 'Вы здесь: '), el('strong', '', at.join('\\') + (at.length === 1 ? '\\' : '')));
      list.replaceChildren();
      const up = button('↑ На уровень вверх', 't-tile t-up', () => go(at.slice(0, -1))); up.disabled = at.length === 1 || done; up.dataset.up = '1'; list.append(up);
      for (const child of here.children || []) {
        const b = button('', 't-tile' + (child.children ? ' folder' : ''), () => {
          if (child.children) go([...at, child.name]);
          else if ([...at, child.name].join('\\') === goal) { steps++; finish(); }
          else { wrong++; sfx('bad'); api.fail(`Это другой файл: ${[...at, child.name].join('\\')}. Сверьте путь по папкам.`); draw(); }
        });
        b.append(sprite(child.children ? 'folder' : 'file', 't-ficon'), el('span', '', child.name)); b.dataset.open = child.name; b.disabled = done; list.append(b);
      }
      info.textContent = `Шагов: ${steps}. Кратчайший путь — ${best}.`;
      if (!done) setTimeout(() => (list.querySelector('.t-tile.folder') || list.querySelector('.t-tile:not(:disabled)'))?.focus({preventScroll: true}), 0);
    }
    area.append(el('p', 'g-note', 'Жёлтые значки — папки, белые — файлы. Вы видите только содержимое текущей папки. Щёлкните по папке, чтобы войти в неё, по файлу — чтобы открыть его.'), bar, list, info, keyHint('Стрелки — выбрать, Enter — войти или открыть, Backspace — на уровень вверх.')); draw(); roam(list, '.t-tile', 1);
    keys(e => { if (e.key === 'Backspace' && at.length > 1 && !done) { e.preventDefault(); go(at.slice(0, -1)); } });
    debugAnswer = () => ({at: at.slice(), target: level.target});
  };

  /* ---------- сортировочная станция: предмет падает, выбираем корзину ---------- */
  MECH.catch = (area, level, world, api) => arcade(area, ['Сверху падает ящик с надписью. Внизу — корзины с названиями групп.', 'Ведите ящик стрелками ← → к нужной корзине. Клавиша ↓ или пробел — бросить сразу. Можно и просто нажать цифру корзины.', 'Три жизни. Ящик, упавший не в ту корзину, — минус жизнь. Темп растёт.'], () => {
    const total = level.count || 12, n = level.bins.length; let lives = 3, done = 0, streak = 0, item = null, col = 0, age = 0, pause = 0, limit = (level.seconds || 8) * 1000, over = false, bag = [];
    const h = hud(area, total), shaft = el('div', 't-shaft'), box = el('div', 't-drop'), bins = el('div', 't-bins'); shaft.style.setProperty('--n', n); shaft.append(box);
    const buttons = level.bins.map((name, i) => { const b = button('', 't-bin', () => { col = i; place(); choose(i); }); b.append(el('kbd', '', i + 1), el('span', '', name)); b.dataset.bin = i; bins.append(b); return b; });
    area.append(shaft, bins, keyHint('← → — вести ящик, ↓ или пробел — бросить, цифра — сразу в корзину с этим номером.'));
    const place = () => { box.style.left = (col + .5) / n * 100 + '%'; buttons.forEach((b, i) => b.classList.toggle('under', i === col && !!item)); };
    keys(e => {
      if (!item || over) return; const i = Number(e.key) - 1;
      if (e.key === 'ArrowLeft') { e.preventDefault(); col = Math.max(0, col - 1); place(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); col = Math.min(n - 1, col + 1); place(); }
      else if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); choose(col); }
      else if (e.key.trim() && Number.isInteger(i) && i >= 0 && i < n) { e.preventDefault(); col = i; place(); choose(i); }
    });
    function next() {
      if (done === total) { finish(); api.win(3 - lives, lives === 3 ? 'без потерь' : 'жизней осталось: ' + lives, lives < 3 ? 'Чтобы получить ★★★, не потеряйте ни одной жизни.' : ''); return; }
      if (!bag.length) bag = level.items.map((_, i) => i).sort(() => Math.random() - .5);
      item = level.items[bag.pop()]; age = 0; col = rand(0, n - 1); box.className = 't-drop'; box.replaceChildren(sprite('crate', 't-crate'), el('span', '', item[0])); box.style.top = '0%'; place(); h.set(lives, done, streak > 1 ? 'Серия: ' + streak : '');
    }
    function lose(text) { lives--; streak = 0; done++; sfx('bad'); shake(area); api.note(text); box.classList.add('wrong'); buttons[item[1]].classList.add('hint'); setTimeout(() => buttons.forEach(b => b.classList.remove('hint')), 1300); item = null; pause = 1500; place(); h.set(lives, done); if (lives === 0) { finish(); api.over('Жизни закончились. ' + text); } }
    function choose(i) {
      if (!item || over) return;
      if (i !== item[1]) { lose(`Ошибка: «${item[0]}» — это «${level.bins[item[1]]}».`); return; }
      done++; streak++; sfx('good'); api.note(''); box.classList.add('caught'); item = null; pause = 320; limit = Math.max(limit * .96, (level.seconds || 8) * 550); place(); h.set(lives, done, streak > 1 ? 'Серия: ' + streak : '');
    }
    const stop = ticker(dt => {
      if (pause > 0) { pause -= dt; if (pause <= 0 && !over) next(); return; }
      if (!item) return;
      age += dt; box.style.top = Math.min(age / limit, 1) * 78 + '%';
      if (age >= limit) choose(col);
    });
    function finish() { over = true; stop(); buttons.forEach(b => b.disabled = true); }
    debugAnswer = () => item ? item[1] : null; next();
  });

  /* ---------- гонка: въезжайте в ворота с верным ответом ---------- */
  function quizOf(level, world) {
    const pick = list => list[rand(0, list.length - 1)];
    if (world.type === 'binary') {
      const bits = level.bits, base = level.base || 16, mode = level.mode, bin = n => n.toString(2).padStart(mode === 'sum' ? bits : 1, '0') + '₂', inBase = n => n.toString(base).toUpperCase() + SUB[base];
      return () => {
        let v, a, b; if (mode === 'sum') { a = rand(1, 2 ** (bits - 1) - 1); b = rand(1, 2 ** (bits - 1) - 1); v = a + b; } else v = rand(level.min ?? 1, level.max ?? 2 ** bits - 1);
        const show = mode === 'bin2dec' ? String : mode === 'bin2base' ? inBase : bin, others = new Set();
        while (others.size < 2) { const w = pick([v + 1, v - 1, v + 2, v - 2, v ^ 2, v ^ 4, v ^ 8, v + 8]); if (w > 0 && w < 2 ** bits && w !== v) others.add(w); }
        const text = mode === 'dec2bin' ? `${v}₁₀ = ?` : mode === 'bin2dec' ? `${bin(v)} = ?₁₀` : mode === 'base2bin' ? `${inBase(v)} = ?₂` : mode === 'bin2base' ? `${bin(v)} = ?${SUB[base]}` : `${a.toString(2)}₂ + ${b.toString(2)}₂ = ?`;
        return {text, answer: show(v), wrong: [...others].map(show)};
      };
    }
    return () => {
      const t = pick(level.tasks), env = {}; for (const [name, values] of Object.entries(t.vars || {})) env[name] = pick(values);
      const answer = ev(t.answer, env), others = new Set(), near = [answer * 2, answer / 2, answer + 1, answer - 1, answer * 8, answer / 8, answer + 2, answer * 10, answer + 10, answer - 2, answer * 4].filter(x => x > 0 && Number.isInteger(x) && x !== answer);
      while (others.size < 2) others.add(pick(near));
      return {text: t.text.replace(/\{(\w+)\}/g, (_, k) => env[k]), answer: String(answer), wrong: [...others].map(String), tip: t.tip};
    };
  }
  MECH.race = (area, level, world, api) => arcade(area, ['Вы за рулём. Навстречу едут ворота с тремя ответами.', 'Прочитайте вопрос на табло и стрелками ← → встаньте в полосу с верным ответом.', 'Уже решили? Держите ↑ — машина прибавит газу. Въехали не в те ворота — минус жизнь. Жизней три.'], () => {
    const make = quizOf(level, world), total = level.count * 2, base = (level.raceSeconds || (world.type === 'binary' ? 10 : 20)) * 1000;
    let lives = 3, done = 0, lane = 1, q = null, age = 0, pause = 0, over = false, boost = false, streak = 0, limit = base;
    const h = hud(area, total), rule = el('p', 't-rule'), ask = el('strong'), road = el('div', 't-road'), gates = el('div', 't-gates'), car = sprite('car', 't-racer'); rule.append(el('span', '', 'Вопрос: '), ask);
    const boxes = [0, 1, 2].map(i => { const b = el('div', 't-gatebox'); gates.append(b); return b; }); road.append(gates, car);
    const place = () => { car.style.left = lane * 33.333 + 16.667 + '%'; };
    const move = d => { if (over) return; lane = Math.max(0, Math.min(2, lane + d)); place(); };
    function next() {
      if (done === total) { finish(); api.win(3 - lives, lives === 3 ? 'без потерь' : 'жизней осталось: ' + lives, lives < 3 ? 'Чтобы получить ★★★, не потеряйте ни одной жизни.' : ''); return; }
      const t = make(), labels = [t.answer, ...t.wrong].sort(() => Math.random() - .5); q = {...t, labels, correct: labels.indexOf(t.answer)}; age = 0;
      ask.textContent = q.text; boxes.forEach((b, i) => { b.className = 't-gatebox'; b.textContent = labels[i]; }); gates.style.top = '0%'; h.set(lives, done, streak > 1 ? 'Серия: ' + streak : '');
    }
    function settle() {
      const ok = lane === q.correct; done++; boxes[q.correct].classList.add('right');
      if (ok) { streak++; sfx('good'); api.note(''); limit = Math.max(limit * .96, base * .55); pause = 420; }
      else { lives--; streak = 0; sfx('bad'); shake(area); boxes[lane].classList.add('wrongbox'); api.note(`Не те ворота. Верный ответ: ${q.answer}. ${q.tip || ''}`); pause = 1700; }
      q = null; h.set(lives, done, streak > 1 ? 'Серия: ' + streak : ''); if (lives === 0) { finish(); api.over('Жизни закончились. Попробуйте ещё раз — вопросы будут другими.'); }
    }
    keys(e => { const k = e.key.toLowerCase(); if (e.key === 'ArrowLeft' || k === 'a' || k === 'ф') { e.preventDefault(); move(-1); } else if (e.key === 'ArrowRight' || k === 'd' || k === 'в') { e.preventDefault(); move(1); } else if (e.key === 'ArrowUp' || k === 'w' || k === 'ц') { e.preventDefault(); boost = true; } else if (['1', '2', '3'].includes(e.key)) { lane = Number(e.key) - 1; place(); } });
    const up = e => { if (e.key === 'ArrowUp' || ['w', 'ц'].includes(e.key.toLowerCase())) boost = false; }; document.addEventListener('keyup', up); cleanup.push(() => document.removeEventListener('keyup', up));
    const pad = el('div', 'g-actions'), gas = button('↑ Газ', 'g-small', () => { boost = !boost; gas.classList.toggle('on', boost); }); pad.append(button('← Влево', 'g-small', () => move(-1)), gas, button('Вправо →', 'g-small', () => move(1)));
    area.append(rule, road, pad, keyHint('← → — сменить полосу, ↑ — газ, 1 2 3 — сразу в полосу.')); place();
    const stop = ticker(dt => {
      if (pause > 0) { pause -= dt; if (pause <= 0 && !over) next(); return; }
      if (!q) return;
      age += dt * (boost ? 5 : 1); gates.style.top = Math.min(age / limit, 1) * 72 + '%'; road.style.backgroundPositionY = (performance.now() / (boost ? 2 : 6)) % 80 + 'px';
      if (age >= limit) settle();
    });
    function finish() { over = true; stop(); }
    debugAnswer = () => q ? q.correct : null; if (location.hostname === '127.0.0.1') window.School4Race = {lane: i => { lane = i; place(); }, boost: v => { boost = v; }}; next();
  });

  /* ---------- космический тир: корабль сбивает только то, что подходит под правило ---------- */
  MECH.shooter = (area, level, world, api) => arcade(area, ['Вы управляете кораблём. Сверху спускаются тарелки с надписями.', level.ordered ? 'Сбивайте тарелки строго по порядку, указанному в правиле. Остальные пока не трогайте.' : 'Сбивайте только те тарелки, которые подходят под правило на табло. Остальные пропускайте.', 'Стрелки ← → — лететь, пробел — огонь. Три жизни: сбили не ту тарелку или пропустили нужную — минус жизнь.'], () => {
    const goods = level.good.slice(), total = goods.length, text = level.rule.replace(/ешьте/g, 'сбивайте').replace(/Ешьте/g, 'Сбивайте').replace(/собирайте/g, 'сбивайте').replace(/соберите/g, 'сбейте');
    let lives = 3, hit = 0, over = false, ship = .5, left = false, right = false, cool = 0, wait = 0; const foes = [], shots = [], fall = level.fall || 15000, cols = [.12, .31, .5, .69, .88];
    const queue = level.ordered ? goods.slice() : goods.slice().sort(() => Math.random() - .5); let junk = [];
    const h = hud(area, total), rule = el('p', 't-rule'), field = el('div', 't-space'), me = sprite('ship', 't-ship'); rule.append(el('span', '', 'Правило: '), el('strong', '', text)); field.append(me);
    const isTarget = f => f.good && (!level.ordered || f.text === goods[hit]);
    function spawn() {
      const goodsUp = foes.filter(f => f.good).length, badUp = foes.length - goodsUp, free = cols.filter(x => !foes.some(f => f.x === x && f.y < .3));
      if (!free.length) return; let item = null;
      if (queue.length && goodsUp < 2 && (badUp >= 2 || !level.bad.length || Math.random() < .55)) item = {text: queue.shift(), good: true};
      else if (level.bad.length && badUp < 2) { if (!junk.length) junk = level.bad.slice().sort(() => Math.random() - .5); const t = junk.shift(); if (!foes.some(f => f.text === t)) item = {text: t, good: false}; }
      if (!item) return;
      const node = el('div', 't-foe'), saucer = sprite('ufo', 't-ufo'); saucer.style.color = `hsl(${rand(0, 11) * 30} 55% 55%)`; node.append(saucer, el('span', '', item.text)); field.append(node);
      foes.push({...item, x: free[rand(0, free.length - 1)], y: 0, node});
    }
    function drop(f, cls) { foes.splice(foes.indexOf(f), 1); f.node.classList.add(cls); setTimeout(() => f.node.remove(), 300); }
    function lose(note, f) { lives--; sfx('bad'); shake(area); api.note(note); if (f.good) queue.unshift(f.text); h.set(lives, hit); if (lives === 0) { finish(); api.over('Жизни закончились. ' + note); } }
    function fire() { if (over || cool > 0) return; cool = 330; sfx('step'); const node = el('i', 't-shot'); field.append(node); shots.push({x: ship, y: .88, node}); }
    function strike(f) {
      if (isTarget(f)) { hit++; sfx('good'); api.note(''); drop(f, 'boom'); h.set(lives, hit); if (hit === total) { finish(); api.win(3 - lives, lives === 3 ? 'без потерь' : 'жизней осталось: ' + lives, lives < 3 ? 'Чтобы получить ★★★, не потеряйте ни одной жизни.' : ''); } }
      else { drop(f, 'boom'); lose(f.good ? `Не по порядку: «${f.text}» нужно сбить позже.` : `«${f.text}» не подходит под правило — стрелять было нельзя.`, f); }
    }
    keys(e => { const k = e.key.toLowerCase(); if (e.key === 'ArrowLeft' || k === 'a' || k === 'ф') { e.preventDefault(); left = true; } else if (e.key === 'ArrowRight' || k === 'd' || k === 'в') { e.preventDefault(); right = true; } else if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); fire(); } });
    const up = e => { const k = e.key.toLowerCase(); if (e.key === 'ArrowLeft' || k === 'a' || k === 'ф') left = false; if (e.key === 'ArrowRight' || k === 'd' || k === 'в') right = false; }; document.addEventListener('keyup', up); cleanup.push(() => document.removeEventListener('keyup', up));
    const pad = el('div', 'g-actions'); pad.append(button('← Влево', 'g-small', () => { ship = Math.max(.06, ship - .095); }), button('Огонь', 'g-primary', fire), button('Вправо →', 'g-small', () => { ship = Math.min(.94, ship + .095); }));
    area.append(rule, field, pad, keyHint('← → — лететь, пробел или ↑ — огонь.')); h.set(lives, hit);
    const stop = ticker(dt => {
      ship = Math.max(.06, Math.min(.94, ship + ((right ? 1 : 0) - (left ? 1 : 0)) * dt * .0009)); me.style.left = ship * 100 + '%'; cool -= dt; wait -= dt;
      if (wait <= 0 && foes.length < 4) { spawn(); wait = 2400; }
      for (const s of shots.slice()) {
        s.y -= dt * .0017; s.node.style.left = s.x * 100 + '%'; s.node.style.top = s.y * 100 + '%';
        const f = foes.find(f => Math.abs(f.x - s.x) < .085 && s.y < f.y + .09 && s.y > f.y - .04);
        if (f || s.y < 0) { shots.splice(shots.indexOf(s), 1); s.node.remove(); if (f && !over) strike(f); }
      }
      for (const f of foes.slice()) {
        if (over) break; f.y += dt / fall; f.node.style.left = f.x * 100 + '%'; f.node.style.top = f.y * 100 + '%'; f.node.classList.toggle('low', f.y > .6);
        if (f.y >= .8) { const need = isTarget(f); drop(f, 'gone'); if (need) lose(`Пропущена нужная тарелка: «${f.text}».`, f); else if (f.good) queue.unshift(f.text); }
      }
    });
    function finish() { over = true; stop(); }
    debugAnswer = () => over ? null : ({ship, foes: foes.map(f => ({x: f.x, y: f.y, target: isTarget(f)}))});
    if (location.hostname === '127.0.0.1') window.School4Shooter = {aim: x => { ship = x; }, fire};
  });

  /* ---------- мемори: найди пару равных записей ---------- */
  MECH.pairs = (area, level, world, api) => {
    const cards = level.pairs.flatMap((p, k) => p.map(text => ({text, k}))).sort(() => Math.random() - .5), n = level.pairs.length;
    let open = [], tries = 0, found = 0, busy = false; const grid = el('div', 't-memory'), info = el('p', 't-counter');
    const count = () => { info.textContent = `Найдено пар: ${found} из ${n}. Попыток: ${tries}. На ★★★ — не больше ${2 * n}.`; };
    cards.forEach((card, i) => {
      const b = button('?', 't-flip', () => {
        if (busy || open.includes(i) || card.done) return;
        b.textContent = card.text; b.classList.add('up'); open.push(i); sfx('step');
        if (open.length < 2) return;
        tries++; const [x, y] = open.map(k => cards[k]);
        if (x.k === y.k) { x.done = y.done = true; found++; sfx('good'); open.forEach(k => { cards[k].node.classList.add('done'); cards[k].node.disabled = true; }); open = []; count(); if (found === n) api.win(tries <= 2 * n ? 0 : tries <= 3 * n ? 1 : 2, 'попыток: ' + tries, tries > 2 * n ? `Все пары найдены! Чтобы получить ★★★, уложитесь в ${2 * n} попыток: запоминайте, где лежат открытые карточки.` : ''); }
        else { busy = true; count(); const my = token; setTimeout(() => { if (my !== token) return; open.forEach(k => { cards[k].node.textContent = '?'; cards[k].node.classList.remove('up'); }); open = []; busy = false; }, 1100); }
      });
      b.dataset.card = i; card.node = b; grid.append(b);
    });
    area.append(el('p', 'g-note', 'Открывайте по две карточки. Пара — это две записи одного и того же. Найденные пары остаются открытыми.'), grid, info, keyHint('Стрелки — выбрать карточку, Enter или пробел — открыть.')); count(); roam(grid, '.t-flip', matchMedia('(max-width:700px)').matches ? 3 : 4); setTimeout(() => cards[0].node.focus({preventScroll: true}), 0);
    debugAnswer = () => cards.map(c => c.k);
  };

  /* ---------- тир по массиву ---------- */
  MECH.hunt = (area, level, world, api) => arcade(area, ['Перед вами массив a. На табло появляется задание — щёлкните по нужному элементу массива.', 'У каждого задания таймер. Ошибка или промедление — минус жизнь. Жизней три.', 'Помните: индексы в Python начинаются с нуля.'], () => {
    const order = level.queries.map((_, i) => i).sort(() => Math.random() - .5), total = order.length; let lives = 3, done = 0, q = null, age = 0, pause = 0, over = false; const limit = (level.seconds || 12) * 1000;
    const h = hud(area, total), rule = el('p', 't-rule'), ask = el('strong'), fuse = el('div', 't-fuse'), fill = el('i'), row = el('div', 't-targets'); rule.append(el('span', '', 'Цель: '), ask); fuse.append(fill);
    const cells = level.a.map((v, i) => { const b = button('', 't-target', () => shoot(i)), box = el('strong', '', v); b.append(box); if (level.showIndex) b.append(el('span', '', i)); b.dataset.target = i; b.setAttribute('aria-label', `Элемент со значением ${v}`); row.append(b); return b; });
    area.append(el('p', 't-arrname', 'a = [' + level.a.join(', ') + ']'), rule, fuse, row, keyHint('Цифра на клавиатуре — индекс элемента: 0 — первый.'));
    keys(e => { const i = Number(e.key); if (e.key.trim() && Number.isInteger(i) && i >= 0 && i < level.a.length) { e.preventDefault(); shoot(i); } });
    function next() {
      if (done === total) { finish(); api.win(3 - lives, lives === 3 ? 'без потерь' : 'жизней осталось: ' + lives, lives < 3 ? 'Чтобы получить ★★★, не потеряйте ни одной жизни.' : ''); return; }
      q = level.queries[order[done]]; age = 0; ask.textContent = q[0]; cells.forEach(c => c.classList.remove('hit', 'miss', 'was')); h.set(lives, done);
    }
    function lose(text) { lives--; done++; sfx('bad'); shake(area); api.note(text); cells[q[1]].classList.add('was'); q = null; pause = 1700; h.set(lives, done); if (lives === 0) { finish(); api.over('Жизни закончились. ' + text); } }
    function shoot(i) {
      if (!q || over) return;
      if (i !== q[1]) { cells[i].classList.add('miss'); lose(`Мимо. Правильный элемент подсвечен: его индекс ${q[1]}, значение ${level.a[q[1]]}.`); return; }
      cells[i].classList.add('hit'); sfx('good'); api.note(''); done++; q = null; pause = 420; h.set(lives, done);
    }
    const stop = ticker(dt => {
      if (pause > 0) { pause -= dt; if (pause <= 0 && !over) next(); return; }
      if (!q) return;
      age += dt; fill.style.width = Math.max(0, 100 - age / limit * 100) + '%';
      if (age >= limit) lose(`Время вышло. Правильный элемент подсвечен: его индекс ${q[1]}, значение ${level.a[q[1]]}.`);
    });
    function finish() { over = true; stop(); cells.forEach(c => c.disabled = true); }
    debugAnswer = () => q ? q[1] : null; next();
  });

  /* ---------- сервер: прогресс, списки классов, задание на урок ---------- */
  const API = '/results/api/trainer/';
  let remote = null, classes = {roster: {}, assignment: {}}, pushTimer = 0;
  async function call(path, body, ms = 8000) {
    const response = await fetch(API + path, {method: body ? 'POST' : 'GET', headers: body ? {'Content-Type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(ms)});
    const d = await response.json().catch(() => ({}));
    if (!response.ok || d.status !== 'ok') { const error = new Error(d.message || 'сервер не ответил'); error.status = response.status; throw error; }
    return d;
  }
  const who = () => ({slug: data.slug, className: player.className, name: player.name});
  async function pull() {
    const mine = player, d = await call('progress?' + new URLSearchParams(who()));
    for (const [id, r] of Object.entries(d.levels || {})) { const old = mine.levels[id]; if (!old || r.stars > old.stars) mine.levels[id] = {...r, clean: r.clean || !!old?.clean}; else if (r.clean) old.clean = true; }
    mine.sent = d.sent || {}; mine.name = d.name || mine.name; save(false);
    if (Object.keys(mine.levels).some(id => (d.levels?.[id]?.stars || 0) < mine.levels[id].stars)) push();
  }
  function push() {
    if (!remote || !player) return;
    clearTimeout(pushTimer); const mine = player;
    pushTimer = setTimeout(() => call('progress', {slug: data.slug, className: mine.className, name: mine.name, levels: mine.levels}).catch(() => {}), 300);
  }

  /* ---------- экраны ---------- */
  const TYPE_RU = {robot: 'Программирование · робот', trace: 'Симулятор · вы — исполнитель', binary: 'Аркада · двоичный конвейер', logic: 'Конструктор · логические схемы', pixel: 'Головоломка · пиксель-арт', graph: 'Стратегия · доставка', calc: 'Аркада · защита сервера', draw: 'Программирование · чертёжник', filter: 'Аркада · турникет', sort: 'Головоломка · сортировка', cipher: 'Аркада · дешифратор', truth: 'Аркада · логический турникет', array: 'Трассировка · массивы', sheet: 'Аркада · зависшие формулы', path: 'Приключение · проводник', catch: 'Аркада · сортировочная станция', pairs: 'Мемори · найди пару', hunt: 'Аркада · тир', snake: 'Аркада · змейка', race: 'Аркада · гонка', shooter: 'Аркада · космический тир', boss: 'Битва с боссом'};
  const ICON = {robot: '⌖', trace: '↯', binary: '01', logic: '&', pixel: '▦', graph: '⌗', calc: '∑', draw: '✎', filter: '⇥', sort: '⇅', cipher: 'Ая', truth: '0|1', array: '[ ]', sheet: 'ƒx', path: 'C:\\', catch: '▼', pairs: '▣▣', hunt: '◎', snake: '∿', boss: '☠'};
  const RANKS = [[0, 'Новичок'], [.1, 'Стажёр'], [.3, 'Программист'], [.55, 'Инженер'], [.8, 'Архитектор'], [1, 'Мастер Кодограда']];
  const CLUES = {
    robot: 'Пройдите путь пальцем по полю. Какие команды повторяются и сколько раз?', draw: 'Из каких одинаковых частей состоит рисунок? Сколько их?',
    trace: 'Какая строка выполняется прямо сейчас и сколько раз она ещё повторится?', binary: 'Какие веса у разрядов? Какой самый большой вес помещается в число?',
    calc: 'Какие величины даны и в каких единицах нужен ответ?', logic: 'В каких строках таблицы лампа должна гореть? Что у этих строк общего?',
    pixel: 'Сколько клеток в строке и что означает каждая цифра кода?', graph: 'Какие маршруты вообще возможны? Чему равна длина каждого?',
    filter: 'Из каких простых условий состоит выражение и чем они связаны?', sort: 'Какие соседние пары стоят в неправильном порядке?',
    cipher: 'На сколько позиций сдвинута каждая буква и в какую сторону нужно идти по таблице?', truth: 'Какая операция выполняется первой? Что она даёт в каждой строке?',
    array: 'Чему равна переменная цикла на каждом шаге и какой элемент массива при этом меняется?', sheet: 'На какие ячейки ссылается формула? Есть ли среди них ячейки с другими формулами?',
    path: 'С какого диска начинается путь и через какие папки нужно пройти?', catch: 'По какому признаку предметы делятся на группы? К какой группе относится этот предмет?',
    pairs: 'Переведите обе записи к одному виду — например, в десятичное число или в одни единицы.', hunt: 'С какого числа начинаются индексы? Чему равен индекс после вычисления выражения?', boss: 'Сначала решите задачу на табло, и только потом стреляйте в блок с ответом.', snake: 'Проверьте каждую карточку на поле: подходит ли она под правило? Проложите путь в обход лишних.'};
  const classNames = () => (data.classLetters || ['А', 'Б']).map(letter => `${data.grade} «${letter}»`);
  function header() {
    const head = el('header', 'g-header');
    head.append(el('p', 'g-eyebrow', `${data.subject} · ${data.grade} класс · Игровой тренажёр`), el('h1', '', data.title));
    if (view.name === 'login' || view.name === 'map') head.append(el('p', 'g-description', data.description));
    const bar = el('div', 'g-actions t-player');
    if (player) {
      const got = data.worlds.reduce((s, w) => s + worldStars(w), 0), max = data.worlds.reduce((s, w) => s + 3 * w.levels.length, 0), at = RANKS.findLastIndex(r => got / max >= r[0]), next = RANKS[at + 1];
      const rank = el('span', 't-rank', `${RANKS[at][1]} · ★ ${got}`); rank.title = next ? `До ранга «${next[1]}» осталось ★ ${Math.ceil(next[0] * max) - got}` : 'Высший ранг'; bar.append(rank);
    }
    if (player && LOCK) bar.append(el('span', 't-who', `Играет: ${player.name}, ${player.className}`));
    else if (player) bar.append(el('span', 't-who', `Играет: ${player.name}, ${player.className}`), button('Сменить игрока', 'g-small', () => { player = null; try { sessionStorage.removeItem(sessionKey); } catch {} view = {name: 'login'}; render(); }));
    if (player && data.game && (view.name === 'run' || view.name === 'map')) { const swap = button(view.name === 'run' ? 'Отметка и список боссов (M)' : '← В игру (M)', 'g-small', () => { view = {name: view.name === 'run' ? 'map' : 'run'}; render(); }); swap.dataset.act = 'swap'; bar.append(swap); keys(e => { if (['m', 'ь'].includes(e.key.toLowerCase())) swap.click(); }); }
    if (player && data.game && (view.name === 'map' || (view.name === 'run' && !view.boss))) { const records = button('Рекорды класса', 'g-small', () => { view = {name: 'records'}; render(); }); records.dataset.act = 'records'; bar.append(records); }
    if (teacher() && view.name !== 'teacher') { const b = button('Панель учителя', 'g-small', () => { view = {name: 'teacher'}; render(); }); b.dataset.act = 'teacher'; bar.append(b); }
    const sound = button('Звук: ' + (store.sound ? 'вкл' : 'выкл'), 'g-small', () => { store.sound = !store.sound; save(false); sound.textContent = 'Звук: ' + (store.sound ? 'вкл' : 'выкл'); sfx('good'); }); sound.setAttribute('aria-pressed', String(!!store.sound)); bar.append(sound);
    head.append(bar);
    root.append(head);
  }
  const isFull = () => document.fullscreenElement === root || matchMedia('(display-mode: fullscreen)').matches || (innerHeight >= screen.height - 4 && innerWidth >= screen.width - 4);
  const syncFull = () => root.classList.toggle('full', view.name === 'run' && isFull());
  function toggleFull() { if (document.fullscreenElement) document.exitFullscreen?.(); else root.requestFullscreen?.().catch(() => {}); }
  document.addEventListener('fullscreenchange', syncFull); addEventListener('resize', syncFull);
  function render() {
    token++; cleanup.splice(0).forEach(f => f()); debugAnswer = null; root.replaceChildren(); header();
    root.classList.toggle('playing', ['level', 'city', 'run'].includes(view.name)); syncFull();
    ({login: renderLogin, map: renderMap, level: renderLevel, teacher: renderTeacher, city: renderCity, run: renderRun, records: renderRecords})[view.name]();
  }
  function renderLogin() {
    const panel = el('section', 'g-intro'), form = el('form', 't-login');
    for (const line of data.story || []) panel.append(el('p', '', line));
    const classLabel = el('label', '', 'Класс'), klass = el('select'), nameLabel = el('label'); let name;
    for (const c of classNames()) { const o = el('option', '', c); o.value = c; klass.append(o); }
    if (classNames().includes(store.lastClass)) klass.value = store.lastClass;
    classLabel.append(klass);
    function nameField() {
      const list = classes.roster?.[klass.value];
      if (list?.length) { name = el('select'); const blank = el('option', '', 'Выберите себя в списке…'); blank.value = ''; name.append(blank); for (const n of list) { const o = el('option', '', n); o.value = n; name.append(o); } }
      else { name = el('input'); name.autocomplete = 'off'; name.maxLength = 80; }
      name.required = true; name.dataset.field = 'name'; nameLabel.replaceChildren('Фамилия и имя', name);
    }
    klass.addEventListener('change', nameField); nameField();
    const error = el('p', 't-error'); error.setAttribute('role', 'alert');
    const start = el('button', 'g-primary', 'Играть →'); start.type = 'submit';
    form.append(classLabel, nameLabel, error, start);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const clean = name.value.trim().replace(/\s+/g, ' ');
      if (clean.split(' ').length < 2 || clean.length < 5) { error.textContent = name.tagName === 'SELECT' ? 'Выберите себя в списке класса.' : 'Напишите фамилию и имя полностью — так отметка попадёт в журнал правильно.'; name.focus(); return; }
      const key = klass.value + '|' + norm(clean);
      player = store.profiles[key] || (store.profiles[key] = {key, name: clean, className: klass.value, levels: {}, sent: {}});
      store.lastClass = klass.value;
      if (remote) {
        start.disabled = true; error.textContent = '';
        try { await pull(); } catch (problem) { if (problem.status === 403 || problem.status === 400) { error.textContent = problem.message; player = null; start.disabled = false; return; } }
      }
      save(false); view = {name: home()}; render();
    });
    panel.append(el('h2', '', 'Кто играет?'), form, el('p', 'g-note', remote ? 'Прогресс хранится на школьном сервере: продолжить игру можно с любого компьютера кабинета. Отметка попадает в журнал, когда вы сами отправите результат мира.' : 'Прогресс сохраняется на этом компьютере отдельно для каждого ученика и класса: введите те же фамилию и имя, чтобы продолжить. Отметка попадает в журнал, когда вы сами отправите результат мира.'));
    const goals = el('ul'); for (const g of data.goals) goals.append(el('li', '', g)); panel.append(el('h2', '', 'Чему научимся'), goals);
    root.append(panel);
  }
  function badges() {
    const worlds = data.worlds, passed = w => w.levels.filter(l => rec(l)).length, full = w => passed(w) === w.levels.length;
    return [['Первый шаг', 'пройдите первый уровень', worlds.some(w => passed(w))],
      ['Три звезды', 'получите ★★★ за уровень', worlds.some(w => w.levels.some(l => rec(l)?.stars === 3))],
      ['Мир пройден', 'пройдите все уровни одного мира', worlds.some(full)],
      ['Своим умом', 'пройдите целый мир без подсказок', worlds.some(w => full(w) && w.levels.every(l => rec(l).clean))],
      ['Отличник', 'получите «5» за мир', worlds.some(w => worldMark(w) === 5)],
      ['Исследователь', 'сыграйте в каждом мире', worlds.every(w => passed(w))],
      ['Мастер Кодограда', 'получите «5» за все миры', worlds.every(w => worldMark(w) === 5)]];
  }
  function renderMap() {
    const g = data.grading, intro = el('p', 't-rules', `За каждый уровень — от ★ до ★★★. Отметка за мир считается по сумме звёзд: «5» — от ${g.five}%, «4» — от ${g.four}%, «3» — от ${g.three}%. Уровни можно переигрывать, в зачёт идёт лучший результат.`);
    root.append(intro);
    const medals = el('div', 't-badges'); medals.setAttribute('aria-label', 'Достижения');
    for (const [title, how, got] of badges()) { const chip = el('span', got ? 'got' : '', (got ? '✦ ' : '') + title); chip.title = got ? 'Достижение получено' : 'Как получить: ' + how; medals.append(chip); }
    root.append(medals);
    if (teacher()) root.append(el('p', 'g-note', 'Режим учителя: все уровни открыты без прохождения предыдущих.'));
    const grid = el('div', 't-worlds'), today = classes.assignment?.[player.className];
    for (const world of [...data.worlds].sort((a, b) => (b.id === today) - (a.id === today))) {
      const card = el('section', 't-world' + (world.id === today ? ' today' : '')), got = worldStars(world), max = 3 * world.levels.length, mark = worldMark(world), passed = world.levels.filter(l => rec(l)).length;
      if (world.id === today) card.append(el('p', 't-today', 'Задание на урок'));
      const top = el('div', 't-world-top'), names = el('div'); names.append(el('p', 'g-eyebrow', TYPE_RU[world.type]), el('h2', '', world.title)); top.append(el('span', 't-icon-tile t-icon-' + world.type, ICON[world.type]), names);
      card.append(top, el('p', '', world.description));
      const label = data.topicLabels?.[world.topicId];
      if (label && data.curriculum) { const a = el('a', 't-topic', label); a.href = '/bosova/#' + new URLSearchParams({grade: String(data.grade), level: data.curriculum.seriesId.endsWith('advanced') ? 'advanced' : 'basic', topic: world.topicId}); card.append(a); }
      const tiles = el('div', 't-levels');
      world.levels.forEach((level, i) => {
        const r = rec(level), open = teacher() || i === 0 || !!rec(world.levels[i - 1]);
        const b = button('', 't-level' + (r ? ' done' : open ? ' open' : ''), () => { view = {name: 'level', world, index: i}; render(); });
        b.append(el('strong', '', i + 1), el('span', '', r ? starText(r.stars) : open ? 'играть' : 'закрыт')); b.disabled = !open; b.dataset.level = level.id;
        b.setAttribute('aria-label', `Уровень ${i + 1}: ${level.title}. ${r ? 'Звёзд: ' + r.stars : open ? 'Открыт' : 'Закрыт'}`); tiles.append(b);
      });
      card.append(tiles);
      const bar = el('progress'); bar.max = max; bar.value = got; bar.setAttribute('aria-label', 'Звёзды мира');
      const nextMark = mark < 5 ? ` До «${mark < 3 ? 3 : mark + 1}» не хватает ★ ${need(world, mark < 3 ? g.three : mark === 3 ? g.four : g.five) - got}.` : '';
      card.append(bar, el('p', 't-score', `★ ${got} из ${max} · уровней ${passed} из ${world.levels.length} · отметка сейчас: ${mark}.${nextMark}`));
      const status = el('div', 't-status'), sent = player.sent[world.id];
      const send = button(sent ? 'Отправить улучшенный результат' : 'Отправить отметку в журнал', 'g-primary t-send', () => submit(world, status, send)); send.dataset.send = world.id;
      if (!passed) { send.disabled = true; status.textContent = 'Пройдите хотя бы один уровень, чтобы отправить результат.'; }
      else if (sent && sent.stars >= got) { send.disabled = true; status.textContent = `В журнале уже есть этот результат: ★ ${sent.stars}, отметка ${sent.mark}.`; }
      else if (sent) status.textContent = `В журнале: ★ ${sent.stars}, отметка ${sent.mark}. Сейчас у вас больше — можно отправить заново.`;
      card.append(send, status); grid.append(card);
    }
    root.append(grid);
    const how = el('section', 'g-intro t-how'); how.append(el('h2', '', 'Как играть'));
    const list = el('ul'); for (const line of data.instructions) list.append(el('li', '', line)); how.append(list); root.append(how);
  }
  async function submit(world, status, send, again) {
    const got = worldStars(world), max = 3 * world.levels.length, mark = worldMark(world), left = world.levels.filter(l => !rec(l)).length;
    if (!again && !confirm(`Отправить в журнал результат мира «${world.title}»?\n\n★ ${got} из ${max}, отметка ${mark}.` + (left ? `\nНе пройдено уровней: ${left} — они считаются как 0 звёзд.` : '') + '\n\nПозже можно улучшить результат и отправить его ещё раз.')) return;
    const answers = world.levels.map((l, i) => { const r = rec(l); return {num: i + 1, title: l.title, isCorrect: !!r, userAns: r ? starText(r.stars) + (r.detail ? ' · ' + r.detail : '') : 'не пройден'}; });
    const payload = {name: player.name, className: player.className, topic: `${data.grade} класс: ${data.title} · ${world.title}`, score: got, maxScore: max, percent: Math.round(got / max * 100), mark, attempt: 1, answers};
    if (demo) { status.textContent = 'Демонстрационный просмотр: отметка в журнал НЕ отправлена.'; return; }
    const mine = player, my = token;
    if (remote) {
      send.disabled = true; status.textContent = 'Отправляем результат в журнал…';
      try {
        await call('progress', {slug: data.slug, className: mine.className, name: mine.name, levels: mine.levels});
        const d = await call('submit', {...payload, slug: data.slug, worldId: world.id});
        mine.sent = d.sent; save(false);
        status.textContent = (d.updated ? 'Результат принят в журнал. ' : 'В журнале уже был результат не хуже — он сохранён. ') + `Квитанция № ${d.id} · ${d.time}`;
      } catch (error) {
        status.replaceChildren(el('span', '', 'Результат НЕ подтверждён журналом: ' + (error.name === 'TimeoutError' ? 'сервер долго не отвечает' : error.message) + '. '), button('Повторить отправку', 'g-small', () => submit(world, status, send, true)));
        send.disabled = false;
      }
      return;
    }
    new MutationObserver((_, observer) => {
      if (!/Результат принят в журнал/.test(status.textContent)) return;
      observer.disconnect(); mine.sent[world.id] = {stars: got, mark, time: Date.now()}; save(false); if (my === token) send.disabled = true;
    }).observe(status, {childList: true, subtree: true, characterData: true});
    School4Sections.submitTest(payload, status);
  }
  function renderLevel() {
    const world = view.world, index = view.index, level = world.levels[index], session = {hint: false, done: false};
    const panel = el('section', 'g-mission t-level-panel'), inCity = view.from === 'city', leave = () => { view = inCity ? {name: 'city', world} : {name: 'map'}; render(); }, back = button(inCity ? '← В район' : '← К карте миров', 'g-small', leave);
    const title = el('h2', 'g-mission-title', level.title); title.tabIndex = -1;
    panel.append(back, el('p', 'g-eyebrow', `${world.title}${level.play ? ' · ' + TYPE_RU[level.play].split(' · ').pop() : ''} · уровень ${index + 1} из ${world.levels.length}` + (rec(level) ? ' · лучший результат ' + starText(rec(level).stars) : '')), title, el('p', 'g-prompt', level.prompt));
    const area = el('div', 'g-play t-play'), feedback = el('div', 'g-feedback'), hint = el('p', 'g-hint', level.hint), clue = el('p', 'g-hint t-clue', level.clue || CLUES[world.type]); hint.hidden = clue.hidden = true;
    feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite'); feedback.id = 'trainer-feedback';
    const hintButton = button('Нужна подсказка посильнее (−1 ★)', 'g-small', () => { session.hint = true; hint.hidden = false; hintButton.disabled = true; }); hintButton.hidden = true; hintButton.dataset.act = 'hint';
    const clueButton = button('Наводящий вопрос (бесплатно)', 'g-small', () => { clue.hidden = false; clueButton.hidden = true; hintButton.hidden = false; }); clueButton.dataset.act = 'clue';
    const api = {
      note(text, cls = 'note') { if (session.done) return; feedback.className = 'g-feedback ' + (text ? cls : ''); feedback.textContent = text; },
      fail(text) { if (session.done) return; sfx('bad'); feedback.className = 'g-feedback retry'; feedback.replaceChildren(el('strong', '', 'Пока не получилось.'), el('p', '', text)); },
      over(text) { if (session.done) return; feedback.className = 'g-feedback retry'; feedback.dataset.over = '1'; const again = button('Сыграть ещё раз', 'g-primary', () => render()); again.dataset.act = 'again'; feedback.replaceChildren(el('strong', '', 'Игра окончена.'), el('p', '', text), again); again.focus({preventScroll: true}); },
      win(penalty, detail, why) {
        if (session.done) return; session.done = true;
        const stars = Math.max(1, 3 - penalty - (session.hint ? 1 : 0)), old = rec(level);
        player.levels[level.id] = {stars: Math.max(stars, old?.stars || 0), detail: !old || stars >= old.stars ? detail + (session.hint ? ', с подсказкой' : '') : old.detail, plays: (old?.plays || 0) + 1, clean: !session.hint || !!old?.clean}; save();
        feedback.className = 'g-feedback success'; feedback.dataset.stars = stars; sfx('win'); confetti();
        feedback.replaceChildren(el('strong', '', starText(stars) + ' · Уровень пройден!'), el('p', '', level.explanation));
        if (why || session.hint) feedback.append(el('p', '', why || 'Чтобы получить больше звёзд, пройдите уровень без подсказки.'));
        const actions = el('div', 'g-actions');
        if (inCity) actions.append(button('Терминал починен — в район →', 'g-primary', leave));
        else if (index + 1 < world.levels.length) actions.append(button('Следующий уровень →', 'g-primary', () => { view = {name: 'level', world, index: index + 1}; render(); }));
        else actions.append(button('Мир пройден — к карте →', 'g-primary', () => { view = {name: 'map'}; render(); }));
        if (stars < 3) actions.append(button('Пройти ещё раз на ★★★', 'g-small', () => render()));
        keys(e => { if (e.key === 'Escape') leave(); });
        feedback.append(actions); hintButton.disabled = clueButton.disabled = true; actions.querySelector('button').focus({preventScroll: true}); feedback.scrollIntoView({block: 'nearest', behavior: 'smooth'});
      }
    };
    const help = el('div', 'g-actions'); help.append(clueButton, hintButton);
    panel.append(area, help, clue, hint, feedback); root.append(panel);
    MECH[level.play || world.type](area, level, world, api);
    title.focus({preventScroll: true});
  }
  /* ---------- приключение: город, районы, терминалы ---------- */
  const home = () => data.game && location.hash !== '#list' ? 'run' : 'map';
  const STORY = {
    robot: 'Роботы-курьеры забыли свои маршруты. Напиши им программы заново!', draw: 'Чертёжная мастерская встала: робот-чертёжник разучился рисовать.',
    trace: 'Глюк стёр память исполнителей. Покажи им, как выполнять программы шаг за шагом.', binary: 'На заводе чисел остановился конвейер: Глюк перепутал все двоичные коды.',
    logic: 'В электрощитовой погас свет: логические схемы разобраны на детали.', pixel: 'В галерее пропали картины — остались только коды пикселей.',
    graph: 'Служба доставки потеряла карты. Топлива курьеру хватит только на кратчайший путь.', calc: 'На серверную напали вирусы! Обезвредить их можно только точным расчётом.',
    filter: 'Турникеты на вокзале пропускают всех подряд. Настрой их по условиям.', truth: 'Логические турникеты сошли с ума. Проверь каждый сигнал сам.',
    sort: 'На складе всё перепутано. Расставь по порядку за наименьшее число перестановок.', cipher: 'Мы перехватили шифровки Глюка. Расшифруй их, пока не поздно!',
    sheet: 'В бухгалтерии зависли все формулы. Придётся считать самому.', path: 'В архиве потерялись файлы. Найди их в лабиринте папок.',
    catch: 'На сортировочной станции завал: ящики сыплются без разбора.', pairs: 'В библиотеке перемешались карточки. Найди пары.',
    hunt: 'В тире массивов сбились прицелы. Покажи меткость!', snake: 'Питомец города, змейка Питон, проголодался. Корми его только правильным.', array: 'В хранилище перепутаны массивы.'};
  /* Вопрос с вариантами ответа из данных уровня — для блоков платформера. null, если механика уровня играется только на терминале. */
  function asker(level, world) {
    const pick = list => list[rand(0, list.length - 1)], others = (list, skip, n) => list.filter(x => x !== skip).sort(() => Math.random() - .5).slice(0, n);
    if (world.type === 'calc' || world.type === 'binary') return quizOf(level, world);
    if (world.type === 'filter') return () => { const row = pick(level.rows), ok = !!ev(level.cond, Object.fromEntries(level.fields.map((f, k) => [f, row[k + 1]]))); return {text: `Условие: ${tx(level.cond, 'ru')}. ${row[0]} (${level.fields.map((f, k) => f + ' ' + row[k + 1]).join(', ')}) подходит?`, answer: ok ? 'да' : 'нет', wrong: [ok ? 'нет' : 'да']}; };
    if (world.type === 'truth') return () => { const expr = level.cols[level.cols.length - 1], v = Object.fromEntries(level.vars.map(n => [n, rand(0, 1)])), r = ev(expr, v); return {text: `${tx(expr, 'L')} при ${level.vars.map(n => n + ' = ' + v[n]).join(', ')}`, answer: String(r), wrong: [String(1 - r)]}; };
    if (world.type === 'catch') return () => { const it = pick(level.items); return {text: `«${it[0]}» — это…`, answer: level.bins[it[1]], wrong: others(level.bins, level.bins[it[1]], 2)}; };
    if (world.type === 'pairs') return () => { const p = pick(level.pairs); return {text: `Чему равно: ${p[0]}?`, answer: p[1], wrong: others(level.pairs.map(q => q[1]), p[1], 2)}; };
    if (world.type === 'hunt') return () => { const q = pick(level.queries); return {text: `a = [${level.a.join(', ')}]. ${q[0]} — это число…`, answer: String(level.a[q[1]]), wrong: others(level.a.map(String), String(level.a[q[1]]), 2)}; };
    if (world.type === 'snake') return () => {
      if (level.ordered || level.bad.length < 2) { const three = level.good.map((t, k) => [t, k]).sort(() => Math.random() - .5).slice(0, 3).sort((a, b) => a[1] - b[1]); return {text: `Правило: ${level.rule}. Что из этого идёт раньше всех?`, answer: three[0][0], wrong: three.slice(1).map(t => t[0])}; }
      const good = pick(level.good); return {text: `Правило: ${level.rule.replace(/^ешьте только /, 'нужны только ')}. Что подходит?`, answer: good, wrong: others(level.bad, '', 2)};
    };
    if (world.type === 'cipher' && level.mode !== 'crack') return () => { const c = pick([...level.word]), enc = level.mode === 'encode', a = shiftText(c, enc ? level.shift : 0), shown = enc ? c : shiftText(c, level.shift), right = enc ? a : c; return {text: `Шифр сдвига на ${level.shift}. ${enc ? 'Зашифруйте' : 'Расшифруйте'} букву «${shown}».`, answer: right, wrong: [shiftText(right, 1), shiftText(right, -1)]}; };
    return null;
  }
  /* Записать результат уровня: лучший результат сохраняется, прогресс уходит на сервер. */
  function grant(level, stars, detail) { const old = rec(level); player.levels[level.id] = {stars: Math.max(stars, old?.stars || 0), detail: !old || stars >= old.stars ? detail : old.detail, plays: (old?.plays || 0) + 1, clean: true}; save(); }

  /* ---------- платформер ---------- */
  const T = 48, VW = 20, VH = 11, GROUND = 9;
  function buildStage(world) {
    const cols = [], things = [], stations = []; let x = 0;
    const col = () => { const c = Array(VH).fill(' '); cols.push(c); return c; };
    const ground = n => { for (let k = 0; k < n; k++) { const c = col(); c[GROUND] = '#'; c[GROUND + 1] = '#'; } x += n; };
    const hole = n => { for (let k = 0; k < n; k++) col(); x += n; };
    const put = (cx, cy, ch) => { cols[cx][cy] = ch; };
    const coin = (cx, cy) => things.push({k: 'coin', x: cx * T + T / 2, y: cy * T + T / 2, bit: rand(0, 1)});
    const virus = (cx, a, b) => things.push({k: 'virus', x: cx * T, y: GROUND * T - 34, a: a * T, b: b * T, v: 70, w: 34, h: 34, alive: true});
    if (!world) {
      ground(7); things.push({k: 'bit', x: 3 * T, y: GROUND * T - 52});
      data.worlds.forEach((w, n) => { ground(6); things.push({k: 'door', x: (x - 4) * T, y: (GROUND - 2) * T, world: w, num: n + 1}); coin(x - 1, GROUND - 2); });
      ground(6); return {cols, things, stations, width: x * T, spawn: 2 * T};
    }
    ground(7); things.push({k: 'exit', x: T, y: (GROUND - 2) * T}, {k: 'bit', x: 4 * T, y: GROUND * T - 52});
    world.levels.forEach((level, n) => {
      const x0 = x, kind = (n + data.worlds.indexOf(world)) % 5;
      if (kind === 0) { ground(10); virus(x0 + 3, x0 + 1, x0 + 5); virus(x0 + 7, x0 + 5, x0 + 9); for (let k = 2; k < 8; k += 2) coin(x0 + k, GROUND - 2); }
      else if (kind === 1) { ground(4); hole(3); ground(4); for (let k = 0; k < 3; k++) coin(x0 + 4 + k, GROUND - 3 - (k === 1 ? 1 : 0)); virus(x0 + 9, x0 + 8, x0 + 10); }
      else if (kind === 2) { ground(11); put(x0 + 3, GROUND - 1, '='); put(x0 + 4, GROUND - 1, '='); put(x0 + 4, GROUND - 2, '='); put(x0 + 5, GROUND - 1, '='); put(x0 + 5, GROUND - 2, '='); put(x0 + 5, GROUND - 3, '='); coin(x0 + 5, GROUND - 5); things.push({k: 'spike', x: (x0 + 7) * T, y: GROUND * T - 18, w: 2 * T, h: 18}); coin(x0 + 9, GROUND - 2); }
      else if (kind === 3) { ground(2); hole(8); ground(2); for (const [dx, dy] of [[3, 7], [4, 7], [6, 6], [7, 6]]) { put(x0 + dx, dy, '='); coin(x0 + dx, dy - 2); } }
      else { ground(9); virus(x0 + 4, x0 + 2, x0 + 7); for (let k = 2; k < 8; k++) coin(x0 + k, GROUND - 1); put(x0 + 4, GROUND - 4, '='); put(x0 + 5, GROUND - 4, '='); coin(x0 + 4, GROUND - 6); coin(x0 + 5, GROUND - 6); }
      const s0 = x, make = asker(level, world); ground(13);
      const st = {level, index: n, x0: s0 * T, x1: (s0 + 12) * T, gate: s0 + 11, make, blocks: [], hits: 0, miss: 0, q: null}; stations.push(st);
      if (make) { const count = make().wrong.length + 1; (count === 2 ? [3, 7] : [2, 5, 8]).forEach((dx, k) => { put(s0 + dx, 5, 'A'); st.blocks.push({cx: s0 + dx, k, bump: 0}); }); }
      else things.push({k: 'terminal', x: (s0 + 5) * T, y: (GROUND - 2) * T, st});
      if (!rec(level) && !teacher()) for (let y = 0; y < GROUND; y++) put(st.gate, y, 'G');
    });
    ground(14); const arena = x - 14;
    if (!player.seen?.['boss-' + world.id]) { things.push({k: 'boss', x: (arena + 8) * T, y: GROUND * T - 78, a: (arena + 2) * T, b: (arena + 12) * T, v: 110, w: 78, h: 78, hp: 3, alive: true, safe: 0}); for (let y = 0; y < GROUND; y++) put(x - 1, y, 'W'); }
    ground(6); things.push({k: 'flag', x: (x - 3) * T, y: (GROUND - 3) * T});
    return {cols, things, stations, width: x * T, spawn: 3 * T, world};
  }
  function renderCity() {
    const world = view.world || null; player.pos = player.pos || {}; player.seen = player.seen || {}; player.bits = player.bits || 0;
    const stage = buildStage(world), {cols, things, stations} = stage, key = world ? world.id : 'hub', fixed = level => !!rec(level), allDone = w => w.levels.every(fixed);
    const panel = el('section', 'g-mission t-city'), canvas = el('canvas', 't-stage'), g = canvas.getContext('2d'), bar = el('div', 't-hud'), ask = el('p', 't-rule t-ask2'), hint = el('p', 't-hint2'), talk = el('div', 't-talk'); canvas.width = VW * T; canvas.height = VH * T; talk.hidden = true; ask.hidden = true;
    const solid = (cx, cy) => { const c = cols[cx]?.[cy]; return c === '#' || c === '=' || c === 'A' || c === 'G' || c === 'W'; };
    const hero = {x: Math.min(player.pos[key] ?? stage.spawn, stage.width - 3 * T), y: GROUND * T - 44, w: 28, h: 44, vx: 0, vy: 0, ground: false, face: 1, hearts: 3, safe: 0, check: stage.spawn, run: 0};
    if (world) { const open = stations.filter(s => fixed(s.level) || teacher()); hero.x = Math.max(stage.spawn, Math.min(hero.x, (stations.find(s => !fixed(s.level) && !teacher())?.gate ?? 1e9) * T - 2 * T)); hero.check = open.length ? Math.min(hero.x, (open[open.length - 1].gate + 2) * T) : stage.spawn; }
    while (solid(Math.floor(hero.x / T), GROUND - 1)) hero.x += T;
    const held = {}; let queue = [], after = null, cam = 0, time = 0, over = false, note = '', noteUntil = 0;
    function say(lines, then) { queue = lines.slice(); after = then || null; talk.hidden = false; step(); }
    function step() { if (!queue.length) { talk.hidden = true; const f = after; after = null; if (f) f(); return; } const next = button('Дальше ↵', 'g-small', step); next.dataset.act = 'next'; talk.replaceChildren(sprite('guest', 't-speaker'), el('p', '', queue.shift()), next); }
    const talking = () => !talk.hidden, flash = (text, ms = 2200) => { note = text; noteUntil = time + ms; };
    function hurt(text) {
      if (hero.safe > 0) return; hero.hearts--; hero.safe = 1500; sfx('bad'); shake(canvas); if (text) flash(text);
      if (hero.hearts <= 0) { hero.hearts = 3; hero.x = hero.check; hero.y = GROUND * T - hero.h - 2; hero.vx = hero.vy = 0; flash('Бит починил тебя и вернул к последней открытой двери.', 3000); }
    }
    function newQuestion(st) { const t = st.make(), labels = [t.answer, ...t.wrong].sort(() => Math.random() - .5); st.q = {...t, labels, correct: labels.indexOf(t.answer)}; }
    function hitBlock(st, b) {
      if (fixed(st.level) || b.bump > 0 || !st.q || st.pause > 0) return; b.bump = 220;
      if (b.k === st.q.correct) { st.hits++; sfx('good'); flash('Верно!', 900); if (st.hits >= 3) { const stars = st.miss === 0 ? 3 : st.miss <= 2 ? 2 : 1; grant(st.level, stars, st.miss ? 'ошибок: ' + st.miss : 'без ошибок'); for (let y = 0; y < GROUND; y++) cols[st.gate][y] = ' '; hero.check = (st.gate + 2) * T; confetti(); sfx('win'); flash(`Ворота открыты! ${starText(stars)} — «${st.level.title}».`, 3200); st.q = null; } else newQuestion(st); }
      else { st.miss++; const right = st.q.labels[st.q.correct]; hurt(`Не тот блок. Верный ответ: ${right}.`); st.pause = 1500; setTimeout(() => { if (!fixed(st.level)) newQuestion(st); }, 1400); }
    }
    function launch(st) { player.pos[key] = hero.x; save(false); view = {name: 'level', world, index: st.index, from: 'city'}; render(); }
    function finishDistrict() {
      if (over) return; over = true; const lines = [`Район «${world.title}» восстановлен! Звёзд: ${worldStars(world)} из ${3 * world.levels.length}, отметка — ${worldMark(world)}.`, 'Отправь отметку в журнал: нажми M и найди этот район в списке.'];
      if (data.worlds.every(allDone)) lines.push('Все районы Кодограда снова работают. Глюк побеждён — ты настоящий Мастер Кодограда!');
      if (!player.seen['flag-' + world.id]) { player.seen['flag-' + world.id] = true; save(false); confetti(); sfx('win'); } say(lines, () => { player.pos[key] = stage.spawn; save(false); view = {name: 'city'}; render(); });
    }
    function act() {
      const near = things.find(t => ['door', 'exit', 'terminal', 'bit'].includes(t.k) && Math.abs(t.x + T / 2 - (hero.x + hero.w / 2)) < T * .9 && hero.ground);
      if (!near) return false;
      if (near.k === 'door') { player.pos.hub = hero.x; save(false); view = {name: 'city', world: near.world}; render(); }
      else if (near.k === 'exit') { player.pos[key] = hero.x; save(false); view = {name: 'city'}; render(); }
      else if (near.k === 'terminal') launch(near.st);
      else say(world ? [STORY[world.type], 'Беги вправо. Собирай биты, прыгай на вирусы сверху и открывай ворота.'] : ['Глюк прячется в районах города. Двери с номерами ведут туда.', `Починено терминалов: ${data.worlds.reduce((n, w) => n + w.levels.filter(fixed).length, 0)} из ${data.worlds.reduce((n, w) => n + w.levels.length, 0)}. Собрано битов: ${player.bits}.`]);
      return true;
    }
    keys(e => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (talking()) { if (k === 'Enter' || k === ' ') { e.preventDefault(); step(); } return; }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
      if ((k === 'ArrowUp' || k === 'w' || k === 'ц' || k === 'Enter') && !e.repeat && act()) return;
      if (k === 'Escape' && world) { player.pos[key] = hero.x; save(false); view = {name: 'city'}; render(); return; }
      held[k] = true;
    });
    const up = e => { held[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; }; document.addEventListener('keyup', up); cleanup.push(() => document.removeEventListener('keyup', up));
    const pad = el('div', 't-padkeys'); for (const [label, k] of [['←', 'ArrowLeft'], ['→', 'ArrowRight'], ['Прыжок', ' '], ['Войти ↑', 'act']]) { const b = el('button', 'g-command', label); b.type = 'button'; if (k === 'act') b.addEventListener('click', act); else { b.addEventListener('pointerdown', () => { held[k] = true; }); for (const ev2 of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev2, () => { held[k] = false; }); } pad.append(b); }
    function update(dt) {
      time += dt; if (hero.safe > 0) hero.safe -= dt; const s = dt / 1000, left = held.ArrowLeft || held.a || held['ф'], right = held.ArrowRight || held.d || held['в'], jump = held[' '] || held.ArrowUp || held.w || held['ц'];
      const want = (right ? 1 : 0) - (left ? 1 : 0); hero.vx += (want * 265 - hero.vx) * Math.min(1, s * 12); if (want) hero.face = want; hero.run += Math.abs(hero.vx) * s;
      if (jump && hero.ground) { hero.vy = -770; hero.ground = false; sfx('step'); } if (!jump && hero.vy < -260) hero.vy = -260;
      hero.vy = Math.min(hero.vy + 2100 * s, 900);
      hero.x += hero.vx * s; hero.x = Math.max(0, Math.min(stage.width - hero.w, hero.x));
      for (const cy of [Math.floor(hero.y / T), Math.floor((hero.y + hero.h / 2) / T), Math.floor((hero.y + hero.h - 1) / T)]) { if (hero.vx > 0 && solid(Math.floor((hero.x + hero.w) / T), cy)) { hero.x = Math.floor((hero.x + hero.w) / T) * T - hero.w - .01; hero.vx = 0; } else if (hero.vx < 0 && solid(Math.floor(hero.x / T), cy)) { hero.x = (Math.floor(hero.x / T) + 1) * T + .01; hero.vx = 0; } }
      hero.y += hero.vy * s; hero.ground = false;
      for (const cx of [Math.floor((hero.x + 2) / T), Math.floor((hero.x + hero.w - 2) / T)]) {
        if (hero.vy >= 0 && solid(cx, Math.floor((hero.y + hero.h) / T))) { hero.y = Math.floor((hero.y + hero.h) / T) * T - hero.h; hero.vy = 0; hero.ground = true; }
        else if (hero.vy < 0 && solid(cx, Math.floor(hero.y / T))) { const cy = Math.floor(hero.y / T); if (cols[cx][cy] === 'A') { const st = stations.find(q => q.blocks.some(b => b.cx === cx)); if (st) hitBlock(st, st.blocks.find(b => b.cx === cx)); } hero.y = (cy + 1) * T; hero.vy = 0; }
      }
      if (hero.y > VH * T + 60) { hero.x = hero.check; hero.y = GROUND * T - hero.h - 2; hero.vx = hero.vy = 0; hero.safe = 0; hurt('Осторожно, яма! Бит вернул тебя к последней открытой двери.'); }
      for (const t of things) {
        if (t.k === 'coin' && !t.got && Math.abs(t.x - hero.x - hero.w / 2) < 26 && Math.abs(t.y - hero.y - hero.h / 2) < 34) { t.got = true; player.bits++; sfx('step'); }
        else if ((t.k === 'virus' || t.k === 'boss') && t.alive) {
          t.x += t.v * s; if (t.x < t.a) { t.x = t.a; t.v = Math.abs(t.v); } if (t.x + t.w > t.b) { t.x = t.b - t.w; t.v = -Math.abs(t.v); } if (t.safe > 0) t.safe -= dt;
          if (hero.x < t.x + t.w && hero.x + hero.w > t.x && hero.y < t.y + t.h && hero.y + hero.h > t.y) {
            if (hero.vy > 120 && hero.y + hero.h - t.y < t.h * .6) { hero.vy = -520; sfx('good'); if (t.k === 'virus') { t.alive = false; player.bits += 2; } else if (t.safe <= 0) { t.hp--; t.safe = 700; t.v *= 1.35; if (t.hp <= 0) { t.alive = false; player.seen['boss-' + world.id] = true; player.bits += 10; for (const c of cols) for (let y = 0; y < GROUND; y++) if (c[y] === 'W') c[y] = ' '; save(false); confetti(); sfx('win'); flash('Страж Глюка повержен! Путь к флагу открыт.', 3200); } else flash(`Попадание! Осталось ударов: ${t.hp}.`, 1500); } }
            else hurt(t.k === 'boss' ? 'Страж Глюка задел тебя. Прыгай на него сверху!' : 'Вирус задел тебя. Прыгай на вирусы сверху!');
          }
        }
        else if (t.k === 'spike' && hero.x < t.x + t.w && hero.x + hero.w > t.x && hero.y + hero.h > t.y + 4) hurt('Это баги — шипы. Перепрыгивай их!');
        else if (t.k === 'flag' && Math.abs(t.x - hero.x) < T && hero.ground) finishDistrict();
      }
      for (const st of stations) { for (const b of st.blocks) if (b.bump > 0) b.bump -= dt; if (st.pause > 0) st.pause -= dt; }
      cam += (Math.max(0, Math.min(stage.width - VW * T, hero.x - VW * T * .4)) - cam) * Math.min(1, s * 8);
      const st = stations.find(q => hero.x + hero.w > q.x0 && hero.x < q.x1), mid = hero.x + hero.w / 2, near = things.find(t => ['door', 'exit', 'terminal', 'bit'].includes(t.k) && Math.abs(t.x + T / 2 - mid) < T * .9);
      if (st && st.make && !fixed(st.level)) { if (!st.q && !(st.pause > 0)) newQuestion(st); if (st.q) { const text = `${st.q.text}   ` + st.q.labels.map((l, k) => 'АБВ'[k] + ' — ' + l).join('     '); if (ask.dataset.t !== text) { ask.dataset.t = text; ask.replaceChildren(el('span', '', `Ворота ${st.index + 1}, верных ответов ${st.hits} из 3: `), el('strong', '', st.q.text), el('em', '', st.q.labels.map((l, k) => 'АБВ'[k] + ' — ' + l).join('   ·   '))); } ask.hidden = false; } } else { ask.hidden = true; ask.dataset.t = ''; }
      const tip = near?.k === 'door' ? `Район ${near.num}: «${near.world.title}» · ★ ${worldStars(near.world)} из ${3 * near.world.levels.length}. Нажмите ↑, чтобы войти.` : near?.k === 'exit' ? 'Выход на главную улицу — нажмите ↑.' : near?.k === 'terminal' ? `Терминал «${near.st.level.title}»${fixed(near.st.level) ? ' починен ' + starText(rec(near.st.level).stars) : ''}. Нажмите ↑, чтобы ${fixed(near.st.level) ? 'сыграть ещё раз' : 'починить'}.` : near?.k === 'bit' ? 'Это Бит. Нажмите ↑, чтобы поговорить.' : st && st.make && !fixed(st.level) ? 'Запрыгните головой в блок с верным ответом.' : time < noteUntil ? '' : world ? 'Бегите вправо к флагу района.' : 'Идите вдоль улицы и выбирайте район.';
      const line = time < noteUntil ? note : tip; if (hint.textContent !== line) hint.textContent = line;
      const hud = '♥'.repeat(hero.hearts) + '♡'.repeat(3 - hero.hearts) + `   Биты: ${player.bits}` + (world ? `   Ворота: ${world.levels.filter(fixed).length} из ${world.levels.length}` : ''); if (bar.textContent !== hud) bar.textContent = hud;
    }
    const tower = Array.from({length: 40}, (_, k) => [k * 150 + (k * 37) % 60, 90 + (k * 53) % 150, 60 + (k * 29) % 50]);
    function draw() {
      const sky = g.createLinearGradient(0, 0, 0, VH * T); sky.addColorStop(0, world ? '#12284a' : '#7ec8ee'); sky.addColorStop(1, world ? '#2f6f8f' : '#e4f5fd'); g.fillStyle = sky; g.fillRect(0, 0, VW * T, VH * T);
      for (const [bx, bh, bw] of tower) { const sx = bx - cam * .35; if (sx > -90 && sx < VW * T) { g.fillStyle = world ? '#0b1b33' : '#a9d3e8'; g.fillRect(sx, GROUND * T - bh, bw, bh); g.fillStyle = world ? '#ffd76a99' : '#ffffffaa'; for (let wy = GROUND * T - bh + 10; wy < GROUND * T - 14; wy += 20) for (let wx = sx + 8; wx < sx + bw - 10; wx += 16) if ((wx + wy + bx) % 3 < 2) g.fillRect(wx, wy, 7, 10); } }
      g.save(); g.translate(-Math.round(cam), 0);
      const c0 = Math.max(0, Math.floor(cam / T)), c1 = Math.min(cols.length - 1, c0 + VW + 1);
      for (let cx = c0; cx <= c1; cx++) for (let cy = 0; cy < VH; cy++) {
        const c = cols[cx][cy], px = cx * T, py = cy * T; if (c === ' ') continue;
        if (c === '#') { g.fillStyle = '#7a4a2b'; g.fillRect(px, py, T, T); if (cols[cx][cy - 1] !== '#') { g.fillStyle = '#4caf50'; g.fillRect(px, py, T, 12); g.fillStyle = '#3d8f43'; g.fillRect(px, py + 12, T, 4); } }
        else if (c === '=') { g.fillStyle = '#a65d42'; g.fillRect(px, py, T, T); g.strokeStyle = '#6e3f2e'; g.lineWidth = 3; g.strokeRect(px + 1.5, py + 1.5, T - 3, T - 3); g.beginPath(); g.moveTo(px, py + T / 2); g.lineTo(px + T, py + T / 2); g.stroke(); }
        else if (c === 'G' || c === 'W') { g.fillStyle = c === 'G' ? '#c0392b' : '#5a3f8f'; g.fillRect(px + 14, py, 20, T); g.fillStyle = '#ffffff55'; g.fillRect(px + 18, py + ((time / 12) % T), 12, 10); }
        else if (c === 'A') { const st = stations.find(q => q.blocks.some(b => b.cx === cx)), b = st.blocks.find(q => q.cx === cx), off = b.bump > 0 ? -8 * Math.sin(b.bump / 220 * Math.PI) : 0, done = fixed(st.level); g.fillStyle = done ? '#8a8f96' : '#f1b434'; g.fillRect(px, py + off, T, T); g.strokeStyle = done ? '#5d6166' : '#9a6710'; g.lineWidth = 4; g.strokeRect(px + 2, py + 2 + off, T - 4, T - 4); g.fillStyle = '#3f2c05'; g.font = '700 28px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(done ? '✓' : 'АБВ'[b.k], px + T / 2, py + T / 2 + 2 + off); if (!done && st.q) { const label = st.q.labels[b.k]; g.font = `700 ${label.length > 9 ? 13 : 17}px system-ui,sans-serif`; const w = Math.min(g.measureText(label).width + 16, 150); g.fillStyle = '#173c3a'; g.fillRect(px + T / 2 - w / 2, py - 30, w, 24); g.fillStyle = '#fff'; g.fillText(label.length > 18 ? label.slice(0, 17) + '…' : label, px + T / 2, py - 17, 140); } }
      }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const t of things) {
        if (t.x < cam - 120 || t.x > cam + VW * T + 120) continue;
        if (t.k === 'coin' && !t.got) { const bob = Math.sin(time / 250 + t.x) * 3; g.fillStyle = '#f1cf5b'; g.beginPath(); g.arc(t.x, t.y + bob, 13, 0, 7); g.fill(); g.strokeStyle = '#b97d14'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#6b4a05'; g.font = '700 15px ui-monospace,monospace'; g.fillText(t.bit, t.x, t.y + bob + 1); }
        else if ((t.k === 'virus' || t.k === 'boss') && t.alive) { const r = t.w / 2, cx = t.x + r, cy = t.y + r; g.fillStyle = t.k === 'boss' ? (t.safe > 0 ? '#fff' : '#7b2d8b') : '#d9483b'; g.strokeStyle = g.fillStyle; g.lineWidth = t.k === 'boss' ? 7 : 4; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + time / 500; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25); g.stroke(); } g.beginPath(); g.arc(cx, cy, r * .82, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - r * .3, cy - r * .15, r * .22, 0, 7); g.arc(cx + r * .3, cy - r * .15, r * .22, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(cx - r * .3 + Math.sign(t.v) * 2, cy - r * .15, r * .1, 0, 7); g.arc(cx + r * .3 + Math.sign(t.v) * 2, cy - r * .15, r * .1, 0, 7); g.fill(); if (t.k === 'boss') { g.fillStyle = '#fff'; g.font = '700 16px system-ui'; g.fillText('♥'.repeat(t.hp), cx, t.y - 14); } }
        else if (t.k === 'spike') { g.fillStyle = '#5d6166'; for (let k = 0; k < t.w; k += 16) { g.beginPath(); g.moveTo(t.x + k, t.y + t.h); g.lineTo(t.x + k + 8, t.y); g.lineTo(t.x + k + 16, t.y + t.h); g.fill(); } }
        else if (t.k === 'door' || t.k === 'exit') { const done = t.world && allDone(t.world), today = t.world && classes.assignment?.[player.className] === t.world.id; g.fillStyle = done ? '#e0a030' : t.k === 'exit' ? '#6b7785' : '#1f6a5b'; g.fillRect(t.x, t.y, T, 2 * T); g.strokeStyle = today && Math.floor(time / 400) % 2 ? '#e2483d' : '#f1cf5b'; g.lineWidth = 4; g.strokeRect(t.x + 2, t.y + 2, T - 4, 2 * T - 2); g.fillStyle = '#fff'; g.font = '700 24px system-ui'; g.fillText(t.k === 'exit' ? '⇦' : t.num, t.x + T / 2, t.y + 30); if (t.world) { g.font = '700 13px system-ui'; g.fillStyle = world ? '#fff' : '#173c3a'; g.fillText(t.world.title, t.x + T / 2, t.y - 26, 5.4 * T); g.fillText(`★ ${worldStars(t.world)}/${3 * t.world.levels.length}`, t.x + T / 2, t.y - 9); } }
        else if (t.k === 'terminal') { const ok = fixed(t.st.level); g.fillStyle = '#6b7785'; g.fillRect(t.x + 18, t.y + 62, 12, 34); g.fillRect(t.x + 4, t.y + 8, 40, 56); g.fillStyle = ok ? '#0f3a25' : '#3a1512'; g.fillRect(t.x + 9, t.y + 13, 30, 46); g.fillStyle = ok ? '#8cf0ad' : (Math.floor(time / 350) % 2 ? '#ff8a7d' : '#7a2f28'); g.font = '700 22px system-ui'; g.fillText(ok ? '✓' : '!', t.x + T / 2, t.y + 37); }
        else if (t.k === 'bit') { g.fillStyle = '#2e8672'; g.fillRect(t.x + 8, t.y + 8 + Math.sin(time / 300) * 2, 32, 26); g.fillRect(t.x + 13, t.y + 36, 22, 14); g.fillStyle = '#fff'; g.beginPath(); g.arc(t.x + 18, t.y + 20, 5, 0, 7); g.arc(t.x + 30, t.y + 20, 5, 0, 7); g.fill(); g.fillStyle = '#173c3a'; g.beginPath(); g.arc(t.x + 18, t.y + 20, 2, 0, 7); g.arc(t.x + 30, t.y + 20, 2, 0, 7); g.fill(); g.fillStyle = '#f1cf5b'; g.beginPath(); g.arc(t.x + 24, t.y + 3, 4, 0, 7); g.fill(); }
        else if (t.k === 'flag') { g.fillStyle = '#5b4a2a'; g.fillRect(t.x + 20, t.y, 6, 3 * T); g.fillStyle = '#e2483d'; g.beginPath(); g.moveTo(t.x + 26, t.y + 4); g.lineTo(t.x + 78, t.y + 22); g.lineTo(t.x + 26, t.y + 42); g.fill(); }
      }
      if (!(hero.safe > 0 && Math.floor(time / 90) % 2)) {
        const hx = hero.x, hy = hero.y, leg = hero.ground ? Math.sin(hero.run / 9) * 6 : 5; g.fillStyle = '#2b3a55'; g.fillRect(hx + 5, hy + 34, 8, 10 + (hero.ground ? leg / 2 : 0)); g.fillRect(hx + 16, hy + 34, 8, 10 - (hero.ground ? leg / 2 : 0));
        g.fillStyle = '#3a84b8'; g.fillRect(hx + 3, hy + 18, 22, 18); g.fillStyle = '#f2c9a0'; g.beginPath(); g.arc(hx + 14, hy + 11, 10, 0, 7); g.fill(); g.fillStyle = '#e2483d'; g.fillRect(hx + 4, hy, 20, 8); g.fillRect(hx + (hero.face > 0 ? 14 : -2), hy + 5, 16, 4); g.fillStyle = '#173c3a'; g.beginPath(); g.arc(hx + 14 + hero.face * 4, hy + 12, 1.8, 0, 7); g.fill();
      }
      g.restore();
    }
    panel.append(el('h2', 'g-mission-title', world ? `Район ${data.worlds.indexOf(world) + 1}: ${world.title}` : 'Кодоград · главная улица'), bar, ask, canvas, talk, hint, pad, keyHint('← → или A D — бежать, пробел — прыжок, ↑ — войти в дверь или запустить терминал, Esc — на главную улицу, M — список миров и отметки.'));
    root.append(panel); draw();
    const stop = ticker(dt => { if (!talking() && !over) for (let k = 0; k < 2; k++) update(dt / 2); draw(); }); cleanup.push(() => { stop(); if (player) { player.pos[key] = hero.x; } });
    if (!world && !player.seen.intro) { player.seen.intro = true; save(false); say([`Привет, ${player.name.split(' ').pop()}! Я Бит, робот-помощник. У нас беда: вирус Глюк пробрался в Кодоград и сломал городские системы.`, 'Беги по улице: двери с номерами ведут в районы. В каждом районе Глюк запер ворота и расставил своих вирусов.', 'Стрелки — бежать, пробел — прыгать. На вирусы прыгай сверху. Чтобы открыть ворота, бей головой блок с верным ответом!']); }
    else if (world && !player.seen[world.id]) { player.seen[world.id] = true; save(false); say([STORY[world.type], `Ворот в этом районе: ${world.levels.length}. В конце ждёт страж Глюка — на него надо прыгнуть три раза.`]); }
    if (location.hostname === '127.0.0.1') window.School4Plat = {hero, held, stations, things, stage, talking, act, say, cols, at: () => [Math.round(hero.x), Math.round(hero.y), key]};
  }
  /* ---------- «Битва с Глюком»: беги, стреляй, побеждай боссов знаниями ---------- */
  // Картинки, перерисованные нейросетью (tools/art3), лежат в art/ под прежними именами; остальное — старый набор в assets/.
  const NEWART = new Set(["bee_a", "bee_b", "big_bee_a", "big_bee_b", "big_block_fall", "big_block_idle", "big_fly_a", "big_fly_b", "big_frog_idle", "big_frog_jump", "big_ladybug_walk_a", "big_ladybug_walk_b", "big_slime_fire_walk_a", "big_slime_fire_walk_b", "big_slime_normal_walk_a", "big_slime_normal_walk_b", "big_slime_spike_walk_a", "big_slime_spike_walk_b", "big_worm_ring_move_a", "big_worm_ring_move_b", "block_empty", "block_exclamation", "block_fall", "block_idle", "bomb", "bricks_brown", "bush", "cactus", "character_green_duck", "character_green_hit", "character_green_idle", "character_green_jump", "character_green_walk_a", "character_green_walk_b", "coin", "coin_gold", "door_closed", "door_closed_top", "door_open", "door_open_top", "fence", "fireball", "fly_a", "fly_b", "frog_idle", "frog_jump", "gem_yellow", "grass", "hud_heart", "hud_heart_empty", "ladybug_walk_a", "ladybug_walk_b", "lock_red", "mushroom_brown", "mushroom_red", "rock", "saw_a", "saw_b", "sign", "slime_fire_walk_a", "slime_fire_walk_b", "slime_normal_walk_a", "slime_normal_walk_b", "slime_spike_walk_a", "slime_spike_walk_b", "spikes", "terrain_grass_block_center", "terrain_grass_block_top", "terrain_grass_cloud_left", "terrain_grass_cloud_middle", "terrain_grass_cloud_right", "terrain_stone_block_center", "terrain_stone_block_top", "terrain_stone_cloud_left", "terrain_stone_cloud_middle", "terrain_stone_cloud_right", "torch_on_a", "torch_on_b", "worm_ring_move_a", "worm_ring_move_b"]);
  const IMG = {}, pic = n => IMG[n] || (IMG[n] = Object.assign(new Image(), {src: n.startsWith('bgp_') ? 'art/' + n + '.jpg?v=1' : (NEWART.has(n) ? 'art/' : 'assets/') + n + '.png' + (NEWART.has(n) ? '?v=1' : '')}));
  const SND = {}; function snd(n) { if (!store.sound) return; try { const a = (SND[n] = SND[n] || new Audio('assets/' + n + '.ogg')).cloneNode(); a.volume = .5; a.play().catch(() => {}); } catch {} }
  MECH.boss = (area, level, world) => { const go = button('▶ В бой!', 'g-primary t-start', () => { view = {name: 'run', boss: level}; render(); }); area.append(el('p', '', 'Босса можно победить только в игре: бегите, стреляйте и отвечайте на его вопросы.'), go); setTimeout(() => go.focus({preventScroll: true}), 0); };
  async function renderRecords() {
    const mine = token, panel = el('section', 'g-mission t-records'), content = el('div'), status = el('p', 'g-note', 'Загружаем рекорды…');
    panel.append(button('← На улицу', 'g-small', () => { view = {name: 'run'}; render(); }), el('h2', '', 'Рекорды · ' + player.className), el('p', 'g-note', 'Лучшие сохранённые звёзды за боссов. При равном числе звёзд место одинаковое. Результаты всех режимов входят в общую таблицу.'), status, content);
    const refresh = button('Обновить', 'g-small', load); panel.append(refresh); root.append(panel);
    async function load() {
      refresh.disabled = true; status.textContent = 'Загружаем рекорды…';
      try {
        const result = await call('leaderboard?' + new URLSearchParams(who())); if (mine !== token) return;
        const table = el('table', 'g-table'), head = el('thead'), titles = el('tr'); for (const title of ['Место', 'Игрок', 'Звёзды', 'Боссы']) titles.append(el('th', '', title)); head.append(titles); table.append(head);
        const body = el('tbody'); for (const row of result.rows) { const tr = el('tr'); if (row.mine) tr.className = 't-record-mine'; for (const value of [row.rank, row.name + (row.mine ? ' · вы' : ''), row.stars + ' / ' + result.maxStars, row.bosses + ' / ' + result.bossCount]) tr.append(el('td', '', String(value))); body.append(tr); } table.append(body); content.replaceChildren(table); status.textContent = 'Игроков: ' + result.rows.length + '. Ваш результат выделен.';
      } catch (error) { if (mine === token) { content.replaceChildren(); status.textContent = 'Общие рекорды пока недоступны: ' + error.message + '. Нажмите «Обновить».'; } }
      finally { if (mine === token) refresh.disabled = false; }
    }
    await load();
  }
  function renderRun() {
    const world = data.worlds[0], bosses = world.levels, level = view.boss || null, W = 1280, H = 720, FLOOR = 590, beaten = l => !!rec(l), open = i => teacher() || i === 0 || beaten(bosses[i - 1]);
    player.seen = player.seen || {}; player.bits = player.bits || 0; player.shop = player.shop || {};
    player.difficulty = player.difficulty || {questions: 'simple', combat: 'normal'};
    const questionMode = player.difficulty.questions === 'standard' ? 'standard' : 'simple', combatMode = player.difficulty.combat === 'calm' ? 'calm' : 'normal', threatRate = combatMode === 'calm' ? .6 : 1;
    const questionBank = () => questionMode === 'standard' && level.standardQuestions?.length ? level.standardQuestions : level.questions;
    const SHOP = [['heart', 'Запасное сердце', 'В каждом бою и забеге на одно сердце больше', 60], ['double', 'Двойной прыжок', 'Второй прыжок прямо в воздухе', 80], ['rapid', 'Скорострел', 'Бластер стреляет в полтора раза чаще', 100], ['card', 'Заряд наготове', 'Бой с боссом начинается с одной супер-картой', 70]];
    const PERKS = [['heart', '+1 сердце', 'Ещё одно сердце на этот бой'], ['shield', 'Щит', 'Первый удар в бою не отнимет сердце'], ['spread', 'Тройной выстрел', 'Бластер бьёт веером из трёх пуль'], ['fifty', 'Подсказка', 'Через 5 секунд один неверный блок гаснет'], ['rapid', 'Скорострел', 'Стрельба в полтора раза чаще'], ['double', 'Двойной прыжок', 'Второй прыжок в воздухе']];
    const perks = new Set(), has = k => !!player.shop[k] || perks.has(k), maxHearts = () => 3 + (player.shop.heart ? 1 : 0) + (perks.has('heart') ? 1 : 0);
    const panel = el('section', 'g-mission t-city'), canvas = el('canvas', 't-stage'), g = canvas.getContext('2d'); canvas.width = W; canvas.height = H; canvas.setAttribute('aria-label', 'Игровое поле');
    const answerPad = el('div', 't-padkeys t-answerkeys'); answerPad.hidden = true; answerPad.setAttribute('aria-label', 'Ответ на вопрос');
    const errorPanel = el('div', 't-error-review'); errorPanel.hidden = true; errorPanel.setAttribute('role', 'status');
    const review = el('details', 't-error-history'), reviewTitle = el('summary', '', 'Разбор ошибок · 0'), reviewList = el('div'); review.append(reviewTitle, reviewList);
    const mistakes = player.errorHistory = (Array.isArray(player.errorHistory) ? player.errorHistory : []).filter(m => m && ['text', 'answer', 'why'].every(k => typeof m[k] === 'string')).slice(0, 6);
    const updateReview = () => { reviewTitle.textContent = 'Разбор ошибок · ' + mistakes.length; reviewList.replaceChildren(...mistakes.map(m => { const item = el('div', 't-error-item'); item.append(el('strong', '', m.text), el('p', '', m.answer + ' — ' + m.why)); return item; })); }; updateReview();
    const showMistake = (text, answer, why) => {
      mistakes.unshift({text, answer, why}); if (mistakes.length > 6) mistakes.pop();
      errorPanel.replaceChildren(el('strong', '', 'Правильный ответ: ' + answer), el('span', '', why), button('Закрыть разбор', 'g-small', () => { errorPanel.hidden = true; })); errorPanel.hidden = false;
      updateReview(); save(false);
    };
    const FONT = '"Russo One", system-ui, sans-serif'; document.fonts?.load('20px "Russo One"').catch(() => {});
    const THEME = {background_color_hills: ['hills', '#58b9ee', '#d9f2ff', ['bush', 'grass', 'fence', 'grass', 'sign']], background_color_trees: ['trees', '#4aa7d8', '#d6f5e6', ['bush', 'mushroom_brown', 'rock', 'grass']], background_color_desert: ['desert', '#f7b267', '#ffe9c4', ['cactus', 'rock', 'cactus', 'rock']], background_color_mushrooms: ['mushrooms', '#8f7fe0', '#f4d9ff', ['mushroom_red', 'mushroom_brown', 'grass', 'mushroom_red']]}[level ? level.bg : 'background_color_hills'];
    const hero = {x: 110, y: FLOOR - 66, w: 40, h: 66, vx: 0, vy: 0, ground: true, face: 1, hearts: 3, safe: 0, cool: 0, dash: 0, dashCool: 0, walk: 0, flash: 0, air: 0, shield: 0}, held = {}, bullets = [], shots = [], foes = [], parts = [], pops = [], ghosts = [], targets = [];
    const doors = level ? [] : bosses.map((b, i) => ({x: 520 + i * 190, i, b})), shopX = 190;
    const boss = level ? {x: 1000, y: 250, w: 230, h: 230, hp: level.hp || 6, max: level.hp || 6, flash: 0, wait: 2600, kind: level.kind, bob: 0, recoil: 0, dying: 0, stun: 0, phase: 1, warning: null} : null;
    let segs = [[-1e6, 1e6]], plats = [], coins = [], gates = [], saws = [], exitX = 0, width = level ? W : doors.length * 190 + 900, check = 110, props = [];
    let queue = [], after = null, line = '', time = 0, state = level ? 'stage' : 'hub', q = null, pool = [], wrongs = 0, deaths = 0, cam = 0, note = '', noteUntil = 0, pauseQ = 0, shieldTold = false, banner = null, white = 0, slow = 0, hint = '', cards = 0, sel = 0, offer = [], jumpBuffer = 0, coyote = 0;
    const decorate = () => { props = Array.from({length: Math.ceil(width / 150)}, (_, k) => ({name: THEME[3][(k * 7 + (level ? bosses.indexOf(level) : 3)) % THEME[3].length], x: 60 + k * 150 + (k * 53) % 70, s: 56 + (k * 31) % 22})).filter(p => segs.some(([a, b]) => p.x > a + 10 && p.x + p.s < b - 10)); };
    function say(lines, then) { queue = lines.slice(); after = then || null; step(); }
    function step() { if (!queue.length) { line = ''; const f = after; after = null; if (f) f(); return; } line = queue.shift(); snd('select'); }
    const talking = () => line !== '', flash = (text, ms = 2200) => { note = text; noteUntil = time + ms; };
    const tints = {}; function tinted(name, color) { const key = name + color; if (tints[key]) return tints[key]; const im = pic(name); if (!im.complete || !im.naturalWidth) return null; const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return (tints[key] = c); }
    const emit = (name, x, y, o = {}) => parts.push({name, x, y, vx: o.vx || 0, vy: o.vy || 0, g: o.g || 0, life: o.life || 500, max: o.life || 500, a: o.size || 40, b: o.grow ?? o.size ?? 40, rot: Math.random() * 6, vr: o.vr || 0, color: o.color || '#ffffff', add: o.add !== false, alpha: o.alpha ?? 1});
    const puff = (x, y, n = 5, color = '#e9eef2') => { for (let k = 0; k < n; k++) emit('p_smoke', x + rand(-14, 14), y + rand(-6, 6), {vx: rand(-60, 60), vy: rand(-50, -10), life: rand(350, 600), size: 26, grow: 70, color, add: false, alpha: .7, vr: 2}); };
    const stars = (x, y, n = 10, color = '#ffe36a') => { for (let k = 0; k < n; k++) { const a = Math.random() * 7; emit(k % 2 ? 'p_star' : 'p_spark', x, y, {vx: Math.cos(a) * rand(120, 420), vy: Math.sin(a) * rand(120, 420), g: 500, life: rand(350, 700), size: rand(22, 44), grow: 6, color, vr: 6}); } };
    const boom = (x, y, s = 1) => { emit('p_flare', x, y, {life: 260, size: 160 * s, grow: 320 * s, color: '#fff3c4'}); for (let k = 0; k < 7; k++) emit('p_flame', x + rand(-30, 30) * s, y + rand(-30, 30) * s, {vx: rand(-90, 90), vy: rand(-160, -30), life: rand(380, 650), size: 60 * s, grow: 130 * s, color: k % 2 ? '#ff8a3d' : '#ffd23f', vr: 3}); puff(x, y, 6, '#6b6f78'); };
    const pop = (text, x, y, color = '#fff', size = 34) => pops.push({text, x, y, life: 1100, color, size});
    const gain = (n, x, y) => { player.bits += n; if (x !== undefined) pop('+' + n, x, y, '#ffe36a', 24); };
    /* --- забег перед боссом: случайная цепочка участков и двое «ворот знаний» --- */
    function buildStage() {
      segs = []; plats = []; coins = []; gates = []; saws = []; foes.length = 0; let x = 0;
      const ground = n => { if (segs.length && segs[segs.length - 1][1] === x) segs[segs.length - 1][1] += n; else segs.push([x, x + n]); x += n; }, gap = n => { x += n; };
      const foe = (type, fx, a, b) => foes.push({type, x: fx, y: type === 'fly' ? 320 : FLOOR - (type === 'turret' ? 62 : 52), w: type === 'turret' ? 62 : 52, h: type === 'turret' ? 62 : 52, a: a ?? fx - 200, b: b ?? fx + 200, vx: type === 'bug' ? 150 : 70, hp: type === 'turret' ? 3 : type === 'slime' ? 2 : 1, base: 300 + rand(0, 90), wait: 1200, hit: 0});
      const row = (cx, n, y = FLOOR - 70) => { for (let k = 0; k < n; k++) coins.push({x: cx + k * 46, y}); }, arc = (cx, w) => { for (let k = 0; k < 4; k++) coins.push({x: cx + w * (k + .5) / 4, y: FLOOR - 150 - Math.sin((k + .5) / 4 * Math.PI) * 70}); };
      const chunk = k => { const x0 = x;
        if (k === 0) { ground(900); foe('slime', x0 + 300, x0 + 140, x0 + 520); foe('slime', x0 + 680, x0 + 540, x0 + 860); row(x0 + 200, 5); }
        else if (k === 1) { ground(280); gap(200); ground(300); gap(200); ground(280); arc(x0 + 280, 200); arc(x0 + 780, 200); foe('fly', x0 + 900); }
        else if (k === 2) { ground(1000); plats.push([x0 + 150, 450, 192], [x0 + 430, 360, 192], [x0 + 710, 450, 192]); row(x0 + 180, 3, 400); row(x0 + 460, 3, 310); row(x0 + 740, 3, 400); foe('fly', x0 + 560); foe('bug', x0 + 700, x0 + 80, x0 + 940); }
        else if (k === 3) { ground(900); foe('turret', x0 + 640); plats.push([x0 + 260, 440, 192]); row(x0 + 290, 3, 390); row(x0 + 120, 3); }
        else { ground(950); saws.push({x: x0 + 300, t: 0}, {x: x0 + 640, t: 1.6}); foe('bug', x0 + 480, x0 + 60, x0 + 900); row(x0 + 400, 4); } };
      const gate = () => { ground(900); gates.push({x: x - 110, zone: x - 820, open: false, hp: 0}); };
      ground(700); let last = -1; const next = () => { let k; do { k = rand(0, 4); } while (k === last); last = k; chunk(k); };
      next(); next(); gate(); next(); next(); gate(); next(); ground(760); exitX = x - 330; width = x; check = 110; decorate();
    }
    function arena() { answerPad.hidden = true; jumpBuffer = coyote = 0; segs = [[-1e6, 1e6]]; plats = [[190, 440, 192], [540, 372, 192]]; coins = []; gates = []; saws = []; foes.length = bullets.length = shots.length = targets.length = 0; q = null; width = W; cam = 0; hero.x = 110; hero.y = FLOOR - hero.h; hero.vx = hero.vy = 0; hero.hearts = maxHearts(); hero.shield = has('shield') ? 1 : 0; cards = Math.max(cards, player.shop.card ? 1 : 0); decorate(); }
    function nextQuestion(base = 0, gate = null) {
      if (!pool.length) pool = questionBank().slice().sort(() => Math.random() - .5);
      const t = pool.pop(), labels = [t.a, ...t.w].sort(() => Math.random() - .5); q = {text: t.q, explanation: t.explanation || level.hint, labels, correct: labels.indexOf(t.a), born: time, gate, fifty: false}; targets.length = 0;
      const spots = labels.length === 2 ? [[330, 250], [680, 235]] : [[150, 255], [450, 215], [760, 255]];
      labels.forEach((label, k) => { targets.push({x: gate ? base + (labels.length === 2 ? [200, 470] : [110, 330, 550])[k] : spots[k][0], y: spots[k][1], w: 78, h: 78, k, label, pop: 0, off: false}); puff(base + spots[k][0] + 39, spots[k][1] + 39, 4, '#fff7d6'); });
      answerPad.replaceChildren(...labels.map((label, k) => { const choose = button(`${k + 1} · ${label}`, 'g-command', () => { const target = q && targets.find(t => t.k === k && !t.off); if (target && !talking()) strike(target); }); return choose; }));
      answerPad.hidden = false; snd('magic');
    }
    function hurt(text) {
      if (hero.safe > 0 || hero.dash > 0 || (state !== 'fight' && state !== 'stage')) return;
      if (hero.shield > 0) { hero.shield = 0; hero.safe = 1200; snd('bump'); emit('p_circle', hero.x + 20, hero.y + 30, {life: 400, size: 60, grow: 220, color: '#8fd4f7'}); pop('ЩИТ!', hero.x + 20, hero.y - 10, '#8fd4f7'); return; }
      hero.hearts--; hero.safe = 1600; hero.flash = 260; hero.vy = -420; hero.vx = -hero.face * 240; snd('hurt'); sfx('bad'); shake(canvas); white = .35; stars(hero.x + 20, hero.y + 30, 8, '#ff6b5e'); pop('−1 ♥', hero.x + 20, hero.y - 10, '#ff6b5e'); if (text) flash(text);
      if (hero.hearts > 0) return;
      if (state === 'stage') { hero.hearts = maxHearts(); hero.x = check; hero.y = FLOOR - hero.h - 4; hero.vx = hero.vy = 0; hero.safe = 1800; shots.length = 0; banner = {text: 'ЕЩЁ РАЗ!', born: time, color: '#ff8a3d'}; flash('Бит вернул тебя к последнему флажку.', 2600); }
      else { state = 'dead'; deaths++; banner = {text: 'ПОРАЖЕНИЕ', born: time, color: '#ff6b5e', hold: true}; }
    }
    function restart() { arena(); hero.safe = 1200; boss.hp = boss.max; boss.phase = 1; boss.warning = null; boss.wait = 2400; pool = []; note = ''; noteUntil = 0; ready(); }
    function ready() { state = 'ready'; banner = {text: 'ПРИГОТОВЬСЯ!', born: time, color: '#ffe36a'}; setTimeout(() => { if (state !== 'ready') return; banner = {text: 'В БОЙ!', born: time, color: '#ff8a3d'}; snd('magic'); setTimeout(() => { if (state === 'ready') { state = 'fight'; nextQuestion(); } }, 750); }, 1050); }
    function toPerk() { answerPad.hidden = true; state = 'perk'; player.seen['stage-' + level.id] = true; save(false); q = null; targets.length = 0; shots.length = 0; held.x = held['ч'] = false; offer = PERKS.filter(p => !player.shop[p[0]]).sort(() => Math.random() - .5).slice(0, 3); sel = 1; snd('magic'); }
    function takePerk(k) { perks.add(offer[k][0]); snd('coin'); arena(); state = 'intro'; say(level.intro.concat(`Чтобы победить, нужно ${boss.max} точных ответов. Сердец у тебя: ${maxHearts()}.`), ready); }
    function strike(t) {
      const gate = q.gate, right = q.labels[q.correct], questionText = q.text, why = q.explanation; answerPad.hidden = true;
      if (t.k === q.correct) {
        snd('magic'); sfx('good'); stars(t.x + 39, t.y + 39, 16); white = .4; pop('ВЕРНО!', t.x + 39, t.y - 6, '#b6ff6a', 44); cards = Math.min(3, cards + 1); gain(10, t.x + 39, t.y + 60); targets.length = 0; q = null;
        if (gate) { gate.open = true; boom(gate.x + 30, FLOOR - 120, 1.3); boom(gate.x + 30, FLOOR - 320, 1.1); shake(canvas); check = gate.x + 130; flash('Ворота знаний открыты! Флажок сохранил твой путь.', 2400); pauseQ = 0; return; }
        boss.hp--; if (boss.hp > 0 && boss.phase === 1 && boss.hp * 2 <= boss.max) { boss.phase = 2; boss.warning = null; boss.wait = Math.max(boss.wait, 900); pop('ФАЗА 2!', boss.x + boss.w / 2, boss.y - 30, '#ffb347', 36); } boss.flash = 520; boss.recoil = 1; boom(boss.x + boss.w / 2, boss.y + boss.h / 2, .9); shake(canvas); pop('−1', boss.x + boss.w / 2, boss.y, '#ffe36a', 54); shots.length = 0;
        if (boss.hp <= 0) { state = 'won'; boss.dying = 1700; slow = 1200; foes.length = 0; banner = {text: 'НОКАУТ!', born: time, color: '#ffe36a', hold: true}; const bad = wrongs + deaths * 2, got = bad === 0 ? 3 : bad <= 2 ? 2 : 1; gain(got * 15); grant(level, got, `ошибок: ${wrongs}, поражений: ${deaths}`); sfx('win'); setTimeout(() => { confetti(); banner = null; say([`${level.title} повержен! ${starText(got)} Награда: ${got * 15} битов.`, level.explanation, bosses.every(beaten) ? 'Глюк изгнан из Кодограда. Ты — Мастер Кодограда! Нажми M и отправь отметку в журнал.' : 'Возвращаемся на улицу: загляни в мастерскую и к следующему боссу.'], () => { view = {name: 'run'}; render(); }); }, 2300); }
        else { flash(`Точное попадание! У босса осталось ${boss.hp}.`, 1500); pauseQ = 1300; }
      } else {
        showMistake(questionText, right, why);
        wrongs++; t.pop = 400; snd('bump'); puff(t.x + 39, t.y + 39, 8, '#59606a'); pop('МИМО!', t.x + 39, t.y - 6, '#ff6b5e', 44); targets.length = 0; q = null; pauseQ = 1900;
        if (gate) { flash(`Неверно: правильный ответ — ${right}. Из ворот вылетели вирусы!`, 2600); for (const dy of [0, 90]) foes.push({type: 'fly', x: gate.x - 60, y: 260 + dy, w: 52, h: 52, vx: 0, hp: 1, base: 300 + dy, hit: 0, wait: 0, a: 0, b: 0}); }
        else { flash(`Неверно: правильный ответ — ${right}. Босс в ярости!`, 2600); boss.warning = {kind: 'rage', phase: boss.phase, left: 700, total: 700, marks: [], lanes: []}; }
      }
    }
    function fire() {
      if (hero.cool > 0 || state === 'dead' || state === 'won' || state === 'perk') return; hero.cool = has('rapid') ? 125 : 190; snd('throw');
      const up = held.w || held['ц'] || ((held.c || held['с']) && held.ArrowUp), side = held.ArrowLeft || held.ArrowRight || held.a || held.d || held['ф'] || held['в'], ang = Math.atan2(up ? (side ? -.72 : -1) : 0, up && !side ? 0 : hero.face * (up ? .72 : 1));
      for (const off of has('spread') ? [-.2, 0, .2] : [0]) { const dx = Math.cos(ang + off), dy = Math.sin(ang + off); bullets.push({x: hero.x + hero.w / 2 + dx * 30, y: hero.y + 30 + dy * 30, vx: dx * 900, vy: dy * 900}); }
      emit('p_muzzle', hero.x + hero.w / 2 + Math.cos(ang) * 30, hero.y + 30 + Math.sin(ang) * 30, {life: 90, size: 54, grow: 30, color: '#fff2a8'});
    }
    function nova() { if (cards <= 0 || (state !== 'fight' && state !== 'stage')) return; cards--; snd('magic'); white = .7; shake(canvas); hero.safe = Math.max(hero.safe, 1400); emit('p_flare', hero.x + 20, hero.y + 30, {life: 520, size: 200, grow: 1500, color: '#8fd4f7'}); shots.length = 0; for (const f of foes.slice()) if (f.x > cam - 50 && f.x < cam + W + 50) { boom(f.x + 26, f.y + 26, .6); gain(2, f.x + 26, f.y); foes.splice(foes.indexOf(f), 1); } if (boss) boss.stun = 2600; pop('СУПЕР-УДАР!', hero.x + 20, hero.y - 40, '#8fd4f7', 46); }
    function enter(i) { if (!open(i)) { flash('Эта дверь заперта: сначала победите предыдущего босса.'); snd('bump'); shake(canvas); return; } view = {name: 'run', boss: bosses[i]}; render(); }
    function act() { if (!hero.ground) return false; if (Math.abs(shopX + 50 - hero.x - hero.w / 2) < 60) { state = 'shop'; sel = 0; snd('select'); return true; } const d = doors.find(d => Math.abs(d.x + 50 - hero.x - hero.w / 2) < 56); if (d) { enter(d.i); return true; } return false; }
    function buy() { const [key, name, , price] = SHOP[sel]; if (player.shop[key]) { flash('Это улучшение уже куплено.'); return; } if (player.bits < price) { flash(`Не хватает битов: нужно ${price}, а у тебя ${player.bits}. Биты дают за верные ответы, врагов и монеты.`, 3200); snd('bump'); return; } player.bits -= price; player.shop[key] = true; save(false); snd('coin'); confetti(); flash(`Куплено: ${name}!`, 2400); }
    const requestJump = k => { if (['ArrowUp', ' ', 'z', 'я'].includes(k) && !(k === 'ArrowUp' && (held.c || held['с']))) jumpBuffer = 160; };
    const dash = () => { if (hero.dashCool <= 0 && state !== 'dead' && state !== 'perk' && state !== 'shop') { hero.dash = 190; hero.dashCool = 850; snd('disappear'); puff(hero.x + 20, hero.y + 50, 5); } };
    keys(e => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, ok = k === 'Enter' || k === ' ' || k === 'x' || k === 'ч' || k === 'z' || k === 'я';
      if (k === 'F11' || k === 'f' || k === 'а') { e.preventDefault(); toggleFull(); return; }
      if (state === 'shop') { e.preventDefault(); if (k === 'ArrowUp') sel = (sel + SHOP.length - 1) % SHOP.length; else if (k === 'ArrowDown') sel = (sel + 1) % SHOP.length; else if (ok) buy(); else if (['Escape', 'Backspace', 'ArrowLeft', 'ArrowRight'].includes(k)) state = 'hub'; return; }
      if (k === 'Escape' && level && !document.fullscreenElement) { view = {name: 'run'}; render(); return; }
      if (k === 'Backspace' && level) { e.preventDefault(); view = {name: 'run'}; render(); return; }
      if (talking()) { if (ok) { e.preventDefault(); step(); } return; }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
      if (state === 'perk') { if (k === 'ArrowLeft') sel = Math.max(0, sel - 1); else if (k === 'ArrowRight') sel = Math.min(offer.length - 1, sel + 1); else if (ok && !e.repeat) takePerk(sel); return; }
      if (state === 'dead') { if (k === 'Enter' || k === 'x' || k === 'ч') restart(); return; }
      if (q && ['1', '2', '3'].includes(k) && !e.repeat) { e.preventDefault(); const target = targets.find(t => t.k === Number(k) - 1 && !t.off); if (target) strike(target); return; }
      if (state === 'hub' && (k === 'ArrowUp' || k === 'Enter') && !e.repeat && act()) return;
      if (k === 'Shift') dash(); if ((k === 'v' || k === 'м') && !e.repeat) nova();
      if (!e.repeat && !held[k]) requestJump(k);
      held[k] = true;
    });
    const up = e => { held[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; }; document.addEventListener('keyup', up); cleanup.push(() => document.removeEventListener('keyup', up));
    const releaseControls = () => { for (const k of Object.keys(held)) held[k] = false; jumpBuffer = coyote = 0; };
    window.addEventListener('blur', releaseControls); cleanup.push(() => window.removeEventListener('blur', releaseControls));
    canvas.addEventListener('click', () => { if (talking()) step(); else if (state === 'dead') restart(); else if (state === 'perk') takePerk(sel); });
    const pad = el('div', 't-padkeys'); for (const [label, k] of [['←', 'ArrowLeft'], ['→', 'ArrowRight'], ['Прыжок ↑', 'ArrowUp'], ['Целить вверх', 'w'], ['Огонь', 'x'], ['Рывок', 'dash'], ['Супер', 'nova']]) { const b = el('button', 'g-command', label); b.type = 'button'; b.addEventListener('pointerdown', () => { if (talking()) { step(); return; } if (state === 'perk') { if (k === 'ArrowLeft') sel = Math.max(0, sel - 1); else if (k === 'ArrowRight') sel = Math.min(2, sel + 1); else takePerk(sel); return; } if (state === 'shop') { if (k === 'ArrowUp') sel = (sel + SHOP.length - 1) % SHOP.length; else if (k === 'x') buy(); else state = 'hub'; return; } if (k === 'ArrowUp' && state === 'hub' && act()) return; if (k === 'dash') dash(); else if (k === 'nova') nova(); else { if (!held[k]) requestJump(k); held[k] = true; } if (state === 'dead') restart(); }); for (const n of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(n, () => { held[k] = false; }); pad.append(b); }
    function attack(dt) {
      if (boss.stun > 0) { boss.stun -= dt; return; }
      if (!boss.warning) {
        boss.wait -= dt; if (boss.wait > 0) return;
        const kinds = boss.kind === 'mix' ? ['aim', 'rain', 'wave', 'swarm'] : [boss.kind], kind = kinds[rand(0, kinds.length - 1)], phase = boss.phase;
        const warning = {kind, phase, left: 700, total: 700, angle: Math.atan2(hero.y + 26 - boss.y - boss.h / 2, hero.x - boss.x - 30), marks: [], lanes: []};
        if (kind === 'rain') warning.marks = phase === 2 ? [Math.max(80, Math.min(850, hero.x)), Math.max(80, Math.min(850, hero.x + 200)), Math.max(80, Math.min(850, hero.x - 200))] : [rand(80, 850), rand(80, 850)];
        if (kind === 'wave') warning.lanes = phase === 2 ? [FLOOR - 30, FLOOR - 190] : [FLOOR - 30];
        boss.warning = warning; return;
      }
      boss.warning.left -= dt; if (boss.warning.left > 0) return;
      const {kind, phase, angle, marks, lanes} = boss.warning, fury = 1 + (boss.max - boss.hp) / boss.max * .7, cx = boss.x + 30, cy = boss.y + boss.h / 2; boss.warning = null;
      if (kind === 'rage') { for (let k = -2; k <= 2; k++) shots.push({x: boss.x, y: cy, vx: -330 + Math.abs(k) * 20, vy: k * 80, r: 18, k: 'fire'}); boss.wait = 1200 / fury; }
      else if (kind === 'aim') { for (const off of phase === 2 ? [-.28, 0, .28] : [0]) shots.push({x: cx, y: cy, vx: Math.cos(angle + off) * 300 * fury, vy: Math.sin(angle + off) * 300 * fury, r: 18, k: 'fire'}); boss.wait = 1500 / fury; }
      else if (kind === 'rain') { marks.forEach((x, n) => shots.push({x, y: -40 - n * (phase === 2 ? 180 : 80), vx: 0, vy: 270 * fury, r: 20, k: 'bomb'})); boss.wait = 1150 / fury; }
      else if (kind === 'wave') { lanes.forEach((y, n) => shots.push({x: boss.x + n * 240, y, vx: -360 * fury, vy: 0, r: 28, k: 'saw'})); boss.wait = 1900 / fury; }
      else { const makeBee = (x, vx, y) => foes.push({type: 'bee', x, y, w: 56, h: 56, vx, base: y, hp: 1, hit: 0}); makeBee(boss.x, -180 * fury, 300); if (phase === 2) makeBee(-60, 150 * fury, 420); boss.wait = 1700 / fury; }
      boss.recoil = .5; snd('throw');
    }
    function update(raw) {
      const dt = slow > 0 ? raw * .35 : raw; if (slow > 0) slow -= raw; time += dt; const s = dt / 1000; for (const k of ['safe', 'cool', 'dash', 'dashCool', 'flash']) if (hero[k] > 0) hero[k] -= dt; if (white > 0) white -= s * 1.8;
      for (const p of parts.slice()) { p.x += p.vx * s; p.y += p.vy * s; p.vy += p.g * s; p.rot += p.vr * s; p.life -= dt; if (p.life <= 0) parts.splice(parts.indexOf(p), 1); }
      for (const p of pops.slice()) { p.y -= 46 * s; p.life -= dt; if (p.life <= 0) pops.splice(pops.indexOf(p), 1); } for (const gh of ghosts.slice()) { gh.life -= dt; if (gh.life <= 0) ghosts.splice(ghosts.indexOf(gh), 1); }
      if (boss) { boss.bob += s; if (boss.flash > 0) boss.flash -= dt; if (boss.recoil > 0) boss.recoil -= s * 3; if (boss.dying > 0) { boss.dying -= raw; if (Math.random() < .25) boom(boss.x + rand(20, boss.w - 20), boss.y + rand(20, boss.h - 20), .7 + Math.random() * .5); if (boss.dying <= 0) { boom(boss.x + boss.w / 2, boss.y + boss.h / 2, 2.2); white = .9; snd('disappear'); } } }
      if (['dead', 'intro', 'perk', 'shop'].includes(state)) return;
      const lock = held.c || held['с'], left = held.ArrowLeft || held.a || held['ф'], right = held.ArrowRight || held.d || held['в'], jump = (held.ArrowUp && !lock) || held[' '] || held.z || held['я'], shoot = held.x || held['ч'] || held.k || held['л'] || held.Control, wasGround = hero.ground;
      const want = (right ? 1 : 0) - (left ? 1 : 0); if (want) hero.face = want;
      hero.vx += ((hero.dash > 0 ? hero.face * 820 : lock ? 0 : want * 330) - hero.vx) * Math.min(1, s * 14); hero.walk += Math.abs(hero.vx) * s;
      if (hero.dash > 0 && Math.floor(time / 30) % 2) ghosts.push({x: hero.x, y: hero.y, face: hero.face, life: 220});
      // Remember short taps and presses just before landing; allow a small grace period at ledges.
      coyote = hero.ground ? 120 : Math.max(0, coyote - dt);
      if (held.ArrowDown) coyote = 0;
      const groundJump = hero.ground || coyote > 0;
      if (jumpBuffer > 0 && hero.dash <= 0 && (groundJump || (has('double') && hero.air < 1))) {
        if (!groundJump) { hero.air++; stars(hero.x + 20, hero.y + hero.h, 5, '#8fd4f7'); }
        hero.vy = -900; hero.ground = false; jumpBuffer = coyote = 0; snd('jump'); puff(hero.x + 20, hero.y + hero.h, 4);
      }
      jumpBuffer = Math.max(0, jumpBuffer - dt);
      if (!jump && hero.vy < -300) hero.vy = -300;
      if (hero.dash <= 0) hero.vy = Math.min(hero.vy + 2300 * s, 1050); else hero.vy = 0;
      const wall = gates.find(gt => !gt.open && hero.x < gt.x), maxX = state === 'hub' ? width - 200 : state === 'stage' ? (wall ? wall.x - hero.w : width - 60) : 900;
      hero.x = Math.max(0, Math.min(maxX, hero.x + hero.vx * s)); const prevBottom = hero.y + hero.h, mid = hero.x + hero.w / 2, over = segs.some(([a, b]) => mid > a && mid < b); hero.y += hero.vy * s; hero.ground = false;
      if (over && prevBottom <= FLOOR + 3 && hero.y + hero.h >= FLOOR) { hero.y = FLOOR - hero.h; hero.vy = 0; hero.ground = true; }
      for (const [px, py, pw] of plats) if (hero.vy >= 0 && prevBottom <= py + 3 && hero.y + hero.h >= py && hero.x + hero.w > px && hero.x < px + pw && !held.ArrowDown) { hero.y = py - hero.h; hero.vy = 0; hero.ground = true; }
      if (hero.ground) hero.air = 0; if (hero.ground && !wasGround) puff(hero.x + 20, hero.y + hero.h, 3);
      if (hero.y > H + 80) { hero.x = check; hero.y = FLOOR - hero.h - 4; hero.vx = hero.vy = 0; hero.safe = 0; hurt('Осторожно, яма!'); if (state === 'stage') hero.safe = 1500; }
      if (shoot && state !== 'ready') fire();
      for (const b of bullets.slice()) {
        b.x += b.vx * s; b.y += b.vy * s; let gone = b.x < cam - 30 || b.x > cam + W + 30 || b.y < -30 || b.y > H;
        const t = q && targets.find(t => !t.pop && !t.off && b.x > t.x && b.x < t.x + t.w && b.y > t.y && b.y < t.y + t.h); if (t) { gone = true; strike(t); }
        const f = !gone && foes.find(f => b.x > f.x && b.x < f.x + f.w && b.y > f.y && b.y < f.y + f.h); if (f) { gone = true; f.hp--; f.hit = 120; if (f.hp <= 0) { foes.splice(foes.indexOf(f), 1); boom(f.x + f.w / 2, f.y + f.h / 2, .45); snd('bump'); gain(f.type === 'turret' ? 4 : 2, f.x + f.w / 2, f.y); } else { stars(b.x, b.y, 4, '#fff'); snd('bump'); } }
        const sh = !gone && shots.find(o => o.k === 'fire' && Math.hypot(o.x - b.x, o.y - b.y) < o.r + 8); if (sh) { gone = true; shots.splice(shots.indexOf(sh), 1); stars(b.x, b.y, 6, '#ff8a3d'); }
        if (!gone && gates.some(gt => !gt.open && b.x > gt.x && b.x < gt.x + 70)) { gone = true; stars(b.x, b.y, 4, '#8fd4f7'); }
        if (!gone && boss && boss.hp > 0 && (state === 'fight' || state === 'ready') && b.x > boss.x + 30) { gone = true; emit('p_circle', b.x, b.y, {life: 220, size: 30, grow: 90, color: '#8fd4f7'}); if (!shieldTold && state === 'fight') { shieldTold = true; flash('Пули отскакивают от щита! Босса ранят только верные ответы — стреляйте в блок с ответом.', 3800); } }
        if (gone) bullets.splice(bullets.indexOf(b), 1);
      }
      for (const c of coins.slice()) if (Math.abs(c.x - mid) < 34 && Math.abs(c.y - hero.y - hero.h / 2) < 46) { coins.splice(coins.indexOf(c), 1); gain(1); snd('coin'); stars(c.x, c.y, 3); }
      const enemyS = s * threatRate, enemyDt = dt * threatRate;
      const touch = (ox, oy, ow, oh) => hero.x < ox + ow - 8 && hero.x + hero.w > ox + 8 && hero.y < oy + oh - 8 && hero.y + hero.h > oy + 8;
      for (const o of shots.slice()) { o.x += o.vx * enemyS; o.y += o.vy * enemyS; if (o.k === 'fire' && Math.random() < .5) emit('p_flame', o.x, o.y, {life: 240, size: 34, grow: 8, color: '#ff8a3d', vx: -o.vx * .1, vy: -o.vy * .1}); if (o.k === 'saw' && Math.random() < .5) emit('p_spark', o.x, FLOOR - 4, {life: 220, size: 22, grow: 4, color: '#ffe36a', vx: rand(60, 200), vy: rand(-220, -60), g: 700}); if (o.k === 'bomb' && o.y > FLOOR - o.r) { boom(o.x, FLOOR - 14, .6); snd('bump'); if (Math.abs(o.x - mid) < 64 && hero.y + hero.h > FLOOR - 70) hurt('Бомба взорвалась рядом! Следите за тенями на земле.'); shots.splice(shots.indexOf(o), 1); continue; } if (o.x < cam - 120 || o.y > H + 40 || o.y < -400 || o.x > cam + W + 300) { shots.splice(shots.indexOf(o), 1); continue; } if (Math.abs(o.x - mid) < o.r + hero.w / 2 - 8 && Math.abs(o.y - hero.y - hero.h / 2) < o.r + hero.h / 2 - 8) hurt(o.k === 'saw' ? 'Пилу нужно перепрыгивать!' : o.k === 'bomb' ? 'Следите за бомбами сверху!' : 'Огненный шар! Уворачивайтесь, сбивайте его или делайте рывок.'); }
      for (const f of foes.slice()) {
        if (f.hit > 0) f.hit -= dt; const near = Math.abs(f.x - hero.x) < 900;
        if (f.type === 'bee') { f.x += f.vx * enemyS; f.y = f.base + Math.sin(time / 260 + f.base) * 56; if (f.x < -80) { foes.splice(foes.indexOf(f), 1); continue; } }
        else if (f.type === 'fly') { if (near) { f.x += Math.sign(hero.x - f.x) * 120 * enemyS; f.y += (hero.y - 10 + Math.sin(time / 300 + f.base) * 70 - f.y) * Math.min(1, enemyS * 1.6); } }
        else if (f.type === 'turret') { f.wait -= enemyDt; if (near && f.wait <= 0) { const a = Math.atan2(hero.y + 26 - f.y - 20, hero.x - f.x); shots.push({x: f.x + 20, y: f.y + 20, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280, r: 18, k: 'fire'}); f.wait = 2200; snd('throw'); } }
        else { f.x += f.vx * enemyS; if (f.x < f.a) { f.x = f.a; f.vx = Math.abs(f.vx); } if (f.x + f.w > f.b) { f.x = f.b - f.w; f.vx = -Math.abs(f.vx); } }
        if (touch(f.x, f.y, f.w, f.h)) hurt(f.type === 'bee' ? 'Вирус-пчела! Сбивайте их выстрелами.' : 'Вирус задел тебя. Стреляй по ним издалека!');
      }
      for (const sw of saws) { sw.t += enemyS; sw.y = FLOOR - 150 - Math.sin(sw.t * 1.7) * 110; if (touch(sw.x - 34, sw.y - 34, 68, 68)) hurt('Пила! Проскочи, когда она уйдёт вверх.'); }
      if (state === 'stage') {
        const gt = gates.find(gt => !gt.open && hero.x > gt.zone); if (pauseQ > 0) pauseQ -= dt; if (gt && !q && pauseQ <= 0) nextQuestion(gt.zone, gt); if (!gt && q) { q = null; targets.length = 0; answerPad.hidden = true; }
        if (hero.x > exitX && hero.ground) toPerk();
      }
      if (q && has('fifty') && !q.fifty && time - q.born > 5000 && targets.length > 2) { q.fifty = true; const t = targets.find(t => t.k !== q.correct); t.off = true; puff(t.x + 39, t.y + 39, 6, '#59606a'); flash('Подсказка: один неверный блок погас.', 1800); }
      for (const t of targets) if (t.pop > 0) t.pop -= dt;
      if (boss && state === 'fight') { attack(dt * threatRate); if (pauseQ > 0) { pauseQ -= dt; if (pauseQ <= 0 && boss.hp > 0) nextQuestion(); } if (hero.x + hero.w > boss.x + 40) { hero.x = boss.x + 40 - hero.w; hurt('Не подходите к боссу вплотную!'); } }
      cam = state === 'hub' || state === 'stage' ? Math.max(0, Math.min(width - W, hero.x - W * .38)) : 0;
      const d = doors.find(d => Math.abs(d.x + 50 - mid) < 56), atShop = state === 'hub' && Math.abs(shopX + 50 - mid) < 60;
      hint = time < noteUntil ? note : atShop ? `Мастерская Бита: улучшения за биты. У тебя ${player.bits}. Нажмите ↑, чтобы войти.` : d ? `${open(d.i) ? 'Босс' : 'Заперто: босс'} ${d.i + 1} — «${d.b.title}», тема: ${d.b.topic}.${beaten(d.b) ? ' Побеждён ' + starText(rec(d.b).stars) + '.' : ''}${open(d.i) ? ' Нажмите ↑, чтобы войти.' : ''}` : state === 'fight' ? 'Три ответа: 1, 2 или 3, кнопка или выстрел в блок. Пока думаете, отбивайте снаряды бластером.' : state === 'stage' ? (q ? 'Ворота знаний: попадите в блок с верным ответом. W — стрелять вверх.' : 'Прорывайтесь вправо: стреляйте по вирусам, собирайте биты, перепрыгивайте ямы.') : state === 'hub' ? 'Бегите к двери босса. ↑ — прыжок и вход, X — огонь, Shift — рывок, F11 — во весь экран, M — отметка.' : '';
    }
    const sp = (name, x, y, w, h, flip) => { const im = pic(name); if (!im.complete || !im.naturalWidth) return; if (flip) { g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(im, 0, 0, w, h); g.restore(); } else g.drawImage(im, x, y, w, h); };
    const shadow = (x, w, k = 1) => { g.fillStyle = `rgba(20,30,50,${.22 * k})`; g.beginPath(); g.ellipse(x, FLOOR + 6, w / 2, 9, 0, 0, 7); g.fill(); };
    function label(text, x, y, size, color = '#fff', align = 'center', stroke = '#1d2433') { g.font = `${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = Math.max(4, size / 5); g.strokeStyle = stroke; g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y); }
    function wrap(text, width, size) { g.font = `${size}px ${FONT}`; const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { const next = cur ? cur + ' ' + w : w; if (g.measureText(next).width > width && cur) { lines.push(cur); cur = w; } else cur = next; } if (cur) lines.push(cur); return lines; }
    function board(x, y, w, h, fill = '#fff8e7', edge = '#2b3350') { g.fillStyle = 'rgba(20,30,50,.28)'; g.beginPath(); g.roundRect(x + 4, y + 7, w, h, 18); g.fill(); g.fillStyle = fill; g.strokeStyle = edge; g.lineWidth = 5; g.beginPath(); g.roundRect(x, y, w, h, 18); g.fill(); g.stroke(); }
    const NONE = 'rgba(0,0,0,0)';
    function draw() {
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, THEME[1]); sky.addColorStop(.8, THEME[2]); g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.globalAlpha = .9; g.fillStyle = '#fff6c9'; g.beginPath(); g.arc(1080 - cam * .03, 130, 54, 0, 7); g.fill(); g.globalAlpha = .25; g.beginPath(); g.arc(1080 - cam * .03, 130, 82, 0, 7); g.fill(); g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,.78)'; for (let k = 0; k < 6; k++) { const cx = ((k * 310 + 90 - cam * .08 - time / 55) % (W + 360) + W + 360) % (W + 360) - 180, cy = 96 + (k * 67) % 150, r = 34 + (k * 13) % 22; g.beginPath(); g.ellipse(cx, cy, r * 2.1, r * .72, 0, 0, 7); g.ellipse(cx - r * .9, cy - r * .35, r * .95, r * .62, 0, 0, 7); g.ellipse(cx + r * .7, cy - r * .5, r * 1.15, r * .78, 0, 0, 7); g.fill(); }
      // Continuous scenery leaves the sky visible: opaque image tiles used to cover it with white rectangles.
      const hillColors = {hills: ['#a8dec5', '#2ecc71'], trees: ['#a1d5c0', '#2cc987'], desert: ['#ffe0c2', '#f3c7a5'], mushrooms: ['#e7b3bb', '#de7e4f']}[THEME[0]];
      // Нарисованный фон темы (tools/art4); копии через одну отражены, чтобы не было шва. Пока не загрузился — прежние холмы.
      const bgp = pic('bgp_' + THEME[0]); if (bgp.complete && bgp.naturalWidth) { const bh = FLOOR + 30, bw = bh * 3, sh0 = cam * .22; for (let k = Math.floor(sh0 / bw); k * bw - sh0 < W; k++) { const x = k * bw - sh0; g.save(); if (k % 2) { g.translate(x + bw, 0); g.scale(-1, 1); g.drawImage(bgp, 0, 0, bw + 1, bh); } else g.drawImage(bgp, x, 0, bw + 1, bh); g.restore(); } } else
      for (const [layer, par, base, height] of [[0, .18, FLOOR - 175, 42], [1, .45, FLOOR - 100, 32]]) {
        g.fillStyle = hillColors[layer]; g.beginPath(); g.moveTo(0, FLOOR + 44);
        for (let x = 0; x <= W + 8; x += 8) g.lineTo(x, base + Math.sin((x + cam * par) * Math.PI * 2 / 600) * height);
        g.lineTo(W, FLOOR + 44); g.closePath(); g.fill();
      }
      g.save(); g.translate(-Math.round(cam), 0);
      for (const p of props) if (p.x > cam - 100 && p.x < cam + W + 20) sp(p.name, p.x, FLOOR - p.s + 4, p.s, p.s);
      const ground = level ? 'terrain_stone_block' : 'terrain_grass_block'; for (let x = Math.floor(cam / 64) * 64; x < cam + W + 64; x += 64) { if (!segs.some(([a, b]) => x + 32 > a && x + 32 < b)) continue; sp(ground + '_top', x, FLOOR, 64, 64); sp(ground + '_center', x, FLOOR + 64, 64, 64); sp(ground + '_center', x, FLOOR + 128, 64, 64); }
      for (const [px, py, pw] of plats) { if (px > cam + W || px + pw < cam) continue; g.fillStyle = 'rgba(20,30,50,.16)'; g.beginPath(); g.ellipse(px + pw / 2, FLOOR + 6, pw / 2.4, 8, 0, 0, 7); g.fill(); sp('terrain_stone_cloud_left', px, py, 64, 64); sp('terrain_stone_cloud_middle', px + 64, py, 64, 64); sp('terrain_stone_cloud_right', px + 128, py, 64, 64); }
      if (state === 'hub' || state === 'shop') { const sx = shopX; sp('door_open_top', sx, FLOOR - 200, 100, 100); sp('door_open', sx, FLOOR - 100, 100, 100); sp('sign', sx - 70, FLOOR - 66, 66, 66); g.font = `17px ${FONT}`; const tw = g.measureText('Мастерская Бита').width + 26; board(sx + 50 - tw / 2, FLOOR - 252, tw, 34, '#d6f5e6'); label('Мастерская Бита', sx + 50, FLOOR - 234, 17, '#2b3350', 'center', NONE); sp('coin_gold', sx + 28, FLOOR - 300 + Math.sin(time / 300) * 5, 44, 44); }
      for (const d of doors) {
        const ok = open(d.i), done = beaten(d.b), cx = d.x + 50; sp(Math.floor(time / 180 + d.i) % 2 ? 'torch_on_a' : 'torch_on_b', d.x - 44, FLOOR - 150, 48, 48); g.globalCompositeOperation = 'lighter'; const glow = tinted('p_light', '#ffb347'); if (glow) { g.globalAlpha = .5 + Math.sin(time / 130 + d.i) * .12; g.drawImage(glow, d.x - 80, FLOOR - 190, 120, 120); g.globalAlpha = 1; } g.globalCompositeOperation = 'source-over';
        sp(ok ? 'door_open_top' : 'door_closed_top', d.x, FLOOR - 200, 100, 100); sp(ok ? 'door_open' : 'door_closed', d.x, FLOOR - 100, 100, 100); if (!ok) sp('lock_red', d.x + 26, FLOOR - 96, 48, 48);
        const bobY = FLOOR - 300 + Math.sin(time / 400 + d.i) * 6; g.globalAlpha = ok ? 1 : .4; sp('big_' + d.b.sprite[Math.floor(time / 300) % 2], cx - 44, bobY, 88, 88); g.globalAlpha = 1;
        const name = d.b.title; g.font = `17px ${FONT}`; const tw = g.measureText(name).width + 26; board(cx - tw / 2, FLOOR - 352, tw, 34, done ? '#ffe9a3' : '#fff8e7'); label(name, cx, FLOOR - 334, 17, '#2b3350', 'center', NONE); if (done) label(starText(rec(d.b).stars), cx, FLOOR - 216, 20, '#ffe36a'); else if (ok) label(String(d.i + 1), cx, FLOOR - 52, 34, '#fff');
      }
      for (const gt of gates) { if (gt.x > cam + W + 80 || gt.x < cam - 200) continue; if (!gt.open) { for (let y = FLOOR - 64; y > -64; y -= 64) sp('bricks_brown', gt.x, y, 64, 64); sp('lock_red', gt.x + 4, FLOOR - 230, 56, 56); g.globalCompositeOperation = 'lighter'; const gl = tinted('p_light', '#ff6b5e'); if (gl) { g.globalAlpha = .5 + Math.sin(time / 200) * .2; g.drawImage(gl, gt.x - 70, FLOOR - 310, 200, 200); g.globalAlpha = 1; } g.globalCompositeOperation = 'source-over'; } else sp(Math.floor(time / 250) % 2 ? 'flag_red_a' : 'flag_red_a', gt.x + 110, FLOOR - 64, 64, 64); }
      if (state === 'stage') { sp('door_open_top', exitX + 60, FLOOR - 200, 100, 100); sp('door_open', exitX + 60, FLOOR - 100, 100, 100); g.font = `17px ${FONT}`; const tw = g.measureText('К боссу').width + 26; board(exitX + 110 - tw / 2, FLOOR - 252, tw, 34, '#ffe9a3'); label('К боссу', exitX + 110, FLOOR - 234, 17, '#2b3350', 'center', NONE); }
      for (const c of coins) if (c.x > cam - 40 && c.x < cam + W + 40) sp('coin_gold', c.x - 20, c.y - 20 + Math.sin(time / 260 + c.x) * 4, 40, 40);
      for (const sw of saws) { g.fillStyle = '#59606a'; g.fillRect(sw.x - 4, FLOOR - 270, 8, 270); sp(Math.floor(time / 70) % 2 ? 'saw_a' : 'saw_b', sw.x - 36, (sw.y ?? FLOOR - 150) - 36, 72, 72); }
      if (boss && (boss.hp > 0 || boss.dying > 0) && ['intro', 'ready', 'fight', 'dead', 'won'].includes(state)) {
        const by = boss.y + Math.sin(boss.bob * 2) * 16, phase = 1 - boss.hp / boss.max, sq = 1 + Math.sin(boss.bob * 5) * .035, bx = boss.x + Math.max(0, boss.recoil) * 26, frame = 'big_' + level.sprite[Math.floor(time / 260) % 2], bw = boss.w * (2 - sq), bh = boss.h * sq; shadow(boss.x + boss.w / 2, boss.w * .8, 1.2);
        g.globalCompositeOperation = 'lighter'; const aura = tinted('p_flare', phase > .6 ? '#ff5a3d' : phase > .3 ? '#ffb347' : '#8fd4f7'); if (aura) { g.globalAlpha = .55 + Math.sin(time / 200) * .15; g.drawImage(aura, bx - 90, by - 90, boss.w + 180, boss.h + 180); g.globalAlpha = 1; } g.globalCompositeOperation = 'source-over';
        sp(frame, bx + (boss.w - bw) / 2, by + (boss.h - bh), bw, bh); if (phase > .3) { const red = tinted(frame, '#ff2a1a'); if (red) { g.globalAlpha = phase > .6 ? .34 : .18; g.drawImage(red, bx + (boss.w - bw) / 2, by + (boss.h - bh), bw, bh); g.globalAlpha = 1; } }
        if (boss.flash > 0 && Math.floor(time / 55) % 2) { const wh = tinted(frame, '#ffffff'); if (wh) g.drawImage(wh, bx + (boss.w - bw) / 2, by + (boss.h - bh), bw, bh); }
        if (boss.stun > 0) label('✦ оглушён ✦', bx + boss.w / 2, by - 20, 22, '#8fd4f7');
        if (state === 'fight' || state === 'ready') { g.strokeStyle = 'rgba(143,212,247,.75)'; g.lineWidth = 5; g.setLineDash([18, 12]); g.lineDashOffset = -time / 30; g.beginPath(); g.arc(bx + boss.w / 2, by + boss.h / 2, boss.w * .62, 0, 7); g.stroke(); g.setLineDash([]); }
      }
      if (boss?.warning && state === 'fight') {
        const w = boss.warning, pulse = .55 + Math.sin(time / 65) * .2; g.save(); g.strokeStyle = `rgba(230,72,61,${pulse})`; g.fillStyle = `rgba(230,72,61,${pulse * .3})`; g.lineWidth = 5; g.setLineDash([14, 10]);
        if (w.kind === 'rage') for (let k = -2; k <= 2; k++) { const angle = Math.atan2(k * 80, -330 + Math.abs(k) * 20); g.beginPath(); g.moveTo(boss.x, boss.y + boss.h / 2); g.lineTo(boss.x + Math.cos(angle) * 1400, boss.y + boss.h / 2 + Math.sin(angle) * 1400); g.stroke(); }
        if (w.kind === 'aim') for (const off of w.phase === 2 ? [-.28, 0, .28] : [0]) { g.beginPath(); g.moveTo(boss.x + 30, boss.y + boss.h / 2); g.lineTo(boss.x + 30 + Math.cos(w.angle + off) * 1400, boss.y + boss.h / 2 + Math.sin(w.angle + off) * 1400); g.stroke(); }
        if (w.kind === 'rain') for (const x of w.marks) { g.beginPath(); g.ellipse(x, FLOOR + 4, 44, 12, 0, 0, 7); g.fill(); g.stroke(); label('!', x, FLOOR - 26, 30, '#e2483d'); }
        if (w.kind === 'wave') for (const y of w.lanes) { g.beginPath(); g.moveTo(0, y); g.lineTo(boss.x, y); g.stroke(); }
        if (w.kind === 'swarm') { label('← РОЙ', boss.x - 50, 290, 24, '#e2483d'); if (w.phase === 2) label('РОЙ →', 90, 410, 24, '#e2483d'); }
        g.setLineDash([]); g.beginPath(); g.arc(boss.x + boss.w / 2, boss.y + boss.h / 2, boss.w * .65, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (1 - w.left / w.total)); g.stroke(); g.restore();
      }
      for (const o of shots) if (o.k === 'bomb') { g.fillStyle = 'rgba(200,40,30,.35)'; g.beginPath(); g.ellipse(o.x, FLOOR + 6, 30 + (FLOOR - o.y) * .03, 8, 0, 0, 7); g.fill(); }
      for (const t of targets) {
        const ty = t.y + Math.sin(time / 300 + t.x) * 6, a = t.off ? .28 : t.pop > 0 ? t.pop / 400 : Math.min(1, (time - (q ? q.born : time)) / 250); g.globalAlpha = a; if (!t.off) { g.globalCompositeOperation = 'lighter'; const glow = tinted('p_light', '#ffe36a'); if (glow) g.drawImage(glow, t.x - 46, ty - 46, t.w + 92, t.h + 92); g.globalCompositeOperation = 'source-over'; }
        sp(t.off ? 'block_empty' : 'block_exclamation', t.x, ty, t.w, t.h); const text = t.label.length > 20 ? t.label.slice(0, 19) + '…' : t.label, size = text.length > 12 ? 17 : text.length > 7 ? 21 : 25; g.font = `${size}px ${FONT}`; const w = Math.max(g.measureText(text).width + 64, 110); board(t.x + t.w / 2 - w / 2, ty + t.h + 10, w, 42); g.fillStyle = '#e2483d'; g.beginPath(); g.arc(t.x + t.w / 2 - w / 2 + 24, ty + t.h + 31, 15, 0, 7); g.fill(); label('АБВ'[t.k], t.x + t.w / 2 - w / 2 + 24, ty + t.h + 32, 17, '#fff', 'center', NONE); label(text, t.x + t.w / 2 + 16, ty + t.h + 32, size, '#2b3350', 'center', NONE); g.globalAlpha = 1;
      }
      for (const o of shots) { if (o.k === 'saw') sp(Math.floor(time / 70) % 2 ? 'saw_a' : 'saw_b', o.x - 34, o.y - 34, 68, 68); else sp(o.k === 'bomb' ? 'bomb' : 'fireball', o.x - 26, o.y - 26, 52, 52); }
      for (const f of foes) { if (f.x > cam + W + 80 || f.x < cam - 120) continue; const fr = Math.floor(time / 130) % 2, name = f.type === 'bee' ? (fr ? 'bee_a' : 'bee_b') : f.type === 'fly' ? (fr ? 'fly_a' : 'fly_b') : f.type === 'bug' ? (fr ? 'ladybug_walk_a' : 'ladybug_walk_b') : f.type === 'turret' ? (fr ? 'slime_fire_walk_a' : 'slime_fire_walk_b') : (fr ? 'slime_normal_walk_a' : 'slime_normal_walk_b'), flip = f.type === 'turret' ? hero.x > f.x : f.vx > 0; shadow(f.x + f.w / 2, f.w * .8, .6); sp(name, f.x, f.y, f.w, f.h, flip); if (f.hit > 0) { const wh = tinted(name, '#ffffff'); if (wh) { g.globalAlpha = .8; g.drawImage(wh, f.x, f.y, f.w, f.h); g.globalAlpha = 1; } } }
      for (const gh of ghosts) { g.globalAlpha = gh.life / 500; sp('character_green_jump', gh.x - 26, gh.y - 22, 92, 92, gh.face < 0); } g.globalAlpha = 1;
      if (state !== 'perk') { shadow(hero.x + hero.w / 2, 46 - Math.min(26, Math.max(0, FLOOR - hero.y - hero.h) * .12));
        if (!(hero.safe > 0 && Math.floor(time / 90) % 2)) { const frame = 'character_green_' + (state === 'dead' ? 'hit' : hero.flash > 0 ? 'hit' : !hero.ground ? 'jump' : held.ArrowDown ? 'duck' : Math.abs(hero.vx) > 40 ? (Math.floor(hero.walk / 28) % 2 ? 'walk_a' : 'walk_b') : 'idle'); sp(frame, hero.x - 26, hero.y - 22, 92, 92, hero.face < 0); }
        if (hero.shield > 0) { g.strokeStyle = 'rgba(143,212,247,.9)'; g.lineWidth = 4; g.beginPath(); g.arc(hero.x + 20, hero.y + 30, 52, 0, 7); g.stroke(); } }
      for (const b of bullets) { g.globalCompositeOperation = 'lighter'; const gl = tinted('p_light', '#ffd23f'); if (gl) g.drawImage(gl, b.x - 26, b.y - 26, 52, 52); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff7c2'; g.strokeStyle = '#e08a00'; g.lineWidth = 3; g.beginPath(); g.arc(b.x, b.y, 8, 0, 7); g.fill(); g.stroke(); }
      for (const p of parts) { const im = tinted(p.name, p.color); if (!im) continue; const k = 1 - p.life / p.max, size = p.a + (p.b - p.a) * k; g.globalAlpha = Math.max(0, (1 - k) * p.alpha); g.globalCompositeOperation = p.add ? 'lighter' : 'source-over'; g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.drawImage(im, -size / 2, -size / 2, size, size); g.restore(); } g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      for (const p of pops) { g.globalAlpha = Math.min(1, p.life / 400); const k = Math.min(1, (1100 - p.life) / 140); label(p.text, p.x, p.y, p.size * (.6 + k * .4), p.color); } g.globalAlpha = 1;
      g.restore();
      const vg = g.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .95); vg.addColorStop(0, 'rgba(10,20,40,0)'); vg.addColorStop(1, 'rgba(10,20,40,.38)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      const hearts = state === 'hub' || state === 'shop' ? maxHearts() : Math.max(hero.hearts, 0), all = maxHearts(); for (let k = 0; k < all; k++) { const lost = k >= hearts, b = !lost && hearts === 1 ? 1 + Math.sin(time / 120) * .08 : 1; sp(lost ? 'hud_heart_empty' : 'hud_heart', 22 + k * 52 - (b - 1) * 24, 14 - (b - 1) * 24, 48 * b, 48 * b); }
      sp('coin_gold', 24, 70, 34, 34); label(String(player.bits), 66, 88, 22, '#ffe36a', 'left'); for (let k = 0; k < 3; k++) { g.fillStyle = k < cards ? '#8fd4f7' : 'rgba(20,30,50,.45)'; g.strokeStyle = '#11162a'; g.lineWidth = 3; g.beginPath(); g.roundRect(140 + k * 30, 74, 22, 30, 5); g.fill(); g.stroke(); } if (cards) label('V', 240, 90, 16, '#8fd4f7', 'left');
      if (perks.size) label([...perks].map(k => PERKS.find(p => p[0] === k)[1]).join(' · '), 24, 126, 15, '#b6ff6a', 'left');
      if (hero.dashCool > 0) { g.fillStyle = 'rgba(20,30,50,.5)'; g.beginPath(); g.roundRect(24, 142, 150, 8, 4); g.fill(); g.fillStyle = '#8fd4f7'; g.beginPath(); g.roundRect(24, 142, 150 * (1 - hero.dashCool / 850), 8, 4); g.fill(); }
      if (boss && ['ready', 'fight', 'dead', 'won'].includes(state)) { const bw = 430, bx = W - bw - 24; board(bx, 16, bw, 44, '#2b3350', '#11162a'); g.fillStyle = '#e2483d'; g.beginPath(); g.roundRect(bx + 8, 24, (bw - 16) * Math.max(0, boss.hp) / boss.max, 28, 10); g.fill(); g.strokeStyle = '#11162a'; g.lineWidth = 3; for (let k = 1; k < boss.max; k++) { g.beginPath(); g.moveTo(bx + 8 + (bw - 16) * k / boss.max, 24); g.lineTo(bx + 8 + (bw - 16) * k / boss.max, 52); g.stroke(); } label(level.title.toUpperCase() + ' · ФАЗА ' + boss.phase, bx + bw / 2, 39, 17, '#fff'); }
      else if (state === 'stage') { const bw = 430, bx = W - bw - 24, k = Math.min(1, hero.x / exitX); board(bx, 16, bw, 34, '#2b3350', '#11162a'); g.fillStyle = '#5fe0b5'; g.beginPath(); g.roundRect(bx + 8, 23, Math.max(10, (bw - 16) * k), 20, 8); g.fill(); label('ПУТЬ К БОССУ', bx + bw / 2, 34, 15, '#fff'); }
      if (q && (state === 'fight' || state === 'stage')) { const lines = wrap(q.text, W - 420, 26).slice(0, 3), h = 46 + lines.length * 33, k = Math.min(1, (time - q.born) / 220), bx = 270, bw = W - 540 + 140; g.save(); g.translate(0, -(1 - k) * 60); g.globalAlpha = k; board(bx, 72, bw, h); label(q.gate ? 'ВОРОТА ЗНАНИЙ' : `ВОПРОС БОССА · УДАР ${boss.max - boss.hp + 1} ИЗ ${boss.max}`, bx + 22, 94, 15, '#b3541e', 'left', NONE); lines.forEach((t, n) => label(t, bx + bw / 2, 126 + n * 33, 26, '#2b3350', 'center', NONE)); g.restore(); g.globalAlpha = 1; }
      if (hint && !talking() && !['dead', 'perk', 'shop'].includes(state)) { const lines = wrap(hint, W - 220, 19).slice(0, 2), h = 22 + lines.length * 26; g.fillStyle = 'rgba(17,22,42,.82)'; g.beginPath(); g.roundRect(90, H - h - 12, W - 180, h, 14); g.fill(); lines.forEach((t, n) => label(t, W / 2, H - h + 12 + n * 26, 19, time < noteUntil ? '#ffe36a' : '#fff', 'center', NONE)); }
      if (state === 'perk') { g.fillStyle = 'rgba(17,22,42,.72)'; g.fillRect(0, 0, W, H); label('ВЫБЕРИ УСИЛЕНИЕ НА БОЙ', W / 2, 120, 44, '#ffe36a'); offer.forEach((p, k) => { const x = W / 2 - 500 + k * 345, on = k === sel, y = 210 - (on ? 14 : 0); board(x, y, 310, 330, on ? '#fff8e7' : '#d9d3c4', on ? '#e2483d' : '#2b3350'); const tint = {shield: ['p_circle', '#3fa9e0'], spread: ['p_star', '#ff8a3d']}[p[0]]; if (tint) { const im = tinted(tint[0], tint[1]); if (im) g.drawImage(im, x + 95, y + 20, 120, 120); } else sp(({heart: 'hud_heart', fifty: 'block_exclamation', rapid: 'fireball', double: 'character_green_jump'})[p[0]], x + 105, y + 30, 100, 100); label(p[1], x + 155, y + 170, 26, '#2b3350', 'center', NONE); wrap(p[2], 270, 18).forEach((t, n) => label(t, x + 155, y + 215 + n * 26, 18, '#59606a', 'center', NONE)); }); label('← → — выбрать, Enter или X — взять', W / 2, 610, 22, '#fff'); }
      if (state === 'shop') { g.fillStyle = 'rgba(17,22,42,.72)'; g.fillRect(0, 0, W, H); board(240, 90, 800, 540, '#fff8e7'); label('МАСТЕРСКАЯ БИТА', W / 2, 140, 38, '#2b3350', 'center', NONE); sp('coin_gold', 820, 120, 38, 38); label(String(player.bits), 866, 141, 26, '#b3541e', 'left', NONE); SHOP.forEach((it, k) => { const y = 190 + k * 96, on = k === sel, own = player.shop[it[0]]; board(280, y, 720, 80, own ? '#d6f5e6' : on ? '#ffe9a3' : '#fff', on ? '#e2483d' : '#2b3350'); label(it[1], 306, y + 28, 24, '#2b3350', 'left', NONE); label(it[2], 306, y + 58, 16, '#59606a', 'left', NONE); label(own ? 'куплено' : it[3] + ' битов', 974, y + 40, 22, own ? '#2e8672' : player.bits >= it[3] ? '#b3541e' : '#9aa0aa', 'right', NONE); }); label('↑ ↓ — выбрать, Enter или X — купить, Esc — выйти', W / 2, 596, 19, '#59606a', 'center', NONE); if (time < noteUntil) label(note, W / 2, 660, 20, '#ffe36a'); }
      if (banner) { const t = time - banner.born, k = Math.min(1, t / 220), out = banner.hold ? 1 : Math.max(0, 1 - Math.max(0, t - 800) / 220); g.globalAlpha = out; g.fillStyle = 'rgba(17,22,42,.55)'; g.fillRect(0, H / 2 - 80, W, 160); label(banner.text, W / 2, H / 2, 96 * (1.6 - k * .6), banner.color); if (state === 'dead') label('Enter или X — попробовать ещё раз', W / 2, H / 2 + 76, 24, '#fff'); g.globalAlpha = 1; if (out <= 0) banner = null; }
      if (talking()) { const lines = wrap(line, W - 330, 24), h = Math.max(120, 50 + lines.length * 32); board(60, H - h - 28, W - 120, h, '#173c3a', '#0a1830'); g.fillStyle = '#5fe0b5'; g.beginPath(); g.roundRect(92, H - h + 4, 78, 62, 16); g.fill(); g.fillRect(104, H - h + 70, 54, 22); g.fillStyle = '#fff'; g.beginPath(); g.arc(116, H - h + 34, 11, 0, 7); g.arc(146, H - h + 34, 11, 0, 7); g.fill(); g.fillStyle = '#173c3a'; g.beginPath(); g.arc(116, H - h + 34, 5, 0, 7); g.arc(146, H - h + 34, 5, 0, 7); g.fill(); g.fillStyle = '#f1cf5b'; g.beginPath(); g.arc(131, H - h - 4, 7, 0, 7); g.fill(); label('БИТ', 131, H - h + 108, 15, '#5fe0b5', 'center', NONE); lines.forEach((t, n) => label(t, 200, H - h + 6 + n * 32, 24, '#fff', 'left', NONE)); label('Enter ↵', W - 130, H - 52, 18, Math.floor(performance.now() / 400) % 2 ? '#f1cf5b' : '#b9a246', 'center', NONE); }
      if (white > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(1, white)})`; g.fillRect(0, 0, W, H); }
    }
    const frame = el('div', 't-frame'), full = button('⛶ Во весь экран (F11)', 'g-small', toggleFull); full.dataset.act = 'full'; frame.append(canvas, answerPad, errorPanel); pad.prepend(full);
    panel.append(el('h2', 'g-mission-title', level ? `Босс ${bosses.indexOf(level) + 1}: ${level.title} — ${level.topic}` : 'Кодоград · улица боссов'), frame, pad, keyHint('← → — бежать, ↑ или Z — прыжок, X — огонь (можно держать), W или C + ↑ — стрелять вверх, C — стоять и целиться, Shift — рывок, V — супер-удар, ↓ — спрыгнуть с платформы, F11 или F — во весь экран, Backspace — выйти на улицу, M — отметка, 1, 2 или 3 — ответ на вопрос.'));
    if (!level) {
      const settings = el('fieldset', 't-difficulty'); settings.append(el('legend', '', 'Настройте игру'));
      for (const [name, title, options] of [['questions', 'Вопросы', [['simple', 'Простые'], ['standard', 'Обычные']]], ['combat', 'Бой', [['calm', 'Спокойный'], ['normal', 'Обычный']]]]) {
        const label = el('label', '', title), select = el('select'); select.dataset.difficulty = name;
        for (const [value, text] of options) { const option = el('option', '', text); option.value = value; select.append(option); }
        select.value = name === 'questions' ? questionMode : combatMode;
        select.addEventListener('change', () => { player.difficulty[name] = select.value; save(false); render(); }); label.append(select); settings.append(label);
      }
      settings.append(el('small', '', 'Спокойный бой: враги и снаряды медленнее. Герой и бластер сохраняют скорость. Настройки меняются на улице и запоминаются.')); panel.prepend(settings);
    } else panel.append(el('p', 'g-note t-difficulty-current', `Вопросы: ${questionMode === 'simple' ? 'простые' : 'обычные'} · Бой: ${combatMode === 'calm' ? 'спокойный' : 'обычный'}. Настройки — на улице (Backspace).`));
    panel.append(review);
    root.append(panel); decorate();
    if (level) { if (player.seen['stage-' + level.id]) { arena(); toPerk(); } else { buildStage(); hero.hearts = maxHearts(); say([`Впереди владения босса «${level.title}». Прорвись через них: стреляй по вирусам, собирай биты и перепрыгивай ямы.`, 'Дорогу дважды перекроют ворота знаний. Они открываются только верным ответом — стреляй в нужный блок. За верные ответы копится супер-удар (клавиша V).']); } }
    else if (!player.seen.run) { player.seen.run = true; save(false); say([`Привет, ${player.name.split(' ').pop()}! Я Бит. Вирус Глюк захватил Кодоград и расставил по городу своих боссов.`, 'Босса защищает щит. Отбивай его снаряды бластером и выбирай верный ответ: 1, 2 или 3, кнопка либо выстрел в блок.', 'Управление как в Cuphead: стрелки — бежать, ↑ или Z — прыжок, X — огонь, Shift — рывок, V — супер-удар. Чтобы стрелять вверх, держи W или зажми C и ↑. F11 — во весь экран.', 'За верные ответы, врагов и монеты ты получаешь биты. Трать их в моей мастерской — она в начале улицы. Удачи!']); }
    draw();
    const stop = ticker(dt => { for (let k = 0; k < 2; k++) update(talking() ? 0 : dt / 2); draw(); }); cleanup.push(stop, () => save(false));
    if (location.hostname === '127.0.0.1') window.School4Run = {hero, held, boss, targets, doors, shots, foes, bullets, perks, q: () => q, state: () => state, talking, enter, fire, restart, nova, FLOOR, stage: () => ({gates, exitX, width, coins: coins.length, segs, check}), toPerk, takePerk, shop: () => player.shop, bits: v => (v === undefined ? player.bits : (player.bits = v)), cards: v => (v === undefined ? cards : (cards = v)), ui: () => ({line, hint, note, banner: banner?.text || '', question: q?.text || '', questionMode, combatMode, threatRate, mistakes: mistakes.slice(), sel, offer: offer.map(p => p[0])})};
  }
  async function renderTeacher() {
    const panel = el('section', 'g-mission t-teacher'), body = el('div'), my = token;
    panel.append(button('← Назад', 'g-small', () => { view = {name: player ? home() : 'login'}; render(); }), el('h2', '', 'Панель учителя'), body); root.append(panel);
    if (!remote) { body.append(el('p', '', 'Серверная часть тренажёра не подключена или недоступна. Тренажёр работает в локальном режиме: прогресс хранится в браузере ученика, отметки приходят в журнал отдельными записями.')); return; }
    let info;
    try { info = await call('overview?slug=' + data.slug); } catch (error) { body.append(el('p', 't-error', 'Не удалось загрузить данные: ' + error.message)); return; }
    if (my !== token) return;
    classes.roster = info.roster; classes.assignment = info.assignment;
    let current = classNames().includes(view.className) ? view.className : classNames()[0];
    const reload = () => { view = {name: 'teacher', className: current}; render(); };
    const post = (path, payload, done) => call(path, {slug: data.slug, className: current, ...payload}).then(() => { School4Sections.toast(done); reload(); }, error => School4Sections.toast('Не сохранено: ' + error.message));
    function draw() {
      body.replaceChildren();
      const tabs = el('div', 'g-actions');
      for (const c of classNames()) { const b = button(c, c === current ? 'g-primary' : 'g-small', () => { current = c; draw(); }); b.setAttribute('aria-pressed', String(c === current)); b.dataset.tab = c; tabs.append(b); }
      body.append(tabs, el('h3', '', 'Задание на урок'));
      const pick = el('select', 't-assign'), none = el('option', '', '— не задано —'); none.value = ''; pick.append(none);
      for (const w of data.worlds) { const o = el('option', '', w.title); o.value = w.id; pick.append(o); }
      pick.value = info.assignment[current] || ''; pick.setAttribute('aria-label', 'Мир на сегодняшний урок');
      pick.addEventListener('change', () => post('assignment', {worldId: pick.value}, pick.value ? 'Задание на урок сохранено' : 'Задание снято'));
      body.append(pick, el('p', 'g-note', 'Выбранный мир будет стоять первым и с пометкой «Задание на урок» у всех учеников этого класса.'), el('h3', '', 'Успеваемость'));
      const listed = info.roster[current] || [], rows = new Map(listed.map(n => [norm(n), {name: n, levels: {}, sent: {}, updated: ''}]));
      for (const s of info.students) if (s.className === current) rows.set(norm(s.name), s);
      if (!rows.size) body.append(el('p', '', 'В этом классе пока никто не играл, список класса не загружен.'));
      else {
        const table = el('table', 'g-table t-overview'), head = el('tr'); head.append(el('th', '', 'Ученик'));
        for (const w of data.worlds) head.append(el('th', '', w.title)); head.append(el('th', '', 'Последняя игра'), el('th', '', '')); table.append(head);
        for (const s of [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'))) {
          const tr = el('tr'); tr.append(el('th', '', s.name));
          for (const w of data.worlds) {
            const got = worldStars(w, s.levels), passed = w.levels.filter(l => s.levels[l.id]).length, sent = s.sent[w.id], td = el('td');
            if (!passed) td.textContent = '—';
            else { td.append(el('strong', '', `★ ${got}/${3 * w.levels.length} · «${worldMark(w, s.levels)}»`), el('span', '', passed < w.levels.length ? `остановился на уровне ${passed + 1}` : 'мир пройден'), el('span', sent ? 't-sent' : '', sent ? `в журнале: «${sent.mark}»` + (sent.stars < got ? ' (есть лучше)' : '') : 'не отправлено')); td.title = w.levels.map((l, i) => `${i + 1}. ${l.title}: ${s.levels[l.id] ? starText(s.levels[l.id].stars) : '—'}`).join('\n'); }
            tr.append(td);
          }
          const wipe = button('Сбросить', 'g-small', () => { if (confirm(`Удалить игровой прогресс ученика «${s.name}» в этом тренажёре? Записи в журнале останутся.`)) post('reset', {name: s.name}, 'Прогресс удалён'); }); wipe.disabled = !s.updated;
          const last = el('td', '', s.updated || '—'), cell = el('td'); cell.append(wipe); tr.append(last, cell); table.append(tr);
        }
        const wrap = el('div', 'g-table-wrap'); wrap.append(table); body.append(wrap, el('p', 'g-note', 'Наведите курсор на ячейку, чтобы увидеть звёзды по уровням.'));
      }
      body.append(el('h3', '', 'Список класса'));
      const area = el('textarea', 't-roster'); area.rows = Math.max(6, listed.length + 1); area.value = listed.join('\n'); area.placeholder = 'Иванов Пётр\nПетрова Анна'; area.setAttribute('aria-label', 'Список класса, по одному ученику в строке');
      const keep = button('Сохранить список', 'g-primary', () => post('roster', {names: area.value.split('\n').map(n => n.trim()).filter(Boolean)}, 'Список класса сохранён')); keep.dataset.act = 'roster';
      body.append(area, keep, el('p', 'g-note', 'По одному ученику в строке: фамилия и имя. Когда список загружен, ученики этого класса выбирают себя из списка и не могут ввести другое имя. Пустой список возвращает ввод с клавиатуры. Список один на класс для всех тренажёров и виден только компьютерам школьной сети.'));
    }
    draw();
  }

  if (location.hostname === '127.0.0.1') window.School4TrainerDebug = () => debugAnswer && debugAnswer();
  let wasTeacher = false;
  document.addEventListener('school4:context', () => { if (teacher() !== wasTeacher) { wasTeacher = teacher(); if (view.name === 'map' || view.name === 'login') render(); } });
  (async () => {
    root.replaceChildren(el('p', '', 'Загружаем тренажёр…'));
    if (demo) remote = false; else try { classes = await call('classes?slug=' + data.slug, null, 3500); remote = true; } catch { remote = false; }
    try {
      const s = JSON.parse(sessionStorage.getItem(sessionKey));
      if (s && store.profiles[s.key] && Date.now() - s.stamp < SESSION_MS) { player = store.profiles[s.key]; view = {name: home()}; }
    } catch {}
    // Внутри практикума ученик уже назвал себя: берём его имя оттуда, сменить его здесь нельзя.
    if (LOCK) { const key = LOCK.className + '|' + norm(LOCK.name); player = store.profiles[key] || (store.profiles[key] = {key, name: LOCK.name, className: LOCK.className, levels: {}, sent: {}}); view = {name: home()}; }
    if (player && remote) try { await pull(); } catch (problem) { if (problem.status === 403) { player = null; view = {name: 'login'}; } }
    wasTeacher = teacher(); render();
  })();
})();
