extends "res://arcade/game.gd"
# «Кодоблокс» — 3D-мир в духе Roblox для всего класса: главная страница с мирами, блочный герой от третьего лица,
# одноклассники в том же мире (сервер /results/api/blox, комната на класс и мир), быстрый чат, таблица лидеров,
# Кодобаксы на облик. Миры: обби с дверями-ответами, логическим и двоичным мостами; тайкун с ценами в битах и 0x;
# симулятор с рюкзаком в байтах; сложное обби; «Студия» — строим программой на Python, как в Roblox Studio.
# Физика и карты — в blox/logic.gd (тест tests/blox.gd проходит обби автопилотом), сервер — tools/kodopoly/server/blox_api.py.

const L = preload("res://blox/logic.gd")
const EXP := [
	{"id": "obby", "title": "Обби: Башня битов", "thumb": "bx_thumb_obby", "about": "Двери-ответы, логический мост и мост из битов."},
	{"id": "tycoon", "title": "Тайкун: Серверная", "thumb": "bx_thumb_tycoon", "about": "Дропперы и апгрейдеры. Цены — в битах, 2^n и 0x."},
	{"id": "sim", "title": "Симулятор битов", "thumb": "bx_thumb_sim", "about": "Собирай биты, продавай байты, открывай зоны."},
	{"id": "glass", "title": "Обби: Стеклянный мост", "thumb": "bx_thumb_glass", "about": "Исчезающие блоки, логика и мост из 8 бит."},
	{"id": "studio", "title": "Студия: строим кодом", "thumb": "bx_thumb_studio", "about": "Как Roblox Studio: стены, пирамиды и числа — программой на Python."},
	{"id": "mega", "title": "Обби: 40 этапов", "thumb": "bx_thumb_mega", "about": "Батуты, лазеры, ленты и мосты из чисел. Этап — чекпоинт."},
	{"id": "lava", "title": "Пол — это лава!", "thumb": "bx_thumb_lava", "about": "Весь класс на плитках с ответами. Неверные — в лаву."},
	{"id": "escape", "title": "Побег из тюрьмы Глюка", "thumb": "bx_thumb_escape", "about": "Кодовые замки: биты, логика, шифр Цезаря, сейф."},
]
const ST = preload("res://blox/studio.gd")
const NET_JS := "window.bxNet=window.bxNet||(function(){var N={st:null,say:-1,broke:[],take:[],chat:0,inbox:null,err:'',token:'',busy:false,joined:null,online:null,code:null};function post(p,b){return fetch('/results/api/blox/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b),cache:'no-store'}).then(function(r){return r.json().then(function(d){if(!r.ok||d.status!=='ok')throw new Error(d.message||'нет связи');return d})})}N.join=function(c,n,w){N.leave();N.joined=null;N.err='';N.inbox=null;N.chat=0;post('join',{className:c,name:n,world:w}).then(function(d){N.token=d.token;N.joined=d}).catch(function(e){N.err=e.message;N.joined={fail:e.message}})};N.leave=function(){if(N.token){post('leave',{token:N.token}).catch(function(){});N.token=''}};N.who=function(c){post('who',{className:c}).then(function(d){N.online=d.online}).catch(function(){})};setInterval(function(){if(!N.token||N.busy)return;N.busy=true;var b={token:N.token,chat:N.chat};if(N.st)b.st=N.st;if(N.say>=0){b.say=N.say;N.say=-1}if(N.broke.length){b.broke=N.broke;N.broke=[]}if(N.take.length){b.take=N.take;N.take=[]}post('sync',b).then(function(d){N.err='';if(d.chat.length)N.chat=d.chat[d.chat.length-1].n;var o=N.inbox;d.chatq=(o?o.chatq:[]).concat(d.chat);d.gotq=(o?o.gotq:[]).concat(d.got);N.inbox=d}).catch(function(e){N.err=e.message;if(/войди/.test(e.message))N.token=''}).then(function(){N.busy=false})},300);N.take_inbox=function(){var x=N.inbox;N.inbox=null;return x?JSON.stringify(x):''};window.addEventListener('pagehide',function(){if(N.token)navigator.sendBeacon&&navigator.sendBeacon('/results/api/blox/leave',new Blob([JSON.stringify({token:N.token})],{type:'application/json'}))});return N})();"
const RUN_JS := "window.bxRun=function(code){var H=window.CodeHero;if(!H)return JSON.stringify({ok:false,msg:'Интерпретатор Python ещё загружается — попробуй через секунду.'});var out=[],key={},lines=[];var env={place:{builtin:'place',call:function(a){var x=a[0],y=a[1],z=a[2];if(a.length!==3||![x,y,z].every(Number.isInteger))throw new H.PyError('place(x, y, z): три целых числа.');if([x,y,z].some(function(v){return v<0||v>9}))throw new H.PyError('Строить можно от 0 до 9 по каждой оси: ('+x+', '+y+', '+z+') вне площадки.');var k=x+','+y+','+z;if(!key[k]){key[k]=1;out.push([x,y,z])}if(out.length>200)throw new H.PyError('Слишком много блоков (больше 200).');return null}},print:{builtin:'print',call:function(a){lines.push(a.map(String).join(' '));return null}}};try{var it=H.run(H.parse(String(code)),env,{ops:80000});for(var s of it){}return JSON.stringify({ok:true,blocks:out,print:lines.slice(0,6)})}catch(e){return JSON.stringify({ok:false,msg:(e.line?'строка '+e.line+': ':'')+e.message,blocks:out})}};"
const PHRASES := ["Привет!", "Помогите!", "Го вместе!", "Подожди меня!", "Спасибо!", "Ура, чекпоинт!", "Упал(а) в лаву 😅", "Какой ответ?", "Это 1 (истина)", "Это 0 (ложь)", "Я понял(а)!", "gg"]
const SKIN := Color("f5cd30")
const SHIRTS := [Color("2f7fd0"), Color("d64545"), Color("3fae5a"), Color("8a4fd8"), Color("f08a24"), Color("1c1f2a"), Color("f2f2f2"), Color("ff6fae")]
const PANTS := [Color("2b3a67"), Color("3f8a3c"), Color("222222"), Color("7a4a2a"), Color("c0c0c0"), Color("8a1f2f")]
const HATS := ["нет", "Кепка", "Корона", "Наушники", "Цилиндр", "Нимб"]
const SHOP := {"shirt": [0, 0, 15, 15, 20, 25, 30, 40], "pants": [0, 0, 10, 15, 20, 25], "face": [0, 0, 10, 15, 20, 25, 30, 40], "hat": [0, 25, 120, 45, 60, 90]}

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
var remotes := {}              # id одноклассника → {node, nick, st, pos, plot, decor, key}
var net := false               # ученик пришёл из практикума: играем с классом
var who := {}                  # {className, name}
var joined := false
var nick := "Ты"
var my_plot := 0
var net_err := ""
var net_t := 0.0
var orb_wait := {}             # шары, запрошенные у сервера
var online := {}               # сколько одноклассников в каждом мире
var chat_menu := false
var chat_rects: Array = []
var st_tasks: Array = []       # задания Студии
var st_i := 0
var st_built: Array = []       # блоки последнего запуска
var st_parts: Array = []       # индексы частей мира под построенные блоки
var st_msg := ""
var st_ok := false
var st_print: Array = []
var editor: CodeEdit
var ghost: Node3D
var st_rects := {}
var pz := {}                   # открытая головоломка замка (Побег)
var pz_ans: Array = []
var pz_rects: Array = []
var lava := {}                 # «Пол — это лава»: раунд, фаза, плитки, выживания
var srv_off := 0.0             # часы сервера минус свои: раунды лавы у класса одновременно
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
	stages = 8
	unit = ""
	show_lives = false
	for ex in EXP:
		thumbs.append(_tex3(ex["thumb"]))
	for i in 8:
		var pth := "res://assets/bx_face%d.png" % i
		faces.append(load(pth) if ResourceLoader.exists(pth) else null)
	_load_save()
	if OS.has_feature("web"):
		var raw = JavaScriptBridge.eval("(function(){try{return sessionStorage.getItem('school4-who')||''}catch(e){return ''}})()")
		var d = JSON.parse_string(str(raw)) if raw != null and str(raw) != "" else null
		if d is Dictionary and str(d.get("className", "")) != "" and str(d.get("name", "")).contains(" "):
			who = {"className": str(d["className"]), "name": str(d["name"])}
			net = true
			JavaScriptBridge.eval(NET_JS)
			JavaScriptBridge.eval("bxNet.who(%s)" % JSON.stringify(who["className"]))
		JavaScriptBridge.eval(RUN_JS)
		JavaScriptBridge.eval("(function(){if(window.CodeHero||document.getElementById('bx-core'))return;var s=document.createElement('script');s.id='bx-core';s.src='/courses/game-%d-codehero/core.js';document.head.appendChild(s)})()" % clampi(grade, 6, 11))
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
	remotes = {}
	joined = false
	stage_mist = 0
	orb_wait = {}
	chat_menu = false
	my_plot = 0
	_build_world(int(Time.get_ticks_usec()) % 100000 + stage)
	yaw = PI
	pitch = 0.42
	dist = 12.0
	if exp_id == "studio":
		yaw = PI + 0.5
		pitch = 0.7
		dist = 15.0
	_say("Система", "Ты в мире «%s»" % EXP[stage - 1]["title"])
	if net:
		JavaScriptBridge.eval("bxNet.join(%s,%s,%s)" % [JSON.stringify(who["className"]), JSON.stringify(who["name"]), JSON.stringify(exp_id)])
		_say("Система", "Подключаемся к миру класса %s…" % who["className"])
	else:
		_say("Система", "Ты играешь один. Открой «Кодоблокс» из практикума — и одноклассники будут в этом мире.")

