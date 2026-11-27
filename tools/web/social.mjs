// Đăng phim lên mạng xã hội của chính người dùng: Facebook Page (Reels), Instagram (Reels), YouTube (Shorts), TikTok.
// - CHỈ đăng khi người dùng bấm "Đăng" hoặc tự đặt lịch (CLAUDE.md: xưởng không tự đăng). Lịch chạy trong máy chủ → máy phải bật lúc đến giờ.
// - Khoá ứng dụng (Meta App, TikTok app; YouTube dùng chung OAuth client với Google Drive) + token lưu NGOÀI repo:
//   ~/.config/xuong-phim/social.json (quyền 600). Lịch đăng + lịch sử: ~/.config/xuong-phim/social-posts.json.
//   Không bao giờ trả secret/token về trình duyệt.
// - Mỗi "kênh" (đích đăng) có id dạng fb:<page> · ig:<ig-user> · yt:<channel> · tt:<open_id>. Một tài khoản Meta → nhiều Trang + Instagram.
// - Không thư viện ngoài: fetch của Node. XUONG_SOCIAL_BASE → mọi API trỏ về máy chủ giả lập (kiểm thử).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CONF_DIR } from '../output.mjs';
import { googleClient } from './drive.mjs';

export class SocialError extends Error {}
const err = (msg, extra = {}) => Object.assign(new SocialError(msg), extra);

const MOCK = process.env.XUONG_SOCIAL_BASE;
const GV = 'v27.0'; // phiên bản Graph API (11/2026; Meta giữ mỗi bản ít nhất 2 năm)
const U = MOCK
  ? { fbDialog: `${MOCK}/fb/dialog/oauth`, graph: `${MOCK}/graph`, rupload: `${MOCK}/rupload`, gAuth: `${MOCK}/g/auth`, gToken: `${MOCK}/g/token`, gRevoke: `${MOCK}/g/revoke`, yt: `${MOCK}/yt`, ytUpload: `${MOCK}/yt/upload`, ttAuth: `${MOCK}/tt/auth`, tt: `${MOCK}/tt` }
  : { fbDialog: `https://www.facebook.com/${GV}/dialog/oauth`, graph: `https://graph.facebook.com/${GV}`, rupload: 'https://rupload.facebook.com', gAuth: 'https://accounts.google.com/o/oauth2/v2/auth', gToken: 'https://oauth2.googleapis.com/token', gRevoke: 'https://oauth2.googleapis.com/revoke', yt: 'https://www.googleapis.com/youtube/v3', ytUpload: 'https://www.googleapis.com/upload/youtube/v3', ttAuth: 'https://www.tiktok.com/v2/auth/authorize/', tt: 'https://open.tiktokapis.com/v2' };

export const PLATFORMS = {
  meta: { label: 'Facebook + Instagram' },
  youtube: { label: 'YouTube' },
  tiktok: { label: 'TikTok' },
};
// limit = số ký tự nội dung; maxSec = thời lượng tối đa (Facebook Reels 90 giây; YouTube quá 3 phút thì không còn là Shorts; TikTok theo tài khoản)
export const KINDS = {
  fb: { label: 'Facebook', limit: 5000, maxSec: 90 },
  ig: { label: 'Instagram', limit: 2200, maxSec: 900 },
  yt: { label: 'YouTube', limit: 5000, maxSec: null },
  tt: { label: 'TikTok', limit: 2200, maxSec: 600 },
};
const META_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'business_management', 'instagram_basic', 'instagram_content_publish'];
const YT_SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];
const TT_SCOPES = ['user.info.basic', 'video.publish', 'video.upload'];

// ───────── lưu cấu hình (ngoài repo)
const CONF = path.join(CONF_DIR, 'social.json');
const POSTS = path.join(CONF_DIR, 'social-posts.json');
const readFile = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeFile = (f, v) => {
  fs.mkdirSync(CONF_DIR, { recursive: true, mode: 0o700 });
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(v, null, 1), { mode: 0o600 });
  fs.renameSync(tmp, f);
};
const load = () => ({ apps: {}, accounts: [], ...readFile(CONF, {}) });
const save = (c) => writeFile(CONF, c);
const setAccount = (acc) => { const c = load(); c.accounts = [...c.accounts.filter((a) => a.key !== acc.key), acc]; save(c); };

export const redirectUri = (platform, port) => platform === 'youtube' ? `http://127.0.0.1:${port}/api/social/callback/youtube` : `http://localhost:${port}/api/social/callback/${platform}`;

// trạng thái cho trình duyệt (không có token / secret)
export function status(port) {
  const c = load();
  return {
    apps: { meta: !!c.apps.meta?.id, tiktok: !!c.apps.tiktok?.key, youtube: !!googleClient()?.id },
    appIds: { meta: c.apps.meta?.id ?? '', tiktok: c.apps.tiktok?.key ?? '', metaConfig: c.apps.meta?.config ?? '' },
    redirect: Object.fromEntries(Object.keys(PLATFORMS).map((p) => [p, redirectUri(p, port)])),
    accounts: c.accounts.map((a) => ({ key: a.key, platform: a.platform, name: a.name, connected: a.connected, broken: a.broken ?? null, dests: a.dests.map(({ id, kind, name }) => ({ id, kind, name })) })),
    dests: dests(),
  };
}
export const dests = () => load().accounts.filter((a) => !a.broken).flatMap((a) => a.dests.map(({ id, kind, name }) => ({ id, kind, name, account: a.key, platform: a.platform })));

