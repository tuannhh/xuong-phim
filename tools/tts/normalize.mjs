// Chuẩn hoá văn bản → lời đọc TTS tiếng Việt (tts_text), tách khỏi chữ hiển thị/phụ đề.
// Theo bộ quy tắc VOICE_OFF_TTS_RULES v5 (năm, ngày tháng, số lượng, thập phân, phần trăm, tăng/giảm,
// số hiệu văn bản, thời gian, tiền tệ, tỷ lệ, từ viết tắt nội bộ đã duyệt, tên tổ chức) + quy ước riêng của xưởng.
// Xác định (cùng đầu vào → cùng đầu ra), có trace từng chỗ đổi và cảnh báo cho chỗ chưa chắc.
//
//   normalize(text, { engine: 'vieneu' | 'gemini', lexicon: [...] }) → { say, trace, warnings }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE_LEXICON = JSON.parse(fs.readFileSync(path.join(HERE, 'lexicon.json'), 'utf8'));

// ───── đọc số
const DIG = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
// chuỗi chữ số đọc rời (năm, số hiệu, số điện thoại): chữ số cuối 4 → tư, 5 → lăm (mục 9.3)
export const readDigits = (s, { finalRule = true } = {}) =>
  [...s].map((d, i, a) => (finalRule && i === a.length - 1 && i > 0 && d === '4' ? 'tư' : finalRule && i === a.length - 1 && i > 0 && d === '5' ? 'lăm' : DIG[+d])).join(' ');

const readTriple = (n, full) => {
  // n: 0..999; full = có nhóm đứng trước (phải đọc "không trăm", "linh")
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  const out = [];
  if (h > 0 || full) out.push(DIG[h], 'trăm');
  if (t === 0) {
    if (u > 0) { if (h > 0 || full) out.push('linh'); out.push(u === 4 && (h > 0 || full) ? 'tư' : DIG[u]); }
  } else if (t === 1) {
    out.push('mười');
    if (u === 5) out.push('lăm'); else if (u > 0) out.push(DIG[u]);
  } else {
    out.push(DIG[t], 'mươi');
    if (u === 1) out.push('mốt'); else if (u === 4) out.push('tư'); else if (u === 5) out.push('lăm'); else if (u > 0) out.push(DIG[u]);
  }
  return out.join(' ');
};

export const readInt = (num) => {
  let n = typeof num === 'bigint' ? num : BigInt(String(num).replace(/\D/g, '') || '0');
  if (n === 0n) return 'không';
  if (n >= 1000000000n) {
    const hi = n / 1000000000n, lo = n % 1000000000n;
    const head = readInt(hi) + ' tỷ';
    if (lo === 0n) return head;
    return head + ' ' + readBelowBillion(Number(lo), true);
  }
  return readBelowBillion(Number(n), false);
};
const readBelowBillion = (n, full) => {
  const groups = [Math.floor(n / 1e6), Math.floor((n % 1e6) / 1e3), n % 1e3];
  const units = ['triệu', 'nghìn', ''];
  const out = [];
  let started = full;
  groups.forEach((g, i) => {
    if (g === 0) return;
    out.push(readTriple(g, started) + (units[i] ? ' ' + units[i] : ''));
    started = true;
  });
  return out.join(' ').trim();
};

export const readYear = (y) => {
  const s = String(y);
  if (s.length !== 4) return readInt(s);
  if (s[2] === '0' && s[3] !== '0') {
    const last = s[3] === '4' ? 'tư' : DIG[+s[3]];
    if (s.startsWith('20')) return `hai lẻ ${last}`;
    return `${DIG[+s[0]]} ${DIG[+s[1]]} linh ${last}`;
  }
  return readDigits(s);
};
const readDecimal = (a, b) => `${readDigits(a, { finalRule: false })} phẩy ${readDigits(b, { finalRule: false })}`;
const readDay = (d) => (+d <= 10 ? `mùng ${readInt(+d)}` : readInt(+d));
const readMonth = (m) => (+m === 4 ? 'tư' : readInt(+m));
const readNumber = (s) => {
  // "1.234.567" | "43000" | "23,7" → lời đọc
  if (/^\d+,\d+$/.test(s)) { const [a, b] = s.split(','); return readDecimal(a, b); }
  const clean = s.replace(/\./g, '');
  if (clean.length > 15) return readDigits(clean);
  return readInt(clean);
};

