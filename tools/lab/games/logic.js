// «Лаборатория логики»: таблицы истинности, равносильные выражения (законы алгебры логики), подсчёт истинных строк
// и логические задачи (8 класс §2.2–2.3, 10 класс §18–20, 22). Выражения записаны знаками ¬ ∧ ∨ → ≡, расшифровка — в подсказке.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1)), pick = (r, a) => a[Math.floor(r() * a.length)], shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Выражения: строки со знаками; вычисляются разбором (приоритет ¬, ∧, ∨, →, ≡).
  function ev(src, env) {
    const t = src.replace(/\s+/g, ''); let p = 0;
    const eq = () => { let a = imp(); while (t[p] === '≡') { p++; const b = imp(); a = a === b ? 1 : 0; } return a; };
    const imp = () => { const a = or(); if (t[p] === '→') { p++; const b = imp(); return !a || b ? 1 : 0; } return a; };
    const or = () => { let a = and(); while (t[p] === '∨') { p++; const b = and(); a = a || b ? 1 : 0; } return a; };
    const and = () => { let a = not(); while (t[p] === '∧') { p++; const b = not(); a = a && b ? 1 : 0; } return a; };
    const not = () => { if (t[p] === '¬') { p++; return not() ? 0 : 1; } if (t[p] === '(') { p++; const v = eq(); p++; return v; } const c = t[p++]; if (!(c in env)) throw new Error('неизвестная переменная ' + c); return env[c]; };
    return eq();
  }
  const varsOf = s => [...new Set(s.match(/[A-D]/g))].sort();
  const rows = vs => Array.from({length: 1 << vs.length}, (_, k) => Object.fromEntries(vs.map((v, i) => [v, (k >> (vs.length - 1 - i)) & 1])));
  const table = s => rows(varsOf(s)).map(env => ev(s, env));
  const equal = (a, b) => { const vs = [...new Set([...varsOf(a), ...varsOf(b)])].sort(); return rows(vs).every(env => ev(a, env) === ev(b, env)); };
  /* ---------- генераторы серий ---------- */
  const LAWS = [['¬(A∧B)', '¬A∨¬B'], ['¬(A∨B)', '¬A∧¬B'], ['A→B', '¬A∨B'], ['A∧(A∨B)', 'A'], ['A∨(A∧B)', 'A'], ['A∧(B∨C)', '(A∧B)∨(A∧C)'], ['A∨(B∧C)', '(A∨B)∧(A∨C)'], ['¬¬A∧B', 'A∧B'], ['A≡B', '(A→B)∧(B→A)'], ['¬(A→B)', 'A∧¬B'], ['A∨¬A∧B', 'A∨B'], ['(A→B)∧(A→C)', 'A→B∧C']];
  const DISTRACT = ['¬A∧¬B', '¬A∨B', 'A∨B', 'A∧B', '¬A∧B', 'A∧¬B', 'B→A', '¬B∨A', '(A∨B)∧C', 'A∨C', 'A∧B∨C', '¬(A∧B)', 'A≡¬B', 'A'];
  const RAND = (r, vs, depth) => { if (depth <= 0 || r() < 0.25) return (r() < 0.25 ? '¬' : '') + pick(r, vs); const op = pick(r, ['∧', '∨', '→', '≡', '∧', '∨']); const a = RAND(r, vs, depth - 1), b = RAND(r, vs, depth - 1); return (r() < 0.2 ? '¬' : '') + `(${a}${op}${b})`; };
  const SER = {
    equiv(r, laws) { const [a, b] = pick(r, laws), flip = r() < 0.5, given = flip ? b : a, right = flip ? a : b, opts = shuffle(r, DISTRACT.filter(d => !equal(d, given))).slice(0, 3); const choices = shuffle(r, [right, ...opts]);
      return {kind: 'choice', text: `Какое выражение равносильно выражению ${given}?`, choices, answer: right, explain: `Таблицы истинности ${given} и ${right} совпадают на всех строках — это закон алгебры логики.`}; },
    count(r, n) { for (;;) { const vs = 'ABCD'.slice(0, n).split(''), e = RAND(r, vs, n === 3 ? 2 : 3).replace(/^\((.*)\)$/, '$1'); if (varsOf(e).length !== n) continue; const k = table(e).reduce((s, x) => s + x, 0); if (k === 0 || k === 1 << n) continue;
      return {kind: 'num', text: `Для скольких наборов значений переменных ${vs.join(', ')} выражение ${e} истинно?`, answer: String(k), explain: `В таблице истинности ${1 << n} строк; значение 1 получается в ${k} из них.`}; } },
    puzzle(r) { const names = ['Аня', 'Боря', 'Вика'], acts = ['разбил окно', 'съел пирог', 'спрятал мяч', 'сломал робота'], act = pick(r, acts);
      for (;;) { const says = names.map(n => { const o = names.filter(x => x !== n), t = ri(r, 0, 2); return t === 0 ? [`это не я`, c => c !== n] : t === 1 ? (() => { const y = pick(r, o); return [`это ${y}`, c => c === y]; })() : (() => { const y = pick(r, o); return [`это не ${y}`, c => c !== y]; })(); });
        const truth = pick(r, [1, 2]), fit = names.filter(c => says.filter(s => s[1](c)).length === truth); if (fit.length !== 1) continue;
        return {kind: 'choice', text: `Кто-то из троих ${act}. Каждый сказал:\n${names.map((n, i) => `${n}: «${says[i][0][0].toUpperCase() + says[i][0].slice(1)}».`).join('\n')}\nИзвестно, что правду сказал${truth === 1 ? ' ровно один' : 'и ровно двое'}. Кто ${act}?`, choices: names, answer: fit[0], explain: `Перебираем: если виноват ${fit[0]}, правдивы ровно ${truth} из утверждений; при других вариантах число правдивых не совпадает.`}; } },
  };
  const L = o => o;
  const LEVELS = [
    L({kind: 'table', title: 'Таблица: И и НЕ', expr: 'A∧¬B'}),
    L({kind: 'table', title: 'Таблица: ИЛИ и НЕ', expr: '¬A∨B'}),
    L({kind: 'table', title: 'Три переменные', expr: '(A∨B)∧¬C'}),
    L({kind: 'table', title: 'Отрицание конъюнкции', expr: '¬(A∧B)∨C', young: true}),
    L({kind: 'table', title: 'Импликация', expr: 'A→B', old: true}),
    L({kind: 'table', title: 'Эквивалентность', expr: '(A→B)∧(B→A)', old: true}),
    L({kind: 'series', title: 'Законы де Моргана', gen: r => SER.equiv(r, LAWS.slice(0, 2).concat([LAWS[7]]))}),
    L({kind: 'series', title: 'Равносильные выражения', gen: r => SER.equiv(r, LAWS.slice(3, 7).concat(LAWS.slice(10))), young: true}),
    L({kind: 'series', title: 'Импликация и эквивалентность', gen: r => SER.equiv(r, [LAWS[2], LAWS[8], LAWS[9], LAWS[11]]), old: true}),
    L({kind: 'series', title: 'Сколько истинных строк (3 переменные)', gen: r => SER.count(r, 3)}),
    L({kind: 'series', title: 'Сколько истинных строк (4 переменные)', gen: r => SER.count(r, 4), old: true}),
    L({kind: 'series', title: 'Кто это сделал?', gen: r => SER.puzzle(r)}),
  ];
  const problems = (lv, seed) => { const r = rng(seed * 59 + LEVELS.indexOf(lv) * 13); return [0, 1, 2].map(() => lv.gen(r)); };
  const norm = s => String(s).trim().replace(/\s+/g, '');
  function check(lv, ans) {
    if (lv.kind === 'table') { const want = table(lv.expr); if (!ans || !Array.isArray(ans.cells) || ans.cells.length !== want.length) return {ok: false, msg: 'Заполни весь столбец.'}; const bad = want.filter((x, i) => ans.cells[i] !== x).length; return bad ? {ok: false, bad, msg: `Ошибок в столбце: ${bad}.`} : {ok: true, stars: 3, msg: 'Таблица истинности верна.'}; }
    if (!ans || !Number.isInteger(ans.seed) || !Array.isArray(ans.answers) || ans.answers.length !== 3) return {ok: false, msg: 'Ответь на все три задания.'};
    const good = problems(lv, ans.seed).filter((p, i) => norm(ans.answers[i]) === norm(p.answer)).length; return good ? {ok: true, stars: good, msg: `Верно: ${good} из 3.`} : {ok: false, msg: 'Ни одного верного ответа — разбери решения и попробуй снова.'};
  }
  const LEGEND = '¬ — НЕ (инверсия), ∧ — И (конъюнкция), ∨ — ИЛИ (дизъюнкция), → — импликация («если…, то…»), ≡ — эквивалентность. Порядок: скобки, ¬, ∧, ∨, →, ≡.';
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'), box = el('div', 'lab-panel og-box'); let tries = 0;
    task.append(el('h2', '', lv.title), el('p', 'lab-note', LEGEND)); host.append(task, box);
    if (lv.kind === 'table') {
      const vs = varsOf(lv.expr), rs = rows(vs), cells = rs.map(() => null), t = el('table', 'lab-table lg-table');
      const draw = () => { const h = el('tr'); for (const v of vs) h.append(el('th', '', v)); h.append(el('th', 'lg-f', lv.expr)); t.replaceChildren(h);
        rs.forEach((env, i) => { const tr = el('tr'); for (const v of vs) tr.append(el('td', '', String(env[v]))); const c = button(cells[i] == null ? '?' : String(cells[i]), 'lg-cell' + (cells[i] == null ? '' : cells[i] ? ' one' : ' zero'), () => { cells[i] = cells[i] == null ? 1 : 1 - cells[i]; draw(); }); const td = el('td'); td.append(c); tr.append(td); t.append(tr); }); };
      const go = button('Проверить таблицу', 'lab-main', () => { tries++; const r = check(lv, {cells}); msg.textContent = r.msg; msg.className = 'lab-msg ' + (r.ok ? 'good' : 'bad'); if (r.ok) api.finish(tries === 1 ? 3 : tries <= 3 ? 2 : 1, r.msg); }); go.dataset.act = 'run';
      box.append(el('p', '', `Заполни последний столбец: щёлкай по клетке, чтобы поставить 1 или 0. Строки идут по порядку двоичных чисел.`), t, go, msg); draw();
      if (api.debugHost) window.labSet = a => { a.cells.forEach((x, i) => { cells[i] = x; }); draw(); };
      return;
    }
    let seed = Math.floor(Math.random() * 1e6), ps = problems(lv, seed), k = 0, answers = [], forced = null; const dots = el('div', 'og-dots'); box.before(dots);
    const paint = () => dots.replaceChildren(...[0, 1, 2].map(i => el('i', i < answers.length ? (norm(answers[i]) === norm(ps[i].answer) ? 'good' : 'bad') : i === k ? 'now' : '')));
    function show() { paint();
      if (k >= 3) { const r = check(lv, {seed, answers}); if (r.ok) api.finish(r.stars, r.msg); else { box.replaceChildren(el('p', 'lab-msg bad', r.msg), button('Новые задания', 'lab-main', () => { seed++; ps = problems(lv, seed); k = 0; answers = []; show(); })); } return; }
      const p = ps[k], area = el('div', 'og-w'), give = a => { if (forced) { const r = check(lv, forced); if (r.ok) api.finish(r.stars, r.msg); return; } if (!String(a).trim()) return; answers.push(String(a)); const ok = norm(a) === norm(p.answer); k++; paint(); for (const b of area.querySelectorAll('button')) b.disabled = true;
        msg.className = 'lab-msg ' + (ok ? 'good' : 'bad'); msg.textContent = (ok ? 'Верно! ' : `Неверно, правильный ответ: ${p.answer}. `) + p.explain; const next = button(k < 3 ? 'Дальше →' : 'Итог', 'lab-main', show); area.after(next); next.focus(); };
      if (p.kind === 'choice') { const opts = el('div', 'lg-opts'); for (const c of p.choices) { const b = button(c, 'lg-opt', () => give(c)); b.dataset.act = 'run'; opts.append(b); } area.append(opts); }
      else { const form = el('form', 'og-form'), inp = el('input'); inp.setAttribute('aria-label', 'Ответ'); inp.inputMode = 'numeric'; const go = button('Ответить', 'lab-main', () => form.requestSubmit()); go.dataset.act = 'run'; form.append(el('span', '', 'Ответ:'), inp, go); form.addEventListener('submit', e => { e.preventDefault(); give(inp.value); }); area.append(form); setTimeout(() => inp.focus(), 50); }
      box.replaceChildren(el('p', 'lab-eyebrow', `ЗАДАНИЕ ${k + 1} ИЗ 3`), el('p', 'og-text lg-q', p.text), area, msg); msg.textContent = ''; msg.className = 'lab-msg'; }
    show(); if (api.debugHost) window.labSet = a => { forced = a; };
  }
  LAB.register({id: 'logic', bg: 'bg_logic', hero: 'host_wizard', title: 'Лаборатория логики', genre: 'алгебра логики', art: '⚖️', color: '#c38bff', unit: 'Задание', minutes: 40,
    about: 'Заполняй таблицы истинности, находи равносильные выражения по законам логики, считай истинные строки и раскрывай логические загадки «кто это сделал?».',
    levels: grade => LEVELS.filter(l => grade <= 9 ? !l.old : !l.young), mount, check,
    solve: lv => lv.kind === 'table' ? {cells: table(lv.expr)} : {seed: 1, answers: problems(lv, 1).map(p => p.answer)}, LEVELS, problems, ev, equal, table});
})();
