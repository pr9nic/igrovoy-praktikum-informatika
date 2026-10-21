extends Control
# «Кодоград: Аркады» — выбор класса и игры, рекорды, запуск аркад.

signal back
signal sfx(name: String)

const GAMES := [
	{"id": "bits", "script": preload("res://arcade/bits.gd"), "title": "Двоичный десант", "genre": "стрелялка", "color": Color("7c5cf0"), "art": "101",
		"about": {6: "Набирай числа от 1 до 15 четырьмя битами и сбивай вирусы.", 7: "Шесть бит, числа до 63.", 8: "Целый байт: числа до 255.", 9: "Вирусы с числами в восьмеричной и шестнадцатеричной записи.", 10: "Отрицательные числа в дополнительном коде.", 11: "Поразрядные И, ИЛИ, ⊕, НЕ и сдвиги."}},
	{"id": "merge", "script": preload("res://arcade/merge.gd"), "title": "2048: биты и байты", "genre": "головоломка", "color": Color("e2792f"), "art": "2ⁿ",
		"about": {6: "Складывай байты, пока не соберёшь килобайт.", 7: "От одного бита до байтов и дальше.", 8: "Степени двойки в двоичной записи.", 9: "Степени двойки: от 2⁰ до 2¹⁰.", 10: "Степени двойки в шестнадцатеричной записи.", 11: "Из килобайтов собери мегабайт."}},
	{"id": "snake", "script": preload("res://arcade/snake.gd"), "title": "Змейка: по порядку", "genre": "аркада", "color": Color("21a38a"), "art": "1<2",
		"about": {6: "Сравнивай объёмы в битах и байтах, ешь по возрастанию.", 7: "Биты, байты и килобайты — что меньше?", 8: "Двоичные и десятичные числа по возрастанию.", 9: "Четыре системы счисления на одном поле.", 10: "Восьмеричные и шестнадцатеричные числа до 1023.", 11: "Степени двойки и числа в разных системах."}},
	{"id": "net", "script": preload("res://arcade/net.gd"), "title": "Сеть", "genre": "головоломка", "color": Color("2f7fd0"), "art": "⊞",
		"about": {6: "Поверни кабели и подключи все компьютеры к серверу. Поле 4×4.", 7: "Сеть 4×4: сигнал должен дойти до каждого компьютера.", 8: "Сеть 5×5: кабелей больше, тупиков тоже.", 9: "Сеть 5×5. Готовая сеть — дерево без лишних связей.", 10: "Сеть 6×6: 36 узлов и 35 кабелей.", 11: "Сеть 6×6: связный граф без циклов."}},
	{"id": "route", "script": preload("res://arcade/route.gd"), "title": "Курьер", "genre": "стратегия", "color": Color("c2456b"), "art": "А→Б",
		"about": {6: "Найди самый короткий путь по схеме дорог. 16 этапов: дальше — односторонние улицы и посылки.", 7: "Схема из восьми пунктов: сравни несколько маршрутов.", 8: "Граф из десяти вершин: ищи кратчайший путь.", 9: "Взвешенный граф: «жадный» путь не всегда лучший.", 10: "Тринадцать вершин: считай длины путей.", 11: "До 32 вершин, ориентированный граф и промежуточный пункт: кратчайший путь, как в алгоритме Дейкстры."}},
	{"id": "files", "script": preload("res://arcade/files.gd"), "title": "Проводник", "genre": "поиск", "color": Color("b8892a"), "art": "C:\\",
		"about": {6: "Пройди по папкам к файлу по его полному пути.", 7: "Диск, папки, имя файла: читай полный путь.", 8: "Относительные пути: «..» поднимает на папку выше.", 9: "Относительные пути между дальними папками.", 10: "Найди файл по маске с «?» и «*».", 11: "Маски имён файлов, как в заданиях экзамена."}},
	{"id": "cells", "script": preload("res://cells/game.gd"), "title": "Клетки памяти", "genre": "экшен с забегами", "color": Color("5a3fb8"), "art": "⚔",
		"about": {6: "Пять зон, которые каждый раз собираются заново. Бей багов и отвечай на терминалах знаний.", 7: "Перекат, меч, выстрел — и вопросы про биты и байты.", 8: "Терминалы спрашивают системы счисления и логику.", 9: "Каждый забег новый. Знания дают звёзды и снимают щит с босса.", 10: "Экшен с забегами: логика, двоичный и шестнадцатеричный код.", 11: "Пять зон и Глюк в конце. Ошибка на терминале порождает бага."}},
	{"id": "blox", "script": preload("res://blox/game.gd"), "title": "Кодоблокс", "genre": "3D-мир", "color": Color("2f9be0"), "art": "▣",
		"about": {6: "3D-мир в духе Roblox: обби, тайкун и симулятор. Двери с ответами и мост из битов.", 7: "Обби, тайкун и симулятор: биты, байты и двоичный код прямо в игре.", 8: "Мост из двоичных плиток, цены в 0b и степенях двойки.", 9: "Тайкун с ценами в 0x и Кбайтах, двери с программами.", 10: "Четыре мира, Кодобаксы и облик героя.", 11: "Сложное обби «Стеклянный мост»: 8 бит над пропастью."}},
	{"id": "board", "script": preload("res://arcade/board.gd"), "title": "Кодополия", "genre": "настольная игра", "color": Color("e0457b"), "art": "⚂",
		"about": {6: "Настольная игра против трёх ботов: кварталы, кристаллы знаний и мини-игры.", 7: "Покупай кварталы, отвечай «файрволу знаний» и собирай кристаллы.", 8: "Двоичные дуэли, вопросы и карты «Вирус / Обновление».", 9: "Мини-игры с системами счисления и вопросы класса.", 10: "Три поля, боты умнеют с каждым этапом.", 11: "Стратегия: участки, предметы и кристаллы — плюс вопросы по информатике."}},
]
const KEY := "school4-arcade-v1"
const BG := Color("121829")
const INK := Color("e8eefb")
const MUTED := Color("9fb2d6")
const GOLD := Color("ffd34d")

