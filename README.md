# Xưởng phim — series phim ngắn cho mạng xã hội

Sản xuất series phim ngắn (TikTok/Reels/Shorts) bằng Claude Code: ý tưởng → kế hoạch từng tập → kịch bản → storyboard → lời đọc tiếng Việt → chuyển động Remotion → SFX + nhạc → MP4. Hình bằng code/vector, cộng ảnh thật trong tư liệu người dùng đưa vào (không ảnh AI).

## Cài trên máy mới

**Cách khuyên dùng: cài thẳng lên máy** (nhanh hơn Docker — xem bảng dưới).

| Máy | Cách cài |
|---|---|
| macOS (Apple Silicon hoặc Intel) | mở Terminal, chạy 2 lệnh dưới |
| Linux (Ubuntu/Debian) | như trên (sẽ hỏi mật khẩu để cài gói hệ thống) |
| Windows 10/11 | **chạy thẳng trên Windows, không cần WSL** — xem mục "Windows" ngay dưới. (Vẫn có thể dùng WSL2 + Ubuntu rồi chạy 2 lệnh dưới **trong thư mục nhà của Ubuntu** `~`, không clone vào `/mnt/c/…` vì chậm hơn nhiều) |

```bash
git clone https://github.com/tuannhh/xuong-phim.git ~/social-series-studio
cd ~/social-series-studio && bash start.sh
```

`start.sh` hỏi một lần: **1) chạy thẳng** (khuyên dùng, tự chạy `setup.sh` nếu máy thiếu phần mềm) hay **2) Docker**; lần sau gõ lại `bash start.sh` là mở luôn. Đổi cách chạy: `bash start.sh --chon`. Trên Windows không muốn cài WSL: bấm đúp `Mo Xuong phim (Docker - Windows).cmd` (cần Docker Desktop).

Cuối cùng `setup.sh` **dựng thử một tập mẫu ~9 giây** (`pnpm thu-may`): ra được MP4 nghĩa là cả dây chuyền (giọng đọc → âm thanh → hình → MP4) chạy được trên máy đó, kèm thời gian so với máy gốc. Chạy lại bất cứ lúc nào: `pnpm thu-may`.

Mọi thư viện đều ghim phiên bản (`pnpm-lock.yaml`, `uv.lock`, VieNeu bản 3.8.5, Remotion 4.0.290 tự tải đúng bản Chrome headless của nó) nên máy nào cài xong cũng chạy cùng một bộ mã như máy gốc.

`setup.sh` tự cài mọi thứ còn thiếu (chạy lại bao nhiêu lần cũng được): Homebrew (nếu chưa có — sẽ hỏi mật khẩu máy), git, Node, pnpm, uv, ffmpeg, thư viện Node/Python, font, kho SFX, Chrome headless cho Remotion, giọng đọc VieNeu + lệnh `tts-vi`, skill `/series`, Claude Code CLI. Cuối cùng chạy `pnpm doctor` để kiểm tra. Còn một việc tự làm: đăng nhập `claude` (gõ `claude` rồi `/login`).

Mở thư mục này bằng Claude Desktop (tab Code) cũng được: nếu máy chưa cài đủ, Claude tự nhận ra (hook trong `.claude/settings.json`) và chạy `setup.sh` giúp.

Muốn Gemini làm giọng dự phòng: điền đường dẫn file khoá vào `tools/tts-vi/config.env` (không commit).

### Windows (chạy thẳng, không WSL)

```powershell
git clone https://github.com/tuannhh/xuong-phim.git
cd xuong-phim
.\setup.cmd      # cài mọi thứ còn thiếu bằng winget (Git, Node ≥ 20, uv, ffmpeg) + pnpm, thư viện, Chrome headless, giọng VieNeu, skill /series, Claude CLI; cuối cùng dựng thử tập mẫu
.\start.cmd      # mở trang http://localhost:4710 (lần đầu hỏi chạy thẳng hay Docker; --chon để đổi)
```

Cả hai bấm đúp được. Cần Windows 10 21H1+/11 có `winget` (App Installer). `setup.cmd` chạy lại bao nhiêu lần cũng được. Nên để repo ở ổ nhanh (SSD) và ngoài thư mục bị đồng bộ/diệt virus quét liên tục. Giọng VieNeu cài vào thư mục `VieNeu-TTS` nằm cạnh thư mục xưởng (đổi bằng biến `VIENEU_DIR`; đã có `tools\tts-vi\config.env` thì dùng lại đúng thư mục đó). Bật "Tự mở khi đăng nhập máy" ở trang Thiết lập hoạt động trên Windows (tệp `.vbs` trong thư mục Startup).

Nếu Chrome headless báo thiếu `chrome-headless-shell.exe`: phần mềm diệt virus đã xoá nó — thêm `node_modules\.remotion` vào danh sách loại trừ rồi chạy lại `setup.cmd`.

## Chạy bằng Docker (không cần cài từng phần mềm)

Docker trên Mac/Windows chạy trong máy ảo nên **chậm hơn** cài thẳng. Đo trên MacBook Pro M1 Pro (22/11/2026): đọc giọng chậm ~8 lần, vẽ hình ~1,8 lần, một tập 90 giây mất ~12 phút thay vì khoảng 4–5 phút. Chỉ nên dùng khi không cài thẳng được; trên máy chủ Linux thì Docker gần như không chậm hơn.

