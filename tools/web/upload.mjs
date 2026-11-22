// Ghi một luồng tải lên (dữ liệu thô từ trình duyệt) vào file: ghi ra .part rồi đổi tên, chặn quá cỡ.
// Dùng chung cho tư liệu, ảnh series (logo watermark, mascot) và nhạc nền.
import fs from 'node:fs';
import path from 'node:path';

export async function saveStream(destDir, name, req, max, tooBig) {
  if (+req.headers['content-length'] > max) throw new Error(tooBig);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, name), tmp = `${dest}.part`;
  await new Promise((ok, no) => {
    let size = 0;
    const w = fs.createWriteStream(tmp);
    req.on('data', (c) => { size += c.length; if (size > max) { req.destroy(); w.destroy(); no(new Error(tooBig)); } });
    req.on('error', no);
    w.on('error', no);
    w.on('finish', ok);
    req.pipe(w);
  }).catch((e) => { fs.rmSync(tmp, { force: true }); throw e; });
  fs.renameSync(tmp, dest);
  return { name, size: fs.statSync(dest).size };
}
