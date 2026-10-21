extends "res://arcade/game.gd"
# «Кодоблокс» — 3D-мир в духе Roblox: главная страница с мирами, блочный герой от третьего лица, обби с чекпоинтами,
# kill-блоками и вращающимися балками, тайкун с дропперами и лентой, симулятор с рюкзаком, другие игроки, чат,
# таблица лидеров и Кодобаксы на облик. Информатика встроена в механику: двери с ответами, стеклянный мост из битов,
# цены в битах/степенях двойки/шестнадцатеричной записи, продажа битов в байтах.
# Физика и карты — в blox/logic.gd (тест tests/blox.gd проходит обби автопилотом).

const L = preload("res://blox/logic.gd")
const EXP := [
	{"id": "obby", "title": "Обби: Башня битов", "thumb": "bx_thumb_obby", "like": 94, "online": "1,2 тыс.", "about": "Прыжки над лавой, двери с ответами, мост из битов."},
	{"id": "tycoon", "title": "Тайкун: Серверная", "thumb": "bx_thumb_tycoon", "like": 91, "online": "860", "about": "Дропперы, лента и апгрейдеры. Цены — в битах и степенях двойки."},
	{"id": "sim", "title": "Симулятор битов", "thumb": "bx_thumb_sim", "like": 89, "online": "2,4 тыс.", "about": "Собирай биты в рюкзак, продавай байты, открывай новые зоны."},
	{"id": "glass", "title": "Обби: Стеклянный мост", "thumb": "bx_thumb_glass", "like": 96, "online": "3,1 тыс.", "about": "Сложное обби: исчезающие блоки, балки и мост из 8 бит."},
]
const SKIN := Color("f5cd30")
const SHIRTS := [Color("2f7fd0"), Color("d64545"), Color("3fae5a"), Color("8a4fd8"), Color("f08a24"), Color("1c1f2a"), Color("f2f2f2"), Color("ff6fae")]
const PANTS := [Color("2b3a67"), Color("3f8a3c"), Color("222222"), Color("7a4a2a"), Color("c0c0c0"), Color("8a1f2f")]
const HATS := ["нет", "Кепка", "Корона", "Наушники", "Цилиндр", "Нимб"]
const SHOP := {"shirt": [0, 0, 15, 15, 20, 25, 30, 40], "pants": [0, 0, 10, 15, 20, 25], "face": [0, 0, 10, 15, 20, 25, 30, 40], "hat": [0, 25, 120, 45, 60, 90]}
const BOT_NAMES := ["Bit_Masha2013", "CyberPetya", "NoobMaster_7", "Байтик", "Glitch_Hunter", "xX_Kod_Xx", "PixelLiza", "Sanya_PRO"]
const CHAT := ["кто знает ответ на двери??", "лол упал", "oof", "gg", "го на мост", "это 1011 же", "ахах лава", "изи", "кто в тайкун?", "я первый!", "подожди меня", "ура чекпоинт"]

var player := ""
var debug_keys := false
var vp: SubViewport
var root3: Node3D
var world3: Node3D
var cam: Camera3D
var mats := {}
var w                          # L.World текущего мира
var tr                         # L.Track (обби)
var exp_id := ""
var vis := {}                  # индекс части → узел
var yaw := PI
var pitch := 0.42
var dist := 12.0
var drag := false
var drag_moved := 0.0
var me: Node3D
var me_parts := {}
var walk_t := 0.0
var face_dir := 0.0
var bots: Array = []
var chat: Array = []
var quiz := {}
var quiz_rects: Array = []
var toast := ""
var toast_t := 0.0
var oof_t := 0.0
var save := {"bux": 0, "own": ["shirt0", "shirt1", "pants0", "pants1", "face0", "face1", "hat0"], "look": {"shirt": 0, "pants": 0, "face": 0, "hat": 0}}
var tab := "home"
var shop_cat := "shirt"
var ui_rects: Array = []       # [Rect2, действие]
var auto := false
var auto_st := {}
var earned := 0
var stage_mist := 0
var faces: Array = []
var thumbs: Array = []
var quality := 2              # 2 — полное, 1 — меньше разрешение, 0 — ещё меньше и без теней
var fps_t := 0.0
var ty := {}
var sim := {}
var cubes: Array = []
var qrng := RandomNumberGenerator.new()

# ---------- основа ----------

func setup() -> void:
	title = "Кодоблокс"
	stages = 4
	unit = ""
	show_lives = false
	for ex in EXP:
		thumbs.append(_tex3(ex["thumb"]))
	for i in 8:
		var pth := "res://assets/bx_face%d.png" % i
		faces.append(load(pth) if ResourceLoader.exists(pth) else null)
	_load_save()
	vp = SubViewport.new()
	vp.size = Vector2i(1280, 720)
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_DISABLED
	vp.scaling_3d_scale = 0.8
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	root3 = Node3D.new()
	vp.add_child(root3)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color("1f6fd6")
	sm.sky_horizon_color = Color("8cc8ff")
	sm.ground_horizon_color = Color("8cc8ff")
	sm.ground_bottom_color = Color("5a6f8a")
	sky.sky_material = sm
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.ambient_light_energy = 0.45
	e.tonemap_white = 1.4
	e.adjustment_enabled = true
	e.adjustment_saturation = 1.25
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	e.fog_enabled = true
	e.fog_light_color = Color("a8d4ff")
	e.fog_density = 0.0012
	env.environment = e
	root3.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, 35, 0)
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 55.0
	sun.name = "sun"
	root3.add_child(sun)
	cam = Camera3D.new()
	cam.fov = 70.0
	cam.far = 400.0
	root3.add_child(cam)

func unlocked() -> int:
	return stages

func preview() -> void:
	# Главная страница: под ней — витрина аватара.
	_clear_world()
	var plat := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 1.6
	cm.bottom_radius = 1.8
	cm.height = 0.4
	plat.mesh = cm
	plat.material_override = _mat("studs")
	plat.position = Vector3(0, -0.2, 0)
	world3.add_child(plat)
	me = _avatar(save["look"], "")
	world3.add_child(me)
	cam.position = Vector3(0, 1.3, 4.2)
	cam.look_at(Vector3(0, 1.0, 0))

func start() -> void:
	super()

func setup_stage() -> void:
	exp_id = EXP[stage - 1]["id"]
	_clear_world()
	qrng.seed = int(Time.get_ticks_usec()) + stage * 977
	quiz = {}
	toast = ""
	chat = []
	cubes = []
	earned = 0
	auto = false
	auto_st = {}
	if exp_id == "obby" or exp_id == "glass":
		tr = L.obby(exp_id, grade, int(Time.get_ticks_usec()) % 100000 + stage)
		w = tr.w
	elif exp_id == "tycoon":
		tr = null
		w = _tycoon_world()
	else:
		tr = null
		w = _sim_world()
	w.pos = w.spawn
	for i in w.parts.size():
		_make_part(i)
	me = _avatar(save["look"], "")
	world3.add_child(me)
	_make_bots()
	yaw = PI
	pitch = 0.42
	dist = 12.0
	_say("Система", "Ты в мире «%s»" % EXP[stage - 1]["title"])

func reset() -> void:
	pass

func stage_stars() -> int:
	return L.stars(stage_mist)

# ---------- материалы и части мира ----------

func _tex3(n: String) -> Texture2D:
	var pth := "res://assets/%s.png" % n
	return load(pth) if ResourceLoader.exists(pth) else null