var grade := 6
var f_title: Font
var f_body: Font
var debug_host := false
var best := {}
var ui: Control
var game: Node2D
var game_id := ""
var report_in := 0.0
var player := ""     # ключ ученика: у каждого своё сохранение в браузере
var direct := ""     # игра, открытая прямо со страницы практикума
var seed := {}       # звёзды с сервера: {игра: {этап: звёзды}}

func _ready() -> void:
	position = Vector2.ZERO
	size = Vector2(1280, 720)
	_load()
	_apply_seed()
	_build()
	for i in GAMES.size():
		if GAMES[i]["id"] == direct:
			play(i)

func _key() -> String:
	return KEY + ("-" + player if player != "" else "")

func _apply_seed() -> void:
	# Прогресс, сохранённый на сервере, открывает этапы и на новом компьютере.
	var changed := false
	for gm in GAMES:
		var got = seed.get(gm["id"])
		if not (got is Dictionary):
			continue
		var done := _stages(gm["id"])
		for k in got:
			var n := int(str(k))
			var st := clampi(int(got[k]), 0, 3)
			if n >= 1 and n <= 16 and st > int(done.get(n, 0)):
				done[n] = st
				changed = true
		if changed:
			_store(gm["id"], done)
	if changed:
		_save()

func _store(id: String, done: Dictionary) -> void:
	var key := str(grade)
	if not (best.get(key) is Dictionary):
		best[key] = {}
	var packed := {}
	for n in done:
		packed[str(n)] = done[n]
	best[key][id] = {"stages": packed}

func _load() -> void:
	var text := ""
	if OS.has_feature("web"):
		var v = JavaScriptBridge.eval("(function(){try{return localStorage.getItem('%s')||''}catch(e){return ''}})()" % _key())
		text = str(v) if v != null else ""
	elif FileAccess.file_exists("user://arcade.json"):
		text = FileAccess.get_file_as_string("user://arcade.json")
	var raw = JSON.parse_string(text) if text != "" else null
	if raw is Dictionary:
		best = raw

func _save() -> void:
	var text := JSON.stringify(best)
	if OS.has_feature("web"):
		JavaScriptBridge.eval("(function(){try{localStorage.setItem('%s',%s)}catch(e){}})()" % [_key(), JSON.stringify(text)])
	else:
		var f := FileAccess.open("user://arcade.json", FileAccess.WRITE)
		if f:
			f.store_string(text)

func _stages(id: String) -> Dictionary:
	# Звёзды по этапам игры: {номер этапа: 1..3}.
	var out := {}
	var g = best.get(str(grade), {})
	var r = g.get(id, {}) if g is Dictionary else {}
	var st = r.get("stages", {}) if r is Dictionary else {}
	if st is Dictionary:
		for k in st:
			var n := int(str(k))
			if n >= 1 and n <= 16:
				out[n] = clampi(int(st[k]), 1, 3)
	return out

