// «Экспедиция»: текстовое приключение, которое ученик сам дописывает. Мир игры — словарь Python: комнаты, выходы, предметы и замки.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  /* ---------- разбор кода: присваивания со словарями, списками, строками, числами, True/False ---------- */
  function parse(code) {
    const src = String(code), toks = []; let i = 0, line = 1; const fail = (m, l = line) => { const e = new Error(`Строка ${l}: ${m}`); e.line = l; throw e; };
    while (i < src.length) { const ch = src[i];
      if (ch === '\n') { line++; i++; } else if (/\s/.test(ch)) i++; else if (ch === '#') { while (i < src.length && src[i] !== '\n') i++; }
      else if (ch === '"' || ch === "'") { let j = i + 1, s = ''; while (j < src.length && src[j] !== ch) { if (src[j] === '\n') fail('строка не закрыта кавычкой'); s += src[j] === '\\' && j + 1 < src.length ? src[++j] : src[j]; j++; } if (j >= src.length) fail('строка не закрыта кавычкой'); toks.push({t: 'str', v: s, line}); i = j + 1; }
      else if (/[0-9]/.test(ch)) { let j = i; while (/[0-9]/.test(src[j] || '')) j++; toks.push({t: 'num', v: Number(src.slice(i, j)), line}); i = j; }
      else if (/[\p{L}_]/u.test(ch)) { let j = i; while (/[\p{L}0-9_]/u.test(src[j] || '')) j++; toks.push({t: 'id', v: src.slice(i, j), line}); i = j; }
      else if ('{}[]:,='.includes(ch)) { toks.push({t: ch, line}); i++; } else fail(`непонятный знак «${ch}»`); }
    let p = 0; const peek = () => toks[p], take = t => { const k = toks[p]; if (!k || k.t !== t) fail(`здесь нужен знак «${t}»` + (k ? '' : ' (код оборвался)'), k ? k.line : line); p++; return k; };
    const value = () => { const k = toks[p]; if (!k) fail('код оборвался: не хватает значения');
      if (k.t === 'str' || k.t === 'num') { p++; return k.v; }
      if (k.t === 'id') { p++; if (k.v === 'True') return true; if (k.v === 'False') return false; if (k.v === 'None') return null; fail(`неизвестное слово «${k.v}». Текст нужно брать в кавычки`, k.line); }
      if (k.t === '[') { p++; const out = []; while (peek() && peek().t !== ']') { out.push(value()); if (peek() && peek().t === ',') p++; else if (peek() && peek().t !== ']') fail('между элементами списка нужна запятая', peek().line); } take(']'); return out; }
      if (k.t === '{') { p++; const out = {}; while (peek() && peek().t !== '}') { const key = toks[p]; if (key.t !== 'str') fail('ключ словаря должен быть строкой в кавычках', key.line); p++; take(':'); out[key.v] = value(); if (peek() && peek().t === ',') p++; else if (peek() && peek().t !== '}') fail('между парами словаря нужна запятая', peek().line); } take('}'); return out; }
      fail(`здесь не может стоять «${k.t}»`, k.line); };
    const vars = {}; while (p < toks.length) { const name = toks[p]; if (name.t !== 'id') fail('строка должна начинаться с имени переменной, например rooms = {...}', name.line); p++; take('='); vars[name.v] = value(); }
    return vars;
  }
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  // Проверка мира: всё ли на месте и ведут ли выходы в существующие комнаты.
  function world(code) {
    let vars; try { vars = parse(code); } catch (e) { return {errors: [e.message]}; }
    const errors = [], rooms = vars.rooms, start = vars.start;
    if (!isObj(rooms) || !Object.keys(rooms).length) return {errors: ['Нужен словарь rooms с комнатами: rooms = {...}']};
    if (typeof start !== 'string' || !rooms[start]) errors.push(`Переменная start должна называть существующую комнату. Сейчас start = ${JSON.stringify(start)}.`);
    for (const [name, r] of Object.entries(rooms)) { if (!isObj(r)) { errors.push(`Комната «${name}» должна быть словарём.`); continue; }
      if (typeof r['текст'] !== 'string' || !r['текст'].trim()) errors.push(`У комнаты «${name}» нет описания: 'текст': '...'.`);
      for (const k of Object.keys(r)) if (!['текст', 'выходы', 'предметы', 'нужно', 'победа'].includes(k)) errors.push(`В комнате «${name}» неизвестный ключ «${k}». Можно: текст, выходы, предметы, нужно, победа.`);
      const exits = r['выходы'] === undefined ? {} : r['выходы']; if (!isObj(exits)) { errors.push(`В комнате «${name}» выходы должны быть словарём: {'север': 'зал'}.`); continue; }
      for (const [dir, to] of Object.entries(exits)) if (typeof to !== 'string' || !rooms[to]) errors.push(`Выход «${dir}» из комнаты «${name}» ведёт в комнату «${to}», которой нет.`);
      if (r['предметы'] !== undefined && (!Array.isArray(r['предметы']) || r['предметы'].some(x => typeof x !== 'string'))) errors.push(`В комнате «${name}» предметы должны быть списком строк: ['ключ'].`);
      if (r['нужно'] !== undefined) { if (!isObj(r['нужно'])) errors.push(`В комнате «${name}» ключ «нужно» должен быть словарём: {'север': 'ключ'}.`); else for (const [dir, item] of Object.entries(r['нужно'])) { if (!(dir in exits)) errors.push(`В комнате «${name}» замок стоит на выходе «${dir}», которого нет.`); if (typeof item !== 'string') errors.push(`В комнате «${name}» замок должен называть предмет строкой.`); } }
      if (r['победа'] !== undefined && typeof r['победа'] !== 'boolean') errors.push(`В комнате «${name}» победа должна быть True или False.`); }
    return errors.length ? {errors} : {errors, rooms, start};
  }
  // Автопрохождение: поиск в ширину по состояниям «комната + собранные предметы». banned — предмет, которого как будто нет.
  function explore(w, banned) {
    const key = (room, inv) => room + '|' + [...inv].sort().join(','), grab = (room, inv) => { const out = new Set(inv); for (const it of w.rooms[room]['предметы'] || []) if (it !== banned) out.add(it); return out; };
    const inv0 = grab(w.start, new Set()), seen = new Set([key(w.start, inv0)]), queue = [[w.start, inv0, 0]], reached = new Set([w.start]); let win = -1;
    for (let h = 0; h < queue.length && h < 20000; h++) { const [room, inv, steps] = queue[h], r = w.rooms[room]; if (r['победа'] === true) { if (win < 0) win = steps; continue; }
      for (const [dir, to] of Object.entries(r['выходы'] || {})) { const need = (r['нужно'] || {})[dir]; if (need && !inv.has(need)) continue; const inv2 = grab(to, inv), k = key(to, inv2); reached.add(to); if (!seen.has(k)) { seen.add(k); queue.push([to, inv2, steps + 1]); } } }
    return {win, reached};
  }
  function facts(code) {
    const w = world(code); if (w.errors.length) return {errors: w.errors};
    const all = explore(w), names = Object.keys(w.rooms), items = [...new Set(names.flatMap(n => w.rooms[n]['предметы'] || []))], locks = names.flatMap(n => Object.entries(w.rooms[n]['нужно'] || {}).map(([dir, item]) => ({room: n, dir, item})));
    const needed = all.win >= 0 ? items.filter(it => explore(w, it).win < 0) : [];
    return {errors: [], w, rooms: names.length, reached: all.reached.size, winnable: all.win >= 0, steps: all.win, items, locks, needed, lost: names.filter(n => !all.reached.has(n))};
  }
  /* ---------- уровни ---------- */
  const BASE = `start = 'лагерь'

rooms = {
    'лагерь': {
        'текст': 'Ты в лагере экспедиции у подножия древнего храма. Тропа ведёт на север.',
        'выходы': {'север': 'вход'},
    },
    'вход': {
        'текст': 'Каменные ворота храма. Внутри темно. На север уходит коридор.',
        'выходы': {'юг': 'лагерь', 'север': 'зал'},
    },
    'зал': {
        'текст': 'Большой зал с колоннами. На востоке блестит золото.',
        'выходы': {'юг': 'вход', 'восток': 'сокровищница'},
    },
    'сокровищница': {
        'текст': 'Сокровищница! Экспедиция удалась.',
        'победа': True,
    },
}
`;
  const BROKEN = BASE.replace("'север': 'зал'}", "'север': 'зла'}");
  const LIB = BASE.replace("'выходы': {'юг': 'вход', 'восток': 'сокровищница'},\n    },", "'выходы': {'юг': 'вход', 'восток': 'сокровищница', 'запад': 'библиотека'},\n    },\n    'библиотека': {\n        'текст': 'Пыльная библиотека со свитками. Выход только на восток.',\n        'выходы': {'восток': 'зал'},\n    },");
  const KEY = LIB.replace("'выходы': {'восток': 'зал'},\n    },", "'выходы': {'восток': 'зал'},\n        'предметы': ['ключ'],\n    },");
  const LOCK = KEY.replace("'восток': 'сокровищница', 'запад': 'библиотека'},", "'восток': 'сокровищница', 'запад': 'библиотека'},\n        'нужно': {'восток': 'ключ'},");
  const DEAD = LOCK.replace("        'предметы': ['ключ'],\n", '').replace("'текст': 'Сокровищница! Экспедиция удалась.',", "'текст': 'Сокровищница! Экспедиция удалась.',\n        'предметы': ['ключ'],");
  const TWO = LOCK.replace("'выходы': {'юг': 'лагерь', 'север': 'зал'},", "'выходы': {'юг': 'лагерь', 'север': 'зал'},\n        'нужно': {'север': 'фонарь'},").replace("'выходы': {'север': 'вход'},", "'выходы': {'север': 'вход'},\n        'предметы': ['фонарь'],");
  const OWN = TWO.replace("'выходы': {'восток': 'зал'},\n        'предметы': ['ключ'],", "'выходы': {'восток': 'зал', 'север': 'обсерватория'},").replace("    'сокровищница': {", "    'обсерватория': {\n        'текст': 'Круглая комната под куполом. В потолке щель для телескопа.',\n        'выходы': {'юг': 'библиотека', 'восток': 'галерея'},\n    },\n    'галерея': {\n        'текст': 'Длинная галерея со статуями. В руке одной статуи зажат старый ключ.',\n        'выходы': {'запад': 'обсерватория'},\n        'предметы': ['ключ'],\n    },\n    'сокровищница': {");
  const T = (title, brief, startCode, ref, need, test) => ({title, brief, start: startCode, ref, need, test});
  const LEVELS = [
    T('Пройди игру', 'Это готовая маленькая игра. Слева её код, справа — сама игра. Дойди до сокровищницы, а потом посмотри, как комнаты записаны в словаре rooms.', BASE, BASE, 'Нажми «Проверить и запустить» и дойди до победы.', (f, a) => a.won ? '' : 'Пройди игру до сокровищницы.'),
    T('Найди ошибку', 'Кто-то опечатался, и игра сломалась. Запусти проверку, прочитай сообщение об ошибке и исправь код.', BROKEN, BASE, 'Игра должна запускаться и проходиться.', () => ''),
    T('Новая комната', 'Добавь в словарь rooms комнату «библиотека» и сделай в неё выход из зала. Не забудь выход обратно.', BASE, LIB, 'Нужна комната «библиотека», в которую можно попасть и из которой можно вернуться.', f => !f.w.rooms['библиотека'] ? 'Комнаты «библиотека» пока нет.' : f.lost.includes('библиотека') ? 'В библиотеку нельзя попасть: добавь выход из зала.' : !Object.keys(f.w.rooms['библиотека']['выходы'] || {}).length ? 'Из библиотеки нет выхода.' : ''),
    T('Предмет', 'Положи в библиотеку предмет «ключ»: предметы комнаты записываются списком.', LIB, KEY, "В какой-нибудь комнате должен лежать предмет 'ключ'.", f => f.items.includes('ключ') ? '' : "Предмета 'ключ' пока нигде нет: добавь 'предметы': ['ключ']."),
    T('Замок', "Сокровищница слишком доступна. Поставь на выход из зала замок: 'нужно': {'восток': 'ключ'} — без ключа не пройти.", KEY, LOCK, 'Без ключа до победы дойти нельзя, а с ключом — можно.', f => !f.locks.some(l => l.item === 'ключ') ? "Замка с ключом пока нет: добавь в зал 'нужно': {'восток': 'ключ'}." : f.needed.includes('ключ') ? '' : 'До победы можно дойти и без ключа — замок стоит не на том выходе.'),
    T('Тупик', 'В этой игре ключ лежит за дверью, которую он же открывает. Автопроверка говорит, что победа недостижима. Переложи ключ так, чтобы игру можно было пройти, но замок остался.', DEAD, LOCK, 'Игра проходима, и ключ по-прежнему нужен для победы.', f => f.needed.includes('ключ') ? '' : 'Замок с ключом должен остаться и быть нужным для победы.'),
    T('Два испытания', 'Сделай так, чтобы для победы понадобились два разных предмета: например, фонарь, чтобы войти в тёмный храм, и ключ от сокровищницы.', LOCK, TWO, 'Для победы должны быть необходимы два разных предмета.', f => f.needed.length >= 2 ? '' : `Сейчас для победы необходимо предметов: ${f.needed.length}. Нужно два разных: каждый должен открывать свой замок на пути.`),
    T('Своя игра', 'Теперь это твоя игра. Сделай не меньше шести комнат и двух замков, чтобы до победы было не меньше восьми переходов. Придумай свои описания! Готовый код можно скопировать и дать пройти однокласснику.', TWO, OWN, 'Комнат — 6 или больше, замков — 2 или больше, во все комнаты можно попасть, до победы не меньше 8 переходов.', f => f.rooms < 6 ? `Комнат пока ${f.rooms}, нужно не меньше 6.` : f.locks.length < 2 ? 'Нужно не меньше двух замков.' : f.lost.length ? `В эти комнаты нельзя попасть: ${f.lost.join(', ')}.` : f.steps < 8 ? `До победы всего ${f.steps} переходов, нужно не меньше 8.` : ''),
  ];
  function check(lv, answer) {
    const a = answer && typeof answer === 'object' ? answer : {code: ''}, f = facts(a.code || '');
    if (f.errors.length) return {ok: false, msg: f.errors[0], errors: f.errors};
    if (f.lost.length && lv !== LEVELS[0]) { /* недостижимые комнаты — предупреждение, решает проверка уровня */ }
    if (!f.winnable) return {ok: false, msg: 'Автопроверка прошла игру всеми способами и не нашла пути к победе. Проверь выходы и замки.', facts: f};
    const miss = lv.test(f, a); if (miss) return {ok: false, msg: miss, facts: f};
    return {ok: true, stars: 3, msg: `Игра проходима: комнат ${f.rooms}, до победы ${f.steps} переходов.`, facts: f};
  }

  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), code = el('textarea', 'qu-code'), msg = el('p', 'lab-msg'), game = el('div', 'qu-game'), info = el('p', 'lab-note'); let fails = 0, won = false, w = null, at = '', inv = new Set(), left = {}, moves = 0;
    task.append(el('h2', '', lv.title), el('p', '', lv.brief), el('p', 'qu-need', 'Задание: ' + lv.need)); code.value = lv.start; code.spellcheck = false; code.setAttribute('aria-label', 'Код игры');
    code.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = code.selectionStart; code.setRangeText('    ', s, code.selectionEnd, 'end'); } });
    function scene() {
      const r = w.rooms[at], box = el('div'), low = at.toLowerCase(), pic = /лагер/.test(low) ? 'camp' : /вход|ворот|врат/.test(low) ? 'gate' : /библиот/.test(low) ? 'library' : /сокров|клад/.test(low) ? 'treasure' : /обсерват|купол/.test(low) ? 'observatory' : /галере|стату/.test(low) ? 'gallery' : /зал/.test(low) ? 'hall' : 'cave';
      // Картинка комнаты подбирается по её названию (нарисованы нейросетью, tools/art5).
      const im = new Image(); im.className = 'qu-pic'; im.alt = ''; im.src = `art/quest_${pic}.webp?v=1`; im.addEventListener('error', () => im.remove()); box.append(im, el('p', 'qu-room', at.toUpperCase()), el('p', 'qu-text', r['текст']));
      if (r['победа'] === true) { won = true; box.append(el('p', 'qu-win', `Победа! Переходов: ${moves}.`)); game.replaceChildren(box); verdict(true); return; }
      const items = (left[at] || []); if (items.length) { const row = el('div', 'qu-row'); row.append(el('span', '', 'Здесь лежит:')); for (const it of items) { const b = button('взять ' + it, 'lab-small', () => { inv.add(it); left[at] = left[at].filter(x => x !== it); scene(); }); b.dataset.take = it; row.append(b); } box.append(row); }
      const row = el('div', 'qu-row'); row.append(el('span', '', 'Идти:')); for (const [dir, to] of Object.entries(r['выходы'] || {})) { const need = (r['нужно'] || {})[dir], ok = !need || inv.has(need), b = button(ok ? `${dir} →` : `${dir} · закрыто, нужен предмет «${need}»`, 'qu-exit', () => { at = to; moves++; scene(); }); b.dataset.dir = dir; b.disabled = !ok; row.append(b); }
      if (!Object.keys(r['выходы'] || {}).length) row.append(el('em', '', 'выходов нет — тупик'));
      box.append(row, el('p', 'qu-inv', 'В рюкзаке: ' + ([...inv].join(', ') || 'пусто'))); game.replaceChildren(box);
    }
    function verdict(afterPlay) {
      const r = check(lv, {code: code.value, won}); if (r.facts) info.textContent = `Автопроверка: комнат ${r.facts.rooms}, достижимо ${r.facts.reached}, замков ${r.facts.locks.length}, ` + (r.facts.winnable ? `до победы ${r.facts.steps} переходов, необходимые предметы: ${r.facts.needed.join(', ') || 'нет'}.` : 'победа недостижима.');
      if (r.ok) { msg.textContent = 'Задание выполнено. ' + r.msg; msg.className = 'lab-msg good'; api.finish(fails === 0 ? 3 : fails <= 2 ? 2 : 1, r.msg); }
      else if (!afterPlay || !r.errors) { msg.textContent = r.msg; msg.className = 'lab-msg bad'; }
      return r;
    }
    const go = button('Проверить и запустить', 'lab-main', () => { won = false; const f = facts(code.value); if (f.errors.length) { fails++; msg.textContent = f.errors[0] + (f.errors.length > 1 ? ` (и ещё ошибок: ${f.errors.length - 1})` : ''); msg.className = 'lab-msg bad'; game.replaceChildren(el('p', 'lab-note', 'Игра не запустилась: исправь ошибку в коде.')); info.textContent = ''; return; }
      w = f.w; at = w.start; inv = new Set(); moves = 0; left = Object.fromEntries(Object.keys(w.rooms).map(n => [n, [...(w.rooms[n]['предметы'] || [])]])); scene(); const r = verdict(false); if (!r.ok && lv !== LEVELS[0]) fails++; if (!r.ok && lv === LEVELS[0]) { msg.textContent = 'Игра запущена. Пройди её справа.'; msg.className = 'lab-msg'; } }); go.dataset.act = 'run';
    const copy = button('Скопировать код', 'lab-small', () => { code.select(); try { navigator.clipboard.writeText(code.value); } catch { document.execCommand('copy'); } msg.textContent = 'Код скопирован: его можно вставить в игру одноклассника.'; msg.className = 'lab-msg'; }), reset = button('Вернуть начальный код', 'lab-small', () => { if (confirm('Заменить код начальным вариантом этого уровня?')) code.value = lv.start; });
    const l = el('div', 'lab-panel'), r = el('div', 'lab-panel'), cols = el('div', 'lab-cols'), bar = el('div', 'lab-bar'); bar.style.justifyContent = 'flex-start'; bar.append(go, copy, reset);
    l.append(el('h3', '', 'Код игры (Python: словари и списки)'), code, bar, msg, info); r.append(el('h3', '', 'Игра'), game, el('p', 'lab-note', 'Три звезды — если задание выполнено с первой проверки. Ошибки в коде показываются с номером строки.'));
    game.append(el('p', 'lab-note', 'Нажми «Проверить и запустить», чтобы начать игру.')); cols.append(l, r); host.append(task, cols); if (api.debugHost) window.labSet = c => { code.value = c; };
  }
  LAB.register({id: 'quest', bg: 'bg_quest', hero: 'host_explorer', title: 'Экспедиция', genre: 'своя игра на Python', art: '🗺', color: '#e0b84a', unit: 'Задание', minutes: 45,
    about: 'Текстовое приключение, которое ты дописываешь сам. Мир игры — словарь Python: добавляй комнаты, предметы и замки. Автопроверка пройдёт твою игру всеми путями и скажет, можно ли победить.',
    levels: () => LEVELS, mount, check, solve: lv => ({code: lv.ref, won: true}), parse, facts, LEVELS});
})();
