// «Черепаха»: исполнитель из задания 6 ЕГЭ. Программа на Python (forward/back, left/right, penup/pendown, циклы for)
// рисует линии на клетчатой плоскости. Задачи: нарисовать фигуру по образцу, посчитать точки с целыми координатами внутри
// фигуры (а в 10–11 классах — внутри объединения и пересечения двух фигур), исправить ошибку, сократить программу циклом.
// Рисунки сравниваются как множества отрезков, поэтому засчитывается любая равносильная программа (другой обход, повторные линии).
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const PY = () => globalThis.CodeHero || (typeof require === 'function' ? require('../../codehero/core.js') : null);
  const STEP_LIMIT = 2000, FAR = 400, EPS = 1e-7;
  const int = (r, a, b) => a + Math.floor(r() * (b - a + 1)), pick = (r, list) => list[Math.floor(r() * list.length)];
  const snap = v => Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v;
  const cosd = a => { const m = ((a % 360) + 360) % 360; return m === 0 ? 1 : m === 90 || m === 270 ? 0 : m === 180 ? -1 : Math.cos(m * Math.PI / 180); };
  const sind = a => cosd(a - 90);

  /* ---------- выполнение программы черепахи ---------- */
  // Строки import/from turtle пропускаем (номера строк сохраняются), остальное выполняет интерпретатор «Героя кода».
  const clean = code => String(code).replace(/\r/g, '').split('\n').map(s => /^\s*(import\s+turtle\b|from\s+turtle\s+import\b)/.test(s) ? '' : s).join('\n');
  const msgOf = e => (e && e.line ? `строка ${e.line}: ` : '') + String(e && e.message || e).replace(/ Если это команда героя, пишите hero\.(\S+?)\(\)\./, ' Чтобы выполнить команду, добавьте скобки: $1().').replace(/герой/g, 'черепаха');
  // draw(code, {segs, trace}) → {segs, strokes, figs, x, y, h}. Отрезки — [x1, y1, x2, y2]; strokes — непрерывные линии с опущенным хвостом;
  // figs — замкнутые линии (многоугольники), по ним считаются точки внутри.
  function draw(code, opt = {}) {
    const H = PY(); if (!H) throw new Error('интерпретатор Python не загрузился');
    const st = {x: 0, y: 0, h: 90, pen: true}, segs = opt.segs || [], strokes = []; let cur = null, steps = 0;
    const num = (name, args, line) => { if (args.length !== 1 || typeof args[0] !== 'number' || !Number.isFinite(args[0])) throw new H.PyError(`${name} ждёт одно число в скобках, например ${name}(5).`, line); return args[0]; };
    const none = (name, args, line) => { if (args.length) throw new H.PyError(`${name}() пишется с пустыми скобками.`, line); };
    const act = (name, fn) => ({builtin: name, call: (args, line) => { if (++steps > STEP_LIMIT) throw new H.PyError(`Черепаха выполнила больше ${STEP_LIMIT} команд — похоже, цикл не заканчивается.`, line); fn(name, args, line); opt.trace && opt.trace({x: st.x, y: st.y, h: st.h, pen: st.pen, n: segs.length}); return null; }});
    const move = sign => (name, args, line) => { const d = sign * num(name, args, line), x = snap(st.x + d * cosd(st.h)), y = snap(st.y + d * sind(st.h));
      if (Math.abs(x) > FAR || Math.abs(y) > FAR) throw new H.PyError('Черепаха ушла слишком далеко от начала координат.', line);
      if (st.pen && d !== 0) { segs.push([st.x, st.y, x, y]); if (!cur) { cur = [[st.x, st.y]]; strokes.push(cur); } cur.push([x, y]); }
      st.x = x; st.y = y; };
    const turn = sign => (name, args, line) => { st.h = st.h - sign * num(name, args, line); };
    const pen = down => (name, args, line) => { none(name, args, line); st.pen = down; if (!down) cur = null; };
    const noop = {builtin: 'noop', call: () => null};
    const cmds = {};
    for (const n of ['forward', 'fd', 'вперёд', 'вперед']) cmds[n] = act(n, move(1));
    for (const n of ['back', 'backward', 'bk', 'назад']) cmds[n] = act(n, move(-1));
    for (const n of ['right', 'rt', 'направо']) cmds[n] = act(n, turn(1));
    for (const n of ['left', 'lt', 'налево']) cmds[n] = act(n, turn(-1));
    for (const n of ['penup', 'pu', 'up', 'поднять_хвост']) cmds[n] = act(n, pen(false));
    for (const n of ['pendown', 'pd', 'down', 'опустить_хвост']) cmds[n] = act(n, pen(true));
    for (const n of ['done', 'speed', 'tracer', 'hideturtle', 'showturtle', 'ht', 'st', 'screensize', 'mainloop', 'exitonclick']) cmds[n] = noop;
    // Можно писать и по-питоновски: import turtle / turtle.forward(5) / t = turtle.Turtle().
    const obj = {title: 'черепахи', members: cmds}; cmds.Turtle = {builtin: 'Turtle', call: () => obj}; cmds.Screen = {builtin: 'Screen', call: () => obj};
    const it = H.run(H.parse(clean(code)), Object.assign({turtle: obj}, cmds), {ops: 20000}); for (const _ of it) {}
    const near = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
    const figs = strokes.filter(s => s.length >= 4 && near(s[0], s[s.length - 1]));
    return {segs, strokes, figs, x: st.x, y: st.y, h: st.h, steps};
  }

  /* ---------- сравнение рисунков ---------- */
  // Отрезки раскладываются по прямым, на каждой прямой перекрывающиеся куски склеиваются. Два рисунка совпадают, если совпадают ключи.
  const R = v => String(Math.round(v * 1e3) / 1e3 + 0);
  function lines(segs) {
    const by = new Map();
    for (const [x1, y1, x2, y2] of segs) { let dx = x2 - x1, dy = y2 - y1; const L = Math.hypot(dx, dy); if (L < 1e-9) continue; dx /= L; dy /= L; if (dx < -1e-9 || (Math.abs(dx) <= 1e-9 && dy < 0)) { dx = -dx; dy = -dy; }
      const key = [dx, dy, x1 * dy - y1 * dx].map(R).join(','); let a = x1 * dx + y1 * dy, b = x2 * dx + y2 * dy; if (a > b) [a, b] = [b, a]; if (!by.has(key)) by.set(key, []); by.get(key).push([a, b]); }
    const out = [];
    for (const [key, iv] of by) { iv.sort((p, q) => p[0] - q[0]); const m = []; for (const [a, b] of iv) { const last = m[m.length - 1]; if (last && a <= last[1] + 1e-6) last[1] = Math.max(last[1], b); else m.push([a, b]); } for (const [a, b] of m) out.push({key, a, b}); }
    return out;
  }
  const shapeKey = segs => lines(segs).map(l => `${l.key}:${R(l.a)}..${R(l.b)}`).sort().join(';');
  const inkLength = segs => lines(segs).reduce((s, l) => s + l.b - l.a, 0);

  /* ---------- точки внутри ---------- */
  function onSeg(px, py, [x1, y1, x2, y2]) { const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy; if (!L2) return false; const t = ((px - x1) * dx + (py - y1) * dy) / L2; if (t < -1e-9 || t > 1 + 1e-9) return false; const cx = x1 + t * dx - px, cy = y1 + t * dy - py; return cx * cx + cy * cy < 1e-12; }
  function winding(px, py, poly) { let w = 0; for (let i = 0; i + 1 < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[i + 1], c = (bx - ax) * (py - ay) - (px - ax) * (by - ay); if (ay <= py) { if (by > py && c > 0) w++; } else if (by <= py && c < 0) w--; } return w; }
  const edgesOf = poly => poly.slice(1).map((p, i) => [poly[i][0], poly[i][1], p[0], p[1]]);
  // Сколько целых точек внутри: op 'or' — объединение фигур, 'and' — пересечение; edges — считать ли точки на границе.
  // Без границ точка, лежащая на любой нарисованной линии, не считается (как в формулировках ЕГЭ).
  function interior(res, op = 'or', edges = false) {
    if (!res.figs.length) return 0;
    const xs = res.segs.flatMap(s => [s[0], s[2]]), ys = res.segs.flatMap(s => [s[1], s[3]]), fe = res.figs.map(edgesOf); let n = 0;
    for (let x = Math.ceil(Math.min(...xs) - 1e-9); x <= Math.floor(Math.max(...xs) + 1e-9); x++) for (let y = Math.ceil(Math.min(...ys) - 1e-9); y <= Math.floor(Math.max(...ys) + 1e-9); y++) {
      if (!edges && res.segs.some(s => onSeg(x, y, s))) continue;
      const ins = res.figs.map((f, i) => (edges && fe[i].some(s => onSeg(x, y, s))) || winding(x, y, f) !== 0);
      if (op === 'and' ? ins.every(Boolean) : ins.some(Boolean)) n++; }
    return n;
  }

  /* ---------- уровни ---------- */
  const loop = (n, body, v = 'i') => [`for ${v} in range(${n}):`, ...body.flat().map(s => '    ' + s)];
  const prog = (...parts) => parts.flat().join('\n');
  const rect = (a, b, t = 'right') => loop(2, [`forward(${a})`, `${t}(90)`, `forward(${b})`, `${t}(90)`]);
  const jump = (up, side) => ['penup()', up >= 0 ? `forward(${up})` : `back(${-up})`, 'right(90)', side >= 0 ? `forward(${side})` : `back(${-side})`, 'left(90)', 'pendown()'];
  const codeLines = code => clean(code).split('\n').filter(s => s.trim() && !s.trim().startsWith('#')).length;
  // Испорченная программа для уровней «исправь»: перебираем поломки, пока рисунок не станет другим.
  function breakIt(r, code, bugs) { const key = shapeKey(draw(code).segs), start = Math.floor(r() * bugs.length);
    for (let k = 0; k < bugs.length; k++) { const [bad, why] = bugs[(start + k) % bugs.length]; let segs = []; try { segs = draw(bad).segs; } catch { continue; } if (shapeKey(segs) !== key) return {start: bad, bug: why}; }
    throw new Error('не удалось испортить программу'); }

  const L = (kind, title, make) => ({kind, title, make});
  const BASE = [
    L('draw', 'Квадрат', r => { const a = int(r, 3, 6), t = pick(r, ['right', 'left']); return {code: prog(loop(4, [`forward(${a})`, `${t}(90)`])), brief: `Нарисуй квадрат со стороной ${a} — как пунктирный образец на сетке. Используй цикл for.`}; }),
    L('draw', 'Прямоугольник', r => { const a = int(r, 2, 5), b = a + int(r, 2, 4), t = pick(r, ['right', 'left']); return {code: prog(rect(a, b, t)), brief: `Нарисуй прямоугольник высотой ${a} и шириной ${b} — как образец на сетке. Подсказка: в цикле повторяются две стороны и два поворота.`}; }),
    L('count', 'Точки внутри', r => { const a = int(r, 3, 8), b = int(r, 4, 9), t = pick(r, ['right', 'left']); return {code: prog(rect(a, b, t)), brief: 'Черепаха выполнила программу. Сколько точек с целыми координатами лежит внутри получившейся фигуры? Точки на линиях не считаются.'}; }),
    L('fix', 'Найди ошибку', r => { const a = int(r, 2, 4), b = a + int(r, 2, 4), code = prog(rect(a, b));
      return {code, ...breakIt(r, code, [[prog(loop(1, [`forward(${a})`, 'right(90)', `forward(${b})`, 'right(90)'])), 'цикл'], [prog(loop(2, [`forward(${a})`, 'right(90)', `forward(${b})`, 'left(90)'])), 'поворот'], [prog(loop(2, [`forward(${a})`, 'right(60)', `forward(${b})`, 'right(90)'])), 'угол'], [prog(loop(2, [`forward(${a})`, 'right(90)', `forward(${a})`, 'right(90)'])), 'сторона']]),
        brief: `Программа должна рисовать прямоугольник высотой ${a} и шириной ${b}, но в ней ошибка. Найди и исправь её.`}; }),
    L('short', 'Лесенка', r => { const k = int(r, 3, 5), s = int(r, 1, 2); return {code: prog(loop(k, [`forward(${s})`, 'right(90)', `forward(${s})`, 'left(90)'])), brief: `Нарисуй лесенку из ${k} ступенек высотой и шириной ${s}. Три звезды — за программу не длиннее 5 строк: используй цикл.`}; }),
    L('count', 'Уголок', r => { const h = int(r, 5, 8), t = int(r, 2, 3), w1 = int(r, 2, 4), w2 = int(r, 3, 5);
      return {code: prog(`forward(${h})`, 'right(90)', `forward(${w1})`, 'right(90)', `forward(${h - t})`, 'left(90)', `forward(${w2})`, 'right(90)', `forward(${t})`, 'right(90)', `forward(${w1 + w2})`), brief: 'Сколько точек с целыми координатами лежит внутри фигуры-уголка? Точки на линиях не считаются.'}; }),
    L('fix', 'Хвост поднят', r => { const s = int(r, 2, 4), g = int(r, 1, 3), sq = loop(4, [`forward(${s})`, 'right(90)']), code = prog(sq, 'penup()', 'right(90)', `forward(${s + g})`, 'left(90)', 'pendown()', sq);
      return {code, ...breakIt(r, code, [[prog(sq, 'penup()', 'right(90)', `forward(${s + g})`, 'left(90)', sq), 'хвост'], [prog(sq, 'penup()', 'pendown()', 'right(90)', `forward(${s + g})`, 'left(90)', sq), 'рано'], [prog(sq, 'penup()', 'right(90)', `forward(${s + g})`, 'right(90)', 'pendown()', sq), 'поворот']]),
        brief: `Нужно нарисовать два квадрата со стороной ${s} на расстоянии ${g} друг от друга, без линии между ними. Исправь программу: подними и опусти хвост в нужных местах.`}; }),
    L('short', 'Ряд квадратов', r => { const n = int(r, 3, 5), s = int(r, 2, 3); return {code: prog(loop(n, [loop(4, [`forward(${s})`, 'right(90)'], 'j'), 'right(90)', `forward(${s})`, 'left(90)'], 'k')), brief: `Нарисуй ряд из ${n} квадратов со стороной ${s}, стоящих вплотную. Три звезды — за программу не длиннее 7 строк: цикл в цикле.`}; }),
  ];
  // Две фигуры с перекрытием: прямоугольник в начале координат и второй, сдвинутый с поднятым хвостом.
  function twoRects(r) { const a = int(r, 4, 8), b = int(r, 4, 9), c = int(r, 1, a - 2), d = int(r, 1, b - 2), e = a - c + int(r, 1, 4), f = b - d + int(r, 1, 4); return prog(rect(a, b), jump(c, d), rect(e, f)); }
  const HARD = [
    L('draw', 'Треугольник', r => { const a = int(r, 4, 8), t = pick(r, ['right', 'left']); return {code: prog(loop(3, [`forward(${a})`, `${t}(120)`])), brief: `Нарисуй равносторонний треугольник со стороной ${a}, как образец. Подумай, на какой угол поворачивает черепаха в вершине.`}; }),
    L('short', 'Шестиугольник', r => { const a = int(r, 3, 5), t = pick(r, ['right', 'left']); return {code: prog(loop(6, [`forward(${a})`, `${t}(60)`])), brief: `Нарисуй правильный шестиугольник со стороной ${a}. Три звезды — за программу из 3 строк.`}; }),
    L('count', 'Точки в треугольнике', r => { const a = int(r, 8, 14), r0 = pick(r, [0, 30]); return {code: prog(r0 ? [`right(${r0})`] : [], loop(3, [`forward(${a})`, 'right(120)'])), brief: 'Сколько точек с целыми координатами лежит внутри треугольника? Точки на линии не считаются. Обрати внимание: стороны наклонные.'}; }),
    L('count', 'Объединение', r => ({code: twoRects(r), op: 'or', brief: 'Сколько точек с целыми координатами лежит внутри объединения двух фигур? Точки на линиях не учитываются.'})),
    L('count', 'Пересечение', r => ({code: twoRects(r), op: 'and', edges: true, brief: 'Сколько точек с целыми координатами лежит в пересечении двух фигур, включая точки на границах?'})),
    L('fix', 'Восьмиугольник', r => { const a = int(r, 3, 5), code = prog(loop(8, [`forward(${a})`, 'right(45)']));
      return {code, ...breakIt(r, code, [[prog(loop(6, [`forward(${a})`, 'right(45)'])), 'цикл'], [prog(loop(8, [`forward(${a})`, 'right(40)'])), 'угол'], [prog(loop(8, [`forward(${a})`]), 'right(45)'), 'отступ']]),
        brief: `Программа должна рисовать правильный восьмиугольник со стороной ${a}. Найди ошибку и исправь её.`}; }),
    L('count', 'Треугольник и прямоугольник', r => { for (;;) { const a = int(r, 10, 14), c = int(r, 1, 4), d = int(r, 1, 4), e = int(r, 4, 8), f = int(r, 4, 9), tri = loop(3, [`forward(${a})`, 'right(120)']), code = prog(tri, jump(c, d), rect(e, f));
        const both = interior(draw(code), 'and'), one = Math.min(interior(draw(prog(tri))), interior(draw(prog(jump(c, d), rect(e, f)))));
        if (both >= 3 && both < one) return {code, op: 'and', brief: 'Сколько точек с целыми координатами лежит внутри обеих фигур сразу (в их пересечении)? Точки на линиях не учитываются.'}; } }),
    L('short', 'Звезда', r => { const a = int(r, 6, 10); return {code: prog(loop(5, [`forward(${a})`, 'right(144)'])), brief: `Нарисуй пятиконечную звезду с лучами длиной ${a}. Каждая вершина — острый угол в 36°. Три звезды — за 3 строки.`}; }),
  ];
  BASE.forEach((l, i) => { l.no = i; l.hard = false; }); HARD.forEach((l, i) => { l.no = i; l.hard = true; });

  // Данные уровня по зерну: образцовая программа, её рисунок, ответ.
  function task(lv, seed) {
    const t = lv.make(rng(seed * 131 + lv.no * 29 + (lv.hard ? 1000 : 0))), ref = draw(t.code);
    t.segs = ref.segs; t.key = shapeKey(ref.segs); t.ref = ref; t.par = codeLines(t.code);
    if (lv.kind === 'count') t.answer = interior(ref, t.op || 'or', !!t.edges);
    return t;
  }
  function check(lv, ans) {
    if (!ans || !Number.isInteger(ans.seed)) return {ok: false, msg: 'Нет ответа.'};
    const t = task(lv, ans.seed);
    if (lv.kind === 'count') { const v = String(ans.answer == null ? '' : ans.answer).trim(); if (!/^-?\d+$/.test(v)) return {ok: false, msg: 'Введи ответ — целое число.'};
      return Number(v) === t.answer ? {ok: true, stars: 3, msg: `Верно: ${t.answer}.`} : {ok: false, msg: 'Неверно. Запусти программу и пересчитай точки — внимательно с точками на линиях.'}; }
    if (typeof ans.code !== 'string' || !ans.code.trim()) return {ok: false, msg: 'Напиши программу.'};
    let res; try { res = draw(ans.code); } catch (e) { return {ok: false, msg: msgOf(e)}; }
    if (!res.segs.length) return {ok: false, msg: 'Черепаха ничего не нарисовала: хвост был поднят или шагов не было.'};
    if (shapeKey(res.segs) !== t.key) { const a = inkLength(res.segs), b = inkLength(t.segs); return {ok: false, msg: 'Рисунок не совпадает с образцом' + (Math.abs(a - b) > 1e-6 ? ` (линий нарисовано на ${R(Math.abs(a - b))} клет. ${a > b ? 'больше' : 'меньше'}).` : ': линии стоят не там.')}; }
    const n = codeLines(ans.code), stars = lv.kind === 'short' ? (n <= t.par ? 3 : n <= t.par + 2 ? 2 : 1) : 3;
    return {ok: true, stars, lines: n, msg: lv.kind === 'short' ? `Рисунок совпал. Строк в программе: ${n}, рекорд — ${t.par}.` : 'Рисунок совпал с образцом!'};
  }
  const solve = lv => { const t = task(lv, 1); return lv.kind === 'count' ? {seed: 1, answer: t.answer} : {seed: 1, code: t.code}; };

  /* ---------- страница ---------- */
  const CSS = `.tu-canvas{display:block;width:100%;height:auto;max-height:60vh;object-fit:contain;border-radius:12px;background:#0d1530;border:1px solid #33466e}
.tu-legend{display:flex;gap:6px 16px;flex-wrap:wrap;font-size:13px;color:#9fb2d6;margin:8px 0}.tu-legend span{display:inline-flex;align-items:center;gap:6px}.tu-legend i{display:inline-block;width:24px;border-top:3px solid #7fe3c8}.tu-legend i.tu-dash{border-top:3px dashed #ffd34d}
.tu-help{font-size:13px;color:#9fb2d6;line-height:1.5;margin:6px 0 0}.tu-help code{color:#ffd34d;font-family:ui-monospace,monospace}
.tu-prog{font:15px/1.5 ui-monospace,monospace;background:#121b33;border:2px solid #34466e;border-radius:10px;padding:10px 12px;color:#e6edf9;max-height:330px;overflow:auto;white-space:pre;margin:0 0 10px}
.tu-ed{width:100%;min-height:230px;font:15px/1.5 ui-monospace,monospace;padding:10px;border-radius:10px;border:2px solid #34466e;background:#121b33;color:#e6edf9;resize:vertical;tab-size:4}
.tu-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}.tu-row input{font:18px ui-monospace,monospace;width:8em;padding:8px 10px;border-radius:10px;border:2px solid #34466e;background:#121b33;color:#e6edf9}
@media(max-height:760px) and (min-width:901px){.tu-canvas{max-height:52vh}.tu-ed{min-height:190px}.tu-prog{max-height:260px}}
@media(max-width:560px){.tu-row input{flex:1 1 100%;width:100%}.tu-row button{flex:1 1 auto}.tu-prog,.tu-ed{font-size:14px}}`;
  function mount(host, lv, api) {
    const {el, button} = api;
    if (!document.getElementById('tu-style')) { const s = el('style'); s.id = 'tu-style'; s.textContent = CSS; document.head.append(s); }
    let seed = Math.floor(Math.random() * 1e6), t = task(lv, seed), tries = 0, timer = 0, view = null; const count = lv.kind === 'count';
    const task0 = el('div', 'lab-task'), brief = el('p'), msg = el('p', 'lab-msg'), cv = el('canvas', 'tu-canvas'), g = cv.getContext('2d'); cv.width = 640; cv.height = 480;
    const help = el('p', 'tu-help'); help.innerHTML = 'Команды: <code>forward(n)</code>, <code>back(n)</code>, <code>right(угол)</code>, <code>left(угол)</code>, <code>penup()</code>, <code>pendown()</code> (или по-русски: <code>вперёд</code>, <code>назад</code>, <code>направо</code>, <code>налево</code>, <code>поднять_хвост</code>, <code>опустить_хвост</code>). Черепаха стоит в точке (0, 0), смотрит вверх, хвост опущен. Один шаг — одна клетка.';
    task0.append(el('h2', '', lv.title), brief, help);
    const START = {x: 0, y: 0, h: 90, pen: true, n: 0};
    const fit = (...lists) => { const pts = [[0, 0]]; for (const l of lists) for (const s of l) pts.push([s[0], s[1]], [s[2], s[3]]); const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      let x0 = Math.floor(Math.min(...xs)) - 1, x1 = Math.ceil(Math.max(...xs)) + 1, y0 = Math.floor(Math.min(...ys)) - 1, y1 = Math.ceil(Math.max(...ys)) + 1;
      const cap = v => Math.max(-60, Math.min(60, v)); x0 = cap(x0); x1 = cap(x1); y0 = cap(y0); y1 = cap(y1); while (x1 - x0 < 8) { x0--; x1++; } while (y1 - y0 < 6) { y0--; y1++; } return {x0, x1, y0, y1}; };
    function render(segs, tu) {
      const W = cv.width, Hh = cv.height, {x0, x1, y0, y1} = view, C = Math.min((W - 40) / (x1 - x0), (Hh - 40) / (y1 - y0)), ox = (W - C * (x1 - x0)) / 2 - x0 * C, oy = (Hh + C * (y1 - y0)) / 2 + y0 * C, X = x => ox + x * C, Y = y => oy - y * C;
      g.fillStyle = '#0d1530'; g.fillRect(0, 0, W, Hh); g.lineWidth = 1;
      for (let x = x0; x <= x1; x++) { g.strokeStyle = x === 0 ? '#4a6aa8' : '#1f2d52'; g.beginPath(); g.moveTo(X(x), Y(y0)); g.lineTo(X(x), Y(y1)); g.stroke(); }
      for (let y = y0; y <= y1; y++) { g.strokeStyle = y === 0 ? '#4a6aa8' : '#1f2d52'; g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X(x1), Y(y)); g.stroke(); }
      if (C >= 9) { g.fillStyle = '#6f84b3'; for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { g.beginPath(); g.arc(X(x), Y(y), C >= 20 ? 2.2 : 1.5, 0, 7); g.fill(); } }
      g.fillStyle = '#9fb2d6'; g.font = '12px system-ui,sans-serif'; const step = Math.max(1, Math.ceil(28 / C));
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) g.fillText(String(x), X(x) + 3, Math.min(Hh - 4, Math.max(14, Y(0) + 14)));
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) if (y) g.fillText(String(y), Math.min(W - 24, Math.max(3, X(0) + 4)), Y(y) - 3);
      g.lineCap = 'round';
      if (!count) { g.strokeStyle = 'rgba(255,211,77,.75)'; g.lineWidth = 3; g.setLineDash([7, 6]); g.beginPath(); for (const s of t.segs) { g.moveTo(X(s[0]), Y(s[1])); g.lineTo(X(s[2]), Y(s[3])); } g.stroke(); g.setLineDash([]); }
      g.strokeStyle = '#7fe3c8'; g.lineWidth = 3.5; g.beginPath(); for (const s of segs) { g.moveTo(X(s[0]), Y(s[1])); g.lineTo(X(s[2]), Y(s[3])); } g.stroke();
      g.save(); g.translate(X(tu.x), Y(tu.y)); g.rotate(-tu.h * Math.PI / 180); const z = Math.max(9, Math.min(16, C * 0.6));
      g.fillStyle = '#3d8b5a'; g.beginPath(); g.arc(z * 0.95, 0, z * 0.32, 0, 7); g.fill();
      g.fillStyle = tu.pen ? '#5fd38d' : '#2c5a40'; g.strokeStyle = '#d8ffe6'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, z * 0.75, z * 0.6, 0, 0, 7); g.fill(); g.stroke(); g.restore();
    }
    function play(code, done) {
      clearInterval(timer); const frames = [], segs = []; let err = '';
      try { draw(code, {segs, trace: s => frames.push(s)}); } catch (e) { err = msgOf(e); }
      view = fit(t.segs, segs); let k = 0; const per = Math.max(1, Math.ceil(frames.length / 80));
      const tick = () => { k = Math.min(frames.length, k + per); const f = frames[k - 1] || START; render(segs.slice(0, f.n), f); if (k >= frames.length) { clearInterval(timer); done(err, segs); } };
      timer = setInterval(tick, 40); tick();
    }
    const say = (text, cls) => { msg.textContent = text; msg.className = 'lab-msg' + (cls ? ' ' + cls : ''); };
    const stars = () => tries === 1 ? 3 : tries <= 3 ? 2 : 1;
    const cols = el('div', 'lab-cols'), left = el('div', 'lab-panel'), right = el('div', 'lab-panel'), legend = el('div', 'tu-legend');
    const leg = (cls, text) => { const s = el('span'), i = el('i', cls); s.append(i, text); return s; };
    legend.append(...(count ? [] : [leg('tu-dash', 'образец')]), leg('', 'рисунок черепахи'));
    let refresh;
    if (count) {
      const code = el('pre', 'tu-prog'), inp = el('input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.placeholder = 'число точек'; inp.setAttribute('aria-label', 'Ответ: число точек');
      const runB = button('▶ Запустить программу', 'lab-small', () => play(t.code, err => say(err || 'Фигура нарисована. Посчитай точки — они отмечены на пересечениях линий сетки.', err ? 'bad' : ''))); runB.dataset.act = 'draw';
      const go = button('Проверить ответ', 'lab-main', () => { const r = check(lv, {seed, answer: inp.value}); if (!/^-?\d+$/.test(inp.value.trim())) { say(r.msg, 'bad'); return; } tries++; say(r.msg, r.ok ? 'good' : 'bad'); if (r.ok) api.finish(stars(), r.msg); }); go.dataset.act = 'run';
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); });
      const row = el('div', 'tu-row'); row.append(inp, go);
      left.append(cv, legend, runB); right.append(el('h3', '', 'Программа черепахи'), code, row, msg);
      refresh = () => { code.textContent = t.code; brief.textContent = t.brief; view = fit(t.segs); render([], START); };
      if (api.debugHost) window.labSet = a => { if (a && typeof a === 'object') { seed = a.seed; t = task(lv, seed); refresh(); inp.value = String(a.answer); } else inp.value = String(a); };
    } else {
      const ed = el('textarea', 'tu-ed'); ed.spellcheck = false; ed.rows = 10; ed.setAttribute('aria-label', 'Программа черепахи');
      ed.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const p = ed.selectionStart; ed.setRangeText('    ', p, ed.selectionEnd, 'end'); } });
      const runB = button('▶ Нарисовать', 'lab-small', () => play(ed.value, (err, segs) => say(err || (!segs.length ? 'Черепаха ничего не нарисовала.' : shapeKey(segs) === t.key ? 'Рисунок совпадает с образцом — нажми «Проверить».' : 'Рисунок пока не совпадает с пунктиром.'), err || shapeKey(segs) !== t.key ? 'bad' : 'good'))); runB.dataset.act = 'draw';
      const go = button('Проверить', 'lab-main', () => { if (!codeLines(ed.value)) { say('Сначала напиши программу.', 'bad'); return; } tries++; const r = check(lv, {seed, code: ed.value}); play(ed.value, () => {}); say(r.msg, r.ok ? 'good' : 'bad'); if (r.ok) { clearInterval(timer); api.finish(Math.min(r.stars, stars()), r.msg); } }); go.dataset.act = 'run';
      const row = el('div', 'tu-row'); row.append(runB, go);
      left.append(cv, legend); right.append(el('h3', '', lv.kind === 'short' ? `Программа (рекорд — ${t.par} строк)` : 'Программа (Python)'), ed, row, msg);
      refresh = () => { brief.textContent = t.brief; right.querySelector('h3').textContent = lv.kind === 'short' ? `Программа (рекорд — ${t.par} строк)` : 'Программа (Python)'; ed.value = lv.kind === 'fix' ? t.start : '# черепаха в точке (0, 0) смотрит вверх\n'; view = fit(t.segs); render([], START); };
      if (api.debugHost) window.labSet = a => { if (a && typeof a === 'object') { seed = a.seed; t = task(lv, seed); refresh(); ed.value = a.code; } else ed.value = String(a); };
    }
    cols.append(left, right); host.append(task0, cols); refresh();
    return () => clearInterval(timer);
  }

  LAB.register({id: 'turtle', bg: 'bg_executors', title: 'Черепаха', genre: 'исполнитель, ЕГЭ №6', art: '🐢', color: '#5fd38d', unit: 'Задача', minutes: 40,
    about: 'Черепаха рисует по программе на Python: forward, right, penup и циклы for. Нарисуй фигуру по образцу, найди ошибку, сократи программу и посчитай точки внутри фигур — как в задании 6 ЕГЭ.',
    levels: grade => grade >= 10 ? HARD : BASE, mount, check, solve, BASE, HARD, task, draw, interior, shapeKey, codeLines});
})();
