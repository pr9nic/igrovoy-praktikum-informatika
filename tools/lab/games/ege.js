// «ЕГЭ-арена»: задания ЕГЭ по информатике, которые решаются без компьютера (10–11 классы).
// Каждый уровень — одно задание: три варианта подряд, сгенерированных заново; верный ответ сбивает щит экзаменатора.
// Ответы считаются перебором (а не формулой), поэтому совпадают с честным решением; разбор показывается после каждого ответа.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const tl = r => ({ri: (a, b) => a + Math.floor(r() * (b - a + 1)), pick: a => a[Math.floor(r() * a.length)], shuffle: a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }});
  const fano = codes => codes.every((a, i) => codes.every((b, j) => i === j || !b.startsWith(a)));
  const perms = a => a.length < 2 ? [a] : a.flatMap((x, i) => perms(a.filter((_, k) => k !== i)).map(p => [x, ...p]));
  const list = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' или ' + a[a.length - 1] : String(a[0]);
  // Задания 19–21: одна куча камней, ходы «+a» и «×k»; игра кончается, когда в куче не меньше N камней, выигрывает сделавший последний ход.
  const KAM = ['', 'один камень', 'два камня', 'три камня', 'четыре камня', 'пять камней'], RAZ = ['', '', 'два', 'три'];
  function heap(r, task) { const {ri, pick} = tl(r);
    for (;;) { const [add, mul] = pick([[[1], [2]], [[1, 2], [2]], [[1, 3], [2]], [[1, 4], [2]], [[1, 5], [2]], [[1], [3]], [[2], [2]], [[1, 2], [3]], [[1], [2, 3]], [[2, 3], [2]]]), N = ri(25, 140), any = r() < 0.4;
      const mv = s => [...new Set([...add.map(a => s + a), ...mul.map(k => s * k)])];
      // дерево игры снизу вверх: v > 0 — ходящий выигрывает не позже своего v-го хода, v < 0 — соперник выигрывает не позже своего −v-го хода
      const v = []; for (let s = N - 1; s >= 1; s--) { const nx = mv(s), lose = nx.filter(x => x < N && v[x] < 0); v[s] = nx.some(x => x >= N) ? 1 : lose.length ? 1 - Math.max(...lose.map(x => v[x])) : -Math.max(...nx.map(x => v[x])); }
      const S = [...Array(N).keys()].slice(1), W2 = S.filter(s => v[s] === 2), L1 = S.filter(s => v[s] === -1), L2 = S.filter(s => v[s] === -2), luck = S.find(s => mv(s).some(x => x < N && v[x] === 1));
      if (task === 19 && (any ? !L1.length : !luck) || task === 20 && W2.length !== 2 || task === 21 && !L2.length) continue;
      const s0 = pick([10, 12, 15, 20]), ex = mv(s0).sort((a, b) => a - b), kam = x => x % 10 === 1 && x % 100 !== 11 ? 'камня' : 'камней';
      const head = `Два игрока, Петя и Ваня, играют в игру с кучей камней. Ходят по очереди, первый ход делает Петя. За один ход игрок может ${list([...add.map(a => `добавить в кучу ${KAM[a]}`), ...mul.map(k => `увеличить количество камней в куче в ${RAZ[k]} раза`)])}. Например, из кучи в ${s0} камней за один ход можно получить кучу из ${list(ex)} ${kam(ex[ex.length - 1])}. Игра заканчивается, как только в куче становится не менее ${N} ${kam(N)}; победителем считается игрок, сделавший последний ход. В начале в куче S камней, 1 ≤ S ≤ ${N - 1}. Игрок имеет выигрышную стратегию, если может выиграть при любых ходах противника. `;
      if (task === 19) { const a = any ? L1[0] : luck, c = mv(a).find(x => x < N && v[x] === 1);
        return {text: head + (any ? 'Укажите минимальное значение S, при котором Петя не может выиграть первым ходом, но при любом ходе Пети Ваня выигрывает своим первым ходом.' : 'Известно, что Ваня выиграл своим первым ходом после неудачного первого хода Пети. Укажите минимальное значение S, при котором такое возможно.'), answer: a,
          explain: any ? `Из S = ${a} Петя может получить только ${list(mv(a))} — из каждой такой кучи Ваня одним ходом доводит её до ${N} и больше. При меньших S у Пети есть ход, после которого Ване сразу не выиграть.` : `S = ${a}: Петя ходит ${a} → ${c} и не выигрывает, а Ваня отвечает ${c} → ${mv(c).find(x => x >= N)} ≥ ${N}. При меньших S после любого хода Пети Ване одного хода не хватает.`}; }
      if (task === 20) return {text: head + 'Найдите два таких значения S, при которых у Пети есть выигрышная стратегия, причём Петя не может выиграть первым ходом, но может выиграть своим вторым ходом при любом ходе Вани. Запишите найденные значения в порядке возрастания через пробел.', answer: W2.join(' '), kind: 'pair',
        explain: `Проигрышные кучи — из них при любом ходе соперник выигрывает первым же ходом: ${L1.join(', ')}. Петя выигрывает вторым ходом, если сразу выиграть не может, но первым ходом оставляет Ване такую кучу: ${W2.map(s => `${s} → ${mv(s).find(x => v[x] === -1)}`).join(', ')}.`};
      const a = L2[0], c = mv(a).find(x => v[x] === 2);
      return {text: head + 'Найдите минимальное значение S, при котором одновременно выполняются два условия: у Вани есть выигрышная стратегия, позволяющая ему выиграть первым или вторым ходом при любой игре Пети; у Вани нет стратегии, которая позволит ему гарантированно выиграть первым ходом.', answer: a,
        explain: `S = ${a}: Петя сразу не выигрывает, а любой его ход (${list(mv(a))}) ведёт в кучу, из которой Ваня выигрывает первым или вторым ходом. Если Петя пойдёт ${a} → ${c}, Ване первым ходом не выиграть, но вторым он выиграет. Меньших таких S нет.`}; }
  }
  const T = {
    1(r) { const {ri, shuffle} = tl(r);
      const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])), cross = (a, b, c, d) => o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
      const gap = (a, b, c) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(a[0] + t * dx - c[0], a[1] + t * dy - c[1]); };
      for (;;) { const n = ri(7, 8), L = [...'АБВГДЕЖЗ'].slice(0, n), P = shuffle([...Array(12).keys()]).slice(0, n).map(c => [70 + c % 4 * 130 + ri(-20, 20), 50 + Math.floor(c / 4) * 125 + ri(-16, 16)]);
        // схема: короткие дороги без пересечений, не проходящие вплотную к чужим пунктам; затем лишние дороги убираются (у каждого пункта остаётся не меньше двух)
        let E = []; const cand = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) cand.push([i, j, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1])]);
        for (const [i, j, d] of cand.sort((a, b) => a[2] - b[2])) if (d < 280 && P.every((q, k) => k === i || k === j || gap(P[i], P[j], q) > 32) && !E.some(([a, b]) => cross(P[i], P[j], P[a], P[b]))) E.push([i, j]);
        const deg = v => E.filter(e => e.includes(v)).length, conn = () => { const seen = new Set([0]), st = [0]; while (st.length) { const v = st.pop(); for (const [a, b] of E) for (const [x, y] of [[a, b], [b, a]]) if (x === v && !seen.has(y)) { seen.add(y); st.push(y); } } return seen.size === n; };
        if (!conn()) continue; const m = ri(n + 2, n + 4);
        for (const e of shuffle(E)) { if (E.length <= m) break; if (deg(e[0]) < 3 || deg(e[1]) < 3) continue; E = E.filter(x => x !== e); if (!conn()) E.push(e); }
        const A = L.map((_, i) => L.map((_, j) => E.some(([a, b]) => a === i && b === j || a === j && b === i))), num = shuffle([...Array(n).keys()]), W = L.map(() => Array(n).fill(0));
        for (const [a, b] of E) W[num[a]][num[b]] = W[num[b]][num[a]] = ri(3, 45);
        // все соответствия «пункт схемы → номер в таблице», при которых дороги совпадают (перебор с отсечением)
        const isos = [], f = [], used = [], dg = i => A[i].filter(Boolean).length;
        const go = i => { if (i === n) return void isos.push(f.slice()); for (let j = 0; j < n; j++) if (!used[j] && W[j].filter(Boolean).length === dg(i) && f.slice(0, i).every((fk, k) => A[i][k] === !!W[j][fk])) { f[i] = j; used[j] = true; go(i + 1); used[j] = false; } }; go(0);
        const len = (g, [a, b]) => W[g[a]][g[b]], sum = (g, q) => q.reduce((s, e) => s + len(g, e), 0), fixed = q => isos.every(g => sum(g, q) === sum(num, q));
        // спрашиваем дорогу (или пару дорог), длина которой одна и та же при любом допустимом соответствии
        let ask = null; if (r() < 0.6) ask = shuffle(E).map(e => [e]).find(fixed); else for (let t = 0; t < 30 && !ask; t++) { const q = shuffle(E).slice(0, 2).sort((x, y) => x[0] - y[0] || x[1] - y[1]); if (fixed(q)) ask = q; }
        if (!ask) continue; const ans = sum(num, ask), road = ([a, b]) => `из пункта ${L[a]} в пункт ${L[b]}`;
        return {text: `На рисунке схема дорог района изображена в виде графа, в таблице указана протяжённость каждой дороги (в километрах). Таблицу и схему составляли независимо друг от друга, поэтому номера пунктов в таблице (П1–П${n}) никак не связаны с буквами на графе. ${ask.length === 1 ? `Определите длину дороги ${road(ask[0])}` : `Определите сумму длин дорог ${road(ask[0])} и ${road(ask[1])}`}. В ответе запишите целое число.`, answer: ans,
          graph: {names: L, pos: P, edges: E}, table: [['', ...L.map((_, j) => 'П' + (j + 1))], ...W.map((row, i) => ['П' + (i + 1), ...row.map(w => w ? String(w) : '')])],
          explain: `Сначала сопоставляем пункты по числу дорог (на схеме: ${L.map((x, i) => `${x} — ${dg(i)}`).join(', ')}), затем по соседям: ${L.map((x, i) => `${x} = П${num[i] + 1}`).join(', ')}${isos.length > 1 ? ' (у схемы есть симметрия, соответствие не единственное, но длина искомых дорог во всех вариантах одна и та же)' : ''}. ${ask.map(e => `Дорога ${L[e[0]]}${L[e[1]]} — это П${num[e[0]] + 1}–П${num[e[1]] + 1}, ${len(num, e)} км`).join('; ')}${ask.length > 1 ? `; сумма ${ans}` : ''}.`}; } },
    2(r) { const {ri, pick, shuffle} = tl(r), V = ['w', 'x', 'y', 'z'], ALL = perms(V), OP = {'∧': (a, b) => a && b, '∨': (a, b) => a || b, '→': (a, b) => !a || b, '≡': (a, b) => a === b};
      const cells = () => shuffle([...Array(12).keys()].map(c => [c >> 2, c & 3]));
      for (;;) { // формула — случайное дерево: каждая переменная входит хотя бы раз, у части узлов — отрицание
        const tree = vs => vs.length === 1 ? {v: vs[0], neg: r() < 0.3} : (k => ({op: pick(Object.keys(OP)), a: tree(vs.slice(0, k)), b: tree(vs.slice(k)), neg: r() < 0.15}))(ri(1, vs.length - 1));
        const vs = shuffle(V); if (r() < 0.35) vs.push(pick(V.filter(x => x !== vs[3])));
        const t = tree(vs), show = (u, top) => u.v ? (u.neg ? '¬' : '') + u.v : (s => u.neg ? `¬(${s})` : top ? s : `(${s})`)(`${show(u.a)} ${u.op} ${show(u.b)}`), ev = (u, e) => (u.v ? e[u.v] : OP[u.op](ev(u.a, e), ev(u.b, e))) !== u.neg;
        const TT = [...Array(16).keys()].map(m => ev(t, {w: !!(m & 8), x: !!(m & 4), y: !!(m & 2), z: !!(m & 1)})), rowsOf = val => [...Array(16).keys()].filter(m => TT[m] === !!val), vals = [0, 1].filter(x => rowsOf(x).length >= 3 && rowsOf(x).length <= 8);
        if (!vals.length) continue; const val = pick(vals), sig = shuffle(V), full = shuffle(rowsOf(val)).slice(0, 3).map(m => sig.map(x => m >> 3 - V.indexOf(x) & 1));
        // GOOD[q] — строки m (биты в порядке столбцов), где F = val при расстановке ALL[q]; расстановка подходит, если каждую строку фрагмента
        // можно дополнить до такой строки и строки при этом остаются различными
        const GOOD = ALL.map(tau => [...Array(16).keys()].filter(m => TT[tau.reduce((s, x, k) => s | (m >> 3 - k & 1) << 3 - V.indexOf(x), 0)] === !!val));
        const sh = full.map(row => row.map(() => '')), cnt = () => { const mk = sh.map(row => row.reduce(([M, B], c, k) => c === '' ? [M, B] : [M | 8 >> k, B | c << 3 - k], [0, 0]));
          return GOOD.filter(G => { const S = mk.map(([M, B]) => G.filter(m => (m & M) === B)); return S[0].some(a => S[1].some(b => b !== a && S[2].some(c => c !== a && c !== b))); }).length; };
        // открываем клетки, пока ответ не станет единственным, затем убираем лишние подсказки
        for (const [i, k] of cells()) { if (cnt() === 1) break; sh[i][k] = full[i][k]; }
        if (cnt() !== 1) continue; const lim = ri(4, 6);
        for (const [i, k] of cells()) { if (sh.flat().filter(c => c !== '').length <= lim) break; if (sh[i][k] === '') continue; sh[i][k] = ''; if (cnt() !== 1) sh[i][k] = full[i][k]; }
        return {text: `Логическая функция F задаётся выражением F = ${show(t, true)}. Ниже — фрагмент таблицы истинности этой функции: три различные строки, часть клеток не заполнена, а столбцы переменных не подписаны. Определите, какому столбцу таблицы соответствует каждая из переменных w, x, y, z. В ответе напишите буквы w, x, y, z в том порядке, в котором идут соответствующие им столбцы (сначала буква первого столбца, затем второго и т. д.), без пробелов и запятых.`,
          table: [['?', '?', '?', '?', 'F'], ...sh.map(row => [...row.map(String), String(val)])], answer: sig.join(''), kind: 'vars',
          explain: `F = ${val} ровно на ${rowsOf(val).length} наборах (w x y z): ${rowsOf(val).map(m => m.toString(2).padStart(4, '0')).join(', ')}. Подходит только порядок столбцов ${sig.join('')}: строки дополняются, например, до ${full.map(x => x.join('')).join(', ')}. При любой другой расстановке хотя бы одну строку не дополнить так, чтобы F = ${val}, или строки совпали бы.`}; } },
    4(r) { const {ri, pick, shuffle} = tl(r);
      for (;;) { const L = 'АБВГДЕ'.split('').slice(0, ri(5, 6)), known = {}, given = shuffle(L).slice(0, L.length - 2), rest = L.filter(x => !given.includes(x));
        const base = pick([['0', '10', '110'], ['00', '01', '100'], ['1', '01', '001'], ['00', '010', '011', '101'], ['10', '11', '000', '0010']]);
        if (base.length < given.length) continue; given.forEach((x, i) => { known[x] = base[i]; }); if (!fano(Object.values(known))) continue;
        // перебор кодов для двух оставшихся букв: минимальная сумма длин
        const all = []; for (let len = 1; len <= 6; len++) for (let v = 0; v < 1 << len; v++) all.push(v.toString(2).padStart(len, '0'));
        let best = 1e9; for (const a of all) { if (!fano([...Object.values(known), a])) continue; for (const b of all) { if (a.length + b.length >= best) continue; if (fano([...Object.values(known), a, b])) best = a.length + b.length; } }
        if (best > 12) continue;
        return {text: `По каналу связи передаются сообщения из букв ${L.join(', ')}. Используется неравномерный двоичный код, удовлетворяющий условию Фано (ни одно кодовое слово не является началом другого). Известны коды: ${given.map(x => `${x} — ${known[x]}`).join(', ')}. Какова наименьшая возможная суммарная длина кодовых слов для букв ${rest.join(' и ')}?`, answer: best,
          explain: `Перебираем свободные «ветки» двоичного дерева: подходят только коды, которые не являются началом известных и не начинаются с них. Самые короткие варианты дают сумму ${best}.`}; } },
    5(r) { const {ri, pick} = tl(r);
      const rules = [['если число N чётное, к записи справа приписывается 0, иначе — 1', s => s + (parseInt(s, 2) % 2 ? '1' : '0')], ['к записи справа приписываются два последних её разряда', s => s + s.slice(-2)], ['если сумма цифр двоичной записи чётная, справа приписывается 0, иначе — 1, и затем это действие повторяется ещё раз', s => { const f = t => t + ((t.split('1').length - 1) % 2 ? '1' : '0'); return f(f(s)); }]];
      const [rule, fn] = pick(rules), K = ri(40, 300);
      let n = 1; while (parseInt(fn(n.toString(2)), 2) <= K) n++;
      return {text: `Автомат получает на вход натуральное число N и строит число R так: 1) строится двоичная запись N; 2) ${rule}; 3) полученная запись — это двоичная запись R. Укажите наименьшее N, для которого R больше ${K}. В ответе запишите число в десятичной системе.`, answer: n,
        explain: `Перебираем N = 1, 2, 3, …: N = ${n} даёт R = ${fn(n.toString(2))}₂ = ${parseInt(fn(n.toString(2)), 2)} > ${K}, а N = ${n - 1} даёт R = ${parseInt(fn((n - 1).toString(2)), 2)}.`}; },
    6(r) { const {ri, pick} = tl(r); const a = ri(5, 18), b = ri(4, 15), inside = pick([true, false]);
      const ans = inside ? (a - 1) * (b - 1) : (a + 1) * (b + 1);
      return {text: `Черепаха выполняет программу: Повтори 2 [Вперёд ${a} Направо 90 Вперёд ${b} Направо 90]. Определите, сколько точек с целочисленными координатами находятся ${inside ? 'внутри области, ограниченной линией (точки на линии не учитываются)' : 'внутри области и на её границе'}.`, answer: ans,
        explain: `Черепаха рисует прямоугольник ${a}×${b}. ${inside ? `Внутри — (${a} − 1) × (${b} − 1) = ${ans} точек.` : `Вместе с границей — (${a} + 1) × (${b} + 1) = ${ans} точек.`}`}; },
    7(r) { const {ri, pick} = tl(r);
      for (;;) { const w = pick([640, 800, 1024, 1280, 2048]), h = pick([480, 600, 768, 1024]), colors = pick([16, 64, 256, 1024, 65536]), i = Math.log2(colors), kb = w * h * i / 8 / 1024, n = ri(2, 8), mb = ri(2, 10) * 1024;
        if (!Number.isInteger(kb)) continue; const cnt = Math.floor(mb / kb); if (cnt < 1) continue;
        return {text: `Камера делает фотографии ${w}×${h} пикселей и сохраняет их без сжатия, палитра — ${colors} цветов (на пиксель отводится одинаковое минимальное число бит). Сколько таких фотографий поместится на карту памяти объёмом ${mb / 1024} Мбайт? Служебная информация не учитывается.`, answer: cnt,
          explain: `На пиксель — log₂${colors} = ${i} бит. Фото: ${w}·${h}·${i} бит = ${kb} Кбайт. Карта: ${mb} Кбайт; ${mb} / ${kb} → ${cnt} целых фотографий.`}; } },
    8(r) { const {ri, pick} = tl(r);
      const word = pick(['КОД', 'ЛОГИКА', 'ЗАДАЧА', 'ПИТОН', 'ДАННЫЕ']), letters = [...new Set(word)], L = ri(4, 5), mode = pick(['once', 'noStart', 'twoSame']);
      const vowels = 'АЕЁИОУЫЭЮЯ', pickL = pick(letters);
      let cnt = 0; const rec = s => { if (s.length === L) { if (mode === 'once' ? s.split(pickL).length - 1 === 1 : mode === 'noStart' ? !vowels.includes(s[0]) : s.split('').some((c, i) => i && c === s[i - 1])) cnt++; return; } for (const c of letters) rec(s + c); }; rec('');
      const cond = mode === 'once' ? `буква ${pickL} встречается ровно один раз` : mode === 'noStart' ? 'слово не начинается с гласной' : 'в слове есть хотя бы две одинаковые буквы подряд';
      return {text: `Вася составляет ${L}-буквенные слова из букв слова ${word} (каждую букву можно использовать сколько угодно раз). Сколько существует слов, в которых ${cond}?`, answer: cnt,
        explain: `Различных букв: ${letters.length}. Перебором (или правилом произведения) получаем ${cnt} подходящих слов.`}; },
    11(r) { const {ri, pick} = tl(r);
      const N = ri(10, 40), len = ri(8, 20), users = pick([20, 50, 100, 500]), bits = Math.ceil(Math.log2(N)), bytes = Math.ceil(len * bits / 8), extra = pick([0, 10, 20]);
      const total = users * (bytes + extra);
      return {text: `При регистрации каждому пользователю выдают пароль из ${len} символов; используются ${N} различных символов. Каждый символ кодируется минимально возможным одинаковым числом бит, пароль — минимально возможным целым числом байтов.${extra ? ` Кроме пароля, для каждого пользователя хранится ${extra} байт дополнительных сведений.` : ''} Сколько байтов нужно для хранения сведений о ${users} пользователях?`, answer: total,
        explain: `Символ: ${bits} бит (2^${bits} ≥ ${N}). Пароль: ${len}·${bits} = ${len * bits} бит → ${bytes} байт.${extra ? ` С доп. сведениями: ${bytes + extra} байт.` : ''} Всего: ${users}·${bytes + extra} = ${total}.`}; },
    12(r) { const {ri, pick} = tl(r);
      const n = ri(30, 90), [a, b] = pick([['111', '2'], ['11', '2'], ['1111', '22']]), [c, d] = pick([['222', '1'], ['22', '1']]);
      let s = '1'.repeat(n), guard = 0; while ((s.includes(a) || s.includes(c)) && guard++ < 10000) { if (s.includes(a)) s = s.replace(a, b); else s = s.replace(c, d); }
      return {text: `Исполнитель Редактор получает строку из ${n} единиц и выполняет программу:\nПОКА нашлось(${a}) ИЛИ нашлось(${c})\n  ЕСЛИ нашлось(${a}) ТО заменить(${a}, ${b})\n  ИНАЧЕ заменить(${c}, ${d})\nКОНЕЦ ПОКА\nКакая строка получится? (Ответ — строка, например 21.)`, answer: s, kind: 'word',
        explain: `Повторяем замены, пока в строке есть «${a}» или «${c}». Остаётся строка ${s}.`}; },
    13(r) { const {ri, pick} = tl(r);
      for (;;) { const m = ri(22, 28), host = 32 - m, a = [ri(10, 220), ri(0, 255), ri(0, 255), 0], mask = [0, 1, 2, 3].map(k => (0xFF00 >> Math.max(0, Math.min(8, m - 8 * k))) & 0xFF), net = a.map((x, k) => x & mask[k]);
        const parity = pick(['чётным', 'нечётным']); let cnt = 0; const base = net.reduce((s, x) => s * 256 + x, 0);
        for (let h = 0; h < 2 ** host; h++) { const ip = base + h, ones = ip.toString(2).split('1').length - 1; if ((ones % 2 === 0) === (parity === 'чётным')) cnt++; }
        return {text: `Сеть задана IP-адресом ${net.join('.')} и маской ${mask.join('.')}. Сколько в этой сети IP-адресов (включая адрес сети и широковещательный), у которых количество единиц в двоичной записи является ${parity}?`, answer: cnt,
          explain: `Под номер узла — ${host} бит, всего ${2 ** host} адресов. Перебрав их, получаем ${cnt} адресов с ${parity === 'чётным' ? 'чётным' : 'нечётным'} числом единиц.`}; } },
    14(r) { const {ri, pick} = tl(r);
      const b = pick([2, 4, 8]), e1 = ri(20, 60), e2 = ri(5, e1 - 3), k = ri(3, 40), digit = b - 1;
      const v = BigInt(b) ** BigInt(e1) + BigInt(b) ** BigInt(e2) - BigInt(k), s = v.toString(b), cnt = s.split(String(digit)).length - 1;
      return {text: `Значение выражения ${b}^${e1} + ${b}^${e2} − ${k} записали в системе счисления с основанием ${b}. Сколько цифр ${digit} содержится в этой записи?`, answer: cnt,
        explain: `${b}^${e1} + ${b}^${e2} − ${k} в системе с основанием ${b} — это ${s.length}-значная запись, в ней ${cnt} цифр ${digit}.`}; },
    15(r) { const {ri, pick} = tl(r);
      for (;;) { const p = ri(3, 12), q = ri(5, 30); const forms = [
          [`(ДЕЛ(x, A) ∧ ¬ДЕЛ(x, ${q})) → (¬ДЕЛ(x, A) ∨ ДЕЛ(x, ${p}))`, (x, A) => !(x % A === 0 && x % q !== 0) || (x % A !== 0 || x % p === 0), 'наименьшего'],
          [`ДЕЛ(x, A) ∨ (ДЕЛ(x, ${p}) → ¬ДЕЛ(x, ${q}))`, (x, A) => x % A === 0 || !(x % p === 0) || x % q !== 0, 'наибольшего']];
        const [f, fn, ask] = pick(forms), ok = A => { for (let x = 1; x <= 1000; x++) if (!fn(x, A)) return false; return true; };
        // A перебираем, как и x, до 1000: НОК(p, q) ≤ 360, так что настоящий ответ всегда попадает в перебор.
        const good = []; for (let A = 1; A <= 1000; A++) if (ok(A)) good.push(A);
        if (!good.length || (ask === 'наибольшего' && good[good.length - 1] === 1000)) continue;
        const ans = ask === 'наименьшего' ? good[0] : good[good.length - 1]; if (ans === 1 && ask === 'наименьшего') continue;
        return {text: `ДЕЛ(n, m) означает «натуральное n делится без остатка на натуральное m». Для какого ${ask} натурального A формула\n${f}\nтождественно истинна (то есть принимает значение 1 при любом натуральном x)?`, answer: ans,
          explain: `Перебираем A и проверяем формулу для всех x до 1000. Подходят A = ${good.slice(0, 5).join(', ')}${good.length > 5 ? ', …' : ''}; ${ask} — ${ans}.`}; } },
    16(r) { const {ri, pick} = tl(r);
      const k = ri(2, 4), c = ri(1, 3), n = ri(10, 25), mode = pick(['sum', 'mul']); const F = [];
      for (let i = 0; i <= n; i++) F[i] = i < k ? i + c : (mode === 'sum' ? F[i - 1] + F[i - 2] + (i % 3 === 0 ? 1 : 0) : F[i - 1] + 2 * F[i - k]);
      const rule = mode === 'sum' ? `F(n) = F(n − 1) + F(n − 2) + 1, если n делится на 3; иначе F(n) = F(n − 1) + F(n − 2)` : `F(n) = F(n − 1) + 2·F(n − ${k})`;
      return {text: `Алгоритм вычисления функции F(n), где n — неотрицательное целое число:\nF(n) = n + ${c} при n < ${k};\n${rule} при n ≥ ${k}.\nЧему равно значение F(${n})?`, answer: F[n],
        explain: `Считаем снизу вверх: F(0)…F(${k - 1}) = ${F.slice(0, k).join(', ')}; дальше по формуле: … F(${n - 1}) = ${F[n - 1]}, F(${n}) = ${F[n]}.`}; },
    19: r => heap(r, 19), 20: r => heap(r, 20), 21: r => heap(r, 21),
    22(r) { const {ri, shuffle} = tl(r);
      for (;;) { const n = ri(7, 11), t = [0], dep = [[]], f = [0];
        // случайный граф зависимостей: процесс зависит только от процессов с меньшими номерами; f — время окончания при неограниченном параллелизме
        for (let i = 1; i <= n; i++) { t[i] = ri(1, 12); dep[i] = i === 1 || r() < 0.2 ? [] : shuffle([...Array(i - 1).keys()].map(x => x + 1)).slice(0, ri(1, Math.min(3, i - 1))).sort((a, b) => a - b); f[i] = t[i] + Math.max(0, ...dep[i].map(d => f[d])); }
        const total = Math.max(...f), path = [f.indexOf(total)]; while (dep[path[0]].length) path.unshift(dep[path[0]].reduce((a, b) => f[b] > f[a] ? b : a));
        if (dep.filter((d, i) => i && !d.length).length < 2 || path.length < 3) continue;
        const byT = r() < 0.35, fs = [...new Set(f.slice(1))].sort((a, b) => a - b), k = ri(0, fs.length - 2), T = fs[k] + 1 < fs[k + 1] ? ri(fs[k] + 1, fs[k + 1] - 1) : 0, done = f.map((x, i) => i && x <= T ? i : 0).filter(Boolean);
        if (byT && (!T || done.length < 2 || done.length > n - 2)) continue;
        return {text: `Вычислительная система выполняет ${n} процессов. Процесс B зависит от процесса A, если ему нужны результаты A: тогда B может начаться только после того, как A завершится. В таблице для каждого процесса указаны его номер (ID), время выполнения в миллисекундах и через «;» номера процессов, от которых он зависит (0 — процесс независимый). ${byT ? `Каждый процесс начинается сразу, как только завершились все процессы, от которых он зависит (независимые — в момент запуска системы), одновременно может выполняться любое число процессов. Сколько процессов завершится не позднее чем через ${T} мс после запуска системы?` : 'Определите минимальное время (в мс), через которое завершится выполнение всех процессов, если независимые друг от друга процессы могут выполняться параллельно, а число одновременно выполняемых процессов не ограничено.'}`,
          table: [['ID процесса', 'Время выполнения, мс', 'ID процессов, от которых зависит'], ...t.slice(1).map((x, i) => [String(i + 1), String(x), dep[i + 1].join(';') || '0'])], answer: byT ? done.length : total,
          explain: `Время окончания процесса — его длительность плюс наибольшее время окончания процессов, от которых он зависит: ${f.slice(1).map((x, i) => `${i + 1} — ${x}`).join(', ')}. ${byT ? `Не позднее ${T} мс завершаются процессы ${done.join(', ')} — всего ${done.length}.` : `Позже всех, через ${total} мс, завершается процесс ${path[path.length - 1]}; самая длинная цепочка — ${path.join(' → ')}.`}`}; } },
    23(r) { const {ri, pick} = tl(r);
      for (;;) { const a = ri(1, 4), b = ri(18, 40), via = ri(a + 3, b - 4), avoid = ri(via + 1, b - 1), [c2, f2] = pick([['умножь на 2', x => x * 2], ['прибавь 2', x => x + 2], ['прибавь 3', x => x + 3]]);
        const ways = (from, to, bad) => { const w = Array(to + 1).fill(0); w[from] = 1; for (let x = from; x <= to; x++) { if (x === bad && x !== from) { w[x] = 0; continue; } if (!w[x]) continue; for (const nx of [x + 1, f2(x)]) if (nx <= to) w[nx] += w[x]; } return w[to]; };
        const ans = ways(a, via, -1) * ways(via, b, avoid); if (ans < 3 || ans > 100000) continue;
        return {text: `Исполнитель преобразует число на экране. Команды: 1. Прибавь 1; 2. ${c2[0].toUpperCase() + c2.slice(1)}. Сколько существует программ, которые исходное число ${a} преобразуют в число ${b}, причём траектория вычислений содержит число ${via} и не содержит числа ${avoid}?`, answer: ans,
          explain: `Число программ считаем по цепочке: из ${a} в ${via} — ${ways(a, via, -1)}, из ${via} в ${b} в обход ${avoid} — ${ways(via, b, avoid)}; произведение ${ans}.`}; } },
  };
  const TITLES = {1: 'Граф и таблица дорог', 2: 'Таблица истинности', 4: 'Код Фано', 5: 'Алгоритм над двоичной записью', 6: 'Черепаха и точки', 7: 'Объём изображений', 8: 'Комбинаторика слов', 11: 'Пароли и объём', 12: 'Редактор', 13: 'IP-адреса и маски', 14: 'Системы счисления', 15: 'Логика ДЕЛ', 16: 'Рекурсия', 19: 'Игра: выигрыш за ход', 20: 'Игра: стратегия Пети', 21: 'Игра: стратегия Вани', 22: 'Параллельные процессы', 23: 'Количество программ'};
  // Звёзды учеников хранятся по номеру уровня в списке (ege-1, ege-2, …): прежние 12 заданий остаются на своих местах, новые — в конце.
  const OLD = [4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 23];
  const LEVELS = [...OLD, ...Object.keys(T).map(Number).filter(n => !OLD.includes(n))].map(n => ({n, title: `Задание ${n}. ${TITLES[n]}`}));
  const problems = (lv, seed) => { const r = rng(seed * 131 + lv.n * 977); return [0, 1, 2].map(() => T[lv.n](r)); };
  // задание 2: буквы подряд (пробелы, запятые, заглавные и русские «х», «у» прощаются); задание 20: два числа по возрастанию через пробел, запятую или «;»
  const same = (p, a) => p.kind === 'word' ? String(a).trim().replace(/\s+/g, '') === String(p.answer) : p.kind === 'vars' ? String(a).trim().toLowerCase().replace(/[\s,;]+/g, '').replace(/х/g, 'x').replace(/у/g, 'y') === p.answer
    : p.kind === 'pair' ? String(a).trim().split(/[\s,;]+/).map(Number).join(' ') === p.answer : String(a).trim() !== '' && Number(String(a).trim().replace(',', '.')) === Number(p.answer);
  // схема дорог (задание 1): пункты с буквами, дороги без длин; таблица — первая строка заголовком, на узком экране прокручивается
  const NS = 'http://www.w3.org/2000/svg', svgEl = (t, a, x) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); if (x != null) n.textContent = x; return n; };
  const graphSvg = g => { const s = svgEl('svg', {viewBox: '0 0 530 350', class: 'og-graph', role: 'img'}); s.append(svgEl('title', {}, 'Схема дорог: ' + g.edges.map(([a, b]) => g.names[a] + '–' + g.names[b]).join(', ')));
    for (const [a, b] of g.edges) s.append(svgEl('line', {x1: g.pos[a][0], y1: g.pos[a][1], x2: g.pos[b][0], y2: g.pos[b][1], stroke: '#8fa6d6', 'stroke-width': 3}));
    g.names.forEach((nm, i) => s.append(svgEl('circle', {cx: g.pos[i][0], cy: g.pos[i][1], r: 20, fill: '#243253', stroke: '#ffd34d', 'stroke-width': 3}), svgEl('text', {x: g.pos[i][0], y: g.pos[i][1] + 6, 'text-anchor': 'middle', fill: '#fff', 'font-weight': 800, 'font-size': 17}, nm))); return s; };
  const tableEl = (el, rows) => { const box = el('div', 'og-tscroll'), t = el('table', 'lab-table og-table'); rows.forEach((row, i) => { const tr = el('tr'); for (const c of row) tr.append(el(i ? 'td' : 'th', '', String(c))); t.append(tr); }); box.append(t); return box; };
  function check(lv, ans) {
    if (!ans || !Number.isInteger(ans.seed) || !Array.isArray(ans.answers) || ans.answers.length !== 3) return {ok: false, msg: 'Ответь на все три варианта.'};
    const good = problems(lv, ans.seed).filter((p, i) => same(p, ans.answers[i])).length;
    return good ? {ok: true, stars: good, msg: `Сбито щитов: ${good} из 3.`} : {ok: false, msg: 'Ни один щит не сбит — разбери решения и попробуй снова.'};
  }
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task og-head'), box = el('div', 'lab-panel og-box'), msg = el('p', 'lab-msg'), boss = el('div', 'og-boss'), shields = el('div', 'og-shields'); let seed = Math.floor(Math.random() * 1e6), ps = problems(lv, seed), k = 0, answers = [], forced = null;
    task.append(el('h2', '', `${lv.title} · ЕГЭ`), el('p', '', 'Три варианта задания ЕГЭ подряд. Каждый верный ответ сбивает щит экзаменатора — сколько щитов, столько звёзд. После ответа — разбор.'));
    boss.append(el('span', 'og-bossname', 'Экзаменатор ЕГЭ'), shields);
    const paint = () => shields.replaceChildren(...[0, 1, 2].map(i => el('i', i < answers.length ? (same(ps[i], answers[i]) ? 'broken' : 'held') : i === k ? 'now' : '')));
    function show() { paint();
      if (k >= 3) { const r = check(lv, {seed, answers}); if (r.ok) api.finish(r.stars, r.msg); else box.replaceChildren(el('p', 'lab-msg bad', r.msg), button('Новые варианты', 'lab-main', () => { seed++; ps = problems(lv, seed); k = 0; answers = []; show(); })); return; }
      const p = ps[k], form = el('form', 'og-form'), inp = el('input'); inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Ответ'); const go = button('⚔ Ответить', 'lab-main', () => form.requestSubmit()); go.dataset.act = 'run'; form.append(el('span', '', 'Ответ:'), inp, go);
      form.addEventListener('submit', e => { e.preventDefault(); if (forced) { const r = check(lv, forced); if (r.ok) api.finish(r.stars, r.msg); return; } if (!inp.value.trim()) return; answers.push(inp.value); const ok = same(p, inp.value); k++; paint();
        boss.classList.remove('hit', 'miss'); void boss.offsetWidth; boss.classList.add(ok ? 'hit' : 'miss');
        msg.className = 'lab-msg ' + (ok ? 'good' : 'bad'); msg.textContent = (ok ? 'Щит сбит! ' : `Щит устоял. Правильный ответ: ${p.answer}. `) + p.explain; const next = button(k < 3 ? 'Следующий щит →' : 'Итог боя', 'lab-main', show); form.replaceWith(next); next.focus(); });
      const fig = []; if (p.graph || p.table) { const w = el('div', p.graph && p.table ? 'og-pair' : ''); if (p.graph) w.append(graphSvg(p.graph)); if (p.table) w.append(tableEl(el, p.table)); fig.push(w); }
      box.replaceChildren(el('p', 'lab-eyebrow', `ЩИТ ${k + 1} ИЗ 3`), el(p.text.includes('\n') ? 'pre' : 'p', p.text.includes('\n') ? 'og-code' : 'og-text', p.text), ...fig, form, msg); msg.textContent = ''; msg.className = 'lab-msg'; setTimeout(() => inp.focus(), 50); }
    host.classList.add('og-arena'); host.append(task, boss, box); show(); if (api.debugHost) window.labSet = a => { forced = a; };
  }
  LAB.register({id: 'ege', bg: 'oge_arena', hero: 'oge_host', title: 'ЕГЭ-арена', genre: 'подготовка к ЕГЭ', art: '🏆', color: '#ffb347', unit: 'Задание', minutes: 45,
    about: 'Восемнадцать заданий ЕГЭ по информатике, которые решаются без компьютера: граф и таблица дорог, таблица истинности, код Фано, алгоритмы, Черепаха, объёмы, комбинаторика, Редактор, маски, системы счисления, ДЕЛ, рекурсия, игра с кучей камней, параллельные процессы и программы исполнителя. Варианты каждый раз новые.',
    levels: () => LEVELS, mount, check, solve: lv => ({seed: 1, answers: problems(lv, 1).map(p => String(p.answer))}), LEVELS, problems, T});
})();
