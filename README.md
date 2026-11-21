# Xưởng phim — series phim ngắn cho mạng xã hội

Sản xuất series phim ngắn (TikTok/Reels/Shorts) bằng Claude Code: ý tưởng → kế hoạch từng tập → kịch bản → storyboard → lời đọc tiếng Việt → chuyển động Remotion → SFX + nhạc → MP4. Hình chỉ bằng code/vector.

## Cài trên máy mới

Máy: macOS (Apple Silicon hoặc Intel) hoặc Linux. Windows dùng WSL.

```bash
git clone https://github.com/tuannhh/xuong-phim.git ~/social-series-studio
cd ~/social-series-studio && bash setup.sh
```

`setup.sh` tự cài mọi thứ còn thiếu (chạy lại bao nhiêu lần cũng được): Homebrew (nếu chưa có — sẽ hỏi mật khẩu máy), git, Node, pnpm, uv, ffmpeg, thư viện Node/Python, font, kho SFX, Chrome headless cho Remotion, giọng đọc VieNeu + lệnh `tts-vi`, skill `/series`, Claude Code CLI. Cuối cùng chạy `pnpm doctor` để kiểm tra. Còn một việc tự làm: đăng nhập `claude` (gõ `claude` rồi `/login`).

Mở thư mục này bằng Claude Desktop (tab Code) cũng được: nếu máy chưa cài đủ, Claude tự nhận ra (hook trong `.claude/settings.json`) và chạy `setup.sh` giúp.

Muốn Gemini làm giọng dự phòng: điền đường dẫn file khoá vào `tools/tts-vi/config.env` (không commit).

## Dùng

- **Trang web:** `pnpm web` → http://localhost:4710 — điền đề bài, duyệt kế hoạch → kịch bản + storyboard → phim; kết nối Google Drive (trang "Google Drive") để đẩy phim thành phẩm lên Drive.
- **Chat:** mở Claude Code trong thư mục này, gõ `/series` + ý tưởng.

## Tài liệu

`memory-bank/` (tri thức dự án, đọc trước khi sửa) · `CLAUDE.md` · `skill/SKILL.md` · `docs/reference.md`.
