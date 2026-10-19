"""Готовит картинки «Лаборатории» из art/raw (нарисованы Codex/ChatGPT по описаниям из prompts.tsv) в лёгкие WebP.
Запуск: python tools/lab/art/build.py"""
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent
total = 0
for src in sorted((HERE / 'raw').glob('*.png')):
    im, name = Image.open(src), src.stem
    if name.startswith('cover_') or name in ('quest_cave', 'detective_desk'):
        im = im.convert('RGB'); w, h = im.size; th = round(w * 9 / 16)
        if th < h: im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
        im = im.resize((640, 360), Image.Resampling.LANCZOS)
    elif name == 'race_floor':
        im = im.convert('RGB').resize((256, 256), Image.Resampling.LANCZOS)
    elif name == 'factory_belt':
        im = im.convert('RGB'); im.thumbnail((720, 240), Image.Resampling.LANCZOS)
    else:
        im = im.convert('RGBA'); box = im.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox(); im = im.crop(box) if box else im; im.thumbnail((256, 256), Image.Resampling.LANCZOS)
    out = HERE / (name + '.webp'); im.save(out, 'WEBP', quality=82, method=6); total += out.stat().st_size
    print(f'{out.name}: {im.size[0]}×{im.size[1]} {im.mode}, {out.stat().st_size // 1024} КБ')
print(f'всего {total // 1024} КБ')
