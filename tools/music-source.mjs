// Nhạc nền của người dùng (thay cho nhạc tự tổng hợp theo mood).
//   bible.music = { mood, volume, source: 'tao' | 'file', path?: '<file hoặc thư mục trên máy>' }
//   - file tải lên từ trang web nằm ở series/<slug>/nhac/ (ngoài git — nhạc là tài sản riêng của người dùng)
//   - `path`: một file hoặc cả thư mục nhạc trên máy (đọc tại chỗ, không chép)
//   Mỗi tập lấy một bài: episode.music.file (tên file / đường dẫn) nếu có, không thì xoay vòng theo số tập.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MUSIC_EXT = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;
export const MUSIC_MAX = 80 * 1024 * 1024;
export const musicDir = (seriesDir) => path.join(seriesDir, 'nhac');
const expand = (p) => (p === '~' || p?.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p);

const listAudio = (dir) => {
  try { return fs.readdirSync(dir).filter((f) => MUSIC_EXT.test(f) && !f.startsWith('.')).sort((a, b) => a.localeCompare(b, 'vi')).map((f) => path.join(dir, f)); } catch { return []; }
};

// Mọi bài dùng được cho series: file tải lên + file/thư mục ở `path`
export function musicTracks(seriesDir, music) {
  const out = listAudio(musicDir(seriesDir));
  const p = music?.path ? path.resolve(expand(String(music.path))) : null;
  if (p && fs.existsSync(p)) out.push(...(fs.statSync(p).isDirectory() ? listAudio(p) : MUSIC_EXT.test(p) ? [p] : []));
  return [...new Set(out)];
}

// Bài cho một tập (đường dẫn tuyệt đối) hoặc null khi series dùng nhạc tự tổng hợp / chưa có bài nào
export function pickTrack(seriesDir, bibleMusic, episode) {
  const m = { ...(bibleMusic ?? {}), ...(episode?.music ?? {}) };
  if (m.source !== 'file') return null;
  const tracks = musicTracks(seriesDir, bibleMusic);
  if (m.file) {
    const want = String(m.file);
    const hit = tracks.find((t) => t === path.resolve(expand(want)) || path.basename(t) === want);
    if (hit) return hit;
  }
  if (!tracks.length) return null;
  return tracks[((episode?.number ?? 1) - 1) % tracks.length];
}
