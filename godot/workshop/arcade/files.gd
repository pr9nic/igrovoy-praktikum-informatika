extends "res://arcade/game.gd"
# «Проводник»: доберись по папкам до файла, путь к которому указан в задании.

const L2 = preload("res://arcade/logic2.gd")
const COLS := 5
const EXT_COLORS := {"txt": Color("8fa3c7"), "docx": Color("4a8df0"), "png": Color("e26bb0"), "jpg": Color("e26bb0"), "mp3": Color("b07af0"), "py": Color("f0c24a"), "xlsx": Color("3fba74"), "pptx": Color("f08a4a")}

var nodes: Array = []
var cur := 0
var sel := 0
var task: Dictionary = {}
var solved_here := 0
var wrong := 0.0
var fresh := 0.0

func setup() -> void:
	title = "Проводник"
	unit = "файлов"
	var what: String = "В задании — полный путь к файлу: диск, папки и имя. Начинаешь с диска C:."
	if grade >= 8:
		what = "Путь относительный: «..» — подняться в папку выше, дальше — имена папок."
	if grade >= 10:
		what = "Имя файла задано маской: «?» — один любой символ, «*» — любые символы."
	rules = [what, "Стрелки выбирают, ENTER открывает папку или файл, Backspace — на уровень выше.", "Открыл нужный файл — очко. Открыл не тот — минус жизнь.", "Время этапа ограничено: чем быстрее найдёшь файлы, тем больше звёзд."]
	nodes = L2.fs_make(rng)
	_task()

func setup_stage() -> void:
	goal = 4 + stage / 2

func goal_text() -> String:
	return "Цель этапа: найти файлов — %d" % goal

func reset() -> void:
	timer = goal * (36.0 - stage)
	nodes = L2.fs_make(rng, 3 if stage < 6 else 4)
	solved_here = 0
	_task()

func _task() -> void:
	if solved_here >= 3:
		nodes = L2.fs_make(rng, 3 if stage < 6 else 4)
		solved_here = 0
	task = L2.fs_task(grade, nodes, rng)
	cur = task["start"]
	sel = 0
	fresh = 1.0

func _items() -> Array:
	# Содержимое текущей папки: [вид, имя, номер папки].
	var out := []
	if cur != 0:
		out.append(["up", "..", nodes[cur]["parent"]])
	for d in nodes[cur]["dirs"]:
		out.append(["dir", nodes[d]["name"], d])
	for f in nodes[cur]["files"]:
		out.append(["file", f, -1])
	return out

func _slot(i: int) -> Rect2:
	return Rect2(84 + (i % COLS) * 226, 300 + (i / COLS) * 150, 208, 134)

func _open(i: int) -> void:
	var items := _items()
	if i < 0 or i >= items.size():
		return
	var it: Array = items[i]
	if it[0] == "file":
		if cur == task["dir"] and it[1] == task["file"]:
			burst(_slot(i).get_center(), GOLD, 26, 380.0, "p_star", 34.0)
			sfx.emit("deliver")
			solved_here += 1
			add_score(1)
			if state == "play":
				_task()
		else:
			wrong = 1.6
			lose_life(_slot(i).get_center())
	else:
		cur = it[2]
		sel = 0
		sfx.emit("step" if it[0] == "dir" else "turn")

func key(k: int) -> void:
	var count := _items().size()
	match k:
		KEY_LEFT, KEY_A: sel = maxi(0, sel - 1)
		KEY_RIGHT, KEY_D: sel = mini(count - 1, sel + 1)
		KEY_UP, KEY_W: sel = sel - COLS if sel - COLS >= 0 else sel
		KEY_DOWN, KEY_S: sel = sel + COLS if sel + COLS < count else sel
		KEY_ENTER, KEY_KP_ENTER, KEY_SPACE: _open(sel)
		KEY_BACKSPACE:
			if cur != 0:
				cur = nodes[cur]["parent"]
				sel = 0
				sfx.emit("turn")

func click(p: Vector2) -> void:
	for i in _items().size():
		if _slot(i).has_point(p):
			sel = i
			_open(i)
			return

func tick(delta: float) -> void:
	wrong = maxf(0.0, wrong - delta)
	fresh = maxf(0.0, fresh - delta)

func debug() -> Dictionary:
	# Следующий шаг к цели — только для автотеста.
	var items := _items()
	var names := []
	for it in items:
		names.append(it[1])
	var chain := L2.fs_chain(nodes, task["dir"])
	var want := ".."
	if cur == task["dir"]:
		want = task["file"]
	elif chain.has(cur):
		want = nodes[chain[chain.find(cur) + 1]]["name"]
	return {"task": task["text"], "here": L2.fs_path(nodes, cur), "items": names, "sel": sel, "want": names.find(want), "cols": COLS}

