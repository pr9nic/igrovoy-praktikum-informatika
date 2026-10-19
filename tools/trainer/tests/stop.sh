#!/bin/bash
cd "$(dirname "$0")"; for f in .tmp/stand.pid .tmp/chrome.pid; do [ -f $f ] && kill $(cat $f) 2>/dev/null; rm -f $f; done; rm -rf /tmp/school4-trainer-test-* 2>/dev/null; true
