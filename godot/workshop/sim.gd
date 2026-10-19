extends RefCounted
# Исполнитель программы робота: без графики, чтобы его можно было проверять тестами.
# Три вида мира: store — склад с ящиками, lamps — поле ламп (биты), array — ряд ячеек с числами.

const DIRS := [Vector2i(1, 0), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(0, -1)]
const COLORS := {"R": "red", "B": "blue", "G": "green"}
const NAMES := {"red": "красный", "blue": "синий", "green": "зелёный"}

# ---------- создание мира ----------

static func make_world(level: Dictionary, map_index: int, data) -> Dictionary:
	if level.get("world", "store") == "array":
		return _make_array(level, data)
	var rows: Array = level["maps"][map_index]
	var bits: Array = data if data is Array else []
	var w := {"kind": level.get("world", "store"), "w": 0, "h": rows.size(), "walls": {}, "boxes": {}, "bins": {}, "disp": {}, "lamps": {}, "inputs": {}, "target": {}, "rows": level.get("rows", {}), "flag": false, "pos": Vector2i.ZERO, "dir": int(level.get("dir", 0)), "carry": "", "delivered": 0, "total": 0}
	var k := 0
	for y in rows.size():
		var row: String = rows[y]
		w["w"] = maxi(w["w"], row.length())
		for x in row.length():
			var ch: String = row[x]
			var p := Vector2i(x, y)
			if ch == "#":
				w["walls"][p] = true
			elif ch == "S":
				w["pos"] = p
			elif ch == "o" or ch == "x":
				w["lamps"][p] = ch == "x"
			elif ch == "?":
				w["lamps"][p] = bool(bits[k]) if k < bits.size() else false
				w["inputs"][p] = true
				k += 1
			elif ch == "D":
				w["disp"][p] = bits.duplicate()
				w["total"] += bits.size()
			elif COLORS.has(ch):
				w["bins"][p] = {"color": COLORS[ch], "count": 0}
			elif COLORS.has(ch.to_upper()):
				w["boxes"][p] = COLORS[ch.to_upper()]
				w["total"] += 1
	if level.has("start"):
		w["pos"] = Vector2i(level["start"][0], level["start"][1])
	if w["kind"] == "lamps":
		w["target"] = _lamp_target(level, w)
	return w

static func _row_lamps(w: Dictionary, y: int) -> Array:
	var xs := []
	for p in w["lamps"]:
		if p.y == y:
			xs.append(p.x)
	xs.sort()
	return xs

static func _row_value(w: Dictionary, y: int) -> int:
	var v := 0
	for x in _row_lamps(w, y):
		v = v * 2 + (1 if w["lamps"][Vector2i(x, y)] else 0)
	return v

static func _set_row(target: Dictionary, w: Dictionary, y: int, value: int) -> void:
	var xs := _row_lamps(w, y)
	for i in xs.size():
		target[Vector2i(xs[xs.size() - 1 - i], y)] = ((value >> i) & 1) == 1

static func logic(f: String, a: bool, b: bool, c: bool) -> bool:
	match f:
		"copy": return a
		"copyb": return b
		"not": return not a
		"and": return a and b
		"or": return a or b
		"xor": return a != b
		"imp": return (not a) or b
		"maj": return (int(a) + int(b) + int(c)) >= 2
		"nand": return not (a and b)
		"nor": return not (a or b)
		"xnor": return a == b
		"andnot": return a and not b
		"and3": return a and b and c
		"xor3": return (int(a) + int(b) + int(c)) % 2 == 1
	return false

