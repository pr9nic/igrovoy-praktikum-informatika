// «Верстальщик»: форматирование текстовых документов (7 класс §3.1–3.6).
// Слева — образец, справа — тот же текст «как попало». Выбери абзац и задай ему оформление на панели, чтобы документ совпал с образцом.
// Звёзды: три — без лишних проверок; на каждой проверке подсвечиваются абзацы, которые ещё отличаются.
(() => {
  'use strict';
  const LAB = globalThis.LAB = globalThis.LAB || {games: [], register(g) { this.games.push(g); }};
  // Свойства абзаца: выравнивание, жирный, курсив, размер, вид (обычный / заголовок / маркированный / нумерованный), красная строка, отступ слева.
  const PROPS = {align: ['left', 'center', 'right', 'justify'], bold: [false, true], italic: [false, true], size: ['s', 'm', 'l'], kind: ['p', 'h', 'ul', 'ol'], indent: [false, true], margin: [0, 1]};
  const LABEL = {align: {left: '⯇ по левому краю', center: '☰ по центру', right: 'по правому краю ⯈', justify: '▤ по ширине'}, size: {s: 'мелкий', m: 'обычный', l: 'крупный'}, kind: {p: 'абзац', h: 'заголовок', ul: '• список', ol: '1. список'}};
  const USED = [['align'], ['align', 'bold'], ['align', 'bold', 'size'], ['align', 'bold', 'italic', 'size'], ['kind', 'align', 'bold'], ['kind', 'align', 'size', 'indent'], ['kind', 'align', 'bold', 'italic', 'size'], ['kind', 'align', 'bold', 'italic', 'size', 'indent'], ['kind', 'align', 'bold', 'italic', 'size', 'indent', 'margin'], ['kind', 'align', 'bold', 'italic', 'size', 'indent', 'margin']];
  const P = (text, o = {}) => ({text, align: 'left', bold: false, italic: false, size: 'm', kind: 'p', indent: false, margin: 0, ...o});
  const DOCS = [
    [P('Объявление', {align: 'center', size: 'l', kind: 'h', bold: true}), P('В пятницу в кабинете 17 пройдёт турнир по «Кодополии».', {align: 'center'}), P('Приходите командами по четыре человека.', {align: 'center'})],
    [P('Памятка', {align: 'center', bold: true, kind: 'h', size: 'l'}), P('Перед началом работы сохраните файл в своей папке.', {align: 'justify', indent: true}), P('Учитель информатики', {align: 'right', italic: true})],
    [P('Письмо другу', {align: 'center', size: 'l', bold: true, kind: 'h'}), P('Привет! Я научился делать таблицы и списки в текстовом редакторе.', {indent: true, align: 'justify'}), P('Покажу, когда встретимся.', {indent: true, align: 'justify'}), P('Твой друг Миша', {align: 'right', italic: true})],
    [P('Правила кабинета', {kind: 'h', align: 'center', bold: true, size: 'l'}), P('Не ешь у компьютера', {kind: 'ul'}), P('Сохраняй работу каждые 10 минут', {kind: 'ul'}), P('Выключай монитор после урока', {kind: 'ul'})],
    [P('Как создать документ', {kind: 'h', bold: true, size: 'l'}), P('Открой текстовый редактор', {kind: 'ol'}), P('Набери текст', {kind: 'ol'}), P('Отформатируй заголовки', {kind: 'ol'}), P('Сохрани файл под понятным именем', {kind: 'ol', bold: true})],
    [P('Доклад', {kind: 'h', align: 'center', size: 'l', bold: true}), P('Информация — это сведения об окружающем мире.', {indent: true, align: 'justify'}), P('Её можно хранить, передавать и обрабатывать.', {indent: true, align: 'justify'}), P('Пример: книга, фото, музыка.', {size: 's', italic: true})],
    [P('Меню школьной столовой', {kind: 'h', align: 'center', bold: true, size: 'l'}), P('Понедельник', {bold: true}), P('Суп, котлета, компот', {kind: 'ul', italic: true}), P('Вторник', {bold: true}), P('Плов, салат, чай', {kind: 'ul', italic: true})],
    [P('Инструкция по сохранению', {kind: 'h', bold: true, size: 'l', align: 'center'}), P('Нажмите «Файл».', {kind: 'ol'}), P('Выберите «Сохранить как».', {kind: 'ol'}), P('Укажите папку и имя.', {kind: 'ol'}), P('Важно: не используйте пробелы в начале имени!', {italic: true, bold: true, indent: true})],
    [P('Глава 1. Компьютер', {kind: 'h', bold: true, size: 'l'}), P('Компьютер обрабатывает данные по программе.', {indent: true, align: 'justify'}), P('Основные устройства:', {bold: true}), P('процессор', {kind: 'ul', margin: 1}), P('память', {kind: 'ul', margin: 1}), P('устройства ввода и вывода', {kind: 'ul', margin: 1})],
    [P('Приглашение', {kind: 'h', align: 'center', bold: true, size: 'l'}), P('Дорогие родители!', {align: 'center', italic: true}), P('Приглашаем вас на день открытых дверей кабинета информатики.', {indent: true, align: 'justify'}), P('Программа:', {bold: true}), P('выставка проектов', {kind: 'ul', margin: 1}), P('турнир классов', {kind: 'ul', margin: 1}), P('Ждём вас!', {align: 'right', bold: true, size: 'l'})],
  ];
  const TITLES = ['Объявление', 'Памятка', 'Письмо', 'Правила со списком', 'Пошаговая инструкция', 'Доклад', 'Меню', 'Инструкция с предупреждением', 'Глава учебника', 'Приглашение'];
  const LEVELS = DOCS.map((doc, i) => ({title: TITLES[i], doc, used: USED[i], brief: `Сделай документ как в образце. Здесь важно: ${USED[i].map(k => ({align: 'выравнивание', bold: 'жирный', italic: 'курсив', size: 'размер', kind: 'вид абзаца (заголовок, список)', indent: 'красная строка', margin: 'отступ слева'})[k]).join(', ')}.`}));
  // Испорченный документ: те же абзацы, свойства уровня — «по умолчанию».
  const start = lv => lv.doc.map(p => { const def = P(p.text), out = {...p}; for (const k of lv.used) out[k] = def[k]; return out; });   // сбиваются только свойства этого уровня
  const diff = (lv, mine) => lv.doc.map((p, i) => lv.used.filter(k => mine[i][k] !== p[k]));
  function check(lv, mine) {
    if (!Array.isArray(mine) || mine.length !== lv.doc.length) return {ok: false, msg: 'Документ не тот.'};
    const d = diff(lv, mine), bad = d.filter(x => x.length).length; return bad ? {ok: false, bad: d, msg: `Отличается абзацев: ${bad}. Они подсвечены.`} : {ok: true, stars: 3, msg: 'Документ совпадает с образцом.'};
  }
  const css = p => `text-align:${p.align};font-weight:${p.bold ? 800 : 400};font-style:${p.italic ? 'italic' : 'normal'};font-size:${p.kind === 'h' ? {s: 18, m: 22, l: 28}[p.size] : {s: 13, m: 16, l: 20}[p.size]}px;text-indent:${p.indent ? '2em' : '0'};margin-left:${p.margin ? 28 : 0}px`;
  function render(el, doc, sel, onPick, bad) {
    const page = el('div', 'lo-page');
    doc.forEach((p, i) => { const tag = p.kind === 'h' ? 'h3' : 'p', n = el(tag, 'lo-par' + (i === sel ? ' sel' : '') + (bad && bad[i] && bad[i].length ? ' bad' : '')); n.style.cssText = css(p);
      const bullet = p.kind === 'ul' ? '• ' : p.kind === 'ol' ? `${doc.slice(0, i + 1).filter(x => x.kind === 'ol').length}. ` : ''; n.textContent = bullet + p.text; if (onPick) n.addEventListener('click', () => onPick(i)); n.dataset.par = i; page.append(n); });
    return page;
  }
  function mount(host, lv, api) {
    const {el, button} = api, task = el('div', 'lab-task'), msg = el('p', 'lab-msg'), cols = el('div', 'lab-cols'), left = el('div', 'lab-panel'), right = el('div', 'lab-panel'), bar = el('div', 'lo-bar'); let mine = start(lv), sel = 0, bad = null, tries = 0;
    task.append(el('h2', '', lv.title), el('p', '', lv.brief));
    const draw = () => { left.replaceChildren(el('h3', '', 'Образец'), render(el, lv.doc, -1, null, null)); right.replaceChildren(el('h3', '', 'Твой документ — щёлкни абзац'), bar, render(el, mine, sel, i => { sel = i; draw(); }, bad), go, msg);
      bar.replaceChildren(); const p = mine[sel];
      for (const k of lv.used) { const g = el('div', 'lo-grp');
        if (k === 'bold' || k === 'italic' || k === 'indent' || k === 'margin') { const b = button({bold: 'Ж', italic: 'К', indent: '↦ красная строка', margin: '⇥ отступ'}[k], 'lo-btn' + (p[k] ? ' on' : '') + (k === 'bold' ? ' lo-b' : k === 'italic' ? ' lo-i' : ''), () => { p[k] = k === 'margin' ? (p[k] ? 0 : 1) : !p[k]; bad = null; draw(); }); b.dataset.prop = k; g.append(b); }
        else for (const v of PROPS[k]) { const b = button(LABEL[k][v], 'lo-btn' + (p[k] === v ? ' on' : ''), () => { p[k] = v; bad = null; draw(); }); b.dataset.prop = k + ':' + v; g.append(b); }
        bar.append(g); } };
    const go = button('Сравнить с образцом', 'lab-main', () => { tries++; const r = check(lv, mine); msg.textContent = r.msg; msg.className = 'lab-msg ' + (r.ok ? 'good' : 'bad'); if (r.ok) api.finish(tries === 1 ? 3 : tries <= 3 ? 2 : 1, r.msg); else { bad = r.bad; draw(); } }); go.dataset.act = 'run';
    cols.append(left, right); host.append(task, cols); draw();
    if (api.debugHost) window.labSet = d => { mine = d.map(x => ({...x})); draw(); };
  }
  LAB.register({id: 'layout', bg: 'bg_office', title: 'Верстальщик', genre: 'текстовые документы', art: '📝', color: '#ff9fb7', unit: 'Документ', minutes: 35,
    about: 'Документ «развалился»: заголовки, списки, выравнивание и шрифты перепутаны. Выбирай абзацы и форматируй их, пока документ не совпадёт с образцом.',
    levels: () => LEVELS, mount, check, solve: lv => lv.doc.map(p => ({...p})), LEVELS});
})();
