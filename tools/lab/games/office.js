// «Офис роботов»: программа на мини-ассемблере (в духе Human Resource Machine). Робот берёт числа из входной ленты,
// раскладывает по ячейкам памяти, считает и отдаёт результат в выходную ленту. Учит циклам, условиям и памяти «изнутри».
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  // Команды: [код, название, нужна ли ячейка, нужна ли строка перехода].
  const CMD = {in: ['ВЗЯТЬ', false, false], out: ['ОТДАТЬ', false, false], to: ['ПОЛОЖИТЬ в', true, false], from: ['ВЗЯТЬ из', true, false], add: ['ПРИБАВИТЬ', true, false], sub: ['ВЫЧЕСТЬ', true, false],
    inc: ['+1 в', true, false], dec: ['−1 в', true, false], jmp: ['ПЕРЕЙТИ к', false, true], jz: ['ЕСЛИ НОЛЬ к', false, true], jn: ['ЕСЛИ МИНУС к', false, true]};
  const PY = {in: 'x = input()', out: 'print(x)', to: 'mem[{c}] = x', from: 'x = mem[{c}]', add: 'x = x + mem[{c}]', sub: 'x = x - mem[{c}]', inc: 'mem[{c}] += 1; x = mem[{c}]', dec: 'mem[{c}] -= 1; x = mem[{c}]', jmp: 'goto {j}', jz: 'if x == 0: goto {j}', jn: 'if x < 0: goto {j}'};
  // Выполнение: возвращает выход, число шагов и ошибку (если робот сделал что-то невозможное).
  function run(prog, inbox, mem0, limit = 3000, trace) {
    const mem = mem0.slice(), out = [], inp = inbox.slice(); let x = null, pc = 0, steps = 0;
    while (pc < prog.length) {
      if (++steps > limit) return {out, steps, error: 'Программа работает слишком долго — похоже, бесконечный цикл.'};
      const [op, arg] = prog[pc]; let next = pc + 1;
      const need = v => { if (v === null || v === undefined) throw new Error(op === 'out' || op === 'to' || op === 'add' || op === 'sub' || op === 'jz' || op === 'jn' ? 'В руках у робота ничего нет.' : 'В этой ячейке пусто.'); return v; };
      try {
        if (op === 'in') { if (!inp.length) { trace && trace({pc, x, mem: mem.slice(), out: out.slice(), inp: inp.slice(), end: true}); return {out, steps}; } x = inp.shift(); }
        else if (op === 'out') { out.push(need(x)); x = null; }
        else if (op === 'to') { mem[arg] = need(x); }
        else if (op === 'from') { x = need(mem[arg]); }
        else if (op === 'add') { x = need(x) + need(mem[arg]); }
        else if (op === 'sub') { x = need(x) - need(mem[arg]); }
        else if (op === 'inc') { mem[arg] = need(mem[arg]) + 1; x = mem[arg]; }
        else if (op === 'dec') { mem[arg] = need(mem[arg]) - 1; x = mem[arg]; }
        else if (op === 'jmp') next = arg;
        else if (op === 'jz') { if (need(x) === 0) next = arg; }
        else if (op === 'jn') { if (need(x) < 0) next = arg; }
      } catch (e) { return {out, steps, error: `Строка ${pc + 1}: ${e.message}`}; }
      trace && trace({pc, x, mem: mem.slice(), out: out.slice(), inp: inp.slice()});
      pc = next;
    }
    return {out, steps};
  }
  const size = prog => prog.length;
  // Уровень: задание, ячеек памяти и их начальные значения, доступные команды, наборы входов (первый — показывается), правило для выхода, образцовая программа.
  const L = (title, brief, cmds, mem, tests, rule, ref) => ({title, brief, cmds, mem, tests, rule, ref, par: ref.length});
  const pairs = f => inp => { const o = []; for (let i = 0; i + 1 < inp.length; i += 2) o.push(...[].concat(f(inp[i], inp[i + 1]))); return o; };
  const LEVELS = [
    L('Почта', 'Перенеси все числа с входной ленты на выходную, в том же порядке.', ['in', 'out', 'jmp'], [], [[3, 7, 1, 9], [5, 2], [8, 8, 0, 4, 6]], inp => inp.slice(), [['in'], ['out'], ['jmp', 0]]),
    L('Удвоитель', 'Каждое число нужно удвоить. Подсказка: положи число в ячейку и прибавь к самому себе.', ['in', 'out', 'jmp', 'to', 'add'], [null], [[3, 7, 1, -2], [5, 0], [8, 4, 6]], inp => inp.map(v => v * 2), [['in'], ['to', 0], ['add', 0], ['out'], ['jmp', 0]]),
    L('Сумма пар', 'Числа приходят парами. Отдай сумму каждой пары.', ['in', 'out', 'jmp', 'to', 'add'], [null], [[3, 7, 1, 9], [5, 2, -4, 4], [8, 8, 0, 6]], pairs((a, b) => a + b), [['in'], ['to', 0], ['in'], ['add', 0], ['out'], ['jmp', 0]]),
    L('Без нулей', 'Пропусти нули: на выход идут только ненулевые числа.', ['in', 'out', 'jmp', 'jz'], [], [[3, 0, 1, 0, 0, 9], [0, 2], [8, 0, 4, 6, 0]], inp => inp.filter(v => v), [['in'], ['jz', 0], ['out'], ['jmp', 0]]),
    L('Разность', 'Числа приходят парами a, b. Отдай b − a, а затем a − b.', ['in', 'out', 'jmp', 'to', 'from', 'sub'], [null, null], [[3, 7, 9, 1], [5, 5, -2, 4], [8, 2]], pairs((a, b) => [b - a, a - b]), [['in'], ['to', 0], ['in'], ['to', 1], ['sub', 0], ['out'], ['from', 0], ['sub', 1], ['out'], ['jmp', 0]]),
    L('Больший из двух', 'Для каждой пары отдай большее число (если равны — любое из них).', ['in', 'out', 'jmp', 'to', 'from', 'sub', 'jn'], [null, null], [[3, 7, 9, 1], [5, 5, -2, 4], [8, 2, 0, 6]], pairs((a, b) => Math.max(a, b)), [['in'], ['to', 0], ['in'], ['to', 1], ['sub', 0], ['jn', 8], ['from', 1], ['jmp', 9], ['from', 0], ['out'], ['jmp', 0]]),
    L('Обратный отсчёт', 'Для каждого числа n отдай n, n−1, … до нуля включительно. Числа положительные.', ['in', 'out', 'jmp', 'to', 'from', 'dec', 'jz'], [null], [[3, 1], [5], [2, 4]], inp => inp.flatMap(n => Array.from({length: n + 1}, (_, k) => n - k)), [['in'], ['to', 0], ['out'], ['from', 0], ['jz', 0], ['dec', 0], ['jmp', 2]]),
    L('Умножь на 8', 'Каждое число умножь на 8. Сложение удваивает: удвой три раза.', ['in', 'out', 'jmp', 'to', 'add'], [null], [[3, 1, -2], [5, 0], [7, 4]], inp => inp.map(v => v * 8), [['in'], ['to', 0], ['add', 0], ['to', 0], ['add', 0], ['to', 0], ['add', 0], ['out'], ['jmp', 0]]),
    L('Модуль числа', 'Отдай модуль каждого числа: отрицательные становятся положительными. В ячейке 0 лежит ноль.', ['in', 'out', 'jmp', 'to', 'from', 'sub', 'jn'], [0, null], [[3, -7, 0, -1], [-5, 2], [8, -8]], inp => inp.map(Math.abs), [['in'], ['jn', 3], ['jmp', 6], ['to', 1], ['from', 0], ['sub', 1], ['out'], ['jmp', 0]]),
    L('Сумма до нуля', 'Числа идут группами, каждая группа заканчивается нулём. Отдай сумму каждой группы. В ячейке 0 лежит ноль.', ['in', 'out', 'jmp', 'to', 'from', 'add', 'jz'], [0, null], [[3, 4, 0, 1, 0], [5, 5, 5, 0], [0, 7, -2, 0]], inp => { const o = []; let s = 0; for (const v of inp) { if (v === 0) { o.push(s); s = 0; } else s += v; } return o; }, [['from', 0], ['to', 1], ['in'], ['jz', 7], ['add', 1], ['to', 1], ['jmp', 2], ['from', 1], ['out'], ['jmp', 0]]),
    L('Умножение', 'Числа приходят парами a, b (оба положительные). Отдай произведение a × b. В ячейке 2 лежит ноль.', ['in', 'out', 'jmp', 'to', 'from', 'add', 'dec', 'jz'], [null, null, 0], [[3, 4, 2, 5], [6, 1], [1, 7, 3, 3]], pairs((a, b) => a * b), [['in'], ['to', 0], ['in'], ['to', 1], ['from', 2], ['to', 3], ['from', 3], ['add', 0], ['to', 3], ['dec', 1], ['jz', 12], ['jmp', 6], ['from', 3], ['out'], ['jmp', 0]]),
    L('Счётчик', 'Для каждого числа n отдай, сколько раз из него можно вычесть 3, прежде чем оно станет меньше 3 (то есть n // 3). Числа неотрицательные. В ячейке 0 лежит 3, в ячейке 1 — ноль.', ['in', 'out', 'jmp', 'to', 'from', 'sub', 'inc', 'jn'], [3, 0, null, null], [[7, 2, 9], [0, 12], [5, 3, 1]], inp => inp.map(n => Math.floor(n / 3)), [['in'], ['to', 2], ['from', 1], ['to', 3], ['from', 2], ['sub', 0], ['jn', 10], ['to', 2], ['inc', 3], ['jmp', 4], ['from', 3], ['out'], ['jmp', 0]]),
  ];
  // Ячеек памяти на уровне: столько, сколько нужно образцу и условию, но не меньше четырёх на поздних уровнях.
  for (const lv of LEVELS) { const used = Math.max(lv.mem.length, ...lv.ref.filter(c => CMD[c[0]][1]).map(c => c[1] + 1), 0); lv.slots = Math.max(used, lv.mem.length); while (lv.mem.length < lv.slots) lv.mem.push(null); }
  const valid = (prog, lv) => Array.isArray(prog) && prog.length <= 40 && prog.every(c => Array.isArray(c) && lv.cmds.includes(c[0]) && (!CMD[c[0]][1] || (Number.isInteger(c[1]) && c[1] >= 0 && c[1] < lv.slots)) && (!CMD[c[0]][2] || (Number.isInteger(c[1]) && c[1] >= 0 && c[1] <= prog.length)));
  function check(lv, prog) {
    if (!valid(prog, lv) || !prog.length) return {ok: false, msg: 'Программа составлена неверно.'};
    for (const [k, t] of lv.tests.entries()) { const r = run(prog, t, lv.mem), want = lv.rule(t);
      if (r.error) return {ok: false, test: k, msg: r.error}; if (r.out.length !== want.length || r.out.some((v, i) => v !== want[i])) return {ok: false, test: k, msg: k ? 'На первой ленте верно, но на другой — нет. Программа должна работать для любых чисел.' : `Нужно было отдать ${want.join(', ')}, а робот отдал ${r.out.join(', ') || 'ничего'}.`}; }
    const n = size(prog); return {ok: true, stars: n <= lv.par ? 3 : n <= lv.par + 2 ? 2 : 1, msg: `Команд в программе: ${n}, образец — ${lv.par}.`};
  }
  const python = prog => prog.map(([op, a], i) => `${String(i + 1).padStart(2)}  ${PY[op].replace(/\{c\}/g, a).replace('{j}', 'строка ' + (a + 1))}`).join('\n');

  function mount(host, lv, api) {
    const {el, button} = api, prog = [], v = document.getElementById('assignmentData')?.dataset.art || '', task = el('div', 'lab-task'); let test = 0, timer = 0, sel = -1;
    task.append(el('h2', '', lv.title), el('p', '', lv.brief));
    const office = el('div', 'of-office'), list = el('ol', 'of-prog'), code = el('pre', 'lab-code'), msg = el('p', 'lab-msg'), pal = el('div', 'of-pal');
    const pic = n => { const i = new Image(); i.alt = ''; i.src = `art/office_${n}.webp?v=1`; i.addEventListener('error', () => i.remove()); return i; };
    function scene(st) {
      const s = st || {pc: -1, x: null, mem: lv.mem, out: [], inp: lv.tests[test]};
      const col = (cls, title, vals) => { const c = el('div', 'of-col ' + cls); c.append(el('small', '', title)); for (const v of vals) c.append(el('b', '', String(v))); return c; };
      const memBox = el('div', 'of-mem'); s.mem.forEach((v, i) => { const m = el('div', 'of-cell'); m.append(el('small', '', String(i)), el('b', '', v === null || v === undefined ? '' : String(v))); memBox.append(m); });
      const bot = el('div', 'of-bot'); bot.append(pic(s.x === null ? 'robot' : 'robot_box')); if (s.x !== null) bot.append(el('b', 'of-hand', String(s.x)));
      const inB = el('div', 'of-belt'); inB.append(pic('inbox'), col('in', 'вход', s.inp)); const outB = el('div', 'of-belt'); outB.append(pic('outbox'), col('out', 'выход', s.out));
      const mid = el('div', 'of-mid'); mid.append(bot, el('p', 'lab-note', lv.slots ? 'Ячейки памяти' : 'Ячеек памяти на этом уровне нет'), memBox);
      office.replaceChildren(inB, mid, outB); [...list.children].forEach((li, i) => li.classList.toggle('now', i === s.pc));
    }
    function drawProg() {
      list.replaceChildren(); prog.forEach(([op, a], i) => { const li = el('li', i === sel ? 'sel' : ''), [name, needCell, needJump] = CMD[op]; li.append(el('b', '', name));
        if (needCell) { const s = el('select'); s.setAttribute('aria-label', 'Ячейка'); for (let k = 0; k < lv.slots; k++) { const o = el('option', '', String(k)); o.value = k; s.append(o); } s.value = a; s.addEventListener('change', () => { prog[i][1] = Number(s.value); drawProg(); }); li.append(s); }
        if (needJump) { const s = el('select'); s.setAttribute('aria-label', 'Строка'); for (let k = 0; k <= prog.length; k++) { const o = el('option', '', k < prog.length ? 'строке ' + (k + 1) : 'концу'); o.value = k; s.append(o); } s.value = a; s.addEventListener('change', () => { prog[i][1] = Number(s.value); drawProg(); }); li.append(s); }
        const up = button('↑', 'lab-small of-mini', () => { if (i) { [prog[i - 1], prog[i]] = [prog[i], prog[i - 1]]; drawProg(); } }), x = button('×', 'lab-small of-mini', () => { prog.splice(i, 1); for (const c of prog) if (CMD[c[0]][2] && c[1] > i) c[1]--; drawProg(); });
        li.append(up, x); list.append(li); });
      code.textContent = python(prog) || '# программа пуста'; msg.textContent = ''; msg.className = 'lab-msg'; scene();
    }
    for (const op of lv.cmds) { const b = button(CMD[op][0], 'lab-small of-cmd', () => { if (prog.length >= 40) return; prog.push(CMD[op][1] ? [op, 0] : CMD[op][2] ? [op, 0] : [op]); drawProg(); }); b.dataset.op = op; pal.append(b); }
    const play = (fast) => { clearInterval(timer); const frames = [], r = run(prog.map(c => c.slice()), lv.tests[test], lv.mem, 3000, f => frames.push(f)); let k = 0;
      const done = () => { const c = check(lv, prog.map(c => c.slice())); if (c.ok) { msg.textContent = 'Все ленты обработаны верно! ' + c.msg; msg.className = 'lab-msg good'; api.finish(c.stars, c.msg); } else { msg.textContent = c.msg; msg.className = 'lab-msg bad'; if (c.test > 0 && c.test !== test) { test = c.test; msg.textContent += ' Смотри новую ленту.'; scene(); } } };
      if (fast) { if (frames.length) scene(frames[frames.length - 1]); done(); return; }
      timer = setInterval(() => { if (k >= frames.length) { clearInterval(timer); done(); return; } scene(frames[k++]); }, Math.max(60, Math.min(380, 9000 / Math.max(1, frames.length)))); };
    const go = button('▶ Запустить', 'lab-main', () => play(false)); go.dataset.act = 'run';
    const fastBtn = button('⏩ Сразу итог', 'lab-small', () => play(true)); fastBtn.dataset.act = 'fast'; const clear = button('Очистить', 'lab-small', () => { prog.length = 0; drawProg(); });
    const left = el('div', 'lab-panel'), right = el('div', 'lab-panel'), cols = el('div', 'lab-cols'), bar = el('div', 'lab-bar'); bar.style.justifyContent = 'flex-start'; bar.append(go, fastBtn, clear);
    left.append(el('h3', '', 'Офис'), office, bar, msg); right.append(el('h3', '', 'Команды'), pal, el('h3', '', 'Программа робота'), list, el('h3', '', 'То же на Python-подобном языке'), code, el('p', 'lab-note', `Три звезды — за программу не длиннее ${lv.par} команд. Переходы «к строке» делают циклы и условия.`));
    cols.append(left, right); host.append(task, cols); drawProg(); if (api.debugHost) window.labSet = p => { prog.length = 0; prog.push(...p.map(c => c.slice())); drawProg(); };
    return () => clearInterval(timer);
  }
  LAB.register({id: 'office', bg: 'bg_office', title: 'Офис роботов', genre: 'программа на ассемблере', art: '🏢', color: '#ff8a5c', unit: 'Задание', minutes: 45,
    about: 'Робот-клерк берёт числа с ленты, раскладывает по ячейкам памяти, считает и отдаёт результат. Собери ему программу из команд с переходами — так устроены программы внутри процессора.',
    levels: grade => grade <= 7 ? LEVELS.slice(0, 8) : LEVELS, mount, check, solve: lv => lv.ref.map(c => c.slice()), run, LEVELS});
})();
