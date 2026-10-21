"""Нарезка art20 (Байт-бласт, Код-раннер, Бункер, Кодоблокс) → tools/lab/art и обложки в tools/practicum/art."""
import sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]; sys.path.insert(0, str(ROOT / 'godot/workshop/cells'))
from slicer import cut
RAW = Path(__file__).with_name('raw'); LAB = ROOT / 'tools/lab/art'; PR = ROOT / 'tools/practicum/art'
def save(im, path, box):
    im = im.copy(); im.thumbnail(box, Image.Resampling.LANCZOS); im.save(path, 'WEBP', quality=85, method=6)
for sheet, cols, rows, names, box in [
    ('blast_blocks', 3, 2, [f'blast_block_{i}' for i in range(6)], (96, 96)),
    ('runner_hero', 4, 1, [f'runner_hero_{i}' for i in range(4)], (300, 300)),
    ('runner_props', 4, 2, [f'runner_prop_{i}' for i in range(8)], (320, 320)),
    ('bunker_people', 4, 3, [f'bunker_p{i}' for i in range(12)], (256, 256)),
    ('blocks_avatars', 4, 2, [f'blox_av_{i}' for i in range(8)], (220, 220)),
    ('blocks_tiles', 3, 2, [f'blox_tile_{i}' for i in range(6)], (96, 96))]:
    frames = cut(str(RAW / f'{sheet}.png'), cols, rows); assert len(frames) == cols * rows, (sheet, len(frames))
    for n, fr in zip(names, frames): save(fr, LAB / f'{n}.webp', box)
for n in ['bg_blast', 'bg_runner', 'bg_bunker', 'bg_blocks']:
    im = Image.open(RAW / f'{n}.png').convert('RGB'); th = round(im.width * 9 / 16)
    if th < im.height: im = im.crop((0, (im.height - th) // 2, im.width, (im.height - th) // 2 + th))
    im.resize((1280, 720), Image.Resampling.LANCZOS).save(LAB / f'{n}.webp', 'WEBP', quality=82, method=6)
for n in ['blast', 'runner', 'bunker', 'blocks']:
    im = Image.open(RAW / f'cover_{n}.png').convert('RGB').resize((420, 420), Image.Resampling.LANCZOS)
    for d in (LAB, PR): im.save(d / f'cover_{n}.webp', 'WEBP', quality=84, method=6)
print('готово')
