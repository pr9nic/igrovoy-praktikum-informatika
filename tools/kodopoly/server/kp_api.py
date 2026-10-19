"""«Кодополия» по сети: лобби класса на 2–4 учеников за разными компьютерами.

Ученик сам создаёт лобби с названием или входит в лобби друзей из списка своего класса. Когда собрались четверо,
партия начинается сама; создатель лобби может начать и раньше (от двух игроков) — свободные места займут боты.
Логику партии ведёт игра на компьютере создателя (место 0): она забирает ходы гостей и выкладывает снимок поля.
Лобби живут в памяти сервера; в журнал ничего не пишется.
"""
import re
import secrets
import threading
import time

from flask import jsonify, request

CLASS = re.compile(r'(6|7|8|9|10|11) «[АБВГДЕЖЗИК]»')
TTL = 3 * 3600      # брошенная партия удаляется через три часа
GONE = 12           # кто не отвечает 12 секунд, уходит из лобби (до начала партии)
LOST = 120          # начатая партия, где две минуты никто не на связи, брошена
SEATS = 4


def norm(name):
    return re.sub(r'\s+', ' ', str(name).strip().lower().replace('ё', 'е'))


def short(name):
    p = str(name).split()
    return f'{p[1]} {p[0][0]}.' if len(p) >= 2 else str(name)


class Refused(Exception):
    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code


class Tables:
    def __init__(self):
        self.tables = {}
        self.next_id = 1
        self.lock = threading.Lock()

    def clean(self, now):
        for t in list(self.tables.values()):
            if not t['started']:
                self._drop_gone(t, now)
            if not t['seats'] or now - t['touched'] > TTL or (t['started'] and all(now - s['seen'] > LOST for s in t['seats'])):
                self.tables.pop(t['id'], None)

    def _drop_gone(self, t, now):
        t['seats'] = [s for s in t['seats'] if now - s['seen'] < GONE]
        for i, s in enumerate(t['seats']):
            s['seat'] = i          # первый оставшийся становится создателем

    def person(self, class_name, name):
        if not CLASS.fullmatch(str(class_name or '')):
            raise Refused('Неизвестный класс.')
        name = re.sub(r'\s+', ' ', str(name or '').strip())
        if not 5 <= len(name) <= 80 or ' ' not in name:
            raise Refused('Укажите фамилию и имя.')
        return name

    def _leave_others(self, class_name, key, keep=None):
        # Ученик сидит только в одном лобби: переход в другое освобождает старое место.
        for t in self.tables.values():
            if t['cls'] == class_name and not t['started'] and t['id'] != keep:
                t['seats'] = [s for s in t['seats'] if s['key'] != key]
                for i, s in enumerate(t['seats']):
                    s['seat'] = i

    def create(self, class_name, name, title, now):
        name = self.person(class_name, name)
        title = re.sub(r'\s+', ' ', str(title or '').strip())[:40] or f'Лобби {short(name)}'
        if sum(1 for t in self.tables.values() if t['cls'] == class_name) >= 15:
            raise Refused('В классе уже 15 лобби — зайдите в одно из них.', 409)
        self._leave_others(class_name, norm(name))
        t = {'id': self.next_id, 'cls': class_name, 'title': title, 'seats': [], 'started': False, 'snap': None, 'inputs': [], 'touched': now}
        self.next_id += 1
        self.tables[t['id']] = t
        return t, self._seat(t, name, now)

    def _seat(self, t, name, now):
        if any(s['key'] == norm(name) for s in t['seats']):
            # Своё место вернёт только ключ (он хранится во вкладке); по одному имени чужой ключ не выдаём.
            raise Refused('Ты уже за этим столом. Если страница закрылась — подожди 15 секунд и войди снова.', 409)
        if t['started']:
            raise Refused('В этом лобби партия уже идёт.', 409)
        if len(t['seats']) >= SEATS:
            raise Refused('Лобби заполнено: уже четыре игрока.', 409)
        s = {'seat': len(t['seats']), 'name': name, 'key': norm(name), 'token': secrets.token_urlsafe(12), 'seen': now}
        t['seats'].append(s)
        if len(t['seats']) == SEATS:
            t['started'] = True      # собрались четверо — партия начинается сама
        return s

    def join(self, class_name, name, tid, now):
        name = self.person(class_name, name)
        t = self.tables.get(tid) if isinstance(tid, int) else None
        if not t or t['cls'] != class_name:
            raise Refused('Такого лобби уже нет.', 404)
        s = self._seat(t, name, now)
        self._leave_others(class_name, norm(name), keep=tid)   # старое место освобождаем, только когда новое уже занято
        t['touched'] = now
        return t, s

    def who(self, tid, token):
        t = self.tables.get(tid) if isinstance(tid, int) else None
        if not t:
            raise Refused('Такого лобби уже нет.', 404)
        for s in t['seats']:
            if isinstance(token, str) and secrets.compare_digest(s['token'].encode(), token.encode()):
                return t, s
        raise Refused('Тебя нет в этом лобби — войди заново.', 403)

    def lobby(self, class_name):
        return [{'id': t['id'], 'title': t['title'], 'players': [short(s['name']) for s in t['seats']], 'started': t['started']}
                for t in sorted(self.tables.values(), key=lambda t: (t['started'], t['id'])) if t['cls'] == class_name]


