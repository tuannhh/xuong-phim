# 03 — Dữ liệu (không có cơ sở dữ liệu)

Xưởng **không dùng CSDL**. Mọi dữ liệu là file JSON trong `series/<slug>/`, đọc/ghi bằng `readJSON`/`writeJSON` (`tools/lib.mjs`). Không có migration; khi đổi cấu trúc JSON phải giữ tương thích với file cũ (đọc có giá trị mặc định) hoặc tự chuyển đổi dữ liệu mẫu.

## Cây thư mục một series

```
series/<slug>/
  brief.json      đề bài từ form web (nguồn chính khi có)
  brief.md        bản đọc cho người (sinh từ brief.json, hoặc viết tay)
  bible.json      bộ nhận diện: nhân vật, giọng, theme, nhạc, chuyển cảnh
  plan.json       kế hoạch các tập
  plan.html       trang duyệt kế hoạch (sinh bởi `pnpm series plan`)
  characters.png  bảng nhân vật (sinh bởi `pnpm series characters`)
  .studio/        ghi-chu.md (giả định của Claude), gop-y.md (góp ý mới nhất, không commit), drive.json (id thư mục Drive của series trên tài khoản đang kết nối, không commit)
  episodes/epNN/
    episode.json  NGUỒN DUY NHẤT của tập
    script.md     kịch bản đọc được (sinh)
    bai-dang.json bài đăng mạng xã hội {short, long, at, src (mtime episode.json lúc viết → biết kịch bản đã sửa), engine, model} — AI viết sau khi dựng (tools/web/post.mjs)
    storyboard/   01-s01.jpg…, index.html, layout.json (kết quả đo chồng lấn)
    voice/        <lineId>.wav, dur.json, engine.json (commit — đọc lại tốn thời gian)
    build/        timed.json, mix.wav, bundle, epNN.srt (timing ghi; chỉ chép sang out/ khi dựng xong — bấm dừng giữa chừng thì phụ đề cũ trong out/ vẫn khớp phim cũ), rendered.json (không commit)
    out/          epNN.mp4 (vẽ ra epNN.dang-dung.mp4 rồi mới đổi tên đè bản cũ), epNN.srt, export.json (đích đã chép ra thư mục phim chung), drive.json {account, folderId, uploadedAt, mp4 {id, link, mtime, size}, srt {id, link}} (không commit)
```

## `brief.json` (do `tools/web/server.mjs` → `saveBrief` ghi)

`name, channel, idea, audience, platform, episodes (1–30), duration (20–180 giây), format (9:16|16:9|1:1|4:5), theme (preset), style (tinh-huong|thong-tin|ket-hop), sets[] (id trong SETS của `shared/catalog.mjs`: van-phong|nha|hang-o|quan-ca-phe|ngan-hang|phong-hop|ngoai-troi|cua-hang|cong-an), tone, music (mood), characterMode (dong-nhat|moi-tap|khong), narrator (id), logo (misa|none), cta, notes, driveAuto (tự đẩy lên Drive sau khi dựng), driveFolder (tên thư mục trong "Xưởng phim", trống = tên series), updated`.

## `bible.json`

`name, slug, channel, episodes, format, fps (30), engine (remotion), theme {preset, …ghi đè}, captions, voice (giọng dẫn), narrator, characterMode, characters[], music {mood, volume}, sfx {auto, volume}, transition {type, frames}, chrome {handle, progress, tag}, pronounce {từ: cách đọc}`.

**Nhân vật** (`CharacterSpec`, `remotion/types.ts`): `id, name, gender (nam|nu), kind (misa|so-mi|vest|hoodie|ao-thun|cardigan), outfitColor, bottom (quan|vay), bottomColor, hair (nam: ngan|vuot|tia|xoan|hoi; nữ: dai|buoc|bob|bui), hairColor, skin, age (tre|trung-nien), beard, glasses, logo, voice (VieNeu), geminiVoice, villain, role`. Giọng phải đúng giới tính (`tools/voices.mjs` → `castVoices`; `check` chặn nếu sai).

## `plan.json`

`episodes[].scriptOk` = mtime (ms) của `episode.json` lúc bấm duyệt kịch bản (chế độ duyệt toàn bộ). `episode.json` sửa sau đó (mtime > scriptOk + 1 s) → tập về "chờ duyệt". Bấm dựng / sản xuất một tập = coi như đã duyệt.

## Ngoài repo: `~/.config/xuong-phim/social.json` + `social-posts.json` (tools/web/social.mjs)

- `social.json` (quyền 600): `apps.meta {id, secret, config?}` · `apps.tiktok {key, secret}` (YouTube dùng OAuth client trong `google.json` của Drive) · `accounts[] {key: meta:<user>|yt:<channel>|tt:<open_id>, platform, name, connected, token, expiry?, broken?, dests[] {id: fb:<page>|ig:<ig-user>|yt:<channel>|tt:<open_id>, kind, name, ref, token? (token Trang)}}`.
- `social-posts.json`: `posts[] {id, slug, episode, dest, kind, destName, caption, title?, privacy?, tiktok? {mode: direct|inbox, privacy, comment, duet, stitch, brand}, at (ms, null = đăng ngay), status: queued|scheduled|posting|done|error|canceled|missed, created, started, ended, error, url, remoteId, note, video {mtime, size}}` — giữ 2000 bài gần nhất.

`{ brief: {tóm tắt}, episodes: [{ number, id, title, logline, hook, beats[], visual, cta, duration, status }] }` — `status`: `de-xuat` → `duyet` (các trạng thái sau suy ra từ file có trong thư mục tập).

## `episode.json`

`id, number, title, logline, target (giây), characters? (ghi đè bible cho tập), music?, scenes[]`. Mỗi cảnh: `id, type (template), speaker?, pad?, lines[] {text, speaker?, say?}, props {…theo template}`. Cấu trúc từng template ở `docs/reference.md`; kiểm tra bằng `pnpm ep <dir> check` (`tools/ep.mjs`).

## Cấu hình Google Drive (ngoài repo)

`~/.config/xuong-phim/google.json` (quyền 600; đổi thư mục bằng `XUONG_CONFIG_DIR`): `{ client: {id, secret}, token: {access_token, refresh_token, expiry}, account }`. Không bao giờ trả về trình duyệt, không commit.
