// Thư mục xuất phim chung: mọi phim thành phẩm được chép về một chỗ dễ tìm trên ổ cứng.
//   <thư mục xuất>/<Tên series>/EP01 - <tiêu đề>.mp4 (+ .srt)
// Thứ tự chọn thư mục: biến XUONG_OUTPUT_DIR (Docker / ghi đè) → ~/.config/xuong-phim/settings.json → mặc định
// (macOS: ~/Movies/Xưởng phim, Linux: ~/Videos/Xưởng phim). Bản gốc vẫn ở series/<slug>/episodes/epNN/out/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CONF_DIR = process.env.XUONG_CONFIG_DIR || path.join(os.homedir(), '.config', 'xuong-phim');
const SETTINGS = path.join(CONF_DIR, 'settings.json');
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

export const defaultOutputDir = () => path.join(os.homedir(), process.platform === 'darwin' ? 'Movies' : 'Videos', 'Xưởng phim');
export const outputLocked = () => !!process.env.XUONG_OUTPUT_DIR; // Docker: thư mục do docker-compose quyết định
export const outputDir = () => process.env.XUONG_OUTPUT_DIR || readJSON(SETTINGS, {}).outputDir || defaultOutputDir();
// đường dẫn để HIỂN THỊ cho người dùng (trong Docker: đổi /data/output thành đường dẫn trên máy thật)
export const displayPath = (p) => {
  const host = process.env.XUONG_OUTPUT_HOST_PATH, base = process.env.XUONG_OUTPUT_DIR;
  return host && base && (p === base || p.startsWith(base + path.sep)) ? host + p.slice(base.length) : p;
};

export function setOutputDir(dir) {
  if (outputLocked()) throw new Error('Đang chạy trong Docker — đổi thư mục xuất bằng XUONG_OUTPUT_DIR trong file .env rồi khởi động lại.');
  let d = String(dir ?? '').trim();
  if (d.startsWith('~/') || d === '~') d = path.join(os.homedir(), d.slice(1));
  if (!path.isAbsolute(d)) throw new Error('Cần đường dẫn đầy đủ, ví dụ /Users/ten/Movies/Xưởng phim');
  d = path.resolve(d);
  fs.mkdirSync(d, { recursive: true });
  fs.accessSync(d, fs.constants.W_OK);
  fs.mkdirSync(CONF_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(SETTINGS, JSON.stringify({ ...readJSON(SETTINGS, {}), outputDir: d }, null, 1));
  return d;
}

const safe = (s) => String(s ?? '').replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
export const seriesOutputDir = (seriesName) => path.join(outputDir(), safe(seriesName) || 'Series');

// Chép MP4 (+SRT) của một tập vào thư mục xuất; nhớ đích ở out/export.json để lần sau (đổi tiêu đề) xoá bản cũ của chính xưởng.
export function exportEpisode(seriesDir, id) {
  const ed = path.join(seriesDir, 'episodes', id), out = path.join(ed, 'out');
  const mp4 = path.join(out, `${id}.mp4`);
  if (!fs.existsSync(mp4)) return null;
  const bible = readJSON(path.join(seriesDir, 'bible.json'), {}), ep = readJSON(path.join(ed, 'episode.json'), {});
  const dir = seriesOutputDir(bible.name || path.basename(seriesDir));
  const base = path.join(dir, safe(`${id.toUpperCase()} - ${ep.title || id}`));
  fs.mkdirSync(dir, { recursive: true });
  const rec = path.join(out, 'export.json'), prev = readJSON(rec, {});
  const copy = (src, dst) => fs.copyFileSync(src, dst, fs.constants.COPYFILE_FICLONE); // APFS: nhân bản tức thì, không tốn thêm dung lượng
  copy(mp4, `${base}.mp4`);
  const srt = path.join(out, `${id}.srt`);
  if (fs.existsSync(srt)) copy(srt, `${base}.srt`);
  for (const old of [prev.mp4, prev.srt, prev.mp4?.replace(/\.mp4$/, ' - Bài đăng.txt')]) if (old && !old.startsWith(base + '.') && !old.startsWith(base + ' - ') &&old.startsWith(outputDir() + path.sep) && fs.existsSync(old)) fs.rmSync(old);
  const st = fs.statSync(mp4);
  writePostTxt(ed, base);
  fs.writeFileSync(rec, JSON.stringify({ mp4: `${base}.mp4`, srt: fs.existsSync(srt) ? `${base}.srt` : null, mtime: st.mtimeMs, size: st.size, at: new Date().toISOString() }, null, 1));
  return `${base}.mp4`;
}

// Bài đăng mạng xã hội (episodes/epNN/bai-dang.json, tools/web/post.mjs) → "<tên phim> - Bài đăng.txt" cạnh MP4 đã xuất
const writePostTxt = (ed, base) => {
  const p = readJSON(path.join(ed, 'bai-dang.json'), null);
  if (!p?.short) return;
  fs.writeFileSync(`${base} - Bài đăng.txt`, `BẢN NGẮN\n\n${p.short}\n\n────────────\n\nBẢN DÀI\n\n${p.long}\n`);
};
// viết lại file bài đăng cạnh MP4 đã xuất (gọi sau khi AI viết xong bài)
export function exportPost(seriesDir, id) {
  const ed = path.join(seriesDir, 'episodes', id), r = readJSON(path.join(ed, 'out', 'export.json'), null);
  if (!r?.mp4 || !fs.existsSync(path.dirname(r.mp4))) return null;
  const base = r.mp4.replace(/\.mp4$/, '');
  writePostTxt(ed, base);
  return `${base} - Bài đăng.txt`;
}

// Trạng thái xuất của một tập cho trang web
export function episodeExport(epDir, id) {
  const r = readJSON(path.join(epDir, 'out', 'export.json'), null);
  if (!r?.mp4 || !fs.existsSync(r.mp4)) return null;
  const m = fs.statSync(path.join(epDir, 'out', `${id}.mp4`));
  return { path: displayPath(r.mp4), stale: m.mtimeMs !== r.mtime || m.size !== r.size };
}
