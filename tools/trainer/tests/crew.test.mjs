// «Сбой на станции» на стенде: один ученик в настоящем браузере, остальные — программные игроки, учитель с пульта.
// Запуск: python tools/crew/tests/rules_test.py && python tools/publish.py drafts/game-8-crew.json && bash tools/trainer/tests/start.sh && node tools/trainer/tests/crew.test.mjs
import {browser, BASE} from './lib.mjs';
const b = await browser(), CLASS = '8 «В»', API = BASE + '/results/api/crew/';
const post = async (path, body) => (await fetch(API + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})).json();
const teacher = (action, extra = {}) => post('teacher', {className: CLASS, action, ...extra});
const place = async (bot, x, y) => { await fetch(BASE + '/test/crew/place?' + new URLSearchParams({className: CLASS, id: bot.id, x, y})); bot.x = x; bot.y = y; };   // сервер телепорты не принимает — переносит стенд
const key = async (type, code) => b.send('Input.dispatchKeyEvent', {type, code, key: code.startsWith('Digit') ? code[5] : code.startsWith('Key') ? code[3].toLowerCase() : code, windowsVirtualKeyCode: {KeyQ: 81, KeyE: 69, KeyF: 70, KeyR: 82, KeyG: 71, KeyM: 77, KeyJ: 74, ArrowRight: 39, Enter: 13, Escape: 27}[code] || code.charCodeAt(5)});
const press = async code => { await key('rawKeyDown', code); await key('keyUp', code); await b.sleep(120); };
const st = () => b.ev('return window.crew');
const until = (expr, ms = 20000) => b.ev(`await waitFor(()=>{const c=window.crew;return c&&(${expr})},${ms});`);
// Программные ученики: держат связь и выполняют то, что им скажет тест.
const bots = []; let running = true;
const addBot = async name => { const d = await post('join', {className: CLASS, name}); const bot = {name, id: d.id, token: d.token, x: 22, y: 16, acts: [], view: null, chat: 0}; bots.push(bot); return bot; };
(async () => { while (running) { for (const bot of bots) { const acts = bot.acts; bot.acts = []; bot.view = await post('sync', {className: CLASS, id: bot.id, token: bot.token, x: bot.x, y: bot.y, acts, chat: bot.chat}).catch(() => bot.view); if (bot.view?.me?.moved) { bot.x = bot.view.me.x; bot.y = bot.view.me.y; } } await new Promise(r => setTimeout(r, 300)); } })();

