// Панель учителя в практикуме: видна только учителю, ведёт на пульт «Сбоя на станции» и в другие учительские разделы.
import {browser, BASE} from './lib.mjs';
const b = await browser(), open = async url => { await b.send('Page.navigate', {url}); await b.sleep(1500); };
await b.size(1280, 900);
await open(BASE + '/test/teacher/0'); await open(BASE + '/courses/game-8-practicum/'); await b.ev("await waitFor(()=>$('.p-login form'))"); await b.sleep(800);
b.check('ученик не видит панель учителя', await b.ev("return !document.querySelector('.p-tpanel')"));
await open(BASE + '/test/teacher/1'); await open(BASE + '/courses/game-8-practicum/#teacher'); await b.ev("await waitFor(()=>$('.p-tpanel'),8000)");
b.check('учитель видит панель: статистика, пульт, турнир, гонка, Кодоград, Глюк', await b.ev("return document.querySelectorAll('.p-tlink').length===6&&$('[data-act=crew-pult]').getAttribute('href')==='/courses/game-8-crew/#pult'"));
await b.shot('teacher-panel', 1280, 900, false);
await open(BASE + '/courses/game-8-crew/#pult-Б'); await b.ev("await waitFor(()=>document.querySelector('.cr-teacher'),8000)");
b.check('ссылка открывает пульт сразу на нужном классе', await b.ev("const s=[...document.querySelectorAll('.cr-teacher select')];return s.length>=2&&s[0].value==='8'&&s[1].value==='Б'"));
await open(BASE + '/test/teacher/0'); b.done();
