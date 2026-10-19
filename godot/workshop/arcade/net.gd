extends "res://arcade/game.gd"
# «Сеть»: поворачивай кабели, чтобы сигнал сервера дошёл до всех компьютеров.

const L2 = preload("res://arcade/logic2.gd")
const BOARD := 540.0
const ORIGIN := Vector2(110, 100)

var n := 4
var masks: Array = []
var solved: Array = []
var server := 0
var lit: Array = []
var cursor := 0
var wait := 0.0
var turns := 0
var base_n := 4

func setup() -> void:
	base_n = L2.NET_SIZE[grade]
	n = base_n
	title = "Сеть"
	unit = "сетей"
	show_lives = false
	rules = ["Сервер раздаёт сигнал по кабелям, но все кабели перепутаны.", "Щёлкни по клетке или нажми ПРОБЕЛ — кабель повернётся.", "Сеть готова, когда светятся все клетки: каждый компьютер связан с сервером.", "С каждым этапом сетей больше, а поле крупнее. Время ограничено."]
	_board()

func setup_stage() -> void:
	goal = 2 + stage / 4
	n = mini(7, base_n + (stage - 1) / 4)

func goal_text() -> String:
	return "Цель этапа: собрать сетей — %d, поле %d×%d" % [goal, n, n]

func reset() -> void:
	timer = goal * n * n * 7.0
	turns = 0
	_board()

func _board() -> void:
	var net := L2.net_make(n, rng)
	masks = net["masks"]
	solved = net["solved"]
	server = net["server"]
	cursor = server
	wait = 0.0
	lit = L2.net_lit(n, masks, server)

func _cell() -> float:
	return BOARD / n

func _center(i: int) -> Vector2:
	return ORIGIN + (Vector2(i % n, i / n) + Vector2(0.5, 0.5)) * _cell()

func _rotate(i: int) -> void:
	if wait > 0.0:
		return
	masks[i] = L2.rot(masks[i])
	turns += 1
	lit = L2.net_lit(n, masks, server)
	sfx.emit("turn")
	if not lit.has(false):
		wait = 1.3
		for c in n * n:
			burst(_center(c), Color("7df9ff"), 4, 200.0)
		sfx.emit("win")
		add_score(1)

func key(k: int) -> void:
	var x := cursor % n
	var y := cursor / n
	match k:
		KEY_LEFT, KEY_A: x = maxi(0, x - 1)
		KEY_RIGHT, KEY_D: x = mini(n - 1, x + 1)
		KEY_UP, KEY_W: y = maxi(0, y - 1)
		KEY_DOWN, KEY_S: y = mini(n - 1, y + 1)
		KEY_SPACE, KEY_ENTER, KEY_KP_ENTER: _rotate(cursor)
	cursor = y * n + x

func click(p: Vector2) -> void:
	var q := (p - ORIGIN) / _cell()
	if q.x >= 0 and q.y >= 0 and q.x < n and q.y < n:
		cursor = int(q.y) * n + int(q.x)
		_rotate(cursor)

func tick(delta: float) -> void:
	if wait > 0.0:
		wait -= delta
		if wait <= 0.0 and state == "play":
			_board()

func debug() -> Dictionary:
	return {"n": n, "masks": masks, "solved": solved, "cursor": cursor, "wait": wait > 0.0, "lit": lit.count(true)}

