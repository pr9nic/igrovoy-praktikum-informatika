"""Готовит картинки «Клеток памяти» из cells/art_raw (нарисованы Codex/ChatGPT по описаниям из prompts.tsv) в cells/art:
листы спрайтов режутся на кадры по сетке, плитки и фоны уменьшаются. Запуск: python godot/workshop/cells/make_art.py"""
from collections import deque
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import Image
HERE = Path(__file__).resolve().parent
RAW, OUT = HERE / 'art_raw', HERE / 'art'
OUT.mkdir(exist_ok=True)


from slicer import cut as _cut


def cut(sheet, cols, rows):
    return _cut(RAW / (sheet + '.png'), cols, rows)


def save(im, name, scale=None, box=None):
    if scale:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.Resampling.LANCZOS)
    if box:
        im.thumbnail(box, Image.Resampling.LANCZOS)
    im.save(OUT / (name + '.png'), optimize=True)
    return im.size


report = []
# Герой: все кадры уменьшаются одинаково (по росту стойки), чтобы он не «дышал» при смене поз.
hero = cut('hero', 5, 2)
k = 150 / hero[0].height
for name, im in zip(['idle', 'run_a', 'run_b', 'run_c', 'jump', 'fall', 'roll', 'hurt', 'attack', 'aim'], hero):
    report.append(('hero_' + name, save(im, 'hero_' + name, k)))
for name, im in zip(['sword', 'hammer', 'daggers', 'spear', 'bow', 'crossbow', 'staff', 'arrow'], cut('weapons', 4, 2)):
    report.append(('w_' + name, save(im, 'w_' + name, box=(190, 190))))
foes = cut('enemies', 5, 2)
for i, name in enumerate(['slime', 'fly', 'frog', 'bee', 'bug']):
    kk = (230 if name == 'bug' else 150) / max(foes[i].width, foes[i].height)
    for frame, im in (('a', foes[i]), ('b', foes[i + 5])):
        report.append((f'foe_{name}_{frame}', save(im, f'foe_{name}_{frame}', kk)))
boss = cut('boss', 2, 1)
kb = 400 / boss[0].height
for name, im in zip(['idle', 'jump'], boss):
    report.append(('boss_' + name, save(im, 'boss_' + name, kb)))
for name, im in zip(['term_on', 'term_off', 'door_closed', 'door_open', 'gem', 'flask', 'chest', 'chest_open', 'spikes', 'pad', 'fireball', 'torch'], cut('props', 4, 3)):
    report.append(('p_' + name, save(im, 'p_' + name, box=(220, 220))))
for zone in ['grove', 'forest', 'catacomb', 'waste', 'lair', 'vault']:
    for part in ['top', 'fill']:
        im = Image.open(RAW / f'tile_{zone}_{part}.png').convert('RGB')
        # Сверху у плитки иногда остаётся чёрная полоса фона: срезаем её и снова делаем квадрат.
        top = 0
        while top < im.height // 3 and max(im.getpixel((x, top))[c] for x in range(0, im.width, 37) for c in range(3)) < 24:
            top += 1
        if top:
            im = im.crop((0, top, im.width, im.height))
        im = im.resize((192, 192), Image.Resampling.LANCZOS)
        im.save(OUT / f'tile_{zone}_{part}.png', optimize=True)
    bg = Image.open(RAW / f'bg_{zone}.png').convert('RGB')
    th = round(bg.width * 9 / 16)
    if th < bg.height:
        bg = bg.crop((0, (bg.height - th) // 2, bg.width, (bg.height - th) // 2 + th))
    bg.resize((1280, 720), Image.Resampling.LANCZOS).save(OUT / f'bg_{zone}.jpg', quality=84)
# Вторая волна (большие уровни): новые враги, боссы, «Переход», предметы.
foes2 = cut('foes2', 6, 2)
for i, name in enumerate(['shield', 'skel', 'bomber', 'wraith', 'worm', 'turret']):
    kk = 170 / max(foes2[i].width, foes2[i].height)
    for frame, im in (('a', foes2[i]), ('b', foes2[i + 6])):
        report.append((f'foe_{name}_{frame}', save(im, f'foe_{name}_{frame}', kk)))
bosses = cut('bosses2', 3, 2)
for i, name in enumerate(['spam', 'guard', 'rage']):
    kb2 = 400 / max(bosses[i].height, bosses[i + 3].height)
    for frame, im in (('idle', bosses[i]), ('attack', bosses[i + 3])):
        report.append((f'boss_{name}_{frame}', save(im, f'boss_{name}_{frame}', kb2)))
for name, im in zip(['merchant', 'collector', 'fountain', 'lift'], cut('npcs', 4, 1)):
    report.append(('n_' + name, save(im, 'n_' + name, box=(300, 300))))
for name, im in zip(['cell', 'scroll', 'food', 'key', 'ladder', 'kdoor', 'portal', 'gold'], cut('props2', 4, 2)):
    report.append(('p_' + name, save(im, 'p_' + name, box=(220, 220))))
for name in ['rest']:
    bg = Image.open(RAW / f'bg_{name}.png').convert('RGB')
    th = round(bg.width * 9 / 16)
    if th < bg.height:
        bg = bg.crop((0, (bg.height - th) // 2, bg.width, (bg.height - th) // 2 + th))
    bg.resize((1280, 720), Image.Resampling.LANCZOS).save(OUT / f'bg_{name}.jpg', quality=84)
for name, size in report:
    print(name, size)
print('файлов:', len(list(OUT.glob('*.*'))), 'размер:', sum(f.stat().st_size for f in OUT.glob('*.*')) // 1024, 'КБ')
