// Tiện ích chạy đa nền tảng (macOS · Linux · Windows) dùng chung cho tools/.
//  - isMain(import.meta.url): thay cho `import.meta.url === file://${process.argv[1]}` (sai trên Windows: file:///C:/…)
//  - which(bin): tìm lệnh trong PATH (Windows: .exe/.cmd, tự lần theo shim npm/pnpm tới .exe hoặc .js thật)
//  - spawnBin / spawnBinSync: chạy lệnh đã `which` (script .js → chạy bằng node, .cmd → cmd.exe) mà không cần shell
//  - ttsVi(): lệnh tts-vi (Windows: gọi thẳng python của VieNeu theo tools/tts-vi/config.env, không cần file thực thi)
// Import file này sớm: nó đặt PYTHONUTF8=1 để các script Python in được tiếng Việt khi chạy qua ống (Windows mặc định cp1252).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const IS_WIN = process.platform === 'win32';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

process.env.PYTHONUTF8 ??= '1';
process.env.PYTHONIOENCODING ??= 'utf-8';

const real = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } };
const norm = (p) => (IS_WIN ? p.toLowerCase() : p);

/** true khi file này là script đang được chạy trực tiếp (node file.mjs), không phải được import. */
export const isMain = (metaUrl) => !!process.argv[1] && norm(real(fileURLToPath(metaUrl))) === norm(real(process.argv[1]));

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const SCRIPT = /\.(c|m)?js$/i;
const SHELL = /\.(cmd|bat)$/i;

// shim .cmd của npm/pnpm: dòng cuối có "%dp0%\đường\dẫn\tới\claude.exe | cli.js" → trả về file thật
function resolveShim(p) {
  if (!SHELL.test(p)) return p;
  let txt = '';
  try { txt = fs.readFileSync(p, 'utf8'); } catch { return p; }
  const hits = [...txt.matchAll(/"%~?dp0%?\\([^"]+?\.(?:exe|c?js|mjs))"/gi)];
  if (!hits.length) return p;
  const target = path.join(path.dirname(p), hits[hits.length - 1][1]);
  return isFile(target) ? target : p;
}

/** Đường dẫn đầy đủ của lệnh `bin` (hoặc null). Trên Windows có thể trả về .exe, .js (chạy bằng node) hoặc .cmd. */
export function which(bin) {
  if (!bin) return null;
  if (path.isAbsolute(bin)) return isFile(bin) ? resolveShim(bin) : null;
  const dirs = (process.env.PATH ?? process.env.Path ?? '').split(path.delimiter).filter(Boolean);
  const exts = IS_WIN ? ['.exe', '.cmd', '.bat', '.com'] : [''];
  for (const d of dirs)
    for (const e of exts) {
      const p = path.join(d, bin + e);
      if (isFile(p)) return IS_WIN ? resolveShim(p) : p;
    }
  return null;
}

// [lệnh, đối số] thực sự cần gọi cho `bin` (script .js → node; .cmd/.bat → cmd.exe)
export function cmdOf(bin, args = []) {
  if (SCRIPT.test(bin)) return [process.execPath, [bin, ...args]];
  if (IS_WIN && SHELL.test(bin)) return [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', bin, ...args]];
  return [bin, args];
}
export const spawnBin = (bin, args = [], opts = {}) => { const [c, a] = cmdOf(bin, args); return spawn(c, a, opts); };
export const spawnBinSync = (bin, args = [], opts = {}) => { const [c, a] = cmdOf(bin, args); return spawnSync(c, a, opts); };

// đọc tools/tts-vi/config.env (KEY=VALUE, # là chú thích)
function ttsConfig() {
  const cfg = {};
  try {
    for (const line of fs.readFileSync(path.join(ROOT, 'tools/tts-vi/config.env'), 'utf8').split(/\r?\n/))
      if (line.trim() && !line.trimStart().startsWith('#') && line.includes('=')) { const i = line.indexOf('='); cfg[line.slice(0, i).trim()] = line.slice(i + 1); }
  } catch {}
  return cfg;
}

/** Lệnh sinh giọng: { cmd, pre } — chạy `cmd ...pre ...đốiSố`. null nếu chưa cài tts-vi. */
export function ttsVi() {
  const direct = () => { const p = which('tts-vi'); return p && !SHELL.test(p) && !/\.ps1$/i.test(p) ? { cmd: p, pre: [] } : null; };
  const viaConfig = () => {
    let dir = ttsConfig().VIENEU_DIR?.trim();
    if (!dir) return null;
    if (dir === '~' || dir.startsWith('~/')) dir = path.join(os.homedir(), dir.slice(1));
    const py = [path.join(dir, '.venv/Scripts/python.exe'), path.join(dir, '.venv/bin/python')].find(isFile);
    return py ? { cmd: py, pre: ['-X', 'utf8', '-I', path.join(ROOT, 'tools/tts-vi/tts_vi.py')] } : null;
  };
  return (IS_WIN ? viaConfig() ?? direct() : direct() ?? viaConfig());
}

/** Chạy lệnh trong thư mục rồi trả stdout dòng đầu, hoặc null nếu lỗi/không có. */
export function probe(name, args = []) {
  const bin = which(name);
  if (!bin) return null;
  const r = spawnBinSync(bin, args, { encoding: 'utf8', timeout: 15000 });
  return r.status === 0 ? (r.stdout || r.stderr || '').trim().split('\n')[0] : null;
}
