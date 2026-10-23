"""Тесты по урокам Босовой (6–11 классы) и «Интернет-культура» для «Битвы класса».

Вопросы — в файлах tools/quizzes/g6.py … g11.py и culture.py (свои формулировки, не копии учебника).
Каждый тест: титульный слайд с обложкой главы, вопросы разных типов и мем-паузы (картинки Gemini, подписи — текстом).
Сборка и проверка: python3 tools/quizzes/build.py           → tools/quizzes/out/*.json (проверены как на сервере)
Загрузка в библиотеку (учительский ноутбук): python3 tools/quizzes/build.py --upload [--base http://portal.school.local]
Повторная загрузка обновляет тест с тем же названием, а не создаёт копию.
"""
import base64
import importlib.util
import io
import json
import random
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'tools' / 'battle' / 'server'))
sys.path.append('/srv/school4/test-results-app')   # portal_security — только для импорта модуля проверки
import battle_api  # noqa: E402

from PIL import Image  # noqa: E402

IMG = HERE / 'img'
OUT = HERE / 'out'


# ---------- краткая запись вопросов ----------
def s(text, right, wrong, e=''):
    return {'t': 's', 'text': text, 'right': right, 'wrong': list(wrong), 'e': e}
def m(text, rights, wrong, e=''):
    return {'t': 'm', 'text': text, 'rights': list(rights), 'wrong': list(wrong), 'e': e}
def n(text, value, e='', unit='', tol=0):
    return {'t': 'n', 'text': text, 'value': value, 'e': e, 'unit': unit, 'tol': tol}
def f(text, accepted, e=''):
    return {'t': 'f', 'text': text, 'accepted': list(accepted), 'e': e}
def o(text, items, e=''):
    return {'t': 'o', 'text': text, 'items': list(items), 'e': e}
def c(text, cats, e=''):
    return {'t': 'c', 'text': text, 'cats': cats, 'e': e}
def p(text, pairs, e=''):
    return {'t': 'p', 'text': text, 'pairs': [list(x) for x in pairs], 'e': e}
def d(text, e=''):
    return {'t': 'd', 'text': text, 'e': e}


def to_battle(q, rnd):
    t = q['t']
    out = {'text': q['text'], 'explain': q.get('e', ''), 'time': 30}
    if t == 's':
        opts = [q['right']] + q['wrong']
        order = list(range(len(opts))); rnd.shuffle(order)
        out.update(type='single', options=[opts[i] for i in order], answer=order.index(0), time=25)
    elif t == 'm':
        opts = q['rights'] + q['wrong']
        order = list(range(len(opts))); rnd.shuffle(order)
        out.update(type='multi', options=[opts[i] for i in order], answers=sorted(order.index(i) for i in range(len(q['rights']))), time=40)
    elif t == 'n':
        out.update(type='math', value=str(q['value']), tol=q.get('tol', 0), unit=q.get('unit', ''), time=45)
    elif t == 'f':
        out.update(type='fill', accepted=q['accepted'], time=40)
    elif t == 'o':
        out.update(type='reorder', items=q['items'], time=45)
    elif t == 'c':
        out.update(type='categorize', cats=[{'name': k, 'items': v} for k, v in q['cats'].items()], time=50)
    elif t == 'p':
        out.update(type='match', pairs=q['pairs'], time=45)
    elif t == 'd':
        out.update(type='dropdown', time=40)
    return out


# ---------- картинки ----------
_cache = {}
def data_url(name, width, quality=72):
    key = (name, width)
    if key in _cache:
        return _cache[key]
    path = IMG / f'{name}.png'
    if not path.exists():
        _cache[key] = ''
        return ''
    im = Image.open(path).convert('RGB')
    im.thumbnail((width, width * 2), Image.Resampling.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=quality, method=6)
    _cache[key] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
    return _cache[key]


def load(mod):
    spec = importlib.util.spec_from_file_location(mod, HERE / f'{mod}.py')
    mm = importlib.util.module_from_spec(spec)
    mm.__dict__.update({'s': s, 'm': m, 'n': n, 'f': f, 'o': o, 'c': c, 'p': p, 'd': d})
    spec.loader.exec_module(mm)
    return mm


