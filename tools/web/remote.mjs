// Mở Xưởng phim từ điện thoại / máy khác qua Tailscale (mạng riêng ảo, không lộ máy ra Internet).
// Máy chủ vẫn nghe 127.0.0.1 như cũ; bật "truy cập từ xa" thì nghe THÊM trên địa chỉ Tailscale (100.64.0.0/10) của máy,
// và mọi yêu cầu đến từ đó phải đăng nhập bằng mật khẩu (cookie phiên, 30 ngày). Ngồi tại máy (127.0.0.1) không cần mật khẩu.
// Cấu hình theo MÁY ở ~/.config/xuong-phim/remote.json: { on, salt, hash, sessions: { sha256(token): hết hạn } }.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { CONF_DIR } from '../output.mjs';
import { IS_WIN, which } from '../platform.mjs';

const FILE = path.join(CONF_DIR, 'remote.json');
const DAYS = 30;
export const COOKIE = 'xp_s';

const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const write = (c) => { fs.mkdirSync(CONF_DIR, { recursive: true, mode: 0o700 }); fs.writeFileSync(FILE, JSON.stringify(c, null, 1), { mode: 0o600 }); return c; };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const scrypt = (pw, salt) => crypto.scryptSync(String(pw), Buffer.from(salt, 'hex'), 32).toString('hex');

// 100.64.0.0/10 = dải địa chỉ Tailscale cấp cho các máy (CGNAT)
// XUONG_REMOTE_TEST_IP (chỉ để kiểm thử, vd 127.0.0.2): coi địa chỉ đó như một máy trong Tailscale
const TEST_IP = process.env.XUONG_REMOTE_TEST_IP || '';
export const TEST = !!TEST_IP;
const v4 = (a) => String(a ?? '').replace(/^::ffff:/, '');
const cgnat = (a) => { const m = /^100\.(\d+)\.\d+\.\d+$/.exec(v4(a)); return !!m && +m[1] >= 64 && +m[1] <= 127; };
export const isTailnet = (a) => (TEST_IP && (v4(a) === TEST_IP || /^127\./.test(v4(a)))) || cgnat(a);
export const isLoopback = (a) => (!TEST_IP || v4(a) !== TEST_IP) && /^(127\.|::1$|::ffff:127\.)/.test(String(a ?? ''));
export const tailscaleIPs = () => [...(TEST_IP ? [TEST_IP] : []), ...Object.values(os.networkInterfaces()).flat().filter((i) => i?.family === 'IPv4' && cgnat(i.address)).map((i) => i.address)];

const TS_EXE = IS_WIN ? 'C:\\Program Files\\Tailscale\\tailscale.exe' : '/Applications/Tailscale.app/Contents/MacOS/Tailscale';
const tsBin = () => (fs.existsSync(TS_EXE) ? TS_EXE : which('tailscale'));
let tsCache = { at: 0, v: null };
// tên máy trong Tailscale (MagicDNS, vd may-tuan.tail1234.ts.net) — hỏi lệnh tailscale, nhớ 60 giây
function tailscaleInfo() {
  if (Date.now() - tsCache.at < 60000) return tsCache.v;
  let v = { installed: !!tsBin(), dns: '', name: '' };
  if (v.installed) {
    try {
      const r = spawnSync(tsBin(), ['status', '--json'], { encoding: 'utf8', timeout: 4000, windowsHide: true });
      const j = JSON.parse(r.stdout);
      v = { ...v, dns: String(j.Self?.DNSName ?? '').replace(/\.$/, ''), name: j.Self?.HostName ?? '', state: j.BackendState ?? '' };
    } catch { /* tailscale chưa đăng nhập / chưa chạy */ }
  }
  tsCache = { at: Date.now(), v };
  return v;
}

export function status(port) {
  const c = read();
  const ips = tailscaleIPs();
  const ts = tailscaleInfo();
  const urls = [...(ts.dns ? [`http://${ts.dns}:${port}`] : []), ...ips.map((ip) => `http://${ip}:${port}`)];
  return { on: !!c.on, hasPassword: !!c.hash, ips, urls, tailscale: ts.installed, tsState: ts.state ?? '', sessions: Object.keys(c.sessions ?? {}).length };
}
export const enabled = () => { const c = read(); return !!(c.on && c.hash); };

export function setPassword(pw) {
  pw = String(pw ?? '');
  if (pw.length < 8) throw Object.assign(new Error('Mật khẩu cần ít nhất 8 ký tự.'), { code: 400 });
  const salt = crypto.randomBytes(16).toString('hex');
  write({ ...read(), salt, hash: scrypt(pw, salt), sessions: {} }); // đổi mật khẩu → đăng xuất mọi máy
}
export function setOn(on) {
  const c = read();
  if (on && !c.hash) throw Object.assign(new Error('Đặt mật khẩu trước khi bật.'), { code: 400 });
  write({ ...c, on: !!on });
}
export const logoutAll = () => write({ ...read(), sessions: {} });

// ───────── đăng nhập: chặn đoán mật khẩu (5 lần sai / 10 phút / địa chỉ)
const fails = new Map();
export function login(pw, addr) {
  const now = Date.now();
  const list = (fails.get(addr) ?? []).filter((t) => now - t < 10 * 60000);
  if (list.length >= 5) throw Object.assign(new Error('Sai mật khẩu nhiều lần — thử lại sau 10 phút.'), { code: 429 });
  const c = read();
  const ok = c.hash && crypto.timingSafeEqual(Buffer.from(scrypt(pw ?? '', c.salt), 'hex'), Buffer.from(c.hash, 'hex'));
  if (!ok) { list.push(now); fails.set(addr, list); throw Object.assign(new Error('Sai mật khẩu.'), { code: 401 }); }
  fails.delete(addr);
  const token = crypto.randomBytes(32).toString('base64url');
  const sessions = Object.fromEntries(Object.entries(c.sessions ?? {}).filter(([, exp]) => exp > now));
  sessions[sha(token)] = now + DAYS * 86400000;
  write({ ...c, sessions });
  return { token, maxAge: DAYS * 86400 };
}
export function logout(token) {
  const c = read();
  if (token && c.sessions) { delete c.sessions[sha(token)]; write(c); }
}
export const cookieOf = (req) => (String(req.headers.cookie ?? '').split(/;\s*/).find((x) => x.startsWith(`${COOKIE}=`)) ?? '').slice(COOKIE.length + 1);
export function validSession(req) {
  const t = cookieOf(req);
  if (!t) return false;
  const exp = read().sessions?.[sha(t)];
  return !!exp && exp > Date.now();
}
