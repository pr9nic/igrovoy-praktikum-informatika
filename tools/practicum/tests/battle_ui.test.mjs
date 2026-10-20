// Браузерная проверка новых частей «Битвы класса» без стенда и журнала: сервер подменён заглушкой в странице.
// Пьедестал и конфетти на проекторе (и без движения при prefers-reduced-motion), «Повторение ошибок» из отчёта,
// вставка вопросов из таблицы в редакторе, три новые мини-игры привала, финал ученика.
// Запуск: node tools/practicum/tests/battle_ui.test.mjs  (нужен Chromium; свой порт отладки 9341, стенд не нужен)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), PORT_CDP = 9341;
const IMG = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
const MOCK = `
const Q = [{id: 'q1', type: 'single', text: 'Сколько бит в байте?', options: ['8', '16', '10'], answer: 0, time: 20, weight: 1, explain: ''},
  {id: 'q2', type: 'hotspot', text: 'Где процессор?', spots: [{x: 50, y: 50, r: 10}], time: 30, weight: 1, explain: ''},
  {id: 'q3', type: 'label', text: 'Подпиши', spots: [{text: 'a', x: 1, y: 1}, {text: 'b', x: 9, y: 9}], time: 30, weight: 1, explain: ''},
  {id: 'q4', type: 'fill', text: 'Столица России', accepted: ['Москва'], time: 30, weight: 1, explain: ''},
  {id: 'q5', type: 'poll', text: 'Понравилось?', options: ['да', 'нет'], time: 30, weight: 1, explain: ''}];
const rep = {id: 5, title: 'Кодирование', cls: '8 «А»', mode: 'classic', started: 1760000000, ended: 1760000600, settings: {}, teams: [], titles: [],
  quiz: {title: 'Кодирование', questions: Q.map(q => { const c = {...q}; if (q.type === 'hotspot' || q.type === 'label') c.hasImage = true; return c; })},
  players: [{name: 'Иванов Иван', score: 900, acc: 50, team: '', mastery: null, summit: false, best_streak: 2, reattempts: 0, done: true, answers: {
      q1: {frac: 0, text: '16', tries: [{frac: 0}]}, q2: {frac: 0, text: '•', tries: [{frac: 0}]}, q3: {frac: 0, text: '…', tries: [{frac: 0}]}, q4: {frac: 1, text: 'Москва', tries: [{frac: 1}]}, q5: {frac: null, text: 'да', tries: [{frac: null}]}}},
    {name: 'Петров Пётр', score: 700, acc: 50, team: '', mastery: null, summit: false, best_streak: 1, reattempts: 0, done: true, answers: {
      q1: {frac: 0, text: '10', tries: [{frac: 0}]}, q2: {frac: 1, text: '•', tries: [{frac: 1}]}, q4: {frac: 0, text: 'Питер', tries: [{frac: 0}]}}}]};
const board = [['Иванов И.', 900, 3], ['Петров П.', 700, 5], ['Сидорова А.', 650, 7], ['Кузнецов Д.', 300, 1]].map(([name, score, avatar]) => ({name, score, avatar, acc: 80, mastery: null}));
window.MOCK = {saved: [], student: 'lobby', calls: []};
const ST = {phase: 'lobby', mode: 'classic', title: 'Кодирование', settings: {leaderboard: false, memes: true, music: false, powerups: true, theme: 'info', goal: 80, readAloud: false, timer: true},
  paused: false, players: 4, score: 0, streak: 0, inventory: [], effects: [], done: false, avatar: 3, summits: 0, acc: {}, team: '', teamColor: '', glitch: 0, powerplay: 0, attempt: 1, attempts: 1, locked: {}, readAloud: false, events: [], names: ['Иван И.']};
const answer = (path, b) => {
  MOCK.calls.push(path);
  if (path === 'library') return {quizzes: [{id: 11, title: 'Кодирование', grade: 8, count: 5, types: ['single', 'hotspot'], updated: 1760000000}, {id: 12, title: 'Другая', grade: 7, count: 1, types: ['single'], updated: 1760000000}]};
  if (path === 'quiz') return {quiz: {id: 11, title: 'Кодирование', grade: 8, questions: Q.map(q => q.type === 'hotspot' ? {...q, image: '${IMG}'} : q)}};
  if (path === 'save') { MOCK.saved.push(b.quiz); return {id: 70 + MOCK.saved.length}; }
  if (path === 'results') return {results: [{id: 5, ended: rep.ended, cls: rep.cls, title: rep.title, mode: 'classic', players: 2, acc: 50}]};
  if (path === 'result') return {result: rep};
  if (path === 'status') return {open: false};
  if (path === 'teacher') return {phase: 'ended', mode: 'classic', title: 'Кодирование', paused: false, board, players: [], qstats: [], events: [], result: 5, settings: {theme: 'info', goal: 80}, clouds: {}};
  if (path === 'join') return {key: 'k', token: 't'};
  if (path === 'sync') return MOCK.student === 'ended' ? {...ST, phase: 'ended', place: 1, score: 900, top: board.map((x, i) => ({...x, me: i === 0}))} : ST;
  return {};
};
window.fetch = async (url, opt) => { const p = String(url).split('/results/api/battle/')[1]; const b = opt && opt.body ? JSON.parse(opt.body) : {};
  return {ok: true, status: 200, json: async () => ({status: 'ok', ...answer(p, b)})}; };
window.alert = t => { MOCK.alert = t; };`;
const PAGE = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><link rel="stylesheet" href="practicum.css"><link rel="stylesheet" href="battle.css"></head>
<body style="background:#0b1024"><main class="game-wrap" id="practicum"></main><script>${MOCK}</script>
${['battle_logic.js', 'battle.js', 'battle_play.js', 'battle_teach.js'].map(n => `<script src="${n}"></script>`).join('')}</body></html>`;
const srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); return res.end(PAGE); }
  const f = path.join(DIR, path.normalize(u)); if (!f.startsWith(DIR) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': {'.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp'}[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(res); });
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-ui-'));
const chrome = spawn(process.env.CHROMIUM || '/usr/lib/chromium/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-extensions', '--no-proxy-server', `--remote-debugging-port=${PORT_CDP}`, `--user-data-dir=${prof}`, '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], {stdio: 'ignore'});
const quit = () => { try { chrome.kill(); } catch {} srv.close(); try { fs.rmSync(prof, {recursive: true, force: true}); } catch {} };
process.on('exit', quit);
for (let i = 0; i < 60; i++) { try { await (await fetch(`http://127.0.0.1:${PORT_CDP}/json/version`)).json(); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
process.env.CDP = `http://127.0.0.1:${PORT_CDP}`;
const {browser} = await import('../../trainer/tests/lib.mjs');
const P = await browser(); await P.size(1280, 860);
const open = async () => { await P.send('Page.navigate', {url: URL0}); await P.ev("await waitFor(()=>window.BattleTeach&&window.BattlePlay&&window.BattleLogic)"); };
await open();