func _mat(key: String) -> StandardMaterial3D:
	if mats.has(key):
		return mats[key]
	var m := StandardMaterial3D.new()
	m.roughness = 0.75
	var texn := ""
	match key:
		"studs", "spawnbase":
			texn = "bx_studs"
			m.albedo_color = Color("8d97a6")
		"grass":
			texn = "bx_grass"
		"wood":
			texn = "bx_wood"
		"metal":
			texn = "bx_metal"
		"neon":
			texn = "bx_neon"
		"lava":
			texn = "bx_lava"
			m.albedo_color = Color("ff8a4a")
			m.emission_enabled = true
			m.emission = Color("ff4a0a")
			m.emission_energy_multiplier = 0.9
		"killneon":
			m.albedo_color = Color("ff2a2a")
			m.emission_enabled = true
			m.emission = Color("ff2a2a")
			m.emission_energy_multiplier = 1.4
		"check":
			texn = "bx_studs"
			m.albedo_color = Color("4fe07a")
			m.emission_enabled = true
			m.emission = Color("1f9a45")
			m.emission_energy_multiplier = 0.35
		"check_on":
			texn = "bx_studs"
			m.albedo_color = Color("7dff9f")
			m.emission_enabled = true
			m.emission = Color("3dff7a")
			m.emission_energy_multiplier = 0.9
		"gold", "trophy", "coin":
			m.albedo_color = Color("ffcc2e")
			m.metallic = 0.8
			m.roughness = 0.25
			m.emission_enabled = true
			m.emission = Color("ffb000")
			m.emission_energy_multiplier = 0.25
		"glass":
			m.albedo_color = Color(0.7, 0.92, 1.0, 0.45)
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			m.roughness = 0.05
			m.metallic = 0.3
		"vanish":
			m.albedo_color = Color(0.72, 0.45, 1.0, 0.85)
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			m.emission_enabled = true
			m.emission = Color("8a4fff")
			m.emission_energy_multiplier = 0.5
		"wall":
			texn = "bx_studs"
			m.albedo_color = Color("d8dde6")
		"sign":
			m.albedo_color = Color("1a2240")
		"door":
			m.albedo_color = Color(0.1, 0.12, 0.25, 0.82)
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		"spawn":
			m.albedo_color = Color("3d8bff")
			m.emission_enabled = true
			m.emission = Color("3d8bff")
			m.emission_energy_multiplier = 0.4
		"pad":
			m.albedo_color = Color("2fd06a")
			m.emission_enabled = true
			m.emission = Color("2fd06a")
			m.emission_energy_multiplier = 0.6
		"pad_off":
			m.albedo_color = Color("d04a4a")
			m.emission_enabled = true
			m.emission = Color("d04a4a")
			m.emission_energy_multiplier = 0.4
		"belt":
			texn = "bx_metal"
			m.albedo_color = Color("6a7280")
		"orb8", "orb64", "orb1024":
			m.albedo_color = {"orb8": Color("5ff7ff"), "orb64": Color("7dff6a"), "orb1024": Color("ff7ae0")}[key]
			m.emission_enabled = true
			m.emission = m.albedo_color
			m.emission_energy_multiplier = 1.2
		_:
			m.albedo_color = Color("9aa4b5")
	if texn != "":
		var t := _tex3(texn)
		if t:
			m.albedo_texture = t
			m.uv1_triplanar = true
			m.uv1_world_triplanar = true
			var sc := 0.6 if texn == "bx_studs" else 0.35
			m.uv1_scale = Vector3(sc, sc, sc)
			m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	mats[key] = m
	return m

func _plain(c: Color, emit: float = 0.0) -> StandardMaterial3D:
	var k := "c" + c.to_html() + str(emit)
	if mats.has(k):
		return mats[k]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.6
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	mats[k] = m
	return m

