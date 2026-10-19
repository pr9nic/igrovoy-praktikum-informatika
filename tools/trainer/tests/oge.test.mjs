// «ОГЭ-арена»: каждое из 12 заданий проходится через саму мини-игру, как это делает ученик (щелчки, разрезы, маршрут, сундуки…).
// Запуск: python tools/publish.py drafts/game-9-lab.json && bash tools/trainer/tests/start.sh && node tools/trainer/tests/oge.test.mjs
import {browser, BASE} from './lib.mjs';
const b = await browser();
await b.size(1440, 900); await b.send('Page.navigate', {url: BASE + '/courses/game-9-lab/?play=oge'}); await b.sleep(800); await b.ev('localStorage.clear()'); await b.send('Page.reload'); await b.ev('await waitFor(()=>window.labGo,20000)');
// Помощник в странице: «сыграть» текущий вариант правильно — только через кнопки и поля мини-игры.
await b.ev(`window.ogePlay = async n => {
  const p = window.ogeNow, q = s => [...document.querySelectorAll(s)], tap = e => e.dispatchEvent(new MouseEvent('click', {bubbles: true})), run = () => document.querySelector('.og-play [data-act=run]').click(), type = (inp, v) => { inp.value = v; inp.dispatchEvent(new Event('input', {bubbles: true})); };
  if (n === 1) q('.og-word').find(x => x.textContent === p.answer).click();
  if (n === 2) { let pos = 0; for (const c of p.answer) { pos += p.data.codes[p.data.letters.indexOf(c)].length; if (pos < p.data.bits.length) q('.og-bit')[pos - 1].click(); } }
  if (n === 3) { let x = p.data.what === 'двузначное число' ? 10 : 0; const btn = t => q('.og-dialrow button').find(b => b.textContent === t); while (p.answer - x >= 10) { btn('+10').click(); x += 10; } while (x - p.answer >= 10) { btn('−10').click(); x -= 10; } while (x < p.answer) { btn('+1').click(); x++; } while (x > p.answer) { btn('−1').click(); x--; } }
  if (n === 4) { const w = p.data.w, m = w.length, d = Array(m).fill(1e9), prev = Array(m).fill(-1), used = Array(m).fill(false); d[0] = 0; for (let it = 0; it < m; it++) { let u = -1; for (let i = 0; i < m; i++) if (!used[i] && (u < 0 || d[i] < d[u])) u = i; used[u] = true; for (let v = 0; v < m; v++) if (w[u][v] && d[u] + w[u][v] < d[v]) { d[v] = d[u] + w[u][v]; prev[v] = u; } }
    const path = []; for (let v = m - 1; v > 0; v = prev[v]) path.unshift(v); for (const v of path) tap(q('.og-node')[v]); }
  if (n === 5) { for (let i = 2; i < p.answer; i++) q('.og-dialrow button').find(b => b.textContent === '+').click(); }
  if (n === 6) q('.og-card').forEach((c, k) => { const yes = p.data.yes[k]; c = q('.og-card')[k]; c.click(); if (!yes) q('.og-card')[k].click(); });
  if (n === 7) for (const L of p.answer) q('.og-tile').find(t => t.textContent.startsWith(L + ')')).click();
  if (n === 8) type(document.querySelector('.og-play .og-form input'), String(p.answer));
  if (n === 9) type(q('.og-count input').pop(), String(p.answer));
  if (n === 10) { const k = p.data.v.indexOf(p.answer); q('.og-chest')[k].click(); type(document.querySelector('.og-play .og-form input'), String(p.answer)); }
  if (n === 11) q('.og-hw[data-hit="1"]').forEach(x => x.click());
  if (n === 12) q('.og-file[data-hit="1"]').forEach(x => x.click());
  await new Promise(r => setTimeout(r, 60)); run(); await new Promise(r => setTimeout(r, 60));
  const good = /Щит сбит/.test(document.querySelector('.og-box .lab-msg').textContent); document.querySelector('[data-act=next-q]').click(); return good; }`);