export function saveApp(platform, { id, secret, config: cfg }) {
  id = String(id ?? '').trim(); secret = String(secret ?? '').trim();
  if (platform === 'meta') {
    if (!/^\d{6,20}$/.test(id) && !MOCK) throw err('App ID của Meta là một dãy số (Meta for Developers → App settings → Basic).');
  } else if (platform === 'tiktok') {
    if (!/^[\w-]{6,40}$/.test(id) && !MOCK) throw err('Client key của TikTok không đúng dạng (TikTok for Developers → app → Credentials).');
  } else throw err('Nền tảng không hỗ trợ.');
  if (!secret || secret.length > 200) throw err('Thiếu app secret / client secret.');
  const c = load();
  const prev = c.apps[platform];
  const config = String(cfg ?? '').trim();
  if (config && !/^\d{6,20}$/.test(config)) throw err('Configuration ID (Facebook Login for Business) là một dãy số.');
  c.apps[platform] = platform === 'tiktok' ? { key: id, secret } : { id, secret, ...(config ? { config } : {}) };
  // đổi ứng dụng → tài khoản đã nối bằng ứng dụng cũ không dùng được nữa
  if ((prev?.id ?? prev?.key) !== id) c.accounts = c.accounts.filter((a) => a.platform !== platform);
  save(c);
}
export function forgetApp(platform) {
  const c = load();
  delete c.apps[platform];
  c.accounts = c.accounts.filter((a) => a.platform !== platform);
  save(c);
}
export function removeAccount(key) {
  const c = load();
  const a = c.accounts.find((x) => x.key === key);
  c.accounts = c.accounts.filter((x) => x.key !== key);
  save(c);
  if (a?.platform === 'youtube' && a.token?.refresh) fetch(`${U.gRevoke}?token=${encodeURIComponent(a.token.refresh)}`, { method: 'POST' }).catch(() => {});
  if (a?.platform === 'tiktok' && a.token?.access) { const app = c.apps.tiktok; if (app) form(`${U.tt}/oauth/revoke/`, { client_key: app.key, client_secret: app.secret, token: a.token.access }).catch(() => {}); }
}

// ───────── OAuth (một lượt kết nối = một state, hết hạn sau 10 phút)
const pending = new Map();
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const safeBack = (b) => (/^#\/[\w/?=&.-]*$/.test(b ?? '') ? b : '#/settings');
export function authUrl(platform, port, back) {
  const c = load();
  for (const [k, v] of pending) if (Date.now() - v.at > 600000) pending.delete(k);
  const state = b64url(crypto.randomBytes(24));
  const redirect = redirectUri(platform, port);
  const rec = { platform, redirect, back: safeBack(back), at: Date.now() };
  if (platform === 'meta') {
    if (!c.apps.meta) throw err('Chưa nhập App ID / App Secret của Meta.');
    pending.set(state, rec);
    // ứng dụng kiểu Business (Facebook Login for Business) dùng config_id thay cho danh sách quyền
    return `${U.fbDialog}?${new URLSearchParams({ client_id: c.apps.meta.id, redirect_uri: redirect, state, response_type: 'code', ...(c.apps.meta.config ? { config_id: c.apps.meta.config } : { scope: META_SCOPES.join(',') }) })}`;
  }
  if (platform === 'youtube') {
    const g = googleClient();
    if (!g?.id) throw err('Chưa có OAuth client Google — dán client ở mục Google Drive (dùng chung cho YouTube).');
    rec.verifier = b64url(crypto.randomBytes(48));
    pending.set(state, rec);
    return `${U.gAuth}?${new URLSearchParams({ client_id: g.id, redirect_uri: redirect, response_type: 'code', scope: YT_SCOPES.join(' '), access_type: 'offline', prompt: 'consent select_account', state, code_challenge: b64url(crypto.createHash('sha256').update(rec.verifier).digest()), code_challenge_method: 'S256' })}`;
  }
  if (platform === 'tiktok') {
    if (!c.apps.tiktok) throw err('Chưa nhập Client key / Client secret của TikTok.');
    rec.verifier = b64url(crypto.randomBytes(48)).slice(0, 64);
    pending.set(state, rec);
    // TikTok (Login Kit cho máy tính): code_challenge = SHA256(verifier) dạng HEX
    return `${U.ttAuth}?${new URLSearchParams({ client_key: c.apps.tiktok.key, redirect_uri: redirect, response_type: 'code', scope: TT_SCOPES.join(','), state, code_challenge: crypto.createHash('sha256').update(rec.verifier).digest('hex'), code_challenge_method: 'S256' })}`;
  }
  throw err('Nền tảng không hỗ trợ.');
}

const asJson = async (r, who) => {
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error?.message || (j.error && typeof j.error === 'string') || (j.error?.code && j.error.code !== 'ok')) {
    const m = j.error?.message || j.error_description || j.error?.error_user_msg || (typeof j.error === 'string' ? j.error : '') || j.message || `${who} trả lỗi ${r.status}`;
    throw err(`${who}: ${m}`, { status: r.status, code: j.error?.code ?? j.error, sub: j.error?.error_subcode });
  }
  return j;
};
const form = (url, params, headers = {}) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(params) });
const graph = async (method, p, params = {}, token) => {
  const q = new URLSearchParams({ ...params, ...(token ? { access_token: token } : {}) });
  const r = method === 'GET' ? await fetch(`${U.graph}${p}?${q}`) : await form(`${U.graph}${p}`, q);
  return asJson(r, 'Meta');
};

