// «Электронные таблицы»: ученик пишет формулы как в LibreOffice Calc (русские имена функций, ссылки A1 и $A$1, диапазоны A1:B5).
// Формула проверяется сразу на трёх наборах данных — подставить готовое число вместо формулы не получится.
// Темы: формулы и ссылки, копирование формул, встроенные функции, ЕСЛИ и СЧЁТЕСЛИ, обработка большой таблицы (задание 14 ОГЭ).
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const COLS = 'ABCDEFGHIJ', CYR = {'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H'};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  /* ---------- движок формул ---------- */
  const FN = {СУММ: 'sum', SUM: 'sum', СРЗНАЧ: 'avg', AVERAGE: 'avg', МАКС: 'max', MAX: 'max', МИН: 'min', MIN: 'min', СЧЁТ: 'count', СЧЕТ: 'count', COUNT: 'count', СЧЁТЕСЛИ: 'countif', СЧЕТЕСЛИ: 'countif', COUNTIF: 'countif',
    СЧЁТЕСЛИМН: 'countifs', СЧЕТЕСЛИМН: 'countifs', COUNTIFS: 'countifs', СУММЕСЛИ: 'sumif', SUMIF: 'sumif', СРЗНАЧЕСЛИ: 'avgif', AVERAGEIF: 'avgif', ЕСЛИ: 'if', IF: 'if', И: 'and', AND: 'and', ИЛИ: 'or', OR: 'or', ОКРУГЛ: 'round', ROUND: 'round', ABS: 'abs'};
  function tokens(src) {
    const out = [], re = /\s*(?:(\d+(?:\.\d+)?)|("[^"]*")|(\$?[A-Za-zА-ЯЁа-яё]+\$?\d+)|([A-Za-zА-ЯЁа-яё]+)|(<>|<=|>=|[-+*/^()<>=:;,&]))/y; let m, p = 0;
    while (p < src.length) { re.lastIndex = p; m = re.exec(src); if (!m || m.index !== p) { if (/^\s*$/.test(src.slice(p))) break; throw new Error(`непонятный символ «${src.slice(p).trim()[0]}»`); } p = re.lastIndex;
      if (m[1]) out.push({t: 'n', v: +m[1]}); else if (m[2]) out.push({t: 's', v: m[2].slice(1, -1)});
      else if (m[3]) { const r = m[3].toUpperCase().replace(/[АВСЕН]/g, c => CYR[c]), mm = r.match(/^(\$?)([A-Z])(\$?)(\d+)$/); if (!mm) throw new Error(`ссылка «${m[3]}» записана неверно — столбцы обозначаются латинскими буквами`); out.push({t: 'r', ac: !!mm[1], c: COLS.indexOf(mm[2]), ar: !!mm[3], r: +mm[4] - 1}); }
      else if (m[4]) out.push({t: 'f', v: m[4].toUpperCase()}); else out.push({t: 'o', v: m[5]}); }
    return out;
  }
  function parse(formula) {
    const src = String(formula).trim(); if (!src.startsWith('=')) throw new Error('формула начинается со знака «=»');
    const tk = tokens(src.slice(1)); let p = 0; const peek = () => tk[p], eat = v => { if (tk[p] && tk[p].t === 'o' && tk[p].v === v) { p++; return true; } return false; };
    const cmp = () => { let a = add(); for (const op of ['<>', '<=', '>=', '<', '>', '=']) if (eat(op)) return {op, a, b: add()}; return a; };
    const add = () => { let a = mul(); for (;;) { if (eat('+')) a = {op: '+', a, b: mul()}; else if (eat('-')) a = {op: '-', a, b: mul()}; else if (eat('&')) a = {op: '&', a, b: mul()}; else return a; } };
    const mul = () => { let a = pow(); for (;;) { if (eat('*')) a = {op: '*', a, b: pow()}; else if (eat('/')) a = {op: '/', a, b: pow()}; else return a; } };
    const pow = () => { let a = un(); while (eat('^')) a = {op: '^', a, b: un()}; return a; };
    const un = () => eat('-') ? {op: 'neg', a: un()} : eat('+') ? un() : prim();
    const prim = () => { const x = tk[p++]; if (!x) throw new Error('формула оборвалась');
      if (x.t === 'n') return {op: 'num', v: x.v}; if (x.t === 's') return {op: 'str', v: x.v};
      if (x.t === 'r') { if (eat(':')) { const y = tk[p++]; if (!y || y.t !== 'r') throw new Error('после «:» нужна вторая ячейка диапазона'); return {op: 'range', a: x, b: y}; } return {op: 'ref', a: x}; }
      if (x.t === 'f') { const f = FN[x.v.replace('Ё', 'Е')] || FN[x.v]; if (!f) throw new Error(`неизвестная функция ${x.v}`); if (!eat('(')) throw new Error(`после ${x.v} нужна скобка`); const args = []; if (!eat(')')) { do args.push(cmp()); while (eat(';') || eat(',')); if (!eat(')')) throw new Error('не хватает закрывающей скобки'); } return {op: 'fn', f, name: x.v, args}; }
      if (x.t === 'o' && x.v === '(') { const e = cmp(); if (!eat(')')) throw new Error('не хватает закрывающей скобки'); return e; }
      throw new Error(`неожиданно «${x.v}»`); };
    const tree = cmp(); if (p < tk.length) throw new Error(`лишнее «${tk[p].v ?? ''}» в конце формулы`); return tree;
  }
  const crit = c => { const s = String(c), m = s.match(/^(<>|<=|>=|<|>|=)?(.*)$/), op = m[1] || '=', v = m[2], num = v !== '' && !isNaN(+v) ? +v : null;
    return x => { const a = num !== null && typeof x === 'number' ? x : String(x ?? ''), b = num !== null && typeof x === 'number' ? num : v; return op === '=' ? (typeof a === 'string' ? a.toLowerCase() === String(b).toLowerCase() : a === b) : op === '<>' ? a !== b : op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b; }; };
  function evaluate(tree, get) {
    const num = v => v === '' || v == null ? 0 : typeof v === 'number' ? v : typeof v === 'boolean' ? +v : isNaN(+v) ? (() => { throw new Error('в вычислении участвует текст'); })() : +v;
    const cells = n => { if (n.op !== 'range') return [ev(n)]; const r1 = Math.min(n.a.r, n.b.r), r2 = Math.max(n.a.r, n.b.r), c1 = Math.min(n.a.c, n.b.c), c2 = Math.max(n.a.c, n.b.c), out = []; for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(get(r, c)); return out; };
    const nums = list => list.flatMap(cells).filter(v => typeof v === 'number');
    const ev = n => { switch (n.op) {
      case 'num': case 'str': return n.v; case 'ref': return get(n.a.r, n.a.c); case 'range': throw new Error('диапазон можно передать только в функцию');
      case 'neg': return -num(ev(n.a)); case '&': return String(ev(n.a)) + String(ev(n.b));
      case '+': return num(ev(n.a)) + num(ev(n.b)); case '-': return num(ev(n.a)) - num(ev(n.b)); case '*': return num(ev(n.a)) * num(ev(n.b)); case '^': return num(ev(n.a)) ** num(ev(n.b));
      case '/': { const d = num(ev(n.b)); if (d === 0) throw new Error('деление на ноль (#DIV/0!)'); return num(ev(n.a)) / d; }
      case '=': case '<>': case '<': case '>': case '<=': case '>=': { const a = ev(n.a), b = ev(n.b); return crit(n.op + (b ?? ''))(a) ? true : false; }
      case 'fn': { const A = n.args; switch (n.f) {
        case 'sum': return nums(A).reduce((s, x) => s + x, 0); case 'avg': { const v = nums(A); if (!v.length) throw new Error('СРЗНАЧ от пустого диапазона'); return v.reduce((s, x) => s + x, 0) / v.length; }
        case 'max': return Math.max(...nums(A)); case 'min': return Math.min(...nums(A)); case 'count': return nums(A).length;
        case 'countif': return cells(A[0]).filter(crit(ev(A[1]))).length;
        case 'countifs': { if (A.length % 2) throw new Error('СЧЁТЕСЛИМН: пары «диапазон; условие»'); const ranges = []; for (let i = 0; i < A.length; i += 2) ranges.push([cells(A[i]), crit(ev(A[i + 1]))]); return ranges[0][0].filter((_, k) => ranges.every(([v, f]) => f(v[k]))).length; }
        case 'sumif': { const v = cells(A[0]), f = crit(ev(A[1])), s = A[2] ? cells(A[2]) : v; return v.reduce((t, x, k) => t + (f(x) && typeof s[k] === 'number' ? s[k] : 0), 0); }
        case 'avgif': { const v = cells(A[0]), f = crit(ev(A[1])), s = A[2] ? cells(A[2]) : v, pick = v.map((x, k) => f(x) ? s[k] : null).filter(x => typeof x === 'number'); if (!pick.length) throw new Error('СРЗНАЧЕСЛИ: ни одна строка не подошла'); return pick.reduce((t, x) => t + x, 0) / pick.length; }
        case 'if': return ev(A[0]) ? ev(A[1]) : A.length > 2 ? ev(A[2]) : false;
        case 'and': return A.every(x => ev(x)); case 'or': return A.some(x => ev(x));
        case 'round': { const k = A[1] ? num(ev(A[1])) : 0; return Math.round(num(ev(A[0])) * 10 ** k) / 10 ** k; } case 'abs': return Math.abs(num(ev(A[0])));
      } } } throw new Error('ошибка в формуле'); };
    return ev(tree);
  }
  // Копирование формулы: относительные ссылки сдвигаются, со знаком $ — нет.
  function shift(formula, dr, dc) {
    return String(formula).replace(/(\$?)([A-Za-zА-Я])(\$?)(\d+)/g, (all, ac, c, ar, r, off, s) => { const before = s[off - 1] || ''; if (/[A-Za-zА-ЯЁа-яё"]/.test(before)) return all; const col = COLS.indexOf((CYR[c.toUpperCase()] || c).toUpperCase()); if (col < 0) return all;
      const nc = ac ? col : col + dc, nr = ar ? +r : +r + dr; return nc < 0 || nr < 1 ? '#ССЫЛКА!' : `${ac}${COLS[nc]}${ar}${nr}`; });
  }
  // Лист: {cells: {"A1": значение или "=формула"}}; вычисление с защитой от циклических ссылок.
  function sheetValues(cells) {
    const memo = {}, busy = new Set();
    const get = (r, c) => { const k = COLS[c] + (r + 1); if (k in memo) return memo[k]; const raw = cells[k]; if (raw == null || raw === '') return ''; if (typeof raw !== 'string' || !raw.startsWith('=')) return raw;
      if (busy.has(k)) throw new Error('циклическая ссылка'); busy.add(k); try { memo[k] = evaluate(parse(raw), get); } finally { busy.delete(k); } return memo[k]; };
    return {get, value: k => { const m = k.match(/^([A-J])(\d+)$/); return get(+m[2] - 1, COLS.indexOf(m[1])); }};
  }
  const fmt = v => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace('.', ',')) : typeof v === 'boolean' ? (v ? 'ИСТИНА' : 'ЛОЖЬ') : String(v);
  const close = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-6 : String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  /* ---------- уровни ---------- */
  // data(r) — данные листа (r — генератор случайных чисел); target — ячейка (или первая ячейка столбца, copy — до какой строки копируется);
  // ref — образцовая формула; ask — 'formula' (написать формулу) или 'value' (вычислить, что покажет ячейка) или 'copied' (какая формула получится).
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1)), pick = (r, a) => a[Math.floor(r() * a.length)];
  const NAMES = ['Аня', 'Боря', 'Вика', 'Гриша', 'Даша', 'Егор', 'Женя', 'Зоя', 'Илья', 'Катя', 'Лёва', 'Маша', 'Никита', 'Оля', 'Паша', 'Рита', 'Саша', 'Тимур', 'Уля', 'Фёдор'];
  const shop = r => { const items = ['Пицца', 'Сок', 'Салат', 'Суп', 'Чай'], c = {A1: 'Блюдо', B1: 'Цена', C1: 'Кол-во', D1: 'Стоимость'}; items.forEach((x, i) => { c['A' + (i + 2)] = x; c['B' + (i + 2)] = ri(r, 3, 30) * 5; c['C' + (i + 2)] = ri(r, 1, 6); }); return c; };
  const marks = (r, n = 8) => { const c = {A1: 'Ученик', B1: 'Класс', C1: 'Тест 1', D1: 'Тест 2', E1: 'Сумма'}; for (let i = 0; i < n; i++) { c['A' + (i + 2)] = NAMES[i]; c['B' + (i + 2)] = pick(r, ['9 «А»', '9 «Б»']); c['C' + (i + 2)] = ri(r, 10, 50); c['D' + (i + 2)] = ri(r, 10, 50); } return c; };
  const L = o => o;
  const LEVELS = [
    L({title: 'Стоимость заказа', brief: 'В ячейку D2 запиши формулу: стоимость пиццы = цена × количество.', data: shop, target: 'D2', ref: '=B2*C2', ask: 'formula'}),
    L({title: 'Что покажет ячейка?', brief: 'В ячейках уже есть формулы. Какое число появится в ячейке C3? Щёлкни по ячейке, чтобы увидеть её формулу.', ask: 'value', target: 'C3',
      data: r => { const a = ri(r, 2, 9), b = ri(r, 2, 9); return {A1: a, B1: b, A2: '=A1*2', B2: '=A1+B1', C1: '=B2-A2', A3: '=C1*B1', B3: '=A3/2+A1', C3: '=B3+C1*2'}; }}),
    L({title: 'Итог по столбцу', brief: 'Скопируй мысленно: сначала в D2:D6 уже посчитаны стоимости. В ячейку D7 запиши формулу общей суммы заказа с функцией СУММ.', target: 'D7', ref: '=СУММ(D2:D6)', ask: 'formula',
      data: r => { const c = shop(r); for (let i = 2; i <= 6; i++) c['D' + i] = `=B${i}*C${i}`; c.A7 = 'Итого'; return c; }}),
    L({title: 'Формула для всего столбца', brief: 'Запиши формулу в D2 — игра скопирует её вниз до D6, как маркер заполнения. Стоимость каждого блюда должна посчитаться верно.', data: shop, target: 'D2', copy: 6, ref: '=B2*C2', ask: 'formula'}),
    L({title: 'Абсолютная ссылка', brief: 'В F1 — скидка (доля, например 0,1 = 10 %). Запиши в D2 цену со скидкой: цена × (1 − скидка). Формулу скопируют до D6 — ссылка на F1 не должна «уехать».', target: 'D2', copy: 6, ref: '=B2*(1-$F$1)', ask: 'formula',
      data: r => { const c = shop(r); c.D1 = 'Со скидкой'; c.E1 = 'Скидка:'; c.F1 = pick(r, [0.1, 0.2, 0.25, 0.5]); return c; }}),
    L({title: 'Куда уедет формула?', brief: 'Формулу из ячейки C2 скопировали в ячейку D4. Какая формула получится в D4? Запиши её полностью, начиная со знака «=».', ask: 'copied', from: 'C2', target: 'D4',
      data: r => ({C2: pick(r, ['=A2*$B$1', '=$A2+B$1', '=A$1*B2', '=СУММ(A2:B2)*$C$1', '=A2+B2-$A$1'])})}),
    L({title: 'Средний и лучший', brief: 'В E2 запиши формулу среднего балла за два теста (функция СРЗНАЧ), её скопируют до E9.', target: 'E2', copy: 9, ref: '=СРЗНАЧ(C2:D2)', ask: 'formula', data: r => { const c = marks(r); c.E1 = 'Среднее'; return c; }}),
    L({title: 'Зачёт или нет', brief: 'В E2 запиши формулу с функцией ЕСЛИ: «зачёт», если сумма двух тестов не меньше 50, иначе «пересдача». Её скопируют до E9. Текст в формуле пишется в кавычках.', target: 'E2', copy: 9, ref: '=ЕСЛИ(C2+D2>=50;"зачёт";"пересдача")', ask: 'formula', data: r => { const c = marks(r); c.E1 = 'Итог'; return c; }}),
    L({title: 'Сколько из 9 «А»?', brief: 'В G1 запиши формулу, которая считает, сколько учеников в списке из класса 9 «А» (функция СЧЁТЕСЛИ).', target: 'G1', ref: '=СЧЁТЕСЛИ(B2:B9;"9 «А»")', ask: 'formula', data: r => { const c = marks(r); c.F1 = 'Из 9 «А»:'; return c; }}),
    L({title: 'Выше 40', brief: 'В G1 запиши формулу: сколько учеников набрали за первый тест больше 40 баллов.', target: 'G1', ref: '=СЧЁТЕСЛИ(C2:C9;">40")', ask: 'formula', data: r => { const c = marks(r); c.F1 = 'Больше 40:'; return c; }}),
    L({title: 'Средний балл класса', brief: 'В G1 запиши формулу среднего балла за тест 2 учеников 9 «Б» (функция СРЗНАЧЕСЛИ).', target: 'G1', ref: '=СРЗНАЧЕСЛИ(B2:B9;"9 «Б»";D2:D9)', ask: 'formula', data: r => { const c = marks(r); c.F1 = 'Среднее 9 «Б»:'; for (const k of ['B2', 'B3']) c[k] = '9 «Б»'; return c; }}),
    L({title: 'Как в ОГЭ: два условия', brief: 'Как в задании 14 ОГЭ: в G1 найди, сколько учеников 9 «А» набрали за тест 1 больше 30 баллов. Можно функцией СЧЁТЕСЛИМН или вспомогательным столбцом: формула в F2 сама протянется до F21, а в G1 останется сложить столбец F.', target: 'G1', ref: '=СЧЁТЕСЛИМН(B2:B21;"9 «А»";C2:C21;">30")', ask: 'formula', free: 21, data: r => { const c = marks(r, 20); c.F1 = ''; return c; }}),
  ];
  const SEEDS = [11, 23, 37];
  function sheetFor(lv, seed, answer) {
    const cells = {...lv.data(rng(seed * 977 + LEVELS.indexOf(lv)))};
    if (answer && lv.ask === 'formula') { const list = typeof answer === 'string' ? {[lv.target]: answer} : answer;
      for (const [k, f] of Object.entries(list)) { cells[k] = f;
        // Во вспомогательном столбце формула из строки 2 протягивается вниз до конца данных, как маркером заполнения.
        if (lv.free && k !== lv.target && +k.slice(1) === 2) for (let rr = 3; rr <= lv.free; rr++) if (!((k[0] + rr) in list)) cells[k[0] + rr] = shift(f, rr - 2, 0);
        if (k === lv.target && lv.copy) { const col = k[0], row = +k.slice(1); for (let rr = row + 1; rr <= lv.copy; rr++) cells[col + rr] = shift(f, rr - row, 0); } } }
    return cells;
  }
  function check(lv, answer) {
    if (lv.ask === 'value' || lv.ask === 'copied') { const cells = sheetFor(lv, SEEDS[0]); let want;
      if (lv.ask === 'value') want = sheetValues(cells).value(lv.target); else { const f = cells[lv.from], dr = +lv.target.slice(1) - +lv.from.slice(1), dc = COLS.indexOf(lv.target[0]) - COLS.indexOf(lv.from[0]); want = shift(f, dr, dc); }
      const got = String(answer ?? '').trim().replace(',', '.').replace(/\s+/g, '').toUpperCase(), ok = lv.ask === 'value' ? Number(got) === want || Math.abs(Number(got) - want) < 1e-6 : got === want.replace(/\s+/g, '').toUpperCase().replace(/СУММ/, 'СУММ');
      return ok ? {ok: true, stars: 3, msg: lv.ask === 'value' ? `Да, в ${lv.target} будет ${fmt(want)}.` : `Верно: ${want}.`} : {ok: false, msg: 'Неверно. Посмотри формулы ячеек ещё раз: щёлкни по ячейке.', want}; }
    const list = typeof answer === 'string' ? {[lv.target]: answer} : answer || {}, main = list[lv.target];
    if (!main || !String(main).trim().startsWith('=')) return {ok: false, msg: `В ячейке ${lv.target} должна быть формула (начинается со знака «=»).`};
    for (const [k, f] of Object.entries(list)) { if (!/^[A-J]\d{1,2}$/.test(k)) return {ok: false, msg: `Неизвестная ячейка ${k}.`}; if (String(f).startsWith('=')) try { parse(f); } catch (e) { return {ok: false, msg: `Ошибка в формуле ${k}: ${e.message}.`}; } }
    const targets = lv.copy ? Array.from({length: lv.copy - +lv.target.slice(1) + 1}, (_, i) => lv.target[0] + (+lv.target.slice(1) + i)) : [lv.target];
    for (const seed of SEEDS) { const mine = sheetValues(sheetFor(lv, seed, list)), ref = sheetValues(sheetFor(lv, seed, lv.ref));
      for (const t of targets) { let a, b; try { a = mine.value(t); } catch (e) { return {ok: false, msg: `Ячейка ${t}: ${e.message}.`}; } b = ref.value(t);
        if (!close(a, b)) return {ok: false, msg: seed === SEEDS[0] ? `В ячейке ${t} получилось ${fmt(a)}, а должно быть ${fmt(b)}.` : `На этих данных верно, но на других — нет (в ${t} ${fmt(a)} вместо ${fmt(b)}). Формула должна ссылаться на ячейки, а не содержать готовые числа.`}; } }
    const len = String(main).replace(/\s+/g, '').length, refLen = lv.ref.replace(/\s+/g, '').length, extra = Object.keys(list).length - 1;
    return {ok: true, stars: extra > 0 ? 2 : len <= refLen + 6 ? 3 : 2, msg: extra ? 'Решено со вспомогательными ячейками — работает! Попробуй одной формулой.' : 'Формула верна на всех трёх наборах данных.'};
  }
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'), grid = el('div', 'sh-wrap'), bar = el('div', 'sh-bar'), name = el('b', 'sh-name', lv.target), fx = el('input', 'sh-fx'); let sel = lv.target, mine = {}, tries = 0;
    task.append(el('h2', '', lv.title), el('p', '', lv.brief)); fx.spellcheck = false; fx.autocomplete = 'off'; fx.setAttribute('aria-label', 'Строка формул');
    const base = sheetFor(lv, SEEDS[0]), rows = Math.max(...Object.keys(base).map(k => +k.slice(1)), +lv.target.slice(1), lv.copy || 0) + 1;
    const editable = k => lv.ask === 'formula' && (k === lv.target || (lv.free && !(k in base)));
    function draw() {
      const cells = lv.ask === 'formula' ? sheetFor(lv, SEEDS[0], {...mine}) : base; let vals; vals = sheetValues(cells);
      const t = el('table', 'sh-grid'), h = el('tr'); h.append(el('th')); for (const c of COLS.slice(0, 8)) h.append(el('th', '', c)); t.append(h);
      for (let r = 1; r <= rows; r++) { const tr = el('tr'); tr.append(el('th', '', String(r)));
        for (const c of COLS.slice(0, 8)) { const k = c + r, td = el('td'); let v = ''; try { v = fmt(vals.value(k)); } catch (e) { v = '#ОШИБКА'; td.title = e.message; }
          td.textContent = v; if (typeof cells[k] === 'string' && cells[k].startsWith('=')) td.classList.add('f'); if (k === sel) td.classList.add('sel'); if (k === lv.target || (lv.copy && c === lv.target[0] && r > +lv.target.slice(1) && r <= lv.copy)) td.classList.add('goal'); if (editable(k)) td.classList.add('edit');
          td.addEventListener('click', () => { sel = k; name.textContent = k; fx.value = (editable(k) ? mine[k] : cells[k]) ?? ''; fx.readOnly = !editable(k); draw(); if (editable(k)) fx.focus(); }); tr.append(td); } t.append(tr); }
      grid.replaceChildren(t);
    }
    fx.addEventListener('input', () => { if (editable(sel)) { mine[sel] = fx.value; if (!fx.value) delete mine[sel]; draw(); } });
    fx.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); });
    const answer = el('input', 'sh-ans'); answer.placeholder = lv.ask === 'value' ? 'Число' : '=формула'; answer.setAttribute('aria-label', 'Ответ');
    const go = button(lv.ask === 'formula' ? 'Проверить на трёх наборах данных' : 'Ответить', 'lab-main', () => { tries++; const r = check(lv, lv.ask === 'formula' ? {...mine} : answer.value); msg.textContent = r.msg; msg.className = 'lab-msg ' + (r.ok ? 'good' : 'bad'); if (r.ok) api.finish(Math.min(r.stars, tries === 1 ? 3 : tries <= 3 ? 2 : 1), r.msg); }); go.dataset.act = 'run';
    bar.append(name, el('span', 'sh-fxl', 'ƒx'), fx);
    const help = el('details', 'sh-help'); help.append(el('summary', '', 'Справка: функции и ссылки'), el('p', '', 'СУММ(A1:A5), СРЗНАЧ(…), МАКС(…), МИН(…), СЧЁТ(…), СЧЁТЕСЛИ(диапазон; "условие"), СЧЁТЕСЛИМН(диапазон1; "усл1"; диапазон2; "усл2"), СУММЕСЛИ, СРЗНАЧЕСЛИ(диапазон; "условие"; где_считать), ЕСЛИ(условие; если_да; если_нет). Аргументы разделяются точкой с запятой. $A$1 — абсолютная ссылка: при копировании не меняется; A$1 — закреплена только строка.'));
    const side = el('div', 'lab-bar'); side.style.justifyContent = 'flex-start'; if (lv.ask !== 'formula') side.append(answer); side.append(go);
    host.append(task, bar, grid, side, msg, help); fx.value = ''; fx.readOnly = !editable(sel); if (lv.ask !== 'formula') { sel = lv.ask === 'copied' ? lv.from : lv.target; } draw();
    if (lv.ask === 'formula') setTimeout(() => fx.focus(), 50);
    if (api.debugHost) window.labSet = a => { if (lv.ask === 'formula') { mine = typeof a === 'string' ? {[lv.target]: a} : {...a}; draw(); } else answer.value = a; };
  }
  function solve(lv) { if (lv.ask === 'formula') return lv.ref; const cells = sheetFor(lv, SEEDS[0]); if (lv.ask === 'value') return String(sheetValues(cells).value(lv.target)); const dr = +lv.target.slice(1) - +lv.from.slice(1), dc = COLS.indexOf(lv.target[0]) - COLS.indexOf(lv.from[0]); return shift(cells[lv.from], dr, dc); }
  LAB.register({id: 'sheets', bg: 'bg_sheets', hero: 'host_accountant', title: 'Электронные таблицы', genre: 'электронные таблицы', art: '📊', color: '#3ad29f', unit: 'Задание', minutes: 45,
    about: 'Формулы как в LibreOffice Calc: ссылки, копирование, абсолютные ссылки, СУММ, СРЗНАЧ, ЕСЛИ, СЧЁТЕСЛИ и обработка большой таблицы, как в задании 14 ОГЭ. Формула проверяется на трёх наборах данных.',
    levels: () => LEVELS, mount, check, solve, LEVELS, parse, evaluate, shift, sheetValues});
})();
