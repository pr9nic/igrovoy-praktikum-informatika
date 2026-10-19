extends "res://arcade/game.gd"
# «Кодополия»: настольная игра про информатику в духе «Монополии» и Mario Party.
# Ты и три бота ходите по кольцу из 28 клеток: покупаете кварталы, платите аренду (верный ответ «файрвола знаний» снижает её вдвое),
# собираете кристаллы знаний, покупаете предметы, тянете карты «Вирус / Обновление». Квартал, который не купили (отказ или не хватило
# байтов), уходит с торгов: ставки по кругу +1 / +3 / +5 или пас. Со 2-го раунда каждые три раунда — событие раунда (хакатон, DDoS-атака,
# распродажа, обновление сервера, пиковая нагрузка, акция на кристаллы). После каждого раунда — мини-игра на скорость для всех:
# двоичная запись, «что больше», быстрый вопрос, «истина или ложь», «что выведет программа», с 7-го класса — IP-адрес и маска файлов.
# Побеждает тот, у кого больше кристаллов (при равенстве — байтов). Звёзды этапа — за место: 1-е — три, 2-е — две, остальные — одна.
# Правила без графики (мини-игры, торги, события) — в kp_logic.gd; tests/kodopolia.gd проверяет их и доигрывает партии ботов.

const Q = preload("res://cells/questions.gd")
const KP = preload("res://arcade/kp_logic.gd")
const N := 28
const X0 := 30.0
const Y0 := 78.0
const BW := 860.0
const BH := 620.0
const CW := 86.0
const SH := 112.0
const CRYSTAL := 20
const PASS_START := 4
const GROUPS := [
	{"name": "Двоичный квартал", "color": Color("21c7b7"), "price": 6, "lots": ["Бит-переулок", "Байт-стрит"]},
	{"name": "Логический проспект", "color": Color("9b6bff"), "price": 8, "lots": ["Площадь Истины", "Улица И/ИЛИ", "Проспект НЕ"]},
	{"name": "Сетевая гавань", "color": Color("3f8cff"), "price": 10, "lots": ["Порт 80", "Маршрутизатор"]},
	{"name": "Алгоритм-сити", "color": Color("ff9a3a"), "price": 12, "lots": ["Цикл-авеню", "Ветвление"]},
	{"name": "База данных", "color": Color("4fcf6a"), "price": 14, "lots": ["Таблица", "Запрос SELECT", "Ключ-аллея"]},
	{"name": "Облачные высоты", "color": Color("ff6fae"), "price": 16, "lots": ["Облако", "Сервер-тауэр"]},
]
# Тип каждой клетки по кругу (с левого верхнего угла по часовой стрелке); цифра — группа квартала.
const LAYOUT := ["start", 0, "quiz", 0, "chance", 1, "quiz", 1, 1, "shop",
	"quiz", 2, "chance", 2,
	"portal", 3, "quiz", 3, "chance", 4, "quiz", 4, 4, "jail",
	"quiz", 5, "chance", 5]
const ICON := {"quiz": 0, "chance": 1, "shop": 2, "portal": 3, "jail": 4, "start": 5}
const ITEMS := [
	{"id": "dice2", "name": "Двойной кубик", "price": 5, "about": "бросок двух кубиков"},
	{"id": "firewall", "name": "Брандмауэр", "price": 6, "about": "одна аренда бесплатно"},
	{"id": "antivirus", "name": "Антивирус", "price": 4, "about": "защита от вируса"},
	{"id": "link", "name": "Ссылка", "price": 8, "about": "прыжок к кристаллу"},
]
const CARDS := [
	["virus", "Вирус-шифровальщик! Потеряй 5 байтов."], ["update", "Обновление ПО прошло успешно: +4 байта."], ["bug", "Нашёл баг в чужом коде: награда +3 байта."],
	["power", "Сбой питания: пропусти следующий ход."], ["fast", "Быстрый интернет: бросай кубик ещё раз!"], ["sync", "Облачная синхронизация: возьми по 1 байту с каждого."],
	["phish", "Фишинг! Отдай 3 байта следующему игроку."], ["backup", "Резервная копия: получи Антивирус."], ["jump", "Переход по ссылке: прыжок к кристаллу."], ["expert", "Вопрос эксперта: ответь верно — получи 6 байтов."],
]
const NAMES := ["Ты", "Бот Бит", "Бот Байт", "Бот Кэш"]
const COLORS := [Color("ff5a5a"), Color("4f9bff"), Color("4fd07a"), Color("ffc94d")]
const BOARDS := ["Кодоград", "Кибер-порт", "Облачный город"]

var spaces: Array = []
var players: Array = []
var cur := 0
var round_n := 1
var rounds := 8
var phase := "roll"        # roll, rolling, move, dialog, wait, mini, mini_res, end
var dice := [1, 0]
var opt_rects: Array = []   # прямоугольники вариантов ответа (рисование и щелчки)
var dice_t := 0.0
var steps_left := 0
var hop_t := 0.0
var crystal_at := 6
var dlg: Dictionary = {}
var wait_t := 0.0
var next_call: Callable
var log_lines: Array = []
var use_double := false
var skill := 0.6
var mini: Dictionary = {}
var mini_n := 0
var qbank: Array = []
var kp := {}
var placings: Array = []
var bot_t := 0.0
var mini_order: Array = []  # порядок видов мини-игр на партию
var round_ev := ""          # событие текущего раунда (KP.EVENTS) или ""
var ev_group := -1          # квартал, который «положила» DDoS-атака
var last_ev := ""
var auc: Dictionary = {}    # идущие торги: участок, ставка, лидер, кто спасовал, пределы ботов
var bank := 0               # сколько байтов выдал банк минус сколько забрал: сверка в tests/kodopolia.gd
var stats := {}
# Сетевая партия из лобби практикума: host — партию ведёт этот компьютер (создатель лобби), guest — показываем снимок создателя.
var net := ""
var my := 0
var net_names: Array = []
var net_started := false
var net_poll := 0.0
var net_seq := 0
var seen_seq := -1
var net_online: Array = []
var net_err := ""
var afk := 0.0
var wait_snap := false
var my_pick := -1
var my_pick_round := -1
var snap_age := 0.0
const NET_JS := "window.kpNet=(function(table,token){var N={inbox:[],snap:'',err:'',out:'',online:[],q:[]};function post(p,b){return fetch('/results/api/kp/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b),cache:'no-store'}).then(function(r){return r.json().then(function(d){if(!r.ok||d.status!=='ok')throw new Error(d.message||'нет связи');return d})})}var busy=false;setInterval(function(){if(busy)return;busy=true;var b={table:table,token:token};if(N.out){b.snap=N.out;N.out=''}if(N.q.length)b.input=N.q.shift();post('sync',b).then(function(d){N.err='';if(d.inputs)N.inbox=N.inbox.concat(d.inputs);if(d.snap)N.snap=d.snap;N.online=d.online||[]}).catch(function(e){N.err=e.message}).then(function(){busy=false})},350);N.take=function(){var x=N.inbox;N.inbox=[];return JSON.stringify({inputs:x,snap:N.snap,online:N.online,err:N.err})};return N})(%d,%s);"

