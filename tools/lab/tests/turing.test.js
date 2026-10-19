// «Машина Тьюринга» без браузера: образцы на всех лентах, нужность каждой команды, неверные программы, зацикливание, звёзды и экран на мини-DOM.
// Запуск: node tools/lab/tests/turing.test.js
const path = require('path'), dir = path.join(__dirname, '..');
require(path.join(dir, 'core.js')); require(path.join(dir, 'games', 'turing.js'));
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };
const g = LAB.games.find(x => x.id === 'turing'), L = g.LEVELS, P = g.parseRef, by = t => L.find(l => l.title === t);
// Классы: в 10 классе первые восемь задач, в 11 — все двенадцать (младшим классам оболочка тоже показывает восемь).
{ const t10 = g.levels(10).map(l => l.title), t11 = g.levels(11).map(l => l.title);
  check(`классы: 10 — ${t10.length} задач (первые восемь из 11 класса), 11 — ${t11.length}, названия разные`, t10.length === 8 && t11.length === 12 && t10.every((t, i) => t === t11[i]) && [6, 7, 8, 9].every(gr => g.levels(gr).length === 8) && new Set(t11).size === 12 && t11.every(Boolean), t10.join(', ')); }
// Образцы: проходят все ленты на три звезды, норма = размер образца; лент не меньше шести, есть пустая или однобуквенная, у вопросов есть и «Да», и «Нет».
{ let ok = true, info = '';
  for (const [i, lv] of L.entries()) { const r = g.check(lv, g.solve(lv)), ins = lv.tapes.map(t => t.input), outs = lv.tapes.map(t => String(t.want));
    if (!r.ok || r.stars !== 3) { ok = false; info = `задача ${i + 1}: ${JSON.stringify(r).slice(0, 120)}`; }
    if (JSON.stringify(g.size(lv.refProg)) !== JSON.stringify(lv.par) || lv.par.states > 9) { ok = false; info = `задача ${i + 1}: норма не совпадает с образцом`; }
    if (ins.length < 6 || new Set(ins).size !== ins.length || !ins.some(w => w.length <= 1) || !ins.every(w => [...w].every(c => lv.abc.includes(c)))) { ok = false; info = `задача ${i + 1}: плохой набор лент ${ins.join(',')}`; }
    if (lv.ask ? new Set(outs).size !== 2 : lv.title !== 'Стереть слово' && new Set(outs).size < 3) { ok = false; info = `задача ${i + 1}: ответы лент почти одинаковые`; } }
  check('образцы всех 12 задач проходят все ленты на три звезды; ленты с крайними случаями, у вопросов оба ответа', ok, info || L.map(l => `${l.par.states}/${l.par.rules}`).join(' ')); }
// Каждая команда образца нужна: без любой из них хотя бы одна лента не проходит — значит, ленты покрывают все случаи.
{ let ok = true, info = '', n = 0;
  for (const [i, lv] of L.entries()) for (const k of Object.keys(lv.refProg)) { const p = g.solve(lv); delete p[k]; n++; if (g.check(lv, p).ok) { ok = false; info = `задача ${i + 1}: без команды ${k} всё равно проходит`; } }
  check(`без любой из ${n} команд образцов задача не решается`, ok, info); }
// Норма точная для простых задач: перебор всех таблиц на одну команду короче (не больше состояний, чем у образца) — ни одна не проходит.
{ let ok = true, info = '', tried = 0;
  for (const lv of L.filter(l => l.par.rules <= 4)) { const C = [...lv.abc, '_'], keys = [], opts = []; for (let q = 1; q <= lv.par.states; q++) for (const s of C) keys.push(q + '|' + s);
    for (const w of C) for (const m of 'LRN') for (const nx of [lv.ask ? 'Y' : 0, ...(lv.ask ? ['N'] : []), ...Array.from({length: lv.par.states}, (_, k) => k + 1)]) opts.push([w, m, nx]);
    const good = prog => lv.tapes.every(t => { const r = g.run(lv, prog, t.input, 200); return !r.error && (lv.num ? /^[01]+$/.test(r.word) && parseInt(r.word, 2) === parseInt(t.want, 2) : r.word === t.want); });
    const rec = (from, prog, left) => { if (!ok) return; if (Object.keys(prog).length) { tried++; if (good(prog)) { ok = false; info = `«${lv.title}»: короче образца — ${JSON.stringify(prog)}`; return; } } if (!left) return;
      for (let k = from; k < keys.length; k++) for (const o of opts) { prog[keys[k]] = o; rec(k + 1, prog, left - 1); delete prog[keys[k]]; } };
    rec(0, {}, lv.par.rules - 1); }
  check(`задачи 1–4: короче образца решения нет (перебрано ${tried} таблиц)`, ok, info); }
