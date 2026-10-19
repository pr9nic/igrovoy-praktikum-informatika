extends SceneTree
# Проверка правил аркад. Запуск: godot --headless --path godot/workshop --script res://tests/arcade.gd
const Logic = preload("res://arcade/logic.gd")
const Fmt = preload("res://arcade/fmt.gd")
const L2 = preload("res://arcade/logic2.gd")
var bad := 0

func check(name: String, ok: bool, info: String = "") -> void:
	print("%s  %s%s" % ["ok  " if ok else "FAIL", name, (" — " + info) if info != "" else ""])
	if not ok:
		bad += 1

func parse_label(label: String) -> int:
	# Независимый разбор надписи обратно в число — сверка с value.
	var t := label.replace("−", "-")
	for pair in [[" И ", "&"], [" ИЛИ ", "|"], [" ⊕ ", "^"], [" << ", "<"]]:
		if t.contains(pair[0]):
			var p := t.split(pair[0])
			var a := int(p[0]); var b := int(p[1])
			match pair[1]:
				"&": return a & b
				"|": return a | b
				"^": return a ^ b
			return a << b
	if t.begins_with("НЕ "):
		return 255 - int(t.substr(3))
	if t.ends_with("₁₆"):
		return t.trim_suffix("₁₆").hex_to_int()
	if t.ends_with("₈"):
		var v := 0
		for ch in t.trim_suffix("₈"):
			v = v * 8 + int(ch)
		return v
	if t.ends_with("₂"):
		return t.trim_suffix("₂").bin_to_int()
	if t.begins_with("-"):
		return 256 + int(t)
	if t.begins_with("2") and t.length() > 1 and Fmt.SUP.has(t[1]):
		var k := 0
		for ch in t.substr(1):
			k = k * 10 + Fmt.SUP.find(ch)
		return 1 << k
	for unit in [[" Кбайт", 8192], [" байта", 8], [" байт", 8], [" бита", 1], [" бит", 1]]:
		if t.ends_with(unit[0]):
			return int(t.trim_suffix(unit[0])) * unit[1]
	return int(t)

