// Игровой практикум на изолированном стенде: вход ученика, игра в рамке, прогресс на сервере, отметка в ТЕСТОВЫЙ журнал.
// Живой журнал не затрагивается: стенд работает на временной копии данных (см. stand.py).
// Запуск: godot/workshop/build.sh && python tools/publish.py drafts/game-6-robot-workshop.json && python tools/publish.py drafts/game-8-practicum.json && bash tools/trainer/tests/start.sh && node tools/trainer/tests/practicum.test.mjs
import {browser, BASE} from './lib.mjs';
const b = await browser();
const VK = {Space: 32, Escape: 27, Enter: 13, Tab: 9, ArrowDown: 40, Equal: 187};
const key = async (code, pause = 60) => { const vk = VK[code] ?? code.charCodeAt(5); for (const type of ['rawKeyDown', 'keyUp']) await b.send('Input.dispatchKeyEvent', {type, code, key: code === 'Space' ? ' ' : code.startsWith('Digit') ? code[5] : code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk}); await b.sleep(pause); };
const click = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', {type, x, y, button: 'left', clickCount: 1}); await b.sleep(150); };
const G = "document.querySelector('.p-player iframe')?.contentWindow";
const game = name => b.ev(`return ${G}?.${name}`);
const until = (expr, ms = 20000) => b.ev(`await waitFor(()=>{const w=${G};return ${expr}},${ms});`);
const journal = async () => (await fetch(BASE + '/test/journal')).json();
const api = (path, body) => b.ev(`const r=await fetch('/results/api/trainer/${path}',${body ? `{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(body)})}` : '{}'});return r.json()`);
const WHO = {slug: 'trainer-8-practicum', className: '8 «А»', name: 'Проверка Тестовая'};
const before = (await journal()).length;

await b.size(1280, 780);
await b.send('Page.navigate', {url: BASE + '/courses/game-8-practicum/'}); await b.ev("await waitFor(()=>$('.p-login form'));");
b.check('сначала ученик выбирает класс и себя', await b.ev("return $('.p-login select').value==='8 «А»'&&!$('.p-grid')")); await b.shot('practicum-login', 1280, 780, false);
await b.ev("$('[data-field=name]').value='Проверка';$('.p-login form').requestSubmit();"); b.check('одно слово вместо фамилии и имени не принимается', await b.ev("return !$('.p-grid')&&/фамилию/.test($('.p-login .p-status').textContent)"));
await b.ev(`$('[data-field=name]').value='${WHO.name}';$('.p-login form').requestSubmit();await waitFor(()=>$('.p-grid'));`);
b.check('список игр: тридцать игр с отметкой и пять ссылок', await b.ev("return document.querySelectorAll('.p-card').length===30&&document.querySelectorAll('.p-link').length===5")); await b.shot('practicum-list', 1280, 780, true);
b.check('с сервера пришли задание дня, ранг, лига класса и двенадцать значков, пока не полученных', await b.ev("return !!$('.p-daily [data-daily]')&&document.querySelectorAll('.p-badge').length===12&&!!$('.p-rank')&&!!$('.p-league')&&!document.querySelector('.p-badge.got')"));
b.check('без звёзд кнопки отметки нет', await b.ev("return !document.querySelector('[data-mark]')"));

// Аркада в рамке: пройти первый этап «Двоичного десанта».
await b.ev("document.querySelector('[data-play=bits]').click();"); await until("w&&w.arcade&&w.arcade.game==='bits'", 60000); await b.sleep(600);
b.check('игра открывается сразу на нужной аркаде и с ключом ученика', await b.ev(`return /play=bits/.test(${G}.location.search)&&/player=g8[a-z0-9]+/.test(${G}.location.search)`));
await click(640, 420); await until("w.arcade.state==='play'");
for (let shot = 0; shot < 12; shot++) { await until('w.arcade.foes&&w.arcade.foes.length>0'); const s = await game('arcade'), foe = s.foes[0];
  for (let i = 0; i < s.bits; i++) { const want = (foe.value >> (s.bits - 1 - i)) & 1, have = (s.now >> (s.bits - 1 - i)) & 1; if (want !== have) await key('Digit' + (i + 1), 45); }
  await key('Space'); await until(`w.arcade.score===${shot + 1}||w.arcade.state==='over'`, 5000); }