// --- проектор: пьедестал и конфетти ---
await P.ev("window.T=BattleTeach.teacher({root:$('#practicum'),grade:8,leave(){}});await waitFor(()=>document.querySelectorAll('.btt-qz').length===2);T.live('8 «А»');await waitFor(()=>$('.btt-screen .bt-podium'))");
P.check('проектор: пьедестал тройки лидеров', await P.ev("const p=[...document.querySelectorAll('.btt-screen .bt-pod')];return p.length===3&&p.map(x=>x.dataset.place).join()==='2,1,3'&&/Иванов/.test($('.bt-pod.gold').textContent)"));
P.check('проектор: колонны поднимаются по очереди (анимация с задержками)', await P.ev("const a=getComputedStyle($('.bt-pod.gold .bt-col')),b=getComputedStyle($('.bt-pod.bronze .bt-col'));return a.animationName==='bt-rise'&&parseFloat(a.animationDelay)>parseFloat(b.animationDelay)"));
P.check('проектор: конфетти поверх экрана', await P.ev("const c=$('.btt-screen canvas.bt-confetti');return !!c&&getComputedStyle(c).position==='absolute'&&getComputedStyle(c).pointerEvents==='none'"));
await P.sleep(900); await P.shot('bt-podium', 1280, 860, false);
await P.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
await P.ev("T.live('8 «А»');await waitFor(()=>$('.btt-screen .bt-podium'))");
P.check('уменьшить движение: без конфетти и без анимации пьедестала', await P.ev("return !$('.bt-confetti')&&$('.bt-podium').classList.contains('calm')&&getComputedStyle($('.bt-pod.gold .bt-col')).animationName==='none'"));
await P.send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'no-preference'}]});

