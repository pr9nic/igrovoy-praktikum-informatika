// Проверка логики «Кодоблокса» без браузера: node tools/lab/tests/blocks.test.js
const path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); require(path.join(dir, 'games', 'runner.js')); require(path.join(dir, 'games', 'blocks.js'));
const g = LAB.games.find(x => x.id === 'blocks'), L = g.lib;
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };
for (const grade of [6, 7, 8, 9, 10, 11]) { const lv = g.levels(grade); check(`${grade} класс: 8 миров (4 обби, 4 студии), образцы — три звезды`, lv.length === 8 && lv.filter(l => l.kind === 'studio').length === 4 && lv.every(l => { const r = g.check(l, g.solve(l)); return r.ok && r.stars === 3; })); }
const studio = n => g.levels(8).find(l => l.kind === 'studio' && l.n === n);
// Студия: неверные программы ловятся с понятной причиной.
const cases = [[2, 'for x in range(6, 11):\n    place(x, 0)', /пропасть/], [2, 'place(30, 0)', /вне зоны/], [6, 'for x in range(4, 16):\n    place(x, 1)', /занята/], [4, 'for x in range(5, 10):\n    place(x, 1)', /стену/],
  [8, 'for x in range(4, 9):\n    place(x, 0)', /стену/], [2, 'while True:\n    pass', /./], [2, '', /программ/]];
for (const [n, code, why] of cases) { const r = g.check(studio(n), {code}); check(`студия ${n}: «${code.split('\n')[0].slice(0, 30)}…» не проходит`, !r.ok && why.test(r.msg), r.msg); }
// Другие верные программы тоже засчитываются, но лишние блоки снижают звёзды.
{ const r = g.check(studio(2), {code: 'place(6, 0)\nplace(7, 0)\nplace(8, 0)\nplace(9, 0)\nplace(10, 0)\nplace(11, 0)'}); check('мост без цикла тоже работает (3 звезды по числу блоков)', r.ok && r.stars === 3); }
{ const r = g.check(studio(8), {code: 'for x in range(4, 9):\n    place(x, 0)\nfor x in range(9, 13):\n    for y in range(1, x - 7):\n        place(x, y)'}); check('лишние блоки в финальной стройке — меньше звёзд', r.ok && r.stars < 3, r.msg); }
// Ходьба героя.
{ const m = L.studioMap(6), w = L.walk(m.g, m.start); check('без моста герой падает в лаву', !w.ok && /лав/.test(w.why), w.why); }
// Обби: итог забега.
const obby = g.levels(8)[0];
check('обби: без флага не засчитано, звёзды за падения и ошибки', !g.check(obby, {reached: false, deaths: 0, wrong: 0}).ok && g.check(obby, {reached: true, deaths: 1, wrong: 1}).stars === 2 && g.check(obby, {reached: true, deaths: 3, wrong: 1}).stars === 1);
// Карты обби: старт на земле, финиш есть, точки-вопросы перекрыты стеной до ответа.
for (const n of [1, 3, 5, 7]) { const M = L.obbyMap(n), G = M.g, [sx, sy] = M.start, flag = G.some(r => r.includes('F'));
  const qs = []; G.forEach((r, y) => r.forEach((c, x) => { if (c === 'Q') qs.push([x, y]); }));
  check(`обби ${n}: старт на земле, есть флаг, за каждым вопросом — стена выше прыжка`, flag && ['#', 'W'].includes(G[sy - 1][sx]) && qs.every(([x]) => [1, 2, 3, 4, 5].every(y => G[y][x + 1] === 'X')), JSON.stringify(qs)); }
console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
