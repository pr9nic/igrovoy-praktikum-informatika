extends RefCounted
# Правила трёх игр-головоломок без графики: «Сеть», «Курьер», «Проводник». Проверяются tests/arcade.gd.

# ---------- «Сеть»: соедини все компьютеры с сервером ----------
# Маска соединений клетки: 1 вверх, 2 вправо, 4 вниз, 8 влево.

const NET_SIZE := {6: 4, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6}
const SIDE := [[1, Vector2i(0, -1), 4], [2, Vector2i(1, 0), 8], [4, Vector2i(0, 1), 1], [8, Vector2i(-1, 0), 2]]

static func rot(mask: int, times: int = 1) -> int:
	for i in posmod(times, 4):
		mask = ((mask << 1) | (mask >> 3)) & 15
	return mask

static func net_make(n: int, rng: RandomNumberGenerator) -> Dictionary:
	# Случайное остовное дерево (алгоритм Прима): в решении все клетки связаны и нет лишних кабелей.
	var masks := []
	for i in n * n:
		masks.append(0)
	var server := rng.randi() % (n * n)
	var inside := {server: true}
	var frontier := []
	var add_edges := func(cell: int) -> void:
		var p := Vector2i(cell % n, cell / n)
		for s in SIDE:
			var q: Vector2i = p + s[1]
			if q.x >= 0 and q.y >= 0 and q.x < n and q.y < n:
				frontier.append([cell, q.y * n + q.x, s[0], s[2]])
	add_edges.call(server)
	while not frontier.is_empty():
		var e: Array = frontier.pop_at(rng.randi() % frontier.size())
		if inside.has(e[1]):
			continue
		inside[e[1]] = true
		masks[e[0]] |= e[2]
		masks[e[1]] |= e[3]
		add_edges.call(e[1])
	var solved := masks.duplicate()
	for attempt in 20:
		for i in n * n:
			masks[i] = rot(solved[i], rng.randi() % 4)
		if not net_solved(n, masks, server):
			break
	return {"n": n, "masks": masks, "solved": solved, "server": server}

static func net_lit(n: int, masks: Array, server: int) -> Array:
	# Клетки, до которых доходит сигнал сервера: кабель должен стыковаться с обеих сторон.
	var lit := []
	for i in n * n:
		lit.append(false)
	lit[server] = true
	var queue := [server]
	while not queue.is_empty():
		var cell: int = queue.pop_back()
		var p := Vector2i(cell % n, cell / n)
		for s in SIDE:
			var q: Vector2i = p + s[1]
			if (masks[cell] & s[0]) == 0 or q.x < 0 or q.y < 0 or q.x >= n or q.y >= n:
				continue
			var other := q.y * n + q.x
			if (masks[other] & s[2]) != 0 and not lit[other]:
				lit[other] = true
				queue.append(other)
	return lit

static func net_solved(n: int, masks: Array, server: int) -> bool:
	return not net_lit(n, masks, server).has(false)

# ---------- «Курьер»: кратчайший путь в графе ----------
# Ребро: [a, b, длина, направление]; направление 0 — дорога в обе стороны, 1 — только из a в b.
# Сложность растёт с этапом: больше перекрёстков и диагоналей, длиннее дороги, потом улицы с односторонним
# движением, а на последних этапах по пути нужно забрать посылку (поле via).

const ROUTE_STAGES := 16

static func route_shape(grade: int, stage: int) -> Dictionary:
	var cols: int = clampi(4 + (stage - 1) / 3 + (1 if grade >= 9 else 0), 4, 8)
	var rows: int = 3 if stage <= 4 else (4 if stage <= 10 else 5)
	var top: int = mini(5 + stage, 12) if grade <= 7 else mini(9 + stage, 20)
	return {"cols": cols, "rows": rows, "top": top, "fill": 0.86 if stage <= 4 else 0.78, "diag": minf(0.9, 0.5 + 0.03 * stage), "oneway": 0.0 if stage < 9 else 0.22, "via": stage >= 13, "timer": 0.0 if stage < 11 else (70.0 if stage < 13 else 90.0)}

