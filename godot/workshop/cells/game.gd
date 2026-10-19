extends "res://arcade/game.gd"
# «Клетки памяти» — экшен с забегами в духе Dead Cells. Уровни большие и ветвистые (cells/world.gd): комнаты на сетке,
# лестницы и лифты, тупики с сокровищами за дверями знаний, лавки. Между этапами — «Переход»: фонтан пополняет фляги,
# торговец продаёт за байты, Коллекционер принимает клетки (их роняют враги) и навсегда усиливает героя.
# Маршрут ветвится: из «Перехода» ведут двери в разные биомы. В конце этапов 3–5 — боссы.

const Gen = preload("res://cells/gen.gd")
const World = preload("res://cells/world.gd")
const Bank = preload("res://cells/questions.gd")
const T := 48.0
const ART := ["hero_idle", "hero_run_a", "hero_run_b", "hero_run_c", "hero_jump", "hero_fall", "hero_roll", "hero_hurt", "hero_attack", "hero_aim",
	"w_sword", "w_hammer", "w_daggers", "w_spear", "w_bow", "w_crossbow", "w_staff", "w_arrow",
	"foe_slime_a", "foe_slime_b", "foe_fly_a", "foe_fly_b", "foe_frog_a", "foe_frog_b", "foe_bee_a", "foe_bee_b", "foe_bug_a", "foe_bug_b",
	"foe_shield_a", "foe_shield_b", "foe_skel_a", "foe_skel_b", "foe_bomber_a", "foe_bomber_b", "foe_wraith_a", "foe_wraith_b", "foe_worm_a", "foe_worm_b", "foe_turret_a", "foe_turret_b",
	"boss_idle", "boss_jump", "boss_spam_idle", "boss_spam_attack", "boss_guard_idle", "boss_guard_attack", "boss_rage_idle", "boss_rage_attack",
	"n_merchant", "n_collector", "n_fountain", "n_lift",
	"p_term_on", "p_term_off", "p_gem", "p_flask", "p_chest", "p_chest_open", "p_spikes", "p_fireball", "p_torch",
	"p_cell", "p_scroll", "p_food", "p_key", "p_ladder", "p_kdoor", "p_portal", "p_gold"]
const MELEE := {
	"sword": {"title": "Меч", "about": "ровный и быстрый", "dmg": 14.0, "time": 0.2, "cd": 0.0, "reach": 78.0, "tall": 70.0, "heavy": false},
	"hammer": {"title": "Молот", "about": "медленный, бьёт сквозь щиты", "dmg": 32.0, "time": 0.34, "cd": 0.22, "reach": 98.0, "tall": 100.0, "heavy": true},
	"daggers": {"title": "Кинжалы", "about": "молниеносные; в спину — тройной урон", "dmg": 8.0, "time": 0.1, "cd": 0.0, "reach": 58.0, "tall": 56.0, "heavy": false},
	"spear": {"title": "Копьё", "about": "достаёт врага издалека", "dmg": 12.0, "time": 0.22, "cd": 0.05, "reach": 132.0, "tall": 40.0, "heavy": false},
}
const RANGED := {
	"bow": {"title": "Лук", "about": "стрела летит дугой и пробивает одного врага", "dmg": 11.0, "cd": 0.5, "speed": 900.0, "grav": 520.0, "pierce": 1, "shot": "arrow", "heavy": false},
	"crossbow": {"title": "Арбалет", "about": "мощный болт: пробивает троих и щиты", "dmg": 22.0, "cd": 1.05, "speed": 1350.0, "grav": 0.0, "pierce": 3, "shot": "arrow", "heavy": true},
	"staff": {"title": "Посох", "about": "быстрые огненные шары", "dmg": 7.0, "cd": 0.36, "speed": 820.0, "grav": 0.0, "pierce": 0, "shot": "orb", "heavy": false},
}
const KITS := [
	{"title": "Мечник", "melee": "sword", "ranged": "bow", "about": "Меч и лук: надёжно в любом биоме"},
	{"title": "Громила", "melee": "hammer", "ranged": "crossbow", "about": "Молот и арбалет: пробивают щиты"},
	{"title": "Тень", "melee": "daggers", "ranged": "staff", "about": "Кинжалы и посох: заходи врагам за спину"},
	{"title": "Копейщик", "melee": "spear", "ranged": "bow", "about": "Копьё и лук: держи врагов на расстоянии"},
]
# Мутации: одна на выбор после каждого этапа.
const PERKS := [
	{"id": "dmg", "title": "Острый клинок", "about": "Урон оружия +30 %"},
	{"id": "hp", "title": "Броня", "about": "+30 к запасу здоровья и лечение на 30"},
	{"id": "dj", "title": "Двойной прыжок", "about": "Второй прыжок в воздухе"},
	{"id": "roll", "title": "Лёгкие ноги", "about": "Перекат перезаряжается вдвое быстрее"},
	{"id": "vamp", "title": "Вампиризм", "about": "+3 здоровья за каждого врага"},
	{"id": "multi", "title": "Тройной выстрел", "about": "Выстрел летит веером из трёх зарядов"},
	{"id": "flask", "title": "Запасная фляга", "about": "+1 фляга с лечением"},
	{"id": "magnet", "title": "Магнит", "about": "Байтов из врагов в полтора раза больше"},
	{"id": "crit", "title": "Охотник", "about": "Удар в спину или по оглушённому — двойной урон"},
	{"id": "thorns", "title": "Колючки", "about": "Враг, задевший тебя, получает 15 урона"},
]
# Коллекционер: постоянные улучшения за клетки (действуют во всех следующих забегах).
const COLLECTOR := [
	{"id": "hp", "title": "Крепкое тело", "about": "+10 к запасу здоровья", "cost": [15, 25, 40, 60, 80]},
	{"id": "dmg", "title": "Закалка", "about": "+8 % урона", "cost": [20, 35, 50, 70, 90]},
	{"id": "flask", "title": "Вторая фляга", "about": "+1 фляга на забег", "cost": [30, 70, 120]},
	{"id": "gold", "title": "Кошелёк", "about": "Начинать забег с 40 байтами", "cost": [25, 60]},
	{"id": "scroll", "title": "Древний свиток", "about": "Начинать забег со свитком силы", "cost": [80]},
	{"id": "map", "title": "Картограф", "about": "Вся карта уровня видна сразу", "cost": [50]},
]
# Враги: здоровье, урон, размер хитбокса, байты, шанс выронить клетку, радиус, с которого замечают героя.
const FOES := {
	"slime": {"hp": 24, "dmg": 8, "w": 44, "h": 34, "bytes": 2, "cell": 0.15, "see": 360, "title": "Слизень"},
	"fly": {"hp": 16, "dmg": 7, "w": 36, "h": 30, "bytes": 2, "cell": 0.15, "see": 460, "title": "Муха"},
	"frog": {"hp": 32, "dmg": 10, "w": 46, "h": 40, "bytes": 3, "cell": 0.2, "see": 520, "title": "Жаба"},
	"bee": {"hp": 22, "dmg": 8, "w": 38, "h": 34, "bytes": 3, "cell": 0.25, "see": 620, "title": "Пчела-стрелок"},
	"bug": {"hp": 80, "dmg": 14, "w": 72, "h": 58, "bytes": 6, "cell": 1.0, "see": 600, "title": "Баг"},
	"shield": {"hp": 60, "dmg": 12, "w": 56, "h": 62, "bytes": 5, "cell": 0.45, "see": 480, "title": "Щитоносец"},
	"skel": {"hp": 46, "dmg": 18, "w": 44, "h": 70, "bytes": 4, "cell": 0.35, "see": 520, "title": "Скелет-мечник"},
	"bomber": {"hp": 30, "dmg": 16, "w": 44, "h": 56, "bytes": 4, "cell": 0.35, "see": 640, "title": "Бомбардир"},
	"wraith": {"hp": 34, "dmg": 14, "w": 46, "h": 56, "bytes": 5, "cell": 0.5, "see": 700, "title": "Вирус-призрак"},
	"worm": {"hp": 54, "dmg": 16, "w": 50, "h": 70, "bytes": 5, "cell": 0.45, "see": 520, "title": "Червь-копатель"},
	"turret": {"hp": 40, "dmg": 20, "w": 50, "h": 64, "bytes": 5, "cell": 0.45, "see": 760, "title": "Антивирус-турель"},
}
const BOSSES := {
	"spam": {"title": "Повелитель Спама", "hp": 700.0, "w": 150.0, "h": 170.0},
	"guard": {"title": "Страж Кэша", "hp": 900.0, "w": 130.0, "h": 180.0},
	"glitch": {"title": "Глюк", "hp": 1200.0, "w": 130.0, "h": 120.0},
}

var player := ""
var debug_keys := false
var meta := {"up": {}, "runs": 0, "best": 0, "cells": 0}
var mode := "menu"
var biome := "grove"
var visited: Array = []
var map: Dictionary = {}
var rows: Array = []
var mw := 0
var mh := 0
var cam := Vector2.ZERO
var px := 0.0
var py := 0.0
var vx := 0.0
var vy := 0.0
var face := 1
var on_floor := false
var on_lift: Dictionary = {}
var climbing := false
var drop_t := 0.0
var coyote := 0.0
var jump_buf := 0.0
var air_jumps := 0
var hp := 100.0
var hp_max := 100.0
var hurt := 0.0
var roll := 0.0
var roll_cd := 0.0
var swing := 0.0
var swing_hit: Array = []
var shot_cd := 0.0
var swing_cd := 0.0
var melee := "sword"
var ranged := "bow"
var flasks := 2
var flasks_max := 2
var bytes := 0
var cells_n := 0
var scrolls := 0
var kills := 0
var perks: Array = []
var safe := Vector2.ZERO
var foes: Array = []
var shots: Array = []
var bombs: Array = []
var beams: Array = []
var hazards: Array = []      # предупреждения и удары с неба: столбы, кристаллы
var drops: Array = []
var things: Array = []       # терминалы, сундуки, свитки, еда, лавки, порталы, фонтан, Коллекционер, двери
var lifts: Array = []
var torches: Array = []
var pops: Array = []
var explored := {}
var boss := {}
var quiz := {}
var used_q := {}
var choices: Array = []
var offers: Array = []       # товары открытой лавки
var hot: Array = []
var note := ""
var note_t := 0.0
var god := false
var run_time := 0.0
var zone_ok := 0
var big_map := false
var music: AudioStreamPlayer = null
var music_on := true
var hitstop := 0.0

func setup() -> void:
	title = "Клетки памяти"
	unit = "байтов"
	stages = 5
	show_lives = false
	for n in ART:
		tex[n] = load("res://cells/art/%s.png" % n)
	for b in World.BIOMES:
		tex["tile_%s_top" % b] = load("res://cells/art/tile_%s_top.png" % b)
		tex["tile_%s_fill" % b] = load("res://cells/art/tile_%s_fill.png" % b)
		tex["bg_" + b] = load("res://cells/art/bg_%s.jpg" % b)
	tex["bg_rest"] = load("res://cells/art/bg_rest.jpg")
	_load_meta()
	var st: AudioStream = load("res://assets/music_cells.ogg")
	if st is AudioStreamOggVorbis:
		st.loop = true
	music = AudioStreamPlayer.new()
	music.stream = st
	music.volume_db = -15.0
	add_child(music)
	music_on = bool(meta.get("music", true))
	mode = "menu"

func setup_stage() -> void:
	pass

func reset() -> void:
	pass

# ---------- сохранение между забегами ----------

func _meta_key() -> String:
	return "school4-cells-v2-g%d" % grade + ("-" + player if player != "" else "")

func _load_meta() -> void:
	var text := ""
	if OS.has_feature("web"):
		var v = JavaScriptBridge.eval("(function(){try{return localStorage.getItem('%s')||''}catch(e){return ''}})()" % _meta_key())
		text = str(v) if v != null else ""
	var raw = JSON.parse_string(text) if text != "" else null
	if raw is Dictionary:
		meta["runs"] = int(raw.get("runs", 0))
		meta["best"] = int(raw.get("best", 0))
		meta["cells"] = int(raw.get("cells", 0))
		meta["music"] = bool(raw.get("music", true))
		if raw.get("up") is Dictionary:
			for u in COLLECTOR:
				meta["up"][u["id"]] = clampi(int(raw["up"].get(u["id"], 0)), 0, u["cost"].size())

func _save_meta() -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("(function(){try{localStorage.setItem('%s',%s)}catch(e){}})()" % [_meta_key(), JSON.stringify(JSON.stringify(meta))])

func _up(id: String) -> int:
	return int(meta["up"].get(id, 0))

func _has(id: String) -> bool:
	return perks.has(id)

func _say(text: String) -> void:
	note = text
	note_t = 3.0

# ---------- забег, уровни, «Переход» ----------

func _start_run() -> void:
	meta["runs"] += 1
	perks = []
	visited = []
	bytes = 40 * _up("gold")
	cells_n = 0
	scrolls = _up("scroll")
	kills = 0
	run_time = 0.0
	used_q = {}
	hp_max = (100.0 + 10.0 * _up("hp")) * (1.0 + 0.12 * scrolls)
	hp = hp_max
	flasks_max = 2 + _up("flask")
	flasks = flasks_max
	state = "play"
	mode = "kit"
	sfx.emit("click")

func _take_kit(k: int) -> void:
	if mode != "kit" or k < 0 or k >= KITS.size():
		return
	melee = KITS[k]["melee"]
	ranged = KITS[k]["ranged"]
	sfx.emit("deliver")
	_enter_level(0, "grove")

func _reset_scene() -> void:
	foes = []
	shots = []
	bombs = []
	beams = []
	hazards = []
	drops = []
	things = []
	lifts = []
	torches = []
	pops = []
	boss = {}
	explored = {}
	parts.clear()
	vx = 0.0
	vy = 0.0
	face = 1
	hurt = 0.0
	roll = 0.0
	swing = 0.0
	climbing = false
	on_lift = {}
	big_map = false

func _load_map(m: Dictionary) -> void:
	_reset_scene()
	map = m
	rows = m["rows"].duplicate()
	mw = m["w"]
	mh = m["h"]
	var k: float = 1.0 + 0.32 * stage
	for th in m["things"]:
		var at := Vector2(th["x"] * T + T / 2.0, (th["y"] + 1) * T)
		match th["kind"]:
			"start":
				px = at.x
				py = at.y
			"slime", "fly", "frog", "bee", "bug", "shield", "skel", "bomber", "wraith", "worm", "turret":
				_spawn(th["kind"], at.x, at.y, k, th.get("elite", false))
			"boss":
				_spawn_boss(m["boss"], at.x, at.y)
			"gold":
				for i in 5:
					drops.append({"x": at.x + (i - 2) * 14.0, "y": at.y - 16.0, "vy": 0.0, "vx": 0.0, "kind": "byte", "rest": true})
			_:
				var t := {"kind": th["kind"], "x": at.x, "y": at.y, "used": false}
				if th["kind"] == "term" or th["kind"] == "bterm":
					t["state"] = "new" if th["kind"] == "term" else "off"
				if th.has("to"):
					t["to"] = th["to"]
				things.append(t)
	for kd in m.get("kdoors", []):
		things.append({"kind": "kdoor", "x": kd["x"] * T + T / 2.0, "y": (kd["y"] + 1) * T, "tx": kd["x"], "ty": kd["y"], "used": false})
	for l in m.get("lifts", []):
		lifts.append({"x": l["x"] * T, "top": l["top"] * T, "bottom": l["bottom"] * T, "y": l["bottom"] * T, "target": -1.0, "stand": 0.0})
	# Факелы: по паре в каждой комнате, на стене над полом.
	for r in m["rooms"]:
		var c: Vector2i = r["cell"]
		for tx in [c.x * World.RW + 6, c.x * World.RW + World.RW - 7]:
			var ty: int = c.y * World.RH + World.RH - 5
			if ty >= 0 and ty < mh and tx < mw and rows[ty][tx] == " ":
				torches.append(Vector2(tx * T + T / 2.0, ty * T))
	safe = Vector2(px, py)
	cam = Vector2(px - W / 2.0, py - H * 0.6)
	if _up("map") > 0:
		for r in m["rooms"]:
			explored[r["cell"]] = true

func _enter_level(s: int, b: String) -> void:
	stage = s
	biome = b
	visited.append(b)
	zone_ok = 0
	var m := World.build(s, b, rng)
	_load_map(m)
	mode = "zone"
	_say("Этап %d из 5 · %s. Найди терминалы знаний и портал!" % [s + 1, World.BIOMES[b]["name"]])

