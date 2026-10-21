// «Код-раннер»: бег по трём дорожкам в духе Subway Surfers. Прыжок — через низкий барьер, подкат — под высокий,
// смена дорожки — от поезда. Каждые несколько секунд над дорожками ворота с тремя ответами на вопрос по информатике:
// беги в верные. Логика вопросов и итог забега (check/solve) проверяются в node: tools/lab/tests/runner.test.js.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const near = (r, v, lo = 0) => { const out = new Set(); for (let k = 0; out.size < 2 && k < 60; k++) { const w = v + pick(r, [-3, -2, -1, 1, 2, 3, 4, 8, -8]); if (w >= lo && w !== v) out.add(w); } return [...out]; };
  const bin = v => v.toString(2);
  // Вопросы: короткие, чтобы прочитать на бегу; три варианта, верный ровно один.
  const KINDS = {
    bin2dec: (r, g) => { const v = 2 + Math.floor(r() * (g <= 7 ? 30 : 120)); return {q: `${bin(v)}₂ = ?`, a: String(v), w: near(r, v).map(String)}; },
    dec2bin: (r, g) => { const v = 2 + Math.floor(r() * (g <= 7 ? 30 : 60)); return {q: `${v} = ?₂`, a: bin(v), w: near(r, v, 1).map(bin)}; },
    units: r => { const c = pick(r, [['1 байт', '8 бит', ['4 бит', '10 бит']], ['1 Кбайт', '1024 байт', ['1000 байт', '100 байт']], ['2 байта', '16 бит', ['8 бит', '20 бит']], ['1 Мбайт', '1024 Кбайт', ['1000 Кбайт', '1024 байт']], ['16 бит', '2 байта', ['16 байт', '4 байта']], ['4 Кбайт', '4096 байт', ['4000 байт', '512 байт']]]); return {q: `${c[0]} = ?`, a: c[1], w: c[2]}; },
    pow2: r => { const k = 3 + Math.floor(r() * 8); return {q: `2^${k} = ?`, a: String(2 ** k), w: [String(2 ** (k - 1)), String(2 ** k + 2 ** (k - 2))]}; },
    logic: r => { const A = r() < 0.5, B = r() < 0.5, n = (A && B) + (A || B) + !A, w = [0, 1, 2, 3].filter(x => x !== n).sort(() => r() - 0.5); return {q: `A=${+A}, B=${+B}. Истинных: «A и B», «A или B», «не A»?`, a: String(n), w: w.slice(0, 2).map(String)}; },
    hex: r => { const v = 10 + Math.floor(r() * 240); return {q: `${v.toString(16).toUpperCase()}₁₆ = ?`, a: String(v), w: near(r, v).map(String)}; },
    py: r => { const a = 2 + Math.floor(r() * 6), b = 2 + Math.floor(r() * 5), c = 1 + Math.floor(r() * 4), f = pick(r, [[`print(${a}+${b}*${c})`, a + b * c, (a + b) * c], [`print(${a * b}//${b})`, a, a * b / b + 1], [`print(${a + b * 3}%${b})`, (a + b * 3) % b, a + 1], [`print(len('${'ab'.repeat(c)}'))`, 2 * c, c]]); const w = [f[2], f[1] + 1].filter(x => x !== f[1]); return {q: f[0], a: String(f[1]), w: [String(w[0]), String(w[1] !== undefined ? w[1] : f[1] + 2)]}; },
    loop: r => { const n = 3 + Math.floor(r() * 5), st = 1 + Math.floor(r() * 3), q = st === 1 ? `range(${n})` : `range(0, ${n * st}, ${st})`; return {q: `for i in ${q}: k += 1 → k = ?`, a: String(n), w: [String(n + 1), String(n * st + (st === 1 ? 2 : 0))]}; },
  };
  function question(kind, r, grade) {
    for (let t = 0; t < 20; t++) { const q = KINDS[kind](r, grade); const opts = [q.a, ...q.w]; if (new Set(opts).size === 3) { const order = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } return {q: q.q, opts: order.map(i => opts[i]), right: order.indexOf(0)}; } }
    return {q: '1 байт = ? бит', opts: ['8', '4', '16'], right: 0};
  }
  const PLAN = [['Разминка', ['bin2dec', 'units'], 300, 3], ['Двоичная трасса', ['bin2dec', 'dec2bin'], 400, 4], ['Байты и биты', ['units', 'pow2'], 450, 5],
    ['Логика на бегу', ['logic', 'bin2dec'], 500, 5], ['Степени двойки', ['pow2', 'dec2bin'], 550, 6], ['Шестнадцать', ['hex', 'bin2dec'], 600, 6],
    ['Python-экспресс', ['py', 'logic'], 650, 7], ['Финальный забег', ['py', 'hex', 'loop', 'units'], 800, 8]];
  function levels(grade) {
    return PLAN.map(([title, kinds, dist, need], i) => ({title, kinds: kinds.map(k => (k === 'hex' && grade < 8) ? 'pow2' : (k === 'py' && grade < 8) ? 'logic' : k), dist, need, speed: 1 + i * 0.12, seed: 100 * grade + i,
      brief: `Пробеги ${dist} м и ответь верно на ${need} вопросов: забегай в ворота с правильным ответом. ← → — дорожка, ↑ — прыжок, ↓ — подкат.`}));
  }
  function check(lv, log) {
    if (!log || typeof log !== 'object') return {ok: false, msg: 'Забег не состоялся.'};
    const {dist = 0, correct = 0, wrong = 0, hits = 0} = log;
    if (![dist, correct, wrong, hits].every(Number.isFinite)) return {ok: false, msg: 'Неверные данные забега.'};
    if (wrong + hits >= 3) return {ok: false, msg: 'Закончились жизни.'};
    if (dist < lv.dist || correct < lv.need) return {ok: false, msg: `Пробежал ${Math.floor(dist)} из ${lv.dist} м, верных ответов ${correct} из ${lv.need}.`};
    const mist = wrong + hits;
    return {ok: true, stars: mist === 0 ? 3 : mist === 1 ? 2 : 1, msg: `Финиш! Верных ответов: ${correct}, ошибок: ${wrong}, столкновений: ${hits}.`};
  }
  const solve = lv => ({dist: lv.dist, correct: lv.need, wrong: 0, hits: 0});
  // ---------- страница: псевдо-3D трасса на холсте ----------
  function style() {
    if (typeof document === 'undefined' || document.getElementById('rn-style')) return;
    const s = document.createElement('style'); s.id = 'rn-style';
    s.textContent = `.rn-wrap{position:relative;max-width:960px;margin:0 auto}.rn-cv{display:block;width:100%;border-radius:18px;box-shadow:0 0 0 2px #3b4d78,0 18px 40px rgba(0,0,0,.45);touch-action:none;background:#0b1024}
.rn-pad{display:none;gap:8px;justify-content:center;margin-top:10px}.rn-pad button{width:64px;height:54px;border-radius:14px;border:2px solid #3b4d78;background:#141e38;color:#fff;font-size:24px}@media(pointer:coarse){.rn-pad{display:flex}}`;
    document.head.append(s);
  }
  function mount(host, lv, api) {
    style(); const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'), wrap = el('div', 'rn-wrap'), cv = el('canvas', 'rn-cv'), g = cv.getContext('2d');
    cv.width = 960; cv.height = 560; cv.tabIndex = 0;
    const W = 960, H = 560, HOR = 170, art = n => { const i = new Image(); i.src = `art/${n}.webp?v=1`; return i; };
    const I = {bg: art('bg_runner'), run: [art('runner_hero_0'), art('runner_hero_1')], jump: art('runner_hero_2'), slide: art('runner_hero_3'),
      low: art('runner_prop_0'), high: art('runner_prop_1'), train: art('runner_prop_2'), coin: art('runner_prop_3'), magnet: art('runner_prop_4'), gate: art('runner_prop_6'), shield: art('runner_prop_7')};
    task.append(el('h2', '', lv.title), el('p', '', lv.brief));
    let raf = 0, last = 0, s = null, done = false;
    const reset = () => { s = {r: rng(lv.seed + Math.floor(Math.random() * 1e6)), lane: 0, lx: 0, jump: 0, slide: 0, dist: 0, coins: 0, lives: 3, inv: 0, magnet: 0, shield: false, correct: 0, wrong: 0, hits: 0,
      objs: [], next: 0.8, nextQ: 3.0, q: null, flash: '', flashT: 0, speed: 0.45 * lv.speed, run: false, t: 0, combo: 0}; };
    reset();
    const proj = (lane, z) => { const p = Math.max(0, 1 - z), k = p * p, y = HOR + (H - 40 - HOR) * k, sc = 0.12 + 0.88 * k; return {x: W / 2 + lane * 230 * sc, y, sc}; };
    const spawn = () => {
      const r = s.r, lane = Math.floor(r() * 3) - 1, roll = r();
      if (roll < 0.25) s.objs.push({t: 'low', lane, z: 1}); else if (roll < 0.45) s.objs.push({t: 'high', lane, z: 1}); else if (roll < 0.62) s.objs.push({t: 'train', lane, z: 1, len: 0.25});
      else if (roll < 0.94) for (let k = 0; k < 5; k++) s.objs.push({t: 'coin', lane, z: 1 + k * 0.05}); else s.objs.push({t: r() < 0.5 ? 'magnet' : 'shield', lane, z: 1});
    };
    const ask = () => { s.q = question(pick(s.r, lv.kinds), s.r, api.grade); for (let l = -1; l <= 1; l++) s.objs.push({t: 'gate', lane: l, z: 1, opt: l + 1}); s.objs = s.objs.filter(o => o.t === 'gate' || o.z < 0.7); };
    const hit = why => { if (s.inv > 0) return; if (s.shield) { s.shield = false; s.inv = 1; s.flash = 'Щит спас!'; s.flashT = 1; return; } s.hits++; s.lives--; s.inv = 1.4; s.combo = 0; s.flash = why; s.flashT = 1.2; if (s.lives <= 0) end(false); };
    function end(win) {
      done = true; s.run = false; cancelAnimationFrame(raf);
      const r = check(lv, {dist: s.dist, correct: s.correct, wrong: s.wrong, hits: s.hits});
      if (win && r.ok) api.finish(r.stars, r.msg);
      else { msg.textContent = r.msg + ' Нажми «Ещё раз».'; msg.className = 'lab-msg bad'; again.hidden = false; }
    }
    function step(dt) {
      s.t += dt; const sp = s.speed * (1 + Math.min(0.6, s.dist / 2500));
      s.dist += sp * dt * 60; s.lx += (s.lane - s.lx) * Math.min(1, dt * 14); s.inv = Math.max(0, s.inv - dt); s.magnet = Math.max(0, s.magnet - dt); s.flashT = Math.max(0, s.flashT - dt);
      if (s.jump > 0) s.jump = Math.max(0, s.jump - dt); if (s.slide > 0) s.slide = Math.max(0, s.slide - dt);
      s.next -= dt; s.nextQ -= dt;
      if (s.nextQ <= 0 && !s.objs.some(o => o.t === 'gate')) { ask(); s.nextQ = 7.5; s.next = 2.2; }
      if (s.next <= 0) { if (!s.objs.some(o => o.t === 'gate' && o.z > 0.55)) spawn(); s.next = 0.7 + s.r() * 0.6; }
      for (const o of s.objs) o.z -= sp * dt;
      const air = s.jump > 0.12, low = s.slide > 0;
      for (const o of s.objs) {
        if (o.done) continue; const same = Math.abs(o.lane - s.lx) < 0.45;
        if (o.t === 'coin' && (same || s.magnet > 0) && o.z < 0.06 && o.z > -0.04) { o.done = true; s.coins++; }
        else if ((o.t === 'magnet' || o.t === 'shield') && same && o.z < 0.06 && o.z > -0.04) { o.done = true; if (o.t === 'magnet') s.magnet = 8; else s.shield = true; s.flash = o.t === 'magnet' ? 'Магнит!' : 'Щит!'; s.flashT = 1; }
        else if (o.t === 'low' && same && o.z < 0.04 && o.z > -0.03) { o.done = true; if (!air) hit('Перепрыгивай низкий барьер (↑)'); }
        else if (o.t === 'high' && same && o.z < 0.04 && o.z > -0.03) { o.done = true; if (!low) hit('Под высокий барьер — подкат (↓)'); }
        else if (o.t === 'train' && same && o.z < 0.04 && o.z > -o.len) { o.done = true; hit('Поезд! Уходи на другую дорожку'); }
        else if (o.t === 'gate' && o.z < 0.03 && !o.done) {
          for (const gq of s.objs) if (gq.t === 'gate') gq.done = true;
          const mine = Math.round(s.lx) + 1;
          if (mine === s.q.right) { s.correct++; s.combo++; s.coins += 5 * s.combo; s.flash = s.combo > 1 ? `Верно! Серия ×${s.combo}` : 'Верно!'; s.flashT = 1.2; }
          else { s.wrong++; s.lives--; s.combo = 0; s.flash = `Неверно: ${s.q.opts[s.q.right]}`; s.flashT = 1.8; if (s.lives <= 0) end(false); }
          s.q = null;
        }
      }
      s.objs = s.objs.filter(o => o.z > -0.4);
      if (s.dist >= lv.dist && s.correct >= lv.need) end(true);
    }
    function sprite(img, x, yBottom, h) { if (!img.complete || !img.naturalWidth) return; const w = h * img.naturalWidth / img.naturalHeight; g.drawImage(img, x - w / 2, yBottom - h, w, h); }
    function draw() {
      if (I.bg.complete && I.bg.naturalWidth) g.drawImage(I.bg, 0, 0, W, H); else { g.fillStyle = '#1a2348'; g.fillRect(0, 0, W, H); }
      g.fillStyle = 'rgba(10,14,34,.25)'; g.fillRect(0, 0, W, H);
      // дорожки
      for (let l = -1.5; l <= 1.5; l += 1) { const a = proj(l, 1), b = proj(l, -0.05); g.strokeStyle = 'rgba(125,249,255,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
      const objs = s.objs.filter(o => !o.done || o.t === 'train').sort((a, b) => b.z - a.z);
      for (const o of objs) {
        if (o.z > 1.05) continue; const p = proj(o.lane, Math.max(o.z, -0.05));
        if (o.t === 'gate') { sprite(I.gate, p.x, p.y, 260 * p.sc); g.fillStyle = 'rgba(10,14,34,.85)'; const tw = 170 * p.sc, th = 52 * p.sc; g.fillRect(p.x - tw / 2, p.y - 200 * p.sc, tw, th);
          g.fillStyle = '#ffd34d'; g.font = `800 ${Math.max(10, 30 * p.sc)}px system-ui`; g.textAlign = 'center'; g.fillText(s.q ? s.q.opts[o.opt] : '', p.x, p.y - 200 * p.sc + th * 0.72); continue; }
        const h = {low: 70, high: 150, train: 230, coin: 40, magnet: 50, shield: 50}[o.t] * p.sc * 1.6;
        sprite(I[o.t], p.x, p.y + (o.t === 'coin' ? -30 * p.sc : 0), h);
      }
      // герой
      const hp = proj(s.lx, 0), up = s.jump > 0 ? Math.sin((1 - s.jump / 0.62) * Math.PI) * 120 : 0, img = s.slide > 0 ? I.slide : s.jump > 0 ? I.jump : I.run[Math.floor(s.t * 8) % 2];
      if (!(s.inv > 0 && Math.floor(s.t * 14) % 2)) sprite(img, hp.x, hp.y - up, s.slide > 0 ? 120 : 190);
      if (s.shield) { g.strokeStyle = 'rgba(125,249,255,.8)'; g.lineWidth = 4; g.beginPath(); g.arc(hp.x, hp.y - up - 90, 80, 0, 7); g.stroke(); }
      // вопрос и счёт
      g.textAlign = 'center';
      if (s.q) { g.fillStyle = 'rgba(10,14,34,.88)'; g.fillRect(W / 2 - 300, 14, 600, 56); g.fillStyle = '#fff'; g.font = '800 28px system-ui'; g.fillText(s.q.q, W / 2, 52); }
      g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '800 20px system-ui';
      g.fillText(`${Math.floor(s.dist)} / ${lv.dist} м`, 18, H - 20); g.fillText(`✔ ${s.correct}/${lv.need}`, 200, H - 20); g.fillText(`● ${s.coins}`, 330, H - 20);
      g.textAlign = 'right'; g.fillText('♥'.repeat(Math.max(0, s.lives)) + '♡'.repeat(Math.max(0, 3 - s.lives)), W - 18, H - 20);
      if (s.flashT > 0) { g.textAlign = 'center'; g.font = '900 34px system-ui'; g.fillStyle = /Неверно|Поезд|барьер/.test(s.flash) ? '#ff7a7a' : '#5fe0b5'; g.fillText(s.flash, W / 2, 120); }
      if (!s.run && !done) { g.fillStyle = 'rgba(10,14,34,.7)'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '900 40px system-ui'; g.fillText('Пробел — старт', W / 2, H / 2); g.font = '600 20px system-ui'; g.fillText('← → дорожка · ↑ прыжок · ↓ подкат · ворота — ответ на вопрос', W / 2, H / 2 + 40); }
    }
    function loop(ts) { const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; if (s.run && !done) step(dt); draw(); if (!done) raf = requestAnimationFrame(loop); }
    const act = k => { if (done) return; if (!s.run) { if (k === 'start' || k === 'up') { s.run = true; last = 0; } return; }
      if (k === 'left') s.lane = Math.max(-1, s.lane - 1); if (k === 'right') s.lane = Math.min(1, s.lane + 1); if (k === 'up' && s.jump <= 0) { s.jump = 0.62; s.slide = 0; } if (k === 'down') { s.slide = 0.6; s.jump = 0; } };
    const keys = e => { const m = {ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down'}[e.code]; if (m) { e.preventDefault(); act(e.code === 'Space' && !s.run ? 'start' : m); } };
    document.addEventListener('keydown', keys);
    let sx = 0, sy = 0; cv.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; if (!s.run) act('start'); });
    cv.addEventListener('pointerup', e => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; act(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')); });
    const pad = el('div', 'rn-pad'); for (const [t, k] of [['←', 'left'], ['↑', 'up'], ['↓', 'down'], ['→', 'right']]) pad.append(button(t, '', () => act(s.run ? k : 'start')));
    const again = button('Ещё раз', 'lab-main', () => { reset(); done = false; again.hidden = true; msg.textContent = ''; raf = requestAnimationFrame(loop); }); again.hidden = true; again.dataset.act = 'retry';
    wrap.append(cv, pad); host.append(task, wrap, msg, again); raf = requestAnimationFrame(loop); cv.focus();
    if (api.debugHost) window.labSet = log => { s.dist = log.dist; s.correct = log.correct; s.wrong = log.wrong; s.hits = log.hits; s.lives = 3 - log.wrong - log.hits; end(true); };
    return () => { done = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', keys); if (api.debugHost) delete window.labSet; };
  }
  LAB.register({id: 'runner', bg: 'bg_race', title: 'Код-раннер', genre: 'раннер · быстрый счёт', art: '🏃', color: '#ffb84d', unit: 'Забег', minutes: 30,
    about: 'Как Subway Surfers: беги по трём дорожкам, прыгай, ныряй под барьеры и уходи от поездов. Над дорожками ворота с ответами — забегай в верные: двоичная система, байты, логика, Python.',
    levels, mount, check, solve, lib: {question, KINDS, levels}});
})();
