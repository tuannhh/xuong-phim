# Xưởng phim — hướng dẫn cho Claude

Xưởng sản xuất series phim ngắn cho mạng xã hội. Quy trình đầy đủ ở skill `/series` (nguồn: `skill/SKILL.md`, symlink vào `~/.claude/skills/series`). Tham chiếu template/nhân vật/SFX: `docs/reference.md`.
Tri thức dự án theo quy chuẩn MISA Backend: `memory-bank/` (đọc `memory-bank/11-coding-rules.md` trước khi sửa code; sau mỗi thay đổi cập nhật tệp liên quan + `memory-bank/10-development-history.md`).

## Quy tắc
- Người dùng lên ý tưởng và duyệt; 3 điểm duyệt: kế hoạch sơ bộ → kịch bản + storyboard → video.
- Hình chỉ bằng code/vector (template Remotion, icon Lucide, SVG tự vẽ) + ảnh thật trong tư liệu người dùng đưa vào (cảnh `photo`). Không tạo ảnh/video bằng AI. Gemini chỉ dùng cho voice dự phòng (qua tts-vi).
- Nguồn nội dung theo `brief.sourceMode`: `claude` (tự tìm, mặc định) · `ket-hop` · `tu-lieu` (chỉ dùng tư liệu, không tìm web). Tư liệu đã đọc sẵn ở `series/<slug>/.studio/tu-lieu/index.md` — xem mục "Tư liệu" của skill. Tư liệu là của người dùng: không đưa lên GitHub (đã gitignore).
- Voice: luôn qua lệnh `tts-vi` (VieNeu → Gemini API key → Gemini Agent Platform). Không chép khoá vào repo.
- `episode.json` là nguồn duy nhất của một tập; script.md, storyboard, build/ đều sinh lại được.
- Không bịa số liệu; số liệu phải có nguồn.
- Logo MISA (`assets/brand/`) là tài sản thương hiệu MISA: giữ nguyên hình, không đổi màu trừ bản một màu trên nền tối. LUÔN dùng bản đầy đủ có khẩu hiệu "Tin cậy – Tiện ích – Tận tình" (component `MisaLogo`), không dùng bản chỉ có chữ MISA.
- Các bước sáng tác chạy bằng Claude Code hoặc Codex (người dùng chọn ở Thiết lập); quy tắc ở file này dùng chung cho mọi agent.
- Không tự đăng video lên mạng xã hội. Đẩy lên Google Drive của chính người dùng chỉ khi họ bấm nút hoặc bật "tự đẩy" cho series.
- Được gọi từ trang web (câu lệnh có "Chế độ form"): không hỏi lại, không Artifact/SendUserFile/commit, làm đúng một giai đoạn (`plan` / `plan-add` (đợt thêm tập — chỉ thêm tập mới, không sửa tập cũ) / `script <n>` / `fix <n>`) rồi dừng; giả định ghi vào `series/<slug>/.studio/ghi-chu.md`.
- Font: Barlow (tiêu đề) + Google Sans (nội dung). Không để chữ đè chữ / đè nhân vật — storyboard phải báo `✓ bố cục`.
- Nhân vật vẽ dáng người thật, đầy đặn, đầu–thân cân đối; khuỷu tay gần thân, không giơ hai tay quá đầu (người dùng chê dáng còm nhom, tay chân lòng khòng). Phim tình huống dùng cảnh `story` (bối cảnh nhiều lớp, máy quay, nhãn bật).
- Tay cử chỉ phải hướng về người nghe: nhân vật quay mặt sang một phía thì tay đưa ra ở phía đó, tay kia gập trước bụng — không mở ngang ra sau lưng (người dùng báo lỗi "tay bị ngược" 22/11/2026). Luật nằm ở `orientPose` trong `remotion/kit/Character.tsx`; sửa tư thế xong chạy `pnpm series characters <slug> --huong` để soát. Cùng lỗi này còn do cách vẽ: cẳng tay phải nằm lớp trên bắp tay/tay áo, ngón cái bàn tay xoè cố định theo tay, tay mở ra ngoài không gập chữ L sát sườn (memory-bank bẫy 18).
- Mỗi tập nhiều nhân vật nam + nữ; nhân vật nam giọng nam, nữ giọng nữ (`check` chặn nếu sai). MISA đọc là "mi xa"; tên miền/viết tắt tiếng Anh tự chuẩn hoá (misa.vn → "mi xa chấm vi en", APK → "ây pi kây") — sửa cách đọc ở `tools/tts/lexicon.json` + ca kiểm thử.
- Mỗi tập đứng độc lập: không hẹn "tập sau" (người dùng duyệt một số tập, đăng không theo thứ tự); outro không có `next`.

