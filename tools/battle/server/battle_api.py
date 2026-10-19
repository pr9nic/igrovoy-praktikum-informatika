"""«Битва класса» в игровом практикуме: викторины всем классом в духе Wayground (Quizizz), все функции бесплатно.

Учитель (только с учительского ноутбука) ведёт библиотеку викторин, открывает игру для класса и управляет ею;
ученики класса, вошедшие в практикум, попадают в лобби сами — без кодов и QR. Ответы проверяет сервер.

Режимы: classic — каждый в своём темпе, таблица лидеров; paced — учитель ведёт вопросы на проекторе;
team — команды, счёт команды — средний по участникам; test — без игровых элементов; peak — «Восхождение»:
ошибки возвращаются позже (интервальное повторение), цель — точность, привалы с усилителями и мини-играми.

Викторины, итоги игр и снаряжение альпинистов — в своём файле battle.db рядом с данными журнала.
В журнал отметки не пишутся. Это не защищённый экзаменационный режим.
"""
import json
import os
import random
import re
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from fractions import Fraction
from pathlib import Path

from flask import jsonify, request

from portal_security import is_teacher

CLASS = re.compile(r'(6|7|8|9|10|11) «[АБВГДЕЖЗИК]»')
BANK = json.loads((Path(__file__).with_name('battle_questions.json')).read_text(encoding='utf-8'))
TYPES = ('single', 'multi', 'poll', 'fill', 'math', 'open', 'cloud', 'match', 'reorder', 'categorize', 'dragdrop', 'dropdown', 'label', 'hotspot', 'graph', 'draw', 'slide')
UNGRADED = ('poll', 'open', 'cloud', 'draw', 'slide')
MODES = ('classic', 'paced', 'team', 'test', 'peak')
POWERS = ('fifty', 'eraser', 'double', 'jeopardy', 'immunity', 'freeze', 'streak_boost', 'streak_saver', 'supersonic', 'gift', 'glitch', 'powerplay')
PEAK_POWERS = ('fifty', 'eraser', 'immunity', 'double', 'freeze', 'streak_saver')
MINIS = ('bats', 'circles', 'gear', 'landslide')
TEAMS = (('Биты', '#4f9bff'), ('Байты', '#ff5a5a'), ('Пиксели', '#4fd07a'), ('Кванты', '#ffc94d'))
THEMES = ('info', 'elbrus', 'fuji')
AVATARS = 12
AVATAR_SUMMITS = {8: 1, 9: 3, 10: 5, 11: 10}      # последние четыре альпиниста открываются за покорённые вершины
DEFAULTS = {'timer': True, 'shuffleQ': True, 'shuffleOpts': True, 'showAnswers': True, 'explain': True, 'leaderboard': True, 'memes': True,
            'music': True, 'powerups': True, 'redemption': True, 'streaks': True, 'attempts': 1, 'goal': 80, 'theme': 'info', 'teams': 2, 'readAloud': False}
DATA_URL = re.compile(r'data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+')


class Refused(Exception):
    def __init__(self, message, code=400):
        super().__init__(message)
        self.code = code


def need(ok, message):
    if not ok:
        raise Refused(message)


def norm(s):
    return re.sub(r'\s+', ' ', str(s).strip().lower().replace('ё', 'е')).strip(' .,!?;:«»"\'')


def anyorder(key):
    """«Аня Отличница» и «Отличница Аня» — один ученик (для списка убранных)."""
    return ' '.join(sorted(key.split()))


def same(token, given):
    return isinstance(given, str) and secrets.compare_digest(token.encode(), given.encode('utf-8', 'replace'))


def short(name):
    p = str(name).split()
    return f'{p[1]} {p[0][0]}.' if len(p) >= 2 else str(name)


NUMBER = re.compile(r'[-+]?(\d+/\d+|(\d+\.?\d*|\.\d+)(e[-+]?\d{1,3})?)', re.I)   # порядок до трёх цифр: Fraction('1e10000000') считает секунды


def number(s):
    """Число из ответа ученика: «3,5», «-2», «1/4», «1e3»."""
    s = str(s).strip().replace(' ', '').replace(',', '.').replace('−', '-')
    if len(s) > 40 or not NUMBER.fullmatch(s):
        return None
    try:
        return float(Fraction(s))
    except (ValueError, ArithmeticError):
        return None


# ---------- проверка викторины из редактора ----------

def text(v, name, limit, empty=False):
    need(isinstance(v, str) and (empty or v.strip()) and len(v) <= limit, f'{name}: текст до {limit} символов')
    return v.strip()


def strings(v, name, lo, hi, limit=150):
    need(isinstance(v, list) and lo <= len(v) <= hi, f'{name}: от {lo} до {hi} вариантов')
    out = [text(x, name, limit) for x in v]
    need(len({norm(x) for x in out}) == len(out), f'{name}: варианты не должны повторяться')
    return out


def pct(v, name):
    need(isinstance(v, (int, float)) and 0 <= v <= 100, f'{name}: координаты в процентах 0–100')
    return round(float(v), 2)


def whole(v, name):
    try:
        return int(v)
    except (TypeError, ValueError, OverflowError):
        raise Refused(f'{name}: ожидается целое число')


def dicts(v):
    return isinstance(v, list) and all(isinstance(x, dict) for x in v)


BLANK = re.compile(r'\[\[([^\[\]]{1,60})\]\]')
DROP = re.compile(r'\{\{([^{}]{1,200})\}\}')


