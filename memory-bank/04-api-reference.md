# 04 — API & lệnh

## A. Trang web tại máy (`tools/web/server.mjs`, cổng 4710)

Chỉ nghe `127.0.0.1`; từ chối Host khác `localhost`/`127.0.0.1`. Mọi yêu cầu không phải GET phải có header `x-xuong: 1` và (nếu có) `Origin` cùng host. Không có đăng nhập — xem `08-security-model.md`.

| Phương thức | Đường dẫn | Việc làm |
|---|---|---|
| GET | `/` | `web/index.html` |
| GET | `/files/<slug>/<đường-dẫn>` | File trong `series/<slug>/` (chặn thoát thư mục; hỗ trợ Range cho MP4) |
| GET | `/api/meta` | Theme, giọng VieNeu, khung hình, kiểu tóc, trang phục, mood nhạc, có lệnh `claude` hay không |
| GET | `/api/series` | Danh sách series (tóm tắt) |
| POST | `/api/series` | Tạo series từ form → `{ slug }` (cần `name`, `idea`; slug tự sinh, không trùng) |
| GET | `/api/series/<slug>` | Chi tiết: bible, brief, trạng thái từng tập (storyboard, lỗi bố cục, MP4, `stale`), ghi chú Claude |
| PUT | `/api/series/<slug>/brief` | Sửa đề bài (ghi lại brief.json + bible.json, giữ các trường khác của bible) |
| POST | `/api/series/<slug>/approve` | `{ episodes: [n…] }` → `status: "duyet"` |
| POST | `/api/series/<slug>/jobs` | `{ action, episode?, feedback? }` — chạy một việc nền (409 nếu đang có việc). `action`: `plan`/`script`/`fix` (Claude; series có tư liệu → bước "Chuẩn bị tư liệu" chạy trước), `render`, `storyboard` (check → script → storyboard, sau khi sửa lời thoại), `upload`, `characters` |
| GET | `/api/job?from=<n>` | Việc gần nhất + log từ dòng n |
| POST | `/api/job/stop` | Dừng việc đang chạy (SIGTERM tiến trình con / huỷ tải lên) |
| GET | `/api/doctor` | Kết quả `tools/doctor.mjs` (máy cài đủ chưa) |
| GET/PUT | `/api/settings` | Thư mục phim chung `{outputDir, defaultOutputDir, locked, canOpen, docker}`; PUT `{outputDir}` (đường dẫn tuyệt đối, `~` được; Docker → 400 vì do `.env` quyết) |
| POST | `/api/open-output` | `{slug?}` mở thư mục phim (của series) bằng Finder/xdg-open; Docker → 400 kèm đường dẫn trên máy thật |
| GET | `/api/brand/misa-logo.svg` | Logo MISA đầy đủ (header trang) |
| POST | `/api/series/<slug>/upload?name=<tên>` | Thân = byte file (không JSON) → `series/<slug>/tu-lieu/tai-len/<tên đã làm sạch>`; chỉ PDF/Word/PPTX/XLSX/CSV/TXT/MD/ảnh, ≤ 300 MB |
| DELETE | `/api/series/<slug>/upload?name=<tên>` | Bỏ một file tư liệu → trả tóm tắt tư liệu |
| GET | `/api/series/<slug>/lines?episode=<n>` | Lời thoại từng cảnh `{scenes:[{id,type,lines:[{text,speaker}]}]}` (speaker = tên nhân vật) |
| PUT | `/api/series/<slug>/lines?episode=<n>` | `{edits:[{scene, line, text}]}` → sửa chữ câu trong `episode.json` (câu đổi bỏ `say`); 409 nếu đang chạy việc cho đúng tập đó; trả `{changed}` |
| GET | `/api/drive` | `{configured, connected, canRead, account, root}` — không lộ client secret/token; `canRead` = đã cấp drive.readonly |
| PUT | `/api/drive/client` | `{json}` (nội dung file client JSON kiểu Desktop app) hoặc `{clientId, clientSecret}` |
| DELETE | `/api/drive/client` | Thu hồi token + xoá client |
| POST | `/api/drive/connect` | `{back, read?}` (`read` = xin thêm drive.readonly để lấy tư liệu; đã có thì giữ) → `{url}` trang đồng ý Google (state + PKCE, hạn 10 phút) |
| GET | `/api/drive/callback` | Google chuyển về (redirect `http://127.0.0.1:<PORT>/api/drive/callback`); kiểm `state`, đổi code lấy token, chuyển trình duyệt về `http://localhost:<PORT>/<back>?drive=ok` (hoặc `drive_err=`) |
| POST | `/api/drive/disconnect` | Thu hồi refresh token, xoá token |

`action`: `plan` / `script` / `fix` → `claude -p` (cần lệnh claude); `render` → `node tools/ep.mjs <dir> all`; `characters` → `node tools/series.mjs characters <slug>`; `upload` → đẩy MP4 + SRT của tập lên Drive (cần đã kết nối). `render` và `fix` có bước nối tiếp: nếu series bật `driveAuto`, đã kết nối và MP4 vừa đổi → tự đẩy lên Drive trong cùng việc.

## B. Lệnh dòng lệnh

```
bash setup.sh                      cài máy mới / bổ sung phần còn thiếu (= pnpm run setup)
pnpm doctor                        kiểm tra máy (--hook: cho hook Claude; --json)
pnpm web                           trang web tại máy
pnpm series new <slug> "Tên"       khung series
pnpm series plan <slug>            plan.html
pnpm series characters <slug>      characters.png
pnpm series ep <slug> <số>         khung tập
pnpm series status <slug>          trạng thái các tập
pnpm series styles                 cập nhật docs/lemo-styles.md
pnpm series export <slug>          chép mọi phim đã dựng vào thư mục phim chung
uv run tools/materials/extract.py --out <dir> <file|thư mục>…   đọc tư liệu → index.md + text/ + images/
pnpm ep <dir> check|script|storyboard|voice|timing|audio|render [--preview]|all [--gemini] [--force]|studio
pnpm typecheck
node tools/tts/test.mjs            kiểm thử bộ chuẩn hoá lời đọc
tts-vi …                           xem tools/tts-vi/README.md
```
