"""Игровой практикум: статистика, награды, задание дня и недельная лига — всё считается на сервере.

Прогресс учеников уже лежит в trainer.db (модуль trainer_api); здесь он только читается.
Свой файл practicum.db хранит то, что нельзя вычислить из прогресса задним числом:
когда и сколько звёзд получено (для недельной лиги), выполненные задания дня и выданные значки.
Журнал оценок этот модуль не трогает.
"""
import datetime
import json
import os
import re
import sqlite3
import threading
from pathlib import Path

from flask import jsonify, request

from portal_security import is_teacher

SLUG = re.compile(r'trainer-(6|7|8|9|10|11)-practicum')
CLASS = re.compile(r'(6|7|8|9|10|11) «[АБВГДЕЖЗИК]»')
ITEM = re.compile(r'([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-(\d+)')
GRADING_FIVE = 80
RANKS = [(0, 'Новичок'), (15, 'Стажёр'), (45, 'Программист'), (100, 'Инженер'), (180, 'Архитектор'), (300, 'Легенда Кодограда')]
BADGES = [
    ('sprout', 'Первые шаги', 'Пройди любой этап'),
    ('star', 'Без ошибок', 'Десять этапов на три звезды'),
    ('trophy', 'Покоритель', 'Пройди все этапы одной игры'),
    ('gems', 'Коллекционер', 'Звёзды в пяти разных играх'),
    ('cap', 'Отличник', 'Набери на «5» в любой игре'),
    ('flame', 'Серия', 'Задание дня три дня подряд'),
    ('keys', 'Быстрые пальцы', '200 знаков в минуту в «Побеге от Тенегрыза»'),
    ('boss', 'Победитель Глюка', 'Пройди пятую зону «Клеток памяти»'),
    ('hundred', 'Сотня', 'Набери 100 звёзд'),
    ('explorer', 'Исследователь', 'Звёзды в десяти разных играх'),
    ('leader', 'Лидер недели', 'Стань первым в лиге класса за неделю (от 10 звёзд)'),
    ('oge', 'Готов к ОГЭ', 'Пройди все задания «ОГЭ-арены» хотя бы на две звезды'),
]


# Группы тем для «паутины» навыков: игры практикума по разделам информатики.
AREAS = [('Программирование', ['code', 'quest', 'arrays', 'office']), ('Алгоритмы', ['shop', 'executors', 'race', 'factory', 'route', 'turing']),
         ('Логика', ['logic', 'gates', 'sets']), ('Кодирование', ['bits', 'merge', 'bytes', 'pixel']), ('Данные и сети', ['sheets', 'dbcity', 'files', 'net', 'ipnet', 'detective']),
         ('ОГЭ', ['oge']), ('Реакция', ['cells', 'snake'])]


REVIEW = [3, 7, 14]   # интервалы повторения, дни
AVATAR_STARS = [0, 10, 20, 35, 50, 70, 90, 120, 150, 190, 240, 300]   # сколько звёзд открывает каждый из 12 аватаров
SEASON_DAYS, SEASON_GOAL, SEASON_START = 14, 30, datetime.date(2026, 9, 1)
SEASONS = [('Сезон логики', 'logic'), ('Код-марафон', 'code'), ('Время данных', 'data'), ('Сетевая неделя', 'net')]


def norm(name):
    return re.sub(r'\s+', ' ', str(name).strip().lower().replace('ё', 'е'))


def short(name):
    parts = str(name).split()
    return f'{parts[1]} {parts[0][0]}.' if len(parts) >= 2 else str(name)


class Refused(Exception):
    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code


