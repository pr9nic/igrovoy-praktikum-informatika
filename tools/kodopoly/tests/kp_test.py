"""Лобби «Кодополии»: создание с названием, список класса, вход к друзьям, автостарт на четверых, ранний старт создателем, пересылка ходов."""
import sys, json
from pathlib import Path
sys.path[:0] = [str(Path(__file__).resolve().parents[1] / 'server')]
from flask import Flask
import kp_api
app = Flask(__name__); kp_api.install_kodopoly(app); c = app.test_client(); fails = 0
def check(n, ok, info=''):
    global fails; print(('ok ' if ok else 'FAIL ') + n + ('' if ok else f' — {info}')); fails += not ok
P = lambda path, **k: c.post('/results/api/kp/' + path, json=k)
A = '8 «А»'
h = P('create', className=A, name='Хозяин Стола', title='Команда мечты').get_json(); check('лобби создано с названием, создатель на месте 0', h['seat'] == 0 and h['title'] == 'Команда мечты')
o = P('create', className=A, name='Другой Ученик').get_json(); check('второе лобби без названия получает имя создателя', o['title'] == 'Лобби Ученик Д.', o['title'])
L = P('list', className=A).get_json()['tables']; check('в списке класса два лобби с игроками', [x['title'] for x in L] == ['Команда мечты', 'Лобби Ученик Д.'] and L[0]['players'] == ['Стола Х.'], L)
check('в другом классе лобби не видны', P('list', className='8 «Б»').get_json()['tables'] == [])
check('начать одному нельзя', P('start', table=h['table'], token=h['token']).status_code == 400)
g = P('join', className=A, name='Гость Первый', table=h['table']).get_json(); check('друг вошёл в выбранное лобби', g['seat'] == 1 and not g['started'])
check('гость не может начать раньше', P('start', table=h['table'], token=g['token']).status_code == 403)
m = P('join', className=A, name='Другой Ученик', table=h['table']).get_json()
check('переход в другое лобби освобождает старое (пустое удаляется)', m['seat'] == 2 and len(P('list', className=A).get_json()['tables']) == 1)
f = P('join', className=A, name='Четвёртый Игрок', table=h['table']).get_json(); check('четвёртый игрок — партия стартует сама', f['started'] and f['seat'] == 3)
check('в начатую партию не войти', P('join', className=A, name='Опоздавший Ученик', table=h['table']).status_code == 409)
P('sync', table=h['table'], token=h['token'], snap=json.dumps({'cur': 1})); r = P('sync', table=h['table'], token=g['token'], input={'type': 'choose', 'i': 2}).get_json()
check('гость получает снимок поля', json.loads(r['snap'])['cur'] == 1 and r['seat'] == 1)
r = P('sync', table=h['table'], token=h['token']).get_json(); check('создатель забирает ход гостя', r['inputs'] == [{'seat': 1, 'type': 'choose', 'i': 2}])
check('чужой токен не принимается', P('sync', table=h['table'], token='x').status_code == 403)
# ранний старт и уход из лобби
x = P('create', className=A, name='Первый Создатель').get_json(); y = P('join', className=A, name='Второй Друг', table=x['table']).get_json()
P('leave', table=x['table'], token=x['token']); s = P('state', table=x['table'], token=y['token']).get_json(); check('создатель ушёл — создателем становится следующий', s['seat'] == 0, s)
z = P('join', className=A, name='Третий Друг', table=x['table']).get_json(); check('создатель начинает вдвоём раньше', P('start', table=x['table'], token=y['token']).get_json()['started'])
T = app.kp_tables; q = P('create', className=A, name='Ушедший Ученик').get_json(); T.tables[q['table']]['seats'][0]['seen'] -= 60
check('лобби, где никто не отвечает, исчезает из списка', all(t['id'] != q['table'] for t in P('list', className=A).get_json()['tables']))
print('ALL OK' if not fails else f'FAILED {fails}'); sys.exit(1 if fails else 0)
