"""Сетевая игра «Сбой на станции» (в духе Among Us) для класса: комнаты, роли, задания, собрания, чат.

Подключается к журналу одной строкой: install_crew(app). Всё состояние живёт в памяти процесса
(журнал работает одним процессом waitress), на диск и в журнал оценок модуль ничего не пишет.
Игра рассчитана на класс, где дети видят экраны соседей, поэтому сервер никому не сообщает чужих ролей,
а всё «секретное» отдаёт игроку отдельным полем secret.
"""
import json
import random
import sqlite3
from contextlib import closing
from datetime import datetime
import re
import secrets
import threading
import time
from pathlib import Path

from flask import jsonify, request

from portal_security import is_teacher

CLASS = re.compile(r'(\d{1,2}) «[А-ЯЁ]»')
# Локации. Комнаты стоят по сетке: (столбец, строка) -> (название, вид, ширина, высота); links — какие соседние комнаты соединены коридором.
# Вид комнаты (kind) нужен клиенту, чтобы подобрать пол и мебель; правила от него зависят только для столовой, реактора и электрощита.
MAP_SPECS = [
    {'id': 'station', 'name': 'Станция «Кодоград-1»', 'theme': 'space', 'pitch': (16, 13),
     'cells': {(0, 0): ('Серверная', 'servers', 11, 7), (1, 0): ('Мостик', 'bridge', 10, 6), (2, 0): ('Связь', 'comms', 9, 6), (3, 0): ('Лаборатория', 'lab', 11, 7),
               (0, 1): ('Реактор', 'reactor', 9, 7), (1, 1): ('Столовая', 'cafe', 11, 8), (2, 1): ('Медотсек', 'med', 9, 7), (3, 1): ('Оранжерея', 'garden', 10, 7),
               (0, 2): ('Склад', 'store', 12, 6), (1, 2): ('Машинный зал', 'engine', 10, 6), (2, 2): ('Электрощит', 'electro', 8, 6), (3, 2): ('Каюты', 'quarters', 10, 7)},
     'links': [((0, 0), (1, 0)), ((1, 0), (2, 0)), ((2, 0), (3, 0)), ((0, 1), (1, 1)), ((1, 1), (2, 1)), ((2, 1), (3, 1)), ((0, 2), (1, 2)), ((1, 2), (2, 2)), ((2, 2), (3, 2)),
               ((0, 0), (0, 1)), ((0, 1), (0, 2)), ((1, 0), (1, 1)), ((1, 1), (1, 2)), ((2, 1), (2, 2)), ((3, 0), (3, 1)), ((3, 1), (3, 2))]},
    {'id': 'sea', 'name': 'Подводная база «Глубина»', 'theme': 'sea', 'pitch': (15, 13),
     'cells': {(0, 0): ('Шлюз', 'dock', 9, 6), (1, 0): ('Командный пост', 'bridge', 10, 6), (2, 0): ('Обзорный зал', 'view', 11, 6), (3, 0): ('Лаборатория', 'lab', 10, 7), (4, 0): ('Связь', 'comms', 9, 6),
               (0, 1): ('Насосная', 'engine', 9, 7), (2, 1): ('Кают-компания', 'cafe', 11, 8), (4, 1): ('Медпункт', 'med', 9, 7),
               (0, 2): ('Склад', 'store', 10, 6), (1, 2): ('Реактор', 'reactor', 9, 7), (2, 2): ('Электрощит', 'electro', 8, 6), (3, 2): ('Каюты', 'quarters', 10, 7), (4, 2): ('Оранжерея', 'garden', 9, 6)},
     'links': [((0, 0), (1, 0)), ((1, 0), (2, 0)), ((2, 0), (3, 0)), ((3, 0), (4, 0)), ((0, 2), (1, 2)), ((1, 2), (2, 2)), ((2, 2), (3, 2)), ((3, 2), (4, 2)),
               ((0, 0), (0, 1)), ((0, 1), (0, 2)), ((2, 0), (2, 1)), ((2, 1), (2, 2)), ((4, 0), (4, 1)), ((4, 1), (4, 2))]},
    {'id': 'moon', 'name': 'Лунная база «Селена»', 'theme': 'moon', 'pitch': (17, 12),
     'cells': {(0, 0): ('Обсерватория', 'bridge', 10, 6), (1, 0): ('Связь', 'comms', 9, 6), (2, 0): ('Гараж', 'garage', 11, 6),
               (0, 1): ('Лаборатория', 'lab', 10, 7), (1, 1): ('Столовая', 'cafe', 11, 8), (2, 1): ('Шлюз', 'dock', 9, 6),
               (0, 2): ('Теплица', 'garden', 10, 7), (1, 2): ('Реактор', 'reactor', 9, 7), (2, 2): ('Электрощит', 'electro', 8, 6),
               (0, 3): ('Каюты', 'quarters', 10, 6), (1, 3): ('Склад', 'store', 11, 6), (2, 3): ('Медблок', 'med', 9, 6)},
     'links': [((0, 0), (1, 0)), ((1, 0), (2, 0)), ((0, 1), (1, 1)), ((1, 1), (2, 1)), ((1, 2), (2, 2)), ((0, 3), (1, 3)), ((1, 3), (2, 3)),
               ((0, 0), (0, 1)), ((0, 1), (0, 2)), ((0, 2), (0, 3)), ((1, 0), (1, 1)), ((1, 1), (1, 2)), ((2, 1), (2, 2)), ((2, 2), (2, 3))]},
]


