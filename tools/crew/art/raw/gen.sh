#!/bin/bash
# Генерация одной картинки через Codex: gen.sh имя "описание"
cd "$(dirname "$0")"; name="$1"; [ -s "$name.png" ] && exit 0
timeout 400 codex exec --skip-git-repo-check -s workspace-write "Use your built-in image generation tool to create exactly one image and save it as $name.png in the current directory (keep a transparent background as real PNG alpha if one is requested; do not flatten it). The image: $2. Do not create any other files." > "log_$name.txt" 2>&1
[ -s "$name.png" ] && echo "ok $name" || echo "FAIL $name"
