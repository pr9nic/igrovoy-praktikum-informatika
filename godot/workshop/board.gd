extends Node2D
# Поле склада: рисует карту и проигрывает события исполнителя (sim.gd).

signal sfx(name: String)

const Levels = preload("res://levels.gd")

const TEX := ["robot", "floor", "floor_mark", "wall", "dark", "bin_red", "bin_blue", "bin_green", "crate_red", "crate_blue", "crate_green", "crate_unknown", "p_light", "p_flare", "p_spark", "p_smoke", "p_star", "p_circle"]
const BIN_COLORS := {"red": Color("ff5a4a"), "blue": Color("4aa8ff"), "green": Color("4ae08a")}
const DIRS := [Vector2(1, 0), Vector2(0, 1), Vector2(-1, 0), Vector2(0, -1)]
const EYE := Color("7df9ff")

var area := Vector2(788, 470)
var font: Font
var world: Dictionary = {}
var hidden_queue := false
var cell := 64.0
var origin := Vector2.ZERO
var rpos := Vector2.ZERO
var rang := 0.0
var tpos := Vector2.ZERO
var tang := 0.0
var carry := ""
var carry_pop := 1.0
var eye := EYE
var shake := 0.0
var glow := 0.0
var time := 0.0
var fx: Array = []
var tex := {}
var box := StyleBoxFlat.new()
var tw: Tween
var labels: Dictionary = {}
var kind := "store"
var flag := false
var mem := 0
var flash := {}
var tint := Color.WHITE
var parts: Array = []
var tread := 0.0
var last_rpos := Vector2.ZERO
var vignette: GradientTexture2D
var glow_layer: Node2D

# Слой свечения: всё, что на нём нарисовано, складывается с картинкой (свет ламп, искры, фары).
class GlowLayer extends Node2D:
	var board: Node2D
	func _draw() -> void:
		board.draw_glow(self)

func _ready() -> void:
	for n in TEX:
		tex[n] = load("res://assets/%s.png" % n)
	# Мягкое пятно света для свечения (спрайт p_light — кольцо, для ламп и фар он не годится).
	var sg := Gradient.new()
	sg.set_color(0, Color(1, 1, 1, 1))
	sg.set_color(1, Color(1, 1, 1, 0))
	var soft := GradientTexture2D.new()
	soft.gradient = sg
	soft.fill = GradientTexture2D.FILL_RADIAL
	soft.fill_from = Vector2(0.5, 0.5)
	soft.fill_to = Vector2(1.0, 0.5)
	soft.width = 128
	soft.height = 128
	tex["soft"] = soft
	var g := Gradient.new()
	g.set_color(0, Color(0, 0, 0, 0))
	g.set_color(1, Color(0.02, 0.03, 0.08, 0.6))
	g.set_offset(0, 0.45)
	vignette = GradientTexture2D.new()
	vignette.gradient = g
	vignette.fill = GradientTexture2D.FILL_RADIAL
	vignette.fill_from = Vector2(0.5, 0.5)
	vignette.fill_to = Vector2(1.0, 1.0)
	vignette.width = 128
	vignette.height = 128
	glow_layer = GlowLayer.new()
	glow_layer.board = self
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	glow_layer.material = m
	add_child(glow_layer)

func set_world(w: Dictionary, hide: bool) -> void:
	if tw:
		tw.kill()
	world = w
	hidden_queue = hide
	kind = w["kind"]
	flag = false
	mem = int(w.get("mem", 0))
	flash.clear()
	cell = minf(floorf(minf(area.x / w["w"], area.y / w["h"])), 104.0)
	origin = ((area - Vector2(w["w"], w["h"]) * cell) / 2.0).floor()
	tpos = Vector2(w["pos"])
	tang = w["dir"] * PI / 2.0
	rpos = tpos
	rang = tang
	carry = w["carry"]
	carry_pop = 1.0
	eye = EYE
	shake = 0.0
	glow = 0.0
	fx.clear()
	parts.clear()
	last_rpos = rpos
	queue_redraw()

