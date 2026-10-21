// Проверка логики «Шифровальщика» без браузера: node tools/lab/tests/codes.test.js
const path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); require(path.join(dir, 'games', 'codes.js'));
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };
const g = LAB.games.find(x => x.id === 'codes'), L = g.lib, A = L.A;
check('игра зарегистрирована с нужными полями', !!g && g.bg === 'bg_codes' && typeof g.mount === 'function' && g.unit && g.minutes > 0);

// Независимый перебор: все разбиения строки бит на коды таблицы.
const parses = (bits, codes) => { if (!bits) return ['']; const out = []; for (const [c, v] of Object.entries(codes)) if (bits.startsWith(v)) for (const rest of parses(bits.slice(v.length), codes)) out.push(c + rest); return out; };
// Неоднозначность таблицы: два разных слова (до 4 букв) с одинаковой шифровкой.
const collision = codes => { const ks = Object.keys(codes), seen = new Map(); const words = ['']; for (let len = 1; len <= 4; len++) for (const w of words.filter(w => w.length === len - 1)) for (const k of ks) words.push(w + k);
  for (const w of words) if (w) { const e = L.encode(w, codes); if (seen.has(e) && seen.get(e) !== w) return [seen.get(e), w]; seen.set(e, w); } return null; };
const wrongs = lv => { switch (lv.kind) {
  case 'caesar': case 'atbash': case 'subst': case 'decode': case 'vigenere': return ['', 'АБВ', lv.cipher, lv.plain.slice(0, -1), L.caesar(lv.plain, 1)];
  case 'encode': case 'fanoAdd': return ['', '2', lv.answer + '0', lv.answer.slice(1), lv.answer.replace(/.$/, c => c === '0' ? '1' : '0')];
  case 'fano': return [[], lv.bad.slice(1), lv.bad.concat(Object.keys(lv.codes).filter(c => !lv.bad.includes(c)).slice(0, 1)), 'А'];
  case 'shortest': return [null, '', ...[0, 1, 2, 3].filter(i => i !== lv.answer)];
  case 'crack': return [null, '', (lv.k + 1) % 32, 0, 'abc'];
} };

const kinds = {};
for (const grade of [6, 7, 8, 9, 10, 11]) {
  const levels = g.levels(grade); let ok = levels.length === 10, info = '';
  levels.forEach((lv, i) => {
    kinds[lv.kind] = (kinds[lv.kind] || 0) + 1;
    const r = g.check(lv, g.solve(lv, grade), grade); if (!r.ok || r.stars !== 3) { ok = false; info = `уровень ${i + 1}: образец не даёт три звезды`; }
    if (!lv.title || !lv.story) { ok = false; info = `уровень ${i + 1}: нет названия или условия`; }
    for (const w of wrongs(lv)) if (g.check(lv, w, grade).ok) { ok = false; info = `уровень ${i + 1}: принят неверный ответ ${JSON.stringify(w)}`; }
    // JSON-круг: ответ переживает передачу через браузерный тест.
    if (!g.check(JSON.parse(JSON.stringify(lv)), JSON.parse(JSON.stringify(g.solve(lv, grade)))).ok) { ok = false; info = `уровень ${i + 1}: ответ не переживает JSON`; }
  });
  check(`${grade} класс: 10 уровней, образцы — на три звезды, неверные ответы не проходят`, ok, info);
}

{ let ok = true, info = '';
  for (const grade of [6, 7, 8, 9, 10, 11]) for (const lv of g.levels(grade)) {
    const at = `${grade} кл., ${lv.title}`;
    if (lv.kind === 'caesar' || lv.kind === 'crack') { if (L.caesar(lv.cipher, -lv.k) !== lv.plain || lv.cipher === lv.plain) { ok = false; info = at; } }
    if (lv.kind === 'atbash' && (L.atbash(lv.cipher) !== lv.plain || lv.cipher === lv.plain)) { ok = false; info = at; }
    if (lv.kind === 'subst') { const inv = Object.fromEntries(Object.entries(lv.table).map(([p, c]) => [c, p])); if ([...lv.cipher].map(c => inv[c] || c).join('') !== lv.plain || new Set(Object.values(lv.table)).size !== 32) { ok = false; info = at; } }
    if (lv.kind === 'vigenere' && (L.vigenere(lv.cipher, lv.key, -1) !== lv.plain || lv.cipher === lv.plain)) { ok = false; info = at; }
    if (lv.kind === 'encode' && (!L.isPrefixFree(Object.values(lv.codes)) || parses(lv.answer, lv.codes).join() !== lv.word)) { ok = false; info = at + ': кодировка неоднозначна'; }
  }
  check('шифры обратимы: расшифровка шифровки даёт исходный текст', ok, info); }