def install_kodopoly(app):
    T = Tables()
    app.kp_tables = T

    def fail(error):
        return jsonify(status='error', message=str(error)), getattr(error, 'code', 400)

    def body():
        data = request.get_json(force=True, silent=True)
        if not isinstance(data, dict):
            raise Refused('Ожидается объект.')
        return data

    def view(t, s):
        return {'status': 'ok', 'table': t['id'], 'title': t['title'], 'seat': s['seat'], 'token': s['token'], 'started': t['started'],
                'players': [x['name'] for x in t['seats']], 'host': short(t['seats'][0]['name'])}

    def route(name, fn):
        def handler():
            try:
                data, now = body(), time.time()
                with T.lock:
                    T.clean(now)
                    return jsonify(fn(data, now))
            except Refused as error:
                return fail(error)
        handler.__name__ = 'kp_' + name
        app.add_url_rule('/results/api/kp/' + name, view_func=handler, methods=['POST'])

    route('list', lambda d, now: {'status': 'ok', 'tables': T.lobby(str(d.get('className') or ''))})
    route('create', lambda d, now: view(*T.create(d.get('className'), d.get('name'), d.get('title'), now)))
    route('join', lambda d, now: view(*T.join(d.get('className'), d.get('name'), d.get('table'), now)))

    def state(d, now):
        t, s = T.who(d.get('table'), d.get('token'))
        s['seen'] = t['touched'] = now
        return view(t, s)
    route('state', state)

    def start(d, now):
        t, s = T.who(d.get('table'), d.get('token'))
        if s['seat'] != 0:
            raise Refused('Начать раньше может только создатель лобби.', 403)
        if len(t['seats']) < 2:
            raise Refused('Нужен хотя бы ещё один игрок.')
        t['started'] = True
        return view(t, s)
    route('start', start)

    def leave(d, now):
        t, s = T.who(d.get('table'), d.get('token'))
        if not t['started']:
            t['seats'].remove(s)
            for i, x in enumerate(t['seats']):
                x['seat'] = i
            if not t['seats']:
                T.tables.pop(t['id'], None)
        return {'status': 'ok'}
    route('leave', leave)

    def sync(d, now):
        """Партия: создатель выкладывает снимок и забирает ходы гостей; гость отправляет ход и получает снимок."""
        t, s = T.who(d.get('table'), d.get('token'))
        if not t['started']:
            raise Refused('Партия ещё не началась.', 409)
        s['seen'] = t['touched'] = now
        online = [now - x['seen'] < 15 for x in t['seats']]
        names = [x['name'] for x in t['seats']]
        if s['seat'] == 0:
            snap = d.get('snap')
            if isinstance(snap, str) and len(snap) < 300000:
                t['snap'] = snap
            inputs, t['inputs'] = t['inputs'], []
            return {'status': 'ok', 'inputs': inputs, 'players': names, 'online': online, 'seat': 0}
        inp = d.get('input')
        if isinstance(inp, dict) and inp.get('type') in ('roll', 'choose', 'mini', 'double', 'link') and len(t['inputs']) < 50:
            t['inputs'].append({'seat': s['seat'], 'type': inp['type'], 'i': inp.get('i') if isinstance(inp.get('i'), int) else -1})
        return {'status': 'ok', 'snap': t['snap'], 'players': names, 'online': online, 'seat': s['seat']}
    route('sync', sync)