def build():
    memes = load('memes').MEMES
    fun = load('fun').FUN if (HERE / 'fun.py').exists() else {}
    quizzes = []
    for g in range(6, 12):
        mod = HERE / f'g{g}.py'
        if not mod.exists():
            continue
        for k, L in enumerate(load(f'g{g}').LESSONS):
            quizzes.append((g, L))
    if (HERE / 'culture.py').exists():
        for L in load('culture').LESSONS:
            quizzes.append((0, L))
    out = []
    for g, L in quizzes:
        rnd = random.Random(f'{g}-{L["p"]}-{L["title"]}')
        title = (f'{g} кл · §{L["p"]} · {L["title"]}' if g else f'Интернет-культура · {L["title"]}')[:100]
        qs = [{'type': 'slide', 'text': (f'{g} класс · §{L["p"]}\n{L["title"]}' if g else L['title']) + '\nОтвечай быстро и точно — за серию верных ответов бонус!', 'image': data_url(L['cover'], 640), 'time': 10}]
        base = list(L['qs'])
        extra = fun.get((g, L['p']), [])
        # «прикольные» вопросы разбавляют обычные: после 2-го и 5-го
        for k, pos in enumerate((2, 6)):
            if k < len(extra):
                base.insert(min(pos, len(base)), extra[k])
        body = [to_battle(q, rnd) for q in base]
        pool = memes[:]; rnd.shuffle(pool)
        for i, q in enumerate(body):
            qs.append(q)
            if i in (3, 7) and pool:
                mm = pool.pop()
                qs.append({'type': 'slide', 'text': '😄 Мем-пауза\n' + mm['caption'], 'image': data_url(mm['img'], 420), 'time': 8})
        for q in qs:
            if not q.get('image'):
                q.pop('image', None)
        quiz = {'title': title, 'grade': g, 'questions': qs}
        try:
            battle_api.clean_quiz(quiz)      # та же проверка, что на сервере
        except Exception as e:
            raise SystemExit(f'«{title}»: {e}')
        out.append(quiz)
    return out


def upload(quizzes, base):
    def call(path, body):
        req = urllib.request.Request(base + '/results/api/battle/' + path, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(req, timeout=60) as r:
            return json.loads(r.read())
    have = {q['title']: q['id'] for q in call('library', {}).get('quizzes', [])}
    made = upd = 0
    for qz in quizzes:
        body = {'quiz': qz}
        if qz['title'] in have:
            body['id'] = have[qz['title']]; upd += 1
        else:
            made += 1
        r = call('save', body)
        if r.get('status') != 'ok':
            raise SystemExit(f'не сохранилось: {qz["title"]}: {r}')
    print(f'загружено: новых {made}, обновлено {upd}')


def covers():
    # Обложки глав для библиотеки в практикуме: tools/practicum/art/qcover_*.webp
    dst = ROOT / 'tools' / 'practicum' / 'art'
    n = 0
    for pth in sorted(IMG.glob('c*.png')):
        im = Image.open(pth).convert('RGB'); im.thumbnail((480, 270), Image.Resampling.LANCZOS)
        im.save(dst / f'qcover_{pth.stem}.webp', 'WEBP', quality=80, method=6); n += 1
    return n


if __name__ == '__main__':
    print('обложек глав:', covers())
    qz = build()
    OUT.mkdir(exist_ok=True)
    for q in qz:
        (OUT / (q['title'].replace('/', '-').replace(' ', '_')[:90] + '.json')).write_text(json.dumps(q, ensure_ascii=False), encoding='utf-8')
    n_q = sum(sum(1 for x in q['questions'] if x['type'] != 'slide') for q in qz)
    print(f'тестов: {len(qz)}, вопросов: {n_q}')
    if '--upload' in sys.argv:
        base = sys.argv[sys.argv.index('--base') + 1] if '--base' in sys.argv else 'http://portal.school.local'
        upload(qz, base)
