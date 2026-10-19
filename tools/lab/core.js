// «Лаборатория Кодограда»: общая оболочка для небольших обучающих игр на чистом JS.
// Каждая игра лежит в games/*.js и регистрируется через LAB.register({id, title, levels(grade), mount(host, level, api), check, solve}).
// Логика игр (check/solve) не трогает страницу, поэтому проверяется тестом в node: tools/lab/tests/lab.test.js.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  if (typeof document === 'undefined') return;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const button = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  LAB.el = el; LAB.button = button;
  window.addEventListener('load', () => {
    const ORDER = ['oge', 'ege', 'sheets', 'arrays', 'logic', 'ipnet', 'bytes', 'sets', 'executors', 'autopilot', 'pcbuild', 'layout', 'office', 'gates', 'factory', 'detective', 'dbcity', 'pixel', 'race', 'quest']; LAB.games.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
    const data = JSON.parse(document.getElementById('assignmentData').textContent), root = document.getElementById('lab'), grade = data.grade;
    const query = new URLSearchParams(location.search), embed = query.get('embed') === '1', playerKey = /^[a-z0-9]{1,24}$/.test(query.get('player') || '') ? query.get('player') : '';
    const artV = document.getElementById('assignmentData').dataset.art || '', cover = g => { const i = el('img', 'lab-cover'); i.src = `art/cover_${g.id}.webp?v=${artV}`; i.alt = ''; i.loading = 'lazy'; i.addEventListener('error', () => i.remove()); return i; };
    const STORE = 'school4-lab:v1:' + grade + (playerKey ? ':' + playerKey : ''), debugHost = location.hostname === '127.0.0.1';
    let save = {}; try { save = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch {}
    // Из практикума приходят уже заработанные звёзды: игра продолжается с того же места на любом компьютере.
    try { const seed = JSON.parse(sessionStorage.getItem('school4-seed') || '{}'); for (const g of LAB.games) for (const [n, st] of Object.entries(seed[g.id] || {})) { save[g.id] = save[g.id] || {}; if (st > (save[g.id][n] || 0)) save[g.id][n] = st; } } catch {}
    const keep = () => { try { localStorage.setItem(STORE, JSON.stringify(save)); } catch {} };
    const post = msg => { if (parent !== window) parent.postMessage(msg, location.origin); };
    const starsOf = (g, n) => (save[g.id] || {})[n] || 0, total = g => g.levels(grade).reduce((s, _, i) => s + starsOf(g, i + 1), 0);
    let cleanup = null; const leave = () => { if (cleanup) { try { cleanup(); } catch {} cleanup = null; } };

    function hub() {
      leave(); const page = el('section', 'lab-hub');
      page.append(el('p', 'lab-eyebrow', `${grade} класс · лаборатория Кодограда`), el('h1', '', 'Выбери игру'), el('p', 'lab-lead', 'Игры про ОГЭ, таблицы, массивы, логику, сети, множества, объём информации, исполнителей, логику, данные, сети, алгоритмы и код. В каждой — уровни со звёздами: чем точнее и короче решение, тем больше звёзд.'));
      const grid = el('div', 'lab-grid');
      for (const g of LAB.games) { const n = g.levels(grade).length, card = button('', 'lab-card', () => levels(g)); card.dataset.game = g.id; card.style.setProperty('--c', g.color);
        card.append(cover(g), el('strong', '', g.title), el('small', '', g.genre), el('p', '', g.about), el('em', '', `★ ${total(g)} из ${n * 3} · уровней: ${n}`)); grid.append(card); }
      page.append(grid, el('p', 'lab-note', 'Звёзды хранятся в этом браузере. Чтобы получить отметку, открой игру из «Игрового практикума» своего класса.')); root.replaceChildren(page);
    }

    function levels(g) {
      leave(); const list = g.levels(grade), page = el('section', 'lab-levels'), head = el('header', 'lab-top'); page.style.setProperty('--c', g.color);
      head.append(embed && query.get('play') ? button('← К списку игр', 'lab-small', () => post({school4: 'close'})) : button('← Все игры', 'lab-small', hub), el('strong', '', g.title), el('span', 'lab-total', `★ ${total(g)} из ${list.length * 3}`));
      const grid = el('div', 'lab-lgrid'); let open = true;
      list.forEach((lv, i) => { const n = i + 1, st = starsOf(g, n), b = button('', 'lab-level' + (st ? ' done' : ''), () => play(g, n)); b.dataset.level = n; b.disabled = !open && !debugHost;
        b.append(el('b', '', String(n)), el('span', '', lv.title), el('i', '', st ? '★'.repeat(st) + '☆'.repeat(3 - st) : open ? 'открыт' : 'закрыт')); grid.append(b); if (!st) open = false; });
      const intro = el('div', 'lab-intro'); intro.append(cover(g), el('p', 'lab-lead', g.about)); page.append(head, intro, grid); if (g.extra) page.append(g.extra({el, button, grade, data, debugHost})); root.replaceChildren(page);
    }

    function play(g, n) {
      leave(); const list = g.levels(grade), lv = list[n - 1], page = el('section', 'lab-play'), head = el('header', 'lab-top'), host = el('div', 'lab-host'), over = el('div', 'lab-over'); over.hidden = true; page.style.setProperty('--c', g.color);
      head.append(button('← Уровни', 'lab-small', () => levels(g)), el('strong', '', `${g.title} · ${g.unit.toLowerCase()} ${n} из ${list.length}`), el('span', 'lab-total', lv.title));
      const api = {el, button, grade, n, debugHost,
        finish(stars, detail) { stars = Math.max(1, Math.min(3, Math.round(stars))); save[g.id] = save[g.id] || {}; const best = Math.max(stars, save[g.id][n] || 0); save[g.id][n] = best; keep(); post({school4: 'result', world: g.id, n, stars: best, detail: String(detail || '').slice(0, 80)});
          const box = el('div', 'lab-box'); box.append(el('p', 'lab-eyebrow', 'УРОВЕНЬ ПРОЙДЕН'), el('h2', 'lab-stars', '★'.repeat(stars) + '☆'.repeat(3 - stars)), el('p', '', detail || ''), el('p', 'lab-note', stars < 3 ? 'Три звезды дают за решение без лишних шагов и ошибок — можно переиграть.' : 'Отличное решение!'));
          const bar = el('div', 'lab-bar'); if (n < list.length) { const next = button('Дальше →', 'lab-main', () => play(g, n + 1)); next.dataset.act = 'next'; bar.append(next); } bar.append(button('Ещё раз', 'lab-small', () => play(g, n)), button('К уровням', 'lab-small', () => levels(g)));
          box.append(bar); over.replaceChildren(box); over.hidden = false; bar.firstChild.focus(); if (debugHost) window.labDone = {game: g.id, n, stars}; }};
      // Игра может задать свой фон (bg) и персонажа-ведущего (hero) — картинки из art/.
      if (g.bg) { page.classList.add('lab-themed'); page.style.backgroundImage = `linear-gradient(rgba(9,14,30,.62), rgba(9,14,30,.84)), url(art/${g.bg}.webp?v=1)`; }
      page.append(head, host, over); root.replaceChildren(page); cleanup = g.mount(host, lv, api) || null;
      const task = host.querySelector('.lab-task'); if (g.hero && task) { const h = new Image(); h.className = 'lab-hero'; h.alt = ''; h.src = `art/${g.hero}.webp?v=1`; h.addEventListener('error', () => h.remove()); task.prepend(h); } if (debugHost) window.labNow = {game: g.id, n, level: lv, solve: () => g.solve(lv, grade)};
    }

    const direct = LAB.games.find(g => g.id === query.get('play')), lvl = Number(query.get('level'));
    if (direct && lvl >= 1 && lvl <= direct.levels(grade).length) play(direct, lvl); else if (direct) levels(direct); else hub();
    if (debugHost) window.labGo = (id, n) => play(LAB.games.find(g => g.id === id), n);
  });
})();
