// Tư liệu của một series: file người dùng tải lên + đường dẫn trên máy + link Google Drive.
// Trước mỗi lần Claude sáng tác (plan/script/fix) ở chế độ có tư liệu, máy chủ gom tư liệu và đọc thành văn bản + ảnh
// (tools/materials/extract.py) vào series/<slug>/.studio/tu-lieu/ để Claude chọn lọc.
//   series/<slug>/tu-lieu/tai-len/   file tải lên từ trang web
//   series/<slug>/tu-lieu/drive/     bản tải về từ Drive
// Đợt thêm tập (brief.batches[], id "dot-2"…) có tư liệu riêng: tu-lieu/<id>/tai-len|drive → .studio/tu-lieu-<id>/  (tham số `sub`).
// Tất cả nằm ngoài git (tư liệu riêng của người dùng).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, readJSON } from '../lib.mjs';
import * as drive from './drive.mjs';
import { saveStream } from './upload.mjs';

export const MODES = { claude: 'AI tự tìm và viết', 'ket-hop': 'Kết hợp tư liệu của tôi + AI tìm thêm', 'tu-lieu': 'Chỉ dùng tư liệu của tôi' };
export const UPLOAD_EXT = /\.(pdf|docx?|pptx|xlsx|csv|txt|md|jpe?g|png|webp|gif|bmp)$/i;
export const UPLOAD_MAX = 300 * 1024 * 1024;

export const BATCH_ID = /^dot-\d{1,2}$/;
const subOk = (sub) => { if (sub && !BATCH_ID.test(sub)) throw new Error('đợt sai'); return sub || ''; };
const srcDir = (dir, sub) => (subOk(sub) ? path.join(dir, 'tu-lieu', sub) : path.join(dir, 'tu-lieu'));
const uploadDir = (dir, sub) => path.join(srcDir(dir, sub), 'tai-len');
const outDir = (dir, sub) => path.join(dir, '.studio', subOk(sub) ? `tu-lieu-${sub}` : 'tu-lieu');
export const indexPath = (slug, sub) => `series/${slug}/.studio/${sub ? `tu-lieu-${sub}` : 'tu-lieu'}/index.md`;
// xoá tư liệu của một đợt (huỷ đợt nháp)
export function removeBatch(dir, sub) {
  if (!subOk(sub)) return;
  fs.rmSync(srcDir(dir, sub), { recursive: true, force: true });
  fs.rmSync(outDir(dir, sub), { recursive: true, force: true });
}
// chép file tải lên (series gốc) sang series khác — dùng khi nhân bản có mang tư liệu
export function copyUploads(fromDir, toDir) {
  const a = uploadDir(fromDir);
  if (fs.existsSync(a)) fs.cpSync(a, uploadDir(toDir), { recursive: true });
}
export const safeName = (s) => String(s ?? '').normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[.\s]+/, '').slice(0, 120);
const expand = (p) => (p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p);

// Làm sạch danh sách tư liệu từ form (chỉ link Drive + đường dẫn máy; file tải lên nằm trong thư mục tai-len)
export function cleanMaterials(list) {
  return (Array.isArray(list) ? list : []).slice(0, 20).map((m) => {
    const type = m?.type === 'local' ? 'local' : 'drive';
    const ref = String(m?.ref ?? '').trim().slice(0, 500);
    if (!ref) return null;
    if (type === 'drive' && !drive.parseLink(ref)) throw Object.assign(new Error(`Link Google Drive không hợp lệ: ${ref}`), { code: 400 });
    if (type === 'local' && !path.isAbsolute(expand(ref))) throw Object.assign(new Error(`Cần đường dẫn đầy đủ trên máy (vd /Users/ten/Documents/tu-lieu): ${ref}`), { code: 400 });
    return { type, ref, note: String(m?.note ?? '').slice(0, 200) };
  }).filter(Boolean);
}

export function uploads(dir, sub) {
  const d = uploadDir(dir, sub);
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => !f.startsWith('.') && !f.endsWith('.part')).sort().map((name) => ({ name, size: fs.statSync(path.join(d, name)).size })) : [];
}