func _build_world(seed: int) -> void:
	# Мир строится по зерну: у всех в комнате класса одно зерно — одна и та же карта.
	_clear_world()
	remotes = {}
	if exp_id == "obby" or exp_id == "glass" or exp_id == "mega":
		tr = L.obby(exp_id, grade, seed)
		w = tr.w
	elif exp_id == "escape":
		tr = L.escape(grade, seed)
		w = tr.w
	elif exp_id == "lava":
		tr = null
		w = _lava_world(seed)
	elif exp_id == "tycoon":
		tr = null
		w = _tycoon_world()
	elif exp_id == "studio":
		tr = null
		w = _studio_world()
	else:
		tr = null
		w = _sim_world(seed)
	w.pos = w.spawn
	for i in w.parts.size():
		_make_part(i)
	me = _avatar(save["look"], "")
	world3.add_child(me)
	if exp_id == "tycoon":
		_ty_decor()
	if exp_id == "studio":
		_st_task_show()

func reset() -> void:
	pass

func stage_stars() -> int:
	if exp_id == "mega":
		return 3 if stage_mist <= 10 else (2 if stage_mist <= 25 else 1)
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
		"ghost":
			m.albedo_color = Color(0.45, 0.85, 1.0, 0.28)
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			m.emission_enabled = true
			m.emission = Color("4fc3ff")
			m.emission_energy_multiplier = 0.4
		"built":
			texn = "bx_studs"
			m.albedo_color = Color("ffb84d")
		"axis_x", "axis_y", "axis_z":
			m.albedo_color = {"axis_x": Color("ff4a4a"), "axis_y": Color("4aff6a"), "axis_z": Color("4a8aff")}[key]
			m.emission_enabled = true
			m.emission = m.albedo_color
			m.emission_energy_multiplier = 0.8
		"logic":
			m.albedo_color = Color(1.0, 0.85, 0.5, 0.55)
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			m.roughness = 0.1
		"tile0", "tile1", "tile2", "tile3":
			texn = "bx_studs"
			m.albedo_color = {"tile0": Color("ff5a5a"), "tile1": Color("4f9bff"), "tile2": Color("4fd07a"), "tile3": Color("ffc94d")}[key]
		"laser":
			m.albedo_color = Color(1.0, 0.15, 0.2, 0.75)
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			m.emission_enabled = true
			m.emission = Color("ff2030")
			m.emission_energy_multiplier = 2.2
		"bounce":
			m.albedo_color = Color("ff4fd0")
			m.emission_enabled = true
			m.emission = Color("ff4fd0")
			m.emission_energy_multiplier = 0.6
		"door_lock":
			texn = "bx_neon"
			m.albedo_color = Color("ff7a7a")
		"guard":
			m.albedo_color = Color("d02040")
			m.emission_enabled = true
			m.emission = Color("ff2040")
			m.emission_energy_multiplier = 0.8
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
	me = null
	ghost = null

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
			var logic_tile: bool = p.get("m", "") == "logic"
			_box(s, _mat("logic" if logic_tile else "glass"), Vector3.ZERO, node)
			var gl := _label(str(p.get("text", "")), 34 if logic_tile else 96, Vector3(0, 0.27, 0), node, false, Color("ffffff"))
			gl.rotation = Vector3(-PI / 2, PI, 0)
			if logic_tile:
				gl.width = 230.0
				# над плиткой — то же выражение, чтобы читалось издалека
				_label(str(p.get("text", "")), 30, Vector3(0, 1.6, 0), node, true, Color("ffe8a0"))
			else:
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
		if p.has("a"):
			node.position = p["c"]
		match k:
			"laser":
				node.visible = L.World.laser_on(p, w.t) or fposmod(w.t + float(p.get("ph", 0.0)), float(p.get("per", 2.4))) > float(p.get("per", 2.4)) - 0.25
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

# ---------- одноклассники (сеть) ----------

func plot_off(i: int) -> Vector3:
	# Участки тайкуна и Студии стоят сеткой 4 × 2; свой участок всегда в начале координат.
	return Vector3((i % 4) * 36.0, 0.0, (i / 4) * 44.0)

func _rel(plot: int) -> Vector3:
	if exp_id != "tycoon" and exp_id != "studio":
		return Vector3.ZERO
	return plot_off(plot) - plot_off(my_plot)

func _my_state() -> Dictionary:
	var a := 2 if not w.on_floor else (1 if Vector2(w.vel.x, w.vel.z).length() > 0.5 else 0)
	var stv := {"p": [snappedf(w.pos.x, 0.01), snappedf(w.pos.y, 0.01), snappedf(w.pos.z, 0.01)], "r": snappedf(face_dir, 0.01), "a": a,
		"cp": _progress_n(), "sc": int(_my_score()), "look": save["look"]}
	if exp_id == "tycoon":
		var own: Array = ty["owned"].keys()
		if ty["claimed"]:
			own.append("claim")
		stv["own"] = own
	if exp_id == "studio":
		stv["b"] = st_built.slice(0, 120)
	return stv

