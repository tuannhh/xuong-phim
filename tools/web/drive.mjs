// Kết nối Google Drive cho trang web của xưởng: OAuth "ứng dụng máy tính" (loopback + PKCE) và tải phim lên Drive.
// - Quyền xin: drive.file — chỉ thấy/sửa file do xưởng tạo. Muốn lấy tư liệu từ Drive thì người dùng bấm cấp thêm
//   drive.readonly (chỉ đọc). Không có quyền đọc vẫn tải được link đã chia sẻ "bất kỳ ai có đường liên kết".
// - OAuth client (client id/secret do người dùng tạo trong Google Cloud) + token lưu NGOÀI repo:
//   ~/.config/xuong-phim/google.json (quyền 600). Không bao giờ trả client secret/token về trình duyệt.
// - Không thư viện ngoài: dùng fetch của Node.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BASE = process.env.STUDIO_GOOGLE_BASE; // chỉ dùng khi kiểm thử với máy chủ giả lập
const URLS = BASE
  ? { auth: `${BASE}/o/oauth2/v2/auth`, token: `${BASE}/token`, revoke: `${BASE}/revoke`, api: BASE, upload: `${BASE}/upload` }
  : { auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', revoke: 'https://oauth2.googleapis.com/revoke', api: 'https://www.googleapis.com', upload: 'https://www.googleapis.com/upload' };
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const SCOPE_READ = 'https://www.googleapis.com/auth/drive.readonly';
const FOLDER = 'application/vnd.google-apps.folder';
export const ROOT_FOLDER = 'Xưởng phim';
const CHUNK = 8 * 1024 * 1024; // bội số của 256 KiB theo yêu cầu của resumable upload

export class DriveError extends Error {}

// ───────── lưu cấu hình (ngoài repo)
const CONF_DIR = process.env.XUONG_CONFIG_DIR || path.join(os.homedir(), '.config', 'xuong-phim');
const CONF = path.join(CONF_DIR, 'google.json');
const load = () => { try { return JSON.parse(fs.readFileSync(CONF, 'utf8')); } catch { return {}; } };
const save = (c) => {
  fs.mkdirSync(CONF_DIR, { recursive: true, mode: 0o700 });
  const tmp = `${CONF}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(c, null, 1), { mode: 0o600 });
  fs.renameSync(tmp, CONF);
};

// OAuth client Google (Desktop app) — dùng chung cho kết nối YouTube (social.mjs)
export const googleClient = () => load().client ?? null;

export const status = () => {
  const c = load();
  return { configured: !!c.client?.id, connected: !!c.token?.refresh_token, canRead: !!c.token?.refresh_token && (c.token.scope ?? '').split(' ').includes(SCOPE_READ), account: c.account ?? null, root: ROOT_FOLDER };
};

// Nhận client id/secret: dán nguyên file JSON tải từ Google Cloud, hoặc nhập 2 ô.
export function saveClient(input) {
  let id = String(input.clientId ?? '').trim(), secret = String(input.clientSecret ?? '').trim();
  if (input.json) {
    let j;
    try { j = JSON.parse(input.json); } catch { throw new DriveError('Nội dung không phải JSON hợp lệ — dán nguyên file client_secret_….json tải từ Google Cloud.'); }
    const k = j.installed ?? j.web ?? j;
    id = String(k.client_id ?? '').trim(); secret = String(k.client_secret ?? '').trim();
    if (j.web && !j.installed) throw new DriveError('Đây là client kiểu "Web application". Hãy tạo client kiểu "Desktop app" rồi dán file JSON của nó.');
  }
  if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(id) && !BASE) throw new DriveError('Client ID không đúng dạng …apps.googleusercontent.com');
  if (!secret || secret.length > 200) throw new DriveError('Thiếu client secret.');
  const c = load();
  const changed = c.client?.id !== id;
  save({ ...c, client: { id, secret }, ...(changed ? { token: undefined, account: undefined } : {}) });
}

// ───────── OAuth loopback + PKCE
const pending = new Map(); // state → { verifier, redirect, back, at }
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function authUrl(port, back = '#/drive', { read = false } = {}) {
  const c = load();
  if (!c.client?.id) throw new DriveError('Chưa có OAuth client — dán client ở trang Google Drive trước.');
  for (const [k, v] of pending) if (Date.now() - v.at > 600000) pending.delete(k);
  const state = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(48));
  const redirect = `http://127.0.0.1:${port}/api/drive/callback`;
  pending.set(state, { verifier, redirect, read, back: /^#\/[\w/?=&.-]*$/.test(back) ? back : '#/drive', at: Date.now() });
  const q = new URLSearchParams({
    client_id: c.client.id, redirect_uri: redirect, response_type: 'code', scope: read ? `${SCOPE} ${SCOPE_READ}` : SCOPE, access_type: 'offline', prompt: 'consent',
    include_granted_scopes: 'true', state, code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256',
  });
  return `${URLS.auth}?${q}`;
}

const tokenRequest = async (params) => {
  const r = await fetch(URLS.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new DriveError(j.error_description || j.error || `Google trả lỗi ${r.status}`); e.code = j.error; throw e; }
  return j;
};

// Google chuyển về /api/drive/callback?code&state → đổi code lấy token. Trả về hash để chuyển trình duyệt về.
export async function handleCallback(query) {
  const p = pending.get(query.get('state') ?? '');
  if (!p) throw new DriveError('Phiên kết nối không hợp lệ hoặc đã hết hạn — bấm Kết nối lại.');
  pending.delete(query.get('state'));
  if (query.get('error')) throw Object.assign(new DriveError(query.get('error') === 'access_denied' ? 'Bạn đã từ chối cấp quyền.' : `Google báo: ${query.get('error')}`), { back: p.back });
  const c = load();
  const t = await tokenRequest({ code: query.get('code') ?? '', client_id: c.client.id, client_secret: c.client.secret, redirect_uri: p.redirect, grant_type: 'authorization_code', code_verifier: p.verifier });
  if (!t.refresh_token) throw Object.assign(new DriveError('Google không trả refresh token — vào myaccount.google.com/permissions gỡ quyền của ứng dụng rồi kết nối lại.'), { back: p.back });
  if (t.scope && !t.scope.split(' ').includes(SCOPE)) throw Object.assign(new DriveError('Chưa tích quyền Google Drive trên màn hình đồng ý — kết nối lại và tích ô quyền Drive.'), { back: p.back });
  save({ ...c, token: { access_token: t.access_token, refresh_token: t.refresh_token, scope: t.scope ?? (p.read ? `${SCOPE} ${SCOPE_READ}` : SCOPE), expiry: Date.now() + (t.expires_in ?? 3600) * 1000 } });
  if (p.read && t.scope && !t.scope.split(' ').includes(SCOPE_READ)) throw Object.assign(new DriveError('Đã kết nối nhưng chưa tích quyền "xem file trên Google Drive" — xưởng chưa đọc được tư liệu trong Drive. Bấm lại nút và tích ô đó.'), { back: p.back });
  try {
    const about = await api('GET', '/drive/v3/about', { query: { fields: 'user(emailAddress,displayName)' } });
    save({ ...load(), account: about.user?.emailAddress ?? about.user?.displayName ?? null });
  } catch { /* chỉ để hiển thị tên tài khoản */ }
  return p.back;
}

export async function disconnect() {
  const c = load();
  if (c.token?.refresh_token) await fetch(`${URLS.revoke}?token=${encodeURIComponent(c.token.refresh_token)}`, { method: 'POST' }).catch(() => {});
  save({ ...c, token: undefined, account: undefined });
}
export const forgetClient = () => { const c = load(); save({ ...c, client: undefined, token: undefined, account: undefined }); };

async function accessToken() {
  const c = load();
  if (!c.token?.refresh_token) throw new DriveError('Chưa kết nối Google Drive.');
  if (c.token.access_token && c.token.expiry > Date.now() + 60000) return c.token.access_token;
  try {
    const t = await tokenRequest({ client_id: c.client.id, client_secret: c.client.secret, refresh_token: c.token.refresh_token, grant_type: 'refresh_token' });
    save({ ...c, token: { ...c.token, access_token: t.access_token, expiry: Date.now() + (t.expires_in ?? 3600) * 1000 } });
    return t.access_token;
  } catch (e) {
    if (e.code === 'invalid_grant' || e.code === 'invalid_client') { save({ ...load(), token: undefined }); throw new DriveError('Kết nối Google Drive đã hết hạn hoặc bị thu hồi — vào trang Google Drive bấm Kết nối lại.'); }
    throw e;
  }
}

async function api(method, p, { query, json, base = URLS.api, headers = {}, body, signal, raw } = {}) {
  const url = `${base}${p}${query ? `?${new URLSearchParams(query)}` : ''}`;
  const r = await fetch(url, { method, signal, headers: { authorization: `Bearer ${await accessToken()}`, ...(json ? { 'content-type': 'application/json; charset=UTF-8' } : {}), ...headers }, body: json ? JSON.stringify(json) : body });
  if (raw) return r;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new DriveError(j.error?.message || `Google Drive trả lỗi ${r.status}`); e.status = r.status; throw e; }
  return j;
}

// ───────── thư mục + tải file
const q = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
async function ensureFolder(name, parent) {
  const found = await api('GET', '/drive/v3/files', { query: { q: `mimeType='${FOLDER}' and name='${q(name)}' and '${q(parent)}' in parents and trashed=false`, fields: 'files(id,name)', pageSize: '1', spaces: 'drive' } });
  if (found.files?.length) return found.files[0].id;
  return (await api('POST', '/drive/v3/files', { query: { fields: 'id' }, json: { name, mimeType: FOLDER, parents: [parent] } })).id;
}
const alive = async (id) => { try { const f = await api('GET', `/drive/v3/files/${id}`, { query: { fields: 'id,trashed' } }); return !f.trashed; } catch (e) { if (e.status === 404) return false; throw e; } };

// Thư mục "Xưởng phim/<tên>" của một series; nhớ id ở series/<slug>/.studio/drive.json (gitignore — gắn với tài khoản trên máy này).
export async function seriesFolder(seriesDir, name) {
  const f = path.join(seriesDir, '.studio', 'drive.json');
  const st = status();
  let m = {};
  try { m = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  if (m.folderId && m.account === st.account && m.folderName === name && (await alive(m.folderId))) return m.folderId;
  const root = await ensureFolder(ROOT_FOLDER, 'root');
  const folderId = await ensureFolder(name, root);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ account: st.account, folderName: name, folderId }, null, 1));
  return folderId;
}

