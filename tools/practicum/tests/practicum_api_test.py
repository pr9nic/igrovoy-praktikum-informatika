"""Проверка серверных наград и статистики практикума на временных файлах (живые данные не трогаются)."""
import datetime, json, sqlite3, sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(ROOT / 'tools/practicum/server'), '/srv/school4/test-results-app']
sys.path.append(str(ROOT / 'tools/stubs'))   # вне школьного сервера — заглушка журнала
import portal_security
from flask import Flask
from practicum_api import install_practicum
import practicum_api

tmp = Path(tempfile.mkdtemp(prefix='practicum-api-'))
site = tmp / 'site/courses/game-8-practicum'; site.mkdir(parents=True)
games = [{'id': 'bits', 'title': 'Двоичный десант', 'levels': 4}, {'id': 'oge', 'title': 'ОГЭ-арена', 'levels': 2}, {'id': 'cells', 'title': 'Клетки', 'levels': 5}]
site.joinpath('index.html').write_text('<script type="application/json" id="assignmentData">' + json.dumps({'practicum': {'games': games}}) + '</script>')
db = sqlite3.connect(tmp / 'trainer.db')
db.execute('CREATE TABLE progress (slug TEXT, class_name TEXT, student_key TEXT, student_name TEXT, levels_json TEXT, sent_json TEXT, updated_at TEXT)')
def put(name, levels):
    db.execute('DELETE FROM progress WHERE student_key = ?', (practicum_api.norm(name),))
    db.execute('INSERT INTO progress VALUES (?, ?, ?, ?, ?, ?, ?)', ('trainer-8-practicum', '8 «А»', practicum_api.norm(name), name, json.dumps(levels), '{}', '')); db.commit()
day = [datetime.date(2026, 10, 15)]
app = Flask(__name__); install_practicum(app, tmp, tmp / 'site', today=lambda: day[0])
portal_security.is_teacher = lambda: False
import practicum_api; practicum_api.is_teacher = lambda: teacher[0]
teacher = [False]
c = app.test_client(); fails = 0
def check(title, ok, info=''):
    global fails; print(('ok ' if ok else 'FAIL ') + title + ('' if ok else f' — {info}')); fails += not ok
me = lambda name: c.get('/results/api/practicum/me', query_string={'slug': 'trainer-8-practicum', 'className': '8 «А»', 'name': name}).get_json()

r = me('Иванов Пётр'); check('новый ученик: пустая статистика и все значки закрыты', r['status'] == 'ok' and r['stats']['stars'] == 0 and not any(b['got'] for b in r['badges']), r)
put('Иванов Пётр', {'bits-1': {'stars': 3}}); r = me('Иванов Пётр')
check('первый этап: значок «Первые шаги» выдан сервером и помечен как новый', next(b for b in r['badges'] if b['id'] == 'sprout')['fresh'], r['badges'][0])
check('звёзды попали в недельную лигу', r['league']['stars'] == 3 and r['league']['place'] == 1, r['league'])
r = me('Иванов Пётр'); check('повторный запрос: значок уже не новый, звёзды не задвоились', not next(b for b in r['badges'] if b['id'] == 'sprout')['fresh'] and r['league']['stars'] == 3, r['league'])
dg = r['daily']['id']; check('задание дня вычисляется на сервере', dg in {g['id'] for g in games} and r['daily']['done'] in (True, False), r['daily'])
# Задание дня три дня подряд: каждый день прибавка в игре дня.
lv = {'bits-1': {'stars': 3}}
for k in range(3):
    day[0] = datetime.date(2026, 10, 16 + k); g = practicum_api  # noqa
    dgame = me('Иванов Пётр')['daily']['id']; n = next(x for x in range(1, 6) if f'{dgame}-{x}' not in lv) if any(f'{dgame}-{x}' not in lv for x in range(1, 6)) else 1
    lv[f'{dgame}-{n}'] = {'stars': 1}; put('Иванов Пётр', lv); r = me('Иванов Пётр')