func _progress_n() -> int:
	match exp_id:
		"tycoon":
			return ty["owned"].size()
		"sim":
			return int(sim["pack"])
		"studio":
			return st_i
		"lava":
			return int(lava.get("survived", 0))
		"escape":
			return _locks_open()
	return w.check_n

func _net_tick(dt: float) -> void:
	if not net:
		return
	if not joined:
		var j = JSON.parse_string(str(JavaScriptBridge.eval("bxNet.joined?JSON.stringify(bxNet.joined):''")))
		if j is Dictionary:
			if j.has("fail"):
				net_err = str(j["fail"])
				_say("Система", "Нет связи с сервером класса: %s. Играешь один." % net_err)
				net = false
				return
			joined = true
			nick = str(j.get("nick", "Ты"))
			my_plot = maxi(0, int(j.get("plot", 0)))
			var seed := int(j.get("seed", 1))
			srv_off = float(j.get("now", Time.get_unix_time_from_system())) - Time.get_unix_time_from_system()
			if exp_id in ["obby", "glass", "sim", "mega", "escape", "lava"]:
				_build_world(seed)          # общая карта комнаты
			_say("Система", "Ты в мире класса %s (комната %d). Т — быстрый чат." % [who["className"], int(j.get("room", 1))])
		return
	net_t -= dt
	if net_t <= 0.0:
		net_t = 0.1
		JavaScriptBridge.eval("bxNet.st=%s;" % JSON.stringify(_my_state()))
		var d = JSON.parse_string(str(JavaScriptBridge.eval("bxNet.take_inbox()")))
		if d is Dictionary:
			_net_apply(d)
		net_err = str(JavaScriptBridge.eval("bxNet.err||''"))

func _net_apply(d: Dictionary) -> void:
	var seen := {}
	for pl in d.get("players", []):
		if not (pl is Dictionary) or not (pl.get("st") is Dictionary) or (pl["st"] as Dictionary).is_empty():
			continue
		var id := int(pl["id"])
		seen[id] = true
		var stv: Dictionary = pl["st"]
		var key := JSON.stringify(stv.get("look", {}))
		var r: Dictionary = remotes.get(id, {})
		if r.is_empty() or r["key"] != key:
			if not r.is_empty():
				(r["node"] as Node3D).queue_free()
			var node := _avatar(stv.get("look", {}), str(pl.get("nick", "?")))
			world3.add_child(node)
			r = {"node": node, "key": key, "pos": Vector3.ZERO, "fresh": true, "decor": null, "dkey": ""}
			remotes[id] = r
		r["nick"] = str(pl.get("nick", "?"))
		r["plot"] = int(pl.get("plot", 0))
		r["st"] = stv
		var pp: Array = stv.get("p", [0, 0, 0])
		r["target"] = Vector3(float(pp[0]), float(pp[1]), float(pp[2])) + _rel(int(r["plot"]))
		if r["fresh"]:
			r["pos"] = r["target"]
			r["fresh"] = false
		_remote_decor(r)
	for id in remotes.keys():
		if not seen.has(id):
			(remotes[id]["node"] as Node3D).queue_free()
			if remotes[id]["decor"]:
				(remotes[id]["decor"] as Node3D).queue_free()
			remotes.erase(id)
	for c in d.get("chatq", []):
		if c is Dictionary:
			_say(str(c.get("nick", "")), str(c.get("text", "")))
	# общие стеклянные и логические плитки
	for bi in d.get("broken", []):
		var i := int(bi)
		if i >= 0 and i < w.parts.size() and w.parts[i]["k"] == "glass" and not w.parts[i].get("broken", false):
			w.parts[i]["broken"] = true
	if exp_id == "sim":
		var taken := {}
		for oi in d.get("orbs", []):
			taken[int(oi)] = true
		for i in w.parts.size():
			if w.parts[i]["k"] == "orb" and not orb_wait.has(i):
				w.parts[i]["off"] = taken.has(i)
		for gi in d.get("gotq", []):
			_sim_got(int(gi))
		for i in orb_wait.keys():
			if not taken.has(i):
				orb_wait.erase(i)
			else:
				orb_wait[i] = float(orb_wait[i]) + 0.1
				if orb_wait[i] > 3.0:
					orb_wait.erase(i)
	online[exp_id] = int(d.get("count", 1))
	if d.has("now"):
		srv_off = lerpf(srv_off, float(d["now"]) - Time.get_unix_time_from_system(), 0.2)

func _remote_tick(dt: float) -> void:
	for id in remotes:
		var r: Dictionary = remotes[id]
		var node: Node3D = r["node"]
		r["pos"] = (r["pos"] as Vector3).lerp(r.get("target", r["pos"]), minf(1.0, dt * 9.0))
		node.position = r["pos"]
		var stv: Dictionary = r.get("st", {})
		node.rotation.y = lerp_angle(node.rotation.y, float(stv.get("r", 0.0)), minf(1.0, dt * 10.0))
		var a := int(stv.get("a", 0))
		_animate(node, a == 1, a == 2, time + float(id))

func _remote_decor(r: Dictionary) -> void:
	# Участки одноклассников в тайкуне (купленное) и в Студии (их постройки).
	if exp_id != "tycoon" and exp_id != "studio":
		return
	var stv: Dictionary = r["st"]
	var dkey := JSON.stringify([stv.get("own", []), stv.get("b", []), r["plot"]])
	if dkey == r["dkey"]:
		return
	r["dkey"] = dkey
	if r["decor"]:
		(r["decor"] as Node3D).queue_free()
	var d := Node3D.new()
	d.position = _rel(int(r["plot"]))
	world3.add_child(d)
	r["decor"] = d
	if exp_id == "tycoon":
		_box(Vector3(26, 0.1, 32), _mat("studs"), Vector3(0, 0.05, 6), d)
		var own: Array = stv.get("own", [])
		if own.has("claim"):
			_box(Vector3(18, 0.6, 2.2), _mat("belt"), Vector3(0, 0.3, 16), d)
			_box(Vector3(2.4, 2.0, 3.0), _mat("neon"), Vector3(10.2, 1.0, 16), d)
			var drops := [[-7.5, "claim"], [-5.5, "drop2"], [-3.5, "drop3"], [-1.5, "drop4"]]
			for dr in drops:
				if own.has(dr[1]):
					_box(Vector3(1.6, 1.6, 1.6), _mat("metal"), Vector3(dr[0], 3.3, 16), d)
			if own.has("walls"):
				_box(Vector3(26, 4, 0.6), _mat("wall"), Vector3(0, 2, 22.5), d)
			if own.has("super"):
				_box(Vector3(6, 9, 4), _mat("neon"), Vector3(0, 4.5, 26), d)
		_label("Участок: %s" % r["nick"], 60, Vector3(0, 6.5, -9), d, true, Color("ffd34d"))
	else:
		_box(Vector3(10.4, 0.2, 10.4), _mat("studs"), Vector3(0, 0.1, 9), d)
		for b in stv.get("b", []):
			if b is Array and b.size() == 3:
				_box(Vector3(0.98, 0.98, 0.98), _mat("built"), _st_center(int(b[0]), int(b[1]), int(b[2])) + Vector3(0, 0.2, 0), d)
		_label("Стройка: %s" % r["nick"], 60, Vector3(0, 7.0, 3.5), d, true, Color("ffd34d"))

