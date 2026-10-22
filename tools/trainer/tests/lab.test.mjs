// «Лаборатория Кодограда» в браузере: все уровни всех шести игр проходятся образцовыми решениями через настоящий интерфейс.
// Запуск: node tools/lab/tests/lab.test.js && python tools/lab/tests/race_test.py && python tools/publish.py drafts/game-8-lab.json && bash tools/trainer/tests/start.sh && node tools/trainer/tests/lab.test.mjs
import {browser, BASE} from './lib.mjs';
const b = await browser(), URL = BASE + '/courses/game-8-lab/';
const done = (ms = 15000) => b.ev(`await waitFor(()=>window.labDone,${ms});const d=window.labDone;window.labDone=null;return d`);
const click = sel => b.ev(`document.querySelector('${sel}').click()`);
const counts = {blast: 10, runner: 8, bunker: 8, codes: 10, sorting: 8, graphs: 10, turtle: 8, layout: 10, autopilot: 8, ege: 18, arrays: 10, logic: 8, ipnet: 8, oge: 8, sheets: 12, bytes: 10, sets: 10, executors: 23, office: 12, gates: 14, factory: 15, detective: 9, dbcity: 14, pixel: 15, race: 12, quest: 8, turing: 8, sortyard: 12, cipher: 10, archiver: 9};
const CARDS = Object.keys(counts).length, NOART = [];   // у новых игр пока нет обложек (art/cover_<id>.webp)
await b.size(1440, 900); await b.send('Page.navigate', {url: URL}); await b.sleep(800); await b.ev('localStorage.clear()'); await b.send('Page.reload'); await b.ev(`await waitFor(()=>document.querySelectorAll('.lab-card').length===${CARDS},20000);`); await b.sleep(900); await b.shot('lab-hub', 1440, 900, true);
b.check(`${CARDS} игр на странице, у каждой обложка (кроме новых без картинок: ${NOART.join(', ')})`, await b.ev(`return [...document.querySelectorAll('.lab-card img')].filter(i=>i.complete&&i.naturalWidth>100).length===${CARDS - NOART.length}`));
await click('[data-game=factory]'); await b.ev("await waitFor(()=>document.querySelector('.lab-lgrid'))");
b.check('уровни открываются по порядку: первый открыт, второй закрыт (на стенде открыты все для проверки)', await b.ev("return document.querySelectorAll('.lab-level').length===15&&/открыт/.test(document.querySelector('[data-level=\"1\"]').textContent)&&/закрыт/.test(document.querySelector('[data-level=\"2\"]').textContent)"));
for (const [id, n] of Object.entries(counts)) { let ok = true, info = '';
  for (let lv = 1; lv <= n && ok; lv++) { await b.ev(`window.labDone=null;labGo('${id}',${lv})`); await b.sleep(120);
    if (id === 'detective') { const steps = await b.ev('return window.labNow.level.steps.length');
      for (let s = 0; s < steps; s++) { const st = await b.ev('return window.labStep');
        if (st.type === 'input') await b.ev(`const i=document.querySelector('[data-answer]');i.value=${JSON.stringify(st.answer)}`); else for (const i of st.type === 'flag' ? st.bad : st.type === 'one' ? [st.right] : st.items.map((_, k) => k)) await click(`.de-item[data-i="${i}"]`);
        if (lv === 1 && s === 0) await b.shot('lab-detective', 1440, 900, false); await click('.de-step [data-act=run]'); await b.sleep(60); await click('[data-act=next-step]'); await b.sleep(60); } }
    else { const kind = await b.ev('return window.labNow.level.kind||""'); await b.ev(id === 'turtle' ? 'window.labSet(window.labNow.solve())' : 'window.labSet(window.labNow.solve().code||window.labNow.solve())'); if ((id === 'factory' && lv === 13) || (id === 'dbcity' && lv === 14) || (id === 'pixel' && lv === 9) || (id === 'race' && lv === 11) || (id === 'quest' && lv === 8) || (id === 'office' && lv === 11) || (id === 'gates' && lv === 13) || (id === 'executors' && (lv === 6 || lv === 12)) || (id === 'sheets' && lv === 5) || (id === 'sets' && lv === 4) || (id === 'oge' && lv === 6) || (id === 'pcbuild' && (lv === 3 || lv === 4 || lv === 7)) || (id === 'layout' && lv === 9) || (id === 'autopilot' && lv === 6) || (id === 'arrays' && lv === 6) || (id === 'ipnet' && lv === 3) || (id === 'bytes' && lv === 6) || (id === 'logic' && lv === 3)) { await b.sleep(900); await b.shot('lab-' + id + (id === 'executors' ? lv : ''), 1440, 900, false); }
      if (id === 'pixel' && kind === 'calc') await click('.px-form .lab-main'); else if (id === 'office') await click('[data-act=fast]'); else if (await b.ev("return !!document.querySelector('[data-act=run]')")) await click('[data-act=run]');   // у «Карты дорог» маршрут проверяется сам, без кнопки
      if (id === 'quest' && lv === 1) for (const d of ['север', 'север', 'восток']) { await b.sleep(80); await click(`[data-dir="${d}"]`); } }
    const r = await done().catch(() => null); if (!r || r.stars !== 3 || r.n !== lv) { ok = false; info = `уровень ${lv}: ${JSON.stringify(r)} · ${await b.ev("return (document.querySelector('.lab-msg')||{}).textContent||''")}`; } }
  b.check(`${id}: все ${n} уровней проходятся в браузере на три звезды`, ok, info); }
