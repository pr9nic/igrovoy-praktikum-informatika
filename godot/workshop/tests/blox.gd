extends SceneTree
# «Кодоблокс» без браузера: автопилот проходит оба обби на настоящей физике мира, цены тайкуна и продажа битов
# считаются верно, все четыре мира запускаются, тайкун и симулятор доигрываются до победы.
# Запуск: godot --headless --path godot/workshop --script res://tests/blox.gd
const L = preload("res://blox/logic.gd")
var bad := 0

func check(name: String, ok: bool, info: String = "") -> void:
	print("%s  %s%s" % ["ok  " if ok else "FAIL", name, (" — " + info) if info != "" else ""])
	if not ok:
		bad += 1

func run_obby(kind: String, grade: int, seed: int) -> Dictionary:
	var tr = L.obby(kind, grade, seed)
	var w = tr.w
	w.pos = w.spawn
	var st := {"i": 0}
	var steps := 0
	var cp_route := {}
	for j in tr.route.size():
		if tr.route[j].has("cp"):
			cp_route[int(tr.route[j]["cp"])] = j
	while steps < 60 * 300 and not w.won:
		var r: Array = L.autopilot(tr, st)
		for e in w.step(1.0 / 60.0, r[0], r[1]):
			if e["e"] == "die":
				st["i"] = cp_route.get(w.check_n, 0)
		steps += 1
	return {"won": w.won, "deaths": w.deaths, "wrong": w.wrong, "t": steps / 60.0, "i": st["i"], "n": tr.route.size(), "pos": w.pos, "checks": w.check_n}

