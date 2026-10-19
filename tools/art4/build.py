"""Фоны «Битвы с Глюком», космонавты «Сбоя на станции», портреты жителей «Города данных» и подозреваемых «Детектива»,
обложки игр-ссылок практикума. Нарисованы Codex по raw/prompts*.tsv. Запуск: python tools/art4/build.py"""
import importlib.util
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]
spec = importlib.util.spec_from_file_location('slicer', ROOT / 'godot' / 'workshop' / 'cells' / 'slicer.py'); slicer = importlib.util.module_from_spec(spec); spec.loader.exec_module(slicer)
cut = lambda sheet, cols, rows: slicer.cut(HERE / 'raw' / (sheet + '.png'), cols, rows)
def fit(im, box): im = im.copy(); im.thumbnail(box, Image.Resampling.LANCZOS); return im
TR = ROOT / 'tools' / 'trainer' / 'art'
for n in ['hills', 'trees', 'desert', 'mushrooms']:
    im = Image.open(HERE / 'raw' / f'bgp_{n}.png').convert('RGB'); h = im.width // 3
    if h < im.height: im = im.crop((0, (im.height - h) // 2, im.width, (im.height - h) // 2 + h))
    im.resize((1500, 500), Image.Resampling.LANCZOS).save(TR / f'bgp_{n}.jpg', quality=84)
CR = ROOT / 'tools' / 'crew' / 'art'
mates = cut('crew_mate', 5, 1); k = 150 / mates[0].height
for name, im in zip(['idle', 'walk_a', 'walk_b', 'body', 'ghost'], mates):
    im.resize((round(im.width * k), round(im.height * k)), Image.Resampling.LANCZOS).save(CR / f'mate_{name}.webp', 'WEBP', quality=90, method=6)
LAB = ROOT / 'tools' / 'lab' / 'art'
for i, im in enumerate(cut('db_residents', 4, 4)): fit(im, (96, 96)).save(LAB / f'resident_{i}.webp', 'WEBP', quality=88, method=6)
for i, im in enumerate(cut('det_suspects', 4, 1)): fit(im, (128, 128)).save(LAB / f'suspect_{i}.webp', 'WEBP', quality=88, method=6)
PR = ROOT / 'tools' / 'practicum' / 'art'
for src in sorted((HERE / 'raw').glob('cover_link_*.png')):
    im = Image.open(src).convert('RGB'); w, h = im.size; th = round(w * 9 / 16)
    if th < h: im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
    im.resize((480, 270), Image.Resampling.LANCZOS).save(PR / (src.stem.replace('cover_link_', 'link_') + '.webp'), 'WEBP', quality=82, method=6)
print('ok')
