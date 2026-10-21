// Проверка логики «Код-раннера» без браузера: node tools/lab/tests/runner.test.js
const path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); require(path.join(dir, 'games', 'runner.js'));
const g = LAB.games.find(x => x.id === 'runner'), L = g.lib;
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };
const rnd = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
// Каждый вид вопросов: три разных варианта, верный совпадает с независимым расчётом.
const truth = {bin2dec: q => String(parseInt(q.q.split('₂')[0], 2)), dec2bin: q => (+q.q.split(' ')[0]).toString(2), pow2: q => String(2 ** +q.q.slice(2).split(' ')[0]),
  hex: q => String(parseInt(q.q.split('₁₆')[0], 16)), py: q => { const e = q.q.slice(6, -1); if (e.startsWith('len(')) return String(e.length - 7); return String(Function(`return Math.floor(${e.replace('//', '/')})`)()) === String(Function(`return ${e.replace('//', '/')}`)()) ? String(Function(`return ${e.replace('//', '/')}`)()) : String(Math.floor(Function(`return ${e.replace('//', '/')}`)())); },
  logic: q => { const A = +q.q[2], B = +q.q[7]; return String((A && B) + (A || B) + !A); }, loop: q => { const m = q.q.match(/range\((?:0, )?(\d+)(?:, (\d+))?\)/); return String(Math.ceil(+m[1] / (+m[2] || 1))); }};
for (const k of Object.keys(L.KINDS)) { let ok = true, info = ''; const r = rnd(11 + k.length);
  for (let i = 0; i < 300; i++) { const q = L.question(k, r, 10); if (new Set(q.opts).size !== 3 || q.right < 0 || q.right > 2) { ok = false; info = 'варианты: ' + q.opts.join('/'); break; }
    if (truth[k] && truth[k](q) !== q.opts[q.right]) { ok = false; info = `${q.q} → ${q.opts[q.right]} (ожидалось ${truth[k](q)})`; break; } }
  check(`вопросы «${k}»: три разных варианта, верный ответ правильный (300 штук)`, ok, info); }
{ const r = rnd(5), pos = [0, 0, 0]; for (let i = 0; i < 900; i++) pos[L.question('bin2dec', r, 8).right]++; check('верный ответ бывает на любой дорожке', pos.every(n => n > 200), pos.join('/')); }
for (const grade of [6, 7, 8, 9, 10, 11]) { const lv = g.levels(grade); check(`${grade} класс: 8 забегов, образцовый забег — три звезды`, lv.length === 8 && lv.every(l => { const r = g.check(l, g.solve(l)); return r.ok && r.stars === 3; })); }
check('в 6–7 классах нет шестнадцатеричных и Python-вопросов', [6, 7].every(gr => g.levels(gr).every(l => !l.kinds.includes('hex') && !l.kinds.includes('py'))));
const lv = g.levels(9)[3];
check('мало пробежал или мало верных — не засчитано', !g.check(lv, {dist: lv.dist - 1, correct: lv.need, wrong: 0, hits: 0}).ok && !g.check(lv, {dist: lv.dist, correct: lv.need - 1, wrong: 0, hits: 0}).ok);
check('три ошибки и столкновения — жизни кончились', !g.check(lv, {dist: lv.dist, correct: lv.need, wrong: 2, hits: 1}).ok);
check('звёзды: без ошибок — 3, одна — 2, две — 1', g.check(lv, {dist: lv.dist, correct: lv.need, wrong: 0, hits: 1}).stars === 2 && g.check(lv, {dist: lv.dist, correct: lv.need, wrong: 1, hits: 1}).stars === 1);
check('мусор вместо забега не проходит', !g.check(lv, null).ok && !g.check(lv, {dist: 'x'}).ok);
console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
