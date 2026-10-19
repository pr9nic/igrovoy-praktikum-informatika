// «Поезд массивов»: обработка одномерных массивов на Python (9 класс §1.5, 11 класс §8). Список a уже лежит в памяти —
// ученик пишет программу, она проверяется на трёх разных массивах (подогнать под один не выйдет). Вагоны поезда — элементы массива.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const arr = (r, n, lo, hi) => Array.from({length: n}, () => ri(r, lo, hi));
  const PY = () => globalThis.CodeHero || (typeof require === 'function' ? require('../../codehero/core.js') : null);
  const show = v => Array.isArray(v) ? '[' + v.map(show).join(', ') + ']' : v === true ? 'True' : v === false ? 'False' : v == null ? 'None' : String(v);
  function runPy(code, vars) {
    const H = PY(); if (!H) throw new Error('интерпретатор Python не загрузился'); const out = [];
    const prog = H.parse(String(code)), it = H.run(prog, {...vars, print: {builtin: 'print', call: args => { out.push(args.map(show).join(' ')); return null; }}}, {ops: 200000});
    for (const _ of it) {} return {out: out.join('\n').trim(), vars};
  }
  // Уровень: brief, data(r) → {a, ...переменные}, want(vars) → ожидаемый вывод, ref — образец, ban — запрещённые слова (готовые функции).
  const L = o => o;
  const LEVELS = [
    L({title: 'Сумма груза', brief: 'В списке a — масса груза в каждом вагоне. Выведи общую массу. Готовую функцию sum не используй — пройди по вагонам циклом.', data: r => ({a: arr(r, ri(r, 5, 9), 1, 50)}), want: v => v.a.reduce((s, x) => s + x, 0), ref: 's = 0\nfor x in a:\n    s += x\nprint(s)', ban: ['sum(']}),
    L({title: 'Чётные вагоны', brief: 'Выведи, сколько в списке a чётных чисел.', data: r => ({a: arr(r, ri(r, 6, 10), 1, 99)}), want: v => v.a.filter(x => x % 2 === 0).length, ref: 'k = 0\nfor x in a:\n    if x % 2 == 0:\n        k += 1\nprint(k)'}),
    L({title: 'Самый тяжёлый', brief: 'Выведи наибольший элемент списка a и через пробел его номер (индекс, счёт с нуля). Если максимумов несколько — номер первого. Функции max не используй.', data: r => ({a: arr(r, ri(r, 6, 10), 1, 60)}), want: v => { const m = Math.max(...v.a); return `${m} ${v.a.indexOf(m)}`; }, ref: 'm = 0\nfor i in range(len(a)):\n    if a[i] > a[m]:\n        m = i\nprint(a[m], m)', ban: ['max(', 'index(']}),
    L({title: 'Средний груз', brief: 'Выведи среднее арифметическое элементов a, округлённое вниз до целого (используй //).', data: r => ({a: arr(r, ri(r, 4, 9), 1, 100)}), want: v => Math.floor(v.a.reduce((s, x) => s + x, 0) / v.a.length), ref: 's = 0\nfor x in a:\n    s += x\nprint(s // len(a))'}),
    L({title: 'Без отрицательных', brief: 'Замени в списке a все отрицательные числа нулями и выведи список: print(a).', data: r => ({a: arr(r, ri(r, 6, 9), -20, 20)}), want: v => show(v.a.map(x => x < 0 ? 0 : x)), ref: 'for i in range(len(a)):\n    if a[i] < 0:\n        a[i] = 0\nprint(a)'}),
    L({title: 'Поезд задом наперёд', brief: 'Разверни список a «на месте» (меняй местами элементы с двух концов) и выведи print(a). Срезы и reverse не используй.', data: r => ({a: arr(r, ri(r, 5, 9), 1, 50)}), want: v => show(v.a.slice().reverse()), ref: 'n = len(a)\nfor i in range(n // 2):\n    t = a[i]\n    a[i] = a[n - 1 - i]\n    a[n - 1 - i] = t\nprint(a)', ban: ['reverse', '[::']}),
    L({title: 'Есть ли вагон?', brief: 'Есть ли в списке a число x? Выведи YES или NO. Оператор in не используй — найди циклом.', data: r => { const a = arr(r, ri(r, 6, 9), 1, 30); return {a, x: r() < 0.5 ? a[ri(r, 0, a.length - 1)] : ri(r, 31, 60)}; }, want: v => v.a.includes(v.x) ? 'YES' : 'NO', ref: 'f = "NO"\nfor i in range(len(a)):\n    if a[i] == x:\n        f = "YES"\nprint(f)', ban: [' in a']}),
    L({title: 'Соседи', brief: 'Сколько в списке a пар соседних элементов, в которых оба числа чётные? Пары: (a[0], a[1]), (a[1], a[2]), …', data: r => ({a: arr(r, ri(r, 7, 11), 1, 20)}), want: v => v.a.slice(1).filter((x, i) => x % 2 === 0 && v.a[i] % 2 === 0).length, ref: 'k = 0\nfor i in range(len(a) - 1):\n    if a[i] % 2 == 0 and a[i + 1] % 2 == 0:\n        k += 1\nprint(k)'}),
    L({title: 'Сдвиг состава', brief: 'Сдвинь элементы списка a циклически влево на один: первый вагон уезжает в конец. Выведи print(a).', data: r => ({a: arr(r, ri(r, 5, 9), 1, 50)}), want: v => show([...v.a.slice(1), v.a[0]]), ref: 't = a[0]\nfor i in range(len(a) - 1):\n    a[i] = a[i + 1]\na[len(a) - 1] = t\nprint(a)'}),
    L({title: 'Сортировка вагонов', brief: 'Отсортируй список a по возрастанию методом пузырька (сравнивай соседей и меняй местами) и выведи print(a). sort и sorted не используй.', data: r => ({a: arr(r, ri(r, 5, 8), 1, 60)}), want: v => show(v.a.slice().sort((x, y) => x - y)), ref: 'n = len(a)\nfor i in range(n - 1):\n    for j in range(n - 1 - i):\n        if a[j] > a[j + 1]:\n            t = a[j]\n            a[j] = a[j + 1]\n            a[j + 1] = t\nprint(a)', ban: ['sort']}),
  ];
  const SEEDS = [5, 17, 29];
  const sets = lv => SEEDS.map(s => lv.data(rng(s * 37 + LEVELS.indexOf(lv) * 11)));
  // Запреты проверяются по дереву разбора программы: «for y in a:» и переменная is_sorted под запрет не попадают.
  const BAN = {'sum(': ['sum('], 'max(': ['max('], 'index(': ['.index'], 'reverse': ['.reverse', 'reversed('], ' in a': ['in'], 'sort': ['.sort', 'sorted(']};
  function uses(code) {
    const out = new Set(), walk = n => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(walk);
      if (n.k === 'attr') out.add('.' + n.name); if (n.k === 'call' && n.f.k === 'name') out.add(n.f.name + '('); if (n.k === 'cmp' && n.ops.some(o => o === 'in' || o === 'not in')) out.add('in');
      Object.values(n).forEach(walk); };
    try { walk(PY().parse(code)); } catch { /* синтаксическую ошибку покажет запуск */ }
    return out;
  }
  const copy = v => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Array.isArray(x) ? x.slice() : x]));
  function check(lv, code) {
    if (typeof code !== 'string' || !code.trim()) return {ok: false, msg: 'Напиши программу.', results: []};
    const low = code.replace(/#.*/g, ''), used = uses(code); for (const b of lv.ban || []) if (BAN[b] ? BAN[b].some(x => used.has(x)) : low.includes(b)) return {ok: false, msg: `В этом задании нельзя использовать «${b.trim()}» — реши циклом.`, results: []};
    const results = sets(lv).map(v => { const want = String(lv.want(copy(v))); try { const got = runPy(code, copy(v)).out; return {ok: got === want, got, want, a: v.a}; } catch (e) { return {ok: false, err: (e.line ? `строка ${e.line}: ` : '') + e.message, want, a: v.a}; } });
    const good = results.filter(x => x.ok).length;
    return good === 3 ? {ok: true, stars: 3, msg: 'Программа верна на всех трёх составах.', results} : {ok: false, msg: `Верно на составах: ${good} из 3.`, results};
  }
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'), train = el('div', 'ar-train'), res = el('div', 'og-results'); let tries = 0;
    task.append(el('h2', '', lv.title), el('p', '', lv.brief));
    const first = sets(lv)[0], extra = Object.entries(first).filter(([k]) => k !== 'a').map(([k, x]) => `${k} = ${show(x)}`).join(', ');
    const drawTrain = a => { const mx = Math.max(1, ...a.map(Math.abs)); const img = (n, c) => { const i = new Image(); i.src = `art/train_${n}.webp?v=1`; i.alt = ''; i.className = c; return i; };
      // Поезд едет справа налево: паровоз впереди, за ним вагоны a[0], a[1], …; высота кристаллов в вагоне — величина элемента.
      train.replaceChildren(img('loco', 'ar-loco'), ...a.map((x, i) => { const w = el('div', 'ar-car' + (x < 0 ? ' neg' : '')), load = el('div', 'ar-load'), gem = img('gem', 'ar-gem'); gem.style.height = Math.max(8, Math.abs(x) / mx * 54) + 'px'; load.append(gem); w.append(el('b', '', String(x)), load, img('car', 'ar-carimg'), el('small', '', `a[${i}]`)); return w; })); };
    const ed = el('textarea', 'ex-code og-ed'); ed.spellcheck = false; ed.rows = 10; ed.value = '# список a уже задан\n'; ed.setAttribute('aria-label', 'Программа');
    const trial = button('▶ Запустить на этом составе', 'lab-small', () => { try { const r = runPy(ed.value, copy(first)); res.replaceChildren(el('p', '', 'Вывод: ' + (r.out || '(пусто)'))); drawTrain(r.vars.a); } catch (e) { res.replaceChildren(el('p', 'bad', 'Ошибка' + (e.line ? ` в строке ${e.line}` : '') + ': ' + e.message)); } });
    const go = button('🚦 Проверить на трёх составах', 'lab-main', () => { tries++; const r = check(lv, ed.value);
      res.replaceChildren(...r.results.map((x, i) => el('p', x.ok ? 'good' : 'bad', `Состав ${i + 1} ${show(x.a)}: ${x.ok ? 'верно ✔' : x.err ? x.err : `вывод «${x.got || '(пусто)'}», нужно «${x.want}»`}`)));
      msg.textContent = r.msg; msg.className = 'lab-msg ' + (r.ok ? 'good' : 'bad'); if (r.ok) api.finish(tries === 1 ? 3 : tries <= 3 ? 2 : 1, r.msg); }); go.dataset.act = 'run';
    const cols = el('div', 'lab-cols'), l = el('div', 'lab-panel'), rr = el('div', 'lab-panel');
    l.append(el('h3', '', 'Состав для пробы'), el('p', 'lab-note', `a = ${show(first.a)}` + (extra ? `; ${extra}` : '')), train, trial, res); rr.append(el('h3', '', 'Программа на Python'), ed, go, msg);
    cols.append(l, rr); host.append(task, cols); drawTrain(first.a);
    if (api.debugHost) window.labSet = c => { ed.value = c; };
  }
  LAB.register({id: 'arrays', bg: 'bg_arrays', hero: 'host_conductor', title: 'Поезд массивов', genre: 'массивы на Python', art: '🚂', color: '#ff9f5a', unit: 'Задание', minutes: 45,
    about: 'Вагоны поезда — элементы массива. Пиши на Python: сумма, счётчики, максимум, замена, разворот, поиск, сдвиг и сортировка пузырьком. Программа проверяется на трёх разных составах.',
    levels: () => LEVELS, mount, check, solve: lv => lv.ref, LEVELS, runPy});
})();
