// Проверка чистой логики «Битвы класса» без браузера: node tools/practicum/tests/battle_logic.test.js
// Разбор таблицы из буфера (кавычки, «;», табуляция, «,»), импорт вопросов, «Повторение ошибок» по отчёту, выбор мини-игр.
const path = require('path'), L = require(path.join(__dirname, '..', 'battle_logic.js'));
let bad = 0; const check = (name, ok, info = '') => { if (!ok) bad++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok || info === '' ? '' : ' — ' + info)); };
const J = JSON.stringify, eq = (a, b) => J(a) === J(b);

// --- разделители и кавычки ---
check('разделитель: табуляция (вставка из Excel)', L.detectDelim('a\tb;c\nd') === '\t');
check('разделитель: «;» (русский Excel)', L.detectDelim('a;b,c\n') === ';');
check('разделитель: «,»', L.detectDelim('a,b,c') === ',');
check('разделитель внутри кавычек не считается', L.detectDelim('"a;b",c,d') === ',');
check('простая таблица через «;»', eq(L.parseCSV('Вопрос;Да;Нет\r\nДва;1;2\r\n'), [['Вопрос', 'Да', 'Нет'], ['Два', '1', '2']]));
check('табуляция, пустые строки пропускаются', eq(L.parseCSV('a\tb\n\n\nc\td\n'), [['a', 'b'], ['c', 'd']]));
check('кавычки: разделитель, перевод строки и "" внутри поля', eq(L.parseCSV('"Что такое ""бит""; и байт?";"строка 1\nстрока 2";x'), [['Что такое "бит"; и байт?', 'строка 1\nстрока 2', 'x']]), J(L.parseCSV('"Что такое ""бит""; и байт?";"строка 1\nстрока 2";x')));
check('кавычки с табуляцией и пробелами вокруг', eq(L.parseCSV(' "a\tb" \t c \t"d"'), [['a\tb', 'c', 'd']]));
check('BOM в начале и хвостовые пустые ячейки', eq(L.parseCSV('﻿a;b;;\n'), [['a', 'b']]));
check('пустые ячейки в середине сохраняются', eq(L.parseCSV('a;;c'), [['a', '', 'c']]));
check('явный разделитель важнее автоопределения', eq(L.parseCSV('a,b;c', ';'), [['a,b', 'c']]));
check('последняя строка без перевода строки', eq(L.parseCSV('a;b\nc;"d"'), [['a', 'b'], ['c', 'd']]));

// --- вопросы из таблицы ---
{ const r = L.csvQuestions('Вопрос;Правильный;Неверный 1;Неверный 2\nСколько бит в байте?;8;16;10\nСтолица России;Москва\nВыбери устройства ввода;клавиатура|мышь;принтер;монитор\n2^10 = ?;1024\n');
  const [a, b, c, d] = r.questions;
  check('заголовок пропущен, 4 вопроса', r.questions.length === 4 && !r.warnings.length, J(r));
  check('один ответ: верный первым', a.type === 'single' && eq(a.options, ['8', '16', '10']) && a.answer === 0 && a.text === 'Сколько бит в байте?');
  check('без неверных — ответ в поле', b.type === 'fill' && eq(b.accepted, ['Москва']));
  check('несколько верных через «|» — «несколько ответов»', c.type === 'multi' && eq(c.options, ['клавиатура', 'мышь', 'принтер', 'монитор']) && eq(c.answers, [0, 1]));
  check('число без неверных — числовой ответ', d.type === 'math' && d.value === '1024'); }
{ const r = L.csvQuestions('Сколько бит в байте?\t8\t16\t10\n"Что выведет print(""a;b"")?"\ta;b\tab\t"a b"\n');
  check('Excel без заголовка: табуляция, кавычки внутри вопроса', r.questions.length === 2 && r.questions[1].text === 'Что выведет print("a;b")?' && eq(r.questions[1].options, ['a;b', 'ab', 'a b']), J(r.questions)); }
{ const r = L.csvQuestions('Сколько бит в байте?,8,16,10\n3,5 + 1 = ?;4,5\n');
  check('запятая как разделитель', r.questions[0].type === 'single' && r.questions[0].options.length === 3); }
{ const r = L.csvQuestions('№;Вопрос;Ответ;Неверный;Время;Пояснение\n1;Сколько бит в байте?;8;16;15;Байт — 8 бит\n2;Половина;1/2;;400;\n');
  const [a, b] = r.questions;
  check('столбцы «№», «Время», «Пояснение»', a.time === 15 && a.explain === 'Байт — 8 бит' && eq(a.options, ['8', '16']), J(a));
  check('дробь — числовой ответ, негодное время — предупреждение', b.type === 'math' && b.value === '1/2' && b.time === 30 && r.warnings.some(w => /Строка 3: время/.test(w)), J(r)); }
{ const r = L.csvQuestions(';Москва\nВопрос без ответа;\nДубли;8;8;8 ;16\nМного;1;2;3;4;5;6;7;8\n');
  check('пустой вопрос и вопрос без ответа пропускаются с предупреждением', r.questions.length === 2 && r.warnings.filter(w => /пропущена/.test(w)).length === 2, J(r));
  check('повторы вариантов убраны', eq(r.questions[0].options, ['8', '16']));
  check('больше 6 вариантов — обрезано до 6', r.questions[1].options.length === 6 && r.warnings.some(w => /больше 6/.test(w))); }
check('пустой текст — ни одного вопроса', L.csvQuestions('  \n\n').questions.length === 0);