// Resumable upload (theo khúc 8 MiB, báo tiến độ). Có fileId → ghi đè nội dung file cũ (giữ nguyên link chia sẻ).
export async function uploadFile(local, { name, parent, fileId, mime = 'application/octet-stream', onProgress, signal }) {
  const size = fs.statSync(local).size;
  const init = async (id) => api(id ? 'PATCH' : 'POST', id ? `/drive/v3/files/${id}` : '/drive/v3/files', {
    base: URLS.upload, raw: true, signal, query: { uploadType: 'resumable', fields: 'id,name,webViewLink' },
    headers: { 'x-upload-content-type': mime, 'x-upload-content-length': String(size) }, json: id ? { name } : { name, parents: [parent] },
  });
  let r = await init(fileId);
  if (fileId && r.status === 404) r = await init(null); // file cũ đã bị xoá trên Drive → tạo mới
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new DriveError(j.error?.message || `Không mở được phiên tải lên (${r.status})`); }
  const session = r.headers.get('location');
  if (!session) throw new DriveError('Google không trả địa chỉ phiên tải lên.');
  const fd = fs.openSync(local, 'r');
  try {
    let at = 0;
    while (true) {
      const n = Math.min(CHUNK, size - at);
      const buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, at);
      const res = await fetch(session, { method: 'PUT', signal, headers: { authorization: `Bearer ${await accessToken()}`, 'content-range': size ? `bytes ${at}-${at + n - 1}/${size}` : 'bytes */0' }, body: buf });
      if (res.status === 308) {
        const range = res.headers.get('range'); // "bytes=0-8388607"
        at = range ? +range.split('-')[1] + 1 : at;
        onProgress?.(at, size);
        continue;
      }
      if (res.ok) { onProgress?.(size, size); return await res.json(); }
      const j = await res.json().catch(() => ({}));
      throw new DriveError(j.error?.message || `Tải lên lỗi (${res.status})`);
    }
  } finally { fs.closeSync(fd); }
}

