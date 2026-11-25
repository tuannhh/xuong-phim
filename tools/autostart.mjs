// Tự mở Xưởng phim khi đăng nhập máy (chạy thẳng, không Docker) — trang http://localhost:4710 luôn sẵn,
// không phải nhờ Claude/Codex mở lại mỗi phiên.
//   macOS: LaunchAgent ~/Library/LaunchAgents/vn.xuong-phim.web.plist (RunAtLoad, tự chạy lại nếu máy chủ chết)
//   Linux: systemd user service ~/.config/systemd/user/xuong-phim.service
//   Windows: tệp .vbs trong thư mục Startup (%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup) chạy node ẩn khi đăng nhập.
// Dùng: node tools/autostart.mjs on|off|status   (trang Thiết lập gọi cùng các hàm này)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { IS_WIN, isMain, which } from './platform.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LABEL = 'vn.xuong-phim.web';
const HOME = os.homedir();
const PLIST = path.join(HOME, 'Library/LaunchAgents', `${LABEL}.plist`);
const UNIT = path.join(HOME, '.config/systemd/user/xuong-phim.service');
const STARTUP_VBS = IS_WIN ? path.join(process.env.APPDATA ?? path.join(HOME, 'AppData/Roaming'), 'Microsoft/Windows/Start Menu/Programs/Startup/xuong-phim.vbs') : '';
const LOG = process.platform === 'darwin' ? path.join(HOME, 'Library/Logs/xuong-phim.log') : IS_WIN ? path.join(process.env.LOCALAPPDATA ?? path.join(HOME, 'AppData/Local'), 'xuong-phim/xuong-phim.log') : path.join(HOME, '.local/state/xuong-phim.log');
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// PATH cho máy chủ chạy nền: node + claude + codex + uv + ffmpeg + tts-vi + pnpm phải tìm thấy (launchd/systemd không đọc .zshrc)
function servicePath() {
  const dirs = [path.dirname(process.execPath), ...['claude', 'codex', 'uv', 'ffmpeg', 'tts-vi', 'pnpm'].map(which).filter(Boolean).map((p) => path.dirname(p)),
    ...(process.env.PATH ?? '').split(path.delimiter), path.join(HOME, '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  return [...new Set(dirs.filter((d) => d && !d.includes('/.claude/') && fs.existsSync(d)))].join(':');
}

// Windows: dừng máy chủ Xưởng phim đang chạy (node … tools\web\server.mjs), không đụng tiến trình khác
function killServer() {
  const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'tools[/\\\\]web[/\\\\]server\\.mjs' -and $_.ProcessId -ne ${process.pid} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
  run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
}
const serverAlive = () => run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `if (Get-NetTCPConnection -LocalPort ${process.env.PORT || 4710} -State Listen -ErrorAction SilentlyContinue) { 'yes' }`]).stdout.includes('yes');

export function supported() {
  if (process.env.XUONG_DOCKER) return { ok: false, why: 'Đang chạy trong Docker — container tự chạy lại khi mở Docker Desktop (restart: unless-stopped).' };
  if (process.platform === 'darwin' || IS_WIN) return { ok: true };
  if (process.platform === 'linux' && run('systemctl', ['--user', 'is-system-running']).status !== null && fs.existsSync('/run/systemd/system')) return { ok: true };
  return { ok: false, why: 'Máy này chưa hỗ trợ tự mở (cần macOS, Windows hoặc Linux có systemd). Mở bằng: bash start.sh' };
}

export function status() {
  const s = supported();
  const on = process.platform === 'darwin' ? fs.existsSync(PLIST) : IS_WIN ? fs.existsSync(STARTUP_VBS) : fs.existsSync(UNIT);
  return { supported: s.ok, why: s.why ?? '', on, log: LOG, self: process.env.XPC_SERVICE_NAME === LABEL || !!process.env.INVOCATION_ID || process.env.XUONG_AUTOSTART === '1' };
}

