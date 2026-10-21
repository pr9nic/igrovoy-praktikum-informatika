extends RefCounted
# «Кодоблокс» без графики: мир из коробок, движение героя, карты обби, тайкун и симулятор.
# Всё здесь проверяется в tests/blox.gd (бот-автопилот сам проходит обби на этой же физике).

const KP = preload("res://arcade/kp_logic.gd")
const Q = preload("res://cells/questions.gd")

const SPEED := 9.0
const JUMP := 11.5
const GRAV := 32.0
const HW := 0.42          # полуширина героя
const HH := 1.9           # рост героя
const FALL_Y := -14.0

# Виды частей мира: solid — опора, kill — смертельный блок, check — контрольная точка, finish — финиш,
# mover — движущаяся платформа, spin — вращающаяся балка-убийца, vanish — исчезающий блок, glass — плитка моста,
# coin — Кодобакс, pad — кнопка тайкуна или магазина, orb — бит для симулятора, deco/door/sign — только картинка.
const SOLID := ["solid", "check", "finish", "mover", "glass", "vanish", "wall", "bounce", "conv"]
const NEAR := 26.0        # физика считает только блоки ближе этого расстояния (длинные обби — сотни блоков)

# ---------- мир ----------

class World:
	var parts: Array = []
	var t := 0.0
	var pos := Vector3.ZERO
	var vel := Vector3.ZERO
	var on_floor := false
	var floor_i := -1
	var spawn := Vector3.ZERO
	var check_n := 0
	var deaths := 0
	var wrong := 0
	var coins := 0
	var won := false
	var touching: Dictionary = {}     # pad/orb, которых герой касается сейчас (событие — только при входе)
	var near: Array = []              # индексы частей рядом с героем
	var near_at := Vector3(1e9, 0, 0)
	var movers: Array = []
	var bounce_t := -10.0

	func add(p: Dictionary) -> int:
		if not p.has("k"):
			p["k"] = "solid"
		p["c"] = p["p"]                 # текущий центр (у движущихся меняется)
		parts.append(p)
		if p.has("a"):
			movers.append(parts.size() - 1)
		near_at = Vector3(1e9, 0, 0)    # пересчитать соседей
		return parts.size() - 1

	func refresh_near(force: bool = false) -> void:
		if not force and pos.distance_to(near_at) < 4.0:
			return
		near_at = pos
		near = []
		for i in parts.size():
			var p: Dictionary = parts[i]
			var h: Vector3 = p["s"] / 2.0 + (p.get("a", Vector3.ZERO) as Vector3).abs() + Vector3(1, 1, 1) * (float(p.get("L", 0.0)) / 2.0)
			var c: Vector3 = p["p"]
			var d := Vector3(maxf(0.0, absf(pos.x - c.x) - h.x), maxf(0.0, absf(pos.y - c.y) - h.y), maxf(0.0, absf(pos.z - c.z) - h.z))
			if d.length() < NEAR:
				near.append(i)

	static func laser_on(p: Dictionary, tt: float) -> bool:
		var per: float = p.get("per", 2.4)
		return fposmod(tt + float(p.get("ph", 0.0)), per) < per * 0.5

	func center(i: int) -> Vector3:
		return parts[i]["c"]

	func solid(i: int) -> bool:
		var p: Dictionary = parts[i]
		var k: String = p["k"]
		if k == "glass":
			return not p.get("broken", false)
		if k == "vanish":
			return vanish_on(p, t)
		if k == "wall":
			return not p.get("open", false)
		return k in SOLID

	static func vanish_on(p: Dictionary, tt: float) -> bool:
		var per: float = p.get("per", 3.0)
		return fposmod(tt + float(p.get("ph", 0.0)), per) < per * 0.62

	func mover_at(p: Dictionary, tt: float) -> Vector3:
		var a: Vector3 = p.get("a", Vector3.ZERO)
		return p["p"] + a * sin(tt * float(p.get("w", 1.0)) + float(p.get("ph", 0.0)))

	func overlap(i: int, at: Vector3, grow: float = 0.0) -> bool:
		var p: Dictionary = parts[i]
		var c: Vector3 = p["c"]
		var h: Vector3 = p["s"] / 2.0
		return absf(at.x - c.x) < h.x + HW + grow and absf(at.z - c.z) < h.z + HW + grow and at.y < c.y + h.y + grow and at.y + HH > c.y - h.y - grow

	# Шаг мира. mv — направление в плоскости XZ (длина до 1), jump — нажат прыжок. Возвращает события.
	func step(dt: float, mv: Vector2, jump: bool) -> Array:
		var ev: Array = []
		t += dt
		var carry := Vector3.ZERO
		for i in movers:
			var p: Dictionary = parts[i]
			var nc := mover_at(p, t)
			if on_floor and floor_i == i and p["k"] == "mover":
				carry = nc - p["c"]
			p["c"] = nc
		if on_floor and floor_i >= 0 and parts[floor_i]["k"] == "conv":
			carry += (parts[floor_i]["dir"] as Vector3) * dt       # лента тащит героя
		pos += carry
		refresh_near()
		vel.x = mv.x * SPEED
		vel.z = mv.y * SPEED
		vel.y -= GRAV * dt
		if jump and on_floor:
			vel.y = JUMP
			on_floor = false
			ev.append({"e": "jump"})
		# По осям: X, Z, затем Y — так герой скользит вдоль стен и встаёт на опоры.
		for ax in [0, 2]:
			pos[ax] += vel[ax] * dt
			for i in near:
				if solid(i) and overlap(i, pos):
					var c: Vector3 = parts[i]["c"]
					var h: Vector3 = parts[i]["s"] / 2.0
					# Невысокий порожек (до 0,45) герой перешагивает, как в Roblox.
					var top: float = c.y + h.y
					if top - pos.y <= 0.45 and top - pos.y > 0.0 and on_floor:
						pos.y = top
						continue
					pos[ax] = c[ax] + (h[ax] + HW + 0.001) * (1.0 if pos[ax] > c[ax] else -1.0)
		pos.y += vel.y * dt
		var was := on_floor
		on_floor = false
		for i in near:
			if solid(i) and overlap(i, pos):
				var c: Vector3 = parts[i]["c"]
				var h: Vector3 = parts[i]["s"] / 2.0
				if vel.y <= 0.0 and pos.y > c.y:
					pos.y = c.y + h.y
					on_floor = true
					floor_i = i
				elif vel.y > 0.0:
					pos.y = c.y - h.y - HH - 0.001
				vel.y = 0.0
		if not on_floor:
			floor_i = -1
		elif not was:
			ev.append({"e": "land"})
			if parts[floor_i]["k"] == "bounce":
				# батут подбрасывает высоко
				vel.y = float(parts[floor_i].get("power", 20.0))
				bounce_t = t
				on_floor = false
				floor_i = -1
				ev.append({"e": "bounce"})
		# Стеклянная плитка с неверным ответом лопается под героем.
		if on_floor and floor_i >= 0 and parts[floor_i]["k"] == "glass" and not parts[floor_i].get("ok", false):
			parts[floor_i]["broken"] = true
			wrong += 1
			on_floor = false
			ev.append({"e": "glass", "i": floor_i})
		var now := {}
		for i in near:
			var p: Dictionary = parts[i]
			var k: String = p["k"]
			if (k == "kill" or (k == "laser" and laser_on(p, t))) and overlap(i, pos, 0.02):
				return ev + die("kill")
			if k == "spin" and _spin_hit(p):
				return ev + die("spin")
			if (k == "check" or k == "finish") and on_floor and floor_i == i:
				if k == "finish" and not won:
					won = true
					ev.append({"e": "finish"})
				elif k == "check" and int(p.get("n", 0)) > check_n:
					check_n = int(p["n"])
					spawn = c_top(i)
					ev.append({"e": "check", "n": check_n})
			if k == "coin" and not p.get("got", false) and overlap(i, pos, 0.2):
				p["got"] = true
				coins += 1
				ev.append({"e": "coin", "i": i})
			if (k == "pad" or k == "orb" or k == "zone") and not p.get("off", false) and overlap(i, pos, 0.1):
				now[i] = true
				if not touching.has(i):
					ev.append({"e": k, "i": i})
		touching = now
		if pos.y < FALL_Y:
			return ev + die("fall")
		return ev

	func c_top(i: int) -> Vector3:
		var c: Vector3 = parts[i]["c"]
		return Vector3(c.x, c.y + parts[i]["s"].y / 2.0, c.z)

	func _spin_hit(p: Dictionary) -> bool:
		# Балка длиной L вращается вокруг центра; толщина 0,6. Удар — если герой рядом с отрезком на высоте балки.
		var c: Vector3 = p["c"]
		if pos.y > c.y + 0.35 or pos.y + HH < c.y - 0.35:
			return false
		var a: float = t * float(p.get("w", 2.0)) + float(p.get("ph", 0.0))
		var d := Vector2(cos(a), sin(a))
		var rel := Vector2(pos.x - c.x, pos.z - c.z)
		var along := clampf(rel.dot(d), -float(p["L"]) / 2.0, float(p["L"]) / 2.0)
		return (rel - d * along).length() < 0.3 + HW

	func die(why: String) -> Array:
		deaths += 1
		pos = spawn
		refresh_near(true)
		vel = Vector3.ZERO
		on_floor = false
		floor_i = -1
		return [{"e": "die", "why": why}]

	# Есть ли опора чуть впереди и ниже (для автопилота и ботов).
	func floor_at(at: Vector3) -> bool:
		for i in near:
			if solid(i):
				var c: Vector3 = parts[i]["c"]
				var h: Vector3 = parts[i]["s"] / 2.0
				if absf(at.x - c.x) < h.x and absf(at.z - c.z) < h.z and c.y + h.y <= at.y + 0.5 and c.y + h.y >= at.y - 2.2:
					return true
		return false

	func danger_at(at: Vector3) -> bool:
		for i in near:
			var k: String = parts[i]["k"]
			if (k == "kill" or (k == "laser" and laser_on(parts[i], t))) and overlap(i, at, 0.1):
				return true
			if k == "glass" and not parts[i].get("ok", false) and not parts[i].get("broken", false):
				var c: Vector3 = parts[i]["c"]
				var h: Vector3 = parts[i]["s"] / 2.0
				if absf(at.x - c.x) < h.x and absf(at.z - c.z) < h.z:
					return true
		return false

