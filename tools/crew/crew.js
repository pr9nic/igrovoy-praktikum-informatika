// «Сбой на станции» — сетевая игра для класса в духе Among Us с заданиями по информатике.
// Главное правило интерфейса: экран вредителя ничем не отличается от экрана экипажа.
// Роль и всё секретное показываются мелкой неяркой строкой, только пока зажата клавиша Q.
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('assignmentData').textContent), root = document.getElementById('crew');
  // Ученик, который вошёл в игровой практикум: входим на станцию под его именем, выбрать другое нельзя.
  const LOCK = (() => { try { const w = JSON.parse(sessionStorage.getItem('school4-who') || 'null'); if (w && w.grade === data.grade && w.className && w.name && Date.now() - w.at < 20 * 60000) return w; } catch {} return null; })();
  const API = '/results/api/crew/', LETTERS = 'АБВГДЕЖЗИК', TILE = 44, VIEW_W = 1100, VIEW_H = 620, SIGHT = 6.2, SPEED = 5.2, STORE = 'school4-crew:v1';
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const button = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const debugHost = location.hostname === '127.0.0.1';
  let worlds = {}, quizCtl = null, camMode = false, locked = false;
  let me = null, world = null, state = null, pos = {x: 0, y: 0}, others = new Map(), keys = new Set(), acts = [], chatSeen = 0, chatLog = [], peek = false, alive = true;
  let wipeSeen = null, banner = null, booting = true, bigMap = false, layer = null, mini = null, face = 1, walk = 0, trail = null, art = {}, artReady = null, fogLayer = null;
  let canvas = null, g = null, raf = 0, syncTimer = 0, last = 0, intro = 0, hintTask = 0, pulseFx = [], lastPhase = '', busy = false, ui = {}, failed = 0;

  async function call(path, body) {
    const r = await fetch(API + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(6000)});
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.status !== 'ok') { const e = new Error(d.message || 'сервер не ответил'); e.status = r.status; throw e; }
    return d;
  }

  /* ---------------- вход ---------------- */
  async function login(note) {
    stop();
    let saved = {}; try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch {}
    let info = null; try { const r = await fetch(`/results/api/trainer/classes?slug=trainer-${data.grade}-practicum`, {cache: 'no-store', signal: AbortSignal.timeout(3500)}); info = await r.json(); } catch {}
    const box = el('section', 'cr-login'), form = el('form');
    box.append(el('p', 'cr-eyebrow', `${data.grade} класс · сетевая игра для всего класса`), el('h1', '', 'Сбой на станции'),
      el('p', 'cr-lead', 'На станции «Кодоград-1» завелись вредители. Экипаж чинит системы, решая задачи по информатике, и ищет вредителей на собраниях. Вредители притворяются экипажем и незаметно отключают остальных.'));
    if (info && info.teacher && location.hash.startsWith('#screen-')) { screen(decodeURIComponent(location.hash.slice(8))); return; }
    if (info && info.teacher && /^#pult(-|$)/.test(decodeURIComponent(location.hash)) && !note) { const l = decodeURIComponent(location.hash).slice(6); teacher(`${data.grade} «${LETTERS.includes(l) && l ? l : 'А'}»`); return; }
    if (info && info.teacher) { const t = button('Открыть пульт учителя', 'cr-main', () => teacher(letter.value)); box.append(t, el('p', 'cr-note', 'Вы на учительском ноутбуке: с пульта запускается раунд и видны роли. Чтобы сыграть самому, войдите как ученик ниже.')); }
    const letter = el('select'); letter.setAttribute('aria-label', 'Класс');
    for (const l of LETTERS) { const o = el('option', '', `${data.grade} «${l}»`); o.value = `${data.grade} «${l}»`; letter.append(o); }
    if (saved.className && saved.className.startsWith(data.grade + ' ')) letter.value = saved.className;
    const slot = el('div');
    const names = () => { const list = info?.roster?.[letter.value] || []; slot.replaceChildren();
      if (list.length) { const pick = el('select'); pick.dataset.field = 'name'; pick.setAttribute('aria-label', 'Фамилия и имя'); const none = el('option', '', '— выбери себя —'); none.value = ''; pick.append(none); for (const n of list) { const o = el('option', '', n); o.value = n; pick.append(o); } if (saved.name) pick.value = saved.name; slot.append(pick); }
      else { const input = el('input'); input.dataset.field = 'name'; input.placeholder = 'Фамилия Имя'; input.maxLength = 80; input.autocomplete = 'off'; input.setAttribute('aria-label', 'Фамилия и имя'); if (saved.name) input.value = saved.name; slot.append(input); } };
    letter.addEventListener('change', names); names();
    if (LOCK && !(info && info.teacher)) { letter.value = LOCK.className; slot.replaceChildren(); const fixed = el('input'); fixed.dataset.field = 'name'; fixed.value = LOCK.name; fixed.readOnly = true; fixed.setAttribute('aria-label', 'Фамилия и имя'); slot.append(fixed); letter.disabled = true; }
    const status = el('p', 'cr-status', note || ''); status.setAttribute('role', 'status');
    form.append(el('label', '', 'Класс'), letter, el('label', '', 'Фамилия и имя'), slot, button('Войти на станцию →', 'cr-main', () => form.requestSubmit()), status);
    form.addEventListener('submit', async e => {
      e.preventDefault(); const name = slot.querySelector('[data-field=name]').value.trim().replace(/\s+/g, ' ');
      if (name.length < 5 || !name.includes(' ')) { status.textContent = 'Укажи фамилию и имя.'; return; }
      status.textContent = 'Соединяемся со станцией…';
      // ключ прошлого входа из этой вкладки: после обновления страницы сервер вернёт место, не дожидаясь, пока старая связь пропадёт
      let prev = null; try { prev = JSON.parse(sessionStorage.getItem('crew-me') || 'null'); } catch {}
      try { const d = await call('join', {className: letter.value, name, token: prev && prev.className === letter.value && prev.name === name ? prev.token : undefined}); me = {id: d.id, token: d.token, className: letter.value, name, color: d.color}; setWorlds(d);
        try { localStorage.setItem(STORE, JSON.stringify({className: letter.value, name})); sessionStorage.setItem('crew-me', JSON.stringify({className: letter.value, name, token: d.token})); } catch {} start(); }
      catch (error) { status.textContent = error.message + (error.status === 404 ? ' Сетевая игра ещё не подключена к серверу.' : ''); }
    });
    box.append(form); root.replaceChildren(box);
  }

  // Сервер присылает все локации сразу; какая из них идёт сейчас, говорит поле world в каждом ответе.
  const KIND_BY_NAME = {'Серверная': 'servers', 'Мостик': 'bridge', 'Лаборатория': 'lab', 'Реактор': 'reactor', 'Столовая': 'cafe', 'Медотсек': 'med', 'Склад': 'store', 'Машинный зал': 'engine', 'Архив': 'archive'};
  function setWorlds(d) {
    worlds = d.worlds || {station: {id: 'station', name: 'Станция', theme: 'space', map: d.map, terminals: d.terminals, consoles: d.consoles.map(c => [c[0], c[1], 'reactor']), table: d.table, rooms: d.rooms.map(r => ({...r, kind: KIND_BY_NAME[r.name] || 'lab'}))}};
    world = worlds[d.world] || worlds.station || Object.values(worlds)[0];
  }
  const useWorld = id => { if (id && worlds[id] && worlds[id] !== world) { world = worlds[id]; layer = null; mini = null; trail = null; } };

  /* ---------------- игра ---------------- */
  function start() {
    acts = []; chatSeen = 0; chatLog = []; wipeSeen = null; layer = null; mini = null; bigMap = false; trail = null; others = new Map(); state = null; lastPhase = ''; failed = 0;
    const page = el('section', 'cr-game'), top = el('header', 'cr-top');
    ui.title = el('strong', '', 'Сбой на станции'); ui.phase = el('span', 'cr-phase', 'Соединение…'); ui.bar = el('div', 'cr-bar'); ui.fill = el('i'); ui.bar.append(ui.fill); ui.barText = el('span', 'cr-bartext', '');
    const full = button('⛶ Во весь экран', 'cr-small', () => { if (document.fullscreenElement) document.exitFullscreen(); else page.requestFullscreen().catch(() => {}); }); full.dataset.act = 'full';
    page.addEventListener('fullscreenchange', () => { full.textContent = document.fullscreenElement ? '⛶ Свернуть' : '⛶ Во весь экран'; });
    top.append(ui.title, ui.phase, ui.bar, ui.barText, full, button('Выйти', 'cr-small', () => { if (document.fullscreenElement) document.exitFullscreen(); login(); }));
    const body = el('div', 'cr-body'), stage = el('div', 'cr-stage'); canvas = el('canvas', 'cr-canvas'); canvas.width = VIEW_W; canvas.height = VIEW_H; g = canvas.getContext('2d');
    ui.over = el('div', 'cr-over'); ui.over.hidden = true; ui.alert = el('div', 'cr-alert'); ui.alert.hidden = true; ui.note = el('div', 'cr-teachernote'); ui.note.hidden = true; ui.secret = el('div', 'cr-secret'); ui.tasks = el('ul', 'cr-tasks'); ui.hint = el('div', 'cr-hint');
    stage.append(canvas, ui.tasks, ui.hint, ui.alert, ui.secret, ui.over, ui.note);
    const side = el('aside', 'cr-side'); ui.players = el('ul', 'cr-players'); ui.chat = el('div', 'cr-chat'); ui.chat.setAttribute('aria-live', 'polite'); ui.chatNote = el('p', 'cr-chatnote');
    const form = el('form', 'cr-chatform'); ui.input = el('input'); ui.input.maxLength = 140; ui.input.placeholder = 'Сообщение…'; ui.input.autocomplete = 'off'; ui.input.setAttribute('aria-label', 'Сообщение в чат');
    form.append(ui.input, button('→', 'cr-small', () => form.requestSubmit()));
    form.addEventListener('submit', e => { e.preventDefault(); const text = ui.input.value.trim(); if (text) acts.push({t: 'chat', text}); ui.input.value = ''; });
    side.append(el('h2', '', 'Экипаж'), ui.players, el('h2', '', 'Связь'), ui.chat, ui.chatNote, form);
    body.append(stage, side);
    page.append(top, body, el('p', 'cr-keys', 'Стрелки или W A S D — идти · E — терминал · F — импульс · R — сообщить · цифры и Enter — задания · M — карта · Enter — чат · Q — личное дело (держать)'));
    root.replaceChildren(page);
    loadArt(); last = performance.now(); raf = requestAnimationFrame(frame); syncTimer = setInterval(sync, 230); sync();
  }
  function stop() { cancelAnimationFrame(raf); clearInterval(syncTimer); raf = 0; syncTimer = 0; }

  const typing = () => document.activeElement && document.activeElement.tagName === 'INPUT';
  document.addEventListener('keydown', e => {
    if (!state || !raf) return;
    if (e.key === 'Enter' && !typing() && !ui.input.disabled) { e.preventDefault(); ui.input.focus(); return; }
    if (e.key === 'Escape' || e.key === 'F2') { e.preventDefault(); if (document.activeElement === ui.input) ui.input.blur(); else if (camMode) setCams(false); else if (state.me.quiz) acts.push({t: 'close'}); return; }
    if (state.me.quiz && quizCtl && document.activeElement !== ui.input) { if (quizCtl(e)) e.preventDefault(); return; }
    if (typing()) return;
    const k = e.code;
    if (k === 'KeyQ') { peek = true; e.preventDefault(); return; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(k)) { keys.add(k); e.preventDefault(); return; }
    if (e.repeat) return;
    if (state.me.quiz) return;
    // Все клавиши доступны каждому игроку и выглядят одинаково: что они делают на самом деле, решает сервер.
    if (camMode) { if (k === 'KeyE') setCams(false); return; }
    if (k === 'KeyE') { if (nearCams() && !nearWork()) setCams(true); else acts.push({t: 'use'}); }
    else if (k === 'KeyF') { acts.push({t: 'pulse'}); }
    else if (k === 'KeyG') acts.push({t: 'sabotage', kind: 'reactor'});
    else if (k === 'KeyH') acts.push({t: 'sabotage', kind: 'lights'});
    else if (k === 'KeyJ') acts.push({t: 'sabotage', kind: 'doors'});
    else if (k === 'KeyM') bigMap = !bigMap;
    else if (k === 'KeyR') acts.push({t: 'report'});
  });
  document.addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'KeyQ') peek = false; });
  window.addEventListener('blur', () => { keys.clear(); peek = false; });

  // Запертые двери: клетка двери становится стеной для всех, кроме того, кто уже стоит в проёме.
  const doorSet = () => world.doorSet || (world.doorSet = new Set((world.doors || []).map(([x, y]) => x + ',' + y)));
  const wall = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y), r = world.map[cy]; if (!r || r[cx] !== '.') return true; return locked && doorSet().has(cx + ',' + cy) && !(Math.floor(pos.x) === cx && Math.floor(pos.y) === cy); };
  const nearCams = () => !!world.cams && state && state.phase === 'play' && Math.hypot(world.cams.x + 0.5 - pos.x, world.cams.y + 0.5 - pos.y) < 1.9;
  const nearWork = () => state.me.tasks.some(t => !t.done && Math.hypot(world.terminals[t.i][0] + 0.5 - pos.x, world.terminals[t.i][1] + 0.5 - pos.y) < 1.8);
  const setCams = on => { camMode = on; acts.push({t: 'cams', on}); };
  const free = (x, y) => !wall(x - 0.3, y - 0.3) && !wall(x + 0.3, y - 0.3) && !wall(x - 0.3, y + 0.3) && !wall(x + 0.3, y + 0.3);

  async function sync() {
    if (busy || !me) return; busy = true;
    const send = acts; acts = [];
    try { const d = await call('sync', {className: me.className, id: me.id, token: me.token, x: Math.round(pos.x * 100) / 100, y: Math.round(pos.y * 100) / 100, acts: send, chat: chatSeen}); failed = 0; apply(d); }
    catch (error) { acts = send.filter(a => a.t !== 'chat').concat(acts).slice(0, 8); if (error.status === 401) { login('Связь со станцией потеряна — войди заново.'); } else if (++failed > 12 && ui.phase) ui.phase.textContent = 'Нет связи с сервером…'; }
    busy = false;
  }

  function apply(d) {
    const first = !state; state = d; alive = d.me.alive; booting = first; useWorld(d.world);
    if (first || d.me.moved || d.phase !== 'play') { pos.x = d.me.x; pos.y = d.me.y; }
    for (const p of d.players) { const o = others.get(p.id); if (!o) others.set(p.id, {x: p.x, y: p.y, tx: p.x, ty: p.y}); else { o.tx = p.x; o.ty = p.y; if (Math.abs(o.x - p.x) + Math.abs(o.y - p.y) > 6) { o.x = p.x; o.y = p.y; } } }
    for (const id of [...others.keys()]) if (!d.players.some(p => p.id === id)) others.delete(id);
    for (const id of d.pulses) if (!pulseFx.some(f => f.id === id && performance.now() - f.t < 1900)) { pulseFx.push({id, t: performance.now()}); if (id === me.id) hintTask = performance.now(); }
    if (d.wipe !== wipeSeen) { if (wipeSeen != null) ui.chat.replaceChildren(); wipeSeen = d.wipe; }
    for (const c of d.chat) if (c.id > chatSeen) { chatSeen = c.id; chatLog.push(c); addChat(c); }
    for (const id of d.deleted) ui.chat.querySelector(`[data-id="${id}"]`)?.remove();
    locked = !!d.sabotage && d.sabotage.kind === 'doors'; if (camMode && (d.phase !== 'play' || d.me.quiz || !nearCams())) camMode = false;
    if (d.phase !== lastPhase) { if (d.phase === 'play' && lastPhase !== 'result' && lastPhase !== 'meeting') intro = performance.now(); lastPhase = d.phase; ui.input.blur(); }
    hud();
    // Отладочный перенос на стенде: сервер телепортов не принимает, поэтому место меняет и стенд (/test/crew/place).
    if (debugHost) window.crewGo = async (x, y) => { await fetch('/test/crew/place?' + new URLSearchParams({className: me.className, id: me.id, x, y})).catch(() => {}); pos.x = x; pos.y = y; };
    if (debugHost) window.crew = {phase: d.phase, me: d.me, secret: d.secret, players: d.players, x: pos.x, y: pos.y, meeting: d.meeting, bodies: d.bodies, sabotage: d.sabotage, progress: d.progress, chat: chatLog.length, winner: d.winner};
  }

  function addChat(c) {
    const line = el('p', 'cr-msg' + (c.ch === 'sys' ? ' sys' : c.ch === 'ghost' ? ' ghost' : c.ch === 'teacher' ? ' teacher' : '')); line.dataset.id = c.id;
    if (c.ch === 'teacher') { line.append(el('b', '', 'Учитель: ')); if (!booting) banner = {text: c.text, until: performance.now() + 9000}; }
    else if (c.ch !== 'sys') { const who = el('b', '', c.name.split(' ').slice(0, 2).join(' ') + (c.ch === 'ghost' ? ' (отключён)' : '') + ': '); who.style.color = c.color; line.append(who); }
    line.append(document.createTextNode(c.text)); ui.chat.append(line); while (ui.chat.children.length > 120) ui.chat.firstChild.remove(); ui.chat.scrollTop = ui.chat.scrollHeight;
  }

  const roomOf = (x, y) => (world.rooms.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) || {name: 'Коридор'}).name;
  function hud() {
    const d = state, ph = d.phase;
    ui.phase.textContent = ph === 'lobby' ? 'Сбор экипажа: ждём, когда учитель начнёт раунд' : ph === 'play' ? `Раунд ${d.round} · смена идёт` : ph === 'meeting' ? `Собрание · осталось ${d.meeting.left} с` : ph === 'result' ? 'Итог голосования' : 'Раунд окончен';
    ui.fill.style.width = (d.progress[1] ? d.progress[0] / d.progress[1] * 100 : 0) + '%'; ui.barText.textContent = d.progress[1] ? `Задания экипажа: ${d.progress[0]} из ${d.progress[1]} (обновляется на собраниях)` : '';
    // Список игроков одинаков для всех: имя, цвет, на связи ли, отключён ли (это видно только после собрания или в конце).
    ui.players.replaceChildren(...d.players.map(p => { const li = el('li', (p.alive ? '' : 'out') + (p.on ? '' : ' off')), dot = el('i'); dot.style.background = p.color; li.append(dot, el('span', '', p.name + (p.id === me.id ? ' (ты)' : '')));
      if (ph === 'end') li.append(el('em', p.role === 'imp' ? 'imp' : '', p.role === 'imp' ? 'вредитель' : p.job === 'engineer' ? 'инженер' : p.job === 'medic' ? 'медик' : 'экипаж'), el('small', '', `верно ${p.right} · очки ${p.score}`)); else if (!p.on) li.append(el('small', '', 'нет связи')); return li; }));
    ui.tasks.replaceChildren(...(ph === 'play' ? d.me.tasks.map(t => { const [x, y] = world.terminals[t.i], li = el('li', t.done ? 'done' : '', (t.done ? '✓ ' : '○ ') + roomOf(x, y)); return li; }) : []));
    const ghost = !d.me.alive && ph !== 'lobby' && ph !== 'end', canChat = d.settings.chat && (ph !== 'play' || ghost);
    ui.input.disabled = !canChat; ui.chatNote.textContent = !d.settings.chat ? 'Учитель выключил чат.' : d.me.muted ? 'Учитель отключил тебе чат.' : ghost ? 'Ты отключён: чат отключённых. Живые его не видят. Задания выполняй дальше — они идут в счёт экипажа.' : ph === 'play' ? 'Во время смены связь молчит. Чат откроется на собрании.' : 'Нажми Enter, чтобы писать.';
    ui.note.hidden = !(banner && performance.now() < banner.until); if (!ui.note.hidden) ui.note.textContent = 'Учитель: ' + banner.text;
    ui.alert.hidden = !d.sabotage; if (d.sabotage) ui.alert.textContent = d.sabotage.kind === 'doors' ? `ДВЕРИ ЗАБЛОКИРОВАНЫ: ${d.sabotage.left} с` : d.sabotage.kind === 'lights' ? 'ПОГАС СВЕТ! Почините щиток в электрощите' : `АВАРИЯ РЕАКТОРА! Почините оба пульта в реакторе: осталось ${d.sabotage.left} с · починено ${d.sabotage.fixed.length} из 2`;
    // Личное дело: одинаковая по виду строка у всех, видна только пока зажата Q.
    const s = d.secret, pulse = d.me.pulse > 0 ? `импульс через ${Math.ceil(d.me.pulse)} с` : 'импульс готов';
    // Карточка роли: у всех одного размера и вида, видна только пока зажата Q. Вредителю — пошаговая памятка по приёмам и авариям.
    const st = d.settings || {}, sab = s.sabotage === -2 ? 'выключены учителем' : s.sabotage > 0 ? `будут готовы через ${s.sabotage} с` : 'готовы — можно запускать';
    const lines = !s.role ? [['🗂', 'Личное дело', 'Роль появится в начале раунда. Во время игры зажми Q, чтобы посмотреть свою карточку.']]
      : s.role === 'imp' ? [
        ['🔴', 'Ты — ВРЕДИТЕЛЬ' + (s.partners.length ? ` (напарник: ${s.partners.join(', ')})` : ''), 'Цель: отключить экипаж или устроить аварию реактора, которую не успеют починить. Не выдай себя на собрании.'],
        ['F', `Как отключить («убить») члена экипажа · ${pulse}`, `1) Подойди к игроку почти вплотную (на шаг-два). 2) Нажми F. 3) Он заразится и отключится через ${st.infect || 10} с — сразу уходи, чтобы тебя не видели рядом, когда он упадёт. Перезарядка ${st.cooldown || 25} с. Если рядом никого — импульс уйдёт впустую. Своего напарника заразить нельзя, а медик может вылечить заражённого.`],
        ['G', 'Авария реактора', `Пульты в реакторе мигают красным. Если экипаж не починит их за ${st.sabotageTime || 50} с — победа вредителей.`],
        ['H', 'Погасить свет', 'Экипаж почти ничего не видит, пока кто-то не починит щиток (или 75 с). Хорошее время для импульса.'],
        ['J', 'Заблокировать двери', 'Двери закрыты 15 с: можно отрезать свидетелей или не пустить экипаж к реактору.'],
        ['⏱', `Аварии ${sab}`, 'Одновременно бывает только одна авария, после неё — перезарядка (общая для всех вредителей).'],
        ['🎭', 'Маскировка', 'Ходи к терминалам и нажимай E — тебе дают такие же задания, но в общий счёт они не идут. На собрании спорь и голосуй, как все.'],
        ...(s.last ? [['📝', 'Последнее действие', s.last]] : [])]
      : [
        ['🟢', 'Ты — ЭКИПАЖ' + (s.job === 'engineer' ? ' · ИНЖЕНЕР' : s.job === 'medic' ? ' · МЕДИК' : ''), 'Цель: выполнить все задания на терминалах (E) и вычислить вредителей на собраниях.'],
        ['E', 'Задания и ремонт', 'Подойди к своему терминалу (стрелка на экране) и нажми E — это вопрос по информатике. При аварии чини мигающие пульты тоже клавишей E.'],
        ...(s.job === 'engineer' ? [['🔧', 'Инженер', 'Пульты аварий чинишь сразу, без вопроса.']] : s.job === 'medic' ? [['💉', `Медик · ${pulse}`, 'F рядом с заражённым вылечит его, пока он не отключился.']] : []),
        ['R', 'Собрание', 'Нашёл отключённого — R рядом с ним. У стола на мостике R созывает экстренное собрание.'],
        ['F', `Импульс · ${pulse}`, 'Есть у всех и выглядит одинаково: им можно сбивать с толку вредителей.'],
        ...(s.last ? [['📝', 'Последнее действие', s.last]] : [])];
    const cardKey = JSON.stringify(lines); if (ui.secret.dataset.key !== cardKey) { ui.secret.dataset.key = cardKey; ui.secret.replaceChildren(...lines.map(([k, t, x]) => { const row = el('div', 'cr-srow'); row.append(el('b', 'cr-skey', k), el('div', '', '')); row.lastChild.append(el('strong', '', t), el('span', '', x)); return row; }), el('p', 'cr-snote', 'Отпусти Q, чтобы спрятать карточку.')); }
    ui.secret.classList.toggle('show', peek);
    overlay();
  }

  // Старт раунда голосованием: «Готов» у больше половины игроков на связи — через 5 секунд раунд начнётся сам.
  function readyBox(box, d) {
    const r = d.ready; if (!r || !r.on) { box.append(el('p', 'cr-note', 'Новый раунд начнёт учитель с пульта.')); return; }
    const wrap = el('div', 'cr-ready'), b = button(r.mine ? '✔ Я готов (нажми, чтобы отменить)' : '▶ Готов к раунду', 'cr-main cr-readybtn' + (r.mine ? ' on' : ''), () => acts.push({t: 'ready'})); b.dataset.act = 'ready';
    const bar = el('div', 'cr-rbar'), fill = el('i'); fill.style.width = Math.min(100, 100 * r.votes / Math.max(1, r.need)) + '%'; bar.append(fill);
    wrap.append(b, bar, el('p', 'cr-note', r.startIn >= 0 ? `Экипаж готов! Раунд начнётся через ${r.startIn} с.` : `Готовы ${r.votes} из ${r.need} нужных (на связи ${r.online}). Раунд начнётся сам, когда «Готов» нажмёт больше половины экипажа.`));
    if (r.names.length) wrap.append(el('p', 'cr-note', 'Готовы: ' + r.names.join(', ')));
    box.append(wrap);
  }
  function overlay() {
    const d = state, o = ui.over; let key = (d.paused ? 'P' : '') + d.phase + (d.me.quiz ? 'q' + (d.me.quiz.n || d.me.quiz.q) : '') + (d.me.answer ? 'a' + d.me.answer.t : '') + (d.phase === 'meeting' ? 'm' + d.meeting.voted.length + '|' + d.meeting.mine + '|' + d.players.filter(p => p.alive).length : '') + (d.phase === 'end' ? d.winner : '') + (d.phase === 'lobby' ? d.players.length : '') + (d.ready && d.ready.on ? 'r' + d.ready.votes + d.ready.mine + d.ready.startIn + d.ready.online : '');
    if (d.phase === 'play' && !d.me.quiz && !d.me.answer && !d.paused) { if (!o.hidden) { quizCtl = null; o.replaceChildren(); } o.hidden = true; o.dataset.key = ''; return; }   // вместе с окном исчезает и поле ответа, чтобы клавиши снова управляли героем
    if (d.phase === 'meeting') { const t = o.querySelector('[data-left]'); if (t) t.textContent = d.meeting.left; }
    if (o.dataset.key === key) return; o.dataset.key = key; o.hidden = false; o.className = 'cr-over ' + d.phase;
    const box = el('div', 'cr-box');
    if (d.paused && d.phase === 'play') { box.append(el('p', 'cr-eyebrow', 'ПАУЗА'), el('h2', '', 'Учитель поставил игру на паузу'), el('p', '', 'Все таймеры стоят. Игра продолжится с этого же места.')); }
    else if (d.phase === 'lobby') {
      box.append(el('h2', '', 'Экипаж собирается'), el('p', '', `На связи: ${d.players.filter(p => p.on).length}. Для игры нужно не меньше ${d.settings.minPlayers} игроков.`)); readyBox(box, d);
      const rules = el('ul', 'cr-rules'); for (const r of ['Экипаж: выполни свои задания на терминалах (клавиша E) — это вопросы по информатике.', 'Среди вас вредители. Их экран выглядит так же, как твой. Они отключают экипаж незаметно: отключение срабатывает не сразу.', 'Нашёл отключённого — подойди и нажми R: начнётся собрание с чатом и тайным голосованием.', 'На мостике есть пост наблюдения с камерами (E). У кого-то из экипажа может быть особая роль — инженер или медик: она написана в личном деле.', 'Свою роль узнаешь в начале раунда: зажми Q и прикрой левый нижний угол экрана ладонью.', 'Не подсматривай в соседний экран и не показывай свой: так игра честнее и интереснее.']) rules.append(el('li', '', r));
      box.append(rules);
    } else if (d.phase === 'play' && d.me.quiz) { box.classList.add('quiz'); quizBox(box, d.me.quiz);
    } else if (d.phase === 'play' && d.me.answer) {
      box.classList.add('quiz'); box.append(el('h2', '', d.me.answer.ok ? 'Верно. Система работает.' : 'Неверно.'), el('p', '', d.me.answer.ok ? 'Задание выполнено.' : `Правильный ответ: ${d.me.answer.right}. Терминал перезагружается — попробуй ещё раз через несколько секунд.`));
    } else if (d.phase === 'meeting' || d.phase === 'result') {
      const m = d.meeting, by = d.players.find(p => p.id === m.by); box.classList.add('meet');
      box.append(el('p', 'cr-eyebrow', (d.paused ? 'ПАУЗА · ' : '') + (m.reason === 'body' ? 'НАЙДЕН ОТКЛЮЧЁННЫЙ' : 'ЭКСТРЕННОЕ СОБРАНИЕ')), el('h2', '', m.reason === 'teacher' ? 'Учитель созвал собрание' : m.reason === 'body' ? `${by ? by.name : 'Кто-то'} нашёл отключённого: ${m.body}` : `${by ? by.name : 'Кто-то'} созвал собрание`));
      if (m.result) { box.append(el('p', 'cr-result', m.result.text)); const counts = el('p', 'cr-note', 'Голоса: ' + m.result.counts.map(c => (c.id === 'skip' ? 'пропуск' : (d.players.find(p => p.id === c.id) || {name: '?'}).name) + ' — ' + c.n).join(', ')); box.append(counts); }
      else {
        const t = el('p', 'cr-note'); t.append('Обсуждайте в чате справа. До конца голосования: ', el('b', '', String(m.left)), ' с · проголосовали: ' + m.voted.length); t.querySelector('b').dataset.left = '1'; box.append(t);
        const grid = el('div', 'cr-votes');
        for (const p of d.players) { const b = button('', 'cr-vote' + (p.alive ? '' : ' out') + (m.mine === p.id ? ' mine' : ''), () => acts.push({t: 'vote', id: p.id})); b.dataset.vote = p.id; const dot = el('i'); dot.style.background = p.color; b.append(dot, el('span', '', p.name), el('small', '', !p.alive ? 'отключён' : m.voted.includes(p.id) ? 'проголосовал' : 'думает')); b.disabled = !p.alive || !d.me.alive || m.mine != null; grid.append(b); }
        const skip = button('Пропустить голосование', 'cr-vote skip' + (m.mine === 'skip' ? ' mine' : ''), () => acts.push({t: 'vote', id: 'skip'})); skip.dataset.vote = 'skip'; skip.disabled = !d.me.alive || m.mine != null; grid.append(skip); box.append(grid);
        box.append(el('p', 'cr-note', !d.me.alive ? 'Ты отключён и не голосуешь, но видишь собрание.' : m.mine != null ? 'Голос принят. Он тайный: остальные видят только, что ты проголосовал.' : 'Выбери, кого исключить, или пропусти. Исключают того, у кого больше всех голосов.'));
      }
    } else if (d.phase === 'end') {
      const mine = (d.winners || []).includes(d.players.find(p => p.id === d.me.id)?.name);
      box.append(el('p', 'cr-eyebrow', 'РАУНД ОКОНЧЕН'), el('h2', 'cr-win ' + d.winner, d.winner === 'crew' ? '🛰 Победил экипаж' : '🦠 Победили вредители'), el('p', '', d.why), el('p', 'cr-myres ' + (mine ? 'won' : 'lost'), mine ? 'Твоя сторона победила! +3 очка' : 'Твоя сторона проиграла — в следующий раз получится!'));
      const facts = el('div', 'cr-final'), imp = el('div', 'cr-fimp'), win = el('div', 'cr-fwin');
      imp.append(el('b', '', (d.imps || []).length > 1 ? 'Вредителями были:' : 'Вредителем был:'), el('span', '', (d.imps || []).join(', ') || '—'));
      win.append(el('b', '', 'Победители:'), el('span', '', (d.winners || []).join(', ') || '—')); facts.append(imp, win); box.append(facts);
      readyBox(box, d);
      box.append(el('p', 'cr-note', 'Роли раскрыты в списке справа. Очки: 3 за победу своей стороны и по 1 за каждый верный ответ. Новый раунд начнёт учитель.'));
    }
    if (!(d.phase === 'play' && d.me.quiz && !d.paused)) quizCtl = null;
    o.replaceChildren(box); box.querySelector('.cr-answer')?.focus();
  }

  // Задание на терминале. Типы: choice — выбор из трёх, input — набрать ответ, bits — переключатели, order — расставить по порядку, match — соединить пары.
  // Всё управляется с клавиатуры; quizCtl получает нажатия, пока задание открыто.
  function quizBox(box, q) {
    const type = q.type || 'choice', send = v => acts.push(type === 'choice' ? {t: 'answer', i: v} : {t: 'answer', v}), digit = e => /^(Digit|Numpad)[1-9]$/.test(e.code) ? Number(e.code.slice(-1)) - 1 : -1;
    box.dataset.type = type; box.append(el('p', 'cr-eyebrow', (q.kind === 'fix' ? 'ПОЧИНКА · ' : 'ТЕРМИНАЛ · ') + {choice: 'ВЫБЕРИ ОТВЕТ', input: 'НАБЕРИ ОТВЕТ', bits: 'ПЕРЕКЛЮЧАТЕЛИ', order: 'РАССТАВЬ ПО ПОРЯДКУ', match: 'СОЕДИНИ ПРОВОДА'}[type]), el('h2', '', q.q));
    if (q.code) box.append(el('pre', 'cr-code', q.code));
    let help = 'Esc — отойти от терминала.';
    if (type === 'choice') {
      q.options.forEach((text, i) => { const b = button('', 'cr-opt', () => send(i)); b.dataset.opt = i; b.append(el('b', '', String(i + 1)), el('span', '', text)); box.append(b); });
      quizCtl = e => { const i = digit(e); if (i >= 0 && i < q.options.length && !e.repeat) { send(i); return true; } }; help = 'Клавиши 1, 2, 3 или щелчок. ' + help;
    } else if (type === 'input') {
      const form = el('form', 'cr-answerform'), input = el('input', 'cr-answer'); input.maxLength = 40; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('aria-label', 'Ответ'); input.placeholder = 'ответ';
      form.append(input, button('Ответить ⏎', 'cr-main', () => form.requestSubmit())); form.addEventListener('submit', e => { e.preventDefault(); if (input.value.trim()) send(input.value.trim()); }); box.append(form);
      quizCtl = () => false; help = 'Набери ответ и нажми Enter. ' + help;
    } else if (type === 'bits') {
      const n = q.bits, on = Array(n).fill(false), row = el('div', 'cr-bits'), cells = [];
      const flip = i => { on[i] = !on[i]; cells[i].classList.toggle('on', on[i]); cells[i].querySelector('b').textContent = on[i] ? '1' : '0'; };
      for (let i = 0; i < n; i++) { const b = button('', 'cr-bit', () => flip(i)); b.dataset.bit = i; b.append(el('small', '', String(1 << (n - 1 - i))), el('u', 'cr-lamp'), el('span', 'cr-lever'), el('b', '', '0'), el('i', '', String(i + 1))); cells.push(b); row.append(b); }
      const go = () => send(on.map(v => v ? '1' : '0').join('')); box.append(row, button('Готово ⏎', 'cr-main', go));
      quizCtl = e => { const i = digit(e); if (i >= 0 && i < n && !e.repeat) { flip(i); return true; } if (e.key === 'Enter') { go(); return true; } }; help = `Клавиши 1–${n} переключают разряды (сверху написан вес разряда), Enter — готово. ` + help;
    } else {
      // order: предметы по очереди занимают пронумерованные ячейки; match: щиток с проводами — от каждого левого гнезда тянем провод к правому.
      const items = type === 'order' ? q.items : q.pairs, total = type === 'order' ? items.length : q.left.length, seq = [], colors = ['#ff5a5a', '#ffd34d', '#4ae08a', '#4aa8ff', '#c98bff'];
      const take = i => { if (!seq.includes(i) && seq.length < total) { seq.push(i); draw(); } }, back = () => { seq.pop(); draw(); }, go = () => { if (seq.length === total) send(seq.slice()); };
      const ok = button('Готово ⏎', 'cr-main', go), undo = button('← Отменить', 'cr-small', back), bar = el('div', 'cr-tbar'); bar.append(ok, undo);
      let draw;
      if (type === 'order') {
        const list = el('div', 'cr-pick'), slots = el('div', 'cr-slots'), btns = [];
        items.forEach((text, i) => { const b = button('', 'cr-opt cr-item', () => take(i)); b.dataset.item = i; b.append(el('b', '', String(i + 1)), el('span', '', text)); btns.push(b); list.append(b); });
        draw = () => { btns.forEach((b, i) => b.classList.toggle('used', seq.includes(i))); slots.replaceChildren(...Array.from({length: total}, (_, k) => { const cell = el('div', 'cr-slot' + (k < seq.length ? ' full' : k === seq.length ? ' cur' : '')); cell.append(el('b', '', String(k + 1)), el('span', '', k < seq.length ? items[seq[k]] : k === seq.length ? 'сюда' : '')); return cell; })); ok.disabled = seq.length < total; };
        box.append(list, el('p', 'cr-slotnote', 'Порядок:'), slots, bar);
      } else {
        const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), ROW = 62, H = total * ROW, LX = 232, RX = 448, mk = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text != null) n.textContent = text; return n; };
        svg.setAttribute('viewBox', `0 0 700 ${H}`); svg.setAttribute('class', 'cr-wires'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Щиток с проводами');
        const wires = mk('g', {}), loose = mk('path', {class: 'cr-loose', fill: 'none'}), yOf = k => k * ROW + ROW / 2, curve = (y1, x2, y2) => `M${LX},${y1} C${LX + 90},${y1} ${x2 - 90},${y2} ${x2},${y2}`;
        svg.append(mk('rect', {x: 214, y: 0, width: 252, height: H, rx: 14, class: 'cr-panel'}));
        const lefts = q.left.map((text, k) => { const gr = mk('g', {class: 'cr-wl'}); gr.append(mk('rect', {x: 2, y: yOf(k) - 23, width: 200, height: 46, rx: 10}), mk('text', {x: 102, y: yOf(k) + 5, 'text-anchor': 'middle'}, text), mk('circle', {cx: LX, cy: yOf(k), r: 13, class: 'cr-sock'}), mk('circle', {cx: LX, cy: yOf(k), r: 8, fill: colors[k]}));
          gr.addEventListener('click', () => { if (k < seq.length) { seq.length = k; draw(); } }); svg.append(gr); return gr; });
        const rights = items.map((text, jx) => { const gr = mk('g', {class: 'cr-wr'}); gr.dataset.item = jx; gr.append(mk('rect', {x: 478, y: yOf(jx) - 23, width: 220, height: 46, rx: 10}), mk('circle', {cx: 498, cy: yOf(jx), r: 12, class: 'cr-num'}), mk('text', {x: 498, y: yOf(jx) + 5, 'text-anchor': 'middle', class: 'cr-digit'}, String(jx + 1)),
            mk('text', {x: 518, y: yOf(jx) + 5, class: text.length > 22 ? 'small' : ''}, text), mk('circle', {cx: RX, cy: yOf(jx), r: 13, class: 'cr-sock'}), mk('circle', {cx: RX, cy: yOf(jx), r: 7, class: 'cr-hole'}));
          gr.addEventListener('click', () => take(jx)); svg.append(gr); return gr; });
        svg.append(wires, loose);
        // Свободный конец текущего провода тянется за мышью.
        svg.addEventListener('mousemove', e => { if (seq.length >= total) return; const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * 700 / r.width, y = (e.clientY - r.top) * H / r.height; loose.setAttribute('d', curve(yOf(seq.length), Math.max(LX + 20, Math.min(RX, x)), y)); loose.setAttribute('stroke', colors[seq.length]); });
        svg.addEventListener('mouseleave', () => loose.setAttribute('d', ''));
        draw = () => { wires.replaceChildren(); loose.setAttribute('d', '');
          seq.forEach((jx, k) => { wires.append(mk('path', {d: curve(yOf(k), RX, yOf(jx)), class: 'cr-wire-back', fill: 'none'}), mk('path', {d: curve(yOf(k), RX, yOf(jx)), stroke: colors[k], class: 'cr-wire', fill: 'none'}), mk('circle', {cx: RX, cy: yOf(jx), r: 8, fill: colors[k]})); });
          lefts.forEach((gr, k) => { gr.classList.toggle('cur', k === seq.length); gr.classList.toggle('done', k < seq.length); }); rights.forEach((gr, jx) => gr.classList.toggle('used', seq.includes(jx))); ok.disabled = seq.length < total; };
        box.append(svg, bar);
      }
      draw();
      quizCtl = e => { const i = digit(e); if (i >= 0 && i < items.length && !e.repeat) { take(i); return true; } if (e.key === 'Backspace') { back(); return true; } if (e.key === 'Enter') { go(); return true; } };
      help = (type === 'order' ? 'Нажимай цифры (или щёлкай) в том порядке, в каком должны идти предметы. ' : 'Провод тянется от подсвеченного гнезда слева: нажми цифру нужного гнезда справа или щёлкни по нему. Щелчок по левому гнезду вынимает провод. ') + 'Backspace — отменить, Enter — готово. ' + help;
    }
    help = help.replace('Esc — отойти', 'Esc или F2 — отойти');
    box.append(el('p', 'cr-note', help + ' Пока ты решаешь, ты не видишь, что происходит вокруг.'));
  }

  /* ---------------- отрисовка ---------------- */
  // Станция рисуется один раз в отдельный холст (пол, стены, оформление комнат), а каждый кадр на экран выводится только видимая часть.
  const ROOM_STYLE = {servers: ['#1d3a5c', '#35d8ff'], bridge: ['#27306b', '#8f9bff'], lab: ['#1c4a4a', '#4ae0c0'], reactor: ['#4a2530', '#ff6a5a'], cafe: ['#3a3558', '#ffd34d'], med: ['#1f4a3a', '#6aff9a'], store: ['#4a3a22', '#ffb04a'],
    engine: ['#3a3a44', '#c0c8d8'], archive: ['#3f2a55', '#c98bff'], comms: ['#2a3d5c', '#5ab8ff'], quarters: ['#2f3f4a', '#7fd4c8'], garden: ['#234a2a', '#8aff7a'], dock: ['#3a3f4a', '#ffcf6a'], electro: ['#4a4320', '#ffe14a'], view: ['#1f3d5c', '#5fe0ff'], garage: ['#44403a', '#ffb04a']};
  const THEME = {space: {bg: 'space', hall: 'floor_metal', hull: '#111830', dim: 0.35}, sea: {bg: 'ocean', hall: 'floor_glass', hull: '#0d2a33', dim: 0.2}, moon: {bg: 'moon', hall: 'floor_moon', hull: '#2b2e38', dim: 0.3}};
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; };
  const floorAt = (x, y) => world.map[y] && world.map[y][x] === '.';
  const roomAt = (x, y) => world.rooms.find(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

  function decor(c, r) {
    const T = TILE, cx = (r.x + r.w / 2) * T, cy = (r.y + r.h / 2) * T, [, accent] = ROOM_STYLE[r.kind] || ['#2a3550', '#9fb2d6'];
    c.save(); c.strokeStyle = accent; c.fillStyle = accent; c.lineWidth = 3; c.globalAlpha = 0.2;
    if (r.kind === 'servers') { for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo((r.x + 1) * T, (r.y + 1.5 + i * 1.3) * T); c.bezierCurveTo(cx, (r.y + 0.5 + i * 1.3) * T, cx, (r.y + 2.5 + i * 1.3) * T, (r.x + r.w - 1) * T, (r.y + 1.5 + i * 1.3) * T); c.stroke(); }
      c.globalAlpha = 0.5; for (let i = 0; i < r.w - 2; i += 2) { c.fillStyle = '#0b1220'; c.fillRect((r.x + 1 + i) * T + 6, r.y * T + 4, T - 12, 20); c.fillStyle = i % 4 ? '#35d8ff' : '#6aff9a'; for (let k = 0; k < 3; k++) c.fillRect((r.x + 1 + i) * T + 11 + k * 8, r.y * T + 10, 4, 4); } }
    else if (r.kind === 'bridge') { c.beginPath(); c.arc(cx, (r.y + r.h) * T, r.w * T * 0.36, Math.PI, 0); c.stroke(); c.beginPath(); c.arc(cx, (r.y + r.h) * T, r.w * T * 0.24, Math.PI, 0); c.stroke(); c.globalAlpha = 0.45; for (let i = 0; i < 26; i++) c.fillRect((r.x + 0.5 + (i * 7.31) % (r.w - 1)) * T, (r.y + 0.4 + (i * 3.17) % (r.h - 1.2)) * T, 3, 3); }
    else if (r.kind === 'lab') { for (let yy = 0; yy < r.h; yy++) for (let xx = 0; xx < r.w; xx += 2) { const hx = (r.x + xx + (yy % 2) + 0.5) * T, hy = (r.y + yy + 0.5) * T; c.beginPath(); for (let k = 0; k < 6; k++) c.lineTo(hx + Math.cos(k * Math.PI / 3) * 15, hy + Math.sin(k * Math.PI / 3) * 15); c.closePath(); c.globalAlpha = 0.1; c.stroke(); } }
    else if (r.kind === 'reactor') { for (const rad of [2.6, 1.9, 1.2]) { c.beginPath(); c.arc(cx + T, cy, rad * T, 0, 7); c.stroke(); } c.globalAlpha = 0.3; c.beginPath(); c.arc(cx + T, cy, 0.7 * T, 0, 7); c.fill(); }
    else if (r.kind === 'med') { c.globalAlpha = 0.22; c.fillRect(cx - 14, cy - 50, 28, 100); c.fillRect(cx - 50, cy - 14, 100, 28); c.globalAlpha = 0.12; c.beginPath(); c.arc(cx, cy, 78, 0, 7); c.stroke(); }
    else if (r.kind === 'store') { c.globalAlpha = 0.28; for (const [bx, by, bw, bh] of [[1, 1, 2, 2], [4, 1, 2, 1], [8, 3, 3, 2], [1, 4, 1, 1], [5, 4, 2, 1]]) { c.strokeRect((r.x + bx) * T + 5, (r.y + by) * T + 5, bw * T - 10, bh * T - 10); c.beginPath(); c.moveTo((r.x + bx) * T + 5, (r.y + by) * T + 5); c.lineTo((r.x + bx + bw) * T - 5, (r.y + by + bh) * T - 5); c.stroke(); } }
    else if (r.kind === 'engine') { for (const [gx, gy, rad] of [[cx - 80, cy, 58], [cx + 40, cy - 20, 40], [cx + 110, cy + 50, 30]]) { c.beginPath(); c.arc(gx, gy, rad, 0, 7); c.stroke(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; c.beginPath(); c.moveTo(gx + Math.cos(a) * rad, gy + Math.sin(a) * rad); c.lineTo(gx + Math.cos(a) * (rad + 11), gy + Math.sin(a) * (rad + 11)); c.stroke(); } } }
    else if (r.kind === 'archive') { c.globalAlpha = 0.22; for (let i = 1; i < r.w - 1; i += 2) for (let k = 1; k < r.h - 1; k += 2) { c.fillRect((r.x + i) * T + 8, (r.y + k) * T + 6, T - 16, 6); c.fillRect((r.x + i) * T + 8, (r.y + k) * T + 18, T - 22, 6); c.fillRect((r.x + i) * T + 8, (r.y + k) * T + 30, T - 12, 6); } }
    else if (r.kind === 'cafe') { c.globalAlpha = 0.12; for (let yy = 0; yy < r.h; yy++) for (let xx = (yy % 2); xx < r.w; xx += 2) c.fillRect((r.x + xx) * T, (r.y + yy) * T, T, T); }
    c.restore();
  }

  // Картинки станции (нарисованы нейросетью по описаниям из tools/crew/art/raw/prompts.tsv). Если какая-то не загрузилась, игра рисует эту часть сама.
  const ART = ['floor_metal', 'floor_tiles', 'floor_grate', 'floor_tech', 'floor_carpet', 'floor_garden', 'floor_glass', 'floor_moon', 'wall_panel', 'space', 'ocean', 'moon', 'prop_terminal', 'prop_servers', 'prop_bridge', 'prop_lab', 'prop_reactor', 'prop_medbay', 'prop_crates', 'prop_engine',
    'prop_archive', 'prop_table', 'prop_kitchen', 'prop_console', 'prop_plant', 'prop_comms', 'prop_bunk', 'prop_garden', 'prop_suits', 'prop_electro', 'prop_security', 'prop_lightbox', 'prop_aquarium', 'prop_rover'];
  const FLOOR = {cafe: 'floor_tiles', med: 'floor_tiles', lab: 'floor_tiles', reactor: 'floor_grate', engine: 'floor_grate', store: 'floor_grate', garage: 'floor_grate', dock: 'floor_grate', electro: 'floor_grate', servers: 'floor_tech', bridge: 'floor_tech', archive: 'floor_tech',
    comms: 'floor_tech', view: 'floor_tech', quarters: 'floor_carpet', garden: 'floor_garden'};
  // Мебель по виду комнаты: [картинка, ширина в клетках]. Она сама расставляется вдоль верхней стены там, где нет двери, и ходить не мешает.
  const FURNITURE = {servers: [['prop_servers', 3.6], ['prop_servers', 3.6]], bridge: [['prop_bridge', 5], ['prop_security', 3]], lab: [['prop_lab', 4.2], ['prop_lab', 3.2], ['prop_plant', 1.1]], reactor: [['prop_engine', 2.6], ['prop_plant', 1]], cafe: [['prop_kitchen', 3.4], ['prop_kitchen', 2.6], ['prop_plant', 1.1]],
    med: [['prop_medbay', 3], ['prop_medbay', 2.2], ['prop_plant', 1.1]], store: [['prop_crates', 3.6], ['prop_crates', 2.4], ['prop_crates', 1.8]], engine: [['prop_engine', 3.4], ['prop_engine', 3.4]], archive: [['prop_archive', 4.4], ['prop_archive', 3.6]], comms: [['prop_comms', 3.4], ['prop_security', 2.6], ['prop_plant', 1.1]],
    quarters: [['prop_bunk', 3], ['prop_bunk', 3], ['prop_plant', 1]], garden: [['prop_garden', 3.6], ['prop_garden', 3.2], ['prop_plant', 1.1]], dock: [['prop_suits', 3.6], ['prop_crates', 2]], electro: [['prop_electro', 2.8], ['prop_electro', 2.2]], view: [['prop_aquarium', 4.4], ['prop_aquarium', 3.6]], garage: [['prop_rover', 3.8], ['prop_crates', 2.2], ['prop_plant', 1]]};
  function furnish(r) {            // свободные участки верхней стены -> места для мебели
    const free = []; let from = -1; for (let x = r.x; x <= r.x + r.w; x++) { const wallHere = x < r.x + r.w && !floorAt(x, r.y - 1); if (wallHere && from < 0) from = x; if (!wallHere && from >= 0) { free.push([from, x - from]); from = -1; } }
    const out = []; for (const [name, w] of FURNITURE[r.kind] || []) { const seg = free.sort((a, b) => b[1] - a[1])[0]; if (!seg || seg[1] < w + 0.4) continue; out.push([name, seg[0] + 0.2 + w / 2, w]); seg[0] += w + 0.3; seg[1] -= w + 0.3; } return out;
  }
  function loadArt() {
    if (artReady) return artReady; const v = document.getElementById('assignmentData').dataset.art || '';
    artReady = Promise.all(ART.map(n => new Promise(done => { const i = new Image(); i.onload = () => { art[n] = i; done(); }; i.onerror = done; i.src = `art/${n}.webp?v=${v}`; }))).then(() => { layer = null; });
    return artReady;
  }
  const sprite = (c, name, cx, bottom, w, maxH) => { const i = art[name]; if (!i) return false; let h = w * i.height / i.width; if (maxH && h > maxH) { w *= maxH / h; h = maxH; } c.drawImage(i, cx - w / 2, bottom - h, w, h); return true; };

  function buildLayer() {
    const T = TILE, W = world.map[0].length, H = world.map.length; layer = document.createElement('canvas'); layer.width = W * T; layer.height = H * T; const c = layer.getContext('2d');
    const pattern = name => { if (!art[name]) return null; const p = c.createPattern(art[name], 'repeat'); p.setTransform(new DOMMatrix().scale(T * 4 / art[name].width)); return p; };
    const theme = THEME[world.theme] || THEME.space, bg = art[theme.bg];
    c.fillStyle = '#05070f'; c.fillRect(0, 0, layer.width, layer.height);
    if (bg) { for (let x = 0; x < layer.width; x += 1024) for (let y = 0; y < layer.height; y += 1024) { c.save(); c.translate(x + 512, y + 512); c.scale((x / 1024) % 2 ? -1 : 1, (y / 1024) % 2 ? -1 : 1); c.drawImage(bg, -512, -512, 1024, 1024); c.restore(); } c.fillStyle = `rgba(5,7,15,${theme.dim})`; c.fillRect(0, 0, layer.width, layer.height); }
    else for (let i = 0; i < 420; i++) { const x = (i * 977.3) % layer.width, y = (i * 613.7) % layer.height; c.fillStyle = `rgba(200,220,255,${0.15 + (i % 7) / 14})`; c.fillRect(x, y, i % 9 ? 2 : 3, i % 9 ? 2 : 3); }
    // Корпус станции вокруг пола.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!floorAt(x, y)) { let near = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (floorAt(x + dx, y + dy)) near = true; if (near) { c.fillStyle = theme.hull; c.fillRect(x * T, y * T, T, T); c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(x * T + 3, y * T + 3, T - 6, T - 6); } }
    // Пол: в комнатах — своя текстура с оттенком комнаты, в коридорах — металл.
    const metal = pattern(theme.hall) || pattern('floor_metal'), pats = {};
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (floorAt(x, y)) { const r = roomAt(x, y), base = r ? (ROOM_STYLE[r.kind] || ['#2a3550'])[0] : '#262d42', tex = r ? (pats[FLOOR[r.kind]] ??= pattern(FLOOR[r.kind])) : metal;
      if (tex) { c.fillStyle = tex; c.fillRect(x * T, y * T, T, T); if (r) { c.fillStyle = base; c.globalAlpha = FLOOR[r.kind] === 'floor_tiles' ? 0.5 : FLOOR[r.kind] === 'floor_garden' || FLOOR[r.kind] === 'floor_carpet' ? 0.15 : 0.32; c.fillRect(x * T, y * T, T, T); c.globalAlpha = 1; } }
      else { c.fillStyle = (x + y) % 2 ? base : shade(base, 1.1); c.fillRect(x * T, y * T, T, T); c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1; c.strokeRect(x * T + 0.5, y * T + 0.5, T - 1, T - 1); } }
    for (const r of world.rooms) { const [, accent] = ROOM_STYLE[r.kind] || ['', '#9fb2d6']; if (!art[FLOOR[r.kind]]) decor(c, r); c.strokeStyle = accent; c.globalAlpha = 0.5; c.lineWidth = 3; c.strokeRect(r.x * T + 5, r.y * T + 5, r.w * T - 10, r.h * T - 10); c.globalAlpha = 1;
      c.font = '800 19px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; const tw = c.measureText(r.name.toUpperCase()).width + 22, lx = (r.x + r.w / 2) * T, ly = (r.y + r.h - 0.55) * T; c.fillStyle = 'rgba(8,11,22,.6)'; c.beginPath(); c.roundRect(lx - tw / 2, ly - 14, tw, 27, 13); c.fill(); c.fillStyle = accent; c.fillText(r.name.toUpperCase(), lx, ly + 1); }
    // Тени от стен на полу.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (floorAt(x, y)) {
      if (!floorAt(x, y - 1)) { const gr = c.createLinearGradient(0, y * T, 0, y * T + 26); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x * T, y * T, T, 26); }
      if (!floorAt(x - 1, y)) { const gr = c.createLinearGradient(x * T, 0, x * T + 14, 0); gr.addColorStop(0, 'rgba(0,0,0,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x * T, y * T, 14, T); }
      if (!floorAt(x + 1, y)) { const gr = c.createLinearGradient(x * T + T, 0, x * T + T - 10, 0); gr.addColorStop(0, 'rgba(0,0,0,.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x * T + T - 10, y * T, 10, T); } }
    // Стены: верхняя стена комнаты видна «лицом» и чуть выше клетки, остальные — кромкой.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!floorAt(x, y) && floorAt(x, y + 1)) { const px = x * T, tall = y > 0 && !floorAt(x, y - 1) ? T * 1.5 : T, py = (y + 1) * T - tall;
      if (art.wall_panel) { const i = art.wall_panel; c.drawImage(i, (x % 2) * i.width / 2, 0, i.width / 2, i.height, px, py, T, tall); const r = roomAt(x, y + 1); if (r) { c.fillStyle = (ROOM_STYLE[r.kind] || ['#2a3550'])[0]; c.globalAlpha = 0.28; c.fillRect(px, py, T, tall); c.globalAlpha = 1; } }
      else { const gr = c.createLinearGradient(0, py + 6, 0, py + tall); gr.addColorStop(0, '#5a6890'); gr.addColorStop(0.15, '#3d4a70'); gr.addColorStop(1, '#232c4a'); c.fillStyle = gr; c.fillRect(px, py + 6, T, tall - 6); c.fillStyle = '#7f8fb8'; c.fillRect(px, py + 4, T, 4); } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!floorAt(x, y)) { c.fillStyle = '#7d8cb5'; if (floorAt(x, y - 1)) c.fillRect(x * T, y * T, T, 5); if (floorAt(x - 1, y)) c.fillRect(x * T, y * T, 5, T); if (floorAt(x + 1, y)) c.fillRect(x * T + T - 5, y * T, 5, T);
      c.fillStyle = 'rgba(0,0,0,.35)'; if (floorAt(x, y - 1)) c.fillRect(x * T, y * T + 5, T, 3); }
    // Мебель, реактор, стол собраний, терминалы и пульты.
    for (const r of world.rooms) for (const [name, cx, w] of furnish(r)) { const bottom = (r.y + (name === 'prop_plant' ? 1.05 : 0.9)) * T; c.fillStyle = 'rgba(0,0,0,.3)'; if (art[name]) { c.beginPath(); c.ellipse(cx * T, bottom - 3, w * T * 0.46, 7, 0, 0, 7); c.fill(); } sprite(c, name, cx * T, bottom, w * T, Math.min(2.1 * T, bottom - 4)); }
    { const r = world.rooms.find(q => q.kind === 'reactor'); if (r && art.prop_reactor) { const cx = (r.x + r.w / 2 + 1.5) * T, cy = (r.y + r.h / 2) * T; c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(cx, cy + 10, T * 1.7, T * 1.5, 0, 0, 7); c.fill(); sprite(c, 'prop_reactor', cx, cy + T * 1.6, T * 3.2); } }
    if (art.prop_table) { const tx = world.table[0] * T, ty = world.table[1] * T; c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(tx, ty + 10, T * 1.25, T * 1.1, 0, 0, 7); c.fill(); const i = art.prop_table, w = T * 2.5, h = w * i.height / i.width; c.drawImage(i, tx - w / 2, ty - h / 2, w, h); }
    if (art.prop_terminal) for (const [x, y] of world.terminals) { const cx = (x + 0.5) * T, by = (y + 1) * T - 1; c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(cx, by - 4, 26, 6, 0, 0, 7); c.fill(); sprite(c, 'prop_terminal', cx, by, T * 1.3); }
    for (const [x, y, kind] of world.consoles) sprite(c, kind === 'lights' ? 'prop_lightbox' : 'prop_console', (x + 0.5) * T, (y + 1) * T - 2, T * 1.25, T * 1.5);
    if (world.cams && !sprite(c, 'prop_security', (world.cams.x + 0.5) * T, (world.cams.y + 1) * T, T * 1.5, T * 1.9)) { c.fillStyle = '#0a0d18'; c.fillRect(world.cams.x * T + 4, world.cams.y * T + 4, T - 8, T - 8); c.fillStyle = '#35d8ff'; c.fillRect(world.cams.x * T + 9, world.cams.y * T + 9, T - 18, T - 22); }
    // Уменьшенная копия для карты.
    mini = document.createElement('canvas'); mini.width = W * 8; mini.height = H * 8; const m = mini.getContext('2d'); m.fillStyle = '#0a0f1e'; m.fillRect(0, 0, mini.width, mini.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (floorAt(x, y)) { const r = roomAt(x, y); m.fillStyle = r ? shade((ROOM_STYLE[r.kind] || ['#2a3550'])[0], 1.5) : '#3a4566'; m.fillRect(x * 8, y * 8, 8, 8); }
  }

  // Человечек экипажа: корпус, ранец, визор, ноги шагают при ходьбе.
  // Космонавт нарисован нейросетью в светло-сером скафандре; для каждого цвета игрока скафандр перекрашивается один раз
  // (визор и контур не трогаем: красятся только почти бесцветные светлые точки).
  const MATE = {}, TINTED = {};
  for (const n of ['idle', 'walk_a', 'walk_b', 'body', 'ghost']) { const i = new Image(); i.onload = () => { MATE[n] = i; }; i.src = `art/mate_${n}.webp?v=${document.getElementById('assignmentData').dataset.art || ''}`; }
  function mate(frame, color) {
    const key = frame + color; if (TINTED[key]) return TINTED[key]; const im = MATE[frame]; if (!im) return null;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    const n = parseInt(color.slice(1), 16), cr = n >> 16, cg = n >> 8 & 255, cb = n & 255;
    for (let i = 0; i < p.length; i += 4) { const r = p[i], g2 = p[i + 1], b = p[i + 2], mx = Math.max(r, g2, b), mn = Math.min(r, g2, b); if (p[i + 3] && mx > 70 && mx - mn < 40) { const k = mx / 255; p[i] = cr * k; p[i + 1] = cg * k; p[i + 2] = cb * k; } }
    x.putImageData(d, 0, 0); return TINTED[key] = c;
  }
  function crewmate(x, y, color, name, o = {}) {
    const frame = o.body ? 'body' : (o.alpha ?? 1) < 0.5 ? 'ghost' : o.moving ? (Math.floor(o.walk * 8) % 2 ? 'walk_a' : 'walk_b') : 'idle', pic = mate(frame, color);
    if (pic) {
      const h = o.body ? 30 : 54, w = h * pic.width / pic.height; g.save(); g.globalAlpha = o.alpha ?? 1; g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y + 17, 15, 5, 0, 0, 7); g.fill();
      g.translate(x, y + 20); g.scale((o.face || 1) < 0 ? -1 : 1, 1); g.drawImage(pic, -w / 2, -h, w, h); g.restore();
      if (name) { g.font = '700 13px system-ui'; const tw = g.measureText(name).width + 12; g.globalAlpha = (o.alpha ?? 1) * 0.75; g.fillStyle = '#0a0d18'; g.beginPath(); g.roundRect(x - tw / 2, y - 51, tw, 18, 9); g.fill(); g.globalAlpha = o.alpha ?? 1; g.fillStyle = o.self ? '#ffe08a' : '#e8eefb'; g.fillText(name, x, y - 41.5); g.globalAlpha = 1; }
      return;
    }
    const dir = o.face || 1, step = o.moving ? Math.sin(o.walk * 14) : 0, dark = shade(color, 0.62); g.save(); g.translate(x, y); g.globalAlpha = o.alpha ?? 1;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(0, 17, 15, 5, 0, 0, 7); g.fill();
    if (o.body) { g.fillStyle = '#0a0d18'; g.beginPath(); g.roundRect(-16, -2, 32, 20, 9); g.fill(); g.fillStyle = color; g.beginPath(); g.roundRect(-13, 1, 26, 15, 7); g.fill(); g.fillStyle = dark; g.fillRect(-13, 9, 26, 7);
      g.fillStyle = '#f2f2f2'; g.fillRect(-3, -9, 6, 11); g.beginPath(); g.arc(-4, -10, 4, 0, 7); g.arc(4, -10, 4, 0, 7); g.fill(); g.strokeStyle = '#0a0d18'; g.lineWidth = 2; g.strokeRect(-3, -9, 6, 10); }
    else { g.scale(dir, 1); const bob = o.moving ? Math.abs(step) * -2 : 0;
      g.fillStyle = '#0a0d18'; g.beginPath(); g.roundRect(-10 + step * 3, 8, 9, 11, 4); g.roundRect(2 - step * 3, 8, 9, 11, 4); g.fill(); g.fillStyle = dark; g.beginPath(); g.roundRect(-8 + step * 3, 9, 6, 8, 3); g.roundRect(3 - step * 3, 9, 6, 8, 3); g.fill();
      g.translate(0, bob); g.fillStyle = '#0a0d18'; g.beginPath(); g.roundRect(-20, -8, 11, 20, 5); g.fill(); g.fillStyle = dark; g.beginPath(); g.roundRect(-18, -6, 8, 16, 4); g.fill();
      g.fillStyle = '#0a0d18'; g.beginPath(); g.roundRect(-14, -22, 28, 36, 13); g.fill(); g.fillStyle = color; g.beginPath(); g.roundRect(-11.5, -19.5, 23, 31, 11); g.fill();
      g.fillStyle = dark; g.beginPath(); g.roundRect(-11.5, 0, 23, 11.5, [0, 0, 11, 11]); g.fill();
      g.fillStyle = '#0a0d18'; g.beginPath(); g.roundRect(-3, -15, 19, 13, 6); g.fill(); g.fillStyle = '#8fd8f0'; g.beginPath(); g.roundRect(-1, -13, 15, 9, 4.5); g.fill(); g.fillStyle = '#e8fbff'; g.beginPath(); g.roundRect(5, -12, 7, 3, 1.5); g.fill(); }
    g.restore();
    if (name) { g.font = '700 13px system-ui'; const w = g.measureText(name).width + 12; g.globalAlpha = (o.alpha ?? 1) * 0.75; g.fillStyle = '#0a0d18'; g.beginPath(); g.roundRect(x - w / 2, y - 43, w, 18, 9); g.fill(); g.globalAlpha = o.alpha ?? 1; g.fillStyle = o.self ? '#ffe08a' : '#e8eefb'; g.fillText(name, x, y - 33.5); g.globalAlpha = 1; }
  }

  const hot = (d, i) => !!d.sabotage && (world.consoles[i][2] || 'reactor') === (d.sabotage.kind || 'reactor') && !d.sabotage.fixed.includes(i);
  // Маршрут до цели: поиск в ширину по клеткам от игрока; цель — пульт реактора при аварии, иначе ближайшее своё задание.
  function findTrail(d) {
    const sx = Math.floor(pos.x), sy = Math.floor(pos.y), targets = [];
    if (d.sabotage && alive) world.consoles.forEach(([x, y], i) => { if (hot(d, i)) targets.push({x, y, fix: true}); });
    if (!targets.length) for (const t of d.me.tasks) if (!t.done) targets.push({x: world.terminals[t.i][0], y: world.terminals[t.i][1], i: t.i});
    const key = sx + ',' + sy + '|' + targets.map(t => t.x + ',' + t.y).join(';'); if (trail && trail.key === key) return trail;
    trail = {key, path: [], target: null, steps: 0}; if (!targets.length || !floorAt(sx, sy)) return trail;
    const W = world.map[0].length, prev = new Int32Array(W * world.map.length).fill(-2), queue = [sy * W + sx]; prev[sy * W + sx] = -1; let found = null;
    for (let h = 0; h < queue.length && !found; h++) { const at = queue[h], x = at % W, y = (at - x) / W; found = targets.find(t => t.x === x && t.y === y); if (found) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (y + dy) * W + x + dx; if (floorAt(x + dx, y + dy) && prev[n] === -2) { prev[n] = at; queue.push(n); } } }
    if (!found) return trail; let at = found.y * W + found.x; while (at >= 0) { trail.path.unshift([at % W + 0.5, Math.floor(at / W) + 0.5]); at = prev[at]; }
    trail.target = found; trail.steps = trail.path.length - 1; return trail;
  }

  function drawMap(d, now, x0, y0, k, big) {
    const w = mini.width * k, h = mini.height * k; g.save(); g.globalAlpha = big ? 0.96 : 0.85; g.fillStyle = '#0a0f1e'; g.beginPath(); g.roundRect(x0 - 6, y0 - 6, w + 12, h + 12, 10); g.fill(); g.strokeStyle = big ? '#ffd34d' : '#3b4d78'; g.lineWidth = 2; g.stroke();
    g.drawImage(mini, x0, y0, w, h); g.globalAlpha = 1; const s = 8 * k, P = (x, y) => [x0 + x * s, y0 + y * s];
    if (big) { g.font = '700 14px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; for (const r of world.rooms) { g.fillStyle = 'rgba(255,255,255,.75)'; g.fillText(r.name, ...P(r.x + r.w / 2, r.y + r.h - 0.9)); } }
    const [tx, ty] = P(world.table[0], world.table[1]); g.fillStyle = '#e2603f'; g.beginPath(); g.arc(tx, ty, big ? 8 : 3.5, 0, 7); g.fill();
    if (d.phase === 'play') {
      const t = findTrail(d); if (big && t.path.length > 1) { g.strokeStyle = 'rgba(255,211,77,.9)'; g.lineWidth = 3; g.setLineDash([6, 6]); g.lineDashOffset = -now / 60; g.beginPath(); t.path.forEach(([x, y], i) => { const [px, py] = P(x, y); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); g.setLineDash([]); }
      for (const task of d.me.tasks) { const [x, y] = P(world.terminals[task.i][0] + 0.5, world.terminals[task.i][1] + 0.5), near = t.target && t.target.i === task.i; g.fillStyle = task.done ? '#3fba74' : '#ffd34d'; g.strokeStyle = '#0a0d18'; g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, (big ? 8 : 3.5) + (near && !task.done ? Math.sin(now / 200) * (big ? 3 : 1.5) : 0), 0, 7); g.fill(); g.stroke(); if (big) { g.fillStyle = '#0a0d18'; g.font = '800 11px system-ui'; g.fillText(task.done ? '✓' : '!', x, y + 1); } }
      if (d.sabotage) for (const [i, c] of world.consoles.entries()) if (hot(d, i)) { const [x, y] = P(c[0] + 0.5, c[1] + 0.5); g.fillStyle = Math.sin(now / 120) > 0 ? '#ff4a4a' : '#ffffff'; g.beginPath(); g.arc(x, y, big ? 9 : 4, 0, 7); g.fill(); }
    }
    const [mx, my] = P(pos.x, pos.y); g.fillStyle = '#fff'; g.beginPath(); g.arc(mx, my, big ? 9 : 4.5, 0, 7); g.fill(); g.fillStyle = me.color; g.beginPath(); g.arc(mx, my, big ? 6.5 : 3, 0, 7); g.fill();
    if (big) { g.font = '600 15px system-ui'; g.fillStyle = '#b9c6e2'; g.fillStyle = '#ffe08a'; g.font = '800 18px system-ui'; g.fillText(world.name, VIEW_W / 2, y0 - 26); g.font = '600 14px system-ui'; g.fillStyle = '#b9c6e2'; g.fillText('Белый кружок — ты · жёлтые — твои задания · зелёные — выполнено · красный — стол собраний · M — закрыть карту', VIEW_W / 2, y0 + h + 24); }
    g.restore();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame); const dt = Math.min(0.12, (now - last) / 1000); last = now;   // на слабых компьютерах скорость героя не должна падать вместе с частотой кадров
    if (!state || !world) return; if (!layer) buildLayer();
    const d = state, T = TILE, playing = d.phase === 'play' && !d.paused && !d.me.quiz && !typing() && !camMode, dark = !!d.sabotage && d.sabotage.kind === 'lights', sight = dark ? SIGHT * 0.42 : SIGHT; let moving = false;
    if (playing) {
      let dx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0), dy = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
      if (dx) face = dx; moving = !!(dx || dy); if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
      const nx = pos.x + dx * SPEED * dt, ny = pos.y + dy * SPEED * dt;
      if (alive) { if (free(nx, pos.y)) pos.x = nx; if (free(pos.x, ny)) pos.y = ny; } else { pos.x = Math.max(0.5, Math.min(world.map[0].length - 0.5, nx)); pos.y = Math.max(0.5, Math.min(world.map.length - 0.5, ny)); }
    }
    if (moving) walk += dt;
    for (const o of others.values()) { const mx = (o.tx - o.x) * Math.min(1, dt * 9), my = (o.ty - o.y) * Math.min(1, dt * 9); o.x += mx; o.y += my; o.moving = Math.abs(o.tx - o.x) + Math.abs(o.ty - o.y) > 0.08; if (Math.abs(mx) > 0.004) o.face = mx > 0 ? 1 : -1; if (o.moving) o.walk = (o.walk || 0) + dt; }
    const camX = Math.round(Math.max(0, Math.min(layer.width - VIEW_W, pos.x * T - VIEW_W / 2))), camY = Math.round(Math.max(0, Math.min(layer.height - VIEW_H, pos.y * T - VIEW_H / 2)));
    g.drawImage(layer, camX, camY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H); g.save(); g.translate(-camX, -camY); g.textAlign = 'center'; g.textBaseline = 'middle';
    // Реактор светится, при аварии — мигает красным.
    { const r = world.rooms.find(q => q.kind === 'reactor'), boom = d.sabotage && d.sabotage.kind !== 'lights'; if (r) { const cx = (r.x + r.w / 2 + 1.5) * T, cy = (r.y + r.h / 2) * T, k = boom ? 0.5 + 0.5 * Math.sin(now / 110) : 0.5 + 0.2 * Math.sin(now / 700), gl = g.createRadialGradient(cx, cy, 4, cx, cy, 80); gl.addColorStop(0, boom ? `rgba(255,60,60,${0.9 * k})` : `rgba(255,150,90,${0.6 * k})`); gl.addColorStop(1, 'rgba(255,90,60,0)'); g.fillStyle = gl; g.fillRect(cx - 80, cy - 80, 160, 160); } }
    // Стол собраний с кнопкой (если картинка стола не загрузилась).
    if (!art.prop_table) { const tx = world.table[0] * T, ty = world.table[1] * T; g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(tx, ty + 8, T * 1.1, T * 0.95, 0, 0, 7); g.fill(); g.fillStyle = '#1a2038'; g.beginPath(); g.arc(tx, ty, T * 1.05, 0, 7); g.fill(); const tg = g.createRadialGradient(tx - 12, ty - 14, 4, tx, ty, T); tg.addColorStop(0, '#6d7cab'); tg.addColorStop(1, '#3a466e'); g.fillStyle = tg; g.beginPath(); g.arc(tx, ty, T * 0.94, 0, 7); g.fill();
      g.fillStyle = '#7a1f1f'; g.beginPath(); g.arc(tx, ty + 3, T * 0.34, 0, 7); g.fill(); g.fillStyle = '#ff5a4a'; g.beginPath(); g.arc(tx, ty, T * 0.3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(tx - 4, ty - 5, 6, 3, -0.5, 0, 7); g.fill(); }
    const mine = new Map(d.me.tasks.map(t => [t.i, t.done]));
    if (art.prop_terminal) world.terminals.forEach(([x, y], i) => { const cx = (x + 0.5) * T, cy = (y + 0.5) * T; if (cx < camX - T || cx > camX + VIEW_W + T || cy < camY - T * 2 || cy > camY + VIEW_H + T) return; const todo = d.phase === 'play' && mine.has(i) && !mine.get(i), done = mine.get(i); if (!todo && !done) return;
      const sw = T * 1.3, sh = sw * art.prop_terminal.height / art.prop_terminal.width, top = (y + 1) * T - 1 - sh, col = todo ? '255,211,77' : '63,186,116', k = todo ? 0.6 + 0.3 * Math.sin(now / 250) : 0.75;
      const gl = g.createRadialGradient(cx, top + sh * 0.3, 3, cx, top + sh * 0.3, 44); gl.addColorStop(0, `rgba(${col},${0.5 * k})`); gl.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gl; g.fillRect(cx - 44, top + sh * 0.3 - 44, 88, 88);
      g.fillStyle = `rgba(${col},${k})`; g.beginPath(); g.roundRect(cx - sw * 0.21, top + sh * 0.1, sw * 0.42, sh * 0.3, 2); g.fill(); g.fillStyle = '#0a0d18'; g.font = '800 13px system-ui'; g.fillText(done ? '✓' : '!', cx, top + sh * 0.26);
      if (todo) { const by = top - 16 + Math.sin(now / 300) * 3; g.fillStyle = '#0a0d18'; g.beginPath(); g.arc(cx, by, 11, 0, 7); g.fill(); g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(cx, by, 9, 0, 7); g.fill(); g.fillStyle = '#0a0d18'; g.font = '900 14px system-ui'; g.fillText('!', cx, by + 1); } });
    else world.terminals.forEach(([x, y], i) => { const cx = (x + 0.5) * T, cy = (y + 0.5) * T; if (cx < camX - T || cx > camX + VIEW_W + T || cy < camY - T || cy > camY + VIEW_H + T) return; const todo = d.phase === 'play' && mine.has(i) && !mine.get(i), done = mine.get(i), scr = todo ? '#ffd34d' : done ? '#3fba74' : '#3d6f9a';
      if (todo) { const gl = g.createRadialGradient(cx, cy, 4, cx, cy, 46); gl.addColorStop(0, `rgba(255,211,77,${0.35 + 0.2 * Math.sin(now / 250)})`); gl.addColorStop(1, 'rgba(255,211,77,0)'); g.fillStyle = gl; g.fillRect(cx - 46, cy - 46, 92, 92); }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, cy + 17, 19, 5, 0, 0, 7); g.fill(); g.fillStyle = '#0a0d18'; g.beginPath(); g.roundRect(cx - 19, cy + 3, 38, 15, 4); g.fill(); g.fillStyle = '#56648a'; g.beginPath(); g.roundRect(cx - 17, cy + 5, 34, 6, 2); g.fill(); g.fillStyle = '#39456b'; g.fillRect(cx - 17, cy + 10, 34, 6);
      g.fillStyle = '#0a0d18'; g.beginPath(); g.roundRect(cx - 16, cy - 20, 32, 25, 4); g.fill(); g.fillStyle = scr; g.beginPath(); g.roundRect(cx - 13, cy - 17, 26, 18, 2); g.fill(); g.fillStyle = 'rgba(10,13,24,.55)';
      if (done) { g.font = '800 15px system-ui'; g.fillStyle = '#0a0d18'; g.fillText('✓', cx, cy - 7); } else { g.fillRect(cx - 10, cy - 14, 13, 2); g.fillRect(cx - 10, cy - 10, 19, 2); g.fillRect(cx - 10, cy - 6, 9, 2); }
      g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(cx - 13, cy - 17, 26, 3); });
    world.consoles.forEach(([x, y], i) => { const cx = (x + 0.5) * T, cy = (y + 0.5) * T, isHot = hot(d, i), on = Math.sin(now / 120) > 0;
      if (art.prop_console) { if (isHot) { const gl = g.createRadialGradient(cx, cy, 3, cx, cy, 50); gl.addColorStop(0, `rgba(255,60,60,${on ? 0.75 : 0.3})`); gl.addColorStop(1, 'rgba(255,60,60,0)'); g.fillStyle = gl; g.fillRect(cx - 50, cy - 50, 100, 100); g.fillStyle = '#0a0d18'; g.beginPath(); g.arc(cx, cy - 34, 11, 0, 7); g.fill(); g.fillStyle = '#ff5a5a'; g.beginPath(); g.arc(cx, cy - 34, 9, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '900 14px system-ui'; g.fillText('!', cx, cy - 33); } return; }
      g.fillStyle = '#0a0d18'; g.beginPath(); g.roundRect(cx - 19, cy - 19, 38, 38, 6); g.fill(); g.fillStyle = isHot ? (on ? '#ff4a4a' : '#7a2020') : '#2f6f6a'; g.beginPath(); g.roundRect(cx - 15, cy - 15, 30, 30, 4); g.fill(); g.fillStyle = '#0a0d18'; g.font = '800 18px system-ui'; g.fillText(isHot ? '!' : '⚙', cx, cy + 1); });
    // Дорожка к цели: бегущие стрелки по полу — у всех игроков одинаково.
    // Запертые двери — стальные створки с полосами.
    if (locked) for (const [x, y] of world.doors || []) { const px = x * T, py = y * T; if (px < camX - T || px > camX + VIEW_W || py < camY - T || py > camY + VIEW_H) continue; g.fillStyle = '#0a0d18'; g.fillRect(px, py, T, T); g.fillStyle = '#5c6a8f'; g.fillRect(px + 2, py + 2, T - 4, T - 4);
      g.fillStyle = '#ffd34d'; for (let k = -1; k < 3; k++) { g.beginPath(); g.moveTo(px + 2 + k * 16, py + T - 2); g.lineTo(px + 10 + k * 16, py + T - 2); g.lineTo(px + 22 + k * 16, py + T - 14); g.lineTo(px + 14 + k * 16, py + T - 14); g.fill(); } g.fillStyle = '#0a0d18'; g.fillRect(px + T / 2 - 1, py + 2, 2, T - 16); }
    // Камеры в комнатах: огонёк мигает, когда кто-то смотрит с поста.
    if (world.cams && d.phase === 'play') for (const i of world.cams.rooms) { const r = world.rooms[i], cx = (r.x + r.w - 0.6) * T, cy = (r.y + 0.45) * T; g.fillStyle = '#0a0d18'; g.beginPath(); g.roundRect(cx - 13, cy - 8, 22, 15, 4); g.fill(); g.fillStyle = '#39456b'; g.beginPath(); g.arc(cx - 2, cy, 5, 0, 7); g.fill();
      g.fillStyle = d.watch && Math.sin(now / 160) > 0 ? '#ff3b3b' : d.watch ? '#7a1f1f' : '#2b3554'; g.beginPath(); g.arc(cx + 6, cy - 4, 2.6, 0, 7); g.fill(); }
    const tr = d.phase === 'play' && !d.paused ? findTrail(d) : null;
    if (tr && tr.path.length > 1) { const flow = now / 380 % 1, n = Math.min(tr.path.length - 1, 9);
      for (let i = 0; i < n; i++) for (const off of [0.25, 0.75]) { const k = (off + flow * 0.5) % 1, a = tr.path[i], b = tr.path[i + 1], px = (a[0] + (b[0] - a[0]) * k) * T, py = (a[1] + (b[1] - a[1]) * k) * T, ang = Math.atan2(b[1] - a[1], b[0] - a[0]); if (Math.hypot(px - pos.x * T, py - pos.y * T) < 26) continue;
        g.save(); g.translate(px, py); g.rotate(ang); g.globalAlpha = 0.85 * (1 - i / (n + 2)); g.strokeStyle = tr.target.fix ? '#ff6a6a' : '#ffd34d'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-5, -7); g.lineTo(3, 0); g.lineTo(-5, 7); g.stroke(); g.restore(); } }
    if (d.phase === 'play') for (const b of d.bodies) if (!alive || Math.hypot(b.x - pos.x, b.y - pos.y) < sight) crewmate(b.x * T, b.y * T, b.color, b.name.split(' ')[0], {body: true});
    // Игроков рисуем сверху вниз, чтобы ближний перекрывал дальнего.
    const list = [];
    if (d.phase === 'play' || d.phase === 'lobby' || d.phase === 'end') for (const p of d.players) { if (p.id === me.id) continue; const o = others.get(p.id); if (!o || !p.on || p.gone) continue;
      if (!p.alive) { if (!alive) list.push([o.x, o.y, p.color, p.name, {alpha: 0.4, face: o.face, moving: o.moving, walk: o.walk || 0}]); continue; }
      if (alive && d.phase === 'play' && Math.hypot(o.x - pos.x, o.y - pos.y) > sight) continue; list.push([o.x, o.y, p.color, p.name, {face: o.face, moving: o.moving, walk: o.walk || 0}]); }
    list.push([pos.x, pos.y, me.color, me.name, {self: true, face, moving, walk, alpha: alive || d.phase === 'lobby' || d.phase === 'end' ? 1 : 0.45}]);
    list.sort((a, b) => a[1] - b[1]); for (const [x, y, color, name, o] of list) crewmate(x * T, y * T, color, name.split(' ')[0], o);
    pulseFx = pulseFx.filter(f => now - f.t < 900);
    for (const f of pulseFx) { const o = f.id === me.id ? pos : others.get(f.id); if (!o) continue; if (alive && Math.hypot(o.x - pos.x, o.y - pos.y) > sight) continue; const k = (now - f.t) / 900; g.strokeStyle = `rgba(125,249,255,${1 - k})`; g.lineWidth = 5; g.beginPath(); g.arc(o.x * T, o.y * T, T * (0.4 + k * 2.2), 0, 7); g.stroke(); g.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; g.lineWidth = 2; g.beginPath(); g.arc(o.x * T, o.y * T, T * (0.2 + k * 1.6), 0, 7); g.stroke(); }
    g.restore();
    // Туман: живой игрок видит только то, что рядом.
    if (alive && d.phase === 'play') { if (!fogLayer) { fogLayer = document.createElement('canvas'); fogLayer.width = VIEW_W; fogLayer.height = VIEW_H; const f = fogLayer.getContext('2d'), fog = f.createRadialGradient(VIEW_W / 2, VIEW_H / 2, SIGHT * T * 0.275, VIEW_W / 2, VIEW_H / 2, SIGHT * T * 0.5); fog.addColorStop(0, 'rgba(4,6,14,0)'); fog.addColorStop(0.6, 'rgba(4,6,14,.45)'); fog.addColorStop(1, 'rgba(4,6,14,.86)'); f.fillStyle = fog; f.fillRect(0, 0, VIEW_W, VIEW_H); }
      // Туман нарисован заранее в половинном размере и просто растягивается: так быстрее на слабых компьютерах.
      { const f = dark ? 0.42 : 1, fx = pos.x * T - camX - VIEW_W * f, fy = pos.y * T - camY - VIEW_H * f, fw = VIEW_W * 2 * f, fh = VIEW_H * 2 * f; g.drawImage(fogLayer, fx, fy, fw, fh);
        if (dark) { g.fillStyle = 'rgba(4,6,14,.86)'; g.fillRect(0, 0, VIEW_W, Math.max(0, fy)); g.fillRect(0, fy + fh, VIEW_W, VIEW_H); g.fillRect(0, Math.max(0, fy), Math.max(0, fx), fh); g.fillRect(fx + fw, Math.max(0, fy), VIEW_W, fh); } } }
    if (d.sabotage && d.sabotage.kind === 'reactor') { g.fillStyle = `rgba(255,40,40,${0.08 + 0.06 * Math.sin(now / 150)})`; g.fillRect(0, 0, VIEW_W, VIEW_H); }
    // Указатель: куда идти и сколько осталось.
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (tr && tr.target) { const room = roomOf(tr.target.x, tr.target.y), a = tr.path.length > 1 ? Math.atan2(tr.path[Math.min(2, tr.path.length - 1)][1] - pos.y, tr.path[Math.min(2, tr.path.length - 1)][0] - pos.x) : 0, text = (tr.target.fix ? (d.sabotage && d.sabotage.kind === 'lights' ? 'Чинить свет' : 'Чинить реактор') : room) + ' · ' + tr.steps + ' м', red = tr.target.fix;
      g.font = '700 16px system-ui'; const w = g.measureText(text).width + 58, bx = VIEW_W / 2 - w / 2, by = 14; g.fillStyle = 'rgba(10,13,24,.86)'; g.beginPath(); g.roundRect(bx, by, w, 34, 17); g.fill(); g.strokeStyle = red ? '#ff6a6a' : '#ffd34d'; g.lineWidth = 2; g.stroke();
      g.save(); g.translate(bx + 22, by + 17); g.rotate(a); g.fillStyle = red ? '#ff6a6a' : '#ffd34d'; g.beginPath(); g.moveTo(11, 0); g.lineTo(-7, -8); g.lineTo(-3, 0); g.lineTo(-7, 8); g.closePath(); g.fill(); g.restore(); g.fillStyle = '#fff3c4'; g.fillText(text, bx + 22 + (w - 22) / 2, by + 18); }
    else if (d.phase === 'play' && d.me.tasks.length && !d.paused) { const text = 'Все задания выполнены — следи за остальными'; g.font = '700 15px system-ui'; const w = g.measureText(text).width + 30; g.fillStyle = 'rgba(10,13,24,.8)'; g.beginPath(); g.roundRect(VIEW_W / 2 - w / 2, 14, w, 32, 16); g.fill(); g.fillStyle = '#7fe3c8'; g.fillText(text, VIEW_W / 2, 31); }
    // Карта: маленькая в углу, большая — по клавише M.
    if (d.phase === 'play' || d.phase === 'lobby') { const kb = Math.min(1000 / mini.width, 490 / mini.height), ks = Math.min(230 / mini.width, 150 / mini.height); if (bigMap) drawMap(d, now, (VIEW_W - mini.width * kb) / 2, 62, kb, true); else drawMap(d, now, VIEW_W - mini.width * ks - 14, 14, ks, false); }
    // Подсказка действия — одинаковая для всех живых игроков.
    // Пост наблюдения: четыре окна с комнатами. Игрок в это время стоит на месте и не видит, что рядом с ним.
    if (camMode && world.cams) { g.fillStyle = '#05070f'; g.fillRect(0, 0, VIEW_W, VIEW_H); const w = VIEW_W / 2 - 15, h = VIEW_H / 2 - 15;
      world.cams.rooms.slice(0, 4).forEach((ri, n) => { const r = world.rooms[ri], ox = 10 + (n % 2) * (w + 10), oy = 10 + Math.floor(n / 2) * (h + 10), k = Math.min(w / ((r.w + 2) * T), h / ((r.h + 2) * T)), sx = (r.x - 1) * T, sy = (r.y - 1) * T;
        g.save(); g.beginPath(); g.rect(ox, oy, w, h); g.clip(); g.fillStyle = '#0a0f1e'; g.fillRect(ox, oy, w, h); g.translate(ox + (w - (r.w + 2) * T * k) / 2, oy + (h - (r.h + 2) * T * k) / 2); g.scale(k, k); g.translate(-sx, -sy); g.drawImage(layer, sx, sy, (r.w + 2) * T, (r.h + 2) * T, sx, sy, (r.w + 2) * T, (r.h + 2) * T);
        g.textAlign = 'center'; g.textBaseline = 'middle'; const inRoom = (x, y) => x >= r.x - 1 && x < r.x + r.w + 1 && y >= r.y - 1 && y < r.y + r.h + 1;
        for (const b of d.bodies) if (inRoom(b.x, b.y)) crewmate(b.x * T, b.y * T, b.color, b.name.split(' ')[0], {body: true});
        for (const p of d.players) { const o = p.id === me.id ? pos : others.get(p.id); if (!o || !p.on || p.gone || !p.alive || !inRoom(o.x, o.y)) continue; crewmate(o.x * T, o.y * T, p.color, p.name.split(' ')[0], {face: o.face || 1, moving: o.moving, walk: o.walk || 0}); }
        g.restore(); g.fillStyle = 'rgba(0,20,10,.18)'; g.fillRect(ox, oy, w, h); for (let yy = oy + (now / 40 % 4); yy < oy + h; yy += 4) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(ox, yy, w, 1); }
        g.strokeStyle = '#3b4d78'; g.lineWidth = 2; g.strokeRect(ox, oy, w, h); g.textAlign = 'left'; g.font = '700 15px ui-monospace,monospace'; g.fillStyle = '#e8eefb'; g.fillText(`КАМ ${n + 1} · ${r.name.toUpperCase()}`, ox + 12, oy + 18);
        if (Math.sin(now / 300) > 0) { g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(ox + w - 58, oy + 18, 5, 0, 7); g.fill(); } g.fillStyle = '#ff8a8a'; g.fillText('REC', ox + w - 46, oy + 18); });
      g.textAlign = 'center'; g.font = '700 15px system-ui'; g.fillStyle = 'rgba(10,13,24,.9)'; g.beginPath(); g.roundRect(VIEW_W / 2 - 190, VIEW_H / 2 - 16, 380, 32, 16); g.fill(); g.fillStyle = '#ffe9a8'; g.fillText('Пост наблюдения · E или Esc — отойти от камер', VIEW_W / 2, VIEW_H / 2 + 1); }
    ui.tasks.style.display = camMode ? 'none' : '';
    let hint = '';
    if (d.phase === 'play' && !d.me.quiz) {
      if (alive && d.bodies.some(b => Math.hypot(b.x - pos.x, b.y - pos.y) < 2.6)) hint = 'R — сообщить об отключённом';
      else if (alive && d.sabotage && world.consoles.some(([x, y], i) => hot(d, i) && Math.hypot(x + 0.5 - pos.x, y + 0.5 - pos.y) < 1.8)) hint = d.sabotage.kind === 'lights' ? 'E — чинить щиток света' : 'E — чинить пульт';
      else if (d.me.tasks.some(t => !t.done && Math.hypot(world.terminals[t.i][0] + 0.5 - pos.x, world.terminals[t.i][1] + 0.5 - pos.y) < 1.8)) hint = d.me.lock > 0 ? `Терминал перезагружается: ${Math.ceil(d.me.lock)} с` : 'E — открыть терминал';
      else if (alive && Math.hypot(world.table[0] - pos.x, world.table[1] - pos.y) < 2.6 && d.me.emergency > 0 && !(d.sabotage && d.sabotage.kind !== 'lights')) hint = 'R — экстренное собрание (один раз за раунд)';
      else if (nearCams() && !camMode) hint = 'E — камеры наблюдения';
      if (camMode) hint = '';
    }
    if (ui.hint.textContent !== hint) ui.hint.textContent = hint; ui.hint.hidden = !hint;
    if (now - intro < 6000 && d.phase === 'play') { g.fillStyle = 'rgba(6,8,18,.82)'; g.fillRect(0, VIEW_H / 2 - 70, VIEW_W, 140); g.textAlign = 'center'; g.fillStyle = '#e8eefb'; g.font = '800 30px system-ui'; g.fillText('Смена началась', VIEW_W / 2, VIEW_H / 2 - 22); g.font = '600 17px system-ui'; g.fillStyle = '#b9c6e2'; g.fillText('Зажми Q и прикрой левый нижний угол экрана ладонью — там твоя роль. Отпусти, когда прочитаешь.', VIEW_W / 2, VIEW_H / 2 + 22); }
    ui.secret.classList.toggle('show', peek);
    if (debugHost) window.crewWorld = world;
    if (debugHost) window.crewView = {dark, camMode, locked, watch: !!d.watch,  world: world.id, trail: tr ? {steps: tr.steps, room: tr.target ? roomOf(tr.target.x, tr.target.y) : '', fix: !!(tr.target && tr.target.fix)} : null, bigMap, layer: !!layer};
  }

  /* ---------------- пульт учителя ---------------- */
  // Вкладки: «Раунд» (запуск и ход игры, карта), «Игроки», «Чат», «Настройки», «Сервер» (все классы, вход, состояние).
  const PRESETS = {'Быстрый раунд': {tasks: 3, meeting: 45, cooldown: 20, infect: 8, sabotageTime: 40}, 'Обычный': {tasks: 5, meeting: 75, cooldown: 25, infect: 10, sabotageTime: 50}, 'Долгий и вдумчивый': {tasks: 8, meeting: 120, cooldown: 35, infect: 12, sabotageTime: 70},
    'Младшие классы': {tasks: 4, meeting: 90, cooldown: 35, infect: 12, sabotageTime: 70, sabotage: false}};
  function teacher(className) {
    stop(); me = null; state = null; let marks = null, need = [4, 8, 12]; let timer = 0, current = className, view = null, over = null, tab = 'round', down = '', pick = new Set(), lastSync = null, rate = 0;
    try { tab = sessionStorage.getItem('crew-tab') || 'round'; } catch {}
    const page = el('section', 'cr-teacher'), head = el('header', 'cr-top'), gradeSel = el('select'), letterSel = el('select'); gradeSel.setAttribute('aria-label', 'Параллель'); letterSel.setAttribute('aria-label', 'Буква класса');
    for (let n = 6; n <= 11; n++) { const o = el('option', '', n + ' класс'); o.value = n; gradeSel.append(o); } for (const l of LETTERS) { const o = el('option', '', `«${l}»`); o.value = l; letterSel.append(o); }
    const setClass = name => { current = name; const m = /^(\d+) «(.)»$/.exec(name); gradeSel.value = m[1]; letterSel.value = m[2]; pick = new Set(); view = null; poll(); };
    const changed = () => setClass(`${gradeSel.value} «${letterSel.value}»`); gradeSel.addEventListener('change', changed); letterSel.addEventListener('change', changed);
    const status = el('span', 'cr-phase'), tabs = el('nav', 'cr-tabs'), body = el('div', 'cr-tbody'), toast = el('p', 'cr-status'); toast.setAttribute('role', 'status');
    head.append(el('strong', '', 'Пульт учителя · Сбой на станции'), gradeSel, letterSel, status, button('← Выйти с пульта', 'cr-small', () => { clearInterval(timer); history.replaceState(null, '', location.pathname); login(' '); }));
    const TABS = [['round', 'Раунд'], ['players', 'Игроки'], ['chat', 'Чат'], ['settings', 'Настройки'], ['server', 'Сервер']];
    for (const [id, name] of TABS) { const b = button(name, 'cr-tab', () => { tab = id; try { sessionStorage.setItem('crew-tab', id); } catch {} draw(true); }); b.dataset.tab = id; tabs.append(b); }
    const say = text => { toast.textContent = text; clearTimeout(say.t); say.t = setTimeout(() => { toast.textContent = ''; }, 5000); };
    const act = async (action, extra = {}) => { try { const d = await call('teacher', {className: current, action, ...extra}); down = ''; if (d.server) over = d; else if (d.cleared) view = null; else view = d; draw(action !== 'state'); return d; }
      catch (error) { if (error.status === 404 || error.status === 403) { down = error.status === 404 ? 'off' : 'deny'; draw(true); } else say(error.message); } };
    const poll = async () => { await act('state'); if (down) return; try { const d = await call('teacher', {action: 'overview'}); if (lastSync) rate = Math.max(0, (d.server.syncs - lastSync.n) / Math.max(0.5, d.server.time - lastSync.t)); lastSync = {n: d.server.syncs, t: d.server.time}; over = d; if (tab === 'server' || tab === 'round') draw(false); } catch {} };
    const big = (text, cls, action, extra, on = true, ask = '') => { const b = button(text, cls, () => { if (!ask || confirm(ask)) act(action, typeof extra === 'function' ? extra() : extra); }); b.dataset.act = action + (extra && extra.side ? '-' + extra.side : ''); b.disabled = !on; return b; };
    const phaseName = v => v.paused ? 'пауза' : {lobby: 'сбор игроков', play: 'идёт смена', meeting: 'собрание', result: 'итог голосования', end: 'раунд окончен'}[v.phase];
    const clock = sec => Math.floor(sec / 3600) + ' ч ' + Math.floor(sec % 3600 / 60) + ' мин';
    const pupilUrl = () => `${location.origin}/courses/game-${gradeSel.value}-crew/`;

    function minimap(v) {
      const c = el('canvas', 'cr-mini'), wd = over && over.worlds && over.worlds[v.world], k = wd ? Math.max(8, Math.floor(620 / wd.w)) : 13; if (!wd) return c; c.width = wd.w * k; c.height = wd.h * k; const x = c.getContext('2d'); x.fillStyle = '#080b16'; x.fillRect(0, 0, c.width, c.height);
      wd.map.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) if (row[xx] === '.') { x.fillStyle = '#1e2947'; x.fillRect(xx * k, yy * k, k, k); } });
      x.font = '700 11px system-ui'; x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.3)'; for (const r of wd.rooms) x.fillText(r.name, (r.x + r.w / 2) * k, (r.y + r.h - 0.5) * k);
      x.fillStyle = '#56648a'; for (const [tx, ty] of wd.terminals) x.fillRect(tx * k + 3, ty * k + 3, k - 6, k - 6);
      x.fillStyle = v.sabotage ? '#ff4a4a' : '#2f6f6a'; for (const [tx, ty] of wd.consoles) x.fillRect(tx * k + 2, ty * k + 2, k - 4, k - 4);
      x.fillStyle = '#e2603f'; x.beginPath(); x.arc(wd.table[0] * k, wd.table[1] * k, 7, 0, 7); x.fill(); if (wd.cams) { x.fillStyle = '#35d8ff'; x.fillRect(wd.cams.x * k + 1, wd.cams.y * k + 1, k - 2, k - 2); }
      if (v.sabotage && v.sabotage.kind === 'doors') { x.fillStyle = '#ffd34d'; for (const [dx, dy] of wd.doors) x.fillRect(dx * k, dy * k, k, k); }
      for (const b of v.bodies) { x.strokeStyle = b.color; x.lineWidth = 3; x.beginPath(); x.moveTo(b.x * k - 6, b.y * k - 6); x.lineTo(b.x * k + 6, b.y * k + 6); x.moveTo(b.x * k + 6, b.y * k - 6); x.lineTo(b.x * k - 6, b.y * k + 6); x.stroke(); }
      for (const p of v.players) { if (!p.on) continue; x.globalAlpha = p.alive ? 1 : 0.35; x.fillStyle = p.color; x.beginPath(); x.arc(p.x * k, p.y * k, 7, 0, 7); x.fill();
        if (p.role === 'imp') { x.strokeStyle = '#ff3b3b'; x.lineWidth = 3; x.beginPath(); x.arc(p.x * k, p.y * k, 10, 0, 7); x.stroke(); } if (p.infected) { x.strokeStyle = '#ffd34d'; x.lineWidth = 2; x.setLineDash([3, 3]); x.beginPath(); x.arc(p.x * k, p.y * k, 13, 0, 7); x.stroke(); x.setLineDash([]); }
        x.globalAlpha = 1; x.fillStyle = '#e8eefb'; x.font = '600 10px system-ui'; x.fillText(p.name.split(' ')[0], p.x * k, p.y * k - 11); }
      return c;
    }

    const VIEWS = {
      round(v) {
        const live = ['play', 'meeting', 'result'].includes(v.phase), on = v.players.filter(p => p.on).length, wrap = el('div', 'cr-cols'), left = el('div'), right = el('div');
        const steps = el('ol', 'cr-steps');
        [['Ученики открывают игру и входят', on > 0, `на связи: ${on}`], [`Набралось не меньше ${v.settings.minPlayers} игроков`, on >= v.settings.minPlayers, ''], ['Раунд запущен', live || v.phase === 'end', v.round ? `раунд ${v.round}` : '']].forEach(([t, ok, extra]) => { const li = el('li', ok ? 'ok' : '', t); if (extra) li.append(el('small', '', ' · ' + extra)); steps.append(li); });
        const main = el('div', 'cr-tbar');
        main.append(big(v.phase === 'end' ? '▶ Новый раунд' : '▶ Начать раунд', 'cr-main cr-huge', 'start', () => ({imps: [...pick]}), v.phase === 'lobby' || v.phase === 'end'),
          big(v.paused ? '▶ Продолжить' : '⏸ Пауза', 'cr-small cr-bigbtn', 'pause', {}, live), big('■ Остановить раунд', 'cr-small cr-bigbtn', 'stop', {}, v.phase !== 'lobby', live ? 'Остановить раунд без победителя?' : ''));
        const more = el('div', 'cr-tbar');
        more.append(big('Созвать собрание', 'cr-small', 'meeting', {}, v.phase === 'play' && !v.paused), big('Завершить голосование', 'cr-small', 'endvote', {}, v.phase === 'meeting'), big('Дальше →', 'cr-small', 'next', {}, v.phase === 'result'),
          big(v.sabotage ? 'Отменить аварию' : 'Авария реактора', 'cr-small', v.sabotage ? 'unsabotage' : 'sabotage', {kind: 'reactor'}, v.phase === 'play'), big('Погасить свет', 'cr-small', 'sabotage', {kind: 'lights'}, v.phase === 'play' && !v.sabotage), big('Запереть двери', 'cr-small', 'sabotage', {kind: 'doors'}, v.phase === 'play' && !v.sabotage),
          big('Победа экипажа', 'cr-small', 'win', {side: 'crew'}, live, 'Завершить раунд победой экипажа?'), big('Победа вредителей', 'cr-small', 'win', {side: 'imp'}, live, 'Завершить раунд победой вредителей?'));
        const facts = el('div', 'cr-facts'), fact = (k, t) => { const d = el('div'); d.append(el('small', '', k), el('b', '', t)); facts.append(d); };
        fact('Состояние', phaseName(v)); fact('Игроков на связи', `${on} из ${v.players.length}`); fact('Задания экипажа', `${v.progress[0]} из ${v.progress[1]}`);
        fact('В строю', String(v.players.filter(p => p.alive).length)); fact('Вредители', live || v.phase === 'end' ? v.players.filter(p => p.role === 'imp').map(p => p.name + (p.alive ? '' : ' ✕')).join(', ') || '—' : pick.size ? 'назначены вами: ' + pick.size : 'случайно');
        fact('Локация', over && over.worlds && over.worlds[v.world] ? over.worlds[v.world].name : '—'); if (v.sabotage) fact('Авария', ({lights: 'свет · ', doors: 'двери · '}[v.sabotage.kind] || 'реактор · ') + `осталось ${v.sabotage.left} с`);
        if (v.meeting) fact(v.meeting.result ? 'Итог' : 'Собрание', v.meeting.result || `осталось ${v.meeting.left} с`);
        // Число вредителей — прямо у кнопки запуска. Больше половины игроков сервер не назначит.
        const imps = el('div', 'cr-tbar cr-imps'), cap = Math.max(1, Math.floor((on - 1) / 2)), auto = on < 7 ? 1 : on < 13 ? 2 : 3; imps.append(el('span', '', 'Вредителей в раунде:'));
        for (let n = 0; n <= 6; n++) { const b = button(n ? String(n) : `авто (${Math.min(auto, cap)})`, 'cr-small' + (v.settings.imposters === n ? ' cr-on' : ''), () => { pick = new Set(); act('settings', {settings: {imposters: n}}); }); b.dataset.imps = n; b.disabled = n > cap && v.settings.imposters !== n; imps.append(b); }
        imps.append(el('small', '', pick.size ? `назначены вами на вкладке «Игроки»: ${pick.size}` : v.settings.imposters > cap ? `игроков мало: будет ${cap}` : 'кто именно — выбирается случайно или галочками на вкладке «Игроки»'));
        left.append(steps, main, imps, more, facts);
        if (v.meeting && v.meeting.votes.length) { const ul = el('ul', 'cr-voteslist'); for (const x of v.meeting.votes) ul.append(el('li', '', `${x.who} → ${x.for}`)); left.append(el('h2', '', 'Голоса (видите только вы)'), ul); }
        if (v.phase === 'end') left.append(el('p', 'cr-result', (v.winner === 'crew' ? 'Победил экипаж: ' : 'Победили вредители: ') + v.why), el('p', 'cr-result', `Вредители: ${(v.imps || []).join(', ') || '—'} · Победители: ${(v.winners || []).join(', ') || '—'}`));
        if (v.ready && v.ready.on) left.append(el('p', 'cr-note', v.ready.startIn >= 0 ? `Игроки проголосовали — раунд начнётся через ${v.ready.startIn} с.` : `Голосование за старт: готовы ${v.ready.votes} из ${v.ready.need} (на связи ${v.ready.online}).`));
        right.append(el('h2', '', 'Станция сейчас'), minimap(v), el('p', 'cr-note', 'Красное кольцо — вредитель, жёлтый пунктир — заражён и скоро отключится, крест — отключённый, которого ещё не нашли. Этот экран показывает роли: не выводите его на проектор.'));
        wrap.append(left, right); return wrap;
      },
      players(v) {
        const wrap = el('div'), bar = el('div', 'cr-tbar'), table = el('table', 'cr-table'), hr = el('tr'), lobby = v.phase === 'lobby' || v.phase === 'end', live = !lobby;
        bar.append(big(v.locked ? '🔓 Открыть вход в комнату' : '🔒 Закрыть вход в комнату', 'cr-small', 'lock'), big('Обнулить очки', 'cr-small', 'resetscores', {}, true, 'Обнулить очки и победы всех игроков этого класса?'),
          button('Скачать таблицу очков (CSV)', 'cr-small', () => { const rows = [['Игрок', 'Очки', 'Побед', 'Верно', 'Ошибок']].concat(v.players.map(p => [p.name, p.score, p.wins, p.right, p.wrong])); const a = el('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.join(';')).join('\r\n')], {type: 'text/csv'})); a.download = `Сбой на станции ${current}.csv`; a.click(); }));
        for (const h of ['Игрок', lobby ? 'Вредитель в след. раунде' : 'Роль', 'Состояние', 'Задания', 'Верно / ошибок', 'Очки · побед', 'Действия']) hr.append(el('th', '', h)); table.append(hr);
        for (const p of v.players) { const tr = el('tr', p.on ? '' : 'off'), name = el('td'), dot = el('i'); dot.style.background = p.color; name.append(dot, p.name); const roleCell = el('td', p.role === 'imp' && live ? 'imp' : '');
          if (lobby) { const c = el('input'); c.type = 'checkbox'; c.checked = pick.has(p.id); c.dataset.pick = p.id; c.setAttribute('aria-label', 'Назначить вредителем: ' + p.name); c.addEventListener('change', () => { c.checked ? pick.add(p.id) : pick.delete(p.id); }); roleCell.append(c); if (v.phase === 'end') roleCell.append(' был: ' + (p.role === 'imp' ? 'вредитель' : 'экипаж')); }
          else roleCell.textContent = p.role === 'imp' ? 'ВРЕДИТЕЛЬ' : p.job === 'engineer' ? 'экипаж · инженер' : p.job === 'medic' ? 'экипаж · медик' : 'экипаж';
          const acts = el('td', 'cr-acts');
          acts.append(live ? (p.alive ? big('отключить', 'cr-small', 'out', {id: p.id}) : big('вернуть', 'cr-small', 'revive', {id: p.id})) : '', big(p.muted ? 'вернуть чат' : 'без чата', 'cr-small', 'mute', {id: p.id}), big('убрать', 'cr-small', 'kick', {id: p.id}, true, `Убрать игрока «${p.name}» из комнаты?`));
          tr.append(name, roleCell, el('td', '', !p.on ? 'нет связи' : !p.alive ? 'отключён' : p.infected ? 'заражён' : p.cams ? 'смотрит камеры' : p.quiz ? 'решает задание' : lobby ? 'ждёт' : 'в игре'), el('td', '', `${p.done} / ${p.tasks}`), el('td', '', `${p.right} / ${p.wrong}`), el('td', '', `${p.score} · ${p.wins}`), acts); table.append(tr); }
        wrap.append(bar, table, el('p', 'cr-note', v.players.length ? 'Галочки назначают вредителей на следующий раунд; без галочек вредители выбираются случайно. Очки: 3 за победу своей стороны и 1 за каждый верный ответ.' : 'В комнате пока никого. Ученики входят со своей страницы игры — ссылка на вкладке «Сервер».'));
        // Отметки за урок: по верным ответам во всех раундах и точности. Сначала предложение, запись в журнал — отдельной кнопкой.
        const mk = el('div', 'cr-marks'), row = el('div', 'cr-tbar cr-imps'), field = (i, label) => { const l = el('label', '', label), inp = el('input'); inp.type = 'number'; inp.min = 1; inp.max = 200; inp.value = need[i]; inp.dataset.need = i; inp.addEventListener('change', () => { need[i] = Math.max(1, Math.round(Number(inp.value)) || 1); marks = null; draw(true); }); l.append(inp); return l; };
        const ask = async apply => { try { const d = await call('teacher', {className: current, action: 'marks', need, apply}); marks = d; need = d.need; if (apply) say(d.written ? `В журнал записано отметок: ${d.written}.` : 'Новых отметок для журнала нет.'); draw(true); } catch (error) { say(error.message); } };
        const show = button('Показать отметки', 'cr-small', () => ask(false)); show.dataset.act = 'marks';
        row.append(el('span', '', 'Верных ответов за урок:'), field(0, 'на «3»'), field(1, 'на «4»'), field(2, 'на «5»'), show);
        mk.append(el('h2', '', 'Отметки за урок'), row, el('p', 'cr-note', 'На «5» нужна ещё точность не ниже 70 %, на «4» — не ниже 50 %. Двоек игра не ставит: кому не хватило ответов, остаётся без отметки. Роль и победа на отметку не влияют.'));
        if (marks) { const t = el('table', 'cr-table'), h = el('tr'); for (const x of ['Ученик', 'Верно', 'Ошибок', 'Точность', 'Раундов', 'Отметка']) h.append(el('th', '', x)); t.append(h);
          for (const m of marks.marks) { const tr = el('tr'); tr.append(el('td', '', m.name), el('td', '', String(m.right)), el('td', '', String(m.wrong)), el('td', '', m.right + m.wrong ? m.acc + ' %' : '—'), el('td', '', String(m.rounds)), el('td', m.mark ? 'cr-mark' : '', m.mark ? String(m.mark) : '—')); t.append(tr); }
          const n = marks.marks.filter(m => m.mark).length, send = button(`Записать в журнал: ${n}`, 'cr-main', () => { if (confirm(`Записать в журнал ${n} отметок класса ${current} за игру «Сбой на станции»? Прежняя отметка за эту игру обновится, если новая не ниже.`)) ask(true); }); send.dataset.act = 'marks-apply'; send.disabled = !n || !marks.journal;
          mk.append(t, send); if (!marks.journal) mk.append(el('p', 'cr-note', 'Журнал к игре не подключён: отметки можно только посмотреть.')); }
        wrap.append(mk);
        return wrap;
      },
      chat(v) {
        const wrap = el('div', 'cr-cols'), left = el('div'), right = el('div'), log = el('div', 'cr-chat big');
        for (const c of v.chat) { const line = el('p', 'cr-msg' + (c.ch === 'sys' ? ' sys' : c.ch === 'ghost' ? ' ghost' : c.ch === 'teacher' ? ' teacher' : '')); if (c.ch === 'teacher') line.append(el('b', '', 'Учитель: ')); else if (c.ch !== 'sys') { const who = el('b', '', c.name + (c.ch === 'ghost' ? ' (откл.)' : '') + ': '); who.style.color = c.color; line.append(who); }
          line.append(document.createTextNode(c.text)); if (c.ch !== 'sys') { const x = button('×', 'cr-x', () => act('delmsg', {msg: c.id})); x.title = 'Удалить сообщение у всех'; x.setAttribute('aria-label', 'Удалить сообщение'); line.append(x); } log.append(line); }
        const form = el('form', 'cr-chatform'), input = el('input'); input.maxLength = 200; input.placeholder = 'Объявление всему классу…'; input.setAttribute('aria-label', 'Объявление классу'); input.dataset.keep = 'announce';
        form.append(input, button('Объявить', 'cr-main', () => form.requestSubmit())); form.addEventListener('submit', e => { e.preventDefault(); const text = input.value.trim(); if (text) { input.value = ''; act('announce', {text}); } });
        left.append(el('h2', '', `Чат класса ${v.className}`), log, form, el('p', 'cr-note', 'Объявление появляется у всех в чате и крупной полосой поверх игры на 9 секунд.'));
        const bar = el('div', 'cr-tbar'); bar.append(big(v.settings.chat ? 'Выключить чат классу' : 'Включить чат классу', 'cr-small', 'settings', {settings: {chat: !v.settings.chat}}), big('Очистить чат', 'cr-small', 'clearchat', {}, true, 'Удалить все сообщения у всех игроков?'));
        const ul = el('ul', 'cr-mutes'); for (const p of v.players) { const li = el('li'), dot = el('i'); dot.style.background = p.color; li.append(dot, el('span', '', p.name), big(p.muted ? 'вернуть чат' : 'без чата', 'cr-small', 'mute', {id: p.id})); if (p.muted) li.classList.add('muted'); ul.append(li); }
        right.append(el('h2', '', 'Модерация'), bar, ul, el('p', 'cr-note', 'Грубые слова из короткого списка заменяются звёздочками сами; остальное удаляйте крестиком. Чат отключённых игроков живые не видят, вы видите всё.'));
        wrap.append(left, right); wrap.dataset.scroll = '1'; return wrap;
      },
      settings(v) {
        const wrap = el('div'), bar = el('div', 'cr-tbar'), set = el('div', 'cr-settings');
        for (const [name, values] of Object.entries(PRESETS)) bar.append(button(name, 'cr-small', () => act('settings', {settings: {sabotage: true, ...values}}).then(() => say('Набор «' + name + '» применён.'))));
        const num = (key, label, min, max, hint) => { const l = el('label', '', label), i = el('input'); i.type = 'number'; i.min = min; i.max = max; i.value = v.settings[key]; i.dataset.set = key; i.addEventListener('change', () => act('settings', {settings: {[key]: Math.round(Number(i.value)) || 0}})); l.append(i, el('small', '', hint)); return l; };
        const flag = (key, label) => { const l = el('label', 'cr-check'), i = el('input'); i.type = 'checkbox'; i.checked = v.settings[key]; i.dataset.flag = key; i.addEventListener('change', () => act('settings', {settings: {[key]: i.checked}})); l.append(i, label); return l; };
        set.append(num('imposters', 'Вредителей', 0, 6, '0 — по числу игроков: 1 до 6 человек, 2 до 12, дальше 3'), num('tasks', 'Заданий на игрока', 3, 8, 'больше заданий — длиннее раунд'), num('meeting', 'Собрание, секунд', 30, 180, 'время на обсуждение и голосование'),
          num('cooldown', 'Перезарядка импульса, с', 10, 60, 'как часто вредитель может заражать'), num('infect', 'Задержка отключения, с', 5, 20, 'больше — труднее вычислить вредителя'), num('emergency', 'Экстренных собраний на игрока', 0, 3, '0 — собрание только по находке'),
          num('sabotageTime', 'Время на починку реактора, с', 30, 90, ''), num('minPlayers', 'Минимум игроков', 3, 10, 'меньше четырёх играть скучно'), flag('sabotage', ' Вредители могут устраивать аварии (реактор, свет, двери)'), flag('roles', ' Особые роли экипажа: инженер (от 5 игроков) и медик (от 7)'), flag('voteStart', ' Игроки сами запускают раунд: «Готов» у больше половины экипажа'), flag('reveal', ' Объявлять роль исключённого'), flag('chat', ' Чат включён'));
        const maps = el('div', 'cr-tbar'); for (const [id, name] of [...Object.values((over && over.worlds) || {}).map(w => [w.id, w.name]), ['random', 'Случайная каждый раунд']]) { const b = button(name, 'cr-small' + (v.settings.map === id ? ' cr-on' : ''), () => act('settings', {settings: {map: id}})); b.dataset.map = id; maps.append(b); }
        wrap.append(el('h2', '', 'Локация'), maps, el('h2', '', 'Готовые наборы'), bar, el('h2', '', `Настройки класса ${v.className}`), set, el('p', 'cr-note', 'Настройки действуют сразу и хранятся, пока комната класса существует. Число заданий и экстренных собраний применяется со следующего раунда.'));
        return wrap;
      },
      server(v) {
        const wrap = el('div', 'cr-cols'), left = el('div'), right = el('div'), o = over; if (!o) { wrap.append(el('p', 'cr-note', 'Запрашиваем состояние сервера…')); return wrap; }
        const facts = el('div', 'cr-facts'), fact = (k, t, cls) => { const d = el('div', cls || ''); d.append(el('small', '', k), el('b', '', t)); facts.append(d); };
        fact('Сервер игры', 'работает', 'good'); fact('Вход в игру', o.server.open ? 'открыт' : 'закрыт', o.server.open ? 'good' : 'bad'); fact('Работает без перезапуска', clock(o.server.up)); fact('Комнат · игроков', `${o.rooms.length} · ${o.rooms.reduce((a, r) => a + r.on, 0)}`); fact('Запросов в секунду', rate.toFixed(0)); fact('Версия модуля', o.server.version || '—');
        const bar = el('div', 'cr-tbar');
        bar.append(button('🖥 Экран для проектора', 'cr-small cr-bigbtn', () => window.open(location.pathname + '#screen-' + encodeURIComponent(current), '_blank')), big(o.server.open ? '⏻ Закрыть игру для всех' : '⏻ Открыть игру для всех', o.server.open ? 'cr-small cr-bigbtn' : 'cr-main cr-huge', 'open'), big('Распустить все комнаты', 'cr-small cr-bigbtn', 'clearall', {}, o.rooms.length > 0, 'Удалить комнаты всех классов вместе с игроками и очками?'));
        const link = el('input'); link.readOnly = true; link.value = pupilUrl(); link.className = 'cr-link'; link.setAttribute('aria-label', 'Ссылка для учеников'); link.dataset.keep = 'link';
        const push = button('Открыть игру на компьютерах кабинета', 'cr-main', async () => { if (!confirm(`Открыть страницу игры ${gradeSel.value} класса на всех компьютерах кабинета?`)) return; try { const r = await fetch('/results/api/classroom/open-url', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: pupilUrl()})}), d = await r.json().catch(() => ({})); say(d.message || (r.ok ? 'Команда передана компьютерам.' : 'Не удалось передать команду.')); } catch { say('Не удалось передать команду компьютерам.'); } }); push.dataset.act = 'push';
        left.append(el('h2', '', 'Состояние'), facts, bar, el('h2', '', `Как ученикам попасть в игру (${gradeSel.value} класс)`), link, el('div', 'cr-tbar')); left.lastChild.append(push, button('Скопировать ссылку', 'cr-small', () => { link.select(); try { navigator.clipboard.writeText(link.value); } catch { document.execCommand('copy'); } say('Ссылка скопирована.'); }));
        left.append(el('p', 'cr-note', '«Закрыть игру» запрещает новым ученикам входить во все комнаты; те, кто уже играет, остаются. Кнопка для кабинета использует ту же функцию портала, что и «Передать страницу на компьютеры».'));
        const table = el('table', 'cr-table'), hr = el('tr'); for (const h of ['Класс', 'Состояние', 'Раунд', 'На связи', '']) hr.append(el('th', '', h)); table.append(hr);
        for (const r of o.rooms) { const tr = el('tr', r.className === current ? 'cur' : ''), td = el('td', 'cr-acts'); td.append(button('управлять', 'cr-small', () => { tab = 'round'; setClass(r.className); }), button('распустить', 'cr-small', async () => { if (!confirm(`Удалить комнату ${r.className} и всех игроков из неё?`)) return; try { await call('teacher', {className: r.className, action: 'clear'}); } catch {} poll(); }));
          tr.append(el('td', '', r.className), el('td', '', phaseName(r)), el('td', '', String(r.round)), el('td', '', `${r.on} из ${r.players}`), td); table.append(tr); }
        right.append(el('h2', '', 'Комнаты всех классов'), o.rooms.length ? table : el('p', 'cr-note', 'Комнат пока нет: комната класса появляется, когда входит первый ученик или вы выбираете класс на пульте.'));
        const help = el('details', 'cr-help'); help.append(el('summary', '', 'Если сервер игры не отвечает'), el('p', '', 'Сервер игры — часть службы школьного журнала и запускается вместе с ней при включении ноутбука. Перезапустить службу со страницы нельзя: это делается в обычном окне терминала командой'), el('pre', '', 'sudo systemctl restart school4-test-results'), el('p', '', 'После перезапуска все комнаты и очки обнуляются, оценки в журнале не затрагиваются.'));
        right.append(help); wrap.append(left, right); return wrap;
      },
    };

    function draw(force) {
      for (const b of tabs.children) b.classList.toggle('on', b.dataset.tab === tab);
      if (down) { status.textContent = ''; const box = el('div', 'cr-down');
        if (down === 'deny') box.append(el('h2', '', 'Пульт доступен только с учительского ноутбука'), el('p', '', 'Сервер не узнал этот компьютер как учительский.'));
        else box.append(el('h2', '', 'Сервер игры не запущен'), el('p', '', 'Модуль игры установлен, но служба журнала ещё не перезапускалась. Откройте обычное окно терминала на этом ноутбуке и выполните:'), el('pre', '', 'sudo systemctl restart school4-test-results'), el('p', '', 'Команда спросит ваш пароль. Через несколько секунд эта страница сама увидит сервер. Оценки в журнале при перезапуске не затрагиваются.'));
        body.replaceChildren(box); return; }
      const v = view; if (!v) return;
      status.textContent = `${v.className}: ${phaseName(v)}${v.locked ? ' · вход закрыт' : ''}${over && !over.server.open ? ' · игра закрыта для всех' : ''}`; status.classList.toggle('bad', !!v.paused);
      // Не перерисовываем вкладку, пока учитель печатает или держит открытое поле.
      const a = document.activeElement; if (!force && a && body.contains(a) && ['INPUT', 'SELECT'].includes(a.tagName) && a.type !== 'checkbox') return;
      const keep = {}; for (const i of body.querySelectorAll('[data-keep]')) keep[i.dataset.keep] = i.value;
      const oldLog = body.querySelector('.cr-chat.big'), atEnd = !oldLog || oldLog.scrollTop + oldLog.clientHeight >= oldLog.scrollHeight - 30, top = oldLog ? oldLog.scrollTop : 0, open = body.querySelector('details')?.open;
      body.replaceChildren(VIEWS[tab](v)); body.dataset.view = tab;
      for (const i of body.querySelectorAll('[data-keep=announce]')) if (keep.announce) i.value = keep.announce;
      const log = body.querySelector('.cr-chat.big'); if (log) log.scrollTop = atEnd ? log.scrollHeight : top; if (open) body.querySelector('details').open = true;
      if (debugHost) window.crewTeacher = {...v, tab, server: over && over.server, rooms: over && over.rooms, pick: [...pick]};
    }
    page.append(head, tabs, toast, body); root.replaceChildren(page); history.replaceState(null, '', '#pult'); setClass(/^\d+ «.»$/.test(current || '') ? current : `${data.grade} «А»`); timer = setInterval(poll, 1200);
  }

  /* ---------------- экран для проектора ---------------- */
  // Для доски: без ролей и без того, кто где стоит. Открывается с пульта кнопкой «Экран для проектора».
  function screen(className) {
    stop(); let view = null; const page = el('section', 'cr-screen'), body = el('div');
    const phase = v => v.paused ? 'ПАУЗА' : {lobby: 'СБОР ЭКИПАЖА', play: 'СМЕНА ИДЁТ', meeting: 'СОБРАНИЕ', result: 'ИТОГ ГОЛОСОВАНИЯ', end: 'РАУНД ОКОНЧЕН'}[v.phase];
    async function poll() { try { view = await call('teacher', {className, action: 'screen'}); draw(); } catch (e) { body.replaceChildren(el('p', 'cr-note', 'Нет связи с сервером игры: ' + e.message)); } }
    function draw() {
      const v = view, head = el('header', 'cr-sc-head'), left = el('div', 'cr-sc-main'), right = el('div', 'cr-sc-side'), cols = el('div', 'cr-sc-cols');
      head.append(el('span', '', `Сбой на станции · ${v.className} · раунд ${v.round}`), el('strong', '', phase(v)));
      const bar = el('div', 'cr-sc-bar'), fill = el('i'); fill.style.width = (v.progress[1] ? v.progress[0] / v.progress[1] * 100 : 0) + '%'; bar.append(fill);
      left.append(el('p', 'cr-sc-label', `Задания экипажа: ${v.progress[0]} из ${v.progress[1]}` + (v.phase === 'play' ? ' (обновляется на собраниях)' : '')), bar);
      if (v.sabotage) left.append(el('p', 'cr-sc-alert', v.sabotage.kind === 'lights' ? 'ПОГАС СВЕТ!' : v.sabotage.kind === 'doors' ? `ДВЕРИ ЗАПЕРТЫ · ${v.sabotage.left} с` : `АВАРИЯ РЕАКТОРА · ${v.sabotage.left} с`));
      if (v.meeting) left.append(el('p', 'cr-sc-meet', v.meeting.result || `${v.meeting.reason === 'body' ? 'Найден отключённый: ' + v.meeting.body : 'Экстренное собрание'} · осталось ${v.meeting.left} с · проголосовали ${v.meeting.voted}`));
      if (v.phase === 'end') left.append(el('p', 'cr-sc-meet', (v.winner === 'crew' ? 'Победил экипаж: ' : 'Победили вредители: ') + v.why), el('p', 'cr-sc-meet', `${(v.imps || []).length > 1 ? 'Вредителями были' : 'Вредителем был'}: ${(v.imps || []).join(', ') || '—'}`), el('p', 'cr-sc-meet', `Победители: ${(v.winners || []).join(', ') || '—'}`));
      if (v.ready && v.ready.on && (v.phase === 'lobby' || v.phase === 'end')) left.append(el('p', 'cr-sc-meet', v.ready.startIn >= 0 ? `Старт через ${v.ready.startIn} с!` : `Готовы к раунду: ${v.ready.votes} из ${v.ready.need}`));
      const grid = el('div', 'cr-sc-grid'); for (const p of v.players) { const t = el('div', 'cr-sc-p' + (p.out ? ' out' : '') + (p.on ? '' : ' off')), dot = el('i'); dot.style.background = p.color; t.append(dot, el('b', '', p.name.split(' ').slice(0, 2).join(' ')));
        if (p.role) t.append(el('em', p.role === 'imp' ? 'imp' : '', p.role === 'imp' ? 'вредитель' : p.job === 'engineer' ? 'инженер' : p.job === 'medic' ? 'медик' : 'экипаж')); else if (p.out) t.append(el('em', '', 'отключён')); grid.append(t); }
      left.append(grid);
      const chat = el('div', 'cr-chat big'); for (const c of v.chat) { const line = el('p', 'cr-msg' + (c.ch === 'sys' ? ' sys' : c.ch === 'teacher' ? ' teacher' : '')); if (c.ch !== 'sys') { const who = el('b', '', (c.ch === 'teacher' ? 'Учитель' : c.name.split(' ')[0]) + ': '); if (c.color) who.style.color = c.color; line.append(who); } line.append(document.createTextNode(c.text)); chat.append(line); }
      right.append(el('h2', '', 'Связь'), chat); cols.append(left, right); body.replaceChildren(head, cols); chat.scrollTop = chat.scrollHeight;
      if (debugHost) window.crewScreen = v;
    }
    page.append(body); root.replaceChildren(page); poll(); setInterval(poll, 1000);
  }

  login();
})();