def build_world(spec):
    px, py = spec['pitch']
    cols, rows = max(c for c, _ in spec['cells']) + 1, max(r for _, r in spec['cells']) + 1
    w, h = 4 + cols * px, 4 + rows * py
    grid = [['#'] * w for _ in range(h)]
    center = lambda c, r: (2 + px // 2 + c * px, 2 + py // 2 + r * py)
    rooms, terminals, consoles, table = [], [], [], None
    for (c, r), (name, kind, rw, rh) in sorted(spec['cells'].items(), key=lambda kv: (kv[0][1], kv[0][0])):
        cx, cy = center(c, r)
        x, y = cx - rw // 2, cy - rh // 2
        rooms.append({'name': name, 'kind': kind, 'x': x, 'y': y, 'w': rw, 'h': rh})
        for yy in range(y, y + rh):
            for xx in range(x, x + rw):
                grid[yy][xx] = '.'
        if kind == 'cafe':
            table = (x + rw / 2, y + rh / 2)
            terminals.append((x + 1, y + rh - 2))
        elif kind == 'reactor':
            consoles += [(x + 1, y + 1, 'reactor'), (x + 1, y + rh - 2, 'reactor')]
            terminals.append((x + rw - 2, y + 2))
        elif kind == 'electro':
            terminals.append((x + rw - 2, y + rh - 2))
        else:
            terminals += [(x + 1, y + 2), (x + rw - 2, y + rh - 2)]
    for a, b in spec['links']:
        (ax, ay), (bx, by) = center(*a), center(*b)
        for yy in range(min(ay, by) - 1, max(ay, by) + 1):
            for xx in range(min(ax, bx) - 1, max(ax, bx) + 1):
                grid[yy][xx] = '.'
    electro = next(r for r in rooms if r['kind'] == 'electro')
    consoles.append((electro['x'] + 1, electro['y'] + 1, 'lights'))      # пульты реактора идут первыми, щиток света — последним
    # Пост наблюдения стоит на мостике и показывает четыре комнаты; двери — клетки коридора вплотную к комнате.
    post = next(r for r in rooms if r['kind'] == 'bridge')
    cams = {'x': post['x'] + post['w'] - 2, 'y': post['y'] + 1, 'rooms': [i for i, r in enumerate(rooms) if r['kind'] in ('cafe', 'reactor', 'electro', 'store')]}
    inside = lambda x, y: any(r['x'] <= x < r['x'] + r['w'] and r['y'] <= y < r['y'] + r['h'] for r in rooms)
    doors = [(x, y) for y in range(h) for x in range(w) if grid[y][x] == '.' and not inside(x, y) and any(inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    return {'id': spec['id'], 'name': spec['name'], 'theme': spec['theme'], 'w': w, 'h': h, 'map': [''.join(row) for row in grid], 'rooms': rooms, 'cams': cams, 'doors': doors,
            'terminals': terminals, 'consoles': consoles, 'table': table}


WORLDS = {spec['id']: build_world(spec) for spec in MAP_SPECS}
MAPS = list(WORLDS) + ['random']
COLORS = ['#ff5a5a', '#4aa8ff', '#4ae08a', '#ffd34d', '#c98bff', '#ff9a3a', '#3ad6d6', '#ff7ab8', '#a5e04a', '#8f9bff', '#e0e0e0', '#b08a5a']
BAD = ['дурак', 'дура', 'идиот', 'тупой', 'тупая', 'лох', 'урод', 'дебил', 'козёл', 'козел', 'сволоч', 'заткн', 'сука', 'бля', 'хер', 'хуй', 'пизд', 'еба', 'ёба', 'жоп', 'говн', 'мраз']
DEFAULTS = {'map': 'station', 'imposters': 0, 'tasks': 5, 'meeting': 75, 'cooldown': 25, 'infect': 10, 'reveal': True, 'chat': True, 'minPlayers': 4, 'sabotage': True, 'emergency': 1, 'sabotageTime': 50, 'roles': True, 'voteStart': True}
LIMITS = {'imposters': (0, 6), 'tasks': (3, 8), 'meeting': (30, 180), 'cooldown': (10, 60), 'infect': (5, 20), 'minPlayers': (3, 10), 'emergency': (0, 3), 'sabotageTime': (30, 90)}


def _bin(v):
    return bin(v)[2:]


def _near(right, rnd, low=0):
    out = []
    for _ in range(50):
        v = right + rnd.choice([-3, -2, -1, 1, 2, 3, 4, 8])
        if v >= low and v != right and str(v) not in out:
            out.append(str(v))
        if len(out) == 2:
            return out
    return [str(right + 5), str(right + 7)]


def made_question(grade, rnd):
    """Вопрос со случайными числами: единицы информации, системы счисления, логика, степени двойки."""
    kinds = ['units', 'bin2dec']
    if grade >= 8:
        kinds = ['bin2dec', 'dec2bin', 'logic', 'pow2']
    if grade >= 10:
        kinds = ['bin2dec', 'dec2bin', 'logic', 'pow2', 'hex2dec']
    kind, top = rnd.choice(kinds), {6: 7, 7: 15, 8: 31, 9: 63, 10: 127, 11: 255}[grade]
    if kind == 'units':
        if rnd.random() < 0.5:
            n = rnd.randint(2, 9)
            return {'q': f'Сколько бит в {n} байтах?', 'a': str(n * 8), 'w': _near(n * 8, rnd, 1)}
        n = rnd.randint(2, 6) * 8
        return {'q': f'Сколько байт в {n} битах?', 'a': str(n // 8), 'w': _near(n // 8, rnd, 1)}
    if kind == 'bin2dec':
        v = rnd.randint(2, top)
        return {'q': f'{_bin(v)}₂ = ? в десятичной системе', 'a': str(v), 'w': _near(v, rnd)}
    if kind == 'dec2bin':
        v = rnd.randint(2, top)
        return {'q': f'{v} = ? в двоичной системе', 'a': _bin(v) + '₂', 'w': [_bin(v + 1) + '₂', _bin(v - 1) + '₂']}
    if kind == 'pow2':
        k = rnd.randint(3, 10)
        return {'q': f'Чему равно 2 в степени {k}?', 'a': str(1 << k), 'w': [str(1 << (k - 1)), str((1 << k) + (1 << (k - 2)))]}
    if kind == 'hex2dec':
        v = rnd.randint(10, 255)
        return {'q': f'{v:X}₁₆ = ? в десятичной системе', 'a': str(v), 'w': _near(v, rnd)}
    a, b = rnd.random() < 0.5, rnd.random() < 0.5
    text, value = rnd.choice([('A И B', a and b), ('A ИЛИ B', a or b), ('НЕ A', not a), ('A И НЕ B', a and not b), ('НЕ A ИЛИ B', (not a) or b)])
    return {'q': f'A = {int(a)}, B = {int(b)}. {text} — это…', 'a': 'истина' if value else 'ложь', 'w': ['ложь' if value else 'истина', 'нельзя определить']}


ALPHABET = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
WORDS = ['БАЙТ', 'КОД', 'СЕТЬ', 'ФАЙЛ', 'ДИСК', 'ЦИКЛ', 'РОБОТ', 'ПАМЯТЬ', 'ЭКРАН', 'ПАРОЛЬ']
STEPS = [['Включить компьютер', 'Открыть редактор', 'Набрать текст', 'Сохранить файл'], ['Ввести данные', 'Обработать данные', 'Вывести результат'],
         ['Составить алгоритм', 'Написать программу', 'Запустить программу', 'Исправить ошибки'], ['Выделить текст', 'Скопировать', 'Поставить курсор в новое место', 'Вставить'],
         ['Набрать адрес сайта', 'Браузер отправляет запрос', 'Сервер присылает страницу', 'Браузер показывает страницу']]
PAIRS = {'devices': (6, [('клавиатура', 'ввод текста'), ('монитор', 'вывод изображения'), ('процессор', 'обработка данных'), ('жёсткий диск', 'долговременное хранение'), ('принтер', 'печать на бумаге'),
                         ('микрофон', 'ввод звука'), ('колонки', 'вывод звука'), ('оперативная память', 'временное хранение')]),
         'files': (6, [('.txt', 'текст'), ('.jpg', 'изображение'), ('.mp3', 'звук'), ('.mp4', 'видео'), ('.py', 'программа на Python'), ('.zip', 'архив'), ('.html', 'веб-страница')]),
         'python': (8, [('==', 'равно'), ('!=', 'не равно'), ('%', 'остаток от деления'), ('//', 'деление нацело'), ('**', 'возведение в степень'), ('and', 'логическое И'), ('or', 'логическое ИЛИ')]),
         'net': (9, [('IP-адрес', 'номер компьютера в сети'), ('DNS', 'перевод имён сайтов в адреса'), ('HTTP', 'передача веб-страниц'), ('маршрутизатор', 'пересылка пакетов между сетями'), ('браузер', 'просмотр веб-страниц'), ('пароль', 'защита входа')])}


def made_task(grade, rnd, kind):
    """Задание не тестового типа. Возвращает открытые поля для игрока и sol — правильный ответ, который остаётся на сервере."""
    top = {6: 15, 7: 31, 8: 63, 9: 127, 10: 255, 11: 255}[grade]
    if kind == 'bits':
        n = {6: 4, 7: 5, 8: 6}.get(grade, 8)
        v = rnd.randint(1, (1 << n) - 1)
        return {'type': 'bits', 'q': f'Набери переключателями число {v} в двоичной системе', 'bits': n, 'sol': format(v, f'0{n}b'), 'show': format(v, f'0{n}b')}
    if kind == 'order':
        variant = rnd.choice(['units', 'numbers', 'steps'])
        if variant == 'units':
            names = ['бит', 'байт', 'Кбайт', 'Мбайт', 'Гбайт', 'Тбайт']
            good = sorted(rnd.sample(range(len(names)), 4))
            good, q = [names[i] for i in good], 'Расставь единицы от меньшей к большей'
        elif variant == 'numbers':
            values = sorted(rnd.sample(range(2, top), 4))
            forms = [str] + ([lambda v: _bin(v) + '₂'] if grade >= 7 else []) + ([lambda v: f'{v:o}₈'] if grade >= 9 else []) + ([lambda v: f'{v:X}₁₆'] if grade >= 10 else [])
            good, q = [rnd.choice(forms)(v) for v in values], 'Расставь числа от меньшего к большему'
        else:
            good, q = list(rnd.choice(STEPS if grade >= 8 else STEPS[:4])), 'Расставь действия по порядку'
        items = list(good)
        while items == good:
            rnd.shuffle(items)
        return {'type': 'order', 'q': q, 'items': items, 'sol': [items.index(x) for x in good], 'show': ' → '.join(good)}
    if kind == 'match':
        pools = [k for k, (low, _) in PAIRS.items() if grade >= low] + ['bin']
        pool = rnd.choice(pools)
        if pool == 'bin':
            pairs = [(_bin(v) + '₂', str(v)) for v in rnd.sample(range(2, min(top, 31) + 1), 4)]
        else:
            pairs = rnd.sample(PAIRS[pool][1], 4)
        right = [b for _, b in pairs]
        rnd.shuffle(right)
        return {'type': 'match', 'q': 'Соедини провода: что чему соответствует', 'left': [a for a, _ in pairs], 'pairs': right, 'sol': [right.index(b) for _, b in pairs],
                'show': '; '.join(f'{a} — {b}' for a, b in pairs)}
    # Ответ нужно набрать самому.
    variants = ['bin', 'units', 'walk'] + (['caesar'] if grade >= 7 else []) + (['loop', 'tobin', 'logic'] if grade >= 8 else []) + (['hex'] if grade >= 10 else [])
    variant = rnd.choice(variants)
    if variant == 'bin':
        v = rnd.randint(2, top)
        out = {'q': f'Переведи {_bin(v)}₂ в десятичную систему', 'sol': str(v)}
    elif variant == 'tobin':
        v = rnd.randint(2, top)
        out = {'q': f'Переведи число {v} в двоичную систему', 'sol': _bin(v)}
    elif variant == 'hex':
        v = rnd.randint(10, 255)
        out = {'q': f'Переведи {v:X}₁₆ в десятичную систему', 'sol': str(v)}
    elif variant == 'units':
        n = rnd.randint(2, 12)
        out = {'q': f'Сколько бит в {n} байтах?', 'sol': str(n * 8)}
    elif variant == 'walk':
        a, b, c = rnd.randint(2, 5), rnd.randint(2, 5), rnd.randint(1, 3)
        out = {'q': f'Робот {a} раза выполнил «вперёд на {b}», а потом «назад на {c}». На сколько клеток он ушёл от старта?', 'sol': str(a * b - c)}
    elif variant == 'caesar':
        word, k = rnd.choice(WORDS), rnd.randint(1, 3)
        coded = ''.join(ALPHABET[(ALPHABET.index(ch) + k) % len(ALPHABET)] for ch in word)
        out = {'q': f'Шифр Цезаря: каждая буква сдвинута на {k} вперёд по алфавиту. Расшифруй слово {coded}', 'sol': word}
    elif variant == 'loop':
        n, step = rnd.randint(3, 6), rnd.randint(1, 3)
        out = {'q': 'Что напечатает программа?', 'code': f's = 0\nfor i in range({n}):\n    s = s + {step}\nprint(s)' if rnd.random() < 0.5 else f's = 0\nfor i in range(1, {n + 1}):\n    s = s + i\nprint(s)', 'sol': ''}
        out['sol'] = str(n * step) if 's + i' not in out['code'] else str(n * (n + 1) // 2)
    else:
        a, b, c = rnd.randint(0, 1), rnd.randint(0, 1), rnd.randint(0, 1)
        out = {'q': f'Чему равно ({a} И {b}) ИЛИ {c}? Ответь 0 или 1', 'sol': str((a & b) | c)}
    return dict(out, type='input', show=out['sol'])


def normal(text):
    return re.sub(r'[\s₂₈₁₆]+', '', str(text)).upper().replace('Ё', 'Е').replace(',', '.')


def answer_ok(quiz, a):
    kind, sol = quiz.get('type', 'choice'), quiz['sol']
    if kind == 'choice':
        return a.get('i') == sol
    if kind == 'input':
        return normal(a.get('v', '')) == normal(sol) and len(str(a.get('v', ''))) <= 40
    return a.get('v') == sol


PUBLIC = ('type', 'q', 'code', 'options', 'bits', 'items', 'left', 'pairs', 'kind', 'n')


class Refused(Exception):
    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code


class Game:
    """Все комнаты и правила. Время передаётся параметром now, чтобы правила можно было проверять тестами."""

    def __init__(self, bank=None, seed=None):
        self.rooms = {}
        self.bank = bank or {}
        self.rnd = random.Random(seed)
        self.lock = threading.Lock()
        self.open = True               # общий выключатель: учитель может закрыть вход в игру для всех классов
        self.born = time.time()
        self.syncs = 0
        self.version = ''

    # ---------- комнаты и игроки ----------

    def room(self, class_name):
        m = CLASS.fullmatch(str(class_name or ''))
        if not m or not 6 <= int(m.group(1)) <= 11:
            raise Refused('Выберите свой класс.')
        if class_name not in self.rooms:
            self.rooms[class_name] = {'name': class_name, 'grade': int(m.group(1)), 'phase': 'lobby', 'players': {}, 'chat': [], 'chat_id': 0, 'round': 0,
                                      'settings': dict(DEFAULTS), 'map': 'station', 'quiz_n': 0, 'bodies': [], 'sabotage': None, 'meeting': None, 'pulses': [], 'winner': '', 'why': '', 'shown': 0, 'next_id': 1,
                                      'sabotage_at': 0, 'used_q': set(), 'paused': 0, 'locked': False, 'deleted': [], 'wipe': 0, 'ready': set(), 'start_at': 0, 'imps': [], 'winners': []}
        return self.rooms[class_name]

    def join(self, class_name, name, now):
        room = self.room(class_name)
        name = re.sub(r'\s+', ' ', str(name or '').strip())
        if not 5 <= len(name) <= 80 or ' ' not in name or any(ord(c) < 32 for c in name):
            raise Refused('Укажите фамилию и имя.')
        key = name.lower().replace('ё', 'е')
        for p in room['players'].values():
            if p['key'] == key:
                # Тот же ученик вернулся (обновил страницу, пересел): отдаём его место с новым ключом.
                p['token'] = secrets.token_urlsafe(12)
                p['seen'] = now
                return room, p
        if not self.open or room['locked']:
            raise Refused('Учитель пока закрыл вход в игру. Подождите.', 409)
        if room['phase'] not in ('lobby', 'end'):
            raise Refused('Раунд уже идёт. Подождите следующего — учитель начнёт его с новым составом.', 409)
        if len(room['players']) >= 32:
            raise Refused('В комнате уже 32 игрока.', 409)
        pid = room['next_id']
        room['next_id'] += 1
        p = {'id': pid, 'token': secrets.token_urlsafe(12), 'name': name, 'key': key, 'color': COLORS[(pid - 1) % len(COLORS)], 'x': WORLDS[room['map']]['table'][0], 'y': WORLDS[room['map']]['table'][1] + 2, 'seen': now,
             'alive': True, 'role': 'crew', 'tasks': [], 'done': [], 'quiz': None, 'lock': 0, 'pulse_at': 0, 'infected_at': 0, 'last': '', 'emergency': 1,
             'right': 0, 'wrong': 0, 'said': 0, 'wins': 0, 'score': 0, 'muted': False, 'job': '', 'cams': False, 'all_right': 0, 'all_wrong': 0, 'rounds': 0}
        room['players'][pid] = p
        self.say(room, None, f'{name} на борту.', 'sys', now)
        return room, p

    def who(self, class_name, pid, token):
        room = self.rooms.get(class_name)
        p = room and room['players'].get(pid)
        if not p or not secrets.compare_digest(p['token'].encode(), str(token or '').encode()):
            raise Refused('Связь со станцией потеряна. Войдите заново.', 401)
        return room, p

    def say(self, room, p, text, channel, now):
        room['chat_id'] += 1
        room['chat'].append({'id': room['chat_id'], 'pid': p['id'] if p else 0, 'name': p['name'] if p else '', 'color': p['color'] if p else '', 'text': text, 'ch': channel, 't': now})
        del room['chat'][:-200]

    # ---------- раунд ----------

    def start(self, room, now, pick=None):
        players = [p for p in room['players'].values() if now - p['seen'] < 20]
        s = room['settings']
        if len(players) < s['minPlayers']:
            raise Refused(f'Для раунда нужно не меньше {s["minPlayers"]} игроков на связи.')
        for pid in [pid for pid, p in room['players'].items() if p not in players]:
            del room['players'][pid]
        count = s['imposters'] or (1 if len(players) < 7 else 2 if len(players) < 13 else 3)
        count = max(1, min(count, (len(players) - 1) // 2))
        imps = set(p['id'] for p in self.rnd.sample(players, count))
        chosen = [p['id'] for p in players if p['id'] in (pick or [])][:max(1, (len(players) - 1) // 2)]
        if chosen:                                     # учитель сам назначил вредителей с пульта
            imps, count = set(chosen), len(chosen)
        forced = getattr(self, 'force_imp', None)      # только для автотестов на стенде: имя игрока, который станет вредителем
        if forced and not chosen and any(p['name'] == forced for p in players):
            imps = {next(p['id'] for p in players if p['name'] == forced)}
        room['map'] = self.rnd.choice(list(WORLDS)) if s['map'] == 'random' else s['map']
        # Особые роли экипажа: инженер чинит аварии без задания, медик своим импульсом лечит заражённых рядом.
        crew_ids = [p['id'] for p in players if p['id'] not in imps]
        self.rnd.shuffle(crew_ids)
        jobs = dict(zip(crew_ids, (['engineer'] if len(players) >= 5 else []) + (['medic'] if len(players) >= 7 else []))) if s['roles'] else {}
        spots = self.spots(room)
        for i, p in enumerate(players):
            p.update(alive=True, known_out=False, job=jobs.get(p['id'], ''), cams=False, role='imp' if p['id'] in imps else 'crew', tasks=self.rnd.sample(range(len(WORLDS[room['map']]['terminals'])), s['tasks']), done=[], quiz=None, lock=0,
                     pulse_at=now + 20, infected_at=0, last='', emergency=s['emergency'], right=0, wrong=0, x=spots[i % len(spots)][0], y=spots[i % len(spots)][1], moved=True)   # moved: браузер должен взять новое место, а не прислать старое (с прошлой карты оно может оказаться в стене)
        room['ready'] = set()
        room['start_at'] = 0
        room.update(phase='play', round=room['round'] + 1, bodies=[], sabotage=None, meeting=None, pulses=[], winner='', why='', shown=0, sabotage_at=now + 30, started=now, used_q=set(), paused=0)
        self.say(room, None, f'Раунд {room["round"]} начался. Вредителей на станции: {count}.', 'sys', now)

    def spots(self, room):
        tx, ty = WORLDS[room['map']]['table']
        spots = [(tx + dx, ty + dy) for dx in (-4, -3, -2, 2, 3, 4) for dy in (-2.5, -1.5, 1.5, 2.5, 3)]
        self.rnd.shuffle(spots)
        return spots

    def crew(self, room):
        return [p for p in room['players'].values() if p['role'] == 'crew']

    def progress(self, room):
        crew = self.crew(room)
        total = sum(len(p['tasks']) for p in crew)
        return (sum(len(p['done']) for p in crew), total)

    def bank_stats(self, room):
        # Ответы раунда переносятся в счёт урока — по нему учитель выставляет отметки.
        for p in room['players'].values():
            if p['right'] or p['wrong'] or p['tasks']:
                p['all_right'] += p['right']
                p['all_wrong'] += p['wrong']
                p['rounds'] += 1

    def marks(self, room, need):
        """Предложение отметок за урок: по числу верных ответов и точности. Двоек нет: мало ответов — отметки нет."""
        live = room['phase'] in ('play', 'meeting', 'result')
        out = []
        for p in room['players'].values():
            right, wrong = p['all_right'] + (p['right'] if live else 0), p['all_wrong'] + (p['wrong'] if live else 0)
            acc = round(right / (right + wrong) * 100) if right + wrong else 0
            mark = 5 if right >= need[2] and acc >= 70 else 4 if right >= need[1] and acc >= 50 else 3 if right >= need[0] else 0
            out.append({'id': p['id'], 'name': p['name'], 'right': right, 'wrong': wrong, 'acc': acc, 'rounds': p['rounds'] + (1 if live else 0), 'wins': p['wins'], 'mark': mark})
        return sorted(out, key=lambda m: m['name'])

    def finish(self, room, winner, why, now):
        room.update(phase='end', winner=winner, why=why, sabotage=None, meeting=None, ended=now)
        for p in room['players'].values():
            p['quiz'] = None
            won = (p['role'] == 'imp') == (winner == 'imp')
            p['wins'] += 1 if won else 0
            p['score'] += (3 if won else 0) + p['right']
        self.bank_stats(room)
        for p in room['players'].values():
            p['cams'] = False
        room['imps'] = [p['name'] for p in room['players'].values() if p['role'] == 'imp']
        room['winners'] = [p['name'] for p in room['players'].values() if (p['role'] == 'imp') == (winner == 'imp')]
        self.say(room, None, ('Победил экипаж: ' if winner == 'crew' else 'Победили вредители: ') + why + ' Вредители: ' + (', '.join(room['imps']) or '—') + '.', 'sys', now)

    # ---------- старт раунда голосованием игроков ----------

    def vote_need(self, room, now):
        online = [p for p in room['players'].values() if now - p['seen'] < 20]
        return online, max(room['settings']['minPlayers'], len(online) // 2 + 1)

    def vote_check(self, room, now):
        """Раунд начинается сам, когда «Готов» нажало больше половины игроков на связи (и их не меньше минимума)."""
        if room['phase'] not in ('lobby', 'end') or not room['settings']['voteStart'] or room['locked'] or not self.open:
            room['start_at'] = 0
            return
        online, need = self.vote_need(room, now)
        votes = sum(1 for p in online if p['id'] in room['ready'])
        if len(online) >= room['settings']['minPlayers'] and votes >= need:
            if not room['start_at']:
                room['start_at'] = now + 5
                self.say(room, None, f'Экипаж проголосовал ({votes} из {len(online)}): раунд начнётся через 5 секунд.', 'sys', now)
        elif room['start_at']:
            room['start_at'] = 0
            self.say(room, None, 'Старт отменён: голосов стало меньше половины.', 'sys', now)

    def check_win(self, room, now):
        if room['phase'] not in ('play', 'meeting', 'result'):
            return
        imps = [p for p in room['players'].values() if p['role'] == 'imp' and p['alive']]
        crew = [p for p in self.crew(room) if p['alive']]
        done, total = self.progress(room)
        if not imps:
            self.finish(room, 'crew', 'все вредители найдены.', now)
        elif len(imps) >= len(crew):
            self.finish(room, 'imp', 'экипажа осталось слишком мало.', now)
        elif total and done >= total:
            self.finish(room, 'crew', 'все задания выполнены.', now)

    def meeting(self, room, by, reason, body, now):
        room['meeting'] = {'until': now + room['settings']['meeting'], 'votes': {}, 'by': by['id'] if by else 0, 'reason': reason, 'body': body['name'] if body else '', 'result': None}
        room.update(phase='meeting', bodies=[], sabotage=None)
        room['shown'] = self.progress(room)[0]          # шкала заданий обновляется только на собраниях
        for p in room['players'].values():
            p['quiz'] = None
            p['infected_at'] = 0 if p['alive'] else p['infected_at']
            p['known_out'] = not p['alive']      # об отключении все узнают только на собрании
            p['cams'] = False
        self.say(room, None, 'Учитель созвал собрание.' if not by else f'{by["name"]} нашёл отключённого: {body["name"]}. Собрание!' if body else f'{by["name"]} созвал экстренное собрание.', 'sys', now)

    def tally(self, room, now):
        m = room['meeting']
        alive = [p for p in room['players'].values() if p['alive']]
        counts = {}
        for p in alive:
            v = m['votes'].get(p['id'], 'skip')
            counts[v] = counts.get(v, 0) + 1
        top = sorted(counts.items(), key=lambda kv: -kv[1])
        out = None
        if top and top[0][0] != 'skip' and (len(top) == 1 or top[0][1] > top[1][1]):
            out = room['players'].get(top[0][0])
        text = 'Никого не исключили: голоса разделились или большинство пропустило.'
        if out:
            out['alive'] = False
            out['known_out'] = True
            text = f'{out["name"]} исключён.' + ((' Это был вредитель.' if out['role'] == 'imp' else ' Это был не вредитель.') if room['settings']['reveal'] else '')
        m['result'] = {'text': text, 'counts': [{'id': k, 'n': n} for k, n in top], 'out': out['id'] if out else 0}
        room.update(phase='result', result_until=now + 7)
        self.say(room, None, text, 'sys', now)
        self.check_win(room, now)

    def resume(self, room, now):
        spots = self.spots(room)
        for i, p in enumerate(room['players'].values()):
            p.update(x=spots[i % len(spots)][0], y=spots[i % len(spots)][1], pulse_at=now + 15, infected_at=0, moved=True)
        room.update(phase='play', meeting=None, sabotage_at=now + 25)

    def unpause(self, room, now):
        # Пауза замораживает все таймеры: сдвигаем их на время простоя.
        d = now - room['paused']
        room['paused'] = 0
        if room['meeting']:
            room['meeting']['until'] += d
        if room['sabotage']:
            room['sabotage']['until'] += d
        room['sabotage_at'] += d
        room['result_until'] = room.get('result_until', 0) + d
        for p in room['players'].values():
            p['pulse_at'] += d
            p['lock'] += d if p['lock'] else 0
            p['infected_at'] += d if p['infected_at'] else 0

    def tick(self, room, now):
        if room['paused']:
            return
        if room['phase'] in ('lobby', 'end') and room['start_at']:
            self.vote_check(room, now)
            if room['start_at'] and now >= room['start_at']:
                try:
                    self.start(room, now)
                except Refused as error:
                    room['start_at'] = 0
                    self.say(room, None, str(error), 'sys', now)
                return
        if room['phase'] == 'play':
            for p in room['players'].values():
                if p['alive'] and p['infected_at'] and now >= p['infected_at']:
                    p['alive'] = False
                    p['quiz'] = None
                    room['bodies'].append({'id': p['id'], 'name': p['name'], 'color': p['color'], 'x': p['x'], 'y': p['y']})
            cam = WORLDS[room['map']]['cams']
            for p in room['players'].values():
                if p['cams'] and (not self.near(p, cam['x'] + 0.5, cam['y'] + 0.5, 2.0) or now - p['seen'] > 5):
                    p['cams'] = False
            self.check_win(room, now)
            if room['phase'] == 'play' and room['sabotage'] and now >= room['sabotage']['until']:
                if room['sabotage']['kind'] == 'reactor':
                    self.finish(room, 'imp', 'реактор не успели починить.', now)
                else:
                    self.end_sabotage(room, now, 'Двери открылись.' if room['sabotage']['kind'] == 'doors' else 'Свет включился сам: сработала аварийная линия.')
        elif room['phase'] == 'meeting':
            alive = [p for p in room['players'].values() if p['alive'] and now - p['seen'] < 20]
            if now >= room['meeting']['until'] or (alive and all(p['id'] in room['meeting']['votes'] for p in alive)):
                self.tally(room, now)
        elif room['phase'] == 'result' and now >= room['result_until']:
            self.resume(room, now)
        room['pulses'] = [x for x in room['pulses'] if now - x['t'] < 2]

    # ---------- действия игрока ----------

    def question(self, room):
        """Задание для терминала: тест из банка или со случайными числами, либо задание другого типа."""
        room['quiz_n'] += 1
        kind = self.rnd.choice(['choice', 'choice', 'input', 'input', 'bits', 'order', 'match'])
        if kind != 'choice':
            return dict(made_task(room['grade'], self.rnd, kind), n=room['quiz_n'])
        bank = self.bank.get(str(room['grade']), [])
        q = None
        if bank and self.rnd.random() < 0.5:
            free = [i for i in range(len(bank)) if i not in room['used_q']] or list(range(len(bank)))
            i = self.rnd.choice(free)
            room['used_q'].add(i)
            q = bank[i]
        q = q or made_question(room['grade'], self.rnd)
        options = [q['a']] + list(q['w'])
        self.rnd.shuffle(options)
        return {'type': 'choice', 'q': q['q'], 'options': options, 'sol': options.index(q['a']), 'show': q['a'], 'n': room['quiz_n']}

    def sabotage(self, room, kind, now):
        s = room['settings']
        kind = kind if kind in ('reactor', 'lights', 'doors') else 'reactor'
        room['sabotage'] = {'kind': kind, 'until': now + {'reactor': s['sabotageTime'], 'lights': 75, 'doors': 15}[kind], 'fixed': set(), 't': now}
        self.say(room, None, {'reactor': 'Авария реактора! Двое должны починить пульты в реакторе.', 'lights': 'Погас свет! Кто-то должен починить щиток в электрощите.',
                              'doors': 'Двери заблокированы на 15 секунд.'}[kind], 'sys', now)

    def fixed(self, room, at, now):
        sab, wd = room['sabotage'], WORLDS[room['map']]
        sab['fixed'].add(at)
        if len(sab['fixed']) >= sum(1 for c in wd['consoles'] if c[2] == sab['kind']):
            self.end_sabotage(room, now, 'Реактор починен.' if sab['kind'] == 'reactor' else 'Свет починен.')

    def end_sabotage(self, room, now, text):
        room['sabotage'] = None
        room['sabotage_at'] = now + 40
        self.say(room, None, text, 'sys', now)

    @staticmethod
    def near(p, x, y, r):
        return (p['x'] - x) ** 2 + (p['y'] - y) ** 2 <= r * r

    def act(self, room, p, a, now):
        kind = a.get('t')
        s, wd = room['settings'], WORLDS[room['map']]
        if kind == 'ready':
            if room['phase'] in ('lobby', 'end'):
                if p['id'] in room['ready']:
                    room['ready'].discard(p['id'])
                else:
                    room['ready'].add(p['id'])
                self.vote_check(room, now)
            return
        if kind == 'chat':
            text = re.sub(r'\s+', ' ', str(a.get('text', ''))).strip()[:140]
            if not text or not s['chat'] or p['muted'] or now - p['said'] < 1.2:
                return
            ghost = not p['alive'] and room['phase'] in ('play', 'meeting', 'result')
            if room['phase'] == 'play' and not ghost:
                return                       # во время смены живые молчат: обсуждение только на собрании
            low = text.lower().replace('ё', 'е')
            for bad in BAD:
                if bad.replace('ё', 'е') in low:
                    text = '***'
            p['said'] = now
            self.say(room, p, text, 'ghost' if ghost else 'all', now)
        elif kind == 'vote' and room['phase'] == 'meeting' and p['alive'] and p['id'] not in room['meeting']['votes']:
            target = a.get('id')
            if target == 'skip' or (isinstance(target, int) and target in room['players'] and room['players'][target]['alive']):
                room['meeting']['votes'][p['id']] = target
        elif room['phase'] != 'play':
            return
        elif kind == 'use':
            if now < p['lock'] or p['quiz']:
                return
            if p['alive'] and room['sabotage']:
                for i, (cx, cy, ckind) in enumerate(wd['consoles']):
                    if ckind == room['sabotage']['kind'] and self.near(p, cx + 0.5, cy + 0.5, 1.8) and i not in room['sabotage']['fixed']:
                        if p['job'] == 'engineer':          # инженер чинит без задания
                            p['last'] = 'починено без задания'
                            self.fixed(room, i, now)
                        else:
                            p['quiz'] = dict(self.question(room), kind='fix', at=i)
                        return
            for i in p['tasks']:
                tx, ty = wd['terminals'][i]
                if i not in p['done'] and self.near(p, tx + 0.5, ty + 0.5, 1.8):
                    p['quiz'] = dict(self.question(room), kind='task', at=i)
                    return
        elif kind == 'answer' and p['quiz']:
            q, p['quiz'] = p['quiz'], None
            if not answer_ok(q, a):
                p['wrong'] += 1
                p['lock'] = now + 4
                p['last_answer'] = {'ok': False, 'right': q['show'], 't': now}
                return
            p['right'] += 1
            p['last_answer'] = {'ok': True, 't': now}
            if q['kind'] == 'fix' and room['sabotage'] and p['role'] == 'crew':
                self.fixed(room, q['at'], now)
            elif q['kind'] == 'task':
                p['done'].append(q['at'])          # у вредителя задания «выполняются» так же, но в общий счёт не идут
                self.check_win(room, now)
        elif kind == 'close':
            p['quiz'] = None
        elif kind == 'pulse' and p['alive'] and now >= p['pulse_at'] and not p['quiz']:
            # Импульс есть у всех и выглядит одинаково. У вредителя он ещё и заражает ближайшего члена экипажа.
            p['pulse_at'] = now + s['cooldown']
            room['pulses'].append({'id': p['id'], 't': now})
            if p['role'] == 'imp':
                targets = [o for o in room['players'].values() if o['alive'] and o['role'] == 'crew' and not o['infected_at'] and self.near(o, p['x'], p['y'], 2.4)]
                if targets:
                    victim = min(targets, key=lambda o: (o['x'] - p['x']) ** 2 + (o['y'] - p['y']) ** 2)
                    victim['infected_at'] = now + s['infect']
                    p['last'] = f'заражён: {victim["name"]}'
                else:
                    p['last'] = 'мимо: рядом никого'
            elif p['job'] == 'medic':
                cured = [o for o in room['players'].values() if o['alive'] and o['infected_at'] and self.near(o, p['x'], p['y'], 2.4)]
                for o in cured:
                    o['infected_at'] = 0
                p['last'] = 'вылечен: ' + ', '.join(o['name'] for o in cured) if cured else 'рядом заражённых не было'
        elif kind == 'cams':
            cam = wd['cams']
            p['cams'] = bool(a.get('on')) and self.near(p, cam['x'] + 0.5, cam['y'] + 0.5, 2.0) and not p['quiz']
        elif kind == 'sabotage' and s['sabotage'] and p['alive'] and p['role'] == 'imp' and not room['sabotage'] and now >= room['sabotage_at']:
            self.sabotage(room, a.get('kind'), now)
        elif kind == 'report' and p['alive']:
            for b in room['bodies']:
                if self.near(p, b['x'], b['y'], 2.6):
                    self.meeting(room, p, 'body', b, now)
                    return
            if self.near(p, wd['table'][0], wd['table'][1], 2.6) and p['emergency'] > 0 and not (room['sabotage'] and room['sabotage']['kind'] == 'reactor'):
                p['emergency'] -= 1
                self.meeting(room, p, 'button', None, now)

    # ---------- что видит игрок ----------

    def view(self, room, p, now, since):
        now = room['paused'] or now          # на паузе все счётчики стоят
        done, total = self.progress(room)
        me = {'id': p['id'], 'alive': p['alive'], 'x': p['x'], 'y': p['y'], 'tasks': [{'i': i, 'done': i in p['done']} for i in p['tasks']], 'lock': max(0, round(p['lock'] - now, 1)),
              'pulse': max(0, round(p['pulse_at'] - now, 1)), 'emergency': p['emergency'], 'right': p['right'], 'wrong': p['wrong'], 'moved': p.pop('moved', False), 'muted': p['muted']}
        if p['quiz']:
            me['quiz'] = {k: p['quiz'][k] for k in PUBLIC if k in p['quiz']}
        answer = p.get('last_answer')
        if answer and now - answer['t'] < 4:
            me['answer'] = answer
        # Секретное: роль и состояние приёмов. Клиент показывает это только пока зажата клавиша.
        partners = [o['name'] for o in room['players'].values() if o['role'] == 'imp' and o['id'] != p['id']] if p['role'] == 'imp' else []
        secret = {'role': p['role'] if room['phase'] != 'lobby' else '', 'job': p['job'] if room['phase'] != 'lobby' else '', 'partners': partners, 'last': p['last'] if p['role'] == 'imp' or p['job'] else '',
                  'sabotage': (max(0, round(room['sabotage_at'] - now)) if room['settings']['sabotage'] else -2) if p['role'] == 'imp' and room['phase'] == 'play' else -1}
        end = room['phase'] == 'end'
        # Живой игрок не должен узнать об отключении раньше собрания: до него отключённый для всех «жив», просто его не видно.
        hide = p['alive'] and room['phase'] == 'play'
        players = [{'id': o['id'], 'name': o['name'], 'color': o['color'], 'x': round(o['x'], 2), 'y': round(o['y'], 2), 'alive': o['alive'] or (hide and not o.get('known_out')), 'on': now - o['seen'] < 20,
                    **({'gone': True} if hide and not o['alive'] else {}),
                    **({'role': o['role'], 'job': o['job'], 'right': o['right'], 'wrong': o['wrong'], 'score': o['score'], 'wins': o['wins']} if end else {})} for o in room['players'].values()]
        m = room['meeting']
        return {'status': 'ok', 'watch': room['phase'] == 'play' and any(o['cams'] for o in room['players'].values()), 'world': room['map'] if room['phase'] != 'lobby' or room['settings']['map'] == 'random' else room['settings']['map'], 'phase': room['phase'], 'round': room['round'], 'paused': bool(room['paused']), 'deleted': room['deleted'][-40:], 'wipe': room['wipe'], 'me': me, 'secret': secret, 'players': players, 'bodies': room['bodies'] if room['phase'] == 'play' else [],
                'progress': [room['shown'] if not end else done, total], 'pulses': [x['id'] for x in room['pulses']],
                'sabotage': {'kind': room['sabotage']['kind'], 'left': max(0, round(room['sabotage']['until'] - now)), 'fixed': sorted(room['sabotage']['fixed'])} if room['sabotage'] else None,
                'meeting': {'left': max(0, round(m['until'] - now)), 'by': m['by'], 'reason': m['reason'], 'body': m['body'], 'voted': sorted(m['votes']), 'mine': m['votes'].get(p['id']), 'result': m['result']} if m else None,
                'winner': room['winner'], 'why': room['why'], 'settings': room['settings'], 'imps': room['imps'] if end else [], 'winners': room['winners'] if end else [],
                'ready': self.ready_view(room, p, now),
                'chat': [c for c in room['chat'] if c['id'] > since and (c['ch'] != 'ghost' or not p['alive'] or end)][-60:], 'chatId': room['chat_id']}

    def ready_view(self, room, p, now):
        online, need = self.vote_need(room, now)
        return {'on': room['settings']['voteStart'] and room['phase'] in ('lobby', 'end'), 'votes': sum(1 for o in online if o['id'] in room['ready']), 'need': need, 'online': len(online),
                'mine': bool(p) and p['id'] in room['ready'], 'startIn': max(0, round(room['start_at'] - now)) if room['start_at'] else -1, 'names': [o['name'] for o in online if o['id'] in room['ready']]}

    def teacher_view(self, room, now):
        t = room['paused'] or now
        done, total = self.progress(room)
        m, names = room['meeting'], {p['id']: p['name'] for p in room['players'].values()}
        return {'status': 'ok', 'className': room['name'], 'world': room['map'], 'phase': room['phase'], 'round': room['round'], 'settings': room['settings'], 'progress': [done, total], 'winner': room['winner'], 'why': room['why'],
                'paused': bool(room['paused']), 'locked': room['locked'], 'ready': self.ready_view(room, None, now), 'imps': room['imps'] if room['phase'] == 'end' else [], 'winners': room['winners'] if room['phase'] == 'end' else [],
                'players': [{'id': p['id'], 'name': p['name'], 'color': p['color'], 'role': p['role'] if room['phase'] != 'lobby' else '', 'alive': p['alive'], 'on': now - p['seen'] < 20,
                             'x': round(p['x'], 1), 'y': round(p['y'], 1), 'done': len(p['done']), 'tasks': len(p['tasks']), 'right': p['right'], 'wrong': p['wrong'], 'score': p['score'], 'wins': p['wins'],
                             'infected': bool(p['infected_at']) and p['alive'], 'muted': p['muted'], 'quiz': bool(p['quiz']), 'job': p['job'] if room['phase'] != 'lobby' else '', 'cams': p['cams'],
                             'allRight': p['all_right'], 'allWrong': p['all_wrong'], 'rounds': p['rounds']} for p in room['players'].values()],
                'bodies': room['bodies'], 'chat': room['chat'][-120:],
                'sabotage': {'kind': room['sabotage']['kind'], 'left': max(0, round(room['sabotage']['until'] - t)), 'fixed': sorted(room['sabotage']['fixed'])} if room['sabotage'] else None,
                'meeting': {'left': max(0, round(m['until'] - t)), 'reason': m['reason'], 'result': m['result']['text'] if m['result'] else '',
                            'votes': [{'who': names.get(k, '?'), 'for': 'пропуск' if v == 'skip' else names.get(v, '?')} for k, v in m['votes'].items()]} if m else None}

    def screen(self, room, now):
        """Экран для проектора: без ролей и без того, где кто стоит; отключения — только уже известные всем."""
        t = room['paused'] or now
        end = room['phase'] == 'end'
        m = room['meeting']
        return {'status': 'ok', 'className': room['name'], 'world': room['map'], 'phase': room['phase'], 'round': room['round'], 'paused': bool(room['paused']),
                'progress': [self.progress(room)[0] if end else room['shown'], self.progress(room)[1]], 'winner': room['winner'], 'why': room['why'],
                'players': [dict({'name': p['name'], 'color': p['color'], 'out': (not p['alive']) if end or room['phase'] != 'play' else bool(p.get('known_out')), 'on': now - p['seen'] < 20},
                                 **({'role': p['role'], 'job': p['job'], 'score': p['score']} if end else {})) for p in room['players'].values()],
                'sabotage': {'kind': room['sabotage']['kind'], 'left': max(0, round(room['sabotage']['until'] - t))} if room['sabotage'] else None,
                'meeting': {'left': max(0, round(m['until'] - t)), 'reason': m['reason'], 'body': m['body'], 'voted': len(m['votes']), 'result': m['result']['text'] if m['result'] else ''} if m else None,
                'chat': [c for c in room['chat'] if c['ch'] != 'ghost'][-14:], 'ready': self.ready_view(room, None, now), 'imps': room['imps'] if end else [], 'winners': room['winners'] if end else []}

    def overview(self, now):
        return {'status': 'ok', 'server': {'open': self.open, 'up': round(now - self.born), 'version': self.version, 'syncs': self.syncs, 'time': round(now, 2)},
                'rooms': [{'className': r['name'], 'phase': r['phase'], 'round': r['round'], 'paused': bool(r['paused']), 'players': len(r['players']), 'on': sum(1 for p in r['players'].values() if now - p['seen'] < 20)}
                          for r in sorted(self.rooms.values(), key=lambda r: r['name']) if r['players']],
                'worlds': WORLDS}

    def command(self, room, action, data, now):
        """Команды с пульта учителя: полный контроль над комнатой класса."""
        phase, players = room['phase'], room['players']
        target = players.get(data.get('id')) if isinstance(data.get('id'), int) else None
        if action == 'start' and phase in ('lobby', 'end'):
            self.start(room, now, data.get('imps') if isinstance(data.get('imps'), list) else None)
        elif action == 'stop' and phase != 'lobby':
            self.bank_stats(room)
            for p in players.values():
                p.update(right=0, wrong=0, tasks=[], done=[], quiz=None, cams=False)
            room.update(phase='lobby', meeting=None, sabotage=None, bodies=[], paused=0)
            self.say(room, None, 'Учитель остановил раунд.', 'sys', now)
        elif action == 'pause' and phase in ('play', 'meeting', 'result'):
            if room['paused']:
                self.unpause(room, now)
                self.say(room, None, 'Игра продолжается.', 'sys', now)
            else:
                room['paused'] = now
                for p in players.values():
                    p['quiz'] = None
                self.say(room, None, 'Учитель поставил игру на паузу.', 'sys', now)
        elif action == 'meeting' and phase == 'play' and not room['paused']:
            self.meeting(room, None, 'teacher', None, now)
        elif action == 'endvote' and phase == 'meeting':
            self.tally(room, now)
        elif action == 'next' and phase == 'result':
            self.resume(room, now)
        elif action == 'win' and phase in ('play', 'meeting', 'result') and data.get('side') in ('crew', 'imp'):
            room['paused'] = 0
            self.finish(room, data['side'], 'так решил учитель.', now)
        elif action == 'sabotage' and phase == 'play' and not room['sabotage']:
            self.sabotage(room, data.get('kind'), now)
        elif action == 'unsabotage' and room['sabotage']:
            self.end_sabotage(room, now, 'Авария отменена.')
        elif action == 'kick' and target:
            del players[target['id']]
            room['bodies'] = [b for b in room['bodies'] if b['id'] != target['id']]
            if room['meeting']:
                room['meeting']['votes'].pop(target['id'], None)
            self.say(room, None, f'{target["name"]} покинул станцию.', 'sys', now)
            self.check_win(room, now)
        elif action == 'out' and target and target['alive'] and phase in ('play', 'meeting', 'result'):
            target.update(alive=False, known_out=True, quiz=None, infected_at=0)
            self.say(room, None, f'{target["name"]} отключён учителем.', 'sys', now)
            self.check_win(room, now)
        elif action == 'revive' and target and not target['alive'] and phase in ('play', 'meeting', 'result'):
            target.update(alive=True, known_out=False, infected_at=0)
            room['bodies'] = [b for b in room['bodies'] if b['id'] != target['id']]
            self.say(room, None, f'{target["name"]} возвращён в строй учителем.', 'sys', now)
        elif action == 'mute' and target:
            target['muted'] = not target['muted']
        elif action == 'announce':
            text = re.sub(r'\s+', ' ', str(data.get('text', ''))).strip()[:200]
            if text:
                self.say(room, None, text, 'teacher', now)
        elif action == 'delmsg' and isinstance(data.get('msg'), int):
            room['chat'] = [c for c in room['chat'] if c['id'] != data['msg']]
            room['deleted'].append(data['msg'])
        elif action == 'clearchat':
            room['chat'] = []
            room['wipe'] += 1
        elif action == 'resetscores':
            for p in players.values():
                p.update(score=0, wins=0, all_right=0, all_wrong=0, rounds=0)
        elif action == 'lock':
            room['locked'] = not room['locked']
        elif action == 'settings' and isinstance(data.get('settings'), dict):
            for key, value in data['settings'].items():
                if key in LIMITS and type(value) is int:
                    room['settings'][key] = max(LIMITS[key][0], min(LIMITS[key][1], value))
                elif key in ('reveal', 'chat', 'sabotage', 'roles', 'voteStart') and type(value) is bool:
                    room['settings'][key] = value
                elif key == 'map' and value in MAPS:
                    room['settings'][key] = value
                    if phase in ('lobby', 'end') and value != 'random':
                        room['map'] = value
                        for i, (o, (sx, sy)) in enumerate(zip(room['players'].values(), self.spots(room) * 4)):   # все переезжают к столу новой карты
                            o.update(x=sx, y=sy, moved=True)


def install_crew(app, journal_db=None, after_journal_change=None):
    bank = {}
    try:
        bank = json.loads(Path(__file__).with_name('crew_questions.json').read_text())
    except (OSError, ValueError):
        pass
    game = Game(bank)
    app.crew_game = game
    try:
        import hashlib
        game.version = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()[:8]
    except OSError:
        pass

    def fail(error):
        return jsonify(status='error', message=str(error)), getattr(error, 'code', 400)

    def body():
        data = request.get_json(force=True, silent=True)
        if not isinstance(data, dict):
            raise Refused('Ожидается объект.')
        return data

    @app.route('/results/api/crew/join', methods=['POST'])
    def crew_join():
        try:
            data = body()
            with game.lock:
                room, p = game.join(data.get('className'), data.get('name'), time.time())
                return jsonify(status='ok', id=p['id'], token=p['token'], color=p['color'], worlds=WORLDS, world=room['map'], teacher=is_teacher())
        except Refused as error:
            return fail(error)

    @app.route('/results/api/crew/sync', methods=['POST'])
    def crew_sync():
        try:
            data = body()
            now = time.time()
            with game.lock:
                room, p = game.who(data.get('className'), data.get('id'), data.get('token'))
                p['seen'] = now
                game.syncs += 1
                x, y = data.get('x'), data.get('y')
                if room['phase'] == 'play' and not room['paused'] and isinstance(x, (int, float)) and isinstance(y, (int, float)) and 0 <= x < WORLDS[room['map']]['w'] and 0 <= y < WORLDS[room['map']]['h'] and WORLDS[room['map']]['map'][int(y)][int(x)] == '.' and not p.get('moved'):   # в стену не пускаем
                    p['x'], p['y'] = float(x), float(y)
                acts = data.get('acts')
                for a in acts[:8] if isinstance(acts, list) else []:
                    if isinstance(a, dict) and (not room['paused'] or a.get('t') == 'chat'):
                        game.act(room, p, a, now)
                game.tick(room, now)
                since = data.get('chat')
                return jsonify(game.view(room, p, now, since if isinstance(since, int) else 0))
        except Refused as error:
            return fail(error)

    @app.route('/results/api/crew/teacher', methods=['POST'])
    def crew_teacher():
        try:
            if not is_teacher():
                raise Refused('Пульт учителя доступен только с учительского ноутбука.', 403)
            data = body()
            now = time.time()
            action = data.get('action')
            with game.lock:
                # Команды для всего сервера: класс для них не нужен.
                if action == 'overview':
                    return jsonify(game.overview(now))
                if action == 'open':
                    game.open = not game.open
                    return jsonify(game.overview(now))
                if action == 'clearall':
                    game.rooms.clear()
                    return jsonify(game.overview(now))
                room = game.room(data.get('className'))
                if action == 'marks':
                    # Отметки за урок. Без apply — только предложение; с apply учитель записывает их в журнал.
                    need = data.get('need') if isinstance(data.get('need'), list) and len(data['need']) == 3 and all(type(n) is int and 1 <= n <= 200 for n in data['need']) else [4, 8, 12]
                    need = sorted(need)
                    marks, written = game.marks(room, need), 0
                    if data.get('apply'):
                        if not journal_db:
                            raise Refused('Журнал к игре не подключён.', 409)
                        topic, stamp, ip = f'{room["grade"]} класс: Сбой на станции · сетевая игра', datetime.now().strftime('%d.%m.%Y %H:%M:%S'), request.remote_addr or ''
                        with closing(sqlite3.connect(journal_db, timeout=10)) as journal, journal:
                            journal.execute('BEGIN IMMEDIATE')
                            for m in marks:
                                if not m['mark']:
                                    continue
                                details = json.dumps([{'num': 1, 'title': 'Верных ответов', 'isCorrect': True, 'userAns': f'{m["right"]} из {m["right"] + m["wrong"]}'},
                                                      {'num': 2, 'title': 'Раундов сыграно', 'isCorrect': True, 'userAns': str(m['rounds'])}, {'num': 3, 'title': 'Побед своей стороны', 'isCorrect': True, 'userAns': str(m['wins'])}], ensure_ascii=False)
                                row = (stamp, ip, '', m['right'], m['right'] + m['wrong'], m['acc'], m['mark'], details)
                                old = journal.execute('SELECT id, mark FROM test_results WHERE student_name = ? AND class_name = ? AND topic = ? ORDER BY id DESC LIMIT 1', (m['name'], room['name'], topic)).fetchone()
                                if old and old[1] > m['mark']:
                                    continue                  # прежняя отметка за эту игру выше — не понижаем
                                if old:
                                    journal.execute('UPDATE test_results SET created_at = ?, ip_address = ?, computer_name = ?, score = ?, max_score = ?, percent = ?, mark = ?, details_json = ? WHERE id = ?', row + (old[0],))
                                else:
                                    journal.execute('INSERT INTO test_results (created_at, ip_address, computer_name, student_name, class_name, topic, score, max_score, percent, mark, attempt, details_json) '
                                                    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)', (stamp, ip, '', m['name'], room['name'], topic) + row[3:7] + (details,))
                                written += 1
                        if written and after_journal_change:
                            threading.Thread(target=after_journal_change, daemon=True).start()
                    return jsonify(status='ok', marks=marks, need=need, written=written, journal=bool(journal_db))
                if action == 'clear':
                    game.rooms.pop(room['name'], None)
                    return jsonify(status='ok', cleared=True)
                if action == 'screen':
                    game.tick(room, now)
                    return jsonify(game.screen(room, now))
                game.command(room, action, data, now)
                game.tick(room, now)
                return jsonify(game.teacher_view(room, now))
        except Refused as error:
            return fail(error)

    return game