// CREW_IMP=1 делает вредителем игрока в браузере, иначе вредителем будет один из программных игроков.
await fetch(BASE + '/test/crew/imp/' + encodeURIComponent(process.env.CREW_IMP ? 'Браузер Игрок' : 'Бот Третий'));
await fetch(BASE + '/test/teacher/0'); await b.size(1440, 860);
await b.send('Page.navigate', {url: BASE + '/courses/game-8-crew/'}); await b.ev("await waitFor(()=>$('.cr-login form'));");
b.check('ученику пульт учителя не предлагается', await b.ev("return !/пульт учителя/i.test($('.cr-login').textContent)")); await b.shot('crew-login', 1440, 860, false);
await b.ev(`$('.cr-login select').value='${CLASS}';$('.cr-login select').dispatchEvent(new Event('change'));$('[data-field=name]').value='Браузер Игрок';$('.cr-login form').requestSubmit();`);
await until("c.phase==='lobby'"); for (const n of ['Бот Первый', 'Бот Второй', 'Бот Третий', 'Бот Четвёртый', 'Бот Пятый']) await addBot(n);
await until('c.players.length===6'); await b.sleep(400); await b.shot('crew-lobby', 1440, 860, false);
b.check('в сборе шестеро, роль ещё не выдана', (await st()).secret.role === '' && await b.ev("return document.querySelectorAll('.cr-players li').length===6"));
await press('Enter'); await b.ev("document.activeElement.value='всем привет';$('.cr-chatform').requestSubmit();"); await b.sleep(900);
b.check('чат в ожидании раунда работает', bots[0].view.chat.some(c => c.text === 'всем привет') || (await st()).chat > 6);
b.check('без учителя раунд не начать', (await teacher('start')).status === 'error');
await fetch(BASE + '/test/teacher/1'); await teacher('settings', {settings: {infect: 5, meeting: 30}}); const started = await teacher('start');
b.check('учитель запускает раунд и видит роли', started.phase === 'play' && started.players.filter(p => p.role === 'imp').length === 1 && started.players.every(p => p.role));
await until("c.phase==='play'"); await b.sleep(600); await b.shot('crew-intro', 1440, 860, false);
const role = (await st()).secret.role, impId = started.players.find(p => p.role === 'imp').id, myId = (await st()).me.id;
b.check('роль на экране не видна: строка личного дела прозрачна', await b.ev("return getComputedStyle($('.cr-secret')).opacity==='0'&&!$('.cr-secret').classList.contains('show')"));
await key('rawKeyDown', 'KeyQ'); await b.sleep(250);
b.check('пока зажата Q, видна карточка роли с памяткой (вредителю — как отключать экипаж и устраивать аварии)', await b.ev(`const e=$('.cr-secret'),t=e.textContent;return getComputedStyle(e).opacity==='1'&&(${JSON.stringify(role)}==='imp'?/Ты — ВРЕДИТЕЛЬ/.test(t)&&/убить/.test(t)&&/Авария реактора/.test(t)&&/Погасить свет/.test(t)&&/Заблокировать двери/.test(t):/Ты — ЭКИПАЖ/.test(t)&&/Задания и ремонт/.test(t))`), await b.ev("return $('.cr-secret').textContent.slice(0,200)"));
await b.shot('crew-card-' + role, 1280, 800, false);
await key('keyUp', 'KeyQ'); await b.sleep(150); b.check('отпустил Q — карточка исчезла', await b.ev("return getComputedStyle($('.cr-secret')).opacity==='0'"));
b.check('набор элементов экрана не зависит от роли', await b.ev("return ['.cr-tasks','.cr-hint','.cr-alert','.cr-secret','.cr-over','.cr-players','.cr-chat'].every(s=>!!$(s))&&document.querySelectorAll('.cr-tasks li').length===5&&![...document.querySelectorAll('#crew *')].some(n=>/imp|role|вред/i.test(n.className))"));
const x0 = (await st()).x; await key('rawKeyDown', 'ArrowRight'); await b.sleep(700); await key('keyUp', 'ArrowRight'); b.check('игрок ходит по станции', (await st()).x > x0 + 1.0, `${x0} → ${(await st()).x}`);
await b.sleep(6200); await b.shot('crew-play', 1440, 860, false); const cv = await b.ev('return window.crewView');
b.check('указатель ведёт к ближайшему заданию: комната и расстояние', cv.trail && cv.trail.steps > 0 && cv.trail.room.length > 2 && cv.layer, JSON.stringify(cv.trail));
await press('KeyM'); await b.sleep(300); await b.shot('crew-map', 1440, 860, false); b.check('клавиша M открывает большую карту', (await b.ev('return window.crewView')).bigMap === true); await press('KeyM');
// Задание у терминала.
// Свет: гаснет по команде (как от вредителя), видимость падает, указатель ведёт к щитку.
await teacher('sabotage', {kind: 'lights'}); await b.ev("await waitFor(()=>window.crewView&&window.crewView.dark)"); await b.sleep(400); await b.shot('crew-dark', 1440, 860, false);
b.check('погас свет: темно, объявление и указатель к щитку', await b.ev("return /ПОГАС СВЕТ/.test($('.cr-alert').textContent)&&window.crewView.trail.fix===true"));
await teacher('unsabotage'); await b.ev("await waitFor(()=>!window.crewView.dark)");
// Двери: запираются по команде, проход закрыт для всех одинаково.
await teacher('sabotage', {kind: 'doors'}); await b.ev("await waitFor(()=>window.crewView&&window.crewView.locked)"); const door = (await b.ev('return window.crewWorld')).doors[0];
await b.ev(`crewGo(${door[0] + 0.5},${door[1] + 0.5})`); await b.sleep(500); await b.shot('crew-doors', 1440, 860, false);
b.check('двери заперты: объявление с отсчётом', await b.ev("return /ДВЕРИ ЗАБЛОКИРОВАНЫ: \\d+ с/.test($('.cr-alert').textContent)"));
await teacher('unsabotage'); await b.ev("await waitFor(()=>!window.crewView.locked)");
// Пост наблюдения: камеры включаются у пульта на мостике, остальные видят огонёк.
const camAt = (await b.ev('return window.crewWorld')).cams; await b.ev(`crewGo(${camAt.x + 0.5},${camAt.y + 1.3})`); await b.sleep(600);
b.check('у поста наблюдения появляется подсказка', await b.ev("return /E — камеры наблюдения/.test($('.cr-hint').textContent)"));
await press('KeyE'); await b.sleep(1200); await b.shot('crew-cams', 1440, 860, false);
b.check('камеры включены, и это видно остальным игрокам', (await b.ev('return window.crewView')).camMode === true && bots[0].view.watch === true);
await press('Escape'); await b.sleep(900); b.check('отошёл от камер — огонёк погас', (await b.ev('return window.crewView')).camMode === false && bots[0].view.watch === false);
b.check('особая роль: при шести игроках в экипаже есть инженер', started.players.filter(p => p.job === 'engineer').length === 1 && started.players.find(p => p.job === 'engineer').role === 'crew');
// Задания у терминалов: открываем терминал, пока не увидим все пять типов, потом решаем одно.
const world = await b.ev('return window.crewWorld'), task = (await st()).me.tasks[0].i, T = world.terminals[task], seenTypes = new Set();
b.check('станция увеличена: 12 комнат и не меньше 20 терминалов', world.rooms.length === 12 && world.terminals.length >= 20 && world.map[0].length >= 60, `${world.map[0].length}×${world.map.length}`);
const answer = async () => { const q = (await st()).me.quiz, type = q.type || 'choice';
  if (type === 'choice') await press('Digit1'); else if (type === 'input') await b.ev("const i=document.querySelector('.cr-answer');i.value='1';i.closest('form').requestSubmit()"); else if (type === 'bits') { await press('Digit1'); await press('Enter'); }
  else { const n = type === 'order' ? q.items.length : q.left.length; for (let i = 1; i <= n; i++) await press('Digit' + i); await press('Enter'); } };