func _enter_arena() -> void:
	var m := World.arena(stage)
	_load_map(m)
	mode = "zone"
	var bd: Dictionary = BOSSES[m["boss"]]
	_say("%s! Перекатывайся сквозь атаки, бей после замаха." % bd["title"])
	shake = 1.0
	sfx.emit("error")

func _enter_passage() -> void:
	var m := World.passage(World.options(stage + 1, visited))
	_load_map(m)
	mode = "zone"
	flasks = flasks_max
	_say("Переход: фонтан пополняет фляги, торговец продаёт, Коллекционер ждёт клетки. Выбери дверь.")

func _level_done() -> void:
	var st := 3 if zone_ok >= 3 else (2 if zone_ok == 2 else 1)
	done_stars[stage + 1] = maxi(st, int(done_stars.get(stage + 1, 0)))
	meta["best"] = maxi(meta["best"], stage + 1)
	result.emit(stage + 1, st)
	sfx.emit("win")
	_save_meta()
	if stage >= 4:
		mode = "win"
		state = "over"
		won = true
		return
	hp = minf(hp_max, hp + hp_max * 0.25)
	var pool := PERKS.filter(func(p): return not perks.has(p["id"]))
	pool.shuffle()
	choices = pool.slice(0, 3)
	mode = "rest"

func _take_perk(k: int) -> void:
	if mode != "rest" or k < 0 or k >= choices.size():
		return
	var id: String = choices[k]["id"]
	perks.append(id)
	if id == "hp":
		hp_max += 30.0
		hp = minf(hp_max, hp + 30.0)
	elif id == "flask":
		flasks_max += 1
		flasks += 1
	sfx.emit("deliver")
	_enter_passage()

func _spawn(kind: String, x: float, feet: float, k: float, elite: bool = false) -> void:
	var f: Dictionary = FOES[kind]
	var mul: float = k * (2.2 if elite else 1.0)
	var e := {"kind": kind, "x": x, "y": feet, "vx": 0.0, "vy": 0.0, "hp": f["hp"] * mul, "max": f["hp"] * mul, "dmg": f["dmg"] * (1.0 + 0.18 * stage) * (1.3 if elite else 1.0),
		"w": f["w"] * (1.2 if elite else 1.0), "h": f["h"] * (1.2 if elite else 1.0), "t": rng.randf() * 2.0, "flash": 0.0, "home": Vector2(x, feet), "elite": elite,
		"st": "idle", "st_t": rng.randf_range(0.5, 1.5), "dir": -1 if rng.randf() < 0.5 else 1, "aim": Vector2.ZERO, "seen": false, "stun": 0.0, "hidden": kind == "worm", "alpha": 1.0}
	if kind in ["fly", "bee", "wraith"]:
		e["y"] = feet - 40.0
		e["home"] = Vector2(x, feet - 40.0)
	foes.append(e)

func _spawn_boss(kind: String, x: float, feet: float) -> void:
	var b: Dictionary = BOSSES[kind]
	var mul := 1.0 + 0.1 * maxi(0, stage - 2)
	boss = {"kind": kind, "x": x, "y": feet, "vx": 0.0, "vy": 0.0, "hp": b["hp"] * mul, "max": b["hp"] * mul, "w": b["w"], "h": b["h"], "t": 1.5, "n": 0, "flash": 0.0,
		"shield": false, "phase": 0, "dead": false, "st": "idle", "face": -1, "rage": false, "aim": Vector2.ZERO}

# ---------- карта: клетки, столкновения, платформы ----------

func _tile(tx: int, ty: int) -> String:
	if tx < 0 or ty < 0 or tx >= mw or ty >= mh:
		return "#"
	return rows[ty][tx]

func _solid_t(tx: int, ty: int) -> bool:
	var c := _tile(tx, ty)
	return c == "#" or c == "K"

func _solid_px(x: float, y: float) -> bool:
	return _solid_t(int(floorf(x / T)), int(floorf(y / T)))

func _box_hits(x: float, feet: float, w: float, h: float) -> bool:
	var x0 := int(floorf((x - w / 2.0) / T))
	var x1 := int(floorf((x + w / 2.0 - 0.01) / T))
	var y0 := int(floorf((feet - h) / T))
	var y1 := int(floorf((feet - 0.01) / T))
	for ty in range(y0, y1 + 1):
		for tx in range(x0, x1 + 1):
			if _solid_t(tx, ty):
				return true
	return false

func _move(e: Dictionary, w: float, h: float, delta: float, oneway: bool = true) -> Dictionary:
	# Длинный шаг (медленный кадр) делим на короткие, чтобы не проскочить сквозь пол или стену.
	var dist: float = maxf(absf(e["vx"]), absf(e["vy"])) * delta
	var n := clampi(int(ceil(dist / 10.0)), 1, 12)
	var out := {"wall": false, "floor": false}
	for i in n:
		var r := _move_step(e, w, h, delta / n, oneway)
		out["wall"] = out["wall"] or r["wall"]
		out["floor"] = out["floor"] or r["floor"]
	return out

func _move_step(e: Dictionary, w: float, h: float, delta: float, oneway: bool) -> Dictionary:
	# Движение с остановкой о камень; на платформы «=» можно встать сверху, снизу они проходимы.
	var hit_x := false
	var floor_hit := false
	var nx: float = e["x"] + e["vx"] * delta
	if _box_hits(nx, e["y"], w, h):
		hit_x = true
		nx = e["x"]
	var old_feet: float = e["y"]
	var ny: float = e["y"] + e["vy"] * delta
	if _box_hits(nx, ny, w, h):
		if e["vy"] > 0.0:
			ny = floorf(ny / T) * T
			floor_hit = true
		else:
			ny = e["y"]
		e["vy"] = 0.0
	elif oneway and e["vy"] >= 0.0:
		# пересекли сверху верх платформы?
		var row_top := floorf(old_feet / T) * T + (T if fmod(old_feet, T) > 0.01 else 0.0)
		var ty := int(row_top / T)
		if ny >= row_top and old_feet <= row_top + 0.5:
			for tx in range(int(floorf((nx - w / 2.0 + 4.0) / T)), int(floorf((nx + w / 2.0 - 4.0) / T)) + 1):
				if _tile(tx, ty) == "=":
					ny = row_top
					e["vy"] = 0.0
					floor_hit = true
					break
	e["x"] = nx
	e["y"] = ny
	return {"wall": hit_x, "floor": floor_hit}

func _ground_at(x: float, feet: float) -> bool:
	# Есть ли опора под точкой (камень или платформа).
	var tx := int(floorf(x / T))
	var ty := int(floorf((feet + 2.0) / T))
	var c := _tile(tx, ty)
	return c == "#" or c == "=" or c == "K"

func _sees(a: Vector2, b: Vector2) -> bool:
	# Прямая видимость: на отрезке нет камня.
	var d := b - a
	var n := int(d.length() / (T * 0.5)) + 1
	for i in range(1, n):
		var p := a + d * (float(i) / n)
		if _solid_px(p.x, p.y):
			return false
	return true

func _room_of(x: float, y: float) -> Vector2i:
	return Vector2i(int(x / T) / World.RW, int(y / T) / World.RH)

# ---------- ход игры ----------

func tick(delta: float) -> void:
	note_t = maxf(0.0, note_t - delta)
	if music and music.playing and not mode in ["zone", "quiz", "rest", "kit", "shop", "collector"]:
		music.stop()
	if mode == "quiz":
		if quiz.get("done", false):
			quiz["wait"] -= delta
			if quiz["wait"] <= 0.0:
				_close_quiz()
		return
	if mode != "zone":
		return
	delta = minf(delta, 1.0 / 20.0)      # на медленном компьютере игра замедляется, но физика не ломается
	if hitstop > 0.0:
		hitstop -= delta
		return
	run_time += delta
	if music and music_on and not music.playing:
		music.play()
	_tick_lifts(delta)
	_tick_player(delta)
	_tick_foes(delta)
	_tick_boss(delta)
	_tick_shots(delta)
	_tick_bombs(delta)
	_tick_drops(delta)
	for q in pops.duplicate():
		q["t"] -= delta
		q["y"] -= 60.0 * delta
		if q["t"] <= 0.0:
			pops.erase(q)
	var want := Vector2(px - W / 2.0 + face * 70.0, py - H * 0.58)
	cam = cam.lerp(want, minf(1.0, delta * 6.0))
	cam.x = clampf(cam.x, 0.0, maxf(0.0, mw * T - W))
	cam.y = clampf(cam.y, 0.0, maxf(0.0, mh * T - H))
	explored[_room_of(px, py - 20.0)] = true
	score = bytes

func _held(keys: Array) -> bool:
	for k in keys:
		if Input.is_physical_key_pressed(k):
			return true
	return false

func _on_ladder() -> bool:
	var tx := int(floorf(px / T))
	var c1 := _tile(tx, int(floorf((py - 20.0) / T)))
	var c2 := _tile(tx, int(floorf((py + 2.0) / T)))
	return c1 == "H" or (c2 == "H" and c1 != "#") or (c2 == "=" and _tile(tx, int(floorf((py + 2.0) / T)) + 1) == "H")

func _tick_lifts(delta: float) -> void:
	for l in lifts:
		var stand: bool = not on_lift.is_empty() and on_lift == l
		if stand and l["target"] < 0.0:
			l["stand"] += delta
			if l["stand"] > 0.25:
				l["target"] = l["top"] if absf(l["y"] - l["bottom"]) < 2.0 else l["bottom"]
				sfx.emit("turn")
		elif not stand:
			l["stand"] = 0.0
		if l["target"] >= 0.0:
			var ny: float = move_toward(l["y"], l["target"], 300.0 * delta)
			if stand:
				py += ny - l["y"]
			l["y"] = ny
			if absf(ny - l["target"]) < 0.5:
				l["target"] = -1.0

func _tick_player(delta: float) -> void:
	hurt = maxf(0.0, hurt - delta)
	roll_cd = maxf(0.0, roll_cd - delta)
	shot_cd = maxf(0.0, shot_cd - delta)
	swing_cd = maxf(0.0, swing_cd - delta)
	jump_buf = maxf(0.0, jump_buf - delta)
	coyote = maxf(0.0, coyote - delta)
	drop_t = maxf(0.0, drop_t - delta)
	var dir := 0
	if _held([KEY_LEFT, KEY_A]):
		dir -= 1
	if _held([KEY_RIGHT, KEY_D]):
		dir += 1
	var up := _held([KEY_UP, KEY_W])
	var down := _held([KEY_DOWN, KEY_S])
	# Лестница: ↑/↓ рядом с лестницей — лезем; прыжок — спрыгиваем.
	if not climbing and (up or (down and not on_floor) or (down and _tile(int(px / T), int((py + 2.0) / T)) == "=")) and _on_ladder() and roll <= 0.0:
		climbing = true
		px = floorf(px / T) * T + T / 2.0
	if climbing:
		vx = 0.0
		vy = -260.0 if up else (260.0 if down else 0.0)
		var ny := py + vy * delta
		var tx := int(floorf(px / T))
		if vy > 0.0 and _solid_t(tx, int(floorf((ny + 0.5) / T))):
			climbing = false
			ny = floorf(ny / T) * T
		py = ny
		if not _on_ladder():
			climbing = false
			if vy < 0.0:
				py = ceilf(py / T) * T if _tile(tx, int(py / T)) == "=" else py
			vy = 0.0
		if dir != 0 and jump_buf > 0.0:
			climbing = false
			vy = -560.0
			vx = dir * 300.0
			face = dir
			jump_buf = 0.0
		on_floor = false
		on_lift = {}
		_player_hazards(delta)
		_player_attack(delta)
		return
	if roll > 0.0:
		roll -= delta
		vx = face * 640.0
	else:
		if dir != 0:
			face = dir
		vx = move_toward(vx, dir * 310.0, 2600.0 * delta)
	vy = minf(1100.0, vy + 2100.0 * delta)
	if not _held([KEY_UP, KEY_W, KEY_Z, KEY_SPACE]) and vy < -260.0:
		vy = -260.0
	if jump_buf > 0.0 and down and on_floor and _tile(int(px / T), int((py + 2.0) / T)) == "=":
		drop_t = 0.25          # ↓ + прыжок на платформе — спрыгнуть вниз
		jump_buf = 0.0
		py += 4.0
	elif jump_buf > 0.0 and (on_floor or coyote > 0.0 or air_jumps > 0):
		if not on_floor and coyote <= 0.0:
			air_jumps -= 1
			burst(Vector2(px - cam.x, py - cam.y), Color("7df9ff"), 8, 200.0)
		vy = -820.0
		jump_buf = 0.0
		coyote = 0.0
		on_lift = {}
		sfx.emit("step")
	var was_lift: Dictionary = on_lift if vy >= 0.0 else {}
	var me := {"x": px, "y": py, "vx": vx, "vy": vy}
	var r := _move(me, 30.0, 46.0, delta, drop_t <= 0.0)
	px = me["x"]
	py = me["y"]
	vy = me["vy"]
	if r["wall"]:
		vx = 0.0
	var was := on_floor
	on_floor = r["floor"]
	# Лифт — движущаяся платформа шириной в две клетки.
	on_lift = {}
	for l in lifts:
		var riding: bool = not was_lift.is_empty() and was_lift == l and absf(px - l["x"]) < T
		if riding or (absf(px - l["x"]) < T and vy >= 0.0 and py >= l["y"] - 8.0 and py <= l["y"] + 18.0):
			py = l["y"]
			vy = 0.0
			on_floor = true
			on_lift = l
	if on_floor:
		coyote = 0.1
		air_jumps = 1 if _has("dj") else 0
		if not was:
			burst(Vector2(px - cam.x, py - cam.y), Color(0.8, 0.85, 0.9, 0.5), 4, 90.0, "p_smoke")
		if _tile(int(px / T), int((py - 4.0) / T)) != "^" and on_lift.is_empty():
			safe = Vector2(px, py)
	_player_hazards(delta)
	_player_attack(delta)

func _player_hazards(_delta: float) -> void:
	var cx := int(floorf(px / T))
	var cy := int(floorf((py - 4.0) / T))
	if _tile(cx, cy) == "^" and roll <= 0.0:
		if _damage(12.0, Vector2(px, py)):
			vy = -520.0
	if py > mh * T + 120.0:
		_damage(15.0, Vector2(px, mh * T), true)
		px = safe.x
		py = safe.y
		vx = 0.0
		vy = 0.0
	if boss.size() > 0 and not boss["dead"]:
		px = clampf(px, T * 1.5, mw * T - T * 1.5)

func _player_attack(delta: float) -> void:
	if swing <= 0.0:
		return
	swing -= delta
	var m: Dictionary = MELEE[melee]
	var reach := Rect2(px + (8.0 if face > 0 else -8.0 - m["reach"]), py - m["tall"] + 8.0, m["reach"], m["tall"])
	for f in foes.duplicate():
		if not swing_hit.has(f) and not f["hidden"] and reach.intersects(_foe_rect(f)):
			swing_hit.append(f)
			_hit_foe(f, m["dmg"], face, m["heavy"])
	if boss.size() > 0 and not boss["dead"] and not swing_hit.has(boss) and reach.intersects(_boss_rect()):
		swing_hit.append(boss)
		_hit_boss(m["dmg"], face, m["heavy"])

func _foe_rect(f: Dictionary) -> Rect2:
	return Rect2(f["x"] - f["w"] / 2.0, f["y"] - f["h"], f["w"], f["h"])

func _boss_rect() -> Rect2:
	return Rect2(boss["x"] - boss["w"] / 2.0, boss["y"] - boss["h"], boss["w"], boss["h"])

func _me_rect() -> Rect2:
	return Rect2(px - 15.0, py - 46.0, 30.0, 46.0)

func _dmg_mult() -> float:
	return (1.0 + 0.08 * _up("dmg")) * (1.3 if _has("dmg") else 1.0) * (1.0 + 0.12 * scrolls)

func _damage(amount: float, at: Vector2, force: bool = false, from: Dictionary = {}) -> bool:
	if god or mode != "zone" or (not force and (hurt > 0.0 or roll > 0.0)):
		return false
	hp -= amount
	hurt = 0.9
	shake = 0.8
	flash = 0.3
	hitstop = 0.05
	burst(Vector2(at.x - cam.x, at.y - 24.0 - cam.y), Color("ff5a4a"), 14, 320.0)
	sfx.emit("error")
	if _has("thorns") and not from.is_empty() and from.has("hp") and from != boss:
		_hit_foe(from, 15.0 / _dmg_mult(), -face, false)
	if hp <= 0.0:
		hp = 0.0
		_die()
	return true

