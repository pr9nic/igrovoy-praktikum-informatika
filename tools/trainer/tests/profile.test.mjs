// Профиль ученика в практикуме: инфографика для ученика («Мой профиль») и для учителя (имя в таблице класса).
// Демо-класс с вымышленными учениками создаётся на изолированном стенде. Запуск: start.sh && node tools/trainer/tests/profile.test.mjs
import {browser, BASE} from './lib.mjs';
const post = (p, body) => fetch(BASE + '/results/api/' + p, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}).then(r => r.json());
const me = q => fetch(BASE + '/results/api/practicum/me?' + new URLSearchParams(q)).then(r => r.json());
const slug = 'trainer-8-practicum', cls = '8 «Б»';
const lv = (id, n, st) => Object.fromEntries(Array.from({length: n}, (_, i) => [`${id}-${i + 1}`, {stars: typeof st === 'function' ? st(i) : st, detail: '', plays: 1, clean: true}]));
const people = [['Лисицына Алиса', {...lv('code', 12, 3), ...lv('bits', 10, 3), ...lv('cells', 5, 2), ...lv('oge', 8, i => i % 3 ? 3 : 2), ...lv('logic', 8, 3), ...lv('shop', 9, i => 3 - (i % 2)), ...lv('sets', 6, 3), ...lv('merge', 4, 2)}],
  ['Котов Тимур', {...lv('code', 8, 3), ...lv('bits', 6, 2), ...lv('gates', 7, 3)}], ['Звёздная Вика', {...lv('oge', 6, 3), ...lv('sets', 8, 2), ...lv('bytes', 5, 3)}]];