await b.ev(`crewGo(${T[0] + 0.5},${T[1] + 1.4})`); await b.sleep(500); b.check('у терминала появляется подсказка', await b.ev("return /E — открыть терминал/.test($('.cr-hint').textContent)"));
for (let n = 0; n < 60 && seenTypes.size < 5; n++) { await press('KeyE'); await until('c.me.quiz'); const type = (await st()).me.quiz.type; if (!seenTypes.has(type)) { seenTypes.add(type); await b.sleep(350);
    if (type === 'order' || type === 'match') { await press('Digit2'); await press('Digit1'); } if (type === 'bits') { await press('Digit1'); await press('Digit3'); } await b.sleep(200); await b.shot('crew-quiz-' + type, 1440, 860, false);
    b.check(`задание типа ${type}: окно своего вида, решения в данных нет`, await b.ev(`const q=window.crew.me.quiz;return $('.cr-box.quiz').dataset.type==='${type}'&&!('sol' in q)&&!('show' in q)`)); }
  await press('Escape'); await until('!c.me.quiz'); }
b.check('у терминалов встречаются все пять типов заданий', seenTypes.size === 5, [...seenTypes].join(', '));
await press('KeyE'); await until('c.me.quiz'); await b.sleep(300); await answer(); await until('c.me.right+c.me.wrong===1'); await b.sleep(300);
const ans = await st(); b.check('ответ проверяет сервер и сообщает результат', await b.ev("return /Верно|Неверно/.test($('.cr-over').textContent)"), ans.me.right ? 'верно' : 'неверно');
// Задание с переключателями решаем по-настоящему: число написано в вопросе. Так у игрока точно будет верный ответ для отметки.
if (!(await st()).me.right) { await b.sleep(4300); const next = (await st()).me.tasks.find(t => !t.done).i, P = world.terminals[next]; await b.ev(`crewGo(${P[0] + 0.5},${P[1] + 1.4})`); await b.sleep(500);
  for (let n = 0; n < 80; n++) { await press('KeyE'); await until('c.me.quiz'); const q = (await st()).me.quiz; if (q.type !== 'bits') { await press('Escape'); await until('!c.me.quiz'); continue; }
    const bin = Number(/число (\d+)/.exec(q.q)[1]).toString(2).padStart(q.bits, '0'); for (let i = 0; i < q.bits; i++) if (bin[i] === '1') await press('Digit' + (i + 1)); await press('Enter'); await until('c.me.right===1'); break; } }
