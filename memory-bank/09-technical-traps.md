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

## 21. Đọc sai tên miền và viết tắt tiếng Anh
22/11/2026: "misa.vn" đọc sai, "MISA JSC", "APK" đọc lệch. Nguyên nhân: luật url cũ đánh vần cả cụm theo chữ cái tiếng Việt, và lexicon chạy SAU luật url nên tên thương hiệu trong link không được thay; series tự phiên âm kiểu "jây", "ây pi kê". Nay lexicon tính trước luật url, tên miền đọc theo bảng `TLD`, viết tắt theo `EN_LETTER`. Đừng thêm phiên âm vào `bible.pronounce` cho từ chung — thêm vào `tools/tts/lexicon.json` + ca trong `tools/tts/test.mjs`. Luật VOICE_OFF_TTS_RULES v5 đã duyệt (MISA JSC → "Công ty Cổ phần mi xa") thắng — chạy `node tools/tts/test.mjs` sau mỗi lần sửa.

## 22. Outro "Tập sau: Tập sau: …"
Outro cũ tự ghi tiền tố "Tập sau:" trong khi Claude cũng viết "Tập sau: …" vào `next` → lặp chữ. Hơn nữa người dùng chỉ duyệt một số tập và đăng không theo thứ tự nên "tập sau" thường sai. Đã bỏ hẳn `next` khỏi outro; `check` báo lỗi nếu còn `props.next`, cảnh báo câu có "tập sau/tập tới/tập tiếp theo". (Nhãn "TẬP n/N" ở đầu phim vẫn theo số tập của kế hoạch.)

## 23. Hàng đợi và khởi động lại / nút Dừng
Hàng đợi nằm trong máy chủ + `queue.json`. Khởi động lại khi đang dựng → tập dở quay lại đầu hàng và hàng TẠM DỪNG (cố ý). Nút Dừng cũng tạm dừng cả hàng — nếu không, dừng một tập lại tự nhảy sang tập kế, người dùng tưởng nút hỏng. `replaceChildren` với phần tử `null` in ra chữ "null" → luôn `.filter(Boolean)`.

## 24. Codex không vẽ được storyboard
`codex exec` chạy trong hộp cát macOS (seatbelt): Chrome headless chết ngay (`bootstrap_check_in … Permission denied`), Remotion bundler không mở được cổng (`listen EPERM`). Đừng chuyển Codex sang `danger-full-access` để chữa — máy chủ tự vẽ storyboard sau khi Codex xong (`codexFollowUp`) và đưa lỗi bố cục lại cho Codex.

## 25. "9:16" bị đọc thành "chín giờ mười sáu phút"
Luật giờ trong `normalize.mjs` bắt cả tỉ lệ khung hình. Luật `ratio` (đứng trước luật giờ) đọc "khung / tỉ lệ / định dạng / khổ 9:16 hoặc 16:9" → "chín trên mười sáu…"; giờ thật ("lúc 9:16") vẫn đọc là giờ.

## 26. Chụp màn hình bị lệch vùng zoom
Trang có `scroll-behavior: smooth` → đo vị trí ngay sau `scrollTo` là đo giữa lúc đang cuộn. `tools/huong-dan/chup.mjs` ép cuộn tức thì (`behavior: 'instant'`) và ẩn `#jobpill`; email (tài khoản Drive) bị thay bằng `tai-khoan@…` trước khi chụp.

## 27. Chạy trên Windows (không WSL)
Bốn bẫy đã gặp khi đưa xưởng chạy thẳng trên Windows: (1) so sánh `import.meta.url` với chuỗi `file://` + `process.argv[1]` luôn sai (URL là `file:///C:/…`) → script chạy rồi thoát im lặng, không báo lỗi — dùng `isMain()` trong `tools/platform.mjs`. (2) `spawn('claude'|'pnpm'|'npx'|'tts-vi')` không tìm được shim `.cmd`/`.ps1` của npm (CreateProcess chỉ tìm `.exe`) và `which` không có → dùng `which()`/`spawnBin()`: lần theo shim tới `.exe` hoặc `.js` thật rồi chạy bằng node, không qua shell (đối số có xuống dòng/ngoặc kép của `claude -p` sẽ hỏng nếu qua `cmd /c`). (3) Python in tiếng Việt qua ống bị lỗi `cp1252` → đặt `PYTHONUTF8=1` (platform.mjs làm sẵn) và `python -X utf8 -I` cho tts-vi (`-I` bỏ qua biến môi trường). (4) Remotion giải nén Chrome headless dở dang (chỉ còn `ABOUT`, `LICENSE`, thiếu `.exe`, hoặc antivirus xoá) → `setup.ps1` giải nén lại từ zip, nếu vẫn thiếu thì báo thêm `node_modules\.remotion` vào danh sách loại trừ. Thêm: PowerShell 5.1 đọc file UTF-8 không BOM thành sai dấu (`.ps1` phải có BOM), `Remove-Item` lỗi trên junction (dùng `cmd /c rmdir`), `node -p 'a.split(".")'` bị PowerShell nuốt dấu nháy (tránh truyền JS có nháy qua `-p`).

