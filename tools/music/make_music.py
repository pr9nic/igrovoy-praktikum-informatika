"""Фоновая музыка для игр, собранная программой (без чужих записей): короткие зацикленные мелодии в духе 8-битных игр.
Пишет WAV и сжимает в OGG через ffmpeg. Запуск: python tools/music/make_music.py"""
import math, struct, subprocess, wave
from pathlib import Path
HERE = Path(__file__).resolve().parent
RATE = 22050
NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}
def freq(name):        # 'A3' -> частота
    return 440.0 * 2 ** ((NOTE[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)

def render(name, bpm, bars, voices, gain=0.22):
    beat = 60.0 / bpm; total = int(RATE * beat * 4 * bars); buf = [0.0] * total
    for wave_kind, vol, notes in voices:          # notes: список (доля начала, длина в долях, нота)
        for start, length, note in notes:
            if note is None: continue
            f, s0, n = freq(note), int(start * beat * RATE), int(length * beat * RATE)
            for i in range(n):
                t = i / RATE; ph = (f * t) % 1.0
                v = (1.0 if ph < 0.5 else -1.0) * 0.6 if wave_kind == 'square' else (4 * abs(ph - 0.5) - 1) if wave_kind == 'tri' else math.sin(2 * math.pi * f * t)
                env = min(1.0, i / 120) * (1.0 - i / n) ** 0.6           # мягкая атака и затухание
                j = (s0 + i) % total
                buf[j] += v * env * vol
    peak = max(1e-6, max(abs(x) for x in buf))
    data = b''.join(struct.pack('<h', int(max(-1, min(1, x / peak * gain * 3.2)) * 32000)) for x in buf)
    wav = HERE / f'{name}.wav'
    with wave.open(str(wav), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(data)
    out = HERE / f'{name}.ogg'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(wav), '-c:a', 'libvorbis', '-q:a', '3', str(out)], check=True); wav.unlink()
    print(name, out.stat().st_size // 1024, 'КБ')

def seq(pattern, start=0.0, step=0.5, repeat=1):
    out = []; t = start
    for _ in range(repeat):
        for n in pattern: out.append((t, step * 0.95, n)); t += step
    return out

# «Клетки памяти»: тревожный ля минор, 132 удара, бас и арпеджио, 8 тактов.
bass = seq(['A2', 'A2', 'E2', 'A2', 'F2', 'F2', 'C3', 'F2', 'G2', 'G2', 'D3', 'G2', 'E2', 'E2', 'B2', 'E2'], step=1.0, repeat=2)
arp = seq(['A4', 'C5', 'E5', 'C5'] * 4 + ['F4', 'A4', 'C5', 'A4'] * 4 + ['G4', 'B4', 'D5', 'B4'] * 4 + ['E4', 'G#4', 'B4', 'G#4'] * 4, step=0.25)
lead = seq(['E5', None, 'D5', 'C5', 'B4', None, 'C5', 'A4', 'C5', None, 'D5', 'E5', 'B4', None, 'G#4', None], step=1.0, start=16.0)
render('cells', 132, 8, [('tri', 1.0, bass), ('square', 0.35, arp), ('sine', 0.55, lead)])
# «Герой кода»: подземелье, ре минор, 96 ударов, неспешно.
bass2 = seq(['D2', 'D2', 'A2', 'D2', 'A#1', 'A#1', 'F2', 'A#1', 'C2', 'C2', 'G2', 'C2', 'A1', 'A1', 'E2', 'A1'], step=1.0, repeat=2)
arp2 = seq(['D4', 'F4', 'A4', 'F4'] * 4 + ['A#3', 'D4', 'F4', 'D4'] * 4 + ['C4', 'E4', 'G4', 'E4'] * 4 + ['A3', 'C#4', 'E4', 'C#4'] * 4, step=0.5, repeat=1)
render('codehero', 96, 8, [('tri', 1.0, bass2), ('sine', 0.5, arp2), ('square', 0.18, seq(['A4', None, 'F4', None, 'D4', None, 'E4', 'F4'], step=2.0, start=0.0))])