b.check('задание с переключателями решается с клавиатуры', (await st()).me.right === 1); await b.sleep(4200);
b.check('шкала заданий во время смены не двигается', (await st()).progress[0] === 0);
// Заражение с задержкой: вредитель встаёт рядом с жертвой и даёт импульс.
const victim = role === 'imp' ? bots[0] : null; await b.sleep(Math.max(0, 21500 - (Date.now() - startedAt())));
function startedAt() { return startedAt.t || (startedAt.t = Date.now() - 6000); }
if (role === 'imp') { await b.ev(`crewGo(${bots[0].x + 0.6},${bots[0].y})`); await b.sleep(600); await press('KeyF'); await b.sleep(900);
  b.check('вредитель в браузере: импульс выглядит как у всех, результат — только в личном деле', (await st()).secret.last.startsWith('заражён') && await b.ev("return getComputedStyle($('.cr-secret')).opacity==='0'"));
  await b.sleep(5600); const tv = await teacher('state'); b.check('жертва отключается через 5 секунд, а не сразу', tv.players.find(p => p.id === bots[0].id).alive === false);
} else { const imp = bots.find(x => x.id === impId), me = await st(); await place(imp, me.x + 0.6, me.y); await b.sleep(800); imp.acts.push({t: 'pulse'}); await b.sleep(1200);
  b.check('после импульса вредителя игрок ещё жив и ничего не замечает', (await st()).me.alive === true && await b.ev("return $('.cr-over').hidden")); await b.shot('crew-pulse', 1440, 860, false);
  await until('!c.me.alive', 9000); await b.sleep(400); await b.shot('crew-ghost', 1440, 860, false);
  b.check('через 5 секунд игрок отключён; ему открыт чат отключённых', await b.ev("return !$('.cr-chatform input').disabled&&/отключён/.test($('.cr-chatnote').textContent)"));
  await press('Enter'); await b.ev("document.activeElement.value='меня отключили у терминала';$('.cr-chatform').requestSubmit();"); await b.sleep(1000);
  b.check('живые не видят чат отключённых', !bots.filter(x => x.id !== impId)[0].view.chat.some(c => /меня отключили/.test(c.text)));
}
// Собрание: живой член экипажа находит отключённого и сообщает.
const tv = await teacher('state'), body = tv.players.find(p => !p.alive), reporter = bots.find(x => x.id !== impId && x.id !== body.id);
await place(reporter, body.x + 0.5, body.y); await b.sleep(900); reporter.acts.push({t: 'report'}); await until("c.phase==='meeting'"); await b.sleep(500);
reporter.acts.push({t: 'chat', text: 'я нашёл его в коридоре, рядом был ' + (tv.players.find(p => p.id === impId).name)}); await b.sleep(1200); await b.shot('crew-meeting', 1440, 860, false);
b.check('собрание: список для голосования и сообщение в чате', await b.ev("return document.querySelectorAll('.cr-vote').length===7&&/нашёл его в коридоре/.test($('.cr-chat').textContent)"));
b.check('шкала заданий обновилась на собрании', (await st()).progress[0] === (role !== 'imp' ? 1 : 0));
const meAlive = (await st()).me.alive;
if (meAlive) { await b.ev(`document.querySelector('[data-vote="${role === 'imp' ? 'skip' : impId}"]').click()`); await b.sleep(700); b.check('голос принят и повторно не меняется', await b.ev("return [...document.querySelectorAll('.cr-vote')].every(x=>x.disabled)&&!!document.querySelector('.cr-vote.mine')")); }
else b.check('отключённый не голосует', await b.ev("return [...document.querySelectorAll('.cr-vote')].every(x=>x.disabled)"));
for (const bot of bots) if (bot.view.me.alive) bot.acts.push({t: 'vote', id: role === 'imp' ? 'skip' : impId});
await until("c.phase==='result'||c.phase==='end'", 40000); await b.sleep(500); await b.shot('crew-result', 1440, 860, false);
if (role === 'imp') { b.check('большинство пропустило — никого не исключили', /Никого не исключили/.test((await st()).meeting?.result?.text || '')); await teacher('stop'); }
else { await until("c.phase==='end'", 12000); await b.sleep(400); await b.shot('crew-end', 1440, 860, false);
  b.check('вредитель исключён — победа экипажа, роли раскрыты', (await st()).winner === 'crew' && await b.ev("return /вредитель/.test($('.cr-players').textContent)&&/Победил экипаж/.test($('.cr-over').textContent)"));
  b.check('итог раунда: написано, кто был вредителем и кто победил, и кнопка «Готов» к новому раунду', await b.ev("return /Вредител(ем был|ями были)/.test($('.cr-over').textContent)&&/Победители:/.test($('.cr-over').textContent)&&!!$('[data-act=ready]')"), await b.ev("return $('.cr-over').textContent.slice(0,300)"));
  await b.shot('crew-end-result', 1440, 860, false); }
