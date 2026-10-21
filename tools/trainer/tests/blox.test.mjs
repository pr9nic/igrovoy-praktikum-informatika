// «Кодоблокс» с классом: два ученика в двух окнах видят друг друга, быстрый чат доходит, стеклянная плитка общая,
// в «Студии» программа на Python строит блоки и засчитывает задание.
// Запуск: godot/workshop/build.sh && python tools/publish.py drafts/game-6-robot-workshop.json && CHROME_GL='--use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist --enable-gpu' bash tools/trainer/tests/start.sh && node tools/trainer/tests/blox.test.mjs
import {browser, BASE} from './lib.mjs';
const A = await browser({newWindow: true}), B = await browser({newWindow: true});
const VK = {KeyT: 84, Digit1: 49, Digit2: 50, Escape: 27, KeyA: 65, F2: 113};
const key = async (b, c) => { for (const type of ['rawKeyDown', 'keyUp']) await b.send('Input.dispatchKeyEvent', {type, code: c, key: c, windowsVirtualKeyCode: VK[c], nativeVirtualKeyCode: VK[c]}); await b.sleep(80); };
const click = async (b, x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', {type, x, y, button: 'left', clickCount: 1}); await b.sleep(120); };
const st = b => b.ev('return window.arcade');
// Печать как с клавиатуры: Godot берёт текст из нажатий клавиш (Enter — новая строка с автоотступом).
const type = async (b, text) => { for (const ch of text) { if (ch === '\n') { for (const t of ['rawKeyDown', 'keyUp']) await b.send('Input.dispatchKeyEvent', {type: t, code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13}); } else { await b.send('Input.dispatchKeyEvent', {type: 'keyDown', text: ch, key: ch, unmodifiedText: ch}); await b.send('Input.dispatchKeyEvent', {type: 'keyUp', key: ch}); } await b.sleep(15); } };
const open = async (b, name) => {
  await b.size(1280, 720);
  await b.send('Page.navigate', {url: BASE + '/courses/game-8-practicum/'}); await b.sleep(800);
  await b.ev(`sessionStorage.setItem('school4-who', JSON.stringify({grade: 8, className: '8 «А»', name: ${JSON.stringify(name)}, at: Date.now()}))`);
  await b.send('Page.navigate', {url: BASE + '/courses/game-6-robot-workshop/game/index.html?game=arcade&grade=8&play=blox'});
  await b.ev('await waitFor(()=>window.arcade&&window.arcade.game==="blox",90000)'); await b.sleep(1500);
};
await open(A, 'Петрова Аня'); await open(B, 'Иванов Боря');
await click(A, 232 + 124, 66 + 140); await b_wait(A); await click(B, 232 + 124, 66 + 140); await b_wait(B);
async function b_wait(b) { await b.ev('await waitFor(()=>window.arcade.state==="play"&&window.arcade.joined,20000)'); }
await A.sleep(2500);
let a = await st(A), bb = await st(B);
A.check('оба в обби класса 8 «А»: ники с сервера', a.nick === 'Аня П.' && bb.nick === 'Боря И.', `${a.nick} / ${bb.nick}`);
A.check('Аня видит Борю, Боря видит Аню — ботов нет', a.remotes.join() === 'Боря И.' && bb.remotes.join() === 'Аня П.', `${a.remotes} / ${bb.remotes}`);
await key(A, 'KeyT'); await key(A, 'Digit1'); await A.sleep(1500); bb = await st(B);
A.check('быстрый чат: «Привет!» Ани дошёл до Бори', bb.chat.some(c => c === 'Аня П.: Привет!'), bb.chat.join(' | '));
await A.shot('blox-net-a', 1280, 720, false); await B.shot('blox-net-b', 1280, 720, false);
// Студия: Боря пишет программу
await key(B, 'Escape'); await B.sleep(600); await click(B, 232 + 0 * 258 + 124, 66 + 294 + 140);
await B.ev('await waitFor(()=>window.arcade.state==="play"&&window.arcade.exp==="studio",20000)'); await B.sleep(1500);
await click(B, 1000, 400); await B.send('Input.dispatchKeyEvent', {type: 'rawKeyDown', code: 'KeyA', key: 'a', windowsVirtualKeyCode: 65, modifiers: 2}); await B.send('Input.dispatchKeyEvent', {type: 'keyUp', code: 'KeyA', key: 'a', windowsVirtualKeyCode: 65, modifiers: 2});
await type(B, 'for x in range(8):\nplace(x, 0, 0)');
await B.sleep(300); await click(B, 836 + 68, 568); await B.sleep(800); bb = await st(B);
A.check('студия: программа построила стену из 8 блоков — задание засчитано', bb.built === 8 && bb.st_ok, `${bb.built} ${bb.st_msg}`);
await B.shot('blox-studio', 1280, 720, false);
await click(B, 836 + 146 + 68, 568); await B.sleep(500); await click(B, 1000, 400);
await B.send('Input.dispatchKeyEvent', {type: 'rawKeyDown', code: 'KeyA', key: 'a', windowsVirtualKeyCode: 65, modifiers: 2}); await B.send('Input.dispatchKeyEvent', {type: 'keyUp', code: 'KeyA', key: 'a', windowsVirtualKeyCode: 65, modifiers: 2});
await type(B, 'for x in range(6)\nplace(x, 0, 0)'); await click(B, 836 + 68, 568); await B.sleep(600); bb = await st(B);
A.check('студия: ошибка Python показана по-русски с номером строки', bb.task === 1 && /строка 1/.test(bb.st_msg) && !bb.st_ok, bb.st_msg);
await B.shot('blox-studio-err', 1280, 720, false);
a = await st(A); A.check('Боря ушёл в Студию — из обби Ани он пропал', a.remotes.length === 0, a.remotes.join());
// «Пол — это лава»: оба в одном раунде с одним вопросом (часы сервера)
await key(A, 'Escape'); await A.sleep(500); await click(A, 232 + 2 * 258 + 124, 66 + 294 + 140);
await key(B, 'Escape'); await B.sleep(500); await click(B, 232 + 2 * 258 + 124, 66 + 294 + 140);
await A.ev('await waitFor(()=>window.arcade.exp==="lava"&&window.arcade.joined&&window.arcade.lava_q,20000)'); await B.ev('await waitFor(()=>window.arcade.exp==="lava"&&window.arcade.joined&&window.arcade.lava_q,20000)');
await A.sleep(1500); a = await st(A); bb = await st(B);
await A.sleep(2000); a = await st(A); bb = await st(B); A.check('лава: у Ани и Бори один раунд и один вопрос, они видят друг друга', a.lava_round === bb.lava_round && a.lava_q === bb.lava_q && a.remotes.join() === 'Боря И.' && bb.remotes.join() === 'Аня П.', `${a.lava_round}/${bb.lava_round} Аня видит [${a.remotes}] Боря видит [${bb.remotes}] ${a.joined}/${bb.joined}`);
await A.shot('blox-lava-a', 1280, 720, false);
A.done();
