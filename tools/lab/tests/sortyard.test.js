// «Сортировочная горка» без браузера: node tools/lab/tests/sortyard.test.js
// Ходы игры сверяются с независимой записью алгоритмов «по учебнику» на 320 составах каждого уровня: образцовый путь проходится,
// любой другой ход отклоняется с объяснением и не меняет состояние, ответы задач на счёт сходятся с прогоном и перебором.
const path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); require(path.join(dir, 'games', 'sortyard.js'));
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };
const g = LAB.games.find(x => x.id === 'sortyard'), LV = g.LEVELS, SEEDS = Array.from({length: 320}, (_, i) => i + 1);
const J = x => JSON.stringify(x), range = (a, b) => Array.from({length: b - a + 1}, (_, i) => a + i);

/* ---------- независимые реализации (как в учебнике, без кода игры) ---------- */
function bubbleTrace(a0, passes, flag) { const a = a0.slice(), n = a.length, ev = [];
  for (let i = 0; i < passes; i++) { let f = false; for (let j = 0; j < n - 1 - i; j++) { ev.push(['cmp', j]); if (a[j] > a[j + 1]) { const t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; ev.push(['swap']); f = true; } } if (flag && !f) break; }
  ev.push(['stop']); return {ev, a}; }
function selectTrace(a0) { const a = a0.slice(), ev = []; for (let i = 0; i < a.length - 1; i++) { let m = i; for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j; ev.push(['pick', m]); const t = a[i]; a[i] = a[m]; a[m] = t; } ev.push(['stop']); return {ev, a}; }
function insertTrace(a0) { const a = a0.slice(), ev = []; let shifts = 0; for (let i = 1; i < a.length; i++) { const x = a[i]; let j = i - 1; while (j >= 0 && a[j] > x) { a[j + 1] = a[j]; j--; shifts++; } a[j + 1] = x; ev.push(['ins', j + 1]); } ev.push(['stop']); return {ev, a, shifts}; }
const swapsBySim = a0 => { const a = a0.slice(); let k = 0; for (let i = 0; i < a.length; i++) for (let j = 0; j + 1 < a.length - i; j++) if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; k++; } return k; };
const invPairs = a => { let k = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) k++; return k; };
const selAfter = (a0, k) => { const a = a0.slice(); for (let i = 0; i < k; i++) { let m = i; for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j; const t = a[i]; a[i] = a[m]; a[m] = t; } return a; };
// Двоичный поиск по правилу «открывай середину»: все исходы перебором — и для (L + R) // 2, и для (L + R + 1) // 2.
const bsearch = (a, x, up) => { let L = 0, R = a.length - 1, k = 0; while (L <= R) { const c = Math.floor((L + R + (up ? 1 : 0)) / 2); k++; if (a[c] === x) return k; if (a[c] < x) L = c + 1; else R = c - 1; } return k; };
const bruteWorst = n => { const a = range(1, n).map(v => 2 * v); let w = 0; for (let x = 1; x <= 2 * n + 1; x++) for (const up of [false, true]) w = Math.max(w, bsearch(a, x, up)); return w; };
const sorted = a => a.slice().sort((x, y) => x - y);

// Все мыслимые ходы на составе из n вагонов — чтобы проверить, что принимается только ход алгоритма.
const universe = n => [...range(-1, n).map(j => ['cmp', j]), ['swap'], ['stop'], ...range(-1, n).map(k => ['pick', k]), ...range(-1, n + 1).map(p => ['ins', p]), ...range(-1, n).map(c => ['probe', c]), ['none'], ['ans', '0'], ['ans', ''], [], ['zzz'], ['cmp', '0x'], ['pick', 1.5]];
const K = new Set(['bubble', 'select', 'insert', 'search', 'quiz']);
check('уровней 10–12, у каждого название, условие и код на Python, виды — пузырёк, выбор, вставки, поиск, задачи на счёт',
  LV.length >= 10 && LV.length <= 12 && LV.every(l => l.title && l.brief && K.has(l.kind) && g.codeOf(l)) && [...K].every(k => LV.some(l => l.kind === k)) && LV.some(l => l.flag) && LV.some(l => l.passes === 1), LV.map(l => l.kind).join(' '));
