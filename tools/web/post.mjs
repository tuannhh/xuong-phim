// Bài đăng mạng xã hội cho một tập đã dựng: AI viết 2 bản — ngắn (< 100 từ) và dài (< 300 từ) — bám kịch bản tập
// (lời thoại, chữ trên màn hình, kế hoạch tập) và thông điệp series (đề bài). Người dùng chỉ việc chép rồi dán.
// Lưu ở episodes/epNN/bai-dang.json (+ chép thành "<tên phim> - Bài đăng.txt" cạnh MP4 trong thư mục phim chung).
// Gọi AI một lượt, không công cụ (askAI, vai trò "post" ở Thiết lập AI) → không chiếm hàng việc dựng phim;
// các yêu cầu viết bài xếp hàng lần lượt trong tiến trình máy chủ.
import fs from 'node:fs';
import path from 'node:path';
import { askAI } from './suggest.mjs';
import { exportPost } from '../output.mjs';

export const LIMIT = { short: 100, long: 300 }; // số từ tối đa (không tính)
const FILE = 'bai-dang.json';
const epId = (n) => `ep${String(n).padStart(2, '0')}`;
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

// đếm từ kiểu mạng xã hội: mỗi cụm chữ/số (kể cả hashtag, tên miền) là một từ; emoji, dấu câu không tính
export const countWords = (s) => (String(s ?? '').match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’._\-/@&]*/gu) ?? []).length;

const epDirOf = (seriesDir, n) => path.join(seriesDir, 'episodes', epId(n));

// ───────── trạng thái (cho trang web / Telegram)
const pending = new Map(); // `${seriesDir}|${n}` → Promise
let chain = Promise.resolve();

export function read(seriesDir, n) {
  const ed = epDirOf(seriesDir, n);
  const p = readJSON(path.join(ed, FILE), null);
  const busy = pending.has(`${seriesDir}|${n}`);
  if (!p?.short) return busy ? { busy } : null;
  let stale = false;
  try { stale = fs.statSync(path.join(ed, 'episode.json')).mtimeMs > (p.src ?? 0) + 1000; } catch {}
  return { short: p.short, long: p.long, words: { short: countWords(p.short), long: countWords(p.long) }, at: p.at, stale, busy };
}

// ───────── nội dung đưa cho AI
const KEEP = new Set(['text', 'sub', 'title', 'kicker', 'label', 'items', 'steps', 'left', 'right', 'points', 'rows', 'quote', 'caption', 'heading', 'note', 'bad', 'good', 'tips', 'lines']);
const screenText = (props) => {
  const out = [];
  const walk = (v, keep) => {
    if (typeof v === 'string') { if (keep && /\p{L}/u.test(v) && v.length > 2 && !/\.(png|jpe?g|svg|webp|mp3|mp4)$/i.test(v)) out.push(v.replace(/\*/g, '').trim()); return; }
    if (Array.isArray(v)) return v.forEach((x) => walk(x, keep));
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, keep || KEEP.has(k));
  };
  walk(props, false);
  return [...new Set(out)];
};

export function material(seriesDir, n) {
  const ed = epDirOf(seriesDir, n);
  const ep = readJSON(path.join(ed, 'episode.json'), null);
  if (!ep?.scenes?.length) throw Object.assign(new Error(`Tập ${n} chưa có kịch bản.`), { code: 400 });
  const brief = readJSON(path.join(seriesDir, 'brief.json'), {}), bible = readJSON(path.join(seriesDir, 'bible.json'), {});
  const plan = readJSON(path.join(seriesDir, 'plan.json'), { episodes: [] }).episodes?.find((e) => e.number === n) ?? {};
  const names = Object.fromEntries([...(bible.characters ?? []), ...(ep.characters ?? [])].map((c) => [c.id, c.name]));
  const script = ep.scenes.map((s, i) => {
    const said = (s.lines ?? []).map((l) => (typeof l === 'string' ? { text: l } : l)).filter((l) => l?.text)
      .map((l) => `  ${l.speaker ? `${names[l.speaker] ?? l.speaker}: ` : 'Dẫn: '}${l.text}`);
    const shown = screenText(s.props);
    return [`Cảnh ${i + 1} (${s.type})`, ...said, ...(shown.length ? [`  [chữ trên màn hình] ${shown.join(' · ').slice(0, 500)}`] : [])].join('\n');
  }).join('\n');
  const platforms = Array.isArray(brief.platform) ? brief.platform.join(', ') : brief.platform;
  const series = [
    ['Tên series', bible.name || brief.name], ['Kênh', brief.channel || bible.channel], ['Ý tưởng / thông điệp series', brief.idea],
    ['Khán giả', brief.audience], ['Giọng điệu', brief.tone], ['Lời kêu gọi chung', brief.cta], ['Nền tảng đăng', platforms],
  ].filter(([, v]) => v && String(v).trim()).map(([k, v]) => `- ${k}: ${String(v).slice(0, 700)}`).join('\n');
  const episode = [
    ['Tiêu đề tập', ep.title || plan.title], ['Tóm tắt', ep.logline || plan.logline], ['Câu mở', plan.hook],
    ['Ý chính', Array.isArray(plan.beats) ? plan.beats.join(' | ') : plan.beats], ['Lời kết của tập', plan.cta],
    ['Nguồn số liệu', Array.isArray(plan.source) ? plan.source.join(' | ') : plan.source],
  ].filter(([, v]) => v && String(v).trim()).map(([k, v]) => `- ${k}: ${String(v).slice(0, 700)}`).join('\n');
  return { series, episode, script: script.slice(0, 9000), title: ep.title || plan.title || `Tập ${n}` };
}

