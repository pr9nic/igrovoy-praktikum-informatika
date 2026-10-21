#!/usr/bin/env bash
# Все проверки игр одним запуском: логика без браузера, серверные модули, затем браузерные тесты на изолированном стенде.
# Живой журнал не трогается. Запуск: bash tools/run_all_tests.sh   (браузерная часть — около часа; только логика: bash tools/run_all_tests.sh quick)
cd "$(dirname "$0")/.." || exit 1
pass=0; fail=0; report=()
run() { local name=$1; shift; if out=$("$@" 2>&1 | tail -12); then if grep -q "ALL OK" <<<"$out"; then pass=$((pass+1)); report+=("✅ $name"); return; fi; fi; fail=$((fail+1)); report+=("❌ $name: $(tail -1 <<<"$out")"); }
run "Лаборатория (логика)" node tools/lab/tests/lab.test.js
run "Машина Тьюринга" node tools/lab/tests/turing.test.js
run "Сортировочная горка" node tools/lab/tests/sortyard.test.js
run "Шифровальня" node tools/lab/tests/cipher.test.js
run "Архиватор" node tools/lab/tests/archiver.test.js
run "Карта дорог" node tools/lab/tests/graphs.test.js
run "Черепаха" node tools/lab/tests/turtle.test.js
run "Байт-бласт" node tools/lab/tests/blast.test.js
run "Код-раннер" node tools/lab/tests/runner.test.js
run "Бункер" node tools/lab/tests/bunker.test.js
run "Кодоблокс 3D" godot --headless --path godot/workshop --script res://tests/blox.gd
run "Шифровальщик" node tools/lab/tests/codes.test.js
run "Сортировочная станция" node tools/lab/tests/sorting.test.js
run "Герой кода: уровни и решения" node tools/codehero/tests/levels.test.js
run "Практикум: сервер" python3 tools/practicum/tests/practicum_api_test.py
run "Битва класса: логика клиента" node tools/practicum/tests/battle_logic.test.js
run "Битва класса: сервер" python3 tools/battle/tests/battle_test.py
run "Кодополия по сети: сервер" python3 tools/kodopoly/tests/kp_test.py
run "Кодоблокс: сервер класса" python3 tools/kodopoly/tests/blox_test.py
run "Бункер по сети: сервер" python3 tools/kodopoly/tests/bunker_test.py
run "Сбой на станции: правила" python3 tools/crew/tests/rules_test.py
run "Гонка: сервер" python3 tools/lab/tests/race_test.py
run "Тренажёр: рекорды класса" python3 tools/trainer/tests/leaderboard.test.py
run "Тренажёр: сервер" python3 tools/trainer/tests/trainer_api_test.py
run "Тенегрыз: рекорды" python3 tools/typing_escape/tests/typing_api_test.py
run "Издатель и шаблоны" bash -c 'python3 tools/check_templates.py && echo ALL OK'
if command -v godot >/dev/null; then   # Godot без окна: уровни мастерской, генераторы «Клеток памяти», правила аркад
  godot --headless --path godot/workshop --import >/dev/null 2>&1
  for t in solutions cells world cells_sim arcade kodopolia; do run "Godot: $t" timeout 600 godot --headless --path godot/workshop --script res://tests/$t.gd; done
else report+=("⏭ Godot: команды godot нет, проверки Godot пропущены"); fi
if [ "$1" != quick ]; then
  run "Битва класса: интерфейс (заглушка сервера)" timeout 600 node tools/practicum/tests/battle_ui.test.mjs
  for d in game-8-lab game-9-lab game-8-practicum game-6-typing-escape game-8-crew; do python tools/publish.py drafts/$d.json >/dev/null 2>&1; done
  for t in practicum profile battle kp lab oge typing crew board arcade codehero; do bash tools/trainer/tests/start.sh >/dev/null; run "Браузер: $t" timeout 3000 node tools/trainer/tests/$t.test.mjs; done
  bash tools/trainer/tests/stop.sh >/dev/null
fi
printf '%s\n' "${report[@]}"; echo "Итого: $pass прошли, $fail с ошибками"; [ $fail -eq 0 ]
