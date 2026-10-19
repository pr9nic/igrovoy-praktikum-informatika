extends RefCounted
# Запись чисел и объёмов информации для аркад.

const SUP := ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"]

static func bin(v: int) -> String:
	if v == 0:
		return "0"
	var s := ""
	while v > 0:
		s = str(v % 2) + s
		v /= 2
	return s

static func hex(v: int) -> String:
	return "%X" % v

static func oct(v: int) -> String:
	return "%o" % v

static func sup(n: int) -> String:
	var s := ""
	for ch in str(n):
		s += SUP[int(ch)]
	return s

static func plural(n: int, one: String, few: String, many: String) -> String:
	var a := n % 100
	var b := n % 10
	if a >= 11 and a <= 14:
		return many
	if b == 1:
		return one
	if b >= 2 and b <= 4:
		return few
	return many

static func bits(n: int) -> String:
	return "%d %s" % [n, plural(n, "бит", "бита", "бит")]

static func bytes(n: int) -> String:
	return "%d %s" % [n, plural(n, "байт", "байта", "байт")]
