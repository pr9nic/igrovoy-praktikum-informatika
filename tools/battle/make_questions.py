#!/usr/bin/env python3
"""Собирает server/battle_questions.json из банков «Битвы с Глюком» (drafts/trainer-N-glitch.json): вопросы с тремя вариантами."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]; out = {}
for g in range(6, 12):
    d = json.loads((ROOT / 'drafts' / f'trainer-{g}-glitch.json').read_text()); qs = []; seen = set()
    for w in d['worlds']:
        for l in w['levels']:
            for q in l.get('questions', []):
                key = (q['q'], q['a'])
                if key in seen or q['a'] in q['w'] or len(q['w']) != 2 or len(q['q']) > 160:
                    continue
                seen.add(key); qs.append({'q': q['q'], 'a': q['a'], 'w': q['w'], 'e': q.get('explanation', '')})
    out[str(g)] = qs
(Path(__file__).with_name('server') / 'battle_questions.json').write_text(json.dumps(out, ensure_ascii=False, indent=0))
print({g: len(q) for g, q in out.items()})
