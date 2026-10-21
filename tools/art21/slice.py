"""Нарезка art21: ведущие, города «Карты дорог», черепаха и фоны → tools/lab/art."""
import sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]; sys.path.insert(0, str(ROOT / 'godot/workshop/cells'))
from slicer import cut
RAW = Path(__file__).with_name('raw'); LAB = ROOT / 'tools/lab/art'
def save(im, path, box):
    im = im.copy(); im.thumbnail(box, Image.Resampling.LANCZOS); im.save(path, 'WEBP', quality=85, method=6)
HOSTS = ['host_telegraph', 'host_navigator', 'host_turtle', 'host_dispatcher', 'host_spy', 'host_archivist', 'host_tape', 'host_tech']
for n, fr in zip(HOSTS, cut(str(RAW / 'hosts2.png'), 4, 2)): save(fr, LAB / f'{n}.webp', (240, 240))
for i, fr in enumerate(cut(str(RAW / 'towns.png'), 4, 2)): save(fr, LAB / f'town_{i}.webp', (128, 128))
im = Image.open(RAW / 'turtle_sprite.png').convert('RGBA'); save(im.crop(im.getbbox()), LAB / 'turtle_top.webp', (128, 128))
for n in ['bg_graphs', 'bg_turtle', 'bg_codes', 'bg_sorting', 'bg_turing', 'bg_archiver', 'bg_cipher']:
    Image.open(RAW / f'{n}.png').convert('RGB').resize((1280, 720), Image.Resampling.LANCZOS).save(LAB / f'{n}.webp', 'WEBP', quality=82, method=6)
print('готово')
