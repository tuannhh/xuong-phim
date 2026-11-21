---
name: series
description: Sản xuất series phim ngắn cho mạng xã hội (TikTok/Reels/Shorts/YouTube) trong Xưởng series tại ~/social-series-studio — người dùng đưa ý tưởng, số tập, thời lượng, phong cách, nhân vật; Claude lập kế hoạch sơ bộ từng tập để duyệt, rồi sản xuất tập được chọn: kịch bản chi tiết, storyboard, voice tiếng Việt (VieNeu qua tts-vi), chuyển động Remotion (hoặc HyperFrames / phong cách lemo-opuscar), SFX + nhạc nền tự tổng hợp, xuất MP4. Có nhân vật MISA áo polo vàng logo MISA. Dùng khi người dùng muốn làm series video, kênh social, phim ngắn nhiều tập, "lên kế hoạch series", "sản xuất tập", "làm tập 3", "/series", hoặc sửa một tập đã làm trong xưởng.
---

# Xưởng series — quy trình

Xưởng: `~/social-series-studio` (git). Đọc `CLAUDE.md` của xưởng và `docs/reference.md` (template cảnh, tư thế nhân vật, SFX, nhạc, theme) trước khi viết file tập.
Mọi lệnh chạy từ thư mục xưởng: `pnpm series …` / `pnpm ep <thư-mục-tập> …`.

Người dùng là **người lên ý tưởng và duyệt**; Claude làm mọi phần còn lại. Người dùng có thể đưa đề bài trong chat, hoặc điền form trên trang web của xưởng (`pnpm web`, xem "Chế độ form"). Có **3 điểm duyệt** — không bỏ qua điểm nào trừ khi người dùng nói rõ "làm luôn".

## 0. Nhận brief

Cần đủ (hỏi gọn một lần những gì còn thiếu, có gợi ý mặc định):

| Mục | Mặc định nếu không nói |
|---|---|
| Ý tưởng / chủ đề series | — (bắt buộc) |
| Số tập | — (bắt buộc) |
| Thời lượng mỗi tập | 60 giây |
| Phong cách hình | theme `misa-vang` (đồ hoạ chuyển động) |
| Khung hình | 9:16 |
| **Nhân vật**: `dong-nhat` (một/bộ nhân vật xuyên suốt) · `moi-tap` (mỗi tập nhân vật khác) · `khong` | hỏi |
| Dàn nhân vật: **nhiều người, có nam có nữ**, tên + giọng cố định (nam giọng nam, nữ giọng nữ); trang phục MISA (polo vàng + logo) hoặc so-mi/vest/hoodie/cardigan… | MISA nếu nội dung về/cho MISA |
| Giọng đọc | mỗi nhân vật một giọng VieNeu + một giọng Gemini, khai trong `bible.characters` |
| Khán giả, nền tảng, kênh (@handle) | hỏi nếu ảnh hưởng nội dung |

## 1. Kế hoạch sơ bộ → DUYỆT 1

1. `pnpm series new <slug> "Tên series"` → sửa `series/<slug>/brief.md`, `bible.json`, `plan.json`.
2. `bible.json`: theme, giọng, `narrator` (id nhân vật dẫn chuyện để nhép miệng), `characters`, nhạc (mood), chuyển cảnh, `episodes` = tổng số tập.
3. `plan.json` → `episodes[]`: `number, id, title, logline, hook, beats[], visual, cta, duration, status:"de-xuat"`. Mỗi tập một góc riêng, có móc nối sang tập sau.
4. Có nhân vật → `pnpm series characters <slug>` (bảng mọi tư thế).
5. `pnpm series plan <slug>` → `plan.html`. Đăng thành Artifact (riêng tư) để người dùng xem cả trên điện thoại, kèm tóm tắt ngắn trong chat.
6. Hỏi: duyệt tập nào (một vài tập / tất cả), sửa gì. Đánh dấu `status:"duyet"`.

## 2. Kịch bản chi tiết + storyboard → DUYỆT 2

