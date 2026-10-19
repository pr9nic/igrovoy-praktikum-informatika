"""Проверка правил «Сбоя на станции» без сети: время подставляется вручную.
Запуск: python tools/crew/tests/rules_test.py"""
import json, re, sys, types
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'server'))
sys.modules.setdefault('portal_security', types.SimpleNamespace(is_teacher=lambda: True))
sys.modules.setdefault('flask', types.SimpleNamespace(jsonify=lambda **k: k, request=None))
import crew_api as C

bad = 0
def check(name, ok, info=''):
    global bad
    bad += 0 if ok else 1
    print(('ok   ' if ok else 'FAIL ') + name + (' — ' + str(info) if info != '' else ''))

bank = json.loads((HERE.parent / 'server' / 'crew_questions.json').read_text())
def new(n=8, seed=1):
    g = C.Game(bank, seed); ps = []
    for i in range(n):
        room, p = g.join('8 «А»', f'Ученик Номер{chr(1040 + i)}', 100)
        ps.append(p)
    room['settings']['roles'] = False      # особые роли проверяются отдельно
    return g, room, ps

ST = C.WORLDS['station']; TERM, CONS, TABLE = ST['terminals'], ST['consoles'], ST['table']
def right(q):          # правильный ответ на задание любого типа — как его прислал бы клиент
    return {'t': 'answer', 'i': q['sol']} if q['type'] == 'choice' else {'t': 'answer', 'v': q['sol']}
def wrong(q):
    return {'t': 'answer', 'i': (q['sol'] + 1) % 3} if q['type'] == 'choice' else {'t': 'answer', 'v': 'не то'}
for wid, wd in C.WORLDS.items():
    spots = [(x, y) for x, y in wd['terminals']] + [(x, y) for x, y, _ in wd['consoles']]
    seen, queue = {(int(wd['table'][0]), int(wd['table'][1]))}, [(int(wd['table'][0]), int(wd['table'][1]))]
    while queue:
        x, y = queue.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in seen and wd['map'][q[1]][q[0]] == '.': seen.add(q); queue.append(q)
    kinds = [r['kind'] for r in wd['rooms']]
    check(f'карта «{wd["name"]}»: всё связано, терминалы и пульты на полу и достижимы, есть столовая, реактор и электрощит',
          all(s in seen for s in spots) and len(seen) == sum(r.count('.') for r in wd['map']) and len(wd['map']) == wd['h'] and all(len(r) == wd['w'] for r in wd['map'])
          and len(set(spots)) == len(spots) and {'cafe', 'reactor', 'electro'} <= set(kinds) and [c[2] for c in wd['consoles']] == ['reactor', 'reactor', 'lights'] and len(wd['terminals']) >= 20,
          f'{wd["w"]}×{wd["h"]}, комнат {len(wd["rooms"])}, терминалов {len(wd["terminals"])}')
# Задания всех типов: правильный ответ принимается, неправильный — нет, решение игроку не уходит.
import random
for grade in range(6, 12):
    rnd, types = random.Random(grade), {}
    for n in range(400):
        kind = ['input', 'bits', 'order', 'match'][n % 4]; q = C.made_task(grade, rnd, kind); types[q['type']] = types.get(q['type'], 0) + 1
        ok = C.answer_ok(q, {'v': q['sol']}) and not C.answer_ok(q, {'v': 'x'}) and not C.answer_ok(q, {}) and q['show'] and all(k not in C.PUBLIC for k in ('sol', 'show'))
        if q['type'] == 'order': ok = ok and sorted(q['sol']) == list(range(len(q['items']))) and q['sol'] != list(range(len(q['items']))) and len(set(q['items'])) == len(q['items'])
        if q['type'] == 'match': ok = ok and sorted(q['sol']) == [0, 1, 2, 3] and len(set(q['pairs'])) == 4 and len(set(q['left'])) == 4
        if q['type'] == 'bits': ok = ok and len(q['sol']) == q['bits'] and int(q['sol'], 2) == int(re.search(r'число (\d+)', q['q']).group(1))
        if q['type'] == 'input' and 'code' in q:
            import io, contextlib
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf): exec(q['code'], {})
            ok = ok and buf.getvalue().strip() == q['sol']
        if not ok: check(f'задание {grade} класса', False, q); break
    else: check(f'задания {grade} класса: 4 новых типа, ответы сходятся', len(types) == 4, types)