func _sb(bg: Color, radius: int = 14, border: Color = Color(0, 0, 0, 0), bw: int = 0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	s.anti_aliasing = true
	if bw > 0:
		s.border_color = border
		s.set_border_width_all(bw)
	s.border_width_bottom = maxi(bw, 5)
	if bw == 0:
		s.border_color = bg.darkened(0.4)
	s.shadow_color = Color(0, 0, 0, 0.35)
	s.shadow_size = 10
	s.shadow_offset = Vector2(0, 4)
	return s

func _label(parent: Node, text: String, size: int, color: Color, pos: Vector2, sz: Vector2 = Vector2.ZERO, title: bool = false) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_font_override("font", f_title if title else f_body)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if sz != Vector2.ZERO:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size = sz
	l.position = pos
	parent.add_child(l)
	return l

func _button(parent: Node, text: String, cb: Callable, bg: Color, pos: Vector2, sz: Vector2, fsize: int = 15) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_stylebox_override("normal", _sb(bg))
	b.add_theme_stylebox_override("hover", _sb(bg.lightened(0.12)))
	b.add_theme_stylebox_override("pressed", _sb(bg.darkened(0.12)))
	b.add_theme_font_override("font", f_body)
	b.add_theme_font_size_override("font_size", fsize)
	for c in ["font_color", "font_hover_color", "font_pressed_color"]:
		b.add_theme_color_override(c, Color.WHITE)
	b.position = pos
	b.size = sz
	b.pressed.connect(cb)
	parent.add_child(b)
	return b

func _build() -> void:
	if ui:
		ui.queue_free()
	ui = Control.new()
	ui.size = Vector2(1280, 720)
	add_child(ui)
	var bg := TextureRect.new()
	bg.texture = load("res://assets/floor.png")
	bg.stretch_mode = TextureRect.STRETCH_TILE
	bg.size = Vector2(1280, 720)
	bg.modulate = Color(0.24, 0.2, 0.42)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(bg)
	var shade := ColorRect.new()
	shade.color = Color(0.08, 0.07, 0.17, 0.82)
	shade.size = Vector2(1280, 720)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(shade)
	_label(ui, "КОДОГРАД: АРКАДЫ", 42, INK, Vector2(48, 18), Vector2.ZERO, true)
	_label(ui, "%d класс · семь игр разных жанров · информатика" % grade, 17, Color("5fe0b5"), Vector2(50, 74))
	_label(ui, "Класс:", 15, MUTED, Vector2(760, 44))
	for g in range(6, 12):
		var b := _button(ui, str(g), _set_grade.bind(g), Color("7c5cf0") if g == grade else Color("232d4a"), Vector2(826 + (g - 6) * 54, 32), Vector2(46, 40), 17)
		b.tooltip_text = "%d класс" % g
	_button(ui, "Мастерская роботов →", func(): back.emit(), Color("232d4a"), Vector2(1010, 660), Vector2(222, 40), 14)
	var total := 0
	var total_max := 0
	for i in GAMES.size():
		var gm: Dictionary = GAMES[i]
		var done := _stages(gm["id"])
		var count: int = {"merge": 6, "cells": 5, "route": 16}.get(gm["id"], 10)
		var got := 0
		for n in done:
			got += done[n]
		total += got
		total_max += count * 3
		var col: Color = gm["color"]
		var card := _button(ui, "", play.bind(i), Color("202a49"), Vector2(40 + (i % 4) * 302, 126 + (i / 4) * 264), Vector2(290, 250))
		var top := Panel.new()
		var st := StyleBoxFlat.new()
		st.bg_color = col.darkened(0.25)
		st.corner_radius_top_left = 14
		st.corner_radius_top_right = 14
		top.add_theme_stylebox_override("panel", st)
		top.position = Vector2(0, 0)
		top.size = Vector2(290, 84)
		top.mouse_filter = Control.MOUSE_FILTER_IGNORE
		card.add_child(top)
		# Обложка игры поверх цветной шапки.
		if ResourceLoader.exists("res://assets/cover_%s.jpg" % gm["id"]):
			var pic := TextureRect.new()
			pic.texture = load("res://assets/cover_%s.jpg" % gm["id"])
			pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
			pic.position = Vector2(3, 3)
			pic.size = Vector2(284, 84)
			pic.clip_contents = true
			pic.mouse_filter = Control.MOUSE_FILTER_IGNORE
			pic.modulate = Color(0.92, 0.92, 0.92)
			card.add_child(pic)
		var art := _label(card, gm["art"] if not ResourceLoader.exists("res://assets/cover_%s.jpg" % gm["id"]) else "", 40, Color(1, 1, 1, 0.92), Vector2(60, 12), Vector2(220, 60), true)
		art.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		art.autowrap_mode = TextServer.AUTOWRAP_OFF
		art.pivot_offset = Vector2(180, 30)
		var tw := art.create_tween().set_loops()
		tw.tween_property(art, "scale", Vector2(1.07, 1.07), 1.2 + i * 0.2).set_trans(Tween.TRANS_SINE)
		tw.tween_property(art, "scale", Vector2.ONE, 1.2 + i * 0.2).set_trans(Tween.TRANS_SINE)
		_label(card, gm["genre"].to_upper(), 11, Color(1, 1, 1, 0.8), Vector2(14, 58), Vector2.ZERO, true)
		var kl := _label(card, str(i + 1), 26, Color(1, 1, 1, 0.9), Vector2(14, 8), Vector2.ZERO, true)
		kl.tooltip_text = "клавиша %d" % (i + 1)
		var tl := _label(card, gm["title"], 18, INK, Vector2(14, 94), Vector2(264, 26), true)
		tl.autowrap_mode = TextServer.AUTOWRAP_OFF
		tl.clip_text = true
		_label(card, gm["about"][grade], 13, MUTED, Vector2(14, 124), Vector2(264, 62))
		_label(card, "★ %d из %d" % [got, count * 3], 22, GOLD if got > 0 else Color(1, 1, 1, 0.3), Vector2(14, 190), Vector2.ZERO, true)
		_label(card, ("Этапов: %d из %d" % [done.size(), count]) if done.size() > 0 else ("%d этапов" % count), 12, MUTED, Vector2(14, 222))
	_label(ui, "Звёзд в этом классе: %d из %d" % [total, total_max], 20, GOLD, Vector2(48, 664), Vector2.ZERO, true)
	_label(ui, "Клавиши 1–7 — выбрать игру, Esc — вернуться сюда, F11 — весь экран", 14, MUTED, Vector2(400, 668))
	ui.modulate = Color(1, 1, 1, 0)
	create_tween().tween_property(ui, "modulate", Color.WHITE, 0.2)
	_report()

func _set_grade(g: int) -> void:
	grade = g
	sfx.emit("click")
	_build()

func play(i: int) -> void:
	if game:
		return
	var gm: Dictionary = GAMES[i]
	game_id = gm["id"]
	game = gm["script"].new()
	game.grade = grade
	game.bg_name = game_id if game_id != "cells" else ""
	game.font = f_body
	game.font_b = f_title
	if "player" in game:
		game.player = player
		game.debug_keys = debug_host
	game.done_stars = _stages(game_id)
	game.result.connect(_on_result)
	game.leave.connect(_on_leave)
	game.sfx.connect(func(n): sfx.emit(n))
	ui.visible = false
	add_child(game)
	# Число этапов игра сообщает в своём setup(), поэтому первый непройденный этап выбираем после добавления в сцену.
	game.stage = game.unlocked()
	game.preview()
	sfx.emit("click")

func _on_result(stage: int, stars: int) -> void:
	var done := _stages(game_id)
	if stars > int(done.get(stage, 0)):
		done[stage] = stars
		_store(game_id, done)
		_save()
	_post({"school4": "result", "world": game_id, "n": stage, "stars": int(done[stage]), "detail": "этап %d" % stage})

func _post(msg: Dictionary) -> void:
	# Сообщение странице практикума (она хранит прогресс ученика на сервере и ставит отметку).
	if OS.has_feature("web"):
		JavaScriptBridge.eval("if(parent!==window)parent.postMessage(%s,location.origin);" % JSON.stringify(msg))

func _on_leave() -> void:
	if game:
		game.queue_free()
		game = null
		game_id = ""
	if direct != "":
		_post({"school4": "close"})
	_build()

func _process(delta: float) -> void:
	report_in -= delta
	if report_in <= 0.0:
		report_in = 0.1
		_report()

func _report() -> void:
	# Только на тестовом стенде: состояние аркады видно автотесту в браузере.
	if not debug_host:
		return
	var st := {"grade": grade, "game": game_id, "best": best}
	if game:
		st["state"] = game.state
		st["score"] = game.score
		st["lives"] = game.lives
		st["stage"] = game.stage
		st["goal"] = game.goal
		st["won"] = game.won
		st.merge(game.debug())
	JavaScriptBridge.eval("window.arcade=%s;" % JSON.stringify(st))

func _unhandled_input(event: InputEvent) -> void:
	if game or not (event is InputEventKey) or not event.pressed or event.echo:
		return
	var k: int = event.physical_keycode
	if k >= KEY_1 and k < KEY_1 + GAMES.size():
		play(k - KEY_1)
	elif k >= KEY_KP_1 and k < KEY_KP_1 + GAMES.size():
		play(k - KEY_KP_1)
	elif k == KEY_ESCAPE:
		back.emit()
