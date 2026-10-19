#!/bin/bash
# Генерация одной картинки через agy (Antigravity, Gemini): gen.sh имя "описание"
cd "$(dirname "$0")"; name="$1"; [ -s "$name.png" ] && exit 0
timeout 300 agy --mode accept-edits --print-timeout 280s -p="Use your image generation tool to create exactly one image and save it as $name.png in the directory $(pwd). The image: $2. Do not create any other files." > "log_$name.txt" 2>&1
[ -s "$name.png" ] && echo "ok $name" || echo "FAIL $name"
