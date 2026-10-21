// Проверка логики «Байт-бласта» без браузера: node tools/lab/tests/blast.test.js
const path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); require(path.join(dir, 'games', 'blast.js'));
const g = LAB.games.find(x => x.id === 'blast'), L = g.lib;
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };
check('числа в разных системах записываются верно', L.fmt(13, 2) === '1101₂' && L.fmt(255, 16) === 'FF₁₆' && L.fmt(64, 8) === '100₈' && L.fmt(7, 10) === '7');
for (const grade of [6, 7, 8, 9, 10, 11]) {
  let ok = true, info = '';
  g.levels(grade).forEach((lv, i) => { const r = g.check(lv, g.solve(lv, grade), grade); if (!r.ok || r.stars !== 3) { ok = false; info = `уровень ${i + 1}: ${r.msg}`; } });
  check(`${grade} класс: 10 уровней, образцовые решения проходят на три звезды`, ok && g.levels(grade).length === 10, info);
}
// Системы счисления по классам.
const sys = gr => [...new Set(g.levels(gr).flatMap(l => l.labels))].sort((a, b) => a - b).join(',');
check('системы по классам: 6–7 — двоичная, 8 — +восьмеричная, 9–11 — +шестнадцатеричная', sys(6) === '2' && sys(7) === '2' && sys(8) === '2,8' && sys(9) === '2,8,16' && sys(11) === '2,8,16', [6, 7, 8, 9, 11].map(sys).join(' | '));
// Правила: приёмник принимает только фигуру с тем же числом; занятые клетки заняты.
{ const lv = g.levels(9)[3], st = L.start(lv), t = st.targets[0];
  const plain = {shape: [[0, 0]], code: null}, wrongCode = {shape: [[0, 0]], code: {v: t.v + 1}}, right = {shape: [[0, 0]], code: {v: t.v}};
  check('фигура без кода и с чужим числом не накрывает приёмник, с тем же числом — накрывает', !L.legal(st, plain, t.x, t.y) && !L.legal(st, wrongCode, t.x, t.y) && L.legal(st, right, t.x, t.y)); }
{ const lv = g.levels(6)[0], moves = g.solve(lv, 6), dup = moves.slice(0, 1).concat([{...moves[0]}]);
  check('нельзя поставить фигуру дважды и поверх занятых клеток', !g.check(lv, dup).ok); }
check('пустой ответ и мусор не проходят', !g.check(g.levels(8)[2], []).ok && !g.check(g.levels(8)[2], null).ok && !g.check(g.levels(8)[2], [{p: 5, x: 0, y: 0}]).ok);
// Честность: в каждой тройке есть фигура с кодом одного из приёмников (на уровнях с метками).
{ let ok = true, info = '';
  for (const grade of [6, 8, 10]) for (const lv of g.levels(grade).filter(l => l.labels.length)) {
    const st = L.start(lv), moves = g.solve(lv, grade);
    for (let k = 0; k <= moves.length; k++) {
      if (st.batch.every(p => !p.used) && st.targets.length && !st.batch.some(p => p.code && st.targets.some(t => t.v === p.code.v))) { ok = false; info = `${grade} кл., «${lv.title}»`; }
      if (k < moves.length) L.place(st, moves[k].p, moves[k].x, moves[k].y);
    } }
  check('в каждой новой тройке есть фигура, подходящая к приёмнику', ok, info); }
// Детерминированность и разнообразие.
check('уровни одинаковы при повторе и различаются между классами', JSON.stringify(g.levels(8)) === JSON.stringify(g.levels(8)) && g.levels(6)[3].seed !== g.levels(7)[3].seed);
console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
