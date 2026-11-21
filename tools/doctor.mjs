#!/usr/bin/env node
// Kiểm tra máy đã cài đủ cho Xưởng phim chưa.
//   node tools/doctor.mjs          in bảng kiểm tra, mã thoát 1 nếu thiếu thứ bắt buộc
//   node tools/doctor.mjs --hook   dùng cho hook SessionStart của Claude Code: đủ thì im lặng, thiếu thì báo Claude cách cài
//   node tools/doctor.mjs --json   kết quả dạng JSON (trang web dùng)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args = []) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000 });
  return r.status === 0 ? (r.stdout || r.stderr).trim().split('\n')[0] : null;
};
const exists = (p) => fs.existsSync(path.join(ROOT, p));

export function checks() {
  const nodeMajor = +process.versions.node.split('.')[0];
  const skill = path.join(os.homedir(), '.claude/skills/series');
  let skillTarget = null;
  try { skillTarget = fs.realpathSync(skill); } catch {}
  const list = [
    { id: 'node', label: 'Node ≥ 20', ok: nodeMajor >= 20, info: process.version, need: true },
    { id: 'pnpm', label: 'pnpm', ok: !!run('pnpm', ['-v']), need: true },
    { id: 'uv', label: 'uv (Python)', ok: !!run('uv', ['--version']), need: true },
    { id: 'ffmpeg', label: 'ffmpeg', ok: !!run('ffmpeg', ['-version']), need: true },
    { id: 'modules', label: 'Thư viện Node', ok: exists('node_modules/remotion') && exists('node_modules/@remotion/renderer'), need: true },
    { id: 'fonts', label: 'Font', ok: exists('assets/fonts/fonts.json'), need: true },
    { id: 'venv', label: 'Môi trường Python âm thanh', ok: exists('.venv'), need: true },
    { id: 'sfx', label: 'Kho SFX', ok: exists('assets/sfx') && fs.readdirSync(path.join(ROOT, 'assets/sfx')).some((f) => f.endsWith('.wav')), need: true },
    { id: 'tts', label: 'Lệnh tts-vi (giọng đọc)', ok: !!run('tts-vi', ['-h']), need: true },
    { id: 'skill', label: 'Skill /series', ok: skillTarget === path.join(ROOT, 'skill'), info: skillTarget ?? 'chưa gắn', need: false },
    { id: 'claude', label: 'Lệnh claude (nút AI trên trang web)', ok: !!run('claude', ['--version']), need: false },
  ];
  return { ok: list.every((c) => c.ok || !c.need), list };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = checks();
  if (process.argv.includes('--json')) console.log(JSON.stringify(r));
  else if (process.argv.includes('--hook')) {
    const miss = r.list.filter((c) => !c.ok);
    if (miss.length)
      console.log(`Xưởng phim chưa cài đủ trên máy này: ${miss.map((c) => c.label).join(', ')}.
Hãy chạy \`bash setup.sh\` ở thư mục xưởng (chạy nền, mất vài phút; lần đầu tải VieNeu và Chrome headless). Nếu script dừng vì cần mật khẩu máy (cài Homebrew) thì nhờ người dùng tự chạy \`bash setup.sh\` trong Terminal. Xong thì chạy \`node tools/doctor.mjs\` để kiểm tra lại. Lệnh claude cần đăng nhập một lần (\`claude\` → \`/login\`) — việc đó người dùng tự làm.`);
  } else {
    for (const c of r.list) console.log(`  ${c.ok ? '✓' : c.need ? '✗' : '!'} ${c.label}${c.info ? ` — ${c.info}` : ''}`);
    console.log(r.ok ? 'Đủ để dùng xưởng.' : 'Còn thiếu — chạy: bash setup.sh');
    process.exitCode = r.ok ? 0 : 1;
  }
}