# ---------- вопросы ----------

static func question(grade: int, rng: RandomNumberGenerator, n_opts: int = 3) -> Dictionary:
	# Вопрос с n_opts вариантами: мини-задачи «Кодополии» (двоичный код, логика, программы, IP) или банк класса.
	var d: Dictionary = {}
	if rng.randf() < 0.6:
		var kinds := KP.mini_kinds(grade)
		kinds.erase("quiz")
		for _try in 6:
			d = KP.mini_make(kinds[rng.randi() % kinds.size()], grade, rng)
			if not d.is_empty() and str(d.get("q", "")).length() <= 90 and (d.get("code", []) as Array).size() <= 4:
				break
	if d.is_empty() or str(d.get("q", "")).length() > 90 or (d.get("code", []) as Array).size() > 4:
		var bank: Array = Q.DATA.get(str(grade), Q.DATA["8"])
		var b: Dictionary = bank[rng.randi() % bank.size()]
		d = {"q": b["q"], "opts": [b["a"]] + (b["w"] as Array).slice(0, 3), "right": 0, "code": []}
	var right: String = str(d["opts"][int(d["right"])])
	var opts: Array = [right]
	for o in d["opts"]:
		if opts.size() < n_opts and not opts.has(str(o)):
			opts.append(str(o))
	KP.shuffle(opts, rng)
	return {"q": str(d["q"]), "code": d.get("code", []), "opts": opts, "right": opts.find(right)}

# Логическое выражение со значением: [текст, значение]. Глубина и операции — по классу.
static func logic_expr(grade: int, rng: RandomNumberGenerator, vals: Dictionary, depth: int) -> Array:
	var names := vals.keys()
	if depth <= 0:
		var n: String = names[rng.randi() % names.size()]
		if rng.randf() < 0.3:
			return ["не " + n, not vals[n]]
		return [n, vals[n]]
	var a := logic_expr(grade, rng, vals, depth - 1)
	var b := logic_expr(grade, rng, vals, 0)
	var r := rng.randi() % (3 if grade >= 9 else 2)
	var at: String = ("(%s)" % a[0]) if depth > 1 else a[0]
	match r:
		0:
			return ["%s и %s" % [at, b[0]], a[1] and b[1]]
		1:
			return ["%s или %s" % [at, b[0]], a[1] or b[1]]
	return ["не (%s и %s)" % [at, b[0]], not (a[1] and b[1])]

static func logic_row(grade: int, rng: RandomNumberGenerator, vals: Dictionary) -> Array:
	# Три разных выражения: ровно одно истинно.
	var depth := 1 if grade <= 8 else 2
	var t: Array = []
	var f: Array = []
	for _k in 200:
		var e := logic_expr(grade, rng, vals, depth if rng.randf() < 0.7 else 1)
		if (t + f).any(func(x): return x[0] == e[0]):
			continue
		if e[1] and t.is_empty():
			t.append(e)
		elif not e[1] and f.size() < 2:
			f.append(e)
		if t.size() == 1 and f.size() == 2:
			break
	return t + f

static func stars(mistakes: int) -> int:
	return 3 if mistakes <= 1 else (2 if mistakes <= 4 else 1)

static func bits(n: int, width: int) -> Array:
	var out := []
	for i in range(width - 1, -1, -1):
		out.append((n >> i) & 1)
	return out

