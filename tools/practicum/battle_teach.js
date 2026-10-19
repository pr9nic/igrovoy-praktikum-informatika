// «Битва класса»: экран учителя — библиотека викторин, редактор всех типов вопросов, запуск игры,
// живая панель (таблица ученик × вопрос, особые условия, пауза) с экраном для проектора и отчёты.
(() => {
  'use strict';
  const B = window.BattleQ, {h, btn, img, API, ART, MODES, TYPES, TYPE_ICON, POWER, COLORS, SHAPES, TIERS, THEMES} = B;
  let timer = 0;
  const stop = () => { clearInterval(timer); timer = 0; B.Sound.stop(); };
  const fmtDate = t => new Date(t * 1000).toLocaleString('ru-RU', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});
  const climber = n => ART + 'climber_' + ((n | 0) % 12) + '.webp';
  const field = (label, input, hint) => { const l = h('label', 'btt-field'); l.append(h('span', '', label), input); if (hint) l.append(h('small', '', hint)); return l; };
  const input = (value, ph, cls = '') => { const i = h('input', cls); i.value = value ?? ''; if (ph) i.placeholder = ph; return i; };
  const area = (value, ph, rows = 3) => { const t = h('textarea'); t.value = value ?? ''; t.rows = rows; if (ph) t.placeholder = ph; return t; };
  const select = (opts, value) => { const s = h('select'); for (const [v, t] of opts) { const o = h('option', '', t); o.value = v; s.append(o); } s.value = String(value); return s; };
  const check = (label, on) => { const l = h('label', 'btt-check'), c = h('input'); c.type = 'checkbox'; c.checked = !!on; l.append(c, h('span', '', label)); l.box = c; return l; };

  function teacher(ctx) {
    stop(); const {root} = ctx, page = h('section', 'btt'), nav = h('div', 'btt-nav'), body = h('div', 'btt-body');
    const tab = (t, fn, act) => { const b = btn(t, 'btt-tab', () => { stop(); nav.querySelectorAll('.btt-tab').forEach(x => x.classList.toggle('on', x === b)); fn(); }); b.dataset.tab = act; return b; };
    const back = btn('← Ко входу', 'p-small', () => { stop(); ctx.leave(); });
    const tLib = tab('📚 Библиотека', library, 'library'), tLive = tab('🎮 Игры классов', rooms, 'live'), tRep = tab('📈 Отчёты', reports, 'reports');
    nav.append(back, h('strong', '', '⚔ Битва класса — викторины всем классом'), tLib, tLive, tRep); page.append(nav, body); root.replaceChildren(page);
    const msg = t => { const p = h('p', 'btt-msg', t); body.prepend(p); setTimeout(() => p.remove(), 6000); };
    const classes = () => [...'АБВГДЕЖЗИК'].map(l => `${ctx.grade} «${l}»`);

    /* ---------- библиотека ---------- */
    async function library() {
      body.replaceChildren(h('p', 'p-note', 'Загружаем библиотеку…'));
      let d; try { d = await API('library'); } catch (e) { body.replaceChildren(h('p', 'p-note', 'Сервер не ответил: ' + e.message + '. Если это первый запуск — перезапустите журнал (см. «Состояние сервиса»).')); return; }
      const head = h('div', 'btt-row'), list = h('div', 'btt-lib'), filt = select([['all', 'Все классы'], [String(ctx.grade), ctx.grade + ' класс'], ['0', 'Для всех классов']], 'all');
      const add = btn('＋ Новая викторина', 'p-primary', () => editor({title: '', grade: ctx.grade, questions: []})); add.dataset.act = 'btt-new';
      const imp = btn('⇪ Импорт из текста', 'p-small', () => importer()); imp.dataset.act = 'btt-import';
      head.append(h('h2', '', 'Мои викторины'), filt, add, imp);
      const draw = () => { list.replaceChildren(); for (const q of d.quizzes.filter(x => filt.value === 'all' || String(x.grade) === filt.value)) {
        const c = h('div', 'btt-qz'), types = h('div', 'btt-types'); for (const t of q.types) types.append(h('span', '', TYPE_ICON[t] + ' ' + TYPES[t]));
        const play = btn('▶ Играть с классом', 'p-primary', () => host(q)); play.dataset.play = q.id;
        const edit = btn('✎ Изменить', 'p-small', async () => editor((await API('quiz', {id: q.id})).quiz)); edit.dataset.edit = q.id;
        const copy = btn('⧉ Копия', 'p-small', async () => { const full = (await API('quiz', {id: q.id})).quiz; full.title = (full.title + ' (копия)').slice(0, 100); delete full.id; await API('save', {quiz: full}); library(); });
        const del = btn('🗑', 'p-small', async () => { if (confirm(`Удалить викторину «${q.title}»?`)) { await API('delete', {id: q.id}); library(); } }); del.title = 'Удалить';
        const row = h('div', 'btt-row'); row.append(play, edit, copy, del);
        c.append(h('b', '', q.title), h('span', 'btt-meta', `${q.grade ? q.grade + ' класс' : 'для всех классов'} · вопросов: ${q.count} · изменена ${fmtDate(q.updated)}`), types, row); list.append(c); } };
      filt.addEventListener('change', draw); draw(); body.replaceChildren(head, list);
    }

    /* ---------- импорт из текста ---------- */
    function importer() {
      const t = area('', '', 14), title = input('', 'Название викторины');
      t.placeholder = '? Сколько бит в байте?\n+ 8\n- 16\n- 10\n\n? Выбери устройства ввода\n+ клавиатура\n+ мышь\n- принтер\n\n? Столица России\n= Москва\n= москва';
      const go = btn('Создать викторину', 'p-primary', async () => {
        const qs = []; for (const blk of t.value.split(/\n\s*\n/)) { const lines = blk.split('\n').map(x => x.trim()).filter(Boolean); if (!lines.length) continue;
          const text = lines.filter(x => x.startsWith('?')).map(x => x.slice(1).trim()).join(' ') || lines[0], plus = lines.filter(x => x.startsWith('+')).map(x => x.slice(1).trim()), minus = lines.filter(x => x.startsWith('-')).map(x => x.slice(1).trim()), eq = lines.filter(x => x.startsWith('=')).map(x => x.slice(1).trim());
          if (eq.length) qs.push({type: 'fill', text, accepted: eq, time: 30});
          else if (plus.length > 1) qs.push({type: 'multi', text, options: [...plus, ...minus], answers: plus.map((_, i) => i), time: 30});
          else if (plus.length === 1 && minus.length) qs.push({type: 'single', text, options: [...plus, ...minus], answer: 0, time: 20});
          else if (plus.length === 1) qs.push({type: 'fill', text, accepted: plus, time: 30}); }
        if (!qs.length) return alert('Не нашёл ни одного вопроса. Образец формата — в поле.');
        editor({title: title.value || 'Импорт', grade: ctx.grade, questions: qs}); });
      body.replaceChildren(h('h2', '', 'Импорт из текста'), h('p', 'p-note', '«?» — вопрос, «+» — верный вариант, «−» — неверный, «=» — ответ для ввода. Вопросы разделяются пустой строкой. Варианты перемешаются в игре.'), field('Название', title), t, go);
    }

    /* ---------- редактор ---------- */
    function editor(quiz) {
      const qz = JSON.parse(JSON.stringify(quiz)); let cur = qz.questions.length ? 0 : -1;
      const title = input(qz.title, 'Название викторины'), grade = select([['0', 'для всех классов'], ...[6, 7, 8, 9, 10, 11].map(g => [String(g), g + ' класс'])], qz.grade || 0);
      const listBox = h('div', 'btt-qlist'), form = h('div', 'btt-form'), err = h('p', 'btt-err');
      const save = btn('💾 Сохранить', 'p-primary', async () => { qz.title = title.value; qz.grade = Number(grade.value); try { const r = await API('save', {quiz: {title: qz.title, grade: qz.grade, questions: qz.questions}, id: qz.id}); qz.id = r.id; err.textContent = ''; msg('Викторина сохранена.'); } catch (e) { err.textContent = e.message; } });
      save.dataset.act = 'btt-save';
      const typeGrid = h('div', 'btt-typegrid'); for (const t of Object.keys(TYPES)) { const b = btn('', 'btt-type', () => { qz.questions.push(blank(t)); cur = qz.questions.length - 1; drawList(); drawForm(); }); b.dataset.type = t; b.append(h('b', '', TYPE_ICON[t]), h('span', '', TYPES[t])); typeGrid.append(b); }
      function blank(t) { const q = {type: t, text: '', time: 30, weight: 1, explain: ''};
        if (t === 'single' || t === 'poll') Object.assign(q, {options: ['', '', '', ''], answer: 0}); if (t === 'multi') Object.assign(q, {options: ['', '', '', ''], answers: [0]});
        if (t === 'fill') q.accepted = ['']; if (t === 'math') Object.assign(q, {value: '', tol: 0, unit: ''}); if (t === 'match') q.pairs = [['', ''], ['', ''], ['', '']]; if (t === 'reorder') q.items = ['', '', ''];
        if (t === 'categorize') q.cats = [{name: '', items: ['']}, {name: '', items: ['']}]; if (t === 'dragdrop') { q.text = 'Пример: [[процессор]] обрабатывает данные.'; q.distractors = []; } if (t === 'dropdown') q.text = 'В байте {{8|16|10}} бит.';
        if (t === 'label' || t === 'hotspot') q.spots = []; if (t === 'graph') q.points = [[0, 0]]; return q; }
      function drawList() { listBox.replaceChildren(); qz.questions.forEach((q, i) => { const c = h('div', 'btt-qi' + (i === cur ? ' on' : '')); c.dataset.q = i;
          c.append(h('b', '', `${i + 1}. ${TYPE_ICON[q.type]} ${TYPES[q.type]}`), h('span', '', (q.text || '').replace(/\[\[|\]\]|\{\{|\}\}/g, '').slice(0, 70) || '(без текста)'));
          const row = h('div', 'btt-mini'); row.append(btn('▲', '', e => { e.stopPropagation(); if (i) { [qz.questions[i - 1], qz.questions[i]] = [qz.questions[i], qz.questions[i - 1]]; cur = i - 1; drawList(); drawForm(); } }),
            btn('▼', '', e => { e.stopPropagation(); if (i < qz.questions.length - 1) { [qz.questions[i + 1], qz.questions[i]] = [qz.questions[i], qz.questions[i + 1]]; cur = i + 1; drawList(); drawForm(); } }),
            btn('⧉', '', e => { e.stopPropagation(); qz.questions.splice(i + 1, 0, JSON.parse(JSON.stringify({...q, id: undefined}))); cur = i + 1; drawList(); drawForm(); }),
            btn('✖', '', e => { e.stopPropagation(); qz.questions.splice(i, 1); cur = Math.min(cur, qz.questions.length - 1); drawList(); drawForm(); }));
          c.append(row); c.addEventListener('click', () => { cur = i; drawList(); drawForm(); }); listBox.append(c); }); }
      function drawForm() {
        form.replaceChildren(); if (cur < 0) { form.append(h('h3', '', 'Добавьте вопрос — выберите тип:'), typeGrid); return; }
        const q = qz.questions[cur], set = (k, v) => { q[k] = v; drawList(); };
        const text = area(q.text, q.type === 'dragdrop' ? 'Текст с пропусками: [[слово]]' : q.type === 'dropdown' ? 'Текст со списками: {{верно|неверно|неверно}}' : 'Текст вопроса', 3); text.dataset.field = 'q-text'; text.addEventListener('input', () => set('text', text.value));
        const time = select([5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300].map(s => [String(s), s < 60 ? s + ' с' : s / 60 + ' мин']), q.time); time.addEventListener('change', () => { q.time = Number(time.value); });
        const weight = select([1, 2, 3, 4, 5].map(n => [String(n), n + ' балл' + (n === 1 ? '' : n < 5 ? 'а' : 'ов')]), q.weight || 1); weight.addEventListener('change', () => { q.weight = Number(weight.value); });
        const expl = area(q.explain, 'Пояснение после ответа (необязательно)', 2); expl.addEventListener('input', () => { q.explain = expl.value; });
        const picBox = h('div', 'btt-pic'), file = h('input'); file.type = 'file'; file.accept = 'image/*'; file.dataset.field = 'q-image';
        file.addEventListener('change', () => { const f = file.files[0]; if (!f) return; const im = new Image(); im.onload = () => { const k = Math.min(1, 900 / Math.max(im.width, im.height)), cv = h('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          let url = cv.toDataURL('image/webp', 0.8); if (!url.startsWith('data:image/webp')) url = cv.toDataURL('image/jpeg', 0.8); if (url.length > 600000) return alert('Картинка слишком большая даже после сжатия.'); q.image = url; drawForm(); }; im.src = URL.createObjectURL(f); });
        if (q.image) { const wrap = h('div', 'btt-picwrap'), pi = img(q.image, '', 'картинка'); wrap.append(pi);
          if (q.type === 'label' || q.type === 'hotspot') { wrap.classList.add('pick'); wrap.addEventListener('click', e => { const r = pi.getBoundingClientRect(), x = Math.round(1000 * (e.clientX - r.left) / r.width) / 10, y = Math.round(1000 * (e.clientY - r.top) / r.height) / 10;
              if (q.type === 'label') { const t = prompt('Подпись для этой точки:'); if (t) q.spots.push({text: t, x, y}); } else q.spots.push({x, y, r: 8}); drawForm(); });
            q.spots.forEach((s, k) => { const m = h('div', q.type === 'label' ? 'btt-spot' : 'btt-ring', q.type === 'label' ? String(k + 1) : ''); m.style.left = s.x + '%'; m.style.top = s.y + '%'; if (q.type === 'hotspot') m.style.width = m.style.height = 2 * s.r + '%'; wrap.append(m); }); }
          picBox.append(wrap, btn('Убрать картинку', 'p-small', () => { delete q.image; drawForm(); })); }
        picBox.prepend(field(q.type === 'label' || q.type === 'hotspot' ? 'Картинка (обязательно), затем щёлкайте по ней, чтобы отметить точки' : 'Картинка к вопросу', file));
        form.append(h('h3', '', `${cur + 1}. ${TYPE_ICON[q.type]} ${TYPES[q.type]}`), field('Текст', text));
        const opts = h('div', 'btt-opts');
        const rows = (arr, ph, extra) => { opts.replaceChildren(); arr.forEach((v, i) => { const r = h('div', 'btt-optrow'); if (extra) r.append(extra(i)); const inp = input(v, `${ph} ${i + 1}`); inp.dataset.opt = i; inp.addEventListener('input', () => { arr[i] = inp.value; }); r.append(inp, btn('✖', 'p-small', () => { if (arr.length > 1) { arr.splice(i, 1); fix(i); drawForm(); } })); opts.append(r); });
          opts.append(btn('＋ Добавить', 'p-small', () => { arr.push(''); drawForm(); })); };
        const fix = i => { if (q.type === 'single' && q.answer >= q.options.length) q.answer = 0; if (q.type === 'multi') q.answers = q.answers.filter(a => a !== i).map(a => a > i ? a - 1 : a); };
        if (q.type === 'single' || q.type === 'poll') rows(q.options, 'Вариант', q.type === 'single' ? i => { const r = h('input'); r.type = 'radio'; r.name = 'right'; r.checked = q.answer === i; r.title = 'верный'; r.addEventListener('change', () => { q.answer = i; }); return r; } : null);
        if (q.type === 'multi') rows(q.options, 'Вариант', i => { const c = h('input'); c.type = 'checkbox'; c.checked = q.answers.includes(i); c.title = 'верный'; c.addEventListener('change', () => { q.answers = c.checked ? [...new Set([...q.answers, i])] : q.answers.filter(a => a !== i); }); return c; });
        if (q.type === 'fill') rows(q.accepted, 'Принимаемый ответ');
        if (q.type === 'reorder') rows(q.items, 'Шаг (в верном порядке)');
        if (q.type === 'match') { opts.replaceChildren(); q.pairs.forEach((p, i) => { const r = h('div', 'btt-optrow'), a = input(p[0], 'Слева'), b2 = input(p[1], 'Справа'); a.addEventListener('input', () => { p[0] = a.value; }); b2.addEventListener('input', () => { p[1] = b2.value; }); r.append(a, h('span', '', '⇄'), b2, btn('✖', 'p-small', () => { q.pairs.splice(i, 1); drawForm(); })); opts.append(r); }); opts.append(btn('＋ Пара', 'p-small', () => { q.pairs.push(['', '']); drawForm(); })); }
        if (q.type === 'categorize') { opts.replaceChildren(); q.cats.forEach((c, i) => { const r = h('div', 'btt-optrow'), n = input(c.name, 'Группа'), it = input(c.items.join(', '), 'Элементы через запятую'); n.addEventListener('input', () => { c.name = n.value; }); it.addEventListener('input', () => { c.items = it.value.split(',').map(x => x.trim()).filter(Boolean); }); r.append(n, it, btn('✖', 'p-small', () => { q.cats.splice(i, 1); drawForm(); })); opts.append(r); }); if (q.cats.length < 4) opts.append(btn('＋ Группа', 'p-small', () => { q.cats.push({name: '', items: []}); drawForm(); })); }
        if (q.type === 'dragdrop') { const di = input((q.distractors || []).join(', '), 'Лишние слова через запятую'); di.addEventListener('input', () => { q.distractors = di.value.split(',').map(x => x.trim()).filter(Boolean); }); opts.append(field('Лишние слова', di, 'Пропуски в тексте отмечайте двойными квадратными скобками: [[слово]].')); }
        if (q.type === 'dropdown') opts.append(h('p', 'p-note', 'Списки в тексте: {{верный|неверный|неверный}} — первый вариант верный, в игре варианты перемешаются.'));
        if (q.type === 'math') { const v = input(q.value, 'Верный ответ, например 3072 или 1/4'), t = input(q.tol, 'Допустимая погрешность'), u = input(q.unit, 'Единицы, например Кбайт'); v.dataset.field = 'q-value'; v.addEventListener('input', () => { q.value = v.value; }); t.addEventListener('input', () => { q.tol = Number(t.value) || 0; }); u.addEventListener('input', () => { q.unit = u.value; }); opts.append(field('Ответ', v), field('Погрешность', t), field('Единицы', u)); }
        if (q.type === 'graph') { const p = input(q.points.map(x => x.join(';')).join('  '), 'Например: 2;3  -4;1'); p.addEventListener('input', () => { q.points = p.value.trim().split(/\s+/).map(s => s.split(';').map(Number)).filter(x => x.length === 2 && x.every(Number.isInteger)); }); opts.append(field('Верные точки (x;y через пробел)', p, 'Координаты — целые от −10 до 10.')); }
        if (q.type === 'label') { opts.replaceChildren(); q.spots.forEach((s, i) => { const r = h('div', 'btt-optrow'), t = input(s.text, 'Подпись'); t.addEventListener('input', () => { s.text = t.value; }); r.append(h('b', '', String(i + 1)), t, btn('✖', 'p-small', () => { q.spots.splice(i, 1); drawForm(); })); opts.append(r); }); }
        if (q.type === 'hotspot') { opts.replaceChildren(); q.spots.forEach((s, i) => { const r = h('div', 'btt-optrow'), rad = h('input'); rad.type = 'range'; rad.min = 2; rad.max = 30; rad.value = s.r; rad.addEventListener('change', () => { s.r = Number(rad.value); drawForm(); }); r.append(h('b', '', `Область ${i + 1}`), rad, btn('✖', 'p-small', () => { q.spots.splice(i, 1); drawForm(); })); opts.append(r); }); }
        if (['open', 'cloud', 'draw', 'slide', 'poll'].includes(q.type)) opts.append(h('p', 'p-note', {open: 'Ответ без автоматической проверки: в отчёте его можно засчитать вручную.', cloud: 'Ответы класса соберутся в облако слов на экране учителя.', draw: 'Ученики рисуют на холсте (картинка вопроса станет фоном). Рисунки — в отчёте.', slide: 'Слайд с объяснением: без ответа, ученик нажимает «Дальше».', poll: 'Опрос без верного ответа: результаты — на экране учителя.'}[q.type]));
        const meta = h('div', 'btt-row'); meta.append(field('Время', time), field('Вес в режиме «Тест»', weight));
        form.append(opts, picBox, meta, field('Пояснение', expl));
        const prev = btn('👁 Как увидит ученик', 'p-small', () => { const pv = h('div', 'btt-preview'); const fake = JSON.parse(JSON.stringify(q)); preview(fake, pv); form.append(pv); }); form.append(prev);
      }
      function preview(q, host) { // упрощённый просмотр: варианты в исходном порядке
        const v = {...q, removed: []}; if (q.type === 'match') { v.left = q.pairs.map(p => p[0]); v.right = q.pairs.map(p => p[1]); } if (q.type === 'categorize') { v.cats = q.cats.map(c => c.name); v.items = q.cats.flatMap(c => c.items); }
        if (q.type === 'dragdrop') { const bl = [...q.text.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]); v.parts = q.text.split(/\[\[[^\]]+\]\]/); v.bank = [...bl, ...(q.distractors || [])]; v.text = ''; }
        if (q.type === 'dropdown') { v.lists = [...q.text.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1].split('|')); v.parts = q.text.split(/\{\{[^}]+\}\}/); v.text = ''; }
        if (q.type === 'label') { v.labels = q.spots.map(s => s.text); } if (q.type === 'graph') v.count = q.points.length;
        B.renderQ(v, host, a => alert('Ответ ученика: ' + JSON.stringify(a).slice(0, 200)));
      }
      const left = h('div', 'btt-edleft'); left.append(listBox, h('h4', '', 'Добавить вопрос'), typeGrid.cloneNode(false)); const addGrid = left.lastChild;
      for (const t of Object.keys(TYPES)) { const b = btn('', 'btt-type small', () => { qz.questions.push(blank(t)); cur = qz.questions.length - 1; drawList(); drawForm(); }); b.dataset.add = t; b.title = TYPES[t]; b.append(h('b', '', TYPE_ICON[t]), h('span', '', TYPES[t])); addGrid.append(b); }
      const head = h('div', 'btt-row'); head.append(field('Название', title), field('Класс', grade), save, btn('← К библиотеке', 'p-small', library));
      const cols = h('div', 'btt-editor'); cols.append(left, form);
      body.replaceChildren(h('h2', '', qz.id ? 'Редактор викторины' : 'Новая викторина'), head, err, cols); drawList(); drawForm();
    }

    /* ---------- запуск игры ---------- */
    function host(q) {
      const st = {timer: true, shuffleQ: true, shuffleOpts: true, showAnswers: true, explain: true, leaderboard: true, memes: true, music: true, powerups: true, redemption: true, streaks: true, readAloud: false, attempts: 1, goal: 80, theme: 'info', teams: 2};
      let mode = 'classic'; const cls = select(classes().map(c => [c, c]), `${ctx.grade} «А»`); cls.dataset.field = 'btt-class';
      const modes = h('div', 'btt-modes'), opts = h('div', 'btt-settings'), extra = h('div', 'btt-extra');
      for (const [k, [t, about]] of Object.entries(MODES)) { const b = btn('', 'btt-mode' + (k === mode ? ' on' : ''), () => { mode = k; modes.querySelectorAll('.btt-mode').forEach(x => x.classList.toggle('on', x === b)); drawExtra(); }); b.dataset.mode = k; b.append(img(ART + 'mode_' + k + '.webp', '', t), h('b', '', t), h('small', '', about)); modes.append(b); }
      const LABELS = {timer: '⏱ Таймер на вопрос', shuffleQ: '🔀 Перемешать вопросы', shuffleOpts: '🔀 Перемешать варианты', showAnswers: '✅ Показывать верный ответ', explain: '💡 Показывать пояснения', leaderboard: '🏆 Таблица лидеров', memes: '😺 Мемы после ответа', music: '♪ Музыка', powerups: '⚡ Усилители', redemption: '🔁 Вопрос-реванш', streaks: '🔥 Бонус за серию', readAloud: '🔊 Читать вопросы вслух всем'};
      for (const [k, t] of Object.entries(LABELS)) { const c = check(t, st[k]); c.box.addEventListener('change', () => { st[k] = c.box.checked; }); c.dataset.set = k; opts.append(c); }
      const att = select([1, 2, 3, 5].map(n => [String(n), n + ' попыт' + (n === 1 ? 'ка' : n < 5 ? 'ки' : 'ок')]), 1); att.addEventListener('change', () => { st.attempts = Number(att.value); }); opts.append(field('Попыток у ученика', att));
      function drawExtra() { extra.replaceChildren();
        if (mode === 'peak') { const goal = h('input'); goal.type = 'range'; goal.min = 30; goal.max = 100; goal.step = 5; goal.value = st.goal; const gl = h('b', '', st.goal + '%'); goal.addEventListener('input', () => { st.goal = Number(goal.value); gl.textContent = goal.value + '%'; });
          const th = h('div', 'btt-themes'); for (const [k, t] of Object.entries(THEMES)) { const b = btn('', 'btt-theme' + (st.theme === k ? ' on' : ''), () => { st.theme = k; th.querySelectorAll('.btt-theme').forEach(x => x.classList.toggle('on', x === b)); }); b.append(img(ART + 'peak_' + k + '.webp', '', t), h('span', '', t)); th.append(b); }
          const gw = h('div', 'btt-row'); gw.append(goal, gl); extra.append(field('Цель точности — вершина', gw, 'Ошибки возвращаются через пару вопросов, пока ученик их не освоит. Каждые 5 ответов — привал с усилителем и мини-игрой.'), h('h4', '', 'Гора'), th); }
        if (mode === 'team') { const tm = select([2, 3, 4].map(n => [String(n), n + ' команды']), st.teams); tm.addEventListener('change', () => { st.teams = Number(tm.value); }); extra.append(field('Сколько команд', tm, 'Ученики распределяются по командам поровну при входе.')); }
        if (mode === 'test') extra.append(h('p', 'p-note', 'В тесте выключены таблица лидеров, мемы, музыка, усилители и серии. Это обычная проверка в браузере, не защищённый экзамен.'));
        if (mode === 'paced') extra.append(h('p', 'p-note', 'Вы ведёте вопросы на проекторе: «Следующий вопрос» — показать, ответ откроется сам, когда все ответят или выйдет время.')); }
      drawExtra();
      const go = btn('🚀 Открыть лобби для класса', 'p-primary big', async () => { try { await API('teacher', {className: cls.value, action: 'open', quiz: q.id, mode, settings: st}); live(cls.value); } catch (e) { alert(e.message); } }); go.dataset.act = 'btt-open';
      body.replaceChildren(h('h2', '', `Играть: «${q.title}»`), field('Класс', cls, 'Все ученики этого класса, у кого открыт практикум, попадут в лобби сами — без кодов и QR.'), h('h3', '', 'Режим'), modes, extra, h('h3', '', 'Настройки — всё бесплатно'), opts, go);
    }

    /* ---------- идущие игры ---------- */
    async function rooms() {
      body.replaceChildren(h('h2', '', 'Игры классов'), h('p', 'p-note', 'Выберите класс, чтобы открыть панель его игры.'));
      const grid = h('div', 'btt-rooms'); body.append(grid);
      for (const c of classes()) { const b = btn(c, 'btt-roomb', () => live(c)); b.dataset.room = c; grid.append(b);
        API('status', {className: c}).then(s => { if (s.open) { b.classList.add('on'); b.textContent = `${c} · ${s.title} · ${s.players} уч.`; } }).catch(() => {}); }
    }

    function live(cls) {
      stop(); tLive.classList.add('on'); tLib.classList.remove('on'); tRep.classList.remove('on');
      const bar = h('div', 'btt-ctl'), screen = h('div', 'btt-screen'), grid = h('div', 'btt-grid'), info = h('div', 'btt-info'); let d = null, lastKey = '';
      const act = async (action, extra = {}) => { try { d = await API('teacher', {className: cls, action, ...extra}); draw(); } catch (e) { if (e.status === 404) { body.replaceChildren(h('h2', '', `${cls}: игра не открыта`), btn('К библиотеке', 'p-primary', () => tLib.click())); stop(); } else info.textContent = e.message; } };
      const mk = (t, a, extra) => { const b = btn(t, 'p-small', () => act(a, extra)); b.dataset.bt = a; return b; };
      const full = btn('⛶ Проектор', 'p-small', () => screen.requestFullscreen?.()); full.dataset.act = 'btt-full';
      body.replaceChildren(bar, info, screen, grid);
      function draw() {
        if (!d || d.phase == null) { body.replaceChildren(h('h2', '', `${cls}: игры нет`), btn('Открыть игру из библиотеки', 'p-primary', () => tLib.click())); stop(); return; }
        bar.replaceChildren(h('b', '', `${cls} · ${d.title} · ${MODES[d.mode][0]}`), h('span', 'btt-phase', {lobby: 'лобби', live: d.paused ? 'пауза' : 'идёт', ended: 'окончена'}[d.phase]));
        if (d.phase === 'lobby') bar.append(mk('▶ Начать', 'start'));
        if (d.phase === 'live') { bar.append(d.paused ? mk('▶ Продолжить', 'pause', {on: false}) : mk('⏸ Пауза', 'pause', {on: true})); if (d.mode === 'paced') bar.append(mk(d.paced && !d.paced.reveal ? 'Показать ответ' : 'Следующий вопрос ▶', 'next')); bar.append(mk('■ Завершить', 'end')); }
        if (d.phase === 'ended') { if (d.result) bar.append(btn('📈 Отчёт', 'p-primary', () => { stop(); report(d.result); })); }
        bar.append(full, btn('✖ Закрыть игру', 'p-small', async () => { if (confirm('Закрыть игру? Если она идёт, итоги сохранятся в отчёт.')) { await act('close'); stop(); library(); tLib.click(); } }));
        info.textContent = d.events && d.events.length ? '📣 ' + d.events[d.events.length - 1] : '';
        drawScreen(); drawGrid(); }
      function drawScreen() {
        const key = JSON.stringify([d.phase, d.paused, d.board.map(x => [x.name, x.score, x.mastery]), d.paced, d.teams, d.players.length, d.titles, Object.values(d.clouds || {}).map(x => x.length)]); if (key === lastKey) { const t = screen.querySelector('.btt-left'); if (t && d.paced && d.paced.left != null) t.textContent = Math.ceil(d.paced.left) + ' с'; return; } lastKey = key;
        screen.replaceChildren(); screen.dataset.phase = d.phase; screen.dataset.mode = d.mode;
        if (d.phase === 'lobby') { screen.append(img(ART + 'lobby_bg.webp', 'btt-bg', ''), h('h1', 'btt-big', d.title), h('p', 'btt-sub', `${cls} · ${MODES[d.mode][0]} · ученики входят из практикума сами`), h('div', 'btt-count', String(d.players.length)));
          const names = h('div', 'btt-names'); for (const p of d.players) { const n = h('span'); n.append(img(climber(p.avatar), '', ''), document.createTextNode(p.short)); names.append(n); } screen.append(names); return; }
        if (d.mode === 'paced' && d.paced && d.phase === 'live') { const p = d.paced, q = p.q, grid2 = h('div', 'btt-popts');
          screen.append(h('p', 'p-eyebrow', `ВОПРОС ${p.n} ИЗ ${p.total} · ОТВЕТИЛИ ${p.answered} ИЗ ${d.players.length}`), h('h1', 'btt-q', q.text || (q.parts || []).join(' ___ ')));
          if (q.image) screen.append(img(q.image, 'btt-qimg', ''));
          if (q.options) q.options.forEach((o, i) => { const c = h('div', 'btt-popt' + (p.reveal && p.solution != null ? ((q.type === 'single' ? i === p.solution : (p.solution || []).includes(i)) ? ' right' : ' dim') : '')); c.style.background = COLORS[i % 8]; c.append(h('span', '', SHAPES[i % 8]), h('span', '', o)); if (p.counts) c.append(h('b', '', String(p.counts[i]))); grid2.append(c); });
          screen.append(grid2); if (!p.reveal) screen.append(h('b', 'btt-left', Math.ceil(p.left || 0) + ' с'));
          if (p.reveal) { if (p.solution != null && !q.options) screen.append(h('p', 'btt-sol', 'Верно: ' + B.solText(q, p.solution))); if (p.explain) screen.append(h('p', 'btt-sub', p.explain)); if (p.words) screen.append(cloud(p.words)); screen.append(board()); }
          return; }
        if (d.mode === 'peak') { const m = h('div', 'btt-mountain'); m.append(img(ART + 'peak_' + d.settings.theme + '.webp', '', 'гора'));
          const goal = h('div', 'bt2-goal', `цель ${d.settings.goal}%`); goal.style.bottom = (6 + 0.84 * d.settings.goal) + '%'; m.append(goal);
          d.players.forEach((p, i) => { const c = h('div', 'btt-climber'); const v = p.mastery || 0; c.style.bottom = (6 + 0.84 * v) + '%'; c.style.left = (10 + (i * 37) % 80) + '%'; c.append(img(climber(p.avatar), '', ''), h('span', '', `${p.short} ${v}%`)); if (p.brk) c.classList.add('rest'); m.append(c); });
          const tiers = h('div', 'btt-tiers'); for (let t = 3; t >= 0; t--) { const col = h('div'); col.append(img(ART + 'tier_' + t + '.webp', '', TIERS[t]), h('b', '', TIERS[t])); for (const p of d.players.filter(x => x.tier === t)) col.append(h('span', '', `${p.short} · ${p.mastery}%`)); tiers.append(col); }
          screen.append(m, tiers); if (d.titles && d.titles.length) { const tl = h('div', 'bt2-titles'); for (const t of d.titles) { const c = h('div'); c.append(h('b', '', t.title), h('span', '', t.name)); tl.append(c); } screen.append(tl); } return; }
        if (d.teams) { const ol = h('ol', 'bt2-teams big'); const mx = Math.max(1, ...d.teams.map(t => t.score)); for (const t of d.teams) { const li = h('li'); li.style.setProperty('--w', (100 * t.score / mx) + '%'); li.style.setProperty('--c', t.color); li.append(h('b', '', `${t.name} (${t.size})`), h('span', '', String(t.score))); ol.append(li); } screen.append(h('h2', '', 'Команды'), ol); }
        screen.append(h('h2', '', d.phase === 'ended' ? '🏆 Итоги' : 'Таблица лидеров'), board());
        for (const [qid, words] of Object.entries(d.clouds || {})) if (words.length) screen.append(cloud(words));
      }
      const board = () => { const ol = h('ol', 'btt-board'); for (const b of d.board) { const li = h('li'); li.append(img(climber(b.avatar), '', ''), h('span', '', b.name), h('b', '', String(b.score)), h('small', '', b.mastery != null ? `${b.mastery}%` : `${b.acc}%`)); ol.append(li); } return ol; };
      const cloud = words => { const freq = {}; for (const w of words) if (w != null && w !== '') { const k = String(w).toLowerCase(); freq[k] = (freq[k] || 0) + 1; } const c = h('div', 'btt-cloud'); const mx = Math.max(1, ...Object.values(freq)); for (const [w, n] of Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 40)) { const s = h('span', '', w); s.style.fontSize = (16 + 30 * n / mx) + 'px'; s.style.color = COLORS[w.length % 8]; c.append(s); } return c; };
      function drawGrid() {
        if (d.phase === 'lobby' && !d.players.length) { grid.replaceChildren(); return; }
        const t = h('table', 'btt-table'), hr = h('tr'); hr.append(h('th', '', 'Ученик'), h('th', '', 'Очки'), h('th', '', d.mode === 'peak' ? 'Освоено' : 'Точность'));
        d.qstats.forEach((q, i) => { const th = h('th', 'q', String(i + 1)); th.title = `${TYPES[q.type]}: ${q.text}${q.acc != null ? ` · верно ${q.acc}%` : ''}`; if (q.acc != null) th.style.background = q.acc >= 70 ? '#1f5a45' : q.acc >= 40 ? '#5a4a1f' : '#5a1f2a'; hr.append(th); });
        hr.append(h('th', '', 'Особые условия')); t.append(hr);
        for (const p of d.players) { const tr = h('tr', p.online ? '' : 'off'); const nm = h('td', 'nm'); nm.append(img(climber(p.avatar), '', ''), document.createTextNode(p.name + (p.done ? ' ✔' : '') + (p.brk ? ' ⛺' : ''))); tr.append(nm, h('td', '', String(p.score)), h('td', '', (p.mastery != null ? p.mastery : p.acc) + '%'));
          for (const c of p.cells) tr.append(h('td', 'c ' + (c == null ? '' : c === 'u' ? 'u' : c >= 1 ? 'ok' : c > 0 ? 'part' : 'bad'), c == null ? '' : c === 'u' ? '•' : c >= 1 ? '✓' : c > 0 ? '½' : '✗'));
          const acc = h('td', 'acc'); for (const [k, t2, tip] of [['extra', '⏱×2', 'двойное время'], ['reduce', '✂', 'на один вариант меньше'], ['read', '🔊', 'читать вслух']]) { const b = btn(t2, 'btt-acc' + (p.accs[k === 'extra' ? 'extra' : k] && (k !== 'extra' || p.accs.extra > 1) ? ' on' : ''), () => act('acc', {key: p.name, acc: {extra: k === 'extra' ? !(p.accs.extra > 1) : p.accs.extra > 1, reduce: k === 'reduce' ? !p.accs.reduce : p.accs.reduce, read: k === 'read' ? !p.accs.read : p.accs.read}})); b.title = tip; acc.append(b); }
          acc.append(btn('✖', 'btt-acc', () => { if (confirm(`Убрать ${p.name} из игры?`)) act('kick', {key: p.name}); })); tr.append(acc); t.append(tr); }
        grid.replaceChildren(h('h3', '', `Ученики: ${d.players.length} · в сети ${d.players.filter(p => p.online).length}`), t);
      }
      act('screen'); timer = setInterval(() => act('screen'), 1200);
    }

    /* ---------- отчёты ---------- */
    async function reports() {
      body.replaceChildren(h('p', 'p-note', 'Загружаем отчёты…'));
      let d; try { d = await API('results'); } catch (e) { body.replaceChildren(h('p', 'p-note', e.message)); return; }
      const t = h('table', 'btt-table rep'), hr = h('tr'); for (const x of ['Дата', 'Класс', 'Викторина', 'Режим', 'Учеников', 'Средняя точность', '']) hr.append(h('th', '', x)); t.append(hr);
      for (const r of d.results) { const tr = h('tr'); tr.append(h('td', '', fmtDate(r.ended)), h('td', '', r.cls), h('td', '', r.title), h('td', '', MODES[r.mode][0]), h('td', '', String(r.players)), h('td', '', r.acc + '%'));
        const o = btn('Открыть', 'p-small', () => report(r.id)); o.dataset.report = r.id; const td = h('td'); td.append(o); tr.append(td); t.append(tr); }
      body.replaceChildren(h('h2', '', 'Отчёты об играх'), d.results.length ? t : h('p', 'p-note', 'Отчётов пока нет: они появляются, когда игра завершена.'));
    }

    async function report(id) {
      tRep.classList.add('on'); tLive.classList.remove('on'); tLib.classList.remove('on');
      const r = (await API('result', {id})).result, qs = r.quiz.questions, ps = r.players;
      const avg = ps.length ? Math.round(ps.reduce((s, p) => s + p.acc, 0) / ps.length) : 0;
      const qacc = qs.map(q => { const fr = ps.map(p => p.answers[q.id]).filter(a => a && a.tries && a.tries[0].frac != null).map(a => a.tries[0].frac); return fr.length ? Math.round(100 * fr.reduce((a, b) => a + b, 0) / fr.length) : null; });
      const hardest = qacc.reduce((m, v, i) => v != null && (m < 0 || v < qacc[m]) ? i : m, -1);
      const cards = h('div', 'btt-cards'); for (const [k, v] of [['Учеников', ps.length], ['Средняя точность', avg + '%'], ['Вопросов', qs.length], ['Самый трудный', hardest >= 0 ? `№${hardest + 1} (${qacc[hardest]}%)` : '—']]) { const c = h('div'); c.append(h('b', '', String(v)), h('small', '', k)); cards.append(c); }
      const qt = h('table', 'btt-table'), qh = h('tr'); for (const x of ['№', 'Тип', 'Вопрос', 'Верно с первой попытки']) qh.append(h('th', '', x)); qt.append(qh);
      qs.forEach((q, i) => { const tr = h('tr'), bar = h('td', 'bar'); if (qacc[i] != null) { const b2 = h('i'); b2.style.width = qacc[i] + '%'; b2.style.background = qacc[i] >= 70 ? '#3ad29f' : qacc[i] >= 40 ? '#ffc94d' : '#ff6b6b'; bar.append(b2, h('span', '', qacc[i] + '%')); } else bar.textContent = 'без оценки'; tr.append(h('td', '', String(i + 1)), h('td', '', TYPE_ICON[q.type] + ' ' + TYPES[q.type]), h('td', '', (q.text || '').slice(0, 120)), bar); qt.append(tr); });
      const st = h('table', 'btt-table'), sh = h('tr'); for (const x of ['Ученик', 'Очки', 'Точность', ...(r.mode === 'peak' ? ['Освоено', 'Вершина', 'Исправил ошибок'] : []), ...(r.mode === 'team' ? ['Команда'] : []), 'Лучшая серия', ...qs.map((_, i) => String(i + 1))]) sh.append(h('th', '', x)); st.append(sh);
      for (const p of [...ps].sort((a, b) => b.score - a.score)) { const tr = h('tr'); tr.append(h('td', 'nm', p.name), h('td', '', String(p.score)), h('td', '', p.acc + '%'));
        if (r.mode === 'peak') tr.append(h('td', '', p.mastery + '%'), h('td', '', p.summit ? '🏔' : ''), h('td', '', String(p.reattempts))); if (r.mode === 'team') tr.append(h('td', '', p.team));
        tr.append(h('td', '', String(p.best_streak)));
        for (const q of qs) { const a = p.answers[q.id], f = a ? (a.teacher != null ? (a.teacher ? 1 : 0) : a.frac) : undefined; const td = h('td', 'c ' + (a == null ? '' : f == null ? 'u' : f >= 1 ? 'ok' : f > 0 ? 'part' : 'bad'), a == null ? '' : f == null ? '•' : f >= 1 ? '✓' : f > 0 ? '½' : '✗'); if (a) td.title = a.text + (a.tries.length > 1 ? ` · попыток ${a.tries.length}` : ''); tr.append(td); }
        st.append(tr); }
      const gallery = h('div', 'btt-gallery');
      qs.forEach((q, i) => { if (!['open', 'cloud', 'draw', 'poll'].includes(q.type)) return; const box = h('div', 'btt-gq'); box.append(h('h4', '', `№${i + 1}. ${TYPES[q.type]}: ${q.text}`));
        for (const p of ps) { const a = p.answers[q.id]; if (!a) continue; const c = h('div', 'btt-ans'); c.append(h('b', '', p.name)); if (a.draw) c.append(img(a.draw, 'btt-drawing', 'рисунок')); else c.append(h('span', '', a.text));
          if (q.type === 'open') { const ok = btn('✓ Засчитать', 'p-small' + (a.teacher === true ? ' on' : ''), async () => { await API('mark', {id, name: p.name, q: q.id, ok: true}); report(id); }), no = btn('✗', 'p-small' + (a.teacher === false ? ' on' : ''), async () => { await API('mark', {id, name: p.name, q: q.id, ok: false}); report(id); }); c.append(ok, no); }
          box.append(c); } gallery.append(box); });
      const csv = btn('⬇ Таблица CSV (Excel)', 'p-small', () => { const rows = [['Ученик', 'Очки', 'Точность %', 'Освоено %', 'Команда', ...qs.map((q, i) => `${i + 1}. ${(q.text || TYPES[q.type]).slice(0, 40)}`)]];
        for (const p of ps) rows.push([p.name, p.score, p.acc, p.mastery ?? '', p.team || '', ...qs.map(q => { const a = p.answers[q.id]; return a ? (a.teacher != null ? (a.teacher ? 'верно' : 'неверно') : a.frac == null ? a.text : Math.round(100 * a.frac) + '%') : ''; })]);
        const cell = v => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : String(v)).replace(/"/g, '""');   // ответ «=HYPERLINK(…)» Excel не примет за формулу
        const text = '﻿' + rows.map(r2 => r2.map(v => `"${cell(v)}"`).join(';')).join('\r\n'); const a = h('a'); a.href = URL.createObjectURL(new Blob([text], {type: 'text/csv'})); a.download = `${r.cls} ${r.title}.csv`.replace(/[\\/:*?"<>|]/g, '_'); a.click(); });
      const del = btn('🗑 Удалить отчёт', 'p-small', async () => { if (confirm('Удалить этот отчёт?')) { await API('dropresult', {id}); reports(); } });
      const titles = h('div', 'bt2-titles'); for (const t of r.titles || []) { const c = h('div'); c.append(h('b', '', t.title), h('span', '', t.name)); titles.append(c); }
      const head = h('div', 'btt-row'); head.append(btn('← Все отчёты', 'p-small', reports), csv, btn('🖨 Печать', 'p-small', () => print()), del);
      body.replaceChildren(head, h('h2', '', `${r.title} · ${r.cls} · ${MODES[r.mode][0]}`), h('p', 'p-note', `${fmtDate(r.started)} — ${fmtDate(r.ended)}. Отметки в журнал не отправляются.`), cards, ...(r.titles && r.titles.length ? [titles] : []), h('h3', '', 'Вопросы'), qt, h('h3', '', 'Ученики'), st, ...(gallery.childNodes.length ? [h('h3', '', 'Ответы без автоматической проверки'), gallery] : []));
    }

    tLib.click();
    return {live, report};
  }
  window.BattleTeach = {teacher, stop};
})();
