#!/usr/bin/env node
// Kiểm tra máy đã cài đủ cho Xưởng phim chưa.
//   node tools/doctor.mjs          in bảng kiểm tra, mã thoát 1 nếu thiếu thứ bắt buộc
//   node tools/doctor.mjs --hook   dùng cho hook SessionStart của Claude Code: đủ thì im lặng, thiếu thì báo Claude cách cài
//   node tools/doctor.mjs --json   kết quả dạng JSON (trang web dùng)
//   node tools/doctor.mjs --thu    dựng THẬT một tập mẫu ~9 giây (giọng → thời gian → âm thanh → MP4 1080×1920) trong thư mục tạm,
//                                  báo thời gian từng phần — dùng sau khi cài máy mới để chắc chắn cả dây chuyền chạy được
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { IS_WIN, isMain, probe as probeCmd, ttsVi, spawnBinSync } from './platform.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = probeCmd;
const SETUP = IS_WIN ? 'setup.cmd' : 'bash setup.sh';
const tts = () => { const t = ttsVi(); if (!t) return false; return spawnBinSync(t.cmd, [...t.pre, '-h'], { encoding: 'utf8', timeout: 30000 }).status === 0; };
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
    { id: 'fonts', label: 'Font', ok: exists('assets/fonts/fonts.json') && fs.readdirSync(path.join(ROOT, 'assets/fonts')).some((f) => f.endsWith('.woff2')), need: true },
    { id: 'venv', label: 'Môi trường Python âm thanh', ok: exists('.venv'), need: true },
    { id: 'sfx', label: 'Kho SFX', ok: exists('assets/sfx') && fs.readdirSync(path.join(ROOT, 'assets/sfx')).some((f) => f.endsWith('.wav')), need: true },
    { id: 'tts', label: 'Lệnh tts-vi (giọng đọc)', ok: tts(), need: true },
    { id: 'skill', label: 'Skill /series', ok: skillTarget === path.join(ROOT, 'skill'), info: skillTarget ?? 'chưa gắn', need: false },
    { id: 'claude', label: 'Lệnh claude (nút AI trên trang web)', ok: !!run('claude', ['--version']), need: false },
  ];
  return { ok: list.every((c) => c.ok || !c.need), list };
}

// Máy gốc để so: MacBook Pro Apple M1 Pro 8 nhân, 16 GB, chạy thẳng (đo 2026-11-22)
const REF = { name: 'MacBook Pro M1 Pro (máy gốc)', voice: 12, render: 12, total: 28 };

