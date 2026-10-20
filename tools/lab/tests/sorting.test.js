// Проверка «Сортировочной станции» без браузера: node tools/lab/tests/sorting.test.js
// Счётчики и эталонные последовательности пересчитываются здесь независимо от кода игры.
const path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); require(path.join(dir, 'games', 'sorting.js'));
const g = LAB.games.find(x => x.id === 'sorting');
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Независимые реализации.
const bubble = (src, flag) => { const a = src.slice(), sw = []; let cmp = 0; for (let p = 1; p < a.length; p++) { let any = false; for (let j = 0; j + p < a.length; j++) { cmp++; if (a[j] > a[j + 1]) { const t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; sw.push(j); any = true; } } if (flag && !any) break; } return {sw, cmp}; };
const insertion = src => { const a = src.slice(), sw = []; let cmp = 0; for (let i = 1; i < a.length; i++) { let j = i; while (j > 0) { cmp++; if (a[j - 1] <= a[j]) break; const t = a[j]; a[j] = a[j - 1]; a[j - 1] = t; sw.push(j - 1); j--; } } return {sw, cmp}; };
const selection = src => { const a = src.slice(); let k = 0; for (let i = 0; i < a.length; i++) { let m = i; for (let j = i; j < a.length; j++) if (a[j] < a[m]) m = j; if (m !== i) { [a[i], a[m]] = [a[m], a[i]]; k++; } } return k; };
const cycles = a => { const s = a.slice().sort((x, y) => x - y), seen = new Set(); let c = 0; for (let i = 0; i < a.length; i++) if (!seen.has(i)) { c++; let j = i; while (!seen.has(j)) { seen.add(j); j = s.indexOf(a[j]); } } return c; };
const inv = a => a.reduce((s, x, i) => s + a.slice(i + 1).filter(y => y < x).length, 0);

for (const grade of [6, 7, 8, 9, 10, 11]) {
  const L = g.levels(grade); let ok = L.length === 8, info = '';
  L.forEach((lv, i) => { const r = g.check(lv, g.solve(lv, grade), grade); if (!r.ok || r.stars !== 3) { ok = false; info = `уровень ${i + 1}: ${JSON.stringify(r)}`; } });
  check(`${grade} класс: 8 уровней, образцовые решения дают три звезды`, ok, info);
}
check('данные уровня одинаковы при повторном входе и различаются по классам', eq(g.levels(10), g.levels(10)) && !eq(g.levels(9)[1].a, g.levels(10)[1].a) && !eq(g.levels(10)[1].a, g.levels(11)[1].a));
check('уровни идут в нужном порядке', eq(g.levels(9).map(l => l.kind), ['bubble', 'bubble', 'insertion', 'selection', 'binary', 'merge', 'count', 'stable']));

