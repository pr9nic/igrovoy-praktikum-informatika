import {browser, BASE} from './lib.mjs';
const {send,ev,sleep,size,shot,check,done}=await browser();
const K=`const R=()=>School4Run;const key=(k,type='keydown')=>document.body.dispatchEvent(new KeyboardEvent(type,{key:k,bubbles:true,cancelable:true}));const tap=k=>{key(k);key(k,'keyup')};const skip=async()=>{for(let n=0;n<8&&R().talking();n++){tap('Enter');await sleep(30)}};`;
await fetch(BASE+'/test/teacher/1');
for(const grade of [6,7,8,9,10,11]){
 await size(1440,1000);const url=BASE+`/courses/trainer-${grade}-glitch/`;
 await send('Page.navigate',{url});await sleep(400);await ev(`localStorage.clear();sessionStorage.clear()`);await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url});await sleep(400);
 await ev(`await waitFor(()=>$('.t-login'));$('[data-field=name]').value='Проверка Простых Вопросов';$('.t-login').requestSubmit();await waitFor(()=>window.School4Run)`);
 await ev(K+`await skip();R().enter(0);await waitFor(()=>['stage','perk'].includes(R().state()));await skip();if(R().state()==='stage')R().toPerk();R().takePerk(0);await skip();await waitFor(()=>R().state()==='fight'&&R().q(),7000);R().hero.safe=99999;`);
 check(`${grade} класс: три ответа и короткий вопрос`,await ev(`return School4Run.q().labels.length===3&&School4Run.q().text.length<=60&&document.querySelectorAll('.t-answerkeys button').length===3`));
 check(`${grade} класс: атаки продолжаются во время вопроса`,await ev(K+`R().boss.wait=0;await waitFor(()=>R().boss.warning);await waitFor(()=>R().shots.length>0,3000);return !!R().q()&&R().shots.length>0`));
 check(`${grade} класс: снаряд можно отбить, читая вопрос`,await ev(K+`R().shots.length=0;R().bullets.length=0;const h=R().hero;h.x=350;h.y=R().FLOOR-h.h;h.vy=0;h.face=1;R().held.w=R().held['ц']=false;R().shots.push({x:h.x+110,y:h.y+30,vx:0,vy:0,r:18,k:'fire'});key('x');await sleep(120);key('x','keyup');return !!R().q()&&R().shots.length===0`));
 check(`${grade} класс: правильный ответ клавишей/кнопкой ранит босса`,await ev(K+`const q=R().q(),hp=R().boss.hp;if(${grade}%2)tap(String(q.correct+1));else document.querySelectorAll('.t-answerkeys button')[q.correct].click();return R().boss.hp===hp-1&&!R().q()`));
 if(grade===8){
  await ev(K+`await waitFor(()=>R().q(),5000)`);await size(390,844);await sleep(150);check('мобильный экран без горизонтальной прокрутки',await ev('return document.documentElement.scrollWidth<=innerWidth'));await shot('easy-question-mobile',390,844);
  await size(1440,1000);await ev(`document.querySelector('#trainer').classList.add('full')`);check('кнопки ответа видны во весь экран',await ev(`return [...document.querySelectorAll('.t-answerkeys button')].every(b=>b.getBoundingClientRect().height>0)`));await ev(`document.querySelector('#trainer').classList.remove('full')`);
  check('упрощённые вопросы позволяют победить босса',await ev(K+`for(let n=0;n<10&&R().state()==='fight';n++){await waitFor(()=>R().q()||R().state()!=='fight',5000);if(R().state()!=='fight')break;tap(String(R().q().correct+1));await sleep(80)}return R().state()==='won'`));
 }
}
await fetch(BASE+'/test/teacher/0');done();