func setup() -> void:
	title = "Кодополия"
	unit = "раундов"
	show_lives = false
	stages = 3
	rules = ["Настольная игра про информатику: ты и три бота ходите по кругу и собираете кристаллы знаний.",
		"Покупай кварталы, получай аренду; ответь верно «файрволу знаний» — заплатишь половину.",
		"Не купленный квартал — на торги. Каждые 3 раунда — событие: хакатон, DDoS, распродажа…",
		"Кристалл стоит %d байтов, после покупки он переезжает. Магазин, вирусы, портал, карантин." % CRYSTAL,
		"После каждого раунда — мини-игра на скорость. Пробел — бросить кубик, 1–4 — выбрать ответ."]
	for n in ["kp_board1", "kp_board2", "kp_board3", "kp_token0", "kp_token1", "kp_token2", "kp_token3", "kp_icon0", "kp_icon1", "kp_icon2", "kp_icon3", "kp_icon4", "kp_icon5", "kp_icon6", "kp_icon7",
			"kp_build0", "kp_build1", "kp_build2", "kp_build3", "kp_build4", "kp_build5", "kp_item0", "kp_item1", "kp_item2", "kp_item3"]:
		var path := "res://assets/%s.%s" % [n, "jpg" if n.begins_with("kp_board") else "png"]
		if ResourceLoader.exists(path):
			kp[n] = load(path)
	var all: Array = Q.DATA.get(str(grade), Q.DATA.get("8", []))
	qbank = all.duplicate()
	if OS.has_feature("web"):
		var raw = JavaScriptBridge.eval("(function(){try{if(!/[?&]net=1/.test(location.search))return '';return sessionStorage.getItem('school4-kp')||''}catch(e){return ''}})()")
		var kd = JSON.parse_string(str(raw)) if raw != null and str(raw) != "" else null
		if kd is Dictionary and kd.get("players") is Array and kd.get("token") is String:
			my = int(kd.get("seat", 0))
			net = "host" if my == 0 else "guest"
			net_names = kd["players"]
			stages = 1
			JavaScriptBridge.eval(NET_JS % [int(kd.get("table", 0)), JSON.stringify(str(kd["token"]))])
			rules = ["Сетевая партия «%s»: одноклассники играют за своими компьютерами." % str(kd.get("title", "")),
				"Свободные места занимают боты. Ход каждого — на его компьютере.",
				"Не купленный квартал уходит с торгов. Каждые три раунда — событие раунда.",
				"Кристалл стоит %d байтов. Пробел — бросить кубик, 1–4 — выбрать ответ." % CRYSTAL]

func goal_text() -> String:
	return "Поле «%s»: %d раундов. Займи первое место — три звезды." % [BOARDS[stage - 1], rounds]

func progress() -> float:
	return clampf(float(round_n - 1) / float(rounds), 0.0, 1.0)

func progress_text() -> String:
	return "Раунд %d / %d" % [mini(round_n, rounds), rounds]

func setup_stage() -> void:
	rounds = [8, 10, 12][stage - 1]
	skill = [0.55, 0.7, 0.85][stage - 1]

func reset() -> void:
	_build_board()
	players.clear()
	for i in 4:
		var human: bool = i == 0 if net == "" else i < net_names.size()
		var nm: String = NAMES[i] if net == "" or not human else _short(str(net_names[i])) + (" (ты)" if i == my else "")
		players.append({"name": nm, "color": COLORS[i], "pos": 0, "bytes": 10, "crystals": 0, "items": [], "skip": false, "bot": not human, "hop": 0.0})
	cur = 0
	round_n = 1
	phase = "roll"
	dlg = {}
	mini = {}
	log_lines = ["Твой ход: нажми Пробел или «Бросить кубик»."] if net == "" or my == 0 else ["Первым ходит %s." % players[0]["name"]]
	crystal_at = _free_space(-1)
	use_double = false
	placings = []
	score = players[my]["bytes"]
	bot_t = 0.0
	mini_order = KP.mini_order(grade, rng)
	round_ev = ""
	ev_group = -1
	last_ev = ""
	auc = {}
	bank = 0
	stats = {"crystals": 0, "auctions": 0, "sold": 0, "events": 0}

func stage_stars() -> int:
	var place := placings.find(my) + 1
	return 3 if place == 1 else (2 if place == 2 else 1)

# ---------- поле ----------

func _build_board() -> void:
	spaces.clear()
	var lot_i := [0, 0, 0, 0, 0, 0]
	for i in N:
		var t = LAYOUT[i]
		var sp := {"type": "lot" if t is int else str(t), "rect": _rect(i), "owner": -1, "up": 0}
		if t is int:
			var g: Dictionary = GROUPS[t]
			sp["group"] = t
			sp["name"] = g["lots"][lot_i[t]]
			sp["price"] = int(g["price"])
			lot_i[t] += 1
		spaces.append(sp)

func _rect(i: int) -> Rect2:
	if i < 10:
		return Rect2(X0 + i * CW, Y0, CW, CW)
	if i < 14:
		return Rect2(X0 + 9 * CW, Y0 + CW + (i - 10) * SH, CW, SH)
	if i < 24:
		return Rect2(X0 + (23 - i) * CW, Y0 + BH - CW, CW, CW)
	return Rect2(X0, Y0 + BH - CW - SH * (i - 23), CW, SH)

func _free_space(avoid: int) -> int:
	for attempt in 100:
		var i := rng.randi_range(1, N - 1)
		if i != avoid and not (spaces[i]["type"] in ["start", "shop", "portal", "jail"]):
			return i
	return 2

func _rent(sp: Dictionary) -> int:
	var r: int = int(sp["price"]) / 2
	var full := true
	for s in spaces:
		if s["type"] == "lot" and s["group"] == sp["group"] and s["owner"] != sp["owner"]:
			full = false
	if full:
		r *= 2
	if int(sp["up"]) > 0:
		r *= 2
	return KP.event_rent(r, round_ev, ev_group, int(sp["group"]))

func _crystal_price() -> int:
	return KP.event_crystal(CRYSTAL, round_ev)

func _reward(n: int) -> int:
	# Награда за верный ответ: в «Хакатон» — вдвое больше.
	return KP.event_reward(n, round_ev)

func _bt(n: int) -> String:
	return "%d %s" % [n, Fmt.plural(n, "байт", "байта", "байтов")]

func _earn(pl: Dictionary, n: int) -> void:
	# Байты из банка (n > 0) или в банк (n < 0); переводы между игроками идут мимо банка.
	pl["bytes"] = int(pl["bytes"]) + n
	bank += n

# ---------- ход ----------

func say(s: String) -> void:
	log_lines.push_front(s)
	if log_lines.size() > 4:
		log_lines.pop_back()

func p() -> Dictionary:
	return players[cur]

func after(t: float, c: Callable) -> void:
	phase = "wait"
	wait_t = t
	next_call = c

func roll() -> void:
	if phase != "roll":
		return
	var two: bool = use_double or (p()["bot"] and p()["items"].has("dice2") and rng.randf() < 0.6)
	if two:
		p()["items"].erase("dice2")
		use_double = false
	dice = [rng.randi_range(1, 6), rng.randi_range(1, 6) if two else 0]
	steps_left = dice[0] + dice[1]
	phase = "rolling"
	dice_t = 0.8
	sfx.emit("click")

func _begin_turn() -> void:
	use_double = false
	if p()["skip"]:
		p()["skip"] = false
		say("%s пропускает ход." % p()["name"])
		after(1.0, _end_turn)
		return
	phase = "roll"
	bot_t = 0.8
	if net != "":
		say("Ходит %s." % p()["name"])
	elif not p()["bot"]:
		say("Твой ход: Пробел — бросить кубик." + ("  D — двойной кубик." if p()["items"].has("dice2") else "") + ("  L — ссылка к кристаллу." if p()["items"].has("link") else ""))

func _end_turn() -> void:
	score = players[my]["bytes"]
	cur += 1
	if cur >= 4:
		cur = 0
		_start_mini()
		return
	_begin_turn()

func _hop() -> void:
	var pl := p()
	pl["pos"] = (int(pl["pos"]) + 1) % N
	pl["hop"] = 1.0
	sfx.emit("step")
	steps_left -= 1
	if pl["pos"] == 0:
		_earn(pl, PASS_START)
		say("%s проходит Старт: +%d байта." % [pl["name"], PASS_START])
	if pl["pos"] == crystal_at and steps_left > 0:
		_offer_crystal(func(): phase = "move")
		return

func _offer_crystal(then: Callable) -> void:
	var pl := p()
	var price := _crystal_price()
	if int(pl["bytes"]) < price:
		if not pl["bot"]:
			say("Кристалл знаний стоит %d байтов — пока не хватает." % price)
		then.call()
		return
	var cb := func(i: int):
		if i == 0:
			_earn(pl, -price)
			pl["crystals"] += 1
			stats["crystals"] += 1
			say("%s получает кристалл знаний!" % pl["name"])
			burst(_center(crystal_at), Color("c08bff"), 40, 420.0, "p_star", 34.0)
			sfx.emit("win")
			crystal_at = _free_space(crystal_at)
		then.call()
	dialog("Кристалл знаний!", "Купить кристалл за %d байтов?" % price, ["Купить", "Пройти мимо"], cb, 0)

