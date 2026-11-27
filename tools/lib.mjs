// Tiện ích dùng chung cho các lệnh trong tools/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { castVoices } from './voices.mjs';
import { normalize, seriesLexicon } from './tts/normalize.mjs';
import crypto from 'node:crypto';
import { watermarkProps } from '../shared/watermark.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Chép cả thư mục bằng copyFileSync từng file. KHÔNG dùng fs.cpSync: bản native của Node 24 hỏng trên thư mục
// gắn từ macOS vào Docker (tạo file quyền chỉ-ghi rồi báo EACCES) — xem memory-bank/09 bẫy 16.
export function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(a, b);
    else if (e.isFile()) fs.copyFileSync(a, b);
  }
}
export const readJSON = (p, fb) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fb);
export const writeJSON = (p, v) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 1));
};
export const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

// Bảng theme có sẵn. bible.theme có thể là tên preset, hoặc object ghi đè { preset, ...màu }.
export const PRESETS = {
  'misa-vang': { bg: '#141A2E', bg2: '#1E2742', fg: '#F7F8FB', muted: '#A9B1C6', accent: '#F4D81C', accent2: '#FF5A4F', good: '#3DDC84', bad: '#FF4D4F', card: '#222C49', background: 'gradient-blobs', radius: 30, fontDisplay: 'Barlow', fontBody: 'Google Sans', captionStyle: 'pill' },
  'misa-sang': { bg: '#FFF9E0', bg2: '#FFEFB0', fg: '#1F2330', muted: '#5C6375', accent: '#E2342B', accent2: '#2A2D34', good: '#159A55', bad: '#D92D20', card: '#FFFFFF', background: 'dots', radius: 30, fontDisplay: 'Barlow', fontBody: 'Google Sans', captionStyle: 'pill' },
  'toi-cong-nghe': { bg: '#070B14', bg2: '#0F1A2E', fg: '#EAF2FF', muted: '#8BA0C0', accent: '#22D3EE', accent2: '#A78BFA', good: '#34D399', bad: '#F87171', card: '#111C31', background: 'grid', radius: 24, fontDisplay: 'Barlow', fontBody: 'Google Sans', captionStyle: 'bold' },
  'canh-bao': { bg: '#16080A', bg2: '#2A0E12', fg: '#FFF4F2', muted: '#C9A6A2', accent: '#FFD23F', accent2: '#FF4D4F', good: '#4ADE80', bad: '#FF3B30', card: '#2B1216', background: 'spotlight', radius: 26, fontDisplay: 'Barlow', fontBody: 'Google Sans', captionStyle: 'bold' },
  'giay-am': { bg: '#F4EDE1', bg2: '#EADFCC', fg: '#2B2420', muted: '#7A6C60', accent: '#D9480F', accent2: '#1C7C54', good: '#2F9E44', bad: '#C92A2A', card: '#FFFBF4', background: 'paper', radius: 18, fontDisplay: 'Barlow', fontBody: 'Google Sans', captionStyle: 'pill' },
  'vui-tuoi': { bg: '#FFF4F8', bg2: '#E8F4FF', fg: '#222244', muted: '#6A6A8A', accent: '#FF5C8A', accent2: '#3D8BFF', good: '#22B07D', bad: '#F0435A', card: '#FFFFFF', background: 'gradient-blobs', radius: 36, fontDisplay: 'Barlow', fontBody: 'Google Sans', captionStyle: 'bold' },
};

export const FORMATS = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };

export const resolveTheme = (bible) => {
  const t = typeof bible.theme === 'string' ? { preset: bible.theme } : bible.theme ?? {};
  const base = PRESETS[t.preset ?? 'misa-vang'] ?? PRESETS['misa-vang'];
  const { preset, ...over } = t;
  const theme = { ...base, ...over };
  if (bible.captions) theme.captionStyle = bible.captions;
  return theme;
};

// Thư mục tập → { epDir, seriesDir, bible, episode }
export const loadEpisode = (epArg) => {
  const epDir = path.resolve(epArg);
  const seriesDir = path.resolve(epDir, '../..');
  const bible = readJSON(path.join(seriesDir, 'bible.json'));
  const episode = readJSON(path.join(epDir, 'episode.json'));
  if (!bible) die(`không thấy ${path.join(seriesDir, 'bible.json')}`);
  if (!episode) die(`không thấy ${path.join(epDir, 'episode.json')}`);
  markBrief(seriesDir, epDir, episode);
  return { epDir, seriesDir, bible, episode };
};

// Dàn nhân vật dùng khi dựng một tập. episode.json giữ bản chép nhân vật lúc AI viết kịch bản; nhân vật nào trùng id với
// đề bài (bible.characters) thì lấy hình dáng + tên + giọng theo đề bài MỚI NHẤT → sửa nhân vật ở đề bài rồi dựng lại là phim đổi theo.
// Nhân vật riêng của tập (không có trong đề bài) giữ nguyên. Thuộc tính đề bài không có (vd AI thêm "trung niên" cho riêng tập)
// chỉ bị bỏ khi đề bài được lưu SAU khi viết kịch bản (episode._briefNewer — người dùng đã sửa đề bài, vd bỏ kính).
export const markBrief = (seriesDir, epDir, episode) => {
  let v = false;
  try { v = fs.statSync(path.join(seriesDir, 'bible.json')).mtimeMs > fs.statSync(path.join(epDir, 'episode.json')).mtimeMs + 1000; } catch {}
  Object.defineProperty(episode, '_briefNewer', { value: v, enumerable: false, configurable: true });
  return episode;
};
const LOOK = ['name', 'gender', 'kind', 'hair', 'hairColor', 'glasses', 'age', 'beard', 'logo', 'skin', 'bottom', 'bottomColor', 'outfitColor', 'voice', 'geminiVoice', 'mascot', 'image', 'villain'];
export const castOf = (bible, episode) => {
  const base = bible.characters ?? [];
  if (!episode.characters) return base;
  const byId = new Map(base.map((c) => [c.id, c]));
  return episode.characters.map((c) => {
    const b = byId.get(c.id);
    if (!b) return c;
    const out = { ...c };
    for (const k of LOOK) if (k in b) out[k] = b[k]; else if (episode._briefNewer) delete out[k];
    return out;
  });
};
// so sánh không phụ thuộc thứ tự khoá
export const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((y) => [y, x[y]])) : x));

