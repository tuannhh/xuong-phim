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
