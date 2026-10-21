// «Байт-бласт»: головоломка в духе Block Blast. Поле 8×8, по три фигуры за раз; заполненный ряд или столбец исчезает.
// Информатика: на поле стоят «приёмники» с числами. Фигура с кодом (например, 1101₂) может накрыть только приёмник
// с тем же числом — пока приёмник пуст, его ряд и столбец не очистить. Системы счисления зависят от класса.
// Логика (check/solve) не трогает страницу: проверяется в node — tools/lab/tests/blast.test.js.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const N = 8;
  const SHAPES = [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1]], [[1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [0, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [2, 0], [0, 1]], [[1, 0], [1, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [1, 1], [2, 1]]];
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const SUB = {2: '₂', 8: '₈', 10: '', 16: '₁₆'};
  const fmt = (v, b) => v.toString(b).toUpperCase() + SUB[b];
  // Уровни: цели (ряды, совпадения), запас фигур, в каких системах записаны метки и приёмники.
  const PLAN = [
    ['Разминка', {lines: 2, matches: 0}, 0], ['Двоичные метки', {lines: 0, matches: 2}, 1], ['Ряды и метки', {lines: 2, matches: 2}, 1],
    ['Быстрые руки', {lines: 2, matches: 3}, 1], ['Новая система', {lines: 1, matches: 3}, 2], ['Цех кодов', {lines: 3, matches: 3}, 3],
    ['Смешанный поток', {lines: 3, matches: 4}, 4], ['Наоборот', {lines: 2, matches: 4}, 5], ['Комбо', {lines: 5, matches: 3}, 4], ['Финал', {lines: 5, matches: 5}, 4]];
  function levels(grade) {
    const max = grade <= 6 ? 15 : grade === 7 ? 31 : grade === 8 ? 63 : grade === 9 ? 127 : 255;
    const sys = mode => mode === 0 ? [] : mode === 1 ? [2] : mode === 2 ? (grade >= 8 ? [8] : [2]) : mode === 3 ? (grade >= 9 ? [16] : grade >= 8 ? [8] : [2]) : (grade >= 9 ? [2, 8, 16] : grade >= 8 ? [2, 8] : [2]);
    return PLAN.map(([title, goals, mode], i) => ({title, goals, mode, max, labels: sys(mode), reverse: mode === 5, seed: 1000 * grade + 37 * (i + 1), limit: 24 + 6 * i,
      brief: mode === 0 ? `Ставь фигуры на поле. Заполни ${goals.lines} ряда или столбца — они исчезнут.` :
        `Фигура с кодом накрывает только приёмник с тем же числом. ${mode === 5 ? 'Приёмники записаны в двоичной системе, а коды фигур — в десятичной. ' : ''}Цель: ${goals.matches} совпадений${goals.lines ? ` и ${goals.lines} очищенных линий` : ''}.`}));
  }
  // ---------- модель игры ----------
  function start(lv) {
    const r = rng(lv.seed), st = {r, lv, board: Array.from({length: N}, () => Array(N).fill(0)), targets: [], batch: [], used: 0, lines: 0, matches: 0, wrong: 0, score: 0, combo: 0, over: false};
    if (lv.labels.length) for (let k = 0; k < 3; k++) spawnTarget(st);
    deal(st); return st;
  }
  function spawnTarget(st) {
    const free = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!st.board[y][x] && !st.targets.some(t => t.x === x && t.y === y)) free.push([x, y]);
    if (!free.length) return; const [x, y] = free[Math.floor(st.r() * free.length)];
    let v; do { v = 1 + Math.floor(st.r() * st.lv.max); } while (st.targets.some(t => t.v === v));
    st.targets.push({x, y, v});
  }
  function deal(st) {
    st.batch = [];
    for (let k = 0; k < 3; k++) {
      // Первая фигура тройки — небольшая и с кодом одного из приёмников: подходящий ход есть всегда.
      const sure = k === 0 && st.lv.labels.length && st.targets.length;
      const shape = sure ? SHAPES[Math.floor(st.r() * 5)] : SHAPES[Math.floor(st.r() * SHAPES.length)], color = Math.floor(st.r() * 6); let code = null;
      // Примерно каждая вторая фигура — с кодом; чаще всего он подходит к одному из приёмников.
      if (st.lv.labels.length && st.targets.length && (k === 0 || st.r() < 0.4)) {
        const v = sure || st.r() < 0.7 ? st.targets[Math.floor(st.r() * st.targets.length)].v : 1 + Math.floor(st.r() * st.lv.max), b = st.lv.labels[Math.floor(st.r() * st.lv.labels.length)];
        code = {v, text: st.lv.reverse ? String(v) : fmt(v, b)};
      }
      st.batch.push({shape, color, code, used: false});
    }
  }
  const targetText = (lv, t) => lv.reverse ? fmt(t.v, 2) : String(t.v);
  function legal(st, p, x, y) {
    for (const [dx, dy] of p.shape) { const cx = x + dx, cy = y + dy; if (cx < 0 || cy < 0 || cx >= N || cy >= N || st.board[cy][cx]) return false;
      const t = st.targets.find(t => t.x === cx && t.y === cy); if (t && (!p.code || p.code.v !== t.v)) return false; }
    return true;
  }
  function place(st, i, x, y) {
    const p = st.batch[i]; if (!p || p.used || !legal(st, p, x, y)) return null;
    p.used = true; st.used++; const ev = {cells: [], cleared: [], matched: []};
    for (const [dx, dy] of p.shape) { st.board[y + dy][x + dx] = p.color + 1; ev.cells.push([x + dx, y + dy]);
      const ti = st.targets.findIndex(t => t.x === x + dx && t.y === y + dy); if (ti >= 0) { ev.matched.push(st.targets[ti]); st.targets.splice(ti, 1); st.matches++; } }
    const rows = [], cols = [];
    for (let k = 0; k < N; k++) { if (st.board[k].every(c => c)) rows.push(k); if (st.board.every(row => row[k])) cols.push(k); }
    for (const k of rows) for (let x2 = 0; x2 < N; x2++) ev.cleared.push([x2, k]);
    for (const k of cols) for (let y2 = 0; y2 < N; y2++) ev.cleared.push([k, y2]);
    for (const [cx, cy] of ev.cleared) st.board[cy][cx] = 0;
    const n = rows.length + cols.length; st.lines += n; st.combo = n ? st.combo + 1 : 0;
    st.score += p.shape.length + n * 10 * Math.max(1, st.combo) + ev.matched.length * 25;
    for (let k = 0; k < ev.matched.length; k++) spawnTarget(st);
    if (st.batch.every(q => q.used)) deal(st);
    st.over = !st.batch.some(q => !q.used && anyPlace(st, q));
    return ev;
  }
  function anyPlace(st, p) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (legal(st, p, x, y)) return true; return false; }
  const won = st => st.lines >= st.lv.goals.lines && st.matches >= st.lv.goals.matches;
  function check(lv, moves) {
    if (!Array.isArray(moves)) return {ok: false, msg: 'Нет ходов.'};
    const st = start(lv);
    for (const m of moves) {
      if (won(st)) break;
      if (!m || !place(st, m.p, m.x, m.y)) return {ok: false, msg: 'Фигуру так поставить нельзя.'};
      if (st.used >= lv.limit && !won(st)) return {ok: false, msg: 'Фигуры закончились, а цель не достигнута.'};
      if (st.over && !won(st)) return {ok: false, msg: 'Поставить больше некуда.'};
    }
    if (!won(st)) return {ok: false, msg: `Цель не достигнута: линий ${st.lines} из ${lv.goals.lines}, совпадений ${st.matches} из ${lv.goals.matches}.`};
    const k = st.used / lv.limit;
    return {ok: true, stars: k <= 0.75 ? 3 : k <= 0.9 ? 2 : 1, used: st.used, msg: `Готово за ${st.used} фигур из ${lv.limit}.`};
  }
  // Образцовое решение: перебор порядка фигур в тройке и жадный выбор места (совпадения, линии, меньше дыр).
  function clone(st) { return {...st, board: st.board.map(r => r.slice()), targets: st.targets.map(t => ({...t})), batch: st.batch.map(p => ({...p})), r: st.r}; }
  function value(st) {
    let holes = 0; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!st.board[y][x]) { let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= N || b >= N || st.board[b][a]) n++; } if (n >= 3) holes++; }
    let filled = 0, near = 0; for (const row of st.board) filled += row.filter(Boolean).length;
    for (let k = 0; k < N; k++) { const r = st.board[k].filter(Boolean).length, c = st.board.filter(row => row[k]).length; if (r >= 6) near += r; if (c >= 6) near += c; }
    const g = st.lv.goals;
    return Math.min(st.matches, g.matches) * 900 + Math.min(st.lines, g.lines) * 900 + st.lines * 260 + st.matches * 60 - holes * 40 - filled * 14 + near * 6;
  }
  function solve(lv) {
    // Несколько попыток с небольшим «шумом» в оценке ходов: берём первую, что проходит на три звезды.
    let last = [];
    for (let attempt = 0; attempt < 8; attempt++) { last = greedy(lv, attempt); const r = check(lv, last); if (r.ok && r.stars === 3) return last; }
    return last;
  }
  function greedy(lv, attempt) {
    // У генератора свой поток случайности: чтобы перебор не сбивал его, проигрываем ход заново от начала.
    const moves = [], noise = rng(7919 * (attempt + 1));
    for (let guard = 0; guard < lv.limit; guard++) {
      const st = start(lv); for (const m of moves) place(st, m.p, m.x, m.y);
      if (won(st) || st.over) break;
      let best = null;
      st.batch.forEach((p, i) => { if (p.used) return; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (legal(st, p, x, y)) {
        const s2 = start(lv); for (const m of moves) place(s2, m.p, m.x, m.y); place(s2, i, x, y);
        const v = value(s2) + (s2.over && !won(s2) ? -1e6 : 0) + (won(s2) ? 1e7 : 0) + (attempt ? noise() * 120 : 0); if (!best || v > best.v) best = {v, m: {p: i, x, y}}; } });
      if (!best) break; moves.push(best.m);
    }
    return moves;
  }
  // ---------- страница ----------
  function style() {
    if (typeof document === 'undefined' || document.getElementById('bb-style')) return;
    const s = document.createElement('style'); s.id = 'bb-style';
    s.textContent = `.bb-wrap{display:grid;grid-template-columns:max-content 280px;gap:18px;align-items:start;justify-content:center}.bb-board{display:grid;grid-template-columns:repeat(8,58px);gap:4px;width:max-content;padding:10px;border-radius:16px;background:rgba(10,14,34,.82);box-shadow:0 0 0 2px #3b4d78,0 18px 40px rgba(0,0,0,.45);touch-action:none}
.bb-cell{position:relative;width:58px;height:58px;border-radius:9px;background:rgba(255,255,255,.06);background-size:cover}.bb-cell.f{box-shadow:0 2px 0 rgba(0,0,0,.35)}.bb-cell.ghost{outline:3px solid rgba(125,249,255,.85);background-color:rgba(125,249,255,.2)}.bb-cell.bad{outline:3px solid rgba(255,90,90,.85)}
.bb-cell.clear{animation:bb-pop .35s}.bb-cell.match{animation:bb-match .5s}@keyframes bb-pop{0%{transform:scale(1.1);filter:brightness(2.4)}100%{transform:scale(.2);opacity:0}}@keyframes bb-match{50%{transform:scale(1.25);filter:brightness(1.8)}}
.bb-t{position:absolute;inset:4px;display:grid;place-items:center;border-radius:8px;border:2px dashed #ffd34d;color:#ffd34d;font:800 14px ui-monospace,monospace;background:rgba(255,211,77,.12);text-align:center;line-height:1}
.bb-tray{display:grid;gap:12px}.bb-piece{display:grid;justify-items:center;gap:6px;padding:10px;border-radius:14px;border:2px solid #3b4d78;background:#141e38;cursor:pointer;min-height:96px}.bb-piece.on{border-color:#7df9ff;box-shadow:0 0 0 3px rgba(125,249,255,.3)}.bb-piece.used{visibility:hidden}
.bb-mini{display:grid;gap:3px}.bb-mini i{width:22px;height:22px;border-radius:5px;background-size:cover}.bb-code{padding:3px 10px;border-radius:999px;background:#ffd34d;color:#1b2333;font:800 15px ui-monospace,monospace}
.bb-hud{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}.bb-hud span{padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.08);font-weight:800}.bb-help{font:700 13px ui-monospace,monospace;color:#c3cee2;background:#141e38;border-radius:12px;padding:8px 10px}
@media(max-width:860px){.bb-wrap{grid-template-columns:1fr}.bb-board{grid-template-columns:repeat(8,minmax(28px,10vw))}.bb-cell{width:auto;height:auto;aspect-ratio:1}.bb-tray{grid-template-columns:repeat(3,1fr)}}`;
    document.head.append(s);
  }
  function mount(host, lv, api) {
    style(); const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'), hud = el('div', 'bb-hud'), wrap = el('div', 'bb-wrap'), board = el('div', 'bb-board'), tray = el('div', 'bb-tray');
    let st = start(lv), sel = -1, hover = null, moves = [], fails = 0, done = false;
    const tile = c => `url(art/blast_block_${(c - 1) % 6}.webp?v=1)`;
    task.append(el('h2', '', lv.title), el('p', '', lv.brief));
    const cells = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = el('div', 'bb-cell'); c.dataset.x = x; c.dataset.y = y;
      c.addEventListener('pointerenter', () => { hover = [x, y]; draw(); }); c.addEventListener('click', () => put(x, y)); cells.push(c); board.append(c); }
    board.addEventListener('pointerleave', () => { hover = null; draw(); });
    const help = el('div', 'bb-help'); help.textContent = lv.labels.includes(16) ? 'A=10 B=11 C=12 D=13 E=14 F=15 · разряды ₁₆: 16 1' : lv.labels.includes(8) ? 'разряды ₈: 64 8 1' : 'разряды ₂: 128 64 32 16 8 4 2 1';
    function put(x, y) {
      if (done || sel < 0) return; const p = st.batch[sel]; const ax = x - Math.min(...p.shape.map(c => c[0])), ay = y - Math.min(...p.shape.map(c => c[1]));
      if (!legal(st, p, ax, ay)) { const t = p.shape.map(([dx, dy]) => st.targets.find(t => t.x === ax + dx && t.y === ay + dy)).find(Boolean);
        msg.textContent = t ? (p.code ? `Не то число: ${p.code.text} ≠ ${targetText(lv, t)}.` : 'Приёмник принимает только фигуру с подходящим кодом.') : 'Сюда не помещается.'; msg.className = 'lab-msg bad'; if (t && p.code) fails++; return; }
      const ev = place(st, sel, ax, ay); moves.push({p: sel, x: ax, y: ay}); sel = st.batch.findIndex(q => !q.used);
      draw(); for (const [cx, cy] of ev.cleared) cells[cy * N + cx].classList.add('clear'); for (const t of ev.matched) cells[t.y * N + t.x].classList.add('match');
      if (ev.matched.length) { msg.textContent = 'Совпало! ' + ev.matched.map(t => targetText(lv, t)).join(', '); msg.className = 'lab-msg good'; }
      else if (ev.cleared.length) { msg.textContent = st.combo > 1 ? `Комбо ×${st.combo}!` : 'Линия очищена!'; msg.className = 'lab-msg good'; }
      setTimeout(() => cells.forEach(c => c.classList.remove('clear', 'match')), 420); finishIf();
    }
    function finishIf() {
      if (won(st)) { done = true; const r = check(lv, moves); api.finish(Math.max(1, (r.stars || 1) - (fails > 2 ? 1 : 0)), r.msg); return; }
      if (st.over || st.used >= lv.limit) { done = true; msg.textContent = st.over ? 'Ходов больше нет — попробуй ещё раз.' : 'Фигуры закончились — попробуй ещё раз.'; msg.className = 'lab-msg bad'; const again = button('Заново', 'lab-main', () => { st = start(lv); moves = []; done = false; sel = 0; again.remove(); draw(); }); again.dataset.act = 'retry'; tray.append(again); }
    }
    function draw() {
      const ghost = new Set(); let ok = false;
      if (hover && sel >= 0 && !st.batch[sel].used) { const p = st.batch[sel], ax = hover[0] - Math.min(...p.shape.map(c => c[0])), ay = hover[1] - Math.min(...p.shape.map(c => c[1])); ok = legal(st, p, ax, ay); for (const [dx, dy] of p.shape) ghost.add((ay + dy) * N + ax + dx); }
      cells.forEach((c, i) => { const x = i % N, y = Math.floor(i / N), v = st.board[y][x], t = st.targets.find(t => t.x === x && t.y === y); c.className = 'bb-cell' + (v ? ' f' : '') + (ghost.has(i) ? (ok ? ' ghost' : ' bad') : '');
        c.style.backgroundImage = v ? tile(v) : ''; c.replaceChildren(); if (t) { const b = el('span', 'bb-t', targetText(lv, t)); c.append(b); } });
      tray.replaceChildren(); st.batch.forEach((p, i) => { const b = button('', 'bb-piece' + (i === sel ? ' on' : '') + (p.used ? ' used' : ''), () => { sel = i; draw(); }); b.dataset.piece = i;
        const w = Math.max(...p.shape.map(c => c[0])) + 1, h = Math.max(...p.shape.map(c => c[1])) + 1, m = el('div', 'bb-mini'); m.style.gridTemplateColumns = `repeat(${w},22px)`;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = el('i'); if (p.shape.some(c => c[0] === x && c[1] === y)) q.style.backgroundImage = tile(p.color + 1); else q.style.visibility = 'hidden'; m.append(q); }
        b.append(m); if (p.code) b.append(el('span', 'bb-code', p.code.text)); tray.append(b); });
      if (lv.labels.length) tray.append(help);
      hud.replaceChildren(...[`Линии ${st.lines}/${lv.goals.lines}`, `Совпадения ${st.matches}/${lv.goals.matches}`, `Фигур ${lv.limit - st.used}`, `Очки ${st.score}`].map(t => el('span', '', t)));
    }
    sel = 0; wrap.append(board, tray); host.append(task, hud, wrap, msg); draw();
    if (api.debugHost) window.labSet = ms => { st = start(lv); moves = []; for (const m of ms) { if (won(st)) break; place(st, m.p, m.x, m.y); moves.push(m); } draw(); finishIf(); };
    return () => { if (api.debugHost) delete window.labSet; };
  }
  LAB.register({id: 'blast', bg: 'bg_blast', title: 'Байт-бласт', genre: 'головоломка · системы счисления', art: '🧩', color: '#ff7ad9', unit: 'Уровень', minutes: 35,
    about: 'Как Block Blast: ставь фигуры, очищай ряды и столбцы. Фигуры с кодами накрывают только приёмники с тем же числом — переводи между двоичной, восьмеричной и шестнадцатеричной системами на скорость.',
    levels, mount, check, solve, lib: {start, place, legal, fmt, levels}});
})();