func _init() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 20261012
	check("двоичная, восьмеричная, шестнадцатеричная запись", Fmt.bin(45) == "101101" and Fmt.oct(45) == "55" and Fmt.hex(255) == "FF" and Fmt.sup(12) == "¹²")
	check("склонение: 1 бит, 2 бита, 5 бит, 11 бит, 21 байт, 22 байта", Fmt.bits(1) == "1 бит" and Fmt.bits(2) == "2 бита" and Fmt.bits(5) == "5 бит" and Fmt.bits(11) == "11 бит" and Fmt.bytes(21) == "21 байт" and Fmt.bytes(22) == "22 байта")
	for grade in [6, 7, 8, 9, 10, 11]:
		var ok := true
		var sample := ""
		for i in 600:
			var t := Logic.target(grade, rng)
			if t["value"] < 1 or t["value"] >= (1 << Logic.BITS[grade]) or parse_label(t["label"]) != t["value"]:
				ok = false
				sample = "%s → %d" % [t["label"], t["value"]]
			elif i < 3:
				sample += t["label"] + " = " + Fmt.bin(t["value"]) + "; "
		check("%d класс, десант: надпись совпадает с числом и помещается в биты" % grade, ok, sample)
		ok = true
		sample = ""
		for i in 600:
			var taken := []
			var foods := []
			for j in 4:
				var f := Logic.food(grade, rng, taken)
				taken.append(f["value"])
				foods.append(f)
				if parse_label(f["label"]) != f["value"]:
					ok = false
					sample = "%s → %d" % [f["label"], f["value"]]
			var s := Logic.smallest(foods)
			for f in foods:
				if f["value"] < foods[s]["value"]:
					ok = false
			if i == 0:
				for f in foods:
					sample += f["label"] + " | "
		check("%d класс, змейка: значения разные, надписи верны, наименьшее находится" % grade, ok, sample)
		var labels := ""
		for k in [0, 3, 6, 10]:
			labels += " ".join(Logic.tile_label(grade, k)) + " | "
		check("%d класс, 2048: подписи плиток" % grade, Logic.tile_label(grade, 5)[0] != Logic.tile_label(grade, 10)[0], labels)
	check("биты → число", Logic.bits_value([true, false, true, false]) == 10 and Logic.bits_value([false, false, false, true]) == 1)
	check("линия: 2 2 4 . → 4 4 . .", Logic.slide_line([1, 1, 2, 0])["line"] == [2, 2, 0, 0] and Logic.slide_line([1, 1, 2, 0])["gained"] == 2)
	check("линия: 2 2 2 2 → 4 4 . . (каждая плитка сливается один раз)", Logic.slide_line([1, 1, 1, 1])["line"] == [2, 2, 0, 0])
	check("линия: 4 2 2 . → 4 4 . . без цепного слияния", Logic.slide_line([2, 1, 1, 0])["line"] == [2, 2, 0, 0])
	var g := [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0]
	check("поле: сдвиг вправо", Logic.slide(g, 1)["grid"] == [0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2])
	check("поле: сдвиг вниз", Logic.slide(g, 3)["grid"] == [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1])
	check("поле: сдвиг вверх ничего не теряет", Logic.slide(g, 2)["grid"] == [1, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
	var full := [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1]
	check("поле без ходов распознаётся", not Logic.can_move(full) and Logic.can_move(g))
	# --- «Сеть» ---
	check("поворот кабеля: вверх → вправо → вниз → влево → вверх", L2.rot(1) == 2 and L2.rot(8) == 1 and L2.rot(5) == 10 and L2.rot(3, 4) == 3)
	var net_ok := true
	for grade in [6, 8, 10]:
		for i in 60:
			var n: int = L2.NET_SIZE[grade]
			var net := L2.net_make(n, rng)
			var cables := 0
			for m in net["solved"]:
				for bit in [1, 2, 4, 8]:
					if m & bit:
						cables += 1
			if not L2.net_solved(n, net["solved"], net["server"]) or L2.net_solved(n, net["masks"], net["server"]) or cables != 2 * (n * n - 1):
				net_ok = false
			for c in n * n:
				var same := false
				for t in 4:
					if L2.rot(net["masks"][c], t) == net["solved"][c]:
						same = true
				if not same:
					net_ok = false
	check("сеть: решение — дерево из всех клеток, поле перемешано поворотами и не решено заранее", net_ok)
	# --- «Курьер» ---
	var route_ok := true
	var info := ""
	var sizes := ""
	for stage in range(1, L2.ROUTE_STAGES + 1):
		for grade in [6, 8, 11]:
			for i in 25:
				var gr := L2.route_make(grade, rng, stage)
				var best := L2.route_best(gr)
				# Независимая проверка: расстояния методом Беллмана — Форда по списку дорог.
				var legs := [[gr["start"], gr["goal"]]] if gr["via"] < 0 else [[gr["start"], gr["via"]], [gr["via"], gr["goal"]]]
				var total := 0
				for leg in legs:
					var dist := []
					for k in gr["nodes"].size():
						dist.append(1 << 30)
					dist[leg[0]] = 0
					for pass_n in gr["nodes"].size():
						for e in gr["edges"]:
							if dist[e[0]] + e[2] < dist[e[1]]:
								dist[e[1]] = dist[e[0]] + e[2]
							if e[3] == 0 and dist[e[1]] + e[2] < dist[e[0]]:
								dist[e[0]] = dist[e[1]] + e[2]
					total += dist[leg[1]]
				var sh := L2.route_shape(grade, stage)
				var bad_one: bool = best["cost"] != total or L2.route_cost(gr, best["path"]) != best["cost"] or best["path"][0] != gr["start"] or best["path"][-1] != gr["goal"]
				if gr["via"] < 0 and (L2.route_greedy(gr) == best["cost"] or (stage >= 3 and L2.route_fewest(gr) == best["cost"])):
					bad_one = true
				if sh["via"] != (gr["via"] >= 0) or (sh["oneway"] == 0.0 and gr["edges"].any(func(e): return e[3] == 1)) or (gr["via"] >= 0 and not best["path"].has(gr["via"])):
					bad_one = true
				if bad_one:
					route_ok = false
					info = "этап %d, класс %d: Дейкстра %d, проверка %d" % [stage, grade, best["cost"], total]
				if grade == 8 and i == 0 and stage in [1, 5, 9, 13, 16]:
					sizes += "этап %d: %d перекрёстков, %d дорог, односторонних %d%s; " % [stage, gr["nodes"].size(), gr["edges"].size(), gr["edges"].filter(func(e): return e[3] == 1).size(), ", с посылкой" if gr["via"] >= 0 else ""]
	check("курьер: 16 этапов, кратчайший путь сходится с независимой проверкой, простые стратегии не оптимальны", route_ok, info if info != "" else sizes)
	# --- «Проводник» ---
	check("маски: ? и *", L2.mask_match("?о*.d*", "закат.docx") == false and L2.mask_match("?а*.d*", "закат.docx") and L2.mask_match("?а*.d*", "задача.docx") and L2.mask_match("*.txt", "a.txt") and not L2.mask_match("*.txt", "a.txt2") and L2.mask_match("д?клад.*", "доклад.txt") and not L2.mask_match("д?клад.*", "дклад.txt") and L2.mask_match("*", "") and not L2.mask_match("?", ""))
	var fs_ok := true
	var fs_info := ""
	for grade in [6, 8, 10]:
		for i in 150:
			var nodes := L2.fs_make(rng)
			var t := L2.fs_task(grade, nodes, rng)
			if not nodes[t["dir"]]["files"].has(t["file"]):
				fs_ok = false
			# Независимо проходим путь из задания и смотрим, куда он приводит.
			var parts: PackedStringArray = t["text"].split("\\")
			var at: int = t["start"]
			var last := parts[parts.size() - 1]
			for k in parts.size() - 1:
				if parts[k] == "C:":
					at = 0
				elif parts[k] == "..":
					at = nodes[at]["parent"]
				else:
					var found := -1
					for d in nodes[at]["dirs"]:
						if nodes[d]["name"] == parts[k]:
							found = d
					at = found
				if at < 0:
					break
			var hits := []
			if at >= 0:
				for f in nodes[at]["files"]:
					if L2.mask_match(last, f):
						hits.append(f)
			if at != t["dir"] or hits != [t["file"]]:
				fs_ok = false
				fs_info = "%s → %s" % [t["text"], str(hits)]
			if i == 0:
				fs_info += "%d кл.: %s | " % [grade, t["text"]]
			for id in nodes.size():
				var seen := {}
				for d in nodes[id]["dirs"]:
					if seen.has(nodes[d]["name"]):
						fs_ok = false
					seen[nodes[d]["name"]] = true
	check("проводник: путь из задания приводит ровно к одному нужному файлу", fs_ok, fs_info)
	print("ALL OK" if bad == 0 else "FAILED %d" % bad)
	quit(bad)
