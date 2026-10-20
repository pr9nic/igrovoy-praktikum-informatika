// Проверка «Карты дорог» без браузера: node tools/lab/tests/graphs.test.js
// Кратчайшие пути сверяются с независимой Дейкстрой (и перебором простых путей), число путей — с перебором DFS,
// сопоставление таблицы и схемы — перебором всех перестановок; неверные ответы должны отклоняться.
const path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); require(path.join(dir, 'games', 'graphs.js'));
const g = LAB.games.find(x => x.id === 'graphs');
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };

// Независимые эталоны.
function dijkstra(w, s) { const n = w.length, d = Array(n).fill(Infinity), used = Array(n).fill(false); d[s] = 0;
  for (let it = 0; it < n; it++) { let u = -1; for (let v = 0; v < n; v++) if (!used[v] && (u < 0 || d[v] < d[u])) u = v; used[u] = true; for (let v = 0; v < n; v++) if (w[u][v] && d[u] + w[u][v] < d[v]) d[v] = d[u] + w[u][v]; }
  return d; }
function simplePaths(w, s, t) { const out = [], seen = new Set([s]); const go = (u, p, len) => { if (u === t) { out.push({p: p.slice(), len}); return; } for (let v = 0; v < w.length; v++) if (w[u][v] && !seen.has(v)) { seen.add(v); p.push(v); go(v, p, len + w[u][v]); p.pop(); seen.delete(v); } }; go(s, [s], 0); return out; }
function countPaths(edges, n, X, Y) { let c = 0; const go = (u, via) => { if (u === Y) return; via = via || u === X; if (u === n - 1) { if (X == null || via) c++; return; } for (const [a, b] of edges) if (a === u) go(b, via); }; go(0, false); return c; }
function isos(P) { // все биекции «номер таблицы → вершина схемы», сохраняющие смежность
  const n = P.n, T = Array.from({length: n}, (_, i) => Array.from({length: n}, (_, j) => P.w[P.tv[i]][P.tv[j]] ? 1 : 0)), A = P.w.map(r => r.map(x => x ? 1 : 0)), res = [], p = [], used = Array(n).fill(false);
  const go = i => { if (i === n) { res.push(p.slice()); return; } for (let v = 0; v < n; v++) if (!used[v]) { let ok = true; for (let j = 0; j < i; j++) if (T[i][j] !== A[v][p[j]]) { ok = false; break; } if (ok) { used[v] = true; p[i] = v; go(i + 1); used[v] = false; } } };
  go(0); return res; }

// 1. Образцовые решения дают три звезды во всех классах.
for (const grade of [6, 7, 8, 9, 10, 11]) { const L = g.levels(grade); let ok = L.length === 10, info = '';
  L.forEach((lv, i) => { const r = g.check(lv, g.solve(lv, grade), grade); if (!r.ok || r.stars !== 3) { ok = false; info = `уровень ${i + 1}: ${JSON.stringify(r)}`; } });
  check(`${grade} класс: 10 уровней, образцовые решения — три звезды`, ok, info); }
check('8–9 и 10–11 классы получают разные наборы', g.levels(8) !== g.levels(10) && g.levels(9)[0].kind === 'path' && g.levels(11).some(l => l.kind === 'match'));

