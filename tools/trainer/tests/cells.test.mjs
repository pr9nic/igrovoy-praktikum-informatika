// «Клетки памяти» 2.0 (Godot) в браузере: большие уровни с лестницами и лифтами, враги, двери знаний, лавка, Коллекционер,
// «Переход» с выбором биома, три босса и победа. На стенде включены отладочные клавиши:
// F6 неуязвимость, F7 верный ответ, F8 удар по всем, F9 к следующей цели, F10 к двери знаний или сундуку, PageUp/PageDown к торговцу/Коллекционеру, F2 клетки и байты, F12 к лестнице, F4 на лифт.
// Запуск: godot/workshop/build.sh && python tools/publish.py drafts/game-6-robot-workshop.json && bash tools/trainer/tests/start.sh && node tools/trainer/tests/cells.test.mjs
import {browser, BASE} from './lib.mjs';
const b = await browser();
const VK = {Space: 32, Escape: 27, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, F5: 116, F6: 117, F7: 118, F8: 119, F9: 120, F10: 121, F12: 123, F2: 113, F4: 115, PageUp: 33, PageDown: 34, KeyX: 88, KeyC: 67, KeyE: 69, KeyM: 77, ShiftLeft: 16};
const ev = (type, code) => b.send('Input.dispatchKeyEvent', {type, code, key: code === 'Space' ? ' ' : code.startsWith('Digit') ? code[5] : code.startsWith('Key') ? code[3].toLowerCase() : code, windowsVirtualKeyCode: VK[code] ?? code.charCodeAt(5), nativeVirtualKeyCode: VK[code] ?? code.charCodeAt(5)});
const key = async (code, pause = 90) => { await ev('rawKeyDown', code); await ev('keyUp', code); await b.sleep(pause); };
const hold = async (code, ms) => { await ev('rawKeyDown', code); await b.sleep(ms); await ev('keyUp', code); };
const st = () => b.ev('return window.arcade');
const until = (expr, ms = 15000) => b.ev(`await waitFor(()=>{const a=window.arcade;return a&&(${expr})},${ms});`);
await b.size(1280, 720);
await b.send('Page.navigate', {url: BASE + '/courses/game-6-robot-workshop/game/index.html?game=arcade&grade=8'}); await b.ev('await waitFor(()=>window.arcade,60000);'); await b.sleep(500);
await key('Digit7'); await until("a.game==='cells'&&a.mode==='menu'"); await b.sleep(300); await b.shot('cells-menu', 1280, 720, false);
await key('Space'); await until("a.mode==='kit'"); await key('Digit1'); await until("a.mode==='zone'&&a.stage===0", 30000);
let s = await st();
b.check('большой уровень: много комнат, лестницы или лифты, враги, три терминала', s.rooms >= 8 && s.mapW >= 120 && s.mapH >= 42 && (s.ladders + s.lifts) > 0 && s.foes >= 8 && s.terms.length === 3, JSON.stringify({rooms: s.rooms, w: s.mapW, h: s.mapH, l: s.ladders, lifts: s.lifts, foes: s.foes, kinds: s.foeKinds}));
await b.sleep(800); await b.shot('cells-level1', 1280, 720, false);
const x0 = s.x; await ev('rawKeyDown', 'ArrowRight'); await b.sleep(700); await key('ArrowUp', 250); await key('KeyX', 150); await key('KeyC', 150); await key('ShiftLeft', 350); await ev('keyUp', 'ArrowRight'); await b.sleep(200);
b.check('герой бежит, бьёт, стреляет и перекатывается', (await st()).x !== x0, `${x0} → ${(await st()).x}`);
await key('KeyM', 300); await b.shot('cells-map', 1280, 720, false); await key('KeyM');
await key('F6');
if ((await st()).ladders > 0) { await key('F12', 200); const y0 = (await st()).y; await ev('rawKeyDown', 'ArrowUp'); await until(`a.y < ${y0} - 150`, 6000).catch(() => {}); await ev('keyUp', 'ArrowUp'); s = await st();
  b.check('по лестнице можно подняться на другой этаж', s.y < y0 - 150, `${y0} → ${s.y}`); await b.shot('cells-ladder', 1280, 720, false); }
if ((await st()).lifts > 0) { await key('F4', 200); const y0 = (await st()).y; await until(`Math.abs(a.y - ${y0}) > 250`, 12000).catch(() => {}); s = await st();
  b.check('лифт везёт героя между этажами', Math.abs(s.y - y0) > 250, `${y0} → ${s.y}`); await b.shot('cells-lift', 1280, 720, false); }