static func _lamp_target(level: Dictionary, w: Dictionary) -> Dictionary:
	var t: Dictionary = w["lamps"].duplicate()
	var goal: Dictionary = level["goal"]
	var kind: String = goal["type"]
	if kind == "pattern":
		for p in t:
			t[p] = goal["rows"][p.y][p.x] == "x"
	elif kind == "invert":
		for p in t:
			t[p] = not w["lamps"][p]
	elif kind == "rules":
		for rule in goal["rules"]:
			for x in _row_lamps(w, rule["row"]):
				t[Vector2i(x, rule["row"])] = logic(rule["f"], _in(w, x, "A"), _in(w, x, "B"), _in(w, x, "C"))
	elif kind == "num":
		var xs := _row_lamps(w, goal["row"])
		var size := 1 << xs.size()
		var v := _row_value(w, goal["row"])
		var r := v + 1
		if goal["op"] == "dec":
			r = v - 1
		elif goal["op"] == "neg":
			r = size - v
		elif goal["op"] == "shl":
			r = v * 2
		elif goal["op"] == "shr":
			r = v / 2
		elif goal["op"] == "add2":
			r = v + 2
		elif goal["op"] == "msb":
			r = 0
			while (r * 2 if r > 0 else 1) <= v:
				r = r * 2 if r > 0 else 1
		_set_row(t, w, goal["row"], posmod(r, size))
	elif kind == "parity":
		var xs := _row_lamps(w, goal["row"])
		var odd := false
		for i in xs.size() - 1:
			if w["lamps"][Vector2i(xs[i], goal["row"])]:
				odd = not odd
		t[Vector2i(xs[-1], goal["row"])] = odd
	elif kind == "add":
		_set_row(t, w, goal["s"], _row_value(w, goal["a"]) + _row_value(w, goal["b"]))
	elif kind == "sub":
		_set_row(t, w, goal["s"], _row_value(w, goal["a"]) - _row_value(w, goal["b"]))
	elif kind == "odd":
		# Лампа-индикатор (самая левая в ряду) горит, если число нечётное: младший бит справа.
		var xs := _row_lamps(w, goal["row"])
		t[Vector2i(xs[0], goal["row"])] = w["lamps"][Vector2i(xs[-1], goal["row"])]
	return t

static func _in(w: Dictionary, x: int, name: String) -> bool:
	if not w["rows"].has(name):
		return false
	return w["lamps"].get(Vector2i(x, int(w["rows"][name])), false)

static func _make_array(level: Dictionary, data) -> Dictionary:
	var arr: Array = []
	var mem := int(level.get("mem", 0))
	if data is Dictionary:
		arr = data["arr"].duplicate()
		mem = int(data.get("mem", mem))
	var n := arr.size()
	var start := 0
	if str(level.get("start", "")) == "pre_last":
		start = maxi(0, n - 2)
	return {"kind": "array", "arr": arr, "init": arr.duplicate(), "n": n, "out": null, "i": start, "mem": mem, "target": mem, "mark": -9, "goal": level["goal"]["type"], "w": n + 2, "h": 4, "pos": Vector2i(start + 1, 2), "dir": 3, "carry": "", "walls": {}, "boxes": {}, "bins": {}, "disp": {}, "lamps": {}}

# ---------- цель ----------

static func _sorted_copy(a: Array) -> Array:
	var b := a.duplicate()
	b.sort()
	return b

