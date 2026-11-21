# Xưởng phim — series phim ngắn cho mạng xã hội

Sản xuất series phim ngắn (TikTok/Reels/Shorts) bằng Claude Code: ý tưởng → kế hoạch từng tập → kịch bản → storyboard → lời đọc tiếng Việt → chuyển động Remotion → SFX + nhạc → MP4. Hình chỉ bằng code/vector.

## Cài trên máy mới

Cần: git, Node ≥ 20 + pnpm (`corepack enable`), [uv](https://docs.astral.sh/uv/), ffmpeg, Claude Code (đã `claude` → `/login`).

```bash
git clone https://github.com/tuannhh/xuong-phim.git ~/social-series-studio
cd ~/social-series-studio
pnpm setup                         # node_modules, font, môi trường âm thanh, kho SFX
bash tools/tts-vi/install.sh       # giọng đọc VieNeu + lệnh tts-vi
mkdir -p ~/.claude/skills && ln -sfn "$PWD/skill" ~/.claude/skills/series
```

Muốn Gemini làm giọng dự phòng: điền đường dẫn file khoá vào `tools/tts-vi/config.env` (không commit).

## Dùng

- **Trang web:** `pnpm web` → http://localhost:4710 — điền đề bài, duyệt kế hoạch → kịch bản + storyboard → phim.
- **Chat:** mở Claude Code trong thư mục này, gõ `/series` + ý tưởng.

## Tài liệu

`memory-bank/` (tri thức dự án, đọc trước khi sửa) · `CLAUDE.md` · `skill/SKILL.md` · `docs/reference.md`.
