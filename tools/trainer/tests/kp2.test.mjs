// «Кодополия» по сети без ботов: двое в лобби, создатель снимает галочку «Боты» и начинает — за столом ровно два игрока.
import {browser, BASE} from './lib.mjs';
const A = await browser({newWindow: true}), B = await browser({newWindow: true}), CLS = '8 «Е»';
const login = async (b, name) => { await b.size(1440, 900); await b.send('Page.navigate', {url: BASE + '/courses/game-8-practicum/'}); await b.ev("await waitFor(()=>$('.p-login form'))");
  await b.ev(`$('.p-login select').value='${CLS}';$('.p-login select').dispatchEvent(new Event('change'));$('[data-field=name]').value='${name}';$('.p-login form').requestSubmit();await waitFor(()=>$('[data-act=kp]'))`); };
await login(A, 'Безботов Андрей'); await login(B, 'Вдвоём Борис');
await A.ev("$('[data-act=kp]').click();await waitFor(()=>$('[data-field=kp-title]'));$('[data-field=kp-title]').value='Без ботов';$('[data-act=kp-create]').click();await waitFor(()=>$('.kp-lobby'))");
await B.ev("$('[data-act=kp]').click();await waitFor(()=>[...document.querySelectorAll('.kp-card b')].some(x=>x.textContent==='Без ботов'),8000);[...document.querySelectorAll('.kp-card')].find(c=>c.querySelector('b').textContent==='Без ботов').querySelector('[data-join]').click();await waitFor(()=>$('.kp-lobby'),5000)");
await A.ev("await waitFor(()=>$('[data-field=kp-bots]')&&$('[data-act=kp-start]'),6000)");
A.check('у создателя галочка «Боты на свободные места» (включена) и кнопка «Начать партию»', await A.ev("return $('[data-field=kp-bots]').checked===true"));
await A.ev("$('[data-field=kp-bots]').click(); $('[data-act=kp-start]').click()");
const src = async b => b.ev("await waitFor(()=>$('.p-player iframe')&&/net=1/.test($('.p-player iframe').src),9000);return $('.p-player iframe').src");
const sa = await src(A), sb = await src(B);
for (const [b, s] of [[A, sa], [B, sb]]) { await b.size(1280, 720); await b.send('Page.navigate', {url: s}); }
for (const b of [A, B]) { await b.send('Emulation.setFocusEmulationEnabled', {enabled: true}); await b.ev('await waitFor(()=>window.arcade&&window.arcade.game==="board"&&window.arcade.state==="play",90000)'); }
await A.sleep(2500);
const pa = await A.ev('return window.arcade.players.length'), pb = await B.ev('return window.arcade.players.length');
A.check('без ботов: у обоих за столом ровно два игрока', pa === 2 && pb === 2, `${pa} / ${pb}`);
await A.shot('kp-2players', 1280, 720, false);
A.done();
