extends RefCounted
# «Клетки памяти»: большие уровни в духе Dead Cells. Уровень — сетка комнат: главный путь от входа к выходу
# и ответвления в разные стороны (тупики с сокровищами, лавки, комнаты с терминалами). Между этажами — лестницы
# и лифты, внутри комнат — ярусы проходимых снизу платформ, шипы. Без графики — проверяется tests/cells.gd.
#
# Клетки карты: # камень, = платформа (стоять можно, снизу проходима), H лестница, ^ шипы, K дверь знаний (закрыта, как камень).

const RW := 26          # ширина комнаты в клетках
const RH := 14          # высота комнаты: ряд 0 — потолок, 13 — пол, ходят по ряду 12
const BIOMES := {
	"grove": {"name": "Тихая роща", "tint": Color(1, 1, 1)},
	"forest": {"name": "Лес данных", "tint": Color(0.85, 0.95, 1.0)},
	"catacomb": {"name": "Грибные катакомбы", "tint": Color(0.9, 0.85, 1.0)},
	"waste": {"name": "Пустошь битых файлов", "tint": Color(1.0, 0.9, 0.82)},
	"vault": {"name": "Хранилище кэша", "tint": Color(0.85, 0.95, 1.0)},
	"lair": {"name": "Логово Глюка", "tint": Color(0.75, 0.7, 0.95)},
}
# Развилки маршрута: на этапе 2 и 3 из «Перехода» ведут две двери в разные биомы.
const ROUTE := [["grove"], ["forest", "catacomb"], ["waste", "catacomb", "forest"], ["vault"], ["lair"]]
const GRID := [Vector2i(5, 3), Vector2i(6, 3), Vector2i(6, 4), Vector2i(6, 4), Vector2i(5, 4)]
# Босс в конце этапа (после выхода из уровня — арена).
const BOSS := ["", "", "spam", "guard", "glitch"]
# Враги этапа: чем глубже, тем хитрее набор.
const POOLS := [
	["slime", "slime", "fly", "frog", "skel"],
	["slime", "fly", "frog", "bee", "shield", "bomber"],
	["frog", "bee", "shield", "skel", "bomber", "worm", "turret"],
	["bee", "shield", "skel", "bomber", "wraith", "worm", "turret"],
	["shield", "skel", "bomber", "wraith", "worm", "turret", "bee"],
]
const FLYING := ["fly", "bee", "wraith"]

static func options(stage: int, visited: Array) -> Array:
	# Какие биомы можно выбрать для этапа (без уже пройденных, если есть выбор).
	var out := []
	for b in ROUTE[stage]:
		if not visited.has(b):
			out.append(b)
	if out.is_empty():
		out = [ROUTE[stage][0]]
	return out.slice(0, 2)

# ---------- сборка уровня ----------