func _die() -> void:
	meta["best"] = maxi(meta["best"], stage)
	_save_meta()
	mode = "dead"
	state = "over"
	won = false

func _pop(x: float, y: float, text: String, color: Color) -> void:
	pops.append({"x": x + rng.randf_range(-10, 10), "y": y, "t": 0.75, "text": text, "color": color})

func _hit_foe(f: Dictionary, amount: float, dir: int, heavy: bool) -> void:
	if not foes.has(f):
		return
	# Щитоносец держит удары спереди, пока не замахнулся сам; тяжёлое оружие пробивает щит.
	var front: int = int(f.get("dir", -1)) if not f["seen"] else int(signf(px - f["x"]))
	var behind: bool = int(signf(px - f["x"])) != int(f.get("dir", -1)) and f["st"] in ["idle", "rest", "wind", "act"]
	if f["kind"] == "shield" and not heavy and f["st"] != "act" and f["stun"] <= 0.0 and int(signf(px - f["x"])) == front:
		_pop(f["x"], f["y"] - f["h"] - 10.0, "БЛОК", Color("7df9ff"))
		burst(Vector2(f["x"] - cam.x - dir * 20.0, f["y"] - f["h"] / 2.0 - cam.y), Color("7df9ff"), 8, 260.0)
		vx = -dir * 260.0
		sfx.emit("turn")
		return
	var k := _dmg_mult()
	if f["stun"] > 0.0 and _has("crit"):
		k *= 2.0
	if melee == "daggers" and behind:
		k *= 3.0 if not _has("crit") else 4.0
	elif behind and _has("crit"):
		k *= 2.0
	var dmg := amount * k
	f["hp"] -= dmg
	f["flash"] = 0.15
	_pop(f["x"], f["y"] - f["h"] - 8.0, str(int(round(dmg))), GOLD if k <= _dmg_mult() * 1.01 else Color("ff9a3a"))
	if f["kind"] in ["slime", "bug", "frog", "skel", "bomber"] and f["st"] != "act":
		f["vx"] = dir * 140.0
	burst(Vector2(f["x"] - cam.x, f["y"] - f["h"] / 2.0 - cam.y), Color("ffd34d"), 6, 260.0)
	sfx.emit("drop")
	hitstop = 0.03
	if f["hp"] <= 0.0:
		foes.erase(f)
		kills += 1
		burst(Vector2(f["x"] - cam.x, f["y"] - f["h"] / 2.0 - cam.y), Color("b48cff"), 18, 360.0)
		var n: int = FOES[f["kind"]]["bytes"] * (3 if f["elite"] else 1)
		if _has("magnet"):
			n = int(ceil(n * 1.5))
		for i in n:
			drops.append({"x": f["x"] + rng.randf_range(-16, 16), "y": f["y"] - 20.0, "vy": rng.randf_range(-420, -220), "vx": rng.randf_range(-140, 140), "kind": "byte", "rest": false})
		var cells: int = 5 if f["elite"] else (1 if rng.randf() < FOES[f["kind"]]["cell"] else 0)
		for i in cells:
			drops.append({"x": f["x"], "y": f["y"] - 30.0, "vy": rng.randf_range(-480, -300), "vx": rng.randf_range(-90, 90), "kind": "cell", "rest": false})
		if rng.randf() < 0.06:
			drops.append({"x": f["x"], "y": f["y"] - 20.0, "vy": -300.0, "vx": 0.0, "kind": "food", "rest": false})
		if _has("vamp"):
			hp = minf(hp_max, hp + 3.0)
		sfx.emit("take")

# ---------- враги: у каждого свой характер; перед атакой — заметный замах ----------

func _tick_foes(delta: float) -> void:
	var me := Vector2(px, py - 24.0)
	for f in foes.duplicate():
		f["t"] += delta
		f["flash"] = maxf(0.0, f["flash"] - delta)
		f["stun"] = maxf(0.0, f["stun"] - delta)
		f["st_t"] -= delta
		var to: Vector2 = me - Vector2(f["x"], f["y"] - f["h"] / 2.0)
		if to.length() > 1400.0:
			continue
		var see: bool = to.length() < FOES[f["kind"]]["see"] * (1.3 if f["seen"] else 1.0) and _sees(Vector2(f["x"], f["y"] - f["h"] * 0.6), me)
		if see and not f["seen"]:
			f["seen"] = true
			_pop(f["x"], f["y"] - f["h"] - 24.0, "!", Color("ff6b6b"))
		f["look"] = int(signf(to.x)) if to.x != 0.0 else f.get("look", -1)
		if f["stun"] > 0.0:
			f["vx"] = move_toward(f["vx"], 0.0, 800.0 * delta)
			if not f["kind"] in ["fly", "bee", "wraith"]:
				f["vy"] = minf(1100.0, f["vy"] + 2100.0 * delta)
				_move(f, f["w"], f["h"], delta)
			continue
		match f["kind"]:
			"slime":
				_ai_walker(f, delta, see, to, 70.0, 230.0, 0.45)
			"skel":
				_ai_walker(f, delta, see, to, 95.0, 100.0, 0.55)
			"shield":
				_ai_walker(f, delta, see, to, 55.0, 90.0, 0.5)
			"bug":
				_ai_walker(f, delta, see, to, 90.0, 320.0, 0.7)
			"bomber":
				_ai_bomber(f, delta, see, to)
			"frog":
				_ai_frog(f, delta, see, to)
			"fly":
				_ai_fly(f, delta, see, to)
			"bee":
				_ai_bee(f, delta, see, to)
			"wraith":
				_ai_wraith(f, delta, see, to)
			"worm":
				_ai_worm(f, delta, see, to)
			"turret":
				_ai_turret(f, delta, see, to)
		if not f["hidden"] and f["kind"] != "turret" and _me_rect().intersects(_foe_rect(f).grow(-6.0)):
			_damage(f["dmg"] * (0.6 if f["st"] != "act" else 1.0), Vector2(px, py), false, f)
		if f["y"] > mh * T + 200.0:
			foes.erase(f)

func _walk(f: Dictionary, delta: float, speed: float) -> void:
	# Ходьба с гравитацией: у края и у стены разворачивается, со ступеньки высотой в клетку запрыгивает.
	f["vy"] = minf(1100.0, f["vy"] + 2100.0 * delta)
	f["vx"] = move_toward(f["vx"], f["dir"] * speed, 900.0 * delta)
	var r := _move(f, f["w"], f["h"], delta)
	var ahead: float = f["x"] + f["dir"] * (f["w"] / 2.0 + 6.0)
	if r["floor"] or _ground_at(f["x"], f["y"]):
		if r["wall"]:
			if not _solid_px(ahead, f["y"] - T - 4.0) and f.get("chase", false):
				f["vy"] = -620.0
			else:
				f["dir"] = -f["dir"]
		elif not _ground_at(ahead, f["y"]) and absf(f["vy"]) < 1.0:
			f["dir"] = -f["dir"]
			f["vx"] = 0.0

func _foe_act(f: Dictionary, to: Vector2) -> void:
	# Удар после замаха: слизень прыгает, скелет рубит, щитоносец бьёт щитом с рывком, баг таранит.
	match f["kind"]:
		"slime":
			f["vx"] = signf(to.x) * 330.0
			f["vy"] = -520.0
		"skel":
			_melee_strike(f, 120.0, 90.0)
		"shield":
			_melee_strike(f, 100.0, 70.0)
			f["vx"] = signf(to.x) * 240.0
		"bug":
			f["vx"] = signf(to.x) * 560.0
			f["charge"] = 0.9

func _ai_walker(f: Dictionary, delta: float, see: bool, to: Vector2, speed: float, reach: float, wind: float) -> void:
	# Общий характер наземных бойцов: патруль → погоня → замах (подсвечен) → удар → передышка.
	match f["st"]:
		"idle":
			f["chase"] = false
			_walk(f, delta, speed * 0.6)
			if see:
				f["st"] = "chase"
		"chase":
			f["chase"] = true
			f["dir"] = int(signf(to.x)) if absf(to.x) > 8.0 else f["dir"]
			_walk(f, delta, speed * (1.25 if f["elite"] else 1.0))
			if absf(to.x) < reach and absf(to.y) < 90.0:
				f["st"] = "wind"
				f["st_t"] = wind * (0.8 if f["elite"] else 1.0)
				f["vx"] = 0.0
			elif not see and f["st_t"] < -4.0:
				f["st"] = "idle"
			if see:
				f["st_t"] = 0.0
		"wind":
			f["vy"] = minf(1100.0, f["vy"] + 2100.0 * delta)
			_move(f, f["w"], f["h"], delta)
			if f["st_t"] <= 0.0:
				f["st"] = "act"
				f["st_t"] = 0.35
				_foe_act(f, to)
		"act":
			f["vy"] = minf(1100.0, f["vy"] + 2100.0 * delta)
			var r := _move(f, f["w"], f["h"], delta)
			if f.get("charge", 0.0) > 0.0:
				f["charge"] -= delta
				f["st_t"] = 0.2
				if r["wall"]:
					f["charge"] = 0.0
					f["stun"] = 1.3
					shake = 0.5
					_pop(f["x"], f["y"] - f["h"] - 20.0, "ОГЛУШЁН", Color("ffd34d"))
			if f["st_t"] <= 0.0:
				f["st"] = "rest"
				f["st_t"] = 0.7
				f["vx"] = 0.0
		"rest":
			f["vy"] = minf(1100.0, f["vy"] + 2100.0 * delta)
			f["vx"] = move_toward(f["vx"], 0.0, 900.0 * delta)
			_move(f, f["w"], f["h"], delta)
			if f["st_t"] <= 0.0:
				f["st"] = "chase" if see else "idle"

func _melee_strike(f: Dictionary, reach: float, tall: float) -> void:
	var dir: float = signf(px - f["x"])
	var area := Rect2(f["x"] + (0.0 if dir > 0 else -reach), f["y"] - tall - 10.0, reach, tall + 10.0)
	beams.append({"rect": area, "t": 0.18, "color": Color(1.0, 0.4, 0.3, 0.5)})
	if area.intersects(_me_rect()):
		_damage(f["dmg"], Vector2(px, py), false, f)
		vx = dir * 380.0
	sfx.emit("turn")

func _ai_frog(f: Dictionary, delta: float, see: bool, to: Vector2) -> void:
	f["vy"] = minf(1100.0, f["vy"] + 2100.0 * delta)
	var r := _move(f, f["w"], f["h"], delta)
	if r["floor"]:
		f["vx"] = 0.0
	if not see or not r["floor"]:
		return
	if f["st"] == "wind":
		if f["st_t"] <= 0.0:
			f["st"] = "idle"
			f["st_t"] = rng.randf_range(1.2, 2.0)
			if absf(to.x) < 260.0:
				f["vx"] = signf(to.x) * 300.0
				f["vy"] = -740.0
			else:
				var d := to.normalized()
				shots.append({"x": f["x"], "y": f["y"] - 30.0, "vx": d.x * 380.0, "vy": d.y * 380.0 - 120.0, "grav": 300.0, "dmg": f["dmg"], "own": "e", "life": 3.0})
	elif f["st_t"] <= 0.0:
		f["st"] = "wind"
		f["st_t"] = 0.45

func _ai_fly(f: Dictionary, delta: float, see: bool, to: Vector2) -> void:
	var home: Vector2 = f["home"]
	match f["st"]:
		"idle", "chase":
			if see:
				var want := Vector2(px, py - 150.0)
				var d := (want - Vector2(f["x"], f["y"]))
				f["vx"] = move_toward(f["vx"], clampf(d.x, -160.0, 160.0), 300.0 * delta)
				f["vy"] = move_toward(f["vy"], clampf(d.y, -160.0, 160.0), 300.0 * delta)
				if f["st_t"] <= 0.0 and to.length() < 380.0:
					f["st"] = "wind"
					f["st_t"] = 0.55
					f["aim"] = Vector2(px, py - 20.0)
			else:
				f["vx"] = move_toward(f["vx"], (home.x - f["x"]) * 0.8, 200.0 * delta)
				f["vy"] = (home.y + sin(f["t"] * 2.0) * 14.0 - f["y"]) * 2.0
		"wind":
			f["vx"] = move_toward(f["vx"], 0.0, 600.0 * delta)
			f["vy"] = move_toward(f["vy"], -40.0, 600.0 * delta)
			if f["st_t"] <= 0.0:
				f["st"] = "act"
				f["st_t"] = 0.6
				var d: Vector2 = (f["aim"] - Vector2(f["x"], f["y"])).normalized()
				f["vx"] = d.x * 560.0
				f["vy"] = d.y * 560.0
		"act":
			if f["st_t"] <= 0.0:
				f["st"] = "idle"
				f["st_t"] = rng.randf_range(1.0, 1.8)
	var nx: float = f["x"] + f["vx"] * delta
	var ny: float = f["y"] + f["vy"] * delta
	if not _box_hits(nx, ny, f["w"], f["h"]):
		f["x"] = nx
		f["y"] = ny
	elif f["st"] == "act":
		f["st"] = "idle"
		f["st_t"] = 1.0

func _ai_bee(f: Dictionary, delta: float, see: bool, to: Vector2) -> void:
	# Держит дистанцию, смещается вверх-вниз и стреляет очередью из трёх после прицеливания.
	if see:
		var want_x: float = px - signf(to.x) * 330.0
		var want_y: float = py - 140.0 + sin(f["t"] * 1.7) * 60.0
		f["x"] = move_toward(f["x"], want_x, 120.0 * delta) if not _box_hits(move_toward(f["x"], want_x, 120.0 * delta), f["y"], f["w"], f["h"]) else f["x"]
		f["y"] = move_toward(f["y"], want_y, 90.0 * delta) if not _box_hits(f["x"], move_toward(f["y"], want_y, 90.0 * delta), f["w"], f["h"]) else f["y"]
		if f["st"] == "idle" and f["st_t"] <= 0.0:
			f["st"] = "wind"
			f["st_t"] = 0.6
			f["n"] = 3
		elif f["st"] == "wind" and f["st_t"] <= 0.0:
			var d := (Vector2(px, py - 24.0) - Vector2(f["x"], f["y"] - 16.0)).normalized()
			shots.append({"x": f["x"], "y": f["y"] - 16.0, "vx": d.x * 360.0, "vy": d.y * 360.0, "dmg": f["dmg"], "own": "e", "life": 4.0})
			f["n"] -= 1
			f["st_t"] = 0.16
			sfx.emit("click")
			if f["n"] <= 0:
				f["st"] = "idle"
				f["st_t"] = rng.randf_range(1.6, 2.4)
	else:
		f["y"] = f["home"].y + sin(f["t"] * 2.4) * 10.0

func _ai_bomber(f: Dictionary, delta: float, see: bool, to: Vector2) -> void:
	# Держится на расстоянии и бросает бомбы навесом точно туда, где стоит герой.
	if not see:
		_walk(f, delta, 40.0)
		return
	f["chase"] = true
	if absf(to.x) < 250.0 or absf(to.x) > 430.0:
		f["dir"] = -int(signf(to.x)) if absf(to.x) < 250.0 else int(signf(to.x))
		_walk(f, delta, 90.0)
	else:
		f["vy"] = minf(1100.0, f["vy"] + 2100.0 * delta)
		f["vx"] = 0.0
		_move(f, f["w"], f["h"], delta)
	if f["st"] == "wind" and f["st_t"] <= 0.0:
		f["st"] = "idle"
		f["st_t"] = rng.randf_range(1.8, 2.6)
		var flight := 0.9
		var bx: float = f["x"]
		var by: float = f["y"] - f["h"]
		bombs.append({"x": bx, "y": by, "vx": (px - bx) / flight, "vy": (py - 20.0 - by) / flight - 0.5 * 1400.0 * flight, "fuse": -1.0, "dmg": f["dmg"], "own": "e"})
		sfx.emit("click")
	elif f["st"] != "wind" and f["st_t"] <= 0.0:
		f["st"] = "wind"
		f["st_t"] = 0.5

