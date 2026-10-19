// «Кодоград: Герой кода» — интерфейс: карта уровней, редактор кода, поле подземелья, проверка и звёзды.
(() => {
  'use strict';
  const C = window.CodeHero, {LEVELS, CHAPTERS, DOC, REQUIRED, STORY} = window.CodeHeroLevels;
  const data = JSON.parse(document.getElementById('assignmentData').textContent), root = document.getElementById('codehero');
  const query = new URLSearchParams(location.search), embed = query.get('embed') === '1', playerKey = /^[a-z0-9]{1,24}$/.test(query.get('player') || '') ? query.get('player') : '';
  const STORE = 'school4-codehero:v1' + (playerKey ? ':' + playerKey : ''), [first, last] = REQUIRED[data.grade] || [1, 10], need = last - first + 1, graded = id => id >= first && id <= last, debugHost = location.hostname === '127.0.0.1';
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const button = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let save = {stars: {}, code: {}}; try { save = Object.assign(save, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch {}
  // Практикум нумерует уровни отметки с единицы; здесь это уровни first…last.
  try { const seed = JSON.parse(sessionStorage.getItem('school4-seed') || '{}').code || {}; for (const [n, st] of Object.entries(seed)) { const id = Number(n) + first - 1; if (st > (save.stars[id] || 0)) save.stars[id] = st; } } catch {}
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(save)); } catch {} };
  const post = msg => { if (parent !== window) parent.postMessage(msg, location.origin); };
  // Уровни открываются по порядку; пройденное на сервере считается пройденным и здесь.
  const unlocked = id => id === 1 || !!save.stars[id - 1] || !!save.stars[id];
  const tiles = new Image(); tiles.src = 'assets/dungeon.png';
  const MUSIC = {on: (() => { try { return localStorage.getItem('school4-codehero-music') !== '0'; } catch { return true; } })(), el: null,
    sync() { if (!this.el) { this.el = new Audio('assets/music.ogg?v=1'); this.el.loop = true; this.el.volume = 0.3; } if (this.on) this.el.play().catch(() => {}); else this.el.pause(); }};
  // Браузер разрешает звук только после действия пользователя: включаем музыку по первому щелчку или нажатию.
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { if (MUSIC.on && (!MUSIC.el || MUSIC.el.paused)) MUSIC.sync(); }, {once: true});
  // Новые картинки (нарисованы нейросетью, tools/art2): персонажи, предметы, пол и стены. Пока не загрузились — рисуется старый набор.
  const ART = {}; for (const n of ['unit_hero', 'unit_munchkin', 'unit_ogre', 'unit_brute', 'unit_bruiser', 'unit_archer', 'unit_shaman', 'unit_rat', 'unit_guard', 'unit_swarmlord', 'unit_mage', 'unit_glitch', 'item_potion', 'item_gem', 'item_bomb', 'item_door', 'item_exit', 'item_trap', 'item_trap_fire', 'floor', 'wall']) { const i = new Image(); i.onload = () => { ART[n] = i; }; i.src = `assets/art/${n}.webp?v=1`; }
  let runToken = 0, speed = 1;

  /* ---------------- карта уровней ---------------- */
  function map() {
    runToken++;
    const total = LEVELS.filter(l => graded(l.id)).reduce((s, l) => s + (save.stars[l.id] || 0), 0), max = need * 3, pct = total / max * 100, mark = pct >= 80 ? 5 : pct >= 60 ? 4 : pct >= 33 ? 3 : 2;
    const page = el('section', 'ch-map'), head = el('header', 'ch-head');
    const title = el('div'); title.append(el('p', 'ch-eyebrow', `${data.grade} класс · программирование на Python`), el('h1', '', 'Герой кода'), el('p', 'ch-lead', STORY.intro));
    const stat = el('div', 'ch-stat'); stat.append(el('strong', '', `★ ${total} из ${max}`), el('span', '', `В отметку идут уровни ${first}–${last}`), el('span', 'ch-mark', mark >= 3 ? `Сейчас отметка: ${mark}` : `До тройки: ещё ★ ${Math.ceil(max * 0.33 - 1e-9) - total}`));
    const bar = el('div', 'ch-bar'), fill = el('i'); fill.style.width = pct + '%'; bar.append(fill); stat.append(bar);
    head.append(title, stat); page.append(head);
    CHAPTERS.forEach((name, ci) => {
      const list = LEVELS.filter(l => l.chapter === ci); if (!list.length) return;
      const row = el('section', 'ch-chapter'), cap = el('div', 'ch-cap'); cap.append(el('small', '', `Глава ${ci + 1}`), el('h2', '', name), el('p', 'ch-tale', STORY.chapters[ci] || '')); row.append(cap);
      const nodes = el('div', 'ch-nodes');
      for (const l of list) {
        const st = save.stars[l.id] || 0, open = unlocked(l.id);
        const b = button('', 'ch-node' + (st ? ' done' : open ? ' open' : ' locked') + (graded(l.id) ? '' : ' extra'), () => level(l)); b.disabled = !open; b.dataset.level = l.id;
        b.append(el('b', '', String(l.id)), el('strong', '', l.title), el('span', '', l.concept), el('i', '', st ? '★'.repeat(st) + '☆'.repeat(3 - st) : open ? 'играть' : 'закрыт'));
        if (!graded(l.id)) b.title = 'В отметку этого класса уровень не входит, но проходить его всё равно нужно по порядку';
        nodes.append(b);
      }
      row.append(nodes); page.append(row);
    });
    page.append(el('p', 'ch-note', embed ? 'Звёзды сохраняются в практикуме на твоё имя. Отметку отправляй со страницы практикума.' : 'Звёзды хранятся в этом браузере. Чтобы получить отметку, открой игру из «Игрового практикума» своего класса.'));
    root.replaceChildren(page); report({view: 'map'});
  }

  /* ---------------- редактор ---------------- */
  const esc = s => s.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));
  function highlight(src) {
    return src.split('\n').map(line => {
      const hash = line.search(/#(?=(?:[^"']|"[^"]*"|'[^']*')*$)/), code = hash >= 0 ? line.slice(0, hash) : line, comment = hash >= 0 ? line.slice(hash) : '';
      const html = esc(code).replace(/("[^"]*"?|'[^']*'?)|\b(if|elif|else|while|for|in|def|return|break|continue|pass|and|or|not|True|False|None)\b|\b(hero)\b|\b(\d+)\b|\.([A-Za-z_]\w*)/g, (m, s, kw, hero, num, attr) => s ? `<span class="s">${s}</span>` : kw ? `<span class="k">${kw}</span>` : hero ? `<span class="h">${hero}</span>` : num ? `<span class="n">${num}</span>` : `.<span class="m">${attr}</span>`);
      return html + (comment ? `<span class="c">${esc(comment)}</span>` : '');
    }).join('\n') + '\n';
  }
  function editor(initial, onChange) {
    const box = el('div', 'ch-editor'), gutter = el('pre', 'ch-gutter'), wrap = el('div', 'ch-code'), hl = el('pre', 'ch-hl'), ta = el('textarea');
    ta.spellcheck = false; ta.autocapitalize = 'off'; ta.autocomplete = 'off'; ta.setAttribute('aria-label', 'Программа героя'); hl.setAttribute('aria-hidden', 'true');
    let active = 0, error = 0;
    const paint = () => {
      hl.innerHTML = highlight(ta.value);
      const n = ta.value.split('\n').length; gutter.replaceChildren(...Array.from({length: n}, (_, i) => el('span', i + 1 === error ? 'err' : i + 1 === active ? 'run' : '', String(i + 1))));
      hl.style.height = gutter.style.height = ''; ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight, 260) + 'px';
    };
    const insert = text => { const s = ta.selectionStart, e = ta.selectionEnd; ta.setRangeText(text, s, e, 'end'); paint(); onChange(ta.value); };
    ta.addEventListener('input', () => { error = 0; paint(); onChange(ta.value); });
    ta.addEventListener('keydown', e => {
      const s = ta.selectionStart, before = ta.value.slice(0, s), lineStart = before.lastIndexOf('\n') + 1, line = before.slice(lineStart);
      if (e.key === 'Tab') { e.preventDefault(); insert('    '); }
      else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); const indent = line.match(/^ */)[0] + (line.trimEnd().endsWith(':') ? '    ' : ''); insert('\n' + indent); }
      else if (e.key === 'Backspace' && s === ta.selectionEnd && line.length && !line.trim() && line.length % 4 === 0) { e.preventDefault(); ta.setRangeText('', s - 4, s, 'end'); paint(); onChange(ta.value); }
    });
    const inner = el('div', 'ch-inner'); ta.value = initial; inner.append(hl, ta); wrap.append(inner); box.append(gutter, wrap); requestAnimationFrame(paint);
    return {box, ta, get value() { return ta.value; }, set value(v) { ta.value = v; error = 0; active = 0; paint(); onChange(v); },
      mark(line, isError) { if (isError) error = line; else active = line; const n = gutter.children; for (let i = 0; i < n.length; i++) n[i].className = i + 1 === error ? 'err' : i + 1 === active ? 'run' : ''; },
      insertLine(text) { const s = ta.selectionStart, before = ta.value.slice(0, s), lineStart = before.lastIndexOf('\n') + 1, cur = ta.value.slice(lineStart).split('\n')[0], indent = cur.match(/^ */)[0]; if (cur.trim()) { ta.selectionStart = ta.selectionEnd = lineStart + cur.length; insert('\n' + indent + text); } else { ta.selectionStart = ta.selectionEnd = lineStart + cur.length; insert((cur.length ? '' : indent) + text); } ta.focus(); }};
  }

  /* ---------------- поле ---------------- */
  const TILE = {floor: [48, 49, 50, 51, 48, 48, 53, 48], wall: 40, wallTop: 57, hero: 97, munchkin: 108, ogre: 109, brute: 110, bruiser: 87, archer: 112, shaman: 111, rat: 123, guard: 96, swarmlord: 122, mage: 84, glitch: 121, potion: 115, door: 45, exit: 46};
  const BIG = {brute: 1.12, bruiser: 1.1, guard: 1.5, swarmlord: 1.5, mage: 1.35, glitch: 1.7};
  function board(canvas) {
    const g = canvas.getContext('2d'); let w = null, cell = 48, ox = 0, oy = 0, fx = [], shots = [], hero = {x: 0, y: 0, bump: 0, flash: 0, hp: 0}, pos = new Map(), bubble = null, dark = false, raf = 0, last = performance.now(), swing = null;
    // Картинка персонажа или предмета: вписывается в квадрат s×s, стоит на его нижней стороне.
    const unit = (name, x, y, s, alpha = 1) => { const im = ART[name]; if (!im) return false; const k = Math.min(s / im.width, s / im.height), w = im.width * k, h = im.height * k; g.globalAlpha = alpha; g.drawImage(im, Math.round(x + (s - w) / 2), Math.round(y + s - h), w, h); g.globalAlpha = 1; return true; };
    const tile = (n, x, y, s = cell, alpha = 1) => { if (!tiles.complete) return; g.globalAlpha = alpha; g.drawImage(tiles, (n % 12) * 16, Math.floor(n / 12) * 16, 16, 16, Math.round(x), Math.round(y), Math.ceil(s), Math.ceil(s)); g.globalAlpha = 1; };
    const px = (x, y) => [ox + x * cell, oy + y * cell];
    function fit() {
      const W = canvas.width, H = canvas.height, pad = 30; cell = Math.floor(Math.min((W - pad * 2) / w.w, (H - pad * 2) / w.h, 84)); ox = Math.round((W - cell * w.w) / 2) + 6; oy = Math.round((H - cell * w.h) / 2) - 6;
    }
    function set(world) { w = world; dark = !!w.level.dark; fx = []; bubble = null; swing = null; hero = {x: w.hero.x, y: w.hero.y, bump: 0, flash: 0, hp: w.hero.hp, mana: w.hero.mana, shield: 0, tick: 0}; shots = []; pos = new Map(w.enemies.map(e => [e.id, {x: e.x, y: e.y, hp: e.hp, dead: false, flash: 0, fade: 1, state: 'idle'}])); fit(); if (!raf) raf = requestAnimationFrame(frame); }
    const float = (text, x, y, color) => fx.push({text, x, y, color, life: 1});
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; raf = canvas.isConnected ? requestAnimationFrame(frame) : 0; if (!w) return;
      g.imageSmoothingEnabled = false; g.fillStyle = '#12141f'; g.fillRect(0, 0, canvas.width, canvas.height);
      const seen = (x, y) => !dark || Math.abs(x - hero.x) + Math.abs(y - hero.y) <= 2.2;
      for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
        const [sx, sy] = px(x, y), wall = w.walls.has(x + ',' + y);
        if (!seen(x, y)) { g.fillStyle = '#0b0c14'; g.fillRect(sx, sy, cell, cell); continue; }
        if (wall) { if (ART.wall) g.drawImage(ART.wall, Math.round(sx), Math.round(sy), Math.ceil(cell), Math.ceil(cell)); else tile(TILE.wall, sx, sy); if (y + 1 < w.h && !w.walls.has(x + ',' + (y + 1))) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(sx, sy + cell - cell * 0.12, cell, cell * 0.12); } } else if (ART.floor) g.drawImage(ART.floor, (x % 2) * 128, (y % 2) * 128, 128, 128, Math.round(sx), Math.round(sy), Math.ceil(cell), Math.ceil(cell)); else tile(TILE.floor[(x * 7 + y * 13) % TILE.floor.length], sx, sy);
      }
      g.font = `600 ${Math.max(10, cell * 0.2)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#8f9bb8';
      if (!dark) { for (let x = 0; x < w.w; x++) g.fillText(String(x), ox + x * cell + cell / 2, oy + w.h * cell + 12); for (let y = 0; y < w.h; y++) g.fillText(String(w.h - 1 - y), ox - 12, oy + y * cell + cell / 2); }
      for (const t of w.traps) { if (!seen(t.x, t.y)) continue; const [sx, sy] = px(t.x, t.y), hot = C.burning(t, hero.tick), soon = C.burning(t, hero.tick + 1);
        if (ART.item_trap && ART.item_trap_fire) { const lift = hot ? cell * 0.14 : 0; g.drawImage(ART[hot ? 'item_trap_fire' : 'item_trap'], sx + cell * 0.07, sy + cell * 0.07 - lift, cell * 0.86, cell * 0.86 + lift); if (soon && !hot) { g.strokeStyle = `rgba(255,178,26,${0.6 + 0.4 * Math.sin(now / 90)})`; g.lineWidth = 4; g.strokeRect(sx + cell * 0.08, sy + cell * 0.08, cell * 0.84, cell * 0.84); } continue; }
        g.fillStyle = '#2a1c1c'; g.fillRect(sx + cell * 0.12, sy + cell * 0.12, cell * 0.76, cell * 0.76); g.strokeStyle = soon ? '#ffb21a' : '#6b4a3a'; g.lineWidth = 3; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(sx + cell * 0.12 + i * cell * 0.19, sy + cell * 0.14); g.lineTo(sx + cell * 0.12 + i * cell * 0.19, sy + cell * 0.86); g.stroke(); }
        if (hot) { for (let i = 0; i < 3; i++) { const fx0 = sx + cell * (0.3 + i * 0.2), h = cell * (0.5 + 0.2 * Math.sin(now / 60 + i * 2)); g.fillStyle = i === 1 ? '#ffd34d' : '#ff7a2a'; g.beginPath(); g.moveTo(fx0 - cell * 0.12, sy + cell * 0.8); g.quadraticCurveTo(fx0, sy + cell * 0.8 - h * 1.6, fx0 + cell * 0.12, sy + cell * 0.8); g.fill(); } } }
      if (w.exit && seen(w.exit.x, w.exit.y)) { const [sx, sy] = px(w.exit.x, w.exit.y); g.fillStyle = `rgba(255,90,90,${0.25 + 0.15 * Math.sin(now / 300)})`; g.fillRect(sx, sy, cell, cell); unit('item_exit', sx + cell * 0.04, sy + cell * 0.02, cell * 0.92) || tile(TILE.exit, sx, sy); }
      for (const d of w.doors) { if (!seen(d.x, d.y)) continue; const [sx, sy] = px(d.x, d.y); if (!d.open) { unit('item_door', sx, sy, cell) || tile(TILE.door, sx, sy); g.fillStyle = '#ffd34d'; g.fillText('🔒', sx + cell / 2, sy - 2); } else { g.fillStyle = 'rgba(95,224,181,.18)'; g.fillRect(sx, sy, cell, cell); } }
      for (const it of w.items) {
        if (it.shown === false || !seen(it.x, it.y)) continue; const [sx, sy] = px(it.x, it.y), cx = sx + cell / 2, cy = sy + cell / 2 + Math.sin(now / 350 + it.id) * cell * 0.04;
        if (unit('item_' + (it.type === 'potion' || it.type === 'gem' ? it.type : 'bomb'), sx + cell * 0.17, cy - cell * 0.36, cell * 0.66)) { /* нарисовано картинкой */ }
        else if (it.type === 'potion') tile(TILE.potion, sx + cell * 0.15, sy + cell * 0.15, cell * 0.7);
        else if (it.type === 'gem') { const r = cell * 0.24; g.fillStyle = '#1a2a4a'; g.beginPath(); g.moveTo(cx, cy - r - 3); g.lineTo(cx + r + 3, cy); g.lineTo(cx, cy + r + 3); g.lineTo(cx - r - 3, cy); g.fill(); g.fillStyle = '#35d8ff'; g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.fill(); g.fillStyle = '#b8f4ff'; g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r * 0.45, cy - r * 0.2); g.lineTo(cx - r * 0.45, cy - r * 0.2); g.fill(); }
        else { const r = cell * 0.22; g.fillStyle = '#1a1a22'; g.beginPath(); g.arc(cx, cy + 2, r + 3, 0, 7); g.fill(); g.fillStyle = '#3a3d4d'; g.beginPath(); g.arc(cx, cy + 2, r, 0, 7); g.fill(); g.strokeStyle = '#c9a15a'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + r * 0.5, cy - r * 0.7); g.lineTo(cx + r, cy - r * 1.4); g.stroke(); g.fillStyle = Math.sin(now / 90) > 0 ? '#ffb21a' : '#ff5a4a'; g.beginPath(); g.arc(cx + r, cy - r * 1.4, 3.5, 0, 7); g.fill(); }
      }
      for (const e of w.enemies) {
        const p = pos.get(e.id); if (!p || p.fade <= 0 || !seen(Math.round(p.x), Math.round(p.y))) continue; if (p.dead) p.fade -= dt * 2.5; p.flash = Math.max(0, p.flash - dt * 4);
        const [sx, sy] = px(p.x, p.y), k = BIG[e.kind] || 1, s = cell * k;
        unit('unit_' + e.kind, sx - (s * 1.14 - cell) / 2 + (p.flash ? Math.sin(now / 20) * 3 : 0), sy - (s * 1.14 - cell) - cell * 0.02, s * 1.14, Math.max(0, p.fade)) || tile(TILE[e.kind], sx - (s - cell) / 2 + (p.flash ? Math.sin(now / 20) * 3 : 0), sy - (s - cell), s, Math.max(0, p.fade));
        if (p.state === 'frozen' && !p.dead) { g.fillStyle = 'rgba(120,220,255,.45)'; g.fillRect(sx - (s - cell) / 2, sy - (s - cell), s, s); }
        if (!p.dead && p.state !== 'idle') { const mark = p.state === 'charging' ? '!' : p.state === 'casting' ? '✦' : '❄', col = p.state === 'charging' ? '#ff4a4a' : p.state === 'casting' ? '#c98bff' : '#7fe0ff', bx = sx + cell / 2, by = sy - (s - cell) - 34 + Math.sin(now / 90) * 3; g.fillStyle = '#0b0c14'; g.beginPath(); g.arc(bx, by, cell * 0.2, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(bx, by, cell * 0.16, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `900 ${Math.max(13, cell * 0.24)}px system-ui`; g.fillText(mark, bx, by + 1); }
        if (!p.dead) { const lift = s - cell; g.save(); g.translate(0, -lift); g.fillStyle = '#0b0c14'; g.fillRect(sx + 4, sy - 9, cell - 8, 6); g.fillStyle = '#ff5a6a'; g.fillRect(sx + 5, sy - 8, (cell - 10) * p.hp / e.maxHp, 4); g.font = `700 ${Math.max(11, cell * 0.22)}px system-ui`; g.lineWidth = 4; g.strokeStyle = '#0b0c14'; g.strokeText(e.name, sx + cell / 2, sy - 20); g.fillStyle = '#ffe9c9'; g.fillText(e.name, sx + cell / 2, sy - 20); g.restore(); }
      }
      hero.flash = Math.max(0, hero.flash - dt * 4);
      { const [sx, sy] = px(hero.x, hero.y); g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(sx + cell / 2, sy + cell * 0.92, cell * 0.3, cell * 0.09, 0, 0, 7); g.fill(); unit('unit_hero', sx - cell * 0.08 + (hero.flash ? Math.sin(now / 20) * 3 : 0), sy - cell * 0.2 + Math.sin(now / 260) * 1.5, cell * 1.16) || tile(TILE.hero, sx + (hero.flash ? Math.sin(now / 20) * 3 : 0), sy - cell * 0.06 + Math.sin(now / 260) * 1.5); if (hero.flash) { g.fillStyle = `rgba(255,60,60,${hero.flash * 0.5})`; g.fillRect(sx, sy, cell, cell); }
        if (hero.shield > 0) { hero.shield -= dt * 2.2; g.strokeStyle = `rgba(120,200,255,${Math.min(1, hero.shield * 1.5)})`; g.lineWidth = cell * 0.08; g.beginPath(); g.arc(sx + cell / 2, sy + cell / 2, cell * 0.52, 0, 7); g.stroke(); g.fillStyle = `rgba(120,200,255,${Math.min(0.25, hero.shield * 0.4)})`; g.fill(); } }
      shots = shots.filter(sh => (sh.t += dt / sh.d) < 1.25);
      for (const sh of shots) { const k = Math.min(1, sh.t), [ax, ay] = px(sh.from.x, sh.from.y), [bx, by] = px(sh.to.x, sh.to.y), x = ax + (bx - ax) * k + cell / 2, y = ay + (by - ay) * k + cell / 2 - Math.sin(k * Math.PI) * cell * 0.6; if (sh.t < 1) { g.fillStyle = sh.color; g.beginPath(); g.arc(x, y, cell * 0.14, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, cell * 0.06, 0, 7); g.fill(); } else if (sh.boom) { const r = cell * (0.5 + (sh.t - 1) * 5); g.fillStyle = `rgba(255,150,40,${Math.max(0, 1 - (sh.t - 1) * 4) * 0.7})`; g.beginPath(); g.arc(bx + cell / 2, by + cell / 2, r, 0, 7); g.fill(); } }
      if (swing) { swing.life -= dt * 5; if (swing.life <= 0) swing = null; else { const [sx, sy] = px(swing.x, swing.y); g.strokeStyle = `rgba(255,255,255,${swing.life})`; g.lineWidth = cell * 0.12; g.beginPath(); g.arc(sx + cell / 2, sy + cell / 2, cell * 0.36, -1 + (1 - swing.life) * 3, 0.6 + (1 - swing.life) * 3); g.stroke(); } }
      fx = fx.filter(f => (f.life -= dt * 1.1) > 0); g.font = `800 ${Math.max(13, cell * 0.3)}px system-ui`;
      for (const f of fx) { const [sx, sy] = px(f.x, f.y), y = sy - (1 - f.life) * cell * 0.7; g.globalAlpha = Math.min(1, f.life * 2); g.lineWidth = 4; g.strokeStyle = '#0b0c14'; g.strokeText(f.text, sx + cell / 2, y); g.fillStyle = f.color; g.fillText(f.text, sx + cell / 2, y); g.globalAlpha = 1; }
      if (bubble) { bubble.life -= dt; if (bubble.life <= 0) bubble = null; else { const [sx, sy] = px(hero.x, hero.y); g.font = `700 ${Math.max(13, cell * 0.24)}px system-ui`; const tw = Math.min(canvas.width - 20, g.measureText(bubble.text).width + 24), bx = Math.max(8, Math.min(canvas.width - tw - 8, sx + cell / 2 - tw / 2)), by = Math.max(6, sy - 44); g.fillStyle = '#fff6dc'; g.strokeStyle = '#10162b'; g.lineWidth = 3; g.beginPath(); g.roundRect(bx, by, tw, 30, 10); g.fill(); g.stroke(); g.fillStyle = '#10162b'; g.fillText(bubble.text, bx + tw / 2, by + 16); } }
    }
    // Проиграть события одного хода; длительность зависит от скорости.
    async function play(events) {
      for (const ev of events) {
        const d = 260 / speed;
        if (ev.e === 'move') await tween(hero, ev.to, d);
        else if (ev.e === 'bump') { const sx = hero.x, sy = hero.y; await tween(hero, {x: sx + ev.dx * 0.25, y: sy + ev.dy * 0.25}, d * 0.4); await tween(hero, {x: sx, y: sy}, d * 0.4); float(ev.what === 'стена' ? 'Стена!' : ev.what === 'дверь' ? 'Заперто!' : 'Занято!', sx, sy, '#ffb3b3'); }
        else if (ev.e === 'shield') { hero.shield = 1; float('Щит', hero.x, hero.y, '#8fd0ff'); await sleep(d * 0.7); }
        else if (ev.e === 'cleave') { swing = {x: hero.x, y: hero.y, life: 1.4}; for (const h of ev.hits) { const p = pos.get(h.id); p.flash = 1; p.hp = h.hp; if (h.dead) p.dead = true; float('−10', h.x, h.y, '#ffd34d'); } if (!ev.hits.length) float('Мимо', hero.x, hero.y, '#c9d2e3'); await sleep(d); }
        else if (ev.e === 'cast') {
          hero.mana = ev.mana;
          if (ev.spell === 'heal') { hero.hp = ev.hp; float('+30', hero.x, hero.y, '#5fe0b5'); for (let i = 0; i < 6; i++) fx.push({text: '✚', x: hero.x + (Math.random() - 0.5) * 0.8, y: hero.y + Math.random() * 0.4, color: '#5fe0b5', life: 0.6 + Math.random() * 0.5}); await sleep(d * 1.2); }
          else { shots.push({from: {x: hero.x, y: hero.y}, to: {x: ev.x, y: ev.y}, t: 0, d: d * 1.1 / 1000, color: ev.spell === 'fireball' ? '#ff7a2a' : '#7fe0ff', boom: ev.spell === 'fireball' && !ev.miss}); await sleep(d * 1.1);
            for (const h of ev.hits || []) { const p = pos.get(h.id); p.flash = 1; float('−' + (p.hp - h.hp), h.x, h.y, '#ff9a3a'); p.hp = h.hp; if (h.dead) p.dead = true; }
            if (ev.self) { hero.hp = ev.hp; hero.flash = 1; float('−10 ожог!', hero.x, hero.y, '#ff7a6a'); }
            await sleep(d * 0.5); }
        }
        else if (ev.e === 'state') { const p = pos.get(ev.id); if (p) p.state = ev.state; if (ev.state === 'charging') float('Замах!', p.x, p.y, '#ff6a6a'); else if (ev.state === 'casting') float('Колдует!', p.x, p.y, '#c98bff'); await sleep(d * 0.35); }
        else if (ev.e === 'miss') { const p = pos.get(ev.id); if (p) float('Мимо!', p.x, p.y, '#c9d2e3'); await sleep(d * 0.4); }
        else if (ev.e === 'heal') { const p = pos.get(ev.target), from = pos.get(ev.id); if (p && from) { shots.push({from: {x: from.x, y: from.y}, to: {x: p.x, y: p.y}, t: 0, d: d * 0.8 / 1000, color: '#5fe0b5'}); await sleep(d * 0.8); float('+' + (ev.hp - p.hp), p.x, p.y, '#5fe0b5'); p.hp = ev.hp; } }
        else if (ev.e === 'spawn') { pos.set(ev.enemy.id, {x: ev.enemy.x, y: ev.enemy.y, hp: ev.enemy.hp, dead: false, flash: 1, fade: 1, state: 'idle'}); float('Подкрепление!', ev.enemy.x, ev.enemy.y, '#ffb3b3'); await sleep(d * 0.4); }
        else if (ev.e === 'burn') { hero.hp = ev.hp; hero.flash = 1; float('−20 огонь!', hero.x, hero.y, '#ff7a2a'); await sleep(d * 0.6); }
        else if (ev.e === 'attack') { swing = {x: ev.x, y: ev.y, life: 1}; const p = pos.get(ev.target); p.flash = 1; p.hp = ev.hp; float('−10', ev.x, ev.y, '#ffd34d'); if (ev.dead) p.dead = true; await sleep(d); }
        else if (ev.e === 'note') { float(ev.text, hero.x, hero.y, '#c9d2e3'); await sleep(d); }
        else if (ev.e === 'say') { bubble = {text: ev.text, life: 2.2 / Math.sqrt(speed)}; await sleep(d * 1.6); }
        else if (ev.e === 'door') { float('Открыто!', ev.x, ev.y, '#5fe0b5'); await sleep(d); }
        else if (ev.e === 'take') { const it = w.items.find(i => i.id === ev.id); it.shown = false; if (ev.type === 'gem') float('+1 💎', it.x, it.y, '#35d8ff'); else if (ev.type === 'potion') { hero.hp = ev.hp; float('+20', it.x, it.y, '#5fe0b5'); } else { hero.hp = ev.hp; hero.flash = 1; float('−15 БУМ!', it.x, it.y, '#ff7a6a'); } await sleep(d * 0.5); }
        else if (ev.e === 'hit') { const from = pos.get(ev.id); if ((ev.how === 'arrow' || ev.how === 'blast') && from) { shots.push({from: {x: from.x, y: from.y}, to: {x: hero.x, y: hero.y}, t: 0, d: d * 0.6 / 1000, color: ev.how === 'blast' ? '#c98bff' : '#e8e0c8'}); await sleep(d * 0.6); } hero.hp = ev.hp; if (!ev.blocked) hero.flash = 1; float((ev.blocked ? 'Блок −' : ev.how === 'smash' ? 'УДАР −' : '−') + ev.dmg, hero.x, hero.y, ev.blocked ? '#8fd0ff' : '#ff7a6a'); await sleep(d * 0.6); }
        else if (ev.e === 'enemyMove') await tween(pos.get(ev.id), ev.to, d * 0.8);
        else if (ev.e === 'wait') await sleep(d);
        onHud();
      }
      hero.tick = w.ticks;
    }
    function tween(obj, to, ms) { return new Promise(done => { const fx0 = obj.x, fy0 = obj.y, t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / ms), s = k * k * (3 - 2 * k); obj.x = fx0 + (to.x - fx0) * s; obj.y = fy0 + (to.y - fy0) * s; if (k < 1) requestAnimationFrame(step); else { obj.x = to.x; obj.y = to.y; done(); } }; requestAnimationFrame(step); }); }
    let onHud = () => {};
    return {set, play, get heroHp() { return hero.hp; }, get heroMana() { return hero.mana; }, set onHud(f) { onHud = f; }};
  }

  /* ---------------- уровень ---------------- */
  function level(lv) {
    const token = ++runToken; let world = C.makeWorld(lv, 1), running = false, hinted = false;
    const page = el('section', 'ch-level'), top = el('header', 'ch-top');
    const back = button('← Карта уровней', 'ch-btn', map); back.dataset.act = 'map';
    const name = el('div', 'ch-name'); name.append(el('small', '', `Глава ${lv.chapter + 1} · ${CHAPTERS[lv.chapter]}`), el('h1', '', `${lv.id}. ${lv.title}`));
    const best = el('div', 'ch-best', save.stars[lv.id] ? '★'.repeat(save.stars[lv.id]) + '☆'.repeat(3 - save.stars[lv.id]) : '☆☆☆');
    top.append(back, name, best);
    const left = el('div', 'ch-left'), right = el('div', 'ch-right');
    const canvas = el('canvas', 'ch-canvas'); canvas.width = 760; canvas.height = 470; const bd = board(canvas);
    const hud = el('div', 'ch-hud'), hp = el('div', 'ch-hp'), hpFill = el('i'), hpText = el('b'); hp.append(hpFill, hpText);
    const gold = el('span', 'ch-gold'), ticks = el('span', 'ch-ticks'), mana = el('span', 'ch-mana'); hud.append(el('span', '', 'Здоровье'), hp, mana, gold, ticks);
    const goals = el('ul', 'ch-goals'), message = el('div', 'ch-message'); message.setAttribute('role', 'status');
    const GOAL = {exit: 'Дойти до выхода', gems: 'Собрать все кристаллы', kill: 'Победить всех врагов', boss: 'Победить босса'};
    function drawHud() { hpFill.style.width = bd.heroHp / world.hero.maxHp * 100 + '%'; hpText.textContent = `${Math.max(0, Math.round(bd.heroHp))} / ${world.hero.maxHp}`; gold.textContent = `💎 ${world.hero.gold}`; ticks.textContent = `Ходов: ${world.ticks}`; mana.hidden = !world.hero.maxMana; mana.replaceChildren(el('span', '', 'Мана'), ...Array.from({length: world.hero.maxMana}, (_, i) => el('i', i < bd.heroMana ? 'on' : ''))); }
    function drawGoals(done, bonus) {
      goals.replaceChildren(...lv.goals.map(k => { const li = el('li', done ? 'ok' : '', GOAL[k]); li.prepend(el('b', '', done ? '✓' : '○')); return li; }),
        ...lv.bonus.map((b, i) => { const li = el('li', 'bonus' + (bonus && bonus[i] ? ' ok' : ''), C.bonusText(b)); li.prepend(el('b', '', bonus && bonus[i] ? '★' : '☆')); return li; }));
    }
    bd.onHud = drawHud; bd.set(world); drawHud(); drawGoals(false, null);
    left.append(canvas, hud, goals);
    const story = el('div', 'ch-story'); story.append(el('strong', '', lv.concept), el('p', '', lv.story));
    const ed = editor(save.code[lv.id] ?? lv.starter, v => { save.code[lv.id] = v; persist(); });
    const run = button('▶ Запустить', 'ch-run', () => running ? stop() : start()); run.dataset.act = 'run'; run.title = 'Ctrl + Enter';
    const reset = button('Начать заново', 'ch-btn', () => { if (running) stop(); ed.value = lv.starter; say('Код возвращён к началу уровня.', ''); }); reset.dataset.act = 'reset';
    const hint = button('Подсказка', 'ch-btn', () => { hinted = true; say(lv.hint, 'hint'); }); hint.dataset.act = 'hint';
    const fast = button('Скорость ×1', 'ch-btn', () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; fast.textContent = 'Скорость ×' + speed; }); fast.textContent = 'Скорость ×' + speed;
    // Фоновая музыка подземелья (собрана программой tools/music/make_music.py); выбор запоминается.
    const music = button(MUSIC.on ? '♪ Музыка: вкл' : '♪ Музыка: выкл', 'ch-btn', () => { MUSIC.on = !MUSIC.on; try { localStorage.setItem('school4-codehero-music', MUSIC.on ? '1' : '0'); } catch {} music.textContent = MUSIC.on ? '♪ Музыка: вкл' : '♪ Музыка: выкл'; MUSIC.sync(); }); music.dataset.act = 'music';
    const actions = el('div', 'ch-actions'); actions.append(run, fast, hint, reset, music);
    const docs = el('div', 'ch-docs'); docs.append(el('h3', '', 'Команды этого уровня'));
    for (const key of lv.docs) { const [code, about] = DOC[key], item = button('', 'ch-doc', () => ed.insertLine(code)); item.append(el('code', '', code), el('span', '', about)); item.title = 'Щёлкни, чтобы вставить в программу'; docs.append(item); }
    right.append(story, ed.box, actions, message, docs);
    const grid = el('div', 'ch-grid'); grid.append(left, right); page.append(top, grid); root.replaceChildren(page);
    function say(text, cls) { message.className = 'ch-message ' + (cls || ''); message.textContent = text; }
    say(lv.id === 1 && !save.stars[1] ? 'Напиши команды справа и нажми «Запустить». Команды из списка ниже вставляются щелчком.' : 'Нажми «Запустить» или Ctrl + Enter, чтобы проверить программу.', '');
    page.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!running) start(); } });
    function stop() { runToken++; running = false; run.textContent = '▶ Запустить'; run.classList.remove('stop'); ed.mark(0, false); world = C.makeWorld(lv, 1); bd.set(world); drawHud(); drawGoals(false, null); say('Остановлено. Можно править программу.', ''); report(); }
    async function start(seed) {
      const source = ed.value; let program;
      ed.mark(0, true); ed.mark(0, false);
      try { program = C.parse(source); } catch (error) { if (!(error instanceof C.PyError)) throw error; ed.mark(error.line, true); say(`Строка ${error.line}: ${error.message}`, 'error'); report({error: error.message}); return; }
      if (!program.length) { say('Программа пустая. Напиши хотя бы одну команду.', 'error'); return; }
      const my = ++runToken; running = true; run.textContent = '■ Остановить'; run.classList.add('stop');
      seed = seed || 1 + Math.floor(Math.random() * 1000); world = C.makeWorld(lv, seed); bd.set(world); drawHud(); drawGoals(false, null); say('Герой выполняет программу…', 'run'); report();
      let failure = null, lastLine = 0;
      try {
        for (const ev of C.run(program, {hero: C.heroApi(world, lv.api)})) {
          if (ev.type === 'line') { lastLine = ev.line; continue; }
          ed.mark(ev.line, false); await bd.play(ev.events); if (my !== runToken) return;
          if (world.won || world.lost) break;
        }
      } catch (error) { if (!(error instanceof C.PyError)) throw error; if (!world.won) failure = {message: error.message, line: error.line}; }
      if (my !== runToken) return;
      running = false; run.textContent = '▶ Запустить'; run.classList.remove('stop');
      if (!world.won && !failure) failure = {message: world.lost || C.unmet(world), line: 0};
      if (failure) { if (failure.line) ed.mark(failure.line, true); say((failure.line ? `Строка ${failure.line}: ` : '') + failure.message, 'error'); report({error: failure.message}); return; }
      // Скрытая проверка на других вариантах уровня: заученное решение не должно проходить.
      let stars = C.stars(lv, world, source), bonus = C.bonusMet(lv, world, source);
      for (let s = 1; s <= (lv.seeds || 1); s++) {
        const r = C.simulate(lv, source, s * 31 + 7);
        if (!r.ok) { say(`На этом варианте получилось, но уровень каждый раз немного другой — и на другом варианте программа не сработала: ${r.error} Нажми «Запустить» ещё раз и посмотри.`, 'error'); report({error: r.error, variant: true}); return; }
        const b = C.bonusMet(lv, r.world, source); bonus = bonus.map((x, i) => x && b[i]); stars = Math.min(stars, r.stars);
      }
      ed.mark(0, false); drawGoals(true, bonus);
      const before = save.stars[lv.id] || 0; if (stars > before) { save.stars[lv.id] = stars; persist(); }
      best.textContent = '★'.repeat(save.stars[lv.id]) + '☆'.repeat(3 - save.stars[lv.id]);
      if (graded(lv.id)) post({school4: 'result', world: 'code', n: lv.id - first + 1, stars: save.stars[lv.id], detail: `уровень ${lv.id}, строк: ${C.codeLines(source)}`});
      win(stars, bonus); report({won: true, got: stars});
    }
    function win(stars, bonus) {
      const next = LEVELS.find(l => l.id === lv.id + 1), box = el('div', 'ch-win');
      box.append(el('h2', '', next ? 'Уровень пройден!' : 'Глюк повержен!'), el('p', 'ch-stars', '★'.repeat(stars) + '☆'.repeat(3 - stars)));
      if (!next) box.append(el('p', 'ch-tale', STORY.outro));
      const missed = lv.bonus.filter((b, i) => !bonus[i]).map(C.bonusText);
      box.append(el('p', '', missed.length ? 'Ещё звезда: ' + missed.join('; ').toLowerCase() + '.' : 'Все цели выполнены — отличная программа!'));
      const row = el('div', 'ch-actions'); row.append(button('Улучшить код', 'ch-btn', () => { box.remove(); }));
      if (next) { const go = button(`Дальше: ${next.id}. ${next.title} →`, 'ch-run', () => level(next)); go.dataset.act = 'next'; row.append(go); } else row.append(button('К карте уровней', 'ch-run', map));
      box.append(row); message.className = 'ch-message'; message.replaceChildren(box);
    }
    function report(extra = {}) { if (debugHost) window.codehero = Object.assign({view: 'level', level: lv.id, running, won: world.won, lost: world.lost, hp: world.hero.hp, ticks: world.ticks, stars: save.stars, message: message.textContent}, extra); }
    if (debugHost) window.codeheroApi = {setCode: v => { ed.value = v; }, run: () => start(), runSeed: s => start(s)};
    report(); if (token === runToken) setTimeout(() => ed.ta.focus({preventScroll: true}), 50);
  }
  function report(extra) { if (debugHost) window.codehero = Object.assign({stars: save.stars}, extra); }

  tiles.addEventListener('load', () => {}); map();
})();
