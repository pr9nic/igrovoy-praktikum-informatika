// Проверка «Архиватора» без браузера: node tools/lab/tests/archiver.test.js
// На 300 зёрнах каждого уровня: задачи корректны, образцовый ответ проходит, неверные — нет; ответы пересчитываются здесь заново,
// своими способами: RLE — циклом, условие Фано — перебором всех двоичных строк, Хаффман — перебором длин кодов (неравенство Крафта),
// задание 4 ЕГЭ — перебором длин слов по возрастанию стоимости и полным перебором размещения слов в дереве (с запасом по длине).
const path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); require(path.join(dir, 'games', 'archiver.js'));
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };
const g = LAB.games.find(x => x.id === 'archiver'), {LEVELS, G, variant} = g, SEEDS = 300, L = kind => LEVELS.find(l => l.kind === kind);
const each = (lv, fn) => { for (let s = 1; s <= SEEDS; s++) for (let k = 0; k < lv.rounds; k++) { const p = variant(lv, s, k, k), r = fn(p, k, s); if (r) return `зерно ${s}, раунд ${k + 1}: ${r}`; } return ''; };
const judge = (lv, p, a) => G[lv.kind].judge(p, a), good = (lv, p, a) => { const r = judge(lv, p, a); return r.ok && r.miss === 0; }, wrong = (lv, p, a) => { const r = judge(lv, p, a); return !r.ok && r.miss >= 1; };
// Независимые помощники.
const runs = s => { const out = []; for (const c of s) if (out.length && out[out.length - 1][0] === c) out[out.length - 1][1]++; else out.push([c, 1]); return out; };
const enc = s => runs(s).map(([c, n]) => n + c).join(' ');
const dec = t => t.split(' ').map(x => x.slice(-1).repeat(Number(x.slice(0, -1)))).join('');
const allBits = n => Array.from({length: 2 ** n}, (_, v) => v.toString(2).padStart(n, '0'));
// Условие Фано перебором: ни одна двоичная строка длины maxLen не начинается сразу с двух кодовых слов (одинаковые слова тоже ловятся).
const fanoBrute = codes => { const D = Math.max(...codes.map(c => c.length)); return allBits(D).every(s => codes.filter(c => s.slice(0, c.length) === c).length <= 1); };
const pairwise = codes => codes.every((a, i) => codes.every((b, j) => i === j || b.slice(0, a.length) !== a));
// Все способы прочитать строку битов (для проверки однозначности расшифровки).
const parses = (bits, letters, codes) => { const out = []; const go = (i, w) => { if (out.length > 3) return; if (i === bits.length) { out.push(w); return; } codes.forEach((c, q) => { if (bits.startsWith(c, i)) go(i + c.length, w + letters[q]); }); }; go(0, ''); return out; };
// Можно ли разместить слова ровно таких длин рядом с известными кодами (полный перебор).
const place = (set, lens) => { if (!lens.length) return true; const [l, ...rest] = lens; for (const s of allBits(l)) if (pairwise([...set, s]) && place([...set, s], rest)) return true; return false; };
// Наименьшая стоимость Σ w·длина: векторы длин по возрастанию стоимости, первый размещаемый — ответ. Запас по длине больше, чем у игры.
const optFill = (known, w) => { const Lmax = Math.max(...known.map(c => c.length)) + w.length + 3, vecs = []; const gen = v => { if (v.length === w.length) { vecs.push(v); return; } for (let l = 1; l <= Lmax; l++) gen([...v, l]); }; gen([]);
  const cost = v => v.reduce((s, l, i) => s + w[i] * l, 0); vecs.sort((a, b) => cost(a) - cost(b)); for (const v of vecs) if (place(known, v)) return cost(v); return Infinity; };
// Оптимальный префиксный код перебором длин: Σ 2^−l ≤ 1 (неравенство Крафта) — такой код существует; ищем наименьшую Σ f·l.
const kraftOpt = f => { let best = Infinity; const n = f.length; const go = (i, kr, cost) => { if (kr > 1 + 1e-12 || cost >= best) return; if (i === n) { best = cost; return; } for (let l = 1; l < n; l++) go(i + 1, kr + 2 ** -l, cost + f[i] * l); }; go(0, 0, 0); return best; };
// Две ли это наименьшие частоты среди свободных вершин (своя проверка, не игровая).
const isMin = (t, a, b) => { const ws = t.roots.map(i => t.nodes[i].w).sort((x, y) => x - y); return Math.min(t.nodes[a].w, t.nodes[b].w) === ws[0] && Math.max(t.nodes[a].w, t.nodes[b].w) === ws[1]; };
const rng = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

