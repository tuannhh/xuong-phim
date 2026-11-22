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

## 10. `pnpm setup` không chạy script "setup" của repo
**Triệu chứng:** tài liệu cũ ghi `pnpm setup`, chạy xong không cài gì của xưởng.
**Nguyên nhân:** `setup` là lệnh có sẵn của pnpm (cấu hình PNPM_HOME), được ưu tiên hơn script cùng tên.
**Xử lý:** cài bằng `bash setup.sh` (hoặc `pnpm run setup`). **Bài học:** không đặt tên script trùng lệnh có sẵn của pnpm/npm (setup, install, add, update…), hoặc luôn gọi bằng `pnpm run`.

## 11. Khung trình duyệt của Claude Desktop đọc `launch.json` theo thư mục của phiên
Phiên mở ở `~` đọc `~/.claude/launch.json` (có cấu hình `xuong-series`); phiên mở ở thư mục xưởng đọc `.claude/launch.json` của repo (cấu hình `xuong-phim`). Thêm cấu hình tạm để thử phải thêm đúng file, xong thì gỡ.

## 12. Kiểm thử Drive bằng máy chủ giả lập không được ghi vào series thật
Thử Drive giả lập (`STUDIO_GOOGLE_BASE`) mà dùng series thật sẽ để lại `.studio/drive.json` và `out/drive.json` trỏ tới link giả → trang báo "đã đẩy" sai. Thử trên series tạm và xoá hai file đó sau khi thử.

## 13. Ảnh tư liệu bị cắt mất nội dung
Cảnh `photo` dùng `object-fit: cover`: ảnh ngang trong khung gần vuông (9:16) bị cắt hai bên. Luôn đặt `ratio` = cao/rộng (index.md có kích thước) để khung theo đúng tỉ lệ ảnh; ảnh có chữ/biểu đồ thì thêm `fit: "contain"`.

## 14. Tư liệu nằm ngoài thư mục gắn vào Docker
Trong Docker, đường dẫn trên máy chỉ đọc được nếu nằm trong `TU_LIEU_DIR` (gắn cùng đường dẫn, chỉ-đọc). Đường dẫn khác → bước chuẩn bị báo "Không thấy trên máy … (trong Docker chỉ thấy thư mục đã gắn qua TU_LIEU_DIR)". Cách khác: kéo thả file vào form.

## 15. Tên file tải lên thành file ẩn
Làm sạch tên phải bỏ dấu chấm đầu SAU khi thay ký tự cấm + gộp khoảng trắng; làm trước thì `../../x` thành `.. x` (file ẩn, không hiện trong danh sách).

## 16. `fs.cpSync` hỏng khi chạy trong Docker trên Mac
Bản native `fs.cpSync(..., {recursive:true})` của Node 24 trên thư mục gắn từ macOS (Docker Desktop) tạo file với quyền chỉ-ghi (`--w-------`) rồi báo `EACCES` → dựng phim trong container lỗi ở `preparePublic`. `copyFileSync` từng file thì chạy được. Luôn dùng `copyDir()` trong `tools/lib.mjs`, không dùng `fs.cpSync`.

## 17. Tay cử chỉ "bị ngược" (mở ra sau lưng)
Tư thế trong `POSES` viết một chiều (tay chính là `R` = bên phải khung vẽ). Trước đây vẽ nguyên như vậy bất kể nhân vật đang quay về đâu: người ngồi bên trái nói với người bên phải dùng `giai-thich` thì tay trái mở ngang sang trái — mặt quay phải, tay vung ra sau lưng; người đứng bên phải dùng `chi` thì chỉ ra ngoài khung hình. Nay `orientPose(pose, dir, fold)` trong `remotion/kit/Character.tsx` tự xoay: một tay mở nằm phía xa → lật trái–phải cả tư thế; hai tay mở + đang nói với bạn diễn → tay phía xa gập trước bụng (`FAR_FOLD`). `dir` do cảnh truyền qua `face` (bạn diễn gần nhất, CỐ ĐỊNH cả cảnh — đừng lấy theo người đang nói kẻo tay giật khi đổi người nói) hoặc `aim` (một mình, lệch bên → quay vào giữa, không gập).
- Chỉ lật cử chỉ đưa tay NGANG (`armOpen`: cổ tay ra ngoài ≥ 0.25 và ngang ngực–bụng). Tay giơ thẳng cạnh vai (`chao`, `vui`, `like`) không lật: lật sang phía bạn diễn làm hai bàn tay chạm nhau ở cảnh cận (đã thử, hỏng).
- Lắc tay khi nói và vẫy tay đi theo tay chính sau khi lật (`mir`, `gL`/`gR`) — thêm tư thế có cử chỉ thì giữ cặp này.
- `flip` lật cả khung vẽ nên `look`/`turn`/`face`/`aim` (tính theo màn hình) phải nhân `sx` trong `Person`; quên là nhân vật lật nhìn và đưa tay ngược phía.
- Bảng soát: `pnpm series characters <slug> --huong` → `characters-huong.png` (không commit).

