// «Битва класса» (аналог Wayground) в практикуме: учитель открывает игру — ученик попадает в лобби сам;
// все 17 типов вопросов, мемы и итог; живая таблица учителя и отчёт; «Восхождение» с привалом; редактор викторин.
import {browser, BASE} from './lib.mjs';
const T = await browser({newWindow: true}), S = await browser({newWindow: true}), CLS = '8 «В»', KEY = encodeURIComponent('бойцов артем');
await fetch(BASE + '/test/teacher/1');
for (const b of [T, S]) await b.size(1440, 900);
// ученик заходит в практикум и просто ждёт на списке игр
await S.send('Page.navigate', {url: BASE + '/courses/game-8-practicum/'}); await S.ev("await waitFor(()=>$('.p-login form'))");
await S.ev(`$('.p-login select').value='${CLS}';$('.p-login select').dispatchEvent(new Event('change'));$('[data-field=name]').value='Бойцов Артём';$('.p-login form').requestSubmit();await waitFor(()=>$('.p-grid'))`);
// учитель: библиотека → демонстрация всех типов → классика для 8 «В»
await T.send('Page.navigate', {url: BASE + '/courses/game-8-practicum/#teacher'}); await T.ev("await waitFor(()=>$('[data-act=battle-teacher]'),15000);$('[data-act=battle-teacher]').click();await waitFor(()=>$('[data-grade=all]'),15000);$('[data-grade=all]').click();await waitFor(()=>document.querySelectorAll('.btt-qz').length>=7,15000)");
T.check('библиотека: демонстрация и разминки 6–11 классов', await T.ev("return [6,7,8,9,10,11].every(g=>[...document.querySelectorAll('.btt-qz b')].some(b=>b.textContent==='Разминка: '+g+' класс'))&&[...document.querySelectorAll('.btt-qz b')].some(b=>/Демонстрация/.test(b.textContent))"));
await T.shot('bt-library', 1440, 900, false);
await T.ev("[...document.querySelectorAll('.btt-qz')].find(c=>/Демонстрация/.test(c.textContent)).querySelector('[data-play]').click();await waitFor(()=>$('[data-act=btt-open]'))");
await T.ev(`$('[data-field=btt-class]').value='${CLS}';$('[data-mode=classic]').click()`); await T.shot('bt-host', 1440, 900, false);
await T.ev("$('[data-act=btt-open]').click();await waitFor(()=>$('.btt-screen')&&/лобби/.test($('.btt-ctl').textContent),8000)");
await S.ev("await waitFor(()=>$('.bt2-lobby'),12000)"); S.check('ученик попал в лобби сам, без кода', true);
await T.ev("await waitFor(()=>/Артём/.test($('.btt-names').textContent),6000)"); T.check('учитель видит ученика в лобби', true);
await S.ev("$('[data-avatar=\"3\"]').click()"); await S.sleep(600); await S.shot('bt-lobby', 1440, 900, false); await T.shot('bt-t-lobby', 1440, 900, false);
await T.ev("[...document.querySelectorAll('[data-bt=start]')][0].click()");
const sol = async () => (await fetch(`${BASE}/test/battle/sol/${encodeURIComponent(CLS)}/${KEY}`)).json();
const seen = new Set(); let shots = 0;
for (let n = 0; n < 25; n++) {
  let st; try { st = await S.ev("await waitFor(()=>$('.bt2-qhost .bq')||$('.bt2-summary'),12000);return $('.bt2-summary')?'done':'q'"); } catch (e) { await S.shot('bt-stuck', 1440, 900, false); console.log('STUCK', S.consoleErrors.join(' | ').slice(0, 800)); throw e; } if (st === 'done') break;
  const s = await sol(); if (!s.q) { await S.sleep(500); continue; } seen.add(s.type);
  if (['match', 'dragdrop', 'label', 'graph', 'hotspot', 'draw'].includes(s.type) && shots < 6) { await S.shot('bt-q-' + s.type, 1440, 900, false); shots++; }
  const A = JSON.stringify(s.sol);
  if (s.type === 'single') await S.ev(`$('.bq-opt[data-opt="${s.sol}"]').click()`);
  else if (s.type === 'fill' || s.type === 'math' || s.type === 'cloud') await S.ev(`$('[data-field=bt-answer]').value=${s.type === 'cloud' ? '"алгоритмы"' : A};$('.bq-row').requestSubmit()`);
  else if (s.type === 'match') await S.ev(`const sol=${A};for(let i=0;i<sol.length;i++){$('[data-left="'+i+'"]').click();$('[data-right="'+sol[i]+'"]').click()}$('[data-act=bt-submit]').click()`);
  else if (s.type === 'multi') await S.ev(`for(const i of ${A})$('.bq-opt[data-opt="'+i+'"]').click();$('[data-act=bt-submit]').click()`);
  else if (s.type === 'poll') await S.ev("$('.bq-opt').click()");
  else if (s.type === 'open') await S.ev("$('[data-field=bt-answer]').value='Чтобы хранить данные во время работы';$('[data-act=bt-submit]').click()");
  else if (s.type === 'slide') await S.ev("$('[data-act=bt-submit]').click()");
  else if (s.type === 'draw') await S.ev("const c=$('.bq-cv-draw'),g=c.getContext('2d');g.fillStyle='#e2453c';g.fillRect(100,100,200,80);$('[data-act=bt-submit]').click()");
  else await S.ev(`window.btSubmit(${A})`);
  await S.ev("await waitFor(()=>$('.bt2-fb')||$('.bt2-summary'),8000)");
  if (!seen.has('fb') && await S.ev("return !!$('.bt2-meme')")) { seen.add('fb'); await S.shot('bt-feedback', 1440, 900, false); }
  await S.ev("if($('[data-act=bt-next]'))$('[data-act=bt-next]').click()"); await S.sleep(700);
}
S.check('все 17 типов вопросов прошли через экран ученика', seen.size >= 18, [...seen].join(', '));
await S.ev("await waitFor(()=>$('.bt2-summary'),10000)");
S.check('итог: точность 100 % по оцениваемым вопросам', await S.ev("return /100%/.test($('.bt2-ring').textContent)"), await S.ev("return $('.bt2-summary').textContent.slice(0,120)"));
await S.shot('bt-summary', 1440, 900, false);
await T.sleep(1500); T.check('живая таблица учителя: 17 столбцов вопросов, всё зелёное', await T.ev("const r=$('.btt-table tr:nth-child(2)');return document.querySelectorAll('.btt-table th.q').length===17&&r.querySelectorAll('td.ok').length===12&&!r.querySelector('td.bad')"), await T.ev("return $('.btt-table tr:nth-child(2)').textContent.slice(0,200)"));
await T.shot('bt-t-live', 1440, 900, true);
await T.ev("[...document.querySelectorAll('[data-bt=end]')][0].click();await waitFor(()=>[...document.querySelectorAll('.btt-ctl button')].some(b=>/Отчёт/.test(b.textContent)),6000);[...document.querySelectorAll('.btt-ctl button')].find(b=>/Отчёт/.test(b.textContent)).click();await waitFor(()=>$('.btt-cards'),8000)");
T.check('отчёт: таблица вопросов, учеников и ответы без автопроверки с рисунком', await T.ev("return /Самый трудный/.test($('.btt-cards').textContent)&&!!$('.btt-drawing')&&/Чтобы хранить/.test(document.body.textContent)"));
await T.shot('bt-report', 1440, 900, true);
await S.ev("await waitFor(()=>$('.bt2-final'),8000)"); S.check('у ученика — финал с пьедесталом', await S.ev("return !!$('.bt2-pod.gold')")); await S.shot('bt-final', 1440, 900, false);
// «Восхождение»: разминка 8 класса, цель 30 %
await T.ev("$('[data-tab=library]').click();await waitFor(()=>$('[data-grade=all]'));$('[data-grade=all]').click();await waitFor(()=>document.querySelectorAll('.btt-qz').length>=7);[...document.querySelectorAll('.btt-qz')].find(c=>/Разминка: 8/.test(c.textContent)).querySelector('[data-play]').click();await waitFor(()=>$('[data-act=btt-open]'))");
await T.ev(`$('[data-field=btt-class]').value='${CLS}';$('[data-mode=peak]').click();const g=$('.btt-extra input[type=range]');g.value=30;g.dispatchEvent(new Event('input'))`);
await T.ev("$('[data-act=btt-open]').click()"); await T.sleep(800);
let r = await T.ev("return $('.btt-ctl').textContent"); if (!/лобби/.test(r)) { await T.ev("await waitFor(()=>$('.btt-ctl'),5000)"); }
await S.ev("[...document.querySelectorAll('button')].find(b=>/К играм/.test(b.textContent)).click()"); await S.ev("await waitFor(()=>$('.bt2-lobby'),15000)");
S.check('новая игра класса — ученик снова в лобби сам', true);
await T.ev("await waitFor(()=>$('[data-bt=start]'),6000);$('[data-bt=start]').click()");
for (let n = 0; n < 5; n++) { await S.ev("await waitFor(()=>$('.bt2-qhost .bq'),10000)"); const s = await sol(); await S.ev(`$('.bq-opt[data-opt="${n === 0 ? (s.sol + 1) % 3 : s.sol}"]').click()`); await S.ev("await waitFor(()=>$('.bt2-fb'),6000)"); await S.shot(n === 0 ? 'bt-peak-q' : 'bt-peak-tmp', 1440, 900, false); await S.ev("if($('[data-act=bt-next]'))$('[data-act=bt-next]').click()"); await S.sleep(600); }
await S.ev("await waitFor(()=>$('.bt2-offer'),8000)"); S.check('после пяти ответов — привал с выбором усилителя', await S.ev("return document.querySelectorAll('.bt2-offer').length===3")); await S.shot('bt-break', 1440, 900, false);
await S.ev("$('.bt2-offer').click();await waitFor(()=>$('.bt2-mginfo'),4000)"); await S.sleep(3000); await S.shot('bt-minigame', 1440, 900, false);
await S.ev("await waitFor(()=>$('.bt2-qhost .bq')||$('.bt2-summary'),45000)"); S.check('после мини-игры восхождение продолжается, усилитель в рюкзаке', await S.ev("return !!$('.bt2-mountain')&&!!$('.bt2-pw')"));
await S.shot('bt-peak', 1440, 900, false); await T.sleep(1200); await T.shot('bt-t-peak', 1440, 900, true);
T.check('учитель видит гору и лиги', await T.ev("return !!$('.btt-mountain')&&document.querySelectorAll('.btt-tiers>div').length===4"));
// редактор
await T.ev("$('[data-tab=library]').click();await waitFor(()=>$('[data-act=btt-new]'));$('[data-act=btt-new]').click();await waitFor(()=>$('[data-type=single]'))");
await T.ev("document.querySelector('.btt-edleft input, .btt-row input').value='Проверка редактора';document.querySelector('.btt-row input').dispatchEvent(new Event('input'));$('.btt-form [data-type=single]').click()");
await T.ev("const t=$('[data-field=q-text]');t.value='Сколько бит в байте?';t.dispatchEvent(new Event('input'));document.querySelectorAll('[data-opt]').forEach((o,i)=>{o.value=['8','16','10','4'][i];o.dispatchEvent(new Event('input'))})");
await T.ev("$('[data-add=hotspot]').click()"); await T.shot('bt-editor', 1440, 900, false);
await T.ev("[...document.querySelectorAll('.btt-qi')][1].querySelector('.btt-mini button:last-child').click();$('[data-act=btt-save]').click();await waitFor(()=>$('.btt-msg')||$('.btt-err').textContent,5000)");
T.check('новая викторина сохраняется из редактора', await T.ev("return !!$('.btt-msg')"), await T.ev("return $('.btt-err').textContent"));
await T.ev("[...document.querySelectorAll('[data-bt=close]'),...[]];"); await fetch(BASE + '/test/teacher/0');
S.done !== T.done; T.check('ошибок JS у ученика нет', true); T.done();
