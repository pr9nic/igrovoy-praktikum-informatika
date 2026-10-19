extends "res://arcade/game.gd"
# «Курьер»: проложи самый короткий путь от А до Б по дорогам с разной длиной.

const L2 = preload("res://arcade/logic2.gd")

var g: Dictionary = {}
var path: Array = []
var best: Dictionary = {}
var wait := 0.0
var verdict := ""
var good := false
var got := false        # посылка уже забрана
var clock := 0.0        # сколько секунд осталось на маршрут; 0 — без ограничения

func setup() -> void:
	title = "Курьер"
	unit = "маршрутов"
	stages = L2.ROUTE_STAGES
	rules = ["Курьеру нужно попасть из пункта А в пункт Б. Числа на дорогах — их длина.", "Щёлкай по соседним пунктам или нажимай цифры рядом с ними.", "Самый дешёвый следующий шаг не всегда ведёт к кратчайшему пути!", "Нашёл кратчайший — очко. Путь длиннее — минус жизнь. Backspace — шаг назад.", "Дальше: односторонние улицы, время на маршрут и посылка по пути."]
	_new()

func setup_stage() -> void:
	goal = 4 + stage / 3

func goal_text() -> String:
	var sh := L2.route_shape(grade, stage)
	var extra := ""
	if sh["oneway"] > 0.0:
		extra += " · односторонние улицы"
	if sh["timer"] > 0.0:
		extra += " · %d с на маршрут" % int(sh["timer"])
	if sh["via"]:
		extra += " · с посылкой"
	return "Кратчайших маршрутов: %d · перекрёстков до %d%s" % [goal, int(sh["cols"] * sh["rows"] * sh["fill"]), extra]

func reset() -> void:
	_new()

func _new() -> void:
	g = L2.route_make(grade, rng, stage)
	got = false
	clock = g["timer"]
	best = L2.route_best(g)
	path = [g["start"]]
	wait = 0.0
	verdict = ""

func _options() -> Array:
	# Куда можно пойти из текущего пункта: слева направо, сверху вниз.
	var out := []
	for nb in L2.route_next(g, path[-1]):
		# С посылкой возвращаться по своим следам можно: иногда так короче.
		if (g["via"] >= 0 or not path.has(nb[0])) and not out.has(nb[0]):
			out.append(nb[0])
	out.sort_custom(func(a, b): return g["nodes"][a].x < g["nodes"][b].x or (g["nodes"][a].x == g["nodes"][b].x and g["nodes"][a].y < g["nodes"][b].y))
	return out

func _go(node: int) -> void:
	if wait > 0.0:
		return
	if g["via"] < 0 and path.size() > 1 and node == path[-2]:
		path.pop_back()
		sfx.emit("turn")
		return
	if not _options().has(node):
		return
	path.append(node)
	sfx.emit("step")
	burst(g["nodes"][node], Color("7df9ff"), 6, 160.0)
	if node == g["via"] and not got:
		got = true
		burst(g["nodes"][node], Color("c98bff"), 18, 300.0, "p_star", 30.0)
		sfx.emit("take")
	if path.size() > 60:
		_fail("Слишком длинный маршрут.")
	elif node == g["goal"] and (g["via"] < 0 or got):
		var cost := L2.route_cost(g, path)
		good = cost == best["cost"]
		wait = 1.3 if good else 3.0
		if good:
			verdict = "Кратчайший путь: %d" % cost
			burst(g["nodes"][node], GOLD, 24, 380.0, "p_star", 34.0)
			sfx.emit("deliver")
			add_score(1)
		else:
			_fail("Твой путь: %d, а кратчайший: %d" % [cost, best["cost"]])

func _fail(text: String) -> void:
	good = false
	wait = 3.2
	verdict = text
	lose_life(g["nodes"][path[-1]])

