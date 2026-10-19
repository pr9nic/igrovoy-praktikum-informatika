"""«Битва класса» (аналог Wayground): библиотека, все типы вопросов, режимы, усилители, «Восхождение», отчёты — на Flask-клиенте."""
import sys, tempfile, random, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(ROOT / 'tools/battle/server'), '/srv/school4/test-results-app']
import battle_api as B
from flask import Flask
teacher = [False]; B.is_teacher = lambda: teacher[0]
tmp = Path(tempfile.mkdtemp())
app = Flask(__name__); B.install_battle(app, tmp); c = app.test_client(); G = app.battle_game; fails = 0
def check(name, ok, info=''):
    global fails; print(('ok ' if ok else 'FAIL ') + name + ('' if ok else f' — {info}')); fails += not ok
P = lambda path, **k: c.post('/results/api/battle/' + path, json=k)
T = lambda **k: P('teacher', **k)
# --- проверка ответов: решение сервера всегда засчитывается, перемешанный «не тот» ответ — нет
demo = json.loads((ROOT / 'tools/battle/server/battle_demo.json').read_text())
quiz = B.clean_quiz(demo); bad = []
for q in quiz['questions']:
    for seed in range(15):
        v, key = B.view(q, random.Random(seed), True); sol = B.solution(q, key)
        if q['type'] in B.UNGRADED: continue
        ans = sol
        if q['type'] == 'hotspot': ans = {'x': sol[0]['x'], 'y': sol[0]['y']}
        if q['type'] in ('fill', 'math'): ans = sol.split(' ')[0]
        if B.grade(q, key, ans) != 1.0: bad.append((q['type'], seed, sol))
        wrong = {'single': lambda: (sol + 1) % len(v['options']), 'multi': lambda: [], 'fill': lambda: 'нет', 'math': lambda: '1', 'match': lambda: sol[1:] + sol[:1],
                 'reorder': lambda: sol[1:] + sol[:1], 'categorize': lambda: [1 - x for x in sol], 'dragdrop': lambda: sol[1:] + sol[:1], 'dropdown': lambda: [(x + 1) % 2 for x in sol],
                 'label': lambda: sol[1:] + sol[:1], 'hotspot': lambda: {'x': 1, 'y': 1}, 'graph': lambda: [[0, 0]]}[q['type']]()
        if B.grade(q, key, wrong) == 1.0: bad.append(('wrong', q['type'], seed))
check('все 12 оцениваемых типов: верный ответ — 1, неверный — меньше', not bad, bad[:3])
check('частичный балл: из трёх верных выбраны два — частично', 0 < B.grade(quiz['questions'][2], {'o': [0, 1, 2, 3, 4]}, [0, 1]) < 1)
check('числа: «3072», «3 072», дробь 1/4 и запятая', B.number('3 072') == 3072 and B.number('1/4') == 0.25 and B.number('0,5') == 0.5 and B.number('abc') is None)
check('ответ в поле: регистр, ё и пробелы не важны', B.norm(' Восемь! ') == B.norm('восемь'))
for broken, why in [({'title': 'x', 'questions': [{'type': 'single', 'text': 'a', 'options': ['1', '1'], 'answer': 0}]}, 'повтор вариантов'),
                    ({'title': 'x', 'questions': [{'type': 'dragdrop', 'text': 'без пропусков'}]}, 'нет пропусков'),
                    ({'title': 'x', 'questions': [{'type': 'label', 'text': 'a', 'spots': []}]}, 'нет картинки'),
                    ({'title': 'x', 'questions': [{'type': 'slide', 'text': 'a'}]}, 'только слайды')]:
    try: B.clean_quiz(broken); check('редактор отклоняет: ' + why, False)
    except B.Refused: check('редактор отклоняет: ' + why, True)
