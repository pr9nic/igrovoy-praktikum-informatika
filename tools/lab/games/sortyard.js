// «Сортировочная горка»: вагоны с номерами на путях станции. Ученик сам выполняет алгоритм по шагам — пузырёк (без флага и с флагом), выбор,
// вставки, двоичный поиск, — а игра проверяет, что каждый ход именно тот, который сделал бы алгоритм, и объясняет ошибку (9 кл. §1.4–1.5, 11 кл. §8).
// Ходы проверяет чистая логика (start/expect/step/check) без страницы — тест в node: tools/lab/tests/sortyard.test.js.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const many = (r, n, lo, hi) => Array.from({length: n}, () => ri(r, lo, hi));
  const distinct = (r, n, lo, hi) => { const s = new Set(); while (s.size < n) s.add(ri(r, lo, hi)); return [...s]; };
  const rising = (r, n, gap) => { let v = ri(r, 3, 12); return Array.from({length: n}, () => { const x = v; v += ri(r, 1, gap); return x; }); };
  const word = (n, w) => n + ' ' + w[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2];
  const CARS = ['вагон', 'вагона', 'вагонов'], PASSES = ['проход', 'прохода', 'проходов'], OPENS = ['вскрытие', 'вскрытия', 'вскрытий'];
  // Прогоны алгоритмов целиком — для подбора составов и ответов к задачам на счёт.
  function bubbleRun(a, flag, passes = a.length - 1) { a = a.slice(); let swaps = 0, last = 0, eq = false; const per = [];
    for (let i = 0; i < passes; i++) { let sw = 0; for (let j = 0; j < a.length - 1 - i; j++) { if (a[j] === a[j + 1]) eq = true; if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; sw++; } } per.push(sw); swaps += sw; if (sw) last = i + 1; else if (flag) break; }
    return {a, swaps, last, eq, per}; }
  const minAt = (a, i) => { let m = i; for (let j = i + 1; j < a.length; j++) if (a[j] < a[m]) m = j; return m; };
  const insertAt = (a, i) => a.slice(0, i).filter(y => y <= a[i]).length;   // упорядоченная часть a[0..i-1]: вставка после последнего номера ≤ a[i]
  const inversions = a => a.reduce((s, x, i) => s + a.slice(i + 1).filter(y => y < x).length, 0);
  const worst = n => { let k = 0; while (2 ** k - 1 < n) k++; return k; };
  function selRun(a, k) { a = a.slice(); const log = []; for (let i = 0; i < k; i++) { const m = minAt(a, i); log.push([i, m, a[m]]); [a[i], a[m]] = [a[m], a[i]]; } return {a, log}; }
  function insRun(a) { a = a.slice(); const ps = []; for (let i = 1; i < a.length; i++) { const p = insertAt(a, i), dup = a.slice(0, i).includes(a[i]); a.splice(p, 0, a.splice(i, 1)[0]); ps.push({p, i, dup}); } return ps; }
  const probes = (a, x, up) => { let L = 0, R = a.length - 1, k = 0; while (L <= R) { const c = (L + R + (up ? 1 : 0)) >> 1; k++; if (a[c] === x) return k; if (a[c] < x) L = c + 1; else R = c - 1; } return k; };
  function hidden(r, n, absent) { for (;;) { const a = rising(r, n, absent ? 4 : 7); let x = a[ri(r, 0, n - 1)];
    if (absent) { const g = ri(r, 0, n); if (g === 0) x = a[0] - ri(r, 1, 2); else if (g === n) x = a[n - 1] + ri(r, 1, 3); else if (a[g] - a[g - 1] >= 2) x = a[g - 1] + ri(r, 1, a[g] - a[g - 1] - 1); else continue; }
    if (probes(a, x, false) >= 3 && probes(a, x, true) >= 3) return {a, x}; } }
  // Задачи на счёт: text — условие, a — состав для картинки, answer — ответ, explain — разбор.
  const Q = {
    inv(r) { for (;;) { const a = distinct(r, ri(r, 6, 7), 1, 40), k = inversions(a); if (k < 5 || k > 12) continue; const per = bubbleRun(a).per; while (per.length > 1 && !per[per.length - 1]) per.pop();
      return {a, text: 'Сколько обменов сделает сортировка пузырьком, пока не упорядочит этот состав по возрастанию?', answer: k,
        explain: `Каждый обмен меняет местами соседей, стоящих не по порядку, и убирает ровно одну пару «больший номер левее меньшего». Для каждого вагона считаем, сколько номеров правее него меньше: ${a.map((x, i) => `${x} → ${a.slice(i + 1).filter(y => y < x).length}`).join(', ')}. Всего ${k}; по проходам пузырька — ${per.join(' + ')}.`}; } },
    selk(r) { for (;;) { const a = distinct(r, 7, 1, 60), k = ri(r, 2, 3), {a: b, log} = selRun(a, k), moves = log.filter(([i, m]) => i !== m).length; if (moves < 2 || b.join() === b.slice().sort((x, y) => x - y).join()) continue;
      const c = a.slice(), steps = log.map(([i, m, v]) => { [c[i], c[m]] = [c[m], c[i]]; return `${i + 1}) минимум ${v} ${i === m ? `уже стоит на месте a[${i}]` : `меняется с ${c[m]} и встаёт на место a[${i}]`} → ${c.join(' ')}`; });
      return {a, text: `Сортировка выбором по возрастанию. Каким станет состав после ${word(k, PASSES)}? Запиши номера через пробел.`, answer: b.join(' '), explain: `По проходам: ${steps.join('; ')}.`}; } },
    probes(r) { const n = [ri(r, 5, 40), ri(r, 41, 200), ri(r, 201, 1000), 2 ** ri(r, 3, 9) - 1, 2 ** ri(r, 3, 9)][ri(r, 0, 4)], k = worst(n), ch = [n]; for (let s = n; s;) { s >>= 1; ch.push(s); }
      return {text: `В отсортированном составе ${word(n, CARS)}, номера закрыты. Какое наибольшее число вагонов придётся открыть двоичным поиском, чтобы найти нужный номер или убедиться, что его нет?`, answer: k,
        explain: `После вскрытия середины от участка из s вагонов остаётся не больше ⌊s/2⌋: ${ch.join(' → ')} — ${word(k, OPENS)}. Иначе: наименьшее k, при котором 2^k − 1 ≥ ${n} (2^${k} − 1 = ${2 ** k - 1}).`}; },
  };
  const L = o => o;
  const LEVELS = [
    L({kind: 'bubble', title: 'Пузырёк: один проход', passes: 1, brief: 'Один проход сортировки пузырьком. Сравнивай соседние вагоны слева направо: щёлкни сцепку ⇆ между ними. Если левый номер больше правого, поменяй вагоны местами — щёлкни ту же сцепку ещё раз или кнопку «Поменять» (S). Когда проход закончится, нажми «Готово»: самый большой номер окажется в конце.',
      gen: r => { for (;;) { const a = distinct(r, 5, 10, 99), s = bubbleRun(a, false, 1).swaps; if (s >= 2 && s <= 3) return {a}; } }}),
    L({kind: 'bubble', title: 'Пузырёк: весь состав', brief: 'Отсортируй состав по возрастанию пузырьком. Каждый проход начинается с начала состава; после k-го прохода последние k вагонов уже на местах — их больше не сравнивают. Без флага алгоритм делает ровно n − 1 проходов, даже если состав упорядочился раньше. Затем — «Готово».',
      gen: r => { for (;;) { const a = distinct(r, 5, 10, 99), b = bubbleRun(a); if (b.swaps >= 4 && b.swaps <= 7 && b.last <= 3) return {a}; } }}),
    L({kind: 'bubble', title: 'Пузырёк с флагом', flag: true, brief: 'Улучшенный пузырёк: в начале прохода flag = False, при каждом обмене flag = True. Если за весь проход не было ни одного обмена, состав упорядочен — нажми «Готово» сразу, не дожидаясь n − 1 проходов. Нажать раньше нельзя: пока в проходе были обмены, нужен ещё проход.',
      gen: r => { for (;;) { const a = distinct(r, 7, 10, 99), b = bubbleRun(a, true); if (b.last >= 2 && b.last <= 3 && b.swaps >= 4) return {a}; } }}),
    L({kind: 'select', title: 'Сортировка выбором', brief: 'На каждом проходе найди наименьший номер в неупорядоченной части (правее зелёных вагонов) и щёлкни его: он поменяется местами с первым вагоном этой части. Один номер встречается дважды: если минимумов несколько, бери самый левый. Проходов n − 1: последний вагон встаёт на место сам. Затем — «Готово».',
      gen: r => { for (;;) { const a = distinct(r, 5, 10, 99); a.splice(ri(r, 0, 5), 0, a[ri(r, 0, 4)]); const log = selRun(a, 5).log, same = log.filter(([i, m]) => i === m).length; if (same >= 1 && same <= 2) return {a}; } }}),   // один номер повторяется: важен первый минимум
    L({kind: 'insert', title: 'Сортировка вставками', brief: 'Слева — упорядоченная часть. Следующий вагон (он приподнят) вставь на его место в этой части: щёлкни стрелку ▼ там, куда он должен встать (крайняя правая стрелка — оставить на месте). Алгоритм сдвигает вправо только вагоны с номером больше вставляемого. Когда все вагоны вставлены — «Готово».',
      gen: r => { for (;;) { const a = distinct(r, 6, 10, 99), ps = insRun(a); if (ps.some(x => x.p === x.i) && ps.some(x => x.p === 0) && ps.some(x => x.p > 0 && x.p < x.i)) return {a}; } }}),
    L({kind: 'search', title: 'Двоичный поиск', brief: 'Номера вагонов идут по возрастанию, но вагоны закрыты. Найди вагон с нужным номером двоичным поиском: открывать можно только средний вагон текущего участка a[L]…a[R], c = (L + R) // 2. Если вагонов на участке чётное число, средних два — подходит любой, то есть и (L + R + 1) // 2. После каждого вскрытия половина участка отбрасывается.',
      gen: r => hidden(r, 15, false)}),
    L({kind: 'quiz', title: 'Сколько обменов?', need: 2, code: 'bubble', brief: 'Не сортируя по шагам, посчитай, сколько обменов сделает пузырёк, упорядочивая состав по возрастанию. Подсказка: каждый обмен исправляет ровно одну пару «больший номер стоит левее меньшего». Две задачи подряд; после ошибки — разбор и новая задача.', gen: Q.inv}),
    L({kind: 'quiz', title: 'Выбор: после k проходов', need: 2, code: 'select', brief: 'Один проход сортировки выбором — найти минимум неупорядоченной части и поменять его с первым вагоном этой части. Запиши, каким станет состав после указанного числа проходов: номера через пробел. Две задачи подряд.', gen: Q.selk}),
    L({kind: 'search', title: 'Есть ли такой вагон?', brief: 'Длинный закрытый состав, номера по возрастанию. Двоичным поиском найди вагон — или докажи, что его нет: когда участок поиска опустеет, нажми «Такого вагона нет» (X). Правило то же: открываем только середину участка, при чётном числе вагонов — любую из двух средних.',
      gen: r => hidden(r, ri(r, 20, 31), r() < 0.5)}),
    L({kind: 'quiz', title: 'Сколько вскрытий?', need: 3, code: 'search', brief: 'Сколько вагонов в худшем случае придётся открыть двоичным поиском в составе из n вагонов, чтобы найти номер или убедиться, что его нет? Каждое вскрытие оставляет не больше половины участка. Три задачи подряд.', gen: Q.probes}),
    L({kind: 'insert', title: 'Вставки: одинаковые номера', brief: 'Сортировка вставками, но номера повторяются. Алгоритм сдвигает только вагоны с номером строго больше вставляемого (a[j] > x), поэтому равный вагон он не обгоняет: новый встаёт сразу за ним.',
      gen: r => { for (;;) { const a = many(r, 8, 10, 19), ps = insRun(a); if (ps.filter(x => x.dup).length >= 2 && ps.some(x => x.p === x.i) && ps.some(x => x.i - x.p >= 2)) return {a}; } }}),
    L({kind: 'bubble', title: 'Длинный состав', flag: true, brief: 'Пузырёк с флагом на длинном составе, номера повторяются. Равные соседи не меняются: в условии a[j] > a[j + 1] знак строгий. Не пропусти момент остановки — и не останавливайся раньше времени.',
      gen: r => { for (;;) { const a = many(r, 8, 10, 22), b = bubbleRun(a, true); if (b.eq && new Set(a).size < 8 && b.last >= 2 && b.last <= 5 && b.swaps >= 6 && b.swaps <= 14) return {a}; } }}),
  ];

  /* ---------- шаги алгоритмов: каждый алгоритм — автомат ---------- */
  // start — начальное состояние, expect — какие ходы алгоритм сделал бы сейчас, apply — выполнить верный ход,
  // wrong — объяснение неверного хода (какой ход следующий и почему), note — короткий комментарий к верному ходу.
  const P = (a, j) => `a[${j}] и a[${j + 1}] (${a[j]} и ${a[j + 1]})`;
  const ALG = {
    bubble: {
      start: d => ({a: d.a.slice(), i: 0, j: 0, need: false, sw: false, end: false, done: false, last: -1, swapped: false, comps: 0, swaps: 0}),
      expect: (lv, s) => s.end ? [['stop']] : s.need ? [['swap']] : [['cmp', s.j]],
      apply(lv, s, m) { const t = {...s, a: s.a.slice()}, n = t.a.length, passes = lv.passes || n - 1;
        const next = () => { t.j++; if (t.j >= n - 1 - t.i) { if ((lv.flag && !t.sw) || t.i + 1 >= passes) t.end = true; else { t.i++; t.j = 0; t.sw = false; } } };
        if (m[0] === 'stop') t.done = true;
        else if (m[0] === 'cmp') { t.comps++; t.last = t.j; t.swapped = false; if (t.a[t.j] > t.a[t.j + 1]) t.need = true; else next(); }
        else { const j = t.last; [t.a[j], t.a[j + 1]] = [t.a[j + 1], t.a[j]]; t.swaps++; t.sw = true; t.need = false; t.swapped = true; next(); }
        return t; },
      wrong(lv, s, m) { const {a, i, j, last} = s, n = a.length, passes = lv.passes || n - 1, nx = `Следующая пара — ${P(a, j)}.`, k = Number(m[1]);
        if (s.end) return (lv.flag && !s.sw ? `За проход ${i + 1} не было ни одного обмена — флаг остался False. Значит, состав уже упорядочен и алгоритм останавливается.` : passes === 1 ? 'Проход закончен: самый большой номер уже в конце состава.' : `Все ${word(passes, PASSES)} сделаны — алгоритм закончил работу.`) + ' Нажми «Готово».';
        if (s.need) return `${a[last]} > ${a[last + 1]}: левый номер больше, поэтому вагоны a[${last}] и a[${last + 1}] нужно поменять местами — щёлкни их сцепку ещё раз или «Поменять» (S).`;
        if (m[0] === 'cmp') { if (!(Number.isInteger(k) && k >= 0 && k < n - 1)) return 'Такой пары в составе нет. ' + nx;
          if (k >= n - 1 - i) return `Правее не сравниваем: ${i === 1 ? 'после первого прохода последний вагон уже стоит на своём месте' : `после ${i} проходов последние ${word(i, CARS)} уже стоят на своих местах`}. ${nx}`;
          if (j === 0) return (i ? `Начался проход ${i + 1}: пузырёк снова идёт от начала состава. ` : 'Пузырёк начинает с самой левой пары. ') + nx;
          return (k < j ? `Пару a[${k}] и a[${k + 1}] в этом проходе уже сравнивали: пузырёк идёт только слева направо. ` : 'Пузырёк не перескакивает через пары. ') + nx; }
        if (m[0] === 'swap') return j === 0 ? `Сначала сравни пару: проход ${i + 1} начинается с ${P(a, 0)}.` : s.swapped ? `Вагоны a[${last}] и a[${last + 1}] уже поменяли местами. ${nx}`
          : `${a[last]} ${a[last] === a[last + 1] ? '=' : '<'} ${a[last + 1]}: ${a[last] === a[last + 1] ? 'равные вагоны пузырёк не меняет — в условии a[j] > a[j + 1] знак строгий' : 'вагоны уже стоят по порядку, их не меняют'}. ${nx}`;
        if (m[0] === 'stop') return j > 0 ? `Проход ${i + 1} ещё не закончен${lv.flag ? ': были ли в нём обмены, станет ясно только в конце' : ''}. ${nx}` : i === 0 ? `Сортировка ещё не началась. ${nx}`
          : lv.flag ? `В проходе ${i} были обмены — флаг стал True, поэтому нужен ещё один проход. ${nx}` : `Рано: без флага пузырёк делает все ${word(n - 1, PASSES)}, даже если состав уже упорядочен. Начинается проход ${i + 1}. ${nx}`;
        return 'В пузырьковой сортировке такого хода нет. ' + nx; },
      note(lv, s, m, t) { const n = s.a.length, l = t.last; if (m[0] === 'stop') return lv.passes === 1 ? 'Проход закончен.' : 'Сортировка закончена.';
        let x = m[0] === 'cmp' ? t.need ? `${t.a[l]} > ${t.a[l + 1]} — левый номер больше: меняй вагоны местами.` : t.a[l] === t.a[l + 1] ? `${t.a[l]} = ${t.a[l + 1]} — равные вагоны не меняем.` : `${t.a[l]} < ${t.a[l + 1]} — порядок верный, оставляем.` : `Поменяли: теперь ${t.a[l]} и ${t.a[l + 1]}.`;
        if (t.i > s.i || (t.end && !s.end)) x += ` Проход ${s.i + 1} закончен: ${t.a[n - 1 - s.i]} — на своём месте.` + (lv.flag ? t.end && !t.sw ? ' Обменов не было: flag = False.' : ' Обмены были: flag = True.' : '');
        return x; }},
    select: {
      start: d => ({a: d.a.slice(), i: 0, end: d.a.length < 2, done: false, swaps: 0, from: -1}),
      expect: (lv, s) => s.end ? [['stop']] : [['pick', minAt(s.a, s.i)]],
      apply(lv, s, m) { const t = {...s, a: s.a.slice()}; if (m[0] === 'stop') { t.done = true; return t; } const k = Number(m[1]); if (k !== t.i) { [t.a[t.i], t.a[k]] = [t.a[k], t.a[t.i]]; t.swaps++; } t.from = k; t.i++; if (t.i >= t.a.length - 1) t.end = true; return t; },
      wrong(lv, s, m) { const {a, i} = s, n = a.length, k = Number(m[1]); if (s.end) return `Неупорядоченным остался один вагон — он уже на своём месте, поэтому проходов n − 1 = ${n - 1}. Нажми «Готово».`;
        const p = minAt(a, i), nx = `Минимум неупорядоченной части — ${a[p]} (a[${p}]): он встаёт на место a[${i}].`;
        if (m[0] === 'stop') return `Ещё не все вагоны на местах: выбор делает n − 1 = ${word(n - 1, PASSES)}, сейчас проход ${i + 1}. ${nx}`;
        if (m[0] !== 'pick' || !(Number.isInteger(k) && k >= 0 && k < n)) return 'В сортировке выбором такого хода нет. ' + nx;
        if (k < i) return `${i === 1 ? 'Вагон a[0] уже на своём месте' : `Вагоны a[0]${i === 2 ? ' и ' : '…'}a[${i - 1}] уже на своих местах`}: минимум ищем только в неупорядоченной части a[${i}]…a[${n - 1}]. ${nx}`;
        if (a[k] === a[p]) return `Номер ${a[p]} встречается несколько раз. Алгоритм запоминает первый минимум, самый левый: условие a[j] < a[m] строгое, и равный номер правее его не заменяет. ${nx}`;
        return `${a[k]} — не самый маленький: в неупорядоченной части есть номер меньше. ${nx}`; },
      note(lv, s, m, t) { if (m[0] === 'stop') return 'Сортировка закончена.'; const k = t.from, v = s.a[k]; return k === s.i ? `Минимум ${v} уже стоит на месте a[${s.i}] — менять не нужно.` : `Минимум ${v} поменялся местами с ${s.a[s.i]} и встал на место a[${s.i}].`; }},
    insert: {
      start: d => ({a: d.a.slice(), i: 1, end: d.a.length < 2, done: false, shifts: 0, at: -1}),
      expect: (lv, s) => s.end ? [['stop']] : [['ins', insertAt(s.a, s.i)]],
      apply(lv, s, m) { const t = {...s, a: s.a.slice()}; if (m[0] === 'stop') { t.done = true; return t; } const p = Number(m[1]); t.a.splice(p, 0, t.a.splice(t.i, 1)[0]); t.shifts += t.i - p; t.at = p; t.i++; if (t.i >= t.a.length) t.end = true; return t; },
      wrong(lv, s, m) { const {a, i} = s, q = Number(m[1]); if (s.end) return 'Все вагоны уже вставлены в упорядоченную часть — сортировка закончена. Нажми «Готово».';
        const x = a[i], p = insertAt(a, i), nx = `${x} встаёт на место a[${p}]${p === i ? ' — то есть остаётся, где стоит' : ''}.`;
        if (m[0] === 'stop') return `Ещё не все вагоны вставлены: следующий — ${x} (a[${i}]). ${nx}`;
        if (m[0] !== 'ins' || !(Number.isInteger(q) && q >= 0 && q <= i)) return 'Вагон можно вставить только в упорядоченную часть левее него или оставить на месте. ' + nx;
        if (q > p) return (q === i ? `Слева от ${x} стоит ${a[i - 1]} > ${x}, а такие вагоны алгоритм сдвигает вправо — остаться на месте ${x} не может.` : `Вагон ${a[q - 1]} (a[${q - 1}]) больше ${x} — алгоритм сдвинет его вправо, значит ${x} встанет левее.`) + ` Сдвигаются все номера больше ${x}: ${a.slice(p, i).join(', ')}. ${nx}`;
        return `Алгоритм идёт от ${x} влево и останавливается на первом номере, не большем ${x}: это ${a[p - 1]} (a[${p - 1}]).${a[p - 1] === x ? ' Равный вагон не обгоняем — в условии a[j] > x знак строгий.' : ''} ${nx}`; },
      note(lv, s, m, t) { if (m[0] === 'stop') return 'Сортировка закончена.'; const x = s.a[s.i], d = s.i - t.at; return d ? `${x} вставлен на место a[${t.at}], вправо сдвинуто: ${word(d, CARS)}.` : `${x} не меньше соседа слева — остаётся на месте.`; }},
    search: {
      start: d => ({a: d.a.slice(), x: d.x, L: 0, R: d.a.length - 1, probes: 0, open: [], found: -1, done: false, c: -1}),
      expect(lv, s) { if (s.L > s.R) return [['none']]; const c = (s.L + s.R) >> 1, e = (s.L + s.R + 1) >> 1; return c === e ? [['probe', c]] : [['probe', c], ['probe', e]]; },
      apply(lv, s, m) { const t = {...s}; if (m[0] === 'none') { t.done = true; return t; } const c = Number(m[1]); t.open = s.open.concat([c]); t.probes++; t.c = c; if (t.a[c] === t.x) { t.found = c; t.done = true; } else if (t.a[c] < t.x) t.L = c + 1; else t.R = c - 1; return t; },
      wrong(lv, s, m) { const {a, x, L, R} = s, n = a.length, c = (L + R) >> 1, e = (L + R + 1) >> 1, k = Number(m[1]);
        if (L > R) return `Участок поиска опустел: ${R < 0 ? `все номера больше ${x}` : L >= n ? `все номера меньше ${x}` : `a[${R}] = ${a[R]} < ${x} < ${a[L]} = a[${L}], а между ними вагонов нет`}. Значит, вагона ${x} в составе нет — нажми «Такого вагона нет» (X).`;
        const nx = `Участок поиска — a[${L}]…a[${R}], в нём ${word(R - L + 1, CARS)}. Середина: (${L} + ${R}) // 2 = ${c}${c !== e ? `; вагонов чётное число, поэтому подходит и (${L} + ${R} + 1) // 2 = ${e}` : ''} — открывай a[${c}]${c !== e ? ` или a[${e}]` : ''}.`;
        if (m[0] === 'none') return `Рано: на участке ещё есть вагоны, нужный может быть среди них. ${nx}`;
        if (m[0] !== 'probe' || !(Number.isInteger(k) && k >= 0 && k < n)) return 'При двоичном поиске такого хода нет. ' + nx;
        if (k < L || k > R) return `Вагон a[${k}] уже вне участка поиска: ${k < L ? `левее a[${L}] все номера меньше ${x}` : `правее a[${R}] все номера больше ${x}`}. ${nx}`;
        return `a[${k}] — не середина участка: открыв его, в худшем случае отбросишь меньше половины вагонов. ${nx}`; },
      note(lv, s, m, t) { if (m[0] === 'none') return `Вагона ${s.x} в составе нет: участок поиска пуст.`; const c = t.c, v = s.a[c];
        return v === s.x ? `a[${c}] = ${v} — нашли за ${word(t.probes, OPENS)}!` : v < s.x ? `a[${c}] = ${v} < ${s.x} — искомый правее: отбрасываем a[${s.L}]…a[${c}].` : `a[${c}] = ${v} > ${s.x} — искомый левее: отбрасываем a[${c}]…a[${s.R}].`; }},
    quiz: {
      start: d => ({seed: d.seed, k: 0, good: 0, done: false}),
      expect: (lv, s) => [['ans', String(problem(lv, s.seed, s.k).answer)]],
      apply: (lv, s) => ({...s, k: s.k + 1, good: s.good + 1, done: s.good + 1 >= lv.need}),
      miss: (lv, s, m) => m[0] === 'ans' ? {...s, k: s.k + 1} : s,
      wrong(lv, s) { const p = problem(lv, s.seed, s.k); return `Неверно, правильный ответ: ${p.answer}. ${p.explain}`; },
      note: (lv, s) => 'Верно! ' + problem(lv, s.seed, s.k).explain},
  };
  // Ход — массив: ['cmp', j], ['swap'], ['stop'], ['pick', k], ['ins', p], ['probe', c], ['none'], ['ans', текст]. Ответы сравниваются по числам в тексте.
  const key = m => !Array.isArray(m) ? '' : m[0] === 'ans' ? 'ans ' + (String(m[1] ?? '').match(/-?\d+/g) || []).join(' ') : m.map(String).join(' ');
  const data = (lv, seed) => lv.kind === 'quiz' ? {seed} : lv.gen(rng(seed * 7919 + LEVELS.indexOf(lv) * 131));
  const problem = (lv, seed, k) => lv.gen(rng(seed * 7919 + LEVELS.indexOf(lv) * 131 + (k + 1) * 100003));
  const start = (lv, seed) => ALG[lv.kind].start(data(lv, seed));
  const expect = (lv, s) => s.done ? [] : ALG[lv.kind].expect(lv, s);
  function step(lv, s, m) { const A = ALG[lv.kind]; m = Array.isArray(m) ? m : [];
    if (s.done) return {ok: false, st: s, msg: 'Алгоритм уже закончил работу.'};
    if (expect(lv, s).some(e => key(e) === key(m))) { const t = A.apply(lv, s, m); return {ok: true, st: t, msg: A.note(lv, s, m, t)}; }
    return {ok: false, st: A.miss ? A.miss(lv, s, m) : s, msg: A.wrong(lv, s, m)}; }
  const summary = (lv, s) => lv.kind === 'bubble' ? `Сравнений: ${s.comps}, обменов: ${s.swaps}.` : lv.kind === 'select' ? `Обменов: ${s.swaps}.` : lv.kind === 'insert' ? `Сдвигов: ${s.shifts}.`
    : lv.kind === 'search' ? s.found >= 0 ? `Нашли за ${word(s.probes, OPENS)}.` : `Вагона нет: ${word(s.probes, OPENS)}.` : `Верных ответов: ${s.good}.`;
  // Ответ ученика — {seed, steps}: все его ходы по порядку, вместе с неверными. Звёзды: 3 — без ошибок, 2 — одна ошибка, 1 — больше.
  function check(lv, ans) {
    if (!ans || !Number.isInteger(ans.seed) || !Array.isArray(ans.steps)) return {ok: false, msg: 'Нет ходов.'};
    let s = start(lv, ans.seed), errors = 0;
    for (const m of ans.steps.slice(0, 5000)) { if (s.done) break; const r = step(lv, s, m); if (!r.ok) errors++; s = r.st; }
    if (!s.done) return {ok: false, errors, msg: lv.kind === 'quiz' ? `Верных ответов: ${s.good} из ${lv.need}.` : 'Алгоритм ещё не доведён до конца.'};
    return {ok: true, stars: errors ? errors === 1 ? 2 : 1 : 3, errors, msg: (errors ? `Неверных ${lv.kind === 'quiz' ? 'ответов' : 'ходов'}: ${errors}. ` : `Ни одного неверного ${lv.kind === 'quiz' ? 'ответа' : 'хода'}! `) + summary(lv, s)};
  }
  function solve(lv) { let s = start(lv, 1); const steps = []; while (!s.done && steps.length < 800) { const m = expect(lv, s)[0]; steps.push(m); s = step(lv, s, m).st; } return {seed: 1, steps}; }
  const CODE = {
    pass: 'for j in range(len(a) - 1):\n    if a[j] > a[j + 1]:\n        a[j], a[j + 1] = a[j + 1], a[j]',
    bubble: 'n = len(a)\nfor i in range(n - 1):\n    for j in range(n - 1 - i):\n        if a[j] > a[j + 1]:\n            a[j], a[j + 1] = a[j + 1], a[j]',
    flag: 'n = len(a)\nfor i in range(n - 1):\n    flag = False\n    for j in range(n - 1 - i):\n        if a[j] > a[j + 1]:\n            a[j], a[j + 1] = a[j + 1], a[j]\n            flag = True\n    if not flag:\n        break',
    select: 'n = len(a)\nfor i in range(n - 1):\n    m = i\n    for j in range(i + 1, n):\n        if a[j] < a[m]:\n            m = j\n    a[i], a[m] = a[m], a[i]',
    insert: 'for i in range(1, len(a)):\n    x = a[i]\n    j = i - 1\n    while j >= 0 and a[j] > x:\n        a[j + 1] = a[j]\n        j -= 1\n    a[j + 1] = x',
    search: 'L, R = 0, len(a) - 1\nwhile L <= R:\n    c = (L + R) // 2   # или (L + R + 1) // 2\n    if a[c] == x:\n        break          # нашли\n    if a[c] < x:\n        L = c + 1\n    else:\n        R = c - 1\n# L > R: вагона x нет',
  };
  const codeOf = lv => CODE[lv.kind === 'bubble' ? lv.passes === 1 ? 'pass' : lv.flag ? 'flag' : 'bubble' : lv.code || lv.kind];

  /* ---------- экран ---------- */
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'), code = el('pre', 'lab-code'); code.textContent = codeOf(lv);
    const img = (n, c) => { const i = new Image(); i.src = `art/train_${n}.webp?v=1`; i.alt = ''; i.className = c; i.addEventListener('error', () => i.remove()); return i; };
    const size = n => 'sy-train' + (n > 20 ? ' small' : n > 10 ? ' mid' : '');
    task.append(el('h2', '', lv.title), el('p', '', lv.brief)); host.append(task);
    let seed = Math.floor(Math.random() * 1e6), st = start(lv, seed), steps = [], forced = null, over = false;
    const act = m => { if (over) return null; const r = step(lv, st, m); steps.push(m); st = r.st; if (st.done) { over = true; const c = check(lv, {seed, steps}); api.finish(c.stars || 1, c.msg); } return r; };
    const reset = f => { seed = f.seed; st = start(lv, seed); steps = []; over = false; forced = null; };
    if (lv.kind === 'quiz') {
      // Задачи на счёт: ответ — число или номера через пробел; после ошибки — разбор и новая задача.
      const box = el('div', 'lab-panel og-box'), dots = el('div', 'og-dots'), cols = el('div', 'lab-cols'), side = el('div', 'lab-panel'), stat = el('p', 'sy-stat');
      const still = a => { const t = el('div', size(a.length)); t.append(img('loco', 'sy-loco'), ...a.map((v, p) => { const c = el('div', 'sy-car'); c.append(el('b', 'sy-num', String(v)), img('car', 'sy-carimg'), el('small', '', `a[${p}]`)); return c; })); return t; };
      const paint = now => { dots.replaceChildren(...Array.from({length: lv.need}, (_, i) => el('i', i < st.good ? 'good' : now && i === st.good ? 'now' : ''))); stat.textContent = `Решено: ${st.good} из ${lv.need} · ошибок: ${steps.length - st.good}`; };
      function show() { const p = problem(lv, seed, st.k), form = el('form', 'og-form'), inp = el('input'), go = button('Ответить', 'lab-main', () => form.requestSubmit()); go.dataset.act = 'run';
        inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Ответ'); inp.placeholder = lv.gen === Q.selk ? 'номера через пробел' : 'число'; inp.inputMode = lv.gen === Q.selk ? 'text' : 'numeric'; form.append(el('span', '', 'Ответ:'), inp, go);
        form.addEventListener('submit', e => { e.preventDefault(); if (forced) { const f = forced; reset(f); for (const m of f.steps) if (!over) act(m); return; } if (!inp.value.trim()) return;
          const r = act(['ans', inp.value]); if (!r) return; msg.textContent = r.msg; msg.className = 'lab-msg ' + (r.ok ? 'good' : 'bad'); if (over) return;
          const next = button(r.ok ? 'Следующая задача →' : 'Новая задача →', 'lab-main', show); form.replaceWith(next); next.focus(); paint(false); });
        box.replaceChildren(el('p', 'lab-eyebrow', `ЗАДАЧА ${st.good + 1} ИЗ ${lv.need}`), el('p', 'og-text', p.text), ...(p.a ? [still(p.a)] : []), form, msg); msg.textContent = ''; msg.className = 'lab-msg'; paint(true); setTimeout(() => inp.focus(), 50); }
      side.append(el('h3', '', 'Алгоритм на Python'), code, stat); cols.append(box, side); host.append(dots, cols); show();
      if (api.debugHost) window.labSet = a => { forced = a; };
      return null;
    }
    // Пошаговые уровни: состав на путях, сцепки ⇆ / стрелки ▼ между вагонами, кнопки «Поменять» и «Готово».
    const yard = el('div', 'lab-panel sy-yard'), train = el('div', 'sy-train'), stat = el('p', 'sy-stat'), bar = el('div', 'lab-bar sy-bar'), log = el('ol', 'sy-log'), goal = el('p', 'sy-goal');
    const swapBtn = lv.kind === 'bubble' ? button('⇄ Поменять местами (S)', 'lab-main', () => run(['swap'])) : null;
    const endBtn = button(lv.kind === 'search' ? '✕ Такого вагона нет (X)' : '■ Готово (X)', 'lab-small', () => { if (forced) { const f = forced; reset(f); bad = 0; log.replaceChildren(); for (const m of f.steps) if (!over) run(m); return; } run([lv.kind === 'search' ? 'none' : 'stop']); }); endBtn.dataset.act = 'run';
    let moved = [], bad = 0;
    const run = m => { const before = st, r = act(m); if (!r) return; moved = []; if (!r.ok) bad++;
      if (r.ok) { const t = st; if (m[0] === 'swap') moved = [t.last, t.last + 1]; else if (m[0] === 'pick' && t.from !== before.i) moved = [before.i, t.from]; else if (m[0] === 'ins') moved = [t.at]; else if (m[0] === 'probe') moved = [t.c];
        const li = el('li', '', r.msg); log.prepend(li); while (log.children.length > 14) log.lastChild.remove(); }
      else { yard.classList.remove('shake'); void yard.offsetWidth; yard.classList.add('shake'); }
      msg.textContent = r.msg; msg.className = 'lab-msg ' + (r.ok ? 'good' : 'bad'); draw(); };
    function status() { const n = st.a.length, e = `ошибок: ${bad}`;
      if (lv.kind === 'bubble') return `Проход ${st.i + 1} · сравнений: ${st.comps} · обменов: ${st.swaps}${lv.flag ? ` · flag = ${st.sw ? 'True' : 'False'}` : ''} · ${e}`;
      if (lv.kind === 'select') return `Проход ${Math.min(st.i + 1, n - 1)} · обменов: ${st.swaps} · ${e}`;
      if (lv.kind === 'insert') return `${st.end ? 'Все вагоны вставлены' : `Вставляем ${st.a[st.i]} (a[${st.i}])`} · сдвигов: ${st.shifts} · ${e}`;
      return `Участок поиска: ${st.L <= st.R ? `a[${st.L}]…a[${st.R}], ${word(st.R - st.L + 1, CARS)}` : 'пуст'} · вскрыто: ${st.probes} · ${e}`; }
    const gap = p => { const n = st.a.length;
      if (lv.kind === 'bubble' && p > 0 && p < n) { const j = p - 1, g = button('⇆', 'sy-gap' + (j === st.last && !st.done ? ' on' : ''), () => run(j === st.last && !st.swapped && !st.end ? ['swap'] : ['cmp', j])); g.dataset.k = 'g' + j; g.setAttribute('aria-label', `Сравнить a[${j}] и a[${j + 1}]`); g.title = g.getAttribute('aria-label'); g.disabled = over; return g; }
      if (lv.kind === 'insert' && !st.end && p <= st.i) { const g = button('▼', 'sy-gap ins' + (p === st.i ? ' stay' : ''), () => run(['ins', p])); g.dataset.k = 'g' + p; g.title = p === st.i ? `Оставить ${st.a[st.i]} на месте` : `Вставить ${st.a[st.i]} сюда — станет a[${p}]`; g.setAttribute('aria-label', g.title); g.disabled = over; return g; }
      return null; };
    const car = p => { const n = st.a.length, k = lv.kind, v = st.a[p]; let cls = 'sy-car', label = String(v), click = null, mark = '';
      if (k === 'bubble') { const from = st.end && lv.passes !== 1 ? 0 : n - st.i - (st.end ? 1 : 0); if (p >= from) cls += ' fixed'; if (st.last >= 0 && (p === st.last || p === st.last + 1) && !st.done) cls += st.need ? ' cmp hot' : ' cmp'; }
      if (k === 'select') { if (p < st.i || st.end) cls += ' fixed'; else if (p === st.i) { cls += ' slot'; mark = 'сюда'; } click = () => run(['pick', p]); }
      if (k === 'insert') { if (st.end) cls += ' fixed'; else if (p < st.i) cls += ' part'; else if (p === st.i) cls += ' key'; }
      if (k === 'search') { if (!st.open.includes(p)) { cls += ' hid'; label = '?'; } if (p === st.found) cls += ' found'; else if (p < st.L || p > st.R) cls += ' out'; click = () => run(['probe', p]); if (st.L <= st.R && !st.done) mark = p === st.L && p === st.R ? 'L R' : p === st.L ? 'L' : p === st.R ? 'R' : ''; }
      if (moved.includes(p)) cls += ' moved';
      const c = click ? button('', cls, click) : el('div', cls); if (mark) c.append(el('i', 'sy-tag', mark)); c.append(el('b', 'sy-num', label), img('car', 'sy-carimg'), el('small', '', `a[${p}]`));
      if (click) { c.dataset.k = 'c' + p; c.disabled = over; c.setAttribute('aria-label', `Вагон a[${p}]` + (label === '?' ? ', закрыт' : `, номер ${v}`)); } return c; };
    function draw() { const n = st.a.length, f = document.activeElement && train.contains(document.activeElement) ? document.activeElement.dataset.k : null, kids = [img('loco', 'sy-loco')];
      for (let p = 0; p <= n; p++) { const g = gap(p); if (g) kids.push(g); if (p < n) kids.push(car(p)); }
      train.className = size(n); train.replaceChildren(...kids); if (f) { const x = train.querySelector(`[data-k="${f}"]`); if (x && !x.disabled) x.focus(); }
      stat.textContent = status(); if (swapBtn) swapBtn.disabled = over; endBtn.disabled = over && !forced; if (lv.kind === 'search') goal.replaceChildren('Ищем вагон № ', el('b', '', String(st.x))); }
    bar.append(...(swapBtn ? [swapBtn] : []), endBtn);
    yard.append(...(lv.kind === 'search' ? [goal] : []), train, stat, bar, msg);
    const cols = el('div', 'lab-cols'), left = el('div', 'lab-panel'), right = el('div', 'lab-panel');
    left.append(el('h3', '', 'Ход алгоритма'), log, el('p', 'lab-note', 'Клавиатура: ← → — выбрать ' + (lv.kind === 'bubble' ? 'сцепку' : lv.kind === 'insert' ? 'место' : 'вагон') + ', Enter — щёлкнуть' + (swapBtn ? ', S — поменять местами' : '') + `, X — «${lv.kind === 'search' ? 'Такого вагона нет' : 'Готово'}».`));
    right.append(el('h3', '', 'Алгоритм на Python'), code); cols.append(left, right); host.append(yard, cols); draw();
    const onKey = e => { if (over || e.ctrlKey || e.metaKey || e.altKey || (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) || document.querySelector('.lab-over:not([hidden])')) return;
      if (e.code === 'KeyS' && swapBtn) { e.preventDefault(); run(['swap']); }
      else if (e.code === 'KeyX') { e.preventDefault(); endBtn.click(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const list = [...train.querySelectorAll('button:not(:disabled)')]; if (!list.length) return; e.preventDefault(); const i = list.indexOf(document.activeElement);
        list[i < 0 ? (e.key === 'ArrowRight' ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))].focus(); } };
    document.addEventListener('keydown', onKey);
    if (api.debugHost) window.labSet = a => { forced = a; endBtn.disabled = false; };
    return () => document.removeEventListener('keydown', onKey);
  }
  LAB.register({id: 'sortyard', bg: 'bg_arrays', hero: 'host_conductor', title: 'Сортировочная горка', genre: 'сортировка и поиск', art: '🚃', color: '#6b9bff', unit: 'Задание', minutes: 40,
    about: 'Вагоны с номерами на сортировочной горке. Сам выполняй алгоритмы шаг за шагом — пузырёк (и с флагом), выбор, вставки, двоичный поиск: игра проверяет каждый ход и объясняет ошибку. А ещё задачи: сколько обменов, каким станет состав, сколько вскрытий.',
    levels: () => LEVELS, mount, check, solve, LEVELS, ALG, start, expect, step, key, data, problem, codeOf, bubbleRun, inversions, worst});
})();
