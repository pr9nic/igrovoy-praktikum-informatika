extends SceneTree
# Проверка «Клеток памяти»: куски проходимы, зоны собираются, вопросы корректны.
# Запуск: godot --headless --path godot/workshop --script res://tests/cells.gd
const Gen = preload("res://cells/gen.gd")
const Q = preload("res://cells/questions.gd")
var bad := 0

func check(name: String, ok: bool, info: String = "") -> void:
	print("%s  %s%s" % ["ok  " if ok else "FAIL", name, (" — " + info) if info != "" else ""])
	if not ok:
		bad += 1

func _init() -> void:
	for name in Gen.CHUNKS:
		var rows := Gen.chunk_rows(name)
		var ok := rows.size() == Gen.H
		for r in rows:
			if r.length() != Gen.W:
				ok = false
		ok = ok and Gen.standable(rows, 0, Gen.GROUND - 1) and Gen.standable(rows, 1, Gen.GROUND - 1) and Gen.standable(rows, Gen.W - 1, Gen.GROUND - 1) and Gen.standable(rows, Gen.W - 2, Gen.GROUND - 1)
		var b := Gen.build([name])
		for t in b["things"]:
			if Gen.solid(b["rows"], t["x"], t["y"]):
				ok = false
			if t["kind"] in ["s", "g", "T", "D", "h", "C", "J"] and not Gen.solid(b["rows"], t["x"], t["y"] + 1):
				ok = false
			if not t["kind"] in ["s", "f", "g", "t", "T", "D", "c", "h", "C", "J"]:
				ok = false
		check("кусок «%s»: размеры, вход и выход на земле, объекты не в камне, проходим" % name, ok and Gen.reachable(rows))
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var all_ok := true
	var info := ""
	for zone in Gen.ZONES.size():
		for i in 80:
			var names := Gen.plan(zone, rng)
			var b := Gen.build(names)
			var terms := 0
			var doors := 0
			var chests := 0
			for t in b["things"]:
				if t["kind"] == "T":
					terms += 1
				if t["kind"] == "D":
					doors += 1
				if t["kind"] == "C":
					chests += 1
			if chests < 1 or terms != 3 or doors != (0 if zone == Gen.ZONES.size() - 1 else 1) or (zone == Gen.ZONES.size() - 1 and names.slice(-2) != ["arena", "arena"]) or not Gen.reachable(b["rows"]) or b["rows"][0].length() != b["w"]:
				all_ok = false
				info = "зона %d: %s" % [zone + 1, str(names)]
		info += "" if not all_ok else ""
	check("400 случайных зон: три терминала, сундук с оружием, выход (в пятой — арена), проход от начала до конца есть", all_ok, info)
	for grade in ["6", "7", "8", "9", "10", "11"]:
		var qs: Array = Q.DATA[grade]
		var ok := qs.size() >= 20
		var longest := 0
		for q in qs:
			if q["w"].size() != 2 or q["w"].has(q["a"]) or q["w"][0] == q["w"][1] or q["q"] == "" or q["a"] == "":
				ok = false
			longest = maxi(longest, q["q"].length())
		check("%s класс: вопросов %d, у каждого один верный и два разных неверных ответа" % [grade, qs.size()], ok, "самый длинный вопрос — %d знаков" % longest)
		var made_ok := true
		var sample := ""
		for i in 600:
			var q := Gen.made_question(int(grade), rng)
			if q["w"].size() != 2 or q["w"].has(q["a"]) or q["w"][0] == q["w"][1] or q["q"].length() > 60:
				made_ok = false
				sample = str(q)
			elif i < 2:
				sample += "%s → %s (не %s, %s); " % [q["q"], q["a"], q["w"][0], q["w"][1]]
		check("%s класс: вопросы со случайными числами корректны" % grade, made_ok, sample)
	print("ALL OK" if bad == 0 else "FAILED %d" % bad)
	quit(bad)
