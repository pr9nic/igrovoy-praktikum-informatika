extends SceneTree
# Проверка «Кодополии»: правила мини-игр, торгов и событий раунда (arcade/kp_logic.gd), затем целые партии ботов
# и сетевая партия «создатель + гость» на снимках поля. Запуск: godot --headless --path godot/workshop --script res://tests/kodopolia.gd
const KP = preload("res://arcade/kp_logic.gd")
const Board = preload("res://arcade/board.gd")
const PHASES := ["roll", "rolling", "move", "dialog", "wait", "mini", "mini_res", "end"]
var bad := 0
var tok_re := RegEx.new()
var asg_re := RegEx.new()
var var_re := RegEx.new()
var num_re := RegEx.new()
# Разбор выражений: лексемы, позиция и значения переменных.
var ptoks: Array = []
var ppos := 0
var penv: Dictionary = {}

func check(name: String, ok: bool, info: String = "") -> void:
	print("%s  %s%s" % ["ok  " if ok else "FAIL", name, (" — " + info) if info != "" else ""])
	if not ok:
		bad += 1

# ---------- независимые проверки ответов ----------

func peek() -> String:
	return str(ptoks[ppos]) if ppos < ptoks.size() else ""

# Логическое выражение: НЕ сильнее И, И сильнее ИЛИ; сравнения >, <, = с числами и переменными.
func lg_eval(expr: String, vals: Dictionary) -> int:
	# 1 — истина, 0 — ложь, -1 — выражение не разобрано.
	ptoks = Array(expr.replace("(", " ( ").replace(")", " ) ").split(" ", false))
	ppos = 0
	penv = vals
	var v := lg_or()
	if ppos != ptoks.size():
		return -1
	return 1 if v else 0

func lg_or() -> bool:
	var v := lg_and()
	while peek() == "ИЛИ":
		ppos += 1
		var w := lg_and()
		v = v or w
	return v

func lg_and() -> bool:
	var v := lg_not()
	while peek() == "И":
		ppos += 1
		var w := lg_not()
		v = v and w
	return v

func lg_not() -> bool:
	if peek() == "НЕ":
		ppos += 1
		return not lg_not()
	return lg_atom()

func lg_atom() -> bool:
	if peek() == "(":
		ppos += 1
		var v := lg_or()
		ppos += 1
		return v
	var a := lg_val(peek())
	ppos += 1
	var op := peek()
	if op == ">" or op == "<" or op == "=":
		ppos += 1
		var b := lg_val(peek())
		ppos += 1
		if op == ">":
			return a > b
		if op == "<":
			return a < b
		return a == b
	return a != 0

func lg_val(t: String) -> int:
	if t.is_valid_int():
		return int(t)
	return int(penv.get(t, -999))

# Маленький интерпретатор Python для программ мини-игры: присваивания, for/while/if (и в одну строку), print, срезы строк.
func py_run(lines: Array) -> String:
	var e := {}
	var out := []
	py_block(lines, e, out)
	return "\n".join(out)

func py_ind(s: String) -> int:
	return s.length() - s.lstrip(" ").length()

func py_block(lines: Array, e: Dictionary, out: Array) -> void:
	var i := 0
	while i < lines.size():
		var line: String = lines[i]
		var ind := py_ind(line)
		var s := line.strip_edges()
		var j := i + 1
		while j < lines.size() and py_ind(lines[j]) > ind:
			j += 1
		var body: Array = lines.slice(i + 1, j)
		var head := s
		if s.begins_with("for ") or s.begins_with("while ") or s.begins_with("if "):
			if s.ends_with(":"):
				head = s.substr(0, s.length() - 1)
			else:
				var c := s.find(": ")
				head = s.substr(0, c)
				body = [s.substr(c + 2)]
		if head.begins_with("for "):
			var nm := head.substr(4, head.find(" in ") - 4)
			var src := head.substr(head.find(" in ") + 4)
			var seq: Array = []
			if src.begins_with("range("):
				var args: Array = []
				for a in src.substr(6, src.length() - 7).split(","):
					args.append(int(py_eval(a, e)))
				if args.size() == 1:
					seq = range(args[0])
				elif args.size() == 2:
					seq = range(args[0], args[1])
				else:
					seq = range(args[0], args[1], args[2])
			else:
				var txt := str(py_eval(src, e))
				for ch in txt:
					seq.append(ch)
			for v in seq:
				e[nm] = v
				py_block(body, e, out)
		elif head.begins_with("while "):
			var guard := 0
			while bool(py_eval(head.substr(6), e)) and guard < 1000:
				py_block(body, e, out)
				guard += 1
		elif head.begins_with("if "):
			if bool(py_eval(head.substr(3), e)):
				py_block(body, e, out)
		elif s.begins_with("print(") and s.ends_with(")"):
			var parts := []
			for a in s.substr(6, s.length() - 7).split(","):
				parts.append(str(py_eval(a, e)))
			out.append(" ".join(parts))
		else:
			var m := asg_re.search(s)
			if m == null:
				out.append("?? " + s)
			else:
				var nm := m.get_string(1)
				var op := m.get_string(2)
				var v = py_eval(m.get_string(3), e)
				if op == "=":
					e[nm] = v
				elif op == "+=":
					e[nm] = e[nm] + v
				elif op == "-=":
					e[nm] = e[nm] - v
				elif op == "*=":
					e[nm] = e[nm] * v
				else:
					e[nm] = floori(float(e[nm]) / float(v))
		i = j

