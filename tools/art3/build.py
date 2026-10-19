"""Картинки для «Кодограда» и «Битвы с Глюком» (tools/trainer/art — те же имена, что у старого набора в assets),
значки станков завода (tools/lab/art) и сети (godot/workshop/assets). Листы нарисованы Codex по raw/prompts.tsv.
Часть картинок берётся из уже готовых наборов тренажёра «Побег» и «Клеток памяти». Запуск: python tools/art3/build.py"""
import importlib.util, shutil
from pathlib import Path
from PIL import Image
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
spec = importlib.util.spec_from_file_location('slicer', ROOT / 'godot' / 'workshop' / 'cells' / 'slicer.py'); slicer = importlib.util.module_from_spec(spec); spec.loader.exec_module(slicer)
cut = lambda sheet, cols, rows: slicer.cut(HERE / 'raw' / (sheet + '.png'), cols, rows)
OUT = ROOT / 'tools' / 'trainer' / 'art'; OUT.mkdir(exist_ok=True)


def square(im, size, pad=0.0):
    inner = round(size * (1 - pad)); im = im.copy(); im.thumbnail((inner, inner), Image.Resampling.LANCZOS); out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(im, ((size - im.width) // 2, size - im.height - round(size * pad / 2)), im); return out


def put(im, *names, size=128, pad=0.0):
    sq = square(im, size, pad)
    for n in names: sq.save(OUT / (n + '.png'), optimize=True)


e1, e2 = cut('tr_enemies1', 4, 2), cut('tr_enemies2', 4, 2)
for i, name in enumerate(['slime_normal_walk', 'slime_fire_walk', 'slime_spike_walk', 'ladybug_walk']):
    for fr, im in (('a', e1[i]), ('b', e1[i + 4])): put(im, f'{name}_{fr}'); put(im, f'big_{name}_{fr}', size=256)
for i, name in enumerate(['fly', 'bee']):
    for fr, im in (('a', e2[i]), ('b', e2[i + 4])): put(im, f'{name}_{fr}'); put(im, f'big_{name}_{fr}', size=256)
put(e2[2], 'frog_idle'); put(e2[6], 'frog_jump'); put(e2[2], 'big_frog_idle', size=256); put(e2[6], 'big_frog_jump', size=256)
for fr, im in (('a', e2[3]), ('b', e2[7])): put(im, f'worm_ring_move_{fr}'); put(im, f'big_worm_ring_move_{fr}', size=256)
misc = dict(zip(['coin_gold', 'hud_heart', 'hud_heart_empty', 'lock_red', 'saw_a', 'saw_b', 'bomb', 'sign', 'block_exclamation', 'block_empty', 'bricks_brown', 'block_idle'], cut('tr_misc', 4, 3)))
for name, im in misc.items(): put(im, name, pad=0.06 if name in ('coin_gold', 'hud_heart', 'hud_heart_empty', 'lock_red', 'bomb') else 0.0)
put(misc['coin_gold'], 'coin', pad=0.06); put(misc['block_idle'], 'block_fall'); put(misc['block_idle'], 'big_block_idle', 'big_block_fall', size=256)
plat = cut('tr_platform', 3, 2)
for row, kind in enumerate(['grass', 'stone']):
    for col, part in enumerate(['left', 'middle', 'right']):
        plat[row * 3 + col].convert('RGBA').resize((128, 128), Image.Resampling.LANCZOS).save(OUT / f'terrain_{kind}_cloud_{part}.png', optimize=True)
# Из готовых наборов: герой, земля и кусты — из «Побега»; дверь, факел, шипы, огонь и кристалл — из «Клеток памяти».
TE, CE = ROOT / 'tools' / 'typing_escape' / 'art', ROOT / 'godot' / 'workshop' / 'cells' / 'art'
for n in ['character_green_idle', 'character_green_walk_a', 'character_green_walk_b', 'character_green_jump', 'character_green_hit', 'terrain_grass_block_top', 'terrain_grass_block_center', 'terrain_stone_block_top', 'terrain_stone_block_center', 'bush', 'grass', 'fence', 'rock', 'mushroom_red', 'mushroom_brown', 'cactus']:
    shutil.copyfile(TE / (n + '.png'), OUT / (n + '.png'))
idle = Image.open(TE / 'character_green_idle.png'); duck = Image.new('RGBA', idle.size, (0, 0, 0, 0)); low = idle.resize((idle.width, round(idle.height * 0.68)), Image.Resampling.LANCZOS); duck.paste(low, (0, idle.height - low.height), low); duck.save(OUT / 'character_green_duck.png', optimize=True)
for name, im in (('closed', Image.open(CE / 'p_door_closed.png')), ('open', Image.open(CE / 'p_door_open.png'))):
    im = im.convert('RGBA').resize((128, 256), Image.Resampling.LANCZOS); im.crop((0, 0, 128, 128)).save(OUT / f'door_{name}_top.png', optimize=True); im.crop((0, 128, 128, 256)).save(OUT / f'door_{name}.png', optimize=True)
torch = Image.open(CE / 'p_torch.png'); put(torch, 'torch_on_a'); put(torch.transpose(Image.Transpose.FLIP_LEFT_RIGHT), 'torch_on_b')
put(Image.open(CE / 'p_spikes.png'), 'spikes'); put(Image.open(CE / 'p_fireball.png'), 'fireball', pad=0.1); put(Image.open(CE / 'p_gem.png'), 'gem_yellow', pad=0.1)
# Завод и сеть.
LAB = ROOT / 'tools' / 'lab' / 'art'
for name, im in zip(['filter', 'press', 'sort', 'count'], cut('lab_machines', 4, 1)):
    im.thumbnail((160, 160), Image.Resampling.LANCZOS); im.save(LAB / f'machine_{name}.webp', 'WEBP', quality=88, method=6)
GD = ROOT / 'godot' / 'workshop' / 'assets'
for name, im in zip(['ar_pc', 'ar_server', 'ar_router', 'ar_packet'], cut('ar_net', 4, 1)):
    square(im, 128, 0.04).save(GD / f'{name}.png', optimize=True)
print('картинок для тренажёра:', len(list(OUT.glob('*.png'))))
