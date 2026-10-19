"""Нарезает листы спрайтов из tools/art2/raw (нарисованы Codex по prompts.tsv) и раскладывает картинки по играм:
«Герой кода» -> tools/codehero/assets/art, клавиатурный тренажёр -> tools/typing_escape/art,
«Мастерская роботов» и аркады -> godot/workshop/assets. Запуск: python tools/art2/build.py"""
import sys
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'godot' / 'workshop' / 'cells'))
import importlib.util
spec = importlib.util.spec_from_file_location('slicer', ROOT / 'godot' / 'workshop' / 'cells' / 'slicer.py'); slicer = importlib.util.module_from_spec(spec); spec.loader.exec_module(slicer)
RAW = HERE / 'raw'
cut = lambda sheet, cols, rows: slicer.cut(RAW / (sheet + '.png'), cols, rows)


def fit(im, box):
    im = im.copy(); im.thumbnail(box, Image.Resampling.LANCZOS); return im


def square(im, size, pad=0.0):
    """Картинка на прозрачном квадрате: по центру, низом к нижнему краю."""
    inner = round(size * (1 - pad)); im = fit(im, (inner, inner)); out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(im, ((size - im.width) // 2, size - im.height - round(size * pad / 2)), im); return out


def tile(im, size):
    return im.convert('RGB').resize((size, size), Image.Resampling.LANCZOS)


# ---------- Герой кода ----------
CH = ROOT / 'tools' / 'codehero' / 'assets' / 'art'; CH.mkdir(exist_ok=True)
for name, im in zip(['hero', 'munchkin', 'ogre', 'brute', 'bruiser', 'archer', 'shaman', 'rat', 'guard', 'swarmlord', 'mage', 'glitch'], cut('ch_units', 4, 3)):
    fit(im, (200, 200)).save(CH / f'unit_{name}.webp', 'WEBP', quality=88, method=6)
for name, im in zip(['potion', 'gem', 'bomb', 'door', 'exit', 'trap', 'trap_fire', 'key'], cut('ch_items', 4, 2)):
    fit(im, (160, 160)).save(CH / f'item_{name}.webp', 'WEBP', quality=88, method=6)
tile(Image.open(RAW / 'ch_floor.png'), 256).save(CH / 'floor.webp', 'WEBP', quality=86)
tile(Image.open(RAW / 'ch_wall.png'), 128).save(CH / 'wall.webp', 'WEBP', quality=86)
# ---------- Клавиатурный тренажёр: те же имена файлов, что были у старых картинок ----------
TE = ROOT / 'tools' / 'typing_escape' / 'art'; TE.mkdir(exist_ok=True)
runner = cut('te_runner', 5, 1); k = 240 / runner[0].height
for name, im in zip(['idle', 'walk_a', 'walk_b', 'jump', 'hit'], runner):
    im = im.resize((round(im.width * k), round(im.height * k)), Image.Resampling.LANCZOS); out = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); im = fit(im, (256, 256)); out.paste(im, ((256 - im.width) // 2, 256 - im.height), im)
    out.save(TE / f'character_green_{name}.png', optimize=True)
for name, im in zip(['a', 'b'], cut('te_monster', 2, 1)):
    fit(im, (420, 420)).save(TE / f'monster_{name}.png', optimize=True)
for name, im in zip(['bush', 'grass', 'fence', 'rock', 'mushroom_red', 'mushroom_brown', 'cactus', 'portal'], cut('te_props', 4, 2)):
    (fit(im, (300, 300)) if name == 'portal' else square(im, 160)).save(TE / f'{name}.png', optimize=True)
for name, src in [('background_color_hills', 'te_bg_hills'), ('background_color_trees', 'te_bg_forest'), ('background_color_mushrooms', 'te_bg_mushrooms'), ('background_color_desert', 'te_bg_desert')]:
    bg = Image.open(RAW / (src + '.png')).convert('RGB'); h = bg.width // 3
    if h < bg.height: bg = bg.crop((0, (bg.height - h) // 2, bg.width, (bg.height - h) // 2 + h))
    bg.resize((1500, 500), Image.Resampling.LANCZOS).save(TE / (name + '.jpg'), quality=84)
for name, im in zip(['terrain_grass_block', 'terrain_stone_block'], cut('te_ground', 2, 1)):
    t = im.convert('RGBA').resize((128, 128), Image.Resampling.LANCZOS); t.save(TE / f'{name}_top.png', optimize=True)
    t.crop((0, 64, 128, 128)).resize((128, 128), Image.Resampling.LANCZOS).save(TE / f'{name}_center.png', optimize=True)
# ---------- Мастерская роботов и аркады (Godot) ----------
GD = ROOT / 'godot' / 'workshop' / 'assets'
for name, im in zip(['floor', 'floor_mark', 'wall'], cut('ws_tiles', 3, 1)):
    im.convert('RGBA').resize((128, 128), Image.Resampling.LANCZOS).save(GD / f'{name}.png', optimize=True)
for name, im in zip(['bin_red', 'bin_blue', 'bin_green'], cut('ws_bins', 3, 1)):
    square(im, 128, 0.04).save(GD / f'{name}.png', optimize=True)
for name, im in zip(['crate_red', 'crate_blue', 'crate_green', 'crate_unknown'], cut('ws_crates', 4, 1)):
    square(im, 128, 0.1).save(GD / f'{name}.png', optimize=True)
robot = Image.open(RAW / 'ws_robot.png').convert('RGBA'); robot = robot.crop(robot.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()); fit(robot, (256, 256)).save(GD / 'robot.png', optimize=True)
for name, im in zip(['ar_virus_a', 'ar_virus_b', 'ar_virus_c', 'ar_cannon'], cut('ar_bits', 4, 1)):
    fit(im, (180, 180)).save(GD / f'{name}.png', optimize=True)
for name, im in zip(['ar_snake_head', 'ar_snake_body', 'ar_snake_food', 'ar_snake_hazard'], cut('ar_snake', 4, 1)):
    square(im, 128).save(GD / f'{name}.png', optimize=True)
for name, im in zip(['ar_courier', 'ar_house', 'ar_start', 'ar_finish', 'ar_folder', 'ar_folder_open', 'ar_file', 'ar_file_gold'], cut('ar_icons', 4, 2)):
    fit(im, (160, 160)).save(GD / f'{name}.png', optimize=True)
print('готово:', len(list(CH.glob('*'))), 'для героя кода,', len(list(TE.glob('*'))), 'для тренажёра')