static func route_make(grade: int, rng: RandomNumberGenerator, stage: int = 1) -> Dictionary:
	var sh := route_shape(grade, stage)
	var cols: int = sh["cols"]
	var rows: int = sh["rows"]
	for attempt in 400:
		var cells := []
		for i in cols * rows:
			cells.append(i)
		while cells.size() > int(cols * rows * sh["fill"]):
			cells.remove_at(rng.randi() % cells.size())
		var first := cells.filter(func(c): return c % cols == 0)
		var last := cells.filter(func(c): return c % cols == cols - 1)
		if first.is_empty() or last.is_empty():
			continue
		var index := {}
		var nodes := []
		for c in cells:
			index[c] = nodes.size()
			nodes.append(Vector2(150.0 + (c % cols) * (980.0 / (cols - 1)) + rng.randf_range(-18, 18), 150.0 + (c / cols) * (470.0 / (rows - 1)) + rng.randf_range(-16, 16)))
		var edges := []
		var road := func(a: int, b: int, low: int) -> void:
			var dir := 0
			if rng.randf() < sh["oneway"]:
				dir = 1
			if dir == 1 and rng.randi() % 2 == 0:
				edges.append([b, a, rng.randi_range(low, sh["top"]), 1])
			else:
				edges.append([a, b, rng.randi_range(low, sh["top"]), dir])
		for c in cells:
			var x: int = c % cols
			var y: int = c / cols
			if x + 1 < cols and index.has(c + 1):
				road.call(index[c], index[c + 1], 1)
			if y + 1 < rows and index.has(c + cols):
				road.call(index[c], index[c + cols], 1)
			if x + 1 < cols and y + 1 < rows and rng.randf() < sh["diag"]:
				# Одна диагональ на квадрат, чтобы дороги не пересекались.
				if rng.randi() % 2 == 0 and index.has(c + cols + 1):
					road.call(index[c], index[c + cols + 1], 2)
				elif index.has(c + 1) and index.has(c + cols):
					road.call(index[c + 1], index[c + cols], 2)
		var g := {"nodes": nodes, "edges": edges, "start": index[first[rng.randi() % first.size()]], "goal": index[last[rng.randi() % last.size()]], "via": -1, "timer": sh["timer"]}
		if sh["via"]:
			var mid := cells.filter(func(c): return c % cols > 0 and c % cols < cols - 1)
			if mid.is_empty():
				continue
			g["via"] = index[mid[rng.randi() % mid.size()]]
		var best := route_best(g)
		if best["cost"] <= 0 or best["path"].size() < 4:
			continue
		# Простые стратегии не должны давать лучший путь: ни «самая дешёвая дорога на каждом шаге», ни «меньше всего перекрёстков».
		if g["via"] < 0 and (route_greedy(g) == best["cost"] or (stage >= 3 and route_fewest(g) == best["cost"])):
			continue
		if g["via"] >= 0 and route_cost(g, route_hops(g, g["start"], g["via"]) + route_hops(g, g["via"], g["goal"]).slice(1)) == best["cost"]:
			continue
		return g
	return {"nodes": [Vector2(200, 360), Vector2(640, 360), Vector2(1080, 360)], "edges": [[0, 1, 2, 0], [1, 2, 3, 0]], "start": 0, "goal": 2, "via": -1, "timer": 0.0}

static func route_next(g: Dictionary, node: int) -> Array:
	# Куда можно поехать из узла: [узел, длина]. Односторонняя дорога работает только от a к b.
	var out := []
	for e in g["edges"]:
		if e[0] == node:
			out.append([e[1], e[2]])
		elif e[1] == node and e[3] == 0:
			out.append([e[0], e[2]])
	return out

static func route_dijkstra(g: Dictionary, from: int, to: int) -> Dictionary:
	var n: int = g["nodes"].size()
	var dist := []
	var prev := []
	var done := []
	for i in n:
		dist.append(1 << 30)
		prev.append(-1)
		done.append(false)
	dist[from] = 0
	for step in n:
		var u := -1
		for i in n:
			if not done[i] and (u < 0 or dist[i] < dist[u]):
				u = i
		if u < 0 or dist[u] >= (1 << 30):
			break
		done[u] = true
		for nb in route_next(g, u):
			if dist[u] + nb[1] < dist[nb[0]]:
				dist[nb[0]] = dist[u] + nb[1]
				prev[nb[0]] = u
	if dist[to] >= (1 << 30):
		return {"cost": -1, "path": []}
	var path := []
	var at := to
	while at >= 0:
		path.push_front(at)
		at = prev[at]
	return {"cost": dist[to], "path": path}

