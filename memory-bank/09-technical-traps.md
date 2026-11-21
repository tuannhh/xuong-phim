# 09 — Bẫy kỹ thuật

## 1. `at` của nhãn bật vừa là thời điểm vừa là vị trí
**Triệu chứng:** `mix.py` lỗi `TypeError: unsupported operand type(s) for *: 'NoneType' and 'int'`; nhãn bật không chạy.
**Nguyên nhân:** pop có `at: [x, y]` (vị trí) bị `storyTimes` coi là thời điểm → NaN.
**Xử lý:** `shared/reveal.mjs` chỉ coi `at` là giây khi `typeof it.at === 'number'`.
**Bài học:** trường đa nghĩa phải kiểm kiểu ở mọi nơi đọc; hình và SFX dùng chung một hàm thời gian.

## 2. Thẻ trong màn hình điện thoại bị ép chồng nhau
**Nguyên nhân:** flex co phần tử con. **Xử lý:** bọc mỗi mục bằng div `flex: 'none'` (`renderItem` trong `story.tsx`).

## 3. Kiểm tra bố cục báo nhầm chữ bị cuộn dưới đầu điện thoại
**Xử lý:** `LayoutProbe` bỏ qua chữ nằm hoàn toàn ngoài vùng `overflow: hidden` của tổ tiên. **Bài học:** đo theo vùng nhìn thấy thật, không theo hộp phần tử.

## 4. Nhân vật dẫn chuyện nhép miệng khi đọc lời dẫn
**Xử lý:** dòng không có speaker được đánh dấu `narr`; miệng ép về 0.

## 5. Phim ngắn hơn mục tiêu
**Nguyên nhân:** voice VieNeu nhanh. **Xử lý:** `pad` từng cảnh trong `episode.json`, đặt `target` sát thực tế.

## 6. `claude -p` báo "OAuth session expired"
**Triệu chứng:** nút AI lỗi ngay trong vài trăm ms, `is_error: true` dù `subtype: success`.
**Nguyên nhân:** lệnh claude trên máy hết phiên đăng nhập (không do biến môi trường — đã thử môi trường sạch, vẫn lỗi).
**Xử lý:** `claude` → `/login`. Máy chủ coi `result.is_error` là lỗi (dù mã thoát có thể là 0) và hiện hướng dẫn.

## 7. Tư thế nhân vật trông kỳ (tay "like" giống ngón giữa, giơ hai tay)
**Bài học từ chủ dự án:** không giơ hai tay quá đầu, không gập khuỷu tay lộ liễu; tư thế `like` đã vẽ lại thành ngón cái dày trên nắm tay nghiêng nhưng vẫn chưa thật rõ — tránh dùng ở cận cảnh.

## 8. Nhãn trong `<label>` bấm vào làm bật nút đầu tiên
**Nguyên nhân:** `<label>` bọc nhóm nút → bấm chữ tiêu đề kích hoạt nút đầu. **Xử lý:** `lab()` trong `web/index.html` chỉ dùng `<label>` khi bọc input/select/textarea, còn lại dùng `<div>`.

## 9. Hai bản `tts_vi.py`
Máy gốc chạy bản `~/tools/tts-vi/`, repo có bản `tools/tts-vi/`. Sửa một bên phải đồng bộ bên kia (xem `07`).