// --- «Повторение ошибок» ---
{ const res = {quiz: {title: 'Кодирование', questions: [
    {id: 'q1', type: 'single', text: 'Бит?', options: ['0/1', '8'], answer: 0}, {id: 'q2', type: 'fill', text: 'Столица', accepted: ['Москва']},
    {id: 'q3', type: 'poll', text: 'Нравится?', options: ['да', 'нет']}, {id: 'q4', type: 'hotspot', text: 'Где процессор?', hasImage: true, spots: [{x: 1, y: 1, r: 5}]},
    {id: 'q5', type: 'math', text: '2+2', value: '4', hasImage: true}, {id: 'q6', type: 'open', text: 'Зачем ОЗУ?'}, {id: 'q7', type: 'single', text: 'Не отвечали', options: ['a', 'b'], answer: 0}]},
    players: [
      {name: 'А', answers: {q1: {frac: 1, tries: [{frac: 0}, {frac: 1}]}, q2: {frac: 1, tries: [{frac: 1}]}, q3: {frac: null, tries: [{frac: null}]}, q4: {frac: 0, tries: [{frac: 0}]}, q5: {frac: 0, tries: [{frac: 0}]}, q6: {frac: null, teacher: false, tries: [{frac: null}]}}},
      {name: 'Б', answers: {q1: {frac: 0, tries: [{frac: 0}]}, q2: {frac: 0, tries: [{frac: 0}]}, q4: {frac: 1, tries: [{frac: 1}]}, q5: {frac: 1, tries: [{frac: 1}]}, q6: {frac: null, teacher: true, tries: [{frac: null}]}}}]};
  const m = L.mistakes(res);
  check('повторение: вопросы с ошибками, трудные первыми', eq(m.questions.map(q => q.id), ['q1', 'q2', 'q5', 'q6']), J(m.stats));
  check('повторение: ошибка с первой попытки считается, даже если потом исправил', m.stats[0].n === 1 && m.stats[0].wrong === 2 && m.stats[0].acc === 0);
  check('повторение: опросы, непроверенные и без ответов — не берутся', !m.questions.some(q => ['q3', 'q7'].includes(q.id)));
  check('повторение: «область на картинке» без картинки пропущена и названа', eq(m.skipped, [4]));
  check('повторение: признак hasImage убран, название с префиксом', !m.questions.some(q => 'hasImage' in q) && m.title === 'Повторение ошибок: Кодирование');
  const m2 = L.mistakes(res, {images: {q4: 'data:image/webp;base64,AAAA', q5: 'data:image/png;base64,BBBB'}});
  check('повторение: картинки из исходной викторины возвращаются', m2.questions.find(q => q.id === 'q4').image.startsWith('data:image/webp') && m2.questions.find(q => q.id === 'q5').image.startsWith('data:image/png') && !m2.skipped.length);
  const m3 = L.mistakes(res, {min: 0.75});
  check('повторение: порог доли ошибок', eq(m3.questions.map(q => q.id), ['q1']), J(m3.stats));
  check('повторение: исходный отчёт не меняется', !('image' in res.quiz.questions[3]) && res.quiz.questions[4].hasImage === true);
  check('повторение: пустой отчёт', L.mistakes({}).questions.length === 0 && L.mistakes(null).questions.length === 0); }

// --- мини-игры ---
{ const got = {}; for (const s of ['bats', 'circles', 'gear', 'landslide']) for (let seed = 0; seed < 700; seed++) { const k = L.pickMini(s, seed); got[k] = (got[k] || 0) + 1; }
  check('привалы: выпадают все 7 мини-игр', Object.keys(got).length === 7 && L.MINIS.every(k => got[k] > 0), J(got));
  check('привалы: новые игры примерно поровну со старыми', L.MINI_NEW.every(k => got[k] === 400), J(got));
  check('привалы: старое название от сервера остаётся, если зерно не выбрало новую игру', L.pickMini('gear', 0) === 'gear' && L.pickMini('gear', 3) === 'gear' && L.pickMini('gear', 4) === 'bits');
  check('привалы: новое название от сервера используется как есть', L.pickMini('rope', 0) === 'rope' && L.pickMini('trail', 5) === 'trail');
  check('привалы: неизвестное название — запасная игра из списка', L.MINIS.includes(L.pickMini('zzz', 2)) && L.MINIS.includes(L.pickMini(undefined, -9))); }
check('двоичный сейф: 10110 = 22, 11111111 = 255', L.bitsValue([1, 0, 1, 1, 0]) === 22 && L.bitsValue([1, 1, 1, 1, 1, 1, 1, 1]) === 255 && L.bitsValue([]) === 0);
check('верёвка: центр — 30, край зоны — 10, мимо — 0', L.ropeHit(0.5, 0.5, 0.2) === 30 && L.ropeHit(0.6, 0.5, 0.2) === 10 && L.ropeHit(0.61, 0.5, 0.2) === 0);
check('тропа: считается верное начало', L.trailOk([1, 2, 3], [1, 2]) === 2 && L.trailOk([1, 2, 3], [2]) === 0 && L.trailOk([1, 2, 3], [1, 2, 3]) === 3);
check('очки мини-игры: от 0 до 300', L.capMini(999) === 300 && L.capMini(-5) === 0 && L.capMini(12.6) === 13 && L.capMini() === 0);

console.log(bad ? `FAILED ${bad}` : 'ALL OK'); process.exit(bad ? 1 : 0);