func draw_game() -> void:
	backdrop(Color("0c1a2e"), Color("141a3a"))
	var c := _cell()
	rr(Rect2(ORIGIN - Vector2(12, 12), Vector2(BOARD + 24, BOARD + 24)), Color("081220"), 22, Color("2f5f8a"), 3)
	for i in n * n:
		var ctr := _center(i)
		var on: bool = lit[i]
		rr(Rect2(ctr - Vector2(c, c) / 2.0 + Vector2(3, 3), Vector2(c - 6, c - 6)), Color("13233c") if on else Color("101a2c"), 12)
		var col := Color("35d8ff") if on else Color("4a5670")
		for s in L2.SIDE:
			if masks[i] & s[0]:
				var d := Vector2(s[1]) * c / 2.0
				draw_line(ctr, ctr + d, Color("0b1220"), c * 0.2)
				draw_line(ctr, ctr + d, col, c * 0.12)
				if on:
					draw_line(ctr, ctr + d, Color(1, 1, 1, 0.6), c * 0.03)
		draw_circle(ctr, c * 0.1, Color("0b1220"))
		draw_circle(ctr, c * 0.065, col)
		var ends := 0
		for bit in [1, 2, 4, 8]:
			if masks[i] & bit:
				ends += 1
		if i == server and tex.has("ar_server"):
			draw_texture_rect(tex["ar_server"], Rect2(ctr - Vector2(c, c) * 0.36, Vector2(c, c) * 0.72), false)
		elif ends == 1 and tex.has("ar_pc"):
			# Компьютер на конце кабеля: картинка светлеет, когда есть связь.
			draw_texture_rect(tex["ar_pc"], Rect2(ctr - Vector2(c, c) * 0.36, Vector2(c, c) * 0.72), false, Color.WHITE if on else Color(0.42, 0.45, 0.6))
		elif i == server:
			rr(Rect2(ctr - Vector2(c, c) * 0.24, Vector2(c, c) * 0.48), Color("0b1220"), c * 0.08)
			rr(Rect2(ctr - Vector2(c, c) * 0.2, Vector2(c, c) * 0.4), Color("ffb21a"), c * 0.06)
			for k in 3:
				draw_rect(Rect2(ctr.x - c * 0.14, ctr.y - c * 0.13 + k * c * 0.1, c * 0.28, c * 0.05), Color("7a4b00"))
				draw_circle(Vector2(ctr.x + c * 0.1, ctr.y - c * 0.105 + k * c * 0.1), c * 0.018, Color("b6ff6a") if fmod(time * 3.0 + k, 2.0) < 1.4 else Color("3a5a20"))
		elif ends == 1:
			# Компьютер на конце кабеля: экран загорается, когда есть связь.
			rr(Rect2(ctr - Vector2(c * 0.26, c * 0.22), Vector2(c * 0.52, c * 0.38)), Color("0b1220"), c * 0.06)
			rr(Rect2(ctr - Vector2(c * 0.22, c * 0.18), Vector2(c * 0.44, c * 0.3)), Color("8ff1ff") if on else Color("263049"), c * 0.04)
			draw_rect(Rect2(ctr.x - c * 0.05, ctr.y + c * 0.16, c * 0.1, c * 0.07), Color("0b1220"))
			draw_rect(Rect2(ctr.x - c * 0.14, ctr.y + c * 0.22, c * 0.28, c * 0.04), Color("0b1220"))
	var cc := _center(cursor)
	draw_rect(Rect2(cc - Vector2(c, c) / 2.0 + Vector2(2, 2), Vector2(c - 4, c - 4)), Color(1, 0.83, 0.3, 0.7 + 0.3 * sin(time * 6.0)), false, 4.0)
	# Панель справа.
	var px := 700.0
	rr(Rect2(px, 100, 520, 540), Color("16203a"), 22, Color("33466e"), 2)
	text("КОМПЬЮТЕРНАЯ СЕТЬ", Vector2(px + 260, 136), 22, GOLD)
	var total := n * n
	var got: int = lit.count(true)
	text("На связи: %d из %d" % [got, total], Vector2(px + 260, 196), 26, Color("7df9ff") if got == total else INK)
	rr(Rect2(px + 40, 226, 440, 18), Color("0d1226"), 9)
	rr(Rect2(px + 40, 226, 440.0 * got / total, 18), Color("35d8ff"), 9)
	var lines := ["Жёлтый блок — сервер.", "Экраны — компьютеры на концах кабелей.", "Кабель проводит сигнал, только если", "стыкуется с соседом с обеих сторон.", "", "В готовой сети %d узлов и %d кабелей:" % [total, total - 1], "это дерево — ни одного лишнего соединения."]
	for i in lines.size():
		text(lines[i], Vector2(px + 260, 290 + i * 30), 16, MUTED, false)
	text("Поворотов: %d" % turns, Vector2(px + 260, 530), 18, INK, false)
	text("Мышь или стрелки + ПРОБЕЛ", Vector2(px + 260, 590), 16, MUTED, false)
	if wait > 0.0:
		text("СЕТЬ РАБОТАЕТ!", ORIGIN + Vector2(BOARD / 2.0, BOARD / 2.0), 44, GOLD)

func draw_lights(ci: CanvasItem) -> void:
	var c := _cell()
	for i in n * n:
		if lit[i]:
			glow(ci, _center(i), c * 1.5, Color(0.2, 0.8, 1.0, 0.16))
	glow(ci, _center(server), c * 1.8, Color(1.0, 0.7, 0.2, 0.3))