// Đẩy MP4 (+ SRT) của một tập lên Drive; ghi kết quả vào out/drive.json để trang biết link và bản đã đẩy.
const safe = (s) => String(s).replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
export async function uploadEpisode({ seriesDir, epDir, id, title, folderName, log, signal }) {
  const out = path.join(epDir, 'out');
  const mp4 = path.join(out, `${id}.mp4`), srt = path.join(out, `${id}.srt`), rec = path.join(out, 'drive.json');
  if (!fs.existsSync(mp4)) throw new DriveError('Tập này chưa có MP4 — dựng phim trước.');
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(rec, 'utf8')); } catch {}
  const st = status();
  const same = prev.account === st.account; // đổi tài khoản → tạo file mới ở Drive mới
  log(`Google Drive: ${st.account ?? 'đã kết nối'} → ${ROOT_FOLDER}/${folderName}`);
  const parent = await seriesFolder(seriesDir, folderName);
  const base = safe(`${id.toUpperCase()} - ${title || id}`);
  let last = -1;
  const mp4Stat = fs.statSync(mp4);
  const fm = await uploadFile(mp4, { name: `${base}.mp4`, parent, fileId: same ? prev.mp4?.id : null, mime: 'video/mp4', signal,
    onProgress: (a, b) => { const p = Math.floor((100 * a) / Math.max(1, b)); if (p >= last + 10 || p === 100) { last = p; log(`  tải lên ${p}% (${(a / 1e6).toFixed(1)}/${(b / 1e6).toFixed(1)} MB)`); } } });
  const record = { account: st.account, folderId: parent, uploadedAt: new Date().toISOString(), mp4: { id: fm.id, link: fm.webViewLink, mtime: mp4Stat.mtimeMs, size: mp4Stat.size } };
  if (fs.existsSync(srt)) {
    const fs2 = await uploadFile(srt, { name: `${base}.srt`, parent, fileId: same ? prev.srt?.id : null, mime: 'application/x-subrip', signal });
    record.srt = { id: fs2.id, link: fs2.webViewLink };
    log('  phụ đề SRT: xong');
  }
  fs.writeFileSync(rec, JSON.stringify(record, null, 1));
  log(`Link: ${fm.webViewLink ?? '(không có)'}`);
  return record;
}

