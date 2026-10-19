// «Битва класса»: экран ученика — лобби, вопросы, усилители, мемы, «Восхождение», привалы с мини-играми, итоги.
(() => {
  'use strict';
  const B = window.BattleQ, {h, btn, img, API, Sound, ART, POWER, MODES, TIERS, pick} = B;
  let timer = 0, tick = 0, alive = 0;
  function stop() { clearInterval(timer); clearInterval(tick); timer = tick = 0; alive++; Sound.stop(); try { speechSynthesis.cancel(); } catch {} }
  const climber = n => ART + 'climber_' + ((n | 0) % 12) + '.webp';

  async function student(ctx) {
    stop(); const run = alive, {root, player} = ctx;
    let me; try { me = await API('join', {className: player.className, name: player.name}); } catch (e) { alert('Не удалось войти в игру: ' + e.message); ctx.leave(); return; }
    Sound.init();
    const page = h('section', 'bt2'), top = h('div', 'bt2-top'), stage = h('div', 'bt2-stage'), main = h('div', 'bt2-main'), side = h('aside', 'bt2-side'), toasts = h('div', 'bt2-toasts'), pause = h('div', 'bt2-pause');
    const back = btn('← К играм', 'p-small', () => { stop(); ctx.leave(); }); back.dataset.act = 'bt-back';
    const title = h('strong', 'bt2-title', ''), hud = h('div', 'bt2-hud'), mus = btn('♪', 'bt2-icon', () => { Sound.on = !Sound.on; mus.classList.toggle('off', !Sound.on); Sound.stop(); });
    mus.title = 'Музыка и звуки';
    top.append(back, title, hud, mus); stage.append(main, side); pause.append(h('b', '', '⏸ Пауза'), h('span', '', 'Учитель поставил игру на паузу')); page.append(top, stage, toasts, pause); root.replaceChildren(page);
    const S = (path, extra = {}) => API(path, {className: player.className, key: me.key, token: me.token, ...extra});
    let d = null, shown = '', busy = false, feedback = false, view = '', box = null, deadline = 0, curQ = null, glitchT = 0;
    const toast = (text, cls = '') => { const t = h('div', 'bt2-toast ' + cls, text); toasts.append(t); setTimeout(() => t.remove(), 4200); };

    async function sync() {
      if (run !== alive || busy) return; busy = true;
      try { d = await S('sync'); } catch (e) { busy = false; if (e.status === 404 || e.status === 403) { stop(); main.replaceChildren(h('h2', '', e.status === 403 ? 'Ты больше не в игре.' : 'Учитель закрыл игру.'), btn('← К играм', 'p-primary', () => ctx.leave())); side.replaceChildren(); } return; }
      busy = false; if (run !== alive) return; render(); }

    function render() {
      title.textContent = d.title; page.dataset.mode = d.mode; page.dataset.phase = d.phase;
      const bits = [`★ ${d.score}`]; if (d.settings.leaderboard && d.place) bits.push(`#${d.place}`); if (d.streak > 1) bits.push(`🔥 ${d.streak}`); if (d.team) bits.push(d.team);
      hud.replaceChildren(...bits.map(t => h('span', 'bt2-pill', t))); if (d.teamColor) hud.lastChild.style.background = d.teamColor;
      for (const e of d.events || []) { toast(e.text, 'ev-' + e.kind); Sound.sfx('power'); }
      if (d.glitch > 0) { page.classList.add('glitch'); clearTimeout(glitchT); glitchT = setTimeout(() => page.classList.remove('glitch'), d.glitch * 1000); }
      page.classList.toggle('powerplay', d.powerplay > 0);
      pause.classList.toggle('on', !!d.paused);
      if (d.settings.music && Sound.on) Sound.music(d.phase === 'lobby' ? 'lobby' : d.phase === 'live' ? (d.mode === 'peak' ? 'peak' : 'game') : ''); else Sound.stop();
      drawSide();
      if (feedback) return;
      if (d.phase === 'lobby') return lobby();
      if (d.phase === 'ended') return final();
      if (d.brk) return breakRoom(d.brk);
      if (d.q) { const key = d.q.id + ':' + d.q.attempt + ':' + d.q.redemption + ':' + (d.q.n || 0); if (key !== shown) question(d.q, key); else if (d.q.remain != null) deadline = Date.now() + d.q.remain * 1000; return; }
      if (d.paced) return paced();
      if (d.done) return summary();
      once('wait', () => main.replaceChildren(h('div', 'bt2-wait', 'Ждём…')));
    }
    const once = (key, fn) => { if (view !== key) { view = key; shown = ''; fn(); } };

    function lobby() {
      once('lobby' + (d.names || []).join() + d.avatar, () => {
        const card = h('div', 'bt2-lobby'), cover = img(ART + 'mode_' + d.mode + '.webp', 'bt2-cover');
        const av = h('div', 'bt2-avs');
        for (let i = 0; i < 12; i++) { const need = Number((d.locked || {})[i] || 0), locked = d.summits < need, b = btn('', 'bt2-av' + (d.avatar === i ? ' on' : '') + (locked ? ' locked' : ''), async () => { if (locked) return toast(`Откроется после ${need} покорённых вершин`); try { await S('avatar', {avatar: i}); d.avatar = i; view = ''; lobby(); } catch (e) { toast(e.message); } });
          b.append(img(climber(i), '', 'альпинист')); if (locked) b.append(h('small', '', '🔒 ' + need)); b.dataset.avatar = i; av.append(b); }
        const names = h('div', 'bt2-names'); for (const n of d.names || []) names.append(h('span', '', n));
        card.append(cover, h('p', 'p-eyebrow', 'ЛОББИ · ' + MODES[d.mode][0].toUpperCase()), h('h1', '', d.title), h('p', 'bt2-lead', MODES[d.mode][1]), h('p', 'bt2-waiting', '⏳ Ждём, когда учитель начнёт игру'),
          h('h3', '', 'Выбери своего героя'), av, h('h3', '', `В лобби: ${(d.names || []).length}`), names);
        if (d.team) card.append(h('p', 'bt2-team', 'Твоя команда: ' + d.team));
        main.replaceChildren(card); });
    }

    function question(q, key) {
      view = 'q'; shown = key; curQ = q; const wrap = h('div', 'bt2-q'), head = h('div', 'bt2-qhead'), bar = h('div', 'bt2-timer'), fill = h('i'), qhost = h('div', 'bt2-qhost'), tools = h('div', 'bt2-tools');
      bar.append(fill);
      head.append(h('span', 'bt2-n', d.mode === 'peak' ? `Осталось освоить: ${d.peak.left}` : `Вопрос ${q.n} из ${q.total}`), h('span', 'bt2-type', B.TYPE_ICON[q.type] + ' ' + B.TYPES[q.type]));
      if (q.attempt > 1) head.append(h('span', 'bt2-again', `попытка ${q.attempt}`));
      const read = btn('🔊', 'bt2-icon', () => B.speak(B.speakText ? B.speakText(q) : q.text)); read.title = 'Прочитать вслух'; head.append(read);
      if (q.redemption) wrap.append(h('div', 'bt2-redeem', '🔁 Вопрос-реванш! Ответь верно на вопрос, где ошибся, — и верни очки.'));
      if (d.settings.powerups && d.inventory.length) for (const k of d.inventory) { const b = btn('', 'bt2-pw', () => usePower(k, b)); b.title = POWER[k][0] + ': ' + POWER[k][1]; b.dataset.power = k; b.append(img(ART + 'pw_' + k + '.webp', '', POWER[k][0]), h('small', '', POWER[k][0])); tools.append(b); }
      if (d.effects.length) tools.append(h('span', 'bt2-fx', 'Действует: ' + d.effects.map(k => POWER[k] ? POWER[k][0] : k).join(', ')));
      if (q.canPass) tools.append(btn('Пропустить вопрос', 'p-small', async () => { try { await S('skip', {q: q.id}); shown = ''; sync(); } catch (e) { toast(e.message); } }));
      wrap.append(head); if (q.limit) wrap.append(bar); wrap.append(tools, qhost); main.replaceChildren(wrap);
      try { box = B.renderQ(q, qhost, ans => answer(q, ans), {read: d.readAloud}); } catch (e) { console.error('battle: вопрос не показан', q.type, e && e.stack); qhost.append(h('p', 'bt2-wait', 'Не удалось показать вопрос — сообщи учителю.')); }
      deadline = q.remain != null ? Date.now() + q.remain * 1000 : 0; clearInterval(tick);
      if (q.limit) tick = setInterval(() => { if (d.paused) return; const left = Math.max(0, deadline - Date.now()); fill.style.width = (100 * left / (q.limit * 1000)) + '%'; fill.classList.toggle('low', left < 5000);
        if (left <= 0 && !feedback && shown === key) { clearInterval(tick); answer(q, null, true); } }, 150);
    }

    async function usePower(kind, b) {
      try { const r = await S('power', {kind}); Sound.sfx('power'); b.remove(); toast(`${POWER[kind][0]}: ${POWER[kind][1]}`, 'ev-power'); d.inventory = d.inventory.filter((x, i) => i !== d.inventory.indexOf(kind));
        if (r.removed && box) box.querySelectorAll('.bq-opt').forEach((o, i) => { if (r.removed.includes(i)) { o.disabled = true; o.classList.add('gone'); } }); } catch (e) { toast(e.message); }
    }

    async function answer(q, ans, timeout = false) {
      if (feedback) return; feedback = true; clearInterval(tick); main.querySelectorAll('button, input, textarea, select').forEach(x => { if (!x.closest('.bt2-tools')) x.disabled = true; });
      let r; try { r = await S('answer', {q: q.id, answer: ans}); } catch (e) { feedback = false; toast(e.message); shown = ''; return sync(); }
      if (r.retry) { feedback = false; toast('🛡 ' + r.msg, 'ev-power'); shown = ''; return sync(); }
      if (d.mode === 'paced') { main.replaceChildren(h('div', 'bt2-wait', '✔ Ответ принят! Ждём остальных…')); feedback = false; view = 'paced-wait'; shown = q.id + 'done'; return; }
      Sound.sfx(!r.graded ? 'power' : r.ok ? 'good' : 'bad');
      const fb = h('div', 'bt2-fb ' + (!r.graded ? 'neutral' : r.ok ? 'good' : 'bad'));
      if (d.settings.memes && r.graded) fb.append(img(ART + (r.ok ? 'good_' : 'bad_') + Math.floor(Math.random() * 8) + '.webp', 'bt2-meme', 'мем'));
      fb.append(h('h2', '', timeout ? '⏰ Время вышло' : !r.graded ? 'Ответ принят!' : r.ok ? pick(B.GOOD) : r.frac > 0 ? `Частично верно: ${Math.round(r.frac * 100)} %` : pick(B.BAD)));
      if (r.graded && d.mode !== 'test') fb.append(h('p', 'bt2-pts', (r.pts >= 0 ? '+' : '') + r.pts + ' очков' + (r.streak > 1 ? ` · серия ${r.streak} 🔥` : '')));
      if (d.mode === 'test' && r.graded) fb.append(h('p', 'bt2-pts', `Баллы: ${r.pts / 100}`));
      if (r.solution != null && !r.ok) { const s = B.solText(q, r.solution); if (s) fb.append(h('p', 'bt2-sol', 'Верно: ' + s)); }
      if (r.explain) fb.append(h('p', 'bt2-explain', r.explain));
      if (r.power) { fb.append(h('p', 'bt2-gotpw', `Серия! Усилитель: ${POWER[r.power][0]}`)); Sound.sfx('power'); }
      if (r.solution != null) B.markSolution(box, q, r.solution, ans);
      const next = btn('Дальше ▶', 'bt2-next', () => { clearTimeout(auto); done(); }); next.dataset.act = 'bt-next'; fb.append(next);
      main.querySelector('.bt2-q')?.append(fb);
      const done = () => { if (!feedback) return; feedback = false; shown = ''; sync(); };
      const auto = setTimeout(done, r.explain || (r.solution != null && !r.ok) ? 5000 : 2200);
    }

    function paced() {
      const p = d.paced;
      if (!p.reveal) { once('paced-wait' + p.n, () => main.replaceChildren(h('div', 'bt2-wait', p.answered ? '✔ Ответ принят! Ждём остальных…' : 'Смотри на экран учителя…'))); return; }
      once('paced-rev' + p.n, () => { const fb = h('div', 'bt2-fb big ' + (p.frac >= 1 ? 'good' : p.frac == null ? 'neutral' : 'bad'));
        if (d.settings.memes && p.frac != null) fb.append(img(ART + (p.frac >= 1 ? 'good_' : 'bad_') + Math.floor(Math.random() * 8) + '.webp', 'bt2-meme', 'мем'));
        fb.append(h('h2', '', p.frac == null ? 'Спасибо за ответ!' : p.frac >= 1 ? pick(B.GOOD) : p.answered === false ? 'Не успел ответить' : pick(B.BAD)));
        if (p.pts) fb.append(h('p', 'bt2-pts', `+${p.pts} очков`));
        if (p.view && p.solution != null && p.frac < 1) fb.append(h('p', 'bt2-sol', 'Верно: ' + B.solText(p.view, p.solution)));
        if (p.explain) fb.append(h('p', 'bt2-explain', p.explain));
        if (d.place) fb.append(h('p', 'bt2-place', `Твоё место: ${d.place}`)); Sound.sfx(p.frac >= 1 ? 'good' : 'bad'); main.replaceChildren(fb); });
    }

    function summary() {
      once('done' + d.score + (d.summary && d.summary.canRetry), () => { const s = d.summary || {}, card = h('div', 'bt2-summary');
        if (d.mode === 'peak' && d.peak.summit) card.append(img(ART + 'summit.webp', 'bt2-summit-img', 'вершина'));
        card.append(h('h1', '', d.mode === 'peak' ? (d.peak.summit ? '🏔 Вершина покорена!' : 'Восхождение окончено') : 'Готово!'));
        const ring = h('div', 'bt2-ring'); ring.style.setProperty('--p', s.acc || 0); ring.append(h('b', '', (s.acc || 0) + '%'), h('small', '', 'точность'));
        const stats = h('div', 'bt2-stats'); for (const [k, v] of [['Очки', s.score], ['Место', d.place || '—'], ['Лучшая серия', s.best_streak], ['Ответов', s.answered]]) { const c = h('div'); c.append(h('b', '', String(v ?? '—')), h('small', '', k)); stats.append(c); }
        card.append(ring, stats, h('p', 'bt2-waiting', 'Ждём, пока учитель завершит игру'));
        if (s.canRetry) { const r = btn(`Сыграть ещё раз (попытка ${d.attempt + 1} из ${d.attempts})`, 'p-primary', async () => { try { await S('retry'); view = ''; sync(); } catch (e) { toast(e.message); } }); r.dataset.act = 'bt-retry'; card.append(r); }
        Sound.sfx('win'); main.replaceChildren(card); });
    }

    function final() {
      once('final', () => { stop(); const card = h('div', 'bt2-final'), pod = h('div', 'bt2-podium');
        const top3 = (d.top || []).slice(0, 3); for (const [i, k] of [[1, 'silver'], [0, 'gold'], [2, 'bronze']]) { const t = top3[i]; if (!t) continue; const c = h('div', 'bt2-pod ' + k); c.append(img(climber(t.avatar), '', ''), h('b', '', t.name), h('span', '', String(t.score)), h('i', '', String(i + 1))); pod.append(c); }
        card.append(img(ART + 'summit.webp', 'bt2-final-bg', ''), h('h1', '', '🏆 Игра окончена!'), pod);
        if (d.place) card.append(h('p', 'bt2-place', `Твоё место: ${d.place} · очков ${d.score}`));
        if (d.teams) { const ol = h('ol', 'bt2-teams'); for (const t of d.teams) { const li = h('li'); li.style.borderColor = t.color; li.append(h('b', '', t.name), h('span', '', String(t.score))); ol.append(li); } card.append(h('h3', '', 'Команды'), ol); }
        if (d.titles && d.titles.length) { const tl = h('div', 'bt2-titles'); for (const t of d.titles) { const c = h('div'); c.append(h('b', '', t.title), h('span', '', t.name)); tl.append(c); } card.append(tl); }
        card.append(btn('← К играм', 'p-primary', () => ctx.leave())); main.replaceChildren(card); Sound.sfx('win'); });
    }

    function drawSide() {
      side.replaceChildren(); side.className = 'bt2-side';
      if (d.mode === 'peak' && d.peak) {
        const pk = d.peak, m = h('div', 'bt2-mountain'); m.append(img(ART + 'peak_' + d.settings.theme + '.webp', 'bt2-mt', 'гора'));
        const pos = v => ({bottom: 6 + 0.84 * v, left: 50 + 22 * Math.sin(v / 9)});
        const goal = h('div', 'bt2-goal', `цель ${d.settings.goal}%`); goal.style.bottom = pos(d.settings.goal).bottom + '%'; m.append(goal);
        for (const t of (d.top || []).filter(x => !x.me).slice(0, 8)) { const g = img(climber(t.avatar), 'bt2-ghost', t.name); const p = pos(t.mastery || 0); g.style.bottom = p.bottom + '%'; g.style.left = (p.left + 8) + '%'; g.title = t.name; m.append(g); }
        const mine = img(climber(d.avatar), 'bt2-me', 'ты'); const p = pos(pk.mastery); mine.style.bottom = p.bottom + '%'; mine.style.left = p.left + '%'; m.append(mine);
        const info = h('div', 'bt2-peakinfo'); info.append(img(ART + 'tier_' + pk.tier + '.webp', 'bt2-tier', TIERS[pk.tier]), h('b', '', TIERS[pk.tier]), h('span', '', d.tierPlace ? `${d.tierPlace} из ${d.tierSize} в лиге` : ''), h('strong', '', `Освоено ${pk.mastery}%`), h('small', '', `${pk.mastered} из ${pk.total} · пропущено ${pk.passed}`));
        if (pk.summit && !d.done) { const f = btn('Закончить восхождение', 'p-small', async () => { try { await S('finish'); sync(); } catch (e) { toast(e.message); } }); info.append(h('p', 'bt2-summit', '🏔 Вершина! Можно идти к 100 % или закончить.'), f); }
        side.append(m, info); return; }
      if (d.teams) { const ol = h('ol', 'bt2-teams'); const mx = Math.max(1, ...d.teams.map(t => t.score)); for (const t of d.teams) { const li = h('li'); li.style.setProperty('--w', (100 * t.score / mx) + '%'); li.style.setProperty('--c', t.color); li.append(h('b', '', t.name), h('span', '', String(t.score))); ol.append(li); } side.append(h('h3', '', 'Команды'), ol); }
      if (d.settings.leaderboard && d.top) { const ol = h('ol', 'bt2-lead'); for (const t of d.top) { const li = h('li', t.me ? 'me' : ''); li.append(img(climber(t.avatar), '', ''), h('span', '', t.name), h('b', '', String(t.score))); ol.append(li); } side.append(h('h3', '', 'Таблица лидеров'), ol); }
      if (!side.childNodes.length) side.className = 'bt2-side empty';
    }

    /* ---------- привал «Восхождения»: усилитель на выбор и мини-игра ---------- */
    async function breakRoom(brk) {
      if (view === 'break') return; view = 'break'; shown = ''; feedback = true;
      const card = h('div', 'bt2-break'), cards = h('div', 'bt2-offers'); let choice = null;
      card.append(h('h1', '', '⛺ Привал!'), h('p', 'bt2-lead', d.inventory.length >= 3 ? 'Рюкзак полон — сразу к испытанию.' : 'Выбери усилитель в рюкзак:'), cards);
      main.replaceChildren(card);
      if (d.inventory.length < 3) choice = await new Promise(res => { for (const k of brk.offers) { const b = btn('', 'bt2-offer', () => res(k)); b.dataset.offer = k; b.append(img(ART + 'pw_' + k + '.webp', '', ''), h('b', '', POWER[k][0]), h('small', '', POWER[k][1])); cards.append(b); } });
      if (run !== alive) return;
      const score = await miniGame(brk.game, card);
      try { const r = await S('break', {pick: choice, mini: score}); toast(`Привал окончен: +${r.bonus} очков`, 'ev-power'); } catch (e) { toast(e.message); }
      feedback = false; view = ''; sync();
    }

    function miniGame(kind, card) {
      const NAMES = {bats: ['🦇 Пещера летучих мышей', 'Щёлкай по летучим мышам, пока они не долетели до альпиниста!'], circles: ['⭕ Круговые войны', 'Обводи кристаллы мышью — замкни круг вокруг нескольких сразу!'],
        gear: ['🎒 Найди снаряжение', 'Открывай карточки и находи пары снаряжения.'], landslide: ['🪨 Оползень', 'Уворачивайся от камней: двигай мышью или стрелками.']};
      return new Promise(resolve => {
        card.replaceChildren(h('h1', '', NAMES[kind][0]), h('p', 'bt2-lead', NAMES[kind][1]));
        const info = h('div', 'bt2-mginfo'), area = h('div', 'bt2-mg'); card.append(info, area); let score = 0, end = Date.now() + (kind === 'gear' ? 30000 : 15000), over = false;
        const finish = () => { if (over) return; over = true; clearInterval(loop); cancelAnimationFrame(raf); info.textContent = `Итог: ${Math.min(300, score)} очков`; Sound.sfx('win'); setTimeout(() => resolve(Math.min(300, score)), 1200); };
        const hud = () => { info.textContent = `Очки: ${Math.min(300, score)} · осталось ${Math.max(0, Math.ceil((end - Date.now()) / 1000))} с`; };
        let raf = 0, loop = setInterval(() => { hud(); if (Date.now() >= end) finish(); }, 200);
        const sprite = n => { const i = new Image(); i.src = ART + n + '.webp'; return i; };
        if (kind === 'gear') {
          const kinds = ['mg_helmet', 'mg_rope', 'mg_axe', 'mg_flashlight', 'mg_tent', 'mg_boulder'], deck = [...kinds, ...kinds].sort(() => Math.random() - 0.5), grid = h('div', 'bt2-memory'); let open = [], found = 0;
          deck.forEach((k, i) => { const c = btn('', 'bt2-card', () => { if (over || c.classList.contains('up') || open.length === 2) return; c.classList.add('up'); open.push([c, k]);
              if (open.length === 2) { const [[a, ka], [b2, kb]] = open; if (ka === kb) { score += 50; found++; Sound.sfx('good'); open = []; a.classList.add('done'); b2.classList.add('done'); if (found === 6) finish(); } else setTimeout(() => { a.classList.remove('up'); b2.classList.remove('up'); open = []; }, 650); } });
            c.dataset.card = k; c.append(img(ART + k + '.webp', '', '')); grid.append(c); });
          area.append(grid); hud(); return; }
        const cv = h('canvas', 'bt2-mgcv'); cv.width = 720; cv.height = 405; area.append(cv); const g = cv.getContext('2d'), av = sprite('climber_' + (d.avatar % 12)), things = [];
        const S2 = {bat: sprite('mg_bat'), boulder: sprite('mg_boulder'), shard: sprite('mg_shard')};
        const xy = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 720 / r.width, (e.clientY - r.top) * 405 / r.height]; };
        let px = 360, path = [], lives = 3, spawn = 0, last = performance.now();
        if (kind === 'circles') for (let i = 0; i < 9; i++) things.push({x: 60 + Math.random() * 600, y: 50 + Math.random() * 300, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40});
        cv.addEventListener('pointerdown', e => { const [x, y] = xy(e);
          if (kind === 'bats') { const i = things.findIndex(t => Math.hypot(t.x - x, t.y - y) < 42); if (i >= 0) { things.splice(i, 1); score += 15; Sound.sfx('tick'); } }
          if (kind === 'circles') { path = [[x, y]]; cv.setPointerCapture(e.pointerId); } });
        cv.addEventListener('pointermove', e => { const [x, y] = xy(e); if (kind === 'landslide') px = x; if (kind === 'circles' && path.length) path.push([x, y]); });
        cv.addEventListener('pointerup', () => { if (kind !== 'circles' || path.length < 8) { path = []; return; } const [sx, sy] = path[0], [ex, ey] = path[path.length - 1];
          if (Math.hypot(sx - ex, sy - ey) < 80) { const inside = t => { let c = false; for (let i = 0, j = path.length - 1; i < path.length; j = i++) { const [xi, yi] = path[i], [xj, yj] = path[j]; if ((yi > t.y) !== (yj > t.y) && t.x < (xj - xi) * (t.y - yi) / (yj - yi) + xi) c = !c; } return c; };
            const got = things.filter(inside); if (got.length) { score += 25 * got.length * (got.length > 1 ? 1.5 : 1); Sound.sfx('good'); for (const t of got) { t.x = 60 + Math.random() * 600; t.y = 50 + Math.random() * 300; } } }
          path = []; });
        const keys = e => { if (kind === 'landslide' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { px += e.key === 'ArrowLeft' ? -40 : 40; e.preventDefault(); } }; document.addEventListener('keydown', keys);
        const frame = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (over) { document.removeEventListener('keydown', keys); return; }
          const sky = g.createLinearGradient(0, 0, 0, 405); sky.addColorStop(0, kind === 'bats' ? '#120c22' : '#24345e'); sky.addColorStop(1, kind === 'bats' ? '#2b1d3d' : '#6b7fa8'); g.fillStyle = sky; g.fillRect(0, 0, 720, 405);
          if (kind === 'bats') { spawn -= dt; if (spawn <= 0) { spawn = 0.55; const a = Math.random() * Math.PI * 2; things.push({x: 360 + Math.cos(a) * 420, y: 220 + Math.sin(a) * 300}); }
            g.drawImage(av, 320, 180, 80, 80);
            for (let i = things.length - 1; i >= 0; i--) { const t = things[i], dx = 360 - t.x, dy = 220 - t.y, L = Math.hypot(dx, dy); if (L < 30) { things.splice(i, 1); score = Math.max(0, score - 10); continue; } t.x += dx / L * 110 * dt; t.y += dy / L * 110 * dt; g.drawImage(S2.bat, t.x - 36, t.y - 24, 72, 48); } }
          if (kind === 'circles') { for (const t of things) { t.x += t.vx * dt; t.y += t.vy * dt; if (t.x < 30 || t.x > 690) t.vx *= -1; if (t.y < 30 || t.y > 375) t.vy *= -1; g.drawImage(S2.shard, t.x - 22, t.y - 22, 44, 44); }
            if (path.length > 1) { g.strokeStyle = '#7df9ff'; g.lineWidth = 4; g.beginPath(); g.moveTo(...path[0]); for (const p of path) g.lineTo(...p); g.stroke(); } }
          if (kind === 'landslide') { spawn -= dt; const k = 1 + (15000 - (end - Date.now())) / 9000; if (spawn <= 0) { spawn = 0.45 / k; things.push({x: 30 + Math.random() * 660, y: -40, v: 160 * k + Math.random() * 80}); }
            px = Math.max(30, Math.min(690, px)); g.drawImage(av, px - 32, 330, 64, 64);
            for (let i = things.length - 1; i >= 0; i--) { const t = things[i]; t.y += t.v * dt; g.drawImage(S2.boulder, t.x - 26, t.y - 26, 52, 52);
              if (t.y > 330 && t.y < 390 && Math.abs(t.x - px) < 40) { things.splice(i, 1); lives--; Sound.sfx('bad'); if (lives <= 0) return finish(); } else if (t.y > 420) { things.splice(i, 1); score += 12; } }
            g.fillStyle = '#fff'; g.font = 'bold 20px system-ui'; g.fillText('❤'.repeat(lives), 16, 30); }
          raf = requestAnimationFrame(frame); };
        raf = requestAnimationFrame(frame); hud();
      });
    }

    timer = setInterval(sync, 900); sync();
  }
  window.BattlePlay = {student, stop};
})();