## 28. Phiên âm sai chính tả → VieNeu đánh vần lệch
Bảng `EN_LETTER` ghi K = "kây" (2026-11-22) để tránh "kê". Nhưng "kây" sai chính tả tiếng Việt (k chỉ đứng trước i/e/ê/y), bộ chuyển âm `sea_g2p` của VieNeu không coi là âm tiết tiếng Việt nên đọc thành "ka-â-xơ-cơm-phlếch-xi" (phiên âm `kˈaːˌeɪsˈɜːkəmflˌɛksˈi`) → APK, eKYC nghe lạ. Sửa: K = "cây" (`kˈəɪ`). `tools/tts/test.mjs` giờ quét mọi lời đọc trong `EN_LETTER` + `lexicon.json` và báo lỗi khi gặp k+a/ă/â/o/ô/ơ/u/ư, c+i/e/ê/y, g+e/ê, ng+i/e/ê. Soát một từ mới bằng bộ chuyển âm của VieNeu: `phonemize_text("…")` trong `vieneu_utils.phonemize_text` — ra chuỗi dài có `ˌ` là bị đọc kiểu tiếng Anh.

## 29. Chỉ sửa giọng (voice-fix) và tăng tốc dựng
Sửa một chữ trong lời đọc (vd. APK) trước đây phải dựng lại cả phim (~5 phút). `pnpm ep <dir> voice-fix` (nút "Chỉ sửa giọng"): đọc lại các câu đã đổi (voice có cache theo lời đọc), trộn lại tiếng, rồi ghép tiếng mới vào MP4 cũ bằng ffmpeg `-c:v copy` (~20 giây). Điều kiện để giữ hình: `build/rendered.json` (bản timed.json của lần dựng gần nhất, ghi sau mỗi lần dựng đầy đủ) phải trùng khớp với timing mô phỏng khi giữ nguyên độ dài khe của từng câu (`buildTiming(…, { durOverride, write: false })`) — tức hình, chữ trên màn hình, phụ đề hiển thị và số câu không đổi. Câu mới dài hơn khe ≤ 12% → `atempo` nói nhanh cho vừa (`build/voice-fit/`); ngắn hơn ≥ 70% khe → để lặng phần thừa; ngoài khoảng đó, hoặc chưa có MP4 / `rendered.json` (tập dựng trước khi có lệnh này: dùng `timed.json` nếu cũ hơn MP4) → tự dựng lại đầy đủ và in lý do. Hệ quả: miệng nhân vật vẫn mấp máy theo độ dài câu cũ (lệch nhẹ, chấp nhận được); phụ đề `.srt` giữ mốc thời gian cũ.
Tăng tốc dựng (`tools/render.mjs`): trên Windows mặc định `chromiumOptions.gl = 'angle'` (GPU qua Direct3D) — đo trên máy Windows có GPU: 600 khung 31,9 s (CPU, 4 luồng) → 18,7 s (ANGLE, 8 luồng), cả tập 11 298 s → 116 s, SSIM so với bản CPU 0,995 (không thấy khác). Trên Mac ANGLE lại chậm hơn (mục GPU ở 07) nên chỉ bật cho win32. Số luồng mặc định = nửa số nhân, kẹp 2–8 (trên 8 không nhanh hơn). Nếu vẽ bằng GPU lỗi (đã gặp một lần "Target closed") → tự vẽ lại bằng CPU. Ghi đè: `XUONG_GL=angle|swangle|default`, `XUONG_CONCURRENCY=6` hoặc `50%`. Đã thử `x264Preset: veryfast`: nhanh thêm ~10% nhưng file lớn và kém nét hơn → không dùng.