Với mỗi tập được duyệt (nhiều tập → có thể chia subagent/song song, mỗi tập một thư mục riêng):
1. `pnpm series ep <slug> <số>` → viết `episodes/epNN/episode.json` (cấu trúc ở `docs/reference.md`).
   - Câu thoại ngắn (≤ 25 chữ), viết để **nói**: tự nhiên, có nhịp; câu đầu là hook trong 3 giây.
   - Số câu khớp số mục hiện dần (vd 1 câu tiêu đề + 1 câu/mục) để hình bám lời.
   - Chữ trên màn hình ngắn hơn lời đọc; nhấn bằng `*từ*`.
   - Đổi template liên tục (không 3 cảnh liền cùng kiểu). Phim có tình huống → kể bằng **cảnh `story`** (bối cảnh nhiều lớp văn phòng/nhà/ổ lừa đảo, đổi cỡ cảnh toan/can, nhãn bật, chèn màn hình điện thoại, bảng tổng kết — xem `docs/reference.md`); đổi `shot`/`set`/`screen` liên tục để không cảnh nào đứng yên quá 2 câu. `talk` và các template thông tin dùng xen khi cần.
   - Viết tên riêng/viết tắt bình thường (MISA, GĐ, 2026…): bước voice tự chuẩn hoá lời đọc; xem `voice/loi-doc.md`.
   - Hình chỉ là **code/vector**: template có sẵn, icon Lucide, SVG tự vẽ (`figure`), cảnh custom. KHÔNG tạo ảnh/video bằng AI.
   - Không bịa số liệu. Dùng `stat` chỉ khi có nguồn thật (ghi `source`).
2. `pnpm ep <dir> check` → `pnpm ep <dir> script` (script.md) → `pnpm ep <dir> storyboard` (ảnh mỗi cảnh + index.html, thời lượng ước lượng).
3. Bước storyboard tự báo chồng lấn (`✓ bố cục…` hoặc danh sách lỗi) — phải sạch. Rồi tự xem (ghép ảnh bằng ffmpeg `tile`): logo, vùng an toàn, nhân vật có chen nhau không. Sửa rồi mới đưa.
4. Đưa người dùng: script.md + storyboard (mở `storyboard/index.html` trong browser pane hoặc đăng Artifact). Hỏi duyệt / sửa cảnh nào.

## 3. Sản xuất → DUYỆT 3

`pnpm ep <dir> all` (= voice → timing → audio → render; chạy nền vì vài phút). Từng bước khi cần:
- `voice` — tts-vi (VieNeu local → Gemini API key → Gemini Agent Platform tự chuyển). Chỉ đọc câu mới/đổi; `--force` đọc lại. Lời đọc tự chuẩn hoá (MISA → mi xa, số, ngày, viết tắt); đọc sai từ → thêm vào `bible.pronounce` hoặc `"say"` cho câu đó.
- Muốn so giọng: `pnpm ep <dir> all --gemini` → `out/<id>-gemini.mp4`.
- `timing` — thời gian thật theo voice, phụ đề, SFX tự động, `out/<id>.srt`.
- `audio` — nhạc nền (tự sáng tác theo mood, tự hạ khi có lời) + SFX + voice → −14 LUFS; độ mở miệng nhân vật.
- `render` (`--preview` nửa độ phân giải để xem nhanh) → `out/<id>.mp4`.
Kiểm tra trước khi giao: xem vài khung (ffmpeg trích ảnh ở giữa mỗi cảnh), nghe thử đầu/giữa/cuối, độ dài so `target`. Rồi gửi MP4 bằng SendUserFile (`display: render`) + SRT.
Người dùng góp ý → sửa episode.json → chạy lại từ bước bị ảnh hưởng (voice chỉ đọc lại câu đổi).

## Chế độ form (trang web của xưởng gọi)

Người dùng có thể làm việc qua trang web tại máy: `pnpm web` → http://localhost:4710. Họ điền đề bài vào form, bấm nút; trang ghi `series/<slug>/brief.json` + `bible.json` rồi gọi Claude chạy ngầm (`claude -p`) với câu lệnh dạng "…mục Chế độ form. Giai đoạn: `plan|script|fix`. Series: `<slug>`. Tập: `<n>`". Ba điểm duyệt vẫn giữ nguyên — người dùng duyệt **trên trang**, không phải trong chat.

