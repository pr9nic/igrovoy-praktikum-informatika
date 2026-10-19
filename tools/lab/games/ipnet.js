// «Почта пакетов»: IP-адреса и маски (11 класс §14, 7 класс §2.5). Робот-почтальон доставляет пакеты, а ты разбираешь адреса:
// двоичные октеты, корректность адреса, маска и префикс, адрес сети, число адресов, одна ли сеть, адрес из фрагментов.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1)), pick = (r, a) => a[Math.floor(r() * a.length)];
  const ip = r => [ri(r, 10, 223), ri(r, 0, 255), ri(r, 0, 255), ri(r, 1, 254)];
  const maskOf = n => [0, 1, 2, 3].map(k => { const bits = Math.max(0, Math.min(8, n - 8 * k)); return (0xFF00 >> bits) & 0xFF; });
  const bin8 = x => x.toString(2).padStart(8, '0'), dot = a => a.join('.');
  const valid = s => { const p = s.split('.'); return p.length === 4 && p.every(x => /^(0|[1-9]\d{0,2})$/.test(x) && +x <= 255); };
  const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
  const G = {
    tobin(r) { const x = ri(r, 1, 255); return {text: `Пакет пришёл на адрес, где один октет равен ${x}. Запиши это число в двоичном виде ровно восемью цифрами (с ведущими нулями).`, answer: bin8(x), explain: `${x} = ${bin8(x)}₂: каждая из восьми позиций — 128, 64, 32, 16, 8, 4, 2, 1.`}; },
    fromBin(r) { const x = ri(r, 1, 255); return {text: `На конверте октет записан в двоичном виде: ${bin8(x)}. Какое это десятичное число?`, answer: String(x), explain: `${bin8(x).split('').map((c, i) => c === '1' ? 128 >> i : 0).filter(Boolean).join(' + ')} = ${x}.`}; },
    valid(r) { const good = () => dot(ip(r)), bad = () => pick(r, [() => dot([ri(r, 256, 399), ri(r, 0, 255), ri(r, 0, 255), ri(r, 0, 255)]), () => dot([ri(r, 1, 255), ri(r, 0, 255), ri(r, 0, 255)]), () => dot(ip(r)) + '.' + ri(r, 0, 9), () => `${ri(r, 1, 99)}.0${ri(r, 1, 9)}.${ri(r, 0, 255)}.${ri(r, 0, 255)}`, () => dot([ri(r, 1, 255), ri(r, 0, 255), ri(r, 0, 255), ri(r, 300, 999)])])();
      const list = Array.from({length: 6}, () => r() < 0.5 ? good() : bad()), n = list.filter(valid).length; return {text: `Робот-почтальон получил шесть адресов. Сколько из них — корректные IP-адреса?\n${list.join('\n')}`, answer: String(n), explain: `IP-адрес — четыре числа от 0 до 255 через точку, без ведущих нулей. Корректны: ${list.filter(valid).join(', ') || 'ни одного'}.`}; },
    mask(r) { const n = pick(r, [8, 16, 24, ri(r, 17, 30)]); return {text: `Маска сети задана префиксом /${n} (первые ${n} бит — единицы, остальные — нули). Запиши маску в обычном виде: четыре числа через точку.`, answer: dot(maskOf(n)), explain: `${n} единиц: ${maskOf(n).map(bin8).join('.')} → ${dot(maskOf(n))}.`}; },
    prefix(r) { const n = ri(r, 16, 30); return {text: `Маска сети: ${dot(maskOf(n))}. Сколько единиц в двоичной записи маски (какой у неё префикс)?`, answer: String(n), explain: `${maskOf(n).map(bin8).join('.')} — единиц ${n}.`}; },
    net(r) { const a = ip(r), n = pick(r, [8, 16, 24, ri(r, 17, 29)]), m = maskOf(n), nw = a.map((x, i) => x & m[i]); return {text: `Узел с IP-адресом ${dot(a)} находится в сети с маской ${dot(m)}. Каков адрес сети? (Адрес сети = поразрядное И адреса и маски.)`, answer: dot(nw), explain: `Октеты, где маска 255, переписываем, где 0 — обнуляем, остальные: ${a.map((x, i) => m[i] !== 255 && m[i] ? `${bin8(x)} И ${bin8(m[i])} = ${bin8(x & m[i])} (${x & m[i]})` : '').filter(Boolean).join('; ') || 'других нет'}. Ответ ${dot(nw)}.`}; },
    count(r) { const n = ri(r, 20, 30), hosts = r() < 0.5; const all = 2 ** (32 - n); return {text: hosts ? `Сколько компьютеров можно подключить к сети с маской /${n}? Учти, что адрес сети (все нули в узловой части) и широковещательный адрес (все единицы) узлам не выдаются.` : `Сколько всего IP-адресов (включая адрес сети и широковещательный) в сети с маской /${n}?`, answer: String(hosts ? all - 2 : all), explain: `На номер узла остаётся 32 − ${n} = ${32 - n} бит: 2^${32 - n} = ${all} адресов${hosts ? `, без двух служебных — ${all - 2}` : ''}.`}; },
    same(r) { const n = pick(r, [24, ri(r, 20, 28)]), m = maskOf(n), a = ip(r), b = a.slice(); b[3] = ri(r, 1, 254); if (r() < 0.5) b[2] = (b[2] + ri(r, 1, 40)) % 256; const yes = a.every((x, i) => (x & m[i]) === (b[i] & m[i]));
      return {text: `Пакет идёт от ${dot(a)} к ${dot(b)}. Маска сети ${dot(m)}. Находятся ли узлы в одной сети? Ответь ДА или НЕТ.`, answer: yes ? 'ДА' : 'НЕТ', explain: `Адреса сетей: ${dot(a.map((x, i) => x & m[i]))} и ${dot(b.map((x, i) => x & m[i]))} — ${yes ? 'совпадают' : 'разные'}.`}; },
    pieces(r) { for (;;) { const s = dot(ip(r)), cut = new Set(); while (cut.size < 3) cut.add(ri(r, 1, s.length - 1)); const pos = [0, ...[...cut].sort((x, y) => x - y), s.length], parts = pos.slice(1).map((e, i) => s.slice(pos[i], e));
        if (new Set(parts).size < 4) continue; const letters = 'АБВГ', shuffled = parts.map(p => [p, r()]).sort((x, y) => x[1] - y[1]).map(x => x[0]), ok = perms([0, 1, 2, 3]).filter(o => valid(o.map(i => shuffled[i]).join('')));
        if (ok.length !== 1) continue; return {text: `Пакет разорвало на четыре фрагмента, каждый помечен буквой. Восстанови IP-адрес и запиши буквы в нужном порядке.\n${shuffled.map((p, i) => `${letters[i]}) ${p}`).join('\n')}`, answer: ok[0].map(i => letters[i]).join(''), explain: `Единственный корректный адрес: ${s} → ${ok[0].map(i => letters[i]).join('')}.`}; } },
  };
  const LEVELS = [['Двоичный октет', 'tobin'], ['Из двоичного', 'fromBin'], ['Корректный адрес', 'valid'], ['Маска по префиксу', 'mask'], ['Префикс по маске', 'prefix'], ['Адрес сети', 'net'], ['Сколько адресов', 'count'], ['Одна ли сеть', 'same'], ['Пакет из кусочков', 'pieces']].map(([title, gen]) => ({title, gen}));
  const problems = (lv, seed) => { const r = rng(seed * 241 + LEVELS.indexOf(lv) * 29); return [0, 1, 2].map(() => G[lv.gen](r)); };
  const norm = s => String(s).trim().toUpperCase().replace(/\s+/g, '').replace(/,/g, '.');
  const same = (p, a) => norm(a) !== '' && norm(a) === norm(p.answer);
  function check(lv, ans) {
    if (!ans || !Number.isInteger(ans.seed) || !Array.isArray(ans.answers) || ans.answers.length !== 3) return {ok: false, msg: 'Ответь на все три пакета.'};
    const good = problems(lv, ans.seed).filter((p, i) => same(p, ans.answers[i])).length; return good ? {ok: true, stars: good, msg: `Доставлено пакетов: ${good} из 3.`} : {ok: false, msg: 'Ни один пакет не доставлен — разбери решения и попробуй снова.'};
  }
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), box = el('div', 'lab-panel og-box'), msg = el('p', 'lab-msg'), dots = el('div', 'og-dots'); let seed = Math.floor(Math.random() * 1e6), ps = problems(lv, seed), k = 0, answers = [], forced = null;
    task.append(el('h2', '', lv.title), el('p', '', 'Три пакета подряд: каждый верный ответ — звезда. После ошибки — разбор.'));
    const paint = () => dots.replaceChildren(...[0, 1, 2].map(i => el('i', i < answers.length ? (same(ps[i], answers[i]) ? 'good' : 'bad') : i === k ? 'now' : '')));
    function show() { paint();
      if (k >= 3) { const r = check(lv, {seed, answers}); if (r.ok) api.finish(r.stars, r.msg); else { msg.textContent = r.msg; msg.className = 'lab-msg bad'; box.append(button('Новые пакеты', 'lab-main', () => { seed++; ps = problems(lv, seed); k = 0; answers = []; show(); })); } return; }
      const p = ps[k], form = el('form', 'og-form'), inp = el('input'); inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Ответ'); const go = button('📮 Доставить', 'lab-main', () => form.requestSubmit()); go.dataset.act = 'run'; form.append(el('span', '', 'Ответ:'), inp, go);
      form.addEventListener('submit', e => { e.preventDefault(); if (forced) { const r = check(lv, forced); if (r.ok) api.finish(r.stars, r.msg); return; } if (!inp.value.trim()) return; answers.push(inp.value); const ok = same(p, inp.value); k++; paint(); box.querySelector('.ip-lane')?.classList.add(ok ? 'sent' : 'lost');
        msg.className = 'lab-msg ' + (ok ? 'good' : 'bad'); msg.textContent = (ok ? 'Доставлено! ' : `Не туда. Правильно: ${p.answer}. `) + p.explain; const next = button(k < 3 ? 'Следующий пакет →' : 'Итог', 'lab-main', show); form.replaceWith(next); next.focus(); });
      const lane = el('div', 'ip-lane'), pic = (n, c) => { const i = new Image(); i.src = `art/net_${n}.webp?v=1`; i.alt = ''; i.className = c; return i; }; lane.append(pic('router', 'ip-from'), pic('packet', 'ip-packet'), pic('mailbox', 'ip-to'));
      box.replaceChildren(el('p', 'lab-eyebrow', `ПАКЕТ ${k + 1} ИЗ 3`), lane, el('p', 'og-text', p.text), form, msg); msg.textContent = ''; msg.className = 'lab-msg'; setTimeout(() => inp.focus(), 50); }
    host.append(task, dots, box); show(); if (api.debugHost) window.labSet = a => { forced = a; };
  }
  LAB.register({id: 'ipnet', bg: 'bg_ipnet', hero: 'host_postman', title: 'Почта пакетов', genre: 'IP-адреса и маски', art: '📮', color: '#5cc8ff', unit: 'Задание', minutes: 40,
    about: 'Робот-почтальон разносит пакеты по сети, а ты разбираешь адреса: двоичные октеты, корректные IP, маски и префиксы, адрес сети, число адресов и адрес из кусочков.',
    levels: grade => grade <= 8 ? LEVELS.filter(l => ['tobin', 'fromBin', 'valid', 'pieces'].includes(l.gen)).concat(LEVELS.filter(l => ['mask', 'prefix', 'count', 'net'].includes(l.gen))) : LEVELS, mount, check,
    solve: lv => ({seed: 1, answers: problems(lv, 1).map(p => p.answer)}), LEVELS, problems});
})();
