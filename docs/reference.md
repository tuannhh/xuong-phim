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
  "chrome": { "handle": true, "progress": true, "tag": true }   // tag = nhãn tên series góc trên (không còn ghi "TẬP n/N")
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
  "kind": "cardigan", "outfitColor": "#B5835A", "bottom": "vay", // xem danh sách trang phục bên dưới; quan | vay
  "hair": "bui", "hairColor": "#3A2418", "skin": "#F3C6A2", "glasses": false, "age": "tre|trung-nien", "beard": false,
  "voice": "Mai Anh", "geminiVoice": "Aoede" }               // VieNeu + Gemini; bỏ trống → tự chọn giọng cùng giới, không trùng người khác
```
- **Trang phục** (`kind`, danh mục ở `shared/catalog.mjs` → `KINDS`; màu đổi bằng `outfitColor`, trừ `misa`): `misa` (polo vàng MISA, logo ngực trái) · `so-mi` · `vest` · `hoodie` · `ao-thun` · `cardigan` · `ao-dai` (áo dài cổ đứng, vạt cài chéo, tà trước/sau xẻ hông, quần ống rộng trắng — nữ có hoạ tiết hoa nhỏ; luôn mặc quần) · `vay-lien` (nữ; váy liền đai eo, phần váy cùng màu áo) · `blazer-nu` (nữ; blazer + blouse cổ tròn) · `ao-len` (cổ tròn, bo len) · `polo` (polo trơn, không logo) · `ao-khoac` (bomber khoá kéo) · `dong-phuc` (đồng phục công việc chung: đô vai, hai túi nắp, bảng tên trống — không phù hiệu/cầu vai) · `ao-so-mi-ke` (sơ mi kẻ ô, bỏ ngoài quần).
- Tóc: nam `ngan, vuot, tia, xoan, hoi, hui-cua, mai, re-ngoi, undercut, dai-buoc` · nữ `dai, buoc, bob, bui, xoa-dai, duoi-ngua, toc-ngan, mai-thua, toc-tet` (nhãn ở `HAIRS`). Tóc không đổi theo `turn`; tóc lệch (rẽ ngôi, đuôi ngựa, bím) tự lật theo `flip`.
- **Mascot** (tuỳ chọn mỗi phim — diễn viên như người, dùng được trong `actors` / `cast` / `character`):
  ```jsonc
  { "id": "khien", "name": "Khiên", "gender": "nam", "kind": "mascot", "mascot": "khien" }   // khien (khiên vàng–navy) | robot (rô-bốt trợ lý)
  { "id": "linhvat", "name": "Bé Xanh", "gender": "nu", "kind": "mascot", "mascot": "anh", "image": "series-assets/linhvat.png" } // ảnh PNG nền trong, đường dẫn trong thư mục public
  ```
  `gender` vẫn bắt buộc (chọn giọng). Cao ≈ 0,68 người khi toàn thân; đứng trên sàn (talk/character) hoặc trên mép bàn tiền cảnh (story, không ghế). Trung/cận cảnh: mascot tự kê chân trong khung (`MASCOT_GROUND`) để không bị cắt nửa dưới. Vẽ sẵn: nhún nhẹ, chớp mắt, biểu cảm lấy từ `expr` (đủ 14), miệng mở theo voice, cử chỉ tay cho chao, chi, tay-mo, giai-thich, nghi, vui, ngac-nhien, khoanh-tay, buon, dien-thoai, nghe-may, om-dau, chong-nanh, like, nhun-vai, go-phim (tay cử chỉ tự quay về người nghe); tư thế khác đứng nghỉ. Mascot ảnh: giữ tỉ lệ, nhún nhẹ, co–giãn khi nói, quay về người nghe bên trái thì lật ngang (ảnh coi như nhìn sang phải).
- **Tư thế** (`pose`): dung, chao, chi, tay-mo, giai-thich, nghi, vui, ngac-nhien, khoanh-tay, buon, dien-thoai, nghe-may, om-dau, chong-nanh, like, nhun-vai, di-bo, go-phim, dat-tay. Đổi tư thế giữa các câu → chuyển dần (khớp vai/khuỷu/cổ tay).
  Nguyên tắc vẽ tư thế: khuỷu tay ở gần thân, cử chỉ nằm ở cẳng tay + bàn tay; không giơ hai tay quá đầu, không chĩa khuỷu ngang ra ngoài. Tay mở ra ngoài thì cả cánh tay cùng đưa ra (khuỷu `OUT`, góc khuỷu rộng), không ghim bắp tay thẳng đứng rồi bẻ cẳng tay ngang. Cẳng tay luôn vẽ trước bắp tay/tay áo; bàn tay xoè nhìn từ mu, ngón cái cố định theo tay.
  **Hướng cử chỉ (máy tự lo, đừng lách):** tay đưa ngang ra (`chi`, `tay-mo`, `giai-thich`, `nhun-vai`, `ngac-nhien`) luôn ở phía nhân vật đang quay tới — bạn diễn gần nhất, hoặc giữa khung hình khi đứng một mình lệch một bên. Tư thế hai tay khi nói với bạn diễn: tay phía xa gập ra trước bụng, không mở ra sau lưng. Nên chỉ cần ghi tên tư thế, không phải chọn tay trái/phải và không dùng `flip` để "sửa" hướng tay. Thêm/sửa tư thế trong `POSES` (viết một chiều, tay chính là `R`) → chạy `pnpm series characters <slug> --huong` xem `characters-huong.png` (mọi tư thế khi quay phải/trái).
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
  "props": { "set": "hang-o",                      // xem bảng bối cảnh bên dưới; time = buổi (bỏ trống → buổi đầu)
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
- Bối cảnh (`set` · `time`, buổi đầu là mặc định; danh mục chung ở `shared/catalog.mjs`, hình ở `remotion/kit/Sets.tsx`):

  | set | Tên | time | Tiền cảnh / ghế | Ghi chú |
  |---|---|---|---|---|
  | `van-phong` | Văn phòng | ngay · chieu · toi | bàn gỗ, ghế văn phòng | `logo: true` → khung logo MISA; đồng nghiệp ngồi sau |
  | `nha` | Ở nhà | dem · ngay | bàn gỗ, sofa (không ghế) | dây đèn nháy, cửa sổ thành phố |
  | `hang-o` | Sào huyệt kẻ gian | toi | bàn tối, ghế gaming | giá điện thoại, ba màn hình |
  | `quan-ca-phe` | Quán cà phê | ngay · toi | bàn gỗ (cà phê phin, latte, bình hoa), ghế gỗ | ô kính nhìn ra phố nhà ống, xe máy chạy ngang; khách ngồi laptop phía sau |
  | `ngan-hang` | Ngân hàng (quầy giao dịch) | ngay | quầy đá viền xanh (giấy nộp tiền, bút dây, chuông, phiếu số), ghế | bảng gọi số chạy, màn hình "Không cung cấp mã OTP", vách kính + giao dịch viên phía sau |
  | `phong-hop` | Phòng họp | ngay · toi | bàn trắng bóng (sổ, loa hội nghị, chai nước), ghế lưng cao | màn hình biểu đồ, bảng trắng; `logo: true` → khung logo MISA |
  | `ngoai-troi` | Ngoài trời (công viên bờ hồ) | ngay · chieu · toi | bàn đá (trà đá, bánh mì), ghế đá tựa gỗ vẽ sẵn | mặt hồ, cây, cột đèn phố, lá rơi |
  | `cua-hang` | Cửa hàng (quầy thu ngân) | ngay | quầy trắng viền đỏ (bảng QR "Quét mã", máy quẹt thẻ, hũ kẹo), đứng quầy | kệ hàng, tủ mát |

- 1–2 nhân vật mỗi cảnh là đẹp nhất (3 người tự thu nhỏ). Văn phòng / quán cà phê / ngân hàng tự thêm người phụ ngồi phía sau ở chỗ trống (`extras: false` để tắt).
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
| `title` | title?, sub?, number? (số to chỉ hiện khi ghi rõ — không tự lấy số tập) | swoosh-up + ding |
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
| `photo` | src: "assets/x.jpg" hoặc images[{src, caption?, beat?}] (2–4 ảnh, mỗi ảnh một câu), ratio? (cao/rộng, mặc định 1), heading?, caption?, source?, fit? cover/contain, focus? [x,y], zoom? in/out/none — **ảnh thật từ tư liệu người dùng** (chép từ `.studio/tu-lieu/images/`), trôi chậm Ken Burns | camera; whoosh-soft khi đổi ảnh |
| `story` | set, time?, shot?, focus?, label?, actors[], desk[], pops[] hoặc screen — cảnh kể chuyện có bối cảnh (xem trên) | theo nhãn/mục |
| `talk` | cast[], shot?, room?, title?, bubble? — hội thoại nhiều nhân vật (xem trên) | — |
| `character` | như `talk` với một nhân vật lấy từ `character` | — |
| `outro` | cta?, handle? (`false` = bỏ nút theo dõi), logo? ("misa") — không có dòng "tập sau" (tập đứng độc lập) | chime |
| `custom` | component: "<series>/<Ten>" (viết ở remotion/custom/, đăng ký ở custom/index.ts). Có sẵn `huong-dan/ScreenTour`: src (ảnh chụp trang), w, h, kicker?, title?, steps[{beat, focus [x,y,w,h], cursor? [x,y], click?, label?}] — khung trình duyệt + máy quay zoom + con trỏ (video hướng dẫn) | click / whoosh-soft theo bước |
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

## Trang web Xưởng phim (`pnpm web`)

`pnpm web` → http://localhost:4710 (đổi cổng: `PORT=… pnpm web`). Một file máy chủ `tools/web/server.mjs`, một file giao diện `web/index.html`, không cài thêm gì.

| Trên trang | Việc xảy ra | Ai làm |
|---|---|---|
| Form "Series mới" / "Sửa đề bài" | ghi `series/<slug>/brief.json`, `brief.md`, `bible.json` (nhân vật, giọng, bộ màu, nhạc); tạo xong tự vẽ `characters.png` | máy chủ |
| Mục "Nguồn nội dung" | chọn `sourceMode` (claude / ket-hop / tu-lieu); file kéo thả lưu ở `series/<slug>/tu-lieu/tai-len/`; link Drive + đường dẫn trên máy ghi vào `brief.materials` | máy chủ (`tools/web/materials.mjs`) |
| (trước mỗi lần Claude viết, khi có tư liệu) | tải link Drive về `tu-lieu/drive/`, đọc mọi tư liệu → `.studio/tu-lieu/index.md` + `text/` + `images/` (`uv run tools/materials/extract.py`); đường dẫn trên máy được đưa cho claude bằng `--add-dir` | máy chủ |
| "Lập kế hoạch" / "Lập lại kế hoạch" | giai đoạn `plan` → `plan.json` | `claude -p` (skill series, Chế độ form) |
| "Duyệt tập này" / "Duyệt tất cả" | `plan.json`: `status: "duyet"` | máy chủ |
| "Viết kịch bản + storyboard" | giai đoạn `script <n>` → `episode.json`, `script.md`, `storyboard/` | `claude -p` |
| "Sửa lời thoại" (bước kịch bản + storyboard, và ở phim đã dựng) | sửa chữ từng câu ngay trên trang → `episode.json` (bỏ `say` cũ của câu đổi) → tự chạy `check` → `script` → `storyboard`; lần dựng sau voice chỉ đọc lại câu đổi | máy chủ, không cần Claude |
| "Sửa theo góp ý" | góp ý ghi vào `.studio/gop-y.md` → giai đoạn `fix <n>` (đã có MP4 thì dựng lại luôn) | `claude -p` |
| "Duyệt và dựng phim" / "Dựng lại" | `node tools/ep.mjs <dir> all` → `out/epNN.mp4` + `.srt`; series bật `driveAuto` → tự đẩy lên Drive sau khi dựng | máy chủ, không cần Claude |
| "Dựng lần lượt các tập đã duyệt kịch bản" (thẻ ở trang series, hiện khi ≥2 tập có kịch bản chưa dựng / kịch bản đã sửa) | xếp các tập đã chọn vào hàng đợi; máy dựng từng tập (`all`), xong tập này tự sang tập kế. Đang dựng mà bấm "Duyệt và dựng phim" tập khác → tập đó vào cuối hàng. Thanh hàng đợi: bỏ từng tập, "Tạm dừng", "Chạy tiếp", "Xoá hàng đợi". Bấm Dừng → hàng đợi tạm dừng. Hàng đợi lưu ở `~/.config/xuong-phim/queue.json`; máy chủ khởi động lại → tập dở xếp lại lên đầu, hàng đợi ở trạng thái tạm dừng chờ bấm "Chạy tiếp" | máy chủ (`tools/web/queue.mjs`) |
| Mục "Nhạc nền" (form) | "Nhạc tự sáng tác" (mood) hoặc "Nhạc của tôi": file tải lên lưu ở `series/<slug>/nhac/`, hoặc đường dẫn file/thư mục trên máy (`bible.music.path`, đọc tại chỗ); mỗi tập một bài xoay vòng theo số tập (`episode.music.file` để chọn riêng); thanh âm lượng 0–100% ↔ `bible.music.volume` 0–0,3 (40% = 0,12 mặc định) | máy chủ + `tools/music-source.mjs`, `tools/audio/mix.py` |
| Mục "Watermark" (form) | chữ và/hoặc logo (logo MISA đầy đủ hoặc ảnh tải lên `series/<slug>/assets/logo-*.png`), kéo thả vị trí trên khung xem trước, cỡ/màu chữ, kích thước logo, độ mờ riêng từng thứ → `bible.watermark`; vẽ trên mọi tập (`remotion/kit/Watermark.tsx`) | máy chủ + `shared/watermark.mjs` |
| Nút "✦ Gợi ý" (cạnh tên series, kênh, ý tưởng, khán giả, giọng điệu, lời kêu gọi, ghi chú, tên/vai nhân vật, chữ watermark, ô góp ý/lưu ý) | `POST /api/suggest` → Claude (`claude -p`) hoặc Codex (`codex exec` hộp cát chỉ đọc) theo Thiết lập AI, vai trò "suggest" (mặc định Haiku · low), không công cụ → 3 phương án, bấm để điền; không đi qua hàng việc nền | `tools/web/suggest.mjs` |
| Dựng xong (mọi cách dựng) | chép `out/epNN.mp4` + `.srt` vào thư mục phim chung `<thư mục xuất>/<tên series>/EPNN - <tiêu đề>.mp4` (`tools/output.mjs`; ghi ở `out/export.json`); gom phim cũ: `pnpm series export <slug>` | `tools/ep.mjs render` |
| Trang "Thiết lập" | thư mục phim (mặc định `~/Movies/Xưởng phim`, Linux `~/Videos/Xưởng phim`; lưu ở `~/.config/xuong-phim/settings.json`) + Google Drive: dán OAuth client (Desktop app) → "Kết nối"; "Cho phép đọc tư liệu trên Drive" xin thêm quyền `drive.readonly`; lưu ở `~/.config/xuong-phim/google.json` | máy chủ (`tools/web/drive.mjs`) |
| (bỏ) Trang "Google Drive" cũ | `#/drive` chuyển sang `#/settings` | — | (Desktop app) → "Kết nối" → đăng nhập Google; lưu ở `~/.config/xuong-phim/google.json` | máy chủ (`tools/web/drive.mjs`) |
| "Đẩy lên Drive" / "Đẩy bản mới" | tải MP4 + SRT lên `Xưởng phim/<thư mục series>/` (ghi đè cùng file, giữ link); kết quả ở `out/drive.json` | máy chủ |

