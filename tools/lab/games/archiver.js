// «Архиватор»: сжатие данных и префиксные коды (9–11 классы). Робот-архиватор пакует файлы, а ты подсказываешь ему, как записать их короче.
// Темы: кодирование информации, равномерные и неравномерные коды, условие Фано (10 кл. §4 «Обработка информации»), сжатие при хранении и передаче (§5), задание 4 ЕГЭ.
// Уровни: серии RLE (сжать, распаковать, посчитать выгоду), условие Фано, расшифровка и достройка префиксного кода, дерево Хаффмана, задание 4 ЕГЭ.
// Каждый вариант строится из зерна (seed); ответ проверяется независимым пересчётом или перебором, после ошибки — разбор и новый вариант.
// Звёзды: без ошибок — три, одна ошибка — две, больше — одна. Логика (G, check) не трогает страницу: tools/lab/tests/archiver.test.js.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const tl = r => ({ri: (a, b) => a + Math.floor(r() * (b - a + 1)), pick: a => a[Math.floor(r() * a.length)], shuffle: a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }});
  const num = s => { const t = String(s ?? '').trim().replace(',', '.'); return t === '' ? NaN : Number(t); }, fmt = x => String(+x.toFixed(2)).replace('.', ',');
  const pl = (n, a, b, c) => { const m = n % 100, d = n % 10; return m > 10 && m < 20 ? c : d === 1 ? a : d > 1 && d < 5 ? b : c; }, and = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' и ' + a[a.length - 1] : a[0];
  const bit = n => `${n} ${pl(n, 'бит', 'бита', 'бит')}`, lc = s => s[0].toLowerCase() + s.slice(1);
  // Латинские буквы, похожие на русские, считаем русскими: ученик мог набрать ответ не в той раскладке.
  const LAT = {A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У'}, up = s => String(s ?? '').toUpperCase().replace(/[ABCEHKMOPTXY]/g, c => LAT[c]);
  const LET = [...'АБВГДЕЖ'], COL = {Б: ['#f2f5fb', 'белый'], Ч: ['#1a2035', 'чёрный'], К: ['#ff5a5a', 'красный'], С: ['#4a8cff', 'синий'], Ж: ['#ffd34d', 'жёлтый'], Ф: ['#a77bff', 'фиолетовый']};

  /* ---------- RLE: серия одинаковых символов → пара «сколько раз — какой символ» ---------- */
  const runsOf = s => s.match(/(.)\1*/g) || [];
  const rle = (s, cap = Infinity) => runsOf(s).flatMap(g => { const out = []; for (let n = g.length; n > 0; n -= cap) out.push([Math.min(n, cap), g[0]]); return out; });
  const rleText = pairs => pairs.map(([n, c]) => n + c).join(' ');
  const parseRle = s => { const t = up(s).replace(/[\s,;:()·.\-–—]+/g, ''); return /^(\d+[А-ЯЁ])+$/.test(t) ? [...t.matchAll(/(\d+)([А-ЯЁ])/g)].map(m => [Number(m[1]), m[2]]) : null; };
  const runsGen = (r, alpha, n, lo, hi) => { const {ri, pick} = tl(r), out = []; for (let i = 0; i < n; i++) { let c; do c = pick(alpha); while (out.length && c === out[out.length - 1][0]); out.push([c, ri(lo, hi)]); } return out; };
  const str = runs => runs.map(([c, n]) => c.repeat(n)).join('');

  /* ---------- префиксные коды ---------- */
  const fano = codes => codes.every((a, i) => codes.every((b, j) => i === j || !b.startsWith(a)));
  const fits = (set, w) => set.every(c => !c.startsWith(w) && !w.startsWith(c));
  const clash = codes => { const out = []; codes.forEach((a, i) => codes.forEach((b, j) => { if (i !== j && b.startsWith(a) && (a !== b || i < j)) out.push([i, j]); })); return out; };
  const randBits = (r, n) => Array.from({length: n}, () => r() < .5 ? '0' : '1').join('');
  const randCode = (r, n, lo, hi) => { for (;;) { const set = []; for (let g = 0; g < 400 && set.length < n; g++) { const w = randBits(r, lo + Math.floor(r() * (hi - lo + 1))); if (fits(set, w)) set.push(w); } if (set.length === n) return set; } };
  // Свободные ветки дерева кода: вершины, в которые можно поставить новое слово (для разбора).
  const freeRoots = (codes, s = '') => codes.includes(s) ? [] : codes.some(c => c.startsWith(s)) ? [...freeRoots(codes, s + '0'), ...freeRoots(codes, s + '1')] : [s];
  // Перебор: новым буквам подбираются двоичные слова длиной до L — не начало известных кодов и друг друга; w — сколько раз буква входит в сообщение.
  // Ищется наименьшая сумма w·длина: слова перебираются от коротких к длинным, ветви не дешевле найденного отсекаются.
  const search = (known, w) => { const L = Math.max(0, ...known.map(c => c.length)) + w.length + 1, cand = [];
    for (let len = 1; len <= L; len++) for (let v = 0; v < 2 ** len; v++) { const s = v.toString(2).padStart(len, '0'); if (fits(known, s)) cand.push(s); }
    const ord = w.map((_, i) => i).sort((a, b) => w[b] - w[a]), tail = ord.map((_, i) => ord.slice(i).reduce((s, j) => s + w[j], 0)), cur = []; let best = Infinity, words = null;
    const go = (i, cost) => { if (cost + (tail[i] || 0) >= best) return; if (i === ord.length) { best = cost; words = []; ord.forEach((j, q) => { words[j] = cur[q]; }); return; }
      for (const s of cand) if (fits(cur, s)) { cur.push(s); go(i + 1, cost + w[ord[i]] * s.length); cur.pop(); } };
    go(0, 0); return {best, words}; };
  // Кратчайшее слово, а из равных по длине — с наименьшим числовым значением; extra — сколько букв ещё должны получить коды после него.
  const shortest = (known, extra) => { const L = Math.max(...known.map(c => c.length)) + extra + 2;
    for (let len = 1; len <= L; len++) for (let v = 0; v < 2 ** len; v++) { const s = v.toString(2).padStart(len, '0'); if (fits(known, s) && (!extra || search([...known, s], Array(extra).fill(1)).words)) return s; } return null; };
  const list = (ls, cs) => ls.map((l, i) => `${l} — ${cs[i]}`).join(', ');
  const why2 = (L, codes, [i, j]) => `код ${L[i]} (${codes[i]}) — начало кода ${L[j]} (${codes[j]})`;

  /* ---------- Хаффман: каждый раз склеиваем две вершины с наименьшими частотами ---------- */
  const minPair = (t, a, b) => { const ws = t.roots.map(i => t.nodes[i].w).sort((x, y) => x - y), p = [t.nodes[a].w, t.nodes[b].w].sort((x, y) => x - y); return p[0] === ws[0] && p[1] === ws[1]; };
  // Дерево по журналу склеек ученика: склейка не двух наименьших частот — ошибка, она не выполняется (при равных частотах подходит любая пара). Левая ветка (0) — меньшая частота.
  const huff = (w, merges) => { const t = {nodes: w.map((x, i) => ({w: x, leaf: i})), roots: w.map((_, i) => i), miss: 0};
    for (const m of Array.isArray(merges) ? merges.slice(0, 200) : []) { const [a, b] = Array.isArray(m) ? m : [];
      if (a === b || !t.roots.includes(a) || !t.roots.includes(b) || !minPair(t, a, b)) { t.miss++; continue; }
      const ia = t.roots.indexOf(a), ib = t.roots.indexOf(b); t.nodes.push({w: t.nodes[a].w + t.nodes[b].w, kids: t.nodes[b].w < t.nodes[a].w ? [b, a] : [a, b]}); t.roots[Math.min(ia, ib)] = t.nodes.length - 1; t.roots.splice(Math.max(ia, ib), 1); }
    t.done = t.roots.length === 1; t.code = w.map(() => '');
    if (t.done) { const walk = (id, s) => { const nd = t.nodes[id]; if (nd.kids) { walk(nd.kids[0], s + '0'); walk(nd.kids[1], s + '1'); } else t.code[nd.leaf] = s; }; walk(t.roots[0], ''); }
    t.depth = t.code.map(c => c.length); t.total = w.reduce((s, x, i) => s + x * t.depth[i], 0); return t; };
  const huffRef = w => { const merges = []; for (let t = huff(w, []); !t.done; t = huff(w, merges)) { const [a, b] = t.roots.slice().sort((x, y) => t.nodes[x].w - t.nodes[y].w); merges.push([a, b]); } return merges; };
  const steps = t => t.nodes.slice(t.code.length).map(nd => `${t.nodes[nd.kids[0]].w} + ${t.nodes[nd.kids[1]].w} = ${nd.w}`).join(', ');
  // Общая проверка уровней Хаффмана: дерево из журнала склеек, затем ответы на вопросы по этому дереву.
  const huffJudge = (p, a) => { const t = huff(p.w, a && a.merges), tt = t.done ? t : huff(p.w, huffRef(p.w)), want = p.wants(tt), got = ((a && Array.isArray(a.answers)) ? a.answers : []).map(num), ok = t.done && want.every((x, i) => got[i] === x);
    const why = `Склейки: ${steps(tt)}. Коды: ${list(p.letters, tt.code)}. Длина сообщения: ${p.w.map((x, i) => `${x}·${tt.depth[i]}`).join(' + ')} = ${bit(tt.total)}.${p.U ? ` Равномерный код: ${p.letters.length} разных букв → ⌈log₂ ${p.letters.length}⌉ = ${bit(p.b)} на букву, ${p.N} × ${p.b} = ${bit(p.U)}. Экономия: ${p.U} − ${tt.total} = ${bit(p.U - tt.total)}.` : ''}`;
    return {ok, miss: t.miss + (ok ? 0 : 1), want: t.done ? p.ask.map((q, i) => `${lc(q)} — ${want[i]}`).join('; ') : 'нужно склеить все вершины в одно дерево', why}; };
  const huffSolve = p => { const merges = huffRef(p.w); return {merges, answers: p.wants(huff(p.w, merges)).map(String)}; };
  const egeHead = letters => `По каналу связи передаются сообщения, содержащие только буквы ${and(letters)}. Для передачи используется неравномерный двоичный код, удовлетворяющий условию Фано: никакое кодовое слово не является началом другого кодового слова.`;

  /* ---------- генераторы и проверка: gen(r, k) — вариант для k-го раунда уровня, judge(p, ответ) → {ok, miss, want, why}, solve(p) — образцовый ответ ---------- */
  const G = {
    rleEnc: {
      gen(r, k) { const {ri, shuffle} = tl(r), pix = k < 2, alpha = k === 0 ? ['Б', 'Ч'] : shuffle(k === 1 ? Object.keys(COL) : LET.slice(0, 6)).slice(0, ri(3, 4)), runs = runsGen(r, alpha, [ri(3, 5), ri(5, 7), ri(5, 7)][k], 1, k ? 5 : 4);
        if (k === 2) runs[ri(0, runs.length - 1)][1] = ri(10, 15); const s = str(runs); return s.length < 8 || s.length > 30 ? null : {s, pix}; },
      judge(p, a) { const pr = parseRle(a), want = rleText(rle(p.s)), back = pr && pr.every(([n]) => n >= 1) && pr.reduce((s, [n]) => s + n, 0) === p.s.length ? pr.map(([n, c]) => c.repeat(n)).join('') : null;
        const ok = back === p.s && pr.every((x, i) => !i || x[1] !== pr[i - 1][1]);
        return {ok, miss: ok ? 0 : 1, want, why: `${back === p.s && !ok ? 'Распаковка верная, но соседние пары с одним символом нужно объединить: каждая серия записывается одной парой. ' : ''}Серии: ${runsOf(p.s).join(' · ')} → ${want}. Каждая пара — длина серии и её ${p.pix ? 'цвет' : 'символ'}.`}; },
      solve: p => rleText(rle(p.s))},
    rleDec: {
      gen(r, k) { const {ri, shuffle} = tl(r), alpha = k === 0 ? ['Б', 'Ч'] : ['Б', ...shuffle(Object.keys(COL).slice(1)).slice(0, k + 1)], s = str(runsGen(r, alpha, [ri(3, 5), ri(5, 6), ri(6, 8)][k], 1, k === 2 ? 5 : 4));
        return s.length < 8 || s.length > 24 ? null : {s, code: rleText(rle(s)), alpha}; },
      judge(p, a) { const ok = typeof a === 'string' && a.length === p.s.length && rleText(rle(a)) === p.code;
        return {ok, miss: ok ? 0 : 1, want: p.s, why: `${p.code}: ${rle(p.s).map(([n, c]) => `${COL[c][1]} × ${n}`).join(', ')} — всего ${p.s.length} ${pl(p.s.length, 'клетка', 'клетки', 'клеток')}.`}; },
      solve: p => p.s},
    rleSize: {
      gen(r, k) { const {ri, pick, shuffle} = tl(r), alpha = shuffle(LET.slice(0, 6)).slice(0, ri(3, 4));
        const runs = k === 0 ? runsGen(r, alpha, ri(3, 6), 2, 8) : k === 1 ? runsGen(r, alpha, ri(7, 11), 1, 2) : runsGen(r, alpha, ri(3, 4), 1, 2).map(([c]) => [c, pick([ri(20, 250), ri(256, 700)])]);
        const s = str(runs), N = s.length, pairs = rle(s, 255).length, B = 2 * pairs;
        if ((N * 100) % B || (k < 2 && N > 32) || (k === 0 && B >= N) || (k === 1 && B <= N) || (k === 2 && pairs === runs.length)) return null;
        const fields = [...(k === 2 ? [['Сколько пар запишет архиватор', pairs]] : []), ['Объём после сжатия, байт', B], ['Коэффициент сжатия', N / B]].map(([label, want]) => ({label, want}));
        return {s, runs, k, N, B, pairs, fields, text: `Каждый символ занимает 1 байт. Архиватор RLE записывает каждую серию одинаковых символов парой «счётчик + символ»: 1 байт на счётчик и 1 байт на символ.${k === 2 ? ' В байт счётчика помещается число от 1 до 255, поэтому более длинная серия записывается несколькими парами.' : ''} Коэффициент сжатия = исходный объём / объём после сжатия.${k === 2 ? `\nФайл: ${runs.map(([c, n]) => `${n} ${pl(n, 'символ', 'символа', 'символов')} «${c}»`).join(', затем ')}.` : ''}`}; },
      judge(p, a) { const ok = Array.isArray(a) && p.fields.every((f, i) => Math.abs(num(a[i]) - f.want) < 1e-9), runs = runsOf(p.s);
        const parts = n => { const out = []; for (; n > 255; n -= 255) out.push(255); return [...out, n]; };
        const how = p.k === 2 ? runs.map(g => { const q = parts(g.length); return `${g.length}${g[0]}${q.length > 1 ? ` = ${q.join(' + ')}` : ''} — ${q.length} ${pl(q.length, 'пара', 'пары', 'пар')}`; }).join('; ') : `Серии: ${runs.map(g => g.length + g[0]).join(' ')}`;
        return {ok, miss: ok ? 0 : 1, want: p.fields.map(f => `${lc(f.label)} — ${fmt(f.want)}`).join('; '),
          why: `${how}. Всего ${p.pairs} ${pl(p.pairs, 'пара', 'пары', 'пар')} по 2 байта = ${p.B} байт. Коэффициент сжатия: ${p.N} / ${p.B} = ${fmt(p.N / p.B)}.${p.B > p.N ? ' Он меньше 1: «сжатый» файл больше исходного — RLE не помогает, когда длинных серий нет.' : ''}`}; },
      solve: p => p.fields.map(f => fmt(f.want))},
    fano: {
      gen(r, k) { const {ri} = tl(r), n = 4 + k, letters = LET.slice(0, n), codes = randCode(r, n, 1, k ? 4 : 3);
        if (r() < .55) { const i = ri(0, n - 1); let j = ri(0, n - 2); if (j >= i) j++; codes[j] = r() < .6 || codes[i].length < 2 ? codes[i] + randBits(r, ri(1, 2)) : codes[i].slice(0, ri(1, codes[i].length - 1)); }
        return new Set(codes).size < n || Math.max(...codes.map(c => c.length)) > 5 ? null : {letters, codes}; },
      judge(p, a) { const bad = clash(p.codes), ok = bad.length ? Array.isArray(a) && bad.some(([i, j]) => (a[0] === i && a[1] === j) || (a[0] === j && a[1] === i)) : a === 'ok';
        return {ok, miss: ok ? 0 : 1, want: bad.length ? `нарушено, например ${p.letters[bad[0][0]]} и ${p.letters[bad[0][1]]}` : 'условие выполнено',
          why: bad.length ? `Условие Фано нарушено: ${bad.map(x => why2(p.letters, p.codes, x)).join('; ')}. Значит, однозначное раскодирование не гарантировано.` : 'Ни одно кодовое слово не является началом другого — условие Фано выполнено, любое сообщение раскодируется однозначно.',
          codes: p.letters.map((l, i) => [l, p.codes[i], bad.some(x => x.includes(i)) ? 'bad' : 'known'])}; },
      solve: p => clash(p.codes)[0] || 'ok'},
    decode: {
      gen(r, k) { const {pick} = tl(r), n = 4 + k, letters = LET.slice(0, n), codes = randCode(r, n, 1, k ? 4 : 3), word = Array.from({length: [5, 6, 8][k]}, () => pick(letters)).join(''), bits = [...word].map(c => codes[letters.indexOf(c)]).join('');
        return new Set(word).size < 3 || bits.length < 10 || bits.length > 30 ? null : {letters, codes, word, bits}; },
      judge(p, a) { const w = up(a).replace(/\s+/g, ''), ok = w.length > 0 && [...w].every(c => p.letters.includes(c)) && [...w].map(c => p.codes[p.letters.indexOf(c)]).join('') === p.bits;
        return {ok, miss: ok ? 0 : 1, want: p.word, why: `Читаем слева направо, пока не получится кодовое слово: ${[...p.word].map(c => p.codes[p.letters.indexOf(c)]).join(' | ')} → ${[...p.word].join(' ')}. Условие Фано гарантирует, что разрезать строку можно только одним способом.`,
          codes: p.letters.map((l, i) => [l, p.codes[i], 'known'])}; },
      solve: p => p.word},
    complete: {
      gen(r, k) { const n = [5, 6, 6][k], m = [1, 2, 3][k], letters = LET.slice(0, n), known = randCode(r, n - m, 1, 4), res = search(known, Array(m).fill(1));
        return !res.words || res.best <= m ? null : {letters, known, missing: letters.slice(n - m), best: res.best, witness: res.words}; },
      judge(p, a) { const ws = Array.isArray(a) && a.length === p.missing.length ? a.map(x => String(x ?? '').trim()) : null, L = [...p.letters.slice(0, p.known.length), ...p.missing];
        const okBits = !!ws && ws.every(x => /^[01]{1,16}$/.test(x)), all = okBits ? [...p.known, ...ws] : [], bad = clash(all), sum = okBits ? ws.join('').length : 0, ok = okBits && !bad.length && sum <= p.best;
        const why = !okBits ? 'Код каждой новой буквы — непустая цепочка из 0 и 1. ' : bad.length ? `Условие Фано нарушено: ${why2(L, all, bad[0])}. ` : !ok ? `Условие Фано выполнено, но можно короче: у тебя сумма длин ${sum}, а наименьшая — ${p.best}. ` : '';
        return {ok, miss: ok ? 0 : 1, want: `сумма длин ${p.best}, например ${list(p.missing, p.witness)}`, why: `${why}Свободные ветки дерева: ${freeRoots(p.known).join(', ')}. Перебор показывает, что наименьшая сумма длин новых кодов — ${p.best}, например: ${list(p.missing, p.witness)}.`,
          codes: [...p.known.map((c, i) => [L[i], c, 'known']), ...p.missing.map((l, i) => [l, ok ? ws[i] : p.witness[i], 'mine'])]}; },
      solve: p => p.witness},
    huffBuild: {
      gen(r, k) { const {ri} = tl(r), letters = LET.slice(0, 4 + k), w = letters.map(() => ri(1, 12)); return {letters, w, ask: [], wants: () => [], text: `Частоты букв в сообщении: ${list(letters, w)}. Склей все вершины в одно дерево.`}; },
      judge: huffJudge, solve: huffSolve},
    huffLen: {
      gen(r, k) { const {ri} = tl(r), letters = LET.slice(0, 5 + k), w = letters.map(() => ri(1, 15)), x = ri(0, letters.length - 1), N = w.reduce((s, v) => s + v, 0);
        return {letters, w, x, ask: [`Длина кода буквы ${letters[x]}, бит`, 'Длина всего сообщения, бит'], wants: t => [t.depth[x], t.total], text: `Сообщение из ${N} букв, частоты: ${list(letters, w)}. Построй дерево Хаффмана, а затем ответь: какой длины код буквы ${letters[x]} и сколько бит займёт всё сообщение?`}; },
      judge: huffJudge, solve: huffSolve},
    huffSave: {
      gen(r, k) { const {ri, shuffle} = tl(r), letters = LET.slice(0, ri(4, 5) + k), w = letters.map(() => ri(1, 9)), N = w.reduce((s, v) => s + v, 0), b = Math.ceil(Math.log2(letters.length)), U = N * b, H = huff(w, huffRef(w)).total;
        if (N < 14 || N > 36 || U - H < 3) return null; const msg = shuffle(letters.flatMap((l, i) => Array(w[i]).fill(l))).join('');
        return {letters, w, msg, N, b, U, ask: ['Код Хаффмана: длина сообщения, бит', 'Равномерный код: длина сообщения, бит', 'Экономия, бит'], wants: t => [t.total, U, U - t.total], text: `Сообщение робота: ${msg} (${N} ${pl(N, 'буква', 'буквы', 'букв')}, разных — ${letters.length}). Частоты уже подсчитаны в листьях. Построй дерево Хаффмана и сравни его с равномерным кодом.`}; },
      judge: huffJudge, solve: huffSolve},
    egeSum: {
      gen(r, k) { const {shuffle} = tl(r), n = [5, 6, 7][k], m = [2, 2, 3][k], letters = LET.slice(0, n), miss = shuffle(letters).slice(0, m).sort(), kl = letters.filter(l => !miss.includes(l)), known = randCode(r, n - m, 1, 4), res = search(known, Array(m).fill(1)), all = k === 2;
        if (!res.words || res.best <= m) return null; const answer = all ? res.best + known.join('').length : res.best;
        return {kl, known, miss, words: res.words, best: res.best, all, answer, text: `${egeHead(letters)} Для букв ${and(kl)} используются такие кодовые слова: ${list(kl, known)}. ${all ? `Какова наименьшая возможная суммарная длина всех кодовых слов (для всех ${n} букв)?` : `Какова наименьшая возможная суммарная длина кодовых слов для букв ${and(miss)}?`}`}; },
      judge(p, a) { const ok = num(a) === p.answer;
        return {ok, miss: ok ? 0 : 1, want: String(p.answer), why: `Свободные ветки дерева: ${freeRoots(p.known).join(', ')}. Перебор даёт наименьшую сумму длин ${p.best}: ${list(p.miss, p.words)}${p.all ? `; вместе с известными кодами (${p.known.join('').length}) — ${p.answer}` : ''}.`,
          codes: [...p.kl.map((l, i) => [l, p.known[i], 'known']), ...p.miss.map((l, i) => [l, p.words[i], 'mine'])]}; },
      solve: p => String(p.answer)},
    egeShort: {
      gen(r, k) { const {shuffle} = tl(r), extra = k === 2 ? 1 : 0, n = [5, 6, 6][k], letters = LET.slice(0, n), [x, y] = shuffle(letters), kl = letters.filter(l => l !== x && (!extra || l !== y)), known = randCode(r, kl.length, 1, 4), ans = shortest(known, extra);
        if (!ans || ans.length < 2 || (extra && ans === shortest(known, 0))) return null;
        return {kl, known, x, y: extra ? y : '', extra, answer: ans, text: `${egeHead(letters)} Для букв ${and(kl)} используются кодовые слова: ${list(kl, known)}. ${extra ? `Код для буквы ${y} пока не выбран. Укажите кратчайшее кодовое слово для буквы ${x}, при котором код по-прежнему можно будет дополнить кодовым словом для буквы ${y}, не нарушая условие Фано.` : `Укажите кратчайшее кодовое слово для буквы ${x}, при котором код будет удовлетворять условию Фано.`} Если таких слов несколько, укажите слово с наименьшим числовым значением.`}; },
      judge(p, a) { const s = String(a ?? '').replace(/\s+/g, ''), ok = s === p.answer, hit = p.known.findIndex(c => c.startsWith(s) || s.startsWith(c));
        const why = !/^[01]+$/.test(s) ? '' : hit >= 0 ? `Слово ${s} нарушает условие Фано: ${s.startsWith(p.known[hit]) ? `оно начинается с кода ${p.kl[hit]} (${p.known[hit]})` : `оно — начало кода ${p.kl[hit]} (${p.known[hit]})`}. ` : p.extra && !search([...p.known, s], [1]).words ? `После слова ${s} для буквы ${p.y} не остаётся места. ` : !ok ? `Слово ${s} подходит, но ${s.length > p.answer.length ? 'есть короче' : 'у слова той же длины ' + p.answer + ' числовое значение меньше'}. ` : '';
        return {ok, miss: ok ? 0 : 1, want: p.answer, why: `${why}Перебираем слова по возрастанию длины, а одной длины — по возрастанию значения. Все слова короче ${p.answer.length} бит не подходят: каждое — начало известного кода или начинается с него${p.extra ? ` (или после него не остаётся места для ${p.y})` : ''}. Первое подходящее — ${p.answer}.`,
          codes: [...p.kl.map((l, i) => [l, p.known[i], 'known']), [p.x, p.answer, 'mine']]}; },
      solve: p => p.answer},
    egeMsg: {
      gen(r, k) { const {pick, shuffle} = tl(r), n = [5, 5, 6][k], kn = [3, 2, 3][k], letters = LET.slice(0, n), kl = shuffle(letters).slice(0, kn).sort(), miss = letters.filter(l => !kl.includes(l)), known = randCode(r, kn, 1, k ? 4 : 3);
        const msg = Array.from({length: [6, 7, 9][k]}, () => pick(r() < .6 ? miss : letters)).join(''), cnt = l => msg.split(l).length - 1, w = miss.map(cnt);
        if (w.filter(x => x).length < 2 || new Set(w).size < 2) return null; const res = search(known, w); if (!res.words) return null;
        return {kl, known, miss, msg, w, words: res.words, answer: res.best + kl.reduce((s, l, i) => s + cnt(l) * known[i].length, 0), text: `Для кодирования сообщения, в котором могут встречаться только буквы ${and(letters)}, используется неравномерный двоичный код, удовлетворяющий условию Фано. Для букв ${and(kl)} выбраны кодовые слова: ${list(kl, known)}. Коды остальных букв можно выбрать любыми, лишь бы условие Фано выполнялось. Какова наименьшая возможная длина двоичной записи сообщения ${msg}?`}; },
      judge(p, a) { const ok = num(a) === p.answer, code = l => p.kl.includes(l) ? p.known[p.kl.indexOf(l)] : p.words[p.miss.indexOf(l)], used = [...new Set(p.msg)].sort();
        return {ok, miss: ok ? 0 : 1, want: String(p.answer), why: `Чем чаще буква встречается в сообщении, тем короче должен быть её код. Перебор даёт лучший выбор: ${list(p.miss, p.words)}. Длина: ${used.map(l => `${p.msg.split(l).length - 1}·${code(l).length} (${l})`).join(' + ')} = ${p.answer}.`,
          codes: [...p.kl.map((l, i) => [l, p.known[i], 'known']), ...p.miss.map((l, i) => [l, p.words[i], 'mine'])]}; },
      solve: p => String(p.answer)},
  };
  const LEVELS = [
    ['Серии пикселей', 'rleEnc', 3, 'Архиватор RLE записывает серию одинаковых символов парой «сколько раз — какой символ»: ББББЧЧЧ → 4Б 3Ч. Сожми строку.'],
    ['Распаковка', 'rleDec', 3, 'Восстанови строку пикселей по коду RLE: 3Б 2К — три белых, затем два красных. Выбери цвет и закрась клетки.'],
    ['Выгодно ли сжатие', 'rleSize', 3, 'Посчитай объём после сжатия RLE и коэффициент сжатия. Иногда «сжатый» файл получается больше исходного!'],
    ['Условие Фано', 'fano', 3, 'Неравномерный код раскодируется однозначно, если ни одно кодовое слово не является началом другого (условие Фано). Проверь набор кодов.'],
    ['Расшифровка', 'decode', 3, 'Сообщение закодировано префиксным кодом. Читай биты слева направо, пока не получится кодовое слово, — и так до конца строки.'],
    ['Достройка кода', 'complete', 3, 'Подбери коды для новых букв: условие Фано должно выполняться, а суммарная длина новых кодов — быть наименьшей.'],
    ['Дерево Хаффмана', 'huffBuild', 3, 'Алгоритм Хаффмана строит самый короткий префиксный код: каждый раз склеивай две вершины с наименьшими частотами. Щёлкни по двум вершинам, чтобы склеить их.'],
    ['Длина кода', 'huffLen', 2, 'Построй дерево Хаффмана и прочитай по нему длину кода буквы (число рёбер от корня до листа) и длину всего сообщения.'],
    ['Хаффман против равномерного', 'huffSave', 2, 'Сравни код Хаффмана с равномерным кодом, где на каждую букву уходит ⌈log₂ n⌉ бит (n — число разных букв), и посчитай экономию.'],
    ['Задание 4 ЕГЭ: сумма длин', 'egeSum', 3, 'Как в ЕГЭ: часть кодовых слов известна — найди наименьшую суммарную длину остальных.'],
    ['Задание 4 ЕГЭ: кратчайший код', 'egeShort', 3, 'Как в ЕГЭ: подбери кратчайшее кодовое слово для новой буквы, а из равных по длине — с наименьшим числовым значением.'],
    ['Задание 4 ЕГЭ: длина сообщения', 'egeMsg', 3, 'Как в ЕГЭ: выбери коды остальных букв так, чтобы сообщение получилось самым коротким.'],
  ].map(([title, kind, rounds, brief]) => ({title, kind, rounds, brief}));
  // Вариант задаётся зерном, номером попытки t и раундом k: после ошибки ученик получает новый вариант того же раунда.
  const variant = (lv, seed, t, k) => { const r = rng(seed * 131 + LEVELS.indexOf(lv) * 977 + t * 7919); for (;;) { const p = G[lv.kind].gen(r, k); if (p) return p; } };
  // Ответ — журнал попыток {seed, log}: проверка заново проходит все варианты и считает ошибки (в том числе неверные склейки Хаффмана).
  function check(lv, ans) {
    if (!ans || !Number.isInteger(ans.seed) || !Array.isArray(ans.log)) return {ok: false, msg: 'Нет ответа.'};
    let k = 0, miss = 0; for (let t = 0; t < Math.min(ans.log.length, 200) && k < lv.rounds; t++) { const res = G[lv.kind].judge(variant(lv, ans.seed, t, k), ans.log[t]); miss += res.miss; if (res.ok) k++; }
    if (k < lv.rounds) return {ok: false, miss, msg: `Решено вариантов: ${k} из ${lv.rounds}.`};
    return {ok: true, stars: miss ? miss === 1 ? 2 : 1 : 3, miss, msg: miss ? `Все варианты решены, ошибок: ${miss}.` : 'Все варианты решены без единой ошибки!'};
  }
  const solve = lv => ({seed: 1, log: Array.from({length: lv.rounds}, (_, k) => G[lv.kind].solve(variant(lv, 1, k, k)))});

  /* ---------- интерфейс ---------- */
  const NS = 'http://www.w3.org/2000/svg', svgEl = (t, a, x) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); if (x != null) n.textContent = x; return n; };
  const rowView = (el, s, pix) => { const row = el('div', 'ar-row'); for (const c of s) { const d = el('span', 'ar-px' + (pix ? '' : ' ar-ch'), c); if (pix) { d.style.background = COL[c][0]; d.style.color = 'ЧСФ'.includes(c) ? '#e6edf9' : '#1b2333'; } row.append(d); } return row; };
  const legend = (el, alpha) => { const d = el('div', 'px-legend'); for (const c of alpha) { const s = el('span', '', `${c} — ${COL[c][1]}`); s.style.setProperty('--col', COL[c][0]); d.append(s); } return d; };
  const codeTable = (el, letters, codes) => { const t = el('table', 'lab-table og-table ar-ctab'); [['Буква', letters], ['Код', codes]].forEach(([h, row]) => { const tr = el('tr'); tr.append(el('th', '', h), ...row.map(c => el('td', '', c))); t.append(tr); }); return t; };
  const form = (el, inp, go) => { const f = el('div', 'og-form'); inp.autocomplete = 'off'; inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } }); f.append(inp, go); return f; };
  const fieldsForm = ({el, button}, labels, done, cap = 'Ответить') => { const box = el('div', 'ar-fields'), ins = labels.map(l => { const i = el('input', 'ar-in'); i.autocomplete = 'off'; i.inputMode = 'decimal'; i.setAttribute('aria-label', l); box.append(el('span', '', l), i); return i; });
    const go = button(cap, 'lab-main', () => { const empty = ins.find(i => !i.value.trim()); if (empty) return empty.focus(); done(ins.map(i => i.value.trim())); }); go.dataset.act = 'run';
    ins.forEach((i, q) => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); q + 1 < ins.length ? ins[q + 1].focus() : go.click(); } })); const wrap = el('div', 'ar-ask'); wrap.append(box, go); return wrap; };
  // Дерево кода: от корня влево — 0, вправо — 1; кружок с буквой — кодовое слово, пунктир — свободная ветка, красный — нарушение условия Фано.
  function trieSvg(items) { const ws = items.filter(it => /^[01]{1,6}$/.test(it[1])), D = Math.max(1, ...ws.map(it => it[1].length)), W = Math.max(560, 2 ** D * 28), H = 52 + D * 58;
    const X = s => s ? (parseInt(s, 2) + .5) * W / 2 ** s.length : W / 2, Y = s => 24 + s.length * 58, nodes = new Set(['']);
    for (const [, w] of ws) for (let i = 1; i <= w.length; i++) nodes.add(w.slice(0, i));
    for (const s of [...nodes]) if (!ws.some(it => it[1] === s) && s.length < D) for (const b of '01') nodes.add(s + b);
    const svg = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, class: 'ar-trie', role: 'img', 'aria-label': 'Дерево кода'});
    for (const s of nodes) if (s) { const q = s.slice(0, -1); svg.append(svgEl('line', {x1: X(q), y1: Y(q), x2: X(s), y2: Y(s)}), svgEl('text', {x: (X(q) + X(s)) / 2 + (s.endsWith('0') ? -9 : 9), y: (Y(q) + Y(s)) / 2 - 2, class: 'e'}, s.slice(-1))); }
    for (const s of nodes) { const own = ws.filter(it => it[1] === s), inner = !own.length && ws.some(it => it[1].startsWith(s)), g = svgEl('g', {class: own.length ? (own.some(it => it[2] === 'bad') || own.length > 1 ? 'bad' : own[0][2]) : inner ? 'in' : 'free'});
      g.append(svgEl('circle', {cx: X(s), cy: Y(s), r: own.length ? 14 : inner ? 5 : 8})); if (own.length) g.append(svgEl('text', {x: X(s), y: Y(s) + 5}, own.map(it => it[0]).join(''))); svg.append(g); }
    return svg; }
  // Лес Хаффмана: корни (свободные вершины) сверху, щелчок по двум корням склеивает их.
  function forestSvg(p, t, sel, pick) { const pos = {}; let slot = 0, maxD = 0;
    const lay = (id, d) => { const nd = t.nodes[id]; maxD = Math.max(maxD, d); if (nd.kids) { lay(nd.kids[0], d + 1); lay(nd.kids[1], d + 1); pos[id] = [(pos[nd.kids[0]][0] + pos[nd.kids[1]][0]) / 2, d]; } else pos[id] = [slot++, d]; };
    t.roots.forEach(id => lay(id, 0)); const SX = 76, SY = 64, W = slot * SX + 20, H = 36 + maxD * SY + 48, P = id => [10 + SX / 2 + pos[id][0] * SX, 30 + pos[id][1] * SY];
    const svg = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, class: 'ar-forest', style: `max-width:${W * 1.3}px`});
    for (const id in pos) { const nd = t.nodes[id]; if (nd.kids) nd.kids.forEach((c, b) => { const [x1, y1] = P(id), [x2, y2] = P(c); svg.append(svgEl('line', {x1, y1, x2, y2}), svgEl('text', {x: (x1 + x2) / 2 + (b ? 10 : -10), y: (y1 + y2) / 2 - 3, class: 'e'}, String(b))); }); }
    for (const id in pos) { const nd = t.nodes[id], [x, y] = P(id), root = !t.done && t.roots.includes(+id), g = svgEl('g', {class: [root ? 'root' : '', +id === sel ? 'on' : '', nd.kids ? '' : 'leaf'].join(' ').trim()});
      g.append(svgEl('circle', {cx: x, cy: y, r: 19}), svgEl('text', {x, y: y + 6}, String(nd.w))); if (!nd.kids) g.append(svgEl('text', {x, y: y + 40, class: 'lbl'}, p.letters[nd.leaf]));
      if (root) { g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('data-node', id); g.setAttribute('aria-label', `Вершина с частотой ${nd.w}`); g.addEventListener('click', () => pick(+id)); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(+id); } }); }
      svg.append(g); }
    return svg; }
  // Виджеты уровней: получают вариант и submit(ответ); note — подсказка без ошибки, oops — засчитанная ошибка (неверная склейка). Кнопка сдачи помечена data-act=run.
  const W = {
    rleEnc(p, {el, button}, submit, note) { const box = el('div', 'og-w'), inp = el('input', 'ar-in'); inp.placeholder = 'например: 3Б 2Ч'; inp.setAttribute('aria-label', 'Код RLE');
      const go = button('🗜 Сжать', 'lab-main', () => { if (!inp.value.trim()) return; if (!parseRle(inp.value)) return note('Запиши пары «число и буква» подряд, например: 3Б 2Ч 1К.'); submit(inp.value); }); go.dataset.act = 'run';
      box.append(el('p', 'og-text', p.pix ? 'Строка пикселей рисунка (буква в клетке — цвет). Запиши её кодом RLE: пары «длина серии — цвет».' : 'Строка текста. Запиши её кодом RLE: пары «длина серии — символ».'), rowView(el, p.s, p.pix));
      if (p.pix) box.append(legend(el, [...new Set(p.s)])); box.append(form(el, inp, go)); setTimeout(() => inp.focus(), 50); return box; },
    rleDec(p, {el, button}, submit) { const box = el('div', 'og-w'), cells = Array(p.s.length).fill('Б'), row = el('div', 'ar-row'), pal = el('div', 'ar-pal'); let cur = p.alpha[1], down = false;
      const paint = (i, b) => { cells[i] = cur; b.style.background = COL[cur][0]; };
      for (const c of p.alpha) { const b = button('', 'ar-pc' + (c === cur ? ' on' : ''), () => { cur = c; for (const x of pal.children) x.classList.toggle('on', x.dataset.c === c); }); b.dataset.c = c; const i = el('i'); i.style.background = COL[c][0]; b.append(i, `${c} — ${COL[c][1]}`); pal.append(b); }
      cells.forEach((_, i) => { const b = button('', 'ar-px ar-cell', () => paint(i, b)); b.style.background = COL.Б[0]; b.dataset.i = i; b.setAttribute('aria-label', `Клетка ${i + 1}`);
        b.addEventListener('pointerdown', () => { down = true; paint(i, b); }); b.addEventListener('pointerenter', () => { if (down) paint(i, b); }); row.append(b); });
      for (const ev of ['pointerup', 'pointerleave']) row.addEventListener(ev, () => { down = false; });
      const go = button('📂 Распаковать', 'lab-main', () => submit(cells.join(''))); go.dataset.act = 'run';
      box.append(el('p', 'og-text', 'Код RLE строки пикселей:'), el('div', 'ar-code', p.code), el('p', 'lab-note', `В строке ${p.s.length} ${pl(p.s.length, 'клетка', 'клетки', 'клеток')}, сначала все белые. Выбери цвет и щёлкай по клеткам (можно вести мышью с зажатой кнопкой).`), pal, row, go); return box; },
    rleSize(p, api, submit) { const box = api.el('div', 'og-w'); box.append(api.el('p', 'og-text', p.text)); if (p.k < 2) box.append(api.el('p', 'og-text', 'Строка:'), rowView(api.el, p.s, false)); box.append(fieldsForm(api, p.fields.map(f => f.label), submit)); return box; },
    fano(p, {el, button}, submit, note) { const box = el('div', 'og-w'), chips = el('div', 'ar-codes'), sel = [];
      p.letters.forEach((l, i) => { const c = button('', 'ar-chip', () => { const at = sel.indexOf(i); if (at >= 0) sel.splice(at, 1); else { sel.push(i); if (sel.length > 2) sel.shift(); } for (const [q, x] of [...chips.children].entries()) x.classList.toggle('on', sel.includes(q)); }); c.dataset.i = i; c.append(el('b', '', l), p.codes[i]); chips.append(c); });
      const yes = button('✓ Условие Фано выполнено', 'lab-main', () => submit('ok')); yes.dataset.act = 'run';
      const no = button('✗ Нарушено: выбранная пара', 'lab-small', () => { if (sel.length !== 2) return note('Выбери два кодовых слова: одно из них должно быть началом другого.'); submit(sel.slice().sort((a, b) => a - b)); }); no.dataset.act = 'pair';
      const bar = el('div', 'lab-bar'); bar.style.justifyContent = 'flex-start'; bar.append(yes, no);
      box.append(el('p', 'og-text', 'Буквы закодированы неравномерным двоичным кодом. Выполняется ли условие Фано? Если нет — щёлкни по двум кодовым словам, одно из которых является началом другого.'), chips, bar); return box; },
    decode(p, {el, button}, submit) { const box = el('div', 'og-w'), cuts = new Set(), strip = el('div', 'og-bits'), inp = el('input', 'ar-in'); inp.placeholder = 'слово'; inp.setAttribute('aria-label', 'Расшифрованное слово');
      const draw = () => { strip.replaceChildren(); [...p.bits].forEach((c, q) => { if (q && cuts.has(q)) strip.append(el('span', 'og-cut', '|')); strip.append(button(c, 'og-bit', () => { if (q + 1 < p.bits.length) { cuts.has(q + 1) ? cuts.delete(q + 1) : cuts.add(q + 1); draw(); } })); }); };
      const go = button('🔓 Расшифровать', 'lab-main', () => { if (inp.value.trim()) submit(inp.value); }); go.dataset.act = 'run';
      box.append(el('p', 'og-text', 'Таблица кодов:'), codeTable(el, p.letters, p.codes), el('p', 'lab-note', 'Перехвачено сообщение. Щёлкай по цифрам, чтобы разрезать строку на коды букв (разрез ставится после цифры), и впиши получившееся слово.'), strip, form(el, inp, go)); draw(); return box; },
    complete(p, {el, button}, submit, note) { const box = el('div', 'og-w'), tree = el('div', 'ar-treebox'), sum = el('p', 'lab-note'), L = p.letters, grid = el('div', 'ar-fields');
      const ins = p.missing.map(l => { const i = el('input', 'ar-in'); i.autocomplete = 'off'; i.inputMode = 'numeric'; i.placeholder = 'код из 0 и 1'; i.setAttribute('aria-label', 'Код буквы ' + l); grid.append(el('span', '', `Буква ${l}`), i); i.addEventListener('input', () => draw()); return i; });
      const draw = () => { const items = [...p.known.map((c, i) => [L[i], c, 'known']), ...ins.map((i, q) => [p.missing[q], i.value.trim(), 'mine']).filter(it => /^[01]+$/.test(it[1]))], bad = clash(items.map(it => it[1]));
        for (const [i, j] of bad) items[i][2] = items[j][2] = 'bad'; tree.replaceChildren(trieSvg(items)); sum.textContent = `Сумма длин новых кодов: ${items.slice(p.known.length).reduce((s, it) => s + it[1].length, 0)}${bad.length ? ' · есть нарушение условия Фано (красные вершины)' : ''}.`; };
      const go = button('✔ Проверить код', 'lab-main', () => { const ws = ins.map(i => i.value.trim()); if (ws.some(w => !/^[01]+$/.test(w))) return note('Впиши код каждой новой буквы: цепочку из 0 и 1.'); submit(ws); }); go.dataset.act = 'run';
      ins[ins.length - 1].addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
      box.append(el('p', 'og-text', 'Известные коды:'), codeTable(el, L.slice(0, p.known.length), p.known), el('p', 'lab-note', 'Дерево кода: от корня влево — 0, вправо — 1. Пунктирные кружки — свободные ветки, туда можно поставить новую букву.'), tree, grid, sum, go); draw(); return box; },
    tree(p, api, submit, note, oops) { const {el, button} = api, box = el('div', 'og-w'), holder = el('div', 'ar-forestbox'), status = el('p', 'lab-note'), merges = []; let sel = null;
      const draw = () => { const t = huff(p.w, merges); holder.replaceChildren(forestSvg(p, t, sel, pick)); status.textContent = t.done ? (p.ask.length ? 'Дерево готово! Ответь на вопросы под деревом.' : 'Дерево готово! Нажми «Готово».') : `Свободных вершин: ${t.roots.length}. Выбери две с наименьшими частотами.`; };
      const pick = id => { if (sel === null || sel === id) { sel = sel === id ? null : id; return draw(); } const t = huff(p.w, merges), ok = minPair(t, sel, id); merges.push([sel, id]); sel = null;
        if (ok) note(''); else { const ws = t.roots.map(i => t.nodes[i].w).sort((a, b) => a - b); oops(`Так нельзя: склеивать нужно две вершины с наименьшими частотами — сейчас это ${ws[0]} и ${ws[1]} (если одинаковых несколько, подойдут любые). Ошибка засчитана.`); } draw(); };
      const finish = vals => { if (!huff(p.w, merges).done) return note('Сначала склей все вершины в одно дерево.'); submit({merges: merges.slice(), answers: vals}); };
      box.append(el('p', 'og-text', p.text), holder, status);
      if (p.ask.length) box.append(fieldsForm(api, p.ask, finish)); else { const go = button('✔ Готово', 'lab-main', () => finish([])); go.dataset.act = 'run'; box.append(go); }
      draw(); return box; },
    ege(p, {el, button}, submit) { const box = el('div', 'og-w'), inp = el('input', 'ar-in'); inp.placeholder = 'ответ'; inp.setAttribute('aria-label', 'Ответ');
      const go = button('Ответить', 'lab-main', () => { if (inp.value.trim()) submit(inp.value); }); go.dataset.act = 'run'; box.append(el('p', 'og-text', p.text), form(el, inp, go)); setTimeout(() => inp.focus(), 50); return box; },
  };
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), dots = el('div', 'og-dots'), tally = el('p', 'lab-note ar-tally'), box = el('div', 'lab-panel og-box'), msg = el('p', 'lab-msg');
    let seed = Math.floor(Math.random() * 1e6), log = [], k = 0, missDone = 0, missNow = 0, forced = null;
    task.append(el('h2', '', lv.title), el('p', '', lv.brief), el('p', '', `Вариантов подряд: ${lv.rounds}. Без ошибок — три звезды, одна ошибка — две, больше — одна. После ошибки — разбор и новый вариант.`));
    const paint = () => { dots.replaceChildren(...Array.from({length: lv.rounds}, (_, i) => el('i', i < k ? 'good' : i === k ? 'now' : ''))); tally.textContent = `Ошибок: ${missDone + missNow}`; };
    const say = (text, cls) => { msg.textContent = text; msg.className = 'lab-msg' + (cls ? ' ' + cls : ''); };
    function show() { paint(); say('');
      if (k >= lv.rounds) { const r = check(lv, {seed, log}); if (r.ok) api.finish(r.stars, r.msg); return; }
      const p = variant(lv, seed, log.length, k), frame = el('div', 'ar-frame'), after = el('div', 'ar-after'); if (api.debugHost) window.arNow = p;
      const submit = a => { if (forced) return; log.push(a); const res = G[lv.kind].judge(p, a); missDone += res.miss; missNow = 0; if (res.ok) k++; paint();
        for (const b of frame.querySelectorAll('button, input')) b.disabled = true; frame.classList.add('ar-locked');
        say(res.ok ? `Верно! ${res.why}` : `Неверно. Правильный ответ: ${res.want}. Разбор: ${res.why}`, res.ok ? 'good' : 'bad'); if (res.codes) after.append(trieSvg(res.codes));
        const next = button(res.ok ? (k < lv.rounds ? 'Следующий вариант →' : 'Итог') : 'Новый вариант →', 'lab-main', show); next.dataset.act = 'next-q'; after.append(next); next.focus(); };
      frame.append((W[lv.kind] || W[/^huff/.test(lv.kind) ? 'tree' : 'ege'])(p, api, submit, text => say(text, text ? 'bad' : ''), text => { missNow++; paint(); say(text, 'bad'); }));
      box.replaceChildren(el('p', 'lab-eyebrow', `ВАРИАНТ ${k + 1} ИЗ ${lv.rounds}`), frame, msg, after); }
    host.append(task, dots, tally, box); show();
    // Отладка на стенде: готовый журнал ответов засчитывается кнопкой сдачи любого виджета.
    host.addEventListener('click', e => { if (forced && e.target.closest('[data-act=run]')) { e.stopPropagation(); e.preventDefault(); const r = check(lv, forced); if (r.ok) api.finish(r.stars, r.msg); else say(r.msg, 'bad'); } }, true);
    if (api.debugHost) window.labSet = a => { forced = a; for (const b of host.querySelectorAll('[data-act=run]')) b.disabled = false; };
  }
  LAB.register({id: 'archiver', bg: 'bg_archiver', hero: 'host_archivist', title: 'Архиватор', genre: 'сжатие данных', art: '🗜', color: '#4dd4c0', unit: 'Задание', minutes: 45,
    about: 'Робот-архиватор пакует файлы, а ты подсказываешь, как записать их короче: серии RLE, неравномерные коды и условие Фано, дерево Хаффмана и задание 4 ЕГЭ. Варианты каждый раз новые, ответы проверяются перебором, после ошибки — разбор.',
    levels: grade => grade <= 8 ? LEVELS.slice(0, 9) : LEVELS, mount, check, solve, LEVELS, G, variant, huff, huffRef, minPair, fano, clash, fits, search, shortest, rle, rleText, parseRle, freeRoots});
})();
