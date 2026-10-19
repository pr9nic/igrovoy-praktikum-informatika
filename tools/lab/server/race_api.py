"""«Гонка алгоритмов»: общее состязание класса. Учитель запускает задание (поле с роботом), ученики присылают программы,
сервер сам прогоняет каждую и ведёт таблицу: короче программа — выше место, при равенстве — кто раньше.
Подключается к журналу одной строкой: install_race(app). Всё хранится в памяти процесса, в журнал и на диск ничего не пишется.
"""
import re
import secrets
import threading
import time

from flask import jsonify, request

from portal_security import is_teacher

CLASS = re.compile(r'(\d{1,2}) «[А-ЯЁ]»')
DX, DY = (0, 1, 0, -1), (-1, 0, 1, 0)


class Refused(Exception):
    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code


def valid(prog, depth=0):
    return isinstance(prog, list) and depth <= 3 and all(
        c in ('F', 'L', 'R') if isinstance(c, str) else isinstance(c, dict) and type(c.get('n')) is int and 2 <= c['n'] <= 9 and valid(c.get('body'), depth + 1) for c in prog)


def size(prog):
    return sum(1 if isinstance(c, str) else 1 + size(c['body']) for c in prog)


def simulate(grid, direction, prog, limit=400):
    """Те же правила, что в клиенте: врезание останавливает робота; нужно собрать все батарейки и встать на финиш, если он есть."""
    x = y = 0
    stars, goal = set(), None
    for yy, row in enumerate(grid):
        for xx, ch in enumerate(row):
            if ch == 'S':
                x, y = xx, yy
            elif ch == '*':
                stars.add((xx, yy))
            elif ch == 'G':
                goal = (xx, yy)
    state = {'x': x, 'y': y, 'd': direction, 'steps': 0, 'crash': False, 'got': set()}

    def run(items):
        for c in items:
            if state['crash'] or state['steps'] >= limit:
                return
            if not isinstance(c, str):
                for _ in range(c['n']):
                    if state['crash'] or state['steps'] >= limit:
                        break
                    run(c['body'])
                continue
            state['steps'] += 1
            if c == 'L':
                state['d'] = (state['d'] + 3) % 4
            elif c == 'R':
                state['d'] = (state['d'] + 1) % 4
            else:
                nx, ny = state['x'] + DX[state['d']], state['y'] + DY[state['d']]
                if not (0 <= ny < len(grid) and 0 <= nx < len(grid[ny])) or grid[ny][nx] == '#':
                    state['crash'] = True
                    return
                state['x'], state['y'] = nx, ny
                if (nx, ny) in stars:
                    state['got'].add((nx, ny))

    run(prog)
    here = (state['x'], state['y'])
    return not state['crash'] and state['got'] == stars and (here == goal if goal else bool(stars))