// Trạng thái Drive của một tập cho trang web
export function episodeDrive(epDir, id) {
  try {
    const r = JSON.parse(fs.readFileSync(path.join(epDir, 'out', 'drive.json'), 'utf8'));
    const mp4 = path.join(epDir, 'out', `${id}.mp4`);
    const m = fs.existsSync(mp4) ? fs.statSync(mp4) : null;
    return { link: r.mp4?.link ?? null, uploadedAt: r.uploadedAt, account: r.account, stale: !!m && (m.mtimeMs !== r.mp4?.mtime || m.size !== r.mp4?.size) };
  } catch { return null; }
}

// ───────── tư liệu từ Drive (đọc)
const EXPORT = {
  'application/vnd.google-apps.document': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  'application/vnd.google-apps.presentation': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pptx'],
  'application/vnd.google-apps.spreadsheet': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'],
};
const READABLE = /\.(pdf|docx?|pptx|xlsx|csv|txt|md|jpe?g|png|webp|gif|bmp)$/i;
const MAX_FILES = 200, MAX_BYTES = 300 * 1024 * 1024;

// Nhận các dạng link: /file/d/<id>, /drive/folders/<id>, open?id=<id>, docs.google.com/<loại>/d/<id>
export function parseLink(link) {
  let u;
  try { u = new URL(String(link).trim()); } catch { return null; }
  if (!/(^|\.)(drive|docs)\.google\.com$/.test(u.hostname)) return null;
  const m = /\/folders\/([\w-]{10,})/.exec(u.pathname);
  if (m) return { id: m[1], folder: true };
  const d = /\/(document|presentation|spreadsheets)\/d\/([\w-]{10,})/.exec(u.pathname);
  if (d) return { id: d[2], folder: false, kind: d[1] };
  const f = /\/file\/d\/([\w-]{10,})/.exec(u.pathname) ?? /^([\w-]{10,})$/.exec(u.searchParams.get('id') ?? '');
  return f ? { id: f[1], folder: false } : null;
}

const toFile = async (res, dest) => {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
  fs.renameSync(tmp, dest);
  return dest;
};
const cacheFile = (dir) => path.join(dir, '.drive-cache.json');
const readCache = (dir) => { try { return JSON.parse(fs.readFileSync(cacheFile(dir), 'utf8')); } catch { return {}; } };

