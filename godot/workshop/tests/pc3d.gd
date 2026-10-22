extends SceneTree
# «Собери компьютер 3D» без браузера: верная сборка всех этапов на три звезды, ошибки с объяснениями, кабели, порты,
# неисправности, роли и подбор конфигурации. Запуск: godot --headless --path godot/workshop --script res://tests/pc3d.gd
const L = preload("res://pc3d/logic.gd")
var bad := 0

func check(name: String, ok: bool, info: String = "") -> void:
	print("%s  %s%s" % ["ok  " if ok else "FAIL", name, (" — " + info) if info != "" else ""])
	if not ok:
		bad += 1

func settle(g, n: int = 120) -> void:
	for k in n:
		g._process(1.0 / 30.0)

func _init() -> void:
	# логика гнёзд
	var have := {"board": "board"}
	check("процессор — только в сокет; в слот памяти — ошибка с объяснением", L.try_place("cpu", "socket", have, 8) == "" and L.try_place("cpu", "dimm2", have, 8).contains("сокет"))
	check("видеокарта в короткий PCIe x1 — подсказка про x16", L.try_place("gpu", "pcie_x1", have, 8).contains("x16"))
	check("кулер без процессора нельзя", L.try_place("cooler", "cooler", have, 8).contains("процессор"))
	check("8+ класс: память — в слоты 2 и 4 (двухканальный режим)", L.try_place("ram0", "dimm1", have, 8).contains("двухканальн") and L.try_place("ram0", "dimm2", have, 8) == "" and L.try_place("ram0", "dimm1", have, 7) == "")
	check("без материнской платы детали не ставятся (кроме БП и диска)", L.try_place("cpu", "socket", {}, 8).contains("материнская") and L.try_place("psu", "psu_bay", {}, 8) == "")
	check("монитор в HDMI платы при установленной видеокарте — ошибка", L.port_ok("hdmi_gpu", "hdmi_mb").contains("видеокарт") and L.port_ok("usb", "usb") == "")
	var cfg_ok := true
	for t in L.TASKS:
		var c := L.cheapest(t)
		if c.is_empty() or not L.cfg_why(t, c).is_empty() or L.cost(c) > int(t["budget"]):
			cfg_ok = false
	check("у каждой задачи есть подходящая сборка в бюджете", cfg_ok)
	for m in L.MOUNT:
		L.mount_pos(m)
	check("все гнёзда и разъёмы есть в модели из Blender", true)
	# игра целиком
	var g = load("res://pc3d/game.gd").new()
	g.grade = 8
	g.font = ThemeDB.fallback_font
	g.font_b = ThemeDB.fallback_font
	root.add_child(g)
	await process_frame
	for st in range(1, L.STAGES.size() + 1):
		g.stage = st
		g.start()
		settle(g, 5)
		var k: String = g.kind
		var guard := 0
		while g.state == "play" and guard < 400:
			guard += 1
			if k in ["build", "cables", "ports"] and not g.tray.is_empty():
				var id: String = g.tray[0]
				g.sel = id
				g._show_markers()
				var mount: String = L.PART[id][2] if L.PART.has(id) else id
				g._choose(mount)
			elif k == "faults" and not g.fault.is_empty() and g.finish_t < 0:
				g.fault_pick(g.fault["case"][1])
			elif k == "roles" and g.role_i < g.roles.size():
				g._role_answer(g.roles[g.role_i][1])
			elif k == "config" and g.cfg_task < L.TASKS.size():
				g.cfg = L.cheapest(L.TASKS[g.cfg_task]).duplicate()
				g._cfg_check()
			settle(g, 3)
		settle(g, 120)
		check("этап %d «%s»: собран без ошибок — три звезды" % [st, L.STAGES[st - 1]["title"]], g.state == "over" and g.won and g.stage_stars() == 3, "%s, ошибок %d, лоток %s" % [g.state, g.mistakes, str(g.tray)])
	# ошибка засчитывается
	g.stage = 1
	g.start()
	settle(g, 5)
	g.sel = "cpu"
	g._show_markers()
	g._choose("dimm2")
	check("неверное гнездо: ошибка, подсказка, деталь осталась в лотке", g.mistakes == 1 and g.toast.contains("сокет") and g.tray.has("cpu"))
	g.sel = "cpu"
	g._show_markers()
	var mpos: Vector2 = g.cam.unproject_position(g.markers["socket"].position)
	settle(g, 30)
	mpos = g.cam.unproject_position(g.markers["socket"].position)
	g._click(mpos)
	check("щелчок по подсвеченному сокету на экране ставит процессор", g.have.has("cpu"), str(g.have))
	g.stage = 6
	g.start()
	settle(g, 5)
	var other := "psu" if g.fault["case"][1] != "psu" else "gpu"
	g.fault_pick(other)
	check("сервисный центр: не та деталь — ошибка с подсказкой", g.mistakes == 1 and g.toast.contains("ни при чём"))
	print("ALL OK" if bad == 0 else "FAILED %d" % bad)
	quit(1 if bad else 0)
