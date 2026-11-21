# tts-vi — lời đọc tiếng Việt cho video

Engine theo thứ tự: **VieNeu-TTS v3 Turbo** (local, miễn phí, chạy offline) → **Gemini API key** → **Gemini Agent Platform** (service account).
Engine lỗi thì tự chuyển engine sau; stderr ghi rõ câu nào dùng engine nào. Gõ sai tên giọng thì dừng ngay, không chuyển.

## Dùng

```bash
tts-vi "Xin chào các bạn" -o out.wav
tts-vi -f kich_ban.txt -o voice.wav            # đoạn cách nhau dòng trống, ghép với 0.35s lặng (--gap)
tts-vi --lines lines.json -d voice/            # [{"id","text","voice"?}] → voice/<id>.wav + dur.json + engine.json
tts-vi "..." -v "Mai Anh" -o out.wav           # chọn giọng VieNeu
tts-vi "..." -v clip_mau.wav -o out.wav        # nhân bản giọng từ clip 3–8 giây
tts-vi "..." --engine gemini-api -o out.wav    # ép một engine (vieneu | gemini-api | gemini-agent)
tts-vi --voices                                # liệt kê 25 giọng VieNeu
```

Đầu ra: WAV mono **48 kHz**, đã cắt lặng đầu/cuối, cùng độ to (RMS −18 dBFS, đỉnh ≤ 0.95) cho mọi engine.
Cảm xúc (thử nghiệm, chỉ VieNeu): chèn `[cười]`, `[thở dài]`, `[hắng giọng]` vào văn bản.

## Giọng VieNeu nên dùng

Bắc: **Hải Đăng** (mặc định, nam, tự nhiên), Mai Anh (nữ, tin tức), Trúc Ly (nữ), Thiện Minh / Thiền Tâm Đức (nam, kể chuyện), Ngọc Huyền (nữ), Adam bựa (nam, vui).
Trung: Quang Sơn, Ngọc Trân. Nam: Thùy Dung (nữ, tin tức), Thái Sơn, Minh Triết, Mỹ Duyên…

## Tệp

| Đường dẫn | Vai trò |
|---|---|
| `tools/tts-vi/tts_vi.py` | mã nguồn |
| `tools/tts-vi/config.env` | cấu hình (không commit) — chép từ `config.example.env`: giọng mặc định, thứ tự engine, đường dẫn file khoá Gemini, model |
| `tools/tts-vi/install.sh` | cài trên máy mới: tải VieNeu-TTS bản ghim, `uv sync`, tạo `config.env`, tạo lệnh `~/.local/bin/tts-vi` |
| `~/VieNeu-TTS` | repo VieNeu (`.venv` do `uv sync` tạo, model ở `~/.cache/huggingface`) |

Khoá Gemini không bao giờ chép vào repo — `config.env` chỉ trỏ tới file khoá có sẵn trên máy (hoặc đặt biến `GEMINI_API_KEY`).

## Hiệu năng (Mac Apple Silicon, CPU, fp32)

Nạp model ~8–10 giây mỗi lần gọi lệnh, sau đó RTF ≈ 0.3–0.6 (nhanh hơn thời gian thực).
Nhiều câu thì dùng `--lines` hoặc `-f` để chỉ nạp model một lần.
Không dùng `precision="int8"`: Apple Silicon không có VNNI, bản int8 có thể ra tiếng méo.

## Cập nhật VieNeu

```bash
cd ~/VieNeu-TTS && git pull && uv sync
```

Web UI gốc của VieNeu (thử giọng, nhân bản giọng): `cd ~/VieNeu-TTS && uv run vieneu-web` → http://127.0.0.1:7860
