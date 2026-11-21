"""Khối DSP nhỏ dùng chung cho kho SFX và nhạc nền (tự tổng hợp — không dùng mẫu âm thanh có bản quyền)."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
rng = np.random.default_rng(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.005, decay=0.2):
    t = t_(d)
    e = np.exp(-t / max(decay, 1e-4))
    if a > 0:
        e *= np.minimum(1, t / a)
    return e


def adsr(n, a, d, s, r):
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    S = max(0, n - A - D - R)
    return np.concatenate([np.linspace(0, 1, A, False), np.linspace(1, s, D, False), np.full(S, s), np.linspace(s, 0, R)])[:n]


def noise(d):
    return rng.standard_normal(int(d * SR))


def _f(x, kind, f):
    f = np.clip(np.atleast_1d(np.asarray(f, float)), 20, SR / 2 - 100)
    if kind == 'bandpass' and f[0] >= f[1] * 0.98:
        f = np.array([f[1] * 0.6, f[1]])
    sos = butter(2, f if kind == 'bandpass' else float(f[0]), btype=kind, fs=SR, output='sos')
    return sosfilt(sos, x)


def lp(x, f): return _f(x, 'lowpass', f)
def hp(x, f): return _f(x, 'highpass', f)
def bp(x, lo, hi): return _f(x, 'bandpass', [lo, hi])


def sweep(f0, f1, d, curve='exp'):
    t = t_(d)
    u = t / d
    f = f0 * (f1 / f0) ** u if curve == 'exp' else f0 + (f1 - f0) * u
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def tone(f, d, decay=0.3, a=0.004, harm=((1, 1.0),)):
    t = t_(d)
    x = sum(g * np.sin(2 * np.pi * f * k * t) for k, g in harm)
    return x * env(d, a, decay)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def reverb(x, size=1.2, mix=0.25, damp=5000, stereo=True):
    n = int(size * SR)
    ir = rng.standard_normal((n, 2)) * np.exp(-np.arange(n) / (size * SR / 6))[:, None]
    ir[:, 0] = lp(ir[:, 0], damp); ir[:, 1] = lp(ir[:, 1], damp)
    ir /= np.sqrt((ir ** 2).sum(axis=0))
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    wet = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x) + n] for c in range(2)], 1)
    dry = np.zeros_like(wet); dry[: len(x)] = x
    return dry * (1 - mix) + wet * mix


def stereo(x, pan=0.0):
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l, x * r], 1) * np.sqrt(2)


def place(buf, x, at, gain=1.0):
    """Cộng x (mono hoặc stereo) vào buf (stereo) tại mẫu `at`."""
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    if at >= len(buf):
        return
    if at < 0:
        x = x[-at:]; at = 0
    n = min(len(x), len(buf) - at)
    buf[at: at + n] += x[:n] * gain
