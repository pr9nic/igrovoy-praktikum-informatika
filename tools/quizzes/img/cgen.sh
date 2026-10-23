#!/bin/bash
# Одна картинка через Codex: cgen.sh NAME "PROMPT". Готовые файлы пропускаются.
name="$1"; prompt="$2"; cd "$(dirname "$0")"
[ -f "$name.png" ] && { echo "skip $name"; exit 0; }
for try in 1 2; do
  rm -rf "cw_$name"; mkdir "cw_$name"; cd "cw_$name"
  timeout 900 codex exec --skip-git-repo-check -s workspace-write "Use your built-in image generation tool to create this image: $prompt. Save it in the current directory as $name.png. Do not write any other files." > ../clog_$name.txt 2>&1
  f=$(ls -t *.png 2>/dev/null | head -1); [ -n "$f" ] && mv "$f" "../$name.png"; cd ..; rm -rf "cw_$name"
  [ -f "$name.png" ] && { echo "ok $name"; exit 0; }
done
echo "FAIL $name"