func _land() -> void:
	var pl := p()
	var i: int = pl["pos"]
	var sp: Dictionary = spaces[i]
	if i == crystal_at:
		_offer_crystal(func(): _resolve(sp))
		return
	_resolve(sp)

func _resolve(sp: Dictionary) -> void:
	var pl := p()
	match sp["type"]:
		"start":
			_end_soon()
		"lot":
			_lot(sp)
		"quiz":
			var gain := _reward(4)
			var cbq := func(ok: bool):
				if ok:
					_earn(pl, gain)
				_end_soon()
			ask("Клетка знаний", "Верный ответ — +%s." % _bt(gain), cbq)
		"chance":
			_card()
		"shop":
			_shop()
		"portal":
			say("%s входит в портал и переносится к кристаллу." % pl["name"])
			pl["pos"] = crystal_at
			pl["hop"] = 1.0
			burst(_center(crystal_at), Color("9b6bff"), 30, 360.0)
			after(0.6, func(): _offer_crystal(_end_soon))
		"jail":
			var cbj := func(ok: bool):
				if not ok:
					pl["skip"] = true
				_end_soon()
			ask("Карантин", "Ответь верно — иначе пропустишь следующий ход.", cbj)

func _end_soon() -> void:
	after(0.7, _end_turn)

func _lot(sp: Dictionary) -> void:
	var pl := p()
	var price: int = sp["price"]
	var owner: int = sp["owner"]
	if owner == -1:
		if int(pl["bytes"]) < price:
			say("«%s» стоит %d байтов — не хватает." % [sp["name"], price])
			_auction(sp)
			return
		var want := 0 if (int(pl["bytes"]) - price >= 4 and rng.randf() < 0.85) else 1
		var cbb := func(i: int):
			if i == 0:
				_earn(pl, -price)
				sp["owner"] = cur
				say("%s покупает «%s»." % [pl["name"], sp["name"]])
				sfx.emit("deliver")
				_end_soon()
			else:
				_auction(sp)
		dialog(sp["name"], "%s · цена %d байтов, аренда %d.\nКупить участок? Если нет — он уйдёт с торгов." % [GROUPS[sp["group"]]["name"], price, price / 2], ["Купить", "Не покупать"], cbb, want)
	elif owner == cur:
		if int(sp["up"]) == 0 and int(pl["bytes"]) >= price:
			var cbu := func(i: int):
				if i == 0:
					_earn(pl, -price)
					sp["up"] = 1
					say("%s улучшает «%s»." % [pl["name"], sp["name"]])
				_end_soon()
			dialog("Апгрейд сервера", "Улучшить «%s» за %d байтов? Аренда удвоится." % [sp["name"], price], ["Улучшить", "Нет"], cbu, 0 if int(pl["bytes"]) - price >= 6 else 1)
		else:
			_end_soon()
	else:
		var rent := _rent(sp)
		var lord: Dictionary = players[owner]
		if rent <= 0:
			say("DDoS-атака: «%s» в этом раунде аренду не берёт." % sp["name"])
			_end_soon()
			return
		if pl["items"].has("firewall"):
			pl["items"].erase("firewall")
			say("Брандмауэр %s защитил от аренды!" % ("тебя" if not pl["bot"] else pl["name"]))
			_end_soon()
			return
		var cbr := func(ok: bool):
			var pay := mini(int(pl["bytes"]), rent / 2 if ok else rent)
			pl["bytes"] -= pay
			lord["bytes"] += pay
			say("%s платит игроку %s: %d байт." % [pl["name"], lord["name"], pay])
			_end_soon()
		ask("Файрвол знаний", "Участок игрока %s: аренда %d. Ответь верно — заплатишь половину." % [lord["name"], rent], cbr)

func _card() -> void:
	var pl := p()
	var c: Array = CARDS[rng.randi_range(0, CARDS.size() - 1)]
	var done := func():
		match c[0]:
			"virus":
				if pl["items"].has("antivirus"):
					pl["items"].erase("antivirus")
					say("Антивирус остановил шифровальщика!")
				else:
					_earn(pl, -mini(5, int(pl["bytes"])))
			"update":
				_earn(pl, 4)
			"bug":
				_earn(pl, 3)
			"power":
				pl["skip"] = true
			"sync":
				for o in players:
					if o != pl and int(o["bytes"]) > 0:
						o["bytes"] -= 1
						pl["bytes"] += 1
			"phish":
				if pl["items"].has("antivirus"):
					pl["items"].erase("antivirus")
					say("Антивирус распознал фишинг!")
				else:
					var to: Dictionary = players[(cur + 1) % 4]
					var k := mini(3, int(pl["bytes"]))
					pl["bytes"] -= k
					to["bytes"] += k
			"backup":
				if pl["items"].size() < 3:
					pl["items"].append("antivirus")
			"jump":
				pl["pos"] = crystal_at
				pl["hop"] = 1.0
				after(0.5, func(): _offer_crystal(_end_soon))
				return
			"fast":
				phase = "roll"
				bot_t = 0.8
				say("%s бросает ещё раз!" % pl["name"])
				return
			"expert":
				var gain := _reward(6)
				var cbe := func(ok: bool):
					if ok:
						_earn(pl, gain)
					_end_soon()
				ask("Вопрос эксперта", "Верный ответ — +%s." % _bt(gain), cbe)
				return
		_end_soon()
	dialog("Карта: " + ("Вирус" if c[0] in ["virus", "phish", "power"] else "Обновление"), c[1], ["OK"], func(_i: int): done.call(), 0)

func _shop() -> void:
	var pl := p()
	var opts := []
	var cost := []
	for it in ITEMS:
		cost.append(KP.event_shop(int(it["price"]), round_ev))
		opts.append("%s — %s (%s)" % [it["name"], _bt(int(cost[-1])), it["about"]])
	opts.append("Уйти из магазина")
	var pick := ITEMS.size()
	if pl["bot"]:
		var can := []
		for k in ITEMS.size():
			if int(pl["bytes"]) >= int(cost[k]) + 6:
				can.append(k)
		if can.size() and pl["items"].size() < 3:
			pick = can[rng.randi_range(0, can.size() - 1)]
	var cbs := func(i: int):
		if i < ITEMS.size():
			var it: Dictionary = ITEMS[i]
			var c: int = cost[i]
			if int(pl["bytes"]) < c or pl["items"].size() >= 3:
				say("Не хватает байтов или места для предмета.")
			else:
				_earn(pl, -c)
				pl["items"].append(it["id"])
				say("%s покупает: %s." % [pl["name"], it["name"]])
				sfx.emit("deliver")
		_end_soon()
	dialog("Магазин", "Предметов можно держать не больше трёх." + (" Распродажа: всё вдвое дешевле!" if round_ev == "sale" else ""), opts, cbs, pick)

# ---------- торги ----------
# Правила (старт, шаги, очередь, пределы ботов) — в kp_logic.gd. Ставит каждый по очереди в своём окне выбора,
# в сетевой партии — обычным вводом «choose» с номером варианта; пас — выход из торгов, автопилот за отключившегося пасует.

func _auction(sp: Dictionary) -> void:
	var opening: int = KP.auction_start(int(sp["price"]))
	var lims := []
	for k in 4:
		lims.append(_bot_limit(k, sp))
	auc = {"sp": sp, "bid": opening - 1, "lead": -1, "out": [false, false, false, false], "turn": cur, "limits": lims}
	stats["auctions"] += 1
	say("«%s» уходит с торгов: старт — %s." % [sp["name"], _bt(opening)])
	_auction_next()

func _bot_limit(k: int, sp: Dictionary) -> int:
	var g: int = sp["group"]
	var per := [0, 0, 0, 0]
	var count := 0
	for s in spaces:
		if s["type"] == "lot" and int(s["group"]) == g:
			count += 1
			if int(s["owner"]) >= 0:
				per[int(s["owner"])] += 1
	var theirs := 0
	for o in 4:
		if o != k:
			theirs = maxi(theirs, int(per[o]))
	return KP.auction_limit(int(sp["price"]), int(players[k]["bytes"]), int(per[k]), theirs, count, skill, rng.randi_range(-1, 1), _crystal_price())

