// Подбор баланса: node tools/codehero/tests/tune.js 23 24 … — исходы эталона и решений без идеи по 40 вариантам.
const C = require('../core.js'), {LEVELS} = require('../levels.js'), SOL = require('./solutions.js');
const fs = require('fs'), src = fs.readFileSync(__dirname + '/levels.test.js', 'utf8');
const NAIVE = eval('(' + src.slice(src.indexOf('const NAIVE = ') + 14, src.indexOf('};', src.indexOf('const NAIVE = ')) + 1) + ')');
const PARTIAL = eval('(()=>{' + src.slice(src.indexOf('const SHAMAN = '), src.indexOf('};', src.indexOf('const PARTIAL = ')) + 2) + ' return PARTIAL;})()');
const stat = (level, code) => { const rs = Array.from({length: 40}, (_, i) => C.simulate(level, code, i + 1)), ok = rs.filter(r => r.ok); const why = {}; for (const r of rs) if (!r.ok) why[r.error.slice(0, 44)] = (why[r.error.slice(0, 44)] || 0) + 1;
  return `побед ${ok.length}/40` + (ok.length ? `, здоровье ${Math.min(...ok.map(r => r.world.hero.hp))}–${Math.max(...ok.map(r => r.world.hero.hp))}, ходов ${Math.min(...ok.map(r => r.world.ticks))}–${Math.max(...ok.map(r => r.world.ticks))}, впустую до ${Math.max(...ok.map(r => r.world.wasted))}, звёзд от ${Math.min(...ok.map(r => r.stars))}` : '') + (Object.keys(why).length ? ' | ' + JSON.stringify(why) : ''); };
for (const id of process.argv.slice(2).map(Number)) { const level = LEVELS.find(l => l.id === id); if (!level) continue;
  console.log(`${id} ${level.title}\n   эталон:   ${stat(level, SOL[id])}`); if (NAIVE[id]) console.log(`   без идеи: ${stat(level, NAIVE[id])}`); (PARTIAL[id] || []).forEach((p, i) => console.log(`   неполный ${i + 1}: ${stat(level, p)}`)); }
