// «ОГЭ-арена»: двенадцать заданий ОГЭ по информатике (письменная часть 1–10 и компьютерные 11–12) в виде арены.
// Каждый уровень — одно задание: три варианта, сгенерированных заново при каждом заходе. Сколько верных ответов — столько звёзд.
// После ошибки сразу показывается разбор. Варианты составлены по образцу демоверсии ФИПИ, тексты задач — свои.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const tools = r => { const ri = (a, b) => a + Math.floor(r() * (b - a + 1)), pick = a => a[Math.floor(r() * a.length)], shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }; return {ri, pick, shuffle}; };
  const RU = 'АБВГДЕЖЗИК';
  const normText = s => String(s).trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, '');
  /* ---------- генераторы заданий: {text, table?, graph?, answer, explain} ---------- */
  const T = {
    1(r) { const {ri, pick, shuffle} = tools(r);
      const all = ['кот', 'лось', 'тигр', 'зебра', 'олень', 'собака', 'шимпанзе', 'крокодил', 'черепаха', 'бегемот', 'носорог', 'жираф', 'барсук', 'енот', 'хомяк', 'ёж', 'волк', 'лиса', 'медведь', 'кенгуру', 'як', 'горилла', 'антилопа'];
      for (;;) { const w = shuffle(all).slice(0, 7), uniq = w.filter(x => w.filter(y => y.length === x.length).length === 1); if (!uniq.length) continue; const gone = pick(uniq), bits = pick([8, 16]), d = (gone.length + 2) * bits / 8;
        return {text: `В кодировке ${bits === 16 ? 'UTF-16' : 'КОИ-8'} каждый символ кодируется ${bits} битами. Ученик написал текст (в нём нет лишних пробелов):\n«${w.join(', ')} — животные зоопарка».\nЗатем он вычеркнул из списка название одного животного, а также ставшие лишними запятую и пробел — два пробела не должны идти подряд. Размер нового предложения оказался на ${d} байт меньше исходного. Напишите в ответе вычеркнутое название животного.`,
          answer: gone, kind: 'text', data: {words: w, bits, d}, explain: `Один символ — ${bits / 8} байт${bits === 16 ? 'а' : ''}. ${d} байт — это ${d / (bits / 8)} символов: слово, запятая и пробел. Значит, в слове ${gone.length} букв — это «${gone}».`}; } },
    2(r) { const {ri, pick, shuffle} = tools(r);
      const sets = [['00', '01', '10', '110', '111'], ['0', '10', '110', '1110', '1111'], ['01', '10', '11', '000', '001'], ['1', '01', '001', '0000', '0001'], ['11', '10', '011', '010', '00']];
      const letters = shuffle(RU.split('')).slice(0, 5).sort(), codes = shuffle(pick(sets)), word = Array.from({length: ri(4, 6)}, () => pick(letters)).join('');
      const table = [letters, codes]; const bits = word.split('').map(c => codes[letters.indexOf(c)]).join('');
      return {text: `Мальчики играли в шпионов и закодировали сообщение придуманным шифром. Кодовая таблица приведена ниже. Расшифруйте сообщение\n${bits}\nи запишите в ответе расшифрованное сообщение (буквы подряд, без пробелов).`, table, answer: word, kind: 'word', data: {letters, codes, bits},
        explain: `Ни один код не является началом другого, поэтому читаем слева направо: ${word.split('').map(c => codes[letters.indexOf(c)] + '→' + c).join(', ')}.`}; },
    3(r) { const {ri, pick} = tools(r);
      for (;;) { const a = ri(10, 150), b = a + ri(6, 60), c = ri(1, 8);
        const forms = [
          [`НЕ (X < ${a}) И НЕ (X чётное)`, x => !(x < a) && x % 2 !== 0, 'наименьшее'],
          [`(X > ${a}) И НЕ (X > ${b})`, x => x > a && !(x > b), 'наибольшее'],
          [`НЕ (X <= ${a}) И (X < ${b})`, x => !(x <= a) && x < b, 'наименьшее'],
          [`НЕ (X > ${b}) И (X нечётное)`, x => !(x > b) && x % 2 !== 0, 'наибольшее'],
          [`НЕ ((X < ${a}) ИЛИ (X > ${b}))`, x => !(x < a || x > b), pick(['наименьшее', 'наибольшее'])],
          [`(X ≥ ${a}) И НЕ (X делится на 3)`, x => x >= a && x % 3 !== 0, 'наименьшее'],
          [`НЕ (X ≥ ${b}) И (X > ${a})`, x => !(x >= b) && x > a, 'наибольшее'],
        ];
        const two = [[`(первая цифра чётная) И НЕ (число делится на 3)`, x => Math.floor(x / 10) % 2 === 0 && x % 3 !== 0], [`НЕ (последняя цифра больше ${c}) И (число нечётное)`, x => !(x % 10 > c) && x % 2 === 1], [`(число больше ${30 + c * 5}) И НЕ (первая цифра нечётная)`, x => x > 30 + c * 5 && Math.floor(x / 10) % 2 === 0]];
        let text, ok, ask, lo, hi, what = 'целое число X';
        if (r() < 0.3) { [text, ok] = pick(two); ask = pick(['наименьшее', 'наибольшее']); lo = 10; hi = 99; what = 'двузначное число'; } else { [text, ok, ask] = pick(forms); lo = -100; hi = 2000; }
        const xs = []; for (let x = lo; x <= hi; x++) if (ok(x)) xs.push(x); if (!xs.length) continue;
        const ans = ask === 'наименьшее' ? xs[0] : xs[xs.length - 1]; if (what !== 'двузначное число' && (ans === lo || ans === hi)) continue;
        return {text: `Напишите ${ask} ${what}, для которого истинно высказывание:\n${text}`, answer: ans, kind: 'num', data: {expr: text, ok, lo, hi, ask, what},
          explain: `Высказывание истинно для чисел ${xs.slice(0, 3).join(', ')}${xs.length > 6 ? ' … ' + xs.slice(-3).join(', ') : xs.length > 3 ? ', ' + xs.slice(3).join(', ') : ''}. ${ask[0].toUpperCase() + ask.slice(1)} из них — ${ans}.`}; } },
    4(r) { const {ri, shuffle} = tools(r); const n = 6, L = RU.slice(0, n).split('');
      for (;;) { const w = Array.from({length: n}, () => Array(n).fill(0)), set = (i, j, v) => { w[i][j] = w[j][i] = v; };
        const order = [0, ...shuffle([1, 2, 3, 4]), 5]; for (let k = 0; k < n - 1; k++) set(order[k], order[k + 1], ri(1, 7));
        for (let k = 0; k < 4; k++) { const i = ri(0, n - 1), j = ri(0, n - 1); if (i !== j && !(Math.min(i, j) === 0 && Math.max(i, j) === n - 1)) set(i, j, ri(1, 9)); }
        set(0, n - 1, 0); const d = Array(n).fill(1e9), used = Array(n).fill(false); d[0] = 0;
        for (let it = 0; it < n; it++) { let u = -1; for (let i = 0; i < n; i++) if (!used[i] && (u < 0 || d[i] < d[u])) u = i; used[u] = true; for (let v = 0; v < n; v++) if (w[u][v] && d[u] + w[u][v] < d[v]) d[v] = d[u] + w[u][v]; }
        const table = [['', ...L], ...L.map((a, i) => [a, ...w[i].map((v, j) => i === j ? '' : v ? String(v) : '')])];
        return {text: `Между населёнными пунктами ${L.join(', ')} построены дороги, протяжённость которых (в километрах) приведена в таблице. Определите длину кратчайшего пути между пунктами ${L[0]} и ${L[n - 1]}. Передвигаться можно только по дорогам, указанным в таблице.`, table, answer: d[n - 1], kind: 'num', data: {L, w},
          explain: `Перебираем пути из ${L[0]}, каждый раз продлевая самый короткий из найденных (как в алгоритме Дейкстры): до ${L.map((x, i) => `${x} — ${d[i]}`).slice(1).join(', ')}. Ответ ${d[n - 1]}.`}; } },
    5(r) { const {ri, pick} = tools(r);
      for (;;) { const b = ri(2, 9), x = ri(1, 9), k = ri(2, 3), prog = Array.from({length: 5}, () => pick('12')).join(''); if (!prog.includes('1') || !prog.includes('2')) continue;
        let y = x; for (const c of prog) y = c === '1' ? y + b : y * k; let mul = 1; for (const c of prog) if (c === '2') mul *= k;
        return {text: `У исполнителя Альфа две команды, которым присвоены номера:\n1. прибавь b\n2. умножь на ${k}\n(b — неизвестное натуральное число; b ≥ 2). Выполняя первую из них, Альфа увеличивает число на экране на b, а выполняя вторую, умножает это число на ${k}. Программа ${prog} переводит число ${x} в число ${y}. Определите значение b.`, answer: b, kind: 'num', data: {x, y, k, prog},
          explain: `Выполним программу с неизвестным b: ${x} → … → ${y}. Получается уравнение ${x * mul} + (сумма слагаемых с b) = ${y}; проверка: при b = ${b} программа даёт ровно ${y}.`}; } },
    6(r) { const {ri, pick} = tools(r); const A = ri(3, 10), B = ri(3, 10), op = pick(['or', 'and']), want = pick(['YES', 'NO']), ls = pick(['>', '<']);
      const pairs = Array.from({length: 9}, () => [ri(-4, 14), ri(-4, 14)]), test = ([s, t]) => { const p = ls === '>' ? s > A : s < A, q = t > B; return op === 'or' ? p || q : p && q; };
      const n = pairs.filter(p => test(p) === (want === 'YES')).length;
      return {text: `Ниже приведена программа на языке Python:\n\ns = int(input())\nt = int(input())\nif s ${ls} ${A} ${op} t > ${B}:\n    print("YES")\nelse:\n    print("NO")\n\nБыло проведено 9 запусков программы, при которых в качестве значений s и t вводились пары чисел:\n${pairs.map(p => `(${p[0]}, ${p[1]})`).join('; ')}.\nСколько было запусков, при которых программа напечатала «${want}»?`, answer: n, kind: 'num', code: true, data: {pairs, yes: pairs.map(test), want, A, B, op, ls},
        explain: `Проверяем каждую пару: «YES» печатается, когда ${op === 'or' ? 'выполнено хотя бы одно' : 'выполнены оба'} условия. Подходящих пар для «${want}»: ${pairs.filter(p => test(p) === (want === 'YES')).map(p => `(${p[0]}, ${p[1]})`).join(', ') || 'нет'} — всего ${n}.`}; },
    7(r) { const {pick, shuffle} = tools(r); const proto = pick(['http', 'https', 'ftp']), [host, zone] = pick([['school', '.ru'], ['mail', '.org'], ['info', '.net'], ['data', '.com'], ['kodograd', '.ru'], ['lib', '.info']]), [file, ext] = pick([['test', '.doc'], ['rus', '.txt'], ['math', '.xls'], ['list', '.pdf'], ['photo', '.png'], ['plan', '.odt']]);
      const parts = [proto, '://', host, zone, '/', file, ext], letters = 'АБВГДЕЖ'.split(''), order = shuffle(parts.map((_, i) => i)), byLetter = order.map(i => parts[i]);
      const answer = parts.map(p => letters[byLetter.indexOf(p)]).join('');
      return {text: `Доступ к файлу ${file}${ext}, находящемуся на сервере ${host}${zone}, осуществляется по протоколу ${proto}. Фрагменты адреса файла закодированы буквами от А до Ж. Запишите последовательность этих букв, кодирующую адрес указанного файла в сети Интернет.\n${byLetter.map((p, i) => `${letters[i]}) ${p}`).join('\n')}`, answer, kind: 'word', data: {byLetter, letters},
        explain: `Адрес: протокол, «://», имя сервера, «/», имя файла: ${parts.join('')} → ${answer}.`}; },
    8(r) { const {ri, pick} = tools(r); const [a, b] = pick([['Пирожное', 'Выпечка'], ['Крейсер', 'Линкор'], ['Кот', 'Пёс'], ['Python', 'Pascal'], ['Солнце', 'Луна'], ['Футбол', 'Хоккей']]);
      const A = ri(150, 900), B = ri(150, 900), I = ri(20, Math.min(A, B) - 20), U = A + B - I;
      // Четыре величины связаны формулой |A или B| = |A| + |B| − |A и B|: три даны, четвёртую нужно найти.
      const rows = [[`${a} | ${b}`, U], [`${a} & ${b}`, I], [a, A], [b, B]], ask = rows[ri(0, 3)], shown = rows.filter(x => x !== ask);
      return {text: `В языке запросов поискового сервера для обозначения логической операции «ИЛИ» используется символ «|», а для «И» — символ «&». В таблице приведены запросы и количество найденных по ним страниц некоторого сегмента сети Интернет. Какое количество страниц (в тысячах) будет найдено по запросу «${ask[0]}»? Считается, что все запросы выполнялись практически одновременно, так что набор страниц не изменялся.`, table: [['Запрос', 'Найдено страниц (в тысячах)'], ...shown.map(x => [x[0], String(x[1])])], answer: ask[1], kind: 'num', data: {a, b, vals: {U, I, A, B}, ask: ask[0]},
        explain: `Формула включений–исключений: |${a} | ${b}| = |${a}| + |${b}| − |${a} & ${b}|, то есть ${U} = ${A} + ${B} − ${I}. Отсюда «${ask[0]}» = ${ask[1]}.`}; },
    9(r) { const {ri} = tools(r); const names = 'АБВГДЕЖК'.split(''), n = names.length;
      for (;;) { const edges = []; for (let i = 0; i < n - 1; i++) { edges.push([i, i + 1 + (r() < 0.5 ? 0 : Math.min(1, n - 2 - i))]); for (let j = i + 2; j < n; j++) if (r() < 0.22 && j - i <= 3) edges.push([i, j]); }
        const uniq = [...new Set(edges.map(e => e.join('-')))].map(s => s.split('-').map(Number)); const inn = Array(n).fill(0), out = Array(n).fill(0); for (const [a, b] of uniq) { out[a]++; inn[b]++; }
        if (inn.slice(1).some(x => !x) || out.slice(0, -1).some(x => !x)) continue;
        const ways = Array(n).fill(0); ways[0] = 1; for (let v = 1; v < n; v++) ways[v] = uniq.filter(e => e[1] === v).reduce((s, e) => s + ways[e[0]], 0);
        if (ways[n - 1] < 6 || ways[n - 1] > 40) continue;
        return {text: `На рисунке — схема дорог, связывающих города ${names.join(', ')}. По каждой дороге можно двигаться только в одном направлении, указанном стрелкой. Сколько существует различных путей из города А в город К?`, graph: {names, edges: uniq}, answer: ways[n - 1], kind: 'num', data: {ways},
          explain: `Считаем пути до каждого города: число путей до города — сумма путей до всех городов, из которых в него ведёт стрелка. ${names.map((x, i) => `${x} — ${ways[i]}`).join(', ')}.`}; } },
    10(r) { const {ri, shuffle} = tools(r); const vals = new Set(); while (vals.size < 3) vals.add(ri(40, 255)); const v = [...vals], bases = shuffle([2, 8, 16]);
      const sub = {2: '₂', 8: '₈', 16: '₁₆'}, shown = v.map((x, i) => x.toString(bases[i]).toUpperCase() + sub[bases[i]]), mx = Math.max(...v);
      return {text: `Среди приведённых ниже трёх чисел, записанных в различных системах счисления, найдите максимальное и запишите его в ответе в десятичной системе счисления. В ответе запишите только число, основание системы счисления указывать не нужно.\n${shown.join(',   ')}`, answer: mx, kind: 'num', data: {shown, v},
        explain: `Переводим в десятичную систему: ${shown.map((s, i) => `${s} = ${v[i]}`).join('; ')}. Наибольшее — ${mx}.`}; },
    11(r) { const {pick, shuffle} = tools(r);
      const S = ['Код доступа хранится в сейфе.', 'Этот код написан на Python.', 'Коды программы проверяет робот.', 'Без кода дверь не откроется.', 'Шифр и код — разные вещи.', 'Программист исправил код ещё раз.', 'Кодировка текста важна для поиска.', 'Код ошибки появился на экране.', 'Мы обсуждали код целый урок.', 'В коде нашли ошибку, и код переписали.', 'Кодекс чести роботов прост.', 'Штрихкод на коробке стёрся.'];
      const text = shuffle(S).slice(0, 7).join(' '), words = text.match(/[А-Яа-яЁё]+/g), mode = pick([0, 1]);
      const n = mode ? words.filter(w => w.toLowerCase().startsWith('код')).length : words.filter(w => w === 'код').length;
      return {text: `Ученик открыл текстовый документ и воспользовался поиском. Текст документа:\n«${text}»\n${mode ? 'Сколько в тексте слов, которые начинаются с сочетания «код» (с прописной или строчной буквы)? Слово «штрихкод» не начинается с «код».' : 'Сколько раз в тексте встречается слово «код» — именно в такой форме, со строчной буквы и как отдельное слово (без учёта слов «коды», «кода», «Код» и т. п.)?'}`, answer: n, kind: 'num', data: {text, mode, hit: w => mode ? w.toLowerCase().startsWith('код') : w === 'код'},
        explain: mode ? `Подходят слова: ${words.filter(w => w.toLowerCase().startsWith('код')).join(', ')} — ${n}. В редакторе это поиск «с начала слова» без учёта регистра.` : `Включаем в поиске «только слово целиком» и «учитывать регистр»: находится ${n}. Формы «коды», «кода», «Код» не считаются.`}; },
    12(r) { const {ri, pick, shuffle} = tools(r); const base = ['отчет', 'список', 'доклад', 'почта', 'ноты', 'кот', 'заметки', 'план', 'робот', 'сон', 'море', 'код'], exts = ['txt', 'doc', 'jpg', 'png', 'pdf'];
      const folders = ['Школа', 'Школа/Информатика', 'Школа/Информатика/Проекты', 'Фото', 'Игры'], files = {};
      for (const f of folders) files[f] = [...new Set(Array.from({length: ri(2, 4)}, () => pick(base) + '.' + pick(exts)))];
      const masks = ['*.txt', '*.doc', '?о*.*', '*о?.txt', 'к*.*', '*т.*'], mask = pick(masks), where = pick(['Школа', '']), re = new RegExp('^' + mask.replace(/\./g, '\\.').replace(/\?/g, '.').replace(/\*/g, '.*') + '$');
      const scope = folders.filter(f => !where || f === where || f.startsWith(where + '/')), n = scope.reduce((s, f) => s + files[f].filter(x => re.test(x)).length, 0);
      if (!n) return T[12](r);
      return {text: `На рисунке — содержимое ${where ? `каталога «${where}» и других каталогов` : 'всех каталогов'} диска. Символ «?» в маске означает ровно один любой символ, «*» — любое количество символов (в том числе ни одного). Сколько файлов, удовлетворяющих маске ${mask}, находится ${where ? `в каталоге «${where}» и во всех его подкаталогах` : 'во всех каталогах'}?`,
        tree: folders.map(f => [f, files[f]]), answer: n, kind: 'num', data: {mask, where, scope, re},
        explain: `Подходят: ${scope.flatMap(f => files[f].filter(x => re.test(x)).map(x => f + '/' + x)).join(', ')} — всего ${n}.`}; },
  };
  /* ---------- задание 15: Робот (язык Кумира), одна программа — три поля с разной длиной стен ---------- */
  const DIRS = {вверх: [0, -1, 'сверху'], вниз: [0, 1, 'снизу'], влево: [-1, 0, 'слева'], вправо: [1, 0, 'справа']}, SIDE = {сверху: 'вверх', снизу: 'вниз', слева: 'влево', справа: 'вправо'};
  function field(w, h) { const walls = new Set(), f = {w, h, walls, paint: [], start: [0, 0]}; f.wall = (x, y, dir) => { const [dx, dy] = DIRS[dir]; walls.add(`${x},${y},${dir}`); walls.add(`${x + dx},${y + dy},${Object.keys(DIRS).find(k => DIRS[k][0] === -dx && DIRS[k][1] === -dy)}`); }; return f; }
  const blocked = (f, x, y, dir) => { const [dx, dy] = DIRS[dir], nx = x + dx, ny = y + dy; return nx < 0 || ny < 0 || nx >= f.w || ny >= f.h || f.walls.has(`${x},${y},${dir}`); };
  const ROBOT = {
    wall(r) { const {ri} = tools(r), L = ri(3, 11), x0 = ri(1, 3), y = ri(2, 4), f = field(x0 + L + ri(2, 4), y + ri(3, 4)); for (let x = x0; x < x0 + L; x++) { f.wall(x, y, 'вверх'); f.paint.push([x, y]); } f.start = [x0, y]; return f; },
    corner(r) { const {ri} = tools(r), L = ri(3, 9), M = ri(2, 6), x0 = ri(1, 2), y0 = ri(1, 3), x1 = x0 + L - 1, f = field(x1 + ri(2, 4), y0 + M + ri(2, 3));
      for (let x = x0; x <= x1; x++) { f.wall(x, y0, 'вверх'); f.paint.push([x, y0]); } for (let y = y0; y < y0 + M; y++) { f.wall(x1, y, 'вправо'); if (y > y0) f.paint.push([x1, y]); } f.start = [x0, y0]; return f; },
    corridor(r) { const {ri} = tools(r), L = ri(3, 10), x0 = ri(2, 4), y = ri(2, 4), f = field(x0 + L + ri(2, 4), y + ri(2, 4)); for (let x = x0; x < x0 + L; x++) { f.wall(x, y, 'вверх'); f.wall(x, y, 'вниз'); f.paint.push([x, y]); } f.start = [x0 - 1, y]; return f; },
  };
  const ROBOT_TASK = {
    wall: ['Над Роботом тянется горизонтальная стена неизвестной длины; Робот стоит под её левым концом.', 'Закрасьте все клетки, прилегающие к стене снизу. Робот должен закрасить только эти клетки.', 'нц пока сверху стена\n  закрасить\n  вправо\nкц'],
    corner: ['Над Роботом — горизонтальная стена, от её правого конца вниз уходит вертикальная стена. Длины обеих стен неизвестны; Робот стоит под левым концом горизонтальной стены.', 'Закрасьте все клетки, прилегающие к горизонтальной стене снизу и к вертикальной стене слева.', 'нц пока справа свободно\n  закрасить\n  вправо\nкц\nнц пока справа стена\n  закрасить\n  вниз\nкц'],
    corridor: ['Справа от Робота начинается горизонтальный коридор: стены сверху и снизу. Длина коридора неизвестна.', 'Закрасьте все клетки коридора.', 'вправо\nнц пока сверху стена и снизу стена\n  закрасить\n  вправо\nкц'],
  };
  function parseKumir(src) {
    const toks = String(src).toLowerCase().replace(/ё/g, 'е').replace(/[|;]/g, '\n').match(/[а-я]+|\d+/g) || []; let p = 0;
    const fail = m => { throw new Error(m); };
    const cond = () => { const term = () => { let neg = false; if (toks[p] === 'не') { neg = true; p++; }
        if (toks[p] === 'клетка') { p++; const w = toks[p++]; if (w !== 'закрашена' && w !== 'чистая') fail('после «клетка» пишут «закрашена» или «чистая»'); return {k: 'cell', want: w === 'закрашена', neg}; }
        const side = toks[p++], what = toks[p++]; if (!SIDE[side] || (what !== 'свободно' && what !== 'стена')) fail('условие пишется так: «справа свободно», «сверху стена»…'); return {k: 'side', side, free: what === 'свободно', neg}; };
      let a = term(); while (toks[p] === 'и' || toks[p] === 'или') { const op = toks[p++]; a = {k: op, a, b: term()}; } return a; };
    const block = ends => { const out = []; for (;;) { const w = toks[p]; if (w === undefined) { if (ends.length) fail(`не хватает «${ends[0]}»`); return out; } if (ends.includes(w)) return out; p++;
      if (DIRS[w] || w === 'закрасить') out.push({k: 'cmd', w});
      else if (w === 'нц') { if (toks[p] === 'пока') { p++; const c = cond(); const body = block(['кц']); p++; out.push({k: 'while', c, body}); } else if (/^\d+$/.test(toks[p] || '')) { const n = +toks[p++]; if (toks[p++] !== 'раз') fail('цикл со счётчиком: «нц 5 раз … кц»'); const body = block(['кц']); p++; out.push({k: 'rep', n, body}); } else fail('после «нц» пишут «пока условие» или «N раз»'); }
      else if (w === 'если') { const c = cond(); if (toks[p++] !== 'то') fail('после условия в «если» нужно слово «то»'); const yes = block(['иначе', 'все']); let no = []; if (toks[p] === 'иначе') { p++; no = block(['все']); } p++; out.push({k: 'if', c, yes, no}); }
      else fail(`неизвестная команда «${w}»`); } };
    const prog = block([]); return prog;
  }
  function runKumir(prog, f, trace) {
    let [x, y] = f.start, steps = 0; const painted = new Set();
    const test = c => c.k === 'и' ? test(c.a) && test(c.b) : c.k === 'или' ? test(c.a) || test(c.b) : (c.k === 'cell' ? painted.has(x + ',' + y) === c.want : blocked(f, x, y, SIDE[c.side]) !== c.free) !== c.neg;
    const go = list => { for (const st of list) { if (++steps > 4000) throw new Error('Робот работает слишком долго — похоже, цикл не заканчивается');
      if (st.k === 'cmd') { if (st.w === 'закрасить') painted.add(x + ',' + y); else { if (blocked(f, x, y, st.w)) throw new Error(`Робот разбился: команда «${st.w}» в клетке у стены`); x += DIRS[st.w][0]; y += DIRS[st.w][1]; } trace && trace({x, y, painted: new Set(painted)}); }
      else if (st.k === 'while') { while (test(st.c)) { go(st.body); if (++steps > 4000) throw new Error('цикл «нц пока» не заканчивается'); } }
      else if (st.k === 'rep') { for (let i = 0; i < st.n; i++) go(st.body); }
      else go(test(st.c) ? st.yes : st.no); } };
    go(prog); return {x, y, painted};
  }
  /* ---------- задание 16: программа на Python, три скрытых теста ---------- */
  const PY16 = [
    r => { const {ri} = tools(r), k = ri(3, 9), d = ri(0, 9); return {text: `Напишите программу, которая в последовательности натуральных чисел определяет количество чисел, кратных ${k} и оканчивающихся на ${d}. Программа получает на вход количество чисел в последовательности, а затем сами числа. Количество чисел не превышает 1000, введённые числа не превышают 30 000. Программа должна вывести одно число — количество чисел, кратных ${k} и оканчивающихся на ${d}.`,
      input: () => { const n = ri(4, 10), xs = Array.from({length: n}, () => r() < 0.4 ? k * ri(1, 300) : ri(1, 3000)); return [n, ...xs]; }, solve: a => [a.slice(1).filter(x => x % k === 0 && x % 10 === d).length],
      ref: `n = int(input())\ncount = 0\nfor i in range(n):\n    x = int(input())\n    if x % ${k} == 0 and x % 10 == ${d}:\n        count += 1\nprint(count)`}; },
    r => { const {ri} = tools(r), k = ri(3, 8); return {text: `Напишите программу, которая в последовательности натуральных чисел определяет сумму всех чисел, кратных ${k}. Программа получает на вход натуральные числа, количество введённых чисел неизвестно, последовательность чисел заканчивается числом 0 (0 — признак окончания ввода, не входит в последовательность). Количество чисел не превышает 1000, введённые числа не превышают 30 000. Программа должна вывести одно число — сумму чисел, кратных ${k}.`,
      input: () => { const n = ri(4, 10); return [...Array.from({length: n}, () => r() < 0.5 ? k * ri(1, 400) : ri(1, 3000)), 0]; }, solve: a => [a.slice(0, -1).filter(x => x % k === 0).reduce((s2, x) => s2 + x, 0)],
      ref: `s = 0\nx = int(input())\nwhile x != 0:\n    if x % ${k} == 0:\n        s += x\n    x = int(input())\nprint(s)`}; },
    r => { const {ri} = tools(r), d = ri(1, 9); return {text: `Напишите программу, которая в последовательности натуральных чисел определяет максимальное число, оканчивающееся на ${d}. Программа получает на вход натуральные числа, количество введённых чисел неизвестно, последовательность заканчивается числом 0 (0 — признак окончания ввода, не входит в последовательность). Гарантируется, что во входных данных есть хотя бы одно число, оканчивающееся на ${d}. Программа должна вывести одно число — максимальное число, оканчивающееся на ${d}.`,
      input: () => { const n = ri(4, 10), xs = Array.from({length: n}, () => ri(1, 3000)); xs[ri(0, n - 1)] = ri(1, 299) * 10 + d; return [...xs, 0]; }, solve: a => [Math.max(...a.slice(0, -1).filter(x => x % 10 === d))],
      ref: `m = 0\nx = int(input())\nwhile x != 0:\n    if x % 10 == ${d} and x > m:\n        m = x\n    x = int(input())\nprint(m)`}; },
    r => { const {ri} = tools(r), k = ri(3, 7); return {text: `Напишите программу, которая в последовательности натуральных чисел находит среднее арифметическое чисел, кратных ${k}, или сообщает, что таких чисел нет (выводит «NO»). Программа получает на вход количество чисел, а затем сами числа. Среднее выведите как целую часть (используйте целочисленное деление //).`,
      input: () => { const n = ri(4, 9), xs = Array.from({length: n}, () => r() < 0.5 ? k * ri(1, 300) : ri(1, 3000)); return [n, ...(r() < 0.2 ? xs.map(x => x % k ? x : x + 1) : xs)]; }, solve: a => { const m = a.slice(1).filter(x => x % k === 0); return [m.length ? Math.floor(m.reduce((s2, x) => s2 + x, 0) / m.length) : 'NO']; },
      ref: `n = int(input())\ns = 0\nc = 0\nfor i in range(n):\n    x = int(input())\n    if x % ${k} == 0:\n        s += x\n        c += 1\nif c == 0:\n    print("NO")\nelse:\n    print(s // c)`}; },
  ];
  const PY = () => globalThis.CodeHero || (typeof require === 'function' ? require('../../codehero/core.js') : null);
  function runPython(code, input) {
    const H = PY(); if (!H) throw new Error('интерпретатор Python не загрузился'); let i = 0; const out = [];
    const prog = H.parse(String(code)), it = H.run(prog, {input: {builtin: 'input', call: () => { if (i >= input.length) throw new H.PyError('Программа просит больше чисел, чем дано на входе.'); return String(input[i++]); }}, print: {builtin: 'print', call: args => { out.push(args.map(a => typeof a === 'number' ? String(a) : String(a)).join(' ')); return null; }}}, {ops: 200000});
    for (const _ of it) {} return out.join('\n').trim();
  }
  const progTask = (lv, seed) => { const r = rng(seed * 7 + lv.n * 131); if (lv.n === 15) { const kind = tools(r).pick(Object.keys(ROBOT)); return {kind, fields: [0, 1, 2].map(() => ROBOT[kind](r)), text: ROBOT_TASK[kind], ref: ROBOT_TASK[kind][2]}; }
    const t = tools(r).pick(PY16)(r), tests = [0, 1, 2].map(() => t.input()); return {...t, tests, expect: tests.map(a => t.solve(a).join('\n'))}; };
  function checkProg(lv, ans) {
    if (!ans || !Number.isInteger(ans.seed) || typeof ans.code !== 'string' || !ans.code.trim()) return {ok: false, msg: 'Напиши программу.', results: []};
    const t = progTask(lv, ans.seed), results = [];
    if (lv.n === 15) { let prog; try { prog = parseKumir(ans.code); } catch (e) { return {ok: false, msg: 'Ошибка в программе: ' + e.message + '.', results}; }
      for (const f of t.fields) { try { const r = runKumir(prog, f), want = new Set(f.paint.map(c => c.join(','))); results.push(r.painted.size === want.size && [...want].every(c => r.painted.has(c)) ? {ok: true} : {ok: false, msg: 'закрашены не те клетки'}); } catch (e) { results.push({ok: false, msg: e.message}); } } }
    else for (const [k, inp] of t.tests.entries()) { try { const got = runPython(ans.code, inp); results.push(got === t.expect[k] ? {ok: true, got} : {ok: false, got, msg: `вывод «${got || '(пусто)'}», а нужно «${t.expect[k]}»`}); } catch (e) { results.push({ok: false, msg: (e.line ? `строка ${e.line}: ` : '') + e.message}); } }
    const good = results.filter(x => x.ok).length;
    return good ? {ok: true, stars: good, results, msg: `Пройдено ${lv.n === 15 ? 'полей' : 'тестов'}: ${good} из 3.`} : {ok: false, results, msg: results[0].msg ? 'Не пройдено ни одного: ' + results[0].msg + '.' : 'Не пройдено ни одного.'};
  }
  const TITLES = {1: 'Объём текста', 2: 'Расшифровка сообщения', 3: 'Истинность высказывания', 4: 'Кратчайший путь по таблице', 5: 'Исполнитель с неизвестным', 6: 'Запуски программы', 7: 'Адрес файла в Интернете', 8: 'Запросы к поисковику', 9: 'Количество путей в графе', 10: 'Системы счисления', 11: 'Поиск в тексте', 12: 'Маски файлов', 15: 'Алгоритм для Робота', 16: 'Программа на Python'};
  const LEVELS = [...Object.keys(T).map(Number), 15, 16].map(n => ({n, prog: n >= 15, title: `Задание ${n}. ${TITLES[n]}`, brief: n >= 15 ? `Одна программа проверяется на трёх ${n === 15 ? 'полях' : 'тестах'} — каждый пройденный сбивает щит.` : `Три варианта задания № ${n} ОГЭ. Каждый верный ответ — звезда.`}));
  const problems = (lv, seed) => { const r = rng(seed * 101 + lv.n * 7919); return [0, 1, 2].map(() => T[lv.n](r)); };
  const same = (p, a) => p.kind === 'num' ? String(a).trim().replace(',', '.') !== '' && Number(String(a).trim().replace(',', '.')) === p.answer : p.kind === 'word' ? normText(a).toUpperCase() === String(p.answer).toUpperCase() : normText(a) === normText(p.answer);
  function check(lv, ans) {
    if (lv.prog) return checkProg(lv, ans);
    if (!ans || !Number.isInteger(ans.seed) || !Array.isArray(ans.answers) || ans.answers.length !== 3) return {ok: false, msg: 'Ответь на все три варианта.'};
    const ps = problems(lv, ans.seed), good = ps.filter((p, i) => same(p, ans.answers[i])).length;
    return good ? {ok: true, stars: good, msg: `Верных ответов: ${good} из 3.`} : {ok: false, msg: 'Ни одного верного ответа — разбери решения и попробуй снова.'};
  }
  function graphSvg(g, el) {
    const NS = 'http://www.w3.org/2000/svg', mk = (t, a, x) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); if (x != null) n.textContent = x; return n; };
    const n = g.names.length, P = g.names.map((_, i) => ({x: 50 + i * 600 / (n - 1), y: i === 0 || i === n - 1 ? 130 : i % 2 ? 70 : 190}));
    const svg = mk('svg', {viewBox: '0 0 700 260', class: 'og-graph'}); svg.append(mk('defs', {})); svg.firstChild.append(Object.assign(mk('marker', {id: 'og-arrow', viewBox: '0 0 10 10', refX: 22, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto'}), {}));
    svg.querySelector('marker').append(mk('path', {d: 'M0,0 L10,5 L0,10 z', fill: '#ffd34d'}));
    for (const [a, b] of g.edges) { const sameRow = P[a].y === P[b].y && b - a > 1, bend = sameRow ? (P[a].y < 130 ? -55 : 55) : 0, mx = (P[a].x + P[b].x) / 2, my = (P[a].y + P[b].y) / 2 + bend; svg.append(mk('path', {d: `M${P[a].x},${P[a].y} Q${mx},${my} ${P[b].x},${P[b].y}`, fill: 'none', stroke: '#8fa6d6', 'stroke-width': 3, 'marker-end': 'url(#og-arrow)'})); }
    g.names.forEach((nm, i) => { svg.append(mk('circle', {cx: P[i].x, cy: P[i].y, r: 18, fill: '#243253', stroke: '#ffd34d', 'stroke-width': 3}), mk('text', {x: P[i].x, y: P[i].y + 6, 'text-anchor': 'middle', fill: '#fff', 'font-weight': 800, 'font-size': 17}, nm)); });
    return svg;
  }
  /* ---------- мини-игры: каждое задание решается действием, итог — тот же ответ, что в бланке ОГЭ ---------- */
  const NS = 'http://www.w3.org/2000/svg', svgEl = (t, a, x) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); if (x != null) n.textContent = x; return n; };
  const GAME = {15: 'Робот-уборщик', 16: 'Взлом терминала', 1: 'Вычеркни лишнее', 2: 'Дешифровщик', 3: 'Кодовый замок', 4: 'Штурман', 5: 'Отладка робота', 6: 'Сортировка запусков', 7: 'Собери адрес', 8: 'Круги поиска', 9: 'Счётчик дорог', 10: 'Три сундука', 11: 'Охота за словом', 12: 'Фильтр файлов'};
  // Каждая мини-игра получает задачу и функцию submit(ответ, пояснение) и возвращает элемент. Кнопка сдачи ответа помечена data-act=run.
  const W = {
    1(p, {el, button}, submit) { const box = el('div', 'og-w'); let pick = null; const line = el('p', 'og-sentence'); line.append('«');
      p.data.words.forEach((w, i) => { const b = button(w, 'og-word', () => { pick = w; for (const x of line.querySelectorAll('.og-word')) x.classList.toggle('struck', x === b); go.disabled = false; }); line.append(b, i < p.data.words.length - 1 ? ', ' : ''); }); line.append(' — животные зоопарка»');
      const go = button('✂ Вычеркнуть', 'lab-main', () => submit(pick)); go.dataset.act = 'run'; go.disabled = true;
      box.append(el('p', 'lab-note', `Кодировка: ${p.data.bits} бит на символ. После вычёркивания предложение стало на ${p.data.d} байт короче. Щёлкни по слову, которое вычеркнул ученик.`), line, go); return box; },
    2(p, {el, button}, submit) { const box = el('div', 'og-w'), cuts = new Set(), strip = el('div', 'og-bits'), out = el('p', 'og-decoded'), bits = p.data.bits;
      const t = el('table', 'lab-table og-table'); [p.data.letters, p.data.codes].forEach(r => { const tr = el('tr'); r.forEach(c => tr.append(el('td', '', c))); t.append(tr); });
      const parts = () => { const seg = []; let st = 0; for (let k = 1; k <= bits.length; k++) if (k === bits.length || cuts.has(k)) { seg.push(bits.slice(st, k)); st = k; } return seg; };
      const draw = () => { strip.replaceChildren(); [...bits].forEach((c, k) => { if (k && cuts.has(k)) strip.append(el('span', 'og-cut', '|')); const d = button(c, 'og-bit', () => { if (k + 1 < bits.length) { cuts.has(k + 1) ? cuts.delete(k + 1) : cuts.add(k + 1); draw(); } }); strip.append(d); });
        out.replaceChildren(...parts().map(sg => { const k = p.data.codes.indexOf(sg); return el('span', k < 0 ? 'bad' : 'good', k < 0 ? '?' : p.data.letters[k]); })); };
      const go = button('🔓 Расшифровать', 'lab-main', () => { const seg = parts(); if (seg.some(sg => !p.data.codes.includes(sg))) { out.classList.add('shake'); setTimeout(() => out.classList.remove('shake'), 400); return; } submit(seg.map(sg => p.data.letters[p.data.codes.indexOf(sg)]).join('')); }); go.dataset.act = 'run';
      box.append(el('p', 'lab-note', 'Перехвачена шифровка. Щёлкай по цифрам, чтобы разрезать строку на коды букв (разрез ставится после цифры). Под строкой видно, что получилось.'), t, strip, out, go); draw(); return box; },
    3(p, {el, button}, submit) { const box = el('div', 'og-w'), d = p.data; let x = d.what === 'двузначное число' ? 10 : 0, tries = 0; const val = el('b', 'og-dial'), lamp = el('span', 'og-lamp'), left = el('small', 'lab-note');
      const draw = () => { val.textContent = x; lamp.className = 'og-lamp'; lamp.textContent = 'проверь'; left.textContent = `Проверок замка осталось: ${5 - tries}`; };
      const step = k => button((k > 0 ? '+' : '−') + Math.abs(k), 'lab-small', () => { x += k; draw(); });
      const test = button('💡 Проверить X', 'lab-small', () => { if (tries >= 5) return; tries++; const ok = d.ok(x); lamp.className = 'og-lamp ' + (ok ? 'on' : 'off'); lamp.textContent = ok ? 'истинно' : 'ложно'; left.textContent = `Проверок замка осталось: ${5 - tries}`; });
      const go = button('🔑 Открыть замок этим числом', 'lab-main', () => submit(String(x))); go.dataset.act = 'run';
      const row = el('div', 'og-dialrow'); row.append(step(-10), step(-1), val, step(1), step(10));
      box.append(el('p', 'lab-note', `Замок открывается ${d.ask === 'наименьшее' ? 'наименьшим' : 'наибольшим'} ${d.what === 'двузначное число' ? 'двузначным числом' : 'целым X'}, при котором истинно:`), el('p', 'og-expr', d.expr), row, el('div', 'og-dialrow'), go); box.lastChild.previousSibling.append(test, lamp, left); draw(); return box; },
    4(p, {el, button}, submit) { const box = el('div', 'og-w'), {L, w} = p.data, n = L.length, P = L.map((_, i) => ({x: 350 + 260 * Math.cos(Math.PI + i * 2 * Math.PI / n), y: 150 + 120 * Math.sin(Math.PI + i * 2 * Math.PI / n)})); let path = [0];
      const svg = svgEl('svg', {viewBox: '0 0 700 300', class: 'og-graph'}), info = el('p', 'og-route');
      const len = () => path.slice(1).reduce((s, v, k) => s + w[path[k]][v], 0);
      const draw = () => { svg.replaceChildren(); for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (w[i][j]) { const on = path.some((v, k) => k && ((path[k - 1] === i && v === j) || (path[k - 1] === j && v === i))); svg.append(svgEl('line', {x1: P[i].x, y1: P[i].y, x2: P[j].x, y2: P[j].y, stroke: on ? '#ffd34d' : '#4b5f8f', 'stroke-width': on ? 6 : 3}), svgEl('text', {x: (P[i].x + P[j].x) / 2, y: (P[i].y + P[j].y) / 2 - 6, class: 'og-wt'}, w[i][j])); }
        L.forEach((nm, i) => { const g = svgEl('g', {class: 'og-node' + (path.includes(i) ? ' on' : '') + (i === path[path.length - 1] ? ' me' : '')}); g.append(svgEl('circle', {cx: P[i].x, cy: P[i].y, r: 22}), svgEl('text', {x: P[i].x, y: P[i].y + 6, 'text-anchor': 'middle'}, nm)); g.addEventListener('click', () => { const last = path[path.length - 1]; if (w[last][i] && !path.includes(i)) path.push(i); draw(); }); svg.append(g); });
        info.textContent = `Маршрут: ${path.map(i => L[i]).join(' → ')} · длина ${len()} км` + (path[path.length - 1] === n - 1 ? ' · ты в пункте ' + L[n - 1] + '!' : ''); go.disabled = path[path.length - 1] !== n - 1; };
      const go = button('🏁 Это кратчайший путь', 'lab-main', () => submit(String(len()))); go.dataset.act = 'run';
      const t = el('table', 'lab-table og-table'); for (const row of p.table) { const tr = el('tr'); for (const c of row) tr.append(el('td', '', String(c))); t.append(tr); }
      const pair = el('div', 'og-pair'); pair.append(svg, t);
      box.append(el('p', 'lab-note', `Проложи путь из ${L[0]} в ${L[n - 1]}, щёлкая по соседним пунктам. Нужен самый короткий. Справа — та же карта таблицей, как в ОГЭ.`), pair, info, button('↺ Заново', 'lab-small', () => { path = [0]; draw(); }), go); draw(); return box; },
    5(p, {el, button}, submit) { const box = el('div', 'og-w'), d = p.data; let b = 2, runs = 0; const val = el('b', 'og-dial'), tape = el('div', 'og-tape'), left = el('small', 'lab-note');
      const run = () => { if (runs >= 3) return; runs++; let v = d.x; const steps = [v]; for (const c of d.prog) { v = c === '1' ? v + b : v * d.k; steps.push(v); } tape.replaceChildren(...steps.map((s2, k) => el('span', k === steps.length - 1 ? (s2 === d.y ? 'good' : 'bad') : '', (k ? (d.prog[k - 1] === '1' ? `+${b} → ` : `×${d.k} → `) : '') + s2))); left.textContent = `Пробных запусков осталось: ${3 - runs}`; };
      const draw = () => { val.textContent = 'b = ' + b; };
      const row = el('div', 'og-dialrow'); row.append(button('−', 'lab-small', () => { if (b > 2) b--; draw(); }), val, button('+', 'lab-small', () => { if (b < 20) b++; draw(); }), button('▶ Пробный запуск', 'lab-small', run));
      const go = button('✅ Робот исправлен: это b', 'lab-main', () => submit(String(b))); go.dataset.act = 'run';
      box.append(el('p', 'lab-note', `Робот Альфа должен по программе ${d.prog} превратить ${d.x} в ${d.y}, но у него стёрлось число b в команде «прибавь b». Подбери b — посчитай в уме, пробных запусков всего три.`), row, tape, left, go); draw(); left.textContent = 'Пробных запусков осталось: 3'; return box; },
    6(p, {el, button}, submit) { const box = el('div', 'og-w'), d = p.data, mark = d.pairs.map(() => null), grid = el('div', 'og-cards'), cnt = el('p', 'og-route');
      const draw = () => { grid.replaceChildren(...d.pairs.map((pr, k) => { const c = button(`s = ${pr[0]}, t = ${pr[1]}` + (mark[k] ? `  → ${mark[k]}` : ''), 'og-card ' + (mark[k] === 'YES' ? 'yes' : mark[k] === 'NO' ? 'no' : ''), () => { mark[k] = mark[k] === null ? 'YES' : mark[k] === 'YES' ? 'NO' : null; draw(); }); return c; }));
        cnt.textContent = `YES: ${mark.filter(m => m === 'YES').length} · NO: ${mark.filter(m => m === 'NO').length} · не разобрано: ${mark.filter(m => !m).length}`; go.disabled = mark.some(m => !m); };
      const go = button(`📤 Сдать: сколько «${d.want}»`, 'lab-main', () => submit(String(mark.filter(m => m === d.want).length))); go.dataset.act = 'run';
      box.append(el('pre', 'og-code', `if s ${d.ls} ${d.A} ${d.op} t > ${d.B}:\n    print("YES")\nelse:\n    print("NO")`), el('p', 'lab-note', 'Девять запусков пришли на проверку. Щёлкай по карточке: первый щелчок — YES, второй — NO.'), grid, cnt, go); draw(); return box; },
    7(p, {el, button}, submit) { const box = el('div', 'og-w'), d = p.data; let seq = []; const bar = el('div', 'og-url'), tiles = el('div', 'og-tiles');
      const draw = () => { bar.replaceChildren(...(seq.length ? seq.map(k => el('span', '', d.byLetter[k])) : [el('i', '', 'адрес пуст')])); tiles.replaceChildren(...d.byLetter.map((f, k) => { const b = button(`${d.letters[k]}) ${f}`, 'og-tile' + (seq.includes(k) ? ' used' : ''), () => { if (!seq.includes(k)) seq.push(k); draw(); }); b.disabled = seq.includes(k); return b; })); go.disabled = seq.length !== d.byLetter.length; };
      const go = button('🌐 Открыть адрес', 'lab-main', () => submit(seq.map(k => d.letters[k]).join(''))); go.dataset.act = 'run';
      box.append(el('p', 'lab-note', 'Собери адрес файла из плиток по порядку. Ответом станет последовательность букв плиток.'), bar, tiles, button('⌫ Убрать последнюю', 'lab-small', () => { seq.pop(); draw(); }), go); draw(); return box; },
    8(p, {el, button}, submit) { const box = el('div', 'og-w'), d = p.data, v = d.vals, has = q => q !== d.ask, svg = svgEl('svg', {viewBox: '0 0 600 250', class: 'og-graph'});
      svg.append(svgEl('rect', {x: 4, y: 4, width: 592, height: 242, rx: 16, fill: '#141e38', stroke: '#3b4d78'}), svgEl('circle', {cx: 240, cy: 130, r: 95, fill: '#ff8a5c', 'fill-opacity': .18, stroke: '#ff8a5c', 'stroke-width': 4}), svgEl('circle', {cx: 360, cy: 130, r: 95, fill: '#5cc8ff', 'fill-opacity': .18, stroke: '#5cc8ff', 'stroke-width': 4}),
        svgEl('text', {x: 160, y: 30, class: 'og-set', fill: '#ff8a5c'}, `${d.a}: ${has(d.a) ? v.A : '?'}`), svgEl('text', {x: 330, y: 30, class: 'og-set', fill: '#5cc8ff'}, `${d.b}: ${has(d.b) ? v.B : '?'}`), svgEl('text', {x: 300, y: 136, 'text-anchor': 'middle', class: 'og-set', fill: '#ffd34d'}, `& ${has(`${d.a} & ${d.b}`) ? v.I : '?'}`), svgEl('text', {x: 300, y: 240, 'text-anchor': 'middle', class: 'og-set', fill: '#c3cee2'}, `| (всё закрашенное): ${has(`${d.a} | ${d.b}`) ? v.U : '?'}`));
      const form = el('form', 'og-form'), inp = el('input'); inp.setAttribute('aria-label', 'Ответ'); inp.placeholder = '?'; const go = button('🔍 Найти страницы', 'lab-main', () => form.requestSubmit()); go.dataset.act = 'run'; form.append(el('span', '', `«${d.ask}» =`), inp, go); form.addEventListener('submit', e => { e.preventDefault(); if (inp.value.trim()) submit(inp.value); });
      box.append(el('p', 'lab-note', 'Поисковик нарисовал найденное кругами (в тысячах страниц). Найди число вместо знака вопроса.'), svg, form); return box; },
    9(p, {el, button}, submit) { const box = el('div', 'og-w'), g = p.graph, n = g.names.length, P = g.names.map((_, i) => ({x: 50 + i * 600 / (n - 1), y: i === 0 || i === n - 1 ? 130 : i % 2 ? 70 : 190})), vals = Array(n).fill(''); vals[0] = '1';
      const svg = svgEl('svg', {viewBox: '0 0 700 260', class: 'og-graph'}), fo = el('div', 'og-counts');
      svg.append(svgEl('defs', {})); const mk = svgEl('marker', {id: 'og-arrow2', viewBox: '0 0 10 10', refX: 22, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto'}); mk.append(svgEl('path', {d: 'M0,0 L10,5 L0,10 z', fill: '#ffd34d'})); svg.firstChild.append(mk);
      for (const [a, b] of g.edges) { const same = P[a].y === P[b].y && b - a > 1, bend = same ? (P[a].y < 130 ? -55 : 55) : 0; svg.append(svgEl('path', {d: `M${P[a].x},${P[a].y} Q${(P[a].x + P[b].x) / 2},${(P[a].y + P[b].y) / 2 + bend} ${P[b].x},${P[b].y}`, fill: 'none', stroke: '#8fa6d6', 'stroke-width': 3, 'marker-end': 'url(#og-arrow2)'})); }
      g.names.forEach((nm, i) => svg.append(svgEl('circle', {cx: P[i].x, cy: P[i].y, r: 18, fill: '#243253', stroke: '#ffd34d', 'stroke-width': 3}), svgEl('text', {x: P[i].x, y: P[i].y + 6, 'text-anchor': 'middle', fill: '#fff', 'font-weight': 800, 'font-size': 17}, nm)));
      g.names.forEach((nm, i) => { const lab = el('label', 'og-count'), inp = el('input'); inp.value = vals[i]; inp.disabled = i === 0; inp.inputMode = 'numeric'; inp.setAttribute('aria-label', 'Путей до ' + nm); inp.addEventListener('input', () => { vals[i] = inp.value; }); lab.append(el('b', '', nm), inp); fo.append(lab); });
      const go = button('🧮 Путей до К — сдать', 'lab-main', () => { if (String(vals[n - 1]).trim()) submit(vals[n - 1]); }); go.dataset.act = 'run';
      box.append(el('p', 'lab-note', 'Подпиши у каждого города, сколько путей ведёт в него из А: это сумма чисел городов, откуда в него входят стрелки. Число у К — ответ.'), svg, fo, go); return box; },
    10(p, {el, button}, submit) { const box = el('div', 'og-w'), d = p.data; let chosen = -1; const row = el('div', 'og-chests'), form = el('form', 'og-form'), inp = el('input'); inp.setAttribute('aria-label', 'Ответ'); inp.placeholder = 'в десятичной';
      const draw = () => row.replaceChildren(...d.shown.map((s2, k) => button('🧰\n' + s2, 'og-chest' + (k === chosen ? ' on' : ''), () => { chosen = k; draw(); form.hidden = false; inp.focus(); })));
      const go = button('💰 Забрать сокровище', 'lab-main', () => form.requestSubmit()); go.dataset.act = 'run'; form.append(el('span', '', 'Сколько монет в нём (в десятичной системе):'), inp, go); form.hidden = true;
      form.addEventListener('submit', e => { e.preventDefault(); if (inp.value.trim()) submit(inp.value); });
      box.append(el('p', 'lab-note', 'В каждом сундуке столько монет, сколько написано, но в разных системах счисления. Выбери самый богатый и скажи, сколько в нём монет.'), row, form); draw(); return box; },
    11(p, {el, button}, submit) { const box = el('div', 'og-w'), d = p.data, picked = new Set(), txt = el('p', 'og-hunt'), cnt = el('p', 'og-route');
      const parts = d.text.split(/([А-Яа-яЁё]+)/); parts.forEach((part, k) => { if (/^[А-Яа-яЁё]+$/.test(part)) { const b = button(part, 'og-hw', () => { picked.has(k) ? picked.delete(k) : picked.add(k); b.classList.toggle('on', picked.has(k)); cnt.textContent = `Найдено: ${picked.size}`; }); b.dataset.hit = d.hit(part) ? '1' : ''; txt.append(b); } else txt.append(part); });
      const go = button('🎯 Сдать находки', 'lab-main', () => submit(String(picked.size))); go.dataset.act = 'run'; cnt.textContent = 'Найдено: 0';
      box.append(el('p', 'lab-note', d.mode ? 'Отметь щелчком все слова, которые начинаются с «код» — с прописной или строчной буквы.' : 'Отметь щелчком каждое слово «код» — именно в этой форме, со строчной буквы.'), txt, cnt, go); return box; },
    12(p, {el, button}, submit) { const box = el('div', 'og-w'), d = p.data, picked = new Set(), ul = el('ul', 'og-tree'), cnt = el('p', 'og-route');
      for (const [f, list] of p.tree) { const li = el('li', d.scope.includes(f) ? 'in' : 'out'); li.append(el('b', '', '📁 ' + f)); for (const x of list) { const id = f + '/' + x, b = button('📄 ' + x, 'og-file', () => { picked.has(id) ? picked.delete(id) : picked.add(id); b.classList.toggle('on', picked.has(id)); cnt.textContent = `Отобрано файлов: ${picked.size}`; }); b.dataset.hit = d.scope.includes(f) && d.re.test(x) ? '1' : ''; li.append(b); } ul.append(li); }
      const go = button('🗂 Готово', 'lab-main', () => submit(String(picked.size))); go.dataset.act = 'run'; cnt.textContent = 'Отобрано файлов: 0';
      box.append(el('p', 'lab-note', `Маска: ${d.mask}. Отметь щелчком все подходящие файлы ${d.where ? `в каталоге «${d.where}» и его подкаталогах (они подсвечены)` : 'во всех каталогах'}. «?» — ровно один символ, «*» — сколько угодно символов.`), ul, cnt, go); return box; },
  };
  function progMount(host, lv, api, seed0, code0) {
    host.replaceChildren(); const {el, button} = api, task = el('div', 'lab-task og-head'), box = el('div', 'lab-panel og-box'), msg = el('p', 'lab-msg'), boss = el('div', 'og-boss'), shields = el('div', 'og-shields'); let seed = seed0 ?? Math.floor(Math.random() * 1e6), t = progTask(lv, seed), tries = 0, timer = 0;
    const icon = new Image(); icon.className = 'og-icon'; icon.alt = ''; icon.src = lv.n === 15 ? 'art/robot_bot.webp?v=1' : 'art/oge_icon_6.webp?v=1'; icon.addEventListener('error', () => icon.remove());
    task.append(icon, el('h2', '', `${GAME[lv.n]} · задание ${lv.n} ОГЭ`), el('p', '', lv.n === 15 ? 'Напиши для Робота программу на языке Кумира. Экзаменатор проверит её на трёх полях: длины стен там разные, поэтому нужны циклы «нц пока … кц». Каждое поле, где Робот справился, сбивает щит.' : 'Напиши программу на Python. Экзаменатор запустит её на трёх скрытых тестах — каждый пройденный тест сбивает щит.'));
    const paint = res => shields.replaceChildren(...[0, 1, 2].map(i => el('i', res ? (res[i]?.ok ? 'broken' : 'held') : '')));
    boss.append(el('span', 'og-bossname', 'Робот-экзаменатор'), shields); paint(null);
    const ed = el('textarea', 'ex-code og-ed'); ed.spellcheck = false; ed.rows = 10; ed.setAttribute('aria-label', 'Программа');
    const out = el('div', 'og-results');
    const submit = () => { tries++; clearInterval(timer); const r = checkProg(lv, {seed, code: ed.value}); paint(r.results);
      out.replaceChildren(...r.results.map((x, i) => el('p', x.ok ? 'good' : 'bad', `${lv.n === 15 ? 'Поле' : 'Тест'} ${i + 1}: ${x.ok ? 'пройден ✔' : x.msg || 'не пройден'}`)));
      if (r.results.length && r.results.every(x => x.ok)) { msg.className = 'lab-msg good'; msg.textContent = 'Все три щита сбиты!'; api.finish(tries === 1 ? 3 : tries <= 3 ? 2 : 1, `${lv.n === 15 ? 'Робот' : 'Программа'}: все проверки пройдены, попытка ${tries}.`); return; }
      msg.className = 'lab-msg bad'; msg.textContent = r.msg + ' Исправь программу и сдай снова (три звезды — за сдачу с первой попытки).';
      if (tries >= 2 && !box.querySelector('[data-act=hint]')) { const h = button('Показать пример решения', 'lab-small', () => { const pre = el('pre', 'og-code', t.ref); h.replaceWith(pre); }); h.dataset.act = 'hint'; box.append(h); } };
    const go = button('🛡 Сдать на проверку', 'lab-main', submit); go.dataset.act = 'run';
    let side;
    if (lv.n === 15) {
      let shown = 0; const cv = el('canvas', 'og-field'), tabs = el('div', 'og-ftabs'), g = cv.getContext('2d'), bot = new Image(); bot.src = 'art/robot_bot.webp?v=1';
      const draw = st => { const f = t.fields[shown], C = Math.floor(Math.min(560 / f.w, 380 / f.h)); cv.width = f.w * C + 8; cv.height = f.h * C + 8; g.fillStyle = '#f4f6fb'; g.fillRect(0, 0, cv.width, cv.height); const X = x => 4 + x * C, want = new Set(f.paint.map(c => c.join(',')));
        for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { if (st && st.painted.has(x + ',' + y)) { g.fillStyle = '#7d8ea8'; g.fillRect(X(x), X(y), C, C); } if (want.has(x + ',' + y)) { g.strokeStyle = '#1d8f63'; g.setLineDash([5, 4]); g.lineWidth = 2; g.strokeRect(X(x) + 4, X(y) + 4, C - 8, C - 8); g.setLineDash([]); } g.strokeStyle = '#c9d1e0'; g.lineWidth = 1; g.strokeRect(X(x), X(y), C, C); }
        g.strokeStyle = '#1b2333'; g.lineWidth = 5; g.lineCap = 'round'; g.strokeRect(4, 4, f.w * C, f.h * C); for (const k of f.walls) { const [x, y, d] = k.split(','); const xx = +x, yy = +y; g.beginPath(); if (d === 'вверх') { g.moveTo(X(xx), X(yy)); g.lineTo(X(xx + 1), X(yy)); } else if (d === 'вниз') { g.moveTo(X(xx), X(yy + 1)); g.lineTo(X(xx + 1), X(yy + 1)); } else if (d === 'влево') { g.moveTo(X(xx), X(yy)); g.lineTo(X(xx), X(yy + 1)); } else { g.moveTo(X(xx + 1), X(yy)); g.lineTo(X(xx + 1), X(yy + 1)); } g.stroke(); }
        const [rx, ry] = st ? [st.x, st.y] : f.start; if (bot.complete && bot.naturalWidth) g.drawImage(bot, X(rx) + 3, X(ry) + 3, C - 6, C - 6); else { g.fillStyle = '#ffb347'; g.beginPath(); g.arc(X(rx) + C / 2, X(ry) + C / 2, C * .32, 0, 7); g.fill(); } };
      const tab = () => tabs.replaceChildren(...[0, 1, 2].map(i => { const b = button(`Поле ${i + 1}`, 'lab-small' + (i === shown ? ' on' : ''), () => { shown = i; clearInterval(timer); tab(); draw(null); }); return b; }));
      const trial = button('▶ Запустить на этом поле', 'lab-small', () => { clearInterval(timer); let prog; try { prog = parseKumir(ed.value); } catch (e) { msg.className = 'lab-msg bad'; msg.textContent = 'Ошибка в программе: ' + e.message + '.'; return; } const frames = []; let err = null; try { runKumir(prog, t.fields[shown], s2 => frames.push(s2)); } catch (e) { err = e.message; } let k = 0;
        msg.className = 'lab-msg'; msg.textContent = 'Робот работает…'; timer = setInterval(() => { if (k >= frames.length) { clearInterval(timer); msg.className = 'lab-msg ' + (err ? 'bad' : ''); msg.textContent = err ? err + '.' : 'Робот закончил. Сравни закрашенные клетки с пунктирными.'; return; } draw(frames[k++]); }, 120); });
      bot.addEventListener('load', () => draw(null)); ed.value = '| Программа для Робота на языке Кумира\n';
      const help = el('details', 'sh-help'); help.append(el('summary', '', 'Команды Робота'), el('pre', 'og-code', 'вверх  вниз  влево  вправо  закрасить\nнц пока справа свободно      | цикл, пока условие истинно\n  вправо\nкц\nнц 5 раз … кц                | цикл со счётчиком\nесли снизу стена то … иначе … все\nУсловия: сверху / снизу / слева / справа + свободно / стена,\nклетка закрашена, клетка чистая; связки и, или, не.'));
      side = [el('p', 'og-text', t.text[0] + ' ' + t.text[1] + ' Пунктиром отмечены клетки, которые нужно закрасить на этом поле.'), tabs, cv, trial, help]; tab(); draw(null);
    } else {
      const tin = el('textarea', 'ex-code og-in'); tin.rows = 3; tin.placeholder = 'Входные данные через пробел, например: 3 12 26 40'; tin.setAttribute('aria-label', 'Входные данные'); const tout = el('pre', 'og-code og-out', '');
      const trial = button('▶ Пробный запуск', 'lab-small', () => { try { tout.textContent = 'Вывод:\n' + (runPython(ed.value, tin.value.trim().split(/\s+/).filter(Boolean)) || '(пусто)'); } catch (e) { tout.textContent = 'Ошибка' + (e.line ? ` в строке ${e.line}` : '') + ': ' + e.message; } });
      ed.value = '# Решение на Python\n'; side = [el('p', 'og-text', t.text), el('p', 'lab-note', 'Проверь программу на своих данных: введи числа так, как они приходят на вход, по одному числу на каждый input().'), tin, trial, tout];
    }
    const cols = el('div', 'lab-cols'), l = el('div', 'lab-panel'), r = el('div', 'lab-panel'); l.append(...side); r.append(el('h3', '', lv.n === 15 ? 'Программа (Кумир)' : 'Программа (Python)'), ed, go, out, msg); cols.append(l, r);
    const fresh = button('🎲 Другой вариант', 'lab-small', () => { clearInterval(timer); progMount(host, lv, api); }); r.append(fresh);
    box.append(cols); host.classList.add('og-arena'); host.append(task, boss, box); if (code0) ed.value = code0;
    // На стенде: готовое решение подставляется вместе со своим вариантом (условие, поля и тесты перестраиваются).
    if (api.debugHost) window.labSet = a => { clearInterval(timer); progMount(host, lv, api, a.seed, a.code); };
    return () => clearInterval(timer);
  }
  function mount(host, lv, api) {
    if (lv.prog) return progMount(host, lv, api);
    const {el, button} = api, task = el('div', 'lab-task og-head'), box = el('div', 'lab-panel og-box'), msg = el('p', 'lab-msg'); let seed = Math.floor(Math.random() * 1e6), ps = problems(lv, seed), k = 0, answers = [], forced = null;
    // Бой с роботом-экзаменатором: у него три щита (по одному на вариант), верный ответ сбивает щит.
    const boss = el('div', 'og-boss'), shields = el('div', 'og-shields'), icon = new Image(); icon.className = 'og-icon'; icon.alt = ''; icon.src = `art/oge_icon_${lv.n}.webp?v=1`; icon.addEventListener('error', () => icon.remove());
    task.append(icon, el('h2', '', `${GAME[lv.n]} · задание ${lv.n} ОГЭ`), el('p', '', `${TITLES[lv.n]}. Робот-экзаменатор выставил три щита — каждый верный ответ сбивает один. Сколько щитов собьёшь, столько звёзд.`));
    const paint = () => { shields.replaceChildren(...[0, 1, 2].map(i => el('i', i < answers.length ? (same(ps[i], answers[i]) ? 'broken' : 'held') : i === k ? 'now' : ''))); };
    boss.append(el('span', 'og-bossname', 'Робот-экзаменатор'), shields);
    function show() { paint();
      if (k >= 3) { const r = check(lv, {seed, answers}); if (r.ok) api.finish(r.stars, r.msg); else { box.replaceChildren(el('p', 'lab-msg bad', r.msg), button('⚔ Новый бой', 'lab-main', () => { seed++; ps = problems(lv, seed); k = 0; answers = []; show(); })); } return; }
      const p = ps[k], frame = el('div', 'og-play'); if (api.debugHost) window.ogeNow = p;
      const submit = a => { if (forced) { const r = check(lv, forced); if (r.ok) api.finish(r.stars, r.msg); return; } if (a == null || String(a).trim() === '') return; answers.push(String(a)); const ok = same(p, a); k++; paint();
        boss.classList.remove('hit', 'miss'); void boss.offsetWidth; boss.classList.add(ok ? 'hit' : 'miss');
        for (const n of frame.querySelectorAll('[data-hit]')) n.classList.add(n.dataset.hit ? 'should' : 'shouldnt');
        for (const b of frame.querySelectorAll('button')) b.disabled = true;
        msg.className = 'lab-msg ' + (ok ? 'good' : 'bad'); msg.textContent = (ok ? 'Щит сбит! ' : `Щит устоял. Правильный ответ: ${p.answer}. `) + p.explain;
        const next = button(k < 3 ? 'Следующий щит →' : 'Итог боя', 'lab-main', show); next.dataset.act = 'next-q'; frame.after(next); next.focus(); };
      const story = el('details', 'og-orig'); story.append(el('summary', '', 'Условие как в ОГЭ'), el(p.code ? 'pre' : 'p', p.code ? 'og-code' : 'og-text', p.text));
      frame.append(W[lv.n](p, api, submit)); box.replaceChildren(el('p', 'lab-eyebrow', `ЩИТ ${k + 1} ИЗ 3`), frame, story, msg); msg.textContent = ''; msg.className = 'lab-msg'; }
    host.classList.add('og-arena'); host.append(task, boss, box); show();
    // Отладка на стенде: готовые ответы засчитываются кнопкой сдачи любой мини-игры.
    host.addEventListener('click', e => { if (forced && e.target.closest('[data-act=run]')) { e.stopPropagation(); const r = check(lv, forced); if (r.ok) api.finish(r.stars, r.msg); } }, true);
    if (api.debugHost) window.labSet = a => { forced = a; for (const b of host.querySelectorAll('[data-act=run]')) b.disabled = false; };
  }
  // Пробный ОГЭ: задания 1–12 по одному варианту, как в бланке (без мини-игр и подсказок), таймер; итог — баллы и разбор.
  // Задания 13–16 выполняются на компьютере в отдельных программах, поэтому в пробник не входят; прогноз отметки — по доле верных ответов.
  function mock({el, button}) {
    const box = el('section', 'lab-panel og-mock'); box.append(el('h3', '', '📝 Пробный ОГЭ: задания 1–12'), el('p', 'lab-note', 'Двенадцать заданий подряд, по одному варианту, без подсказок — как на экзамене. Таймер 45 минут. Ответы и разбор — в конце.'));
    const go = button('Начать пробник', 'lab-main', () => run()); go.dataset.act = 'mock'; box.append(go); return box;
    function run() {
      const seed = Math.floor(Math.random() * 1e6), r = rng(seed), tasks = Object.keys(T).map(Number).sort((a, b) => a - b).map(n => ({n, p: T[n](r)}));
      const page = el('div', 'og-mockpage'), timer = el('b', 'og-timer'), form = el('form', 'og-mockform'), t0 = Date.now(), LIMIT = 45 * 60;
      const head = el('div', 'og-mockhead'); head.append(el('h2', '', 'Пробный ОГЭ · задания 1–12'), timer, button('Закончить и проверить', 'lab-main', () => finish()));
      for (const {n, p} of tasks) { const q = el('div', 'lab-panel og-mq'); q.append(el('p', 'lab-eyebrow', `ЗАДАНИЕ ${n}`), el(p.code ? 'pre' : 'p', p.code ? 'og-code' : 'og-text', p.text));
        if (p.table) { const t = el('table', 'lab-table og-table'); for (const row of p.table) { const tr = el('tr'); for (const c of row) tr.append(el('td', '', String(c))); t.append(tr); } q.append(t); }
        if (p.graph) q.append(graphSvg(p.graph, el));
        if (p.tree) { const ul = el('ul', 'og-tree'); for (const [f, list] of p.tree) { const li = el('li'); li.append(el('b', '', '📁 ' + f), el('span', '', list.map(x => '📄 ' + x).join('   '))); ul.append(li); } q.append(ul); }
        const inp = el('input', 'og-mi'); inp.autocomplete = 'off'; inp.placeholder = 'Ответ'; inp.dataset.n = n; inp.setAttribute('aria-label', 'Ответ на задание ' + n); q.append(inp); form.append(q); }
      page.append(head, form); document.body.append(page); scrollTo(0, 0);
      const upd = () => { const left = LIMIT - Math.floor((Date.now() - t0) / 1000); timer.textContent = `${Math.floor(Math.max(0, left) / 60)}:${String(Math.max(0, left) % 60).padStart(2, '0')}`; if (left <= 0) finish(); }, tick = setInterval(upd, 500); upd();
      if (location.hostname === '127.0.0.1') window.ogeMock = {tasks, fill: () => { for (const {n, p} of tasks) page.querySelector(`[data-n="${n}"]`).value = String(p.answer); }, finish};
      function finish() {
        clearInterval(tick); const rows = tasks.map(({n, p}) => { const a = page.querySelector(`[data-n="${n}"]`).value; return {n, a, ok: same(p, a), p}; }), score = rows.filter(x => x.ok).length;
        // Прогноз: доля верных ответов, перенесённая на весь экзамен (19 баллов), и шкала ФИПИ: 0–4 «2», 5–10 «3», 11–16 «4», 17–19 «5».
        const est = Math.round(score / 12 * 19), mark = est >= 17 ? 5 : est >= 11 ? 4 : est >= 5 ? 3 : 2, mins = Math.round((Date.now() - t0) / 60000);
        const res = el('div', 'og-mockres'); res.append(el('h2', '', `Результат: ${score} из 12`), el('p', '', `Время: ${mins} мин. Примерный прогноз отметки за весь экзамен, если задания 13–16 выполнить так же: «${mark}» (≈${est} баллов из 19 по шкале ФИПИ).`));
        const t = el('table', 'lab-table og-mt'), hr = el('tr'); for (const h of ['№', 'Твой ответ', 'Верный ответ', '']) hr.append(el('th', '', h)); t.append(hr);
        for (const x of rows) { const tr = el('tr', x.ok ? 'ok' : 'bad'); tr.append(el('td', '', String(x.n)), el('td', '', x.a || '—'), el('td', '', String(x.p.answer)), el('td', '', x.ok ? '✓' : '✗')); t.append(tr); const tr2 = el('tr', 'ex'); const td = el('td', '', x.p.explain); td.colSpan = 4; tr2.append(td); if (!x.ok) t.append(tr2); }
        res.append(t, button('Закрыть', 'lab-main', () => page.remove())); page.replaceChildren(res); scrollTo(0, 0); if (location.hostname === '127.0.0.1') window.ogeMockResult = {score, mark};
      }
    }
  }
  LAB.register({id: 'oge', bg: 'oge_arena', extra: mock, title: 'ОГЭ-арена', genre: 'подготовка к ОГЭ', art: '🎯', color: '#ff6f91', unit: 'Задание', minutes: 45,
    about: 'Двенадцать заданий ОГЭ по информатике: объём текста, шифры, логика, графы, исполнители, программы, адреса, запросы, системы счисления, поиск и маски файлов. Варианты каждый раз новые, после ошибки — разбор.',
    levels: grade => grade <= 8 ? LEVELS.filter(l => [1, 2, 3, 4, 5, 6, 9, 10].includes(l.n)) : LEVELS, mount, check,
    solve: lv => lv.prog ? {seed: 1, code: progTask(lv, 1).ref} : {seed: 1, answers: problems(lv, 1).map(p => String(p.answer))}, LEVELS, problems, T, progTask, parseKumir, runKumir, runPython});
})();
