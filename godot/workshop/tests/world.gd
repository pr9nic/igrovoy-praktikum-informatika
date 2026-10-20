extends SceneTree
# Проверка генератора больших уровней «Клеток памяти»: всё нужное достижимо от входа.
# Запуск: godot --headless --path godot/workshop --script res://tests/world.gd
const World = preload("res://cells/world.gd")
var bad := 0

func check(name: String, ok: bool, info: String = "") -> void:
	print("%s  %s%s" % ["ok  " if ok else "FAIL", name, (" — " + info) if info != "" else ""])
	if not ok:
		bad += 1

func _init() -> void:
	var rng := RandomNumberGenerator.new()
	var stats := {"secrets": 0, "secret_items": 0, "cursed": 0, "rooms": 0, "lifts": 0, "ladders": 0, "kdoors": 0, "shops": 0, "foes": 0, "levels": 0}
	var fails := []
	for stage in 5:
		for seed in 40:
			rng.seed = seed * 31 + stage
			var biome: String = World.ROUTE[stage][seed % World.ROUTE[stage].size()]
			var m := World.build(stage, biome, rng)
			stats["levels"] += 1
			var seen := World.reach(m)
			var seen_open := World.reach(m, true)
			var terms := 0
			var info := "этап %d, зерно %d" % [stage + 1, seed]
			var ok: bool = m["rows"].size() == m["h"] and m["rows"][0].length() == m["w"]
			for th in m["things"]:
				var at := Vector2i(th["x"], th["y"])
				if World.solid(m["rows"], at.x, at.y):
					ok = false
					info += " · %s в камне" % th["kind"]
				if th["kind"] in ["portal", "term", "shop"] and not seen.has(at) and not World.FLYING.has(th["kind"]):
					ok = false
					info += " · %s недостижим (%d,%d)" % [th["kind"], at.x, at.y]
				if th["kind"] in ["chest", "scroll"] and not seen_open.has(at):
					ok = false
					info += " · %s недостижим даже с открытой дверью (%d,%d)" % [th["kind"], at.x, at.y]
				if th["kind"] == "term":
					terms += 1
				if th["kind"] == "shop":
					stats["shops"] += 1
				if th["kind"] == "cchest":
					stats["cursed"] += 1
				if not th["kind"] in ["start", "portal", "term", "chest", "scroll", "food", "gold", "shop", "cells", "cchest"]:
					stats["foes"] += 1
			# Под каждым лифтом и под каждой лестницей — пол: шахты не пересекаются.
			for l in m["lifts"]:
				var lx: int = int(l["x"]) - 1
				var lb: int = int(l["bottom"])
				if not World.solid(m["rows"], lx, lb) or not World.solid(m["rows"], lx + 1, lb):
					ok = false
					info += " · под лифтом дыра (%d,%d)" % [lx, lb]
			# Тайная комната: за стеной B, без разрушения стены её предметы недостижимы, после — достижимы.
			for sc in m["secrets"]:
				stats["secrets"] += 1
				var room: Vector2i = sc["room"]
				for th in m["things"]:
					if th["x"] / World.RW == room.x and th["y"] / World.RH == room.y and th["kind"] in ["cells", "gold", "scroll", "food"]:
						stats["secret_items"] += 1
						var at := Vector2i(th["x"], th["y"])
						if seen.has(at) or not seen_open.has(at):
							ok = false
							info += " · тайник (%d,%d) %s" % [at.x, at.y, "виден без пролома" if seen.has(at) else "недостижим"]
			if terms != 3:
				ok = false
				info += " · терминалов %d" % terms
			stats["rooms"] += m["rooms"].size()
			stats["lifts"] += m["lifts"].size()
			stats["kdoors"] += m["kdoors"].size()
			for r in m["rows"]:
				stats["ladders"] += r.count("H")
			if not ok:
				fails.append(info)
	check("200 уровней: портал, терминалы и лавки достижимы от входа, сокровища — за дверью знаний", fails.is_empty(), "; ".join(fails.slice(0, 4)))
	check("тайные комнаты за трескающейся стеной и проклятые сундуки встречаются", stats["secrets"] > 80 and stats["secret_items"] > 200 and stats["cursed"] > 40, str(stats))
	check("уровни большие и ветвистые: в среднем больше 11 комнат, есть лифты, лестницы, двери знаний и лавки", stats["rooms"] / stats["levels"] >= 11 and stats["lifts"] > 50 and stats["ladders"] > 500 and stats["kdoors"] > 30 and stats["shops"] > 20, str(stats))
	for stage in [2, 3, 4]:
		var a := World.arena(stage)
		var s := World.reach(a)
		check("арена этапа %d: босс «%s», всё достижимо" % [stage + 1, a["boss"]], a["boss"] != "" and s.size() > 30)
	var p := World.passage(["forest", "catacomb"])
	var ps := World.reach(p)
	var all := true
	for th in p["things"]:
		if not ps.has(Vector2i(th["x"], th["y"])):
			all = false
	check("«Переход»: фонтан, торговец, Коллекционер и две двери на выбор достижимы", all and p["things"].filter(func(t): return t["kind"] == "door").size() == 2)
	check("развилки маршрута: на этапе 2 и 3 по два биома на выбор", World.options(1, ["grove"]).size() == 2 and World.options(2, ["grove", "forest"]).size() == 2 and not World.options(2, ["grove", "catacomb"]).has("catacomb"))
	print("ALL OK" if bad == 0 else "FAILED %d" % bad)
	quit(bad)
