# 07 — Cài đặt, cấu hình, triển khai

## Môi trường

| Môi trường | Trạng thái | Ghi chú |
|---|---|---|
| Máy cá nhân macOS Apple Silicon | Đang dùng | Node 24, pnpm 9, uv, ffmpeg 7, Claude Code CLI |
| Docker | Có (`Dockerfile`, `docker-compose.yml`) | Mục Docker bên dưới |
| Cloud Run | Chưa làm | **Không tự triển khai** — chỉ khi chủ dự án yêu cầu |

## Cài trên máy mới

```bash
git clone https://github.com/tuannhh/xuong-phim.git ~/social-series-studio
cd ~/social-series-studio && bash setup.sh
```

`setup.sh` chạy lại bao nhiêu lần cũng được (bước nào có rồi thì bỏ qua):
1. macOS: Homebrew (thiếu thì chạy bộ cài chính thức — **hỏi mật khẩu máy**, nên người dùng phải tự chạy trong Terminal nếu Claude không chạy được) → `brew install` git, node, pnpm, uv, ffmpeg còn thiếu (Node < 20 cũng cài lại). Linux: apt cho git/ffmpeg/curl, uv qua script chính thức, Node phải có sẵn.
2. `pnpm install --frozen-lockfile` → `node tools/sync-fonts.mjs` → `uv sync` → kho SFX (nếu chưa có) → `pnpm exec remotion browser ensure` (Chrome headless ~85 MB).
3. `bash tools/tts-vi/install.sh`: clone VieNeu-TTS về `~/VieNeu-TTS` (ghim 6566468 = 3.8.5), `uv sync`, tạo `tools/tts-vi/config.env` từ mẫu, tạo lệnh `~/.local/bin/tts-vi`, chạy thử (lần đầu tải model Hugging Face). Biến: `VIENEU_DIR`, `VIENEU_REF`, `TTS_BIN_DIR`.
4. Gắn skill: `~/.claude/skills/series` → `<repo>/skill` (không ghi đè nếu đó là thư mục thật).
5. Claude Code CLI: có rồi thì bỏ qua, chưa có thì `npm install -g @anthropic-ai/claude-code`. Đăng nhập (`claude` → `/login`) người dùng tự làm.
6. `node tools/doctor.mjs` in bảng kiểm tra.

Biến bỏ bước: `XUONG_SKIP_TTS=1`, `XUONG_SKIP_SKILL=1`, `XUONG_SKIP_CLAUDE=1`.

**Mở bằng Claude Desktop:** `.claude/settings.json` có hook `SessionStart` chạy `node tools/doctor.mjs --hook`: đủ thì im lặng, thiếu thì báo Claude chạy `bash setup.sh`. `.claude/launch.json` có cấu hình `xuong-phim` để Claude mở trang web trong khung trình duyệt (khi phiên mở đúng thư mục xưởng).

- Lần đầu render, Remotion dùng Chrome đã tải ở bước 2; `build/`, `out/` không commit → máy mới phải dựng lại MP4 (voice đã commit nên không đọc lại).
- Engine phụ tuỳ chọn: plugin lemo-opuscar (`claude plugin marketplace update lemolab && claude plugin update lemo-opuscar@lemolab`, thư viện ở `~/lemo-opuscar`).

## Cấu hình

**Commit được:** `bible.json`/`brief.json` từng series; `tools/tts-vi/config.example.env`.

**Không commit (đã gitignore):**