const promptOf = (m, retry) => `Bạn là người viết nội dung mạng xã hội cho "Xưởng phim" — series phim ngắn tiếng Việt (TikTok, Facebook Reels, YouTube Shorts, Zalo).
Hãy viết bài đăng kèm video của MỘT tập phim dưới đây, để người dùng chép rồi dán thẳng lên mạng xã hội.

THÔNG TIN SERIES
${m.series || '- (không có)'}

TẬP PHIM
${m.episode}

KỊCH BẢN (lời thoại + chữ trên màn hình)
${m.script}

YÊU CẦU
- Bám sát kịch bản tập này và thông điệp của series: nêu đúng tình huống, đúng bài học / dấu hiệu nhận biết / lời khuyên có trong phim. Không thêm chi tiết mà phim không có.
- Không bịa số liệu: chỉ dùng con số có trong kịch bản hoặc phần nguồn ở trên.
- Tiếng Việt có dấu, câu ngắn, gần gũi, đúng giọng điệu series. Có thể dùng vài emoji hợp lý. Không dùng markdown (không **đậm**, không #tiêu đề) vì mạng xã hội không hiển thị.
- Mỗi bài đứng độc lập: không hẹn "tập sau", không nhắc số tập.
- Nếu nội dung về an ninh mạng / lừa đảo: lời khuyên áp dụng cho mọi thiết bị (Android, iPhone, máy tính Windows, Mac) — không để người đọc hiểu iPhone/Mac là an toàn.
- Viết "MISA" đúng chữ hoa. Kết bài bằng lời kêu gọi (theo lời kêu gọi của series nếu có), rồi 3–6 hashtag tiếng Việt không dấu hoặc tên thương hiệu (vd #MISA).
- Bản NGẮN: tối đa 80 từ, tính cả hashtag. Một câu mở gây chú ý + thông điệp chính + lời kêu gọi + hashtag.
- Bản DÀI: 150–260 từ, tính cả hashtag. Mở bằng tình huống trong phim, rồi các dấu hiệu / việc nên làm (mỗi ý một dòng, đầu dòng bằng emoji hoặc "–"), lời kêu gọi, hashtag.
${retry ? `- LẦN TRƯỚC VIẾT QUÁ DÀI (${retry}). Viết lại ngắn hơn, đúng giới hạn từ.\n` : ''}
CHỈ trả về một đối tượng JSON, không giải thích, không bọc trong \`\`\`:
{"short": "…", "long": "…"}
Dùng \\n để xuống dòng trong chuỗi.`;

const parse = (text) => {
  const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const clean = (s) => String(s ?? '').replace(/\r/g, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
  return { short: clean(j.short), long: clean(j.long) };
};

// viết (hoặc viết lại) bài đăng của tập n — ai = ai.pick('post')
async function write(seriesDir, n, ai, env, log) {
  const m = material(seriesDir, n);
  const ed = epDirOf(seriesDir, n);
  const src = fs.statSync(path.join(ed, 'episode.json')).mtimeMs;
  let retry = '', last = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    let p;
    try { p = parse(await askAI(ai, env, promptOf(m, retry), { timeoutMs: 180000, what: 'bài đăng', fallbackModel: 'sonnet' })); }
    catch (e) { if (e.code || /lệnh|model|quá lâu/.test(e.message)) throw e; retry = ''; last = new Error('AI trả lời không đúng dạng'); continue; }
    const w = { short: countWords(p.short), long: countWords(p.long) };
    if (p.short && p.long && w.short < LIMIT.short && w.long < LIMIT.long) {
      const rec = { short: p.short, long: p.long, at: new Date().toISOString(), src, engine: ai.engine, model: ai.model || '' };
      fs.writeFileSync(path.join(ed, FILE), JSON.stringify(rec, null, 1) + '\n');
      try { exportPost(seriesDir, epId(n)); } catch { /* thư mục phim chung không ghi được thì thôi */ }
      log?.(`bài đăng tập ${n}: ngắn ${w.short} từ, dài ${w.long} từ`);
      return { ...read(seriesDir, n), busy: false };
    }
    retry = [!p.short || w.short >= LIMIT.short ? `bản ngắn ${w.short} từ, cần dưới ${LIMIT.short}` : '', !p.long || w.long >= LIMIT.long ? `bản dài ${w.long} từ, cần dưới ${LIMIT.long}` : ''].filter(Boolean).join('; ');
    last = new Error(`AI viết quá dài (${retry})`);
  }
  throw Object.assign(new Error(`Không viết được bài đăng: ${last?.message ?? 'lỗi'} — bấm viết lại.`), { code: 502 });
}

// xếp hàng viết bài: cùng một tập đang viết thì dùng chung lời hứa đó
export function generate(seriesDir, n, ai, env, log) {
  const key = `${seriesDir}|${n}`;
  if (pending.has(key)) return pending.get(key);
  try { material(seriesDir, n); } catch (e) { return Promise.reject(e); } // tập chưa có kịch bản → báo lỗi ngay
  const p = chain.then(() => write(seriesDir, n, ai, env, log)).finally(() => pending.delete(key));
  chain = p.catch(() => {});
  pending.set(key, p);
  return p;
}

// sau khi dựng xong: chưa có bài, hoặc kịch bản đã sửa sau lần viết → viết (lại). Trả null nếu không cần viết.
export function needs(seriesDir, n) {
  const r = read(seriesDir, n);
  return !r || (!r.busy && r.stale) ? true : false;
}

// chữ để chép: dùng cho file .txt và Telegram
export const asText = (title, p) => `BÀI ĐĂNG — ${title}\n\n── BẢN NGẮN (${countWords(p.short)} từ) ──\n${p.short}\n\n── BẢN DÀI (${countWords(p.long)} từ) ──\n${p.long}\n`;
