"""Изолированный стенд: настоящий код журнала и тренажёра на временной копии данных. Живой журнал не трогается."""
import os, sys, sqlite3, tempfile
from pathlib import Path
tmp = Path(tempfile.mkdtemp(prefix='school4-trainer-test-'))
os.environ.update(SCHOOL4_DATA_DIR=str(tmp / 'data'), SCHOOL4_SITE_ROOT=str(tmp / 'site'), SCHOOL4_PREVIEW='1', SCHOOL4_PRACTICUM_PAGES=str(Path(__file__).resolve().parents[3] / 'build'))
ROOT = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(ROOT / 'tools/kodopoly/server'), str(ROOT / 'tools/battle/server'), str(ROOT / 'tools/practicum/server'), str(ROOT / 'tools/typing_escape/server'), str(ROOT / 'tools/lab/server'), str(ROOT / 'tools/crew/server'), str(ROOT / 'tools/trainer/server'), '/srv/school4/test-results-app']
import app as journal, portal_security
from flask import jsonify, send_from_directory
a = journal.app
if not hasattr(a, 'crew_game'):   # сетевая игра: на стенде берём модуль из проекта, даже если на сервере он ещё не подключён
    from crew_api import install_crew; install_crew(a)
if not hasattr(a, 'race_game'):   # гонка класса: то же самое
    from race_api import install_race; install_race(a)
if not any(str(r).startswith('/results/api/typing/') for r in a.url_map.iter_rules()):   # рекорды тренажёра: в отдельном файле рядом с копией журнала
    from typing_api import install_typing; install_typing(a, journal.DATA_DIR)
if not any(str(r).startswith('/results/api/practicum/') for r in a.url_map.iter_rules()):   # статистика и награды практикума: игры класса берём из build/
    from practicum_api import install_practicum; install_practicum(a, journal.DATA_DIR, ROOT / 'build')
if not hasattr(a, 'battle_game'):   # битва класса: модуль из проекта
    from battle_api import install_battle; install_battle(a)
@a.route('/test/battle/sol/<cls>/<key>')
def test_battle_sol(cls, key):   # верный ответ на текущий вопрос ученика — для браузерной проверки
    import battle_api, time as _t
    g = a.battle_game; r = g.rooms.get(cls); p = r and r['players'].get(key)
    qid = g.current(r, p) if p else None
    if not qid: return jsonify(q=None)
    g.question(r, p, qid, _t.time()); q = r['qmap'][qid]; sol = battle_api.solution(q, p['keys'][qid]['key'])
    if q['type'] == 'hotspot': sol = {'x': sol[0]['x'], 'y': sol[0]['y']}
    if q['type'] in ('fill', 'math'): sol = str(sol).split(' ')[0]
    return jsonify(q=qid, type=q['type'], sol=sol)
if not hasattr(a, 'kp_tables'):   # «Кодополия» по сети
    from kp_api import install_kodopoly; install_kodopoly(a)
REAL = portal_security.TEACHER_IPS; portal_security.TEACHER_IPS = frozenset()
@a.route('/test/crew/place')
def test_crew_place():   # перенос игрока для теста: сервер «Сбоя на станции» телепорты из браузера не принимает
    from flask import request; import time as _t
    g = a.crew_game
    with g.lock:
        r = g.rooms.get(request.args.get('className')); p = r and r['players'].get(int(request.args.get('id', 0)))
        if p: p.update(x=float(request.args['x']), y=float(request.args['y']), pos_t=_t.time(), moved=True)
    return jsonify(ok=bool(p))
@a.route('/test/crew/imp/<name>')
def test_crew_imp(name): a.crew_game.force_imp = None if name == '-' else name; return jsonify(imp=name)
@a.route('/test/teacher/<int:v>')
def test_teacher(v): portal_security.TEACHER_IPS = REAL if v else frozenset(); return jsonify(teacher=bool(v))
@a.route('/test/journal')
def test_journal():
    with sqlite3.connect(journal.DB_PATH) as c: return jsonify([dict(zip(['id', 'name', 'cls', 'topic', 'score', 'max', 'mark'], r)) for r in c.execute('SELECT id, student_name, class_name, topic, score, max_score, mark FROM test_results ORDER BY id')])
@a.route('/courses/<slug>/', defaults={'path': 'index.html'})
@a.route('/courses/<slug>/<path:path>')
def course(slug, path): return send_from_directory(ROOT / 'build' / slug, path)
@a.route('/portal/<path:path>')
def portal(path): return send_from_directory('/srv/school4/cdn/portal', path)
a.run(host='127.0.0.1', port=18720, threaded=True)