static func build(stage: int, biome: String, rng: RandomNumberGenerator) -> Dictionary:
	var gx: int = GRID[stage].x
	var gy: int = GRID[stage].y
	var w := gx * RW
	var h := gy * RH
	var t := []
	for y in h:
		var row := []
		row.resize(w)
		row.fill("#")
		t.append(row)
	# 1. Граф комнат: главный путь слева направо с подъёмами и спусками.
	var rooms := {}
	var links := []
	var start := Vector2i(0, rng.randi_range(0, gy - 1))
	rooms[start] = {"kind": "path"}
	var cur := start
	var guard := 0
	while cur.x < gx - 1 and guard < 200:
		guard += 1
		var opts := [Vector2i(1, 0), Vector2i(1, 0)]
		if cur.y > 0:
			opts.append(Vector2i(0, -1))
		if cur.y < gy - 1:
			opts.append(Vector2i(0, 1))
		var d: Vector2i = opts[rng.randi() % opts.size()]
		var nxt := cur + d
		if rooms.has(nxt):
			nxt = cur + Vector2i(1, 0)
			if rooms.has(nxt):
				continue
		rooms[nxt] = {"kind": "path"}
		links.append([cur, nxt])
		cur = nxt
	var finish := cur
	# 2. Ответвления: комнаты в стороны от уже построенных, пока не займут три четверти сетки.
	var target := int(gx * gy * 0.8)
	for attempt in 400:
		if rooms.size() >= target:
			break
		var keys := rooms.keys()
		var from: Vector2i = keys[rng.randi() % keys.size()]
		var dirs := [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
		var d: Vector2i = dirs[rng.randi() % 4]
		var to := from + d
		if to.x < 0 or to.y < 0 or to.x >= gx or to.y >= gy or rooms.has(to):
			continue
		rooms[to] = {"kind": "side"}
		links.append([from, to])
	rooms[start]["kind"] = "start"
	rooms[finish]["kind"] = "exit"
	# 3. Вырезаем комнаты.
	for c in rooms:
		for y in range(1, RH - 1):
			for x in range(1, RW - 1):
				t[c.y * RH + y][c.x * RW + x] = " "
	var lifts := []
	var shafts := {}            # комната → занятые столбцы шахты
	var kdoors := []
	for l in links:
		var a: Vector2i = l[0]
		var b: Vector2i = l[1]
		if a.y == b.y:
			var left := a if a.x < b.x else b
			var wx := (left.x + 1) * RW
			for y in range(RH - 4, RH - 1):
				t[left.y * RH + y][wx - 1] = " "
				t[left.y * RH + y][wx] = " "
		else:
			var up := a if a.y < b.y else b
			# Столбец шахты не должен задевать другие шахты этих двух комнат (иначе низ лестницы окажется над дырой лифта).
			var used: Array = shafts.get(up, []) + shafts.get(up + Vector2i(0, 1), [])
			var cx: int = -1
			for margin in [3, 1]:
				var free_cols := []
				for x in range(up.x * RW + 5, up.x * RW + RW - 6):
					var clash := false
					for u in used:
						if absi(u - x) <= margin or absi(u - x - 1) <= margin:
							clash = true
					if not clash:
						free_cols.append(x)
				if not free_cols.is_empty():
					cx = free_cols[rng.randi() % free_cols.size()]
					break
			if cx < 0:
				cx = up.x * RW + rng.randi_range(5, RW - 7)
			var yf := up.y * RH + RH - 1          # пол верхней комнаты
			var yc := (up.y + 1) * RH             # потолок нижней
			var low_floor := (up.y + 1) * RH + RH - 1
			shafts[up] = shafts.get(up, []) + [cx, cx + 1]
			shafts[up + Vector2i(0, 1)] = shafts.get(up + Vector2i(0, 1), []) + [cx, cx + 1]
			if rng.randf() < 0.5:
				# Лифт: платформа ездит между полом нижней комнаты и полом верхней.
				for x in [cx, cx + 1]:
					t[yf][x] = " "
					t[yc][x] = " "
				lifts.append({"x": (cx + 1) * 1.0, "top": yf * 1.0, "bottom": low_floor * 1.0})
			else:
				for x in [cx, cx + 1]:
					t[yf][x] = "="
					t[yc][x] = " "
				for y in range(yc, low_floor):
					t[y][cx] = "H"
	# 4. Начинка комнат.
	var things := []
	var spots := {}             # комната → места, где можно стоять: [x, y] клетки
	var tiers := {}
	for c in rooms:
		var x0: int = c.x * RW
		var y0: int = c.y * RH
		var busy: Array = shafts.get(c, [])
		var room_spots := []
		for x in range(x0 + 2, x0 + RW - 2):
			if not busy.has(x):
				room_spots.append([x, y0 + RH - 2])
		# Ярусы платформ: каждый следующий перекрывает предыдущий хотя бы на две клетки — допрыгнуть можно всегда.
		var prev := [x0 + rng.randi_range(4, 9), 0]
		prev[1] = prev[0] + rng.randi_range(5, 9)
		var n_tiers: int = 1 + rng.randi() % 3 if rooms[c]["kind"] != "start" else 1
		var room_tiers := []
		for k in n_tiers:
			var ty: int = y0 + RH - 1 - 3 * (k + 1)
			var len := rng.randi_range(4, 8)
			var sx: int = clampi(rng.randi_range(prev[0] - len + 2, prev[1] - 2), x0 + 3, x0 + RW - 4 - len)
			var segs := [[sx, sx + len]]
			if rng.randf() < 0.5:
				var sx2: int = sx + len + rng.randi_range(2, 3)          # до соседней платформы яруса можно допрыгнуть с первой
				var len2 := rng.randi_range(3, 6)
				if sx2 + len2 < x0 + RW - 3:
					segs.append([sx2, sx2 + len2])
			for s in segs:
				for x in range(s[0], s[1]):
					if not busy.has(x) and t[ty][x] == " ":
						t[ty][x] = "="
						room_spots.append([x, ty - 1])
			room_tiers.append([ty, segs])
			prev = segs[0]
		tiers[c] = room_tiers
		# Шипы на полу — в обычных комнатах, если есть где перепрыгнуть.
		if rooms[c]["kind"] in ["path", "side"] and rng.randf() < 0.45:
			var sx := x0 + rng.randi_range(7, RW - 10)
			var ok := true
			for x in range(sx - 4, sx + 7):
				if busy.has(x):
					ok = false          # у шахты лифта шипы не ставим: вместе с дырой получится непреодолимый провал
			if ok:
				for x in range(sx, sx + 3):
					t[y0 + RH - 2][x] = "^"
					room_spots.erase([x, y0 + RH - 2])
		spots[c] = room_spots
	# 5. Особые комнаты.
	var degree := {}
	for l in links:
		degree[l[0]] = degree.get(l[0], 0) + 1
		degree[l[1]] = degree.get(l[1], 0) + 1
	var dead_ends := []
	for c in rooms:
		if rooms[c]["kind"] == "side" and degree.get(c, 0) == 1:
			dead_ends.append(c)
	dead_ends.shuffle()
	# Сокровищница: тупик с сундуком и свитком; если вход сбоку — его закрывает дверь знаний.
	for k in mini(2, dead_ends.size()):
		var c: Vector2i = dead_ends[k]
		rooms[c]["kind"] = "treasure"
		var l: Array = links.filter(func(q): return q[0] == c or q[1] == c)[0]
		var other: Vector2i = l[0] if l[1] == c else l[1]
		if other.y == c.y and k == 0:
			var wx: int = (c.x * RW) if other.x < c.x else (c.x * RW + RW - 1)
			for y in range(RH - 4, RH - 1):
				t[c.y * RH + y][wx] = "K"
			kdoors.append({"x": wx, "y": c.y * RH + RH - 2, "room": c})
			rooms[c]["locked"] = true
	if stage >= 1 and dead_ends.size() > 2 and rng.randf() < 0.75:
		rooms[dead_ends[2]]["kind"] = "shop"
	# Тайные комнаты: тупик, вход в который закрыт трескающейся стеной B (3 удара или граната). Внутри — клетки, байты, свиток.
	var secrets := []
	for k in range(3, dead_ends.size()):
		if secrets.size() >= (1 if stage < 2 else 2):
			break
		var c: Vector2i = dead_ends[k]
		var l: Array = links.filter(func(q): return q[0] == c or q[1] == c)[0]
		var other: Vector2i = l[0] if l[1] == c else l[1]
		if other.y != c.y:
			continue
		rooms[c]["kind"] = "secret"
		var wx: int = (c.x * RW) if other.x < c.x else (c.x * RW + RW - 1)
		for y in range(RH - 4, RH - 1):
			t[c.y * RH + y][wx] = "B"
		secrets.append({"x": wx, "y": c.y * RH + RH - 2, "room": c})
	var free := rooms.keys().filter(func(c): return rooms[c]["kind"] in ["path", "side"])
	free.shuffle()
	# Три терминала знаний — в разных обычных комнатах.
	for k in mini(3, free.size()):
		rooms[free[k]]["term"] = true
	# Проклятый сундук: большая награда, но следующие 10 побед любой удар смертелен.
	if stage >= 1 and free.size() > 3 and rng.randf() < 0.6:
		rooms[free[3]]["cursed"] = true
	# Предметы и враги.
	var pool: Array = POOLS[stage]
	var elites := 1 + int(stage >= 2)
	for c in rooms:
		var kind: String = rooms[c]["kind"]
		var sp: Array = spots[c].duplicate()
		sp.shuffle()
		var floor_sp: Array = sp.filter(func(s): return s[1] == c.y * RH + RH - 2)
		var high_sp: Array = sp.filter(func(s): return s[1] < c.y * RH + RH - 2)
		var take := func(list: Array) -> Array:
			if list.is_empty():
				return []
			var s: Array = list.pop_back()
			sp.erase(s)
			floor_sp.erase(s)
			high_sp.erase(s)
			return s
		match kind:
			"start":
				var s: Array = [c.x * RW + 3, c.y * RH + RH - 2]
				things.append({"kind": "start", "x": s[0], "y": s[1]})
			"exit":
				things.append({"kind": "portal", "x": c.x * RW + RW - 5, "y": c.y * RH + RH - 2})
			"treasure":
				var s1 = take.call(high_sp if not high_sp.is_empty() else floor_sp)
				if s1:
					things.append({"kind": "chest", "x": s1[0], "y": s1[1]})
				var s2 = take.call(floor_sp)
				if s2:
					things.append({"kind": "scroll", "x": s2[0], "y": s2[1]})
				var s3 = take.call(floor_sp)
				if s3:
					things.append({"kind": "food", "x": s3[0], "y": s3[1]})
			"secret":
				for kk in ["cells", "gold", "scroll" if rng.randf() < 0.5 else "food"]:
					var s = take.call(floor_sp)
					if s:
						things.append({"kind": kk, "x": s[0], "y": s[1]})
			"shop":
				floor_sp.sort_custom(func(a, b): return absi(a[0] - c.x * RW - RW / 2) > absi(b[0] - c.x * RW - RW / 2))
				var s = take.call(floor_sp)
				if s:
					things.append({"kind": "shop", "x": s[0], "y": s[1]})
		if rooms[c].get("cursed", false):
			var s = take.call(floor_sp)
			if s:
				things.append({"kind": "cchest", "x": s[0], "y": s[1]})
		if rooms[c].get("term", false):
			var s = take.call(floor_sp)
			if s:
				things.append({"kind": "term", "x": s[0], "y": s[1]})
		if kind in ["path", "side", "exit"]:
			var n: int = 2 + rng.randi() % (2 + stage / 2) + (1 if kind == "exit" else 0)
			for i in n:
				var foe: String = pool[rng.randi() % pool.size()]
				var s = take.call(sp if FLYING.has(foe) or foe == "turret" else floor_sp)
				if s == null or s.is_empty():
					continue
				var thing := {"kind": foe, "x": s[0], "y": s[1] - (2 if FLYING.has(foe) else 0)}
				if elites > 0 and kind != "start" and rng.randf() < 0.25:
					thing["elite"] = true
					elites -= 1
				things.append(thing)
			if rng.randf() < 0.35:
				var s = take.call(high_sp)
				if s:
					things.append({"kind": "food" if rng.randf() < 0.5 else "gold", "x": s[0], "y": s[1]})
			if rng.randf() < 0.2:
				var s = take.call(high_sp)
				if s:
					things.append({"kind": "chest", "x": s[0], "y": s[1]})
	var rows := []
	for row in t:
		rows.append("".join(row))
	var room_list := []
	for c in rooms:
		room_list.append({"cell": c, "kind": rooms[c]["kind"], "locked": rooms[c].get("locked", false)})
	var out := {"rows": rows, "w": w, "h": h, "things": things, "lifts": lifts, "kdoors": kdoors, "secrets": secrets, "rooms": room_list, "links": links, "grid": Vector2i(gx, gy), "biome": biome, "stage": stage}
	_fix_reach(out)
	return out

static func _fix_reach(m: Dictionary) -> void:
	# Последняя проверка: всё, к чему надо подойти, должно быть достижимо от входа.
	# Редкие неудачные сочетания платформ и шахт исправляем, переставляя предмет на достижимое место той же комнаты.
	var closed := reach(m)
	var opened := reach(m, true)
	var taken := {}
	for th in m["things"]:
		taken[Vector2i(th["x"], th["y"])] = true
	for th in m["things"]:
		if FLYING.has(th["kind"]) or th["kind"] == "start":
			continue
		var need: Dictionary = closed if th["kind"] in ["portal", "term", "shop"] else opened
		var at := Vector2i(th["x"], th["y"])
		if need.has(at):
			continue
		var room := Vector2i(at.x / RW, at.y / RH)
		var best := Vector2i(-1, -1)
		for q in need:
			if q.x / RW == room.x and q.y / RH == room.y and not taken.has(q) and m["rows"][q.y][q.x] == " ":
				if best.x < 0 or absi(q.y - at.y) * 4 + absi(q.x - at.x) < absi(best.y - at.y) * 4 + absi(best.x - at.x):
					best = q
		if best.x >= 0:
			taken.erase(at)
			taken[best] = true
			th["x"] = best.x
			th["y"] = best.y

# ---------- арена босса и «Переход» ----------

static func arena(stage: int) -> Dictionary:
	# Широкий зал: пол, два яруса платформ по краям и в центре.
	var w := 40
	var h := RH
	var t := []
	for y in h:
		var row := []
		row.resize(w)
		row.fill("#" if y == 0 or y == h - 1 else " ")
		row[0] = "#"
		row[w - 1] = "#"
		t.append(row)
	for seg in [[4, 10, 10], [30, 36, 10], [16, 24, 7], [3, 8, 4], [32, 37, 4]]:
		for x in range(seg[0], seg[1]):
			t[seg[2]][x] = "="
	var things := [{"kind": "start", "x": 3, "y": h - 2}, {"kind": "boss", "x": 22, "y": h - 2}]
	if BOSS[stage] == "glitch":
		things.append({"kind": "bterm", "x": 20, "y": h - 2})
	var rows := []
	for row in t:
		rows.append("".join(row))
	return {"rows": rows, "w": w, "h": h, "things": things, "lifts": [], "kdoors": [], "rooms": [{"cell": Vector2i(0, 0), "kind": "arena", "locked": false}], "links": [], "grid": Vector2i(1, 1), "boss": BOSS[stage]}

static func passage(doors: Array) -> Dictionary:
	# «Переход» между этапами: фонтан пополняет фляги, торговец продаёт, Коллекционер принимает клетки, двери ведут дальше.
	var w := 36
	var h := RH
	var t := []
	for y in h:
		var row := []
		row.resize(w)
		row.fill("#" if y == 0 or y == h - 1 else " ")
		row[0] = "#"
		row[w - 1] = "#"
		t.append(row)
	var things := [{"kind": "start", "x": 2, "y": h - 2}, {"kind": "fountain", "x": 8, "y": h - 2}, {"kind": "shop", "x": 15, "y": h - 2}, {"kind": "collector", "x": 22, "y": h - 2}]
	for i in doors.size():
		things.append({"kind": "door", "x": 28 + i * 4, "y": h - 2, "to": doors[i]})
	var rows := []
	for row in t:
		rows.append("".join(row))
	return {"rows": rows, "w": w, "h": h, "things": things, "lifts": [], "kdoors": [], "rooms": [{"cell": Vector2i(0, 0), "kind": "passage", "locked": false}], "links": [], "grid": Vector2i(1, 1)}

# ---------- проверка проходимости (для тестов и отладки) ----------

static func solid(rows: Array, x: int, y: int) -> bool:
	if y < 0 or y >= rows.size() or x < 0 or x >= rows[0].length():
		return true
	return rows[y][x] == "#" or rows[y][x] == "K" or rows[y][x] == "B"

static func stand(rows: Array, x: int, y: int) -> bool:
	# Можно стоять: клетка и над ней свободны, под ногами камень или платформа, не шипы.
	if y < 1 or y >= rows.size() - 1 or solid(rows, x, y) or solid(rows, x, y - 1) or rows[y][x] == "^":
		return false
	var below: String = rows[y + 1][x]
	return below == "#" or below == "=" or below == "K" or below == "B"

static func reach(map: Dictionary, open_doors: bool = false) -> Dictionary:
	# Модель героя: шаг и прыжок до 3 клеток вверх и 4 в сторону, падение, лестницы (с них можно спрыгнуть), лифты.
	var rows: Array = map["rows"]
	var w: int = rows[0].length()
	var h: int = rows.size()
	# Таблица клеток: 1 — камень, 2 — платформа, 3 — лестница, 4 — шипы.
	var g := PackedByteArray()
	g.resize(w * h)
	for y in h:
		var r: String = rows[y]
		for x in w:
			var ch := r[x]
			g[y * w + x] = 1 if ch == "#" or ((ch == "K" or ch == "B") and not open_doors) else 2 if ch == "=" else 3 if ch == "H" else 4 if ch == "^" else 0
	var sol := func(x: int, y: int) -> bool:
		return x < 0 or y < 0 or x >= w or y >= h or g[y * w + x] == 1
	var st := func(x: int, y: int) -> bool:
		if x < 0 or x >= w or y < 1 or y >= h - 1:
			return false
		var c: int = g[y * w + x]
		var b: int = g[(y + 1) * w + x]
		return c != 1 and c != 4 and g[(y - 1) * w + x] != 1 and (b == 1 or b == 2)
	var start := Vector2i(-1, -1)
	for th in map["things"]:
		if th["kind"] == "start":
			start = Vector2i(th["x"], th["y"])
	var lift_ends := []
	for l in map["lifts"]:
		lift_ends.append([Vector2i(int(l["x"]) - 1, int(l["bottom"]) - 1), Vector2i(int(l["x"]) - 1, int(l["top"]) - 1)])
	var seen := {start: true}
	var queue := [start]
	while not queue.is_empty():
		var p: Vector2i = queue.pop_back()
		var next := []
		for dx in range(-4, 5):
			var x: int = p.x + dx
			if x < 0 or x >= w:
				continue
			# прыжок вверх или на тот же уровень: над головой по пути свободно
			for dy in range(-3, 1):
				var y: int = p.y + dy
				if not st.call(x, y):
					continue
				var ok := true
				var top: int = mini(p.y, y) - 1
				for step in range(1, absi(dx) + 1):
					var cx: int = p.x + step * signi(dx)
					if sol.call(cx, top) or (dy < 0 and sol.call(cx, top - 1)) or (step < absi(dx) and sol.call(cx, p.y)):
						ok = false
						break
				if ok:
					next.append(Vector2i(x, y))
			# шаг или прыжок в сторону и падение вниз по столбцу x
			var clear := true
			for step in range(1, absi(dx) + 1):
				if sol.call(p.x + step * signi(dx), p.y) or sol.call(p.x + step * signi(dx), p.y - 1):
					clear = false
			if clear and dx != 0:
				var y: int = p.y + 1
				while y < h - 1 and not sol.call(x, y):
					if st.call(x, y):
						next.append(Vector2i(x, y))
						break
					y += 1
		# лестница
		if g[p.y * w + p.x] == 3 or (p.y + 1 < h and g[(p.y + 1) * w + p.x] in [2, 3]):
			for dy in [-1, 1]:
				var y: int = p.y
				while true:
					y += dy
					if y < 1 or y >= h - 1:
						break
					var c: int = g[y * w + p.x]
					var on_ladder: bool = c == 3 or (c == 2 and g[(y + 1) * w + p.x] == 3) or (dy < 0 and g[(y + 1) * w + p.x] == 3)
					if not on_ladder and c != 3:
						if st.call(p.x, y):
							next.append(Vector2i(p.x, y))
						break
					for xx in range(p.x - 4, p.x + 5):
						for yy in range(y - 3, y + 1):
							if st.call(xx, yy):
								next.append(Vector2i(xx, yy))
		for e in lift_ends:
			for k in 2:
				if absi(p.x - e[k].x) <= 2 and absi(p.y - e[k].y) <= 1:
					next.append(e[1 - k])
		for q in next:
			if not seen.has(q):
				seen[q] = true
				queue.append(q)
	return seen
