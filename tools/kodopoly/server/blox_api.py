"""«Кодоблокс» по сети: общий 3D-мир для всего класса, как сервер в Roblox.

Ученик входит в мир своего класса (обби, тайкун, симулятор, студия, стеклянный мост) и видит одноклассников:
их героев, облик, этап и счёт. Карта у комнаты общая (одно зерно), разбитые стеклянные плитки и взятые шары
тоже общие. Чат — только готовые фразы (быстрый чат), свободного текста нет.
Комнаты живут в памяти сервера; в журнал ничего не пишется. Подключается из kp_api.install_kodopoly.
"""
import re
import secrets
import threading
import time

from flask import jsonify, request

CLASS = re.compile(r'(6|7|8|9|10|11) «[АБВГДЕЖЗИК]»')
WORLDS = ('obby', 'tycoon', 'sim', 'studio', 'glass', 'mega', 'lava', 'escape')
GONE = 15            # кто молчит 15 секунд, пропадает из мира
CAP = 32             # героев в одной комнате; дальше открывается вторая
PLOTS = 8            # участков в тайкуне и студии
PHRASES = ('Привет!', 'Помогите!', 'Го вместе!', 'Подожди меня!', 'Спасибо!', 'Ура, чекпоинт!', 'Упал(а) в лаву 😅', 'Какой ответ?',
           'Это 1 (истина)', 'Это 0 (ложь)', 'Я понял(а)!', 'gg')


def norm(name):
    return re.sub(r'\s+', ' ', str(name).strip().lower().replace('ё', 'е'))


def short(name):
    p = str(name).split()
    return f'{p[1]} {p[0][0]}.' if len(p) >= 2 else str(name)


class Refused(Exception):
    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code


def _num(v, lo, hi, default=0.0):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return default
    return default if v != v else max(lo, min(hi, v))


def clean_state(st):
    """Состояние героя от клиента: только известные поля и разумные значения."""
    if not isinstance(st, dict):
        return {}
    p = st.get('p') if isinstance(st.get('p'), list) else [0, 0, 0]
    out = {'p': [round(_num(x, -5000, 5000), 2) for x in (p + [0, 0, 0])[:3]],
           'r': round(_num(st.get('r'), -10, 10), 2),
           'a': int(_num(st.get('a'), 0, 3)),               # 0 стоит, 1 идёт, 2 в прыжке, 3 упал
           'cp': int(_num(st.get('cp'), 0, 99)),
           'sc': int(_num(st.get('sc'), 0, 10 ** 9))}
    look = st.get('look') if isinstance(st.get('look'), dict) else {}
    out['look'] = {k: int(_num(look.get(k), 0, 9)) for k in ('shirt', 'pants', 'face', 'hat')}
    owned = st.get('own') if isinstance(st.get('own'), list) else []
    out['own'] = [str(x)[:12] for x in owned[:16] if re.fullmatch(r'[a-z0-9]{1,12}', str(x))]
    built = st.get('b') if isinstance(st.get('b'), list) else []
    out['b'] = [[int(_num(c, -64, 64)) for c in (b + [0, 0, 0])[:3]] for b in built[:120] if isinstance(b, list)]
    return out


class Rooms:
    def __init__(self):
        self.rooms = {}
        self.lock = threading.Lock()
        self.next_id = 1

    def clean(self, now):
        for key, r in list(self.rooms.items()):
            r['players'] = {t: p for t, p in r['players'].items() if now - p['seen'] < GONE}
            if not r['players']:
                self.rooms.pop(key, None)

    def person(self, class_name, name):
        if not CLASS.fullmatch(str(class_name or '')):
            raise Refused('Неизвестный класс.')
        name = re.sub(r'\s+', ' ', str(name or '').strip())
        if not 5 <= len(name) <= 80 or ' ' not in name:
            raise Refused('Укажите фамилию и имя.')
        return name

    def join(self, class_name, name, world, now):
        name = self.person(class_name, name)
        if world not in WORLDS:
            raise Refused('Нет такого мира.')
        key = norm(name)
        # Ученик в одном мире за раз: прежний герой этого ученика уходит.
        for r in self.rooms.values():
            if r['cls'] == class_name:
                for t in [t for t, p in r['players'].items() if p['key'] == key]:
                    r['players'].pop(t)
        n = 1
        while True:
            rk = (class_name, world, n)
            r = self.rooms.get(rk)
            if r is None:
                r = self.rooms[rk] = {'cls': class_name, 'world': world, 'n': n, 'seed': secrets.randbelow(10 ** 6) + 1, 'players': {},
                                      'chat': [], 'seq': 0, 'broken': set(), 'orbs': {}}
            if len(r['players']) < CAP:
                break
            n += 1
        used = {p['plot'] for p in r['players'].values()}
        plot = next((i for i in range(PLOTS) if i not in used), -1)
        token = secrets.token_urlsafe(12)
        pid = self.next_id
        self.next_id += 1
        r['players'][token] = {'id': pid, 'name': name, 'nick': short(name), 'key': key, 'seen': now, 'st': {}, 'plot': plot}
        self.say(r, 0, 'Система', f'{short(name)} заходит в мир', now)
        return r, r['players'][token]

    def say(self, r, pid, nick, text, now):
        r['seq'] += 1
        r['chat'].append({'n': r['seq'], 'id': pid, 'nick': nick, 'text': text, 't': now})
        del r['chat'][:-30]

    def find(self, token):
        if not isinstance(token, str):
            raise Refused('Нужно войти в мир.', 403)
        for r in self.rooms.values():
            p = r['players'].get(token)
            if p:
                return r, p
        raise Refused('Тебя нет в мире — войди заново.', 403)