// --- «Повторение ошибок» ---
await P.ev("BattleTeach.stop();T.report(5);await waitFor(()=>$('[data-act=btt-redo]'));$('[data-act=btt-redo]').click();await waitFor(()=>MOCK.saved.length&&$('.btt-qi'))");
const saved = await P.ev("return MOCK.saved[0]");
P.check('повторение: в викторину попали вопросы с ошибками, трудные первыми', saved.questions.map(q => q.id).join() === 'q1,q2,q4' && saved.grade === 8 && /^Повторение ошибок: Кодирование/.test(saved.title), JSON.stringify(saved).slice(0, 300));
P.check('повторение: картинка вопроса взята из исходной викторины', saved.questions[1].image === IMG && !('hasImage' in saved.questions[1]));
P.check('повторение: открыт редактор, сказано о пропущенном вопросе без картинки', await P.ev("return document.querySelectorAll('.btt-qi').length===3&&/№ 3/.test($('.btt-msg').textContent)&&!!$('[data-act=btt-edplay]')"));
await P.shot('bt-redo', 1280, 860, false);

// --- вставка из таблицы в редакторе ---
await P.ev("$('[data-act=btt-sheet]').click();await waitFor(()=>$('[data-field=btt-sheet]'));const t=$('[data-field=btt-sheet]');t.value='Вопрос\\tПравильный\\tНеверный\\nСколько бит в байте?\\t8\\t16\\t10\\n\"Что такое \"\"бит\"\"?\"\\tединица информации\\tбуква\\nСтолица России\\tМосква\\n\\tбез вопроса\\n';t.dispatchEvent(new Event('input'))");
P.check('таблица: найдено 3 вопроса и одно предупреждение', await P.ev("const o=$('.btt-sheetout').textContent;return /Найдено вопросов: 3/.test(o)&&/один ответ — 2/.test(o)&&document.querySelectorAll('.btt-warn li').length===1"), await P.ev("return $('.btt-sheetout').textContent"));
await P.shot('bt-sheet', 1280, 860, false);
await P.ev("$('[data-act=btt-sheet-add]').click();await waitFor(()=>document.querySelectorAll('.btt-qi').length===6)");
P.check('таблица: вопросы добавлены в викторину, открыт первый новый', await P.ev("return !$('[data-field=btt-sheet]')&&$('.btt-qi.on').dataset.q==='3'&&$('[data-field=q-text]').value==='Сколько бит в байте?'&&[...document.querySelectorAll('.btt-qi')][4].textContent.includes('Что такое \"бит\"?')"));
await P.ev("$('[data-act=btt-save]').click();await waitFor(()=>MOCK.saved.length===2)");
P.check('таблица: сохраняется с верным ответом первым', await P.ev("const q=MOCK.saved[1].questions[3];return q.type==='single'&&q.answer===0&&q.options.join()==='8,16,10'&&MOCK.saved[1].questions[5].type==='fill'"));
await P.ev("BattleTeach.stop()");

