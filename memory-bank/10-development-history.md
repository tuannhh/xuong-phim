# 10 — Lịch sử phát triển

| Ngày | Thay đổi | Lý do |
|---|---|---|
| 2026-11-21 | Dựng xưởng: Remotion + timing + SFX/nhạc tự tổng hợp + skill `/series` + 3 điểm duyệt | Chủ dự án muốn xây kênh social bằng series nhiều tập, Claude là người sản xuất |
| 2026-11-21 | Nhân vật MISA polo vàng; logo dùng bản đầy đủ có khẩu hiệu | Bản chỉ chữ MISA bị coi là sai |
| 2026-11-21 | Bộ luật đọc VOICE_OFF_TTS_RULES v5 (`tools/tts/`), khoá giọng theo giới tính, cảnh hội thoại `talk` | VieNeu đọc sai số/viết tắt; nam phải giọng nam |
| 2026-11-21 | Tập 1 demo (bản VieNeu + bản Gemini để so) | Kiểm chứng toàn luồng |
| 2026-11-22 | Vẽ lại nhân vật lần 4: dáng người thật đầy đặn ~6 đầu, 19 tư thế | Chủ dự án chê chibi → tay ống → "còm nhom, lòng khòng, giơ 2 tay"; muốn "có da có thịt", cân đối |
| 2026-11-22 | Cảnh `story` (bối cảnh nhiều lớp, máy quay, nhãn bật, màn hình điện thoại) + Tập 4 "Thả tim nhận tiền?" | Không gian và chữ động ấn tượng hơn; chỉ cần một bản VieNeu. Chủ dự án: "Rất tốt rồi đấy!" |
| 2026-11-22 | Trang web tại máy (`pnpm web`) + "Chế độ form" trong skill | Mỗi lần dùng chỉ cần điền form và duyệt trên trang |
| 2026-11-22 | Memory-bank theo quy chuẩn MISA Backend; đưa `tts-vi` vào repo kèm `install.sh`; đẩy lên GitHub `xuong-phim` (riêng tư) | Kéo về máy khác dùng được |
| 2026-11-22 | `setup.sh` tự cài mọi phần mềm/thư viện (Homebrew, Node, pnpm, uv, ffmpeg, VieNeu, Chrome headless, skill, Claude CLI) + `tools/doctor.mjs` + hook SessionStart báo Claude khi máy thiếu | Chủ dự án dùng trên Claude Desktop, muốn clone về máy khác là tự cài đủ |
| 2026-11-22 | Kết nối Google Drive trên trang web: OAuth máy tính + PKCE, quyền drive.file, đẩy MP4 + SRT theo nút hoặc tự đẩy sau khi dựng | Phim thành phẩm đưa thẳng lên Drive của người dùng |
| 2026-11-22 | Tạm bỏ hướng Docker/Cloud Run | Chủ dự án chọn dùng trên Claude Desktop |
| 2026-11-22 | Đổi tên ứng dụng "Xưởng phim", logo MISA đầy đủ ở header; trang "Thiết lập" gộp thư mục phim + Google Drive | Chủ dự án yêu cầu |
| 2026-11-22 | Nguồn nội dung 3 chế độ (Claude tự tìm / kết hợp / chỉ tư liệu) + tư liệu: kéo thả Word/PDF/PPTX/XLSX/ảnh, link Drive (thêm quyền drive.readonly tuỳ chọn), đường dẫn trên máy; máy chủ đọc tư liệu thành văn bản + ảnh trước khi Claude viết; cảnh `photo` cho ảnh tư liệu | Phim sát nhu cầu thực tế của người dùng, dùng được tài liệu sẵn có |
| 2026-11-22 | Sửa lời thoại ngay trên storyboard (không cần Claude) → tự vẽ lại storyboard | Chủ dự án muốn tự sửa câu chữ |
| 2026-11-22 | Thư mục phim chung `~/Movies/Xưởng phim/<series>/EPNN - <tiêu đề>.mp4`, tự chép sau mỗi lần dựng; `pnpm series export` | Phim dễ tìm trên ổ cứng |
| 2026-11-22 | Đóng gói Docker (Dockerfile + compose, VieNeu + Chrome headless + Claude CLI trong image) | Chủ dự án yêu cầu chạy được trên Docker |
| 2026-11-22 | Hướng cử chỉ tự xoay về người nghe (`orientPose`, prop `face`/`aim` của `Person`); `flip` không còn làm ngược hướng nhìn; thêm bảng soát `pnpm series characters <slug> --huong` | Chủ dự án báo tay nhân vật khi nói "bị ngược" (storyboard tập 1 series Người MISA cảnh giác, cảnh 4 và 7) |
| 2026-11-22 | Vẽ lại cánh tay: cẳng tay nằm trước bắp tay/tay áo; ngón cái bàn tay xoè cố định theo tay; tay mở ra ngoài dùng khuỷu `OUT`, `om-dau` đưa khuỷu ngang (bẫy 18) | Chủ dự án báo lần hai tay vẫn ngược, xem 3 phương án và chọn áp cả ba |
| 2026-11-22 | Sửa báo tiến độ dựng phim/storyboard trên trang (không lỡ mốc 5%, hiện ngay, kèm số khung) — bẫy 20 | Chủ dự án thấy tập 1 đứng ở 35% |