// Типичные неверные программы не проходят.
{ const wrong = [
    ['Ещё одна палочка', ['1:1N0 _:1N0'], 'палочка записана поверх первой'], ['Инверсия', ['0:1R1 1:1R1 _:_N0'], 'все символы стали единицами'], ['Стереть слово', ['a:_R1 b:_R1 _:_N0'], 'головка идёт вправо от последней буквы'],
    ['Сложение палочек', ['1:1R1 +:1N0'], 'плюс заменён палочкой, лишняя не стёрта'], ['Чётность единиц', ['0:0R1 1:1R1 _:_NY'], 'всегда «Да»'], ['Двоичное +1', ['0:0R1 1:1R1 _:_L2', '0:1N0 1:0N0'], 'без переноса'],
    ['Двоичное −1', ['0:0R1 1:1R1 _:_L2', '0:1N0 1:0N0'], 'без заёма'], ['Скобки', ['(:(R2 ):)NN _:_NY', '(:(R2 ):)R2 _:_L3', '):)NY (:(NN'], 'смотрит только на первую и последнюю скобку'],
    ['Сортировка', ['a:aR1 b:bR2 _:_N0', 'b:bR2 a:bL3 _:_N0', 'b:aR2'], 'один проход без возврата'], ['Удвоение палочек', ['1:1R1 _:1N0'], 'дописана одна палочка'],
    ['Палиндром', ['a:_R2 b:_R4 _:_NY', 'a:aR2 b:bR2 _:_L3', 'a:aNY b:bNN _:_NY', 'a:aR4 b:bR4 _:_L5', 'b:bNY a:aNN _:_NY'], 'сравнивает только крайние буквы'], ['Копия слова', ['a:aR1 b:bR1 _:*N0'], 'только звёздочка']];
  const passed = wrong.filter(([t, rows]) => g.check(by(t), P(rows)).ok).map(w => w[0] + ' (' + w[2] + ')');
  const empty = g.check(L[0], {}), bin = g.check(by('Двоичное +1'), P(['0:0R1 1:1R1 _:_L2', '0:1N0 1:0N0']));
  check('неверные программы (12 типичных ошибок) и пустая таблица не проходят, ошибка показывает ленту', !passed.length && !empty.ok && /пуста/.test(empty.msg) && /^Лента 2 \(«1»\): на ленте «0», а нужно «10» \(ведущие нули не важны\)\.$/.test(bin.msg), passed.join('; ') || bin.msg); }
// Зацикливание: машина останавливается после 2000 шагов с понятным сообщением; нет команды — сообщение называет состояние и символ.
{ const lv = L[0], loop = g.check(lv, {'1|1': ['1', 'R', 1], '1|_': ['_', 'R', 1]}), still = g.run(lv, {'1|_': ['_', 'N', 1]}, ''), ask = g.check(by('Скобки'), {'1|(': ['(', 'R', 1], '1|)': [')', 'L', 1], '1|_': ['_', 'R', 1]});
  const none = g.check(L[1], {'1|0': ['1', 'R', 1], '1|1': ['0', 'R', 1]});
  check('зацикливание останавливается после 2000 шагов: «зациклилась», нужен переход в q0 (в вопросах — в «Да» или «Нет»)', !loop.ok && /2000 шагов/.test(loop.msg) && /зациклилась/.test(loop.msg) && /q0/.test(loop.msg) && still.error === 'loop' && still.steps === g.LIMIT && !ask.ok && /«Да» или «Нет»/.test(ask.msg), loop.msg + ' | ' + ask.msg);
  check('нет команды: сообщение называет состояние и символ (пустая клетка — λ)', !none.ok && /нет команды для состояния q1 и символа «λ»/.test(none.msg), none.msg); }
