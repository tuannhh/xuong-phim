// Tự mở Xưởng phim khi đăng nhập máy (chạy thẳng, không Docker) — trang http://localhost:4710 luôn sẵn,
// không phải nhờ Claude/Codex mở lại mỗi phiên.
//   macOS: LaunchAgent ~/Library/LaunchAgents/vn.xuong-phim.web.plist (RunAtLoad, tự chạy lại nếu máy chủ chết)
//   Linux: systemd user service ~/.config/systemd/user/xuong-phim.service
//   Windows: tệp .vbs trong thư mục Startup (%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup) chạy node ẩn khi đăng nhập.
//   Windows, chạy ngay khi BẬT MÁY (chưa cần đăng nhập): tác vụ Task Scheduler "Xuong phim" (kiểu S4U, tài khoản của người dùng,
//     không lưu mật khẩu) chạy thẳng `node tools/boot.mjs` (đọc ~/.config/xuong-phim/chay-nen.json: PATH, nhật ký riêng xuong-phim-nen.log).
//     Tạo/gỡ cần quyền quản trị → Windows hỏi UAC (tools/windows/quan-tri.ps1).
// Dùng: node tools/autostart.mjs on|off|status|restart|boot-on|boot-off   (trang Thiết lập gọi cùng các hàm này)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { IS_WIN, isMain, which } from './platform.mjs';
import { CONF_DIR } from './output.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LABEL = 'vn.xuong-phim.web';
const HOME = os.homedir();
const PLIST = path.join(HOME, 'Library/LaunchAgents', `${LABEL}.plist`);
const UNIT = path.join(HOME, '.config/systemd/user/xuong-phim.service');
const STARTUP_VBS = IS_WIN ? path.join(process.env.APPDATA ?? path.join(HOME, 'AppData/Roaming'), 'Microsoft/Windows/Start Menu/Programs/Startup/xuong-phim.vbs') : '';
const LOG = process.platform === 'darwin' ? path.join(HOME, 'Library/Logs/xuong-phim.log') : IS_WIN ? path.join(process.env.LOCALAPPDATA ?? path.join(HOME, 'AppData/Local'), 'xuong-phim/xuong-phim.log') : path.join(HOME, '.local/state/xuong-phim.log');
// bản chạy khi bật máy ghi nhật ký riêng: tệp của bản "khi đăng nhập" đang bị cmd.exe của bản đó giữ (bẫy 30)
const BOOT_LOG = path.join(path.dirname(LOG), 'xuong-phim-nen.log');
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true });
const ps = (cmd) => run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd]);
const TASK = 'Xuong phim', FW_RULE = 'Xuong phim (Tailscale)';
const BOOT_CONF = path.join(CONF_DIR, 'chay-nen.json');
const ADMIN_PS1 = path.join(ROOT, 'tools/windows/quan-tri.ps1');
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
// ───────── Windows: chạy khi bật máy (Task Scheduler) + tường lửa cho truy cập từ xa — cần quyền quản trị
// PATH cho máy chủ chạy nền khi chưa đăng nhập: gom thư mục của các lệnh cần dùng + PATH hiện tại
function winPath() {
  const dirs = [path.dirname(process.execPath), ...['claude', 'codex', 'uv', 'ffmpeg', 'pnpm', 'tts-vi', 'python'].map(which).filter(Boolean).map((p) => path.dirname(p)), ...(process.env.PATH ?? '').split(';')];
  return [...new Set(dirs.filter((d) => d && !/[%"]/.test(d) && fs.existsSync(d)))].join(';');
}
function writeBootConf() {
  const pass = ['XUONG_OUTPUT_DIR', 'XUONG_GL', 'XUONG_CONCURRENCY', 'STUDIO_CLAUDE_BIN', 'STUDIO_CLAUDE_MODEL'].filter((k) => process.env[k]);
  const env = { PORT: String(+(process.env.PORT || 4710)), PATH: winPath(), ...Object.fromEntries(pass.map((k) => [k, process.env[k]])) };
  fs.mkdirSync(CONF_DIR, { recursive: true });
  fs.writeFileSync(BOOT_CONF, JSON.stringify({ root: ROOT, log: BOOT_LOG, env, note: 'Xuong phim: chay khi bat may (Task Scheduler "Xuong phim") - tao boi tools/autostart.mjs' }, null, 1));
}
// chạy tools/windows/quan-tri.ps1 với quyền quản trị (Windows hiện hộp thoại UAC cho người dùng bấm) — không chặn máy chủ
function elevate(action, extra = {}) {
  const log = path.join(CONF_DIR, 'quan-tri.log');
  fs.mkdirSync(CONF_DIR, { recursive: true });
  fs.rmSync(log, { force: true });
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ADMIN_PS1, '-Action', action, ...Object.entries(extra).flatMap(([k, v]) => [`-${k}`, String(v)]), '-Log', log];
  const list = args.map((a) => `'"${a.replace(/'/g, "''")}"'`).join(',');
  const cmd = `try { $p = Start-Process -FilePath powershell.exe -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList @(${list}); exit $p.ExitCode } catch { exit 1223 }`;
  return new Promise((ok, no) => {
    const ch = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true, stdio: 'ignore' });
    ch.on('error', no);
    ch.on('close', (code) => {
      if (code === 0) return ok();
      let why = '';
      try { why = fs.readFileSync(log, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/)[0]; } catch { /* không có nhật ký */ }
      no(new Error(code === 1223 ? 'Chưa được cấp quyền quản trị — Windows hỏi (UAC) thì bấm "Yes".' : `Không làm được với quyền quản trị: ${why || `mã ${code}`}`));
    });
  });
}
export function bootStatus() {
  if (!IS_WIN || process.env.XUONG_DOCKER) return { supported: false, on: false };
  const out = ps(`$t = Get-ScheduledTask -TaskName '${TASK}' -ErrorAction SilentlyContinue; if ($t) { [string]$t.State + '|' + [string]$t.Principal.LogonType }`).stdout.trim();
  const [state, logon] = out ? out.split('|') : [];
  let here = false;
  try { here = JSON.parse(fs.readFileSync(BOOT_CONF, 'utf8')).root === ROOT; } catch { /* chưa có */ }
  return { supported: true, on: !!state, state: state ?? '', logon: logon ?? '', here, log: BOOT_LOG };
}
export async function bootEnable() {
  if (!IS_WIN) throw new Error('Chỉ dùng trên Windows (macOS/Linux: dùng "Tự mở khi đăng nhập").');
  writeBootConf();
  await elevate('boot-on', { User: `${process.env.USERDOMAIN ? `${process.env.USERDOMAIN}\\` : ''}${process.env.USERNAME ?? os.userInfo().username}`, Node: process.execPath, Script: path.join(ROOT, 'tools/boot.mjs'), Conf: CONF_DIR, Root: ROOT });
  return { ...status(), boot: bootStatus() };
}
export async function bootDisable() {
  if (!IS_WIN) return status();
  await elevate('boot-off');
  fs.rmSync(BOOT_CONF, { force: true });
  return { ...status(), boot: bootStatus() };
}
export function firewallStatus() {
  if (!IS_WIN) return { ok: true };
  const prog = ps(`$r = Get-NetFirewallRule -DisplayName '${FW_RULE}' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($r) { 'rule|' + [string]($r | Get-NetFirewallApplicationFilter).Program }`).stdout.trim();
  const exists = prog.startsWith('rule|');
  const program = exists ? prog.slice(5) : '';
  return { exists, program, ok: exists && program.toLowerCase() === process.execPath.toLowerCase() };
}
export const firewallEnable = (port) => elevate('fw-on', { Node: process.execPath, Port: port });

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
  return { supported: s.ok, why: s.why ?? '', on, log: LOG, self: process.env.XPC_SERVICE_NAME === LABEL || !!process.env.INVOCATION_ID || process.env.XUONG_AUTOSTART === '1', bootRun: process.env.XUONG_BOOT === '1' };
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
    // có tác vụ "chạy khi bật máy" → dừng + chạy lại tác vụ đó (tài khoản thường không tự tắt được node chạy nền S4U,
    // nhưng được bảo Task Scheduler dừng/chạy tác vụ của mình); không thì mở như lúc đăng nhập
    if (bootStatus().on) {
      run('schtasks.exe', ['/end', '/tn', TASK]);
      if (run('schtasks.exe', ['/run', '/tn', TASK]).status === 0) return true;
    }
    if (fs.existsSync(STARTUP_VBS)) { spawnSync('wscript.exe', [STARTUP_VBS], { windowsHide: true }); return true; }
    return false;
  }
  if (process.platform === 'darwin') return run('launchctl', ['kickstart', '-k', `gui/${process.getuid()}/${LABEL}`]).status === 0;
  return run('systemctl', ['--user', 'restart', 'xuong-phim.service']).status === 0;
}

if (isMain(import.meta.url)) {
  const cmd = process.argv[2] ?? 'status';
  try {
    const r = cmd === 'on' ? enable() : cmd === 'off' ? disable() : cmd === 'restart' ? { restarted: restart() }
      : cmd === 'boot-on' ? await bootEnable() : cmd === 'boot-off' ? await bootDisable() : { ...status(), boot: bootStatus() };
    console.log(JSON.stringify(r, null, 2));
  } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
}
