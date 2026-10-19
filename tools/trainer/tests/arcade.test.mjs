// «Кодоград: Аркады» (Godot) в настоящем браузере: три игры проходят несколько ходов с клавиатуры.
// Запуск: godot/workshop/build.sh && python tools/publish.py drafts/game-6-robot-workshop.json && bash tools/trainer/tests/start.sh && node tools/trainer/tests/arcade.test.mjs
import {browser, BASE as LOCAL} from './lib.mjs';
const BASE = process.env.WORKSHOP_BASE || LOCAL;
const GAME = BASE + '/courses/game-6-robot-workshop/game/index.html';
const b = await browser();
const VK = {Space: 32, Escape: 27, Enter: 13, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40};
const key = async (code, pause = 70) => { const vk = VK[code] ?? code.charCodeAt(5); for (const type of ['rawKeyDown', 'keyUp']) await b.send('Input.dispatchKeyEvent', {type, code, key: code === 'Space' ? ' ' : code.startsWith('Digit') ? code[5] : code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk}); await b.sleep(pause); };
const st = () => b.ev('return window.arcade');
const open = async q => { await b.send('Page.navigate', {url: GAME + q}); await b.ev('await waitFor(()=>window.arcade,60000);'); await b.sleep(500); };
const until = (expr, ms = 15000) => b.ev(`await waitFor(()=>{const a=window.arcade;return ${expr}},${ms});`);
await b.size(1280, 720);
await open('?game=arcade&grade=8');
b.check('параметр game=arcade открывает аркады своего класса', (await st()).grade === 8 && (await st()).game === ''); await b.shot('arcade-hub', 1280, 720, false);

// 1. Двоичный десант: набрать число вируса битами и выстрелить.
await key('Digit1'); await until("a.game==='bits'&&a.state==='intro'"); await b.shot('arcade-bits-intro', 1280, 720, false);
await key('Space'); await until("a.state==='play'");
for (let shot = 0; shot < 4; shot++) {
  await until('a.foes&&a.foes.length>0'); const s = await st(), foe = s.foes[0];
  for (let i = 0; i < s.bits; i++) { const want = (foe.value >> (s.bits - 1 - i)) & 1, have = (s.now >> (s.bits - 1 - i)) & 1; if (want !== have) await key('Digit' + (i + 1)); }
  await b.sleep(150); if (shot === 1) await b.shot('arcade-bits', 1280, 720, false);
  b.check(`десант: биты набраны верно (${foe.label} = ${foe.value})`, (await st()).now === foe.value);
  await key('Space'); await until(`a.score===${shot + 1}`, 4000);
}
b.check('десант: четыре вируса сбиты, жизни целы', (await st()).score === 4 && (await st()).lives === 3);
await key('Digit1'); await key('Space'); await b.sleep(300); b.check('десант: выстрел мимо не даёт очков', (await st()).score === 4);
{ const goal = (await st()).goal; b.check('десант: у этапа есть цель', goal === 12, goal);
  await b.sleep(600); // после промаха пушка полсекунды перезаряжается
  for (let shot = 4; shot < goal; shot++) { await until('a.foes&&a.foes.length>0'); const s = await st(), foe = s.foes[0];
    for (let i = 0; i < s.bits; i++) { const want = (foe.value >> (s.bits - 1 - i)) & 1, have = (s.now >> (s.bits - 1 - i)) & 1; if (want !== have) await key('Digit' + (i + 1), 45); }
    await key('Space'); await until(`a.score===${shot + 1}||a.state==='over'`, 4000); }
  await until("a.state==='over'", 4000); await b.sleep(500); await b.shot('arcade-bits-won', 1280, 720, false);
  b.check('десант: этап 1 пройден, звёзды записаны', (await st()).won && (await st()).best['8']?.bits?.stages?.['1'] === 3, JSON.stringify((await st()).best));
  await key('Space'); await until("a.state==='play'&&a.stage===2"); b.check('десант: пробел после победы запускает этап 2 с новой целью', (await st()).goal === 14); }
await key('Escape'); await until("a.game===''");

// 2. 2048: сдвиги меняют поле, очки растут.
await key('Digit2'); await until("a.game==='merge'"); await key('Space'); await until("a.state==='play'");
const g0 = JSON.stringify((await st()).grid);
let mid = null; for (let i = 0; i < 60; i++) { await key(['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown'][i % 4], 150); const q = await st(); if (q.state !== 'play') break; mid = q; }
const m = (await st()).state === 'play' ? await st() : mid; b.check('2048: поле меняется, плитки сливаются', JSON.stringify(m.grid) !== g0 && m.score > 0 && m.top >= 2, `счёт ${m.score}, старшая плитка 2^${m.top}`);
b.check('2048: на поле не больше 16 плиток и нет потерь', m.grid.length === 16 && m.grid.every(v => v >= 0 && v <= 12)); await b.shot('arcade-merge', 1280, 720, false);
await key('Escape'); await until("a.game===''");

