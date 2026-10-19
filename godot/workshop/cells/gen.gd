extends RefCounted
# «Клетки памяти»: сборка зон из готовых кусков. Без графики — проверяется tests/cells.gd.
# Кусок шириной 20 клеток: семь рядов «воздуха» (ряды 4–10 экрана) и строка земли (ряд 11 и ниже).
# Знаки: # камень, ^ шипы, s слизень, f муха, g жаба, t пчела-стрелок, T терминал знаний, c байты, h сердце, D дверь,
# C сундук с оружием, J пружина (подбрасывает высоко; путь через кусок всегда есть и без неё).

const W := 20
const H := 15
const GROUND := 11
const EMPTY := "                    "
const FULL := "####################"

const CHUNKS := {
	"start": {"air": [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], "ground": FULL},
	"door": {"air": [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, "              D     "], "ground": FULL},
	"flat": {"air": [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, "         c          ", "     s       s      "], "ground": FULL},
	"pit": {"air": [EMPTY, EMPTY, EMPTY, EMPTY, "        c           ", EMPTY, "    s          s    "], "ground": "#######   ##########"},
	"spikes": {"air": [EMPTY, EMPTY, EMPTY, "        cc          ", EMPTY, "     ########       ", "      ^^^^^^   s    "], "ground": FULL},
	"hill": {"air": [EMPTY, EMPTY, "          t         ", EMPTY, "         c          ", "        ####        ", "   s  ########      "], "ground": FULL},
	"bridge": {"air": [EMPTY, EMPTY, "          f         ", "       c    c       ", EMPTY, "      ###  ###      ", EMPTY], "ground": "####            ####"},
	"pond": {"air": [EMPTY, EMPTY, EMPTY, EMPTY, "      c     c       ", EMPTY, "   s     g      s   "], "ground": "######  ####  ######"},
	"tower": {"air": [EMPTY, EMPTY, EMPTY, "          c         ", "          ##        ", "         ###        ", "    s   ####    f   "], "ground": FULL},
	"gauntlet": {"air": [EMPTY, EMPTY, "            t       ", EMPTY, EMPTY, EMPTY, "     s    s    s    "], "ground": FULL},
	"swarm": {"air": [EMPTY, "       f     f      ", EMPTY, "          f         ", EMPTY, EMPTY, "         h          "], "ground": FULL},
	"steps": {"air": [EMPTY, EMPTY, EMPTY, "              c     ", "            ####    ", "       ###          ", "   ##          g    "], "ground": "#####          #####"},
	"terminal": {"air": [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, "     s    T    s    "], "ground": FULL},
	"shrine": {"air": [EMPTY, EMPTY, "      f             ", EMPTY, "          T         ", "        #####       ", "              s     "], "ground": FULL},
	"vault": {"air": [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, "       ^^ T ^^      "], "ground": FULL},
	"arena": {"air": [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], "ground": FULL},
	# Куски второй волны: больше высоты, сундуки и пружины.
	"cliffs": {"air": [EMPTY, EMPTY, "              c     ", "             ###    ", "        ###         ", "   ###              ", "  s          g      "], "ground": FULL},
	"canyon": {"air": [EMPTY, EMPTY, "         f          ", EMPTY, "      c      c      ", EMPTY, "   s     C      s   "], "ground": "#####   ####   #####"},
	"ladder": {"air": ["         C          ", "        ###         ", EMPTY, "   ###        ###   ", EMPTY, "        ###         ", "  J    s      g     "], "ground": FULL},
	"spikefield": {"air": [EMPTY, EMPTY, "          f         ", "       c    c       ", EMPTY, EMPTY, "    ^^^  ##  ^^^    "], "ground": FULL},
	"sky": {"air": [EMPTY, "         f          ", EMPTY, "            c       ", "           ###      ", "      ###           ", EMPTY], "ground": "####            ####"},
	"bunker": {"air": [EMPTY, EMPTY, EMPTY, "   ##############   ", EMPTY, EMPTY, "     s   g     s    "], "ground": FULL},
	"treasure": {"air": [EMPTY, EMPTY, EMPTY, "         C          ", "       #####        ", EMPTY, "   s J          g   "], "ground": FULL},
	"pillars": {"air": [EMPTY, EMPTY, "    f          f    ", "         c          ", EMPTY, "     #    #    #    ", "  s  #    #    #  s "], "ground": FULL},
	"nest": {"air": [EMPTY, " f      f      f    ", EMPTY, "          h         ", "        #####       ", "     ##             ", "                 t  "], "ground": FULL},
}
const PLAIN := ["flat", "pit", "spikes", "hill", "bridge", "pond", "tower", "gauntlet", "swarm", "steps", "cliffs", "canyon", "ladder", "spikefield", "sky", "bunker", "treasure", "pillars", "nest"]
# Какие куски встречаются в зоне: чем дальше, тем опаснее набор. В каждой зоне есть хотя бы один кусок с сундуком.
const POOLS := [
	["flat", "pit", "hill", "tower", "pond", "cliffs", "pillars"],
	["flat", "pit", "hill", "pond", "bridge", "spikes", "cliffs", "pillars", "sky"],
	["pit", "spikes", "bridge", "tower", "gauntlet", "bunker", "spikefield", "cliffs", "sky"],
	["spikes", "bridge", "gauntlet", "swarm", "steps", "bunker", "spikefield", "sky", "nest", "pillars"],
	["gauntlet", "swarm", "steps", "bunker", "spikefield", "sky", "nest", "spikes", "bridge"],
]
const CHESTS := ["treasure", "ladder", "canyon"]
const QUIZ := ["terminal", "shrine", "vault"]
const ZONES := [
	{"name": "Тихая роща", "art": "grove", "tint": Color(1, 1, 1)},
	{"name": "Лес данных", "art": "forest", "tint": Color(0.85, 0.95, 1.0)},
	{"name": "Грибные катакомбы", "art": "catacomb", "tint": Color(0.9, 0.85, 1.0)},
	{"name": "Пустошь битых файлов", "art": "waste", "tint": Color(1.0, 0.9, 0.82)},
	{"name": "Логово Глюка", "art": "lair", "tint": Color(0.75, 0.7, 0.95)},
]

