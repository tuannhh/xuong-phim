# 01 — Tổng quan

## Xưởng là gì

Xưởng sản xuất **series phim ngắn cho mạng xã hội** (TikTok, Reels, Shorts, YouTube) bằng code. Người dùng đưa ý tưởng và duyệt; Claude Code lập kế hoạch, viết kịch bản, dựng hình, lời đọc, âm thanh và xuất MP4.

- Hình **chỉ bằng code/vector** (Remotion + SVG tự vẽ + icon Lucide). Không dùng ảnh/video do AI tạo.
- Lời đọc tiếng Việt qua lệnh `tts-vi` (VieNeu-TTS chạy tại máy; Gemini TTS dự phòng).
- Nhạc nền và SFX tự tổng hợp bằng Python (không dùng nhạc có bản quyền).
- Nhân vật minh hoạ phẳng dáng người thật; nhân vật MISA mặc polo vàng có logo MISA đầy đủ.

## Người dùng

- **Chủ dự án** (một người, nhân viên MISA): lên ý tưởng, duyệt 3 bước, không cần biết code.
- **Claude Code**: người sản xuất — làm theo skill `/series` (chat) hoặc được trang web gọi chạy ngầm (`claude -p`).

## Hai cách làm việc

1. **Chat với Claude Code** trong thư mục xưởng: `/series` + đề bài → duyệt trong chat.
2. **Trang web tại máy**: `pnpm web` → http://localhost:4710 → điền form → bấm nút → duyệt trên trang.

## Môi trường

| Môi trường | Trạng thái | Ghi chú |
|---|---|---|
| Máy cá nhân (macOS Apple Silicon) | Đang dùng | Mọi thứ chạy tại máy; dữ liệu nằm trong `series/` |
| Docker | Có `Dockerfile` + `docker-compose.yml` (2026-11-22) | Chạy cả xưởng trong container — xem `07-deployment-infrastructure.md` |
| Cloud Run | Chưa làm, **không tự triển khai** | Chỉ làm khi chủ dự án yêu cầu |

## Sản phẩm mẫu

Series của người dùng (`series/<slug>/`) KHÔNG đưa lên GitHub (`.gitignore` bỏ cả `series/*`) — mỗi máy tự tạo series của mình. Trên GitHub chỉ giữ `series/huong-dan-xuong-phim` (video hướng dẫn dùng xưởng). Hai series đầu tiên của chủ dự án ("Người MISA cảnh giác" — `canh-giac-lua-dao`, `nguoi-misa-canh-giac-voi-lua-dao`) đã gỡ khỏi GitHub 26/11/2026, vẫn còn trên máy gốc. Tạo hình nhân viên MISA áo polo vàng có logo (`kind: "misa"`) nằm trong mã (`remotion/kit/Character.tsx`, `shared/catalog.mjs`), là trang phục mặc định của form tạo series và lựa chọn "Nhân viên MISA" khi tạo series bằng bot Telegram.

## Ngoài phạm vi

Không tự đăng lên mạng xã hội. Không dùng ảnh chụp/người thật. Remotion cần giấy phép công ty nếu tổ chức > 3 người dùng cho mục đích thương mại.
