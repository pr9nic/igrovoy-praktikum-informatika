"""Нарезка art23 («Кодоблокс» 3D) → godot/workshop/assets (PNG/JPG) и обложки Лаборатории/практикума."""
import sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]; sys.path.insert(0, str(ROOT / 'godot/workshop/cells'))
from slicer import cut
RAW = Path(__file__).with_name('raw'); A = ROOT / 'godot/workshop/assets'
for n in ['bx_studs', 'bx_grass', 'bx_lava', 'bx_neon', 'bx_wood', 'bx_metal']:
    Image.open(RAW / f'{n}.png').convert('RGB').resize((512, 512), Image.Resampling.LANCZOS).save(A / f'{n}.png', optimize=True)
for i, fr in enumerate(cut(str(RAW / 'bx_faces.png'), 4, 2)):
    fr = fr.copy(); fr.thumbnail((128, 128), Image.Resampling.LANCZOS)
    c = Image.new('RGBA', (128, 128)); c.paste(fr, ((128 - fr.width) // 2, (128 - fr.height) // 2)); c.save(A / f'bx_face{i}.png', optimize=True)
for n in ['obby', 'tycoon', 'sim', 'glass']:
    Image.open(RAW / f'bx_thumb_{n}.png').convert('RGB').resize((224, 224), Image.Resampling.LANCZOS).save(A / f'bx_thumb_{n}.png', optimize=True)
im = Image.open(RAW / 'bx_cover.png').convert('RGB'); th = round(im.width * 9 / 16)
if th < im.height: im = im.crop((0, (im.height - th) // 2, im.width, (im.height - th) // 2 + th))
im.resize((640, 360), Image.Resampling.LANCZOS).save(A / 'cover_blox.jpg', quality=86)
sq = Image.open(RAW / 'bx_cover.png').convert('RGB'); s = min(sq.size); sq = sq.crop(((sq.width - s) // 2, (sq.height - s) // 2, (sq.width + s) // 2, (sq.height + s) // 2)).resize((420, 420), Image.Resampling.LANCZOS)
for d in ('tools/lab/art', 'tools/practicum/art'):
    sq.save(ROOT / d / 'cover_blocks.webp', 'WEBP', quality=84)
    sq.save(ROOT / d / 'cover_blox.webp', 'WEBP', quality=84)
print('готово')