static func goal_met(w: Dictionary) -> bool:
	if w["kind"] == "store":
		return w["delivered"] >= w["total"]
	if w["kind"] == "lamps":
		for p in w["target"]:
			if w["lamps"][p] != w["target"][p]:
				return false
		return true
	var a: Array = w["arr"]
	var init: Array = w["init"]
	var n: int = w["n"]
	var same: bool = _sorted_copy(a) == _sorted_copy(init)
	match w["goal"]:
		"sum":
			var s := 0
			for v in init:
				s += v
			return w["out"] == s
		"sum_pos":
			var s := 0
			for v in init:
				if v > 0:
					s += v
			return w["out"] == s
		"count_pos":
			var s := 0
			for v in init:
				if v > 0:
					s += 1
			return w["out"] == s
		"max":
			return w["out"] == init.max()
		"min":
			return w["out"] == init.min()
		"find":
			return w["mark"] >= 0 and w["mark"] < n and a[w["mark"]] == w["target"]
		"prefix":
			var s := 0
			for i in n:
				s += init[i]
				if a[i] != s:
					return false
			return true
		"max_last":
			return same and a[n - 1] == init.max()
		"sorted":
			return same and a == _sorted_copy(init)
		"sorted_desc":
			var d := _sorted_copy(init)
			d.reverse()
			return same and a == d
		"double":
			for i in n:
				if a[i] != init[i] * 2:
					return false
			return true
		"clamp":
			for i in n:
				if a[i] != maxi(init[i], 0):
					return false
			return true
		"last":
			return w["out"] == init[n - 1]
		"min_first":
			return same and a[0] == init.min()
		"max_first":
			return same and a[0] == init.max()
		"ends":
			return same and a[0] == init.min() and a[n - 1] == init.max()
		"fill_max":
			for i in n:
				if a[i] != init.max():
					return false
			return true
		"sum_even":
			var s := 0
			for v in init:
				if posmod(v, 2) == 0:
					s += v
			return w["out"] == s
		"count_inv":
			var s := 0
			for i in n - 1:
				if init[i] > init[i + 1]:
					s += 1
			return w["out"] == s
		"sum_until_neg":
			var s := 0
			for v in init:
				if v < 0:
					break
				s += v
			return w["out"] == s
		"sort_sum":
			var s := 0
			for v in init:
				s += v
			return same and a == _sorted_copy(init) and w["out"] == s
		"partition":
			var seen_pos := false
			for v in a:
				if v > 0:
					seen_pos = true
				elif seen_pos:
					return false
			return same
	return false

# ---------- условия ----------

static func count(list: Array) -> int:
	var n := 0
	for node in list:
		n += 1
		if node.has("body"):
			n += count(node["body"])
		if node.has("alt"):
			n += count(node["alt"])
	return n

static func blocked(w: Dictionary, p: Vector2i) -> bool:
	if p.x < 0 or p.y < 0 or p.x >= w["w"] or p.y >= w["h"]:
		return true
	return w["walls"].has(p) or w["boxes"].has(p) or w["bins"].has(p) or w["disp"].has(p)

static func _val(w: Dictionary, i: int):
	# Число в ячейке данных; у рамки и ячейки вывода для сравнений числа нет.
	if i >= 0 and i < w["n"]:
		return w["arr"][i]
	return null

static func cond(name: String, w: Dictionary) -> bool:
	if w["kind"] == "array":
		var v = _val(w, w["i"])
		var r = _val(w, w["i"] + 1)
		match name:
			"data": return v != null
			"rdata": return r != null
			"ldata": return _val(w, w["i"] - 1) != null
			"gt_mem": return v != null and v > w["mem"]
			"lt_mem": return v != null and v < w["mem"]
			"ne_mem": return v != null and v != w["mem"]
			"gt_right": return v != null and r != null and v > r
			"lt_right": return v != null and r != null and v < r
			"pos": return v != null and v > 0
			"rneg": return r != null and r < 0
			"neg": return v != null and v < 0
			"even": return v != null and posmod(v, 2) == 0
		return false
	var front: Vector2i = w["pos"] + DIRS[w["dir"]]
	match name:
		"free": return not blocked(w, front)
		"wall": return blocked(w, front)
		"lit": return w["lamps"].get(w["pos"], false)
		"dark": return w["lamps"].has(w["pos"]) and not w["lamps"][w["pos"]]
		"flag": return w["flag"]
		"ahead": return w["lamps"].get(front, false)
		"A", "B", "C": return _in(w, w["pos"].x, name)
	return w["carry"] == name

# ---------- выполнение ----------

static func run(program: Array, world: Dictionary, max_steps: int = 600) -> Dictionary:
	var c := {"w": world, "ev": [], "steps": 0, "max": max_steps, "fail": "", "done": false}
	_exec(program, c)
	if c["fail"] == "" and not c["done"]:
		if world["kind"] != "store" and goal_met(world):
			c["done"] = true
			c["ev"].append({"t": "done", "id": -1})
		elif world["kind"] == "store":
			_fail(c, -1, "Программа закончилась, а заказ не выполнен: осталось ящиков — %d." % (world["total"] - world["delivered"]))
		elif world["kind"] == "lamps":
			var bad := 0
			for p in world["target"]:
				if world["lamps"][p] != world["target"][p]:
					bad += 1
			_fail(c, -1, "Программа закончилась, но лампы горят не так, как нужно. Не совпало ламп: %d." % bad)
		else:
			_fail(c, -1, "Программа закончилась, а задание не выполнено. Проверь, что и куда записал робот.")
	return {"events": c["ev"], "ok": c["done"], "msg": c["fail"]}

