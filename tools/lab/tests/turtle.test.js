// Проверка игры «Черепаха» без браузера: node tools/lab/tests/turtle.test.js
// Образцы проходят на три звезды, неверные программы отклоняются, равносильные засчитываются,
// число точек внутри фигур сходится с независимым перебором, бесконечные циклы останавливаются.
const path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); require(path.join(dir, 'games', 'turtle.js'));
const g = LAB.games.find(x => x.id === 'turtle');
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };

// Независимый исполнитель для программ уровней: строки «for v in range(N):» и команды с числом в скобках.
function sim(code) {
  const rows = code.split('\n').filter(s => s.trim()).map(s => ({ind: s.length - s.trimStart().length, text: s.trim()}));
  const cmds = []; const walk = (from, ind, out) => { let i = from; while (i < rows.length && rows[i].ind >= ind) { const r = rows[i], m = r.text.match(/^for \w+ in range\((\d+)\):$/);
      if (m) { const body = []; i = walk(i + 1, rows[i + 1].ind, body); for (let k = 0; k < +m[1]; k++) out.push(...body); continue; }
      const c = r.text.match(/^(\w+)\(([-\d.]*)\)$/); if (!c) throw new Error('sim: ' + r.text); out.push([c[1], c[2] === '' ? 0 : +c[2]]); i++; } return i; };
  walk(0, 0, cmds);
  let x = 0, y = 0, h = Math.PI / 2, pen = true, cur = null; const segs = [], strokes = [];
  for (const [c, v] of cmds) {
    if (c === 'forward' || c === 'back') { const d = c === 'back' ? -v : v, nx = x + d * Math.cos(h), ny = y + d * Math.sin(h); if (pen) { segs.push([x, y, nx, ny]); if (!cur) strokes.push(cur = [[x, y]]); cur.push([nx, ny]); } x = nx; y = ny; }
    else if (c === 'right') h -= v * Math.PI / 180; else if (c === 'left') h += v * Math.PI / 180;
    else if (c === 'penup') { pen = false; cur = null; } else if (c === 'pendown') pen = true; else throw new Error('sim: ' + c); }
  return {segs, cmds, polys: strokes.filter(s => s.length > 3 && Math.hypot(s[0][0] - s[s.length - 1][0], s[0][1] - s[s.length - 1][1]) < 1e-6)};
}
// Перебор точек: на линии — расстояние до отрезка, внутри — луч вправо (чётность пересечений).
function brute(code, op, edges) {
  const {segs, polys} = sim(code), dist = (px, py, [x1, y1, x2, y2]) => { const dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(x1 + t * dx - px, y1 + t * dy - py); };
  const inPoly = (px, py, p) => { let c = false; for (let i = 0, j = p.length - 2; i < p.length - 1; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
  const pedges = polys.map(p => p.slice(1).map((q, i) => [p[i][0], p[i][1], q[0], q[1]]));
  const xs = segs.flatMap(s => [s[0], s[2]]), ys = segs.flatMap(s => [s[1], s[3]]);
  let n = 0; for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.max(...xs) + 1; x++) for (let y = Math.floor(Math.min(...ys)) - 1; y <= Math.max(...ys) + 1; y++) {
    const line = segs.some(s => dist(x, y, s) < 1e-6); if (!edges && line) continue;
    const ins = polys.map((p, i) => inPoly(x, y, p) || (edges && pedges[i].some(s => dist(x, y, s) < 1e-6)));
    if (op === 'and' ? ins.every(Boolean) : ins.some(Boolean)) n++; }
  return n;
}
const unroll = code => sim(code).cmds.map(([c, v]) => c === 'penup' || c === 'pendown' ? c + '()' : `${c}(${v})`).join('\n');

const levels = {base: g.levels(9), hard: g.levels(11)};
check('по 8 уровней для 6–9 и 10–11 классов, все четыре вида заданий', [6, 7, 8, 9, 10, 11].every(k => g.levels(k).length === 8) && ['draw', 'count', 'fix', 'short'].every(k => levels.base.some(l => l.kind === k) && levels.hard.some(l => l.kind === k)));

for (const grade of [9, 10, 11]) { let ok = true, info = '';
  for (const [i, lv] of g.levels(grade).entries()) for (let s = 1; s <= 40; s++) { const t = g.task(lv, s), r = g.check(lv, lv.kind === 'count' ? {seed: s, answer: t.answer} : {seed: s, code: t.code}); if (!r.ok || r.stars !== 3) { ok = false; info = `уровень ${i + 1}, зерно ${s}: ${r.msg}`; } }
  check(`${grade} класс: образцовые программы и ответы дают три звезды (40 вариантов каждого уровня)`, ok, info); }

{ let ok = true, info = '';
  for (const [name, list] of Object.entries(levels)) for (const [i, lv] of list.entries()) for (let s = 1; s <= 30; s++) { const t = g.task(lv, s), w = `${name} ${i + 1}, зерно ${s}`;
    if (lv.kind === 'count') { for (const a of [t.answer + 1, t.answer - 1, '', 'много']) if (g.check(lv, {seed: s, answer: a}).ok) { ok = false; info = `${w}: принят ответ ${a}`; } continue; }
    for (const c of ['', 'forward(1)', 'penup()\n' + t.code, 'for i in range(4):\n    forward(1)\n    right(90)']) if (g.check(lv, {seed: s, code: c}).ok) { ok = false; info = `${w}: принята программа ${JSON.stringify(c)}`; }
    if (lv.kind === 'fix' && g.check(lv, {seed: s, code: t.start}).ok) { ok = false; info = `${w}: испорченная программа уже проходит`; }
    if (lv.kind === 'fix' && t.start === t.code) { ok = false; info = `${w}: нет ошибки`; } }
  check('неверные программы, ответы ±1 и нетронутые «исправь» не проходят', ok, info); }

{ let ok = true, info = '';
  for (const [name, list] of Object.entries(levels)) for (const [i, lv] of list.entries()) { if (lv.kind === 'count') continue;
    for (let s = 1; s <= 20; s++) { const t = g.task(lv, s), flat = unroll(t.code), r = g.check(lv, {seed: s, code: flat}), w = `${name} ${i + 1}, зерно ${s}`;
      if (!r.ok) { ok = false; info = `${w}: развёрнутая программа не принята — ${r.msg}`; }
      if (lv.kind === 'short' && r.ok && g.codeLines(flat) > t.par + 2 && r.stars !== 1) { ok = false; info = `${w}: длинная программа получила ${r.stars} звезды`; }
      // Обход по тем же линиям второй раз и русские команды рисуют то же самое.
      const ru = t.code.replace(/forward/g, 'вперёд').replace(/right/g, 'направо').replace(/left/g, 'налево').replace(/penup/g, 'поднять_хвост').replace(/pendown/g, 'опустить_хвост');
      if (!g.check(lv, {seed: s, code: ru}).ok) { ok = false; info = `${w}: русские команды не приняты`; }
      if (!g.check(lv, {seed: s, code: 'import turtle\nt = turtle.Turtle()\n' + t.code.replace(/^(\s*)(forward|back|right|left|penup|pendown)\(/gm, '$1t.$2(') + '\nturtle.done()'}).ok) { ok = false; info = `${w}: вариант с import turtle не принят`; }
      if (lv.kind === 'draw' || lv.title === 'Шестиугольник' || lv.title === 'Звезда') { const twice = g.check(lv, {seed: s, code: t.code + '\n' + t.code}); if (!twice.ok) { ok = false; info = `${w}: повторный обход не принят`; } } } }
  // Обход в другую сторону: квадрат и прямоугольник, нарисованные против хода исходной программы.
  const sq = levels.base[0], rc = levels.base[1];
  for (let s = 1; s <= 20; s++) { const t = g.task(sq, s), a = +t.code.match(/forward\((\d+)\)/)[1], dir = /right/.test(t.code) ? ['right', 'left'] : ['left', 'right'];
    if (!g.check(sq, {seed: s, code: `${dir[0]}(90)\nfor i in range(4):\n    forward(${a})\n    ${dir[1]}(90)`}).ok) { ok = false; info = `квадрат ${s}: обратный обход не принят`; }
    const u = g.task(rc, s), [, p, q] = u.code.match(/forward\((\d+)\)[\s\S]*?forward\((\d+)\)/), d2 = /right/.test(u.code) ? ['right', 'left'] : ['left', 'right'];
    if (!g.check(rc, {seed: s, code: `${d2[0]}(90)\nforward(${q})\n${d2[1]}(90)\nforward(${p})\n${d2[1]}(90)\nforward(${q})\n${d2[1]}(90)\nforward(${p})`}).ok) { ok = false; info = `прямоугольник ${s}: обратный обход не принят`; } }
  check('равносильные программы засчитываются: без циклов, по-русски, через import turtle, повторный и обратный обход', ok, info); }

{ let ok = true, info = '', n = 0; const seen = {};
  for (const [name, list] of Object.entries(levels)) for (const [i, lv] of list.entries()) { if (lv.kind !== 'count') continue; seen[name + i] = new Set();
    for (let s = 1; s <= 150; s++) { const t = g.task(lv, s), b = brute(t.code, t.op || 'or', !!t.edges); n++; seen[name + i].add(t.answer);
      if (b !== t.answer || t.answer <= 0) { ok = false; info = `${name} ${i + 1} «${lv.title}», зерно ${s}: игра ${t.answer}, перебор ${b}`; }
      if (lv.title === 'Точки внутри') { const [a, c] = [...t.code.matchAll(/forward\((\d+)\)/g)].map(m => +m[1]); if (t.answer !== (a - 1) * (c - 1)) { ok = false; info = `прямоугольник ${s}`; } } } }
  const varied = Object.values(seen).every(x => x.size >= 5);
  check(`точки внутри фигур сходятся с независимым перебором (${n} вариантов, объединения и пересечения), ответы разнообразны`, ok && varied, info || (varied ? '' : 'мало разных ответов')); }

{ const lv = levels.base[0], t0 = Date.now(); const msgs = ['while True:\n    forward(1)\n    right(90)', 'while True:\n    pass', 'for i in range(10000):\n    for j in range(10000):\n        left(1)', 'x = 0\nwhile x < 10:\n    forward(1)'].map(c => g.check(lv, {seed: 1, code: c}));
  check('бесконечные циклы останавливаются с понятным сообщением', msgs.every(r => !r.ok && /долго|цикл|команд|далеко/.test(r.msg)) && Date.now() - t0 < 5000, msgs.map(r => r.msg).join(' | ')); }

{ const lv = levels.base[0]; const e1 = g.check(lv, {seed: 1, code: 'forward(3'}).msg, e2 = g.check(lv, {seed: 1, code: 'penup'}).msg, e3 = g.check(lv, {seed: 1, code: 'forward()'}).msg, e4 = g.check(lv, {seed: 1, code: 'forward(1000)'}).msg;
  check('ошибки сообщаются по-русски, с номером строки и без упоминаний героя', /строка 1/.test(e1) && /скобки: penup\(\)/.test(e2) && /forward\(5\)/.test(e3) && /далеко/.test(e4) && ![e1, e2, e3, e4].some(m => /hero|герой/.test(m)), [e1, e2, e3, e4].join(' | ')); }

{ const lv = levels.hard[7], t = g.task(lv, 3), flat = unroll(t.code), r = g.check(lv, {seed: 3, code: flat});
  check('звезда: развёрнутая программа засчитана на одну звезду, образец — на три', r.ok && r.stars === 1 && g.check(lv, {seed: 3, code: t.code}).stars === 3, JSON.stringify(r)); }

console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
