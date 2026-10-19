extends "res://arcade/game.gd"
# «Змейка: по порядку»: ешь числа по возрастанию — сначала самое маленькое на поле.

const GW := 20
const GH := 10
const CELL := 58.0
const ORIGIN := Vector2(60, 84)
const DIRS := {KEY_LEFT: Vector2i(-1, 0), KEY_RIGHT: Vector2i(1, 0), KEY_UP: Vector2i(0, -1), KEY_DOWN: Vector2i(0, 1), KEY_A: Vector2i(-1, 0), KEY_D: Vector2i(1, 0), KEY_W: Vector2i(0, -1), KEY_S: Vector2i(0, 1)}

var body: Array = []
var dir := Vector2i(1, 0)
var queue: Array = []
var foods: Array = []
var step_in := 0.0
var grow := 0
var hint := 0.0
var wrong_at := Vector2.ZERO
var walls: Array = []
var food_count := 4

func setup() -> void:
	title = "Змейка: по порядку"
	unit = "чисел"
	var what: String = {6: "На поле — объёмы информации в битах и байтах. 1 байт = 8 бит.", 7: "Объёмы в битах, байтах и килобайтах. 1 Кбайт = 1024 байта.", 8: "Числа записаны в десятичной и двоичной системах.", 9: "Числа в двоичной, восьмеричной, десятичной и шестнадцатеричной системах.", 10: "Числа в восьмеричной, десятичной и шестнадцатеричной системах.", 11: "Степени двойки и числа в разных системах счисления."}[grade]
	rules = [what, "Ешь по возрастанию: сначала самое маленькое значение на поле.", "Стрелки или W A S D — поворот. Стены и хвост отнимают жизнь.", "Съешь не то — тоже минус жизнь."]
	reset()

func setup_stage() -> void:
	goal = 8 + 2 * stage
	food_count = 4 if stage < 4 else (5 if stage < 8 else 6)

func reset() -> void:
	foods.clear()
	walls.clear()
	_respawn()
	# С четвёртого этапа на поле появляются блоки-препятствия.
	for i in maxi(0, stage - 3) * 2:
		for attempt in 50:
			var p := Vector2i(rng.randi_range(1, GW - 2), rng.randi_range(1, GH - 2))
			if p.y != 5 and not walls.has(p):
				walls.append(p)
				break
	for i in food_count:
		_add_food()

func _respawn() -> void:
	body = [Vector2i(6, 5), Vector2i(5, 5), Vector2i(4, 5)]
	dir = Vector2i(1, 0)
	queue.clear()
	grow = 0
	step_in = 0.8

func _add_food() -> void:
	var taken := []
	for f in foods:
		taken.append(f["value"])
	var f := Logic.food(grade, rng, taken)
	for attempt in 300:
		var p := Vector2i(rng.randi_range(1, GW - 2), rng.randi_range(1, GH - 2))
		var busy: bool = body.has(p) or walls.has(p) or (p - body[0]).length() < 4.0
		# Не кладём еду прямо по курсу змейки: иначе она съест её раньше, чем игрок успеет повернуть.
		var ahead: Vector2i = p - body[0]
		if (dir.x != 0 and ahead.y == 0 and ahead.x * dir.x > 0 and absi(ahead.x) < 9) or (dir.y != 0 and ahead.x == 0 and ahead.y * dir.y > 0 and absi(ahead.y) < 9):
			busy = true
		for o in foods:
			if (o["pos"] - p).length() < 2.5:
				busy = true
		if not busy:
			f["pos"] = p
			foods.append(f)
			return
	f["pos"] = Vector2i(1, 1)
	foods.append(f)

func _center(p: Vector2i) -> Vector2:
	return ORIGIN + (Vector2(p) + Vector2(0.5, 0.5)) * CELL

func key(k: int) -> void:
	if DIRS.has(k) and queue.size() < 2:
		var last: Vector2i = queue[-1] if not queue.is_empty() else dir
		var d: Vector2i = DIRS[k]
		if d != last and d != -last:
			queue.append(d)

func click(p: Vector2) -> void:
	# Щелчок мышью: змейка поворачивает в сторону щелчка.
	var d := p - _center(body[0])
	var want := Vector2i(signi(int(d.x)), 0) if absf(d.x) > absf(d.y) else Vector2i(0, signi(int(d.y)))
	if want != Vector2i.ZERO and want != -dir and queue.size() < 2:
		queue.append(want)