{ let ok = true, info = '', n = 0;
  for (const grade of [6, 7, 8, 9, 10, 11]) for (const lv of g.levels(grade).filter(l => l.kind === 'decode')) { n++;
    const all = parses(lv.bits, lv.codes); if (all.length !== 1 || all[0] !== lv.plain) { ok = false; info = `${grade} кл.: разборов ${all.length}`; }
    if (L.isPrefixFree(Object.values(lv.codes))) { ok = false; info = `${grade} кл.: таблица префиксная — слишком просто`; }
    // Есть тупики: какой-то код подходит к началу строки, но дальше разбор не идёт.
    const starts = Object.values(lv.codes).filter(v => lv.bits.startsWith(v)); if (starts.length < 1) { ok = false; info = `${grade} кл.: нет начала`; } }
  check('единственная расшифровка: у строки бит ровно одно разбиение, таблица не префиксная', ok && n === 6, info); }

{ let ok = true, info = '';
  for (const grade of [6, 7, 8, 9, 10, 11]) for (const lv of g.levels(grade)) {
    if (lv.kind === 'fano') { const truth = Object.keys(lv.codes).filter(x => Object.keys(lv.codes).some(y => x !== y && (lv.codes[x].startsWith(lv.codes[y]) || lv.codes[y].startsWith(lv.codes[x])))).sort();
      if (truth.join() !== lv.bad.join() || !truth.length || truth.length === Object.keys(lv.codes).length) { ok = false; info = `${grade} кл.: Фано ${truth} / ${lv.bad}`; } }
    if (lv.kind === 'fanoAdd') { const vals = Object.values(lv.codes), a = lv.answer, fits = c => vals.every(v => !v.startsWith(c) && !c.startsWith(v));
      let shorter = false; for (let len = 1; len <= a.length; len++) for (let v = 0; v < 2 ** len; v++) { const c = v.toString(2).padStart(len, '0'); if (fits(c) && (len < a.length || parseInt(c, 2) < parseInt(a, 2))) shorter = true; }
      if (!L.isPrefixFree(vals) || !fits(a) || shorter) { ok = false; info = `${grade} кл.: новая буква ${a}`; } }
    if (lv.kind === 'shortest') { const lens = lv.options.map(o => L.encode(lv.word, o).length), good = lv.options.map(o => L.isPrefixFree(Object.values(o)));
      const bestGood = Math.min(...lens.filter((_, i) => good[i]));
      if (!good[lv.answer] || lens[lv.answer] !== bestGood || lens.filter((x, i) => good[i] && x === bestGood).length !== 1) { ok = false; info = `${grade} кл.: выбор таблицы`; }
      lv.options.forEach((o, i) => { if (!good[i] && (!collision(o) || L.uniquelyDecodable(Object.values(o)) || lens[i] >= bestGood)) { ok = false; info = `${grade} кл.: ловушка ${i + 1} не неоднозначна или не короче`; } }); }
  }
  check('Фано: нарушения найдены верно, код новой буквы — кратчайший, в «самом коротком коде» ловушки короче, но неоднозначны', ok, info); }

{ let ok = true, info = '';
  for (const grade of [6, 7, 8, 9, 10, 11]) for (const lv of g.levels(grade).filter(l => l.kind === 'crack')) { const f = L.freq(lv.plain); if (f[0][0] !== 'О' || f[1][1] === f[0][1]) { ok = false; info = `${grade} кл.: в «${lv.plain}» О не самая частая`; } }
  check('взлом без ключа: в открытом тексте буква О — единственная самая частая', ok, info); }

{ // Сидирование: данные одного вида различаются между классами, и уровни внутри класса не повторяют друг друга.
  const sig = lv => JSON.stringify([lv.plain, lv.cipher, lv.codes, lv.bits, lv.options, lv.k]);
  let diffGrades = 0, total = 0; for (let i = 0; i < 10; i++) { const s = new Set([6, 7, 8, 9, 10, 11].map(gr => sig(g.levels(gr)[i]))); total++; if (s.size >= 3) diffGrades++; }
  const inGrade = new Set(g.levels(8).map(sig)).size;
  const again = JSON.stringify(g.levels(8)) === JSON.stringify(g.levels(8)), kindsOk = Object.keys(kinds).length === 10;
  check('данные зависят от класса и уровня и детерминированы', diffGrades >= 8 && inGrade === 10 && again && kindsOk, `разных по классам: ${diffGrades} из ${total}, уникальных уровней в 8 классе: ${inGrade}`); }

{ // Алгоритм Сардинаса — Паттерсона на известных примерах.
  const ud = L.uniquelyDecodable; const ok = ud(['0', '10', '110', '111']) && ud(['0', '01', '011']) && !ud(['0', '01', '10']) && !ud(['1', '011', '01110', '1110', '10011']) && !ud(['0', '1', '00']);
  check('однозначная декодируемость: известные примеры', ok); }

console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
