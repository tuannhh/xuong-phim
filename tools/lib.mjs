// Tiện ích dùng chung cho các lệnh trong tools/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { castVoices } from './voices.mjs';
import { normalize, seriesLexicon } from './tts/normalize.mjs';
import crypto from 'node:crypto';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  return { epDir, seriesDir, bible, episode };
};

// Bỏ cú pháp nhấn mạnh *x* _x_ ==x== ~~x~~ → chữ thường (cho phụ đề và lời đọc).
export const plain = (s = '') => s.replace(/==([^=]+)==/g, '$1').replace(/~~([^~]+)~~/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/(^|\s)_([^_]+)_/g, '$1$2').replace(/\s*\n\s*/g, ' ').trim();

// Các câu thoại của tập theo thứ tự, có id ổn định, giọng khoá theo nhân vật và lời đọc đã chuẩn hoá (MISA → "mi xa", số, ngày, viết tắt…).
export const episodeLines = (bible, episode, { engine = process.env.SERIES_ENGINE === 'gemini' ? 'gemini' : 'vieneu' } = {}) => {
  const out = [];
  const chars = episode.characters ?? bible.characters ?? [];
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
