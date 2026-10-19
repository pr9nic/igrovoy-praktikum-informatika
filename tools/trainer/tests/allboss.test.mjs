// Проходит всех боссов выбранных классов. Запуск: node allboss.test.mjs 6,7,8
import {browser, BASE} from './lib.mjs';
const {send, ev, sleep, size, shot, check, done} = await browser();
const K = `const key=(k,type='keydown')=>document.body.dispatchEvent(new KeyboardEvent(type,{key:k,bubbles:true,cancelable:true}));const R=()=>School4Run;const skip=async()=>{for(let n=0;n<8&&R().talking();n++){key('Enter');await sleep(50)}};
const shootAt=async(t)=>{const h=R().hero;h.safe=99999;h.x=t.x+t.w/2-h.w/2;h.y=R().FLOOR-h.h;h.vy=0;key('w');await sleep(40);key('x');await sleep(260);key('x','keyup');key('w','keyup');await sleep(450)};`;
await fetch(`${BASE}/test/teacher/1`); await size(1440, 900);
for (const g of (process.argv[2] || '6,7,8,9,10,11').split(',')) {
  const u = `${BASE}/courses/trainer-${g}-glitch/`; await send('Page.navigate', {url: u}); await sleep(700); await ev(`await waitFor(()=>$('.t-login')||$('.t-stage'));localStorage.clear();sessionStorage.clear()`); await send('Page.navigate', {url: 'about:blank'}); await send('Page.navigate', {url: u}); await sleep(700);
  await ev(`await waitFor(()=>$('.t-login'));$('[data-field=name]').value='Боец Проход'+String.fromCharCode(1072+Math.floor(Math.random()*30),1072+Math.floor(Math.random()*30),1072+Math.floor(Math.random()*30));$('.t-login').requestSubmit();await waitFor(()=>$('.t-stage'))`);
  const res = await ev(K + `await skip();const out=[];const n=R().doors.length;
    for(let i=0;i<n;i++){R().enter(i);await waitFor(()=>['stage','perk'].includes(R().state()));const title=$('.g-mission-title').textContent;await skip();if(R().state()==='stage'){if(R().stage().gates.length!==2)throw new Error('stage');R().toPerk()}await waitFor(()=>R().state()==='perk');R().takePerk(i%3);await skip();await waitFor(()=>R().state()==='fight'&&R().targets.length,8000);
      const seen=new Set();for(let t=0;t<30&&R().state()==='fight';t++){await waitFor(()=>(R().targets.length&&R().q())||R().state()!=='fight',8000);if(R().state()!=='fight')break;const q=R().q();seen.add(q.text);if(q.labels.length<2||q.correct<0)throw new Error('bad question '+q.text);await shootAt(R().targets.find(t=>t.k===q.correct))}
      await waitFor(()=>R().talking(),9000);out.push(title.split(':')[1].split('—')[0].trim()+' '+R().state()+' '+R().ui().line.match(/[★☆]+/)[0]+' вопросов '+seen.size);await skip();await waitFor(()=>R().state()==='hub');await sleep(200)}
    return out.join(' | ')`);
  check(`класс ${g}: все боссы побеждаются`, !res.includes('fight') && (res.match(/won ★★★/g) || []).length === res.split(' | ').length, res);
}
await fetch(`${BASE}/test/teacher/0`); done();
