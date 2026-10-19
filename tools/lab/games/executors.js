// «Исполнители»: классические исполнители из практикума Босовой в новом виде — Кузнечик, Водолей, Вычислитель, Черепаха и Чертёжник.
// У каждого своя система команд; нужно составить программу, которая решает задачу, и чем короче — тем больше звёзд.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  /* ---------- первые три исполнителя: программа — список команд ---------- */
  const KIND = {
    hopper: {name: 'Кузнечик', art: 'hopper', about: 'Прыгает по числовой прямой. Команды: «вперёд a» и «назад b».',
      cmds: lv => [['f', `вперёд ${lv.a}`], ['b', `назад ${lv.b}`]], init: lv => ({x: 0, seen: []}),
      step: (lv, s, c) => { const x = s.x + (c === 'f' ? lv.a : -lv.b); if (x < lv.min || x > lv.max) return {error: `Кузнечик выпрыгнул за край прямой (клетка ${x}).`}; return {x, seen: s.seen.concat(lv.flowers.includes(x) && !s.seen.includes(x) ? [x] : [])}; },
      goal: (lv, s) => s.x === lv.target && lv.flowers.every(f => s.seen.includes(f)), key: s => s.x + '|' + s.seen.slice().sort().join(',')},
    jugs: {name: 'Водолей', art: 'jug', about: 'Два сосуда без делений. Можно наполнить сосуд, вылить его или перелить из одного в другой, пока не наполнится или не опустеет.',
      cmds: lv => [['fa', `наполнить A (${lv.A} л)`], ['fb', `наполнить B (${lv.B} л)`], ['ea', 'вылить A'], ['eb', 'вылить B'], ['ab', 'перелить A → B'], ['ba', 'перелить B → A']], init: () => ({a: 0, b: 0}),
      step: (lv, s, c) => { let {a, b} = s; if (c === 'fa') a = lv.A; else if (c === 'fb') b = lv.B; else if (c === 'ea') a = 0; else if (c === 'eb') b = 0; else if (c === 'ab') { const m = Math.min(a, lv.B - b); a -= m; b += m; } else { const m = Math.min(b, lv.A - a); b -= m; a += m; } return {a, b}; },
      goal: (lv, s) => s.a === lv.target || s.b === lv.target, key: s => s.a + ',' + s.b},
    calc: {name: 'Вычислитель', art: 'calc', about: 'Превращает одно число в другое своими командами.',
      cmds: lv => lv.ops.map((o, i) => [String(i), o[0]]), init: lv => ({n: lv.start}),
      step: (lv, s, c) => { const n = lv.ops[Number(c)][1](s.n); if (!Number.isInteger(n) || Math.abs(n) > 100000) return {error: 'Число стало слишком большим.'}; return {n}; },
      goal: (lv, s) => s.n === lv.target, key: s => String(s.n)},
  };
  // Кратчайшая программа поиском в ширину — для числа звёзд и для проверки уровней.
  function shortest(lv) {
    const K = KIND[lv.kind], start = K.init(lv), cmds = K.cmds(lv).map(c => c[0]); if (K.goal(lv, start)) return [];
    const seen = new Map([[K.key(start), null]]), queue = [[start, []]];
    for (let h = 0; h < queue.length && h < 200000; h++) { const [s, path] = queue[h]; if (path.length >= 30) continue;
      for (const c of cmds) { const t = K.step(lv, s, c); if (t.error) continue; const k = K.key(t); if (seen.has(k)) continue; seen.set(k, 1); const p = path.concat([c]); if (K.goal(lv, t)) return p; queue.push([t, p]); } }
    return null;
  }
  function runList(lv, prog, trace) { const K = KIND[lv.kind]; let s = K.init(lv); trace && trace(s); for (const [i, c] of prog.entries()) { const t = K.step(lv, s, c); if (t.error) return {error: `Команда ${i + 1}: ${t.error}`, s}; s = t; trace && trace(s); } return {s, ok: K.goal(lv, s)}; }
  /* ---------- Черепаха и Чертёжник: программа — текст ---------- */
  // Язык: вперёд n · назад n · направо угол · налево угол · сместиться на (x, y) · опустить перо · поднять перо · повтори k [ … ]
  function parse(text) {
    const src = String(text).toLowerCase().replace(/ё/g, 'е'), toks = src.match(/\(|\)|\[|\]|,|-?\d+|[а-яa-z]+/g) || []; let p = 0;
    const fail = m => { throw new Error(m); }, num = () => { const t = toks[p++]; if (!/^-?\d+$/.test(t || '')) fail(`после «${toks[p - 2] || ''}» нужно число`); return Number(t); };
    const block = end => { const out = []; while (p < toks.length && toks[p] !== end) { const w = toks[p++];
      if (w === 'вперед' || w === 'назад') out.push([w, num()]); else if (w === 'направо' || w === 'налево') out.push([w, num()]);
      else if (w === 'сместиться') { if (toks[p] === 'на') p++; if (toks[p++] !== '(') fail('после «сместиться на» нужна скобка: сместиться на (2, 3)'); const x = num(); if (toks[p++] !== ',') fail('координаты пишутся через запятую'); const y = num(); if (toks[p++] !== ')') fail('не хватает закрывающей скобки'); out.push(['shift', x, y]); }
      else if (w === 'опустить' || w === 'поднять') { if (toks[p] === 'перо') p++; out.push([w]); }
      else if (['вверх', 'вниз', 'влево', 'вправо', 'закрасить'].includes(w)) out.push([w]);
      else if (w === 'пока') { const side = toks[p++]; if (!['сверху', 'снизу', 'слева', 'справа'].includes(side)) fail('после «пока» нужно: сверху, снизу, слева или справа'); if (toks[p] === 'свободно') p++; else fail('после «пока ' + side + '» нужно слово «свободно»'); if (toks[p++] !== '[') fail('после условия нужна квадратная скобка [ … ]'); const body = block(']'); if (toks[p++] !== ']') fail('не закрыта квадратная скобка'); out.push(['while', side, body]); }
      else if (w === 'повтори') { const k = num(); if (k > 40) fail('повтор не больше 40 раз'); if (toks[p++] !== '[') fail('после «повтори k» нужна квадратная скобка [ … ]'); const body = block(']'); if (toks[p++] !== ']') fail('не закрыта квадратная скобка'); out.push(['rep', k, body]); }
      else fail(`неизвестная команда «${w}»`); }
      return out; };
    const prog = block(null); if (p < toks.length) fail('лишняя закрывающая скобка'); return prog;
  }
  const count = prog => prog.reduce((n, c) => n + (c[0] === 'rep' || c[0] === 'while' ? 1 + count(c[2]) : 1), 0);
  function draw(prog, mode) {
    // Возвращает отрезки, нарисованные пером. Черепаха: курс в градусах, перо опущено. Чертёжник: смещения, перо поднято вначале.
    const segs = []; let x = 0, y = 0, dir = 90, pen = mode === 'turtle', steps = 0;
    const go = list => { for (const c of list) { if (++steps > 3000) throw new Error('слишком много шагов'); if (c[0] === 'rep') { for (let i = 0; i < c[1]; i++) go(c[2]); continue; }
      if (c[0] === 'направо') dir -= c[1]; else if (c[0] === 'налево') dir += c[1]; else if (c[0] === 'опустить') pen = true; else if (c[0] === 'поднять') pen = false;
      else { let nx = x, ny = y; if (c[0] === 'shift') { nx += c[1]; ny += c[2]; } else { const d = (c[0] === 'вперед' ? 1 : -1) * c[1], r = dir * Math.PI / 180; nx += d * Math.cos(r); ny += d * Math.sin(r); } if (pen) segs.push([x, y, nx, ny]); x = nx; y = ny; } } };
    go(prog); return segs;
  }
  // Робот на клетчатом поле: стены — закрытые клетки, за край поля выходить нельзя. Задача решена, если закрашены ровно нужные клетки.
  const DIRS = {вверх: [0, -1], вниз: [0, 1], влево: [-1, 0], вправо: [1, 0]}, SIDE = {сверху: 'вверх', снизу: 'вниз', слева: 'влево', справа: 'вправо'};
  function robot(prog, f, trace) {
    let [x, y] = f.start, steps = 0; const painted = new Set(), wall = new Set(f.walls.map(w => w.join(','))), free = (dx, dy) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < f.w && ny < f.h && !wall.has(nx + ',' + ny); };
    const go = list => { for (const c of list) { if (++steps > 2000) throw new Error('программа работает слишком долго — возможно, бесконечный цикл');
      if (c[0] === 'rep') { for (let i = 0; i < c[1]; i++) go(c[2]); continue; }
      if (c[0] === 'while') { let guard = 0; while (free(...DIRS[SIDE[c[1]]])) { if (++guard > 200) throw new Error('цикл «пока» не заканчивается'); go(c[2]); } continue; }
      if (c[0] === 'закрасить') painted.add(x + ',' + y); else if (DIRS[c[0]]) { if (!free(...DIRS[c[0]])) throw new Error(`Робот врезался: ${c[0]} из клетки (${x + 1}, ${y + 1}) нельзя`); x += DIRS[c[0]][0]; y += DIRS[c[0]][1]; } else throw new Error(`Робот не знает команды «${c[0]}»`);
      trace && trace({x, y, painted: new Set(painted)}); } };
    go(prog); return {x, y, painted};
  }
  // Сравнение рисунков: делим отрезки на единичные кусочки и сравниваем множества (направление и порядок не важны).
  function pieces(segs, unit) {
    const out = new Set();
    for (const [x1, y1, x2, y2] of segs) { const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(len / unit));
      for (let i = 0; i < n; i++) { const a = [x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n], b = [x1 + (x2 - x1) * (i + 1) / n, y1 + (y2 - y1) * (i + 1) / n], r = v => Math.round(v * 2 / unit) / 2;
        const p = [r(a[0]), r(a[1])].join(','), q = [r(b[0]), r(b[1])].join(','); out.add(p < q ? p + '|' + q : q + '|' + p); } }
    return out;
  }
  // Рисунок засчитывается, где бы он ни оказался и в какую сторону ни был бы повёрнут зеркально (квадрат «налево» — тоже квадрат).
  const norm = (set, flip) => { const segs = [...set].map(k => k.split('|').map(p => p.split(',').map(Number)).map(([x, y]) => [flip ? -x : x, y])), mx = Math.min(...segs.flat().map(p => p[0])), my = Math.min(...segs.flat().map(p => p[1]));
    return new Set(segs.map(s => s.map(([x, y]) => (x - mx) + ',' + (y - my))).map(([p, q]) => p < q ? p + '|' + q : q + '|' + p)); };
  const eq = (A, B) => A.size === B.size && [...A].every(x => B.has(x));
  const same = (A, B) => A.size > 0 && (eq(norm(A, false), norm(B, false)) || eq(norm(A, true), norm(B, false)));
  /* ---------- Редактор строк: заменить (v, w) и пока нашлось (v) [ … ] ---------- */
  function parseEd(text) {
    const src = String(text).replace(/ё/g, 'е'); let p = 0;
    const fail = m => { throw new Error(m); }, ws = () => { while (p < src.length && /\s/.test(src[p])) p++; };
    const arg = () => { ws(); if (src[p++] !== '(') fail('после команды нужна скобка'); const e = src.indexOf(')', p); if (e < 0) fail('не закрыта круглая скобка'); const inner = src.slice(p, e); p = e + 1; return inner.split(',').map(x => x.replace(/\s+/g, '')); };
    const block = inner => { const out = []; for (;;) { ws(); if (p >= src.length) { if (inner) fail('не закрыта квадратная скобка'); return out; } if (src[p] === ']') { if (!inner) fail('лишняя закрывающая скобка'); p++; return out; }
      const w = (src.slice(p).match(/^[а-яa-z]+/i) || [''])[0].toLowerCase(); if (!w) fail(`непонятный символ «${src[p]}»`); p += w.length;
      if (w === 'заменить') { const a = arg(); if (a.length !== 2 || !a[0]) fail('пиши так: заменить (что, на что)'); out.push(['sub', a[0], a[1]]); }
      else if (w === 'пока') { ws(); const w2 = (src.slice(p).match(/^[а-я]+/i) || [''])[0].toLowerCase(); if (w2 !== 'нашлось') fail('после «пока» нужно слово «нашлось»'); p += w2.length; const a = arg(); if (a.length !== 1 || !a[0]) fail('пиши так: пока нашлось (что) [ … ]'); ws(); if (src[p++] !== '[') fail('после условия нужна квадратная скобка [ … ]'); out.push(['while', a[0], block(true)]); }
      else fail(`неизвестная команда «${w}»`); } };
    return block(false);
  }
  function runEd(prog, str) { let s = str, steps = 0; const go = list => { for (const c of list) { if (++steps > 3000) throw new Error('программа работает слишком долго — возможно, бесконечный цикл');
      if (c[0] === 'sub') { const i = s.indexOf(c[1]); if (i >= 0) s = s.slice(0, i) + c[2] + s.slice(i + c[1].length); } else while (s.includes(c[1])) go(c[2]); } }; go(prog); return s; }
  /* ---------- уровни ---------- */
  const LV = o => o;
  const F = (w, h, start, walls, paint) => ({w, h, start, walls, paint});
  const LEVELS = [
    LV({kind: 'hopper', title: 'Кузнечик: первая клетка', brief: 'Доведи Кузнечика из 0 в клетку 7.', a: 5, b: 3, min: -10, max: 20, target: 7, flowers: []}),
    LV({kind: 'hopper', title: 'Кузнечик: за цветком', brief: 'Сорви цветок в клетке 2 и закончи в клетке 10.', a: 7, b: 3, min: -10, max: 20, target: 10, flowers: [2]}),
    LV({kind: 'hopper', title: 'Кузнечик: два цветка', brief: 'Собери цветы в клетках 1 и 11, закончи в клетке 6.', a: 5, b: 2, min: -10, max: 20, target: 6, flowers: [1, 11]}),
    LV({kind: 'jugs', title: 'Водолей: 4 литра', brief: 'Получи ровно 4 литра в любом сосуде.', A: 3, B: 5, target: 4}),
    LV({kind: 'jugs', title: 'Водолей: 1 литр', brief: 'Получи ровно 1 литр.', A: 4, B: 9, target: 1}),
    LV({kind: 'jugs', title: 'Водолей: 6 литров', brief: 'Получи ровно 6 литров.', A: 7, B: 11, target: 6}),
    LV({kind: 'calc', title: 'Вычислитель: 1 → 13', brief: 'Преврати 1 в 13.', start: 1, target: 13, ops: [['прибавь 1', n => n + 1], ['умножь на 2', n => n * 2]]}),
    LV({kind: 'calc', title: 'Вычислитель: 3 → 35', brief: 'Преврати 3 в 35.', start: 3, target: 35, ops: [['прибавь 1', n => n + 1], ['умножь на 2', n => n * 2]]}),
    LV({kind: 'calc', title: 'Вычислитель: 2 → 50', brief: 'Преврати 2 в 50 командами «прибавь 3» и «умножь на 2».', start: 2, target: 50, ops: [['прибавь 3', n => n + 3], ['умножь на 2', n => n * 2]]}),
    LV({kind: 'calc', art: 'doubler', title: 'Удвоитель: 3 → 20', brief: 'Удвоитель умеет удваивать число и вычитать единицу. Преврати 3 в 20.', start: 3, target: 20, ops: [['удвой', n => n * 2], ['вычти 1', n => n - 1]]}),
    LV({kind: 'calc', art: 'doubler', title: 'Удвоитель: 5 → 33', brief: 'Те же команды: преврати 5 в 33.', start: 5, target: 33, ops: [['удвой', n => n * 2], ['вычти 1', n => n - 1]]}),
    LV({kind: 'editor', title: 'Редактор: все двойки', brief: 'Замени все двойки на единицы — в любой строке, сколько бы двоек в ней ни было.', ref: 'пока нашлось (2) [заменить (2, 1)]', tests: ['1212', '2222', '1', '21122'], rule: x => x.replace(/2/g, '1')}),
    LV({kind: 'editor', title: 'Редактор: сжатие', brief: 'Каждую серию подряд идущих единиц сожми в одну единицу: 1112211 → 1221.', ref: 'пока нашлось (11) [заменить (11, 1)]', tests: ['1112211', '1111', '2121', '211112'], rule: x => x.replace(/1+/g, '1')}),
    LV({kind: 'editor', title: 'Редактор: сложение палочками', brief: 'Числа записаны палочками: 111+11 значит 3+2. Получи сумму палочками: 11111.', ref: 'пока нашлось (+) [заменить (+, )]', tests: ['111+11', '1+1+1', '1111', '11+111+1'], rule: x => x.replace(/\+/g, '')}),
    LV({kind: 'turtle', title: 'Черепаха: квадрат', brief: 'Нарисуй квадрат со стороной 100.', ref: 'повтори 4 [вперёд 100 направо 90]', unit: 50}),
    LV({kind: 'turtle', title: 'Черепаха: треугольник', brief: 'Нарисуй равносторонний треугольник со стороной 120.', ref: 'повтори 3 [вперёд 120 направо 120]', unit: 40}),
    LV({kind: 'turtle', title: 'Черепаха: звезда', brief: 'Нарисуй пятиконечную звезду с лучом 150. Подсказка: поворот на 144°.', ref: 'повтори 5 [вперёд 150 направо 144]', unit: 50}),
    LV({kind: 'plotter', title: 'Чертёжник: лесенка', brief: 'Нарисуй лесенку из трёх ступенек: каждая — вправо на 2 и вверх на 2. Перо сначала поднято.', ref: 'опустить перо повтори 3 [сместиться на (2, 0) сместиться на (0, 2)]', unit: 1}),
    LV({kind: 'plotter', title: 'Чертёжник: домик', brief: 'Нарисуй домик: квадрат 4×4 и крышу — две линии к точке (2, 6) от верхних углов.', ref: 'опустить перо сместиться на (4, 0) сместиться на (0, 4) сместиться на (-4, 0) сместиться на (0, -4) сместиться на (0, 4) сместиться на (2, 2) сместиться на (2, -2)', unit: 1}),
    LV({kind: 'robot', title: 'Робот: дорожка', brief: 'Закрась пять клеток справа от Робота.', ref: 'повтори 5 [вправо закрасить]', fields: [F(7, 3, [0, 1], [], [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]])]}),
    LV({kind: 'robot', title: 'Робот: до стены', brief: 'Закрась все клетки справа до стены. Длина коридора на разных полях разная — программа проверяется на двух полях! Используй «пока справа свободно [ … ]».', ref: 'пока справа свободно [вправо закрасить]', fields: [F(8, 3, [0, 1], [[6, 1]], [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]), F(8, 3, [0, 1], [[3, 1]], [[1, 1], [2, 1]])]}),
    LV({kind: 'robot', title: 'Робот: лестница', brief: 'Закрась ступеньки: вправо и вверх, четыре раза, закрашивая клетку после каждого шага.', ref: 'повтори 4 [вправо закрасить вверх закрасить]', fields: [F(6, 6, [0, 5], [], [[1, 5], [1, 4], [2, 4], [2, 3], [3, 3], [3, 2], [4, 2], [4, 1]])]}),
    LV({kind: 'plotter', title: 'Чертёжник: забор', brief: 'Нарисуй забор: пять вертикальных досок высотой 3 через каждые 2 клетки, начиная с (0, 0).', ref: 'повтори 5 [опустить перо сместиться на (0, 3) поднять перо сместиться на (2, -3)]', unit: 1}),
  ];
  for (const lv of LEVELS) { if (lv.kind === 'editor') { lv.refProg = parseEd(lv.ref); lv.par = count(lv.refProg); continue; } if (lv.kind === 'robot') { lv.refProg = parse(lv.ref); lv.par = count(lv.refProg); continue; } if (KIND[lv.kind]) { const p = shortest(lv); lv.refList = p; lv.par = p ? p.length : 99; } else { lv.refProg = parse(lv.ref); lv.par = count(lv.refProg); lv.target = pieces(draw(lv.refProg, lv.kind), lv.unit); } }
  function check(lv, answer) {
    if (KIND[lv.kind]) { if (!Array.isArray(answer) || !answer.length) return {ok: false, msg: 'Составь программу.'}; const r = runList(lv, answer); if (r.error) return {ok: false, msg: r.error}; if (!r.ok) return {ok: false, msg: 'Программа выполнена, но задача не решена.'}; const n = answer.length; return {ok: true, stars: n <= lv.par ? 3 : n <= lv.par + 2 ? 2 : 1, msg: `Команд: ${n}, кратчайшая программа — ${lv.par}.`}; }
    if (lv.kind === 'editor') { let prog; try { prog = parseEd(answer); } catch (e) { return {ok: false, msg: 'Ошибка в программе: ' + e.message + '.'}; } if (!prog.length) return {ok: false, msg: 'Программа пуста.'};
      const rows = []; try { for (const t of lv.tests) rows.push([t, runEd(prog, t), lv.rule(t)]); } catch (e) { return {ok: false, msg: e.message + '.', rows}; }
      const bad = rows.filter(r => r[1] !== r[2]).length; if (bad) return {ok: false, msg: `Неверно для строк: ${bad} из ${rows.length}.`, rows};
      const n = count(prog); return {ok: true, stars: n <= lv.par ? 3 : n <= lv.par + 2 ? 2 : 1, msg: `Команд: ${n}, у образца — ${lv.par}.`, rows}; }
    let prog; try { prog = parse(answer); } catch (e) { return {ok: false, msg: 'Ошибка в программе: ' + e.message + '.'}; } if (!prog.length) return {ok: false, msg: 'Программа пуста.'};
    if (lv.kind === 'robot') { for (const [k, f] of lv.fields.entries()) { let r; try { r = robot(prog, f); } catch (e) { return {ok: false, field: k, msg: (lv.fields.length > 1 ? `Поле ${k + 1}: ` : '') + e.message + '.'}; }
        const want = new Set(f.paint.map(c => c.join(','))); if (r.painted.size !== want.size || [...want].some(c => !r.painted.has(c))) return {ok: false, field: k, msg: (lv.fields.length > 1 ? `Поле ${k + 1}: ` : '') + 'закрашены не те клетки.'}; }
      const n = count(prog); return {ok: true, stars: n <= lv.par ? 3 : n <= lv.par + 3 ? 2 : 1, msg: `Команд: ${n}, у образца — ${lv.par}.`}; }
    let segs; try { segs = draw(prog, lv.kind); } catch (e) { return {ok: false, msg: e.message}; }
    if (!same(pieces(segs, lv.unit), lv.target)) return {ok: false, msg: 'Рисунок не совпадает с образцом.', segs};
    const n = count(prog); return {ok: true, stars: n <= lv.par ? 3 : n <= lv.par + 3 ? 2 : 1, msg: `Команд: ${n}, у образца — ${lv.par}.`, segs};
  }
  /* ---------- экран ---------- */
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'), stage = el('div', 'ex-stage'), K = KIND[lv.kind], art = lv.art || (K ? K.art : lv.kind === 'editor' ? 'editor' : lv.kind === 'turtle' ? 'turtle' : lv.kind === 'robot' ? 'robot' : 'plotter'); let timer = 0;
    const pic = () => { const i = new Image(); i.className = 'ex-char'; i.alt = ''; i.src = `art/exec_${art}.webp?v=1`; i.addEventListener('error', () => i.remove()); return i; };
    task.append(pic(), el('h2', '', lv.title), el('p', '', lv.brief), el('p', 'lab-note', lv.art === 'doubler' ? 'Удвоитель превращает одно число в другое: удваивает или вычитает единицу.' : K ? K.about : lv.kind === 'editor' ? 'Редактор: заменить (что, на что) — меняет первое вхождение; пока нашлось (что) [ … ] — повторяет, пока такая подстрока есть в строке. Программа проверяется на нескольких строках.' : lv.kind === 'robot' ? 'Робот: вверх, вниз, влево, вправо, закрасить, повтори k [ … ], пока справа свободно [ … ] (а также сверху, снизу, слева). Тёмные клетки — стены.' : lv.kind === 'turtle' ? 'Черепаха: вперёд n, назад n, направо угол, налево угол, повтори k [ … ]. Сначала смотрит вверх, перо опущено.' : 'Чертёжник: сместиться на (x, y), опустить перо, поднять перо, повтори k [ … ]. Начинает в точке (0, 0), перо поднято.'));
    const done = r => { if (r.ok) { msg.textContent = 'Задача решена! ' + r.msg; msg.className = 'lab-msg good'; api.finish(r.stars, r.msg); } else { msg.textContent = r.msg; msg.className = 'lab-msg bad'; } };
    if (K) {
      const prog = [], list = el('ol', 'ex-prog'), pal = el('div', 'ex-pal');
      const show = s => { if (lv.kind === 'hopper') { const line = el('div', 'ex-line'); for (let x = lv.min; x <= lv.max; x++) { const c = el('div', 'ex-cell' + (x === lv.target ? ' goal' : '') + (lv.flowers.includes(x) && !s.seen.includes(x) ? ' flower' : '') + (x === s.x ? ' here' : '')); c.append(el('small', '', String(x))); if (x === s.x) c.append(pic()); line.append(c); } stage.replaceChildren(line); }
        else if (lv.kind === 'jugs') { const box = el('div', 'ex-jugs'); for (const [n, v, cap] of [['A', s.a, lv.A], ['B', s.b, lv.B]]) { const j = el('div', 'ex-jug'), w = el('i'); w.style.height = (v / cap * 100) + '%'; const glass = el('div', 'ex-glass'); glass.style.height = (60 + cap * 14) + 'px'; glass.append(w); j.append(glass, el('b', '', `${n}: ${v} из ${cap} л`)); box.append(j); } box.append(el('p', 'ex-want', `Нужно: ${lv.target} л`)); stage.replaceChildren(box); }
        else { const b = el('div', 'ex-calc'); b.append(pic(), el('b', '', String(s.n)), el('span', '', `цель: ${lv.target}`)); stage.replaceChildren(b); } };
      const redraw = () => { list.replaceChildren(...prog.map((c, i) => { const li = el('li', '', K.cmds(lv).find(x => x[0] === c)[1]), x = button('×', 'lab-small ex-x', () => { prog.splice(i, 1); redraw(); }); li.append(x); return li; })); show(K.init(lv)); msg.textContent = ''; };
      for (const [c, t] of K.cmds(lv)) { const b = button(t, 'lab-small ex-cmd', () => { if (prog.length < 40) { prog.push(c); redraw(); } }); b.dataset.cmd = c; pal.append(b); }
      const go = button('▶ Выполнить', 'lab-main', () => { clearInterval(timer); const frames = []; const r = runList(lv, prog, s => frames.push(s)); let k = 0; timer = setInterval(() => { if (k >= frames.length) { clearInterval(timer); done(check(lv, prog.slice())); return; } show(frames[k++]); }, 380); }); go.dataset.act = 'run';
      const cols = el('div', 'lab-cols'), l = el('div', 'lab-panel'), r = el('div', 'lab-panel'), bar = el('div', 'lab-bar'); bar.style.justifyContent = 'flex-start'; bar.append(go, button('Очистить', 'lab-small', () => { prog.length = 0; redraw(); }));
      l.append(el('h3', '', 'Исполнитель'), stage, bar, msg); r.append(el('h3', '', 'Система команд'), pal, el('h3', '', 'Программа'), list, el('p', 'lab-note', `Три звезды — за кратчайшую программу (${lv.par} ${lv.par < 5 ? 'команды' : 'команд'}).`)); cols.append(l, r); host.append(task, cols); redraw();
      if (api.debugHost) window.labSet = p => { prog.length = 0; prog.push(...p); redraw(); };
    } else if (lv.kind === 'editor') {
      const ed = el('textarea', 'ex-code'); ed.spellcheck = false; ed.rows = 5; ed.value = 'заменить (1, 2)\n'; ed.setAttribute('aria-label', 'Программа'); const tab = el('table', 'lab-table ex-ed');
      const show = rows => { const h = el('tr'); h.append(el('th', '', 'Строка'), el('th', '', 'Стало'), el('th', '', 'Нужно')); tab.replaceChildren(h); lv.tests.forEach((t, i) => { const r = rows && rows[i], tr = el('tr', r ? (r[1] === r[2] ? 'hit' : 'miss') : ''); tr.append(el('td', '', t), el('td', '', r ? r[1] || '(пусто)' : '…'), el('td', '', lv.rule(t) || '(пусто)')); tab.append(tr); }); };
      const go = button('▶ Выполнить', 'lab-main', () => { const r = check(lv, ed.value); show(r.rows); done(r); }); go.dataset.act = 'run';
      const cols = el('div', 'lab-cols'), l = el('div', 'lab-panel'), r = el('div', 'lab-panel'), pic2 = pic(); pic2.className = 'ex-char ex-big';
      l.append(el('h3', '', 'Строки, на которых проверяется программа'), pic2, tab, go, msg); r.append(el('h3', '', 'Программа'), ed, el('p', 'lab-note', `Цикл «пока» считается одной командой плюс всё внутри. Три звезды — не длиннее ${lv.par} команд.`)); cols.append(l, r); host.append(task, cols); show(null);
      if (api.debugHost) window.labSet = t => { ed.value = t; };
    } else if (lv.kind === 'robot') {
      const ed = el('textarea', 'ex-code'); ed.spellcheck = false; ed.rows = 6; ed.value = 'вправо\nзакрасить\n'; ed.setAttribute('aria-label', 'Программа'); let field = 0;
      const cv = el('canvas', 'ex-canvas'), g = cv.getContext('2d'), img = n => { const i = new Image(); i.src = `art/robot_${n}.webp?v=1`; return i; }, I = {bot: img('bot'), wall: img('wall'), paint: img('paint'), floor: img('floor')};
      const paint = st => { const f = lv.fields[field], C = Math.min(64, Math.floor(520 / f.w)); cv.width = f.w * C; cv.height = f.h * C; const walls = new Set(f.walls.map(w => w.join(','))), want = new Set(f.paint.map(c => c.join(',')));
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { const k = x + ',' + y, px = x * C, py = y * C, ok = i => i.complete && i.naturalWidth;
          if (walls.has(k)) { if (ok(I.wall)) g.drawImage(I.wall, px, py, C, C); else { g.fillStyle = '#3a3f55'; g.fillRect(px, py, C, C); } continue; }
          if (ok(I.floor)) g.drawImage(I.floor, px, py, C, C); else { g.fillStyle = '#1a2238'; g.fillRect(px, py, C, C); }
          if (want.has(k)) { g.strokeStyle = 'rgba(127,227,200,.8)'; g.lineWidth = 3; g.setLineDash([6, 4]); g.strokeRect(px + 4, py + 4, C - 8, C - 8); g.setLineDash([]); }
          if (st && st.painted.has(k)) { if (ok(I.paint)) g.drawImage(I.paint, px + 2, py + 2, C - 4, C - 4); else { g.fillStyle = '#4aa8ff'; g.fillRect(px + 6, py + 6, C - 12, C - 12); } } }
        const [rx, ry] = st ? [st.x, st.y] : f.start; if (I.bot.complete && I.bot.naturalWidth) g.drawImage(I.bot, rx * C + 4, ry * C + 4, C - 8, C - 8); else { g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(rx * C + C / 2, ry * C + C / 2, C * 0.35, 0, 7); g.fill(); } };
      const go = button('▶ Выполнить', 'lab-main', () => { clearInterval(timer); const r = check(lv, ed.value); if (r.field !== undefined) field = r.field; const frames = []; try { robot(parse(ed.value), lv.fields[field], s => frames.push(s)); } catch {} let k = 0;
        timer = setInterval(() => { if (k >= frames.length) { clearInterval(timer); if (!frames.length) paint(null); done(r); return; } paint(frames[k++]); }, 160); }); go.dataset.act = 'run';
      const cols = el('div', 'lab-cols'), l = el('div', 'lab-panel'), r = el('div', 'lab-panel');
      l.append(el('h3', '', lv.fields.length > 1 ? 'Поле (программа проверяется на всех полях задачи)' : 'Поле: пунктиром — клетки, которые нужно закрасить'), cv, go, msg); r.append(el('h3', '', 'Программа'), ed, el('p', 'lab-note', `Три звезды — не длиннее ${lv.par} команд. Цикл «пока» считается одной командой плюс всё внутри.`)); cols.append(l, r); host.append(task, cols);
      Object.values(I).forEach(i => i.addEventListener('load', () => paint(null))); paint(null); if (api.debugHost) window.labSet = t => { ed.value = t; };
    } else {
      const ed = el('textarea', 'ex-code'); ed.spellcheck = false; ed.rows = 6; ed.value = lv.kind === 'turtle' ? 'вперёд 100\nнаправо 90\n' : 'опустить перо\nсместиться на (2, 0)\n'; ed.setAttribute('aria-label', 'Программа');
      const cv = el('canvas', 'ex-canvas'); cv.width = 520; cv.height = 420; const g = cv.getContext('2d');
      const paint = (segs, k = 1) => { const all = [...lv.target].map(s => s.split('|').map(p => p.split(',').map(Number))), xs = all.flatMap(s => [s[0][0], s[1][0]]).concat(segs.flatMap(s => [s[0], s[2]]), [0]), ys = all.flatMap(s => [s[0][1], s[1][1]]).concat(segs.flatMap(s => [s[1], s[3]]), [0]);
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys), sc = Math.min(440 / Math.max(1, maxX - minX), 340 / Math.max(1, maxY - minY)), X = x => 40 + (x - minX) * sc, Y = y => 380 - (y - minY) * sc;
        g.fillStyle = '#0b1226'; g.fillRect(0, 0, cv.width, cv.height); g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; if (lv.kind === 'plotter') for (let x = Math.floor(minX); x <= maxX; x++) for (let y = Math.floor(minY); y <= maxY; y++) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(X(x) - 1.5, Y(y) - 1.5, 3, 3); }
        g.strokeStyle = 'rgba(127,227,200,.35)'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); for (const s of all) { g.moveTo(X(s[0][0]), Y(s[0][1])); g.lineTo(X(s[1][0]), Y(s[1][1])); } g.stroke();
        const n = Math.round(segs.length * k); g.strokeStyle = '#ffd34d'; g.lineWidth = 4; g.beginPath(); for (const s of segs.slice(0, n)) { g.moveTo(X(s[0]), Y(s[1])); g.lineTo(X(s[2]), Y(s[3])); } g.stroke(); };
      const go = button('▶ Выполнить', 'lab-main', () => { clearInterval(timer); const r = check(lv, ed.value); if (!r.segs) { let segs = []; try { segs = draw(parse(ed.value), lv.kind); } catch {} paint(segs); done(r); return; } let k = 0; timer = setInterval(() => { k = Math.min(1, k + 0.08); paint(r.segs, k); if (k >= 1) { clearInterval(timer); done(r); } }, 50); }); go.dataset.act = 'run';
      const cols = el('div', 'lab-cols'), l = el('div', 'lab-panel'), r = el('div', 'lab-panel');
      l.append(el('h3', '', 'Рисунок: бирюзовым — образец, жёлтым — твой'), cv, go, msg); r.append(el('h3', '', 'Программа'), ed, el('p', 'lab-note', `Повтор считается одной командой плюс всё внутри. Три звезды — не длиннее ${lv.par} команд.`)); cols.append(l, r); host.append(task, cols); paint([]);
      if (api.debugHost) window.labSet = t => { ed.value = t; };
    }
    return () => clearInterval(timer);
  }
  // Образцовые решения не в разборе текста, поэтому для уровней с координатами в образце берём сам образец.
  const solve = lv => KIND[lv.kind] ? lv.refList.slice() : lv.ref;  // Робот, Черепаха и Чертёжник: образцовый текст программы
  LAB.register({id: 'executors', bg: 'bg_executors', title: 'Исполнители', genre: 'алгоритмы и исполнители', art: '🐢', color: '#7fd45a', unit: 'Задача', minutes: 45,
    about: 'Знакомые по учебнику исполнители в новом виде: Кузнечик прыгает по числовой прямой, Водолей переливает воду, Вычислитель и Удвоитель превращают числа, Редактор правит строки, Робот закрашивает клетки, Черепаха и Чертёжник рисуют по программе с повторами.',
    levels: grade => grade <= 7 ? LEVELS.filter(l => l.kind !== 'editor') : LEVELS, mount, check, solve, LEVELS, shortest, parse, parseEd, runEd});
})();