static func _fail(c: Dictionary, id: int, msg: String, bump: bool = false) -> bool:
	c["fail"] = msg
	c["ev"].append({"t": "bump" if bump else "fail", "id": id, "msg": msg})
	return false

static func _tick(c: Dictionary, id: int) -> bool:
	c["steps"] += 1
	if c["steps"] > c["max"]:
		return _fail(c, id, "Слишком много шагов. Похоже, программа зациклилась.")
	return true

static func _exec(list: Array, c: Dictionary) -> bool:
	for node in list:
		if not _step(node, c):
			return false
	return true

static func _finish(c: Dictionary, id: int) -> bool:
	# После действия, меняющего мир: если цель достигнута — сразу победа.
	if goal_met(c["w"]):
		c["done"] = true
		c["ev"].append({"t": "done", "id": id})
		return false
	return true

static func _step(n: Dictionary, c: Dictionary) -> bool:
	var w: Dictionary = c["w"]
	var id: int = n.get("id", -1)
	var op: String = n["op"]
	if op == "repeat":
		for i in int(n["n"]):
			c["ev"].append({"t": "loop", "id": id, "i": i + 1, "n": int(n["n"])})
			if not _exec(n["body"], c):
				return false
		return true
	if op == "if" or op == "while":
		while true:
			if not _tick(c, id):
				return false
			var r := cond(n["cond"], w)
			c["ev"].append({"t": "check", "id": id, "cond": n["cond"], "res": r})
			if op == "if":
				return _exec(n["body"] if r else n["alt"], c)
			if not r:
				return true
			if not _exec(n["body"], c):
				return false
	if not _tick(c, id):
		return false
	if w["kind"] == "array":
		return _array_op(op, id, w, c)
	var front: Vector2i = w["pos"] + DIRS[w["dir"]]
	if op == "fwd":
		if blocked(w, front):
			return _fail(c, id, "Робот упёрся в преграду. Проверь число шагов и повороты.", true)
		w["pos"] = front
		c["ev"].append({"t": "fwd", "id": id, "to": front})
	elif op == "left" or op == "right":
		w["dir"] = (w["dir"] + (1 if op == "right" else 3)) % 4
		c["ev"].append({"t": op, "id": id})
	elif op == "on" or op == "off":
		if not w["lamps"].has(w["pos"]):
			return _fail(c, id, "Под роботом нет лампы.")
		w["lamps"][w["pos"]] = op == "on"
		c["ev"].append({"t": "lamp", "id": id, "at": w["pos"], "on": op == "on"})
		return _finish(c, id)
	elif op == "fset" or op == "fclr" or op == "ftog":
		w["flag"] = true if op == "fset" else (false if op == "fclr" else not w["flag"])
		c["ev"].append({"t": "flag", "id": id, "on": w["flag"]})
	elif op == "take":
		if w["carry"] != "":
			return _fail(c, id, "Робот уже несёт ящик: сначала положи его.")
		if w["disp"].has(front):
			if w["disp"][front].is_empty():
				return _fail(c, id, "Выдача пуста: ящики закончились.")
			w["carry"] = w["disp"][front].pop_front()
		elif w["boxes"].has(front):
			w["carry"] = w["boxes"][front]
			w["boxes"].erase(front)
		else:
			return _fail(c, id, "Перед роботом нет ящика. «Взять» работает с клеткой прямо перед ним.")
		c["ev"].append({"t": "take", "id": id, "at": front, "color": w["carry"]})
	elif op == "put":
		if w["carry"] == "":
			return _fail(c, id, "Робот ничего не несёт — класть нечего.")
		if w["bins"].has(front):
			var bin: Dictionary = w["bins"][front]
			if bin["color"] != w["carry"]:
				return _fail(c, id, "Ошибка сортировки: %s ящик попал в %s контейнер." % [NAMES[w["carry"]], NAMES[bin["color"]]])
			bin["count"] += 1
			w["delivered"] += 1
			c["ev"].append({"t": "put", "id": id, "at": front, "color": w["carry"], "bin": true})
			w["carry"] = ""
			return _finish(c, id)
		elif blocked(w, front):
			return _fail(c, id, "Сюда ящик поставить нельзя: клетка занята.")
		else:
			w["boxes"][front] = w["carry"]
			c["ev"].append({"t": "put", "id": id, "at": front, "color": w["carry"], "bin": false})
			w["carry"] = ""
	else:
		return _fail(c, id, "Этой команды в цехе нет.")
	return true

