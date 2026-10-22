// Проверка логики игр «Лаборатории» без браузера: node tools/lab/tests/lab.test.js
const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); for (const f of fs.readdirSync(path.join(dir, 'games')).sort()) require(path.join(dir, 'games', f));
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };
const G = Object.fromEntries(LAB.games.map(g => [g.id, g]));
for (const g of LAB.games) for (const grade of [6, 7, 8, 9, 10, 11]) {
  const levels = g.levels(grade); let ok = levels.length >= 8 && levels.length <= 30, info = '';
  levels.forEach((lv, i) => { const r = g.check(lv, g.solve(lv, grade), grade); if (!r.ok || r.stars !== 3) { ok = false; info = `уровень ${i + 1}: образцовое решение не даёт три звезды (${JSON.stringify(r).slice(0, 120)})`; } if (!lv.title) { ok = false; info = 'нет названия'; } });
  check(`${g.title}, ${grade} класс: ${levels.length} уровней, образцовые решения проходят на три звезды`, ok, info);
}
module.exports = {check, G, done: () => { console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0); }};
if (require.main === module) {
  // Завод: короче образцовой цепочки заказ не выполнить (перебор цепочек до трёх станков), пустая и чужая цепочки не проходят.
  { const g = G.factory, lv = g.levels(11); let ok = true, info = '';
    for (const [i, l] of lv.entries()) { const opts = []; for (const op of l.palette) if (g.OPS[op].k != null) for (let k = 1; k <= 12; k++) opts.push([op, k]); else opts.push([op]);
      const search = (chain, left) => { if (chain.length && g.check(l, chain).ok) return chain; if (!left) return null; for (const o of opts) { const r = search(chain.concat([o]), left - 1); if (r) return r; } return null; };
      const shorter = search([], Math.min(l.par - 1, 3)); if (shorter) { ok = false; info = `уровень ${i + 1}: есть цепочка короче — ${JSON.stringify(shorter)}`; }
      if (g.check(l, []).ok || g.check(l, [['zzz']]).ok) { ok = false; info = `уровень ${i + 1}: принята негодная цепочка`; }
      const res = l.tests.map(t => JSON.stringify(g.run(l.ref, t))); if (new Set(res).size < 2) { ok = false; info = `уровень ${i + 1}: все партии дают один ответ`; } }
    check('завод: образцовые цепочки — кратчайшие, негодные не проходят, партии различаются', ok, info); }
  // Город данных: в запросах с «первыми N» нет спорной границы, а пустой запрос и запрос «без одной части» не проходят.
  { const g = G.dbcity; let ok = true, info = '';
    for (const [i, l] of g.levels(11).entries()) { const r = l.ref;
      if (g.check(l, {where: []}).ok) { ok = false; info = `уровень ${i + 1}: проходит пустой запрос`; }
      for (const drop of ['where', 'order', 'limit', 'agg']) if (r[drop]) { const q = JSON.parse(JSON.stringify(r)); delete q[drop]; if (g.check(l, q).ok) { ok = false; info = `уровень ${i + 1}: проходит запрос без ${drop}`; } }
      if (r.where && r.where.length === 2) { const q = JSON.parse(JSON.stringify(r)); q.join = r.join === 'or' ? 'and' : 'or'; if (g.check(l, q).ok) { ok = false; info = `уровень ${i + 1}: И и ИЛИ дают одно и то же`; } }
      if (r.order) { const all = g.exec({where: r.where, join: r.join, order: r.order}).rows.map(id => g.ROWS[id][r.order.f]); const n = r.limit || all.length; for (let k = 0; k < Math.min(n, all.length - 1); k++) if (all[k] === all[k + 1]) { ok = false; info = `уровень ${i + 1}: одинаковые значения в порядке`; } }
      const res = g.exec(r); if ('rows' in res ? !res.rows.length || res.rows.length === g.ROWS.length && r.where : res.value == null) { ok = false; info = `уровень ${i + 1}: пустой или полный результат`; } }
    check('город данных: запросы однозначны, упрощённые варианты не проходят', ok, info); }
  // Пиксель-мастер: по коду рисунок восстанавливается однозначно (декодируем независимо), пустой холст не проходит.
  { const g = G.pixel; let ok = true, info = '';
    for (const [i, l] of g.levels(11).entries()) { if (l.kind === 'calc') { if (g.check(l, '0').ok || g.check(l, '').ok) { ok = false; info = `уровень ${i + 1}: принят неверный ответ`; } continue; }
      const code = g.codeOf(l.enc, l.pic), back = code.map(r => l.enc === 'hex' ? parseInt(r, 16).toString(2).padStart(8, '0') : l.enc === 'rle' ? r.split(' ').map((n, k) => String(k % 2).repeat(Number(n))).join('') : r.split(' ').join(''));
      if (back.join('|') !== l.pic.join('|') || l.pic.length !== 8 || l.pic.some(r => r.length !== 8)) { ok = false; info = `уровень ${i + 1}: код не восстанавливает рисунок`; }
      if (g.check(l, Array.from({length: 8}, () => Array(8).fill(0))).ok) { ok = false; info = `уровень ${i + 1}: пустой холст проходит`; } }
    check('пиксель-мастер: коды однозначно задают рисунки 8×8, неверные ответы не проходят', ok, info); }
  // Детектив: у каждого вопроса есть объяснение, в отметках есть и верные, и неверные строки, шифровка расшифровывается.
  { const g = G.detective; let ok = true, info = '', steps = 0;
    for (const [i, l] of g.levels(8).entries()) for (const st of l.steps) { steps++; if (!st.why || !st.q) { ok = false; info = `дело ${i + 1}: нет объяснения`; }
      if (st.type === 'flag' && (!st.bad.length || st.bad.length === st.items.length || st.bad.some(b => b >= st.items.length) || g.stepOk(st, []))) { ok = false; info = `дело ${i + 1}: плохой набор отметок`; }
      if (st.type === 'one' && (st.right >= st.items.length || new Set(st.items).size !== st.items.length)) { ok = false; info = `дело ${i + 1}: плохой выбор`; } }
    const A = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', dec = [...'ФИМЧЦ'].map(c => A[(A.indexOf(c) - 3 + 32) % 32]).join('');
    check('детектив: 9 дел, у вопросов есть объяснения, шифровка «ФИМЧЦ» со сдвигом 3 даёт «СЕЙФУ»', ok && dec === 'СЕЙФУ' && steps >= 22, info || `${steps} вопросов, расшифровка ${dec}`); }
  // Гонка: поля прямоугольные с одним стартом, длинная программа без повторов тоже решает (но не на три звезды), врезание и пустая программа не проходят.
  { const g = G.race; let ok = true, info = '';
    const flat = prog => prog.flatMap(c => typeof c === 'string' ? [c] : Array.from({length: c.n}, () => flat(c.body)).flat());
    for (const [i, l] of g.levels(11).entries()) { const w = l.map[0].length;
      if (l.map.some(r => r.length !== w) || l.map.join('').split('S').length !== 2) { ok = false; info = `трасса ${i + 1}: поле задано неверно`; }
      const long = flat(l.ref), r = g.check(l, long); if (!r.ok || (long.length > l.par + 2 && r.stars !== 1)) { ok = false; info = `трасса ${i + 1}: развёрнутая программа ${JSON.stringify(r).slice(0, 80)}`; }
      if (g.check(l, []).ok || g.check(l, ['F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F']).ok || g.check(l, [{n: 99, body: ['F']}]).ok || g.check(l, 'FFF').ok) { ok = false; info = `трасса ${i + 1}: принята негодная программа`; } }
    check('гонка: 12 трасс проходятся, негодные программы отклоняются', ok, info); }
  // Экспедиция: начальный код каждого задания разбирается, но задание ещё не выполнено; ошибки сообщаются по-русски с номером строки.
  { const g = G.quest; let ok = true, info = '';
    for (const [i, l] of g.LEVELS.entries()) { const r = g.check(l, {code: l.start, won: false}); if (r.ok) { ok = false; info = `задание ${i + 1}: начальный код уже проходит`; } if (i !== 1 && g.facts(l.start).errors.length) { ok = false; info = `задание ${i + 1}: начальный код с ошибкой — ${g.facts(l.start).errors[0]}`; } }
    const e1 = g.facts(g.LEVELS[1].start).errors[0] || '', e2 = g.facts("start = 'а'\nrooms = {'а': {'текст': 'x', 'выходы': {'север' 'б'}}}").errors[0] || '', e3 = g.facts('rooms = {\n  \'а\': {\'текст\': привет}\n}').errors[0] || '';
    const dead = g.facts(g.LEVELS[5].start), own = g.facts(g.LEVELS[7].ref);
    check('экспедиция: начальные коды не решают задание, ошибки понятны, тупик распознаётся, образец своей игры проходит', ok && /зла/.test(e1) && /Строка 2/.test(e2) && /Строка 2.*кавычки/.test(e3) && dead.winnable === false && own.rooms >= 6 && own.steps >= 8 && own.needed.length === 2, info || [e1, e2, e3, dead.winnable, own.rooms, own.steps].join(' | ')); }
  // Офис роботов: пустая и «просто перенести» программы не решают сложные уровни; бесконечный цикл ловится.
  { const g = G.office; let ok = true, info = '';
    for (const [i, l] of g.LEVELS.entries()) { if (i > 0 && g.check(l, [['in'], ['out'], ['jmp', 0]]).ok) { ok = false; info = `уровень ${i + 1}: проходит простой перенос`; } if (g.check(l, []).ok) { ok = false; info = 'пустая программа'; } }
    const loop = g.run([['jmp', 0]], [1], []); check('офис роботов: 12 уровней, простые решения не проходят, бесконечный цикл распознаётся', ok && !!loop.error, info || loop.error); }
  // Логические схемы: «все И» не решают уровни, где нужна другая логика; таблицы истинности сходятся с образцом.
  { const g = G.gates; let ok = true, info = '';
    for (const [i, l] of g.LEVELS.entries()) { const allAnd = Object.fromEntries(l.gates.map(x => [x.id, x.kinds.includes('and') ? 'and' : x.kinds[0]])); if (JSON.stringify(allAnd) !== JSON.stringify(l.ref) && g.check(l, allAnd).ok && !['Оба сразу', 'Замок с кодом', 'И-НЕ из двух', 'A, но не B'].includes(l.title)) { ok = false; info = `уровень ${i + 1}: проходит «все И»`; } }
    check('логические схемы: 14 уровней, неверные схемы не проходят', ok, info); }
  // Исполнители: кратчайшие программы найдены перебором, у рисунков образец совпадает сам с собой, ошибки разбора по-русски.
  { const g = G.executors; let ok = true, info = '';
    for (const [i, l] of g.LEVELS.entries()) if (l.par > 15) { ok = false; info = `задача ${i + 1}: слишком длинная (${l.par})`; }
    let err = ''; try { g.parse('повтори 4 [вперёд 100'); } catch (e) { err = e.message; }
    const tr = g.LEVELS.find(l => l.title === 'Черепаха: квадрат'); const rb = g.LEVELS.find(l => l.title === 'Робот: до стены'); check('робот: «повтори 5» не проходит на втором поле, «пока» проходит, врезание в стену — ошибка', !g.check(rb, 'повтори 5 [вправо закрасить]').ok && g.check(rb, 'пока справа свободно [вправо закрасить]').ok && /врезался/.test(g.check(rb, 'повтори 9 [вправо]').msg), g.check(rb, 'повтори 9 [вправо]').msg);
    const e1 = g.LEVELS.find(l => l.title === 'Редактор: сжатие'); check('редактор: одна замена не проходит на всех строках, бесконечный цикл ловится, «пока» проходит', !g.check(e1, 'заменить (11, 1)').ok && /долго/.test(g.check(e1, 'пока нашлось (1) [заменить (1, 11)]').msg) && g.check(e1, 'пока нашлось (11) [заменить (11, 1)]').ok, g.check(e1, 'пока нашлось (1) [заменить (1, 11)]').msg);
    check('исполнители: 23 задачи решаемы, квадрат «налево» тоже засчитан, неверный рисунок не проходит, ошибки понятны', ok && /не закрыта/.test(err) && !g.check(tr, 'повтори 3 [вперёд 100 направо 90]').ok && g.check(tr, 'повтори 4 [вперед 100 налево 90]').ok === true && !g.check(tr, 'повтори 4 [вперед 80 направо 90]').ok, info || err); }
  // ОГЭ-арена: ответы пересчитываются заново по тому, что видит ученик (таблицы, граф, текст), на 300 вариантах каждого задания.
  { const g = G.oge; let bad = '';
    const sub = {'₂': 2, '₈': 8, '₁₆': 16};
    for (let s = 1; s <= 300 && !bad; s++) {
      const [p2] = g.problems(g.LEVELS[1], s), bits = p2.text.split('\n')[1]; let rest = bits, word = ''; while (rest) { const k = p2.table[1].findIndex(c => rest.startsWith(c)); if (k < 0) { bad = 'задание 2: код не читается'; break; } word += p2.table[0][k]; rest = rest.slice(p2.table[1][k].length); } if (word !== p2.answer) bad = `задание 2, вариант ${s}`;
      const [p4] = g.problems(g.LEVELS[3], s), m = p4.table.slice(1).map(r => r.slice(1).map(x => x === '' ? 0 : +x)), n = m.length, d = Array(n).fill(1e9); d[0] = 0; for (let it = 0; it < n; it++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (m[i][j] && d[i] + m[i][j] < d[j]) d[j] = d[i] + m[i][j]; if (d[n - 1] !== p4.answer) bad = `задание 4, вариант ${s}`;
      const [p8] = g.problems(g.LEVELS[7], s), q = Object.fromEntries(p8.table.slice(1).map(r => [r[0], +r[1]])), ask = p8.text.match(/запросу «(.+?)»\?/)[1], [a, b] = (Object.keys(q).find(k => k.includes('|') || k.includes('&')) || ask).split(/ [|&] /);
      const val = {U: q[`${a} | ${b}`], I: q[`${a} & ${b}`], A: q[a], B: q[b]}, want = ask.includes('|') ? val.A + val.B - val.I : ask.includes('&') ? val.A + val.B - val.U : ask === a ? val.U - val.B + val.I : val.U - val.A + val.I; if (want !== p8.answer) bad = `задание 8, вариант ${s}`;
      const [p9] = g.problems(g.LEVELS[8], s), w = Array(p9.graph.names.length).fill(0); w[0] = 1; for (let v = 1; v < w.length; v++) for (const [x, y] of p9.graph.edges) if (y === v) w[v] += w[x]; if (w[w.length - 1] !== p9.answer) bad = `задание 9, вариант ${s}`;
      const [p10] = g.problems(g.LEVELS[9], s), nums = p10.text.split('\n').pop().split(',').map(x => x.trim()).map(x => { const k = Object.keys(sub).find(z => x.endsWith(z)); return parseInt(x.slice(0, -k.length), sub[k]); }); if (Math.max(...nums) !== p10.answer) bad = `задание 10, вариант ${s}`;
      const [p1] = g.problems(g.LEVELS[0], s), list = p1.text.match(/«(.+) — животные/)[1].split(', '), bytes = +p1.text.match(/на (\d+) байт/)[1], per = p1.text.includes('UTF-16') ? 2 : 1, fit = list.filter(x => (x.length + 2) * per === bytes); if (fit.length !== 1 || fit[0] !== p1.answer) bad = `задание 1, вариант ${s}`;
    }
    const lv = g.LEVELS[9], sol = g.solve(lv), wrong = {seed: sol.seed, answers: ['0', '0', '0']}, two = {seed: sol.seed, answers: [sol.answers[0], sol.answers[1], '0']};
    check('ОГЭ-арена: ответы заданий 1, 2, 4, 8, 9, 10 сходятся с независимым пересчётом; звёзды = числу верных ответов', !bad && g.check(lv, sol).stars === 3 && g.check(lv, two).stars === 2 && !g.check(lv, wrong).ok, bad); }
  // Электронные таблицы: число вместо формулы не проходит (проверка на трёх наборах), без $ при копировании — ошибка, вспомогательный столбец работает.
  { const g = G.sheets, l1 = g.LEVELS[0], hard = '=' + g.sheetValues(l1.data((s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(11 * 977))).value('B2') + '*1';
    check('таблицы: 12 заданий решаемы; готовое число, формула без $ и неверная ссылка не проходят; вспомогательный столбец засчитан', !g.check(l1, hard).ok && !g.check(g.LEVELS[4], '=B2*(1-F1)').ok && !g.check(l1, '=B2*C3').ok && g.check(g.LEVELS[11], {F2: '=ЕСЛИ(И(B2="9 «А»";C2>30);1;0)', G1: '=СУММ(F2:F21)'}).ok && g.check(g.LEVELS[7], '=IF(C2+D2>=50,"зачёт","пересдача")').ok, g.check(g.LEVELS[11], {F2: '=ЕСЛИ(И(B2="9 «А»";C2>30);1;0)', G1: '=СУММ(F2:F21)'}).msg); }
  // Лаборатория логики: каждый вариант «найди равносильное» имеет ровно один равносильный ответ; загадки однозначны.
  { const g = G.logic; let bad = '';
    for (const l of g.LEVELS.filter(x => x.gen)) for (let s = 1; s <= 200 && !bad; s++) for (const p of g.problems(l, s)) {
      if (p.kind === 'choice' && /равносильно/.test(p.text)) { const given = p.text.match(/выражению (.+)\?$/)[1], eq = p.choices.filter(c => g.equal(c, given)); if (eq.length !== 1 || eq[0] !== p.answer) bad = `${l.title}, вариант ${s}: ${given} → ${eq.join(' / ')}`; }
      if (p.kind === 'num') { const e = p.text.match(/выражение (.+) истинно\?$/)[1]; if (String(g.table(e).reduce((x, y) => x + y, 0)) !== p.answer) bad = `${l.title}, вариант ${s}`; } }
    check('логика: в «найди равносильное» ровно один верный вариант (200 вариантов), счёт истинных строк сходится', !bad, bad); }
  // Почта пакетов: адрес сети пересчитывается независимо по двоичной записи.
  { const g = G.ipnet, lv = g.LEVELS.find(l => l.gen === 'net'); let bad = '';
    for (let s = 1; s <= 300 && !bad; s++) for (const p of g.problems(lv, s)) { const [ip, mask] = p.text.match(/(\d+\.\d+\.\d+\.\d+)/g), net = ip.split('.').map((x, i) => parseInt(x).toString(2).padStart(8, '0').split('').map((c, k) => c === '1' && parseInt(mask.split('.')[i]).toString(2).padStart(8, '0')[k] === '1' ? '1' : '0').join('')).map(b => parseInt(b, 2)).join('.'); if (net !== p.answer) bad = `вариант ${s}: ${ip} / ${mask}`; }
    check('почта пакетов: адрес сети сходится с независимым пересчётом (300 вариантов)', !bad, bad); }
  // Поезд массивов: программа, подогнанная под первый состав, не проходит; запрещённые функции отклоняются.
  { const g = G.arrays, l0 = g.LEVELS[0]; check('массивы: подгонка под один состав и sum() не проходят', !g.check(l0, 'print(' + g.LEVELS[0].data((s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(5 * 37)).a.reduce((x, y) => x + y, 0) + ')').ok && !g.check(l0, 'print(sum(a))').ok); }
  // Поезд массивов: запреты — по смыслу программы, а не по буквам: for y in a, флаг is_sorted и обмен через запятую проходят; in через другое имя, not in, sort, sorted, reverse — нет.
  { const g = G.arrays, lv = t => g.LEVELS.find(l => l.title === t), swap = 'n = len(a)\nfor i in range(n - 1):\n    for j in range(n - 1 - i):\n        if a[j] > a[j + 1]:\n            a[j], a[j + 1] = a[j + 1], a[j]\nprint(a)';
    const good = [['Есть ли вагон?', 'f = "NO"\nfor y in a:\n    if y == x:\n        f = "YES"\nprint(f)'], ['Сортировка вагонов', swap], ['Сортировка вагонов', 'n = len(a)\nis_sorted = False\nwhile not is_sorted:\n    is_sorted = True\n    for j in range(n - 1):\n        if a[j] > a[j + 1]:\n            a[j], a[j + 1] = a[j + 1], a[j]\n            is_sorted = False\nprint(a)'],
      ['Поезд задом наперёд', 'n = len(a)\nfor i in range(n // 2):\n    a[i], a[n - 1 - i] = a[n - 1 - i], a[i]\nprint(a)'], ['Самый тяжёлый', 'max = 0\nfor i in range(len(a)):\n    if a[i] > a[max]:\n        max = i\nprint(a[max], max)']];
    const banned = [['Есть ли вагон?', 'b = a\nif x in b:\n    print("YES")\nelse:\n    print("NO")'], ['Есть ли вагон?', 'if x not in a:\n    print("NO")\nelse:\n    print("YES")'], ['Сортировка вагонов', 'a.sort()\nprint(a)'], ['Сортировка вагонов', 'print(sorted(a))'],
      ['Поезд задом наперёд', 'a.reverse()\nprint(a)'], ['Поезд задом наперёд', 'print(list(reversed(a)))'], ['Сумма груза', 's = sum(a)\nprint(s)']];
    const miss = [...good.filter(([t, c]) => !g.check(lv(t), c).ok), ...banned.filter(([t, c]) => !/нельзя использовать/.test(g.check(lv(t), c).msg))];
    check('массивы: запреты по смыслу — for y in a, is_sorted и обмен a[j], a[j + 1] = … проходят; in через другое имя, not in, sort, sorted, reverse — нет', !miss.length, miss.map(x => `${x[0]}: ${x[1].split('\n').slice(-2).join(' / ')}`).join('; ')); }
  // ОГЭ-арена, задание 16: print выводит значения как Python; решение через список и sum() засчитывается.
  { const g = G.oge, lv = g.LEVELS.find(l => l.n === 16); let s = 1; while (!g.progTask(lv, s).text.includes('сумму всех чисел')) s++;
    const k = +g.progTask(lv, s).text.match(/кратных (\d+)/)[1], code = `a = []\nx = int(input())\nwhile x != 0:\n    if x % ${k} == 0:\n        a.append(x)\n    x = int(input())\nprint(sum(a))`, out = g.runPython('print(True, None, [1, 2], 7)', []);
    check('ОГЭ-арена: print(True, None, [1, 2], 7) даёт «True None [1, 2] 7», как Python; задание 16 через список и sum() засчитано', out === 'True None [1, 2] 7' && g.check(lv, {seed: s, code}).stars === 3, out); }
  // ЕГЭ-арена, задание 15: ответ — честный: НОК(p, q) для наибольшего A (даже если он больше 300) и min(p, q) для наименьшего; 100 вариантов.
  { const g = G.ege, lv = g.LEVELS.find(l => l.n === 15), gcd = (a, b) => b ? gcd(b, a % b) : a; let bad = '', big = 0;
    for (let s = 1; s <= 100 && !bad; s++) for (const p of g.problems(lv, s)) { const [u, v] = [...p.text.matchAll(/ДЕЛ\(x, (\d+)\)/g)].map(m => +m[1]), max = /наибольшего/.test(p.text), want = max ? u / gcd(u, v) * v : Math.min(u, v);
      if (p.answer !== want) bad = `вариант ${s}: ответ ${p.answer}, а верно ${want}`; if (max && want > 300) big++; }
    check('ЕГЭ-арена: задание 15 — ответ совпадает с НОК(p, q) или min(p, q) на 100 вариантах, в том числе с ответом больше 300', !bad && big > 0, bad || `ответов больше 300: ${big}`); }
  // ЕГЭ-арена: рекурсия сходится с независимым пересчётом; ответы всех заданий — числа или строки, а не undefined.
  { const g = G.ege; let bad = '';
    for (const l of g.LEVELS) for (let s = 1; s <= 120 && !bad; s++) for (const p of g.problems(l, s)) if (p.answer === undefined || p.answer === null || p.answer === '' || (typeof p.answer === 'number' && !Number.isFinite(p.answer))) bad = `задание ${l.n}, вариант ${s}`;
    const l16 = g.LEVELS.find(l => l.n === 16); for (let s = 1; s <= 100 && !bad; s++) { const p = g.problems(l16, s)[0], c = +p.text.match(/n \+ (\d+) при n < (\d+)/)[1], k = +p.text.match(/при n < (\d+)/)[1], N = +p.text.match(/значение F\((\d+)\)/)[1], sum = /делится на 3/.test(p.text), kk = sum ? 2 : +p.text.match(/2·F\(n − (\d+)\)/)[1];
      const F = n => n < k ? n + c : sum ? F(n - 1) + F(n - 2) + (n % 3 === 0 ? 1 : 0) : F(n - 1) + 2 * F(n - kk); if (F(N) !== p.answer) bad = `рекурсия, вариант ${s}`; }
    check('ЕГЭ-арена: 18 заданий — прежние 12 на своих местах (звёзды учеников не переезжают), новые в конце; ответы определены (120 вариантов каждого), рекурсия сходится с независимым пересчётом', !bad && g.LEVELS.map(l => l.n).join() === '4,5,6,7,8,11,12,13,14,15,16,23,1,2,19,20,21,22', bad || g.LEVELS.map(l => l.n).join()); }
  // ЕГЭ-арена, задания 1, 2, 19–22: ответ пересчитывается заново по тому, что видит ученик (схема, таблица, текст), на 300 вариантах (по три на вариант).
  { const g = G.ege, lv = n => g.LEVELS.find(l => l.n === n), perms = a => a.length < 2 ? [a] : a.flatMap((x, i) => perms(a.filter((_, k) => k !== i)).map(p => [x, ...p])), P = {4: perms([0, 1, 2, 3]), 7: perms([0, 1, 2, 3, 4, 5, 6]), 8: perms([0, 1, 2, 3, 4, 5, 6, 7])};
    // разбор логического выражения с приоритетами ¬, ∧, ∨, →, ≡
    const logic = src => { const tk = src.match(/[wxyz()¬∧∨→≡]/g), OPS = [['≡', (a, b) => a === b], ['→', (a, b) => !a || b], ['∨', (a, b) => a || b], ['∧', (a, b) => a && b]]; let i = 0;
      const prim = () => { const c = tk[i++]; if (c === '¬') { const e = prim(); return v => !e(v); } if (c === '(') { const e = lev(0); i++; return e; } return v => v[c]; };
      const lev = k => { if (k === 4) return prim(); let e = lev(k + 1); while (tk[i] === OPS[k][0]) { i++; const a = e, b = lev(k + 1), fn = OPS[k][1]; e = v => fn(a(v), b(v)); } return e; }; const e = lev(0); return i === tk.length ? e : null; };
    const side = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])), NUM = {один: 1, два: 2, три: 3, четыре: 4, пять: 5};
    let bad = '', sym = 0, sums = 0, luck = 0, byT = 0;
    for (let s = 1; s <= 300 && !bad; s++) {
      // 1: все перестановки пунктов, при которых дороги схемы переходят в дороги таблицы; искомая длина у всех одна; дороги на схеме не пересекаются
      for (const p of g.problems(lv(1), s)) { const {names, edges, pos} = p.graph, n = names.length, w = p.table.slice(1).map(row => row.slice(1).map(Number)), ask = [...p.text.matchAll(/из пункта ([А-Я]) в пункт ([А-Я])/g)].map(m => [names.indexOf(m[1]), names.indexOf(m[2])]), got = new Set(); let iso = 0;
        if (w.flat().filter(Boolean).length !== 2 * edges.length || w.some((row, i) => row.some((x, j) => x !== w[j][i]))) { bad = `задание 1, вариант ${s}: таблица не совпадает со схемой по числу дорог`; break; }
        for (const q of P[n]) if (edges.every(([a, b]) => w[q[a]][q[b]])) { iso++; got.add(ask.reduce((t, [a, b]) => t + w[q[a]][q[b]], 0)); }
        if (!ask.length || ask.some(([a, b]) => !edges.some(e => e[0] === a && e[1] === b))) bad = `задание 1, вариант ${s}: спрошена дорога, которой нет`;
        else if (got.size !== 1 || [...got][0] !== p.answer) bad = `задание 1, вариант ${s}: длины ${[...got]} при ответе ${p.answer}`;
        for (const [a, b] of edges) for (const [c, d] of edges) if (![a, b].some(x => x === c || x === d) && side(pos[a], pos[b], pos[c]) * side(pos[a], pos[b], pos[d]) < 0 && side(pos[c], pos[d], pos[a]) * side(pos[c], pos[d], pos[b]) < 0) bad = `задание 1, вариант ${s}: дороги на схеме пересекаются`;
        if (iso > 1) sym++; if (ask.length > 1) sums++; }
      // 2: все 24 расстановки столбцов и все заполнения пустых клеток; подходит ровно одна расстановка — та, что в ответе
      for (const p of g.problems(lv(2), s)) { const F = logic(p.text.match(/F = (.+?)\. Ниже/)[1]), rows = p.table.slice(1), val = rows[0][4] === '1', holes = [];
        rows.forEach((row, i) => row.slice(0, 4).forEach((c, k) => { if (c === '') holes.push([i, k]); }));
        const fit = P[4].filter(q => { for (let b = 0; b < 1 << holes.length; b++) { const full = rows.map(row => row.slice(0, 4).map(Number)); holes.forEach(([i, k], j) => { full[i][k] = b >> j & 1; });
          if (new Set(full.map(x => x.join(''))).size === 3 && full.every(x => F(Object.fromEntries(x.map((c, k) => ['wxyz'[q[k]], c === 1]))) === val)) return true; } return false; });
        if (!F || rows.length !== 3 || rows.some(row => row[4] !== rows[0][4]) || fit.length !== 1 || fit[0].map(k => 'wxyz'[k]).join('') !== p.answer) bad = `задание 2, вариант ${s}: подходят ${fit.map(q => q.map(k => 'wxyz'[k]).join('')).join(', ') || 'никакие'} при ответе ${p.answer}`; }
      // 19–21: ходы и N читаются из текста (и сверяются с примером), стратегии считаются перебором с ограниченной глубиной
      for (const n of [19, 20, 21]) for (const p of g.problems(lv(n), s)) { const N = +p.text.match(/не менее (\d+) кам/)[1], add = [...p.text.matchAll(/добавить в кучу (\S+) кам/g)].map(m => NUM[m[1]]), mul = [...p.text.matchAll(/в (\S+) раза/g)].map(m => NUM[m[1]]);
        const [, s0, ex] = p.text.match(/из кучи в (\d+) камней за один ход можно получить кучу из (.+?) камн/), mv = x => [...add.map(a => x + a), ...mul.map(k => x * k)];
        const win = (x, k) => mv(x).some(y => y >= N || k > 1 && lose(y, k - 1)), lose = (x, k) => mv(x).every(y => y < N && win(y, k)), S = [...Array(N - 1).keys()].map(x => x + 1);
        const want = n === 20 ? S.filter(x => win(x, 2) && !win(x, 1)) : n === 21 ? S.filter(x => lose(x, 2) && !lose(x, 1)) : /неудачного/.test(p.text) ? S.filter(x => mv(x).some(y => y < N && win(y, 1))) : S.filter(x => lose(x, 1));
        if (ex.split(/, | или /).map(Number).join() !== [...new Set(mv(+s0))].sort((a, b) => a - b).join() || !add.length || add.includes(undefined) || mul.includes(undefined)) bad = `задание ${n}, вариант ${s}: ходы в тексте и в примере расходятся`;
        else if (n === 20 ? want.length !== 2 || want.join(' ') !== p.answer : !want.length || want[0] !== p.answer) bad = `задание ${n}, вариант ${s}: перебор даёт ${want.join(' ')}, а ответ ${p.answer}`;
        if (n === 19 && /неудачного/.test(p.text)) luck++; }
      // 22: время окончания уточняется проходами по таблице, пока не перестанет меняться
      for (const p of g.problems(lv(22), s)) { const rows = p.table.slice(1).map(r => [+r[0], +r[1], r[2] === '0' ? [] : r[2].split(';').map(Number)]), end = {}, T = p.text.match(/не позднее чем через (\d+) мс/);
        for (let pass = 0; pass <= rows.length; pass++) for (const [id, t, d] of rows) end[id] = t + Math.max(0, ...d.map(x => end[x] || 0));
        const want = T ? Object.values(end).filter(x => x <= +T[1]).length : Math.max(...Object.values(end)); if (want !== p.answer || rows.some(([id, , d]) => d.some(x => x === id || !end[x]))) bad = `задание 22, вариант ${s}: пересчёт ${want}, ответ ${p.answer}`; if (T) byT++; } }
    // проверка ответов: верные (и в вольной записи) дают три звезды, неверные не засчитываются
    for (const n of [1, 2, 19, 20, 21, 22]) for (const seed of [1, 2, 3]) { const l = lv(n), ps = g.problems(l, seed), sol = {seed, answers: ps.map(p => String(p.answer))}, stars = a => (g.check(l, {seed, answers: a}) || {}).stars || 0;
      const loose = ps.map(p => p.kind === 'vars' ? ` ${p.answer.toUpperCase().split('').join(', ')} ` : p.kind === 'pair' ? p.answer.replace(' ', ', ') : ` ${p.answer} `), wrong = ps.map(p => p.kind === 'vars' ? [...p.answer].reverse().join('') : p.kind === 'pair' ? p.answer.split(' ').reverse().join(' ') : String(p.answer + 1));
      const ru = ps.map(p => p.kind === 'vars' ? p.answer.replace(/x/g, 'х').replace(/y/g, 'у') : p.kind === 'pair' ? p.answer.replace(' ', ';') : p.answer + ''), half = ps.map(p => p.kind === 'pair' ? p.answer.split(' ')[0] : p.kind === 'vars' ? p.answer.slice(0, 3) : '');
      if (stars(sol.answers) !== 3 || stars(loose) !== 3 || stars(ru) !== 3 || g.check(l, {seed, answers: wrong}).ok || g.check(l, {seed, answers: half}).ok) bad = `задание ${n}, вариант ${seed}: проверка ответа (${loose.join(' / ')} | ${wrong.join(' / ')})`; }
    check('ЕГЭ-арена: задания 1, 2, 19–22 сходятся с независимым перебором на 300 вариантах; в 1 и 2 ответ единственный; вольная запись ответа принимается, неверная — нет', !bad && sym > 0 && sums > 0 && luck > 0 && byT > 0, bad || `симметричных схем ${sym}, сумм двух дорог ${sums}, «неудачный ход» ${luck}, «к моменту T» ${byT}`); }
  // Новые игры: верстальщик — исходный документ всегда отличается от образца; компьютер — деталь не в своём гнезде не проходит; автопилот — заученный маршрут не долетает.
  { const lo = G.layout, ap = G.autopilot; let bad = '';
    for (const l of lo.LEVELS) { const st = l.doc.map(p => { const o = {...p}; for (const k of l.used) o[k] = {align: 'left', bold: false, italic: false, size: 'm', kind: 'p', indent: false, margin: 0}[k]; return o; }); if (lo.check(l, st).ok) bad = 'верстальщик: «' + l.title + '» уже готов в начале'; }
    check('новые игры: документ не готов сразу и заученный маршрут дрона не проходит (сборку компьютера теперь проверяет tests/pc3d.gd)', !bad && !ap.check(ap.LEVELS[0], {seed: 3, code: 'forward()\nforward()\nforward()'}).ok && ap.check(ap.LEVELS[7], ap.solve(ap.LEVELS[7])).ok, bad); }
  module.exports.done();
}
