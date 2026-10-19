extends "res://arcade/game.gd"
# «Двоичный десант»: вирусы падают с числами; набери число переключателями битов и стреляй.

var n := 4
var bits: Array = []
var foes: Array = []
var spawn_in := 0.0
var cooldown := 0.0
var beam := {}
var star_field: Array = []
var kills := 0

func setup() -> void:
	n = Logic.BITS[grade]
	title = "Двоичный десант"
	unit = "вирусов"
	var what: String = {6: "Вирусы несут числа от 1 до 15.", 7: "Вирусы несут числа от 1 до 63.", 8: "Вирусы несут числа от 1 до 255.", 9: "Числа записаны в восьмеричной и шестнадцатеричной системах.", 10: "Отрицательные числа набирай в дополнительном коде (8 бит).", 11: "На вирусах — поразрядные операции: И, ИЛИ, ⊕, сдвиг, НЕ (8 бит)."}[grade]
	rules = [what, "Клавиши 1–%d переключают биты. У каждого бита свой вес." % n, "Набери число вируса и нажми ПРОБЕЛ — пушка выстрелит.", "Три вируса у щита — этап придётся начать заново."]
	for i in 90:
		star_field.append([rng.randf() * W, rng.randf() * H, rng.randf_range(0.3, 1.0)])
	reset()

func setup_stage() -> void:
	goal = 10 + 2 * stage

func reset() -> void:
	bits = []
	for i in n:
		bits.append(false)
	foes.clear()
	kills = 0
	spawn_in = 0.6
	cooldown = 0.0
	beam = {}

func _slot(i: int) -> Rect2:
	var w := 96.0 if n <= 6 else 84.0
	var x0 := (W - n * w) / 2.0
	return Rect2(x0 + i * w + 5, 596, w - 10, 78)

func _toggle(i: int) -> void:
	if i >= 0 and i < n:
		bits[i] = not bits[i]
		sfx.emit("click")
		if bits[i]:
			burst(_slot(i).get_center(), Color("ffd34d"), 6, 160.0)

func key(k: int) -> void:
	if k >= KEY_1 and k <= KEY_8:
		_toggle(k - KEY_1)
	elif k >= KEY_KP_1 and k <= KEY_KP_8:
		_toggle(k - KEY_KP_1)
	elif k == KEY_SPACE or k == KEY_ENTER or k == KEY_KP_ENTER:
		fire()
	elif k == KEY_BACKSPACE or k == KEY_0 or k == KEY_KP_0:
		for i in n:
			bits[i] = false

func click(p: Vector2) -> void:
	for i in n:
		if _slot(i).has_point(p):
			_toggle(i)
			return
	if p.y < 560:
		fire()

func fire() -> void:
	if cooldown > 0.0:
		return
	var v := Logic.bits_value(bits)
	var hit := -1
	for i in foes.size():
		if foes[i]["value"] == v and (hit < 0 or foes[i]["y"] > foes[hit]["y"]):
			hit = i
	if hit < 0:
		cooldown = 0.5
		flash = 0.15
		beam = {"to": Vector2(640, 90), "life": 0.12, "bad": true}
		sfx.emit("error")
		return
	var f: Dictionary = foes[hit]
	beam = {"to": Vector2(f["x"], f["y"]), "life": 0.18, "bad": false}
	burst(Vector2(f["x"], f["y"]), f["color"], 26, 420.0)
	burst(Vector2(f["x"], f["y"]), Color("ffd34d"), 10, 300.0, "p_star", 34.0)
	foes.remove_at(hit)
	kills += 1
	for i in n:
		bits[i] = false
	sfx.emit("deliver")
	add_score(1)

func _spawn() -> void:
	var t := {}
	for attempt in 40:
		t = Logic.target(grade, rng)
		var dup := false
		for f in foes:
			if f["value"] == t["value"]:
				dup = true
		if not dup:
			break
	var lanes := [200.0, 420.0, 640.0, 860.0, 1080.0]
	var used := []
	for f in foes:
		used.append(f["x"])
	var free := lanes.filter(func(x): return not used.has(x))
	var x: float = free[rng.randi() % free.size()] if not free.is_empty() else lanes[rng.randi() % lanes.size()]
	var speed: float = 470.0 / (Logic.FALL[grade] * (1.0 - 0.035 * (stage - 1)) * maxf(0.75, pow(0.985, kills)))
	foes.append({"x": x, "y": 70.0, "label": t["label"], "value": t["value"], "speed": speed, "spin": rng.randf() * TAU, "color": Color.from_hsv(rng.randf(), 0.65, 1.0)})

func tick(delta: float) -> void:
	cooldown = maxf(0.0, cooldown - delta)
	if not beam.is_empty():
		beam["life"] -= delta
		if beam["life"] <= 0.0:
			beam = {}
	var cap := 1 if stage <= 2 else (2 if stage <= 5 else 3)
	var max_foes := mini(cap, 1 + kills / 4)
	spawn_in -= delta
	if foes.size() < max_foes and spawn_in <= 0.0:
		_spawn()
		spawn_in = 2.2 if kills < 10 else 1.5
	for f in foes.duplicate():
		f["y"] += f["speed"] * delta
		if f["y"] >= 540.0:
			foes.erase(f)
			lose_life(Vector2(f["x"], 540.0))