// nền tảng chuyển về /api/social/callback/<platform>?code&state → đổi code lấy token, lấy danh sách kênh. Trả hash để chuyển trình duyệt về.
export async function handleCallback(platform, query) {
  const p = pending.get(query.get('state') ?? '');
  if (!p || p.platform !== platform) throw err('Phiên kết nối không hợp lệ hoặc đã hết hạn — bấm Kết nối lại.');
  pending.delete(query.get('state'));
  const fail = (m) => err(m, { back: p.back });
  if (query.get('error')) throw fail(['access_denied', 'user_denied'].includes(query.get('error')) || query.get('error_reason') === 'user_denied' ? 'Bạn đã từ chối cấp quyền.' : `${PLATFORMS[platform].label} báo: ${query.get('error_description') || query.get('error')}`);
  const code = query.get('code') ?? '';
  try {
    if (platform === 'meta') await connectMeta(code, p.redirect);
    else if (platform === 'youtube') await connectYoutube(code, p.redirect, p.verifier);
    else await connectTiktok(code, p.redirect, p.verifier);
  } catch (e) { throw fail(e.message); }
  return p.back;
}

// ───────── Meta: token người dùng dài hạn (~60 ngày) → token Trang (không hết hạn) + Instagram nối với Trang
async function connectMeta(code, redirect) {
  const app = load().apps.meta;
  const short = await graph('GET', '/oauth/access_token', { client_id: app.id, client_secret: app.secret, redirect_uri: redirect, code });
  const long = await graph('GET', '/oauth/access_token', { grant_type: 'fb_exchange_token', client_id: app.id, client_secret: app.secret, fb_exchange_token: short.access_token });
  const me = await graph('GET', '/me', { fields: 'id,name' }, long.access_token);
  const acc = { key: `meta:${me.id}`, platform: 'meta', name: me.name, connected: new Date().toISOString(), token: long.access_token, expiry: long.expires_in ? Date.now() + long.expires_in * 1000 : null, dests: [] };
  acc.dests = await metaDests(acc.token);
  if (!acc.dests.length) throw err('Tài khoản này chưa quản lý Trang Facebook nào (hoặc chưa tích chọn Trang trên màn hình cấp quyền). Kết nối lại và chọn Trang.');
  setAccount(acc);
}
async function metaDests(userToken) {
  const out = [];
  let next = { fields: 'id,name,access_token,instagram_business_account{id,username}', limit: '100' };
  for (let i = 0; next && i < 10; i++) {
    const r = await graph('GET', '/me/accounts', next, userToken);
    for (const pg of r.data ?? []) {
      out.push({ id: `fb:${pg.id}`, kind: 'fb', name: pg.name, ref: pg.id, token: pg.access_token });
      const ig = pg.instagram_business_account;
      if (ig?.id) out.push({ id: `ig:${ig.id}`, kind: 'ig', name: ig.username ? `@${ig.username}` : `Instagram của ${pg.name}`, ref: ig.id, token: pg.access_token, page: pg.name });
    }
    next = r.paging?.cursors?.after && r.paging?.next ? { fields: next.fields, limit: '100', after: r.paging.cursors.after } : null;
  }
  return out;
}

// ───────── YouTube: OAuth client Google dùng chung với Drive (Desktop app, loopback + PKCE); mỗi lần kết nối = một kênh
async function gToken(params) {
  const g = googleClient();
  const r = await form(U.gToken, { client_id: g.id, client_secret: g.secret, ...params });
  return asJson(r, 'Google');
}
async function connectYoutube(code, redirect, verifier) {
  const t = await gToken({ code, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier });
  if (!t.refresh_token) throw err('Google không trả refresh token — vào myaccount.google.com/permissions gỡ quyền của ứng dụng rồi kết nối lại.');
  if (t.scope && !t.scope.split(' ').includes(YT_SCOPES[0])) throw err('Chưa tích quyền "Quản lý video YouTube" trên màn hình đồng ý — kết nối lại và tích ô đó.');
  const token = { access: t.access_token, refresh: t.refresh_token, expiry: Date.now() + (t.expires_in ?? 3600) * 1000 };
  const r = await asJson(await fetch(`${U.yt}/channels?part=snippet&mine=true`, { headers: { authorization: `Bearer ${token.access}` } }), 'YouTube');
  const ch = r.items?.[0];
  if (!ch) throw err('Tài khoản Google này chưa có kênh YouTube — tạo kênh trên youtube.com rồi kết nối lại.');
  setAccount({ key: `yt:${ch.id}`, platform: 'youtube', name: ch.snippet?.title ?? ch.id, connected: new Date().toISOString(), token, dests: [{ id: `yt:${ch.id}`, kind: 'yt', name: ch.snippet?.title ?? ch.id, ref: ch.id }] });
}
async function ytAccess(acc) {
  if (acc.token.access && acc.token.expiry > Date.now() + 60000) return acc.token.access;
  try {
    const t = await gToken({ refresh_token: acc.token.refresh, grant_type: 'refresh_token' });
    acc.token = { ...acc.token, access: t.access_token, expiry: Date.now() + (t.expires_in ?? 3600) * 1000 };
    setAccount(acc);
    return acc.token.access;
  } catch (e) {
    if (['invalid_grant', 'invalid_client'].includes(e.code)) { markBroken(acc.key, 'Kết nối YouTube đã hết hạn hoặc bị thu hồi — vào Thiết lập → Mạng xã hội bấm Kết nối lại.'); throw err('Kết nối YouTube đã hết hạn hoặc bị thu hồi — vào Thiết lập → Mạng xã hội bấm Kết nối lại.'); }
    throw e;
  }
}