# ---------- тайкун ----------

func _tycoon_world():
	var ww = L.World.new()
	ww.add({"p": Vector3(0, -0.5, 10), "s": Vector3(300, 1, 200), "k": "solid", "m": "grass"})
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

func _sim_world(seed: int):
	var ww = L.World.new()
	var srng := RandomNumberGenerator.new()
	srng.seed = seed
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
			ww.add({"p": Vector3(srng.randf_range(-26, 26), 1.0, zc + srng.randf_range(-12, 12)), "s": Vector3(1.0, 1.0, 1.0), "k": "orb", "bits": int(L.ZONES[z]["bits"]), "zone": z})
		if z > 0:
			var need: int = L.ZONES[z]["need"]
			ww.add({"p": Vector3(0, 3, zc - 16.5), "s": Vector3(70, 6, 1), "k": "wall", "m": "vanish", "need": need})
			ww.add({"p": Vector3(0, 7.5, zc - 16.8), "s": Vector3(16, 2.4, 0.2), "k": "sign", "m": "sign", "text": "Зона %d: нужен рюкзак от %s" % [z + 1, L.cap_text(need)]})
	return ww

func _sim_got(i: int) -> void:
	orb_wait.erase(i)
	if i < 0 or i >= w.parts.size() or w.parts[i]["k"] != "orb":
		return
	var cap: int = L.PACKS[int(sim["pack"])]["cap"]
	if int(sim["bag"]) + int(w.parts[i]["bits"]) <= cap:
		sim["bag"] = int(sim["bag"]) + int(w.parts[i]["bits"])
		sfx.emit("take")

func _sim_tick(dt: float) -> void:
	sim["lock"] = maxf(0.0, float(sim["lock"]) - dt)
	var cap: int = L.PACKS[int(sim["pack"])]["cap"]
	for i in w.parts.size():
		var p: Dictionary = w.parts[i]
		if p["k"] == "orb" and p.get("off", false) and not (net and joined):
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
		if net and joined:
			# Шар общий: достаётся тому, кого сервер услышит первым.
			if not orb_wait.has(i):
				orb_wait[i] = 0.0
				p["off"] = true
				JavaScriptBridge.eval("bxNet.take.push(%d)" % i)
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

# ---------- Студия: строим программой на Python ----------

func _st_center(x: int, y: int, z: int) -> Vector3:
	return Vector3(-5.0 + x + 0.5, y + 0.5, 4.0 + z + 0.5)

func _studio_world():
	var ww = L.World.new()
	ww.add({"p": Vector3(0, -0.5, 10), "s": Vector3(300, 1, 200), "k": "solid", "m": "grass"})
	ww.add({"p": Vector3(0, 0.05, 9), "s": Vector3(10.4, 0.1, 10.4), "k": "deco", "m": "studs"})
	ww.add({"p": Vector3(-1, 0.1, 0.5), "s": Vector3(3, 0.2, 3), "k": "deco", "m": "spawn"})
	# оси площадки: x — красная, z — синяя, y — зелёная
	ww.add({"p": Vector3(0, 0.12, 3.9), "s": Vector3(10, 0.06, 0.12), "k": "deco", "m": "axis_x"})
	ww.add({"p": Vector3(-5.1, 0.12, 9), "s": Vector3(0.12, 0.06, 10), "k": "deco", "m": "axis_z"})
	ww.add({"p": Vector3(-5.1, 5, 3.9), "s": Vector3(0.12, 10, 0.12), "k": "deco", "m": "axis_y"})
	ww.spawn = Vector3(-1, 0, 1)
	var all: Dictionary = ST.DATA
	st_tasks = all.get(str(grade), all["8"])
	st_i = 0
	st_built = []
	st_parts = []
	st_msg = ""
	st_ok = false
	st_print = []
	return ww

func _st_task_show() -> void:
	# Призрачные блоки — что нужно построить; подписи осей.
	if ghost:
		ghost.queue_free()
	ghost = Node3D.new()
	world3.add_child(ghost)
	for k in 10:
		_label(str(k), 56, Vector3(-5.0 + k + 0.5, 0.2, 3.3), ghost, true, Color("ff8a8a"))
		_label(str(k), 56, Vector3(-5.7, 0.2, 4.0 + k + 0.5), ghost, true, Color("8ab8ff"))
		_label(str(k), 44, Vector3(-5.6, k + 0.5, 3.6), ghost, true, Color("8aff9a"))
	_label("x →", 72, Vector3(5.8, 0.3, 3.3), ghost, true, Color("ff8a8a"))
	_label("z", 72, Vector3(-5.8, 0.3, 14.8), ghost, true, Color("8ab8ff"))
	_label("y ↑", 72, Vector3(-5.6, 10.6, 3.6), ghost, true, Color("8aff9a"))
	if st_i >= st_tasks.size():
		return
	for b in st_tasks[st_i]["target"]:
		_box(Vector3(0.96, 0.96, 0.96), _mat("ghost"), _st_center(int(b[0]), int(b[1]), int(b[2])), ghost)
	if editor:
		editor.text = str(st_tasks[st_i]["starter"])

func _st_editor(show: bool) -> void:
	if show and not editor:
		editor = CodeEdit.new()
		editor.position = Vector2(830, 236)
		editor.size = Vector2(434, 300)
		editor.indent_use_spaces = true
		editor.indent_size = 4
		editor.indent_automatic = true
		editor.gutters_draw_line_numbers = true
		editor.add_theme_font_override("font", load("res://assets/dejavu.ttf"))
		editor.add_theme_font_size_override("font_size", 17)
		editor.add_theme_color_override("background_color", Color(0.04, 0.06, 0.14, 0.94))
		add_child(editor)
	if editor:
		editor.visible = show
		if not show:
			editor.release_focus()

func _st_run() -> void:
	if st_i >= st_tasks.size():
		return
	if not OS.has_feature("web"):
		st_msg = "Программы запускаются в браузере."
		return
	var r = JSON.parse_string(str(JavaScriptBridge.eval("bxRun(%s)" % JSON.stringify(editor.text))))
	if not (r is Dictionary):
		st_msg = "Не удалось запустить программу."
		return
	st_print = r.get("print", [])
	_st_apply(r.get("blocks", []), bool(r.get("ok", false)), str(r.get("msg", "")))

