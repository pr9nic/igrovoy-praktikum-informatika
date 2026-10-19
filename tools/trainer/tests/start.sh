#!/bin/bash
# Запускает стенд (порт 18720) и тестовый Chromium (отладка 9333). Остановка: stop.sh
cd "$(dirname "$0")"; ./stop.sh 2>/dev/null; mkdir -p .tmp; sleep 1; rm -rf .tmp/profile 2>/dev/null
nohup python stand.py > .tmp/stand.log 2>&1 & echo $! > .tmp/stand.pid
nohup /usr/lib/chromium/chromium --headless=new --no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --disable-extensions --remote-debugging-port=9333 --user-data-dir=$PWD/.tmp/profile --no-proxy-server --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows about:blank > .tmp/chrome.log 2>&1 & echo $! > .tmp/chrome.pid
for i in $(seq 30); do curl -s -o /dev/null --noproxy '*' http://127.0.0.1:18720/results/api/context && break; sleep 1; done