func _process(delta: float) -> void:
	time += delta
	shake = maxf(0.0, shake - delta * 2.5)
	glow = maxf(0.0, glow - delta)
	for key in flash.keys():
		flash[key] -= delta
		if flash[key] <= 0.0:
			flash.erase(key)
	tread += (rpos - last_rpos).length()
	last_rpos = rpos
	for q in parts.duplicate():
		q["life"] -= delta
		q["pos"] += q["vel"] * delta
		q["vel"] *= 1.0 - 2.5 * delta
		if q["life"] <= 0.0:
			parts.erase(q)
	if glow_layer:
		glow_layer.queue_redraw()
	for f in fx.duplicate():
		f["life"] -= delta
		if f["life"] <= 0.0:
			fx.erase(f)
	queue_redraw()

func _center(p: Vector2) -> Vector2:
	return origin + (p + Vector2(0.5, 0.5)) * cell

func burst(at: Vector2, color: Color, count: int = 10, speed: float = 1.6, tex_name: String = "p_spark", add: bool = true) -> void:
	# Разлёт частиц из точки (в пикселях поля); скорость — в клетках в секунду.
	if parts.size() > 140:
		return
	for i in count:
		var a := randf() * TAU
		parts.append({"tex": tex_name, "pos": at, "vel": Vector2(cos(a), sin(a)) * cell * speed * randf_range(0.4, 1.0), "life": randf_range(0.35, 0.7), "max": 0.7, "size": cell * randf_range(0.18, 0.34), "color": color, "add": add})

func _float(text: String, at: Vector2, color: Color) -> void:
	fx.append({"text": text, "at": at, "color": color, "life": 1.1, "max": 1.1})

func play(ev: Dictionary, d: float) -> void:
	if tw:
		tw.kill()
	rpos = tpos
	rang = tang
	carry_pop = 1.0
	var t: String = ev["t"]
	if t == "fwd":
		tpos = Vector2(ev["to"])
		tw = create_tween()
		tw.tween_property(self, "rpos", tpos, d).set_trans(Tween.TRANS_SINE)
		burst(_center(rpos) + Vector2(0, cell * 0.2), Color(0.8, 0.85, 0.9, 0.5), 3, 0.5, "p_smoke", false)
		sfx.emit("step")
	elif t == "left" or t == "right":
		tang += PI / 2.0 if t == "right" else -PI / 2.0
		tw = create_tween()
		tw.tween_property(self, "rang", tang, d).set_trans(Tween.TRANS_SINE)
		sfx.emit("turn")
	elif t == "take":
		var at: Vector2i = ev["at"]
		if world["disp"].has(at):
			world["disp"][at].pop_front()
		else:
			world["boxes"].erase(at)
		carry = ev["color"]
		carry_pop = 0.3
		tw = create_tween()
		tw.tween_property(self, "carry_pop", 1.0, d).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		sfx.emit("take")
	elif t == "put":
		var at: Vector2i = ev["at"]
		carry = ""
		if ev["bin"]:
			world["bins"][at]["count"] += 1
			_float("+1", _center(Vector2(at)), Color("b6ff6a"))
			burst(_center(Vector2(at)), BIN_COLORS[ev["color"]], 14)
			sfx.emit("deliver")
		else:
			world["boxes"][at] = ev["color"]
			sfx.emit("drop")
	elif t == "check":
		_float("%s %s" % [Levels.COND_SHORT.get(ev["cond"], "?"), "да" if ev["res"] else "нет"], _center(tpos) + (Vector2(0, cell * 1.75) if kind == "array" else Vector2(0, -cell * 0.45)), Color("ffe36a") if ev["res"] else Color("c9d2e3"))
	elif t == "lamp":
		world["lamps"][ev["at"]] = ev["on"]
		flash[ev["at"]] = 0.35
		if ev["on"]:
			burst(_center(Vector2(ev["at"])), Color("ffd34d"), 8, 1.2)
		sfx.emit("take" if ev["on"] else "drop")
	elif t == "flag":
		flag = ev["on"]
		_float("флажок поднят" if flag else "флажок опущен", _center(tpos) - Vector2(0, cell * 0.5), Color("ff8fa3"))
		sfx.emit("turn")
	elif t == "step":
		world["i"] = ev["to"]
		tpos = Vector2(ev["to"] + 1, 2)
		tw = create_tween()
		tw.tween_property(self, "rpos", tpos, d).set_trans(Tween.TRANS_SINE)
		sfx.emit("step")
	elif t == "mem":
		mem = ev["mem"]
		flash["mem"] = 0.4
		sfx.emit("take")
	elif t == "write":
		if ev["at"] == world["n"]:
			world["out"] = ev["val"]
		else:
			world["arr"][ev["at"]] = ev["val"]
		flash[ev["at"]] = 0.4
		burst(origin + Vector2(ev["at"] + 1.5, 1.5) * cell, Color("ffd34d"), 8, 1.2)
		sfx.emit("drop")
	elif t == "swap":
		var i: int = ev["at"]
		var v = world["arr"][i]
		world["arr"][i] = world["arr"][i + 1]
		world["arr"][i + 1] = v
		flash[i] = 0.4
		flash[i + 1] = 0.4
		burst(origin + Vector2(i + 2.0, 1.5) * cell, Color("7df9ff"), 10, 1.3)
		sfx.emit("turn")
	elif t == "mark":
		world["mark"] = ev["at"]
		sfx.emit("deliver")
	elif t == "bump":
		var dir: Vector2 = DIRS[posmod(roundi(tang / (PI / 2.0)), 4)]
		tw = create_tween()
		tw.tween_property(self, "rpos", tpos + dir * 0.28, d * 0.3)
		tw.tween_property(self, "rpos", tpos, d * 0.5).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
		eye = Color("ff5a5a")
		shake = 1.0
		burst(_center(tpos) + dir * cell * 0.5, Color("ff6a4a"), 12, 1.8)
		burst(_center(tpos) + dir * cell * 0.4, Color(0.6, 0.6, 0.65, 0.6), 5, 0.7, "p_smoke", false)
		sfx.emit("error")
	elif t == "fail":
		eye = Color("ff5a5a")
		shake = 0.6
		sfx.emit("error")
	elif t == "done":
		glow = 1.0
		burst(_center(tpos), Color("ffd34d"), 26, 2.6, "p_star")
		for i in 8:
			_float("★", _center(tpos) + Vector2(randf_range(-1.2, 1.2), randf_range(-0.9, 0.3)) * cell, Color("ffd34d"))
		sfx.emit("win")

