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
	# 1б. Обби на 40 этапов и Побег проходимы автопилотом (замки он решает по ответам).
	for grade in [6, 9, 11]:
		var mr := run_obby("mega", grade, 7 + grade)
		check("40 этапов, %d класс: автопилот дошёл до финиша" % grade, mr["won"] and mr["checks"] == 40 and mr["deaths"] <= 15, "падений %d, этап %d, %.0f с" % [mr["deaths"], mr["checks"], mr["t"]])
		var et = L.escape(grade, 3 + grade)
		var ew = et.w
		ew.pos = ew.spawn
		var est := {"i": 0}
		var opened := 0
		var bad_ans := 0
		for stp in 60 * 300:
			var rr: Array = L.autopilot(et, est)
			for e in ew.step(1.0 / 60.0, rr[0], rr[1]):
				if e["e"] == "die":
					est["i"] = 0
					for j in et.route.size():
						if et.route[j].has("door") and ew.parts[int(et.route[j]["door"])].get("open", false):
							est["i"] = j + 1
			if est.has("need_lock"):
				var pz: Dictionary = et.quiz[int(est["need_lock"])]
				var n: int = est["need_lock"]
				est.erase("need_lock")
				if L.puzzle_ok(pz, L.puzzle_solve(pz)):
					opened += 1
					for p in ew.parts:
						if p["k"] == "wall" and int(p.get("lock", -1)) == n:
							p["open"] = true
				# неверные ответы замок не открывают
				if str(pz["kind"]) == "bits" and L.puzzle_ok(pz, []):
					bad_ans += 1
				if str(pz["kind"]) == "choice" and L.puzzle_ok(pz, (int(pz["right"]) + 1) % 4):
					bad_ans += 1
			if ew.won:
				break
		check("Побег, %d класс: 8 замков открыты, неверные ответы не открывают, выход найден" % grade, ew.won and opened == 8 and bad_ans == 0, "замков %d, падений %d" % [opened, ew.deaths])
	# 1в. Пол — это лава: раунды по часам, вопрос раунда одинаковый у всех, фазы по времени.
	var lp0: Array = L.lava_phase(1000.0 * L.LAVA_ROUND + 3.0)
	var lp1: Array = L.lava_phase(1000.0 * L.LAVA_ROUND + 15.0)
	var lp2: Array = L.lava_phase(1000.0 * L.LAVA_ROUND + 20.0)
	check("лава: фазы раунда — выбор, лава, итоги", lp0[0] == 1000 and lp0[1] == "pick" and lp1[1] == "burn" and lp2[1] == "rest")
	var qa := L.lava_question(42, 7, 8)
	var qb := L.lava_question(42, 7, 8)
	check("лава: у всех в комнате один и тот же вопрос раунда, 4 ответа", qa["q"] == qb["q"] and qa["opts"] == qb["opts"] and (qa["opts"] as Array).size() == 4 and int(qa["right"]) >= 0)
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
		if w.parts[i]["k"] == "glass" and w.parts[i]["m"] == "glass":
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
	# 2б. Логический мост: в каждом ряду ровно одно истинное выражение (проверяем независимо через Expression).
	var ok_l := true
	var info_l := ""
	var lr := RandomNumberGenerator.new()
	for grade in [6, 8, 9, 11]:
		for k in 60:
			lr.seed = k * 13 + grade
			var vals := {"A": lr.randf() < 0.5, "B": lr.randf() < 0.5, "C": lr.randf() < 0.5}
			var row: Array = L.logic_row(grade, lr, vals)
			var truths := 0
			for e in row:
				var src: String = str(e[0]).replace("не ", "not ").replace(" и ", " and ").replace(" или ", " or ")
				for n in vals:
					src = src.replace(n, "true" if vals[n] else "false")
				var ex := Expression.new()
				ex.parse(src)
				var v = ex.execute()
				if bool(v) != bool(e[1]):
					ok_l = false
					info_l = "%s → %s, а записано %s" % [e[0], str(v), str(e[1])]
				truths += 1 if e[1] else 0
			if row.size() != 3 or truths != 1:
				ok_l = false
				info_l = str(row)
	check("логический мост: значения выражений верны, в ряду ровно одно истинное", ok_l, info_l)
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
	for st in [1, 2, 3, 4, 5, 6, 7, 8]:
		g.stage = st
		g.start()
		for k in 30:
			g.tick(1.0 / 30.0)
		check("мир %d (%s) запускается: герой стоит, ботов нет, без практикума — игра одному" % [st, g.exp_id], g.state == "play" and g.w.on_floor and g.remotes.is_empty() and not g.net, str(g.w.pos))
	# Одноклассники с сервера: появляются, двигаются, исчезают; общие плитки и чат.
	g.stage = 1
	g.start()
	var glass_i := -1
	for i in g.w.parts.size():
		if g.w.parts[i]["k"] == "glass" and not g.w.parts[i]["ok"]:
			glass_i = i
			break
	g._net_apply({"players": [{"id": 7, "nick": "Аня П.", "plot": 1, "st": {"p": [1, 0, 5], "r": 0.3, "a": 1, "cp": 2, "sc": 0, "look": {"shirt": 2, "pants": 1, "face": 3, "hat": 2}}}],
		"chatq": [{"nick": "Аня П.", "text": "Привет!"}], "broken": [glass_i], "count": 2})
	for k in 20:
		g.tick(1.0 / 30.0)
	check("одноклассница видна: герой с её обликом стоит там, где она", g.remotes.has(7) and (g.remotes[7]["node"].position - Vector3(1, 0, 5)).length() < 0.2)
	check("её фраза в чате, плитка, разбитая другим, разбита и у меня", g.chat.any(func(c): return c[1] == "Привет!") and g.w.parts[glass_i]["broken"])
	g._net_apply({"players": [], "chatq": [], "broken": [], "count": 1})
	check("ушла из мира — герой исчез", g.remotes.is_empty())
	# Студия: задания проверяются по набору блоков; лишние/недостающие — ошибка.
	g.stage = 5
	g.start()
	var tasks: Array = g.st_tasks
	g._st_apply([[0, 0, 0]], true, "")
	check("студия: неверная постройка не засчитана", not g.st_ok and g.stage_mist == 1 and g.st_msg.contains("не хватает"), g.st_msg)
	g._st_apply([[9, 9, 9]], false, "строка 2: ошибка")
	check("студия: ошибка программы показана, блоки до ошибки построены", not g.st_ok and g.st_msg.begins_with("Ошибка") and g.st_built.size() == 1)
	var walk_ok := true
	for t in tasks:
		g._st_apply(t["target"], true, "")
		if not g.st_ok:
			walk_ok = false
		g._st_next()
	check("студия: все %d заданий по эталону — мир пройден" % tasks.size(), walk_ok and g.after_t > 0.0, g.st_msg)
	g.stage = 5
	g.start()
	g._st_apply(tasks[3]["target"], true, "")
	check("по построенной пирамиде можно ходить (блоки твёрдые)", g.w.parts[g.st_parts[0]]["k"] == "solid" and g.st_parts.size() == tasks[3]["target"].size())
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
	# Лава в игре: в фазе лавы неверные плитки убивают, верная держит; выживший получает очко.
	g.stage = 7
	g.start()
	var rnd := int(floor(Time.get_unix_time_from_system() / L.LAVA_ROUND))
	g.srv_off = (rnd + 1) * L.LAVA_ROUND + 1.0 - Time.get_unix_time_from_system()      # начало следующего раунда
	g.tick(1.0 / 30.0)
	var lq: Dictionary = g.lava["q"]
	var right_tile: int = g.lava["tiles"][int(lq["right"])]
	g.w.pos = g.w.c_top(right_tile) + Vector3(0, 0.05, 0)
	g.w.refresh_near(true)
	g.srv_off += L.LAVA_PICK
	for k in 10:
		g.tick(1.0 / 30.0)
	var wrong_tile: int = g.lava["tiles"][(int(lq["right"]) + 1) % 4]
	check("лава: в фазе лавы неверные плитки — лава, верная — пол, герой жив", g.w.parts[wrong_tile]["k"] == "kill" and g.w.parts[right_tile]["k"] == "solid" and g.w.deaths == 0)
	g.srv_off += L.LAVA_BURN - L.LAVA_PICK
	for k in 5:
		g.tick(1.0 / 30.0)
	check("лава: выжил в раунде — очко", int(g.lava["survived"]) == 1, str(g.lava["survived"]))
	# Побег в игре: замок открывается верным ответом и не открывается неверным.
	g.stage = 8
	g.start()
	var lock_pad := -1
	for i in g.w.parts.size():
		if g.w.parts[i]["k"] == "pad" and int(g.w.parts[i].get("lock", -1)) == 0:
			lock_pad = i
	g._pz_open(lock_pad)
	var ldoor: int = g.pz["door"]
	g._pz_check([])
	check("побег: неверный код — дверь закрыта, ошибка засчитана", not g.w.parts[ldoor].get("open", false) and g.stage_mist == 1)
	g._pz_check(L.puzzle_solve(g.pz))
	check("побег: верный код — дверь открыта", g.w.parts[ldoor].get("open", false) and g.pz.is_empty())
	print("ALL OK" if bad == 0 else "FAILED %d" % bad)
	quit(1 if bad else 0)