# ---------- обби ----------
# Строим трассу «курсором»: каждая опора — от края предыдущей, с зазором не больше 4 и подъёмом не больше 1,5
# (прыжок героя: высота ~2, дальность ~6). Для автопилота копим путевые точки.

class Track:
	var w: World
	var c := Vector3.ZERO      # верх-центр дальнего края последней опоры
	var route: Array = []      # путевые точки: {"p": Vector3, "mover": i, "near": Vector3, "far": Vector3}
	var checks := 0
	var quiz: Array = []       # вопросы дверей и моста
	var rng: RandomNumberGenerator
	var grade := 8
	var qs: Array = []         # заранее заготовленные вопросы дверей

	static func to_bits(n: int, width: int) -> Array:
		var out := []
		for i in range(width - 1, -1, -1):
			out.append((n >> i) & 1)
		return out

	func plat(len_z: float, wid: float, gap: float, rise: float, m: String = "grass", k: String = "solid", dx: float = 0.0) -> int:
		var top := c.y + rise
		var p := Vector3(c.x + dx, top - 0.5, c.z + gap + len_z / 2.0)
		var i := w.add({"p": p, "s": Vector3(wid, 1.0, len_z), "k": k, "m": m})
		route.append({"p": Vector3(p.x, top, p.z)})
		c = Vector3(p.x, top, c.z + gap + len_z)
		return i

	func checkpoint() -> void:
		checks += 1
		var i := plat(5.0, 5.0, 2.5, 0.0, "check", "check")
		w.parts[i]["n"] = checks
		route[route.size() - 1]["cp"] = checks

	func lava_under(z0: float, z1: float, y: float, wid: float = 24.0) -> void:
		w.add({"p": Vector3(c.x, y, (z0 + z1) / 2.0), "s": Vector3(wid, 1.0, z1 - z0), "k": "kill", "m": "lava"})

	func coin_at(p: Vector3) -> void:
		w.add({"p": p + Vector3(0, 1.2, 0), "s": Vector3(0.8, 0.8, 0.8), "k": "coin", "m": "coin"})

	func jumps(n: int, gap: float, rise: float, size: float = 3.0) -> void:
		var z0 := c.z
		for i in n:
			var dx: float = 0.0 if i % 2 == 0 else (1.5 if rng.randf() < 0.5 else -1.5)
			var k := plat(size, size, gap, rise if i % 2 == 0 else 0.0, "studs", "solid", dx)
			if i == n / 2:
				coin_at(w.c_top(k))
		lava_under(z0, c.z + 1.0, c.y - 6.0)

	func strips(n: int) -> void:
		# Длинная дорожка с красными полосами-убийцами поперёк: перепрыгивай.
		var ln := 4.0 + n * 5.0
		var i := plat(ln, 4.0, 2.5, 0.0, "neon")
		var z0: float = w.parts[i]["c"].z - ln / 2.0
		route.pop_back()
		for k in n:
			var z := z0 + 4.5 + k * 5.0
			w.add({"p": Vector3(c.x, c.y + 0.15, z), "s": Vector3(4.0, 0.3, 0.6), "k": "kill", "m": "killneon"})
			route.append({"p": Vector3(c.x, c.y, z + 2.2)})
			if k == 1:
				coin_at(Vector3(c.x, c.y, z + 2.2))
		route.append({"p": Vector3(c.x, c.y, c.z - 0.6)})

	func doors() -> void:
		# Три двери с ответами. За неверной — лава, за верной — путь дальше.
		var q: Dictionary = qs.pop_front()
		quiz.append(q)
		var room := plat(6.0, 14.0, 2.5, 0.0, "wood")
		var wall_z := c.z + 0.5
		var top := c.y
		var xs := [-4.5, 0.0, 4.5]
		# стена с тремя проёмами по 3 ширины
		for seg in [[-6.5, 1.0], [-2.25, 1.5], [2.25, 1.5], [6.5, 1.0]]:
			w.add({"p": Vector3(c.x + seg[0], top + 3.0, wall_z), "s": Vector3(seg[1], 6.0, 1.0), "k": "solid", "m": "wall"})
		w.add({"p": Vector3(c.x, top + 5.5, wall_z), "s": Vector3(14.0, 1.0, 1.0), "k": "solid", "m": "wall"})
		w.add({"p": Vector3(c.x, top + 7.5, wall_z - 0.6), "s": Vector3(14.0, 3.0, 0.2), "k": "sign", "m": "sign", "text": q["q"], "code": q.get("code", [])})
		for j in 3:
			var x: float = c.x + xs[j]
			w.add({"p": Vector3(x, top + 2.5, wall_z), "s": Vector3(3.0, 5.0, 0.15), "k": "door", "m": "door", "text": q["opts"][j]})
			# коридор за дверью
			var ok: bool = j == int(q["right"])
			w.add({"p": Vector3(x, top - 0.5, wall_z + 4.0), "s": Vector3(3.0, 1.0, 7.0), "k": "solid" if ok else "kill", "m": "wood" if ok else "lava"})
		for sx in [-2.25, 2.25]:
			w.add({"p": Vector3(c.x + sx, top + 2.0, wall_z + 4.0), "s": Vector3(1.5, 4.0, 7.0), "k": "solid", "m": "wall"})
		for sx in [-6.5, 6.5]:
			w.add({"p": Vector3(c.x + sx, top + 2.0, wall_z + 4.0), "s": Vector3(1.0, 4.0, 7.0), "k": "solid", "m": "wall"})
		var rx: float = c.x + xs[int(q["right"])]
		route.append({"p": Vector3(rx, top, wall_z - 1.5)})
		route.append({"p": Vector3(rx, top, wall_z + 6.5)})
		c = Vector3(rx, top, wall_z + 7.5)

	func mover(gap: float) -> void:
		# Пропасть, через которую возит платформа: ездит вперёд-назад вдоль пути.
		var z0 := c.z
		var ln := 4.0
		var mid := Vector3(c.x, c.y - 0.5, c.z + gap / 2.0)
		var amp := gap / 2.0 - ln / 2.0 - 0.8
		var i := w.add({"p": mid, "s": Vector3(4.0, 1.0, ln), "k": "mover", "m": "metal", "a": Vector3(0, 0, amp), "w": 1.3, "ph": rng.randf() * TAU})
		route.append({"p": mid - Vector3(0, -0.5, amp), "mover": i, "near": mid - Vector3(0, 0, amp), "board": true})
		route.append({"mover": i, "near": mid + Vector3(0, 0, amp), "ride": true})
		c.z = z0 + gap
		plat(5.0, 5.0, 0.0, 0.0, "studs")
		lava_under(z0, c.z, c.y - 6.0)

	func bridge(width: int) -> void:
		# Мост из пар стеклянных плиток: в каждом ряду держит только плитка с верным битом числа.
		var n := rng.randi_range(1 << (width - 1), (1 << width) - 1)
		var b := to_bits(n, width)
		quiz.append({"q": "Мост: %d в двоичной записи (%d бит)" % [n, width], "n": n, "bits": b})
		var start := plat(4.0, 8.0, 2.5, 0.0, "studs")
		w.add({"p": Vector3(c.x, c.y + 3.5, c.z - 0.2), "s": Vector3(8.0, 2.4, 0.2), "k": "sign", "m": "sign", "text": "%d₁₀ = ?₂  · держит только верный бит" % n})
		var z0 := c.z
		var places := []
		for k in width:
			places.append(1 << (width - 1 - k))
		for k in width:
			var z := z0 + 2.0 + k * 3.2
			var one_left := rng.randf() < 0.5
			for side in [-1, 1]:
				var digit: int = 1 if (side < 0) == one_left else 0
				var ok: bool = digit == int(b[k])
				w.add({"p": Vector3(c.x + side * 1.6, c.y - 0.25, z + 1.0), "s": Vector3(2.4, 0.5, 2.0), "k": "glass", "m": "glass", "ok": ok, "text": str(digit), "place": places[k]})
				if ok:
					route.append({"p": Vector3(c.x + side * 1.6, c.y, z + 1.0)})
		c.z = z0 + 2.0 + width * 3.2
		lava_under(z0, c.z + 1.0, c.y - 7.0, 12.0)
		plat(5.0, 6.0, 0.6, 0.0, "studs")

	func logic(rows: int) -> void:
		# Логический мост: в каждом ряду три плитки с выражениями, держит только ИСТИННОЕ.
		var vals := {"A": rng.randf() < 0.5, "B": rng.randf() < 0.5, "C": rng.randf() < 0.5}
		if vals["A"] == vals["B"] and vals["B"] == vals["C"]:
			vals["B"] = not vals["B"]
		var lr: Script = load("res://blox/logic.gd")
		plat(4.0, 9.0, 2.5, 0.0, "studs")
		var sign := "A = %d,  B = %d,  C = %d  ·  держит только ИСТИНА" % [int(vals["A"]), int(vals["B"]), int(vals["C"])]
		w.add({"p": Vector3(c.x, c.y + 3.5, c.z - 0.2), "s": Vector3(9.0, 2.0, 0.2), "k": "sign", "m": "sign", "text": sign})
		quiz.append({"q": sign, "logic": true})
		var z0 := c.z
		for k in rows:
			var row: Array = lr.logic_row(grade, rng, vals)
			KP.shuffle(row, rng)
			var z := z0 + 1.0 + k * 3.0
			for j in 3:
				var x: float = c.x + (j - 1) * 2.6
				w.add({"p": Vector3(x, c.y - 0.25, z + 1.0), "s": Vector3(2.4, 0.5, 2.0), "k": "glass", "m": "logic", "ok": bool(row[j][1]), "text": str(row[j][0])})
				if row[j][1]:
					route.append({"p": Vector3(x, c.y, z + 1.0)})
		c.z = z0 + 1.0 + rows * 3.0
		lava_under(z0, c.z + 1.0, c.y - 7.0, 12.0)
		plat(5.0, 6.0, 0.6, 0.0, "studs")

	func trampoline() -> void:
		# Батут подбрасывает на высокую платформу.
		var i := plat(3.0, 3.0, 2.4, 0.0, "bounce", "bounce")
		w.parts[i]["power"] = 19.0
		route[route.size() - 1]["air"] = true
		plat(5.0, 5.0, 2.2, 4.0, "studs")
		lava_under(c.z - 13.0, c.z + 1.0, c.y - 10.0)

	func conveyor() -> void:
		# Лента поперёк пути тащит героя к лаве — иди быстрее.
		var sgn := 1.0 if rng.randf() < 0.5 else -1.0
		var i := plat(12.0, 5.0, 2.4, 0.0, "belt", "conv")
		w.parts[i]["dir"] = Vector3(3.2 * sgn, 0, 0)
		var mid: Vector3 = route.pop_back()["p"]
		route.append({"p": mid + Vector3(-1.2 * sgn, 0, -5.0)})
		route.append({"p": mid + Vector3(-1.2 * sgn, 0, 5.0)})
		lava_under(c.z - 13.0, c.z + 1.0, c.y - 5.0)

	func lasers(n: int) -> void:
		# Лазеры-перекладины включаются и выключаются по таймеру: проходи, когда погасли.
		var ln := 4.0 + n * 4.0
		plat(ln, 4.0, 2.4, 0.0, "neon")
		var z0: float = c.z - ln
		var last: Dictionary = route.pop_back()
		for k in n:
			var z := z0 + 4.0 + k * 4.0
			var li := w.add({"p": Vector3(c.x, c.y + 1.1, z), "s": Vector3(4.0, 2.2, 0.25), "k": "laser", "m": "laser", "per": 2.6, "ph": rng.randf() * 2.6})
			route.append({"p": Vector3(c.x, c.y, z - 1.6), "laser": li})
		route.append({"p": Vector3(c.x, c.y, c.z - 0.8)})
		lava_under(z0 - 2.0, c.z + 1.0, c.y - 5.0)

	func swing() -> void:
		# Платформа ездит поперёк пропасти: запрыгни, когда она перед тобой, и спрыгни на той стороне.
		var z0 := c.z
		var mid := Vector3(c.x, c.y - 0.5, c.z + 4.6)
		var i := w.add({"p": mid, "s": Vector3(3.2, 1.0, 3.2), "k": "mover", "m": "metal", "a": Vector3(5.0, 0, 0), "w": 1.1, "ph": rng.randf() * TAU})
		route.append({"p": mid + Vector3(0, 0.5, 0), "mover": i, "near": mid, "board": true, "edge": Vector3(c.x, c.y, z0 - 0.5)})
		route.append({"mover": i, "near": mid, "ride": true})
		c.z = z0 + 9.2
		plat(5.0, 5.0, 0.0, 0.0, "studs")
		lava_under(z0, c.z, c.y - 6.0)

	func pick_rows(title: String, rows: Array, wid: float = 2.4) -> void:
		# Общий мост выбора: в каждом ряду несколько плиток, держит только верная. rows: [[варианты], верный]
		plat(4.0, 3.0 + rows[0][0].size() * 2.6, 2.5, 0.0, "studs")
		w.add({"p": Vector3(c.x, c.y + 3.5, c.z - 0.2), "s": Vector3(10.0, 2.2, 0.2), "k": "sign", "m": "sign", "text": title})
		quiz.append({"q": title})
		var z0 := c.z
		for k in rows.size():
			var opts: Array = rows[k][0]
			var z := z0 + 1.0 + k * 3.0
			for j in opts.size():
				var x: float = c.x + (j - (opts.size() - 1) / 2.0) * 2.6
				var ok: bool = j == int(rows[k][1])
				w.add({"p": Vector3(x, c.y - 0.25, z + 1.0), "s": Vector3(wid, 0.5, 2.0), "k": "glass", "m": "logic", "ok": ok, "text": str(opts[j])})
				if ok:
					route.append({"p": Vector3(x, c.y, z + 1.0)})
		c.z = z0 + 1.0 + rows.size() * 3.0
		lava_under(z0, c.z + 1.0, c.y - 7.0, 12.0)
		plat(5.0, 6.0, 0.6, 0.0, "studs")

	func compare(n: int) -> void:
		# «Шагай на большее»: в ряду два числа в разных системах счисления, держит большее.
		var rows := []
		for k in n:
			var a := rng.randi_range(5, 60)
			var b := a + rng.randi_range(1, 9) * (1 if rng.randf() < 0.5 else -1)
			if b <= 0 or b == a:
				b = a + 3
			var pair := [fmt_num(a, grade, rng), fmt_num(b, grade, rng)]
			rows.append([pair, 0 if a > b else 1])
		pick_rows("Шагай на БОЛЬШЕЕ число", rows)

	func digits(base: int) -> void:
		# Мост по разрядам: число в десятичной, иди по цифрам его записи в системе base (старший разряд — первый ряд).
		var n := rng.randi_range(base * 2, base * base * base - 1)
		var ds := String.num_int64(n, base).to_upper()
		var rows := []
		var all := "0123456789ABCDEF".substr(0, base)
		for ch in ds:
			var opts := [ch]
			while opts.size() < 3:
				var o := all[rng.randi() % base]
				if not opts.has(o):
					opts.append(o)
			KP.shuffle(opts, rng)
			rows.append([opts, opts.find(ch)])
		pick_rows("%d₁₀ в %s системе — иди по цифрам" % [n, {8: "восьмеричной", 16: "шестнадцатеричной", 2: "двоичной"}[base]], rows)

	static func fmt_num(v: int, g: int, r: RandomNumberGenerator) -> String:
		var forms := ["dec", "bin"]
		if g >= 8:
			forms.append("hex")
		if g >= 9:
			forms.append("oct")
		match forms[r.randi() % forms.size()]:
			"bin":
				return "%s₂" % String.num_int64(v, 2)
			"hex":
				return "%s₁₆" % String.num_int64(v, 16).to_upper()
			"oct":
				return "%s₈" % String.num_int64(v, 8)
		return str(v)

	func climb(n: int) -> void:
		# Подъём по ступеням-островкам, на средней — вращающаяся балка.
		for k in n:
			var dx: float = [0.0, 2.0, 0.0, -2.0][k % 4]
			plat(3.0, 3.0, 2.2, 1.3, "wood", "solid", dx)
			if k == n / 2:
				var big := plat(7.0, 7.0, 2.0, 0.6, "neon")
				var tp := w.c_top(big)
				route.pop_back()
				route.append({"p": tp + Vector3(0, 0, -3.0)})
				route.append({"p": tp + Vector3(0, 0, 3.0)})
				w.add({"p": tp + Vector3(0, 0.6, 0), "s": Vector3(6.0, 0.6, 0.6), "k": "spin", "m": "killneon", "L": 6.0, "w": 1.8, "ph": 0.0})
				w.add({"p": tp + Vector3(0, 0.6, 0), "s": Vector3(0.8, 1.2, 0.8), "k": "deco", "m": "metal"})
		lava_under(c.z - n * 5.5, c.z + 1.0, c.y - 12.0)

	func vanishers(n: int) -> void:
		for k in n:
			var i := plat(3.0, 3.0, 2.4, 0.0, "vanish", "vanish")
			w.parts[i]["per"] = 3.0
			w.parts[i]["ph"] = -k * 0.9     # волна: следующий блок появляется через 0,9 с — как раз время прыжка
			route[route.size() - 1]["vanish"] = i
		lava_under(c.z - n * 5.4, c.z + 1.0, c.y - 6.0)

	func beams(n: int) -> void:
		for k in n:
			plat(6.0, 1.2, 2.0, 0.0, "metal", "solid", [0.0, 1.5, -1.5][k % 3])
		lava_under(c.z - n * 8.0, c.z + 1.0, c.y - 6.0)

