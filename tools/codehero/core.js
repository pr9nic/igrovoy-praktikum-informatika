// «Кодоград: Герой кода» — ядро без графики: интерпретатор учебного подмножества Python и мир подземелья.
// Работает и в браузере (window.CodeHero), и в Node (module.exports) — на нём идут автотесты уровней.
(function (root) {
  'use strict';

  class PyError extends Error { constructor(message, line) { super(message); this.line = line || 0; } }

  /* ====================== разбор текста программы ====================== */

  const TOKEN = /[ \t]+|#.*|\d+(?:\.\d+)?|[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё_0-9]*|"[^"\n]*"|'[^'\n]*'|==|!=|<=|>=|\+=|-=|\*=|\/\/=|\/=|%=|\/\/|[-+*\/%()<>=\[\],.:]/y;
  const KEYWORDS = new Set(['if', 'elif', 'else', 'while', 'for', 'in', 'def', 'return', 'break', 'continue', 'pass', 'and', 'or', 'not', 'is', 'True', 'False', 'None']);

  function tokenize(source) {
    const lines = [];
    String(source).replace(/\r/g, '').split('\n').forEach((raw, index) => {
      const n = index + 1, text = raw.replace(/\t/g, '    ');
      if (!text.trim() || text.trim().startsWith('#')) return;
      const indent = text.length - text.trimStart().length, tokens = [];
      TOKEN.lastIndex = indent;
      while (TOKEN.lastIndex < text.length) {
        const at = TOKEN.lastIndex, m = TOKEN.exec(text);
        if (!m) {
          const ch = text[at];
          if (ch === '"' || ch === "'") throw new PyError('Строка не закрыта кавычкой. Текст пишется в кавычках с двух сторон: "вот так".', n);
          if ('{};'.includes(ch)) throw new PyError(`Символ «${ch}» в Python здесь не нужен. Команды пишутся по одной на строке, блоки выделяются отступом.`, n);
          throw new PyError(`Непонятный символ «${ch}».`, n);
        }
        const v = m[0];
        if (/^[ \t]/.test(v) || v[0] === '#') continue;
        if (/^\d/.test(v)) tokens.push({t: 'num', v: Number(v)});
        else if (v[0] === '"' || v[0] === "'") tokens.push({t: 'str', v: v.slice(1, -1)});
        else if (/^[A-Za-zА-Яа-яЁё_]/.test(v)) tokens.push({t: KEYWORDS.has(v) ? 'kw' : 'name', v});
        else tokens.push({t: 'op', v});
      }
      if (tokens.length) lines.push({n, indent, tokens});
    });
    return lines;
  }

  function parse(source) {
    const lines = tokenize(source);
    let li = 0;

    function expression(tokens, line) {
      let p = 0;
      const peek = () => tokens[p], is = v => tokens[p] && tokens[p].v === v && tokens[p].t !== 'str';
      const need = (v, why) => { if (!is(v)) throw new PyError(why || `Здесь ожидается «${v}».`, line); p++; };
      function or() { let a = and(); while (is('or')) { p++; a = {k: 'or', a, b: and(), line}; } return a; }
      function and() { let a = not(); while (is('and')) { p++; a = {k: 'and', a, b: not(), line}; } return a; }
      function not() { if (is('not')) { p++; return {k: 'not', a: not(), line}; } return compare(); }
      function compare() {
        // Цепочка сравнений a < b <= c, как в Python: попарно, средний операнд вычисляется один раз.
        const items = [sum()], ops = [];
        for (;;) {
          let op = peek() && peek().t !== 'str' && ['==', '!=', '<', '>', '<=', '>=', 'in', 'is'].includes(peek().v) ? tokens[p++].v : null;
          if (!op && is('not') && tokens[p + 1] && tokens[p + 1].t === 'kw' && tokens[p + 1].v === 'in') { p += 2; op = 'not in'; }
          if (!op) break;
          if (op === 'is' && is('not')) { p++; op = 'is not'; }
          ops.push(op); items.push(sum());
        }
        if (is('=')) throw new PyError('Для сравнения нужны два знака равенства: ==. Один знак = — это присваивание.', line);
        return ops.length ? {k: 'cmp', ops, items, line} : items[0];
      }
      function sum() { let a = product(); while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) { const op = tokens[p++].v; a = {k: 'bin', op, a, b: product(), line}; } return a; }
      function product() { let a = unary(); while (peek() && peek().t === 'op' && ['*', '/', '//', '%'].includes(peek().v)) { const op = tokens[p++].v; a = {k: 'bin', op, a, b: unary(), line}; } return a; }
      function unary() { if (peek() && peek().t === 'op' && peek().v === '-') { p++; return {k: 'neg', a: unary(), line}; } return postfix(); }
      function postfix() {
        let a = atom();
        for (;;) {
          if (is('.')) { p++; const t = tokens[p++]; if (!t || (t.t !== 'name' && t.t !== 'kw')) throw new PyError('После точки нужно имя команды или свойства.', line); a = {k: 'attr', a, name: t.v, line}; }
          else if (is('(')) { p++; const args = []; if (!is(')')) for (;;) { args.push(or()); if (is(',')) { p++; continue; } break; } need(')', 'Не хватает закрывающей скобки ).'); a = {k: 'call', f: a, args, line}; }
          else if (is('[')) { p++; const i = or(); need(']', 'Не хватает закрывающей скобки ].'); a = {k: 'index', a, i, line}; }
          else return a;
        }
      }
      function atom() {
        const t = tokens[p++];
        if (!t) throw new PyError('Выражение оборвалось: чего-то не хватает в конце строки.', line);
        if (t.t === 'num' || t.t === 'str') return {k: 'lit', v: t.v, line};
        if (t.t === 'kw' && t.v === 'True') return {k: 'lit', v: true, line};
        if (t.t === 'kw' && t.v === 'False') return {k: 'lit', v: false, line};
        if (t.t === 'kw' && t.v === 'None') return {k: 'lit', v: null, line};
        if (t.t === 'name') return {k: 'name', name: t.v, line};
        if (t.v === '(') { const e = or(); need(')', 'Не хватает закрывающей скобки ).'); return e; }
        if (t.v === '[') { const items = []; if (!is(']')) for (;;) { items.push(or()); if (is(',')) { p++; continue; } break; } need(']', 'Не хватает закрывающей скобки ].'); return {k: 'list', items, line}; }
        if (t.v === ')') throw new PyError('Лишняя закрывающая скобка ).', line);
        throw new PyError(`Здесь не должно быть «${t.v}».`, line);
      }
      const e = or();
      return {e, rest: tokens.slice(p)};
    }

    function split(tokens) {
      // Части через запятую вне скобок: «a, b[i]» → [a], [b[i]].
      const out = [[]]; let depth = 0;
      for (const x of tokens) { if (x.t === 'op' && '(['.includes(x.v)) depth++; if (x.t === 'op' && ')]'.includes(x.v)) depth--; if (x.t === 'op' && x.v === ',' && !depth) out.push([]); else out[out.length - 1].push(x); }
      return out;
    }

    function whole(tokens, line) {
      const {e, rest} = expression(tokens, line);
      if (rest.length) {
        if (rest[0].t === 'name' || rest[0].t === 'num' || rest[0].t === 'str') throw new PyError(`Перед «${rest[0].v}» чего-то не хватает: знака, запятой или скобки.`, line);
        throw new PyError(`Лишнее в конце строки: «${rest[0].v}».`, line);
      }
      return e;
    }

    function header(line, word) {
      // Заголовок блока: «слово выражение :» → токены выражения; команда после двоеточия в той же строке — тело блока.
      const tokens = line.tokens.slice(1), c = tokens.findIndex(x => x.t === 'op' && x.v === ':');
      if (c < 0) throw new PyError(`В конце строки с «${word}» нужно двоеточие.`, line.n);
      line.tail = tokens.slice(c + 1);
      return tokens.slice(0, c);
    }

    function body(parent) {
      if (parent.tail && parent.tail.length) {
        if (parent.tail[0].t === 'kw' && ['if', 'elif', 'else', 'while', 'for', 'def'].includes(parent.tail[0].v)) throw new PyError(`«${parent.tail[0].v}» после двоеточия перенесите на новую строку с отступом.`, parent.n);
        return [statement({n: parent.n, indent: parent.indent + 1, tokens: parent.tail})];
      }
      const next = lines[li];
      if (!next || next.indent <= parent.indent) throw new PyError('После двоеточия нужна хотя бы одна команда с отступом (4 пробела).', parent.n);
      return block(next.indent);
    }

    function block(indent) {
      const out = [];
      while (li < lines.length) {
        const line = lines[li];
        if (line.indent < indent) break;
        if (line.indent > indent) throw new PyError('Лишний отступ в начале строки. Отступ ставится только внутри блока — после строки с двоеточием.', line.n);
        li++;
        out.push(statement(line));
      }
      return out;
    }

    function statement(line) {
      const t = line.tokens, first = t[0], n = line.n;
      if (first.t === 'kw') {
        if (first.v === 'if') {
          const node = {k: 'if', line: n, branches: [{cond: whole(header(line, 'if'), n), body: body(line)}], other: null};
          while (li < lines.length && lines[li].indent === line.indent && lines[li].tokens[0].t === 'kw' && (lines[li].tokens[0].v === 'elif' || lines[li].tokens[0].v === 'else')) {
            const l2 = lines[li++];
            if (l2.tokens[0].v === 'elif') node.branches.push({cond: whole(header(l2, 'elif'), l2.n), body: body(l2)});
            else { if (header(l2, 'else').length) throw new PyError('После else сразу ставится двоеточие. Условие пишут после elif.', l2.n); node.other = body(l2); break; }
          }
          return node;
        }
        if (first.v === 'elif' || first.v === 'else') throw new PyError(`«${first.v}» должно стоять сразу после блока if, с тем же отступом.`, n);
        if (first.v === 'while') return {k: 'while', line: n, cond: whole(header(line, 'while'), n), body: body(line)};
        if (first.v === 'for') {
          const h = header(line, 'for');
          if (h.length < 3 || h[0].t !== 'name' || h[1].v !== 'in') throw new PyError('Цикл for пишется так: for i in range(3):', n);
          return {k: 'for', line: n, name: h[0].v, iter: whole(h.slice(2), n), body: body(line)};
        }
        if (first.v === 'def') {
          const h = header(line, 'def');
          if (h.length < 3 || h[0].t !== 'name' || h[1].v !== '(' || h[h.length - 1].v !== ')') throw new PyError('Функция объявляется так: def имя():', n);
          const params = h.slice(2, -1).filter(x => x.v !== ',');
          if (params.some(x => x.t !== 'name')) throw new PyError('В скобках после имени функции перечисляются имена параметров.', n);
          return {k: 'def', line: n, name: h[0].v, params: params.map(x => x.v), body: body(line)};
        }
        if (first.v === 'return') return {k: 'return', line: n, value: t.length > 1 ? whole(t.slice(1), n) : null};
        if (first.v === 'break' || first.v === 'continue' || first.v === 'pass') { if (t.length > 1) throw new PyError(`После ${first.v} в строке ничего не пишут.`, n); return {k: first.v, line: n}; }
      }
      if (t[t.length - 1].t === 'op' && t[t.length - 1].v === ':') throw new PyError('Двоеточие ставится только после if, elif, else, while, for и def.', n);
      const eq = t.findIndex(x => x.t === 'op' && ['=', '+=', '-=', '*=', '/=', '//=', '%='].includes(x.v));
      if (eq > 0) {
        const left = split(t.slice(0, eq)).map(x => whole(x, n));
        if (left.some(x => x.k !== 'name' && x.k !== 'index')) throw new PyError('Слева от знака = должно стоять имя переменной.', n);
        if (left.length === 1) return {k: 'assign', line: n, op: t[eq].v, target: left[0], value: whole(t.slice(eq + 1), n)};
        // a, b = b, a: сначала вычисляются все значения справа, потом присваиваются по порядку.
        if (t[eq].v !== '=') throw new PyError(`Знак ${t[eq].v} работает только с одной переменной.`, n);
        return {k: 'multi', line: n, targets: left, values: split(t.slice(eq + 1)).map(x => whole(x, n))};
      }
      const e = whole(t, n);
      if (e.k === 'attr') throw new PyError(`Чтобы выполнить команду, добавьте скобки: ${t.map(x => x.v).join('')}()`, n);
      if (e.k === 'name') throw new PyError(`Одно имя «${e.name}» ничего не делает. Если это команда героя, пишите hero.${e.name}().`, n);
      return {k: 'expr', line: n, e};
    }

    const program = block(lines.length ? lines[0].indent : 0);
    if (lines.length && lines[0].indent > 0) throw new PyError('Первая команда программы пишется без отступа.', lines[0].n);
    return program;
  }

  /* ====================== выполнение ====================== */

  const truthy = v => !(v === null || v === undefined || v === false || v === 0 || v === '' || (Array.isArray(v) && v.length === 0));
  const typeName = v => v === null || v === undefined ? 'None' : typeof v === 'number' ? 'число' : typeof v === 'string' ? 'строка' : typeof v === 'boolean' ? 'логическое значение' : Array.isArray(v) ? 'список' : v.py ? 'функция' : 'объект';
  const show = v => v === null || v === undefined ? 'None' : v === true ? 'True' : v === false ? 'False' : Array.isArray(v) ? '[' + v.map(show).join(', ') + ']' : typeof v === 'object' ? (v.name || v.type || 'объект') : String(v);

  function closest(name, list) {
    // Подсказка при опечатке: ближайшее имя по расстоянию Левенштейна.
    const dist = (a, b) => { const d = Array.from({length: a.length + 1}, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
    let best = null, score = 99;
    for (const c of list) { const s = c.toLowerCase() === name.toLowerCase() ? 0 : dist(name.toLowerCase(), c.toLowerCase()); if (s < score) { score = s; best = c; } }
    return score <= Math.max(2, Math.floor(name.length / 3)) ? best : null;
  }
  const hasCyrillic = s => /[А-Яа-яЁё]/.test(s);

  // run(program, globals) — генератор: выдаёт {type:'line'} перед каждой командой и {type:'tick'} после действия героя.
  function* run(program, globals, limits = {}) {
    const ctx = {ops: 0, max: limits.ops || 4000, depth: 0};
    const env = {vars: Object.assign(Object.create(null), builtins(), globals), parent: null};
    yield* execBlock(program, env, ctx);
  }

  function builtins() {
    const fn = (name, f) => ({builtin: name, call: f});
    return {
      range: fn('range', (args, line) => {
        if (args.length < 1 || args.length > 3 || args.some(a => typeof a !== 'number')) throw new PyError('range ждёт число: range(3) даст 0, 1, 2.', line);
        const [a, b, step] = args.length === 1 ? [0, args[0], 1] : [args[0], args[1], args.length === 3 ? args[2] : 1];
        if (!step) throw new PyError('Шаг в range не может быть нулём.', line);
        const out = []; for (let i = a; step > 0 ? i < b : i > b; i += step) { out.push(i); if (out.length > 10000) throw new PyError('Слишком длинный range.', line); }
        return out;
      }),
      len: fn('len', (args, line) => { if (args.length !== 1 || (typeof args[0] !== 'string' && !Array.isArray(args[0]))) throw new PyError('len считает длину списка или строки: len(список).', line); return args[0].length; }),
      str: fn('str', args => show(args[0])),
      int: fn('int', (args, line) => { const v = Math.trunc(Number(args[0])); if (Number.isNaN(v)) throw new PyError(`Не получается превратить ${show(args[0])} в число.`, line); return v; }),
      abs: fn('abs', args => Math.abs(args[0])),
      min: fn('min', args => Math.min(...(Array.isArray(args[0]) ? args[0] : args))),
      max: fn('max', args => Math.max(...(Array.isArray(args[0]) ? args[0] : args))),
      sum: fn('sum', (args, line) => { if (!Array.isArray(args[0]) || args[0].some(x => typeof x !== 'number')) throw new PyError('sum складывает числа списка: sum(список).', line); return args[0].reduce((s, x) => s + x, 0); }),
    };
  }

  function lookup(env, name, line) {
    for (let e = env; e; e = e.parent) if (name in e.vars) return e.vars[name];
    const all = []; for (let e = env; e; e = e.parent) all.push(...Object.keys(e.vars));
    const hero = env.vars.hero || (function find(e) { return e ? e.vars.hero || find(e.parent) : null; })(env);
    if (hero && hero.members && closest(name, Object.keys(hero.members)) === name) throw new PyError(`Команды героя пишутся через точку: hero.${name}()`, line);
    if (hasCyrillic(name) && /[A-Za-z]/.test(name)) throw new PyError(`В имени «${name}» смешаны русские и латинские буквы. Проверьте раскладку клавиатуры.`, line);
    const near = closest(name, all);
    throw new PyError(`Имя «${name}» не определено.` + (near ? ` Может быть, ${near}?` : ' Переменной нужно сначала присвоить значение.'), line);
  }

  function* execBlock(block, env, ctx) {
    for (const st of block) { const r = yield* exec(st, env, ctx); if (r) return r; }
    return null;
  }

  function* exec(st, env, ctx) {
    if (++ctx.ops > ctx.max) throw new PyError('Программа долго крутится по кругу, а герой ничего не делает. Проверьте условие цикла: оно должно когда-нибудь стать ложным.', st.line);
    yield {type: 'line', line: st.line};
    switch (st.k) {
      case 'expr': yield* evaluate(st.e, env, ctx); return null;
      case 'assign': {
        let value = yield* evaluate(st.value, env, ctx);
        // Как в Python: присваивание внутри функции создаёт её собственную (локальную) переменную.
        if (st.op !== '=' && st.target.k === 'name' && env.parent && !(st.target.name in env.vars)) throw new PyError(`Переменная «${st.target.name}» внутри функции своя, и значения у неё ещё нет. Задайте его в функции или передайте параметром, а результат верните через return.`, st.line);
        if (st.op !== '=') { const old = yield* evaluate(st.target, env, ctx); value = arith(st.op.slice(0, -1), old, value, st.line); }
        yield* store(st.target, value, env, ctx, st.line);
        return null;
      }
      case 'multi': {
        let values = []; for (const v of st.values) values.push(yield* evaluate(v, env, ctx));
        if (values.length === 1 && (Array.isArray(values[0]) || typeof values[0] === 'string')) values = [...values[0]];
        if (values.length !== st.targets.length) throw new PyError(`Слева от = переменных: ${st.targets.length}, а значений справа: ${values.length}. Их должно быть поровну.`, st.line);
        for (const [i, t] of st.targets.entries()) yield* store(t, values[i], env, ctx, st.line);
        return null;
      }
      case 'if':
        for (const b of st.branches) if (truthy(yield* evaluate(b.cond, env, ctx))) return yield* execBlock(b.body, env, ctx);
        return st.other ? yield* execBlock(st.other, env, ctx) : null;
      case 'while':
        while (truthy(yield* evaluate(st.cond, env, ctx))) {
          const r = yield* execBlock(st.body, env, ctx);
          if (r && r.k === 'break') break;
          if (r && r.k === 'return') return r;
          if (++ctx.ops > ctx.max) throw new PyError('Цикл while крутится слишком долго и герой ничего не делает. Проверьте условие.', st.line);
          yield {type: 'line', line: st.line};
        }
        return null;
      case 'for': {
        const items = yield* evaluate(st.iter, env, ctx);
        if (typeof items === 'number') throw new PyError(`for не умеет перебирать число. Напишите: for ${st.name} in range(${items}):`, st.line);
        if (!Array.isArray(items) && typeof items !== 'string') throw new PyError('for перебирает список, строку или range(...).', st.line);
        for (const item of [...items]) {
          env.vars[st.name] = item;
          const r = yield* execBlock(st.body, env, ctx);
          if (r && r.k === 'break') break;
          if (r && r.k === 'return') return r;
          yield {type: 'line', line: st.line};
        }
        return null;
      }
      case 'def': env.vars[st.name] = {py: true, name: st.name, params: st.params, body: st.body, env}; return null;
      case 'return': return {k: 'return', value: st.value ? yield* evaluate(st.value, env, ctx) : null};
      case 'break': case 'continue': return {k: st.k};
      case 'pass': return null;
    }
    return null;
  }

  function* store(target, value, env, ctx, line) {
    if (target.k === 'name') { env.vars[target.name] = value; return; }
    const list = yield* evaluate(target.a, env, ctx), i = yield* evaluate(target.i, env, ctx);
    if (!Array.isArray(list)) throw new PyError('По номеру можно менять только элементы списка.', line);
    list[index(list, i, line)] = value;
  }

  function index(list, i, line) {
    if (typeof i !== 'number' || !Number.isInteger(i)) throw new PyError('Номер элемента должен быть целым числом.', line);
    const at = i < 0 ? list.length + i : i;
    if (at < 0 || at >= list.length) throw new PyError(`В списке нет элемента с номером ${i}: всего элементов ${list.length}, нумерация с нуля.`, line);
    return at;
  }

  const MAXLEN = 1e6, long = (n, line) => { if (n > MAXLEN) throw new PyError('Получается слишком длинная строка или список: больше миллиона элементов.', line); };
  function arith(op, a, b, line) {
    if (op === '+') {
      if (typeof a === 'string' && typeof b === 'string') { long(a.length + b.length, line); return a + b; }
      if (Array.isArray(a) && Array.isArray(b)) { long(a.length + b.length, line); return a.concat(b); }
      if (typeof a === 'string' || typeof b === 'string') throw new PyError('Строку нельзя сложить с числом. Превратите число в строку: str(число).', line);
    }
    if (op === '*' && (typeof a === 'number' || typeof b === 'number')) {
      // Повторение: "ха" * 3, [0] * 4; при n <= 0 — пусто.
      const [s, n] = typeof a === 'number' ? [b, a] : [a, b];
      if (typeof s === 'string' || Array.isArray(s)) {
        if (!Number.isInteger(n)) throw new PyError('Строку или список можно умножить только на целое число.', line);
        const k = s.length ? Math.max(0, n) : 0; long(s.length * k, line);
        if (typeof s === 'string') return s.repeat(k);
        const out = []; for (let i = 0; i < k; i++) out.push(...s); return out;
      }
    }
    if (typeof a !== 'number' || typeof b !== 'number') throw new PyError(`Действие «${op}» не подходит для: ${typeName(a)} и ${typeName(b)}.`, line);
    if ((op === '/' || op === '//' || op === '%') && b === 0) throw new PyError('Деление на ноль.', line);
    return op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? a / b : op === '//' ? Math.floor(a / b) : a - b * Math.floor(a / b);
  }

  const same = (a, b) => a === b || (a == null && b == null), eq = (a, b) => same(a, b) || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => eq(x, b[i])));
  function compare(op, a, b, line) {
    if (op === '==' || op === '!=') return eq(a, b) === (op === '==');
    if (op === 'is' || op === 'is not') return same(a, b) === (op === 'is');
    if (op === 'in' || op === 'not in') { if (!Array.isArray(b) && typeof b !== 'string') throw new PyError(`Справа от ${op} должен стоять список или строка.`, line); return (Array.isArray(b) ? b.some(x => eq(x, a)) : b.includes(a)) === (op === 'in'); }
    if (a === null || b === null) throw new PyError('Сравнивать с None нельзя: такого объекта сейчас нет. Сначала проверьте его: if enemy:', line);
    if (typeof a !== typeof b || (typeof a !== 'number' && typeof a !== 'string')) throw new PyError(`Нельзя сравнить: ${typeName(a)} и ${typeName(b)}.`, line);
    return op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
  }

  function* evaluate(e, env, ctx) {
    switch (e.k) {
      case 'lit': return e.v;
      case 'name': return lookup(env, e.name, e.line);
      case 'list': { const out = []; for (const it of e.items) out.push(yield* evaluate(it, env, ctx)); return out; }
      case 'neg': { const v = yield* evaluate(e.a, env, ctx); if (typeof v !== 'number') throw new PyError('Минус ставится только перед числом.', e.line); return -v; }
      case 'not': return !truthy(yield* evaluate(e.a, env, ctx));
      case 'and': { const a = yield* evaluate(e.a, env, ctx); return truthy(a) ? yield* evaluate(e.b, env, ctx) : a; }
      case 'or': { const a = yield* evaluate(e.a, env, ctx); return truthy(a) ? a : yield* evaluate(e.b, env, ctx); }
      case 'bin': { const a = yield* evaluate(e.a, env, ctx), b = yield* evaluate(e.b, env, ctx); return arith(e.op, a, b, e.line); }
      case 'cmp': {
        let a = yield* evaluate(e.items[0], env, ctx);
        for (let i = 0; i < e.ops.length; i++) { const b = yield* evaluate(e.items[i + 1], env, ctx); if (!compare(e.ops[i], a, b, e.line)) return false; a = b; }
        return true;
      }
      case 'index': {
        const a = yield* evaluate(e.a, env, ctx), i = yield* evaluate(e.i, env, ctx);
        if (!Array.isArray(a) && typeof a !== 'string') throw new PyError('Квадратные скобки с номером ставятся после списка или строки.', e.line);
        return a[index(a, i, e.line)];
      }
      case 'attr': {
        const a = yield* evaluate(e.a, env, ctx);
        if (a === null || a === undefined) throw new PyError(`У None нет свойства ${e.name}: объекта сейчас нет. Сначала проверьте, что он найден: if enemy:`, e.line);
        if (a && a.members) {
          if (Object.prototype.hasOwnProperty.call(a.members, e.name)) { const m = a.members[e.name]; return typeof m === 'function' && !m.method ? m() : m; }
          const near = closest(e.name, Object.keys(a.members));
          throw new PyError(`У ${a.title || 'объекта'} нет ${e.name}.` + (near ? ` Может быть, ${near}? Регистр букв важен.` : ''), e.line);
        }
        if (Array.isArray(a) && e.name === 'append') return {method: true, native: function* (args) { a.push(args[0]); return null; }};
        throw new PyError(`У значения «${show(a)}» нет свойства ${e.name}.`, e.line);
      }
      case 'call': {
        const f = yield* evaluate(e.f, env, ctx), args = [];
        for (const a of e.args) args.push(yield* evaluate(a, env, ctx));
        if (f && f.builtin) return f.call(args, e.line);
        if (f && f.native) return yield* f.native(args, e.line, ctx);
        if (f && f.py) {
          if (args.length !== f.params.length) throw new PyError(`Функция ${f.name} ждёт аргументов: ${f.params.length}, а передано: ${args.length}.`, e.line);
          if (++ctx.depth > 60) throw new PyError('Функция вызывает сама себя слишком много раз.', e.line);
          const local = {vars: Object.create(null), parent: f.env};
          f.params.forEach((p, i) => { local.vars[p] = args[i]; });
          const r = yield* execBlock(f.body, local, ctx); ctx.depth--;
          return r && r.k === 'return' ? r.value : null;
        }
        throw new PyError(`«${show(f)}» — не команда, его нельзя вызвать со скобками.`, e.line);
      }
    }
    return null;
  }

  /* ====================== мир подземелья ====================== */

  const DIR = {Right: [1, 0], Left: [-1, 0], Up: [0, -1], Down: [0, 1]};
  const NAMES = ['Брак', 'Трог', 'Грым', 'Зуб', 'Хрум', 'Клык', 'Рык', 'Жбан', 'Гнус', 'Шмяк'];
  const KIND = {munchkin: {title: 'слизень', hp: 10, dmg: 2}, ogre: {title: 'огр', hp: 30, dmg: 4}, brute: {title: 'громила', hp: 60, dmg: 5},
    // Боец замахивается (state == "charging"), а следующим ходом бьёт очень сильно; лучник стреляет вдоль ряда или столбца; шаман лечит своих.
    bruiser: {title: 'боец', hp: 60, dmg: 4, cycle: ['hit', 'charge', 'smash'], smash: 30},
    archer: {title: 'лучник', hp: 10, dmg: 6, melee: 3, range: 6},
    shaman: {title: 'шаман', hp: 20, dmg: 0, heal: 10},
    rat: {title: 'крыса', hp: 10, dmg: 5},
    guard: {title: 'страж', hp: 120, dmg: 5, cycle: ['hit', 'hit', 'charge', 'smash'], smash: 35, boss: true},
    swarmlord: {title: 'повелитель роя', hp: 100, dmg: 4, cycle: ['summon', 'hit', 'hit'], boss: true},
    mage: {title: 'маг', hp: 80, dmg: 0, cycle: ['cast', 'blast', 'wait', 'wait'], blast: 40, boss: true, ranged: true},
    glitch: {title: 'Глюк', hp: 160, dmg: 6, cycle: ['hit', 'charge', 'smash'], smash: 40, boss: true}};
  const MAPCHAR = {m: 'munchkin', o: 'ogre', B: 'brute', K: 'bruiser', A: 'archer', S: 'shaman'};

  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // Карта: # стена, . пол, H герой, X выход, g кристалл, p зелье, b бомба, m слизень, o огр, B громила,
  // строчная буква врага со знаком в level.chase делает его преследователем; D дверь с паролем (level.doors по порядку).
  function makeWorld(level, seed = 1) {
    const rnd = mulberry(seed * 7919 + 13), names = NAMES.slice().sort(() => rnd() - 0.5);
    const w = {level, w: 0, h: level.map.length, walls: new Set(), hero: {x: 0, y: 0, hp: level.hp || 40, maxHp: level.hp || 40, gold: 0, dmg: 10, blocking: false, cleaveAt: 0, mana: level.mana || 0, maxMana: level.mana || 0}, enemies: [], items: [], doors: [], traps: [], exit: null,
      ticks: 0, wasted: 0, maxTicks: level.maxTicks || 160, won: false, lost: '', said: [], rnd, int: (a, b) => a + Math.floor(rnd() * (b - a + 1)), nextId: 1, names};
    const add = (kind, x, y, extra = {}) => { const k = KIND[kind]; const e = {id: w.nextId++, kind, type: kind, title: k.title, name: extra.name || (k.boss ? k.title[0].toUpperCase() + k.title.slice(1) : names[w.enemies.length % names.length]), x, y, hp: extra.hp || k.hp, maxHp: extra.hp || k.hp, dmg: extra.dmg ?? k.dmg, chase: !!extra.chase, sight: extra.sight || 7, dead: false, state: 'idle', ci: 0, cycle: extra.cycle || k.cycle || null, smash: extra.smash ?? k.smash ?? 0, blast: k.blast || 0, heal: k.heal || 0, boss: !!k.boss, summon: extra.summon || null, summoned: 0, frozen: 0}; w.enemies.push(e); return e; };
    w.addEnemy = add;
    w.addItem = (type, x, y) => { const it = {id: w.nextId++, type, x, y, taken: false}; w.items.push(it); return it; };
    level.map.forEach((row, y) => { w.w = Math.max(w.w, row.length); [...row].forEach((ch, x) => {
      if (ch === '#') w.walls.add(x + ',' + y);
      else if (ch === 'H') { w.hero.x = x; w.hero.y = y; }
      else if (ch === 'X') w.exit = {x, y};
      else if (ch === 'g') w.addItem('gem', x, y);
      else if (ch === 'p') w.addItem('potion', x, y);
      else if (ch === 'b') w.addItem('bomb', x, y);
      else if (MAPCHAR[ch]) add(MAPCHAR[ch], x, y);
      else if (ch === 'Z') add(level.boss, x, y, level.bossExtra || {});
      else if (ch === 'F') w.traps.push({x, y, period: 3, offset: w.traps.length});
      else if (ch === 'D') w.doors.push({x, y, word: (level.doors || [])[w.doors.length] || 'сезам', open: false});
    }); });
    if (level.setup) level.setup(w);
    w.start = {gems: w.items.filter(i => i.type === 'gem').length, enemies: w.enemies.length};
    return w;
  }

  const blockedFor = (w, x, y, who) => x < 0 || y < 0 || x >= w.w || y >= w.h || w.walls.has(x + ',' + y) || w.doors.some(d => !d.open && d.x === x && d.y === y) || w.enemies.some(e => !e.dead && e !== who && e.x === x && e.y === y) || (who && w.hero.x === x && w.hero.y === y);
  const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  function pathStep(w, from, to, who, avoidBombs) {
    // Первый шаг кратчайшего пути (поиск в ширину); цель может быть занята.
    const key = (x, y) => x + ',' + y, prev = new Map([[key(from.x, from.y), null]]), queue = [[from.x, from.y]];
    while (queue.length) {
      const [x, y] = queue.shift();
      if (x === to.x && y === to.y) { let k = key(x, y), p = prev.get(k); if (!p) return null; while (prev.get(p) !== null) { k = p; p = prev.get(k); } const [nx, ny] = k.split(',').map(Number); return {x: nx, y: ny}; }
      for (const [dx, dy] of Object.values(DIR)) { const nx = x + dx, ny = y + dy, k = key(nx, ny); if (prev.has(k)) continue; if (!(nx === to.x && ny === to.y) && (blockedFor(w, nx, ny, who) || (avoidBombs && w.items.some(i => !i.taken && i.type === 'bomb' && i.x === nx && i.y === ny)))) continue; if (nx === to.x && ny === to.y && blockedFor(w, nx, ny, who) && !(who && w.hero.x === nx && w.hero.y === ny) && !who) continue; prev.set(k, key(x, y)); queue.push([nx, ny]); }
    }
    return null;
  }

  function goalsMet(w) {
    const g = w.level.goals;
    return (!g.includes('boss') || w.enemies.every(e => !e.boss || e.dead)) && (!g.includes('exit') || (w.exit && w.hero.x === w.exit.x && w.hero.y === w.exit.y)) && (!g.includes('gems') || w.items.every(i => i.type !== 'gem' || i.taken)) && (!g.includes('kill') || w.enemies.every(e => e.dead)) && (!w.level.check || w.level.check(w));
  }

  // Один ход: действие героя, затем ходы врагов. Возвращает события для анимации.
  function act(w, kind, arg) {
    const ev = [], h = w.hero;
    if (w.won || w.lost) return ev;
    w.ticks++;
    if (kind === 'move') {
      const [dx, dy] = DIR[arg], nx = h.x + dx, ny = h.y + dy;
      if (blockedFor(w, nx, ny, null)) { w.wasted++; ev.push({e: 'bump', dx, dy, what: w.enemies.some(e => !e.dead && e.x === nx && e.y === ny) ? 'враг' : w.doors.some(d => !d.open && d.x === nx && d.y === ny) ? 'дверь' : 'стена'}); }
      else { ev.push({e: 'move', from: {x: h.x, y: h.y}, to: {x: nx, y: ny}}); h.x = nx; h.y = ny; }
    } else if (kind === 'attack') {
      const t = arg;
      if (!t || t.dead) { w.wasted++; ev.push({e: 'note', text: 'Атаковать некого'}); }
      else if (dist(h, t) > 1) { if (!w.level.farOk) w.wasted++; ev.push({e: 'note', text: `${t.name} слишком далеко`}); }
      else { t.hp -= h.dmg; if (t.hp <= 0) { t.hp = 0; t.dead = true; } ev.push({e: 'attack', target: t.id, x: t.x, y: t.y, dead: t.dead, hp: t.hp}); }
    } else if (kind === 'say') {
      const text = show(arg); w.said.push(text); ev.push({e: 'say', text});
      for (const d of w.doors) if (!d.open && dist(h, d) <= 1 && norm(text) === norm(d.word)) { d.open = true; ev.push({e: 'door', x: d.x, y: d.y}); }
    } else if (kind === 'shield') { h.blocking = true; ev.push({e: 'shield'}); }
    else if (kind === 'cleave') {
      if (w.ticks < h.cleaveAt) { w.wasted++; ev.push({e: 'note', text: 'Круговой удар ещё не готов'}); }
      else { h.cleaveAt = w.ticks + 3; const hits = []; for (const t of w.enemies) if (!t.dead && dist(h, t) <= 1) { t.hp -= h.dmg; if (t.hp <= 0) { t.hp = 0; t.dead = true; } hits.push({id: t.id, x: t.x, y: t.y, hp: t.hp, dead: t.dead}); } if (!hits.length) w.wasted++; ev.push({e: 'cleave', hits}); }
    } else if (kind === 'cast') {
      // Магия: мана не восстанавливается, поэтому каждое заклинание — на вес золота.
      const {spell, target} = arg, cost = SPELLS[spell].cost;
      if (h.mana < cost) { w.wasted++; ev.push({e: 'note', text: 'Не хватает маны'}); }
      else if (spell === 'heal') { if (h.hp >= h.maxHp) w.wasted++; h.mana -= cost; h.hp = Math.min(h.maxHp, h.hp + 30); ev.push({e: 'cast', spell, hp: h.hp, mana: h.mana}); }
      else if (!target || target.dead) { w.wasted++; ev.push({e: 'note', text: 'Нет цели для заклинания'}); }
      else if (dist(h, target) > 5) { w.wasted++; h.mana -= cost; ev.push({e: 'cast', spell, x: target.x, y: target.y, miss: true, mana: h.mana}); ev.push({e: 'note', text: 'Слишком далеко: заклинание не долетело'}); }
      else if (spell === 'freeze') { h.mana -= cost; if (target.state !== 'idle') target.ci++; else w.wasted++; target.frozen = 2; target.state = 'idle'; ev.push({e: 'cast', spell, x: target.x, y: target.y, target: target.id, mana: h.mana}); ev.push({e: 'state', id: target.id, state: 'frozen'}); }
      else {
        // Огненный шар взрывается: 30 по цели, 10 по всем на соседних клетках — и по герою тоже, если он рядом.
        h.mana -= cost; const hits = [];
        for (const t of w.enemies) if (!t.dead && (t === target || dist(t, target) <= 1)) { t.hp -= t === target ? 30 : 10; if (t.hp <= 0) { t.hp = 0; t.dead = true; } hits.push({id: t.id, x: t.x, y: t.y, hp: t.hp, dead: t.dead}); }
        let self = 0; if (dist(h, target) <= 1) { self = 10; h.hp -= 10; w.wasted++; }
        ev.push({e: 'cast', spell, x: target.x, y: target.y, hits, self, hp: Math.max(0, h.hp), mana: h.mana});
      }
    } else ev.push({e: 'wait'});
    const fire = w.traps.find(t => t.x === h.x && t.y === h.y && burning(t, w.ticks));
    if (fire) { h.hp -= 20; ev.push({e: 'burn', hp: Math.max(0, h.hp)}); }
    for (const it of w.items) if (!it.taken && it.x === h.x && it.y === h.y) {
      it.taken = true;
      if (it.type === 'gem') { h.gold++; ev.push({e: 'take', id: it.id, type: 'gem'}); }
      else if (it.type === 'potion') { h.hp = Math.min(h.maxHp, h.hp + 20); ev.push({e: 'take', id: it.id, type: 'potion', hp: h.hp}); }
      else { h.hp -= 15; ev.push({e: 'take', id: it.id, type: 'bomb', hp: Math.max(0, h.hp)}); }
    }
    if (h.hp > 0 && goalsMet(w)) { w.won = true; ev.push({e: 'win'}); return ev; }
    const hurt = (en, dmg, how) => { const real = h.blocking ? Math.ceil(dmg * 0.2) : dmg; h.hp -= real; ev.push({e: 'hit', id: en.id, dmg: real, hp: Math.max(0, h.hp), how, blocked: h.blocking}); };
    for (const en of [...w.enemies]) {
      if (en.dead || h.hp <= 0) continue;
      if (en.frozen > 0) { en.frozen--; if (!en.frozen) ev.push({e: 'state', id: en.id, state: 'idle'}); continue; }
      const near = dist(en, h) <= 1;
      if (en.kind === 'shaman') {
        const hurtOnes = w.enemies.filter(o => !o.dead && o !== en && o.kind !== 'shaman' && o.hp < o.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        if (hurtOnes.length) { const t = hurtOnes[0]; t.hp = Math.min(t.maxHp, t.hp + en.heal); ev.push({e: 'heal', id: en.id, target: t.id, hp: t.hp}); }
      } else if (en.kind === 'archer') {
        if (near) hurt(en, KIND.archer.melee, 'melee');
        else if (lineClear(w, en, h, KIND.archer.range)) hurt(en, en.dmg, 'arrow');
      } else if (en.cycle) {
        // Враг с распорядком действий: замах всегда заканчивается ударом, остальное — только рядом с героем (маг колдует издалека).
        const ranged = KIND[en.kind].ranged, enraged = en.kind === 'glitch' && en.hp * 2 <= en.maxHp, cycle = enraged ? ['charge', 'smash'] : en.cycle;
        if (en.state === 'charging') { en.state = 'idle'; en.ci++; if (near) hurt(en, en.smash, 'smash'); else ev.push({e: 'miss', id: en.id}); ev.push({e: 'state', id: en.id, state: 'idle'}); }
        else if (en.state === 'casting') { en.state = 'idle'; en.ci++; if (en.x === h.x || en.y === h.y) hurt(en, en.blast, 'blast'); else ev.push({e: 'miss', id: en.id}); ev.push({e: 'state', id: en.id, state: 'idle'}); }
        else if (near || ranged) {
          const act = cycle[en.ci % cycle.length];
          if (act === 'charge') { en.state = 'charging'; ev.push({e: 'state', id: en.id, state: 'charging'}); }
          else if (act === 'cast') { en.state = 'casting'; ev.push({e: 'state', id: en.id, state: 'casting'}); }
          else { en.ci++; if (act === 'hit') hurt(en, en.dmg, 'melee'); else if (act === 'summon') summon(w, en, ev); }
        } else if (en.chase && dist(en, h) <= en.sight) { const s = pathStep(w, en, h, en); if (s && !(s.x === h.x && s.y === h.y)) { ev.push({e: 'enemyMove', id: en.id, from: {x: en.x, y: en.y}, to: s}); en.x = s.x; en.y = s.y; } }
        if (en.summon && !en.dead && w.ticks % en.summon.every === 0) summon(w, en, ev);
      } else if (near) hurt(en, en.dmg, 'melee');
      else if (en.chase && dist(en, h) <= en.sight) { const s = pathStep(w, en, h, en); if (s && !(s.x === h.x && s.y === h.y)) { ev.push({e: 'enemyMove', id: en.id, from: {x: en.x, y: en.y}, to: s}); en.x = s.x; en.y = s.y; } }
    }
    h.blocking = false;
    if (h.hp <= 0) { h.hp = 0; w.lost = 'Герой погиб. Попробуйте атаковать врага раньше или обойти его.'; ev.push({e: 'dead'}); }
    else if (w.ticks >= w.maxTicks) { w.lost = 'Слишком много ходов: герой устал. Попробуйте сократить программу.'; ev.push({e: 'tired'}); }
    return ev;
  }
  const norm = s => String(s).trim().toLowerCase().replace(/ё/g, 'е');
  const SPELLS = {fireball: {cost: 2}, heal: {cost: 2}, freeze: {cost: 1}};
  const burning = (trap, tick) => (tick + trap.offset) % trap.period === 0;
  function lineClear(w, a, b, range) {
    // Свободна ли прямая между клетками одного ряда или столбца.
    if (a.x !== b.x && a.y !== b.y) return false;
    const d = dist(a, b); if (d > range) return false;
    const sx = Math.sign(b.x - a.x), sy = Math.sign(b.y - a.y);
    for (let i = 1; i < d; i++) if (blockedFor(w, a.x + sx * i, a.y + sy * i, null)) return false;
    return true;
  }
  function summon(w, boss, ev) {
    const rule = boss.summon || {kind: 'munchkin', max: 3};
    if (w.enemies.filter(e => !e.dead && e.by === boss.id).length >= rule.max) return;
    const spots = (w.level.spawns || [[boss.x + 1, boss.y], [boss.x - 1, boss.y], [boss.x, boss.y + 1], [boss.x, boss.y - 1]]).filter(([x, y]) => !blockedFor(w, x, y, boss));
    if (!spots.length) return;
    const [x, y] = spots[Math.floor(w.rnd() * spots.length)], e = w.addEnemy(rule.kind, x, y, {chase: true, sight: 30, ...(rule.dmg ? {dmg: rule.dmg} : {})}); e.by = boss.id; boss.summoned++;
    ev.push({e: 'spawn', enemy: {id: e.id, kind: e.kind, name: e.name, x, y, hp: e.hp, maxHp: e.maxHp}});
  }

  // Объекты, которые видит программа ученика.
  function heroApi(w, allowed) {
    const DIRNAME = {right: 'Right', left: 'Left', up: 'Up', down: 'Down'};
    const tick = function* (events, line) { yield {type: 'tick', events, line}; return null; };
    const wrapEnemy = e => e ? (e.api = e.api || {title: 'врага', name: e.name, type: e.type, members: {name: e.name, type: e.type, health: () => e.hp, maxHealth: e.maxHp, state: () => e.frozen > 0 ? 'frozen' : e.state, pos: () => point(e.x, e.y)}}) : null;
    const wrapItem = i => i ? (i.api = i.api || {title: 'предмета', type: i.type, members: {type: i.type, pos: () => point(i.x, i.y)}}) : null;
    const point = (x, y) => ({title: 'точки', members: {x, y: w.h - 1 - y}});
    const unwrap = v => v && v.members ? (w.enemies.find(e => e.api === v) || w.items.find(i => i.api === v) || null) : null;
    const nearest = list => list.reduce((best, o) => !best || dist(o, w.hero) < dist(best, w.hero) ? o : best, null);
    const method = f => { const m = {method: true, native: f}; return m; };
    const count = (args, line, name) => { const n = args.length ? args[0] : 1; if (args.length > 1) throw new PyError(`${name} принимает одно число — сколько шагов сделать.`, line); if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 30) throw new PyError(`В скобках у ${name} должно быть целое число шагов, например ${name}(3).`, line); return n; };
    const members = {
      health: () => w.hero.hp, maxHealth: w.hero.maxHp, gold: () => w.hero.gold, pos: () => point(w.hero.x, w.hero.y), time: () => w.ticks, mana: () => w.hero.mana,
      cast: method(function* (args, line) {
        const spell = String(args[0]);
        if (!SPELLS[spell]) throw new PyError('Такого заклинания нет. Есть: "fireball" (огненный шар), "freeze" (лёд), "heal" (лечение).', line);
        if (spell === 'heal') { if (args.length !== 1) throw new PyError('Лечение колдуют на себя: hero.cast("heal").', line); yield* tick(act(w, 'cast', {spell}), line); return null; }
        if (args.length !== 2) throw new PyError(`У заклинания нужна цель: hero.cast("${spell}", enemy).`, line);
        if (args[1] === null) throw new PyError('Цель заклинания — None: такого врага сейчас нет. Проверьте его перед заклинанием.', line);
        const t = unwrap(args[1]); if (!t || t.kind === undefined) throw new PyError('Цель заклинания — враг: hero.cast("fireball", enemy).', line);
        yield* tick(act(w, 'cast', {spell, target: t}), line); return null;
      }),
      canCast: method(function* (args, line) { const sp = SPELLS[String(args[0])]; if (!sp) throw new PyError('hero.canCast ждёт название заклинания: "fireball", "freeze" или "heal".', line); return w.hero.mana >= sp.cost; }),
      shield: method(function* (args, line) { yield* tick(act(w, 'shield'), line); return null; }),
      cleave: method(function* (args, line) { yield* tick(act(w, 'cleave'), line); return null; }),
      isReady: method(function* (args, line) { if (args[0] !== 'cleave') throw new PyError('hero.isReady ждёт название приёма в кавычках: hero.isReady("cleave").', line); return w.ticks >= w.hero.cleaveAt; }),
      move: method(function* (args, line) { const d = DIRNAME[String(args[0]).toLowerCase()]; if (args.length !== 1 || !d) throw new PyError('hero.move ждёт направление в кавычках: "right", "left", "up" или "down".', line); yield* tick(act(w, 'move', d), line); return null; }),
      moveTo: method(function* (args, line) {
        const o = unwrap(args[0]);
        if (args[0] === null) throw new PyError('Идти не к кому: в переменной None. Сначала проверьте, что объект найден.', line);
        if (!o) throw new PyError('hero.moveTo ждёт врага или предмет: hero.moveTo(enemy). Герой делает один шаг в его сторону.', line);
        const isEnemy = o.kind !== undefined;
        if ((isEnemy && dist(o, w.hero) <= 1) || (!isEnemy && dist(o, w.hero) === 0)) { w.wasted++; yield* tick([{e: 'note', text: 'Уже на месте'}], line); return null; }
        let s = pathStep(w, w.hero, o, null, true);
        if (!s || blockedFor(w, s.x, s.y, null)) {
          // До цели не дойти (она за решёткой или путь занят): шаг на свободную клетку, которая ближе к цели.
          s = null; let best = dist(w.hero, o);
          for (const [dx, dy] of Object.values(DIR)) { const c = {x: w.hero.x + dx, y: w.hero.y + dy}; if (!blockedFor(w, c.x, c.y, null) && dist(c, o) < best) { best = dist(c, o); s = c; } }
          if (!s) { yield* tick(act(w, 'wait'), line); return null; }
        }
        yield* tick(act(w, 'move', Object.keys(DIR).find(k => DIR[k][0] === s.x - w.hero.x && DIR[k][1] === s.y - w.hero.y)), line); return null;
      }),
      isSafe: method(function* (args, line) { const d = DIRNAME[String(args[0]).toLowerCase()]; if (!d) throw new PyError('hero.isSafe ждёт направление в кавычках: "right", "left", "up" или "down".', line); const x = w.hero.x + DIR[d][0], y = w.hero.y + DIR[d][1]; return !blockedFor(w, x, y, null) && !w.traps.some(t => t.x === x && t.y === y && burning(t, w.ticks + 1)); }),
      say: method(function* (args, line) { if (args.length !== 1) throw new PyError('hero.say ждёт одно значение в скобках: hero.say("текст").', line); yield* tick(act(w, 'say', args[0]), line); return null; }),
      wait: method(function* (args, line) { yield* tick(act(w, 'wait'), line); return null; }),
      attack: method(function* (args, line) {
        if (args.length !== 1) throw new PyError('hero.attack ждёт цель в скобках: имя в кавычках или переменную с врагом.', line);
        let target = null;
        if (typeof args[0] === 'string') { target = w.enemies.find(e => !e.dead && norm(e.name) === norm(args[0])); if (!target) { const alive = w.enemies.filter(e => !e.dead).map(e => e.name); const near = closest(args[0], alive); throw new PyError(alive.length ? `Врага с именем «${args[0]}» здесь нет.` + (near ? ` Может быть, «${near}»?` : ` Есть: ${alive.join(', ')}.`) : 'Врагов уже не осталось — атаковать некого.', line); } }
        else if (args[0] === null) throw new PyError('В переменной нет врага (None): hero.findNearestEnemy() никого не нашёл. Проверьте: if enemy:', line);
        else { target = unwrap(args[0]); if (!target || target.kind === undefined) throw new PyError('Атаковать можно только врага: имя в кавычках или результат hero.findNearestEnemy().', line); }
        yield* tick(act(w, 'attack', target), line); return null;
      }),
      findNearestEnemy: method(function* () { return wrapEnemy(nearest(w.enemies.filter(e => !e.dead))); }),
      findEnemies: method(function* () { return w.enemies.filter(e => !e.dead).sort((a, b) => dist(a, w.hero) - dist(b, w.hero)).map(wrapEnemy); }),
      findNearestItem: method(function* () { return wrapItem(nearest(w.items.filter(i => !i.taken))); }),
      findItems: method(function* () { return w.items.filter(i => !i.taken).sort((a, b) => dist(a, w.hero) - dist(b, w.hero)).map(wrapItem); }),
      distanceTo: method(function* (args, line) { const o = unwrap(args[0]); if (!o) throw new PyError('hero.distanceTo ждёт врага или предмет: hero.distanceTo(enemy).', line); return dist(o, w.hero); }),
      isPathClear: method(function* (args, line) { const d = DIRNAME[String(args[0]).toLowerCase()]; if (!d) throw new PyError('hero.isPathClear ждёт направление в кавычках: "right", "left", "up" или "down".', line); return !blockedFor(w, w.hero.x + DIR[d][0], w.hero.y + DIR[d][1], null); }),
      moveXY: method(function* (args, line) {
        if (args.length !== 2 || args.some(a => typeof a !== 'number')) throw new PyError('hero.moveXY ждёт две координаты: hero.moveXY(x, y).', line);
        const to = {x: args[0], y: w.h - 1 - args[1]};
        for (let guard = 0; guard < 60 && !(w.hero.x === to.x && w.hero.y === to.y) && !w.won && !w.lost; guard++) {
          const s = pathStep(w, w.hero, to, null, true);
          if (!s || blockedFor(w, s.x, s.y, null)) { yield* tick([{e: 'note', text: 'Туда не пройти'}], line); break; }
          const d = Object.keys(DIR).find(k => DIR[k][0] === s.x - w.hero.x && DIR[k][1] === s.y - w.hero.y);
          yield* tick(act(w, 'move', d), line);
        }
        return null;
      }),
    };
    for (const d of Object.keys(DIR)) members['move' + d] = method(function* (args, line) { const n = count(args, line, 'hero.move' + d); for (let i = 0; i < n && !w.won && !w.lost; i++) yield* tick(act(w, 'move', d), line); return null; });
    if (allowed) for (const k of Object.keys(members)) if (!allowed.includes(k) && !['health', 'maxHealth', 'gold', 'pos', 'time', 'mana'].includes(k)) delete members[k];
    return {title: 'героя', members};
  }

  const codeLines = source => String(source).split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length;

  // Мгновенный прогон программы на одном варианте уровня (без анимации): для автотестов и скрытой проверки.
  function simulate(level, source, seed = 1) {
    let program;
    try { program = parse(source); } catch (error) { return {ok: false, error: error.message, line: error.line, syntax: true}; }
    const w = makeWorld(level, seed), ctx = {};
    try {
      for (const ev of run(program, {hero: heroApi(w, level.api)}, ctx)) { if (w.won || w.lost) break; }
    } catch (error) { if (!(error instanceof PyError)) throw error; if (!w.won) return {ok: false, error: error.message, line: error.line, world: w}; }
    if (w.won) return {ok: true, world: w, stars: stars(level, w, source)};
    return {ok: false, error: w.lost || unmet(w), world: w};
  }

  function unmet(w) {
    const g = w.level.goals, left = [];
    if (g.includes('boss') && !w.enemies.every(e => !e.boss || e.dead)) left.push('босс не побеждён');
    if (g.includes('kill') && !w.enemies.every(e => e.dead)) left.push('побеждены не все враги');
    if (g.includes('gems') && !w.items.every(i => i.type !== 'gem' || i.taken)) left.push('собраны не все кристаллы');
    if (g.includes('exit') && !(w.hero.x === w.exit.x && w.hero.y === w.exit.y)) left.push('герой не дошёл до выхода');
    return 'Программа закончилась, но ' + (left.join(', ') || 'цель не достигнута') + '.';
  }

  // Звёзды: одна за прохождение и по одной за каждую дополнительную цель уровня.
  function bonusMet(level, w, source) {
    return (level.bonus || []).map(b => b.type === 'lines' ? codeLines(source) <= b.max : b.type === 'gems' ? w.items.every(i => i.type !== 'gem' || i.taken) : b.type === 'health' ? w.hero.hp >= b.min : b.type === 'ticks' ? w.ticks <= b.max : b.type === 'clean' ? w.wasted === 0 : false);
  }
  const stars = (level, w, source) => 1 + bonusMet(level, w, source).filter(Boolean).length;
  const bonusText = b => b.type === 'lines' ? `Уложиться в ${b.max} строк кода` : b.type === 'gems' ? 'Собрать все кристаллы' : b.type === 'health' ? `Сохранить не меньше ${b.min} здоровья` : b.type === 'clean' ? 'Ни одного действия впустую: без ударов мимо и столкновений' : `Уложиться в ${b.max} ходов`;

  const api = {PyError, parse, run, makeWorld, heroApi, act, simulate, stars, bonusMet, bonusText, codeLines, goalsMet, unmet, burning, DIR, KIND};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CodeHero = api;
})(typeof window !== 'undefined' ? window : globalThis);
