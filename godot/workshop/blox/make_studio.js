// Задания «Студии» Кодоблокса: эталонная программа на Python → набор блоков-целей (тот же интерпретатор, что в игре).
// Запуск: node godot/workshop/blox/make_studio.js  → godot/workshop/blox/studio.gd
const fs = require('fs'), path = require('path');
const H = require(path.join(__dirname, '../../../tools/codehero/core.js'));
function run(code) {
  const out = [], key = new Set();
  const env = {place: {builtin: 'place', call: a => {
    const [x, y, z] = a;
    if (![x, y, z].every(Number.isInteger)) throw new H.PyError('place(x, y, z): координаты — целые числа.');
    if ([x, y, z].some(v => v < 0 || v > 9)) throw new H.PyError(`Строить можно только от 0 до 9 по каждой оси: (${x}, ${y}, ${z}) вне площадки.`);
    const k = `${x},${y},${z}`; if (!key.has(k)) { key.add(k); out.push([x, y, z]); } return null; }}};
  for (const _ of H.run(H.parse(code), env, {ops: 60000})) {}
  return out.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2]);
}
const lines = c => c.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length;
const T = (title, text, ref, starter) => ({title, text, ref, starter: starter || '# place(x, y, z) — поставить блок\n'});
function tasks(grade) {
  const n = grade <= 7 ? 13 : grade <= 9 ? 181 : 202, w = grade <= 7 ? 4 : 8;
  const list = [
    T('Стена', 'Построй стену: ряд из 8 блоков на полу вдоль оси x (z = 0). Цикл for сделает это в две строки.', 'for x in range(8):\n    place(x, 0, 0)'),
    T('Лестница', 'Лестница из 6 ступеней: в столбце x стоит x + 1 блок. Понадобится цикл в цикле.', 'for x in range(6):\n    for y in range(x + 1):\n        place(x, y, 0)'),
    T('Рамка', 'Квадратная рамка 6 × 6 на полу (y = 0): только края, середина пустая.', 'for i in range(6):\n    place(i, 0, 0)\n    place(i, 0, 5)\n    place(0, 0, i)\n    place(5, 0, i)'),
    T('Пирамида', 'Пирамида из 4 слоёв: 7 × 7, 5 × 5, 3 × 3 и 1 блок. Каждый слой выше на 1 и уже на 1 с каждой стороны.', 'for y in range(4):\n    for x in range(y, 7 - y):\n        for z in range(y, 7 - y):\n            place(x, y, z)'),
    T(`Число ${n} в двоичном`, `Запиши число ${n} блоками: ${w} столбцов в ряд (x от 0 до ${w - 1}), старший разряд — x = 0. Где цифра 1 — блок на полу (y = 0), где 0 — пусто. Подсказка: n % 2 — последняя цифра, n // 2 — отбросить её.`,
      `n = ${n}\nfor i in range(${w}):\n    if n % 2 == 1:\n        place(${w - 1} - i, 0, 0)\n    n = n // 2`),
    T('Шахматный пол', 'Пол 6 × 6 в шахматном порядке: блок стоит там, где (x + z) чётное. Нужен if и остаток от деления %.', 'for x in range(6):\n    for z in range(6):\n        if (x + z) % 2 == 0:\n            place(x, 0, z)'),
    T('Полая коробка', 'Коробка 5 × 5 высотой 3 без крыши: четыре стены (x и z от 0 до 4), внутри пусто.', 'for y in range(3):\n    for i in range(5):\n        place(i, y, 0)\n        place(i, y, 4)\n        place(0, y, i)\n        place(4, y, i)'),
    T('Буква X', 'Буква X на полу 7 × 7: две диагонали — где x == z и где x + z == 6.', 'for i in range(7):\n    place(i, 0, i)\n    place(6 - i, 0, i)'),
    T('Горка', 'Горка из 7 столбцов вдоль x (z = 0): высоты 1, 2, 3, 4, 3, 2, 1. Подсказка: высота = 4 - abs(x - 3).', 'for x in range(7):\n    for y in range(4 - abs(x - 3)):\n        place(x, y, 0)'),
    T('Своя команда', 'Напиши функцию def column(x, h), которая ставит столбик высотой h в точке (x, 0). Вызови её, чтобы получились столбики высотой 1, 2, 3, 4, 5 в x = 0, 2, 4, 6, 8.', 'def column(x, h):\n    for y in range(h):\n        place(x, y, 0)\nfor k in range(5):\n    column(k * 2, k + 1)'),
    T('Пунктирная башня', 'Цикл while: башня в точке x = 4, z = 4 — блоки на высотах 0, 2, 4, 6, 8 (через один), пока y < 10.', 'y = 0\nwhile y < 10:\n    place(4, y, 4)\n    y = y + 2'),
    T('Двоичная таблица', 'Числа от 0 до 7 в двоичном виде: в столбце x = n запиши число n снизу вверх (младший разряд — y = 0). Где цифра 1 — блок.', 'for n in range(8):\n    k = n\n    for i in range(3):\n        if k % 2 == 1:\n            place(n, i, 0)\n        k = k // 2'),
  ];
  if (grade >= 9) list.push(T('Башня со смотровой', 'Колонна высотой 8 в точке x = 4, z = 4 (y от 0 до 7), а на высоте y = 8 — площадка 3 × 3 вокруг её вершины (x и z от 3 до 5).',
    'for y in range(8):\n    place(4, y, 4)\nfor x in range(3, 6):\n    for z in range(3, 6):\n        place(x, 8, z)'));
  return list.map(t => ({...t, target: run(t.ref), par: lines(t.ref)}));
}
const out = {};
for (let g = 6; g <= 11; g++) out[g] = tasks(g);
if (require.main === module) {
  // Для Godot — скриптом с константой (JSON-файлы в веб-сборку не попадают); вручную не править.
  fs.writeFileSync(path.join(__dirname, 'studio.gd'), 'extends RefCounted\n# Задания «Студии»: сделано blox/make_studio.js, вручную не править.\nconst DATA := ' + JSON.stringify(out, null, 1) + '\n');
  console.log('studio.gd:', Object.values(out).map(l => l.length).join(' '));
}
module.exports = {run, tasks};