check('ответ с клавиатуры: пробелы, регистр и значок системы счисления не мешают', C.answer_ok({'type': 'input', 'sol': '1011'}, {'v': ' 1011₂ '}) and C.answer_ok({'type': 'input', 'sol': 'БАЙТ'}, {'v': 'байт'}))

import random
rnd = random.Random(5)
ok = True
for grade in range(6, 12):
    for _ in range(400):
        q = C.made_question(grade, rnd)
        ok = ok and len(q['w']) == 2 and q['a'] not in q['w'] and q['w'][0] != q['w'][1] and len(q['q']) <= 60
    ok = ok and all(len(q['w']) == 2 and q['a'] not in q['w'] for q in bank[str(grade)]) and len(bank[str(grade)]) >= 20
check('вопросы: один верный и два разных неверных ответа, для всех классов', ok)

g, room, ps = new(8)
try: g.join('8 «А»', 'Одно', 100); check('имя из одного слова не принимается', False)
except C.Refused: check('имя из одного слова не принимается', True)
again = g.join('8 «А»', 'ученик  номера', 101)[1]
check('тот же ученик возвращается на своё место с новым ключом', again['id'] == ps[0]['id'] and len(room['players']) == 8)
g.rooms['8 «А»']['settings']['minPlayers'] = 4
g.start(room, 100)
imps = [p for p in ps if p['role'] == 'imp']; crew = [p for p in ps if p['role'] == 'crew']
check('роли: при 8 игроках два вредителя, у всех по 5 заданий (у вредителей тоже)', len(imps) == 2 and all(len(p['tasks']) == 5 for p in ps))
v = g.view(room, crew[0], 101, 0); vi = g.view(room, imps[0], 101, 0)
check('игроку не приходят чужие роли', all('role' not in o for o in v['players']) and v['secret']['role'] == 'crew' and vi['secret']['role'] == 'imp' and vi['secret']['partners'] == [imps[1]['name']])
check('ответ сервера для экипажа и вредителя устроен одинаково', sorted(v) == sorted(vi) and sorted(v['me']) == sorted(vi['me']) and sorted(v['secret']) == sorted(vi['secret']))
try: g.join('8 «А»', 'Опоздавший Ученик', 102); check('во время раунда новые игроки ждут', False)
except C.Refused as e: check('во время раунда новые игроки ждут', e.code == 409)

# Задание: верный и неверный ответ.
c = crew[0]; t = c['tasks'][0]; c['x'], c['y'] = TERM[t][0] + 0.5, TERM[t][1] + 1.2
g.act(room, c, {'t': 'use'}, 105); q = c['quiz']
check('у терминала открывается вопрос, ответ в игрока не уходит', q and 'right' not in g.view(room, c, 105, 0)['me']['quiz'])
g.act(room, c, wrong(q), 106)
check('ошибка: задание не засчитано, терминал заблокирован на 4 секунды', c['done'] == [] and c['wrong'] == 1 and c['lock'] > 106)
g.act(room, c, {'t': 'use'}, 107); check('во время блокировки терминал не открывается', c['quiz'] is None)
g.act(room, c, {'t': 'use'}, 111); g.act(room, c, right(c['quiz']), 112)
check('верный ответ: задание выполнено', c['done'] == [t] and c['right'] == 1)
check('шкала заданий до собрания не меняется', g.view(room, c, 113, 0)['progress'] == [0, 30])
i0 = imps[0]; ti = i0['tasks'][0]; i0['x'], i0['y'] = TERM[ti][0] + 0.5, TERM[ti][1] + 1.2
g.act(room, i0, {'t': 'use'}, 113); g.act(room, i0, right(i0['quiz']), 114)
check('вредитель «выполняет» задание так же, но в общий счёт оно не идёт', i0['done'] == [ti] and g.progress(room) == (1, 30))