func debug() -> Dictionary:
	var out := []
	for f in foes:
		out.append({"value": f["value"], "label": f["label"], "y": int(f["y"])})
	return {"bits": n, "now": Logic.bits_value(bits), "foes": out}

func draw_game() -> void:
	backdrop(Color("0b1030"), Color("241445"))
	for s in star_field:
		var y := fmod(s[1] + time * 14.0 * s[2], H)
		draw_circle(Vector2(s[0], y), 1.6 * s[2], Color(1, 1, 1, 0.25 + 0.5 * s[2]))
	# Щит, до которого нельзя допускать вирусы.
	draw_rect(Rect2(0, 548, W, 5), Color(0.3, 0.9, 1.0, 0.5 + 0.2 * sin(time * 5.0)))
	draw_rect(Rect2(0, 553, W, H - 553), Color("10172e"))
	for f in foes:
		var c := Vector2(f["x"], f["y"])
		var col: Color = f["color"]
		var danger: bool = f["y"] > 400.0
		# Вирус-картинка: вид зависит от цвета врага, он покачивается и пульсирует.
		var vt: Texture2D = tex[["ar_virus_a", "ar_virus_b", "ar_virus_c"][int(col.h * 97.0) % 3]]
		var vs := 104.0 + 5.0 * sin(time * 5.0 + f["spin"])
		draw_set_transform(c, 0.12 * sin(time * 2.0 + f["spin"]), Vector2.ONE)
		draw_texture_rect(vt, Rect2(-vs / 2.0, -vs / 2.0, vs, vs * vt.get_height() / vt.get_width()), false, Color(1.25, 0.9, 0.9) if danger else Color.WHITE)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		var size := 30 if f["label"].length() <= 3 else (22 if f["label"].length() <= 6 else 17)
		var plate := Rect2(c.x - 84, c.y + 44, 168, 40)
		rr(plate, Color("fff6dc") if not danger else Color("ffd0c8"), 12, Color("10162b"), 3)
		draw_string(font_b, Vector2(plate.position.x, plate.position.y + 20 + size * 0.36), f["label"], HORIZONTAL_ALIGNMENT_CENTER, 168, size, Color("10162b"))
	# Пушка и луч.
	var base := Vector2(640, 548)
	if not beam.is_empty():
		var bc := Color("ff5a4a") if beam["bad"] else Color("7df9ff")
		draw_line(base - Vector2(0, 40), beam["to"], Color(bc.r, bc.g, bc.b, 0.35), 16.0)
		draw_line(base - Vector2(0, 40), beam["to"], Color.WHITE, 5.0)
	var ct: Texture2D = tex["ar_cannon"]
	draw_texture_rect(ct, Rect2(base.x - 46.0, base.y - 92.0 * ct.get_height() / ct.get_width() + 8.0, 92.0, 92.0 * ct.get_height() / ct.get_width()), false)
	# Панель битов.
	var v := Logic.bits_value(bits)
	for i in n:
		var r := _slot(i)
		var on: bool = bits[i]
		rr(r.grow(3), Color("0b0f1c"), 16)
		rr(r, Color("3a2c0c") if on else Color("1b2440"), 14)
		rr(Rect2(r.position, Vector2(r.size.x, r.size.y * 0.5)), Color(1, 1, 1, 0.06), 14)
		var ctr := r.get_center() - Vector2(0, 6)
		draw_circle(ctr, 21, Color("0b0f1c"))
		draw_circle(ctr, 17, Color("ffd34d") if on else Color("38425f"))
		draw_circle(ctr - Vector2(5, 5), 5, Color(1, 1, 1, 0.8 if on else 0.15))
		text("1" if on else "0", ctr + Vector2(0, 1), 20, Color("3a2c0c") if on else Color("8794b8"))
		text(str(1 << (n - 1 - i)), Vector2(r.get_center().x, 580), 18, GOLD if on else MUTED)
		text("клавиша %d" % (i + 1), Vector2(r.get_center().x, r.end.y - 9), 11, MUTED, false)
	if grade <= 7:
		text("сейчас набрано: %d" % v, Vector2(1130, 692), 17, GOLD, false)
	text("ПРОБЕЛ — огонь · 0 — сбросить биты", Vector2(190, 692), 14, MUTED, false)

func draw_lights(ci: CanvasItem) -> void:
	for f in foes:
		glow(ci, Vector2(f["x"], f["y"]), 190.0, Color(f["color"].r, f["color"].g, f["color"].b, 0.3))
	for i in n:
		if bits[i]:
			glow(ci, _slot(i).get_center() - Vector2(0, 6), 130.0, Color(1.0, 0.75, 0.2, 0.55))
	if not beam.is_empty() and not beam["bad"]:
		glow(ci, beam["to"], 260.0, Color(0.5, 0.95, 1.0, 0.8), "p_flare")
	glow(ci, Vector2(640, 510), 120.0, Color(0.2, 0.9, 0.75, 0.35))