Cần Docker Desktop. Lần build đầu tải khoảng vài GB (VieNeu, Chrome headless, Claude CLI).

```bash
cp .env.example .env      # sửa: thư mục phim, thư mục tư liệu, mã đăng nhập Claude
docker compose up -d --build
```

Mở http://localhost:4710. Dữ liệu nằm ngoài container: `series/` (gắn từ repo), thư mục phim (`XUONG_OUTPUT_DIR`), thư mục tư liệu (`TU_LIEU_DIR`, chỉ đọc, cùng đường dẫn như máy thật), cấu hình Drive và model giọng đọc (volume Docker). Nút AI trong Docker đăng nhập bằng `CLAUDE_CODE_OAUTH_TOKEN` (lấy bằng `claude setup-token` trên máy thật) hoặc `ANTHROPIC_API_KEY`.

## Dùng

- **Trang web:** `pnpm web` (hoặc Docker) → http://localhost:4710 — điền đề bài, chọn nguồn nội dung (AI tự tìm / kết hợp / chỉ tư liệu của bạn: kéo thả Word, PDF, PowerPoint, Excel, ảnh; dán link Google Drive; đường dẫn trên máy), duyệt kế hoạch → kịch bản + storyboard (sửa lời thoại ngay trên trang) → phim.
- **Thêm tập giữa chừng:** trang series → "+ Thêm tập cho series": số tập, nội dung mới, nguồn + tư liệu riêng cho đợt đó. Giữ nguyên nhân vật và cấu hình; AI chỉ lập kế hoạch tập mới (đánh số nối tiếp), tập cũ không bị đụng tới.
- **Nhân bản series:** nút "Nhân bản" → series mới độc lập, giữ nhân vật + phong cách + watermark + nhạc, đổi chủ đề, số tập, thời lượng, khổ hình.
- **Phim thành phẩm** được gom về một chỗ: `~/Movies/Xưởng phim/<tên series>/EP01 - <tiêu đề>.mp4` (đổi ở trang "Thiết lập"). Trang Thiết lập cũng là nơi kết nối Google Drive (đẩy phim lên, lấy tư liệu về).
- **AI viết kịch bản:** trang Thiết lập → chọn **Claude Code** hoặc **Codex**, model + mức suy nghĩ (effort) cho từng việc (lập kế hoạch, viết tập, sửa tập, gợi ý). Mặc định Claude: Opus medium cho kế hoạch, Sonnet medium cho viết/sửa, Haiku cho gợi ý. Danh sách model Codex lấy thẳng từ Codex trên máy (có model mới thì bấm "Cập nhật danh sách"). Codex cần `npm i -g @openai/codex` + `codex login`; chỉ dùng khi chạy thẳng (không có trong Docker).
- **Tự mở khi bật máy:** trang Thiết lập → bật "Tự mở khi đăng nhập máy" (macOS LaunchAgent / Linux systemd) — hoặc `node tools/autostart.mjs on|off|status`. Sau khi cập nhật mã: `node tools/autostart.mjs restart` (khi không có việc đang chạy).
- **Chạy ngay khi bật máy (Windows, chưa cần đăng nhập):** trang Thiết lập → "Chạy ngay khi bật máy" (Windows hỏi quyền quản trị một lần). Xưởng chạy nền bằng tài khoản của bạn, không lưu mật khẩu; điều khiển từ điện thoại bằng hai mục dưới.
- **Telegram:** tạo bot với @BotFather, dán mã vào trang Thiết lập, mở bot và gửi mã liên kết. Dựng xong / lỗi là bot nhắn kèm nút bước tiếp theo. Làm trọn quy trình trên điện thoại: `/seriesmoi` (tạo series mới, giữ nhân vật của series có sẵn), `/kehoach` (duyệt tập, góp ý kế hoạch), `/tap 11` (xem storyboard, duyệt dựng phim, góp ý sửa, đọc kịch bản), `/xem 11` (gửi phim về điện thoại), `/nhanvat`, `/suagiong 11`, `/trangthai`, `/huy`… (gõ `/giup`). Không cần Tailscale.
- **Mở xưởng từ điện thoại:** cài Tailscale trên máy và điện thoại (cùng tài khoản), đặt mật khẩu + bật "Cho phép mở từ xa" ở trang Thiết lập, rồi mở `http://<tên máy trong Tailscale>:4710` trên điện thoại. Máy không lộ ra Internet; ngồi tại máy không cần mật khẩu.
- **Video hướng dẫn:** `series/huong-dan-xuong-phim` (16:9, ảnh chụp thật của trang). Giao diện đổi → `node tools/huong-dan/chup.mjs` rồi `pnpm ep series/huong-dan-xuong-phim/episodes/ep01 all`.
- **Chat:** mở Claude Code trong thư mục này, gõ `/series` + ý tưởng.

## Tài liệu

`memory-bank/` (tri thức dự án, đọc trước khi sửa) · `CLAUDE.md` · `skill/SKILL.md` · `docs/reference.md`.