func _st_apply(blocks: Array, ok: bool, err: String) -> void:
	# Построить блоки программы (по ним можно ходить) и сравнить с заданием.
	for i in st_parts:
		w.parts[i]["k"] = "gone"
		if vis.has(i):
			vis[i].visible = false
	st_parts = []
	st_built = []
	for b in blocks:
		if b is Array and b.size() == 3:
			var bx := [int(b[0]), int(b[1]), int(b[2])]
			st_built.append(bx)
			var i: int = w.add({"p": _st_center(bx[0], bx[1], bx[2]) + Vector3(0, 0.2, 0), "s": Vector3(1, 1, 1), "k": "solid", "m": "built"})
			st_parts.append(i)
			_make_part(i)
	if not ok:
		st_ok = false
		st_msg = "Ошибка: " + err
		sfx.emit("error")
		return
	var task: Dictionary = st_tasks[st_i]
	var want := {}
	for t in task["target"]:
		want["%d,%d,%d" % [int(t[0]), int(t[1]), int(t[2])]] = true
	var have := {}
	for b in st_built:
		have["%d,%d,%d" % b] = true
	var extra := 0
	for k in have:
		if not want.has(k):
			extra += 1
	var miss := 0
	for k in want:
		if not have.has(k):
			miss += 1
	if extra == 0 and miss == 0:
		var lines := 0
		for ln in (editor.text.split("\n") if editor else PackedStringArray()):
			if ln.strip_edges() != "" and not ln.strip_edges().begins_with("#"):
				lines += 1
		var par: int = task["par"]
		if editor and lines > par + 2:
			stage_mist += 1
		st_ok = true
		st_msg = "Готово! Строк кода: %d (рекорд — %d). Кнопка «Дальше» — следующее задание." % [lines, par]
		sfx.emit("win")
		burst(Vector2(400, 300), GOLD, 30, 400.0, "p_star", 30.0)
	else:
		st_ok = false
		stage_mist += 1
		st_msg = "Не совпадает с заданием: лишних блоков %d, не хватает %d. Сравни с призрачными блоками." % [extra, miss]
		sfx.emit("error")

func _st_next() -> void:
	if not st_ok:
		return
	st_i += 1
	st_ok = false
	st_msg = ""
	st_print = []
	if st_i >= st_tasks.size():
		_win_soon()
		return
	_st_task_show()

func _draw_studio() -> void:
	st_rects = {}
	var r := Rect2(820, 64, 454, 600)
	rr(r, Color(0.06, 0.08, 0.18, 0.9), 14, Color("4fc3ff"), 2)
	if st_i >= st_tasks.size():
		text("Все задания построены!", Vector2(1047, 120), 22, GOLD)
		return
	var task: Dictionary = st_tasks[st_i]
	draw_string(font_b, Vector2(836, 92), "Задание %d из %d · %s" % [st_i + 1, st_tasks.size(), task["title"]], HORIZONTAL_ALIGNMENT_LEFT, 420, 18, GOLD)
	var y := 116.0
	for part in _wrap(str(task["text"]), 46):
		draw_string(font, Vector2(836, y), part, HORIZONTAL_ALIGNMENT_LEFT, 430, 15, INK)
		y += 19.0
	draw_string(font, Vector2(836, 228), "place(x, y, z) — блок · рекорд: %d строк · Esc — выйти из кода" % int(task["par"]), HORIZONTAL_ALIGNMENT_LEFT, 430, 13, MUTED)
	var bt := [["run", "▶ Запустить", Color("2fae5f")], ["next", "Дальше →", Color("2f7fd0") if st_ok else Color("2a3350")], ["reset", "Сначала", Color("3a3f55")]]
	for k in bt.size():
		var b := Rect2(836 + k * 146, 548, 136, 40)
		rr(b, bt[k][2], 10)
		text(bt[k][1], b.get_center(), 16, Color.WHITE)
		st_rects[bt[k][0]] = b
	var my := 604.0
	for part in _wrap(st_msg, 48):
		draw_string(font_b, Vector2(836, my), part, HORIZONTAL_ALIGNMENT_LEFT, 430, 14, Color("7dffb0") if st_ok else Color("ffb0a0"))
		my += 18.0
	for ln in st_print:
		draw_string(font, Vector2(836, my), "> " + str(ln), HORIZONTAL_ALIGNMENT_LEFT, 430, 13, Color("9fe8ff"))
		my += 16.0

# ---------- Побег: замки-головоломки ----------

func _pz_open(i: int) -> void:
	var p: Dictionary = w.parts[i]
	var door: int = p["door"]
	if w.parts[door].get("open", false):
		return
	pz = tr.quiz[int(p["lock"])].duplicate()
	pz["door"] = door
	pz["lock"] = int(p["lock"])
	match str(pz["kind"]):
		"bits":
			pz_ans = []
			for k in int(pz["w"]):
				pz_ans.append(false)
		"levers":
			pz_ans = [false, false, false]
		_:
			pz_ans = []
	sfx.emit("click")

func _pz_check(ans) -> void:
	if pz.is_empty():
		return
	if L.puzzle_ok(pz, ans):
		var door: int = pz["door"]
		w.parts[door]["open"] = true
		if vis.has(door):
			vis[door].visible = false
		_toast("Замок %d открыт!" % (int(pz["lock"]) + 1))
		_say("Система", "%s открывает замок %d" % [nick, int(pz["lock"]) + 1])
		sfx.emit("win")
		pz = {}
		pz_ans = []
	else:
		stage_mist += 1
		sfx.emit("error")
		_toast("Неверно — замок не открылся. Попробуй ещё.")
		if str(pz["kind"]) == "order":
			pz_ans = []

func _pz_click(j: int) -> void:
	match str(pz["kind"]):
		"bits", "levers":
			if j < pz_ans.size():
				pz_ans[j] = not pz_ans[j]
				sfx.emit("click")
			elif j == 100:
				_pz_check(pz_ans)
		"order":
			if j < (pz["items"] as Array).size() and not pz_ans.has(j):
				pz_ans.append(j)
				sfx.emit("click")
				if pz_ans.size() == (pz["items"] as Array).size():
					_pz_check(pz_ans)
		_:
			if j < (pz["opts"] as Array).size():
				_pz_check(j)