for (const [name, levels] of people) { const q = {slug, className: cls, name}; await me(q); await post('trainer/progress', {...q, levels}); await me(q); }
const b = await browser(); await b.size(1440, 900); await fetch(BASE + '/test/teacher/0');
await b.send('Page.navigate', {url: BASE + '/courses/game-8-practicum/'}); await b.ev("await waitFor(()=>$('.p-login form'))");
await b.ev(`$('.p-login select').value='${cls}';$('.p-login select').dispatchEvent(new Event('change'));$('[data-field=name]').value='Лисицына Алиса';$('.p-login form').requestSubmit();await waitFor(()=>$('[data-act=profile]'),15000)`);
await b.ev("document.querySelector('.p-toast')?.remove()");
b.check('на странице практикума: разминка, сезон и турнир классов', await b.ev("return !!$('.p-warm')&&!!$('.p-season')&&!!$('.p-tour')&&document.querySelectorAll('.p-trow').length>=1"), await b.ev("return ($('.p-extras2')||{}).textContent?.slice(0,300)"));
await b.shot('practicum-extras2', 1440, 900, false);
const wb = await b.ev("return document.querySelector('[data-warmup]')?.dataset.warmup||''");
if (wb) { await b.ev("document.querySelector('[data-warmup]').click()"); await b.sleep(800); b.check('разминка открывает игру сразу на нужном этапе', await b.ev("const f=document.querySelector('.p-player iframe');return !!f&&(/level=\\d+/.test(f.src)||/play=/.test(f.src)||/game=arcade/.test(f.src))"), await b.ev("return document.querySelector('.p-player iframe')?.src")); await b.ev("document.querySelector('[data-act=close]').click();await waitFor(()=>$('.p-grid'))"); }
await b.ev("$('[data-act=profile]').click();await waitFor(()=>$('.pf-radar'),5000)"); await b.sleep(2600);
b.check('«Мой профиль»: имя, ранг, 170 звёзд, 9 значков из 12, место в лиге', await b.ev("const t=$('.pf').textContent;return ($('.pf-ava').textContent==='АЛ'||!!$('.pf-ava img'))&&/Лисицына Алиса/.test(t)&&/Инженер/.test(t)&&[...document.querySelectorAll('.pf-num')].map(x=>x.textContent).join()==='170,62,46,8'&&document.querySelectorAll('.pf-brow img.got').length===9&&/Твоё место: 1 из 3/.test(t)"), await b.ev("return [...document.querySelectorAll('.pf-num')].map(x=>x.textContent).join()+' '+document.querySelectorAll('.pf-brow img.got').length"));
b.check('навыки по темам, неделя из 7 дней и готовность к отметке по играм', await b.ev("return document.querySelectorAll('.pf-lbl').length>=5&&document.querySelectorAll('.pf-day').length===7&&document.querySelectorAll('.pf-grow').length===8&&/«5»/.test($('.pf-games').textContent)"));
await b.shot('profile-student', 1440, 900, true);
await b.ev("$('[data-act=avatar]').click();await waitFor(()=>$('.pf-avgrid'),3000)"); await b.shot('profile-avatars', 1440, 900, false);
b.check('выбор аватара: 12 аватаров, дорогие закрыты замком', await b.ev("return document.querySelectorAll('.pf-av').length===12&&document.querySelectorAll('.pf-av.locked').length>=1&&document.querySelectorAll('.pf-av.locked').length<12"));
await b.ev("[...document.querySelectorAll('.pf-av')].filter(x=>!x.classList.contains('locked')).pop().click()"); await b.sleep(1500);
b.check('выбранный аватар показан в профиле', await b.ev("return !!document.querySelector('.pf-ava.pic img')&&!document.querySelector('.pf-modal')"));
b.check('есть кнопка «Отчёт для родителей»', await b.ev("return !!$('[data-act=print]')"));
await b.size(390, 844); await b.sleep(400); b.check('профиль на телефоне без горизонтальной прокрутки', await b.ev('return document.documentElement.scrollWidth<=innerWidth')); await b.shot('profile-mobile', 390, 844, true); await b.size(1440, 900);
await b.ev("$('.pf-top button').click();await waitFor(()=>$('.p-grid'),5000)"); b.check('кнопка «К играм» возвращает к списку', await b.ev("return !!$('.p-grid')"));
// Учитель: таблица класса → профиль ученика
await fetch(BASE + '/test/teacher/1'); await b.ev("window.confirm=()=>true;$('.p-me button:last-child').click()"); await b.sleep(600);
await b.send('Page.navigate', {url: 'about:blank'}); await b.send('Page.navigate', {url: BASE + '/courses/game-8-practicum/#teacher'}); await b.ev("await waitFor(()=>$('[data-act=teacher]'),15000)");
await b.ev(`$('[data-act=teacher]').click();await waitFor(()=>$('.p-teacher select'),5000);const s=$('.p-teacher select');s.value='${cls}';s.dispatchEvent(new Event('change'));await waitFor(()=>document.querySelector('[data-profile]'),8000)`);
b.check('учителю: тепловая карта по темам', await b.ev("return !!$('.p-heat')&&document.querySelectorAll('.p-heat td.hc').length>=3"));
await b.shot('teacher-heat', 1440, 900, true);
await b.ev("document.querySelector('[data-profile=\"Котов Тимур\"]').click();await waitFor(()=>$('.pf-radar')||$('.pf-skills'),8000)"); await b.sleep(1800);
b.check('учитель открывает профиль ученика из таблицы класса', await b.ev("const t=$('.pf').textContent;return /Котов Тимур/.test(t)&&/УЧИТЕЛЮ · ПРОФИЛЬ УЧЕНИКА/.test(t)&&/Место: 2 из 3/.test(t)"), await b.ev("return $('.pf')?.textContent.slice(0,200)"));
await b.shot('profile-teacher', 1440, 900, false);
await b.ev("$('.pf-top button').click();await waitFor(()=>$('.p-table'),8000)"); b.check('из профиля учитель возвращается к таблице класса', await b.ev("return !!$('.p-table')"));
await fetch(BASE + '/test/teacher/0'); b.done();