# Импульс и заражение с задержкой.
victim = crew[1]; victim['x'], victim['y'] = 30, 5; i0['x'], i0['y'] = 31, 5
g.act(room, i0, {'t': 'pulse'}, 115); check('в первые 20 секунд импульс не готов', not victim['infected_at'])
g.act(room, crew[2], {'t': 'pulse'}, 121); check('импульс экипажа виден так же, но никого не заражает', room['pulses'][-1]['id'] == crew[2]['id'] and not any(p['infected_at'] for p in ps))
g.act(room, i0, {'t': 'pulse'}, 121)
check('импульс вредителя заражает ближайшего члена экипажа', victim['infected_at'] == 131 and i0['last'].startswith('заражён') and victim['alive'])
g.tick(room, 125); check('заражённый ещё 10 секунд ходит как обычно', victim['alive'] and not room['bodies'])
victim['x'], victim['y'] = 40, 14; g.tick(room, 131.5)
check('через 10 секунд он отключается там, где оказался', not victim['alive'] and room['bodies'][0]['x'] == 40)
seen_by_alive = next(o for o in g.view(room, crew[2], 133, 0)['players'] if o['id'] == victim['id']); seen_by_ghost = next(o for o in g.view(room, victim, 133, 0)['players'] if o['id'] == victim['id'])
check('живые не узнают об отключении до собрания: в списке он «жив», на карте его просто нет', seen_by_alive['alive'] is True and seen_by_alive.get('gone') is True and seen_by_ghost['alive'] is False)
i1 = imps[1]; i1['x'], i1['y'] = 31, 5.5; g.act(room, i0, {'t': 'pulse'}, 150)
check('напарника заразить нельзя', not i1['infected_at'] and i0['last'].startswith('мимо'))

# Авария.
g.act(room, crew[2], {'t': 'sabotage'}, 150); check('экипаж не может устроить аварию', room['sabotage'] is None)
g.act(room, i0, {'t': 'sabotage'}, 150); check('вредитель устраивает аварию реактора', room['sabotage'] and room['sabotage']['until'] == 200)
for k, fixer in enumerate([crew[2], crew[3]]):
    fixer['x'], fixer['y'] = CONS[k][0] + 0.5, CONS[k][1] + 0.5
    g.act(room, fixer, {'t': 'use'}, 160); g.act(room, fixer, right(fixer['quiz']), 161)
check('двое чинят два пульта — авария снята', room['sabotage'] is None)

# Собрание, чат, голосование.
g.act(room, crew[2], {'t': 'chat', 'text': 'привет'}, 162); check('во время смены живые в чат не пишут', room['chat'][-1]['text'] != 'привет')
g.act(room, victim, {'t': 'chat', 'text': 'меня отключили'}, 162)
check('отключённые общаются в своём чате, живые его не видят', room['chat'][-1]['ch'] == 'ghost' and all(c['text'] != 'меня отключили' for c in g.view(room, crew[2], 163, 0)['chat']) and any(c['text'] == 'меня отключили' for c in g.view(room, victim, 163, 0)['chat']))
r = crew[2]; r['x'], r['y'] = 40.5, 15; g.act(room, r, {'t': 'report'}, 165)
check('на собрании отключение становится известно всем', next(o for o in g.view(room, crew[3], 165, 0)['players'] if o['id'] == victim['id'])['alive'] is False)
check('сообщение об отключённом созывает собрание, шкала обновилась', room['phase'] == 'meeting' and room['meeting']['body'] == victim['name'] and g.view(room, r, 165, 0)['progress'][0] == 1)
g.act(room, r, {'t': 'chat', 'text': 'Это ты дурак и вредитель'}, 166); check('грубость в чате заменяется звёздочками', room['chat'][-1]['text'] == '***')
g.act(room, crew[3], {'t': 'chat', 'text': 'я был в реакторе'}, 167); check('на собрании чат работает', room['chat'][-1]['text'] == 'я был в реакторе' and room['chat'][-1]['ch'] == 'all')
alive = [p for p in ps if p['alive']]
for p in ps: p['seen'] = 170   # на стенде игроки «на связи», если обращались к серверу в последние 20 секунд
for p in alive: g.act(room, p, {'t': 'vote', 'id': i0['id']}, 170)
g.act(room, victim, {'t': 'vote', 'id': crew[3]['id']}, 170)
check('отключённые не голосуют, голос тайный до конца', victim['id'] not in room['meeting']['votes'] and 'votes' not in g.view(room, r, 170, 0)['meeting'])
g.tick(room, 171); check('все проголосовали — вредитель исключён, роль объявлена', room['phase'] == 'result' and not i0['alive'] and 'Это был вредитель' in room['meeting']['result']['text'])
g.tick(room, 179); check('после собрания смена продолжается у стола', room['phase'] == 'play' and not room['bodies'] and all(abs(p['x'] - TABLE[0]) <= 4 for p in ps))
b = crew[3]; b['x'], b['y'] = TABLE; g.act(room, b, {'t': 'report'}, 181); check('кнопка у стола созывает экстренное собрание один раз за раунд', room['phase'] == 'meeting' and b['emergency'] == 0)
for p in ps: p['seen'] = 182
for p in [p for p in ps if p['alive']]: g.act(room, p, {'t': 'vote', 'id': i1['id']}, 182)
g.tick(room, 183); check('оба вредителя исключены — победа экипажа', room['phase'] == 'end' and room['winner'] == 'crew')
e = g.view(room, crew[0], 184, 0); check('в конце роли и счёт видны всем', all('role' in o for o in e['players']) and crew[0]['score'] >= 3)