# Большое обби: 40 этапов, каждый заканчивается чекпоинтом; сложность растёт, информатика — через этап.
static func mega_stage(tr: Track, n: int) -> void:
	var r := tr.rng
	var level := 0 if n <= 12 else (1 if n <= 26 else 2)
	if n % 2 == 0:
		var info := ["doors", "bits", "logic", "compare", "digits"]
		if tr.grade <= 7:
			info = ["doors", "bits", "logic", "compare"]
		match info[(n / 2) % info.size()]:
			"doors":
				if tr.qs.is_empty():
					tr.qs.append(question(tr.grade, r, 3))
				tr.doors()
			"bits":
				tr.bridge(clampi(3 + level + (1 if tr.grade >= 9 else 0), 3, 7))
			"logic":
				tr.logic(2 + level)
			"compare":
				tr.compare(2 + level)
			"digits":
				tr.digits(16 if tr.grade >= 9 and r.randf() < 0.6 else 8)
	else:
		var pools := [["jumps", "strips", "trampoline", "conveyor"], ["jumps", "lasers", "mover", "swing", "trampoline", "conveyor"], ["vanish", "beams", "climb", "lasers", "swing", "jumps"]]
		match pools[level][r.randi() % pools[level].size()]:
			"jumps":
				tr.jumps(3 + level, 2.4 + level * 0.4, 0.5 + level * 0.2, 3.0 - level * 0.3)
			"strips":
				tr.strips(2 + level)
			"trampoline":
				tr.trampoline()
			"conveyor":
				tr.conveyor()
			"lasers":
				tr.lasers(2 + level)
			"mover":
				tr.mover(10.0 + level * 2.0)
			"swing":
				tr.swing()
			"vanish":
				tr.vanishers(3 + level)
			"beams":
				tr.beams(2 + level)
			"climb":
				tr.climb(3 + level)
	tr.checkpoint()

