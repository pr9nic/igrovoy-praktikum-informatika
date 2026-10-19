// «Город данных»: жители города хранятся в таблице. Чтобы помочь городу, нужно составить запрос: отобрать, упорядочить, посчитать.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const FIELDS = {name: ['Имя', 'text'], age: ['Возраст', 'num'], job: ['Профессия', 'text'], district: ['Район', 'text'], pay: ['Зарплата', 'num'], exp: ['Стаж', 'num']};
  const ROWS = [['Аня', 34, 'врач', 'Север', 72, 9], ['Борис', 45, 'пожарный', 'Порт', 58, 20], ['Вика', 27, 'учитель', 'Центр', 41, 4], ['Глеб', 52, 'инженер', 'Север', 90, 28], ['Дина', 23, 'повар', 'Порт', 35, 2],
    ['Егор', 39, 'водитель', 'Центр', 47, 15], ['Жанна', 49, 'пожарный', 'Север', 55, 8], ['Захар', 60, 'врач', 'Центр', 95, 35], ['Ира', 29, 'инженер', 'Порт', 68, 6], ['Костя', 48, 'учитель', 'Север', 50, 24],
    ['Лена', 36, 'повар', 'Центр', 38, 12], ['Марк', 25, 'пожарный', 'Порт', 44, 3], ['Нина', 55, 'водитель', 'Порт', 52, 30], ['Олег', 42, 'инженер', 'Центр', 84, 18], ['Полина', 28, 'врач', 'Порт', 63, 5], ['Рома', 33, 'водитель', 'Север', 46, 10]]
    .map((r, id) => ({id, name: r[0], age: r[1], job: r[2], district: r[3], pay: r[4], exp: r[5]}));
  const OPS = {'=': (a, b) => a === b, '≠': (a, b) => a !== b, '>': (a, b) => a > b, '<': (a, b) => a < b, '≥': (a, b) => a >= b, '≤': (a, b) => a <= b};
  const SQLOP = {'=': '=', '≠': '<>', '>': '>', '<': '<', '≥': '>=', '≤': '<='}, AGG = {count: 'COUNT', sum: 'SUM', avg: 'AVG', max: 'MAX', min: 'MIN'}, AGGNAME = {count: 'сколько строк', sum: 'сумма', avg: 'среднее', max: 'наибольшее', min: 'наименьшее'};
  const COL = {name: 'имя', age: 'возраст', job: 'профессия', district: 'район', pay: 'зарплата', exp: 'стаж'};
  function exec(q, rows = ROWS) {
    const conds = (q.where || []).filter(c => c && c.f), pass = r => !conds.length || (q.join === 'or' ? conds.some(c => OPS[c.op](r[c.f], c.v)) : conds.every(c => OPS[c.op](r[c.f], c.v)));
    let out = rows.filter(pass);
    if (q.agg) { const v = out.map(r => r[q.agg.f]); if (q.agg.fn === 'count') return {value: out.length}; if (!v.length) return {value: null};
      return {value: q.agg.fn === 'sum' ? v.reduce((a, b) => a + b, 0) : q.agg.fn === 'avg' ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : q.agg.fn === 'max' ? Math.max(...v) : Math.min(...v)}; }
    if (q.order) out = [...out].sort((a, b) => (a[q.order.f] < b[q.order.f] ? -1 : a[q.order.f] > b[q.order.f] ? 1 : 0) * (q.order.dir === 'desc' ? -1 : 1));
    if (q.limit) out = out.slice(0, q.limit);
    return {rows: out.map(r => r.id)};
  }
  const val = v => typeof v === 'string' ? `'${v}'` : v;
  const sql = q => { const conds = (q.where || []).filter(c => c && c.f); return 'SELECT ' + (q.agg ? `${AGG[q.agg.fn]}(${q.agg.fn === 'count' ? '*' : COL[q.agg.f]})` : '*') + '\nFROM жители' + (conds.length ? '\nWHERE ' + conds.map(c => `${COL[c.f]} ${SQLOP[c.op]} ${val(c.v)}`).join(q.join === 'or' ? ' OR ' : ' AND ') : '') + (!q.agg && q.order ? `\nORDER BY ${COL[q.order.f]}${q.order.dir === 'desc' ? ' DESC' : ''}` : '') + (!q.agg && q.limit ? `\nLIMIT ${q.limit}` : ''); };
  const W = (f, op, v) => ({f, op, v}), L = (title, story, ref, tools) => ({title, story, ref, tools});
  // tools — какие части запроса открыты на уровне: w1/w2 — условия, order, limit, agg.
  const LEVELS = [
    L('Перепись района', 'Мэрия проверяет район Север. Покажи всех, кто там живёт.', {where: [W('district', '=', 'Север')]}, ['w1']),
    L('Опытные горожане', 'Совету ветеранов нужны все жители старше 40 лет.', {where: [W('age', '>', 40)]}, ['w1']),
    L('Вызов врачей', 'В городе эпидемия простуды. Найди всех врачей.', {where: [W('job', '=', 'врач')]}, ['w1']),
    L('Пожар в порту', 'В районе Порт горит склад! Нужны пожарные именно из этого района.', {where: [W('job', '=', 'пожарный'), W('district', '=', 'Порт')], join: 'and'}, ['w1', 'w2']),
    L('Школьная прививка', 'На прививку в школу зовут учителей и врачей — и тех, и других.', {where: [W('job', '=', 'учитель'), W('job', '=', 'врач')], join: 'or'}, ['w1', 'w2']),
    L('От младших к старшим', 'Для городского парада построй всех жителей по возрасту, начиная с самых молодых.', {order: {f: 'age', dir: 'asc'}}, ['order']),
    L('Три главных налогоплательщика', 'Казначею нужны трое жителей с самой большой зарплатой, от большей к меньшей.', {order: {f: 'pay', dir: 'desc'}, limit: 3}, ['order', 'limit']),
    L('Сколько инженеров', 'Городу нужен новый мост. Одно число: сколько в городе инженеров?', {where: [W('job', '=', 'инженер')], agg: {fn: 'count', f: 'age'}}, ['w1', 'agg']),
    L('Достаток центра', 'Какова средняя зарплата жителей района Центр?', {where: [W('district', '=', 'Центр')], agg: {fn: 'avg', f: 'pay'}}, ['w1', 'agg']),
    L('Старший расчёта', 'Командиром пожарного расчёта назначают самого старшего по возрасту пожарного. Кто это?', {where: [W('job', '=', 'пожарный')], order: {f: 'age', dir: 'desc'}, limit: 1}, ['w1', 'order', 'limit']),
    L('Фонд столовой', 'Сколько город платит всем учителям и поварам вместе? Нужна сумма зарплат.', {where: [W('job', '=', 'учитель'), W('job', '=', 'повар')], join: 'or', agg: {fn: 'sum', f: 'pay'}}, ['w1', 'w2', 'agg']),
    L('Молодые таланты', 'Премию дают тем, кто младше 30 лет и при этом получает больше 50.', {where: [W('age', '<', 30), W('pay', '>', 50)], join: 'and'}, ['w1', 'w2']),
    L('Рекорд за рулём', 'Какой самый большой стаж среди водителей?', {where: [W('job', '=', 'водитель')], agg: {fn: 'max', f: 'exp'}}, ['w1', 'agg']),
    L('Наставники для новичков', 'Нужны двое самых опытных жителей из районов Север или Порт: сначала с наибольшим стажем.', {where: [W('district', '=', 'Север'), W('district', '=', 'Порт')], join: 'or', order: {f: 'exp', dir: 'desc'}, limit: 2}, ['w1', 'w2', 'order', 'limit']),
  ];
  function check(lv, q) {
    if (!q || typeof q !== 'object') return {ok: false, msg: 'Составь запрос.'};
    const want = exec(lv.ref, lv.rows || ROWS), got = exec(q, lv.rows || ROWS);
    if ('value' in want) { if (!('value' in got)) return {ok: false, msg: 'Городу нужно одно число, а запрос вернул список жителей. Включи подсчёт.'}; if (got.value !== want.value) return {ok: false, msg: `Получилось ${got.value}, но это не то число.`}; }
    else { if ('value' in got) return {ok: false, msg: 'Нужен список жителей, а не одно число. Выключи подсчёт.'};
      const a = got.rows, b = want.rows, ordered = !!lv.ref.order, same = a.length === b.length && (ordered ? a.every((x, i) => x === b[i]) : [...a].sort().join() === [...b].sort().join());
      if (!same) return {ok: false, msg: a.length > b.length ? 'В списке есть лишние жители.' : a.length < b.length ? 'Кого-то не хватает в списке.' : ordered && [...a].sort().join() === [...b].sort().join() ? 'Люди те, но порядок не тот.' : 'В список попали не те жители.'}; }
    return {ok: true, stars: 3, msg: 'Запрос верный.'};
  }

  function mount(host, lv, api) {
    const {el, button} = api, R = lv.rows || ROWS, q = {where: [null, null], join: 'and', order: null, limit: null, agg: null}; let tries = 0;
    const task = el('div', 'lab-task'); task.append(el('h2', '', lv.title), el('p', '', lv.story));
    const pick = (opts, value, fn, label) => { const s = el('select'); s.setAttribute('aria-label', label); for (const [v, t] of opts) { const o = el('option', '', t); o.value = v; s.append(o); } s.value = value; s.addEventListener('change', () => fn(s.value)); return s; };
    const fieldOpts = [['', '— поле —']].concat(Object.entries(FIELDS).map(([k, v]) => [k, v[0]])), numFields = Object.entries(FIELDS).filter(([, v]) => v[1] === 'num').map(([k, v]) => [k, v[0]]);
    const build = el('div', 'db-build'), code = el('pre', 'lab-code'), msg = el('p', 'lab-msg'), result = el('div', 'db-result'), tbody = el('tbody');
    const has = t => lv.tools.includes(t);
    function draw() {
      build.replaceChildren();
      const cond = i => { const c = q.where[i] || {f: '', op: '=', v: ''}, row = el('div', 'db-row'); row.dataset.cond = i; row.append(el('span', 'db-key', i ? '' : 'Отобрать, где'));
        if (i) row.append(pick([['and', 'И (оба условия)'], ['or', 'ИЛИ (хотя бы одно)']], q.join, v => { q.join = v; upd(); }, 'Связка условий'));
        row.append(pick(fieldOpts, c.f, v => { q.where[i] = v ? {f: v, op: '=', v: FIELDS[v][1] === 'num' ? 30 : [...new Set(R.map(r => r[v]))].sort()[0]} : null; draw(); }, 'Поле условия ' + (i + 1)));
        if (c.f) { const num = FIELDS[c.f][1] === 'num'; row.append(pick((num ? ['=', '≠', '>', '<', '≥', '≤'] : ['=', '≠']).map(o => [o, o]), c.op, v => { c.op = v; upd(); }, 'Сравнение'));
          if (num) { const inp = el('input'); inp.type = 'number'; inp.value = c.v; inp.min = 0; inp.max = 200; inp.setAttribute('aria-label', 'Значение'); inp.addEventListener('input', () => { c.v = Number(inp.value) || 0; upd(); }); row.append(inp); }
          else row.append(pick([...new Set(R.map(r => r[c.f]))].sort().map(v => [v, v]), c.v, v => { c.v = v; upd(); }, 'Значение')); }
        return row; };
      if (has('w1')) build.append(cond(0)); if (has('w2')) build.append(cond(1));
      if (has('agg')) { const row = el('div', 'db-row'); row.append(el('span', 'db-key', 'Посчитать'), pick([['', '— ничего, показать список —']].concat(Object.entries(AGGNAME)), q.agg ? q.agg.fn : '', v => { q.agg = v ? {fn: v, f: q.agg ? q.agg.f : 'pay'} : null; draw(); }, 'Подсчёт'));
        if (q.agg && q.agg.fn !== 'count') row.append(pick(numFields, q.agg.f, v => { q.agg.f = v; upd(); }, 'Поле подсчёта')); build.append(row); }
      if (has('order')) { const row = el('div', 'db-row'); row.append(el('span', 'db-key', 'Упорядочить по'), pick(fieldOpts, q.order ? q.order.f : '', v => { q.order = v ? {f: v, dir: q.order ? q.order.dir : 'asc'} : null; draw(); }, 'Поле порядка'));
        if (q.order) row.append(pick([['asc', 'по возрастанию'], ['desc', 'по убыванию']], q.order.dir, v => { q.order.dir = v; upd(); }, 'Направление')); build.append(row); }
      if (has('limit')) { const row = el('div', 'db-row'); row.append(el('span', 'db-key', 'Взять первых'), pick([['', 'всех']].concat([1, 2, 3, 4, 5].map(n => [String(n), String(n)])), q.limit ? String(q.limit) : '', v => { q.limit = Number(v) || null; upd(); }, 'Сколько строк')); build.append(row); }
      upd();
    }
    const clean = () => ({where: q.where.filter(Boolean), join: q.join, order: q.order, limit: q.limit, agg: q.agg});
    function upd() { code.textContent = sql(clean()); const r = exec(clean(), R); for (const tr of tbody.children) tr.classList.toggle('hit', !('value' in r) && r.rows.includes(Number(tr.dataset.id)));
      if ('value' in r) result.replaceChildren(el('span', '', 'Результат запроса: '), el('b', '', r.value == null ? 'нет данных' : String(r.value)));
      else result.replaceChildren(el('span', '', `Запрос выбрал строк: ${r.rows.length}. `), el('b', '', r.rows.map(id => R[id].name).join(', ') || '—')); msg.textContent = ''; msg.className = 'lab-msg'; }
    const go = button(lv.author ? 'Это правильный ответ →' : 'Отправить запрос городу', 'lab-main', () => { if (lv.author) { lv.author(clean()); return; } tries++; const r = check(lv, clean()); if (r.ok) { const stars = tries === 1 ? 3 : tries === 2 ? 2 : 1; msg.textContent = r.msg; msg.className = 'lab-msg good'; api.finish(stars, `Верный запрос с ${tries}-й попытки.`); } else { msg.textContent = r.msg + ' Подсвеченные строки показывают, что выбирает запрос сейчас.'; msg.className = 'lab-msg bad'; } }); go.dataset.act = 'run';
    const table = el('table', 'lab-table'), head = el('tr'); for (const [, [name]] of Object.entries(FIELDS)) head.append(el('th', '', name)); const th = el('thead'); th.append(head);
    for (const r of R) { const tr = el('tr'); tr.dataset.id = r.id; for (const k of Object.keys(FIELDS)) { const td = el('td', k === 'name' ? 'db-who' : '', String(r[k])); if (k === 'name' && !lv.rows) { const im = new Image(); im.className = 'db-face'; im.alt = ''; im.src = `art/resident_${r.id}.webp?v=1`; im.addEventListener('error', () => im.remove()); td.prepend(im); } tr.append(td); } tbody.append(tr); } table.append(th, tbody);
    const left = el('div', 'lab-panel'), right = el('div', 'lab-panel'), cols = el('div', 'lab-cols');
    left.append(el('h3', '', 'Запрос'), build, el('h3', '', 'Так запрос выглядит на языке SQL'), code, result, go, msg, el('p', 'lab-note', 'Три звезды — за верный запрос с первой отправки. До отправки можно менять запрос сколько угодно: таблица сразу показывает, кого он выбирает.'));
    const wrap = el('div', 'db-scroll'); wrap.append(table); right.append(el('h3', '', 'Таблица «жители» · зарплата в тысячах, стаж в годах'), wrap); cols.append(left, right); host.append(task, cols); draw();
    if (api.debugHost) window.labSet = ref => { Object.assign(q, {where: [ref.where?.[0] || null, ref.where?.[1] || null], join: ref.join || 'and', order: ref.order || null, limit: ref.limit || null, agg: ref.agg || null}); draw(); };
  }
  // «Свой город»: ученик заполняет таблицу, пишет вопрос и составляет запрос-ответ; получается код загадки для одноклассника.
  const ALL = ['w1', 'w2', 'agg', 'order', 'limit'];
  const encode = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))), decode = t => JSON.parse(decodeURIComponent(escape(atob(t.trim()))));
  function validRows(rows) { return Array.isArray(rows) && rows.length >= 3 && rows.length <= 12 && rows.every((r, i) => r && r.id === i && ['name', 'job', 'district'].every(k => typeof r[k] === 'string' && r[k].trim() && r[k].length <= 20) && ['age', 'pay', 'exp'].every(k => Number.isInteger(r[k]) && r[k] >= 0 && r[k] <= 200)); }
  function extra(api) {
    const {el, button} = api, box = el('div', 'lab-panel db-own'), stage = el('div'), msg = el('p', 'lab-msg');
    const start = [['Лиса', 30, 'врач', 'Лес', 50, 6], ['Ёж', 12, 'почтальон', 'Поле', 20, 2], ['Сова', 70, 'учитель', 'Лес', 45, 40], ['Барсук', 41, 'строитель', 'Холм', 60, 15], ['Заяц', 9, 'почтальон', 'Поле', 18, 1]];
    const sub = (lv, done) => { const host = el('div', 'db-sub'); mount(host, lv, {el, button, debugHost: false, finish: (st, text) => done(text)}); return host; };
    function author() {
      const rows = start.map((r, id) => ({id, name: r[0], age: r[1], job: r[2], district: r[3], pay: r[4], exp: r[5]})), table = el('table', 'lab-table db-edit'), question = el('textarea'); question.rows = 2; question.maxLength = 200; question.placeholder = 'Вопрос для одноклассника: например, «Кто из почтальонов самый опытный?»'; question.setAttribute('aria-label', 'Вопрос');
      const draw = () => { const h = el('tr'); for (const [k, [name]] of Object.entries(FIELDS)) h.append(el('th', '', name)); h.append(el('th')); table.replaceChildren(h);
        rows.forEach((r, i) => { const tr = el('tr'); for (const [k, [, type]] of Object.entries(FIELDS)) { const td = el('td'), inp = el('input'); inp.value = r[k]; inp.setAttribute('aria-label', FIELDS[k][0] + ' ' + (i + 1)); if (type === 'num') { inp.type = 'number'; inp.min = 0; inp.max = 200; } else inp.maxLength = 20; inp.addEventListener('input', () => { r[k] = type === 'num' ? Math.max(0, Math.min(200, Math.round(Number(inp.value) || 0))) : inp.value.trim(); }); td.append(inp); tr.append(td); }
          const x = button('×', 'lab-small', () => { if (rows.length > 3) { rows.splice(i, 1); rows.forEach((q, j) => { q.id = j; }); draw(); } }); x.setAttribute('aria-label', 'Убрать строку'); const td = el('td'); td.append(x); tr.append(td); table.append(tr); }); };
      const add = button('+ строка', 'lab-small', () => { if (rows.length < 12) { rows.push({id: rows.length, name: 'Новый житель', age: 20, job: 'врач', district: 'Лес', pay: 30, exp: 3}); draw(); } });
      const next = button('Дальше: составить ответ →', 'lab-main', () => { if (!validRows(rows) || question.value.trim().length < 8) { msg.textContent = 'Нужно от 3 до 12 строк без пустых клеток и вопрос не короче 8 знаков.'; msg.className = 'lab-msg bad'; return; } msg.textContent = '';
        stage.replaceChildren(el('p', 'lab-note', 'Составь запрос, который правильно отвечает на твой вопрос, и нажми «Это правильный ответ».'), sub({title: 'Ответ на твою загадку', story: question.value.trim(), tools: ALL, rows: rows.map(r => ({...r})), author: ref => {
          const code = encode({v: 1, q: question.value.trim(), rows, ref}), out = el('textarea', 'db-code'); out.readOnly = true; out.value = code; out.rows = 3; out.setAttribute('aria-label', 'Код загадки');
          stage.replaceChildren(el('p', 'lab-msg good', 'Загадка готова! Скопируй код и передай однокласснику: он вставит его ниже в «Решить загадку».'), out, button('Скопировать код', 'lab-small', () => { out.select(); try { navigator.clipboard.writeText(code); } catch { document.execCommand('copy'); } }), button('Сделать ещё одну', 'lab-small', author)); }}, () => {})); });
      draw(); stage.replaceChildren(el('p', 'lab-note', 'Заполни таблицу своего города (от 3 до 12 жителей) и задай вопрос.'), table, add, question, next, msg);
    }
    function solve() {
      const inp = el('textarea', 'db-code'); inp.rows = 3; inp.placeholder = 'Вставь код загадки от одноклассника'; inp.setAttribute('aria-label', 'Код загадки');
      const go = button('Открыть загадку', 'lab-main', () => { let d; try { d = decode(inp.value); } catch { d = null; }
        if (!d || d.v !== 1 || typeof d.q !== 'string' || !validRows(d.rows) || !d.ref || typeof d.ref !== 'object') { msg.textContent = 'Код не читается: проверь, что скопирован целиком.'; msg.className = 'lab-msg bad'; return; } msg.textContent = '';
        stage.replaceChildren(sub({title: 'Загадка одноклассника', story: d.q, tools: ALL, rows: d.rows, ref: d.ref}, text => { stage.prepend(el('p', 'lab-msg good', 'Верно! Ты разгадал загадку. ' + text)); })); });
      stage.replaceChildren(inp, go, msg);
    }
    const bar = el('div', 'lab-bar'); bar.style.justifyContent = 'flex-start'; bar.append(button('Придумать загадку', 'lab-small', author), button('Решить загадку одноклассника', 'lab-small', solve));
    box.append(el('h3', '', 'Свой город (без звёзд): придумай таблицу и вопрос для одноклассника'), bar, stage); return box;
  }
  LAB.register({id: 'dbcity', bg: 'bg_dbcity', hero: 'host_mayor', title: 'Город данных', genre: 'запросы к таблице', art: '🏙', color: '#8f7bff', unit: 'Задание', minutes: 40,
    about: 'Жители города записаны в таблицу. Пожар, эпидемия, парад — чтобы помочь, составь запрос: отбери нужных людей, упорядочи, посчитай. Рядом видно тот же запрос на SQL.',
    levels: grade => grade <= 7 ? LEVELS.slice(0, 10) : LEVELS, mount, check, extra, solve: lv => JSON.parse(JSON.stringify(lv.ref)), exec, ROWS, encode, decode, validRows});
})();
