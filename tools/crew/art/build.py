"""Готовит картинки игры «Сбой на станции» из tools/crew/art/raw и raw2 (нарисованы нейросетями по описаниям из prompts.tsv:
raw — Codex/ChatGPT, raw2 — agy/Gemini) в лёгкие WebP рядом: текстуры 512 px, предметы обрезаются по содержимому и уменьшаются.
Запуск: python tools/crew/art/build.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
HERE = Path(__file__).resolve().parent
total = 0
for src in sorted(list((HERE / 'raw').glob('*.png')) + list((HERE / 'raw2').glob('*.png'))):
    im = Image.open(src)
    if src.stem.startswith('prop_'):
        im = im.convert('RGBA')
        if im.getchannel('A').getextrema()[0] > 250:
            # Фон непрозрачный (Gemini рисует на сплошном пурпурном): заливаем его от краёв и убираем пурпурную кайму.
            rgb = im.convert('RGB')
            w, h = rgb.size
            for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
                if rgb.getpixel(corner) != (1, 254, 3):
                    ImageDraw.floodfill(rgb, corner, (1, 254, 3), thresh=70)
            # Маска фона: залитые точки плюс пурпурная кайма рядом с ними (всё средствами Pillow, без numpy).
            from PIL import ImageChops
            r, g, b = rgb.split()
            filled = ImageChops.multiply(ImageChops.multiply(r.point(lambda v: 255 if v == 1 else 0), g.point(lambda v: 255 if v == 254 else 0)), b.point(lambda v: 255 if v == 3 else 0))
            r0, g0, b0, _ = im.split()
            pink = ImageChops.multiply(ImageChops.multiply(r0.point(lambda v: 255 if v > 150 else 0), b0.point(lambda v: 255 if v > 150 else 0)), g0.point(lambda v: 255 if v < 110 else 0))
            # Чистый пурпурный убираем везде (он бывает и внутри предмета, между перекладинами), а кайму — рядом с уже убранным.
            pure = ImageChops.multiply(ImageChops.multiply(r0.point(lambda v: 255 if v > 190 else 0), b0.point(lambda v: 255 if v > 190 else 0)), g0.point(lambda v: 255 if v < 90 else 0))
            mask = ImageChops.lighter(filled, pure)
            mask = ImageChops.lighter(mask, ImageChops.multiply(pink, mask.filter(ImageFilter.MaxFilter(7))))
            im.putalpha(ImageChops.invert(mask))
        box = im.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
        im = im.crop(box) if box else im
        im.thumbnail((440, 440), Image.Resampling.LANCZOS)
    else:
        im = im.convert('RGB').resize((512, 512), Image.Resampling.LANCZOS)
    out = HERE / (src.stem + '.webp')
    im.save(out, 'WEBP', quality=84, method=6)
    total += out.stat().st_size
    print(f'{out.name}: {im.size[0]}×{im.size[1]}, {out.stat().st_size // 1024} КБ')
print(f'всего {total // 1024} КБ')