// ───────── TikTok: access token 24 giờ, refresh token 365 ngày
async function ttToken(params) {
  const app = load().apps.tiktok;
  const r = await form(`${U.tt}/oauth/token/`, { client_key: app.key, client_secret: app.secret, ...params });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw err(`TikTok: ${j.error_description || j.error || `lỗi ${r.status}`}`, { code: j.error });
  return j;
}
// access token ~2 giờ; mỗi lần làm mới TikTok trả refresh token MỚI (bản cũ hết dùng) → luôn lưu lại
const ttTok = (t) => Object.fromEntries(Object.entries({ access: t.access_token, refresh: t.refresh_token, expiry: Date.now() + (t.expires_in ?? 7200) * 1000, refreshExpiry: t.refresh_expires_in ? Date.now() + t.refresh_expires_in * 1000 : undefined, openId: t.open_id, scope: t.scope }).filter(([, v]) => v != null));
async function connectTiktok(code, redirect, verifier) {
  const token = ttTok(await ttToken({ code, grant_type: 'authorization_code', redirect_uri: redirect, code_verifier: verifier }));
  if (token.scope && !String(token.scope).split(',').includes('video.publish') && !String(token.scope).split(',').includes('video.upload')) throw err('Chưa cấp quyền đăng video — kết nối lại và cho phép.');
  const name = (await ttName(token.access)) ?? token.openId;
  setAccount({ key: `tt:${token.openId}`, platform: 'tiktok', name, connected: new Date().toISOString(), token, dests: [{ id: `tt:${token.openId}`, kind: 'tt', name, ref: token.openId }] });
}
// Tên hiển thị của tài khoản TikTok. `username` của /user/info cần quyền user.info.profile (xưởng không xin) → hỏi thì cả
// yêu cầu bị từ chối, tên rơi về open_id (chuỗi mã khó đọc — người dùng báo 27/11/2026). Lấy từ creator_info (quyền video.publish),
// rồi tới display_name (user.info.basic).
async function ttName(access) {
  try {
    const d = (await ttApi('POST', '/post/publish/creator_info/query/', {}, access)).data ?? {};
    if (d.creator_username) return `@${d.creator_username}`;
    if (d.creator_nickname) return d.creator_nickname;
  } catch { /* thiếu video.publish (chỉ gửi hộp thư) → thử cách sau */ }
  try {
    const u = (await ttApi('GET', '/user/info/?fields=open_id,display_name', null, access)).data?.user ?? {};
    return u.display_name || null;
  } catch { return null; }
}
async function ttAccess(acc) {
  if (acc.token.access && acc.token.expiry > Date.now() + 60000) return acc.token.access;
  try {
    acc.token = { ...acc.token, ...ttTok(await ttToken({ grant_type: 'refresh_token', refresh_token: acc.token.refresh })) };
    setAccount(acc);
    return acc.token.access;
  } catch (e) {
    markBroken(acc.key, 'Kết nối TikTok đã hết hạn — vào Thiết lập → Mạng xã hội bấm Kết nối lại.');
    throw err(`Kết nối TikTok đã hết hạn — kết nối lại. (${e.message})`);
  }
}
async function ttApi(method, p, body, access) {
  const r = await fetch(`${U.tt}${p}`, { method, headers: { authorization: `Bearer ${access}`, ...(body ? { 'content-type': 'application/json; charset=UTF-8' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j.error?.code && j.error.code !== 'ok')) throw err(`TikTok: ${ttMsg(j.error) || `lỗi ${r.status}`}`, { code: j.error?.code });
  return j;
}
const TT_MSG = {
  spam_risk_too_many_posts: 'tài khoản đã đăng quá nhiều bài hôm nay — thử lại sau.',
  spam_risk_user_banned_from_posting: 'tài khoản đang bị TikTok chặn đăng bài.',
  reached_active_user_cap: 'ứng dụng đã đạt giới hạn số người đăng trong ngày.',
  unaudited_client_can_only_post_to_private_accounts: 'ứng dụng TikTok chưa được TikTok duyệt (audit) nên chỉ đăng được khi tài khoản để chế độ riêng tư — chọn "Chỉ mình tôi" hoặc dùng cách "Gửi vào hộp thư TikTok".',
  privacy_level_option_mismatch: 'chế độ hiển thị không nằm trong các lựa chọn TikTok cho phép với tài khoản này.',
  access_token_invalid: 'kết nối đã hết hạn — kết nối lại.',
  scope_not_authorized: 'chưa cấp quyền đăng video — kết nối lại và cho phép.',
};
const ttMsg = (e) => (e?.code ? TT_MSG[e.code] ?? `${e.message || e.code}` : '');

// thông tin người đăng TikTok (bắt buộc hiện trước khi đăng theo quy định của TikTok): tên, các chế độ hiển thị được chọn, thời lượng tối đa
export async function tiktokCreator(destId) {
  const acc = accountOf(destId);
  if (acc?.platform !== 'tiktok') throw err('Không phải kênh TikTok.');
  const j = await ttApi('POST', '/post/publish/creator_info/query/', {}, await ttAccess(acc));
  const d = j.data ?? {};
  // tài khoản nối trước bản sửa tên (tên còn là open_id) → cập nhật tên khi mở hộp đăng
  const nm = d.creator_username ? `@${d.creator_username}` : d.creator_nickname;
  if (nm && acc.name === acc.token.openId) { acc.name = nm; for (const x of acc.dests ?? []) x.name = nm; setAccount(acc); }
  return { nickname: d.creator_nickname, username: d.creator_username, avatar: d.creator_avatar_url, privacy: d.privacy_level_options ?? [], commentDisabled: !!d.comment_disabled, duetDisabled: !!d.duet_disabled, stitchDisabled: !!d.stitch_disabled, maxSeconds: d.max_video_post_duration_sec ?? null };
}

function accountOf(destId) {
  const c = load();
  return c.accounts.find((a) => a.dests.some((d) => d.id === destId)) ?? null;
}
function markBroken(key, msg) {
  const c = load(), a = c.accounts.find((x) => x.key === key);
  if (a) { a.broken = msg; save(c); }
}
// làm mới danh sách Trang / Instagram của tài khoản Meta (thêm Trang mới, đổi tên…)
export async function refreshAccount(key) {
  const c = load(), a = c.accounts.find((x) => x.key === key);
  if (!a) throw err('Không có tài khoản này.');
  if (a.platform === 'tiktok') {
    const nm = await ttName(await ttAccess(a));
    if (nm) { a.name = nm; for (const x of a.dests ?? []) x.name = nm; setAccount(a); }
    return;
  }
  if (a.platform !== 'meta') return;
  a.dests = await metaDests(a.token);
  delete a.broken;
  save(c);
}

// ───────── tải lên + đăng (mỗi nền tảng một hàm; log(s) để ghi tiến độ, trả { url, remoteId, note })
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const waitUntil = async (fn, { every = 5000, max = 15 * 60000, what }) => {
  for (const end = Date.now() + max; Date.now() < end; await sleep(every)) { const v = await fn(); if (v) return v; }
  throw err(`${what}: chờ quá lâu, nền tảng chưa xử lý xong video — xem lại trên ứng dụng.`);
};

async function postFacebook(d, file, p, log) {
  const size = fs.statSync(file).size;
  const start = await graph('POST', `/${d.ref}/video_reels`, { upload_phase: 'start' }, d.token);
  log('Facebook: tải video lên…');
  const up = await fetch(start.upload_url ?? `${U.rupload}/video-upload/${GV}/${start.video_id}`, { method: 'POST', headers: { authorization: `OAuth ${d.token}`, offset: '0', file_size: String(size), 'content-type': 'application/octet-stream' }, body: await fs.openAsBlob(file) });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || uj.success === false) throw err(`Facebook: tải video lỗi (${uj.debug_info?.message ?? uj.error?.message ?? up.status})`);
  await graph('POST', `/${d.ref}/video_reels`, { upload_phase: 'finish', video_id: start.video_id, video_state: 'PUBLISHED', description: p.caption }, d.token);
  log('Facebook: đã gửi, chờ Facebook xử lý…');
  const st = await waitUntil(async () => {
    const s = await graph('GET', `/${start.video_id}`, { fields: 'status,permalink_url' }, d.token);
    const vs = s.status?.video_status, ph = s.status?.publishing_phase?.status;
    if (vs === 'error' || ph === 'error' || s.status?.processing_phase?.status === 'error') throw err(`Facebook: xử lý video lỗi${s.status?.processing_phase?.errors?.[0]?.message ? ` — ${s.status.processing_phase.errors[0].message}` : ''}.`);
    return vs === 'ready' || ph === 'complete' || vs === 'published' ? s : null;
  }, { what: 'Facebook', max: 10 * 60000 });
  return { remoteId: start.video_id, url: st.permalink_url ? (st.permalink_url.startsWith('http') ? st.permalink_url : `https://www.facebook.com${st.permalink_url}`) : `https://www.facebook.com/reel/${start.video_id}` };
}

async function postInstagram(d, file, p, log) {
  const size = fs.statSync(file).size;
  const c = await graph('POST', `/${d.ref}/media`, { media_type: 'REELS', upload_type: 'resumable', caption: p.caption, share_to_feed: 'true' }, d.token);
  log('Instagram: tải video lên…');
  const up = await fetch(c.uri ?? `${U.rupload}/ig-api-upload/${GV}/${c.id}`, { method: 'POST', headers: { authorization: `OAuth ${d.token}`, offset: '0', file_size: String(size), 'content-type': 'application/octet-stream' }, body: await fs.openAsBlob(file) });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || uj.success === false) throw err(`Instagram: tải video lỗi (${uj.debug_info?.message ?? uj.error?.message ?? up.status})`);
  log('Instagram: chờ Instagram xử lý video…');
  await waitUntil(async () => {
    const s = await graph('GET', `/${c.id}`, { fields: 'status_code,status' }, d.token);
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw err(`Instagram: xử lý video lỗi (${s.status ?? s.status_code}).`);
    return s.status_code === 'FINISHED' || s.status_code === 'PUBLISHED';
  }, { what: 'Instagram', every: 10000 });
  const pub = await graph('POST', `/${d.ref}/media_publish`, { creation_id: c.id }, d.token);
  let url = null;
  try { url = (await graph('GET', `/${pub.id}`, { fields: 'permalink' }, d.token)).permalink ?? null; } catch {}
  return { remoteId: pub.id, url };
}

const CHUNK = 8 * 1024 * 1024;
async function postYoutube(acc, d, file, p, log) {
  const size = fs.statSync(file).size;
  const meta = { snippet: { title: p.title, description: p.caption, categoryId: '22' }, status: { privacyStatus: p.privacy || 'public', selfDeclaredMadeForKids: false }, paidProductPlacementDetails: { hasPaidProductPlacement: false } };
  const init = await fetch(`${U.ytUpload}/videos?uploadType=resumable&part=snippet,status,paidProductPlacementDetails`, { method: 'POST', headers: { authorization: `Bearer ${await ytAccess(acc)}`, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'video/mp4', 'x-upload-content-length': String(size) }, body: JSON.stringify(meta) });
  if (!init.ok) await asJson(init, 'YouTube');
  const session = init.headers.get('location');
  if (!session) throw err('YouTube không trả địa chỉ phiên tải lên.');
  const fd = fs.openSync(file, 'r');
  try {
    let at = 0, last = -1;
    while (true) {
      const n = Math.min(CHUNK, size - at), buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, at);
      const r = await fetch(session, { method: 'PUT', headers: { authorization: `Bearer ${await ytAccess(acc)}`, 'content-range': `bytes ${at}-${at + n - 1}/${size}` }, body: buf });
      if (r.status === 308) { const range = r.headers.get('range'); at = range ? +range.split('-')[1] + 1 : at; const pc = Math.floor((100 * at) / size); if (pc >= last + 25) { last = pc; log(`YouTube: tải lên ${pc}%`); } continue; }
      const v = await asJson(r, 'YouTube');
      const forced = v.status?.privacyStatus === 'private' && (p.privacy || 'public') !== 'private';
      return { remoteId: v.id, url: `https://youtube.com/shorts/${v.id}`, note: forced ? 'YouTube để video ở chế độ Riêng tư (theo thiết lập của kênh) — mở YouTube Studio để chuyển sang Công khai.' : '' };
    }
  } finally { fs.closeSync(fd); }
}