# --- библиотека
check('библиотека закрыта для учеников', P('library').status_code == 403)
teacher[0] = True; lib = P('library').get_json()['quizzes']
check('в библиотеке демонстрация и разминки для 6–11 классов', len(lib) == 7 and any(len(x['types']) == 17 for x in lib), [(x['title'], len(x['types'])) for x in lib])
demo_id = next(x['id'] for x in lib if len(x['types']) == 17)
small = {'title': 'Тест: три вопроса', 'grade': 8, 'questions': [{'type': 'single', 'text': f'Вопрос {i}', 'options': ['да', 'нет', 'может'], 'answer': 0, 'time': 20} for i in range(6)]}
qid = P('save', quiz=small).get_json()['id']; small['title'] = 'Шесть вопросов'; P('save', quiz=small, id=qid)
check('викторина сохраняется и правится', P('quiz', id=qid).get_json()['quiz']['title'] == 'Шесть вопросов')
# --- классика
A = '8 «А»'
r = T(className=A, action='open', quiz=qid, mode='classic', settings={'attempts': 2}).get_json(); check('учитель открыл игру: лобби', r['phase'] == 'lobby')
teacher[0] = False
check('ученик видит открытую игру класса', P('status', className=A).get_json()['open'])
s1 = P('join', className=A, name='Ученик Один').get_json(); s2 = P('join', className=A, name='Ученица Два').get_json()
S = lambda who, path='sync', **k: P(path, className=A, key=who['key'], token=who['token'], **k).get_json()
check('в лобби видны имена', S(s1)['names'] == ['Один У.', 'Два У.'])
check('ученик не может начать игру', T(className=A, action='start').status_code == 403)
teacher[0] = True; T(className=A, action='start'); teacher[0] = False
room = G.rooms[A]
def right(who):
    p = room['players'][who['key']]; qid_ = G.current(room, p); G.question(room, p, qid_, __import__('time').time()); return qid_, B.solution(room['qmap'][qid_], p['keys'][qid_]['key'])
v = S(s1, ready=True); check('вопрос пришёл без ответа', 'q' in v and 'answer' not in v['q'] and v['q']['limit'] == 20)
q0, sol = right(s1); res = P('answer', className=A, key=s1['key'], token=s1['token'], q=q0, answer=sol).get_json()
check('верный ответ: очки, решение и пояснение не мешают', res['ok'] and res['pts'] >= 500 and res['solution'] == sol)
q0b, solb = right(s2); room['players'][s2['key']]['shown'][q0b] -= 15
res2 = P('answer', className=A, key=s2['key'], token=s2['token'], q=q0b, answer=solb).get_json(); check('медленный ответ — меньше очков', res2['pts'] < res['pts'], (res['pts'], res2['pts']))
for _ in range(2):
    qx, sx = right(s1); res = P('answer', className=A, key=s1['key'], token=s1['token'], q=qx, answer=sx).get_json()
check('серия из трёх верных — усилитель', 'power' in res and len(S(s1)['inventory']) == 1, res)
pw = room['players'][s1['key']]['inventory']; pw[:] = ['fifty', 'immunity', 'gift']
qx, sx = right(s1); rr = P('power', className=A, key=s1['key'], token=s1['token'], kind='fifty').get_json()
check('«50 на 50» убирает неверный вариант (из трёх — один)', len(rr['removed']) == 1 and sx not in rr['removed'], rr)
P('power', className=A, key=s1['key'], token=s1['token'], kind='immunity'); w = P('answer', className=A, key=s1['key'], token=s1['token'], q=qx, answer=(sx + 1) % 3).get_json()
check('щит: после ошибки — ещё попытка', w.get('retry') is True, w)
before = room['players'][s2['key']]['score']; P('power', className=A, key=s1['key'], token=s1['token'], kind='gift')
check('подарок: всем остальным +150 и сообщение', room['players'][s2['key']]['score'] == before + 150 and any('дарит' in e['text'] for e in S(s2)['events']))
P('answer', className=A, key=s1['key'], token=s1['token'], q=qx, answer=sx)
for _ in range(2):
    qx, sx = right(s1); P('answer', className=A, key=s1['key'], token=s1['token'], q=qx, answer=(sx + 1) % 3)