static func obby(kind: String, grade: int, seed: int) -> Track:
	var tr := Track.new()
	tr.w = World.new()
	tr.rng = RandomNumberGenerator.new()
	tr.rng.seed = seed
	tr.grade = grade
	for _k in 6:
		tr.qs.append(question(grade, tr.rng, 3))
	# Площадь старта.
	tr.w.add({"p": Vector3(0, -0.5, 0), "s": Vector3(26.0, 1.0, 26.0), "k": "solid", "m": "studs"})
	tr.w.add({"p": Vector3(0, 0.1, -6.0), "s": Vector3(4.0, 0.2, 4.0), "k": "deco", "m": "spawn"})
	tr.c = Vector3(0, 0, 13.0)
	tr.w.spawn = Vector3(0, 0.2, -6.0)
	tr.route.append({"p": Vector3(0, 0, 11.5)})
	var width := 4 if grade <= 7 else (5 if grade <= 9 else 6)
	if kind == "mega":
		for n in range(1, 41):
			mega_stage(tr, n)
	elif kind == "obby":
		tr.jumps(5, 2.6, 0.6)
		tr.checkpoint()
		tr.strips(3)
		tr.doors()
		tr.checkpoint()
		tr.logic(3)
		tr.checkpoint()
		tr.mover(11.0)
		tr.bridge(width)
		tr.checkpoint()
		tr.climb(5)
		tr.doors()
	else:
		tr.jumps(4, 3.2, 0.8, 2.6)
		tr.checkpoint()
		tr.vanishers(4)
		tr.logic(4)
		tr.doors()
		tr.checkpoint()
		tr.bridge(8 if grade >= 8 else 6)
		tr.checkpoint()
		tr.beams(3)
		tr.mover(13.0)
		tr.doors()
		tr.checkpoint()
		tr.climb(6)
		tr.doors()
	var fin := tr.plat(8.0, 8.0, 2.5, 0.0, "gold", "finish")
	tr.w.add({"p": tr.w.c_top(fin) + Vector3(0, 1.5, 2.0), "s": Vector3(1.2, 3.0, 1.2), "k": "deco", "m": "trophy"})
	return tr

