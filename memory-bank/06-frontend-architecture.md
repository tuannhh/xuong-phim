# 06 — Giao diện & phần hình

## A. Trang web tại máy (`web/index.html`)

- Một file, JS thuần, định tuyến bằng hash: `#/` (danh sách + cảnh báo nếu máy chưa cài đủ), `#/new` (form), `#/s/<slug>` (series), `#/s/<slug>/edit` (sửa đề bài), `#/drive` (thiết lập/kết nối Google Drive). Tham số `?drive=ok|drive_err=` sau hash chỉ để hiện thông báo rồi bị xoá khỏi địa chỉ.
- Form có 6 mục: Ý tưởng · Quy mô · Phong cách · Nhân vật · Kết tập & ghi chú · Xuất phim lên Google Drive (trạng thái kết nối, tự đẩy, tên thư mục).
- Thẻ phim có dòng "Google Drive": chưa đẩy → "Đẩy lên Drive"; đã đẩy → "Mở trên Drive" + "Đẩy lại"; MP4 mới hơn → "Đẩy bản mới".
- Dựng DOM bằng hàm `h()`; mọi chữ đi qua `textContent` (không chèn HTML thô).
- Trang series: thanh 3 bước, thẻ từng tập theo trạng thái (`de-xuat` → duyệt; `duyet` → viết kịch bản; `kich-ban` → storyboard + duyệt dựng phim + góp ý; `phim` → video, tải MP4/SRT, dựng lại, góp ý), cột phải: tiến trình (log trực tiếp, nút Dừng), ghi chú Claude, bảng nhân vật, đề bài, câu lệnh thay thế.
- Hỏi trạng thái việc nền mỗi 1 giây khi đang chạy, 4 giây khi rảnh; góp ý đang gõ được giữ khi trang vẽ lại.
- Không theo MISA Design System (công cụ cá nhân, chạy tại máy) — quyết định có chủ đích.

## B. Phần hình Remotion

- `Episode.tsx` nhận `build/timed.json` làm props; `TransitionSeries` nối các cảnh; `scenes/index.ts` ánh xạ `type` → component.
- Template: `hook, title, bullets, stat, quote, compare, steps, icons, chart, kinetic, chat, phone, alert, figure, character, talk, story, outro, custom` (danh sách kiểm ở `tools/ep.mjs`).
- **Cảnh `story`** (`scenes/story.tsx` + `kit/Sets.tsx`): bối cảnh nhiều lớp (`van-phong` ngày/chiều/tối, `nha` đêm/ngày, `hang-o`), nhân vật ngồi sau bàn tiền cảnh, máy quay `toan|trung|can|man-hinh` + đẩy chậm, nhãn bật (`tag|chip|alert|big|note`), chèn màn hình điện thoại / bảng tổng kết, phụ đề trắng viền đậm trên mặt bàn + nhãn tên người nói (đỏ nếu `villain`).
- **Nhân vật** (`kit/Character.tsx`): minh hoạ phẳng ~6 đầu, vẽ hai lượt viền → tô; 19 tư thế, 14 biểu cảm, 6 trang phục; khuỷu tay gần thân, cử chỉ ở cẳng tay/bàn tay.
- **Logo** (`kit/MisaLogo.tsx`): sinh nguyên hình từ `assets/brand/misa-logo.svg`, luôn kèm khẩu hiệu.
- **LayoutProbe** (`kit/LayoutProbe.tsx`): khi chụp storyboard, đo chữ đè chữ / đè `[data-person]` / tràn khung → `storyboard/layout.json`.
