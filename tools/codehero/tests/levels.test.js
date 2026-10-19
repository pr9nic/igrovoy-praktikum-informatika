// Проверка уровней: эталон проходит все варианты на три звезды, решение «в лоб» не проходит.
// Запуск: node tools/codehero/tests/levels.test.js
const C = require('../core.js'), {LEVELS, DOC, REQUIRED} = require('../levels.js'), SOL = require('./solutions.js');
// Решения без нужной идеи: должны провалиться хотя бы на одном варианте.
const NAIVE = {
  3: 'hero.moveRight(7)\nhero.moveDown(2)', 4: 'hero.moveRight(6)', 5: 'hero.moveRight(10)', 6: 'hero.moveRight()\nhero.attack("Ог")\nhero.moveRight(3)',
  10: 'hero.moveRight()\nhero.attack("Брак")\nhero.moveRight(3)', 11: 'hero.moveRight()\nhero.attack("Брак")\nhero.moveRight(2)\nhero.attack("Трог")\nhero.moveRight(2)\nhero.attack("Грым")\nhero.moveRight(3)',
  12: 'hero.moveRight(7)\nhero.say(3)\nhero.moveRight(3)', 13: 'for i in range(3):\n    enemy = hero.findNearestEnemy()\n    hero.attack(enemy)',
  14: 'hero.moveRight()\nenemy = hero.findNearestEnemy()\nfor i in range(3):\n    hero.attack(enemy)\nhero.moveRight(3)', 15: 'hero.moveRight(5)\nhero.moveDown(3)',
  16: 'hero.moveRight(9)', 17: 'for i in range(5):\n    hero.moveUp()\n    hero.moveDown()\n    hero.moveRight(2)', 18: 'hero.moveRight(5)\nhero.say("два")\nhero.moveRight(3)',
  21: 'enemies = hero.findEnemies()\nfor enemy in enemies:\n    hero.attack(enemy)', 22: 'hero.moveXY(9, 1)',
  // Новые главы: «мозг» без одной из нужных мыслей.
  23: 'hero.moveRight()\nenemy = hero.findNearestEnemy()\nwhile enemy.health > 0:\n    hero.attack(enemy)\nhero.moveRight(3)',
  24: 'while True:\n    enemy = hero.findNearestEnemy()\n    hero.attack(enemy)',
  25: 'while True:\n    target = hero.findNearestEnemy()\n    if hero.distanceTo(target) > 1:\n        hero.moveTo(target)\n    else:\n        hero.attack(target)',
  26: 'enemy = hero.findNearestEnemy()\nwhile enemy.health > 0:\n    if hero.distanceTo(enemy) > 1:\n        hero.moveTo(enemy)\n    else:\n        hero.attack(enemy)',
  27: 'hero.moveRight(10)',
  28: 'while True:\n    enemy = hero.findNearestEnemy()\n    hero.attack(enemy)',
  29: 'while True:\n    hero.moveTo(hero.findNearestItem())',
  30: 'hero.moveRight(8)\nhero.moveDown(6)',
  31: 'for e in hero.findEnemies():\n    hero.cast("fireball", e)\nwhile True:\n    hero.moveRight()',
  32: 'while True:\n    enemy = hero.findNearestEnemy()\n    if hero.canCast("fireball"):\n        hero.cast("fireball", enemy)\n    else:\n        hero.attack(enemy)',
  33: 'hero.moveRight()\nenemy = hero.findNearestEnemy()\nwhile enemy.health > 0:\n    hero.attack(enemy)\nhero.moveRight(3)',
  34: 'boss = hero.findNearestEnemy()\nwhile boss.health > 0:\n    if hero.distanceTo(boss) > 1:\n        hero.moveTo(boss)\n    else:\n        hero.attack(boss)',
  35: 'boss = hero.findNearestEnemy()\nwhile boss.health > 0:\n    if hero.distanceTo(boss) > 1:\n        hero.moveTo(boss)\n    else:\n        hero.attack(boss)',
  36: 'mage = None\nfor e in hero.findEnemies():\n    if e.type == "mage":\n        mage = e\nwhile mage.health > 0:\n    if mage.state == "casting":\n        hero.shield()\n    elif hero.distanceTo(mage) > 1:\n        hero.moveTo(mage)\n    else:\n        hero.attack(mage)',
  37: 'boss = None\nfor e in hero.findEnemies():\n    if e.type == "glitch":\n        boss = e\nwhile boss.health > 0:\n    if boss.state == "charging":\n        hero.shield()\n    elif hero.distanceTo(boss) > 1:\n        hero.moveTo(boss)\n    else:\n        hero.attack(boss)',
};
// Неполные «мозги» для боссов: без одной из нужных мыслей победы быть не должно.
const SHAMAN = 'shaman = None\n    for e in hero.findEnemies():\n        if e.type == "shaman":\n            shaman = e\n';
const HEAD = t => `boss = None\nfor e in hero.findEnemies():\n    if e.type == "${t}":\n        boss = e\nwhile boss.health > 0:\n    `;
const BALL = '    elif shaman != None:\n        if hero.distanceTo(shaman) <= 5:\n            hero.cast("fireball", shaman)\n        else:\n            hero.moveTo(shaman)\n';
const END = '    elif hero.distanceTo(boss) > 1:\n        hero.moveTo(boss)\n    else:\n        hero.attack(boss)';
const PARTIAL = {
  34: [HEAD('guard') + 'if boss.state == "charging":\n        hero.shield()\n' + END,
       HEAD('guard') + 'rat = None\n    for e in hero.findEnemies():\n        if e.type == "rat" and hero.distanceTo(e) <= 1:\n            rat = e\n    if rat != None:\n        hero.attack(rat)\n' + END],
  35: [HEAD('swarmlord') + 'rat = None\n    for e in hero.findEnemies():\n        if e.type == "rat" and hero.distanceTo(e) <= 1:\n            rat = e\n    if rat != None:\n        hero.attack(rat)\n' + END,
       HEAD('swarmlord') + 'if hero.isReady("cleave"):\n        hero.cleave()\n' + END],
  36: [HEAD('mage') + SHAMAN + '    if shaman != None:\n        if hero.distanceTo(shaman) <= 5:\n            hero.cast("fireball", shaman)\n        else:\n            hero.moveTo(shaman)\n' + END],
  37: [HEAD('glitch') + SHAMAN + '    if boss.state == "charging":\n        hero.shield()\n' + BALL + END,
       HEAD('glitch') + 'if boss.state == "charging":\n        hero.shield()\n    elif hero.health < 30 and hero.canCast("heal"):\n        hero.cast("heal")\n' + END,
       HEAD('glitch') + SHAMAN + '    if shaman != None:\n        if hero.distanceTo(shaman) <= 5:\n            hero.cast("fireball", shaman)\n        else:\n            hero.moveTo(shaman)\n    elif hero.health < 30 and hero.canCast("heal"):\n        hero.cast("heal")\n' + END],
};
let bad = 0;
const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? ' — ' + info : '')); };
check('уровней 37, номера по порядку, у каждого есть решение', LEVELS.length === 37 && LEVELS.every((l, i) => l.id === i + 1 && SOL[l.id]));
check('в отметку каждого класса идёт не больше 30 уровней, старшим — больше', [6, 7, 8, 9, 10, 11].every(g => REQUIRED[g][1] - REQUIRED[g][0] + 1 <= 30 && REQUIRED[g][1] <= 37 && (g === 6 || REQUIRED[g][1] >= REQUIRED[g - 1][1])));
for (const level of LEVELS) {
  const seeds = Array.from({length: 40}, (_, i) => i + 1), results = seeds.map(s => C.simulate(level, SOL[level.id], s));
  const fails = results.filter(r => !r.ok), low = results.filter(r => r.ok && r.stars < 3), hp = Math.min(...results.filter(r => r.ok).map(r => r.world.hero.hp)), ticks = Math.max(...results.filter(r => r.ok).map(r => r.world.ticks));
  let ok = !fails.length && !low.length && level.bonus.length === 2 && level.docs.every(d => DOC[d]) && level.api.every(a => DOC[a]) && level.starter && level.hint && level.story;
  let info = `строк ${C.codeLines(SOL[level.id])}, ходов до ${ticks}, здоровье от ${hp}`;
  if (fails.length) info += ` · НЕ ПРОХОДИТ: ${fails[0].error}`; else if (low.length) info += ` · звёзд ${low[0].stars}: бонусы ${C.bonusMet(level, low[0].world, SOL[level.id])}`;
  const start = C.simulate(level, level.starter, 1);
  if (start.syntax) { ok = false; info += ' · заготовка с ошибкой: ' + start.error; }
  if (start.ok && start.stars === 3) { ok = false; info += ' · заготовка уже решает уровень'; }
  if (NAIVE[level.id]) { const pass = seeds.every(s => C.simulate(level, NAIVE[level.id], s).ok); info += pass ? ' · решение без идеи ПРОХОДИТ' : ' · без идеи отклонено'; if (pass) ok = false; }
  for (const [k, src] of (PARTIAL[level.id] || []).entries()) { const wins = seeds.filter(s => C.simulate(level, src, s).ok).length; info += ` · неполный мозг ${k + 1}: побед ${wins}/40`; if (wins > 2) ok = false; }
  check(`${String(level.id).padStart(2)} ${level.title}`, ok, info);
}
// Интерпретатор ведёт себя как настоящий Python: ожидаемый вывод сверен с python3 (длина строк и списков у нас ограничена миллионом).
const show = v => Array.isArray(v) ? '[' + v.map(show).join(', ') + ']' : v === true ? 'True' : v === false ? 'False' : v == null ? 'None' : String(v);
const py = code => { const out = []; try { for (const _ of C.run(C.parse(code), {print: {builtin: 'print', call: a => { out.push(a.map(show).join(' ')); return null; }}}, {ops: 20000})) {} } catch (e) { out.push((e instanceof C.PyError ? 'ошибка: ' : 'сбой JS: ') + e.message); } return out.join('\n'); };
const PY = [
  ['обмен a, b = b, a', 'a = 1\nb = 2\na, b = b, a\nprint(a, b)', '2 1'],
  ['обмен соседей в пузырьке', 'a = [3, 1, 2]\nfor j in range(2):\n    if a[j] > a[j + 1]:\n        a[j], a[j + 1] = a[j + 1], a[j]\nprint(a)', '[1, 2, 3]'],
  ['кортежное присваивание по порядку, распаковка списка', 'i = 0\na = [5, 6]\ni, a[i] = 1, 9\nx, y = [7, 8]\nprint(i, a, x, y)', '1 [5, 9] 7 8'],
  ['цепочки сравнений', 'd = 3\nprint(1 < d <= 5, 1 == 1 == 1, 5 > d > 4, 1 < 2 > 0)', 'True True False True'],
  ['в цепочке средний операнд считается один раз, есть короткое замыкание', 'def f():\n    print("f")\n    return 2\nprint(1 < f() < 3)\nprint(5 < 1 < f())', 'f\nTrue\nFalse'],
  ['присваивание в функции создаёт локальную переменную', 'x = 10\ndef f():\n    x = 5\n    return x\nprint(f(), x)', '5 10'],
  ['is, is not, not in', 'b = None\na = [1]\nprint(b is None, b is not None, a is a, 3 not in [1, 2], "a" not in "abc")', 'True False True True False'],
  ['повторение строк и списков', 'print("ха" * 3, 2 * "ab", [0] * 3, [1, 2] * 0, "x" * -1 == "")', 'хахаха abab [0, 0, 0] [] True'],
  ['//=, %=, /=', 'n = 1234\nn //= 10\nd = 7\nd %= 4\nm = 9\nm /= 2\nprint(n, d, m)', '123 3 4.5'],
  ['команда после двоеточия в той же строке', 'x = 1\nif x == 1: print("one")\nelse: print("other")\nfor i in range(2): print(i)\nwhile x < 3: x += 1\nprint(x)', 'one\n0\n1\n3'],
  ['== и in сравнивают списки по значению', 'print([1, [2, 3]] == [1, [2, 3]], [1, 2] != [1, 2], [1] == [2], [1] in [[1], 2])', 'True False False True'],
  ['sum', 'print(sum([1, 2, 3]))', '6'],
  ['+= в функции без своей переменной — понятная ошибка', 'kills = 0\ndef fight():\n    kills += 1\nfight()', /^ошибка: Переменная «kills» внутри функции своя, и значения у неё ещё нет/],
  ['число имён и значений не совпадает', 'a, b = 1, 2, 3', /^ошибка: Слева от = переменных: 2, а значений справа: 3/],
  ['шаг range не может быть нулём', 'print(range(1, 5, 0))', /^ошибка: .*не может быть нулём/],
  ['слишком длинная строка — понятная ошибка, а не сбой', 's = "ab" * 1000000', /^ошибка: .*слишком длинная/],
  ['удвоение строки в цикле — тоже понятная ошибка', 't = "a"\nfor i in range(40):\n    t = t + t', /^ошибка: .*слишком длинная/],
  ['составная команда после двоеточия', 'x = 1\nif x: if x: pass', /^ошибка: .*перенесите на новую строку с отступом/],
];
for (const [name, code, want] of PY) { const got = py(code); check('python: ' + name, want instanceof RegExp ? want.test(got) : got === want, got.replace(/\n/g, ' | ')); }
{ let r; try { r = C.simulate(LEVELS[0], 'x = hero.hasOwnProperty("gold")', 1); } catch (e) { r = {error: 'сбой JS: ' + e.message}; } check('python: служебные свойства JS у героя не видны', /нет hasOwnProperty/.test(r.error), r.error); }
check('python: 1 < d <= 5 (уровень 32) и best is None (уровень 29) проходят уровни', [[32, SOL[32].replace('d > 1 and d <= 5', '1 < d <= 5')], [29, SOL[29].replace('best == None', 'best is None')]].every(([id, src]) => src !== SOL[id] && [1, 2, 3].every(s => C.simulate(LEVELS[id - 1], src, s).ok)));
console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
