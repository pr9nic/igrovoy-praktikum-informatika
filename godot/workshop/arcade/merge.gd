extends "res://arcade/game.gd"
# «2048: биты и байты»: сдвигай плитки, одинаковые складываются в следующую единицу.

const ORIGIN := Vector2(200, 96)
const CELL := 140.0
const PALETTE := ["2b3a67", "33508f", "2f6fa8", "2a8f9c", "2f9e63", "7aa33a", "c2972a", "d9792f", "d1553f", "c2456b", "9b4fd1", "6a5cf0", "ffd34d"]

var grid: Array = []
var best_k := 0
var anim := 0.0
var moves: Array = []
var merged: Array = []
var spawned := -1
var stuck := false
var goal_k := 5

func setup() -> void:
	title = "2048: биты и байты"
	unit = "очков"
	show_lives = false
	stages = 6
	var what: String = {6: "Два одинаковых объёма складываются: 512 байт + 512 байт = 1 Кбайт.", 7: "8 бит — это 1 байт, 1024 байта — 1 Кбайт.", 8: "На плитках — степени двойки в двоичной записи: 1, 10, 100…", 9: "На плитках — степени двойки: 2⁰, 2¹, 2²…", 10: "На плитках — степени двойки в шестнадцатеричной записи.", 11: "1024 Кбайт складываются в 1 Мбайт."}[grade]
	rules = [what, "Стрелки сдвигают все плитки. Одинаковые сливаются в одну.", "На каждом этапе — своя плитка-цель, всё крупнее и крупнее.", "Если ходов не осталось, этап начинается заново. R — начать заново."]
	reset()

func setup_stage() -> void:
	goal_k = 4 + stage

func goal_text() -> String:
	return "Цель этапа: плитка «%s»" % " ".join(Logic.tile_label(grade, goal_k))

func progress() -> float:
	return clampf(float(best_k) / goal_k, 0.0, 1.0)

func progress_text() -> String:
	return " ".join(Logic.tile_label(grade, best_k))

func stage_stars() -> int:
	return 3

func reset() -> void:
	grid = []
	for i in 16:
		grid.append(0)
	best_k = 0
	moves = []
	merged = []
	anim = 0.0
	stuck = false
	_spawn()
	_spawn()
	spawned = -1

func _spawn() -> void:
	var free := []
	for i in 16:
		if grid[i] == 0:
			free.append(i)
	if free.is_empty():
		return
	spawned = free[rng.randi() % free.size()]
	grid[spawned] = 1 if rng.randf() < 0.9 else 2

func _pos(i: int) -> Vector2:
	return ORIGIN + Vector2(i % 4, i / 4) * CELL

func move(dir: int) -> void:
	if anim > 0.0 or stuck:
		return
	var r := Logic.slide(grid, dir)
	if not r["moved"]:
		return
	moves = r["moves"]
	merged = r["merged"]
	grid = r["grid"]
	anim = 0.12
	_spawn()
	score += r["gained"]
	for i in merged:
		best_k = maxi(best_k, grid[i] - 1)
		burst(_pos(i) + Vector2(CELL, CELL) / 2.0, Color(PALETTE[mini(grid[i] - 1, PALETTE.size() - 1)]).lightened(0.3), 10, 240.0)
	sfx.emit("deliver" if not merged.is_empty() else "step")
	if best_k >= goal_k:
		stage_won()
	elif not Logic.can_move(grid):
		stuck = true

func key(k: int) -> void:
	match k:
		KEY_LEFT, KEY_A: move(0)
		KEY_RIGHT, KEY_D: move(1)
		KEY_UP, KEY_W: move(2)
		KEY_DOWN, KEY_S: move(3)
		KEY_R: start()

func click(p: Vector2) -> void:
	# Щелчок по краю поля сдвигает плитки в эту сторону.
	var c := ORIGIN + Vector2(CELL, CELL) * 2.0
	var d := p - c
	if absf(d.x) > 600.0 or absf(d.y) > 330.0:
		return
	if absf(d.x) > absf(d.y):
		move(1 if d.x > 0 else 0)
	else:
		move(3 if d.y > 0 else 2)

func tick(delta: float) -> void:
	if anim > 0.0:
		anim = maxf(0.0, anim - delta)
	elif stuck:
		game_over("Ходов больше нет.")

func debug() -> Dictionary:
	return {"grid": grid, "top": best_k, "stuck": stuck}