# Победа вредителей: экипажа мало и авария по времени.
g, room, ps = new(5, 3); room['settings']['minPlayers'] = 4; g.start(room, 100)
imp = next(p for p in ps if p['role'] == 'imp'); crew = [p for p in ps if p['role'] == 'crew']
for k in range(3):
    crew[k]['x'], crew[k]['y'] = 10, 10; imp['x'], imp['y'] = 10.5, 10; imp['pulse_at'] = 0
    g.act(room, imp, {'t': 'pulse'}, 130 + k * 30); crew[k]['x'] = 40; g.tick(room, 141 + k * 30); room['bodies'] = []
check('вредитель один на один с экипажем — победа вредителей', room['phase'] == 'end' and room['winner'] == 'imp', room['phase'])
g, room, ps = new(6, 4); room['settings']['minPlayers'] = 4; g.start(room, 100)
imp = next(p for p in ps if p['role'] == 'imp'); g.act(room, imp, {'t': 'sabotage'}, 140); g.tick(room, 191)
check('реактор не починили за 50 секунд — победа вредителей', room['winner'] == 'imp' and 'реактор' in room['why'])
g, room, ps = new(5, 5); room['settings'].update(minPlayers=4, tasks=3); g.start(room, 100)
for p in ps:
    if p['role'] == 'crew':
        for t in p['tasks']:
            p['x'], p['y'] = TERM[t][0] + 0.5, TERM[t][1] + 0.5
            g.act(room, p, {'t': 'use'}, 110); g.act(room, p, right(p['quiz']), 111)
check('все задания экипажа выполнены — победа экипажа', room['winner'] == 'crew' and 'задания' in room['why'])
for p in ps: p['seen'] = 199
g.start(room, 200); check('новый раунд: роли и задания розданы заново, счёт сохраняется', room['round'] == 2 and room['phase'] == 'play' and sum(p['score'] for p in ps) > 0)

