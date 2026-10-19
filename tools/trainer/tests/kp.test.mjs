// «Кодополия» по сети: создатель лобби и друг — в двух вкладках браузера, ещё двое входят по сети;
// вчетвером партия стартует сама, у обоих открывается сетевая игра, ходы гостя доходят до создателя, итог одинаковый.
import {browser, BASE} from './lib.mjs';
const A = await browser({newWindow: true}), B = await browser({newWindow: true}), CLS = '8 «Г»';
const login = async (b, name) => { await b.size(1440, 900); await b.send('Page.navigate', {url: BASE + '/courses/game-8-practicum/'}); await b.ev("await waitFor(()=>$('.p-login form'))");
  await b.ev(`$('.p-login select').value='${CLS}';$('.p-login select').dispatchEvent(new Event('change'));$('[data-field=name]').value='${name}';$('.p-login form').requestSubmit();await waitFor(()=>$('[data-act=kp]'))`); };
await login(A, 'Лобов Андрей'); await login(B, 'Гостев Борис');
await A.ev("$('[data-act=kp]').click();await waitFor(()=>$('[data-field=kp-title]'));$('[data-field=kp-title]').value='Команда 17';$('[data-act=kp-create]').click();await waitFor(()=>$('.kp-lobby'))");
A.check('создатель создал лобби «Команда 17» и сидит в нём', await A.ev("return $('.kp-lobby h2').textContent==='Команда 17'&&document.querySelectorAll('.kp-seat.on').length===1"));
await B.ev("$('[data-act=kp]').click();await waitFor(()=>[...document.querySelectorAll('.kp-card b')].some(x=>x.textContent==='Команда 17'),8000)");
A.check('друг видит лобби в списке класса', true); await B.shot('kp-list', 1440, 900, false);
await B.ev("[...document.querySelectorAll('.kp-card')].find(c=>c.querySelector('b').textContent==='Команда 17').querySelector('[data-join]').click();await waitFor(()=>$('.kp-lobby'),5000)");
await A.ev("await waitFor(()=>document.querySelectorAll('.kp-seat.on').length===2&&$('[data-act=kp-start]'),6000)");
A.check('у создателя двое в лобби и кнопка «Начать сейчас»; у друга её нет', await B.ev("return !$('[data-act=kp-start]')"));
await A.shot('kp-lobby', 1440, 900, false);
const P = (path, body) => fetch(BASE + '/results/api/kp/' + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}).then(r => r.json());
const tid = (await P('list', {className: CLS})).tables.find(t => t.title === 'Команда 17').id;
await P('join', {className: CLS, name: 'Третьяков Виктор', table: tid}); const last = await P('join', {className: CLS, name: 'Четверикова Галина', table: tid});
A.check('четвёртый вошёл — партия началась сама', last.started === true);
const src = async b => b.ev("await waitFor(()=>$('.p-player iframe')&&/net=1/.test($('.p-player iframe').src),9000);return $('.p-player iframe').src");
const sa = await src(A), sb = await src(B); A.check('у обоих открылась сетевая «Кодополия»', /play=board/.test(sa) && /play=board/.test(sb));
for (const [b, s] of [[A, sa], [B, sb]]) { await b.size(1280, 720); await b.send('Page.navigate', {url: s}); }
const st = b => b.ev('return window.arcade||{}');
for (const b of [A, B]) { await b.send('Emulation.setFocusEmulationEnabled', {enabled: true}); await b.ev('await waitFor(()=>window.arcade&&window.arcade.game==="board",90000)'); }
await A.sleep(3000); A.check('обе игры запущены', (await st(A)).state === 'play' && (await st(B)).state === 'play', JSON.stringify([(await st(A)).state, (await st(B)).state]));
let a = await st(A), g = await st(B);
A.check('создатель ведёт партию (место 0), друг — гость (место 1), остальные двое — люди, а не боты', a.net === 'host' && a.my === 0 && g.net === 'guest' && g.my === 1 && /Андрей Л\. \(ты\)/.test(a.names[0]) && /Борис Г\. \(ты\)/.test(g.names[1]), JSON.stringify([a.names, g.names, a.net, g.net]));
const VK = {Space: 32};
const key = async (b, c) => { const k = c === 'Space' ? {key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32} : {key: c[5], code: c, windowsVirtualKeyCode: c.charCodeAt(5), nativeVirtualKeyCode: c.charCodeAt(5)}; await b.send('Input.dispatchKeyEvent', {type: 'rawKeyDown', ...k}); await b.send('Input.dispatchKeyEvent', {type: 'keyUp', ...k}); };
let guestRolls = 0, guestAnswers = 0, guestMini = 0, shots = 0; const t0 = Date.now();
while (Date.now() - t0 < 1200000) {
  a = await st(A); g = await st(B); if (a.state !== 'play' && g.state !== 'play') break;
  for (const [b, s, guest] of [[A, a, false], [B, g, true]]) {
    if (s.state !== 'play') continue;
    if (s.myroll) { await key(b, 'Space'); if (guest) { guestRolls++; if (shots++ < 1) await B.shot('kp-guest-turn', 1280, 720, false); } }
    else if (s.phase === 'dialog' && s.dialog.mine) { await key(b, 'Digit' + ((s.dialog.right >= 0 ? s.dialog.right : 0) + 1)); if (guest) guestAnswers++; }
    else if (s.phase === 'mini' && s.mini.pick === -1) { await key(b, 'Digit' + ((s.mini.right >= 0 ? s.mini.right : 0) + 1)); if (guest) { guestMini++; if (guestMini === 1) await B.shot('kp-guest-mini', 1280, 720, false); } }
  }
  await A.sleep(400);
}
await A.sleep(2500); a = await st(A); g = await st(B);
A.check('партия доиграна у обоих: 8 раундов и итог', a.state === 'over' && g.state === 'over' && a.round > 8, JSON.stringify({a: [a.state, a.round], g: [g.state, g.round]}));
A.check('гость сам бросал кубик, отвечал и играл мини-игры', guestRolls >= 4 && guestAnswers >= 1 && guestMini >= 3, JSON.stringify({guestRolls, guestAnswers, guestMini}));
A.check('счёт у создателя и гостя совпадает', JSON.stringify(a.bytes) === JSON.stringify(g.bytes), JSON.stringify([a.bytes, g.bytes]));
A.check('каждый видит своё место', a.place >= 1 && g.place >= 1 && a.place !== g.place, JSON.stringify([a.place, g.place]));
await A.shot('kp-host-final', 1280, 720, false); await B.shot('kp-guest-final', 1280, 720, false);
B.done !== A.done; A.done();
