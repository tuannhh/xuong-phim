# Tham chiếu xưởng series

## Cấu trúc thư mục

```
series/<slug>/
  brief.md          brief người dùng đưa
  bible.json        bộ nhận diện: theme, giọng, nhân vật, nhạc, chuyển cảnh
  plan.json         kế hoạch sơ bộ các tập (+ plan.html để duyệt)
  characters.png    bảng nhân vật (pnpm series characters <slug>)
  episodes/epNN/
    episode.json    kịch bản máy đọc (nguồn duy nhất — script.md sinh ra từ đây)
    script.md       kịch bản chi tiết dạng bảng
    assets/         SVG tự vẽ cho cảnh figure
    storyboard/     ảnh mỗi cảnh + index.html
    voice/          <câu>.wav, dur.json, engines.json (máy đã đọc câu nào)
    build/          timed.json, audio.json, mix.wav, mouth.json (sinh lại được)
    out/            epNN.mp4, epNN.srt
```

## bible.json

```jsonc
{
  "name": "Tên series", "slug": "ten-series", "channel": "@kenh", "episodes": 5,
  "format": "9:16",            // 9:16 | 16:9 | 1:1 | 4:5
  "fps": 30, "engine": "remotion",
  "theme": { "preset": "misa-vang" },   // hoặc ghi đè màu: { "preset": "misa-vang", "accent": "#..." }
  "captions": "pill",          // pill | bold | none
  "voice": "Hải Đăng", "voices": { "lan": "Ngọc Huyền" },   // giọng theo nhân vật
  "narrator": "minh",          // nhân vật dẫn chuyện (nhép miệng khi đọc); null = người dẫn vô hình
  "characterMode": "dong-nhat",            // dong-nhat | moi-tap | khong
  "characters": [{ "id": "minh", "name": "Minh", "kind": "misa", "gender": "nam", "hair": "ngan", "glasses": false, "logo": true }],
  "music": { "mood": "lofi", "volume": 0.14 },   // null = không nhạc
  "sfx": { "auto": true, "volume": 0.6 },
  "transition": { "type": "slide", "frames": 12 },
  "chrome": { "handle": true, "progress": true, "tag": true }
}
```
Tập có thể ghi đè `characters`, `music`, `format`, `chrome` trong episode.json (dùng cho `characterMode: moi-tap`).

## Theme có sẵn
`misa-vang` (navy tối + vàng MISA + đỏ) · `misa-sang` (nền kem vàng, chữ than, nhấn đỏ) · `toi-cong-nghe` (đen + cyan, lưới) · `canh-bao` (đỏ sẫm, đèn rọi) · `giay-am` (giấy ấm) · `vui-tuoi` (pastel).
Font (đủ dấu tiếng Việt, OFL): **Barlow** (tiêu đề, 500–900) + **Google Sans** (nội dung/phụ đề, 400–700), JetBrains Mono (mã). Giãn dòng: tiêu đề 1.18–1.24, nội dung 1.38–1.46. Nền (`background`): gradient-blobs, grid, dots, solid, paper, spotlight.

## Nhân vật (minh hoạ phẳng, toàn thân, dáng người đầy đặn ~6 đầu: vai rộng, thân dày, tay chân to vừa phải; mỗi khối vẽ hai lượt viền → tô nên tay chân liền khối)
Khai báo trong `bible.characters` (hoặc `episode.characters` khi `characterMode: moi-tap`):
```jsonc
{ "id": "thu", "name": "Chị Thu", "gender": "nu",            // nam | nu — khoá giọng theo giới tính
  "kind": "cardigan", "outfitColor": "#B5835A", "bottom": "vay", // misa (polo vàng MISA, logo ngực trái) | so-mi | vest | hoodie | ao-thun | cardigan; quan | vay
  "hair": "bui", "hairColor": "#3A2418", "skin": "#F3C6A2", "glasses": false, "age": "tre|trung-nien", "beard": false,
  "voice": "Mai Anh", "geminiVoice": "Aoede" }               // VieNeu + Gemini; bỏ trống → tự chọn giọng cùng giới, không trùng người khác
```
- Tóc: nam `ngan, vuot, tia, xoan, hoi` · nữ `dai, buoc, bob, bui`.
- **Tư thế** (`pose`): dung, chao, chi, tay-mo, giai-thich, nghi, vui, ngac-nhien, khoanh-tay, buon, dien-thoai, nghe-may, om-dau, chong-nanh, like, nhun-vai, di-bo, go-phim, dat-tay. Đổi tư thế giữa các câu → chuyển dần (khớp vai/khuỷu/cổ tay).
  Nguyên tắc vẽ tư thế: khuỷu tay ở gần thân, cử chỉ nằm ở cẳng tay + bàn tay; không giơ hai tay quá đầu, không chĩa khuỷu ngang ra ngoài.