// Вопросы: остановка в q0 вместо ответа — ошибка; двоичные числа: ведущие нули не важны (1000 − 1 = 0111 засчитывается).
{ const q0 = g.check(by('Скобки'), {'1|(': ['(', 'R', 1], '1|)': [')', 'R', 1], '1|x': ['x', 'R', 1], '1|_': ['_', 'N', 0]}), dec = by('Двоичное −1'), r = g.run(dec, dec.refProg, '1000');
  const strict = g.check(by('Инверсия'), P(['0:1R1 1:0R1 _:0N0']));
  check('вопрос: остановка в q0 — не ответ; число 0111 засчитано как 111; лишний символ в слове — ошибка', !q0.ok && /остановилась в q0/.test(q0.msg) && r.word === '0111' && g.check(dec, dec.refProg).ok && !strict.ok, q0.msg + ' | ' + strict.msg); }
// Звёзды: две — чуть больше нормы, одна — длинная, но верная программа (вдвое больше состояний с тем же поведением или лишнее состояние).
{ let ok = true, info = '';
  const twin = (prog, S) => { const out = {}; for (const [k, [w, mv, nx]] of Object.entries(prog)) { const [q, s] = k.split('|'); out[k] = [w, mv, typeof nx === 'number' && nx > 0 ? nx + S : nx]; out[(Number(q) + S) + '|' + s] = [w, mv, nx]; } return out; };
  for (const [i, lv] of L.entries()) { const S = lv.par.states, C = [...lv.abc, '_'];
    if (2 * S <= 9) { const r = g.check(lv, twin(g.solve(lv), S)); if (!r.ok || r.stars !== (i === 0 ? 2 : 1)) { ok = false; info = `задача ${i + 1}: двойник ${JSON.stringify(r).slice(0, 100)}`; } }
    const one = g.solve(lv), many = g.solve(lv); one[(S + 1) + '|' + C[0]] = [C[0], 'R', 1]; for (const s of C) many[(S + 1) + '|' + s] = [s, 'R', 1];
    const r1 = g.check(lv, one), r3 = g.check(lv, many); if (r1.stars !== 2 || r3.stars !== (C.length >= 3 ? 1 : 2)) { ok = false; info = `задача ${i + 1}: лишнее состояние даёт ${r1.stars} и ${r3.stars}`; } }
  check('звёзды: норма — три, чуть больше нормы — две, длинная верная программа — одна', ok, info); }
// Таблица проверяется: чужие символы, сдвиги, состояния больше q9 и «Да»/«Нет» вне вопросов не принимаются.
{ const lv = L[1], bads = [null, [], 'q1', {'1|2': ['1', 'R', 1]}, {'1|0': ['2', 'R', 1]}, {'1|0': ['1', 'X', 1]}, {'1|0': ['1', 'R', 10]}, {'1|0': ['1', 'R', 'Y']}, {'0|0': ['1', 'R', 1]}, {'1|0': ['1', 'R']}, {'1|0|1': ['1', 'R', 1]}];
  const passed = bads.filter(p => g.check(lv, p).ok || !/неверно/.test(g.check(lv, p).msg));
  check('неправильно составленные таблицы отклоняются', !passed.length && g.check(by('Скобки'), P(['(:(R1 x:xR1 ):xL2 _:_L3', 'x:xL2 (:xR1 _:_NN', 'x:xL3 (:(NN _:_NY'])).ok, JSON.stringify(passed)); }