const SEEDS = 60;
// 2. Кратчайший путь: совпадает с независимой Дейкстрой, единственен (перебор простых путей), неверные маршруты отклоняются.
{ let info = '', n = 0;
  for (const lv of g.LEVELS.filter(l => l.kind === 'path')) for (let s = 1; s <= SEEDS && !info; s++) { const P = g.make(lv, s); n++;
    const dS = dijkstra(P.w, P.S); let best = dS[P.T];
    if (P.X != null) best = dS[P.X] + dijkstra(P.w, P.X)[P.T];
    const all = simplePaths(P.w, P.S, P.T).filter(x => P.X == null || x.p.includes(P.X)), min = Math.min(...all.map(x => x.len)), opt = all.filter(x => x.len === min);
    if (P.best !== best || min !== best) info = `${lv.title}, вариант ${s}: эталон ${best}, игра ${P.best}`;
    else if (opt.length !== 1 || opt[0].p.join() !== P.route.join()) info = `${lv.title}, вариант ${s}: кратчайший путь не единственный`;
    else if (P.X != null && dS[P.T] >= best) info = `${lv.title}, вариант ${s}: пункт ${P.X} ничего не меняет`;
    else if (!g.check(lv, {seed: s, route: P.route}).ok) info = `${lv.title}, вариант ${s}: верный маршрут отклонён`;
    else if (!g.check(lv, {seed: s, route: P.route.map(v => P.names[v]).join('')}).ok) info = `${lv.title}, вариант ${s}: маршрут буквами отклонён`;
    else { const worse = all.find(x => x.len > min); if (worse && g.check(lv, {seed: s, route: worse.p}).ok) info = `${lv.title}, вариант ${s}: принят длинный маршрут`;
      if (g.check(lv, {seed: s, route: [P.S, P.T]}).ok && !P.w[P.S][P.T]) info = 'принят несуществующий прыжок'; if (g.check(lv, {seed: s, route: P.route.slice(0, -1)}).ok) info = 'принят недоезд';
      if (P.X != null) { const noX = simplePaths(P.w, P.S, P.T).find(x => !x.p.includes(P.X)); if (noX && g.check(lv, {seed: s, route: noX.p}).ok) info = 'принят маршрут мимо обязательного пункта'; } }
    if (lv.trap && !info) { const h = Math.min(...simplePaths(P.w, P.S, P.T).map(x => x.p.length - 1)); if (h >= P.route.length - 1) info = `${lv.title}, вариант ${s}: нет ловушки «меньше дорог»`; } }
  check(`кратчайший путь: независимая Дейкстра и перебор, единственность, неверные маршруты отклоняются (${n} карт)`, !info, info); }

// 3. Число путей: волна совпадает с перебором DFS, «через»/«не через» действительно меняют ответ, ошибки отклоняются.
{ let info = '', n = 0;
  for (const lv of g.LEVELS.filter(l => l.kind === 'count')) for (let s = 1; s <= SEEDS && !info; s++) { const P = g.make(lv, s); n++;
    const bf = countPaths(P.edges, P.n, P.X, P.Y);
    if (P.edges.some(([a, b]) => a >= b)) info = `${lv.title}, вариант ${s}: ребро против порядка волны`;
    else if (bf !== P.answer) info = `${lv.title}, вариант ${s}: перебор ${bf}, игра ${P.answer}`;
    else if (lv.mode !== 'plain' && (countPaths(P.edges, P.n, null, null) === bf || (lv.mode === 'viaAvoid' && countPaths(P.edges, P.n, P.X, null) === bf))) info = `${lv.title}, вариант ${s}: условие не меняет ответ`;
    else if ((lv.mode === 'via' || lv.mode === 'viaAvoid') !== (P.X != null) || (lv.mode === 'avoid' || lv.mode === 'viaAvoid') !== (P.Y != null)) info = `${lv.title}: не тот режим`;
    else { // каждое промежуточное число волны — тоже перебор: пути из А в v (до X) или через X (после X)
      for (let v = 1; v < P.n && !info; v++) { if (P.N[v] == null) continue;
        const afterX = P.X != null && v !== P.X && countRaw(P.edges, P.X, v, null, null) > 0, want = v === P.Y ? 0 : countRaw(P.edges, 0, v, afterX ? P.X : null, P.Y);
        if (want !== P.N[v]) info = `${lv.title}, вариант ${s}: в городе ${P.names[v]} ${P.N[v]}, перебор ${want}`; }
      // бледные (неучаствующие) города: ни одного пути А → v → X и X → v
      for (let v = 1; v < P.n && !info; v++) if (P.N[v] == null && (countRaw(P.edges, P.X, v, null, null) > 0 || countRaw(P.edges, v, P.X, null, null) > 0)) info = `${lv.title}, вариант ${s}: город ${P.names[v]} зря выключен`;
      const c = P.N.slice(); const k = c.findIndex((x, i) => i > 0 && x != null && i !== P.Y && i !== P.n - 1); c[k] = c[k] + 1; const r = g.check(lv, {seed: s, counts: c});
      if (!r.ok || r.stars !== 2) info = `${lv.title}, вариант ${s}: ошибка в промежуточном городе не снижает звёзды`;
      const c2 = P.N.slice(); c2[P.n - 1] += 1; if (g.check(lv, {seed: s, counts: c2}).ok || g.check(lv, {seed: s, answer: P.answer + 1}).ok || g.check(lv, {seed: s, counts: []}).ok) info = `${lv.title}, вариант ${s}: принят неверный ответ`; } }
  check(`число путей: волна сходится с перебором DFS в каждом городе, неверные ответы отклоняются (${n} графов)`, !info, info); }