func _box(size: Vector3, m: Material, at: Vector3 = Vector3.ZERO, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = m
	mi.position = at
	(parent if parent else world3).add_child(mi)
	return mi

func _label(txt: String, size: int, at: Vector3, parent: Node3D, bill: bool = false, col: Color = Color.WHITE) -> Label3D:
	var lb := Label3D.new()
	lb.text = txt
	lb.font = font_b
	lb.font_size = size
	lb.outline_size = maxi(8, size / 5)
	lb.outline_modulate = Color(0.04, 0.06, 0.14)
	lb.modulate = col
	lb.pixel_size = 0.01
	lb.position = at
	lb.width = 1400.0
	lb.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	if bill:
		lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		lb.no_depth_test = true
	else:
		lb.rotation.y = PI      # смотрит навстречу игроку, идущему по +Z
	parent.add_child(lb)
	return lb

func _clear_world() -> void:
	if world3:
		world3.queue_free()
	world3 = Node3D.new()
	root3.add_child(world3)
	vis = {}
	bots = []
	me = null

func _make_part(i: int) -> void:
	var p: Dictionary = w.parts[i]
	var k: String = p["k"]
	var s: Vector3 = p["s"]
	var node := Node3D.new()
	node.position = p["c"]
	world3.add_child(node)
	vis[i] = node
	match k:
		"coin":
			var mi := MeshInstance3D.new()
			var cy := CylinderMesh.new()
			cy.top_radius = 0.45
			cy.bottom_radius = 0.45
			cy.height = 0.14
			mi.mesh = cy
			mi.material_override = _mat("coin")
			mi.rotation.x = PI / 2
			node.add_child(mi)
		"spin":
			_box(s, _mat("killneon"), Vector3.ZERO, node)
		"door":
			_box(s, _mat("door"), Vector3.ZERO, node)
			var dl := _label(str(p.get("text", "")), 44, Vector3(0, 0.6, -0.12), node, false, Color("ffe066"))
			dl.width = 280.0
		"sign":
			_box(s, _mat("sign"), Vector3.ZERO, node)
			var code: Array = p.get("code", [])
			var txt := str(p.get("text", ""))
			if code.size():
				txt += "\n" + "\n".join(PackedStringArray(code))
			var lb := _label(txt, 56 if code.size() == 0 else 44, Vector3(0, 0, -0.12), node)
			lb.width = s.x * 100.0 - 40.0
		"glass":
			_box(s, _mat("glass"), Vector3.ZERO, node)
			var gl := _label(str(p.get("text", "")), 96, Vector3(0, 0.27, 0), node, false, Color("ffffff"))
			gl.rotation = Vector3(-PI / 2, PI, 0)
			var pl := _label("×%d" % int(p.get("place", 1)), 40, Vector3(0, 0.27, 0.65), node, false, Color("9fe8ff"))
			pl.rotation = Vector3(-PI / 2, PI, 0)
		"trophy":
			pass
		"orb":
			var sp := MeshInstance3D.new()
			var sph := SphereMesh.new()
			sph.radius = 0.5
			sph.height = 1.0
			sp.mesh = sph
			sp.material_override = _mat("orb%d" % int(p["bits"]))
			node.add_child(sp)
			_label(L.cap_text(int(p["bits"])), 36, Vector3(0, 0.9, 0), node, true, Color("e8faff"))
		"pad":
			_box(s, _mat("pad"), Vector3.ZERO, node)
			var plb := _label(str(p.get("text", "")), 44, Vector3(0, 1.8, 0), node, true, Color("ffffff"))
			node.set_meta("label", plb)
		"zone":
			pass
		_:
			var mk: String = p.get("m", "solid")
			if mk == "trophy":
				var cyl := MeshInstance3D.new()
				var cm := CylinderMesh.new()
				cm.top_radius = 0.7
				cm.bottom_radius = 0.3
				cm.height = 1.2
				cyl.mesh = cm
				cyl.material_override = _mat("gold")
				cyl.position = Vector3(0, 0.6, 0)
				node.add_child(cyl)
				_label("ФИНИШ", 90, Vector3(0, 2.4, 0), node, true, Color("ffd34d"))
			else:
				_box(s, _mat(mk), Vector3.ZERO, node)
			if k == "check":
				_label("ЧЕКПОИНТ %d" % int(p.get("n", 0)), 44, Vector3(0, 1.2, 0), node, true, Color("b6ffc8"))
			if k == "finish":
				_label("★ ФИНИШ ★", 80, Vector3(0, 3.2, 0), node, true, Color("ffd34d"))

func _sync_parts() -> void:
	for i in vis:
		var p: Dictionary = w.parts[i]
		var node: Node3D = vis[i]
		var k: String = p["k"]
		match k:
			"mover":
				node.position = p["c"]
			"spin":
				node.rotation.y = -(w.t * float(p.get("w", 2.0)) + float(p.get("ph", 0.0)))
			"vanish":
				node.visible = w.solid(i) or fmod(time * 8.0, 1.0) < 0.5 and fposmod(w.t + float(p.get("ph", 0.0)), float(p.get("per", 3.0))) > float(p.get("per", 3.0)) - 0.4
			"glass":
				node.visible = not p.get("broken", false)
			"coin":
				node.visible = not p.get("got", false)
				node.rotation.y = time * 3.0
				node.position.y = p["c"].y + sin(time * 3.0 + float(i)) * 0.15
			"orb":
				node.visible = not p.get("off", false)
				node.position.y = p["c"].y + sin(time * 2.0 + float(i)) * 0.2
			"check":
				if int(p.get("n", 0)) <= w.check_n:
					var mi = node.get_child(0)
					if mi is MeshInstance3D:
						mi.material_override = _mat("check_on")
			"wall":
				node.visible = not p.get("open", false)

# ---------- аватар ----------

func _avatar(look: Dictionary, nick: String) -> Node3D:
	var a := Node3D.new()
	var body := Node3D.new()
	body.name = "body"
	a.add_child(body)
	var shirt: Color = SHIRTS[int(look.get("shirt", 0)) % SHIRTS.size()]
	var pants: Color = PANTS[int(look.get("pants", 0)) % PANTS.size()]
	var legs := []
	for sx in [-0.2, 0.2]:
		var hip := Node3D.new()
		hip.position = Vector3(sx, 0.75, 0)
		body.add_child(hip)
		_box(Vector3(0.38, 0.75, 0.4), _plain(pants), Vector3(0, -0.375, 0), hip)
		legs.append(hip)
	_box(Vector3(0.8, 0.75, 0.4), _plain(shirt), Vector3(0, 1.125, 0), body)
	var arms := []
	for sx in [-0.6, 0.6]:
		var sh := Node3D.new()
		sh.position = Vector3(sx, 1.45, 0)
		body.add_child(sh)
		_box(Vector3(0.38, 0.72, 0.38), _plain(shirt), Vector3(0, -0.3, 0), sh)
		_box(Vector3(0.38, 0.14, 0.38), _plain(SKIN), Vector3(0, -0.72, 0), sh)
		arms.append(sh)
	var head := _box(Vector3(0.46, 0.46, 0.46), _plain(SKIN), Vector3(0, 1.73, 0), body)
	var fi := int(look.get("face", 0))
	if fi < faces.size() and faces[fi]:
		var fs := Sprite3D.new()
		fs.texture = faces[fi]
		fs.pixel_size = 0.42 / maxf(1.0, float(faces[fi].get_width()))
		fs.position = Vector3(0, 0, 0.235)
		fs.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
		head.add_child(fs)
	_hat(int(look.get("hat", 0)), head)
	if nick != "":
		_label(nick, 34, Vector3(0, 2.35, 0), a, true, Color("ffffff"))
	a.set_meta("legs", legs)
	a.set_meta("arms", arms)
	return a

func _hat(h: int, head: Node3D) -> void:
	match h:
		1:
			_box(Vector3(0.5, 0.14, 0.5), _plain(Color("d64545")), Vector3(0, 0.29, 0), head)
			_box(Vector3(0.46, 0.06, 0.3), _plain(Color("d64545")), Vector3(0, 0.24, 0.35), head)
		2:
			var cr := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 0.3
			cm.bottom_radius = 0.24
			cm.height = 0.24
			cr.mesh = cm
			cr.material_override = _mat("gold")
			cr.position = Vector3(0, 0.36, 0)
			head.add_child(cr)
		3:
			_box(Vector3(0.56, 0.08, 0.12), _plain(Color("222")), Vector3(0, 0.28, 0), head)
			for sx in [-0.28, 0.28]:
				_box(Vector3(0.1, 0.26, 0.26), _plain(Color("ff4fa0"), 0.3), Vector3(sx, 0.02, 0), head)
		4:
			var th := MeshInstance3D.new()
			var tm := CylinderMesh.new()
			tm.top_radius = 0.22
			tm.bottom_radius = 0.22
			tm.height = 0.42
			th.mesh = tm
			th.material_override = _plain(Color("15151a"))
			th.position = Vector3(0, 0.44, 0)
			head.add_child(th)
			_box(Vector3(0.62, 0.04, 0.62), _plain(Color("15151a")), Vector3(0, 0.25, 0), head)
		5:
			var ring := MeshInstance3D.new()
			var to := TorusMesh.new()
			to.inner_radius = 0.2
			to.outer_radius = 0.28
			ring.mesh = to
			ring.material_override = _plain(Color("fff27a"), 1.5)
			ring.position = Vector3(0, 0.48, 0)
			head.add_child(ring)

func _animate(a: Node3D, moving: bool, air: bool, t: float) -> void:
	var sw := sin(t * 11.0) * (0.75 if moving else 0.0)
	var legs: Array = a.get_meta("legs")
	var arms: Array = a.get_meta("arms")
	if air:
		legs[0].rotation.x = -0.35
		legs[1].rotation.x = 0.35
		arms[0].rotation.x = -2.6
		arms[1].rotation.x = -2.6
		return
	legs[0].rotation.x = sw
	legs[1].rotation.x = -sw
	arms[0].rotation.x = -sw
	arms[1].rotation.x = sw

# ---------- боты-игроки ----------

func _make_bots() -> void:
	var names := BOT_NAMES.duplicate()
	KPshuffle(names)
	var n := 5 if exp_id != "tycoon" else 3
	for b in n:
		var look := {"shirt": qrng.randi() % SHIRTS.size(), "pants": qrng.randi() % PANTS.size(), "face": qrng.randi() % 8, "hat": qrng.randi() % HATS.size()}
		var node := _avatar(look, names[b])
		world3.add_child(node)
		var bot := {"name": names[b], "node": node, "i": 0, "pos": w.spawn + Vector3(qrng.randf_range(-6, 6), 0, qrng.randf_range(-4, 4)), "from": Vector3.ZERO, "u": 1.0, "wait": qrng.randf_range(0.5, 4.0), "stage": 0, "speed": qrng.randf_range(5.5, 8.0), "score": 0, "talk": qrng.randf_range(6, 20)}
		bot["from"] = bot["pos"]
		bots.append(bot)

func KPshuffle(a: Array) -> void:
	for i in range(a.size() - 1, 0, -1):
		var j := qrng.randi_range(0, i)
		var t = a[i]
		a[i] = a[j]
		a[j] = t

func _bot_target(b: Dictionary) -> Vector3:
	if tr:
		var i: int = b["i"]
		while i < tr.route.size() and not tr.route[i].has("p"):
			i += 1
		b["i"] = i
		if i >= tr.route.size():
			return b["pos"]
		return tr.route[i]["p"]
	# в тайкуне и симуляторе — бродят по миру (в симуляторе — к шарам)
	if exp_id == "sim":
		var best := -1
		var bd := 1e9
		for j in w.parts.size():
			if w.parts[j]["k"] == "orb" and not w.parts[j].get("off", false) and int(w.parts[j]["zone"]) == 0:
				var d: float = (w.parts[j]["c"] - b["pos"]).length() + qrng.randf() * 8.0
				if d < bd:
					bd = d
					best = j
		if best >= 0:
			b["orb"] = best
			var oc: Vector3 = w.parts[best]["c"]
			return Vector3(oc.x, 0, oc.z)
	return Vector3(qrng.randf_range(-20, 20), 0, qrng.randf_range(-20, 8))

func _bots_tick(dt: float) -> void:
	for b in bots:
		var node: Node3D = b["node"]
		b["talk"] = float(b["talk"]) - dt
		if b["talk"] <= 0.0:
			b["talk"] = qrng.randf_range(12, 30)
			_say(b["name"], CHAT[qrng.randi() % CHAT.size()])
		if b["wait"] > 0.0:
			b["wait"] = float(b["wait"]) - dt
			_animate(node, false, false, time)
		else:
			if b["u"] >= 1.0:
				# выбрать следующую цель
				b["from"] = b["pos"]
				var tgt := _bot_target(b)
				b["to"] = tgt
				var d: float = (tgt - b["pos"]).length()
				b["dur"] = maxf(0.25, d / float(b["speed"]))
				b["u"] = 0.0
				b["hop"] = 1.4 if tr and (absf(tgt.y - b["pos"].y) > 0.2 or d > 3.0) else 0.0
			b["u"] = minf(1.0, float(b["u"]) + dt / float(b["dur"]))
			var u: float = b["u"]
			var pos: Vector3 = (b["from"] as Vector3).lerp(b["to"], u)
			pos.y += sin(u * PI) * float(b["hop"])
			b["pos"] = pos
			var mvd: Vector3 = b["to"] - b["from"]
			if Vector2(mvd.x, mvd.z).length() > 0.05:
				node.rotation.y = atan2(mvd.x, mvd.z)
			_animate(node, true, float(b["hop"]) > 0.0 and u > 0.1 and u < 0.9, time + float(b["speed"]))
			if u >= 1.0:
				if tr:
					var wp: Dictionary = tr.route[int(b["i"])]
					if wp.has("cp"):
						b["stage"] = int(wp["cp"])
					b["i"] = int(b["i"]) + 1
					b["wait"] = qrng.randf_range(0.0, 0.5) if qrng.randf() < 0.7 else qrng.randf_range(1.0, 3.0)
					# иногда бот срывается — «oof» и обратно к чекпоинту
					if qrng.randf() < 0.035 and int(b["i"]) > 2:
						_say(b["name"], ["oof", "НЕЕЕТ", "лол упал"][qrng.randi() % 3])
						var back := 0
						for j in range(int(b["i"]) - 1, -1, -1):
							if tr.route[j].has("cp"):
								back = j
								break
						b["i"] = back
						b["pos"] = tr.route[back]["p"] if tr.route[back].has("p") else w.spawn
					if int(b["i"]) >= tr.route.size():
						_say(b["name"], "ФИНИШ!!! gg")
						b["i"] = 0
						b["stage"] = 0
						b["pos"] = w.spawn
						b["score"] = int(b["score"]) + 1
				else:
					b["wait"] = qrng.randf_range(0.3, 2.5)
					if b.has("orb"):
						var oi: int = b["orb"]
						if (Vector2(w.parts[oi]["c"].x, w.parts[oi]["c"].z) - Vector2(b["pos"].x, b["pos"].z)).length() < 1.0 and not w.parts[oi].get("off", false):
							w.parts[oi]["off"] = true
							w.parts[oi]["back"] = 6.0
							b["score"] = int(b["score"]) + int(w.parts[oi]["bits"])
						b.erase("orb")
		node.position = b["pos"]
		if exp_id == "tycoon":
			b["acc"] = float(b.get("acc", 0.0)) + dt * (3.0 + time * 0.08)
			if b["acc"] >= 1.0:
				b["score"] = int(b["score"]) + int(b["acc"])
				b["acc"] = fmod(float(b["acc"]), 1.0)

# ---------- тайкун ----------

func _tycoon_world():
	var ww = L.World.new()
	ww.add({"p": Vector3(0, -0.5, 10), "s": Vector3(90, 1, 90), "k": "solid", "m": "grass"})
	ww.add({"p": Vector3(0, 0.05, 6), "s": Vector3(26, 0.1, 32), "k": "deco", "m": "studs"})
	ww.add({"p": Vector3(0, 0.1, -14), "s": Vector3(4, 0.2, 4), "k": "deco", "m": "spawn"})
	ww.spawn = Vector3(0, 0, -14)
	# лента и сборщик
	ww.add({"p": Vector3(0, 0.3, 16), "s": Vector3(18, 0.6, 2.2), "k": "solid", "m": "belt"})
	ww.add({"p": Vector3(10.2, 1.0, 16), "s": Vector3(2.4, 2.0, 3.0), "k": "solid", "m": "neon"})
	ty = {"cash": 0, "owned": {}, "claimed": false, "pads": {}, "spawn_t": {}, "known": {}, "speed": 2.2, "bonus_t": 0.0, "lock": 0.0}
	var claim := ww.add({"p": Vector3(0, 0.15, -4), "s": Vector3(4, 0.3, 4), "k": "pad", "m": "pad", "text": "Занять участок", "id": "claim"})
	ty["pads"]["claim"] = claim
	ww.add({"p": Vector3(-10, 0.15, 2), "s": Vector3(3, 0.3, 3), "k": "pad", "m": "pad", "text": "Квиз-терминал: бонус", "id": "bonus"})
	# соседние участки ботов — для вида
	for sx in [-34.0, 34.0]:
		ww.add({"p": Vector3(sx, 0.05, 6), "s": Vector3(22, 0.1, 28), "k": "deco", "m": "studs"})
		ww.add({"p": Vector3(sx, 0.3, 14), "s": Vector3(14, 0.6, 2.2), "k": "solid", "m": "belt"})
		ww.add({"p": Vector3(sx - 4, 3.2, 14), "s": Vector3(1.6, 1.6, 1.6), "k": "deco", "m": "metal"})
		ww.add({"p": Vector3(sx + 6, 3.0, 22), "s": Vector3(4, 6, 4), "k": "deco", "m": "neon"})
	return ww

func _ty_buttons() -> void:
	# Кнопки, у которых куплено всё необходимое, появляются на полу участка.
	var k := 0
	for it in L.TYCOON:
		var id: String = it["id"]
		if ty["owned"].has(id) or ty["pads"].has(id):
			continue
		if it["needs"] != "" and not ty["owned"].has(it["needs"]):
			continue
		if it["needs"] == "" and not ty["claimed"]:
			continue
		var slot: int = ty["pads"].size() + k
		var at := Vector3(-8 + (slot % 5) * 4.0, 0.15, 4 + (slot / 5) * 4.5)
		var label := L.price_text(int(it["price"]), grade, qrng)
		var i: int = w.add({"p": at, "s": Vector3(3, 0.3, 3), "k": "pad", "m": "pad", "text": "%s\n%s" % [it["name"], label], "id": id, "price": int(it["price"]), "plabel": label})
		ty["pads"][id] = i
		_make_part(i)
		k += 1

func _ty_buy(id: String) -> void:
	ty["owned"][id] = true
	var i: int = ty["pads"][id]
	w.parts[i]["off"] = true
	vis[i].visible = false
	match id:
		"drop2", "drop3", "drop4":
			pass
		"fast":
			ty["speed"] = 3.4
		"walls":
			for seg in [[Vector3(0, 2, 22.5), Vector3(26, 4, 0.6)], [Vector3(-13, 2, 6), Vector3(0.6, 4, 33)], [Vector3(13, 2, 6), Vector3(0.6, 4, 33)]]:
				var wi: int = w.add({"p": seg[0], "s": seg[1], "k": "solid", "m": "wall"})
				_make_part(wi)
		"super":
			var si: int = w.add({"p": Vector3(0, 4.5, 26), "s": Vector3(6, 9, 4), "k": "solid", "m": "neon"})
			_make_part(si)
	_ty_decor()
	_ty_buttons()
	sfx.emit("win")
	_say("Система", "Куплено: %s" % _ty_name(id))
	if id == "super":
		_win_soon()

func _ty_name(id: String) -> String:
	for it in L.TYCOON:
		if it["id"] == id:
			return it["name"]
	return id

func _ty_decor() -> void:
	# Дропперы над лентой и рамки апгрейдеров (рисуем заново по купленному).
	if world3.has_node("tydecor"):
		world3.get_node("tydecor").queue_free()
	var d := Node3D.new()
	d.name = "tydecor"
	world3.add_child(d)
	for x in _droppers():
		_box(Vector3(1.6, 1.6, 1.6), _mat("metal"), Vector3(x[0], 3.3, 16), d)
		_box(Vector3(0.6, 1.2, 0.6), _mat("neon"), Vector3(x[0], 2.2, 16), d)
		_label("%d байт" % int(x[1]), 34, Vector3(x[0], 4.6, 16), d, true, Color("9fe8ff"))
	for up in [["shl", 4.5, "<<1"], ["add8", 6.0, "+0b1000"], ["shl2", 7.5, "<<1"]]:
		if ty["owned"].has(up[0]):
			_box(Vector3(0.3, 2.4, 2.6), _mat("killneon"), Vector3(up[1], 1.5, 16), d)
			_label(up[2], 40, Vector3(up[1], 3.2, 16), d, true, Color("ffb0b0"))

func _droppers() -> Array:
	var out := []
	if ty["claimed"]:
		out.append([-7.5, 4])
	if ty["owned"].has("drop2"):
		out.append([-5.5, 4])
	if ty["owned"].has("drop3"):
		out.append([-3.5, 8])
	if ty["owned"].has("drop4"):
		out.append([-1.5, 16])
	return out

func _ty_tick(dt: float) -> void:
	ty["lock"] = maxf(0.0, float(ty["lock"]) - dt)
	ty["bonus_t"] = maxf(0.0, float(ty["bonus_t"]) - dt)
	for dr in _droppers():
		var key := str(dr[0])
		ty["spawn_t"][key] = float(ty["spawn_t"].get(key, 0.0)) - dt
		if ty["spawn_t"][key] <= 0.0:
			ty["spawn_t"][key] = 1.25
			var cube := _box(Vector3(0.55, 0.55, 0.55), _plain(Color("5ff7ff"), 0.8), Vector3(dr[0], 1.6, 16), world3)
			var lb := _label(String.num_int64(int(dr[1]), 2), 30, Vector3(0, 0.6, 0), cube, true, Color("ffffff"))
			cubes.append({"node": cube, "x": float(dr[0]), "v": int(dr[1]), "lb": lb, "done": {}})
	for c in cubes.duplicate():
		var ox: float = c["x"]
		c["x"] = ox + float(ty["speed"]) * dt
		for up in [["shl", 4.5], ["add8", 6.0], ["shl2", 7.5]]:
			if ox < up[1] and c["x"] >= up[1] and ty["owned"].has(up[0]):
				c["v"] = int(c["v"]) << 1 if up[0] != "add8" else int(c["v"]) + 8
				(c["lb"] as Label3D).text = String.num_int64(int(c["v"]), 2)
		(c["node"] as Node3D).position = Vector3(c["x"], 0.9, 16)
		if c["x"] >= 9.2:
			ty["cash"] = int(ty["cash"]) + int(c["v"])
			(c["node"] as Node3D).queue_free()
			cubes.erase(c)

func _ty_pad(i: int) -> void:
	var p: Dictionary = w.parts[i]
	var id: String = p.get("id", "")
	if id == "claim":
		ty["claimed"] = true
		p["off"] = true
		vis[i].visible = false
		_say("Система", "Участок твой! Дроппер уже работает. Кубики едут по ленте в сборщик.")
		_ty_decor()
		_ty_buttons()
		return
	if id == "bonus":
		if ty["bonus_t"] > 0.0:
			_toast("Терминал перезаряжается: %d с" % int(ty["bonus_t"]))
			return
		_ask(L.question(grade, qrng, 3), func(ok: bool):
			if ok:
				var gain: int = 16 * (1 + ty["owned"].size())
				ty["cash"] = int(ty["cash"]) + gain
				_toast("Верно! +%d байт" % gain)
			ty["bonus_t"] = 20.0)
		return
	if ty["lock"] > 0.0:
		return
	var price: int = p["price"]
	if ty["known"].has(id):
		if int(ty["cash"]) >= price:
			ty["cash"] = int(ty["cash"]) - price
			_ty_buy(id)
		else:
			_toast("Не хватает: нужно %d байт, у тебя %d" % [price, int(ty["cash"])])
		return
	_ask(L.price_quiz(price, str(p["plabel"]), qrng), func(ok: bool):
		if not ok:
			ty["lock"] = 3.0
			_toast("Касса не поняла цену. Посчитай ещё раз!")
			return
		ty["known"][id] = true
		var lb = vis[i].get_meta("label")
		if lb:
			lb.text = "%s\n%s = %d байт" % [_ty_name(id), p["plabel"], price]
		if int(ty["cash"]) >= price:
			ty["cash"] = int(ty["cash"]) - price
			_ty_buy(id)
		else:
			_toast("Верно! Но не хватает: нужно %d байт, у тебя %d" % [price, int(ty["cash"])]))

# ---------- симулятор ----------

func _sim_world():
	var ww = L.World.new()
	ww.add({"p": Vector3(0, -0.5, 30), "s": Vector3(70, 1, 110), "k": "solid", "m": "grass"})
	ww.add({"p": Vector3(0, 0.1, -12), "s": Vector3(4, 0.2, 4), "k": "deco", "m": "spawn"})
	ww.spawn = Vector3(0, 0, -12)
	sim = {"bag": 0, "coins": 0, "pack": 0, "lock": 0.0}
	ww.add({"p": Vector3(-6, 0.15, -6), "s": Vector3(4, 0.3, 4), "k": "pad", "m": "pad", "text": "ПРОДАТЬ биты", "id": "sell"})
	for j in range(1, L.PACKS.size()):
		var pk: Dictionary = L.PACKS[j]
		ww.add({"p": Vector3(4 + (j - 1) * 4.5, 0.15, -6), "s": Vector3(3.4, 0.3, 3.4), "k": "pad", "m": "pad", "text": "%s\n%s · %d монет" % [pk["name"], L.cap_text(int(pk["cap"])), int(pk["price"])], "id": "pack%d" % j})
	# зоны с шарами; между зонами — стены, которые открывает вместительный рюкзак
	for z in L.ZONES.size():
		var zc := 12.0 + z * 34.0
		for k in 14:
			ww.add({"p": Vector3(randf_range(-26, 26), 1.0, zc + randf_range(-12, 12)), "s": Vector3(1.0, 1.0, 1.0), "k": "orb", "bits": int(L.ZONES[z]["bits"]), "zone": z})
		if z > 0:
			var need: int = L.ZONES[z]["need"]
			ww.add({"p": Vector3(0, 3, zc - 16.5), "s": Vector3(70, 6, 1), "k": "wall", "m": "vanish", "need": need})
			ww.add({"p": Vector3(0, 7.5, zc - 16.8), "s": Vector3(16, 2.4, 0.2), "k": "sign", "m": "sign", "text": "Зона %d: нужен рюкзак от %s" % [z + 1, L.cap_text(need)]})
	return ww

func _sim_tick(dt: float) -> void:
	sim["lock"] = maxf(0.0, float(sim["lock"]) - dt)
	var cap: int = L.PACKS[int(sim["pack"])]["cap"]
	for i in w.parts.size():
		var p: Dictionary = w.parts[i]
		if p["k"] == "orb" and p.get("off", false):
			p["back"] = float(p.get("back", 6.0)) - dt
			if p["back"] <= 0.0:
				p["off"] = false
		if p["k"] == "wall" and not p.get("open", false) and cap >= int(p.get("need", 0)):
			p["open"] = true
			_say("Система", "Открыта новая зона!")

func _sim_event(i: int) -> void:
	var p: Dictionary = w.parts[i]
	var cap: int = L.PACKS[int(sim["pack"])]["cap"]
	if p["k"] == "orb":
		var b: int = p["bits"]
		if int(sim["bag"]) + b > cap:
			_toast("Рюкзак полон (%s)! Неси биты на продажу." % L.cap_text(cap))
			return
		sim["bag"] = int(sim["bag"]) + b
		p["off"] = true
		p["back"] = 6.0
		sfx.emit("take")
		return
	var id: String = p.get("id", "")
	if id == "sell":
		var bag: int = sim["bag"]
		if bag < 8:
			_toast("Рюкзак пуст. Собирай светящиеся шары!")
			return
		_ask(L.sell_quiz(bag, qrng), func(ok: bool):
			var by: int = bag / 8
			var gain: int = by * (2 if ok else 1)
			sim["coins"] = int(sim["coins"]) + gain
			sim["bag"] = 0
			_toast(("Верно! Двойная цена: +%d монет" if ok else "Неверно — обычная цена: +%d монет") % gain))
		return
	if id.begins_with("pack"):
		var j := int(id.substr(4))
		var pk: Dictionary = L.PACKS[j]
		if int(sim["pack"]) >= j:
			_toast("Этот рюкзак уже есть.")
			return
		if int(sim["coins"]) < int(pk["price"]):
			_toast("Нужно %d монет, у тебя %d." % [int(pk["price"]), int(sim["coins"])])
			return
		sim["coins"] = int(sim["coins"]) - int(pk["price"])
		sim["pack"] = j
		sfx.emit("win")
		_say("Система", "Новый рюкзак: %s (%s)" % [pk["name"], L.cap_text(int(pk["cap"]))])
		if j == L.PACKS.size() - 1:
			_win_soon()

# ---------- ход игры ----------

func _win_soon() -> void:
	_toast("МИР ПРОЙДЕН!")
	burst(Vector2(640, 300), GOLD, 60, 600.0, "p_star", 36.0)
	after_t = 1.6

var after_t := -1.0

func tick(delta: float) -> void:
	var dt := minf(delta, 1.0 / 30.0)
	toast_t = maxf(0.0, toast_t - dt)
	oof_t = maxf(0.0, oof_t - dt)
	if after_t > 0.0:
		after_t -= dt
		if after_t <= 0.0:
			_finish_exp()
			return
	var mv := Vector2.ZERO
	var jump := false
	if quiz.is_empty():
		if auto and tr:
			var r: Array = L.autopilot(tr, auto_st)
			mv = r[0]
			jump = r[1]
		else:
			var f := (1.0 if _kd(KEY_W) or _kd(KEY_UP) else 0.0) - (1.0 if _kd(KEY_S) or _kd(KEY_DOWN) else 0.0)
			var s := (1.0 if _kd(KEY_D) or _kd(KEY_RIGHT) else 0.0) - (1.0 if _kd(KEY_A) or _kd(KEY_LEFT) else 0.0)
			var fwd := Vector2(-sin(yaw), -cos(yaw))
			var right := Vector2(-fwd.y, fwd.x)
			mv = (fwd * f + right * s).limit_length(1.0)
			jump = _kd(KEY_SPACE)
		if _kd(KEY_Q):
			yaw += dt * 2.2
		if _kd(KEY_E):
			yaw -= dt * 2.2
	for e in w.step(dt, mv, jump):
		_event(e)
	if exp_id == "tycoon":
		_ty_tick(dt)
	elif exp_id == "sim":
		_sim_tick(dt)
	_bots_tick(dt)
	_sync_parts()
	# герой
	me.position = w.pos
	if mv.length() > 0.05:
		face_dir = lerp_angle(face_dir, atan2(mv.x, mv.y), minf(1.0, dt * 14.0))
	me.rotation.y = face_dir
	_animate(me, mv.length() > 0.05, not w.on_floor, time)
	# камера
	var tgt: Vector3 = w.pos + Vector3(0, 1.6, 0)
	var off := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist
	off *= _cam_clip(tgt, tgt + off)
	cam.position = cam.position.lerp(tgt + off, minf(1.0, dt * 12.0)) if cam.position.distance_to(tgt + off) < 30.0 else tgt + off
	cam.look_at(tgt)

func _cam_clip(from: Vector3, to: Vector3) -> float:
	# Камера не заходит в стены и таблички: ищем первую преграду между героем и камерой.
	for n in range(1, 31):
		var u := n / 30.0
		var pt := from.lerp(to, u)
		for i in w.parts.size():
			var p: Dictionary = w.parts[i]
			var k: String = p["k"]
			if not (w.solid(i) or k == "sign" or k == "door"):
				continue
			var c: Vector3 = p["c"]
			var h: Vector3 = p["s"] / 2.0 + Vector3(0.25, 0.25, 0.25)
			if absf(pt.x - c.x) < h.x and absf(pt.y - c.y) < h.y and absf(pt.z - c.z) < h.z:
				return maxf(0.12, (n - 1) / 30.0)
	return 1.0

func _kd(k: int) -> bool:
	return Input.is_physical_key_pressed(k)

func _event(e: Dictionary) -> void:
	match str(e["e"]):
		"die":
			oof_t = 1.0
			stage_mist += 1
			sfx.emit("error")
			_say("Ты", "oof")
			if auto_st.size():
				# автопилот возвращается к пути от чекпоинта
				var back := 0
				for j in tr.route.size():
					if tr.route[j].get("cp", 0) == w.check_n and w.check_n > 0:
						back = j
				auto_st["i"] = back
		"glass":
			sfx.emit("error")
			_toast("Дзынь! Неверный бит — плитка лопнула.")
		"check":
			sfx.emit("deliver")
			_toast("Чекпоинт %d!" % int(e["n"]))
		"coin":
			sfx.emit("take")
			earned += 5
		"finish":
			_win_soon()
		"pad":
			if exp_id == "tycoon":
				_ty_pad(int(e["i"]))
			elif exp_id == "sim":
				_sim_event(int(e["i"]))
		"orb":
			_sim_event(int(e["i"]))
		"jump":
			sfx.emit("step")

func _finish_exp() -> void:
	if exp_id == "obby" or exp_id == "glass":
		stage_mist = w.deaths + w.wrong
	earned += {"obby": 40, "tycoon": 60, "sim": 60, "glass": 80}[exp_id]
	save["bux"] = int(save["bux"]) + earned
	_save_now()
	stage_won()

func _ask(q: Dictionary, cb: Callable) -> void:
	quiz = q.duplicate()
	quiz["cb"] = cb
	sfx.emit("click")

func _answer(j: int) -> void:
	if quiz.is_empty() or j < 0 or j >= (quiz["opts"] as Array).size():
		return
	var ok: bool = j == int(quiz["right"])
	if not ok:
		stage_mist += 1
	var cb: Callable = quiz["cb"]
	quiz = {}
	sfx.emit("win" if ok else "error")
	cb.call(ok)

func _toast(s: String) -> void:
	toast = s
	toast_t = 3.0

func _say(who: String, s: String) -> void:
	# Длинное сообщение — на несколько строк (продолжение без имени).
	var first := true
	for part in _wrap(s, maxi(16, 44 - who.length())):
		chat.append([who if first else "", part])
		first = false
	while chat.size() > 7:
		chat.pop_front()

# ---------- ввод ----------

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var k: int = event.physical_keycode
		if state == "play":
			if k == KEY_ESCAPE:
				_home()
			elif not quiz.is_empty() and k >= KEY_1 and k <= KEY_4:
				_answer(k - KEY_1)
			elif debug_keys and k == KEY_F2 and tr:
				auto = not auto
				auto_st = {"i": 0}
				# с ближайшей точки пути
				var bd := 1e9
				for j in tr.route.size():
					if tr.route[j].has("p"):
						var d: float = (tr.route[j]["p"] - w.pos).length()
						if d < bd:
							bd = d
							auto_st["i"] = j
		elif k == KEY_ESCAPE:
			if state == "over" or tab != "home":
				_home()
			else:
				leave.emit()
		get_viewport().set_input_as_handled()
		return
	if event is InputEventMouseButton:
		var p: Vector2 = get_global_transform().affine_inverse() * event.position
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			dist = maxf(4.0, dist - 1.0)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			dist = minf(26.0, dist + 1.0)
		elif event.button_index == MOUSE_BUTTON_LEFT or event.button_index == MOUSE_BUTTON_RIGHT:
			if event.pressed:
				if not _click(p):
					drag = true
					drag_moved = 0.0
			else:
				drag = false
		get_viewport().set_input_as_handled()
		return
	if event is InputEventMouseMotion and drag and state == "play":
		yaw -= event.relative.x * 0.007
		pitch = clampf(pitch + event.relative.y * 0.005, -0.15, 1.2)
		get_viewport().set_input_as_handled()

func _click(p: Vector2) -> bool:
	if state == "play":
		if Rect2(16, 12, 150, 40).has_point(p):
			_home()
			return true
		for j in quiz_rects.size():
			if quiz_rects[j].has_point(p):
				_answer(j)
				return true
		return not quiz.is_empty()
	for r in ui_rects:
		if (r[0] as Rect2).has_point(p):
			_ui(r[1])
			return true
	return true

func _home() -> void:
	state = "intro"
	quiz = {}
	tab = "home"
	preview()

func _continue() -> void:
	_home()

func _ui(act: String) -> void:
	sfx.emit("click")
	if act == "leave":
		leave.emit()
	elif act.begins_with("tab:"):
		tab = act.substr(4)
		if tab == "avatar":
			preview()
	elif act.begins_with("play:"):
		stage = int(act.substr(5))
		stage_mist = 0
		start()
	elif act.begins_with("cat:"):
		shop_cat = act.substr(4)
	elif act.begins_with("item:"):
		var j := int(act.substr(5))
		var key := shop_cat + str(j)
		if not (key in save["own"]):
			var price: int = SHOP[shop_cat][j]
			if int(save["bux"]) < price:
				_toast("Нужно %d Кодобаксов" % price)
				return
			save["bux"] = int(save["bux"]) - price
			save["own"].append(key)
		save["look"][shop_cat] = j
		_save_now()
		preview()
	elif act == "home":
		_home()

# ---------- сохранение ----------

func _load_save() -> void:
	if not OS.has_feature("web"):
		return
	var raw = JavaScriptBridge.eval("(function(){try{return localStorage.getItem('school4-blox-v1-%s')||''}catch(e){return ''}})()" % player.json_escape())
	var d = JSON.parse_string(str(raw)) if raw != null and str(raw) != "" else null
	if d is Dictionary and d.get("look") is Dictionary and d.get("own") is Array:
		save = d

func _save_now() -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("try{localStorage.setItem('school4-blox-v1-%s',%s)}catch(e){}" % [player.json_escape(), JSON.stringify(JSON.stringify(save))])

# ---------- рисование ----------

func draw_game() -> void:
	if state == "play":
		draw_texture_rect(vp.get_texture(), Rect2(0, 0, W, H), false)
	else:
		backdrop(Color("0f1426"), Color("191f33"))

func _hud() -> void:
	if state != "play":
		return
	rr(Rect2(16, 12, 150, 40), Color(0.08, 0.09, 0.12, 0.72), 10)
	text("≡  Меню", Vector2(91, 31), 17, INK, false)
	# чат
	var cy := 70.0
	rr(Rect2(16, 62, 420, 24 + chat.size() * 22), Color(0, 0, 0, 0.32), 10)
	for c in chat:
		var who: String = c[0]
		var col := Color("ffd34d") if who == "Система" else (Color("7dffb0") if who == "Ты" else Color("9fd0ff"))
		if who != "":
			draw_string(font_b, Vector2(28, cy + 16), who + ":", HORIZONTAL_ALIGNMENT_LEFT, 150, 15, col)
		draw_string(font, Vector2(30 + font_b.get_string_size(who + ":", HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x + 6, cy + 16), c[1], HORIZONTAL_ALIGNMENT_LEFT, 400 - font_b.get_string_size(who + ":", HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x - 30, 15, Color.WHITE)
		cy += 22.0
	# таблица лидеров
	var rows := [["Ты", _my_score()]]
	for b in bots:
		rows.append([b["name"], _bot_score(b)])
	var lx := 1030.0
	rr(Rect2(lx, 12, 234, 34 + rows.size() * 24), Color(0, 0, 0, 0.38), 10)
	draw_string(font_b, Vector2(lx + 12, 34), "Игроки", HORIZONTAL_ALIGNMENT_LEFT, 120, 15, MUTED)
	draw_string(font_b, Vector2(lx + 124, 34), _score_title(), HORIZONTAL_ALIGNMENT_RIGHT, 98, 15, MUTED)
	for r in rows.size():
		var y := 60.0 + r * 24.0
		draw_string(font_b if r == 0 else font, Vector2(lx + 12, y), str(rows[r][0]), HORIZONTAL_ALIGNMENT_LEFT, 140, 15, Color("7dffb0") if r == 0 else Color.WHITE)
		draw_string(font_b, Vector2(lx + 124, y), str(rows[r][1]), HORIZONTAL_ALIGNMENT_RIGHT, 98, 15, GOLD)
	# низ: состояние мира
	var line := ""
	match exp_id:
		"obby", "glass":
			line = "Этап %d / %d   ·   Падений: %d   ·   Кодобаксы: +%d" % [w.check_n, tr.checks, w.deaths + w.wrong, earned + w.coins * 5]
		"tycoon":
			line = "💾  %d байт   ·   куплено %d / %d" % [int(ty["cash"]), ty["owned"].size(), L.TYCOON.size()]
		"sim":
			var cap: int = L.PACKS[int(sim["pack"])]["cap"]
			line = "Рюкзак: %d / %d бит   ·   Монеты: %d   ·   %s" % [int(sim["bag"]), cap, int(sim["coins"]), L.PACKS[int(sim["pack"])]["name"]]
	rr(Rect2(340, 668, 600, 38), Color(0, 0, 0, 0.45), 12)
	text(line, Vector2(640, 687), 18, Color.WHITE)
	text("WASD — ход · Пробел — прыжок · зажми мышь — камера · колесо — ближе/дальше · Esc — меню", Vector2(640, 652), 13, Color(1, 1, 1, 0.75), false)
	if toast_t > 0.0:
		var a := minf(1.0, toast_t * 2.0)
		text(toast, Vector2(640, 130), 30, Color(1, 0.95, 0.6, a))
	if oof_t > 0.0:
		text("OOF!", Vector2(640, 300), 80, Color(1, 0.3, 0.3, oof_t))
	if auto:
		text("АВТОПИЛОТ (F2)", Vector2(640, 96), 16, Color("7df9ff"))
	if not quiz.is_empty():
		_draw_quiz()

func _my_score() -> String:
	match exp_id:
		"tycoon":
			return str(int(ty["cash"]))
		"sim":
			return str(int(sim["coins"]))
	return str(w.check_n)

func _bot_score(b: Dictionary) -> String:
	if exp_id == "obby" or exp_id == "glass":
		return str(int(b["stage"]))
	return str(int(b["score"]))

func _score_title() -> String:
	return {"obby": "Этап", "glass": "Этап", "tycoon": "Байты", "sim": "Монеты"}[exp_id]

func _draw_quiz() -> void:
	draw_rect(Rect2(0, 0, W, H), Color(0.02, 0.03, 0.08, 0.55))
	var opts: Array = quiz["opts"]
	var code: Array = quiz.get("code", [])
	var h := 200.0 + code.size() * 26.0 + opts.size() * 58.0
	var r := Rect2(340, 360 - h / 2.0, 600, h)
	rr(r, Color("16203a"), 20, GOLD, 3)
	var y := r.position.y + 50.0
	for part in _wrap(str(quiz["q"]), 46):
		text(part, Vector2(640, y), 22, INK)
		y += 30.0
	for ln in code:
		draw_string(font_b, Vector2(400, y + 8), str(ln), HORIZONTAL_ALIGNMENT_LEFT, 480, 19, Color("7df9ff"))
		y += 26.0
	y += 14.0
	quiz_rects = []
	for j in opts.size():
		var b := Rect2(400, y, 480, 48)
		quiz_rects.append(b)
		var hov := b.has_point(get_local_mouse_position())
		rr(b, Color("2a3a66") if hov else Color("223056"), 12, Color("4b5f8f"), 2)
		text("%d)  %s" % [j + 1, opts[j]], b.get_center(), 20, INK)
		y += 58.0

func _wrap(s: String, width: int) -> Array:
	var out := []
	var line := ""
	for wd in s.split(" "):
		if line.length() + wd.length() + 1 > width and line != "":
			out.append(line)
			line = wd
		else:
			line = wd if line == "" else line + " " + wd
	if line != "":
		out.append(line)
	return out

func _overlay() -> void:
	ui_rects = []
	if state == "over":
		draw_texture_rect(vp.get_texture(), Rect2(0, 0, W, H), false, Color(1, 1, 1, 0.5))
		draw_rect(Rect2(0, 0, W, H), Color(0.03, 0.05, 0.12, 0.6))
		var r := Rect2(340, 150, 600, 420)
		rr(r, Color("16203a"), 26, GOLD, 3)
		text("МИР ПРОЙДЕН!", Vector2(640, 210), 40, INK)
		text(EXP[stage - 1]["title"], Vector2(640, 256), 20, MUTED)
		var st := stage_stars()
		for i in 3:
			text("★", Vector2(550 + i * 90, 330), 70, GOLD if i < st else Color(1, 1, 1, 0.16), false)
		text("Ошибок и падений: %d   ·   +%d Кодобаксов" % [stage_mist, earned], Vector2(640, 410), 20, INK)
		var b := Rect2(500, 470, 280, 56)
		rr(b, Color("2fae5f"), 14)
		text("На главную", b.get_center(), 22, Color.WHITE)
		ui_rects.append([b, "home"])
		return
	# Главная страница в духе Roblox.
	rr(Rect2(0, 0, 220, H), Color("0b0f1c"), 0)
	text("КОДОБЛОКС", Vector2(110, 40), 26, Color.WHITE)
	var nav := [["home", "⌂  Главная"], ["avatar", "☺  Аватар"]]
	for j in nav.size():
		var b := Rect2(14, 90 + j * 54, 192, 44)
		rr(b, Color("26314f") if tab == nav[j][0] else Color(0, 0, 0, 0), 10)
		draw_string(font_b, b.position + Vector2(16, 29), nav[j][1], HORIZONTAL_ALIGNMENT_LEFT, 170, 18, Color.WHITE)
		ui_rects.append([b, "tab:" + nav[j][0]])
	var lb := Rect2(14, H - 64, 192, 44)
	rr(lb, Color("3a1f2a"), 10)
	text("← К играм (Esc)", lb.get_center(), 16, Color.WHITE)
	ui_rects.append([lb, "leave"])
	rr(Rect2(980, 18, 280, 44), Color("1c2440"), 12)
	text("Кодобаксы:  %d" % int(save["bux"]), Vector2(1120, 40), 20, Color("7dffb0"))
	if tab == "home":
		text("Популярное", Vector2(330, 48), 28, Color.WHITE)
		for j in EXP.size():
			var ex: Dictionary = EXP[j]
			var c := Rect2(250 + j * 255, 90, 240, 330)
			var hov := c.has_point(get_local_mouse_position())
			rr(c.grow(3 if hov else 0), Color("1c2440"), 14, Color("4fc3ff") if hov else Color(0, 0, 0, 0), 2)
			var th: Texture2D = thumbs[j]
			if th:
				draw_texture_rect(th, Rect2(c.position + Vector2(8, 8), Vector2(224, 224)), false)
			draw_string(font_b, c.position + Vector2(10, 256), ex["title"], HORIZONTAL_ALIGNMENT_LEFT, 224, 16, Color.WHITE)
			draw_string(font, c.position + Vector2(10, 280), "♥ %d%%   ·   играют %s" % [int(ex["like"]), ex["online"]], HORIZONTAL_ALIGNMENT_LEFT, 224, 14, MUTED)
			var st: int = int(done_stars.get(j + 1, 0))
			draw_string(font_b, c.position + Vector2(10, 312), "★".repeat(st) + "☆".repeat(3 - st), HORIZONTAL_ALIGNMENT_LEFT, 224, 18, GOLD)
			ui_rects.append([c, "play:%d" % (j + 1)])
		var y := 460.0
		for ln in ["Выбери мир — нажми на карточку. В мире: WASD — ход, пробел — прыжок, мышь — камера.",
				"Двери, мосты и кнопки работают на информатике: двоичный код, биты и байты, логика, программы.",
				"Кодобаксы за пройденные миры трать на облик во вкладке «Аватар». Рядом бегают другие игроки — догоняй!"]:
			for part in _wrap(ln, 100):
				draw_string(font, Vector2(250, y), part, HORIZONTAL_ALIGNMENT_LEFT, 1010, 17, INK)
				y += 26.0
			y += 8.0
		if toast_t > 0.0:
			text(toast, Vector2(740, 640), 22, Color(1, 0.9, 0.5))
		return
	# Аватар: витрина и магазин.
	draw_texture_rect_region(vp.get_texture(), Rect2(240, 80, 380, 560), Rect2(450, 40, 380, 560))
	_ava_spin()
	var cats := [["shirt", "Футболки"], ["pants", "Штаны"], ["face", "Лица"], ["hat", "Шапки"]]
	for j in cats.size():
		var b := Rect2(650 + j * 150, 84, 140, 40)
		rr(b, Color("2f7fd0") if shop_cat == cats[j][0] else Color("1c2440"), 10)
		text(cats[j][1], b.get_center(), 16, Color.WHITE)
		ui_rects.append([b, "cat:" + cats[j][0]])
	var prices: Array = SHOP[shop_cat]
	for j in prices.size():
		var b := Rect2(650 + (j % 4) * 150, 140 + (j / 4) * 160, 140, 150)
		var key := shop_cat + str(j)
		var own: bool = key in save["own"]
		var on: bool = int(save["look"][shop_cat]) == j
		rr(b, Color("1c2440"), 12, GOLD if on else Color(1, 1, 1, 0.08), 3 if on else 1)
		var ic := b.position + Vector2(70, 58)
		match shop_cat:
			"shirt":
				rr(Rect2(ic - Vector2(32, 30), Vector2(64, 60)), SHIRTS[j], 8)
			"pants":
				rr(Rect2(ic - Vector2(26, 34), Vector2(24, 68)), PANTS[j], 6)
				rr(Rect2(ic + Vector2(2, -34), Vector2(24, 68)), PANTS[j], 6)
			"face":
				rr(Rect2(ic - Vector2(34, 34), Vector2(68, 68)), SKIN, 8)
				if j < faces.size() and faces[j]:
					draw_texture_rect(faces[j], Rect2(ic - Vector2(32, 32), Vector2(64, 64)), false)
			"hat":
				draw_string(font_b, b.position + Vector2(0, 70), HATS[j], HORIZONTAL_ALIGNMENT_CENTER, 140, 18, Color.WHITE)
		var tag := "надето" if on else ("есть" if own else ("бесплатно" if prices[j] == 0 else "%d КБ" % prices[j]))
		text(tag, b.position + Vector2(70, 128), 15, Color("7dffb0") if own or prices[j] == 0 else GOLD)
		ui_rects.append([b, "item:%d" % j])
	if toast_t > 0.0:
		text(toast, Vector2(900, 640), 20, Color(1, 0.6, 0.5))

func _ava_spin() -> void:
	if me:
		me.rotation.y = time * 0.8
		_animate(me, false, false, time)

func _process(delta: float) -> void:
	super(delta)
	if state != "play":
		toast_t = maxf(0.0, toast_t - delta)
	# 3D рисуем только в мире и на витрине аватара; на слабом компьютере сами снижаем качество.
	var need := state == "play" or (state == "intro" and tab == "avatar") or state == "over"
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS if need else SubViewport.UPDATE_DISABLED
	if state == "play":
		fps_t += delta
		if fps_t > 4.0:
			fps_t = 0.0
			var fps := Engine.get_frames_per_second()
			if fps < 24 and quality > 0:
				quality -= 1
				vp.scaling_3d_scale = [0.45, 0.6, 0.8][quality]
				if quality == 0:
					root3.get_node("sun").shadow_enabled = false
					_toast("Слабый компьютер: упрощаю графику")

func debug() -> Dictionary:
	var d := {"fps": Engine.get_frames_per_second(), "exp": exp_id, "tab": tab, "bux": save["bux"], "quiz": not quiz.is_empty(), "mist": stage_mist}
	if state == "play" and w:
		d.merge({"pos": [w.pos.x, w.pos.y, w.pos.z], "check": w.check_n, "deaths": w.deaths, "wrong": w.wrong, "auto": auto, "bots": bots.size()})
		if exp_id == "tycoon":
			d["cash"] = ty["cash"]
			d["owned"] = ty["owned"].keys()
		if exp_id == "sim":
			d["bag"] = sim["bag"]
			d["coins"] = sim["coins"]
			d["pack"] = sim["pack"]
		if not quiz.is_empty():
			d["right"] = quiz["right"]
	return d
