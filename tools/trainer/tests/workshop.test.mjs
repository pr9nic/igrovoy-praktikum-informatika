// Игра на Godot «Мастерская роботов» в настоящем браузере.
// 1) Цех 6 класса проходится клавиатурой: проверяет редактор блоков, мышь, ошибки, сохранение.
// 2) Все 72 задания: эталонные программы кладутся в сохранение, игра сама выполняет их на случайных сменах.
// Нужен чистый профиль браузера (start.sh создаёт его заново) и одна вкладка.
// Запуск: godot/workshop/build.sh && python tools/publish.py drafts/game-6-robot-workshop.json && bash tools/trainer/tests/start.sh && node tools/trainer/tests/workshop.test.mjs
// WORKSHOP_BASE=http://portal.school.local:18731 проверяет игру по обычному http с сетевого адреса, как её открывают ученики.
import fs from 'node:fs';
import {browser, BASE as LOCAL} from './lib.mjs';
const BASE = process.env.WORKSHOP_BASE || LOCAL;
const GAME = BASE + '/courses/game-6-robot-workshop/game/index.html';
const b = await browser();
const CODES = {Enter: 13, Tab: 9, Escape: 27, Backspace: 8, ArrowUp: 38, ArrowDown: 40, Equal: 187, Minus: 189, KeyC: 67};
const key = async code => { const vk = CODES[code] ?? code.charCodeAt(5); for (const type of ['rawKeyDown', 'keyUp']) await b.send('Input.dispatchKeyEvent', {type, code, key: code.startsWith('Digit') ? code[5] : code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk}); await b.sleep(90); };
// f вперёд, l налево, r направо, t взять, p положить, R повтори, I если, W пока, + − число, c условие, v вниз (выйти из блока)
const MAP = {f: 'Digit1', l: 'Digit2', r: 'Digit3', t: 'Digit4', p: 'Digit5', R: 'Digit6', I: 'Digit7', W: 'Digit8', '+': 'Equal', '-': 'Minus', c: 'KeyC', v: 'ArrowDown'};
const type = async s => { for (const ch of s) await key(MAP[ch]); };
const state = () => b.ev('return window.workshop');
const open = async url => { await b.send('Page.navigate', {url}); await b.ev('await waitFor(()=>window.workshop,60000);'); await b.sleep(400); };
const SOL = [
  ['ftfffrfp', 8], ['tR++++++fvp', 4], ['R++tllR+fvpllR+f', 11],
  ['R++tIrplvlpr', 9], ['R+++tlIcpvvlIccpvvlIpvvl', 12], ['R+tllWfvIlplvrprvWf', 15],
];
await b.size(1280, 720);
await open(GAME);
b.check('без параметра открывается список цехов', (await state()).shop === -1); b.check('контекст страницы: ' + (await b.ev('return isSecureContext') ? 'защищённый' : 'обычный http'), true);
await b.shot('workshop-shops', 1280, 720, false);
if (!process.env.WORKSHOP_GRADES) {
await key('Digit1'); b.check('цифра открывает цех', (await state()).shop === 0 && (await state()).level === -1);
await key('Digit3'); b.check('закрытый уровень не открывается', (await state()).level === -1);
for (let i = 0; i < SOL.length; i++) {
  await key('Digit' + (i + 1)); await b.sleep(300);
  b.check(`склад ${i + 1}: уровень открыт`, (await state()).level === i);
  if (i === 0) { await key('Tab'); await key('Tab'); await type('ff'); await key('Enter'); await b.ev('await waitFor(()=>!window.workshop.running&&/упёрся|не выполнен|нет ящика/.test(window.workshop.status),20000);'); b.check('ошибочная программа останавливает робота с объяснением', !(await state()).won, (await state()).status); await key('Backspace'); await key('Backspace'); }
  if (i === 0) { for (const type of ['mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', {type, x: 899, y: 109, button: 'left', clickCount: 1}); await b.sleep(200); b.check('блок добавляется щелчком мыши', (await state()).blocks === 1); for (const type of ['mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', {type, x: 1212, y: 678, button: 'left', clickCount: 1}); await b.sleep(200); b.check('кнопка «Очистить» работает', (await state()).blocks === 0); }
  await type(SOL[i][0]);
  b.check(`склад ${i + 1}: блоков ${SOL[i][1]}`, (await state()).blocks === SOL[i][1], (await state()).blocks);
  await key('Enter'); await b.ev('await waitFor(()=>window.workshop.running,5000);await waitFor(()=>!window.workshop.running,90000);'); await b.sleep(300);
  const s = await state(); b.check(`склад ${i + 1}: пройден клавиатурой на три звезды`, s.won && Object.values(s.stars)[i] === 3, s.status);
  await key('Escape'); await b.ev('await waitFor(()=>window.workshop.level===-1,5000);');
}
await open(GAME + '?grade=6');
b.check('звёзды сохраняются после перезагрузки, ?grade открывает цех', (await state()).shop === 0 && Object.values((await state()).stars).length === 6);
}

const all = JSON.parse(fs.readFileSync(new URL('../../../godot/workshop/tests/.solutions.json', import.meta.url)));
const save = {stars: Object.fromEntries(all.map(x => [x.id, 1])), programs: Object.fromEntries(all.map(x => [x.id, x.program]))};
await b.ev(`localStorage.setItem('school4-workshop-v1', ${JSON.stringify(JSON.stringify(save))});`);
// WORKSHOP_GRADES=11 — быстрый прогон одного класса (первая часть с клавиатурой тогда пропускается).
for (const grade of (process.env.WORKSHOP_GRADES || '6,7,8,9,10,11').split(',').map(Number)) {
  await open(GAME + '?grade=' + grade); await b.shot(`workshop-g${grade}-menu`, 1280, 720, false);
  const list = all.filter(x => x.grade === grade); let first = true;
  for (let i = 0; i < list.length; i++) {
    // Задания 10–12 открываются только мышью: щелчок по карточке в сетке 4×3.
    if (i < 9) await key('Digit' + (i + 1)); else for (const type of ['mousePressed', 'mouseReleased']) await b.send('Input.dispatchMouseEvent', {type, x: 48 + (i % 4) * 298 + 143, y: 188 + Math.floor(i / 4) * 156 + 72, button: 'left', clickCount: 1});
    await b.ev(`await waitFor(()=>window.workshop.level===${i},5000);`);
    if (first) { await key('Tab'); await key('Tab'); first = false; }
    await b.sleep(250); await b.shot(`workshop-g${grade}-${i + 1}`, 1280, 720, false);
    await key('Enter'); await b.ev('await waitFor(()=>window.workshop.running,5000);'); await b.sleep(900); if (i === 5 || i === 2 || i === 11) await b.shot(`workshop-g${grade}-${i + 1}-run`, 1280, 720, false);
    await b.ev('await waitFor(()=>!window.workshop.running,120000);'); await b.sleep(200);
    const s = await state(); b.check(`${grade} класс, задание ${i + 1} (${list[i].id}): эталон проходит три смены на три звезды`, s.won && s.stars[list[i].id] === 3, s.status);
    await key('Escape'); await b.ev('await waitFor(()=>window.workshop.level===-1,5000);');
  }
}
await b.send('Page.navigate', {url: BASE + '/courses/game-9-robot-workshop/'}); await b.sleep(8000); await b.shot('workshop-page-9', 1366, 768, false);
b.check('страница 9 класса показывает игру из общей копии', await b.ev("return document.querySelector('#godotFrame').src.includes('/courses/game-6-robot-workshop/game/index.html')&&document.querySelector('#godotFrame').src.includes('grade=9')"));
b.done();