func _draw_puzzle() -> void:
	draw_rect(Rect2(0, 0, W, H), Color(0.02, 0.03, 0.08, 0.6))
	var r := Rect2(240, 150, 800, 420)
	rr(r, Color("16203a"), 20, Color("ff6a6a"), 3)
	pz_rects = []
	var y := 196.0
	for part in _wrap(str(pz["title"]), 60):
		text(part, Vector2(640, y), 21, INK)
		y += 30.0
	for ln in pz.get("code", []):
		draw_string(font_b, Vector2(320, y + 6), str(ln), HORIZONTAL_ALIGNMENT_LEFT, 640, 19, Color("7df9ff"))
		y += 26.0
	y += 20.0
	var mouse := get_local_mouse_position()
	match str(pz["kind"]):
		"bits":
			var n := int(pz["w"])
			var cw := minf(84.0, 700.0 / n)
			for k in n:
				var b := Rect2(640 - n * cw / 2.0 + k * cw + 4, y, cw - 8, cw - 8)
				pz_rects.append([b, k])
				var on: bool = pz_ans[k]
				rr(b, Color("ffd34d") if on else Color("2a3350"), 40, Color("fff2a8") if on else Color("4b5f8f"), 3)
				text("1" if on else "0", b.get_center(), 28, Color("1b2333") if on else MUTED)
				text(str(1 << (n - 1 - k)), b.get_center() + Vector2(0, cw / 2.0 + 10), 14, MUTED, false)
			var ok := Rect2(540, 500, 200, 48)
			rr(ok, Color("2fae5f"), 12)
			text("Проверить", ok.get_center(), 20, Color.WHITE)
			pz_rects.append([ok, 100])
		"levers":
			for k in 3:
				var b := Rect2(430 + k * 150, y, 120, 140)
				pz_rects.append([b, k])
				var on: bool = pz_ans[k]
				rr(b, Color("223056"), 14, Color("4b5f8f"), 2)
				text(["A", "B", "C"][k], b.position + Vector2(60, 24), 26, INK)
				rr(Rect2(b.position + Vector2(52, 44), Vector2(16, 70)), Color("101632"), 6)
				rr(Rect2(b.position + Vector2(34, 46 if on else 92), Vector2(52, 20)), Color("2fd06a") if on else Color("d04a4a"), 8)
				text("1" if on else "0", b.position + Vector2(60, 128), 18, Color("7dffb0") if on else Color("ff9a9a"))
			var ok2 := Rect2(540, 500, 200, 48)
			rr(ok2, Color("2fae5f"), 12)
			text("Открыть", ok2.get_center(), 20, Color.WHITE)
			pz_rects.append([ok2, 100])
		"order":
			var items: Array = pz["items"]
			for k in items.size():
				var b := Rect2(640 - items.size() * 75 + k * 150 + 6, y + 20, 138, 80)
				pz_rects.append([b, k])
				var used: bool = pz_ans.has(k)
				rr(b, Color("2a4a2f") if used else (Color("2a3a66") if b.has_point(mouse) else Color("223056")), 12, Color("4b5f8f"), 2)
				text(str(items[k][0]), b.get_center(), 24, MUTED if used else INK)
				if used:
					text("%d" % (pz_ans.find(k) + 1), b.position + Vector2(14, 14), 16, Color("7dffb0"))
		_:
			var opts: Array = pz["opts"]
			for j in opts.size():
				var b := Rect2(360 + (j % 2) * 290, y + (j / 2) * 64, 270, 52)
				pz_rects.append([b, j])
				rr(b, Color("2a3a66") if b.has_point(mouse) else Color("223056"), 12, Color("4b5f8f"), 2)
				text("%d)  %s" % [j + 1, opts[j]], b.get_center(), 19, INK)
	text("Esc — отойти от замка", Vector2(640, 556), 14, MUTED, false)

# ---------- «Пол — это лава» ----------

func _lava_world(seed: int):
	var ww = L.World.new()
	lava = {"seed": seed, "round": -1, "phase": "", "tiles": [], "q": {}, "alive": false, "survived": 0, "played": 0}
	# трибуна для выбывших
	ww.add({"p": Vector3(0, 2.5, -9), "s": Vector3(24, 1, 6), "k": "solid", "m": "studs"})
	ww.add({"p": Vector3(0, 4.5, -12.5), "s": Vector3(24, 3, 1), "k": "solid", "m": "wall"})
	ww.spawn = Vector3(0, 3.0, -9)
	for k in 4:
		var c := Vector3(-4.6 + (k % 2) * 9.2, -0.5, 5.4 + (k / 2) * 9.2)
		var i: int = ww.add({"p": c, "s": Vector3(9.0, 1.0, 9.0), "k": "solid", "m": ["tile0", "tile1", "tile2", "tile3"][k], "tile": k})
		lava["tiles"].append(i)
	ww.add({"p": Vector3(0, 7.5, 21), "s": Vector3(20, 6, 0.4), "k": "sign", "m": "sign", "text": ""})
	return ww

func _lava_now() -> float:
	return Time.get_unix_time_from_system() + srv_off

func _lava_tick(_dt: float) -> void:
	var ph: Array = L.lava_phase(_lava_now())
	var r: int = ph[0]
	var phase: String = ph[1]
	var in_arena: bool = w.pos.z > 0.5 and w.pos.y > -2.0
	if r != int(lava["round"]):
		lava["round"] = r
		lava["q"] = L.lava_question(int(lava["seed"]), r, grade)
		var q: Dictionary = lava["q"]
		for k in 4:
			var i: int = lava["tiles"][k]
			w.parts[i]["k"] = "solid"
			var node: Node3D = vis[i]
			if node.has_meta("lb"):
				(node.get_meta("lb") as Node).queue_free()
			var lb := _label("%s\n%s" % ["ABCD"[k], q["opts"][k]], 72, Vector3(0, 1.4, 0), node, true, Color.WHITE)
			lb.width = 600.0
			node.set_meta("lb", lb)
			(node.get_child(0) as MeshInstance3D).material_override = _mat("tile%d" % k)
		for i in vis:
			if w.parts[i]["k"] == "sign":
				var sg = vis[i].get_child(1) if vis[i].get_child_count() > 1 else null
				if sg is Label3D:
					sg.text = str(q["q"]) + ("\n" + "\n".join(PackedStringArray(q.get("code", []))) if q.get("code", []).size() else "")
		if not in_arena:
			w.pos = Vector3(0, 0.2, 10)
			w.vel = Vector3.ZERO
			w.refresh_near(true)
		lava["alive"] = true
		lava["played"] = int(lava["played"]) + 1
		_toast("Раунд %d: встань на плитку с верным ответом!" % (int(lava["played"])))
	if phase != str(lava["phase"]):
		lava["phase"] = phase
		var q: Dictionary = lava["q"]
		if phase == "burn":
			for k in 4:
				if k != int(q["right"]):
					var i: int = lava["tiles"][k]
					w.parts[i]["k"] = "kill"
					(vis[i].get_child(0) as MeshInstance3D).material_override = _mat("lava")
			sfx.emit("error")
		elif phase == "rest":
			for k in 4:
				w.parts[lava["tiles"][k]]["k"] = "solid"
			if lava["alive"] and w.pos.z > 0.5:
				lava["survived"] = int(lava["survived"]) + 1
				_toast("Выжил! Верный ответ: %s" % q["opts"][int(q["right"])])
				sfx.emit("win")
				if int(lava["survived"]) >= 6:
					_win_soon()
			else:
				_toast("Верный ответ был: %s" % q["opts"][int(q["right"])])
	if phase == "burn" and w.deaths > int(lava.get("deaths", 0)):
		lava["alive"] = false
	lava["deaths"] = w.deaths

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
	if quiz.is_empty() and pz.is_empty() and not (editor and editor.has_focus()) and not chat_menu:
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
	elif exp_id == "lava":
		_lava_tick(dt)
	if auto and auto_st.has("need_lock") and pz.is_empty() and exp_id == "escape":
		# отладочный автопилот сам открывает замок (только на тестовом стенде)
		var n: int = auto_st["need_lock"]
		auto_st.erase("need_lock")
		for i in w.parts.size():
			if int(w.parts[i].get("lock", -1)) == n and w.parts[i]["k"] == "pad":
				_pz_open(i)
				_pz_check(L.puzzle_solve(pz))
	_net_tick(dt)
	_remote_tick(dt)
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
			_toast("Дзынь! Неверная плитка лопнула — теперь её видят все.")
			if net and joined:
				JavaScriptBridge.eval("bxNet.broke.push(%d)" % int(e["i"]))
		"check":
			sfx.emit("deliver")
			_toast("Чекпоинт %d!" % int(e["n"]))
		"coin":
			sfx.emit("take")
			earned += 5
		"finish":
			_win_soon()
		"pad":
			if exp_id == "escape":
				_pz_open(int(e["i"]))
			elif exp_id == "tycoon":
				_ty_pad(int(e["i"]))
			elif exp_id == "sim":
				_sim_event(int(e["i"]))
		"orb":
			_sim_event(int(e["i"]))
		"jump":
			sfx.emit("step")

