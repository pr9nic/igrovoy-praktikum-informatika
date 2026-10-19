extends Control
# «Кодоград: Мастерская роботов» — меню, редактор программы и запуск робота.

const Sim = preload("res://sim.gd")
const Levels = preload("res://levels.gd")
const Board = preload("res://board.gd")
const Arcade = preload("res://arcade/hub.gd")

const BG := Color("121829")
const PANEL := Color("1a2238")
const PANEL2 := Color("232d4a")
const INK := Color("e8eefb")
const MUTED := Color("9fb2d6")
const GOLD := Color("ffd34d")
const GOOD := Color("5fe0b5")
const BAD := Color("ff7a7a")
const OP_COLORS := {"fwd": Color("3f7fe8"), "left": Color("2f9fb8"), "right": Color("2f9fb8"), "take": Color("e2792f"), "put": Color("e2792f"), "repeat": Color("8a5cf0"), "if": Color("2f9e63"), "while": Color("d14a8c"), "on": Color("d9a21b"), "off": Color("6b7890"), "fset": Color("c2556b"), "fclr": Color("c2556b"), "ftog": Color("c2556b"), "step_r": Color("3f7fe8"), "step_l": Color("3f7fe8"), "load": Color("e2792f"), "add": Color("e2792f"), "inc": Color("e2792f"), "write": Color("d9a21b"), "swap": Color("2f9fb8"), "mark": Color("c2556b")}
const SHOP_TINTS := [Color(1, 1, 1), Color(0.78, 0.88, 1.0), Color(0.8, 1.0, 0.86), Color(1.0, 0.9, 0.8), Color(0.9, 0.82, 1.0), Color(1.0, 0.84, 0.9)]
const SHOP_ICONS := ["crate_red", "1010", "И·ИЛИ", "5 2 8", "1+1", "⇄"]
const SHOP_COLORS := [Color("e2792f"), Color("d9a21b"), Color("2f9e63"), Color("3f7fe8"), Color("8a5cf0"), Color("d14a8c")]
const SPEEDS := [1.0, 2.0, 4.0]
const DUR := {"fwd": 0.32, "left": 0.26, "right": 0.26, "take": 0.3, "put": 0.34, "check": 0.3, "loop": 0.0, "bump": 0.6, "fail": 0.6, "done": 0.8, "lamp": 0.26, "flag": 0.24, "step": 0.28, "mem": 0.3, "write": 0.32, "swap": 0.4, "mark": 0.4}
const SOUNDS := ["click", "win", "error", "drop", "take", "step", "turn", "deliver"]
const SAVE_PATH := "user://workshop.json"
const WEB_KEY := "school4-workshop-v1"

var f_title: Font
var f_body: Font
var stars := {}
var programs := {}
var sounds := {}
var screen: Control
var si := -1
var shop: Dictionary = {}
var li := -1
var rng := RandomNumberGenerator.new()
var level: Dictionary = {}
var program: Array = []
var cur_list: Array = []
var cur_i := 0
var next_id := 1
var running := false
var token := 0
var speed_i := 0
var board: Node2D
var rows_box: VBoxContainer
var scroll: ScrollContainer
var status: Label
var counter: Label
var shift_label: Label
var speed_btn: Button
var run_btn: Button
var palette: Array = []
var block_panels := {}
var lit: Control
var overlay: Control
var cursor_row: Control
var debug_host := false
var arcade: Control
var url_grade := 0
var player := ""
var direct := ""
var seed := {}

func _ready() -> void:
	f_body = load("res://assets/dejavu.ttf")
	var russo: FontFile = load("res://assets/russo.ttf")
	russo.fallbacks = [f_body]
	f_title = russo
	var th := Theme.new()
	th.default_font = f_body
	th.default_font_size = 15
	theme = th
	for n in SOUNDS:
		var p := AudioStreamPlayer.new()
		p.stream = load("res://assets/%s.ogg" % n)
		p.volume_db = -8.0
		add_child(p)
		sounds[n] = p
	if OS.has_feature("web"):
		debug_host = str(JavaScriptBridge.eval("location.hostname")) == "127.0.0.1" or str(JavaScriptBridge.eval("location.port")) == "18731"
	rng.randomize()
	# Параметры страницы: grade — класс, game=arcade — аркады, play — сразу открыть игру (shop или имя аркады),
	# player — ключ ученика для отдельного сохранения. Прогресс с сервера страница кладёт в sessionStorage.
	var mode := ""
	if OS.has_feature("web"):
		var q = JSON.parse_string(str(JavaScriptBridge.eval("(function(){var p=new URLSearchParams(location.search),s='{}';try{s=sessionStorage.getItem('school4-seed')||'{}'}catch(e){}return JSON.stringify({grade:p.get('grade')||'',game:p.get('game')||'',play:p.get('play')||'',player:p.get('player')||'',seed:s})})()")))
		if q is Dictionary:
			url_grade = int(str(q.get("grade", "")))
			mode = str(q.get("game", ""))
			direct = str(q.get("play", ""))
			var pl := str(q.get("player", ""))
			var clean := RegEx.create_from_string("^[a-z0-9]{1,24}$")
			if clean.search(pl):
				player = pl
			var sd = JSON.parse_string(str(q.get("seed", "{}")))
			if sd is Dictionary:
				seed = sd
	_load()
	for i in Levels.SHOPS.size():
		if Levels.SHOPS[i]["grade"] == url_grade:
			si = i
	if si >= 0 and seed.get("shop") is Dictionary:
		var list: Array = Levels.SHOPS[si]["levels"]
		for k in seed["shop"]:
			var n := int(str(k))
			if n >= 1 and n <= list.size():
				stars[list[n - 1]["id"]] = maxi(int(stars.get(list[n - 1]["id"], 0)), clampi(int(seed["shop"][k]), 0, 3))
	if mode == "arcade" or (direct != "" and direct != "shop"):
		open_arcade(url_grade if url_grade >= 6 and url_grade <= 11 else 6)
	elif si >= 0:
		show_menu()
	else:
		show_shops()