function countRaw(edges, s, t, X, Y) { let c = 0; const go = (u, via) => { if (u === Y) return; via = via || u === X; if (u === t) { if (X == null || via) c++; return; } for (const [a, b] of edges) if (a === u && b <= t) go(b, via); }; go(s, false); return c; }

// 4. Сопоставление: ровно одна биекция таблица → схема, ответ = длина по этой биекции; неверное сопоставление/длина не на три звезды.
{ let info = '', n = 0;
  for (const lv of g.LEVELS.filter(l => l.kind === 'match')) for (let s = 1; s <= SEEDS && !info; s++) { const P = g.make(lv, s); n++; const all = isos(P);
    if (all.length !== 1) info = `${lv.title}, вариант ${s}: сопоставлений ${all.length}`;
    else { const m = all[0], T = (i, j) => P.w[P.tv[i]][P.tv[j]], inv = v => m.indexOf(v), want = P.ask.reduce((sum, [a, b]) => sum + T(inv(a), inv(b)), 0);
      const map = m.map(v => P.names[v]);
      if (want !== P.answer) info = `${lv.title}, вариант ${s}: ответ ${P.answer}, по таблице ${want}`;
      else if (g.check(lv, {seed: s, map, length: want}).stars !== 3) info = 'верный ответ не на три звезды';
      else if (g.check(lv, {seed: s, map, length: want + 1}).ok || g.check(lv, {seed: s, map, length: ''}).ok) info = `${lv.title}, вариант ${s}: принята неверная длина`;
      else { const sw = map.slice(); [sw[0], sw[1]] = [sw[1], sw[0]]; if (g.check(lv, {seed: s, map: sw, length: want}).stars !== 2) info = 'неверное сопоставление дало три звезды'; } } }
  check(`сопоставление таблицы и схемы единственно (перебор перестановок), длина сходится, ошибки отклоняются (${n} схем)`, !info, info); }

// 5. Карта читаемая: дороги не пересекаются, города не слипаются; ответы не пустые.
{ let info = '';
  const cr = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
  for (const lv of g.LEVELS.filter(l => l.kind !== 'count')) for (let s = 1; s <= 20; s++) { const P = g.make(lv, s);
    for (const [a, b] of P.edges) for (const [c, d] of P.edges) if (new Set([a, b, c, d]).size === 4 && cr(P.pts[a], P.pts[b], P.pts[c], P.pts[d])) info = `${lv.title}, вариант ${s}: дороги пересекаются`;
    for (let i = 0; i < P.n; i++) for (let j = i + 1; j < P.n; j++) if (Math.hypot(P.pts[i].x - P.pts[j].x, P.pts[i].y - P.pts[j].y) < 60) info = `${lv.title}, вариант ${s}: города слиплись`;
    if (P.pts.some(p => p.x < 20 || p.y < 20 || p.x > 740 || p.y > 400)) info = 'город за краем карты'; }
  check('карты: дороги не пересекаются, города не слипаются и не выходят за край', !info, info); }
{ const lv = g.levels(9)[0]; check('пустые и негодные ответы отклоняются', !g.check(lv, null).ok && !g.check(lv, {seed: 1}).ok && !g.check(lv, {seed: 1, route: 'АА'}).ok && !g.check(g.levels(10)[2], {seed: 1, map: [], length: 'abc'}).ok && !g.check(g.levels(10)[5], {seed: 1}).ok); }

console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
