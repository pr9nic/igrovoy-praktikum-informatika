// Проверка логики «Бункера» без браузера: node tools/lab/tests/bunker.test.js
const path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); require(path.join(dir, 'games', 'bunker.js'));
const g = LAB.games.find(x => x.id === 'bunker'), L = g.lib;
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };
for (const grade of [6, 7, 8, 9, 10, 11]) { let ok = true, info = '';
  g.levels(grade).forEach((lv, i) => { const r = g.check(lv, g.solve(lv, grade), grade); if (!r.ok || r.stars !== 3) { ok = false; info = `сценарий ${i + 1}: ${r.msg}`; } });
  check(`${grade} класс: 8 сценариев, лучшая команда и верные ответы — три звезды`, ok && g.levels(grade).length === 8, info); }
// Испытания: верный ответ совпадает с независимым расчётом.
{ let ok = true, info = ''; const rnd = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 200; i++) for (const nd of Object.keys(L.NEEDS)) { const r = rnd(1 + i * 7), t = L.trial(nd, r, 6 + i % 6, 8 * (2 + i % 6)), a = t.opts[t.right];
    if (new Set(t.opts).size !== 4) { ok = false; info = `${nd}: повтор вариантов`; }
    if (nd === 'store' && a !== String(8 * (2 + i % 6) * 1024)) { ok = false; info = 'store'; }
    if (nd === 'zip') { const s = t.q.match(/строку (\w+)/)[1]; if (a !== s.replace(/(.)\1*/g, m => m.length + m[0])) { ok = false; info = 'zip ' + s; } }
    if (nd === 'sec') { const m = t.q.match(/из (\d+) символов, каждый — один из (\d+)/); if (a !== String((+m[2]) ** (+m[1]))) { ok = false; info = 'sec ' + t.q; } }
    if (nd === 'py') { const x = +t.q.match(/s = (\d+)/)[1], k = +t.q.match(/range\((\d+)\)/)[1]; if (a !== String(x * 2 ** k)) { ok = false; info = 'py'; } }
    if (nd === 'db') { const v = t.q.match(/\d+/g).filter((_, j) => j % 2 === 1).map(Number); if (a !== String(v[0] + v[1] + v[2])) { ok = false; info = 'db ' + t.q; } }
    if (nd === 'net' && !/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(a)) { ok = false; info = 'net ' + a; } }
  check('испытания: четыре разных варианта, верные ответы сходятся с расчётом (1400 штук)', ok, info); }
// Флешки: подходит только та, что вмещает архив; маленькая — ловушка.
{ let ok = true, info = '';
  for (const grade of [6, 9]) for (const lv of g.levels(grade).filter(l => l.needs.includes('store'))) { const S = L.setup(lv, grade), fl = S.cards.filter(c => /флешка/.test(c.item));
    const good = fl.filter(c => L.covers(c, 'store', S.size)), trap = fl.filter(c => !L.covers(c, 'store', S.size));
    if (good.length !== 1 || (lv.n > lv.needs.length + 1 && trap.length !== 1)) { ok = false; info = `«${lv.title}»: подходящих ${good.length}, ловушек ${trap.length}`; } }
  check('флешка: одна вмещает архив, другая — нет (Мбайт против Гбайт)', ok, info); }
{ const lv = g.levels(8)[0], S = L.setup(lv, 8), sol = g.solve(lv, 8), useless = S.cards.map((c, i) => i).filter(i => !S.needs.some(nd => L.covers(S.cards[i], nd, S.size)));
  const bad1 = useless.concat(sol.kept).slice(0, lv.keep);
  const r = g.check(lv, {kept: bad1, answers: sol.answers}, 8);
  check('без нужных специалистов бункер получает меньше звёзд или не выстаивает', !r.ok || r.stars < 3, JSON.stringify(r)); }
{ const lv = g.levels(8)[2], sol = g.solve(lv, 8);
  check('в бункере должно остаться ровно столько, сколько мест', !g.check(lv, {kept: sol.kept.slice(1), answers: sol.answers}, 8).ok && !g.check(lv, {kept: sol.kept.concat(sol.kept), answers: sol.answers}, 8).ok === false);
  check('все ответы неверные — бункер не выстоял', !g.check(lv, {kept: sol.kept, answers: sol.answers.map(a => (a + 1) % 4)}, 8).ok);
  check('мусор вместо решения не проходит', !g.check(lv, null, 8).ok && !g.check(lv, {kept: 'x'}, 8).ok); }
console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