# ---------- сохранение ----------

func _load() -> void:
	# В браузере прогресс лежит в localStorage: запись мгновенная и переживает закрытие вкладки.
	var text := ""
	if OS.has_feature("web"):
		var v = JavaScriptBridge.eval("(function(){try{return localStorage.getItem('%s')||''}catch(e){return ''}})()" % _web_key())
		text = str(v) if v != null else ""
	elif FileAccess.file_exists(SAVE_PATH):
		text = FileAccess.get_file_as_string(SAVE_PATH)
	var raw = JSON.parse_string(text) if text != "" else null
	if not (raw is Dictionary):
		return
	if raw.get("stars") is Dictionary:
		for lv in Levels.all_levels():
			if raw["stars"].has(lv["id"]):
				stars[lv["id"]] = clampi(int(raw["stars"][lv["id"]]), 0, 3)
	if raw.get("programs") is Dictionary:
		programs = raw["programs"]

func _web_key() -> String:
	return WEB_KEY + ("-" + player if player != "" else "")

func _post(msg: Dictionary) -> void:
	# Сообщение странице практикума: она хранит прогресс ученика на сервере и ставит отметку.
	if OS.has_feature("web"):
		JavaScriptBridge.eval("if(parent!==window)parent.postMessage(%s,location.origin);" % JSON.stringify(msg))

func _save() -> void:
	var text := JSON.stringify({"stars": stars, "programs": programs})
	if OS.has_feature("web"):
		JavaScriptBridge.eval("(function(){try{localStorage.setItem('%s',%s)}catch(e){}})()" % [_web_key(), JSON.stringify(text)])
	else:
		var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
		if f:
			f.store_string(text)

func _clean(list, ops: Array, conds: Array) -> Array:
	# Сохранённая программа читается как данные: неизвестные блоки отбрасываются.
	var out := []
	if not (list is Array):
		return out
	for raw in list:
		if not (raw is Dictionary) or not ops.has(raw.get("op", "")):
			continue
		var n := {"op": raw["op"], "id": next_id}
		next_id += 1
		if n["op"] == "repeat":
			n["n"] = clampi(int(raw.get("n", 2)), 2, 9)
		if n["op"] == "if" or n["op"] == "while":
			if conds.is_empty():
				continue
			n["cond"] = raw.get("cond", "") if conds.has(raw.get("cond", "")) else conds[0]
		if n["op"] in ["repeat", "if", "while"]:
			n["body"] = _clean(raw.get("body", []), ops, conds)
		if n["op"] == "if":
			n["alt"] = _clean(raw.get("alt", []), ops, conds)
		out.append(n)
	return out

# ---------- помощники интерфейса ----------

