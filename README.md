# Xưởng phim — series phim ngắn cho mạng xã hội

Sản xuất series phim ngắn (TikTok/Reels/Shorts) bằng Claude Code: ý tưởng → kế hoạch từng tập → kịch bản → storyboard → lời đọc tiếng Việt → chuyển động Remotion → SFX + nhạc → MP4. Hình bằng code/vector, cộng ảnh thật trong tư liệu người dùng đưa vào (không ảnh AI).

## Cài trên máy mới

Máy: macOS (Apple Silicon hoặc Intel) hoặc Linux. Windows dùng WSL.

```bash
git clone https://github.com/tuannhh/xuong-phim.git ~/social-series-studio
cd ~/social-series-studio && bash setup.sh
```

`setup.sh` tự cài mọi thứ còn thiếu (chạy lại bao nhiêu lần cũng được): Homebrew (nếu chưa có — sẽ hỏi mật khẩu máy), git, Node, pnpm, uv, ffmpeg, thư viện Node/Python, font, kho SFX, Chrome headless cho Remotion, giọng đọc VieNeu + lệnh `tts-vi`, skill `/series`, Claude Code CLI. Cuối cùng chạy `pnpm doctor` để kiểm tra. Còn một việc tự làm: đăng nhập `claude` (gõ `claude` rồi `/login`).

Mở thư mục này bằng Claude Desktop (tab Code) cũng được: nếu máy chưa cài đủ, Claude tự nhận ra (hook trong `.claude/settings.json`) và chạy `setup.sh` giúp.

Muốn Gemini làm giọng dự phòng: điền đường dẫn file khoá vào `tools/tts-vi/config.env` (không commit).

## Chạy bằng Docker (không cần cài từng phần mềm)

Cần Docker Desktop. Lần build đầu tải khoảng vài GB (VieNeu, Chrome headless, Claude CLI).

```bash
cp .env.example .env      # sửa: thư mục phim, thư mục tư liệu, mã đăng nhập Claude
docker compose up -d --build
```

Mở http://localhost:4710. Dữ liệu nằm ngoài container: `series/` (gắn từ repo), thư mục phim (`XUONG_OUTPUT_DIR`), thư mục tư liệu (`TU_LIEU_DIR`, chỉ đọc, cùng đường dẫn như máy thật), cấu hình Drive và model giọng đọc (volume Docker). Nút AI trong Docker đăng nhập bằng `CLAUDE_CODE_OAUTH_TOKEN` (lấy bằng `claude setup-token` trên máy thật) hoặc `ANTHROPIC_API_KEY`.

## Dùng

- **Trang web:** `pnpm web` (hoặc Docker) → http://localhost:4710 — điền đề bài, chọn nguồn nội dung (Claude tự tìm / kết hợp / chỉ tư liệu của bạn: kéo thả Word, PDF, PowerPoint, Excel, ảnh; dán link Google Drive; đường dẫn trên máy), duyệt kế hoạch → kịch bản + storyboard (sửa lời thoại ngay trên trang) → phim.
- **Phim thành phẩm** được gom về một chỗ: `~/Movies/Xưởng phim/<tên series>/EP01 - <tiêu đề>.mp4` (đổi ở trang "Thiết lập"). Trang Thiết lập cũng là nơi kết nối Google Drive (đẩy phim lên, lấy tư liệu về).
- **Chat:** mở Claude Code trong thư mục này, gõ `/series` + ý tưởng.

## Tài liệu

`memory-bank/` (tri thức dự án, đọc trước khi sửa) · `CLAUDE.md` · `skill/SKILL.md` · `docs/reference.md`.
