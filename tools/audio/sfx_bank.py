"""Sinh kho SFX → assets/sfx/<tên>.wav (48 kHz stereo). Chạy: uv run tools/audio/sfx_bank.py
Tên SFX dùng trong episode.json (trường sfx) và luật SFX tự động ở tools/timing.mjs. Xem docs/sfx.md."""
import os, sys
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(__file__))
from dsp import SR, t_, env, noise, lp, hp, bp, sweep, tone, norm, reverb, stereo, adsr

OUT = os.path.join(os.path.dirname(__file__), '../../assets/sfx')


def whoosh(d=0.45, lo=300, hi=3500, up=True):
    n = noise(d); L = len(n); out = np.zeros(L); W = 1024
    for i in range(0, L, W // 2):
        u = i / L; u = u if up else 1 - u
        f = lo * (hi / lo) ** u
        seg = bp(n[i:i + W], f * 0.7, min(f * 1.4, 20000))
        out[i:i + len(seg)] += seg * np.hanning(len(seg))
    shape = np.sin(np.pi * t_(d) / d) ** 2
    return norm(lp(out * shape, 9000))


def pop(f=700, d=0.12):
    t = t_(d); fr = f * (1 + 0.8 * np.exp(-t / 0.008))
    return norm(np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(d, 0.001, 0.03))


def make():
    S = {}
    S['whoosh'] = whoosh(0.42, 280, 3200, True) * 0.9
    S['whoosh-soft'] = lp(whoosh(0.55, 200, 1800, True), 3000)
    S['swoosh-up'] = whoosh(0.5, 400, 6000, True)
    S['pop'] = pop(620)
    S['pop-high'] = pop(980, 0.1)
    S['pop-soft'] = lp(pop(420, 0.16), 2500)
    S['tick'] = norm(bp(noise(0.03), 1800, 4500) * env(0.03, 0.0005, 0.004) + tone(2600, 0.03, 0.006) * 0.4)
    S['click'] = norm(bp(noise(0.02), 2500, 7000) * env(0.02, 0.0002, 0.003))
    # tin nhắn đến: hai nốt tròn đi lên
    b = np.zeros(int(0.32 * SR)); a1 = tone(880, 0.16, 0.05, harm=((1, 1), (2, 0.25))); a2 = tone(1320, 0.18, 0.07, harm=((1, 1), (2, 0.2)))
    b[:len(a1)] += a1; b[int(0.09 * SR):int(0.09 * SR) + len(a2)] += a2
    S['bubble'] = norm(b)
    S['send'] = norm(whoosh(0.18, 900, 5000, True) * 0.6 + np.pad(pop(1100, 0.08), (int(0.1 * SR), 0))[:int(0.18 * SR)])
    S['notify'] = norm(tone(1568, 0.5, 0.18, harm=((1, 1), (2.01, 0.3), (3, 0.1))) + np.pad(tone(2093, 0.45, 0.16), (int(0.12 * SR), 0))[:int(0.5 * SR)])
    S['ding'] = norm(tone(1760, 1.2, 0.35, harm=((1, 1), (2.76, 0.25), (5.4, 0.08))))
    chime = np.zeros(int(1.6 * SR))
    for k, f in enumerate([1047, 1319, 1568, 2093]):
        x = tone(f, 1.2, 0.4, harm=((1, 1), (3, 0.12))); s = int(k * 0.09 * SR); chime[s:s + len(x)] += x * (0.9 - k * 0.1)
    S['chime'] = norm(chime)
    S['impact'] = norm(sweep(110, 38, 0.7) * env(0.7, 0.002, 0.18) + lp(noise(0.7), 600) * env(0.7, 0.001, 0.05) * 0.7)
    S['boom'] = norm(sweep(70, 28, 1.6) * env(1.6, 0.003, 0.5) + lp(noise(1.6), 300) * env(1.6, 0.002, 0.2) * 0.5)
    r = whoosh(1.4, 200, 5000, True) * np.linspace(0.1, 1, int(1.4 * SR)) ** 2
    S['riser'] = norm(r + sweep(200, 800, 1.4) * np.linspace(0, 0.25, int(1.4 * SR)))
    # chuông điện thoại: rung kép 2 tần số
    d = 1.6; t = t_(d); trem = (np.sin(2 * np.pi * 20 * t) > 0).astype(float)
    gate = ((t % 0.8) < 0.38).astype(float) * (t < 1.2)
    S['ring'] = norm(lp((np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 480 * t)) * trem * gate, 3500) * adsr(len(t), 0.005, 0.05, 0.8, 0.2))
    # báo động ngắn (cảnh báo lừa đảo)
    d = 1.0; t = t_(d); f = 880 + 220 * np.sign(np.sin(2 * np.pi * 3 * t))
    S['alarm'] = norm(lp(np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5, 2500) * adsr(len(t), 0.01, 0.1, 0.7, 0.25))
    # lỗi / sai
    d = 0.45; t = t_(d)
    S['error'] = norm(lp((np.sin(2 * np.pi * 150 * t) + np.sin(2 * np.pi * 158 * t)) * (np.sin(2 * np.pi * 75 * t) > 0), 900) * env(d, 0.005, 0.2))
    S['success'] = norm(np.concatenate([tone(988, 0.12, 0.05), tone(1319, 0.5, 0.2, harm=((1, 1), (2, 0.2)))]))
    S['glitch'] = norm(np.concatenate([bp(noise(0.03), 300 + 900 * k, 1200 + 2200 * k) * (k % 2 + 0.3) for k in range(6)]) * 0.9)
    # gõ phím: chuỗi click ngẫu nhiên 1.2 s
    ty = np.zeros(int(1.2 * SR)); rr = np.random.default_rng(3); pos = 0
    while pos < len(ty) - 3000:
        c = bp(noise(0.025), 1500 + rr.random() * 2500, 6000) * env(0.025, 0.0003, 0.004) * (0.5 + rr.random() * 0.5)
        ty[pos:pos + len(c)] += c; pos += int((0.06 + rr.random() * 0.09) * SR)
    S['typing'] = norm(ty)
    S['cash'] = norm(np.concatenate([tone(2637, 0.08, 0.03), tone(3520, 0.6, 0.2, harm=((1, 1), (2.4, 0.3)))]) + 0.0)
    # bút vẽ (cho cảnh figure)
    d = 1.2; sc = bp(noise(d), 2500, 8000) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 3.3 * t_(d)))) * adsr(int(d * SR), 0.05, 0.1, 0.8, 0.3)
    S['draw'] = norm(sc) * 0.7
    S['camera'] = norm(np.concatenate([bp(noise(0.04), 1000, 6000) * env(0.04, 0.0005, 0.01), np.zeros(int(0.06 * SR)), bp(noise(0.06), 800, 5000) * env(0.06, 0.0005, 0.02)]))
    return S


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    S = make()
    for k, x in S.items():
        y = reverb(x * 0.9, size=0.5, mix=0.12) if k not in ('tick', 'click', 'typing') else np.stack([x, x], 1)
        y = y / max(1e-9, np.max(np.abs(y))) * 0.89
        sf.write(os.path.join(OUT, f'{k}.wav'), y.astype(np.float32), SR)
    print(f'sfx: {len(S)} âm → assets/sfx ({", ".join(S)})')
