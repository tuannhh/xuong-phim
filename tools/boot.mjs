// Máy chủ Xưởng phim chạy nền ngay khi BẬT MÁY (Windows, chưa cần đăng nhập) — tác vụ Task Scheduler "Xuong phim" gọi thẳng:
//   node tools/boot.mjs <thư mục cấu hình>
// Đọc <thư mục cấu hình>/chay-nen.json (do tools/autostart.mjs ghi): { root, log, env } → đặt biến môi trường (PATH…),
// ghi nhật ký ra file riêng rồi mở máy chủ ngay trong tiến trình này. Không chạy qua cmd.exe: Task Scheduler dừng/chạy lại
// được đúng tiến trình node (tài khoản thường không tự tắt được tiến trình chạy nền kiểu S4U — bẫy 30).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const conf = process.argv[2] || process.env.XUONG_CONFIG_DIR || path.join(os.homedir(), '.config', 'xuong-phim');
const cfg = JSON.parse(fs.readFileSync(path.join(conf, 'chay-nen.json'), 'utf8'));
Object.assign(process.env, cfg.env ?? {}, { XUONG_AUTOSTART: '1', XUONG_BOOT: '1' });
if (conf !== path.join(os.homedir(), '.config', 'xuong-phim')) process.env.XUONG_CONFIG_DIR = conf;
process.chdir(cfg.root);
if (cfg.log) {
  fs.mkdirSync(path.dirname(cfg.log), { recursive: true });
  const out = fs.createWriteStream(cfg.log, { flags: 'a' });
  const write = (chunk, enc, cb) => out.write(chunk, typeof enc === 'string' ? enc : undefined, typeof enc === 'function' ? enc : cb);
  process.stdout.write = write;
  process.stderr.write = write;
}
console.log(`— ${new Date().toLocaleString('vi-VN')}: bật máy, mở Xưởng phim (${cfg.root}) —`);
process.on('uncaughtException', (e) => { console.error(e?.stack ?? e); process.exit(1); });
const server = await import(pathToFileURL(path.join(cfg.root, 'tools/web/server.mjs')).href);
server.main();