static func route_best(g: Dictionary) -> Dictionary:
	# Кратчайший маршрут (алгоритм Дейкстры); с посылкой — два отрезка: до посылки и от неё до цели.
	if g.get("via", -1) < 0:
		return route_dijkstra(g, g["start"], g["goal"])
	var a := route_dijkstra(g, g["start"], g["via"])
	var b := route_dijkstra(g, g["via"], g["goal"])
	if a["cost"] < 0 or b["cost"] < 0:
		return {"cost": -1, "path": []}
	return {"cost": a["cost"] + b["cost"], "path": a["path"] + b["path"].slice(1)}

static func route_hops(g: Dictionary, from: int, to: int) -> Array:
	# Путь с наименьшим числом дорог (поиск в ширину).
	var prev := {from: -1}
	var queue := [from]
	while not queue.is_empty():
		var u: int = queue.pop_front()
		if u == to:
			break
		for nb in route_next(g, u):
			if not prev.has(nb[0]):
				prev[nb[0]] = u
				queue.append(nb[0])
	if not prev.has(to):
		return []
	var path := []
	var at := to
	while at >= 0:
		path.push_front(at)
		at = prev[at]
	return path

static func route_fewest(g: Dictionary) -> int:
	return route_cost(g, route_hops(g, g["start"], g["goal"]))

static func route_greedy(g: Dictionary) -> int:
	# «Жадный» курьер всегда едет по самой короткой дороге в новый узел; -1, если заехал в тупик.
	var at: int = g["start"]
	var seen := {at: true}
	var cost := 0
	while at != g["goal"]:
		var pick := []
		for nb in route_next(g, at):
			if not seen.has(nb[0]) and (pick.is_empty() or nb[1] < pick[1]):
				pick = nb
		if pick.is_empty():
			return -1
		cost += pick[1]
		at = pick[0]
		seen[at] = true
	return cost

static func route_cost(g: Dictionary, path: Array) -> int:
	if path.is_empty():
		return -1
	var cost := 0
	for i in range(1, path.size()):
		var w := -1
		for nb in route_next(g, path[i - 1]):
			if nb[0] == path[i] and (w < 0 or nb[1] < w):
				w = nb[1]
		if w < 0:
			return -1
		cost += w
	return cost

# ---------- «Проводник»: путь к файлу ----------

const FOLDERS := ["Школа", "Музыка", "Фото", "Игры", "Документы", "Проекты", "Видео", "Архив", "Отчёты", "Письма", "Лето", "Зима", "Класс", "Рисунки", "Доклады", "Таблицы", "Программы", "Книги", "Карты", "Заметки"]
const STEMS := ["доклад", "отчёт", "закат", "песня", "задача", "ракета", "письмо", "проект", "карта", "график", "робот", "сказка", "команда", "рисунок", "таблица", "пример", "стихи", "лагерь", "парад", "маска", "радуга", "звезда", "кактус", "космос"]
const EXTS := ["txt", "docx", "png", "jpg", "mp3", "py", "xlsx", "pptx"]

static func fs_make(rng: RandomNumberGenerator, depth: int = 3) -> Array:
	# Дерево папок: узел = {name, parent, dirs: [номера узлов], files: [имена]}.
	var nodes := [{"name": "C:", "parent": -1, "dirs": [], "files": []}]
	var level := [0]
	for d in depth:
		var next := []
		for id in level:
			var names := FOLDERS.duplicate()
			var count := 3 if d == 0 else rng.randi_range(2, 3)
			for k in count:
				var name: String = names.pop_at(rng.randi() % names.size())
				if d > 0 and rng.randi() % 3 == 0:
					name += " %d" % rng.randi_range(1, 9)
				nodes.append({"name": name, "parent": id, "dirs": [], "files": []})
				nodes[id]["dirs"].append(nodes.size() - 1)
				next.append(nodes.size() - 1)
		level = next
	for id in range(1, nodes.size()):
		var stems := STEMS.duplicate()
		for k in rng.randi_range(4, 5) if nodes[id]["dirs"].is_empty() else rng.randi_range(1, 2):
			nodes[id]["files"].append("%s.%s" % [stems.pop_at(rng.randi() % stems.size()), EXTS[rng.randi() % EXTS.size()]])
	return nodes

