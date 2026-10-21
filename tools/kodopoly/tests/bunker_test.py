"""Сетевой «Бункер»: лобби класса, раздача карт, открытие карт по раундам, голосование, испытания, итог."""
import sys
from pathlib import Path
sys.path[:0] = [str(Path(__file__).resolve().parents[1] / 'server')]
from flask import Flask
import bunker_api as B
app = Flask(__name__); B.install_bunker(app); c = app.test_client(); fails = 0
def check(n, ok, info=''):
    global fails; print(('ok ' if ok else 'FAIL ') + n + ('' if ok else f' — {info}')); fails += not ok
P = lambda path, **k: c.post('/results/api/bunker/' + path, json=k)
A = '8 «А»'
# карты: на любые 3–10 игроков нужды можно закрыть, флешка-ловушка не вмещает архив
import random
ok = True; info = ''
for n in range(3, 11):
    for seed in range(40):
        g = B.deal(n, 8, random.Random(seed))
        for nd in g['needs']:
            if not any(B.covers(cd, nd, g['size']) for cd in g['cards']):
                ok = False; info = f'{n} игроков, сид {seed}: нужду {nd} никто не закрывает'
        fl = [cd for cd in g['cards'] if 'флешка' in cd['item']]
        if 'store' in g['needs'] and sum(1 for cd in fl if B.covers(cd, 'store', g['size'])) != 1:
            ok = False; info = 'флешек, вмещающих архив, не одна'
        for t in g['trials']:
            if len(set(t['opts'])) != 4:
                ok = False; info = 'повтор вариантов ' + str(t)
check('раздача на 3–10 игроков: каждую нужду кто-то закрывает, одна флешка подходит, 4 разных ответа', ok, info)
h = P('create', className=A, name='Петрова Аня', title='Команда').get_json()
others = [P('join', className=A, name=nm, table=h['table']).get_json() for nm in ['Иванов Боря', 'Сидоров Вася', 'Кузнецова Галя', 'Смирнов Дима']]
check('лобби: пятеро в одном бункере, создатель — место 0', h['me'] == 0 and others[-1]['me'] == 4 and len(others[-1]['players']) == 5)
check('начать может только создатель', P('start', table=h['table'], token=others[0]['token']).status_code == 403)
s = P('start', table=h['table'], token=h['token']).get_json()
toks = [h['token']] + [o['token'] for o in others]
check('партия началась: открыта профессия, в бункере 3 места из 5', s['phase'] == 'reveal' and s['keep'] == 3 and all(cd['open'] == ['job'] for cd in s['cards']))
mine = s['cards'][0]['cards']; theirs = P('state', table=h['table'], token=toks[1]).get_json()['cards'][0]['cards']
check('свои карты видны целиком, чужие — только открытые', all(v is not None for v in mine.values()) and theirs['skill'] is None and theirs['job'] is not None, (mine, theirs))
T = h['table']
for rnd in range(2):
    for i, tk in enumerate(toks):
        st = P('state', table=T, token=tk).get_json()
        if i in st['out']:
            continue
        hidden = [k for k in B.CARDS if k not in st['cards'][i]['open']]
        P('act', table=T, token=tk, type='open', card=hidden[0])
    st = P('state', table=T, token=toks[0]).get_json()
    check(f'раунд {rnd + 1}: все открыли по карте — голосование', st['phase'] == 'vote', st['phase'])
    target = [i for i in range(5) if i not in st['out']][-1]
    for i, tk in enumerate(toks):
        if i in st['out']:
            continue
        P('act', table=T, token=tk, type='vote', target=target if target != i else [x for x in range(5) if x not in st['out'] and x != i][0])
    st = P('state', table=T, token=toks[0]).get_json()
    check(f'раунд {rnd + 1}: выбывает набравший больше голосов', st['phase'] == 'result' and st['out'][-1] == target and st['last']['out'] == target, st)
    if 0 in st['out']:
        break
    for tb in app.bunker_tables.tables.values():
        tb['until'] = 0
check('выбывший не может голосовать', P('act', table=T, token=toks[4], type='vote', target=0).status_code == 409)
st = P('state', table=T, token=toks[0]).get_json()
check('в бункере осталось 3 — испытания по информатике', st['phase'] == 'trial' and len(st['trials']) >= 3 and st['in_bunker'], st['phase'])
tb = app.bunker_tables.tables[T]; g = tb['game']
spec_ok = all(len(tr['gone']) == 2 and tr['spec'] and g['trials'][k]['right'] not in tr['gone'] or not tr['spec'] and tr['gone'] == [] for k, tr in enumerate(st['trials']))
check('специалисту зачёркнуты два неверных варианта, верный не тронут', spec_ok, st['trials'])
live = B.alive(tb)
for i in live:
    for k, q in enumerate(g['trials']):
        P('act', table=T, token=toks[i], type='answer', trial=k, opt=q['right'])
st = P('state', table=T, token=toks[0]).get_json()
check('все ответили верно — бункер выстоял, видны все карты', st['phase'] == 'end' and st['result']['win'] and st['result']['passed'] == len(g['needs']) and all(v is not None for v in st['cards'][1]['cards'].values()), st.get('result'))
check('создатель может начать новую партию', P('start', table=T, token=toks[0]).get_json()['phase'] == 'reveal')
# таймауты: никто не ходит — карта открывается сама, голосование подводится
for tb in app.bunker_tables.tables.values(): tb['until'] = 0
st = P('state', table=T, token=toks[1]).get_json(); check('время раскрытия вышло — открыто случайно, идёт голосование', st['phase'] == 'vote' and all(len(cd['open']) == 2 for cd in st['cards']))
for tb in app.bunker_tables.tables.values(): tb['until'] = 0
st = P('state', table=T, token=toks[1]).get_json(); check('никто не голосовал — выбывает случайный (партия не застревает)', st['phase'] == 'result' and len(st['out']) == 1)
check('другой класс бункеров не видит', P('list', className='8 «Б»').get_json()['tables'] == [])
print('ALL OK' if not fails else f'FAILED {fails}'); sys.exit(1 if fails else 0)