v = S(s1, ready=True); check('после последнего вопроса — вопрос-реванш по ошибке', v.get('q', {}).get('redemption') is True, v.get('q'))
qx, sx = right(s1); P('answer', className=A, key=s1['key'], token=s1['token'], q=qx, answer=sx); v = S(s1)
check('реванш пройден — итог и можно сыграть ещё (2 попытки)', v['done'] and v['summary']['canRetry'], v.get('summary'))
P('retry', className=A, key=s1['key'], token=s1['token']); check('вторая попытка начинается заново', not S(s1)['done'] and S(s1)['attempt'] == 2)
teacher[0] = True; g = T(className=A, action='screen').get_json()
check('учитель видит таблицу ученик × вопрос и точность по вопросам', len(g['players']) == 2 and len(g['players'][0]['cells']) == 6 and sum(x['n'] for x in g['qstats']) >= 1)
T(className=A, action='pause', on=True); teacher[0] = False
qx, sx = right(s2); check('на паузе ответить нельзя', P('answer', className=A, key=s2['key'], token=s2['token'], q=qx, answer=sx).status_code == 400)
teacher[0] = True; T(className=A, action='pause', on=False); T(className=A, action='kick', key=s2['key']); teacher[0] = False
check('убранный ученик не войдёт снова', P('join', className=A, name='Ученица Два').status_code == 403)
teacher[0] = True; end = T(className=A, action='end').get_json(); rid = end['result']
rep = P('result', id=rid).get_json()['result']; check('итог игры сохранён в отчёт', rep['title'] == 'Шесть вопросов' and len(rep['players']) == 1 and P('results').get_json()['results'][0]['id'] == rid)
T(className=A, action='close')
# --- «Восхождение»
r = T(className=A, action='open', quiz=qid, mode='peak', settings={'goal': 50}).get_json(); teacher[0] = False
c1 = P('join', className=A, name='Альпинист Первый').get_json(); teacher[0] = True; T(className=A, action='start'); teacher[0] = False; room = G.rooms[A]
S1 = lambda **k: P('sync', className=A, key=c1['key'], token=c1['token'], **k).get_json()
p = room['players'][c1['key']]
qa, sa = right(c1); P('answer', className=A, key=c1['key'], token=c1['token'], q=qa, answer=(sa + 1) % 3)
check('«Восхождение»: ошибка возвращается позже в очередь', qa in p['queue'][1:4] and p['queue'][0] != qa, p['queue'])
answered = 1
while not p['brk']:
    qx, sx = right(c1); P('answer', className=A, key=c1['key'], token=c1['token'], q=qx, answer=sx); answered += 1
v = S1(); check('после пяти ответов — привал: три усилителя и мини-игра', answered == 5 and len(v['brk']['offers']) == 3 and v['brk']['game'] in B.MINIS and 'q' not in v, v.get('brk'))
P('break', className=A, key=c1['key'], token=c1['token'], pick=v['brk']['offers'][0], mini=999)
v = S1(); check('привал: усилитель в запасе, бонус мини-игры не больше 300', v['inventory'] == [v['inventory'][0]] and v['peak']['bonus'] == 300, v['peak'])
check('цель 50 % достигнута — вершина и звание лиги', v['peak']['summit'] and v['peak']['tier'] == 3, v['peak'])
while not S1()['done']:
    qx, sx = right(c1); P('answer', className=A, key=c1['key'], token=c1['token'], q=qx, answer=sx)