- `brief.json`: `name, channel, idea, audience, platform, episodes, duration, format, theme, style (tinh-huong|thong-tin|ket-hop), sets[], tone, music, characterMode, narrator, logo (misa|none), cta, notes, sourceMode (claude|ket-hop|tu-lieu), materials[{type: drive|local, ref, note}], driveAuto, driveFolder`.
- Các nút "AI" cần lệnh `claude` đã đăng nhập trên máy (`claude` → `/login`). Chưa đăng nhập thì trang báo rõ; khi đó dán câu lệnh ở mục "Làm trong Claude Code thay vì bấm nút" vào Claude Code.
- Biến môi trường: `PORT`, `STUDIO_CLAUDE_BIN` / `STUDIO_CODEX_BIN` (đường dẫn lệnh claude / codex), `STUDIO_CLAUDE_MODEL` (model dự phòng khi Thiết lập AI để trống), `XUONG_OUTPUT_DIR` (ghi đè thư mục phim), `XUONG_CONFIG_DIR` (nơi lưu cấu hình, mặc định `~/.config/xuong-phim`).
- Tư liệu đọc được: PDF, Word .docx (.doc cũ chỉ trên macOS), PowerPoint .pptx, Excel .xlsx, CSV/TXT/MD, ảnh JPG/PNG/WEBP/GIF/BMP; tối đa 300 MB/file, 300 file/lần. Link Drive: có quyền đọc → file/thư mục riêng tư (thư mục quét 3 cấp, tối đa 200 file; Google Docs/Slides/Sheets xuất ra docx/pptx/xlsx); không có quyền đọc → chỉ file chia sẻ công khai.
- `sourceMode = tu-lieu` → `claude -p` không được dùng WebSearch/WebFetch; hai chế độ còn lại được.
- An toàn: chỉ nghe `127.0.0.1` (trong Docker nghe 0.0.0.0 nhưng cổng chỉ publish ra 127.0.0.1 của máy thật); lệnh ghi phải có header `x-xuong` và cùng nguồn; `claude -p` chạy với quyền `acceptEdits` + danh sách lệnh cho phép (pnpm ep/series, node tools/, ffmpeg, ffprobe).
