"""tts-vi — sinh lời đọc tiếng Việt cho video.

Thứ tự engine (ENGINE_ORDER trong config.env): VieNeu-TTS local → Gemini API key → Gemini Agent Platform.
Engine nào lỗi thì tự chuyển engine sau và in ra stderr đã dùng engine nào.

  tts-vi "Xin chào các bạn" -o out.wav
  tts-vi -f kich_ban.txt -o voice.wav                 # file văn bản, các đoạn cách nhau dòng trống
  tts-vi --lines lines.json -d voice/                 # nhiều câu: [{"id","text"(,"voice")}] → <id>.wav + dur.json
  tts-vi --voices                                     # liệt kê giọng VieNeu
  tts-vi "..." -o out.wav --engine gemini-api         # ép dùng một engine
Mọi file ra là WAV mono 48 kHz (Gemini 24 kHz được nâng lên 48 kHz để trộn chung).
"""
import argparse, base64, json, os, re, ssl, subprocess, sys, time, urllib.error, urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
SR = 48000
CTX = ssl.create_default_context(cafile="/etc/ssl/cert.pem" if os.path.exists("/etc/ssl/cert.pem") else None)


def log(*a):
    print(*a, file=sys.stderr, flush=True)


class UserError(Exception):
    """Lỗi do tham số người dùng — dừng ngay, không chuyển engine dự phòng."""


def load_config():
    cfg = {}
    for line in (HERE / "config.env").read_text(encoding="utf8").splitlines():
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.rstrip("\n")  # giữ dấu cách cuối: tên file khoá có dấu cách
    for k in list(cfg):  # biến môi trường ghi đè config
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    return cfg


# ---------------------------------------------------------------- VieNeu
class VieNeu:
    name = "vieneu"

    def __init__(self, cfg):
        self.cfg, self.tts = cfg, None

    def _load(self):
        if self.tts is None:
            import warnings
            warnings.filterwarnings("ignore")
            from vieneu import Vieneu
            t = time.time()
            self.tts = Vieneu()
            log(f"[vieneu] nạp model {time.time() - t:.1f}s")
        return self.tts

    def synth(self, text, voice=None):
        tts = self._load()
        voice = voice or self.cfg.get("VIENEU_VOICE", "Hải Đăng")
        if Path(voice).suffix.lower() in (".wav", ".mp3", ".m4a", ".flac") and Path(voice).exists():
            audio = tts.infer(text, ref_audio=voice)  # nhân bản giọng từ clip 3–8 giây
        else:
            names = [v for _, v in tts.list_preset_voices()]
            if voice not in names:  # gõ sai tên giọng là lỗi người dùng, không chuyển sang Gemini
                raise UserError(f"Không có giọng VieNeu '{voice}'. Giọng có sẵn: {', '.join(names)}")
            audio = tts.infer(text, voice=voice)
        return np.asarray(audio, dtype=np.float32)

    def voices(self):
        return self._load().list_preset_voices()


# ---------------------------------------------------------------- Gemini (API key / Agent Platform)
def gemini_clean(x, sr=24000):
    """PCM Gemini TTS có vài mẫu rác ở đầu và ~125 ms dữ liệu không phải tiếng ở cuối, mỗi đoạn nằm sau một quãng
    lặng số: cắt ở các quãng lặng đó (nếu không sẽ nghe tiếng 'tách' khi trộn)."""
    z, run = np.abs(x) < 1e-3, int(.004 * sr)
    zr = np.convolve(z.astype(int), np.ones(run, int), "valid") == run
    head = np.where(zr[:int(.1 * sr)])[0]
    if len(head) and np.abs(np.diff(x[:head[0] + 1])).max(initial=0) > .2:
        x, zr = x[head[0]:], zr[head[0]:]
    tail = np.where(zr)[0]
    tail = tail[tail > len(x) - int(.3 * sr)]
    if len(tail) and np.abs(np.diff(x[tail[0]:])).max(initial=0) > .2:
        x = x[:tail[0]]
    return x