func _ai_wraith(f: Dictionary, delta: float, see: bool, to: Vector2) -> void:
	# Вирус-призрак растворяется и возникает за спиной героя, потом бьёт когтями.
	f["alpha"] = move_toward(f["alpha"], 0.15 if f["st"] == "fade" else 0.85, 3.0 * delta)
	match f["st"]:
		"idle", "chase":
			f["y"] = f["home"].y + sin(f["t"] * 1.6) * 16.0 if not f["seen"] else move_toward(f["y"], py - 60.0, 80.0 * delta)
			if f["seen"]:
				f["x"] = move_toward(f["x"], px, 70.0 * delta)
			if (see or f["seen"]) and f["st_t"] <= 0.0 and to.length() < 700.0:
				f["st"] = "fade"
				f["st_t"] = 0.6
		"fade":
			if f["st_t"] <= 0.0:
				var bx := px - face * 90.0
				if _box_hits(bx, py - 10.0, f["w"], f["h"]):
					bx = px + face * 90.0
				f["x"] = bx
				f["y"] = py - 10.0
				f["st"] = "wind"
				f["st_t"] = 0.4
				burst(Vector2(f["x"] - cam.x, f["y"] - 30.0 - cam.y), Color("b48cff"), 14, 200.0)
		"wind":
			if f["st_t"] <= 0.0:
				_melee_strike(f, 90.0, 70.0)
				f["st"] = "idle"
				f["st_t"] = rng.randf_range(2.5, 3.5)

func _ai_worm(f: Dictionary, delta: float, see: bool, to: Vector2) -> void:
	# Червь ползёт под землёй к герою (виден бугорок), высовывается снизу и потом открыт для ударов.
	match f["st"]:
		"idle", "chase":
			f["hidden"] = true
			if see and absf(to.y) < 120.0:
				var nx: float = move_toward(f["x"], px, 150.0 * delta)
				if _ground_at(nx, f["y"]) and not _box_hits(nx, f["y"], 20.0, 20.0):
					f["x"] = nx
				if absf(px - f["x"]) < 20.0 and f["st_t"] <= 0.0:
					f["st"] = "wind"
					f["st_t"] = 0.6
		"wind":
			if f["st_t"] <= 0.0:
				f["st"] = "act"
				f["st_t"] = 1.3
				f["hidden"] = false
				var area := Rect2(f["x"] - 34.0, f["y"] - 110.0, 68.0, 110.0)
				beams.append({"rect": area, "t": 0.2, "color": Color(0.9, 0.5, 0.2, 0.45)})
				if area.intersects(_me_rect()):
					_damage(f["dmg"], Vector2(px, py), false, f)
					vy = -560.0
				shake = 0.4
		"act":
			if f["st_t"] <= 0.0:
				f["st"] = "idle"
				f["st_t"] = rng.randf_range(1.0, 1.6)
				f["hidden"] = true

func _ai_turret(f: Dictionary, delta: float, see: bool, to: Vector2) -> void:
	# Турель целится тонким лучом, на мгновение замирает и стреляет мощным лазером до стены.
	f["vy"] = minf(1100.0, f["vy"] + 2100.0 * delta)
	_move(f, f["w"], f["h"], delta)
	var eye := Vector2(f["x"], f["y"] - f["h"] * 0.7)
	match f["st"]:
		"idle", "chase":
			if see and f["st_t"] <= 0.0:
				f["st"] = "wind"
				f["st_t"] = 1.0
		"wind":
			if f["st_t"] > 0.25:
				f["aim"] = (Vector2(px, py - 24.0) - eye).normalized()
			if f["st_t"] <= 0.0:
				var end := eye
				for i in 60:
					end += f["aim"] * T * 0.5
					if _solid_px(end.x, end.y):
						break
				beams.append({"line": [eye, end], "t": 0.35, "color": Color(1.0, 0.2, 0.25, 0.95), "w": 12.0})
				if Geometry2D.segment_intersects_circle(eye, end, Vector2(px, py - 24.0), 22.0) >= 0.0:
					_damage(f["dmg"], Vector2(px, py), false, f)
				f["st"] = "idle"
				f["st_t"] = rng.randf_range(1.8, 2.6)
				sfx.emit("error")

# ---------- боссы ----------

func _tick_boss(delta: float) -> void:
	if boss.is_empty() or boss["dead"]:
		return
	boss["t"] -= delta
	boss["flash"] = maxf(0.0, boss["flash"] - delta)
	boss["vy"] = minf(1100.0, boss["vy"] + 2100.0 * delta)
	var r := _move(boss, boss["w"] * 0.8, boss["h"] * 0.9, delta, false)
	if r["wall"]:
		boss["vx"] = 0.0
	if boss["st"] != "dash":
		boss["face"] = int(signf(px - boss["x"])) if absf(px - boss["x"]) > 10.0 else boss["face"]
	var low: bool = boss["hp"] / boss["max"] < 0.5
	match boss["kind"]:
		"spam":
			_boss_spam(delta, r, low)
		"guard":
			_boss_guard(delta, r, low)
		"glitch":
			_boss_glitch(delta, r)
	boss["x"] = clampf(boss["x"], 2.0 * T, mw * T - 2.0 * T)
	if _me_rect().intersects(_boss_rect().grow(-20.0)):
		_damage(14.0 + 4.0 * stage, Vector2(px, py))

func _shockwave(x: float, y: float, dmg: float) -> void:
	for s in [-1.0, 1.0]:
		shots.append({"x": x, "y": y - 14.0, "vx": s * 420.0, "vy": 0.0, "dmg": dmg, "own": "e", "life": 2.2, "kind": "wave"})
	shake = 0.7

func _boss_spam(delta: float, r: Dictionary, low: bool) -> void:
	# Повелитель Спама: залпы писем навесом, мухи-помощники, топот с ударной волной; во второй фазе — дождь из букв.
	if r["floor"]:
		boss["vx"] = move_toward(boss["vx"], 0.0, 600.0 * delta)
	if boss["st"] == "wind":
		if boss["t"] <= 0.0:
			var n: int = boss["n"] % (4 if low else 3)
			boss["st"] = "idle"
			boss["t"] = 1.3 if low else 1.8
			boss["n"] += 1
			if n == 0:
				for i in (7 if low else 5):
					var a := -0.5 + i * (1.0 / ((7 if low else 5) - 1))
					shots.append({"x": boss["x"], "y": boss["y"] - 150.0, "vx": boss["face"] * (260.0 + 160.0 * a) , "vy": -520.0 + 120.0 * a, "grav": 900.0, "dmg": 12.0, "own": "e", "life": 4.0, "kind": "letter"})
			elif n == 1:
				if foes.filter(func(f): return f["kind"] == "fly").size() < 4:
					for i in 2:
						_spawn("fly", boss["x"] + (i * 2 - 1) * 90.0, boss["y"] - 120.0, 1.0 + 0.2 * stage)
				_say("Спам призывает мух!")
			elif n == 2:
				boss["vy"] = -760.0
				boss["vx"] = clampf((px - boss["x"]) * 1.1, -480.0, 480.0)
				boss["st"] = "jump"
			else:
				for i in 5:
					var x := clampf(px + (i - 2) * 140.0 + rng.randf_range(-30, 30), 2.0 * T, mw * T - 2.0 * T)
					hazards.append({"x": x, "t": 0.9, "kind": "rain", "dmg": 14.0})
	elif boss["st"] == "jump":
		if r["floor"]:
			boss["st"] = "idle"
			_shockwave(boss["x"], boss["y"], 14.0)
	elif boss["t"] <= 0.0:
		boss["st"] = "wind"
		boss["t"] = 0.6 if low else 0.8

func _boss_guard(delta: float, r: Dictionary, low: bool) -> void:
	# Страж Кэша: держит щит к герою (бей в спину или тяжёлым оружием), рывок с мечом, прыжок с ударом, кристаллы из пола.
	if r["floor"] and boss["st"] != "dash":
		boss["vx"] = move_toward(boss["vx"], 0.0, 900.0 * delta)
	match boss["st"]:
		"idle":
			if boss["t"] <= 0.0:
				boss["st"] = "wind"
				boss["t"] = 0.55 if low else 0.7
		"wind":
			if boss["t"] <= 0.0:
				var n: int = boss["n"] % (3 if low else 2)
				boss["n"] += 1
				if n == 0:
					boss["st"] = "dash"
					boss["t"] = 0.55
					boss["vx"] = boss["face"] * 760.0
				elif n == 1:
					boss["st"] = "jump"
					boss["vy"] = -820.0
					boss["vx"] = clampf((px - boss["x"]) * 1.2, -520.0, 520.0)
				else:
					for i in 4:
						hazards.append({"x": clampf(px + (i - 1.5) * 120.0, 2.0 * T, mw * T - 2.0 * T), "t": 0.8 + i * 0.15, "kind": "crystal", "dmg": 16.0})
					boss["st"] = "idle"
					boss["t"] = 1.2
		"dash":
			if boss["t"] <= 0.0 or r["wall"]:
				boss["st"] = "open"
				boss["t"] = 0.9            # после рывка Страж раскрыт: щит опущен
				boss["vx"] = 0.0
		"jump":
			if r["floor"]:
				_shockwave(boss["x"], boss["y"], 16.0)
				boss["st"] = "open"
				boss["t"] = 0.7
		"open":
			if boss["t"] <= 0.0:
				boss["st"] = "idle"
				boss["t"] = 0.9 if low else 1.3

func _boss_glitch(delta: float, r: Dictionary) -> void:
	# Глюк: прыжки с ударной волной и тройной залп; дважды закрывается щитом — снять его можно только ответом на терминале.
	# В последней трети впадает в ярость: телепортируется и стреляет лучами.
	if boss["shield"]:
		if r["floor"]:
			boss["vx"] = 0.0
		return
	if boss["rage"]:
		if boss["st"] == "wind" and boss["t"] <= 0.0:
			var eye := Vector2(boss["x"], boss["y"] - 90.0)
			var d: Vector2 = boss["aim"]
			var end := eye + d * 1600.0
			beams.append({"line": [eye, end], "t": 0.4, "color": Color(1.0, 0.2, 0.6, 0.95), "w": 18.0})
			if Geometry2D.segment_intersects_circle(eye, end, Vector2(px, py - 24.0), 26.0) >= 0.0:
				_damage(22.0, Vector2(px, py))
			boss["st"] = "idle"
			boss["t"] = 1.0
		elif boss["st"] == "idle" and boss["t"] <= 0.0:
			boss["n"] += 1
			if boss["n"] % 3 == 0 and foes.size() < 3:
				_spawn("wraith", boss["x"], boss["y"] - 60.0, 1.6)
			boss["x"] = clampf(px + (300.0 if rng.randf() < 0.5 else -300.0), 3.0 * T, mw * T - 3.0 * T)
			boss["y"] = (mh - 1) * T
			burst(Vector2(boss["x"] - cam.x, boss["y"] - 60.0 - cam.y), Color("ff5aa0"), 30, 380.0)
			boss["st"] = "wind"
			boss["t"] = 0.7
			boss["aim"] = (Vector2(px, py - 24.0) - Vector2(boss["x"], boss["y"] - 90.0)).normalized()
		return
	if r["floor"]:
		if boss["vx"] != 0.0:
			_shockwave(boss["x"], boss["y"], 12.0)
		boss["vx"] = 0.0
		if boss["t"] <= 0.0:
			boss["t"] = 1.5
			boss["n"] += 1
			if boss["n"] % 3 == 0:
				for a in [-0.35, 0.0, 0.35]:
					var d := (Vector2(px, py - 40.0) - Vector2(boss["x"], boss["y"] - 70.0)).normalized().rotated(a)
					shots.append({"x": boss["x"], "y": boss["y"] - 70.0, "vx": d.x * 400.0, "vy": d.y * 400.0, "dmg": 12.0, "own": "e", "life": 4.0})
			else:
				boss["vx"] = clampf((px - boss["x"]) * 0.9, -440.0, 440.0)
				boss["vy"] = -840.0

func _hit_boss(amount: float, dir: int, heavy: bool) -> void:
	if boss["shield"]:
		burst(Vector2(boss["x"] - cam.x, boss["y"] - 70.0 - cam.y), Color("7df9ff"), 6, 240.0)
		_say("Щит не пробить! Ответь на вопрос терминала.")
		return
	if boss["kind"] == "guard" and not heavy and boss["st"] != "open" and int(signf(px - boss["x"])) == boss["face"]:
		_pop(boss["x"], boss["y"] - boss["h"] - 10.0, "БЛОК", Color("7df9ff"))
		vx = -dir * 300.0
		sfx.emit("turn")
		return
	var dmg := amount * _dmg_mult() * (1.5 if boss["st"] == "open" else 1.0)
	boss["hp"] -= dmg
	_pop(boss["x"], boss["y"] - boss["h"] - 10.0, str(int(round(dmg))), Color("ff9aff"))
	boss["flash"] = 0.12
	burst(Vector2(boss["x"] - cam.x, boss["y"] - 70.0 - cam.y), Color("ffd34d"), 6, 280.0)
	sfx.emit("drop")
	if boss["kind"] == "glitch":
		var part: float = boss["hp"] / boss["max"]
		if (boss["phase"] == 0 and part <= 0.66) or (boss["phase"] == 1 and part <= 0.33):
			boss["phase"] += 1
			boss["shield"] = true
			for t in things:
				if t["kind"] == "bterm":
					t["state"] = "new"
			_say("Глюк закрылся щитом. К терминалу!")
			sfx.emit("turn")
	if boss["hp"] <= 0.0:
		boss["dead"] = true
		burst(Vector2(boss["x"] - cam.x, boss["y"] - 70.0 - cam.y), Color("ffd34d"), 60, 560.0, "p_star", 40.0)
		bytes += 60
		for i in 12:
			drops.append({"x": boss["x"], "y": boss["y"] - 60.0, "vy": rng.randf_range(-600, -350), "vx": rng.randf_range(-260, 260), "kind": "cell", "rest": false})
		shake = 1.0
		things.append({"kind": "portal", "x": boss["x"], "y": (mh - 1) * T, "used": false, "after_boss": true})
		_say("%s повержен! Собери клетки и войди в портал." % BOSSES[boss["kind"]]["title"])

# ---------- снаряды, бомбы, удары с неба ----------

func _tick_shots(delta: float) -> void:
	for s in shots.duplicate():
		s["vy"] += s.get("grav", 0.0) * delta
		s["x"] += s["vx"] * delta
		s["y"] += s["vy"] * delta
		s["life"] -= delta
		if s["life"] <= 0.0 or _solid_px(s["x"], s["y"]):
			shots.erase(s)
			continue
		if s["own"] == "e":
			if _me_rect().grow(4.0).has_point(Vector2(s["x"], s["y"])):
				if _damage(s["dmg"], Vector2(px, py)):
					shots.erase(s)
		else:
			var gone := false
			for f in foes.duplicate():
				if not f["hidden"] and not s["hit"].has(f) and _foe_rect(f).grow(6.0).has_point(Vector2(s["x"], s["y"])):
					s["hit"].append(f)
					_hit_foe(f, s["dmg"], int(signf(s["vx"])), RANGED[ranged]["heavy"])
					s["pierce"] -= 1
					if s["pierce"] < 0:
						gone = true
						break
			if not gone and not boss.is_empty() and not boss["dead"] and _boss_rect().has_point(Vector2(s["x"], s["y"])):
				_hit_boss(s["dmg"], int(signf(s["vx"])), RANGED[ranged]["heavy"])
				gone = true
			if gone:
				shots.erase(s)
	for b in beams.duplicate():
		b["t"] -= delta
		if b["t"] <= 0.0:
			beams.erase(b)
	for h in hazards.duplicate():
		h["t"] -= delta
		if h["t"] <= 0.0:
			hazards.erase(h)
			var area := Rect2(h["x"] - 30.0, 0.0, 60.0, mh * T) if h["kind"] == "rain" else Rect2(h["x"] - 34.0, (mh - 1) * T - 130.0, 68.0, 130.0)
			beams.append({"rect": area, "t": 0.3, "color": Color(0.5, 1.0, 0.6, 0.45) if h["kind"] == "rain" else Color(0.5, 0.9, 1.0, 0.55)})
			if area.intersects(_me_rect()):
				_damage(h["dmg"], Vector2(px, py))

