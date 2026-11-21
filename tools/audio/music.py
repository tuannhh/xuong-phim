"""Nhạc nền tự sáng tác bằng code theo "mood" → WAV stereo 48 kHz đúng độ dài tập.
Chạy: uv run tools/audio/music.py <mood> <giây> <out.wav> [seed]
Mood: lofi | upbeat | tension | inspire | playful | calm. Nhạc nằm dưới lời đọc nên cố ý đơn giản, ít nốt cao."""
import os, sys
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(__file__))
from dsp import SR, t_, noise, lp, hp, bp, norm, reverb, adsr, place

hz = lambda m: 440 * 2 ** ((m - 69) / 12)

MOODS = {
    #           bpm  gốc   tiến trình (bậc so với gốc, hợp âm)                                   trống       arp
    'lofi':    (78, 57, [(0, 'm9'), (5, 'm7'), (-2, 'M7'), (3, 'M7')], 'lofi', 'slow'),
    'upbeat':  (112, 60, [(0, 'M'), (7, 'M'), (9, 'm'), (5, 'M')], 'four', 'fast'),
    'tension': (92, 50, [(0, 'm'), (0, 'm'), (1, 'M'), (-1, 'dim')], 'pulse', 'none'),
    'inspire': (96, 55, [(0, 'M'), (-3, 'm'), (5, 'M'), (7, 'M')], 'soft', 'fast'),
    'playful': (104, 60, [(0, 'M'), (5, 'M'), (7, 'M'), (5, 'M')], 'bounce', 'pluck'),
    'calm':    (70, 53, [(0, 'M7'), (5, 'M7'), (2, 'm7'), (7, 'sus')], 'none', 'slow'),
}
CH = {'M': [0, 4, 7], 'm': [0, 3, 7], 'M7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'm9': [0, 3, 7, 10, 14], 'dim': [0, 3, 6], 'sus': [0, 5, 7]}


def pad(freqs, d, bright=1800):
    t = t_(d); x = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.12):
            x += np.sin(2 * np.pi * f * (1 + det / 100) * t + np.random.rand() * 6) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return lp(x, bright) * adsr(len(t), min(0.6, d * 0.3), 0.3, 0.8, min(0.8, d * 0.3))


def keys(f, d):  # e-piano mềm
    t = t_(d)
    x = np.sin(2 * np.pi * f * t + 0.8 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.4))
    return x * np.exp(-t / 0.9) * np.minimum(1, t / 0.004)


def pluck(f, d=0.5):
    n = int(d * SR); N = max(2, int(SR / f)); buf = np.random.uniform(-1, 1, N); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % N]; buf[i % N] = 0.5 * (buf[i % N] + buf[(i + 1) % N]) * 0.996
    return lp(out, 4000)


def kick(): t = t_(0.35); return np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.12)
def snare(): return bp(noise(0.2), 900, 6000) * np.exp(-t_(0.2) / 0.05) * 0.6
def hat(o=False): return hp(noise(0.12 if o else 0.04), 7000) * np.exp(-t_(0.12 if o else 0.04) / (0.05 if o else 0.012)) * 0.35


def compose(mood, dur, seed=1):
    bpm, root, prog, drum, arp = MOODS.get(mood, MOODS['lofi'])
    rng = np.random.default_rng(seed); np.random.seed(seed)
    beat = 60 / bpm; bar = beat * 4
    N = int((dur + 2) * SR)
    mus = np.zeros((N, 2)); drums = np.zeros((N, 2))
    nbars = int(np.ceil(dur / bar)) + 1
    for b in range(nbars):
        deg, q = prog[b % len(prog)]
        r = root + deg
        notes = [hz(r + i) for i in CH[q]]
        s0 = int(b * bar * SR)
        p = pad(notes, bar + 0.4, 1400 if mood in ('tension', 'lofi', 'calm') else 2200) * 0.16
        place(mus, np.stack([p, np.roll(p, 240)], 1), s0)
        place(mus, np.sin(2 * np.pi * hz(r - 12) * t_(bar)) * adsr(int(bar * SR), 0.02, 0.2, 0.7, 0.2) * 0.22, s0)  # bass
        if mood == 'lofi' or mood == 'calm':
            for k, f in enumerate(notes[:4]):
                place(mus, keys(f, 1.6) * 0.08, s0 + int(k * 0.03 * SR))
        steps = {'fast': 8, 'slow': 4, 'pluck': 8, 'none': 0}[arp]
        for k in range(steps):
            if arp == 'slow' and rng.random() < 0.3:
                continue
            f = notes[(k * 2 + b) % len(notes)] * (2 if arp != 'slow' else 1)
            x = pluck(f, 0.6) * 0.1 if arp == 'pluck' else keys(f, 0.6) * 0.06
            pan = 0.3 * np.sin(k)
            place(mus, np.stack([x * (1 - pan), x * (1 + pan)], 1), s0 + int(k * bar / steps * SR))
        for k in range(4):
            at = s0 + int(k * beat * SR)
            sw = int(beat * 0.5 * SR) + (int(0.03 * SR) if drum == 'lofi' else 0)
            if drum == 'four':
                place(drums, kick() * 0.5, at); place(drums, hat(True) * 0.5, at + sw)
                if k % 2: place(drums, snare() * 0.5, at)
            elif drum == 'lofi':
                if k in (0, 2) or (k == 3 and b % 2): place(drums, lp(kick(), 2000) * 0.45, at)
                if k in (1, 3): place(drums, lp(snare(), 3500) * 0.35, at)
                place(drums, hat() * 0.5, at); place(drums, hat() * 0.3, at + sw)
            elif drum == 'pulse':
                place(drums, lp(kick(), 400) * 0.5, at)
                place(drums, lp(hat(), 9000) * 0.25, at + sw)
            elif drum == 'soft':
                if k == 0: place(drums, lp(kick(), 1500) * 0.4, at)
                place(drums, hat() * 0.25, at + sw)
            elif drum == 'bounce':
                if k in (0, 2): place(drums, kick() * 0.4, at)
                if k in (1, 3): place(drums, bp(noise(0.05), 2000, 8000) * np.exp(-t_(0.05) / 0.01) * 0.5, at)
    if mood == 'lofi':  # tiếng rè vinyl
        crackle = (np.random.rand(N) > 0.9993) * np.random.randn(N) * 0.5 + lp(noise(N / SR), 1200) * 0.006
        mus += np.stack([crackle, crackle], 1)
    y = reverb(mus, size=1.8, mix=0.22) [:N] + drums
    y = y[: int(dur * SR)]
    fade = int(min(1.5, dur * 0.1) * SR)
    y[:int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))[:, None]
    y[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return norm(y, 0.8)


if __name__ == '__main__':
    mood, dur, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
    seed = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    y = compose(mood, dur, seed)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sf.write(out, y.astype(np.float32), SR)
    print(f'music: {mood} {dur:.1f}s → {out}')
