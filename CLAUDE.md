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
- Nội dung an ninh mạng: tấn công không chỉ nhắm Android (file APK) hay máy tính Windows — iPhone và MacBook cũng bị (hồ sơ cấu hình lạ, app ngoài App Store, file .dmg/.pkg, trang đăng nhập giả). Không để người xem hiểu iPhone/Mac là an toàn; lời khuyên nêu cho mọi thiết bị (chi tiết: skill mục 2).
- Logo MISA (`assets/brand/`) là tài sản thương hiệu MISA: giữ nguyên hình, không đổi màu trừ bản một màu trên nền tối. LUÔN dùng bản đầy đủ có khẩu hiệu "Tin cậy – Tiện ích – Tận tình" (component `MisaLogo`), không dùng bản chỉ có chữ MISA.
- Các bước sáng tác chạy bằng Claude Code hoặc Codex (người dùng chọn ở Thiết lập); quy tắc ở file này dùng chung cho mọi agent.
- Không tự đăng video lên mạng xã hội: `tools/web/social.mjs` chỉ đăng khi người dùng bấm Đăng (đã tích "đã xem lại" / bấm Xác nhận trên Telegram) hoặc tự đặt lịch; agent không tạo bài đăng thay người dùng. Đẩy lên Google Drive của chính người dùng chỉ khi họ bấm nút hoặc bật "tự đẩy" cho series.
- Được gọi từ trang web (câu lệnh có "Chế độ form"): không hỏi lại, không Artifact/SendUserFile/commit, làm đúng một giai đoạn (`plan` / `plan-add` (đợt thêm tập — chỉ thêm tập mới, không sửa tập cũ) / `script <n>` / `fix <n>`) rồi dừng; giả định ghi vào `series/<slug>/.studio/ghi-chu.md`.
- Font: Barlow (tiêu đề) + Google Sans (nội dung). Không để chữ đè chữ / đè nhân vật — storyboard phải báo `✓ bố cục`.
- Nhân vật vẽ dáng người thật, đầy đặn, đầu–thân cân đối; khuỷu tay gần thân, không giơ hai tay quá đầu (người dùng chê dáng còm nhom, tay chân lòng khòng). Phim tình huống dùng cảnh `story` (bối cảnh nhiều lớp, máy quay, nhãn bật).
- Tay cử chỉ phải hướng về người nghe: nhân vật quay mặt sang một phía thì tay đưa ra ở phía đó, tay kia gập trước bụng — không mở ngang ra sau lưng (người dùng báo lỗi "tay bị ngược" 22/11/2026). Luật nằm ở `orientPose` trong `remotion/kit/Character.tsx`; sửa tư thế xong chạy `pnpm series characters <slug> --huong` để soát. Cùng lỗi này còn do cách vẽ: cẳng tay phải nằm lớp trên bắp tay/tay áo, ngón cái bàn tay xoè cố định theo tay, tay mở ra ngoài không gập chữ L sát sườn (memory-bank bẫy 18).
- Mỗi tập nhiều nhân vật nam + nữ; nhân vật nam giọng nam, nữ giọng nữ (`check` chặn nếu sai). MISA đọc là "mi xa"; tên miền/viết tắt tiếng Anh tự chuẩn hoá (misa.vn → "mi xa chấm vi en", APK → "ây pi cây"; phiên âm phải đúng chính tả tiếng Việt — "kây"/"ka" sai, VieNeu đọc lệch) — sửa cách đọc ở `tools/tts/lexicon.json` + ca kiểm thử.
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
node tools/autostart.mjs boot-on|boot-off   # Windows: chạy ngay khi bật máy, chưa cần đăng nhập (Task Scheduler S4U → tools/boot.mjs; UAC)
node tools/huong-dan/chup.mjs                # chụp lại màn hình cho video hướng dẫn + tự điền vùng zoom vào episode.json
pnpm thu-may                                 # dựng thật tập mẫu ~9 giây trong thư mục tạm → chắc chắn máy dựng được + so tốc độ với máy gốc
pnpm series new <slug> "Tên"                 # khung series
pnpm series plan <slug>                      # plan.html để duyệt
pnpm series characters <slug>                # bảng nhân vật
pnpm series characters <slug> --huong        # bảng kiểm tra hướng cử chỉ (mọi tư thế khi quay phải / trái) → characters-huong.png
pnpm series ep <slug> <số>                   # khung tập
pnpm ep <thư-mục-tập> check|script|storyboard|voice|timing|audio|render [--preview]|all|studio
pnpm ep <thư-mục-tập> voice-fix            # chỉ sửa giọng: đọc lại câu đổi + ghép tiếng vào MP4 cũ (~20 s), tự dựng lại đầy đủ nếu hình đổi
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
- `tools/web/ai.mjs` — Thiết lập AI (Claude Code / Codex, model + effort từng vai trò plan/script/fix/suggest; lưu `~/.config/xuong-phim/ai.json`; danh sách model Codex qua `codex app-server` lệnh `model/list`). Codex chạy `codex exec` hộp cát workspace-write, KHÔNG vẽ storyboard được (Chrome bị chặn) → máy chủ vẽ sau và gọi Codex sửa bố cục (`codexFollowUp`). `AGENTS.md` = hướng dẫn cho Codex. `tools/autostart.mjs` — tự mở khi đăng nhập + (Windows) chạy khi bật máy (`tools/boot.mjs`, `tools/windows/quan-tri.ps1` qua UAC: tác vụ Task Scheduler + tường lửa).
- `tools/web/post.mjs` — bài đăng mạng xã hội sau mỗi tập (AI vai trò `post`: bản ngắn < 100 từ, bản dài < 300 từ, bám kịch bản + thông điệp series) → `episodes/epNN/bai-dang.json` + file `- Bài đăng.txt` cạnh MP4; tự viết sau khi dựng xong.
- `tools/web/social.mjs` — đăng phim lên Facebook Reels / Instagram / YouTube / TikTok của người dùng (ứng dụng + token ở `~/.config/xuong-phim/social.json`, lịch ở `social-posts.json`; đăng ngay / hẹn giờ trong máy chủ; `XUONG_SOCIAL_BASE` = máy giả để kiểm thử). Chi tiết API + giới hạn: memory-bank bẫy 33.
- `tools/web/telegram.mjs` — bot Telegram (báo xong/lỗi kèm nút bước tiếp; làm trọn quy trình từ điện thoại: tạo series bằng chat, duyệt kế hoạch, viết kịch bản, album storyboard, góp ý, xem phim, bài đăng `/baidang`, duyệt kịch bản toàn bộ `/duyetkb`, đăng mạng xã hội `/dang` + `/lichdang`, nhắc đăng TikTok (gửi video nén ≤ 50 MB + nội dung đến giờ hẹn), bảng nhân vật; long polling, gọi lại API của máy chủ; cấu hình `~/.config/xuong-phim/telegram.json`). `tools/web/remote.mjs` + `web/login.html` — mở từ xa qua Tailscale có mật khẩu (`remote.json`); thiết lập máy chỉ đổi được tại máy.
- `tools/web/server.mjs` + `web/index.html` — trang web tại máy (không phụ thuộc thư viện): form ghi `brief.json` + `bible.json`; nút sáng tác gọi `claude -p` theo mục "Chế độ form" của skill; nút dựng phim chạy thẳng `tools/ep.mjs … all`. Chỉ nghe 127.0.0.1, mỗi lúc một việc; `tools/web/queue.mjs` — hàng đợi dựng lần lượt nhiều tập (lưu `~/.config/xuong-phim/queue.json`). `tools/web/drive.mjs` — kết nối Google Drive (OAuth máy tính + PKCE, quyền drive.file, tuỳ chọn thêm drive.readonly để lấy tư liệu; client/token ở `~/.config/xuong-phim/google.json`, ngoài repo). `tools/web/materials.mjs` — tư liệu (tải lên, đường dẫn, link Drive) + gọi `tools/materials/extract.py`. `tools/output.mjs` — thư mục phim chung.
- `Dockerfile` + `docker-compose.yml` + `docker/entrypoint.sh` — chạy cả xưởng trong Docker (VieNeu, Chrome headless, Claude CLI); dữ liệu ở volume (`series/`, thư mục phim, cấu hình, cache model).
- `setup.sh` + `tools/doctor.mjs` — cài/kiểm tra máy (macOS, Linux apt, Windows chạy thẳng bằng `setup.ps1` + winget — hoặc WSL2; `--thu` dựng tập mẫu `tools/selftest/thu-may`); hook SessionStart ở `.claude/settings.json` báo Claude khi máy chưa cài đủ.
- `tools/platform.mjs` — chạy đa nền tảng: `isMain(import.meta.url)` (KHÔNG so `file://${process.argv[1]}` — sai trên Windows), `which`/`spawnBin` (lần theo shim `.cmd` của npm/pnpm tới `.exe`/`.js`), `ttsVi()` (Windows gọi thẳng python của VieNeu theo `config.env`), đặt `PYTHONUTF8=1`. Mọi tiến trình con cần lệnh ngoài (claude, codex, npx, tts-vi) đi qua đây.
- `tools/` — timing.mjs, render.mjs, ep.mjs, series.mjs; `tools/audio/` — sfx_bank.py, music.py, mix.py (uv).
