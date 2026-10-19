extends SceneTree
# Проверка уровней: эталонные решения проходят все варианты и укладываются в норму блоков,
# а решения «в лоб» без нужной идеи не проходят.
# Запуск: godot --headless --path godot/workshop --script res://tests/solutions.gd
# С параметром -- dump пишет эталонные решения в tests/.solutions.json для теста в браузере.
const Sim = preload("res://sim.gd")
const Levels = preload("res://levels.gd")

func A(op: String) -> Dictionary:
	return {"op": op}
func REP(n: int, body: Array) -> Dictionary:
	return {"op": "repeat", "n": n, "body": body}
func IF(c: String, body: Array, alt: Array = []) -> Dictionary:
	return {"op": "if", "cond": c, "body": body, "alt": alt}
func WH(c: String, body: Array) -> Dictionary:
	return {"op": "while", "cond": c, "body": body}

func solutions() -> Dictionary:
	var f := A("fwd"); var l := A("left"); var r := A("right"); var t := A("take"); var p := A("put")
	var on := A("on"); var off := A("off")
	var sr := A("step_r"); var sl := A("step_l"); var sw := A("swap"); var wr := A("write"); var ld := A("load"); var ad := A("add")
	var inv := IF("lit", [off], [on])
	var xor := IF("A", [IF("B", [], [on])], [IF("B", [on])])
	return {
		"first": [f, t, f, f, f, r, f, p],
		"corridor": [t, REP(8, [f]), p],
		"conveyor": [REP(4, [t, l, l, REP(3, [f]), p, l, l, REP(3, [f])])],
		"sort": [REP(4, [t, IF("red", [r, p, l], [l, p, r])])],
		"three": [REP(5, [t, l, IF("blue", [p]), l, IF("green", [p]), l, IF("red", [p]), l])],
		"glitch": [REP(3, [t, l, l, WH("free", [f]), IF("red", [l, p, l], [r, p, r]), WH("free", [f])])],
		"7-bin4": [on, f, f, on],
		"7-byte": [REP(4, [on, f, f])],
		"7-raster": [REP(4, [REP(4, [on, f]), r])],
		"7-negative": [REP(8, [inv, f])],
		"7-copy": [REP(6, [IF("A", [on]), f])],
		"7-photo": [REP(3, [REP(3, [inv, f]), l, l, REP(3, [f]), l, f, l])],
		"8-not": [REP(4, [IF("A", [], [on]), f])],
		"8-and": [REP(4, [IF("A", [IF("B", [on])]), f])],
		"8-or": [REP(4, [IF("A", [on], [IF("B", [on])]), f])],
		"8-xor": [REP(4, [xor, f])],
		"8-imp": [REP(4, [IF("A", [IF("B", [on])], [on]), f])],
		"8-half": [REP(4, [xor, f]), r, f, r, REP(4, [f, IF("A", [IF("B", [on])])])],
		"9-sum": [REP(5, [ad, sr]), wr],
		"9-find": [WH("ne_mem", [sr]), A("mark")],
		"9-max": [REP(6, [IF("gt_mem", [ld]), sr]), wr],
		"9-pos": [WH("data", [IF("pos", [ad]), sr]), wr],
		"9-pass": [REP(5, [IF("gt_right", [sw]), sr])],
		"9-sort": [WH("rdata", [IF("gt_right", [sw, sl], [sr])])],
		"10-inc": [WH("lit", [off, f]), on],
		"10-dec": [WH("dark", [on, f]), off],
		"10-neg": [WH("dark", [f]), f, WH("free", [inv, f])],
		"10-parity": [REP(7, [IF("lit", [A("ftog")]), f]), IF("flag", [on])],
		"10-maj": [REP(8, [IF("A", [IF("B", [on], [IF("C", [on])])], [IF("B", [IF("C", [on])])]), f])],
		"10-adder": [REP(4, [IF("A", [IF("B", [IF("flag", [on]), A("fset")], [IF("flag", [], [on])])], [IF("B", [IF("flag", [], [on])], [IF("flag", [on, A("fclr")])])]), f]), IF("flag", [on])],
		"11-prefix": [WH("data", [ad, wr, sr])],
		"11-count": [WH("data", [IF("pos", [A("inc")]), sr]), wr],
		"11-min": [ld, WH("data", [IF("lt_mem", [ld]), sr]), wr],
		"11-insert": [WH("gt_right", [sw, sl])],
		"11-desc": [WH("rdata", [IF("lt_right", [sw, sl], [sr])])],
		"11-part": [WH("rdata", [IF("pos", [IF("rneg", [sw, sl], [sr])], [sr])])],
		"6-two": [t, f, p, l, l, f, f, t, f, p],
		"6-ring": [REP(4, [t, f, r, f, r, p, l])],
		"6-pattern": [REP(2, [t, r, p, l, t, l, p, r])],
		"6-far": [REP(4, [t, IF("red", [l, l, REP(3, [f]), p, l, l, REP(3, [f])], [l, p, r])])],
		"6-fetch": [WH("free", [f]), t, l, l, WH("free", [f]), p],
		"6-big": [REP(4, [t, l, l, WH("free", [f]), IF("red", [l, p, l], [IF("blue", [r, p, r], [p, l, l])]), WH("free", [f])])],
		"7-n37": [on, f, f, f, on, f, f, on],
		"7-flag": [REP(3, [REP(3, [on, f, f]), l, l, WH("free", [f]), l, f, l])],
		"7-invcopy": [REP(6, [IF("A", [], [on]), f])],
		"7-cross": [REP(4, [on, f]), on, l, f, f, l, f, f, l, REP(4, [on, f]), on],
		"7-two": [REP(4, [IF("A", [on]), f]), r, f, r, REP(4, [f, IF("B", [on])])],
		"7-x": [REP(5, [on, f, r, f, l]), l, REP(5, [f]), l, f, REP(5, [on, f, l, f, r])],
		"8-nand": [REP(4, [IF("A", [IF("B", [], [on])], [on]), f])],
		"8-nor": [REP(4, [IF("A", [], [IF("B", [], [on])]), f])],
		"8-xnor": [REP(4, [IF("A", [IF("B", [on])], [IF("B", [], [on])]), f])],
		"8-andnot": [REP(4, [IF("A", [IF("B", [], [on])]), f])],
		"8-and3": [REP(8, [IF("A", [IF("B", [IF("C", [on])])]), f])],
		"8-full": [REP(8, [IF("A", [IF("B", [IF("C", [on])], [IF("C", [], [on])])], [IF("B", [IF("C", [], [on])], [IF("C", [on])])]), f]), r, f, r, REP(8, [f, IF("A", [IF("B", [on], [IF("C", [on])])], [IF("B", [IF("C", [on])])])])],
		"9-double": [WH("data", [ld, ad, wr, sr])],
		"9-last": [WH("rdata", [sr]), ld, sr, wr],
		"9-clamp": [WH("data", [IF("neg", [wr]), sr])],
		"9-minfirst": [WH("data", [IF("gt_right", [sw]), sl])],
		"9-ends": [WH("rdata", [IF("gt_right", [sw]), sr]), WH("ldata", [sl, IF("gt_right", [sw])])],
		"9-desc": [WH("rdata", [IF("lt_right", [sw, sl], [sr])])],
		"10-shl": [WH("free", [IF("ahead", [on], [off]), f]), off],
		"10-shr": [WH("free", [IF("ahead", [on], [off]), f]), off],
		"10-odd": [IF("lit", [WH("free", [f]), on])],
		"10-msb": [WH("dark", [f]), WH("free", [f, off])],
		"10-add2": [f, WH("lit", [off, f]), on],
		"10-sub": [REP(4, [IF("A", [IF("B", [IF("flag", [on])], [IF("flag", [A("fclr")], [on])])], [IF("B", [IF("flag", [], [on]), A("fset")], [IF("flag", [on])])]), f])],
		"11-even": [WH("data", [IF("even", [ad]), sr]), wr],
		"11-maxfirst": [WH("data", [IF("lt_right", [sw]), sl])],
		"11-fill": [WH("data", [IF("gt_mem", [ld]), sr]), sl, WH("data", [wr, sl])],
		"11-inv": [WH("rdata", [IF("gt_right", [A("inc")]), sr]), sr, wr],
		"11-until": [WH("pos", [ad, sr]), WH("data", [sr]), wr],
		"11-sortsum": [WH("rdata", [IF("gt_right", [sw, sl], [sr])]), WH("ldata", [sl]), WH("data", [ad, sr]), wr],
	}