# ---------- автопилот (тест и подсказка) ----------
# Возвращает [направление Vector2, прыжок bool] и сдвигает индекс путевой точки в st["i"].

static func autopilot(tr: Track, st: Dictionary) -> Array:
	var w := tr.w
	var i: int = st.get("i", 0)
	if i >= tr.route.size():
		return [Vector2.ZERO, false]
	var wp: Dictionary = tr.route[i]
	var target: Vector3
	if wp.get("ride", false):
		# Едем на платформе, пока она не подъедет к дальнему краю; затем шагаем вперёд.
		var mc: Vector3 = w.center(int(wp["mover"]))
		if (mc - wp["near"]).length() > 0.6 or not w.on_floor:
			var stay := Vector2(mc.x - w.pos.x, mc.z - w.pos.z)
			return [stay.limit_length(1.0) if stay.length() > 0.4 else Vector2.ZERO, false]
		st["i"] = i + 1
		return [Vector2(0, 1), false]
	target = wp["p"]
	if wp.get("board", false):
		var mi: int = int(wp["mover"])
		var mc2: Vector3 = w.center(mi)
		if w.on_floor and w.floor_i == mi:
			st["i"] = i + 1
			return autopilot(tr, st)
		var near: Vector3 = wp["near"]
		if (Vector2(mc2.x, mc2.z) - Vector2(near.x, near.z)).length() > 0.7 and w.on_floor:
			# ждём платформу у края
			var ep: Vector3 = wp.get("edge", Vector3(near.x, near.y, near.z - 3.3))
			var edge := Vector2(ep.x - w.pos.x, ep.z - w.pos.z)
			return [edge.limit_length(1.0) if edge.length() > 0.3 else Vector2.ZERO, false]
		target = Vector3(mc2.x, near.y + 0.5, mc2.z)
	if wp.has("vanish"):
		var vp: Dictionary = w.parts[int(wp["vanish"])]
		if w.on_floor and w.floor_i != int(wp["vanish"]) and fposmod(w.t + float(vp["ph"]), float(vp["per"])) > 0.9:
			return [Vector2.ZERO, false]
	if wp.has("lock"):
		var dl := Vector2(wp["p"].x - w.pos.x, wp["p"].z - w.pos.z)
		if dl.length() < 0.5 and w.on_floor:
			if not w.parts[int(wp["door"])].get("open", false):
				st["need_lock"] = int(wp["lock"])
				return [Vector2.ZERO, false]
			st["i"] = i + 1
			return autopilot(tr, st)
	if wp.get("guard", false):
		# ждём, пока патрульный уйдёт на дальнюю сторону
		for pi in w.near:
			var gp: Dictionary = w.parts[pi]
			if gp.get("m", "") == "guard" and gp["c"].x < 0.8 and absf(gp["c"].z - w.pos.z) < 4.0 and w.on_floor:
				return [Vector2.ZERO, false]
	if wp.has("laser"):
		# ждём, пока лазер погаснет, и сразу проходим
		var lp: Dictionary = w.parts[int(wp["laser"])]
		var dd := Vector2(target.x - w.pos.x, target.z - w.pos.z)
		if dd.length() < 0.5 and w.on_floor:
			var ph := fposmod(w.t + float(lp["ph"]), float(lp["per"]))
			if ph < float(lp["per"]) * 0.5 or ph > float(lp["per"]) * 0.62:
				return [Vector2.ZERO, false]
			st["i"] = i + 1
			return [Vector2(0, 1), false]
	var d := Vector2(target.x - w.pos.x, target.z - w.pos.z)
	if wp.get("air", false) and w.t - w.bounce_t < 0.2:
		st["i"] = i + 1
		return autopilot(tr, st)
	if d.length() < 0.45 and absf(target.y - w.pos.y) < 1.2 and w.on_floor:
		st["i"] = i + 1
		return autopilot(tr, st)
	var dir := d.normalized() if d.length() > 0.001 else Vector2.ZERO
	var jump := false
	if w.on_floor:
		var ahead := w.pos + Vector3(dir.x, 0, dir.y) * 0.75
		if not w.floor_at(ahead) or w.danger_at(ahead + Vector3(0, 0.05, 0)) or (target.y - w.pos.y > 0.5 and d.length() < 3.0):
			jump = true
		# у вращающейся балки прыгаем на подходе
		for pi in w.near:
			var p: Dictionary = w.parts[pi]
			if p["k"] == "spin" and (Vector2(p["c"].x, p["c"].z) - Vector2(w.pos.x, w.pos.z)).length() < 3.4 and absf(p["c"].y - w.pos.y) < 1.5:
				jump = true
	return [dir, jump]

# ---------- тайкун ----------

const TYCOON := [
	{"id": "drop2", "name": "Дроппер №2", "price": 32, "needs": ""},
	{"id": "fast", "name": "Быстрая лента", "price": 64, "needs": "drop2"},
	{"id": "shl", "name": "Апгрейдер «сдвиг влево» ×2", "price": 128, "needs": "drop2"},
	{"id": "drop3", "name": "Дроппер №3 (8 байт)", "price": 256, "needs": "shl"},
	{"id": "walls", "name": "Стены серверной", "price": 384, "needs": "fast"},
	{"id": "add8", "name": "Апгрейдер «+0b1000»", "price": 512, "needs": "drop3"},
	{"id": "drop4", "name": "Дроппер №4 (16 байт)", "price": 1024, "needs": "add8"},
	{"id": "shl2", "name": "Второй сдвиг ×2", "price": 2048, "needs": "drop4"},
	{"id": "super", "name": "СУПЕРСЕРВЕР", "price": 4096, "needs": "shl2"},
]