/* ---------- экран на мини-DOM: элементы, классы, события, поиск по .класс и [data-…] ---------- */
const doc = {activeElement: null, on: {}, createElement: t => new N(t), addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); }, removeEventListener(t, f) { this.on[t] = (this.on[t] || []).filter(x => x !== f); }};
class N {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this.className = ''; this.dataset = {}; this.attrs = {}; this.hidden = false; this.disabled = false; this.value = ''; this.text = ''; this.on = {};
    const self = this; this.style = {setProperty(k, v) { this[k] = v; }}; this.classList = {add: c => { if (!self.has(c)) self.className = (self.className + ' ' + c).trim(); }, remove: c => { self.className = self.className.split(/\s+/).filter(x => x && x !== c).join(' '); }, toggle: (c, f) => (f === undefined ? !self.has(c) : f) ? self.classList.add(c) : self.classList.remove(c), contains: c => self.has(c)}; }
  has(c) { return this.className.split(/\s+/).includes(c); }
  append(...xs) { for (const x of xs) { if (typeof x === 'string') { this.text += x; continue; } if (x.parentNode) x.remove(); x.parentNode = this; this.children.push(x); } }
  prepend(...xs) { const old = this.children; this.children = []; this.append(...xs); for (const c of old) this.children.push(c); }
  replaceChildren(...xs) { for (const c of this.children) c.parentNode = null; this.children = []; this.text = ''; this.append(...xs); }
  remove() { const p = this.parentNode; if (p) { p.children = p.children.filter(c => c !== this); this.parentNode = null; } }
  get textContent() { return this.text + this.children.map(c => c.textContent).join(''); }
  set textContent(v) { for (const c of this.children) c.parentNode = null; this.children = []; this.text = String(v); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); }
  click() { if (!this.disabled) for (const f of this.on.click || []) f({target: this, preventDefault() {}}); }
  focus() { doc.activeElement = this; }
  all() { return this.children.flatMap(c => [c, ...c.all()]); }
  matches(sel) { const m = /^([a-z]*)((?:\.[\w-]+)*)(?:\[data-([\w-]+)(?:="?([^"\]]*)"?)?\])?$/.exec(sel); if (!m) throw new Error('селектор ' + sel); const [, tag, cls, data, val] = m;
    return (!tag || this.tagName === tag.toUpperCase()) && cls.split('.').filter(Boolean).every(c => this.has(c)) && (!data || (data in this.dataset && (val === undefined || this.dataset[data] === val))); }
  querySelector(sel) { return this.all().find(n => n.matches(sel)) || null; }
  querySelectorAll(sel) { return this.all().filter(n => n.matches(sel)); }
}
doc.body = new N('body'); globalThis.document = doc; globalThis.window = globalThis;
const timers = new Map(); let tid = 0; globalThis.setInterval = fn => { timers.set(++tid, fn); return tid; }; globalThis.clearInterval = id => { timers.delete(id); };
const flush = () => { let n = 0; while (timers.size && n++ < 100000) for (const [id, fn] of [...timers]) if (timers.has(id)) fn(); return n; };
const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const button = (text, cls, fn) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
const press = (key, code = '', shiftKey = false) => { const e = {key, code, shiftKey, target: doc.activeElement || doc.body, preventDefault() { this.prevented = true; }}; for (const f of doc.on.keydown || []) f(e); return e; };
const screen = (lv, n) => { const page = el('section', 'lab-play'), host = el('div', 'lab-host'), over = el('div', 'lab-over'), res = []; over.hidden = true; page.append(host, over); doc.body.replaceChildren(page); doc.activeElement = null;
  const off = g.mount(host, lv, {el, button, grade: 11, n, debugHost: true, finish(stars, detail) { res.push({stars, detail}); over.hidden = false; }}); return {host, res, off, q: s => host.querySelector(s), qa: s => host.querySelectorAll(s), msg: () => host.querySelector('.lab-msg').textContent}; };
// Все задачи проходятся через экран: образец кнопкой «Сразу итог» и анимированным запуском; лента и таблица нарисованы, обработчики клавиш снимаются.
{ let ok = true, info = '';
  for (const [i, lv] of L.entries()) { try {
    const a = screen(lv, i + 1), C = lv.abc.length + 1; if (a.qa('.tm-rule').length !== lv.par.states * C || a.qa('.tm-cell').length !== 15 || a.qa('.tm-cell.here').length !== 1 || a.qa('.tm-pick').length !== lv.tapes.length || !a.q('.lab-task')) { ok = false; info = `задача ${i + 1}: экран нарисован не полностью`; }
    window.labSet(g.solve(lv)); a.q('[data-act=fast]').click(); if (a.res.length !== 1 || a.res[0].stars !== 3) { ok = false; info = `задача ${i + 1}: «Сразу итог» — ${JSON.stringify(a.res)} ${a.msg()}`; } a.off();
    const b = screen(lv, i + 1); window.labSet(g.solve(lv)); b.q('[data-act=run]').click(); const ticks = flush(); if (b.res.length !== 1 || b.res[0].stars !== 3 || ticks > 260) { ok = false; info = `задача ${i + 1}: запуск — ${JSON.stringify(b.res)} за ${ticks} тактов ${b.msg()}`; } b.off();
  } catch (e) { ok = false; info = `задача ${i + 1}: ${e.stack}`; } }
  check('экран: все 12 задач проходятся образцом — сразу и с анимацией головки; обработчики клавиш снимаются', ok && !(doc.on.keydown || []).length, info); }
