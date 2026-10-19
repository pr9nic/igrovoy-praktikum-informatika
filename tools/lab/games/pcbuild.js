// «Собери компьютер»: устройство компьютера (7 класс §2.1–2.2, 10 класс §7).
// Сборка системного блока (деталь → своё гнездо), роли устройств (ввод, вывод, хранение, обработка),
// подбор конфигурации под задачу и бюджет, цикл работы процессора по принципам фон Неймана.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const PART = {cpu: ['Процессор', 'обработка данных'], ram: ['Оперативная память', 'хранит программу и данные во время работы'], ssd: ['Накопитель SSD', 'хранит файлы долго'], gpu: ['Видеокарта', 'строит изображение'],
    board: ['Материнская плата', 'соединяет всё шинами'], psu: ['Блок питания', 'даёт энергию'], monitor: ['Монитор', 'вывод изображения'], keyboard: ['Клавиатура', 'ввод текста']};
  // Гнёзда на схеме: где стоит деталь (в процентах от поля).
  const SLOT = {board: [8, 10, 56, 74], cpu: [24, 20, 14, 18], ram: [42, 16, 9, 30], gpu: [20, 56, 32, 12], ssd: [70, 14, 20, 16], psu: [70, 60, 22, 22], monitor: [86, 8, 13, 22], keyboard: [84, 74, 15, 12]};
  const ROLE = {input: 'Ввод', output: 'Вывод', store: 'Хранение', proc: 'Обработка'};
  const DEV = {input: ['клавиатура', 'мышь', 'микрофон', 'сканер', 'веб-камера', 'джойстик', 'сенсорная панель'], output: ['монитор', 'принтер', 'колонки', 'наушники', 'проектор'], store: ['SSD-накопитель', 'жёсткий диск', 'флешка', 'карта памяти', 'оптический диск'], proc: ['процессор', 'видеокарта (графический процессор)', 'контроллер']};
  const L = o => o;
  const LEVELS = [
    L({kind: 'build', title: 'Сердце компьютера', brief: 'Поставь на материнскую плату процессор и оперативную память.', parts: ['board', 'cpu', 'ram']}),
    L({kind: 'build', title: 'Системный блок', brief: 'Собери системный блок: плата, процессор, память, накопитель и блок питания.', parts: ['board', 'cpu', 'ram', 'ssd', 'psu']}),
    L({kind: 'build', title: 'Рабочее место', brief: 'Собери компьютер целиком: всё из системного блока, видеокарта, монитор и клавиатура.', parts: ['board', 'cpu', 'ram', 'ssd', 'psu', 'gpu', 'monitor', 'keyboard']}),
    L({kind: 'roles', title: 'Кто чем занят', brief: 'Разложи устройства по назначению: ввод, вывод, хранение, обработка.', n: 8}),
    L({kind: 'roles', title: 'Сложные случаи', brief: 'Ещё раз по ролям — устройств больше, есть хитрые.', n: 12}),
    L({kind: 'config', title: 'Компьютер для учёбы', brief: 'Собери компьютер для учёбы: браузер, документы, Python. Бюджет — 60 тыс. ₽. Нужно не меньше 8 Гбайт памяти и SSD.', budget: 60, need: {ram: 8, ssd: true}, prefer: 'дешевле'}),
    L({kind: 'config', title: 'Станция видеомонтажа', brief: 'Компьютер для монтажа видео: нужно не меньше 32 Гбайт памяти, мощная видеокарта и SSD от 1 Тбайт. Бюджет — 180 тыс. ₽.', budget: 180, need: {ram: 32, gpu: 2, disk: 1000, ssd: true}, prefer: 'дешевле'}),
    L({kind: 'cycle', title: 'Как работает процессор', brief: 'Расставь шаги выполнения команды по порядку (принципы фон Неймана).'}),
  ];
  const OPTS = {cpu: [['Двухъядерный 2,4 ГГц', 6, 1], ['Шестиядерный 3,6 ГГц', 18, 2], ['Двенадцатиядерный 4,5 ГГц', 40, 3]], ram: [['4 Гбайт', 2, 4], ['8 Гбайт', 4, 8], ['16 Гбайт', 7, 16], ['32 Гбайт', 13, 32]],
    disk: [['HDD 1 Тбайт', 4, 1000, false], ['SSD 512 Гбайт', 5, 512, true], ['SSD 1 Тбайт', 9, 1000, true], ['SSD 2 Тбайт', 17, 2000, true]], gpu: [['Встроенная графика', 0, 0], ['Игровая видеокарта', 35, 1], ['Профессиональная видеокарта', 70, 2]]};
  const BASE = 20;   // корпус, плата, блок питания
  const CYCLE = ['Выборка: команда читается из оперативной памяти по адресу из счётчика команд', 'Счётчик команд увеличивается — указывает на следующую команду', 'Дешифровка: устройство управления определяет, что делать', 'Выполнение: арифметико-логическое устройство выполняет операцию', 'Результат записывается в регистр или в память'];
  const pickDevs = (n, seed) => { const all = Object.entries(DEV).flatMap(([role, list]) => list.map(d => [d, role])); let s = seed; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280; return all.map(x => [x, r()]).sort((a, b) => a[1] - b[1]).slice(0, n).map(x => x[0]); };
  function cfgCost(c) { return BASE + OPTS.cpu[c.cpu][1] + OPTS.ram[c.ram][1] + OPTS.disk[c.disk][1] + OPTS.gpu[c.gpu][1]; }
  function cfgOk(lv, c) { const n = lv.need, why = [];
    if (OPTS.ram[c.ram][2] < (n.ram || 0)) why.push(`памяти меньше ${n.ram} Гбайт`); if (n.ssd && !OPTS.disk[c.disk][3]) why.push('нужен SSD'); if (n.disk && OPTS.disk[c.disk][2] < n.disk) why.push('мало места на диске'); if (n.gpu && OPTS.gpu[c.gpu][2] < n.gpu) why.push('слабая видеокарта');
    if (cfgCost(c) > lv.budget) why.push(`дороже бюджета (${cfgCost(c)} тыс.)`); return why; }
  function cheapest(lv) { let best = null; for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) for (let d = 0; d < 4; d++) for (let g = 0; g < 3; g++) { const c = {cpu: a, ram: b, disk: d, gpu: g}; if (!cfgOk(lv, c).length && (!best || cfgCost(c) < cfgCost(best))) best = c; } return best; }
  function check(lv, ans) {
    if (lv.kind === 'build') { const bad = lv.parts.filter(p => (ans || {})[p] !== p); return bad.length ? {ok: false, msg: `Не на своём месте: ${bad.map(p => PART[p][0]).join(', ')}.`} : {ok: true, stars: 3, msg: 'Всё на своих местах — компьютер включается!'}; }
    if (lv.kind === 'roles') { const devs = pickDevs(lv.n, LEVELS.indexOf(lv) + 7), bad = devs.filter(([d, r]) => (ans || {})[d] !== r); return bad.length ? {ok: false, msg: `Ошибок: ${bad.length}.`, bad: bad.map(x => x[0])} : {ok: true, stars: 3, msg: 'Все устройства разложены верно.'}; }
    if (lv.kind === 'config') { const c = ans || {}; if ([c.cpu, c.ram, c.disk, c.gpu].some(x => !Number.isInteger(x))) return {ok: false, msg: 'Выбери все комплектующие.'}; const why = cfgOk(lv, c); if (why.length) return {ok: false, msg: 'Не подходит: ' + why.join(', ') + '.'};
      const best = cfgCost(cheapest(lv)), mine = cfgCost(c); return {ok: true, stars: mine <= best ? 3 : mine <= best + 10 ? 2 : 1, msg: `Подходит! Стоимость ${mine} тыс. ₽ (самая выгодная подходящая сборка — ${best} тыс.).`}; }
    const order = ans || []; return order.length === CYCLE.length && order.every((x, i) => x === i) ? {ok: true, stars: 3, msg: 'Верно: выборка → счётчик → дешифровка → выполнение → запись.'} : {ok: false, msg: 'Порядок неверный. Подумай: откуда процессор узнаёт, какую команду выполнять?'};
  }
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'); let tries = 0, ans = lv.kind === 'cycle' ? [] : {};
    task.append(el('h2', '', lv.title), el('p', '', lv.brief)); host.append(task);
    const done = r => { msg.textContent = r.msg; msg.className = 'lab-msg ' + (r.ok ? 'good' : 'bad'); if (r.ok) api.finish(r.stars === 3 ? (tries === 1 ? 3 : tries <= 3 ? 2 : 1) : r.stars, r.msg); };
    const go = button(lv.kind === 'build' ? '⚡ Включить' : 'Проверить', 'lab-main', () => { tries++; const r = check(lv, lv.kind === 'cycle' ? ans.slice() : {...ans}); done(r); if (r.ok && lv.kind === 'build') board.classList.add('pc-on'); }); go.dataset.act = 'run';
    const img = n => { const i = new Image(); i.src = `art/pc_${n}.webp?v=1`; i.alt = PART[n] ? PART[n][0] : ''; return i; };
    let board;
    if (lv.kind === 'build') {
      let chosen = null; board = el('div', 'pc-board'); const tray = el('div', 'pc-tray');
      const draw = () => { board.replaceChildren(el('div', 'pc-bus')); for (const s of lv.parts) { const [x, y, w, h] = SLOT[s], slot = el('div', 'pc-slot' + (ans[s] ? ' full' : '')); slot.style.cssText = `left:${x}%;top:${y}%;width:${w}%;height:${h}%`; slot.dataset.slot = s; slot.append(el('small', '', PART[s][0]));
          if (ans[s]) { const im = img(ans[s]); slot.append(im); } slot.addEventListener('click', () => { if (chosen) { for (const k in ans) if (ans[k] === chosen) delete ans[k]; ans[s] = chosen; chosen = null; } else if (ans[s]) delete ans[s]; draw(); }); board.append(slot); }
        tray.replaceChildren(...lv.parts.filter(p => !Object.values(ans).includes(p)).map(p => { const b = button('', 'pc-part' + (chosen === p ? ' on' : ''), () => { chosen = p; draw(); }); b.dataset.part = p; b.append(img(p), el('small', '', PART[p][0])); b.title = PART[p][1]; return b; }));
        if (!tray.children.length) tray.append(el('p', 'lab-note', 'Все детали на местах. Нажми «Включить».')); };
      host.append(el('p', 'lab-note', 'Выбери деталь в лотке, затем щёлкни по её гнезду на схеме. Наведи на деталь — увидишь, зачем она нужна.'), board, tray, go, msg); draw();
      if (api.debugHost) window.labSet = a => { Object.assign(ans, a); draw(); };
    } else if (lv.kind === 'roles') {
      const devs = pickDevs(lv.n, LEVELS.indexOf(lv) + 7), bins = el('div', 'pc-bins'), pool = el('div', 'pc-pool'); let chosen = null;
      const draw = () => { pool.replaceChildren(...devs.filter(([d]) => !ans[d]).map(([d]) => { const b = button(d, 'pc-dev' + (chosen === d ? ' on' : ''), () => { chosen = d; draw(); }); b.dataset.dev = d; return b; }));
        bins.replaceChildren(...Object.entries(ROLE).map(([r, t]) => { const bx = el('div', 'pc-bin'); bx.dataset.bin = r; bx.append(el('h3', '', t), ...devs.filter(([d]) => ans[d] === r).map(([d]) => { const c = button(d, 'pc-dev in', () => { delete ans[d]; draw(); }); return c; })); bx.addEventListener('click', e => { if (chosen && e.target === bx || chosen && e.target.tagName === 'H3') { ans[chosen] = r; chosen = null; draw(); } }); return bx; })); };
      host.append(el('p', 'lab-note', 'Выбери устройство, затем щёлкни по нужной корзине. Щелчок по устройству в корзине возвращает его обратно.'), pool, bins, go, msg); draw();
      if (api.debugHost) window.labSet = a => { Object.assign(ans, a); draw(); };
    } else if (lv.kind === 'config') {
      const form = el('div', 'pc-cfg'), total = el('p', 'pc-total');
      const upd = () => { const ok = [ans.cpu, ans.ram, ans.disk, ans.gpu].every(Number.isInteger); total.textContent = ok ? `Итого: ${cfgCost(ans)} тыс. ₽ из ${lv.budget}` : `Корпус, плата и блок питания — ${BASE} тыс. ₽. Выбери остальное.`; };
      for (const [k, title] of [['cpu', 'Процессор'], ['ram', 'Оперативная память'], ['disk', 'Накопитель'], ['gpu', 'Видеокарта']]) { const row = el('div', 'pc-row'); row.append(el('h3', '', title));
        OPTS[k].forEach((o, i) => { const b = button(`${o[0]} · ${o[1]} тыс.`, 'pc-opt', () => { ans[k] = i; for (const x of row.querySelectorAll('.pc-opt')) x.classList.toggle('on', x === b); upd(); }); b.dataset.opt = k + i; row.append(b); }); form.append(row); }
      host.append(form, total, go, msg); upd();
      if (api.debugHost) window.labSet = a => { Object.assign(ans, a); for (const k in a) for (const x of form.querySelectorAll(`[data-opt^=${k}]`)) x.classList.toggle('on', x.dataset.opt === k + a[k]); upd(); };
    } else {
      const shuffled = CYCLE.map((t, i) => [t, i]).sort((a, b) => ((a[1] * 7 + 3) % 5) - ((b[1] * 7 + 3) % 5)), list = el('ol', 'pc-cycle'), pool = el('div', 'pc-pool');
      const draw = () => { list.replaceChildren(...ans.map((i, k) => { const li = el('li'); li.append(el('span', '', CYCLE[i]), button('×', 'lab-small', () => { ans.splice(k, 1); draw(); })); return li; }));
        pool.replaceChildren(...shuffled.filter(([, i]) => !ans.includes(i)).map(([t, i]) => { const b = button(t, 'pc-step', () => { ans.push(i); draw(); }); b.dataset.step = i; return b; })); };
      host.append(el('p', 'lab-note', 'Щёлкай шаги в том порядке, в каком их выполняет процессор.'), pool, list, go, msg); draw();
      if (api.debugHost) window.labSet = a => { ans.length = 0; ans.push(...a); draw(); };
    }
  }
  const solve = lv => lv.kind === 'build' ? Object.fromEntries(lv.parts.map(p => [p, p])) : lv.kind === 'roles' ? Object.fromEntries(pickDevs(lv.n, LEVELS.indexOf(lv) + 7)) : lv.kind === 'config' ? cheapest(lv) : CYCLE.map((_, i) => i);
  LAB.register({id: 'pcbuild', bg: 'bg_factory', title: 'Собери компьютер', genre: 'устройство компьютера', art: '🖥', color: '#5cc8ff', unit: 'Задание', minutes: 35,
    about: 'Поставь процессор, память, накопитель и видеокарту в их гнёзда и включи компьютер; разложи устройства по ролям; подбери конфигурацию под задачу и бюджет; разберись, как процессор выполняет команды.',
    levels: () => LEVELS, mount, check, solve, LEVELS, cheapest, cfgCost});
})();
