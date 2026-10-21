extends RefCounted
# Правила «Кодополии» без графики: мини-игры, торги за кварталы и события раунда. Проверяются tests/kodopolia.gd.

const L2 = preload("res://arcade/logic2.gd")

# ---------- мини-игры ----------
# Каждая мини-игра — вопрос и четыре разных варианта, верный ровно один: {"q", "opts", "right", "code"}.
# «quiz» (быстрый вопрос из банка класса) собирает сама игра: банк вопросов живёт в cells/questions.gd.

const KINDS := ["bin", "max", "quiz", "logic", "code", "ip", "mask"]
const CODE_KINDS := {6: ["add", "if"], 7: ["add", "if", "pow"], 8: ["pow", "sum", "half", "divmod"], 9: ["sum", "half", "step", "divmod"],
	10: ["half", "step", "mult", "slice", "count"], 11: ["step", "mult", "slice", "count", "divmod"]}
const WORDS := ["информатика", "алгоритм", "программа", "компьютер", "переменная", "процессор", "клавиатура", "монитор", "кодополия"]
const LETTERS := "абвгдеиклмнопрстуя"

static func mini_kinds(grade: int) -> Array:
	# IP-адреса и маски файлов — с 7-го класса.
	if grade <= 6:
		return ["bin", "max", "quiz", "logic", "code"]
	return KINDS.duplicate()

static func mini_order(grade: int, rng: RandomNumberGenerator) -> Array:
	# Порядок мини-игр на партию: перемешанный список, по кругу. Раундов не меньше восьми, так что встречаются все виды.
	var kinds := mini_kinds(grade)
	shuffle(kinds, rng)
	return kinds

static func mini_make(kind: String, grade: int, rng: RandomNumberGenerator) -> Dictionary:
	match kind:
		"max":
			return mini_max(grade, rng)
		"logic":
			return mini_logic(grade, rng)
		"code":
			return mini_code(grade, rng)
		"ip":
			return mini_ip(grade, rng)
		"mask":
			return mini_mask(grade, rng)
	return mini_bin(grade, rng)

