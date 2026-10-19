extends Node2D
# Общая основа аркад: состояние, счёт, жизни, частицы, свечение, заставка и экран итога.

signal result(stage: int, stars: int)   # этап пройден
signal leave                            # игрок вышел к списку игр
signal sfx(name: String)

const Logic = preload("res://arcade/logic.gd")
const Fmt = preload("res://arcade/fmt.gd")
const TEX := ["p_light", "p_flare", "p_spark", "p_smoke", "p_star", "p_circle", "floor", "dark", "ar_virus_a", "ar_virus_b", "ar_virus_c", "ar_cannon", "ar_snake_head", "ar_snake_body", "ar_pc", "ar_server", "ar_folder", "ar_file", "ar_courier", "ar_start", "ar_house", "ar_finish", "mt_0", "mt_1", "mt_2", "mt_3", "mt_4", "mt_5", "mt_6", "mt_7"]
const INK := Color("e8eefb")
const MUTED := Color("9fb2d6")
const GOLD := Color("ffd34d")
const W := 1280.0
const H := 720.0

var grade := 6
var font: Font
var font_b: Font
var title := ""
var rules: Array = []
var unit := "очков"
var show_lives := true
# Кампания: игра состоит из этапов, каждый со своей целью и сложностью.
var stage := 1
var stages := 10
var goal := 10
var won := false
var fail_text := ""
var done_stars := {}   # этап → лучшие звёзды; задаёт список игр
var timer_full := 0.0
var timer := -1.0   # обратный отсчёт в секундах; -1 — игра без таймера
var state := "intro"
var score := 0
var lives := 3
var time := 0.0
var shake := 0.0
var flash := 0.0
var parts: Array = []
var tex := {}
var bg_name := ""          # имя фоновой картинки; задаёт меню аркад
var box := StyleBoxFlat.new()
var rng := RandomNumberGenerator.new()
var glow_layer: Node2D

class GlowLayer extends Node2D:
	var game: Node2D
	func _draw() -> void:
		game.draw_glow(self)

func _ready() -> void:
	rng.randomize()
	for n in TEX:
		tex[n] = load("res://assets/%s.png" % n)
	box.anti_aliasing = true
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
	glow_layer = GlowLayer.new()
	glow_layer.game = self
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	glow_layer.material = m
	add_child(glow_layer)
	setup()
	stage = clampi(stage, 1, stages)
	preview()

# Переопределяют игры.
func setup() -> void:
	pass
func setup_stage() -> void:
	pass
func goal_text() -> String:
	return "Цель этапа: %d %s" % [goal, unit]
func progress() -> float:
	return clampf(float(score) / maxf(1.0, goal), 0.0, 1.0)
func progress_text() -> String:
	return "%d / %d" % [score, goal]
func stage_stars() -> int:
	# По умолчанию звёзды — оставшиеся жизни; игры на время считают по остатку времени.
	if timer_full > 0.0:
		var left := timer / timer_full
		return 3 if left >= 0.4 else (2 if left >= 0.15 else 1)
	return clampi(lives, 1, 3)
func reset() -> void:
	pass
func tick(_delta: float) -> void:
	pass
func draw_game() -> void:
	pass
func draw_lights(_ci: CanvasItem) -> void:
	pass
func key(_k: int) -> void:
	pass
func click(_p: Vector2) -> void:
	pass
func debug() -> Dictionary:
	return {}

func preview() -> void:
	# Показать поле выбранного этапа под заставкой.
	setup_stage()
	reset()
	timer = -1.0
	score = 0

func unlocked() -> int:
	var n := 1
	while n < stages and int(done_stars.get(n, 0)) > 0:
		n += 1
	return n

func add_score(n: int) -> void:
	score += n
	if state == "play" and score >= goal:
		stage_won()

func start() -> void:
	score = 0
	lives = 3
	timer = -1.0
	timer_full = 0.0
	won = false
	fail_text = ""
	parts.clear()
	setup_stage()
	reset()
	if timer > 0.0:
		timer_full = timer
	state = "play"
	sfx.emit("click")

func stage_won() -> void:
	if state != "play":
		return
	won = true
	state = "over"
	var st := stage_stars()
	done_stars[stage] = maxi(st, int(done_stars.get(stage, 0)))
	result.emit(stage, st)
	burst(Vector2(640, 300), GOLD, 40, 520.0, "p_star", 36.0)
	sfx.emit("win")

func game_over(why: String = "") -> void:
	if state != "play":
		return
	won = false
	fail_text = why
	state = "over"
	sfx.emit("error")

func lose_life(at: Vector2) -> void:
	lives -= 1
	shake = 1.0
	flash = 0.5
	burst(at, Color("ff5a4a"), 22, 380.0)
	sfx.emit("error")
	if lives <= 0:
		game_over("Жизни закончились.")