def install_blox(app):
    R = Rooms()
    app.blox_rooms = R

    def fail(error):
        return jsonify(status='error', message=str(error)), getattr(error, 'code', 400)

    def route(name, fn):
        def handler():
            try:
                data = request.get_json(force=True, silent=True)
                if not isinstance(data, dict):
                    raise Refused('Ожидается объект.')
                now = time.time()
                with R.lock:
                    R.clean(now)
                    return jsonify(fn(data, now))
            except Refused as error:
                return fail(error)
        handler.__name__ = 'blox_' + name
        app.add_url_rule('/results/api/blox/' + name, view_func=handler, methods=['POST'])

    def join(d, now):
        r, p = R.join(d.get('className'), d.get('name'), d.get('world'), now)
        return {'status': 'ok', 'token': next(t for t, x in r['players'].items() if x is p), 'id': p['id'], 'nick': p['nick'], 'seed': r['seed'],
                'room': r['n'], 'plot': p['plot'], 'phrases': list(PHRASES), 'now': now}
    route('join', join)

    def sync(d, now):
        """Каждые ~0,3 с: своё состояние → все герои комнаты, новые фразы чата, общие плитки и шары."""
        r, p = R.find(d.get('token'))
        p['seen'] = now
        if 'st' in d:
            p['st'] = clean_state(d.get('st'))
        say = d.get('say')
        if isinstance(say, int) and 0 <= say < len(PHRASES) and now - p.get('said', 0) > 1.5:
            p['said'] = now
            R.say(r, p['id'], p['nick'], PHRASES[say], now)
        for i in (d.get('broke') if isinstance(d.get('broke'), list) else [])[:8]:
            if isinstance(i, int) and 0 <= i < 5000:
                r['broken'].add(i)
        got = []
        for i in (d.get('take') if isinstance(d.get('take'), list) else [])[:8]:
            if isinstance(i, int) and 0 <= i < 5000 and r['orbs'].get(i, 0) <= now:
                r['orbs'][i] = now + 6.0          # шар снова появится через 6 секунд
                got.append(i)
        since = d.get('chat') if isinstance(d.get('chat'), int) else 0
        return {'status': 'ok', 'me': p['id'],
                'players': [{'id': x['id'], 'nick': x['nick'], 'plot': x['plot'], 'st': x['st']} for x in r['players'].values() if x is not p and x['st']],
                'chat': [c for c in r['chat'] if c['n'] > since], 'broken': sorted(r['broken']), 'got': got,
                'orbs': [i for i, until in r['orbs'].items() if until > now], 'count': len(r['players']), 'now': now}
    route('sync', sync)

    def leave(d, now):
        try:
            r, p = R.find(d.get('token'))
        except Refused:
            return {'status': 'ok'}
        r['players'] = {t: x for t, x in r['players'].items() if x is not p}
        R.say(r, 0, 'Система', f'{p["nick"]} выходит из мира', now)
        return {'status': 'ok'}
    route('leave', leave)

    def who(d, now):
        """Сколько одноклассников сейчас в каждом мире (для главной страницы)."""
        cls = str(d.get('className') or '')
        out = {w: 0 for w in WORLDS}
        for r in R.rooms.values():
            if r['cls'] == cls:
                out[r['world']] += len(r['players'])
        return {'status': 'ok', 'online': out}
    route('who', who)