def clean_question(q, i):
    need(isinstance(q, dict), f'Вопрос {i}: ожидается объект')
    t = q.get('type')
    need(t in TYPES, f'Вопрос {i}: неизвестный тип')
    name = f'Вопрос {i}'
    out = {'id': str(q.get('id') or secrets.token_hex(4))[:16], 'type': t, 'text': text(q.get('text', ''), name, 600, empty=t in ('dragdrop', 'dropdown')),
           'time': whole(q.get('time', 30), name + ': время'), 'weight': whole(q.get('weight', 1), name + ': баллы'), 'explain': text(q.get('explain', ''), name + ': пояснение', 500, empty=True)}
    need(5 <= out['time'] <= 300, f'{name}: время от 5 до 300 секунд')
    need(1 <= out['weight'] <= 10, f'{name}: баллы от 1 до 10')
    img = q.get('image') or ''
    if img:
        need(isinstance(img, str) and len(img) <= 600000 and DATA_URL.fullmatch(img), f'{name}: картинка — PNG, JPEG или WebP до 450 КБ')
        out['image'] = img
    if t in ('single', 'poll'):
        out['options'] = strings(q.get('options'), name, 2, 6)
        if t == 'single':
            need(isinstance(q.get('answer'), int) and 0 <= q['answer'] < len(out['options']), f'{name}: отметьте верный вариант')
            out['answer'] = q['answer']
    elif t == 'multi':
        out['options'] = strings(q.get('options'), name, 2, 8)
        a = q.get('answers')
        need(isinstance(a, list) and a and all(isinstance(x, int) and 0 <= x < len(out['options']) for x in a), f'{name}: отметьте верные варианты')
        out['answers'] = sorted(set(a))
    elif t == 'fill':
        out['accepted'] = strings(q.get('accepted'), name + ': ответы', 1, 10, 80)
    elif t == 'math':
        need(number(q.get('value')) is not None, f'{name}: верный ответ — число (можно дробь 1/4)')
        out['value'] = str(q['value']).strip()
        tol = q.get('tol', 0)
        need(isinstance(tol, (int, float)) and 0 <= tol <= 1e6, f'{name}: погрешность — неотрицательное число')
        out['tol'] = float(tol)
        out['unit'] = text(q.get('unit', ''), name + ': единицы', 20, empty=True)
    elif t == 'match':
        p = q.get('pairs')
        need(isinstance(p, list) and 2 <= len(p) <= 8 and all(isinstance(x, list) and len(x) == 2 for x in p), f'{name}: от 2 до 8 пар')
        out['pairs'] = [[text(a, name, 120), text(b, name, 120)] for a, b in p]
        need(len({norm(b) for _, b in out['pairs']}) == len(p), f'{name}: правые части пар не должны повторяться')
    elif t == 'reorder':
        out['items'] = strings(q.get('items'), name, 2, 8, 120)
    elif t == 'categorize':
        cats = q.get('cats')
        need(dicts(cats) and 2 <= len(cats) <= 4, f'{name}: от 2 до 4 групп')
        out['cats'] = [{'name': text(c.get('name', ''), name, 60), 'items': strings(c.get('items'), name + ': элементы группы', 1, 6, 80)} for c in cats]
        allitems = [norm(x) for c in out['cats'] for x in c['items']]
        need(len(allitems) <= 16 and len(set(allitems)) == len(allitems), f'{name}: до 16 разных элементов')
    elif t == 'dragdrop':
        blanks = BLANK.findall(out['text'])
        need(1 <= len(blanks) <= 8, f'{name}: отметьте пропуски [[словом]] — от 1 до 8')
        out['distractors'] = strings(q.get('distractors', []), name + ': лишние слова', 0, 6, 60) if q.get('distractors') else []
    elif t == 'dropdown':
        blanks = DROP.findall(out['text'])
        need(1 <= len(blanks) <= 6, f'{name}: списки {{{{верно|неверно}}}} — от 1 до 6')
        for b in blanks:
            opts = [x.strip() for x in b.split('|')]
            need(2 <= len(opts) <= 5 and all(opts) and len(set(map(norm, opts))) == len(opts), f'{name}: в списке 2–5 разных вариантов, первый — верный')
    elif t == 'label':
        need('image' in out, f'{name}: нужна картинка')
        s = q.get('spots')
        need(dicts(s) and 2 <= len(s) <= 8, f'{name}: от 2 до 8 подписей')
        out['spots'] = [{'text': text(x.get('text', ''), name, 60), 'x': pct(x.get('x'), name), 'y': pct(x.get('y'), name)} for x in s]
    elif t == 'hotspot':
        need('image' in out, f'{name}: нужна картинка')
        s = q.get('spots')
        need(dicts(s) and 1 <= len(s) <= 4, f'{name}: от 1 до 4 верных областей')
        out['spots'] = [{'x': pct(x.get('x'), name), 'y': pct(x.get('y'), name), 'r': pct(x.get('r', 8), name)} for x in s]
    elif t == 'graph':
        pts = q.get('points')
        need(isinstance(pts, list) and 1 <= len(pts) <= 4 and all(isinstance(p, list) and len(p) == 2 and all(isinstance(v, int) and -10 <= v <= 10 for v in p) for p in pts), f'{name}: от 1 до 4 точек с целыми координатами от −10 до 10')
        need(len({tuple(p) for p in pts}) == len(pts), f'{name}: точки не должны повторяться')
        out['points'] = [list(p) for p in pts]
    return out


def clean_quiz(d):
    need(isinstance(d, dict), 'Ожидается викторина.')
    qs = d.get('questions')
    need(isinstance(qs, list) and 1 <= len(qs) <= 60, 'В викторине от 1 до 60 вопросов.')
    grade = whole(d.get('grade') or 0, 'Класс')
    need(grade == 0 or 6 <= grade <= 11, 'Класс: 6–11 или 0 — для всех.')
    out = {'title': text(d.get('title', ''), 'Название', 100), 'grade': grade, 'questions': [clean_question(q, i + 1) for i, q in enumerate(qs)]}
    ids = [q['id'] for q in out['questions']]
    if len(set(ids)) != len(ids):
        for q in out['questions']:
            q['id'] = secrets.token_hex(4)
    need(any(q['type'] != 'slide' for q in out['questions']), 'Нужен хотя бы один вопрос (не только слайды).')
    return out


# ---------- вид вопроса для ученика и проверка ответа ----------

def perm(n, rnd, on=True):
    p = list(range(n))
    if on:
        rnd.shuffle(p)
    return p


def view(q, rnd, shuffle):
    """Вопрос без ответов. Возвращает (что показать, ключ перестановок для проверки)."""
    t = q['type']
    v = {'id': q['id'], 'type': t, 'text': q['text'], 'time': q['time']}
    if q.get('image'):
        v['image'] = q['image']
    key = {}
    if t in ('single', 'multi', 'poll'):
        key['o'] = perm(len(q['options']), rnd, shuffle)
        v['options'] = [q['options'][i] for i in key['o']]
        if t == 'multi':
            v['many'] = True
    elif t == 'match':
        key['r'] = perm(len(q['pairs']), rnd, True)
        v['left'] = [p[0] for p in q['pairs']]
        v['right'] = [q['pairs'][i][1] for i in key['r']]
    elif t == 'reorder':
        p = perm(len(q['items']), rnd, True)
        while p == sorted(p) and len(p) > 1:
            rnd.shuffle(p)
        key['i'] = p
        v['items'] = [q['items'][i] for i in p]
    elif t == 'categorize':
        flat = [(c, x) for c, cat in enumerate(q['cats']) for x in cat['items']]
        key['i'] = perm(len(flat), rnd, True)
        v['cats'] = [c['name'] for c in q['cats']]
        v['items'] = [flat[i][1] for i in key['i']]
    elif t == 'dragdrop':
        blanks = BLANK.findall(q['text'])
        bank = blanks + q.get('distractors', [])
        key['b'] = perm(len(bank), rnd, True)
        v['parts'] = BLANK.split(q['text'])[::2]
        v['bank'] = [bank[i] for i in key['b']]
        v['text'] = ''
    elif t == 'dropdown':
        groups = [[x.strip() for x in b.split('|')] for b in DROP.findall(q['text'])]
        key['d'] = [perm(len(g), rnd, True) for g in groups]
        v['parts'] = DROP.split(q['text'])[::2]
        v['lists'] = [[g[i] for i in p] for g, p in zip(groups, key['d'])]
        v['text'] = ''
    elif t == 'label':
        key['l'] = perm(len(q['spots']), rnd, True)
        v['spots'] = [{'x': s['x'], 'y': s['y']} for s in q['spots']]
        v['labels'] = [q['spots'][i]['text'] for i in key['l']]
    elif t == 'graph':
        v['count'] = len(q['points'])
    elif t == 'math' and q.get('unit'):
        v['unit'] = q['unit']
    return v, key


def solution(q, key):
    """Верный ответ в тех же обозначениях, что и ответ ученика (для подсветки после ответа)."""
    t = q['type']
    if t == 'single':
        return key['o'].index(q['answer'])
    if t == 'multi':
        return sorted(key['o'].index(a) for a in q['answers'])
    if t == 'fill':
        return q['accepted'][0]
    if t == 'math':
        return q['value'] + (' ' + q['unit'] if q.get('unit') else '')
    if t == 'match':
        return [key['r'].index(i) for i in range(len(q['pairs']))]
    if t == 'reorder':
        return [key['i'].index(i) for i in range(len(q['items']))]
    if t == 'categorize':
        flat = [c for c, cat in enumerate(q['cats']) for _ in cat['items']]
        return [flat[i] for i in key['i']]
    if t == 'dragdrop':
        return [key['b'].index(i) for i in range(len(BLANK.findall(q['text'])))]
    if t == 'dropdown':
        return [p.index(0) for p in key['d']]
    if t == 'label':
        return [key['l'].index(i) for i in range(len(q['spots']))]
    if t == 'hotspot':
        return q['spots']
    if t == 'graph':
        return q['points']
    return None