| Mục | Ý nghĩa | Bắt buộc? |
|---|---|---|
| `tools/tts-vi/config.env` | Giọng mặc định, thứ tự engine, đường dẫn file khoá Gemini | Có (install.sh tạo từ mẫu) |
| File khoá Gemini API / service account | Dự phòng giọng đọc | Không — chỉ cần nếu muốn Gemini |
| `series/*/.studio/gop-y.md` | Góp ý tạm từ trang web | — |
| `~/.config/xuong-phim/google.json` | OAuth client + token Google Drive (quyền 600) | Không — chỉ khi dùng Drive |
| `~/.config/xuong-phim/settings.json` | Thư mục phim chung (trang Thiết lập) | Không — mặc định `~/Movies/Xưởng phim` |
| `series/*/tu-lieu/`, `series/*/.studio/tu-lieu/` | Tư liệu người dùng + bản đọc | — |
| `series/*/episodes/*/out/export.json` | Đường dẫn bản chép trong thư mục phim của máy này | — |
| `.env` | Biến cho docker compose (mẫu `.env.example`) | Chỉ khi chạy Docker |
| `series/*/.studio/drive.json`, `out/drive.json` | id thư mục/file Drive gắn với tài khoản trên máy này | — |

**Biến môi trường:** `PORT` (trang web, mặc định 4710), `STUDIO_CLAUDE_BIN` (đường dẫn lệnh claude), `STUDIO_CLAUDE_MODEL` (model cho bước sáng tác), `GEMINI_API_KEY` (ghi đè file khoá), `LEMO_LIB` (thư viện lemo-opuscar), `XUONG_CONFIG_DIR` (thư mục cấu hình), `XUONG_OUTPUT_DIR` (thư mục phim, ghi đè trang Thiết lập), `XUONG_OUTPUT_HOST_PATH` (Docker: đường dẫn máy thật để hiển thị), `XUONG_DOCKER`, `STUDIO_GOOGLE_BASE` (chỉ để kiểm thử với máy chủ Google giả lập).

## Docker (2026-11-22)

```bash
cp .env.example .env          # XUONG_OUTPUT_DIR, TU_LIEU_DIR, CLAUDE_CODE_OAUTH_TOKEN / ANTHROPIC_API_KEY, GEMINI_API_KEY
docker compose up -d --build  # → http://localhost:4710
```

- Image (`Dockerfile`): node:24-bookworm-slim + ffmpeg + thư viện Chrome headless của Remotion + font emoji → uv 0.13.9 → VieNeu-TTS clone vào `/opt/vieneu` (ghim `VIENEU_REF=6566468`, `uv sync --frozen --no-dev`) → Claude CLI (`WITH_CLAUDE=1`) → `pnpm install` → `uv sync` → Chrome headless → mã xưởng → font, kho SFX, `config.env` trỏ `/opt/vieneu`, lệnh `/usr/local/bin/tts-vi`, skill gắn vào `/root/.claude/skills/series`. Lớp nặng (VieNeu, thư viện) đứng trước `COPY . .` nên sửa mã chỉ build lại vài giây.
- Biến trong image: `XUONG_DOCKER=1` (máy chủ nghe `0.0.0.0`, tắt nút "Mở thư mục", khoá thư mục phim), `XUONG_CONFIG_DIR=/data/config`, `XUONG_OUTPUT_DIR=/data/output`, `HF_HOME=/data/cache/huggingface`.
- `docker-compose.yml`: publish `127.0.0.1:4710` (chỉ máy này); volume `./series:/app/series`, thư mục phim `${XUONG_OUTPUT_DIR}` → `/data/output` (trang hiện đường dẫn máy thật nhờ `XUONG_OUTPUT_HOST_PATH`), thư mục tư liệu `${TU_LIEU_DIR}` gắn **chỉ-đọc, cùng đường dẫn** (dán đường dẫn trong form như ngoài Docker), volume tên `xuong-config` (OAuth Drive) và `xuong-cache` (model VieNeu). `shm_size: 1gb` cho Chrome.
- Đăng nhập Claude trong container: `CLAUDE_CODE_OAUTH_TOKEN` (từ `claude setup-token` trên máy thật, dùng gói thuê bao) hoặc `ANTHROPIC_API_KEY` (tính tiền theo API).
- Google Drive trong Docker: OAuth redirect `http://127.0.0.1:4710/api/drive/callback` đi qua cổng publish nên vẫn chạy; token lưu ở volume `xuong-config`.
- **Đã kiểm chứng 2026-11-22 (Mac Apple Silicon, image linux/arm64 5,96 GB):** `/api/doctor` trong container đủ 11/11; `tts-vi` dùng VieNeu (nạp model 10 s, 2,5 s tiếng/15 s); đọc tư liệu (docx/pptx/xlsx/pdf/ảnh); dựng tập 4 qua nút trên trang → MP4 1080×1920 66,8 s trong 156 s, tự chép ra thư mục phim trên máy thật, trang hiện đúng đường dẫn máy thật. **Chưa kiểm chứng trong Docker:** nút AI (cần `CLAUDE_CODE_OAUTH_TOKEN` thật), Google Drive thật.
- Hạn chế: VieNeu + Remotion chạy CPU trong container (trên Mac chậm hơn chạy thẳng); file container ghi vào `series/` thuộc root trên máy Linux (Docker Desktop trên Mac thì không sao); lần build đầu tải vài GB (mạng chậm có thể mất 20–30 phút).