// ───── chữ cái tiếng Việt (cho số hiệu văn bản pháp lý: NĐ-CP → nờ đê xê pê)
const VI_LETTER = { A: 'a', Ă: 'á', Â: 'ớ', B: 'bê', C: 'xê', D: 'dê', Đ: 'đê', E: 'e', Ê: 'ê', G: 'giê', H: 'hát', I: 'i', K: 'ca', L: 'lờ', M: 'mờ', N: 'nờ', O: 'o', Ô: 'ô', Ơ: 'ơ', P: 'pê', Q: 'quy', R: 'rờ', S: 'ét', T: 'tê', U: 'u', Ư: 'ư', V: 'vê', X: 'ích', Y: 'i' };
const readViLetters = (s) => [...s.replace(/[^A-ZĐĂÂÊÔƠƯ]/g, '')].map((c) => VI_LETTER[c] ?? c).join(' ');

// ───── chữ cái kiểu tiếng Anh, viết theo âm tiếng Việt (VieNeu chỉ đọc đúng âm tiết viết ĐÚNG CHÍNH TẢ tiếng Việt: "giây" chứ không "jây", "cây" chứ không "kây" —
// "kây" sai chính tả (k chỉ đứng trước i/e/ê/y) nên bộ chuyển âm của VieNeu đánh vần thành "ka-â-xơ-cơm-phlếch-xi"; tools/tts/test.mjs chặn lỗi này)
// Dùng cho tên miền (misa.vn → mi xa chấm vi en), viết tắt công nghệ (APK → ây pi cây) và hậu tố ghép sau tên thương hiệu (MISAJSC).
export const EN_LETTER = { A: 'ây', B: 'bi', C: 'xi', D: 'đi', E: 'i', F: 'ép', G: 'gi', H: 'ết', I: 'ai', J: 'giây', K: 'cây', L: 'eo', M: 'em', N: 'en', O: 'âu', P: 'pi', Q: 'kiu', R: 'a', S: 'ét', T: 'ti', U: 'diu', V: 'vi', W: 'đắp bồ diu', X: 'ếch', Y: 'oai', Z: 'dét' };
export const readEnLetters = (s) => [...String(s).toUpperCase().replace(/[^A-Z]/g, '')].map((c) => EN_LETTER[c]).join(' ');
// đuôi tên miền hay gặp
const TLD = { vn: 'vi en', com: 'com', net: 'nét', org: 'o rờ gờ', info: 'in phô', io: 'ai âu', top: 'tóp', xyz: 'ếch oai dét', online: 'on lai', site: 'sai', link: 'linh', click: 'clích', shop: 'sóp', me: 'mi', co: 'cô', edu: 'e đu', gov: 'gâu', www: 'vê kép vê kép vê kép' };
// tên thương hiệu đọc riêng khi dính liền chữ khác (misavpn, MISAJSC) — phần còn lại ngắn thì đánh vần kiểu tiếng Anh
const BRANDS = [['misa', 'mi xa']];
const isSpellable = (w) => w.length <= 4 || !/[aeiouy]/i.test(w);