def grade(q, key, ans):
    """Доля верного 0..1; None — вопрос без оценки (опрос, открытый ответ, рисунок, облако слов, слайд)."""
    t = q['type']
    if t in UNGRADED:
        return None
    try:
        if t == 'single':
            return 1.0 if key['o'][int(ans)] == q['answer'] else 0.0
        if t == 'multi':
            got = {key['o'][int(i)] for i in ans}
            right = set(q['answers'])
            good = len(got & right) - len(got - right)
            return 1.0 if got == right else max(0.0, good / len(right)) * 0.99
        if t == 'fill':
            return 1.0 if norm(ans) in {norm(a) for a in q['accepted']} else 0.0
        if t == 'math':
            v, want = number(ans), number(q['value'])
            return 1.0 if v is not None and abs(v - want) <= q.get('tol', 0) + 1e-9 * max(1, abs(want)) else 0.0
        if t == 'match':
            n = len(q['pairs'])
            return sum(1 for i in range(n) if ans[i] is not None and key['r'][int(ans[i])] == i) / n
        if t == 'reorder':
            n = len(q['items'])
            order = [key['i'][int(x)] for x in ans]
            return sum(1 for pos, i in enumerate(order) if i == pos) / n if len(order) == n else 0.0
        if t == 'categorize':
            flat = [c for c, cat in enumerate(q['cats']) for _ in cat['items']]
            return sum(1 for s, i in enumerate(key['i']) if ans[s] is not None and int(ans[s]) == flat[i]) / len(flat)
        if t == 'dragdrop':
            n = len(BLANK.findall(q['text']))
            words = BLANK.findall(q['text']) + q.get('distractors', [])
            # слово верно, если совпадает текстом (одинаковые слова в разных пропусках взаимозаменяемы)
            return sum(1 for b in range(n) if ans[b] is not None and norm(words[key['b'][int(ans[b])]]) == norm(words[b])) / n
        if t == 'dropdown':
            return sum(1 for b, p in enumerate(key['d']) if ans[b] is not None and p[int(ans[b])] == 0) / len(key['d'])
        if t == 'label':
            n = len(q['spots'])
            return sum(1 for s in range(n) if ans[s] is not None and key['l'][int(ans[s])] == s) / n
        if t == 'hotspot':
            x, y = float(ans['x']), float(ans['y'])
            return 1.0 if any((x - s['x']) ** 2 + (y - s['y']) ** 2 <= s['r'] ** 2 for s in q['spots']) else 0.0
        if t == 'graph':
            got = {(int(p[0]), int(p[1])) for p in ans}
            right = {tuple(p) for p in q['points']}
            return len(got & right) / len(right) if len(got) <= len(right) else max(0.0, (len(got & right) - (len(got) - len(right))) / len(right))
    except (TypeError, ValueError, KeyError, IndexError, ArithmeticError):     # 1e400 из JSON — бесконечность
        return 0.0
    return 0.0


def answer_text(q, key, ans):
    """Короткая запись ответа для отчёта учителя."""
    t = q['type']
    try:
        if t in ('single', 'poll'):
            return q['options'][key['o'][int(ans)]]
        if t == 'multi':
            return '; '.join(q['options'][key['o'][int(i)]] for i in ans)
        if t in ('fill', 'math', 'open', 'cloud'):
            return str(ans)[:600]
        if t == 'draw':
            return '[рисунок]'
        if t == 'hotspot':
            return f'точка ({round(float(ans["x"]))}%, {round(float(ans["y"]))}%)'
        if t == 'graph':
            return ', '.join(f'({int(p[0])}; {int(p[1])})' for p in ans)
        if t == 'reorder':
            return ' → '.join(q['items'][key['i'][int(x)]] for x in ans)
    except (TypeError, ValueError, KeyError, IndexError, ArithmeticError):
        return '—'
    return '[ответ]'


def fits(t, ans):
    """Ответ ученика нужного вида и размера; None — время вышло."""
    if ans is None or t == 'slide':
        return True
    if t in ('fill', 'math', 'open', 'cloud', 'draw'):
        return isinstance(ans, str)
    if t in ('single', 'poll'):
        return isinstance(ans, int)
    if t == 'hotspot':
        return isinstance(ans, dict) and len(ans) == 2 and all(isinstance(ans.get(k), (int, float)) for k in 'xy')
    if t == 'graph':
        return isinstance(ans, list) and len(ans) <= 16 and all(isinstance(x, list) and len(x) == 2 and all(isinstance(v, int) for v in x) for x in ans)
    return isinstance(ans, list) and len(ans) <= 16 and all(x is None or isinstance(x, int) for x in ans)


def eliminate(q, key, n, rnd):
    """Убрать n неверных вариантов (усилители «50 на 50» и «Ластик»): номера в порядке показа."""
    if q['type'] not in ('single', 'multi'):
        return []
    right = {q['answer']} if q['type'] == 'single' else set(q['answers'])
    wrong = [s for s, i in enumerate(key['o']) if i not in right]
    rnd.shuffle(wrong)
    return sorted(wrong[:min(n, max(0, len(wrong) - (0 if q['type'] == 'multi' else 0)))])


# ---------- комнаты ----------

def dumpable(p):
    return {k: v for k, v in p.items() if k not in ('token',)}