Khi được gọi kiểu này:
- **Không có ai trả lời.** Không hỏi lại, không AskUserQuestion, không đăng Artifact, không SendUserFile, không commit, không mở trình duyệt. Thiếu thông tin → lấy mặc định ở mục 0 và ghi giả định vào `series/<slug>/.studio/ghi-chu.md` (trang hiện file này).
- **Chỉ làm đúng giai đoạn được giao rồi dừng.** Không tự làm sang điểm duyệt kế tiếp.
- Đề bài là `brief.json`: `idea, audience, platform, episodes, duration, format, theme, style, sets[], tone, music, characterMode, narrator, logo, cta, notes`. `bible.json` đã có sẵn nhân vật, giọng, bộ màu do người dùng chọn — **không đổi** nhân vật/giọng/bộ màu họ đã khai; chỉ bổ sung phần còn thiếu (`geminiVoice`, `pronounce`, nhân vật phụ thật sự cần cho một tập thì khai trong `episode.characters`).
- `brief.style`: `tinh-huong` → kể bằng cảnh `story` là chính; `thong-tin` → template thông tin (title, list, stat, compare, talk…); `ket-hop` → mở bằng tình huống `story`, chốt bằng template thông tin. `brief.sets` là bối cảnh ưu tiên. `brief.logo: "none"` → nhân vật không mặc đồng phục MISA, cảnh kết không gắn logo MISA.
- `characterMode: "moi-tap"` → mỗi tập khai dàn nhân vật riêng trong `episode.characters` (vẫn có nam có nữ, giọng đúng giới); `khong` → không dùng nhân vật, lời đọc là giọng dẫn `bible.voice`.
- Có `series/<slug>/.studio/gop-y.md` → đó là góp ý mới nhất của người dùng, làm theo.

| Giai đoạn | Việc phải làm | Dừng khi |
|---|---|---|
| `plan` | Mục 1 bước 2–5: viết `plan.json` (`brief` tóm tắt + đủ `brief.episodes` tập, `status:"de-xuat"`); giữ nguyên tập đã `duyet` hoặc đã có `episode.json` trừ khi góp ý yêu cầu đổi; `pnpm series plan <slug>` | có `plan.json` đủ tập — KHÔNG viết `episode.json` |
| `script <n>` | Mục 2 bước 1–3 cho tập n: `pnpm series ep` (nếu chưa có khung) → viết `episode.json` → `check` sạch → `script` → `storyboard` báo `✓ bố cục`; tự xem ảnh storyboard và sửa cho đạt | có `script.md` + storyboard sạch — KHÔNG đọc voice, KHÔNG render |
| `fix <n>` | Đọc `gop-y.md`, sửa `episode.json` (chỉ phần bị góp ý), `check` → `script` → `storyboard`. Nếu tập đã có `out/epNN.mp4` thì chạy tiếp `pnpm ep <dir> all` để ra bản mới (voice chỉ đọc lại câu đổi) | storyboard sạch (và MP4 mới nếu trước đó đã có MP4) |

Đẩy phim lên Google Drive do máy chủ làm (nút trên trang hoặc `driveAuto` của series) — Claude không tự gọi Drive.

Câu trả lời cuối cùng: tối đa 6 dòng tiếng Việt, câu đầy đủ — đã làm gì, giả định đã đặt, điều người dùng nên xem kỹ khi duyệt. Trang hiện nguyên văn đoạn này cho người dùng.

Gọi `/series <slug>` trong chat mà series đã có `brief.json` → dùng nó làm brief, bỏ bước hỏi ở mục 0 (phần còn lại theo quy trình thường, có Artifact/SendUserFile).

## Engine

- **remotion** (mặc định) — mọi thứ ở trên.
- **lemo-opuscar** — khi người dùng muốn phong cách nghệ thuật (sơn dầu, màu nước, ukiyo-e…; danh mục 100 phong cách ở `docs/lemo-styles.md`, cập nhật bằng `pnpm series styles`): gọi skill `lemo-opuscar:lemo-opuscar` cho tập đó với kịch bản đã duyệt; voice vẫn lấy từ `pnpm ep <dir> voice` (voice/*.wav + dur.json); xuất về `out/<id>.mp4`.
- **hyperframes** — tuỳ chọn cho tập dựng bằng HTML+GSAP; ghim phiên bản `npx hyperframes@0.9.19` (CLI đã chạy được; chưa render thử tập nào trong xưởng — lần đầu dùng phải `init` + render một cảnh ngắn trước). Dùng `build/timed.json` cho thời điểm, `build/mix.wav` cho tiếng, font ở `assets/fonts/fonts.css`.

## Giới hạn cần nói thẳng với người dùng
Không ảnh chụp/người thật; nhạc và SFX tự tổng hợp (không dùng nhạc có bản quyền); Remotion cần giấy phép công ty nếu tổ chức > 3 người dùng cho mục đích thương mại; không tự đăng lên mạng xã hội.