- **Biểu cảm** (`expr`): binh-thuong, cuoi, vui, cuoi-lon, buon, khoc, gian, ngac-nhien, so, lo-lang, nghi, nghi-ngo, tu-tin, gian-xao. Kèm cử động: cười lớn rung vai, giận lắc đầu, sợ run, buồn rũ vai.
- Tự động: chớp mắt, thở, nhép miệng theo voice, gật đầu + cử chỉ tay khi nói, nhìn về người đang nói.
- **Khung máy** (`shot`): `toan-than` · `trung-canh` (tới trên gối) · `can-canh` (tới ngực).
- Logo MISA trên áo, trên tường, ở cảnh kết: luôn là bản đầy đủ có khẩu hiệu (`MisaLogo`).
- Nhân vật cạnh nội dung: `"character": { "id": "minh", "pose": "chi", "expr": "tu-tin", "position": "left|right|center" }` → 9:16: đứng ở vùng dưới, dải phụ đề ngay trên đầu, nội dung ở trên (không vùng nào chồng nhau).

## Cảnh kể chuyện `story` (ưu tiên dùng cho phim có tình huống)
Bối cảnh nhiều lớp + nhân vật ngồi sau bàn tiền cảnh + máy quay đổi cỡ cảnh, đẩy chậm + nhãn/thẻ bật theo lời đọc + chèn màn hình điện thoại / bảng tổng kết.
Phụ đề nằm trên mặt bàn (chữ trắng viền đậm, từ trong `*…*` tô vàng, từng từ bật khi đọc tới), kèm nhãn tên người nói; câu không ghi `speaker` là lời dẫn chuyện (không nhãn tên).
```jsonc
{ "id": "s05", "type": "story", "transition": "slide",
  "props": { "set": "hang-o",                      // van-phong (time: ngay|chieu|toi, logo: true → khung logo MISA) | nha (dem|ngay) | hang-o (ổ lừa đảo)
             "shot": "toan",                       // toan | trung | can (cần focus); máy tự đẩy chậm (push, mặc định 0.035)
             "label": "Phần 3 · Sau màn hình",     // dòng vàng dưới tên tập (ẩn ở cận cảnh và cảnh màn hình)
             "actors": [{ "id": "gian", "x": 0.42, "pose": "go-phim", "expr": "gian-xao", "prop": "laptop" }],   // stand: true → không ghế
             "desk": [{ "kind": "ban-phim", "x": 0.42 }, { "kind": "lon", "x": 0.1 }],   // coc | dien-thoai | cay | giay | ban-phim | lon | tien | laptop
             "pops": [{ "kind": "chip", "text": "Cùng lúc đó…", "icon": "eye", "at": [0.42, 0.215], "on": 1, "delay": 0 },
                      { "kind": "note", "text": "*Kịch bản*\n1. Trả tiền thật", "at": [0.8, 0.37], "on": 2 }] },
  "lines": [{ "text": "Nhưng đó chỉ là *mồi nhử*." },
            { "text": "Cá cắn câu rồi!", "speaker": "gian", "expr": "gian-xao", "pose": "chi" }] }
```
- `pops[].kind`: `tag` (nhãn tròn nghiêng, `tone`: cam|vang|do|xanh) · `chip` (thẻ trắng giờ/địa điểm) · `alert` (băng đỏ cảnh báo) · `big` (chữ số cực lớn đập vào) · `note` (giấy nhớ vàng, nhiều dòng).
  Vị trí: `over: "<id nhân vật>"` (ngay trên đầu) hoặc `at: [x, y]` (0..1 theo khung). `on` = số thứ tự câu làm nhãn bật, `off` = câu làm nhãn tắt, `delay` giây.
  Vùng trống an toàn ở cảnh `toan`: dải y 0.20–0.28 (giữa khung tên tập và đầu nhân vật) và nửa khung không có nhân vật. Cận cảnh: chỉ dùng `over`.
