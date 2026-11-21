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
    storyboard/   01-s01.jpg…, index.html, layout.json (kết quả đo chồng lấn)
    voice/        <lineId>.wav, dur.json, engine.json (commit — đọc lại tốn thời gian)
    build/        timed.json, mix.wav, bundle (không commit)
    out/          epNN.mp4, epNN.srt, drive.json {account, folderId, uploadedAt, mp4 {id, link, mtime, size}, srt {id, link}} (không commit)
```

## `brief.json` (do `tools/web/server.mjs` → `saveBrief` ghi)

`name, channel, idea, audience, platform, episodes (1–30), duration (20–180 giây), format (9:16|16:9|1:1|4:5), theme (preset), style (tinh-huong|thong-tin|ket-hop), sets[] (van-phong|nha|hang-o), tone, music (mood), characterMode (dong-nhat|moi-tap|khong), narrator (id), logo (misa|none), cta, notes, driveAuto (tự đẩy lên Drive sau khi dựng), driveFolder (tên thư mục trong "Xưởng phim", trống = tên series), updated`.

## `bible.json`

`name, slug, channel, episodes, format, fps (30), engine (remotion), theme {preset, …ghi đè}, captions, voice (giọng dẫn), narrator, characterMode, characters[], music {mood, volume}, sfx {auto, volume}, transition {type, frames}, chrome {handle, progress, tag}, pronounce {từ: cách đọc}`.

**Nhân vật** (`CharacterSpec`, `remotion/types.ts`): `id, name, gender (nam|nu), kind (misa|so-mi|vest|hoodie|ao-thun|cardigan), outfitColor, bottom (quan|vay), bottomColor, hair (nam: ngan|vuot|tia|xoan|hoi; nữ: dai|buoc|bob|bui), hairColor, skin, age (tre|trung-nien), beard, glasses, logo, voice (VieNeu), geminiVoice, villain, role`. Giọng phải đúng giới tính (`tools/voices.mjs` → `castVoices`; `check` chặn nếu sai).

## `plan.json`

`{ brief: {tóm tắt}, episodes: [{ number, id, title, logline, hook, beats[], visual, cta, duration, status }] }` — `status`: `de-xuat` → `duyet` (các trạng thái sau suy ra từ file có trong thư mục tập).

## `episode.json`

`id, number, title, logline, target (giây), characters? (ghi đè bible cho tập), music?, scenes[]`. Mỗi cảnh: `id, type (template), speaker?, pad?, lines[] {text, speaker?, say?}, props {…theo template}`. Cấu trúc từng template ở `docs/reference.md`; kiểm tra bằng `pnpm ep <dir> check` (`tools/ep.mjs`).

## Cấu hình Google Drive (ngoài repo)

`~/.config/xuong-phim/google.json` (quyền 600; đổi thư mục bằng `XUONG_CONFIG_DIR`): `{ client: {id, secret}, token: {access_token, refresh_token, expiry}, account }`. Không bao giờ trả về trình duyệt, không commit.
