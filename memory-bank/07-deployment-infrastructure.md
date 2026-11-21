# 07 — Cài đặt, cấu hình, triển khai

## Môi trường

| Môi trường | Trạng thái | Ghi chú |
|---|---|---|
| Máy cá nhân macOS Apple Silicon | Đang dùng | Node 24, pnpm 9, uv, ffmpeg 7, Claude Code CLI |
| Docker | Chưa có Dockerfile | Đánh giá bên dưới |
| Cloud Run | Chưa làm | **Không tự triển khai** — chỉ khi chủ dự án yêu cầu |

## Cài trên máy mới

Điều kiện: git, Node ≥ 20 + pnpm (`corepack enable`), [uv](https://docs.astral.sh/uv/), ffmpeg, Claude Code CLI (đã `claude` → `/login`).

```bash
git clone https://github.com/tuannhh/xuong-phim.git ~/social-series-studio
cd ~/social-series-studio
pnpm setup                                  # node_modules, font, venv âm thanh, kho SFX
bash tools/tts-vi/install.sh                # VieNeu-TTS + lệnh ~/.local/bin/tts-vi
mkdir -p ~/.claude/skills && ln -sfn "$PWD/skill" ~/.claude/skills/series   # skill /series
pnpm typecheck && node tools/tts/test.mjs   # kiểm tra
pnpm web                                    # http://localhost:4710
```

- Đặt repo ở `~/social-series-studio` cho khớp tài liệu (đường dẫn khác vẫn chạy — mã dùng đường dẫn tương đối theo `ROOT`).
- Lần đầu render, Remotion tự tải Chrome headless; lần đầu đọc voice, VieNeu tự tải model từ Hugging Face.
- `build/`, `out/` không commit → máy mới phải `pnpm ep <dir> all` để có lại MP4 (voice đã commit nên không phải đọc lại).
- Engine phụ tuỳ chọn: plugin lemo-opuscar (`claude plugin marketplace update lemolab && claude plugin update lemo-opuscar@lemolab`, thư viện ở `~/lemo-opuscar`).

## Cấu hình

**Commit được:** `bible.json`/`brief.json` từng series; `tools/tts-vi/config.example.env`.

**Không commit (đã gitignore):**

| Mục | Ý nghĩa | Bắt buộc? |
|---|---|---|
| `tools/tts-vi/config.env` | Giọng mặc định, thứ tự engine, đường dẫn file khoá Gemini | Có (install.sh tạo từ mẫu) |
| File khoá Gemini API / service account | Dự phòng giọng đọc | Không — chỉ cần nếu muốn Gemini |
| `series/*/.studio/gop-y.md` | Góp ý tạm từ trang web | — |

**Biến môi trường:** `PORT` (trang web, mặc định 4710), `STUDIO_CLAUDE_BIN` (đường dẫn lệnh claude), `STUDIO_CLAUDE_MODEL` (model cho bước sáng tác), `GEMINI_API_KEY` (ghi đè file khoá), `LEMO_LIB` (thư viện lemo-opuscar).

## Đánh giá Docker / Cloud Run (2026-11-22, chưa thực hiện)

**Docker — làm được, hợp để mang sang máy khác / máy chủ nội bộ.** Cần image Linux có Node + pnpm, Chrome headless của Remotion (thư viện hệ thống + font), ffmpeg, uv + Python, VieNeu-TTS (model Hugging Face nên để ở volume để không tải lại). Lưu ý:
- `series/` phải là volume, nếu không mất dữ liệu khi xoá container.
- VieNeu trong Docker chạy CPU (trên Mac, Docker không dùng được GPU Apple) — hiện ngoài Docker cũng đang chạy CPU nên chênh không lớn; render Remotion trong Docker trên Mac chậm hơn chạy thẳng.
- Nút AI cần `claude` trong container và đăng nhập: gắn thư mục đăng nhập của máy vào, hoặc dùng `ANTHROPIC_API_KEY` (tính tiền theo API, không theo gói thuê bao).
- Máy chủ đang nghe `127.0.0.1` → trong container phải nghe `0.0.0.0` và chỉ publish cổng ra `127.0.0.1` của máy host.

**Cloud Run — làm được nhưng không hợp với thiết kế hiện tại; cần sửa trước:**
1. Không có đăng nhập: trang web giả định chỉ chủ máy truy cập. Lên mạng phải có xác thực (IAP / Google login nội bộ) — bắt buộc.
2. Ổ đĩa tạm: Cloud Run xoá file khi instance tắt, nhiều instance không chung file → cần Cloud Storage (gắn FUSE) hoặc lưu kết quả lên bucket.
3. Việc nền dài (render 1–2 phút, Claude viết kịch bản vài phút, đọc voice) chạy sau khi trả lời request → phải bật CPU luôn cấp phát, `max-instances=1` (trạng thái việc giữ trong bộ nhớ), hoặc tách render thành Cloud Run Jobs.
4. Tài nguyên: VieNeu + Chrome cần khoảng 4 vCPU / 8–16 GB RAM; image vài GB; nạp model ~10 giây mỗi lần gọi.
5. Claude chạy ngầm trên cloud cần khoá API riêng và vẫn chạy được lệnh shell trong container (quyền `acceptEdits` + danh sách lệnh) — chấp nhận được trong container cô lập, nhưng phải có hạn mức chi phí.
6. Gemini dự phòng lại dễ hơn trên Cloud Run (dùng service account của dịch vụ, không cần file khoá).

**Khuyến nghị:** dùng Docker (hoặc cài thẳng theo mục trên) cho máy cá nhân/máy nội bộ. Chỉ lên Cloud Run khi có nhiều người cùng dùng, và làm đủ 1–3 trước.

## Việc còn treo

- Máy hiện tại: lệnh `tts-vi` vẫn trỏ tới bản cũ `~/tools/tts-vi/` (cùng nội dung với `tools/tts-vi/tts_vi.py` lúc chép 2026-11-22). Sửa một bên phải chép sang bên kia, hoặc chạy `install.sh` để trỏ về repo.
- Nút AI của trang web chưa chạy thật lần nào: lệnh `claude` trên máy báo "OAuth session expired" (2026-11-22). Cần `claude` → `/login` rồi thử lại.