class Gemini:
    def __init__(self, cfg, via):
        self.cfg, self.via, self.name = cfg, via, f"gemini-{via}"
        self._token = (None, 0)

    def _api_key(self):
        if os.environ.get("GEMINI_API_KEY"):
            return os.environ["GEMINI_API_KEY"]
        path = self.cfg.get("GEMINI_KEY_FILE", "")
        if not path or not os.path.exists(path):
            raise RuntimeError(f"không thấy file khoá Gemini: {path!r}")
        for line in open(path, encoding="utf8"):
            m = re.match(r"\s*(?:GEMINI_API_KEY\s*=|API key\s*:)\s*['\"]?([^'\"\s]+)", line, re.I)
            if m:
                return m.group(1)
        raise RuntimeError("file khoá Gemini không có dòng 'API key:' hoặc 'GEMINI_API_KEY='")

    def _access_token(self):
        tok, exp = self._token
        if tok and time.time() < exp:
            return tok
        cred = self.cfg.get("GOOGLE_APPLICATION_CREDENTIALS", "")
        if not os.path.exists(cred):
            raise RuntimeError(f"không thấy file service account: {cred!r}")
        gcloud = next((p for p in (os.path.expanduser("~/google-cloud-sdk/bin/gcloud"), "/opt/homebrew/bin/gcloud")
                       if os.path.exists(p)), "gcloud")
        env = {**os.environ, "GOOGLE_APPLICATION_CREDENTIALS": cred}
        out = subprocess.run([gcloud, "auth", "application-default", "print-access-token"],
                             env=env, capture_output=True, text=True, timeout=60)
        if out.returncode != 0:
            raise RuntimeError("lấy access token thất bại: " + out.stderr.strip()[-300:])
        tok = out.stdout.strip()
        self._token = (tok, time.time() + 45 * 60)
        return tok

    def _request(self, body):
        model = self.cfg.get("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts")
        if self.via == "api":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            headers = {"x-goog-api-key": self._api_key()}
        else:
            project = json.load(open(self.cfg["GOOGLE_APPLICATION_CREDENTIALS"]))["project_id"]
            loc = self.cfg.get("GOOGLE_CLOUD_LOCATION", "global")
            host = "aiplatform.googleapis.com" if loc == "global" else f"{loc}-aiplatform.googleapis.com"
            url = f"https://{host}/v1/projects/{project}/locations/{loc}/publishers/google/models/{model}:generateContent"
            headers = {"authorization": f"Bearer {self._access_token()}"}
        req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json", **headers})
        last = None
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=180, context=CTX) as r:
                    return json.load(r)
            except urllib.error.HTTPError as e:
                last = f"HTTP {e.code}: {e.read()[:300].decode(errors='replace')}"
                if e.code in (400, 401, 403, 404):
                    break  # lỗi cấu hình/khoá: thử lại vô ích
            except (urllib.error.URLError, TimeoutError) as e:
                last = str(e)
            time.sleep(3 * (attempt + 1))
        raise RuntimeError(last)

    def synth(self, text, voice=None):
        voice = voice or self.cfg.get("GEMINI_VOICE", "Charon")
        part = {"text": text}
        if self.cfg.get("GEMINI_STYLE"):
            part["speechMetadata"] = {"style": self.cfg["GEMINI_STYLE"]}
        body = {"contents": [{"role": "user", "parts": [part]}],
                "generationConfig": {"responseModalities": ["AUDIO"],
                                     "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
        d = self._request(body)
        inline = next((p["inlineData"] for p in d["candidates"][0]["content"]["parts"] if p.get("inlineData")), None)
        if not inline:
            raise RuntimeError("model không trả về âm thanh")
        raw = base64.b64decode(inline["data"])
        if raw[:4] == b"RIFF":
            import io
            x, rate = sf.read(io.BytesIO(raw), dtype="float32")
        else:
            rate = int((re.search(r"rate=(\d+)", inline.get("mimeType", "")) or [0, 24000])[1])
            x = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768
        x = gemini_clean(x, rate)
        if rate != SR:
            import soxr
            x = soxr.resample(x, rate, SR).astype(np.float32)
        return x


# ---------------------------------------------------------------- chung
def trim(x, sr=SR, thr=0.01):
    """Cắt lặng đầu/cuối, chừa 30 ms trước và 80 ms sau, fade 5 ms chống tiếng tách."""
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx):
        return x
    y = x[max(0, idx[0] - int(.03 * sr)):min(len(x), idx[-1] + int(.08 * sr))].copy()
    f = int(.005 * sr)
    if len(y) > 2 * f:
        y[:f] *= np.linspace(0, 1, f)
        y[-f:] *= np.linspace(1, 0, f)
    return y


def level(x, rms=0.12, peak=0.95):
    """Đưa mọi engine về cùng độ to (RMS ≈ -18 dBFS) rồi giới hạn đỉnh để không vỡ tiếng khi lưu."""
    r = float(np.sqrt(np.mean(x ** 2))) if len(x) else 0
    if r > 1e-4:
        x = x * (rms / r)
    p = float(np.abs(x).max(initial=0))
    return (x * (peak / p) if p > peak else x).astype(np.float32)


class Router:
    def __init__(self, cfg, force=None):
        self.cfg = cfg
        order = [force] if force else [e.strip() for e in cfg.get("ENGINE_ORDER", "vieneu").split(",") if e.strip()]
        make = {"vieneu": lambda: VieNeu(cfg), "gemini-api": lambda: Gemini(cfg, "api"),
                "gemini-agent": lambda: Gemini(cfg, "agent")}
        bad = [e for e in order if e not in make]
        if bad:
            sys.exit(f"engine không hợp lệ: {bad} (chọn: {', '.join(make)})")
        self.engines = [make[e]() for e in order]
        self.dead = set()

    def synth(self, text, voice=None, gemini_voice=None):
        errors = []
        for eng in self.engines:
            if eng.name in self.dead:
                continue
            v = voice if eng.name == "vieneu" else gemini_voice
            try:
                t = time.time()
                x = level(trim(eng.synth(text, v)))
                if len(x) < SR * 0.2:
                    raise RuntimeError("âm thanh rỗng")
                log(f"[{eng.name}] {len(x) / SR:.1f}s audio / {time.time() - t:.1f}s")
                return x, eng.name
            except UserError as e:
                raise SystemExit(str(e))
            except Exception as e:  # noqa: BLE001 — engine nào lỗi cũng chuyển sang engine sau
                msg = str(e).splitlines()[0][:300] if str(e) else type(e).__name__
                log(f"[{eng.name}] LỖI: {msg} → chuyển engine dự phòng")
                errors.append(f"{eng.name}: {msg}")
                self.dead.add(eng.name)  # không thử lại engine hỏng cho các câu sau
        raise SystemExit("Tất cả engine đều lỗi:\n  " + "\n  ".join(errors))


def paragraphs(text):
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def main():
    ap = argparse.ArgumentParser(description="Sinh lời đọc tiếng Việt (VieNeu → Gemini dự phòng)",
                                 formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument("text", nargs="?", help="văn bản cần đọc")
    ap.add_argument("-f", "--file", help="đọc văn bản từ file (đoạn cách nhau bởi dòng trống)")
    ap.add_argument("-o", "--out", default="voice.wav", help="file WAV ra (mặc định voice.wav)")
    ap.add_argument("--lines", help='JSON [{"id","text","voice"?}] → mỗi câu một file')
    ap.add_argument("-d", "--dir", default="voice", help="thư mục ra cho --lines")
    ap.add_argument("-v", "--voice", help="giọng VieNeu (tên preset hoặc đường dẫn clip 3–8s để nhân bản)")
    ap.add_argument("--gemini-voice", help="giọng Gemini khi dự phòng (mặc định Charon)")
    ap.add_argument("--engine", choices=["vieneu", "gemini-api", "gemini-agent"], help="chỉ dùng một engine")
    ap.add_argument("--gap", type=float, default=0.35, help="giây lặng giữa các đoạn khi ghép (mặc định 0.35)")
    ap.add_argument("--voices", action="store_true", help="liệt kê giọng VieNeu")
    a = ap.parse_args()
    cfg = load_config()

    if a.voices:
        for label, _ in VieNeu(cfg).voices():
            print(label)
        return

    router = Router(cfg, a.engine)
    if a.lines:
        items = json.load(open(a.lines, encoding="utf8"))
        out = Path(a.dir)
        out.mkdir(parents=True, exist_ok=True)
        dur_path = out / "dur.json"
        durs = json.load(open(dur_path)) if dur_path.exists() else {}
        used = {}
        for it in items:
            x, eng = router.synth(it.get("say", it["text"]), it.get("voice", a.voice), it.get("gemini_voice", a.gemini_voice))
            sf.write(out / f"{it['id']}.wav", x, SR)
            durs[it["id"]] = round(len(x) / SR, 3)
            used[it["id"]] = eng
            print(f"{it['id']}: {durs[it['id']]:.2f}s ({eng})")
        json.dump(durs, open(dur_path, "w"), indent=1)
        json.dump(used, open(out / "engine.json", "w"), indent=1)
        return

    text = Path(a.file).read_text(encoding="utf8") if a.file else a.text
    if not text:
        ap.error("cần văn bản, -f FILE hoặc --lines")
    chunks, engines = [], []
    gap = np.zeros(int(a.gap * SR), np.float32)
    for i, p in enumerate(paragraphs(text)):
        x, eng = router.synth(p, a.voice, a.gemini_voice)
        chunks += [gap, x] if i else [x]
        engines.append(eng)
    y = np.concatenate(chunks)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    sf.write(a.out, y, SR)
    print(f"{a.out}: {len(y) / SR:.2f}s · engine: {', '.join(sorted(set(engines)))}")


if __name__ == "__main__":
    main()