func _init() -> void:
	# 1. Обби проходимы: автопилот доходит до финиша на той же физике, что и игрок.
	for kind in ["obby", "glass"]:
		for grade in [6, 8, 11]:
			for seed in [1, 2, 3]:
				var r := run_obby(kind, grade, seed * 37 + grade)
				check("%s, %d класс, карта %d: автопилот дошёл до финиша" % [kind, grade, seed], r["won"] and r["deaths"] <= 8 and r["wrong"] == 0,
					"падений %d, неверных плиток %d, %.0f с, точка %d/%d, чекпоинт %d, %s" % [r["deaths"], r["wrong"], r["t"], r["i"], r["n"], r["checks"], str(r["pos"])])
	# 2. Мост из битов: плитки соответствуют двоичной записи, неверная лопается и считается ошибкой.
	var tr = L.obby("obby", 8, 5)
	var w = tr.w
	var q: Dictionary = {}
	for x in tr.quiz:
		if x.has("bits"):
			q = x
	var oks := []
	var bad_i := -1
	for i in w.parts.size():
		if w.parts[i]["k"] == "glass":
			if w.parts[i]["ok"]:
				oks.append(int(w.parts[i]["text"]))
			elif bad_i < 0:
				bad_i = i
	check("плитки моста — двоичная запись числа %d" % int(q.get("n", -1)), oks == q.get("bits", []), "%s / %s" % [str(oks), str(q.get("bits"))])
	w.pos = w.c_top(bad_i) + Vector3(0, 0.05, 0)
	w.vel = Vector3.ZERO
	var evs := []
	for k in 3:
		evs += w.step(1.0 / 60.0, Vector2.ZERO, false)
	check("неверная плитка лопается и считается ошибкой", w.parts[bad_i]["broken"] and w.wrong == 1 and evs.any(func(e): return e["e"] == "glass"))
	# 3. Двери: за верной — пол, за неверными — лава.
	var dq: Dictionary = tr.quiz[0]
	check("у дверей три разных ответа и один верный", (dq["opts"] as Array).size() == 3 and int(dq["right"]) >= 0 and dq["opts"][0] != dq["opts"][1] and dq["opts"][1] != dq["opts"][2], str(dq))
	# 4. Цены тайкуна в разных записях переводятся обратно в байты.
	var rng := RandomNumberGenerator.new()
	var ok_p := true
	var info := ""
	for grade in [6, 7, 8, 9, 10, 11]:
		for it in L.TYCOON:
			for k in 6:
				var v: int = it["price"]
				var s := L.price_text(v, grade, rng)
				var back := -1
				if s.ends_with(" бит"):
					back = int(s.split(" ")[0]) / 8
				elif s.begins_with("2^"):
					back = 1 << int(s.substr(2).split(" ")[0])
				elif s.begins_with("0b"):
					back = s.substr(2).split(" ")[0].bin_to_int()
				elif s.begins_with("0x"):
					back = s.substr(2).split(" ")[0].hex_to_int()
				elif s.ends_with("Кбайт"):
					back = int(round(float(s.split(" ")[0].replace(",", ".")) * 1024.0))
				if back != v or (grade < 9 and s.begins_with("0x")) or (grade < 7 and s.begins_with("0b")):
					ok_p = false
					info = "%d класс: %s ≠ %d" % [grade, s, v]
				var pq := L.price_quiz(v, s, rng)
				if pq["opts"][int(pq["right"])] != str(v) or (pq["opts"] as Array).size() != 3:
					ok_p = false
					info = "вопрос о цене %s" % str(pq)
	check("цены тайкуна (биты, 2^n, 0b, 0x, Кбайт) по классам и вопрос о цене", ok_p, info)
	check("апгрейдеры: (4 << 1 + 8) << 1 = 32", L.cube_value(4, {"shl": true, "add8": true, "shl2": true}) == 32 and L.cube_value(4, {}) == 4)
	# 5. Продажа битов: верный ответ — число байтов (или Кбайт).
	var ok_s := true
	for bits_n in [64, 72, 512, 4096, 16384, 8192 * 8]:
		var sq := L.sell_quiz(bits_n, rng)
		var right := str(bits_n / 8) if not (bits_n / 8 >= 1024 and (bits_n / 8) % 1024 == 0) else str(bits_n / 8192)
		if sq["opts"][int(sq["right"])] != right or (sq["opts"] as Array).size() != 3:
			ok_s = false
			info = str(sq)
	check("продажа: биты → байты, большие объёмы → Кбайт", ok_s, info)
	# 6. Игра целиком: все миры запускаются; тайкун и симулятор доигрываются.
	var g = load("res://blox/game.gd").new()
	g.grade = 8
	g.font = ThemeDB.fallback_font
	g.font_b = ThemeDB.fallback_font
	root.add_child(g)
	await process_frame
	for st in [1, 2, 3, 4]:
		g.stage = st
		g.start()
		for k in 30:
			g.tick(1.0 / 30.0)
		check("мир %d (%s) запускается: герой стоит, боты бегают" % [st, g.exp_id], g.state == "play" and g.w.on_floor and g.bots.size() >= 3, str(g.w.pos))
	# тайкун
	g.stage = 2
	g.start()
	g._ty_pad(g.ty["pads"]["claim"])
	var guard := 0
	while g.state == "play" and guard < 4000:
		guard += 1
		g.ty["cash"] = int(g.ty["cash"]) + 400
		for id in g.ty["pads"].keys():
			if id != "claim" and not g.ty["owned"].has(id):
				g._ty_pad(g.ty["pads"][id])
				if not g.quiz.is_empty():
					g._answer(int(g.quiz["right"]))
				break
		g.tick(1.0 / 30.0)
	check("тайкун: участок, все покупки после вопросов о цене, суперсервер — победа", g.state == "over" and g.won and g.ty["owned"].size() == L.TYCOON.size() and g.stage_stars() == 3, "%s %s" % [g.state, str(g.ty["owned"].keys())])
	# симулятор
	g.stage = 3
	g.start()
	guard = 0
	while g.state == "play" and guard < 6000:
		guard += 1
		g.sim["bag"] = L.PACKS[int(g.sim["pack"])]["cap"]
		for i in g.w.parts.size():
			var p: Dictionary = g.w.parts[i]
			if p.get("id", "") == "sell":
				g._sim_event(i)
				if not g.quiz.is_empty():
					g._answer(int(g.quiz["right"]))
		for i in g.w.parts.size():
			var p2: Dictionary = g.w.parts[i]
			if str(p2.get("id", "")) == "pack%d" % (int(g.sim["pack"]) + 1):
				g._sim_event(i)
		g.tick(1.0 / 30.0)
	check("симулятор: продажа с вопросами, рюкзаки по порядку, легендарный — победа", g.state == "over" and int(g.sim["pack"]) == L.PACKS.size() - 1, "%s pack %d coins %d" % [g.state, int(g.sim["pack"]), int(g.sim["coins"])])
	var walls_open := true
	for p3 in g.w.parts:
		if p3["k"] == "wall" and not p3.get("open", false):
			walls_open = false
	check("вместительный рюкзак открывает стены зон", walls_open)
	g._home()
	check("Esc/меню возвращает на главную с витриной", g.state == "intro" and g.me != null)
	print("ALL OK" if bad == 0 else "FAILED %d" % bad)
	quit(1 if bad else 0)