func _sb(bg: Color, radius: int = 10, border: Color = Color(0, 0, 0, 0), bw: int = 0, pad: int = 10, shadow: int = 0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	if bw > 0:
		s.border_color = border
		s.set_border_width_all(bw)
	if shadow > 0:
		s.shadow_color = Color(0, 0, 0, 0.4)
		s.shadow_size = shadow
		s.shadow_offset = Vector2(0, shadow / 3.0)
	s.content_margin_left = pad
	s.content_margin_right = pad
	s.content_margin_top = 3
	s.content_margin_bottom = 3
	s.anti_aliasing = true
	return s

func _sb3d(bg: Color, radius: int, pressed: bool = false) -> StyleBoxFlat:
	# Кнопка с «толщиной»: тёмная нижняя кромка, при нажатии кнопка утапливается.
	var s := _sb(bg, radius)
	s.border_color = bg.darkened(0.38)
	s.border_width_bottom = 1 if pressed else 4
	s.border_width_top = 3 if pressed else 0
	if pressed:
		s.border_color = Color(0, 0, 0, 0)
	return s

func _label(parent: Node, text: String, size: int, color: Color, pos: Vector2 = Vector2.ZERO, sz: Vector2 = Vector2.ZERO, title: bool = false) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if title:
		l.add_theme_font_override("font", f_title)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if sz != Vector2.ZERO:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size = sz
	l.position = pos
	parent.add_child(l)
	return l

func _style_button(b: Button, bg: Color, fsize: int = 15, radius: int = 10) -> void:
	b.focus_mode = Control.FOCUS_NONE
	var flat := bg.a < 0.9
	b.add_theme_stylebox_override("normal", _sb(bg, radius) if flat else _sb3d(bg, radius))
	b.add_theme_stylebox_override("hover", _sb(bg.lightened(0.14), radius) if flat else _sb3d(bg.lightened(0.12), radius))
	b.add_theme_stylebox_override("pressed", _sb(bg.darkened(0.18), radius) if flat else _sb3d(bg.darkened(0.1), radius, true))
	b.add_theme_stylebox_override("disabled", _sb(bg.darkened(0.45), radius))
	b.add_theme_font_size_override("font_size", fsize)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		b.add_theme_color_override(c, Color.WHITE)
	b.add_theme_color_override("font_disabled_color", Color(1, 1, 1, 0.4))

func _button(parent: Node, text: String, cb: Callable, bg: Color, pos: Vector2 = Vector2.ZERO, sz: Vector2 = Vector2.ZERO, fsize: int = 15) -> Button:
	var b := Button.new()
	b.text = text
	_style_button(b, bg, fsize)
	b.position = pos
	if sz != Vector2.ZERO:
		b.size = sz
		b.custom_minimum_size = sz
	b.pressed.connect(cb)
	b.pressed.connect(_sfx.bind("click"))
	parent.add_child(b)
	return b

func _panel(parent: Node, pos: Vector2, sz: Vector2, bg: Color, radius: int = 16, border: Color = Color(0, 0, 0, 0), bw: int = 0) -> Panel:
	var p := Panel.new()
	p.add_theme_stylebox_override("panel", _sb(bg, radius, border, bw, 10, 14))
	p.position = pos
	p.size = sz
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(p)
	return p

func _sfx(n: String) -> void:
	if sounds.has(n):
		sounds[n].play()

func _new_screen() -> Control:
	token += 1
	running = false
	if screen:
		screen.queue_free()
	screen = Control.new()
	screen.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(screen)
	var bg := TextureRect.new()
	bg.texture = load("res://assets/floor.png")
	bg.stretch_mode = TextureRect.STRETCH_TILE
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.modulate = Color(0.2, 0.25, 0.42)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	screen.add_child(bg)
	# Фон цеха (картинка от нейросети): в меню цеха и на его уровнях вместо плитки пола.
	var shop_bg := "res://assets/shop_%d.jpg" % int(Levels.SHOPS[si]["grade"]) if si >= 0 else ""
	if shop_bg != "" and ResourceLoader.exists(shop_bg):
		bg.texture = load(shop_bg)
		bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bg.modulate = Color(0.75, 0.75, 0.8)
	var shade := ColorRect.new()
	var accent: Color = SHOP_COLORS[si] if si >= 0 else Color("3f7fe8")
	shade.color = Color(BG.r, BG.g, BG.b, 0.8 if shop_bg == "" or not ResourceLoader.exists(shop_bg) else 0.66).lerp(Color(accent.r, accent.g, accent.b, 0.8), 0.07)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	screen.add_child(shade)
	# Цветное пятно света сверху и затемнение по краям.
	for spec in [[Color(accent.r, accent.g, accent.b, 0.22), Color(accent.r, accent.g, accent.b, 0.0), Vector2(0.5, 0.0), Vector2(1.0, 0.75)], [Color(0, 0, 0, 0), Color(0.01, 0.02, 0.06, 0.62), Vector2(0.5, 0.5), Vector2(1.05, 1.05)]]:
		var g := Gradient.new()
		g.set_color(0, spec[0])
		g.set_color(1, spec[1])
		var gt := GradientTexture2D.new()
		gt.gradient = g
		gt.fill = GradientTexture2D.FILL_RADIAL
		gt.fill_from = spec[2]
		gt.fill_to = spec[3]
		gt.width = 160
		gt.height = 90
		var tr := TextureRect.new()
		tr.texture = gt
		tr.stretch_mode = TextureRect.STRETCH_SCALE
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.set_anchors_preset(Control.PRESET_FULL_RECT)
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		screen.add_child(tr)
	screen.modulate = Color(1, 1, 1, 0)
	create_tween().tween_property(screen, "modulate", Color.WHITE, 0.22)
	overlay = null
	return screen

func _stars_text(n: int) -> String:
	return "★".repeat(n) + "☆".repeat(3 - n)

func _unlocked(i: int) -> bool:
	return i == 0 or int(stars.get(shop["levels"][i - 1]["id"], 0)) > 0

# ---------- меню ----------

func show_shops() -> void:
	si = -1
	li = -1
	var s := _new_screen()
	_label(s, "КОДОГРАД: МАСТЕРСКАЯ РОБОТОВ", 40, INK, Vector2(48, 30), Vector2.ZERO, true)
	_label(s, "Шесть цехов · 6–11 классы · информатика", 17, GOOD, Vector2(50, 84))
	_label(s, "Глюк сломал завод Кодограда. В каждом цехе робот ждёт новую программу: собери её из блоков, нажми «Пуск» и смотри, как робот выполняет её шаг за шагом. Чем короче программа, тем больше звёзд.", 16, MUTED, Vector2(50, 116), Vector2(1180, 60))
	var total := 0
	for i in Levels.SHOPS.size():
		var sh: Dictionary = Levels.SHOPS[i]
		var got := 0
		for lv in sh["levels"]:
			got += int(stars.get(lv["id"], 0))
		total += got
		var pos := Vector2(48 + (i % 3) * 400, 196 + (i / 3) * 226)
		var b := _button(s, "", _open_shop.bind(i), PANEL2, pos, Vector2(384, 206))
		var pic := "res://assets/shop_%d.jpg" % int(sh["grade"])
		if ResourceLoader.exists(pic):
			var cover := TextureRect.new()
			cover.texture = load(pic)
			cover.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			cover.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
			cover.position = Vector2(4, 4)
			cover.size = Vector2(376, 198)
			cover.modulate = Color(0.42, 0.44, 0.52)
			cover.mouse_filter = Control.MOUSE_FILTER_IGNORE
			b.add_child(cover)
		_card_art(b, SHOP_COLORS[i], SHOP_ICONS[i])
		_label(b, str(sh["grade"]), 62, SHOP_COLORS[i], Vector2(22, 10), Vector2.ZERO, true)
		_label(b, "класс", 14, MUTED, Vector2(26, 82))
		_label(b, sh["title"], 23, INK, Vector2(104, 22), Vector2.ZERO, true)
		_label(b, sh["theme"], 14, MUTED, Vector2(106, 56), Vector2(262, 44))
		_label(b, "★ %d из %d" % [got, sh["levels"].size() * 3], 24, GOLD if got > 0 else Color(1, 1, 1, 0.3), Vector2(24, 120), Vector2.ZERO, true)
		_label(b, "клавиша %d" % (i + 1), 13, Color(1, 1, 1, 0.35), Vector2(24, 168))
	_label(s, "Звёзд: %d из %d" % [total, Levels.SHOPS.size() * 18], 20, GOLD, Vector2(48, 664), Vector2.ZERO, true)
	_button(s, "Аркады: три игры →", open_arcade.bind(6), Color("7c5cf0"), Vector2(1010, 28), Vector2(222, 44))
	_report()
	_label(s, "Выбери цех своего класса. Мышь или клавиши с цифрами, F11 — весь экран", 14, MUTED, Vector2(300, 668))

func _card_art(b: Button, color: Color, icon: String) -> void:
	var strip := ColorRect.new()
	strip.color = color
	strip.position = Vector2(0, 14)
	strip.size = Vector2(5, 178)
	strip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(strip)
	if icon != "" and not icon.begins_with("crate"):
		var art := _label(b, icon, 40, Color(color.r, color.g, color.b, 0.85), Vector2(170, 118), Vector2(196, 56), true)
		art.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		art.autowrap_mode = TextServer.AUTOWRAP_OFF
	elif icon != "":
		var tr := TextureRect.new()
		tr.texture = load("res://assets/%s.png" % icon)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tr.position = Vector2(262, 84)
		tr.size = Vector2(104, 104)
		tr.modulate = Color(color.r, color.g, color.b, 0.9) if icon.begins_with("p_") else Color(1, 1, 1, 0.9)
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		tr.pivot_offset = Vector2(52, 52)
		b.add_child(tr)
		var tw := tr.create_tween().set_loops()
		tw.tween_property(tr, "scale", Vector2(1.06, 1.06), 1.4).set_trans(Tween.TRANS_SINE)
		tw.tween_property(tr, "scale", Vector2.ONE, 1.4).set_trans(Tween.TRANS_SINE)

func open_arcade(grade: int) -> void:
	# Аркады — отдельный раздел игры: свой экран, свои рекорды.
	token += 1
	running = false
	if screen:
		screen.queue_free()
		screen = null
	arcade = Arcade.new()
	arcade.grade = grade
	arcade.f_title = f_title
	arcade.f_body = f_body
	arcade.debug_host = debug_host
	arcade.player = player
	arcade.seed = seed
	arcade.direct = direct if direct != "shop" else ""
	arcade.sfx.connect(_sfx)
	arcade.back.connect(_close_arcade)
	add_child(arcade)

func _close_arcade() -> void:
	if arcade:
		arcade.queue_free()
		arcade = null
	show_shops()

func _open_shop(i: int) -> void:
	si = i
	show_menu()

func show_menu() -> void:
	li = -1
	shop = Levels.SHOPS[si]
	var s := _new_screen()
	if direct == "shop":
		_button(s, "← Практикум", func(): _post({"school4": "close"}), PANEL2, Vector2(28, 28), Vector2(138, 44))
	else:
		_button(s, "← Цеха", show_shops, PANEL2, Vector2(48, 28), Vector2(110, 44))
	_label(s, shop["title"].to_upper(), 40, INK, Vector2(176, 26), Vector2.ZERO, true)
	_label(s, "%d класс · %s" % [shop["grade"], shop["theme"]], 17, GOOD, Vector2(50, 84))
	_label(s, shop["story"] + " Собери программу из блоков, нажми «Пуск» и смотри, как робот выполняет её шаг за шагом. Чем короче программа, тем больше звёзд.", 16, MUTED, Vector2(50, 116), Vector2(1180, 60))
	var total := 0
	var list: Array = shop["levels"]
	for i in list.size():
		var lv: Dictionary = list[i]
		var st := int(stars.get(lv["id"], 0))
		total += st
		var open := _unlocked(i)
		var pos := Vector2(48 + (i % 4) * 298, 188 + (i / 4) * 156)
		var b := _button(s, "", show_level.bind(i), PANEL2 if open else PANEL, pos, Vector2(286, 144))
		b.disabled = not open
		if open:
			var strip := ColorRect.new()
			strip.color = OP_COLORS[lv["ops"][-1]]
			strip.position = Vector2(0, 12)
			strip.size = Vector2(5, 118)
			strip.mouse_filter = Control.MOUSE_FILTER_IGNORE
			b.add_child(strip)
		_label(b, str(i + 1), 40, OP_COLORS[lv["ops"][-1]] if open else Color(1, 1, 1, 0.18), Vector2(16, 6), Vector2.ZERO, true)
		var tl := _label(b, lv["title"], 17, INK if open else Color(1, 1, 1, 0.4), Vector2(70, 12), Vector2(208, 24), true)
		tl.autowrap_mode = TextServer.AUTOWRAP_OFF
		tl.clip_text = true
		_label(b, lv["concept"], 12, MUTED if open else Color(1, 1, 1, 0.3), Vector2(72, 38), Vector2(206, 34))
		_label(b, _stars_text(st), 26, GOLD if st > 0 else Color(1, 1, 1, 0.25), Vector2(16, 72))
		_label(b, ("Память: %d блоков" % lv["limit"]) if open else "Сначала предыдущее", 12, MUTED if open else Color(1, 1, 1, 0.35), Vector2(18, 114))
		if open and i < 9:
			_label(b, "клавиша %d" % (i + 1), 11, Color(1, 1, 1, 0.35), Vector2(206, 116))
	_label(s, "Звёзд: %d из %d" % [total, list.size() * 3], 20, GOLD, Vector2(48, 664), Vector2.ZERO, true)
	_report()
	_label(s, "Мышь или клавиатура: цифры — блоки, ↑ ↓ — курсор, Backspace — удалить, Enter — пуск, F11 — весь экран", 14, MUTED, Vector2(300, 668))

# ---------- уровень ----------

func show_level(i: int) -> void:
	if not _unlocked(i):
		return
	li = i
	level = shop["levels"][i]
	next_id = 1
	program = _clean(programs.get(level["id"], []), level["ops"], level["conds"])
	cur_list = program
	cur_i = program.size()
	var s := _new_screen()
	_button(s, "← Уровни", show_menu, PANEL2, Vector2(16, 12), Vector2(120, 40))
	_label(s, "%d. %s" % [i + 1, level["title"]], 26, INK, Vector2(152, 14), Vector2.ZERO, true)
	_label(s, level["concept"], 15, GOOD, Vector2(154, 0)).position = Vector2(470, 24)
	shift_label = _label(s, "", 15, GOLD, Vector2(760, 24))
	speed_btn = _button(s, "", _cycle_speed, PANEL2, Vector2(1094, 12), Vector2(170, 40))
	_update_speed()

	_panel(s, Vector2(12, 60), Vector2(796, 478), Color(0.05, 0.07, 0.13, 0.75), 18, Color("2c3a5e"), 2)
	board = Board.new()
	board.position = Vector2(16, 64)
	board.font = f_title
	board.labels = level.get("labels", {})
	board.tint = SHOP_TINTS[si]
	board.sfx.connect(_sfx)
	s.add_child(board)
	_preview()

	_panel(s, Vector2(12, 546), Vector2(796, 162), PANEL, 16, Color("2c3a5e"), 2)
	status = _label(s, "", 17, GOLD, Vector2(28, 554), Vector2(764, 26), true)
	_label(s, level["story"], 15, INK, Vector2(28, 584), Vector2(764, 64))
	_label(s, "Подсказка. " + level["hint"], 14, GOOD, Vector2(28, 652), Vector2(764, 50))

	_panel(s, Vector2(816, 60), Vector2(452, 648), PANEL, 16, Color("2c3a5e"), 2)
	_label(s, "БЛОКИ", 14, MUTED, Vector2(832, 68), Vector2.ZERO, true)
	palette.clear()
	var ops: Array = level["ops"]
	for k in ops.size():
		var op: String = ops[k]
		var b := _button(s, "%d  %s %s" % [k + 1, Levels.OP_ICONS[op], Levels.OP_NAMES[op]], _insert.bind(op), OP_COLORS[op], Vector2(830 + (k % 3) * 144, 90 + (k / 3) * 44), Vector2(138, 38), 14)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		palette.append(b)
	var py := 90 + ((ops.size() + 2) / 3) * 44 + 4
	_label(s, "ПРОГРАММА РОБОТА", 14, MUTED, Vector2(832, py), Vector2.ZERO, true)
	counter = _label(s, "", 14, INK, Vector2(1040, py), Vector2(212, 20))
	counter.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_panel(s, Vector2(826, py + 24), Vector2(432, 648 - (py - 60) - 24 - 64), Color(0.05, 0.07, 0.13, 0.7), 12)
	scroll = ScrollContainer.new()
	scroll.position = Vector2(832, py + 30)
	scroll.size = Vector2(420, 648 - (py - 60) - 24 - 76)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	s.add_child(scroll)
	rows_box = VBoxContainer.new()
	rows_box.add_theme_constant_override("separation", 4)
	rows_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(rows_box)
	run_btn = _button(s, "▶  Пуск (Enter)", _run_or_stop, Color("21a366"), Vector2(830, 656), Vector2(230, 44), 18)
	_button(s, "⌫ Удалить", _backspace, PANEL2, Vector2(1066, 656), Vector2(96, 44), 13)
	_button(s, "Очистить", _clear, Color("7a3340"), Vector2(1168, 656), Vector2(90, 44), 13)
	_say("Собери программу из блоков и нажми «Пуск».", GOLD)
	_rebuild()

func _preview() -> void:
	# До запуска поле показывает задание; случайные данные скрыты знаком «?».
	var hide: bool = level.has("random")
	var data = Sim.random_data(level, rng) if level.get("world", "store") == "array" else level.get("queue", [])
	if level.get("world", "store") == "store" and hide:
		data = []
		for k in int(level["random"]["n"]):
			data.append(level["random"]["colors"][0])
	board.set_world(Sim.make_world(level, 0, data), hide)
	if shift_label:
		shift_label.text = ("%d смены · данные случайные" % level["shifts"]) if hide else (("%d смены · карта меняется" % level["shifts"]) if level.has("shifts") else "")

func _say(text: String, color: Color = INK) -> void:
	if status:
		status.text = text
		status.add_theme_color_override("font_color", color)
	_report()

func _report() -> void:
	# Только на тестовом стенде: состояние игры видно автотесту в браузере.
	if not debug_host:
		return
	var st := {"shop": si, "level": li, "running": running, "status": status.text if is_instance_valid(status) else "", "stars": stars, "blocks": Sim.count(program), "won": overlay != null}
	JavaScriptBridge.eval("window.workshop=%s;" % JSON.stringify(st))

func _cycle_speed() -> void:
	speed_i = (speed_i + 1) % SPEEDS.size()
	_update_speed()

func _update_speed() -> void:
	if speed_btn:
		speed_btn.text = "Скорость ×%d (Tab)" % int(SPEEDS[speed_i])

# ---------- редактор программы ----------

func _flatten(list: Array, depth: int, rows: Array) -> void:
	for i in list.size():
		rows.append({"k": "pos", "list": list, "i": i, "d": depth, "end": false})
		var n: Dictionary = list[i]
		rows.append({"k": "node", "n": n, "list": list, "i": i, "d": depth})
		if n.has("body"):
			_flatten(n["body"], depth + 1, rows)
		if n.has("alt"):
			rows.append({"k": "else", "n": n, "d": depth})
			_flatten(n["alt"], depth + 1, rows)
	rows.append({"k": "pos", "list": list, "i": list.size(), "d": depth, "end": true})

func _is_cursor(r: Dictionary) -> bool:
	return is_same(r["list"], cur_list) and r["i"] == cur_i

func _indent(row: HBoxContainer, depth: int) -> void:
	if depth > 0:
		var sp := Control.new()
		sp.custom_minimum_size = Vector2(depth * 24, 0)
		row.add_child(sp)

func _mini(parent: Node, text: String, cb: Callable, w: int = 30) -> Button:
	var b := Button.new()
	b.text = text
	_style_button(b, Color(0, 0, 0, 0.28), 14, 7)
	b.custom_minimum_size = Vector2(w, 26)
	b.pressed.connect(cb)
	parent.add_child(b)
	return b

func _rebuild() -> void:
	for ch in rows_box.get_children():
		rows_box.remove_child(ch)
		ch.queue_free()
	block_panels.clear()
	lit = null
	cursor_row = null
	var rows := []
	_flatten(program, 0, rows)
	for r in rows:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 4)
		_indent(row, r["d"])
		if r["k"] == "pos":
			if _is_cursor(r):
				var cr := ColorRect.new()
				cr.color = GOLD
				cr.custom_minimum_size = Vector2(190, 5)
				cr.size_flags_vertical = Control.SIZE_SHRINK_CENTER
				row.add_child(cr)
				var hintl := Label.new()
				hintl.text = "сюда встанет блок"
				hintl.add_theme_font_size_override("font_size", 11)
				hintl.add_theme_color_override("font_color", GOLD)
				row.add_child(hintl)
				cursor_row = row
				var pulse := cr.create_tween().set_loops()
				pulse.tween_property(cr, "modulate", Color(1, 1, 1, 0.35), 0.45)
				pulse.tween_property(cr, "modulate", Color.WHITE, 0.45)
			elif r["end"]:
				var b := Button.new()
				b.text = "＋ вставлять сюда" if r["d"] > 0 else "＋ в конец программы"
				b.text = b.text.replace("＋", "+")
				_style_button(b, Color(1, 1, 1, 0.06), 11, 7)
				b.add_theme_color_override("font_color", MUTED)
				b.custom_minimum_size = Vector2(150, 20)
				b.pressed.connect(_set_cursor.bind(r["list"], r["i"]))
				row.add_child(b)
			else:
				continue
		elif r["k"] == "else":
			var pc := PanelContainer.new()
			pc.add_theme_stylebox_override("panel", _sb(OP_COLORS["if"].darkened(0.25), 8))
			var b := Button.new()
			b.text = "иначе"
			b.flat = true
			b.focus_mode = Control.FOCUS_NONE
			b.add_theme_font_size_override("font_size", 14)
			b.pressed.connect(_set_cursor.bind(r["n"]["alt"], 0))
			pc.add_child(b)
			row.add_child(pc)
		else:
			_block_row(row, r)
		rows_box.add_child(row)
	var n := Sim.count(program)
	counter.text = "Блоков: %d из %d" % [n, level["limit"]]
	counter.add_theme_color_override("font_color", BAD if n >= level["limit"] else INK)
	for b in palette:
		b.disabled = running or n >= level["limit"]
	programs[level["id"]] = program
	_report()
	_scroll_to_cursor()

