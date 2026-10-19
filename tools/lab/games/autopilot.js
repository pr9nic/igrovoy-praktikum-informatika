// «Автопилот»: алгоритмы управления с обратной связью (9 класс §1.6). Дрон на клетчатой карте управляется программой на Python:
// команды forward(), left(), right() и датчики free_ahead(), free_left(), free_right(), at_pad(). Программа проверяется на трёх
// картах с разной длиной коридоров и разными лабиринтами — заученный маршрут не пройдёт, нужен цикл с проверкой датчиков.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const PY = () => globalThis.CodeHero || (typeof require === 'function' ? require('../../codehero/core.js') : null);
  const D = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // восток, юг, запад, север
  const grid = (w, h) => Array.from({length: h}, () => Array(w).fill('#'));
  // Генераторы карт: g — сетка, s — старт (x, y, направление), p — посадочная площадка.
  function corridor(r, len) { const g = grid(len + 3, 3); for (let x = 1; x <= len + 1; x++) g[1][x] = '.'; return {g, s: [1, 1, 0], p: [len + 1, 1]}; }
  function lshape(r) { const a = 3 + Math.floor(r() * 5), b = 2 + Math.floor(r() * 4), up = r() < 0.5, h = b + 3, g = grid(a + 3, h), y0 = up ? h - 2 : 1;
    for (let x = 1; x <= a + 1; x++) g[y0][x] = '.'; for (let k = 1; k <= b; k++) g[y0 + (up ? -k : k)][a + 1] = '.'; return {g, s: [1, y0, 0], p: [a + 1, y0 + (up ? -b : b)]}; }
  function snake(r) { for (;;) { const W = 13, H = 11, g = grid(W, H); let x = 1, y = 5, d = 0; g[y][x] = '.'; let okp = true;
      for (let seg = 0; seg < 4 && okp; seg++) { const n = 2 + Math.floor(r() * 3); for (let k = 0; k < n; k++) { x += D[d][0]; y += D[d][1]; if (x < 1 || y < 1 || x > W - 2 || y > H - 2 || g[y][x] === '.') { okp = false; break; }
          // соседние клетки сбоку не должны быть коридором — иначе коридор «слипнется»
          g[y][x] = '.'; }
        d = (d + (r() < 0.5 ? 1 : 3)) % 4; }
      if (!okp) continue; const cnt = g.flat().filter(c => c === '.').length; let adj = false;
      for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) if (g[yy][xx] === '.' && D.filter(([dx, dy]) => g[yy + dy][xx + dx] === '.').length > 2) adj = true;
      if (adj || cnt < 8) continue; return {g, s: [1, 5, 0], p: [x, y]}; } }
  function maze(r, n) { const W = 2 * n + 1, g = grid(W, W), seen = new Set(), st = [[0, 0]]; seen.add('0,0'); g[1][1] = '.';
    while (st.length) { const [cx, cy] = st[st.length - 1], nb = D.map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < n && y < n && !seen.has(x + ',' + y));
      if (!nb.length) { st.pop(); continue; } const [nx, ny] = nb[Math.floor(r() * nb.length)]; seen.add(nx + ',' + ny); g[2 * ny + 1][2 * nx + 1] = '.'; g[cy + ny + 1][cx + nx + 1] = '.'; st.push([nx, ny]); }
    return {g, s: [1, 1, 0], p: [W - 2, W - 2]}; }
  const L = (title, brief, make, hint) => ({title, brief, make, hint});
  const LEVELS = [
    L('Взлёт', 'Долети до площадки. Длина коридора на трёх картах разная — используй цикл while и датчик at_pad().', r => corridor(r, 2 + Math.floor(r() * 7)), 'while not at_pad():\n    forward()'),
    L('До стены', 'Лети вперёд, пока впереди свободно. Площадка — у стены в конце коридора.', r => corridor(r, 3 + Math.floor(r() * 6)), 'while free_ahead():\n    forward()'),
    L('Поворот', 'Коридор поворачивает — то вверх, то вниз. Долети до площадки.', r => lshape(r), 'while free_ahead():\n    forward()\nif free_left():\n    left()\nelse:\n    right()\nwhile free_ahead():\n    forward()'),
    L('Змейка', 'Коридор много раз поворачивает. Пусть дрон сам решает, куда повернуть.', r => snake(r), 'while not at_pad():\n    if free_ahead():\n        forward()\n    elif free_left():\n        left()\n    else:\n        right()'),
    L('Первый лабиринт', 'Лабиринт 4×4. Подсказка: держись правой рукой за стену.', r => maze(r, 4), 'while not at_pad():\n    if free_right():\n        right()\n        forward()\n    elif free_ahead():\n        forward()\n    else:\n        left()'),
    L('Лабиринт побольше', 'Лабиринт 5×5 — та же программа должна справиться.', r => maze(r, 5), null),
    L('Большой лабиринт', 'Лабиринт 6×6.', r => maze(r, 6), null),
    L('Мастер автопилота', 'Лабиринт 7×7: тупики, длинные коридоры, развилки.', r => maze(r, 7), null),
  ];
  const REF = 'while not at_pad():\n    if free_right():\n        right()\n        forward()\n    elif free_ahead():\n        forward()\n    else:\n        left()';
  LEVELS.forEach(l => { l.ref = l.hint || REF; });
  const maps = (lv, seed) => { const r = rng(seed * 101 + LEVELS.indexOf(lv) * 37); return [0, 1, 2].map(() => lv.make(r)); };
  function fly(code, m, trace) {
    const H = PY(); if (!H) throw new Error('интерпретатор Python не загрузился');
    let [x, y, d] = m.s, steps = 0; const free = dd => m.g[y + D[dd][1]][x + D[dd][0]] !== '#', act = fn => ({builtin: 'act', call: () => { if (++steps > 600) throw new H.PyError('Дрон летает слишком долго — похоже, цикл не заканчивается.'); fn(); trace && trace({x, y, d}); return null; }});
    const sense = fn => ({builtin: 'sense', call: () => fn()});
    const env = {forward: act(() => { if (!free(d)) throw new H.PyError('Дрон врезался: впереди препятствие.'); x += D[d][0]; y += D[d][1]; }), left: act(() => { d = (d + 3) % 4; }), right: act(() => { d = (d + 1) % 4; }),
      free_ahead: sense(() => free(d)), free_left: sense(() => free((d + 3) % 4)), free_right: sense(() => free((d + 1) % 4)), at_pad: sense(() => x === m.p[0] && y === m.p[1])};
    const it = H.run(H.parse(String(code)), env, {ops: 60000}); for (const _ of it) {}
    return {x, y, d, steps, ok: x === m.p[0] && y === m.p[1]};
  }
  function check(lv, ans) {
    if (!ans || !Number.isInteger(ans.seed) || typeof ans.code !== 'string' || !ans.code.trim()) return {ok: false, msg: 'Напиши программу.', results: []};
    const results = maps(lv, ans.seed).map(m => { try { const r = fly(ans.code, m); return r.ok ? {ok: true, steps: r.steps} : {ok: false, msg: 'дрон не долетел до площадки'}; } catch (e) { return {ok: false, msg: (e.line ? `строка ${e.line}: ` : '') + e.message}; } });
    const good = results.filter(x => x.ok).length;
    return good === 3 ? {ok: true, stars: 3, results, msg: 'Дрон долетел на всех трёх картах.'} : {ok: false, results, msg: `Долетел на картах: ${good} из 3.`};
  }
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'), out = el('div', 'og-results'); let seed = Math.floor(Math.random() * 1e6), ms = maps(lv, seed), shown = 0, timer = 0, tries = 0;
    task.append(el('h2', '', lv.title), el('p', '', lv.brief), el('p', 'lab-note', 'Команды: forward() — шаг вперёд, left() / right() — поворот на месте. Датчики: free_ahead(), free_left(), free_right() — свободно ли там; at_pad() — дрон на площадке.'));
    const cv = el('canvas', 'ap-canvas'), g = cv.getContext('2d'), tabs = el('div', 'og-ftabs'), img = n => { const i = new Image(); i.src = `art/ap_${n}.webp?v=1`; return i; }, I = {drone: img('drone'), tree: img('tree'), pad: img('pad')};
    const draw = st => { const m = ms[shown], H = m.g.length, W = m.g[0].length, C = Math.floor(Math.min(560 / W, 440 / H)); cv.width = W * C; cv.height = H * C; g.fillStyle = '#20402a'; g.fillRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (m.g[y][x] === '#') { if (I.tree.complete && I.tree.naturalWidth) g.drawImage(I.tree, x * C - C * .1, y * C - C * .1, C * 1.2, C * 1.2); else { g.fillStyle = '#2e6b3a'; g.fillRect(x * C, y * C, C, C); } } else { g.fillStyle = (x + y) % 2 ? '#d9cfa8' : '#e3d9b3'; g.fillRect(x * C, y * C, C, C); } }
      if (I.pad.complete && I.pad.naturalWidth) g.drawImage(I.pad, m.p[0] * C + 2, m.p[1] * C + 2, C - 4, C - 4);
      const [x, y, d] = st ? [st.x, st.y, st.d] : m.s; g.save(); g.translate(x * C + C / 2, y * C + C / 2); g.rotate(d * Math.PI / 2 + Math.PI / 2); if (I.drone.complete && I.drone.naturalWidth) g.drawImage(I.drone, -C * .45, -C * .45, C * .9, C * .9); else { g.fillStyle = '#5cc8ff'; g.fillRect(-C / 3, -C / 3, C * .66, C * .66); } g.restore(); };
    const tab = () => tabs.replaceChildren(...[0, 1, 2].map(i => button(`Карта ${i + 1}`, 'lab-small' + (i === shown ? ' on' : ''), () => { shown = i; clearInterval(timer); tab(); draw(null); })));
    const ed = el('textarea', 'ex-code og-ed'); ed.spellcheck = false; ed.rows = 10; ed.value = '# дрон стоит на старте и смотрит вправо\n'; ed.setAttribute('aria-label', 'Программа');
    const trial = button('▶ Запустить на этой карте', 'lab-small', () => { clearInterval(timer); const frames = []; let err = ''; try { fly(ed.value, ms[shown], s => frames.push(s)); } catch (e) { err = (e.line ? `строка ${e.line}: ` : '') + e.message; } let k = 0; msg.className = 'lab-msg'; msg.textContent = 'Дрон в полёте…';
      timer = setInterval(() => { if (k >= frames.length) { clearInterval(timer); const end = frames[frames.length - 1], m = ms[shown]; msg.className = 'lab-msg ' + (err ? 'bad' : end && end.x === m.p[0] && end.y === m.p[1] ? 'good' : 'bad'); msg.textContent = err || (end && end.x === m.p[0] && end.y === m.p[1] ? 'Посадка на площадку!' : 'Программа закончилась, а дрон не на площадке.'); return; } draw(frames[k++]); }, 110); });
    const go = button('🛬 Проверить на трёх картах', 'lab-main', () => { tries++; clearInterval(timer); const r = check(lv, {seed, code: ed.value}); out.replaceChildren(...r.results.map((x, i) => el('p', x.ok ? 'good' : 'bad', `Карта ${i + 1}: ${x.ok ? `долетел за ${x.steps} команд ✔` : x.msg}`)));
      msg.textContent = r.msg; msg.className = 'lab-msg ' + (r.ok ? 'good' : 'bad'); if (r.ok) api.finish(tries === 1 ? 3 : tries <= 3 ? 2 : 1, r.msg); }); go.dataset.act = 'run';
    Object.values(I).forEach(i => i.addEventListener('load', () => draw(null)));
    const cols = el('div', 'lab-cols'), l = el('div', 'lab-panel'), rr = el('div', 'lab-panel'); l.append(tabs, cv, trial); rr.append(el('h3', '', 'Программа автопилота (Python)'), ed, go, out, msg); cols.append(l, rr); host.append(task, cols); tab(); draw(null);
    if (api.debugHost) window.labSet = a => { if (typeof a === 'string') ed.value = a; else { seed = a.seed; ms = maps(lv, seed); ed.value = a.code; } draw(null); };
    return () => clearInterval(timer);
  }
  LAB.register({id: 'autopilot', bg: 'bg_race', title: 'Автопилот', genre: 'алгоритмы управления', art: '🚁', color: '#7fe3c8', unit: 'Полёт', minutes: 40,
    about: 'Напиши на Python автопилот для дрона: команды и датчики препятствий. Одна программа должна долететь до площадки на трёх разных картах — от коридоров до больших лабиринтов.',
    levels: () => LEVELS, mount, check, solve: lv => ({seed: 1, code: lv.ref}), LEVELS, maps, fly});
})();