# ---------- пульт учителя ----------
g, room, ps = new(6, 7); g.command(room, 'start', {'imps': [ps[2]['id']]}, 100)
check('учитель назначает вредителя сам', [p['id'] for p in ps if p['role'] == 'imp'] == [ps[2]['id']])
imp, crew = ps[2], [p for p in ps if p['role'] == 'crew']
imp['x'], imp['y'] = crew[0]['x'], crew[0]['y']; g.act(room, imp, {'t': 'pulse'}, 121)
g.command(room, 'pause', {}, 125); g.tick(room, 400)
check('пауза: таймеры стоят, заражённый не отключается', room['paused'] and crew[0]['alive'] and g.view(room, crew[1], 400, 0)['paused'] is True and g.view(room, imp, 400, 0)['me']['pulse'] == g.view(room, imp, 125, 0)['me']['pulse'])
g.command(room, 'pause', {}, 400); g.tick(room, 403); alive_before = crew[0]['alive']; g.tick(room, 407)
check('после паузы игра идёт с того же места', alive_before and not crew[0]['alive'] and not room['paused'])
g.command(room, 'revive', {'id': crew[0]['id']}, 408); check('учитель возвращает игрока в строй', crew[0]['alive'] and not room['bodies'])
g.command(room, 'meeting', {}, 410); check('учитель созывает собрание', room['phase'] == 'meeting' and room['meeting']['reason'] == 'teacher' and room['meeting']['by'] == 0)
g.act(room, crew[1], {'t': 'chat', 'text': 'первое'}, 411); g.command(room, 'mute', {'id': crew[1]['id']}, 412); g.act(room, crew[1], {'t': 'chat', 'text': 'второе'}, 415)
texts = [c['text'] for c in room['chat']]; check('игрок без чата писать не может', 'первое' in texts and 'второе' not in texts)
mid = next(c['id'] for c in room['chat'] if c['text'] == 'первое'); g.command(room, 'delmsg', {'msg': mid}, 416)
check('учитель удаляет сообщение у всех', 'первое' not in [c['text'] for c in room['chat']] and mid in g.view(room, crew[2], 416, 0)['deleted'])
g.command(room, 'announce', {'text': 'Тише, пожалуйста'}, 417); check('объявление учителя видят все, включая отключённых', all(any(c['ch'] == 'teacher' for c in g.view(room, p, 417, 0)['chat']) for p in ps))
g.act(room, crew[2], {'t': 'vote', 'id': imp['id']}, 418); tv = g.teacher_view(room, 418); check('учитель видит, кто за кого голосовал', tv['meeting']['votes'] == [{'who': crew[2]['name'], 'for': imp['name']}])
g.command(room, 'endvote', {}, 419); check('учитель завершает голосование досрочно', room['phase'] in ('result', 'end'))
if room['phase'] == 'end': g.command(room, 'start', {}, 420)
else: g.command(room, 'next', {}, 420)
check('после итога игра продолжается по команде учителя', room['phase'] == 'play')
g.command(room, 'sabotage', {}, 421); ok1 = bool(room['sabotage']); g.command(room, 'unsabotage', {}, 422); check('учитель устраивает и отменяет аварию', ok1 and not room['sabotage'])
victim = next(p for p in ps if p['role'] == 'crew' and p['alive']); g.command(room, 'out', {'id': victim['id']}, 423); check('учитель отключает игрока', not victim['alive'] and room['phase'] in ('play', 'end'))
if room['phase'] != 'play': g.command(room, 'start', {}, 424)
g.command(room, 'win', {'side': 'imp'}, 425); check('учитель завершает раунд победой стороны', room['phase'] == 'end' and room['winner'] == 'imp')
n = len(room['players']); g.command(room, 'kick', {'id': ps[5]['id']}, 426); check('учитель убирает игрока в любой момент', len(room['players']) == n - 1)
g.command(room, 'resetscores', {}, 427); check('очки обнуляются', all(p['score'] == 0 and p['wins'] == 0 for p in room['players'].values()))
g.command(room, 'settings', {'settings': {'sabotage': False, 'emergency': 0, 'sabotageTime': 999, 'tasks': 'x'}}, 428); s = room['settings']
check('настройки: новые поля принимаются, границы соблюдаются, мусор отбрасывается', s['sabotage'] is False and s['emergency'] == 0 and s['sabotageTime'] == 90 and isinstance(s['tasks'], int))
for p in room['players'].values(): p['seen'] = 429
g.command(room, 'start', {}, 430); imp = next(p for p in room['players'].values() if p['role'] == 'imp'); g.act(room, imp, {'t': 'sabotage'}, 500)
check('авария выключена настройкой — вредитель её не устроит; экстренных собраний 0', not room['sabotage'] and all(p['emergency'] == 0 for p in room['players'].values()) and g.view(room, imp, 500, 0)['secret']['sabotage'] == -2)
g.command(room, 'lock', {}, 501); g.command(room, 'stop', {}, 502)
def refused(fn):
    try: fn(); return False
    except C.Refused: return True
check('вход в комнату закрыт: новый ученик не войдёт, прежний вернётся', refused(lambda: g.join('8 «А»', 'Новый Ученик', 503)) and g.join('8 «А»', ps[0]['name'], 503)[1]['id'] == ps[0]['id'])
g.command(room, 'lock', {}, 504); g.open = False
check('игра закрыта для всех классов', refused(lambda: g.join('9 «Б»', 'Другой Ученик', 505)))
g.open = True; o = g.overview(506); check('обзор сервера: комнаты, карта, состояние', o['server']['open'] and [r['className'] for r in o['rooms']] == ['8 «А»'] and set(o['worlds']) == {'station', 'sea', 'moon'})