func _tile(center: Vector2, v: int, scale: float) -> void:
	var k := v - 1
	var col := Color(PALETTE[mini(k, PALETTE.size() - 1)])
	var s := (CELL - 14.0) * scale
	var r := Rect2(center - Vector2(s, s) / 2.0, Vector2(s, s))
	if tex.has("mt_0"):
		# Плитка-кристалл (нарисована нейросетью): цвет по номеру плитки, после восьмой цвета идут по кругу.
		draw_rect(Rect2(r.position + Vector2(4, 8), r.size), Color(0, 0, 0, 0.3))
		draw_texture_rect(tex["mt_%d" % (k % 8)], r.grow(4.0), false)
	else:
		rr(Rect2(r.position + Vector2(0, 6), r.size), col.darkened(0.45), 18)
		rr(r, col, 18)
		rr(Rect2(r.position, Vector2(r.size.x, r.size.y * 0.45)), Color(1, 1, 1, 0.1), 18)
	var lab := Logic.tile_label(grade, k)
	var main: String = lab[0]
	var size := 46 if main.length() <= 2 else (38 if main.length() <= 4 else (26 if main.length() <= 7 else 17))
	var dark: bool = k >= 12 and not tex.has("mt_0")
	text(main, center - Vector2(0, 10), int(size * scale), Color("2a1d00") if dark else Color.WHITE)
	text(lab[1], center + Vector2(0, 34), int(17 * scale), Color("5a4300") if dark else Color(1, 1, 1, 0.82), false)

func draw_game() -> void:
	backdrop(Color("131a36"), Color("1d1640"))
	rr(Rect2(ORIGIN - Vector2(14, 14), Vector2(CELL * 4 + 28, CELL * 4 + 28)), Color("0d1226"), 26, Color("33466e"), 3)
	for i in 16:
		rr(Rect2(_pos(i) + Vector2(7, 7), Vector2(CELL - 14, CELL - 14)), Color("1a2342"), 18)
	if anim > 0.0:
		var t := 1.0 - anim / 0.12
		for m in moves:
			var a := _pos(m[0])
			var b := _pos(m[1])
			_tile(a.lerp(b, t) + Vector2(CELL, CELL) / 2.0, m[2], 1.0)
	else:
		for i in 16:
			if grid[i] > 0:
				_tile(_pos(i) + Vector2(CELL, CELL) / 2.0, grid[i], 1.0)
	# Справочная панель справа.
	var px := 800.0
	rr(Rect2(px, 96, 440, 560), Color("16203a"), 22, Color("33466e"), 2)
	text("ЛЕСЕНКА", Vector2(px + 220, 128), 22, GOLD)
	var top: int = maxi(10, best_k)
	for k in range(top + 1):
		var col := Color(PALETTE[mini(k, PALETTE.size() - 1)])
		var col_x := px + 24 + (k / 6) * 206
		var y := 160 + (k % 6) * 44
		var reached: bool = k <= best_k
		rr(Rect2(col_x, y, 186, 36), col if reached else Color(col.r, col.g, col.b, 0.22), 10)
		var lab := Logic.tile_label(grade, k)
		var line := " ".join(lab)
		var fs := 16 if line.length() <= 12 else (13 if line.length() <= 16 else 11)
		draw_string(font, Vector2(col_x + 10, y + 18 + fs * 0.4), line, HORIZONTAL_ALIGNMENT_LEFT, 150, fs, Color.WHITE if reached else Color(1, 1, 1, 0.55))
		if k == goal_k:
			draw_string(font, Vector2(col_x + 156, y + 26), "★", HORIZONTAL_ALIGNMENT_LEFT, 30, 20, GOLD)
	text("Самая большая плитка:", Vector2(px + 220, 470), 17, MUTED, false)
	text(" ".join(Logic.tile_label(grade, best_k)), Vector2(px + 220, 508), 30, GOLD)
	text("Стрелки или W A S D — сдвиг", Vector2(px + 220, 570), 16, MUTED, false)
	text("R — заново · Esc — к играм", Vector2(px + 220, 600), 16, MUTED, false)
	if stuck:
		text("Ходов больше нет", Vector2(px + 220, 636), 18, Color("ff7a7a"), false)

func draw_lights(ci: CanvasItem) -> void:
	if anim <= 0.0:
		for i in merged:
			if grid[i] > 0:
				glow(ci, _pos(i) + Vector2(CELL, CELL) / 2.0, 230.0, Color(1, 0.85, 0.4, 0.25))
		if spawned >= 0:
			glow(ci, _pos(spawned) + Vector2(CELL, CELL) / 2.0, 170.0, Color(0.5, 0.8, 1.0, 0.18))
