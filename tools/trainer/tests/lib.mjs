// Мини-клиент Chrome DevTools для тестов тренажёра.
import fs from 'node:fs';
export const BASE = 'http://127.0.0.1:18720';
export async function browser(opts = {}) {
  const CDP = process.env.CDP || 'http://127.0.0.1:9333';
  let target;
  if (opts.newWindow) {   // отдельное окно: вкладка на заднем плане не рисует кадры, а сетевым играм нужны два «живых» экрана
    const ver = await (await fetch(CDP + '/json/version')).json(), bws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => bws.onopen = r);
    const id = await new Promise(r => { bws.onmessage = m => { const d = JSON.parse(m.data); if (d.id === 1) r(d.result.targetId); }; bws.send(JSON.stringify({id: 1, method: 'Target.createTarget', params: {url: 'about:blank', newWindow: true}})); });
    bws.close(); target = {webSocketDebuggerUrl: ver.webSocketDebuggerUrl.replace(/browser\/.*/, 'page/' + id)};
  } else target = await (await fetch(CDP + '/json/new?about:blank', {method: 'PUT'})).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let seq = 0; const waiting = new Map(), errors = [], consoleErrors = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') consoleErrors.push(d.params.args.map(x => x.value ?? x.description ?? '').join(' ')); else if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); };
  const send = (method, params = {}) => new Promise(r => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({id, method, params})); });
  const ev = async expr => { const r = await send('Runtime.evaluate', {expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval error'); return r.result.result.value; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const size = (w, h) => send('Emulation.setDeviceMetricsOverride', {width: w, height: h, deviceScaleFactor: 1, mobile: w < 500, screenWidth: w, screenHeight: h + 200});
  const shot = async (name, w = 1440, h = 900, fullPage = true) => { await size(w, h); await sleep(250); const r = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: fullPage}); fs.mkdirSync(new URL('./.tmp/shots/', import.meta.url), {recursive: true}); fs.writeFileSync(new URL(`./.tmp/shots/${name}.png`, import.meta.url), Buffer.from(r.result.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {source: `window.confirm=()=>true;window.$=s=>document.querySelector(s);window.sleep=ms=>new Promise(r=>setTimeout(r,ms));window.waitFor=async(f,ms=15000)=>{const t=Date.now();while(Date.now()-t<ms){const v=f();if(v)return v;await sleep(30)}throw new Error('timeout '+f)};`});
  let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? ' — ' + info : '')); };
  const done = () => { check('ошибок JS нет', !errors.length, errors.join(' | ')); console.log(bad ? `FAILED ${bad}` : 'ALL OK'); ws.close(); process.exit(bad ? 1 : 0); };
  return {send, ev, sleep, size, shot, check, done, consoleErrors, ws};
}