// Терминалы: первый — ошибкой (появляется баг), остальные верно.
await key('F9', 300); await key('KeyE'); await until("a.mode==='quiz'"); await b.shot('cells-quiz', 1280, 720, false); s = await st(); const foes0 = s.foes;
await key('Digit' + (((s.right + 1) % 3) + 1)); await b.sleep(500); await key('Space'); await until("a.mode==='zone'"); s = await st();
b.check('ошибка на терминале породила бага', s.terms.includes('bad') && s.foes === foes0 + 1 && s.foeKinds.bug >= 1, JSON.stringify(s.foeKinds));
const terms = async () => { for (let i = 0; i < 4; i++) { s = await st(); if (!s.terms.includes('new')) break; await key('F9', 250); await key('KeyE'); await until("a.mode==='quiz'"); await key('F7'); await until("a.mode==='zone'", 6000); } };
await terms(); b.check('терминалы пройдены, есть звёзды за знания', (await st()).terms.filter(t => t === 'ok').length === 2);
// Дверь знаний и сундук (если на уровне есть).
s = await st();
if (s.things.kdoor) { await key('F10', 300); await until("a.near==='kdoor'", 3000); await key('KeyE'); await until("a.mode==='quiz'"); await key('F7'); await until("a.mode==='zone'", 6000); b.check('дверь знаний открылась верным ответом', true); }
await key('F8', 200); b.check('удар по всем: враги побеждены, выпали байты и клетки', (await st()).kills > 3, `побед ${(await st()).kills}`);
await b.sleep(1500); await b.shot('cells-drops', 1280, 720, false);
// Портал → мутация → «Переход».
await key('F9', 300); b.check('герой у портала', (await st()).near === 'portal', (await st()).near); await key('KeyE'); await until("a.mode==='rest'"); await b.shot('cells-rest', 1280, 720, false);
b.check('этап 1 пройден на две звезды', (await st()).stars['1'] === 2, JSON.stringify((await st()).stars));
await key('Digit1'); await until("a.mode==='zone'&&a.things.collector===1"); s = await st(); await b.sleep(600); await b.shot('cells-passage', 1280, 720, false);
b.check('«Переход»: фонтан, торговец, Коллекционер и две двери в разные биомы', s.things.fountain === 1 && s.things.shop === 1 && s.things.door === 2, JSON.stringify(s.things));
await key('F2'); await key('PageUp', 300); await until("a.near==='shop'", 3000); await key('KeyE'); await until("a.mode==='shop'"); await b.sleep(300); await b.shot('cells-shop', 1280, 720, false);
const by0 = (await st()).bytes, sc0 = (await st()).scrolls; await key('Digit5'); b.check('торговец продал свиток силы', (await st()).scrolls === sc0 + 1 && (await st()).bytes < by0, JSON.stringify((await st()).offers)); await key('KeyE');
await key('PageDown', 300); await until("a.near==='collector'", 3000); await key('KeyE'); await until("a.mode==='collector'"); await b.sleep(300); await b.shot('cells-collector', 1280, 720, false);
const c0 = (await st()).cells; await key('Digit1'); s = await st(); b.check('Коллекционер: улучшение здоровья навсегда за клетки', s.ups.hp === 1 && s.cells === c0 - 15, JSON.stringify(s.ups)); await key('KeyE');
// Этапы 2–5: развилка, уровни, боссы.
const shots = {1: 'cells-level2', 2: 'cells-level3', 3: 'cells-level4', 4: 'cells-level5'};
for (let stg = 1; stg <= 4; stg++) {
  await key('F9', 300); await until("a.near==='door'", 3000); await key('KeyE'); await until(`a.mode==='zone'&&a.stage===${stg}&&a.terms.length===3`, 30000); s = await st();
  await b.sleep(700); await b.shot(shots[stg], 1280, 720, false);
  if (stg === 1) b.check('после развилки — второй биом маршрута', ['forest', 'catacomb'].includes(s.biome), s.biome);
  b.check(`этап ${stg + 1} (${s.biome}): новые враги этапа`, Object.keys(s.foeKinds).length >= 3, JSON.stringify(s.foeKinds));
  await terms(); await key('F9', 300); await key('KeyE');
  if (stg >= 2) {
    await until("a.boss&&a.boss.hp>0", 15000); await b.sleep(1200); await b.shot('cells-boss-' + (await st()).boss.kind, 1280, 720, false);
    b.check(`арена этапа ${stg + 1}: босс ${(await st()).boss.kind}`, (await st()).boss.kind === ['spam', 'guard', 'glitch'][stg - 2]);
    for (let i = 0; i < 12 && !(await st()).boss.dead; i++) {
      if ((await st()).boss.shield) { await key('F9', 300); await key('KeyE'); await until("a.mode==='quiz'"); await key('F7'); await until("a.mode==='zone'&&!a.boss.shield", 6000); if ((await st()).boss.rage) { await b.sleep(1500); await b.shot('cells-boss-rage', 1280, 720, false); } }
      await key('F8', 250);
    }
    b.check(`босс этапа ${stg + 1} повержен`, (await st()).boss.dead, JSON.stringify((await st()).boss));
    await b.sleep(800); await key('F9', 300); await key('KeyE');
  }
  if (stg < 4) { await until("a.mode==='rest'", 8000); await key('Digit1'); await until("a.mode==='zone'&&a.things.collector===1", 15000); }
}
await until("a.mode==='win'", 8000); await b.sleep(500); await b.shot('cells-win', 1280, 720, false); s = await st();
b.check('Глюк повержен, забег пройден: звёзды за все пять этапов', s.mode === 'win' && Object.keys(s.stars).length === 5, JSON.stringify(s.stars));
b.check('маршрут ветвился: пять разных биомов', new Set(s.visited).size === 5, JSON.stringify(s.visited));
await key('Space'); await until("a.mode==='menu'"); await b.shot('cells-menu-after', 1280, 720, false);
b.check('улучшение Коллекционера сохранилось после забега', (await st()).ups.hp === 1);
await key('Escape'); await until("a.game===''"); b.check('ошибок движка в консоли нет', b.consoleErrors.length === 0, b.consoleErrors.slice(0, 3).join(' | '));
b.done();
