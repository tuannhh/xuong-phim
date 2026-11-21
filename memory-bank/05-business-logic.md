# 05 — Luồng nghiệp vụ

## 3 điểm duyệt (không bỏ qua trừ khi chủ dự án nói "làm luôn")

1. **Kế hoạch sơ bộ** — mỗi tập: tiêu đề, logline, câu mở đầu (hook 3 giây), các ý, hình ảnh, lời kết; mỗi tập một góc riêng, có móc sang tập sau. Duyệt → `status: "duyet"`.
2. **Kịch bản + storyboard** — `episode.json` → `check` → `script.md` → storyboard (ảnh mỗi cảnh). Storyboard phải báo `✓ bố cục` (không chữ đè chữ / đè nhân vật / tràn khung).
3. **Phim** — voice → timing → audio → render → MP4 + SRT. Góp ý → sửa `episode.json` → chạy lại từ bước bị ảnh hưởng (voice chỉ đọc câu mới/đổi).

## Trang web gọi Claude ("Chế độ form" trong `skill/SKILL.md`)

- Trang ghi đề bài (`brief.json`) và góp ý (`.studio/gop-y.md`), rồi chạy `claude -p "<prompt>"` với prompt nêu giai đoạn `plan` / `script <n>` / `fix <n>` (`promptFor` trong `server.mjs`).
- Claude không hỏi lại, không Artifact/SendUserFile/commit, làm đúng một giai đoạn rồi dừng; giả định ghi vào `.studio/ghi-chu.md`; câu trả lời cuối ≤ 6 dòng (trang hiện nguyên văn).
- Claude **không đổi** nhân vật/giọng/bộ màu người dùng đã chọn trong form.
- `style`: `tinh-huong` → cảnh `story`; `thong-tin` → template thông tin; `ket-hop` → mở bằng tình huống, chốt bằng thông tin. `logo: none` → không đồng phục/logo MISA.
- Dựng phim không cần Claude: máy chủ chạy thẳng `tools/ep.mjs … all`.

## Viết kịch bản (quy tắc nội dung)

- Câu thoại ≤ 25 chữ, viết để nói; câu đầu là hook trong 3 giây.
- Số câu khớp số mục hiện dần để hình bám lời; chữ trên màn hình ngắn hơn lời đọc; nhấn bằng `*từ*`.
- Đổi template/cỡ cảnh liên tục, không cảnh nào đứng yên quá 2 câu.
- Không bịa số liệu; `stat` phải có `source`.
- Mỗi tập có cả nhân vật nam và nữ; giọng khoá theo giới tính.

## Thời gian & âm thanh

- `shared/reveal.mjs` (`revealTimes`, `storyTimes`) quyết định khi nào mục hiện ra — dùng chung cho hình **và** SFX để luôn khớp.
- `timing.mjs` tính thời gian thật theo độ dài voice (`dur.json`), thêm `pad` mỗi cảnh, sinh phụ đề (từ được nói sáng dần, từ nhấn màu vàng), đặt SFX tự động, xuất SRT.
- `mix.py`: nhạc theo mood (tự hạ khi có lời) + SFX + voice → −14 LUFS; tính độ mở miệng từng nhân vật theo khung hình. Lời dẫn chuyện (dòng không có speaker) không làm nhân vật nhép miệng.
