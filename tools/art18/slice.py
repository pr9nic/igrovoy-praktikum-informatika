"""Нарезка art18 для «Битвы класса» → tools/practicum/art/bt/*.webp."""
import sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]; sys.path.insert(0, str(ROOT / 'godot/workshop/cells'))
from slicer import cut
RAW = Path(__file__).with_name('raw'); OUT = ROOT / 'tools/practicum/art/bt'; OUT.mkdir(parents=True, exist_ok=True)
def save(im, name, size):
    im = im.copy(); im.thumbnail(size, Image.Resampling.LANCZOS); im.save(OUT / f'{name}.webp', 'WEBP', quality=84, method=6)
for n, size in [('peak_info', (900, 1350)), ('peak_elbrus', (900, 1350)), ('peak_fuji', (900, 1350)), ('lobby_bg', (1600, 900)), ('break_room', (1600, 900)), ('summit', (1600, 900))]:
    save(Image.open(RAW / f'{n}.png').convert('RGB'), n, size)
m = Image.open(RAW / 'modes.png').convert('RGB'); w, h = m.width // 3, m.height // 2
for i, n in enumerate(['classic', 'paced', 'team', 'test', 'peak', 'editor']):
    save(m.crop(((i % 3) * w, (i // 3) * h, (i % 3 + 1) * w, (i // 3 + 1) * h)), 'mode_' + n, (420, 420))
for sheet, cols, rows, names, size in [
    ('climbers', 4, 3, [f'climber_{i}' for i in range(12)], (220, 220)),
    ('powerups', 4, 3, ['pw_fifty', 'pw_eraser', 'pw_jeopardy', 'pw_double', 'pw_immunity', 'pw_freeze', 'pw_streak_boost', 'pw_streak_saver', 'pw_supersonic', 'pw_gift', 'pw_glitch', 'pw_powerplay'], (160, 160)),
    ('memes_good', 4, 2, [f'good_{i}' for i in range(8)], (260, 260)), ('memes_bad', 4, 2, [f'bad_{i}' for i in range(8)], (260, 260)),
    ('mg_sprites', 4, 2, ['mg_bat', 'mg_boulder', 'mg_shard', 'mg_rope', 'mg_helmet', 'mg_flashlight', 'mg_axe', 'mg_tent'], (160, 160)),
    ('tiers', 4, 1, ['tier_0', 'tier_1', 'tier_2', 'tier_3'], (160, 160))]:
    frames = cut(str(RAW / f'{sheet}.png'), cols, rows)
    assert len(frames) == cols * rows, (sheet, len(frames))
    for name, fr in zip(names, frames): save(fr, name, size)
print(len(list(OUT.glob('*.webp'))), 'файлов', sum(f.stat().st_size for f in OUT.glob('*.webp')) // 1024, 'КБ')
