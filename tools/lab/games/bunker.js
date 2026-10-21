// «Бункер»: по мотивам настольной игры. Глюк отключил интернет, в серверный бункер помещаются не все.
// По раундам открываются карты кандидатов (профессия, навык, багаж, здоровье); каждый раунд игрок исключает одного.
// В финале бункер проходит испытания по информатике; если в команде есть нужный специалист или вещь — он подсказывает.
// Логика проверяется в node: tools/lab/tests/bunker.test.js.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Двенадцать персонажей (портреты bunker_p0…p11): имя и профессия.
  const PEOPLE = [['Лёша', 'программист'], ['Марина', 'сисадмин'], ['Ирина', 'врач'], ['Пётр', 'инженер'], ['Ольга', 'учитель'], ['Даша', 'дизайнер'],
    ['Виктор', 'повар'], ['Анна', 'учёный'], ['Тимур', 'геймер'], ['Нина Ивановна', 'бабушка-изобретатель'], ['Робот Бит', 'робот-помощник'], ['Глеб', 'журналист']];
  const SKILLS = {net: 'сети и IP-адреса', zip: 'архивация и коды', sec: 'защита информации', py: 'алгоритмы и Python', db: 'базы данных и таблицы', hw: 'устройство компьютера'};
  const HEALTH = ['здоров', 'здоров', 'простуда', 'аллергия на пыль', 'отличная форма', 'плохо видит'];
  const TRAIT = ['спокойный', 'лидер', 'паникёр', 'трудолюбивый', 'весельчак', 'ворчун', 'изобретательный', 'засоня'];
  // Нужды бункера: какой навык или вещь закрывает нужду и какое испытание ждёт в конце.
  const NEEDS = {
    net: {title: 'Поднять сеть бункера', skill: 'net', item: 'роутер'},
    zip: {title: 'Распаковать архив с картами', skill: 'zip', item: null},
    store: {title: 'Сохранить архив данных', skill: null, item: 'флешка'},
    sec: {title: 'Защитить сервер паролем', skill: 'sec', item: null},
    py: {title: 'Починить программу фильтра воздуха', skill: 'py', item: 'ноутбук'},
    db: {title: 'Учесть запасы в таблице', skill: 'db', item: null},
    hw: {title: 'Собрать запасной компьютер', skill: 'hw', item: 'ящик деталей'},
  };
  const SCEN = [
    ['Тихий отбой', 'Глюк отключил интернет в городе.', 6, 4, ['net', 'store', 'py']],
    ['Потерянные карты', 'Карты подземных ходов остались только в архиве.', 6, 3, ['zip', 'store', 'net']],
    ['Взлом', 'Вирус Глюка ищет слабые пароли.', 7, 4, ['sec', 'net', 'db']],
    ['Учёт запасов', 'Еды и воды мало — всё нужно сосчитать.', 7, 4, ['db', 'py', 'store']],
    ['Сгоревший сервер', 'Сервер бункера сгорел от скачка напряжения.', 7, 3, ['hw', 'py', 'sec']],
    ['Большой архив', 'Нужно спасти научный архив.', 8, 4, ['store', 'zip', 'hw', 'db']],
    ['Сигнал наверх', 'Надо отправить сигнал спасателям.', 8, 4, ['net', 'sec', 'py', 'zip']],
    ['Последний бункер', 'Это последний работающий бункер Кодограда.', 8, 5, ['net', 'store', 'sec', 'py', 'db']]];
  // ---------- испытания (вопросы по информатике) ----------
  function trial(need, r, grade, size) {
    const four = (a, w) => {
      // Неверные варианты — разные и не совпадают с верным; если не хватило, добавляем соседние числа.
      w = [...new Set(w.filter(x => x !== a))]; for (let k = 1; w.length < 3; k++) { const c = /^\d+$/.test(a) ? String(+a + k * 2) : `${a} (${k})`; if (!w.includes(c)) w.push(c); }
      const opts = shuffle(r, [a, ...w.slice(0, 3)]); return {opts, right: opts.indexOf(a)}; };
    if (need === 'store') { const gb = size; return {q: `Архив весит ${gb} Гбайт. Сколько это Мбайт?`, ...four(String(gb * 1024), [String(gb * 1000), String(gb * 1024 * 1024), String(gb * 8)])}; }
    if (need === 'net') { const a = 10 + Math.floor(r() * 180), b = Math.floor(r() * 250), c = 1 + Math.floor(r() * 250), ok = `${a}.${b}.${c}.1`;
      return {q: 'Какой из адресов — правильный IP-адрес?', ...four(ok, [`${a}.${b}.${c + 256}.1`, `${a}.${b}.${c}`, `${a}.${b}.${c}.1.5`])}; }
    if (need === 'zip') { const s = pick(r, ['AAAABBBCC', 'WWWWWBBW', 'XXXYYYYYZ', 'KKKKKKMMM']), rle = s.replace(/(.)\1*/g, m => m.length + m[0]);
      return {q: `Сожми строку ${s} кодом RLE (число + буква):`, ...four(rle, [s.replace(/(.)\1*/g, m => m[0] + m.length), rle.replace(/\d/, d => String(+d + 1)), s.replace(/(.)\1*/g, m => m[0])])}; }
    if (need === 'sec') { const L = grade >= 9 ? pick(r, [26, 10, 36]) : 10, n = grade >= 9 ? 3 + Math.floor(r() * 2) : 4, a = L ** n;
      return {q: `Пароль из ${n} символов, каждый — один из ${L} вариантов. Сколько всего паролей?`, ...four(String(a), [String(L * n), String(n ** L > 1e9 ? a + L : n ** L), String(a / L)])}; }
    if (need === 'py') { const x = 2 + Math.floor(r() * 5), k = 2 + Math.floor(r() * 4), res = x * 2 ** k;
      return {q: `s = ${x}\nfor i in range(${k}):\n    s = s * 2\nprint(s)`, ...four(String(res), [String(x * 2 * k), String(x + 2 * k), String(res * 2)])}; }
    if (need === 'db') { const v = [3 + Math.floor(r() * 7), 2 + Math.floor(r() * 9), 5 + Math.floor(r() * 6)], sum = v[0] + v[1] + v[2];
      const w = [...new Set([v[0] + v[2], sum + v[1], Math.max(...v), sum + 1, sum - 1, sum + 10].filter(x => x !== sum))].slice(0, 3).map(String);
      return {q: `В таблице: A1=${v[0]}, A2=${v[1]}, A3=${v[2]}. Чему равно =СУММ(A1:A3)?`, ...four(String(sum), w)}; }
    const n = pick(r, [['процессор', 'обрабатывает данные', ['хранит файлы всегда', 'выводит изображение', 'вводит текст']], ['оперативная память', 'хранит данные во время работы', ['хранит данные после выключения', 'печатает документы', 'соединяет с сетью']], ['жёсткий диск', 'долговременно хранит файлы', ['считает быстрее процессора', 'выводит звук', 'вводит изображение']]]);
    return {q: `Что делает ${n[0]}?`, ...four(n[1], n[2])};
  }
  // ---------- сценарий: кандидаты и нужды ----------
  function setup(lv, grade) {
    const r = rng(lv.seed), people = shuffle(r, PEOPLE.map((p, i) => i)).slice(0, lv.n), needs = lv.needs, items = ['гитара', 'консервы', 'аптечка', 'фонарик', 'книга рецептов'];
    const size = 8 * (2 + Math.floor(r() * 6));       // размер архива в Гбайт
    // Нужные навыки и вещи достаются разным людям; остальным — «шум».
    const cards = people.map(id => ({id, name: PEOPLE[id][0], job: PEOPLE[id][1], skill: null, item: pick(r, items), health: pick(r, HEALTH), trait: pick(r, TRAIT)}));
    // Навык нужды достаётся тому, кому он подходит по профессии (если такой есть среди кандидатов).
    const FIT = {net: 'сисадмин', py: 'программист', hw: 'инженер', zip: 'учёный', db: 'учитель', sec: 'геймер', store: 'журналист'};
    let slots = shuffle(r, cards.map((c, i) => i));
    needs.forEach((nd, k) => { const fit = slots.findIndex(i => cards[i].job === FIT[nd]); if (fit >= k) [slots[k], slots[fit]] = [slots[fit], slots[k]]; });
    needs.forEach((nd, k) => { const c = cards[slots[k % cards.length]], N = NEEDS[nd];
      if (nd === 'store') c.item = `флешка ${(size + 8) * 1024} Мбайт`; else if (N.skill) c.skill = N.skill; else c.item = N.item; });
    // Ловушки: «почти подходящие» вещи — флешка мала, навык не тот.
    const free = slots.slice(needs.length);
    if (needs.includes('store') && free.length) cards[free[0]].item = `флешка ${(size - 4) * 1000} Мбайт`;
    for (const i of free.slice(1)) if (!cards[i].skill && r() < 0.6) cards[i].skill = pick(r, Object.keys(SKILLS).filter(s => !needs.includes(s)));
    return {cards, needs, size, trials: needs.map(nd => trial(nd, r, grade, size))};
  }
  const gbOf = item => { const m = /флешка (\d+) Мбайт/.exec(item || ''); return m ? +m[1] / 1024 : 0; };
  const covers = (c, nd, size) => nd === 'store' ? gbOf(c.item) >= size : (NEEDS[nd].skill && c.skill === NEEDS[nd].skill) || (NEEDS[nd].item && NEEDS[nd].item !== 'флешка' && c.item === NEEDS[nd].item);
  function levels(grade) {
    return SCEN.map(([title, story, n, keep, needs], i) => ({title, story, n, keep, needs, seed: 500 + grade * 31 + i * 7,
      brief: `${story} В бункер помещаются ${keep} из ${n}. Нужды бункера: ${needs.map(nd => NEEDS[nd].title.toLowerCase()).join('; ')}.`}));
  }
  function check(lv, ans, grade = 8) {
    const S = setup(lv, grade);
    if (!ans || !Array.isArray(ans.kept) || !Array.isArray(ans.answers)) return {ok: false, msg: 'Нет решения.'};
    const kept = [...new Set(ans.kept)].filter(i => Number.isInteger(i) && i >= 0 && i < S.cards.length);
    if (kept.length !== lv.keep) return {ok: false, msg: `В бункере должно остаться ровно ${lv.keep}.`};
    const team = kept.map(i => S.cards[i]), covered = S.needs.filter(nd => team.some(c => covers(c, nd, S.size))).length;
    const right = S.trials.filter((t, k) => ans.answers[k] === t.right).length, miss = (S.needs.length - covered) + (S.trials.length - right);
    if (miss > 2) return {ok: false, covered, right, msg: `Бункер не выстоял: закрыто нужд ${covered} из ${S.needs.length}, верных ответов ${right} из ${S.trials.length}.`};
    return {ok: true, stars: miss === 0 ? 3 : miss === 1 ? 2 : 1, covered, right, msg: `Бункер выстоял! Нужд закрыто: ${covered} из ${S.needs.length}, испытаний пройдено: ${right} из ${S.trials.length}.`};
  }
  function solve(lv, grade = 8) {
    const S = setup(lv, grade), n = S.cards.length; let best = null;
    const rec = (start, pickd) => { if (pickd.length === lv.keep) { const cov = S.needs.filter(nd => pickd.some(i => covers(S.cards[i], nd, S.size))).length; if (!best || cov > best.cov) best = {cov, kept: pickd.slice()}; return; }
      for (let i = start; i < n; i++) { pickd.push(i); rec(i + 1, pickd); pickd.pop(); } };
    rec(0, []);
    return {kept: best.kept, answers: S.trials.map(t => t.right)};
  }
  // ---------- страница ----------
  function style() {
    if (typeof document === 'undefined' || document.getElementById('bk-style')) return;
    const s = document.createElement('style'); s.id = 'bk-style';
    s.textContent = `.bk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}.bk-card{position:relative;display:grid;gap:6px;padding:10px;border-radius:16px;background:rgba(20,30,56,.92);border:2px solid #3b4d78}
.bk-card.out{opacity:.35;filter:grayscale(1)}.bk-card img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;background:#0b1024}.bk-card b{font-size:17px}.bk-attr{display:flex;gap:6px;font-size:13px;align-items:baseline}.bk-attr i{font-style:normal;color:#9fb2d6;min-width:66px}
.bk-attr.hid span{color:#55618a}.bk-say{font-size:13px;color:#ffe08a;min-height:34px}.bk-out{margin-top:4px}.bk-head{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:0 0 10px}.bk-round{padding:6px 14px;border-radius:999px;background:#5b2bd6;font-weight:800}
.bk-needs{display:flex;flex-wrap:wrap;gap:6px}.bk-needs span{padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.08);font-size:13px}.bk-needs span.ok{background:#1f5a45}
.bk-trial{display:grid;gap:8px;padding:14px;border-radius:16px;background:rgba(20,30,56,.92);border:2px solid #3b4d78;margin:10px 0}.bk-trial pre{margin:0;font:700 16px ui-monospace,monospace;white-space:pre-wrap}.bk-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bk-opt{padding:10px;border-radius:12px;border:2px solid #4b5f8f;background:#243253;color:#fff;font:700 15px system-ui;cursor:pointer;text-align:left}.bk-opt.on{border-color:#ffd34d}.bk-opt.gone{opacity:.25;text-decoration:line-through}.bk-help{display:flex;gap:8px;align-items:center;font-size:13px;color:#7df9ff}.bk-help img{width:38px;height:38px;border-radius:50%;object-fit:cover}
@media(max-width:700px){.bk-opts{grid-template-columns:1fr}}`;
    document.head.append(s);
  }
  const ROUNDS = [['job', 'профессия'], ['skill', 'навык'], ['item', 'багаж'], ['health', 'здоровье'], ['trait', 'характер']];
  function speech(c, round, needs) {
    const k = ROUNDS[Math.min(round, ROUNDS.length - 1)][0];
    if (k === 'job') return `«Я ${c.job}. Без меня тут будет скучно!»`;
    if (k === 'skill') return c.skill ? `«Разбираюсь в теме «${SKILLS[c.skill]}» — это пригодится!»` : '«Особых навыков нет, зато я быстро учусь».';
    if (k === 'item') return /флешка/.test(c.item) ? `«У меня ${c.item}! Влезет ли туда архив — посчитайте».` : `«Взял с собой: ${c.item}».`;
    if (k === 'health') return c.health === 'здоров' || c.health === 'отличная форма' ? '«Я полон сил!»' : `«Небольшая проблема: ${c.health}, но я справлюсь».`;
    return `«Друзья говорят, я ${c.trait}».`;
  }
  function mount(host, lv, api) {
    style(); const {el, button} = api, S = setup(lv, api.grade), task = el('div', 'lab-task'), head = el('div', 'bk-head'), grid = el('div', 'bk-grid'), msg = el('p', 'lab-msg'), final = el('div');
    let round = 0, out = new Set(), answers = S.trials.map(() => -1), stage = 'vote';
    const port = c => `art/bunker_p${c.id}.webp?v=1`;
    task.append(el('h2', '', lv.title), el('p', '', lv.brief), el('p', 'lab-note', 'Каждый раунд открывается новая карта у всех. Исключи одного кандидата — того, кто меньше всего поможет бункеру. В конце — испытания: специалисты подсказывают.'));
    const needsBox = () => { const b = el('div', 'bk-needs'); for (const nd of S.needs) { const ok = S.cards.some((c, i) => !out.has(i) && round >= 2 && covers(c, nd, S.size)); b.append(el('span', ok ? 'ok' : '', (ok ? '✓ ' : '○ ') + NEEDS[nd].title + (nd === 'store' ? ` (${S.size} Гбайт)` : ''))); } return b; };
    function draw() {
      head.replaceChildren(el('span', 'bk-round', stage === 'vote' ? `Раунд ${round + 1}: открыто — ${ROUNDS.slice(0, round + 1).map(x => x[1]).join(', ')}` : 'Испытания бункера'), el('span', '', `В бункере мест: ${lv.keep} · кандидатов осталось: ${S.cards.length - out.size}`), needsBox());
      grid.replaceChildren(); S.cards.forEach((c, i) => {
        const card = el('div', 'bk-card' + (out.has(i) ? ' out' : '')), im = el('img'); im.src = port(c); im.alt = c.name; card.append(im, el('b', '', c.name));
        ROUNDS.forEach(([k, t], j) => { const open = j <= round || stage !== 'vote', a = el('div', 'bk-attr' + (open ? '' : ' hid')); const v = k === 'skill' ? (c.skill ? SKILLS[c.skill] : 'нет') : c[k]; a.append(el('i', '', t), el('span', '', open ? v : '?')); card.append(a); });
        if (stage === 'vote' && !out.has(i)) { card.append(el('div', 'bk-say', speech(c, round, S.needs))); const b = button('Исключить', 'lab-small bk-out', () => vote(i)); b.dataset.out = i; card.append(b); }
        grid.append(card); });
    }
    function vote(i) {
      out.add(i); if (S.cards.length - out.size <= lv.keep) { stage = 'trials'; draw(); trials(); return; }
      round = Math.min(round + 1, ROUNDS.length - 1); draw();
    }
    function trials() {
      final.replaceChildren(el('h3', '', 'Испытания бункера'));
      const team = S.cards.filter((c, i) => !out.has(i));
      S.trials.forEach((t, k) => { const nd = S.needs[k], helper = team.find(c => covers(c, nd, S.size)), box = el('div', 'bk-trial'), opts = el('div', 'bk-opts');
        box.append(el('b', '', NEEDS[nd].title), el('pre', '', t.q));
        const gone = helper ? t.opts.map((o, j) => j).filter(j => j !== t.right).slice(0, 2) : [];
        if (helper) { const h = el('div', 'bk-help'), im = el('img'); im.src = port(helper); h.append(im, el('span', '', `${helper.name} помогает: два неверных варианта зачёркнуты.`)); box.append(h); }
        else box.append(el('div', 'bk-help', 'В команде нет специалиста — придётся самим.'));
        t.opts.forEach((o, j) => { const b = button(o, 'bk-opt' + (gone.includes(j) ? ' gone' : '') + (answers[k] === j ? ' on' : ''), () => { answers[k] = j; trials(); }); b.dataset.trial = k; b.dataset.opt = j; opts.append(b); });
        box.append(opts); final.append(box); });
      const go = button('Закрыть бункер и проверить', 'lab-main', () => { if (answers.includes(-1)) { msg.textContent = 'Ответь на все испытания.'; msg.className = 'lab-msg bad'; return; } const r = check(lv, {kept: S.cards.map((c, i) => i).filter(i => !out.has(i)), answers}, api.grade);
        if (r.ok) api.finish(r.stars, r.msg); else { msg.textContent = r.msg + ' Попробуй собрать команду иначе.'; msg.className = 'lab-msg bad'; again.hidden = false; } });
      go.dataset.act = 'run'; final.append(go);
    }
    const again = button('Начать заново', 'lab-small', () => { round = 0; out = new Set(); answers = S.trials.map(() => -1); stage = 'vote'; final.replaceChildren(); msg.textContent = ''; again.hidden = true; draw(); }); again.hidden = true; again.dataset.act = 'retry';
    host.append(task, head, grid, final, msg, again); draw();
    if (api.debugHost) window.labSet = a => { out = new Set(S.cards.map((c, i) => i).filter(i => !a.kept.includes(i))); stage = 'trials'; answers = a.answers.slice(); draw(); trials(); };
    return () => { if (api.debugHost) delete window.labSet; };
  }
  LAB.register({id: 'bunker', bg: 'bg_bunker', title: 'Бункер', genre: 'настольная игра · команда', art: '🚪', color: '#c9a24d', unit: 'Сценарий', minutes: 35,
    about: 'По мотивам настолки «Бункер»: Глюк отключил интернет, в серверный бункер помещаются не все. Открывай карты кандидатов, считай объём флешек, выбирай специалистов — и пройди испытания по информатике всей командой.',
    levels, mount, check, solve, lib: {setup, covers, trial, NEEDS, gbOf}});
})();
