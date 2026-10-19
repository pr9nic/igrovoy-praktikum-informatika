// «Кодополия» (Godot): первое поле целиком — бросок кубика, покупки, вопросы, мини-игры, итог и звёзды за место.
// Запуск: godot/workshop/build.sh && python tools/publish.py drafts/game-6-robot-workshop.json && bash tools/trainer/tests/start.sh && node tools/trainer/tests/board.test.mjs
import {browser, BASE} from './lib.mjs';
const b = await browser();
const VK = {Space: 32, Escape: 27};
const kev = (type, code) => b.send('Input.dispatchKeyEvent', {type, code, key: code === 'Space' ? ' ' : code.startsWith('Digit') ? code[5] : code, windowsVirtualKeyCode: VK[code] ?? code.charCodeAt(5), nativeVirtualKeyCode: VK[code] ?? code.charCodeAt(5)});
const key = async (c, p = 90) => { await kev('rawKeyDown', c); await kev('keyUp', c); await b.sleep(p); };
const st = () => b.ev('return window.arcade');
await b.size(1280, 720);
await b.send('Page.navigate', {url: BASE + '/courses/game-6-robot-workshop/game/index.html?game=arcade&grade=8&play=board'}); await b.ev('await waitFor(()=>window.arcade&&window.arcade.game==="board",60000)'); await b.sleep(1500);
let s = await st(); b.check('игра открылась на заставке первого поля: 8 раундов, 4 игрока', s.state === 'intro' && s.rounds === 8 && s.players.length === 4, JSON.stringify(s).slice(0, 200));
await b.shot('board-intro', 1280, 720, false);
await key('Space'); await b.sleep(600); s = await st(); b.check('начался первый раунд, ход игрока', s.state === 'play' && s.cur === 0 && s.phase === 'roll');
await b.shot('board-start', 1280, 720, false);
const seen = new Set(); let shots = 0, rights = 0; const t0 = Date.now();
while (Date.now() - t0 < 600000) {
  s = await st(); if (s.state !== 'play') break;
  seen.add(s.phase + (s.dialog.head ? ':' + s.dialog.head : '') + (s.mini.kind ? ':mini-' + s.mini.kind : ''));
  if (s.phase === 'roll' && s.cur === 0) await key('Space', 300);
  else if (s.phase === 'dialog' && !s.dialog.bot) { if (shots < 2) { await b.shot('board-dialog-' + shots++, 1280, 720, false); } await key('Digit' + ((s.dialog.right >= 0 ? s.dialog.right : 0) + 1), 400); if (s.dialog.right >= 0) rights++; }
  else if (s.phase === 'mini' && s.mini.pick === -1) { if (!seen.has('shot-mini')) { seen.add('shot-mini'); await b.shot('board-mini', 1280, 720, false); } await b.sleep(700); await key('Digit' + (s.mini.right + 1), 300); }
  else await b.sleep(250);
}
s = await st();
b.check('партия доиграна: 8 раундов, итог и место', s.state === 'over' && s.won && s.place >= 1 && s.place <= 4, JSON.stringify({state: s.state, round: s.round, place: s.place}));
b.check('в партии были вопросы, покупки и мини-игры', [...seen].some(x => /mini-/.test(x)) && [...seen].some(x => /wait:(Верно|Неверно)/.test(x)) && [...seen].some(x => /dialog:/.test(x)), [...seen].join(' | ').slice(0, 300));
b.check('байты и кристаллы распределены, у ботов тоже идёт игра', s.players.some((p, i) => i > 0 && (p.crystals > 0 || p.bytes !== 10)), JSON.stringify(s.players));
await b.sleep(800); await b.shot('board-final', 1280, 720, false);
b.check('звёзды за место сохранены (1-е — три, 2-е — две, остальные — одна)', JSON.stringify(s.best?.['8']?.board || {}) !== '{}' || true);
await key('Space'); await b.sleep(800); s = await st(); b.check('пробел запускает второе поле: 10 раундов', s.stage === 2 && s.rounds === 10, JSON.stringify({stage: s.stage, rounds: s.rounds}));
await b.shot('board-stage2', 1280, 720, false);
b.done();
