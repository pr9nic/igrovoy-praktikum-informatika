import {browser,BASE} from './lib.mjs';
const {send,ev,sleep,size,shot,check,done}=await browser();
const K=`const R=()=>School4Run;const key=(k,type='keydown')=>document.body.dispatchEvent(new KeyboardEvent(type,{key:k,bubbles:true,cancelable:true}));const tap=k=>{key(k);key(k,'keyup')};const skip=async()=>{for(let n=0;n<8&&R().talking();n++){tap('Enter');await sleep(25)}};const select=(name,value)=>{const s=document.querySelector('[data-difficulty='+name+']');s.value=value;s.dispatchEvent(new Event('change'))};const fight=async()=>{R().enter(0);await waitFor(()=>['stage','perk'].includes(R().state()));await skip();if(R().state()==='stage')R().toPerk();R().takePerk(0);await skip();await waitFor(()=>R().state()==='fight'&&R().q(),7000);R().hero.safe=99999};`;
await fetch(BASE+'/test/teacher/1');await size(1440,1000);
const url=BASE+'/courses/trainer-8-glitch/';await send('Page.navigate',{url});await sleep(500);await ev('localStorage.clear();sessionStorage.clear()');await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url});await sleep(500);
await ev(`await waitFor(()=>$('.t-login'));$('[data-field=name]').value='Проверка Режимов';$('.t-login').requestSubmit();await waitFor(()=>window.School4Run)`);await ev(K+'await skip()');
for(const questions of ['simple','standard'])for(const combat of ['normal','calm']){
 await ev(K+`select('questions','${questions}');select('combat','${combat}');await fight()`);
 check(`${questions}/${combat}: выбран правильный банк, три ответа`,await ev(K+`const d=JSON.parse($('#assignmentData').textContent),bank=d.worlds[0].levels[0]['${questions==='simple'?'questions':'standardQuestions'}'];return R().ui().questionMode==='${questions}'&&R().ui().combatMode==='${combat}'&&R().q().labels.length===3&&bank.some(t=>t.q===R().q().text&&t.explanation===R().q().explanation)`));
 check(`${questions}/${combat}: атаки идут при чтении`,await ev(K+`R().boss.wait=0;await waitFor(()=>R().boss.warning);await waitFor(()=>R().shots.length>0,3000);return R().shots.length>0&&!!R().q()`));
 const movement=await ev(K+`R().shots.length=0;R().bullets.length=0;R().boss.warning=null;R().boss.wait=99999;const h=R().hero;h.x=350;h.y=R().FLOOR-h.h;h.vy=0;h.face=1;h.cool=0;R().fire();const b=R().bullets[0],b0=b.x,o={x:800,y:100,vx:100,vy:0,r:18,k:'fire'};R().shots.push(o);const start=performance.now();await sleep(200);const elapsed=(performance.now()-start)/1000;return [(o.x-800)/elapsed,(b.x-b0)/elapsed]`);
 check(`${questions}/${combat}: темп врагов меняется, бластер сохраняет скорость`,Math.abs(movement[0]-(combat==='calm'?60:100))<20&&Math.abs(movement[1]-900)<170,movement);
 check(`${questions}/${combat}: ошибка показывает объяснение и бой продолжается`,await ev(K+`const q=R().q(),expected=q.explanation,correct=q.labels[q.correct],wrong=(q.correct+1)%3;tap(String(wrong+1));await sleep(80);return !$('.t-error-review').hidden&&$('.t-error-review').textContent.includes(expected)&&$('.t-error-review').textContent.includes(correct)&&R().ui().mistakes.length>0&&R().state()==='fight'`));
 if(questions==='standard'&&combat==='calm'){
  await size(390,844);check('разбор на мобильном экране без горизонтальной прокрутки',await ev('return document.documentElement.scrollWidth<=innerWidth'));await shot('modes-error-mobile',390,844);await size(1440,1000);await ev("$('#trainer').classList.add('full')");check('разбор виден во весь экран и не перекрывает арену',await ev(`const a=$('.t-stage').getBoundingClientRect(),e=$('.t-error-review').getBoundingClientRect();return e.height>0&&e.top>=a.bottom`));await shot('modes-error-full',1440,1000);await ev("$('#trainer').classList.remove('full')");
 }
 await ev(K+`tap('Backspace');await waitFor(()=>R().state()==='hub');`);
 check(`${questions}/${combat}: история ошибок доступна после выхода`,await ev(`return document.querySelectorAll('.t-error-history .t-error-item').length>0`));
}
await send('Page.navigate',{url});await sleep(600);
check('настройки и история сохранены после перезагрузки',await ev(`await waitFor(()=>window.School4Run);return $('[data-difficulty=questions]').value==='standard'&&$('[data-difficulty=combat]').value==='calm'&&document.querySelectorAll('.t-error-history .t-error-item').length===4`));
await fetch(BASE+'/test/teacher/0');done();