func _folder(r: Rect2, col: Color) -> void:
	var b := Rect2(r.position.x + 54, r.position.y + 22, 100, 66)
	if tex.has("ar_folder"):
		# Папка-картинка, подкрашенная в цвет раздела.
		var fw := b.size.x + 22.0
		draw_texture_rect(tex["ar_folder"], Rect2(b.position.x - 11.0, b.position.y - 24.0, fw, fw * tex["ar_folder"].get_height() / tex["ar_folder"].get_width()), false, Color.WHITE.lerp(col, 0.3))
		return
	rr(Rect2(b.position.x, b.position.y - 12, 44, 22), col.darkened(0.15), 7)
	rr(Rect2(b.position + Vector2(0, 5), b.size), col.darkened(0.45), 10)
	rr(b, col, 10)
	rr(Rect2(b.position, Vector2(b.size.x, 24)), Color(1, 1, 1, 0.14), 10)

func draw_game() -> void:
	backdrop(Color("10182e"), Color("1b1a3a"))
	# Задание.
	rr(Rect2(60, 80, 1160, 110), Color("16203a"), 20, GOLD if fresh > 0.0 else Color("33466e"), 3)
	text("ОТКРОЙ ФАЙЛ  ·  " + task["note"], Vector2(640, 104), 15, MUTED, false)
	var path_text: String = task["text"]
	text(path_text, Vector2(640, 148), 32 if path_text.length() < 44 else (25 if path_text.length() < 58 else 20), GOLD)
	# Адресная строка.
	rr(Rect2(60, 206, 1160, 50), Color("0d1226"), 14, Color("2c3a5e"), 2)
	draw_string(font, Vector2(84, 238), "Сейчас открыта папка:", HORIZONTAL_ALIGNMENT_LEFT, 240, 15, MUTED)
	draw_string(font_b, Vector2(300, 240), L2.fs_path(nodes, cur) + "\\", HORIZONTAL_ALIGNMENT_LEFT, 900, 21, Color("7df9ff"))
	rr(Rect2(60, 272, 1160, 372), Color(0.04, 0.07, 0.14, 0.6), 22, Color("2c3a5e"), 2)
	var items := _items()
	for i in items.size():
		var it: Array = items[i]
		var r := _slot(i)
		var on := i == sel
		rr(r, Color("26345a") if on else Color("19223d"), 16, GOLD if on else Color("2c3a5e"), 3 if on else 2)
		if it[0] == "up":
			_folder(r, Color("7d8db0"))
			text("↑", r.position + Vector2(104, 58), 34, Color.WHITE, false)
			text(".. (выше)", r.position + Vector2(104, 112), 15, INK, false)
		elif it[0] == "dir":
			_folder(r, Color("f0b83a"))
			text(it[1], r.position + Vector2(104, 112), 16, INK, false)
		else:
			var name: String = it[1]
			var ext := name.get_extension()
			var col: Color = EXT_COLORS.get(ext, Color("8fa3c7"))
			var b := Rect2(r.position.x + 72, r.position.y + 10, 64, 80)
			if tex.has("ar_file"):
				draw_texture_rect(tex["ar_file"], Rect2(b.position.x - 6.0, b.position.y - 8.0, b.size.x + 12.0, (b.size.x + 12.0) * tex["ar_file"].get_height() / tex["ar_file"].get_width()), false)
			else:
				rr(Rect2(b.position + Vector2(3, 5), b.size), Color(0, 0, 0, 0.35), 8)
				rr(b, Color("f4f6fb"), 8)
				draw_colored_polygon(PackedVector2Array([b.position + Vector2(44, 0), b.position + Vector2(64, 20), b.position + Vector2(44, 20)]), Color("c5cde0"))
			rr(Rect2(b.position.x - 8, b.position.y + 44, 80, 26), col, 7)
			draw_string(font_b, Vector2(b.position.x - 8, b.position.y + 63), ext, HORIZONTAL_ALIGNMENT_CENTER, 80, 15, Color.WHITE)
			text(name, r.position + Vector2(104, 112), 15 if name.length() < 18 else 13, INK, false)
	if wrong > 0.0:
		text("Это не тот файл. Сверь путь по папкам.", Vector2(640, 676), 20, Color("ff8a8a"))
	else:
		text("Стрелки — выбрать · ENTER — открыть · Backspace — папка выше", Vector2(640, 678), 15, MUTED, false)

func draw_lights(ci: CanvasItem) -> void:
	var items := _items()
	if sel < items.size():
		glow(ci, _slot(sel).get_center(), 300.0, Color(1.0, 0.8, 0.3, 0.14))
	if fresh > 0.0:
		glow(ci, Vector2(640, 136), 900.0, Color(1.0, 0.8, 0.3, fresh * 0.18))