- `screen` (thay cho pops, nền tự mờ + tối): `{ "device": "dien-thoai", "app", "sub", "avatar", "clock", "color", "items": [...] }` với mục
  `{in}` / `{out}` (tin nhắn) · `{sys}` · `{task, reward}` · `{balance, from, label}` (số tiền chạy) · `{btn, tone: do|khoa}` · `{warn}` · `{transfer, to}`; mỗi mục có `on` = số câu.
  Hoặc `{ "device": "bang", "title", "icon", "rows": [{ "text", "sub", "on" }] }` — bảng tổng kết đánh số.
- Tiếng động tự đặt theo từng nhãn/mục. Cùng bối cảnh liên tiếp → `"transition": "fade"` (như cắt máy); đổi bối cảnh → slide/wipe.
- 1–2 nhân vật mỗi cảnh là đẹp nhất (3 người tự thu nhỏ). Văn phòng tự thêm đồng nghiệp ngồi phía sau ở chỗ trống (`extras: false` để tắt).
- Tư thế hợp cảnh ngồi bàn: `go-phim`, `dat-tay`, `dien-thoai`, `nghe-may`, `tay-mo`, `giai-thich`, `chi`, `like`, `om-dau`, `vui`, `buon`.

## Cảnh hội thoại `talk`
```jsonc
{ "id": "s04", "type": "talk",
  "props": { "cast": [{ "id": "lan", "pose": "buon", "expr": "lo-lang" }, { "id": "minh", "pose": "giai-thich" }],
             "shot": "trung-canh", "room": "van-phong" },      // room: van-phong | phong-hop | nha | dem | none
  "lines": [
    { "text": "Công an *không bao giờ* gọi điện bắt chuyển tiền.", "speaker": "minh", "expr": "binh-thuong", "pose": "giai-thich" },
    { "text": "Vậy mà em suýt tin...", "speaker": "lan", "expr": "buon", "pose": "om-dau", "react": { "minh": "cuoi" } } ] }
```
Bóng thoại hiện trên đầu người đang nói (thay phụ đề trong cảnh này). 1–3 nhân vật; 3 người nên dùng `toan-than`.

## episode.json

```jsonc
{
  "id": "ep01", "number": 1, "title": "…", "logline": "…", "target": 60,
  "scenes": [
    {
      "id": "s01", "type": "hook",                       // template, xem bảng dưới
      "props": { … },                                     // tuỳ template
      "character": { "id": "minh", "pose": "chao", "position": "right" },   // tuỳ chọn
      "lines": ["Câu đọc 1", { "text": "Câu 2", "say": "cách đọc nếu máy đọc sai", "speaker": "lan", "pause": 0.4 }],
      "transition": "slide",       // vào cảnh này: slide | slide-up | wipe | zoom | flip | fade | none
      "gap": 0.18, "pad": 0.45,    // giây nghỉ giữa câu / cuối cảnh (mặc định; bible cũng đặt được)
      "hold": 2.5,                 // cảnh không lời: giữ bao lâu
      "sfx": [{ "at": "line:2", "name": "cash", "vol": 0.8 }],   // at: start | end | line:N | <giây trong cảnh>
      "sfxAuto": true
    }
  ]
}
```
Nhấn mạnh chữ trên màn hình: `*từ*` màu nhấn · `_từ_` màu nhấn 2 · `==từ==` bút dạ quang · `~~từ~~` gạch đỏ · `\n` xuống dòng.
Mục hiện dần theo lời: số câu = số mục + 1 → câu đầu là tiêu đề, mỗi câu sau hiện một mục; số câu = số mục → mỗi câu một mục; hoặc đặt `"beat": <chỉ số câu>` cho từng mục.

## Template cảnh (`type`)