static func price_text(v: int, grade: int, rng: RandomNumberGenerator) -> String:
	# Цена в одной из записей: биты, степень двойки, двоичная, шестнадцатеричная, килобайты.
	var forms := ["bits", "pow"]
	if grade >= 7:
		forms.append("bin")
	if grade >= 8 and v >= 512:
		forms.append("kb")
	if grade >= 9:
		forms.append("hex")
	var f: String = forms[rng.randi() % forms.size()]
	var pw := 0
	while (1 << pw) < v:
		pw += 1
	if f == "pow" and (1 << pw) != v:
		f = "bits"
	match f:
		"bits":
			return "%d бит" % (v * 8)
		"pow":
			return "2^%d байт" % pw
		"bin":
			return "0b%s байт" % String.num_int64(v, 2)
		"hex":
			return "0x%X байт" % v
		"kb":
			var kb := v / 1024.0
			return ("%s Кбайт" % String.num(kb, 3)).replace(".", ",")
	return "%d байт" % v

static func price_quiz(v: int, label: String, rng: RandomNumberGenerator) -> Dictionary:
	var wrong := [v * 2, v / 2, v * 8, v / 8, v + 8, v * 10]
	var opts: Array = [str(v)]
	KP.shuffle(wrong, rng)
	for x in wrong:
		if opts.size() < 3 and x > 0 and not opts.has(str(x)):
			opts.append(str(x))
	KP.shuffle(opts, rng)
	return {"q": "Цена: %s. Сколько это байт?" % label, "opts": opts, "right": opts.find(str(v)), "code": []}

# Значение кубика на ленте после апгрейдеров (в порядке вдоль ленты).
static func cube_value(base: int, owned: Dictionary) -> int:
	var v := base
	if owned.has("shl"):
		v = v << 1
	if owned.has("add8"):
		v += 8
	if owned.has("shl2"):
		v = v << 1
	return v

# ---------- симулятор ----------

const PACKS := [
	{"name": "Рюкзак «Байт»", "cap": 64, "price": 0},          # вместимость в битах
	{"name": "Рюкзак «Слово»", "cap": 512, "price": 40},
	{"name": "Рюкзак «Сектор»", "cap": 4096, "price": 300},
	{"name": "Рюкзак «Кластер»", "cap": 16384, "price": 2000},
	{"name": "ЛЕГЕНДАРНЫЙ рюкзак", "cap": 131072, "price": 6000},
]
const ZONES := [  # бит в одном шаре и сколько нужно вместимости, чтобы войти
	{"bits": 8, "need": 0},
	{"bits": 64, "need": 512},
	{"bits": 1024, "need": 4096},
]

static func cap_text(bits_n: int) -> String:
	if bits_n % (8 * 1024) == 0:
		return "%d Кбайт" % (bits_n / 8192)
	if bits_n % 8 == 0 and bits_n >= 64:
		return "%d байт" % (bits_n / 8)
	return "%d бит" % bits_n

static func sell_quiz(bits_n: int, rng: RandomNumberGenerator) -> Dictionary:
	var by := bits_n / 8
	var q := "В рюкзаке %d бит. Сколько это байт?" % bits_n
	var right := str(by)
	var wrong := [bits_n * 8, by * 2, by + 8, maxi(1, by / 2), bits_n]
	if by >= 1024 and by % 1024 == 0:
		q = "В рюкзаке %d байт. Сколько это Кбайт?" % by
		right = str(by / 1024)
		wrong = [by / 1000 + 1, by / 8, by / 512, by * 8]
	var opts: Array = [right]
	KP.shuffle(wrong, rng)
	for x in wrong:
		if opts.size() < 3 and not opts.has(str(x)) and int(x) > 0:
			opts.append(str(x))
	KP.shuffle(opts, rng)
	return {"q": q, "opts": opts, "right": opts.find(right), "code": []}

# ---------- «Пол — это лава»: раунды у всего класса по часам сервера ----------

const LAVA_ROUND := 22.0      # 0–14 с — выбираешь плитку, 14–17 — неверные становятся лавой, 17–22 — итоги
const LAVA_PICK := 14.0
const LAVA_BURN := 17.0

static func lava_question(seed: int, r: int, grade: int) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed * 7919 + r * 104729
	# Нужны ровно четыре разных ответа — по одному на плитку.
	for _k in 20:
		var q := question(grade, rng, 4)
		if (q["opts"] as Array).size() == 4:
			return q
	var n := rng.randi_range(5, 30)
	var opts := [String.num_int64(n, 2), String.num_int64(n + 1, 2), String.num_int64(n - 1, 2), String.num_int64(n + 2, 2)]
	return {"q": "Как записать %d в двоичной системе?" % n, "opts": opts, "right": 0, "code": []}

static func lava_phase(t: float) -> Array:
	# [номер раунда, фаза "pick"/"burn"/"rest", секунд до конца фазы]
	var r := int(floor(t / LAVA_ROUND))
	var u := t - r * LAVA_ROUND
	if u < LAVA_PICK:
		return [r, "pick", LAVA_PICK - u]
	if u < LAVA_BURN:
		return [r, "burn", LAVA_BURN - u]
	return [r, "rest", LAVA_ROUND - u]

# ---------- «Побег»: головоломки замков ----------

static func tree(grade: int, rng: RandomNumberGenerator, depth: int) -> Array:
	if depth <= 0:
		var v: String = ["A", "B", "C"][rng.randi() % 3]
		return ["not", ["var", v]] if rng.randf() < 0.3 else ["var", v]
	var a := tree(grade, rng, depth - 1)
	var b := tree(grade, rng, 0)
	var op: String = ["and", "or"][rng.randi() % 2]
	if grade >= 9 and rng.randf() < 0.3:
		return ["not", [op, a, b]]
	return [op, a, b]

static func tree_eval(t: Array, v: Dictionary) -> bool:
	match str(t[0]):
		"var":
			return bool(v.get(t[1], false))
		"not":
			return not tree_eval(t[1], v)
		"and":
			return tree_eval(t[1], v) and tree_eval(t[2], v)
	return tree_eval(t[1], v) or tree_eval(t[2], v)

static func tree_text(t: Array, top: bool = true) -> String:
	match str(t[0]):
		"var":
			return str(t[1])
		"not":
			var inner := tree_text(t[1], false)
			return "не " + (inner if str(t[1][0]) == "var" else "(%s)" % inner)
	var s := "%s %s %s" % [tree_text(t[1], false), "и" if t[0] == "and" else "или", tree_text(t[2], false)]
	return s if top else "(%s)" % s