// 1. Уровни и образцовые решения.
{ const ok = [9, 10, 11].every(gr => g.levels(gr).length === 12) && [6, 7, 8].every(gr => g.levels(gr).length === 9) && LEVELS.every(lv => { const r = g.check(lv, g.solve(lv)); return r.ok && r.stars === 3; });
  check('уровни: 12 в 9–11 классах, 9 в 6–8; образцовые решения проходят на три звезды', ok); }
{ let info = ''; for (const lv of LEVELS) { const a = JSON.stringify(variant(lv, 42, 1, 0), (k, v) => typeof v === 'function' ? 'f' : v), b = JSON.stringify(variant(lv, 42, 1, 0), (k, v) => typeof v === 'function' ? 'f' : v); if (a !== b) info = lv.title;
    const seen = new Set(); for (let s = 1; s <= 100; s++) seen.add(JSON.stringify(variant(lv, s, 0, lv.rounds - 1), (k, v) => typeof v === 'function' ? 'f' : v)); if (seen.size < 90) info = `${lv.title}: различных вариантов ${seen.size} из 100`; }
  check('варианты задаются зерном (повторяются) и почти всегда различаются между зёрнами', !info, info); }

// 2. RLE.
{ const lv = L('rleEnc'); const info = each(lv, p => { const want = enc(p.s), rs = runs(p.s);
    if (p.s.length < 8 || p.s.length > 30 || rs.length < 3 || !/^[БЧКСЖФ]+$|^[АБВГДЕ]+$/.test(p.s)) return 'негодная строка ' + p.s;
    if (G.rleEnc.solve(p) !== want || dec(want) !== p.s) return 'образец не совпал с независимым кодированием';
    if (!good(lv, p, want) || !good(lv, p, want.replace(/ /g, '')) || !good(lv, p, rs.map(([c, n]) => `(${n}, ${c.toLowerCase()})`).join(' '))) return 'верный ответ не принят: ' + want;
    const [c0, n0] = rs[0], tail = rs.slice(1).map(([c, n]) => n + c).join(' ');
    if (!wrong(lv, p, `${n0 + 1}${c0} ${tail}`) || !wrong(lv, p, `${n0}${rs[1][0]} ${tail}`) || !wrong(lv, p, rs.map(([c, n]) => c + n).join(' ')) || !wrong(lv, p, '') || !wrong(lv, p, null) || !wrong(lv, p, '99999999999Б')) return 'принят неверный ответ';
    if (n0 > 1 && !wrong(lv, p, `1${c0} ${n0 - 1}${c0} ${tail}`)) return 'принята серия, разбитая на две пары'; });
  check('RLE, сжатие: код сходится с независимым кодированием, разбитые серии и ошибки в парах не проходят (300 зёрен)', !info, info); }
{ const lv = L('rleDec'); const info = each(lv, p => { if (dec(p.code) !== p.s || enc(p.s) !== p.code || p.s.length < 8 || p.s.length > 24) return 'код не восстанавливает строку';
    if (!p.alpha.includes('Б') || [...p.s].some(c => !p.alpha.includes(c))) return 'в палитре нет нужного цвета';
    if (!good(lv, p, p.s)) return 'верная строка не принята';
    const i = Math.floor(p.s.length / 2), other = p.alpha.find(c => c !== p.s[i]); if (!wrong(lv, p, p.s.slice(0, i) + other + p.s.slice(i + 1)) || !wrong(lv, p, p.s.slice(1)) || !wrong(lv, p, 'Б'.repeat(p.s.length)) || !wrong(lv, p, [])) return 'принята неверная строка'; });
  check('RLE, распаковка: строка восстанавливается однозначно, клетка не того цвета не проходит (300 зёрен)', !info, info); }
{ const lv = L('rleSize'); let worse = 0, split = 0; const info = each(lv, (p, k) => { const rs = runs(p.s), pairs = rs.reduce((s, [, n]) => s + Math.ceil(n / 255), 0), B = 2 * pairs, N = p.s.length;
    const want = [...(k === 2 ? [pairs] : []), B, N / B]; if (p.fields.length !== want.length || p.fields.some((f, i) => Math.abs(f.want - want[i]) > 1e-12)) return `поля ${JSON.stringify(p.fields)} ≠ ${want}`;
    if (!Number.isInteger(N * 100 / B)) return 'коэффициент не точный'; if (B > N) worse++; if (pairs > rs.length) split++;
    const txt = want.map(x => String(x).replace('.', ',')); if (!good(lv, p, txt) || !good(lv, p, want.map(String))) return 'верные числа не приняты';
    for (let i = 0; i < want.length; i++) { const w = txt.slice(); w[i] = String(want[i] + (i === want.length - 1 ? 0.01 : 2)); if (!wrong(lv, p, w)) return 'принято неверное поле ' + i; }
    if (!wrong(lv, p, txt.slice(0, -1)) || !wrong(lv, p, 'abc')) return 'принят неполный ответ';
    if (k === 2 && (p.text.match(/\d+ символ/g) || []).length !== rs.length) return 'описание файла не совпало с сериями'; });
  check('RLE, объём: пары, байты и коэффициент сходятся с пересчётом (счётчик до 255), есть варианты, где RLE увеличивает объём', !info && worse >= SEEDS && split >= SEEDS, info || `хуже: ${worse}, длинные серии: ${split}`); }

