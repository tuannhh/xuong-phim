# 08 — Bảo mật

## Khoá & dữ liệu nhạy cảm

- Không chép khoá Gemini / service account vào repo. `tools/tts-vi/config.env` chỉ **trỏ** tới file khoá có sẵn trên máy và đã gitignore; mẫu `config.example.env` để trống.
- Không gửi email/tên người dùng ra dịch vụ bên ngoài.
- Logo MISA (`assets/brand/`) là tài sản thương hiệu: giữ nguyên hình. Repo GitHub để **riêng tư**.

## Trang web tại máy (quyết định có chủ đích)

| Điểm | Thiết kế | Lý do |
|---|---|---|
| Đăng nhập | **Không có** | Công cụ một người dùng, chỉ chạy tại máy |
| Nghe mạng | Chỉ `127.0.0.1`; Host phải là `localhost`/`127.0.0.1` | Máy khác trong mạng không vào được; chống DNS rebinding |
| Ghi (POST/PUT) | Bắt buộc header `x-xuong: 1` + Origin cùng host | Trang web lạ không gọi lén được (CSRF) |
| File | `/files/<slug>/…` kiểm slug bằng regex + `path.resolve` phải nằm trong `series/<slug>/` | Chống đọc file ngoài thư mục |
| Dữ liệu form | Lọc theo danh sách giá trị hợp lệ, cắt độ dài, màu phải `#RRGGBB` | Không tin dữ liệu client |
| Giao diện | Mọi chữ qua `textContent` | Chống XSS từ nội dung Claude viết |

**Không được** mở cổng ra ngoài (đổi sang `0.0.0.0`, port-forward, tunnel) khi chưa thêm đăng nhập.

## Claude chạy ngầm (`claude -p`)

- Quyền: `--permission-mode acceptEdits` + `--allowedTools` giới hạn: Read, Write, Edit, Glob, Grep, Skill, `pnpm ep|series|typecheck`, `node tools/…`, `ffmpeg`, `ffprobe`, `ls`, `cat`, `mkdir`.
- Chạy trong thư mục xưởng; nhận góp ý qua file (`.studio/gop-y.md`), không ghép thẳng góp ý vào dòng lệnh.
- Khi trang được mở từ trong một phiên Claude Code (ứng dụng desktop), máy chủ bỏ các biến `CLAUDE*`/`ANTHROPIC_BASE_URL` của phiên đó để `claude -p` dùng đăng nhập riêng của máy.

## Google Drive

- Quyền xin duy nhất: `https://www.googleapis.com/auth/drive.file` — xưởng chỉ thấy/sửa file do chính nó tạo, không đọc được file khác trong Drive.
- OAuth kiểu ứng dụng máy tính: redirect loopback `http://127.0.0.1:<PORT>/api/drive/callback`, `state` ngẫu nhiên dùng một lần (hạn 10 phút) + PKCE S256. Callback là GET nhưng an toàn vì phải khớp `state`.
- Client secret + refresh token lưu `~/.config/xuong-phim/google.json` (thư mục 700, file 600, ghi nguyên tử), ngoài repo; API chỉ trả về `configured/connected/account`.
- Chỉ tải lên file trong `series/<slug>/episodes/epNN/out/` (đường dẫn do máy chủ tự ghép, không nhận đường dẫn từ trình duyệt). Ngắt kết nối = gọi revoke của Google + xoá token.
- Refresh token bị thu hồi/hết hạn (`invalid_grant`) → xoá token, báo người dùng kết nối lại. Ứng dụng OAuth để chế độ "Testing" với tài khoản ngoài tổ chức thì refresh token hết hạn sau 7 ngày — dùng "Internal" (Workspace) hoặc publish ứng dụng (quyền drive.file không cần Google thẩm định).

## Tư liệu & thư mục phim (2026-11-22)

| Điểm | Thiết kế |
|---|---|
| Tải file lên | Header `x-xuong` + cùng nguồn như mọi lệnh ghi; tên file làm sạch (bỏ `/ \ : * ? " < > |`, ký tự điều khiển, dấu chấm đầu) → không thoát thư mục; chỉ nhận đuôi tài liệu/ảnh (không SVG/HTML để khỏi chạy mã khi xem qua `/files`); ≤ 300 MB, ghi `.part` rồi đổi tên |
| Tư liệu riêng tư | `series/*/tu-lieu/`, `series/*/.studio/tu-lieu/` đã gitignore — không lên GitHub. Ảnh Claude chọn đưa vào `episodes/*/assets/` thì có commit (repo riêng tư) |
| Drive đọc | Quyền `drive.readonly` chỉ xin khi người dùng bấm; không có thì chỉ tải link công khai (gửi tới Google đúng id file người dùng dán) |
| Đường dẫn trên máy | Phải tuyệt đối; claude chỉ được đọc thêm đúng các thư mục đó (`--add-dir`), quyền ghi vẫn giới hạn trong repo theo `acceptEdits` |
| Chế độ "chỉ tư liệu" | Bỏ WebSearch/WebFetch khỏi danh sách công cụ của claude (không chỉ dặn trong câu lệnh) |
| Thư mục phim | Đường dẫn tuyệt đối, phải ghi được; chỉ xoá bản cũ nằm trong thư mục phim và do chính xưởng ghi (`out/export.json`) |
| Docker | Trong container nghe 0.0.0.0 nhưng compose chỉ publish `127.0.0.1:4710`; Host header vẫn phải là localhost; thư mục tư liệu gắn chỉ-đọc; token Claude/Gemini qua `.env` (gitignore), không nằm trong image |
