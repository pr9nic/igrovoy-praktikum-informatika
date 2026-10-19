#!/bin/bash
# Проверяет уровни и собирает веб-версию игры в export/. Нужен Godot 4.7 с веб-шаблонами (см. docs/GAMES.md).
set -e; cd "$(dirname "$0")"; mkdir -p export
godot --headless --path . --import > /dev/null 2>&1 || true
godot --headless --path . --script res://tests/solutions.gd -- dump | tail -n +2
godot --headless --path . --export-release "Web" export/index.html 2>&1 | grep -iE "^(ERROR|SCRIPT ERROR)" && exit 1
# Сайт школы работает по http, а загрузчик Godot требует https («Secure Context»). Движку без потоков https нужен
# только для звуковых ворклетов, поэтому проверку снимаем, а ворклеты пропускаем там, где браузер их не даёт.
python3 - <<'PY'
p='export/index.js';s=open(p).read()
for a,b in [("if (!Features.isSecureContext()) {","if (false) {"),
            ("GodotAudio.audioPositionWorkletPromise=ctx.audioWorklet.addModule(path)","GodotAudio.audioPositionWorkletPromise=ctx.audioWorklet?ctx.audioWorklet.addModule(path):Promise.resolve()"),
            ("this._source.connect(this.getPositionWorklet());if(start)","if(GodotAudio.ctx.audioWorklet){this._source.connect(this.getPositionWorklet())}if(start)")]:
    assert s.count(a)==1,'загрузчик Godot изменился: '+a
    s=s.replace(a,b)
# Сервер не шлёт заголовков кэша, и браузер подолгу показывал старую игру. Заставляем загрузчик каждый раз
# сверять файлы игры с сервером (ответ 304, если не менялись), а сам index.js подключаем с меткой версии.
for a,b in [("fetch(file)","fetch(file,{cache:'no-cache'})"),('fetch(binaryFile,{credentials:"same-origin"})','fetch(binaryFile,{credentials:"same-origin",cache:"no-cache"})'),('fetch(url,{credentials:"same-origin"})','fetch(url,{credentials:"same-origin",cache:"no-cache"})')]:
    assert s.count(a)==1,'загрузчик Godot изменился: '+a
    s=s.replace(a,b)
open(p,'w').write(s)
import hashlib
v=hashlib.sha256(open('export/index.pck','rb').read()+s.encode()).hexdigest()[:10]
h=open('export/index.html').read();assert h.count('<script src="index.js"></script>')==1
open('export/index.html','w').write(h.replace('<script src="index.js"></script>','<script src="index.js?v=%s"></script>'%v))
PY
ls -la export | awk 'NR>3{printf "%8.1f МБ  %s\n",$5/1048576,$9}'
