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
const SOLID := ["solid", "check", "finish", "mover", "glass", "vanish", "wall"]

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

	func add(p: Dictionary) -> int:
		if not p.has("k"):
			p["k"] = "solid"
		p["c"] = p["p"]                 # текущий центр (у движущихся меняется)
		parts.append(p)
		return parts.size() - 1

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
		for i in parts.size():
			var p: Dictionary = parts[i]
			if p["k"] == "mover":
				var nc := mover_at(p, t)
				if on_floor and floor_i == i:
					carry = nc - p["c"]
				p["c"] = nc
		pos += carry
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
			for i in parts.size():
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
		for i in parts.size():
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
		# Стеклянная плитка с неверным ответом лопается под героем.
		if on_floor and parts[floor_i]["k"] == "glass" and not parts[floor_i].get("ok", false):
			parts[floor_i]["broken"] = true
			wrong += 1
			on_floor = false
			ev.append({"e": "glass", "i": floor_i})
		var now := {}
		for i in parts.size():
			var p: Dictionary = parts[i]
			var k: String = p["k"]
			if k == "kill" and overlap(i, pos, 0.02):
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
		vel = Vector3.ZERO
		on_floor = false
		floor_i = -1
		return [{"e": "die", "why": why}]

	# Есть ли опора чуть впереди и ниже (для автопилота и ботов).
	func floor_at(at: Vector3) -> bool:
		for i in parts.size():
			if solid(i):
				var c: Vector3 = parts[i]["c"]
				var h: Vector3 = parts[i]["s"] / 2.0
				if absf(at.x - c.x) < h.x and absf(at.z - c.z) < h.z and c.y + h.y <= at.y + 0.5 and c.y + h.y >= at.y - 2.2:
					return true
		return false

	func danger_at(at: Vector3) -> bool:
		for i in parts.size():
			var k: String = parts[i]["k"]
			if k == "kill" and overlap(i, at, 0.1):
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

static func obby(kind: String, grade: int, seed: int) -> Track:
	var tr := Track.new()
	tr.w = World.new()
	tr.rng = RandomNumberGenerator.new()
	tr.rng.seed = seed
	tr.grade = grade
	for _k in 5:
		tr.qs.append(question(grade, tr.rng, 3))
	# Площадь старта.
	tr.w.add({"p": Vector3(0, -0.5, 0), "s": Vector3(26.0, 1.0, 26.0), "k": "solid", "m": "studs"})
	tr.w.add({"p": Vector3(0, 0.1, -6.0), "s": Vector3(4.0, 0.2, 4.0), "k": "deco", "m": "spawn"})
	tr.c = Vector3(0, 0, 13.0)
	tr.w.spawn = Vector3(0, 0.2, -6.0)
	tr.route.append({"p": Vector3(0, 0, 11.5)})
	var width := 4 if grade <= 7 else (5 if grade <= 9 else 6)
	if kind == "obby":
		tr.jumps(5, 2.6, 0.6)
		tr.checkpoint()
		tr.strips(3)
		tr.doors()
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
		if absf(mc2.z - near.z) > 0.7 and w.on_floor:
			# ждём платформу у края
			var edge := Vector2(near.x - w.pos.x, near.z - 3.3 - w.pos.z)
			return [edge.limit_length(1.0) if edge.length() > 0.3 else Vector2.ZERO, false]
		target = Vector3(mc2.x, near.y + 0.5, mc2.z)
	if wp.has("vanish"):
		var vp: Dictionary = w.parts[int(wp["vanish"])]
		if w.on_floor and w.floor_i != int(wp["vanish"]) and fposmod(w.t + float(vp["ph"]), float(vp["per"])) > 0.9:
			return [Vector2.ZERO, false]
	var d := Vector2(target.x - w.pos.x, target.z - w.pos.z)
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
		for p in w.parts:
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
