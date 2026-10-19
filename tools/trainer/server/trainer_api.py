"""Игровой тренажёр «Кодоград»: прогресс учеников, списки классов, задание на урок.

Подключается к журналу одной строкой: install_trainer(app, ...). Свои данные
хранит в отдельной базе trainer.db; в журнал пишет только отметку за мир —
одной строкой на ученика и мир, с обновлением при улучшении результата.
"""
import json
import re
import sqlite3
import threading
from contextlib import closing
from datetime import datetime

from flask import jsonify, request

from portal_security import client_ip, is_teacher

SLUG = re.compile(r'trainer-(6|7|8|9|10|11)-[a-z0-9-]{1,40}')   # класс без ведущего нуля: «08 «А»» был бы классом без списка
CLASS = re.compile(r'(6|7|8|9|10|11) «[А-ЯЁ]»')
MAX_LEVELS = 300
ITEM = re.compile(r'[a-z][a-z0-9-]{1,40}')
MARKER = ': Кодоград'


def norm(name):
    return re.sub(r'\s+', ' ', str(name).strip().lower().replace('ё', 'е'))


def install_trainer(app, data_dir, journal_db, after_journal_change=None, computer_name=None):
    db_path = data_dir / 'trainer.db'

    def connect():
        return closing(sqlite3.connect(db_path, timeout=10))

    with connect() as conn, conn:
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('CREATE TABLE IF NOT EXISTS roster (class_name TEXT NOT NULL, student_key TEXT NOT NULL, '
                     'student_name TEXT NOT NULL, PRIMARY KEY (class_name, student_key))')
        conn.execute('CREATE TABLE IF NOT EXISTS progress (slug TEXT NOT NULL, class_name TEXT NOT NULL, '
                     'student_key TEXT NOT NULL, student_name TEXT NOT NULL, levels_json TEXT NOT NULL, '
                     'sent_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (slug, class_name, student_key))')
        conn.execute('CREATE TABLE IF NOT EXISTS assignment (slug TEXT NOT NULL, class_name TEXT NOT NULL, '
                     'world_id TEXT NOT NULL, set_at TEXT NOT NULL, PRIMARY KEY (slug, class_name))')

    class Refused(Exception):
        def __init__(self, message, code=400):
            super().__init__(message)
            self.code = code

    def fail(error):
        return jsonify(status='error', message=str(error)), getattr(error, 'code', 400)

    def now():
        return datetime.now().strftime('%d.%m.%Y %H:%M:%S')

    def slug_of(value):
        match = SLUG.fullmatch(str(value or ''))
        if not match:
            raise Refused('Неизвестный тренажёр.')
        return match.group(0), match.group(1)

    def class_of(value, grade):
        match = CLASS.fullmatch(str(value or ''))
        if not match or match.group(1) != grade:
            raise Refused('Выберите свой класс.')
        return match.group(0)

    def name_of(value):
        name = re.sub(r'\s+', ' ', str(value or '').strip())
        if not 5 <= len(name) <= 80 or ' ' not in name or any(ord(c) < 32 for c in name):
            raise Refused('Укажите фамилию и имя.')
        return name

    def student(conn, data):
        """Checked (slug, class, key, display name); display name comes from the class list when there is one."""
        slug, grade = slug_of(data.get('slug'))
        class_name = class_of(data.get('className'), grade)
        name = name_of(data.get('name'))
        key = norm(name)
        listed = dict(conn.execute('SELECT student_key, student_name FROM roster WHERE class_name = ?', (class_name,)))
        if listed:
            if key not in listed:
                raise Refused('Выберите себя из списка класса.', 403)
            name = listed[key]
        else:
            known = conn.execute('SELECT student_name FROM progress WHERE class_name = ? AND student_key = ? LIMIT 1', (class_name, key)).fetchone()
            if known:
                name = known[0]
        return slug, class_name, key, name

    def clean_levels(raw):
        if not isinstance(raw, dict) or len(raw) > MAX_LEVELS:
            raise Refused('Некорректный прогресс.')
        levels = {}
        for level_id, rec in raw.items():
            if not ITEM.fullmatch(str(level_id)) or not isinstance(rec, dict) or rec.get('stars') not in (1, 2, 3):
                raise Refused('Некорректный прогресс.')
            levels[level_id] = {'stars': rec['stars'], 'detail': str(rec.get('detail', ''))[:80],
                                'plays': min(int(rec.get('plays', 1) or 1), 9999), 'clean': bool(rec.get('clean'))}
        return levels

    def merged(old, new):
        result = dict(old)
        for level_id, rec in new.items():
            before = result.get(level_id)
            if not before or rec['stars'] > before.get('stars', 0):
                result[level_id] = {**rec, 'plays': max(rec['plays'], before.get('plays', 0) if before else 0),
                                    'clean': rec['clean'] or bool(before and before.get('clean'))}
            else:
                result[level_id] = {**before, 'plays': max(rec['plays'], before.get('plays', 0)),
                                    'clean': rec['clean'] or bool(before.get('clean'))}
        return result

    def load(conn, slug, class_name, key):
        row = conn.execute('SELECT levels_json, sent_json FROM progress WHERE slug = ? AND class_name = ? AND student_key = ?',
                           (slug, class_name, key)).fetchone()
        return (json.loads(row[0]), json.loads(row[1])) if row else ({}, {})

    def store(conn, slug, class_name, key, name, levels, sent):
        conn.execute('INSERT INTO progress VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (slug, class_name, student_key) DO UPDATE SET '
                     'student_name = excluded.student_name, levels_json = excluded.levels_json, sent_json = excluded.sent_json, '
                     'updated_at = excluded.updated_at',
                     (slug, class_name, key, name, json.dumps(levels, ensure_ascii=False), json.dumps(sent, ensure_ascii=False), now()))

    def classes_payload(conn, slug, grade):
        roster = {}
        for class_name, name in conn.execute('SELECT class_name, student_name FROM roster WHERE class_name LIKE ? ORDER BY student_name',
                                             (grade + ' «%',)):
            roster.setdefault(class_name, []).append(name)
        assignment = dict(conn.execute('SELECT class_name, world_id FROM assignment WHERE slug = ?', (slug,)))
        return roster, assignment

    @app.route('/results/api/trainer/classes')
    def trainer_classes():
        try:
            slug, grade = slug_of(request.args.get('slug'))
            with connect() as conn:
                roster, assignment = classes_payload(conn, slug, grade)
            return jsonify(status='ok', roster=roster, assignment=assignment, teacher=is_teacher())
        except Refused as error:
            return fail(error)

    @app.route('/results/api/trainer/leaderboard')
    def trainer_leaderboard():
        """Best saved boss stars for the player's own class; never reads or changes journal grades."""
        try:
            with connect() as conn:
                slug, class_name, own_key, own_name = student(conn, request.args)
                if not re.fullmatch(r'trainer-(6|7|8|9|10|11)-glitch', slug):
                    raise Refused('Рекорды доступны для «Битвы с Глюком».')
                count = 4 if slug.startswith('trainer-6-') else 5
                allowed = {f'boss-{i}' for i in range(1, count + 1)}
                names = dict(conn.execute('SELECT student_key, student_name FROM roster WHERE class_name = ?', (class_name,)))
                records = {}
                for key, name, raw in conn.execute('SELECT student_key, student_name, levels_json FROM progress WHERE slug = ? AND class_name = ?', (slug, class_name)):
                    if names and key not in names:continue
                    try:levels = json.loads(raw)
                    except (ValueError, TypeError):levels = {}
                    stars = [rec.get('stars') for level_id, rec in levels.items() if level_id in allowed and isinstance(rec, dict) and type(rec.get('stars')) is int and 1 <= rec['stars'] <= 3] if isinstance(levels, dict) else []
                    records[key] = dict(name=names.get(key, name), stars=sum(stars), bosses=len(stars), mine=key == own_key)
                for key, name in names.items():
                    records.setdefault(key, dict(name=name, stars=0, bosses=0, mine=key == own_key))
                records.setdefault(own_key, dict(name=own_name, stars=0, bosses=0, mine=True))
                rows = sorted(records.values(), key=lambda row: (-row['stars'], row['name'].casefold()))
                previous = None
                for index, row in enumerate(rows, 1):
                    if row['stars'] != previous:rank = index
                    row['rank'] = rank; previous = row['stars']
            return jsonify(status='ok', className=class_name, maxStars=count * 3, bossCount=count, rows=rows)
        except Refused as error:
            return fail(error)

    @app.route('/results/api/trainer/progress', methods=['GET', 'POST'])
    def trainer_progress():
        try:
            data = request.get_json(force=True) if request.method == 'POST' else request.args
            if not isinstance(data, dict) and request.method == 'POST':
                raise Refused('Ожидается объект.')
            with connect() as conn, conn:
                conn.execute('BEGIN IMMEDIATE')
                slug, class_name, key, name = student(conn, data)
                levels, sent = load(conn, slug, class_name, key)
                if request.method == 'POST':
                    levels = merged(levels, clean_levels(data.get('levels')))
                    if len(levels) > MAX_LEVELS:   # предел на ученика, а не только на один запрос
                        raise Refused('Некорректный прогресс.')
                    store(conn, slug, class_name, key, name, levels, sent)
            return jsonify(status='ok', name=name, levels=levels, sent=sent)
        except Refused as error:
            return fail(error)
        except (ValueError, TypeError, OverflowError):   # OverflowError: Infinity и 1e999 в JSON
            return fail(Refused('Некорректный запрос.'))

    @app.route('/results/api/trainer/submit', methods=['POST'])
    def trainer_submit():
        try:
            data = request.get_json(force=True)
            if not isinstance(data, dict):
                raise Refused('Ожидается объект.')
            world_id = str(data.get('worldId') or '')
            topic = re.sub(r'\s+', ' ', str(data.get('topic') or '').strip())
            score, maximum, mark = int(data.get('score', -1)), int(data.get('maxScore', 0)), int(data.get('mark', 0))
            answers = data.get('answers') or []
            if not ITEM.fullmatch(world_id) or MARKER not in topic or len(topic) > 300:
                raise Refused('Некорректный мир.')
            if not 0 < score <= maximum <= 90 or mark not in (2, 3, 4, 5):
                raise Refused('Некорректное количество звёзд или отметка.')
            if not isinstance(answers, list) or len(answers) > 30 or len(json.dumps(answers)) > 20000:
                raise Refused('Некорректные подробности.')
            with connect() as conn, conn:
                conn.execute('BEGIN IMMEDIATE')
                slug, class_name, key, name = student(conn, data)
                levels, sent = load(conn, slug, class_name, key)
                earned = sum(rec['stars'] for level_id, rec in levels.items() if re.fullmatch(re.escape(world_id) + r'-\d+', level_id))
                if score > earned:
                    raise Refused('Прогресс ещё не сохранён на сервере. Повторите отправку.', 409)
                ip = client_ip()
                computer = computer_name(ip) if computer_name else ''
                stamp, percent = now(), round(score / maximum * 100)
                details = json.dumps(answers, ensure_ascii=False)
                with closing(sqlite3.connect(journal_db, timeout=10)) as journal, journal:
                    journal.execute('BEGIN IMMEDIATE')
                    old = journal.execute('SELECT id, score, mark FROM test_results WHERE student_name = ? AND class_name = ? '
                                          'AND topic = ? ORDER BY id DESC LIMIT 1', (name, class_name, topic)).fetchone()
                    if old and old[1] >= score:
                        record_id, updated, score, mark = old[0], False, old[1], old[2]
                    elif old:
                        journal.execute('UPDATE test_results SET created_at = ?, ip_address = ?, computer_name = ?, score = ?, '
                                        'max_score = ?, percent = ?, mark = ?, details_json = ? WHERE id = ?',
                                        (stamp, ip, computer, score, maximum, percent, mark, details, old[0]))
                        record_id, updated = old[0], True
                    else:
                        record_id = journal.execute(
                            'INSERT INTO test_results (created_at, ip_address, computer_name, student_name, class_name, topic, '
                            'score, max_score, percent, mark, attempt, details_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
                            (stamp, ip, computer, name, class_name, topic, score, maximum, percent, mark, details)).lastrowid
                        updated = True
                sent[world_id] = {'stars': score, 'mark': mark, 'id': record_id, 'time': stamp}
                store(conn, slug, class_name, key, name, levels, sent)
            if updated and after_journal_change:
                threading.Thread(target=after_journal_change, daemon=True).start()
            return jsonify(status='ok', id=record_id, time=stamp, updated=updated, sent=sent)
        except Refused as error:
            return fail(error)
        except (ValueError, TypeError, OverflowError):   # OverflowError: Infinity и 1e999 в JSON
            return fail(Refused('Некорректный запрос.'))

    def teacher_only():
        if not is_teacher():
            raise Refused('Раздел учителя доступен только с учительского ноутбука.', 403)

    @app.route('/results/api/trainer/overview')
    def trainer_overview():
        try:
            teacher_only()
            slug, grade = slug_of(request.args.get('slug'))
            with connect() as conn:
                roster, assignment = classes_payload(conn, slug, grade)
                students = [{'className': c, 'name': n, 'levels': json.loads(l), 'sent': json.loads(s), 'updated': u}
                            for c, n, l, s, u in conn.execute('SELECT class_name, student_name, levels_json, sent_json, updated_at '
                                                              'FROM progress WHERE slug = ? ORDER BY class_name, student_name', (slug,))]
            return jsonify(status='ok', roster=roster, assignment=assignment, students=students)
        except Refused as error:
            return fail(error)

    @app.route('/results/api/trainer/roster', methods=['POST'])
    def trainer_roster():
        try:
            teacher_only()
            data = request.get_json(force=True)
            slug, grade = slug_of(data.get('slug'))
            class_name = class_of(data.get('className'), grade)
            names = data.get('names')
            if not isinstance(names, list) or len(names) > 60:
                raise Refused('В списке класса не больше 60 учеников.')
            listed = {}
            for raw in names:
                name = name_of(raw)
                listed[norm(name)] = name
            with connect() as conn, conn:
                conn.execute('DELETE FROM roster WHERE class_name = ?', (class_name,))
                conn.executemany('INSERT INTO roster VALUES (?, ?, ?)', [(class_name, k, n) for k, n in listed.items()])
            return jsonify(status='ok', count=len(listed))
        except Refused as error:
            return fail(error)
        except (ValueError, TypeError, AttributeError):
            return fail(Refused('Некорректный запрос.'))

    @app.route('/results/api/trainer/assignment', methods=['POST'])
    def trainer_assignment():
        try:
            teacher_only()
            data = request.get_json(force=True)
            slug, grade = slug_of(data.get('slug'))
            class_name = class_of(data.get('className'), grade)
            world_id = str(data.get('worldId') or '')
            if world_id and not ITEM.fullmatch(world_id):
                raise Refused('Некорректный мир.')
            with connect() as conn, conn:
                conn.execute('DELETE FROM assignment WHERE slug = ? AND class_name = ?', (slug, class_name))
                if world_id:
                    conn.execute('INSERT INTO assignment VALUES (?, ?, ?, ?)', (slug, class_name, world_id, now()))
            return jsonify(status='ok')
        except Refused as error:
            return fail(error)
        except (ValueError, TypeError, AttributeError):
            return fail(Refused('Некорректный запрос.'))

    @app.route('/results/api/trainer/reset', methods=['POST'])
    def trainer_reset():
        """Teacher removes one student's game progress (e.g. a trial profile). Journal rows are not touched."""
        try:
            teacher_only()
            data = request.get_json(force=True)
            slug, grade = slug_of(data.get('slug'))
            class_name = class_of(data.get('className'), grade)
            with connect() as conn, conn:
                removed = conn.execute('DELETE FROM progress WHERE slug = ? AND class_name = ? AND student_key = ?',
                                       (slug, class_name, norm(data.get('name', '')))).rowcount
            return jsonify(status='ok', removed=removed)
        except Refused as error:
            return fail(error)
        except (ValueError, TypeError, AttributeError):
            return fail(Refused('Некорректный запрос.'))
