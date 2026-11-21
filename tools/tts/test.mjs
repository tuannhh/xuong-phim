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
  ['vào nganhang-xacminh.top ngay', 'vào nganhang gạch ngang xacminh chấm top ngay'],
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