func _block_row(row: HBoxContainer, r: Dictionary) -> void:
	var n: Dictionary = r["n"]
	var op: String = n["op"]
	var pc := PanelContainer.new()
	var st := _sb(OP_COLORS[op], 9, Color(1, 1, 1, 0.9), 0, 6)
	st.border_color = OP_COLORS[op].darkened(0.4)
	st.border_width_bottom = 3
	st.border_width_left = 5
	pc.add_theme_stylebox_override("panel", st)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 4)
	pc.add_child(h)
	var b := Button.new()
	b.text = "%s %s" % [Levels.OP_ICONS[op], Levels.OP_NAMES[op]]
	b.flat = true
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 15)
	b.add_theme_color_override("font_color", Color.WHITE)
	b.add_theme_color_override("font_hover_color", Color.WHITE)
	b.custom_minimum_size = Vector2(0, 28)
	b.pressed.connect(_set_cursor.bind(r["list"], r["i"] + 1))
	h.add_child(b)
	if op == "repeat":
		_mini(h, "−", _change_n.bind(n, -1))
		var l := Label.new()
		l.text = "%d раз" % n["n"]
		l.add_theme_font_size_override("font_size", 15)
		h.add_child(l)
		_mini(h, "+", _change_n.bind(n, 1))
	elif op == "if" or op == "while":
		_mini(h, Levels.COND_NAMES[n["cond"]] + " ▾", _cycle_cond.bind(n), 150)
	_mini(h, "✕", _remove.bind(r["list"], r["i"]), 26)
	row.add_child(pc)
	block_panels[n["id"]] = pc