## 30. Chạy khi bật máy (Task Scheduler, chưa đăng nhập)
Tác vụ "Xuong phim" kiểu S4U (tài khoản của người dùng, không lưu mật khẩu, chạy ở session 0). Ba bẫy đã gặp khi thử thật (2026-11-25): (1) Ban đầu tác vụ chạy `cmd /c chay-nen.cmd … >> xuong-phim.log` → `cmd` thoát ngay mã 1, không có dòng nhật ký nào: tệp nhật ký đang bị `cmd.exe` của bản "tự mở khi đăng nhập" (.vbs) giữ. Bản bật máy ghi tệp riêng `xuong-phim-nen.log`. (2) `schtasks /end` chỉ giết `cmd.exe`, `node` con chạy tiếp (mồ côi, vẫn giữ cổng). (3) Tài khoản thường **không** tắt được tiến trình S4U của chính mình (`Stop-Process` → Access denied) → `killServer()` vô dụng với bản nền. Sửa: hành động của tác vụ là thẳng `node.exe tools\boot.mjs <thư mục cấu hình>` (không qua cmd); `boot.mjs` đọc `chay-nen.json` (PATH, PORT, nhật ký), tự ghi nhật ký rồi gọi `server.main()`. Khởi động lại = `schtasks /end` + `/run` (tài khoản thường làm được với tác vụ của mình); tạo/gỡ tác vụ (`quan-tri.ps1`, có UAC) còn dọn node session 0 sót lại. Đã thử trong session 0: thấy đủ công cụ (doctor), VieNeu đọc được, vẽ tập mẫu 253 khung 9 s — bằng khi đăng nhập (card đồ hoạ vẫn dùng được; tập dài chưa đo). Máy tham gia domain: S4U chạy được với tài khoản domain (`MISA_DEVELOP\…`).

## 32. Dựng lại theo đề bài mới · bản mới đè bản cũ
Trước đây watermark đọc lại từ bible lúc timing, nhưng nhân vật lấy từ `episode.characters` (AI chép từ bible lúc viết) → sửa tạo hình trong đề bài rồi dựng lại vẫn ra nhân vật cũ. `castOf(bible, episode)` (lib.mjs) ghép theo `id`, ghi đè các trường tạo hình/giọng (`LOOK`) từ bible; trường AI thêm riêng (vd `age`) chỉ bị bỏ khi bible lưu SAU episode.json (`markBrief` gắn `_briefNewer` không liệt kê được, để không ghi vào file). Mọi chỗ cần nhân vật (check, voice, timing, episodeLines) phải qua `castOf`. Đề bài "Không gắn thương hiệu" (`brief.logo = none`) cũng phải thắng kịch bản: AI từng vẫn ghi `outro.logo: "misa"` → phim có logo MISA ở cảnh kết; nay timing bỏ logo (`unbrandProps`, `castFor` đặt `logo: false`) và ghi `timed.brand` để `renderDrift` báo "thương hiệu". Phát hiện "cần dựng lại": so `build/rendered.json` (dự phòng `timed.json` nếu không mới hơn MP4) với đề bài hiện tại bằng `canon` (JSON khoá sắp xếp). Dựng: Remotion ghi thẳng `out/epNN.mp4` thì bấm dừng giữa chừng sẽ mất phim cũ → vẽ ra `.dang-dung.mp4` rồi `renameSync` (Windows: trình xem phim đang mở file → EBUSY/EPERM, thử lại 10 lần × 1,5 s rồi báo, bản mới để nguyên ở `.dang-dung.mp4`). Timing cũng từng ghi thẳng `out/epNN.srt` → dừng giữa chừng thì phụ đề mới đi với phim cũ; nay ghi `build/` và `syncSrt` sau khi dựng xong.

## 33. Đăng mạng xã hội (tra tài liệu 27/11/2026)
- **Meta**: Graph `v27.0`. Redirect `http://localhost` chỉ được khi ứng dụng ở Development mode (Strict Mode khớp chính xác) → hướng dẫn giữ Development + người dùng là quản trị ứng dụng (không cần App Review). Ứng dụng kiểu Business dùng `config_id` (Facebook Login for Business) thay `scope`. Không có refresh token: token người dùng dài hạn ~60 ngày, token Trang không hết hạn (lỗi 190 → đánh dấu `broken`, nhắc kết nối lại). Reels Facebook: `/{page}/video_reels` start → POST nhị phân lên `rupload.facebook.com` (header `Authorization: OAuth <token Trang>`, `offset: 0`, `file_size`) → finish `video_state=PUBLISHED` → hỏi `status`; **3–90 giây**, 30 Reels/Trang/ngày. Instagram: container `media_type=REELS&upload_type=resumable` → rupload `ig-api-upload` → chờ `status_code=FINISHED` → `media_publish`; caption ≤ 2200, 100 bài/ngày.
- **YouTube**: OAuth client Desktop của Drive (loopback 127.0.0.1 + PKCE base64url), scope `youtube.upload` + `youtube.readonly`; consent screen External để "Testing" thì refresh token hết hạn sau 7 ngày → hướng dẫn Publish app. `videos.insert` resumable; từ 02/11/2026 dự án chưa xác minh KHÔNG còn bị ép Riêng tư (vẫn có thể Riêng tư theo thiết lập kênh → báo `note`). 100 lượt tải/ngày/dự án. Không có cờ Shorts: dọc + ≤ 3 phút là Shorts. Khai báo `paidProductPlacementDetails.hasPaidProductPlacement=false` (từ 16/11/2026 không còn mặc định).
- **TikTok**: Login Kit **Desktop** (Web bắt buộc https) cho phép `http://localhost:<cổng>`; PKCE bắt buộc và `code_challenge` là **SHA256 dạng hex** (không phải base64url). Access token ~2 giờ; mỗi lần làm mới trả refresh token MỚI (cũ hết dùng) → lưu lại mỗi lần. Đăng thẳng: `creator_info` (phải hiện tên người đăng, chọn ai xem không mặc định, bình luận/Duet/Stitch mặc định tắt, câu "Music Usage Confirmation") → `video/init` FILE_UPLOAD (≤ 64 MB một khúc; lớn hơn khúc 32 MB, khúc cuối gánh dư) → PUT `Content-Range` → `status/fetch`. Ứng dụng chưa audit: chỉ `SELF_ONLY` + tài khoản riêng tư (`unaudited_client_can_only_post_to_private_accounts`) → có lựa chọn "Gửi vào hộp thư" (`inbox/video/init`, scope `video.upload`, ≤ 5 video chờ/ngày).
- Kiểm thử: `XUONG_SOCIAL_BASE=http://127.0.0.1:<cổng>` trỏ mọi nền tảng về máy giả (OAuth, Graph, rupload, YouTube, TikTok); lịch kiểm mỗi 1 giây khi giả lập. Chưa đăng thật lên nền tảng nào (cần ứng dụng của người dùng).

