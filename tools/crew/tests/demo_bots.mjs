// Показ «Сбоя на станции» без класса: программные игроки, которые ходят, решают задания, голосуют и пишут в чат.
// Запуск: node tools/crew/tests/demo_bots.mjs ["11 «К»"] [число ботов] [минут]. В журнал ничего не пишется: комнаты живут в памяти сервера.
const BASE = process.env.CREW_BASE || 'http://portal.school.local', CLASS = process.argv[2] || '11 «К»', COUNT = Number(process.argv[3]) || 6, MINUTES = Number(process.argv[4]) || 45;
const NAMES = ['Бот Ада', 'Бот Тьюринг', 'Бот Лавлейс', 'Бот Нейман', 'Бот Хоппер', 'Бот Дейкстра', 'Бот Кнут', 'Бот Шеннон', 'Бот Ершов', 'Бот Лебедев'];
const TALK = ['я был в серверной, решал задание', 'кто был у реактора?', 'видел кого-то рядом с ним перед отключением', 'у меня осталось два задания', 'я шёл из лаборатории, никого не видел', 'подозрительно, что он молчит', 'давайте не будем голосовать наугад', 'я пропущу, мало доказательств', 'он стоял у терминала и ничего не делал'];
const post = async (path, body) => { const r = await fetch(`${BASE}/results/api/crew/${path}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}); return {code: r.status, ...(await r.json().catch(() => ({})))}; };
const rnd = n => Math.floor(Math.random() * n), pickOne = a => a[rnd(a.length)];
let worlds = null, world = null;
function route(from, to) {                      // поиск в ширину по клеткам карты
  const key = (x, y) => y * 100 + x, start = [Math.floor(from.x), Math.floor(from.y)], goal = [Math.floor(to[0]), Math.floor(to[1])], prev = new Map([[key(...start), null]]), queue = [start];
  while (queue.length) { const [x, y] = queue.shift(); if (x === goal[0] && y === goal[1]) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (world.map[ny]?.[nx] === '.' && !prev.has(key(nx, ny))) { prev.set(key(nx, ny), [x, y]); queue.push([nx, ny]); } } }
  const path = []; let at = goal; while (at && prev.has(key(...at))) { path.unshift([at[0] + 0.5, at[1] + 0.5]); at = prev.get(key(...at)); } return path.slice(1);
}
async function bot(name) {
  let me = null, view = null, pos = {x: 22, y: 16}, path = [], acts = [], chat = 0, quizAt = 0, voteAt = 0, talkAt = 0, phase = '', idle = 0;
  const join = async () => { const d = await post('join', {className: CLASS, name}); if (d.status !== 'ok') return false; me = d; worlds = d.worlds || {station: {map: d.map, terminals: d.terminals, consoles: (d.consoles || []).map(c => [c[0], c[1], 'reactor']), table: d.table}}; world = worlds[d.world] || worlds.station; return true; };
  while (Date.now() < END) {
    await new Promise(r => setTimeout(r, 250));
    if (!me) { if (!await join()) await new Promise(r => setTimeout(r, 3000)); continue; }
    const d = await post('sync', {className: CLASS, id: me.id, token: me.token, x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), acts, chat}).catch(() => null); acts = [];
    if (!d) continue; if (d.code === 401) { me = null; continue; } if (d.status !== 'ok') continue;
    view = d; chat = d.chatId; const now = Date.now(); if (d.world && worlds[d.world] && worlds[d.world] !== world) { world = worlds[d.world]; path = []; }
    if (d.me.moved || d.phase !== 'play') { pos = {x: d.me.x, y: d.me.y}; path = []; }
    if (d.phase !== phase) { phase = d.phase; if (phase === 'meeting') { talkAt = now + 3000 + rnd(15000); voteAt = now + 12000 + rnd(Math.max(1, d.meeting.left * 1000 - 20000)); } }
    if (d.phase === 'meeting' && d.me.alive) {
      if (talkAt && now > talkAt) { talkAt = Math.random() < 0.4 ? now + 8000 + rnd(10000) : 0; acts.push({t: 'chat', text: pickOne(TALK)}); }
      if (voteAt && now > voteAt && d.meeting.mine == null) { voteAt = 0; const others = d.players.filter(p => p.alive && p.id !== me.id); acts.push({t: 'vote', id: Math.random() < 0.3 ? 'skip' : pickOne(others).id}); }
    }
    if (d.phase !== 'play' || d.paused) continue;
    if (d.me.quiz) { if (!quizAt) quizAt = now + 2500 + rnd(3500); else if (now > quizAt) { quizAt = 0; const q = d.me.quiz, type = q.type || 'choice', mix = n => [...Array(n).keys()].sort(() => Math.random() - 0.5);
      // Решения бот не знает: отвечает наугад, поэтому ошибается чаще ученика.
      acts.push(type === 'choice' ? {t: 'answer', i: rnd(3)} : {t: 'answer', v: type === 'input' ? String(rnd(40)) : type === 'bits' ? Array.from({length: q.bits}, () => rnd(2)).join('') : mix(type === 'order' ? q.items.length : q.left.length)}); } continue; }
    const dist = (x, y) => Math.hypot(x - pos.x, y - pos.y), imp = d.secret.role === 'imp';
    if (d.me.alive) { const body = d.bodies.find(b => dist(b.x, b.y) < 2.6); if (body && !imp) { acts.push({t: 'report'}); continue; } }
    // Вредитель, когда импульс готов, идёт к ближайшему игроку; остальные дают импульс просто так, чтобы он не выделялся.
    if (d.me.alive && d.me.pulse === 0) { const near = d.players.filter(p => p.id !== me.id && p.alive && p.on && !p.gone).sort((a, b) => dist(a.x, a.y) - dist(b.x, b.y))[0];
      if (imp && near && dist(near.x, near.y) < 2.2) acts.push({t: 'pulse'}); else if (imp && near && !path.goalPlayer) { path = route(pos, [near.x, near.y]); path.goalPlayer = true; } else if (!imp && Math.random() < 0.02) acts.push({t: 'pulse'}); }
    if (imp && d.secret.sabotage === 0 && Math.random() < 0.004) acts.push({t: 'sabotage', kind: Math.random() < 0.5 ? 'lights' : 'reactor'});
    if (!path.length) {
      const todo = d.me.tasks.filter(t => !t.done), fix = d.sabotage && !imp ? world.consoles.find((c, i) => (c[2] || 'reactor') === (d.sabotage.kind || 'reactor') && !d.sabotage.fixed.includes(i)) : null;
      const target = fix || (todo.length ? world.terminals[todo[0].i] : pickOne(world.terminals));
      if (dist(target[0] + 0.5, target[1] + 0.5) < 1.2) { if (fix || todo.length) { if (d.me.lock <= 0 && ++idle > 4) { idle = 0; acts.push({t: 'use'}); } } else path = route(pos, pickOne(world.terminals)); }
      else path = route(pos, target);
    }
    // Шаг по маршруту: 4,6 клетки в секунду, как у ученика.
    let step = 5.2 * 0.26; while (path.length && step > 0) { const [tx, ty] = path[0], dd = dist(tx, ty); if (dd <= step) { pos.x = tx; pos.y = ty; step -= dd; const flag = path.goalPlayer; path.shift(); path.goalPlayer = flag && path.length > 0; } else { pos.x += (tx - pos.x) / dd * step; pos.y += (ty - pos.y) / dd * step; step = 0; } }
  }
}
const END = Date.now() + MINUTES * 60000;
console.log(`Боты входят в комнату ${CLASS} на ${BASE}: ${COUNT} игроков на ${MINUTES} минут.`);
await Promise.all(NAMES.slice(0, COUNT).map((n, i) => new Promise(r => setTimeout(r, i * 150)).then(() => bot(n))));
console.log('Показ окончен.');