| type | props | SFX tự động |
|---|---|---|
| `hook` | text, kicker?, icon?, sub? | impact |
| `title` | title?, sub?, number? | swoosh-up + ding |
| `bullets` | heading, kicker?, items[{text, icon?, tone?, beat?}], numbered? | pop mỗi mục |
| `stat` | value, prefix?, suffix?, decimals?, label, source?, icon? | riser + impact |
| `quote` | text, author?, role? | — |
| `compare` | heading?, left{title, items[], tone}, right{…} | tick |
| `steps` | heading?, steps[{title, text?, icon?}] | pop |
| `icons` | heading?, items[{icon, label, tone?, beat?}], cols? (1 = hàng ngang) | pop-high |
| `chart` | heading?, unit?, bars[{label, value, highlight?}] | tick |
| `kinetic` | phrases? (mặc định = lời đọc) | tick |
| `chat` | heading?, name, status?, avatar?, messages[{from: them/me, text, link?, warn?}], warnLabel? | bubble/send, error khi warn |
| `phone` | mode: call → caller, number, label, avatar · mode: notify → time, notifications[{app, icon, color, title, text, warn?}] | ring / notify |
| `alert` | title, items[], icon?, kicker? | alarm + tick |
| `figure` | src: "assets/x.svg", heading?, caption?, draw? (nét tự vẽ) | draw |
| `story` | set, time?, shot?, focus?, label?, actors[], desk[], pops[] hoặc screen — cảnh kể chuyện có bối cảnh (xem trên) | theo nhãn/mục |
| `talk` | cast[], shot?, room?, title?, bubble? — hội thoại nhiều nhân vật (xem trên) | — |
| `character` | như `talk` với một nhân vật lấy từ `character` | — |
| `outro` | cta?, handle?, next?, logo? ("misa") | chime |
| `custom` | component: "<series>/<Ten>" (viết ở remotion/custom/, đăng ký ở custom/index.ts) | — |
Mọi template nhận thêm `bg: { variant, tint }` để đổi nền riêng cảnh. Icon: tên Lucide (kebab-case, vd `shield-check`) hoặc emoji.

## SFX (assets/sfx — tự tổng hợp, `uv run tools/audio/sfx_bank.py`)
whoosh, whoosh-soft, swoosh-up, pop, pop-high, pop-soft, tick, click, bubble, send, notify, ding, chime, impact, boom, riser, ring, alarm, error, success, glitch, typing, cash, draw, camera.

## Nhạc nền (`music.mood`)
lofi (78 bpm, ấm) · upbeat (112, vui khoẻ) · tension (92, hồi hộp — cảnh báo) · inspire (96, truyền cảm hứng) · playful (104, tinh nghịch) · calm (70, nhẹ nhàng). Cùng mood + số tập → cùng bản nhạc (ổn định khi render lại).

## Lời đọc (TTS) — chữ hiển thị ≠ lời máy đọc
`pnpm ep <dir> voice` tự chuẩn hoá lời đọc từ `text` (phụ đề giữ nguyên) theo bộ quy tắc VOICE_OFF_TTS_RULES v5 (`tools/tts/`):
năm (2026 → hai không hai sáu), ngày tháng, số lượng (mốt/tư/lăm/linh), thập phân, %, tăng/giảm, số hiệu văn bản, giờ, tiền, tỷ lệ, số điện thoại/OTP,
từ viết tắt nội bộ đã duyệt (GĐ, HĐQT, AMIS → A mít…), tên tổ chức (VCCA, VINASA…), **MISA → "mi xa"**. Riêng VieNeu có thêm từ tiếng Anh hay gặp (Zalo, OTP, link…) — `tools/tts/lexicon.json`.
Bảng soát: `voice/loi-doc.md`. Từ riêng của series: `bible.pronounce: { "Từ": "cách đọc" }`. Ghi đè từng câu: `"say"`. Kiểm thử: `node tools/tts/test.mjs`.

## Bản voice Gemini để so sánh
`pnpm ep <dir> all --gemini` → `voice-gemini/`, `build-gemini/`, `out/<id>-gemini.mp4` (giọng `geminiVoice` từng nhân vật, cùng hình/nhạc/SFX).
Giọng Gemini nam: Charon, Puck, Orus, Iapetus, Fenrir… · nữ: Kore, Aoede, Leda, Despina, Zephyr…

