# «Собери компьютер 3D»: детали компьютера в Blender (процедурно) → godot/workshop/pc3d/*.glb, layout.gd, значки.
# Запуск: blender -b -P tools/pc3d/model.py
import bpy, bmesh, math, json, os
from mathutils import Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'godot', 'workshop', 'pc3d')
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ---------- материалы ----------
MATS = {}
def mat(name, color, metal=0.0, rough=0.5, emit=None, strength=1.0, alpha=1.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha; m.blend_method = 'BLEND'
    MATS[name] = m; return m
def hexc(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)   # sRGB → линейный
M = {
    'steel': mat('steel', hexc('1b1d22'), 0.6, 0.45), 'steel2': mat('steel2', hexc('2a2e36'), 0.5, 0.5), 'mesh': mat('mesh', hexc('0e0f12'), 0.3, 0.7),
    'pcb': mat('pcb', hexc('1a2a22'), 0.1, 0.55), 'pcb_dark': mat('pcb_dark', hexc('15171c'), 0.1, 0.5), 'silk': mat('silk', hexc('d9d9d9'), 0, 0.6),
    'gold': mat('gold', hexc('d4a537'), 1.0, 0.25), 'alu': mat('alu', hexc('b9bec7'), 1.0, 0.3), 'copper': mat('copper', hexc('c46a3a'), 1.0, 0.3),
    'plastic': mat('plastic', hexc('121316'), 0, 0.55), 'plastic_g': mat('plastic_g', hexc('3a3f4a'), 0, 0.5), 'white': mat('white', hexc('e8e8e8'), 0, 0.5),
    'slot': mat('slot', hexc('2b2f37'), 0, 0.5), 'slot_b': mat('slot_b', hexc('2f6bd6'), 0, 0.45), 'rgb': mat('rgb', hexc('ffffff'), 0, 0.3, hexc('7f5cff'), 3.0),
    'rgb2': mat('rgb2', hexc('ffffff'), 0, 0.3, hexc('3ad6ff'), 3.0), 'chip': mat('chip', hexc('16171a'), 0.2, 0.35), 'cap': mat('cap', hexc('202226'), 0.6, 0.35),
    'label': mat('label', hexc('e6e2d4'), 0, 0.6), 'fan': mat('fan', hexc('1c1e24'), 0, 0.45), 'red': mat('red', hexc('c4202e'), 0.3, 0.4), 'green': mat('green', hexc('1f7a3c'), 0.1, 0.5),
    'screen': mat('screen', hexc('050608'), 0.2, 0.08, hexc('183a6b'), 0.6), 'glass': mat('glass', hexc('aab4c4'), 0, 0.05, None, 1, 0.18), 'heat': mat('heat', hexc('3a3d44'), 0.8, 0.35),
}

# ---------- примитивы ----------
def box(size, loc, m, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        md = o.modifiers.new('b', 'BEVEL'); md.width = bevel; md.segments = 2
        bpy.ops.object.modifier_apply(modifier='b')
    o.data.materials.append(m); return o
def cyl(r, depth, loc, m, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object; o.data.materials.append(m)
    bpy.ops.object.shade_smooth(); return o
def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); o = bpy.context.active_object; o.name = name
    # точка отсчёта — в центре детали
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS'); return o
def fan(center, r, axis, m_blade, m_frame, frame=True):
    """Вентилятор: рамка, ступица и 7 лопастей; axis — 'x', 'y' или 'z' (ось вращения)."""
    parts = []
    rot = {'x': (0, math.pi / 2, 0), 'y': (math.pi / 2, 0, 0), 'z': (0, 0, 0)}[axis]
    cx, cy, cz = center
    if frame:
        s = r * 2.2
        fs = {'x': (0.12 * r, s, s), 'y': (s, 0.12 * r, s), 'z': (s, s, 0.12 * r)}[axis]
        f = box(fs, center, m_frame, 0.02)
        # отверстие: вычитаем цилиндр
        hole = cyl(r * 1.02, r, center, m_frame, rot)
        bo = f.modifiers.new('h', 'BOOLEAN'); bo.object = hole; bo.operation = 'DIFFERENCE'
        bpy.context.view_layer.objects.active = f; bpy.ops.object.modifier_apply(modifier='h')
        bpy.data.objects.remove(hole); parts.append(f)
    parts.append(cyl(r * 0.32, r * 0.16, center, m_frame, rot))
    for k in range(7):
        a = k / 7 * math.tau
        if axis == 'x':
            loc = (cx, cy + math.cos(a) * r * 0.6, cz + math.sin(a) * r * 0.6); br = (a + 0.4, 0, 0); sz = (0.03 * r, r * 0.62, r * 0.36)
            b = box(sz, loc, m_blade, 0.0); b.rotation_euler = (a, 0.0, 0.0); b.rotation_euler.x += 0; bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
            b.rotation_euler = (0, 0.35, 0); bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        elif axis == 'z':
            loc = (cx + math.cos(a) * r * 0.6, cy + math.sin(a) * r * 0.6, cz)
            b = box((r * 0.62, r * 0.36, 0.03 * r), loc, m_blade); b.rotation_euler = (0.35, 0, a); bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        else:
            loc = (cx + math.cos(a) * r * 0.6, cy, cz + math.sin(a) * r * 0.6)
            b = box((r * 0.62, 0.03 * r, r * 0.36), loc, m_blade); b.rotation_euler = (0, -a, 0.35); bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        parts.append(b)
    return parts

PART = {}     # имя → объект
# Единица = 10 см. Корпус: X — поперёк (зритель слева, x<0), Y — глубина (перед y<0), Z — вверх.
BX = 0.84     # поверхность материнской платы
# ---------- корпус ----------
o = []
o.append(box((0.06, 4.6, 4.7), (1.03, 0, 2.35), M['steel'], 0.02))           # правая стенка
o.append(box((2.12, 4.6, 0.06), (0, 0, 4.67), M['steel'], 0.02))             # крыша
o.append(box((2.12, 4.6, 0.08), (0, 0, 0.04), M['steel'], 0.02))             # дно
o.append(box((2.12, 0.06, 4.7), (0, 2.27, 2.35), M['steel2'], 0.01))         # задняя стенка
o.append(box((2.2, 0.12, 4.75), (0, -2.33, 2.37), M['mesh'], 0.04))          # передняя панель
o.append(box((0.5, 0.02, 0.06), (0, -2.40, 4.35), M['rgb2'], 0.0))           # подсветка
for k in range(4): o.append(box((1.6, 0.02, 0.03), (0, -2.40, 1.2 + k * 0.8), M['plastic_g']))
o.append(box((2.0, 3.0, 0.06), (0, -0.8, 1.05), M['steel2'], 0.02))          # кожух БП
o.append(box((2.0, 0.06, 1.0), (0, 0.7, 0.55), M['steel2'], 0.01))
for k in range(7): o.append(box((0.04, 0.05, 0.18), (0.4 - 0.0, 2.3, 1.55 + k * 0.2), M['alu']))   # заглушки слотов
o.append(box((0.6, 0.06, 0.9), (0.55, 2.3, 4.0), M['plastic'], 0.01))        # окно задней панели
# корзина для дисков
o.append(box((1.7, 1.1, 0.04), (-0.05, -1.55, 0.95), M['steel2'], 0.01))
o.append(box((0.04, 1.1, 0.8), (0.8, -1.55, 0.55), M['steel2']))
o.append(box((0.04, 1.1, 0.8), (-0.9, -1.55, 0.55), M['steel2']))
for z in (2.0, 3.2, 4.2): o.append(cyl(0.06, 0.04, (0.86, 1.8, z), M['alu'], (0, math.pi / 2, 0), 12))     # стойки
PART['case'] = join(o, 'case')

# ---------- материнская плата (плоскость YZ, детали торчат в -X) ----------
Y0, Y1, Z0, Z1 = -0.44, 2.0, 1.35, 4.40
o = [box((0.04, Y1 - Y0, Z1 - Z0), (BX, (Y0 + Y1) / 2, (Z0 + Z1) / 2), M['pcb_dark'], 0.005)]
# дорожки
for k in range(26): o.append(box((0.002, 0.008, 0.6 + (k % 5) * 0.2), (BX - 0.021, Y0 + 0.1 + k * 0.09, 2.2 + (k % 3) * 0.3), M['copper']))
SOCKET = Vector((BX - 0.03, 1.05, 3.55))
o.append(box((0.03, 0.62, 0.62), SOCKET, M['slot'], 0.01))                  # сокет
o.append(box((0.01, 0.46, 0.46), SOCKET + Vector((-0.02, 0, 0)), M['gold']))
o.append(box((0.04, 0.05, 0.5), SOCKET + Vector((-0.02, 0.36, 0)), M['alu']))   # рычаг
for (dy, dz, w, h) in [(0.0, 0.48, 0.9, 0.18), (-0.48, 0.0, 0.18, 0.7)]:     # радиаторы VRM
    o.append(box((0.22, w, h), SOCKET + Vector((-0.1, dy, dz)), M['heat'], 0.02))
DIMM = [0.08, 0.20, 0.32, 0.44]
for k, y in enumerate(DIMM):
    o.append(box((0.08, 0.06, 1.36), (BX - 0.05, y, 3.55), M['slot_b'] if k % 2 else M['slot'], 0.005))
PCIE = Vector((BX - 0.05, 1.35, 2.55))
o.append(box((0.08, 0.92, 0.07), PCIE, M['slot'], 0.005))
o.append(box((0.07, 0.4, 0.05), (BX - 0.04, 1.35, 1.75), M['slot']))        # x1
M2 = Vector((BX - 0.025, 0.95, 3.0))
o.append(box((0.03, 0.82, 0.24), M2 + Vector((0, 0, 0)), M['pcb'], 0.0))
o.append(box((0.04, 0.06, 0.24), M2 + Vector((-0.01, -0.42, 0)), M['slot']))
o.append(box((0.16, 0.5, 0.5), (BX - 0.08, 0.1, 2.0), M['heat'], 0.03))      # чипсет
o.append(box((0.01, 0.3, 0.3), (BX - 0.165, 0.1, 2.0), M['rgb'], 0.0))
ATX24 = Vector((BX - 0.08, -0.36, 3.1))
o.append(box((0.14, 0.1, 0.62), ATX24, M['plastic'], 0.01))
EPS8 = Vector((BX - 0.08, 1.6, 4.3))
o.append(box((0.14, 0.32, 0.1), EPS8, M['plastic'], 0.01))
for k in range(4): o.append(box((0.08, 0.1, 0.08), (BX - 0.05, -0.36, 1.6 + k * 0.14), M['slot']))   # SATA
o.append(box((0.28, 0.25, 0.75), (BX - 0.14, 1.88, 3.95), M['steel2'], 0.02))   # задняя панель разъёмов
IO = {'usb': [(3.62, 'slot_b'), (3.74, 'slot_b'), (3.86, 'slot_b')], 'rj45': [(4.02, 'label')], 'hdmi_mb': [(4.16, 'alu')], 'audio': [(3.5, 'green')]}
for kind, items in IO.items():
    for z, mname in items:
        sz = {'usb': (0.06, 0.03, 0.06), 'rj45': (0.12, 0.03, 0.1), 'hdmi_mb': (0.12, 0.03, 0.05), 'audio': (0.05, 0.03, 0.05)}[kind]
        o.append(box(sz, (BX - 0.14, 2.31, z), M[mname], 0.005))
for k in range(14): o.append(cyl(0.035, 0.1, (BX - 0.06, 0.55 + (k % 7) * 0.08, 3.1 + (k // 7) * 0.9), M['cap'], (0, math.pi / 2, 0), 12))
o.append(cyl(0.09, 0.03, (BX - 0.03, 0.6, 1.6), M['alu'], (0, math.pi / 2, 0)))   # батарейка
PART['board'] = join(o, 'board')

# ---------- детали ----------
LAYOUT = {}
def done(name, objs):
    ob = join(objs, name); PART[name] = ob
    LAYOUT[name] = list(ob.location)
# процессор
c = SOCKET + Vector((-0.04, 0, 0))
done('cpu', [box((0.03, 0.42, 0.42), c, M['green'], 0.005), box((0.03, 0.34, 0.34), c + Vector((-0.03, 0, 0)), M['alu'], 0.01),
             box((0.002, 0.2, 0.05), c + Vector((-0.046, 0, 0.08)), M['plastic'])])
# кулер-башня
K = SOCKET + Vector((-0.75, 0, 0))
o = [box((0.12, 0.45, 0.45), SOCKET + Vector((-0.1, 0, 0)), M['copper'], 0.01)]
for k in range(28): o.append(box((1.1, 0.012, 1.15), K + Vector((-0.05, -0.27 + k * 0.02, 0)), M['alu']))
for k in range(4): o.append(cyl(0.035, 1.3, K + Vector((0.0, -0.12 + k * 0.08, -0.35)), M['copper'], (0, math.pi / 2, 0), 10))
o += fan(tuple(K + Vector((-0.05, -0.42, 0))), 0.52, 'y', M['fan'], M['plastic'])
o.append(box((0.01, 0.02, 0.9), K + Vector((-0.6, -0.48, 0)), M['rgb'], 0.0))
done('cooler', o)
# память: две планки в слоты 2 и 4
for i, y in [(0, DIMM[1]), (1, DIMM[3])]:
    c = Vector((BX - 0.24, y, 3.55))
    o = [box((0.32, 0.03, 1.33), c, M['pcb'], 0.002), box((0.34, 0.05, 1.3), c + Vector((-0.04, 0, 0)), M['steel'], 0.01),
         box((0.04, 0.052, 1.2), c + Vector((-0.2, 0, 0)), M['rgb2'], 0.0), box((0.05, 0.031, 1.25), c + Vector((0.17, 0, 0)), M['gold'])]
    done(f'ram{i}', o)
# видеокарта: висит под PCIe, вентиляторы вниз
G = PCIE + Vector((-0.6, -0.05, -0.28))
o = [box((1.15, 2.7, 0.06), G + Vector((0.02, -0.3, 0.12)), M['pcb_dark'], 0.01), box((1.2, 2.75, 0.32), G + Vector((0, -0.3, -0.06)), M['steel2'], 0.04),
     box((1.18, 2.7, 0.03), G + Vector((0, -0.3, 0.2)), M['steel'], 0.01), box((0.12, 0.85, 0.03), G + Vector((0.57, 0.0, 0.18)), M['gold']),
     box((0.04, 0.06, 1.25), (BX - 0.6, 2.28, 2.4), M['alu'], 0.0), box((0.02, 1.6, 0.03), G + Vector((-0.6, -0.3, 0.05)), M['rgb'], 0.0),
     box((0.14, 0.03, 0.06), (BX - 0.6, 2.31, 2.25), M['alu'], 0.005), box((0.14, 0.03, 0.06), (BX - 0.6, 2.31, 2.42), M['alu'], 0.005),
     box((0.16, 0.2, 0.1), G + Vector((-0.35, -1.45, 0.2)), M['plastic'], 0.01)]
for dy in (-1.1, 0.3):
    o += fan(tuple(G + Vector((0, dy, -0.24))), 0.45, 'z', M['fan'], M['plastic'], frame=False)
    o.append(cyl(0.48, 0.03, G + Vector((0, dy, -0.21)), M['plastic']))
done('gpu', o)
# SSD M.2
c = M2 + Vector((-0.03, 0.02, 0))
o = [box((0.015, 0.8, 0.22), c, M['pcb'], 0.002)]
for k in range(3): o.append(box((0.02, 0.16, 0.14), c + Vector((-0.016, -0.24 + k * 0.22, 0)), M['chip'], 0.005))
o.append(box((0.002, 0.5, 0.16), c + Vector((-0.03, 0.05, 0)), M['label']))
o.append(box((0.016, 0.04, 0.2), c + Vector((0, -0.42, 0)), M['gold']))
done('ssd', o)
# жёсткий диск в корзине
c = Vector((-0.05, -1.55, 0.55))
done('hdd', [box((1.0, 1.46, 0.26), c, M['alu'], 0.02), box((0.6, 0.7, 0.01), c + Vector((0, -0.1, 0.135)), M['label']),
             box((0.9, 0.1, 0.2), c + Vector((0, 0.74, 0)), M['pcb'], 0.0)])
# блок питания сзади внизу
c = Vector((0, 1.45, 0.52))
o = [box((1.5, 1.45, 0.86), c, M['steel'], 0.03), box((0.9, 0.05, 0.6), c + Vector((0, 0.73, 0)), M['mesh'])]
o += fan(tuple(c + Vector((0, 0, 0.44))), 0.36, 'z', M['fan'], M['mesh'], frame=False)
o.append(box((0.3, 0.02, 0.06), c + Vector((-0.4, 0.74, 0.25)), M['red']))
done('psu', o)
# монитор, клавиатура, мышь — на столе слева от корпуса
c = Vector((-4.2, -1.0, 2.2))
o = [box((0.12, 5.6, 3.3), c, M['plastic'], 0.05), box((0.02, 5.35, 3.05), c + Vector((-0.065, 0, 0.05)), M['screen']),
     box((0.25, 0.4, 1.6), c + Vector((0.25, 0, -1.6)), M['plastic'], 0.04), box((1.4, 2.0, 0.08), c + Vector((0.35, 0, -2.4)), M['plastic'], 0.04)]
done('monitor', o)
c = Vector((-5.6, -1.0, 0.05))
o = [box((1.6, 4.4, 0.12), c, M['plastic'], 0.04)]
for r in range(5):
    for k in range(15):
        o.append(box((0.24, 0.24, 0.08), c + Vector((-0.6 + r * 0.3, -2.0 + k * 0.29, 0.09)), M['plastic_g'], 0.02))
done('keyboard', o)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(-5.6, 2.0, 0.12)); ms = bpy.context.active_object; ms.scale = (1.0, 0.6, 0.35); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); ms.data.materials.append(M['plastic']); bpy.ops.object.shade_smooth()
done('mouse', [ms])

# Точки: гнёзда-обманки и разъёмы для кабелей (в координатах Blender).
PTS = {'dimm1': Vector((BX - 0.24, DIMM[0], 3.55)), 'dimm3': Vector((BX - 0.24, DIMM[2], 3.55)), 'pcie_x1': Vector((BX - 0.3, 1.35, 1.75)),
       'atx24': ATX24 + Vector((-0.08, 0, 0)), 'eps8': EPS8 + Vector((-0.08, 0, 0)), 'gpu_pwr': G + Vector((-0.35, -1.45, 0.28)), 'sata_pwr': Vector((-0.05, -0.8, 0.55)),
       'sata_port': Vector((BX - 0.1, -0.36, 1.8)),
       'usb': Vector((BX - 0.14, 2.34, 3.74)), 'rj45': Vector((BX - 0.14, 2.34, 4.02)), 'hdmi_mb': Vector((BX - 0.14, 2.34, 4.16)), 'audio': Vector((BX - 0.14, 2.34, 3.5)),
       'hdmi_gpu': Vector((BX - 0.6, 2.34, 2.33)), 'psu_out': Vector((0.0, 0.75, 0.6)), 'psu_plug': Vector((0.0, 2.2, 0.55))}

# ---------- экспорт ----------
def export(name):
    ob = PART[name]
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
    loc = ob.location.copy(); ob.location = (0, 0, 0)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '.glb'), use_selection=True, export_format='GLB', export_apply=True, export_yup=True)
    ob.location = loc
for n in PART: export(n)
# Godot: Y вверх, Z = −Y Blender
def gd(v): return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]
lay = {n: gd(PART[n].location) for n in PART}
dims = {n: gd(PART[n].dimensions) for n in PART}
with open(os.path.join(OUT, 'layout.gd'), 'w') as f:
    f.write('extends RefCounted\n# Места деталей в собранном компьютере (Godot, 1 = 10 см): сделано tools/pc3d/model.py, вручную не править.\n')
    f.write('const POS := ' + json.dumps({n: v for n, v in lay.items()}) + '\n')
    f.write('const SIZE := ' + json.dumps({n: [abs(x) for x in v] for n, v in dims.items()}) + '\n')
    f.write('const PTS := ' + json.dumps({n: gd(v) for n, v in PTS.items()}) + '\n')

# ---------- значки деталей ----------
sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 256
sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 1.2; sc.world = w
bpy.ops.object.light_add(type='SUN', rotation=(0.8, -0.3, 0.6)); bpy.context.active_object.data.energy = 3.5
bpy.ops.object.light_add(type='AREA', location=(-6, -6, 8)); bpy.context.active_object.data.energy = 900
bpy.ops.object.camera_add(); cam = bpy.context.active_object; sc.camera = cam; cam.data.type = 'ORTHO'
for n, ob in PART.items():
    for o2 in PART.values(): o2.hide_render = o2 is not ob
    d = max(ob.dimensions); c = ob.location
    cam.data.ortho_scale = d * 1.35
    cam.location = c + Vector((-1, -1, 0.8)).normalized() * (d * 4 + 2)
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, 'icon_' + n + '.png')
    bpy.ops.render.render(write_still=True)