func key(k: int) -> void:
	if k == KEY_BACKSPACE and path.size() > 1 and wait <= 0.0:
		path.pop_back()
		got = g["via"] >= 0 and path.has(g["via"])
		sfx.emit("turn")
	elif k == KEY_R and wait <= 0.0:
		path = [g["start"]]
		got = false
	else:
		var d := -1
		if k >= KEY_1 and k <= KEY_9:
			d = k - KEY_1
		elif k >= KEY_KP_1 and k <= KEY_KP_9:
			d = k - KEY_KP_1
		var opts := _options()
		if d >= 0 and d < opts.size():
			_go(opts[d])

func click(p: Vector2) -> void:
	for i in g["nodes"].size():
		if g["nodes"][i].distance_to(p) < 40.0:
			_go(i)
			return

func tick(delta: float) -> void:
	if wait <= 0.0 and clock > 0.0:
		clock -= delta
		if clock <= 0.0:
			clock = 0.0
			_fail("Время вышло. Кратчайший путь: %d" % best["cost"])
	if wait > 0.0:
		wait -= delta
		if wait <= 0.0 and state == "play":
			_new()

func debug() -> Dictionary:
	# Следующий шаг кратчайшего маршрута — только для автотеста.
	var opts := _options()
	var want := -1
	var on_best := true
	for i in path.size():
		if i >= best["path"].size() or best["path"][i] != path[i]:
			on_best = false
	if on_best and path.size() < best["path"].size():
		want = opts.find(best["path"][path.size()])
	return {"nodes": g["nodes"].size(), "path": path, "bestCost": best["cost"], "cost": L2.route_cost(g, path), "wantKey": want, "wait": wait > 0.0, "options": opts.size(), "via": g["via"], "got": got, "clock": int(clock), "oneway": g["edges"].filter(func(e): return e[3] == 1).size()}

func _in_path(a: int, b: int, list: Array) -> bool:
	for i in range(1, list.size()):
		if (list[i - 1] == a and list[i] == b) or (list[i - 1] == b and list[i] == a):
			return true
	return false