await until("w.arcade.state==='over'&&w.arcade.won", 5000); await b.ev("await waitFor(()=>/★ 3 из 30/.test($('[data-live]').textContent));"); await b.shot('practicum-playing', 1280, 780, false);
await b.sleep(700); let p = await api('progress?' + new URLSearchParams(WHO));
b.check('пройденный этап сохранён на сервере', p.levels?.['bits-1']?.stars === 3, JSON.stringify(p.levels));
await b.ev("document.querySelector('[data-act=close]').click();await waitFor(()=>$('.p-grid'));");
b.check('карточка показывает звёзды, отметки пока нет', await b.ev("return /★ 3 из 30/.test(document.querySelector('[data-play=bits]').closest('.p-card').textContent)&&!document.querySelector('[data-mark]')"));
b.check('в журнал ничего не попало', (await journal()).length === before);

// Ещё три этапа (как будто сыграны) → хватает на тройку → отправка в журнал стенда.
await api('progress', {...WHO, levels: {'bits-2': {stars: 3}, 'bits-3': {stars: 3}, 'bits-4': {stars: 3}}});
await b.send('Page.reload'); await b.ev("await waitFor(()=>$('.p-grid'));");
b.check('после перезагрузки ученик остаётся в игре, прогресс подтянут с сервера', await b.ev("return /Проверка Тестовая/.test($('.p-me').textContent)&&/★ 12 из 30/.test(document.body.textContent)"));
b.check('появилась кнопка отметки 3', await b.ev("return document.querySelector('[data-mark=bits]')?.textContent") === 'Отметка 3 — в журнал');
await b.ev("document.querySelector('[data-mark=bits]').click();await waitFor(()=>/Квитанция/.test(document.body.textContent));"); await b.shot('practicum-mark', 1280, 780, true);
let rows = await journal(), row = rows[rows.length - 1];
b.check('в журнале стенда одна новая строка с отметкой 3', rows.length === before + 1 && row.name === WHO.name && row.cls === WHO.className && row.mark === 3 && row.score === 12 && row.max === 30 && row.topic === '8 класс: Кодоград · практикум · Двоичный десант', JSON.stringify(row));
b.check('кнопка показывает отметку в журнале и больше не нажимается', await b.ev("const m=document.querySelector('[data-mark=bits]');return m.disabled&&m.textContent==='В журнале: 3'"));
await api('progress', {...WHO, levels: {'bits-5': {stars: 3}, 'bits-6': {stars: 3}}});
await b.send('Page.reload'); await b.ev("await waitFor(()=>document.querySelector('[data-mark=bits]'));");
b.check('результат вырос — отметку можно обновить', await b.ev("const m=document.querySelector('[data-mark=bits]');return !m.disabled&&m.textContent") === 'Отметка 4 — в журнал');
await b.ev("document.querySelector('[data-mark=bits]').click();await waitFor(()=>/Квитанция/.test(document.body.textContent));"); rows = await journal();
b.check('строка в журнале обновилась, а не добавилась', rows.length === before + 1 && rows[rows.length - 1].mark === 4 && rows[rows.length - 1].score === 18);

// Мастерская роботов в рамке: первое задание электроцеха.
await b.ev("document.querySelector('[data-play=shop]').click();"); await until("w&&w.workshop&&w.workshop.shop===2&&w.workshop.level===-1", 60000); await b.sleep(500);
await click(640, 420); await key('Digit1'); await until('w.workshop.level===0'); await key('Tab'); await key('Tab');
for (const k of ['Digit6', 'Equal', 'Equal', 'Digit7', 'ArrowDown', 'Digit4', 'ArrowDown', 'Digit1']) await key(k, 90);
b.check('мастерская: программа набрана', (await game('workshop')).blocks === 4);
await key('Enter'); await until('w.workshop.running', 5000); await until('!w.workshop.running', 90000); await b.sleep(900);
p = await api('progress?' + new URLSearchParams(WHO)); b.check('мастерская: задание засчитано и сохранено на сервере', (await game('workshop')).won && p.levels?.['shop-1']?.stars === 3, JSON.stringify(p.levels?.['shop-1']));
await b.ev("document.querySelector('[data-act=close]').click();await waitFor(()=>$('.p-grid'));");