## Cloud Run (đánh giá 2026-11-22, chưa làm — không tự triển khai)

**Cloud Run — làm được nhưng không hợp với thiết kế hiện tại; cần sửa trước:**
1. Không có đăng nhập: trang web giả định chỉ chủ máy truy cập. Lên mạng phải có xác thực (IAP / Google login nội bộ) — bắt buộc.
2. Ổ đĩa tạm: Cloud Run xoá file khi instance tắt, nhiều instance không chung file → cần Cloud Storage (gắn FUSE) hoặc lưu kết quả lên bucket.
3. Việc nền dài (render 1–2 phút, Claude viết kịch bản vài phút, đọc voice) chạy sau khi trả lời request → phải bật CPU luôn cấp phát, `max-instances=1` (trạng thái việc giữ trong bộ nhớ), hoặc tách render thành Cloud Run Jobs.
4. Tài nguyên: VieNeu + Chrome cần khoảng 4 vCPU / 8–16 GB RAM; image vài GB; nạp model ~10 giây mỗi lần gọi.
5. Claude chạy ngầm trên cloud cần khoá API riêng và vẫn chạy được lệnh shell trong container (quyền `acceptEdits` + danh sách lệnh) — chấp nhận được trong container cô lập, nhưng phải có hạn mức chi phí.
6. Gemini dự phòng lại dễ hơn trên Cloud Run (dùng service account của dịch vụ, không cần file khoá).

**Khuyến nghị:** dùng Docker (hoặc cài thẳng theo mục trên) cho máy cá nhân/máy nội bộ. Chỉ lên Cloud Run khi có nhiều người cùng dùng, và làm đủ 1–3 trước.

## Việc còn treo

- Máy hiện tại: lệnh `tts-vi` vẫn trỏ tới bản cũ `~/tools/tts-vi/` (cùng nội dung với `tools/tts-vi/tts_vi.py` lúc chép 2026-11-22). Sửa một bên phải chép sang bên kia, hoặc chạy `install.sh` để trỏ về repo.
- Google Drive mới kiểm thử với máy chủ Google giả lập (OAuth + PKCE, tải lên theo khúc, ghi đè, tạo lại thư mục, làm mới/thu hồi token). Chưa chạy với Google thật vì cần người dùng tạo OAuth client trong Google Cloud.
- `setup.sh` mới chạy thử trên máy đã có Homebrew/Node/uv/ffmpeg (bước cài các phần mềm đó chưa chạy thật trên máy trắng).
- **Tốc độ Docker vs chạy thẳng (đo 2026-11-22, cùng Mac Apple Silicon):** giọng VieNeu 4 câu ~5 s (thẳng) vs ~39 s (Docker, ~8×); vẽ 300 khung 12,0 s vs 21,5 s (~1,8×); storyboard 11,2 s vs 17,4 s. Docker trên Mac chạy trong máy ảo Linux, không có Metal/GPU, CPU bị chia. → Trên Mac khuyên chạy thẳng (`pnpm web`); Docker để mang sang máy khác.
- **GPU:** Remotion `chromiumOptions.gl='angle'` chậm hơn với SVG/CSS của xưởng, `swangle` chậm hơn nhiều; mã hoá phần cứng (VideoToolbox) không đổi gì vì nút thắt là vẽ khung. VieNeu mặc định ONNX Runtime CPU; nhánh GPU cần PyTorch CUDA (card NVIDIA, Windows/Linux, `vieneu[gpu]`) — chưa thử. Docker trên Windows + NVIDIA có thể chuyển GPU qua WSL2 — chưa thử.

