extends "res://arcade/game.gd"
# «Собери компьютер 3D»: модели из Blender (tools/pc3d/model.py), сборка системного блока в 3D, кабели питания,
# подключение периферии к задней панели, сервисный центр (поиск неисправности), роли устройств, подбор конфигурации.
# Логика без графики — pc3d/logic.gd (тест tests/pc3d.gd).

const L = preload("res://pc3d/logic.gd")
const LAY = preload("res://pc3d/layout.gd")
const CENTER := Vector3(0.2, 2.6, 0.0)

var vp: SubViewport
var root3: Node3D
var world3: Node3D
var cam: Camera3D
var scenes := {}
var icons := {}
var nodes := {}               # установленные детали: имя → Node3D
var have := {}                # имя детали → гнездо
var tray: Array = []          # что ещё поставить (детали, кабели или порты)
var sel := ""                 # выбранное в лотке
var markers := {}             # гнездо/разъём → MeshInstance3D
var tray_rects: Array = []
var yaw := PI
var pitch := 0.28
var dist := 10.5
var press_at := Vector2.ZERO
var pressed := false
var dragged := false
var mistakes := 0
var toast := ""
var toast_t := 0.0
var info := ""
var info_t := 0.0
var kind := ""
var fault := {}
var faults: Array = []
var roles: Array = []
var role_i := 0
var role_rects: Array = []
var cfg := {"cpu": -1, "ram": -1, "disk": -1, "gpu": -1}
var cfg_task := 0
var cfg_rects: Array = []
var anims := 0
var finish_t := -1.0
var player := ""
var debug_keys := false

func setup() -> void:
	title = "Собери компьютер 3D"
	stages = L.STAGES.size()
	unit = ""
	show_lives = false
	for n in ["case", "board", "cpu", "cooler", "ram0", "ram1", "gpu", "ssd", "hdd", "psu", "monitor", "keyboard", "mouse"]:
		var p := "res://pc3d/%s.glb" % n
		if ResourceLoader.exists(p):
			scenes[n] = load(p)
		var ip := "res://pc3d/icon_%s.png" % n
		if ResourceLoader.exists(ip):
			icons[n] = load(ip)
	vp = SubViewport.new()
	vp.size = Vector2i(1280, 720)
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	root3 = Node3D.new()
	vp.add_child(root3)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color("0f1426")
	sm.sky_horizon_color = Color("2a3358")
	sm.ground_horizon_color = Color("2a3358")
	sm.ground_bottom_color = Color("0b0e1a")
	sky.sky_material = sm
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color("8fa3c8")
	e.ambient_light_energy = 0.55
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	e.glow_enabled = true
	e.glow_intensity = 0.6
	env.environment = e
	root3.add_child(env)
	# студийный свет: ключевой, заполняющий, контровой
	for l in [[Vector3(-50, -35, 0), 1.6, Color("fff3e0"), true], [Vector3(-20, 60, 0), 0.6, Color("b8d0ff"), false], [Vector3(-35, 160, 0), 0.9, Color("9fd8ff"), false]]:
		var d := DirectionalLight3D.new()
		d.rotation_degrees = l[0]
		d.light_energy = l[1]
		d.light_color = l[2]
		d.shadow_enabled = l[3]
		root3.add_child(d)
	var lamp := OmniLight3D.new()
	lamp.position = Vector3(-1.2, 3.5, 0)
	lamp.light_color = Color("8a7bff")
	lamp.light_energy = 0.8
	lamp.omni_range = 4.0
	root3.add_child(lamp)
	cam = Camera3D.new()
	cam.fov = 45.0
	root3.add_child(cam)
	rules = ["3D-тренажёр: собери настоящий системный блок по деталям.",
		"Выбери деталь в лотке внизу — подсветятся гнёзда. Нажми на гнездо, куда она ставится.",
		"Зажми мышь и веди — поворот камеры, колесо — ближе и дальше.",
		"Нажми на установленную деталь — узнаешь, что она делает. Ошибки снижают звёзды."]