# ---------- обложка: собранный компьютер ----------
for o2 in PART.values(): o2.hide_render = o2.name in ('keyboard', 'mouse', 'monitor')
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -0.01)); fl = bpy.context.active_object; fl.data.materials.append(mat('floor', hexc('2a2030'), 0.2, 0.4))
cam.data.type = 'PERSP'; cam.data.lens = 40
cam.location = Vector((-7.0, -4.6, 4.4)); cam.rotation_euler = (Vector((0.3, 0.5, 2.3)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.light_add(type='AREA', location=(-5, -2, 5)); al = bpy.context.active_object; al.data.energy = 1500; al.data.size = 4; al.rotation_euler = (Vector((0, 0.5, 2.3)) - al.location).to_track_quat('-Z', 'Y').to_euler()
sc.render.film_transparent = False
w.node_tree.nodes['Background'].inputs[0].default_value = (*hexc('141a2e'), 1)
bpy.ops.object.light_add(type='POINT', location=(-0.4, 0.5, 3.0)); pl = bpy.context.active_object; pl.data.energy = 120; pl.data.color = (0.55, 0.45, 1.0)
for nm, (rx, ry) in {'cover_pc3d': (640, 360), 'cover_pc3d_sq': (420, 420)}.items():
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    sc.render.filepath = os.path.join(OUT, nm + '.png'); bpy.ops.render.render(write_still=True)
print('PC3D OK', len(PART), 'деталей')
