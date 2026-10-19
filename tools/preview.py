"""Read-only assignment preview. No live grades can be submitted."""
import re
from pathlib import Path
from flask import Flask,send_from_directory,jsonify,abort
ROOT=Path(__file__).resolve().parents[1];app=Flask(__name__)
@app.route('/results/api/context')
def context():return jsonify(role='teacher',teacher=True)
@app.route('/results/<path:path>',methods=['GET','POST'])
def no_submit(path):return jsonify(status='error',message='Это preview: реальные оценки не отправляются.'),409
@app.route('/courses/<slug>/',defaults={'path':'index.html'})
@app.route('/courses/<slug>/<path:path>')
def course(slug,path):
    # slug как в publish.py: «..» не выводит из build/ к черновикам с ответами
    if not re.fullmatch(r'[a-z][a-z0-9-]{2,63}',slug):abort(404)
    return send_from_directory(ROOT/'build'/slug,path)
@app.route('/portal/<path:path>')
def portal(path):return send_from_directory('/srv/school4/cdn/portal',path)
if __name__=='__main__':app.run(host='127.0.0.1',port=18719,threaded=True)