func _auction_next() -> void:
	var sp: Dictionary = auc["sp"]
	var bytes := []
	for pl in players:
		bytes.append(int(pl["bytes"]))
	var k: int = KP.auction_next(int(auc["turn"]), int(auc["lead"]), auc["out"], bytes, int(auc["bid"]))
	if k < 0:
		_auction_end()
		return
	auc["turn"] = k
	var bid: int = auc["bid"]
	var lead: int = auc["lead"]
	var steps: Array = KP.auction_steps(bid, int(players[k]["bytes"]))
	var opts := []
	for s in steps:
		opts.append("Ставка %s (+%d)" % [_bt(bid + int(s)), int(s)])
	opts.append("Пас")
	var pick := steps.size()
	if players[k]["bot"]:
		var st: int = KP.auction_bot_step(bid, int(auc["limits"][k]), rng.randf())
		if st > 0 and steps.has(st):
			pick = steps.find(st)
	var now := "Стартовая ставка — %s." % _bt(bid + 1)
	if lead >= 0:
		now = "Ставка сейчас: %s — %s." % [_bt(bid), players[lead]["name"]]
	var cb := func(i: int):
		if i < steps.size():
			auc["bid"] = bid + int(steps[i])
			auc["lead"] = k
			say("Торги: %s ставит %s." % [players[k]["name"], _bt(int(auc["bid"]))])
		else:
			auc["out"][k] = true
		_auction_next()
	dialog("Торги: " + str(sp["name"]), "%s · цена %d байтов. Пас — выход из торгов.\n%s Ставит: %s." % [GROUPS[sp["group"]]["name"], int(sp["price"]), now, players[k]["name"]], opts, cb, pick, k)
	dlg["t"] = 0.8

func _auction_end() -> void:
	var sp: Dictionary = auc["sp"]
	var lead: int = auc["lead"]
	var bid: int = auc["bid"]
	auc = {}
	if lead >= 0:
		_earn(players[lead], -bid)
		sp["owner"] = lead
		stats["sold"] += 1
		say("%s выигрывает торги: «%s» за %s." % [players[lead]["name"], sp["name"], _bt(bid)])
		sfx.emit("deliver")
	else:
		say("На «%s» никто не поставил." % sp["name"])
	_end_soon()

# ---------- окна выбора и вопросы ----------

func dialog(head: String, body: String, opts: Array, cb: Callable, bot_pick: int = 0, who: int = -1) -> void:
	# who — кто выбирает (на торгах это не обязательно тот, чей ход); bot_pick — выбор бота и автопилота за отключившегося.
	var seat: int = cur if who < 0 else who
	dlg = {"head": head, "body": body, "opts": opts, "cb": cb, "bot": players[seat]["bot"], "bot_pick": clampi(bot_pick, 0, opts.size() - 1), "t": 1.3, "who": seat}
	phase = "dialog"

func choose(i: int) -> void:
	if phase != "dialog" or i < 0 or i >= dlg["opts"].size():
		return
	var cb: Callable = dlg["cb"]
	dlg = {}
	phase = "wait"
	wait_t = 0.0
	next_call = func(): pass
	sfx.emit("click")
	cb.call(i)

func ask(head: String, body: String, cb: Callable) -> void:
	var q: Dictionary = _question()
	var opts: Array = [q["a"]] + q["w"]
	opts.shuffle()
	var right := opts.find(q["a"])
	var bot_pick := right if rng.randf() < skill else (right + 1) % opts.size()
	var cba := func(i: int):
		var ok: bool = i == right
		var pl := p()
		say(("%s отвечает верно!" % pl["name"]) if ok else ("%s ошибается. Верно: %s" % [pl["name"], q["a"]]))
		sfx.emit("deliver" if ok else "error")
		if ok:
			burst(_center(int(pl["pos"])), Color("5fe0b5"), 18, 300.0)
		dlg = {"head": "Верно!" if ok else "Неверно", "body": str(q["e"]), "opts": [], "feedback": true, "ok": ok}
		phase = "wait"
		wait_t = 1.6 if not pl["bot"] else 0.9
		next_call = func():
			dlg = {}
			cb.call(ok)
	dialog(head, body + "\n\n" + str(q["q"]), opts, cba, bot_pick)
	dlg["right"] = right

func _question() -> Dictionary:
	if qbank.is_empty():
		qbank = Q.DATA.get(str(grade), Q.DATA.get("8", [])).duplicate()
	return qbank.pop_at(rng.randi_range(0, qbank.size() - 1))

# ---------- мини-игры ----------

func _start_mini() -> void:
	# Вид мини-игры — по кругу из перемешанного на партию списка (KP.mini_order): за 8+ раундов встречаются все виды.
	mini_n += 1
	if mini_order.is_empty():
		mini_order = KP.mini_order(grade, rng)
	var kind: String = mini_order[(round_n - 1) % mini_order.size()]
	var opts: Array = []
	var right := 0
	var q := ""
	var code: Array = []
	if kind == "quiz":
		var qq := _question()
		opts = [qq["a"]] + qq["w"]
		opts.shuffle()
		right = opts.find(qq["a"])
		q = "Быстрый вопрос: " + str(qq["q"])
	else:
		var m: Dictionary = KP.mini_make(kind, grade, rng)
		opts = m["opts"]
		right = int(m["right"])
		q = str(m["q"])
		code = m["code"]
	var bots := []
	for k in 4:
		var human: bool = not players[k]["bot"]
		bots.append({"t": 99.0 if human else rng.randf_range(1.2, 4.6) * (1.45 - skill), "ok": false if human else rng.randf() < skill, "done": false, "human": human, "pick": -1})
	# Программу надо прочитать — на неё больше времени.
	mini = {"kind": kind, "q": q, "code": code, "opts": opts, "right": right, "t": 0.0, "limit": 12.0 if code.size() else 9.0, "pick": -1, "pt": 0.0, "bots": bots}
	phase = "mini"
	sfx.emit("click")

func _mini_pick(seat: int, i: int) -> void:
	if phase != "mini" or seat < 0 or seat >= 4 or i < 0 or i >= mini["opts"].size():
		return
	var b: Dictionary = mini["bots"][seat]
	if not b["human"] or int(b["pick"]) != -1:
		return
	b["pick"] = i
	b["t"] = mini["t"]
	b["ok"] = i == int(mini["right"])
	b["done"] = true
	if seat == my:
		mini["pick"] = i
		mini["pt"] = mini["t"]
		sfx.emit("deliver" if i == int(mini["right"]) else "error")

func _mini_finish() -> void:
	var res := []
	for k in 4:
		var b: Dictionary = mini["bots"][k]
		if b["ok"] and float(b["t"]) <= float(mini["limit"]):
			res.append([k, float(b["t"])])
	res.sort_custom(func(a, b): return a[1] < b[1])
	var prize := [6, 4, 2, 1]
	var lines := []
	for k in res.size():
		var gain := _reward(int(prize[k]))
		_earn(players[res[k][0]], gain)
		lines.append("%s +%d" % [players[res[k][0]]["name"], gain])
	mini["result"] = lines
	phase = "mini_res"
	wait_t = 2.6
	score = players[my]["bytes"]
	sfx.emit("win" if res.size() and res[0][0] == my else "deliver")

func _after_mini() -> void:
	mini = {}
	round_n += 1
	round_ev = ""
	ev_group = -1
	if round_n > rounds:
		_finish()
		return
	say("Раунд %d из %d." % [round_n, rounds])
	if KP.event_round(round_n):
		_round_event()
		return
	_begin_turn()

func _round_event() -> void:
	# Карта события на весь раунд: её видят все, ответа не нужно.
	round_ev = KP.event_pick(rng, last_ev)
	last_ev = round_ev
	stats["events"] += 1
	if round_ev == "ddos":
		# «Кладём» квартал, где уже есть хозяева, — так событие заметно.
		var owned := []
		for s in spaces:
			if s["type"] == "lot" and int(s["owner"]) >= 0 and not owned.has(int(s["group"])):
				owned.append(int(s["group"]))
		ev_group = owned[rng.randi_range(0, owned.size() - 1)] if owned.size() else rng.randi_range(0, GROUPS.size() - 1)
	elif round_ev == "update":
		crystal_at = _free_space(crystal_at)
		burst(_center(crystal_at), Color("c08bff"), 30, 360.0)
	say("Событие раунда: %s." % KP.event_name(round_ev))
	dlg = {"head": "Событие раунда: " + KP.event_name(round_ev), "body": _event_text(false), "opts": [], "feedback": true, "ok": true}
	phase = "wait"
	wait_t = 2.6
	next_call = func():
		dlg = {}
		_begin_turn()
	sfx.emit("win")