## 31. Mở từ xa (Tailscale) và bot Telegram
"Từ xa" xác định theo **cổng nghe nhận yêu cầu** (`req.socket.localAddress` không phải loopback = vào qua cổng nghe trên địa chỉ Tailscale), không theo địa chỉ máy gửi: thử bằng 127.0.0.2 thì máy gửi vẫn là 127.0.0.1. Máy gửi còn phải thuộc 100.64.0.0/10. Máy chủ chỉ nghe thêm trên từng IP Tailscale (soát mỗi 30 giây vì Tailscale có thể lên sau), không bao giờ `0.0.0.0`. Tường lửa: tạo sẵn quy tắc cho **chương trình** node.exe + cổng + dải Tailscale (`quan-tri.ps1 fw-on`) — nếu để Windows tự hỏi và người dùng bấm Cancel, Windows thêm quy tắc CHẶN node.exe, mà quy tắc chặn thắng quy tắc cho phép; đổi bản Node (đường dẫn khác) thì phải mở lại. Kiểm thử không cần Tailscale: `XUONG_REMOTE_TEST_IP=127.0.0.2` (coi địa chỉ đó là Tailscale; khi bật thì bỏ qua bước mở tường lửa). Telegram: bot hỏi tin bằng long polling (`getUpdates`, không cần mở cổng); liên kết bằng mã 6 số (`/start <mã>`, link `t.me/<bot>?start=<mã>` tự gửi), chat khác bị bỏ qua; lệnh gọi lại chính API của máy chủ (127.0.0.1 + `x-xuong`) nên dùng chung kiểm tra/hàng đợi với trang. Không có lệnh `/dung` (dễ đọc nhầm "dựng"/"dừng") — dùng `/dungphim` và `/huy`. Một bot chỉ một máy (máy thứ hai hỏi tin → Telegram trả 409). Gửi video giới hạn 50 MB (quá thì gửi link Drive nếu có). `/seriesmoi`: tạo mới hoàn toàn gọi `POST /api/series` với dàn nhân vật dựng sẵn (`CASTS` trong telegram.mjs: nhân viên MISA polo vàng / văn phòng / không nhân vật — 2 người có nam có nữ như form trang web), nhân bản gọi `/clone`; cả hai xong thì tự chạy việc `plan`. Nút `nok` chỉ nhận khi đã tới bước xác nhận. Nút bấm: `callback_data` tối đa 64 byte → mang mã ngắn của series (`sk` = 8 ký tự base64url của sha1(slug)), tra lại bằng `/api/series`; nút của series đã xoá báo "Không còn series này". Góp ý / lưu ý / các bước tạo series chờ tin nhắn chữ kế tiếp (lưu trong bộ nhớ theo chat, hết hạn 30 phút, `/huybo` để thôi) → máy chủ khởi động lại thì phải bấm lại. Góp ý đi qua `feedback` của `/jobs` nên AI đọc từ `.studio/gop-y.md`, không nằm trên dòng lệnh. Ảnh storyboard gửi album `sendMediaGroup` (tối đa 10 ảnh/album; 1 ảnh lẻ thì `sendPhoto`); trường `reply_markup` trong multipart là chuỗi JSON. Kiểm thử với Telegram giả: `XUONG_TELEGRAM_BASE=http://127.0.0.1:<cổng>`; việc AI thử bằng claude giả `STUDIO_CLAUDE_BIN=<file .mjs>` rồi `/api/job/stop`.
