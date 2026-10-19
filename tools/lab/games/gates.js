// «Логические схемы»: схема уже соединена проводами, но вентили в ней пустые. Выбери тип каждого вентиля,
// чтобы лампочки горели ровно так, как требует таблица истинности. Учит логическим операциям и их записи.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const OPS = {and: ['И', (a, b) => a & b], or: ['ИЛИ', (a, b) => a | b], xor: ['искл. ИЛИ', (a, b) => a ^ b], not: ['НЕ', a => 1 - a], nand: ['И-НЕ', (a, b) => 1 - (a & b)], nor: ['ИЛИ-НЕ', (a, b) => 1 - (a | b)]};
  // Уровень: входы, вентили {id, in: [...], kinds: какие типы можно выбрать}, выходы {name, from}, и правило (что должно получиться).
  const G = (id, ins, kinds) => ({id, in: ins, kinds}), L = (title, brief, inputs, gates, outputs, rule, ref) => ({title, brief, inputs, gates, outputs, rule, ref});
  const BIN = ['and', 'or', 'xor'], ALL2 = ['and', 'or', 'xor', 'nand', 'nor'];
  const LEVELS = [
    L('Наоборот', 'Лампа должна гореть, когда выключатель A выключен.', ['A'], [G('g1', ['A'], ['not'])], [{name: 'Y', from: 'g1'}], ([a]) => [1 - a], {g1: 'not'}),
    L('Оба сразу', 'Лампа горит, только если включены оба выключателя.', ['A', 'B'], [G('g1', ['A', 'B'], BIN)], [{name: 'Y', from: 'g1'}], ([a, b]) => [a & b], {g1: 'and'}),
    L('Хотя бы один', 'Лампа горит, если включён хотя бы один выключатель.', ['A', 'B'], [G('g1', ['A', 'B'], BIN)], [{name: 'Y', from: 'g1'}], ([a, b]) => [a | b], {g1: 'or'}),
    L('Ровно один', 'Лампа горит, если включён ровно один выключатель из двух.', ['A', 'B'], [G('g1', ['A', 'B'], BIN)], [{name: 'Y', from: 'g1'}], ([a, b]) => [a ^ b], {g1: 'xor'}),
    L('И-НЕ из двух', 'Собери «И-НЕ»: лампа гаснет, только когда включены оба.', ['A', 'B'], [G('g1', ['A', 'B'], BIN), G('g2', ['g1'], ['not'])], [{name: 'Y', from: 'g2'}], ([a, b]) => [1 - (a & b)], {g1: 'and', g2: 'not'}),
    L('Ни одного', 'Лампа горит, только когда оба выключателя выключены.', ['A', 'B'], [G('g1', ['A', 'B'], BIN), G('g2', ['g1'], ['not'])], [{name: 'Y', from: 'g2'}], ([a, b]) => [1 - (a | b)], {g1: 'or', g2: 'not'}),
    L('Следование', 'Импликация A → B: лампа гаснет только когда A включён, а B выключен.', ['A', 'B'], [G('g1', ['A'], ['not']), G('g2', ['g1', 'B'], BIN)], [{name: 'Y', from: 'g2'}], ([a, b]) => [(1 - a) | b], {g1: 'not', g2: 'or'}),
    L('Равенство', 'Лампа горит, когда выключатели в одинаковом положении.', ['A', 'B'], [G('g1', ['A', 'B'], BIN), G('g2', ['g1'], ['not'])], [{name: 'Y', from: 'g2'}], ([a, b]) => [a === b ? 1 : 0], {g1: 'xor', g2: 'not'}),
    L('A, но не B', 'Лампа горит, когда A включён, а B — нет.', ['A', 'B'], [G('g1', ['B'], ['not']), G('g2', ['A', 'g1'], BIN)], [{name: 'Y', from: 'g2'}], ([a, b]) => [a & (1 - b)], {g1: 'not', g2: 'and'}),
    L('Полусумматор', 'Складываем два бита: S — младший разряд суммы, P — перенос в старший разряд.', ['A', 'B'], [G('g1', ['A', 'B'], BIN), G('g2', ['A', 'B'], BIN)], [{name: 'S', from: 'g1'}, {name: 'P', from: 'g2'}], ([a, b]) => [(a + b) % 2, (a + b) >> 1], {g1: 'xor', g2: 'and'}),
    L('Большинство', 'Голосование трёх: лампа горит, если включены хотя бы два выключателя из трёх.', ['A', 'B', 'C'], [G('g1', ['A', 'B'], BIN), G('g2', ['A', 'C'], BIN), G('g3', ['B', 'C'], BIN), G('g4', ['g1', 'g2'], BIN), G('g5', ['g4', 'g3'], BIN)], [{name: 'Y', from: 'g5'}], ([a, b, c]) => [a + b + c >= 2 ? 1 : 0], {g1: 'and', g2: 'and', g3: 'and', g4: 'or', g5: 'or'}),
    L('Чётность трёх', 'Лампа горит, если включено нечётное число выключателей.', ['A', 'B', 'C'], [G('g1', ['A', 'B'], BIN), G('g2', ['g1', 'C'], BIN)], [{name: 'Y', from: 'g2'}], ([a, b, c]) => [(a + b + c) % 2], {g1: 'xor', g2: 'xor'}),
    L('Полный сумматор', 'Сложи три бита (A, B и перенос C): S — разряд суммы, P — перенос дальше.', ['A', 'B', 'C'], [G('g1', ['A', 'B'], BIN), G('g2', ['g1', 'C'], BIN), G('g3', ['A', 'B'], BIN), G('g4', ['g1', 'C'], BIN), G('g5', ['g3', 'g4'], BIN)], [{name: 'S', from: 'g2'}, {name: 'P', from: 'g5'}], ([a, b, c]) => [(a + b + c) % 2, (a + b + c) >> 1], {g1: 'xor', g2: 'xor', g3: 'and', g4: 'and', g5: 'or'}),
    L('Замок с кодом', 'Сейф открывается (лампа горит), только при положении A=1, B=0, C=1.', ['A', 'B', 'C'], [G('g1', ['B'], ['not']), G('g2', ['A', 'g1'], ALL2), G('g3', ['g2', 'C'], ALL2)], [{name: 'Y', from: 'g3'}], ([a, b, c]) => [a & (1 - b) & c], {g1: 'not', g2: 'and', g3: 'and'}),
  ];
  const rows = n => Array.from({length: 1 << n}, (_, k) => Array.from({length: n}, (_, i) => (k >> (n - 1 - i)) & 1));
  function evalCircuit(lv, choice, vals) {
    const v = {}; lv.inputs.forEach((n, i) => { v[n] = vals[i]; });
    for (const g of lv.gates) { const t = choice[g.id]; if (!t || !OPS[t]) return null; const args = g.in.map(x => v[x]); v[g.id] = OPS[t][1](...args); }
    return lv.outputs.map(o => v[o.from]);
  }
  function check(lv, choice) {
    if (!choice || lv.gates.some(g => !g.kinds.includes(choice[g.id]))) return {ok: false, msg: 'Выбери тип каждого вентиля.'};
    const bad = rows(lv.inputs.length).filter(r => { const got = evalCircuit(lv, choice, r), want = lv.rule(r); return !got || got.some((x, i) => x !== want[i]); });
    return bad.length ? {ok: false, bad: bad.length, msg: `Неверных строк таблицы истинности: ${bad.length}.`} : {ok: true, stars: 3, msg: 'Схема работает для всех положений выключателей.'};
  }
  // Раскладка схемы по столбцам: входы слева, вентили по глубине, выходы справа.
  function layout(lv) {
    const depth = {}; lv.inputs.forEach(n => { depth[n] = 0; }); for (const g of lv.gates) depth[g.id] = 1 + Math.max(...g.in.map(x => depth[x]));
    const cols = {}; for (const id of [...lv.inputs, ...lv.gates.map(g => g.id)]) (cols[depth[id]] = cols[depth[id]] || []).push(id);
    const maxD = Math.max(...Object.keys(cols).map(Number)), pos = {}, W = 760, H = Math.max(220, 90 * Math.max(...Object.values(cols).map(c => c.length), lv.outputs.length));
    for (const [d, ids] of Object.entries(cols)) ids.forEach((id, i) => { pos[id] = {x: 70 + Number(d) * (W - 200) / Math.max(1, maxD), y: (i + 1) * H / (ids.length + 1)}; });
    lv.outputs.forEach((o, i) => { pos['out:' + o.name] = {x: W - 50, y: (i + 1) * H / (lv.outputs.length + 1)}; });
    return {pos, W, H};
  }
  function mount(host, lv, api) {
    const {el, button} = api, choice = {}, vals = lv.inputs.map(() => 0), task = el('div', 'lab-task'), msg = el('p', 'lab-msg'), board = el('div', 'gt-board'), table = el('table', 'lab-table gt-table'); let tries = 0;
    task.append(el('h2', '', lv.title), el('p', '', lv.brief));
    const NS = 'http://www.w3.org/2000/svg', mk = (tag, a, text) => { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, a[k]); if (text != null) n.textContent = text; return n; }, {pos, W, H} = layout(lv);
    function draw() {
      const v = {}; lv.inputs.forEach((n, i) => { v[n] = vals[i]; }); for (const g of lv.gates) v[g.id] = choice[g.id] ? OPS[choice[g.id]][1](...g.in.map(x => v[x] ?? 0)) : null;
      const svg = mk('svg', {viewBox: `0 0 ${W} ${H}`, class: 'gt-svg'}), wire = (a, b, on) => svg.append(mk('path', {d: `M${a.x + 30},${a.y} C${(a.x + b.x) / 2},${a.y} ${(a.x + b.x) / 2},${b.y} ${b.x - 34},${b.y}`, class: 'gt-wire' + (on ? ' on' : on === null ? ' off' : ''), fill: 'none'}));
      for (const g of lv.gates) g.in.forEach((x, k) => wire(pos[x], {x: pos[g.id].x, y: pos[g.id].y + (g.in.length > 1 ? (k ? 12 : -12) : 0)}, v[x] === null ? null : !!v[x]));
      for (const o of lv.outputs) wire(pos[o.from], pos['out:' + o.name], v[o.from] === null ? null : !!v[o.from]);
      lv.inputs.forEach((n, i) => { const p = pos[n], gr = mk('g', {class: 'gt-in', tabindex: 0}); gr.append(mk('rect', {x: p.x - 34, y: p.y - 22, width: 64, height: 44, rx: 10, class: vals[i] ? 'on' : ''}), mk('image', {href: `art/gate_sw_${vals[i] ? 'on' : 'off'}.webp?v=1`, x: p.x - 54, y: p.y - 20, width: 30, height: 40}), mk('text', {x: p.x - 2, y: p.y + 6, 'text-anchor': 'middle'}, `${n}=${vals[i]}`)); gr.addEventListener('click', () => { vals[i] = 1 - vals[i]; draw(); }); gr.dataset.input = n; svg.append(gr); });
      for (const g of lv.gates) { const p = pos[g.id], t = choice[g.id], gr = mk('g', {class: 'gt-gate' + (t ? '' : ' empty')}); gr.dataset.gate = g.id;
        gr.append(mk('rect', {x: p.x - 34, y: p.y - 26, width: 68, height: 52, rx: 12})); if (t && ['and', 'or', 'not', 'xor'].includes(t)) gr.append(mk('image', {href: `art/gate_${t}.webp?v=1`, x: p.x - 26, y: p.y - 24, width: 52, height: 30, opacity: 0.9})); gr.append(mk('text', {x: p.x, y: p.y + (t && ['and', 'or', 'not', 'xor'].includes(t) ? 20 : 6), 'text-anchor': 'middle'}, t ? OPS[t][0] : '?'));
        gr.addEventListener('click', () => { const k = g.kinds.indexOf(t); choice[g.id] = g.kinds[(k + 1) % g.kinds.length]; draw(); }); svg.append(gr); }
      for (const o of lv.outputs) { const p = pos['out:' + o.name], on = v[o.from] === 1; svg.append(mk('circle', {cx: p.x, cy: p.y, r: 24, class: 'gt-lamp' + (on ? ' on' : '')}), mk('image', {href: `art/gate_bulb_${on ? 'on' : 'off'}.webp?v=1`, x: p.x - 26, y: p.y - 34, width: 52, height: 60}), mk('text', {x: p.x, y: p.y + 44, 'text-anchor': 'middle', class: 'gt-lbl'}, o.name)); }
      board.replaceChildren(svg);
      // Таблица истинности: что нужно и что даёт схема сейчас.
      const n = lv.inputs.length, h = el('tr'); for (const x of lv.inputs) h.append(el('th', '', x)); for (const o of lv.outputs) h.append(el('th', '', `${o.name} нужно`), el('th', '', `${o.name} сейчас`)); table.replaceChildren(h);
      for (const r of rows(n)) { const got = evalCircuit(lv, choice, r), want = lv.rule(r), tr = el('tr', got && got.every((x, i) => x === want[i]) ? 'hit' : ''); for (const x of r) tr.append(el('td', '', String(x))); lv.outputs.forEach((o, i) => tr.append(el('td', '', String(want[i])), el('td', '', got ? String(got[i]) : '?'))); table.append(tr); }
    }
    const go = button('Проверить схему', 'lab-main', () => { tries++; const r = check(lv, {...choice}); if (r.ok) { msg.textContent = r.msg; msg.className = 'lab-msg good'; api.finish(tries === 1 ? 3 : tries <= 3 ? 2 : 1, r.msg); } else { msg.textContent = r.msg + ' Зелёным в таблице отмечены строки, где схема уже права.'; msg.className = 'lab-msg bad'; } }); go.dataset.act = 'run';
    const left = el('div', 'lab-panel'), right = el('div', 'lab-panel'), cols = el('div', 'lab-cols');
    left.append(el('h3', '', 'Схема: щёлкай по вентилю, чтобы сменить его тип; по выключателю — чтобы переключить'), board, go, msg); right.append(el('h3', '', 'Таблица истинности'), table, el('p', 'lab-note', 'Три звезды — если схема верна с первой проверки (переключать выключатели и смотреть таблицу можно сколько угодно), две — со второй или третьей.'));
    cols.append(left, right); host.append(task, cols); draw(); if (api.debugHost) window.labSet = c => { Object.assign(choice, c); draw(); };
  }
  LAB.register({id: 'gates', bg: 'bg_gates', hero: 'host_electrician', title: 'Логические схемы', genre: 'логика и схемотехника', art: '💡', color: '#ffd34d', unit: 'Схема', minutes: 40,
    about: 'Провода уже проложены, но вентили пустые. Выбери И, ИЛИ, НЕ или исключающее ИЛИ, чтобы лампы горели по таблице истинности. В конце соберёшь сумматор — так компьютер складывает числа.',
    levels: grade => grade <= 7 ? LEVELS.slice(0, 9) : LEVELS, mount, check, solve: lv => ({...lv.ref}), LEVELS, evalCircuit});
})();
