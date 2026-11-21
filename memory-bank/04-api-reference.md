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
| POST | `/api/series/<slug>/jobs` | `{ action, episode?, feedback? }` — chạy một việc nền (409 nếu đang có việc) |
| GET | `/api/job?from=<n>` | Việc gần nhất + log từ dòng n |
| POST | `/api/job/stop` | Dừng việc đang chạy (SIGTERM) |

`action`: `plan` / `script` / `fix` → `claude -p` (cần lệnh claude); `render` → `node tools/ep.mjs <dir> all`; `characters` → `node tools/series.mjs characters <slug>`.

## B. Lệnh dòng lệnh

```
pnpm setup                         cài lần đầu (node_modules, font, venv Python, kho SFX)
pnpm web                           trang web tại máy
pnpm series new <slug> "Tên"       khung series
pnpm series plan <slug>            plan.html
pnpm series characters <slug>      characters.png
pnpm series ep <slug> <số>         khung tập
pnpm series status <slug>          trạng thái các tập
pnpm series styles                 cập nhật docs/lemo-styles.md
pnpm ep <dir> check|script|storyboard|voice|timing|audio|render [--preview]|all [--gemini] [--force]|studio
pnpm typecheck
node tools/tts/test.mjs            kiểm thử bộ chuẩn hoá lời đọc
tts-vi …                           xem tools/tts-vi/README.md
```