static func _array_op(op: String, id: int, w: Dictionary, c: Dictionary) -> bool:
	var i: int = w["i"]
	var n: int = w["n"]
	if op == "step_r" or op == "step_l":
		var to := i + (1 if op == "step_r" else -1)
		if to < -1 or to > n:
			return _fail(c, id, "Дальше ячеек нет: робот упёрся в край стеллажа.", true)
		w["i"] = to
		c["ev"].append({"t": "step", "id": id, "to": to})
		return true
	if op == "load" or op == "add":
		var v = w["arr"][i] if i >= 0 and i < n else (w["out"] if i == n else null)
		if v == null:
			return _fail(c, id, "В этой ячейке нет числа.")
		w["mem"] = v if op == "load" else w["mem"] + v
		c["ev"].append({"t": "mem", "id": id, "mem": w["mem"]})
		return true
	if op == "inc" or op == "zero":
		w["mem"] = 0 if op == "zero" else w["mem"] + 1
		c["ev"].append({"t": "mem", "id": id, "mem": w["mem"]})
		return true
	if op == "write":
		if i < 0:
			return _fail(c, id, "В рамку стеллажа писать нельзя.")
		if i == n:
			w["out"] = w["mem"]
		else:
			w["arr"][i] = w["mem"]
		c["ev"].append({"t": "write", "id": id, "at": i, "val": w["mem"]})
		return _finish(c, id)
	if op == "swap":
		if i < 0 or i + 1 >= n:
			return _fail(c, id, "Обменять можно только два соседних числа: под роботом и справа от него.")
		var t = w["arr"][i]
		w["arr"][i] = w["arr"][i + 1]
		w["arr"][i + 1] = t
		c["ev"].append({"t": "swap", "id": id, "at": i})
		return _finish(c, id)
	if op == "mark":
		w["mark"] = i
		c["ev"].append({"t": "mark", "id": id, "at": i})
		if goal_met(w):
			c["done"] = true
			c["ev"].append({"t": "done", "id": id})
			return false
		return _fail(c, id, "Сигнал подан не у той ячейки: здесь не то число, что в памяти.")
	return _fail(c, id, "Этой команды в цехе нет.")

# ---------- варианты заданий ----------

static func all_queues(n: int, colors: Array) -> Array:
	var out := []
	var total := int(pow(colors.size(), n))
	for k in total:
		var q := []
		var v := k
		for i in n:
			q.append(colors[v % colors.size()])
			v /= colors.size()
		var ok := true
		for col in colors:
			if not q.has(col):
				ok = false
		if ok:
			out.append(q)
	return out

static func _bits_ok(bits: Array, filter: String) -> bool:
	if filter == "nonconst":
		return bits.has(true) and bits.has(false)
	if filter == "nonzero":
		return bits.has(true)
	if filter == "age":
		# Первая половина битов (число A) не меньше второй (число B): для вычитания без отрицательных чисел.
		var half := bits.size() / 2
		var a := 0
		var b := 0
		for i in half:
			a = a * 2 + int(bits[i])
			b = b * 2 + int(bits[half + i])
		return a >= b
	return true