func _scroll_to_cursor() -> void:
	await get_tree().process_frame
	if is_instance_valid(cursor_row) and is_instance_valid(scroll):
		scroll.ensure_control_visible(cursor_row)

func _touch() -> void:
	# Любая правка возвращает поле в исходное состояние.
	if overlay:
		overlay.queue_free()
		overlay = null
	_preview()
	_rebuild()
	_save()

func _set_cursor(list: Array, i: int) -> void:
	if running:
		return
	cur_list = list
	cur_i = clampi(i, 0, list.size())
	_rebuild()

func _insert(op: String) -> void:
	if running or li < 0 or not level["ops"].has(op):
		return
	if Sim.count(program) >= level["limit"]:
		_say("Память робота заполнена: %d блоков. Сократи программу." % level["limit"], BAD)
		_sfx("error")
		return
	var n := {"op": op, "id": next_id}
	next_id += 1
	if op == "repeat":
		n["n"] = 2
	if op == "if" or op == "while":
		var conds: Array = level["conds"]
		if conds.is_empty():
			return
		n["cond"] = "free" if op == "while" and conds.has("free") else conds[0]
	if op in ["repeat", "if", "while"]:
		n["body"] = []
	if op == "if":
		n["alt"] = []
	cur_list.insert(cur_i, n)
	if n.has("body"):
		cur_list = n["body"]
		cur_i = 0
	else:
		cur_i += 1
	_touch()

