// «Множества и круги Эйлера»: разложи объекты по кругам (классификация, отношения множеств), затем — задачи на пересечение и объединение
// и запросы к поисковой системе (задание 8 ОГЭ), для старших — три множества и формула включений–исключений.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1)), pick = (r, a) => a[Math.floor(r() * a.length)];
  // Круги: sets — названия кругов, items — [подпись, признаки (по одному на круг)].
  const V = (title, brief, sets, items) => ({kind: 'venn', title, brief, sets, items: items.map(([name, ...flags]) => ({name, mask: flags.reduce((m, f, i) => m | (f ? 1 << i : 0), 0)}))});
  const nums = (list, tests) => list.map(n => [String(n), ...tests.map(t => t(n))]);
  const LEVELS = [
    V('Кто где живёт', 'Разложи животных по кругам: левый круг — «умеет летать», правый — «живёт в воде». Кто не подходит ни под один признак — оставь вне кругов.', ['Летает', 'Живёт в воде'],
      [['🦆 утка', 1, 1], ['🐟 карась', 0, 1], ['🦅 орёл', 1, 0], ['🐕 собака', 0, 0], ['🐬 дельфин', 0, 1], ['🦋 бабочка', 1, 0], ['🐧 пингвин', 0, 1], ['🐈 кошка', 0, 0], ['🦢 лебедь', 1, 1]]),
    V('Ввод и вывод', 'Устройства компьютера: левый круг — устройства ввода, правый — устройства вывода. Есть устройства, которые делают и то и другое, и такие, что не делают ни того, ни другого.', ['Ввод', 'Вывод'],
      [['⌨️ клавиатура', 1, 0], ['🖥 монитор', 0, 1], ['📱 сенсорный экран', 1, 1], ['🖨 принтер', 0, 1], ['🖱 мышь', 1, 0], ['🎤 микрофон', 1, 0], ['🔊 колонки', 0, 1], ['🎧 гарнитура с микрофоном', 1, 1], ['🧠 процессор', 0, 0], ['📷 веб-камера', 1, 0]]),
    V('Чётные и большие', 'Числа: левый круг — чётные, правый — больше 10.', ['Чётные', 'Больше 10'], nums([2, 7, 12, 15, 4, 20, 9, 11, 30], [n => n % 2 === 0, n => n > 10])),
    V('Делимость', 'Три круга: делится на 2, делится на 3, делится на 5. Найди место каждому числу.', ['На 2', 'На 3', 'На 5'], nums([6, 10, 15, 30, 7, 9, 4, 25, 12, 20, 45, 1], [n => n % 2 === 0, n => n % 3 === 0, n => n % 5 === 0])),
    V('Буквы', 'Три круга: гласные буквы; буквы слова КОМПЬЮТЕР; буквы слова ИНФОРМАТИКА.', ['Гласные', 'В «КОМПЬЮТЕР»', 'В «ИНФОРМАТИКА»'],
      ['О', 'К', 'А', 'Ю', 'Р', 'Ф', 'Е', 'Т', 'Б', 'И', 'М', 'Л'].map(c => [c, 'АЕЁИОУЫЭЮЯ'.includes(c), 'КОМПЬЮТЕР'.includes(c), 'ИНФОРМАТИКА'.includes(c)])),
    {kind: 'num', title: 'Кружки класса', brief: 'Задача про пересечение двух множеств.', gen: r => { const n = ri(r, 25, 32), a = ri(r, 10, 18), b = ri(r, 8, 15), both = ri(r, 3, Math.min(a, b) - 2), none = n - (a + b - both);
      return none < 0 ? null : {text: `В классе ${n} учеников. В кружок программирования ходят ${a} человек, в спортивную секцию — ${b}, и туда, и туда — ${both}. Сколько учеников не ходят ни в кружок, ни в секцию?`, answer: none, explain: `Ходят хотя бы куда-то: ${a} + ${b} − ${both} = ${a + b - both}. Не ходят: ${n} − ${a + b - both} = ${none}.`}; }},
    {kind: 'order', title: 'Запросы по возрастанию', brief: 'Как в ОГЭ: расположи запросы к поисковому серверу по возрастанию количества страниц, которые он найдёт. «|» — ИЛИ, «&» — И.', gen: r => {
      const [a, b, c] = pick(r, [['Барокко', 'Классицизм', 'Ампир'], ['Python', 'Pascal', 'Java'], ['Кошки', 'Собаки', 'Хомяки'], ['Фрегат', 'Эсминец', 'Крейсер']]);
      const q = [[`${a} & ${b} & ${c}`, 0], [`${a} & ${b}`, 1], [a, 2], [`${a} | ${b}`, 3], [`${a} | ${b} | ${c}`, 4]].slice(ri(r, 0, 1), ri(r, 4, 5)), letters = 'АБВГД', shuffled = q.map(x => [x, r()]).sort((x, y) => x[1] - y[1]).map(x => x[0]);
      const answer = shuffled.map((x, i) => [x[1], letters[i]]).sort((x, y) => x[0] - y[0]).map(x => x[1]).join('');
      return {text: `Расположите запросы в порядке возрастания количества страниц, которые найдёт поисковый сервер по каждому запросу. Ответ запишите буквами подряд, без пробелов и запятых.\n${shuffled.map((x, i) => `${letters[i]}) ${x[0]}`).join('\n')}`, answer, explain: `«И» сужает поиск (нужны все слова сразу), «ИЛИ» расширяет. Порядок: ${q.map(x => x[0]).join(' → ')}.`}; }},
    {kind: 'num', title: 'Поисковый сервер', brief: 'Задание 8 ОГЭ: найди количество страниц по формуле включений–исключений.', gen: r => { const [a, b] = pick(r, [['Торт', 'Пирог'], ['Луна', 'Марс'], ['Python', 'Pascal']]), A = ri(r, 200, 900), B = ri(r, 200, 900), I = ri(r, 30, Math.min(A, B) - 30), U = A + B - I;
      return {text: `В таблице приведены запросы и количество найденных по ним страниц (в тысячах): «${a} | ${b}» — ${U}; «${a}» — ${A}; «${b}» — ${B}. Сколько страниц (в тысячах) будет найдено по запросу «${a} & ${b}»?`, answer: I, explain: `|${a} & ${b}| = |${a}| + |${b}| − |${a} | ${b}| = ${A} + ${B} − ${U} = ${I}.`}; }},
    {kind: 'num', title: 'Три кружка', brief: 'Три множества: считаем с помощью кругов Эйлера.', gen: r => { const abc = ri(r, 1, 3), ab = abc + ri(r, 1, 3), ac = abc + ri(r, 1, 3), bc = abc + ri(r, 1, 3), a = ab + ac - abc + ri(r, 2, 6), b = ab + bc - abc + ri(r, 2, 6), c = ac + bc - abc + ri(r, 2, 6), U = a + b + c - ab - ac - bc + abc;
      return {text: `Каждый ученик параллели ходит хотя бы в один кружок. Робототехника — ${a} человек, 3D-моделирование — ${b}, программирование — ${c}. В робототехнику и 3D-моделирование ходят ${ab}, в робототехнику и программирование — ${ac}, в 3D-моделирование и программирование — ${bc}, во все три — ${abc}. Сколько учеников в параллели?`, answer: U, explain: `|A ∪ B ∪ C| = |A| + |B| + |C| − |A∩B| − |A∩C| − |B∩C| + |A∩B∩C| = ${a} + ${b} + ${c} − ${ab} − ${ac} − ${bc} + ${abc} = ${U}.`}; }},
    {kind: 'num', title: 'Только один', brief: 'Сколько элементов попадает ровно в одно множество?', gen: r => { const n = ri(r, 25, 30), a = ri(r, 12, 18), b = ri(r, 10, 15), both = ri(r, 3, 8), only = a + b - 2 * both;
      return {text: `Из ${n} учеников ${a} любят информатику, ${b} — математику, ${both} — оба предмета. Сколько учеников любят ровно один из этих двух предметов?`, answer: only, explain: `Только информатику: ${a} − ${both} = ${a - both}; только математику: ${b} − ${both} = ${b - both}; вместе ${only}.`}; }},
  ];
  const variant = (lv, seed) => { const r = rng(seed * 131 + LEVELS.indexOf(lv) * 17); for (;;) { const v = lv.gen(r); if (v) return v; } };
  function check(lv, ans) {
    if (lv.kind === 'venn') { if (!ans || typeof ans !== 'object') return {ok: false, msg: 'Разложи все объекты.'}; const bad = lv.items.filter(it => ans[it.name] !== it.mask);
      return bad.length ? {ok: false, bad: bad.map(x => x.name), msg: `Не на своём месте: ${bad.length}.`} : {ok: true, stars: 3, msg: 'Каждый объект на своём месте.'}; }
    if (!ans || !Number.isInteger(ans.seed)) return {ok: false, msg: 'Нет ответа.'}; const v = variant(lv, ans.seed), got = String(ans.answer ?? '').trim().toUpperCase().replace(/\s+/g, '');
    return (lv.kind === 'num' ? Number(got) === v.answer : got === v.answer) ? {ok: true, stars: 3, msg: v.explain} : {ok: false, msg: `Неверно. ${v.explain}`, want: v.answer};
  }
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'); let tries = 0;
    task.append(el('h2', '', lv.title), el('p', '', lv.brief)); host.append(task);
    const done = r => { msg.textContent = r.msg; msg.className = 'lab-msg ' + (r.ok ? 'good' : 'bad'); if (r.ok) api.finish(tries === 1 ? 3 : tries <= 3 ? 2 : 1, r.msg); };
    if (lv.kind === 'venn') {
      const n = lv.sets.length, place = {}, W = 760, H = n === 2 ? 380 : 520, C = n === 2 ? [[290, 190], [470, 190]] : [[300, 180], [460, 180], [380, 310]], R = n === 2 ? 150 : 140, COL = ['#ff8a5c', '#5cc8ff', '#a77bff'];
      let chosen = null; const tray = el('div', 'st-tray'), NS = 'http://www.w3.org/2000/svg', mk = (t, a, x) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (x != null) e.textContent = x; return e; };
      const svg = mk('svg', {viewBox: `0 0 ${W} ${H}`, class: 'st-svg'}), board = el('div', 'st-board');
      const maskAt = (x, y) => C.reduce((m, [cx, cy], i) => m | ((x - cx) ** 2 + (y - cy) ** 2 < R * R ? 1 << i : 0), 0);
      // Точка для подписи внутри области: перебором сетки находим центр области с нужной маской.
      const spots = {}; for (let y = 10; y < H; y += 6) for (let x = 10; x < W; x += 6) { const m = maskAt(x, y); (spots[m] = spots[m] || []).push([x, y]); }
      const centre = m => { const s = spots[m] || [[W - 80, H - 30]]; const sx = s.reduce((a, p) => a + p[0], 0) / s.length, sy = s.reduce((a, p) => a + p[1], 0) / s.length; return s.reduce((b, p) => (p[0] - sx) ** 2 + (p[1] - sy) ** 2 < (b[0] - sx) ** 2 + (b[1] - sy) ** 2 ? p : b); };
      function draw() {
        svg.replaceChildren(mk('rect', {x: 2, y: 2, width: W - 4, height: H - 4, rx: 18, class: 'st-uni'}), mk('text', {x: 20, y: 30, class: 'st-lbl'}, 'Вне кругов'));
        C.forEach(([cx, cy], i) => svg.append(mk('circle', {cx, cy, r: R, fill: COL[i], 'fill-opacity': 0.16, stroke: COL[i], 'stroke-width': 4}), mk('text', {x: cx + (i === 0 ? -R + 10 : i === 1 ? R - 10 : 0), y: i === 2 ? cy + R + 28 : cy - R - 10, 'text-anchor': i === 0 ? 'start' : i === 1 ? 'end' : 'middle', class: 'st-set', fill: COL[i]}, lv.sets[i])));
        const by = {}; for (const it of lv.items) if (it.name in place) (by[place[it.name]] = by[place[it.name]] || []).push(it);
        // Фишки раскладываются внутри своей области без наложений: ближе к её центру, но не ближе 28 px по высоте к соседям.
        const taken = [];
        for (const [m, list] of Object.entries(by)) { const [cx0, cy0] = centre(+m), pool = (spots[+m] || []).slice().sort((p, q) => Math.hypot(p[0] - cx0, p[1] - cy0) - Math.hypot(q[0] - cx0, q[1] - cy0));
          list.forEach(it => { const w = Math.max(44, it.name.length * 8.5 + 22), fits = ([x, y]) => [-w / 2, w / 2].every(dx => [-12, 12].every(dy => maskAt(x + dx, y + dy) === +m)) && x - w / 2 > 6 && x + w / 2 < W - 6 && y > 44 && y < H - 14 && taken.every(t => Math.abs(t[1] - y) >= 28 || Math.abs(t[0] - x) >= (t[2] + w) / 2 + 6);
            const [x, yy] = pool.find(fits) || pool.find(([x, y]) => taken.every(t => Math.abs(t[1] - y) >= 28 || Math.abs(t[0] - x) >= (t[2] + w) / 2 + 6)) || [cx0, cy0]; taken.push([x, yy, w]);
            const g = mk('g', {class: 'st-chip', 'data-item': it.name}); g.append(mk('rect', {x: x - w / 2, y: yy - 13, width: w, height: 26, rx: 13}), mk('text', {x, y: yy + 5, 'text-anchor': 'middle'}, it.name)); g.addEventListener('click', e => { e.stopPropagation(); delete place[it.name]; chosen = it.name; draw(); }); svg.append(g); }); }
        tray.replaceChildren(...lv.items.filter(it => !(it.name in place)).map(it => { const b = button(it.name, 'st-item' + (chosen === it.name ? ' on' : ''), () => { chosen = it.name; draw(); }); b.dataset.item = it.name; return b; }));
        if (!tray.children.length) tray.append(el('span', 'lab-note', 'Все объекты разложены. Щёлкни по объекту в круге, чтобы переложить его.'));
      }
      svg.addEventListener('click', e => { if (!chosen) return; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); place[chosen] = maskAt(p.x, p.y); chosen = lv.items.find(it => !(it.name in place))?.name || null; draw(); });
      const go = button('Проверить', 'lab-main', () => { tries++; const r = check(lv, {...place}); done(r); if (!r.ok && r.bad) { for (const g of svg.querySelectorAll('.st-chip')) g.classList.toggle('bad', r.bad.includes(g.dataset.item)); } }); go.dataset.act = 'run';
      board.append(el('p', 'lab-note', 'Выбери объект снизу, затем щёлкни по нужной области: в одном круге, на пересечении или вне кругов.'), svg, tray);
      host.append(board, go, msg); chosen = lv.items[0].name; draw();
      if (api.debugHost) window.labSet = a => { Object.assign(place, a); draw(); };
    } else {
      let seed = Math.floor(Math.random() * 1e6), v = variant(lv, seed); const box = el('div', 'lab-panel'), form = el('form', 'og-form'), inp = el('input'); inp.autocomplete = 'off'; inp.placeholder = lv.kind === 'order' ? 'Буквы' : 'Число'; inp.setAttribute('aria-label', 'Ответ');
      const text = el('p', 'og-text', v.text), go = button('Ответить', 'lab-main', () => form.requestSubmit()); go.dataset.act = 'run'; form.append(el('span', '', 'Ответ:'), inp, go);
      const again = button('Другой вариант', 'lab-small', () => { seed++; v = variant(lv, seed); text.textContent = v.text; inp.value = ''; msg.textContent = ''; }); form.append(again);
      form.addEventListener('submit', e => { e.preventDefault(); if (!inp.value.trim()) return; tries++; done(check(lv, {seed, answer: inp.value})); });
      box.append(text, form, msg); host.append(box); setTimeout(() => inp.focus(), 50);
      if (api.debugHost) window.labSet = a => { seed = a.seed; v = variant(lv, seed); text.textContent = v.text; inp.value = a.answer; };
    }
  }
  const solve = lv => lv.kind === 'venn' ? Object.fromEntries(lv.items.map(it => [it.name, it.mask])) : {seed: 5, answer: String(variant(lv, 5).answer)};
  LAB.register({id: 'sets', bg: 'bg_sets', hero: 'host_gardener', title: 'Множества и круги Эйлера', genre: 'множества и логика', art: '⭕', color: '#a77bff', unit: 'Задание', minutes: 40,
    about: 'Разложи животных, устройства, числа и буквы по кругам Эйлера, а потом считай пересечения и объединения — и реши задачи про запросы к поисковой системе, как в ОГЭ.',
    levels: grade => grade <= 7 ? [...LEVELS.slice(0, 7), LEVELS[9]] : LEVELS, mount, check, solve, LEVELS, variant});
})();
