# Xưởng phim — hướng dẫn cho Codex (và các agent khác)

Quy tắc của dự án nằm ở `CLAUDE.md` (dùng chung cho mọi agent, không riêng Claude) — **đọc `CLAUDE.md` trước**.
Quy trình làm phim là skill `series`: file `skill/SKILL.md`. Khi câu lệnh nói "làm theo skill series", hãy đọc thẳng file đó
(Codex không có công cụ Skill) — nhất là mục "Chế độ form" khi được trang web gọi. Tham chiếu template/nhân vật/bối cảnh: `docs/reference.md`.
Tri thức dự án: `memory-bank/` (đọc `memory-bank/11-coding-rules.md` trước khi sửa mã).

## Khi chạy từ trang web bằng Codex (`codex exec`, hộp cát workspace-write)
- Không ai trả lời câu hỏi: tự quyết theo mặc định của skill, ghi giả định vào `series/<slug>/.studio/ghi-chu.md`.
- Chrome không chạy được trong hộp cát macOS → **không** chạy `node tools/ep.mjs <tập> storyboard|render|voice|audio|all` và `pnpm series characters`.
  Chỉ chạy `check` và `script` (giai đoạn plan: `pnpm series plan <slug>`). Máy chủ xưởng tự vẽ storyboard sau khi bạn xong;
  nếu bố cục còn chồng lấn, máy chủ gọi lại bạn kèm danh sách lỗi.
- Lệnh trong hộp cát không có mạng. Cần tìm thông tin thì dùng công cụ tìm web của Codex (khi được bật); số liệu phải có nguồn.
- Không commit, không đăng gì lên mạng xã hội, không chép khoá/token vào repo.
