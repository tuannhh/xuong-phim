# 05 — Luồng nghiệp vụ

## 3 điểm duyệt (không bỏ qua trừ khi chủ dự án nói "làm luôn")

1. **Kế hoạch sơ bộ** — mỗi tập: tiêu đề, logline, câu mở đầu (hook 3 giây), các ý, hình ảnh, lời kết; mỗi tập một góc riêng, có móc sang tập sau. Duyệt → `status: "duyet"`.
2. **Kịch bản + storyboard** — `episode.json` → `check` → `script.md` → storyboard (ảnh mỗi cảnh). Storyboard phải báo `✓ bố cục` (không chữ đè chữ / đè nhân vật / tràn khung).
3. **Phim** — voice → timing → audio → render → MP4 + SRT. Góp ý → sửa `episode.json` → chạy lại từ bước bị ảnh hưởng (voice chỉ đọc câu mới/đổi).

## Trang web gọi Claude ("Chế độ form" trong `skill/SKILL.md`)

- Trang ghi đề bài (`brief.json`) và góp ý (`.studio/gop-y.md`), rồi chạy `claude -p "<prompt>"` với prompt nêu giai đoạn `plan` / `script <n>` / `fix <n>` (`promptFor` trong `server.mjs`).
- Claude không hỏi lại, không Artifact/SendUserFile/commit, làm đúng một giai đoạn rồi dừng; giả định ghi vào `.studio/ghi-chu.md`; câu trả lời cuối ≤ 6 dòng (trang hiện nguyên văn).
- Claude **không đổi** nhân vật/giọng/bộ màu người dùng đã chọn trong form.
- `style`: `tinh-huong` → cảnh `story`; `thong-tin` → template thông tin; `ket-hop` → mở bằng tình huống, chốt bằng thông tin. `logo: none` → không đồng phục/logo MISA.
- Dựng phim không cần Claude: máy chủ chạy thẳng `tools/ep.mjs … all`.

## Viết kịch bản (quy tắc nội dung)

- Câu thoại ≤ 25 chữ, viết để nói; câu đầu là hook trong 3 giây.
- Số câu khớp số mục hiện dần để hình bám lời; chữ trên màn hình ngắn hơn lời đọc; nhấn bằng `*từ*`.
- Đổi template/cỡ cảnh liên tục, không cảnh nào đứng yên quá 2 câu.
- Không bịa số liệu; `stat` phải có `source`.
- Mỗi tập có cả nhân vật nam và nữ; giọng khoá theo giới tính.

## Thời gian & âm thanh

- `shared/reveal.mjs` (`revealTimes`, `storyTimes`) quyết định khi nào mục hiện ra — dùng chung cho hình **và** SFX để luôn khớp.
- `timing.mjs` tính thời gian thật theo độ dài voice (`dur.json`), thêm `pad` mỗi cảnh, sinh phụ đề (từ được nói sáng dần, từ nhấn màu vàng), đặt SFX tự động, xuất SRT.
- `mix.py`: nhạc theo mood (tự hạ khi có lời) + SFX + voice → −14 LUFS; tính độ mở miệng từng nhân vật theo khung hình. Lời dẫn chuyện (dòng không có speaker) không làm nhân vật nhép miệng.

## Đẩy phim lên Google Drive

1. Một lần cho mỗi máy: trang "Google Drive" → dán OAuth client (Desktop app, tạo trong Google Cloud) → "Kết nối" → đăng nhập Google, cho phép quyền Drive.
2. Mỗi series: form đề bài mục 6 — bật "Tự đẩy lên Google Drive mỗi khi dựng xong phim", đặt tên thư mục (trống = tên series).
3. Phim nằm ở `Xưởng phim/<thư mục series>/EPNN - <tiêu đề>.mp4` (+ `.srt`). Dựng lại rồi đẩy → **ghi đè cùng file** (link chia sẻ giữ nguyên). File/thư mục bị xoá trên Drive → tự tạo lại. Đổi tài khoản → tạo file mới ở Drive mới.
4. Trang so `mtime`+`size` của MP4 với `out/drive.json` để báo "Bản trên Drive cũ hơn phim hiện tại".

## Nguồn nội dung & tư liệu người dùng (2026-11-22)

- `brief.sourceMode`: `claude` (mặc định — Claude tự tìm, được WebSearch/WebFetch) · `ket-hop` (tư liệu là nguồn chính, Claude tìm thêm) · `tu-lieu` (chỉ tư liệu — máy chủ KHÔNG cho claude dùng WebSearch/WebFetch; mọi sự kiện/số liệu phải có trong tư liệu).
- Tư liệu có 3 loại: file kéo thả trên form (`series/<slug>/tu-lieu/tai-len/`), đường dẫn trên máy (`brief.materials[type=local]`, đưa cho claude bằng `--add-dir`), link Google Drive (`brief.materials[type=drive]`, tải về `tu-lieu/drive/`; có quyền drive.readonly → file/thư mục riêng tư, không có → chỉ link công khai).
- Mỗi lần bấm nút cho Claude viết (plan/script/fix) ở chế độ khác `claude`: máy chủ chạy bước "Chuẩn bị tư liệu" trong cùng việc (dừng được): tải Drive → `uv run tools/materials/extract.py` → `.studio/tu-lieu/index.md` + `text/NN-*.md` + `images/NN-*-K.jpg` (ảnh ≥ 240 px, cạnh dài ≤ 2000 px). Nguồn không đổi thì dùng lại. Một file lỗi không làm hỏng cả bộ; chế độ `tu-lieu` mà không lấy được tư liệu nào → dừng việc, báo người dùng.
- Claude (mục "Tư liệu" trong skill) đọc index trước, chọn phần hợp với tập, viết lại cho nói; ảnh tư liệu chép vào `episodes/epNN/assets/` và dùng cảnh `photo` (`ratio` = cao/rộng ảnh). Không dùng ảnh lộ thông tin nhạy cảm. Ghi nguồn đã dùng vào `ghi-chu.md`.

## Sửa lời thoại trên trang (2026-11-22)

- Ở bước duyệt kịch bản + storyboard (và ở phim đã dựng), mục "Sửa lời thoại" hiện từng cảnh (ảnh storyboard + các câu). Lưu → `PUT /lines` chỉ đổi `text` của câu (câu đổi bỏ `say` cũ vì đó là cách đọc của câu cũ) → tự chạy việc `storyboard` (check → script → storyboard).
- Không cần Claude. Lần dựng sau, `voice` chỉ đọc lại câu đổi (chữ ký giọng theo nội dung câu).
- Đổi cảnh/hình/nhân vật vẫn dùng "Góp ý để sửa" (Claude).

## Thư mục phim chung (2026-11-22)

- `tools/ep.mjs render` (cả `all`) dựng xong → chép `out/epNN.mp4` + `.srt` sang `<thư mục phim>/<tên series>/EPNN - <tiêu đề>.mp4` (`tools/output.mjs`, sao chép kiểu clone trên APFS nên không tốn thêm chỗ). Bản `--preview` và `--gemini` không chép. Đổi tiêu đề → xoá bản cũ do xưởng chép (nhớ ở `out/export.json`).
- Thư mục: `XUONG_OUTPUT_DIR` (Docker) → `~/.config/xuong-phim/settings.json` (trang Thiết lập) → mặc định `~/Movies/Xưởng phim` (Linux `~/Videos/Xưởng phim`).
- Phim đã dựng trước đó: `pnpm series export <slug>`.
