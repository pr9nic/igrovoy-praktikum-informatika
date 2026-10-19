// «Пиксель-мастер»: картинка — это числа. Восстанови рисунок по коду (двоичному, RLE, с палитрой, шестнадцатеричному) и посчитай, сколько он занимает.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const PICS = {
    heart: ['00000000', '01100110', '11111111', '11111111', '01111110', '00111100', '00011000', '00000000'],
    house: ['00011000', '00111100', '01111110', '11111111', '01000010', '01011010', '01011010', '01111110'],
    arrow: ['00010000', '00011000', '11111100', '11111110', '11111100', '00011000', '00010000', '00000000'],
    ghost: ['00111100', '01111110', '11011011', '11111111', '11111111', '11111111', '11011011', '10010010'],
    key: ['00000000', '01110000', '11011111', '10001101', '11011101', '01110000', '00000000', '00000000'],
    smile: ['00111100', '01000010', '10100101', '10000001', '10100101', '10011001', '01000010', '00111100'],
    invader: ['00100100', '00111100', '01111110', '11011011', '11111111', '00100100', '01011010', '10100101'],
    flower: ['00011000', '00122100', '01233210', '01233210', '00122100', '00011000', '00033000', '00333300'],
    robot: ['00200200', '01111110', '01311310', '01111110', '00122100', '03111130', '03111130', '00300300'],
  };
  const BW = ['#f2f5fb', '#141a2e'], PAL = ['#f2f5fb', '#ffd34d', '#ff5a5a', '#3fba74'], PALNAME = ['белый', 'жёлтый', 'красный', 'зелёный'];
  const rle = row => { const out = []; let cur = '0', n = 0; for (const ch of row) { if (ch === cur) n++; else { out.push(n); cur = ch; n = 1; } } out.push(n); return out.join(' '); };
  const hex = row => parseInt(row, 2).toString(16).toUpperCase().padStart(2, '0');
  const codeOf = (enc, pic) => pic.map(r => enc === 'rle' ? rle(r) : enc === 'hex' ? hex(r) : r.split('').join(' '));
  const P = (title, enc, pic, brief) => ({title, kind: 'paint', enc, pic: PICS[pic], colors: enc === 'pal' ? PAL : BW, brief});
  const C = (title, q, answer, why) => ({title, kind: 'calc', q, answer: String(answer), why});
  const HOW = {bin: 'Каждая цифра — один пиксель: 0 — белый, 1 — чёрный.', rle: 'Числа — длины цепочек одинаковых пикселей. Строка всегда начинается с белых: «2 4 2» — два белых, четыре чёрных, два белых. Если первым стоит 0, строка начинается с чёрного.',
    pal: 'Каждая цифра — номер цвета в палитре: 0 — белый, 1 — жёлтый, 2 — красный, 3 — зелёный.', hex: 'Каждая строка — одно шестнадцатеричное число из двух цифр. Каждая цифра — это четыре пикселя: например, A = 1010, 3 = 0011. 0 — белый, 1 — чёрный.'};
  const LEVELS = [
    P('Сердце из нулей и единиц', 'bin', 'heart', 'Компьютер хранит чёрно-белый рисунок как нули и единицы. Закрась клетки по коду.'),
    P('Домик', 'bin', 'house', 'Ещё один рисунок в двоичном коде.'),
    C('Сколько весит рисунок', 'Чёрно-белый рисунок 8×8 пикселей. На каждый пиксель уходит 1 бит. Сколько бит занимает весь рисунок?', 64, '8 × 8 = 64 пикселя, по 1 биту на каждый.'),
    P('Стрелка в сжатом виде', 'rle', 'arrow', 'Длинные цепочки одинаковых пикселей можно записать короче — так работает сжатие RLE.'),
    P('Привидение', 'rle', 'ghost', 'Сжатый рисунок посложнее: следи, с какого цвета начинается строка.'),
    C('Сжатие строки', 'Запиши строку 0 0 1 1 1 1 0 0 способом RLE (длины цепочек через пробел, начиная с белых).', '2 4 2', 'Два белых, четыре чёрных, два белых.'),
    C('Четыре цвета', 'В рисунке 4 разных цвета. Сколько бит нужно, чтобы записать цвет одного пикселя?', 2, 'Двумя битами можно записать 4 разных значения: 00, 01, 10, 11.'),
    P('Цветок с палитрой', 'pal', 'flower', 'В цветном рисунке каждый пиксель — номер цвета из палитры.'),
    P('Робот', 'pal', 'robot', 'Цветной рисунок посложнее.'),
    C('Вес цветного рисунка', 'Рисунок 8×8 пикселей, в палитре 4 цвета. Сколько бит занимает рисунок?', 128, '64 пикселя × 2 бита = 128 бит.'),
    P('Ключ', 'bin', 'key', 'Закрепление: двоичный код.'),
    P('Улыбка в шестнадцатеричном коде', 'hex', 'smile', 'Программисты записывают восемь пикселей двумя шестнадцатеричными цифрами.'),
    P('Космический захватчик', 'hex', 'invader', 'Шестнадцатеричный код посложнее.'),
    C('Большая иконка', 'Иконка 16×16 пикселей, в палитре 16 цветов. Сколько байт она занимает? (В байте 8 бит.)', 128, '256 пикселей × 4 бита = 1024 бита = 128 байт.'),
    C('Палитра побольше', 'На каждый пиксель отвели 5 бит. Сколько разных цветов может быть в палитре?', 32, '2 в степени 5 — это 32.'),
  ];
  const norm = s => String(s).trim().replace(/[\s,;]+/g, ' ');
  function check(lv, answer) {
    if (lv.kind === 'calc') return norm(answer) === lv.answer ? {ok: true, stars: 3, msg: lv.why} : {ok: false, msg: 'Пока неверно. Посчитай ещё раз.'};
    if (!Array.isArray(answer) || answer.length !== lv.pic.length) return {ok: false, msg: 'Рисунок не готов.'};
    let wrong = 0; lv.pic.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (Number(row[x]) !== (answer[y] || [])[x]) wrong++; });
    return wrong ? {ok: false, wrong, msg: `Не совпадает пикселей: ${wrong}. Сверь строки с кодом.`} : {ok: true, stars: 3, msg: 'Рисунок восстановлен точно.'};
  }
  // Сетка для рисования: щелчок или движение с зажатой кнопкой красит выбранным цветом.
  function board(api, size, colors, onChange) {
    const {el, button} = api, grid = Array.from({length: size}, () => Array(size).fill(0)), wrap = el('div', 'px-board'), cells = []; let color = 1, down = false;
    wrap.style.setProperty('--n', size);
    const paint = (x, y) => { grid[y][x] = color; cells[y][x].style.background = colors[color]; onChange && onChange(); };
    for (let y = 0; y < size; y++) { cells.push([]); for (let x = 0; x < size; x++) { const c = button('', 'px-cell', () => paint(x, y)); c.dataset.xy = x + ',' + y; c.style.background = colors[0]; c.setAttribute('aria-label', `Строка ${y + 1}, столбец ${x + 1}`);
      c.addEventListener('mousedown', e => { down = true; paint(x, y); e.preventDefault(); }); c.addEventListener('mouseenter', () => { if (down) paint(x, y); }); cells[y].push(c); wrap.append(c); } }
    const up = () => { down = false; }; window.addEventListener('mouseup', up);
    const tools = el('div', 'px-tools'); colors.forEach((col, i) => { const b = button('', 'px-color' + (i === color ? ' on' : ''), () => { color = i; [...tools.children].forEach((t, k) => t.classList.toggle('on', k === i)); }); b.style.background = col; b.dataset.color = i; b.setAttribute('aria-label', 'Цвет ' + i); b.append(el('span', '', String(i))); tools.append(b); });
    return {wrap, tools, grid, set(g) { g.forEach((row, y) => row.forEach((v, x) => { grid[y][x] = v; cells[y][x].style.background = colors[v]; })); }, off: () => window.removeEventListener('mouseup', up)};
  }
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'); let tries = 0;
    const done = r => { tries++; if (r.ok) { msg.textContent = r.msg; msg.className = 'lab-msg good'; api.finish(tries === 1 ? 3 : tries === 2 ? 2 : 1, r.msg); } else { msg.textContent = r.msg; msg.className = 'lab-msg bad'; } };
    if (lv.kind === 'calc') {
      task.append(el('h2', '', lv.title), el('p', '', lv.q)); const form = el('form', 'px-form'), inp = el('input'); inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Ответ'); inp.placeholder = 'ответ'; inp.dataset.answer = '1';
      form.append(inp, button('Ответить', 'lab-main', () => form.requestSubmit())); form.addEventListener('submit', e => { e.preventDefault(); if (inp.value.trim()) done(check(lv, inp.value)); });
      host.append(task, form, msg, el('p', 'lab-note', 'Три звезды — за верный ответ с первой попытки.')); inp.focus(); if (api.debugHost) window.labSet = v => { inp.value = v; }; return;
    }
    task.append(el('h2', '', lv.title), el('p', '', lv.brief), el('p', '', HOW[lv.enc]));
    const b = board(api, lv.pic.length, lv.colors), code = el('ol', 'px-code'); codeOf(lv.enc, lv.pic).forEach(r => code.append(el('li', '', r)));
    const left = el('div', 'lab-panel'), right = el('div', 'lab-panel'), cols = el('div', 'lab-cols'), go = button('Проверить рисунок', 'lab-main', () => done(check(lv, b.grid))); go.dataset.act = 'run';
    left.append(el('h3', '', 'Холст'), b.tools, b.wrap, go, msg); right.append(el('h3', '', 'Код рисунка — по строке на каждую строку холста'), code);
    if (lv.enc === 'pal') { const leg = el('div', 'px-legend'); PAL.forEach((c, i) => { const s = el('span', '', `${i} — ${PALNAME[i]}`); s.style.setProperty('--col', c); leg.append(s); }); right.append(leg); }
    right.append(el('p', 'lab-note', 'Три звезды — если рисунок верный с первой проверки. Красить можно, ведя мышью с зажатой кнопкой; цвет выбирается над холстом.'));
    cols.append(left, right); host.append(task, cols); if (api.debugHost) window.labSet = g => b.set(g); return b.off;
  }
  // Мастерская: нарисуй свою картинку и передай однокласснику её код — он восстановит рисунок.
  function extra(api) {
    const {el, button} = api, box = el('div', 'lab-panel px-studio'), b = board(api, 8, BW), out = el('input'), inp = el('input'), msg = el('p', 'lab-msg'); out.readOnly = true; out.setAttribute('aria-label', 'Код твоего рисунка'); inp.placeholder = 'код от одноклассника, 16 знаков'; inp.maxLength = 16; inp.setAttribute('aria-label', 'Код от одноклассника');
    const mine = () => b.grid.map(r => hex(r.join(''))).join(''); let secret = null;
    const bar = el('div', 'lab-bar'); bar.style.justifyContent = 'flex-start';
    bar.append(button('Получить код рисунка', 'lab-small', () => { out.value = mine(); msg.textContent = 'Передай этот код однокласснику: он введёт его ниже и попробует восстановить рисунок.'; msg.className = 'lab-msg good'; }),
      button('Разгадать код', 'lab-small', () => { const v = inp.value.trim().toUpperCase(); if (!/^[0-9A-F]{16}$/.test(v)) { msg.textContent = 'Код — это 16 знаков: цифры и буквы A–F.'; msg.className = 'lab-msg bad'; return; } secret = v; b.set(Array.from({length: 8}, () => Array(8).fill(0))); msg.textContent = 'Строки кода: ' + v.match(/../g).join(' ') + '. Закрась холст и нажми «Сверить».'; msg.className = 'lab-msg'; }),
      button('Сверить', 'lab-small', () => { if (!secret) return; const ok = mine() === secret; msg.textContent = ok ? 'Точно! Рисунок восстановлен.' : 'Пока не совпадает — сверь строки.'; msg.className = 'lab-msg ' + (ok ? 'good' : 'bad'); }),
      button('Очистить', 'lab-small', () => b.set(Array.from({length: 8}, () => Array(8).fill(0)))));
    box.append(el('h3', '', 'Мастерская: загадай рисунок однокласснику (без звёзд)'), b.tools, b.wrap, bar, out, inp, msg); return box;
  }
  LAB.register({id: 'pixel', bg: 'pixel_bg', hero: 'pixel_artist', title: 'Пиксель-мастер', genre: 'кодирование изображений', art: '🎨', color: '#ff7ab8', unit: 'Рисунок', minutes: 40,
    about: 'Картинка для компьютера — это числа. Восстанавливай рисунки по двоичному коду, сжатию RLE, палитре и шестнадцатеричным числам и считай, сколько места они занимают.',
    levels: grade => grade <= 7 ? LEVELS.slice(0, 11) : LEVELS, mount, check, extra, solve: lv => lv.kind === 'calc' ? lv.answer : lv.pic.map(r => r.split('').map(Number)), codeOf, PICS});
})();
