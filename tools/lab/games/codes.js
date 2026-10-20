// «Шифровальщик»: шифровальное бюро Кодограда. Шифры Цезаря, Атбаш, замены и Виженера, двоичные коды переменной длины,
// условие Фано и однозначное декодирование (задание 2 ОГЭ, 7–9 классы).
// Данные каждого уровня строятся по зерну (номер уровня + класс), поэтому у разных уровней они разные, а тест в node детерминирован.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const A = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', N = A.length;
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1)), pick = (r, a) => a[Math.floor(r() * a.length)];
  const shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = s => String(s == null ? '' : s).toUpperCase().replace(/Ё/g, 'Е').replace(/\s+/g, '');
  const bitsOf = s => String(s == null ? '' : s).replace(/\s+/g, '');
  const mapText = (s, f) => [...s].map(c => { const i = A.indexOf(c); return i < 0 ? c : f(i, c); }).join('');
  const caesar = (s, k) => mapText(s, i => A[((i + k) % N + N) % N]);
  const atbash = s => mapText(s, i => A[N - 1 - i]);
  const vigenere = (s, key, dir) => { let j = 0; return mapText(s, i => A[((i + dir * A.indexOf(key[j++ % key.length])) % N + N) % N]); };
  const encode = (word, codes) => [...word].map(c => codes[c]).join('');

  const WORDS = ['ПАРОЛЬ', 'КЛЮЧ', 'ШИФР', 'СЕКРЕТ', 'СИГНАЛ', 'МАЯК', 'КОДЕКС', 'РАКЕТА', 'ПОБЕДА', 'ЗАГАДКА', 'ТАЙНИК', 'КОМПАС', 'КАРТА', 'ЛАБИРИНТ', 'ДРАКОН', 'ЗАМОК', 'ФОНАРЬ', 'ПРОГРАММА', 'АЛГОРИТМ', 'ИНФОРМАТИКА', 'ПИКСЕЛЬ', 'МОНИТОР', 'СЕРВЕР', 'РАДУГА', 'ВУЛКАН', 'ТЕЛЕСКОП', 'ПЛАНЕТА', 'КОМЕТА'];
  const PHRASES = ['ВСТРЕЧА У МОСТА', 'КЛЮЧ ПОД КАМНЕМ', 'ЖДИ СИГНАЛА', 'КОД В ТЕТРАДИ', 'ОТКРОЙ ЯЩИК', 'ИДИ НА СЕВЕР', 'СЕЙФ ЗА КАРТИНОЙ', 'ПАРОЛЬ НА ЛИСТКЕ', 'ШТАБ В ПОДВАЛЕ', 'ПОЕЗД В ПОЛДЕНЬ', 'ЛОДКА У ПРИСТАНИ', 'КАРТА В БИБЛИОТЕКЕ'];
  // Для частотного анализа: в каждой фразе буква О встречается чаще всех остальных (это проверяет тест).
  const LONG = ['ВСТРЕЧА ОКОЛО СТАРОГО МОСТА В ПОЛНОЧЬ', 'КОД ОТ СЕЙФА СПРЯТАН ПОД ОКНОМ ВТОРОГО ЭТАЖА', 'ОТРЯД ПОЙДЕТ ДОРОГОЙ ВДОЛЬ ГОРНОГО ОЗЕРА', 'ГОЛУБЬ ПРИНОСИТ ПОЧТУ ОКОЛО ШКОЛЬНОГО ДВОРА', 'ПРОВОД ОТ ТЕЛЕФОНА ПРОЛОЖЕН ПОД ПОЛОМ ГОРОДСКОГО ВОКЗАЛА', 'ОСТОРОЖНО ДОМ ОХРАНЯЕТ ОГРОМНЫЙ СТОРОЖ', 'ПОРОХ ДЕРЖИТЕ СУХИМ А ПИСЬМО ПРОЧТИТЕ ПОТОМ'];
  const DECODE_WORDS = ['ШИФР', 'КЛЮЧ', 'МАЯК', 'КОД', 'СЕЙФ', 'ТАЙНИК', 'ЗАМОК', 'ФОНАРЬ', 'ПИКСЕЛЬ', 'БАЙТ', 'ПЛАН', 'ВЗЛОМ', 'ДИСК', 'ПОЧТА', 'КАРТЫ', 'РЮКЗАК', 'СТОЛ', 'ДЫМ', 'ЛУЧ', 'ГРОМ'].filter(w => new Set(w).size === w.length);
  const REPEAT_WORDS = ['КАРАВАН', 'БАРАБАН', 'МОЛОКО', 'КОЛОКОЛ', 'АНАНАС', 'ТАРАКАН', 'ПОТОЛОК', 'КАРАКАТИЦА', 'ПАПАХА', 'ВОДОВОЗ'];
  const KEYS_SHORT = ['КОД', 'ЛУЧ', 'ДОМ', 'МИР', 'СОК', 'ЛЕС'], KEYS_LONG = ['ШИФР', 'КЛЮЧ', 'ЗАМОК', 'ТАЙНА', 'ПАРОЛЬ', 'ОКНО'];
  const DECOYS = 'АБВГДЕИКЛМНОПРСТУ';

  // Коды переменной длины. Полный префиксный код: дерево, у которого листья — кодовые слова.
  const prefixCode = (r, n, maxLen) => { let leaves = ['0', '1']; let guard = 0; while (leaves.length < n && guard++ < 500) { const can = leaves.filter(l => l.length < maxLen); const l = pick(r, can); leaves.splice(leaves.indexOf(l), 1, l + '0', l + '1'); } return shuffle(r, leaves); };
  const conflicts = codes => { const out = new Set(), ks = Object.keys(codes); for (const x of ks) for (const y of ks) if (x !== y && codes[y].startsWith(codes[x])) { out.add(x); out.add(y); } return out; };
  const isPrefixFree = list => list.every((a, i) => list.every((b, j) => i === j || !b.startsWith(a)));
  // Алгоритм Сардинаса — Паттерсона: однозначно ли декодируется любое сообщение.
  function uniquelyDecodable(list) {
    const C = new Set(list); if (C.size < list.length || C.has('')) return false;
    const dangling = (X, Y) => { const s = new Set(); for (const a of X) for (const b of Y) if (a !== b && b.startsWith(a)) s.add(b.slice(a.length)); return s; };
    let S = dangling(C, C); const seen = new Set();
    while (S.size) { for (const s of S) if (C.has(s) || s === '') return false; const next = new Set([...dangling(C, S), ...dangling(S, C)]); for (const s of S) seen.add(s); S = new Set([...next].filter(s => !seen.has(s))); }
    return true;
  }
  // Все разбиения строки бит на коды (до limit штук).
  function decodings(bits, codes, limit = 50) {
    const ks = Object.keys(codes), out = [];
    const go = (pos, acc) => { if (out.length >= limit) return; if (pos === bits.length) { out.push(acc.join('')); return; } for (const k of ks) if (bits.startsWith(codes[k], pos)) { acc.push(k); go(pos + codes[k].length, acc); acc.pop(); } };
    go(0, []); return out;
  }
  // Кратчайший код для новой буквы: перебор по длине, при равной длине — по числовому значению.
  function freeCode(list, maxLen = 8) {
    for (let len = 1; len <= maxLen; len++) for (let v = 0; v < 2 ** len; v++) { const c = v.toString(2).padStart(len, '0'); if (list.every(x => !x.startsWith(c) && !c.startsWith(x))) return c; }
    return null;
  }

  const GEN = {
    caesar(r, g) { const plain = g >= 9 ? pick(r, PHRASES) : pick(r, WORDS.filter(w => w.length <= (g <= 6 ? 6 : 9))), k = ri(r, 2, g <= 7 ? 7 : 15);
      return {story: `Агент прислал донесение, зашифрованное шифром Цезаря: каждая буква сдвинута на ${k} вперёд по алфавиту. Поверни внутреннее кольцо на ${k} и прочитай открытый текст.`, plain, k, cipher: caesar(plain, k)}; },
    atbash(r, g) { const plain = g >= 8 ? pick(r, PHRASES) : pick(r, WORDS); return {story: 'Древний шифр Атбаш: алфавит зеркально переворачивается, А меняется на Я, Б — на Ю и так далее. Шифрование и расшифровка делаются одинаково.', plain, cipher: atbash(plain)}; },
    subst(r, g) { const key = shuffle(r, [...A]), plain = g >= 8 ? pick(r, PHRASES) : pick(r, WORDS), table = Object.fromEntries([...A].map((c, i) => [c, key[i]]));
      return {story: 'Перехвачено письмо, зашифрованное таблицей замены: каждую букву открытого текста заменили на букву из нижней строки таблицы. Восстанови текст.', plain, table, cipher: mapText(plain, (i, c) => table[c])}; },
    encode(r, g) { const word = pick(r, REPEAT_WORDS.concat(DECODE_WORDS)), letters = [...new Set(word)], extra = [...DECOYS].filter(c => !letters.includes(c)), all = letters.concat(shuffle(r, extra).slice(0, g <= 7 ? 1 : 2)).sort();
      const list = prefixCode(r, all.length, g <= 7 ? 4 : 5), codes = Object.fromEntries(all.map((c, i) => [c, list[i]]));
      return {story: `Радист передаёт слово «${word}». Закодируй его по таблице: запиши коды букв подряд, без пробелов.`, word, codes, answer: encode(word, codes)}; },
    decode(r, g) { for (let t = 0; t < 4000; t++) {
        const word = pick(r, DECODE_WORDS.filter(w => w.length <= (g <= 7 ? 5 : 7))), letters = [...new Set(word)], extra = shuffle(r, [...DECOYS].filter(c => !letters.includes(c))).slice(0, 2), all = letters.concat(extra).sort();
        const used = new Set(), codes = {}; for (const c of all) { let x; do x = Array.from({length: ri(r, 1, g <= 7 ? 3 : 4)}, () => ri(r, 0, 1)).join(''); while (used.has(x)); used.add(x); codes[c] = x; }
        if (isPrefixFree(Object.values(codes))) continue; const bits = encode(word, codes), ds = decodings(bits, codes); if (ds.length !== 1 || bits.length < 8 || bits.length > 22) continue;
        return {story: 'Разведчик передал шифровку кодом переменной длины. Таблица не префиксная: некоторые коды — начало других, поэтому разрезать строку «на глаз» не выйдет. Но правильная расшифровка у этой строки только одна. Найди её.', codes, bits, plain: word};
      } throw new Error('decode: не удалось построить задание'); },
    fano(r, g) { for (let t = 0; t < 4000; t++) {
        const n = g <= 7 ? 5 : 6, letters = shuffle(r, [...'АБВГДЕЖЗИК']).slice(0, n).sort(), list = prefixCode(r, n, 4), codes = Object.fromEntries(letters.map((c, i) => [c, list[i]]));
        const m = ri(r, 1, 2); for (let k = 0; k < m; k++) { const x = pick(r, letters), y = pick(r, letters.filter(c => c !== x)), base = codes[y]; codes[x] = r() < .5 && base.length > 1 ? base.slice(0, ri(r, 1, base.length - 1)) : base + ri(r, 0, 1); }
        const vals = Object.values(codes); if (new Set(vals).size !== n || vals.some(v => v.length > 5)) continue; const bad = [...conflicts(codes)].sort(); if (!bad.length || bad.length >= n - 1) continue;
        return {story: 'Условие Фано: ни один код не должен быть началом другого кода. Тогда любое сообщение расшифровывается однозначно. Отметь все буквы, коды которых нарушают условие (являются началом чужого кода или начинаются с чужого кода).', codes, bad};
      } throw new Error('fano'); },
    fanoAdd(r, g) { for (let t = 0; t < 4000; t++) {
        const n = g <= 7 ? 4 : 5, list = prefixCode(r, n + 1, g <= 7 ? 4 : 5), drop = ri(r, 0, n), rest = list.filter((_, i) => i !== drop);
        if (g >= 9 && r() < .6) { const i = ri(r, 0, n - 1); rest[i] = rest[i] + '0'; } // ещё одно свободное место, чтобы выбирать было из чего
        const letters = [...'АБВГДЕ'].slice(0, n), codes = Object.fromEntries(letters.map((c, i) => [c, rest[i]])), ans = freeCode(rest);
        if (!isPrefixFree(rest) || !ans || ans.length < 2) continue; const sameLen = []; for (let v = 0; v < 2 ** ans.length; v++) { const c = v.toString(2).padStart(ans.length, '0'); if (rest.every(x => !x.startsWith(c) && !c.startsWith(x))) sameLen.push(c); }
        const nl = [...'АБВГДЕЖ'][n];
        return {story: `Для букв ${letters.join(', ')} выбраны коды, удовлетворяющие условию Фано. Подбери для буквы ${nl} кратчайший код, чтобы условие Фано по-прежнему выполнялось.${sameLen.length > 1 ? ' Если таких кодов несколько, укажи код с наименьшим числовым значением.' : ''}`, codes, letter: nl, answer: ans};
      } throw new Error('fanoAdd'); },
    shortest(r, g) { for (let t = 0; t < 6000; t++) {
        const word = pick(r, REPEAT_WORDS), letters = [...new Set(word)].sort(); if (letters.length < 3 || letters.length > 6) continue; const n = letters.length, len = codes => encode(word, codes).length;
        const mk = list => Object.fromEntries(letters.map((c, i) => [c, list[i]]));
        const good = [mk(prefixCode(r, n, 5)), mk(prefixCode(r, n, 5))], gl = good.map(len); if (gl[0] === gl[1]) continue; const best = Math.min(...gl);
        const bad = []; for (let k = 0; k < 400 && bad.length < 2; k++) { const used = new Set(), list = letters.map(() => { let x; do x = Array.from({length: ri(r, 1, 3)}, () => ri(r, 0, 1)).join(''); while (used.has(x)); used.add(x); return x; }); const c = mk(list); if (!uniquelyDecodable(list) && len(c) < best && !bad.some(b => JSON.stringify(b) === JSON.stringify(c))) bad.push(c); }
        if (bad.length < 2) continue; const order = shuffle(r, [0, 1, 2, 3]), all = [...good, ...bad], options = order.map(i => all[i]), answer = order.indexOf(gl[0] < gl[1] ? 0 : 1);
        return {story: `Нужно передать слово «${word}» как можно короче. Инженеры предложили четыре кодовые таблицы. Выбери таблицу, по которой любое сообщение расшифровывается однозначно и слово «${word}» кодируется самой короткой строкой.`, word, options, answer};
      } throw new Error('shortest'); },
    crack(r, g) { const plain = pick(r, LONG), k = ri(r, 3, 29); return {story: 'Перехвачено длинное донесение, зашифрованное шифром Цезаря, но сдвиг неизвестен. В русских текстах чаще всего встречается буква О. Найди самую частую букву шифровки и подбери сдвиг колесом.', plain, k, cipher: caesar(plain, k)}; },
    vigenere(r, g) { const key = pick(r, g >= 9 ? KEYS_LONG : KEYS_SHORT), plain = g >= 9 ? pick(r, PHRASES) : pick(r, WORDS); return {story: `Шифр Виженера с ключевым словом «${key}». Под каждой буквой текста по кругу пишут буквы ключа (пробелы пропускают). Буква ключа задаёт сдвиг: А — 0, Б — 1, В — 2… При шифровании сдвигают вперёд, при расшифровке — назад.`, key, plain, cipher: vigenere(plain, key, 1)}; },
  };
  const PLAN = [
    ['Колесо Цезаря', 'caesar'], ['Зеркало Атбаш', 'atbash'], ['Таблица замены', 'subst'], ['Двоичная телеграмма', 'encode'], ['Единственная расшифровка', 'decode'],
    ['Условие Фано', 'fano'], ['Код для новой буквы', 'fanoAdd'], ['Самый короткий код', 'shortest'], ['Взлом без ключа', 'crack'], ['Шифр Виженера', 'vigenere'],
  ];
  const cache = {};
  function levels(grade) {
    const g = Math.max(6, Math.min(11, Number(grade) || 8));
    return cache[g] = cache[g] || PLAN.map(([title, kind], i) => Object.assign({title, kind, n: i + 1, grade: g}, GEN[kind](rng(g * 1000 + (i + 1) * 7919), g)));
  }
  function answerOf(lv) {
    switch (lv.kind) {
      case 'caesar': case 'atbash': case 'subst': case 'decode': case 'vigenere': return lv.plain;
      case 'encode': case 'fanoAdd': return lv.answer;
      case 'fano': return lv.bad.slice();
      case 'shortest': return lv.answer;
      case 'crack': return lv.k;
    }
  }
  function check(lv, a) {
    const no = msg => ({ok: false, msg}), yes = msg => ({ok: true, stars: 3, msg});
    switch (lv.kind) {
      case 'caesar': case 'atbash': case 'subst': case 'decode': case 'vigenere':
        if (!norm(a)) return no('Впиши расшифровку.'); return norm(a) === norm(lv.plain) ? yes('Текст расшифрован верно.') : no('Расшифровка не та. Проверь буквы по одной.');
      case 'encode': case 'fanoAdd': { const b = bitsOf(a); if (!/^[01]+$/.test(b)) return no('Ответ — строка из нулей и единиц.'); return b === lv.answer ? yes('Код верный.') : no(lv.kind === 'encode' ? 'Код не совпадает с шифровкой слова.' : 'Этот код не подходит.'); }
      case 'fano': { if (!Array.isArray(a)) return no('Отметь буквы.'); const s = [...new Set(a.map(norm))].sort(); return s.join() === lv.bad.join() ? yes('Все нарушения найдены.') : no(s.some(x => !lv.bad.includes(x)) ? 'Отмечено лишнее.' : 'Найдены не все нарушения.'); }
      case 'shortest': return /^\d+$/.test(String(a == null ? '' : a).trim()) && Number(a) === lv.answer ? yes('Выбрана лучшая таблица.') : no('Эта таблица не подходит.');
      case 'crack': { const k = /^-?\d+$/.test(String(a == null ? '' : a).trim()) ? Number(a) : NaN; return Number.isInteger(k) && ((k % N) + N) % N === lv.k ? yes('Сдвиг найден, донесение прочитано.') : no('С таким сдвигом текст не читается.'); }
    }
    return no('Неизвестный уровень.');
  }
  const hintOf = lv => ({
    caesar: `Первая буква шифровки ${lv.cipher[0]} — отсчитай от неё ${lv.k} букв назад: получится ${lv.plain[0]}.`,
    atbash: `Буква с номером i (А — 1) меняется на букву с номером 33 − i. Первая буква: ${lv.cipher[0]} → ${lv.plain[0]}.`,
    subst: 'Нажимай на буквы шифровки — в таблице подсветится столбец с этой буквой внизу; ответ — буква над ней.',
    encode: `Начало: ${lv.word[0]} → ${lv.codes && lv.codes[lv.word[0]]}, ${lv.word[1]} → ${lv.codes && lv.codes[lv.word[1]]}.`,
    decode: `Шифровка начинается с кода буквы ${lv.plain[0]} (${lv.codes && lv.codes[lv.plain[0]]}). Если разрез ведёт в тупик — вернись и попробуй другой код.`,
    fano: 'Сравни каждую пару кодов: если один код целиком стоит в начале другого, обе буквы нарушают условие.',
    fanoAdd: `Перебирай коды по возрастанию длины: 0, 1, 00, 01, 10, 11, 000… Код ${lv.answer && lv.answer.length} бит${lv.answer && lv.answer.length < 5 ? 'а' : ''} уже подойдёт.`,
    shortest: 'Сначала отбрось таблицы, где один код — начало другого и строку можно разрезать двумя способами. Потом посчитай длину слова в оставшихся.',
    crack: `Самая частая буква шифровки — ${lv.cipher && freq(lv.cipher)[0][0]}. Если это О, сдвиг равен расстоянию от О до неё.`,
    vigenere: `Первая буква: шифр ${lv.cipher && lv.cipher[0]}, ключ ${lv.key && lv.key[0]} (сдвиг ${lv.key && A.indexOf(lv.key[0])}) → ${lv.plain && lv.plain[0]}.`,
  })[lv.kind];
  const freq = s => { const c = {}; for (const x of s) if (A.includes(x)) c[x] = (c[x] || 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1] || A.indexOf(a[0]) - A.indexOf(b[0])); };

  const CSS = `
.cd-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}@media(max-width:820px){.cd-wrap{grid-template-columns:1fr}}
.cd-cipher{font-family:ui-monospace,Consolas,monospace;font-size:26px;letter-spacing:.18em;color:#ffd34d;background:#0f1730;border:1px solid #33466e;border-radius:12px;padding:10px 14px;margin:6px 0 10px;word-break:break-word;line-height:1.5}
.cd-cipher button{cursor:pointer;font:inherit;color:inherit;background:none;border:0;border-radius:6px;padding:0 1px}.cd-cipher button:hover,.cd-cipher button.on{background:#3a3312}
.cd-wheel{width:min(100%,320px);display:block;margin:0 auto;user-select:none}.cd-wheel text{font:700 13px system-ui,sans-serif;text-anchor:middle;dominant-baseline:central}
.cd-wheel .o{fill:#e6edf9}.cd-wheel .i{fill:#ffd34d}.cd-inner{transition:transform .35s ease}.cd-wheel .hl{fill:#7fe3c8}
.cd-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.cd-row input{flex:1;min-width:160px;font-family:ui-monospace,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}
.cd-shift{font-weight:800;color:#ffd34d;min-width:110px;text-align:center}
.cd-preview{font-family:ui-monospace,Consolas,monospace;font-size:18px;letter-spacing:.1em;background:#0f1730;border-radius:10px;padding:8px 12px;min-height:44px;word-break:break-word;color:#7fe3c8}
.cd-tiles{display:flex;flex-wrap:wrap;gap:4px}.cd-tile{display:grid;grid-template-rows:1fr 1fr;min-width:34px;text-align:center;background:#243253;border:2px solid #3b4d78;border-radius:8px;font-family:ui-monospace,Consolas,monospace;font-weight:700}
.cd-tile span{padding:2px 4px}.cd-tile span+span{border-top:1px solid #3b4d78;color:#ffd34d}.cd-tile.on{border-color:#7fe3c8;background:#173a3a}
.cd-codes{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}.cd-code{display:flex;justify-content:space-between;gap:8px;align-items:center;background:#243253;border:2px solid #3b4d78;border-radius:10px;padding:6px 10px;color:#e6edf9;font-weight:700}
.cd-code code{font-family:ui-monospace,Consolas,monospace;color:#ffd34d;font-size:17px}button.cd-code{cursor:pointer}button.cd-code.on{border-color:#ff9a9a;background:#3a1d24}.cd-code.warn{border-color:#ff9a9a}
.cd-bits{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;font-family:ui-monospace,Consolas,monospace;font-size:22px;margin:8px 0}.cd-bit{padding:4px 3px;color:#e6edf9}
.cd-cut{cursor:pointer;width:14px;border:0;background:none;padding:0;position:relative}.cd-cut::after{content:"";position:absolute;left:6px;top:4px;bottom:4px;width:2px;background:#33466e;border-radius:1px}.cd-cut:hover::after{background:#9fb2d6}.cd-cut.on::after{background:#ffd34d;width:3px;left:5px;top:-2px;bottom:-2px}
.cd-segs{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}.cd-seg{background:#243253;border-radius:8px;padding:4px 8px;font-family:ui-monospace,Consolas,monospace}.cd-seg b{color:#7fe3c8;margin-left:6px}.cd-seg.bad b{color:#ff9a9a}
.cd-keypad{display:flex;gap:6px;flex-wrap:wrap}.cd-key{cursor:pointer;min-width:52px;background:#243253;border:2px solid #3b4d78;border-bottom-width:4px;color:#e6edf9;border-radius:10px;padding:8px 12px;font-weight:800;font-size:18px}.cd-key:hover{border-color:var(--c)}
.cd-out{font-family:ui-monospace,Consolas,monospace;font-size:22px;letter-spacing:.06em;color:#ffd34d;background:#0f1730;border:1px solid #33466e;border-radius:10px;padding:8px 12px;min-height:48px;word-break:break-all}
.cd-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}.cd-opt{cursor:pointer;text-align:left;background:#182240;border:2px solid #33466e;border-radius:12px;padding:10px;color:#e6edf9;display:grid;gap:4px}.cd-opt.on{border-color:#ffd34d;background:#2a2a1a}
.cd-opt table{border-collapse:collapse;font-family:ui-monospace,Consolas,monospace}.cd-opt td{padding:1px 8px 1px 0}.cd-opt td+td{color:#ffd34d}.cd-opt small{color:#9fb2d6;word-break:break-all;font-family:ui-monospace,Consolas,monospace}
.cd-freq{display:flex;gap:6px;align-items:flex-end;height:110px;margin:6px 0}.cd-freq div{display:grid;justify-items:center;gap:2px;font-weight:700;font-size:13px;color:#9fb2d6}.cd-freq i{width:24px;background:linear-gradient(#ffd34d,#c58a16);border-radius:5px 5px 0 0}
.cd-vig{display:flex;flex-wrap:wrap;gap:3px;font-family:ui-monospace,Consolas,monospace;margin:6px 0}.cd-vig div{display:grid;text-align:center;min-width:30px;background:#243253;border-radius:7px;padding:2px 3px}.cd-vig .c{color:#ffd34d;font-weight:800}.cd-vig .k{color:#7fe3c8;font-size:13px}.cd-vig .gap{background:none}
.cd-abc{display:flex;flex-wrap:wrap;gap:3px;font-family:ui-monospace,Consolas,monospace;font-size:13px}.cd-abc span{display:grid;text-align:center;min-width:26px;background:#121b33;border-radius:6px;padding:2px}.cd-abc small{color:#9fb2d6;font-size:10px}
.cd-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px}.cd-hint{color:#c3cee2;background:#1d2a4a;border-left:4px solid #ffd34d;border-radius:8px;padding:6px 10px;margin:8px 0}
.cd-live{min-height:22px;font-weight:700;color:#9fb2d6}.cd-live.bad{color:#ff9a9a}.cd-live.good{color:#7fe3c8}`;
  const style = () => { if (typeof document === 'undefined' || document.getElementById('cd-style')) return; const s = document.createElement('style'); s.id = 'cd-style'; s.textContent = CSS; document.head.append(s); };

  function wheel(api, onTurn) {
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), inner = document.createElementNS(NS, 'g'), step = 360 / N; let k = 0;
    svg.setAttribute('viewBox', '-150 -150 300 300'); svg.setAttribute('class', 'cd-wheel'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Колесо Цезаря: снаружи открытый текст, внутри шифр');
    const circle = (rad, fill) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', rad); c.setAttribute('fill', fill); c.setAttribute('stroke', '#3b4d78'); c.setAttribute('stroke-width', '2'); return c; };
    const label = (ch, rad, ang, cls) => { const t = document.createElementNS(NS, 'text'), a = (ang - 90) * Math.PI / 180; t.setAttribute('x', (rad * Math.cos(a)).toFixed(1)); t.setAttribute('y', (rad * Math.sin(a)).toFixed(1)); t.setAttribute('class', cls); t.textContent = ch; return t; };
    svg.append(circle(146, '#182240'), circle(106, '#0f1730'));
    [...A].forEach((ch, i) => svg.append(label(ch, 126, i * step, 'o'))); [...A].forEach((ch, i) => inner.append(label(ch, 88, i * step, 'i'))); inner.setAttribute('class', 'cd-inner');
    const mark = document.createElementNS(NS, 'path'); mark.setAttribute('d', 'M0,-108 L-6,-100 L6,-100 Z'); mark.setAttribute('fill', '#7fe3c8');
    const mid = label('0', 0, 0, 'i'); mid.setAttribute('font-size', '26'); svg.append(inner, mark, mid);
    const box = api.el('div', 'lab-panel'), shown = api.el('span', 'cd-shift');
    const set = v => { k = ((v % N) + N) % N; inner.style.transform = `rotate(${-k * step}deg)`; mid.textContent = String(k); shown.textContent = `сдвиг ${k}`; if (onTurn) onTurn(k); };
    const left = api.button('◀', 'cd-key', () => set(k - 1)), right = api.button('▶', 'cd-key', () => set(k + 1)); left.setAttribute('aria-label', 'Повернуть назад'); right.setAttribute('aria-label', 'Повернуть вперёд');
    const row = api.el('div', 'cd-row'); row.style.justifyContent = 'center'; row.append(left, shown, right);
    box.append(api.el('h3', '', 'Колесо: снаружи — открытый текст, внутри — шифр'), svg, row, api.el('p', 'lab-note', 'Под буквой внешнего кольца стоит её шифр на внутреннем. Вращать можно и стрелками ← → на клавиатуре.'));
    box.tabIndex = 0; box.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { set(k - 1); e.preventDefault(); } if (e.key === 'ArrowRight') { set(k + 1); e.preventDefault(); } });
    set(0); return {node: box, set, get: () => k};
  }
  const cipherLine = (api, text, onPick) => { const box = api.el('div', 'cd-cipher'); [...text].forEach((ch, i) => { if (ch === ' ') { box.append(document.createTextNode(' ')); return; } const b = api.button(ch, '', () => { [...box.querySelectorAll('button')].forEach(x => x.classList.toggle('on', x === b)); onPick && onPick(ch, i); }); box.append(b); }); return box; };
  const textInput = (api, ph) => { const inp = api.el('input'); inp.autocomplete = 'off'; inp.spellcheck = false; inp.placeholder = ph || 'Открытый текст'; inp.setAttribute('aria-label', 'Ответ'); inp.dataset.answer = '1'; return inp; };
  const codeTable = (api, codes, onPick) => { const box = api.el('div', 'cd-codes'); for (const [c, v] of Object.entries(codes)) { const b = onPick ? api.button('', 'cd-code', () => onPick(c, b)) : api.el('div', 'cd-code'); b.dataset.letter = c; b.append(api.el('span', '', c), api.el('code', '', v)); box.append(b); } return box; };
  const keypad = (api, out, extra) => { const pad = api.el('div', 'cd-keypad'), upd = () => extra && extra(); const add = ch => { out.value += ch; upd(); };
    pad.append(api.button('0', 'cd-key', () => add('0')), api.button('1', 'cd-key', () => add('1')), api.button('⌫', 'cd-key', () => { out.value = out.value.slice(0, -1); upd(); }), api.button('Очистить', 'lab-small', () => { out.value = ''; upd(); })); return pad; };

  function mount(host, lv, api) {
    style(); const {el, button} = api, task = el('div', 'lab-task'), area = el('div', 'cd-area'), msg = el('p', 'lab-msg'), bar = el('div', 'cd-bar'), hintBox = el('div'); let mistakes = 0, hints = 0, done = false, get = () => null, set = () => {};
    task.append(el('h2', '', lv.title), el('p', '', lv.story)); host.append(task, area);
    const submit = () => { if (done) return; const a = get(), r = check(lv, a);
      if (r.ok) { done = true; const lost = mistakes + hints, stars = Math.max(1, 3 - lost); msg.className = 'lab-msg good'; msg.textContent = r.msg; api.finish(stars, lost ? `Шифровка разгадана. Ошибок: ${mistakes}, подсказок: ${hints}.` : 'Шифровка разгадана с первой попытки, без подсказок.'); }
      else { mistakes++; msg.className = 'lab-msg bad'; msg.textContent = r.msg + ' Каждая ошибка стоит звезды.'; } };
    const go = button('Проверить', 'lab-main', submit); go.dataset.act = 'run';
    const hint = button('Подсказка (−1 ★)', 'lab-small', () => { hints++; hint.disabled = true; hintBox.replaceChildren(el('p', 'cd-hint', hintOf(lv))); }); hint.dataset.act = 'hint';
    bar.append(go, hint);
    const enter = inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    const k = lv.kind;

    if (k === 'caesar' || k === 'crack') {
      const left = el('div', 'lab-panel'), preview = el('div', 'cd-preview'), w = wheel(api, s => { preview.textContent = caesar(lv.cipher, -s); }); left.append(el('h3', '', 'Шифровка'), cipherLine(api, lv.cipher));
      if (k === 'crack') { const f = freq(lv.cipher).slice(0, 8), max = f[0][1], bars = el('div', 'cd-freq'); for (const [ch, c] of f) { const d = el('div'), b = el('i'); b.style.height = Math.round(80 * c / max) + 'px'; d.append(el('span', '', String(c)), b, el('span', '', ch)); bars.append(d); }
        left.append(el('h3', '', 'Частоты букв в шифровке'), bars, el('h3', '', 'Текст при текущем сдвиге'), preview, el('p', 'lab-note', 'Поверни колесо так, чтобы текст стал осмысленным, и нажми «Проверить».')); get = () => w.get(); set = a => w.set(Number(a)); }
      else { const inp = textInput(api); enter(inp); const row = el('div', 'cd-row'); row.append(inp); left.append(el('h3', '', 'Открытый текст'), row); get = () => inp.value; set = a => { inp.value = a; w.set(lv.k); }; }
      w.set(0); const wrap = el('div', 'cd-wrap'); wrap.append(left, w.node); area.append(wrap);
    } else if (k === 'atbash' || k === 'subst') {
      const panel = el('div', 'lab-panel'), tiles = el('div', 'cd-tiles'), inp = textInput(api), row = el('div', 'cd-row'); enter(inp); row.append(inp);
      const pairs = k === 'atbash' ? [...A].slice(0, N / 2).map((c, i) => [c, A[N - 1 - i]]) : [...A].map(c => [c, lv.table[c]]);
      for (const [p, c] of pairs) { const t = el('div', 'cd-tile'); t.dataset.p = p; t.dataset.c = c; t.append(el('span', '', p), el('span', '', c)); tiles.append(t); }
      const line = cipherLine(api, lv.cipher, ch => { for (const t of tiles.children) t.classList.toggle('on', t.dataset.c === ch || (k === 'atbash' && t.dataset.p === ch)); });
      panel.append(el('h3', '', 'Шифровка (нажми на букву)'), line, el('h3', '', k === 'atbash' ? 'Зеркальные пары' : 'Таблица замены: сверху — открытый текст, снизу — шифр'), tiles, el('h3', '', 'Открытый текст'), row);
      area.append(panel); get = () => inp.value; set = a => { inp.value = a; };
    } else if (k === 'encode') {
      const panel = el('div', 'lab-panel'), out = textInput(api, 'Нули и единицы'); out.inputMode = 'numeric'; enter(out);
      panel.append(el('h3', '', 'Кодовая таблица'), codeTable(api, lv.codes), el('h3', '', `Слово: ${lv.word}`), out, keypad(api, out), el('p', 'lab-note', 'Набирай нули и единицы кнопками или с клавиатуры.'));
      area.append(panel); get = () => out.value; set = a => { out.value = a; };
    } else if (k === 'decode') {
      const panel = el('div', 'lab-panel'), bits = el('div', 'cd-bits'), segs = el('div', 'cd-segs'), inp = textInput(api), row = el('div', 'cd-row'), cuts = new Set(), rev = Object.fromEntries(Object.entries(lv.codes).map(([c, v]) => [v, c])); enter(inp); row.append(inp);
      const redraw = () => { [...bits.querySelectorAll('.cd-cut')].forEach(b => b.classList.toggle('on', cuts.has(Number(b.dataset.at))));
        const at = [0, ...[...cuts].sort((a, b) => a - b), lv.bits.length], parts = []; for (let i = 0; i + 1 < at.length; i++) parts.push(lv.bits.slice(at[i], at[i + 1]));
        segs.replaceChildren(...parts.map(p => { const s = el('span', 'cd-seg' + (rev[p] ? '' : ' bad')); s.append(document.createTextNode(p), el('b', '', rev[p] || '?')); return s; }));
        if (cuts.size && parts.every(p => rev[p])) inp.value = parts.map(p => rev[p]).join(''); };
      [...lv.bits].forEach((b, i) => { if (i) { const c = button('', 'cd-cut', () => { cuts.has(i) ? cuts.delete(i) : cuts.add(i); redraw(); }); c.dataset.at = i; c.setAttribute('aria-label', `Разрез после ${i}-го бита`); bits.append(c); } bits.append(el('span', 'cd-bit', b)); });
      panel.append(el('h3', '', 'Кодовая таблица'), codeTable(api, lv.codes), el('h3', '', 'Шифровка: нажимай между цифрами, чтобы разрезать'), bits, segs, el('h3', '', 'Расшифровка'), row);
      area.append(panel); redraw(); get = () => inp.value;
      set = a => { inp.value = a; cuts.clear(); let pos = 0; for (const ch of norm(a).slice(0, -1)) { if (!lv.codes[ch]) break; pos += lv.codes[ch].length; cuts.add(pos); } redraw(); inp.value = a; };
    } else if (k === 'fano') {
      const panel = el('div', 'lab-panel'), pickd = new Set(), table = codeTable(api, lv.codes, (c, b) => { pickd.has(c) ? pickd.delete(c) : pickd.add(c); b.classList.toggle('on', pickd.has(c)); });
      panel.append(el('h3', '', 'Нажми на буквы, коды которых нарушают условие Фано'), table, el('p', 'lab-note', 'Отметить нужно все такие буквы — и ту, чей код является началом, и ту, чей код с него начинается.'));
      area.append(panel); get = () => [...pickd]; set = a => { pickd.clear(); a.forEach(x => pickd.add(x)); for (const b of table.children) b.classList.toggle('on', pickd.has(b.dataset.letter)); };
    } else if (k === 'fanoAdd') {
      const panel = el('div', 'lab-panel'), out = textInput(api, 'Код для буквы ' + lv.letter), live = el('p', 'cd-live'), table = codeTable(api, lv.codes); out.inputMode = 'numeric'; enter(out);
      const upd = () => { const b = bitsOf(out.value); for (const t of table.children) t.classList.toggle('warn', !!b && /^[01]+$/.test(b) && (lv.codes[t.dataset.letter].startsWith(b) || b.startsWith(lv.codes[t.dataset.letter])));
        const bad = Object.entries(lv.codes).filter(([, v]) => b && (v.startsWith(b) || b.startsWith(v))).map(([c]) => c);
        live.className = 'cd-live' + (!b ? '' : bad.length || !/^[01]+$/.test(b) ? ' bad' : ' good'); live.textContent = !b ? '' : !/^[01]+$/.test(b) ? 'Только 0 и 1.' : bad.length ? `Конфликт с кодом буквы ${bad.join(', ')}.` : `Условие Фано выполняется. Длина ${b.length}. А короче нельзя?`; };
      out.addEventListener('input', upd);
      panel.append(el('h3', '', 'Коды букв'), table, el('h3', '', `Код для буквы ${lv.letter}`), out, keypad(api, out, upd), live);
      area.append(panel); get = () => out.value; set = a => { out.value = a; upd(); };
    } else if (k === 'shortest') {
      const grid = el('div', 'cd-opts'); let chosen = null;
      lv.options.forEach((codes, i) => { const card = button('', 'cd-opt', () => { chosen = i; [...grid.children].forEach(x => x.classList.toggle('on', x === card)); }), t = el('table'), probe = el('small', '', '');
        card.dataset.opt = i; for (const [c, v] of Object.entries(codes)) { const tr = el('tr'); tr.append(el('td', '', c), el('td', '', v)); t.append(tr); }
        const tryIt = el('span', 'lab-small', `Закодировать «${lv.word}»`); tryIt.setAttribute('role', 'button'); tryIt.tabIndex = 0; const doTry = e => { e.stopPropagation(); probe.textContent = encode(lv.word, codes); }; tryIt.addEventListener('click', doTry); tryIt.addEventListener('keydown', e => { if (e.key === 'Enter') doTry(e); });
        card.append(el('strong', '', `Таблица ${i + 1}`), t, tryIt, probe); grid.append(card); });
      area.append(grid); get = () => chosen; set = a => { chosen = Number(a); [...grid.children].forEach((x, i) => x.classList.toggle('on', i === chosen)); };
    } else if (k === 'vigenere') {
      const panel = el('div', 'lab-panel'), cols = el('div', 'cd-vig'), abc = el('div', 'cd-abc'), inp = textInput(api), row = el('div', 'cd-row'); enter(inp); row.append(inp); let j = 0;
      for (const ch of lv.cipher) { const d = el('div', ch === ' ' ? 'gap' : ''); if (ch !== ' ') { const kc = lv.key[j++ % lv.key.length]; d.append(el('span', 'c', ch), el('span', 'k', kc), el('span', 'k', String(A.indexOf(kc)))); } cols.append(d); }
      [...A].forEach((c, i) => { const s = el('span'); s.append(document.createTextNode(c), el('small', '', String(i))); abc.append(s); });
      panel.append(el('h3', '', 'Шифровка, буквы ключа и их сдвиги'), cols, el('h3', '', 'Номера букв'), abc, el('h3', '', 'Открытый текст'), row, el('p', 'lab-note', 'Расшифровка: номер буквы шифра минус номер буквы ключа; если получилось меньше нуля — прибавь 32.'));
      area.append(panel); get = () => inp.value; set = a => { inp.value = a; };
    }
    area.append(hintBox, bar, msg, el('p', 'lab-note', 'Три звезды — за решение с первой попытки без подсказок.'));
    if (api.debugHost) window.labSet = a => set(a);
    return () => { if (api.debugHost && window.labSet) delete window.labSet; };
  }

  LAB.register({id: 'codes', bg: 'bg_detective', title: 'Шифровальщик', genre: 'кодирование и шифры', art: '🔐', color: '#c58cff', unit: 'Уровень', minutes: 40,
    about: 'Шифровальное бюро Кодограда: колесо Цезаря, Атбаш, таблица замены и шифр Виженера, двоичные коды переменной длины, условие Фано и взлом шифра по частоте букв.',
    levels, mount, check, solve: lv => answerOf(lv),
    lib: {A, caesar, atbash, vigenere, encode, decodings, uniquelyDecodable, isPrefixFree, conflicts, freeCode, freq, norm}});
})();