// Bản MP4 đã dựng còn khớp đề bài hiện tại không: so lịch hình lúc dựng (build/rendered.json; bản cũ → timed.json nếu không
// mới hơn MP4) với watermark, nhân vật, giao diện tính từ đề bài bây giờ. Trả danh sách phần đã đổi (rỗng = khớp / không rõ).
export const renderDrift = (epDir, bible, episode) => {
  const D = dirs(), b = (f) => path.join(epDir, D.build, f);
  const mp4 = path.join(epDir, 'out', `${episode.id}${D.out}.mp4`);
  if (!fs.existsSync(mp4)) return [];
  let r = readJSON(b('rendered.json'), null);
  // tập dựng trước khi có rendered.json: timed.json chưa mới hơn MP4 = đúng bản đã dựng → lưu làm mốc ngay (lần dựng sau bị dừng giữa chừng sẽ ghi đè timed.json, mất mốc)
  if (!r && fs.existsSync(b('timed.json')) && fs.statSync(b('timed.json')).mtimeMs <= fs.statSync(mp4).mtimeMs + 1000) {
    r = readJSON(b('timed.json'), null);
    if (r) try { fs.copyFileSync(b('timed.json'), b('rendered.json')); const t = fs.statSync(b('timed.json')).mtime; fs.utimesSync(b('rendered.json'), t, t); } catch { /* chỉ là mốc so sánh */ }
  }
  if (!r) return [];
  const out = [];
  if (canon(r.watermark ?? null) !== canon((episode.watermark === null ? undefined : watermarkProps(bible.watermark)) ?? null)) out.push('watermark');
  if (canon(r.characters ?? []) !== canon(castOf(bible, episode))) out.push('nhân vật');
  if (canon(r.theme ?? null) !== canon(resolveTheme(bible))) out.push('màu / giao diện');
  return out;
};

// Bỏ cú pháp nhấn mạnh *x* _x_ ==x== ~~x~~ → chữ thường (cho phụ đề và lời đọc).
export const plain = (s = '') => s.replace(/==([^=]+)==/g, '$1').replace(/~~([^~]+)~~/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/(^|\s)_([^_]+)_/g, '$1$2').replace(/\s*\n\s*/g, ' ').trim();

// Các câu thoại của tập theo thứ tự, có id ổn định, giọng khoá theo nhân vật và lời đọc đã chuẩn hoá (MISA → "mi xa", số, ngày, viết tắt…).
export const episodeLines = (bible, episode, { engine = process.env.SERIES_ENGINE === 'gemini' ? 'gemini' : 'vieneu' } = {}) => {
  const out = [];
  const chars = castOf(bible, episode);
  const { voices } = castVoices(chars, bible);
  const lex = [...seriesLexicon(bible), ...seriesLexicon(episode)];
  for (const s of episode.scenes) {
    (s.lines ?? []).forEach((l, j) => {
      const line = typeof l === 'string' ? { text: l } : l;
      const id = line.id ?? `${s.id}-${j + 1}`;
      const speaker = line.speaker ?? s.speaker ?? episode.narrator ?? bible.narrator ?? null;
      const cv = speaker ? voices[speaker] : null;
      const voice = line.voice ?? cv?.voice ?? bible.voice ?? undefined;
      const geminiVoice = line.geminiVoice ?? cv?.geminiVoice ?? bible.geminiVoice ?? 'Charon';
      const text = plain(line.text);
      const norm = normalize(line.say ? plain(line.say) : text, { engine, lexicon: lex });
      const say = norm.say !== text ? norm.say : undefined;
      out.push({ id, scene: s.id, text, raw: line.text, narr: !(line.speaker ?? s.speaker), say, speaker, voice: engine === 'gemini' ? geminiVoice : voice, geminiVoice, pause: line.pause, expr: line.expr, pose: line.pose, react: line.react, norm });
    });
  }
  return out;
};

// Ước lượng thời lượng câu đọc khi chưa có voice. Đo trên VieNeu (Hải Đăng): ~4.5 âm tiết/giây, file đã cắt lặng.
export const estimateDur = (text) => {
  const syl = text.split(/\s+/).filter(Boolean).length;
  const pauses = (text.match(/[,;:]/g) ?? []).length * 0.1 + (text.match(/[.!?…]/g) ?? []).length * 0.05;
  return Math.max(0.7, syl / 4.5 + pauses + 0.05);
};

// Chữ ký một câu voice (đổi chữ/cách đọc/giọng → phải đọc lại; timing bỏ qua thời lượng cũ).
export const voiceSig = (l) => crypto.createHash('sha1').update(`${l.say ?? l.text}|${l.voice ?? ''}|${process.env.SERIES_ENGINE ?? ''}`).digest('hex').slice(0, 12);

// Bản voice khác để so sánh (vd Gemini TTS): SERIES_ENGINE=gemini → voice-gemini/, build-gemini/, out/<id>-gemini.*
export const dirs = () => {
  const e = process.env.SERIES_ENGINE;
  const sfx = e ? `-${e}` : '';
  return { engine: e ?? null, voice: `voice${sfx}`, build: `build${sfx}`, out: sfx };
};
