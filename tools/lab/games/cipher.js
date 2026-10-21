// «Шифровальня»: защита информации и основы криптографии (9 кл. §4.3–4.4, 11 кл. §18 «Информационное право и информационная безопасность»).
// Шифр Цезаря (зашифровать, расшифровать, взлом перебором на колесе), частотный анализ по букве «О», скитала и перестановка по ключу, шифр Виженера,
// число ключей; в 10–11 классах — учебный RSA на маленьких простых числах. Алфавит — 32 буквы без Ё (как в «Детективе» и «Сбое на станции»): Ё в ответах читается как Е.
// Сообщения каждый раз новые (из зерна), ответы проверяются пересчётом: расшифровка ответа должна дать исходный текст.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1)), pick = (r, a) => a[Math.floor(r() * a.length)], shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const A = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', N = A.length, ix = c => A.indexOf(c), md = (a, m) => (a % m + m) % m;
  const pl = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c, fmt = x => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  // Ответ ученика: регистр, пробелы, знаки и Ё/Е не важны; число — целое, пробелы между разрядами допустимы.
  const norm = s => String(s == null ? '' : s).toUpperCase().replace(/Ё/g, 'Е').replace(/[^А-Я]/g, ''), letters = s => s.replace(/[^А-Я]/g, '');
  const int = s => { const t = String(s == null ? '' : s).replace(/\s+/g, ''); return /^[+-]?\d{1,12}$/.test(t) ? Number(t) : NaN; };
  /* ---------- шифры: буквы вне алфавита (пробелы, точки) не меняются ---------- */
  const caesar = (s, k) => [...s].map(c => ix(c) < 0 ? c : A[md(ix(c) + k, N)]).join('');
  // Виженер: ключ идёт только по буквам; sign = 1 — шифруем, −1 — расшифровываем.
  const vig = (s, key, sign = 1) => { let j = 0; return [...s].map(c => ix(c) < 0 ? c : A[md(ix(c) + sign * ix(key[j++ % key.length]), N)]).join(''); };
  // Скитала: текст пишут строками по c символов (пробел — «_», хвост добивается «_») и отправляют по столбцам сверху вниз.
  const pad = (s, c) => { s = s.replace(/ /g, '_'); while (s.length % c) s += '_'; return s; };
  const scyEnc = (s, c) => { const t = pad(s, c), r = t.length / c; let out = ''; for (let j = 0; j < c; j++) for (let i = 0; i < r; i++) out += t[i * c + j]; return out; };
  const scyDec = (t, c) => { if (!Number.isInteger(c) || c < 1 || t.length % c) return null; const r = t.length / c; let out = ''; for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out += t[j * r + i]; return out; };
  // Перестановка по ключу: key[j] — номер над j-м столбцом; столбцы отправляют блоками в порядке номеров 1, 2, 3…
  const permEnc = (s, key) => { const c = key.length, t = pad(s, c), r = t.length / c; return key.map((_, j) => j).sort((a, b) => key[a] - key[b]).map(j => Array.from({length: r}, (_, i) => t[i * c + j]).join('')); };
  const permDec = (blocks, key) => { let out = ''; for (let i = 0; i < blocks[0].length; i++) for (const k of key) out += blocks[k - 1][i]; return out; };
  // RSA: НОД, возведение в степень по модулю, обратный элемент перебором.
  const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a), mpow = (b, e, m) => { let r = 1; b %= m; for (; e > 0; e = Math.floor(e / 2), b = b * b % m) if (e % 2) r = r * b % m; return r; }, inv = (e, f) => { for (let d = 1; d < f; d++) if (e * d % f === 1) return d; return 0; };
  const counts = t => { const m = {}; for (const c of t) if (ix(c) >= 0) m[c] = (m[c] || 0) + 1; return m; };
  /* ---------- тексты: короткие фразы про информатику (без Ё) ---------- */
  const WORDS = ['БАЙТ', 'СЕТЬ', 'ФАЙЛ', 'ДИСК', 'ЦИКЛ', 'РОБОТ', 'ПАМЯТЬ', 'ЭКРАН', 'ПАРОЛЬ', 'КЛЮЧ', 'ШИФР', 'СЕРВЕР', 'ВИРУС', 'ПИКСЕЛЬ', 'МОДЕМ', 'ДАННЫЕ', 'АЛГОРИТМ', 'МАССИВ', 'ТАБЛИЦА', 'ЛОГИН', 'БРАУЗЕР', 'СИГНАЛ', 'ПРИНТЕР', 'МЫШЬ', 'ПРОГРАММА',
    'ЯЧЕЙКА', 'ФУНКЦИЯ', 'СИМВОЛ', 'ПАКЕТ', 'АДРЕС', 'ДОМЕН', 'ПОЧТА', 'ЗАЩИТА', 'ДОСТУП', 'КОПИЯ', 'ЧИСЛО', 'ЛОГИКА', 'СПИСОК', 'ЦИФРА', 'ЯРЛЫК', 'ЖУРНАЛ', 'ВЗЛОМ', 'ХАКЕР', 'ТРОЯН', 'ЧЕРВЬ', 'ФИШИНГ', 'ПОДПИСЬ', 'СЕЙФ', 'КОМПЬЮТЕР', 'ЮНИКОД', 'ШЛЮЗ', 'КАНАЛ', 'ПРОТОКОЛ', 'ОБЛАКО', 'ТОКЕН', 'ФИЛЬТР', 'КЛАВИША'];
  const PHRASES = ['ПАРОЛЬ НЕ ГОВОРИ НИКОМУ', 'КЛЮЧ ЛЕЖИТ ПОД КЛАВИАТУРОЙ', 'ВСТРЕЧА В КОМПЬЮТЕРНОМ КЛАССЕ', 'СЕРВЕР ВКЛЮЧАТ В ПОЛНОЧЬ', 'БАЙТ СОСТОИТ ИЗ ВОСЬМИ БИТ', 'ДЕЛАЙ РЕЗЕРВНЫЕ КОПИИ', 'ОБНОВИ АНТИВИРУС СЕГОДНЯ', 'НЕ ОТКРЫВАЙ ЧУЖИЕ ФАЙЛЫ',
    'ПРОГРАММА РАБОТАЕТ ВЕРНО', 'ЗАЩИТА ИНФОРМАЦИИ ВАЖНА', 'ДВОИЧНЫЙ КОД ПОНЯТЕН МАШИНЕ', 'ПРОВЕРЬ АДРЕС ОТПРАВИТЕЛЯ', 'ЛОГИН И ПАРОЛЬ ХРАНИ В ТАЙНЕ', 'ЦИФРОВАЯ ПОДПИСЬ ЗАЩИЩАЕТ ДОКУМЕНТ', 'ШИФР ЦЕЗАРЯ ЛЕГКО ВЗЛОМАТЬ', 'КОМПЬЮТЕР ВЫПОЛНЯЕТ КОМАНДЫ',
    'ДАННЫЕ ХРАНЯТСЯ НА ДИСКЕ', 'ФАЙЛ ЛЕЖИТ В ПАПКЕ ПРОЕКТЫ', 'ОПЕРАТИВНАЯ ПАМЯТЬ БЫСТРАЯ', 'СЛОЖНЫЙ ПАРОЛЬ ТРУДНО ПОДОБРАТЬ', 'НЕ ПЕРЕХОДИ ПО СТРАННЫМ ССЫЛКАМ', 'ТАБЛИЦА ПОСЧИТАЕТ СУММУ', 'ЦИКЛ ПОВТОРЯЕТ КОМАНДЫ', 'УРОК ИНФОРМАТИКИ НАЧАЛСЯ',
    'РОБОТ ОБХОДИТ ПРЕПЯТСТВИЕ', 'МАССИВ ХРАНИТ ДЕСЯТЬ ЧИСЕЛ', 'ЭКРАН ПОКАЗЫВАЕТ КАРТИНКУ', 'ПОЧТА ПРИХОДИТ ПО ПРОТОКОЛУ', 'ХАКЕР ОТПРАВИЛ ПОДДЕЛЬНОЕ ПИСЬМО', 'ВКЛЮЧИ ДВУХФАКТОРНУЮ ЗАЩИТУ', 'КОД ОТ СЕЙФА У ДИРЕКТОРА', 'БРАУЗЕР ОТКРЫЛ СТРАНИЦУ',
    'ВИРУС ПРЯЧЕТСЯ ВО ВЛОЖЕНИИ', 'АЛГОРИТМ ВСЕГДА КОНЕЧЕН', 'ОБЛАКО ХРАНИТ ФОТОГРАФИИ', 'МОДЕМ СОЕДИНЯЕТ С ИНТЕРНЕТОМ'];
  const KEYS = ['КОД', 'БИТ', 'ЛУЧ', 'ДОМ', 'ЛЕС', 'МИР', 'КЛЮЧ', 'ШИФР', 'ПОРТ', 'ДИСК', 'СЕТЬ', 'ЦИКЛ'], SHORT = PHRASES.filter(p => letters(p).length <= 20), KNOWN = 'СЕКРЕТНО';
  const vocab = new Set([...WORDS, ...PHRASES.flatMap(p => p.split(' '))]), readable = t => t.split(/[ .]+/).filter(Boolean).every(w => vocab.has(w));
  /* ---------- разбор ошибок ---------- */
  const no = c => `«${c}» (${ix(c)})`, over = s => s >= N ? ` − 32 = ${s - N}` : s < 0 ? ` + 32 = ${s + N}` : '', sg = x => x < 0 ? '−' + -x : String(x);
  const plus = (c, k) => `${no(c)} ${k < 0 ? '−' : '+'} ${Math.abs(k)} = ${sg(ix(c) + k)}${over(ix(c) + k)} → «${A[md(ix(c) + k, N)]}»`;
  const vplus = (c, kc, sign) => `${no(c)} ${sign < 0 ? '−' : '+'} ключ ${no(kc)} = ${sg(ix(c) + sign * ix(kc))}${over(ix(c) + sign * ix(kc))} → «${A[md(ix(c) + sign * ix(kc), N)]}»`;
  // Где первая неверная буква и как она получается (how(i) — разбор i-й буквы ответа).
  const firstWrong = (want, got, how) => { const w = norm(want), g = norm(got); let i = 0; while (i < w.length && w[i] === g[i]) i++;
    return (g.length !== w.length ? `В ответе должно быть ${w.length} ${pl(w.length, 'буква', 'буквы', 'букв')}, а у тебя ${g.length}. ` : '') + (i < w.length ? `Первая неверная — ${i + 1}-я буква: ${how(i)}.` : ''); };
  // Чтение таблицы по столбцам: i-я буква шифровки — из какого столбца и строки (key — номера над столбцами, по умолчанию 1, 2, 3…).
  const colTip = (text, c, key) => i => { const t = pad(text, c), r = t.length / c, b = Math.floor(i / r), j = key ? key.indexOf(b + 1) : b, ch = t[(i % r) * c + j];
    return `читаем ${key ? `столбец с номером ${b + 1} (это ${j + 1}-й столбец)` : `${j + 1}-й столбец`} сверху вниз, ${i % r + 1}-я буква в нём — «${ch === '_' ? '_' : ch}»`; };
  /* ---------- шаги заданий ---------- */
  // Шаг: kind — как отвечают (text, num, wheel, cols, bars, pick), q — вопрос, show — шифровка на экране, help — помощники, answer — образец,
  // ok(a) — проверка пересчётом, tip(a) — разбор ошибки, why — пояснение после верного ответа, data — исходные данные (для теста).
  const T = (q, show, want, how, extra) => ({kind: 'text', q, show, answer: want, ok: a => norm(a) !== '' && norm(a) === norm(want), tip: a => firstWrong(want, a, how), ...extra});
  const Num = (q, want, tip, extra) => ({kind: 'num', q, answer: want, ok: a => int(a) === want, tip: typeof tip === 'function' ? tip : () => tip, ...extra});
  const W = (r, f) => pick(r, WORDS.filter(f)), order = (r, c) => { for (;;) { const p = shuffle(r, Array.from({length: c}, (_, i) => i + 1)); if (p.some((x, i) => x !== i + 1)) return p; } };
  const PR = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
  // Ключи RSA. Отбрасываем e, при которых шифр вырождается: e² ≡ 1 (mod λ(n)) — тогда шифровка не меняет числа или e расшифровывает не хуже d.
  const rsaKeys = r => { for (;;) { const p = pick(r, PR), q = pick(r, PR), n = p * q, f = (p - 1) * (q - 1), lam = f / gcd(p - 1, q - 1), e = pick(r, [3, 5, 7, 11, 13, 17]); if (p === q || n < 33 || n > 700 || e >= f || gcd(e, f) !== 1 || (e * e - 1) % lam === 0) continue; const d = inv(e, f); if (d > 1 && d !== e) return {p, q, n, f, e, d}; } };
  const rsaD = (e, f, extra) => ({kind: 'num', q: `Найди закрытый ключ d — число от 1 до ${f - 1}, для которого e · d при делении на φ(n) = ${f} даёт остаток 1 (e = ${e}).`, answer: inv(e, f), help: {type: 'calc'},
    ok: a => { const x = int(a); return x > 0 && x < f && e * x % f === 1; }, tip: a => { const x = int(a); return !(x > 0) ? `d — целое число от 1 до ${f - 1}.` : x >= f ? `d должно быть меньше φ(n) = ${f}.` : `Проверка: ${e} · ${x} = ${e * x}, остаток от деления на ${f} — ${e * x % f}, а нужен 1. Перебирай d = 1, 2, 3, … и считай ${e} · d mod ${f} (или примени расширенный алгоритм Евклида).`; }, ...extra});
  const G = {
    // 1. Цезарь: зашифровать. Во втором слове счёт обязательно переходит через конец алфавита (после Я снова А).
    enc(r) { const w1 = W(r, w => w.length <= 6), k2 = ri(r, 4, 9); let w2; do w2 = W(r, w => w !== w1 && w.length <= 7); while (![...w2].some(c => ix(c) + k2 >= N));
      return [T(`Зашифруй слово ${w1} шифром Цезаря со сдвигом 3: каждую букву замени буквой, которая стоит в алфавите на 3 места дальше.`, w1, caesar(w1, 3), i => plus(w1[i], 3), {help: {type: 'wheel'}, data: {text: w1, k: 3}, why: 'Со сдвигом 3, по преданию, шифровал письма сам Юлий Цезарь.'}),
        T(`Зашифруй слово ${w2} со сдвигом ${k2}. Когда алфавит кончается, счёт продолжается с начала: после Я идёт А.`, w2, caesar(w2, k2), i => plus(w2[i], k2), {help: {type: 'wheel'}, data: {text: w2, k: k2}, why: 'Алфавит замкнут в кольцо — поэтому шифр Цезаря удобно показывать колесом.'})]; },
    // 2. Цезарь: расшифровать, когда ключ известен.
    dec(r) { const w = W(r, x => x.length >= 5 && x.length <= 8), k1 = ri(r, 2, 9), p = pick(r, PHRASES.filter(x => letters(x).length <= 24)); let k2; do k2 = ri(r, 5, 15); while (k2 === k1); const c1 = caesar(w, k1), c2 = caesar(p, k2);
      return [T(`Перехвачено слово, зашифрованное шифром Цезаря со сдвигом ${k1}. Расшифруй его: сдвинь каждую букву на ${k1} ${pl(k1, 'место', 'места', 'мест')} назад.`, c1, w, i => plus(c1[i], -k1), {help: {type: 'wheel'}, data: {cipher: c1, k: k1}, why: 'Расшифровка — тот же сдвиг, только в обратную сторону.'}),
        T(`Теперь целая фраза, сдвиг ${k2}. Пробелы не шифровались.`, c2, p, i => plus(letters(c2)[i], -k2), {help: {type: 'wheel'}, data: {cipher: c2, k: k2}, why: 'Тот, кто знает ключ, читает шифровку за минуту.'})]; },
    // 3. Взлом перебором: крутим колесо, пока текст не станет осмысленным. Фразы подобраны так, что читается ровно один сдвиг.
    crack(r) { const out = []; for (const [lo, hi] of [[1, 9], [10, 31]]) { let p, k, c; do { p = pick(r, PHRASES.filter(x => letters(x).length <= 26 && !out.some(s => s.data.plain === x))); k = ri(r, lo, hi); c = caesar(p, k); } while (A.split('').filter((_, s) => readable(caesar(c, -s))).length !== 1);
      out.push({kind: 'wheel', q: out.length ? 'Вторая шифровка — сдвиг побольше. Кнопки «±5» крутят быстрее.' : 'Ключ неизвестен. Поворачивай внутреннее кольцо колеса, пока шифровка не превратится в осмысленную фразу, и нажми «Читается!».', show: c, answer: k, data: {cipher: c, plain: p}, help: {type: 'wheel', cipher: c},
        ok: a => Number.isInteger(int(a)) && norm(caesar(c, -int(a))) === norm(p), tip: a => Number.isInteger(int(a)) ? `При сдвиге ${int(a)} получается «${caesar(c, -int(a))}» — так не пишут. Ищи сдвиг, при котором получаются слова; короткие слова вроде «В», «НЕ», «ПО» узнаются быстрее всего.` : 'Сдвиг — целое число от 0 до 31.',
        why: `Сдвиг ${k}. Всего у шифра Цезаря 31 ключ — перебрать их можно за пару минут, поэтому такой шифр ненадёжен.`}); } return out; },
    // 4. Частотный анализ: самая частая буква русского текста — «О». Текст подбирается так, чтобы «О» в нём была самой частой с запасом.
    freq(r) { let parts, text, cnt; for (;;) { parts = []; for (const p of shuffle(r, PHRASES)) { parts.push(p); if (letters(parts.join('')).length >= 80) break; } text = parts.join('. ') + '.'; cnt = counts(text);
        const o = cnt['О'] || 0; if (Object.entries(cnt).every(([c, n]) => c === 'О' || n + 2 <= o)) break; }
      const k = ri(r, 3, 29), c = caesar(text, k), X = caesar('О', k), cc = counts(c), max = Math.max(...Object.values(cc)), first = parts[0];
      return [{kind: 'bars', q: 'Перехвачена длинная шифровка Цезаря. Под ней — сколько раз встречается каждая буква. Какая буква шифровки встречается чаще всех? Нажми на её столбик.', show: c, answer: X, data: {cipher: c, plain: text}, help: {type: 'bars', text: c},
          ok: a => norm(a).length === 1 && cc[norm(a)] === max, tip: a => `Буква «${norm(a)}» встречается ${cc[norm(a)] || 0} ${pl(cc[norm(a)] || 0, 'раз', 'раза', 'раз')}, а есть буква, которая встречается чаще. Сравни высоту столбиков.`, why: `«${X}» встречается ${max} ${pl(max, 'раз', 'раза', 'раз')} — чаще всех.`},
        Num(`В русских текстах чаще всех встречается буква «О». Значит, «${X}» — это зашифрованная «О». Найди сдвиг: на сколько мест «О» сдвинута до «${X}»?`, k, `Сдвиг = номер «${X}» − номер «О» (если вышло отрицательное число, прибавь 32). Номера букв — на полоске под колесом: А = 0, Б = 1, …, О = 14.`,
          {show: c, help: {type: 'wheel'}, data: {cipher: c}, ok: a => Number.isInteger(int(a)) && norm(caesar(c, -int(a))) === norm(text), why: `«${X}» (${ix(X)}) − «О» (14) = ${ix(X) - 14}${ix(X) < 14 ? ' + 32 = ' + k : ''}. Сдвиг ${k}.`}),
        T(`Сдвиг ${k} найден. Расшифруй первое предложение (до точки).`, c, first, i => plus(letters(caesar(first, k))[i], -k), {help: {type: 'wheel'}, data: {cipher: c, k}, why: 'Частотный анализ взламывает любой шифр простой замены, если текст достаточно длинный.'})]; },
    // 5. Скитала: шифровку пишут по столбцам; при верном числе столбцов строки читаются. Затем — зашифровать слово самому.
    scy(r) { let p, c, t; do { p = pick(r, PHRASES.filter(x => x.length <= 30)); c = ri(r, 3, 6); t = scyEnc(p, c); } while (norm(t) === norm(p) || A.split('').some((_, d) => d >= 2 && d !== c && scyDec(t, d) && norm(scyDec(t, d)) === norm(p)));
      let w, c2; do { w = W(r, x => x.length >= 6); c2 = ri(r, 2, 4); } while (w.length % c2 || w.length / c2 < 2);
      return [{kind: 'cols', q: 'Сообщение записали в таблицу по строкам (пробел — «_») и отправили, читая таблицу по столбцам сверху вниз. Подбери число столбцов, при котором строки таблицы читаются, и нажми «Читается!».', show: t, answer: c, data: {cipher: t, plain: p}, help: {type: 'cols', cipher: t},
          ok: a => { const d = scyDec(t, int(a)); return d != null && norm(d) === norm(p); }, tip: a => { const x = int(a), d = scyDec(t, x); return !(x >= 1) ? 'Число столбцов — целое число от 2 до 12.' : d == null ? `${t.length} символов не делится на ${x}: таблица с ${x} столбцами не заполнится ровно.` : `При ${x} столбцах строки читаются как «${d.replace(/_/g, ' ').trim()}» — смысла нет.`; },
          why: `${c} ${pl(c, 'столбец', 'столбца', 'столбцов')}. В Древней Спарте ленту наматывали на жезл — скиталу; прочитать письмо мог тот, у кого жезл такой же толщины.`},
        T(`Теперь зашифруй сам: запиши слово ${w} в таблицу по ${c2} ${pl(c2, 'букве', 'буквы', 'букв')} в строке и выпиши столбцы по порядку, каждый сверху вниз.`, null, scyEnc(w, c2), colTip(w, c2), {help: {type: 'rows', text: w, c: c2}, data: {text: w, c: c2}, why: 'Буквы остались те же — изменился только их порядок. Это шифр перестановки.'})]; },
    // 6. Перестановка по ключу: столбцы отправляют в порядке номеров, записанных над ними.
    perm(r) { const c = ri(r, 3, 4), key = order(r, c), p = pick(r, PHRASES.filter(x => x.length <= 26)), blocks = permEnc(p, key), w = W(r, x => x.length % 3 === 0 && x.length >= 6), key2 = order(r, 3), b2 = permEnc(w, key2);
      return [T(`Сообщение записали в таблицу по ${c} ${pl(c, 'символу', 'символа', 'символов')} в строке (пробел — «_»). Над столбцами написали ключ ${key.join(' ')} и отправили столбцы по порядку номеров: сначала столбец с номером 1, затем с номером 2 и так далее. Каждый блок шифровки — один столбец. Расшифруй сообщение.`, blocks.join(' '), p,
        i => { const t = pad(p, c); let pos = -1; for (let n = 0; n <= i; pos++) if (t[pos + 1] !== '_') n++; const j = pos % c, row = Math.floor(pos / c); return `она стоит в ${row + 1}-й строке ${j + 1}-го столбца; над ним номер ${key[j]}, значит, это ${key[j]}-й блок «${blocks[key[j] - 1]}», его ${row + 1}-я буква — «${t[pos]}»`; },
        {help: {type: 'perm', blocks, key}, data: {blocks, key}, why: 'Получатель, зная ключ, ставит каждый блок под свой номер и читает строки.'}),
        T(`Зашифруй слово ${w} ключом ${key2.join(' ')}: запиши по 3 буквы в строке, над столбцами — номера ключа, и выпиши столбцы в порядке номеров.`, null, b2.join(''), colTip(w, 3, key2), {help: {type: 'rows', text: w, c: 3, key: key2}, data: {text: w, key: key2}, why: 'Без ключа получателю пришлось бы перебирать все порядки столбцов.'})]; },
    // 7. Виженер: зашифровать. У каждой буквы свой сдвиг — номер буквы ключа под ней.
    venc(r) { const w = W(r, x => x.length >= 5 && x.length <= 8), k1 = pick(r, KEYS.filter(k => k.length === 3)), p = pick(r, SHORT), k2 = pick(r, KEYS.filter(k => k.length === 4)), lw = letters(p);
      return [T(`Зашифруй слово ${w} шифром Виженера с ключом ${k1}. Ключ пишут под словом, повторяя его, и каждую букву сдвигают вперёд на номер буквы ключа под ней.`, w, vig(w, k1), i => vplus(w[i], k1[i % 3], 1), {help: [{type: 'vig', text: w, key: k1}, {type: 'wheel'}], data: {text: w, key: k1}, why: 'Одинаковые буквы текста теперь могут шифроваться по-разному — частотный анализ уже не так прост.'}),
        T(`Теперь фраза, ключ ${k2}. Пробелы не шифруются, и буквы ключа на них не тратятся.`, p, vig(p, k2), i => vplus(lw[i], k2[i % 4], 1), {help: [{type: 'vig', text: p, key: k2}, {type: 'wheel'}], data: {text: p, key: k2}, why: 'Шифр Виженера три века считали «неразгадываемым».'})]; },
    // 8. Виженер: расшифровать — вычитаем номер буквы ключа.
    vdec(r) { const w = W(r, x => x.length >= 5 && x.length <= 8), k1 = pick(r, KEYS.filter(k => k.length === 3)), p = pick(r, SHORT), k2 = pick(r, KEYS.filter(k => k.length === 4)), c1 = vig(w, k1), c2 = vig(p, k2), l2 = letters(c2);
      return [T(`Расшифруй слово, зашифрованное шифром Виженера с ключом ${k1}: из каждой буквы вычти номер буквы ключа под ней.`, c1, w, i => vplus(c1[i], k1[i % 3], -1), {help: [{type: 'vig', text: c1, key: k1, label: 'шифр'}, {type: 'wheel'}], data: {cipher: c1, key: k1}, why: 'Расшифровка — тот же ключ, только сдвиги в обратную сторону.'}),
        T(`Теперь фраза, ключ ${k2}. Пробелы не шифровались.`, c2, p, i => vplus(l2[i], k2[i % 4], -1), {help: [{type: 'vig', text: c2, key: k2, label: 'шифр'}, {type: 'wheel'}], data: {cipher: c2, key: k2}, why: 'Шифры, где один ключ и шифрует, и расшифровывает, называют симметричными.'})]; },
    // 9. Атака по известному тексту: каждое письмо начинается словом СЕКРЕТНО — по нему восстанавливается ключ.
    vkey(r) { const key = pick(r, KEYS), p = pick(r, SHORT), text = KNOWN + ' ' + p, c = vig(text, key), lc = letters(c), kk = [...KNOWN].map((x, i) => A[md(ix(lc[i]) - ix(x), N)]).join('');
      return [{kind: 'text', q: `Хакер шифрует письма шифром Виженера, и каждое письмо начинается словом ${KNOWN}. Найди ключ: буква ключа = буква шифровки − буква открытого текста. Ключ повторяется — запиши его один раз.`, show: c, answer: key, data: {cipher: c, known: KNOWN}, help: [{type: 'vig', text: c, known: KNOWN, label: 'шифр'}, {type: 'wheel'}],
          ok: a => norm(a) !== '' && norm(vig(c, norm(a), -1)) === norm(text), tip: a => (norm(a) ? `С ключом ${norm(a)} начало письма читается как «${vig(c, norm(a), -1).slice(0, KNOWN.length)}», а должно быть ${KNOWN}. ` : '') + `Вычитай по буквам: ${vplus(lc[0], KNOWN[0], -1).replace('ключ ', '')} — это первая буква ключа. Сделай так для всех восьми букв слова ${KNOWN} и найди повторяющийся кусок.`, why: `Восемь букв слова ${KNOWN} дали «${kk}» — ключ ${key} повторяется.`},
        T('Ключ найден. Расшифруй письмо (слово СЕКРЕТНО можно не писать).', c, p, null, {help: [{type: 'vig', text: c, key, label: 'шифр'}, {type: 'wheel'}], data: {cipher: c, key}, ok: a => norm(a) !== '' && (norm(a) === norm(p) || norm(a) === norm(text)),
          tip: a => { const full = norm(a).startsWith(KNOWN), off = full ? 0 : KNOWN.length; return firstWrong(full ? text : p, a, i => vplus(lc[i + off], key[(i + off) % key.length], -1)); }, why: 'Поэтому в письмах нельзя повторять стандартные начала: известный кусок текста выдаёт ключ.'})]; },
    // 10. Сколько ключей: надёжность шифра — в числе ключей, которые придётся перебрать.
    keys(r) { const [name, M] = pick(r, [['латинского алфавита (26 букв)', 26], ['русского алфавита без Ё (32 буквы)', 32], ['русского алфавита с Ё (33 буквы)', 33], ['алфавита из 10 цифр', 10], ['греческого алфавита (24 буквы)', 24]]), m = ri(r, 2, 4), n = ri(r, 20, 32), j = ri(r, Math.max(10, n - 14), Math.min(20, n - 4)), t = ri(r, 2, 10);
      return [Num(`Шифр Цезаря для ${name}. Сколько существует сдвигов, которые действительно меняют текст?`, M - 1, `Сдвиги 1, 2, …, ${M - 1} дают разные шифровки, а сдвиг на ${M} (как и на 0) возвращает каждую букву на место.`, {data: {M}, why: `${M} − 1 = ${M - 1} ${pl(M - 1, 'ключ', 'ключа', 'ключей')} — ничтожно мало для компьютера.`}),
        Num(`Ключ шифра Виженера — любое сочетание из ${m} букв русского алфавита (32 буквы, буквы могут повторяться). Сколько всего разных ключей?`, 32 ** m, `На каждое из ${m} мест — 32 варианта, а варианты разных мест перемножаются: ${Array(m).fill(32).join(' · ')}.`, {data: {m}, why: `32^${m} = ${fmt(32 ** m)}. С каждой новой буквой ключа ключей в 32 раза больше.`}),
        Num(`Ключ — двоичный, длиной ${n} бит. Компьютер проверяет ${fmt(2 ** j)} ключей в секунду. За сколько секунд он гарантированно переберёт все ключи?`, 2 ** (n - j), `Всего ключей 2^${n}, за секунду проверяется ${fmt(2 ** j)} = 2^${j}. Время = 2^${n} / 2^${j}.`, {data: {n, j}, why: `2^${n} / 2^${j} = 2^${n - j} = ${fmt(2 ** (n - j))} с.`}),
        Num(`Ключ удлинили на ${t} бит. Во сколько раз дольше теперь придётся перебирать все ключи?`, 2 ** t, 'Каждый новый бит удваивает число ключей: с одним битом — вдвое больше, с двумя — вчетверо…', {data: {t}, why: `2^${t} = ${fmt(2 ** t)}. Поэтому современные ключи длиной 128–256 бит перебрать невозможно.`})]; },
    // 11. RSA: ключи. n = p·q, φ(n) = (p − 1)(q − 1), e взаимно просто с φ(n), e·d ≡ 1 (mod φ(n)).
    rsa1(r) { const {p, q, n, f, e} = rsaKeys(r), odd = shuffle(r, Array.from({length: Math.min(f - 1, 40)}, (_, i) => i + 2).filter(x => gcd(x, f) > 1 && x % 2)), even = shuffle(r, [2, 4, 6, 8, 10, 12, 14].filter(x => x < f)), wrong = [...odd.slice(0, 2), ...even].slice(0, 3), opts = shuffle(r, [e, ...wrong]), calc = {type: 'calc'};
      return [Num(`Чтобы сделать ключи RSA, выбрали два простых числа: p = ${p} и q = ${q}. Найди модуль n = p · q.`, n, `n = ${p} · ${q}.`, {help: calc, data: {p, q}, why: `n = ${n}. Это число войдёт в открытый ключ, а p и q держат в секрете.`}),
        Num(`Найди функцию Эйлера φ(n) = (p − 1) · (q − 1).`, f, `φ(n) = (${p} − 1) · (${q} − 1) = ${p - 1} · ${q - 1}.`, {help: calc, why: `φ(n) = ${f}: столько чисел от 1 до ${n} не имеют общих делителей с n.`}),
        {kind: 'pick', q: `Открытая экспонента e должна быть взаимно простой с φ(n) = ${f}, то есть НОД(e, ${f}) = 1. Какое число подходит?`, options: opts, answer: e, help: calc, data: {f, options: opts},
          ok: a => opts.includes(int(a)) && gcd(int(a), f) === 1, tip: a => !opts.includes(int(a)) ? 'Выбери одно из чисел на кнопках.' : `НОД(${int(a)}, ${f}) = ${gcd(int(a), f)}: у чисел есть общий делитель, и для такого e не найдётся закрытого ключа d.`, why: `НОД(${e}, ${f}) = 1. Открытый ключ: (e, n) = (${e}, ${n}).`},
        rsaD(e, f, {data: {e, f}, why: 'Закрытый ключ найден. Зная только n и e, его не вычислить без разложения n на множители — для настоящих ключей из сотен цифр это не под силу никому.'})]; },
    // 12. RSA: полный цикл — ключи, шифрование числа c = m^e mod n и расшифровка m = c^d mod n.
    rsa2(r) { let K, m, m2; do { K = rsaKeys(r); const {n, e} = K, fit = shuffle(r, Array.from({length: n - 2}, (_, i) => i + 2)).filter(x => gcd(x, n) === 1 && x ** e > n && mpow(x, e, n) !== x && mpow(mpow(x, e, n), e, n) !== x); [m, m2] = fit; } while (m2 == null);
      const {p, q, n, f, e, d} = K, c = mpow(m, e, n), c2 = mpow(m2, e, n), calc = {type: 'calc'};
      return [Num(`Твои простые числа: p = ${p}, q = ${q}; открытая экспонента e = ${e}. Найди n = p · q.`, n, `n = ${p} · ${q}.`, {help: calc, data: {p, q, e}}),
        Num('Найди φ(n) = (p − 1) · (q − 1).', f, `φ(n) = (${p} − 1) · (${q} − 1).`, {help: calc}),
        rsaD(e, f, {data: {e, f}, why: `Открытый ключ (${e}, ${n}) можно публиковать, закрытый d = ${d} — только у тебя.`}),
        Num(`Зашифруй число m = ${m} открытым ключом (e, n) = (${e}, ${n}): c = m^e mod n — остаток от деления ${m}^${e} на ${n}.`, c, `Нужен остаток от деления ${m}^${e} на ${n}. В калькуляторе остатков: a = ${m}, b = ${e}, n = ${n}, кнопка «a^b mod n».`, {help: calc, data: {m, e, n}, why: `c = ${c}. Проверка: ${c}^${d} mod ${n} = ${mpow(c, d, n)} — закрытым ключом число читается обратно.`}),
        Num(`Тебе прислали число c = ${c2}, зашифрованное твоим открытым ключом. Расшифруй его закрытым ключом: m = c^d mod n.`, m2, a => `Нужно возвести c = ${c2} в степень d (твой закрытый ключ) и взять остаток от деления на n = ${n}. ${int(a) === mpow(c2, e, n) ? 'Ты возвёл в степень e — так шифруют, а не расшифровывают.' : ''}`.trim(),
          {help: calc, data: {c: c2, d, n}, ok: a => int(a) === mpow(c2, d, n), why: `m = ${m2}. Проверка: ${m2}^${e} mod ${n} = ${mpow(m2, e, n)} — шифровка сходится.`})]; },
  };
  const L = (id, title, brief, old) => ({id, title, brief, old: !!old});
  const LEVELS = [
    L('enc', 'Колесо Цезаря', 'Шифр Цезаря: каждая буква заменяется буквой, стоящей в алфавите на k мест дальше. Число k — ключ шифра (сдвиг).'),
    L('dec', 'Ключ известен', 'Получатель знает ключ и сдвигает буквы назад.'),
    L('crack', 'Взлом перебором', 'Ключ неизвестен, но сдвигов у шифра Цезаря всего 31 — переберём их колесом.'),
    L('freq', 'Частотный анализ', 'В длинном русском тексте чаще всех встречается буква «О» — по ней и находят сдвиг.'),
    L('scy', 'Скитала', 'Шифр перестановки: буквы остаются прежними, меняется только их порядок.'),
    L('perm', 'Перестановка по ключу', 'Столбцы таблицы отправляют в порядке номеров ключа.'),
    L('venc', 'Виженер: шифруем', 'Шифр Виженера: у каждой буквы свой сдвиг — номер буквы ключа (А = 0, Б = 1, …, Я = 31).'),
    L('vdec', 'Виженер: читаем', 'Расшифровка Виженера: из каждой буквы вычитаем номер буквы ключа.'),
    L('vkey', 'Известное начало', 'Атака по известному тексту: зная начало письма, можно восстановить ключ.'),
    L('keys', 'Сколько ключей?', 'Надёжность шифра — в числе ключей: чем их больше, тем дольше перебор.'),
    L('rsa1', 'RSA: ключи', 'Шифрование с открытым ключом: открытый ключ (e, n) знают все, закрытый d — только хозяин.', true),
    L('rsa2', 'RSA: письмо', 'Полный цикл RSA: ключи, шифрование числа и его расшифровка.', true),
  ];
  const taskOf = (lv, seed) => G[lv.id](rng(seed * 409 + LEVELS.indexOf(lv) * 31));
  // Звёзды: без ошибок — 3, одна ошибка — 2, больше — 1 (ошибки считает интерфейс и передаёт в mistakes).
  function check(lv, ans) {
    if (!ans || !Number.isInteger(ans.seed) || !Array.isArray(ans.answers)) return {ok: false, msg: 'Нет ответа.'};
    const steps = taskOf(lv, ans.seed); if (ans.answers.length !== steps.length) return {ok: false, msg: 'Пройди все шаги задания.'};
    const bad = steps.findIndex((st, i) => !st.ok(ans.answers[i])); if (bad >= 0) return {ok: false, step: bad, msg: `Шаг ${bad + 1}: ${steps[bad].tip(ans.answers[bad])}`};
    const m = Math.max(0, Math.floor(Number(ans.mistakes) || 0)); return {ok: true, stars: m === 0 ? 3 : m === 1 ? 2 : 1, msg: m ? `Шифр поддался. Ошибок по ходу: ${m}.` : 'Шифр поддался без единой ошибки.'};
  }
  /* ---------- помощники на экране ---------- */
  // Колесо Цезаря: внешнее кольцо — буквы открытого текста, внутреннее — шифра; поворот на s ставит под каждой буквой ту, что на s дальше.
  function wheel(api, onTurn) {
    const {el, button} = api, box = el('div', 'ci-wheelbox'), disk = el('div', 'ci-wheel'), out = el('div', 'ci-ring out'), inn = el('div', 'ci-ring in'), val = el('b', 'og-dial'), name = el('p', 'lab-note'), strip = el('div', 'ci-strip'), side = el('div', 'ci-side'); let pos = 0;
    [...A].forEach((ch, i) => { for (const ring of [out, inn]) { const s = el('span', '', ch); s.style.setProperty('--a', i * 360 / N + 'deg'); ring.append(s); } });
    const cells = [...A].map((ch, i) => { const c = el('span'), b = el('i'); c.append(el('small', '', String(i)), el('b', '', ch), b); strip.append(c); return b; });
    const draw = () => { const s = md(pos, N); inn.style.transform = `rotate(${-pos * 360 / N}deg)`; val.textContent = String(s); name.textContent = `Сдвиг ${s}: А → ${A[s]}. Это строка «${A[s]}» таблицы Виженера.`; cells.forEach((b, i) => { b.textContent = A[(i + s) % N]; }); if (onTurn) onTurn(s); };
    const turn = d => { pos += d; draw(); }, row = el('div', 'og-dialrow'); row.append(button('−5', 'lab-small', () => turn(-5)), button('−1', 'lab-small', () => turn(-1)), val, button('+1', 'lab-small', () => turn(1)), button('+5', 'lab-small', () => turn(5))); row.dataset.dial = 'shift';
    disk.append(out, inn, el('i', 'ci-mark')); side.append(row, name, strip, el('p', 'lab-note', 'Верхний ряд — буквы текста и их номера (А = 0, …, Я = 31), нижний — буквы шифра.')); box.append(disk, side); draw();
    return {node: box, side, get: () => md(pos, N), set: s => { pos += md(s - pos, N); draw(); }};
  }
  // Частоты букв: столбик на каждую букву; если задан onPick — по столбику можно нажать.
  function bars(api, text, onPick) {
    const {el, button} = api, cnt = counts(text), max = Math.max(...Object.values(cnt)), box = el('div', 'ci-bars');
    for (const ch of A) { const n = cnt[ch] || 0, b = onPick ? button('', 'ci-bar', () => { box.querySelectorAll('.on').forEach(x => x.classList.remove('on')); b.classList.add('on'); onPick(ch); }) : el('div', 'ci-bar'), bar = el('i');
      bar.style.setProperty('--h', Math.round(n / max * 100)); b.dataset.letter = ch; if (onPick) b.setAttribute('aria-label', `${ch}: ${n}`); b.append(el('small', '', n ? String(n) : ''), bar, el('b', '', ch)); box.append(b); }
    return box;
  }
  // Таблица: cells — символы по строкам, head — подписи столбцов.
  const grid = (el, cells, c, head) => { const g = el('div', 'ci-grid'); g.style.setProperty('--cols', c); if (head) for (const h of head) g.append(el('b', 'hd', String(h))); for (const ch of cells) g.append(el('b', ch === '_' ? 'sp' : '', ch)); const w = el('div', 'ci-scroll'); w.append(g); return w; };
  // Скитала: выбираем число столбцов, шифровка раскладывается по столбцам, строки видны сразу.
  function colsBox(api, t) {
    const {el, button} = api, box = el('div', 'ci-colsbox'), val = el('b', 'og-dial'), unit = el('span', 'lab-note'), note = el('p', 'lab-note'), view = el('div'); let c = 2;
    const draw = () => { val.textContent = String(c); unit.textContent = pl(c, 'столбец', 'столбца', 'столбцов'); const d = scyDec(t, c); if (d == null) { view.replaceChildren(); note.textContent = `${t.length} символов не делится на ${c} — ровной таблицы не получится.`; return; }
      note.textContent = `Таблица ${t.length / c} × ${c}: шифровка записана по столбцам сверху вниз — читай строки.`; view.replaceChildren(grid(el, [...d], c)); };
    const row = el('div', 'og-dialrow'); row.append(button('−', 'lab-small', () => { if (c > 2) c--; draw(); }), val, button('+', 'lab-small', () => { if (c < Math.min(12, t.length - 1)) c++; draw(); }), unit); row.dataset.dial = 'cols';
    box.append(row, note, view); draw(); return {node: box, get: () => c};
  }
  // Перестановка: под каждым номером ключа выбираем, какой блок туда поставить, и видим строки таблицы.
  function permBox(api, blocks, key) {
    const {el} = api, box = el('div', 'ci-perm'), c = key.length, r = blocks[0].length, put = Array(c).fill(-1), sel = el('div', 'ci-sel'), view = el('div');
    const draw = () => { const cells = []; for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) cells.push(put[j] < 0 ? '·' : blocks[put[j]][i]); view.replaceChildren(grid(el, cells, c, key)); };
    key.forEach((k, j) => { const s = el('select'); s.setAttribute('aria-label', `Столбец ${j + 1} (номер ${k})`); for (let i = -1; i < blocks.length; i++) { const o = el('option', '', i < 0 ? '?' : `блок ${i + 1}`); o.value = i < 0 ? '' : String(i); s.append(o); } s.addEventListener('change', () => { put[j] = s.value === '' ? -1 : Number(s.value); draw(); }); const lab = el('label'); lab.append(el('small', '', `№ ${k}`), s); sel.append(lab); });
    box.append(el('p', 'lab-note', 'Блоки шифровки: ' + blocks.map((b, i) => `${i + 1}) ${b}`).join('   ') + '. Поставь блоки под номера ключа — строки таблицы прочитаются.'), sel, view); draw(); return box;
  }
  // Виженер: под буквами текста — буквы ключа и их сдвиги; кнопки ставят колесо на строку буквы ключа; вся таблица — под спойлером.
  function vigBox(api, h, setWheel) {
    const {el, button} = api, box = el('div', 'ci-vig'), tab = el('table', 'ci-align'), ls = letters(h.text), row = (label, cells, cls) => { const tr = el('tr', cls || ''); tr.append(el('th', '', label)); for (const x of cells) tr.append(el('td', '', x)); tab.append(tr); };
    row(h.label || 'текст', [...ls]); if (h.key) { row('ключ', [...ls].map((_, i) => h.key[i % h.key.length]), 'key'); row('сдвиг', [...ls].map((_, i) => String(ix(h.key[i % h.key.length]))), 'num'); }
    if (h.known) { row('известно', [...ls].map((_, i) => h.known[i] || ''), 'key'); row('ключ', [...ls].map((_, i) => i < h.known.length ? '?' : ''), 'num'); }
    const w = el('div', 'ci-scroll'); w.append(tab); box.append(w, el('p', 'lab-note', 'Пробелы пропущены: ключ идёт только по буквам.'));
    if (h.key && setWheel) { const bar = el('div', 'og-dialrow'); bar.append(el('span', 'lab-note', 'Поставить колесо на строку буквы ключа:')); for (const ch of new Set(h.key)) bar.append(button(ch, 'lab-small', () => setWheel(ix(ch)))); box.append(bar); }
    const det = el('details', 'ci-table'); det.append(el('summary', '', 'Вся таблица Виженера (32 × 32): строка — буква ключа, столбец — буква текста'));
    det.addEventListener('toggle', () => { if (!det.open || det.querySelector('table')) return; const t = el('table'), hd = el('tr'); hd.append(el('th', '', '')); for (const ch of A) hd.append(el('th', '', ch)); t.append(hd);
      for (let k = 0; k < N; k++) { const tr = el('tr'); tr.append(el('th', '', A[k])); for (let i = 0; i < N; i++) tr.append(el('td', '', A[(i + k) % N])); t.append(tr); } const s = el('div', 'ci-scroll'); s.append(t); det.append(s); });
    box.append(det); return box;
  }
  // Калькулятор остатков: большие степени без переполнения (a · b mod n и a^b mod n).
  function calcBox(api) {
    const {el, button} = api, box = el('div', 'ci-calc'), out = el('b', 'ci-out'), f = {};
    box.append(el('strong', '', 'Калькулятор остатков'));
    for (const k of ['a', 'b', 'n']) { const i = el('input'); i.inputMode = 'numeric'; i.autocomplete = 'off'; i.setAttribute('aria-label', k); i.dataset.calc = k; f[k] = i; const l = el('label'); l.append(el('span', '', k + ' ='), i); box.append(l); }
    const run = op => { const a = int(f.a.value), b = int(f.b.value), n = int(f.n.value); if (![a, b, n].every(Number.isInteger) || a < 0 || b < 0 || n < 2 || n > 1e6) { out.textContent = 'Нужны целые a ≥ 0, b ≥ 0 и n от 2 до 1 000 000.'; return; }
      out.textContent = op === '*' ? `${a} · ${b} mod ${n} = ${a % n * (b % n) % n}` : `${a}^${b} mod ${n} = ${mpow(a, b, n)}`; };
    box.append(button('a · b mod n', 'lab-small', () => run('*')), button('a^b mod n', 'lab-small', () => run('^')), out); return box;
  }
  function mount(host, lv, api) {
    const {el, button} = api, head = el('div', 'lab-task'), dots = el('div', 'og-dots'), box = el('div', 'lab-panel ci-box'); let seed = Math.floor(Math.random() * 1e6), steps = taskOf(lv, seed), at = 0, mistakes = 0, answers = [], had = [], forced = null;
    head.append(el('h2', '', lv.title), el('p', '', lv.brief), el('p', 'lab-note', (['keys', 'rsa1', 'rsa2'].includes(lv.id) ? 'Ответ — целое число; пробелы между разрядами можно ставить.' : 'Алфавит — 32 буквы без Ё (Ё пиши как Е); регистр и пробелы в ответе не важны.') + ' Без ошибок — три звезды, с одной ошибкой — две.')); host.append(head, dots, box);
    const paint = () => dots.replaceChildren(...steps.map((_, i) => el('i', i < at ? (had[i] ? 'bad' : 'good') : i === at ? 'now' : '')));
    function show() { paint();
      if (at >= steps.length) { const r = check(lv, {seed, answers, mistakes}); if (r.ok) api.finish(r.stars, r.msg); else { box.replaceChildren(el('p', 'lab-msg bad', r.msg), button('Новое задание', 'lab-main', () => { seed++; steps = taskOf(lv, seed); at = 0; mistakes = 0; answers = []; had = []; show(); })); } return; }
      const st = steps[at], msg = el('p', 'lab-msg'), go = button(st.kind === 'wheel' || st.kind === 'cols' ? 'Читается!' : 'Проверить', 'lab-main', () => form ? form.requestSubmit() : submit()); let tries = 0, done = false, get = () => null, form = null, wh = null, sel = null; go.dataset.act = 'run';
      box.replaceChildren(el('p', 'lab-eyebrow', `ШАГ ${at + 1} ИЗ ${steps.length}`), el('p', 'og-text ci-q', st.q)); if (st.show) box.append(el('div', 'lab-code ci-show', st.show));
      for (const h of [].concat(st.help || [])) {
        if (h.type === 'wheel') { const pv = h.cipher ? el('p', 'ci-preview') : null; wh = wheel(api, s => { if (pv) pv.textContent = caesar(h.cipher, -s); }); if (pv) { wh.side.prepend(el('p', 'lab-note', 'При этом сдвиге шифровка читается так:'), pv); pv.textContent = h.cipher; } box.append(wh.node); if (st.kind === 'wheel') get = wh.get; }
        else if (h.type === 'bars') box.append(bars(api, h.text, st.kind === 'bars' ? ch => { sel = ch; } : null));
        else if (h.type === 'cols') { const c = colsBox(api, h.cipher); box.append(c.node); get = c.get; }
        else if (h.type === 'rows') box.append(el('p', 'lab-note', 'Слово в таблице по строкам' + (h.key ? ', над столбцами — номера ключа:' : ':')), grid(el, [...h.text], h.c, h.key || Array.from({length: h.c}, (_, i) => i + 1)));
        else if (h.type === 'perm') box.append(permBox(api, h.blocks, h.key));
        else if (h.type === 'vig') box.append(vigBox(api, h, s => wh && wh.set(s)));
        else if (h.type === 'calc') box.append(calcBox(api));
      }
      if (st.kind === 'bars') get = () => sel;
      if (st.kind === 'pick') { const opts = el('div', 'ci-opts'); for (const o of st.options) { const b = button(String(o), 'ci-opt', () => { sel = o; opts.querySelectorAll('.on').forEach(x => x.classList.remove('on')); b.classList.add('on'); }); b.dataset.opt = String(o); opts.append(b); } box.append(opts); get = () => sel; }
      if (st.kind === 'text' || st.kind === 'num') { form = el('form', 'og-form ci-form'); const inp = el('input'); inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('aria-label', 'Ответ'); inp.dataset.answer = '1'; if (st.kind === 'num') inp.inputMode = 'numeric';
        form.append(el('span', '', 'Ответ:'), inp, go); form.addEventListener('submit', e => { e.preventDefault(); submit(); }); get = () => inp.value; box.append(form); setTimeout(() => inp.focus(), 50); }
      else box.append(go);
      box.append(msg);
      function submit() { if (done) return; const a = get(); if (a == null || String(a).trim() === '') { msg.className = 'lab-msg bad'; msg.textContent = st.kind === 'bars' ? 'Сначала нажми на столбик.' : st.kind === 'pick' ? 'Сначала выбери число.' : 'Впиши ответ.'; return; }
        if (st.ok(a)) { done = true; answers.push(a); msg.className = 'lab-msg good'; msg.textContent = 'Верно! ' + (st.why || ''); go.disabled = true; box.querySelectorAll('[data-answer], .ci-opt, button.ci-bar').forEach(x => { x.disabled = true; });
          const next = button(at + 1 < steps.length ? 'Дальше →' : 'Итог →', 'lab-main', () => { at++; show(); }); next.dataset.act = 'next-step'; msg.after(next); next.focus(); }
        else { mistakes++; tries++; had[at] = true; paint(); msg.className = 'lab-msg bad'; msg.textContent = 'Неверно. ' + st.tip(a) + (tries >= 3 ? ` Правильный ответ: ${st.answer}.` : ''); } }
      if (api.debugHost) window.labStep = st;
    }
    // Проверка в браузере: labSet(ответ) — и любая кнопка «Проверить» сразу сверяет готовое решение.
    host.addEventListener('click', e => { if (forced && e.target.closest('[data-act=run]')) { e.stopPropagation(); e.preventDefault(); const r = check(lv, forced); if (r.ok) api.finish(r.stars, r.msg); } }, true);
    show(); if (api.debugHost) window.labSet = a => { forced = a; };
  }
  LAB.register({id: 'cipher', bg: 'bg_cipher', hero: 'host_spy', title: 'Шифровальня', genre: 'защита информации', art: '🔐', color: '#6c8cff', unit: 'Задание', minutes: 45,
    about: 'Зашифруй и взломай шифр Цезаря на колесе, найди ключ частотным анализом, прочитай скиталу и перестановку столбцов, освой шифр Виженера и посчитай, сколько ключей нужно перебрать. В 10–11 классах — учебный RSA с открытым ключом.',
    levels: grade => grade >= 10 ? LEVELS : LEVELS.filter(l => !l.old), mount, check, solve: lv => ({seed: 1, answers: taskOf(lv, 1).map(st => st.answer)}),
    LEVELS, taskOf, caesar, vig, scyEnc, scyDec, permEnc, permDec, pad, gcd, mpow, inv, counts, norm, int, readable, ALPHABET: A, WORDS, PHRASES, KEYS, KNOWN});
})();
