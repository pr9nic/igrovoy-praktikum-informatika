// «Герой кода» в настоящем браузере: карта уровней, редактор, ошибки, запуск, звёзды, работа внутри практикума.
// Запуск: node tools/codehero/tests/levels.test.js && bash tools/trainer/tests/start.sh && node tools/trainer/tests/codehero.test.mjs
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {browser, BASE} from './lib.mjs';
const SOL = createRequire(import.meta.url)('../../codehero/tests/solutions.js');
const b = await browser();
const st = () => b.ev('return window.codehero');
const until = (expr, ms = 30000) => b.ev(`await waitFor(()=>{const c=window.codehero;return ${expr}},${ms});`);
await b.size(1366, 860);
await b.send('Page.navigate', {url: BASE + '/courses/game-8-codehero/'}); await b.ev("await waitFor(()=>$('.ch-map'));");
b.check('карта: 12 глав с сюжетом, 37 уровней, открыт только первый', await b.ev("return document.querySelectorAll('.ch-chapter').length===12&&document.querySelectorAll('.ch-tale').length===12&&document.querySelectorAll('.ch-node').length===37&&document.querySelectorAll('.ch-node:not(:disabled)').length===1"));
b.check('дополнительные уровни помечены (в отметку 8 класса идут 1–16)', await b.ev("return document.querySelectorAll('.ch-node.extra').length===21")); await b.shot('code-map', 1366, 860, true);
await b.ev("document.querySelector('[data-level=\"1\"]').click();await waitFor(()=>$('.ch-level'));"); await b.sleep(700); await b.shot('code-level1', 1366, 860, false);
b.check('уровень: редактор с заготовкой, цели и справочник команд', await b.ev("return $('.ch-editor textarea').value.includes('hero.moveRight()')&&document.querySelectorAll('.ch-goals li').length===3&&document.querySelectorAll('.ch-doc').length===1"));
// Ошибки: опечатка в команде и незакрытая скобка — понятное сообщение и красная строка.
await b.ev("codeheroApi.setCode('hero.moveRight()\\nhero.moveright()');codeheroApi.run();"); await until('c.error&&!c.running');
b.check('опечатка в команде: подсказка и номер строки', /Строка 2.*moveRight/.test((await st()).message) && await b.ev("return document.querySelectorAll('.ch-gutter .err').length===1"), (await st()).message); await b.shot('code-error', 1366, 860, false);
await b.ev("codeheroApi.setCode('hero.moveRight(');codeheroApi.run();"); await b.sleep(200); b.check('синтаксическая ошибка не запускает героя', /Строка 1/.test((await st()).message) && !(await st()).running);
// Неполная программа: герой идёт, цель не достигнута.
await b.ev("$('[data-act=reset]').click();document.querySelector('.ch-actions .ch-btn').click();document.querySelector('.ch-actions .ch-btn').click();codeheroApi.run();"); await until('c.error&&!c.running'); b.check('неполная программа: понятно, чего не хватило', /не дошёл до выхода/.test((await st()).message), (await st()).message);
// Вставка команды из справочника и клавиатура редактора.
await b.ev("$('[data-act=reset]').click();const t=$('.ch-editor textarea');t.focus();t.selectionStart=t.selectionEnd=t.value.length;$('.ch-doc').click();");
b.check('щелчок по команде вставляет её в программу', await b.ev("return ($('.ch-editor textarea').value.match(/hero\\.moveRight\\(\\)/g)||[]).length") === 2);
// Прохождение всех 37 уровней эталонными решениями.
for (let id = 1; id <= 37; id++) {
  if (id > 1) { await b.ev(`document.querySelector('[data-act=next]')?document.querySelector('[data-act=next]').click():(document.querySelector('[data-act=map]').click(),document.querySelector('[data-level="${id}"]').click());await waitFor(()=>window.codehero.level===${id});`); await b.sleep(250); }
  if ([13, 17, 27, 30, 34, 36].includes(id)) await b.shot(`code-level${id}`, 1366, 860, false);
  await b.ev(`codeheroApi.setCode(${JSON.stringify(SOL[id])});codeheroApi.run();`); await b.sleep(400); if (id === 8 || id === 21) await b.shot(`code-run${id}`, 1366, 860, false); if ([23, 28, 32, 35, 36, 37].includes(id)) { await b.sleep(1500); await b.shot(`code-run${id}`, 1366, 860, false); }
  await until('!c.running&&(c.won||c.error)', 90000); const s = await st();
  b.check(`уровень ${id}: эталон проходит на три звезды`, s.won && s.stars[id] === 3, s.message);
  if (id === 7) await b.shot('code-win', 1366, 860, false); if (id === 37) { await b.shot('code-final', 1366, 860, false); b.check('финал: эпилог сюжета', await b.ev("return /Глюк повержен/.test($('.ch-win').textContent)&&!!$('.ch-win .ch-tale')")); }
}
await b.ev("document.querySelector('[data-act=map]').click();await waitFor(()=>$('.ch-map'));"); await b.shot('code-map-done', 1366, 860, true);
b.check('карта: все уровни пройдены, отметка 5', await b.ev("return document.querySelectorAll('.ch-node.done').length===37&&/отметка: 5/.test($('.ch-stat').textContent)"));
await b.send('Page.reload'); await b.ev("await waitFor(()=>$('.ch-map'));"); b.check('прогресс и код сохраняются в браузере', await b.ev("return document.querySelectorAll('.ch-node.done').length===37"));
await b.size(390, 844); await b.sleep(300); b.check('на телефоне нет горизонтальной прокрутки', await b.ev('return document.documentElement.scrollWidth<=innerWidth')); await b.size(1366, 860);

