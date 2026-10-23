#!/bin/bash
# Догенерировать все недостающие картинки (обложки list.txt и мемы memes.txt) через Gemini.
cd "$(dirname "$0")"
S="vibrant modern educational illustration for a school informatics quiz cover, clean composition, rich colors, soft lighting, no text, no letters, no numbers, no logos, 16:9"
M="funny cartoon illustration in the style of an internet meme picture, expressive characters, bright colors, no text, no letters, no captions, no logos, square"
{ while IFS='|' read -r n d; do printf '%s\0%s\0' "$n" "$S: $d"; done < list.txt
  while IFS='|' read -r n d; do printf '%s\0%s\0' "$n" "$M: $d"; done < memes.txt; } | xargs -0 -n2 -P4 ./cgen.sh
