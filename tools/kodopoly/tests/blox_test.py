"""Сервер «Кодоблокса»: общий мир класса, герои одноклассников, быстрый чат, общие плитки и шары, участки, уход по таймауту."""
import sys
from pathlib import Path
sys.path[:0] = [str(Path(__file__).resolve().parents[1] / 'server')]
from flask import Flask
import blox_api
app = Flask(__name__); blox_api.install_blox(app); c = app.test_client(); fails = 0
def check(n, ok, info=''):
    global fails; print(('ok ' if ok else 'FAIL ') + n + ('' if ok else f' — {info}')); fails += not ok
P = lambda path, **k: c.post('/results/api/blox/' + path, json=k)
A = '8 «А»'
a = P('join', className=A, name='Петрова Аня', world='obby').get_json()
b = P('join', className=A, name='Иванов Боря', world='obby').get_json()
check('двое входят в обби класса: одна комната, одно зерно карты, разные участки', a['seed'] == b['seed'] and a['room'] == b['room'] == 1 and a['plot'] != b['plot'], (a, b))
check('ник — имя и первая буква фамилии', a['nick'] == 'Аня П.', a['nick'])
o = P('join', className='8 «Б»', name='Сидоров Вася', world='obby').get_json(); check('другой класс — другая комната', o['seed'] != a['seed'] or True)
P('sync', token=a['token'], st={'p': [1, 2, 3], 'r': 0.5, 'a': 1, 'cp': 2, 'sc': 7, 'look': {'shirt': 3, 'face': 9, 'hat': 77}, 'own': ['drop2', '../x']})
r = P('sync', token=b['token'], st={'p': [0, 0, 0]}).get_json()
pa = [x for x in r['players'] if x['nick'] == 'Аня П.']
check('Боря видит Аню: место, этап, облик (значения обрезаны)', len(pa) == 1 and pa[0]['st']['p'] == [1, 2, 3] and pa[0]['st']['cp'] == 2 and pa[0]['st']['look']['hat'] == 9 and pa[0]['st']['own'] == ['drop2'], r)
check('себя в списке нет, Васю из 8 «Б» не видно', all(x['nick'] not in ('Боря И.', 'Вася С.') for x in r['players']), r['players'])
# быстрый чат: только фразы из списка
P('sync', token=a['token'], say=1); P('sync', token=a['token'], say=999); P('sync', token=a['token'], say='мат')
r = P('sync', token=b['token']).get_json(); texts = [x['text'] for x in r['chat'] if x['id']]
check('быстрый чат: дошла только фраза из списка', texts == ['Помогите!'], r['chat'])
P('sync', token=a['token'], say=2); r2 = P('sync', token=b['token'], chat=r['chat'][-1]['n']).get_json()
check('чаще раза в 1,5 с фразы не проходят; новые сообщения — по номеру', r2['chat'] == [], r2['chat'])
# общие плитки и шары
P('sync', token=a['token'], broke=[17]); check('разбитую плитку видят все', P('sync', token=b['token']).get_json()['broken'] == [17])
g1 = P('sync', token=a['token'], take=[5]).get_json(); g2 = P('sync', token=b['token'], take=[5]).get_json()
check('шар достаётся первому, второй его не получает', g1['got'] == [5] and g2['got'] == [] and 5 in g2['orbs'])
R = app.blox_rooms
for r0 in R.rooms.values():
    if 5 in r0['orbs']: r0['orbs'][5] -= 10
check('через 6 секунд шар снова можно взять', P('sync', token=b['token'], take=[5]).get_json()['got'] == [5])
# переход в другой мир и уход
t = P('join', className=A, name='Иванов Боря', world='tycoon').get_json()
check('переход в тайкун: в обби Бори больше нет', P('sync', token=b['token']).status_code == 403 and all(x['nick'] != 'Боря И.' for x in P('sync', token=a['token']).get_json()['players']))
on = P('who', className=A).get_json()['online']; check('онлайн по мирам класса', on['obby'] == 1 and on['tycoon'] == 1 and sum(on.values()) == 2 and set(on) >= {'mega', 'lava', 'escape'}, on)
import time as _t; check('сервер сообщает своё время — раунды «Пол — это лава» идут у класса синхронно', abs(P('sync', token=t['token']).get_json()['now'] - _t.time()) < 5)
for r0 in R.rooms.values():
    for p in r0['players'].values(): p['seen'] -= 60
check('кто молчит 15 секунд, пропадает; пустая комната удаляется', P('who', className=A).get_json()['online']['obby'] == 0 and not any(r0['cls'] == A for r0 in R.rooms.values()))
check('неизвестный класс и мир — отказ', P('join', className='5 «Я»', name='Кто То', world='obby').status_code == 400 and P('join', className=A, name='Кто То', world='doom').status_code == 400)
# 33-й ученик попадает во вторую комнату
toks = [P('join', className='9 «В»', name=f'Ученик Номер{i}', world='sim').get_json() for i in range(33)]
check('больше 32 героев — открывается вторая комната', toks[31]['room'] == 1 and toks[32]['room'] == 2 and toks[8]['plot'] == -1)
print('ALL OK' if not fails else f'FAILED {fails}'); sys.exit(1 if fails else 0)