async function postTiktok(acc, d, file, p, log) {
  const size = fs.statSync(file).size;
  // một khúc nếu ≤ 64 MB; lớn hơn thì khúc 32 MB, khúc cuối gánh phần dư (≤ 128 MB)
  const ONE = 64 * 1024 * 1024, CH = 32 * 1024 * 1024;
  const chunk = size <= ONE ? size : CH, count = size <= ONE ? 1 : Math.floor(size / CH);
  const inbox = p.tiktok?.mode === 'inbox';
  const source_info = { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunk, total_chunk_count: count };
  const body = inbox ? { source_info } : { post_info: { title: p.caption, privacy_level: p.tiktok.privacy, disable_comment: !p.tiktok.comment, disable_duet: !p.tiktok.duet, disable_stitch: !p.tiktok.stitch, brand_content_toggle: false, brand_organic_toggle: !!p.tiktok.brand, is_aigc: false }, source_info };
  const j = await ttApi('POST', inbox ? '/post/publish/inbox/video/init/' : '/post/publish/video/init/', body, await ttAccess(acc));
  const { publish_id: pid, upload_url: url } = j.data ?? {};
  if (!pid || !url) throw err('TikTok không trả địa chỉ tải lên.');
  const fd = fs.openSync(file, 'r');
  try {
    for (let i = 0; i < count; i++) {
      const a = i * chunk, b = i === count - 1 ? size - 1 : a + chunk - 1, buf = Buffer.alloc(b - a + 1);
      fs.readSync(fd, buf, 0, buf.length, a);
      const r = await fetch(url, { method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-range': `bytes ${a}-${b}/${size}` }, body: buf });
      if (!r.ok) throw err(`TikTok: tải video lỗi (${r.status}).`);
      if (count > 1) log(`TikTok: tải lên ${Math.round((100 * (b + 1)) / size)}%`);
    }
  } finally { fs.closeSync(fd); }
  log(inbox ? 'TikTok: chờ video vào hộp thư…' : 'TikTok: chờ TikTok xử lý…');
  const done = await waitUntil(async () => {
    const s = (await ttApi('POST', '/post/publish/status/fetch/', { publish_id: pid }, await ttAccess(acc))).data ?? {};
    if (s.status === 'FAILED') throw err(`TikTok: đăng lỗi (${TT_MSG[s.fail_reason] ?? s.fail_reason ?? 'không rõ'}).`);
    if (s.status === 'SEND_TO_USER_INBOX' || s.status === 'PUBLISH_COMPLETE') return s;
    return null;
  }, { what: 'TikTok', every: 5000 });
  const postId = done.publicaly_available_post_id?.[0] ?? done.publicly_available_post_id?.[0];
  const user = acc.name?.startsWith('@') ? acc.name : null;
  return {
    remoteId: postId ? String(postId) : pid,
    url: postId && user ? `https://www.tiktok.com/${user}/video/${postId}` : null,
    note: inbox ? 'Video đã vào hộp thư TikTok — mở ứng dụng TikTok (thông báo) để chỉnh và bấm Đăng.' : done.status === 'PUBLISH_COMPLETE' && !postId && p.tiktok.privacy === 'SELF_ONLY' ? 'Đã đăng ở chế độ "Chỉ mình tôi".' : '',
  };
}

// ───────── lịch đăng + lịch sử
// trạng thái: queued (chờ lượt — đăng ngay) · scheduled (hẹn giờ) · posting · done · error · canceled · missed (máy tắt quá giờ hẹn)
const MISS_AFTER = 6 * 3600 * 1000; // quá giờ hẹn hơn 6 tiếng (máy tắt / ngủ) → không tự đăng nữa, chờ người dùng bấm
const loadPosts = () => readFile(POSTS, { posts: [] });
const savePosts = (s) => { s.posts = s.posts.slice(-2000); writeFile(POSTS, s); };
const ctx = { seriesDir: null, notify: () => {}, timer: null, running: false, log: new Map() };
export function init({ seriesDir, notify }) {
  ctx.seriesDir = seriesDir; ctx.notify = notify ?? (() => {});
  const s = loadPosts();
  let ch = false;
  for (const p of s.posts) if (p.status === 'posting') { Object.assign(p, { status: 'error', error: 'Máy chủ tắt giữa lúc đăng — mở ứng dụng kiểm tra xem bài đã lên chưa rồi hãy bấm Đăng lại.', ended: Date.now() }); ch = true; }
  if (ch) savePosts(s);
  clearInterval(ctx.timer);
  ctx.timer = setInterval(tick, MOCK ? 1000 : 20000);
  ctx.timer.unref?.();
  setTimeout(tick, 1500).unref?.();
}
const view = (p) => ({ ...p, progress: ctx.log.get(p.id) ?? null });
export const listPosts = ({ slug, episode } = {}) => loadPosts().posts.filter((p) => (!slug || p.slug === slug) && (!episode || p.episode === episode)).map(view);
export const pendingCount = () => loadPosts().posts.filter((p) => ['queued', 'scheduled', 'posting'].includes(p.status)).length;

const epId = (n) => `ep${String(n).padStart(2, '0')}`;
const mp4Of = (slug, n) => path.join(ctx.seriesDir(slug), 'episodes', epId(n), 'out', `${epId(n)}.mp4`);

// kiểm tra + chuẩn hoá yêu cầu đăng của một kênh
function cleanReq(kind, r, epTitle) {
  const caption = String(r.caption ?? '').replace(/\r\n/g, '\n').trim();
  const lim = KINDS[kind].limit;
  if (!caption && kind !== 'yt') throw err(`${KINDS[kind].label}: chưa có nội dung đăng (caption).`);
  if ([...caption].length > lim) throw err(`${KINDS[kind].label}: nội dung dài ${[...caption].length} ký tự, tối đa ${lim}.`);
  const out = { caption };
  if (kind === 'yt') {
    const title = String(r.title ?? epTitle ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
    if (!title) throw err('YouTube: cần tiêu đề.');
    if ([...title].length > 100) throw err('YouTube: tiêu đề tối đa 100 ký tự.');
    if (/[<>]/.test(caption)) throw err('YouTube: mô tả không được có dấu < hoặc >.');
    if (Buffer.byteLength(caption) > 5000) throw err('YouTube: mô tả quá 5000 byte.');
    out.title = title;
    out.privacy = ['public', 'unlisted', 'private'].includes(r.privacy) ? r.privacy : 'public';
  }
  if (kind === 'tt') {
    const t = r.tiktok ?? {};
    if (t.mode === 'inbox') out.tiktok = { mode: 'inbox' };
    else {
      if (!['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'].includes(t.privacy)) throw err('TikTok: hãy chọn ai được xem video.');
      out.tiktok = { mode: 'direct', privacy: t.privacy, comment: !!t.comment, duet: !!t.duet, stitch: !!t.stitch, brand: !!t.brand };
    }
  }
  return out;
}

// tạo bài đăng: { slug, episode, items: [{ dest, caption, title?, privacy?, tiktok? }], at: ms | null }
export function createPosts({ slug, episode, items, at, epTitle, seconds }) {
  if (!Array.isArray(items) || !items.length) throw err('Chưa chọn kênh nào để đăng.');
  if (!fs.existsSync(mp4Of(slug, episode))) throw err('Tập này chưa có phim (MP4) — dựng phim trước.');
  const all = dests();
  let when = null;
  if (at != null && at !== '') {
    when = +at;
    if (!Number.isFinite(when)) throw err('Giờ hẹn không hợp lệ.');
    if (when < Date.now() + 60000) throw err('Giờ hẹn phải sau bây giờ ít nhất 1 phút.');
    if (when > Date.now() + 180 * 86400000) throw err('Chỉ hẹn trong vòng 6 tháng.');
  }
  const s = loadPosts();
  const made = items.map((it) => {
    const d = all.find((x) => x.id === it.dest);
    if (!d) throw err('Kênh không còn kết nối — tải lại trang.');
    const dup = s.posts.find((p) => p.slug === slug && p.episode === episode && p.dest === d.id && ['queued', 'scheduled', 'posting'].includes(p.status));
    if (dup) throw err(`${KINDS[d.kind].label} "${d.name}" đã có bài chờ đăng cho tập này — sửa hoặc huỷ bài đó trước.`);
    if (seconds && KINDS[d.kind].maxSec && seconds > KINDS[d.kind].maxSec) throw err(`${KINDS[d.kind].label} chỉ nhận video tối đa ${KINDS[d.kind].maxSec} giây — phim này dài ${Math.round(seconds)} giây.`);
    return { id: b64url(crypto.randomBytes(9)), slug, episode, dest: d.id, kind: d.kind, destName: d.name, ...cleanReq(d.kind, it, epTitle), at: when, status: when ? 'scheduled' : 'queued', created: Date.now(), started: 0, ended: 0, error: '', url: null, remoteId: null, note: '' };
  });
  s.posts.push(...made);
  savePosts(s);
  setImmediate(tick);
  return made.map(view);
}
// sửa bài đang hẹn / lỗi / lỡ hẹn: caption, tiêu đề, giờ (at = null → đăng ngay)
export function updatePost(id, patch) {
  const s = loadPosts(), p = s.posts.find((x) => x.id === id);
  if (!p) throw err('Không có bài này.', { status: 404 });
  if (!['scheduled', 'queued', 'error', 'missed', 'canceled'].includes(p.status)) throw err(p.status === 'posting' ? 'Bài đang được đăng — không sửa được nữa.' : 'Bài đã đăng — sửa trực tiếp trên mạng xã hội.');
  const merged = cleanReq(p.kind, { caption: patch.caption ?? p.caption, title: patch.title ?? p.title, privacy: patch.privacy ?? p.privacy, tiktok: patch.tiktok ?? p.tiktok }, p.title);
  Object.assign(p, merged);
  if ('at' in patch) {
    const when = patch.at == null || patch.at === '' ? null : +patch.at;
    if (when != null && (!Number.isFinite(when) || when < Date.now() + 60000)) throw err('Giờ hẹn phải sau bây giờ ít nhất 1 phút.');
    p.at = when; p.status = when ? 'scheduled' : 'queued'; p.error = ''; p.note = '';
  }
  savePosts(s);
  setImmediate(tick);
  return view(p);
}
export function cancelPost(id) {
  const s = loadPosts(), i = s.posts.findIndex((x) => x.id === id);
  if (i < 0) throw err('Không có bài này.', { status: 404 });
  const p = s.posts[i];
  if (p.status === 'posting') throw err('Bài đang được đăng — không huỷ được nữa.');
  if (['queued', 'scheduled'].includes(p.status)) p.status = 'canceled';
  else s.posts.splice(i, 1); // đã đăng / lỗi / đã huỷ → xoá khỏi danh sách (không gỡ bài trên mạng xã hội)
  savePosts(s);
  return { ok: true };
}

const setPost = (id, patch) => { const s = loadPosts(), p = s.posts.find((x) => x.id === id); if (p) { Object.assign(p, patch); savePosts(s); } return p; };
async function tick() {
  if (ctx.running) return;
  const s = loadPosts(), now = Date.now();
  let ch = false;
  for (const p of s.posts) if (p.status === 'scheduled' && p.at && now - p.at > MISS_AFTER) { p.status = 'missed'; p.error = `Lỡ giờ hẹn (${new Date(p.at).toLocaleString('vi-VN')}) vì máy tắt hoặc ngủ — bấm "Đăng ngay" hoặc hẹn giờ khác.`; ch = true; ctx.notify({ type: 'missed', post: p }); }
  if (ch) savePosts(s);
  const next = s.posts.filter((p) => p.status === 'queued' || (p.status === 'scheduled' && p.at <= now)).sort((a, b) => (a.at ?? a.created) - (b.at ?? b.created))[0];
  if (!next) return;
  ctx.running = true;
  try { await runPost(next.id); } finally { ctx.running = false; setImmediate(tick); }
}
async function runPost(id) {
  const p = setPost(id, { status: 'posting', started: Date.now(), error: '', note: '' });
  const log = (t) => ctx.log.set(id, t);
  log('Bắt đầu…');
  try {
    const file = mp4Of(p.slug, p.episode);
    if (!fs.existsSync(file)) throw err('Tập này không còn file phim (MP4).');
    const acc = accountOf(p.dest), d = acc?.dests.find((x) => x.id === p.dest);
    if (!acc || !d) throw err('Kênh không còn kết nối — vào Thiết lập → Mạng xã hội để kết nối lại.');
    if (acc.broken) throw err(acc.broken);
    const r = p.kind === 'fb' ? await postFacebook(d, file, p, log)
      : p.kind === 'ig' ? await postInstagram(d, file, p, log)
        : p.kind === 'yt' ? await postYoutube(acc, d, file, p, log)
          : await postTiktok(acc, d, file, p, log);
    const st = fs.statSync(file);
    const done = setPost(id, { status: 'done', ended: Date.now(), url: r.url, remoteId: r.remoteId, note: r.note ?? '', video: { mtime: st.mtimeMs, size: st.size } });
    ctx.notify({ type: 'done', post: done });
  } catch (e) {
    if (e.code === 190 || e.code === 'access_token_invalid') { const acc = accountOf(p.dest); if (acc) markBroken(acc.key, 'Kết nối đã hết hạn hoặc bị thu hồi — vào Thiết lập → Mạng xã hội bấm Kết nối lại.'); }
    const bad = setPost(id, { status: 'error', ended: Date.now(), error: e.message || String(e) });
    ctx.notify({ type: 'error', post: bad });
  } finally { ctx.log.delete(id); }
}
