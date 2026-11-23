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
- **Cảnh `story`** (`scenes/story.tsx` + `kit/Sets.tsx`): bối cảnh nhiều lớp (`van-phong` ngày/chiều/tối, `nha` đêm/ngày, `hang-o`, `quan-ca-phe` ngày/tối, `ngan-hang`, `phong-hop` ngày/tối, `ngoai-troi` ngày/chiều/tối, `cua-hang`, `cong-an`; danh mục ở `shared/catalog.mjs` SETS, ghế tựa theo `seatFor`, người phụ phía sau theo `hasExtras`), nhân vật ngồi sau bàn tiền cảnh, máy quay `toan|trung|can|man-hinh` + đẩy chậm, nhãn bật (`tag|chip|alert|big|note`), chèn màn hình điện thoại / bảng tổng kết, phụ đề trắng viền đậm trên mặt bàn + nhãn tên người nói (đỏ nếu `villain`).
- **Nhân vật** (`kit/Character.tsx`): minh hoạ phẳng ~6 đầu, vẽ hai lượt viền → tô; 19 tư thế, 14 biểu cảm, 6 trang phục; khuỷu tay gần thân, cử chỉ ở cẳng tay/bàn tay. Hướng cử chỉ tự xoay theo phía nhân vật quay tới (`orientPose`; cảnh truyền `face`/`aim`) — bẫy 17.
- **Logo** (`kit/MisaLogo.tsx`): sinh nguyên hình từ `assets/brand/misa-logo.svg`, luôn kèm khẩu hiệu.
- **LayoutProbe** (`kit/LayoutProbe.tsx`): khi chụp storyboard, đo chữ đè chữ / đè `[data-person]` / tràn khung → `storyboard/layout.json`.

## Bổ sung 2026-11-22 (đổi tên "Xưởng phim")

- Header: logo MISA bản đầy đủ có khẩu hiệu (`/api/brand/misa-logo.svg`, nguyên hình, đặt trên tấm nền trắng vát góc) + chữ "Xưởng phim". Menu: Series của tôi · + Series mới · Thiết lập (`#/settings`; `#/drive` cũ chuyển về đây).
- Form: mục 2 "Nguồn nội dung" — 3 lựa chọn `sourceMode`; khác `claude` thì hiện ô kéo thả file (series mới: giữ trong trình duyệt, tạo series xong mới tải lên), danh sách link Drive / đường dẫn trên máy (kèm ghi chú lấy phần nào), gợi ý quyền đọc Drive.
- Trang series: nút "Mở thư mục phim"; thẻ "Nguồn nội dung" ở cột phải (số file/link, lần đọc gần nhất, file không đọc được); mỗi phim có dòng "Trên máy: <đường dẫn>"; mục "Sửa lời thoại" (tải lười khi mở; chữ đang sửa giữ trong `DRAFT` qua các lần vẽ lại).
- Trang Thiết lập: thư mục phim (Lưu / Mở thư mục; Docker thì khoá) + Google Drive (thêm nút "Cho phép đọc tư liệu trên Drive").
- Cảnh Remotion mới `photo` (`remotion/scenes/special.tsx`): ảnh tư liệu trong khung bo góc theo `ratio`, trôi chậm Ken Burns, nhiều ảnh thì chuyển theo câu thoại (dùng `revealFrames`), chú thích + nguồn; SFX `camera` khi vào cảnh, `whoosh-soft` khi đổi ảnh.

## Hàng đợi dựng (2026-11-22)

- Thanh "Hàng đợi" (`#queuebox`, hàm `queuePanel()`): các tập chờ (nút bỏ từng tập), lịch sử gần đây, nút Tạm dừng / Chạy tiếp / Xoá hàng đợi. Trạng thái lấy từ `GET /api/job` (`QUEUE`).
- Nút dựng của từng tập (`renderBtn`) đổi thành nhãn "đang dựng" / "trong hàng đợi · thứ N" khi tập đó đang chạy / đang chờ.
- Thẻ "Dựng lần lượt các tập đã duyệt kịch bản" (`batchCard`) hiện khi ≥ 2 tập có kịch bản: tập chưa có MP4 chọn sẵn, tập "kịch bản đã sửa" để trống.
- `poll` vẽ lại trang series khi hàng đợi đổi / việc nền đổi để nhãn luôn đúng.
- Outro (`scenes/basic.tsx`) không còn dòng "Tập sau" — chỉ CTA, handle, logo.

## Bổ sung 2026-11-23

- Header + các điểm nhấn tối (nút tối, số mục, toast) chuyển sang xanh navy (`--navy:#103A7A`, header gradient #0E3370→#15468F) — chủ dự án chê nền đen chữ trắng "trông như màu tang".
- `sugFor(field, el, set, ctx)`: bọc một ô nhập kèm nút "✦ Gợi ý" + 3 phương án bấm để điền (ẩn khi máy không có `claude`). Ô nhập gốc vẫn là phần tử cũ (code khác đọc `.value` không đổi).
- Form mục 4 "Nhạc nền": chọn nguồn, kéo thả file nhạc / đường dẫn, thanh âm lượng (`rangeRow`). Mục 7 "Watermark": khung xem trước theo khung hình (nền = ảnh storyboard đầu tiên của series nếu có), kéo thả chữ/logo bằng pointer events, thanh cỡ/độ mờ; mục Drive thành mục 8.
- Danh mục trang phục/tóc/bối cảnh/mascot lấy từ `META` (máy chủ đọc `shared/catalog.mjs`), không còn hằng số cứng trong trang.
- Mascot: nút "+ Mascot" ở mục nhân vật → thẻ riêng `mascotCard` (`kind: 'mascot'`): chọn mascot vẽ sẵn (`META.mascots`) hoặc "Ảnh mascot của tôi" (tải PNG qua `/asset?kind=mascot` → `series/<slug>/assets/mascot-*`, nhân vật lưu `image: 'series-assets/<file>'`); chọn giọng nam/nữ; không có tóc/trang phục. Series chưa tạo thì chưa tải ảnh được.
- Trang Thiết lập (2026-11-23): thẻ "AI viết kịch bản" (`aiCard`: chọn Claude Code / Codex kèm trạng thái cài/đăng nhập, bảng Việc–Model–Effort, model Claude = tên tắt + bản cố định + "Nhập tên model khác…", model Codex hỏi `/api/ai/codex-models` khi chọn Codex, effort theo model; Lưu / Về mặc định / Cập nhật danh sách model) và thẻ "Tự mở Xưởng phim khi bật máy" (`autoCard`). Nhãn giao diện nói "AI" thay vì "Claude" ở các chỗ dùng chung cho cả hai công cụ.
