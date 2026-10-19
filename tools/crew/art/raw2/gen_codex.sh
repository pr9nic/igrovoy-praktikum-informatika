#!/bin/bash
# Запасной путь, когда у agy кончился лимит картинок: gen_codex.sh имя "описание"
cd "$(dirname "$0")"; name="$1"; [ -s "$name.png" ] && exit 0
timeout 400 codex exec --skip-git-repo-check -s workspace-write "Use your built-in image generation tool to create exactly one image and save it as $name.png in the current directory (use a real transparent PNG alpha background instead of any solid background colour mentioned). The image: $2. Do not create any other files." > "log_codex_$name.txt" 2>&1
[ -s "$name.png" ] && echo "ok $name" || echo "FAIL $name"
