"""Нарезка листа спрайтов по сетке: связные пятна относятся к ячейке, в которую попал их центр."""
from collections import deque
from PIL import Image


def cut(path, cols, rows):
    """Кадры листа: связные пятна непрозрачных точек относятся к ячейке сетки, в которую попал их центр."""
    im = Image.open(path).convert('RGBA'); sheet = path
    k = 4
    small = im.getchannel('A').resize((im.width // k, im.height // k), Image.Resampling.BILINEAR).point(lambda v: 255 if v > 40 else 0)
    w, h, px = small.width, small.height, small.load()
    seen, boxes = set(), {}
    for sy in range(h):
        for sx in range(w):
            if not px[sx, sy] or (sx, sy) in seen:
                continue
            queue, pts = deque([(sx, sy)]), []
            seen.add((sx, sy))
            while queue:
                x, y = queue.popleft()
                pts.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1), (x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and (nx, ny) not in seen:
                        seen.add((nx, ny))
                        queue.append((nx, ny))
            if len(pts) < 12:
                continue
            cx, cy = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
            cell = (min(cols - 1, int(cx * cols / w)), min(rows - 1, int(cy * rows / h)))
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            b = boxes.get(cell)
            boxes[cell] = (min(xs), min(ys), max(xs), max(ys)) if not b else (min(b[0], min(xs)), min(b[1], min(ys)), max(b[2], max(xs)), max(b[3], max(ys)))
    out = []
    for r in range(rows):
        for c in range(cols):
            b = boxes.get((c, r))
            assert b, f'{sheet}: пустая ячейка {c},{r}'
            out.append(im.crop((max(0, b[0] * k - 3), max(0, b[1] * k - 3), min(im.width, (b[2] + 1) * k + 3), min(im.height, (b[3] + 1) * k + 3))))
    return out


