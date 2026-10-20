// «Карта дорог»: графы и маршруты (8–11 класс). ОГЭ 4 — кратчайший путь по таблице расстояний; ЕГЭ 1 — сопоставить таблицу
// с нарисованной схемой и найти длину дороги; ЕГЭ 13 (ОГЭ 9) — число путей в ориентированном графе, «через город X» и «не проходя Y».
// Маршрут собирается щелчками по городам (сумма считается сразу), число путей — «волной» город за городом, таблицу и схему сопоставляют выбором букв.
// Логика (make/check/solve) не трогает страницу и проверяется в node: tools/lab/tests/graphs.test.js.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1)), pick = (r, a) => a[Math.floor(r() * a.length)];
  const shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const range = n => Array.from({length: n}, (_, i) => i), matrix = n => Array.from({length: n}, () => Array(n).fill(0));
  const LET = [...'АБВГДЕЖЗИКЛМН'], W = 760, H = 420, key = (a, b) => a < b ? a + '-' + b : b + '-' + a;

  /* ---------- геометрия: города без наложений, дороги без пересечений ---------- */
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const orient = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const crosses = (a, b, c, d) => orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
  const segDist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))); return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y); };
  function scatter(r, n) {
    const gap = Math.min(150, 520 / Math.sqrt(n));
    for (let t = 0; t < 200; t++) { const pts = []; for (let k = 0; k < 3000 && pts.length < n; k++) { const p = {x: ri(r, 50, W - 50), y: ri(r, 50, H - 45)}; if (pts.every(q => dist(p, q) >= gap)) pts.push(p); } if (pts.length === n) return pts.sort((a, b) => a.x - b.x); }
    return null;
  }
  // Неориентированная «карта»: короткие дороги добавляются первыми, пересечения и проход вплотную к чужому городу запрещены.
  function planar(r, n, m) {
    const pts = scatter(r, n); if (!pts) return null; const cand = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) cand.push([i, j, dist(pts[i], pts[j]) * (0.75 + 0.5 * r())]);
    cand.sort((a, b) => a[2] - b[2]); const edges = [], deg = Array(n).fill(0);
    for (const [i, j] of cand) { if (edges.length >= m) break; if (deg[i] >= 4 || deg[j] >= 4) continue;
      if (edges.some(([a, b]) => a !== i && a !== j && b !== i && b !== j && crosses(pts[i], pts[j], pts[a], pts[b]))) continue;
      if (pts.some((p, k) => k !== i && k !== j && segDist(p, pts[i], pts[j]) < 36)) continue; edges.push([i, j]); deg[i]++; deg[j]++; }
    if (edges.length < m) return null; const seen = new Set([0]), st = [0];
    while (st.length) { const u = st.pop(); for (const [a, b] of edges) for (const [x, y] of [[a, b], [b, a]]) if (x === u && !seen.has(y)) { seen.add(y); st.push(y); } }
    return seen.size === n ? {pts, edges} : null;
  }
  // Дейкстра с подсчётом числа кратчайших путей (нужна единственность ответа).
  function dijkstra(w, s) {
    const n = w.length, d = Array(n).fill(Infinity), c = Array(n).fill(0), prev = Array(n).fill(-1), done = Array(n).fill(false); d[s] = 0; c[s] = 1;
    for (;;) { let u = -1; for (let v = 0; v < n; v++) if (!done[v] && d[v] < Infinity && (u < 0 || d[v] < d[u])) u = v; if (u < 0) break; done[u] = true;
      for (let v = 0; v < n; v++) if (w[u][v] && !done[v]) { const nd = d[u] + w[u][v]; if (nd < d[v]) { d[v] = nd; c[v] = c[u]; prev[v] = u; } else if (nd === d[v]) c[v] += c[u]; } }
    return {d, c, prev};
  }
  const trace = (prev, t) => { const p = []; for (let v = t; v >= 0; v = prev[v]) p.unshift(v); return p; };
  const hops = (w, s, t) => { const d = Array(w.length).fill(-1), q = [s]; d[s] = 0; while (q.length) { const u = q.shift(); for (let v = 0; v < w.length; v++) if (w[u][v] && d[v] < 0) { d[v] = d[u] + 1; q.push(v); } } return d[t]; };
  // Число автоморфизмов (до limit): 1 — сопоставление таблицы и схемы единственно.
  function autos(adj, limit = 2) {
    const n = adj.length, p = Array(n).fill(-1), used = Array(n).fill(false), deg = adj.map(a => a.filter(Boolean).length); let cnt = 0;
    const rec = i => { if (cnt >= limit) return; if (i === n) { cnt++; return; }
      for (let v = 0; v < n; v++) if (!used[v] && deg[v] === deg[i]) { let ok = true; for (let j = 0; j < i && ok; j++) if (!adj[i][j] !== !adj[v][p[j]]) ok = false; if (ok) { used[v] = true; p[i] = v; rec(i + 1); used[v] = false; } } };
    rec(0); return cnt;
  }

  /* ---------- генераторы ---------- */
  const GEN = {
    // ОГЭ 4: кратчайший путь из А в последний пункт (возможно, через X). Кратчайший маршрут единственный.
    path(lv, r) {
      for (let t = 0; t < 2000; t++) { const g = planar(r, lv.n, lv.m); if (!g) continue; const n = lv.n, w = matrix(n);
        for (const [a, b] of g.edges) w[a][b] = w[b][a] = ri(r, 1, lv.wmax || 9);
        const S = 0, T = n - 1, A = dijkstra(w, S); if (A.c[T] !== 1) continue; let X = null, best = A.d[T], route = trace(A.prev, T);
        if (lv.via) { for (const x of shuffle(r, range(n).slice(1, -1)).filter(x => !route.includes(x))) { const B = dijkstra(w, x), rt = trace(A.prev, x).concat(trace(B.prev, T).slice(1));
            if (A.c[x] === 1 && B.c[T] === 1 && new Set(rt).size === rt.length) { X = x; best = A.d[x] + B.d[T]; route = rt; break; } }
          if (X == null) continue; }
        if (route.length - 1 < (lv.hops || 2)) continue;
        if (lv.trap && t < 1500 && hops(w, S, T) >= route.length - 1) continue;
        return {kind: 'path', n, pts: g.pts, edges: g.edges, w, names: LET.slice(0, n), S, T, X, best, route};
      }
      throw new Error('graphs: карта не построилась');
    },
    // ЕГЭ 1: схема без весов + таблица с номерами пунктов. Граф без симметрий — сопоставление единственно.
    match(lv, r) {
      for (let t = 0; t < 5000; t++) { const g = planar(r, lv.n, lv.m); if (!g) continue; const n = lv.n, adj = matrix(n); for (const [a, b] of g.edges) adj[a][b] = adj[b][a] = 1;
        if (autos(adj) !== 1) continue; const w = matrix(n); for (const [a, b] of g.edges) w[a][b] = w[b][a] = ri(r, lv.wmin || 3, lv.wmax || 30);
        const names = shuffle(r, LET.slice(0, n)), tv = shuffle(r, range(n)), ask = shuffle(r, g.edges).slice(0, lv.ask || 1);
        return {kind: 'match', n, pts: g.pts, edges: g.edges, w, names, tv, ask, answer: ask.reduce((s, [a, b]) => s + w[a][b], 0)};
      }
      throw new Error('graphs: схема не построилась');
    },
    // ЕГЭ 13 / ОГЭ 9: ориентированный граф слева направо, города пронумерованы в порядке «волны».
    count(lv, r) {
      for (let t = 0; t < 5000; t++) { const g = dag(r, lv.n), n = lv.n, end = n - 1, inner = range(n).slice(1, -1); let X = null, Y = null;
        const plain = wave(g.edges, n, null, null).N[end]; if (plain < (lv.min || 4) || plain > (lv.max || 300)) continue;
        if (lv.mode === 'via' || lv.mode === 'viaAvoid') { X = pick(r, inner); const v = wave(g.edges, n, X, null).N[end]; if (v < 2 || v === plain) continue; }
        if (lv.mode === 'avoid' || lv.mode === 'viaAvoid') { const act = wave(g.edges, n, X, null).N; Y = pick(r, inner.filter(v => v !== X && act[v] != null)); if (Y == null) continue;
          const base = wave(g.edges, n, X, null).N[end], v = wave(g.edges, n, X, Y).N[end]; if (v < 2 || v === base) continue; }
        const N = wave(g.edges, n, X, Y).N; if (lv.mode !== 'plain' && (N[end] > (lv.max || 300) || N[end] < (lv.least || 2))) continue;
        return {kind: 'count', n, pts: g.pts, edges: g.edges, bends: g.bends, names: LET.slice(0, n), X, Y, N, answer: N[end]};
      }
      throw new Error('graphs: граф путей не построился');
    },
  };
  // Колонки: А, затем по 2–3 города, в конце финиш. Рёбра идут вправо (в соседнюю колонку, через одну или вниз внутри колонки).
  function dag(r, n) {
    for (;;) { const cols = [[0]]; let left = n - 2, id = 1; while (left > 0) { const s = left <= 3 ? (left === 1 || r() < 0.5 ? left : left === 3 ? 3 : 2) : left === 4 ? 2 : pick(r, [2, 2, 3]); cols.push(range(s).map(k => id + k)); id += s; left -= s; }
      cols.push([n - 1]); const pts = [], C = cols.length;
      cols.forEach((col, c) => { const s = col.length, gap = s > 1 ? Math.min(150, (H - 110) / (s - 1)) : 0, shift = c % 2 ? 22 : -22;
        col.forEach((v, k) => { pts[v] = {x: Math.round(50 + c * (W - 100) / (C - 1)), y: Math.round(H / 2 + (k - (s - 1) / 2) * gap + (s > 1 && c && c < C - 1 ? shift : 0))}; }); });
      const E = new Set(), add = (a, b) => E.add(a + '>' + b);
      for (let c = 1; c < C; c++) for (const [k, v] of cols[c].entries()) { const prev = cols[c - 1]; let got = 0;
        for (const u of prev) if (r() < (cols[c].length === 1 ? 0.85 : 0.55)) { add(u, v); got++; }
        if (!got) add(pick(r, prev), v);
        if (c >= 2 && r() < 0.3) add(pick(r, cols[c - 2]), v);
        if (k > 0 && r() < 0.3) add(cols[c][k - 1], v); }
      for (let c = 0; c < C - 1; c++) for (const u of cols[c]) if (![...E].some(e => +e.split('>')[0] === u)) add(u, pick(r, cols[c + 1]));
      const edges = [...E].map(e => e.split('>').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]), colOf = v => cols.findIndex(col => col.includes(v));
      // Ребро через колонку изгибаем, чтобы не легло на город посередине.
      const bends = edges.map(([a, b]) => colOf(b) - colOf(a) >= 2 ? ((pts[a].y + pts[b].y) / 2 < H / 2 ? -60 : 60) : 0);
      return {pts, edges, bends};
    }
  }
  // «Волна»: N[v] — число путей из А в v. Через X: до X считаем обычные пути, после X — только из X и городов, достижимых из X.
  // Города, которые не ведут в X и не достижимы из X, в подсчёте не участвуют (null). Y зачёркнут: N[Y] = 0.
  function wave(edges, n, X, Y) {
    const reach = (s, fwd) => { const seen = new Set(), st = [s]; while (st.length) { const u = st.pop(); for (const [a, b] of edges) { const [x, y] = fwd ? [a, b] : [b, a]; if (x === u && !seen.has(y)) { seen.add(y); st.push(y); } } } return seen; };
    const R = X == null ? null : reach(X, true), anc = X == null ? null : reach(X, false), N = Array(n).fill(null);
    const active = v => X == null || v === X || R.has(v) || anc.has(v);
    for (let v = 0; v < n; v++) { if (!active(v)) continue; if (v === 0) { N[v] = 1; continue; } if (v === Y) { N[v] = 0; continue; }
      let s = 0; for (const [a, b] of edges) if (b === v && N[a] != null && (R && R.has(v) ? a === X || R.has(a) : true)) s += N[a]; N[v] = s; }
    return {N, R, anc};
  }

  /* ---------- уровни ---------- */
  const P_ = (key, title, kind, o) => ({key, title, kind, ...o});
  const L89 = [
    P_(1, 'Первая поездка', 'path', {n: 5, m: 7, view: 'map', brief: 'Длины дорог подписаны прямо на карте.'}),
    P_(2, 'Меньше дорог — не значит короче', 'path', {n: 6, m: 9, view: 'map', trap: true, hops: 3, brief: 'Маршрут с наименьшим числом дорог здесь не самый короткий.'}),
    P_(3, 'Карта и таблица', 'path', {n: 6, m: 9, view: 'table', trap: true, brief: 'Дороги нарисованы, а их длины — только в таблице.'}),
    P_(4, 'Только таблица', 'path', {n: 6, m: 9, view: 'blind', hops: 3, brief: 'Как в ОГЭ (задание 4): дорог на карте не видно, есть только таблица. Пустая клетка — дороги нет.'}),
    P_(5, 'Через пункт', 'path', {n: 7, m: 11, view: 'blind', via: true, brief: 'Маршрут обязательно должен пройти через отмеченный пункт.'}),
    P_(6, 'Сколько путей?', 'count', {n: 6, mode: 'plain', brief: 'Дороги с односторонним движением. Посчитай пути волной: город за городом.'}),
    P_(7, 'Волна по городам', 'count', {n: 8, mode: 'plain', brief: 'Число у города = сумма чисел у городов, из которых в него ведут стрелки.'}),
    P_(8, 'Объезд', 'count', {n: 8, mode: 'avoid', brief: 'Один город закрыт на ремонт — через него ехать нельзя.'}),
    P_(9, 'Через город', 'count', {n: 9, mode: 'via', least: 3, brief: 'Считаем только пути, которые проходят через отмеченный город.'}),
    P_(10, 'Карта без подписей', 'match', {n: 6, m: 7, wmax: 20, brief: 'Первое знакомство с заданием 1 ЕГЭ: номера в таблице не совпадают с буквами на схеме.'}),
  ];
  const L1011 = [
    P_(11, 'Разминка: кратчайший путь', 'path', {n: 7, m: 11, view: 'blind', trap: true, hops: 3, brief: 'Только таблица расстояний — дороги на карте скрыты.'}),
    P_(12, 'Через пункт', 'path', {n: 8, m: 12, view: 'blind', via: true, hops: 3, brief: 'Кратчайший маршрут, обязательно проходящий через отмеченный пункт.'}),
    P_(13, 'ЕГЭ 1: таблица и схема', 'match', {n: 6, m: 8, brief: 'Сопоставь номера пунктов в таблице с буквами на схеме.'}),
    P_(14, 'ЕГЭ 1: семь пунктов', 'match', {n: 7, m: 10, brief: 'Пунктов больше, степени повторяются — ищи соседей.'}),
    P_(15, 'ЕГЭ 1: сумма дорог', 'match', {n: 7, m: 10, ask: 2, brief: 'Нужна сумма длин двух дорог.'}),
    P_(16, 'ЕГЭ 13: число путей', 'count', {n: 9, mode: 'plain', min: 10, brief: 'Классическое задание 13: сколько путей ведёт из А в последний город.'}),
    P_(17, 'ЕГЭ 13: не проходя', 'count', {n: 10, mode: 'avoid', least: 5, min: 10, brief: 'Через зачёркнутый город проезжать нельзя.'}),
    P_(18, 'ЕГЭ 13: через город', 'count', {n: 10, mode: 'via', least: 4, min: 10, brief: 'Только пути, проходящие через отмеченный город: сначала волна до него, потом от него.'}),
    P_(19, 'ЕГЭ 13: через и не через', 'count', {n: 11, mode: 'viaAvoid', least: 4, min: 10, brief: 'Путь проходит через один город и не проходит через другой.'}),
    P_(20, 'ЕГЭ 1: восемь пунктов', 'match', {n: 8, m: 12, wmax: 40, brief: 'Самая большая схема — сначала найди пункты с уникальным числом дорог.'}),
  ];
  const cache = new Map();
  const make = (lv, seed) => { const k = lv.key + ':' + seed; if (!cache.has(k)) { if (cache.size > 400) cache.clear(); cache.set(k, GEN[lv.kind](lv, rng(seed * 7919 + lv.key * 131))); } return cache.get(k); };
  const starsBy = m => m === 0 ? 3 : m <= 2 ? 2 : 1;
  const viaText = P => P.X != null ? `, проходящего через пункт ${P.names[P.X]}` : '';
  function question(P, lv) {
    const N = P.names;
    if (P.kind === 'path') return `Между населёнными пунктами построены дороги, их протяжённость (в километрах) ${lv.view === 'map' ? 'подписана на карте' : 'указана в таблице'}. Определи длину кратчайшего пути из пункта ${N[P.S]} в пункт ${N[P.T]}${viaText(P)}. Передвигаться можно только по построенным дорогам.`;
    if (P.kind === 'count') return `На схеме — дороги между городами, по каждой можно ехать только по стрелке. Сколько существует различных путей из города ${N[0]} в город ${N[P.n - 1]}${P.X != null ? `, проходящих через город ${N[P.X]}` : ''}${P.Y != null ? `${P.X != null ? ' и' : ','} не проходящих через город ${N[P.Y]}` : ''}?`;
    const roads = P.ask.map(([a, b]) => `${P.names[a]}${P.names[b]}`);
    return `На схеме — дороги между пунктами, в таблице — их длины (в километрах). Номера пунктов в таблице никак не связаны с буквами на схеме. Определи ${roads.length > 1 ? `сумму длин дорог ${roads.join(' и ')}` : `длину дороги ${roads[0]}`}.`;
  }
  const HOW = {
    path: 'Щёлкай по городам по порядку — маршрут и его длина считаются сразу. Щелчок по последнему городу отменяет шаг. Когда доедешь до финиша, маршрут проверится.',
    count: 'Волна: у города А стоит 1. Для каждого следующего города впиши сумму чисел у городов, из которых в него ведут стрелки.',
    match: 'Шаг 1: для каждого номера П1, П2… выбери букву на схеме (подсказка — число дорог у пункта и его соседи). Шаг 2: когда всё совпадёт, длины появятся на схеме — ответь на вопрос.',
  };

  /* ---------- проверка ---------- */
  function check(lv, ans) {
    if (!ans || !Number.isInteger(ans.seed)) return {ok: false, msg: 'Нет ответа.'};
    const P = make(lv, ans.seed), N = P.names;
    if (P.kind === 'path') {
      let rt = ans.route; if (typeof rt === 'string') rt = [...rt.toUpperCase().replace(/[^А-ЯЁ]/g, '')].map(c => N.indexOf(c));
      if (!Array.isArray(rt) || rt.length < 2 || rt.some(v => !Number.isInteger(v) || v < 0 || v >= P.n)) return {ok: false, msg: 'Маршрут не построен.'};
      if (rt[0] !== P.S || rt[rt.length - 1] !== P.T) return {ok: false, msg: `Маршрут должен вести из ${N[P.S]} в ${N[P.T]}.`};
      if (new Set(rt).size !== rt.length) return {ok: false, msg: 'Город в маршруте встречается дважды.'};
      let len = 0; for (let k = 1; k < rt.length; k++) { const d = P.w[rt[k - 1]][rt[k]]; if (!d) return {ok: false, msg: `Между ${N[rt[k - 1]]} и ${N[rt[k]]} нет дороги.`}; len += d; }
      if (P.X != null && !rt.includes(P.X)) return {ok: false, msg: `Маршрут должен проходить через ${N[P.X]}.`};
      return len === P.best ? {ok: true, stars: 3, msg: `Кратчайший путь ${rt.map(v => N[v]).join('')} — ${len} км.`} : {ok: false, msg: `Этот маршрут — ${len} км, а есть короче. Попробуй другой.`};
    }
    if (P.kind === 'count') {
      if (Array.isArray(ans.counts)) { const c = ans.counts, num = x => x === '' || x == null ? NaN : Number(x);
        if (P.N.every((v, i) => v == null || i === 0 || num(c[i]) === v)) return {ok: true, stars: 3, msg: `Путей: ${P.answer}. Волна посчитана без ошибок.`};
        if (num(c[P.n - 1]) === P.answer) return {ok: true, stars: 2, msg: `Путей: ${P.answer}, но в промежуточных городах есть ошибки.`};
        return {ok: false, msg: 'Число путей не сходится.'}; }
      if (ans.answer != null) return Number(ans.answer) === P.answer ? {ok: true, stars: 2, msg: `Путей: ${P.answer}.`} : {ok: false, msg: 'Число путей не сходится.'};
      return {ok: false, msg: 'Нет ответа.'};
    }
    if (String(ans.length ?? '').trim() === '' || Number(ans.length) !== P.answer) return {ok: false, msg: 'Длина не та — проверь, какая клетка таблицы отвечает за эту дорогу.'};
    const okMap = Array.isArray(ans.map) && ans.map.length === P.n && ans.map.every((x, k) => (typeof x === 'number' ? N[x] : String(x).trim().toUpperCase()) === N[P.tv[k]]);
    return {ok: true, stars: okMap ? 3 : 2, msg: `Верно: ${P.answer} км.${okMap ? '' : ' Но таблица сопоставлена не полностью.'}`};
  }
  function solve(lv) {
    const P = make(lv, 1);
    if (P.kind === 'path') return {seed: 1, route: P.route.slice()};
    if (P.kind === 'count') return {seed: 1, counts: P.N.slice()};
    return {seed: 1, map: P.tv.map(v => P.names[v]), length: P.answer};
  }

  /* ---------- оформление ---------- */
  const CSS = `
#lab .gr-cols{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px;align-items:start}
@media(max-width:900px){#lab .gr-cols{grid-template-columns:1fr}}
#lab .gr-map{display:block;width:100%;height:auto;max-height:min(62vh,540px);background:radial-gradient(circle at 30% 20%,#1a2a4d,#0f1730 70%);border:1px solid #2c3a5e;border-radius:12px;touch-action:manipulation;user-select:none}
#lab .gr-edge{stroke:#4b5f8f;stroke-width:4;stroke-linecap:round;fill:none}
#lab .gr-edge.on{stroke:#ffd34d;stroke-width:7}
#lab .gr-edge.into{stroke:#7fe3c8;stroke-width:5}
#lab .gr-edge.dead{stroke:#34405f;stroke-dasharray:7 7}
#lab .gr-edge.ask{stroke:#ff8a5c;stroke-width:6}
#lab .gr-w circle{fill:#0f1730;stroke:#5a6f9f;stroke-width:2}#lab .gr-w text{fill:#ffe08a;font-size:15px;font-weight:800;text-anchor:middle}
#lab .gr-node{cursor:pointer;outline:none}#lab .gr-node circle{fill:#243253;stroke:#8fa6d6;stroke-width:3;transition:fill .15s}
#lab .gr-node text{fill:#fff;font-weight:800;font-size:19px;text-anchor:middle;pointer-events:none}
#lab .gr-node:hover circle,#lab .gr-node:focus-visible circle{stroke:#ffd34d;stroke-width:4}
#lab .gr-node.end circle{stroke:#ff8a5c;stroke-width:4}#lab .gr-node.via circle{stroke:#c58cff;stroke-width:5}
#lab .gr-node.next circle{stroke:#ffd34d;stroke-dasharray:6 4}
#lab .gr-node.on circle{fill:#1f5a3f;stroke:#7fe3c8}
#lab .gr-node.me circle{fill:#6a5413;stroke:#ffd34d;stroke-width:5}
#lab .gr-node.off{opacity:.33;cursor:default}
#lab .gr-node.ban circle{fill:#4a1f2a;stroke:#ff6b6b}#lab .gr-ban{stroke:#ff6b6b;stroke-width:4;stroke-linecap:round}
#lab .gr-badge{fill:#ffe08a;font-size:17px;font-weight:800;text-anchor:middle;paint-order:stroke;stroke:#0f1730;stroke-width:4px}
#lab .gr-badge.q{fill:#6f7fa6}#lab .gr-tag{fill:#7fe3c8;font-size:14px;font-weight:800;paint-order:stroke;stroke:#0f1730;stroke-width:4px}#lab .gr-tag.dup{fill:#ff9a9a}
#lab .gr-route{font-size:18px;font-weight:800;color:#ffe08a;margin:6px 0;min-height:26px}
#lab .gr-twrap{overflow-x:auto;margin:6px 0 10px}
#lab .gr-table{border-collapse:collapse;font-size:15px}
#lab .gr-table th,#lab .gr-table td{border:1px solid #33466e;min-width:34px;height:32px;text-align:center;padding:2px 6px}
#lab .gr-table th{background:#202c4f;color:#9fe8ff}#lab .gr-table td.gr-diag{background:#10172c}
#lab .gr-table td.on{background:#6a5413;color:#ffe08a;font-weight:800}#lab .gr-table th.on{background:#2d5a48;color:#fff}
#lab .gr-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
#lab .gr-sel{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;margin:8px 0}
#lab .gr-sel label{display:flex;gap:6px;align-items:center;justify-content:space-between;background:#121b33;border:1px solid #33466e;border-radius:10px;padding:4px 8px;font-weight:800;color:#9fe8ff}
#lab .gr-sel label.good{border-color:#3fba74}#lab .gr-sel select{padding:4px 6px}
#lab .gr-wave{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
#lab .gr-wave span{background:#121b33;border:1px solid #33466e;border-radius:8px;padding:3px 9px;font-weight:700}
#lab .gr-wave span.on{border-color:#3fba74;color:#7fe3c8}#lab .gr-wave span.me{border-color:#ffd34d;color:#ffe08a}#lab .gr-wave span.off{opacity:.4}
#lab .gr-ask{font-size:17px;font-weight:700;margin:6px 0}#lab .gr-phase{color:#c58cff;font-weight:700;margin:4px 0}
#lab .gr-in{width:120px}
#lab .gr-legend{font-size:13px;color:#9fb2d6;margin:6px 0 0}
@media(max-width:600px){#lab .gr-table{font-size:13px}#lab .gr-table th,#lab .gr-table td{min-width:26px;height:28px;padding:1px 3px}}
`;
  const style = () => { if (typeof document === 'undefined' || document.getElementById('gr-style')) return; const s = document.createElement('style'); s.id = 'gr-style'; s.textContent = CSS; document.head.append(s); };
  const NS = 'http://www.w3.org/2000/svg', sv = (t, a, x) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); if (x != null) n.textContent = x; return n; };
  const markers = () => { const d = sv('defs', {}); for (const [id, c] of [['gr-a', '#6f86b8'], ['gr-a-into', '#7fe3c8'], ['gr-a-dead', '#34405f']]) { const m = sv('marker', {id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 16, markerHeight: 16, markerUnits: 'userSpaceOnUse', orient: 'auto'}); m.append(sv('path', {d: 'M0,0 L10,5 L0,10 z', fill: c})); d.append(m); } return d; };
  const weightTag = (p, q, txt, bend = 0) => { const [mx, my] = mid(p, q, bend), g = sv('g', {class: 'gr-w'}); g.append(sv('circle', {cx: mx, cy: my, r: 14}), sv('text', {x: mx, y: my + 5}, String(txt))); return g; };
  const ctrl = (p, q, bend) => { const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1; return {x: (p.x + q.x) / 2 - dy / L * bend, y: (p.y + q.y) / 2 + dx / L * bend}; };
  const mid = (p, q, bend) => { const c = ctrl(p, q, bend); return [Math.round((p.x + 2 * c.x + q.x) / 4), Math.round((p.y + 2 * c.y + q.y) / 4)]; };
  // Стрелка от края кружка до края кружка (у вершин радиус 21).
  const arrowPath = (p, q, bend) => { const c = ctrl(p, q, bend), u = (a, b, k) => { const L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return {x: a.x + (b.x - a.x) / L * k, y: a.y + (b.y - a.y) / L * k}; }, s = u(p, c, 22), e = u(q, c, 24);
    return `M${s.x.toFixed(1)},${s.y.toFixed(1)} Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${e.x.toFixed(1)},${e.y.toFixed(1)}`; };
  function nodeEl(p, name, cls, onPick, label) {
    const g = sv('g', {class: 'gr-node ' + cls, tabindex: onPick ? 0 : -1, role: onPick ? 'button' : 'img', 'aria-label': label || name});
    g.append(sv('circle', {cx: p.x, cy: p.y, r: 21}), sv('text', {x: p.x, y: p.y + 7}, name));
    if (onPick) { g.addEventListener('click', onPick); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } }); }
    return g;
  }
  function table(el, heads, val) {
    const t = el('table', 'gr-table'), hr = el('tr'); hr.append(el('th', '', '')); heads.forEach(h => hr.append(el('th', '', h))); t.append(hr);
    heads.forEach((h, i) => { const row = el('tr'); row.append(el('th', '', h)); heads.forEach((_, j) => { const td = el('td', i === j ? 'gr-diag' : '', i === j ? '' : val(i, j)); td.dataset.i = i; td.dataset.j = j; row.append(td); }); t.append(row); });
    const wrap = el('div', 'gr-twrap'); wrap.append(t); return wrap;
  }

  /* ---------- игра ---------- */
  function mount(host, lv, api) {
    style();
    const {el, button} = api, seed = Math.floor(Math.random() * 1e6), P = make(lv, seed), N = P.names; let mistakes = 0, done = false;
    const task = el('div', 'lab-task'), cols = el('div', 'gr-cols'), left = el('div', 'lab-panel'), right = el('div', 'lab-panel'), msg = el('p', 'lab-msg'), svg = sv('svg', {viewBox: `0 0 ${W} ${H}`, class: 'gr-map', role: 'group', 'aria-label': 'Карта дорог'});
    task.append(el('h2', '', lv.title), el('p', '', lv.brief), el('p', '', question(P, lv)), el('p', 'lab-note', HOW[P.kind]));
    const say = (t, cls = '') => { msg.textContent = t; msg.className = 'lab-msg ' + cls; };
    const win = r => { done = true; api.finish(Math.min(r.stars, starsBy(mistakes)), r.msg + (mistakes ? ` Ошибок: ${mistakes}.` : '')); };
    const submit = ans => { if (done) return null; const r = check(lv, ans); if (r.ok) win(r); else { mistakes++; say(r.msg, 'bad'); } return r; };
    left.append(svg); cols.append(left, right); host.append(task, cols);

    if (P.kind === 'path') {
      let route = [P.S]; const info = el('p', 'gr-route'), tw = lv.view === 'map' ? null : table(el, N, (i, j) => P.w[i][j] || '');
      const lenOf = rt => rt.slice(1).reduce((s, v, k) => s + P.w[rt[k]][v], 0);
      const draw = () => {
        const last = route[route.length - 1], on = new Set(route.slice(1).map((v, k) => key(route[k], v))); svg.replaceChildren();
        for (const [a, b] of P.edges) { const hit = on.has(key(a, b)); if (lv.view === 'blind' && !hit) continue; svg.append(sv('line', {x1: P.pts[a].x, y1: P.pts[a].y, x2: P.pts[b].x, y2: P.pts[b].y, class: 'gr-edge' + (hit ? ' on' : '')})); }
        for (const [a, b] of P.edges) if (lv.view === 'map' || on.has(key(a, b))) svg.append(weightTag(P.pts[a], P.pts[b], P.w[a][b]));
        P.pts.forEach((p, i) => { const cls = [route.includes(i) && 'on', i === last && 'me', i === P.T && 'end', i === P.X && 'via', lv.view !== 'blind' && P.w[last][i] && !route.includes(i) && 'next'].filter(Boolean).join(' ');
          svg.append(nodeEl(p, N[i], cls, () => pickNode(i), `Пункт ${N[i]}${i === P.T ? ', финиш' : ''}${i === P.X ? ', обязательный' : ''}`)); });
        info.textContent = `Маршрут: ${route.map(v => N[v]).join(' → ')} · ${lenOf(route)} км`;
        if (tw) tw.querySelectorAll('td').forEach(td => td.classList.toggle('on', on.has(key(+td.dataset.i, +td.dataset.j))));
      };
      const pickNode = i => { if (done) return; const last = route[route.length - 1];
        if (i === last) { if (route.length > 1) { route.pop(); say(''); draw(); } return; }
        if (route.includes(i)) { say(`В пункте ${N[i]} ты уже был — города в маршруте не повторяются. Шагни назад.`, 'bad'); return; }
        if (!P.w[last][i]) { say(`Из ${N[last]} в ${N[i]} дороги нет${lv.view !== 'map' ? ' — в таблице эта клетка пустая' : ''}.`, 'bad'); return; }
        route.push(i); say(''); draw(); if (i === P.T) { const r = submit({seed, route: route.slice()}); if (r && !r.ok) say(r.msg + ' Шагни назад или сбрось маршрут.', 'bad'); } };
      const bar = el('div', 'gr-bar'); bar.append(button('↶ Шаг назад', 'lab-small', () => { if (route.length > 1 && !done) { route.pop(); say(''); draw(); } }), button('Сбросить', 'lab-small', () => { if (!done) { route = [P.S]; say(''); draw(); } }));
      right.append(el('h3', '', lv.view === 'map' ? 'Твой маршрут' : 'Таблица расстояний, км'));
      if (tw) right.append(tw);
      right.append(info, bar, msg, el('p', 'gr-legend', `Старт — ${N[P.S]}, финиш — ${N[P.T]} (оранжевый)${P.X != null ? `, обязательный пункт ${N[P.X]} (фиолетовый)` : ''}. Пунктир — куда можно поехать.`));
      draw();
    } else if (P.kind === 'count') {
      const vals = P.N.map((v, i) => i === 0 ? 1 : i === P.Y ? 0 : null), order = range(P.n).filter(i => i > 0 && P.N[i] != null && i !== P.Y), wv = wave(P.edges, P.n, P.X, P.Y); let k = 0;
      const cur = () => order[k], phase2 = v => P.X != null && wv.R.has(v), counted = (a, b) => P.N[a] != null && P.N[b] != null && (phase2(b) ? a === P.X || wv.R.has(a) : true);
      const inp = el('input', 'gr-in'); inp.type = 'number'; inp.min = 0; inp.inputMode = 'numeric'; inp.setAttribute('aria-label', 'Число путей');
      const ask = el('p', 'gr-ask'), ph = el('p', 'gr-phase'), chips = el('div', 'gr-wave'), form = el('form', 'gr-bar'), go = button('Записать', 'lab-main', () => form.requestSubmit()); go.dataset.act = 'run';
      form.append(ask, inp, go);
      const draw = () => { svg.replaceChildren(markers()); const c = cur();
        P.edges.forEach(([a, b], i) => { const into = b === c && !done, dead = !counted(a, b) || a === P.Y, cls = into ? 'into' : dead ? 'dead' : '';
          svg.append(sv('path', {d: arrowPath(P.pts[a], P.pts[b], P.bends[i]), class: 'gr-edge ' + cls, 'marker-end': `url(#gr-a${cls ? '-' + cls : ''})`})); });
        P.pts.forEach((p, i) => { const off = P.N[i] == null, cls = [off && 'off', i === P.Y && 'ban', i === P.X && 'via', i === P.n - 1 && 'end', i === c && !done && 'me', vals[i] != null && i !== P.Y && 'on'].filter(Boolean).join(' ');
          svg.append(nodeEl(p, N[i], cls, null, `Город ${N[i]}`));
          if (i === P.Y) svg.append(sv('line', {x1: p.x - 15, y1: p.y - 15, x2: p.x + 15, y2: p.y + 15, class: 'gr-ban'}), sv('line', {x1: p.x + 15, y1: p.y - 15, x2: p.x - 15, y2: p.y + 15, class: 'gr-ban'}));
          const up = p.y > 70; svg.append(sv('text', {x: p.x, y: up ? p.y - 30 : p.y + 44, class: 'gr-badge' + (vals[i] == null ? ' q' : '')}, off ? '' : vals[i] == null ? '?' : String(vals[i]))); });
        chips.replaceChildren(...range(P.n).map(i => el('span', P.N[i] == null ? 'off' : i === c && !done ? 'me' : vals[i] != null ? 'on' : '', `${N[i]}: ${P.N[i] == null ? '—' : vals[i] ?? '?'}`)));
        if (done || c == null) { form.hidden = true; ph.textContent = ''; return; }
        ask.textContent = `Сколько путей ведёт в ${N[c]}?`;
        ph.textContent = P.X == null ? '' : c < P.X ? `Этап 1: волна из ${N[0]} до ${N[P.X]}.` : c === P.X ? `Город ${N[P.X]} — конец первого этапа.` : `Этап 2: от ${N[P.X]} дальше — учитываем только ${N[P.X]} и города после него.`; };
      form.addEventListener('submit', e => { e.preventDefault(); if (done) return; const c = cur(), x = inp.value.trim(); if (x === '') return;
        if (Number(x) === P.N[c]) { vals[c] = P.N[c]; k++; inp.value = ''; say(`${N[c]}: ${P.N[c]} — верно.`, 'good'); if (k >= order.length) { const r = submit({seed, counts: vals.slice()}); if (r && r.ok) { draw(); return; } } draw(); inp.focus(); return; }
        mistakes++; say(`Не так. Сложи числа у городов, из которых стрелки ведут в ${N[c]}${phase2(c) ? ` — но только у ${N[P.X]} и городов, до которых можно доехать из ${N[P.X]}` : ''}${P.Y != null ? `; у зачёркнутого ${N[P.Y]} стоит 0` : ''}.`, 'bad'); });
      right.append(el('h3', '', 'Волна'), ph, form, msg, chips, el('p', 'gr-legend', `Зелёные стрелки входят в текущий город.${P.X != null ? ` Фиолетовый — город ${N[P.X]}, через который обязательно проехать; бледные города в подсчёте не участвуют.` : ''}${P.Y != null ? ` Красный крест — город ${N[P.Y]}, через который ехать нельзя.` : ''}`));
      draw(); setTimeout(() => inp.focus(), 50);
    } else {
      const map = Array(P.n).fill(''), heads = range(P.n).map(k => 'П' + (k + 1)), letters = N.slice().sort(), tw = table(el, heads, (i, j) => P.w[P.tv[i]][P.tv[j]] || ''); let solved = false;
      const sel = el('div', 'gr-sel'), labels = heads.map((h, k) => { const lab = el('label', '', h), s = el('select'); s.setAttribute('aria-label', `Буква для ${h}`); s.append(new Option('?', ''), ...letters.map(c => new Option(c, c)));
        s.addEventListener('change', () => { map[k] = s.value; draw(); }); lab.append(s); sel.append(lab); return lab; });
      const askSet = new Set(P.ask.map(([a, b]) => key(a, b))), q = el('form', 'gr-bar'), inp = el('input', 'gr-in'); inp.type = 'number'; inp.inputMode = 'numeric'; inp.setAttribute('aria-label', 'Длина'); q.hidden = true;
      const draw = () => { svg.replaceChildren(); const count = {}; map.forEach(c => { if (c) count[c] = (count[c] || 0) + 1; });
        for (const [a, b] of P.edges) svg.append(sv('line', {x1: P.pts[a].x, y1: P.pts[a].y, x2: P.pts[b].x, y2: P.pts[b].y, class: 'gr-edge' + (solved && askSet.has(key(a, b)) ? ' ask' : '')}));
        if (solved) for (const [a, b] of P.edges) svg.append(weightTag(P.pts[a], P.pts[b], P.w[a][b]));
        P.pts.forEach((p, i) => { svg.append(nodeEl(p, N[i], solved ? 'on' : '', null, `Пункт ${N[i]}`)); const tags = map.map((c, k) => c === N[i] ? 'П' + (k + 1) : '').filter(Boolean);
          if (tags.length) svg.append(sv('text', {x: p.x + 24, y: p.y - 18, class: 'gr-tag' + (tags.length > 1 ? ' dup' : '')}, tags.join(','))); }); };
      const verify = button('Сверить сопоставление', 'lab-main', () => { if (done || solved) return; if (map.some(c => !c)) { say('Выбери букву для каждого номера.', 'bad'); return; }
        const good = map.filter((c, k) => c === N[P.tv[k]]).length;
        if (good === P.n) { solved = true; labels.forEach(l => { l.classList.add('good'); l.querySelector('select').disabled = true; }); verify.hidden = true; q.hidden = false; say('Таблица и схема совпали! Длины дорог теперь на схеме.', 'good'); draw(); inp.focus(); return; }
        mistakes++; say(`Верно сопоставлено: ${good} из ${P.n}. Сравни число дорог у пунктов (непустые клетки в строке) и их соседей.`, 'bad'); });
      verify.dataset.act = 'run';
      q.append(el('span', 'gr-ask', P.ask.length > 1 ? `Сумма ${P.ask.map(([a, b]) => N[a] + N[b]).join(' + ')} =` : `Длина ${N[P.ask[0][0]]}${N[P.ask[0][1]]} =`), inp, button('Ответить', 'lab-main', () => q.requestSubmit()));
      q.addEventListener('submit', e => { e.preventDefault(); if (inp.value.trim() === '') return; const r = submit({seed, map: map.slice(), length: inp.value}); if (r && !r.ok) say(r.msg, 'bad'); });
      right.append(el('h3', '', 'Таблица (км)'), tw, el('h3', '', 'Номер → буква'), sel, verify, q, msg);
      draw();
    }
    if (api.debugHost) window.labSet = a => { if (done) return; const ans = Object.assign({seed}, a || {}); const r = check(lv, ans); if (r.ok) win(r); else say(r.msg, 'bad'); };
  }

  LAB.register({id: 'graphs', bg: 'bg_ipnet', title: 'Карта дорог', genre: 'графы и маршруты', art: '🗺️', color: '#ffb35c', unit: 'Карта', minutes: 40,
    about: 'Прокладывай кратчайшие маршруты по таблице расстояний, сопоставляй таблицу со схемой дорог и считай пути волной — задания 4 ОГЭ, 1 и 13 ЕГЭ на живой карте.',
    levels: grade => grade >= 10 ? L1011 : L89, mount, check, solve, make, wave, LEVELS: L89.concat(L1011)});
})();
