"""Leaderboard checks use a fresh isolated SQLite database, never the live journal."""
import json,sqlite3,sys,tempfile
from pathlib import Path
from flask import Flask
sys.path[:0]=[str(Path(__file__).resolve().parents[1]/'server'),'/srv/school4/test-results-app']
from trainer_api import install_trainer,norm
with tempfile.TemporaryDirectory(prefix='school4-records-test-') as directory:
 root=Path(directory);app=Flask(__name__);install_trainer(app,root,root/'journal.db');client=app.test_client()
 names=['Тест Первый','Тест Второй','Тест Третий','Тест Четвёртый']
 with sqlite3.connect(root/'trainer.db') as conn:
  for name in names:conn.execute('INSERT INTO roster VALUES (?,?,?)',('8 «А»',norm(name),name))
  for cls,name,levels in [('8 «А»',names[0],{'boss-1':{'stars':3},'boss-2':{'stars':2},'boss-999':{'stars':3}}),('8 «А»',names[1],{'boss-1':{'stars':2},'boss-2':{'stars':3}}),('8 «А»',names[2],{'boss-1':{'stars':1},'other-1':{'stars':3}}),('8 «Б»','Тест Чужой',{'boss-1':{'stars':3}})]:
   conn.execute('INSERT INTO progress VALUES (?,?,?,?,?,?,?)',('trainer-8-glitch',cls,norm(name),name,json.dumps({k:{**v,'plays':1,'clean':False,'detail':''} for k,v in levels.items()}),'{}','test'))
 def board():return client.get('/results/api/trainer/leaderboard',query_string=dict(slug='trainer-8-glitch',className='8 «А»',name=names[0]))
 with sqlite3.connect(root/'trainer.db') as conn:before=conn.execute('SELECT * FROM progress ORDER BY student_key').fetchall()
 response=board();assert response.status_code==200;d=response.json;rows=d['rows'];assert d['maxStars']==15 and d['bossCount']==5
 assert len(rows)==4 and {r['name'] for r in rows}==set(names)
 assert [r['stars'] for r in rows]==[5,5,1,0] and [r['rank'] for r in rows]==[1,1,3,4]
 assert sum(r['mine'] for r in rows)==1 and next(r for r in rows if r['mine'])['bosses']==2
 with sqlite3.connect(root/'trainer.db') as conn:assert conn.execute('SELECT * FROM progress ORDER BY student_key').fetchall()==before
 assert client.get('/results/api/trainer/leaderboard',query_string=dict(slug='trainer-9-glitch',className='8 «А»',name=names[0])).status_code==400
 assert client.get('/results/api/trainer/leaderboard',query_string=dict(slug='trainer-8-glitch',className='8 «А»',name='Неизвестный Игрок')).status_code==403
 response=client.post('/results/api/trainer/progress',json=dict(slug='trainer-8-glitch',className='8 «А»',name=names[0],levels={'boss-2':{'stars':1}}));assert response.status_code==200
 assert next(r for r in board().json['rows'] if r['mine'])['stars']==5
 response=client.post('/results/api/trainer/progress',json=dict(slug='trainer-8-glitch',className='8 «А»',name=names[0],levels={'boss-2':{'stars':3}}));assert response.status_code==200
 assert board().json['rows'][0]['stars']==6 and board().json['rows'][0]['mine']
 print('ALL OK: whole class, zero scores, tied ranks, class isolation, allowed bosses, read-only board, best score preserved and updated')