func unlocked() -> int:
	return stages

func goal_text() -> String:
	var s: Dictionary = L.STAGES[stage - 1]
	return "%s: %s" % [s["title"], s["brief"]]

var user_pick := false

func preview() -> void:
	if not user_pick:
		# пока ученик не выбрал этап стрелками — первый этап без звёзд
		stage = 1
		for n in range(1, stages + 1):
			if int(done_stars.get(n, 0)) == 0:
				stage = n
				break
	setup_stage()

func setup_stage() -> void:
	var s: Dictionary = L.STAGES[stage - 1]
	kind = s["kind"]
	if world3:
		world3.queue_free()
	world3 = Node3D.new()
	root3.add_child(world3)
	# стол
	var desk := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(16, 0.2, 9)
	desk.mesh = bm
	var dm := StandardMaterial3D.new()
	dm.albedo_color = Color("3a2c22")
	dm.roughness = 0.6
	desk.material_override = dm
	desk.position = Vector3(-2.0, -0.1, 0)
	world3.add_child(desk)
	nodes = {}
	have = {}
	markers = {}
	sel = ""
	mistakes = 0
	toast = ""
	info = ""
	finish_t = -1.0
	_add("case", _pos("case"))
	for p in s["have"]:
		_add(p, _pos(p))
		have[p] = L.PART[p][2]
	tray = []
	match kind:
		"build", "cables":
			tray = (s["parts"] as Array).duplicate()
		"ports":
			tray = (s["ports"] as Array).duplicate()
			for n in ["monitor", "keyboard", "mouse"]:
				_add(n, _pos(n))
			yaw = -PI / 2
		"faults":
			faults = L.FAULTS.duplicate()
			faults.shuffle()
			faults = faults.slice(0, 4)
			_next_fault()
		"roles":
			roles = L.DEVICES.duplicate()
			roles.shuffle()
			roles = roles.slice(0, 10)
			role_i = 0
			for n in ["monitor", "keyboard", "mouse"]:
				_add(n, _pos(n))
		"config":
			cfg_task = 0
			cfg = {"cpu": -1, "ram": -1, "disk": -1, "gpu": -1}
	if kind != "ports":
		yaw = PI
	pitch = 0.28
	dist = 8.6 if kind != "roles" else 15.0

func reset() -> void:
	pass

func stage_stars() -> int:
	return L.stars(mistakes)

func _pos(n: String) -> Vector3:
	var a: Array = LAY.POS[n]
	return Vector3(a[0], a[1], a[2])

func _add(n: String, at: Vector3) -> Node3D:
	if not scenes.has(n):
		return null
	var node: Node3D = scenes[n].instantiate()
	node.position = at
	world3.add_child(node)
	nodes[n] = node
	return node

# ---------- подсветка гнёзд ----------

func _marker_mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(c.r, c.g, c.b, 0.35)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = 1.2
	m.no_depth_test = true
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return m

func _show_markers() -> void:
	for k in markers:
		markers[k].queue_free()
	markers = {}
	if sel == "":
		return
	var pts := {}
	if L.PART.has(sel):
		# похожие гнёзда: детали платы — гнёзда на плате, крупные — отсеки корпуса
		var group := ["socket", "dimm1", "dimm2", "dimm3", "dimm4", "pcie_x16", "pcie_x1", "m2"]
		if sel in ["hdd", "psu", "board"]:
			group = ["bay", "psu_bay", "board"]
		elif sel == "cooler":
			group = ["cooler", "pcie_x16", "m2"]
		for m in group:
			var taken := false
			for p in have:
				if have[p] == m:
					taken = true
			if not taken:
				pts[m] = L.mount_pos(m)
	elif L.CABLES.has(sel):
		for c in L.CABLES:
			if not have.has("c_" + c):
				pts[c] = _pt(c)
	else:
		for c in ["hdmi_gpu", "hdmi_mb", "usb", "rj45", "audio", "psu_plug"]:
			if not have.has("c_" + c):
				pts[c] = _pt(c)
	for m in pts:
		var mi := MeshInstance3D.new()
		var size := Vector3(0.22, 0.22, 0.22)
		if L.PART.has(sel):
			size = _mount_size(m)
		var bx := BoxMesh.new()
		bx.size = size
		mi.mesh = bx
		mi.material_override = _marker_mat(Color("4fd1ff"))
		mi.position = pts[m]
		world3.add_child(mi)
		markers[m] = mi

