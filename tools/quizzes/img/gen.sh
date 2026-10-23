#!/bin/bash
# Картинка через Gemini (Antigravity CLI): gen.sh имя "описание"
cd "$(dirname "$0")"; name="$1"; [ -s "$name.png" ] && exit 0
for try in 1 2 3; do
  mkdir -p "work_$name" && cd "work_$name"
  timeout 1000 agy --dangerously-skip-permissions --print-timeout 900s -p "Use your image generation tool to create exactly ONE image and save it as $name.png in the current directory. Do not create any other files. Image description: $2" > ../log_$name.txt 2>&1
  # картинка могла дописаться чуть позже ответа — ждём до минуты
  for w in $(seq 12); do ls *.png >/dev/null 2>&1 && break; sleep 5; done
  f=$(ls -t *.png 2>/dev/null | head -1); [ -n "$f" ] && mv "$f" "../$name.png"; cd ..; rm -rf "work_$name"
  [ -s "$name.png" ] && break; sleep 10
done
[ -s "$name.png" ] && echo "ok $name" || echo "FAIL $name"