// Другой ученик на том же компьютере начинает с нуля.
await b.ev("window.confirm=()=>true;[...document.querySelectorAll('.p-me button')].pop().click();await waitFor(()=>$('.p-login form'));$('[data-field=name]').value='Другой Ученик';$('.p-login form').requestSubmit();await waitFor(()=>$('.p-grid'));");
b.check('у другого ученика свой прогресс', await b.ev("return /Другой Ученик/.test($('.p-me').textContent)&&/★ 0 из 30/.test(document.body.textContent)&&!document.querySelector('[data-mark]')"));
await b.ev("document.querySelector('[data-play=bits]').click();"); await until("w&&w.arcade&&w.arcade.game==='bits'", 60000);
b.check('и своё сохранение в игре: этапы первого ученика не открыты', (await game('arcade')).stage === 1 && !(await game('arcade')).best?.['8']?.bits);
await b.ev("document.querySelector('[data-act=close]').click();await waitFor(()=>$('.p-grid'));");
// Игра «Лаборатории» в рамке: уровень «Города данных» проходится, звёзды попадают в практикум.
await b.ev("document.querySelector('[data-play=dbcity]').click();"); await b.ev(`await waitFor(()=>${G}&&${G}.labGo,30000)`); await b.sleep(300);
b.check('игра лаборатории открыта в рамке сразу на своей странице уровней', await b.ev(`return /play=dbcity/.test(${G}.location.search)&&!!${G}.document.querySelector('.lab-lgrid')`));
await b.ev(`${G}.labGo('dbcity',1)`); await b.sleep(200); await b.ev(`${G}.labSet(${G}.labNow.solve());${G}.document.querySelector('[data-act=run]').click()`); await b.sleep(900); await b.shot('practicum-lab', 1280, 780, false);
b.check('звёзды за уровень дошли до практикума', await b.ev("return /Город данных · ★ 3 из/.test(document.querySelector('[data-live]').textContent)"), await b.ev("return document.querySelector('[data-live]').textContent"));
await b.ev("document.querySelector('[data-act=close]').click();await waitFor(()=>$('.p-grid'));"); await b.ev("await waitFor(()=>document.querySelector('[data-badge=sprout].got')&&(window.school4Toasts||[]).length,8000).catch(()=>{})");
b.check('значок «Первые шаги» выдан сервером после первого этапа и показан всплывающим окном', await b.ev("return !!document.querySelector('[data-badge=sprout].got')&&(window.school4Toasts||[]).includes('sprout')"), await b.ev("return [...document.querySelectorAll('.p-badge.got')].map(x=>x.dataset.badge).join(',')+' toasts:'+(window.school4Toasts||[])"));
b.check('в лиге класса оба ученика, имена сокращены, у этого ученика ★ 3 за неделю', await b.ev("return /Ученик Д\\./.test($('.p-league').textContent)&&!/Другой Ученик/.test($('.p-league').textContent)&&/2-м месте из 2 \\(★ 3 за неделю\\)/.test($('.p-league').textContent)"), await b.ev("return $('.p-league').textContent"));
// Единый вход: внутри практикума тренажёр «Тенегрыз» берёт имя ученика и не даёт его менять.
await b.ev("sessionStorage.setItem('x','1')");
b.check('имя ученика записано для игр практикума', await b.ev("const w=JSON.parse(sessionStorage.getItem('school4-who'));return w.name==='Другой Ученик'&&w.grade===8"));
// Вход истёк (давно не было действий) — после перезагрузки снова экран входа, чужой профиль не открывается.
await b.ev("const w=JSON.parse(sessionStorage.getItem('school4-who'));w.at-=21*60000;sessionStorage.setItem('school4-who',JSON.stringify(w));location.reload()"); await b.sleep(2500);
b.check('после долгого бездействия вход сброшен — следующий ученик не попадёт в чужой профиль', await b.ev("return !!$('.p-login form')&&!$('.p-grid')"));
await b.ev("$('[data-field=name]').value='Другой Ученик';$('.p-login form').requestSubmit();await waitFor(()=>$('.p-grid'))");
b.check('в списке у игры три звезды и прогресс 1 уровень', await b.ev("return /★ 3 из \\d+ · пройдено 1 из/.test(document.querySelector('[data-play=dbcity]').closest('.p-card').textContent)"));
await b.shot('practicum-mobile', 390, 844, true); b.check('на телефоне нет горизонтальной прокрутки', await b.ev('return document.documentElement.scrollWidth<=innerWidth'));
b.done();