func _mount_size(m: String) -> Vector3:
	var S: Dictionary = LAY.SIZE
	var by := {"board": "board", "socket": "cpu", "cooler": "cooler", "dimm1": "ram0", "dimm2": "ram0", "dimm3": "ram0", "dimm4": "ram0", "pcie_x16": "gpu", "pcie_x1": "ram0", "m2": "ssd", "bay": "hdd", "psu_bay": "psu"}
	var a: Array = S[by[m]]
	var v := Vector3(a[0], a[1], a[2])
	if m == "pcie_x1":
		v = Vector3(0.3, 0.12, 0.45)
	if m == "pcie_x16":
		v = Vector3(0.3, 0.14, 0.95)
	if m == "board":
		v = Vector3(0.12, v.y, v.z)
	return v.clamp(Vector3(0.12, 0.12, 0.12), Vector3(5, 5, 5))

func _pt(n: String) -> Vector3:
	var a: Array = LAY.PTS[n]
	return Vector3(a[0], a[1], a[2])

func _screen_rect(center: Vector3, size: Vector3) -> Rect2:
	var r := Rect2(cam.unproject_position(center), Vector2.ZERO)
	for sx in [-0.5, 0.5]:
		for sy in [-0.5, 0.5]:
			for sz in [-0.5, 0.5]:
				r = r.expand(cam.unproject_position(center + Vector3(sx * size.x, sy * size.y, sz * size.z)))
	return r.grow(6)

func _pick_marker(p: Vector2) -> String:
	var best := ""
	var area := 1e12
	for m in markers:
		var mi: MeshInstance3D = markers[m]
		var r := _screen_rect(mi.position, (mi.mesh as BoxMesh).size)
		if r.has_point(p) and r.get_area() < area:
			area = r.get_area()
			best = m
	return best

func _pick_part(p: Vector2) -> String:
	var best := ""
	var area := 1e12
	for n in nodes:
		if n == "case" or not LAY.SIZE.has(n):
			continue
		var a: Array = LAY.SIZE[n]
		var r := _screen_rect((nodes[n] as Node3D).position, Vector3(a[0], a[1], a[2]))
		if r.has_point(p) and r.get_area() < area:
			area = r.get_area()
			best = n
	return best

# ---------- действия ----------

func _choose(m: String) -> void:
	if L.PART.has(sel):
		var why := L.try_place(sel, m, have, grade)
		if why != "":
			_fail(why)
			return
		have[sel] = m
		var node := _add(sel, L.mount_pos(m))
		_fly(node, L.mount_pos(m))
		_say_ok(L.PART[sel][0], L.PART[sel][1])
	elif L.CABLES.has(sel) or L.PORTS.has(sel):
		var why2 := L.port_ok(sel, m)
		if why2 != "":
			_fail(why2)
			return
		have["c_" + m] = true
		_cable(m)
		var t: Array = L.CABLES[sel] if L.CABLES.has(sel) else L.PORTS[sel]
		_say_ok(t[0], t[1])
	tray.erase(sel)
	sel = ""
	_show_markers()
	if kind == "cables" and tray.is_empty() and not have.has("c_atx24"):
		tray = (L.STAGES[stage - 1]["cables"] as Array).duplicate()
	if tray.is_empty():
		finish_t = 1.6

