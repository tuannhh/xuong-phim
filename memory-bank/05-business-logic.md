# 05 — Luồng nghiệp vụ

## 3 điểm duyệt (không bỏ qua trừ khi chủ dự án nói "làm luôn")

1. **Kế hoạch sơ bộ** — mỗi tập: tiêu đề, logline, câu mở đầu (hook 3 giây), các ý, hình ảnh, lời kết; mỗi tập một góc riêng và đứng độc lập — không hẹn "tập sau" (chủ dự án 22/11/2026: chỉ duyệt một số tập, tự xếp lịch đăng không theo thứ tự). Duyệt → `status: "duyet"`.
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

## Hàng đợi dựng phim (2026-11-22)

- Mỗi lúc vẫn chỉ MỘT việc nền; hàng đợi chỉ chứa việc `render` (`tools/web/queue.mjs`, lưu `CONF_DIR/queue.json`).
- Vào hàng: thẻ "Dựng lần lượt các tập đã duyệt kịch bản" (chọn nhiều tập) hoặc bấm "Duyệt và dựng phim" khi máy đang bận. Bấm dựng trực tiếp một tập đang nằm trong hàng → bỏ nó khỏi hàng.
- `finish()` của mỗi việc → ghi lịch sử (`done`/`error`/`stopped`) → `pump()` lấy tập kế. Tập lỗi không chặn hàng; bấm Dừng → hàng TẠM DỪNG (người dùng muốn dừng cả loạt). Tập không còn `episode.json` → `skipped`.
- Máy chủ khởi động lại: tập đang dựng dở được xếp lại lên đầu, hàng ở trạng thái tạm dừng — không tự chạy ngầm khi người dùng không để ý.

## Chuẩn hoá lời đọc: tên miền, viết tắt tiếng Anh (2026-11-22)

- `tools/tts/normalize.mjs`: đường link tách tên miền / đường dẫn; nhãn tên miền đọc theo `TLD` (vn → "vi en", com → "com", net → "nét", www → "vê kép vê kép vê kép"…), nhãn khác: thương hiệu (`BRANDS`: misa → "mi xa", kể cả dính liền như misavpn → "mi xa vi pi en"), từ trong lexicon, còn lại đánh vần chữ cái tiếng Anh (`EN_LETTER`).
- Viết tắt tiếng Anh trong `lexicon.json` đọc theo tên chữ cái tiếng Anh: JSC "giây ét xi", APK "ây pi cây" (2026-11-25: "kây" sai chính tả → VieNeu đọc "ka-â-xơ…"; K = "cây"), QR "kiu a", URL "diu a eo", SMS "ét em ét"… "MISA JSC" giữ luật đã duyệt "Công ty Cổ phần mi xa"; "MISAJSC" dính liền → "mi xa giây ét xi".

## Watermark, nhạc nền riêng, gợi ý nội dung, tập tới 5 phút (2026-11-23)

