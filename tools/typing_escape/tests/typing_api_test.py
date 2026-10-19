"""Рекорды «Побега от Тенегрыза»: учитель убирает ученика целиком, под каким бы написанием имени ни были записи."""
import sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(ROOT / 'tools/typing_escape/server'), '/srv/school4/test-results-app']
sys.path.append(str(ROOT / 'tools/stubs'))   # вне школьного сервера — заглушка журнала
from flask import Flask
import typing_api

teacher = [False]; typing_api.is_teacher = lambda: teacher[0]
app = Flask(__name__); typing_api.install_typing(app, Path(tempfile.mkdtemp(prefix='typing-api-'))); c = app.test_client(); fails = 0
def check(title, ok, info=''):
    global fails; print(('ok ' if ok else 'FAIL ') + title + ('' if ok else f' — {info}')); fails += not ok
A = '8 «А»'
rec = lambda name, level: c.post('/results/api/typing/record', json={'className': A, 'name': name, 'level': level, 'lang': 'ru', 'difficulty': 'normal', 'cpm': 120, 'accuracy': 95, 'chars': 120, 'seconds': 60})
mine = lambda name: c.post('/results/api/typing/mine', json={'className': A, 'name': name}).get_json()['levels']
for level, name in enumerate(['Иванов Пётр', 'иванов  пётр', 'Иванов Петр'], 1):
    rec(name, level)
check('разные написания имени — один ученик', mine('Иванов Пётр') == [1, 2, 3], mine('Иванов Пётр'))
rec('Петрова Анна', 1)
check('убрать записи может только учитель', c.post('/results/api/typing/teacher', json={'action': 'remove', 'className': A, 'name': 'Иванов Пётр'}).status_code == 403)
teacher[0] = True; r = c.post('/results/api/typing/teacher', json={'action': 'remove', 'className': A, 'name': 'Иванов Пётр'}).get_json()
check('учитель убирает все записи ученика', r['removed'] == 3 and mine('Иванов Пётр') == [], (r, mine('Иванов Пётр')))
check('записи других учеников остаются', mine('Петрова Анна') == [1])
print('ALL OK' if not fails else f'FAILED {fails}'); sys.exit(1 if fails else 0)