func _tick_bombs(delta: float) -> void:
	for b in bombs.duplicate():
		if b["fuse"] < 0.0:
			b["vy"] += 1400.0 * delta
			var nx: float = b["x"] + b["vx"] * delta
			var ny: float = b["y"] + b["vy"] * delta
			if _solid_px(nx, ny + 8.0) or _tile(int(nx / T), int((ny + 8.0) / T)) == "=":
				b["fuse"] = 0.9
				ny = floorf((ny + 8.0) / T) * T - 8.0
			b["x"] = nx
			b["y"] = ny
		else:
			b["fuse"] -= delta
			if b["fuse"] <= 0.0:
				bombs.erase(b)
				burst(Vector2(b["x"] - cam.x, b["y"] - cam.y), Color("ff9a3a"), 30, 420.0)
				shake = 0.5
				sfx.emit("error")
				if Vector2(px, py - 24.0).distance_to(Vector2(b["x"], b["y"])) < 100.0:
					_damage(b["dmg"], Vector2(px, py))

func _tick_drops(delta: float) -> void:
	for d in drops.duplicate():
		var to := Vector2(px - d["x"], py - 24.0 - d["y"])
		var magnet := 260.0 if d["kind"] == "cell" else 130.0
		if to.length() < magnet:
			d["rest"] = false
			d["x"] += to.normalized().x * 560.0 * delta
			d["y"] += to.normalized().y * 560.0 * delta
		elif not d["rest"]:
			d["vy"] = minf(900.0, d["vy"] + 1800.0 * delta)
			d["x"] += d.get("vx", 0.0) * delta
			d["y"] += d["vy"] * delta
			if _solid_px(d["x"], d["y"] + 10.0) or (d["vy"] > 0.0 and _tile(int(d["x"] / T), int((d["y"] + 10.0) / T)) == "="):
				d["rest"] = true
				d["y"] = floorf((d["y"] + 10.0) / T) * T - 12.0
		if to.length() < 28.0:
			drops.erase(d)
			match d["kind"]:
				"byte":
					bytes += 1
				"cell":
					cells_n += 1
					_pop(px, py - 70.0, "+1 клетка", Color("7df9ff"))
				_:
					hp = minf(hp_max, hp + 25.0)
					_pop(px, py - 70.0, "+25", Color("5fe0b5"))
			burst(Vector2(d["x"] - cam.x, d["y"] - cam.y), Color("ffd34d") if d["kind"] == "byte" else Color("7df9ff"), 3, 120.0)

# ---------- предметы, терминалы, двери, лавка ----------

func _near() -> Dictionary:
	for t in things:
		if t["used"] and not t["kind"] in ["shop", "fountain", "collector", "door", "portal"]:
			continue
		if t["kind"] == "term" and t["state"] != "new":
			continue
		if t["kind"] == "bterm" and t["state"] != "new":
			continue
		var reach := 70.0 if t["kind"] in ["shop", "collector", "fountain", "door", "portal", "kdoor"] else 46.0
		if absf(t["x"] - px) < reach and absf(t["y"] - py) < 70.0:
			return t
	return {}

func _interact() -> void:
	var t := _near()
	if t.is_empty():
		return
	match t["kind"]:
		"term", "bterm", "kdoor":
			_open_quiz(t)
		"chest":
			_open_chest(t)
		"scroll":
			t["used"] = true
			scrolls += 1
			hp_max *= 1.12
			hp = hp_max
			_say("Свиток силы! Урон +12 %, здоровье +12 % и полное лечение.")
			burst(Vector2(t["x"] - cam.x, t["y"] - 30.0 - cam.y), Color("c08bff"), 30, 380.0, "p_star", 30.0)
			sfx.emit("win")
		"food":
			t["used"] = true
			hp = minf(hp_max, hp + 40.0)
			_say("Еда: +40 здоровья.")
			sfx.emit("deliver")
		"shop":
			_open_shop()
		"collector":
			mode = "collector"
			sfx.emit("click")
		"fountain":
			if flasks < flasks_max or hp < hp_max:
				flasks = flasks_max
				hp = hp_max
				_say("Фонтан: фляги пополнены, здоровье полное.")
				burst(Vector2(t["x"] - cam.x, t["y"] - 60.0 - cam.y), Color("7df9ff"), 24, 300.0)
				sfx.emit("deliver")
			else:
				_say("Фляги и так полны.")
		"door":
			_enter_level(stage + 1, t["to"])
		"portal":
			var answered := things.filter(func(x): return x["kind"] == "term" and x["state"] in ["ok", "bad"]).size()
			if t.get("after_boss", false):
				_level_done()
			elif answered < 2:
				_say("Портал спит: ответь хотя бы на два терминала знаний (%d из 2)." % answered)
				sfx.emit("error")
			elif World.BOSS[stage] != "":
				_enter_arena()
			else:
				_level_done()

func _open_chest(t: Dictionary) -> void:
	t["used"] = true
	var pool := []
	for id in MELEE:
		if id != melee:
			pool.append(["m", id])
	for id in RANGED:
		if id != ranged:
			pool.append(["r", id])
	var pick: Array = pool[rng.randi() % pool.size()]
	if pick[0] == "m":
		melee = pick[1]
		_say("Новое оружие: %s — %s." % [MELEE[melee]["title"], MELEE[melee]["about"]])
	else:
		ranged = pick[1]
		_say("Новое оружие: %s — %s." % [RANGED[ranged]["title"], RANGED[ranged]["about"]])
	for k in 6:
		drops.append({"x": t["x"] + (k - 2.5) * 14.0, "y": t["y"] - 30.0, "vy": -260.0 - 40.0 * k, "vx": 0.0, "kind": "byte", "rest": false})
	if rng.randf() < 0.5:
		drops.append({"x": t["x"], "y": t["y"] - 30.0, "vy": -420.0, "vx": 30.0, "kind": "cell", "rest": false})
	burst(Vector2(t["x"] - cam.x, t["y"] - 30.0 - cam.y), GOLD, 18, 300.0, "p_star", 28.0)
	sfx.emit("deliver")

func _open_shop() -> void:
	# Товары торговца: оружие, еда, фляга, свиток силы. Цены растут с этапом.
	var k := 1.0 + 0.35 * stage
	offers = []
	var weap := []
	for id in MELEE:
		if id != melee:
			weap.append({"type": "m", "id": id, "title": MELEE[id]["title"], "about": MELEE[id]["about"], "cost": int(30 * k)})
	for id in RANGED:
		if id != ranged:
			weap.append({"type": "r", "id": id, "title": RANGED[id]["title"], "about": RANGED[id]["about"], "cost": int(30 * k)})
	weap.shuffle()
	offers.append_array(weap.slice(0, 2))
	offers.append({"type": "food", "title": "Жареный окорок", "about": "+50 здоровья", "cost": int(15 * k)})
	offers.append({"type": "flask", "title": "Наполнить флягу", "about": "+1 заряд фляги", "cost": int(25 * k)})
	offers.append({"type": "scroll", "title": "Свиток силы", "about": "+12 % урона и здоровья", "cost": int(70 * k)})
	mode = "shop"
	sfx.emit("click")

func _buy_offer(i: int) -> void:
	if mode != "shop" or i < 0 or i >= offers.size():
		return
	var o: Dictionary = offers[i]
	if o.get("sold", false) or bytes < o["cost"] or (o["type"] == "flask" and flasks >= flasks_max):
		sfx.emit("error")
		return
	bytes -= o["cost"]
	o["sold"] = true
	match o["type"]:
		"m":
			melee = o["id"]
		"r":
			ranged = o["id"]
		"food":
			hp = minf(hp_max, hp + 50.0)
		"flask":
			flasks += 1
		"scroll":
			scrolls += 1
			hp_max *= 1.12
			hp = hp_max
	sfx.emit("deliver")

func _buy_collector(i: int) -> void:
	if mode != "collector" or i < 0 or i >= COLLECTOR.size():
		return
	var u: Dictionary = COLLECTOR[i]
	var lvl := _up(u["id"])
	if lvl >= u["cost"].size() or cells_n < u["cost"][lvl]:
		sfx.emit("error")
		return
	cells_n -= u["cost"][lvl]
	meta["cells"] += u["cost"][lvl]
	meta["up"][u["id"]] = lvl + 1
	match u["id"]:
		"hp":
			hp_max += 10.0
			hp += 10.0
		"flask":
			flasks_max += 1
			flasks += 1
	_save_meta()
	sfx.emit("win")

func _open_quiz(t: Dictionary) -> void:
	var q := Gen.question(grade, rng, Bank.DATA[str(grade)], used_q)
	var opts := [q["a"], q["w"][0], q["w"][1]]
	opts.shuffle()
	quiz = {"thing": t, "q": q["q"], "a": q["a"], "e": q.get("e", ""), "opts": opts, "pick": -1, "done": false, "wait": 0.0, "right": false}
	mode = "quiz"
	sfx.emit("click")

func _answer(k: int) -> void:
	if mode != "quiz" or quiz["done"] or k < 0 or k > 2:
		return
	quiz["pick"] = k
	quiz["done"] = true
	quiz["right"] = quiz["opts"][k] == quiz["a"]
	quiz["wait"] = 1.3 if quiz["right"] else 4.0
	sfx.emit("deliver" if quiz["right"] else "error")

func _close_quiz() -> void:
	var t: Dictionary = quiz["thing"]
	mode = "zone"
	match t["kind"]:
		"bterm":
			if quiz["right"]:
				t["state"] = "off"
				boss["shield"] = false
				if boss["phase"] >= 2:
					boss["rage"] = true
					boss["st"] = "idle"
					boss["t"] = 0.5
					_say("Щит снят — Глюк в ярости! Берегись лучей.")
				else:
					_say("Щит снят! Бей Глюка.")
			else:
				boss["hp"] = minf(boss["max"], boss["hp"] + boss["max"] * 0.06)
				_say("Неверно: Глюк подлечился. Попробуй другой вопрос.")
		"kdoor":
			if quiz["right"]:
				t["used"] = true
				for y in range(t["ty"] - 2, t["ty"] + 1):
					var r: String = rows[y]
					rows[y] = r.substr(0, t["tx"]) + " " + r.substr(t["tx"] + 1)
				burst(Vector2(t["x"] - cam.x, t["y"] - 60.0 - cam.y), Color("c08bff"), 30, 360.0)
				_say("Дверь знаний открыта: за ней сокровищница!")
			else:
				_spawn("bug", t["x"] + (160.0 if face < 0 else -160.0), t["y"] - 4.0, 1.0 + 0.3 * stage, true)
				_say("Дверь не поддалась, а ошибка породила бага!")
		_:
			if quiz["right"]:
				t["state"] = "ok"
				zone_ok += 1
				var roll_r := rng.randf()
				if roll_r < 0.3:
					scrolls += 1
					hp_max *= 1.12
					hp = hp_max
					_say("Верно! Награда — свиток силы.")
				else:
					for i in 3:
						drops.append({"x": t["x"], "y": t["y"] - 60.0, "vy": -400.0, "vx": (i - 1) * 80.0, "kind": "cell", "rest": false})
					bytes += 10
					_say("Верно! +3 клетки и 10 байтов.")
				burst(Vector2(t["x"] - cam.x, t["y"] - 40.0 - cam.y), Color("5fe0b5"), 20, 320.0)
			else:
				t["state"] = "bad"
				_spawn("bug", t["x"] + (160.0 if face < 0 else -160.0), t["y"] - 4.0, 1.0 + 0.3 * stage, true)
				_say("Ошибка породила бага — он уже рядом!")
	quiz = {}

# ---------- ввод ----------

func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var p: Vector2 = get_global_transform().affine_inverse() * event.position
		if p.x < 150 and p.y < 60:
			leave.emit()
			return
		for h in hot:
			if h[0].has_point(p):
				_choose(h[1])
				return
		if mode == "dead" or mode == "win":
			mode = "menu"
			state = "intro"
		return
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	var k: int = event.physical_keycode
	get_viewport().set_input_as_handled()
	if k == KEY_ESCAPE:
		if mode in ["shop", "collector"]:
			mode = "zone"
			return
		if mode in ["zone", "quiz", "rest"]:
			_save_meta()
		leave.emit()
		return
	var digit := -1
	if k >= KEY_1 and k <= KEY_9:
		digit = k - KEY_1
	elif k >= KEY_KP_1 and k <= KEY_KP_9:
		digit = k - KEY_KP_1
	match mode:
		"menu":
			if k in [KEY_SPACE, KEY_ENTER, KEY_KP_ENTER]:
				_start_run()
		"dead", "win":
			if k in [KEY_SPACE, KEY_ENTER, KEY_KP_ENTER]:
				mode = "menu"
				state = "intro"
		"quiz":
			if digit >= 0:
				_answer(digit)
			elif quiz.get("done", false) and k in [KEY_SPACE, KEY_ENTER, KEY_KP_ENTER]:
				_close_quiz()
			elif debug_keys and k == KEY_F7 and not quiz["done"]:
				_answer(quiz["opts"].find(quiz["a"]))
		"rest":
			_take_perk(digit)
		"kit":
			_take_kit(digit)
		"shop":
			if digit >= 0:
				_buy_offer(digit)
			elif k in [KEY_E, KEY_Q, KEY_BACKSPACE]:
				mode = "zone"
		"collector":
			if digit >= 0:
				_buy_collector(digit)
			elif k in [KEY_E, KEY_Q, KEY_BACKSPACE]:
				mode = "zone"
		"zone":
			_zone_key(k)

func _zone_key(k: int) -> void:
	if k in [KEY_UP, KEY_W, KEY_Z, KEY_SPACE]:
		if k == KEY_SPACE or k == KEY_Z or not _on_ladder():
			jump_buf = 0.12
	elif k == KEY_X or k == KEY_J:
		if swing <= 0.0 and swing_cd <= 0.0 and roll <= 0.0 and not climbing:
			swing = MELEE[melee]["time"]
			swing_cd = MELEE[melee]["time"] + MELEE[melee]["cd"]
			swing_hit = []
			sfx.emit("turn")
	elif k == KEY_C or k == KEY_K:
		if shot_cd <= 0.0 and roll <= 0.0 and not climbing:
			var w: Dictionary = RANGED[ranged]
			shot_cd = w["cd"]
			for a in ([-0.16, 0.0, 0.16] if _has("multi") else [0.0]):
				shots.append({"x": px + face * 24.0, "y": py - 40.0, "vx": face * w["speed"] * cos(a), "vy": w["speed"] * sin(a) - (90.0 if w["grav"] > 0.0 else 0.0), "dmg": w["dmg"], "own": "p", "life": 1.2, "grav": w["grav"], "pierce": w["pierce"], "hit": [], "kind": w["shot"]})
			sfx.emit("click")
	elif k == KEY_SHIFT or k == KEY_L:
		if roll <= 0.0 and roll_cd <= 0.0:
			climbing = false
			roll = 0.3
			roll_cd = 0.4 if _has("roll") else 0.8
			burst(Vector2(px - cam.x, py - 10.0 - cam.y), Color(0.8, 0.9, 1.0, 0.6), 6, 140.0, "p_smoke")
			sfx.emit("step")
	elif k == KEY_F:
		if flasks > 0 and hp < hp_max:
			flasks -= 1
			hp = minf(hp_max, hp + hp_max * 0.4)
			burst(Vector2(px - cam.x, py - 30.0 - cam.y), Color("5fe0b5"), 16, 220.0)
			sfx.emit("deliver")
	elif k == KEY_E or ((k == KEY_DOWN or k == KEY_S) and not _near().is_empty()):
		_interact()
	elif k == KEY_M or k == KEY_TAB:
		big_map = not big_map
	elif k == KEY_N:
		music_on = not music_on
		meta["music"] = music_on
		_save_meta()
		if not music_on and music:
			music.stop()
		_say("Музыка включена (N)" if music_on else "Музыка выключена (N)")
	elif debug_keys:
		_debug_key(k)