def install_practicum(app, data_dir, site_root, today=None):
    data_dir, site_root = Path(data_dir), Path(site_root)
    db_path, trainer_db, typing_db = data_dir / 'practicum.db', data_dir / 'trainer.db', data_dir / 'typing_records.db'
    lock = threading.Lock()
    games_cache = {}
    today = today or datetime.date.today

    def connect():
        conn = sqlite3.connect(db_path, timeout=10)
        conn.executescript(
            'CREATE TABLE IF NOT EXISTS seen (slug TEXT, class_name TEXT, student_key TEXT, levels_json TEXT, PRIMARY KEY (slug, class_name, student_key));'
            'CREATE TABLE IF NOT EXISTS events (slug TEXT, class_name TEXT, student_key TEXT, name TEXT, item TEXT, gained INTEGER, day TEXT);'
            'CREATE INDEX IF NOT EXISTS events_week ON events (slug, class_name, day);'
            'CREATE TABLE IF NOT EXISTS daily (slug TEXT, class_name TEXT, student_key TEXT, day TEXT, PRIMARY KEY (slug, class_name, student_key, day));'
            'CREATE TABLE IF NOT EXISTS awards (slug TEXT, class_name TEXT, student_key TEXT, badge TEXT, at TEXT, PRIMARY KEY (slug, class_name, student_key, badge));'
            'CREATE TABLE IF NOT EXISTS review (slug TEXT, class_name TEXT, student_key TEXT, item TEXT, due TEXT, step INTEGER, PRIMARY KEY (slug, class_name, student_key, item));'
            'CREATE TABLE IF NOT EXISTS avatar (slug TEXT, class_name TEXT, student_key TEXT, idx INTEGER, PRIMARY KEY (slug, class_name, student_key));')
        return conn

    def fail(error):
        return jsonify(status='error', message=str(error)), getattr(error, 'code', 400)

    def games_of(grade):
        """Список игр практикума класса берётся из опубликованной страницы — та же, что видит ученик."""
        override = os.environ.get('SCHOOL4_PRACTICUM_PAGES')   # тестовый стенд: страницы практикума из build/
        base = Path(override) if override else site_root / 'courses' if (site_root / 'courses').is_dir() else site_root
        page = base / f'game-{grade}-practicum' / 'index.html'
        try:
            stamp = page.stat().st_mtime
        except OSError:
            return []
        if games_cache.get(grade, (None,))[0] != stamp:
            text = page.read_text(encoding='utf-8')
            m = re.search(r'<script type="application/json" id="assignmentData">(.*?)</script>', text, re.S)
            games = json.loads(m.group(1))['practicum']['games'] if m else []
            games_cache[grade] = (stamp, [{'id': g['id'], 'title': g['title'], 'levels': int(g['levels'])} for g in games])
        return games_cache[grade][1]

    def who(data):
        slug = str(data.get('slug') or '')
        m = SLUG.fullmatch(slug)
        if not m:
            raise Refused('Неизвестный практикум.')
        grade = int(m.group(1))
        class_name = str(data.get('className') or '')
        if not CLASS.fullmatch(class_name) or not class_name.startswith(f'{grade} '):
            raise Refused('Неизвестный класс.')
        name = re.sub(r'\s+', ' ', str(data.get('name') or '').strip())
        if not 5 <= len(name) <= 80 or ' ' not in name:
            raise Refused('Укажите фамилию и имя.')
        return slug, grade, class_name, norm(name), name

    def progress(slug, class_name, key=None):
        """Прогресс из trainer.db: {ключ ученика: (имя, уровни)}; файла может ещё не быть."""
        if not trainer_db.exists():
            return {}
        conn = sqlite3.connect(f'file:{trainer_db}?mode=ro', uri=True, timeout=10)
        try:
            sql, args = 'SELECT student_key, student_name, levels_json FROM progress WHERE slug = ? AND class_name = ?', [slug, class_name]
            if key is not None:
                sql += ' AND student_key = ?'
                args.append(key)
            return {k: (n, json.loads(l)) for k, n, l in conn.execute(sql, args)}
        except sqlite3.OperationalError:
            return {}
        finally:
            conn.close()

    def typing_best(class_name, key):
        if not typing_db.exists():
            return 0
        conn = sqlite3.connect(f'file:{typing_db}?mode=ro', uri=True, timeout=10)
        try:
            row = conn.execute('SELECT MAX(cpm) FROM records WHERE class_name = ? AND student_key = ?', (class_name, key)).fetchone()
            return int(row[0] or 0)
        except sqlite3.OperationalError:
            return 0
        finally:
            conn.close()

    def day_str(d):
        return d.strftime('%Y%m%d')

    def daily_game(games, grade, d):
        # Та же формула, что раньше была в странице практикума: игра дня одна на класс и день.
        if not games:
            return None
        n = d.year * 400 + (d.month - 1) * 32 + d.day + grade * 7
        return games[n % len(games)]

    def streak(days, d):
        n = 0
        if day_str(d) not in days:
            d -= datetime.timedelta(days=1)
        while day_str(d) in days and n < 400:
            n += 1
            d -= datetime.timedelta(days=1)
        return n

    def observe(conn, slug, grade, class_name, key, name, levels, games):
        """Сравнивает прогресс с прошлым снимком: прибавку звёзд записывает в события, задание дня — в daily."""
        if not games:   # страницы практикума нет — снимок не трогаем, прибавка засчитается, когда она появится
            return
        real = {f"{g['id']}-{n}" for g in games for n in range(1, g['levels'] + 1)}   # в лигу идут только этапы игр класса
        row = conn.execute('SELECT levels_json FROM seen WHERE slug = ? AND class_name = ? AND student_key = ?', (slug, class_name, key)).fetchone()
        d = today()
        if row is not None:
            old = json.loads(row[0])
            dg = daily_game(games, grade, d)
            for item, rec in levels.items():
                if item not in real:
                    continue
                before = old.get(item, {})
                gained = int(rec.get('stars', 0)) - int(before.get('stars', 0))
                # Интервальное повторение: впервые пройденный этап просится переиграть через 3 дня, потом через 7 и 14.
                if not before and int(rec.get('stars', 0)) > 0:
                    conn.execute('INSERT OR IGNORE INTO review VALUES (?, ?, ?, ?, ?, 0)', (slug, class_name, key, item, day_str(d + datetime.timedelta(days=REVIEW[0]))))
                elif int(rec.get('plays', 1)) > int(before.get('plays', 1)):
                    rv = conn.execute('SELECT due, step FROM review WHERE slug = ? AND class_name = ? AND student_key = ? AND item = ?', (slug, class_name, key, item)).fetchone()
                    if rv and rv[0] <= day_str(d):
                        step = int(rv[1]) + 1
                        if step >= len(REVIEW):
                            conn.execute('DELETE FROM review WHERE slug = ? AND class_name = ? AND student_key = ? AND item = ?', (slug, class_name, key, item))
                        else:
                            conn.execute('UPDATE review SET due = ?, step = ? WHERE slug = ? AND class_name = ? AND student_key = ? AND item = ?', (day_str(d + datetime.timedelta(days=REVIEW[step])), step, slug, class_name, key, item))
                if gained > 0:
                    conn.execute('INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?)', (slug, class_name, key, name, item, gained, day_str(d)))
                    m = ITEM.fullmatch(item)
                    if dg and m and m.group(1) == dg['id']:
                        conn.execute('INSERT OR IGNORE INTO daily VALUES (?, ?, ?, ?)', (slug, class_name, key, day_str(d)))
        # Отметки «задание дня» из старой версии страницы (уровни daily-ГГГГММДД) переносим один раз.
        for item in levels:
            if re.fullmatch(r'daily-\d{8}', item):
                conn.execute('INSERT OR IGNORE INTO daily VALUES (?, ?, ?, ?)', (slug, class_name, key, item[6:]))
        conn.execute('INSERT OR REPLACE INTO seen VALUES (?, ?, ?, ?)', (slug, class_name, key, json.dumps({k: {'stars': v.get('stars', 0), 'plays': v.get('plays', 1)} for k, v in levels.items()})))

    def week_board(conn, slug, class_name):
        since = day_str(today() - datetime.timedelta(days=6))
        rows = conn.execute('SELECT student_key, MAX(name), SUM(gained) FROM events WHERE slug = ? AND class_name = ? AND day >= ? '
                            'GROUP BY student_key ORDER BY SUM(gained) DESC, MAX(name)', (slug, class_name, since)).fetchall()
        return [{'key': k, 'name': short(n), 'stars': int(s)} for k, n, s in rows]

    def stats_of(levels, games):
        per = {}
        for g in games:
            got = [int(levels.get(f"{g['id']}-{n}", {}).get('stars', 0)) for n in range(1, g['levels'] + 1)]
            per[g['id']] = {'stars': sum(got), 'max': 3 * g['levels'], 'done': sum(1 for x in got if x), 'three': sum(1 for x in got if x == 3), 'levels': g['levels']}
        total = sum(p['stars'] for p in per.values())
        rank = max(i for i, (need, _) in enumerate(RANKS) if total >= need)
        return per, total, rank

    def badges_of(grade, class_name, key, levels, games, per, total, days, board):
        mark5 = any(p['stars'] * 100 >= GRADING_FIVE * p['max'] for p in per.values() if p['max'])
        oge = per.get('oge')
        test = {
            'sprout': any(p['done'] for p in per.values()),
            'star': sum(p['three'] for p in per.values()) >= 10,
            'trophy': any(p['done'] == p['levels'] for p in per.values()),
            'gems': sum(1 for p in per.values() if p['stars']) >= 5,
            'cap': mark5,
            'flame': streak(days, today()) >= 3,
            'keys': typing_best(class_name, key) >= 200,
            'boss': 'cells-5' in levels,
            'hundred': total >= 100,
            'explorer': sum(1 for p in per.values() if p['stars']) >= 10,
            'leader': bool(board) and board[0]['key'] == key and board[0]['stars'] >= 10,
            'oge': bool(oge) and all(int(levels.get(f'oge-{n}', {}).get('stars', 0)) >= 2 for n in range(1, oge['levels'] + 1)),
        }
        return test

    def profile(conn, slug, grade, class_name, key, name, levels, games, award):
        """Полная статистика ученика: счётчики, ранг, навыки по темам, неделя, игры, значки, лига. award — выдавать новые значки."""
        per, total, rank = stats_of(levels, games)
        days = {r[0] for r in conn.execute('SELECT day FROM daily WHERE slug = ? AND class_name = ? AND student_key = ?', (slug, class_name, key))}
        board = week_board(conn, slug, class_name)
        test = badges_of(grade, class_name, key, levels, games, per, total, days, board)
        had = dict(conn.execute('SELECT badge, at FROM awards WHERE slug = ? AND class_name = ? AND student_key = ?', (slug, class_name, key)))
        fresh = []
        if award:
            now = datetime.datetime.now().isoformat(timespec='seconds')
            for badge, ok in test.items():
                if ok and badge not in had:
                    conn.execute('INSERT INTO awards VALUES (?, ?, ?, ?, ?)', (slug, class_name, key, badge, now))
                    had[badge] = now
                    fresh.append(badge)
        d = today()
        dg = daily_game(games, grade, d)
        place = next((i + 1 for i, r in enumerate(board) if r['key'] == key), None)
        week = next((r['stars'] for r in board if r['key'] == key), 0)
        nxt = RANKS[rank + 1] if rank + 1 < len(RANKS) else None
        # Неделя: по дням — выполнено ли задание дня и сколько звёзд прибавилось.
        since = day_str(d - datetime.timedelta(days=6))
        gained = dict(conn.execute('SELECT day, SUM(gained) FROM events WHERE slug = ? AND class_name = ? AND student_key = ? AND day >= ? GROUP BY day', (slug, class_name, key, since)))
        WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
        week_days = [{'day': WD[x.weekday()], 'date': x.strftime('%d.%m'), 'daily': day_str(x) in days, 'stars': int(gained.get(day_str(x), 0))}
                     for x in (d - datetime.timedelta(days=6 - i) for i in range(7))]
        # Навыки: доля звёзд по группам тем (только игры, которые есть в практикуме этого класса).
        skills = []
        for area, ids in AREAS:
            have = [per[g] for g in ids if g in per]
            if have:
                mx = sum(p['max'] for p in have)
                skills.append({'area': area, 'pct': round(sum(p['stars'] for p in have) / mx, 3) if mx else 0})
        mark = lambda p: 5 if p['stars'] * 100 >= GRADING_FIVE * p['max'] else 4 if p['stars'] * 100 >= 60 * p['max'] else 3 if p['stars'] * 100 >= 33 * p['max'] else 2
        game_rows = sorted(({'id': g['id'], 'title': g['title'], 'stars': per[g['id']]['stars'], 'max': per[g['id']]['max'], 'done': per[g['id']]['done'], 'levels': g['levels'],
                             'pct': round(per[g['id']]['stars'] / per[g['id']]['max'], 3) if per[g['id']]['max'] else 0, 'mark': mark(per[g['id']])} for g in games if per[g['id']]['stars']), key=lambda r: -r['pct'])
        lo, hi = RANKS[rank][0], (nxt[0] if nxt else RANKS[rank][0])
        titles = {g['id']: g for g in games}
        # Разминка: самая слабая тема → игра этой темы с наименьшей долей звёзд → её первый этап не на три звезды.
        warm = None
        areas = sorted(((sum(per[g]['stars'] for g in ids if g in per) / max(1, sum(per[g]['max'] for g in ids if g in per)), area, [g for g in ids if g in per]) for area, ids in AREAS if any(g in per for g in ids)), key=lambda x: x[0])
        for pct, area, ids in areas:
            g = min(ids, key=lambda x: (per[x]['stars'] / max(1, per[x]['max']), x))
            n = next((n for n in range(1, titles[g]['levels'] + 1) if int(levels.get(f'{g}-{n}', {}).get('stars', 0)) < 3), None)
            if n:
                warm = {'area': area, 'pct': round(pct, 3), 'game': g, 'title': titles[g]['title'], 'level': n}
                break
        due = conn.execute('SELECT item, step FROM review WHERE slug = ? AND class_name = ? AND student_key = ? AND due <= ? ORDER BY due LIMIT 3', (slug, class_name, key, day_str(d))).fetchall()
        review = []
        for item, step in due:
            m = ITEM.fullmatch(item)
            if m and m.group(1) in titles:
                review.append({'game': m.group(1), 'title': titles[m.group(1)]['title'], 'level': int(m.group(2)), 'step': int(step) + 1})
        # Сезон: две недели со своей темой; значок сезона — за SEASON_GOAL звёзд, набранных в сезоне.
        si = (d - SEASON_START).days // SEASON_DAYS
        s0 = SEASON_START + datetime.timedelta(days=si * SEASON_DAYS)
        sname, sbadge = SEASONS[si % len(SEASONS)]
        srows = conn.execute('SELECT student_key, MAX(name), SUM(gained) FROM events WHERE slug = ? AND class_name = ? AND day >= ? GROUP BY student_key ORDER BY SUM(gained) DESC', (slug, class_name, day_str(s0))).fetchall()
        mine_s = next((int(r[2]) for r in srows if r[0] == key), 0)
        sid = f'season{si}'
        if award and mine_s >= SEASON_GOAL and sid not in had:
            conn.execute('INSERT OR IGNORE INTO awards VALUES (?, ?, ?, ?, ?)', (slug, class_name, key, sid, datetime.datetime.now().isoformat(timespec='seconds')))
            had[sid] = 'now'
            fresh.append(sid)
        season = {'name': sname, 'badge': sbadge, 'stars': mine_s, 'goal': SEASON_GOAL, 'got': sid in had, 'left': (s0 + datetime.timedelta(days=SEASON_DAYS) - d).days,
                  'top': [{'name': short(n), 'stars': int(st), 'me': k == key} for k, n, st in srows[:3]], 'past': sorted(b for b in had if re.fullmatch(r'season\d+', b) and b != sid)}
        # Турнир классов параллели: звёзды каждого класса за неделю.
        since = day_str(d - datetime.timedelta(days=6))
        classes = [{'className': c, 'stars': int(st), 'players': int(pl), 'mine': c == class_name} for c, st, pl in conn.execute(
            'SELECT class_name, SUM(gained), COUNT(DISTINCT student_key) FROM events WHERE slug = ? AND day >= ? GROUP BY class_name ORDER BY SUM(gained) DESC', (slug, since))]
        av = conn.execute('SELECT idx FROM avatar WHERE slug = ? AND class_name = ? AND student_key = ?', (slug, class_name, key)).fetchone()
        return dict(name=name, className=class_name,
                    stats={'stars': total, 'max': sum(p['max'] for p in per.values()), 'done': sum(p['done'] for p in per.values()),
                           'three': sum(p['three'] for p in per.values()), 'games': sum(1 for p in per.values() if p['stars']),
                           'rank': RANKS[rank][1], 'rankNext': nxt[1] if nxt else None, 'rankNeed': (nxt[0] - total) if nxt else 0,
                           'rankProgress': round((total - lo) / (hi - lo), 3) if nxt else 1},
                    daily={'id': dg['id'], 'title': dg['title'], 'done': day_str(d) in days, 'streak': streak(days, d)} if dg else None,
                    badges=[{'id': b, 'title': t, 'how': h, 'got': b in had, 'at': had.get(b), 'fresh': b in fresh} for b, t, h in BADGES],
                    league={'place': place, 'stars': week, 'size': len(board), 'top': [{'name': r['name'], 'stars': r['stars'], 'me': r['key'] == key} for r in board[:5]]},
                    week=week_days, skills=skills, games=game_rows, warmup=warm, review=review, season=season, classes=classes,
                    avatar={'idx': int(av[0]) if av else 0, 'need': AVATAR_STARS})

    @app.route('/results/api/practicum/me', methods=['GET', 'POST'])
    def practicum_me():
        try:
            data = request.get_json(force=True, silent=True) if request.method == 'POST' else request.args
            if not isinstance(data, dict) and not hasattr(data, 'get'):
                raise Refused('Ожидается объект.')
            slug, grade, class_name, key, name = who(data)
            games = games_of(grade)
            with lock, connect() as conn:
                # прогресс читаем под тем же замком: иначе старое чтение перезапишет новый снимок и звёзды засчитаются дважды
                name, levels = progress(slug, class_name, key).get(key, (name, {}))
                observe(conn, slug, grade, class_name, key, name, levels, games)
                out = profile(conn, slug, grade, class_name, key, name, levels, games, award=True)
            return jsonify(status='ok', **out)
        except Refused as error:
            return fail(error)
        except (ValueError, TypeError, KeyError):
            return fail(Refused('Некорректный запрос.'))

    @app.route('/results/api/practicum/avatar', methods=['POST'])
    def practicum_avatar():
        """Ученик выбирает аватар; открыт он или нет — решает сервер по звёздам ученика."""
        try:
            data = request.get_json(force=True, silent=True)
            if not isinstance(data, dict):
                raise Refused('Ожидается объект.')
            slug, grade, class_name, key, name = who(data)
            idx = data.get('idx')
            if type(idx) is not int or not 0 <= idx < len(AVATAR_STARS):
                raise Refused('Нет такого аватара.')
            _, levels = progress(slug, class_name, key).get(key, (name, {}))
            total = stats_of(levels, games_of(grade))[1]
            if total < AVATAR_STARS[idx]:
                raise Refused(f'Этот аватар откроется с {AVATAR_STARS[idx]} звёзд.', 403)
            with lock, connect() as conn:
                conn.execute('INSERT OR REPLACE INTO avatar VALUES (?, ?, ?, ?)', (slug, class_name, key, idx))
            return jsonify(status='ok', idx=idx)
        except Refused as error:
            return fail(error)

    @app.route('/results/api/practicum/student')
    def practicum_student():
        """Учителю: профиль любого ученика класса (ничего не меняет: значки не выдаются, события не пишутся)."""
        try:
            if not is_teacher():
                raise Refused('Раздел учителя доступен только с учительского ноутбука.', 403)
            slug, grade, class_name, key, name = who(request.args)
            games = games_of(grade)
            found = progress(slug, class_name, key)
            if key not in found:
                raise Refused('Этот ученик ещё не играл.', 404)
            name, levels = found[key]
            with lock, connect() as conn:
                out = profile(conn, slug, grade, class_name, key, name, levels, games, award=False)
            return jsonify(status='ok', **out)
        except Refused as error:
            return fail(error)
        except (ValueError, TypeError, KeyError):
            return fail(Refused('Некорректный запрос.'))

    @app.route('/results/api/practicum/ping')
    def practicum_ping():
        return jsonify(status='ok', teacher=is_teacher())

    @app.route('/results/api/practicum/teacher')
    def practicum_teacher():
        """Учителю: таблица класса — звёзды, пройденные этапы, звёзды за неделю, серия, значки, игры с отметкой «5»."""
        try:
            if not is_teacher():
                raise Refused('Раздел учителя доступен только с учительского ноутбука.', 403)
            slug = str(request.args.get('slug') or '')
            m = SLUG.fullmatch(slug)
            class_name = str(request.args.get('className') or '')
            if not m or not CLASS.fullmatch(class_name):
                raise Refused('Неизвестный класс.')
            grade = int(m.group(1))
            games = games_of(grade)
            everyone = progress(slug, class_name)
            rows, stuck = [], {}
            with lock, connect() as conn:
                board = {r['key']: r['stars'] for r in week_board(conn, slug, class_name)}
                for key, (name, levels) in everyone.items():
                    per, total, rank = stats_of(levels, games)
                    days = {r[0] for r in conn.execute('SELECT day FROM daily WHERE slug = ? AND class_name = ? AND student_key = ?', (slug, class_name, key))}
                    got = conn.execute('SELECT COUNT(*) FROM awards WHERE slug = ? AND class_name = ? AND student_key = ?', (slug, class_name, key)).fetchone()[0]
                    sk = {area: round(sum(per[g]['stars'] for g in ids if g in per) / max(1, sum(per[g]['max'] for g in ids if g in per)), 3) for area, ids in AREAS if any(g in per for g in ids)}
                    for g in games:
                        if per[g['id']]['stars']:
                            n = next((n for n in range(1, g['levels'] + 1) if not levels.get(f"{g['id']}-{n}")), None)
                            if n:
                                stuck[(g['id'], n)] = stuck.get((g['id'], n), 0) + 1
                    rows.append({'name': name, 'skills': sk, 'stars': total, 'done': sum(p['done'] for p in per.values()), 'week': board.get(key, 0),
                                 'streak': streak(days, today()), 'badges': got, 'rank': RANKS[rank][1],
                                 'games': {g: p['stars'] for g, p in per.items() if p['stars']},
                                 'fives': [g['title'] for g in games if per[g['id']]['stars'] * 100 >= GRADING_FIVE * per[g['id']]['max']]})
            rows.sort(key=lambda r: (-r['stars'], r['name']))
            titles = {g['id']: g['title'] for g in games}
            hard = [{'game': g, 'title': titles[g], 'level': n, 'stuck': c} for (g, n), c in sorted(stuck.items(), key=lambda x: -x[1])[:8] if c >= 2]
            areas = [a for a, ids in AREAS if any(g in titles for g in ids)]
            return jsonify(status='ok', games=[{'id': g['id'], 'title': g['title'], 'max': 3 * g['levels']} for g in games], students=rows, areas=areas, hard=hard)
        except Refused as error:
            return fail(error)