func _remove(list: Array, i: int) -> void:
	if running or i < 0 or i >= list.size():
		return
	list.remove_at(i)
	cur_list = list
	cur_i = i
	_touch()

func _backspace() -> void:
	if running:
		return
	if cur_i > 0:
		_remove(cur_list, cur_i - 1)
	else:
		_move_cursor(-1)

func _clear() -> void:
	if running:
		return
	program.clear()
	cur_list = program
	cur_i = 0
	_say("Программа очищена.", MUTED)
	_touch()

func _owner_of(list: Array, where: Array) -> Variant:
	for n in where:
		if n.has("body"):
			if is_same(n["body"], list):
				return n
			var r = _owner_of(list, n["body"])
			if r != null:
				return r
		if n.has("alt"):
			if is_same(n["alt"], list):
				return n
			var r2 = _owner_of(list, n["alt"])
			if r2 != null:
				return r2
	return null

func _change_n(n: Dictionary, d: int) -> void:
	if running:
		return
	n["n"] = clampi(int(n["n"]) + d, 2, 9)
	_touch()

func _cycle_cond(n: Dictionary) -> void:
	if running:
		return
	var conds: Array = level["conds"]
	n["cond"] = conds[(conds.find(n["cond"]) + 1) % conds.size()]
	_touch()