// Lưu một file tải lên (luồng dữ liệu thô từ trình duyệt), giới hạn cỡ + loại file
export async function saveUpload(dir, name, req, sub) {
  const n = safeName(name);
  if (!n || !UPLOAD_EXT.test(n)) throw new Error('Chỉ nhận Word, PDF, PowerPoint, Excel, ảnh (JPG/PNG/WEBP/GIF), TXT/MD/CSV.');
  return saveStream(uploadDir(dir, sub), n, req, UPLOAD_MAX, 'File quá 300 MB.');
}
export function removeUpload(dir, name, sub) {
  const f = path.join(uploadDir(dir, sub), safeName(name));
  if (path.dirname(f) !== uploadDir(dir, sub)) throw new Error('tên file sai');
  fs.rmSync(f, { force: true });
}

// Tình trạng tư liệu cho trang web
export function summary(dir, sub) {
  const idx = readJSON(path.join(outDir(dir, sub), 'index.json'), null);
  return { uploads: uploads(dir, sub), prepared: idx && { sources: idx.sources.length, images: idx.images, chars: idx.chars, errors: idx.sources.filter((s) => s.error).map((s) => `${s.name}: ${s.error}`), notes: idx.notes } };
}

export const needsMaterials = (brief) => (brief?.sourceMode ?? 'claude') !== 'claude';

// Gom + đọc tư liệu. `run(cmd, args)` chạy tiến trình con trong việc hiện tại (để nút Dừng dừng được).
// Trả về { count, localDirs } — localDirs đưa cho claude bằng --add-dir để xem file gốc khi cần.
// `brief` chỉ cần { sourceMode, materials } — với đợt thêm tập là chính đợt đó (sub = id đợt).
export async function prepare(dir, brief, { log, run, signal }, sub) {
  const inputs = [], localDirs = [];
  const up = uploadDir(dir, sub);
  if (uploads(dir, sub).length) inputs.push(up);
  for (const m of brief.materials ?? []) {
    if (m.type === 'local') {
      const p = path.resolve(expand(m.ref));
      if (!fs.existsSync(p)) { log(`! Không thấy trên máy: ${m.ref}${process.env.XUONG_DOCKER ? ' (trong Docker chỉ thấy thư mục đã gắn qua TU_LIEU_DIR)' : ''}`); continue; }
      inputs.push(p);
      localDirs.push(fs.statSync(p).isDirectory() ? p : path.dirname(p));
    } else {
      log(`Tải tư liệu Drive: ${m.ref}`);
      try { inputs.push(...(await drive.fetchMaterial(m.ref, path.join(srcDir(dir, sub), 'drive'), { log, signal }))); }
      catch (e) { if (signal?.aborted) throw e; log(`! ${e.message}`); }
    }
  }
  if (!inputs.length) {
    if (brief.sourceMode === 'tu-lieu') throw new Error(sub ? 'Đợt thêm tập chọn "Chỉ dùng tư liệu của tôi" nhưng chưa lấy được tư liệu nào — thêm file, đường dẫn hoặc link Drive cho đợt này.' : 'Series chọn "Chỉ dùng tư liệu của tôi" nhưng chưa lấy được tư liệu nào — thêm file, đường dẫn hoặc link Drive trong đề bài.');
    log('! Chưa có tư liệu nào — AI tự tìm nội dung.');
    return { count: 0, localDirs };
  }
  log('Đọc tư liệu (văn bản + ảnh)…');
  await run('uv', ['run', '--project', ROOT, 'python', path.join(ROOT, 'tools/materials/extract.py'), '--out', outDir(dir, sub), ...inputs]);
  const idx = readJSON(path.join(outDir(dir, sub), 'index.json'), { sources: [] });
  return { count: idx.sources.length, localDirs: [...new Set(localDirs.filter((p) => !p.startsWith(ROOT + path.sep)))] };
}

// Đoạn câu lệnh thêm cho Claude theo chế độ nguồn
export function promptPart(slug, brief, prepared, sub) {
  const mode = brief?.sourceMode ?? 'claude';
  if (mode === 'claude' || !prepared?.count) return mode === 'claude' ? ' Nguồn nội dung: tự tìm trên mạng khi cần số liệu (ghi nguồn).' : '';
  const idx = indexPath(slug, sub);
  return mode === 'tu-lieu'
    ? ` Nguồn nội dung: CHỈ dùng tư liệu người dùng — đọc ${idx} trước (mục "Tư liệu" của skill). Không thêm sự kiện, số liệu, trích dẫn nào ngoài tư liệu.`
    : ` Nguồn nội dung: kết hợp — tư liệu người dùng ở ${idx} là nguồn chính (đọc trước, mục "Tư liệu" của skill), Claude được tìm thêm (WebSearch/WebFetch) để bổ sung; ghi nguồn.`;
}