for (const grade of [6, 7, 8, 9, 10, 11]) { const r = g.levels(grade).map(l => g.check(l, g.solve(l, grade), grade)); if (grade === 9 || grade === 11) check(`${grade} класс: образцовые решения всех уровней — три звезды`, r.every(x => x.ok && x.stars === 3), J(r.find(x => !x.ok || x.stars !== 3) || '')); }

/* ---------- пошаговые уровни ---------- */
for (const [li, lv] of LV.entries()) { if (lv.kind === 'quiz' || lv.kind === 'search') continue;
  let info = '', paths = 0, probes = 0;
  for (const seed of SEEDS) { if (info) break;
    let s = g.start(lv, seed); const a0 = s.a.slice(), n = a0.length;
    if (J(g.start(lv, seed)) !== J(s)) { info = `состав ${seed}: генератор не детерминирован`; break; }
    const ref = lv.kind === 'bubble' ? bubbleTrace(a0, lv.passes || n - 1, !!lv.flag) : lv.kind === 'select' ? selectTrace(a0) : insertTrace(a0);
    for (const [k, m] of ref.ev.entries()) {
      const want = new Set([g.key(m)]), got = g.expect(lv, s).map(g.key); if (got.length !== 1 || got[0] !== g.key(m)) { info = `состав ${seed}, ход ${k + 1}: игра ждёт ${got}, алгоритм делает ${g.key(m)}`; break; }
      // Подсказка в объяснении ошибки: какой ход алгоритм сделает следующим.
      const hint = m[0] === 'cmp' ? `a[${m[1]}] и a[${m[1] + 1}]` : m[0] === 'swap' ? 'поменять' : m[0] === 'stop' ? '«Готово»' : m[0] === 'pick' ? `(a[${m[1]}])` : `a[${m[1]}]`;
      const before = J(s);
      for (const c of universe(n)) { const r = g.step(lv, s, c); probes++;
        if (r.ok !== want.has(g.key(c))) { info = `состав ${seed}, ход ${k + 1}: ${J(c)} ${r.ok ? 'принят, хотя алгоритм делает ' + g.key(m) : 'отклонён'}`; break; }
        if (!r.ok && (r.st !== s || typeof r.msg !== 'string' || !r.msg.includes(hint))) { info = `состав ${seed}, ход ${k + 1}: ${J(c)} — ${r.st !== s ? 'состояние изменилось' : 'в объяснении нет «' + hint + '»: ' + r.msg}`; break; } }
      if (!info && J(s) !== before) info = `состав ${seed}: проверка хода изменила исходное состояние`;
      if (info) break; s = g.step(lv, s, m).st; }
    if (info) break;
    if (!s.done) { info = `состав ${seed}: после образцовых ходов алгоритм не закончен`; break; }
    const full = !(lv.kind === 'bubble' && lv.passes === 1);
    if (J(s.a) !== J(ref.a) || (full && J(s.a) !== J(sorted(a0)))) { info = `состав ${seed}: итог ${s.a} вместо ${ref.a}`; break; }
    if (lv.kind === 'bubble' && (s.comps !== ref.ev.filter(e => e[0] === 'cmp').length || s.swaps !== ref.ev.filter(e => e[0] === 'swap').length || (full && s.swaps !== invPairs(a0)))) { info = `состав ${seed}: счётчики ${s.comps}/${s.swaps}`; break; }
    if (lv.kind === 'insert' && (s.shifts !== ref.shifts || s.shifts !== invPairs(a0))) { info = `состав ${seed}: сдвигов ${s.shifts}, а по алгоритму ${ref.shifts}`; break; }
    // Звёзды: без ошибок — 3, одна ошибка — 2, две и больше — 1; без последнего хода уровень не пройден.
    const wrongAt = (k, cnt) => { const out = []; let t = g.start(lv, seed); ref.ev.forEach((m, i) => { if (i === k) for (let w = 0; w < cnt; w++) out.push(universe(n).find(c => !g.step(lv, t, c).ok)); out.push(m); t = g.step(lv, t, m).st; }); return out; };
    const k = seed % ref.ev.length, c3 = g.check(lv, {seed, steps: ref.ev}), c2 = g.check(lv, {seed, steps: wrongAt(k, 1)}), c1 = g.check(lv, {seed, steps: wrongAt(k, 2)}), c0 = g.check(lv, {seed, steps: wrongAt(k, 6)}), cut = g.check(lv, {seed, steps: ref.ev.slice(0, -1)});
    if (!(c3.ok && c3.stars === 3 && c2.ok && c2.stars === 2 && c1.ok && c1.stars === 1 && c0.ok && c0.stars === 1 && !cut.ok)) { info = `состав ${seed}: звёзды ${[c3, c2, c1, c0, cut].map(c => c.ok ? c.stars : 'нет')}`; break; }
    // Ограничения генератора: длина, разные номера там, где повторов быть не должно, особые случаи уровня.
    const dist = new Set(a0).size === n, bub = bubbleTrace(a0, n - 1, true);
    const lastPass = (() => { const b = a0.slice(); let last = 0; for (let i = 0; i < n - 1; i++) { let f = false; for (let j = 0; j < n - 1 - i; j++) if (b[j] > b[j + 1]) { [b[j], b[j + 1]] = [b[j + 1], b[j]]; f = true; } if (f) last = i + 1; } return last; })();
    const okGen = li <= 4 ? (li === 3 ? new Set(a0).size === n - 1 : dist) && n === [5, 5, 7, 6, 6][li] && a0.every(v => v >= 10 && v <= 99) : n === 8 && !dist;
    const special = [
      () => { const sw = bubbleTrace(a0, 1, false).ev.filter(e => e[0] === 'swap').length; return sw >= 2 && sw <= 3; },
      () => lastPass < n - 1,                                   // состав упорядочен раньше последнего прохода: «Готово» до конца — ошибка
      () => lastPass + 1 < n - 1 && lastPass >= 2,             // флаг экономит проходы
      () => ref.ev.some((e, i) => e[0] === 'pick' && e[1] === i), // есть проход без обмена
      () => ref.ev.some((e, i) => e[0] === 'ins' && e[1] === i + 1) && ref.ev.some(e => e[0] === 'ins' && e[1] === 0),
      null, null, null, null, null,
      () => a0.some((v, i) => a0.slice(0, i).includes(v)),
      () => bub.ev.length < bubbleTrace(a0, n - 1, false).ev.length && (() => { const b = a0.slice(); for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1 - i; j++) { if (b[j] === b[j + 1]) return true; if (b[j] > b[j + 1]) [b[j], b[j + 1]] = [b[j + 1], b[j]]; } return false; })(),
    ][li];
    if (!okGen || (special && !special())) { info = `состав ${seed}: генератор выдал неподходящий состав ${a0}`; break; }
    paths++; }
  check(`уровень ${li + 1} «${lv.title}»: ходы совпадают с алгоритмом, любой другой ход отклонён с объяснением, звёзды 3/2/1`, !info && paths === SEEDS.length, info || `${paths} составов, проверено ходов: ${probes}`);
}

