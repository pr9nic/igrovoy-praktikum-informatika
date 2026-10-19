// Пошаговый журнал боя: node tools/codehero/tests/trace.js УРОВЕНЬ [зерно] [число ходов]
const C = require('../core.js'), {LEVELS} = require('../levels.js'), SOL = require('./solutions.js');
const level = LEVELS.find(l => l.id === Number(process.argv[2])), seed = Number(process.argv[3] || 1), max = Number(process.argv[4] || 60);
const w = C.makeWorld(level, seed); let n = 0;
try { for (const ev of C.run(C.parse(SOL[level.id]), {hero: C.heroApi(w, level.api)})) { if (ev.type !== 'tick') continue; n++;
  console.log(String(n).padStart(3), `стр.${String(ev.line).padStart(2)}`, `герой (${w.hero.x},${w.hero.y}) здоровье ${w.hero.hp} мана ${w.hero.mana}`, '|', w.enemies.filter(e => !e.dead).map(e => `${e.kind}(${e.x},${e.y}) ${e.hp}${e.state !== 'idle' ? ' ' + e.state : ''}`).join(', '), '|', ev.events.map(e => e.e + (e.text ? ':' + e.text : '') + (e.dmg ? ':' + e.dmg : '')).join(' '));
  if (w.won || w.lost || n >= max) break; } } catch (e) { console.log('ОШИБКА', e.line, e.message); }
console.log(w.won ? 'ПОБЕДА' : w.lost || 'не закончено');