// 3. Префиксные коды.
{ let info = ''; const r = rng(7); for (let c = 0; c < 3000 && !info; c++) { const n = 2 + Math.floor(r() * 5), codes = Array.from({length: n}, () => allBits(1 + Math.floor(r() * 4))[0].replace(/0/g, () => r() < .5 ? '0' : '1'));
    if (g.fano(codes) !== fanoBrute(codes) || g.fano(codes) !== !g.clash(codes).length) info = JSON.stringify(codes); }
  check('условие Фано: проверка игры совпадает с перебором всех двоичных строк на 3000 случайных наборах', !info, info); }
{ const lv = L('fano'); let yes = 0, no = 0; const info = each(lv, p => { const f = fanoBrute(p.codes); if (new Set(p.codes).size !== p.codes.length || p.codes.length !== p.letters.length) return 'повтор кода';
    if (g.fano(p.codes) !== f) return 'Фано не сходится с перебором'; f ? yes++ : no++; if (!good(lv, p, G.fano.solve(p))) return 'образец не принят';
    const pairs = []; p.codes.forEach((a, i) => p.codes.forEach((b, j) => { if (i < j) pairs.push([i, j, a.startsWith(b) || b.startsWith(a)]); }));
    if (f) { if (!wrong(lv, p, [0, 1]) || !wrong(lv, p, null)) return 'принят ответ «нарушено» для кода Фано'; }
    else { if (!wrong(lv, p, 'ok')) return 'принят ответ «выполнено» для кода не Фано'; for (const [i, j, hit] of pairs) if (hit !== good(lv, p, [i, j]) || hit !== good(lv, p, [j, i])) return `пара ${i},${j} оценена неверно`; } });
  check('условие Фано, уровень: ответ сходится с перебором, засчитывается только конфликтная пара; есть оба случая', !info && yes > SEEDS / 2 && no > SEEDS / 2, info || `выполнено ${yes}, нарушено ${no}`); }
{ const lv = L('decode'); const info = each(lv, p => { if (!fanoBrute(p.codes)) return 'код не префиксный'; const all = parses(p.bits, p.letters, p.codes);
    if (all.length !== 1 || all[0] !== p.word) return 'строка читается не единственным способом: ' + all; if (!good(lv, p, p.word) || !good(lv, p, ' ' + p.word.toLowerCase() + ' ')) return 'верное слово не принято';
    const i = p.word.length - 1, o = p.letters.find(c => c !== p.word[i]); if (!wrong(lv, p, p.word.slice(0, i) + o) || !wrong(lv, p, p.word.slice(1)) || !wrong(lv, p, p.word + 'Ж') || !wrong(lv, p, '')) return 'принято неверное слово'; });
  check('расшифровка: строка битов читается единственным способом (полный перебор разбиений), неверное слово не проходит', !info, info); }
{ const lv = L('complete'); const info = each(lv, p => { const m = p.missing.length, best = optFill(p.known, Array(m).fill(1)); if (best !== p.best) return `минимум ${p.best}, перебор даёт ${best}`;
    const all = [...p.known, ...p.witness]; if (!fanoBrute(all) || p.witness.join('').length !== best) return 'образец не годится'; if (!good(lv, p, p.witness)) return 'образец не принят';
    const longer = p.witness.slice(); longer[0] += '0'; if (!wrong(lv, p, longer) || !wrong(lv, p, p.witness.slice(1)) || !wrong(lv, p, p.witness.map(() => '')) || !wrong(lv, p, 'abc')) return 'принят неверный набор';
    const clash = p.witness.slice(); clash[0] = p.known[0]; if (!wrong(lv, p, clash)) return 'принят код, совпадающий с известным';
    const pre = p.witness.slice(); pre[0] = p.known[p.known.length - 1].slice(0, -1) || '0'; if (fanoBrute([...p.known, ...pre]) === false && !wrong(lv, p, pre)) return 'принят код, нарушающий Фано';
    // любой другой верный набор той же длины тоже засчитывается
    const alt = []; const go = (i, cur) => { if (alt.length) return; if (i === m) { if (cur.join('').length === best && cur.join() !== p.witness.join()) alt.push(cur); return; } for (let l = 1; l <= 6; l++) for (const s of allBits(l)) if (pairwise([...p.known, ...cur, s])) go(i + 1, [...cur, s]); }; if (m <= 2) { go(0, []); if (alt.length && !good(lv, p, alt[0])) return 'не принят другой оптимальный набор ' + alt[0]; } });
  check('достройка кода: минимум сходится с полным перебором (запас длины +2), длиннее и с нарушением Фано — не проходит', !info, info); }