func py_eval(s: String, e: Dictionary) -> Variant:
	ptoks = []
	for m in tok_re.search_all(s):
		ptoks.append(m.get_string())
	ppos = 0
	penv = e
	return pe_cmp()

func pe_cmp() -> Variant:
	var a = pe_sum()
	var op := peek()
	if op in [">", "<", "==", "!=", ">=", "<="]:
		ppos += 1
		var b = pe_sum()
		if op == ">":
			return a > b
		if op == "<":
			return a < b
		if op == "==":
			return a == b
		if op == "!=":
			return a != b
		if op == ">=":
			return a >= b
		return a <= b
	return a

func pe_sum() -> Variant:
	var a = pe_mul()
	while peek() == "+" or peek() == "-":
		var op := peek()
		ppos += 1
		var b = pe_mul()
		if op == "+":
			a = a + b
		else:
			a = a - b
	return a

func pe_mul() -> Variant:
	var a = pe_unary()
	while peek() in ["*", "//", "%"]:
		var op := peek()
		ppos += 1
		var b = pe_unary()
		if op == "*":
			a = a * b
		elif op == "//":
			a = floori(float(a) / float(b))
		else:
			a = posmod(int(a), int(b))
	return a

func pe_unary() -> Variant:
	if peek() == "-":
		ppos += 1
		return -int(pe_unary())
	var t := peek()
	ppos += 1
	var v = null
	if t == "(":
		v = pe_cmp()
		ppos += 1
	elif t.is_valid_int():
		v = int(t)
	elif t.begins_with("\""):
		v = t.substr(1, t.length() - 2)
	else:
		v = penv.get(t, null)
	if peek() == "[":
		ppos += 1
		var lo = pe_sum()
		if peek() == ":":
			ppos += 1
			var hi = pe_sum()
			v = str(v).substr(int(lo), int(hi) - int(lo))
		else:
			v = str(v)[int(lo)]
		ppos += 1
	return v

func ip_valid(s: String) -> bool:
	var parts := s.split(".")
	if parts.size() != 4:
		return false
	for part in parts:
		if part.length() < 1 or part.length() > 3:
			return false
		for ch in part:
			if "0123456789".find(ch) < 0:
				return false
		if (part.length() > 1 and part[0] == "0") or part.to_int() > 255:
			return false
	return true

func mask_re(mask: String, name: String) -> bool:
	var pat := "^"
	for ch in mask:
		if ch == "*":
			pat += ".*"
		elif ch == "?":
			pat += "."
		elif ch == ".":
			pat += "\\."
		else:
			pat += ch
	var re := RegEx.new()
	re.compile(pat + "$")
	return re.search(name) != null

func label_value(t: String) -> int:
	# «Что больше»: число в системе счисления по нижнему индексу или объём в битах.
	if t.ends_with("₁₆"):
		return t.trim_suffix("₁₆").hex_to_int()
	if t.ends_with("₁₀"):
		return int(t.trim_suffix("₁₀"))
	if t.ends_with("₈"):
		var v := 0
		for ch in t.trim_suffix("₈"):
			v = v * 8 + int(ch)
		return v
	if t.ends_with("₂"):
		return t.trim_suffix("₂").bin_to_int()
	var n := int(t.split(" ")[0])
	return n * 8 if t.contains("байт") else n