for (const grade of [9, 10, 11]) {
  const L = g.levels(grade), by = k => L.filter(l => l.kind === k);
  // Пузырёк и вставки: эталон совпадает с независимой реализацией, любые отклонения отклоняются.
  { let ok = true, info = '';
    for (const lv of [...by('bubble'), ...by('insertion')]) {
      const ind = lv.kind === 'bubble' ? bubble(lv.a) : insertion(lv.a), sol = g.solve(lv);
      if (!eq(sol, ind.sw)) { ok = false; info = `${lv.title}: эталон ${sol} ≠ ${ind.sw}`; }
      const r = g.check(lv, sol); if (r.cmp !== ind.cmp || r.swp !== inv(lv.a)) { ok = false; info = `${lv.title}: счётчики ${r.cmp}/${r.swp}, нужно ${ind.cmp}/${inv(lv.a)}`; }
      const bads = [sol.slice(0, -1), sol.concat([0]), [], 'x', sol.map((j, k) => k === sol.length - 1 ? (j + 1) % (lv.a.length - 1) : j)];
      for (let k = 0; k + 1 < sol.length; k++) if (sol[k] !== sol[k + 1]) { const s = sol.slice(); [s[k], s[k + 1]] = [s[k + 1], s[k]]; bads.push(s); }
      // Другой алгоритм с тем же числом обменов тоже не проходит.
      bads.push(lv.kind === 'bubble' ? insertion(lv.a).sw : bubble(lv.a).sw);
      for (const b of bads) if (!eq(b, sol) && g.check(lv, b).ok) { ok = false; info = `${lv.title}: принята последовательность ${JSON.stringify(b)}`; } }
    check(`${grade} класс: пузырёк и вставки — эталон и счётчики сходятся, отклонения отклоняются`, ok, info); }
  // Выбор: эталон — наименьшее число обменов n − (число циклов); лишние обмены снижают звёзды, несортированный состав не проходит.
  { const lv = by('selection')[0], sol = g.solve(lv), min = lv.a.length - cycles(lv.a), r = g.check(lv, sol);
    const longer = [[0, 1], [0, 1], ...sol], r2 = g.check(lv, longer), r3 = g.check(lv, sol.slice(0, -1)), r4 = g.check(lv, [[0, 0]]);
    check(`${grade} класс: выбор — ${sol.length} обменов = n − циклы = ${min} = ${selection(lv.a)}, лишние обмены дают меньше звёзд`, sol.length === min && min === selection(lv.a) && r.stars === 3 && r2.ok && r2.stars === 2 && !r3.ok && !r4.ok); }
  // Двоичный поиск: бюджет ⌈log2 n⌉, эталон в бюджете, линейный перебор и перерасход отклоняются.
  { const lv = by('binary')[0], n = lv.vals.length, budget = Math.ceil(Math.log2(n)), sol = g.solve(lv), t = lv.vals.indexOf(lv.x);
    const sorted = lv.vals.every((v, i) => !i || lv.vals[i - 1] < v), linear = Array.from({length: t + 1}, (_, i) => i), miss = lv.vals.map((_, i) => i).filter(i => i !== t).slice(0, budget);
    const over = miss.slice(0, budget).concat([t]);
    check(`${grade} класс: двоичный поиск — n = ${n}, бюджет ${budget}, эталон за ${sol.length}, перерасход и промахи отклоняются`,
      sorted && lv.budget === budget && sol.length <= budget && lv.vals[sol[sol.length - 1]] === lv.x && g.check(lv, sol).ok && (t + 1 > budget ? !g.check(lv, linear).ok : true) && !g.check(lv, over).ok && g.check(lv, over).over && !g.check(lv, miss).ok && !g.check(lv, []).ok && !g.check(lv, [n]).ok && t + 1 > budget); }
  // Слияние: независимое устойчивое слияние; взять Б при равных головах или больший вагон — ошибка; незаконченное слияние не проходит.
  { const lv = by('merge')[0], {A, B} = lv, ch = []; let i = 0, j = 0, cmp = 0, tieAt = -1;
    while (i < A.length && j < B.length) { cmp++; if (A[i] === B[j] && tieAt < 0) tieAt = ch.length; if (B[j] < A[i]) { ch.push('B'); j++; } else { ch.push('A'); i++; } }
    const sol = g.solve(lv), r = g.check(lv, sol), unstable = ch.slice(0, tieAt).concat(['B']), flipOne = ch.map((c, k) => k === 0 ? (c === 'A' ? 'B' : 'A') : c);
    const full = ch.concat(Array(A.length - i).fill('A'), Array(B.length - j).fill('B')), wrongTail = ch.concat([i < A.length ? 'B' : 'A']);
    check(`${grade} класс: слияние — эталон устойчив, ${cmp} сравнений, неустойчивый и неверный выбор отклоняются`, eq(sol, ch) && r.ok && r.cmp === cmp && tieAt >= 0 && !g.check(lv, unstable).ok && !g.check(lv, flipOne).ok && !g.check(lv, ch.slice(0, -1)).ok && g.check(lv, full).ok && !g.check(lv, wrongTail).ok); }
  // Прогноз счётчиков: пересчёт независимой реализацией; ошибка на единицу в любом вопросе отклоняется.
  { const lv = by('count')[0], f = {bc: a => bubble(a).cmp, bs: a => inv(a), is: a => insertion(a).sw.length, ic: a => insertion(a).cmp, ss: selection, bf: a => bubble(a, true).cmp};
    const want = lv.ask.map(k => f[k](lv.a)); let ok = g.check(lv, want).ok && eq(g.solve(lv), want) && !g.check(lv, want.map(String).map((x, i) => i ? x : '')).ok;
    for (let i = 0; i < want.length; i++) { const w = want.slice(); w[i]++; if (g.check(lv, w).ok) ok = false; }
    check(`${grade} класс: прогноз (${lv.ask.join(', ')}) = ${want.join(', ')} сходится с пересчётом, ошибки на единицу отклоняются`, ok); }
  // Устойчивость: независимо проверяем, что выбор ставит Б левее А, а пузырёк и вставки — нет.
  { const lv = by('stable')[0], it = lv.items.map(x => ({...x})); for (let i = 0; i < it.length; i++) { let m = i; for (let j = i + 1; j < it.length; j++) if (it[j].v < it[m].v) m = j; [it[i], it[m]] = [it[m], it[i]]; }
    const tags = it.filter(x => x.tag).map(x => x.tag).join(''), st = ['bubble', 'insertion', 'merge'];
    check(`${grade} класс: устойчивость — выбор даёт порядок ${tags}, неверные ответы отклоняются`, tags === 'БА' && lv.first === 'Б' && g.check(lv, {stable: st, first: 'Б'}).ok && !g.check(lv, {stable: st, first: 'А'}).ok && !g.check(lv, {stable: [...st, 'selection'], first: 'Б'}).ok && !g.check(lv, {stable: ['bubble'], first: 'Б'}).ok && !g.check(lv, null).ok); }
}
console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