## Lệnh
```
bash start.sh                                # mở xưởng: lần đầu chọn chạy thẳng (khuyên dùng) hay Docker, lần sau tự nhớ (--chon để đổi)
pnpm web                                     # trang web Xưởng phim http://localhost:4710 — form đề bài + 3 bước duyệt
docker compose up -d --build                 # hoặc Docker (sửa .env từ .env.example) — chậm hơn chạy thẳng trên Mac (giọng ~8×, vẽ ~1,8×); máy gốc đã chuyển về chạy thẳng
bash setup.sh                                # cài lần đầu / máy mới: tự cài mọi phần mềm + thư viện còn thiếu
setup.cmd / start.cmd                        # Windows (không cần WSL): cài / mở xưởng — gọi setup.ps1 / start.ps1
pnpm doctor                                  # kiểm tra máy đã cài đủ chưa
node tools/autostart.mjs on|off|status|restart   # tự mở xưởng khi đăng nhập máy (LaunchAgent / systemd user); restart sau khi sửa mã máy chủ (chặn khi có việc đang chạy)
node tools/huong-dan/chup.mjs                # chụp lại màn hình cho video hướng dẫn + tự điền vùng zoom vào episode.json
pnpm thu-may                                 # dựng thật tập mẫu ~9 giây trong thư mục tạm → chắc chắn máy dựng được + so tốc độ với máy gốc
pnpm series new <slug> "Tên"                 # khung series
pnpm series plan <slug>                      # plan.html để duyệt
pnpm series characters <slug>                # bảng nhân vật
pnpm series characters <slug> --huong        # bảng kiểm tra hướng cử chỉ (mọi tư thế khi quay phải / trái) → characters-huong.png
pnpm series ep <slug> <số>                   # khung tập
pnpm ep <thư-mục-tập> check|script|storyboard|voice|timing|audio|render [--preview]|all|studio
pnpm typecheck
pnpm ep <dir> all --gemini                  # bản voice Gemini TTS để so sánh
pnpm series styles                           # cập nhật danh mục phong cách lemo-opuscar
pnpm series export <slug>                    # chép mọi phim đã dựng vào thư mục phim chung (~/Movies/Xưởng phim)
uv run tools/materials/extract.py --out <dir> <file|thư mục>…   # đọc tư liệu Word/PDF/PPTX/XLSX/ảnh → văn bản + ảnh
node tools/tts/test.mjs                      # kiểm thử bộ chuẩn hoá lời đọc
```

## Mã nguồn
- `remotion/` — composition `Episode` (props = build/timed.json), `kit/` (theme, nền, phụ đề, nhân vật MISA, logo), `scenes/` (template), `custom/` (cảnh riêng từng tập).
- `shared/reveal.mjs` — lịch hiện mục, dùng chung cho hình và SFX (sửa một chỗ).
- `tools/web/ai.mjs` — Thiết lập AI (Claude Code / Codex, model + effort từng vai trò plan/script/fix/suggest; lưu `~/.config/xuong-phim/ai.json`; danh sách model Codex qua `codex app-server` lệnh `model/list`). Codex chạy `codex exec` hộp cát workspace-write, KHÔNG vẽ storyboard được (Chrome bị chặn) → máy chủ vẽ sau và gọi Codex sửa bố cục (`codexFollowUp`). `AGENTS.md` = hướng dẫn cho Codex. `tools/autostart.mjs` — tự mở khi bật máy.
- `tools/web/server.mjs` + `web/index.html` — trang web tại máy (không phụ thuộc thư viện): form ghi `brief.json` + `bible.json`; nút sáng tác gọi `claude -p` theo mục "Chế độ form" của skill; nút dựng phim chạy thẳng `tools/ep.mjs … all`. Chỉ nghe 127.0.0.1, mỗi lúc một việc; `tools/web/queue.mjs` — hàng đợi dựng lần lượt nhiều tập (lưu `~/.config/xuong-phim/queue.json`). `tools/web/drive.mjs` — kết nối Google Drive (OAuth máy tính + PKCE, quyền drive.file, tuỳ chọn thêm drive.readonly để lấy tư liệu; client/token ở `~/.config/xuong-phim/google.json`, ngoài repo). `tools/web/materials.mjs` — tư liệu (tải lên, đường dẫn, link Drive) + gọi `tools/materials/extract.py`. `tools/output.mjs` — thư mục phim chung.
- `Dockerfile` + `docker-compose.yml` + `docker/entrypoint.sh` — chạy cả xưởng trong Docker (VieNeu, Chrome headless, Claude CLI); dữ liệu ở volume (`series/`, thư mục phim, cấu hình, cache model).
- `setup.sh` + `tools/doctor.mjs` — cài/kiểm tra máy (macOS, Linux apt, Windows chạy thẳng bằng `setup.ps1` + winget — hoặc WSL2; `--thu` dựng tập mẫu `tools/selftest/thu-may`); hook SessionStart ở `.claude/settings.json` báo Claude khi máy chưa cài đủ.
- `tools/platform.mjs` — chạy đa nền tảng: `isMain(import.meta.url)` (KHÔNG so `file://${process.argv[1]}` — sai trên Windows), `which`/`spawnBin` (lần theo shim `.cmd` của npm/pnpm tới `.exe`/`.js`), `ttsVi()` (Windows gọi thẳng python của VieNeu theo `config.env`), đặt `PYTHONUTF8=1`. Mọi tiến trình con cần lệnh ngoài (claude, codex, npx, tts-vi) đi qua đây.
- `tools/` — timing.mjs, render.mjs, ep.mjs, series.mjs; `tools/audio/` — sfx_bank.py, music.py, mix.py (uv).