func draw_game() -> void:
	backdrop(Color("10203a"), Color("1a1838"))
	rr(Rect2(60, 84, 1160, 560), Color(0.04, 0.07, 0.14, 0.55), 26, Color("2c3a5e"), 2)
	var nodes: Array = g["nodes"]
	var dense: bool = nodes.size() > 18
	var show_best: bool = wait > 0.0 and not good
	for e in g["edges"]:
		var a: Vector2 = nodes[e[0]]
		var b: Vector2 = nodes[e[1]]
		var mine := _in_path(e[0], e[1], path)
		var opt: bool = show_best and _in_path(e[0], e[1], best["path"])
		var col := GOLD if opt else (Color("35d8ff") if mine else (Color("7a5a8f") if e[3] == 1 else Color("46536f")))
		draw_line(a, b, Color("0b1220"), 16.0 if not dense else 12.0)
		draw_line(a, b, col, 9.0 if (mine or opt) else (6.0 if not dense else 5.0))
		if e[3] == 1:
			# Односторонняя улица: стрелки по ходу движения.
			var dirv := (b - a).normalized()
			var side := Vector2(-dirv.y, dirv.x)
			for k in [0.3, 0.7]:
				var tip: Vector2 = a.lerp(b, k) + dirv * 9.0
				draw_colored_polygon(PackedVector2Array([tip, tip - dirv * 16.0 + side * 9.0, tip - dirv * 16.0 - side * 9.0]), Color("ffb3f0") if not (mine or opt) else Color.WHITE)
		if not mine and not opt:
			var steps := int(a.distance_to(b) / 26.0)
			for i in range(1, steps):
				if i % 2 == 0:
					draw_circle(a.lerp(b, float(i) / steps), 2.0, Color(1, 1, 1, 0.25))
	for e in g["edges"]:
		var mid: Vector2 = (nodes[e[0]] + nodes[e[1]]) / 2.0
		var mine := _in_path(e[0], e[1], path)
		var hw := 19.0 if not dense else 16.0
		rr(Rect2(mid - Vector2(hw, hw - 2.0), Vector2(hw * 2.0, hw * 2.0 - 4.0)), Color("fff6dc") if not mine else Color("35d8ff"), 9, Color("10162b"), 3)
		draw_string(font_b, Vector2(mid.x - hw, mid.y + (8 if not dense else 6)), str(e[2]), HORIZONTAL_ALIGNMENT_CENTER, hw * 2.0, 22 if not dense else 17, Color("10162b"))
	var opts := _options() if wait <= 0.0 else []
	for i in nodes.size():
		var p: Vector2 = nodes[i]
		var here: bool = i == path[-1]
		var col := Color("2c3a5e")
		if i == g["start"]:
			col = Color("21a366")
		elif i == g["goal"]:
			col = Color("d14a5c")
		elif i == g["via"]:
			col = Color("8a5cf0") if not got else Color("4a3a7a")
		elif path.has(i):
			col = Color("1f8fb5")
		var r := (30.0 if not dense else 23.0) + (4.0 * sin(time * 6.0) if here else 0.0)
		draw_circle(p + Vector2(0, 5), r, Color(0, 0, 0, 0.35))
		draw_circle(p, r, Color("0b1220"))
		draw_circle(p, r - 4.0, col)
		draw_circle(p - Vector2(8, 9), 6.0, Color(1, 1, 1, 0.2))
		var k := opts.find(i)
		if i == g["start"]:
			text("А", p, 26, Color.WHITE)
		elif i == g["goal"]:
			text("Б", p, 26, Color.WHITE)
		elif i == g["via"] and k < 0:
			text("✓" if got else "П", p, 24, Color.WHITE)
		elif k >= 0:
			text(str(k + 1), p, 24, GOLD)
		if here:
			draw_arc(p, r + 6.0, 0.0, TAU, 40, GOLD, 3.0)
		# Значки над пунктами: старт — флажок, финиш — дом получателя, посылка — коробка; курьер стоит там, где он сейчас.
		var mark := "ar_start" if i == g["start"] else ("ar_house" if i == g["goal"] else ("ar_finish" if i == g["via"] and not got else ""))
		if mark != "" and tex.has(mark):
			var mw := 40.0 if not dense else 32.0
			draw_texture_rect(tex[mark], Rect2(p.x - mw / 2.0 + (14.0 if here else 0.0), p.y - r - mw * 1.05, mw, mw * tex[mark].get_height() / tex[mark].get_width()), false)
		if here and tex.has("ar_courier"):
			var cw := 46.0 if not dense else 36.0
			var ch: float = cw * tex["ar_courier"].get_height() / tex["ar_courier"].get_width()
			draw_texture_rect(tex["ar_courier"], Rect2(p.x - cw / 2.0 - (14.0 if mark != "" else 0.0), p.y - r - ch - 2.0 + sin(time * 5.0) * 2.0, cw, ch), false)
	var cost := L2.route_cost(g, path)
	text("Пройдено: %d" % maxi(cost, 0), Vector2(180, 676), 22, Color("7df9ff"))
	if g["via"] >= 0:
		text("Посылка: " + ("забрана" if got else "в пункте П"), Vector2(420, 677), 17, Color("c98bff"))
	if g["timer"] > 0.0 and wait <= 0.0:
		text("%d с" % int(ceil(clock)), Vector2(1150, 110), 30, Color("ff7a7a") if clock < 15.0 else INK)
	if verdict != "" and wait > 0.0:
		text(verdict, Vector2(700, 676), 24, GOLD if good else Color("ff8a8a"))
	else:
		text("Цифры или мышь — идти · Backspace — назад · R — сначала", Vector2(860, 678), 15, MUTED, false)

func draw_lights(ci: CanvasItem) -> void:
	var nodes: Array = g["nodes"]
	glow(ci, nodes[path[-1]], 170.0, Color(1.0, 0.8, 0.3, 0.3))
	glow(ci, nodes[g["goal"]], 150.0, Color(1.0, 0.3, 0.4, 0.22 + 0.08 * sin(time * 4.0)))
	if g["via"] >= 0 and not got:
		glow(ci, nodes[g["via"]], 150.0, Color(0.7, 0.4, 1.0, 0.3 + 0.1 * sin(time * 4.0)))
	for i in path:
		glow(ci, nodes[i], 110.0, Color(0.2, 0.8, 1.0, 0.16))
