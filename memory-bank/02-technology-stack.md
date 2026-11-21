# 02 — Công nghệ & kiến trúc

| Thành phần | Công nghệ (phiên bản ghim) | Lý do chọn |
|---|---|---|
| Dựng hình | Remotion 4.0.290, React 18.3.1, TypeScript | Video = component React; render khung hình xác định, lặp lại được |
| Icon | lucide-react 0.468.0 | Vector, giấy phép mở |
| Font | @fontsource Barlow / Google Sans / JetBrains Mono (OFL) | Đủ dấu tiếng Việt, đóng gói offline |
| Công cụ dòng lệnh | Node.js (đang dùng 24.x), pnpm 9 | Cùng ngôn ngữ với Remotion |
| Âm thanh | Python ≥ 3.11 qua `uv` (numpy, scipy, soundfile) | Tự tổng hợp nhạc/SFX, trộn và chuẩn hoá −14 LUFS |
| Lời đọc | `tts-vi` (mã ở `tools/tts-vi/`) → VieNeu-TTS 3.8.5 (local) → Gemini TTS | Miễn phí, offline; Gemini khi VieNeu lỗi |
| Chuẩn hoá lời đọc | `tools/tts/normalize.mjs` + `lexicon.json` (bộ luật VOICE_OFF_TTS_RULES v5) | Số, tiền, viết tắt, tên riêng đọc đúng (MISA → "mi xa") |
| Ghép/kiểm tra | ffmpeg / ffprobe | Trích khung, đo độ dài, ghép ảnh storyboard |
| Trang web tại máy | Node `http` thuần + 1 file HTML/JS thuần | Không thêm thư viện; công cụ cá nhân |
| Google Drive | REST API Drive v3 qua `fetch` (OAuth máy tính + PKCE, resumable upload) — `tools/web/drive.mjs` | Không cần SDK; quyền nhỏ nhất `drive.file` |
| Cài đặt | `setup.sh` (Homebrew/apt) + `tools/doctor.mjs` + hook SessionStart | Clone về máy mới chạy một lệnh là đủ |
| Sáng tác tự động | Claude Code CLI (`claude -p`) + skill `series` | Viết kế hoạch/kịch bản cần LLM |
| Engine phụ (tuỳ chọn) | lemo-opuscar (plugin Claude), HyperFrames 0.9.19 | Phong cách nghệ thuật; HyperFrames chưa kiểm chứng |

## Sơ đồ

```
 form web / chat  ──►  series/<slug>/brief.json, bible.json, plan.json
                              │  (Claude viết)
                              ▼
                 episodes/epNN/episode.json   ◄── nguồn duy nhất của một tập
                              │
        pnpm ep <dir> check → script → storyboard   (ảnh từng cảnh + đo chồng lấn)
                              │
                     voice  (tts-vi → voice/*.wav + dur.json)
                              │
                     timing (tools/timing.mjs → build/timed.json, phụ đề, SFX, out/epNN.srt)
                              │
                     audio  (tools/audio/mix.py: nhạc + SFX + voice → build/mix.wav, độ mở miệng)
                              │
                     render (Remotion composition "Episode" → out/epNN.mp4)
```

## Thư mục

| Đường dẫn | Vai trò |
|---|---|
| `remotion/` | `Episode.tsx` (composition), `kit/` (nhân vật, bối cảnh, phụ đề, logo, theme), `scenes/` (template cảnh), `custom/` (cảnh riêng) |
| `shared/reveal.mjs` | Lịch hiện mục — dùng chung cho hình và SFX |
| `setup.sh` | Cài máy mới (mọi phần mềm + thư viện) |
| `.claude/` | `settings.json` (hook SessionStart → `doctor.mjs --hook`), `launch.json` (khởi động trang web trong Claude Desktop) |
| `tools/` | `ep.mjs`, `series.mjs`, `timing.mjs`, `render.mjs`, `voices.mjs`, `lib.mjs`, `doctor.mjs`, `tts/`, `tts-vi/`, `audio/`, `web/` (`server.mjs`, `drive.mjs`) |
| `web/index.html` | Giao diện trang web tại máy |
| `skill/` | Skill `/series` (symlink vào `~/.claude/skills/series`) |
| `assets/` | `brand/` (logo MISA gốc), `fonts/` (sinh bởi `sync-fonts`), `sfx/` (sinh bởi `sfx_bank.py`) |
| `series/` | Dữ liệu từng series (JSON + voice + storyboard; `build/`, `out/` không commit) |
| `docs/` | `reference.md` (tra cứu), `lemo-styles.md` (sinh tự động) |