# ---------- свет и выбор карты ----------
g, room, ps = new(6, 9); g.command(room, 'settings', {'settings': {'map': 'moon'}}, 100); g.command(room, 'start', {}, 100); wd = C.WORLDS['moon']
check('учитель выбирает карту: раунд идёт на лунной базе, игроки стоят у её стола', room['map'] == 'moon' and g.view(room, ps[0], 100, 0)['world'] == 'moon' and all(abs(p['x'] - wd['table'][0]) <= 4 and wd['map'][int(p['y'])][int(p['x'])] == '.' for p in ps))
imp = next(p for p in ps if p['role'] == 'imp'); crew = [p for p in ps if p['role'] == 'crew']
g.act(room, imp, {'t': 'sabotage', 'kind': 'lights'}, 140); v = g.view(room, crew[0], 141, 0)
check('вредитель гасит свет: авария вида lights, без проигрыша по времени', v['sabotage'] and v['sabotage']['kind'] == 'lights')
lx, ly, _ = wd['consoles'][2]; crew[0]['x'], crew[0]['y'] = wd['consoles'][0][0] + 0.5, wd['consoles'][0][1] + 0.5; g.act(room, crew[0], {'t': 'use'}, 142)
check('пульт реактора свет не чинит', not crew[0]['quiz'] or crew[0]['quiz']['kind'] != 'fix'); crew[0]['quiz'] = None
crew[0]['x'], crew[0]['y'] = lx + 0.5, ly + 0.5; g.act(room, crew[0], {'t': 'use'}, 143); ok1 = crew[0]['quiz'] and crew[0]['quiz']['kind'] == 'fix'; g.act(room, crew[0], right(crew[0]['quiz']), 144)
check('свет чинит один игрок у щитка', ok1 and room['sabotage'] is None and room['phase'] == 'play')
g.command(room, 'sabotage', {'kind': 'lights'}, 200); g.tick(room, 276); check('свет включается сам через 75 секунд, раунд продолжается', room['sabotage'] is None and room['phase'] == 'play')
g.command(room, 'settings', {'settings': {'map': 'подвал'}}, 300); check('неизвестная карта не принимается', room['settings']['map'] == 'moon')
g.command(room, 'stop', {}, 301); g.command(room, 'settings', {'settings': {'map': 'random'}}, 302)
for p in ps: p['seen'] = 303
g.command(room, 'start', {}, 304); check('случайная карта выбирается при запуске', room['map'] in C.WORLDS)
pub = g.view(room, ps[0], 305, 0); ps[0]['x'], ps[0]['y'] = [c + 0.5 for c in C.WORLDS[room['map']]['terminals'][ps[0]['tasks'][0]]]; g.act(room, ps[0], {'t': 'use'}, 330); q = g.view(room, ps[0], 331, 0)['me']['quiz']
check('игроку уходит задание без решения', q and 'sol' not in q and 'show' not in q and q['type'] in ('choice', 'input', 'bits', 'order', 'match') and q['n'] > 0, q['type'] if q else '')
g, room, ps = new(12, 11); g.command(room, 'settings', {'settings': {'imposters': 4}}, 100); g.command(room, 'start', {}, 100)
check('учитель задаёт число вредителей: 4 из 12', sum(p['role'] == 'imp' for p in ps) == 4)
g, room, ps = new(5, 12); g.command(room, 'settings', {'settings': {'imposters': 6}}, 100); g.command(room, 'start', {}, 100)
check('вредителей не больше, чем меньше половины игроков: 2 из 5', sum(p['role'] == 'imp' for p in ps) == 2 and room['settings']['imposters'] == 6)

# ---------- особые роли, двери, камеры, отметки ----------
g, room, ps = new(8, 21); room['settings']['roles'] = True; g.command(room, 'start', {}, 100); wd = C.WORLDS[room['map']]
eng = [p for p in ps if p['job'] == 'engineer']; med = [p for p in ps if p['job'] == 'medic']; imp = next(p for p in ps if p['role'] == 'imp')
check('особые роли: один инженер и один медик, оба из экипажа; секрет виден только им', len(eng) == 1 and len(med) == 1 and eng[0]['role'] == med[0]['role'] == 'crew' and g.view(room, eng[0], 101, 0)['secret']['job'] == 'engineer'
      and g.view(room, imp, 101, 0)['secret']['job'] == '' and all('job' not in o for o in g.view(room, eng[0], 101, 0)['players']))
