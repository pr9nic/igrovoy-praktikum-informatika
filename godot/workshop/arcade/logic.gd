extends RefCounted
# Правила трёх аркад без графики: их проверяет tests/arcade.gd.

const Fmt = preload("res://arcade/fmt.gd")

# ---------- «Двоичный десант» ----------

const BITS := {6: 4, 7: 6, 8: 8, 9: 8, 10: 8, 11: 8}
const FALL := {6: 13.0, 7: 16.0, 8: 19.0, 9: 21.0, 10: 23.0, 11: 25.0}

static func target(grade: int, rng: RandomNumberGenerator) -> Dictionary:
	# Цель: надпись на вирусе и число, которое нужно набрать битами.
	if grade <= 8:
		var v := rng.randi_range(1, (1 << BITS[grade]) - 1)
		return {"label": str(v), "value": v}
	if grade == 9:
		var v := rng.randi_range(1, 255)
		if rng.randi() % 2 == 0:
			return {"label": Fmt.hex(v) + "₁₆", "value": v}
		return {"label": Fmt.oct(v) + "₈", "value": v}
	if grade == 10:
		if rng.randi() % 2 == 0:
			var n := rng.randi_range(1, 128)
			return {"label": "−%d" % n, "value": 256 - n}
		var v := rng.randi_range(16, 255)
		return {"label": Fmt.hex(v) + "₁₆", "value": v}
	while true:
		var kind := rng.randi() % 5
		var a := rng.randi_range(1, 63)
		var b := rng.randi_range(1, 63)
		var r := {}
		if kind == 0:
			r = {"label": "%d И %d" % [a, b], "value": a & b}
		elif kind == 1:
			r = {"label": "%d ИЛИ %d" % [a, b], "value": a | b}
		elif kind == 2:
			r = {"label": "%d ⊕ %d" % [a, b], "value": a ^ b}
		elif kind == 3:
			var k := rng.randi_range(1, 4)
			a = rng.randi_range(1, 15)
			r = {"label": "%d << %d" % [a, k], "value": a << k}
		else:
			a = rng.randi_range(1, 254)
			r = {"label": "НЕ %d" % a, "value": 255 - a}
		if r["value"] > 0:
			return r
	return {}

static func bits_value(bits: Array) -> int:
	var v := 0
	for b in bits:
		v = v * 2 + (1 if b else 0)
	return v

# ---------- «2048: биты и байты» ----------


static func tile_label(grade: int, k: int) -> Array:
	# Плитка хранит показатель степени k; возвращает [крупная надпись, подпись].
	var v := 1 << k
	if grade == 6:
		if k >= 20:
			return [str(1 << (k - 20)), "Мбайт"]
		if k >= 10:
			return [str(1 << (k - 10)), "Кбайт"]
		return [str(v), Fmt.plural(v, "байт", "байта", "байт")]
	if grade == 7:
		if k >= 13:
			return [str(1 << (k - 13)), "Кбайт"]
		if k >= 3:
			var n := 1 << (k - 3)
			return [str(n), Fmt.plural(n, "байт", "байта", "байт")]
		return [str(v), Fmt.plural(v, "бит", "бита", "бит")]
	if grade == 8:
		return ["1" + "0".repeat(k), "= %d" % v]
	if grade == 9:
		return ["2" + Fmt.sup(k), "= %d" % v]
	if grade == 10:
		return [Fmt.hex(v), "₁₆ = %d" % v]
	if k >= 20:
		return [str(1 << (k - 20)), "Гбайт"]
	if k >= 10:
		return [str(1 << (k - 10)), "Мбайт"]
	return [str(v), "Кбайт"]

static func slide_line(line: Array) -> Dictionary:
	# Сдвигает одну линию к началу. Плитка = показатель+1, 0 = пусто.
	# moves: [откуда, куда, значение] для анимации; merged: индексы слияний.
	var out := []
	var moves := []
	var merged := []
	var gained := 0
	var last_merged := false
	for i in line.size():
		var v: int = line[i]
		if v == 0:
			continue
		if not out.is_empty() and out[-1] == v and not last_merged:
			out[-1] = v + 1
			gained += 1 << v
			merged.append(out.size() - 1)
			moves.append([i, out.size() - 1, v])
			last_merged = true
		else:
			out.append(v)
			moves.append([i, out.size() - 1, v])
			last_merged = false
	while out.size() < line.size():
		out.append(0)
	return {"line": out, "moves": moves, "merged": merged, "gained": gained}