func _event_text(brief: bool) -> String:
	return KP.event_text(round_ev, str(GROUPS[ev_group]["name"]) if ev_group >= 0 and ev_group < GROUPS.size() else "", brief)

func _finish() -> void:
	var order := [0, 1, 2, 3]
	order.sort_custom(func(a, b): return int(players[a]["crystals"]) > int(players[b]["crystals"]) or (int(players[a]["crystals"]) == int(players[b]["crystals"]) and int(players[a]["bytes"]) > int(players[b]["bytes"])))
	placings = order
	phase = "end"
	stage_won()

# ---------- игровой цикл и ввод ----------

func tick(delta: float) -> void:
	for pl in players:
		pl["hop"] = maxf(0.0, float(pl["hop"]) - delta * 4.0)
	if net == "guest":
		return
	if net == "host":
		_afk(delta)
	match phase:
		"roll":
			if p()["bot"]:
				bot_t -= delta
				if bot_t <= 0.0:
					if p()["items"].has("link") and int(p()["bytes"]) >= _crystal_price() and rng.randf() < 0.7:
						_use_link()
					else:
						roll()
		"rolling":
			dice_t -= delta
			if dice_t <= 0.0:
				say("%s выбрасывает %d." % [p()["name"], steps_left])
				phase = "move"
				hop_t = 0.15
		"move":
			hop_t -= delta
			if hop_t <= 0.0:
				hop_t = 0.24
				if steps_left > 0:
					_hop()
				if phase == "move" and steps_left <= 0:
					phase = "wait"
					wait_t = 0.25
					next_call = _land
		"dialog":
			if dlg.get("bot", false):
				dlg["t"] -= delta
				if dlg["t"] <= 0.0:
					choose(int(dlg["bot_pick"]))
		"wait":
			wait_t -= delta
			if wait_t <= 0.0:
				phase = "busy"
				next_call.call()
		"mini":
			mini["t"] += delta
			var all_done := true
			for b in mini["bots"]:
				if not b["human"] and not b["done"] and float(mini["t"]) >= float(b["t"]):
					b["done"] = true
				all_done = all_done and (b["done"] or (not b["human"] and float(b["t"]) > float(mini["limit"])))
			if float(mini["t"]) >= float(mini["limit"]) or all_done:
				_mini_finish()
		"mini_res":
			wait_t -= delta
			if wait_t <= 0.0:
				_after_mini()

func _use_link() -> void:
	var pl := p()
	pl["items"].erase("link")
	pl["pos"] = crystal_at
	pl["hop"] = 1.0
	say("%s переходит по ссылке прямо к кристаллу!" % pl["name"])
	burst(_center(crystal_at), Color("7df9ff"), 26, 340.0)
	after(0.5, func(): _offer_crystal(_end_soon))

func _my_roll() -> bool:
	return phase == "roll" and cur == my and not p()["bot"]

func _my_dlg() -> bool:
	return phase == "dialog" and not dlg.get("bot", false) and int(dlg.get("who", cur)) == my

func _act(type: String, i: int = -1) -> void:
	# Действие игрока за этим компьютером: у гостя уходит создателю лобби, иначе выполняется сразу.
	if net == "guest":
		if type == "mini":
			if my_pick != -1:
				return
			my_pick = i
			my_pick_round = round_n
			mini["pick"] = i
			sfx.emit("click")
		elif wait_snap:
			return
		else:
			wait_snap = true
		JavaScriptBridge.eval("kpNet.q.push(%s);" % JSON.stringify({"type": type, "i": i}))
		return
	_do(my, type, i)

func _do(seat: int, type: String, i: int) -> void:
	match type:
		"mini":
			_mini_pick(seat, i)
		"choose":
			if phase == "dialog" and not dlg.get("bot", false) and int(dlg.get("who", cur)) == seat:
				choose(i)
		"roll":
			if phase == "roll" and cur == seat:
				roll()
		"double":
			if phase == "roll" and cur == seat and p()["items"].has("dice2"):
				use_double = not use_double
				say("Двойной кубик: " + ("включён" if use_double else "выключен") + ".")
		"link":
			if phase == "roll" and cur == seat and p()["items"].has("link"):
				_use_link()

func key(k: int) -> void:
	if phase == "mini":
		if k >= KEY_1 and k <= KEY_4:
			_act("mini", k - KEY_1)
		return
	if _my_dlg():
		if k >= KEY_1 and k < KEY_1 + dlg["opts"].size():
			_act("choose", k - KEY_1)
		elif (k == KEY_ENTER or k == KEY_SPACE) and dlg["opts"].size() == 1:
			_act("choose", 0)
		return
	if _my_roll():
		if k == KEY_SPACE or k == KEY_ENTER:
			_act("roll")
		elif k == KEY_D and p()["items"].has("dice2"):
			_act("double")
		elif k == KEY_L and p()["items"].has("link"):
			_act("link")

func click(pt: Vector2) -> void:
	if phase == "mini":
		for i in mini["opts"].size():
			if _mini_rect(i).has_point(pt):
				_act("mini", i)
		return
	if _my_dlg():
		for i in dlg["opts"].size():
			if _opt_rect(i, dlg["opts"].size()).has_point(pt):
				_act("choose", i)
		return
	if _my_roll() and Rect2(330, 470, 220, 56).has_point(pt):
		_act("roll")

# ---------- сеть ----------

func _short(name: String) -> String:
	var parts_n := name.split(" ", false)
	return "%s %s." % [parts_n[1], parts_n[0].substr(0, 1)] if parts_n.size() >= 2 else name

func _process(delta: float) -> void:
	super(delta)
	if net == "":
		return
	if not net_started and state == "intro":
		net_started = true
		stage = 1
		start()
	snap_age += delta
	net_poll -= delta
	if net_poll > 0.0:
		return
	net_poll = 0.3
	var d = JSON.parse_string(str(JavaScriptBridge.eval("window.kpNet?kpNet.take():'{}'")))
	if not (d is Dictionary):
		return
	net_online = d.get("online", []) if d.get("online") is Array else []
	net_err = str(d.get("err", ""))
	if net == "host":
		for inp in d.get("inputs", []):
			var seat := int(inp.get("seat", -1))
			if seat > 0 and seat < 4 and not players[seat]["bot"]:
				afk = 0.0
				_do(seat, str(inp.get("type", "")), int(inp.get("i", -1)))
		net_seq += 1
		JavaScriptBridge.eval("kpNet.out=%s;" % JSON.stringify(JSON.stringify(_snap())))
	elif str(d.get("snap", "")) != "":
		var sn = JSON.parse_string(str(d["snap"]))
		if sn is Dictionary and int(sn.get("seq", -1)) != seen_seq:
			seen_seq = int(sn.get("seq", -1))
			snap_age = 0.0
			_apply(sn)

func _afk(delta: float) -> void:
	# Если одноклассник долго не ходит или отключился, за него ходит автопилот: партия не зависает.
	var waiting := -1
	if phase == "roll" and cur != my and not p()["bot"]:
		waiting = cur
	elif phase == "dialog" and not dlg.get("bot", false) and int(dlg.get("who", my)) != my:
		waiting = int(dlg.get("who", my))
	if waiting < 0:
		afk = 0.0
		return
	afk += delta
	var off: bool = waiting < net_online.size() and not net_online[waiting]
	if afk > (4.0 if off else 30.0):
		afk = 0.0
		if phase == "roll":
			roll()
		else:
			choose(int(dlg.get("bot_pick", 0)))

