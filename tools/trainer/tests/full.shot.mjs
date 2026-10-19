// Снимок игры в полноэкранном режиме 1920×1080 (экран = окно, как при F11).
import {browser, BASE} from './lib.mjs';
const {send, ev, sleep, shot, done} = await browser();
await fetch(`${BASE}/test/teacher/1`); await send('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, screenWidth: 1920, screenHeight: 1080});
const u = `${BASE}/courses/trainer-8-glitch/`; await send('Page.navigate', {url: u}); await sleep(900);
await ev(`await waitFor(()=>$('.t-login')||$('.t-stage'));if($('.t-login')){$('[data-field=name]').value='Экран Полный';$('.t-login').requestSubmit();}await waitFor(()=>$('.t-stage'))`);
const K = `const key=(k,type='keydown')=>document.body.dispatchEvent(new KeyboardEvent(type,{key:k,bubbles:true,cancelable:true}));const R=()=>School4Run;const skip=async()=>{for(let n=0;n<8&&R().talking();n++){key('Enter');await sleep(50)}};`;
console.log(await ev(K + `await skip();await sleep(300);return document.querySelector('#trainer').classList.contains('full')+' '+JSON.stringify($('.t-stage').getBoundingClientRect())`));
const cap = async name => { const r = await send('Page.captureScreenshot', {format: 'png'}); (await import('node:fs')).writeFileSync(new URL(`./.tmp/shots/${name}.png`, import.meta.url), Buffer.from(r.result.data, 'base64')); };
await cap('full-street');
await ev(K + `R().enter(2);await waitFor(()=>['stage','perk'].includes(R().state()));await skip();if(R().state()==='stage')R().toPerk();await sleep(200);R().takePerk(0);await skip();await waitFor(()=>R().state()==='fight'&&R().targets.length,8000);await sleep(2600)`); await cap('full-fight');
await fetch(`${BASE}/test/teacher/0`); done();
