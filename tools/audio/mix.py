"""Trộn âm thanh một tập: voice (theo timing) + SFX + nhạc nền (tự hạ khi có lời) → build/mix.wav (chuẩn −14 LUFS),
và build/mouth.json (độ mở miệng từng frame cho nhân vật đang nói). Chạy: uv run tools/audio/mix.py <thư-mục-tập>"""
import json, os, subprocess, sys
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from scipy.ndimage import uniform_filter1d

sys.path.insert(0, os.path.dirname(__file__))
from dsp import SR, place
from music import compose

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))


def load(p):
    x, sr = sf.read(p, dtype='float32', always_2d=True)
    if sr != SR:
        x = resample_poly(x, SR, sr, axis=0)
    return x


def loudnorm(src, dst, I=-14, TP=-1.5):
    """Chuẩn hoá độ to 2 lượt bằng ffmpeg (chuẩn phổ biến cho TikTok/YouTube/Facebook)."""
    a = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', src, '-af', f'loudnorm=I={I}:TP={TP}:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = json.loads(a[a.rindex('{'):a.rindex('}') + 1])
    flt = (f"loudnorm=I={I}:TP={TP}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
           f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-af', flt, '-ar', str(SR), dst], check=True)


def main(ep):
    B = 'build' + ('-' + os.environ['SERIES_ENGINE'] if os.environ.get('SERIES_ENGINE') else '')
    A = json.load(open(os.path.join(ep, B, 'audio.json')))
    fps, dur = A['fps'], A['duration']
    N = int(dur * SR) + SR // 2
    voice = np.zeros((N, 2)); sfx = np.zeros((N, 2)); music = np.zeros((N, 2))
    nfr = int(np.ceil(dur * fps)) + 1
    mouth = {}
    missing = []
    # ── voice
    active = np.zeros(N)
    for v in A['voiceLines']:
        p = os.path.join(ep, v['file'])
        if not os.path.exists(p):
            missing.append(v['id']); continue
        x = load(p)[:, 0]
        at = int(v['start'] * SR)
        place(voice, x, at)
        active[at: at + len(x)] = 1
        if v.get('speaker'):
            # bao biên độ theo frame → độ mở miệng (0..1), làm mượt nhẹ, có "nhịp" để miệng không mở đứng im
            hop = SR // fps
            fr = len(x) // hop
            rms = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(fr)])
            m = np.clip((20 * np.log10(rms + 1e-9) + 42) / 22, 0, 1)
            m = uniform_filter1d(m, 2)
            arr = mouth.setdefault(v['speaker'], np.zeros(nfr))
            f0 = int(round(v['start'] * fps))
            arr[f0: f0 + len(m)] = np.maximum(arr[f0: f0 + len(m)], m[: max(0, nfr - f0)])
    # ── sfx
    cache = {}
    for c in A['cues']:
        p = os.path.join(ROOT, 'assets/sfx', f"{c['name']}.wav")
        if not os.path.exists(p):
            print(f"  ! thiếu sfx '{c['name']}'"); continue
        x = cache.get(p)
        if x is None:
            x = cache[p] = load(p)
        place(sfx, x, int(c['t'] * SR), c['vol'])
    # ── nhạc + ducking theo lời
    mu = A.get('music')
    if mu:
        y = compose(mu['mood'], dur + 0.5, mu.get('seed', 1))
        place(music, y, 0)
        duck = uniform_filter1d(active, int(0.25 * SR))  # mượt lên/xuống ~250 ms
        g = mu.get('volume', 0.14) * (1 - 0.55 * np.clip(duck * 1.5, 0, 1))
        music *= g[:, None]
    mix = voice * 1.0 + sfx * 0.55 + music
    mix = mix[: int(dur * SR)]
    os.makedirs(os.path.join(ep, B), exist_ok=True)
    raw = os.path.join(ep, B, 'mix.raw.wav')
    sf.write(raw, np.clip(mix, -1, 1).astype(np.float32), SR)
    loudnorm(raw, os.path.join(ep, B, 'mix.wav'))
    os.remove(raw)
    json.dump({k: [round(float(v), 2) for v in arr] for k, arr in mouth.items()}, open(os.path.join(ep, B, 'mouth.json'), 'w'))
    print(f"mix: {dur:.1f}s · {len(A['voiceLines']) - len(missing)} câu voice · {len(A['cues'])} sfx · nhạc {mu['mood'] if mu else 'tắt'} → {B}/mix.wav")
    if missing:
        print(f"  ! chưa có voice cho {len(missing)} câu: {', '.join(missing[:6])}{'…' if len(missing) > 6 else ''}")


if __name__ == '__main__':
    main(os.path.abspath(sys.argv[1]))
