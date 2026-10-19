"""Рекорды клавиатурного тренажёра «Побег от Тенегрыза»: лучший результат школы и класса на каждом этапе.
Подключается к журналу одной строкой: install_typing(app, DATA_DIR). Хранит только рекорды в своём файле typing_records.db;
журнал оценок не читает и не меняет. Результат присылает браузер ученика, поэтому это доска почёта, а не защищённый зачёт.
"""
import re
import sqlite3
import threading
import time
from contextlib import closing
from datetime import datetime
from pathlib import Path

from flask import jsonify, request

from portal_security import is_teacher

CLASS = re.compile(r'(\d{1,2}) «[А-ЯЁ]»')
MODES = ('easy', 'normal', 'hard', 'hardcore')


class Refused(Exception):
    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code


def short(name):
    """«Фамилия Имя» -> «Имя Ф.»: на доске почёта полная фамилия не показывается."""
    parts = name.split()
    return f'{parts[1]} {parts[0][0]}.' if len(parts) >= 2 else name


def install_typing(app, data_dir):
    db_path = Path(data_dir) / 'typing_records.db'
    lock = threading.Lock()
    tours = {}          # турниры классов: живут в памяти, пока идут; {класс: {level, lang, difficulty, until, board}}

    def connect():
        conn = sqlite3.connect(db_path, timeout=10)
        conn.execute('CREATE TABLE IF NOT EXISTS records (class_name TEXT, student_key TEXT, name TEXT, level INTEGER, lang TEXT, difficulty TEXT, '
                     'cpm INTEGER, accuracy INTEGER, created TEXT, PRIMARY KEY (class_name, student_key, level, lang, difficulty))')
        return conn

    def fail(error):
        return jsonify(status='error', message=str(error)), getattr(error, 'code', 400)

    def stage(data):
        level, lang, difficulty = data.get('level'), data.get('lang'), data.get('difficulty')
        if type(level) is not int or not 0 <= level <= 40 or lang not in ('ru', 'en') or difficulty not in MODES:
            raise Refused('Этап задан неверно.')
        return level, lang, difficulty

    def top(conn, level, lang, difficulty, class_name, key):
        def best(where, args):
            row = conn.execute('SELECT name, class_name, cpm, accuracy FROM records WHERE level = ? AND lang = ? AND difficulty = ?' + where + ' ORDER BY cpm DESC, accuracy DESC, created LIMIT 1',
                               (level, lang, difficulty) + args).fetchone()
            return {'name': short(row[0]), 'className': row[1], 'cpm': row[2], 'accuracy': row[3]} if row else None
        valid = bool(class_name and CLASS.fullmatch(class_name))
        return {'school': best('', ()), 'class': best(' AND class_name = ?', (class_name,)) if valid else None,
                'mine': best(' AND class_name = ? AND student_key = ?', (class_name, key)) if valid and key else None}

    def body():
        data = request.get_json(force=True, silent=True)
        if not isinstance(data, dict):
            raise Refused('Ожидается объект.')
        return data

    def who(data):
        class_name = str(data.get('className') or '')
        name = re.sub(r'\s+', ' ', str(data.get('name') or '').strip())
        m = CLASS.fullmatch(class_name)
        if not m or not 5 <= int(m.group(1)) <= 11:
            raise Refused('Выберите свой класс.')
        if not 5 <= len(name) <= 80 or ' ' not in name or any(ord(c) < 32 for c in name):
            raise Refused('Укажите фамилию и имя.')
        return class_name, name, name.lower().replace('ё', 'е')

    @app.route('/results/api/typing/top', methods=['POST'])
    def typing_top():
        try:
            data = body()
            level, lang, difficulty = stage(data)
            name = re.sub(r'\s+', ' ', str(data.get('name') or '').strip())
            with lock, closing(connect()) as conn:
                return jsonify(status='ok', **top(conn, level, lang, difficulty, str(data.get('className') or ''), name.lower().replace('ё', 'е')))
        except Refused as error:
            return fail(error)

    def tour_view(class_name, now):
        t = tours.get(class_name)
        if not t:
            return None
        board = sorted(t['board'].values(), key=lambda r: (-r['cpm'], -r['accuracy'], r['t']))
        return {'level': t['level'], 'lang': t['lang'], 'difficulty': t['difficulty'], 'left': max(0, round(t['until'] - now)), 'running': now < t['until'] and not t['stopped'],
                'board': [{'name': short(r['name']), 'cpm': r['cpm'], 'accuracy': r['accuracy']} for r in board[:40]], 'players': len(board)}

    @app.route('/results/api/typing/tour', methods=['POST'])
    def typing_tour():
        try:
            data = body()
            with lock:
                return jsonify(status='ok', teacher=is_teacher(), tour=tour_view(str(data.get('className') or ''), time.time()))
        except Refused as error:
            return fail(error)

    @app.route('/results/api/typing/record', methods=['POST'])
    def typing_record():
        try:
            data = body()
            level, lang, difficulty = stage(data)
            class_name, name, key = who(data)
            cpm, accuracy, chars, seconds = data.get('cpm'), data.get('accuracy'), data.get('chars'), data.get('seconds')
            if any(type(v) not in (int, float) for v in (cpm, accuracy, chars, seconds)) or not (1 <= cpm <= 800 and 50 <= accuracy <= 100 and 20 <= chars <= 4000 and seconds >= 4):
                raise Refused('Результат выглядит неправдоподобно.')
            if abs(chars / seconds * 60 - cpm) > max(6, cpm * 0.05):
                raise Refused('Скорость не сходится с временем и числом знаков.')
            with lock, closing(connect()) as conn, conn:
                before = top(conn, level, lang, difficulty, class_name, key)
                old = conn.execute('SELECT cpm FROM records WHERE class_name = ? AND student_key = ? AND level = ? AND lang = ? AND difficulty = ?', (class_name, key, level, lang, difficulty)).fetchone()
                if not old or cpm > old[0]:
                    conn.execute('INSERT OR REPLACE INTO records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', (class_name, key, name, level, lang, difficulty, int(cpm), int(accuracy), datetime.now().strftime('%d.%m.%Y %H:%M:%S')))
                after = top(conn, level, lang, difficulty, class_name, key)
                t, now = tours.get(class_name), time.time()
                if t and not t['stopped'] and now < t['until'] and (t['level'], t['lang'], t['difficulty']) == (level, lang, difficulty):
                    old_t = t['board'].get(key)
                    if not old_t or cpm > old_t['cpm']:
                        t['board'][key] = {'name': name, 'cpm': int(cpm), 'accuracy': int(accuracy), 't': now}
                after['tour'] = tour_view(class_name, now)
            return jsonify(status='ok', newSchool=not before['school'] or cpm > before['school']['cpm'], newClass=not before['class'] or cpm > before['class']['cpm'], **after)
        except Refused as error:
            return fail(error)

    @app.route('/results/api/typing/mine', methods=['POST'])
    def typing_mine():
        """Этапы, которые ученик уже прошёл (по его рекордам): по ним тренажёр открывает следующие этапы на любом компьютере."""
        try:
            class_name, name, key = who(body())
            with closing(connect()) as conn:
                levels = sorted({r[0] for r in conn.execute('SELECT level FROM records WHERE class_name = ? AND student_key = ?', (class_name, key))})
            return jsonify(status='ok', levels=levels)
        except Refused as error:
            return fail(error)

    @app.route('/results/api/typing/teacher', methods=['POST'])
    def typing_teacher():
        try:
            if not is_teacher():
                raise Refused('Доступно только с учительского ноутбука.', 403)
            data = body()
            with lock, closing(connect()) as conn, conn:
                if data.get('action') == 'list':
                    rows = conn.execute('SELECT class_name, name, level, lang, difficulty, cpm, accuracy, created FROM records ORDER BY cpm DESC LIMIT 300').fetchall()
                    return jsonify(status='ok', rows=[dict(zip(('className', 'name', 'level', 'lang', 'difficulty', 'cpm', 'accuracy', 'created'), r)) for r in rows])
                if data.get('action') == 'remove':
                    n = conn.execute('DELETE FROM records WHERE class_name = ? AND name = ?', (str(data.get('className') or ''), str(data.get('name') or ''))).rowcount
                    return jsonify(status='ok', removed=n)
                if data.get('action') == 'clear':
                    return jsonify(status='ok', removed=conn.execute('DELETE FROM records').rowcount)
                class_name = str(data.get('className') or '')
                if data.get('action') == 'tour_start':
                    if not CLASS.fullmatch(class_name):
                        raise Refused('Выберите класс.')
                    level, lang, difficulty = stage(data)
                    minutes = data.get('minutes')
                    if type(minutes) is not int or not 1 <= minutes <= 30:
                        raise Refused('Время турнира: от 1 до 30 минут.')
                    tours[class_name] = {'level': level, 'lang': lang, 'difficulty': difficulty, 'until': time.time() + minutes * 60, 'stopped': False, 'board': {}}
                    return jsonify(status='ok', tour=tour_view(class_name, time.time()))
                if data.get('action') == 'tour_stop' and class_name in tours:
                    tours[class_name]['stopped'] = True
                    return jsonify(status='ok', tour=tour_view(class_name, time.time()))
            raise Refused('Неизвестное действие.')
        except Refused as error:
            return fail(error)
