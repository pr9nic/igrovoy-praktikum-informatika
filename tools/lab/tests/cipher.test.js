// Проверка «Шифровальни» без браузера: node tools/lab/tests/cipher.test.js
// На 400 вариантах каждого уровня: задание собрано верно, образцовый ответ и его небрежные записи (регистр, пробелы, Ё) принимаются, неверные — нет;
// ответы сходятся с независимым пересчётом (свои реализации шифров по кодам букв), шифры обратимы, частотный анализ решается по «О», параметры RSA верны.
const path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); require(path.join(dir, 'games', 'cipher.js'));
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };
const g = LAB.games.find(x => x.id === 'cipher'), SEEDS = 400, lv = id => g.LEVELS.find(l => l.id === id);
// Независимые реализации: буквы А–Я без Ё идут в Юникоде подряд (U+0410…U+042F).
const code = c => c.charCodeAt(0) - 0x410, chr = n => String.fromCharCode(0x410 + (n % 32 + 32) % 32), only = s => s.replace(/[^А-Я]/g, '');
const shift = (s, k) => s.replace(/[А-Я]/g, c => chr(code(c) + k));
const vigenere = (s, key, sign) => { let j = 0; return s.replace(/[А-Я]/g, c => chr(code(c) + sign * code(key[j++ % key.length]))); };
// Перестановки — через двумерную таблицу: строки по c символов, пробел и хвост — «_».
const table = (s, c) => { const t = s.replace(/ /g, '_').padEnd(Math.ceil(s.length / c) * c, '_'), rows = []; for (let i = 0; i < t.length; i += c) rows.push([...t.slice(i, i + c)]); return rows; };
const readCols = (rows, order) => order.map(j => rows.map(r => r[j]).join(''));
const scytale = (s, c) => readCols(table(s, c), [...Array(c).keys()]).join('');
const unScytale = (t, c) => { if (t.length % c) return null; const r = t.length / c, cols = Array.from({length: c}, (_, j) => t.slice(j * r, j * r + r)); let out = ''; for (let i = 0; i < r; i++) for (const col of cols) out += col[i]; return out; };
const permute = (s, key) => readCols(table(s, key.length), key.map((k, j) => [k, j]).sort((a, b) => a[0] - b[0]).map(x => x[1]));
const unPermute = (blocks, key) => { const cols = key.map(k => blocks[k - 1]); let out = ''; for (let i = 0; i < cols[0].length; i++) for (const col of cols) out += col[i]; return out; };
const isPrime = n => n > 1 && Array.from({length: n - 2}, (_, i) => i + 2).every(d => n % d);
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; }, powmod = (b, e, m) => { const M = BigInt(m); let r = 1n % M, x = BigInt(b) % M; for (let k = BigInt(e); k > 0n; k >>= 1n, x = x * x % M) if (k & 1n) r = r * x % M; return Number(r); };
const unspace = s => s.replace(/_/g, ' ').trim().replace(/ +/g, ' '), PH = new Set(g.PHRASES), WD = new Set(g.WORDS), VOC = new Set([...g.WORDS, ...g.PHRASES.flatMap(p => p.split(' '))]);
const sense = t => t.split(/[ .]+/).filter(Boolean).every(w => VOC.has(w));
// Небрежные записи верного ответа и заведомо неверные ответы.
const loose = a => { const s = String(a); return [s.toLowerCase(), s.replace(/ /g, ''), ' ' + [...s].join(' ') + ' ', s.replace(/Е/g, 'Ё'), s.toLowerCase().replace(/е/g, 'ё'), s + '.', s.replace(/ /g, '_'), s.replace(/ /g, '  ')]; };
const looseNum = n => [String(n), ` ${n} `, String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), '+' + n];
const spoil = a => { const s = String(a), i = s.search(/[А-Я]/); return [s.slice(0, i) + chr(code(s[i]) + 1) + s.slice(i + 1), only(s).slice(0, -1), '', 'АБВ']; };
const spoilNum = n => [n + 1, n - 1, 0, '', 'сорок', -n].filter(x => x !== n);
const errs = {}, fail = (id, s, what) => { if (!errs[id]) errs[id] = `вариант ${s}: ${what}`; };
const clean = x => typeof x === 'string' && x.trim() !== '' && !/undefined|NaN|null|\[object/.test(x);

// Алфавит и тексты.
check('алфавит — 32 буквы без Ё, подряд в Юникоде', g.ALPHABET.length === 32 && !g.ALPHABET.includes('Ё') && [...g.ALPHABET].every((c, i) => code(c) === i));
check('фразы и слова: только заглавные буквы без Ё и одиночные пробелы, без повторов', [...g.PHRASES, ...g.WORDS, ...g.KEYS].every(p => /^[А-Я]+( [А-Я]+)*$/.test(p)) && PH.size === g.PHRASES.length && WD.size === g.WORDS.length && g.PHRASES.length >= 30 && g.WORDS.length >= 40);
check('ключи Виженера без буквы А (сдвиг 0 ничего не шифрует)', g.KEYS.every(k => !k.includes('А') && k.length >= 3 && k.length <= 4));
check('ответ читается терпимо: регистр, пробелы, знаки, Ё = Е', g.norm(' ёжик в Тумане! ') === 'ЕЖИКВТУМАНЕ' && g.norm('Ё-Ё') === 'ЕЕ' && g.int(' 1 048 576 ') === 1048576 && Number.isNaN(g.int('12a')) && Number.isNaN(g.int('')));

// Шифры обратимы и совпадают с независимыми реализациями на случайных текстах.
{ let ok = true, info = ''; const A = g.ALPHABET, rnd = (n => () => (n = (n * 1103515245 + 12345) % 2147483648) / 2147483648)(7);
  for (let t = 0; t < 3000 && ok; t++) { const len = 1 + Math.floor(rnd() * 30), s = Array.from({length: len}, () => rnd() < 0.15 ? ' ' : A[Math.floor(rnd() * 32)]).join(''), k = Math.floor(rnd() * 70) - 35, key = Array.from({length: 1 + Math.floor(rnd() * 5)}, () => A[Math.floor(rnd() * 32)]).join(''), c = 2 + Math.floor(rnd() * 6), kp = [...Array(c).keys()].map(i => i + 1).sort(() => rnd() - 0.5);
    if (g.caesar(g.caesar(s, k), -k) !== s || g.caesar(s, k) !== shift(s, k)) { ok = false; info = `Цезарь: «${s}», ${k}`; }
    if (g.vig(g.vig(s, key), key, -1) !== s || g.vig(s, key) !== vigenere(s, key, 1)) { ok = false; info = `Виженер: «${s}», ${key}`; }
    if (g.scyEnc(s, c) !== scytale(s, c) || g.scyDec(g.scyEnc(s, c), c) !== g.pad(s, c) || unScytale(scytale(s, c), c) !== g.pad(s, c)) { ok = false; info = `скитала: «${s}», ${c}`; }
    if (g.permEnc(s, kp).join() !== permute(s, kp).join() || g.permDec(g.permEnc(s, kp), kp) !== g.pad(s, c) || unPermute(permute(s, kp), kp) !== g.pad(s, c)) { ok = false; info = `перестановка: «${s}», ${kp}`; } }
  check('шифры обратимы: расшифровка(шифровка(x)) = x для Цезаря, Виженера, скиталы и перестановки (3000 случайных текстов), совпадают с независимыми реализациями', ok, info); }
{ let ok = true; for (const n of [33, 35, 55, 77, 91, 143, 187, 221, 323, 667]) for (let a = 0; a < 60; a++) for (const e of [0, 1, 2, 3, 7, 13, 101]) if (g.mpow(a, e, n) !== powmod(a, e, n)) ok = false;
  check('возведение в степень по модулю совпадает с точным расчётом через BigInt', ok); }

// Уровни по классам.
const ids = gr => g.levels(gr).map(l => l.id).join(' ');
check('8–9 классы: 10 классических уровней без RSA; 10–11 классы: 12 уровней, RSA — финал', [8, 9].every(gr => g.levels(gr).length === 10 && !/rsa/.test(ids(gr))) && [10, 11].every(gr => g.levels(gr).length === 12 && /rsa1 rsa2$/.test(ids(gr))), `${ids(8)} | ${ids(11)}`);

// Общие свойства всех шагов на 400 вариантах: верный ответ и небрежные записи принимаются, неверные — нет, звёзды по числу ошибок, разбор ошибки понятный.
for (const l of g.LEVELS) for (let s = 1; s <= SEEDS; s++) { const steps = g.taskOf(l, s), sol = steps.map(st => st.answer);
  if (JSON.stringify(steps.map(st => st.answer)) !== JSON.stringify(g.taskOf(l, s).map(st => st.answer))) fail(l.id, s, 'задание не воспроизводится по зерну');
  steps.forEach((st, i) => { const at = `шаг ${i + 1}`;
    if (!['text', 'num', 'wheel', 'cols', 'bars', 'pick'].includes(st.kind) || !clean(st.q) || st.answer == null || st.answer === '') fail(l.id, s, `${at}: плохой шаг`);
    if (!st.ok(st.answer) || !st.ok(String(st.answer))) fail(l.id, s, `${at}: образцовый ответ не принят`);
    if (st.why != null && !clean(st.why)) fail(l.id, s, `${at}: плохое пояснение`);
    if (st.kind === 'text' || st.kind === 'bars') { for (const v of loose(st.answer)) if (!st.ok(v)) fail(l.id, s, `${at}: не принят вариант «${v}»`);
      for (const v of spoil(st.answer)) { if (st.ok(v)) fail(l.id, s, `${at}: принят неверный ответ «${v}»`); else if (v !== '' && !clean(st.tip(v))) fail(l.id, s, `${at}: непонятный разбор ошибки для «${v}»`); } }
    else { for (const v of looseNum(st.answer)) if (!st.ok(v)) fail(l.id, s, `${at}: не принят вариант «${v}»`);
      for (const v of spoilNum(st.answer)) { if (st.ok(v) && !((st.kind === 'wheel' || l.id === 'freq' && i === 1) && ((Number(v) % 32 + 32) % 32) === st.answer % 32)) fail(l.id, s, `${at}: принят неверный ответ ${v}`); else if (!st.ok(v) && v !== '' && !clean(st.tip(v))) fail(l.id, s, `${at}: непонятный разбор ошибки для ${v}`); } }
    if (st.kind === 'pick' && (st.options.length !== 4 || new Set(st.options).size !== 4 || st.options.filter(o => st.ok(o)).length !== 1)) fail(l.id, s, `${at}: варианты выбора неоднозначны`); });
  const r0 = g.check(l, {seed: s, answers: sol}), r1 = g.check(l, {seed: s, answers: sol, mistakes: 1}), r2 = g.check(l, {seed: s, answers: sol, mistakes: 2}), r5 = g.check(l, {seed: s, answers: sol, mistakes: 5});
  if (!r0.ok || r0.stars !== 3 || r1.stars !== 2 || r2.stars !== 1 || r5.stars !== 1) fail(l.id, s, 'звёзды не 3/2/1 за 0/1/2+ ошибок');
  for (let i = 0; i < steps.length; i++) { const w = sol.slice(); w[i] = steps[i].kind === 'text' || steps[i].kind === 'bars' ? spoil(sol[i])[0] : sol[i] + 1; if (g.check(l, {seed: s, answers: w}).ok) fail(l.id, s, `проверка приняла неверный шаг ${i + 1}`); }
  if (g.check(l, {seed: s, answers: sol.slice(0, -1)}).ok || g.check(l, {seed: s + 1, answers: sol}).ok && JSON.stringify(sol) !== JSON.stringify(g.taskOf(l, s + 1).map(st => st.answer))) fail(l.id, s, 'принят неполный или чужой ответ');
}

// Независимый пересчёт ответов каждого уровня по тому, что видит ученик.
for (let s = 1; s <= SEEDS; s++) {
  { const [a, b] = g.taskOf(lv('enc'), s);
    if (shift(a.data.text, 3) !== a.answer || a.data.k !== 3 || shift(b.data.text, b.data.k) !== b.answer || shift(b.answer, -b.data.k) !== b.data.text || !WD.has(a.data.text) || !WD.has(b.data.text)) fail('enc', s, 'шифровка не сходится');
    if (b.data.k < 4 || b.data.k > 9 || ![...b.data.text].some(c => code(c) + b.data.k >= 32)) fail('enc', s, 'во втором слове нет перехода через Я'); }
  { const [a, b] = g.taskOf(lv('dec'), s);
    if (shift(a.show, -a.data.k) !== a.answer || !WD.has(a.answer) || shift(b.show, -b.data.k) !== b.answer || !PH.has(b.answer) || shift(b.answer, b.data.k) !== b.show || a.data.k === b.data.k) fail('dec', s, 'расшифровка не сходится'); }
  { const st = g.taskOf(lv('crack'), s);
    st.forEach((x, i) => { const hits = [...Array(32).keys()].filter(k => PH.has(shift(x.show, -k))), readable = [...Array(32).keys()].filter(k => sense(shift(x.show, -k)));
      if (hits.length !== 1 || hits[0] !== x.answer || readable.length !== 1 || shift(x.show, -x.answer) !== x.data.plain) fail('crack', s, `шифровка ${i + 1}: перебор даёт ${hits.join(',')} / ${readable.join(',')}`);
      if (i === 0 ? x.answer < 1 || x.answer > 9 : x.answer < 10 || x.answer > 31) fail('crack', s, `шифровка ${i + 1}: сдвиг ${x.answer} вне диапазона`);
      if (x.ok(x.answer + 1) || x.ok(0) || !x.ok(x.answer + 32)) fail('crack', s, 'проверка сдвига'); });
    if (st[0].data.plain === st[1].data.plain) fail('crack', s, 'одна фраза дважды'); }
  { const [a, b, c] = g.taskOf(lv('freq'), s), cnt = {}; for (const ch of only(a.show)) cnt[ch] = (cnt[ch] || 0) + 1;
    const sorted = Object.entries(cnt).sort((x, y) => y[1] - x[1]), top = sorted[0][0], k = (code(top) - code('О') + 32) % 32, plain = shift(a.show, -k), pc = {}; for (const ch of only(plain)) pc[ch] = (pc[ch] || 0) + 1;
    const ptop = Object.entries(pc).sort((x, y) => y[1] - x[1]);
    if (sorted[0][1] - sorted[1][1] < 2 || ptop[0][0] !== 'О' || plain !== a.data.plain || only(plain).length < 80) fail('freq', s, `«О» не самая частая с запасом: ${sorted.slice(0, 3).map(x => x.join('=')).join(' ')}`);
    if (a.answer !== top || b.answer !== k || c.answer !== plain.split('.')[0] || !plain.split('.').filter(x => x.trim()).every(x => PH.has(x.trim())) || k < 3 || k > 29) fail('freq', s, 'ответы не сходятся с подсчётом частот');
    for (const ch of g.ALPHABET) if (ch !== top && a.ok(ch)) fail('freq', s, `принята не самая частая буква ${ch}`); }
  { const [a, b] = g.taskOf(lv('scy'), s), t = a.show, L = t.length, fits = [...Array(L).keys()].filter(c => c >= 2 && L % c === 0 && PH.has(unspace(unScytale(t, c))));
    if (fits.length !== 1 || fits[0] !== a.answer || unspace(unScytale(t, a.answer)) !== a.data.plain || scytale(a.data.plain, a.answer) !== t || a.answer < 3 || a.answer > 6) fail('scy', s, `столбцы: ${fits.join(',')}`);
    for (let c = 1; c <= 13; c++) if (c !== a.answer && a.ok(c)) fail('scy', s, `принято ${c} столбцов`);
    if (scytale(b.data.text, b.data.c) !== b.answer || unScytale(b.answer, b.data.c) !== b.data.text || b.data.text.length % b.data.c || b.answer === b.data.text) fail('scy', s, 'шифровка слова'); }
  { const [a, b] = g.taskOf(lv('perm'), s), {blocks, key} = a.data;
    if (a.show !== blocks.join(' ') || unspace(unPermute(blocks, key)) !== a.answer || !PH.has(a.answer) || permute(a.answer, key).join() !== blocks.join() || key.every((k, i) => k === i + 1) || new Set(key).size !== key.length) fail('perm', s, 'перестановка не сходится');
    const r = b.data.text.length / 3, chunks = Array.from({length: 3}, (_, i) => b.answer.slice(i * r, i * r + r));
    if (permute(b.data.text, b.data.key).join('') !== b.answer || unPermute(chunks, b.data.key) !== b.data.text || b.data.text.length % 3) fail('perm', s, 'шифровка слова ключом'); }
  { const [a, b] = g.taskOf(lv('venc'), s);
    if (vigenere(a.data.text, a.data.key, 1) !== a.answer || vigenere(a.answer, a.data.key, -1) !== a.data.text || vigenere(b.data.text, b.data.key, 1) !== b.answer || vigenere(b.answer, b.data.key, -1) !== b.data.text || a.data.key.length !== 3 || b.data.key.length !== 4) fail('venc', s, 'Виженер не сходится'); }
  { const [a, b] = g.taskOf(lv('vdec'), s);
    if (vigenere(a.show, a.data.key, -1) !== a.answer || !WD.has(a.answer) || vigenere(b.show, b.data.key, -1) !== b.answer || !PH.has(b.answer)) fail('vdec', s, 'расшифровка Виженера не сходится'); }
  { const [a, b] = g.taskOf(lv('vkey'), s), lc = only(a.show), known = a.data.known, seq = [...known].map((x, i) => chr(code(lc[i]) - code(x))).join('');
    const p = [1, 2, 3, 4].find(n => [...seq].every((x, i) => x === seq[i % n])), key = seq.slice(0, p), full = vigenere(a.show, key, -1);
    if (key !== a.answer || !full.startsWith(known + ' ') || full.slice(known.length + 1) !== b.answer || !PH.has(b.answer)) fail('vkey', s, `ключ по известному началу: ${seq}`);
    if (!a.ok(key + key) || a.ok(key.slice(1) + key[0]) || !b.ok(full) || !b.ok(b.answer)) fail('vkey', s, 'проверка ключа или текста'); }
  { const [a, b, c, d] = g.taskOf(lv('keys'), s);
    if (a.answer !== a.data.M - 1 || b.answer !== Number(32n ** BigInt(b.data.m)) || c.answer !== Number((1n << BigInt(c.data.n)) / (1n << BigInt(c.data.j))) || d.answer !== 2 ** d.data.t || !Number.isInteger(c.answer) || c.answer < 2) fail('keys', s, 'число ключей не сходится'); }
  for (const id of ['rsa1', 'rsa2']) { const st = g.taskOf(lv(id), s), {p, q} = st[0].data, n = p * q, f = (p - 1) * (q - 1), dStep = st.find(x => x.data && 'f' in x.data && 'e' in x.data), e = dStep.data.e, d = dStep.answer;
    if (!isPrime(p) || !isPrime(q) || p === q || st[0].answer !== n || st[1].answer !== f || gcd(e, f) !== 1 || e * d % f !== 1 || d <= 1 || d >= f || d === e) fail(id, s, `ключи: p=${p} q=${q} e=${e} d=${d}`);
    if (dStep.ok(d + f) || dStep.ok(d + 1) || !dStep.ok(d)) fail(id, s, 'проверка d');
    for (let m = 0; m < n; m++) if (powmod(powmod(m, e, n), d, n) !== m) { fail(id, s, `RSA не обратим при m=${m}`); break; }
    const lam = f / gcd(p - 1, q - 1); if ((e * e - 1) % lam === 0) fail(id, s, `вырожденный ключ: e² ≡ 1 (mod λ = ${lam})`);
    if (id === 'rsa1') { const pk = st[2]; if (pk.answer !== e || pk.options.filter(o => gcd(o, f) === 1).length !== 1 || pk.options.some(o => o < 2 || o >= f)) fail(id, s, `выбор e: ${pk.options}`); }
    else { const enc = st[3], dec = st[4], {m} = enc.data;
      if (!(m >= 2 && m < n) || enc.answer !== powmod(m, e, n) || powmod(enc.answer, d, n) !== m || enc.answer === m || dec.answer !== powmod(dec.data.c, d, n) || powmod(dec.answer, e, n) !== dec.data.c || dec.answer === m || dec.data.c >= n) fail(id, s, `письмо: m=${m} c=${enc.answer}`);
      if (dec.ok(powmod(dec.data.c, e, n)) && powmod(dec.data.c, e, n) !== dec.answer) fail(id, s, 'расшифровка открытым ключом принята'); } }
}
for (const l of g.LEVELS) check(`${l.title}: ${SEEDS} вариантов — задания верны, ответ сходится с независимым пересчётом, небрежная запись принимается, ошибки — нет`, !errs[l.id], errs[l.id] || '');

// Разбор ошибок: указывает первую неверную букву и показывает, как она получается.
{ const [a] = g.taskOf(lv('enc'), 5), wrong = chr(code(a.answer[0]) + 1) + a.answer.slice(1), tip = a.tip(wrong), [, , , dd] = g.taskOf(lv('rsa1'), 5);
  check('разбор ошибок: в шифре Цезаря названа первая неверная буква и счёт по номерам, в RSA — проверка e·d mod φ', /1-я буква/.test(tip) && /\+ 3 = \d+/.test(tip) && tip.includes(`«${a.answer[0]}»`) && /остаток/.test(dd.tip(dd.answer + 1)), tip); }
// Образцовые решения для оболочки: три звезды во всех классах.
check('образцовые решения проходят на три звезды во всех классах', [8, 9, 10, 11].every(gr => g.levels(gr).every(l => { const r = g.check(l, g.solve(l, gr), gr); return r.ok && r.stars === 3; })));
console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
