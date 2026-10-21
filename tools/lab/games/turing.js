// «Машина Тьюринга»: таблица правил «состояние × символ → что записать, куда сдвинуть головку, в какое состояние перейти».
// Головка бежит по ленте; каждая задача проверяется на нескольких лентах с крайними случаями (11 класс §5 «Основные сведения об алгоритмах», 10 класс §12).
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1)), pick = (r, a) => a[Math.floor(r() * a.length)], word = (r, a, b, abc = '01') => Array.from({length: ri(r, a, b)}, () => pick(r, abc)).join('');
  const dyck = (r, n) => { let s = '', o = 0, c = 0; while (c < n) if (o < n && (o === c || r() < 0.5)) { s += '('; o++; } else { s += ')'; c++; } return s; };
  // Пустая клетка ленты — «_», на экране — λ. Состояния q1…q9, q0 — остановка; в задачах-вопросах машина останавливается в «Да» или «Нет».
  const BL = '_', MAXQ = 9, LIMIT = 2000, MOVE = {L: 'Л', R: 'П', N: 'Н'};
  const sym = c => c === BL ? 'λ' : c, show = w => w.replace(/_/g, 'λ'), qname = n => n === 'Y' ? 'Да' : n === 'N' ? 'Нет' : 'q' + n, cols = lv => [...lv.abc, BL];
  // Образцы записаны строками по состояниям: «символ:запись сдвиг переход», например «0:1R1» — увидев 0, записать 1, шаг вправо, остаться в q1.
  const parseRef = rows => { const prog = {}; rows.forEach((row, i) => { for (const t of row.split(' ')) { const nx = t.slice(4); prog[(i + 1) + '|' + t[0]] = [t[2], t[3], /^\d+$/.test(nx) ? Number(nx) : nx]; } }); return prog; };
  /* ---------- машина: лента — Map «номер клетки → символ», головка, состояние, счётчик шагов ---------- */
  const init = (lv, input, limit = LIMIT) => { const tape = new Map(); [...input].forEach((c, i) => tape.set(i, c)); return {tape, pos: lv.start === 'end' && input.length ? input.length - 1 : 0, q: 1, steps: 0, halt: null, error: null, limit}; };
  const done = m => m.halt !== null || !!m.error;
  function step(prog, m) {
    if (done(m)) return m; if (m.steps >= m.limit) { m.error = 'loop'; return m; }
    const s = m.tape.get(m.pos) || BL, r = prog[m.q + '|' + s]; if (!r) { m.error = 'none'; m.need = [m.q, s]; return m; }
    if (r[0] === BL) m.tape.delete(m.pos); else m.tape.set(m.pos, r[0]); m.pos += r[1] === 'R' ? 1 : r[1] === 'L' ? -1 : 0; m.steps++;
    if (r[2] === 0 || r[2] === 'Y' || r[2] === 'N') m.halt = r[2]; else m.q = r[2]; return m;
  }
  const read = tape => { const ks = [...tape.keys()]; if (!ks.length) return ''; let w = ''; for (let i = Math.min(...ks), hi = Math.max(...ks); i <= hi; i++) w += tape.get(i) || BL; return w; };
  function run(lv, prog, input, limit) { const m = init(lv, input, limit); while (!done(m)) step(prog, m); return Object.assign(m, {word: read(m.tape)}); }
  // Размер программы: заполненные клетки таблицы и задействованные состояния (q1 и все, что встречаются в строках и переходах).
  const size = prog => { const qs = new Set([1]); let rules = 0; for (const [k, r] of Object.entries(prog)) { rules++; qs.add(Number(k.split('|')[0])); if (typeof r[2] === 'number' && r[2] > 0) qs.add(r[2]); } return {states: qs.size, rules}; };
  const valid = (lv, prog) => !!prog && typeof prog === 'object' && !Array.isArray(prog) && Object.entries(prog).every(([k, r]) => { const [q, s, extra] = k.split('|');
    return extra === undefined && /^[1-9]$/.test(q) && cols(lv).includes(s) && Array.isArray(r) && r.length === 3 && cols(lv).includes(r[0]) && ['L', 'R', 'N'].includes(r[1]) && (Number.isInteger(r[2]) && r[2] >= 0 && r[2] <= MAXQ || !!lv.ask && (r[2] === 'Y' || r[2] === 'N')); });
  /* ---------- задачи ---------- */
  // abc — символы ленты (кроме пустого), edge — крайние случаи, gen — случайные слова, rule — что должно получиться, ref — образец, по нему норма на три звезды.
  const L = o => o;
  const LEVELS = [
    L({title: 'Ещё одна палочка', abc: '1', brief: 'На ленте число в унарной системе — n палочек «1». Прибавь к нему единицу: допиши ещё одну палочку. Головка стоит на первой палочке, а если число равно нулю — на пустой клетке.',
      edge: ['', '1', '111'], gen: r => '1'.repeat(ri(r, 2, 9)), rule: w => w + '1', ref: ['1:1R1 _:1N0']}),
    L({title: 'Инверсия', abc: '01', brief: 'Замени в двоичном слове каждый 0 на 1, а каждую 1 — на 0: 1011 → 0100. Головка стоит на первом символе.',
      edge: ['', '0', '1', '111000'], gen: r => word(r, 3, 8), rule: w => w.replace(/./g, c => c === '0' ? '1' : '0'), ref: ['0:1R1 1:0R1 _:_N0']}),
    L({title: 'Стереть слово', abc: 'ab', start: 'end', brief: 'Сотри слово из букв a и b — на ленте не должно остаться ни одного символа. Внимание: головка стоит на последней букве слова.',
      edge: ['', 'a', 'b', 'abba'], gen: r => word(r, 3, 8, 'ab'), rule: () => '', ref: ['a:_L1 b:_L1 _:_N0']}),
    L({title: 'Сложение палочек', abc: '1+', brief: 'На ленте два числа в унарной системе через плюс: 11+111 — это 2 + 3. Получи сумму палочками: 11111. Числа могут быть и нулями. Головка стоит на первом символе.',
      edge: ['+', '1+1', '+11', '111+'], gen: r => '1'.repeat(ri(r, 1, 5)) + '+' + '1'.repeat(ri(r, 1, 5)), rule: w => w.replace('+', ''), ref: ['1:_R2 +:_N0', '1:1R2 +:1N0']}),
    L({title: 'Чётность единиц', abc: '01', ask: true, brief: 'Чётное ли число единиц в двоичном слове? Машина должна остановиться в состоянии «Да» (чётное) или «Нет» (нечётное); ноль единиц — чётное число. Подсказка: состояние может «помнить» чётность.',
      edge: ['', '0', '1', '11', '1000'], gen: r => word(r, 4, 9), rule: w => w.split('1').length % 2 === 1, ref: ['0:0R1 1:1R2 _:_NY', '0:0R2 1:1R1 _:_NN']}),
    L({title: 'Двоичное +1', abc: '01', num: true, brief: 'Прибавь 1 к двоичному числу: 1011 → 1100, 111 → 1000. Головка стоит на старшем (первом) разряде. Подсказка: дойди до конца числа и прибавляй справа, не забывая о переносе.',
      edge: ['0', '1', '111', '1011'], gen: r => '1' + word(r, 2, 7), rule: w => (parseInt(w, 2) + 1).toString(2), ref: ['0:0R1 1:1R1 _:_L2', '0:1N0 1:0L2 _:1N0']}),
    L({title: 'Двоичное −1', abc: '01', num: true, brief: 'Вычти 1 из двоичного числа (оно больше нуля): 1100 → 1011, 1000 → 0111. Ведущие нули в ответе не важны. Головка стоит на старшем разряде.',
      edge: ['1', '10', '101', '1000'], gen: r => '1' + word(r, 2, 7), rule: w => (parseInt(w, 2) - 1).toString(2), ref: ['0:0R1 1:1R1 _:_L2', '0:1L2 1:0N0']}),
    L({title: 'Скобки', abc: '()x', ask: true, brief: 'Правильно ли расставлены круглые скобки? У каждой открывающей должна быть своя закрывающая правее неё: (()()) — да, ())( — нет. Найденную пару можно зачеркнуть символом x. Ответ — «Да» или «Нет».',
      edge: ['', '()', ')(', '(()', '())(', '(())()'], gen: r => { const w = dyck(r, ri(r, 2, 4)), i = ri(r, 0, w.length - 1); return r() < 0.5 ? w : w.slice(0, i) + (w[i] === '(' ? ')' : '(') + w.slice(i + 1); }, rule: w => { let d = 0; for (const c of w) { d += c === '(' ? 1 : -1; if (d < 0) return false; } return d === 0; },
      ref: ['(:(R1 x:xR1 ):xL2 _:_L3', 'x:xL2 (:xR1 _:_NN', 'x:xL3 (:(NN _:_NY']}),
    L({title: 'Сортировка', abc: 'ab', brief: 'Переставь буквы так, чтобы все a стояли перед всеми b: baab → aabb. Подсказка: найди пару «ba», поменяй буквы местами и вернись в начало слова.',
      edge: ['', 'a', 'ba', 'abab', 'bbaa'], gen: r => word(r, 4, 7, 'ab'), rule: w => [...w].sort().join(''), ref: ['a:aR1 b:bR2 _:_N0', 'b:bR2 a:bL3 _:_N0', 'b:aL4', 'a:aL4 b:bL4 _:_R1']}),
    L({title: 'Удвоение палочек', abc: '1x', brief: 'Удвой число в унарной системе: 111 → 111111. Помечай обработанные палочки и новые символом x, а в конце преврати все x в палочки. Не забудь про ноль — пустую ленту.',
      edge: ['', '1', '11'], gen: r => '1'.repeat(ri(r, 3, 6)), rule: w => w + w, ref: ['1:xR2 _:_N0', '1:1R2 x:xR2 _:xL3', 'x:xL3 1:1L4 _:_R5', '1:1L4 x:xR1', 'x:1R5 _:_N0']}),
    L({title: 'Палиндром', abc: 'ab', ask: true, more: 2, brief: 'Читается ли слово из a и b одинаково слева направо и справа налево? abba и aba — палиндромы, abaa — нет. Буквы можно стирать. Ответ — «Да» или «Нет».',
      edge: ['', 'a', 'ab', 'baa', 'abba', 'abaa', 'babab'], gen: r => { const h = word(r, 1, 3, 'ab'); return r() < 0.5 ? h + (r() < 0.5 ? pick(r, 'ab') : '') + [...h].reverse().join('') : word(r, 3, 7, 'ab'); }, rule: w => w === [...w].reverse().join(''),
      ref: ['a:_R2 b:_R4 _:_NY', 'a:aR2 b:bR2 _:_L3', 'a:_L6 b:bNN _:_NY', 'a:aR4 b:bR4 _:_L5', 'b:_L6 a:aNN _:_NY', 'a:aL6 b:bL6 _:_R1']}),
    L({title: 'Копия слова', abc: 'ab*AB', brief: 'Сделай копию слова из a и b: справа через звёздочку должна появиться такая же копия: ab → ab*ab. Букву, которую сейчас копируешь, можно пометить большой A или B.',
      edge: ['', 'a', 'ab', 'bba'], gen: r => word(r, 3, 5, 'ab'), rule: w => w + '*' + w, ref: ['a:aR1 b:bR1 _:*L2', 'a:aL2 b:bL2 *:*L2 A:aR3 B:bR3 _:_R3', 'a:AR4 b:BR5 *:*N0', 'a:aR4 b:bR4 *:*R4 _:aL2', 'a:aR5 b:bR5 *:*R5 _:bL2']}),
  ];
  // Ленты задачи: крайние случаи и несколько случайных слов (зерно постоянное — у всех учеников одни и те же ленты).
  for (const [i, lv] of LEVELS.entries()) { const r = rng(4049 + i * 97), list = lv.edge.slice(); for (let k = 0; list.length < lv.edge.length + (lv.more || 3) && k < 300; k++) { const w = lv.gen(r); if (!list.includes(w)) list.push(w); }
    lv.tapes = list.map(input => ({input, want: lv.rule(input)})); lv.refProg = parseRef(lv.ref); lv.par = size(lv.refProg); }
  // Почему лента не прошла (пустая строка — прошла).
  function verdict(lv, want, r) {
    if (r.error === 'loop') return `машина сделала ${r.limit} шагов и не остановилась — похоже, она зациклилась. Нужен переход в ${lv.ask ? '«Да» или «Нет»' : 'q0 (стоп)'}.`;
    if (r.error === 'none') return `нет команды для состояния q${r.need[0]} и символа «${sym(r.need[1])}» — машина не знает, что делать. Заполни эту клетку таблицы.`;
    if (lv.ask) return r.halt === 0 ? 'машина остановилась в q0, а должна ответить: перейти в «Да» или «Нет».' : (r.halt === 'Y') === want ? '' : `машина ответила «${qname(r.halt)}», а правильный ответ — «${want ? 'Да' : 'Нет'}».`;
    if (lv.num ? /^[01]+$/.test(r.word) && parseInt(r.word, 2) === parseInt(want, 2) : r.word === want) return '';
    return `${r.word ? `на ленте «${show(r.word)}»` : 'лента пуста'}, ${want ? `а нужно «${want}»` : 'а лента должна стать пустой'}${lv.num ? ' (ведущие нули не важны)' : ''}.`;
  }
  const tapeName = w => w ? `«${show(w)}»` : 'пустая';
  function check(lv, prog) {
    if (!valid(lv, prog)) return {ok: false, msg: 'Таблица правил составлена неверно.'};
    const sz = size(prog); if (!sz.rules) return {ok: false, msg: 'Таблица пуста: заполни клетки — что записать, куда сдвинуть головку и в какое состояние перейти.'};
    const rows = lv.tapes.map(t => { const r = run(lv, prog, t.input); return {input: t.input, want: t.want, got: lv.ask ? r.halt : r.word, error: r.error, steps: r.steps, why: verdict(lv, t.want, r)}; });
    const k = rows.findIndex(x => x.why); if (k >= 0) return {ok: false, tape: k, rows, msg: `Лента ${k + 1} (${tapeName(rows[k].input)}): ${rows[k].why}`};
    const {states: S, rules: R} = lv.par, stars = sz.states <= S && sz.rules <= R ? 3 : sz.states <= S + 1 && sz.rules <= R + 2 ? 2 : 1;
    return {ok: true, stars, rows, size: sz, msg: `Состояний: ${sz.states}, команд: ${sz.rules} (у образца ${S} и ${R}).`};
  }
  const solve = lv => JSON.parse(JSON.stringify(lv.refProg));
  /* ---------- экран ---------- */
  function mount(host, lv, api) {
    const {el, button} = api, C = cols(lv), W = 15, prog = {}, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'); let nq = lv.par.states, sel = null, slot = 0, ti = 0, m = null, view = null, rows = null, timer = 0, cells = {};
    task.append(el('h2', '', lv.title), el('p', '', lv.brief), el('p', 'lab-note', `В клетке таблицы — команда: что записать, куда сдвинуть головку (Л — влево, П — вправо, Н — на месте) и в какое состояние перейти. λ — пустая клетка ленты. Машина начинает в q1 и ${lv.ask ? 'отвечает, перейдя в «Да» или «Нет»' : 'останавливается, перейдя в q0'}; программа проверяется на всех лентах.`));
    const over = () => { const o = host.parentNode && host.parentNode.querySelector('.lab-over'); return !!o && !o.hidden; };
    // Лента: окно из W клеток вокруг головки; головка — ярлык с состоянием, плавно едет по клеткам.
    const strip = el('div', 'tm-strip'), head = el('div', 'tm-head'), tcell = Array.from({length: W}, () => el('div', 'tm-cell')), status = el('p', 'tm-status'); strip.append(...tcell, head);
    function drawTape() {
      const mm = m || init(lv, lv.tapes[ti].input), pos = mm.pos, ks = [...mm.tape.keys()];
      if (view === null) { const lo = Math.min(pos, ...ks), hi = Math.max(pos, ...ks); view = hi - lo + 1 <= W - 2 ? lo - Math.floor((W - (hi - lo + 1)) / 2) : pos - 2; }
      if (pos < view + 1 || pos > view + W - 2) view = pos - Math.floor(W / 2);
      tcell.forEach((c, i) => { const s = mm.tape.get(view + i) || BL; c.textContent = sym(s); c.className = 'tm-cell' + (s === BL ? ' blank' : '') + (view + i === pos ? ' here' : ''); });
      head.textContent = mm.halt !== null ? qname(mm.halt) : 'q' + mm.q; strip.style.setProperty('--k', String(pos - view));
      const s = mm.tape.get(pos) || BL, now = m && !done(m) ? m.q + '|' + s : null;
      status.textContent = `Лента ${ti + 1} · шаг ${mm.steps} · ` + (mm.error === 'loop' ? 'машина зациклилась' : mm.error ? `нет команды для q${mm.q} и «${sym(s)}»` : mm.halt !== null ? `остановка: ${qname(mm.halt)}` : `состояние q${mm.q}, под головкой «${sym(s)}»`);
      for (const [k, b] of Object.entries(cells)) b.classList.toggle('now', k === now);
    }
    // Ленты для проверки: вход, что нужно получить и что получилось после проверки.
    const tapes = el('table', 'lab-table tm-tapes'), want = t => lv.ask ? (t.want ? 'Да' : 'Нет') : t.want ? show(t.want) : '(пусто)';
    const got = r => r.error === 'loop' ? 'зациклилась' : r.error ? 'нет команды' : lv.ask ? qname(r.got) : r.got ? show(r.got) : '(пусто)';
    function drawTapes() {
      const h = el('tr'); for (const x of ['Лента', 'Вход', 'Нужно', 'Итог']) h.append(el('th', '', x)); tapes.replaceChildren(h);
      lv.tapes.forEach((t, i) => { const r = rows && rows[i], tr = el('tr', r ? (r.why ? 'miss' : 'hit') : ''), b = button(String(i + 1), 'lab-small tm-pick' + (i === ti ? ' on' : ''), () => { ti = i; reset(); }), td = el('td'); b.dataset.tape = String(i); b.setAttribute('aria-label', 'Показать ленту ' + (i + 1)); td.append(b);
        tr.append(td, el('td', 'tm-w', t.input ? show(t.input) : '(пусто)'), el('td', 'tm-w', want(t)), el('td', 'tm-w', r ? (r.why ? '✗ ' : '✓ ') + got(r) : '…')); tapes.append(tr); });
    }
    // Таблица правил: строки — состояния, столбцы — символы; щелчок или стрелки выбирают клетку, команда собирается кнопками или клавишами.
    const table = el('table', 'lab-table tm-rules'), edit = el('div', 'tm-edit'), info = el('p', 'tm-size');
    function drawTable(focus) {
      const h = el('tr'); h.append(el('th', '', '')); for (const s of C) h.append(el('th', '', sym(s))); table.replaceChildren(h); cells = {};
      for (let q = 1; q <= nq; q++) { const tr = el('tr'); tr.append(el('th', '', 'q' + q));
        for (const s of C) { const k = q + '|' + s, r = prog[k], b = button(r ? '' : '·', 'tm-rule' + (r ? '' : ' empty') + (k === sel ? ' sel' : ''), () => choose(k)), td = el('td'); b.dataset.cell = k;
          if (r) b.append(el('b', '', sym(r[0])), el('i', '', MOVE[r[1]]), el('span', '', qname(r[2]))); b.setAttribute('aria-label', `q${q}, символ ${sym(s)}: ` + (r ? `записать ${sym(r[0])}, сдвиг ${MOVE[r[1]]}, перейти в ${qname(r[2])}` : 'пусто')); td.append(b); tr.append(td); cells[k] = b; }
        table.append(tr); }
      const sz = size(prog); info.textContent = `Состояний: ${sz.states} · команд: ${sz.rules} · на три звезды — не больше ${lv.par.states} сост. и ${lv.par.rules} команд`; drawEdit(); drawTape();
      if (focus && sel && cells[sel]) cells[sel].focus();
    }
    const choose = (k, focus = true) => { if (k !== sel) slot = 0; sel = k; drawTable(focus); };
    const set = (i, v) => { if (!sel) return; const [q, s] = sel.split('|'), r = prog[sel] || [s, 'R', Number(q)]; r[i] = v; prog[sel] = r; changed(true); };
    const nexts = () => [...(lv.ask ? [] : [0]), ...Array.from({length: nq}, (_, i) => i + 1), ...(lv.ask ? ['Y', 'N'] : [])];
    function drawEdit() {
      if (!sel) { edit.replaceChildren(el('p', 'lab-note', 'Выбери клетку таблицы — щелчком или стрелками.')); return; }
      const [q, s] = sel.split('|'), r = prog[sel], row = (label, items) => { const d = el('div', 'tm-row'); d.append(el('span', '', label)); for (const [text, on, fn, key, val] of items) { const b = button(text, 'lab-small tm-opt' + (on ? ' on' : ''), fn); b.dataset[key] = String(val); d.append(b); } return d; };
      edit.replaceChildren(el('h3', '', `q${q}, под головкой «${sym(s)}»`), row('Записать', C.map(c => [sym(c), r && r[0] === c, () => set(0, c), 'w', c])),
        row('Сдвиг', [['← Л', r && r[1] === 'L', () => set(1, 'L'), 'm', 'L'], ['Н', r && r[1] === 'N', () => set(1, 'N'), 'm', 'N'], ['П →', r && r[1] === 'R', () => set(1, 'R'), 'm', 'R']]),
        row('Перейти', nexts().map(n => [n === 0 ? 'q0 стоп' : qname(n), r && r[2] === n, () => set(2, n), 'n', n])), button('Очистить клетку', 'lab-small', () => { delete prog[sel]; slot = 0; changed(true); }));
    }
    function changed(focus) { stop(); m = null; view = null; rows = null; msg.textContent = ''; msg.className = 'lab-msg'; drawTable(focus); drawTapes(); }
    // Запуск: головка бежит по выбранной ленте (не дольше 7 секунд, зацикливание — 4 секунды), затем программа проверяется на всех лентах.
    const speed = el('select'); speed.setAttribute('aria-label', 'Скорость'); for (const [t, v] of [['медленно', 420], ['обычно', 180], ['быстро', 50]]) { const o = el('option', '', t); o.value = String(v); speed.append(o); } speed.value = '180';
    const stop = () => { clearInterval(timer); timer = 0; go.disabled = false; };
    const reset = () => { stop(); m = null; view = null; msg.textContent = ''; msg.className = 'lab-msg'; drawTape(); drawTapes(); };
    const say = (text, good) => { msg.textContent = text; msg.className = 'lab-msg ' + (good ? 'good' : 'bad'); };
    function outcome() { const why = verdict(lv, lv.tapes[ti].want, Object.assign(m, {word: read(m.tape)})); say(`Лента ${ti + 1}: ` + (why || (lv.ask ? `ответ «${qname(m.halt)}» — верно.` : 'результат верный.')), !why); return !why; }
    function all() {
      const c = check(lv, prog); rows = c.rows || null; drawTapes();
      if (c.ok) { say(`Все ${c.rows.length} лент обработаны верно! ` + c.msg, true); api.finish(c.stars, c.msg); return; }
      say(c.msg, false); if (c.tape !== undefined && c.tape !== ti) { ti = c.tape; m = null; view = null; drawTape(); drawTapes(); msg.textContent += ' Эта лента теперь на экране — запусти машину и посмотри, что происходит.'; }
    }
    const empty = () => { if (Object.keys(prog).length) return false; say('Таблица пуста: выбери клетку и задай команду.', false); return true; };
    function play() {
      stop(); if (empty()) return; const input = lv.tapes[ti].input, dry = run(lv, prog, input), shown = dry.error === 'loop' ? 150 : Math.max(1, dry.steps), ticks = Math.min(shown, 250), per = Math.ceil(shown / ticks);
      m = init(lv, input); view = null; drawTape(); go.disabled = true; msg.textContent = ''; msg.className = 'lab-msg';
      timer = setInterval(() => { for (let i = 0; i < per && !done(m); i++) step(prog, m); if (!done(m) && m.steps >= shown) while (!done(m)) step(prog, m); drawTape();
        if (done(m)) { stop(); if (outcome()) all(); } }, Math.max(20, Math.min(Number(speed.value) || 180, (dry.error === 'loop' ? 4000 : 7000) / ticks)));
    }
    function stepOnce() { stop(); if (empty()) return; if (!m || done(m)) { const was = !!m; m = init(lv, lv.tapes[ti].input); view = null; if (was) { drawTape(); msg.textContent = ''; return; } } step(prog, m); drawTape(); if (done(m)) outcome(); }
    function fast() { stop(); if (empty()) return; m = init(lv, lv.tapes[ti].input); while (!done(m)) step(prog, m); view = null; drawTape(); all(); }
    const go = button('▶ Запустить (Enter)', 'lab-main', play), stepBtn = button('Шаг', 'lab-small', stepOnce), fastBtn = button('⏩ Сразу итог', 'lab-small', fast); go.dataset.act = 'run'; stepBtn.dataset.act = 'step'; fastBtn.dataset.act = 'fast';
    const addQ = button('+ состояние', 'lab-small', () => { if (nq < MAXQ) { nq++; changed(); } }), delQ = button('− состояние', 'lab-small', () => {
      if (nq <= 1) return; if (Object.entries(prog).some(([k, r]) => k.startsWith(nq + '|') || r[2] === nq)) { say(`Сначала очисти строку q${nq} и убери переходы в неё.`, false); return; } nq--; if (sel && Number(sel.split('|')[0]) > nq) sel = null; changed(); });
    addQ.dataset.act = 'addq'; delQ.dataset.act = 'delq';
    // Клавиатура: стрелки — выбор клетки, три клавиши подряд — запись, сдвиг и переход (например 1П1), Delete — очистить, Enter — запуск.
    function key(e) {
      const k = e.key, low = String(k).toLowerCase();
      if (slot === 0) { if (k === ' ' || k === '_' || k === 'λ') return BL; if (C.includes(k)) return k; const lat = /^Key([A-Z])$/.exec(e.code || ''); if (lat) { const c = e.shiftKey ? lat[1] : lat[1].toLowerCase(); if (C.includes(c)) return c; } return undefined; }
      if (slot === 1) return ['l', 'л'].includes(low) ? 'L' : ['r', 'p', 'п'].includes(low) ? 'R' : ['n', 'н', 's'].includes(low) ? 'N' : undefined;
      if (/^[0-9]$/.test(k)) { const n = Number(k); if (lv.ask && !n) return undefined; if (n > nq) nq = n; return n; } if (lv.ask) return ['y', 'д'].includes(low) ? 'Y' : ['n', 'н'].includes(low) ? 'N' : undefined; return undefined;
    }
    const onKey = e => {
      const t = e.target || {}; if (/INPUT|SELECT|TEXTAREA/.test(t.tagName || '') || over() || e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'Enter') { if (t.tagName === 'BUTTON' && !(t.dataset && t.dataset.cell)) return; e.preventDefault(); if (!go.disabled) play(); return; }
      const dir = {ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0]}[e.key];
      if (dir) { e.preventDefault(); if (!sel) { choose('1|' + C[0]); return; } const [q, s] = sel.split('|'), nr = Math.min(nq, Math.max(1, Number(q) + dir[0])), nc = Math.min(C.length - 1, Math.max(0, C.indexOf(s) + dir[1])); choose(nr + '|' + C[nc]); return; }
      if (!sel) return; if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delete prog[sel]; slot = 0; changed(true); return; } if (e.key === 'Escape') { sel = null; slot = 0; drawTable(); return; }
      const v = key(e); if (v === undefined) return; e.preventDefault(); const i = slot; slot = (slot + 1) % 3; set(i, v);
      if (!slot) { const [q, s] = sel.split('|'), c = C.indexOf(s); if (c < C.length - 1) choose(q + '|' + C[c + 1]); else if (Number(q) < nq) choose((Number(q) + 1) + '|' + C[0]); }
    };
    document.addEventListener('keydown', onKey);
    const cols2 = el('div', 'lab-cols'), left = el('div', 'lab-panel tm-side'), right = el('div', 'lab-panel tm-side'), bar = el('div', 'lab-bar'), bar2 = el('div', 'lab-bar'), wrap = el('div', 'tm-wrap'); bar.style.justifyContent = 'flex-start'; bar2.style.justifyContent = 'flex-start';
    bar.append(go, stepBtn, fastBtn, button('⟲ Сначала', 'lab-small', reset), speed); bar2.append(addQ, delQ, button('Очистить таблицу', 'lab-small', () => { for (const k of Object.keys(prog)) delete prog[k]; sel = null; slot = 0; changed(); })); wrap.append(table);
    left.append(el('h3', '', 'Лента'), strip, status, bar, msg, el('h3', '', 'Ленты для проверки'), tapes);
    right.append(el('h3', '', 'Таблица правил'), wrap, bar2, info, edit, el('p', 'lab-note', 'Клавиатура: стрелки выбирают клетку; три клавиши подряд — что записать (пробел — λ), сдвиг (Л, П, Н или L, R, N) и ' + (lv.ask ? 'номер состояния или Д / Н — «Да» / «Нет»' : 'номер состояния (0 — стоп)') + ', например 1П1. Delete — очистить клетку, Enter — запустить.'));
    cols2.append(left, right); host.append(task, cols2); drawTable(); drawTapes();
    if (api.debugHost) window.labSet = p => { for (const k of Object.keys(prog)) delete prog[k]; Object.assign(prog, JSON.parse(JSON.stringify(p))); for (const [k, r] of Object.entries(prog)) nq = Math.min(MAXQ, Math.max(nq, Number(k.split('|')[0]), typeof r[2] === 'number' ? r[2] : 0)); changed(); };
    return () => { clearInterval(timer); document.removeEventListener('keydown', onKey); };
  }
  LAB.register({id: 'turing', bg: 'bg_turing', hero: 'host_tape', title: 'Машина Тьюринга', genre: 'теория алгоритмов', art: '📼', color: '#f0a1ff', unit: 'Задача', minutes: 45,
    about: 'Составь таблицу правил для машины Тьюринга: что записать, куда сдвинуть головку и в какое состояние перейти. Головка бежит по ленте, а программа проверяется на нескольких лентах — от инверсии и двоичного +1 до палиндрома и копии слова.',
    levels: grade => grade <= 10 ? LEVELS.slice(0, 8) : LEVELS, mount, check, solve, LEVELS, run, size, init, step, parseRef, LIMIT});
})();