func _rr(r: Rect2, color: Color, radius: float) -> void:
	box.bg_color = color
	box.set_corner_radius_all(int(radius))
	draw_style_box(box, r)

func _text(text: String, center: Vector2, size: int, color: Color) -> void:
	var w := 400.0
	var p := center + Vector2(-w / 2.0, size * 0.36)
	draw_string_outline(font, p, text, HORIZONTAL_ALIGNMENT_CENTER, w, size, maxi(4, size / 4), Color("10162b"))
	draw_string(font, p, text, HORIZONTAL_ALIGNMENT_CENTER, w, size, color)

func _shadow(center: Vector2, size: Vector2, radius: float) -> void:
	_rr(Rect2(center - size / 2.0 + Vector2(cell * 0.05, cell * 0.09), size), Color(0, 0, 0, 0.3), radius)

func _crate(name: String, center: Vector2, k: float) -> void:
	var s := Vector2(cell, cell) * k
	_shadow(center, s, cell * 0.12)
	draw_texture_rect(tex[name], Rect2(center - s / 2.0, s), false)

func _is_wall(p: Vector2i) -> bool:
	return world["walls"].has(p)

func _draw() -> void:
	if world.is_empty():
		return
	var c := cell
	var off := Vector2.ZERO
	if shake > 0.0:
		off = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * shake * 5.0
	draw_set_transform(off, 0.0, Vector2.ONE)
	if kind == "array":
		_draw_array()
	for y in (world["h"] if kind != "array" else 0):
		for x in world["w"]:
			var p := Vector2i(x, y)
			var r := Rect2(origin + Vector2(x, y) * c, Vector2(c, c))
			if _is_wall(p):
				# Рисуем только стены вокруг прохода, остальное — тёмный фон цеха.
				var near := false
				for dy in [-1, 0, 1]:
					for dx in [-1, 0, 1]:
						var q := p + Vector2i(dx, dy)
						if q.x >= 0 and q.y >= 0 and q.x < world["w"] and q.y < world["h"] and not _is_wall(q):
							near = true
				if near:
					draw_texture_rect(tex["wall"], r, false, tint.lerp(Color.WHITE, 0.5))
				continue
			draw_texture_rect(tex["floor"], r, false, tint)
			# Мягкие тени от стен сверху и слева придают полу глубину.
			if _is_wall(p + Vector2i(0, -1)):
				for k in 4:
					draw_rect(Rect2(r.position, Vector2(c, c * 0.06 * (k + 1))), Color(0, 0, 0, 0.09))
			if _is_wall(p + Vector2i(-1, 0)):
				for k in 3:
					draw_rect(Rect2(r.position, Vector2(c * 0.05 * (k + 1), c)), Color(0, 0, 0, 0.07))
			if p == world["pos"]:
				draw_texture_rect(tex["floor_mark"], r, false, Color(1, 1, 1, 0.8))
	for p in world["bins"]:
		var bin: Dictionary = world["bins"][p]
		var r := Rect2(origin + Vector2(p) * c, Vector2(c, c))
		draw_texture_rect(tex["bin_" + bin["color"]], r, false)
		var bc: Color = BIN_COLORS[bin["color"]]
		draw_rect(r.grow(-c * 0.07), Color(bc.r, bc.g, bc.b, 0.55 + 0.25 * sin(time * 3.0)), false, maxf(2.0, c * 0.035))
		if bin["count"] > 0:
			_text("×%d" % bin["count"], r.position + Vector2(c * 0.74, c * 0.8), int(c * 0.24), Color.WHITE)
	for p in world["disp"]:
		var q: Array = world["disp"][p]
		var r := Rect2(origin + Vector2(p) * c, Vector2(c, c))
		draw_texture_rect(tex["dark"], r, false)
		# Бегущие полосы ленты выдачи.
		for i in 4:
			var k := fmod(i / 4.0 + time * 0.35, 1.0)
			var yy := r.position.y + c * (0.14 + 0.72 * k)
			draw_line(Vector2(r.position.x + c * 0.16, yy), Vector2(r.position.x + c * 0.84, yy), Color(1, 0.83, 0.3, 0.22 * sin(k * PI)), maxf(2.0, c * 0.03))
		if not q.is_empty():
			_crate("crate_unknown" if hidden_queue else "crate_" + q[0], r.get_center(), 0.62)
			if hidden_queue:
				_text("?", r.get_center(), int(c * 0.34), Color("ffe36a"))
			_text("×%d" % q.size(), r.position + Vector2(c * 0.76, c * 0.82), int(c * 0.22), Color.WHITE)
		_text("ВЫДАЧА", r.position + Vector2(c * 0.5, c * 0.12), int(c * 0.14), Color("9fb2d6"))
	for p in world["lamps"]:
		var r := Rect2(origin + Vector2(p) * c, Vector2(c, c))
		var lit: bool = world["lamps"][p]
		var unknown: bool = hidden_queue and world["inputs"].has(p)
		draw_texture_rect(tex["dark"], r, false)
		var k: float = 1.0 + flash.get(p, 0.0) * 0.8
		var ctr := r.get_center()
		# Патрон лампы и стеклянная колба с бликом.
		draw_circle(ctr, c * 0.33, Color("1b2133"))
		draw_arc(ctr, c * 0.33, 0.0, TAU, 40, Color("5b678a"), maxf(2.0, c * 0.035))
		if lit and not unknown:
			draw_circle(ctr, c * 0.26 * k, Color("ffb21a"))
			draw_circle(ctr, c * 0.2 * k, Color("ffd34d"))
			draw_circle(ctr, c * 0.11 * k, Color("fff3b8"))
			draw_circle(ctr - Vector2(c, c) * 0.09, c * 0.05, Color(1, 1, 1, 0.9))
		else:
			draw_circle(ctr, c * 0.26 * k, Color("2c3550"))
			draw_circle(ctr, c * 0.19 * k, Color("38425f"))
			draw_circle(ctr - Vector2(c, c) * 0.09, c * 0.045, Color(1, 1, 1, 0.18))
			if unknown:
				_text("?", ctr, int(c * 0.3), Color("ffe36a"))
	if labels.has("rows"):
		for name in labels["rows"]:
			_text(name, origin + Vector2(0.5, float(labels["rows"][name]) + 0.5) * c, int(c * 0.34), Color("ffe36a"))
	if labels.has("cols"):
		var lc: Dictionary = labels["cols"]
		for i in lc["text"].size():
			_text(lc["text"][i], origin + Vector2(float(lc["x"]) + i + 0.5, float(lc["y"]) + 0.62) * c, int(c * 0.26), Color("ffe36a"))
	for p in world["boxes"]:
		_crate("crate_" + world["boxes"][p], _center(Vector2(p)), 0.76)
	for q in parts:
		if not q["add"]:
			_part(self, q)
	_draw_robot(off)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	draw_texture_rect(vignette, Rect2(Vector2(-4, -4), area + Vector2(8, 8)), false)
	draw_set_transform(off, 0.0, Vector2.ONE)
	for f in fx:
		var k: float = 1.0 - f["life"] / f["max"]
		var col: Color = f["color"]
		col.a = clampf(2.0 - k * 2.0, 0.0, 1.0)
		var size := int(c * 0.2) if f["text"].length() > 2 else int(c * 0.34)
		draw_string_outline(font, f["at"] + Vector2(-200, -k * c * 0.5), f["text"], HORIZONTAL_ALIGNMENT_CENTER, 400, size, 5, Color(0.06, 0.09, 0.17, col.a))
		draw_string(font, f["at"] + Vector2(-200, -k * c * 0.5), f["text"], HORIZONTAL_ALIGNMENT_CENTER, 400, size, col)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _part(ci: CanvasItem, q: Dictionary) -> void:
	var k: float = clampf(q["life"] / q["max"], 0.0, 1.0)
	var size: float = q["size"] * (0.6 + (1.0 - k) * 0.9)
	var col: Color = q["color"]
	col.a *= k
	ci.draw_texture_rect(tex[q["tex"]], Rect2(q["pos"] - Vector2(size, size) / 2.0, Vector2(size, size)), false, col)