func _process(delta: float) -> void:
	time += delta
	shake = maxf(0.0, shake - delta * 2.5)
	flash = maxf(0.0, flash - delta)
	for q in parts.duplicate():
		q["life"] -= delta
		q["pos"] += q["vel"] * delta
		q["vel"] *= 1.0 - 2.2 * delta
		if q["life"] <= 0.0:
			parts.erase(q)
	if state == "play":
		if timer >= 0.0:
			timer -= delta
			if timer <= 0.0:
				timer = 0.0
				game_over("Время вышло.")
		if state == "play":
			tick(delta)
	queue_redraw()
	glow_layer.queue_redraw()

func _input(event: InputEvent) -> void:
	# _input, а не _unhandled_input: иначе щелчки мыши забирает экран-родитель.
	if event is InputEventKey and event.pressed:
		var k: int = event.physical_keycode
		if k == KEY_ESCAPE:
			if not event.echo:
				leave.emit()
		elif state != "play":
			if event.echo:
				pass
			elif k == KEY_SPACE or k == KEY_ENTER or k == KEY_KP_ENTER:
				_continue()
			elif k == KEY_LEFT or k == KEY_A:
				stage = maxi(1, stage - 1)
				state = "intro"
				preview()
			elif k == KEY_RIGHT or k == KEY_D:
				stage = mini(unlocked(), stage + 1)
				state = "intro"
				preview()
		else:
			key(k)
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var p: Vector2 = get_global_transform().affine_inverse() * event.position
		if p.x < 150 and p.y < 60:
			leave.emit()
		elif state != "play":
			_continue()
		else:
			click(p)

func _continue() -> void:
	# После победы — следующий этап, иначе запуск или повтор текущего.
	if state == "over" and won and stage < stages:
		stage += 1
	start()

# ---------- рисование ----------

func rr(r: Rect2, color: Color, radius: float, border: Color = Color(0, 0, 0, 0), bw: int = 0) -> void:
	box.bg_color = color
	box.set_corner_radius_all(int(radius))
	box.border_color = border
	box.set_border_width_all(bw)
	draw_style_box(box, r)

func text(s: String, center: Vector2, size: int, color: Color, bold: bool = true, ci: CanvasItem = self) -> void:
	var f := font_b if bold else font
	var w := 1200.0
	var p := center + Vector2(-w / 2.0, size * 0.36)
	ci.draw_string_outline(f, p, s, HORIZONTAL_ALIGNMENT_CENTER, w, size, maxi(4, size / 4), Color(0.05, 0.07, 0.14, color.a))
	ci.draw_string(f, p, s, HORIZONTAL_ALIGNMENT_CENTER, w, size, color)

func burst(at: Vector2, color: Color, count: int = 12, speed: float = 260.0, tex_name: String = "p_spark", size: float = 26.0) -> void:
	if parts.size() > 220:
		return
	for i in count:
		var a := rng.randf() * TAU
		parts.append({"tex": tex_name, "pos": at, "vel": Vector2(cos(a), sin(a)) * speed * rng.randf_range(0.3, 1.0), "life": rng.randf_range(0.35, 0.8), "max": 0.8, "size": size * rng.randf_range(0.6, 1.3), "color": color})

func glow(ci: CanvasItem, at: Vector2, size: float, color: Color, name: String = "soft") -> void:
	ci.draw_texture_rect(tex[name], Rect2(at - Vector2(size, size) / 2.0, Vector2(size, size)), false, color)

func draw_glow(ci: CanvasItem) -> void:
	if state == "play":      # под заставкой и итогом свечение не рисуем: оно ложится поверх текста
		draw_lights(ci)
	for q in parts:
		var k: float = clampf(q["life"] / q["max"], 0.0, 1.0)
		var s: float = q["size"] * (0.5 + (1.0 - k))
		var c: Color = q["color"]
		c.a *= k
		ci.draw_texture_rect(tex[q["tex"]], Rect2(q["pos"] - Vector2(s, s) / 2.0, Vector2(s, s)), false, c)

func backdrop(top: Color, bottom: Color) -> void:
	var steps := 24
	for i in steps:
		draw_rect(Rect2(0, H / steps * i, W, H / steps + 1), top.lerp(bottom, float(i) / (steps - 1)))
	# Фоновая картинка игры (assets/bg_<id>.jpg), приглушённая, чтобы поле читалось.
	if bg_name != "":
		if not tex.has("bg") and ResourceLoader.exists("res://assets/bg_%s.jpg" % bg_name):
			tex["bg"] = load("res://assets/bg_%s.jpg" % bg_name)
		if tex.has("bg"):
			draw_texture_rect(tex["bg"], Rect2(0, 0, W, H), false, Color(1, 1, 1, 0.5))
			draw_rect(Rect2(0, 0, W, H), Color(top.r, top.g, top.b, 0.3))