// Внутри практикума: результат уходит на сервер стенда под именем ученика.
const WHO = {slug: 'trainer-8-practicum', className: '8 «Б»', name: 'Кодов Герой'};
await b.send('Page.navigate', {url: BASE + '/courses/game-8-practicum/'}); await b.ev("await waitFor(()=>$('.p-login form'));");
await b.ev(`$('.p-login select').value='${WHO.className}';$('.p-login select').dispatchEvent(new Event('change'));$('[data-field=name]').value='${WHO.name}';$('.p-login form').requestSubmit();await waitFor(()=>$('.p-grid'));`);
b.check('практикум: «Герой кода» стоит первым в списке, всего тридцать игр', await b.ev("return document.querySelectorAll('.p-card').length===30&&/Герой кода/.test($('.p-card h3').textContent)"));
await b.ev("document.querySelector('[data-play=code]').click();"); const F = "document.querySelector('.p-player iframe').contentWindow";
await b.ev(`await waitFor(()=>${F}.codehero&&${F}.document.querySelector('.ch-map'),30000);`);
b.check('в практикуме у ученика свой чистый прогресс', await b.ev(`return ${F}.document.querySelectorAll('.ch-node.done').length===0&&/embed=1/.test(${F}.location.search)&&/player=g8/.test(${F}.location.search)`));
await b.ev(`${F}.document.querySelector('[data-level="1"]').click();await waitFor(()=>${F}.codeheroApi);${F}.codeheroApi.setCode(${JSON.stringify(SOL[1])});${F}.codeheroApi.run();await waitFor(()=>${F}.codehero.won,60000);`); await b.sleep(900);
const p = await b.ev(`const r=await fetch('/results/api/trainer/progress?'+new URLSearchParams(${JSON.stringify(WHO)}));return r.json()`);
b.check('пройденный уровень сохранён на сервере на имя ученика', p.levels?.['code-1']?.stars === 3, JSON.stringify(p.levels)); await b.shot('code-in-practicum', 1366, 860, false);
await b.ev("document.querySelector('[data-act=close]').click();await waitFor(()=>$('.p-grid'));"); b.check('карточка практикума показывает звёзды «Героя кода»', await b.ev("return /★ 3 из 48/.test($('.p-card').textContent)"));
b.done();
