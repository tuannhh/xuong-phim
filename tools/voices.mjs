// Bảng giọng + giới tính để khoá giọng theo nhân vật (nam → giọng nam, nữ → giọng nữ).
// VieNeu: theo `tts-vi --voices`. Gemini TTS: giọng dựng sẵn của Gemini (giới tính theo tài liệu Google).
export const VIENEU = {
  'Hải Đăng': 'nam', 'Adam bựa': 'nam', 'Thiện Minh': 'nam', 'Thiền Tâm Đức': 'nam', 'Quang Sơn': 'nam', 'Minh Đức': 'nam', 'Phạm Tuyên': 'nam',
  'Thái Sơn': 'nam', 'Xuân Vĩnh': 'nam', 'Thanh Bình': 'nam', 'Minh Triết': 'nam', 'Đức Trí': 'nam', Adam: 'nam', 'Quốc Tuấn': 'nam',
  'Trúc Ly': 'nu', 'Mai Anh': 'nu', 'Thùy Dung': 'nu', 'Ngọc Huyền': 'nu', 'Ngọc Trân': 'nu', 'Ngọc Linh': 'nu', 'Đoan Trang': 'nu',
  'Thục Đoan': 'nu', 'Mỹ Duyên': 'nu', 'Quỳnh Anh': 'nu', 'Kim Thanh': 'nu',
};
export const GEMINI = {
  Puck: 'nam', Charon: 'nam', Fenrir: 'nam', Orus: 'nam', Enceladus: 'nam', Iapetus: 'nam', Umbriel: 'nam', Algieba: 'nam', Algenib: 'nam',
  Rasalgethi: 'nam', Alnilam: 'nam', Schedar: 'nam', Achird: 'nam', Zubenelgenubi: 'nam', Sadachbia: 'nam', Sadaltager: 'nam',
  Zephyr: 'nu', Kore: 'nu', Leda: 'nu', Aoede: 'nu', Callirrhoe: 'nu', Autonoe: 'nu', Despina: 'nu', Erinome: 'nu', Laomedeia: 'nu',
  Achernar: 'nu', Gacrux: 'nu', Pulcherrima: 'nu', Vindemiatrix: 'nu', Sulafat: 'nu',
};
// mặc định khi nhân vật chưa chọn giọng: xoay vòng theo giới tính để mỗi nhân vật một giọng
const POOL = { vieneu: { nam: ['Hải Đăng', 'Thiện Minh', 'Quốc Tuấn', 'Minh Đức'], nu: ['Ngọc Huyền', 'Mai Anh', 'Trúc Ly', 'Đoan Trang'] }, gemini: { nam: ['Charon', 'Puck', 'Orus', 'Iapetus'], nu: ['Kore', 'Aoede', 'Leda', 'Despina'] } };

// Gán giọng cho mọi nhân vật của tập: { id → { voice, geminiVoice, gender } } + lỗi giới tính
export function castVoices(characters = [], bible = {}) {
  const used = { vieneu: new Set(), gemini: new Set() };
  const out = {}, errors = [];
  for (const c of characters) {
    const g = c.gender === 'nu' ? 'nu' : 'nam';
    let v = c.voice ?? bible.voices?.[c.id];
    let gv = c.geminiVoice ?? bible.geminiVoices?.[c.id];
    if (v) used.vieneu.add(v);
    if (gv) used.gemini.add(gv);
    out[c.id] = { voice: v, geminiVoice: gv, gender: g, name: c.name };
  }
  for (const c of characters) {
    const o = out[c.id];
    if (!o.voice) o.voice = POOL.vieneu[o.gender].find((x) => !used.vieneu.has(x)) ?? POOL.vieneu[o.gender][0], used.vieneu.add(o.voice);
    if (!o.geminiVoice) o.geminiVoice = POOL.gemini[o.gender].find((x) => !used.gemini.has(x)) ?? POOL.gemini[o.gender][0], used.gemini.add(o.geminiVoice);
    if (VIENEU[o.voice] && VIENEU[o.voice] !== o.gender) errors.push(`${c.id} (${c.name}, ${o.gender === 'nu' ? 'nữ' : 'nam'}) đang dùng giọng VieNeu "${o.voice}" của ${VIENEU[o.voice] === 'nu' ? 'nữ' : 'nam'}`);
    if (GEMINI[o.geminiVoice] && GEMINI[o.geminiVoice] !== o.gender) errors.push(`${c.id} (${c.name}) đang dùng giọng Gemini "${o.geminiVoice}" của ${GEMINI[o.geminiVoice] === 'nu' ? 'nữ' : 'nam'}`);
    if (!VIENEU[o.voice] && !/[\\/.]/.test(o.voice)) errors.push(`${c.id}: không biết giọng VieNeu "${o.voice}"`);
    if (!GEMINI[o.geminiVoice]) errors.push(`${c.id}: không biết giọng Gemini "${o.geminiVoice}"`);
  }
  return { voices: out, errors };
}