func _finish_exp() -> void:
	if exp_id in ["obby", "glass", "mega"]:
		stage_mist = w.deaths + w.wrong
	earned += {"obby": 40, "tycoon": 60, "sim": 60, "glass": 80, "studio": 70, "mega": 150, "lava": 60, "escape": 90}[exp_id]
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
	for part in _wrap(s, maxi(14, 36 - who.length())):
		chat.append([who if first else "", part])
		first = false
	while chat.size() > 7:
		chat.pop_front()

# ---------- ввод ----------

func _input(event: InputEvent) -> void:
	# Пока ученик пишет код в Студии, клавиши достаются редактору (Esc — выйти из редактора).
	if editor and editor.visible and editor.has_focus() and event is InputEventKey:
		if event.pressed and event.physical_keycode == KEY_ESCAPE:
			editor.release_focus()
			get_viewport().set_input_as_handled()
		return
	if event is InputEventKey and event.pressed and not event.echo:
		var k: int = event.physical_keycode
		if state == "play":
			if k == KEY_ESCAPE:
				if not pz.is_empty():
					pz = {}
				elif chat_menu:
					chat_menu = false
				else:
					_home()
			elif not pz.is_empty() and k >= KEY_1 and k <= KEY_8:
				_pz_click(k - KEY_1)
			elif not pz.is_empty() and (k == KEY_ENTER or k == KEY_KP_ENTER):
				_pz_click(100)
			elif not quiz.is_empty() and k >= KEY_1 and k <= KEY_4:
				_answer(k - KEY_1)
			elif k == KEY_T or k == KEY_SLASH:
				chat_menu = not chat_menu
			elif chat_menu and k >= KEY_1 and k <= KEY_9:
				_chat_send(k - KEY_1)
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
			if editor and editor.visible and Rect2(editor.position, editor.size).has_point(p):
				return       # щелчок в редактор — ему
			if editor and event.pressed:
				editor.release_focus()
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
		if Rect2(176, 12, 150, 40).has_point(p):
			chat_menu = not chat_menu
			return true
		if not pz.is_empty():
			for r in pz_rects:
				if (r[0] as Rect2).has_point(p):
					_pz_click(int(r[1]))
			return true
		if not quiz.is_empty():
			for j in quiz_rects.size():
				if quiz_rects[j].has_point(p):
					_answer(j)
			return true
		if chat_menu:
			for j in chat_rects.size():
				if chat_rects[j].has_point(p):
					_chat_send(j)
					return true
		if exp_id == "studio":
			for k in st_rects:
				if (st_rects[k] as Rect2).has_point(p):
					match k:
						"run":
							_st_run()
						"next":
							_st_next()
						"reset":
							editor.text = str(st_tasks[st_i]["starter"])
					return true
			if Rect2(820, 64, 454, 600).has_point(p):
				return true
		return false
	for r in ui_rects:
		if (r[0] as Rect2).has_point(p):
			_ui(r[1])
			return true
	return true

func _home() -> void:
	state = "intro"
	quiz = {}
	tab = "home"
	chat_menu = false
	_st_editor(false)
	if net:
		JavaScriptBridge.eval("bxNet.leave();bxNet.who(%s)" % JSON.stringify(who["className"]))
	preview()