/* ---------- двоичный поиск ---------- */
for (const [li, lv] of LV.entries()) { if (lv.kind !== 'search') continue;
  let info = '', walks = 0, absent = 0, present = 0;
  for (const seed of SEEDS) { if (info) break;
    const s0 = g.start(lv, seed), {a, x} = s0, n = a.length, has = a.indexOf(x), bits = n.toString(2).length;
    if (!a.every((v, i) => !i || v > a[i - 1]) || (li === 5 && (n !== 15 || has < 0)) || (li === 8 && (n < 20 || n > 31))) { info = `состав ${seed}: неверный состав`; break; }
    if (has < 0) absent++; else present++;
    for (let w = 0; w < 12 && !info; w++) { let s = s0, L = 0, R = n - 1, used = 0;
      for (let k = 0; k < 40; k++) {
        const want = L > R ? ['none'] : [...new Set([Math.floor((L + R) / 2), Math.ceil((L + R) / 2)])].map(c => 'probe ' + c), got = g.expect(lv, s).map(g.key);
        if (J(got.sort()) !== J(want.slice().sort())) { info = `состав ${seed}: игра ждёт ${got}, а середина участка a[${L}]…a[${R}] — ${want}`; break; }
        const before = J(s); for (const c of universe(n)) { const r = g.step(lv, s, c); if (r.ok !== want.includes(g.key(c)) || (!r.ok && (r.st !== s || !r.msg.includes(L > R ? 'Такого вагона нет' : `a[${Math.floor((L + R) / 2)}]`)))) { info = `состав ${seed}: ход ${J(c)} — ${r.ok ? 'принят' : r.msg}`; break; } }
        if (!info && J(s) !== before) info = `состав ${seed}: проверка хода изменила исходное состояние`; if (info) break;
        const pick = w === 0 ? want[0] : w === 1 ? want[want.length - 1] : want[(seed * 7 + w * 3 + k) % want.length], m = pick === 'none' ? ['none'] : ['probe', Number(pick.split(' ')[1])];
        s = g.step(lv, s, m).st; if (m[0] === 'none') break; used++; const c = m[1]; if (a[c] === x) break; if (a[c] < x) L = c + 1; else R = c - 1; }
      if (info) break;
      if (!s.done || (has >= 0 ? s.found !== has : s.found !== -1) || s.probes !== used || used > bits) { info = `состав ${seed}: поиск закончился неверно (${s.found}, ${used} вскрытий, предел ${bits})`; break; }
      walks++; } }
  check(`уровень ${li + 1} «${lv.title}»: вскрывать можно только середину (обе договорённости), поиск находит вагон или доказывает, что его нет`, !info && walks === SEEDS.length * 12 && (li === 5 ? absent === 0 : absent > 40 && present > 40), info || `${walks} поисков, нет вагона: ${absent}, есть: ${present}`);
}
{ const lv = LV.find(l => l.kind === 'search'), sol = g.solve(lv), s = g.start(lv, 1), up = []; let t = s; while (!t.done) { const e = g.expect(lv, t); up.push(e[e.length - 1]); t = g.step(lv, t, up[up.length - 1]).st; }
  check('поиск: засчитываются и (L + R) // 2, и (L + R + 1) // 2; лишнее вскрытие — две звезды', g.check(lv, sol).stars === 3 && g.check(lv, {seed: 1, steps: up}).stars === 3 && g.check(lv, {seed: 1, steps: [['probe', 0], ...sol.steps]}).stars === 2); }