func check_mini(kind: String, m: Dictionary) -> String:
	# Пусто — вопрос корректен: четыре разных варианта, верный ровно один, и это m.right.
	var opts: Array = m.get("opts", [])
	var right := int(m.get("right", -1))
	var code: Array = m.get("code", [])
	if opts.size() != 4 or right < 0 or right > 3:
		return "вариантов %d, верный %d" % [opts.size(), right]
	for i in 4:
		for j in i:
			if str(opts[i]) == str(opts[j]):
				return "одинаковые варианты %s" % str(opts)
		if str(opts[i]).length() > 26 or str(opts[i]) == "":
			return "вариант не помещается: %s" % str(opts[i])
	if (kind == "code") != (code.size() > 0):
		return "программа только у «Что выведет программа»"
	var q := str(m.get("q", ""))
	var good := []
	if kind == "bin":
		var n := int(num_re.search(q).get_string(1))
		for i in 4:
			if str(opts[i]).bin_to_int() == n:
				good.append(i)
	elif kind == "max":
		var best := -1
		for i in 4:
			var v := label_value(str(opts[i]))
			if v > best:
				best = v
				good = [i]
			elif v == best:
				good.append(i)
	elif kind == "logic":
		var vals := {}
		for vm in var_re.search_all(q):
			vals[vm.get_string(1)] = int(vm.get_string(2))
		if vals.is_empty():
			return "нет значений в вопросе: " + q
		for i in 4:
			var r := lg_eval(str(opts[i]), vals)
			if r < 0:
				return "не разобрано: " + str(opts[i])
			if r == 1:
				good.append(i)
	elif kind == "code":
		if code.size() < 2 or code.size() > 4:
			return "строк программы: %d" % code.size()
		for ln in code:
			if str(ln).length() > 30:
				return "длинная строка: " + str(ln)
		var outp := py_run(code)
		for i in 4:
			if str(opts[i]) == outp:
				good.append(i)
		if good.size() != 1:
			return "%s → %s, варианты %s" % [" / ".join(code), outp, str(opts)]
	elif kind == "ip":
		for i in 4:
			if ip_valid(str(opts[i])):
				good.append(i)
	elif kind == "mask":
		var a := q.find("«")
		var b := q.find("»")
		var mask := q.substr(a + 1, b - a - 1)
		if not (mask.contains("*") or mask.contains("?")):
			return "маска без ? и *: " + mask
		for i in 4:
			if mask_re(mask, str(opts[i])):
				good.append(i)
	if good != [right]:
		return "%s: верные %s, а отмечен %d — %s" % [q, str(good), right, str(opts)]
	return ""

# ---------- торги без поля ----------

func sim_auction(rng: RandomNumberGenerator) -> String:
	# Торги по тем же правилам, что в board.gd: боты ставят по своим пределам, «люди» — случайно.
	var price: int = [6, 8, 10, 12, 14, 16][rng.randi() % 6]
	var bytes := []
	var bot := []
	var lim := []
	for k in 4:
		bytes.append(rng.randi_range(0, 45))
		bot.append(rng.randf() < 0.75)
		lim.append(KP.auction_limit(price, int(bytes[k]), rng.randi_range(0, 2), rng.randi_range(0, 2), 3, rng.randf_range(0.55, 0.85), rng.randi_range(-1, 1)))
	var start := KP.auction_start(price)
	var bid := start - 1
	var lead := -1
	var out := [false, false, false, false]
	var turn := rng.randi() % 4
	var asks := 0
	while true:
		var k := KP.auction_next(turn, lead, out, bytes, bid)
		if k < 0:
			break
		asks += 1
		if asks > 200:
			return "торги не кончаются"
		if k == lead or bool(out[k]) or int(bytes[k]) < bid + 1:
			return "очередь: спросили %d" % k
		turn = k
		var steps := KP.auction_steps(bid, int(bytes[k]))
		for st in steps:
			if bid + int(st) > int(bytes[k]):
				return "повышение не по карману"
		var step := 0
		if bot[k]:
			step = KP.auction_bot_step(bid, int(lim[k]), rng.randf())
			if step > 0 and (bid + step > int(lim[k]) or not steps.has(step)):
				return "бот поставил выше предела"
			if step == 0 and int(lim[k]) > bid:
				return "бот спасовал, хотя мог поставить"
		else:
			var i := rng.randi_range(0, steps.size())
			if i < steps.size():
				step = int(steps[i])
		if step > 0:
			bid += step
			lead = k
		else:
			out[k] = true
	if lead >= 0 and (bid > int(bytes[lead]) or bid < start):
		return "ставка %d при %d байтах" % [bid, int(bytes[lead])]
	if lead >= 0 and bot[lead] and bid > int(lim[lead]):
		return "бот переплатил"
	if lead < 0 and bid != start - 1:
		return "без лидера ставка изменилась"
	for k in 4:
		if k != lead and int(bytes[k]) >= bid + 1 and not bool(out[k]):
			return "игрок %d мог перебить, но его не спросили" % k
	return ""

