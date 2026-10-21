// «Кодоблокс»: игра в духе Roblox. Обби — платформер с лавой, монетами и контрольными точками-вопросами
// (и «стеклянный мост»: наступай только на плиту с верным ответом). Студия — строй мост и лестницу программой
// на Python (place(x, y)), герой сам идёт вправо. За монеты — новый облик героя (магазин на странице уровней).
// Логика студии и итогов проверяется в node: tools/lab/tests/blocks.test.js.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const PY = () => globalThis.CodeHero || (typeof require === 'function' ? require('../../codehero/core.js') : null);
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const H = 10;                       // высота карты в клетках; y = 0 — нижний ряд
  // Карта: сетка cells[y][x] (y снизу вверх): '#' земля, 'W' доски, 'L' лава, 'X' преграда до верного ответа, 'Q' точка-вопрос, 'F' финиш, 'o' монета.
  function grid(w) { return Array.from({length: H}, () => Array(w).fill('.')); }
  const fill = (g, x0, x1, y0, y1, c) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) g[y][x] = c; };
  // ---------- карты обби ----------
  function obbyMap(n) {
    if (n === 1) { const g = grid(40); fill(g, 0, 5, 0, 0, '#'); for (const [x, y, l] of [[8, 2, 3], [13, 3, 3], [18, 2, 2], [22, 4, 3], [27, 3, 3]]) { fill(g, x, x + l - 1, y, y, 'W'); g[y + 1][x + 1] = 'o'; } fill(g, 31, 39, 0, 0, '#'); g[1][37] = 'F'; return {g, start: [1, 1], glass: []}; }
    if (n === 3 || n === 7) { const g = grid(44); fill(g, 0, 43, 0, 0, '#');
      const lava = n === 3 ? [[6, 9], [16, 20], [29, 32]] : [[5, 9], [14, 19], [23, 27], [32, 37]]; for (const [a, b] of lava) fill(g, a, b, 0, 0, 'L');
      const plat = n === 3 ? [[7, 2, 2], [17, 2, 1], [19, 3, 1], [30, 2, 2]] : [[6, 2, 1], [8, 3, 1], [15, 2, 1], [17, 3, 2], [24, 2, 1], [26, 3, 1], [33, 2, 1], [35, 3, 2]];
      for (const [x, y, l] of plat) { fill(g, x, x + l - 1, y, y, 'W'); g[y + 1][x] = 'o'; }
      const qs = n === 3 ? [12, 25] : [11, 21, 29]; for (const q of qs) { g[1][q] = 'Q'; fill(g, q + 1, q + 1, 1, 5, 'X'); }
      g[1][41] = 'F'; return {g, start: [1, 1], glass: []}; }
    // 5 — стеклянный мост: в каждой паре плит держит только та, на которой верный ответ.
    const g = grid(40); fill(g, 0, 6, 0, 1, '#'); fill(g, 28, 39, 0, 1, '#'); g[2][36] = 'F';   // площадки на клетку выше: до верхней плиты можно допрыгнуть
    return {g, start: [1, 2], glass: [9, 13, 17, 21, 25].map(x => ({x, low: 1, high: 3}))};
  }
  // ---------- карты студии ----------
  function studioMap(n) {
    const g = grid(24);
    if (n === 2) { fill(g, 0, 5, 0, 0, '#'); fill(g, 12, 23, 0, 0, '#'); g[1][20] = 'F'; return {g, start: [1, 1], zone: [6, 11], par: 6, hint: 'Пропасть с 6 по 11 столбец. place(x, 0) ставит блок в нижний ряд.', ref: 'for x in range(6, 12):\n    place(x, 0)'}; }
    if (n === 4) { fill(g, 0, 4, 0, 0, '#'); fill(g, 5, 9, 0, 0, '#'); fill(g, 10, 23, 0, 5, '#'); g[6][20] = 'F';
      return {g, start: [1, 1], zone: [5, 9], par: 15, hint: 'Стена высотой 6. Герой поднимается на 1 блок за шаг. Построй лестницу из столбиков.', ref: 'for x in range(5, 10):\n    for y in range(1, x - 3):\n        place(x, y)'}; }
    if (n === 6) { fill(g, 0, 3, 0, 1, '#'); fill(g, 4, 15, 0, 0, 'L'); for (const x of [6, 9, 12, 15]) g[1][x] = '#'; fill(g, 16, 23, 0, 1, '#'); g[2][21] = 'F';
      return {g, start: [1, 2], zone: [4, 15], par: 8, hint: 'Над лавой — мост в ряду y = 1. Но там уже стоят колонны (x = 6, 9, 12, 15): ставить блок в занятую клетку нельзя — пригодится if.', ref: 'for x in range(4, 16):\n    if x % 3 != 0:\n        place(x, 1)'}; }
    fill(g, 0, 3, 0, 0, '#'); fill(g, 9, 12, 0, 0, '#'); fill(g, 13, 23, 0, 3, '#'); g[4][20] = 'F';
    return {g, start: [1, 1], zone: [4, 12], par: 9, hint: 'Сначала мост через пропасть (столбцы 4–8), потом ступени на платформу высотой 4. Блоков как можно меньше!', ref: 'for x in range(4, 9):\n    place(x, 0)\nfor x in range(9, 13):\n    place(x, x - 8)'};
  }
  const solidC = c => c === '#' || c === 'W' || c === 'B';
  // Строим блоки из программы ученика.
  function build(code, m) {
    const Hh = PY(); if (!Hh) throw new Error('интерпретатор Python не загрузился');
    const g = m.g.map(r => r.slice()), placed = [];
    const env = {place: {builtin: 'place', call: args => { const [x, y] = args;
      if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Hh.PyError('place(x, y): координаты — целые числа.');
      if (x < m.zone[0] || x > m.zone[1] || y < 0 || y >= H) throw new Hh.PyError(`Строить можно только в столбцах ${m.zone[0]}–${m.zone[1]} и рядах 0–${H - 1}: (${x}, ${y}) вне зоны.`);
      if (g[y][x] !== '.') throw new Hh.PyError(`Клетка (${x}, ${y}) уже занята.`);
      if (placed.length >= 60) throw new Hh.PyError('Слишком много блоков (больше 60).');
      g[y][x] = 'B'; placed.push([x, y]); return null; }}};
    const it = Hh.run(Hh.parse(String(code)), env, {ops: 40000}); for (const _ of it) {}
    return {g, placed};
  }
  // Герой идёт вправо: шаг на соседнюю клетку, подъём на 1 блок, падение; лава и пропасть — конец.
  function walk(g, start) {
    let [x, y] = start; const path = [[x, y]], w = g[0].length;
    for (let steps = 0; steps < 200; steps++) {
      if (g[y] && g[y][x] === 'F') return {ok: true, path};
      const nx = x + 1; if (nx >= w) return {ok: false, path, why: 'дошёл до края без финиша'};
      if (solidC(g[y][nx])) { if (y + 1 < H && !solidC(g[y + 1][nx]) && !solidC(g[y + 1][x])) { x = nx; y++; } else return {ok: false, path, why: `упёрся в стену у столбца ${nx}`}; }
      else x = nx;
      while (y > 0 && !solidC(g[y - 1][x])) { if (g[y - 1][x] === 'L') return {ok: false, path, why: 'упал в лаву'}; y--; }
      if (y === 0 && !solidC(g[0][x]) && g[0][x] !== 'F') return {ok: false, path, why: 'упал в пропасть'};
      if (y > 0 && g[y - 1][x] === 'L') return {ok: false, path, why: 'наступил на лаву'};
      path.push([x, y]);
    }
    return {ok: false, path, why: 'слишком долго идёт'};
  }
  const PLAN = [['Первые прыжки', 'obby', 1], ['Мост через пропасть', 'studio', 2], ['Лава и вопросы', 'obby', 3], ['Лестница', 'studio', 4],
    ['Стеклянный мост', 'obby', 5], ['Мост над лавой', 'studio', 6], ['Огненная полоса', 'obby', 7], ['Финальная стройка', 'studio', 8]];
  function levels(grade) {
    return PLAN.map(([title, kind, n], i) => ({title, kind, n, seed: grade * 101 + i, grade,
      brief: kind === 'obby' ? (n === 5 ? 'Стеклянный мост: на каждой паре плит — два ответа. Держит только плита с верным. ← → бег, пробел — прыжок.' : `Доберись до флага. Лава — опасно! ${n > 1 ? 'Золотой блок с вопросом откроет проход дальше.' : ''} ← → бег, пробел — прыжок.`)
        : 'Студия: построй путь программой. place(x, y) ставит блок в столбец x, ряд y (снизу вверх, от 0). Герой сам идёт вправо и поднимается на 1 блок за шаг.'}));
  }
  function check(lv, ans) {
    if (lv.kind === 'studio') {
      if (!ans || typeof ans.code !== 'string' || !ans.code.trim()) return {ok: false, msg: 'Напиши программу.'};
      const m = studioMap(lv.n); let b; try { b = build(ans.code, m); } catch (e) { return {ok: false, msg: (e.line ? `строка ${e.line}: ` : '') + e.message}; }
      const w = walk(b.g, m.start); if (!w.ok) return {ok: false, msg: `Герой ${w.why}.`, path: w.path, placed: b.placed};
      const n = b.placed.length; return {ok: true, stars: n <= m.par ? 3 : n <= m.par + 4 ? 2 : 1, blocks: n, path: w.path, placed: b.placed, msg: `Герой дошёл! Блоков: ${n} (рекорд — ${m.par}).`};
    }
    if (!ans || ans.reached !== true || !Number.isFinite(ans.deaths) || !Number.isFinite(ans.wrong)) return {ok: false, msg: 'Флаг не взят.'};
    const k = ans.deaths + ans.wrong; return {ok: true, stars: k === 0 ? 3 : k <= 2 ? 2 : 1, msg: `Флаг взят! Падений: ${ans.deaths}, неверных ответов: ${ans.wrong}.`};
  }
  const solve = lv => lv.kind === 'studio' ? {code: studioMap(lv.n).ref} : {reached: true, deaths: 0, wrong: 0, coins: 5};
  // Вопрос: берём генератор «Код-раннера», если он есть на странице.
  function ask(r, grade, two) {
    const run = LAB.games.find(g => g.id === 'runner'), kinds = grade >= 8 ? ['bin2dec', 'units', 'pow2', 'logic', 'hex'] : ['bin2dec', 'units', 'pow2', 'logic'];
    const q = run ? run.lib.question(kinds[Math.floor(r() * kinds.length)], r, grade) : {q: '1 байт = ? бит', opts: ['8', '4', '16'], right: 0};
    if (!two) return q; const wrong = q.opts.filter((o, i) => i !== q.right)[0]; return r() < 0.5 ? {q: q.q, opts: [q.opts[q.right], wrong], right: 0} : {q: q.q, opts: [wrong, q.opts[q.right]], right: 1};
  }
  // ---------- монеты и облик (хранятся в браузере) ----------
  const STORE = grade => 'school4-blox:v1:' + grade;
  const load = grade => { try { return JSON.parse(localStorage.getItem(STORE(grade)) || '{}'); } catch { return {}; } };
  const keep = (grade, d) => { try { localStorage.setItem(STORE(grade), JSON.stringify(d)); } catch {} };
  const AV = ['Рыцарь', 'Космонавт', 'Ниндзя', 'Робот', 'Исследователь', 'Пират', 'Волшебник', 'Скейтер'], COST = [0, 0, 10, 20, 30, 45, 60, 80];
  function style() {
    if (typeof document === 'undefined' || document.getElementById('bx-style')) return;
    const s = document.createElement('style'); s.id = 'bx-style';
    s.textContent = `.bx-cv{display:block;width:100%;max-width:960px;margin:0 auto;border-radius:16px;box-shadow:0 0 0 2px #3b4d78,0 18px 40px rgba(0,0,0,.45);background:#7cc4ff;touch-action:none}
.bx-q{position:absolute;inset:auto 0 0 0;margin:auto;max-width:620px;top:20%;height:max-content;display:grid;gap:10px;padding:18px;border-radius:18px;background:rgba(14,20,44,.96);border:3px solid #ffd34d;text-align:center}.bx-q b{font-size:24px}.bx-q div{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.bx-q button{padding:12px 18px;border-radius:12px;border:2px solid #4b5f8f;background:#243253;color:#fff;font:800 18px system-ui;cursor:pointer}.bx-wrap{position:relative}.bx-pad{display:none;gap:8px;justify-content:center;margin-top:8px}.bx-pad button{width:70px;height:54px;border-radius:14px;border:2px solid #3b4d78;background:#141e38;color:#fff;font-size:22px}
@media(pointer:coarse){.bx-pad{display:flex}}.bx-shop{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin:14px 0}.bx-av{display:grid;justify-items:center;gap:4px;padding:8px;border-radius:14px;border:2px solid #3b4d78;background:#141e38;color:#fff;cursor:pointer;font:700 13px system-ui}
.bx-av img{width:72px;height:72px;object-fit:contain}.bx-av.on{border-color:#ffd34d}.bx-av.lock{opacity:.5}.bx-studio{display:grid;grid-template-columns:1fr 360px;gap:12px}.bx-studio textarea{width:100%;min-height:180px;font:15px ui-monospace,monospace;background:#0b1024;color:#e8eefb;border:2px solid #3b4d78;border-radius:12px;padding:10px;box-sizing:border-box}
@media(max-width:900px){.bx-studio{grid-template-columns:1fr}}`;
    document.head.append(s);
  }
  function extra({el, button, grade}) {
    style(); const box = el('div'), d = load(grade); d.coins = d.coins || 0; d.av = d.av || 0; d.own = d.own || [0, 1];
    const draw = () => { box.replaceChildren(el('h3', '', `Магазин облика · монет: ${d.coins}`)); const g = el('div', 'bx-shop');
      AV.forEach((n, i) => { const own = d.own.includes(i), b = button('', 'bx-av' + (d.av === i ? ' on' : '') + (own ? '' : ' lock'), () => { if (!own) { if (d.coins < COST[i]) return; d.coins -= COST[i]; d.own.push(i); } d.av = i; keep(grade, d); draw(); });
        const im = el('img'); im.src = `art/blox_av_${i}.webp?v=1`; im.alt = n; b.dataset.av = i; b.append(im, el('span', '', n), el('small', '', own ? (d.av === i ? 'выбран' : 'есть') : `${COST[i]} монет`)); g.append(b); });
      box.append(g, el('p', 'lab-note', 'Монеты собираются в обби. Облик героя хранится в этом браузере.')); };
    draw(); return box;
  }
  // ---------- страница ----------
  function mount(host, lv, api) {
    style(); const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'), d = load(api.grade);
    task.append(el('h2', '', lv.title), el('p', '', lv.brief)); host.append(task);
    const T = 48, art = n => { const i = new Image(); i.src = `art/${n}.webp?v=1`; return i; };
    const I = {bg: art('bg_blocks'), grass: art('blox_tile_0'), stone: art('blox_tile_1'), wood: art('blox_tile_2'), lava: art('blox_tile_3'), glass: art('blox_tile_4'), flag: art('blox_tile_5'), av: art('blox_av_' + (d.av || 0))};
    const drawTile = (g, c, x, y, sx, top) => { const px = x * T - sx, py = (H - 1 - y) * T, im = c === '#' ? (top ? I.grass : I.stone) : c === 'W' ? I.wood : c === 'L' ? I.lava : c === 'X' ? I.glass : c === 'B' ? I.stone : c === 'F' || c === 'Q' ? I.flag : null;
      if (c === 'B') { g.fillStyle = '#ffd34d'; g.fillRect(px, py, T, T); }
      if (im && im.complete && im.naturalWidth) g.drawImage(im, px, py, T, T); else if (c !== '.') { g.fillStyle = {'#': '#5a8a3a', W: '#a0703a', L: '#ff5a1a', X: '#9fe0ff', B: '#ffd34d', F: '#ffd34d', Q: '#ffd34d'}[c] || '#888'; g.fillRect(px, py, T, T); }
      if (c === 'Q') { g.fillStyle = '#1b2333'; g.font = '900 30px system-ui'; g.textAlign = 'center'; g.fillText('?', px + T / 2, py + T * 0.72); }
      if (c === 'B') { g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeRect(px + 1, py + 1, T - 2, T - 2); } };
    const sky = (g, w, h, sx) => { if (I.bg.complete && I.bg.naturalWidth) { const k = h / I.bg.naturalHeight, bw = I.bg.naturalWidth * k, off = (sx * 0.3) % bw; for (let x = -off; x < w; x += bw) g.drawImage(I.bg, x, 0, bw, h); } else { g.fillStyle = '#7cc4ff'; g.fillRect(0, 0, w, h); } };
    if (lv.kind === 'studio') {
      const m = studioMap(lv.n), wrap = el('div', 'bx-studio'), cv = el('canvas', 'bx-cv'), side = el('div'), ta = el('textarea'); cv.width = m.g[0].length * T; cv.height = H * T; const g = cv.getContext('2d');
      ta.value = '# place(x, y) — поставить блок\n'; ta.spellcheck = false; ta.dataset.field = 'code'; let tries = 0, anim = 0;
      const render = (gr, hero, path) => { sky(g, cv.width, cv.height, 0);
        g.fillStyle = 'rgba(255,211,77,.12)'; g.fillRect(m.zone[0] * T, 0, (m.zone[1] - m.zone[0] + 1) * T, cv.height);
        for (let y = 0; y < H; y++) for (let x = 0; x < gr[0].length; x++) drawTile(g, gr[y][x], x, y, 0, y + 1 >= H || !solidC(gr[y + 1][x]));
        g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '700 12px ui-monospace'; g.textAlign = 'center'; for (let x = 0; x < gr[0].length; x++) g.fillText(String(x), x * T + T / 2, cv.height - 4); g.textAlign = 'left'; for (let y = 0; y < H; y++) g.fillText(String(y), 3, (H - 1 - y) * T + 14);
        if (path) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.setLineDash([6, 6]); g.beginPath(); path.forEach(([x, y], i) => { const px = x * T + T / 2, py = (H - 1 - y) * T + T / 2; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); g.setLineDash([]); }
        const [hx, hy] = hero; if (I.av.complete && I.av.naturalWidth) g.drawImage(I.av, hx * T + 4, (H - 1 - hy) * T - 20, T - 8, T + 18); };
      const runB = button('▶ Построить и пустить героя', 'lab-main', () => { tries++; const r = check(lv, {code: ta.value}); cancelAnimationFrame(anim);
        let grid2 = m.g; try { grid2 = build(ta.value, m).g; } catch {} const path = r.path || [m.start]; let i = 0, t0 = 0;
        const go = ts => { if (!t0) t0 = ts; i = Math.min(path.length - 1, Math.floor((ts - t0) / 180)); render(grid2, path[i], path.slice(0, i + 1)); if (i < path.length - 1) anim = requestAnimationFrame(go); else done(); };
        const done = () => { msg.textContent = r.msg; msg.className = 'lab-msg ' + (r.ok ? 'good' : 'bad'); if (r.ok) api.finish(Math.max(1, r.stars - (tries > 3 ? 1 : 0)), r.msg); };
        anim = requestAnimationFrame(go); });
      runB.dataset.act = 'run';
      side.append(el('p', 'lab-note', m.hint), el('p', 'lab-note', 'Подсветка — зона стройки. Пример: for x in range(6, 9): place(x, 0)'), ta, runB);
      wrap.append(cv, side); host.append(wrap, msg); render(m.g, m.start);
      if (api.debugHost) window.labSet = a => { ta.value = typeof a === 'string' ? a : a.code; };
      return () => { cancelAnimationFrame(anim); if (api.debugHost) delete window.labSet; };
    }
    // Обби: платформер.
    const M = obbyMap(lv.n), r = rng(lv.seed + Math.floor(Math.random() * 1e6)), wrap = el('div', 'bx-wrap'), cv = el('canvas', 'bx-cv'), g = cv.getContext('2d'); cv.width = 960; cv.height = H * T; cv.tabIndex = 0;
    const map = M.g.map(row => row.slice()), W = map[0].length * T, glass = M.glass.map(p => ({...p, q: ask(r, api.grade, true), broken: -1}));
    for (const p of glass) { const right = p.q.right === 0 ? p.high : p.low; p.solid = right; }
    let px0 = M.start[0] * T + T / 2, py0 = (H - M.start[1]) * T, p = {x: px0, y: py0, vx: 0, vy: 0, ground: false, face: 1}, check0 = [px0, py0], deaths = 0, wrong = 0, coins = 0, quiz = null, done = false, raf = 0, last = 0, cam = 0, t = 0;
    const keys = {}, solidAt = (cx, cy) => { if (cx < 0 || cx >= map[0].length) return true; if (cy < 0) return false; if (cy >= H) return false; const c = map[cy][cx]; if (c === '#' || c === 'W' || c === 'X') return true;
      const gp = glass.find(q => q.x === cx || q.x + 1 === cx); if (gp && (cy === gp.low || cy === gp.high) && gp.broken !== cy) return true; return false; };
    const tileAt = (wx, wy) => [Math.floor(wx / T), H - 1 - Math.floor((wy - 1) / T)];
    const hitBox = (x, y) => { for (const [ox, oy] of [[-13, -1], [13, -1], [-13, -42], [13, -42], [0, -20]]) { const [cx, cy] = tileAt(x + ox, y + oy); if (solidAt(cx, cy)) return true; } return false; };
    function die() { deaths++; p.x = check0[0]; p.y = check0[1]; p.vx = p.vy = 0; }
    function step(dt) {
      t += dt; if (quiz) return;
      const dir = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0); p.vx = dir * 240; if (dir) p.face = dir;
      p.vy = Math.min(900, p.vy + 1700 * dt); if ((keys.Space || keys.ArrowUp || keys.KeyW) && p.ground) { p.vy = -660; p.ground = false; }
      const nx = p.x + p.vx * dt; if (!hitBox(nx, p.y)) p.x = nx;
      const ny = p.y + p.vy * dt; if (!hitBox(p.x, ny)) { p.y = ny; p.ground = false; } else { if (p.vy > 0) { p.ground = true; p.y = Math.round(p.y / T) * T; } p.vy = 0; }
      // Стекло: наступил на плиту с неверным ответом — она лопается.
      if (p.ground) { const [cx, cy] = tileAt(p.x, p.y + 4); const gp = glass.find(q => q.x === cx || q.x + 1 === cx); if (gp && cy !== gp.solid && (cy === gp.low || cy === gp.high)) { gp.broken = cy; wrong++; p.ground = false; } }
      const [cx, cy] = tileAt(p.x, p.y - 4), here = map[cy] && map[cy][cx], below = tileAt(p.x, p.y + 4);
      if (p.y > H * T + 60 || (map[below[1]] && map[below[1]][below[0]] === 'L' && p.ground)) { die(); return; }
      if (here === 'o') { map[cy][cx] = '.'; coins++; }
      if (here === 'Q') { quiz = {q: ask(r, api.grade, false), cx, cy}; showQuiz(); }
      if (here === 'F') finishRun();
      cam = Math.max(0, Math.min(W - cv.width, p.x - cv.width * 0.4));
    }
    const qBox = el('div', 'bx-q'); qBox.hidden = true;
    function showQuiz() { qBox.hidden = false; qBox.replaceChildren(el('b', '', quiz.q.q)); const row = el('div');
      quiz.q.opts.forEach((o, i) => { const b = button(o, '', () => { if (i === quiz.q.right) { map[quiz.cy][quiz.cx] = '.'; for (let y = 1; y < H; y++) if (map[y][quiz.cx + 1] === 'X') map[y][quiz.cx + 1] = '.'; check0 = [quiz.cx * T + T / 2, (H - quiz.cy) * T]; quiz = null; qBox.hidden = true; cv.focus(); }
        else { wrong++; quiz.q = ask(r, api.grade, false); showQuiz(); } }); b.dataset.opt = i; row.append(b); }); qBox.append(row, el('p', 'lab-note', 'Верный ответ открывает проход и сохраняет точку.')); }
    function finishRun() { if (done) return; done = true; const dd = load(api.grade); dd.coins = (dd.coins || 0) + coins + 5; keep(api.grade, dd); const res = check(lv, {reached: true, deaths, wrong}); api.finish(res.stars, res.msg + ` Монет: +${coins + 5}.`); }
    function draw() {
      sky(g, cv.width, cv.height, cam);
      const x0 = Math.floor(cam / T), x1 = Math.min(map[0].length - 1, x0 + Math.ceil(cv.width / T) + 1);
      for (let y = 0; y < H; y++) for (let x = x0; x <= x1; x++) { const c = map[y][x]; if (c === 'o') { g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(x * T + T / 2 - cam, (H - 1 - y) * T + T / 2 + Math.sin(t * 4 + x) * 4, 11, 0, 7); g.fill(); continue; } if (c !== '.') drawTile(g, c, x, y, cam, y + 1 >= H || !solidAt(x, y + 1)); }
      for (const q of glass) for (const y of [q.low, q.high]) { if (q.broken === y) continue; for (const xx of [q.x, q.x + 1]) { const px = xx * T - cam, py = (H - 1 - y) * T; g.globalAlpha = 0.85; if (I.glass.complete && I.glass.naturalWidth) g.drawImage(I.glass, px, py, T, T); else { g.fillStyle = '#bfefff'; g.fillRect(px, py, T, T); } g.globalAlpha = 1; }
        g.fillStyle = '#1b2333'; g.font = '800 15px system-ui'; g.textAlign = 'center'; g.fillText(q.q.opts[y === q.high ? 0 : 1], q.x * T + T - cam, (H - 1 - y) * T + T * 0.62); }
      const near = glass.find(q => Math.abs(q.x * T - p.x) < T * 3.5); if (near) { g.fillStyle = 'rgba(14,20,44,.88)'; g.fillRect(cv.width / 2 - 230, 10, 460, 40); g.fillStyle = '#fff'; g.font = '800 20px system-ui'; g.textAlign = 'center'; g.fillText(near.q.q, cv.width / 2, 37); }
      if (I.av.complete && I.av.naturalWidth) { g.save(); g.translate(p.x - cam, 0); g.scale(p.face, 1); g.drawImage(I.av, -22, p.y - 64, 44, 64); g.restore(); }
      g.fillStyle = '#fff'; g.font = '800 18px system-ui'; g.textAlign = 'left'; g.fillText(`● ${coins}   падений ${deaths}   ошибок ${wrong}`, 12, 24);
    }
    function loop(ts) { const dt = Math.min(0.04, (ts - (last || ts)) / 1000); last = ts; if (!done) step(dt); draw(); if (!done) raf = requestAnimationFrame(loop); }
    const kd = e => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW'].includes(e.code)) { keys[e.code] = e.type === 'keydown'; e.preventDefault(); } };
    document.addEventListener('keydown', kd); document.addEventListener('keyup', kd);
    const pad = el('div', 'bx-pad'); for (const [tx, k] of [['←', 'ArrowLeft'], ['прыжок', 'Space'], ['→', 'ArrowRight']]) { const b = button(tx, '', () => {}); b.addEventListener('pointerdown', () => { keys[k] = true; }); b.addEventListener('pointerup', () => { keys[k] = false; }); b.addEventListener('pointerleave', () => { keys[k] = false; }); pad.append(b); }
    wrap.append(cv, qBox); host.append(wrap, pad, msg); raf = requestAnimationFrame(loop); cv.focus();
    if (api.debugHost) window.labSet = a => { deaths = a.deaths; wrong = a.wrong; coins = a.coins || 0; finishRun(); };
    return () => { done = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', kd); if (api.debugHost) delete window.labSet; };
  }
  LAB.register({id: 'blocks', bg: 'bg_blocks', title: 'Кодоблокс', genre: 'обби и студия · Python', art: '🧱', color: '#4fc3ff', unit: 'Мир', minutes: 40,
    about: 'В духе Roblox: проходи обби с лавой и стеклянным мостом (держит только плита с верным ответом), а в студии строй мосты и лестницы программой на Python. За монеты — новый облик героя.',
    levels, mount, check, solve, extra, lib: {build, walk, studioMap, obbyMap}});
})();