g.command(room, 'sabotage', {'kind': 'lights'}, 140); lx, ly, _ = wd['consoles'][2]; eng[0]['x'], eng[0]['y'] = lx + 0.5, ly + 0.5; g.act(room, eng[0], {'t': 'use'}, 141)
check('инженер чинит аварию без задания', room['sabotage'] is None and eng[0]['quiz'] is None)
victim = next(p for p in ps if p['role'] == 'crew' and not p['job']); imp['x'], imp['y'] = victim['x'], victim['y']; imp['pulse_at'] = 0; g.act(room, imp, {'t': 'pulse'}, 150); was = victim['infected_at']
med[0]['x'], med[0]['y'] = victim['x'] + 1, victim['y']; med[0]['pulse_at'] = 0; g.act(room, med[0], {'t': 'pulse'}, 152); g.tick(room, 175)
check('медик импульсом лечит заражённого рядом: тот не отключается', was > 0 and victim['infected_at'] == 0 and victim['alive'] and med[0]['last'].startswith('вылечен'))
g.act(room, imp, {'t': 'sabotage', 'kind': 'doors'}, 200); v = g.view(room, victim, 201, 0)
check('вредитель запирает двери: авария вида doors на 15 секунд', v['sabotage'] and v['sabotage']['kind'] == 'doors' and v['sabotage']['left'] == 14)
g.tick(room, 216); check('двери открываются сами, раунд продолжается', room['sabotage'] is None and room['phase'] == 'play')
for wid, w in C.WORLDS.items():
    rooms_in = lambda x, y: any(r['x'] <= x < r['x'] + r['w'] and r['y'] <= y < r['y'] + r['h'] for r in w['rooms'])
    cam = w['cams']
    check(f'карта {wid}: двери стоят в коридорах у входов, пост наблюдения — на полу мостика, камер 4', len(w['doors']) >= 20 and all(w['map'][y][x] == '.' and not rooms_in(x, y) for x, y in w['doors'])
          and w['map'][cam['y']][cam['x']] == '.' and len(cam['rooms']) == 4 and (cam['x'], cam['y']) not in w['terminals'], len(w['doors']))
cam = wd['cams']; victim['x'], victim['y'] = cam['x'] + 0.5, cam['y'] + 1.2; g.act(room, victim, {'t': 'cams', 'on': True}, 220); on1 = g.view(room, imp, 221, 0)['watch']
victim['x'] += 8; victim['seen'] = 222; g.tick(room, 222); check('камеры: все видят, что за ними кто-то следит; отошёл — выключились', on1 is True and g.view(room, imp, 223, 0)['watch'] is False)
far = next(p for p in ps if p is not victim); far['x'], far['y'] = cam['x'] + 9, cam['y']; g.act(room, far, {'t': 'cams', 'on': True}, 224); check('издалека камеры не включить', far['cams'] is False)
# Отметки: по верным ответам за урок и точности.
g, room, ps = new(5, 22); g.command(room, 'start', {}, 100)
for p, (r, w) in zip(ps, [(13, 2), (13, 9), (9, 1), (5, 20), (2, 0)]): p['right'], p['wrong'] = r, w
live = {m['name']: m['mark'] for m in g.marks(room, [4, 8, 12])}; g.command(room, 'win', {'side': 'crew'}, 110); done = {m['name']: m for m in g.marks(room, [4, 8, 12])}
check('отметки: 5 за 12+ верных при точности 70 %, 4 за 8+ при 50 %, 3 за 4+, меньше — без отметки', [done[p['name']]['mark'] for p in ps] == [5, 4, 4, 3, 0] and live == {k: v['mark'] for k, v in done.items()}, [done[p['name']]['mark'] for p in ps])
for p in ps: p['seen'] = 119
g.command(room, 'start', {}, 120); ps[4]['right'] = 3; g.command(room, 'stop', {}, 130)
check('ответы копятся за урок, в том числе из остановленного раунда', g.marks(room, [4, 8, 12])[[m['name'] for m in g.marks(room, [4, 8, 12])].index(ps[4]['name'])]['right'] == 5 and ps[4]['rounds'] == 2)
g, room, ps = new(6, 31); g.command(room, 'start', {}, 100); imp = next(p for p in ps if p['role'] == 'imp'); v = next(p for p in ps if p['role'] == 'crew'); v['alive'] = False
sc = g.screen(room, 101); flat = json.dumps(sc, ensure_ascii=False)
check('экран проектора: нет ролей, координат и тайного отключения', 'role' not in flat and '"x"' not in flat and not any(p['out'] for p in sc['players']) and sc['phase'] == 'play')
g.command(room, 'win', {'side': 'crew'}, 102); sc = g.screen(room, 103); check('в конце раунда проектор раскрывает роли', all('role' in p for p in sc['players']) and sc['winner'] == 'crew')
# Смена локации и начало раунда: все игроки стоят на полу новой карты и браузер получает команду взять новое место.
floor = lambda w, p: C.WORLDS[w]['map'][int(p['y'])][int(p['x'])] == '.'
for world in C.WORLDS:
    g, room, ps = new(8, 77); [p.update(x=3.5, y=3.5) for p in ps]
    g.command(room, 'settings', {'settings': {'map': world}}, 100)
    check(f'смена локации на «{world}» в лобби: все перенесены на пол у стола новой карты', room['map'] == world and all(floor(world, p) and p.get('moved') for p in ps))
    [p.pop('moved', None) for p in ps]; g.command(room, 'start', {}, 101)
    check(f'начало раунда на «{world}»: все на полу и браузер получает новое место (moved)', all(floor(world, p) and p.get('moved') for p in ps))