v = S1(); check('все вопросы освоены — восхождение закончено, точность с первой попытки 83 %', v['done'] and v['peak']['mastery'] == 100 and v['summary']['acc'] == 83, v.get('summary'))
check('покорённая вершина засчитана альпинисту', G.climber(A, 'Альпинист Первый')['summits'] == 1)
check('новые альпинисты открываются за вершины', P('avatar', className=A, key=c1['key'], token=c1['token'], avatar=8).status_code == 200 and P('avatar', className=A, key=c1['key'], token=c1['token'], avatar=9).status_code == 400)
teacher[0] = True; T(className=A, action='end'); g = T(className=A, action='screen').get_json()
check('звания в конце: лучший, быстрый, воин, трудяга', len(g['titles']) == 4, g['titles']); T(className=A, action='close')
# --- под руководством учителя и командный режим
T(className=A, action='open', quiz=qid, mode='paced'); teacher[0] = False
d1 = P('join', className=A, name='Командир Первый').get_json(); teacher[0] = True; T(className=A, action='start'); teacher[0] = False; room = G.rooms[A]
v = P('sync', className=A, key=d1['key'], token=d1['token'], ready=True).get_json(); check('под руководством учителя: у всех первый вопрос', v['q']['n'] == 1 and v['paced']['n'] == 1)
qx, sx = right(d1); P('answer', className=A, key=d1['key'], token=d1['token'], q=qx, answer=sx)
v = P('sync', className=A, key=d1['key'], token=d1['token']).get_json(); check('ответили все — ответ открывается сам', v['paced']['reveal'] and v['paced']['frac'] == 1, v['paced'])
teacher[0] = True; g = T(className=A, action='next').get_json(); check('учитель переходит ко второму вопросу', g['paced']['n'] == 2 and not g['paced']['reveal']); T(className=A, action='close')
T(className=A, action='open', quiz=qid, mode='team', settings={'teams': 3}); teacher[0] = False
for n in ['Игрок Один', 'Игрок Два', 'Игрок Три', 'Игрок Четыре']: P('join', className=A, name=n)
teacher[0] = True; g = T(className=A, action='screen').get_json(); check('командный режим: игроки разложены по трём командам поровну', sorted(t['size'] for t in g['teams']) == [1, 1, 2], g['teams']); T(className=A, action='close')
T(className=A, action='open', quiz=qid, mode='test'); teacher[0] = False; e1 = P('join', className=A, name='Тестовый Ученик').get_json(); teacher[0] = True; T(className=A, action='start'); teacher[0] = False
room = G.rooms[A]; qx, sx = right(e1); res = P('answer', className=A, key=e1['key'], token=e1['token'], q=qx, answer=sx).get_json()
v = P('sync', className=A, key=e1['key'], token=e1['token']).get_json(); check('режим «Тест»: без лидеров, мемов и усилителей, баллы без скорости', res['pts'] == 100 and not v['settings']['leaderboard'] and not v['settings']['powerups'] and 'top' not in v, (res['pts'], v['settings']))
# --- регрессии: ошибки, найденные при проверке
import time as _t
B7, IMG = '7 «Б»', 'data:image/png;base64,iVBORw0KGgo='
one = lambda i, **k: {'type': 'single', 'text': f'В{i}', 'options': ['a', 'b', 'c', 'd'], 'answer': 0, 'time': 20, **k}
Q = lambda who, path='sync', **k: P(path, className=B7, key=who['key'], token=who['token'], **k)
def room_with(qs, mode='classic', names=('Ученик Проверка',), **st):
    teacher[0] = True; T(className=B7, action='close'); qz = P('save', quiz={'title': 'Проверка', 'grade': 7, 'questions': qs}).get_json()['id']
    T(className=B7, action='open', quiz=qz, mode=mode, settings=st); teacher[0] = False; ps = [P('join', className=B7, name=n).get_json() for n in names]
    teacher[0] = True; T(className=B7, action='start'); teacher[0] = False; return G.rooms[B7], ps
