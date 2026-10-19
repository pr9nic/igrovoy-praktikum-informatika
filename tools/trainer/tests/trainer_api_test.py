"""Сервер тренажёра: границы класса, предел уровней, кривые числа в JSON, старые записи прогресса — на временных файлах."""
import json, sqlite3, sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(ROOT / 'tools/trainer/server'), '/srv/school4/test-results-app']
sys.path.append(str(ROOT / 'tools/stubs'))   # вне школьного сервера — заглушка журнала
from flask import Flask
import trainer_api

tmp = Path(tempfile.mkdtemp(prefix='trainer-api-'))
journal = tmp / 'journal.db'
with sqlite3.connect(journal) as j:
    j.execute('CREATE TABLE test_results (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT, ip_address TEXT, computer_name TEXT, student_name TEXT, '
              'class_name TEXT, topic TEXT, score INTEGER, max_score INTEGER, percent INTEGER, mark INTEGER, attempt INTEGER, details_json TEXT)')
app = Flask(__name__); trainer_api.install_trainer(app, tmp, journal); c = app.test_client(); fails = 0
def check(title, ok, info=''):
    global fails; print(('ok ' if ok else 'FAIL ') + title + ('' if ok else f' — {info}')); fails += not ok
SLUG, A, NAME = 'trainer-8-practicum', '8 «А»', 'Иванов Пётр'
push = lambda levels, **k: c.post('/results/api/trainer/progress', json={'slug': SLUG, 'className': A, 'name': NAME, 'levels': levels, **k})
raw = lambda path, body: c.post('/results/api/trainer/' + path, data=body, content_type='application/json')
with sqlite3.connect(tmp / 'trainer.db') as db:
    db.execute('INSERT INTO roster VALUES (?, ?, ?)', (A, trainer_api.norm(NAME), NAME))

r = push({'bits-1': {'stars': 2}}); check('ученик из списка класса сохраняет прогресс', r.status_code == 200 and r.get_json()['levels']['bits-1']['stars'] == 2, r.get_json())
r = c.post('/results/api/trainer/progress', json={'slug': 'trainer-08-practicum', 'className': '08 «А»', 'name': 'Чужой Человек', 'levels': {'bits-1': {'stars': 3}}})
check('класс с ведущим нулём («08 «А»») не обходит список класса', r.status_code == 400, r.get_json())
r = c.post('/results/api/trainer/submit', json={'slug': 'trainer-08-practicum', 'className': '08 «А»', 'name': 'Чужой Человек', 'worldId': 'bits',
                                                'topic': '8 класс: Кодоград · практикум', 'score': 1, 'maxScore': 3, 'mark': 3})
check('…и не пишет отметку в журнал', r.status_code == 400 and sqlite3.connect(journal).execute('SELECT COUNT(*) FROM test_results').fetchone()[0] == 0, r.get_json())
body = lambda extra: json.dumps({'slug': SLUG, 'className': A, 'name': NAME}, ensure_ascii=False)[:-1] + ', ' + extra + '}'
codes = [raw('progress', body('"levels": {"bits-1": {"stars": 3, "plays": Infinity}}')).status_code,
         raw('progress', body('"levels": {"bits-1": {"stars": 3, "plays": 1e999}}')).status_code,
         raw('submit', body('"worldId": "bits", "topic": "8 класс: Кодоград", "score": Infinity, "maxScore": 3, "mark": 5')).status_code]
check('Infinity и 1e999 в JSON — отказ 400, а не 500', codes == [400, 400, 400], codes)
r = push({f'zz-{i}': {'stars': 1} for i in range(200)}); r2 = push({f'yy-{i}': {'stars': 1} for i in range(200)})
check('предел 300 уровней — на ученика, а не на один запрос', r.status_code == 200 and r2.status_code == 400 and len(push({}).get_json()['levels']) == 201, (r.status_code, r2.status_code))
with sqlite3.connect(tmp / 'trainer.db') as db:   # запись старого вида: без plays
    db.execute('INSERT INTO progress VALUES (?, ?, ?, ?, ?, ?, ?)', (SLUG, '8 «Б»', 'петрова анна', 'Петрова Анна', json.dumps({'bits-1': {'stars': 1}}), '{}', ''))
r = c.post('/results/api/trainer/progress', json={'slug': SLUG, 'className': '8 «Б»', 'name': 'Петрова Анна', 'levels': {'bits-1': {'stars': 2}, 'bits-2': {'stars': 1}}})
check('старая запись прогресса без plays обновляется без ошибки', r.status_code == 200 and r.get_json()['levels']['bits-1']['stars'] == 2, r.status_code)
print('ALL OK' if not fails else f'FAILED {fails}'); sys.exit(1 if fails else 0)