/* ---------- задачи на счёт ---------- */
{ let info = ''; for (let n = 1; n <= 1100 && !info; n++) { const w = bruteWorst(n); if (w !== Math.ceil(Math.log2(n + 1)) || w !== g.worst(n)) info = `n = ${n}: перебор ${w}, формула ${Math.ceil(Math.log2(n + 1))}, игра ${g.worst(n)}`; }
  check('наибольшее число вскрытий = ⌈log₂(n + 1)⌉ — перебором всех номеров (есть и нет) при обоих выборах середины, n = 1…1100', !info, info); }
for (const [li, lv] of LV.entries()) { if (lv.kind !== 'quiz') continue;
  let info = '', count = 0; const seen = new Set();
  for (const seed of SEEDS) { if (info) break;
    for (let k = 0; k < 4 && !info; k++) { const p = g.problem(lv, seed, k); seen.add(String(p.answer)); count++;
      if (!p.text || !p.explain || !p.explain.includes(String(p.answer).split(' ').pop())) { info = `вариант ${seed}/${k}: нет условия или разбора`; break; }
      if (lv.gen.name === 'inv' || /обменов/.test(lv.title)) { if (p.answer !== swapsBySim(p.a) || p.answer !== invPairs(p.a) || new Set(p.a).size !== p.a.length) info = `вариант ${seed}/${k}: ${p.a} — ответ ${p.answer}, а пузырёк делает ${swapsBySim(p.a)}`; }
      else if (/проход/.test(lv.title)) { const kk = Number(p.text.match(/после (\d+) проход/)[1]), want = selAfter(p.a, kk); if (p.answer !== want.join(' ') || J(want) === J(sorted(p.a))) info = `вариант ${seed}/${k}: ${p.a}, ${kk} проходов — ${p.answer} вместо ${want.join(' ')}`; }
      else { const n = Number(p.text.match(/составе (\d+) вагон/)[1]); if (p.answer !== bruteWorst(n)) info = `вариант ${seed}/${k}: n = ${n}, ответ ${p.answer}, перебор ${bruteWorst(n)}`; } }
    // Ответ засчитывается в любой записи чисел; неверный ответ даёт разбор с правильным и новую задачу; звёзды по числу ошибок.
    const s0 = g.start(lv, seed), p0 = g.problem(lv, seed, 0), loose = '[' + String(p0.answer).split(' ').join(', ') + ']', bad0 = g.step(lv, s0, ['ans', String(Number(String(p0.answer).split(' ')[0]) + 1)]);
    if (!g.step(lv, s0, ['ans', loose]).ok || !g.step(lv, s0, ['ans', ` ${p0.answer} `]).ok || bad0.ok || !bad0.msg.includes('правильный ответ: ' + p0.answer) || bad0.st.k !== 1 || g.step(lv, s0, ['ans', String(p0.answer) + ' 1']).ok) { info = `вариант ${seed}: проверка записи ответа`; break; }
    const play = wrong => { const out = []; let s = g.start(lv, seed); for (let i = 0; !s.done && i < 20; i++) { const m = i < wrong ? ['ans', '-1'] : g.expect(lv, s)[0]; out.push(m); s = g.step(lv, s, m).st; } return out; };
    const st = [0, 1, 2, 4].map(w => g.check(lv, {seed, steps: play(w)})), cut = g.check(lv, {seed, steps: play(0).slice(0, -1)});
    if (J(st.map(c => c.ok && c.stars)) !== J([3, 2, 1, 1]) || cut.ok || play(0).length !== lv.need) info = `вариант ${seed}: звёзды ${J(st.map(c => c.stars))}`; }
  check(`уровень ${li + 1} «${lv.title}»: ответы сходятся с прогоном алгоритма или перебором, запись ответа свободная, звёзды 3/2/1`, !info && seen.size > 3, info || `${count} задач, разных ответов: ${seen.size}`);
}

/* ---------- проверка ответа ---------- */
{ const lv = LV[1], sol = g.solve(lv);
  check('проверка: пустой и испорченный ответ, ходы после конца не мешают', [null, {}, {seed: 1.5, steps: []}, {seed: 1, steps: 'x'}, {seed: 1, steps: []}, {seed: 1, steps: [null, 'x', 5]}].every(a => !g.check(lv, a).ok)
    && g.check(lv, {seed: 1, steps: [...sol.steps, ['cmp', 0], ['zzz']]}).stars === 3 && g.step(lv, g.step(lv, g.start(lv, 1), sol.steps[0]).st, sol.steps[0]).ok === false); }
console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