func tick(delta: float) -> void:
	hint = maxf(0.0, hint - delta)
	step_in -= delta
	if step_in > 0.0:
		return
	step_in = maxf(0.11, 0.21 - stage * 0.007 - score * 0.002)
	if not queue.is_empty():
		dir = queue.pop_front()
	var head: Vector2i = body[0] + dir
	if head.x < 0 or head.y < 0 or head.x >= GW or head.y >= GH or walls.has(head) or body.slice(0, body.size() - 1).has(head):
		lose_life(_center(body[0]))
		if lives > 0:
			_respawn()
		return
	body.push_front(head)
	if grow > 0:
		grow -= 1
	else:
		body.pop_back()
	for i in foods.size():
		if foods[i]["pos"] == head:
			var f: Dictionary = foods[i]
			var right := Logic.smallest(foods) == i
			foods.remove_at(i)
			if right:
				grow += 1
				burst(_center(head), Color("5fe0b5"), 16, 300.0)
				sfx.emit("deliver")
				add_score(1)
			else:
				wrong_at = _center(head)
				hint = 2.5
				lose_life(_center(head))
			if lives > 0 and state == "play":
				_add_food()
			return

func debug() -> Dictionary:
	var out := []
	for f in foods:
		out.append({"label": f["label"], "value": f["value"], "x": f["pos"].x, "y": f["pos"].y})
	return {"head": [body[0].x, body[0].y], "dir": [dir.x, dir.y], "len": body.size(), "foods": out, "smallest": Logic.smallest(foods) if not foods.is_empty() else -1}

func draw_game() -> void:
	backdrop(Color("0d2030"), Color("12283a"))
	var field := Rect2(ORIGIN, Vector2(GW, GH) * CELL)
	rr(field.grow(10), Color("081420"), 20, Color("2f6f6a"), 3)
	for y in GH:
		for x in GW:
			if (x + y) % 2 == 0:
				draw_rect(Rect2(ORIGIN + Vector2(x, y) * CELL, Vector2(CELL, CELL)), Color(1, 1, 1, 0.025))
	for p in walls:
		var wr := Rect2(ORIGIN + Vector2(p) * CELL + Vector2(3, 3), Vector2(CELL - 6, CELL - 6))
		rr(Rect2(wr.position + Vector2(0, 5), wr.size), Color(0, 0, 0, 0.35), 10)
		rr(wr, Color("5a6480"), 10, Color("0b1a24"), 3)
		rr(Rect2(wr.position, Vector2(wr.size.x, wr.size.y * 0.4)), Color(1, 1, 1, 0.1), 10)
	var small := Logic.smallest(foods) if not foods.is_empty() else -1
	for i in foods.size():
		var f: Dictionary = foods[i]
		var c := _center(f["pos"])
		var bob := sin(time * 3.0 + i) * 3.0
		var w := maxf(86.0, 24.0 + f["label"].length() * 15.0)
		var r := Rect2(c.x - w / 2.0, c.y - 22 + bob, w, 44)
		rr(Rect2(r.position + Vector2(0, 5), r.size), Color(0, 0, 0, 0.35), 14)
		rr(r, Color("fff6dc"), 14, Color("ffd34d") if (hint > 0.0 and i == small) else Color("10162b"), 4 if (hint > 0.0 and i == small) else 3)
		draw_string(font_b, Vector2(r.position.x, r.position.y + 30), f["label"], HORIZONTAL_ALIGNMENT_CENTER, w, 22, Color("10162b"))
	for i in range(body.size() - 1, -1, -1):
		var c := _center(body[i])
		var k := float(i) / maxf(1.0, body.size())
		var col := Color("33d6b6").lerp(Color("1b7f9c"), k)
		var s := CELL * (0.9 - 0.25 * k)
		# Змейка из картинок: голова смотрит по ходу, звенья к хвосту мельче и темнее.
		var st: Texture2D = tex["ar_snake_head" if i == 0 else "ar_snake_body"]
		var ss: float = s * (1.5 if i == 0 else 1.12)
		draw_circle(c + Vector2(0, 5), ss * 0.36, Color(0, 0, 0, 0.3))
		draw_set_transform(c, Vector2(dir).angle() if i == 0 else 0.0, Vector2.ONE)
		draw_texture_rect(st, Rect2(-ss / 2.0, -ss / 2.0, ss, ss), false, Color.WHITE.lerp(Color(0.55, 0.75, 0.9), k))
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	if hint > 0.0:
		text("Сначала самое маленькое — оно подсвечено", Vector2(640, 696), 18, GOLD, false)
	else:
		text("Ешь по возрастанию · стрелки или W A S D", Vector2(640, 696), 16, MUTED, false)

func draw_lights(ci: CanvasItem) -> void:
	glow(ci, _center(body[0]), 240.0, Color(0.2, 0.9, 0.75, 0.3))
	for f in foods:
		glow(ci, _center(f["pos"]), 150.0, Color(1.0, 0.85, 0.4, 0.14))