static func chunk_rows(name: String) -> Array:
	# Полные 15 рядов куска.
	var c: Dictionary = CHUNKS[name]
	var rows := [EMPTY, EMPTY, EMPTY, EMPTY]
	rows.append_array(c["air"])
	for i in H - GROUND:
		rows.append(c["ground"])
	return rows

static func plan(zone: int, rng: RandomNumberGenerator) -> Array:
	# Порядок кусков зоны: три пары «обычные куски + терминал», потом выход или арена босса. Один из обычных кусков — с сундуком.
	var out := ["start"]
	var last := ""
	var quiz := QUIZ.duplicate()
	var pool: Array = POOLS[zone]
	var per: int = 1 if zone == 0 else 2
	var chest_at: int = rng.randi() % (3 * per)
	for i in 3:
		for k in per:
			var pick: String = CHESTS[rng.randi() % CHESTS.size()] if i * per + k == chest_at else pool[rng.randi() % pool.size()]
			while pick == last:
				pick = pool[rng.randi() % pool.size()]
			out.append(pick)
			last = pick
		out.append(quiz.pop_at(rng.randi() % quiz.size()))
	if zone == ZONES.size() - 1:
		# Арена босса шириной в два куска: камера не выходит за край карты.
		out.append("arena")
		out.append("arena")
	else:
		out.append("door")
	return out

static func build(names: Array) -> Dictionary:
	# Склеивает куски в карту зоны и собирает объекты по знакам.
	var rows := []
	for y in H:
		rows.append("")
	var things := []
	for i in names.size():
		var part := chunk_rows(names[i])
		for y in H:
			var line: String = part[y]
			for x in W:
				var ch := line[x]
				if ch != "#" and ch != " " and ch != "^":
					things.append({"kind": ch, "x": i * W + x, "y": y})
					ch = " "
				rows[y] += ch
	return {"rows": rows, "w": names.size() * W, "things": things, "names": names}

static func solid(rows: Array, x: int, y: int) -> bool:
	if x < 0 or x >= rows[0].length():
		return true
	if y < 0 or y >= rows.size():
		return false
	return rows[y][x] == "#"

static func standable(rows: Array, x: int, y: int) -> bool:
	# Клетка, где можно стоять: пусто, под ногами камень, не шипы.
	return y >= 1 and y < rows.size() - 1 and not solid(rows, x, y) and not solid(rows, x, y - 1) and solid(rows, x, y + 1) and rows[y][x] != "^"

static func reachable(rows: Array) -> bool:
	# Грубая модель прыжка героя: вверх до 2 клеток с разрывом до 2, по ровному или вниз — разрыв до 3.
	var w: int = rows[0].length()
	var start := Vector2i(0, GROUND - 1)
	if not standable(rows, start.x, start.y):
		return false
	var seen := {start: true}
	var queue := [start]
	while not queue.is_empty():
		var p: Vector2i = queue.pop_back()
		if p.x >= w - 1:
			return true
		for dx in range(-4, 5):
			if dx == 0:
				continue
			for dy in range(-2, 12):
				var q := p + Vector2i(dx, dy)
				if seen.has(q) or q.x < 0 or q.x >= w or not standable(rows, q.x, q.y):
					continue
				var gap: int = absi(dx) - 1
				if dy < 0 and gap > 2:
					continue
				if dy >= 0 and gap > 3:
					continue
				# На пути прыжка не должно быть стены на уровне головы.
				var blocked := false
				var top: int = mini(p.y, q.y) - (1 if dy < 0 else 0)
				for step in range(1, absi(dx)):
					var cx: int = p.x + step * signi(dx)
					if solid(rows, cx, top) or solid(rows, cx, top - 1):
						blocked = true
				if not blocked:
					seen[q] = true
					queue.append(q)
	return false