func _fail(why: String) -> void:
	mistakes += 1
	toast = why
	toast_t = 4.0
	sfx.emit("error")
	shake = 0.4

func _say_ok(name: String, text: String) -> void:
	info = "%s — %s" % [name, text]
	info_t = 6.0
	sfx.emit("take")

func _fly(node: Node3D, to: Vector3) -> void:
	if node == null:
		return
	node.position = to + Vector3(-3.0, 1.2, 0.0)
	anims += 1
	var tw := create_tween()
	tw.tween_property(node, "position", to + Vector3(-0.6, 0.15, 0), 0.45).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(node, "position", to, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_callback(_landed)

func _landed() -> void:
	anims -= 1
	sfx.emit("deliver")

func _cable(m: String) -> void:
	# Кабель — гладкая трубка из блока питания (или снаружи для портов) к разъёму.
	var to := _pt(m)
	var from := _pt("psu_out") if L.CABLES.has(m) else to + Vector3(0, -0.8, -3.0)
	if m == "psu_plug":
		from = to + Vector3(-1.5, -0.3, -3.0)
	var col: Color = {"atx24": Color("202226"), "eps8": Color("202226"), "gpu_pwr": Color("202226"), "sata_pwr": Color("202226"), "sata_port": Color("c42030"),
		"hdmi_gpu": Color("15161a"), "usb": Color("2a2c30"), "rj45": Color("2f7fd0"), "audio": Color("3fae5a"), "psu_plug": Color("101010")}.get(m, Color("202226"))
	var mat := StandardMaterial3D.new()
	mat.albedo_color = col
	mat.roughness = 0.45
	var mid := (from + to) / 2.0 + Vector3(-0.7, 0.2, 0)
	var prev := from
	for k in range(1, 17):
		var t := k / 16.0
		var p := from.lerp(mid, t).lerp(mid.lerp(to, t), t)
		var seg := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.045
		cm.bottom_radius = 0.045
		cm.height = prev.distance_to(p) + 0.02
		cm.radial_segments = 8
		seg.mesh = cm
		seg.material_override = mat
		world3.add_child(seg)
		seg.position = (prev + p) / 2.0
		var dir := (p - prev).normalized()
		if dir.length() > 0.0:
			seg.basis = Basis(Quaternion(Vector3.UP, dir))
		prev = p
	var plug := MeshInstance3D.new()
	var pb := BoxMesh.new()
	pb.size = Vector3(0.14, 0.12, 0.12)
	plug.mesh = pb
	plug.material_override = mat
	plug.position = to
	world3.add_child(plug)

func fault_pick(n: String) -> void:
	var bad: String = fault["case"][1]
	if n == bad or (bad.begins_with("ram") and n.begins_with("ram")):
		_say_ok("Верно", fault["case"][2])
		(nodes[bad] as Node3D).position = _pos(bad)
		_next_fault()
	else:
		_fail("%s тут ни при чём. Подумай, какая деталь отвечает за это." % L.PART[n][0])

func _next_fault() -> void:
	# Собранный компьютер с одной неисправностью: деталь выдвинута или кабель не подключён.
	if faults.is_empty():
		finish_t = 1.2
		return
	fault = {"case": faults.pop_front()}
	for n in nodes:
		if n != "case" and L.PART.has(n):
			(nodes[n] as Node3D).position = _pos(n)
	var bad: String = fault["case"][1]
	if nodes.has(bad):
		(nodes[bad] as Node3D).position = _pos(bad) + Vector3(-0.35, 0.2, 0)

func _role_answer(r: String) -> void:
	var dv: Array = roles[role_i]
	if r == dv[1]:
		_say_ok(dv[0].capitalize(), "это устройство «%s»." % L.ROLES[r].to_lower())
	else:
		_fail("%s — устройство «%s», а не «%s»." % [str(dv[0]).capitalize(), L.ROLES[dv[1]].to_lower(), L.ROLES[r].to_lower()])
	role_i += 1
	if role_i >= roles.size():
		finish_t = 1.2

func _cfg_check() -> void:
	for k in cfg:
		if int(cfg[k]) < 0:
			_fail("Выбери все четыре комплектующие.")
			return
	var t: Dictionary = L.TASKS[cfg_task]
	var why := L.cfg_why(t, cfg)
	if not why.is_empty():
		_fail("Не подходит: " + ", ".join(PackedStringArray(why)) + ".")
		return
	var best := L.cost(L.cheapest(t))
	var mine := L.cost(cfg)
	if mine > best:
		mistakes += 1
		_say_ok("Подходит", "стоимость %d тыс. ₽, но можно дешевле: самая выгодная сборка — %d тыс." % [mine, best])
	else:
		_say_ok("Отлично", "самая выгодная подходящая сборка: %d тыс. ₽." % mine)
	cfg_task += 1
	cfg = {"cpu": -1, "ram": -1, "disk": -1, "gpu": -1}
	if cfg_task >= L.TASKS.size():
		finish_t = 1.6

func tick(delta: float) -> void:
	toast_t = maxf(0.0, toast_t - delta)
	info_t = maxf(0.0, info_t - delta)
	if finish_t > 0.0:
		finish_t -= delta
		if finish_t <= 0.0:
			stage_won()
	# камера по орбите
	var off := Vector3(cos(yaw) * cos(pitch), sin(pitch), sin(yaw) * cos(pitch)) * dist
	var tgt := CENTER if kind != "roles" else Vector3(-2.0, 1.8, 0)
	cam.position = cam.position.lerp(tgt + off, minf(1.0, delta * 8.0)) if cam.position.length() > 0.1 else tgt + off
	cam.look_at(tgt)
	for m in markers:
		var mi: MeshInstance3D = markers[m]
		(mi.material_override as StandardMaterial3D).emission_energy_multiplier = 0.8 + 0.6 * sin(time * 5.0)

# ---------- ввод ----------

func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var p: Vector2 = get_global_transform().affine_inverse() * event.position
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			dist = maxf(4.0, dist - 0.6)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			dist = minf(22.0, dist + 0.6)
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				pressed = true
				dragged = false
				press_at = p
				if state != "play":
					super(event)
					return
			else:
				pressed = false
				if state == "play" and not dragged:
					_click(p)
		get_viewport().set_input_as_handled()
		return
	if event is InputEventMouseMotion and pressed and state == "play":
		var p2: Vector2 = get_global_transform().affine_inverse() * event.position
		if p2.distance_to(press_at) > 6.0:
			dragged = true
		if dragged:
			yaw += event.relative.x * 0.008
			pitch = clampf(pitch + event.relative.y * 0.006, -0.3, 1.2)
		get_viewport().set_input_as_handled()
		return
	if event is InputEventKey and event.pressed and state != "play" and event.physical_keycode in [KEY_LEFT, KEY_RIGHT, KEY_A, KEY_D]:
		user_pick = true
	if event is InputEventKey and event.pressed and not event.echo and state == "play":
		var k: int = event.physical_keycode
		if k == KEY_ESCAPE:
			leave.emit()
		elif k >= KEY_1 and k <= KEY_9:
			var i := k - KEY_1
			if kind == "roles" and i < 4:
				_role_answer(L.ROLES.keys()[i])
			elif i < tray.size():
				sel = tray[i]
				_show_markers()
		get_viewport().set_input_as_handled()
		return
	super(event)

func _click(p: Vector2) -> void:
	if p.x < 150 and p.y < 60:
		leave.emit()
		return
	for r in tray_rects:
		if (r[0] as Rect2).has_point(p):
			sel = r[1] if sel != r[1] else ""
			sfx.emit("click")
			_show_markers()
			return
	for r in role_rects:
		if (r[0] as Rect2).has_point(p):
			_role_answer(r[1])
			return
	for r in cfg_rects:
		if (r[0] as Rect2).has_point(p):
			if r[1] == "check":
				_cfg_check()
			else:
				cfg[r[1]] = int(r[2])
				sfx.emit("click")
			return
	if sel != "":
		var m := _pick_marker(p)
		if m != "":
			_choose(m)
		return
	if kind == "faults" and not fault.is_empty():
		var n := _pick_part(p)
		if n != "":
			fault_pick(n)
		return
	var part := _pick_part(p)
	if part != "" and L.PART.has(part):
		_say_ok(L.PART[part][0], L.PART[part][1])

# ---------- рисование ----------

func draw_game() -> void:
	draw_texture_rect(vp.get_texture(), Rect2(0, 0, W, H), false)

func _hud() -> void:
	rr(Rect2(16, 12, 124, 40), Color(0.13, 0.17, 0.3, 0.92), 10)
	text("← Игры", Vector2(78, 31), 16, INK, false)
	if state != "play":
		return
	var s: Dictionary = L.STAGES[stage - 1]
	text("%s · этап %d из %d · ошибок: %d" % [s["title"], stage, stages, mistakes], Vector2(640, 30), 20, INK)
	rr(Rect2(16, 62, 420, 72), Color(0.04, 0.06, 0.14, 0.82), 12)
	var y := 86.0
	for part in _fit(str(s["brief"]) if kind != "faults" else ("Жалоба: " + str(fault.get("case", ["Все компьютеры починены!"])[0])), 16, 395.0):
		draw_string(font, Vector2(30, y), part, HORIZONTAL_ALIGNMENT_LEFT, 400, 16, INK)
		y += 20.0
	text("Зажми мышь — поворот · колесо — масштаб · нажми на деталь — что она делает", Vector2(640, 702), 13, Color(1, 1, 1, 0.7), false)
	tray_rects = []
	role_rects = []
	cfg_rects = []
	match kind:
		"build", "cables", "ports":
			_draw_tray()
		"roles":
			_draw_roles()
		"config":
			_draw_cfg()
	if info_t > 0.0:
		var a := minf(1.0, info_t)
		rr(Rect2(840, 62, 424, 30 + _fit(info, 16, 395.0).size() * 21), Color(0.05, 0.2, 0.14, 0.9 * a), 12, Color(0.4, 0.95, 0.7, a), 2)
		var iy := 86.0
		for part in _fit(info, 16, 395.0):
			draw_string(font_b, Vector2(856, iy), part, HORIZONTAL_ALIGNMENT_LEFT, 400, 16, Color(1, 1, 1, a))
			iy += 21.0
	if toast_t > 0.0:
		var a2 := minf(1.0, toast_t)
		var lines := _fit(toast, 18, 640.0)
		rr(Rect2(300, 150, 680, 24 + lines.size() * 26), Color(0.3, 0.08, 0.1, 0.92 * a2), 14, Color(1, 0.5, 0.5, a2), 2)
		var ty := 174.0
		for part in lines:
			text(part, Vector2(640, ty), 18, Color(1, 1, 1, a2))
			ty += 26.0

func _draw_tray() -> void:
	if tray.is_empty():
		return
	var w := 132.0
	var x0 := 640.0 - tray.size() * w / 2.0
	for i in tray.size():
		var id: String = tray[i]
		var r := Rect2(x0 + i * w + 4, 560, w - 8, 128)
		var on := sel == id
		rr(r, Color(0.16, 0.24, 0.45, 0.95) if on else Color(0.08, 0.1, 0.2, 0.9), 12, Color("4fd1ff") if on else Color(1, 1, 1, 0.12), 3 if on else 1)
		if icons.has(id):
			draw_texture_rect(icons[id], Rect2(r.position + Vector2(18, 4), Vector2(88, 88)), false)
		var name: String = L.PART[id][0] if L.PART.has(id) else (L.CABLES[id][0] if L.CABLES.has(id) else L.PORTS[id][0])
		var lines := _fit(name, 13, w - 16)
		var ly := r.position.y + (98.0 if icons.has(id) else 40.0)
		for part in lines:
			text(part, Vector2(r.get_center().x, ly), 13, INK, icons.has(id))
			ly += 16.0
		draw_string(font_b, r.position + Vector2(8, 18), str(i + 1), HORIZONTAL_ALIGNMENT_LEFT, 20, 14, GOLD)
		tray_rects.append([r, id])

func _draw_roles() -> void:
	if role_i >= roles.size():
		return
	var dv: Array = roles[role_i]
	rr(Rect2(340, 520, 600, 170), Color(0.05, 0.07, 0.16, 0.92), 16, GOLD, 2)
	text("Устройство %d из %d: %s" % [role_i + 1, roles.size(), str(dv[0]).to_upper()], Vector2(640, 552), 24, INK)
	var keys := L.ROLES.keys()
	for j in 4:
		var r := Rect2(362 + j * 142, 590, 132, 70)
		rr(r, Color("223056") if not r.has_point(get_local_mouse_position()) else Color("2f4a86"), 12, Color("4b5f8f"), 2)
		text("%d) %s" % [j + 1, L.ROLES[keys[j]]], r.get_center(), 18, INK)
		role_rects.append([r, keys[j]])

func _draw_cfg() -> void:
	if cfg_task >= L.TASKS.size():
		return
	var t: Dictionary = L.TASKS[cfg_task]
	var r0 := Rect2(300, 150, 680, 520)
	rr(r0, Color(0.05, 0.07, 0.16, 0.94), 16, GOLD, 2)
	text("Задача %d из %d: %s" % [cfg_task + 1, L.TASKS.size(), t["title"]], Vector2(640, 178), 22, GOLD)
	var y := 206.0
	for part in _fit(str(t["text"]), 16, 640.0):
		text(part, Vector2(640, y), 16, INK, false)
		y += 22.0
	y += 8.0
	var names := {"cpu": "Процессор", "ram": "Память", "disk": "Накопитель", "gpu": "Графика"}
	for k in ["cpu", "ram", "disk", "gpu"]:
		draw_string(font_b, Vector2(320, y + 24), names[k], HORIZONTAL_ALIGNMENT_LEFT, 120, 16, MUTED)
		var opts: Array = L.OPTS[k]
		var w := 520.0 / opts.size()
		for j in opts.size():
			var r := Rect2(440 + j * w, y, w - 6, 44)
			var on := int(cfg[k]) == j
			rr(r, Color("2f6bd6") if on else Color("223056"), 10, Color("4fd1ff") if on else Color("4b5f8f"), 2 if on else 1)
			text(str(opts[j][0]), r.get_center() + Vector2(0, -7), 12, INK, true)
			text("%d тыс." % int(opts[j][1]), r.get_center() + Vector2(0, 11), 12, GOLD, false)
			cfg_rects.append([r, k, j])
		y += 56.0
	var ok := true
	for k in cfg:
		if int(cfg[k]) < 0:
			ok = false
	text(("Стоимость: %d тыс. ₽ из %d" % [L.cost(cfg), int(t["budget"])]) if ok else "Выбери все четыре строки", Vector2(640, y + 16), 18, INK)
	var b := Rect2(540, y + 40, 200, 46)
	rr(b, Color("2fae5f"), 12)
	text("Проверить сборку", b.get_center(), 18, Color.WHITE)
	cfg_rects.append([b, "check"])

func debug() -> Dictionary:
	return {"kind": kind, "tray": tray, "have": have.keys(), "mist": mistakes, "sel": sel, "fault": fault.get("case", [""])[1] if not fault.is_empty() else "", "role": role_i, "cfg_task": cfg_task, "anims": anims}