class Race:
    def __init__(self):
        self.rooms = {}
        self.lock = threading.Lock()

    def room(self, class_name):
        m = CLASS.fullmatch(str(class_name or ''))
        if not m or not 6 <= int(m.group(1)) <= 11:
            raise Refused('Выберите свой класс.')
        return self.rooms.setdefault(class_name, {'name': class_name, 'players': {}, 'task': None, 'next': 1, 'task_n': 0})

    def join(self, class_name, name, now):
        room = self.room(class_name)
        name = re.sub(r'\s+', ' ', str(name or '').strip())
        if not 5 <= len(name) <= 80 or ' ' not in name or any(ord(c) < 32 for c in name):
            raise Refused('Укажите фамилию и имя.')
        key = name.lower().replace('ё', 'е')
        for p in room['players'].values():
            if p['key'] == key:
                p['token'], p['seen'] = secrets.token_urlsafe(12), now
                return p
        if len(room['players']) >= 40:
            raise Refused('В гонке уже 40 участников.', 409)
        p = {'id': room['next'], 'token': secrets.token_urlsafe(12), 'name': name, 'key': key, 'seen': now, 'best': None}
        room['next'] += 1
        room['players'][p['id']] = p
        return p

    def who(self, class_name, pid, token):
        room = self.rooms.get(class_name)
        p = room and room['players'].get(pid)
        if not p or not secrets.compare_digest(p['token'].encode(), str(token or '').encode()):
            raise Refused('Связь с гонкой потеряна. Войдите заново.', 401)
        return room, p

    def start(self, room, data, now):
        grid, direction, title, minutes = data.get('map'), data.get('dir'), str(data.get('title') or 'Задание')[:60], data.get('minutes')
        ok = isinstance(grid, list) and 1 <= len(grid) <= 20 and all(isinstance(r, str) and 1 <= len(r) <= 20 and len(r) == len(grid[0]) and not set(r) - set('.#SG*') for r in grid)
        if not ok or ''.join(grid).count('S') != 1 or direction not in (0, 1, 2, 3) or type(minutes) is not int or not 1 <= minutes <= 30:
            raise Refused('Задание задано неверно.')
        room['task_n'] += 1
        room['task'] = {'id': room['task_n'], 'title': title, 'map': grid, 'dir': direction, 'started': now, 'until': now + minutes * 60, 'stopped': False}
        for p in room['players'].values():
            p['best'] = None

    def submit(self, room, p, task_id, prog, now):
        t = room['task']
        if not t or t['id'] != task_id or t['stopped'] or now > t['until']:
            raise Refused('Время этого задания вышло.', 409)
        if not valid(prog) or not prog or size(prog) > 80:
            raise Refused('Программа составлена неверно.')
        if not simulate(t['map'], t['dir'], prog):
            raise Refused('Сервер проверил программу: робот не выполнил задание.')
        n, best = size(prog), p['best']
        better = best is None or n < best['size']
        if better:
            p['best'] = {'size': n, 'time': round(now - t['started']), 'program': prog}
        return {'size': n, 'best': better, 'mine': p['best']['size']}

    def view(self, room, p, now, teacher):
        t = room['task']
        phase = 'idle' if not t else 'run' if not t['stopped'] and now <= t['until'] else 'done'
        show = phase == 'done' or teacher          # решения видны всем только после завершения
        rows = sorted((q for q in room['players'].values() if q['best']), key=lambda q: (q['best']['size'], q['best']['time']))
        board = [dict({'name': q['name'], 'size': q['best']['size'], 'time': q['best']['time'], 'me': bool(p) and q['id'] == p['id']}, **({'program': q['best']['program']} if show else {})) for q in rows]
        return {'status': 'ok', 'phase': phase, 'teacher': teacher, 'players': sum(1 for q in room['players'].values() if now - q['seen'] < 30),
                'task': {'id': t['id'], 'title': t['title'], 'map': t['map'], 'dir': t['dir'], 'left': max(0, round(t['until'] - now)) if phase == 'run' else 0} if t else None, 'board': board}


def install_race(app):
    race = Race()
    app.race_game = race

    def fail(error):
        return jsonify(status='error', message=str(error)), getattr(error, 'code', 400)

    def body():
        data = request.get_json(force=True, silent=True)
        if not isinstance(data, dict):
            raise Refused('Ожидается объект.')
        return data

    @app.route('/results/api/race/join', methods=['POST'])
    def race_join():
        try:
            data = body()
            with race.lock:
                p = race.join(data.get('className'), data.get('name'), time.time())
                return jsonify(status='ok', id=p['id'], token=p['token'], teacher=is_teacher())
        except Refused as error:
            return fail(error)

    @app.route('/results/api/race/state', methods=['POST'])
    def race_state():
        try:
            data, now = body(), time.time()
            with race.lock:
                room, p = race.who(data.get('className'), data.get('id'), data.get('token'))
                p['seen'] = now
                return jsonify(race.view(room, p, now, is_teacher()))
        except Refused as error:
            return fail(error)

    @app.route('/results/api/race/submit', methods=['POST'])
    def race_submit():
        try:
            data, now = body(), time.time()
            with race.lock:
                room, p = race.who(data.get('className'), data.get('id'), data.get('token'))
                p['seen'] = now
                return jsonify(status='ok', **race.submit(room, p, data.get('task'), data.get('program'), now))
        except Refused as error:
            return fail(error)

    @app.route('/results/api/race/teacher', methods=['POST'])
    def race_teacher():
        try:
            if not is_teacher():
                raise Refused('Управление гонкой доступно только с учительского ноутбука.', 403)
            data, now = body(), time.time()
            with race.lock:
                room, action = race.room(data.get('className')), data.get('action')
                if action == 'start':
                    race.start(room, data, now)
                elif action == 'stop' and room['task']:
                    room['task']['stopped'] = True
                elif action == 'clear':
                    race.rooms.pop(room['name'], None)
                    return jsonify(status='ok', cleared=True)
                return jsonify(race.view(room, None, now, True))
        except Refused as error:
            return fail(error)

    return race