func _snap() -> Dictionary:
	var ps := []
	for pl in players:
		ps.append({"name": pl["name"], "pos": pl["pos"], "bytes": pl["bytes"], "crystals": pl["crystals"], "items": pl["items"], "skip": pl["skip"], "bot": pl["bot"]})
	var own := []
	for sp in spaces:
		own.append([sp["owner"], sp["up"]])
	var d := {}
	if not dlg.is_empty():
		d = {"head": dlg.get("head", ""), "body": dlg.get("body", ""), "opts": dlg.get("opts", []), "who": dlg.get("who", cur), "bot": dlg.get("bot", false),
			"feedback": dlg.get("feedback", false), "ok": dlg.get("ok", false), "t": dlg.get("t", 1.0), "bot_pick": dlg.get("bot_pick", 0)}
	var m := {}
	if not mini.is_empty():
		var res: bool = phase == "mini_res"
		var bs := []
		for b in mini["bots"]:
			bs.append({"done": b["done"], "human": b["human"], "ok": b["ok"] if res else false, "t": b["t"] if res else 0.0, "pick": b["pick"] if res else -1})
		m = {"kind": mini["kind"], "q": mini["q"], "code": mini.get("code", []), "opts": mini["opts"], "right": mini["right"] if res else -1, "t": mini["t"], "limit": mini["limit"], "result": mini.get("result", []), "bots": bs}
	return {"seq": net_seq, "state": state, "players": ps, "own": own, "cur": cur, "round": round_n, "rounds": rounds, "phase": phase, "dice": dice,
		"crystal": crystal_at, "log": log_lines, "double": use_double, "dlg": d, "mini": m, "placings": placings, "ev": round_ev, "evg": ev_group}

func _apply(sn: Dictionary) -> void:
	wait_snap = false
	var ps: Array = sn.get("players", [])
	for k in mini(4, ps.size()):
		var src: Dictionary = ps[k]
		var pl: Dictionary = players[k]
		if int(src["pos"]) != int(pl["pos"]):
			pl["hop"] = 1.0
			sfx.emit("step")
		pl["pos"] = int(src["pos"])
		pl["bytes"] = int(src["bytes"])
		pl["crystals"] = int(src["crystals"])
		pl["items"] = src["items"]
		pl["skip"] = bool(src["skip"])
		pl["bot"] = bool(src["bot"])
		pl["name"] = str(src["name"]).replace(" (ты)", "") + (" (ты)" if k == my else "")
	var own: Array = sn.get("own", [])
	for i in mini(own.size(), spaces.size()):
		spaces[i]["owner"] = int(own[i][0])
		spaces[i]["up"] = int(own[i][1])
	cur = int(sn.get("cur", 0))
	round_n = int(sn.get("round", 1))
	rounds = int(sn.get("rounds", rounds))
	var was := phase
	phase = str(sn.get("phase", "wait"))
	var dc: Array = sn.get("dice", [1, 0])
	dice = [int(dc[0]), int(dc[1])]
	crystal_at = int(sn.get("crystal", crystal_at))
	log_lines = sn.get("log", [])
	use_double = bool(sn.get("double", false))
	round_ev = str(sn.get("ev", ""))
	ev_group = int(sn.get("evg", -1))
	dlg = sn.get("dlg", {})
	mini = sn.get("mini", {})
	if not mini.is_empty():
		if phase == "mini" and was != "mini" and my_pick_round != round_n:
			my_pick = -1
		var bm: Dictionary = mini["bots"][my]
		mini["pick"] = int(bm["pick"]) if phase == "mini_res" else (my_pick if my_pick_round == round_n else -1)
	else:
		my_pick = -1
	if phase == "mini_res" and was == "mini":
		sfx.emit("win" if mini.get("result", []).size() and str(mini["result"][0]).begins_with(players[my]["name"]) else "deliver")
	score = players[my]["bytes"]
	var pl_arr: Array = sn.get("placings", [])
	placings = []
	for x in pl_arr:
		placings.append(int(x))
	if str(sn.get("state", "")) == "over" and state == "play" and placings.size() == 4:
		stage_won()

func _continue() -> void:
	if net != "":
		return
	super()

func _input(event: InputEvent) -> void:
	# В сетевой партии этап один: стрелки не перезапускают поле.
	if net != "" and state != "play" and event is InputEventKey and event.physical_keycode != KEY_ESCAPE:
		get_viewport().set_input_as_handled()
		return
	super(event)

func debug() -> Dictionary:
	var ps := []
	for pl in players:
		ps.append({"pos": pl["pos"], "bytes": pl["bytes"], "crystals": pl["crystals"], "items": pl["items"], "skip": pl["skip"]})
	return {"phase": phase, "cur": cur, "round": round_n, "rounds": rounds, "players": ps, "crystal": crystal_at,
		"dialog": {"head": dlg.get("head", ""), "opts": dlg.get("opts", []).size(), "right": dlg.get("right", -1), "bot": dlg.get("bot", false), "mine": _my_dlg()}, "myroll": _my_roll(), "names": players.map(func(x): return x["name"]), "bytes": players.map(func(x): return x["bytes"]),
		"mini": {"kind": mini.get("kind", ""), "right": mini.get("right", -1), "pick": mini.get("pick", -1)}, "event": round_ev, "auction": not auc.is_empty(), "place": placings.find(my) + 1, "net": net, "my": my, "seq": seen_seq if net == "guest" else net_seq}

# ---------- рисование ----------

func _center(i: int) -> Vector2:
	return spaces[i]["rect"].get_center()

func _tex(n: String) -> Texture2D:
	return kp.get(n)

func draw_game() -> void:
	backdrop(Color("101634"), Color("0a0d1e"))
	var inner := Rect2(X0 + CW, Y0 + CW, BW - 2 * CW, BH - 2 * CW)
	var art := _tex("kp_board%d" % stage)
	if art:
		var ts := art.get_size()
		var sc := maxf(inner.size.x / ts.x, inner.size.y / ts.y)
		var src := Rect2((ts - inner.size / sc) / 2.0, inner.size / sc)
		draw_texture_rect_region(art, inner, src, Color(1, 1, 1, 0.92))
	else:
		rr(inner, Color("1b2550"), 12)
	draw_rect(inner, Color(0.03, 0.05, 0.12, 0.25))
	rr(Rect2(X0 - 8, Y0 - 8, BW + 16, BH + 16), Color(0, 0, 0, 0), 20, Color("ffd34d"), 3)
	for i in N:
		_draw_space(i)
	# кристалл знаний
	var cp := _center(crystal_at) + Vector2(0, -6 + sin(time * 3.0) * 5.0)
	var ct := _tex("kp_icon6")
	if ct:
		draw_texture_rect(ct, Rect2(cp - Vector2(30, 30), Vector2(60, 60)), false)
	for k in 4:
		_draw_token(k)
	_draw_center(inner)
	_draw_panel()
	if phase == "dialog" or (phase == "wait" and dlg.get("feedback", false)):
		_draw_dialog()
	if phase == "mini" or phase == "mini_res":
		_draw_mini()
	if net == "guest" and state == "play" and (snap_age > 8.0 or seen_seq < 0):
		rr(Rect2(330, 640, 620, 50), Color(0.35, 0.12, 0.14, 0.95), 14, Color("ff7a7a"), 2)
		text("Ждём связи с создателем лобби…" if seen_seq < 0 else "Создатель лобби не отвечает — подождите или выйдите (Esc).", Vector2(640, 665), 17, INK)
	elif net != "" and net_err != "":
		text("Связь: " + net_err, Vector2(640, 700), 14, Color("ff9a9a"), false)

func draw_lights(ci: CanvasItem) -> void:
	glow(ci, _center(crystal_at), 150.0 + sin(time * 3.0) * 20.0, Color(0.75, 0.45, 1.0, 0.55))
	if _my_roll():
		glow(ci, Vector2(440, 498), 260.0, Color(0.37, 0.88, 0.71, 0.25 + 0.15 * sin(time * 4.0)))