func _move_cursor(d: int) -> void:
	if running:
		return
	var rows := []
	_flatten(program, 0, rows)
	var pos := []
	for r in rows:
		if r["k"] == "pos":
			pos.append(r)
	for k in pos.size():
		if _is_cursor(pos[k]):
			var t: Dictionary = pos[clampi(k + d, 0, pos.size() - 1)]
			cur_list = t["list"]
			cur_i = t["i"]
			break
	_rebuild()

# ---------- запуск ----------

func _wait(t: float) -> void:
	await get_tree().create_timer(t).timeout

func _variants() -> Array:
	return Sim.sample(level, int(level.get("shifts", 1)), rng)

func _light(id: int, bad: bool) -> void:
	if is_instance_valid(lit):
		lit.modulate = Color.WHITE
	lit = block_panels.get(id)
	if is_instance_valid(lit):
		lit.modulate = Color(1.7, 0.6, 0.6) if bad else Color(1.45, 1.45, 1.45)
		scroll.ensure_control_visible(lit)

func _set_running(v: bool) -> void:
	running = v
	if is_instance_valid(run_btn):
		run_btn.text = "■  Стоп (Esc)" if v else "▶  Пуск (Enter)"
		_style_button(run_btn, Color("b8452f") if v else Color("21a366"), 18)
	for b in palette:
		if is_instance_valid(b):
			b.disabled = v or Sim.count(program) >= level["limit"]

func _run_or_stop() -> void:
	if running:
		_stop()
	else:
		_run()

func _stop() -> void:
	token += 1
	_set_running(false)
	_light(-1, false)
	_preview()
	_say("Остановлено. Можно править программу.", MUTED)

func _run() -> void:
	if running or li < 0:
		return
	if overlay:
		overlay.queue_free()
		overlay = null
	if program.is_empty():
		_say("Программа пустая: добавь блоки справа.", BAD)
		_sfx("error")
		return
	token += 1
	var my := token
	_set_running(true)
	var vars := _variants()
	for s in vars.size():
		var w := Sim.make_world(level, vars[s]["map"], vars[s]["data"])
		board.set_world(w.duplicate(true), false)
		if vars.size() > 1:
			shift_label.text = "Смена %d из %d" % [s + 1, vars.size()]
			_say("Смена %d из %d: робот выполняет программу…" % [s + 1, vars.size()], GOLD)
		else:
			_say("Робот выполняет программу…", GOLD)
		var res := Sim.run(program, w)
		await _wait(0.45 / SPEEDS[speed_i])
		if my != token:
			return
		for ev in res["events"]:
			var d: float = DUR[ev["t"]] / SPEEDS[speed_i]
			if d <= 0.0:
				continue
			_light(ev["id"], ev["t"] == "fail" or ev["t"] == "bump")
			board.play(ev, d)
			await _wait(d)
			if my != token:
				return
		if not res["ok"]:
			_set_running(false)
			_say(res["msg"], BAD)
			return
		await _wait(0.5 / SPEEDS[speed_i])
		if my != token:
			return
	_set_running(false)
	_light(-1, false)
	_win()