// 4. Хаффман.
{ let info = ''; const r = rng(11); for (let c = 0; c < 400 && !info; c++) { const n = 2 + Math.floor(r() * 5), f = Array.from({length: n}, () => 1 + Math.floor(r() * 12)), t = g.huff(f, g.huffRef(f));
    if (!t.done || t.total !== kraftOpt(f) || !fanoBrute(t.code)) info = JSON.stringify(f) + ' → ' + t.total + ' / ' + kraftOpt(f); }
  check('Хаффман: длина сообщения совпадает с оптимальным префиксным кодом (перебор длин по Крафту) на 400 алфавитах из 2–6 букв', !info, info); }
{ let info = ''; const r = rng(5);
  // При равных частотах любая из пар наименьших допустима, и итог всё равно оптимален: обходим все допустимые порядки склеек.
  for (let c = 0; c < 60 && !info; c++) { const n = 3 + Math.floor(r() * 3), f = Array.from({length: n}, () => 1 + Math.floor(r() * 4)), opt = kraftOpt(f);
    const go = merges => { const t = g.huff(f, merges); if (t.miss) { info = 'допустимая склейка отклонена'; return; } if (t.done) { if (t.total !== opt) info = `${f}: ${t.total} ≠ ${opt}`; return; }
      for (const a of t.roots) for (const b of t.roots) if (a < b && isMin(t, a, b)) go([...merges, [a, b]]);
      for (const a of t.roots) for (const b of t.roots) if (a !== b && !isMin(t, a, b)) { const u = g.huff(f, [...merges, [a, b]]); if (u.miss !== 1 || u.roots.length !== t.roots.length) info = 'недопустимая склейка не засчитана ошибкой'; } };
    go([]); }
  check('Хаффман: при равных частотах засчитывается любая пара наименьших, итог оптимален; иная пара — ошибка и не выполняется', !info, info); }
