// «Бункер» по сети: двое учеников в браузере и третий по сети — лобби, открытие карт, голосование, испытания, итог.
// Запуск: python tools/publish.py drafts/game-8-practicum.json && bash tools/trainer/tests/start.sh && node tools/trainer/tests/bunker.test.mjs
import {browser, BASE} from './lib.mjs';
const A = await browser({newWindow: true}), B = await browser({newWindow: true}), CLS = '8 «Д»';
const login = async (b, name) => { await b.size(1440, 900); await b.send('Page.navigate', {url: BASE + '/courses/game-8-practicum/'}); await b.ev("await waitFor(()=>$('.p-login form'))");
  await b.ev(`$('.p-login select').value='${CLS}';$('.p-login select').dispatchEvent(new Event('change'));$('[data-field=name]').value='${name}';$('.p-login form').requestSubmit();await waitFor(()=>$('[data-act=bk]'))`); };
await login(A, 'Бункеров Антон'); await login(B, 'Запасова Белла');
await A.ev("$('[data-act=bk]').click();await waitFor(()=>$('[data-field=bk-title]'));$('[data-field=bk-title]').value='Бункер 17';$('[data-act=bk-create]').click();await waitFor(()=>$('.bn-lobby'))");
await B.ev("$('[data-act=bk]').click();await waitFor(()=>[...document.querySelectorAll('.kp-card b')].some(x=>x.textContent==='Бункер 17'),8000);[...document.querySelectorAll('.kp-card')].find(c=>c.querySelector('b').textContent==='Бункер 17').querySelector('[data-join]').click();await waitFor(()=>$('.bn-lobby'),5000)");
const P = (path, body) => fetch(BASE + '/results/api/bunker/' + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}).then(r => r.json());
const tid = (await P('list', {className: CLS})).tables.find(t => t.title === 'Бункер 17').id;
const C = await P('join', {className: CLS, name: 'Третий Вова', table: tid});
await A.ev("await waitFor(()=>document.querySelectorAll('.kp-seat.on').length===3&&$('[data-act=bk-start]')&&!$('[data-act=bk-start]').disabled,6000)");
A.check('лобби: трое, у создателя кнопка «Начать партию», у гостя — нет', await B.ev("return !$('[data-act=bk-start]')"));
await A.ev("$('[data-act=bk-start]').click()");
for (const b of [A, B]) await b.ev("await waitFor(()=>$('.bn-grid')&&$('[data-open]'),8000)");
A.check('партия началась: у каждого свои карты и кнопки «Открыть»', await A.ev("return document.querySelectorAll('.bn-card').length===3&&document.querySelectorAll('.bn-card.me .bn-attr.secret').length===4") && await B.ev("return document.querySelectorAll('.bn-card.me .bn-attr.secret').length===4"));
A.check('чужие закрытые карты — «?»', await A.ev("return [...document.querySelectorAll('.bn-card:not(.me) .bn-attr span')].filter(s=>s.textContent==='?').length>=8"));
await A.shot('bunker-reveal', 1440, 900, false);
// раунд 1: каждый открывает карту
await A.ev("$('[data-open=skill]').click()"); await B.ev("$('[data-open=item]').click()"); await P('act', {table: tid, token: C.token, type: 'open', card: 'health'});
for (const b of [A, B]) await b.ev("await waitFor(()=>document.querySelector('.bn-vote'),8000)");
A.check('все открыли по карте — голосование; навык создателя виден другу', await B.ev("return [...document.querySelectorAll('.bn-card')][0].querySelectorAll('.bn-attr.open').length===2"));
await A.shot('bunker-vote', 1440, 900, false);
// голосуем против Вовы (место 2)
await A.ev("$('[data-vote=\"2\"]').click()"); await B.ev("$('[data-vote=\"2\"]').click()"); await P('act', {table: tid, token: C.token, type: 'vote', target: 0});
await A.ev("await waitFor(()=>/не попадает/.test(document.body.textContent),8000)");
A.check('большинство против Вовы — он не попадает в бункер', await A.ev("return /не попадает: Вова Т\\./.test(document.body.textContent)"));
await A.ev("await waitFor(()=>$('.bn-trials')&&$('.bn-opt'),15000)");
A.check('в бункере двое — испытания по информатике', await A.ev("return document.querySelectorAll('.bn-q').length>=3"));
await A.shot('bunker-trials', 1440, 900, false);
// отвечаем верно (берём правильный ответ из состояния сервера на стенде)
for (const [b, name] of [[A, 'Бункеров Антон'], [B, 'Запасова Белла']]) await b.ev(`const t=window.__bkRight||null;return 1`);
const tb = await fetch(BASE + '/test/bunker/' + tid).then(r => r.ok ? r.json() : null).catch(() => null);
const rights = tb && tb.rights;
for (const b of [A, B]) {
  const n = await b.ev("return document.querySelectorAll('.bn-q').length");
  for (let k = 0; k < n; k++) { const j = rights ? rights[k] : 0; await b.ev(`const x=[...document.querySelectorAll('.bn-q')][${k}].querySelectorAll('.bn-opt')[${j}]; if(!x.disabled) x.click(); else [...document.querySelectorAll('.bn-q')][${k}].querySelector('.bn-opt:not([disabled])').click()`); await b.sleep(250); }
}
await A.ev("await waitFor(()=>$('.bn-result'),15000)");
A.check('итог: у всех видна таблица испытаний и раскрыты все карты', await A.ev("return document.querySelectorAll('.bn-result p').length>=3&&![...document.querySelectorAll('.bn-attr span')].some(s=>s.textContent==='?')") && await B.ev("await waitFor(()=>$('.bn-result'),8000);return true"));
if (rights) A.check('все ответили верно — бункер выстоял', await A.ev("return /Бункер выстоял/.test(document.body.textContent)"));
await A.shot('bunker-end', 1440, 900, false);
A.done();