for (let n = 1; n <= 12; n++) {
  await b.ev(`window.labDone=null;labGo('oge',${n})`); await b.sleep(250);
  const res = []; for (let k = 0; k < 3; k++) res.push(await b.ev(`return await ogePlay(${n})`));
  const d = await b.ev('await waitFor(()=>window.labDone,5000).catch(()=>{});return window.labDone');
  if (n === 2 || n === 4 || n === 6 || n === 12) { await b.ev(`labGo('oge',${n})`); await b.sleep(300); await b.shot('oge-' + n, 1440, 900, false); }
  b.check(`задание ${n}: три варианта пройдены через мини-игру, три звезды`, res.every(Boolean) && d?.stars === 3, JSON.stringify(res) + ' ' + JSON.stringify(d));
}
// Задания 15 и 16 (уровни 13 и 14): программу вводят в редактор, пробный запуск, затем проверка на трёх полях / тестах.
for (const [lvl, n] of [[13, 15], [14, 16]]) {
  await b.ev(`window.labDone=null;labGo('oge',${lvl})`); await b.sleep(300);
  await b.ev("const s=labNow.solve();labSet({seed:s.seed,code:labNow.level.n===15?'закрасить':'print(0)'});document.querySelector('[data-act=run]').click()");
  b.check(`задание ${n}: неверная программа — щиты устояли, по каждому ${n === 15 ? 'полю' : 'тесту'} показана причина`, await b.ev("return document.querySelectorAll('.og-results p.bad').length===3&&document.querySelectorAll('.og-shields i.held').length===3"));
  await b.ev("const s=labNow.solve();labSet(s);document.querySelector('.og-ed').value=s.code;[...document.querySelectorAll('.og-box button')].find(x=>/Запустить на этом поле|Пробный запуск/.test(x.textContent)).click()"); await b.sleep(n === 15 ? 2500 : 300);
  await b.shot('oge-' + n, 1440, 900, false);
  await b.ev("document.querySelector('[data-act=run]').click()"); const d = await b.ev('await waitFor(()=>window.labDone,5000).catch(()=>{});return window.labDone');
  b.check(`задание ${n}: верная программа проходит все три проверки`, d?.stars === 3, JSON.stringify(d));
}
// Ошибка тоже работает: неверный выбор оставляет щит и показывает разбор с правильным ответом.
await b.ev("labGo('oge',1)"); await b.sleep(250);
await b.ev("const p=window.ogeNow;[...document.querySelectorAll('.og-word')].find(x=>x.textContent!==p.answer).click();document.querySelector('.og-play [data-act=run]').click()");
b.check('неверный ответ: щит устоял, показан правильный ответ и подсказка', await b.ev("return /Щит устоял. Правильный ответ/.test(document.querySelector('.og-box .lab-msg').textContent)&&!!document.querySelector('.og-shields i.held')"));
// Пробный ОГЭ: 12 заданий одним бланком, таймер, итог с баллами и прогнозом.
await b.send('Page.navigate', {url: BASE + '/courses/game-9-lab/?play=oge'}); await b.ev('await waitFor(()=>document.querySelector("[data-act=mock]"),20000)');
await b.ev("document.querySelector('[data-act=mock]').click();await waitFor(()=>window.ogeMock)"); b.check('пробник: 12 заданий на одной странице и таймер', await b.ev("return document.querySelectorAll('.og-mq').length===12&&/\\d+:\\d\\d/.test(document.querySelector('.og-timer').textContent)"));
await b.shot('oge-mock', 1440, 900, false); await b.ev('ogeMock.fill();ogeMock.finish()');
b.check('пробник: все верно — 12 из 12 и прогноз «5»', await b.ev('return window.ogeMockResult.score===12&&window.ogeMockResult.mark===5'));
b.done();
