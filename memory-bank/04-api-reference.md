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
| POST | `/api/series/<slug>/clone` | `{ name, idea, audience?, notes?, episodes, duration, format?, copyMaterials? }` → `{ slug }` — series mới độc lập: chép bible (nhân vật, watermark, nhạc…), brief (đổi các trường trên), `assets/`, `nhac/`, bảng nhân vật; plan rỗng; không chép tập/phim/ghi chú; `driveAuto` tắt; tư liệu chỉ chép khi `copyMaterials` (không thì `sourceMode` về `claude`) |
| PUT | `/api/series/<slug>/batch` | Đợt thêm tập: `{ id?, count 1–20, idea, sourceMode, materials[] }` → tạo (`dot-2`, `dot-3`…) hoặc sửa → `{ batch }`; lưu ở `brief.batches[]` |
| DELETE | `/api/series/<slug>/batch?id=` | Huỷ đợt chưa có tập trong kế hoạch (xoá cả tư liệu của đợt) |
| POST | `/api/series/<slug>/approve` | `{ episodes: [n…] }` → `status: "duyet"` |
| POST | `/api/series/<slug>/jobs` | `{ action, episode?, feedback? }` — chạy một việc nền (409 nếu đang có việc — riêng `render` khi đang bận thì xếp vào hàng đợi, trả `{ queued: <vị trí>, queue }`; 409 nếu chính tập đó đang dựng). `action`: `plan`/`plan-add` (kèm `batch`: id đợt)/`script`/`fix` (AI; series có tư liệu → bước "Chuẩn bị tư liệu" chạy trước), `render`, `voicefix` (chỉ sửa giọng: `node tools/ep.mjs <dir> voice-fix` — đọc lại câu đổi, ghép tiếng vào MP4 cũ; tự dựng đầy đủ khi hình đổi), `storyboard` (check → script → storyboard, sau khi sửa lời thoại), `upload`, `characters` |
| GET | `/api/job?from=<n>` | `{ job, queue }` — việc gần nhất + log từ dòng n; `queue = { paused, items[{slug,episode,title}], history[{slug,episode,status: done|error|stopped|skipped,title}] }` |
| POST | `/api/series/<slug>/queue` | `{ episodes: [n…] }` — thêm các tập vào hàng đợi dựng (bỏ tập đã có / đang dựng; tập chưa có `episode.json` → 400); rảnh thì bắt đầu ngay |
| DELETE | `/api/queue?slug=&episode=` | Bỏ một tập khỏi hàng đợi; không tham số → xoá cả hàng |
| POST/DELETE | `/api/series/<slug>/asset?name=&kind=logo\|mascot` | Tải lên / xoá ảnh dùng chung của series → `assets/<kind>-<tên>` (PNG/WEBP/JPG/SVG ≤ 15 MB) |
| POST/DELETE | `/api/series/<slug>/music?name=` | Tải lên / xoá nhạc nền → `nhac/` (MP3/WAV/M4A/AAC/OGG/FLAC ≤ 80 MB) |
| POST | `/api/suggest` | `{ field, context }` → `{ items: [3 chuỗi] }` — gợi ý nội dung cho một ô (`FIELDS` trong `tools/web/suggest.mjs`), chạy bằng công cụ + model của vai trò "suggest" trong Thiết lập AI; mỗi lúc một gợi ý (409 nếu đang bận) |
| POST | `/api/queue/pause` · `/api/queue/resume` | Tạm dừng / chạy tiếp hàng đợi (tạm dừng không cắt tập đang dựng) |
| POST | `/api/job/stop` | Dừng việc đang chạy (SIGTERM tiến trình con / huỷ tải lên) |
| GET | `/api/doctor` | Kết quả `tools/doctor.mjs` (máy cài đủ chưa) |
| GET/PUT | `/api/ai` | Thiết lập AI `{config:{engine, claude:{plan,script,fix,suggest:{model,effort}}, codex:{…}}, defaults, roles, status:{claude:{installed}, codex:{installed,loggedIn}}, claude:{models,efforts}}`; PUT nhận `config` (làm sạch: engine claude/codex, model `[\w.\-:[\]]{0,80}`, effort Claude trong low…max) — lưu `~/.config/xuong-phim/ai.json` |
| GET | `/api/ai/codex-models` | Danh sách model Codex `{list:[{id,label,description,efforts[],defaultEffort,isDefault}], error}` — hỏi `codex app-server` (`initialize` → `model/list`, bỏ model ẩn), giữ 10 phút; `?refresh=1` hỏi lại |
| GET/PUT | `/api/autostart` | Tự mở khi đăng nhập máy `{supported, why, on, log, self}`; PUT `{on}` → LaunchAgent `vn.xuong-phim.web` (macOS) / systemd user `xuong-phim.service` (Linux). Tắt khi chính bản chạy nền đang trả lời → chỉ xoá file, chạy tiếp tới lần khởi động lại (`stillRunning`) |
| PUT | `/api/autostart/boot` | `{on}` → Windows: tạo/gỡ tác vụ Task Scheduler "Xuong phim" chạy khi bật máy (UAC). GET `/api/autostart` có thêm `boot: {supported, on, state, logon, here, log}` |
| GET/PUT/DELETE | `/api/telegram` | Bot Telegram `{configured, bot, linked, chatName, code, notify, polling, error}`; PUT `{token}` (kiểm bằng getMe, sinh mã liên kết) hoặc `{notify: {done, error, boot}}`; DELETE = tắt bot, xoá mã |
| POST | `/api/telegram/test` · `/api/telegram/unlink` | Gửi thử · bỏ liên kết (sinh mã mới) |
| GET/PUT | `/api/remote` | Mở từ xa qua Tailscale `{on, hasPassword, ips, urls, tailscale, sessions, firewall}`; PUT `{password}` (≥ 8 ký tự, đăng xuất mọi máy) / `{on}` (Windows: mở tường lửa qua UAC nếu chưa có) |
| POST | `/api/remote/logout-all` · `/api/login` · `/api/logout` | Đăng xuất mọi thiết bị · đăng nhập từ xa `{password}` → cookie `xp_s` (HttpOnly, SameSite=Strict, 30 ngày; 5 lần sai/10 phút → 429) · đăng xuất |
| GET/PUT | `/api/settings` | Thư mục phim chung `{outputDir, defaultOutputDir, locked, canOpen, docker}`; PUT `{outputDir}` (đường dẫn tuyệt đối, `~` được; Docker → 400 vì do `.env` quyết) |
| POST | `/api/open-output` | `{slug?}` mở thư mục phim (của series) bằng Finder/xdg-open; Docker → 400 kèm đường dẫn trên máy thật |
| GET | `/api/brand/misa-logo.svg` | Logo MISA đầy đủ (header trang) |
| POST | `/api/series/<slug>/upload?name=<tên>[&batch=dot-N]` | Thân = byte file (không JSON) → `series/<slug>/tu-lieu/tai-len/<tên đã làm sạch>` (có `batch` → `tu-lieu/<id>/tai-len/`); chỉ PDF/Word/PPTX/XLSX/CSV/TXT/MD/ảnh, ≤ 300 MB |
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
pnpm ep <dir> check|script|storyboard|voice|timing|audio|render [--preview]|all [--gemini] [--force]|voice-fix|studio
pnpm typecheck
node tools/tts/test.mjs            kiểm thử bộ chuẩn hoá lời đọc
tts-vi …                           xem tools/tts-vi/README.md
```