func _draw() -> void:
	var off := Vector2.ZERO
	if shake > 0.0:
		off = Vector2(rng.randf_range(-1, 1), rng.randf_range(-1, 1)) * shake * 7.0
	draw_set_transform(off, 0.0, Vector2.ONE)
	draw_game()
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if flash > 0.0:
		draw_rect(Rect2(0, 0, W, H), Color(1, 0.2, 0.2, flash * 0.35))
	_hud()
	if state != "play":
		_overlay()

func _hud() -> void:
	rr(Rect2(16, 12, 124, 40), Color(0.13, 0.17, 0.3, 0.92), 10, Color("0b0f1c"), 2)
	text("← Игры", Vector2(78, 31), 16, INK, false)
	text(title, Vector2(310, 32), 24, INK)
	text("ЭТАП %d / %d" % [stage, stages], Vector2(560, 32), 17, GOLD)
	rr(Rect2(640, 22, 220, 20), Color("0d1226"), 10, Color("0b0f1c"), 2)
	rr(Rect2(642, 24, maxf(8.0, 216.0 * progress()), 16), Color("5fe0b5"), 8)
	text(progress_text(), Vector2(750, 33), 13, Color.WHITE, false)
	for i in (3 if show_lives else 0):
		var p := Vector2(1010 + i * 34, 32)
		draw_circle(p, 12, Color("ff5a6a") if i < lives else Color(1, 1, 1, 0.14))
		draw_circle(p - Vector2(4, 4), 4, Color(1, 1, 1, 0.5 if i < lives else 0.05))
	if timer >= 0.0:
		var low: bool = timer < 20.0
		text("%d:%02d" % [int(timer) / 60, int(timer) % 60], Vector2(930, 32), 24, Color("ff7a7a") if low and fmod(time, 0.6) < 0.3 else INK)
	text("%d" % score, Vector2(1180, 30), 30, GOLD)

func _overlay() -> void:
	draw_rect(Rect2(0, 0, W, H), Color(0.03, 0.05, 0.12, 0.72))
	var r := Rect2(240, 110, 800, 500)
	rr(r.grow(6), Color(0, 0, 0, 0.35), 30)
	rr(r, Color("16203a"), 26, GOLD, 3)
	var k := 0.75 + 0.25 * sin(time * 4.0)
	if state == "intro":
		text(title.to_upper(), Vector2(640, 160), 38, INK)
		text("ЭТАП %d ИЗ %d" % [stage, stages], Vector2(640, 208), 22, GOLD)
		for i in rules.size():
			text(rules[i], Vector2(640, 256 + i * 36), 18, INK if i == 0 else MUTED, false)
		text(goal_text(), Vector2(640, 256 + rules.size() * 36 + 18), 20, Color("7df9ff"))
		var dots := ""
		for n in range(1, stages + 1):
			dots += "★" if int(done_stars.get(n, 0)) > 0 else ("●" if n == stage else "○")
		text(dots, Vector2(640, 492), 22, GOLD, false)
		if unlocked() > 1:
			text("← → выбрать этап", Vector2(640, 524), 14, MUTED, false)
		text("ПРОБЕЛ — НАЧАТЬ", Vector2(640, 566), 28, Color(0.37, 0.88, 0.71, k))
	elif won:
		var st: int = int(done_stars.get(stage, 1))
		text("ЭТАП %d ПРОЙДЕН!" % stage if stage < stages else "ИГРА ПРОЙДЕНА!", Vector2(640, 176), 40, INK)
		for i in 3:
			text("★", Vector2(550 + i * 90, 280), 84, GOLD if i < st else Color(1, 1, 1, 0.16), false)
		var total := 0
		for n in done_stars:
			total += int(done_stars[n])
		text("Всего звёзд в игре: %d из %d" % [total, stages * 3], Vector2(640, 388), 22, GOLD)
		text("Звёзды идут в отметку за игру." if st == 3 else "Три звезды — за этап без потерь и с запасом времени.", Vector2(640, 432), 17, MUTED, false)
		text(("ПРОБЕЛ — ЭТАП %d" % (stage + 1)) if stage < stages else "ПРОБЕЛ — ЕЩЁ РАЗ   ·   ESC — К ИГРАМ", Vector2(640, 548), 26, Color(0.37, 0.88, 0.71, k))
	else:
		text("НЕ ПОЛУЧИЛОСЬ", Vector2(640, 190), 40, INK)
		text(fail_text, Vector2(640, 262), 22, Color("ff8a8a"), false)
		text("%s. %s" % [progress_text(), goal_text()], Vector2(640, 320), 20, MUTED, false)
		text("Этап можно проходить сколько угодно раз.", Vector2(640, 380), 17, MUTED, false)
		text("ПРОБЕЛ — ЕЩЁ РАЗ   ·   ESC — К ИГРАМ", Vector2(640, 548), 26, Color(0.37, 0.88, 0.71, k))