func second() -> Dictionary:
	# Вторые, более длинные верные решения: должны проходить и давать не меньше одной звезды.
	var f := A("fwd"); var l := A("left"); var on := A("on"); var off := A("off")
	var sr := A("step_r"); var sl := A("step_l"); var sw := A("swap")
	var inv := IF("lit", [off], [on])
	return {
		"9-sort": [REP(5, [WH("rdata", [IF("gt_right", [sw]), sr]), WH("ldata", [sl])])],
		"11-desc": [REP(5, [WH("rdata", [IF("lt_right", [sw]), sr]), WH("ldata", [sl])])],
		"10-neg": [REP(5, [inv, f]), l, l, REP(5, [f]), l, l, WH("lit", [off, f]), on],
		"8-or": [REP(4, [IF("A", [on]), IF("B", [on]), f])],
	}

func naive() -> Dictionary:
	# Решения «в лоб» без нужной идеи: не должны проходить все варианты или лимит блоков.
	var f := A("fwd"); var l := A("left"); var r := A("right"); var t := A("take"); var p := A("put")
	var on := A("on"); var off := A("off")
	var sr := A("step_r"); var sl := A("step_l"); var sw := A("swap"); var wr := A("write"); var ld := A("load"); var ad := A("add")
	return {
		"corridor": [t, f, f, f, f, f, f, f, f, p],
		"sort": [REP(4, [t, r, p, l])],
		"three": [REP(5, [t, IF("red", [r, p, l], [l, p, r])])],
		"glitch": [REP(3, [t, l, l, REP(3, [f]), IF("red", [l, p, l], [r, p, r]), REP(3, [f])])],
		"7-byte": [on, f, f, on, f, f, on, f, f, on],
		"7-negative": [REP(8, [on, f])],
		"7-copy": [REP(6, [on, f])],
		"7-photo": [REP(3, [REP(3, [on, f]), l, l, REP(3, [f]), l, f, l])],
		"8-not": [REP(4, [on, f])],
		"8-and": [REP(4, [IF("A", [on]), f])],
		"8-or": [REP(4, [IF("A", [on]), f])],
		"8-xor": [REP(4, [IF("A", [on], [IF("B", [on])]), f])],
		"8-imp": [REP(4, [IF("B", [on]), f])],
		"8-half": [REP(4, [IF("A", [on], [IF("B", [on])]), f]), r, f, r, REP(4, [f, IF("A", [IF("B", [on])])])],
		"9-sum": [ad, wr],
		"9-find": [REP(3, [sr]), A("mark")],
		"9-max": [ld, REP(6, [sr]), wr],
		"9-pos": [WH("data", [ad, sr]), wr],
		"9-pass": [IF("gt_right", [sw])],
		"9-sort": [REP(5, [IF("gt_right", [sw]), sr])],
		"10-inc": [on],
		"10-dec": [off],
		"10-neg": [REP(5, [IF("lit", [off], [on]), f])],
		"10-parity": [REP(7, [f]), on],
		"10-maj": [REP(8, [IF("A", [IF("B", [on])]), f])],
		"10-adder": [REP(4, [IF("A", [IF("B", [], [on])], [IF("B", [on])]), f])],
		"11-prefix": [REP(4, [ad, wr, sr])],
		"11-count": [WH("data", [A("inc"), sr]), wr],
		"11-min": [WH("data", [IF("lt_mem", [ld]), sr]), wr],
		"11-insert": [IF("gt_right", [sw])],
		"11-desc": [WH("rdata", [IF("lt_right", [sw]), sr])],
		"11-part": [WH("rdata", [IF("pos", [IF("rneg", [sw])]), sr])],
		"6-pattern": [REP(4, [t, r, p, l])],
		"6-far": [REP(4, [t, l, p, r])],
		"6-fetch": [REP(2, [f]), t, l, l, REP(2, [f]), p],
		"6-big": [REP(4, [t, l, l, WH("free", [f]), IF("red", [l, p, l], [r, p, r]), WH("free", [f])])],
		"7-invcopy": [REP(6, [on, f])],
		"7-two": [REP(4, [IF("A", [on]), f]), r, f, r, REP(4, [f, IF("A", [on])])],
		"8-nand": [REP(4, [IF("A", [IF("B", [on])]), f])],
		"8-nor": [REP(4, [IF("A", [on], [IF("B", [on])]), f])],
		"8-xnor": [REP(4, [IF("A", [IF("B", [], [on])], [IF("B", [on])]), f])],
		"8-andnot": [REP(4, [IF("A", [IF("B", [on])]), f])],
		"8-and3": [REP(8, [IF("A", [IF("B", [on])]), f])],
		"8-full": [REP(8, [IF("A", [IF("B", [], [on])], [IF("B", [on])]), f]), r, f, r, REP(8, [f, IF("A", [IF("B", [on])])])],
		"9-double": [ld, ad, wr],
		"9-last": [REP(3, [sr]), ld, sr, wr],
		"9-clamp": [WH("data", [wr, sr])],
		"9-minfirst": [IF("gt_right", [sw])],
		"9-ends": [WH("rdata", [IF("gt_right", [sw]), sr])],
		"9-desc": [WH("rdata", [IF("lt_right", [sw]), sr])],
		"10-shl": [WH("free", [f]), off],
		"10-shr": [WH("free", [f]), off],
		"10-odd": [WH("free", [f]), on],
		"10-msb": [WH("free", [f, off])],
		"10-add2": [f, on],
		"10-sub": [REP(4, [IF("A", [IF("B", [], [on])], [IF("B", [on])]), f])],
		"11-even": [WH("data", [ad, sr]), wr],
		"11-maxfirst": [IF("lt_right", [sw])],
		"11-fill": [WH("data", [IF("gt_mem", [ld]), sr])],
		"11-inv": [WH("rdata", [A("inc"), sr]), sr, wr],
		"11-until": [WH("data", [IF("pos", [ad]), sr]), wr],
		"11-sortsum": [WH("rdata", [IF("gt_right", [sw, sl], [sr])])],
	}

