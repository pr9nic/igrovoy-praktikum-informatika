// «Гонка алгоритмов»: робот идёт по полю по программе из команд и повторов. Чем короче программа, тем лучше.
// Одиночные уровни дают звёзды; «Гонка класса» — общее состязание через сервер (tools/lab/server/race_api.py), задание запускает учитель.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0], F = 'F', Lt = 'L', R = 'R', rep = (n, ...body) => ({n, body});
  const size = prog => prog.reduce((s, c) => s + (typeof c === 'string' ? 1 : 1 + size(c.body)), 0);
  // Поле: '.' пол, '#' ящик, 'S' старт, 'G' финиш, '*' батарейка. Победа: собраны все батарейки и робот стоит на финише (если он есть).
  function simulate(map, dir, prog, limit = 400) {
    let x = 0, y = 0; const stars = new Set(); let goal = null;
    map.forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch === 'S') { x = xx; y = yy; } if (ch === '*') stars.add(xx + ',' + yy); if (ch === 'G') goal = xx + ',' + yy; }));
    const path = [{x, y, d: dir}], got = new Set(); let steps = 0, crash = false;
    const run = list => { for (const c of list) { if (crash || steps >= limit) return;
      if (typeof c !== 'string') { for (let i = 0; i < c.n && !crash && steps < limit; i++) run(c.body); continue; }
      steps++; if (c === 'L') dir = (dir + 3) % 4; else if (c === 'R') dir = (dir + 1) % 4; else { const nx = x + DX[dir], ny = y + DY[dir], cell = map[ny] && map[ny][nx]; if (!cell || cell === '#') { crash = true; path.push({x, y, d: dir, crash: true}); return; } x = nx; y = ny; if (stars.has(x + ',' + y)) got.add(x + ',' + y); }
      path.push({x, y, d: dir}); } };
    run(prog);
    const ok = !crash && got.size === stars.size && (goal ? x + ',' + y === goal : stars.size > 0);
    return {ok, path, crash, steps, msg: crash ? 'Робот врезался.' : steps >= limit ? 'Программа слишком долгая.' : got.size < stars.size ? `Собраны не все батарейки: ${got.size} из ${stars.size}.` : ok ? 'Готово.' : 'Робот не дошёл до финиша.'};
  }
  const valid = (prog, depth = 0) => Array.isArray(prog) && depth <= 3 && prog.every(c => c === 'F' || c === 'L' || c === 'R' || (c && typeof c === 'object' && Number.isInteger(c.n) && c.n >= 2 && c.n <= 9 && valid(c.body, depth + 1)));
  // Коридор по образцовой программе: пол только там, где проходит робот, вокруг — ящики.
  function corridor(ref, dir, stars) {
    const cells = [[0, 0]]; let x = 0, y = 0, d = dir; const walk = list => { for (const c of list) { if (typeof c !== 'string') { for (let i = 0; i < c.n; i++) walk(c.body); continue; } if (c === 'L') d = (d + 3) % 4; else if (c === 'R') d = (d + 1) % 4; else { x += DX[d]; y += DY[d]; cells.push([x, y]); } } }; walk(ref);
    const minX = Math.min(...cells.map(c => c[0])), minY = Math.min(...cells.map(c => c[1])), w = Math.max(...cells.map(c => c[0])) - minX + 1, h = Math.max(...cells.map(c => c[1])) - minY + 1, grid = Array.from({length: h}, () => Array(w).fill('#'));
    cells.forEach(([cx, cy], i) => { grid[cy - minY][cx - minX] = stars && i && i % stars === 0 && i < cells.length - 1 ? '*' : '.'; }); grid[cells[0][1] - minY][cells[0][0] - minX] = 'S'; const last = cells[cells.length - 1]; grid[last[1] - minY][last[0] - minX] = 'G';
    return grid.map(r => r.join(''));
  }
  const Lv = (title, brief, dir, ref, map, stars) => ({title, brief, dir, ref, map: map || corridor(ref, dir, stars), par: size(ref)});
  const LEVELS = [
    Lv('Первые шаги', 'Доведи робота до финиша. Команда «вперёд» — один шаг.', 1, [F, F, F, F], ['S...G']),
    Lv('Повтори', 'Путь длинный. Команда «повтори N раз» заменяет много одинаковых команд.', 1, [rep(7, F)], ['S......G']),
    Lv('Поворот', 'Нужно повернуть. Робот поворачивается на месте.', 1, [rep(3, F), R, rep(3, F)], ['S...', '....', '....', '...G']),
    Lv('Лестница', 'Ступеньки одинаковые — значит, одну ступеньку можно повторить.', 1, [rep(3, F, Lt, F, R)]),
    Lv('Квадрат', 'Собери три батарейки по углам. Сторона квадрата повторяется четыре раза — повтор можно вложить в повтор.', 1, [rep(4, rep(3, F), R)], ['S..*', '....', '....', '*..*']),
    Lv('Змейка', 'Коридор петляет. Найди одинаковые куски пути.', 1, [rep(4, F), R, rep(2, F), R, rep(4, F), Lt, rep(2, F), Lt, rep(4, F)]),
    Lv('Улитка', 'Спираль к центру: стороны становятся короче.', 1, [rep(3, rep(4, F), R), rep(2, rep(2, F), R)], ['S....', '####.', '..G#.', '.###.', '.....']),
    Lv('Волна', 'Большие ступени: в каждой — два шага и поворот.', 1, [rep(3, rep(2, F), R, rep(2, F), Lt)]),
    Lv('Диагональ', 'Батарейки лежат по диагонали открытого поля.', 1, [rep(4, F, R, F, Lt)], ['S....', '.*...', '..*..', '...*.', '....*']),
    Lv('Гребёнка', 'Вверх, в сторону, вниз, в сторону — и снова.', 0, [rep(3, rep(3, F), R, F, F, R, rep(3, F), Lt, F, F, Lt)], null, 5),
    Lv('Большая улитка', 'Длинная спираль: сначала три длинные стороны, потом всё короче.', 1, [rep(3, rep(6, F), R), rep(2, rep(4, F), R), rep(2, rep(2, F), R)]),
    Lv('Два манёвра', 'Сначала большие ступени, потом прямая. Собери батарейки по пути.', 1, [rep(2, rep(3, F), R, rep(3, F), Lt), rep(4, F)], null, 5),
  ];
  function check(lv, prog) {
    if (!valid(prog)) return {ok: false, msg: 'Программа составлена неверно.'}; if (!prog.length) return {ok: false, msg: 'Программа пуста.'};
    const r = simulate(lv.map, lv.dir, prog); if (!r.ok) return {ok: false, msg: r.msg, path: r.path};
    const n = size(prog); return {ok: true, stars: n <= lv.par ? 3 : n <= lv.par + 2 ? 2 : 1, size: n, path: r.path, msg: `Команд в программе: ${n}, образец — ${lv.par}.`};
  }

  /* ---------- редактор программы и поле ---------- */
  // Пока программа набирается, она хранится плоским списком: 'F' 'L' 'R', {open: n} — начало повтора, 'E' — конец повтора.
  const toTree = tokens => { const root = [], stack = [root]; for (const t of tokens) { if (t === 'E') { if (stack.length > 1) stack.pop(); } else if (typeof t === 'object') { const node = {n: t.open, body: []}; stack[stack.length - 1].push(node); stack.push(node.body); } else stack[stack.length - 1].push(t); } return root; };
  const toTokens = prog => prog.flatMap(c => typeof c === 'string' ? [c] : [{open: c.n}, ...toTokens(c.body), 'E']);
  const NAME = {F: 'вперёд', L: 'налево', R: 'направо'}, text = (prog, pad = '') => prog.map(c => typeof c === 'string' ? pad + NAME[c] : `${pad}повтори ${c.n} раз:\n${text(c.body, pad + '    ') || pad + '    …'}`).join('\n');
  const IMG = {}; let artAsked = false;
  function art() { if (artAsked || typeof Image === 'undefined') return; artAsked = true; const v = document.getElementById('assignmentData').dataset.art || ''; for (const n of ['race_robot', 'race_crate', 'race_flag', 'race_floor', 'race_floor2', 'race_star']) { const i = new Image(); i.onload = () => { IMG[n] = i; }; i.src = `art/${n}.webp?v=${v}`; } }
  function stage(api, map, dir) {
    art(); const {el} = api, cv = el('canvas', 'ra-field'), w = map[0].length, h = map.length, T = Math.max(34, Math.min(72, Math.floor(620 / Math.max(w, h)))); cv.width = w * T; cv.height = h * T; const g = cv.getContext('2d'); let timer = 0;
    const draw = (p, got) => { g.fillStyle = '#0a0d18'; g.fillRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = map[y][x], px = x * T, py = y * T; if (IMG.race_floor2 || IMG.race_floor) g.drawImage(IMG.race_floor2 || IMG.race_floor, px, py, T, T); else { g.fillStyle = (x + y) % 2 ? '#2a3550' : '#313d5c'; g.fillRect(px, py, T, T); }
        if (ch === '#') { if (IMG.race_crate) g.drawImage(IMG.race_crate, px + 2, py + 2, T - 4, T - 4); else { g.fillStyle = '#6b5a2a'; g.fillRect(px + 4, py + 4, T - 8, T - 8); } }
        if (ch === 'G') { if (IMG.race_flag) g.drawImage(IMG.race_flag, px + 3, py + 3, T - 6, T - 6); else { g.fillStyle = '#3fba74'; g.beginPath(); g.arc(px + T / 2, py + T / 2, T * 0.34, 0, 7); g.fill(); } }
        if (ch === '*' && !(got && got.has(x + ',' + y))) { if (IMG.race_star) g.drawImage(IMG.race_star, px + T * 0.2, py + T * 0.2, T * 0.6, T * 0.6); else { g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(px + T / 2, py + T / 2, T * 0.2, 0, 7); g.fill(); } } }
      g.save(); g.translate(p.x * T + T / 2, p.y * T + T / 2); g.rotate(p.d * Math.PI / 2); if (IMG.race_robot) { const rw = T * 0.92, rh = rw * IMG.race_robot.height / IMG.race_robot.width; g.drawImage(IMG.race_robot, -rw / 2, -rh / 2, rw, rh); } else { g.fillStyle = p.crash ? '#ff5a5a' : '#4aa8ff'; g.beginPath(); g.moveTo(0, -T * 0.36); g.lineTo(T * 0.28, T * 0.3); g.lineTo(-T * 0.28, T * 0.3); g.closePath(); g.fill(); } g.restore();
      if (p.crash) { g.fillStyle = 'rgba(255,60,60,.3)'; g.fillRect(p.x * T, p.y * T, T, T); } };
    const start = () => { let s = {x: 0, y: 0, d: dir}; map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'S') s = {x, y, d: dir}; })); return s; };
    let playing = false; const reset = () => { clearInterval(timer); playing = false; draw(start()); }; reset(); setTimeout(() => { if (!playing) draw(start()); }, 700);   // второй раз — когда догрузились картинки
    return {cv, reset, play(path, done) { clearInterval(timer); playing = true; let i = 0; const got = new Set(); timer = setInterval(() => { const p = path[i++]; if (!p) { clearInterval(timer); playing = false; done && done(); return; } if (map[p.y][p.x] === '*') got.add(p.x + ',' + p.y); draw(p, got); }, Math.max(45, Math.min(170, 9000 / path.length))); }, stop: () => clearInterval(timer)};
  }
  function editor(api, onChange) {
    const {el, button} = api, tokens = [], box = el('div', 'ra-editor'), view = el('pre', 'lab-code ra-prog'), info = el('p', 'ra-size'), bar = el('div', 'ra-keys');
    const depth = () => tokens.reduce((d, t) => d + (typeof t === 'object' ? 1 : t === 'E' ? -1 : 0), 0);
    const upd = () => { const tree = toTree(tokens); view.textContent = text(tree) || 'Программа пуста. Добавляй команды кнопками или клавишами.'; info.textContent = `Команд: ${size(tree)}` + (depth() > 0 ? ` · открыт повтор (уровень ${depth()}) — новые команды попадают внутрь` : ''); endBtn.disabled = depth() <= 0; onChange && onChange(); };
    const push = t => { if (tokens.length >= 80 || (typeof t === 'object' && depth() >= 3)) return; if (t === 'E' && depth() <= 0) return; tokens.push(t); upd(); };
    const add = (label, t, key) => { const b = button(label, 'ra-cmd', () => push(typeof t === 'function' ? t() : t)); b.dataset.cmd = key; bar.append(b); return b; };
    add('↑ вперёд', 'F', 'F'); add('← налево', 'L', 'L'); add('→ направо', 'R', 'R');
    const count = el('select'); count.setAttribute('aria-label', 'Сколько раз повторить'); for (let n = 2; n <= 9; n++) { const o = el('option', '', String(n)); o.value = n; count.append(o); } count.value = 3;
    add('повтори', () => ({open: Number(count.value)}), 'rep'); bar.append(count, el('span', 'ra-x', 'раз')); const endBtn = add('↓ конец повтора', 'E', 'E');
    bar.append(button('⌫ убрать', 'lab-small', () => { tokens.pop(); upd(); }), button('Очистить', 'lab-small', () => { tokens.length = 0; upd(); }));
    const onKey = e => { if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return; const k = e.key; if (k === 'ArrowUp') push('F'); else if (k === 'ArrowLeft') push('L'); else if (k === 'ArrowRight') push('R'); else if (k === 'ArrowDown') push('E'); else if (/^[2-9]$/.test(k)) push({open: Number(k)}); else if (k === 'Backspace') { tokens.pop(); upd(); } else return; e.preventDefault(); };
    document.addEventListener('keydown', onKey); box.append(bar, info, view, el('p', 'lab-note', 'Клавиши: стрелки ↑ ← → — команды, цифра 2–9 — начать повтор, ↓ — закончить повтор, Backspace — убрать последнюю, Enter — запустить.')); upd();
    return {box, get: () => toTree(tokens), set(prog) { tokens.length = 0; tokens.push(...toTokens(prog)); upd(); }, off: () => document.removeEventListener('keydown', onKey)};
  }
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'), st = stage(api, lv.map, lv.dir), ed = editor(api, () => { msg.textContent = ''; }); task.append(el('h2', '', lv.title), el('p', '', lv.brief));
    const go = button('▶ Запустить (Enter)', 'lab-main', () => { const r = check(lv, ed.get()); if (!r.path) { msg.textContent = r.msg; msg.className = 'lab-msg bad'; return; } go.disabled = true; st.play(r.path, () => { go.disabled = false; msg.textContent = r.msg; msg.className = 'lab-msg ' + (r.ok ? 'good' : 'bad'); if (r.ok) api.finish(r.stars, r.msg); }); }); go.dataset.act = 'run';
    const onEnter = e => { if (e.key === 'Enter' && !go.disabled && !document.querySelector('.lab-over:not([hidden])')) { e.preventDefault(); go.click(); } }; document.addEventListener('keydown', onEnter);
    const left = el('div', 'lab-panel'), right = el('div', 'lab-panel'), cols = el('div', 'lab-cols'); left.append(el('h3', '', 'Поле'), st.cv, go, button('Вернуть робота', 'lab-small', st.reset), msg); right.append(el('h3', '', 'Программа'), ed.box, el('p', 'lab-note', `Три звезды — за программу не длиннее ${lv.par} команд. Повтор считается одной командой плюс всё, что внутри.`));
    cols.append(left, right); host.append(task, cols); if (api.debugHost) window.labSet = p => ed.set(p);
    return () => { st.stop(); ed.off(); document.removeEventListener('keydown', onEnter); };
  }

  /* ---------- гонка класса ---------- */
  function extra(api) {
    const {el, button, grade} = api, box = el('div', 'lab-panel ra-race'), API = '/results/api/race/', LETTERS = 'АБВГДЕЖЗИК'; let me = null, timer = 0, st = null, ed = null, taskId = null, state = null;
    const call = async (path, body) => { const r = await fetch(API + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), cache: 'no-store'}); const d = await r.json().catch(() => ({})); if (!r.ok || d.status !== 'ok') { const e = new Error(d.message || 'сервер гонки не отвечает'); e.status = r.status; throw e; } return d; };
    let saved = {}; try { saved = JSON.parse(localStorage.getItem('school4-crew:v1') || '{}'); } catch {}
    const cls = el('select'), name = el('input'), msg = el('p', 'lab-msg'), body = el('div'); cls.setAttribute('aria-label', 'Класс'); name.placeholder = 'Фамилия Имя'; name.maxLength = 80; name.setAttribute('aria-label', 'Фамилия и имя'); if (saved.name) name.value = saved.name;
    for (const l of LETTERS) { const o = el('option', '', `${grade} «${l}»`); o.value = `${grade} «${l}»`; cls.append(o); } if (saved.className && saved.className.startsWith(grade + ' ')) cls.value = saved.className;
    const join = button('Войти в гонку класса', 'lab-main', async () => { const n = name.value.trim().replace(/\s+/g, ' '); if (n.length < 5 || !n.includes(' ')) { msg.textContent = 'Укажи фамилию и имя.'; msg.className = 'lab-msg bad'; return; }
      let prev = null; try { prev = JSON.parse(sessionStorage.getItem('race-me') || 'null'); } catch {}   // ключ прошлого входа из этой вкладки
      try { const d = await call('join', {className: cls.value, name: n, token: prev && prev.className === cls.value && prev.name === n ? prev.token : undefined}); me = {className: cls.value, name: n, id: d.id, token: d.token, teacher: d.teacher}; try { localStorage.setItem('school4-crew:v1', JSON.stringify({className: cls.value, name: n})); sessionStorage.setItem('race-me', JSON.stringify({className: cls.value, name: n, token: d.token})); } catch {} msg.textContent = ''; poll(); clearInterval(timer); timer = setInterval(poll, 2000); }
      catch (e) { msg.textContent = e.message + (e.status === 404 ? ' Гонка класса ещё не подключена к серверу.' : ''); msg.className = 'lab-msg bad'; } }); join.dataset.act = 'race-join';
    const form = el('div', 'ra-join'); form.append(cls, name, join);
    async function poll() { if (!me || !box.isConnected) { clearInterval(timer); return; } try { state = await call('state', {className: me.className, id: me.id, token: me.token}); draw(); } catch (e) { if (e.status === 401) { me = null; clearInterval(timer); msg.textContent = 'Связь с гонкой потеряна — войди заново.'; body.replaceChildren(); } } }
    function draw() {
      const d = state, t = d.task; form.hidden = true; if (api.debugHost) window.labRace = d;
      if (!t) { taskId = null; if (ed) { ed.off(); ed = null; } const wait = el('div'); wait.append(el('p', 'ra-wait', 'Ждём, когда учитель запустит задание…'), board(d)); if (d.teacher) wait.append(teacherBar(d)); body.replaceChildren(wait); return; }
      if (t.id !== taskId) { taskId = t.id; if (ed) ed.off(); st = stage(api, t.map, t.dir); ed = editor(api);
        const send = button('Отправить программу', 'lab-main', async () => { const prog = ed.get(), r = simulate(t.map, t.dir, prog); st.play(r.path, async () => { if (!r.ok) { res.textContent = r.msg; res.className = 'lab-msg bad'; return; } try { const a = await call('submit', {className: me.className, id: me.id, token: me.token, task: t.id, program: prog}); res.textContent = a.best ? `Принято: ${a.size} команд — твой лучший результат.` : `Принято, но твой лучший результат короче: ${a.mine}.`; res.className = 'lab-msg good'; poll(); } catch (e) { res.textContent = e.message; res.className = 'lab-msg bad'; } }); }); send.dataset.act = 'race-send';
        const res = el('p', 'lab-msg'), cols = el('div', 'lab-cols'), left = el('div'), right = el('div'), head = el('p', 'ra-wait'); head.dataset.head = '1'; left.append(st.cv, send, res); right.append(ed.box); cols.append(left, right);
        const side = el('div'); side.dataset.side = '1'; body.replaceChildren(head, cols, side); }
      body.querySelector('[data-head]').textContent = `${t.title} · ${d.phase === 'run' ? `осталось ${Math.floor(t.left / 60)}:${String(t.left % 60).padStart(2, '0')}` : 'время вышло — итоги'}`;
      const side = body.querySelector('[data-side]'); side.replaceChildren(board(d)); if (d.teacher) side.append(teacherBar(d)); const send = body.querySelector('[data-act=race-send]'); if (send) send.disabled = d.phase !== 'run';
    }
    function board(d) { const wrap = el('div'), tb = el('table', 'lab-table'), h = el('tr'); for (const x of ['Место', 'Игрок', 'Команд', 'Время']) h.append(el('th', '', x)); tb.append(h);
      d.board.forEach((r, i) => { const tr = el('tr', r.me ? 'hit' : ''); tr.append(el('td', '', String(i + 1)), el('td', '', r.name), el('td', '', String(r.size)), el('td', '', r.time + ' с')); tb.append(tr); if (r.program) { const tr2 = el('tr'), td = el('td'); td.colSpan = 4; td.append(el('pre', 'lab-code', text(r.program))); tr2.append(td); tb.append(tr2); } });
      wrap.append(el('h3', '', `Таблица гонки · участников: ${d.players}`), d.board.length ? tb : el('p', 'lab-note', 'Пока никто не прислал решение.')); return wrap; }
    function teacherBar(d) { const bar = el('div', 'lab-panel ra-teacher'), sel = el('select'), mins = el('select'); sel.setAttribute('aria-label', 'Задание'); mins.setAttribute('aria-label', 'Минут');
      LEVELS.forEach((l, i) => { const o = el('option', '', `${i + 1}. ${l.title}`); o.value = i; sel.append(o); }); for (const m of [3, 5, 8, 10]) { const o = el('option', '', m + ' мин'); o.value = m; mins.append(o); } mins.value = 5; sel.value = teacherBar.last ?? 3; sel.addEventListener('change', () => { teacherBar.last = sel.value; });
      const act = (action, extra = {}) => call('teacher', {className: me.className, action, ...extra}).then(poll).catch(e => { msg.textContent = e.message; });
      const start = button('▶ Запустить задание', 'lab-main', () => { const l = LEVELS[sel.value]; act('start', {title: l.title, map: l.map, dir: l.dir, minutes: Number(mins.value)}); }); start.dataset.act = 'race-start';
      bar.append(el('h3', '', 'Учителю'), sel, mins, start, button('■ Завершить и показать решения', 'lab-small', () => act('stop')), button('Очистить гонку', 'lab-small', () => act('clear')), el('p', 'lab-note', 'После завершения в таблице у всех появляются программы участников — их удобно разобрать с классом.')); return bar; }
    box.append(el('h3', '', 'Гонка класса (без звёзд)'), el('p', 'lab-note', 'Все решают одно задание, которое запускает учитель. Побеждает самая короткая программа; при равенстве — присланная раньше.'), form, msg, body); return box;
  }
  LAB.register({id: 'race', bg: 'bg_race', hero: 'host_racer', title: 'Гонка алгоритмов', genre: 'оптимизация программ', art: '🏁', color: '#6adf6a', unit: 'Трасса', minutes: 40,
    about: 'Напиши роботу программу из команд и повторов. Дойти мало: побеждает самая короткая программа. Есть гонка всем классом — задание запускает учитель.',
    levels: grade => grade <= 7 ? LEVELS.slice(0, 9) : LEVELS, mount, check, extra, solve: lv => lv.ref, simulate, size, LEVELS});
})();