static func shuffle(a: Array, rng: RandomNumberGenerator) -> void:
	for i in range(a.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var t = a[i]
		a[i] = a[j]
		a[j] = t

static func pack(q: String, right: String, wrong: Array, rng: RandomNumberGenerator, code: Array = []) -> Dictionary:
	# Верный ответ и первые три неверных, не совпадающих с ним и друг с другом; пустой словарь — если неверных не хватило.
	var opts := [right]
	for w in wrong:
		var s := str(w)
		if opts.size() < 4 and not opts.has(s):
			opts.append(s)
	if opts.size() < 4:
		return {}
	shuffle(opts, rng)
	return {"q": q, "opts": opts, "right": opts.find(right), "code": code}

# «Двоичная дуэль»: какая запись равна числу.
static func mini_bin(grade: int, rng: RandomNumberGenerator) -> Dictionary:
	var top := 15 if grade <= 6 else (63 if grade == 7 else 255)
	var bits := 4 if top == 15 else (6 if top == 63 else 8)
	var n := rng.randi_range(3, top)
	var vals := [n]
	while vals.size() < 4:
		var v := clampi(n ^ (1 << rng.randi_range(0, bits - 1)), 1, top) if rng.randf() < 0.7 else rng.randi_range(1, top)
		if not vals.has(v):
			vals.append(v)
	shuffle(vals, rng)
	var opts := []
	for v in vals:
		opts.append(String.num_int64(v, 2).pad_zeros(bits))
	return {"q": "Двоичная дуэль: какая запись равна числу %d?" % n, "opts": opts, "right": vals.find(n), "code": []}

# «Что больше?»: числа в разных системах счисления (с 8-го класса) или объёмы в битах и байтах.
static func mini_max(grade: int, rng: RandomNumberGenerator) -> Dictionary:
	var opts := []
	if grade >= 8:
		var vals := []
		while vals.size() < 4:
			var v := rng.randi_range(20, 255)
			if not vals.has(v):
				vals.append(v)
		var bases := [2, 8, 10, 16]
		shuffle(bases, rng)
		var mx: int = vals.max()
		for k in 4:
			var b: int = bases[k]
			opts.append(String.num_int64(vals[k], b).to_upper() + {2: "₂", 8: "₈", 10: "₁₀", 16: "₁₆"}[b])
		return {"q": "Найди самое большое число!", "opts": opts, "right": vals.find(mx), "code": []}
	var pool := [["12 бит", 12], ["2 байта", 16], ["1 байт", 8], ["20 бит", 20], ["3 байта", 24], ["30 бит", 30], ["4 байта", 32], ["10 бит", 10]]
	shuffle(pool, rng)
	var best_i := 0
	for k in 4:
		opts.append(pool[k][0])
		if int(pool[k][1]) > int(pool[best_i][1]):
			best_i = k
	return {"q": "Что больше? (1 байт = 8 бит)", "opts": opts, "right": best_i, "code": []}

# «Истина или ложь»: какое из выражений с И / ИЛИ / НЕ истинно при данных значениях.
static func mini_logic(grade: int, rng: RandomNumberGenerator) -> Dictionary:
	for attempt in 30:
		var vals := {}
		var q := ""
		if grade >= 10:
			for nm in ["A", "B", "C"]:
				vals[nm] = rng.randi_range(0, 1)
			q = "Истина или ложь: какое выражение истинно при A = %d, B = %d, C = %d? (1 — истина)" % [vals["A"], vals["B"], vals["C"]]
		elif grade == 9:
			vals["X"] = rng.randi_range(1, 9)
			vals["Y"] = rng.randi_range(1, 9)
			q = "Истина или ложь: какое выражение истинно при X = %d и Y = %d?" % [vals["X"], vals["Y"]]
		else:
			vals["X"] = rng.randi_range(1, 9)
			q = "Истина или ложь: какое выражение истинно при X = %d?" % vals["X"]
		var good := ""
		var bad := []
		for k in 80:
			var e := logic_expr(grade, rng, vals)
			var s: String = e[0]
			if s.length() > 24:
				continue   # длинное не помещается на кнопку и не читается за 9 секунд
			if bool(e[1]):
				if good == "":
					good = s
			elif bad.size() < 3 and not bad.has(s):
				bad.append(s)
			if good != "" and bad.size() >= 3:
				break
		if good != "" and bad.size() >= 3:
			return pack(q, good, bad, rng)
	return pack("Истина или ложь: какое выражение истинно при X = 5?", "X = 5", ["X > 5", "X < 5", "X = 6"], rng)

static func logic_expr(grade: int, rng: RandomNumberGenerator, vals: Dictionary) -> Array:
	# Выражение и его значение: [текст, истина ли].
	if grade >= 10:
		return _bool_expr(rng, vals)
	var names: Array = ["X"] if grade <= 8 else ["X", "Y"]
	var count := 1 if grade <= 6 else 2
	var atoms := []
	for k in count:
		var nm: String = names[rng.randi() % names.size()]
		var a := _cmp(rng, nm, int(vals[nm]))
		for again in 5:
			if k == 0 or str(a[0]) != str(atoms[0][0]).trim_prefix("НЕ ").trim_prefix("(").trim_suffix(")"):
				break
			a = _cmp(rng, nm, int(vals[nm]))
		if rng.randf() < (0.4 if grade <= 6 else 0.3):
			a = ["НЕ (" + str(a[0]) + ")", not bool(a[1])]
		elif count > 1:
			a = ["(" + str(a[0]) + ")", bool(a[1])]
		atoms.append(a)
	if count == 1:
		return atoms[0]
	var use_and := rng.randf() < 0.5
	var t0: bool = atoms[0][1]
	var t1: bool = atoms[1][1]
	return [str(atoms[0][0]) + (" И " if use_and else " ИЛИ ") + str(atoms[1][0]), (t0 and t1) if use_and else (t0 or t1)]

static func _cmp(rng: RandomNumberGenerator, nm: String, v: int) -> Array:
	var op: String = [">", "<", "="][rng.randi() % 3]
	var a := rng.randi_range(1, 9)
	var ok: bool = (v > a) if op == ">" else ((v < a) if op == "<" else v == a)
	return [nm + " " + op + " " + str(a), ok]

static func _bool_expr(rng: RandomNumberGenerator, vals: Dictionary) -> Array:
	var names := ["A", "B", "C"]
	shuffle(names, rng)
	var a := _bool_atom(rng, names[0], vals)
	var b := _bool_atom(rng, names[1], vals)
	var and1 := rng.randf() < 0.5
	var t: bool = (bool(a[1]) and bool(b[1])) if and1 else (bool(a[1]) or bool(b[1]))
	var s: String = str(a[0]) + (" И " if and1 else " ИЛИ ") + str(b[0])
	var form := rng.randi() % 3
	if form == 0:
		return [s, t]
	var c := _bool_atom(rng, names[2], vals)
	var and2 := rng.randf() < 0.5
	var left := "(" + s + ")"
	if form == 2:
		left = "НЕ " + left
		t = not t
	var t2: bool = (t and bool(c[1])) if and2 else (t or bool(c[1]))
	return [left + (" И " if and2 else " ИЛИ ") + str(c[0]), t2]

static func _bool_atom(rng: RandomNumberGenerator, nm: String, vals: Dictionary) -> Array:
	var v: bool = int(vals[nm]) == 1
	if rng.randf() < 0.35:
		return ["НЕ " + nm, not v]
	return [nm, v]

# «Что выведет программа»: 2–4 строки на Python с циклом или условием; ответ считается здесь же.
static func mini_code(grade: int, rng: RandomNumberGenerator) -> Dictionary:
	var pool: Array = CODE_KINDS[clampi(grade, 6, 11)]
	for attempt in 20:
		var t: String = pool[rng.randi() % pool.size()]
		var r := code_task(t, rng)
		var m := pack("Что выведет программа?", str(r["out"]), r["wrong"], rng, r["lines"])
		if not m.is_empty():
			return m
	return pack("Что выведет программа?", "6", ["5", "7", "8"], rng, ["s = 0", "for i in range(3):", "    s = s + 2", "print(s)"])

static func code_task(t: String, rng: RandomNumberGenerator) -> Dictionary:
	# Программа (строки), её вывод и правдоподобные ошибки: лишний или недостающий шаг цикла, другая ветка условия.
	var lines := []
	var out := ""
	var wrong := []
	match t:
		"add":
			var a := rng.randi_range(0, 5)
			var n := rng.randi_range(2, 5)
			var k := rng.randi_range(2, 4)
			lines = ["s = %d" % a, "for i in range(%d):" % n, "    s = s + %d" % k, "print(s)"]
			var v := a + n * k
			out = str(v)
			wrong = [a + (n - 1) * k, a + (n + 1) * k, n * k, a + n + k]
			wrong.append_array(_near(v))
		"if":
			var a := rng.randi_range(2, 12)
			var b := rng.randi_range(2, 12)
			var c := rng.randi_range(1, 5)
			var gt := rng.randf() < 0.5
			var plus := rng.randf() < 0.5
			var cond: bool = (a > b) if gt else (a < b)
			var changed := a + c if plus else a - c
			lines = ["x = %d" % a, "if x %s %d:" % [">" if gt else "<", b], "    x = x %s %d" % ["+" if plus else "-", c], "print(x)"]
			var v := changed if cond else a
			out = str(v)
			wrong = [a if cond else changed, a - c if plus else a + c, b, c]
			wrong.append_array(_near(v))
		"pow":
			var n := rng.randi_range(2, 6)
			var b := 2 if rng.randf() < 0.6 else 3
			lines = ["p = 1", "for i in range(%d):" % n, "    p = p * %d" % b, "print(p)"]
			var v := 1
			for i in n:
				v *= b
			out = str(v)
			wrong = [v / b, v * b, b * n, b + n]
			wrong.append_array(_near(v))
		"sum":
			var a := rng.randi_range(1, 4)
			var b := a + rng.randi_range(3, 5)
			lines = ["s = 0", "for i in range(%d, %d):" % [a, b], "    s = s + i", "print(s)"]
			var v := 0
			for i in range(a, b):
				v += i
			out = str(v)
			wrong = [v + b, v - a, v - a + b, v + b + 1]
			wrong.append_array(_near(v))
		"half":
			var a := rng.randi_range(20, 99)
			var b := rng.randi_range(2, 6)
			lines = ["n = %d" % a, "while n > %d:" % b, "    n = n // 2", "print(n)"]
			var v := a
			var prev := a
			while v > b:
				prev = v
				v = v / 2
			out = str(v)
			wrong = [prev, v / 2, a / 2, b]
			wrong.append_array(_near(v))
		"step":
			var a := rng.randi_range(0, 5)
			var c := rng.randi_range(2, 4)
			var b := a + rng.randi_range(8, 16)
			lines = ["k = 0", "for i in range(%d, %d, %d):" % [a, b, c], "    k = k + 1", "print(k)"]
			var v := 0
			for i in range(a, b, c):
				v += 1
			out = str(v)
			wrong = [(b - a) / c, v + 1, v - 1, b - a]
			wrong.append_array(_near(v))
		"mult":
			var a := rng.randi_range(1, 20)
			var b := a + rng.randi_range(8, 20)
			var k := rng.randi_range(3, 7)
			lines = ["c = 0", "for i in range(%d, %d):" % [a, b], "    if i % " + str(k) + " == 0: c += 1", "print(c)"]
			var v := 0
			var with_b := 0
			for i in range(a, b + 1):
				if i % k == 0:
					with_b += 1
					if i < b:
						v += 1
			out = str(v)
			wrong = [with_b, (b - a) / k, v + 1, v - 1]
			wrong.append_array(_near(v))
		"slice":
			var w: String = WORDS[rng.randi() % WORDS.size()]
			var i := rng.randi_range(0, w.length() - 4)
			var j := i + rng.randi_range(2, 3)
			lines = ["s = \"%s\"" % w, "print(s[%d:%d])" % [i, j]]
			out = w.substr(i, j - i)
			wrong = [w.substr(i, j - i + 1), w.substr(i + 1, j - i), w.substr(i + 1, j - i - 1), w.substr(i, j - i - 1)]
			if i > 0:
				wrong.append(w.substr(i - 1, j - i))
			wrong.append(w.substr(0, j - i))
			wrong.append(w.substr(w.length() - (j - i)))
		"count":
			var w: String = WORDS[rng.randi() % WORDS.size()]
			var ch: String = w[rng.randi() % w.length()]
			lines = ["k = 0", "for ch in \"%s\":" % w, "    if ch == \"%s\": k += 1" % ch, "print(k)"]
			var v := w.count(ch)
			out = str(v)
			wrong = [v + 1, w.length(), v + 2, v - 1]
			wrong.append_array(_near(v))
		_:
			var a := rng.randi_range(20, 99)
			var b := rng.randi_range(3, 9)
			lines = ["a = %d" % a, "print(a // " + str(b) + ", a % " + str(b) + ")"]
			var d := a / b
			var r := a % b
			out = "%d %d" % [d, r]
			wrong = ["%d %d" % [r, d], "%d %d" % [d + 1, r], "%d %d" % [d, r + 1], "%d %d" % [d - 1, r + b], "%d" % d, "%d %d" % [d + 1, r + 1]]
	return {"lines": lines, "out": out, "wrong": wrong}

static func _near(v: int) -> Array:
	# Запасные неверные ответы рядом с верным — чтобы вариантов всегда хватало.
	return [v + 1, v + 2, v - 1, v + 3]

# «Верный IP-адрес»: четыре числа от 0 до 255 через точку; неверные — число больше 255, три или пять чисел, запятая, пустая часть.
static func ip_ok(s: String) -> bool:
	var parts := s.split(".")
	if parts.size() != 4:
		return false
	for part in parts:
		if part == "" or part.length() > 3 or (part.length() > 1 and part.begins_with("0")):
			return false
		for ch in part:
			if not "0123456789".contains(ch):
				return false
		if int(part) > 255:
			return false
	return true

static func _ip_parts(rng: RandomNumberGenerator) -> Array:
	return [rng.randi_range(10, 223), rng.randi_range(0, 255), rng.randi_range(0, 255), rng.randi_range(1, 254)]

static func _ip_join(parts: Array, comma_at: int = -1) -> String:
	var s := ""
	for k in parts.size():
		if k > 0:
			s += "," if k == comma_at else "."
		s += str(parts[k])
	return s

static func mini_ip(grade: int, rng: RandomNumberGenerator) -> Dictionary:
	for attempt in 20:
		var good := _ip_join(_ip_parts(rng))
		var kinds := ["big", "big2", "three", "five", "comma", "empty"]
		shuffle(kinds, rng)
		var wrong := []
		for kind in kinds:
			var p := _ip_parts(rng)
			var s := ""
			if kind == "big" or kind == "big2":
				p[rng.randi_range(0, 3)] = rng.randi_range(256, 300 if grade <= 8 else 999)
				s = _ip_join(p)
			elif kind == "three":
				p.remove_at(rng.randi_range(0, 3))
				s = _ip_join(p)
			elif kind == "five":
				p.insert(rng.randi_range(0, 4), rng.randi_range(0, 255))
				s = _ip_join(p)
			elif kind == "comma":
				s = _ip_join(p, rng.randi_range(1, 3))
			else:
				p[rng.randi_range(1, 2)] = ""
				s = _ip_join(p)
			if not ip_ok(s):
				wrong.append(s)
		var m := pack("Какая запись — правильный IP-адрес?" if grade <= 8 else "Какая запись может быть IP-адресом компьютера?", good, wrong, rng)
		if not m.is_empty():
			return m
	return pack("Какая запись — правильный IP-адрес?", "192.168.1.10", ["192.168.1.256", "192.168.10", "192,168.1.10"], rng)

# «Маска файлов»: какое имя подходит под маску; «?» — ровно один символ, «*» — любые символы.
static func mini_mask(grade: int, rng: RandomNumberGenerator) -> Dictionary:
	var hint := " (? — один символ, * — любые)" if grade <= 8 else ""
	for attempt in 40:
		var stem: String = L2.STEMS[rng.randi() % L2.STEMS.size()]
		var ext: String = L2.EXTS[rng.randi() % L2.EXTS.size()]
		var target := stem + "." + ext
		var ext2: String = L2.EXTS[rng.randi() % L2.EXTS.size()]
		var stem2: String = L2.STEMS[rng.randi() % L2.STEMS.size()]
		var at := rng.randi_range(0, stem.length() - 1)
		var cand := [stem + "." + ext2, stem2 + "." + ext, stem.substr(0, at) + LETTERS[rng.randi() % LETTERS.length()] + stem.substr(at + 1) + "." + ext,
			stem + str(rng.randi_range(1, 9)) + "." + ext, stem.substr(1) + "." + ext]
		shuffle(cand, rng)
		var files := [target]
		for c in cand:
			if files.size() < 4 and not files.has(c):
				files.append(c)
		if files.size() < 4:
			continue
		var mask: String = L2.fs_mask(files, target, rng)
		var hits := 0
		for f in files:
			if L2.mask_match(mask, f):
				hits += 1
		if mask == target or hits != 1 or not L2.mask_match(mask, target):
			continue
		return pack("Какое имя файла подходит под маску «%s»?%s" % [mask, hint], target, files.slice(1), rng)
	return pack("Какое имя файла подходит под маску «*.txt»?" + hint, "доклад.txt", ["доклад.docx", "закат.png", "текст.tx"], rng)

# ---------- торги за квартал ----------
# Квартал, который игрок не купил (отказался или не хватило байтов), уходит с торгов. Ставки по кругу, начиная со следующего игрока:
# повысить на 1, 3 или 5 байтов либо спасовать (пас — выход из торгов). Торги кончаются, когда перебить лидера больше некому.

const BID_STEPS := [1, 3, 5]

static func auction_start(price: int) -> int:
	# Стартовая ставка — половина цены.
	return maxi(1, price / 2)

static func auction_steps(bid: int, bytes: int) -> Array:
	# Повышения, которые игрок может себе позволить.
	var out := []
	for s in BID_STEPS:
		if bid + int(s) <= bytes:
			out.append(int(s))
	return out

static func auction_next(turn: int, lead: int, out: Array, bytes: Array, bid: int) -> int:
	# Кто ставит следующим: по кругу после turn — не лидер, не спасовавший и тот, кому хватает байтов. -1 — торги окончены.
	var n := bytes.size()
	for k in range(1, n + 1):
		var s := (turn + k) % n
		if s != lead and not bool(out[s]) and int(bytes[s]) >= bid + 1:
			return s
	return -1

static func auction_limit(price: int, bytes: int, mine: int, theirs: int, size: int, skill: float, jitter: int, crystal: int = 20) -> int:
	# Сколько бот готов отдать: цена участка; больше — если квартал соберётся у него или надо помешать сопернику собрать свой.
	# mine — сколько участков этой группы уже у бота, theirs — больше всего у одного соперника, size — участков в группе.
	var value := float(price)
	var group := mine == size - 1
	if group:
		value *= 1.6
	elif mine > 0:
		value *= 1.25
	if theirs == size - 1:
		value *= 1.3
	# Обычный участок бот берёт чуть дороже стартовой цены: байты нужнее на кристаллы. Запас — не меньше 8 байтов,
	# а кто почти накопил на кристалл, ради одиночного участка копилку не тратит.
	var lim := int(value * (0.35 + 0.35 * skill)) + jitter
	var keep := 8
	if not group and bytes >= crystal - 4:
		keep = maxi(keep, crystal)
	return maxi(0, mini(lim, bytes - keep))

static func auction_bot_step(bid: int, limit: int, r: float) -> int:
	# Ход бота на торгах: 0 — пас, иначе повышение, не выше его предела.
	var room := limit - bid
	if room < 1:
		return 0
	if room >= 8 and r < 0.35:
		return 5
	if room >= 4 and r < 0.6:
		return 3
	return 1

# ---------- события раунда ----------
# Со 2-го раунда каждые три раунда тянется карта события; она действует до конца раунда (и на его мини-игру).

const EVENT_FIRST := 2
const EVENT_EVERY := 3
const CRYSTAL_SALE := 15
const EVENTS := {
	"hackathon": ["Хакатон", "Все верные ответы этого раунда приносят вдвое больше байтов — и в мини-игре тоже.", "верные ответы — вдвое больше байтов"],
	"ddos": ["DDoS-атака", "Сервер квартала «%s» лежит: в этом раунде аренду там не платят.", "аренда в «%s» — 0"],
	"sale": ["Распродажа в магазине", "Все предметы в магазине в этом раунде вдвое дешевле.", "предметы в магазине вдвое дешевле"],
	"update": ["Обновление сервера", "Кристалл знаний переехал на новое место!", "кристалл знаний переехал"],
	"rush": ["Пиковая нагрузка", "Сеть перегружена: аренда во всех кварталах в этом раунде в полтора раза выше.", "аренда в полтора раза выше"],
	"crystal": ["Акция на кристаллы", "В этом раунде кристалл знаний стоит 15 байтов вместо 20.", "кристалл стоит 15 байтов"],
}

static func event_round(round_n: int) -> bool:
	return round_n >= EVENT_FIRST and (round_n - EVENT_FIRST) % EVENT_EVERY == 0

static func event_pick(rng: RandomNumberGenerator, prev: String) -> String:
	# Случайное событие, не такое, как в прошлый раз.
	var ids := EVENTS.keys()
	ids.erase(prev)
	return str(ids[rng.randi() % ids.size()])

static func event_name(id: String) -> String:
	return str(EVENTS[id][0]) if EVENTS.has(id) else ""

static func event_text(id: String, group: String, brief: bool = false) -> String:
	if not EVENTS.has(id):
		return ""
	var s: String = EVENTS[id][2 if brief else 1]
	return s % group if id == "ddos" else s

static func event_rent(rent: int, id: String, ev_group: int, group: int) -> int:
	if id == "ddos" and group == ev_group:
		return 0
	if id == "rush":
		return rent * 3 / 2
	return rent

static func event_reward(n: int, id: String) -> int:
	return n * 2 if id == "hackathon" else n

static func event_shop(price: int, id: String) -> int:
	return (price + 1) / 2 if id == "sale" else price

static func event_crystal(price: int, id: String) -> int:
	return mini(price, CRYSTAL_SALE) if id == "crystal" else price