# ---------- партии на поле ----------

func make_board(grade: int, stage: int, s: int):
	var g = Board.new()
	g.grade = grade
	g.setup()
	g.rng.seed = s
	g.stage = stage
	g.start()
	return g

func invariant(g) -> String:
	var sum := 0
	var cr := 0
	for pl in g.players:
		if int(pl["bytes"]) < 0:
			return "у %s отрицательные байты" % pl["name"]
		if pl["items"].size() > 3:
			return "больше трёх предметов"
		sum += int(pl["bytes"])
		cr += int(pl["crystals"])
	if sum != 10 * g.players.size() + int(g.bank):
		return "байты не сходятся: у игроков %d, из банка %d" % [sum, int(g.bank)]
	if cr != int(g.stats["crystals"]):
		return "кристаллов у игроков %d, куплено %d" % [cr, int(g.stats["crystals"])]
	for sp in g.spaces:
		var o := int(sp["owner"])
		if o < -1 or o > 3 or (o == -1 and int(sp["up"]) != 0) or (o >= 0 and sp["type"] != "lot"):
			return "владелец клетки %s" % str(sp.get("name", sp["type"]))
	if not (str(g.phase) in PHASES):
		return "фаза «%s» между кадрами" % str(g.phase)
	if str(g.round_ev) != "" and (not KP.event_round(int(g.round_n)) or g._event_text(true) == ""):
		return "событие «%s» в раунде %d" % [str(g.round_ev), int(g.round_n)]
	if g.phase == "dialog":
		var opts: Array = g.dlg["opts"]
		if opts.is_empty() or opts.size() > 5:
			return "в окне %d вариантов" % opts.size()
		if str(g.dlg["head"]).begins_with("Торги") and (opts.size() > 4 or str(opts[-1]) != "Пас" or g.auc.is_empty()):
			return "окно торгов: %s" % str(opts)
	if g.phase == "mini" and g.mini["opts"].size() < 3:
		return "мини-игра без вариантов"
	if g.phase == "mini_res" and str(g.round_ev) == "hackathon" and g.mini["result"].size() and not str(g.mini["result"][0]).ends_with("+12"):
		return "хакатон не удвоил приз: %s" % str(g.mini["result"])
	if str(g.round_ev) == "ddos":
		for sp in g.spaces:
			if sp["type"] == "lot" and int(sp["owner"]) >= 0 and int(sp["group"]) == int(g.ev_group) and g._rent(sp) != 0:
				return "DDoS: аренда в «%s» не ноль" % sp["name"]
	return ""

func finished(g) -> String:
	if g.state != "over" or g.phase != "end" or not g.won:
		return "партия не закончилась: %s / %s, раунд %d" % [g.state, g.phase, int(g.round_n)]
	if int(g.round_n) != int(g.rounds) + 1 or g.placings.size() != g.np:
		return "раундов %d из %d, мест %d" % [int(g.round_n), int(g.rounds), g.placings.size()]
	var seen := {}
	for k in g.np:
		seen[int(g.placings[k])] = true
	if seen.size() != g.np:
		return "места — не перестановка игроков"
	for k in g.np - 1:
		var a: Dictionary = g.players[int(g.placings[k])]
		var b: Dictionary = g.players[int(g.placings[k + 1])]
		if int(a["crystals"]) < int(b["crystals"]) or (int(a["crystals"]) == int(b["crystals"]) and int(a["bytes"]) < int(b["bytes"])):
			return "места не по кристаллам и байтам"
	var ev := 0
	for r in range(1, int(g.rounds) + 1):
		if KP.event_round(r):
			ev += 1
	if int(g.stats["events"]) != ev:
		return "событий %d, а должно быть %d" % [int(g.stats["events"]), ev]
	return ""

