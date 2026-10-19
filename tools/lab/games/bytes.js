// «Порт данных»: измерение информации. Робот-грузчик пакует тексты, картинки и звук в контейнеры, а ты считаешь их объём.
// Темы: единицы измерения, алфавитный подход, объём текста, кодирование изображений и звука, передача данных (задание 1 ОГЭ, 7 и 10 классы).
// Каждый уровень — три варианта подряд, числа каждый раз новые; после ошибки показывается решение.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1)), pick = (r, a) => a[Math.floor(r() * a.length)];
  const UNITS = [['бит', 1], ['байт', 8], ['Кбайт', 8 * 1024], ['Мбайт', 8 * 1024 * 1024]];
  const G = {
    units(r) { const [f, t] = pick(r, [[2, 1], [3, 1], [2, 0], [3, 2], [1, 0], [3, 0]]), big = f > t, k = big ? ri(r, 1, 16) : 0; const from = UNITS[f], to = UNITS[t];
      const val = k || 1, ans = val * from[1] / to[1]; return {text: `Контейнер вмещает ${val} ${from[0]}. Сколько это ${to[0]}?`, answer: ans, explain: `1 ${from[0]} = ${from[1] / to[1]} ${to[0]}, значит ${val} ${from[0]} = ${ans} ${to[0]}. Помни: 1 байт = 8 бит, 1 Кбайт = 1024 байта, 1 Мбайт = 1024 Кбайт.`}; },
    alphabet(r) { const i = ri(r, 2, 8), N = ri(r, 2 ** (i - 1) + 1, 2 ** i); return {text: `Алфавит племени роботов состоит из ${N} символов. Какое наименьшее количество бит нужно, чтобы закодировать один символ одинаковым для всех символов числом бит?`, answer: i, explain: `Ищем наименьшее i, при котором 2^i ≥ ${N}: 2^${i - 1} = ${2 ** (i - 1)} — мало, 2^${i} = ${2 ** i} — достаточно. i = ${i}.`}; },
    power(r) { const i = ri(r, 1, 9); return {text: `Каждый символ алфавита кодируется ${i} бит${i === 1 ? 'ом' : 'ами'}, и все коды разные. Сколько символов может быть в таком алфавите самое большее?`, answer: 2 ** i, explain: `N = 2^i = 2^${i} = ${2 ** i}.`}; },
    message(r) { const i = ri(r, 3, 7), N = 2 ** i - ri(r, 0, 2 ** (i - 2)), K = ri(r, 2, 16) * 8; return {text: `Сообщение из ${K} символов записано алфавитом из ${N} символов (каждый символ кодируется минимально возможным одинаковым числом бит). Каков объём сообщения в байтах?`, answer: K * i / 8, explain: `Один символ: i = ${i} бит (2^${i} = ${2 ** i} ≥ ${N}). Всё сообщение: ${K} × ${i} = ${K * i} бит = ${K * i / 8} байт.`}; },
    book(r) { const p = pick(r, [8, 16, 32, 64]), l = pick(r, [32, 40, 48, 64]), c = pick(r, [32, 48, 64]), b = pick(r, [8, 16]); const bytes = p * l * c * b / 8, ans = bytes / 1024;
      if (!Number.isInteger(ans)) return null; return {text: `Рассказ набран на компьютере: ${p} страниц, на каждой ${l} строк, в каждой строке ${c} символов. Каждый символ кодируется ${b} битами. Определите информационный объём рассказа в Кбайтах.`, answer: ans, explain: `${p} × ${l} × ${c} = ${p * l * c} символов × ${b / 8} байт = ${bytes} байт = ${ans} Кбайт.`}; },
    picture(r) { const w = pick(r, [64, 128, 256, 320, 512, 640, 1024]), h = pick(r, [64, 128, 256, 480, 512]), i = pick(r, [1, 2, 4, 8, 16, 24]), colors = 2 ** i, bits = w * h * i, kb = bits / 8 / 1024;
      if (!Number.isInteger(kb) || i === 24) return i === 24 && Number.isInteger(bits / 8 / 1024) ? {text: `Фотография ${w}×${h} пикселей хранится в режиме True Color: 24 бита на пиксель. Сколько Кбайт она занимает (без сжатия)?`, answer: bits / 8 / 1024, explain: `${w} × ${h} × 24 = ${bits} бит = ${bits / 8} байт = ${bits / 8 / 1024} Кбайт.`} : null;
      return {text: `Растровое изображение размером ${w}×${h} пикселей использует палитру из ${colors} цветов. Сколько Кбайт занимает изображение без сжатия?`, answer: kb, explain: `Цвет одного пикселя: i = log₂${colors} = ${i} бит. Всего ${w} × ${h} × ${i} = ${bits} бит = ${bits / 8} байт = ${kb} Кбайт.`}; },
    palette(r) { const w = pick(r, [64, 128, 256]), h = pick(r, [64, 128, 256]), i = pick(r, [1, 2, 4, 8]), kb = w * h * i / 8 / 1024; if (!Number.isInteger(kb)) return null;
      return {text: `Изображение ${w}×${h} пикселей занимает ${kb} Кбайт. Какое наибольшее количество цветов может быть в его палитре?`, answer: 2 ** i, explain: `${kb} Кбайт = ${kb * 1024 * 8} бит. На пиксель: ${kb * 1024 * 8} / (${w} × ${h}) = ${i} бит, значит цветов 2^${i} = ${2 ** i}.`}; },
    sound(r) { const f = pick(r, [8, 16, 32, 48]), d = pick(r, [8, 16, 24]), t = pick(r, [8, 16, 32, 64, 128]), ch = pick(r, [1, 2]); const bits = f * 1000 * d * t * ch, kb = bits / 8 / 1024; if (!Number.isInteger(kb)) return null;
      return {text: `Звук записан ${ch === 2 ? 'в стерео (два канала)' : 'в моно (один канал)'} с частотой дискретизации ${f} кГц и глубиной кодирования ${d} бит. Запись длится ${t} секунд. Сколько Кбайт она занимает без сжатия?`, answer: kb, explain: `${f}000 × ${d} × ${t} × ${ch} = ${bits} бит = ${bits / 8} байт = ${kb} Кбайт.`}; },
    channel(r) { const speed = pick(r, [256, 512, 1024, 2048, 4096]), kb = pick(r, [8, 16, 32, 64, 128, 256]), sec = kb * 1024 * 8 / speed; if (!Number.isInteger(sec)) return null;
      return {text: `Файл размером ${kb} Кбайт передаётся по каналу связи со скоростью ${speed} бит в секунду. Сколько секунд займёт передача?`, answer: sec, explain: `${kb} Кбайт = ${kb * 1024 * 8} бит; ${kb * 1024 * 8} / ${speed} = ${sec} с.`}; },
    resend(r) { const s1 = pick(r, [512, 1024, 2048]), t = pick(r, [16, 32, 64]), s2 = pick(r, [256, 512, 1024, 4096]), bits = s1 * t, t2 = bits / s2; if (!Number.isInteger(t2) || s1 === s2) return null;
      return {text: `Файл передаётся через соединение со скоростью ${s1} бит/с за ${t} секунд. Сколько секунд займёт передача того же файла через соединение со скоростью ${s2} бит/с?`, answer: t2, explain: `Размер файла: ${s1} × ${t} = ${bits} бит. Новое время: ${bits} / ${s2} = ${t2} с.`}; },
  };
  const LEVELS = [
    ['Единицы измерения', 'units', 'Переводи биты, байты, килобайты и мегабайты.'],
    ['Мощность алфавита', 'alphabet', 'Сколько бит нужно на один символ?'],
    ['Сколько символов?', 'power', 'По длине кода найди размер алфавита.'],
    ['Объём сообщения', 'message', 'Алфавитный подход: объём = количество символов × бит на символ.'],
    ['Книга в памяти', 'book', 'Объём текста: страницы × строки × символы × кодировка.'],
    ['Картинка', 'picture', 'Объём растрового изображения: пиксели × бит на пиксель.'],
    ['Палитра', 'palette', 'По объёму картинки найди количество цветов.'],
    ['Звук', 'sound', 'Объём звука: частота × глубина × время × каналы.'],
    ['Канал связи', 'channel', 'Время передачи = объём / скорость.'],
    ['Другая скорость', 'resend', 'Тот же файл — другой канал связи.'],
  ].map(([title, gen, brief]) => ({title, gen, brief}));
  const problems = (lv, seed) => { const r = rng(seed * 313 + LEVELS.indexOf(lv) * 53), out = []; while (out.length < 3) { const p = G[lv.gen](r); if (p && Number.isFinite(p.answer) && p.answer > 0) out.push(p); } return out; };
  const same = (p, a) => String(a).trim() !== '' && Math.abs(Number(String(a).trim().replace(',', '.')) - p.answer) < 1e-9;
  function check(lv, ans) {
    if (!ans || !Number.isInteger(ans.seed) || !Array.isArray(ans.answers) || ans.answers.length !== 3) return {ok: false, msg: 'Ответь на все три варианта.'};
    const good = problems(lv, ans.seed).filter((p, i) => same(p, ans.answers[i])).length; return good ? {ok: true, stars: good, msg: `Верных ответов: ${good} из 3.`} : {ok: false, msg: 'Ни одного верного ответа — разбери решения и попробуй снова.'};
  }
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), box = el('div', 'lab-panel og-box'), msg = el('p', 'lab-msg'), dots = el('div', 'og-dots'); let seed = Math.floor(Math.random() * 1e6), ps = problems(lv, seed), k = 0, answers = [], forced = null;
    task.append(el('h2', '', lv.title), el('p', '', lv.brief + ' Три варианта подряд: каждый верный ответ — звезда. Ответ — число (дробную часть пиши через запятую).'));
    const paint = () => dots.replaceChildren(...[0, 1, 2].map(i => el('i', i < answers.length ? (same(ps[i], answers[i]) ? 'good' : 'bad') : i === k ? 'now' : '')));
    function show() { paint();
      if (k >= 3) { const r = check(lv, {seed, answers}); if (r.ok) api.finish(r.stars, r.msg); else { msg.textContent = r.msg; msg.className = 'lab-msg bad'; box.append(button('Новые варианты', 'lab-main', () => { seed++; ps = problems(lv, seed); k = 0; answers = []; show(); })); } return; }
      const p = ps[k], form = el('form', 'og-form'), inp = el('input'); inp.autocomplete = 'off'; inp.inputMode = 'decimal'; inp.setAttribute('aria-label', 'Ответ'); const go = button('Ответить', 'lab-main', () => form.requestSubmit()); go.dataset.act = 'run'; form.append(el('span', '', 'Ответ:'), inp, go);
      form.addEventListener('submit', e => { e.preventDefault(); if (forced) { const r = check(lv, forced); if (r.ok) api.finish(r.stars, r.msg); return; } if (!inp.value.trim()) return; answers.push(inp.value); const ok = same(p, inp.value); k++; paint(); box.querySelector('.bt-cargo')?.classList.add(ok ? 'loaded' : 'dropped');
        msg.className = 'lab-msg ' + (ok ? 'good' : 'bad'); msg.textContent = (ok ? 'Верно! ' : `Неверно, правильный ответ: ${String(p.answer).replace('.', ',')}. `) + p.explain; const next = button(k < 3 ? 'Следующий груз →' : 'Итог', 'lab-main', show); form.replaceWith(next); next.focus(); });
      const kind = {units: 'box', alphabet: 'box', power: 'box', message: 'box', book: 'crate', picture: 'crate', palette: 'crate', sound: 'container', channel: 'flash', resend: 'flash'}[lv.gen] || 'box', cargo = new Image(); cargo.src = `art/cargo_${kind}.webp?v=1`; cargo.alt = ''; cargo.className = 'bt-cargo';
      box.replaceChildren(el('p', 'lab-eyebrow', `ГРУЗ ${k + 1} ИЗ 3`), cargo, el('p', 'og-text', p.text), form, msg); msg.textContent = ''; msg.className = 'lab-msg'; setTimeout(() => inp.focus(), 50); }
    host.append(task, dots, box); show(); if (api.debugHost) window.labSet = a => { forced = a; };
  }
  LAB.register({id: 'bytes', bg: 'bg_bytes', hero: 'host_docker', title: 'Порт данных', genre: 'измерение информации', art: '📦', color: '#ffb347', unit: 'Задание', minutes: 40,
    about: 'Робот-грузчик пакует тексты, картинки и звуки в контейнеры, а ты считаешь их объём: биты и байты, алфавитный подход, книги, изображения, звук и скорость передачи.',
    levels: () => LEVELS, mount, check, solve: lv => ({seed: 1, answers: problems(lv, 1).map(p => String(p.answer))}), LEVELS, problems});
})();