func _debug_key(k: int) -> void:
	# Отладочные клавиши стенда: F6 неуязвимость, F8 удар по всем, F9 к следующей цели, F10 к двери знаний или сундуку, PageUp/PageDown к торговцу/Коллекционеру, F2 клетки и байты, F4 на лифт, F12 к лестнице.
	match k:
		KEY_F6:
			god = not god
		KEY_F8:
			for f in foes.duplicate():
				f["hidden"] = false
				_hit_foe(f, 9999.0, 1, true)
			if not boss.is_empty() and not boss["dead"]:
				boss["st"] = "open"
				_hit_boss(boss["max"] * 0.36 / _dmg_mult() / 1.5, 1, true)
		KEY_F9:
			var goal := {}
			for want in ["term", "bterm", "portal", "door"]:
				for t in things:
					if t["kind"] == want and (not t.has("state") or t["state"] == "new"):
						goal = t
						break
				if not goal.is_empty():
					break
			if not goal.is_empty():
				_teleport(goal["x"], goal["y"])
		KEY_PAGEUP, KEY_PAGEDOWN:
			var want_k := "shop" if k == KEY_PAGEUP else "collector"
			for t in things:
				if t["kind"] == want_k:
					_teleport(t["x"], t["y"])
		KEY_F10:
			for want in ["kdoor", "chest", "scroll"]:
				for t in things:
					if t["kind"] == want and not t["used"]:
						_teleport(t["x"] - (60.0 if want == "kdoor" and t["x"] > px else 0.0), t["y"])
						return
		KEY_F2:
			cells_n += 200
			bytes += 300
		KEY_F12:
			# к низу ближайшей лестницы
			for ty in range(mh - 2, 0, -1):
				for tx in mw:
					if rows[ty][tx] == "H" and _solid_t(tx, ty + 1):
						_teleport(tx * T + T / 2.0, (ty + 1) * T)
						return
		KEY_F4:
			if not lifts.is_empty():
				_teleport(lifts[0]["x"], lifts[0]["y"])

func _teleport(x: float, y: float) -> void:
	px = x
	py = y
	vx = 0.0
	vy = 0.0
	climbing = false
	cam = Vector2(px - W / 2.0, py - H * 0.58)

func _choose(k: int) -> void:
	match mode:
		"menu":
			if k == 99:
				_start_run()
		"quiz":
			if quiz.get("done", false):
				_close_quiz()
			else:
				_answer(k)
		"rest":
			_take_perk(k)
		"kit":
			_take_kit(k)
		"shop":
			if k == 99:
				mode = "zone"
			else:
				_buy_offer(k)
		"collector":
			if k == 99:
				mode = "zone"
			else:
				_buy_collector(k)

func debug() -> Dictionary:
	var ts := []
	var kinds := {}
	for t in things:
		if t["kind"] == "term":
			ts.append(t["state"])
		kinds[t["kind"]] = int(kinds.get(t["kind"], 0)) + 1
	var fk := {}
	for f in foes:
		fk[f["kind"]] = int(fk.get(f["kind"], 0)) + 1
	var n := _near()
	var ladders := 0
	for r in rows:
		ladders += r.count("H")
	return {"mode": mode, "stage": stage, "biome": biome, "visited": visited, "hp": int(hp), "hpMax": int(hp_max), "x": int(px), "y": int(py), "foes": foes.size(), "foeKinds": fk,
		"terms": ts, "things": kinds, "bytes": bytes, "cells": cells_n, "scrolls": scrolls, "perks": perks, "near": n.get("kind", ""), "melee": melee, "ranged": ranged,
		"boss": {} if boss.is_empty() else {"kind": boss["kind"], "hp": int(boss["hp"]), "shield": boss["shield"], "dead": boss["dead"], "rage": boss["rage"]},
		"right": quiz["opts"].find(quiz["a"]) if not quiz.is_empty() else -1, "quizDone": quiz.get("done", false), "kills": kills, "ups": meta["up"], "stars": done_stars,
		"rooms": map.get("rooms", []).size(), "explored": explored.size(), "lifts": lifts.size(), "ladders": ladders, "mapW": mw, "mapH": mh, "flasks": flasks, "flasksMax": flasks_max,
		"offers": offers.map(func(o): return o["title"]), "climbing": climbing, "onLift": not on_lift.is_empty(), "lift0": {} if lifts.is_empty() else {"x": int(lifts[0]["x"]), "y": int(lifts[0]["y"]), "top": int(lifts[0]["top"]), "bottom": int(lifts[0]["bottom"]), "target": int(lifts[0]["target"]), "stand": snappedf(lifts[0]["stand"], 0.01)}, "camY": int(cam.y)}

# ---------- рисование ----------

func _spr(name: String, cx: float, feet: float, height: float, flip: bool = false, mod: Color = Color.WHITE, angle: float = 0.0) -> void:
	var t: Texture2D = tex[name]
	var w := height * t.get_width() / t.get_height()
	draw_set_transform(Vector2(cx, feet - (height / 2.0 if angle != 0.0 else 0.0)), angle, Vector2(-1.0 if flip else 1.0, 1.0))
	draw_texture_rect(t, Rect2(-w / 2.0, -height / 2.0 if angle != 0.0 else -height, w, height), false, mod)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _weapon(name: String, hand: Vector2, angle: float, length: float, mod: Color = Color.WHITE) -> void:
	var t: Texture2D = tex[name]
	var h := length * t.get_height() / t.get_width()
	draw_set_transform(hand, angle, Vector2(1.0, -1.0 if absf(angle) > PI / 2.0 else 1.0))
	draw_texture_rect(t, Rect2(-length * 0.12, -h / 2.0, length, h), false, mod)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _vis(x: float, y: float, m: float = 200.0) -> bool:
	return x - cam.x > -m and x - cam.x < W + m and y - cam.y > -m and y - cam.y < H + m

func draw_game() -> void:
	if mode == "menu" or mode == "kit" or rows.is_empty():
		backdrop(Color("0c1230"), Color("241445"))
		draw_texture_rect(tex["bg_forest"], Rect2(0, 0, W, H), false, Color(0.5, 0.5, 0.62))
		draw_rect(Rect2(0, 0, W, H), Color(0.03, 0.04, 0.12, 0.55))
		return
	var art := "rest" if map.get("rooms", [{}])[0].get("kind", "") == "passage" else biome
	var tile_art := biome if art != "rest" else "grove"
	# Дальний план: едет медленнее камеры по обеим осям.
	var bg: Texture2D = tex["bg_" + art]
	var off := Vector2(fmod(cam.x * 0.2, W), cam.y * 0.08)
	for i in 2:
		draw_texture_rect(bg, Rect2(i * W - off.x, -off.y, W + 1.0, H + 60.0), false, Color(0.72, 0.72, 0.8))
	draw_rect(Rect2(0, 0, W, H), Color(0.03, 0.04, 0.12, 0.3))
	for tc in torches:
		if _vis(tc.x, tc.y):
			_spr("p_torch", tc.x - cam.x, tc.y + 30.0 - cam.y, 56.0)
	var x0 := int(floorf(cam.x / T))
	var y0 := int(floorf(cam.y / T))
	var top_t: Texture2D = tex["tile_%s_top" % tile_art]
	var fill_t: Texture2D = tex["tile_%s_fill" % tile_art]
	var half := top_t.get_width() / 2.0
	for ty in range(y0, y0 + 17):
		if ty < 0 or ty >= mh:
			continue
		var line: String = rows[ty]
		for tx in range(x0, x0 + 28):
			if tx < 0 or tx >= mw:
				continue
			var ch := line[tx]
			if ch == " ":
				continue
			var r := Rect2(tx * T - cam.x, ty * T - cam.y, T + 1.0, T + 1.0)
			match ch:
				"#":
					var top: bool = ty > 0 and not _solid_t(tx, ty - 1)
					draw_texture_rect_region(top_t if top else fill_t, r, Rect2((tx % 2) * half, 0.0 if top else (ty % 2) * half, half, half))
					if not top:
						# дальше от края — темнее: камень выглядит объёмным
						var depth := 0
						for d in [1, 2]:
							if _solid_t(tx, ty - d) and _solid_t(tx - d, ty) and _solid_t(tx + d, ty) and _solid_t(tx, ty + d):
								depth = d
						if depth > 0:
							draw_rect(r, Color(0.02, 0.02, 0.06, 0.28 * depth))
				"=":
					draw_texture_rect_region(top_t, Rect2(r.position.x, r.position.y, T + 1.0, T * 0.42), Rect2((tx % 2) * half, 0.0, half, half * 0.42))
					draw_rect(Rect2(r.position.x, r.position.y + T * 0.42, T + 1.0, 3.0), Color(0, 0, 0, 0.35))
				"H":
					_spr("p_ladder", r.position.x + T / 2.0, r.position.y + T + 2.0, T + 4.0)
				"^":
					draw_texture_rect(tex["p_spikes"], Rect2(r.position.x, r.position.y + T * 0.45, T + 1.0, T * 0.56), false)
				"K":
					if _tile(tx, ty - 1) != "K":
						_spr("p_kdoor", r.position.x + T / 2.0, r.position.y + T * 3.0, T * 3.0)
	for l in lifts:
		if _vis(l["x"], l["y"]):
			var top_y: float = l["top"] - cam.y
			draw_line(Vector2(l["x"] - 40.0 - cam.x, top_y - T * 2), Vector2(l["x"] - 40.0 - cam.x, l["y"] - cam.y - 60.0), Color(0.5, 0.5, 0.55), 3.0)
			draw_line(Vector2(l["x"] + 40.0 - cam.x, top_y - T * 2), Vector2(l["x"] + 40.0 - cam.x, l["y"] - cam.y - 60.0), Color(0.5, 0.5, 0.55), 3.0)
			_spr("n_lift", l["x"] - cam.x, l["y"] - cam.y + 10.0, 110.0)
	for t in things:
		if not _vis(t["x"], t["y"]):
			continue
		var c := Vector2(t["x"] - cam.x, t["y"] - cam.y)
		match t["kind"]:
			"term", "bterm":
				if t["state"] == "off":
					continue
				var fresh: bool = t["state"] == "new"
				_spr("p_term_on" if fresh else "p_term_off", c.x, c.y + 4.0, 92.0 if fresh else 62.0, false, Color.WHITE if fresh else (Color(0.6, 1.0, 0.75) if t["state"] == "ok" else Color(1.0, 0.6, 0.6)))
				if fresh:
					text("ТЕРМИНАЛ", c + Vector2(0, -104.0 + sin(time * 3.0 + t["x"]) * 4.0), 13, Color("7df9ff"))
				else:
					text("✓" if t["state"] == "ok" else "✗", c + Vector2(0, -76.0), 22, Color("5fe0b5") if t["state"] == "ok" else Color("ff7a7a"), false)
			"chest":
				_spr("p_chest_open" if t["used"] else "p_chest", c.x, c.y + 4.0, 52.0 if not t["used"] else 62.0)
			"scroll":
				if not t["used"]:
					_spr("p_scroll", c.x, c.y - 6.0 + sin(time * 3.0) * 5.0, 56.0)
			"food":
				if not t["used"]:
					_spr("p_food", c.x, c.y + 2.0, 42.0)
			"shop":
				_spr("n_merchant", c.x, c.y + 6.0, 118.0)
				text("ТОРГОВЕЦ", c + Vector2(0, -130.0), 13, GOLD)
			"collector":
				_spr("n_collector", c.x, c.y + 6.0, 150.0)
				text("КОЛЛЕКЦИОНЕР", c + Vector2(0, -164.0), 13, Color("7df9ff"))
			"fountain":
				_spr("n_fountain", c.x, c.y + 6.0, 120.0)
				text("ФОНТАН", c + Vector2(0, -134.0), 13, Color("7df9ff"))
			"portal", "door":
				_spr("p_portal", c.x, c.y + 6.0, 150.0, false, Color.WHITE if t["kind"] == "portal" else Color(1.0, 0.9, 0.7))
				if t["kind"] == "door":
					text(World.BIOMES[t["to"]]["name"].to_upper(), c + Vector2(0, -170.0), 14, GOLD)
				else:
					text("ПОРТАЛ", c + Vector2(0, -170.0), 14, Color("7df9ff"))
	for d in drops:
		if not _vis(d["x"], d["y"]):
			continue
		var c := Vector2(d["x"] - cam.x, d["y"] - cam.y)
		match d["kind"]:
			"byte":
				_spr("p_gem", c.x, c.y + 14.0 + sin(time * 5.0 + d["x"]) * 2.0, 28.0)
			"cell":
				_spr("p_cell", c.x, c.y + 16.0 + sin(time * 4.0 + d["x"]) * 3.0, 34.0)
			_:
				_spr("p_food", c.x, c.y + 14.0, 32.0)
	for b in bombs:
		var c := Vector2(b["x"] - cam.x, b["y"] - cam.y)
		draw_circle(c, 11.0, Color("2a2a33"))
		draw_circle(c + Vector2(4, -6), 3.0, Color("ffd34d") if fmod(time * 10.0, 2.0) < 1.0 else Color("ff5a4a"))
		if b["fuse"] >= 0.0:
			draw_arc(c, 100.0, 0.0, TAU, 40, Color(1.0, 0.4, 0.2, 0.35 + 0.3 * sin(time * 20.0)), 3.0)
	for h in hazards:
		var x: float = h["x"] - cam.x
		var a: float = 0.25 + 0.25 * sin(time * 18.0)
		if h["kind"] == "rain":
			draw_rect(Rect2(x - 30.0, 0, 60.0, H), Color(0.5, 1.0, 0.6, a * 0.5))
		else:
			draw_rect(Rect2(x - 34.0, (mh - 1) * T - cam.y - 8.0, 68.0, 8.0), Color(0.5, 0.9, 1.0, a + 0.3))
	for f in foes:
		if _vis(f["x"], f["y"]):
			_draw_foe(f)
	if not boss.is_empty() and not boss["dead"]:
		_draw_boss()
	for s in shots:
		var c := Vector2(s["x"] - cam.x, s["y"] - cam.y)
		if s["own"] == "p":
			if s.get("kind", "orb") == "arrow":
				_weapon("w_arrow", c - Vector2(s["vx"], s["vy"]).normalized() * 22.0, Vector2(s["vx"], s["vy"]).angle(), 46.0)
			else:
				draw_circle(c, 9.0, Color(1.0, 0.55, 0.15, 0.9))
				draw_circle(c, 5.0, Color("ffe08a"))
		elif s.get("kind", "") == "wave":
			draw_rect(Rect2(c.x - 16.0, c.y - 26.0, 32.0, 40.0), Color(1.0, 0.6, 0.3, 0.55))
		elif s.get("kind", "") == "letter":
			rr(Rect2(c - Vector2(14, 10), Vector2(28, 20)), Color("f4f1ea"), 3, Color("3a8a3a"), 2)
		else:
			_spr("p_fireball", c.x, c.y, 22.0, s["vx"] > 0.0, Color.WHITE, 0.0001)
	for b in beams:
		var k: float = clampf(b["t"] * 4.0, 0.0, 1.0)
		if b.has("line"):
			draw_line(b["line"][0] - cam, b["line"][1] - cam, Color(b["color"].r, b["color"].g, b["color"].b, b["color"].a * k), b["w"])
			draw_line(b["line"][0] - cam, b["line"][1] - cam, Color(1, 1, 1, 0.8 * k), b["w"] * 0.3)
		else:
			var rct: Rect2 = b["rect"]
			draw_rect(Rect2(rct.position - cam, rct.size), Color(b["color"].r, b["color"].g, b["color"].b, b["color"].a * k))
	for q in pops:
		text(q["text"], Vector2(q["x"] - cam.x, q["y"] - cam.y), 20, Color(q["color"].r, q["color"].g, q["color"].b, minf(1.0, q["t"] * 3.0)))
	_draw_hero()
	if not _near().is_empty():
		var n := _near()
		var hint: String = {"term": "E — терминал", "bterm": "E — терминал", "kdoor": "E — дверь знаний", "chest": "E — открыть", "scroll": "E — взять свиток", "food": "E — съесть",
			"shop": "E — торговец", "collector": "E — Коллекционер", "fountain": "E — фонтан", "door": "E — идти", "portal": "E — портал"}.get(n["kind"], "E")
		text(hint, Vector2(px - cam.x, py - 128.0 - cam.y), 16, GOLD)
	elif _on_ladder() and not climbing:
		text("↑ / ↓ — лестница", Vector2(px - cam.x, py - 120.0 - cam.y), 14, MUTED)