// --- мини-игры привала ---
await P.ev("BattlePlay.student({root:$('#practicum'),player:{className:'8 «А»',name:'Иванов Иван'},leave(){}});await waitFor(()=>window.btMini&&$('.bt2-lobby'))");
const run = (kind, ms) => P.ev(`const host=document.createElement('div');host.className='bt2-break';$('.bt2-main').replaceChildren(host);window.mg=btMini('${kind}',host,${ms}).then(s=>window.mgScore=s);window.mgScore=undefined`);
// двоичный сейф: набираем число по разрядам
await run('bits', 6000);
const solved = await P.ev("let n=0;for(let k=0;k<3;k++){await waitFor(()=>$('.bt2-bit')&&!$('.bt2-bitrow.ok'));const t=+$('.bt2-bitgoal').textContent.match(/\\d+/)[0],m=document.querySelectorAll('.bt2-bit').length,b=t.toString(2).padStart(m,'0');for(let i=0;i<m;i++)if(b[i]==='1')document.querySelector('[data-bit=\"'+i+'\"]').click();n++;await sleep(600)}return n");
await P.shot('bt-mini-bits', 1280, 860, false);
const bits = await P.ev("await waitFor(()=>window.mgScore!==undefined,9000);return window.mgScore");
P.check('двоичный сейф: три числа набраны — очки за каждое', solved === 3 && bits === 95, `очки ${bits}`);
// верёвка: хватаем, когда бегунок в зоне; промахи отнимают жизни
await run('rope', 16000);
const rope = await P.ev("let hits=0;const t=Date.now();while(hits<3&&Date.now()-t<7000){const z=$('.bt2-zone').getBoundingClientRect(),r=$('.bt2-runner').getBoundingClientRect(),x=r.left+r.width/2;if(x>z.left+z.width*0.3&&x<z.right-z.width*0.3){$('[data-act=bt-grab]').click();hits++;await sleep(350)}await sleep(10)}return hits");
await P.shot('bt-mini-rope', 1280, 860, false);
const lives0 = await P.ev("return $('.bt2-lives').textContent");
await P.ev("const r=$('.bt2-runner').getBoundingClientRect(),z=$('.bt2-zone').getBoundingClientRect();await waitFor(()=>{const x=$('.bt2-runner').getBoundingClientRect();const c=x.left+x.width/2;return c<z.left-30||c>z.right+30},4000);$('[data-act=bt-grab]').click()");
const ropeScore = await P.ev("const l=$('.bt2-lives').textContent;await waitFor(()=>window.mgScore!==undefined,20000);return [l,window.mgScore]");
P.check('верёвка: попадания дают очки, промах отнимает жизнь', rope === 3 && lives0 === '❤❤❤' && ropeScore[0] === '❤❤♡' && ropeScore[1] >= 30 && ropeScore[1] <= 90, JSON.stringify([rope, lives0, ropeScore]));
// запомни тропу: запоминаем подсветку и повторяем
await run('trail', 15000);
const trail = await P.ev(`const seen=[];let prev=new Set();await waitFor(()=>/Смотри/.test($('.bt2-trailsay').textContent));
  while(!/Повтори/.test($('.bt2-trailsay').textContent)){const lit=new Set([...document.querySelectorAll('.bt2-tile.lit')].map(b=>+b.dataset.tile));for(const k of lit)if(!prev.has(k))seen.push(k);prev=lit;await sleep(15)}
  for(const k of seen){document.querySelector('[data-tile="'+k+'"]').click();await sleep(80)}await waitFor(()=>/Верно/.test($('.bt2-trailsay').textContent),2000);
  await waitFor(()=>/Повтори/.test($('.bt2-trailsay').textContent),6000);document.querySelector('[data-tile="'+((seen[0]+1)%9)+'"]').click();await sleep(50);const say=$('.bt2-trailsay').textContent;return [seen.length,say]`);
await P.shot('bt-mini-trail', 1280, 860, false);
const trailScore = await P.ev("await waitFor(()=>window.mgScore!==undefined,15000);return window.mgScore");
P.check('запомни тропу: повторённая тропа — очки и тропа длиннее, ошибка замечена', trail[0] === 3 && /Не туда/.test(trail[1]) && trailScore >= 45, JSON.stringify([trail, trailScore]));
P.check('мини-игры: заголовки и подсказки по-русски', await P.ev("return /Запомни тропу/.test($('.bt2-break h1').textContent)"));

// --- финал ученика: пьедестал и конфетти у тройки лидеров ---
await P.ev("MOCK.student='ended';await waitFor(()=>$('.bt2-final'),5000)");
P.check('финал ученика: пьедестал с анимацией и конфетти для призёра', await P.ev("return !!$('.bt2-pod.gold')&&getComputedStyle($('.bt2-pod.gold')).animationName==='bt-drop'&&!!$('.bt2-main canvas.bt-confetti')"));
await P.sleep(700); await P.shot('bt-final-student', 1280, 860, false);
await P.ev("BattlePlay.stop()");
P.done();