func _init() -> void:
	tok_re.compile("\\d+|\"[^\"]*\"|//|==|!=|>=|<=|[A-Za-z_][A-Za-z_0-9]*|[-+*%()\\[\\]:,<>=]")
	asg_re.compile("^([A-Za-z_][A-Za-z_0-9]*) *(\\+=|-=|\\*=|//=|=) *(.+)$")
	var_re.compile("([A-Z]) = (\\d+)")
	num_re.compile("(\\d+)\\?")
	var rng := RandomNumberGenerator.new()
	rng.seed = 20261019
	# --- проверка самих проверяющих ---
	check("разбор логики: НЕ сильнее И, И сильнее ИЛИ", lg_eval("НЕ A ИЛИ B", {"A": 1, "B": 0}) == 0 and lg_eval("НЕ (A И B) ИЛИ C", {"A": 1, "B": 1, "C": 0}) == 0 and lg_eval("A ИЛИ B И C", {"A": 1, "B": 0, "C": 0}) == 1 and lg_eval("НЕ (X > 3) И (X < 7)", {"X": 2}) == 1)
	check("интерпретатор Python: цикл, условие в одну строку, целочисленное деление, срез", py_run(["s = 1", "for i in range(1, 4):", "    s = s * i", "print(s)"]) == "6" and py_run(["c = 0", "for i in range(10, 20):", "    if i % 3 == 0: c += 1", "print(c)"]) == "3" and py_run(["a = 47", "print(a // 5, a % 5)"]) == "9 2" and py_run(["s = \"информатика\"", "print(s[2:5])"]) == "фор" and py_run(["n = 50", "while n > 4:", "    n = n // 2", "print(n)"]) == "3")
	check("IP и маски: независимая проверка", ip_valid("192.168.0.1") and not ip_valid("192.168.0.256") and not ip_valid("10.0.0") and not ip_valid("10.0,0.1") and not ip_valid("10..0.1") and mask_re("*.t?t", "отчёт.txt") and not mask_re("*.t?t", "отчёт.tx"))
	# --- мини-игры ---
	check("виды мини-игр: в 6-м классе пять (без IP и масок), с 7-го — все семь", KP.mini_kinds(6).size() == 5 and not KP.mini_kinds(6).has("ip") and not KP.mini_kinds(6).has("mask") and KP.mini_kinds(7).size() == 7 and KP.mini_kinds(11).has("mask"))
	var order_ok := true
	for grade in [6, 7, 9, 11]:
		for i in 50:
			var o := KP.mini_order(grade, rng)
			var want := KP.mini_kinds(grade)
			o.sort()
			want.sort()
			if o != want:
				order_ok = false
	check("порядок мини-игр на партию — перестановка всех видов класса", order_ok)
	for grade in [6, 7, 8, 9, 10, 11]:
		for kind in KP.mini_kinds(grade):
			if kind == "quiz":
				continue
			var err := ""
			var sample := ""
			for i in 400:
				var m := KP.mini_make(kind, grade, rng)
				var e := check_mini(kind, m)
				if e != "":
					err = e
					break
				if i == 0:
					sample = "%s %s" % [str(m["q"]) if m["code"].is_empty() else " / ".join(m["code"]), str(m["opts"])]
			check("%d класс, мини-игра «%s»: 400 вопросов, четыре разных варианта, верный ровно один" % [grade, kind], err == "", err if err != "" else sample)
	# --- торги ---
	check("торги: старт — половина цены, повышения только по карману", KP.auction_start(6) == 3 and KP.auction_start(16) == 8 and KP.auction_start(1) == 1 and KP.auction_steps(5, 8) == [1, 3] and KP.auction_steps(5, 5).is_empty() and KP.auction_steps(0, 10) == [1, 3, 5])
	var no := [false, false, false, false]
	check("торги: очередь по кругу после игрока, лидера и спасовавших не спрашивают, бедных пропускают",
		KP.auction_next(1, -1, no, [10, 10, 10, 10], 4) == 2 and KP.auction_next(3, -1, no, [10, 10, 10, 10], 4) == 0 and KP.auction_next(1, 2, no, [10, 10, 10, 10], 4) == 3
		and KP.auction_next(1, -1, [false, false, true, false], [10, 10, 10, 2], 4) == 0 and KP.auction_next(0, 0, [false, true, true, true], [10, 10, 10, 10], 4) == -1 and KP.auction_next(2, -1, no, [10, 3, 3, 3], 4) == 0
		and KP.auction_next(2, 1, no, [3, 10, 3, 3], 4) == -1)
	var lim_ok := true
	for i in 3000:
		var price: int = [6, 8, 10, 12, 14, 16][i % 6]
		var by := rng.randi_range(0, 60)
		var l := KP.auction_limit(price, by, rng.randi_range(0, 2), rng.randi_range(0, 2), 3, rng.randf_range(0.5, 0.9), rng.randi_range(-1, 1))
		if l < 0 or l > maxi(0, by - 8):
			lim_ok = false
		for r in [0.1, 0.5, 0.9]:
			var st := KP.auction_bot_step(rng.randi_range(0, 20), l, r)
			if not (st in [0, 1, 3, 5]):
				lim_ok = false
	var plain := KP.auction_limit(12, 60, 0, 0, 3, 0.7, 0)
	check("торги: предел бота не больше байтов без запаса; за свой квартал и чтобы помешать сопернику — дороже; копилку на кристалл не тратит",
		lim_ok and KP.auction_limit(12, 60, 2, 0, 3, 0.7, 0) > plain and KP.auction_limit(12, 60, 0, 2, 3, 0.7, 0) > plain and KP.auction_limit(12, 17, 0, 0, 3, 0.7, 0) == 0 and KP.auction_limit(12, 17, 2, 0, 3, 0.7, 0) > 0,
		"обычный участок за 12 — до %d байтов" % plain)
	var sim_err := ""
	for i in 3000:
		var e := sim_auction(rng)
		if e != "":
			sim_err = e
	check("торги: 3000 случайных аукционов кончаются, победитель платит не больше, чем у него есть, боты не переплачивают", sim_err == "", sim_err)
	# --- события раунда ---
	var rounds_ev := []
	for r in range(1, 13):
		if KP.event_round(r):
			rounds_ev.append(r)
	check("события: со 2-го раунда каждые три раунда", rounds_ev == [2, 5, 8, 11], str(rounds_ev))
	var picks := {}
	var pick_ok := true
	var prev := ""
	for i in 600:
		var id := KP.event_pick(rng, prev)
		if id == prev or not KP.EVENTS.has(id) or KP.event_name(id) == "" or KP.event_text(id, "Облачные высоты") == "":
			pick_ok = false
		picks[id] = true
		prev = id
	check("события: шесть разных карт, подряд одна и та же не выпадает", pick_ok and picks.size() == 6 and picks.has("hackathon") and picks.has("ddos") and picks.has("sale") and picks.has("update"), str(picks.keys()))
	check("события: DDoS обнуляет аренду только в своём квартале, пиковая нагрузка — ×1,5",
		KP.event_rent(8, "ddos", 2, 2) == 0 and KP.event_rent(8, "ddos", 2, 3) == 8 and KP.event_rent(8, "rush", -1, 1) == 12 and KP.event_rent(5, "rush", -1, 1) == 7 and KP.event_rent(8, "", -1, 1) == 8 and KP.event_text("ddos", "Сетевая гавань").contains("Сетевая гавань"))
	check("события: хакатон удваивает награды за ответы, распродажа — цены вдвое, акция — кристалл за 15",
		KP.event_reward(4, "hackathon") == 8 and KP.event_reward(6, "hackathon") == 12 and KP.event_reward(6, "sale") == 6 and KP.event_shop(5, "sale") == 3 and KP.event_shop(6, "sale") == 3 and KP.event_shop(8, "sale") == 4 and KP.event_shop(8, "hackathon") == 8
		and KP.event_crystal(20, "crystal") == 15 and KP.event_crystal(20, "update") == 20)
	# --- целые партии ботов ---
	var total := {"auctions": 0, "sold": 0, "games": 0}
	var evs := {}
	var game_err := ""
	var max_ticks := 0
	var info := ""
	for grade in [6, 8, 11]:
		for stage in [1, 2, 3]:
			for k in 2:
				var s: int = grade * 1000 + stage * 10 + k
				seed(s)
				var g = make_board(grade, stage, s)
				for pl in g.players:
					pl["bot"] = true
				var kinds := {}
				var n := 0
				var err := ""
				while g.state == "play" and n < 80000:
					g.tick(0.05)
					n += 1
					err = invariant(g)
					if err != "":
						break
					if g.phase == "mini":
						kinds[str(g.mini["kind"])] = true
					if str(g.round_ev) != "":
						evs[str(g.round_ev)] = true
				if err == "":
					err = finished(g)
				if err == "":
					var want := KP.mini_kinds(grade)
					for kd in want:
						if not kinds.has(kd):
							err = "не было мини-игры «%s» (были %s)" % [kd, str(kinds.keys())]
				if err != "" and game_err == "":
					game_err = "%d класс, поле %d, зерно %d: %s" % [grade, stage, s, err]
				total["auctions"] += int(g.stats["auctions"])
				total["sold"] += int(g.stats["sold"])
				total["games"] += 1
				max_ticks = maxi(max_ticks, n)
				if info == "":
					info = "кристаллы %s, байты %s" % [str(g.players.map(func(x): return x["crystals"])), str(g.players.map(func(x): return x["bytes"]))]
				g.free()
	check("18 партий ботов доиграны до конца: байты не уходят в минус и сходятся с банком, кристаллы — с покупками, места по правилам, были все мини-игры", game_err == "", game_err if game_err != "" else info + ", самая долгая — %d кадров" % max_ticks)
	# Сетевой стол без ботов: двое или трое людей — партия идёт по кругу из них и доходит до итога.
	var small_err := ""
	for npl in [2, 3]:
		seed(77 + npl)
		var gs = Board.new()
		gs.grade = 8
		gs.np = npl
		gs.setup()
		gs.np = npl
		gs.rng.seed = 77 + npl
		gs.stage = 1
		gs.start()
		for pl in gs.players:
			pl["bot"] = true
		var ns := 0
		var turns := {}
		while gs.state == "play" and ns < 80000:
			gs.tick(0.05)
			ns += 1
			turns[gs.cur] = true
			var e2 := invariant(gs)
			if e2 != "" and small_err == "":
				small_err = "%d игрока: %s" % [npl, e2]
				break
		if small_err == "":
			var e3 := finished(gs)  # проверяем каждый стол, первая ошибка сохраняется
			if e3 != "" or gs.players.size() != npl or turns.size() != npl:
				small_err = "%d игрока: %s, игроков %d, ходили %s" % [npl, e3, gs.players.size(), str(turns.keys())]
		gs.free()
	check("стол без ботов на 2 и 3 игроков: ходят только они, торги и мини-игры работают, партия доиграна", small_err == "", small_err)
	check("в партиях были торги и проданные с торгов кварталы, разные события раунда", int(total["auctions"]) > 10 and int(total["sold"]) > 5 and evs.size() >= 4, "торгов %d, продано %d, события %s" % [int(total["auctions"]), int(total["sold"]), str(evs.keys())])
	# --- сетевая партия: создатель (место 0), гость на связи (место 1), отключившийся (место 2) и бот ---
	var net_err := ""
	var acts := {"auction": 0, "raise": 0, "choose": 0, "roll": 0, "mini": 0, "snaps": 0}
	var biggest := 0
	var trng := RandomNumberGenerator.new()
	for grade in [7, 9, 10]:
		var s: int = 777 + grade
		trng.seed = s
		seed(s)
		var names := ["Лобов Андрей", "Гостев Борис", "Третьяков Виктор"]
		var h = Board.new()
		h.net = "host"
		h.net_names = names
		h.grade = grade
		h.setup()
		h.rng.seed = s
		h.stage = 1
		h.start()
		h.net_online = [true, true, false, true]
		var gst = Board.new()
		gst.net = "guest"
		gst.my = 1
		gst.net_names = names
		gst.grade = grade
		gst.setup()
		gst.stage = 1
		gst.start()
		var t0 := 0.5
		var t1 := 0.5
		var guest_wait := false
		var guest_mini := -1
		var n := 0
		var err := ""
		while h.state == "play" and n < 120000 and err == "":
			h.tick(0.05)
			n += 1
			err = invariant(h)
			t0 -= 0.05
			t1 -= 0.05
			if t0 <= 0.0:
				t0 = trng.randf_range(0.2, 1.5)
				if h._my_roll():
					h._do(0, "roll", -1)
				elif h._my_dlg():
					h._do(0, "choose", trng.randi() % h.dlg["opts"].size())
				elif h.phase == "mini" and int(h.mini["pick"]) == -1:
					h._do(0, "mini", trng.randi() % h.mini["opts"].size())
			if n % 6 == 0:
				var js := JSON.stringify(h._snap())
				biggest = maxi(biggest, js.length())
				var sn: Dictionary = JSON.parse_string(js)
				gst._apply(sn)
				acts["snaps"] += 1
				guest_wait = false
				for k in 4:
					if int(gst.players[k]["bytes"]) != int(h.players[k]["bytes"]) or int(gst.players[k]["pos"]) != int(h.players[k]["pos"]) or int(gst.players[k]["crystals"]) != int(h.players[k]["crystals"]):
						err = "у гостя другие байты или позиции"
				if gst.phase != h.phase or int(gst.cur) != int(h.cur) or str(gst.round_ev) != str(h.round_ev) or int(gst.ev_group) != int(h.ev_group):
					err = "у гостя другая фаза, ход или событие"
				if not h.mini.is_empty() and (gst.mini.get("opts", []) != h.mini["opts"] or gst.mini.get("code", []) != h.mini["code"] or str(gst.mini.get("kind", "")) != str(h.mini["kind"]) or str(gst.mini.get("q", "")) != str(h.mini["q"])):
					err = "у гостя другая мини-игра: %s" % str(gst.mini)
				if not h.dlg.is_empty() and (str(gst.dlg.get("head", "")) != str(h.dlg["head"]) or gst.dlg.get("opts", []) != h.dlg.get("opts", [])):
					err = "у гостя другое окно: %s" % str(gst.dlg.get("head", ""))
				if gst._my_dlg() != (h.phase == "dialog" and int(h.dlg["who"]) == 1 and not h.dlg["bot"]):
					err = "гость не видит, что выбирать ему"
			if t1 <= 0.0 and not guest_wait and gst.state == "play" and err == "":
				t1 = trng.randf_range(0.2, 1.5)
				if gst._my_roll():
					h._do(1, "roll", -1)
					acts["roll"] += 1
					guest_wait = true
				elif gst._my_dlg():
					var i: int = trng.randi() % gst.dlg["opts"].size()
					var same: bool = h.phase == "dialog" and int(h.dlg["who"]) == 1 and h.dlg["opts"] == gst.dlg["opts"]
					var auction: bool = same and str(h.dlg["head"]).begins_with("Торги")
					var raise: bool = auction and i < h.dlg["opts"].size() - 1
					var lot: Dictionary = h.auc["sp"] if auction else {}
					h._do(1, "choose", i)
					acts["choose"] += 1
					guest_wait = true
					if auction:
						acts["auction"] += 1
					if raise:
						acts["raise"] += 1
						if not ((not h.auc.is_empty() and int(h.auc["lead"]) == 1) or (h.auc.is_empty() and int(lot["owner"]) == 1)):
							err = "ставка гостя не дошла до создателя"
				elif gst.phase == "mini" and guest_mini != int(gst.round_n):
					guest_mini = int(gst.round_n)
					h._do(1, "mini", trng.randi() % gst.mini["opts"].size())
					acts["mini"] += 1
		if err == "":
			err = finished(h)
		if err == "":
			gst._apply(JSON.parse_string(JSON.stringify(h._snap())))
			if gst.state != "over" or gst.placings != h.placings:
				err = "у гостя не показан итог партии"
		if err != "" and net_err == "":
			net_err = "%d класс: %s (кадр %d, фаза %s)" % [grade, err, n, h.phase]
		h.free()
		gst.free()
	check("сетевая партия доиграна: гость видит то же поле, мини-игры, события и окна; его ходы, ставки и ответы доходят, за отключившегося ходит автопилот", net_err == "", net_err if net_err != "" else str(acts))
	check("гость участвовал в торгах вводом «choose», снимок меньше лимита сервера", int(acts["auction"]) > 0 and int(acts["raise"]) > 0 and biggest < 300000, "торгов %d, ставок %d, самый большой снимок %d знаков" % [int(acts["auction"]), int(acts["raise"]), biggest])
	print("ALL OK" if bad == 0 else "FAILED %d" % bad)
	quit(bad)
