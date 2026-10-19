#!/usr/bin/env python3
"""Собирает cells/questions.gd из банков вопросов «Битвы с Глюком» (drafts/trainer-N-glitch.json)."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3];out={}
for g in range(6,12):
    d=json.loads((ROOT/'drafts'/('trainer-%d-glitch.json'%g)).read_text());qs=[];seen=set()
    for w in d['worlds']:
        for l in w['levels']:
            for q in l.get('questions',[]):
                key=(q['q'],q['a'])
                if key in seen or q['a'] in q['w'] or len(q['w'])!=2:continue
                seen.add(key);qs.append({'q':q['q'],'a':q['a'],'w':q['w'],'e':q.get('explanation','')})
    out[str(g)]=qs
(Path(__file__).with_name('questions.gd')).write_text('extends RefCounted\n# Вопросы терминалов знаний по классам. Собраны из банка «Битвы с Глюком» (drafts/trainer-N-glitch.json)\n# командой godot/workshop/cells/make_questions.py; вручную не править.\n\nconst DATA := '+json.dumps(out,ensure_ascii=False,indent=1).replace('\n ','\n\t')+'\n')
print({g:len(q) for g,q in out.items()})