# ---------- вопросы терминалов ----------

static func _bin(v: int) -> String:
	var s := ""
	while v > 0:
		s = str(v % 2) + s
		v /= 2
	return s if s != "" else "0"

static func _wrong(right: int, rng: RandomNumberGenerator, low: int = 0) -> Array:
	# Два разных неверных числа рядом с верным.
	var out := []
	for attempt in 50:
		var v: int = right + [-3, -2, -1, 1, 2, 3, 4, 8][rng.randi() % 8]
		if v >= low and v != right and not out.has(str(v)):
			out.append(str(v))
		if out.size() == 2:
			break
	if out.size() < 2:
		out = [str(right + 5), str(right + 7)]
	return out

static func made_question(grade: int, rng: RandomNumberGenerator) -> Dictionary:
	# Вопрос со случайными числами: перевод систем счисления, единицы информации, логика, степени двойки.
	var kinds := ["units", "bin2dec"]
	if grade >= 8:
		kinds = ["bin2dec", "dec2bin", "logic", "pow2"]
	if grade >= 10:
		kinds = ["bin2dec", "dec2bin", "logic", "pow2", "hex2dec"]
	var kind: String = kinds[rng.randi() % kinds.size()]
	var top: int = {6: 7, 7: 15, 8: 31, 9: 63, 10: 127, 11: 255}[grade]
	if kind == "units":
		if rng.randi() % 2 == 0:
			var n := rng.randi_range(2, 9)
			return {"q": "Сколько бит в %d байтах?" % n, "a": str(n * 8), "w": _wrong(n * 8, rng, 1), "e": "В одном байте 8 бит: %d × 8 = %d." % [n, n * 8]}
		var n2 := rng.randi_range(2, 6) * 8
		return {"q": "Сколько байт в %d битах?" % n2, "a": str(n2 / 8), "w": _wrong(n2 / 8, rng, 1), "e": "8 бит — это 1 байт: %d : 8 = %d." % [n2, n2 / 8]}
	if kind == "bin2dec":
		var v := rng.randi_range(2, top)
		return {"q": "%s₂ = ? в десятичной системе" % _bin(v), "a": str(v), "w": _wrong(v, rng, 0), "e": "Складываем веса разрядов с единицами: получается %d." % v}
	if kind == "dec2bin":
		var v := rng.randi_range(2, top)
		var w := []
		for d in [1, -1, 2, 3]:
			if v + d > 0 and w.size() < 2:
				w.append(_bin(v + d) + "₂")
		return {"q": "%d = ? в двоичной системе" % v, "a": _bin(v) + "₂", "w": w, "e": "%d в двоичной системе записывается как %s." % [v, _bin(v)]}
	if kind == "pow2":
		var k := rng.randi_range(3, 10)
		return {"q": "Чему равно 2 в степени %d?" % k, "a": str(1 << k), "w": [str(1 << (k - 1)), str((1 << k) + (1 << (k - 2)))], "e": "Каждая следующая степень двойки вдвое больше: 2^%d = %d." % [k, 1 << k]}
	if kind == "hex2dec":
		var v := rng.randi_range(10, 255)
		return {"q": "%X₁₆ = ? в десятичной системе" % v, "a": str(v), "w": _wrong(v, rng, 0), "e": "%X₁₆ = %d × 16 + %d = %d." % [v, v / 16, v % 16, v]}
	var a := rng.randi() % 2 == 0
	var b := rng.randi() % 2 == 0
	var forms := [["A И B", a and b], ["A ИЛИ B", a or b], ["НЕ A", not a], ["A И НЕ B", a and not b], ["НЕ A ИЛИ B", (not a) or b]]
	var f: Array = forms[rng.randi() % forms.size()]
	var yes := "истина"
	var no := "ложь"
	return {"q": "A = %s, B = %s. %s — это…" % ["1" if a else "0", "1" if b else "0", f[0]], "a": yes if f[1] else no, "w": [no if f[1] else yes, "нельзя определить"], "e": "Подставляем значения: %s даёт %s." % [f[0], yes if f[1] else no]}

static func question(grade: int, rng: RandomNumberGenerator, bank: Array, used: Dictionary) -> Dictionary:
	# Половина вопросов — из банка класса без повторов за забег, половина — со случайными числами.
	if rng.randi() % 2 == 0 or bank.is_empty():
		return made_question(grade, rng)
	for attempt in 30:
		var i := rng.randi() % bank.size()
		if not used.has(i):
			used[i] = true
			return bank[i]
	return made_question(grade, rng)