static func puzzle(kind: String, grade: int, rng: RandomNumberGenerator) -> Dictionary:
	match kind:
		"bits":
			var wd := 4 if grade <= 7 else (6 if grade <= 9 else 8)
			var n := rng.randi_range(1 << (wd - 2), (1 << wd) - 1)
			var shown := str(n)
			if grade >= 9 and rng.randf() < 0.5:
				shown = "0x%X" % n
			return {"kind": "bits", "n": n, "w": wd, "title": "Кодовый замок: зажги лампы так, чтобы получилось число %s" % shown}
		"levers":
			for _k in 50:
				var t := tree(grade, rng, 1 if grade <= 8 else 2)
				var good := 0
				for a in 8:
					if tree_eval(t, {"A": a & 4 != 0, "B": a & 2 != 0, "C": a & 1 != 0}):
						good += 1
				if good >= 1 and good <= 3:
					return {"kind": "levers", "tree": t, "title": "Рычаги A, B, C: дверь откроется, когда выражение ИСТИННО:  " + tree_text(t)}
		"caesar":
			var words := ["БАЙТ", "КОД", "СЕТЬ", "ЦИКЛ", "ФАЙЛ", "ПИКСЕЛЬ", "ПАРОЛЬ", "МАССИВ", "СЕРВЕР", "ЛОГИКА"]
			var abc := "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"
			var wd2: String = words[rng.randi() % words.size()]
			var k := rng.randi_range(1, 5)
			var enc := ""
			for ch in wd2:
				enc += abc[(abc.find(ch) + k) % 32]
			var opts := [wd2]
			for x in words:
				if opts.size() < 4 and x != wd2 and x.length() == wd2.length():
					opts.append(x)
			while opts.size() < 4:
				var y: String = words[rng.randi() % words.size()]
				if not opts.has(y):
					opts.append(y)
			KP.shuffle(opts, rng)
			return {"kind": "choice", "title": "Записка охранника зашифрована Цезарем (сдвиг на %d вперёд): %s. Какое слово — пароль?" % [k, enc], "opts": opts, "right": opts.find(wd2)}
		"order":
			var vals := []
			while vals.size() < 5:
				var v := rng.randi_range(3, 60)
				if not vals.has(v):
					vals.append(v)
			var items := []
			for v in vals:
				items.append([Track.fmt_num(v, grade, rng), v])
			return {"kind": "order", "items": items, "title": "Сейф: нажимай числа по ВОЗРАСТАНИЮ"}
	var q := question(grade, rng, 4)
	return {"kind": "choice", "title": q["q"], "code": q.get("code", []), "opts": q["opts"], "right": q["right"]}

static func puzzle_ok(pz: Dictionary, ans) -> bool:
	match str(pz["kind"]):
		"bits":
			var v := 0
			for b in ans:
				v = v * 2 + (1 if b else 0)
			return v == int(pz["n"]) and (ans as Array).size() == int(pz["w"])
		"levers":
			return ans is Array and ans.size() == 3 and tree_eval(pz["tree"], {"A": bool(ans[0]), "B": bool(ans[1]), "C": bool(ans[2])})
		"order":
			if not (ans is Array) or ans.size() != pz["items"].size():
				return false
			for k in range(1, ans.size()):
				if int(pz["items"][int(ans[k])][1]) <= int(pz["items"][int(ans[k - 1])][1]):
					return false
			return true
	return int(ans) == int(pz["right"])

static func puzzle_solve(pz: Dictionary):
	match str(pz["kind"]):
		"bits":
			var out := []
			for i in range(int(pz["w"]) - 1, -1, -1):
				out.append((int(pz["n"]) >> i) & 1 == 1)
			return out
		"levers":
			for a in 8:
				var v := [a & 4 != 0, a & 2 != 0, a & 1 != 0]
				if tree_eval(pz["tree"], {"A": v[0], "B": v[1], "C": v[2]}):
					return v
		"order":
			var idx := range(pz["items"].size())
			idx.sort_custom(func(a, b): return pz["items"][a][1] < pz["items"][b][1])
			return idx
	return int(pz["right"])

static func escape(grade: int, seed: int) -> Track:
	# Тюрьма Глюка: восемь камер подряд, в каждой — замок с головоломкой и дверь; между камерами — лазеры и патруль.
	var tr := Track.new()
	tr.w = World.new()
	tr.rng = RandomNumberGenerator.new()
	tr.rng.seed = seed
	tr.grade = grade
	var w := tr.w
	w.add({"p": Vector3(0, -0.5, 0), "s": Vector3(16.0, 1.0, 16.0), "k": "solid", "m": "metal"})
	tr.c = Vector3(0, 0, 8.0)
	w.spawn = Vector3(0, 0.2, -4.0)
	var kinds := ["bits", "levers", "caesar", "order", "quiz", "bits", "levers", "order"]
	for n in kinds.size():
		var z0 := tr.c.z
		var pz := puzzle(kinds[n], grade, tr.rng)
		tr.quiz.append(pz)
		# камера: пол, стены по бокам, дверь в конце
		w.add({"p": Vector3(0, -0.5, z0 + 7.0), "s": Vector3(14.0, 1.0, 14.0), "k": "solid", "m": "metal"})
		for sx in [-7.5, 7.5]:
			w.add({"p": Vector3(sx, 3.0, z0 + 7.0), "s": Vector3(1.0, 6.0, 14.0), "k": "solid", "m": "wall"})
		var term := w.add({"p": Vector3(0, 0.15, z0 + 10.5), "s": Vector3(2.6, 0.3, 2.6), "k": "pad", "m": "pad", "text": "ЗАМОК %d" % (n + 1), "id": "lock%d" % n, "lock": n})
		var door := w.add({"p": Vector3(0, 3.0, z0 + 14.0), "s": Vector3(14.0, 6.0, 1.0), "k": "wall", "m": "door_lock", "lock": n})
		w.parts[term]["door"] = door
		if n % 2 == 1:
			# патрульный робот ходит поперёк камеры
			w.add({"p": Vector3(0, 0.9, z0 + 6.0), "s": Vector3(1.4, 1.8, 1.4), "k": "kill", "m": "guard", "a": Vector3(5.6, 0, 0), "w": 1.4, "ph": tr.rng.randf() * TAU})
			tr.route.append({"p": Vector3(-6.3, 0, z0 + 3.0)})
			tr.route.append({"p": Vector3(-6.3, 0, z0 + 9.0), "guard": true})
		tr.route.append({"p": Vector3(0, 0, z0 + 10.5), "lock": n, "door": door})
		tr.route.append({"p": Vector3(0, 0, z0 + 14.2)})
		tr.c = Vector3(0, 0, z0 + 14.5)
		if n < kinds.size() - 1:
			# коридор с лазерами к следующей камере
			if n % 3 == 2:
				tr.lasers(2)
			else:
				tr.jumps(2, 2.2, 0.0, 3.0)
			tr.c.y = 0.0
	tr.plat(8.0, 8.0, 2.0, 0.0, "gold", "finish")
	return tr