func _glow(ci: CanvasItem, at: Vector2, size: float, color: Color, name: String = "soft") -> void:
	ci.draw_texture_rect(tex[name], Rect2(at - Vector2(size, size) / 2.0, Vector2(size, size)), false, color)

func draw_glow(ci: CanvasItem) -> void:
	if world.is_empty():
		return
	var c := cell
	for p in world["lamps"]:
		if world["lamps"][p] and not (hidden_queue and world["inputs"].has(p)):
			_glow(ci, _center(Vector2(p)), c * (1.9 + 0.08 * sin(time * 5.0 + p.x)), Color(1.0, 0.72, 0.2, 0.5))
	for p in world["bins"]:
		var bc: Color = BIN_COLORS[world["bins"][p]["color"]]
		_glow(ci, _center(Vector2(p)), c * 1.5, Color(bc.r, bc.g, bc.b, 0.16 + 0.08 * sin(time * 3.0)))
	for p in world["disp"]:
		_glow(ci, _center(Vector2(p)), c * 1.4, Color(1.0, 0.8, 0.3, 0.1))
	if kind == "array":
		# Луч от робота к ячейке, с которой он работает.
		var at := origin + Vector2(rpos.x + 0.5, 1.5) * c
		_glow(ci, at, c * 1.7, Color(0.4, 0.9, 1.0, 0.22))
		_glow(ci, origin + Vector2(world["n"] + 1.5, 1.5) * c, c * 1.6, Color(1.0, 0.8, 0.3, 0.14 + 0.06 * sin(time * 3.0)))
	# Фары и глаза робота.
	var center := _center(rpos)
	var fwd := Vector2(cos(rang), sin(rang))
	_glow(ci, center + fwd * c * 0.62, c * 1.5, Color(0.6, 0.95, 1.0, 0.16))
	_glow(ci, center + fwd * c * 0.1, c * 0.6, Color(eye.r, eye.g, eye.b, 0.5))
	if glow > 0.0:
		ci.draw_set_transform(center, time * 1.5, Vector2.ONE)
		_glow(ci, Vector2.ZERO, c * (2.0 + (1.0 - glow) * 2.5), Color(1.0, 0.8, 0.3, glow * 0.7), "p_flare")
		ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	for q in parts:
		if q["add"]:
			_part(ci, q)

