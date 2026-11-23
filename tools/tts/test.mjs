// Đối chiếu bộ chuẩn hoá với các ca kiểm thử trích từ VOICE_OFF_TTS_RULES v5 (§38–48) + ca riêng của xưởng.
// node tools/tts/test.mjs
import fs from 'node:fs';
import { normalize } from './normalize.mjs';
const cases = JSON.parse(fs.readFileSync(new URL('./rules-tests.json', import.meta.url))).filter((c) => c.src !== 'source');
const extra = [
  ['MISA tổ chức Demo AI Agent cho CEO.', 'mi xa tổ chức Demo AI Agent cho CEO.', 'gemini'],
  ['Người MISA cần cảnh giác.', 'Người mi xa cần cảnh giác.'],
  ['Họp lúc 08:30 tại VP HAN.', 'Họp lúc tám giờ ba mươi phút tại Văn phòng Hà Nội.', 'gemini'],
  ['Hẹn 8 AM nhé', 'Hẹn tám giờ sáng nhé', 'gemini'],
  ['Chuyển ngay 30 triệu', 'Chuyển ngay ba mươi triệu', 'gemini'],
  ['Phí 1.000.000đ', 'Phí một triệu đồng', 'gemini'],
  ['tỷ lệ 16:9', 'tỷ lệ mười sáu trên chín', 'gemini'],
  ['TB Pháp chế đã tăng năng suất cho mỗi người trong ban TB 300%', 'Trưởng ban Pháp chế đã tăng năng suất cho mỗi người trong ban trung bình ba trăm phần trăm', 'gemini'],
  ['giai đoạn 1994–2026', 'giai đoạn một chín chín tư đến hai không hai sáu', 'gemini'],
  ['Năm 2026, doanh nghiệp đặt mục tiêu 2026 khách hàng.', 'Năm hai không hai sáu, doanh nghiệp đặt mục tiêu hai nghìn không trăm hai mươi sáu khách hàng.', 'gemini'],
  ['1.005', 'một nghìn không trăm linh năm'], ['1.024', 'một nghìn không trăm hai mươi tư'], ['1.000.005', 'một triệu không trăm linh năm'],
  ['Đừng bấm link lạ trên Zalo', 'Đừng bấm linh lạ trên Da lô', 'vieneu'],
  ['vào nganhang-xacminh.top ngay', 'vào nganhang gạch ngang xacminh chấm tóp ngay'],
  // người dùng 2026-11-22: tên miền, viết tắt công nghệ, tên thương hiệu dính liền
  ['Chỉ mua và đăng nhập tại misa.vn.', 'Chỉ mua và đăng nhập tại mi xa chấm vi en.'],
  ['Vào https://www.misa.vn/san-pham nhé', 'Vào vê kép vê kép vê kép chấm mi xa chấm vi en gạch chéo san pham nhé'],
  ['Tên miền thêm chữ lạ như misavpn.com, misasme.com đều là giả.', 'Tên miền thêm chữ lạ như mi xa vi pi en chấm com, mi xa ét em i chấm com đều là giả.'],
  ['Tên miền như misavpn, misasme, misavnp', 'Tên miền như mi xa vi pi en, mi xa ét em i, mi xa vi en pi'],
  ['Tin chính thức xem ở fanpage MISAJSC.', 'Tin chính thức xem ở fanpage mi xa giây ét xi.'],
  ['bắt tải file APK hoặc IPA', 'bắt tải file ây pi kây hoặc ai pi ây'],
  // tỉ lệ khung hình không đọc thành giờ (video hướng dẫn 2026-11-23)
  ['Khung hình 9:16 hoặc 16:9', 'Khung hình chín trên mười sáu hoặc mười sáu trên chín'],
  ['tỉ lệ 1:1 cho Facebook', 'tỉ lệ một trên một cho Facebook'],
  ['Họp lúc 9:16 nhé', 'Họp lúc chín giờ mười sáu phút nhé'],
];
let ok = 0, bad = 0;
const check = (src, want, engine = 'gemini') => {
  const got = normalize(src, { engine }).say;
  if (got === want) ok++; else { bad++; console.log(`✗ ${src}\n   muốn: ${want}\n   ra:   ${got}`); }
};
// quy ước người dùng: MISA → "mi xa" (thay cho "MISA" giữ nguyên trong tài liệu gốc)
for (const c of cases) check(c.src, c.want.replace(/MISA/g, 'mi xa'));
for (const [s, w, e] of extra) check(s, w, e);
console.log(`\n${ok}/${ok + bad} đạt`);
process.exit(bad ? 1 : 0);
