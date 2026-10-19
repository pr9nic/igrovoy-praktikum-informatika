"""Обложки игр практикума и фоны аркад (нарисованы Codex по art/raw/prompts.tsv).
Обложки -> tools/practicum/art/*.webp (карточки практикума) и godot/workshop/assets/cover_*.jpg (меню аркад), фоны -> godot/workshop/assets/bg_*.jpg.
Запуск: python tools/practicum/art/build.py"""
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent
GODOT = HERE.parents[2] / 'godot' / 'workshop' / 'assets'
for src in sorted((HERE / 'raw').glob('*.png')):
    im = Image.open(src).convert('RGB'); w, h = im.size; th = round(w * 9 / 16)
    if th < h: im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
    if src.stem.startswith('cover_'):
        im.resize((480, 270), Image.Resampling.LANCZOS).save(HERE / (src.stem + '.webp'), 'WEBP', quality=82, method=6)
        im.resize((580, 326), Image.Resampling.LANCZOS).save(GODOT / (src.stem + '.jpg'), quality=84)
    else:
        im.resize((1280, 720), Image.Resampling.LANCZOS).save(GODOT / (src.stem + '.jpg'), quality=80)
    print(src.stem)