async function selfTest() {
  const r = checks();
  if (!r.ok) { console.log(`Còn thiếu: ${r.list.filter((c) => !c.ok && c.need).map((c) => c.label).join(', ')} — chạy: ${SETUP}`); return 1; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xuong-thu-may-'));
  fs.cpSync(path.join(ROOT, 'tools/selftest/thu-may'), path.join(tmp, 'thu-may'), { recursive: true });
  const epDir = path.join(tmp, 'thu-may/episodes/ep01');
  console.log(`Dựng thử một tập mẫu ~9 giây (${os.cpus().length} nhân, ${Math.round(os.totalmem() / 2 ** 30)} GB RAM, ${os.platform()} ${os.arch()})…`);
  const t0 = Date.now();
  let tVoice = 0, tRenderStart = 0, tRender = 0, engine = '', err = '';
  const code = await new Promise((ok) => {
    // thư mục phim trỏ vào thư mục tạm để bản thử không lọt vào thư mục phim thật
    const p = spawn(process.execPath, [path.join(ROOT, 'tools/ep.mjs'), epDir, 'all'], { cwd: ROOT, env: { ...process.env, XUONG_OUTPUT_DIR: path.join(tmp, 'out') } });
    let buf = '';
    const onData = (d) => {
      buf += d.toString();
      const parts = buf.split(/[\r\n]/);
      buf = parts.pop();
      for (const line of parts) {
        if (!line.trim()) continue;
        if (/^voice: xong/.test(line)) { tVoice = (Date.now() - t0) / 1000; engine = line.split('engine:')[1]?.trim() ?? ''; }
        if (/^\s*bundle /.test(line)) tRenderStart = Date.now();
        if (/^\s*xong \d+s/.test(line) && tRenderStart) tRender = (Date.now() - tRenderStart) / 1000;
        if (/lỗi|error|✗/i.test(line)) err += line + '\n';
        if (!/render \d+%|^Warning: You are sending/.test(line)) console.log(`  │ ${line}`);
      }
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('close', ok);
  });
  const total = (Date.now() - t0) / 1000;
  const mp4 = path.join(epDir, 'out/ep01.mp4');
  const probe = fs.existsSync(mp4) ? run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'csv=p=0', mp4]) : null;
  fs.rmSync(tmp, { recursive: true, force: true });
  if (code !== 0 || !probe) {
    console.log(`\n✗ Dựng thử KHÔNG thành công (mã thoát ${code}).${err ? `\n${err}` : ''}\n  Chạy lại: ${SETUP}  rồi  pnpm doctor --thu`);
    return 1;
  }
  const f = (x) => `${x.toFixed(0)} giây`;
  const ratio = total / REF.total;
  console.log(`\n✓ Dựng thử thành công — MP4 ${probe.split(',').slice(0, 2).join('×')}`);
  console.log(`  Giọng đọc (gồm nạp model): ${f(tVoice)}${engine ? ` · ${engine}` : ''}   [máy gốc ~${REF.voice} giây]`);
  console.log(`  Vẽ + xuất MP4:             ${f(tRender)}   [máy gốc ~${REF.render} giây]`);
  console.log(`  Tổng:                      ${f(total)}   [máy gốc ~${REF.total} giây — ${REF.name}]`);
  if (engine && !engine.startsWith('vieneu')) console.log('  ! Giọng không chạy bằng VieNeu (đang dùng dự phòng Gemini) — kiểm tra lại: ' + (IS_WIN ? 'powershell -ExecutionPolicy Bypass -File tools\\tts-vi\\install.ps1' : 'bash tools/tts-vi/install.sh'));
  console.log(ratio <= 1.3 ? '  Tốc độ ngang máy gốc.' : `  Chậm hơn máy gốc khoảng ${ratio.toFixed(1)} lần — một tập 90 giây sẽ mất tương ứng lâu hơn.`);
  return 0;
}

if (isMain(import.meta.url)) {
  const r = checks();
  if (process.argv.includes('--thu')) process.exitCode = await selfTest();
  else if (process.argv.includes('--json')) console.log(JSON.stringify(r));
  else if (process.argv.includes('--hook')) {
    const miss = r.list.filter((c) => !c.ok);
    if (miss.length)
      console.log(`Xưởng phim chưa cài đủ trên máy này: ${miss.map((c) => c.label).join(', ')}.
Hãy chạy \`${SETUP}\` ở thư mục xưởng (chạy nền, mất vài phút; lần đầu tải VieNeu và Chrome headless). Nếu script dừng vì cần mật khẩu máy (cài Homebrew) thì nhờ người dùng tự chạy \`${SETUP}\` trong Terminal. Xong thì chạy \`node tools/doctor.mjs\` để kiểm tra lại. Lệnh claude cần đăng nhập một lần (\`claude\` → \`/login\`) — việc đó người dùng tự làm.`);
  } else {
    for (const c of r.list) console.log(`  ${c.ok ? '✓' : c.need ? '✗' : '!'} ${c.label}${c.info ? ` — ${c.info}` : ''}`);
    console.log(r.ok ? 'Đủ để dùng xưởng.' : `Còn thiếu — chạy: ${SETUP}`);
    process.exitCode = r.ok ? 0 : 1;
  }
}