t0 = _t.time()
try: n = B.number('1e10000000')
except Exception as e: n = e
check('число с огромным порядком отклоняется сразу и не держит блокировку всех классов', n is None and _t.time() - t0 < 0.5, (n, round(_t.time() - t0, 2)))
try: n = [B.number(x) for x in ('1e400', '1,5e3', '-1/4', '−2', '.5', '1e-3')]
except Exception as e: n = e
check('числа: 1e400 — не число, обычные записи — числа', n == [None, 1500, -0.25, -2, 0.5, 0.001], n)
teacher[0] = True; n = [P('save', quiz={'title': 't', 'questions': [x]}).status_code for x in (one(0, time='abc'), {'type': 'categorize', 'text': 'a', 'cats': ['x', 'y']}, {'type': 'math', 'text': 'a', 'value': '1e400'})]; teacher[0] = False
check('редактор: время «abc», группы-строки, число 1e400 — ошибка 400, не 500', n == [400] * 3, n)
rm, (u,) = room_with([{'type': 'open', 'text': 'Почему?'}, one(1)], shuffleQ=False)
qx = Q(u, ready=True).get_json()['q']['id']; Q(u, 'answer', q=qx, answer='\ud800')
check('имя с одиночным суррогатом — отказ 400, не 500', P('join', className=B7, name='Ученик \ud800').status_code == 400)
teacher[0] = True; app.logger.disabled = True; report = G.report; G.report = lambda r: {'сбой': {1}}
n = T(className=B7, action='end').status_code; G.report = report; app.logger.disabled = False
check('сбой записи итогов — игра не окончена, её можно завершить снова', n == 500 and rm['phase'] == 'live', (n, rm['phase']))
e = T(className=B7, action='end'); n = P('result', id=rm['result_id'] or 0).get_json(); teacher[0] = False
check('итог сохраняется, даже если в ответе ученика одиночный суррогат', e.status_code == 200 and n['status'] == 'ok' and n['result']['players'][0]['answers'][qx]['text'] == '\ud800', (e.status_code, n))
rm, (u,) = room_with([one(i) for i in range(8)]); p = rm['players'][u['key']]; opened = P('status', className=B7).get_json()['room']
guess = [q['id'] for q in rm['quiz']['questions']]; random.Random(f"{u['key']}:0:{opened}").shuffle(guess)
for qx in p['order']: G.question(rm, p, qx, _t.time())
def perm4(qx): o = list(range(4)); random.Random(f"{u['key']}:{qx}:0:0:{opened}").shuffle(o); return o
check('порядок вопросов и вариантов не вычислить по данным ученика (секретная соль комнаты)', guess != p['order'] and any(perm4(qx) != p['keys'][qx]['key']['o'] for qx in p['order']) and rm.get('salt', '') not in Q(u, ready=True).get_data(as_text=True))
rm, (u,) = room_with([{'type': 'poll', 'text': 'Нравится?', 'options': ['да', 'нет']}, {'type': 'hotspot', 'text': 'Где?', 'image': IMG, 'spots': [{'x': 50, 'y': 50, 'r': 10}]}, one(1)], shuffleQ=False); p = rm['players'][u['key']]
qx = Q(u, ready=True).get_json()['q']['id']; n = [Q(u, 'answer', q=qx, answer=float('inf')).status_code]; Q(u, 'answer', q=qx, answer=0)
qx =Q(u, ready=True).get_json()['q']['id']; n.append(Q(u, 'answer', q=qx, answer={'x': 1e200, 'y': float('inf')}).status_code)
qx = Q(u, ready=True).get_json()['q']['id']; p['answers'][qx] = {'tries': []}; teacher[0] = True; n.append(T(className=B7, action='screen').status_code); teacher[0] = False; p['answers'].pop(qx)
check('ответ 1e400 (бесконечность): опрос — отказ, область — неверно, экран учителя работает', n == [400, 200, 200] and all('frac' in a for a in p['answers'].values()), (n, p['answers']))
rm, (v5,) = room_with([one(i) for i in range(3)], names=('Отличница Аня',)); n = P('join', className=B7, name='ОТЛИЧНИЦА  аня!')
check('чужой вход с тем же именем, пока ученик на связи, — отказ', n.status_code == 409 and Q(v5).status_code == 200, n.get_json())
u = P('join', className=B7, name='Отличница Аня', token=v5['token']).get_json()
check('обновление страницы: с прежним ключом пускает с новым ключом, старый больше не действует', u.get('token') not in (None, v5['token']) and Q(v5).status_code == 403 and Q(u).status_code == 200, u)
rm['players'][v5['key']]['seen'] -= 30; n = P('join', className=B7, name='Отличница Аня').get_json()
check('ученик давно не на связи — вход по имени с новым ключом, прежняя вкладка отключена', n.get('token') not in (None, u['token']) and Q(u).status_code == 403, n)
teacher[0] = True; T(className=B7, action='kick', key=v5['key']); teacher[0] = False
check('убранный ученик не войдёт и с именем в другом порядке', P('join', className=B7, name='Аня Отличница').status_code == 403)
rm, (u,) = room_with([one(i) for i in range(8)], mode='peak'); p = rm['players'][u['key']]
for _ in range(20):
    if p['brk']: break
    qx = Q(u, ready=True).get_json()['q']['id']; Q(u, 'answer', q=qx, answer=B.solution(rm['qmap'][qx], p['keys'][qx]['key']))