// 3. Змейка: вести голову к наименьшему числу.
await key('Digit3'); await until("a.game==='snake'"); await key('Space'); await until("a.state==='play'");
const t0 = Date.now(); let shotDone = false;
while (Date.now() - t0 < 60000) {
  const s = await st(); if (s.state !== 'play' || s.score >= 3) break;
  const f = s.foods[s.smallest], dx = f.x - s.head[0], dy = f.y - s.head[1]; let want = null;
  if (dx !== 0 && s.dir[0] !== -Math.sign(dx)) want = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
  else if (dy !== 0 && s.dir[1] !== -Math.sign(dy)) want = dy > 0 ? 'ArrowDown' : 'ArrowUp';
  else if (dx !== 0) want = s.head[1] > 4 ? 'ArrowUp' : 'ArrowDown';
  else want = s.head[0] > 9 ? 'ArrowLeft' : 'ArrowRight';
  const cur = s.dir[0] === 1 ? 'ArrowRight' : s.dir[0] === -1 ? 'ArrowLeft' : s.dir[1] === 1 ? 'ArrowDown' : 'ArrowUp';
  if (want !== cur) await key(want, 30); else await b.sleep(40);
  if (!shotDone && s.score >= 1) { await b.shot('arcade-snake', 1280, 720, false); shotDone = true; }
}
const sn = await st(); b.check('змейка: съедено три числа по возрастанию', sn.score >= 3, `счёт ${sn.score}, жизней ${sn.lives}, длина ${sn.len}`);
await key('ArrowUp'); await until('a.lives<3||a.state!==\'play\'', 20000); b.check('змейка: стена отнимает жизнь', (await st()).lives < 3 || (await st()).state === 'over');
await key('Escape'); await until("a.game===''"); await b.sleep(400); await b.shot('arcade-hub-after', 1280, 720, false);

// 3а. Сеть: повернуть каждую клетку до решения.
await key('Digit4'); await until("a.game==='net'"); for (const type of ['mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', {type, x: 640, y: 400, button: 'left', clickCount: 1}); await until("a.state==='play'"); b.check('игра запускается щелчком мыши', true);
{ const rot = m => ((m << 1) | (m >> 3)) & 15; let s = await st(); const n = s.n; let cx = s.cursor % n, cy = Math.floor(s.cursor / n);
  for (let i = 0; i < n * n; i++) { let m = s.masks[i], k = 0; while (m !== s.solved[i] && k < 4) { m = rot(m); k++; } if (!k) continue; if ((await st()).score > 0) break;
    const x = i % n, y = Math.floor(i / n); while (cx < x) { await key('ArrowRight', 25); cx++; } while (cx > x) { await key('ArrowLeft', 25); cx--; } while (cy < y) { await key('ArrowDown', 25); cy++; } while (cy > y) { await key('ArrowUp', 25); cy--; }
    for (let j = 0; j < k; j++) await key('Space', 40); if (i === Math.floor(n * n / 2)) await b.shot('arcade-net', 1280, 720, false); }
  await until('a.score>=1', 5000); b.check('сеть: все компьютеры подключены поворотами кабелей', (await st()).score >= 1); }
await key('Escape'); await until("a.game===''");

// 3б. Курьер: пройти кратчайший путь, затем заведомо длинный.
await key('Digit5'); await until("a.game==='route'"); await key('Space'); await until("a.state==='play'"); await b.sleep(300); await b.shot('arcade-route', 1280, 720, false);
for (let step = 0; step < 12 && (await st()).score < 1; step++) { const s = await st(); if (s.wantKey < 0) break; await key('Digit' + (s.wantKey + 1), 160); }
await until('a.score>=1', 5000); b.check('курьер: кратчайший путь засчитан', (await st()).score === 1 && (await st()).lives === 3);
await until('!a.wait&&a.path.length===1', 8000);
for (let step = 0; step < 30; step++) { const s = await st(); if (s.wait || s.lives < 3) break; if (!s.options) { await key('Backspace', 120); continue; } const k = s.wantKey === 0 && s.options > 1 ? 1 : (s.wantKey < 0 ? 0 : (s.options > 1 ? (s.wantKey + 1) % s.options : 0)); await key('Digit' + (k + 1), 160); }
const rt = await st(); b.check('курьер: путь длиннее кратчайшего отнимает жизнь (или тупик не засчитан)', rt.lives < 3 || rt.score === 1, `жизней ${rt.lives}, счёт ${rt.score}`);
await key('Escape'); await until("a.game===''");

// 3в. Проводник: дойти по папкам до файла из задания.
await key('Digit6'); await until("a.game==='files'"); await key('Space'); await until("a.state==='play'");
for (let step = 0; step < 40 && (await st()).score < 2; step++) { const s = await st(); if (s.want < 0) break; for (let i = s.sel; i < s.want; i++) await key('ArrowRight', 30); for (let i = s.sel; i > s.want; i--) await key('ArrowLeft', 30); if (step === 1) await b.shot('arcade-files', 1280, 720, false); await key('Enter', 140); }
const fl = await st(); b.check('проводник: два файла найдены по пути', fl.score === 2 && fl.lives === 3, fl.task + ' · ' + fl.here);
await key('Escape'); await until("a.game===''"); await b.sleep(400); await b.shot('arcade-hub-after', 1280, 720, false);

// 4. Все классы: каждая игра запускается и рисует кадр.
for (const grade of [6, 7, 9, 10, 11]) {
  await open('?game=arcade&grade=' + grade);
  for (const [n, id] of [[1, 'bits'], [2, 'merge'], [3, 'snake'], [4, 'net'], [5, 'route'], [6, 'files']]) {
    await key('Digit' + n); await until(`a.game==='${id}'`); await key('Space'); await until("a.state==='play'"); await b.sleep(id === 'bits' ? 2600 : 700);
    if (id === 'merge') for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) await key(k, 140);
    await b.shot(`arcade-g${grade}-${id}`, 1280, 720, false);
    b.check(`${grade} класс: «${id}» запускается`, (await st()).state === 'play'); await key('Escape'); await until("a.game===''");
  }
}
await b.send('Page.navigate', {url: GAME}); await b.ev('await waitFor(()=>window.workshop,60000);'); b.check('без параметра по-прежнему открывается мастерская роботов', await b.ev('return window.workshop&&window.workshop.shop===-1'));
b.check('ошибок движка в консоли нет', b.consoleErrors.length === 0, b.consoleErrors.slice(0, 3).join(' | '));
b.done();
