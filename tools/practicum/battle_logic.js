// «Битва класса»: чистые функции без DOM — разбор таблицы (CSV/Excel) в вопросы, «Повторение ошибок» по отчёту,
// выбор мини-игры привала. В браузере — window.BattleLogic, в node — require (тест: tools/practicum/tests/battle_logic.test.js).
(root => {
  'use strict';
  const norm = s => String(s).trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').replace(/^[ .,!?;:«»"']+|[ .,!?;:«»"']+$/g, '');
  const isNum = s => /^[-−]?\d+([.,]\d+)?(\/\d+)?$/.test(String(s).replace(/\s/g, ''));

  /* ---------- таблица из буфера обмена ---------- */
  // Разделитель — по первой строке вне кавычек: табуляция (вставка из Excel), затем «;» (русский Excel), затем «,».
  function detectDelim(text) {
    let q = false; const cnt = {'\t': 0, ';': 0, ',': 0};
    for (const ch of String(text)) { if (ch === '"') q = !q; else if (!q && ch === '\n') break; else if (!q && ch in cnt) cnt[ch]++; }
    return cnt['\t'] ? '\t' : cnt[';'] ? ';' : cnt[','] ? ',' : '\t';
  }
  // Строки таблицы: поля в кавычках могут содержать разделитель, перевод строки и "" (кавычку). Пустые строки пропускаются.
  function parseCSV(text, delim) {
    text = String(text || '').replace(/^﻿/, ''); delim = delim || detectDelim(text);
    const rows = []; let row = [], cell = '', q = false, quoted = false;
    const endCell = () => { row.push(quoted ? cell : cell.trim()); cell = ''; quoted = false; };
    const endRow = () => { endCell(); while (row.length && row[row.length - 1] === '') row.pop(); if (row.length) rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) { const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"' && !cell.trim()) { q = quoted = true; cell = ''; }
      else if (ch === delim) endCell();
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; endRow(); }
      else if (!(quoted && /\s/.test(ch))) cell += ch; }
    if (cell !== '' || row.length || quoted) endRow();
    return rows.map(r => r.map(c => c.trim()));
  }
  // Колонки: вопрос; правильный ответ (несколько — через «|»); неверные… Необязательные столбцы с заголовками «время» и «пояснение».
  // Нет неверных → ответ в поле (число → числовой ответ); несколько правильных → «несколько ответов»; иначе «один ответ».
  function csvQuestions(text, delim) {
    const rows = parseCSV(text, delim), out = [], warn = []; let col = {time: -1, explain: -1}, start = 0;
    const head = c => /^(вопрос|текст( вопроса)?|question)\S*$/i.test((c || '').trim());
    if (rows.length && (head(rows[0][0]) || /^(№|n|#)?$/i.test(rows[0][0] || '') && head(rows[0][1]))) {
      const hd = rows[0].map(x => x.toLowerCase()); col = {time: hd.findIndex(x => /^врем|^сек/.test(x)), explain: hd.findIndex(x => /пояснен|объяснен|комментар/.test(x))}; start = 1; }
    rows.slice(start).forEach((r, k) => { const n = k + start + 1, extra = new Set([col.time, col.explain]);
      let cells = r.map((c, i) => extra.has(i) ? null : c).filter(c => c != null);
      if (/^\d+[.)]?$/.test(cells[0] || '') && cells.length > 2) cells = cells.slice(1);   // первый столбец — номер вопроса
      const [qt = '', right = '', ...rest] = cells, text = qt.replace(/\s+/g, ' ').trim();
      if (!text) return warn.push(`Строка ${n}: нет текста вопроса — пропущена`);
      const good = [...new Set(right.split('|').map(x => x.trim()).filter(Boolean))], seen = new Set(good.map(norm));
      if (!good.length) return warn.push(`Строка ${n}: нет правильного ответа — пропущена`);
      const bad = rest.map(x => x.trim()).filter(x => x && !seen.has(norm(x)) && (seen.add(norm(x)), true));
      const q = {type: 'single', text: text.slice(0, 600), time: 20, weight: 1, explain: ''};
      if (text.length > 600) warn.push(`Строка ${n}: вопрос длиннее 600 знаков — обрезан`);
      if (!bad.length) { if (good.length === 1 && isNum(good[0])) Object.assign(q, {type: 'math', value: good[0].replace(/\s/g, '').replace('−', '-'), tol: 0, unit: '', time: 30});
        else Object.assign(q, {type: 'fill', accepted: good.slice(0, 10).map(x => x.slice(0, 80)), time: 30}); }
      else { const max = good.length > 1 ? 8 : 6, opts = [...good, ...bad].map(x => x.slice(0, 150));
        if (opts.length > max) warn.push(`Строка ${n}: вариантов больше ${max} — лишние неверные убраны`);
        if (good.length >= max) { warn.push(`Строка ${n}: слишком много правильных ответов — пропущена`); return; }
        q.options = opts.slice(0, max); if (good.length > 1) Object.assign(q, {type: 'multi', answers: good.map((_, i) => i), time: 30}); else q.answer = 0; }
      if (col.time >= 0 && r[col.time]) { const t = parseInt(r[col.time], 10); if (t >= 5 && t <= 300) q.time = t; else warn.push(`Строка ${n}: время от 5 до 300 секунд — оставлено ${q.time}`); }
      if (col.explain >= 0 && r[col.explain]) q.explain = r[col.explain].slice(0, 500);
      out.push(q); });
    if (out.length > 60) warn.push(`Вопросов ${out.length}, в викторине — до 60: взяты первые 60`);
    return {questions: out.slice(0, 60), warnings: warn};
  }

  /* ---------- «Повторение ошибок» по отчёту ---------- */
  const UNGRADED = new Set(['poll', 'cloud', 'draw', 'slide']), NEED_IMG = new Set(['label', 'hotspot']);
  // Результат ученика по вопросу: отметка учителя важнее автопроверки; берётся первая попытка — с неё видно, что не знали.
  const firstFrac = a => !a ? null : a.teacher != null ? (a.teacher ? 1 : 0) : a.tries && a.tries.length && a.tries[0].frac != null ? a.tries[0].frac : a.frac != null ? a.frac : null;
  // Вопросы отчёта, где ошибся хотя бы один ученик (доля ошибок ≥ min), самые трудные — первыми.
  // images — {id вопроса: картинка} из исходной викторины (в отчёте картинок нет); без картинки «подписи» и «области» пропускаются.
  function mistakes(result, opts = {}) {
    const qs = (result && result.quiz && result.quiz.questions) || [], ps = (result && result.players) || [], images = opts.images || {}, min = opts.min || 0;
    const stat = [], skipped = [];
    qs.forEach((q, i) => { if (UNGRADED.has(q.type)) return; const fr = ps.map(p => firstFrac((p.answers || {})[q.id])).filter(f => f != null);
      if (!fr.length) return; const wrong = fr.filter(f => f < 1).length, share = wrong / fr.length;
      if (!wrong || share < min) return;
      const c = JSON.parse(JSON.stringify(q)); delete c.hasImage;
      if (q.hasImage) { if (images[q.id]) c.image = images[q.id]; else if (NEED_IMG.has(q.type)) return skipped.push(i + 1); }
      stat.push({q: c, i, share, wrong, acc: Math.round(100 * fr.reduce((a, b) => a + b, 0) / fr.length)}); });
    stat.sort((a, b) => b.share - a.share || a.acc - b.acc || a.i - b.i);
    const title = ('Повторение ошибок: ' + ((result && result.quiz && result.quiz.title) || 'викторина')).slice(0, 100);
    return {title, questions: stat.slice(0, 60).map(s => s.q), stats: stat.slice(0, 60).map(s => ({n: s.i + 1, wrong: s.wrong, acc: s.acc})), skipped};
  }

  /* ---------- мини-игры привала ---------- */
  // Сервер выбирает из четырёх старых игр; клиент по зерну заменяет часть привалов на новые — так все семь выпадают поровну.
  // Если сервер начнёт присылать новые названия сам, они используются как есть.
  const MINI_OLD = ['bats', 'circles', 'gear', 'landslide'], MINI_NEW = ['bits', 'rope', 'trail'], MINIS = [...MINI_OLD, ...MINI_NEW];
  function pickMini(server, seed) {
    if (MINI_NEW.includes(server)) return server;
    const k = Math.abs(seed | 0) % MINIS.length;
    return k < MINI_OLD.length ? (MINI_OLD.includes(server) ? server : MINI_OLD[k]) : MINI_NEW[k - MINI_OLD.length];
  }
  // «Двоичный сейф»: число из включённых разрядов (старший слева).
  const bitsValue = bits => bits.reduce((v, b) => v * 2 + (b ? 1 : 0), 0);
  // «Верёвка»: попадание бегунка (0…1) в зону [c − w/2; c + w/2]; ближе к центру — больше очков (10…30).
  const ropeHit = (pos, c, w) => { const d = Math.abs(pos - c); return d > w / 2 ? 0 : Math.round(30 - 20 * d / (w / 2)); };
  // «Запомни тропу»: сколько первых шагов повторено верно.
  const trailOk = (seq, mine) => { let k = 0; while (k < mine.length && mine[k] === seq[k]) k++; return k; };
  const capMini = s => Math.max(0, Math.min(300, Math.round(s || 0)));

  const L = {norm, detectDelim, parseCSV, csvQuestions, mistakes, firstFrac, pickMini, MINIS, MINI_NEW, bitsValue, ropeHit, trailOk, capMini};
  if (typeof module === 'object' && module.exports) module.exports = L; else root.BattleLogic = L;
})(typeof window !== 'undefined' ? window : globalThis);