check('серия заданий дня считается сервером и даёт значок «Серия»', r['daily']['streak'] >= 3 and next(b for b in r['badges'] if b['id'] == 'flame')['got'], (r['daily'], lv))
# Чужой ученик не получает чужих звёзд.
r2 = me('Петрова Анна'); check('другой ученик не видит чужих звёзд и значков', r2['stats']['stars'] == 0 and not any(b['got'] for b in r2['badges']), r2['stats'])
check('в лиге имена сокращены до «Имя Ф.»', all('Иванов' not in t['name'] for t in r2['league']['top']) and r2['league']['top'][0]['name'] == 'Пётр И.', r2['league'])
put('Петрова Анна', {'oge-1': {'stars': 2}, 'oge-2': {'stars': 3}}); r2 = me('Петрова Анна')
check('«Готов к ОГЭ» за все задания арены на 2+ звезды', next(b for b in r2['badges'] if b['id'] == 'oge')['got'])
bad = c.get('/results/api/practicum/me', query_string={'slug': 'trainer-8-practicum', 'className': '9 «А»', 'name': 'Иванов Пётр'})
check('класс другой параллели отклоняется', bad.status_code == 400)
check('таблица учителя закрыта для учеников', c.get('/results/api/practicum/teacher', query_string={'slug': 'trainer-8-practicum', 'className': '8 «А»'}).status_code == 403)
teacher[0] = True; t = c.get('/results/api/practicum/teacher', query_string={'slug': 'trainer-8-practicum', 'className': '8 «А»'}).get_json()
check('учитель видит таблицу класса', t['status'] == 'ok' and len(t['students']) == 2 and t['students'][0]['stars'] >= 5, t)
teacher[0] = False; r = me('Иванов Пётр')
check('профиль: навыки по темам, 7 дней недели, игры с отметкой, прогресс ранга', len(r['week']) == 7 and all('daily' in d and 'stars' in d for d in r['week']) and any(x['area'] == 'Кодирование' for x in r['skills']) and r['games'] and all(2 <= g['mark'] <= 5 for g in r['games']) and 0 <= r['stats']['rankProgress'] <= 1, {k: r[k] for k in ('week', 'skills', 'games')})
st = lambda: c.get('/results/api/practicum/student', query_string={'slug': 'trainer-8-practicum', 'className': '8 «А»', 'name': 'Петрова Анна'})
check('профиль ученика для учителя закрыт от учеников', st().status_code == 403)
teacher[0] = True; before = c.get('/results/api/practicum/teacher', query_string={'slug': 'trainer-8-practicum', 'className': '8 «А»'}).get_json()
put('Петрова Анна', {'oge-1': {'stars': 3}, 'oge-2': {'stars': 3}, 'bits-1': {'stars': 3}, 'bits-2': {'stars': 3}}); j = st().get_json()
after = c.get('/results/api/practicum/teacher', query_string={'slug': 'trainer-8-practicum', 'className': '8 «А»'}).get_json()
check('учитель открывает профиль ученика, и это не выдаёт значков и не пишет звёзды в лигу', j['status'] == 'ok' and j['name'] == 'Петрова Анна' and j['stats']['stars'] == 12 and {x['name']: (x['badges'], x['week']) for x in before['students']} == {x['name']: (x['badges'], x['week']) for x in after['students']}, j.get('stats'))
check('профиль неигравшего ученика — понятная ошибка', c.get('/results/api/practicum/student', query_string={'slug': 'trainer-8-practicum', 'className': '8 «А»', 'name': 'Никто Никакой'}).status_code == 404)
# --- разминка, повторение, сезон, турнир, аватары, карта класса ---
teacher[0] = False; day[0] = datetime.date(2026, 10, 20)
q = lambda n, c='8 «А»': c.get if False else None
mq = lambda name, cls='8 «А»': c.get('/results/api/practicum/me', query_string={'slug': 'trainer-8-practicum', 'className': cls, 'name': name}).get_json()
mq('Сидоров Глеб'); put('Сидоров Глеб', {'bits-1': {'stars': 3, 'plays': 1}, 'oge-1': {'stars': 1, 'plays': 1}}); r = mq('Сидоров Глеб')
check('разминка ведёт в самую слабую тему на первый этап без трёх звёзд', r['warmup'] and r['warmup']['level'] >= 1 and r['warmup']['game'] in ('cells', 'oge', 'bits'), r['warmup'])
check('сразу после прохождения повторять нечего', r['review'] == [], r['review'])
day[0] = datetime.date(2026, 10, 23); r = mq('Сидоров Глеб')
check('через 3 дня пройденные этапы просятся на повторение', {x['game'] for x in r['review']} == {'bits', 'oge'} and all(x['step'] == 1 for x in r['review']), r['review'])
put('Сидоров Глеб', {'bits-1': {'stars': 3, 'plays': 2}, 'oge-1': {'stars': 1, 'plays': 1}}); r = mq('Сидоров Глеб')
check('переигранный этап уходит из повторения до следующего срока (через 7 дней)', [x['game'] for x in r['review']] == ['oge'], r['review'])
check('сезон: название, звёзды сезона, цель 30 и дни до конца', r['season']['name'] and r['season']['goal'] == 30 and r['season']['stars'] >= 4 and r['season']['left'] >= 1, r['season'])
put('Сидоров Глеб', {'bits-1': {'stars': 3, 'plays': 2}, 'oge-1': {'stars': 3, 'plays': 1}, **{f'cells-{i}': {'stars': 3} for i in range(1, 6)}, 'bits-2': {'stars': 3}, 'bits-3': {'stars': 3}, 'bits-4': {'stars': 3}, 'oge-2': {'stars': 3}}); r = mq('Сидоров Глеб')
check('30 звёзд за сезон — сезонный значок', r['season']['got'] and r['season']['stars'] >= 30, r['season'])
mq('Борисова Ия', '8 «Б»'); db.execute("INSERT INTO progress VALUES ('trainer-8-practicum', '8 «Б»', 'борисова ия', 'Борисова Ия', '{\"bits-1\": {\"stars\": 2}}', '{}', '')"); db.commit(); r = mq('Сидоров Глеб')
check('турнир классов параллели: оба класса, свой отмечен', {x['className'] for x in mq('Борисова Ия', '8 «Б»')['classes']} >= {'8 «А»', '8 «Б»'} and any(x['mine'] for x in r['classes']), r['classes'])
av = lambda i: c.post('/results/api/practicum/avatar', json={'slug': 'trainer-8-practicum', 'className': '8 «А»', 'name': 'Сидоров Глеб', 'idx': i})
check('аватар открывается за звёзды: дорогой — отказ, доступный — сохраняется', av(11).status_code == 403 and av(2).status_code == 200 and mq('Сидоров Глеб')['avatar']['idx'] == 2)
teacher[0] = True; t = c.get('/results/api/practicum/teacher', query_string={'slug': 'trainer-8-practicum', 'className': '8 «А»'}).get_json()
check('учителю: навыки каждого ученика по темам (тепловая карта) и трудные этапы', t['areas'] and all('skills' in x for x in t['students']) and isinstance(t['hard'], list), {k: t[k] for k in ('areas', 'hard')})
# --- в лигу идут только этапы игр класса; кривой запрос — понятная ошибка, а не 500 ---
teacher[0] = False; mq('Лукин Олег'); put('Лукин Олег', {'bits-1': {'stars': 3}, 'bits-99': {'stars': 3}, **{f'zz-{i}': {'stars': 3} for i in range(1, 51)}}); r = mq('Лукин Олег')
check('выдуманные этапы (zz-1…, bits-99) не дают звёзд в лиге, сезоне и турнире', r['stats']['stars'] == 3 and r['league']['stars'] == 3 and r['season']['stars'] == 3, (r['stats']['stars'], r['league'], r['season']['stars']))
check('аватар: тело запроса не объект — 400', all(c.post('/results/api/practicum/avatar', json=b).status_code == 400 for b in ([1], 'abc', 5)))
print('ALL OK' if not fails else f'FAILED {fails}'); sys.exit(1 if fails else 0)
