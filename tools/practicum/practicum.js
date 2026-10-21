// Игровой практикум: ученик выбирает себя, затем игру из списка. Страница хранит прогресс на сервере
// (тот же модуль, что у тренажёра «Кодоград») и по кнопке отправляет отметку в журнал.
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('assignmentData').textContent), P = data.practicum, root = document.getElementById('practicum');
  const API = '/results/api/trainer/', LETTERS = 'АБВГДЕЖЗИК', STORE = 'school4-practicum:v1:' + P.apiSlug, GRADING = {three: 33, four: 60, five: 80};
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const button = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const norm = s => String(s).trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  // Доступность: текст только для экранного чтения, скрытие декоративных узлов, подпись кнопки.
  const scroller = label => { const w = el('div', 'p-tablewrap'); w.tabIndex = 0; w.setAttribute('role', 'region'); w.setAttribute('aria-label', label); return w; };   // таблица с прокруткой: доступна с клавиатуры
  const sr = text => el('span', 'p-sr', text), hide = n => { n.setAttribute('aria-hidden', 'true'); return n; }, named = (n, label) => { n.setAttribute('aria-label', label); return n; };
  // Окно поверх страницы: фон недоступен (inert) — Tab не уходит под окно; Esc закрывает; фокус возвращается туда, где был.
  function layer(top, dlg, label, shut) {
    dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.setAttribute('aria-label', label);
    const back = document.activeElement, off = [...document.body.children].filter(n => n !== top && !n.inert && n.tagName !== 'SCRIPT');
    off.forEach(n => { n.inert = true; });
    top.addEventListener('keydown', e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); shut(); } });
    let once = false; return () => { if (once) return; once = true; off.forEach(n => { n.inert = false; }); if (back && back.isConnected && back !== document.body) back.focus(); };
  }
  // Смена экрана не теряет фокус клавиатуры: та же кнопка (по data-атрибуту) в новой разметке или заголовок экрана.
  let booted = false;
  const focusSel = () => { const a = document.activeElement; if (!a || !root.contains(a)) return null; for (const k of ['play', 'act', 'daily', 'warmup', 'review', 'mark', 'profile', 'join']) if (a.dataset[k] != null) return `[data-${k}="${CSS.escape(a.dataset[k])}"]`; return null; };
  function paint(...nodes) {
    const a = document.activeElement, had = booted && (!a || a === document.body || root.contains(a)), sel = focusSel();
    root.replaceChildren(...nodes); booted = true;
    if (!had || document.querySelector('.p-player, .pf-modal')) return;
    const t = (sel && root.querySelector(sel)) || root.querySelector('h1, h2'); if (!t) return;
    if (!t.matches('button, a, input, select')) t.tabIndex = -1; t.focus({preventScroll: !sel});
  }
  let store = {}; try { store = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch {}
  store.profiles = store.profiles || {};
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(store)); } catch {} };
  let classes = null, remote = false, player = null, frame = null, current = null, notice = '';
  // Единый вход: ученик называет себя один раз, все игры практикума берут имя отсюда (sessionStorage вкладки) и не дают его менять.
  // На общих компьютерах вход сбрасывается после IDLE минут без нажатий и движений мыши — следующий ученик не попадёт в чужой профиль.
  const WHO = 'school4-who', IDLE = 20 * 60000;
  const remember = () => { try { sessionStorage.setItem(WHO, JSON.stringify({grade: data.grade, className: player.className, name: player.name, at: Date.now()})); } catch {} };
  let touched = 0; const touch = () => { const t = Date.now(); if (!player || t - touched < 20000) return; touched = t; remember(); };
  const forget = why => { close(false); player = null; try { sessionStorage.removeItem(STORE); sessionStorage.removeItem(WHO); } catch {} notice = why || ''; login(); };
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, touch, true);
  setInterval(() => { let w = null; try { w = JSON.parse(sessionStorage.getItem(WHO) || 'null'); } catch {} if (player && (!w || Date.now() - w.at > IDLE)) forget('Вход завершён: долго не было действий. Войди под своим именем ещё раз.'); }, 30000);

  async function call(path, body, ms = 8000) {
    const response = await fetch(API + path, {method: body ? 'POST' : 'GET', headers: body ? {'Content-Type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(ms)});
    const d = await response.json().catch(() => ({}));
    if (!response.ok || d.status !== 'ok') { const error = new Error(d.message || 'сервер не ответил'); error.status = response.status; throw error; }
    return d;
  }
  const who = () => ({slug: P.apiSlug, className: player.className, name: player.name});
  const playerKey = () => { let h = 5381; for (const c of norm(player.className + '|' + player.name)) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return 'g' + data.grade + h.toString(36); };
  const stars = game => { let s = 0; for (let n = 1; n <= game.levels; n++) s += player.levels[game.id + '-' + n]?.stars || 0; return s; };
  const done = game => { let s = 0; for (let n = 1; n <= game.levels; n++) if (player.levels[game.id + '-' + n]) s++; return s; };
  const markOf = game => { const pct = stars(game) / (3 * game.levels) * 100; return pct >= GRADING.five ? 5 : pct >= GRADING.four ? 4 : pct >= GRADING.three ? 3 : 2; };
  const need = (game, pct) => Math.ceil(3 * game.levels * pct / 100 - 1e-9);

  function merge(levels) {
    for (const [id, rec] of Object.entries(levels || {})) if (!player.levels[id] || rec.stars > player.levels[id].stars) player.levels[id] = rec;
  }
  async function pull() { const d = await call('progress?' + new URLSearchParams(who())); player.name = d.name; merge(d.levels); player.sent = d.sent || {}; save(); }
  let pushing = null;
  function push() {
    // Прогресс уходит на сервер после каждого пройденного этапа; сбой не мешает игре.
    if (!remote || !player) return Promise.resolve();
    const mine = player;
    pushing = (pushing || Promise.resolve()).catch(() => {}).then(() => call('progress', {...who(), levels: mine.levels})).then(d => { mine.unsent = false; if (mine === player) { merge(d.levels); save(); } }, e => { mine.unsent = true; save(); throw e; });
    return pushing;
  }
  // Если связь с сервером моргнула, звёзды не теряются: они лежат на этом компьютере и уходят повторно каждые 20 секунд.
  setInterval(() => { if (player && player.unsent && remote) push().then(stats).catch(() => {}); }, 20000);

  function login() {
    const box = el('section', 'p-login'), form = el('form');
    box.append(el('p', 'p-eyebrow', `${data.grade} класс · игровой практикум`), el('h1', '', 'Кто играет?'), el('p', 'p-lead', 'Выбери свой класс и себя: звёзды и отметки будут записываться на твоё имя.'));
    const letter = el('select'); letter.id = 'p-who-class';
    const listed = classes ? Object.keys(classes.roster) : [];
    for (const l of LETTERS) { const name = `${data.grade} «${l}»`, o = el('option', '', name + (listed.includes(name) ? '' : '')); o.value = name; letter.append(o); }
    if (store.lastClass) letter.value = store.lastClass;
    const slot = el('div', 'p-name');
    function names() {
      const list = classes?.roster?.[letter.value] || [];
      slot.replaceChildren();
      if (list.length) { const pick = el('select'); pick.dataset.field = 'name'; pick.id = 'p-who-name'; const none = el('option', '', '— выбери себя —'); none.value = ''; pick.append(none); for (const n of list) { const o = el('option', '', n); o.value = n; pick.append(o); } slot.append(pick); }
      else { const input = el('input'); input.dataset.field = 'name'; input.placeholder = 'Фамилия Имя'; input.autocomplete = 'off'; input.maxLength = 80; input.id = 'p-who-name'; input.setAttribute('aria-describedby', 'p-who-status'); slot.append(input); }
    }
    letter.addEventListener('change', names); names();
    const status = el('p', 'p-status'); status.setAttribute('role', 'status'); status.id = 'p-who-status';
    const lab = (text, id) => { const l = el('label', '', text); l.htmlFor = id; return l; };
    form.append(lab('Класс', 'p-who-class'), letter, lab('Фамилия и имя', 'p-who-name'), slot, button('Войти →', 'p-primary', () => form.requestSubmit()), status);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const field = slot.querySelector('[data-field=name]'), name = field.value.trim().replace(/\s+/g, ' ');
      field.removeAttribute('aria-invalid');
      if (name.length < 5 || !name.includes(' ')) { status.textContent = 'Укажи фамилию и имя.'; field.setAttribute('aria-invalid', 'true'); field.focus(); return; }
      const key = norm(letter.value + '|' + name);
      player = store.profiles[key] = store.profiles[key] || {className: letter.value, name, levels: {}, sent: {}};
      store.lastClass = letter.value; store.last = key; save();
      if (remote) { status.textContent = 'Загружаем твой прогресс…'; try { await pull(); await push(); } catch (error) { if (error.status === 403) { player = null; status.textContent = error.message; return; } notice = 'Сервер не ответил: прогресс пока хранится только на этом компьютере.'; } }
      try { sessionStorage.setItem(STORE, key); } catch {}
      remember(); notice = ''; await stats(); list();
    });
    if (!remote) box.append(el('p', 'p-note', 'Журнал сейчас недоступен: играть можно, но отметки не отправятся.'));
    box.append(form); paint(box);
  }

  // Учитель (учительский ноутбук) видит на экране входа панель со всеми своими разделами. Адрес #teacher открывает её сразу.
  async function isTeacher() {
    try { const r = await fetch('/results/api/practicum/ping', {cache: 'no-store'}); if (r.ok) return !!(await r.json()).teacher; } catch {}
    // Модуль практикума ещё не подключён (журнал не перезапущен) — спрашиваем раздел учителя тренажёра: он закрыт для учеников.
    try { const r = await fetch('/results/api/trainer/overview?slug=' + encodeURIComponent(P.apiSlug), {cache: 'no-store'}); return r.ok; } catch { return false; }
  }
  async function teacherProbe() {
    if (!(await isTeacher()) || player) return; const box = root.querySelector('.p-login'); if (!box) return;
    const g = data.grade, panel = el('section', 'p-tpanel'), grid = el('div', 'p-tlinks');
    const link = (icon, title, note, href, act) => { const a = el('a', 'p-tlink'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.append(el('b', '', icon + ' ' + title), el('span', '', note), sr(' (откроется в новой вкладке)')); if (act) a.dataset.act = act; grid.append(a); };
    { const hb = button('', 'p-tlink p-tbtn', () => healthView()); hb.append(el('b', '', '🩺 Состояние сервиса'), el('span', '', 'Какие части школьного сервера работают и нужен ли перезапуск')); hb.dataset.act = 'health'; grid.append(hb); }
    { const bt = button('', 'p-tlink p-tbtn', () => battleTeacher()); bt.append(el('b', '', '⚔ Битва класса'), el('span', '', 'Викторины всем классом: 17 типов вопросов, 5 режимов, «Восхождение», проектор, отчёты')); bt.dataset.act = 'battle-teacher'; grid.append(bt); }
    link('🚀', '«Сбой на станции» — пульт', 'Запуск раунда, роли, камеры, отметки, экран для проектора', `/courses/game-${g}-crew/#pult`, 'crew-pult');
    link('⌨️', 'Турнир «Побег от Тенегрыза»', 'Запуск турнира класса и рекорды', `/courses/game-${g}-typing-escape/?all=1`);
    link('🏁', 'Гонка алгоритмов всем классом', 'Состязание класса в «Лаборатории»', `/courses/game-${g}-lab/?all=1&play=race`);
    link('📚', 'Кодоград: панель учителя', 'Списки классов, прогресс, сброс профилей', `/courses/trainer-${g}-kodograd/?all=1`);
    link('👾', 'Битва с Глюком', 'Прогресс по боссам и отметки', `/courses/trainer-${g}-glitch/?all=1`);
    const stats = button('', 'p-tlink p-tbtn', () => teacherView(`${g} «А»`)); stats.append(el('b', '', '📊 Статистика практикума'), el('span', '', 'Звёзды, ранги, серии и значки учеников по классам')); stats.dataset.act = 'teacher'; grid.prepend(stats);
    panel.append(el('p', 'p-eyebrow', `УЧИТЕЛЮ · ${g} КЛАСС`), el('p', 'p-note', 'Эта панель видна только на учительском ноутбуке. Разделы открываются в новой вкладке; класс и букву можно сменить внутри раздела.'), grid);
    const other = el('nav', 'p-grades'); other.setAttribute('aria-label', 'Панель другой параллели'); other.append(el('span', '', 'Панель другой параллели:')); for (let n = 6; n <= 11; n++) { const a = el('a', n === g ? 'now' : '', String(n)); if (n === g) a.setAttribute('aria-current', 'page'); a.href = `/courses/game-${n}-practicum/#teacher`; other.append(a); } panel.append(other);
    box.after(panel); if (location.hash === '#teacher') panel.scrollIntoView({block: 'start'});
  }
  /* ---------- профиль ученика: инфографика ---------- */
  // Те же данные, что считает сервер для ученика: ранг, счётчики, навыки по темам, неделя, лига, значки, готовность к отметке.
  function profileView(d, back, who) {
    const NS = 'http://www.w3.org/2000/svg', sv = (tag, a = {}) => { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, a[k]); return n; };
    const page = el('section', 'pf'), st = d.stats, initials = (w => (w.length > 1 ? w[1][0] + w[0][0] : w[0].slice(0, 2)))(d.name.split(/\s+/)).toUpperCase();   // «Фамилия Имя» → «ИФ»
    const top = el('div', 'pf-top'); top.append(button('← ' + (who === 'teacher' ? 'К таблице класса' : 'К играм'), 'p-small', back), el('p', 'p-eyebrow', who === 'teacher' ? 'УЧИТЕЛЮ · ПРОФИЛЬ УЧЕНИКА' : 'МОЙ ПРОФИЛЬ'), el('span', 'pf-sp'));
    if (who === 'me' && d.avatar) { const ab = button('🤖 Сменить аватар', 'p-small', () => avatarPicker(d)); ab.dataset.act = 'avatar'; top.append(ab); }
    const pr = button('🖨 Отчёт для родителей', 'p-small', () => print()); pr.dataset.act = 'print'; top.append(pr);
    page.append(el('h1', 'p-sr', (who === 'teacher' ? 'Профиль ученика: ' : 'Мой профиль: ') + d.name), el('p', 'pf-printhead', `Игровой практикум по информатике · ${d.className} · ${new Date().toLocaleDateString('ru-RU')}`));
    const grid = el('div', 'pf-grid');
    // Карточка игрока: аватар с кольцом прогресса ранга
    const card = el('div', 'pf-card pf-player'), ring = sv('svg', {viewBox: '0 0 300 300', class: 'pf-ring', 'aria-hidden': 'true'}), C = 2 * Math.PI * 128;
    const defs = sv('defs'), lg = sv('linearGradient', {id: 'pfg', x1: 0, y1: 0, x2: 1, y2: 1}); lg.append(sv('stop', {offset: 0, 'stop-color': '#ffd34d'}), sv('stop', {offset: 1, 'stop-color': '#ff6f91'})); defs.append(lg);
    const arc = sv('circle', {cx: 150, cy: 150, r: 128, fill: 'none', stroke: 'url(#pfg)', 'stroke-width': 18, 'stroke-linecap': 'round', 'stroke-dasharray': C, 'stroke-dashoffset': C, transform: 'rotate(-90 150 150)', class: 'pf-arc'});
    ring.append(defs, sv('circle', {cx: 150, cy: 150, r: 128, fill: 'none', stroke: 'rgba(255,255,255,.08)', 'stroke-width': 18}), arc);
    const ava = el('div', 'pf-ava', initials), wrap = el('div', 'pf-avawrap'); hide(wrap).append(ring, ava);
    if (d.avatar) { const im = new Image(); im.alt = ''; im.src = `art/avatar_${d.avatar.idx}.webp?v=${P.artVersion || ''}`; im.addEventListener('load', () => { ava.textContent = ''; ava.append(im); ava.classList.add('pic'); }); }
    const bar = hide(el('div', 'pf-bar')), fill = el('i'); bar.append(fill);
    card.append(wrap, el('h2', 'pf-name', d.name), el('p', 'pf-cls', `${d.className} · Игровой практикум`), el('p', 'pf-rank', '⚙ ' + st.rank), el('p', 'pf-next', st.rankNext ? `до ранга «${st.rankNext}» — ещё ★ ${st.rankNeed}` : 'Высший ранг!'), bar);
    // Счётчики
    const tiles = el('div', 'pf-tiles'); const counters = [];
    for (const [ic, n, l] of [['★', st.stars, 'звёзд'], ['▲', st.done, 'этапов пройдено'], ['✦', st.three, 'на три звезды'], ['◆', st.games, 'игр со звёздами']]) { const tl = el('div', 'pf-card pf-tile'), num = el('b', 'pf-num', '0'); tl.append(hide(el('span', 'pf-ic', ic)), hide(num), hide(el('small', '', l)), sr(`${n} ${l}`)); tiles.append(tl); counters.push([num, n]); }
    // Неделя: задание дня и звёзды по дням
    const wk = el('div', 'pf-card pf-week'), days = el('div', 'pf-days'), mx = Math.max(1, ...d.week.map(x => x.stars));
    wk.append(el('p', 'pf-h', `ЗАДАНИЕ ДНЯ · СЕРИЯ ${d.daily ? d.daily.streak : 0}`), days);
    for (const x of d.week) { const c = el('div', 'pf-day' + (x.daily ? ' on' : '')), col = el('i'); col.style.setProperty('--h', Math.round(x.stars / mx * 100) + '%'); c.title = `${x.date}: ★ ${x.stars}${x.daily ? ', задание дня выполнено' : ''}`; c.append(hide(el('span', 'pf-flame', x.daily ? '🔥' : '')), col, hide(el('small', '', x.day)), hide(el('em', '', x.stars ? '★' + x.stars : '')), sr(`${x.day}: звёзд ${x.stars}${x.daily ? ', задание дня выполнено' : ''}`)); days.append(c); }
    // Паутина навыков
    const sk = el('div', 'pf-card pf-skills'), N = d.skills.length, R0 = 150, pt = (i, r) => [Math.cos(-Math.PI / 2 + i * 2 * Math.PI / N) * r, Math.sin(-Math.PI / 2 + i * 2 * Math.PI / N) * r];
    sk.append(el('p', 'pf-h', 'НАВЫКИ ПО ТЕМАМ'));
    if (N >= 3) { const radar = sv('svg', {viewBox: '-330 -215 660 430', class: 'pf-radar', role: 'img', 'aria-label': 'Навыки: ' + d.skills.map(x => `${x.area} ${Math.round(x.pct * 100)}%`).join(', ')});
      for (const f of [.25, .5, .75, 1]) radar.append(sv('polygon', {points: d.skills.map((_, i) => pt(i, R0 * f).join(',')).join(' '), fill: 'none', stroke: 'rgba(255,255,255,.12)', 'stroke-width': 2}));
      d.skills.forEach((_, i) => radar.append(sv('line', {x1: 0, y1: 0, x2: pt(i, R0)[0], y2: pt(i, R0)[1], stroke: 'rgba(255,255,255,.1)', 'stroke-width': 2})));
      const poly = sv('polygon', {points: d.skills.map((x, i) => pt(i, R0 * Math.max(.04, x.pct)).join(',')).join(' '), fill: 'rgba(58,210,159,.35)', stroke: '#3ad29f', 'stroke-width': 4, 'stroke-linejoin': 'round', class: 'pf-poly'}); radar.append(poly);
      d.skills.forEach((x, i) => { const [px, py] = pt(i, R0 * Math.max(.04, x.pct)), [lx, ly] = pt(i, R0 + 34); radar.append(sv('circle', {cx: px, cy: py, r: 7, fill: '#ffd34d', class: 'pf-poly'})); const tx = sv('text', {x: lx, y: ly, 'text-anchor': Math.abs(lx) < 10 ? 'middle' : lx > 0 ? 'start' : 'end', 'dominant-baseline': 'middle', class: 'pf-lbl'}); tx.textContent = `${x.area} ${Math.round(x.pct * 100)}%`; radar.append(tx); });
      sk.append(radar); } else sk.append(el('p', 'p-note', 'Поиграй в разные игры — здесь появится карта твоих навыков.'));
    // Лига
    const lgc = el('div', 'pf-card pf-league'); lgc.append(el('p', 'pf-h', `ЛИГА КЛАССА ${d.className} · НЕДЕЛЯ`));
    const top3 = d.league.top.slice(0, 3), order = [1, 0, 2].filter(i => top3[i]), podium = el('div', 'pf-podium'), mxs = Math.max(1, ...top3.map(x => x.stars));
    for (const i of order) { const x = top3[i], col = el('div', 'pf-step' + (x.me ? ' me' : '') + ' p' + (i + 1)), h = 40 + 60 * x.stars / mxs; col.style.setProperty('--h', h + '%'); col.append(el('b', '', String(i + 1)), el('strong', '', x.name), el('small', '', '★ ' + x.stars), el('i')); podium.append(col); }
    lgc.append(top3.length ? podium : el('p', 'p-note', 'На этой неделе звёзд ещё никто не получал.'), el('p', 'pf-place', d.league.place ? `${who === 'teacher' ? 'Место' : 'Твоё место'}: ${d.league.place} из ${d.league.size} · ★ ${d.league.stars} за неделю` : 'Пройди этап, чтобы попасть в лигу этой недели.'));
    // Значки
    const bd = el('div', 'pf-card pf-badges'), got = d.badges.filter(b => b.got).length; bd.append(el('p', 'pf-h', `ЗНАЧКИ · ${got} ИЗ ${d.badges.length}`)); const row = el('div', 'pf-brow');
    for (const b of d.badges) { const im = new Image(); im.alt = ''; im.title = `${b.title}: ${b.how}`; im.src = `art/badge_${b.id}.webp?v=${P.artVersion || ''}`; im.className = b.got ? 'got' : ''; const f = el('figure'); f.append(im, el('figcaption', '', b.title), sr(b.got ? ' — получен' : ` — ещё не получен. ${b.how}`)); row.append(f); } bd.append(row);
    // Готовность к отметке
    const gm = el('div', 'pf-card pf-games'); gm.append(el('p', 'pf-h', 'ГОТОВНОСТЬ К ОТМЕТКЕ ПО ИГРАМ'));
    if (!d.games.length) gm.append(el('p', 'p-note', 'Пока нет звёзд ни в одной игре.'));
    for (const g of d.games) { const r = el('div', 'pf-grow'), b2 = hide(el('div', 'pf-gbar')), f2 = el('i'); f2.style.setProperty('--w', Math.round(g.pct * 100) + '%'); b2.append(f2, el('span', 'm3'), el('span', 'm4'), el('span', 'm5'));
      r.append(el('span', 'pf-gname', g.title), b2, el('b', 'pf-gmark k' + g.mark, `${Math.round(g.pct * 100)}% · «${g.mark}»`)); gm.append(r); }
    gm.append(el('p', 'p-note', 'Отметки на полосе: 33 % — «3», 60 % — «4», 80 % — «5». Отметку в журнал ученик отправляет сам кнопкой на карточке игры.'));
    grid.append(card, tiles, wk, sk, lgc, bd, gm); page.append(top, grid); paint(page); scrollTo(0, 0);
    // Анимация: кольцо, полоса ранга, счётчики (уважаем «уменьшить движение»)
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => { page.classList.add('go'); arc.style.strokeDashoffset = C * (1 - st.rankProgress); fill.style.width = Math.round(st.rankProgress * 100) + '%'; });
    const t0 = performance.now(); const tick = now => { const p = still ? 1 : Math.min(1, (now - t0) / 1400), e = 1 - (1 - p) ** 3; for (const [num, n] of counters) num.textContent = Math.round(n * e); if (p < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  }
  // Выбор аватара: открытые — за звёзды, сохраняет сервер.
  function avatarPicker(d) {
    const back = el('div', 'pf-modal'), box = el('div', 'pf-pick'), grid = el('div', 'pf-avgrid'), st = d.stats.stars;
    let release = () => {}; const shut = () => { back.remove(); release(); };
    box.append(el('h2', '', 'Выбери аватар'), el('p', 'p-note', `Новые аватары открываются за звёзды. У тебя ★ ${st}.`), grid, button('Закрыть', 'p-small', shut));
    d.avatar.need.forEach((need, i) => { const open_ = st >= need, b = button('', 'pf-av' + (i === d.avatar.idx ? ' on' : '') + (open_ ? '' : ' locked'), async () => {
        if (!open_) return; try { const r = await fetch('/results/api/practicum/avatar', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...who(), idx: i})}); const j = await r.json(); if (!r.ok || j.status !== 'ok') throw new Error(j.message); d.avatar.idx = i; if (stat()) stat().avatar.idx = i; shut(); profileView(d, list, 'me'); root.querySelector('[data-act=avatar]')?.focus(); } catch (e) { alert('Не получилось: ' + e.message); } });
      const im = new Image(); im.alt = ''; im.src = `art/avatar_${i}.webp?v=${P.artVersion || ''}`; b.append(im, el('small', '', open_ ? (i === d.avatar.idx ? 'выбран' : 'открыт') : `🔒 ★ ${need}`)); b.dataset.avatar = i;
      named(b, `Аватар ${i + 1}: ` + (open_ ? (i === d.avatar.idx ? 'выбран' : 'открыт') : `закрыт, нужно ★ ${need}`)); b.setAttribute('aria-pressed', String(i === d.avatar.idx)); if (!open_) b.setAttribute('aria-disabled', 'true'); grid.append(b); });
    back.append(box); back.addEventListener('click', e => { if (e.target === back) shut(); }); document.body.append(back);
    release = layer(back, box, 'Выбор аватара', shut); (grid.querySelector('.pf-av.on') || box.querySelector('button')).focus();
  }
  /* ---------- битва класса: свой аналог Wayground (battle.js, battle_play.js, battle_teach.js) ---------- */
  let battleTimer = 0, battleRoom = '', battleSoon = 0;
  const BAPI = (path, body) => window.BattleQ.API(path, body);
  const btSkip = () => { try { return sessionStorage.getItem('school4-bt-skip') || ''; } catch { return ''; } };
  async function battleProbe() {
    // Раз в 4 секунды: если учитель открыл игру для класса, ученик попадает в лобби сам — без кодов и QR.
    if (!remote || !player || !window.BattlePlay || document.querySelector('.bt2') || battleSoon) return;
    let d; try { d = await BAPI('status', {className: player.className}); } catch { return; }
    if (!d.open || !player || document.querySelector('.bt2')) return;
    battleRoom = String(d.room);
    if (btSkip() === battleRoom) {   // ученик сам вышел из этой игры — только напоминание на списке игр
      if (root.querySelector('.p-grid') && !document.querySelector('.p-battle-banner')) { const ban = el('div', 'p-battle-banner'), b = button('Вернуться в игру ⚔', 'p-primary', () => battleView()); b.dataset.act = 'battle'; ban.setAttribute('role', 'status'); ban.append(el('strong', '', '⚔ Идёт игра класса'), el('span', '', `«${d.title}» · участников: ${d.players}`), b); (root.querySelector('.p-head') || root.firstChild).after(ban); }
      return; }
    if (frame) {   // ученик в другой игре: предупреждаем и через 5 секунд переводим в лобби
      const ov = el('div', 'p-bt-call'), t = el('b', '', '5'); let n = 5; ov.setAttribute('role', 'alert'); ov.append(el('strong', '', '⚔ Учитель начинает игру класса!'), el('span', '', `«${d.title}» — переходим в лобби через`), t, button('Сейчас', 'p-primary', () => { n = 0; }));
      document.body.append(ov); battleSoon = setInterval(() => { n--; t.textContent = String(Math.max(0, n)); if (n <= 0) { clearInterval(battleSoon); battleSoon = 0; ov.remove(); close(false); battleView(); } }, 1000); return; }
    battleView();
  }
  setInterval(battleProbe, 4000);
  function battleView() { window.BattlePlay.student({root, player: {className: player.className, name: player.name}, leave: () => { try { sessionStorage.setItem('school4-bt-skip', battleRoom); } catch {} list(); }}); }
  function battleTeacher() { window.BattleTeach.teacher({root, grade: data.grade, leave: () => { login(); teacherProbe(); }}); }
  /* ---------- «Кодополия» по сети: лобби класса ---------- */
  const KAPI = (path, body) => fetch('/results/api/kp/' + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), cache: 'no-store'}).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok || d.status !== 'ok') { const e = new Error(d.message || 'сервер не ответил'); e.status = r.status; throw e; } return d; });
  let kpTimer = 0, kpMe = null, kpBots = true;
  function kpStop() { clearInterval(kpTimer); if (kpMe && !kpMe.started) KAPI('leave', {table: kpMe.table, token: kpMe.token}).catch(() => {}); kpMe = null; }
  function kpView() {
    clearInterval(battleTimer); kpStop(); if (typeof bkStop === 'function') bkStop();
    const page = el('section', 'kp-page'), top = el('div', 'bt-top'), body = el('div', 'kp-body'), msg = el('p', 'p-note', ''); msg.setAttribute('role', 'status');
    const back = button('← К играм', 'p-small', () => { kpStop(); list(); }); back.dataset.act = 'kp-back';
    top.append(back, el('h1', 'kp-h', `🎲 Кодополия с одноклассниками · ${player.className}`)); const rules = el('details', 'kp-rules'); rules.append(el('summary', '', '📖 Как играть в Кодополию'));
    for (const [h, t] of [['Цель', 'Ходите по кругу из 28 клеток 8 раундов. Побеждает тот, у кого больше кристаллов знаний; при равенстве — у кого больше байтов. В начале у каждого 10 байтов, за проход «Старта» — ещё 4.'],
      ['Ход', 'Пробел или кнопка «Бросить» — кубик. Ответы и выбор — клавиши 1–4 или мышью. Подробные правила в самой игре — клавиша H или кнопка «? Правила».'],
      ['Кристалл', 'Остановился на кристалле — можно купить его за 20 байтов. После покупки он переезжает. Портал переносит прямо к кристаллу.'],
      ['Кварталы', 'Свободный квартал можно купить; не купил — он уходит на торги. На чужом квартале платишь аренду, но верный ответ «файрволу знаний» делит её пополам. Весь район одного цвета — аренда вдвое больше.'],
      ['Клетки', '«?» — вопрос за 4 байта; карты «Вирус / Обновление»; магазин предметов; карантин — ответь верно, иначе пропустишь ход.'],
      ['Мини-игры и события', 'После каждого раунда — мини-игра на скорость для всех. Каждые три раунда — событие: хакатон, DDoS-атака, распродажа и другие.'],
      ['По сети', 'Выбери лобби или создай своё. Создатель начинает партию, когда захочет: от двух игроков, с ботами на свободных местах или без них — галочка «Боты» перед стартом. Вчетвером партия начнётся сама. Создатель лобби ведёт партию — ему нельзя закрывать вкладку.']]) { const p2 = el('p'); p2.append(el('b', '', h + '. '), t); rules.append(p2); }
    page.append(top, rules, msg, body); paint(page);
    const board = P.games.find(g => g.id === 'board');
    const go = d => { clearInterval(kpTimer); try { sessionStorage.setItem('school4-kp', JSON.stringify({table: d.table, token: d.token, seat: d.seat, players: d.players, title: d.title, bots: d.bots !== false, at: Date.now()})); } catch {} kpMe = null; list(); open({...board, params: board.params + '&net=1'}, 1); };
    const lobby = d => { kpMe = d; if (d.started) return go(d);
      const seats = el('div', 'kp-seats'); for (let i = 0; i < 4; i++) { const s = el('div', 'kp-seat' + (d.players[i] ? ' on' : '')); s.append(el('b', '', d.players[i] ? (i === 0 ? '👑 ' : '') + d.players[i] + (i === d.seat ? ' (ты)' : '') : 'свободно')); seats.append(s); }
      const box = el('div', 'kp-lobby'); box.append(el('p', 'p-eyebrow', 'ТВОЁ ЛОББИ'), el('h2', '', d.title), seats, el('p', 'p-note', `Игроков: ${d.players.length} из 4. Создатель начинает партию, когда захочет (от двух игроков); вчетвером — начнётся сама.`));
      const row = el('div', 'bt-top');
      if (d.seat === 0 && d.players.length >= 2) {
        const lab = el('label', 'kp-bots'), cb = el('input'); cb.type = 'checkbox'; cb.checked = kpBots; cb.dataset.field = 'kp-bots'; cb.addEventListener('change', () => { kpBots = cb.checked; }); lab.append(cb, ' Боты на свободные места');
        const st = button('▶ Начать партию', 'p-primary', async () => { try { lobby(await KAPI('start', {table: d.table, token: d.token, bots: kpBots})); } catch (e) { msg.textContent = e.message; } }); st.dataset.act = 'kp-start';
        row.append(lab, st); }
      else if (d.seat !== 0) box.append(el('p', 'p-note', 'Ждём, когда создатель начнёт партию.'));
      const lv = button('Выйти из лобби', 'p-small', () => { kpStop(); kpView(); }); lv.dataset.act = 'kp-leave'; row.append(lv); box.append(row); body.replaceChildren(box); };
    const browse = async () => { let d; try { d = await KAPI('list', {className: player.className}); msg.textContent = ''; } catch (e) { msg.textContent = 'Нет связи с сервером: ' + e.message; return; }
      const form = el('form', 'kp-new'), inp = el('input'); inp.maxLength = 40; inp.placeholder = 'Название лобби, например «Команда 17»'; inp.dataset.field = 'kp-title'; named(inp, 'Название нового лобби');
      const mk = button('＋ Создать лобби', 'p-primary'); mk.type = 'submit'; mk.dataset.act = 'kp-create'; form.append(inp, mk);
      form.addEventListener('submit', async e => { e.preventDefault(); try { lobby(await KAPI('create', {className: player.className, name: player.name, title: inp.value})); } catch (er) { msg.textContent = er.message; } });
      const ul = el('div', 'kp-list');
      for (const t of d.tables) { const card = el('div', 'kp-card' + (t.started ? ' busy' : '')); card.append(el('b', '', t.title), el('span', '', `${t.players.length}/4 · ${t.players.join(', ')}`));
        if (t.started) card.append(el('em', '', 'идёт партия'));
        else { const j = button(t.players.length >= 4 ? 'заполнено' : 'Войти', 'p-small', async () => { try { lobby(await KAPI('join', {className: player.className, name: player.name, table: t.id})); } catch (er) { msg.textContent = er.message; } }); j.disabled = t.players.length >= 4; j.dataset.join = t.id; if (!j.disabled) named(j, `Войти в лобби «${t.title}»`); card.append(j); }
        ul.append(card); }
      const keep = body.querySelector('[data-field=kp-title]'); if (keep && document.activeElement === keep) { inp.value = keep.value; }
      body.replaceChildren(el('h2', '', 'Выбери лобби или создай своё'), el('p', 'p-note', 'Договорись с друзьями: один создаёт лобби, остальные входят в него из списка. Вчетвером партия стартует сама.'), form, d.tables.length ? ul : el('p', 'p-note', 'Лобби пока нет — создай первое!'));
      if (keep && document.activeElement !== inp && keep.value) inp.value = keep.value; };
    const tickKp = async () => { if (kpMe) { try { lobby(await KAPI('state', {table: kpMe.table, token: kpMe.token})); } catch (e) { msg.textContent = e.message; kpMe = null; browse(); } } else if (!body.querySelector('[data-field=kp-title]') || document.activeElement !== body.querySelector('[data-field=kp-title]')) browse(); };
    browse(); kpTimer = setInterval(tickKp, 1500);
  }
  /* ---------- «Бункер» по сети: настолка для класса, партию ведёт сервер ---------- */
  const BKAPI = (path, body) => fetch('/results/api/bunker/' + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), cache: 'no-store'}).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok || d.status !== 'ok') { const e = new Error(d.message || 'сервер не ответил'); e.status = r.status; throw e; } return d; });
  let bkTimer = 0, bkMe = null;
  const BK_CARDS = [['job', 'профессия'], ['skill', 'навык'], ['item', 'багаж'], ['health', 'здоровье'], ['trait', 'характер']];
  function bkStop() { clearInterval(bkTimer); if (bkMe && bkMe.phase === 'lobby') BKAPI('leave', {table: bkMe.table, token: bkMe.token}).catch(() => {}); bkMe = null; }
  function bkView() {
    clearInterval(battleTimer); kpStop(); bkStop();
    const page = el('section', 'kp-page bn-page'), top = el('div', 'bt-top'), body = el('div', 'kp-body'), msg = el('p', 'p-note', ''); msg.setAttribute('role', 'status');
    const back = button('← К играм', 'p-small', () => { bkStop(); list(); }); back.dataset.act = 'bk-back';
    top.append(back, el('h1', 'kp-h', `🚪 Бункер с классом · ${player.className}`));
    const rules = el('details', 'kp-rules'); rules.append(el('summary', '', '📖 Как играть в «Бункер»'));
    for (const [h, t] of [['Сюжет', 'Глюк отключил интернет, а в серверный бункер помещаются не все. Каждый из вас — кандидат со своими картами: профессия, навык, багаж, здоровье и характер. Свои карты видишь только ты.'],
      ['Раунд', 'Каждый открывает одну свою карту — выбирай, какую показать классу. Потом голосуете: кого не берём в бункер. Кто набрал больше голосов — выбывает. Обсуждайте вслух: убеждайте, что вы нужны бункеру!'],
      ['Испытания', 'Когда в бункере осталось столько, сколько мест, — испытания по информатике: каждый в бункере отвечает сам, испытание пройдено, если верно ответило большинство. Специалист с нужным навыком или вещью видит подсказку: два неверных ответа зачёркнуты.'],
      ['Победа', 'Бункер выстоял, если провалено не больше одного испытания. Поэтому берите тех, кто закрывает нужды бункера — и считайте объём флешек: Мбайт и Гбайт отличаются в 1024 раза!']]) { const p2 = el('p'); p2.append(el('b', '', h + '. '), t); rules.append(p2); }
    page.append(top, rules, msg, body); paint(page);
    let lastKey = '';
    const act = async (body2) => { try { draw(await BKAPI('act', {table: bkMe.table, token: bkMe.token, ...body2})); } catch (e) { msg.textContent = e.message; } };
    const portrait = jid => { const im = new Image(); im.alt = ''; im.className = 'bn-pic'; im.src = `art/bunker_p${jid}.webp`; return im; };
    function draw(d) {
      bkMe = {...bkMe, ...d};
      const key = JSON.stringify(d); if (key === lastKey) return; lastKey = key; msg.textContent = '';
      if (d.phase === 'lobby') return lobbyView(d);
      const box = el('div', 'bn-game'), head = el('div', 'bn-head');
      const banner = {reveal: `Раунд ${d.round}: открой одну свою карту`, vote: 'Голосование: кого не берём в бункер?', result: 'Итог раунда', trial: 'Испытания бункера', end: d.result && d.result.win ? '🎉 Бункер выстоял!' : '💥 Бункер не выстоял'}[d.phase];
      head.append(el('p', 'p-eyebrow', `СЦЕНАРИЙ · ${d.scenario}`), el('h2', '', banner + (d.left && d.phase !== 'end' ? ` · ${d.left} с` : '')), el('p', 'p-note', `${d.story} В бункере мест: ${d.keep} из ${d.players.length}.`));
      const needs = el('div', 'bn-needs'); for (const n of d.needs) needs.append(el('span', '', '○ ' + n)); head.append(needs); box.append(head);
      if (d.phase === 'vote') box.append(el('p', 'bn-state', d.voted ? `Голос принят. Проголосовали: ${d.votes_in} из ${d.players.length - d.out.length}.` : 'Нажми «Не брать» под тем, кого не берёшь в бункер.'));
      if (d.phase === 'result' && d.last) box.append(el('p', 'bn-state bad', `В бункер не попадает: ${d.players[d.last.out]}.`));
      const grid = el('div', 'bn-grid');
      d.cards.forEach((c, i) => {
        const out = d.out.includes(i), card = el('div', 'bn-card' + (out ? ' out' : '') + (i === d.me ? ' me' : ''));
        card.append(portrait(c.jid), el('b', '', d.players[i] + (i === d.me ? ' (ты)' : '') + (i === 0 ? ' 👑' : '')));
        for (const [k, name] of BK_CARDS) {
          const open = c.open.includes(k), v = c.cards[k], row = el('div', 'bn-attr' + (open ? ' open' : v != null ? ' secret' : ''));
          row.append(el('i', '', name), el('span', '', v == null ? '?' : v));
          if (i === d.me && !open && d.phase === 'reveal' && !out && c.open.length <= d.round) { const b = button('Открыть', 'p-small bn-open', () => act({type: 'open', card: k})); b.dataset.open = k; named(b, `Открыть карту «${name}»`); row.append(b); }
          card.append(row);
        }
        if (d.phase === 'result' && d.last && d.last.tally[String(i)]) card.append(el('div', 'bn-votes', `голосов против: ${d.last.tally[String(i)]}`));
        if (out) card.append(el('div', 'bn-outtag', 'не попал(а) в бункер'));
        if (d.phase === 'vote' && !d.voted && !out && i !== d.me && !d.out.includes(d.me)) { const b = button('Не брать', 'p-primary bn-vote', () => act({type: 'vote', target: i})); b.dataset.vote = i; named(b, `Голосую: не брать ${d.players[i]}`); card.append(b); }
        grid.append(card);
      });
      box.append(grid);
      if (d.trials) {
        const tr = el('div', 'bn-trials');
        tr.append(el('h3', '', d.in_bunker ? `Испытания: ответь на все (ответили ${d.answered} из ${d.players.length - d.out.length})` : 'Испытания проходят те, кто в бункере. Можешь решать вместе с ними:'));
        d.trials.forEach((t, k) => {
          const q = el('div', 'bn-q'); q.append(el('b', '', t.need), el('pre', '', t.q));
          if (t.spec) q.append(el('p', 'bn-spec', '🛠 Ты специалист: два неверных ответа зачёркнуты.'));
          const opts = el('div', 'bn-opts');
          t.opts.forEach((o, j) => { const right = d.rights && d.rights[k] === j, b = button(o, 'bn-opt' + (t.gone.includes(j) ? ' gone' : '') + (t.mine === j ? ' on' : '') + (right ? ' right' : ''), () => act({type: 'answer', trial: k, opt: j}));
            b.disabled = d.phase !== 'trial' || !d.in_bunker || t.gone.includes(j); b.dataset.trial = k; b.dataset.opt = j; opts.append(b); });
          q.append(opts); tr.append(q);
        });
        box.append(tr);
      }
      if (d.result) {
        const r = el('div', 'bn-result ' + (d.result.win ? 'win' : 'lose'));
        r.append(el('h3', '', d.result.win ? `Бункер выстоял: пройдено испытаний ${d.result.passed} из ${d.result.trials.length}` : `Бункер не выстоял: пройдено ${d.result.passed} из ${d.result.trials.length}`));
        for (const t of d.result.trials) r.append(el('p', '', `${t.ok ? '✅' : '❌'} ${t.need}: верно ${t.good} из ${t.of}` + (t.spec.length ? ` · специалист: ${t.spec.join(', ')}` : ' · специалиста в бункере не было')));
        if (d.host) { const again = button('▶ Новая партия', 'p-primary', async () => { try { draw(await BKAPI('start', {table: bkMe.table, token: bkMe.token})); } catch (e) { msg.textContent = e.message; } }); again.dataset.act = 'bk-again'; r.append(again); }
        else r.append(el('p', 'p-note', 'Новую партию начинает создатель лобби.'));
        box.append(r);
      }
      if (d.log && d.log.length) { const lg = el('div', 'bn-log'); for (const l of d.log) lg.append(el('p', '', l)); box.append(lg); }
      body.replaceChildren(box);
    }
    function lobbyView(d) {
      const seats = el('div', 'kp-seats'); for (let i = 0; i < Math.max(4, d.players.length); i++) { const s = el('div', 'kp-seat' + (d.players[i] ? ' on' : '')); s.append(el('b', '', d.players[i] ? (i === 0 ? '👑 ' : '') + d.players[i] + (i === d.me ? ' (ты)' : '') : 'свободно')); seats.append(s); }
      const box = el('div', 'kp-lobby bn-lobby'); box.append(el('p', 'p-eyebrow', 'ТВОЙ БУНКЕР'), el('h2', '', d.title), seats, el('p', 'p-note', `Игроков: ${d.players.length} (от 3 до 10). Партию начинает создатель лобби.`));
      const row = el('div', 'bt-top');
      if (d.host) { const st = button('▶ Начать партию', 'p-primary', async () => { try { draw(await BKAPI('start', {table: bkMe.table, token: bkMe.token})); } catch (e) { msg.textContent = e.message; } }); st.disabled = d.players.length < 3; st.dataset.act = 'bk-start'; row.append(st); }
      const lv = button('Выйти из лобби', 'p-small', () => { bkStop(); bkView(); }); lv.dataset.act = 'bk-leave'; row.append(lv); box.append(row); body.replaceChildren(box);
    }
    const browse = async () => { let d; try { d = await BKAPI('list', {className: player.className}); msg.textContent = ''; } catch (e) { msg.textContent = 'Нет связи с сервером: ' + e.message + (e.status === 404 ? ' (нужен перезапуск журнала)' : ''); return; }
      const form = el('form', 'kp-new'), inp = el('input'); inp.maxLength = 40; inp.placeholder = 'Название бункера, например «Бункер 17»'; inp.dataset.field = 'bk-title'; named(inp, 'Название нового бункера');
      const mk = button('＋ Создать бункер', 'p-primary'); mk.type = 'submit'; mk.dataset.act = 'bk-create'; form.append(inp, mk);
      form.addEventListener('submit', async e => { e.preventDefault(); try { bkMe = {}; draw(await BKAPI('create', {className: player.className, name: player.name, title: inp.value})); } catch (er) { msg.textContent = er.message; bkMe = null; } });
      const ul = el('div', 'kp-list');
      for (const t of d.tables) { const card = el('div', 'kp-card' + (t.started ? ' busy' : '')); card.append(el('b', '', t.title), el('span', '', `${t.players.length}/10 · ${t.players.join(', ')}`));
        if (t.started) card.append(el('em', '', 'идёт партия'));
        else { const j = button('Войти', 'p-small', async () => { try { bkMe = {}; draw(await BKAPI('join', {className: player.className, name: player.name, table: t.id})); } catch (er) { msg.textContent = er.message; bkMe = null; } }); j.dataset.join = t.id; named(j, `Войти в бункер «${t.title}»`); card.append(j); }
        ul.append(card); }
      const keep = body.querySelector('[data-field=bk-title]'); if (keep && document.activeElement === keep) inp.value = keep.value;
      body.replaceChildren(el('h2', '', 'Выбери бункер или создай свой'), el('p', 'p-note', 'Один создаёт бункер, остальные входят из списка. Играть можно от трёх до десяти человек — лучше всем классом в 2–3 бункерах.'), form, d.tables.length ? ul : el('p', 'p-note', 'Бункеров пока нет — создай первый!'));
      if (keep && document.activeElement !== inp && keep.value) inp.value = keep.value; };
    const tick = async () => { if (bkMe && bkMe.table) { try { draw(await BKAPI('state', {table: bkMe.table, token: bkMe.token})); } catch (e) { msg.textContent = e.message; bkMe = null; browse(); } } else if (!bkMe && (!body.querySelector('[data-field=bk-title]') || document.activeElement !== body.querySelector('[data-field=bk-title]'))) browse(); };
    browse(); bkTimer = setInterval(tick, 1000);
  }
  async function studentProfile(className, name) {
    root.replaceChildren(el('p', 'p-note', 'Загружаем профиль…')); root.firstChild.setAttribute('role', 'status');
    try { const r = await fetch('/results/api/practicum/student?' + new URLSearchParams({slug: P.apiSlug, className, name}), {cache: 'no-store'}); const d = await r.json(); if (!r.ok || d.status !== 'ok') throw new Error(d.message || 'сервер не ответил'); profileView(d, () => teacherView(className), 'teacher'); }
    catch (e) { paint(el('p', 'p-note', 'Не удалось открыть профиль: ' + e.message), button('← К таблице класса', 'p-small', () => teacherView(className))); }
  }
  // Состояние сервиса: какие части школьного сервера отвечают (для учителя).
  async function healthView() {
    const box = el('section', 'p-teacher'), list2 = el('ul', 'p-health'); list2.setAttribute('aria-live', 'polite'); box.append(el('p', 'p-eyebrow', 'УЧИТЕЛЮ · СОСТОЯНИЕ СЕРВИСА'), el('h1', '', 'Проверка школьного сервера'), list2, button('← Ко входу', 'p-small', () => { login(); teacherProbe(); })); paint(box);
    const probe = async (title, url, body, ok) => { const li = el('li', 'wait', `⏳ ${title}`); list2.append(li); const t0 = performance.now();
      try { const r = await fetch(url, body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), cache: 'no-store'} : {cache: 'no-store'}); const j = await r.json().catch(() => null), good = ok(r.status, j); li.className = good ? 'ok' : 'bad'; li.textContent = `${good ? '✅' : '❌'} ${title} — ${good ? 'работает' : !j ? 'нет на сервере: нужен перезапуск журнала (sudo systemctl restart school4-test-results)' : 'ответ ' + r.status} · ${Math.round(performance.now() - t0)} мс`; }
      catch (e) { li.className = 'bad'; li.textContent = `❌ ${title} — сервер не отвечает (${e.message})`; } };
    const cls = `${data.grade} «А»`;
    await probe('Журнал и прогресс практикума', '/results/api/trainer/classes?slug=' + P.apiSlug, null, s => s === 200);
    await probe('Статистика, значки, лига', '/results/api/practicum/ping', null, s => s === 200);
    await probe('Профили учеников и повторение', '/results/api/practicum/student?' + new URLSearchParams({slug: P.apiSlug, className: cls, name: 'Проверка Связи'}), null, (s, j) => !!j);
    await probe('Битва класса', '/results/api/battle/status', {className: cls}, s => s === 200);
    await probe('Кодополия по сети', '/results/api/kp/list', {className: cls}, s => s === 200);
    await probe('Рекорды «Тенегрыза»', '/results/api/typing/mine', {className: cls, name: 'Проверка Связи'}, (s, j) => !!j);
    await probe('Сбой на станции', '/results/api/crew/sync', {className: cls}, (s, j) => !!j);
    await probe('Гонка алгоритмов', '/results/api/race/state', {className: cls}, (s, j) => !!j);
    list2.append(el('li', 'note', 'Если что-то красное с пометкой «нужен перезапуск» — выполните в терминале учительского ноутбука: sudo systemctl restart school4-test-results'));
  }
  async function teacherView(className) {
    const box = el('section', 'p-teacher'), pick = el('select'); for (const l of LETTERS) { const o = el('option', '', `${data.grade} «${l}»`); o.value = o.textContent; pick.append(o); } pick.value = className; pick.dataset.act = 'teacher-class'; named(pick, 'Класс'); pick.addEventListener('change', () => teacherView(pick.value));
    box.append(el('p', 'p-eyebrow', 'УЧИТЕЛЮ · СТАТИСТИКА ПРАКТИКУМА'), el('h1', '', 'Класс'), pick, button('← Ко входу', 'p-small', login)); paint(box);
    let d; try { const r = await fetch('/results/api/practicum/teacher?' + new URLSearchParams({slug: P.apiSlug, className}), {cache: 'no-store'}); d = await r.json(); if (!r.ok || d.status !== 'ok') throw new Error(d.message || 'сервер не ответил'); } catch (e) { box.append(el('p', 'p-note', 'Не удалось получить статистику: ' + e.message)); return; }
    if (!d.students.length) { box.append(el('p', 'p-note', 'В этом классе ещё никто не играл.')); return; }
    const t = el('table', 'p-table'), h = el('tr'); for (const x of ['Ученик', 'Ранг', '★ всего', 'Этапов', '★ за неделю', 'Серия', 'Значков', 'На «5»']) { const th = el('th', '', x); th.scope = 'col'; h.append(th); } t.append(h);
    for (const s of d.students) { const tr = el('tr'), nm = el('td'), a = button(s.name, 'pf-link', () => studentProfile(className, s.name)); a.dataset.profile = s.name; nm.append(a); tr.append(nm); for (const x of [s.rank, s.stars, s.done, s.week, s.streak, s.badges, s.fives.join(', ') || '—']) tr.append(el('td', '', String(x))); t.append(tr); }
    // Тепловая карта класса: ученик × тема, цвет — доля звёзд (тёмные тона: белый текст с контрастом не ниже 6:1); и этапы, на которых застревает больше всего учеников.
    if (d.areas && d.areas.length) { const hm = el('table', 'p-heat'), hh = el('tr'); for (const a of ['Ученик', ...d.areas]) { const th = el('th', '', a); th.scope = 'col'; hh.append(th); } hm.append(hh);
      for (const s2 of d.students) { const tr = el('tr'); tr.append(el('td', '', s2.name)); for (const a of d.areas) { const v = (s2.skills || {})[a], td = el('td', 'hc', v == null ? '—' : Math.round(v * 100) + '%'); if (v != null) td.style.background = `hsl(${Math.round(v * 120)} 65% ${20 + v * 6}%)`; tr.append(td); } hm.append(tr); }
      const hw = scroller('Тепловая карта класса'); hw.append(hm); box.append(el('h3', 'p-th', 'Тепловая карта: доля звёзд по темам'), hw); }
    if (d.hard && d.hard.length) { const ul = el('ul', 'p-hard'); for (const h of d.hard) ul.append(el('li', '', `${h.title}, этап ${h.level} — застряли ${h.stuck} уч.`)); box.append(el('h3', 'p-th', 'Трудные этапы: здесь остановились несколько учеников'), ul); }
    box.append(el('h3', 'p-th', 'Ученики'));
    const csv = button('⬇ Таблица для Excel (CSV)', 'p-small', () => download(`Практикум ${className} ${new Date().toLocaleDateString('ru-RU')}.csv`, classCsv(d))); csv.dataset.act = 'csv';
    const wrap = scroller('Таблица учеников'); wrap.append(t); box.append(csv, wrap, el('p', 'p-note', 'Щёлкните по имени, чтобы открыть профиль ученика. Отметки в журнал ученик отправляет сам кнопкой на карточке игры.'));
  }
  // Таблица класса для Excel: общие счётчики, звёзды и отметка по каждой игре, доля звёзд по темам. Разделитель «;» и BOM — так её открывает русский Excel.
  function classCsv(d) {
    const mark = (st, mx) => !st || !mx ? '' : st * 100 >= GRADING.five * mx ? 5 : st * 100 >= GRADING.four * mx ? 4 : st * 100 >= GRADING.three * mx ? 3 : 2;
    const rows = [['Ученик', 'Ранг', 'Звёзд всего', 'Этапов пройдено', 'Звёзд за неделю', 'Серия дней', 'Значков', ...d.games.flatMap(g => [`${g.title}: звёзды из ${g.max}`, `${g.title}: отметка`]), ...(d.areas || []).map(a => `${a}, %`)]];
    for (const s of d.students) rows.push([s.name, s.rank, s.stars, s.done, s.week, s.streak, s.badges, ...d.games.flatMap(g => [s.games[g.id] || 0, mark(s.games[g.id] || 0, g.max)]), ...(d.areas || []).map(a => s.skills && s.skills[a] != null ? Math.round(s.skills[a] * 100) : '')]);
    const cell = v => '"' + (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : String(v)).replace(/"/g, '""') + '"';   // имя «=…» Excel не примет за формулу
    return '\ufeff' + rows.map(r => r.map(cell).join(';')).join('\r\n');
  }
  function download(name, text) { const a = el('a'); a.href = URL.createObjectURL(new Blob([text], {type: 'text/csv'})); a.download = name.replace(/[\\/:*?"<>|]/g, '_'); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function card(game) {
    const c = el('article', 'p-card'), art = hide(el('div', 'p-art', game.art)), body = el('div', 'p-body');
    art.style.background = game.color;
    // Обложка игры (нарисована нейросетью); если её нет, остаётся цветная плашка со значком.
    { const img = new Image(); img.onload = () => { art.textContent = ''; art.style.background = `url(${img.src}) center / cover no-repeat`; art.classList.add('pic'); c.classList.add('pic'); }; img.src = `art/cover_${game.id}.webp?v=${P.artVersion || ''}`; }
    const got = stars(game), max = game.levels * 3, mark = markOf(game), sent = player.sent[game.id];
    body.append(el('p', 'p-genre', game.genre), el('h3', '', game.title), el('p', 'p-about', game.about));
    const bar = hide(el('div', 'p-bar')), fill = el('i'); fill.style.width = got / max * 100 + '%'; bar.append(fill);
    body.append(el('p', 'p-progress', `★ ${got} из ${max} · пройдено ${done(game)} из ${game.levels} · около ${game.minutes} минут`), bar);
    const actions = el('div', 'p-actions'), play = button(got ? 'Продолжить ▶' : 'Играть ▶', 'p-primary', () => open(game)); play.dataset.play = game.id; named(play, (got ? 'Продолжить: ' : 'Играть: ') + game.title); actions.append(play);
    const status = el('p', 'p-status'); status.setAttribute('role', 'status'); status.id = 'p-st-' + game.id;
    if (mark >= 3) {
      const better = !sent || got > sent.stars, send = button(sent && !better ? `В журнале: ${sent.mark}` : `Отметка ${mark} — в журнал`, 'p-mark', () => submit(game, send, status)); send.dataset.mark = game.id; send.setAttribute('aria-describedby', status.id); send.disabled = !better || !remote; actions.append(send);
      if (sent && better) status.textContent = `В журнале сейчас ${sent.mark} (★ ${sent.stars}). Можно обновить.`;
      else if (mark < 5) status.textContent = `До отметки ${mark + 1} не хватает ★ ${need(game, mark === 3 ? GRADING.four : GRADING.five) - got}.`;
    } else status.textContent = `Отметка появится, когда наберёшь ★ ${need(game, GRADING.three)} (тройка), ★ ${need(game, GRADING.four)} (четвёрка) или ★ ${need(game, GRADING.five)} (пятёрка).`;
    body.append(actions, status); c.append(art, body); return c;
  }

  /* ---------- задание дня и значки ---------- */
  // Задание дня одно на класс и день: игра выбирается по дате. Засчитывается любой пройденный сегодня этап этой игры.
  // Отметка о выполнении хранится в прогрессе ученика на сервере как «уровень» daily-ГГГГММДД, поэтому серия видна на любом компьютере.
  const dayKey = d => `daily-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const dailyGame = () => { const d = new Date(), n = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate() + data.grade * 7; return P.games[n % P.games.length]; };
  const streak = () => { let n = 0; const d = new Date(); if (!player.levels[dayKey(d)]) d.setDate(d.getDate() - 1); while (player.levels[dayKey(d)] && n < 400) { n++; d.setDate(d.getDate() - 1); } return n; };
  const nextLevel = g => { for (let n = 1; n <= g.levels; n++) if ((player.levels[g.id + '-' + n]?.stars || 0) < 3) return n; return g.levels; };
  const BADGES = [
    ['sprout', 'Первые шаги', 'Пройди любой этап', () => Object.keys(player.levels).some(k => !k.startsWith('daily-'))],
    ['star', 'Без ошибок', 'Десять этапов на три звезды', () => Object.entries(player.levels).filter(([k, r]) => !k.startsWith('daily-') && r.stars === 3).length >= 10],
    ['trophy', 'Покоритель', 'Пройди все этапы одной игры', () => P.games.some(g => done(g) === g.levels)],
    ['gems', 'Коллекционер', 'Звёзды в пяти разных играх', () => P.games.filter(g => stars(g) > 0).length >= 5],
    ['cap', 'Отличник', 'Набери на «5» в любой игре', () => P.games.some(g => markOf(g) === 5)],
    ['flame', 'Серия', 'Задание дня три дня подряд', () => streak() >= 3],
    ['keys', 'Быстрые пальцы', '200 знаков в минуту в «Побеге от Тенегрыза»', () => false],   // без сервера не проверить: рекорды на общем компьютере принадлежат разным ученикам
    ['boss', 'Победитель Глюка', 'Пройди пятую зону «Клеток памяти»', () => !!player.levels['cells-5']],
  ];
  /* ---------- статистика и награды с сервера ---------- */
  // Значки, задание дня, серия, ранг и недельная лига считает сервер по прогрессу ученика в журнале практикума,
  // поэтому они одинаковы на любом компьютере и не переходят от одного ученика к другому. Без сервера — прежний расчёт на странице.
  let me = null, fresh = [];
  const stat = () => me;   // в list() имя me занято блоком с именем ученика
  async function stats() {
    if (!remote || !player) return; const mine = player;
    try { const r = await fetch('/results/api/practicum/me?' + new URLSearchParams(who()), {cache: 'no-store', signal: AbortSignal.timeout(6000)}); const d = await r.json(); if (r.ok && d.status === 'ok' && mine === player) { me = d; fresh.push(...d.badges.filter(b => b.fresh)); } } catch {}
  }
  function toast() {
    if (!fresh.length || frame) return; const b = fresh.shift(); if (location.hostname === '127.0.0.1') (window.school4Toasts = window.school4Toasts || []).push(b.id); const box = el('div', 'p-toast'), im = new Image(); im.alt = ''; box.setAttribute('role', 'status'); document.body.append(box);   // пустая живая область сначала, текст потом — так его зачитает экранный диктор
     im.src = `art/badge_${b.id}.webp?v=${P.artVersion || ''}`;
    box.append(im, el('div', '', ''), ); box.lastChild.append(el('small', '', 'НОВЫЙ ЗНАЧОК'), el('strong', '', b.title), el('span', '', b.how)); setTimeout(() => { box.remove(); toast(); }, 5000);
  }
  function extrasServer() {
    const box = el('section', 'p-extras'), dg = me.daily && P.games.find(g => g.id === me.daily.id), st = me.stats, s = me.daily ? me.daily.streak : 0, today = !!(me.daily && me.daily.done);
    const daily = el('div', 'p-daily' + (today ? ' done' : ''));
    if (dg) { daily.append(el('p', 'p-eyebrow', 'ЗАДАНИЕ ДНЯ'), el('h2', '', today ? `Выполнено! ${dg.title}` : `${dg.title}: пройди этап ${nextLevel(dg)}`), el('p', '', today ? 'Возвращайся завтра за новым заданием.' : 'Засчитывается любой этап этой игры, в котором сегодня прибавятся звёзды.'), el('p', 'p-streak', s ? `🔥 серия: ${s} ${s % 10 === 1 && s % 100 !== 11 ? 'день' : s % 10 >= 2 && s % 10 <= 4 && (s % 100 < 12 || s % 100 > 14) ? 'дня' : 'дней'} подряд` : 'Начни серию сегодня!'));
      if (!today) { const b = button('Играть ▶', 'p-primary', () => open(dg)); b.dataset.daily = dg.id; named(b, 'Задание дня: играть в «' + dg.title + '»'); daily.append(b); } }
    const rank = el('div', 'p-rank'); rank.append(el('p', 'p-eyebrow', 'ТВОЙ РАНГ'), el('h2', '', st.rank), el('p', '', `★ ${st.stars} · этапов пройдено: ${st.done} · на три звезды: ${st.three} · игр со звёздами: ${st.games}`));
    if (st.rankNext) { const bar = hide(el('div', 'p-bar')), f = el('i'); f.style.width = Math.max(4, 100 - st.rankNeed / (st.rankNeed + st.stars) * 100) + '%'; bar.append(f); rank.append(bar, el('p', 'p-note', `До ранга «${st.rankNext}» — ещё ★ ${st.rankNeed}.`)); }
    daily.append(rank);
    const league = el('div', 'p-league'); league.append(el('p', 'p-eyebrow', `ЛИГА КЛАССА ${player.className} · ЗВЁЗДЫ ЗА 7 ДНЕЙ`));
    const ol = el('ol'); for (const t of me.league.top) { const li = el('li', t.me ? 'me' : ''); li.append(el('span', '', t.name), el('b', '', `★ ${t.stars}`)); ol.append(li); }
    league.append(me.league.top.length ? ol : el('p', 'p-note', 'На этой неделе звёзд ещё никто не получал — стань первым!'), el('p', 'p-note', me.league.place ? `Ты на ${me.league.place}-м месте из ${me.league.size} (★ ${me.league.stars} за неделю).` : 'Пройди этап, чтобы попасть в лигу этой недели.'));
    const badges = el('div', 'p-badges'); badges.append(el('p', 'p-eyebrow', 'ЗНАЧКИ'));
    const row = el('div', 'p-badge-row'); for (const x of me.badges) { const b = el('div', 'p-badge' + (x.got ? ' got' : '')); b.title = `${x.title}: ${x.how}` + (x.at ? ` (получен ${x.at.slice(8, 10)}.${x.at.slice(5, 7)})` : ''); const im = new Image(); im.alt = ''; im.src = `art/badge_${x.id}.webp?v=${P.artVersion || ''}`; im.addEventListener('error', () => im.remove()); b.dataset.badge = x.id; b.append(im, el('small', '', x.title), sr(x.got ? ' — получен' : ` — ещё не получен. ${x.how}`)); row.append(b); }
    badges.append(row, el('p', 'p-note', `Получено значков: ${me.badges.filter(x => x.got).length} из ${me.badges.length}. Значки выдаёт школьный сервер — они видны с любого компьютера. Наведи на значок, чтобы узнать, как его получить.`), league);
    box.append(daily, badges); setTimeout(toast, 300); return box;
  }
  // Разминка по слабой теме, интервальное повторение, сезон и турнир классов — всё считает сервер.
  function extras2(m) {
    const box = el('section', 'p-extras2'), byId = id => P.games.find(g => g.id === id);
    const warm = el('div', 'p-card2 p-warm'); warm.append(el('p', 'p-eyebrow', 'РАЗМИНКА · 5 МИНУТ'));
    if (m.warmup && byId(m.warmup.game)) { const w = m.warmup; warm.append(el('h3', '', `Тема «${w.area}» — у тебя ${Math.round(w.pct * 100)} %`), el('p', '', `${w.title}, этап ${w.level}`)); const b = button('Начать разминку ▶', 'p-primary', () => open(byId(w.game), w.level)); b.dataset.warmup = w.game; named(b, `Начать разминку: ${w.title}, этап ${w.level}`); warm.append(b); }
    else warm.append(el('p', 'p-note', 'Пройди пару этапов в разных играх — и здесь появится разминка по твоей слабой теме.'));
    warm.append(el('p', 'p-eyebrow p-sub', 'ПОВТОРЕНИЕ'));
    if (m.review && m.review.length) { const ul = el('ul', 'p-review'); for (const r of m.review) { const g = byId(r.game); if (!g) continue; const li = el('li'), b = button('Повторить', 'p-small', () => open(g, r.level)); b.dataset.review = r.game + '-' + r.level; named(b, `Повторить: ${r.title}, этап ${r.level}`); li.append(el('span', '', `${r.title}, этап ${r.level}`), el('small', '', `повтор ${r.step} из 3`), b); ul.append(li); } warm.append(ul); }
    else warm.append(el('p', 'p-note', 'Повторять пока нечего: пройденные этапы вернутся сюда через 3, 7 и 14 дней.'));
    const se = el('div', 'p-card2 p-season'), sn = m.season; const sb = new Image(); sb.alt = ''; sb.className = 'p-sbadge' + (sn.got ? ' got' : ''); sb.src = `art/season_${sn.badge}.webp?v=${P.artVersion || ''}`;
    const bar = hide(el('div', 'p-bar')), f = el('i'); f.style.width = Math.min(100, sn.stars / sn.goal * 100) + '%'; bar.append(f);
    se.append(el('p', 'p-eyebrow', `СЕЗОН · ЕЩЁ ${sn.left} ДН.`), sb, el('h3', '', sn.name), el('p', '', sn.got ? 'Значок сезона получен! 🏅' : `★ ${sn.stars} из ${sn.goal} до значка сезона`), bar);
    if (sn.top.length) { const ol = el('ol', 'p-stop'); for (const t of sn.top) { const li = el('li', t.me ? 'me' : ''); li.append(el('span', '', t.name), el('b', '', '★ ' + t.stars)); ol.append(li); } se.append(ol); }
    const tr = el('div', 'p-card2 p-tour'); tr.append(el('p', 'p-eyebrow', `ТУРНИР КЛАССОВ · ${data.grade} ПАРАЛЛЕЛЬ · НЕДЕЛЯ`));
    const mx = Math.max(1, ...m.classes.map(x => x.stars));
    if (m.classes.length) for (const c of m.classes) { const row = el('div', 'p-trow' + (c.mine ? ' me' : '')), b2 = hide(el('div', 'p-tbar')), fi = el('i'); fi.style.width = c.stars / mx * 100 + '%'; b2.append(fi); row.append(el('span', '', c.className), b2, el('b', '', '★ ' + c.stars)); tr.append(row); }
    else tr.append(el('p', 'p-note', 'На этой неделе классы ещё не набирали звёзд.'));
    tr.append(el('p', 'p-note', 'Звёзды всех учеников класса за последние 7 дней.'));
    box.append(warm, se, tr); return box;
  }
  function extras() {
    if (me && me.season) { const wrap = el('div'); wrap.append(extrasServer(), extras2(me)); return wrap; }
    if (me) return extrasServer();
    const box = el('section', 'p-extras'), g = dailyGame(), today = !!player.levels[dayKey(new Date())], s = streak();
    const daily = el('div', 'p-daily' + (today ? ' done' : '')); daily.append(el('p', 'p-eyebrow', 'ЗАДАНИЕ ДНЯ'), el('h2', '', today ? `Выполнено! ${g.title}` : `${g.title}: пройди этап ${nextLevel(g)}`), el('p', '', today ? 'Возвращайся завтра за новым заданием.' : 'Засчитывается любой этап этой игры, пройденный сегодня.'), el('p', 'p-streak', s ? `🔥 серия: ${s} ${s % 10 === 1 && s % 100 !== 11 ? 'день' : s % 10 >= 2 && s % 10 <= 4 && (s % 100 < 12 || s % 100 > 14) ? 'дня' : 'дней'} подряд` : 'Начни серию сегодня!'));
    if (!today) { const b = button('Играть ▶', 'p-primary', () => open(g)); b.dataset.daily = g.id; named(b, 'Задание дня: играть в «' + g.title + '»'); daily.append(b); }
    const badges = el('div', 'p-badges'); badges.append(el('p', 'p-eyebrow', 'ЗНАЧКИ'));
    const row = el('div', 'p-badge-row'); for (const [id, title, how, test] of BADGES) { const got = test(), b = el('div', 'p-badge' + (got ? ' got' : '')); b.title = `${title}: ${how}`; const im = new Image(); im.alt = ''; im.src = `art/badge_${id}.webp?v=${P.artVersion || ''}`; im.addEventListener('error', () => im.remove()); b.dataset.badge = id; b.append(im, el('small', '', title), sr(got ? ' — получен' : ` — ещё не получен. ${how}`)); row.append(b); }
    badges.append(row, el('p', 'p-note', `Получено значков: ${BADGES.filter(x => x[3]()).length} из ${BADGES.length}. Наведи на значок, чтобы узнать, как его получить.`));
    box.append(daily, badges); return box;
  }

  function list() {
    const head = el('header', 'p-head'), top = el('div', 'p-top');
    top.append(el('p', 'p-eyebrow', `${data.grade} класс · игровой практикум по информатике`), el('h1', '', 'Выбери игру'));
    const me = el('div', 'p-me'); me.append(el('strong', '', player.name), el('span', '', player.className), button('Выйти', 'p-small', () => { if (confirm('Закончить игру и выйти? Следующий ученик войдёт под своим именем.')) forget(); }));
    setTimeout(battleProbe, 300);
    if (stat() && stat().week) { const pb = button('📊 Мой профиль', 'p-small p-prof', () => profileView(stat(), list, 'me')); pb.dataset.act = 'profile'; me.prepend(pb); }
    head.append(top, me);
    const total = P.games.reduce((s, g) => s + stars(g), 0), max = P.games.reduce((s, g) => s + g.levels * 3, 0);
    const intro = el('p', 'p-lead', `Каждая игра рассчитана на урок: в ней несколько этапов, за этап дают до трёх звёзд. Звёзды складываются в отметку: ${GRADING.three}% — «3», ${GRADING.four}% — «4», ${GRADING.five}% — «5». Всего у тебя ★ ${total} из ${max}.`);
    const grid = el('div', 'p-grid'); for (const g of P.games) grid.append(card(g));
    queueMicrotask(() => { if (!grid.isConnected) return;
    if (remote && P.games.some(g => g.id === 'board') && !grid.querySelector('.p-kp')) { const kb = el('div', 'p-kp'), b = button('🎲 Найти лобби', 'p-primary', () => kpView()); b.dataset.act = 'kp'; kb.append(el('strong', '', '🎲 Кодополия с одноклассниками'), el('span', '', 'Создай лобби или зайди к друзьям — до четырёх игроков за разными компьютерами.'), b); grid.before(kb); }
    if (remote && P.games.some(g => g.id === 'bunker') && !grid.querySelector('.p-bk')) { const kb = el('div', 'p-kp p-bk'), b = button('🚪 Найти бункер', 'p-primary', () => bkView()); b.dataset.act = 'bk'; kb.append(el('strong', '', '🚪 Бункер с классом'), el('span', '', 'Настолка «Бункер» по сети: от 3 до 10 игроков, свои карты, голосование и испытания по информатике.'), b); grid.before(kb); } });
    const more = el('section', 'p-more'); more.append(el('h2', '', 'Ещё игры этого класса'));
    const links = el('div', 'p-links'); for (const l of P.links) { const a = el('a', 'p-link'); a.href = l.url; const kind = /-crew\//.test(l.url) ? 'crew' : /-glitch\//.test(l.url) ? 'glitch' : /-kodograd\//.test(l.url) ? 'kodograd' : /typing-escape/.test(l.url) ? 'typing' : 'adventure', pic = new Image(); pic.className = 'p-linkpic'; pic.alt = ''; pic.src = `art/link_${kind}.webp?v=${P.artVersion || ''}`; pic.addEventListener('error', () => pic.remove()); a.append(pic, el('strong', '', l.title), el('span', '', l.about), el('small', '', l.note)); a.addEventListener('click', e => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return; e.preventDefault(); open({title: l.title, url: l.url, link: true}); }); links.append(a); } more.append(links);
    const grades = el('nav', 'p-grades'); grades.setAttribute('aria-label', 'Другие классы'); grades.append(el('span', '', 'Другой класс:'));
    for (let g = 6; g <= 11; g++) { const a = el('a', g === data.grade ? 'now' : '', String(g)); if (g === data.grade) a.setAttribute('aria-current', 'page'); a.href = `/courses/game-${g}-practicum/`; grades.append(a); }
    const parts = [head, intro]; if (notice) parts.push(el('p', 'p-note', notice)); if (!remote) parts.push(el('p', 'p-note', 'Журнал сейчас недоступен: прогресс хранится только на этом компьютере, отметки не отправляются.'));
    paint(...parts, extras(), grid, more, grades);
  }

  function open(game, level) {
    current = game; close(false);
    const seed = {}; for (const g of P.games) { seed[g.id] = {}; for (let n = 1; n <= g.levels; n++) if (player.levels[g.id + '-' + n]) seed[g.id][n] = player.levels[g.id + '-' + n].stars; }
    try { sessionStorage.setItem('school4-seed', JSON.stringify(seed)); } catch {}
    const shell = el('div', 'p-player'), bar = el('div', 'p-player-bar');
    frame = el('iframe'); frame.title = game.title; frame.allow = 'fullscreen; autoplay'; frame.setAttribute('allowfullscreen', '');
    // Игра на Godot из общей копии либо отдельная страница сайта (например, «Герой кода»).
    frame.src = game.link ? game.url : game.url ? `${game.url}?${game.params}&player=${playerKey()}${level ? '&level=' + level : ''}` : `${P.gameUrl}?v=${P.version}&grade=${data.grade}&${game.params}&player=${playerKey()}`;
    const full = button('На весь экран', 'p-small', () => { (shell.requestFullscreen || shell.webkitRequestFullscreen).call(shell); frame.focus(); });
    const back = button('← К списку игр', 'p-small', () => close(true)); back.dataset.act = 'close';
    const live = el('span', 'p-live', `${player.name} · ${game.title}`); live.dataset.live = '1'; live.setAttribute('aria-live', 'polite');
    bar.append(back, live, el('span', 'p-hint', 'Если игра не реагирует на клавиши — щёлкни по ней мышью. Esc на этой панели — к списку игр.'), full); shell.append(bar, frame); document.body.append(shell); document.body.classList.add('p-playing');
    shell.release = layer(shell, shell, 'Игра «' + game.title + '»', () => { if (!document.fullscreenElement) close(true); }); back.focus();
    frame.addEventListener('load', () => { frame.focus(); tidy(game); });
  }
  // Внутри окна практикума прячем шапку портала (её ссылки вели в старый каталог и меню игр),
  // а если ученик всё же ушёл со страницы игры на другую страницу сайта — возвращаем его к списку игр.
  function tidy(game) {
    let doc, path; try { doc = frame.contentDocument; path = frame.contentWindow.location.pathname; } catch { return; }
    const home = (game.url || P.gameUrl || '').replace(/index\.html$/, '');
    if (!doc || (home && !path.startsWith(home))) { close(true); return; }
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) doc.addEventListener(ev, touch, true);
    const st = doc.createElement('style'); st.textContent = '.s4-toolbar{display:none!important}body.s4-course{padding-top:0!important}'; (doc.head || doc.documentElement).append(st);
    doc.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href]'); if (!a || a.target === '_blank') return; let u; try { u = new URL(a.href, doc.baseURI); } catch { return; } if (u.origin === location.origin && home && !u.pathname.startsWith(home) && !/\.(pdf|docx?|xlsx?|pptx?|zip|txt|csv|py|sql|png|jpe?g|webp)$/i.test(u.pathname)) { e.preventDefault(); close(true); } }, true);
  }
  function close(redraw) {
    const shell = document.querySelector('.p-player'); if (!shell) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    shell.remove(); frame = null; document.body.classList.remove('p-playing'); shell.release?.(); if (redraw && player) { const mine = player; (pushing || Promise.resolve()).catch(() => {}).then(stats).then(() => { if (mine === player && !frame && root.querySelector('.p-grid')) list(); }); list(); }   // свежая статистика — только если ученик всё ещё на списке игр
  }
  window.addEventListener('message', e => {
    // Сообщения принимаются только от своей игры, с этого же сайта.
    if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow || !player || !e.data || typeof e.data !== 'object') return;
    if (e.data.school4 === 'close') { close(true); return; }
    if (e.data.school4 !== 'result') return;
    const game = P.games.find(g => g.id === e.data.world), n = e.data.n, st = e.data.stars;
    if (!game || !Number.isInteger(n) || n < 1 || n > game.levels || ![1, 2, 3].includes(st)) return;
    const id = game.id + '-' + n, old = player.levels[id];
    player.levels[id] = {stars: Math.max(st, old?.stars || 0), detail: String(e.data.detail || '').slice(0, 80), plays: (old?.plays || 0) + 1, clean: st === 3 || !!old?.clean};
    if (!me && game.id === dailyGame().id && !player.levels[dayKey(new Date())]) { player.levels[dayKey(new Date())] = {stars: 3, detail: game.title, plays: 1, clean: true}; const live2 = document.querySelector('[data-live]'); if (live2) setTimeout(() => { live2.textContent += ' · задание дня выполнено 🔥'; }, 50); }
    save(); push().then(stats).catch(() => {});
    const live = document.querySelector('[data-live]'); if (live) live.textContent = `${player.name} · ${game.title} · ★ ${stars(game)} из ${game.levels * 3}`;
  });

  async function submit(game, send, status) {
    const got = stars(game), max = game.levels * 3, mark = markOf(game);
    if (mark < 3 || !remote) return;
    const answers = []; for (let n = 1; n <= game.levels; n++) { const r = player.levels[game.id + '-' + n]; answers.push({num: n, title: `${game.unit} ${n}`, isCorrect: !!r, userAns: r ? '★'.repeat(r.stars) + (r.detail ? ' · ' + r.detail : '') : 'не пройден'}); }
    send.disabled = true; status.textContent = 'Отправляем результат в журнал…';
    try {
      await call('progress', {...who(), levels: player.levels});
      const d = await call('submit', {...who(), worldId: game.id, topic: `${data.grade} класс: Кодоград · практикум · ${game.title}`, score: got, maxScore: max, percent: Math.round(got / max * 100), mark, attempt: 1, answers});
      player.sent = d.sent; save(); list();
      const fresh = document.querySelector(`[data-mark="${game.id}"]`)?.closest('.p-card')?.querySelector('.p-status'); if (fresh) fresh.textContent = (d.updated ? 'Отметка принята в журнал. ' : 'В журнале уже был результат не хуже. ') + `Квитанция № ${d.id} · ${d.time}`;
    } catch (error) { send.disabled = false; status.textContent = 'Отметка НЕ отправлена: ' + (error.name === 'TimeoutError' ? 'сервер долго не отвечает' : error.message) + '. Попробуй ещё раз.'; }
  }

  (async () => {
    root.replaceChildren(el('p', '', 'Загружаем практикум…')); root.firstChild.setAttribute('role', 'status');
    try { classes = await call('classes?slug=' + P.apiSlug, null, 3500); remote = true; } catch { remote = false; }
    try { const key = sessionStorage.getItem(STORE), w = JSON.parse(sessionStorage.getItem(WHO) || 'null'); if (key && store.profiles[key] && w && Date.now() - w.at < IDLE) { player = store.profiles[key]; remember(); } } catch {}
    if (player && remote) try { await pull(); } catch (error) { if (error.status === 403) player = null; }
    if (player) { await stats(); list(); } else { login(); teacherProbe(); }
  })();
})();