# --- старт раунда голосованием игроков и итог раунда
g, room, ps = new(6)
for p in ps: p['seen'] = 200
g.act(room, ps[0], {'t': 'ready'}, 200); g.act(room, ps[1], {'t': 'ready'}, 200); g.act(room, ps[2], {'t': 'ready'}, 200)
v = g.view(room, ps[0], 200, 0)['ready']
check('голосование за старт: 3 из 6 — мало (нужно больше половины)', v['votes'] == 3 and v['need'] == 4 and v['startIn'] == -1 and v['mine'], v)
g.act(room, ps[3], {'t': 'ready'}, 201); check('четвёртый голос — обратный отсчёт 5 секунд', room['start_at'] == 206 and any('проголосовал' in c['text'] for c in room['chat']))
g.act(room, ps[3], {'t': 'ready'}, 202); check('голос отозван — старт отменён', room['start_at'] == 0)
g.act(room, ps[3], {'t': 'ready'}, 203); g.tick(room, 205); check('до конца отсчёта раунд не начинается', room['phase'] == 'lobby')
for p in ps: p['seen'] = 208
g.tick(room, 208); check('отсчёт закончился — раунд начался сам, голоса сброшены', room['phase'] == 'play' and room['ready'] == set() and room['start_at'] == 0)
imps = [p['name'] for p in ps if p['role'] == 'imp']
g.finish(room, 'crew', 'все вредители найдены.', 220)
ve = g.view(room, ps[0], 220, 0)
check('итог раунда: кто был вредителем и кто победил — всем игрокам', ve['imps'] == imps and sorted(ve['winners']) == sorted(p['name'] for p in ps if p['role'] == 'crew'), (ve['imps'], ve['winners']))
check('итог и вредители — в общем чате', any('Вредители: ' + ', '.join(imps) in c['text'] for c in room['chat']))
check('на проекторе и пульте тоже видно вредителей и победителей', g.screen(room, 220)['imps'] == imps and g.teacher_view(room, 220)['winners'] == ve['winners'])
check('во время раунда список вредителей скрыт', g.view(room, ps[0], 210, 0)['imps'] == [] or room['phase'] == 'end')
room2, late = g.join('8 «А»', 'Опоздавший Новичок', 221); check('после конца раунда новый игрок может войти до следующего', late['id'] in room['players'])
for p in ps: g.act(room, p, {'t': 'ready'}, 222)
for p in ps: p['seen'] = 226
g.tick(room, 228); check('новый раунд после итогов тоже запускается голосованием', room['phase'] == 'play' and room['round'] == 2)
room['settings']['voteStart'] = False; room['phase'] = 'lobby'; g.act(room, ps[0], {'t': 'ready'}, 230)
check('учитель может выключить голосование: тогда старт только с пульта', room['start_at'] == 0 and not g.view(room, ps[0], 230, 0)['ready']['on'])
print('FAILED %d' % bad if bad else 'ALL OK'); sys.exit(bad)
