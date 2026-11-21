# 🧠 Memory Bank — Xưởng phim (social-series-studio)

Thư mục này chứa **toàn bộ tri thức làm việc** của xưởng, theo quy chuẩn memory-bank của bộ MISA Backend standard. Đọc hết các tệp ở đây là đủ để tiếp tục làm việc (người hoặc AI) mà không cần hỏi lại.

## Cách sử dụng

- **Trước khi sửa code:** đọc `11-coding-rules.md` — quy tắc bắt buộc.
- **Máy mới / lần đầu:** đọc `07-deployment-infrastructure.md` (cài đặt) rồi đọc theo thứ tự `01` → `11`.
- **Tra nhanh:** nhảy thẳng vào tệp theo chủ đề.
- **Sau mỗi thay đổi code/kiến trúc:** cập nhật tệp tương ứng + thêm một dòng vào `10-development-history.md` (kèm lý do).

## Danh sách tệp

| Tệp | Chủ đề | Khi nào đọc |
|---|---|---|
| [01-project-overview.md](01-project-overview.md) | Xưởng là gì, phục vụ ai, môi trường | Luôn đọc đầu tiên |
| [02-technology-stack.md](02-technology-stack.md) | Công nghệ, lý do chọn, sơ đồ | Hiểu kiến trúc |
| [03-database-schema.md](03-database-schema.md) | Không có CSDL — "lược đồ" các file JSON (bible, plan, brief, episode) | Sửa dữ liệu series/tập |
| [04-api-reference.md](04-api-reference.md) | API của trang web tại máy + lệnh CLI | Sửa máy chủ web / công cụ |
| [05-business-logic.md](05-business-logic.md) | Quy trình 3 điểm duyệt, sản xuất một tập | Hiểu luồng chính |
| [06-frontend-architecture.md](06-frontend-architecture.md) | Trang web + phần hình Remotion (cảnh, nhân vật, bối cảnh) | Sửa giao diện / hình |
| [07-deployment-infrastructure.md](07-deployment-infrastructure.md) | Cài trên máy mới, cấu hình, Docker/Cloud Run | Cài đặt, vận hành |
| [08-security-model.md](08-security-model.md) | Khoá, quyền của Claude chạy ngầm, giới hạn trang web | Trước khi mở ra ngoài máy |
| [09-technical-traps.md](09-technical-traps.md) | Bẫy đã gặp | Tránh lặp lỗi |
| [10-development-history.md](10-development-history.md) | Lịch sử + lý do | Hiểu bối cảnh |
| [11-coding-rules.md](11-coding-rules.md) | Quy tắc riêng của xưởng | **Trước mọi thay đổi** |

## Quan hệ với tài liệu khác

- `CLAUDE.md` — tóm tắt quy tắc cho Claude Code (nạp tự động).
- `skill/SKILL.md` — quy trình skill `/series` (gồm "Chế độ form").
- `docs/reference.md` — tra cứu chi tiết template cảnh, tư thế nhân vật, SFX, nhạc, theme, trang web.
- Khi các nguồn lệch nhau, **mã nguồn là sự thật**; sửa tài liệu cho khớp.