- **Watermark** (`bible.watermark`, làm sạch ở `shared/watermark.mjs` dùng chung cho máy chủ + timing): chữ và logo độc lập — mỗi thứ bật/tắt, vị trí TÂM theo tỉ lệ khung (0..1, nên khớp mọi khung hình), độ mờ riêng; chữ có cỡ (px ở cạnh ngắn 1080), màu, đậm; logo = logo MISA đầy đủ có khẩu hiệu (giữ nguyên hình, đặt trên nền trắng) hoặc ảnh tải lên `series/<slug>/assets/logo-*`. `render.mjs` chép `series/<slug>/assets/` → `public/series-assets/`. LayoutProbe bỏ qua `[data-watermark]`. Tập muốn tắt: `episode.watermark = null`.
- **Nhạc nền riêng** (`bible.music.source = 'file'`): bài tải lên (`series/<slug>/nhac/`) + `bible.music.path` (file hoặc thư mục trên máy). `pickTrack`: `episode.music.file` nếu có, không thì xoay vòng theo số tập. `mix.py track()`: giải mã ffmpeg → lặp nối chéo 1,5 s → chuẩn RMS 0,14 (bằng nhạc tự tổng hợp, để thanh âm lượng cùng nghĩa) → vào 0,6 s, ra 2,5 s → vẫn tự hạ khi có lời. Không thấy bài nào / đọc lỗi → quay về nhạc theo mood và báo trong log.
- **Gợi ý nội dung**: nút cạnh các ô nhập gọi Claude (`claude -p --max-turns 1`, cấm công cụ) hoặc Codex (`codex exec -s read-only --ephemeral` ở thư mục tạm) theo vai trò "suggest", chỉ trả mảng JSON 3 chuỗi; không ghi file, chạy song song được với việc nền.
- **Bài đăng mạng xã hội** (`tools/web/post.mjs`): dựng xong một tập (việc `render`/`voicefix` thành công) mà tập chưa có bài hoặc kịch bản đã sửa sau lần viết → AI (vai trò `post`, gọi một lượt như "Gợi ý", không chiếm hàng việc nền, các yêu cầu xếp hàng trong tiến trình) viết bản ngắn (< 100 từ) và bản dài (< 300 từ) từ đề bài series + kế hoạch tập + lời thoại + chữ trên màn hình. Đếm từ: mỗi cụm chữ/số là một từ (hashtag tính, emoji không). Quá giới hạn → viết lại tối đa 3 lần rồi báo lỗi. Lưu `episodes/epNN/bai-dang.json` + chép `<tên phim> - Bài đăng.txt` cạnh MP4 trong thư mục phim chung; Telegram tự gửi (mỗi bản một tin để giữ → Sao chép). Dựng lại mà kịch bản không đổi thì không viết lại.
- **Thiết lập AI** (`tools/web/ai.mjs`): công cụ claude/codex + model/effort cho 5 vai trò `plan` (kế hoạch + thiết kế nhân vật), `script`, `fix`, `suggest`, `post` (bài đăng). Mặc định Claude: opus·medium / sonnet·medium / sonnet·medium / haiku·low / sonnet·low (tên tắt = luôn bản mới nhất); Codex: '' = model mặc định của Codex, effort medium (gợi ý low). Lưu theo máy (`~/.config/xuong-phim/ai.json`), không theo series.
- **Chạy bằng Codex**: `codex [--search] exec --json -s workspace-write -C <repo> [-m model] [-c model_reasoning_effort="…"] <prompt + CODEX_NOTE>` (`--search` tắt khi "chỉ dùng tư liệu"). Hộp cát macOS chặn Chrome (bẫy 24) nên Codex chỉ chạy `check`/`script`; sau đó máy chủ chạy check → script → storyboard; `storyboard/layout.json` còn lỗi hoặc check lỗi → gọi Codex sửa kèm danh sách lỗi, tối đa 2 lần; `fix` khi tập đã có MP4 → `ep all`. Log JSONL của Codex đọc bằng `codexLine` (agent_message, command_execution, file_change, web_search, turn.failed).
- **Thời lượng tập**: 20–300 giây (trước 180). Skill hướng dẫn tập dài chia 3–5 hồi, điểm nhấn mỗi ~45 giây.

## Thêm tập giữa chừng & nhân bản series (2026-11-24)
- **Đợt thêm tập** (`brief.batches[]`, id `dot-2`, `dot-3`…): số tập + nội dung cần thêm + `sourceMode` + tư liệu RIÊNG (`tu-lieu/<id>/` → `.studio/tu-lieu-<id>/`). Nhân vật, giọng, phong cách, watermark, nhạc dùng chung của series.
- Giai đoạn AI `plan-add` (vai trò "plan" ở Thiết lập AI): máy chủ tính sẵn các số tập (nối tiếp sau tập cuối; lập lại đợt thì dùng lại số của tập chưa duyệt trong đợt), AI chỉ thêm các tập đó vào `plan.json` với `batch:"<id>"`.
- **Chốt bảo vệ** (`sealBatch` trong server.mjs): chụp `plan.json` trước khi AI chạy; xong thì lấy lại nguyên trạng mọi tập ngoài đợt (dù AI sửa/xoá), chỉ nhận tập đúng số được giao, ép `batch` + `status:"de-xuat"`; cập nhật `brief/bible.episodes` + `plan.html`. Không dựa vào việc AI "nghe lời".
- `script`/`fix` một tập có `batch` → nguồn + tư liệu theo đợt đó (câu lệnh báo "thuộc đợt thêm tập"). Sửa đề bài không làm mất tập của đợt (tổng số tập không xuống dưới tập đợt lớn nhất; `batches` được giữ).
- **Nhân bản** (`cloneSeries`): bản chép độc lập — giữ bible + cấu hình brief, đổi tên/ý tưởng/khán giả/ghi chú/số tập/thời lượng/khổ; không chép kế hoạch, tập, phim, ghi chú AI, `driveAuto`/`driveFolder`; tư liệu chỉ khi chọn. `brief.clonedFrom` ghi nguồn.