## Cài thẳng trên máy khác — không cần Docker (2026-11-22)

- Chủ dự án chốt: máy gốc chạy thẳng (`pnpm web`), Docker chỉ là phương án dự phòng.
- `setup.sh` hỗ trợ macOS (Homebrew), Linux apt (Ubuntu/Debian) và Windows qua WSL2 Ubuntu. Nhánh Linux cài đúng bộ gói hệ thống như Dockerfile (ffmpeg, thư viện Chrome headless, font emoji; `libasound2t64` trên Ubuntu 24.04), Node 24 bản chính thức vào `~/.local` nếu máy chưa có Node ≥ 20, pnpm 9.15.9, uv. WSL: cảnh báo khi repo nằm ở `/mnt/…` (ổ Windows, rất chậm).
- Ghim phiên bản: `pnpm-lock.yaml` (`--frozen-lockfile`), `uv.lock`, VieNeu `VIENEU_REF=6566468` (3.8.5), Remotion 4.0.290 tự tải Chrome headless đúng bản.
- Cuối `setup.sh` chạy `node tools/doctor.mjs --thu` (= `pnpm thu-may`): chép tập mẫu `tools/selftest/thu-may` (3 cảnh, 4 câu, nam + nữ, có link misa.vn) vào thư mục tạm, dựng `all` bản đầy đủ 1080×1920 với `XUONG_OUTPUT_DIR` trỏ vào thư mục tạm (không lọt vào thư mục phim thật), báo thời gian giọng / vẽ / tổng so với máy gốc (MacBook Pro M1 Pro: 12 + 12 → 28 giây), rồi xoá thư mục tạm. Giọng không chạy bằng VieNeu → cảnh báo. Bỏ qua bằng `XUONG_SKIP_THU=1`.

## Chọn cách chạy khi clone (2026-11-23)

- `bash start.sh`: lần đầu hỏi 1) chạy thẳng (khuyên dùng) / 2) Docker, nhớ ở `.xuong-mode` (ngoài git); `--chon` để chọn lại. Chạy thẳng: dừng container Docker nếu đang chạy, máy thiếu gì thì chạy `setup.sh`, rồi mở trang. Docker: kiểm tra Docker Desktop, tạo `.env` từ mẫu, `docker compose up -d --build`. Cả hai không đụng vào khi cổng 4710 đang có việc `running`/`stopping`.
- Windows: bấm đúp `Mo Xuong phim (Docker - Windows).cmd` (Docker Desktop); chạy thẳng trên Windows = WSL2 Ubuntu + `bash start.sh`. `.gitattributes` giữ CRLF cho `.cmd`.

**Tự mở khi bật máy (2026-11-23):** `tools/autostart.mjs` — macOS LaunchAgent `~/Library/LaunchAgents/vn.xuong-phim.web.plist` (RunAtLoad, KeepAlive khi thoát lỗi, PATH gom node/claude/codex/uv/ffmpeg/tts-vi/pnpm vì launchd không đọc .zshrc, log `~/Library/Logs/xuong-phim.log`); Linux systemd user `~/.config/systemd/user/xuong-phim.service`. Cổng đã bận (EADDRINUSE): bản chạy tay thoát mã 0; bản tự mở (`XUONG_AUTOSTART=1`) đứng chờ, thử lại mỗi 10 giây, bản kia tắt là tự nhận cổng (KeepAlive luôn bật). Sửa mã máy chủ xong: chặn `/api/job` rồi `node tools/autostart.mjs restart` (launchctl kickstart -k). Codex chỉ có khi chạy thẳng (Docker không cài codex).
