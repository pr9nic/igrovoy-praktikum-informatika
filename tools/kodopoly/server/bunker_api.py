"""«Бункер» по сети: настольная игра для класса (3–10 учеников за своими компьютерами).

Каждый ученик — кандидат в серверный бункер со скрытыми картами: профессия, навык, багаж, здоровье, характер.
Раунд: каждый открывает одну свою карту → все голосуют, кого не брать → выбывает набравший больше голосов.
Когда в бункере осталось столько, сколько мест, — испытания по информатике: каждый в бункере отвечает сам,
испытание пройдено, если верно ответило большинство. Специалист (навык или вещь под нужду) видит подсказку:
два неверных варианта зачёркнуты. Партию ведёт сервер, состояние в памяти; в журнал ничего не пишется.
Подключается из kp_api.install_kodopoly.
"""
import random
import re
import secrets
import threading
import time

from flask import jsonify, request

CLASS = re.compile(r'(6|7|8|9|10|11) «[АБВГДЕЖЗИК]»')
MIN, MAX = 3, 10
REVEAL, VOTE, RESULT, TRIAL = 40, 35, 7, 75     # секунды на фазы
GONE = 20
TTL = 3 * 3600

JOBS = ['программист', 'сисадмин', 'врач', 'инженер', 'учитель', 'дизайнер', 'повар', 'учёный', 'геймер', 'бабушка-изобретатель', 'робот-помощник', 'журналист']
SKILLS = {'net': 'сети и IP-адреса', 'zip': 'архивация и коды', 'sec': 'защита информации', 'py': 'алгоритмы и Python', 'db': 'базы данных и таблицы', 'hw': 'устройство компьютера'}
NEEDS = {
    'net': ('Поднять сеть бункера', 'net', 'роутер'),
    'zip': ('Распаковать архив с картами', 'zip', None),
    'store': ('Сохранить архив данных', None, 'флешка'),
    'sec': ('Защитить сервер паролем', 'sec', None),
    'py': ('Починить программу фильтра воздуха', 'py', 'ноутбук'),
    'db': ('Учесть запасы в таблице', 'db', None),
    'hw': ('Собрать запасной компьютер', 'hw', 'ящик деталей'),
}
SCEN = [('Тихий отбой', 'Глюк отключил интернет в городе.', ['net', 'store', 'py']),
        ('Потерянные карты', 'Карты подземных ходов остались только в архиве.', ['zip', 'store', 'net']),
        ('Взлом', 'Вирус Глюка ищет слабые пароли.', ['sec', 'net', 'db']),
        ('Учёт запасов', 'Еды и воды мало — всё нужно сосчитать.', ['db', 'py', 'store']),
        ('Сгоревший сервер', 'Сервер бункера сгорел от скачка напряжения.', ['hw', 'py', 'sec']),
        ('Большой архив', 'Нужно спасти научный архив.', ['store', 'zip', 'hw', 'db']),
        ('Сигнал наверх', 'Надо отправить сигнал спасателям.', ['net', 'sec', 'py', 'zip'])]
HEALTH = ['здоров', 'здоров', 'простуда', 'аллергия на пыль', 'отличная форма', 'плохо видит']
TRAIT = ['спокойный', 'лидер', 'паникёр', 'трудолюбивый', 'весельчак', 'ворчун', 'изобретательный', 'засоня']
ITEMS = ['гитара', 'консервы', 'аптечка', 'фонарик', 'книга рецептов']
FIT = {'net': 'сисадмин', 'py': 'программист', 'hw': 'инженер', 'zip': 'учёный', 'db': 'учитель', 'sec': 'геймер', 'store': 'журналист'}
CARDS = ['job', 'skill', 'item', 'health', 'trait']
CARD_NAMES = {'job': 'профессия', 'skill': 'навык', 'item': 'багаж', 'health': 'здоровье', 'trait': 'характер'}


def norm(name):
    return re.sub(r'\s+', ' ', str(name).strip().lower().replace('ё', 'е'))


def short(name):
    p = str(name).split()
    return f'{p[1]} {p[0][0]}.' if len(p) >= 2 else str(name)


class Refused(Exception):
    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code


# ---------- испытания (те же, что в одиночном «Бункере» Лаборатории) ----------

def _four(r, right, wrong):
    w = []
    for x in wrong:
        if x != right and x not in w:
            w.append(x)
    k = 1
    while len(w) < 3:
        c = str(int(right) + k * 2) if right.isdigit() else f'{right} ({k})'
        if c not in w:
            w.append(c)
        k += 1
    opts = [right] + w[:3]
    r.shuffle(opts)
    return {'opts': opts, 'right': opts.index(right)}