func _draw_foe(f: Dictionary) -> void:
	var c := Vector2(f["x"] - cam.x, f["y"] - cam.y)
	var frame := "a" if fmod(time * 5.0 + f["t"], 2.0) < 1.0 else "b"
	var winding: bool = f["st"] == "wind"
	var mod := Color(3, 3, 3) if f["flash"] > 0.0 else (Color(1.6, 0.7, 0.7) if winding and fmod(time * 14.0, 2.0) < 1.0 else Color.WHITE)
	if f["stun"] > 0.0:
		mod = Color(0.7, 0.7, 1.2)
	var look_right: bool = (px > f["x"]) if f["seen"] or f["kind"] in ["bee", "turret", "shield", "frog"] else f.get("dir", -1) > 0
	var s: float = 1.2 if f["elite"] else 1.0
	if f["elite"]:
		draw_circle(c + Vector2(0, -f["h"] / 2.0), f["w"] * 0.9, Color(1.0, 0.4, 0.2, 0.12 + 0.06 * sin(time * 5.0)))
	match f["kind"]:
		"slime": _spr("foe_slime_" + frame, c.x, c.y + 6.0, 52.0 * s, look_right, mod)
		"bug": _spr("foe_bug_" + frame, c.x, c.y + 8.0, 118.0 * s, look_right, mod)
		"fly": _spr("foe_fly_" + frame, c.x, c.y + 12.0, 54.0 * s, look_right, mod)
		"frog": _spr("foe_frog_b" if f["vy"] != 0.0 else "foe_frog_a", c.x, c.y + 6.0, (56.0 if f["vy"] == 0.0 else 78.0) * s, look_right, mod)
		"bee": _spr("foe_bee_" + frame, c.x, c.y + 14.0, 62.0 * s, look_right, mod)
		"shield": _spr("foe_shield_" + ("b" if f["st"] in ["wind", "act"] else "a"), c.x, c.y + 6.0, 86.0 * s, look_right, mod)
		"skel": _spr("foe_skel_" + ("b" if f["st"] in ["wind", "act"] else "a"), c.x, c.y + 6.0, 96.0 * s, look_right, mod)
		"bomber": _spr("foe_bomber_" + ("b" if f["st"] == "wind" else "a"), c.x, c.y + 6.0, 76.0 * s, look_right, mod)
		"wraith": _spr("foe_wraith_" + ("b" if f["st"] == "wind" else "a"), c.x, c.y + 10.0, 80.0 * s, look_right, Color(mod.r, mod.g, mod.b, f["alpha"]))
		"worm":
			if f["hidden"]:
				var k := 0.5 + 0.5 * sin(time * 9.0)
				draw_circle(c + Vector2(0, -2), 16.0 + (6.0 * k if f["st"] == "wind" else 0.0), Color(0.35, 0.25, 0.15, 0.9))
				if f["st"] == "wind":
					burst(c + Vector2(0, -6), Color(0.6, 0.45, 0.3), 1, 120.0, "p_smoke")
				return
			_spr("foe_worm_" + ("b" if f["st"] == "act" and f["st_t"] > 1.0 else "a"), c.x, c.y + 8.0, 100.0 * s, look_right, mod)
		"turret":
			_spr("foe_turret_" + ("b" if winding else "a"), c.x, c.y + 6.0, 80.0 * s, look_right, mod)
			if winding:
				var eye := Vector2(f["x"], f["y"] - f["h"] * 0.7) - cam
				draw_line(eye, eye + f["aim"] * 900.0, Color(1.0, 0.2, 0.2, 0.35 if f["st_t"] > 0.25 else 0.8), 2.0 if f["st_t"] > 0.25 else 4.0)
	if winding and f["kind"] != "turret":
		text("!", c + Vector2(0, -f["h"] - 34.0), 26, Color("ff5a4a"))
	if f["hp"] < f["max"]:
		draw_rect(Rect2(c.x - 24.0, c.y - f["h"] - 16.0, 48.0, 6.0), Color("0b0f1c"))
		draw_rect(Rect2(c.x - 23.0, c.y - f["h"] - 15.0, 46.0 * f["hp"] / f["max"], 4.0), Color("ff5a6a"))
	if f["elite"]:
		text("ЭЛИТА · " + FOES[f["kind"]]["title"], c + Vector2(0, -f["h"] - 30.0), 12, Color("ff9a6a"))

func _draw_boss() -> void:
	var c := Vector2(boss["x"] - cam.x, boss["y"] - cam.y)
	var mod := Color(3, 3, 3) if boss["flash"] > 0.0 else (Color(1.5, 0.8, 0.8) if boss["st"] == "wind" and fmod(time * 12.0, 2.0) < 1.0 else Color.WHITE)
	var flip: bool = boss["face"] > 0
	match boss["kind"]:
		"spam":
			_spr("boss_spam_attack" if boss["st"] == "wind" else "boss_spam_idle", c.x, c.y + 10.0, 230.0, flip, mod)
		"guard":
			_spr("boss_guard_attack" if boss["st"] in ["wind", "dash"] else "boss_guard_idle", c.x, c.y + 10.0, 230.0, flip, mod)
			if boss["st"] == "open":
				text("ОТКРЫТ!", c + Vector2(0, -250.0), 18, GOLD)
		"glitch":
			if boss["rage"]:
				_spr("boss_rage_attack" if boss["st"] == "wind" else "boss_rage_idle", c.x, c.y + 10.0, 220.0, flip, mod)
				if boss["st"] == "wind":
					var eye := Vector2(boss["x"], boss["y"] - 90.0) - cam
					draw_line(eye, eye + boss["aim"] * 1600.0, Color(1.0, 0.3, 0.6, 0.4), 3.0)
			else:
				_spr("boss_jump" if boss["vy"] != 0.0 else "boss_idle", c.x, c.y + 14.0, 190.0, flip, mod)
	if boss["shield"]:
		draw_arc(c + Vector2(0, -80.0), 118.0 + sin(time * 6.0) * 4.0, 0.0, TAU, 48, Color(0.5, 0.95, 1.0, 0.9), 5.0)
		draw_arc(c + Vector2(0, -80.0), 108.0 - sin(time * 6.0) * 3.0, 0.0, TAU, 48, Color(0.5, 0.95, 1.0, 0.35), 10.0)

func _draw_hero() -> void:
	var hc := Vector2(px - cam.x, py - cam.y)
	var aiming: bool = shot_cd > RANGED[ranged]["cd"] - 0.22
	var spr := "hero_idle"
	if hurt > 0.6:
		spr = "hero_hurt"
	elif roll > 0.0:
		spr = "hero_roll"
	elif swing > 0.0:
		spr = "hero_attack"
	elif aiming:
		spr = "hero_aim"
	elif climbing:
		spr = "hero_jump" if fmod(time * 6.0, 2.0) < 1.0 else "hero_fall"
	elif not on_floor:
		spr = "hero_jump" if vy < 0.0 else "hero_fall"
	elif absf(vx) > 40.0:
		spr = "hero_run_" + ["a", "b", "c", "b"][int(fmod(time * 11.0, 4.0))]
	var hk: float = 98.0 / tex["hero_idle"].get_height()
	var hh: float = tex[spr].get_height() * hk
	if hurt <= 0.0 or fmod(time * 16.0, 2.0) < 1.2:
		if roll > 0.0:
			for k in 3:
				_spr(spr, hc.x - face * (k + 1) * 22.0, hc.y + 2.0, hh, face < 0, Color(0.6, 0.9, 1.0, 0.25 - k * 0.07), face * (time * 18.0 - k * 0.5))
			_spr(spr, hc.x, hc.y + 2.0, hh, face < 0, Color.WHITE, face * time * 18.0)
		else:
			if swing <= 0.0 and not aiming:
				_weapon("w_" + melee, hc + Vector2(-face * 8.0, -42.0), (2.2 if face > 0 else PI - 2.2), 54.0, Color(0.75, 0.75, 0.85))
			for o in [Vector2(-2, 0), Vector2(2, 0), Vector2(0, -2), Vector2(0, 2)]:
				_spr(spr, hc.x + o.x, hc.y + 6.0 + o.y, hh, face < 0, Color(0.55, 0.9, 1.0, 0.35))
			_spr(spr, hc.x, hc.y + 6.0, hh, face < 0, Color(1.15, 1.15, 1.2))
	if swing > 0.0 and roll <= 0.0:
		var m: Dictionary = MELEE[melee]
		var k: float = 1.0 - swing / m["time"]
		var ang := lerpf(-1.9, 0.75, k) if melee != "spear" else lerpf(-0.15, 0.1, k)
		var hand := hc + Vector2(face * (20.0 + (m["reach"] * 0.35 * sin(k * PI) if melee == "spear" else 0.0)), -52.0)
		_weapon("w_" + melee, hand, ang if face > 0 else PI - ang, m["reach"] * (0.74 if melee != "spear" else 0.9))
		if melee != "spear":
			var a1 := -1.5 if face > 0 else PI + 1.5
			var a2 := lerpf(-1.5, 0.9, k) if face > 0 else PI - lerpf(-1.5, 0.9, k)
			draw_arc(hc + Vector2(face * 16.0, -48.0), m["reach"] * 0.78, a1, a2, 16, Color(1, 1, 1, 0.75 * (1.0 - k)), 9.0)
			draw_arc(hc + Vector2(face * 16.0, -48.0), m["reach"] * 0.66, a1, a2, 16, Color(0.5, 0.95, 1.0, 0.6 * (1.0 - k)), 5.0)
	elif aiming and roll <= 0.0:
		_weapon("w_" + ranged, hc + Vector2(face * 36.0, -60.0) - (Vector2(face * 6.0, 0.0) if ranged == "bow" else Vector2.ZERO), 0.0 if face > 0 else PI, 18.0 if ranged == "bow" else 62.0)

func draw_lights(ci: CanvasItem) -> void:
	if mode != "zone" or rows.is_empty():
		return
	glow(ci, Vector2(px - cam.x, py - 40.0 - cam.y), 260.0, Color(0.3, 0.8, 1.0, 0.16))
	for tc in torches:
		if _vis(tc.x, tc.y):
			glow(ci, Vector2(tc.x - cam.x, tc.y - 12.0 - cam.y), 150.0 + 10.0 * sin(time * 7.0 + tc.x), Color(0.35, 0.8, 1.0, 0.22))
	for t in things:
		if not _vis(t["x"], t["y"]):
			continue
		var c := Vector2(t["x"] - cam.x, t["y"] - 50.0 - cam.y)
		match t["kind"]:
			"term", "bterm":
				if t["state"] == "new":
					glow(ci, c, 200.0, Color(0.4, 0.9, 1.0, 0.3 + 0.1 * sin(time * 4.0)))
			"portal", "door", "fountain":
				glow(ci, c - Vector2(0, 20), 260.0, Color(0.4, 0.7, 1.0, 0.35 + 0.1 * sin(time * 3.0)))
			"scroll":
				if not t["used"]:
					glow(ci, c, 160.0, Color(0.75, 0.5, 1.0, 0.35))
			"chest":
				if not t["used"]:
					glow(ci, c + Vector2(0, 26), 120.0, Color(1.0, 0.8, 0.3, 0.2 + 0.08 * sin(time * 3.0)))
	for d in drops:
		if d["kind"] == "cell":
			glow(ci, Vector2(d["x"] - cam.x, d["y"] - cam.y), 70.0, Color(0.3, 0.7, 1.0, 0.45))
	for s in shots:
		glow(ci, Vector2(s["x"] - cam.x, s["y"] - cam.y), 70.0, Color(0.4, 0.9, 1.0, 0.5) if s["own"] == "p" else Color(1.0, 0.5, 0.2, 0.5))
	if not boss.is_empty() and not boss["dead"]:
		glow(ci, Vector2(boss["x"] - cam.x, boss["y"] - 90.0 - cam.y), 420.0, Color(0.9, 0.2, 0.9, 0.25) if not boss["shield"] else Color(0.4, 0.9, 1.0, 0.35))

func _hud() -> void:
	rr(Rect2(16, 12, 124, 40), Color(0.13, 0.17, 0.3, 0.92), 10, Color("0b0f1c"), 2)
	text("← Игры", Vector2(78, 31), 16, INK, false)
	if mode == "menu" or mode == "kit":
		return
	rr(Rect2(160, 14, 304, 30), Color("0b0f1c"), 12)
	rr(Rect2(163, 17, maxf(6.0, 298.0 * hp / hp_max), 24), Color("ff5a6a") if hp / hp_max > 0.3 else Color("ff9a3a"), 10)
	hp = minf(hp, hp_max)
	text("%d / %d" % [mini(int(ceil(hp)), int(round(hp_max))), int(round(hp_max))], Vector2(312, 30), 15, Color.WHITE)
	for i in flasks_max:
		_spr("p_flask", 486.0 + i * 26.0, 43.0, 26.0, false, Color.WHITE if i < flasks else Color(1, 1, 1, 0.25))
	text("F — фляга", Vector2(312, 58), 12, MUTED, false)
	var place: String = "Переход" if map.get("rooms", [{}])[0].get("kind", "") == "passage" else World.BIOMES[biome]["name"]
	text("ЭТАП %d / 5 · %s" % [stage + 1, place], Vector2(760, 22), 15, GOLD)
	var marks := ""
	for t in things:
		if t["kind"] == "term":
			marks += "✓ " if t["state"] == "ok" else ("✗ " if t["state"] == "bad" else "○ ")
	if marks != "":
		text("терминалы: " + marks, Vector2(760, 44), 13, INK, false)
	_spr("p_gem", 1006.0, 40.0, 26.0)
	text(str(bytes), Vector2(1040, 28), 20, GOLD)
	_spr("p_cell", 1080.0, 44.0, 30.0)
	text(str(cells_n), Vector2(1112, 28), 20, Color("7df9ff"))
	if scrolls > 0:
		_spr("p_scroll", 1150.0, 44.0, 28.0)
		text(str(scrolls), Vector2(1176, 28), 18, Color("c08bff"))
	if not boss.is_empty() and not boss["dead"]:
		rr(Rect2(340, 664, 600, 24), Color("0b0f1c"), 10)
		rr(Rect2(343, 667, maxf(4.0, 594.0 * boss["hp"] / boss["max"]), 18), Color("b48cff") if not boss["shield"] else Color("7df9ff"), 8)
		text(BOSSES[boss["kind"]]["title"].to_upper() + (" · ЩИТ: ответь на вопрос терминала" if boss["shield"] else (" · ЯРОСТЬ" if boss["rage"] else "")), Vector2(640, 650), 15, INK)
	if note_t > 0.0 and mode == "zone":
		rr(Rect2(240, 76, 800, 34), Color(0.03, 0.05, 0.12, 0.6 * minf(1.0, note_t)), 12)
		text(note, Vector2(640, 93), 17, Color(1, 1, 1, minf(1.0, note_t)))
	if perks.size() > 0:
		var names := []
		for p in PERKS:
			if perks.has(p["id"]):
				names.append(p["title"])
		draw_string(font, Vector2(20, 706), "Мутации: " + ", ".join(names), HORIZONTAL_ALIGNMENT_LEFT, 640, 13, MUTED)
	rr(Rect2(16, 62, 150, 64), Color(0.05, 0.07, 0.14, 0.8), 10)
	_weapon("w_" + melee, Vector2(30, 82), 0.0, 40.0)
	draw_string(font, Vector2(78, 87), "X · " + MELEE[melee]["title"], HORIZONTAL_ALIGNMENT_LEFT, 90, 14, INK)
	_weapon("w_" + ranged, Vector2(30 if ranged != "bow" else 44, 108), 0.0, 40.0 if ranged != "bow" else 14.0)
	draw_string(font, Vector2(78, 113), "C · " + RANGED[ranged]["title"], HORIZONTAL_ALIGNMENT_LEFT, 90, 14, INK)
	draw_string(font, Vector2(690, 706), "X удар · C выстрел · Shift перекат · E действие · ↑↓ лестница · ↓+прыжок вниз · M карта", HORIZONTAL_ALIGNMENT_LEFT, 590, 12, Color(1, 1, 1, 0.45))
	if mode == "zone":
		_draw_minimap(big_map)

