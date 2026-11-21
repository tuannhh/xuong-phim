# Xưởng series — hướng dẫn cho Claude

Xưởng sản xuất series phim ngắn cho mạng xã hội. Quy trình đầy đủ ở skill `/series` (nguồn: `skill/SKILL.md`, symlink vào `~/.claude/skills/series`). Tham chiếu template/nhân vật/SFX: `docs/reference.md`.
Tri thức dự án theo quy chuẩn MISA Backend: `memory-bank/` (đọc `memory-bank/11-coding-rules.md` trước khi sửa code; sau mỗi thay đổi cập nhật tệp liên quan + `memory-bank/10-development-history.md`).

## Quy tắc
- Người dùng lên ý tưởng và duyệt; 3 điểm duyệt: kế hoạch sơ bộ → kịch bản + storyboard → video.
- Hình chỉ bằng code/vector (template Remotion, icon Lucide, SVG tự vẽ). Không tạo ảnh/video bằng AI. Gemini chỉ dùng cho voice dự phòng (qua tts-vi).
- Voice: luôn qua lệnh `tts-vi` (VieNeu → Gemini API key → Gemini Agent Platform). Không chép khoá vào repo.
- `episode.json` là nguồn duy nhất của một tập; script.md, storyboard, build/ đều sinh lại được.
- Không bịa số liệu; số liệu phải có nguồn.
- Logo MISA (`assets/brand/`) là tài sản thương hiệu MISA: giữ nguyên hình, không đổi màu trừ bản một màu trên nền tối. LUÔN dùng bản đầy đủ có khẩu hiệu "Tin cậy – Tiện ích – Tận tình" (component `MisaLogo`), không dùng bản chỉ có chữ MISA.
- Không tự đăng video lên mạng xã hội. Đẩy lên Google Drive của chính người dùng chỉ khi họ bấm nút hoặc bật "tự đẩy" cho series.
- Được gọi từ trang web (câu lệnh có "Chế độ form"): không hỏi lại, không Artifact/SendUserFile/commit, làm đúng một giai đoạn (`plan` / `script <n>` / `fix <n>`) rồi dừng; giả định ghi vào `series/<slug>/.studio/ghi-chu.md`.
- Font: Barlow (tiêu đề) + Google Sans (nội dung). Không để chữ đè chữ / đè nhân vật — storyboard phải báo `✓ bố cục`.
- Nhân vật vẽ dáng người thật, đầy đặn, đầu–thân cân đối; khuỷu tay gần thân, không giơ hai tay quá đầu (người dùng chê dáng còm nhom, tay chân lòng khòng). Phim tình huống dùng cảnh `story` (bối cảnh nhiều lớp, máy quay, nhãn bật).
- Mỗi tập nhiều nhân vật nam + nữ; nhân vật nam giọng nam, nữ giọng nữ (`check` chặn nếu sai). MISA đọc là "mi xa".

## Lệnh
```
pnpm web                                     # trang web tại máy http://localhost:4710 — form đề bài + 3 bước duyệt
bash setup.sh                                # cài lần đầu / máy mới: tự cài mọi phần mềm + thư viện còn thiếu
pnpm doctor                                  # kiểm tra máy đã cài đủ chưa
pnpm series new <slug> "Tên"                 # khung series
pnpm series plan <slug>                      # plan.html để duyệt
pnpm series characters <slug>                # bảng nhân vật
pnpm series ep <slug> <số>                   # khung tập
pnpm ep <thư-mục-tập> check|script|storyboard|voice|timing|audio|render [--preview]|all|studio
pnpm typecheck
pnpm ep <dir> all --gemini                  # bản voice Gemini TTS để so sánh
pnpm series styles                           # cập nhật danh mục phong cách lemo-opuscar
node tools/tts/test.mjs                      # kiểm thử bộ chuẩn hoá lời đọc
```

## Mã nguồn
- `remotion/` — composition `Episode` (props = build/timed.json), `kit/` (theme, nền, phụ đề, nhân vật MISA, logo), `scenes/` (template), `custom/` (cảnh riêng từng tập).
- `shared/reveal.mjs` — lịch hiện mục, dùng chung cho hình và SFX (sửa một chỗ).
- `tools/web/server.mjs` + `web/index.html` — trang web tại máy (không phụ thuộc thư viện): form ghi `brief.json` + `bible.json`; nút sáng tác gọi `claude -p` theo mục "Chế độ form" của skill; nút dựng phim chạy thẳng `tools/ep.mjs … all`. Chỉ nghe 127.0.0.1, mỗi lúc một việc. `tools/web/drive.mjs` — kết nối Google Drive (OAuth máy tính + PKCE, quyền drive.file; client/token ở `~/.config/xuong-phim/google.json`, ngoài repo).
- `setup.sh` + `tools/doctor.mjs` — cài/kiểm tra máy; hook SessionStart ở `.claude/settings.json` báo Claude khi máy chưa cài đủ.
- `tools/` — timing.mjs, render.mjs, ep.mjs, series.mjs; `tools/audio/` — sfx_bank.py, music.py, mix.py (uv).
