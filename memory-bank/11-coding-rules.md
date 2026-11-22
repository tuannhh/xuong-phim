# 11 — Quy tắc riêng của xưởng

Bổ sung cho bộ MISA Backend standard (ưu tiên: bảo mật > chịu lỗi > hiệu năng > tiện).

1. **Hình chỉ bằng code/vector.** Không tạo ảnh/video bằng AI. Gemini chỉ dùng cho giọng đọc (qua `tts-vi`).
2. **`episode.json` là nguồn duy nhất của một tập**; `script.md`, storyboard, `build/`, `out/` đều sinh lại được — không sửa tay.
3. **Hình và SFX dùng chung lịch thời gian** (`shared/reveal.mjs`) — sửa một chỗ.
4. **Storyboard phải sạch** (`✓ bố cục`) trước khi đưa duyệt.
5. **Logo MISA**: giữ nguyên hình, luôn bản đầy đủ có khẩu hiệu (`MisaLogo`).
6. **Nhân vật**: dáng người thật, đầy đặn, đầu–thân cân đối; khuỷu tay gần thân; không giơ hai tay quá đầu. Mỗi tập có nam và nữ; giọng đúng giới tính.
7. **Không bịa số liệu**; số liệu phải có nguồn.
8. **Không tự đăng** lên mạng xã hội; **không tự triển khai Cloud Run**; **không commit** khi chưa được bảo.
9. **Không chép khoá** vào repo; không gửi thông tin cá nhân ra ngoài.
10. **Không ghi tên/nguồn sản phẩm tham khảo** vào code, tài liệu, commit; tạo hình nhân vật là nguyên bản, không chép phong cách video tham khảo.
11. **Trang web**: không thêm thư viện khi chưa cần; chỉ nghe 127.0.0.1; mọi lệnh ghi qua kiểm `x-xuong`; mọi chữ qua `textContent`.
12. Font: Barlow (tiêu đề) + Google Sans (nội dung). Phim tình huống dùng cảnh `story`.
13. Sau mỗi thay đổi: chạy `pnpm typecheck`, `node tools/tts/test.mjs` (nếu đụng lời đọc), cập nhật memory-bank + dòng lịch sử.
14. **Tư liệu người dùng** là dữ liệu riêng: không commit (`series/*/tu-lieu/`, `.studio/tu-lieu/` đã gitignore), không gửi đi đâu ngoài việc tải từ Drive của chính họ. Ảnh duy nhất được dùng ngoài code/vector là ảnh trong tư liệu (cảnh `photo`); không dùng ảnh lộ thông tin nhạy cảm.
15. Chế độ `tu-lieu` chặn tìm web bằng danh sách công cụ của `claude -p` (không chỉ dặn trong câu lệnh) — sửa `claudeArgs` phải giữ điều này.
16. Mọi việc nền trên trang đi qua `startTask`/`runChild` (một việc mỗi lúc, nút Dừng giết được tiến trình con đang chạy); không spawn ngoài luồng đó.
17. **Hướng cử chỉ**: tay đưa ngang ra phải ở phía nhân vật đang quay tới; tư thế hai tay khi nói với bạn diễn thì tay phía xa gập trước bụng. Không vẽ nhân vật bỏ qua `orientPose`; cảnh mới dùng `Person` có từ hai người trở lên phải truyền `face` (bạn diễn gần nhất, cố định cả cảnh). Thêm/sửa `POSES` → chạy `pnpm series characters <slug> --huong` và xem cả hai hàng trước khi báo xong (bẫy 17).
18. **Vẽ cánh tay** (bẫy 18): cẳng tay + bàn tay luôn nằm lớp trên bắp tay + tay áo; ngón cái bàn tay xoè cố định theo tay (`tx = side`), không đoán theo góc; tay mở ra ngoài dùng khuỷu `OUT`, không ghim `LOW` rồi bẻ cẳng tay ngang. Người dùng báo một lỗi hình mà chưa rõ chỗ nào → vẽ 2–3 phương án cạnh nhau cho họ chọn, không đoán rồi sửa.
19. **Khởi động lại máy chủ / container** (`docker compose up -d`, dừng `pnpm web`): chỉ làm khi `GET /api/job` không ở `running`/`stopping`, và phải viết thành điều kiện CHẶN lệnh (vd `… | grep -qv running && docker compose up -d`), không chỉ in trạng thái ra rồi chạy tiếp. Việc đang chạy nằm trong bộ nhớ máy chủ — khởi động lại là mất, người dùng phải bấm lại.
20. **Tập phim đứng độc lập**: không viết "tập sau / tập tới" trong lời, chữ, outro; không thêm lại `next` vào outro (bẫy 22).
21. **Lời đọc**: sửa cách đọc từ chung ở `tools/tts/lexicon.json` / `normalize.mjs` kèm ca kiểm thử, không vá bằng `bible.pronounce` từng series; `node tools/tts/test.mjs` phải sạch (bẫy 21).
22. **Hàng đợi**: chỉ `render` được xếp hàng; việc khác khi bận vẫn trả 409. Mọi việc kết thúc phải đi qua `finish()` để hàng đợi chạy tiếp — thêm loại việc mới đừng gọi thẳng `j.status = …` (bẫy 23).
23. **Danh mục** trang phục / tóc / bối cảnh / mascot chỉ khai ở `shared/catalog.mjs` (máy chủ, `check`, trang web cùng đọc); thêm mục mới thì vẽ ở `Character.tsx` / `Sets.tsx` với đúng id đó.
24. **Tài sản riêng của người dùng** (logo, ảnh mascot `series/*/assets/`, nhạc `series/*/nhac/`, tư liệu) không lên GitHub; nhạc người dùng đưa vào thì họ chịu trách nhiệm bản quyền — xưởng không tự tải nhạc ngoài.
