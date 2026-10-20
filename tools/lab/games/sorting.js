// «Сортировочная станция»: алгоритмы сортировки и поиска на путях сортировочной горки (9–11 классы).
// Вагоны — элементы массива. Пузырёк, вставки и выбор выполняются обмен за обменом со счётчиками сравнений и обменов,
// двоичный поиск — с бюджетом вопросов ⌈log2 n⌉, слияние двух отсортированных составов, прогноз счётчиков и устойчивость.
// check/solve не трогают страницу: ответы — последовательности обменов, номера открытых вагонов, числа. Тест: tools/lab/tests/sorting.test.js.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const distinct = (r, n, lo, hi) => { const s = new Set(); while (s.size < n) s.add(ri(r, lo, hi)); return [...s]; };
  const shuffle = (r, a) => { for (let i = a.length - 1; i > 0; i--) { const j = ri(r, 0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const inversions = a => { let k = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) k++; return k; };
  const isSorted = a => a.every((x, i) => !i || a[i - 1] <= x);
  const isInt = x => Number.isInteger(x);

  // Трассы алгоритмов: события {t: 'c' — сравнение пары (j, j+1), 's' — обмен пары (j, j+1)}, k — номер прохода / вставляемого вагона.
  function bubbleTrace(src, flag) {
    const a = src.slice(), ev = [], n = a.length;
    for (let i = 0; i < n - 1; i++) { let sw = false;
      for (let j = 0; j < n - 1 - i; j++) { ev.push({t: 'c', j, k: i}); if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; ev.push({t: 's', j, k: i}); sw = true; } }
      if (flag && !sw) break; }
    return ev;
  }
  function insertionTrace(src) {
    const a = src.slice(), ev = [];
    for (let i = 1; i < a.length; i++) for (let j = i; j > 0; j--) { ev.push({t: 'c', j: j - 1, k: i}); if (a[j - 1] > a[j]) { [a[j - 1], a[j]] = [a[j], a[j - 1]]; ev.push({t: 's', j: j - 1, k: i}); } else break; }
    return ev;
  }
  // Выбор: ищем минимум (первый из равных) в хвосте и ставим на место i; если он уже там — обмена нет.
  function selectionSwaps(src) {
    const a = src.slice(), out = [];
    for (let i = 0; i < a.length - 1; i++) { let m = i; for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j; if (m !== i) { [a[i], a[m]] = [a[m], a[i]]; out.push([i, m]); } }
    return out;
  }
  const minSwaps = a => { const order = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map(p => p[1]), seen = Array(a.length).fill(false); let cyc = 0;
    for (let i = 0; i < a.length; i++) if (!seen[i]) { cyc++; for (let j = i; !seen[j]; j = order[j]) seen[j] = true; } return a.length - cyc; };
  const swapsOf = ev => ev.filter(e => e.t === 's').map(e => e.j), cmpsOf = ev => ev.filter(e => e.t === 'c').length;
  const COUNT = {
    bc: {q: 'Сколько сравнений сделает пузырёк, если выполнить все n − 1 проходов?', f: a => cmpsOf(bubbleTrace(a))},
    bs: {q: 'Сколько обменов сделает пузырёк?', f: a => swapsOf(bubbleTrace(a)).length},
    is: {q: 'Сколько обменов соседей сделает сортировка вставками?', f: a => swapsOf(insertionTrace(a)).length},
    ic: {q: 'Сколько сравнений сделает сортировка вставками? (Вставка вагона останавливается, когда левый сосед не больше или вагон дошёл до начала.)', f: a => cmpsOf(insertionTrace(a))},
    ss: {q: 'Сколько обменов сделает сортировка выбором? (Если минимум уже стоит на своём месте, обмена нет.)', f: a => selectionSwaps(a).length},
    bf: {q: 'Сколько сравнений сделает пузырёк с флагом: он останавливается после первого прохода без обменов?', f: a => cmpsOf(bubbleTrace(a, true))},
  };
  const binSearch = (vals, x) => { const q = []; let lo = 0, hi = vals.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; q.push(m); if (vals[m] === x) break; if (vals[m] < x) lo = m + 1; else hi = m - 1; } return q; };
  const mergeRef = (A, B) => { const out = []; let i = 0, j = 0; while (i < A.length && j < B.length) if (A[i] <= B[j]) { out.push('A'); i++; } else { out.push('B'); j++; } return out; };
  const ALG = {bubble: 'Пузырёк', selection: 'Выбор', insertion: 'Вставки', merge: 'Слияние'}, STABLE = ['bubble', 'insertion', 'merge'];
  const selOrder = items => { const a = items.map(x => ({...x})); for (let i = 0; i < a.length - 1; i++) { let m = i; for (let j = i + 1; j < a.length; j++) if (a[j].v < a[m].v) m = j; [a[i], a[m]] = [a[m], a[i]]; } return a; };

  // Уровни: данные зависят от класса и номера уровня (одни и те же при каждом входе).
  const SIZE = {9: [5, 6, 6, 7, 15, 4, 6, 6], 10: [6, 7, 7, 8, 31, 5, 7, 7], 11: [6, 8, 8, 9, 50, 6, 8, 8]};
  const ASK = {9: ['bc', 'bs'], 10: ['bs', 'is', 'ic'], 11: ['bs', 'ic', 'ss', 'bf']};
  function build(grade) {
    const g = Math.max(9, Math.min(11, grade | 0 || 9)), sz = SIZE[g], R = k => rng(g * 1009 + k * 7919 + 13), L = [];
    const train = (r, n, min) => { let a; do a = distinct(r, n, 10, 99); while (inversions(a) < min); return a; };
    { const a = train(R(1), sz[0], sz[0]); L.push({kind: 'bubble', guided: true, title: 'Горка: первый пузырёк', a, ev: bubbleTrace(a),
      brief: 'Пузырёк идёт по составу слева направо и сравнивает соседние вагоны. Если левый тяжелее правого — их меняют местами. После каждого прохода самый тяжёлый вагон «всплывает» в конец, и следующий проход на один вагон короче. Горка сама показывает пару — реши: менять или оставить.'}); }
    { const a = train(R(2), sz[1], sz[1] + 2); L.push({kind: 'bubble', title: 'Пузырёк без подсказок', a, ev: bubbleTrace(a),
      brief: 'Теперь горка пару не подсвечивает. Нажимай на сцепку ⇄ между вагонами ровно в том порядке, в каком обмены делает пузырёк: проход за проходом, слева направо. Любой «лишний» или преждевременный обмен диспетчер отклонит.'}); }
    { const a = train(R(3), sz[2], sz[2] + 1); L.push({kind: 'insertion', title: 'Сортировка вставками', a, ev: insertionTrace(a),
      brief: 'Слева — уже отсортированная часть. Берём следующий вагон и двигаем его влево обменами с соседом, пока левый сосед тяжелее. Потом берём следующий. Делай обмены сцепками ⇄ точно в порядке алгоритма.'}); }
    { const r = R(4); let a; do a = distinct(r, sz[3], 10, 99); while (minSwaps(a) < sz[3] - 2); L.push({kind: 'selection', title: 'Выбор: меньше обменов', a, min: minSwaps(a),
      brief: 'Маневровый тепловоз может поменять местами любые два вагона. Расставь состав по возрастанию за наименьшее число обменов. Подсказка: сортировка выбором ставит на место i минимум из оставшихся и не делает обмена, если минимум уже на месте. Нажми на один вагон, потом на другой.'}); }
    { const r = R(5), n = sz[4], vals = distinct(r, n, 100, 999).sort((x, y) => x - y), budget = Math.ceil(Math.log2(n)), deep = vals.map((v, i) => i).filter(i => binSearch(vals, vals[i]).length === budget), t = deep[ri(r, 0, deep.length - 1)];
      L.push({kind: 'binary', title: 'Найди вагон', vals, x: vals[t], budget,
        brief: `На пути ${n} закрытых вагонов, их номера идут по возрастанию. Найди вагон № ${vals[t]}, открыв не больше ⌈log2 ${n}⌉ = ${budget} вагонов. Открытый вагон показывает свой номер — и ты понимаешь, в какой половине искать дальше.`}); }
    { const r = R(6), n = sz[5]; let A, B;
      const tie = (A, B) => { let i = 0, j = 0; while (i < A.length && j < B.length) { if (A[i] === B[j]) return true; if (A[i] <= B[j]) i++; else j++; } return false; };
      do { A = Array.from({length: n}, () => ri(r, 1, 30)).sort((x, y) => x - y); B = Array.from({length: n}, () => ri(r, 1, 30)).sort((x, y) => x - y); } while (!tie(A, B) || A[n - 1] === B[n - 1]);
      L.push({kind: 'merge', title: 'Слияние составов', A, B,
        brief: 'Два состава уже отсортированы. Собери из них один: каждый раз сравнивай головные вагоны и отправляй на выходной путь меньший. Если головы равны — бери из состава А: так слияние остаётся устойчивым. Когда один состав кончится, остаток второго уедет сам.'}); }
    { const r = R(7); let a; do a = distinct(r, sz[6], 10, 99); while (inversions(a) < sz[6] || isSorted(a.slice(1))); L.push({kind: 'count', title: 'Предскажи счётчики', a, ask: ASK[g],
      brief: 'Диспетчеру нужен план работ до того, как горка начнёт сортировать. Посчитай заранее, сколько будет сравнений и обменов. Сравнение — это вопрос «левый вагон тяжелее правого?», обмен — перестановка двух вагонов.'}); }
    { const r = R(8), n = sz[7]; let items;
      do { const v = distinct(r, n - 1, 1, 20), d = v[ri(r, 0, n - 2)]; const vs = shuffle(r, v.concat([d])); let k = 0; items = vs.map(x => ({v: x, tag: x === d ? (k++ ? 'Б' : 'А') : ''})); }
      while (selOrder(items).find(x => x.tag).tag !== 'Б');
      L.push({kind: 'stable', title: 'Устойчивая сортировка', items, first: 'Б',
        brief: 'В составе два вагона одинаковой массы: А стоит левее Б. Сортировка устойчива, если равные вагоны сохраняют исходный порядок. Отметь устойчивые алгоритмы и ответь: какой из равных вагонов окажется левее после сортировки выбором именно этого состава?'}); }
    for (const lv of L) lv.grade = g;
    return L;
  }
  const cache = {}, levels = grade => cache[grade] || (cache[grade] = build(grade));

  // Проверка ответов (чистые функции).
  const ru = (n, one, few, many) => { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? one : m >= 2 && m <= 4 && (h < 12 || h > 14) ? few : many); };
  function check(lv, ans) {
    const no = msg => ({ok: false, msg});
    if (lv.kind === 'bubble' || lv.kind === 'insertion') {
      const ref = swapsOf(lv.ev), cmp = cmpsOf(lv.ev);
      if (!Array.isArray(ans) || ans.some(j => !isInt(j) || j < 0 || j >= lv.a.length - 1)) return no('Ответ — список обменов: номер j означает обмен вагонов j и j+1.');
      for (let k = 0; k < ans.length; k++) if (ans[k] !== ref[k]) return {ok: false, at: k, msg: k < ref.length ? `Обмен № ${k + 1} не по алгоритму: сейчас ${lv.kind === 'bubble' ? 'пузырёк' : 'вставка'} меняет вагоны ${ref[k]} и ${ref[k] + 1}.` : 'Состав уже отсортирован — лишний обмен.'};
      if (ans.length < ref.length) return no(`Сделано обменов: ${ans.length} из ${ref.length}. Состав ещё не отсортирован.`);
      return {ok: true, stars: 3, cmp, swp: ref.length, msg: `Состав отсортирован: ${ru(cmp, 'сравнение', 'сравнения', 'сравнений')}, ${ru(ref.length, 'обмен', 'обмена', 'обменов')}.`};
    }
    if (lv.kind === 'selection') {
      if (!Array.isArray(ans) || ans.length > lv.a.length * 3 || ans.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(x => isInt(x) && x >= 0 && x < lv.a.length) || p[0] === p[1])) return no('Ответ — список пар [i, j]: какие два вагона поменять местами.');
      const a = lv.a.slice(); for (const [i, j] of ans) [a[i], a[j]] = [a[j], a[i]];
      if (!isSorted(a)) return no('Состав ещё не расставлен по возрастанию.');
      const k = ans.length; return {ok: true, stars: k <= lv.min ? 3 : k <= lv.min + 2 ? 2 : 1, swp: k, msg: `Обменов: ${k}, наименьшее возможное число — ${lv.min}.`};
    }
    if (lv.kind === 'binary') {
      if (!Array.isArray(ans) || ans.some(i => !isInt(i) || i < 0 || i >= lv.vals.length)) return no('Ответ — список номеров открытых вагонов (счёт с нуля).');
      const hit = ans.findIndex(i => lv.vals[i] === lv.x);
      if (hit < 0) return no(ans.length >= lv.budget ? `Открыто ${ans.length} вагонов, а нужный так и не найден.` : 'Нужный вагон ещё не найден.');
      if (hit + 1 > lv.budget) return {ok: false, over: true, msg: `Вагон найден за ${hit + 1} вопросов, а бюджет — ${lv.budget}. Дели оставшийся участок пополам!`};
      return {ok: true, stars: 3, q: hit + 1, msg: `Вагон № ${lv.x} найден за ${ru(hit + 1, 'вопрос', 'вопроса', 'вопросов')} из ${lv.budget}.`};
    }
    if (lv.kind === 'merge') {
      if (!Array.isArray(ans) || ans.some(c => c !== 'A' && c !== 'B')) return no('Ответ — последовательность букв A и B: из какого состава брать головной вагон.');
      const {A, B} = lv; let i = 0, j = 0, cmp = 0;
      for (let k = 0; k < ans.length; k++) { const c = ans[k];
        if (i < A.length && j < B.length) { cmp++; const want = A[i] <= B[j] ? 'A' : 'B';
          if (c !== want) return {ok: false, at: k, msg: A[i] === B[j] ? `Шаг ${k + 1}: головы равны (${A[i]}) — по правилу устойчивости берём из состава А.` : `Шаг ${k + 1}: ${c === 'A' ? A[i] : B[j]} больше, чем ${c === 'A' ? B[j] : A[i]} — на выход идёт меньший вагон.`}; }
        else if ((c === 'A' ? i >= A.length : j >= B.length)) return {ok: false, at: k, msg: `Шаг ${k + 1}: состав ${c === 'A' ? 'А' : 'Б'} уже пуст.`};
        if (c === 'A') i++; else j++; }
      if (i < A.length && j < B.length) return no('Слияние ещё не закончено: оба состава не пусты.');
      return {ok: true, stars: 3, cmp, msg: `Составы слиты: ${ru(cmp, 'сравнение', 'сравнения', 'сравнений')} для ${A.length + B.length} вагонов.`};
    }
    if (lv.kind === 'count') {
      const want = lv.ask.map(k => COUNT[k].f(lv.a));
      if (!Array.isArray(ans) || ans.length !== want.length) return no('Ответ — список чисел по порядку вопросов.');
      const wrong = want.map((w, i) => Number(ans[i]) === w && String(ans[i]).trim() !== '' ? -1 : i).filter(i => i >= 0);
      return wrong.length ? {ok: false, wrong, msg: `Неверно: ${wrong.map(i => 'вопрос ' + (i + 1)).join(', ')}.`} : {ok: true, stars: 3, msg: `Все счётчики предсказаны верно: ${want.join(', ')}.`};
    }
    if (lv.kind === 'stable') {
      if (!ans || typeof ans !== 'object' || !Array.isArray(ans.stable)) return no('Ответ — {stable: [алгоритмы], first: "А" или "Б"}.');
      const st = [...new Set(ans.stable)].sort().join(), okSt = st === STABLE.slice().sort().join(), okF = ans.first === lv.first;
      if (!okSt && !okF) return no('Обе части ответа неверны.');
      if (!okSt) return {ok: false, part: 'stable', msg: 'Набор устойчивых алгоритмов выбран неверно.'};
      if (!okF) return {ok: false, part: 'first', msg: 'Проследи сортировку выбором по шагам: дальний обмен может перепрыгнуть через равный вагон.'};
      return {ok: true, stars: 3, msg: 'Верно: пузырёк, вставки и слияние устойчивы, а выбор дальним обменом переставил равные вагоны.'};
    }
    return no('Неизвестный уровень.');
  }
  function solve(lv) {
    if (lv.kind === 'bubble' || lv.kind === 'insertion') return swapsOf(lv.ev);
    if (lv.kind === 'selection') return selectionSwaps(lv.a);
    if (lv.kind === 'binary') return binSearch(lv.vals, lv.x);
    if (lv.kind === 'merge') return mergeRef(lv.A, lv.B);
    if (lv.kind === 'count') return lv.ask.map(k => COUNT[k].f(lv.a));
    if (lv.kind === 'stable') return {stable: STABLE.slice(), first: lv.first};
  }

  // ---------- Страница ----------
  const CSS = `
.so-yard{background:#141d36;border:1px solid #33466e;border-radius:14px;padding:12px 14px;margin-bottom:12px}
.so-stats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.so-stat{background:#0d1428;border:1px solid #2c3d63;border-radius:10px;padding:5px 11px;font-size:14px;color:#9fb2d6}
.so-stat b{color:#ffd34d;font-size:17px;margin-left:4px}
.so-stat.bad b{color:#ff9a9a}
.so-label{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7fe3c8;margin:6px 0 2px}
.so-track{position:relative;display:flex;flex-wrap:wrap;align-items:flex-end;gap:4px 2px;min-height:96px;padding:6px 6px 14px;border-radius:10px;background:repeating-linear-gradient(90deg,transparent 0 18px,rgba(140,110,80,.35) 18px 24px) bottom 4px left/100% 6px no-repeat,linear-gradient(#0000 0,#0000 calc(100% - 12px),#59647d calc(100% - 12px),#59647d calc(100% - 10px),#0000 calc(100% - 10px),#0000 calc(100% - 4px),#59647d calc(100% - 4px),#59647d calc(100% - 2px),#0000 calc(100% - 2px)),#0b1124}
.so-car{--h:200;position:relative;flex:0 0 auto;width:64px;height:70px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;border:0;padding:0;background:none;color:#fff;cursor:default;transition:transform .32s ease}
.so-car .so-body{position:relative;width:60px;height:46px;border-radius:7px 7px 4px 4px;background:linear-gradient(hsl(var(--h) 60% 52%),hsl(var(--h) 55% 34%));border:2px solid hsl(var(--h) 60% 22%);box-shadow:inset 0 -6px 0 rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;overflow:hidden}
.so-car .so-load{position:absolute;left:4px;right:4px;bottom:4px;background:rgba(255,255,255,.16);border-radius:3px}
.so-car b{position:relative;font:800 19px/1 ui-monospace,monospace;text-shadow:0 1px 2px #000}
.so-car i{position:absolute;top:2px;right:4px;font-style:normal;font-weight:800;font-size:12px;color:#ffd34d}
.so-car .so-wheels{display:flex;gap:22px;height:10px;margin-top:-2px}
.so-car .so-wheels::before,.so-car .so-wheels::after{content:"";width:10px;height:10px;border-radius:50%;background:#1b2338;border:2px solid #8a96b2}
.so-car small{font-size:11px;color:#9fb2d6;height:14px}
button.so-car{cursor:pointer}
button.so-car:hover .so-body,button.so-car:focus-visible .so-body{outline:3px solid #9fe8ff;outline-offset:1px}
button.so-car:disabled{cursor:default}
.so-car.cmp .so-body{outline:3px solid #ffd34d;outline-offset:1px;box-shadow:0 0 16px #ffd34d88}
.so-car.sel .so-body{outline:3px solid #7fe3c8;outline-offset:1px;transform:translateY(-6px)}
.so-car.done .so-body{filter:saturate(.35) brightness(.85)}
.so-car.done small{color:#7fe3c8}
.so-car.dim{opacity:.32}
.so-car.closed .so-body{background:repeating-linear-gradient(90deg,#3a4767 0 6px,#2d3955 6px 12px);border-color:#1c2539}
.so-car.hit .so-body{outline:3px solid #22b07d;box-shadow:0 0 18px #22b07d}
.so-car.src-A .so-body{--h:210}.so-car.src-B .so-body{--h:28}
.so-car.bad .so-body{animation:so-shake .35s}
@keyframes so-shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.so-link{align-self:center;margin-bottom:10px;width:26px;height:26px;border-radius:50%;border:1px solid #3b4d78;background:#243253;color:#9fe8ff;cursor:pointer;padding:0;font-size:14px}
.so-link:hover,.so-link:focus-visible{background:#2f6b8f;color:#fff}
.so-sorted{box-shadow:inset 0 -3px 0 #7fe3c8}
.so-mini .so-car{width:44px;height:58px}.so-mini .so-car .so-body{width:40px;height:34px}.so-mini .so-car b{font-size:13px}.so-mini .so-car .so-wheels{gap:12px}
.so-q{display:grid;grid-template-columns:1fr 110px;gap:8px;align-items:center;margin:8px 0}
.so-q input{background:#0b0f1c;border:1px solid #3b4d78;border-radius:8px;color:#e6edf9;font:18px ui-monospace,monospace;padding:6px 10px;width:100%;box-sizing:border-box}
.so-q.bad input{border-color:#ff9a9a}.so-q.good input{border-color:#22b07d}
.so-opts{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}
.so-opts label{background:#0d1428;border:1px solid #2c3d63;border-radius:10px;padding:7px 12px;cursor:pointer}
.so-opts input{margin-right:6px}
.so-acts{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px}
@media(max-width:700px){.so-car{width:48px;height:60px}.so-car .so-body{width:44px;height:36px}.so-car b{font-size:15px}.so-car .so-wheels{gap:14px}.so-link{width:22px;height:22px;font-size:12px}.so-mini .so-car{width:36px;height:52px}.so-mini .so-car .so-body{width:32px;height:30px}.so-mini .so-car b{font-size:11px}.so-q{grid-template-columns:1fr 80px}}
`;
  const injectCss = () => { if (typeof document === 'undefined' || document.getElementById('so-style')) return; const s = document.createElement('style'); s.id = 'so-style'; s.textContent = CSS; document.head.append(s); };
  const hue = v => 200 - Math.round(v * 1.7) % 360;

  function mount(host, lv, api) {
    injectCss();
    const {el, button} = api, timers = [], later = (f, ms) => timers.push(setTimeout(f, ms));
    const task = el('div', 'lab-task'); task.append(el('h2', '', lv.title), el('p', '', lv.brief));
    const yard = el('div', 'so-yard'), stats = el('div', 'so-stats'), msg = el('p', 'lab-msg'), acts = el('div', 'so-acts');
    const say = (t, cls) => { msg.textContent = t; msg.className = 'lab-msg' + (cls ? ' ' + cls : ''); };
    const stat = (label, val, bad) => { const s = el('span', 'so-stat' + (bad ? ' bad' : '')); s.append(label, el('b', '', String(val))); return s; };
    let done = false; const win = (r, penalty) => { if (done) return; done = true; say(r.msg, 'good'); later(() => api.finish(Math.min(r.stars, penalty), r.msg), 650); };
    const mistakeStars = m => m === 0 ? 3 : m <= 2 ? 2 : 1;
    // Вагон: value v, id — постоянный ключ для анимации перестановок (FLIP).
    const car = (o, idx, opt = {}) => { const tag = opt.click ? 'button' : 'div', c = el(tag, 'so-car' + (opt.cls ? ' ' + opt.cls : '')); if (opt.click) { c.type = 'button'; c.addEventListener('click', opt.click); }
      c.dataset.id = String(o.id); const body = el('div', 'so-body'), load = el('div', 'so-load'); c.style.setProperty('--h', hue(o.v));
      if (!opt.hidden) { load.style.height = Math.round(8 + (o.v % 100) / 100 * 30) + 'px'; body.append(load, el('b', '', String(o.v))); } else body.append(el('b', '', '?'));
      if (o.tag) body.append(el('i', '', o.tag)); c.append(body, el('div', 'so-wheels'), el('small', '', opt.label != null ? opt.label : `[${idx}]`)); if (opt.click) c.setAttribute('aria-label', opt.hidden ? `Открыть вагон ${idx}` : `Вагон ${o.v}, позиция ${idx}`); return c; };
    const flip = build => { const old = new Map(); for (const c of yard.querySelectorAll('.so-car')) old.set(c.dataset.id, c.getBoundingClientRect()); build();
      for (const c of yard.querySelectorAll('.so-car')) { const o = old.get(c.dataset.id); if (!o) continue; const n = c.getBoundingClientRect(), dx = o.left - n.left, dy = o.top - n.top;
        if (dx || dy) { c.style.transition = 'none'; c.style.transform = `translate(${dx}px,${dy}px)`; requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transition = ''; c.style.transform = ''; })); } } };
    const shake = node => { if (!node) return; node.classList.remove('bad'); void node.offsetWidth; node.classList.add('bad'); };
    host.append(task, yard); let labSet = null;

    if (lv.kind === 'bubble' || lv.kind === 'insertion') {
      const cars = lv.a.map((v, id) => ({v, id})), ev = lv.ev, swaps = []; let pos = 0, mistakes = 0;
      const track = el('div', 'so-track'), hint = el('p', 'lab-note');
      const cmpDone = () => ev.slice(0, pos).filter(e => e.t === 'c').length;
      const nextS = () => { for (let k = pos; k < ev.length; k++) if (ev[k].t === 's') return k; return -1; };
      const cur = () => ev[Math.min(pos, ev.length - 1)];
      // После последнего обмена остаток трассы — только сравнения: смена закончена.
      const step = j => { if (j != null) swaps.push(j); if (nextS() < 0) pos = ev.length;
        if (j != null) flip(() => { [cars[j], cars[j + 1]] = [cars[j + 1], cars[j]]; draw(); }); else draw();
        if (pos >= ev.length) win(check(lv, swaps), mistakeStars(mistakes)); };
      const draw = () => { const e = cur(), fin = pos >= ev.length, n = cars.length;
        stats.replaceChildren(stat('Сравнений:', cmpDone()), stat('Обменов:', swaps.length), stat('Ошибок:', mistakes, mistakes > 0),
          stat(lv.kind === 'bubble' ? 'Проход:' : 'Вставляем:', fin ? '—' : lv.kind === 'bubble' ? `${e.k + 1} из ${n - 1}` : `вагон [${e.k}]`));
        const sortedFrom = lv.kind === 'bubble' ? (fin ? 0 : n - e.k) : n, prefix = lv.kind === 'insertion' && !fin ? e.k : 0;
        const nodes = []; cars.forEach((o, i) => { let cls = (fin || i >= sortedFrom) ? 'done' : i < prefix ? 'done' : '';
          if (lv.guided && !fin && (i === e.j || i === e.j + 1)) cls += ' cmp'; nodes.push(car(o, i, {cls}));
          if (!lv.guided && i < n - 1) { const l = button('⇄', 'so-link', () => clickSwap(i)); l.setAttribute('aria-label', `Поменять вагоны ${i} и ${i + 1}`); l.dataset.j = i; l.disabled = fin || done; nodes.push(l); } });
        track.replaceChildren(...nodes);
        if (lv.guided) { yes.disabled = no.disabled = fin || done; hint.textContent = fin ? '' : `Сравниваем вагоны [${e.j}] = ${cars[e.j].v} и [${e.j + 1}] = ${cars[e.j + 1].v}.`; }
        else hint.textContent = lv.kind === 'bubble' ? 'Серым отмечены вагоны, уже вставшие на своё место в конце состава.' : 'Серым отмечена уже отсортированная левая часть состава.'; };
      const decide = want => { if (done || pos >= ev.length) return; const e = ev[pos], sw = ev[pos + 1] && ev[pos + 1].t === 's', a = cars[e.j].v, b = cars[e.j + 1].v;
        if (want !== sw) { mistakes++; say(sw ? `${a} > ${b} — левый тяжелее, их нужно поменять.` : `${a} < ${b} — порядок верный, менять не нужно.`, 'bad'); shake(track.querySelector('.cmp')); draw(); return; }
        say(''); pos += sw ? 2 : 1; step(sw ? e.j : null); };
      const clickSwap = j => { if (done) return; const k = nextS(); if (k < 0) return;
        if (ev[k].j !== j) { mistakes++; const e = ev[k]; say(lv.kind === 'bubble' ? `Не по алгоритму. Пузырёк сейчас в проходе ${e.k + 1}: он идёт слева направо и меняет первую пару, где левый вагон тяжелее правого.` : `Не по алгоритму. Сейчас вставляется вагон, стоявший на месте [${e.k}]: он движется влево, пока левый сосед тяжелее.`, 'bad'); shake(track.querySelector(`.so-link[data-j="${j}"]`)); draw(); return; }
        say(''); pos = k + 1; step(j); };
      const yes = button('⇄ Поменять', 'lab-main', () => decide(true)), no = button('→ Оставить', 'lab-small', () => decide(false)); yes.dataset.act = 'swap'; no.dataset.act = 'keep';
      if (lv.guided) acts.append(yes, no);
      yard.append(stats, track, hint, acts, msg); draw();
      labSet = ans => { const r = check(lv, ans); if (r.ok) { flip(() => { for (const j of ans) [cars[j], cars[j + 1]] = [cars[j + 1], cars[j]]; swaps.splice(0, swaps.length, ...ans); pos = ev.length; draw(); }); win(r, 3); } else say(r.msg, 'bad'); return r; };
    }

    if (lv.kind === 'selection') {
      let cars, pairs, sel; const track = el('div', 'so-track');
      const reset = () => { cars = lv.a.map((v, id) => ({v, id})); pairs = []; sel = -1; say(''); draw(); };
      const draw = () => { const sorted = cars.map(o => o.v).slice().sort((x, y) => x - y);
        stats.replaceChildren(stat('Обменов:', pairs.length), stat('Вагонов:', cars.length));
        track.replaceChildren(...cars.map((o, i) => car(o, i, {cls: (i === sel ? 'sel' : '') + (o.v === sorted[i] ? ' done' : ''), click: done ? null : () => pick(i)}))); };
      const pick = i => { if (done) return; if (sel < 0) { sel = i; draw(); return; } if (sel === i) { sel = -1; draw(); return; }
        const a = sel; sel = -1; pairs.push([a, i]); flip(() => { [cars[a], cars[i]] = [cars[i], cars[a]]; draw(); });
        if (isSorted(cars.map(o => o.v))) { const r = check(lv, pairs); if (r.stars < 3) r.msg += ' Попробуй ещё раз за меньшее число обменов.'; win(r, 3); } };
      const again = button('↺ Сначала', 'lab-small', reset); acts.append(again);
      yard.append(stats, track, el('p', 'lab-note', 'Нажми на вагон, затем на другой — они поменяются местами. Серые вагоны уже стоят на своих местах.'), acts, msg); reset();
      labSet = ans => { const r = check(lv, ans); if (r.ok) { flip(() => { for (const [a, b] of ans) [cars[a], cars[b]] = [cars[b], cars[a]]; pairs = ans.map(p => p.slice()); draw(); }); win(r, 3); } else say(r.msg, 'bad'); return r; };
    }

    if (lv.kind === 'binary') {
      let opened, restarts = 0; const n = lv.vals.length, track = el('div', 'so-track' + (n > 20 ? ' so-mini' : ''));
      const reset = () => { opened = []; say(''); draw(); };
      const draw = () => { let lo = 0, hi = n - 1; for (const i of opened) { if (lv.vals[i] < lv.x) lo = Math.max(lo, i + 1); if (lv.vals[i] > lv.x) hi = Math.min(hi, i - 1); }
        const found = opened.some(i => lv.vals[i] === lv.x), out = !found && opened.length >= lv.budget;
        stats.replaceChildren(stat('Ищем вагон №', lv.x), stat('Вопросов:', `${opened.length} из ${lv.budget}`, out), stat('Ещё под подозрением:', found ? 1 : Math.max(0, hi - lo + 1)), stat('Попыток:', restarts + 1));
        track.replaceChildren(...lv.vals.map((v, i) => { const op = opened.includes(i), cls = (op ? (v === lv.x ? 'hit' : '') : 'closed') + (!op && (i < lo || i > hi) ? ' dim' : '');
          return car({v, id: i}, i, {hidden: !op, cls, label: String(i), click: op || done || out ? null : () => ask(i)}); })); };
      const ask = i => { if (done) return; opened.push(i); const v = lv.vals[i]; draw();
        if (v === lv.x) { win(check(lv, opened), restarts === 0 ? 3 : restarts === 1 ? 2 : 1); return; }
        if (opened.length >= lv.budget) { say(`Вопросы кончились: вагон № ${lv.x} не найден. Начни заново и открывай вагон посередине подозрительного участка.`, 'bad'); return; }
        say(v < lv.x ? `Вагон [${i}] = ${v} < ${lv.x}: искомый правее.` : `Вагон [${i}] = ${v} > ${lv.x}: искомый левее.`); };
      const again = button('↺ Заново', 'lab-small', () => { if (done) return; if (opened.length) restarts++; reset(); }); acts.append(again);
      yard.append(stats, track, el('p', 'lab-note', 'Нажми на закрытый вагон, чтобы узнать его номер. Блёклыми стали вагоны, где искомого точно нет.'), acts, msg); reset();
      labSet = ans => { const r = check(lv, ans); if (r.ok) { opened = ans.slice(0, ans.findIndex(i => lv.vals[i] === lv.x) + 1); draw(); win(r, 3); } else say(r.msg, 'bad'); return r; };
    }

    if (lv.kind === 'merge') {
      let A, B, out, choices, mistakes = 0, cmp = 0; const ta = el('div', 'so-track'), tb = el('div', 'so-track'), to = el('div', 'so-track');
      const reset = () => { A = lv.A.map((v, i) => ({v, id: 'a' + i, src: 'A'})); B = lv.B.map((v, i) => ({v, id: 'b' + i, src: 'B'})); out = []; choices = []; draw(); };
      const draw = () => { const both = A.length && B.length;
        stats.replaceChildren(stat('Сравнений:', cmp), stat('На выходе:', `${out.length} из ${lv.A.length + lv.B.length}`), stat('Ошибок:', mistakes, mistakes > 0));
        const row = (t, list, s) => t.replaceChildren(...(list.length ? list.map((o, i) => car(o, i, {cls: 'src-' + o.src + (i === 0 && both && !done ? ' cmp' : ''), label: i === 0 ? 'голова' : '', click: i === 0 && both && !done ? () => take(s) : null})) : [el('span', 'lab-note', 'путь пуст')]));
        row(ta, A, 'A'); row(tb, B, 'B'); to.replaceChildren(...out.map((o, i) => car(o, i, {cls: 'src-' + o.src, label: o.src === 'A' ? 'А' : 'Б'}))); };
      const move = s => { const o = (s === 'A' ? A : B).shift(); out.push(o); choices.push(s); };
      const take = s => { if (done || !A.length || !B.length) return; const want = A[0].v <= B[0].v ? 'A' : 'B';
        if (s !== want) { mistakes++; say(A[0].v === B[0].v ? `Головы равны (${A[0].v}). Чтобы слияние было устойчивым, при равенстве берём из состава А.` : `${(s === 'A' ? A : B)[0].v} больше, чем ${(s === 'A' ? B : A)[0].v}: на выход идёт меньший.`, 'bad'); shake((s === 'A' ? ta : tb).querySelector('.so-car')); draw(); return; }
        say(''); cmp++; flip(() => { move(s); draw(); });
        if (!A.length || !B.length) later(() => { flip(() => { const s2 = A.length ? 'A' : 'B'; while ((s2 === 'A' ? A : B).length) move(s2); draw(); }); win(check(lv, choices), mistakeStars(mistakes)); }, 420); };
      const lab = t => el('p', 'so-label', t);
      yard.append(stats, lab('Состав А'), ta, lab('Состав Б'), tb, lab('Выходной путь'), to, el('p', 'lab-note', 'Нажимай на головной вагон того состава, который должен уйти на выход.'), msg); reset();
      labSet = ans => { const r = check(lv, ans); if (r.ok) { flip(() => { for (const c of ans) move(c); while (A.length) move('A'); while (B.length) move('B'); cmp = r.cmp; draw(); }); win(r, 3); } else say(r.msg, 'bad'); return r; };
    }

    if (lv.kind === 'count') {
      let tries = 0; const track = el('div', 'so-track'), form = el('div'), inputs = [];
      track.append(...lv.a.map((v, i) => car({v, id: i}, i)));
      lv.ask.forEach((k, i) => { const row = el('label', 'so-q'), inp = el('input'); inp.type = 'number'; inp.min = '0'; inp.inputMode = 'numeric'; inp.dataset.q = k; row.append(el('span', '', `${i + 1}. ${COUNT[k].q}`), inp); inputs.push(inp); form.append(row); });
      const go = button('🚦 Проверить план', 'lab-main', () => { if (done) return; tries++; const r = check(lv, inputs.map(x => x.value.trim() === '' ? '' : Number(x.value)));
        inputs.forEach((x, i) => { x.parentNode.className = 'so-q ' + (r.ok || !(r.wrong || []).includes(i) ? 'good' : 'bad'); });
        stats.replaceChildren(stat('Попыток:', tries)); if (r.ok) win(r, tries === 1 ? 3 : tries <= 3 ? 2 : 1); else say(r.msg, 'bad'); }); go.dataset.act = 'run';
      acts.append(go); stats.append(stat('Вагонов n =', lv.a.length));
      yard.append(stats, track, form, el('p', 'lab-note', 'Можно проследить алгоритм на бумаге. Помни: число обменов соседей равно числу «инверсий» — пар, стоящих не по порядку.'), acts, msg);
      labSet = ans => { ans.forEach((v, i) => { if (inputs[i]) inputs[i].value = v; }); const r = check(lv, ans); if (r.ok) win(r, 3); else say(r.msg, 'bad'); return r; };
    }

    if (lv.kind === 'stable') {
      let tries = 0; const track = el('div', 'so-track'), algs = el('div', 'so-opts'), firsts = el('div', 'so-opts'), boxes = {};
      track.append(...lv.items.map((o, i) => car({...o, id: i}, i)));
      for (const [k, name] of Object.entries(ALG)) { const l = el('label'), c = el('input'); c.type = 'checkbox'; c.value = k; boxes[k] = c; l.append(c, name); algs.append(l); }
      const radios = ['А', 'Б'].map(t => { const l = el('label'), c = el('input'); c.type = 'radio'; c.name = 'so-first'; c.value = t; l.append(c, `левее окажется ${t}`); firsts.append(l); return c; });
      const go = button('🚦 Проверить', 'lab-main', () => { if (done) return; tries++; const r = check(lv, {stable: Object.keys(boxes).filter(k => boxes[k].checked), first: (radios.find(x => x.checked) || {}).value});
        stats.replaceChildren(stat('Попыток:', tries)); if (r.ok) win(r, tries === 1 ? 3 : tries <= 2 ? 2 : 1); else say(r.msg, 'bad'); }); go.dataset.act = 'run';
      acts.append(go);
      yard.append(stats, track, el('p', 'so-label', 'Какие алгоритмы устойчивы?'), algs, el('p', 'so-label', 'После сортировки выбором этого состава'), firsts, acts, msg);
      labSet = ans => { for (const k in boxes) boxes[k].checked = (ans.stable || []).includes(k); radios.forEach(x => { x.checked = x.value === ans.first; }); const r = check(lv, ans); if (r.ok) win(r, 3); else say(r.msg, 'bad'); return r; };
    }

    if (api.debugHost) window.labSet = answer => labSet(answer);
    return () => { timers.forEach(clearTimeout); };
  }

  LAB.register({id: 'sorting', bg: 'bg_factory', title: 'Сортировочная станция', genre: 'сортировка и поиск', art: '🚃', color: '#5ac8ff', unit: 'Смена', minutes: 40,
    about: 'Вагоны на сортировочной горке — элементы массива. Пузырёк, вставки и выбор обмен за обменом со счётчиками, двоичный поиск за ⌈log2 n⌉ вопросов, слияние составов, прогноз числа операций и устойчивость.',
    levels, mount, check, solve, trace: {bubble: bubbleTrace, insertion: insertionTrace, selection: selectionSwaps}, COUNT});
})();