class Battle:
    def __init__(self, db_path, seed=None):
        self.rooms = {}
        self.lock = threading.Lock()
        self.rnd = random.Random(seed)
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self.db() as c:
            c.executescript('''CREATE TABLE IF NOT EXISTS quizzes (id INTEGER PRIMARY KEY, title TEXT, grade INTEGER, data TEXT, created REAL, updated REAL);
                CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY, title TEXT, cls TEXT, mode TEXT, started REAL, ended REAL, data TEXT);
                CREATE TABLE IF NOT EXISTS climbers (cls TEXT, key TEXT, name TEXT, summits INTEGER DEFAULT 0, avatar INTEGER DEFAULT 0, PRIMARY KEY (cls, key));''')
            if not c.execute('SELECT 1 FROM quizzes LIMIT 1').fetchone():
                self.seed(c)

    @contextmanager
    def db(self):
        c = sqlite3.connect(self.db_path, timeout=10)
        try:
            with c:
                yield c
        finally:
            c.close()

    # --- библиотека ---
    def seed(self, c):
        """Первые викторины: по классам из банка «Битвы с Глюком» и демонстрация всех типов вопросов."""
        now = time.time()
        demo = json.loads((Path(__file__).with_name('battle_demo.json')).read_text(encoding='utf-8'))
        c.execute('INSERT INTO quizzes (title, grade, data, created, updated) VALUES (?, ?, ?, ?, ?)', (demo['title'], 0, json.dumps(clean_quiz(demo), ensure_ascii=False), now, now))
        for g in range(6, 12):
            qs = [{'type': 'single', 'text': q['q'], 'options': [q['a']] + list(q['w']), 'answer': 0, 'time': 20, 'explain': q.get('e', '')} for q in BANK.get(str(g), [])[:15]]
            if qs:
                quiz = clean_quiz({'title': f'Разминка: {g} класс', 'grade': g, 'questions': qs})
                c.execute('INSERT INTO quizzes (title, grade, data, created, updated) VALUES (?, ?, ?, ?, ?)', (quiz['title'], g, json.dumps(quiz, ensure_ascii=False), now, now))

    def quizzes(self):
        with self.db() as c:
            rows = c.execute('SELECT id, title, grade, data, updated FROM quizzes ORDER BY updated DESC').fetchall()
        out = []
        for i, t, g, d, u in rows:
            qs = json.loads(d)['questions']
            out.append({'id': i, 'title': t, 'grade': g, 'count': len(qs), 'types': sorted({q['type'] for q in qs}), 'updated': u})
        return out

    def quiz(self, qid):
        with self.db() as c:
            r = c.execute('SELECT data FROM quizzes WHERE id = ?', (qid,)).fetchone()
        if not r:
            raise Refused('Викторина не найдена.', 404)
        d = json.loads(r[0])
        d['id'] = qid
        return d

    def save_quiz(self, data, qid=None):
        quiz = clean_quiz(data)
        now = time.time()
        with self.db() as c:
            if qid:
                need(c.execute('SELECT 1 FROM quizzes WHERE id = ?', (qid,)).fetchone(), 'Викторина не найдена.')
                c.execute('UPDATE quizzes SET title = ?, grade = ?, data = ?, updated = ? WHERE id = ?', (quiz['title'], quiz['grade'], json.dumps(quiz, ensure_ascii=False), now, qid))
            else:
                need(c.execute('SELECT COUNT(*) FROM quizzes').fetchone()[0] < 500, 'В библиотеке уже 500 викторин.')
                qid = c.execute('INSERT INTO quizzes (title, grade, data, created, updated) VALUES (?, ?, ?, ?, ?)', (quiz['title'], quiz['grade'], json.dumps(quiz, ensure_ascii=False), now, now)).lastrowid
        return qid

    def delete_quiz(self, qid):
        with self.db() as c:
            c.execute('DELETE FROM quizzes WHERE id = ?', (qid,))

    # --- альпинисты ---
    def climber(self, cls, name):
        with self.db() as c:
            r = c.execute('SELECT summits, avatar FROM climbers WHERE cls = ? AND key = ?', (cls, norm(name))).fetchone()
        return {'summits': r[0], 'avatar': r[1]} if r else {'summits': 0, 'avatar': -1}

    def set_avatar(self, cls, name, avatar):
        need(isinstance(avatar, int) and 0 <= avatar < AVATARS, 'Нет такого альпиниста.')
        info = self.climber(cls, name)
        need(info['summits'] >= AVATAR_SUMMITS.get(avatar, 0), f'Этот альпинист откроется после {AVATAR_SUMMITS.get(avatar, 0)} покорённых вершин.')
        with self.db() as c:
            c.execute('INSERT INTO climbers (cls, key, name, avatar) VALUES (?, ?, ?, ?) ON CONFLICT (cls, key) DO UPDATE SET avatar = excluded.avatar', (cls, norm(name), name, avatar))

    def add_summit(self, cls, name):
        with self.db() as c:
            c.execute('INSERT INTO climbers (cls, key, name, summits, avatar) VALUES (?, ?, ?, 1, -1) ON CONFLICT (cls, key) DO UPDATE SET summits = summits + 1', (cls, norm(name), name))

    # --- комната ---
    def room(self, cls):
        need(CLASS.fullmatch(str(cls or '')), 'Неизвестный класс.')
        r = self.rooms.get(cls)
        if not r:
            raise Refused('Игра для этого класса ещё не открыта.', 404)
        return r

    def open(self, cls, quiz_id, mode, settings, now):
        need(CLASS.fullmatch(str(cls or '')), 'Неизвестный класс.')
        need(mode in MODES, 'Неизвестный режим.')
        quiz = self.quiz(quiz_id)
        st = dict(DEFAULTS)
        for k, v in (settings or {}).items():
            if k in DEFAULTS and type(v) is type(DEFAULTS[k]):
                st[k] = v
        st['attempts'] = max(1, min(5, st['attempts']))
        st['goal'] = max(30, min(100, st['goal']))
        st['teams'] = max(2, min(4, st['teams']))
        if st['theme'] not in THEMES:
            st['theme'] = 'info'
        if mode == 'test':
            st.update(powerups=False, memes=False, leaderboard=False, streaks=False, music=False, redemption=False)
        if mode == 'peak':
            st.update(redemption=False, timer=False)
        if mode == 'paced':
            st.update(shuffleQ=False, shuffleOpts=False, redemption=False, timer=True)
        old = self.rooms.get(cls)
        if old and old['phase'] in ('lobby', 'live'):
            raise Refused('Для этого класса уже идёт игра — сначала завершите её.', 409)
        qs = quiz['questions']
        r = {'cls': cls, 'quiz': quiz, 'qmap': {q['id']: q for q in qs}, 'mode': mode, 'settings': st, 'phase': 'lobby', 'opened': now, 'started': 0,
             'paused': False, 'paused_at': 0, 'players': {}, 'events': [], 'ev_id': 0, 'powerplay_until': 0, 'cur': -1, 'cur_start': 0, 'reveal': False,
             'result_id': None, 'kicked': set(), 'salt': secrets.token_hex(16)}     # соль перестановок ученику не уходит, иначе ответы вычисляются
        self.rooms[cls] = r
        return r

    def event(self, r, kind, text, who=None, now=None):
        r['ev_id'] += 1
        r['events'].append({'id': r['ev_id'], 'kind': kind, 'text': text, 'who': who, 'at': now or time.time()})
        del r['events'][:-30]

    def join(self, cls, name, now, token=None):
        r = self.room(cls)
        name = re.sub(r'\s+', ' ', str(name or '').strip())
        need(5 <= len(name) <= 80 and ' ' in name and not any(ord(c) < 32 or '\ud800' <= c <= '\udfff' for c in name), 'Укажите фамилию и имя.')   # суррогат не записать в battle.db
        key = norm(name)
        if anyorder(key) in r['kicked']:
            raise Refused('Учитель убрал тебя из этой игры.', 403)
        p = r['players'].get(key)
        if p:
            # то же имя с другого компьютера, пока прежний вход на связи, — только с прежним ключом (обновление страницы)
            if now - p['seen'] < 8 and not same(p['token'], token):
                raise Refused('Ты уже в игре с другого компьютера. Если это не ты — скажи учителю.', 409)
            p['token'], p['seen'] = secrets.token_urlsafe(12), now
            return r, p
        need(len(r['players']) < 45, 'В игре уже 45 участников.')
        teams = r['settings']['teams']
        sizes = [sum(1 for x in r['players'].values() if x['team'] == t) for t in range(teams)]
        info = self.climber(cls, name)
        p = {'key': key, 'name': name, 'token': secrets.token_urlsafe(12), 'seen': now, 'joined': now, 'team': sizes.index(min(sizes)) if r['mode'] == 'team' else -1,
             'acc': {'extra': 1.0, 'reduce': False, 'read': False}, 'avatar': info['avatar'] if info['avatar'] >= 0 else self.rnd.randrange(8), 'summits': info['summits'], 'attempt': 0}
        self.reset_player(r, p, now)
        r['players'][key] = p
        return r, p

    def reset_player(self, r, p, now):
        qs = [q['id'] for q in r['quiz']['questions']]
        rnd = random.Random(f"{r['salt']}:{p['key']}:{p['attempt']}:{r['opened']}")
        if r['settings']['shuffleQ'] and r['mode'] not in ('paced',):
            slides = r['mode'] == 'peak'
            qs = [q for q in qs if not (slides and r['qmap'][q]['type'] == 'slide')]
            rnd.shuffle(qs)
        p.update(order=qs, queue=list(qs), i=0, score=0, streak=0, best_streak=0, answers={}, keys={}, shown={}, attempts={}, mastered=[], passed=[],
                 inventory=[], effects={}, done=False, finished_at=0, redemption=None, redeemed=False, brk=None, since_break=0, mini_bonus=0, summit_at=0,
                 glitch_until=0, last=None, seen_events=r['ev_id'])

    def who(self, cls, key, token):
        r = self.room(cls)
        p = r['players'].get(norm(key or ''))
        if not p or not same(p['token'], token):
            raise Refused('Нужно войти в игру заново.', 403)
        return r, p

    # --- ход игры ---
    def current(self, r, p):
        """Id текущего вопроса ученика или None."""
        if r['phase'] != 'live' or p['done'] or p['brk']:
            return None
        if r['mode'] == 'paced':
            if r['cur'] < 0 or r['reveal']:
                return None
            qid = r['quiz']['questions'][r['cur']]['id']
            return None if qid in p['answers'] else qid
        if p['redemption'] and not p['redeemed']:
            return p['redemption']
        if r['mode'] == 'peak':
            return p['queue'][0] if p['queue'] else None
        return p['order'][p['i']] if p['i'] < len(p['order']) else None

    def limit(self, r, p, q):
        if not r['settings']['timer'] and r['mode'] != 'paced':
            return 0
        return q['time'] * p['acc']['extra']

    def question(self, r, p, qid, now):
        q = r['qmap'][qid]
        if qid not in p['keys'] or (r['mode'] == 'peak' and p['shown'].get(qid, 0) == 0):
            rnd = random.Random(f"{r['salt']}:{p['key']}:{qid}:{p['attempts'].get(qid, 0)}:{p['attempt']}:{r['opened']}")
            v, key = view(q, rnd, r['settings']['shuffleOpts'])
            p['keys'][qid] = {'key': key, 'view': v, 'removed': []}
        if not p['shown'].get(qid):
            p['shown'][qid] = r['cur_start'] if r['mode'] == 'paced' else now
            if p['acc']['reduce'] and q['type'] in ('single', 'multi') and not p['keys'][qid]['removed']:
                p['keys'][qid]['removed'] = eliminate(q, p['keys'][qid]['key'], 1, self.rnd)
        k = p['keys'][qid]
        v = dict(k['view'])
        v['removed'] = k['removed']
        v['limit'] = self.limit(r, p, q)
        v['remain'] = max(0.0, round(v['limit'] - (now - p['shown'][qid]), 1)) if v['limit'] else None
        v['attempt'] = p['attempts'].get(qid, 0) + 1
        v['canPass'] = r['mode'] == 'peak' and p['attempts'].get(qid, 0) >= 2
        v['immune'] = 'immunity' in p['effects']
        if r['mode'] == 'paced':
            v['n'] = r['cur'] + 1
        else:
            v['n'] = min(p['i'] + 1, len(p['order'])) if r['mode'] != 'peak' else len(p['mastered']) + len(p['passed']) + 1
        v['total'] = len(p['order']) if r['mode'] != 'paced' else len(r['quiz']['questions'])
        v['redemption'] = bool(p['redemption'] and not p['redeemed'] and qid == p['redemption'])
        return v

    def points(self, r, p, q, frac, elapsed, limit, now):
        if frac is None:
            return 0
        if r['mode'] == 'test':
            return round(q['weight'] * frac * 100)
        base = 500 * frac
        speed = 0.0
        if frac > 0:
            if limit and 'freeze' not in p['effects'] and 'supersonic' not in p['effects']:
                speed = 500 * max(0.0, 1 - elapsed / limit) * frac
            else:
                speed = 500 * frac if (limit or 'supersonic' in p['effects'] or r['mode'] == 'peak') else 250 * frac
        pts = base + speed
        if frac >= 1 and r['settings']['streaks']:
            pts += min(500, 100 * p['streak'])
        if 'double' in p['effects'] or 'jeopardy' in p['effects']:
            pts *= 2
        if now < r['powerplay_until']:
            pts *= 1.5
        return round(pts)

    def answer(self, r, p, qid, ans, now):
        need(r['phase'] == 'live', 'Игра ещё не началась.' if r['phase'] == 'lobby' else 'Игра окончена.')
        need(not r['paused'], 'Учитель поставил игру на паузу.')
        cur = self.current(r, p)
        need(cur == qid, 'Этот вопрос уже не актуален.')
        q = r['qmap'][qid]
        need(fits(q['type'], ans), 'Ответ не распознан — обнови страницу.')
        if q['type'] == 'draw':
            need(ans is None or len(ans) <= 300000 and (ans == '' or DATA_URL.fullmatch(ans)), 'Рисунок слишком большой.')
        elif isinstance(ans, str):
            ans = ans[:600]
        need(p['shown'].get(qid), 'Этот вопрос ещё не показан.')
        k = p['keys'][qid]
        limit = self.limit(r, p, q)
        elapsed = now - p['shown'].get(qid, now)
        late = bool(limit) and elapsed > limit + 2
        frac = 0.0 if late and q['type'] not in UNGRADED else grade(q, k['key'], ans)
        if q['type'] == 'cloud' and isinstance(ans, str):
            ans = ' '.join(ans.split()[:3])[:40]
        txt = answer_text(q, k['key'], ans)     # до изменения состояния ученика
        immune = 'immunity' in p['effects'] and frac is not None and frac < 1 and not late
        if immune:
            p['effects'].pop('immunity')
            p['attempts'][qid] = p['attempts'].get(qid, 0)
            return {'ok': False, 'retry': True, 'frac': frac, 'msg': 'Щит! Ещё одна попытка.'}
        pts = self.points(r, p, q, frac, elapsed, limit, now)
        if 'jeopardy' in p['effects'] and frac is not None and frac < 1:
            pts = -min(p['score'], 500)
        saver = 'streak_saver' in p['effects']
        for e in ('double', 'jeopardy', 'freeze', 'fifty', 'eraser'):
            p['effects'].pop(e, None)
        if 'supersonic' in p['effects']:
            p['effects']['supersonic'] -= 1
            if p['effects']['supersonic'] <= 0:
                p['effects'].pop('supersonic')
        ok = frac is None or frac >= 1
        if frac is not None:
            if ok:
                p['streak'] += 1
                p['best_streak'] = max(p['best_streak'], p['streak'])
            elif saver:
                p['effects'].pop('streak_saver', None)
            else:
                p['streak'] = 0
        p['score'] = max(0, p['score'] + pts)
        p['attempts'][qid] = p['attempts'].get(qid, 0) + 1
        rec = p['answers'].setdefault(qid, {'tries': []})
        rec['tries'].append({'frac': frac, 'time': round(elapsed, 1), 'text': txt, 'late': late})
        rec.update(frac=frac, pts=rec.get('pts', 0) + pts, time=round(elapsed, 1), text=txt)
        if q['type'] == 'draw':
            rec['draw'] = ans
        if q['type'] in ('open', 'cloud', 'poll'):
            rec['raw'] = ans if q['type'] != 'poll' else q['options'][k['key']['o'][ans]] if isinstance(ans, int) and 0 <= ans < len(k['key']['o']) else None
        out = {'ok': ok, 'frac': frac, 'pts': pts, 'score': p['score'], 'streak': p['streak'], 'late': late, 'graded': frac is not None}
        if r['settings']['showAnswers'] and r['mode'] != 'paced' and frac is not None:
            out['solution'] = solution(q, k['key'])
        if r['settings']['explain'] and q.get('explain') and r['mode'] != 'paced':
            out['explain'] = q['explain']
        # продвижение
        if r['mode'] == 'paced':
            pass
        elif p['redemption'] and qid == p['redemption'] and not p['redeemed']:
            p['redeemed'] = True
            if ok:
                rec['redeemed'] = True
            p['done'] = True
            p['finished_at'] = now
        elif r['mode'] == 'peak':
            p['queue'].pop(0)
            if ok:
                p['mastered'].append(qid)
            else:
                p['queue'].insert(min(len(p['queue']), 2 + self.rnd.randrange(2)), qid)     # ошибка вернётся через пару вопросов
                p['shown'][qid] = 0
            p['since_break'] += 1
            self.peak_progress(r, p, now)
            if p['since_break'] >= 5 and p['queue'] and not p['done']:
                p['since_break'] = 0
                offers = list(PEAK_POWERS)
                self.rnd.shuffle(offers)
                p['brk'] = {'offers': offers[:3], 'game': MINIS[self.rnd.randrange(len(MINIS))]}
                out['break'] = True
        else:
            p['i'] += 1
            if p['i'] >= len(p['order']):
                self.finish_player(r, p, now)
        # усилитель за серию из трёх верных
        if r['settings']['powerups'] and r['mode'] in ('classic', 'team') and ok and frac is not None and p['streak'] and p['streak'] % 3 == 0 and len(p['inventory']) < 3:
            got = self.rnd.choice(POWERS)
            p['inventory'].append(got)
            out['power'] = got
        p['last'] = out
        return out

    def peak_progress(self, r, p, now):
        n = len(p['order'])
        mastery = len(p['mastered']) / n if n else 1
        if not p['summit_at'] and mastery * 100 >= r['settings']['goal']:
            p['summit_at'] = now
            self.event(r, 'summit', f'{short(p["name"])} достиг вершины!', p['key'], now)
            if not p.get('climbed'):              # повторная попытка в той же игре вершину заново не засчитывает
                p['climbed'] = True
                self.add_summit(r['cls'], p['name'])
        if not p['queue']:
            self.finish_player(r, p, now)

    def finish_player(self, r, p, now):
        wrong = [qid for qid in p['order'] if p['answers'].get(qid, {}).get('frac') is not None and p['answers'][qid]['frac'] < 1]
        if r['settings']['redemption'] and r['mode'] in ('classic', 'team') and wrong and not p['redemption']:
            p['redemption'] = self.rnd.choice(wrong)
            p['shown'][p['redemption']] = 0
            p['keys'].pop(p['redemption'], None)
            return
        p['done'] = True
        p['finished_at'] = now

    def skip(self, r, p, qid, now):
        """Пропуск в «Восхождении» — после двух неудачных попыток."""
        need(r['mode'] == 'peak' and self.current(r, p) == qid and p['attempts'].get(qid, 0) >= 2, 'Пропустить можно после двух попыток.')
        p['queue'].pop(0)
        p['passed'].append(qid)
        self.peak_progress(r, p, now)

    def use_power(self, r, p, kind, now):
        need(r['phase'] == 'live' and not r['paused'], 'Сейчас нельзя.')
        need(kind in p['inventory'], 'Такого усилителя нет.')
        qid = self.current(r, p)
        need(qid or kind in ('gift', 'glitch', 'powerplay', 'streak_boost', 'streak_saver', 'supersonic'), 'Усилитель действует на вопрос — дождись вопроса.')
        need(kind not in ('fifty', 'eraser') or p['shown'].get(qid), 'Усилитель действует на вопрос — дождись вопроса.')
        p['inventory'].remove(kind)
        out = {'kind': kind}
        if kind in ('fifty', 'eraser'):
            q = r['qmap'][qid]
            k = p['keys'][qid]
            right = {q['answer']} if q['type'] == 'single' else set(q.get('answers', []))
            if q['type'] in ('single', 'multi'):
                wrong = [s for s, i in enumerate(k['key']['o']) if i not in right and s not in k['removed']]
                self.rnd.shuffle(wrong)
                n = max(1, len(k['key']['o']) // 2 - len(k['removed'])) if kind == 'fifty' else 1
                k['removed'] = sorted(set(k['removed']) | set(wrong[:min(n, len(wrong))]))
            out['removed'] = k['removed']
        elif kind == 'streak_boost':
            p['streak'] += 2
        elif kind == 'supersonic':
            p['effects']['supersonic'] = 3
        elif kind == 'gift':
            for o in r['players'].values():
                if o is not p:
                    o['score'] += 150
            self.event(r, 'gift', f'{short(p["name"])} дарит всем по 150 очков!', p['key'], now)
        elif kind == 'glitch':
            for o in r['players'].values():
                if o is not p:
                    o['glitch_until'] = now + 5
            self.event(r, 'glitch', f'{short(p["name"])} запустил глюк! Экраны дрожат 5 секунд.', p['key'], now)
        elif kind == 'powerplay':
            r['powerplay_until'] = now + 20
            self.event(r, 'powerplay', f'{short(p["name"])} включил «Мощь класса»: всем +50 % очков 20 секунд!', p['key'], now)
        else:
            p['effects'][kind] = 1
        return out

    def take_break(self, r, p, pick, mini_score):
        need(p['brk'], 'Привала нет.')
        need(mini_score is None or isinstance(mini_score, (int, float)) and mini_score == mini_score and abs(mini_score) < 1e9, 'Счёт мини-игры — число.')
        bonus = max(0, min(300, int(mini_score or 0)))
        if pick in p['brk']['offers'] and len(p['inventory']) < 3:
            p['inventory'].append(pick)
        p['mini_bonus'] += bonus
        p['score'] += bonus
        p['brk'] = None
        return {'bonus': bonus}

    # --- учитель ---
    def start(self, r, now):
        need(r['phase'] == 'lobby', 'Игра уже идёт.')
        r['phase'] = 'live'
        r['started'] = now
        if r['mode'] == 'paced':
            self.next(r, now)

    def next(self, r, now):
        need(r['mode'] == 'paced' and r['phase'] == 'live', 'Только для игры под руководством учителя.')
        if r['cur'] >= 0 and not r['reveal']:
            r['reveal'] = True
            return
        if r['cur'] + 1 >= len(r['quiz']['questions']):
            self.end(r, now)
            return
        r['cur'] += 1
        r['cur_start'] = now
        r['reveal'] = False

    def auto(self, r, now):
        # Под руководством учителя ответ открывается сам, когда вышло время или ответили все, кто на связи.
        if r['mode'] != 'paced' or r['phase'] != 'live' or r['cur'] < 0 or r['reveal'] or r['paused']:
            return
        q = r['quiz']['questions'][r['cur']]
        online = [p for p in r['players'].values() if now - p['seen'] < 8]
        extra = max([1.0] + [p['acc']['extra'] for p in online if q['id'] not in p['answers']])     # ждём тех, у кого больше времени
        if now - r['cur_start'] > q['time'] * extra + 1 or (online and all(q['id'] in p['answers'] for p in online)):
            r['reveal'] = True

    def pause(self, r, on, now):
        if on and not r['paused']:
            r['paused'] = True
            r['paused_at'] = now
        elif not on and r['paused']:
            r['paused'] = False
            delta = now - r['paused_at']
            r['cur_start'] += delta
            for p in r['players'].values():
                for qid, t in p['shown'].items():
                    if t:
                        p['shown'][qid] = t + delta

    def end(self, r, now):
        if r['phase'] == 'ended':
            return r['result_id']
        r['ended'] = now
        data = self.report(r)
        with self.db() as c:     # ensure_ascii: одиночный суррогат из ответа ученика не уронит запись итогов
            r['result_id'] = c.execute('INSERT INTO results (title, cls, mode, started, ended, data) VALUES (?, ?, ?, ?, ?, ?)',
                                       (r['quiz']['title'], r['cls'], r['mode'], r['started'] or r['opened'], now, json.dumps(data))).lastrowid
        r['phase'] = 'ended'     # только после записи: при сбое игру можно завершить ещё раз
        return r['result_id']

    def accuracy(self, p):
        fr = [a['tries'][0]['frac'] for a in p['answers'].values() if a['tries'] and a['tries'][0]['frac'] is not None]
        return round(100 * sum(fr) / len(fr)) if fr else 0

    def mastery(self, r, p):
        return round(100 * len(p['mastered']) / len(p['order'])) if p['order'] else 0

    def tier(self, r, p):
        m = self.mastery(r, p)
        return 3 if p['summit_at'] else 2 if m >= r['settings']['goal'] * 2 / 3 else 1 if m >= r['settings']['goal'] / 3 else 0

    def board(self, r):
        rows = []
        for p in r['players'].values():
            row = {'key': p['key'], 'name': short(p['name']), 'score': p['score'], 'acc': self.accuracy(p), 'done': p['done'], 'team': p['team'], 'avatar': p['avatar'], 'streak': p['streak']}
            if r['mode'] == 'peak':
                row.update(mastery=self.mastery(r, p), tier=self.tier(r, p), summit=bool(p['summit_at']))
            rows.append(row)
        rows.sort(key=lambda x: (-(x.get('mastery', 0) if r['mode'] == 'peak' else 0), -x['score'], x['name']))
        return rows

    def teams(self, r):
        out = []
        for t in range(r['settings']['teams']):
            ms = [p['score'] for p in r['players'].values() if p['team'] == t]
            out.append({'name': TEAMS[t][0], 'color': TEAMS[t][1], 'score': round(sum(ms) / len(ms)) if ms else 0, 'size': len(ms)})
        return sorted(out, key=lambda x: -x['score'])

    def titles(self, r):
        """Звания в конце «Восхождения»: лучший результат, самый быстрый альпинист, воин, трудяга."""
        ps = list(r['players'].values())
        if not ps:
            return []
        out = [('🏆 Лучший результат', max(ps, key=lambda p: p['score']))]
        sm = [p for p in ps if p['summit_at']]
        if sm:
            out.append(('⚡ Самый быстрый альпинист', min(sm, key=lambda p: p['summit_at'])))
        out.append(('🛡 Воин — исправил больше всех ошибок', max(ps, key=lambda p: sum(1 for q in p['mastered'] if p['attempts'].get(q, 0) > 1))))
        out.append(('💪 Трудяга — больше всех ответов', max(ps, key=lambda p: sum(len(a['tries']) for a in p['answers'].values()))))
        return [{'title': t, 'name': short(p['name'])} for t, p in out]

    def report(self, r):
        qs = r['quiz']['questions']
        players = []
        for p in r['players'].values():
            players.append({'name': p['name'], 'score': p['score'], 'acc': self.accuracy(p), 'team': TEAMS[p['team']][0] if p['team'] >= 0 else '',
                            'mastery': self.mastery(r, p) if r['mode'] == 'peak' else None, 'summit': bool(p['summit_at']), 'best_streak': p['best_streak'],
                            'reattempts': sum(1 for q in p['attempts'].values() if q > 1), 'answers': p['answers'], 'done': p['done'], 'acc_settings': p['acc']})
        return {'quiz': {'title': r['quiz']['title'], 'questions': [{k: v for k, v in q.items() if k != 'image'} | ({'hasImage': True} if q.get('image') else {}) for q in qs]},
                'mode': r['mode'], 'settings': r['settings'], 'players': players, 'teams': self.teams(r) if r['mode'] == 'team' else [], 'titles': self.titles(r) if r['mode'] == 'peak' else []}

    def grid(self, r):
        """Живая таблица учителя: по каждому ученику — результат по каждому вопросу."""
        qs = r['quiz']['questions']
        rows = []
        for p in sorted(r['players'].values(), key=lambda p: p['name']):
            cells = []
            for q in qs:
                a = p['answers'].get(q['id'])
                cells.append(None if not a or not a['tries'] else ('u' if a.get('frac') is None else round(a['frac'], 2)))
            rows.append({'key': p['key'], 'name': p['name'], 'short': short(p['name']), 'score': p['score'], 'acc': self.accuracy(p), 'cells': cells, 'done': p['done'],
                         'online': time.time() - p['seen'] < 8, 'team': p['team'], 'accs': p['acc'], 'mastery': self.mastery(r, p) if r['mode'] == 'peak' else None,
                         'reattempts': sum(1 for x in p['attempts'].values() if x > 1), 'avatar': p['avatar'], 'tier': self.tier(r, p) if r['mode'] == 'peak' else None,
                         'progress': len(p['answers']), 'brk': bool(p['brk'])})
        qstats = []
        for q in qs:
            fr = [a['tries'][0]['frac'] for p in r['players'].values() for a in [p['answers'].get(q['id'])] if a and a['tries'] and a['tries'][0]['frac'] is not None]
            qstats.append({'type': q['type'], 'text': (q['text'] or 'Вопрос с пропусками')[:90], 'acc': round(100 * sum(fr) / len(fr)) if fr else None, 'n': len(fr)})
        return rows, qstats


def install_battle(app, data_dir=None):
    data_dir = Path(data_dir or os.environ.get('SCHOOL4_DATA_DIR', '/srv/school4/data'))
    game = Battle(data_dir / 'battle.db')
    app.battle_game = game

    def fail(error):
        return jsonify(status='error', message=str(error)), getattr(error, 'code', 400)

    def body():
        data = request.get_json(force=True, silent=True)
        if not isinstance(data, dict):
            raise Refused('Ожидается объект.')
        return data

    def route(name, fn, teacher=False):
        def handler():
            try:
                if teacher and not is_teacher():
                    raise Refused('Только с учительского ноутбука.', 403)
                data, now = body(), time.time()
                with game.lock:
                    out = fn(data, now)
                out.setdefault('status', 'ok')
                return jsonify(out)
            except Refused as error:
                return fail(error)
        handler.__name__ = 'battle_' + name.replace('/', '_')
        app.add_url_rule('/results/api/battle/' + name, view_func=handler, methods=['POST'])

    # --- ученик ---
    def status(d, now):
        r = game.rooms.get(str(d.get('className') or ''))
        live = bool(r) and r['phase'] in ('lobby', 'live')
        return {'open': live, 'phase': r['phase'] if r else None, 'players': len(r['players']) if r else 0, 'title': r['quiz']['title'] if live else '', 'mode': r['mode'] if live else '', 'room': r['opened'] if live else 0}
    route('status', status)

    def join(d, now):
        r, p = game.join(d.get('className'), d.get('name'), now, d.get('token'))
        return {'key': p['key'], 'token': p['token']}
    route('join', join)

    def sync(d, now):
        r, p = game.who(d.get('className'), d.get('key'), d.get('token'))
        p['seen'] = now
        game.auto(r, now)
        st = r['settings']
        out = {'phase': r['phase'], 'mode': r['mode'], 'title': r['quiz']['title'], 'settings': {k: st[k] for k in ('leaderboard', 'memes', 'music', 'powerups', 'theme', 'goal', 'readAloud', 'timer')},
               'paused': r['paused'], 'players': len(r['players']), 'score': p['score'], 'streak': p['streak'], 'inventory': p['inventory'], 'effects': sorted(p['effects']),
               'done': p['done'], 'avatar': p['avatar'], 'summits': p['summits'], 'acc': p['acc'], 'team': TEAMS[p['team']][0] if p['team'] >= 0 else '',
               'teamColor': TEAMS[p['team']][1] if p['team'] >= 0 else '', 'glitch': max(0.0, round(p['glitch_until'] - now, 1)), 'powerplay': max(0.0, round(r['powerplay_until'] - now, 1)),
               'attempt': p['attempt'] + 1, 'attempts': st['attempts'], 'locked': {str(k): v for k, v in AVATAR_SUMMITS.items()}}
        out['readAloud'] = st['readAloud'] or p['acc']['read']
        new = [e for e in r['events'] if e['id'] > p['seen_events'] and e['who'] != p['key']]
        p['seen_events'] = r['ev_id']
        out['events'] = [{'kind': e['kind'], 'text': e['text']} for e in new]
        if r['phase'] == 'lobby':
            out['names'] = [short(x['name']) for x in r['players'].values()]
        qid = game.current(r, p)
        if qid and not r['paused'] and d.get('ready'):     # часы вопроса идут с показа: пока ученик смотрит разбор прошлого ответа, клиент не готов
            out['q'] = game.question(r, p, qid, now)
        if p['brk']:
            out['brk'] = p['brk']
        if r['mode'] == 'paced' and r['phase'] == 'live' and r['cur'] >= 0:
            q = r['quiz']['questions'][r['cur']]
            out['paced'] = {'n': r['cur'] + 1, 'total': len(r['quiz']['questions']), 'reveal': r['reveal'], 'answered': q['id'] in p['answers']}
            if r['reveal'] and q['id'] in p['answers']:
                k = p['keys'].get(q['id'])
                a = p['answers'][q['id']]
                out['paced'].update(frac=a['frac'], pts=a['pts'], explain=q['explain'] if st['explain'] else '', solution=solution(q, k['key']) if k and a['frac'] is not None else None, view=k['view'] if k else None)
            elif r['reveal']:
                out['paced'].update(frac=0, pts=0, explain=q['explain'] if st['explain'] else '')
        if r['mode'] == 'peak':
            out['peak'] = {'mastery': game.mastery(r, p), 'tier': game.tier(r, p), 'summit': bool(p['summit_at']), 'left': len(p['queue']), 'total': len(p['order']),
                           'mastered': len(p['mastered']), 'passed': len(p['passed']), 'bonus': p['mini_bonus']}
        if st['leaderboard'] or r['phase'] == 'ended':
            rows = game.board(r)
            out['place'] = next((i + 1 for i, x in enumerate(rows) if x['key'] == p['key']), 0)
            out['top'] = [{k: v for k, v in x.items() if k != 'key'} | {'me': x['key'] == p['key']} for x in rows[:10]]
            if r['mode'] == 'peak':
                mine = game.tier(r, p)
                tier_rows = [x for x in rows if x['tier'] == mine]
                out['tierPlace'] = next((i + 1 for i, x in enumerate(tier_rows) if x['key'] == p['key']), 0)
                out['tierSize'] = len(tier_rows)
        if r['mode'] == 'team':
            out['teams'] = game.teams(r)
        if p['done']:
            out['summary'] = {'acc': game.accuracy(p), 'score': p['score'], 'best_streak': p['best_streak'], 'answered': len(p['answers']),
                              'canRetry': p['attempt'] + 1 < st['attempts'] and r['phase'] == 'live' and r['mode'] != 'paced'}
        if r['phase'] == 'ended' and r['mode'] == 'peak':
            out['titles'] = game.titles(r)
        return out
    route('sync', sync)

    def answer(d, now):
        r, p = game.who(d.get('className'), d.get('key'), d.get('token'))
        p['seen'] = now
        return game.answer(r, p, str(d.get('q') or ''), d.get('answer'), now)
    route('answer', answer)

    def skip(d, now):
        r, p = game.who(d.get('className'), d.get('key'), d.get('token'))
        game.skip(r, p, str(d.get('q') or ''), now)
        return {}
    route('skip', skip)

    def power(d, now):
        r, p = game.who(d.get('className'), d.get('key'), d.get('token'))
        return game.use_power(r, p, str(d.get('kind') or ''), now)
    route('power', power)

    def brk(d, now):
        r, p = game.who(d.get('className'), d.get('key'), d.get('token'))
        return game.take_break(r, p, d.get('pick'), d.get('mini'))
    route('break', brk)

    def retry(d, now):
        r, p = game.who(d.get('className'), d.get('key'), d.get('token'))
        need(p['done'] and p['attempt'] + 1 < r['settings']['attempts'] and r['phase'] == 'live' and r['mode'] != 'paced', 'Попытки закончились.')
        p['attempt'] += 1
        game.reset_player(r, p, now)
        return {}
    route('retry', retry)

    def finish(d, now):
        r, p = game.who(d.get('className'), d.get('key'), d.get('token'))
        need(r['mode'] == 'peak' and p['summit_at'], 'Закончить восхождение можно после вершины.')
        game.finish_player(r, p, now)
        return {}
    route('finish', finish)

    def avatar(d, now):
        r, p = game.who(d.get('className'), d.get('key'), d.get('token'))
        game.set_avatar(r['cls'], p['name'], d.get('avatar'))
        p['avatar'] = d.get('avatar')
        return {}
    route('avatar', avatar)

    # --- учитель ---
    route('library', lambda d, now: {'quizzes': game.quizzes()}, teacher=True)
    route('quiz', lambda d, now: {'quiz': game.quiz(int(d.get('id') or 0))}, teacher=True)
    route('save', lambda d, now: {'id': game.save_quiz(d.get('quiz'), int(d['id']) if d.get('id') else None)}, teacher=True)

    def delete(d, now):
        game.delete_quiz(int(d.get('id') or 0))
        return {}
    route('delete', delete, teacher=True)

    def results(d, now):
        with game.db() as c:
            rows = c.execute('SELECT id, title, cls, mode, started, ended, data FROM results ORDER BY ended DESC LIMIT 200').fetchall()
        out = []
        for i, t, cls, m, s, e, data in rows:
            ps = json.loads(data)['players']
            out.append({'id': i, 'title': t, 'cls': cls, 'mode': m, 'started': s, 'ended': e, 'players': len(ps), 'acc': round(sum(p['acc'] for p in ps) / len(ps)) if ps else 0})
        return {'results': out}
    route('results', results, teacher=True)

    def result(d, now):
        with game.db() as c:
            row = c.execute('SELECT id, title, cls, mode, started, ended, data FROM results WHERE id = ?', (int(d.get('id') or 0),)).fetchone()
        if not row:
            raise Refused('Отчёт не найден.', 404)
        return {'result': {'id': row[0], 'title': row[1], 'cls': row[2], 'mode': row[3], 'started': row[4], 'ended': row[5], **json.loads(row[6])}}
    route('result', result, teacher=True)

    def mark(d, now):
        """Учитель засчитывает или снимает открытый ответ в отчёте."""
        rid, name, qid, ok = int(d.get('id') or 0), str(d.get('name') or ''), str(d.get('q') or ''), d.get('ok')
        need(isinstance(ok, bool), 'Ожидается да или нет.')
        with game.db() as c:
            row = c.execute('SELECT data FROM results WHERE id = ?', (rid,)).fetchone()
            need(row, 'Отчёт не найден.')
            data = json.loads(row[0])
            p = next((x for x in data['players'] if x['name'] == name), None)
            need(p and qid in p['answers'], 'Ответ не найден.')
            p['answers'][qid]['teacher'] = ok
            c.execute('UPDATE results SET data = ? WHERE id = ?', (json.dumps(data), rid))
        return {}
    route('mark', mark, teacher=True)

    def drop_result(d, now):
        with game.db() as c:
            c.execute('DELETE FROM results WHERE id = ?', (int(d.get('id') or 0),))
        return {}
    route('dropresult', drop_result, teacher=True)

    def teacher(d, now):
        cls, action = str(d.get('className') or ''), d.get('action')
        if action == 'open':
            r = game.open(cls, int(d.get('quiz') or 0), d.get('mode'), d.get('settings'), now)
        else:
            r = game.room(cls) if action != 'screen' or cls in game.rooms else None
            if r is None:
                return {'phase': None}
            if action == 'start':
                game.start(r, now)
            elif action == 'next':
                game.next(r, now)
            elif action == 'pause':
                game.pause(r, bool(d.get('on')), now)
            elif action == 'end':
                game.end(r, now)
            elif action == 'close':
                if r['phase'] == 'live':
                    game.end(r, now)
                game.rooms.pop(cls, None)
                return {'phase': None, 'closed': True}
            elif action == 'kick':
                key = norm(d.get('key') or '')
                r['players'].pop(key, None)
                r['kicked'].add(anyorder(key))
            elif action == 'acc':
                p = r['players'].get(norm(d.get('key') or ''))
                need(p, 'Нет такого ученика.')
                a = d.get('acc') or {}
                p['acc'] = {'extra': 2.0 if a.get('extra') else 1.0, 'reduce': bool(a.get('reduce')), 'read': bool(a.get('read'))}
            elif action not in ('screen', None):
                raise Refused('Неизвестное действие.')
        game.auto(r, now)
        rows, qstats = game.grid(r)
        out = {'phase': r['phase'], 'mode': r['mode'], 'title': r['quiz']['title'], 'settings': r['settings'], 'paused': r['paused'], 'players': rows, 'qstats': qstats,
               'board': game.board(r)[:12], 'result': r['result_id'], 'count': len(r['quiz']['questions']), 'powerplay': max(0.0, round(r['powerplay_until'] - now, 1)),
               'events': [e['text'] for e in r['events'][-5:]]}
        if r['mode'] == 'team':
            out['teams'] = game.teams(r)
        if r['mode'] == 'peak':
            out['titles'] = game.titles(r) if r['phase'] == 'ended' else []
        if r['mode'] == 'paced' and r['cur'] >= 0:
            q = r['quiz']['questions'][r['cur']]
            v, key = view(q, random.Random(0), False)
            out['paced'] = {'n': r['cur'] + 1, 'total': len(r['quiz']['questions']), 'reveal': r['reveal'], 'q': v, 'answered': sum(1 for p in r['players'].values() if q['id'] in p['answers']),
                            'left': max(0.0, round(q['time'] - (now - r['cur_start']), 1)) if not r['paused'] else None}
            if r['reveal']:
                out['paced']['solution'] = solution(q, key)
                out['paced']['explain'] = q['explain']
                if q['type'] in ('single', 'multi', 'poll'):
                    counts = [0] * len(q['options'])
                    for p in r['players'].values():
                        a = p['answers'].get(q['id'])
                        if a:
                            for t in a['text'].split('; '):
                                if t in q['options']:
                                    counts[q['options'].index(t)] += 1
                    out['paced']['counts'] = counts
                if q['type'] in ('cloud', 'open'):
                    out['paced']['words'] = [p['answers'][q['id']].get('raw', '') for p in r['players'].values() if q['id'] in p['answers']][:60]
        if r['quiz']['questions'] and r['mode'] != 'paced':
            clouds = {}
            for q in r['quiz']['questions']:
                if q['type'] in ('cloud', 'poll'):
                    clouds[q['id']] = [p['answers'][q['id']].get('raw') for p in r['players'].values() if q['id'] in p['answers']]
            out['clouds'] = clouds
        return out
    route('teacher', teacher, teacher=True)
