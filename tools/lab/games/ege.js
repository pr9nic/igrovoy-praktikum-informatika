// «ЕГЭ-арена»: задания ЕГЭ по информатике, которые решаются без компьютера (10–11 классы).
// Каждый уровень — одно задание: три варианта подряд, сгенерированных заново; верный ответ сбивает щит экзаменатора.
// Ответы считаются перебором (а не формулой), поэтому совпадают с честным решением; разбор показывается после каждого ответа.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const tl = r => ({ri: (a, b) => a + Math.floor(r() * (b - a + 1)), pick: a => a[Math.floor(r() * a.length)], shuffle: a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }});
  const fano = codes => codes.every((a, i) => codes.every((b, j) => i === j || !b.startsWith(a)));
  const T = {
    4(r) { const {ri, pick, shuffle} = tl(r);
      for (;;) { const L = 'АБВГДЕ'.split('').slice(0, ri(5, 6)), known = {}, given = shuffle(L).slice(0, L.length - 2), rest = L.filter(x => !given.includes(x));
        const base = pick([['0', '10', '110'], ['00', '01', '100'], ['1', '01', '001'], ['00', '010', '011', '101'], ['10', '11', '000', '0010']]);
        if (base.length < given.length) continue; given.forEach((x, i) => { known[x] = base[i]; }); if (!fano(Object.values(known))) continue;
        // перебор кодов для двух оставшихся букв: минимальная сумма длин
        const all = []; for (let len = 1; len <= 6; len++) for (let v = 0; v < 1 << len; v++) all.push(v.toString(2).padStart(len, '0'));
        let best = 1e9; for (const a of all) { if (!fano([...Object.values(known), a])) continue; for (const b of all) { if (a.length + b.length >= best) continue; if (fano([...Object.values(known), a, b])) best = a.length + b.length; } }
        if (best > 12) continue;
        return {text: `По каналу связи передаются сообщения из букв ${L.join(', ')}. Используется неравномерный двоичный код, удовлетворяющий условию Фано (ни одно кодовое слово не является началом другого). Известны коды: ${given.map(x => `${x} — ${known[x]}`).join(', ')}. Какова наименьшая возможная суммарная длина кодовых слов для букв ${rest.join(' и ')}?`, answer: best,
          explain: `Перебираем свободные «ветки» двоичного дерева: подходят только коды, которые не являются началом известных и не начинаются с них. Самые короткие варианты дают сумму ${best}.`}; } },
    5(r) { const {ri, pick} = tl(r);
      const rules = [['если число N чётное, к записи справа приписывается 0, иначе — 1', s => s + (parseInt(s, 2) % 2 ? '1' : '0')], ['к записи справа приписываются два последних её разряда', s => s + s.slice(-2)], ['если сумма цифр двоичной записи чётная, справа приписывается 0, иначе — 1, и затем это действие повторяется ещё раз', s => { const f = t => t + ((t.split('1').length - 1) % 2 ? '1' : '0'); return f(f(s)); }]];
      const [rule, fn] = pick(rules), K = ri(40, 300);
      let n = 1; while (parseInt(fn(n.toString(2)), 2) <= K) n++;
      return {text: `Автомат получает на вход натуральное число N и строит число R так: 1) строится двоичная запись N; 2) ${rule}; 3) полученная запись — это двоичная запись R. Укажите наименьшее N, для которого R больше ${K}. В ответе запишите число в десятичной системе.`, answer: n,
        explain: `Перебираем N = 1, 2, 3, …: N = ${n} даёт R = ${fn(n.toString(2))}₂ = ${parseInt(fn(n.toString(2)), 2)} > ${K}, а N = ${n - 1} даёт R = ${parseInt(fn((n - 1).toString(2)), 2)}.`}; },
    6(r) { const {ri, pick} = tl(r); const a = ri(5, 18), b = ri(4, 15), inside = pick([true, false]);
      const ans = inside ? (a - 1) * (b - 1) : (a + 1) * (b + 1);
      return {text: `Черепаха выполняет программу: Повтори 2 [Вперёд ${a} Направо 90 Вперёд ${b} Направо 90]. Определите, сколько точек с целочисленными координатами находятся ${inside ? 'внутри области, ограниченной линией (точки на линии не учитываются)' : 'внутри области и на её границе'}.`, answer: ans,
        explain: `Черепаха рисует прямоугольник ${a}×${b}. ${inside ? `Внутри — (${a} − 1) × (${b} − 1) = ${ans} точек.` : `Вместе с границей — (${a} + 1) × (${b} + 1) = ${ans} точек.`}`}; },
    7(r) { const {ri, pick} = tl(r);
      for (;;) { const w = pick([640, 800, 1024, 1280, 2048]), h = pick([480, 600, 768, 1024]), colors = pick([16, 64, 256, 1024, 65536]), i = Math.log2(colors), kb = w * h * i / 8 / 1024, n = ri(2, 8), mb = ri(2, 10) * 1024;
        if (!Number.isInteger(kb)) continue; const cnt = Math.floor(mb / kb); if (cnt < 1) continue;
        return {text: `Камера делает фотографии ${w}×${h} пикселей и сохраняет их без сжатия, палитра — ${colors} цветов (на пиксель отводится одинаковое минимальное число бит). Сколько таких фотографий поместится на карту памяти объёмом ${mb / 1024} Мбайт? Служебная информация не учитывается.`, answer: cnt,
          explain: `На пиксель — log₂${colors} = ${i} бит. Фото: ${w}·${h}·${i} бит = ${kb} Кбайт. Карта: ${mb} Кбайт; ${mb} / ${kb} → ${cnt} целых фотографий.`}; } },
    8(r) { const {ri, pick} = tl(r);
      const word = pick(['КОД', 'ЛОГИКА', 'ЗАДАЧА', 'ПИТОН', 'ДАННЫЕ']), letters = [...new Set(word)], L = ri(4, 5), mode = pick(['once', 'noStart', 'twoSame']);
      const vowels = 'АЕЁИОУЫЭЮЯ', pickL = pick(letters);
      let cnt = 0; const rec = s => { if (s.length === L) { if (mode === 'once' ? s.split(pickL).length - 1 === 1 : mode === 'noStart' ? !vowels.includes(s[0]) : s.split('').some((c, i) => i && c === s[i - 1])) cnt++; return; } for (const c of letters) rec(s + c); }; rec('');
      const cond = mode === 'once' ? `буква ${pickL} встречается ровно один раз` : mode === 'noStart' ? 'слово не начинается с гласной' : 'в слове есть хотя бы две одинаковые буквы подряд';
      return {text: `Вася составляет ${L}-буквенные слова из букв слова ${word} (каждую букву можно использовать сколько угодно раз). Сколько существует слов, в которых ${cond}?`, answer: cnt,
        explain: `Различных букв: ${letters.length}. Перебором (или правилом произведения) получаем ${cnt} подходящих слов.`}; },
    11(r) { const {ri, pick} = tl(r);
      const N = ri(10, 40), len = ri(8, 20), users = pick([20, 50, 100, 500]), bits = Math.ceil(Math.log2(N)), bytes = Math.ceil(len * bits / 8), extra = pick([0, 10, 20]);
      const total = users * (bytes + extra);
      return {text: `При регистрации каждому пользователю выдают пароль из ${len} символов; используются ${N} различных символов. Каждый символ кодируется минимально возможным одинаковым числом бит, пароль — минимально возможным целым числом байтов.${extra ? ` Кроме пароля, для каждого пользователя хранится ${extra} байт дополнительных сведений.` : ''} Сколько байтов нужно для хранения сведений о ${users} пользователях?`, answer: total,
        explain: `Символ: ${bits} бит (2^${bits} ≥ ${N}). Пароль: ${len}·${bits} = ${len * bits} бит → ${bytes} байт.${extra ? ` С доп. сведениями: ${bytes + extra} байт.` : ''} Всего: ${users}·${bytes + extra} = ${total}.`}; },
    12(r) { const {ri, pick} = tl(r);
      const n = ri(30, 90), [a, b] = pick([['111', '2'], ['11', '2'], ['1111', '22']]), [c, d] = pick([['222', '1'], ['22', '1']]);
      let s = '1'.repeat(n), guard = 0; while ((s.includes(a) || s.includes(c)) && guard++ < 10000) { if (s.includes(a)) s = s.replace(a, b); else s = s.replace(c, d); }
      return {text: `Исполнитель Редактор получает строку из ${n} единиц и выполняет программу:\nПОКА нашлось(${a}) ИЛИ нашлось(${c})\n  ЕСЛИ нашлось(${a}) ТО заменить(${a}, ${b})\n  ИНАЧЕ заменить(${c}, ${d})\nКОНЕЦ ПОКА\nКакая строка получится? (Ответ — строка, например 21.)`, answer: s, kind: 'word',
        explain: `Повторяем замены, пока в строке есть «${a}» или «${c}». Остаётся строка ${s}.`}; },
    13(r) { const {ri, pick} = tl(r);
      for (;;) { const m = ri(22, 28), host = 32 - m, a = [ri(10, 220), ri(0, 255), ri(0, 255), 0], mask = [0, 1, 2, 3].map(k => (0xFF00 >> Math.max(0, Math.min(8, m - 8 * k))) & 0xFF), net = a.map((x, k) => x & mask[k]);
        const parity = pick(['чётным', 'нечётным']); let cnt = 0; const base = net.reduce((s, x) => s * 256 + x, 0);
        for (let h = 0; h < 2 ** host; h++) { const ip = base + h, ones = ip.toString(2).split('1').length - 1; if ((ones % 2 === 0) === (parity === 'чётным')) cnt++; }
        return {text: `Сеть задана IP-адресом ${net.join('.')} и маской ${mask.join('.')}. Сколько в этой сети IP-адресов (включая адрес сети и широковещательный), у которых количество единиц в двоичной записи является ${parity}?`, answer: cnt,
          explain: `Под номер узла — ${host} бит, всего ${2 ** host} адресов. Перебрав их, получаем ${cnt} адресов с ${parity === 'чётным' ? 'чётным' : 'нечётным'} числом единиц.`}; } },
    14(r) { const {ri, pick} = tl(r);
      const b = pick([2, 4, 8]), e1 = ri(20, 60), e2 = ri(5, e1 - 3), k = ri(3, 40), digit = b - 1;
      const v = BigInt(b) ** BigInt(e1) + BigInt(b) ** BigInt(e2) - BigInt(k), s = v.toString(b), cnt = s.split(String(digit)).length - 1;
      return {text: `Значение выражения ${b}^${e1} + ${b}^${e2} − ${k} записали в системе счисления с основанием ${b}. Сколько цифр ${digit} содержится в этой записи?`, answer: cnt,
        explain: `${b}^${e1} + ${b}^${e2} − ${k} в системе с основанием ${b} — это ${s.length}-значная запись, в ней ${cnt} цифр ${digit}.`}; },
    15(r) { const {ri, pick} = tl(r);
      for (;;) { const p = ri(3, 12), q = ri(5, 30); const forms = [
          [`(ДЕЛ(x, A) ∧ ¬ДЕЛ(x, ${q})) → (¬ДЕЛ(x, A) ∨ ДЕЛ(x, ${p}))`, (x, A) => !(x % A === 0 && x % q !== 0) || (x % A !== 0 || x % p === 0), 'наименьшего'],
          [`ДЕЛ(x, A) ∨ (ДЕЛ(x, ${p}) → ¬ДЕЛ(x, ${q}))`, (x, A) => x % A === 0 || !(x % p === 0) || x % q !== 0, 'наибольшего']];
        const [f, fn, ask] = pick(forms), ok = A => { for (let x = 1; x <= 1000; x++) if (!fn(x, A)) return false; return true; };
        // A перебираем, как и x, до 1000: НОК(p, q) ≤ 360, так что настоящий ответ всегда попадает в перебор.
        const good = []; for (let A = 1; A <= 1000; A++) if (ok(A)) good.push(A);
        if (!good.length || (ask === 'наибольшего' && good[good.length - 1] === 1000)) continue;
        const ans = ask === 'наименьшего' ? good[0] : good[good.length - 1]; if (ans === 1 && ask === 'наименьшего') continue;
        return {text: `ДЕЛ(n, m) означает «натуральное n делится без остатка на натуральное m». Для какого ${ask} натурального A формула\n${f}\nтождественно истинна (то есть принимает значение 1 при любом натуральном x)?`, answer: ans,
          explain: `Перебираем A и проверяем формулу для всех x до 1000. Подходят A = ${good.slice(0, 5).join(', ')}${good.length > 5 ? ', …' : ''}; ${ask} — ${ans}.`}; } },
    16(r) { const {ri, pick} = tl(r);
      const k = ri(2, 4), c = ri(1, 3), n = ri(10, 25), mode = pick(['sum', 'mul']); const F = [];
      for (let i = 0; i <= n; i++) F[i] = i < k ? i + c : (mode === 'sum' ? F[i - 1] + F[i - 2] + (i % 3 === 0 ? 1 : 0) : F[i - 1] + 2 * F[i - k]);
      const rule = mode === 'sum' ? `F(n) = F(n − 1) + F(n − 2) + 1, если n делится на 3; иначе F(n) = F(n − 1) + F(n − 2)` : `F(n) = F(n − 1) + 2·F(n − ${k})`;
      return {text: `Алгоритм вычисления функции F(n), где n — неотрицательное целое число:\nF(n) = n + ${c} при n < ${k};\n${rule} при n ≥ ${k}.\nЧему равно значение F(${n})?`, answer: F[n],
        explain: `Считаем снизу вверх: F(0)…F(${k - 1}) = ${F.slice(0, k).join(', ')}; дальше по формуле: … F(${n - 1}) = ${F[n - 1]}, F(${n}) = ${F[n]}.`}; },
    23(r) { const {ri, pick} = tl(r);
      for (;;) { const a = ri(1, 4), b = ri(18, 40), via = ri(a + 3, b - 4), avoid = ri(via + 1, b - 1), [c2, f2] = pick([['умножь на 2', x => x * 2], ['прибавь 2', x => x + 2], ['прибавь 3', x => x + 3]]);
        const ways = (from, to, bad) => { const w = Array(to + 1).fill(0); w[from] = 1; for (let x = from; x <= to; x++) { if (x === bad && x !== from) { w[x] = 0; continue; } if (!w[x]) continue; for (const nx of [x + 1, f2(x)]) if (nx <= to) w[nx] += w[x]; } return w[to]; };
        const ans = ways(a, via, -1) * ways(via, b, avoid); if (ans < 3 || ans > 100000) continue;
        return {text: `Исполнитель преобразует число на экране. Команды: 1. Прибавь 1; 2. ${c2[0].toUpperCase() + c2.slice(1)}. Сколько существует программ, которые исходное число ${a} преобразуют в число ${b}, причём траектория вычислений содержит число ${via} и не содержит числа ${avoid}?`, answer: ans,
          explain: `Число программ считаем по цепочке: из ${a} в ${via} — ${ways(a, via, -1)}, из ${via} в ${b} в обход ${avoid} — ${ways(via, b, avoid)}; произведение ${ans}.`}; } },
  };
  const TITLES = {4: 'Код Фано', 5: 'Алгоритм над двоичной записью', 6: 'Черепаха и точки', 7: 'Объём изображений', 8: 'Комбинаторика слов', 11: 'Пароли и объём', 12: 'Редактор', 13: 'IP-адреса и маски', 14: 'Системы счисления', 15: 'Логика ДЕЛ', 16: 'Рекурсия', 23: 'Количество программ'};
  const LEVELS = Object.keys(T).map(Number).map(n => ({n, title: `Задание ${n}. ${TITLES[n]}`}));
  const problems = (lv, seed) => { const r = rng(seed * 131 + lv.n * 977); return [0, 1, 2].map(() => T[lv.n](r)); };
  const same = (p, a) => p.kind === 'word' ? String(a).trim().replace(/\s+/g, '') === String(p.answer) : String(a).trim() !== '' && Number(String(a).trim().replace(',', '.')) === Number(p.answer);
  function check(lv, ans) {
    if (!ans || !Number.isInteger(ans.seed) || !Array.isArray(ans.answers) || ans.answers.length !== 3) return {ok: false, msg: 'Ответь на все три варианта.'};
    const good = problems(lv, ans.seed).filter((p, i) => same(p, ans.answers[i])).length;
    return good ? {ok: true, stars: good, msg: `Сбито щитов: ${good} из 3.`} : {ok: false, msg: 'Ни один щит не сбит — разбери решения и попробуй снова.'};
  }
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task og-head'), box = el('div', 'lab-panel og-box'), msg = el('p', 'lab-msg'), boss = el('div', 'og-boss'), shields = el('div', 'og-shields'); let seed = Math.floor(Math.random() * 1e6), ps = problems(lv, seed), k = 0, answers = [], forced = null;
    task.append(el('h2', '', `${lv.title} · ЕГЭ`), el('p', '', 'Три варианта задания ЕГЭ подряд. Каждый верный ответ сбивает щит экзаменатора — сколько щитов, столько звёзд. После ответа — разбор.'));
    boss.append(el('span', 'og-bossname', 'Экзаменатор ЕГЭ'), shields);
    const paint = () => shields.replaceChildren(...[0, 1, 2].map(i => el('i', i < answers.length ? (same(ps[i], answers[i]) ? 'broken' : 'held') : i === k ? 'now' : '')));
    function show() { paint();
      if (k >= 3) { const r = check(lv, {seed, answers}); if (r.ok) api.finish(r.stars, r.msg); else box.replaceChildren(el('p', 'lab-msg bad', r.msg), button('Новые варианты', 'lab-main', () => { seed++; ps = problems(lv, seed); k = 0; answers = []; show(); })); return; }
      const p = ps[k], form = el('form', 'og-form'), inp = el('input'); inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Ответ'); const go = button('⚔ Ответить', 'lab-main', () => form.requestSubmit()); go.dataset.act = 'run'; form.append(el('span', '', 'Ответ:'), inp, go);
      form.addEventListener('submit', e => { e.preventDefault(); if (forced) { const r = check(lv, forced); if (r.ok) api.finish(r.stars, r.msg); return; } if (!inp.value.trim()) return; answers.push(inp.value); const ok = same(p, inp.value); k++; paint();
        boss.classList.remove('hit', 'miss'); void boss.offsetWidth; boss.classList.add(ok ? 'hit' : 'miss');
        msg.className = 'lab-msg ' + (ok ? 'good' : 'bad'); msg.textContent = (ok ? 'Щит сбит! ' : `Щит устоял. Правильный ответ: ${p.answer}. `) + p.explain; const next = button(k < 3 ? 'Следующий щит →' : 'Итог боя', 'lab-main', show); form.replaceWith(next); next.focus(); });
      box.replaceChildren(el('p', 'lab-eyebrow', `ЩИТ ${k + 1} ИЗ 3`), el(p.text.includes('\n') ? 'pre' : 'p', p.text.includes('\n') ? 'og-code' : 'og-text', p.text), form, msg); msg.textContent = ''; msg.className = 'lab-msg'; setTimeout(() => inp.focus(), 50); }
    host.classList.add('og-arena'); host.append(task, boss, box); show(); if (api.debugHost) window.labSet = a => { forced = a; };
  }
  LAB.register({id: 'ege', bg: 'oge_arena', hero: 'oge_host', title: 'ЕГЭ-арена', genre: 'подготовка к ЕГЭ', art: '🏆', color: '#ffb347', unit: 'Задание', minutes: 45,
    about: 'Двенадцать заданий ЕГЭ по информатике, которые решаются без компьютера: код Фано, алгоритмы, Черепаха, объёмы, комбинаторика, Редактор, маски, системы счисления, ДЕЛ, рекурсия и программы исполнителя. Варианты каждый раз новые.',
    levels: () => LEVELS, mount, check, solve: lv => ({seed: 1, answers: problems(lv, 1).map(p => String(p.answer))}), LEVELS, problems, T});
})();