## 18. Ba lỗi vẽ làm cánh tay trông "ngược" (chủ dự án báo hai lần, 22/11/2026)
Sửa hướng cử chỉ (bẫy 17) chưa đủ — cùng lỗi "tay ngược" còn do chính cách vẽ cánh tay trong `Arm` (`remotion/kit/Character.tsx`):
1. **Thứ tự lớp**: trước đây vẽ cẳng tay rồi mới vẽ bắp tay + tay áo đè lên → tay giơ lên (ôm đầu, nghĩ, nghe máy, vẫy) trông như luồn ra SAU vai/tay áo. Nay bắp tay + tay áo vẽ trước (`upper`), cẳng tay + bàn tay vẽ sau (`fore`), mỗi nhóm một lượt viền–tô riêng; đoạn cuối bắp tay được tô đè lại (`kJ`) để không lộ nét viền đầu tròn cẳng tay ở khuỷu. Đừng gộp lại một `Two`.
2. **Phía ngón cái**: trước đây đoán theo góc cẳng tay ("vào trong / lên trên") → bàn tay xoè có lúc ra hình bàn tay bên kia, và có thể nhảy phía khi tay lắc. Nay bàn tay xoè (`open`, `palm`) luôn vẽ nhìn từ mu bàn tay, ngón cái cố định theo TAY (`tx = side`). Không vẽ nếp lòng bàn tay nữa.
3. **Dáng chữ L sát sườn**: ghim khuỷu sát sườn (`LOW`) rồi bẻ cẳng tay ngang ra ngoài trông như gãy khuỷu. Tay MỞ RA phía ngoài dùng khuỷu `OUT` (bắp tay nghiêng ~20°), cổ tay ra xa hơn, góc khuỷu rộng; `LOW` chỉ dùng cho tay gập vào trong / tay nghỉ. `om-dau`: khuỷu đưa ngang ra, bàn tay lên đầu.
Chủ dự án đã xem 3 phương án A/B/C trên cùng một cảnh và yêu cầu áp cả ba. Soát bằng `pnpm series characters <slug>` (nhìn thẳng) và `--huong` (quay phải/trái).

## 19. Dựng lại Docker cắt ngang việc người dùng đang chạy
22/11/2026: lệnh kiểm tra `/api/job` in ra `running` nhưng chuỗi lệnh vẫn chạy tiếp `docker compose up -d` → việc "Dựng phim" tập 1 người dùng vừa bấm bị giết ở bước voice (5/29 câu). Phải bấm dựng lại. Luật 19 trong `11-coding-rules.md`.

## 20. Tiến độ dựng phim đứng yên trên trang (phim vẫn dựng bình thường)
22/11/2026 tập 1 đứng "render 35%" nhiều phút trong khi khung hình vẫn ra đều. Hai lỗi chồng nhau trong `tools/render.mjs`:
1. Chỉ in khi `p % 5 === 0` — `onProgress` của Remotion nhảy cóc (36 → 38 → 41…), lỡ mốc là không in nữa. Nay in khi qua mốc (`b > last`, với `b = p - p % 5`), kèm `khung x/y` để thấy máy còn chạy.
2. In bằng `\r`: máy chủ web (`pipeLines`) cắt theo dòng nên phần sau `\r` cuối cùng nằm chờ trong bộ đệm tới lần in sau → trang luôn chậm một nhịp, và mốc cuối không bao giờ hiện. Nay `progressLine()`: `\r` khi stdout là terminal, `\n` khi là pipe. Dòng tiến độ mới vẫn phải bắt đầu bằng `render <số>` / `ảnh <số>` để `logLine` ghi đè dòng cũ thay vì thêm dòng.