for (const kind of ['huffBuild', 'huffLen', 'huffSave']) { const lv = L(kind); const info = each(lv, p => { const ref = G[kind].solve(p), t = g.huff(p.w, ref.merges);
    if (!t.done || t.total !== kraftOpt(p.w) || new Set(p.letters).size !== p.w.length || p.w.some(x => !(x > 0))) return 'дерево не оптимально';
    if (!good(lv, p, ref)) return 'образец не принят';
    const big = t => { const rs = t.roots.slice().sort((a, b) => t.nodes[b].w - t.nodes[a].w); return [rs[0], rs[1]]; }, t0 = g.huff(p.w, []), b0 = big(t0);
    if (!isMin(t0, b0[0], b0[1])) { const r1 = judge(lv, p, {...ref, merges: [b0, ...ref.merges]}); if (!r1.ok || r1.miss !== 1) return 'неверная склейка не засчитана как одна ошибка'; }
    if (!wrong(lv, p, {merges: ref.merges.slice(0, -1), answers: ref.answers}) || !wrong(lv, p, null)) return 'принято недостроенное дерево';
    if (kind === 'huffLen') { const x = p.x, len = t.code[x].length, total = p.w.reduce((s, f, i) => s + f * t.code[i].length, 0); if (ref.answers.join() !== [len, total].join()) return 'ответы не сходятся с деревом';
      if (!wrong(lv, p, {...ref, answers: [String(len + 1), String(total)]}) || !wrong(lv, p, {...ref, answers: [String(len), String(total - 1)]})) return 'принят неверный ответ'; }
    if (kind === 'huffSave') { const N = p.msg.length, n = new Set(p.msg).size, b = Math.ceil(Math.log2(n)), H = kraftOpt([...new Set(p.msg)].map(c => p.msg.split(c).length - 1));
      if (n !== p.letters.length || ref.answers.join() !== [H, N * b, N * b - H].join() || N * b - H <= 0) return 'экономия не сходится с пересчётом по сообщению';
      for (let i = 0; i < 3; i++) { const a = ref.answers.slice(); a[i] = String(+a[i] + 1); if (!wrong(lv, p, {...ref, answers: a})) return 'принят неверный ответ ' + i; } } });
  check(`${lv.title}: дерево оптимально (перебор по Крафту), неверная склейка — ровно одна ошибка, неверные числа не проходят`, !info, info); }

// 5. Задание 4 ЕГЭ.
{ const lv = L('egeSum'); const info = each(lv, p => { const best = optFill(p.known, p.miss.map(() => 1)), want = p.all ? best + p.known.join('').length : best;
    if (!fanoBrute(p.known) || best !== p.best || want !== p.answer) return `ответ ${p.answer}, перебор ${want}`; if (!fanoBrute([...p.known, ...p.words]) || p.words.join('').length !== best) return 'пример не годится';
    if (p.kl.some((l, i) => !p.text.includes(`${l} — ${p.known[i]}`))) return 'в условии нет кода';
    if (!good(lv, p, String(p.answer)) || !wrong(lv, p, String(p.answer - 1)) || !wrong(lv, p, String(p.answer + 1)) || !wrong(lv, p, '')) return 'проверка ответа неверна'; });
  check('ЕГЭ-4, сумма длин: ответ сходится с независимым перебором (300 зёрен)', !info, info); }
{ const lv = L('egeShort'); const info = each(lv, p => { const Lmax = Math.max(...p.known.map(c => c.length)) + 4; let want = null;
    for (let l = 1; l <= Lmax && !want; l++) for (const s of allBits(l)) if (pairwise([...p.known, s]) && (!p.extra || Array.from({length: Lmax}, (_, q) => q + 1).some(q => place([...p.known, s], [q])))) { want = s; break; }
    if (want !== p.answer) return `ответ ${p.answer}, перебор ${want}`; if (!good(lv, p, p.answer)) return 'верный ответ не принят';
    const others = []; for (let l = 1; l <= p.answer.length + 1; l++) for (const s of allBits(l)) if (s !== p.answer) others.push(s); if (others.some(s => !wrong(lv, p, s))) return 'принято другое слово';
    if (p.extra && p.answer === (() => { for (let l = 1; l <= Lmax; l++) for (const s of allBits(l)) if (pairwise([...p.known, s])) return s; })()) return 'условие про вторую букву ни на что не влияет'; });
  check('ЕГЭ-4, кратчайший код: слово сходится с перебором по длине и значению, другие слова не проходят, условие «оставить место» влияет', !info, info); }
{ const lv = L('egeMsg'); const info = each(lv, p => { const w = p.miss.map(l => p.msg.split(l).length - 1), fixed = p.kl.reduce((s, l, i) => s + (p.msg.split(l).length - 1) * p.known[i].length, 0), want = optFill(p.known, w) + fixed;
    if (want !== p.answer) return `ответ ${p.answer}, перебор ${want}`; const code = l => p.kl.includes(l) ? p.known[p.kl.indexOf(l)] : p.words[p.miss.indexOf(l)];
    if (!fanoBrute([...p.known, ...p.words]) || [...p.msg].map(code).join('').length !== p.answer) return 'пример кода не даёт ответ';
    if (!good(lv, p, String(p.answer)) || !wrong(lv, p, String(p.answer - 1)) || !wrong(lv, p, String(p.answer + 1))) return 'проверка ответа неверна'; });
  check('ЕГЭ-4, длина сообщения: ответ сходится с независимым перебором, пример кода даёт эту длину', !info, info); }

