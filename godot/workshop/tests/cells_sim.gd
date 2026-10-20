extends SceneTree
# «Клетки памяти» без браузера: навыки, новое оружие, проклятие и тайные стены.
# Запуск: godot --headless --path godot/workshop --script res://tests/cells_sim.gd
var bad := 0
var g

func check(name: String, ok: bool, info: String = "") -> void:
	print("%s  %s%s" % ["ok  " if ok else "FAIL", name, (" — " + info) if info != "" else ""])
	if not ok:
		bad += 1

func step(n: int) -> void:
	for i in n:
		g.tick(1.0 / 60.0)

func dummy(dx: float, hp: float = 500.0) -> Dictionary:
	# Враг на том же полу, что и герой; не шевелится, пока оглушён.
	g._spawn("slime", g.px + dx, g.py, 1.0)
	var f: Dictionary = g.foes[-1]
	f["hp"] = hp
	f["max"] = hp
	f["stun"] = 99.0
	return f

func fresh(kit: int) -> void:
	g._start_run()
	g._take_kit(kit)
	g.foes.clear()
	g.face = 1

func _init() -> void:
	g = load("res://cells/game.gd").new()
	g.grade = 8
	g.font = ThemeDB.fallback_font
	g.font_b = ThemeDB.fallback_font
	root.add_child(g)
	await process_frame
	# Граната: взрыв ранит врага по дуге.
	fresh(0)
	check("набор «Мечник» начинается с гранаты", g.skill == "grenade")
	var f := dummy(130.0, 20.0)
	g._use_skill()
	step(90)
	check("граната-байт взрывается и побеждает слабого врага", not g.foes.has(f), "hp %s" % f["hp"])
	check("после броска навык на перезарядке", g.skill_cd > 0.0)
	# Турель.
	fresh(1)
	f = dummy(220.0, 24.0)
	g._use_skill()
	step(240)
	check("турель-антивирус сама стреляет и побеждает врага", not g.foes.has(f) and g.turrets.size() == 1, "hp %s, турелей %d" % [f["hp"], g.turrets.size()])
	step(400)
	check("через 8 секунд турель исчезает", g.turrets.is_empty())
	# Ледяной щит.
	fresh(3)
	f = dummy(30.0)
	f["stun"] = 0.0
	g._use_skill()
	var hp0: float = g.hp
	g.hurt = 0.0
	var hit: bool = g._damage(15.0, Vector2(g.px, g.py), false, f)
	check("ледяной щит отражает удар и замораживает врага", not hit and g.hp == hp0 and f["stun"] >= 1.9 and not g.ice_t > 0.0)
	# Крюк.
	fresh(2)
	f = dummy(320.0)
	g._use_skill()
	check("крюк притягивает врага к герою и оглушает", f["x"] - g.px < 120.0 and f["stun"] > 0.0, "расстояние %d" % int(f["x"] - g.px))
	# Хлыст: третий удар серии — двойной.
	fresh(0)
	g.melee = "whip"
	f = dummy(90.0, 2000.0)
	var d := []
	for i in 3:
		var before: float = f["hp"]
		g._zone_key(KEY_X)
		step(22)
		d.append(before - f["hp"])
	check("хлыст: третий удар серии сильнее первого вдвое", d[0] > 0.0 and absf(d[2] / d[0] - 2.2) < 0.05, str(d))
	# Щит-таран: блок спереди, удар в спину проходит.
	fresh(1)
	g.melee = "ram"
	g._zone_key(KEY_X)
	g.hurt = 0.0
	var hp1: float = g.hp
	var front: bool = g._damage(10.0, Vector2(g.px, g.py), false, {"x": g.px + 40.0})
	g.hurt = 0.0
	var back: bool = g._damage(10.0, Vector2(g.px, g.py), false, {"x": g.px - 40.0})
	check("щит-таран держит удар спереди, сзади удар проходит", not front and back and g.hp == hp1 - 10.0)
	f = dummy(60.0, 2000.0)
	f["stun"] = 0.0
	g.hurt = 0.0
	g.swing_cd = 0.0
	g.swing = 0.0
	g.hitstop = 0.0
	g._zone_key(KEY_X)
	step(3)
	check("таран отбрасывает и оглушает врага", f["vx"] > 100.0 and f["stun"] > 0.0, "vx %s, hp %s, swing %s, cd %s, x %s/%s" % [f["vx"], f["hp"], g.swing, g.swing_cd, f["x"], g.px])
	# Бумеранг: два попадания и возврат.
	fresh(0)
	g.ranged = "boomerang"
	f = dummy(260.0, 2000.0)
	g._zone_key(KEY_C)
	check("второй бумеранг нельзя бросить, пока первый летит", g.boomer_out)
	step(240)
	var dealt: float = 2000.0 - f["hp"]
	check("бумеранг ранит врага туда и обратно и возвращается", not g.boomer_out and dealt >= 2.0 * 12.0 * g._dmg_mult() - 0.1, "урон %s" % dealt)
	# Проклятый сундук.
	fresh(0)
	var sc0: int = g.scrolls
	g._open_cursed({"kind": "cchest", "x": g.px, "y": g.py, "used": false})
	check("проклятый сундук: оружие, свиток и проклятие на 10 побед", g.curse == 10 and g.scrolls == sc0 + 1)
	g.curse = 2
	for i in 2:
		var e := dummy(400.0, 1.0)
		g._hit_foe(e, 999.0, 1, true)
	check("каждая победа снимает одну метку, после 10 проклятие спадает", g.curse == 0)
	g.curse = 3
	g.hurt = 0.0
	g.roll = 0.0
	g._damage(1.0, Vector2(g.px, g.py))
	check("под проклятием любой удар смертелен", g.mode == "dead" and g.hp == 0.0)
	# Тайная стена: три удара — и проход открыт.
	fresh(0)
	var found := false
	for tries in 30:
		g._enter_level(1 + tries % 3, "forest")
		if not g.map.get("secrets", []).is_empty():
			found = true
			break
	check("в уровнях есть тайные комнаты", found)
	if found:
		var sc: Dictionary = g.map["secrets"][0]
		g._hit_wall(sc["x"], sc["y"])
		g._hit_wall(sc["x"], sc["y"])
		var still: bool = g._tile(sc["x"], sc["y"]) == "B"
		g._hit_wall(sc["x"], sc["y"])
		check("треснувшая стена выдерживает два удара и рушится от третьего", still and g._tile(sc["x"], sc["y"]) == " " and g._tile(sc["x"], sc["y"] - 1) == " ")
	root.remove_child(g)
	g.free()
	await process_frame
	print("ALL OK" if bad == 0 else "FAILED %d" % bad)
	quit(bad)