func _draw_space(i: int) -> void:
	var sp: Dictionary = spaces[i]
	var r: Rect2 = sp["rect"].grow(-3)
	var t: String = sp["type"]
	var base := Color("1c2547")
	if t == "lot":
		base = Color("223060")
	elif t == "quiz":
		base = Color("1f3a6e")
	elif t == "chance":
		base = Color("4a2448")
	elif t in ["start", "shop", "portal", "jail"]:
		base = Color("33295a")
	rr(r, Color(base.r, base.g, base.b, 0.94), 10, Color(1, 1, 1, 0.12), 2)
	if t == "lot":
		var g: Dictionary = GROUPS[sp["group"]]
		rr(Rect2(r.position, Vector2(r.size.x, 14)), g["color"], 8)
		var bt := _tex("kp_build%d" % int(sp["group"]))
		var isz := minf(r.size.x, r.size.y) * 0.56
		if bt:
			draw_texture_rect(bt, Rect2(r.get_center() - Vector2(isz, isz) / 2.0 + Vector2(0, 2), Vector2(isz, isz)), false)
		draw_string(font, Vector2(r.position.x, r.end.y - 8), "%d" % sp["price"], HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 13, Color(1, 1, 1, 0.75))
		if int(sp["owner"]) >= 0:
			var oc: Color = COLORS[int(sp["owner"])]
			draw_circle(r.position + Vector2(r.size.x - 12, 26), 9, Color("0b0f1c"))
			draw_circle(r.position + Vector2(r.size.x - 12, 26), 7, oc)
			if int(sp["up"]) > 0:
				draw_string(font_b, r.position + Vector2(4, 32), "★", HORIZONTAL_ALIGNMENT_LEFT, 20, 16, GOLD)
	else:
		var ic := _tex("kp_icon%d" % ICON.get(t, 0))
		var isz2 := minf(r.size.x, r.size.y) * 0.66
		if ic:
			draw_texture_rect(ic, Rect2(r.get_center() - Vector2(isz2, isz2) / 2.0, Vector2(isz2, isz2)), false)
		var cap: String = {"start": "СТАРТ", "shop": "МАГАЗИН", "portal": "ПОРТАЛ", "jail": "КАРАНТИН", "quiz": "", "chance": ""}.get(t, "")
		if cap != "":
			draw_string(font_b, Vector2(r.position.x, r.end.y - 6), cap, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 11, GOLD)

func _draw_token(k: int) -> void:
	var pl: Dictionary = players[k]
	var c := _center(int(pl["pos"])) + Vector2((k % 2) * 22 - 11, (k / 2) * 18 - 4)
	var h: float = float(pl["hop"])
	c.y -= sin(h * PI) * 18.0
	var tt := _tex("kp_token%d" % k)
	var sz := 44.0 if k == cur else 36.0
	draw_circle(_center(int(pl["pos"])) + Vector2((k % 2) * 22 - 11, (k / 2) * 18 + 14), 10, Color(0, 0, 0, 0.3))
	if tt:
		draw_texture_rect(tt, Rect2(c - Vector2(sz / 2.0, sz * 0.75), Vector2(sz, sz)), false)
	else:
		draw_circle(c, 12, pl["color"])

func _draw_center(inner: Rect2) -> void:
	var box_r := Rect2(inner.position + Vector2(40, 40), Vector2(inner.size.x - 80, 120))
	rr(box_r, Color(0.06, 0.08, 0.18, 0.86), 16, Color(1, 1, 1, 0.12), 2)
	text("%s · ход: %s" % [BOARDS[stage - 1], p()["name"]], box_r.position + Vector2(box_r.size.x / 2.0, 26), 20, p()["color"])
	for i in log_lines.size():
		text(log_lines[i], box_r.position + Vector2(box_r.size.x / 2.0, 58 + i * 20), 15 if i == 0 else 13, INK if i == 0 else MUTED, false)
	# кубики
	var dpos := Vector2(inner.get_center().x - (40 if dice[1] > 0 else 0), inner.position.y + 230)
	for d in (2 if dice[1] > 0 else 1):
		var v: int = dice[d]
		if phase == "rolling":
			v = rng.randi_range(1, 6)
		_draw_die(dpos + Vector2(d * 84, 0), v, phase == "rolling")
	if _my_roll():
		var k := 0.75 + 0.25 * sin(time * 4.0)
		rr(Rect2(330, 470, 220, 56), Color(0.12, 0.55, 0.42, k), 14, Color("5fe0b5"), 2)
		text("Бросить кубик · Пробел", Vector2(440, 498), 20, Color.WHITE)
		if use_double:
			text("двойной кубик включён", Vector2(440, 540), 14, GOLD, false)

func _draw_die(c: Vector2, v: int, spin: bool) -> void:
	var r := Rect2(c - Vector2(34, 34), Vector2(68, 68))
	var a := sin(time * 30.0) * 0.15 if spin else 0.0
	draw_set_transform(c, a, Vector2.ONE)
	rr(Rect2(Vector2(-34, -34), Vector2(68, 68)), Color("f4f1ea"), 14, Color("0b0f1c"), 3)
	var pips := {1: [Vector2(0, 0)], 2: [Vector2(-1, -1), Vector2(1, 1)], 3: [Vector2(-1, -1), Vector2(0, 0), Vector2(1, 1)], 4: [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)],
		5: [Vector2(-1, -1), Vector2(1, -1), Vector2(0, 0), Vector2(-1, 1), Vector2(1, 1)], 6: [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 0), Vector2(1, 0), Vector2(-1, 1), Vector2(1, 1)]}
	for q in pips.get(v, []):
		draw_circle(q * 17.0, 6.5, Color("1b2333"))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _draw_panel() -> void:
	var x := 905.0
	text("ИГРОКИ", Vector2(x + 180, 92), 16, MUTED)
	var order := [0, 1, 2, 3]
	for k in 4:
		var pl: Dictionary = players[k]
		var r := Rect2(x, 108 + k * 112, 360, 102)
		rr(r, Color(0.09, 0.12, 0.25, 0.94), 16, pl["color"] if k == cur else Color(1, 1, 1, 0.1), 3 if k == cur else 2)
		var tt := _tex("kp_token%d" % k)
		if tt:
			draw_texture_rect(tt, Rect2(r.position + Vector2(10, 14), Vector2(70, 70)), false)
		draw_string(font_b, r.position + Vector2(92, 34), pl["name"], HORIZONTAL_ALIGNMENT_LEFT, 170, 20, pl["color"])
		var gem := _tex("kp_icon6")
		if gem:
			draw_texture_rect(gem, Rect2(r.position + Vector2(90, 42), Vector2(30, 30)), false)
		draw_string(font_b, r.position + Vector2(124, 66), "%d" % pl["crystals"], HORIZONTAL_ALIGNMENT_LEFT, 40, 24, Color("c08bff"))
		var coin := _tex("kp_icon7")
		if coin:
			draw_texture_rect(coin, Rect2(r.position + Vector2(170, 44), Vector2(28, 28)), false)
		draw_string(font_b, r.position + Vector2(202, 66), "%d" % pl["bytes"], HORIZONTAL_ALIGNMENT_LEFT, 70, 22, GOLD)
		var owned := 0
		for s in spaces:
			if s["type"] == "lot" and int(s["owner"]) == k:
				owned += 1
		draw_string(font, r.position + Vector2(92, 90), "участков: %d%s" % [owned, "  · пропуск хода" if pl["skip"] else ""], HORIZONTAL_ALIGNMENT_LEFT, 200, 13, MUTED)
		for j in pl["items"].size():
			var it := _tex("kp_item%d" % ["dice2", "firewall", "antivirus", "link"].find(pl["items"][j]))
			if it:
				draw_texture_rect(it, Rect2(r.position + Vector2(270 + (j % 3) * 28, 18), Vector2(26, 26)), false)
	text("Кристалл — %d байтов · Старт +%d" % [_crystal_price(), PASS_START], Vector2(x + 180, 572), 14, MUTED, false)
	if p()["items"].size() and _my_roll():
		text("D — двойной кубик · L — ссылка к кристаллу", Vector2(x + 180, 596), 14, Color("7df9ff"), false)
	if round_ev != "":
		# Событие раунда видно всё время, пока действует.
		rr(Rect2(x, 612, 360, 68), Color(0.2, 0.1, 0.32, 0.94), 14, Color("c08bff"), 2)
		text("СОБЫТИЕ: " + KP.event_name(round_ev).to_upper(), Vector2(x + 180, 634), 15, Color("c08bff"))
		text(_event_text(true), Vector2(x + 180, 660), 14, INK, false)

func _opt_rect(i: int, _n: int) -> Rect2:
	return opt_rects[i] if i < opt_rects.size() else Rect2()