// 6. Звёзды по числу ошибок, журнал попыток, мусорные ответы.
{ let info = ''; const bads = {rleEnc: () => '1Б', rleDec: () => '', rleSize: () => ['0', '0', '0'], fano: p => g.fano(p.codes) ? [0, 1] : 'ok', decode: () => '', complete: () => [], huffBuild: () => ({}), huffLen: () => ({}), huffSave: () => ({}), egeSum: () => '-1', egeShort: () => '2', egeMsg: () => '-1'};
  for (const lv of LEVELS) for (const seed of [3, 77]) { const log = mistakes => { const out = []; let k = 0, t = 0; for (let m = 0; m < mistakes; m++, t++) out.push(bads[lv.kind](variant(lv, seed, t, k))); for (; k < lv.rounds; k++, t++) out.push(G[lv.kind].solve(variant(lv, seed, t, k))); return {seed, log: out}; };
    const st = [0, 1, 2, 3].map(m => g.check(lv, log(m))); if (st.map(r => r.ok && r.stars).join() !== '3,2,1,1' || st.map(r => r.miss).join() !== '0,1,2,3') info = `${lv.title}: ${st.map(r => r.stars + '/' + r.miss)}`;
    const part = log(0); part.log.pop(); if (g.check(lv, part).ok) info = `${lv.title}: засчитан неполный журнал`;
    for (const junk of [null, {}, {seed: 1}, {seed: 1, log: 'x'}, {seed: 1, log: [null, 5, 'z', {merges: [[0, 0]]}]}, {seed: 1.5, log: []}]) try { if (g.check(lv, junk).ok) info = `${lv.title}: засчитан мусор`; } catch (e) { info = `${lv.title}: исключение ${e.message}`; } }
  const hl = L('huffBuild'), ref = G.huffBuild.solve(variant(hl, 9, 0, 0)), t0 = g.huff(variant(hl, 9, 0, 0).w, []), [a, b] = t0.roots.slice().sort((x, y) => t0.nodes[y].w - t0.nodes[x].w), withBad = {seed: 9, log: [{merges: [[a, b], ...ref.merges]}, ...g.solve(hl).log.slice(1).map((_, k) => G.huffBuild.solve(variant(hl, 9, k + 1, k + 1)))]};
  const r = g.check(hl, withBad); if (!isMin(t0, a, b) && (!r.ok || r.stars !== 2)) info = 'неверная склейка Хаффмана не сняла звезду: ' + JSON.stringify(r);
  check('звёзды: без ошибок — 3, одна — 2, две и больше — 1 (и неверная склейка Хаффмана — ошибка); неполный журнал и мусор не проходят', !info, info); }
{ const ok = g.parseRle('4б 3Ч') && g.parseRle('(4, Б), (3, Ч)').length === 2 && !g.parseRle('Б4') && !g.parseRle('4') && g.parseRle('2K 1C').map(x => x[1]).join('') === 'КС';
  check('разбор RLE: пробелы, скобки, запятые и латинские буквы-двойники допускаются, «Б4» — нет', !!ok); }

console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