static func index_of(dir: int, line: int, i: int) -> int:
	# Клетка поля 4×4 для i-й позиции линии при сдвиге dir: 0 влево, 1 вправо, 2 вверх, 3 вниз.
	match dir:
		0: return line * 4 + i
		1: return line * 4 + (3 - i)
		2: return i * 4 + line
	return (3 - i) * 4 + line

static func slide(grid: Array, dir: int) -> Dictionary:
	var out := grid.duplicate()
	var moves := []
	var merged := []
	var gained := 0
	for line in 4:
		var cells := []
		for i in 4:
			cells.append(grid[index_of(dir, line, i)])
		var r := slide_line(cells)
		gained += r["gained"]
		for i in 4:
			out[index_of(dir, line, i)] = r["line"][i]
		for m in r["moves"]:
			moves.append([index_of(dir, line, m[0]), index_of(dir, line, m[1]), m[2]])
		for i in r["merged"]:
			merged.append(index_of(dir, line, i))
	return {"grid": out, "moved": out != grid, "moves": moves, "merged": merged, "gained": gained}

static func can_move(grid: Array) -> bool:
	for d in 4:
		if slide(grid, d)["moved"]:
			return true
	return false

# ---------- «Змейка: по порядку» ----------

static func food(grade: int, rng: RandomNumberGenerator, taken: Array) -> Dictionary:
	# Еда: надпись и её числовое значение; значения на поле не повторяются.
	for attempt in 200:
		var r := _food(grade, rng)
		if not taken.has(r["value"]):
			return r
	return {"label": "1", "value": 1}

static func _food(grade: int, rng: RandomNumberGenerator) -> Dictionary:
	if grade == 6:
		if rng.randi() % 2 == 0:
			var n := rng.randi_range(1, 40)
			return {"label": Fmt.bits(n), "value": n}
		var n2 := rng.randi_range(1, 6)
		return {"label": Fmt.bytes(n2), "value": n2 * 8}
	if grade == 7:
		var kind := rng.randi() % 4
		if kind == 0:
			var n := rng.randi_range(4, 60) * 100
			return {"label": Fmt.bits(n), "value": n}
		if kind == 1:
			var n := rng.randi_range(1, 30) * 50
			return {"label": Fmt.bytes(n), "value": n * 8}
		if kind == 2:
			var n := rng.randi_range(1, 3)
			return {"label": "%d Кбайт" % n, "value": n * 8192}
		var n3 := rng.randi_range(1, 9) * 1000
		return {"label": Fmt.bits(n3), "value": n3}
	var top: int = {8: 63, 9: 255, 10: 1023, 11: 4095}[grade]
	var v := rng.randi_range(1, top)
	var forms := ["dec", "bin"]
	if grade >= 9:
		forms = ["dec", "bin", "oct", "hex"]
	if grade >= 10:
		forms = ["dec", "oct", "hex", "hex"]
	if grade == 11:
		forms = ["dec", "oct", "hex", "pow"]
	var form: String = forms[rng.randi() % forms.size()]
	if form == "bin" and v > 255:
		form = "hex"
	if form == "pow":
		var k := rng.randi_range(2, 12)
		return {"label": "2" + Fmt.sup(k), "value": 1 << k}
	if form == "bin":
		return {"label": Fmt.bin(v) + "₂", "value": v}
	if form == "oct":
		return {"label": Fmt.oct(v) + "₈", "value": v}
	if form == "hex":
		return {"label": Fmt.hex(v) + "₁₆", "value": v}
	return {"label": str(v), "value": v}

static func smallest(foods: Array) -> int:
	var best := 0
	for i in foods.size():
		if foods[i]["value"] < foods[best]["value"]:
			best = i
	return best