## Bố cục không chồng lấn
Nội dung tự thu nhỏ nếu tràn hộp. Storyboard đo từng dòng chữ và thân nhân vật, báo `chữ đè chữ / chữ đè nhân vật / tràn khung` (storyboard/layout.json) — phải sạch trước khi đưa duyệt.

## Phong cách lemo-opuscar
Danh mục đầy đủ (100 phong cách, tự sinh): `docs/lemo-styles.md` — cập nhật bằng `pnpm series styles` khi thư viện ~/lemo-opuscar có bản mới.

## Giọng VieNeu hay dùng
Bắc: Hải Đăng (nam, mặc định), Mai Anh (nữ, tin tức), Trúc Ly (nữ), Thiện Minh (nam, kể chuyện), Ngọc Huyền (nữ), Adam bựa (nam, vui). Trung: Quang Sơn, Ngọc Trân. Nam: Thùy Dung, Thái Sơn, Minh Triết, Mỹ Duyên. Danh sách đủ: `tts-vi --voices`.

## Trang web của xưởng (`pnpm web`)

`pnpm web` → http://localhost:4710 (đổi cổng: `PORT=… pnpm web`). Một file máy chủ `tools/web/server.mjs`, một file giao diện `web/index.html`, không cài thêm gì.

| Trên trang | Việc xảy ra | Ai làm |
|---|---|---|
| Form "Series mới" / "Sửa đề bài" | ghi `series/<slug>/brief.json`, `brief.md`, `bible.json` (nhân vật, giọng, bộ màu, nhạc); tạo xong tự vẽ `characters.png` | máy chủ |
| "Lập kế hoạch" / "Lập lại kế hoạch" | giai đoạn `plan` → `plan.json` | `claude -p` (skill series, Chế độ form) |
| "Duyệt tập này" / "Duyệt tất cả" | `plan.json`: `status: "duyet"` | máy chủ |
| "Viết kịch bản + storyboard" | giai đoạn `script <n>` → `episode.json`, `script.md`, `storyboard/` | `claude -p` |
| "Sửa theo góp ý" | góp ý ghi vào `.studio/gop-y.md` → giai đoạn `fix <n>` (đã có MP4 thì dựng lại luôn) | `claude -p` |
| "Duyệt và dựng phim" / "Dựng lại" | `node tools/ep.mjs <dir> all` → `out/epNN.mp4` + `.srt`; series bật `driveAuto` → tự đẩy lên Drive sau khi dựng | máy chủ, không cần Claude |
| Trang "Google Drive" | dán OAuth client (Desktop app) → "Kết nối" → đăng nhập Google; lưu ở `~/.config/xuong-phim/google.json` | máy chủ (`tools/web/drive.mjs`) |
| "Đẩy lên Drive" / "Đẩy bản mới" | tải MP4 + SRT lên `Xưởng phim/<thư mục series>/` (ghi đè cùng file, giữ link); kết quả ở `out/drive.json` | máy chủ |

- `brief.json`: `name, channel, idea, audience, platform, episodes, duration, format, theme, style (tinh-huong|thong-tin|ket-hop), sets[], tone, music, characterMode, narrator, logo (misa|none), cta, notes, driveAuto, driveFolder`.
- Các nút "AI" cần lệnh `claude` đã đăng nhập trên máy (`claude` → `/login`). Chưa đăng nhập thì trang báo rõ; khi đó dán câu lệnh ở mục "Làm trong Claude Code thay vì bấm nút" vào Claude Code.
- Biến môi trường: `PORT`, `STUDIO_CLAUDE_BIN` (đường dẫn lệnh claude), `STUDIO_CLAUDE_MODEL` (model cho bước sáng tác).
- An toàn: chỉ nghe `127.0.0.1`; lệnh ghi phải có header `x-xuong` và cùng nguồn; `claude -p` chạy với quyền `acceptEdits` + danh sách lệnh cho phép (pnpm ep/series, node tools/, ffmpeg, ffprobe).