n = [Q(u, 'break', pick=p['brk']['offers'][0], mini=m).status_code for m in ('x', float('nan'), [1])]
check('привал: неверный счёт мини-игры — отказ, усилитель не выдан, привал открыт', n == [400] * 3 and p['inventory'] == [] and p['brk'], (n, p['inventory']))
rm, (u,) = room_with([one(i, explain='потому что') for i in range(3)]); p = rm['players'][u['key']]
qx = Q(u, ready=True).get_json()['q']['id']; Q(u, 'answer', q=qx, answer=B.solution(rm['qmap'][qx], p['keys'][qx]['key']))
v = Q(u, ready=False).get_json(); nxt = G.current(rm, p); n = Q(u, 'answer', q=nxt, answer=0).status_code
check('пока на экране разбор ответа, следующий вопрос не выдаётся и ответ на него не принимается', 'q' not in v and not p['shown'].get(nxt) and n == 400, (v.get('q'), n))
if p['shown'].get(nxt): p['shown'][nxt] -= 4     # разбор на экране 4 секунды
v = Q(u, ready=True).get_json().get('q') or {}
check('часы вопроса идут с показа, а не с разбора прошлого ответа', v.get('id') == nxt and v.get('remain') == v.get('limit'), v)
rm, (u,) = room_with([one(i, time=10) for i in range(2)], mode='paced'); teacher[0] = True; T(className=B7, action='acc', key=u['key'], acc={'extra': True}); teacher[0] = False
qx = Q(u, ready=True).get_json()['q']['id']; rm['cur_start'] -= 12; rm['players'][u['key']]['shown'][qx] -= 12
v = Q(u, ready=True).get_json(); n = Q(u, 'answer', q=qx, answer=0).status_code
check('под руководством учителя: ответ не открывается, пока не вышло двойное время ученика', not v['paced']['reveal'] and n == 200, (v['paced'], n))
rm, (u,) = room_with([one(i) for i in range(3)]); p = rm['players'][u['key']]
qx = Q(u, ready=True).get_json()['q']['id']; p['inventory'] = ['fifty']; Q(u, 'answer', q=qx, answer=0); n = Q(u, 'power', kind='fifty').status_code
check('«50 на 50» до показа следующего вопроса — отказ, усилитель остаётся', n == 400 and p['inventory'] == ['fifty'], (n, p['inventory']))
rm, (u,) = room_with([{'type': 'cloud', 'text': 'Слово?'}, {'type': 'draw', 'text': 'Нарисуй'}, {'type': 'multi', 'text': 'Какие?', 'options': ['a', 'b', 'c'], 'answers': [0, 1]}], shuffleQ=False); p = rm['players'][u['key']]
qc = Q(u, ready=True).get_json()['q']['id']; n = [Q(u, 'answer', q=qc, answer=['слово'] * 200000).status_code, Q(u, 'answer', q=qc, answer='алгоритмы').status_code]
qx = Q(u, ready=True).get_json()['q']['id']; n.append(Q(u, 'answer', q=qx, answer=None).status_code)
qx = Q(u, ready=True).get_json()['q']['id']; n.append(Q(u, 'answer', q=qx, answer=[0] * 100000).status_code)
check('огромные списки вместо ответа отклоняются; рисунок без ответа (время вышло) принят', n == [400, 200, 200, 400] and p['answers'][qc]['raw'] == 'алгоритмы' and qx not in p['answers'], (n, str(p['answers'].get(qc))[:80]))
teacher[0] = True; T(className=B7, action='close'); teacher[0] = False
print('ALL OK' if not fails else f'FAILED {fails}'); sys.exit(1 if fails else 0)