// Có quyền đọc: dùng API (thư mục quét tối đa 3 cấp / 200 file; Google Docs/Slides/Sheets xuất ra docx/pptx/xlsx).
async function fetchByApi(ref, dir, { log, signal }) {
  const cache = readCache(dir);
  const fields = 'id,name,mimeType,modifiedTime,size';
  const all = { supportsAllDrives: 'true' };
  const root = await api('GET', `/drive/v3/files/${ref.id}`, { query: { fields, ...all }, signal });
  const files = [];
  const walk = async (folder, rel, depth) => {
    let pageToken;
    do {
      const r = await api('GET', '/drive/v3/files', { signal, query: { q: `'${q(folder.id)}' in parents and trashed=false`, fields: `nextPageToken,files(${fields})`, pageSize: '200', includeItemsFromAllDrives: 'true', ...all, ...(pageToken ? { pageToken } : {}) } });
      for (const f of r.files ?? []) {
        if (files.length >= MAX_FILES) return;
        if (f.mimeType === FOLDER) { if (depth < 3) await walk(f, path.join(rel, safe(f.name)), depth + 1); }
        else files.push({ ...f, rel });
      }
      pageToken = r.nextPageToken;
    } while (pageToken && files.length < MAX_FILES);
  };
  const base = path.join(dir, safe(root.name) || ref.id);
  if (root.mimeType === FOLDER) { log(`  thư mục Drive "${root.name}"`); await walk(root, '', 1); }
  else files.push({ ...root, rel: '' });
  const out = [];
  for (const f of files) {
    const ex = EXPORT[f.mimeType];
    const name = safe(f.name) + (ex && !f.name.endsWith(ex[1]) ? ex[1] : '');
    if (!ex && (f.mimeType.startsWith('application/vnd.google-apps') || !READABLE.test(name))) { log(`  bỏ qua ${f.name} (loại file chưa đọc được)`); continue; }
    if (+f.size > MAX_BYTES) { log(`  bỏ qua ${f.name} (quá 300 MB)`); continue; }
    const dest = root.mimeType === FOLDER ? path.join(base, f.rel, name) : path.join(dir, name);
    if (cache[f.id]?.modified === f.modifiedTime && fs.existsSync(cache[f.id].path)) { out.push(cache[f.id].path); continue; }
    const r = ex
      ? await api('GET', `/drive/v3/files/${f.id}/export`, { raw: true, signal, query: { mimeType: ex[0] } })
      : await api('GET', `/drive/v3/files/${f.id}`, { raw: true, signal, query: { alt: 'media', ...all } });
    if (!r.ok) { log(`  ! không tải được ${f.name} (${r.status})`); continue; }
    await toFile(r, dest);
    cache[f.id] = { modified: f.modifiedTime, path: dest };
    log(`  tải ${f.rel ? `${f.rel}/` : ''}${name}`);
    out.push(dest);
  }
  fs.writeFileSync(cacheFile(dir), JSON.stringify(cache, null, 1));
  return root.mimeType === FOLDER ? [base] : out;
}

// Không có quyền đọc: chỉ tải được FILE đã chia sẻ công khai (thư mục thì cần quyền đọc).
async function fetchPublic(ref, dir, { signal }) {
  if (ref.folder) throw new DriveError('Thư mục Drive cần quyền đọc — vào trang Thiết lập bấm "Cho phép đọc tư liệu trên Drive".');
  const url = ref.kind === 'document' ? `https://docs.google.com/document/d/${ref.id}/export?format=docx`
    : ref.kind === 'presentation' ? `https://docs.google.com/presentation/d/${ref.id}/export/pptx`
      : ref.kind === 'spreadsheets' ? `https://docs.google.com/spreadsheets/d/${ref.id}/export?format=xlsx`
        : `https://drive.usercontent.google.com/download?id=${ref.id}&export=download&confirm=t`;
  const r = await fetch(url, { signal, redirect: 'follow' });
  const type = r.headers.get('content-type') ?? '';
  if (!r.ok || type.startsWith('text/html')) throw new DriveError('Link chưa chia sẻ công khai, nên xưởng không tải được. Hãy chia sẻ "Bất kỳ ai có đường liên kết", hoặc vào trang Thiết lập bấm "Cho phép đọc tư liệu trên Drive".');
  const cd = r.headers.get('content-disposition') ?? '';
  const m = /filename\*=UTF-8''([^;]+)/i.exec(cd) ?? /filename="?([^";]+)"?/i.exec(cd);
  let name = safe(m ? decodeURIComponent(m[1]) : ref.id);
  if (!READABLE.test(name)) name += ref.kind === 'document' ? '.docx' : ref.kind === 'presentation' ? '.pptx' : ref.kind === 'spreadsheets' ? '.xlsx' : '';
  return [await toFile(r, path.join(dir, name))];
}

// Tải tư liệu từ một link Drive về `dir`; trả danh sách đường dẫn (file hoặc thư mục) để đưa vào bước đọc tư liệu.
export async function fetchMaterial(link, dir, { log = () => {}, signal } = {}) {
  const ref = parseLink(link);
  if (!ref) throw new DriveError(`Không hiểu link Drive: ${link}`);
  fs.mkdirSync(dir, { recursive: true });
  if (status().canRead) {
    try { return await fetchByApi(ref, dir, { log, signal }); }
    catch (e) { if (e.status !== 404 && e.status !== 403) throw e; log(`  ! tài khoản đang kết nối không mở được link này (${e.status}) — thử như link công khai`); }
  }
  return fetchPublic(ref, dir, { signal });
}