// Клавиатура: клетка выбирается щелчком и стрелками, три клавиши задают команду (русская раскладка тоже), Enter запускает машину.
{ const a = screen(L[1], 2); a.q('[data-cell="1|0"]').click(); for (const k of ['1', 'п', '1']) press(k); const moved = a.q('[data-cell="1|1"]').has('sel'); for (const k of ['0', 'r', '1']) press(k);
  press(' '); press('н'); press('0'); const prog = JSON.stringify(Object.fromEntries(a.qa('.tm-rule').map(b => [b.dataset.cell, b.textContent])));
  press('Enter'); flush(); const ok1 = moved && a.res.length === 1 && a.res[0].stars === 3; press('ArrowUp'); a.off();
  const b = screen(by('Копия слова'), 12); press('ArrowDown'); press('ArrowDown'); press('ArrowRight'); const at = (b.q('.tm-rule.sel') || {dataset: {}}).dataset.cell; press('ф', 'KeyA', true); press('l'); press('2');
  const cell = b.q('[data-cell="2|b"]').textContent, next = b.q('.tm-rule.sel').dataset.cell; press('ArrowLeft'); press('Delete'); const cleared = b.q('[data-cell="2|b"]').has('empty'); press('Escape'); const none = !b.q('.tm-rule.sel'); b.off();
  check('клавиатура: стрелки, «1П1» и «0R1», пробел — λ, раскладка ЙЦУКЕН, Delete, Escape и Enter', ok1 && at === '2|b' && cell === 'AЛq2' && next === '2|*' && cleared && none, `${prog} | ${at} | ${cell} | ${next}`); }
// Кнопки редактора, шаги, зацикливание на экране, переход к ленте с ошибкой, удаление занятого состояния.
{ const a = screen(L[0], 1); a.q('[data-cell="1|1"]').click(); a.q('[data-m="R"]').click(); a.q('[data-cell="1|_"]').click(); a.q('[data-w="1"]').click(); a.q('[data-m="N"]').click(); a.q('[data-n="0"]').click();
  const cells = a.qa('.tm-rule').map(b => b.textContent).join(' '); a.q('[data-act=fast]').click(); const ok1 = cells === '1Пq1 1Нq0' && a.res.length === 1 && a.res[0].stars === 3; a.off();
  const b = screen(L[0], 1); window.labSet({'1|1': ['1', 'R', 1], '1|_': ['_', 'R', 1]}); b.q('[data-act=run]').click(); flush(); const loop = /зациклилась/.test(b.msg()) && !b.res.length; b.off();
  const c = screen(L[1], 2); window.labSet(L[1].refProg); c.q('[data-tape="3"]').click(); for (let k = 0; k < 3; k++) c.q('[data-act=step]').click(); const stat = c.q('.tm-status').textContent, now = c.qa('.tm-rule.now').length; c.off();
  const d = screen(by('Двоичное +1'), 6); window.labSet(P(['0:0R1 1:1R1 _:_L2', '0:1N0 1:0N0'])); d.q('[data-act=run]').click(); flush(); const jump = d.q('[data-tape="1"]').has('on') && /Лента 2/.test(d.msg()) && !d.res.length; d.off();
  const e = screen(by('Сложение палочек'), 4); window.labSet(by('Сложение палочек').refProg); e.q('[data-act=delq]').click(); const refuse = /очисти строку q2/.test(e.msg()) && e.qa('.tm-rule').length === 6; e.q('[data-act=addq]').click(); const added = e.qa('.tm-rule').length === 9; e.off();
  check('экран: кнопки записи, сдвига и перехода, шаги с подсветкой клетки, зацикливание, переход к ленте с ошибкой, занятое состояние не удаляется', ok1 && loop && /шаг 3/.test(stat) && now === 1 && jump && refuse && added, [cells, stat, now, jump, refuse, added].join(' | ')); }
console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