func _draw_array() -> void:
	# Стеллаж: рамка, ячейки с числами, ячейка вывода; робот ездит по дорожке под ним.
	var c := cell
	var n: int = world["n"]
	for x in world["w"]:
		var idx: int = x - 1
		var top := Rect2(origin + Vector2(x, 1) * c, Vector2(c, c))
		var lane := Rect2(origin + Vector2(x, 2) * c, Vector2(c, c))
		draw_texture_rect(tex["floor"], lane, false, tint)
		for k in 4:
			draw_rect(Rect2(lane.position, Vector2(c, c * 0.06 * (k + 1))), Color(0, 0, 0, 0.09))
		if idx < 0:
			draw_texture_rect(tex["wall"], top, false, tint.lerp(Color.WHITE, 0.5))
			continue
		draw_texture_rect(tex["dark"], top, false)
		var plate := top.grow(-c * 0.11)
		var here: bool = absf(rpos.x - x) < 0.5
		if idx == n:
			_rr(plate, Color("2a2413"), c * 0.08)
			draw_rect(top.grow(-c * 0.06), Color("ffd34d"), false, maxf(2.0, c * 0.04))
			_text("ВЫВОД", origin + Vector2(x + 0.5, 0.72) * c, int(c * 0.17), Color("ffd34d"))
			if world["out"] != null:
				_text(str(world["out"]), top.get_center(), int(c * 0.34), Color("ffd34d"))
		else:
			# Табличка с числом: светлеет, когда робот стоит у ячейки.
			_rr(plate, Color("263352") if here else Color("1c2439"), c * 0.08)
			_rr(Rect2(plate.position, Vector2(plate.size.x, plate.size.y * 0.5)), Color(1, 1, 1, 0.05), c * 0.08)
			_text(str(idx + 1), origin + Vector2(x + 0.5, 0.74) * c, int(c * 0.16), Color("6f7fa3"))
			_text("?" if hidden_queue else str(world["arr"][idx]), top.get_center(), int(c * 0.36), Color.WHITE)
			if world["mark"] == idx:
				_text("★", top.get_center() - Vector2(0, c * 0.34), int(c * 0.26), Color("ffd34d"))
		var k: float = flash.get(idx, 0.0)
		if k > 0.0:
			draw_rect(top.grow(-c * 0.08), Color(1, 0.83, 0.3, minf(1.0, k * 2.5)), false, c * 0.06)
	var mk: float = flash.get("mem", 0.0)
	var mp := origin + Vector2(rpos.x + 0.5, 3.3) * c
	var mr := Rect2(mp - Vector2(c * 0.66, c * 0.22), Vector2(c * 1.32, c * 0.44))
	_rr(mr.grow(c * 0.03), Color("7df9ff").darkened(0.5), c * 0.12)
	_rr(mr, Color("0e1626").lerp(Color("5a4a1a"), minf(1.0, mk * 2.5)), c * 0.1)
	_text("память: %s" % ("?" if hidden_queue and world["goal"] == "find" else str(mem)), mp, int(c * 0.18), Color("7df9ff"))