func _chat_send(j: int) -> void:
	chat_menu = false
	if j < 0 or j >= PHRASES.size():
		return
	if net and joined:
		JavaScriptBridge.eval("bxNet.say=%d" % j)
	else:
		_say(nick, PHRASES[j])

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
		_st_editor(exp_id == "studio")
		if exp_id == "studio":
			_st_task_show()
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
	rr(Rect2(176, 12, 150, 40), Color(0.08, 0.09, 0.12, 0.72) if not chat_menu else Color(0.2, 0.3, 0.6, 0.9), 10)
	text("💬 Чат (T)", Vector2(251, 31), 17, INK, false)
	# чат
	var cy := 70.0
	rr(Rect2(16, 62, 420, 24 + chat.size() * 22), Color(0, 0, 0, 0.32), 10)
	for c in chat:
		var who: String = c[0]
		var by: String = c[0]
		var col := Color("ffd34d") if by == "Система" else (Color("7dffb0") if by == nick else Color("9fd0ff"))
		if by != "":
			draw_string(font_b, Vector2(28, cy + 16), by + ":", HORIZONTAL_ALIGNMENT_LEFT, 150, 15, col)
		draw_string(font, Vector2(30 + font_b.get_string_size(by + ":", HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x + 6, cy + 16), c[1], HORIZONTAL_ALIGNMENT_LEFT, 400 - font_b.get_string_size(by + ":", HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x - 30, 15, Color.WHITE)
		cy += 22.0
	# таблица лидеров
	var rows := [[nick + " (ты)", _progress_n(), int(_my_score()), true]]
	for id in remotes:
		var stv: Dictionary = remotes[id].get("st", {})
		rows.append([remotes[id]["nick"], int(stv.get("cp", 0)), int(stv.get("sc", 0)), false])
	rows.sort_custom(func(a, b): return a[1] > b[1] or (a[1] == b[1] and a[2] > b[2]))
	var shown := rows.slice(0, 12)
	var lx := 1030.0
	if exp_id == "studio":
		lx = 590.0
	rr(Rect2(lx, 12, 234, 34 + shown.size() * 24), Color(0, 0, 0, 0.38), 10)
	draw_string(font_b, Vector2(lx + 12, 34), "Игроки: %d" % rows.size() + ("" if net else " (один)"), HORIZONTAL_ALIGNMENT_LEFT, 140, 15, MUTED)
	draw_string(font_b, Vector2(lx + 124, 34), _score_title(), HORIZONTAL_ALIGNMENT_RIGHT, 98, 15, MUTED)
	for r in shown.size():
		var y := 60.0 + r * 24.0
		var mine: bool = shown[r][3]
		draw_string(font_b if mine else font, Vector2(lx + 12, y), str(shown[r][0]), HORIZONTAL_ALIGNMENT_LEFT, 140, 15, Color("7dffb0") if mine else Color.WHITE)
		draw_string(font_b, Vector2(lx + 124, y), str(shown[r][1] if exp_id in ["obby", "glass", "studio", "mega", "lava", "escape"] else shown[r][2]), HORIZONTAL_ALIGNMENT_RIGHT, 98, 15, GOLD)
	# низ: состояние мира
	var line := ""
	match exp_id:
		"obby", "glass", "mega":
			line = "Этап %d / %d   ·   Падений: %d   ·   Кодобаксы: +%d" % [w.check_n, tr.checks, w.deaths + w.wrong, earned + w.coins * 5]
		"lava":
			line = "Выжил в раундах: %d из 6   ·   сыграно %d" % [int(lava.get("survived", 0)), int(lava.get("played", 0))]
		"escape":
			line = "Замков открыто: %d / 8   ·   ошибок: %d" % [_locks_open(), stage_mist]
		"tycoon":
			line = "💾  %d байт   ·   куплено %d / %d" % [int(ty["cash"]), ty["owned"].size(), L.TYCOON.size()]
		"sim":
			var cap: int = L.PACKS[int(sim["pack"])]["cap"]
			line = "Рюкзак: %d / %d бит   ·   Монеты: %d   ·   %s" % [int(sim["bag"]), cap, int(sim["coins"]), L.PACKS[int(sim["pack"])]["name"]]
		"studio":
			line = "Задание %d / %d   ·   Блоков: %d" % [mini(st_i + 1, st_tasks.size()), st_tasks.size(), st_built.size()]
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
	if net and net_err != "":
		text("Связь с классом: " + net_err, Vector2(640, 630), 14, Color("ff9a9a"), false)
	if exp_id == "studio":
		_draw_studio()
	if chat_menu:
		chat_rects = []
		rr(Rect2(16, 240, 300, 22 + PHRASES.size() * 32), Color(0.05, 0.07, 0.16, 0.94), 12, Color("4fc3ff"), 2)
		for j in PHRASES.size():
			var b := Rect2(24, 250 + j * 32, 284, 28)
			chat_rects.append(b)
			rr(b, Color("26314f") if b.has_point(get_local_mouse_position()) else Color(0, 0, 0, 0), 8)
			draw_string(font, b.position + Vector2(10, 20), ("%d  " % (j + 1) if j < 9 else "    ") + PHRASES[j], HORIZONTAL_ALIGNMENT_LEFT, 270, 16, Color.WHITE)
	if exp_id == "lava":
		_draw_lava()
	if not pz.is_empty():
		_draw_puzzle()
	if not quiz.is_empty():
		_draw_quiz()

func _draw_lava() -> void:
	if lava.get("q", {}).is_empty():
		return
	var ph: Array = L.lava_phase(_lava_now())
	var q: Dictionary = lava["q"]
	var lines := _wrap(str(q["q"]), 50)
	var code: Array = q.get("code", [])
	var r := Rect2(450, 60, 570, 30 + lines.size() * 24 + code.size() * 22 + 64)
	rr(r, Color(0.05, 0.07, 0.16, 0.92), 14, Color("ff7a3a") if ph[1] == "burn" else Color("4fc3ff"), 2)
	var y := 86.0
	for part in lines:
		text(part, Vector2(735, y), 19, INK)
		y += 24.0
	for ln in code:
		draw_string(font_b, Vector2(476, y + 4), str(ln), HORIZONTAL_ALIGNMENT_LEFT, 530, 17, Color("7df9ff"))
		y += 22.0
	var cols := [Color("ff8a8a"), Color("8ab8ff"), Color("8affa0"), Color("ffe08a")]
	for k in 4:
		draw_string(font_b, Vector2(470 + (k % 2) * 280, y + 12 + (k / 2) * 24), "%s) %s" % ["ABCD"[k], q["opts"][k]], HORIZONTAL_ALIGNMENT_LEFT, 270, 15, cols[k])
	var big: String = {"pick": "Выбери плитку: %d" % int(ceil(ph[2])), "burn": "ЛАВА!", "rest": "Новый вопрос через %d" % int(ceil(ph[2]))}[ph[1]]
	text(big, Vector2(735, r.end.y + 26), 30, Color("ff9a5a") if ph[1] != "rest" else Color("9fe8ff"))
	if not lava["alive"] and ph[1] != "pick":
		text("Ты на трибуне — в следующем раунде снова в игре", Vector2(735, r.end.y + 60), 18, MUTED)

func _my_score() -> String:
	match exp_id:
		"tycoon":
			return str(int(ty["cash"]))
		"sim":
			return str(int(sim["coins"]))
		"studio":
			return str(st_i)
		"lava":
			return str(int(lava.get("survived", 0)))
		"escape":
			return str(_locks_open())
	return str(w.check_n)

func _locks_open() -> int:
	var n := 0
	for p in w.parts:
		if p["k"] == "wall" and p.has("lock") and p.get("open", false):
			n += 1
	return n

func _score_title() -> String:
	return {"obby": "Этап", "glass": "Этап", "tycoon": "Байты", "sim": "Монеты", "studio": "Задания", "mega": "Этап", "lava": "Выжил", "escape": "Замки"}[exp_id]

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
		text("Миры класса" + (" %s" % who["className"] if net else ""), Vector2(370, 40), 26, Color.WHITE)
		for j in EXP.size():
			var ex: Dictionary = EXP[j]
			var c := Rect2(232 + (j % 4) * 258, 66 + (j / 4) * 294, 248, 284)
			var hov := c.has_point(get_local_mouse_position())
			rr(c.grow(3 if hov else 0), Color("1c2440"), 14, Color("4fc3ff") if hov else Color(0, 0, 0, 0), 2)
			var th: Texture2D = thumbs[j]
			if th:
				draw_texture_rect_region(th, Rect2(c.position + Vector2(7, 7), Vector2(234, 132)), Rect2(0, 46, 224, 126))
			var ty0 := c.position.y + 162
			draw_string(font_b, Vector2(c.position.x + 10, ty0), str(ex["title"]), HORIZONTAL_ALIGNMENT_LEFT, 230, 16, Color.WHITE)
			ty0 += 22.0
			for part in _wrap(str(ex["about"]), 30):
				draw_string(font, Vector2(c.position.x + 10, ty0), part, HORIZONTAL_ALIGNMENT_LEFT, 230, 13, MUTED)
				ty0 += 17.0
			var n_on := int(online.get(ex["id"], 0))
			draw_string(font_b, Vector2(c.position.x + 10, c.position.y + 250), ("● в мире: %d" % n_on) if net else "● играешь один", HORIZONTAL_ALIGNMENT_LEFT, 150, 13, Color("7dffb0") if n_on > 0 else MUTED)
			var st: int = int(done_stars.get(j + 1, 0))
			draw_string(font_b, Vector2(c.position.x + 150, c.position.y + 252), "★".repeat(st) + "☆".repeat(3 - st), HORIZONTAL_ALIGNMENT_LEFT, 90, 18, GOLD)
			ui_rects.append([c, "play:%d" % (j + 1)])
		var foot := ("Одноклассники из %s — в тех же мирах. " % who["className"]) if net else "Чтобы играть с классом, открой «Кодоблокс» из практикума. "
		draw_string(font, Vector2(238, 676), foot + "WASD — ход, пробел — прыжок, мышь — камера, T — чат. Кодобаксы — на облик во вкладке «Аватар».", HORIZONTAL_ALIGNMENT_LEFT, 1030, 13, INK)
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
	if net and state == "intro":
		net_t -= delta
		if net_t <= 0.0:
			net_t = 3.0
			var on = JSON.parse_string(str(JavaScriptBridge.eval("JSON.stringify(bxNet.online||{})")))
			if on is Dictionary:
				online = on
			JavaScriptBridge.eval("bxNet.who(%s)" % JSON.stringify(who["className"]))
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
		d.merge({"pos": [w.pos.x, w.pos.y, w.pos.z], "check": w.check_n, "deaths": w.deaths, "wrong": w.wrong, "auto": auto, "net": net, "joined": joined, "nick": nick,
			"remotes": remotes.values().map(func(r): return r["nick"]), "chat": chat.map(func(c): return "%s: %s" % c), "plot": my_plot})
		if exp_id == "lava" and not lava.get("q", {}).is_empty():
			d["lava_q"] = lava["q"]["q"]
			d["lava_round"] = lava["round"]
		if exp_id == "studio":
			d["task"] = st_i
			d["built"] = st_built.size()
			d["st_ok"] = st_ok
			d["st_msg"] = st_msg
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