func _draw_dialog() -> void:
	draw_rect(Rect2(X0, Y0, BW, BH), Color(0.02, 0.03, 0.08, 0.55))
	var n: int = dlg.get("opts", []).size()
	# Сначала раскладываем текст, затем варианты под ним — окно растёт под содержимое.
	var lines: Array = []
	var src: PackedStringArray = str(dlg.get("body", "")).split("\n")
	for k in src.size():
		for w in _wrap(src[k], 58):
			lines.append([w, k == src.size() - 1 and src.size() > 1])
	var hgt := 96.0 + lines.size() * 26.0 + n * 52.0 + (40.0 if not _my_dlg() and not dlg.get("feedback", false) else 16.0)
	var top := clampf(Y0 + (BH - hgt) / 2.0, Y0 + 6, 700.0 - hgt)
	var r := Rect2(130, top, 660, hgt)
	rr(r, Color("16203a"), 22, GOLD if not dlg.get("feedback", false) else (Color("5fe0b5") if dlg.get("ok", false) else Color("ff7a7a")), 3)
	text(str(dlg.get("head", "")), Vector2(460, top + 38), 26, INK)
	var y := top + 80.0
	for ln in lines:
		text(ln[0], Vector2(460, y), 17 if not ln[1] else 19, INK if (ln[1] or lines.size() == 1) else MUTED, ln[1])
		y += 26.0
	opt_rects = []
	for i in n:
		var orr := Rect2(160, y + 4 + i * 52, 600, 44)
		opt_rects.append(orr)
		var hot: bool = dlg.get("bot", false) and i == int(dlg.get("bot_pick", -1)) and float(dlg.get("t", 1.0)) < 0.5
		rr(orr, Color("27365f") if not hot else Color("3a4f8a"), 12, Color(1, 1, 1, 0.2), 2)
		draw_string(font_b, orr.position + Vector2(18, 29), "%d" % (i + 1), HORIZONTAL_ALIGNMENT_LEFT, 30, 18, GOLD)
		draw_string(font, orr.position + Vector2(50, 29), str(dlg["opts"][i]), HORIZONTAL_ALIGNMENT_LEFT, orr.size.x - 60, 17, INK)
	if not _my_dlg() and not dlg.get("feedback", false):
		text("%s думает…" % players[int(dlg.get("who", cur))]["name"], Vector2(460, r.end.y - 20), 15, MUTED, false)

func _wrap(s: String, width: int) -> Array:
	var out := []
	var line := ""
	for w in s.split(" "):
		if line.length() + w.length() + 1 > width and line != "":
			out.append(line)
			line = w
		else:
			line = w if line == "" else line + " " + w
	if line != "":
		out.append(line)
	return out

func _mini_rect(i: int) -> Rect2:
	return Rect2(250 + (i % 2) * 400, 380 + (i / 2) * 92, 380, 76)

func _draw_mini() -> void:
	draw_rect(Rect2(0, 60, W, H - 60), Color(0.02, 0.03, 0.09, 0.82))
	var r := Rect2(200, 110, 880, 560)
	rr(r, Color("16203a"), 26, Color("7df9ff"), 3)
	text("МИНИ-ИГРА · РАУНД %d" % round_n, Vector2(640, 150), 18, Color("7df9ff"))
	var code: Array = mini.get("code", [])
	var y := 200.0 if code.is_empty() else 184.0
	for w in _wrap(str(mini["q"]), 56):
		text(w, Vector2(640, y), 24, INK)
		y += 32.0
	if code.size():
		# Программа — слева, с отступами, как в редакторе.
		var cr := Rect2(420, y - 14, 440, code.size() * 24 + 12)
		rr(cr, Color("0b1020"), 10, Color(1, 1, 1, 0.16), 1)
		for i in code.size():
			var ln := str(code[i])
			var body := ln.lstrip(" ")
			draw_string(font, Vector2(cr.position.x + 18 + (ln.length() - body.length()) * 7, cr.position.y + 24 + i * 24), body, HORIZONTAL_ALIGNMENT_LEFT, cr.size.x - 30, 19, Color("b8f7c8"))
	var left := maxf(0.0, float(mini["limit"]) - float(mini["t"]))
	rr(Rect2(300, 320, 680, 16), Color("0d1226"), 8)
	rr(Rect2(300, 320, 680 * left / float(mini["limit"]), 16), Color("ffd34d") if left > 3.0 else Color("ff7a7a"), 8)
	for i in mini["opts"].size():
		var orr := _mini_rect(i)
		var col := Color("27365f")
		if int(mini["pick"]) == i:
			col = Color("3a4f8a") if int(mini["right"]) < 0 else (Color("1f7a5a") if i == int(mini["right"]) else Color("8a2a3a"))
		if phase == "mini_res" and i == int(mini["right"]):
			col = Color("1f7a5a")
		rr(orr, col, 16, Color(1, 1, 1, 0.22), 2)
		text("%d" % (i + 1), orr.position + Vector2(30, 38), 22, GOLD)
		var o := str(mini["opts"][i])
		text(o, orr.get_center() + Vector2(10, 0), 26 if o.length() <= 15 else (21 if o.length() <= 20 else 18), INK)
	var others := [0, 1, 2, 3]
	others.erase(my)
	for j in 3:
		var k: int = others[j]
		var b: Dictionary = mini["bots"][k]
		var bx := 330.0 + j * 220.0
		var tt := _tex("kp_token%d" % k)
		if tt:
			draw_texture_rect(tt, Rect2(Vector2(bx - 20, 572), Vector2(40, 40)), false)
		text(("готов!" if b["done"] else "думает…") if phase == "mini" else ("верно" if b["ok"] and float(b["t"]) <= float(mini["limit"]) else "мимо"), Vector2(bx + 50, 594), 15, MUTED, false)
	if phase == "mini_res":
		text("Награда: " + (", ".join(mini.get("result", [])) if mini.get("result", []).size() else "никто не успел"), Vector2(640, 640), 20, GOLD)
	else:
		text("Быстрее всех и верно — +%s. Клавиши 1–4 или щелчок." % _bt(_reward(6)), Vector2(640, 640), 16, MUTED, false)

func _overlay() -> void:
	if state == "over" and won and placings.size() == 4:
		draw_rect(Rect2(0, 0, W, H), Color(0.03, 0.05, 0.12, 0.78))
		var r := Rect2(240, 100, 800, 520)
		rr(r, Color("16203a"), 26, GOLD, 3)
		var place := placings.find(my) + 1
		text(["ПОБЕДА!", "ВТОРОЕ МЕСТО", "ТРЕТЬЕ МЕСТО", "ЧЕТВЁРТОЕ МЕСТО"][place - 1], Vector2(640, 150), 40, INK)
		var st := stage_stars()
		for i in 3:
			text("★", Vector2(550 + i * 90, 232), 70, GOLD if i < st else Color(1, 1, 1, 0.16), false)
		for k in 4:
			var pl: Dictionary = players[placings[k]]
			var y := 320.0 + k * 52.0
			rr(Rect2(330, y - 22, 620, 44), Color(0.1, 0.14, 0.28, 0.9), 12, pl["color"] if placings[k] == my else Color(1, 1, 1, 0.1), 2)
			var tt := _tex("kp_token%d" % placings[k])
			if tt:
				draw_texture_rect(tt, Rect2(Vector2(344, y - 20), Vector2(40, 40)), false)
			draw_string(font_b, Vector2(400, y + 7), "%d. %s" % [k + 1, pl["name"]], HORIZONTAL_ALIGNMENT_LEFT, 260, 20, pl["color"])
			draw_string(font_b, Vector2(640, y + 7), "кристаллов %d · байтов %d" % [pl["crystals"], pl["bytes"]], HORIZONTAL_ALIGNMENT_RIGHT, 296, 20, INK)
		var k2 := 0.75 + 0.25 * sin(time * 4.0)
		text("ESC — К ИГРАМ" if net != "" else ("ПРОБЕЛ — ПОЛЕ «%s»" % BOARDS[stage]) if stage < stages else "ПРОБЕЛ — СЫГРАТЬ ЕЩЁ   ·   ESC — К ИГРАМ", Vector2(640, 568), 24, Color(0.37, 0.88, 0.71, k2))
		return
	super._overlay()
