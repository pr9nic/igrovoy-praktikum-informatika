// «Завод алгоритмов»: лента чисел проходит через цепочку станков. Нужно собрать цепочку, которая из входной ленты делает нужную.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  // Станки: name — подпись, k — нужен ли параметр, run — что делает с лентой, py — та же операция на Python.
  const OPS = {
    even: {name: 'ЧЁТНЫЕ', kind: 'фильтр', run: d => d.filter(x => x % 2 === 0), py: () => 'd = [x for x in d if x % 2 == 0]'},
    odd: {name: 'НЕЧЁТНЫЕ', kind: 'фильтр', run: d => d.filter(x => x % 2 !== 0), py: () => 'd = [x for x in d if x % 2 == 1]'},
    gt: {name: 'БОЛЬШЕ', kind: 'фильтр', k: 10, run: (d, k) => d.filter(x => x > k), py: k => `d = [x for x in d if x > ${k}]`},
    lt: {name: 'МЕНЬШЕ', kind: 'фильтр', k: 10, run: (d, k) => d.filter(x => x < k), py: k => `d = [x for x in d if x < ${k}]`},
    div: {name: 'КРАТНЫЕ', kind: 'фильтр', k: 3, run: (d, k) => d.filter(x => x % k === 0), py: k => `d = [x for x in d if x % ${k} == 0]`},
    add: {name: 'ПРИБАВИТЬ', kind: 'станок', k: 1, run: (d, k) => d.map(x => x + k), py: k => `d = [x + ${k} for x in d]`},
    mul: {name: 'УМНОЖИТЬ НА', kind: 'станок', k: 2, run: (d, k) => d.map(x => x * k), py: k => `d = [x * ${k} for x in d]`},
    sq: {name: 'КВАДРАТ', kind: 'станок', run: d => d.map(x => x * x), py: () => 'd = [x * x for x in d]'},
    mod: {name: 'ОСТАТОК ОТ', kind: 'станок', k: 10, run: (d, k) => d.map(x => x % k), py: k => `d = [x % ${k} for x in d]`},
    sort: {name: 'ПО ВОЗРАСТАНИЮ', kind: 'порядок', run: d => [...d].sort((a, b) => a - b), py: () => 'd = sorted(d)'},
    rsort: {name: 'ПО УБЫВАНИЮ', kind: 'порядок', run: d => [...d].sort((a, b) => b - a), py: () => 'd = sorted(d, reverse=True)'},
    rev: {name: 'РАЗВЕРНУТЬ', kind: 'порядок', run: d => [...d].reverse(), py: () => 'd = d[::-1]'},
    uniq: {name: 'БЕЗ ПОВТОРОВ', kind: 'порядок', run: d => [...new Set(d)], py: () => 'd = list(dict.fromkeys(d))'},
    first: {name: 'ПЕРВЫЕ', kind: 'порядок', k: 3, run: (d, k) => d.slice(0, k), py: k => `d = d[:${k}]`},
    sum: {name: 'СУММА', kind: 'итог', run: d => [d.reduce((a, b) => a + b, 0)], py: () => 'd = [sum(d)]'},
    max: {name: 'МАКСИМУМ', kind: 'итог', run: d => d.length ? [Math.max(...d)] : [], py: () => 'd = [max(d)]'},
    min: {name: 'МИНИМУМ', kind: 'итог', run: d => d.length ? [Math.min(...d)] : [], py: () => 'd = [min(d)]'},
    count: {name: 'СКОЛЬКО', kind: 'итог', run: d => [d.length], py: () => 'd = [len(d)]'},
  };
  const run = (chain, data) => chain.reduce((d, [op, k]) => OPS[op].run(d, k), data), same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const L = (title, brief, palette, ref, tests) => ({title, brief, palette, ref, tests, par: ref.length});
  const LEVELS = [
    L('Только чётные', 'На склад нужны только чётные детали. Поставь один станок.', ['even', 'odd', 'sort'], [['even']], [[3, 8, 5, 12, 7, 2], [10, 1, 4, 9], [7, 7, 6]]),
    L('Двойная партия', 'Каждое число на ленте нужно удвоить.', ['add', 'mul', 'sq'], [['mul', 2]], [[1, 4, 7, 3], [5, 0, 9], [2, 2, 6]]),
    L('Крупные по порядку', 'Оставь числа больше 10 и расставь их по возрастанию.', ['gt', 'lt', 'sort', 'rsort'], [['gt', 10], ['sort']], [[14, 3, 22, 9, 11, 30], [10, 12, 5, 11], [40, 8, 15]]),
    L('Сумма чётных', 'Кладовщику нужно одно число: сумма всех чётных деталей.', ['even', 'odd', 'sum', 'count', 'max'], [['even'], ['sum']], [[4, 7, 10, 3, 6], [1, 3, 8], [2, 2, 5, 12]]),
    L('Три самых больших', 'Оставь три самых больших числа, от большего к меньшему.', ['sort', 'rsort', 'first', 'rev'], [['rsort'], ['first', 3]], [[5, 19, 2, 11, 7, 14], [8, 3, 9, 1, 6], [20, 20, 4, 17]]),
    L('Главная нечётная', 'Найди самое большое нечётное число на ленте.', ['even', 'odd', 'max', 'min', 'sum'], [['odd'], ['max']], [[4, 9, 12, 7, 15, 8], [21, 2, 30, 5], [6, 3, 11, 14]]),
    L('Квадраты малышей', 'Числа меньше 6 возведи в квадрат, остальные убери.', ['gt', 'lt', 'sq', 'mul', 'sort'], [['lt', 6], ['sq']], [[3, 9, 5, 1, 7], [6, 2, 4, 10], [5, 5, 8]]),
    L('Сколько кратных трём', 'Одно число: сколько на ленте чисел, которые делятся на 3.', ['div', 'even', 'count', 'sum', 'mod'], [['div', 3], ['count']], [[3, 7, 9, 12, 5, 6], [1, 2, 4], [9, 9, 10, 15]]),
    L('Сумма квадратов чётных', 'Чётные числа возведи в квадрат и сложи.', ['even', 'odd', 'sq', 'mul', 'sum', 'count'], [['even'], ['sq'], ['sum']], [[2, 3, 4, 5], [6, 1, 1], [10, 2, 7, 4]]),
    L('Четыре разных', 'Убери повторы, расставь по возрастанию и оставь первые четыре числа.', ['uniq', 'sort', 'rsort', 'first', 'rev'], [['uniq'], ['sort'], ['first', 4]], [[5, 2, 5, 9, 2, 7, 1], [4, 4, 4, 3, 8, 6, 2], [10, 9, 8, 7, 7, 6]]),
    L('Последние цифры', 'От каждого числа оставь последнюю цифру, убери повторы, расставь по возрастанию.', ['mod', 'div', 'uniq', 'sort', 'first'], [['mod', 10], ['uniq'], ['sort']], [[23, 41, 13, 58, 71], [100, 15, 25, 7], [9, 19, 28, 38, 2]]),
    L('Три лёгких ящика', 'Одно число: общий вес трёх самых лёгких ящиков.', ['sort', 'rsort', 'first', 'sum', 'min', 'uniq'], [['sort'], ['first', 3], ['sum']], [[9, 4, 12, 6, 5], [7, 7, 1, 20], [30, 2, 2, 8, 3]]),
    L('Второе место', 'Найди второе по величине число. Одинаковые числа считаются одним местом.', ['uniq', 'sort', 'rsort', 'first', 'min', 'max', 'rev'], [['uniq'], ['rsort'], ['first', 2], ['min']], [[5, 19, 19, 11, 7], [3, 8, 1, 12, 12, 6, 10], [9, 9, 9, 4, 7, 2], [15, 3, 15, 8, 20, 1]]),
    L('Сколько разных остатков', 'Одно число: сколько разных остатков дают числа ленты при делении на 3.', ['mod', 'div', 'uniq', 'count', 'sum', 'sort'], [['mod', 3], ['uniq'], ['count']], [[3, 7, 9, 12, 5], [6, 9, 3], [1, 4, 8, 10]]),
    L('Премия лучшим', 'Двум самым большим нечётным числам прибавь по 1 и сложи результат.', ['odd', 'even', 'rsort', 'sort', 'first', 'add', 'sum', 'max'], [['odd'], ['rsort'], ['first', 2], ['add', 1], ['sum']], [[4, 9, 12, 7, 15, 8], [21, 2, 30, 5, 3], [6, 3, 11, 14, 11]]),
  ];
  function check(lv, chain) {
    if (!Array.isArray(chain) || !chain.length) return {ok: false, msg: 'Поставь на ленту хотя бы один станок.'};
    if (chain.length > 7 || chain.some(c => !lv.palette.includes(c[0]) || (OPS[c[0]].k != null && !(Number.isInteger(c[1]) && c[1] >= 1 && c[1] <= 20)))) return {ok: false, msg: 'Такой цепочки на этом заводе быть не может.'};
    const bad = lv.tests.findIndex(t => !same(run(chain, t), run(lv.ref, t)));
    if (bad >= 0) return {ok: false, test: bad, msg: bad ? 'На первой ленте всё верно, но на другой партии результат не тот. Цепочка должна работать для любых чисел.' : 'Результат не совпал с заказом.'};
    const stars = chain.length <= lv.par ? 3 : chain.length === lv.par + 1 ? 2 : 1;
    return {ok: true, stars, msg: `Станков: ${chain.length}, лучший результат — ${lv.par}.`};
  }
  const python = chain => ['d = лента'].concat(chain.map(([op, k]) => OPS[op].py(k)), ['print(d)']).join('\n');

  const ICON = {'фильтр': 'filter', 'станок': 'press', 'порядок': 'sort', 'итог': 'count'};
  const icon = kind => { const i = document.createElement('img'); i.className = 'fa-icon'; i.alt = ''; i.src = `art/machine_${ICON[kind]}.webp?v=1`; i.addEventListener('error', () => i.remove()); return i; };
  function mount(host, lv, api) {
    const {el, button} = api, chain = []; let test = 0, timer = 0;
    const task = el('div', 'lab-task'); task.append(el('h2', '', lv.title), el('p', '', lv.brief));
    const belt = (label, nums, cls) => { const row = el('div', 'fa-belt ' + (cls || '')); row.append(el('span', 'fa-label', label)); if (!nums.length) row.append(el('em', '', 'лента пуста')); for (const x of nums) row.append(el('b', '', String(x))); return row; };
    const input = el('div'), line = el('div', 'fa-line'), flow = el('div', 'fa-flow'), code = el('pre', 'lab-code'), msg = el('p', 'lab-msg'), palette = el('div', 'fa-palette');
    const drawChain = () => { line.replaceChildren(el('span', 'fa-in', 'ЛЕНТА →'));
      chain.forEach((c, i) => { const o = OPS[c[0]], box = el('div', 'fa-machine'); box.dataset.kind = o.kind; box.append(icon(o.kind), el('small', '', o.kind), el('strong', '', o.name));
        if (o.k != null) { const k = el('span', 'fa-k'); k.append(button('−', 'fa-pm', () => { c[1] = Math.max(1, c[1] - 1); drawChain(); }), el('b', '', String(c[1])), button('+', 'fa-pm', () => { c[1] = Math.min(20, c[1] + 1); drawChain(); })); box.append(k); }
        const x = button('×', 'fa-x', () => { chain.splice(i, 1); drawChain(); }); x.setAttribute('aria-label', 'Убрать станок ' + o.name); box.append(x); line.append(box, el('span', 'fa-arrow', '→')); });
      line.append(el('span', 'fa-in', chain.length ? 'СКЛАД' : 'выбери станок ниже')); code.textContent = python(chain); flow.replaceChildren(); msg.textContent = ''; msg.className = 'lab-msg'; go.disabled = !chain.length; };
    for (const op of lv.palette) { const o = OPS[op], b = button('', 'fa-add', () => { if (chain.length < 7) { chain.push(o.k != null ? [op, o.k] : [op]); drawChain(); } }); b.dataset.op = op; b.dataset.kind = o.kind; b.append(icon(o.kind), el('small', '', o.kind), el('strong', '', o.name + (o.k != null ? ' …' : ''))); palette.append(b); }
    const showInput = () => input.replaceChildren(belt('На входе', lv.tests[test]), belt('Заказ', run(lv.ref, lv.tests[test]), 'want'));
    // Запуск: лента шаг за шагом проходит станки, потом цепочка проверяется на других партиях.
    const go = button('▶ Запустить ленту', 'lab-main', () => { clearTimeout(timer); flow.replaceChildren(); msg.textContent = ''; let d = lv.tests[test], i = 0; go.disabled = true;
      const step = () => { if (i < chain.length) { d = OPS[chain[i][0]].run(d, chain[i][1]); flow.append(belt(`после «${OPS[chain[i][0]].name}${chain[i][1] != null ? ' ' + chain[i][1] : ''}»`, d)); i++; timer = setTimeout(step, 420); return; }
        go.disabled = false; const r = check(lv, chain.map(c => c.slice()));
        if (r.ok) { msg.textContent = 'Заказ выполнен на всех партиях. ' + r.msg; msg.className = 'lab-msg good'; api.finish(r.stars, r.msg); }
        else { msg.textContent = r.msg; msg.className = 'lab-msg bad'; if (r.test > 0 && r.test !== test) { test = r.test; showInput(); flow.replaceChildren(); msg.textContent += ' Смотри новую партию выше.'; } } };
      step(); }); go.dataset.act = 'run';
    const clear = button('Очистить', 'lab-small', () => { chain.length = 0; drawChain(); });
    const left = el('div', 'lab-panel'), right = el('div', 'lab-panel'), cols = el('div', 'lab-cols'), bar = el('div', 'lab-bar fa-bar'); bar.append(go, clear);
    left.append(el('h3', '', 'Цех'), input, line, bar, msg, flow); right.append(el('h3', '', 'Станки'), palette, el('h3', '', 'То же на Python'), code, el('p', 'lab-note', `Три звезды — за цепочку не длиннее ${lv.par} станков. Параметр станка меняется кнопками − и +.`));
    cols.append(left, right); host.append(task, cols); showInput(); drawChain();
    if (api.debugHost) window.labSet = c => { chain.length = 0; chain.push(...c.map(x => x.slice())); drawChain(); };
    return () => clearTimeout(timer);
  }
  LAB.register({id: 'factory', bg: 'bg_factory', hero: 'host_engineer', title: 'Завод алгоритмов', genre: 'конвейер данных', art: '🏭', color: '#ff9a3a', unit: 'Заказ', minutes: 40,
    about: 'Числа едут по ленте через станки: фильтры, преобразования, сортировку, итоги. Собери цепочку, которая выполнит заказ, — и увидишь тот же алгоритм на Python.',
    levels: grade => grade <= 7 ? LEVELS.slice(0, 11) : LEVELS, mount, check, solve: lv => lv.ref.map(c => c.slice()), OPS, run});
})();
