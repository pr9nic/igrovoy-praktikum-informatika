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
v = S(s1); check('вопрос пришёл без ответа', 'q' in v and 'answer' not in v['q'] and v['q']['limit'] == 20)
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
v = S(s1); check('после последнего вопроса — вопрос-реванш по ошибке', v.get('q', {}).get('redemption') is True, v.get('q'))
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
v = P('sync', className=A, key=d1['key'], token=d1['token']).get_json(); check('под руководством учителя: у всех первый вопрос', v['q']['n'] == 1 and v['paced']['n'] == 1)
qx, sx = right(d1); P('answer', className=A, key=d1['key'], token=d1['token'], q=qx, answer=sx)
v = P('sync', className=A, key=d1['key'], token=d1['token']).get_json(); check('ответили все — ответ открывается сам', v['paced']['reveal'] and v['paced']['frac'] == 1, v['paced'])
teacher[0] = True; g = T(className=A, action='next').get_json(); check('учитель переходит ко второму вопросу', g['paced']['n'] == 2 and not g['paced']['reveal']); T(className=A, action='close')
T(className=A, action='open', quiz=qid, mode='team', settings={'teams': 3}); teacher[0] = False
for n in ['Игрок Один', 'Игрок Два', 'Игрок Три', 'Игрок Четыре']: P('join', className=A, name=n)
teacher[0] = True; g = T(className=A, action='screen').get_json(); check('командный режим: игроки разложены по трём командам поровну', sorted(t['size'] for t in g['teams']) == [1, 1, 2], g['teams']); T(className=A, action='close')
T(className=A, action='open', quiz=qid, mode='test'); teacher[0] = False; e1 = P('join', className=A, name='Тестовый Ученик').get_json(); teacher[0] = True; T(className=A, action='start'); teacher[0] = False
room = G.rooms[A]; qx, sx = right(e1); res = P('answer', className=A, key=e1['key'], token=e1['token'], q=qx, answer=sx).get_json()
v = P('sync', className=A, key=e1['key'], token=e1['token']).get_json(); check('режим «Тест»: без лидеров, мемов и усилителей, баллы без скорости', res['pts'] == 100 and not v['settings']['leaderboard'] and not v['settings']['powerups'] and 'top' not in v, (res['pts'], v['settings']))
print('ALL OK' if not fails else f'FAILED {fails}'); sys.exit(1 if fails else 0)