func _draw_minimap(big: bool) -> void:
	# Карта уровня по комнатам: видны только уже пройденные (или все — с улучшением «Картограф»).
	var g: Vector2i = map.get("grid", Vector2i(1, 1))
	if g == Vector2i(1, 1):
		return
	var cw := 120.0 if big else 30.0
	var ch := cw * World.RH / World.RW
	var size := Vector2(g.x * cw, g.y * ch)
	var at := Vector2(640.0 - size.x / 2.0, 360.0 - size.y / 2.0) if big else Vector2(W - size.x - 18.0, 70.0)
	if big:
		draw_rect(Rect2(0, 0, W, H), Color(0.02, 0.03, 0.08, 0.75))
		text("КАРТА · %s" % World.BIOMES[biome]["name"].to_upper(), Vector2(640, at.y - 30.0), 22, INK)
	rr(Rect2(at - Vector2(6, 6), size + Vector2(12, 12)), Color(0.03, 0.05, 0.12, 0.8), 8)
	var mine := _room_of(px, py - 20.0)
	for r in map["rooms"]:
		var c: Vector2i = r["cell"]
		if not explored.has(c):
			continue
		var rect := Rect2(at + Vector2(c.x * cw, c.y * ch), Vector2(cw - 2.0, ch - 2.0))
		var col := Color("2c3a62")
		match r["kind"]:
			"treasure": col = Color("5a3f8a")
			"shop": col = Color("6a5a24")
			"exit": col = Color("1f5a7a")
			"start": col = Color("1f5a45")
		draw_rect(rect, col)
		if c == mine:
			draw_rect(rect, Color(1, 1, 1, 0.25 + 0.2 * sin(time * 5.0)))
	for l in map["links"]:
		if explored.has(l[0]) and explored.has(l[1]):
			var a: Vector2 = at + Vector2(l[0].x * cw + cw / 2.0, l[0].y * ch + ch / 2.0)
			var b: Vector2 = at + Vector2(l[1].x * cw + cw / 2.0, l[1].y * ch + ch / 2.0)
			draw_line(a, b, Color(0.6, 0.8, 1.0, 0.5), 2.0 if not big else 4.0)
	var k := Vector2(cw / (World.RW * T), ch / (World.RH * T))
	for t in things:
		if not explored.has(_room_of(t["x"], t["y"] - 10.0)):
			continue
		var p := at + Vector2(t["x"] * k.x, t["y"] * k.y)
		match t["kind"]:
			"term":
				if t["state"] == "new":
					draw_circle(p, 3.0 if not big else 6.0, Color("7df9ff"))
			"portal":
				draw_circle(p, 4.0 if not big else 8.0, Color("ffd34d"))
			"shop":
				draw_circle(p, 3.0 if not big else 6.0, Color("ffb86b"))
			"chest", "scroll":
				if not t["used"]:
					draw_circle(p, 3.0 if not big else 6.0, Color("c08bff"))
	draw_circle(at + Vector2(px * k.x, py * k.y), 3.5 if not big else 7.0, Color("ff5a6a"))
	if big:
		text("● ты   ● терминал   ● портал   ● лавка   ● сокровище   · M — закрыть", Vector2(640, at.y + size.y + 36.0), 14, MUTED, false)

func _card(r: Rect2, k: int, head: String, body: String, foot: String, color: Color, active: bool = true, icon: String = "") -> void:
	rr(Rect2(r.position + Vector2(0, 6), r.size), Color(0, 0, 0, 0.35), 18)
	rr(r, Color("1c2644") if active else Color("161c30"), 18, color if active else Color("2c3a5e"), 3)
	rr(Rect2(r.position + Vector2(14, 14), Vector2(40, 40)), color if active else Color("3a4667"), 12)
	text(str(k + 1), r.position + Vector2(34, 34), 22, Color.WHITE)
	if icon != "" and tex.has(icon):
		_spr(icon, r.position.x + r.size.x - 40.0, r.position.y + 62.0, 50.0)
	draw_string(font_b, r.position + Vector2(66, 42), head, HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 120, 18, INK if active else MUTED)
	draw_multiline_string(font, r.position + Vector2(18, 86), body, HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 36, 14, 4, MUTED)
	draw_string(font_b, r.position + Vector2(18, r.size.y - 16), foot, HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 36, 15, GOLD if active else Color(1, 1, 1, 0.3))
	hot.append([r, k])

func _overlay() -> void:
	pass

func _draw() -> void:
	hot = []
	super()
	match mode:
		"menu": _draw_menu()
		"quiz": _draw_quiz()
		"rest": _draw_rest()
		"kit": _draw_kit()
		"shop": _draw_shop()
		"collector": _draw_collector()
		"dead", "win": _draw_end()

func _draw_menu() -> void:
	text("КЛЕТКИ ПАМЯТИ", Vector2(640, 88), 52, INK)
	text("%d класс · экшен с забегами в духе Dead Cells · знания открывают двери" % grade, Vector2(640, 134), 17, Color("5fe0b5"), false)
	draw_multiline_string(font, Vector2(150, 172), "Глюк разбил память Кодограда. Пять этапов, большие запутанные уровни: лестницы, лифты, тайные сокровищницы за дверями знаний, торговцы. Маршрут ветвится — выбирай биом. Враги хитрые: следи за замахом и уходи перекатом. Клетки из врагов неси Коллекционеру в «Переходе» — его улучшения остаются навсегда. Погиб — неотданные клетки пропадают.", HORIZONTAL_ALIGNMENT_CENTER, 980, 16, 5, MUTED)
	text("УЛУЧШЕНИЯ КОЛЛЕКЦИОНЕРА", Vector2(640, 314), 16, Color("7df9ff"))
	for k in COLLECTOR.size():
		var u: Dictionary = COLLECTOR[k]
		var lvl := _up(u["id"])
		var r := Rect2(110 + (k % 3) * 360, 334 + (k / 3) * 70, 340, 60)
		rr(r, Color("1c2644"), 12, Color("3b4d78") if lvl == 0 else Color("22b07d"), 2)
		draw_string(font_b, r.position + Vector2(14, 26), "%s  %d / %d" % [u["title"], lvl, u["cost"].size()], HORIZONTAL_ALIGNMENT_LEFT, 310, 15, INK)
		draw_string(font, r.position + Vector2(14, 48), u["about"], HORIZONTAL_ALIGNMENT_LEFT, 310, 13, MUTED)
	var got := 0
	for n in done_stars:
		got += int(done_stars[n])
	text("Звёзд за этапы: %d из 15 · забегов: %d · дальше всего: этап %d · отдано клеток: %d" % [got, meta["runs"], mini(5, meta["best"] + 1), meta["cells"]], Vector2(640, 498), 15, MUTED, false)
	var r := Rect2(440, 530, 400, 60)
	rr(Rect2(r.position + Vector2(0, 5), r.size), Color("0f7350"), 16)
	rr(r, Color("22b07d"), 16)
	text("ПРОБЕЛ — НАЧАТЬ ЗАБЕГ", r.get_center(), 22, Color.WHITE)
	hot.append([r, 99])
	text("← → бег · ↑ прыжок и лестница · X удар · C выстрел · Shift перекат · F фляга · E действие · M карта · 1–3 ответ", Vector2(640, 640), 14, MUTED, false)

func _draw_quiz() -> void:
	draw_rect(Rect2(0, 0, W, H), Color(0.03, 0.05, 0.12, 0.78))
	var r := Rect2(200, 110, 880, 500)
	rr(r.grow(6), Color(0, 0, 0, 0.35), 30)
	rr(r, Color("16203a"), 26, Color("7df9ff") if quiz["thing"]["kind"] != "kdoor" else Color("c08bff"), 3)
	text("ДВЕРЬ ЗНАНИЙ" if quiz["thing"]["kind"] == "kdoor" else "ТЕРМИНАЛ ЗНАНИЙ", Vector2(640, 150), 18, Color("7df9ff"))
	var q: String = quiz["q"]
	draw_multiline_string(font_b, Vector2(240, 206), q, HORIZONTAL_ALIGNMENT_CENTER, 800, 28 if q.length() < 40 else 22, 3, INK)
	for k in 3:
		var o: String = quiz["opts"][k]
		var b := Rect2(250, 280 + k * 78, 780, 62)
		var col := Color("243253")
		if quiz["done"]:
			if o == quiz["a"]:
				col = Color("1f7a57")
			elif k == quiz["pick"]:
				col = Color("8a2f3c")
		rr(Rect2(b.position + Vector2(0, 5), b.size), col.darkened(0.45), 14)
		rr(b, col, 14)
		rr(Rect2(b.position + Vector2(10, 10), Vector2(42, 42)), Color(0, 0, 0, 0.3), 10)
		text(str(k + 1), b.position + Vector2(31, 31), 22, GOLD)
		draw_string(font_b, b.position + Vector2(70, 40), o, HORIZONTAL_ALIGNMENT_LEFT, 690, 22, Color.WHITE)
		hot.append([b, k])
	if quiz["done"]:
		text("Верно!" if quiz["right"] else "Неверно. Правильный ответ: %s" % quiz["a"], Vector2(640, 532), 20, Color("5fe0b5") if quiz["right"] else Color("ff8a8a"))
		if not quiz["right"] and quiz["e"] != "":
			draw_multiline_string(font, Vector2(240, 562), quiz["e"], HORIZONTAL_ALIGNMENT_CENTER, 800, 15, 2, MUTED)
	else:
		text("Клавиши 1, 2, 3 или щелчок. Пока думаешь, игра стоит на паузе.", Vector2(640, 540), 15, MUTED, false)
		text("Ошибка породит сильного врага — бага.", Vector2(640, 566), 14, Color("ffb3b3"), false)

func _draw_kit() -> void:
	draw_rect(Rect2(0, 0, W, H), Color(0.03, 0.05, 0.12, 0.62))
	text("ВЫБЕРИ ОРУЖИЕ", Vector2(640, 96), 44, INK)
	text("Удар — X, выстрел — C. Другое оружие — в сундуках и у торговцев.", Vector2(640, 146), 16, MUTED, false)
	for k in KITS.size():
		var kit: Dictionary = KITS[k]
		var r := Rect2(40 + k * 305, 190, 290, 370)
		rr(Rect2(r.position + Vector2(0, 6), r.size), Color("0b0f1c"), 18)
		rr(r, Color("1b2540"), 18, Color("3b4d78"), 2)
		rr(Rect2(r.position + Vector2(12, 12), Vector2(34, 34)), Color("0b0f1c"), 9)
		text(str(k + 1), r.position + Vector2(29, 29), 20, GOLD)
		text(kit["title"], r.position + Vector2(160, 30), 24, INK)
		rr(Rect2(r.position + Vector2(14, 58), Vector2(262, 150)), Color(0.04, 0.06, 0.12, 0.7), 12)
		_weapon("w_" + kit["melee"], r.position + Vector2(70, 128), -0.42, 150.0)
		_weapon("w_" + kit["ranged"], r.position + Vector2(96 if kit["ranged"] != "bow" else 150, 172), 0.0, 120.0 if kit["ranged"] != "bow" else 30.0)
		var m: Dictionary = MELEE[kit["melee"]]
		var w: Dictionary = RANGED[kit["ranged"]]
		draw_multiline_string(font_b, r.position + Vector2(16, 236), "X · " + m["title"], HORIZONTAL_ALIGNMENT_LEFT, 260, 14, 1, INK)
		draw_multiline_string(font, r.position + Vector2(16, 254), m["about"], HORIZONTAL_ALIGNMENT_LEFT, 260, 12, 2, MUTED)
		draw_multiline_string(font_b, r.position + Vector2(16, 296), "C · " + w["title"], HORIZONTAL_ALIGNMENT_LEFT, 260, 14, 1, INK)
		draw_multiline_string(font, r.position + Vector2(16, 314), w["about"], HORIZONTAL_ALIGNMENT_LEFT, 260, 12, 2, MUTED)
		hot.append([r, k])
	text("Клавиши 1–4 или щелчок мышью", Vector2(640, 600), 16, GOLD, false)

func _draw_rest() -> void:
	draw_rect(Rect2(0, 0, W, H), Color(0.03, 0.05, 0.12, 0.8))
	text("ЭТАП %d ПРОЙДЕН" % (stage + 1), Vector2(640, 110), 40, INK)
	var st := 3 if zone_ok >= 3 else (2 if zone_ok == 2 else 1)
	for i in 3:
		text("★", Vector2(560 + i * 80, 180), 64, GOLD if i < st else Color(1, 1, 1, 0.16), false)
	text("Верных ответов на терминалах: %d из 3." % zone_ok, Vector2(640, 244), 16, MUTED, false)
	text("ВЫБЕРИ МУТАЦИЮ", Vector2(640, 296), 20, Color("7df9ff"))
	for k in choices.size():
		_card(Rect2(170 + k * 320, 330, 300, 170), k, choices[k]["title"], choices[k]["about"], "Клавиша %d" % (k + 1), Color("22b07d"))
	text("Дальше — «Переход»: фонтан, торговец, Коллекционер и выбор пути", Vector2(640, 556), 17, GOLD)

func _draw_shop() -> void:
	draw_rect(Rect2(0, 0, W, H), Color(0.03, 0.05, 0.12, 0.82))
	_spr("n_merchant", 150.0, 330.0, 220.0)
	text("ТОРГОВЕЦ", Vector2(640, 96), 36, INK)
	text("У тебя байтов: %d · клавиши 1–%d · E или Esc — уйти" % [bytes, offers.size()], Vector2(640, 136), 16, GOLD, false)
	for i in offers.size():
		var o: Dictionary = offers[i]
		var can: bool = not o.get("sold", false) and bytes >= o["cost"] and not (o["type"] == "flask" and flasks >= flasks_max)
		var icon: String = "w_" + o["id"] if o["type"] in ["m", "r"] else {"food": "p_food", "flask": "p_flask", "scroll": "p_scroll"}[o["type"]]
		_card(Rect2(290 + (i % 3) * 320, 170 + (i / 3) * 210, 300, 190), i, o["title"], o["about"], "Продано" if o.get("sold", false) else "Цена: %d байтов" % o["cost"], Color("c98a2a"), can, icon)
	var r := Rect2(540, 616, 200, 46)
	rr(r, Color("243253"), 12)
	text("Закрыть", r.get_center(), 18, INK)
	hot.append([r, 99])

func _draw_collector() -> void:
	draw_rect(Rect2(0, 0, W, H), Color(0.03, 0.05, 0.12, 0.85))
	_spr("n_collector", 140.0, 360.0, 260.0)
	text("КОЛЛЕКЦИОНЕР", Vector2(660, 92), 36, INK)
	text("Клеток с собой: %d. Улучшения остаются навсегда — даже если герой падёт." % cells_n, Vector2(660, 132), 16, Color("7df9ff"), false)
	for k in COLLECTOR.size():
		var u: Dictionary = COLLECTOR[k]
		var lvl := _up(u["id"])
		var full: bool = lvl >= u["cost"].size()
		var can: bool = not full and cells_n >= u["cost"][lvl]
		_card(Rect2(300 + (k % 3) * 320, 160 + (k / 3) * 210, 300, 190), k, u["title"], u["about"] + "\nУровень: %d из %d" % [lvl, u["cost"].size()], "Куплено всё" if full else "Цена: %d клеток" % u["cost"][lvl], Color("2f7fd0"), can, "p_cell")
	var r := Rect2(560, 616, 200, 46)
	rr(r, Color("243253"), 12)
	text("Закрыть", r.get_center(), 18, INK)
	hot.append([r, 99])

func _draw_end() -> void:
	draw_rect(Rect2(0, 0, W, H), Color(0.03, 0.05, 0.12, 0.8))
	var r := Rect2(290, 120, 700, 480)
	rr(r, Color("16203a"), 26, GOLD if mode == "win" else Color("a3404f"), 3)
	text("ГЛЮК ПОВЕРЖЕН!" if mode == "win" else "ЗАБЕГ ОКОНЧЕН", Vector2(640, 180), 40, INK)
	text("Память Кодограда восстановлена." if mode == "win" else "Герой пал: этап %d · %s." % [stage + 1, World.BIOMES[biome]["name"]], Vector2(640, 234), 18, MUTED, false)
	text("Байтов: %d · врагов побеждено: %d · свитков: %d" % [bytes, kills, scrolls], Vector2(640, 290), 20, GOLD)
	text("Маршрут: " + " → ".join(visited.map(func(b): return World.BIOMES[b]["name"])), Vector2(640, 326), 15, MUTED, false)
	text("Время забега: %d:%02d" % [int(run_time) / 60, int(run_time) % 60], Vector2(640, 360), 17, MUTED, false)
	var got := 0
	for n in done_stars:
		got += int(done_stars[n])
	text("Звёзд за этапы: %d из 15" % got, Vector2(640, 404), 22, GOLD)
	text("Неотданные Коллекционеру клетки (%d) пропали. Неси их в «Переход» вовремя!" % cells_n if mode == "dead" else "Попробуй другой маршрут и все этапы на три звезды.", Vector2(640, 450), 15, MUTED, false)
	text("ПРОБЕЛ — ПРОДОЛЖИТЬ", Vector2(640, 540), 26, Color(0.37, 0.88, 0.71, 0.75 + 0.25 * sin(time * 4.0)))
