// Перебор параметров босса: node tools/codehero/tests/sweep.js 34
const C = require('../core.js'), {LEVELS} = require('../levels.js'), SOL = require('./solutions.js'), fs = require('fs');
const src = fs.readFileSync(__dirname + '/levels.test.js', 'utf8'), PARTIAL = eval('(()=>{' + src.slice(src.indexOf('const SHAMAN = '), src.indexOf('};', src.indexOf('const PARTIAL = ')) + 2) + ' return PARTIAL;})()');
const id = Number(process.argv[2]), base = LEVELS.find(l => l.id === id);
const run = (level, code) => { const rs = Array.from({length: 40}, (_, i) => C.simulate(level, code, i + 1)), ok = rs.filter(r => r.ok); return [ok.length, ok.length ? Math.min(...ok.map(r => r.world.hero.hp)) : 0]; };
const grid = id === 34 ? {hp: [90, 100, 120], dmg: [3, 4, 5], smash: [30, 36, 45], every: [2, 3, 4, 5], rdmg: [4, 5, 6, 8], max: [2, 3, 4]} : {hp: [80, 100, 120, 140], dmg: [2, 3, 4], smash: [0], every: [1, 2, 3], rdmg: [3, 4, 5], max: [3, 4, 6]};
const out = [];
for (const hp of grid.hp) for (const dmg of grid.dmg) for (const smash of grid.smash) for (const every of grid.every) for (const rdmg of grid.rdmg) for (const max of grid.max) {
  C.KIND.rat.dmg = rdmg; const level = {...base, bossExtra: {...base.bossExtra, hp, dmg, ...(smash ? {smash} : {}), summon: {kind: 'rat', every, max}}};
  const full = run(level, SOL[id]), parts = (PARTIAL[id] || []).map(p => run(level, p)[0]);
  out.push({hp, dmg, smash, every, rdmg, max, full: full[0], minHp: full[1], parts: parts.join('/'), score: full[0] * 3 - parts.reduce((x, y) => x + y, 0)});
}
out.sort((a, b) => b.score - a.score || b.minHp - a.minHp); console.log(out.slice(0, 8).map(o => JSON.stringify(o)).join('\n')); console.log('подходящих наборов:', out.length);