export function enable() {
  const s = supported();
  if (!s.ok) throw new Error(s.why);
  const server = path.join(ROOT, 'tools/web/server.mjs');
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  if (IS_WIN) {
    // wscript chạy cửa sổ ẩn (0), nhật ký ghi qua cmd /c … >> log; PATH lấy từ phiên đăng nhập của người dùng
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const line = `cmd /c ""${process.execPath}" "${server}" >> "${LOG}" 2>&1"`;
    fs.mkdirSync(path.dirname(STARTUP_VBS), { recursive: true });
    fs.writeFileSync(STARTUP_VBS, `' Xuong phim: tu mo khi dang nhap - tao boi tools/autostart.mjs (tat: node tools/autostart.mjs off)\r\nSet sh = CreateObject("WScript.Shell")\r\nsh.CurrentDirectory = ${q(ROOT)}\r\nsh.Environment("Process")("XUONG_AUTOSTART") = "1"\r\nsh.Run ${q(line)}, 0, False\r\n`, 'utf8');
    if (!status().self && !serverAlive()) spawnSync('wscript.exe', [STARTUP_VBS], { windowsHide: true });
  } else if (process.platform === 'darwin') {
    fs.mkdirSync(path.dirname(PLIST), { recursive: true });
    fs.writeFileSync(PLIST, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>${esc(process.execPath)}</string><string>${esc(server)}</string></array>
  <key>WorkingDirectory</key><string>${esc(ROOT)}</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${esc(servicePath())}</string><key>XUONG_AUTOSTART</key><string>1</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>StandardOutPath</key><string>${esc(LOG)}</string>
  <key>StandardErrorPath</key><string>${esc(LOG)}</string>
</dict></plist>
`);
    const dom = `gui/${process.getuid()}`;
    run('launchctl', ['bootout', `${dom}/${LABEL}`]);
    const r = run('launchctl', ['bootstrap', dom, PLIST]);
    if (r.status !== 0 && !/already/i.test(r.stderr)) throw new Error(`launchctl: ${r.stderr.trim() || r.status}`);
  } else {
    fs.mkdirSync(path.dirname(UNIT), { recursive: true });
    fs.writeFileSync(UNIT, `[Unit]
Description=Xuong phim (http://localhost:4710)

[Service]
WorkingDirectory=${ROOT}
Environment=PATH=${servicePath()}
Environment=XUONG_AUTOSTART=1
ExecStart=${process.execPath} ${server}
Restart=on-failure
RestartSec=15
StandardOutput=append:${LOG}
StandardError=append:${LOG}

[Install]
WantedBy=default.target
`);
    run('systemctl', ['--user', 'daemon-reload']);
    const r = run('systemctl', ['--user', 'enable', '--now', 'xuong-phim.service']);
    if (r.status !== 0) throw new Error(`systemctl: ${r.stderr.trim()}`);
  }
  return status();
}

// tắt tự mở. Máy chủ đang trả lời trang này mà chính là bản chạy nền → giữ chạy tới lần khởi động lại máy (không tự giết mình)
export function disable() {
  const self = status().self;
  if (IS_WIN) {
    fs.rmSync(STARTUP_VBS, { force: true });
    if (!self) killServer();
  } else if (process.platform === 'darwin') {
    if (!self) run('launchctl', ['bootout', `gui/${process.getuid()}/${LABEL}`]);
    fs.rmSync(PLIST, { force: true });
  } else if (fs.existsSync(UNIT)) {
    run('systemctl', ['--user', 'disable', ...(self ? [] : ['--now']), 'xuong-phim.service']);
    fs.rmSync(UNIT, { force: true });
    run('systemctl', ['--user', 'daemon-reload']);
  }
  return { ...status(), stillRunning: self };
}

// khởi động lại bản chạy nền (sau khi cập nhật mã) — chỉ gọi khi không có việc đang chạy
export function restart() {
  if (IS_WIN) {
    killServer();
    spawnSync('wscript.exe', [STARTUP_VBS], { windowsHide: true });
    return true;
  }
  if (process.platform === 'darwin') return run('launchctl', ['kickstart', '-k', `gui/${process.getuid()}/${LABEL}`]).status === 0;
  return run('systemctl', ['--user', 'restart', 'xuong-phim.service']).status === 0;
}

if (isMain(import.meta.url)) {
  const cmd = process.argv[2] ?? 'status';
  try {
    const r = cmd === 'on' ? enable() : cmd === 'off' ? disable() : cmd === 'restart' ? { restarted: restart() } : status();
    console.log(JSON.stringify(r, null, 2));
  } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
}
