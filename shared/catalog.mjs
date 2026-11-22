// Danh mục dùng chung cho trang web, máy chủ và `tools/ep.mjs check`: trang phục, kiểu tóc, bối cảnh, mascot.
// Thêm một mục ở đây = trang web hiện lựa chọn + check chấp nhận. Phần vẽ nằm ở remotion/kit/Character.tsx (trang phục, tóc, mascot)
// và remotion/kit/Sets.tsx (bối cảnh) — hai nơi phải khớp id với file này.

// Trang phục. gender: 'nam' | 'nu' | 'ca' (cả hai). misa = polo vàng đồng phục MISA (mặc định).
export const KINDS = {
  misa: { label: 'Polo MISA (vàng + logo)', gender: 'ca' },
  'so-mi': { label: 'Sơ mi', gender: 'ca' },
  vest: { label: 'Vest', gender: 'ca' },
  hoodie: { label: 'Hoodie', gender: 'ca' },
  'ao-thun': { label: 'Áo thun', gender: 'ca' },
  cardigan: { label: 'Cardigan', gender: 'ca' },
  'ao-dai': { label: 'Áo dài', gender: 'ca' },
  'vay-lien': { label: 'Váy liền', gender: 'nu' },
  'blazer-nu': { label: 'Blazer + áo blouse', gender: 'nu' },
  'ao-len': { label: 'Áo len', gender: 'ca' },
  polo: { label: 'Polo trơn (không logo)', gender: 'ca' },
  'ao-khoac': { label: 'Áo khoác bomber', gender: 'ca' },
  'dong-phuc': { label: 'Đồng phục công việc', gender: 'ca' },
  'ao-so-mi-ke': { label: 'Sơ mi kẻ ô', gender: 'ca' },
};

// Kiểu tóc theo giới.
export const HAIRS = {
  nam: { ngan: 'ngắn', vuot: 'vuốt ngược', tia: 'tỉa', xoan: 'xoăn', hoi: 'hói', 'hui-cua': 'húi cua', mai: 'mái ngố', 're-ngoi': 'rẽ ngôi lệch', undercut: 'undercut', 'dai-buoc': 'dài buộc sau' },
  nu: { dai: 'dài', buoc: 'buộc đuôi', bob: 'bob', bui: 'búi', 'xoa-dai': 'dài xoã gợn sóng', 'duoi-ngua': 'đuôi ngựa cao', 'toc-ngan': 'tém (pixie)', 'mai-thua': 'dài mái thưa', 'toc-tet': 'tết bím' },
};

// Bối cảnh cảnh `story`. times: các buổi vẽ được (mục đầu = mặc định).
export const SETS = {
  'van-phong': { label: 'Văn phòng', times: ['ngay', 'chieu', 'toi'] },
  nha: { label: 'Ở nhà', times: ['dem', 'ngay'] },
  'hang-o': { label: 'Sào huyệt kẻ gian', times: ['toi'] },
  'quan-ca-phe': { label: 'Quán cà phê', times: ['ngay', 'toi'] },
  'ngan-hang': { label: 'Ngân hàng (quầy giao dịch)', times: ['ngay'] },
  'phong-hop': { label: 'Phòng họp', times: ['ngay', 'toi'] },
  'ngoai-troi': { label: 'Ngoài trời (công viên bờ hồ)', times: ['ngay', 'chieu', 'toi'] },
  'cua-hang': { label: 'Cửa hàng (quầy thu ngân)', times: ['ngay'] },
  'cong-an': { label: 'Trụ sở công an (phòng tiếp dân)', times: ['ngay'] },
};

// Mascot vẽ sẵn (vector). Ngoài ra người dùng có thể tải ảnh mascot riêng (PNG nền trong) — kind 'mascot', mascot: 'anh'.
export const MASCOTS = {
  khien: { label: 'Khiên bảo vệ' },
  robot: { label: 'Rô-bốt trợ lý' },
};

export const allHairs = () => ({ ...HAIRS.nam, ...HAIRS.nu });
