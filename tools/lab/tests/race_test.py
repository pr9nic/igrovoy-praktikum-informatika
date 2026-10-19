"""Проверка сервера «Гонки алгоритмов» без сети: правила, таблица и совпадение проверки с клиентом (по образцам из node).
Запуск: python tools/lab/tests/race_test.py"""
import json, subprocess, sys, types
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'server'))
sys.modules.setdefault('portal_security', types.SimpleNamespace(is_teacher=lambda: True))
sys.modules.setdefault('flask', types.SimpleNamespace(jsonify=lambda **k: k, request=None))
import race_api as R
bad = 0
def check(name, ok, info=''):
    global bad; bad += 0 if ok else 1; print(('ok   ' if ok else 'FAIL ') + name + (' — ' + str(info) if info != '' else ''))
levels = json.loads(subprocess.check_output(['node', '-e', "require('%s/core.js');require('%s/games/race.js');console.log(JSON.stringify(LAB.games[0].LEVELS.map(l=>({map:l.map,dir:l.dir,ref:l.ref,par:l.par}))))" % (HERE.parent, HERE.parent)]))
check('сервер проверяет программы так же, как игра: все 12 образцов проходят, размеры совпадают', all(R.simulate(l['map'], l['dir'], l['ref']) and R.size(l['ref']) == l['par'] for l in levels))
check('негодные программы сервер отклоняет', not R.simulate(levels[0]['map'], 1, ['F']) and not R.simulate(levels[0]['map'], 1, ['F'] * 9) and not R.valid([{'n': 99, 'body': ['F']}]) and not R.valid(['X']) and not R.valid('FFF') and R.valid([{'n': 2, 'body': ['F', {'n': 3, 'body': ['L']}]}]))
r = R.Race(); a = r.join('8 «А»', 'Первый Ученик', 100); b = r.join('8 «А»', 'Второй Ученик', 100); room = r.rooms['8 «А»']; l = levels[1]
def refused(fn):
    try: fn(); return False
    except R.Refused: return True
check('без задания прислать решение нельзя', refused(lambda: r.submit(room, a, 1, l['ref'], 101)))
r.start(room, {'title': 'Повтори', 'map': l['map'], 'dir': l['dir'], 'minutes': 5}, 100)
long = ['F'] * 7; r.submit(room, a, 1, long, 130); r.submit(room, b, 1, l['ref'], 150)
v = r.view(room, a, 151, False)
check('короче программа — выше место; решения до конца не показываются', [x['name'] for x in v['board']] == ['Второй Ученик', 'Первый Ученик'] and v['board'][1]['me'] and 'program' not in v['board'][0] and v['phase'] == 'run' and v['task']['left'] == 249)
res = r.submit(room, a, 1, l['ref'], 200); v = r.view(room, a, 201, False)
check('при равной длине выше тот, кто прислал раньше; улучшение засчитывается', res['best'] and [x['name'] for x in v['board']] == ['Второй Ученик', 'Первый Ученик'] and v['board'][1]['size'] == 2)
check('неверную программу сервер не принимает, даже если клиент её прислал', refused(lambda: r.submit(room, a, 1, ['F', 'F'], 210)) and refused(lambda: r.submit(room, a, 1, [], 210)) and refused(lambda: r.submit(room, a, 7, l['ref'], 210)))
check('после времени решения не принимаются, программы открываются всем', refused(lambda: r.submit(room, a, 1, l['ref'], 500)) and r.view(room, a, 500, False)['phase'] == 'done' and 'program' in r.view(room, a, 500, False)['board'][0])
check('негодное задание от учителя не запускается', refused(lambda: r.start(room, {'map': ['S.', '...'], 'dir': 1, 'minutes': 5}, 600)) and refused(lambda: r.start(room, {'map': ['..G'], 'dir': 1, 'minutes': 5}, 600)) and refused(lambda: r.start(room, {'map': ['S.G'], 'dir': 1, 'minutes': 99}, 600)))
r.start(room, {'title': 'Новое', 'map': levels[0]['map'], 'dir': 1, 'minutes': 3}, 700); check('новое задание обнуляет таблицу', r.view(room, a, 701, False)['board'] == [] and r.view(room, a, 701, False)['task']['id'] == 2)
check('чужой ключ не подходит', refused(lambda: r.who('8 «А»', a['id'], 'нет')) and r.who('8 «А»', a['id'], a['token'])[1] is a)
print('FAILED %d' % bad if bad else 'ALL OK'); sys.exit(bad)