func _draw_robot(off: Vector2) -> void:
	var c := cell
	var center := _center(rpos) + off
	draw_set_transform(center + Vector2(c * 0.04, c * 0.08), 0.0, Vector2(1.0, 0.85))
	draw_circle(Vector2.ZERO, c * 0.42, Color(0, 0, 0, 0.28))
	draw_set_transform(center, rang, Vector2.ONE)
	if tex.has("robot"):
		# Робот-картинка (нарисован нейросетью, смотрит вправо); флажок и груз рисуются поверх, как раньше.
		var rw := c * 0.98
		var rh: float = rw * tex["robot"].get_height() / tex["robot"].get_width()
		draw_texture_rect(tex["robot"], Rect2(-rw / 2.0, -rh / 2.0, rw, rh), false)
		if flag:
			draw_line(Vector2(-0.2 * c, 0), Vector2(-0.2 * c, -0.42 * c), Color("e8eefb"), maxf(2.0, c * 0.03))
			draw_colored_polygon(PackedVector2Array([Vector2(-0.2 * c, -0.42 * c), Vector2(0.04 * c, -0.34 * c), Vector2(-0.2 * c, -0.26 * c)]), Color("ff5a7a"))
		if carry != "":
			var sz2 := Vector2(c, c) * 0.5 * carry_pop
			draw_texture_rect(tex["crate_" + carry], Rect2(Vector2(0.5 * c, 0) - sz2 / 2.0, sz2), false)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		return
	for s in [-1.0, 1.0]:
		_rr(Rect2(-0.37 * c, s * 0.3 * c - 0.1 * c, 0.7 * c, 0.2 * c), Color("1a1f2e"), 0.07 * c)
		_rr(Rect2(-0.36 * c, s * 0.3 * c - 0.085 * c, 0.68 * c, 0.17 * c), Color("2a3044"), 0.06 * c)
		# Траки гусениц «едут» вместе с роботом.
		var shift := fmod(tread * c, 0.115 * c)
		for i in 6:
			var x := -0.33 * c + i * 0.115 * c + shift
			if x < 0.3 * c:
				draw_line(Vector2(x, s * 0.3 * c - 0.07 * c), Vector2(x, s * 0.3 * c + 0.07 * c), Color("4a5470"), maxf(2.0, c * 0.028))
		_rr(Rect2(0.2 * c, s * 0.15 * c - 0.035 * c, 0.37 * c, 0.07 * c), Color("8e99b3"), 0.02 * c)
		_rr(Rect2(0.2 * c, s * 0.15 * c - 0.035 * c, 0.37 * c, 0.035 * c), Color("dfe6f5"), 0.02 * c)
	_rr(Rect2(-0.32 * c, -0.27 * c, 0.6 * c, 0.54 * c), Color("0f1524"), 0.14 * c)
	_rr(Rect2(-0.29 * c, -0.24 * c, 0.54 * c, 0.48 * c), Color("1fae93"), 0.12 * c)
	_rr(Rect2(-0.29 * c, -0.24 * c, 0.54 * c, 0.3 * c), Color("33d6b6"), 0.12 * c)
	_rr(Rect2(-0.25 * c, -0.21 * c, 0.44 * c, 0.07 * c), Color(1, 1, 1, 0.28), 0.04 * c)
	_rr(Rect2(-0.24 * c, -0.13 * c, 0.21 * c, 0.3 * c), Color("17907a"), 0.06 * c)
	draw_circle(Vector2(-0.135 * c, 0.02 * c), 0.05 * c, Color("0f1524"))
	draw_circle(Vector2(-0.135 * c, 0.02 * c), 0.035 * c, Color("ffd34d") if fmod(time, 1.2) < 0.9 else Color("a8801a"))
	_rr(Rect2(0.01 * c, -0.18 * c, 0.2 * c, 0.36 * c), Color("0f1524"), 0.08 * c)
	_rr(Rect2(0.03 * c, -0.16 * c, 0.16 * c, 0.1 * c), Color(1, 1, 1, 0.08), 0.05 * c)
	var blink := 1.0 if fmod(time, 3.4) > 0.14 else 0.2
	for s in [-1.0, 1.0]:
		draw_circle(Vector2(0.115 * c, s * 0.085 * c), 0.058 * c, Color(eye.r, eye.g, eye.b, 0.3))
		draw_circle(Vector2(0.115 * c, s * 0.085 * c), 0.036 * c * blink, eye)
		draw_circle(Vector2(0.125 * c, s * 0.085 * c - 0.012 * c), 0.012 * c * blink, Color.WHITE)
	if flag:
		draw_line(Vector2(-0.2 * c, 0), Vector2(-0.2 * c, -0.42 * c), Color("e8eefb"), maxf(2.0, c * 0.03))
		draw_colored_polygon(PackedVector2Array([Vector2(-0.2 * c, -0.42 * c), Vector2(0.04 * c, -0.34 * c), Vector2(-0.2 * c, -0.26 * c)]), Color("ff5a7a"))
	if carry != "":
		var sz := Vector2(c, c) * 0.5 * carry_pop
		draw_rect(Rect2(Vector2(0.53 * c, 0.03 * c) - sz / 2.0, sz), Color(0, 0, 0, 0.25))
		draw_texture_rect(tex["crate_" + carry], Rect2(Vector2(0.5 * c, 0) - sz / 2.0, sz), false)