// Пульт учителя в браузере: вкладки и полный контроль.
const tv2 = () => b.ev('return window.crewTeacher'), tab = async id => { await b.ev(`document.querySelector('[data-tab=${id}]').click()`); await b.sleep(500); };
const click = async sel => { await b.ev(`window.confirm=()=>true;document.querySelector('${sel}').click()`); await b.sleep(900); };
await b.send('Page.navigate', {url: 'about:blank'}); await b.sleep(300); await b.send('Page.navigate', {url: BASE + '/courses/game-8-crew/#pult'}); await b.sleep(2500); await b.ev("await waitFor(()=>$('.cr-tabs'),20000);");
b.check('ссылка #pult сразу открывает пульт с пятью вкладками', await b.ev("return document.querySelectorAll('.cr-tab').length===5"));
await b.ev(`const s=document.querySelectorAll('.cr-teacher .cr-top select');s[1].value='В';s[1].dispatchEvent(new Event('change'));`); await b.ev("await waitFor(()=>window.crewTeacher&&window.crewTeacher.className==='8 «В»'&&window.crewTeacher.rooms);"); await tab('round'); await b.sleep(1500);
await b.shot('pult-round', 1440, 900, false);
b.check('вкладка «Раунд»: шаги запуска, большие кнопки, карта станции', await b.ev("return document.querySelectorAll('.cr-steps li').length===3&&!!$('[data-act=start]')&&!!$('[data-act=pause]')&&!!$('.cr-mini')"));
b.check('число вредителей выбирается кнопками у запуска', await b.ev("return document.querySelectorAll('[data-imps]').length===7&&$('[data-imps=\"0\"]').classList.contains('cr-on')"));
await click('[data-imps="2"]'); b.check('учитель выбрал двух вредителей', (await tv2()).settings.imposters === 2 && await b.ev("return $('[data-imps=\"2\"]').classList.contains('cr-on')")); await click('[data-imps="0"]');
await tab('players'); const rowsBefore = (await (await fetch(BASE + '/test/journal')).json()).length;
await b.ev("const i=document.querySelector('[data-need=\"0\"]');i.value=1;i.dispatchEvent(new Event('change'));"); await b.sleep(300); await click('[data-act=marks]'); await b.sleep(600); await b.shot('pult-marks', 1440, 900, true);
b.check('отметки за урок: предложение по верным ответам, в журнал пока ничего не ушло', await b.ev("return document.querySelectorAll('.cr-marks .cr-table tr').length===7&&!!$('[data-act=marks-apply]')") && (await (await fetch(BASE + '/test/journal')).json()).length === rowsBefore);
const withMark = await b.ev("return document.querySelectorAll('.cr-marks td.cr-mark').length"); await click('[data-act=marks-apply]'); await b.sleep(700); let jr = await (await fetch(BASE + '/test/journal')).json();
b.check('учитель записал отметки в журнал стенда: по одной строке на ученика с отметкой', withMark >= 1 && jr.length === rowsBefore + withMark && jr.slice(-withMark).every(r => /Сбой на станции/.test(JSON.stringify(r)) && /8 «В»/.test(JSON.stringify(r))), `${withMark} строк`);
await click('[data-act=marks-apply]'); await b.sleep(700); jr = await (await fetch(BASE + '/test/journal')).json(); b.check('повторная запись не плодит строки', jr.length === rowsBefore + withMark);
await b.shot('pult-players', 1440, 900, false);
b.check('вкладка «Игроки»: таблица и назначение вредителя галочкой', await b.ev("return $('.cr-table').querySelectorAll('tr').length===7&&document.querySelectorAll('[data-pick]').length===6"));
const chosen = bots[1].id; await b.ev(`const c=document.querySelector('[data-pick="${chosen}"]');c.checked=true;c.dispatchEvent(new Event('change'));`); await tab('round'); await click('[data-act=start]');
let v = await tv2(); b.check('раунд запущен с пульта, вредитель — тот, кого выбрал учитель', v.phase === 'play' && v.round >= 2 && v.players.filter(p => p.role === 'imp').map(p => p.id).join() === String(chosen));
await click('[data-act=pause]'); v = await tv2(); b.check('пауза с пульта', v.paused === true && bots[0].view.paused === true); await b.shot('pult-paused', 1440, 900, false);
await click('[data-act=pause]'); await click('[data-act=meeting]'); v = await tv2(); b.check('собрание с пульта', v.phase === 'meeting');
bots[0].acts.push({t: 'chat', text: 'сообщение на удаление'}); await b.sleep(1500); await tab('chat'); await b.sleep(1300);
await b.ev("const i=$('[data-keep=announce]');i.value='Обсуждаем спокойно';i.closest('form').requestSubmit();"); await b.sleep(1500); await b.shot('pult-chat', 1440, 900, false);
b.check('объявление учителя дошло до игроков', bots[2].view.chat.some(c => c.ch === 'teacher' && c.text === 'Обсуждаем спокойно') || (await tv2()).chat.some(c => c.ch === 'teacher'));
await b.ev("[...document.querySelectorAll('.cr-chat.big .cr-msg')].find(m=>/на удаление/.test(m.textContent)).querySelector('.cr-x').click()"); await b.sleep(1200);
b.check('сообщение удалено крестиком', !(await tv2()).chat.some(c => /на удаление/.test(c.text)));
await tab('round'); await click('[data-act=endvote]'); v = await tv2(); b.check('голосование завершено досрочно', v.phase === 'result' || v.phase === 'play' || v.phase === 'end');
await tab('settings'); await b.shot('pult-settings', 1440, 900, false);
b.check('вкладка «Настройки»: 8 чисел, 5 флажков, 4 готовых набора, выбор из 3 локаций и случайной', await b.ev("return document.querySelectorAll('[data-set]').length===8&&document.querySelectorAll('[data-flag]').length===5&&document.querySelectorAll('.cr-teacher .cr-tbar .cr-small').length===8&&document.querySelectorAll('[data-map]').length===4"));
await click('[data-map=sea]'); await tab('round'); await click('[data-act=stop]'); await click('[data-act=start]'); await b.sleep(1200); await b.shot('pult-sea', 1440, 900, false);
b.check('учитель выбрал подводную базу: новый раунд идёт на ней', (await tv2()).world === 'sea' && bots[0].view.world === 'sea'); await tab('settings');
await b.ev("[...document.querySelectorAll('.cr-teacher .cr-tbar .cr-small')].find(x=>/Быстрый/.test(x.textContent)).click()"); await b.sleep(900); b.check('готовый набор применяется', (await tv2()).settings.tasks === 3 && (await tv2()).settings.meeting === 45);
await tab('server'); await b.sleep(1500); await b.shot('pult-server', 1440, 900, false);
b.check('вкладка «Сервер»: состояние, комнаты, ссылка для учеников', await b.ev("return /работает/.test($('.cr-facts').textContent)&&document.querySelectorAll('.cr-table tr').length>=2&&$('.cr-link').value.endsWith('/courses/game-8-crew/')&&!!$('[data-act=push]')"));
const sc = await post('teacher', {className: '8 «В»', action: 'screen'}); b.check('экран проектора: без ролей и координат', sc.status === 'ok' && !JSON.stringify(sc).includes('"role"') && !JSON.stringify(sc).includes('"x"'));
await click('[data-act=open]'); b.check('игра закрыта для всех: новый ученик не войдёт', (await post('join', {className: '8 «Г»', name: 'Поздний Ученик'})).status === 'error' && (await tv2()).server.open === false);
await click('[data-act=open]'); b.check('игра снова открыта', (await post('teacher', {action: 'overview'})).server.open === true);
await click('[data-act=clearall]'); b.check('все комнаты распущены', (await post('teacher', {action: 'overview'})).rooms.length <= 1);
await teacher('clear'); await fetch(BASE + '/test/teacher/0'); running = false; await b.sleep(400);
await b.size(390, 800); b.check('на телефоне нет горизонтальной прокрутки', await b.ev('return document.documentElement.scrollWidth<=innerWidth'));
b.done();
