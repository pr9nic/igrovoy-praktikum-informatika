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
console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