static func random_data(level: Dictionary, rng: RandomNumberGenerator):
	# Случайные входные данные одного запуска («смены»).
	if not level.has("random"):
		return level.get("queue", [])
	var r: Dictionary = level["random"]
	var kind: String = r.get("type", "queue")
	if kind == "queue":
		var qs := all_queues(r["n"], r["colors"])
		return qs[rng.randi() % qs.size()]
	if kind == "bits":
		while true:
			var bits := []
			for i in int(r["n"]):
				bits.append(rng.randi() % 2 == 1)
			if _bits_ok(bits, r.get("filter", "any")):
				return bits
	if kind == "cover":
		# В столбцах встречаются все сочетания входов поровну, порядок случайный.
		var rows := int(r["rows"])
		var cols := int(r["cols"])
		var combos := []
		for j in cols:
			combos.append(j % (1 << rows))
		for j in range(cols - 1, 0, -1):
			var k := rng.randi() % (j + 1)
			var t = combos[j]
			combos[j] = combos[k]
			combos[k] = t
		var bits := []
		for row in rows:
			for j in cols:
				bits.append(((combos[j] >> row) & 1) == 1)
		return bits
	# array
	for attempt in 200:
		var n := rng.randi_range(r["len"][0], r["len"][1])
		var arr := []
		while arr.size() < n:
			var v := rng.randi_range(r["min"], r["max"])
			if r.get("nonzero", false) and v == 0:
				continue
			if r.get("distinct", false) and arr.has(v):
				continue
			arr.append(v)
		var shape: String = r.get("shape", "plain")
		var data := {"arr": arr, "mem": int(level.get("mem", 0))}
		if shape == "insert":
			var last = arr.pop_back()
			arr.sort()
			arr.append(last)
		elif shape == "find":
			data["mem"] = arr[rng.randi_range(1, n - 1)]
		elif shape == "mixed":
			var pos := 0
			for v in arr:
				if v > 0:
					pos += 1
			if pos == 0 or pos == n:
				continue
		# Задание не должно быть выполнено ещё до запуска.
		if goal_met(_make_array(level, data)):
			continue
		return data
	return {"arr": [3, 1, 2], "mem": 0}

static func sample(level: Dictionary, count: int, rng: RandomNumberGenerator) -> Array:
	var maps: Array = range(level["maps"].size()) if level.has("maps") else [0]
	for j in range(maps.size() - 1, 0, -1):
		var k := rng.randi() % (j + 1)
		var t = maps[j]
		maps[j] = maps[k]
		maps[k] = t
	var out := []
	var seen := []
	for s in count:
		var d = random_data(level, rng)
		for attempt in 20:
			if not seen.has(str(d)):
				break
			d = random_data(level, rng)
		seen.append(str(d))
		out.append({"map": maps[s % maps.size()], "data": d})
	return out

static func test_variants(level: Dictionary) -> Array:
	# Для тестов: полный перебор, если вариантов немного, иначе 300 случайных с постоянным зерном.
	var maps: int = level["maps"].size() if level.has("maps") else 1
	var out := []
	if not level.has("random"):
		# Без случайных данных варианты — это разные карты уровня.
		for m in maps:
			out.append({"map": m, "data": level.get("queue", [])})
		return out
	var r: Dictionary = level["random"]
	var kind: String = r.get("type", "queue")
	var datas := []
	if kind == "queue":
		datas = all_queues(r["n"], r["colors"])
	elif kind == "bits" and int(r["n"]) <= 9:
		for v in (1 << int(r["n"])):
			var bits := []
			for i in int(r["n"]):
				bits.append(((v >> i) & 1) == 1)
			if _bits_ok(bits, r.get("filter", "any")):
				datas.append(bits)
	else:
		var rng := RandomNumberGenerator.new()
		rng.seed = 20261012
		for i in 300:
			datas.append(random_data(level, rng))
	for m in maps:
		for d in datas:
			out.append({"map": m, "data": d})
	return out