const L = '\\p{L}\\p{N}';
const B0 = `(?<![${L}])`, B1 = `(?![${L}])`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function normalize(text, { engine = 'vieneu', lexicon = [] } = {}) {
  const trace = [];
  const warnings = [];
  let s = String(text ?? '');
  // chỗ đã chuẩn hoá được bọc trong \u0001…\u0002 để bước sau không đụng vào
  const done = (out) => `\u0001${out}\u0002`;
  const rule = (name, re, fn) => {
    s = s.replace(re, (...m) => {
      const src = m[0];
      const parts = s.slice(0, m[m.length - 2]);
      if ((parts.match(/\u0001/g) ?? []).length > (parts.match(/\u0002/g) ?? []).length) return src; // đang ở trong vùng đã xử lý
      const out = fn(...m);
      if (out == null || out === src) return src;
      trace.push({ rule: name, src: src.trim(), out: out.trim() });
      return done(out);
    });
  };

  // từ điển (series trước, chung sau) — cần sớm vì tên miền cũng tra từ điển
  const lex = [...lexicon, ...BASE_LEXICON].filter((e) => !e.engines || e.engines.includes(engine));
  const seen = new Set();
  const entries = lex.filter((e) => (seen.has(e.src) ? false : seen.add(e.src))).sort((a, b) => b.src.length - a.src.length);
  const lexLower = new Map(entries.filter((e) => !/\s/.test(e.src)).map((e) => [e.src.toLowerCase(), e.say]));
  // một từ thương hiệu dính liền: misavpn → mi xa vi pi en, MISAJSC → mi xa giây ét xi
  const brandWord = (w) => {
    const lw = w.toLowerCase();
    for (const [b, say] of BRANDS) {
      if (!lw.startsWith(b) || lw === b) continue;
      const rest = lw.slice(b.length);
      if (!/^[a-z]+$/.test(rest)) continue;
      const r = lexLower.get(rest) ?? (isSpellable(rest) ? readEnLetters(rest) : null);
      if (r) return `${say} ${r}`;
    }
    return null;
  };
  // một nhãn trong tên miền: từ điển → đuôi tên miền → thương hiệu dính liền → cụm phụ âm/ngắn không nguyên âm thì đánh vần → giữ nguyên
  const domainLabel = (w, last) => {
    const lw = w.toLowerCase();
    if (lexLower.has(lw)) return lexLower.get(lw);
    if ((last || lw === 'www') && TLD[lw]) return TLD[lw];
    const b = brandWord(lw);
    if (b) return b;
    if (/^[a-z]{1,4}$/.test(lw) && !/[aeiouy]/.test(lw)) return readEnLetters(lw);
    return w;
  };

  // 0. URL / email / tên miền: "chấm", "gạch ngang", "gạch chéo"; từng nhãn đọc theo domainLabel (misa.vn → mi xa chấm vi en)
  rule('url', new RegExp(`${B0}(?:https?:\\/\\/)?[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:com|vn|net|org|top|xyz|info|io|online|site|link|click|shop|me|co|edu|gov)(?:\\.vn)?(?:\\/[^\\s]*)?${B1}`, 'giu'), (m) => {
    const [host, ...pathParts] = m.replace(/^https?:\/\//i, '').split('/');
    const labels = host.split('.');
    const read = labels.map((lb, i) => lb.split('-').map((w) => domainLabel(w, i >= labels.length - 2)).join(' gạch ngang ')).join(' chấm ');
    const tail = pathParts.filter(Boolean).map((p) => p.replace(/[-.]/g, ' ')).join(' gạch chéo ');
    return (tail ? `${read} gạch chéo ${tail}` : read).replace(/\s+/g, ' ');
  });
  // 0b. tên thương hiệu dính liền chữ khác ngoài tên miền (fanpage MISAJSC, misavpn)
  rule('brand-word', new RegExp(`${B0}(?:${BRANDS.map(([b]) => b).join('|')})[a-z]+${B1}`, 'giu'), (m) => (lexLower.has(m.toLowerCase()) ? null : brandWord(m)));

  // 0c. tỉ lệ khung hình sau "khung / tỉ lệ / định dạng / khổ": 9:16, 16:9 hoặc 1:1 → "chín trên mười sáu" (không đọc thành giờ)
  rule('ratio', new RegExp(`${B0}(khung hình|khung|tỉ lệ|tỷ lệ|định dạng|khổ)\\s+(\\d{1,2}:\\d{1,2}(?:\\s*(?:,|hoặc|hay|và)\\s*\\d{1,2}:\\d{1,2})*)${B1}`, 'giu'), (m, w, list) =>
    `${w} ${list.replace(/(\d{1,2}):(\d{1,2})/g, (x, a, b) => `${readInt(+a)} trên ${readInt(+b)}`)}`);
  // 1. thời gian: 08:30, 8h30, 8h, 8 AM / 8 PM
  rule('time-ampm', new RegExp(`${B0}(\\d{1,2})(?::(\\d{2}))?\\s?(AM|PM|am|pm)${B1}`, 'gu'), (m, h, mi, ap) => {
    const H = +h; const pm = /pm/i.test(ap);
    const part = !pm ? 'sáng' : H === 12 ? 'trưa' : H <= 5 ? 'chiều' : 'tối';
    return `${readInt(H)} giờ${mi && +mi ? ' ' + readInt(+mi) + ' phút' : ''} ${part}`;
  });
  const ratioCtx = /(tỷ lệ|tỉ lệ|ratio|khung hình|tỷ số)\s*$/i;
  rule('ratio', new RegExp(`${B0}(\\d+)\\s?[:/]\\s?(\\d+)${B1}`, 'gu'), (m, a, b, off, all) => (ratioCtx.test(all.slice(Math.max(0, off - 24), off)) ? `${readInt(a)} trên ${readInt(b)}` : /phân số\s*$/i.test(all.slice(Math.max(0, off - 12), off)) ? `${readInt(a)} phần ${readInt(b)}` : null));
  rule('time-range', new RegExp(`${B0}(\\d{1,2})h(\\d{2})?\\s?[-–]\\s?(\\d{1,2})h(\\d{2})?${B1}`, 'gu'), (m, h1, m1, h2, m2) =>
    `${readInt(+h1)} giờ${m1 && +m1 ? ' ' + readInt(+m1) + ' phút' : ''} đến ${readInt(+h2)} giờ${m2 && +m2 ? ' ' + readInt(+m2) + ' phút' : ''}`);
  rule('time', new RegExp(`${B0}([01]?\\d|2[0-3])(?::|h)([0-5]\\d)${B1}`, 'gu'), (m, h, mi) => `${readInt(+h)} giờ${+mi ? ' ' + readInt(+mi) + ' phút' : ''}`);
  rule('time-h', new RegExp(`${B0}([01]?\\d|2[0-3])h${B1}`, 'gu'), (m, h) => `${readInt(+h)} giờ`);

  // 2. ngày tháng: 03/04/2026, tháng 03/2026, ngày 3/4
  rule('date', new RegExp(`${B0}(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4})${B1}`, 'gu'), (m, d, mo, y) => (+d >= 1 && +d <= 31 && +mo >= 1 && +mo <= 12 ? `${readDay(d)} tháng ${readMonth(mo)} năm ${readYear(y)}` : null));
  rule('month-year', new RegExp(`(?<=tháng\\s)(\\d{1,2})[/.-](\\d{4})${B1}`, 'giu'), (m, mo, y) => (+mo >= 1 && +mo <= 12 ? `${readMonth(mo)} năm ${readYear(y)}` : null));
  rule('day-month', new RegExp(`(?<=(?:ngày|hôm|từ|đến)\\s)(\\d{1,2})[/](\\d{1,2})${B1}`, 'giu'), (m, d, mo) => (+d <= 31 && +mo <= 12 ? `${readDay(d)} tháng ${readMonth(mo)}` : null));

  // 3. số hiệu văn bản: 117/2025, 18/2026/NĐ-CP
  rule('doc-id', new RegExp(`${B0}(\\d{1,4})\\/(\\d{4})(?:\\/([A-ZĐ]+(?:-[A-ZĐ]+)*))?${B1}`, 'gu'), (m, n, y, code) => {
    const num = n.length <= 2 ? readInt(+n) : readDigits(n);
    return [num, readYear(y), code ? readViLetters(code) : ''].filter(Boolean).join(' ');
  });

  // 4. năm theo ngữ cảnh + khoảng năm
  rule('year-range', new RegExp(`${B0}((?:19|20)\\d{2})\\s?[-–]\\s?((?:19|20)\\d{2})${B1}`, 'gu'), (m, a, b) => `${readYear(a)} đến ${readYear(b)}`);
  rule('year', new RegExp(`(?<=(?:năm|niên độ|giai đoạn|quý\\s\\p{L}+|cuối|đầu)\\s)(\\d{4})${B1}`, 'giu'), (m, y) => readYear(y));

  // 5. phần trăm / số có dấu tăng giảm (dấu dính liền số; gạch đầu dòng "- " không phải dấu)
  const pct = (sign, n) => `${sign === '+' ? 'tăng ' : sign ? 'giảm ' : ''}${readNumber(n)} phần trăm`;
  rule('percent', new RegExp(`(?<![${L}+\\-−])([+\\-−])?(\\d[\\d.]*(?:,\\d+)?)\\s?%`, 'gu'), (m, sign, n) => pct(sign, n));
  rule('signed', new RegExp(`(?<=^|[\\s(])([+\\-−])(\\d[\\d.]*(?:,\\d+)?)${B1}`, 'gu'), (m, sign, n) => `${sign === '+' ? 'tăng' : 'giảm'} ${readNumber(n)}`);

  // 6. tiền: 1.000.000đ, 500k, 30 triệu đồng
  rule('money', new RegExp(`${B0}(\\d[\\d.]*(?:,\\d+)?)\\s?(đ|₫|VND|VNĐ|vnđ|đồng)${B1}`, 'gu'), (m, n) => `${readNumber(n)} đồng`);
  rule('money-k', new RegExp(`${B0}(\\d+)k${B1}`, 'gu'), (m, n) => `${readInt(+n)} nghìn`);

  // 7. số điện thoại / chuỗi số dài: đọc rời
  rule('phone', new RegExp(`${B0}(0\\d{2,3}[ .]?\\d{3}[ .]?\\d{3,4})${B1}`, 'gu'), (m, n) => readDigits(n.replace(/\D/g, '')));
  rule('otp', new RegExp(`(?<=(?:mã|OTP|mã số|số)\\s)(\\d{4,8})${B1}`, 'giu'), (m, n) => readDigits(n));

  // 8. khoảng số 3-5, thập phân, số thường
  rule('range', new RegExp(`${B0}(\\d+)\\s?[-–]\\s?(\\d+)${B1}`, 'gu'), (m, a, b) => `${readInt(a)} đến ${readInt(b)}`);
  rule('decimal', new RegExp(`${B0}(\\d+),(\\d+)${B1}`, 'gu'), (m, a, b) => readDecimal(a, b));
  rule('number', new RegExp(`${B0}(\\d{1,3}(?:\\.\\d{3})+|\\d+)${B1}`, 'gu'), (m, n) => readNumber(n));

  // 9. từ viết tắt / tên riêng đã duyệt (dài trước, phân biệt hoa thường, ranh giới an toàn)
  // TB: chức danh hay trung bình — xét từng chỗ
  rule('TB', new RegExp(`${B0}TB${B1}(\\s+)?(\\S+)?`, 'gu'), (m, sp = '', next = '') => {
    if (/^[\u0001\d+\-−]/.test(next) || /^(mỗi|khoảng)$/.test(next)) return `trung bình${sp}${next}`;
    if (/^\p{Lu}/u.test(next)) return `Trưởng ban${sp}${next}`;
    warnings.push({ code: 'AMBIGUOUS_TB_MEANING', src: 'TB' });
    return null;
  });
  if (entries.length) {
    const re = new RegExp(`${B0}(?:${entries.map((e) => esc(e.src)).join('|')})${B1}`, 'gu');
    const map = Object.fromEntries(entries.map((e) => [e.src, e.say]));
    rule('lexicon', re, (m) => map[m]);
  }
  rule('and', /\s&\s/g, () => ' và ');

  // 10. còn sót: chữ viết hoa ≥2 ký tự chưa có cách đọc → giữ nguyên, cảnh báo để duyệt
  const rest = s.replace(/\u0001[^\u0002]*\u0002/g, ' ');
  for (const m of rest.matchAll(new RegExp(`${B0}[A-ZĐ][A-ZĐ0-9]{1,}${B1}`, 'gu'))) warnings.push({ code: 'UNKNOWN_ACRONYM', src: m[0] });
  if (/\d/.test(rest)) warnings.push({ code: 'UNREAD_DIGITS', src: rest.match(/\S*\d\S*/)?.[0] });

  const say = s.replace(/[\u0001\u0002]/g, '').replace(/\s+/g, ' ').trim();
  return { say, trace, warnings };
}

// Lexicon của series (bible.pronounce: { "Từ": "cách đọc" } hoặc [{src, say, engines?}])
export const seriesLexicon = (bible) => {
  const p = bible?.pronounce;
  if (!p) return [];
  return Array.isArray(p) ? p : Object.entries(p).map(([src, say]) => (typeof say === 'string' ? { src, say } : { src, ...say }));
};