def trial(need, r, grade, size):
    if need == 'store':
        return {'q': f'Архив весит {size} Гбайт. Сколько это Мбайт?', **_four(r, str(size * 1024), [str(size * 1000), str(size * 1024 * 1024), str(size * 8)])}
    if need == 'net':
        a, b, c = r.randint(10, 189), r.randint(0, 249), r.randint(1, 250)
        ok = f'{a}.{b}.{c}.1'
        return {'q': 'Какой из адресов — правильный IP-адрес?', **_four(r, ok, [f'{a}.{b}.{c + 256}.1', f'{a}.{b}.{c}', f'{a}.{b}.{c}.1.5'])}
    if need == 'zip':
        s = r.choice(['AAAABBBCC', 'WWWWWBBW', 'XXXYYYYYZ', 'KKKKKKMMM'])
        runs = re.findall(r'((.)\2*)', s)
        rle = ''.join(f'{len(m)}{ch}' for m, ch in runs)
        return {'q': f'Сожми строку {s} кодом RLE (число + буква):', **_four(r, rle, [''.join(f'{ch}{len(m)}' for m, ch in runs), re.sub(r'\d', lambda d: str(int(d.group()) + 1), rle, count=1), ''.join(ch for m, ch in runs)])}
    if need == 'sec':
        L = r.choice([26, 10, 36]) if grade >= 9 else 10
        n = r.randint(3, 4) if grade >= 9 else 4
        a = L ** n
        return {'q': f'Пароль из {n} символов, каждый — один из {L} вариантов. Сколько всего паролей?', **_four(r, str(a), [str(L * n), str(a + L), str(a // L)])}
    if need == 'py':
        x, k = r.randint(2, 6), r.randint(2, 5)
        res = x * 2 ** k
        return {'q': f's = {x}\nfor i in range({k}):\n    s = s * 2\nprint(s)', **_four(r, str(res), [str(x * 2 * k), str(x + 2 * k), str(res * 2)])}
    if need == 'db':
        v = [r.randint(3, 9), r.randint(2, 10), r.randint(5, 10)]
        s = sum(v)
        return {'q': f'В таблице: A1={v[0]}, A2={v[1]}, A3={v[2]}. Чему равно =СУММ(A1:A3)?', **_four(r, str(s), [str(v[0] + v[2]), str(s + v[1]), str(max(v)), str(s + 1)])}
    n = r.choice([('процессор', 'обрабатывает данные', ['хранит файлы всегда', 'выводит изображение', 'вводит текст']),
                  ('оперативная память', 'хранит данные во время работы', ['хранит данные после выключения', 'печатает документы', 'соединяет с сетью']),
                  ('жёсткий диск', 'долговременно хранит файлы', ['считает быстрее процессора', 'выводит звук', 'вводит изображение'])])
    return {'q': f'Что делает {n[0]}?', **_four(r, n[1], n[2])}


def gb_of(item):
    m = re.match(r'флешка (\d+) Мбайт', item or '')
    return int(m.group(1)) / 1024 if m else 0


def covers(card, need, size):
    title, skill, item = NEEDS[need]
    if need == 'store':
        return gb_of(card['item']) >= size
    return (skill is not None and card['skill'] == skill) or (item is not None and item != 'флешка' and card['item'] == item)


def deal(n, grade, r):
    """Сценарий и карты на n игроков: нужные навыки и вещи достаются разным игрокам, есть ловушки."""
    title, story, needs = r.choice(SCEN)
    needs = needs[:3] if n <= 4 else needs
    size = 8 * r.randint(2, 7)
    jobs = r.sample(range(len(JOBS)), min(n, len(JOBS)))
    while len(jobs) < n:
        jobs.append(r.randrange(len(JOBS)))
    cards = [{'job': JOBS[j], 'jid': j, 'skill': None, 'item': r.choice(ITEMS), 'health': r.choice(HEALTH), 'trait': r.choice(TRAIT)} for j in jobs]
    slots = list(range(n))
    r.shuffle(slots)
    for k, nd in enumerate(needs):
        fit = next((i for i in range(k, n) if cards[slots[i]]['job'] == FIT[nd]), -1)
        if fit >= k:
            slots[k], slots[fit] = slots[fit], slots[k]
    for k, nd in enumerate(needs):
        c = cards[slots[k % n]]
        _, skill, item = NEEDS[nd]
        if nd == 'store':
            c['item'] = f'флешка {(size + 8) * 1024} Мбайт'
        elif skill:
            c['skill'] = skill
        else:
            c['item'] = item
    free = slots[len(needs):]
    if 'store' in needs and free:
        cards[free[0]]['item'] = f'флешка {(size - 4) * 1000} Мбайт'     # ловушка: Мбайт против Гбайт
    for i in free[1:]:
        if not cards[i]['skill'] and r.random() < 0.6:
            cards[i]['skill'] = r.choice([s for s in SKILLS if s not in needs])
    keep = max(2, (n + 1) // 2)
    return {'title': title, 'story': story, 'needs': needs, 'size': size, 'cards': cards, 'keep': keep,
            'trials': [trial(nd, r, grade, size) for nd in needs]}


def card_text(card, key):
    if key == 'skill':
        return SKILLS[card['skill']] if card['skill'] else 'нет'
    return card[key]


# ---------- столы ----------

class Tables:
    def __init__(self):
        self.tables = {}
        self.next_id = 1
        self.lock = threading.Lock()

    def person(self, class_name, name):
        if not CLASS.fullmatch(str(class_name or '')):
            raise Refused('Неизвестный класс.')
        name = re.sub(r'\s+', ' ', str(name or '').strip())
        if not 5 <= len(name) <= 80 or ' ' not in name:
            raise Refused('Укажите фамилию и имя.')
        return name

    def clean(self, now):
        for t in list(self.tables.values()):
            if t['phase'] == 'lobby':
                t['seats'] = [s for s in t['seats'] if now - s['seen'] < GONE]
            if not t['seats'] or now - t['touched'] > TTL or all(now - s['seen'] > 120 for s in t['seats']):
                self.tables.pop(t['id'], None)

    def _leave_others(self, cls, key, keep=None):
        for t in self.tables.values():
            if t['cls'] == cls and t['phase'] == 'lobby' and t['id'] != keep:
                t['seats'] = [s for s in t['seats'] if s['key'] != key]

    def create(self, cls, name, title, now):
        name = self.person(cls, name)
        title = re.sub(r'\s+', ' ', str(title or '').strip())[:40] or f'Бункер {short(name)}'
        if sum(1 for t in self.tables.values() if t['cls'] == cls) >= 12:
            raise Refused('В классе уже 12 бункеров — зайди в один из них.', 409)
        self._leave_others(cls, norm(name))
        t = {'id': self.next_id, 'cls': cls, 'title': title, 'seats': [], 'phase': 'lobby', 'touched': now, 'game': None, 'grade': int(cls.split()[0])}
        self.next_id += 1
        self.tables[t['id']] = t
        return t, self._seat(t, name, now)

    def _seat(self, t, name, now):
        if any(s['key'] == norm(name) for s in t['seats']):
            raise Refused('Ты уже в этом бункере. Если страница закрылась — подожди 20 секунд и войди снова.', 409)
        if t['phase'] != 'lobby':
            raise Refused('Партия в этом бункере уже идёт.', 409)
        if len(t['seats']) >= MAX:
            raise Refused(f'Лобби заполнено: уже {MAX} игроков.', 409)
        s = {'name': name, 'nick': short(name), 'key': norm(name), 'token': secrets.token_urlsafe(12), 'seen': now}
        t['seats'].append(s)
        return s

    def join(self, cls, name, tid, now):
        name = self.person(cls, name)
        t = self.tables.get(tid) if isinstance(tid, int) else None
        if not t or t['cls'] != cls:
            raise Refused('Такого лобби уже нет.', 404)
        s = self._seat(t, name, now)
        self._leave_others(cls, norm(name), keep=tid)
        return t, s

    def who(self, tid, token):
        t = self.tables.get(tid) if isinstance(tid, int) else None
        if not t:
            raise Refused('Такого бункера уже нет.', 404)
        for i, s in enumerate(t['seats']):
            if isinstance(token, str) and secrets.compare_digest(s['token'].encode(), token.encode()):
                return t, i
        raise Refused('Тебя нет в этом бункере — войди заново.', 403)

    def lobby(self, cls):
        return [{'id': t['id'], 'title': t['title'], 'players': [s['nick'] for s in t['seats']], 'started': t['phase'] != 'lobby'}
                for t in sorted(self.tables.values(), key=lambda t: (t['phase'] != 'lobby', t['id'])) if t['cls'] == cls]


# ---------- партия ----------

def start(t, now, seed=None):
    r = random.Random(seed if seed is not None else secrets.randbits(32))
    g = deal(len(t['seats']), t['grade'], r)
    g.update({'round': 1, 'open': [{'job'} for _ in t['seats']], 'out': [], 'votes': {}, 'last': None, 'answers': {}, 'result': None, 'log': []})
    t['game'] = g
    _phase(t, 'reveal', now)


def _phase(t, ph, now):
    t['phase'] = ph
    t['until'] = now + {'reveal': REVEAL, 'vote': VOTE, 'result': RESULT, 'trial': TRIAL}.get(ph, 0)


def alive(t):
    return [i for i in range(len(t['seats'])) if i not in t['game']['out']]


def advance(t, now):
    """Переход фаз по времени или когда все сделали ход."""
    g = t['game']
    if g is None:
        return
    live = alive(t)
    if t['phase'] == 'reveal':
        done = all(len(g['open'][i]) > g['round'] or len(g['open'][i]) == len(CARDS) for i in live)
        if done or now >= t['until']:
            for i in live:                     # кто не успел — открывается случайная карта
                if len(g['open'][i]) <= g['round'] and len(g['open'][i]) < len(CARDS):
                    g['open'][i].add(random.choice([c for c in CARDS if c not in g['open'][i]]))
            g['votes'] = {}
            _phase(t, 'vote', now)
    elif t['phase'] == 'vote':
        if all(i in g['votes'] for i in live) or now >= t['until']:
            tally = {}
            for v in g['votes'].values():
                tally[v] = tally.get(v, 0) + 1
            best = max(tally.values()) if tally else 0
            top = [i for i, n in tally.items() if n == best] or live
            out = random.Random(now).choice(sorted(top))
            g['out'].append(out)
            g['last'] = {'out': out, 'tally': tally}
            g['log'].append(f'Раунд {g["round"]}: в бункер не попадает {t["seats"][out]["nick"]} ({best} голос.)')
            _phase(t, 'result', now)
    elif t['phase'] == 'result':
        if now >= t['until']:
            if len(alive(t)) <= g['keep']:
                g['answers'] = {}
                _phase(t, 'trial', now)
            else:
                g['round'] += 1
                _phase(t, 'reveal', now)
    elif t['phase'] == 'trial':
        if all(i in g['answers'] and len(g['answers'][i]) == len(g['trials']) for i in live) or now >= t['until']:
            finish(t)
            _phase(t, 'end', now)


def finish(t):
    g = t['game']
    live = alive(t)
    team = [g['cards'][i] for i in live]
    res = []
    for k, nd in enumerate(g['needs']):
        right = g['trials'][k]['right']
        good = sum(1 for i in live if g['answers'].get(i, {}).get(k) == right)
        spec = [t['seats'][i]['nick'] for i in live if covers(g['cards'][i], nd, g['size'])]
        res.append({'need': NEEDS[nd][0], 'good': good, 'of': len(live), 'ok': good * 2 > len(live), 'spec': spec})
    passed = sum(1 for x in res if x['ok'])
    g['result'] = {'trials': res, 'passed': passed, 'win': passed >= len(res) - 1, 'covered': sum(1 for nd in g['needs'] if any(covers(c, nd, g['size']) for c in team))}


def view(t, me):
    """Что видит игрок me: свои карты целиком, чужие — только открытые."""
    g = t['game']
    out = {'status': 'ok', 'table': t['id'], 'title': t['title'], 'phase': t['phase'], 'me': me, 'host': me == 0,
           'left': max(0, round(t.get('until', 0) - time.time())), 'players': [s['nick'] for s in t['seats']]}
    if g is None:
        return out
    out.update({'scenario': g['title'], 'story': g['story'], 'keep': g['keep'], 'round': g['round'], 'out': g['out'], 'log': g['log'][-6:],
                'needs': [NEEDS[nd][0] + (f' ({g["size"]} Гбайт)' if nd == 'store' else '') for nd in g['needs']]})
    cards = []
    for i, c in enumerate(g['cards']):
        mine = i == me or t['phase'] == 'end'
        cards.append({'jid': c['jid'], 'open': sorted(g['open'][i]), 'cards': {k: (card_text(c, k) if (k in g['open'][i] or mine) else None) for k in CARDS}})
    out['cards'] = cards
    if t['phase'] == 'vote':
        out['voted'] = me in g['votes']
        out['votes_in'] = len(g['votes'])
    if g['last']:
        out['last'] = {'out': g['last']['out'], 'tally': {str(k): v for k, v in g['last']['tally'].items()}}
    if t['phase'] in ('trial', 'end'):
        live = alive(t)
        tr = []
        for k, nd in enumerate(g['needs']):
            q = g['trials'][k]
            spec = me in live and covers(g['cards'][me], nd, g['size'])
            gone = [j for j in range(4) if j != q['right']][:2] if spec else []
            tr.append({'need': NEEDS[nd][0], 'q': q['q'], 'opts': q['opts'], 'gone': gone, 'spec': spec, 'mine': g['answers'].get(me, {}).get(k)})
        out['trials'] = tr
        out['in_bunker'] = me in live
        out['answered'] = sum(1 for i in live if len(g['answers'].get(i, {})) == len(g['trials']))
    if t['phase'] == 'end':
        out['result'] = g['result']
        out['rights'] = [q['right'] for q in g['trials']]
    return out


def install_bunker(app):
    T = Tables()
    app.bunker_tables = T

    def route(name, fn):
        def handler():
            try:
                data = request.get_json(force=True, silent=True)
                if not isinstance(data, dict):
                    raise Refused('Ожидается объект.')
                now = time.time()
                with T.lock:
                    T.clean(now)
                    return jsonify(fn(data, now))
            except Refused as error:
                return jsonify(status='error', message=str(error)), getattr(error, 'code', 400)
        handler.__name__ = 'bunker_' + name
        app.add_url_rule('/results/api/bunker/' + name, view_func=handler, methods=['POST'])

    def lobby_view(t, i):
        return {**view(t, i), 'token': t['seats'][i]['token']}

    route('list', lambda d, now: {'status': 'ok', 'tables': T.lobby(str(d.get('className') or ''))})

    def create(d, now):
        t, s = T.create(d.get('className'), d.get('name'), d.get('title'), now)
        return lobby_view(t, t['seats'].index(s))
    route('create', create)

    def join(d, now):
        t, s = T.join(d.get('className'), d.get('name'), d.get('table'), now)
        return lobby_view(t, t['seats'].index(s))
    route('join', join)

    def state(d, now):
        t, i = T.who(d.get('table'), d.get('token'))
        t['seats'][i]['seen'] = t['touched'] = now
        advance(t, now)
        return view(t, i)
    route('state', state)

    def begin(d, now):
        t, i = T.who(d.get('table'), d.get('token'))
        if i != 0:
            raise Refused('Начать может только создатель лобби.', 403)
        if t['phase'] not in ('lobby', 'end'):
            raise Refused('Партия уже идёт.', 409)
        if len(t['seats']) < MIN:
            raise Refused(f'Нужно хотя бы {MIN} игрока.')
        start(t, now)
        return view(t, i)
    route('start', begin)

    def leave(d, now):
        try:
            t, i = T.who(d.get('table'), d.get('token'))
        except Refused:
            return {'status': 'ok'}
        if t['phase'] == 'lobby':
            t['seats'].pop(i)
            if not t['seats']:
                T.tables.pop(t['id'], None)
        return {'status': 'ok'}
    route('leave', leave)

    def act(d, now):
        """Ход игрока: открыть карту, проголосовать, ответить на испытание."""
        t, i = T.who(d.get('table'), d.get('token'))
        t['seats'][i]['seen'] = t['touched'] = now
        advance(t, now)
        g = t['game']
        kind = d.get('type')
        if g is None:
            raise Refused('Партия ещё не началась.', 409)
        live = alive(t)
        if kind == 'open' and t['phase'] == 'reveal' and i in live:
            card = d.get('card')
            if card not in CARDS or card in g['open'][i]:
                raise Refused('Эту карту нельзя открыть.')
            if len(g['open'][i]) > g['round']:
                raise Refused('В этом раунде ты уже открыл карту.', 409)
            g['open'][i].add(card)
        elif kind == 'vote' and t['phase'] == 'vote' and i in live:
            target = d.get('target')
            if not isinstance(target, int) or target not in live or target == i:
                raise Refused('За этого игрока голосовать нельзя.')
            g['votes'][i] = target
        elif kind == 'answer' and t['phase'] == 'trial' and i in live:
            k, j = d.get('trial'), d.get('opt')
            if not isinstance(k, int) or not 0 <= k < len(g['trials']) or not isinstance(j, int) or not 0 <= j < 4:
                raise Refused('Нет такого ответа.')
            g['answers'].setdefault(i, {})[k] = j
        else:
            raise Refused('Сейчас этот ход недоступен.', 409)
        advance(t, now)
        return view(t, i)
    route('act', act)
