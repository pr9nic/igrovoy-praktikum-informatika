import {browser,BASE} from './lib.mjs';
const {send,ev,sleep,size,shot,check,done}=await browser();
const K=`const R=()=>School4Run;const key=(k,type='keydown')=>document.body.dispatchEvent(new KeyboardEvent(type,{key:k,bubbles:true,cancelable:true}));const tap=k=>{key(k);key(k,'keyup')};const skip=async()=>{for(let n=0;n<8&&R().talking();n++){tap('Enter');await sleep(25)}};const fight=async i=>{R().enter(i);await waitFor(()=>['stage','perk'].includes(R().state()));await skip();if(R().state()==='stage')R().toPerk();R().takePerk(0);await skip();await waitFor(()=>R().state()==='fight'&&R().q(),7000);R().hero.safe=99999};`;
const name='Проверка Фаз',klass='8 «А»',slug='trainer-8-glitch';
await fetch(BASE+'/test/teacher/1');
for(const [name,stars] of [['Тест Чемпион',3],['Тест Соперник',2],['Тест Другой',1]])await fetch(BASE+'/results/api/trainer/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,className:name==='Тест Другой'?'8 «Б»':klass,name,levels:{'boss-1':{stars}}})});
await size(1440,1000);const url=BASE+'/courses/'+slug+'/';await send('Page.navigate',{url});await sleep(500);await ev('localStorage.clear();sessionStorage.clear()');await send('Page.navigate',{url:'about:blank'});await send('Page.navigate',{url});await sleep(500);
await ev(`await waitFor(()=>$('.t-login'));$('[data-field=name]').value='${name}';$('.t-login').requestSubmit();await waitFor(()=>window.School4Run)`);await ev(K+'await skip()');
await ev(`$('[data-act=records]').click();await waitFor(()=>$('.t-records tbody tr'))`);
check('рекорды класса: реальные звёзды, свой игрок, соседний класс не показан',await ev(`return $('.t-records').textContent.includes('Тест Чемпион')&&$('.t-records').textContent.includes('Тест Соперник')&&$('.t-records').textContent.includes('Проверка Фаз · вы')&&!$('.t-records').textContent.includes('Тест Другой')&&$('.t-records tbody tr:first-child').textContent.includes('3 / 15')`));
await size(390,844);check('таблица рекордов помещается на телефоне',await ev('return document.documentElement.scrollWidth<=innerWidth'));await shot('class-records-mobile',390,844);await size(1440,1000);
await ev(`$('.t-records button').click();await waitFor(()=>window.School4Run.state()==='hub')`);
for(let i=0;i<5;i++){
 await ev(K+`await fight(${i});R().boss.wait=0;await waitFor(()=>R().boss.warning)`);
 check(`босс ${i+1}: сначала предупреждение, выстрела ещё нет, три ответа`,await ev(K+`const w=R().boss.warning,angle=w.angle,marks=JSON.stringify(w.marks),h=R().hero;h.x=250;await sleep(180);return !!R().boss.warning&&R().shots.length===0&&R().foes.length===0&&R().q().labels.length===3&&R().boss.warning.angle===angle&&JSON.stringify(R().boss.warning.marks)===marks`));
 await ev(K+`await waitFor(()=>R().shots.length||R().foes.length,2500);R().shots.length=R().foes.length=0;R().boss.hp=4;R().boss.wait=99999;tap(String(R().q().correct+1))`);
 check(`босс ${i+1}: верный ответ переводит бой во вторую фазу`,await ev(K+'return R().boss.phase===2&&R().boss.hp===3'));
 const result=await ev(K+`R().shots.length=R().foes.length=0;R().boss.warning=null;R().boss.wait=0;await waitFor(()=>R().boss.warning);const w=R().boss.warning,kind=w.kind;const planned=kind==='rain'?w.marks.length:kind==='wave'?w.lanes.length:kind==='aim'?3:2;await waitFor(()=>R().shots.length||R().foes.length,2500);return [kind,planned,R().shots.length||R().foes.length]`);
 check(`босс ${i+1}: новый приём второй фазы`,result[1]===result[2],result);
 if(i===1){await shot('phase-two-rain',1440,1000)}
}
check('повторный бой начинает с первой фазы',await ev(K+`R().restart();return R().boss.phase===1&&R().boss.warning===null&&R().boss.hp===R().boss.max`));
await fetch(BASE+'/test/teacher/0');done();