// Неверные ответы не засчитываются.
await b.ev("window.labDone=null;labGo('factory',4)"); await b.sleep(150); await b.ev("labSet([['odd'],['sum']])"); await click('[data-act=run]'); await b.sleep(1800);
b.check('завод: неверная цепочка не засчитывается, игра объясняет почему', await b.ev("return !window.labDone&&/не совпал|друг/.test(document.querySelector('.lab-msg').textContent)"));
await b.ev("labGo('quest',2)"); await b.sleep(150); await click('[data-act=run]'); await b.sleep(300);
b.check('экспедиция: ошибка в коде показана по-русски, игра не запускается', await b.ev("return !window.labDone&&/зла/.test(document.querySelector('.lab-msg').textContent)"));
// Звёзды сохраняются и видны в списке уровней.
await b.send('Page.navigate', {url: URL + '?play=race'}); await b.ev("await waitFor(()=>document.querySelector('.lab-lgrid'),20000)"); await b.sleep(400); await b.shot('lab-levels', 1440, 900, true);
b.check('прямая ссылка ?play=race открывает игру; звёзды сохранились', await b.ev("return document.querySelectorAll('.lab-level.done').length===12&&/★ 36 из 36/.test(document.querySelector('.lab-total').textContent)"));
// Гонка класса: ученик в браузере, второй — программный, учитель запускает задание.
const api = async (p, body) => (await fetch(BASE + '/results/api/race/' + p, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})).json();
await fetch(BASE + '/test/teacher/0'); await b.send('Page.reload'); await b.ev("await waitFor(()=>document.querySelector('[data-act=race-join]'),20000)");
await b.ev("document.querySelector('.ra-join select').value='8 «Г»';document.querySelector('.ra-join input').value='Браузер Гонщик';document.querySelector('[data-act=race-join]').click()"); await b.ev("await waitFor(()=>window.labRace)");
b.check('ученик вошёл в гонку и ждёт задания; управления учителя у него нет', await b.ev("return /Ждём/.test(document.querySelector('.ra-race').textContent)&&!document.querySelector('[data-act=race-start]')"));
const bot = await api('join', {className: '8 «Г»', name: 'Бот Соперник'}); b.check('ученик не может запустить задание', (await api('teacher', {className: '8 «Г»', action: 'start', title: 'x', map: ['S.G'], dir: 1, minutes: 3})).status === 'error');
await fetch(BASE + '/test/teacher/1'); const lvl = await b.ev("return LAB.games.find(g=>g.id==='race').LEVELS[3]"); await api('teacher', {className: '8 «Г»', action: 'start', title: lvl.title, map: lvl.map, dir: lvl.dir, minutes: 5}); await fetch(BASE + '/test/teacher/0');
await b.ev("await waitFor(()=>document.querySelector('[data-act=race-send]'),8000)"); const flat = ['F', 'L', 'F', 'R', 'F', 'L', 'F', 'R', 'F', 'L', 'F', 'R'];
b.check('программный соперник прислал длинное решение', (await api('submit', {className: '8 «Г»', id: bot.id, token: bot.token, task: 1, program: flat})).size === 12);
for (const k of ['Digit3', 'ArrowUp', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) { const key = k.startsWith('Digit') ? k[5] : k; await b.send('Input.dispatchKeyEvent', {type: 'rawKeyDown', code: k, key, windowsVirtualKeyCode: {ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, ArrowDown: 40}[k] || 51}); await b.send('Input.dispatchKeyEvent', {type: 'keyUp', code: k, key}); await b.sleep(80); }
b.check('программа набирается с клавиатуры: повтор и команды', await b.ev("return /повтори 3 раз:\\n    вперёд\\n    налево\\n    вперёд\\n    направо/.test(document.querySelector('.ra-race .ra-prog').textContent)&&/Команд: 5/.test(document.querySelector('.ra-race .ra-size').textContent)"));
await click('[data-act=race-send]'); await b.ev("await waitFor(()=>window.labRace&&window.labRace.board.length===2&&window.labRace.board[0].me,15000)"); await b.sleep(500); await b.shot('lab-race-class', 1440, 900, true);
b.check('короткая программа ученика — на первом месте, чужих решений пока не видно', await b.ev("const d=window.labRace;return d.board[0].size===5&&d.board[1].size===12&&!('program' in d.board[1])&&d.phase==='run'"));
await fetch(BASE + '/test/teacher/1'); await api('teacher', {className: '8 «Г»', action: 'stop'}); await fetch(BASE + '/test/teacher/0'); await b.ev("await waitFor(()=>window.labRace.phase==='done'&&window.labRace.board[1].program,8000)"); await b.sleep(300);
b.check('после завершения решения всех участников показаны для разбора', await b.ev("return document.querySelectorAll('.ra-race .lab-table .lab-code').length===2&&document.querySelector('[data-act=race-send]').disabled"));
await fetch(BASE + '/test/teacher/1'); await api('teacher', {className: '8 «Г»', action: 'clear'}); await fetch(BASE + '/test/teacher/0');
await b.size(390, 800); await b.send('Page.navigate', {url: URL}); await b.ev(`await waitFor(()=>document.querySelectorAll('.lab-card').length===${CARDS},20000)`); b.check('на телефоне нет горизонтальной прокрутки', await b.ev('return document.documentElement.scrollWidth<=innerWidth'));
b.done();