func _win() -> void:
	var n := Sim.count(program)
	var st := 3 if n <= level["par3"] else (2 if n <= level["par2"] else 1)
	var id: String = level["id"]
	stars[id] = maxi(int(stars.get(id, 0)), st)
	_save()
	if shop["grade"] == url_grade:
		_post({"school4": "result", "world": "shop", "n": li + 1, "stars": int(stars[id]), "detail": "блоков: %d" % n})
	_say("Задание выполнено!", GOOD)
	overlay = _panel(screen, Vector2(170, 150), Vector2(480, 300), Color("16203a"), 22, GOLD, 3)
	overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	var t := _label(overlay, "ЗАДАНИЕ ВЫПОЛНЕНО!", 30, INK, Vector2(0, 22), Vector2(480, 40), true)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	overlay.pivot_offset = Vector2(240, 150)
	overlay.scale = Vector2(0.7, 0.7)
	overlay.create_tween().tween_property(overlay, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	for k in 3:
		var star := _label(overlay, "★", 68, GOLD if k < st else Color(1, 1, 1, 0.16), Vector2(120 + k * 84, 58), Vector2.ZERO)
		star.pivot_offset = Vector2(34, 44)
		if k < st:
			star.scale = Vector2.ZERO
			var tws := star.create_tween()
			tws.tween_interval(0.25 + k * 0.28)
			tws.tween_callback(_sfx.bind("deliver"))
			tws.tween_property(star, "scale", Vector2(1.35, 1.35), 0.16)
			tws.tween_property(star, "scale", Vector2.ONE, 0.14)
	var conf := CPUParticles2D.new()
	conf.position = Vector2(240, 20)
	conf.amount = 70
	conf.lifetime = 2.2
	conf.one_shot = true
	conf.explosiveness = 0.85
	conf.direction = Vector2(0, -1)
	conf.spread = 75.0
	conf.initial_velocity_min = 220.0
	conf.initial_velocity_max = 520.0
	conf.gravity = Vector2(0, 620)
	conf.angular_velocity_min = -360.0
	conf.angular_velocity_max = 360.0
	conf.scale_amount_min = 5.0
	conf.scale_amount_max = 10.0
	var ramp := Gradient.new()
	ramp.colors = PackedColorArray([Color("ffd34d"), Color("5fe0b5"), Color("ff7a9a"), Color("7db4ff")])
	ramp.offsets = PackedFloat32Array([0.0, 0.33, 0.66, 1.0])
	conf.color_initial_ramp = ramp
	conf.emitting = true
	overlay.add_child(conf)
	var note := "Блоков в программе: %d. " % n
	if st == 3:
		note += "Отличная короткая программа!"
	elif st == 2:
		note += "На три звезды нужно не больше %d." % level["par3"]
	else:
		note += "Две звезды — до %d блоков, три — до %d." % [level["par2"], level["par3"]]
	var nl := _label(overlay, note, 15, MUTED, Vector2(30, 158), Vector2(420, 50))
	nl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_button(overlay, "Улучшить программу", _touch, PANEL2, Vector2(30, 226), Vector2(200, 48))
	if li + 1 < shop["levels"].size():
		_button(overlay, "Дальше →  (Enter)", show_level.bind(li + 1), Color("21a366"), Vector2(250, 226), Vector2(200, 48))
	else:
		_button(overlay, "К уровням (Enter)", show_menu, Color("21a366"), Vector2(250, 226), Vector2(200, 48))
	_report()

# ---------- клавиатура ----------

func _input(event: InputEvent) -> void:
	if arcade or not (event is InputEventKey) or not event.pressed:
		return
	var k: int = event.physical_keycode
	var digit := -1
	if k >= KEY_1 and k <= KEY_9:
		digit = k - KEY_1
	elif k >= KEY_KP_1 and k <= KEY_KP_9:
		digit = k - KEY_KP_1
	if li < 0:
		if event.echo:
			return
		if si < 0:
			if digit >= 0 and digit < Levels.SHOPS.size():
				_open_shop(digit)
		elif digit >= 0 and digit < shop["levels"].size():
			show_level(digit)
		elif k == KEY_ESCAPE:
			if direct == "shop":
				_post({"school4": "close"})
			else:
				show_shops()
		return
	if event.echo and not (k in [KEY_UP, KEY_DOWN, KEY_BACKSPACE]):
		return
	if k == KEY_ESCAPE:
		if running:
			_stop()
		else:
			show_menu()
	elif k == KEY_ENTER or k == KEY_KP_ENTER:
		if overlay:
			if li + 1 < shop["levels"].size():
				show_level(li + 1)
			else:
				show_menu()
		else:
			_run()
	elif k == KEY_TAB:
		_cycle_speed()
	elif running:
		return
	elif digit >= 0:
		if digit < level["ops"].size():
			_sfx("click")
			_insert(level["ops"][digit])
	elif k == KEY_BACKSPACE or k == KEY_DELETE:
		_backspace()
	elif k == KEY_UP:
		_move_cursor(-1)
	elif k == KEY_DOWN:
		_move_cursor(1)
	elif k in [KEY_EQUAL, KEY_KP_ADD, KEY_MINUS, KEY_KP_SUBTRACT]:
		var o: Variant = _owner_of(cur_list, program)
		if o != null and o["op"] == "repeat":
			_change_n(o, 1 if k in [KEY_EQUAL, KEY_KP_ADD] else -1)
	elif k == KEY_C:
		var o: Variant = _owner_of(cur_list, program)
		if o != null and o.has("cond"):
			_cycle_cond(o)
	else:
		return
	get_viewport().set_input_as_handled()