static func fs_chain(nodes: Array, id: int) -> Array:
	var chain := []
	while id >= 0:
		chain.push_front(id)
		id = nodes[id]["parent"]
	return chain

static func fs_path(nodes: Array, id: int) -> String:
	var parts := []
	for c in fs_chain(nodes, id):
		parts.append(nodes[c]["name"])
	return "\\".join(parts)

static func fs_rel(nodes: Array, from: int, to: int) -> String:
	# Относительный путь от папки from к папке to: «..» поднимает на уровень выше.
	var a := fs_chain(nodes, from)
	var b := fs_chain(nodes, to)
	var common := 0
	while common < a.size() and common < b.size() and a[common] == b[common]:
		common += 1
	var parts := []
	for i in a.size() - common:
		parts.append("..")
	for i in range(common, b.size()):
		parts.append(nodes[b[i]]["name"])
	return "\\".join(parts)

static func mask_match(mask: String, name: String) -> bool:
	# «?» — ровно один любой символ, «*» — любая последовательность, в том числе пустая.
	if mask == "":
		return name == ""
	if mask[0] == "*":
		for i in range(name.length() + 1):
			if mask_match(mask.substr(1), name.substr(i)):
				return true
		return false
	if name == "":
		return false
	if mask[0] == "?" or mask[0] == name[0]:
		return mask_match(mask.substr(1), name.substr(1))
	return false

static func fs_mask(files: Array, target: String, rng: RandomNumberGenerator) -> String:
	# Маска, под которую в папке подходит только нужный файл.
	for attempt in 300:
		var dot := target.rfind(".")
		var stem := target.substr(0, dot)
		var ext := target.substr(dot + 1)
		var kind := rng.randi() % 4
		var mask := ""
		if kind == 0:
			var i := rng.randi_range(1, stem.length() - 1)
			mask = stem.substr(0, i) + "*." + ext
		elif kind == 1:
			var i := rng.randi_range(0, stem.length() - 2)
			mask = "?".repeat(i) + stem.substr(i, 2) + "*." + ext.substr(0, 1) + "*"
		elif kind == 2:
			var i := rng.randi_range(1, stem.length() - 1)
			mask = "*" + stem.substr(i) + ".?" + ext.substr(1)
		else:
			var i := rng.randi_range(0, stem.length() - 1)
			mask = stem.substr(0, i) + "?" + stem.substr(i + 1) + ".*"
		var hits := 0
		for f in files:
			if mask_match(mask, f):
				hits += 1
		if hits == 1 and mask_match(mask, target):
			return mask
	return target

static func fs_task(grade: int, nodes: Array, rng: RandomNumberGenerator) -> Dictionary:
	# Задание: текст, папка-цель, файл-цель и папка, с которой начинает игрок.
	var leaves := []
	for id in nodes.size():
		if nodes[id]["dirs"].is_empty() and id > 0:
			leaves.append(id)
	var dir: int = leaves[rng.randi() % leaves.size()]
	var files: Array = nodes[dir]["files"]
	var file: String = files[rng.randi() % files.size()]
	if grade <= 7:
		return {"text": fs_path(nodes, dir) + "\\" + file, "note": "Полный путь к файлу", "dir": dir, "file": file, "start": 0}
	if grade <= 9:
		var start: int = leaves[rng.randi() % leaves.size()]
		for attempt in 30:
			if start != dir and fs_rel(nodes, start, dir).begins_with(".."):
				break
			start = leaves[rng.randi() % leaves.size()]
		return {"text": fs_rel(nodes, start, dir) + "\\" + file, "note": "Относительный путь от папки " + fs_path(nodes, start), "dir": dir, "file": file, "start": start}
	return {"text": fs_path(nodes, dir) + "\\" + fs_mask(files, file, rng), "note": "Путь и маска имени: ? — один символ, * — любые символы", "dir": dir, "file": file, "start": 0}