func uses_only(prog: Array, level: Dictionary) -> bool:
	for n in prog:
		if not level["ops"].has(n["op"]):
			return false
		if n.has("cond") and not level["conds"].has(n["cond"]):
			return false
		if n.has("body") and not uses_only(n["body"], level):
			return false
		if n.has("alt") and not uses_only(n["alt"], level):
			return false
	return true

func passes(level: Dictionary, prog: Array) -> bool:
	if Sim.count(prog) > level["limit"] or not uses_only(prog, level):
		return false
	for v in Sim.test_variants(level):
		if not Sim.run(prog, Sim.make_world(level, v["map"], v["data"]))["ok"]:
			return false
	return true

func _init() -> void:
	var bad := 0
	var sol := solutions()
	var nv := naive()
	var sec := second()
	var ids := {}
	for shop in Levels.SHOPS:
		print("— %d класс · %s" % [shop["grade"], shop["title"]])
		if shop["levels"].size() != 12:
			bad += 1
		for level in shop["levels"]:
			var id: String = level["id"]
			if ids.has(id) or not sol.has(id):
				print("FAIL  %s: повтор id или нет решения" % id)
				bad += 1
				continue
			ids[id] = true
			var prog: Array = sol[id]
			var n := Sim.count(prog)
			var ok: bool = passes(level, prog) and n == level["par3"] and level["par3"] < level["par2"] and level["par2"] <= level["limit"] and level["ops"].size() <= 9
			for op in level["ops"]:
				if not Levels.OP_NAMES.has(op) or not Levels.OP_ICONS.has(op):
					ok = false
			for cn in level["conds"]:
				if not Levels.COND_NAMES.has(cn) or not Levels.COND_SHORT.has(cn):
					ok = false
			if (level["ops"].has("if") or level["ops"].has("while")) and level["conds"].is_empty():
				ok = false
			var extra := ""
			if nv.has(id):
				var cheat: bool = passes(level, nv[id])
				extra += "  без идеи: %s" % ("ПРОХОДИТ" if cheat else "отклонено")
				if cheat:
					ok = false
			if sec.has(id):
				var good: bool = passes(level, sec[id])
				extra += "  второе решение (%d бл.): %s" % [Sim.count(sec[id]), "проходит" if good else "НЕ ПРОХОДИТ"]
				if not good:
					ok = false
			print("%s  %-11s вариантов %3d, блоков %2d, норма %d/%d, лимит %d%s" % ["ok  " if ok else "FAIL", id, Sim.test_variants(level).size(), n, level["par3"], level["par2"], level["limit"], extra])
			if not ok:
				bad += 1
	if OS.get_cmdline_user_args().has("dump"):
		var file := FileAccess.open("res://tests/.solutions.json", FileAccess.WRITE)
		# Список в порядке уровней: JSON-словарь Godot сортирует ключи по алфавиту.
		var ordered := []
		for shop in Levels.SHOPS:
			for level in shop["levels"]:
				ordered.append({"grade": shop["grade"], "id": level["id"], "program": sol[level["id"]]})
		file.store_string(JSON.stringify(ordered))
	print("ALL OK" if bad == 0 else "FAILED %d" % bad)
	quit(bad)
