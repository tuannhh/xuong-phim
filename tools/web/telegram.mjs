// Bot Telegram của Xưởng phim: báo lên điện thoại khi xong / lỗi, và làm cả quy trình từ xa:
// tạo series mới (giữ nhân vật của series cũ) → lập kế hoạch → duyệt tập → viết kịch bản → xem storyboard → duyệt dựng phim
// → xem phim / góp ý sửa / chỉ sửa giọng. Máy chủ tự hỏi Telegram có tin mới không (getUpdates, long polling) → không cần
// mở cổng, không cần IP tĩnh, không cài thêm phần mềm.
// Cấu hình lưu theo MÁY ở ~/.config/xuong-phim/telegram.json (ngoài repo, chứa mã bot — không đưa lên GitHub):
//   { token, botName, chatId, chatName, code, series, notify: { done, error, boot }, offset }
// Liên kết: người dùng gửi "/start <mã 6 số>" (mã hiện ở trang Thiết lập) → chat đó thành chủ bot; chat khác bị bỏ qua.
// Lệnh gọi lại chính API của máy chủ (http://127.0.0.1:<cổng>, header x-xuong) → dùng chung mọi kiểm tra / hàng đợi với trang web.
// Nút bấm (callback_data ≤ 64 byte) mang mã ngắn của series (sk = 8 ký tự băm của slug), không mang nguyên slug.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { CONF_DIR } from '../output.mjs';

const FILE = path.join(CONF_DIR, 'telegram.json');
const BASE = process.env.XUONG_TELEGRAM_BASE || 'https://api.telegram.org';
const VIDEO_MAX = 49 * 1024 * 1024; // bot chỉ được gửi file ≤ 50 MB
const TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/;
const NOTIFY_DEFAULT = { done: true, error: true, boot: true };

let ctx = { port: 4710, root: process.cwd() };
let gen = 0; // tăng mỗi lần đổi mã bot / tắt → vòng hỏi tin cũ tự dừng
let polling = false, lastError = '', abort = null;

const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const write = (c) => {
  fs.mkdirSync(CONF_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(FILE, JSON.stringify(c, null, 1), { mode: 0o600 });
  return c;
};
const update = (patch) => write({ ...read(), ...patch });
const newCode = () => String(crypto.randomInt(100000, 1000000));
const sleep = (ms, signal) => new Promise((ok) => { const t = setTimeout(ok, ms); signal?.addEventListener('abort', () => { clearTimeout(t); ok(); }, { once: true }); });

class TgError extends Error { constructor(msg, code) { super(msg); this.code = code; } }

async function call(method, params = {}, { token = read().token, timeout = 20000, form = null } = {}) {
  if (!token) throw new TgError('Chưa có mã bot Telegram.', 0);
  const signal = AbortSignal.timeout(timeout);
  const r = await fetch(`${BASE}/bot${token}/${method}`, form ? { method: 'POST', body: form, signal } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params), signal });
  const j = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
  if (!j.ok) throw new TgError(j.description || `Telegram báo lỗi ${r.status}`, j.error_code ?? r.status);
  return j.result;
}

// ───────── trạng thái cho trang Thiết lập
export function status() {
  const c = read();
  return {
    configured: !!c.token, bot: c.botName ?? '', linked: !!c.chatId, chatName: c.chatName ?? '',
    code: c.token && !c.chatId ? c.code : '', notify: { ...NOTIFY_DEFAULT, ...c.notify }, polling, error: lastError,
  };
}

export async function setToken(raw) {
  const token = String(raw ?? '').trim();
  if (!TOKEN_RE.test(token)) throw new TgError('Mã bot không đúng dạng. Mã do @BotFather gửi có dạng 123456789:ABC… (số, dấu hai chấm, rồi một chuỗi dài).', 400);
  let me;
  try { me = await call('getMe', {}, { token }); }
  catch (e) { throw new TgError(e.code === 401 || e.code === 404 ? 'Telegram không nhận mã bot này — chép lại mã từ @BotFather.' : `Không gọi được Telegram: ${e.message}`, 400); }
  const old = read();
  const same = old.token === token;
  write({ ...old, token, botName: me.username, chatId: same ? old.chatId : null, chatName: same ? old.chatName : '', code: newCode(), offset: same ? old.offset : 0 });
  await call('setMyCommands', { commands: COMMANDS.map(([command, description]) => ({ command, description })) }, { token }).catch(() => {});
  restart();
  return status();
}

export function setNotify(n) {
  const cur = { ...NOTIFY_DEFAULT, ...read().notify };
  for (const k of Object.keys(NOTIFY_DEFAULT)) if (typeof n?.[k] === 'boolean') cur[k] = n[k];
  update({ notify: cur });
  return status();
}

export function unlink() { update({ chatId: null, chatName: '', code: newCode() }); return status(); }

export function forget() {
  gen++; abort?.abort(); polling = false; lastError = '';
  fs.rmSync(FILE, { force: true });
  return status();
}

// ───────── gửi tin / ảnh / file
const markup = (buttons) => (buttons?.length ? { reply_markup: { inline_keyboard: buttons } } : {});
const btn = (text, data) => ({ text, callback_data: data });
export async function send(text, buttons = null) {
  const c = read();
  if (!c.token || !c.chatId) return false;
  try { await call('sendMessage', { chat_id: c.chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true, ...markup(buttons) }); return true; }
  catch (e) { lastError = `Gửi tin lỗi: ${e.message}`; return false; }
}
// tin dài: chia theo dòng (Telegram tối đa 4096 ký tự), nút gắn vào tin cuối
async function reply(chatId, text, buttons = null) {
  const parts = [];
  let cur = '';
  for (const line of String(text).split('\n')) {
    if (cur && (cur + '\n' + line).length > 3800) { parts.push(cur); cur = ''; }
    cur = cur ? `${cur}\n${line}` : line.slice(0, 3800);
  }
  parts.push(cur || '…');
  for (const [i, p] of parts.entries())
    await call('sendMessage', { chat_id: chatId, text: p, disable_web_page_preview: true, ...(i === parts.length - 1 ? markup(buttons) : {}) }).catch((e) => { lastError = `Gửi tin lỗi: ${e.message}`; });
}
async function sendFile(method, field, chatId, file, extra = {}, name = path.basename(file), type = '') {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  for (const [k, v] of Object.entries(extra)) form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  form.append(field, await fs.openAsBlob(file, type ? { type } : {}), name);
  return call(method, {}, { form, timeout: 10 * 60000 });
}
// ảnh storyboard: album 10 ảnh một lần (giới hạn của Telegram)
async function sendAlbum(chatId, files, caption) {
  for (let i = 0; i < files.length; i += 10) {
    const part = files.slice(i, i + 10);
    const cap = i === 0 && caption ? { caption } : {};
    if (part.length === 1) { await sendFile('sendPhoto', 'photo', chatId, part[0], cap, undefined, 'image/jpeg'); continue; }
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('media', JSON.stringify(part.map((f, j) => ({ type: 'photo', media: `attach://p${j}`, ...(j === 0 ? cap : {}) }))));
    for (const [j, f] of part.entries()) form.append(`p${j}`, await fs.openAsBlob(f, { type: 'image/jpeg' }), path.basename(f));
    await call('sendMediaGroup', {}, { form, timeout: 5 * 60000 });
  }
}

export async function sendTest() {
  const c = read();
  if (!c.chatId) throw new TgError('Chưa liên kết — mở bot trên Telegram và gửi mã liên kết trước.', 400);
  await call('sendMessage', { chat_id: c.chatId, text: `✓ Xưởng phim trên máy ${os.hostname()} gửi thử. Gõ /giup để xem các lệnh.` });
  return status();
}

const dur = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} giây` : `${Math.floor(s / 60)} phút ${s % 60} giây`; };
const sk = (slug) => crypto.createHash('sha1').update(String(slug)).digest('base64url').slice(0, 8);

// máy chủ gọi khi một việc kết thúc. { job (jobView), title, queueLeft, queueEnded, log }
export function jobFinished({ job: j, title, queueLeft = 0, queueEnded = false, log = [] }) {
  const c = read();
  if (!c.token || !c.chatId || !j) return;
  const n = { ...NOTIFY_DEFAULT, ...c.notify };
  if (j.status === 'done' && !n.done) return;
  if (j.status === 'error' && !n.error) return;
  if (j.status === 'stopped') return; // chính người dùng bấm dừng
  const lines = [`${j.status === 'done' ? '✅' : '❌'} ${j.label}${j.status === 'done' ? ' xong' : ' bị lỗi'} — ${dur((j.ended || Date.now()) - j.started)}`];
  if (title) lines.push(title);
  if (j.summary) lines.push('', j.summary.slice(0, 600));
  if (j.status === 'error') {
    if (j.hint) lines.push('', `Gợi ý: ${j.hint}`);
    const tail = log.filter((l) => typeof l === 'string').slice(-6);
    if (tail.length) lines.push('', ...tail.map((l) => l.slice(0, 200)));
  }
  if (queueLeft) lines.push('', `Còn ${queueLeft} tập trong hàng đợi.`);
  else if (queueEnded) lines.push('', 'Hàng đợi đã làm xong hết.');
  // nút bước tiếp theo, theo loại việc
  const b = [];
  if (j.slug) {
    const k = sk(j.slug), e = j.episode;
    if (j.status === 'done') {
      if (['render', 'voicefix'].includes(j.action) && e) b.push([btn('🎬 Xem phim', `xem:${k}:${e}`), btn(`📂 Tập ${e}`, `ep:${k}:${e}`)], [btn('📝 Bài đăng', `bd:${k}:${e}`), btn('📣 Đăng lên MXH', `dmx:${k}:${e}`)]);
      else if (['script', 'fix', 'storyboard'].includes(j.action) && e) b.push([btn(`🖼 Xem tập ${e} (storyboard)`, `ep:${k}:${e}`)], ...(j.action === 'script' && queueEnded ? [[btn('📝 Duyệt kịch bản toàn bộ', `dkl:${k}`)]] : []));
      else if (['plan', 'plan-add'].includes(j.action)) b.push([btn('📋 Xem kế hoạch', `kh:${k}`)]);
      else if (j.action === 'characters') b.push([btn('👥 Xem bảng nhân vật', `nv:${k}`)]);
    } else if (j.status === 'error' && e) {
      if (['render', 'voicefix'].includes(j.action)) b.push([btn('🔁 Dựng lại', `dp:${k}:${e}`)]);
      b.push([btn(`📂 Tập ${e}`, `ep:${k}:${e}`)]);
    }
  }
  send(lines.join('\n'), b.length ? b : null);
}

// ───────── bài đăng mạng xã hội (post.mjs): mỗi bản một tin riêng → giữ ngón tay lên tin, chọn Sao chép là dán được ngay
const words = (t) => (String(t ?? '').match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'’._\-/@&]*/gu) ?? []).length;
async function sendPost(chatId, slug, n, title, p) {
  const k = sk(slug);
  await reply(chatId, [`📝 Bài đăng mạng xã hội — ${title}`, p.stale ? '🟡 Kịch bản đã sửa sau khi viết bài — bấm "Viết lại" để cập nhật.' : '',
    `Hai tin dưới đây: bản ngắn (${words(p.short)} từ) và bản dài (${words(p.long)} từ). Giữ ngón tay lên tin → Sao chép, rồi dán lên Facebook, TikTok, YouTube, Zalo…`].filter(Boolean).join('\n'));
  await reply(chatId, p.short);
  await reply(chatId, p.long, [[btn('🔄 Viết lại bài đăng', `bdv:${k}:${n}`), btn(`📂 Tập ${n}`, `ep:${k}:${n}`)], [btn('📣 Đăng lên mạng xã hội', `dmx:${k}:${n}`)]]);
}
// máy chủ gọi khi AI viết xong bài sau lần dựng (tự động)
export function postReady({ slug, episode, title, post }) {
  const c = read();
  if (!c.token || !c.chatId || !post?.short || !{ ...NOTIFY_DEFAULT, ...c.notify }.done) return;
  sendPost(c.chatId, slug, episode, title, post).catch((e) => { lastError = `Gửi tin lỗi: ${e.message}`; });
}
export function postFailed({ slug, episode, title, error }) {
  const c = read();
  if (!c.token || !c.chatId || !{ ...NOTIFY_DEFAULT, ...c.notify }.error) return;
  send(`⚠️ Chưa viết được bài đăng cho ${title}: ${error}`, [[btn('🔄 Viết lại bài đăng', `bdv:${sk(slug)}:${episode}`)]]);
}
// xem bài đăng của tập n (chưa có → AI viết, chờ xong rồi gửi); force = viết lại
async function postView(chatId, slug, n, force = false) {
  const s = await seriesFull(slug);
  const e = s.episodes.find((x) => x.number === n);
  if (!e) return reply(chatId, `${s.name} không có tập ${n}.`);
  if (!e.scenes) return reply(chatId, `Tập ${n} chưa có kịch bản — chưa viết bài đăng được.`, [[btn('📂 Mở tập', `ep:${sk(slug)}:${n}`)]]);
  const title = `${s.name} · Tập ${n}${e.title ? `: ${e.title}` : ''}`;
  const { post } = await local('GET', `/api/series/${slug}/post?episode=${n}`);
  if (post?.busy) return reply(chatId, `✍️ AI đang viết bài đăng tập ${n} — xong sẽ gửi ngay.`);
  if (post?.short && !force) return sendPost(chatId, slug, n, title, post);
  await reply(chatId, `✍️ AI đang ${post?.short ? 'viết lại' : 'viết'} bài đăng tập ${n} (thường dưới một phút)…`);
  await call('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
  const r = await local('POST', `/api/series/${slug}/post`, { episode: n }, 5 * 60000);
  return sendPost(chatId, slug, n, title, r.post);
}

export function bootNotice() {
  const c = read();
  if (c.chatId && { ...NOTIFY_DEFAULT, ...c.notify }.boot) send(`🟢 Xưởng phim đã chạy trên máy ${os.hostname()} (${new Date().toLocaleString('vi-VN')}).`);
}

// ───────── gọi API của chính máy chủ
async function local(method, p, body, timeout = 30000) {
  const r = await fetch(`http://127.0.0.1:${ctx.port}${p}`, { method, headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-xuong': '1' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new TgError(j.error || `Lỗi ${r.status}`, r.status);
  return j;
}
const seriesList = () => local('GET', '/api/series');
const seriesFull = (slug) => local('GET', `/api/series/${slug}`);
const bySk = async (k) => (await seriesList()).find((s) => sk(s.slug) === k) ?? null;

const COMMANDS = [
  ['trangthai', 'Máy đang làm gì'],
  ['series', 'Danh sách series, chọn series để làm việc'],
  ['kehoach', 'Kế hoạch các tập: duyệt tập, lập / lập lại kế hoạch'],
  ['tap', 'Các tập của series; /tap 11 = mở tập 11 (storyboard, duyệt, góp ý)'],
  ['dungphim', 'Dựng phim: /dungphim 11 (nhiều tập: /dungphim 3 4 5)'],
  ['suagiong', 'Chỉ sửa giọng: /suagiong 11'],
  ['gopy', 'Sửa tập theo góp ý: /gopy 11 nội dung góp ý'],
  ['xem', 'Gửi phim về điện thoại: /xem 11'],
  ['duyetkb', 'Duyệt kịch bản toàn bộ, rồi sản xuất toàn bộ'],
  ['baidang', 'Bài đăng mạng xã hội của tập: /baidang 11'],
  ['dang', 'Đăng phim lên Facebook / Instagram / YouTube / TikTok: /dang 11'],
  ['lichdang', 'Lịch đăng mạng xã hội (xem, huỷ, đăng ngay)'],
  ['nhanvat', 'Bảng nhân vật của series'],
  ['seriesmoi', 'Tạo series mới (từ đầu, hoặc nhân bản series có sẵn)'],
  ['hang', 'Hàng đợi (viết kịch bản, dựng phim)'],
  ['tieptuc', 'Chạy tiếp hàng đợi'],
  ['huy', 'Dừng việc đang chạy (tạm dừng hàng đợi)'],
  ['huybo', 'Thôi nhập góp ý / thôi tạo series đang dở'],
  ['giup', 'Danh sách lệnh'],
];
const HELP = ['Các lệnh của Xưởng phim:', ...COMMANDS.map(([c, d]) => `/${c} — ${d}`), '', 'Lệnh theo tập dùng series đang chọn (/series để đổi). Hầu hết các bước có nút bấm ngay dưới tin nhắn.'].join('\n');

const STATUS_L = { running: 'đang chạy', stopping: 'đang dừng', done: 'xong', error: 'lỗi', stopped: 'đã dừng' };
async function statusText() {
  const { job, queue } = await local('GET', '/api/job');
  const out = [];
  if (job) {
    const last = [...(job.log ?? [])].reverse().find((l) => typeof l === 'string' && l.trim()) ?? '';
    out.push(`${job.status === 'running' ? '⏳' : job.status === 'done' ? '✅' : job.status === 'error' ? '❌' : '■'} ${job.label}${job.episode ? ` · tập ${job.episode}` : ''} — ${STATUS_L[job.status] ?? job.status}${job.status === 'running' ? ` (${dur(Date.now() - job.started)})` : ''}`);
    if (job.slug) out.push(`Series: ${job.slug}`);
    if (job.status === 'running' && last) out.push(last.slice(0, 200));
  } else out.push('Máy đang rảnh.');
  out.push('', queueText(queue));
  return out.join('\n');
}
const queueText = (q) => q.items.length ? [`Hàng đợi (${q.items.length} tập${q.paused ? ', đang TẠM DỪNG — /tieptuc để chạy' : ''}):`, ...q.items.slice(0, 15).map((i, k) => `${k + 1}. ${i.title}`)].join('\n') : 'Hàng đợi trống.';

async function activeSeries(chatId) {
  const list = await seriesList();
  const cur = read().series;
  const s = list.find((x) => x.slug === cur) ?? (list.length === 1 ? list[0] : null);
  if (!s) { await reply(chatId, list.length ? 'Chọn series trước:' : 'Chưa có series nào — /seriesmoi để tạo.', seriesButtons(list)); return null; }
  return s;
}
const seriesButtons = (list, act = 'chon') => list.slice(0, 20).map((s) => [btn(`${s.name} (${s.done}/${s.episodes} tập đã dựng)`, `${act}:${sk(s.slug)}`)]);
const nums = (args) => [...new Set(args.split(/[\s,]+/).filter(Boolean).map(Number))].filter((n) => Number.isInteger(n) && n > 0 && n < 100);

// ───────── trạng thái một tập (giống trang web): chờ duyệt kế hoạch → đã duyệt → có kịch bản/storyboard → có phim
const stateOf = (e) => (!e.approved ? 'de-xuat' : !e.scenes ? 'duyet' : !e.mp4 ? 'kich-ban' : 'phim');
const ICON = { 'de-xuat': '⏳', duyet: '✔️', 'kich-ban': '🖼', phim: '🎬' };
const STATE_L = { 'de-xuat': 'chờ duyệt kế hoạch', duyet: 'đã duyệt — chưa có kịch bản', 'kich-ban': 'có kịch bản + storyboard — chờ duyệt dựng phim', phim: 'đã có phim' };
const LEGEND = '⏳ chờ duyệt · ✔️ đã duyệt · 🖼 có storyboard · 🎬 có phim';

async function episodesView(chatId, slug) {
  const s = await seriesFull(slug);
  if (!s.episodes.length) return reply(chatId, `${s.name}: chưa có tập nào.`, [[btn('📋 Kế hoạch', `kh:${sk(slug)}`)]]);
  const rows = s.episodes.map((e) => `${ICON[stateOf(e)]} ${e.number}. ${e.title ?? ''}${e.seconds ? ` (${Math.round(e.seconds)}s)` : ''}${e.stale ? ' — đã sửa, chưa dựng lại' : ''}`);
  const k = sk(slug), b = [];
  const eps = s.episodes.slice(0, 40);
  for (let i = 0; i < eps.length; i += 5) b.push(eps.slice(i, i + 5).map((e) => btn(`${ICON[stateOf(e)]} ${e.number}`, `ep:${k}:${e.number}`)));
  if (needFilm(s).length || s.episodes.some((e) => e.approved && !e.scenes)) b.push([btn('📝 Duyệt kịch bản / sản xuất toàn bộ', `dkl:${k}`)]);
  return reply(chatId, [s.name, ...rows, '', LEGEND, 'Bấm số tập để mở.'].join('\n'), b);
}

// ───────── sản xuất toàn bộ: AI viết kịch bản lần lượt → duyệt kịch bản toàn bộ → dựng lần lượt mọi tập
const needFilm = (s) => s.episodes.filter((e) => e.scenes && (!e.mp4 || e.stale));
async function reviewView(chatId, slug) {
  const s = await seriesFull(slug);
  const { queue } = await local('GET', '/api/job');
  const inQ = (n) => (queue?.items ?? []).some((i) => i.slug === slug && i.episode === n);
  const k = sk(slug);
  const toWrite = s.episodes.filter((e) => e.approved && !e.scenes && !inQ(e.number));
  const list = needFilm(s).filter((e) => !inQ(e.number));
  const ok = list.filter((e) => e.scriptOk);
  const t = [`${s.name} — duyệt kịch bản toàn bộ`];
  const b = [];
  if (toWrite.length) { t.push('', `✍️ ${toWrite.length} tập đã duyệt kế hoạch, chưa có kịch bản: ${toWrite.map((e) => e.number).join(', ')}.`); b.push([btn(`✍️ AI viết kịch bản ${toWrite.length} tập (lần lượt)`, `vka:${k}`)]); }
  if (!list.length) {
    t.push('', toWrite.length ? 'Viết xong kịch bản thì quay lại đây để duyệt.' : 'Không còn tập nào chờ duyệt kịch bản.');
    return reply(chatId, t.join('\n'), b.length ? b : null);
  }
  t.push('', `Đã duyệt ${ok.length}/${list.length} tập:`, ...list.map((e) => `${e.scriptOk ? '✅' : '⬜'} ${e.number}. ${e.title ?? ''}${e.mp4 && e.stale ? ' (dựng lại)' : ''}`));
  if (ok.length === list.length) {
    t.push('', `Đã duyệt toàn bộ ${list.length} kịch bản. Sản xuất toàn bộ luôn không? Máy dựng lần lượt từng tập, xong tập nào báo tập đó; bản mới đè bản cũ.`);
    b.push([btn(`🎬 Sản xuất toàn bộ (${list.length} tập)`, `sxa:${k}`)], [btn('Để sau', `ep0:${k}`)]);
    return reply(chatId, t.join('\n'), b);
  }
  t.push('', 'Bấm 🖼 số tập để xem storyboard + lời thoại, ✅ để duyệt.');
  const todo = list.filter((e) => !e.scriptOk).slice(0, 24);
  for (let i = 0; i < todo.length; i += 3) b.push(todo.slice(i, i + 3).flatMap((e) => [btn(`🖼 ${e.number}`, `xkb:${k}:${e.number}`), btn(`✅ ${e.number}`, `dk:${k}:${e.number}`)]));
  b.push([btn(`✅ Duyệt tất cả (${list.length - ok.length} tập)`, `dka:${k}`)]);
  if (ok.length) b.push([btn(`🎬 Sản xuất ${ok.length} tập đã duyệt`, `sxo:${k}`)]);
  return reply(chatId, t.join('\n'), b);
}
// xem một tập để duyệt: album storyboard + lời thoại, kèm nút duyệt / góp ý
async function reviewEpisode(chatId, slug, n) {
  const s = await seriesFull(slug);
  const e = s.episodes.find((x) => x.number === n);
  if (!e?.scenes) return reply(chatId, `Tập ${n} chưa có kịch bản.`);
  if (e.board?.length) await sendBoard(chatId, slug, e);
  const { scenes } = await local('GET', `/api/series/${slug}/lines?episode=${n}`);
  const text = scenes.map((sc, i) => [`Cảnh ${i + 1}:`, ...(sc.lines.length ? sc.lines.map((l) => `  ${l.speaker ?? 'Dẫn'}: ${l.text}`) : ['  (không lời)'])].join('\n')).join('\n');
  const k = sk(slug);
  return reply(chatId, `📄 Tập ${n}${e.title ? `: ${e.title}` : ''}\n\n${text}`, [[btn(`✅ Duyệt tập ${n}`, `dk:${k}:${n}`), btn('💬 Góp ý để sửa', `gy:${k}:${n}`)], [btn('↩️ Danh sách duyệt', `dkl:${k}`)]]);
}
async function approveScripts(chatId, slug, nums) {
  await local('POST', `/api/series/${slug}/script-approve`, { episodes: nums, ok: true });
  await reply(chatId, `✅ Đã duyệt kịch bản ${nums.length === 1 ? `tập ${nums[0]}` : `${nums.length} tập`}.`);
  return reviewView(chatId, slug);
}
async function produce(chatId, slug, onlyApproved) {
  const s = await seriesFull(slug);
  const list = needFilm(s).filter((e) => !onlyApproved || e.scriptOk).map((e) => e.number);
  if (!list.length) return reply(chatId, 'Không còn tập nào cần dựng.');
  const r = await local('POST', `/api/series/${slug}/queue`, { episodes: list, action: 'render' });
  return reply(chatId, `🎬 Đã xếp ${r.added} tập vào hàng đợi sản xuất. Máy dựng lần lượt từng tập, xong tập nào báo tập đó (kèm bài đăng).${r.job?.status === 'running' ? `\nĐang chạy: ${r.job.label}${r.job.episode ? ` · tập ${r.job.episode}` : ''}.` : ''}`);
}
async function writeAll(chatId, slug) {
  const s = await seriesFull(slug);
  const list = s.episodes.filter((e) => e.approved && !e.scenes).map((e) => e.number);
  if (!list.length) return reply(chatId, 'Không còn tập nào đã duyệt kế hoạch mà chưa có kịch bản.');
  const r = await local('POST', `/api/series/${slug}/queue`, { episodes: list, action: 'script' });
  return reply(chatId, `✍️ Đã xếp ${r.added} tập vào hàng đợi — AI viết kịch bản lần lượt (mỗi tập vài phút). Viết xong hết, bot nhắc duyệt kịch bản toàn bộ.`);
}

// ───────── đăng lên mạng xã hội (social.mjs) từ điện thoại: chọn kênh → chọn bản bài đăng (hoặc tự sửa) → TikTok: chọn ai xem → đăng ngay / hẹn giờ → xác nhận
const KIND_T = { fb: 'Facebook', ig: 'Instagram', yt: 'YouTube', tt: 'TikTok' };
const TT_P = [['PUBLIC_TO_EVERYONE', 'Mọi người'], ['MUTUAL_FOLLOW_FRIENDS', 'Bạn bè'], ['FOLLOWER_OF_CREATOR', 'Người theo dõi'], ['SELF_ONLY', 'Chỉ mình tôi'], ['inbox', 'Hộp thư TikTok (tự bấm đăng)'], ['remind', '📲 Nhắc qua Telegram']];
const ACTIVE = ['queued', 'scheduled', 'posting'];
const fmtT = (ms) => new Date(ms).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const drafts = new Map(); // chatId → { slug, n, sel: [dest id], ver, caption, tt, at }
// "19:30" (hôm nay, qua giờ thì mai) · "19:30 28/11" · "28/11 19:30" · "28/11/2026 19:30"
function parseWhen(t) {
  const m = /(\d{1,2})[:hg](\d{2})?/.exec(t);
  if (!m) return null;
  const d = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/.exec(t);
  const now = new Date();
  const x = d ? new Date(+(d[3] ?? now.getFullYear()), +d[2] - 1, +d[1], +m[1], +(m[2] ?? 0)) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +(m[2] ?? 0));
  if (!d && x.getTime() < Date.now()) x.setDate(x.getDate() + 1);
  if (d && !d[3] && x.getTime() < Date.now() - 86400000) x.setFullYear(x.getFullYear() + 1);
  return Number.isNaN(x.getTime()) ? null : x.getTime();
}
async function shareView(chatId, slug, n, { fresh = false, msgId = null } = {}) {
  const s = await seriesFull(slug);
  const e = s.episodes.find((x) => x.number === n);
  if (!e?.mp4) return reply(chatId, `Tập ${n} chưa có phim — dựng phim trước.`);
  const { dests: D } = await local('GET', '/api/social');
  if (!D.length) return reply(chatId, 'Chưa kết nối kênh mạng xã hội nào. Kết nối Facebook, Instagram, YouTube, TikTok ở trang Thiết lập → Mạng xã hội (làm tại máy chạy xưởng).');
  let d = drafts.get(chatId);
  if (fresh || !d || d.slug !== slug || d.n !== n) { d = { slug, n, sel: [], ver: e.post?.short ? 'short' : 'own', caption: e.post?.short ?? e.title ?? '', tt: null, at: null }; drafts.set(chatId, d); }
  d.sel = d.sel.filter((id) => D.some((x) => x.id === id));
  const busy = new Set((e.social ?? []).filter((p) => ACTIVE.includes(p.status)).map((p) => p.dest));
  const k = sk(slug), kinds = new Set(D.filter((x) => d.sel.includes(x.id)).map((x) => x.kind));
  const t = [`📣 Đăng tập ${n}${e.title ? `: ${e.title}` : ''}`, '', 'Kênh (bấm để chọn / bỏ):', ...D.map((x) => `${d.sel.includes(x.id) ? '✅' : busy.has(x.id) ? '⏳' : '⬜'} ${KIND_T[x.kind]} · ${x.name}${busy.has(x.id) ? ' (đã có bài chờ đăng)' : ''}`),
    '', `Nội dung — ${d.ver === 'short' ? 'bản ngắn' : d.ver === 'long' ? 'bản dài' : 'tự sửa'} (${[...d.caption].length} ký tự):`, d.caption.slice(0, 2500) || '(trống)'];
  if (kinds.has('tt')) t.push('', `TikTok — ai được xem: ${TT_P.find(([v]) => v === d.tt)?.[1] ?? 'chưa chọn (bắt buộc)'}`);
  if (kinds.has('yt')) t.push('', `YouTube: tiêu đề "${(e.title ?? `Tập ${n}`).slice(0, 100)}", công khai.`);
  if (kinds.has('fb') && e.seconds > 90) t.push('', `⚠️ Facebook Reels chỉ nhận tối đa 90 giây — phim dài ${e.seconds} giây.`);
  if (e.stale) t.push('', '🟡 Phim đang là bản cũ (đề bài / kịch bản đã sửa) — nên dựng lại trước khi đăng.');
  const pick = D.map((x, i) => [x, i]).filter(([x]) => !busy.has(x.id));
  const b = [];
  for (let i = 0; i < pick.length; i += 2) b.push(pick.slice(i, i + 2).map(([x, j]) => btn(`${d.sel.includes(x.id) ? '✅' : '⬜'} ${KIND_T[x.kind]} ${x.name}`.slice(0, 40), `dmt:${k}:${n}:${j}`)));
  b.push([...(e.post?.short ? [btn('Bản ngắn', `dmc:${k}:${n}:s`), btn('Bản dài', `dmc:${k}:${n}:l`)] : []), btn('✏️ Tự sửa', `dme:${k}:${n}`)]);
  if (kinds.has('tt')) for (let i = 0; i < TT_P.length; i += 3) b.push(TT_P.slice(i, i + 3).map(([v, l], j) => btn(`${d.tt === v ? '● ' : ''}${l}`, `dmp:${k}:${n}:${i + j}`)));
  if (d.sel.length) b.push([btn('🚀 Đăng ngay', `dmn:${k}:${n}`), btn('⏰ Hẹn giờ', `dmh:${k}:${n}`)]);
  const text = t.join('\n').slice(0, 4000);
  if (msgId) { try { return await call('editMessageText', { chat_id: chatId, message_id: msgId, text, disable_web_page_preview: true, ...markup(b) }); } catch { /* tin cũ quá / không đổi → gửi tin mới */ } }
  return reply(chatId, text, b);
}
async function shareConfirm(chatId, at) {
  const d = drafts.get(chatId);
  if (!d?.sel.length) return reply(chatId, 'Phiên đăng bài đã hết — bấm 📣 Đăng lên MXH ở tập để làm lại.');
  const { dests: D } = await local('GET', '/api/social');
  const chosen = D.filter((x) => d.sel.includes(x.id));
  if (chosen.some((x) => x.kind === 'tt') && !d.tt) return reply(chatId, 'TikTok: chọn ai được xem video trước (bấm một nút ở tin trên).');
  if (!d.caption.trim()) return reply(chatId, 'Nội dung đăng đang trống — bấm ✏️ Tự sửa.');
  d.at = at;
  const k = sk(d.slug);
  return reply(chatId, [`${at ? `⏰ Hẹn đăng lúc ${fmtT(at)}` : '🚀 Đăng ngay'} tập ${d.n} lên:`, ...chosen.map((x) => `• ${KIND_T[x.kind]} · ${x.name}`), '', 'Đã xem lại phim và nội dung? Bấm xác nhận để đăng.', at ? 'Máy chạy xưởng phải đang bật lúc đến giờ.' : ''].filter(Boolean).join('\n'),
    [[btn('✅ Xác nhận đăng', `dmy:${k}:${d.n}`), btn('↩️ Sửa lại', `dmb:${k}:${d.n}`)]]);
}
async function shareGo(chatId) {
  const d = drafts.get(chatId);
  if (!d?.sel.length) return reply(chatId, 'Phiên đăng bài đã hết — bấm 📣 Đăng lên MXH ở tập để làm lại.');
  const s = await seriesFull(d.slug), e = s.episodes.find((x) => x.number === d.n);
  const { dests: D } = await local('GET', '/api/social');
  const items = D.filter((x) => d.sel.includes(x.id)).map((x) => ({ dest: x.id, caption: d.caption, ...(x.kind === 'yt' ? { title: (e?.title ?? `Tập ${d.n}`).slice(0, 100), privacy: 'public' } : {}), ...(x.kind === 'tt' ? { tiktok: ['inbox', 'remind'].includes(d.tt) ? { mode: d.tt } : { mode: 'direct', privacy: d.tt, comment: false, duet: false, stitch: false } } : {}) }));
  if (d.at && d.at < Date.now() + 60000) return reply(chatId, 'Giờ hẹn đã qua — bấm ⏰ Hẹn giờ để chọn lại.');
  const r = await local('POST', '/api/social/posts', { slug: d.slug, episode: d.n, items, at: d.at });
  drafts.delete(chatId);
  return reply(chatId, d.at ? `✓ Đã hẹn ${r.posts.length} bài lúc ${fmtT(d.at)}. Xem / huỷ: /lichdang` : `✓ Đang đăng lên ${r.posts.length} kênh — xong từng kênh sẽ báo.`);
}
async function scheduleList(chatId) {
  const { posts } = await local('GET', '/api/social/posts');
  const up = posts.filter((p) => [...ACTIVE, 'missed'].includes(p.status)).sort((a, b) => (a.at ?? a.created) - (b.at ?? b.created));
  const names = Object.fromEntries((await seriesList()).map((s) => [s.slug, s.name]));
  if (!up.length) {
    const last = posts.filter((p) => p.status === 'done').sort((a, b) => b.ended - a.ended).slice(0, 5);
    return reply(chatId, ['Không có bài nào đang chờ đăng.', ...(last.length ? ['', 'Đăng gần đây:', ...last.map((p) => `✅ ${fmtT(p.ended)} · ${names[p.slug] ?? p.slug} tập ${p.episode} → ${KIND_T[p.kind]} · ${p.destName}${p.url ? `\n   ${p.url}` : ''}`)] : [])].join('\n'));
  }
  const ic = { queued: '🔜', scheduled: '⏰', posting: '⏳', missed: '⚠️' };
  return reply(chatId, ['Lịch đăng:', ...up.map((p, i) => `${i + 1}. ${ic[p.status]} ${p.status === 'scheduled' || p.status === 'missed' ? fmtT(p.at) : p.status === 'posting' ? 'đang đăng' : 'chờ lượt'} · ${names[p.slug] ?? p.slug} tập ${p.episode} → ${KIND_T[p.kind]} · ${p.destName}`)].join('\n'),
    up.filter((p) => p.status !== 'posting').slice(0, 20).map((p) => [btn(`✖️ Huỷ ${up.indexOf(p) + 1}`, `pdx:${p.id}`), ...(p.status === 'missed' || p.status === 'scheduled' ? [btn(`🚀 Đăng ngay ${up.indexOf(p) + 1}`, `pdn:${p.id}`)] : [])]));
}
// máy chủ báo kết quả đăng bài (social.mjs)
export function socialEvent(ev, title) {
  const c = read(), p = ev.post;
  if (!c.token || !c.chatId || !p) return;
  const on = { ...NOTIFY_DEFAULT, ...c.notify };
  const where = `${KIND_T[p.kind]} · ${p.destName}`;
  if (ev.type === 'done' && p.tiktok?.mode === 'remind') return; // tin nhắc (video + nội dung) chính là thông báo
  if (ev.type === 'done' && on.done) send([`✅ Đã đăng ${title} lên ${where}`, p.url ?? '', p.note ? `ℹ️ ${p.note}` : ''].filter(Boolean).join('\n'));
  else if (ev.type === 'error' && on.error) send(`⚠️ Đăng ${title} lên ${where} lỗi: ${p.error}`, [[btn('🔁 Đăng lại', `pdn:${p.id}`), btn('✖️ Bỏ', `pdx:${p.id}`)]]);
  else if (ev.type === 'missed' && on.error) send(`⚠️ Lỡ giờ hẹn đăng ${title} lên ${where} (${fmtT(p.at)}) vì máy tắt / ngủ.`, [[btn('🚀 Đăng ngay', `pdn:${p.id}`), btn('✖️ Bỏ', `pdx:${p.id}`)]]);
}

async function planView(chatId, slug) {
  const s = await seriesFull(slug);
  const k = sk(slug);
  if (!s.planned) return reply(chatId, `${s.name}: chưa có kế hoạch. AI đọc đề bài và đề xuất ${s.total || ''} tập để bạn duyệt.`, [[btn('🧠 Lập kế hoạch', `lap:${k}`)], [btn('💬 Lập kế hoạch kèm lưu ý', `gyk:${k}`)]]);
  const pend = s.episodes.filter((e) => !e.approved);
  const lines = [`${s.name} — kế hoạch ${s.planned} tập, đã duyệt ${s.planned - pend.length}`, ''];
  for (const e of s.episodes) lines.push(`${ICON[stateOf(e)]} ${e.number}. ${e.title ?? ''}`, ...(e.logline && !e.approved ? [`   ${e.logline.slice(0, 220)}`] : []));
  lines.push('', LEGEND);
  const b = [];
  for (let i = 0; i < Math.min(pend.length, 20); i += 4) b.push(pend.slice(i, i + 4).map((e) => btn(`📂 ${e.number}`, `ep:${k}:${e.number}`)));
  if (pend.length) b.push([btn(`✅ Duyệt tất cả (${pend.length} tập)`, `dyall:${k}`)]);
  const next = s.episodes.find((e) => stateOf(e) === 'duyet');
  if (next) b.push([btn(`✍️ Viết kịch bản tập ${next.number}`, `vk:${k}:${next.number}`)]);
  b.push([btn('💬 Góp ý, lập lại kế hoạch', `gyk:${k}`)]);
  return reply(chatId, lines.join('\n'), b);
}

async function episodeView(chatId, slug, n, { board = true } = {}) {
  const s = await seriesFull(slug);
  const e = s.episodes.find((x) => x.number === n);
  if (!e) return reply(chatId, `${s.name} không có tập ${n}.`);
  const st = stateOf(e), k = sk(slug);
  const t = [`${s.name} · Tập ${n}${e.title ? `: ${e.title}` : ''}`, `${ICON[st]} ${STATE_L[st]}${e.seconds ? ` · ${Math.round(e.seconds)} giây` : ''}`];
  if (st === 'de-xuat' || st === 'duyet') {
    if (e.logline) t.push('', e.logline);
    if (e.hook) t.push('', `Mở đầu: ${e.hook}`);
    if (e.beats?.length) t.push('', ...e.beats.map((x, i) => `${i + 1}. ${x}`));
    if (e.visual) t.push('', `Hình: ${e.visual}`);
    if (e.cta) t.push(`Kết: ${e.cta}`);
  }
  if (e.issues?.length) t.push('', `⚠️ Bố cục còn ${e.issues.length} chỗ chồng lấn: ${e.issues.slice(0, 3).join(' · ')}`);
  if (e.stale) t.push('', `🟡 ${[e.staleScript ? 'Kịch bản đã sửa' : '', e.drift?.length ? `đề bài đã đổi ${e.drift.join(', ')}` : ''].filter(Boolean).join('; ')} sau lần dựng gần nhất — bấm Dựng lại, bản mới đè lên bản cũ.`);
  const b = [];
  if (st === 'de-xuat') b.push([btn('✅ Duyệt tập này', `dy:${k}:${n}`)]);
  if (st === 'duyet') b.push([btn('✍️ Viết kịch bản + storyboard', `vk:${k}:${n}`)], [btn('💬 Viết, kèm lưu ý', `vkn:${k}:${n}`)]);
  if (st === 'kich-ban') b.push([btn('✅ Duyệt và dựng phim', `dp:${k}:${n}`)], [btn('💬 Góp ý để sửa', `gy:${k}:${n}`), btn('📄 Kịch bản', `kb:${k}:${n}`)]);
  if (st === 'phim') b.push([btn('🎬 Xem phim', `xem:${k}:${n}`), btn('📝 Bài đăng', `bd:${k}:${n}`)], [btn('📣 Đăng lên mạng xã hội', `dmx:${k}:${n}`)], [btn('🖼 Storyboard', `sb:${k}:${n}`)], [btn('💬 Góp ý để sửa', `gy:${k}:${n}`), btn('🔊 Chỉ sửa giọng', `sg:${k}:${n}`)], [btn('🔁 Dựng lại', `dp:${k}:${n}`), btn('📄 Kịch bản', `kb:${k}:${n}`)]);
  if (board && st === 'kich-ban' && e.board?.length) await sendBoard(chatId, slug, e);
  return reply(chatId, t.join('\n'), b);
}
async function sendBoard(chatId, slug, e) {
  const dir = path.join(ctx.root, 'series', slug, 'episodes', e.id, 'storyboard');
  const files = (e.board ?? []).map((f) => path.join(dir, f)).filter((f) => fs.existsSync(f));
  if (!files.length) return reply(chatId, `Tập ${e.number} chưa có ảnh storyboard.`);
  await call('sendChatAction', { chat_id: chatId, action: 'upload_photo' }).catch(() => {});
  await sendAlbum(chatId, files, `Storyboard tập ${e.number}${e.title ? `: ${e.title}` : ''} — ${files.length} cảnh`);
}

// Bản gửi điện thoại: phim ≤ 49 MB gửi nguyên; nặng hơn thì nén H.264 về ~46 MB (bitrate theo thời lượng) → build/telegram.mp4,
// dùng lại tới khi MP4 đổi. Phim 2 phút ~ 3 Mbit/s — đủ nét để đăng TikTok / Reels.
const run = (bin, args) => new Promise((ok, no) => {
  const c = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let out = '', er = '';
  c.stdout.on('data', (d) => (out += d)); c.stderr.on('data', (d) => (er += d));
  c.on('error', no);
  c.on('close', (code) => (code === 0 ? ok(out) : no(new Error(`${bin} lỗi: ${er.trim().split('\n').pop() ?? code}`))));
});
export async function phoneFile(file, log = () => {}) {
  const st = fs.statSync(file);
  if (st.size <= VIDEO_MAX) return file;
  const small = path.join(path.dirname(path.dirname(file)), 'build', 'telegram.mp4');
  if (fs.existsSync(small)) { const s2 = fs.statSync(small); if (s2.mtimeMs > st.mtimeMs && s2.size <= VIDEO_MAX) return small; }
  const sec = parseFloat(await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])) || 120;
  fs.mkdirSync(path.dirname(small), { recursive: true });
  const tmp = `${small}.tmp.mp4`;
  for (const k of [1, 0.85, 0.7]) {
    const v = Math.max(600, Math.floor(((46 * 8 * 1024 * 1024) / sec / 1000) * k) - 128);
    log(`Nén phim cho điện thoại (${(st.size / 1e6).toFixed(0)} MB → dưới 50 MB)…`);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', `${v}k`, '-maxrate', `${Math.floor(v * 1.4)}k`, '-bufsize', `${v * 2}k`, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', tmp]);
    if (fs.statSync(tmp).size <= VIDEO_MAX) { fs.renameSync(tmp, small); return small; }
  }
  fs.rmSync(tmp, { force: true });
  throw new TgError('Nén phim vẫn quá 50 MB — không gửi được qua Telegram.', 413);
}

// TikTok "nhắc qua Telegram" (social.mjs gọi khi đến giờ hẹn): gửi video + nội dung đăng vào chat; người dùng lưu video → mở TikTok → đăng.
// Nội dung gửi riêng một tin (chú thích video tối đa 1024 ký tự, nội dung TikTok tới 2200) để giữ lâu tay là chép được trọn.
export async function remindPost(p, file, title, log = () => {}) {
  const c = read();
  if (!c.token || !c.chatId) throw new TgError('Chưa kết nối bot Telegram — vào Thiết lập → Telegram để kết nối rồi bấm Đăng lại.', 400);
  const f = await phoneFile(file, log);
  log('Gửi video qua Telegram…');
  await call('sendChatAction', { chat_id: c.chatId, action: 'upload_video' }).catch(() => {});
  await sendFile('sendVideo', 'video', c.chatId, f, { caption: `📲 Đến giờ đăng TikTok — ${title}\nLưu video về máy → mở TikTok → ＋ Tải lên → chọn video → dán nội dung ở tin dưới → Đăng.`, supports_streaming: 'true' }, `tap-${String(p.episode).padStart(2, '0')}.mp4`, 'video/mp4');
  await call('sendMessage', { chat_id: c.chatId, text: p.caption, disable_web_page_preview: true });
}

async function sendVideo(chatId, slug, n) {
  const s = await seriesFull(slug);
  const e = s.episodes.find((x) => x.number === n);
  if (!e) return reply(chatId, `Series này không có tập ${n}.`);
  if (!e.mp4) return reply(chatId, `Tập ${n} chưa dựng phim.`, [[btn('📂 Mở tập', `ep:${sk(slug)}:${n}`)]]);
  const file = path.join(ctx.root, 'series', slug, 'episodes', e.id, 'out', `${e.id}.mp4`);
  const size = fs.statSync(file).size;
  const caption = `${s.name} · Tập ${n}${e.title ? `: ${e.title}` : ''}`;
  let f = file;
  if (size > VIDEO_MAX) {
    await reply(chatId, `Phim nặng ${(size / 1e6).toFixed(0)} MB (bot Telegram chỉ gửi được tới 50 MB) — đang nén bản nhẹ để gửi, chờ khoảng 1–2 phút…`);
    try { f = await phoneFile(file); } catch (err) { return reply(chatId, `${caption}\n${err.message}${e.drive?.link ? `\nXem trên Google Drive: ${e.drive.link}` : ''}`); }
  }
  await call('sendChatAction', { chat_id: chatId, action: 'upload_video' }).catch(() => {});
  const k = sk(slug);
  await sendFile('sendVideo', 'video', chatId, f, { caption, supports_streaming: 'true', ...markup([[btn('💬 Góp ý để sửa', `gy:${k}:${n}`), btn('🔊 Chỉ sửa giọng', `sg:${k}:${n}`)]]) }, `${e.id}.mp4`, 'video/mp4');
}

async function sendScript(chatId, slug, n) {
  const s = await seriesFull(slug);
  const e = s.episodes.find((x) => x.number === n);
  const file = e && path.join(ctx.root, 'series', slug, 'episodes', e.id, 'script.md');
  if (!file || !fs.existsSync(file)) return reply(chatId, `Tập ${n} chưa có kịch bản.`);
  await sendFile('sendDocument', 'document', chatId, file, { caption: `Kịch bản tập ${n}${e.title ? `: ${e.title}` : ''}` }, `tap-${String(n).padStart(2, '0')}-kich-ban.md`, 'text/markdown');
}

async function charactersView(chatId, slug) {
  const s = await seriesFull(slug);
  const k = sk(slug);
  const names = (s.bible?.characters ?? []).map((c) => `${c.name} (${c.gender === 'nu' ? 'nữ' : 'nam'}${c.villain ? ', phản diện' : ''})`).join(' · ');
  const file = path.join(ctx.root, 'series', slug, 'characters.png');
  const b = [[btn(fs.existsSync(file) ? '🔁 Vẽ lại bảng nhân vật' : '🎨 Vẽ bảng nhân vật', `vnv:${k}`)]];
  if (!s.characters) return reply(chatId, `${s.name}: series không có nhân vật.`);
  if (!fs.existsSync(file)) return reply(chatId, `${s.name}: ${names}\nChưa có bảng nhân vật.`, b);
  const extra = { caption: `${s.name} — ${names}`.slice(0, 1000), ...markup(b) };
  // ảnh quá rộng/quá lớn cho sendPhoto → gửi dạng file
  await sendFile('sendPhoto', 'photo', chatId, file, extra, 'nhan-vat.png', 'image/png').catch(() => sendFile('sendDocument', 'document', chatId, file, extra, 'nhan-vat.png', 'image/png'));
}

async function startEpisodes(chatId, slug, list, action) {
  if (!list.length) return reply(chatId, 'Ghi số tập, ví dụ: /dungphim 11');
  if (action === 'render' && list.length > 1) {
    const r = await local('POST', `/api/series/${slug}/queue`, { episodes: list });
    return reply(chatId, `Đã xếp ${r.added} tập vào hàng đợi.${r.job?.status === 'running' ? ` Đang chạy: ${r.job.label}${r.job.episode ? ` · tập ${r.job.episode}` : ''}.` : ''} Xong từng tập sẽ báo.`);
  }
  const r = await local('POST', `/api/series/${slug}/jobs`, { action, episode: list[0] });
  if (r.queued) return reply(chatId, `Máy đang bận — đã xếp tập ${list[0]} vào hàng đợi (vị trí ${r.queued}). Xong sẽ báo.`);
  return reply(chatId, `▶ ${r.job.label} · tập ${list[0]} — xong sẽ báo.`);
}
// việc AI (kế hoạch / kịch bản / sửa): máy bận thì máy chủ trả 409 → báo lại
async function startAi(chatId, slug, action, n, feedback = '') {
  const r = await local('POST', `/api/series/${slug}/jobs`, { action, ...(n ? { episode: n } : {}), ...(feedback ? { feedback } : {}) });
  return reply(chatId, `▶ ${r.job.label}${n ? ` · tập ${n}` : ''} — AI đang làm (thường vài phút), xong sẽ báo.`);
}

// ───────── chờ người dùng nhắn chữ (góp ý, lưu ý, các bước tạo series) — theo từng chat, hết hạn sau 30 phút
const waiting = new Map();
const ask = (chatId, st) => waiting.set(chatId, { ...st, at: Date.now() });
const waitingFor = (chatId) => { const w = waiting.get(chatId); if (w && Date.now() - w.at > 30 * 60000) { waiting.delete(chatId); return null; } return w ?? null; };

async function onText(chatId, text) {
  const w = waitingFor(chatId);
  if (!w) return reply(chatId, 'Gõ /giup để xem các lệnh.');
  const t = text.trim();
  if (!t) return;
  if (w.kind === 'fix') { waiting.delete(chatId); return startAi(chatId, w.slug, 'fix', w.n, t); }
  if (w.kind === 'note') { waiting.delete(chatId); return startAi(chatId, w.slug, 'script', w.n, t); }
  if (w.kind === 'planfb') { waiting.delete(chatId); return startAi(chatId, w.slug, 'plan', null, t); }
  if (w.kind === 'new') return newSeriesStep(chatId, w, t);
  if (w.kind === 'sharecap') { waiting.delete(chatId); const d = drafts.get(chatId); if (!d) return reply(chatId, 'Phiên đăng bài đã hết — /dang <số tập> để làm lại.'); d.caption = t.slice(0, 5000); d.ver = 'own'; return shareView(chatId, d.slug, d.n); }
  if (w.kind === 'sharetime') {
    const at = parseWhen(t);
    if (!at || at < Date.now() + 60000) return reply(chatId, 'Không hiểu giờ hoặc giờ đã qua. Nhắn ví dụ: 19:30 hoặc 19:30 28/11. /huybo để thôi.');
    waiting.delete(chatId);
    return shareConfirm(chatId, at);
  }
}

// ───────── tạo series mới — hai cách:
//   mới hoàn toàn: tên → ý tưởng → số tập → thời lượng → dàn nhân vật (nhân viên MISA áo polo vàng / văn phòng / không nhân vật)
//   nhân bản: chọn series có sẵn (giữ nhân vật, giọng, màu, nhạc, watermark) → tên → ý tưởng → số tập → thời lượng
// Dàn nhân vật mặc định giống form trên trang web (2 người, có nam có nữ); muốn chỉnh chi tiết thì sửa đề bài trên trang.
const CASTS = {
  misa: {
    label: '👕 Nhân viên MISA (áo polo vàng)', desc: 'nhân viên MISA mặc áo polo vàng có logo MISA',
    characters: [
      { name: 'Minh', gender: 'nam', kind: 'misa', hair: 'ngan', role: 'nhân viên MISA, người dẫn chuyện' },
      { name: 'Lan', gender: 'nu', kind: 'misa', hair: 'buoc', role: 'đồng nghiệp, hay gặp tình huống' },
    ],
  },
  vp: {
    label: '👔 Dân văn phòng (sơ mi, vest)', desc: 'nhân viên văn phòng mặc sơ mi / vest',
    characters: [
      { name: 'Minh', gender: 'nam', kind: 'so-mi', hair: 'ngan', role: 'nhân viên văn phòng, người dẫn chuyện' },
      { name: 'Lan', gender: 'nu', kind: 'blazer-nu', hair: 'buoc', role: 'đồng nghiệp, hay gặp tình huống' },
    ],
  },
  khong: { label: '🚫 Không dùng nhân vật', desc: 'không có nhân vật (chữ, biểu tượng, hình minh hoạ)', characters: [] },
};
function startNew(chatId) {
  ask(chatId, { kind: 'new', step: 'name', data: {} });
  return reply(chatId, 'Tạo series mới hoàn toàn. Tên series là gì? (/huybo để thôi)');
}
async function newSeriesStep(chatId, w, input) {
  const d = w.data;
  if (w.step === 'type') return reply(chatId, 'Bấm "Tạo mới hoàn toàn" hoặc "Nhân bản" ở tin trên (hoặc /huybo).');
  if (w.step === 'src') return reply(chatId, 'Bấm chọn một series ở tin trên để lấy nhân vật (hoặc /huybo).');
  if (w.step === 'cast') return reply(chatId, 'Bấm chọn dàn nhân vật ở tin trên (hoặc /huybo).');
  if (w.step === 'name') {
    d.name = input.slice(0, 80);
    ask(chatId, { ...w, step: 'idea' });
    return reply(chatId, `Tên: ${d.name}\n\nÝ tưởng / chủ đề của series là gì? Nhắn càng rõ càng tốt (khán giả, thông điệp, các tình huống muốn có…).`);
  }
  if (w.step === 'idea') {
    d.idea = input.slice(0, 4000);
    ask(chatId, { ...w, step: 'eps' });
    return reply(chatId, 'Bao nhiêu tập? (bấm hoặc nhắn số 1–30)', [[3, 5, 7, 10].map((x) => btn(`${x} tập`, `ne:${x}`))]);
  }
  if (w.step === 'eps') {
    const x = Math.floor(+input);
    if (!(x >= 1 && x <= 30)) return reply(chatId, 'Nhắn một số từ 1 đến 30.');
    return setEps(chatId, w, x);
  }
  if (w.step === 'dur') {
    const x = Math.floor(+input.replace(/[^\d]/g, ''));
    if (!(x >= 20 && x <= 300)) return reply(chatId, 'Nhắn số giây từ 20 đến 300.');
    return setDur(chatId, w, x);
  }
  if (w.step === 'ok') return reply(chatId, 'Bấm "Tạo" ở tin trên, hoặc /huybo để thôi.');
}
function setEps(chatId, w, x) {
  w.data.episodes = x;
  ask(chatId, { ...w, step: 'dur' });
  return reply(chatId, 'Mỗi tập dài khoảng bao nhiêu giây? (bấm hoặc nhắn số 20–300)', [[45, 60, 90, 120].map((s) => btn(`${s} giây`, `nd:${s}`))]);
}
function setDur(chatId, w, x) {
  w.data.duration = x;
  if (w.data.from) return confirmNew(chatId, w);
  ask(chatId, { ...w, step: 'cast' });
  return reply(chatId, 'Dàn nhân vật? (2 người, một nam một nữ — đổi tên, thêm người, đổi trang phục sau trên trang web)', Object.entries(CASTS).map(([k, c]) => [btn(c.label, `nc:${k}`)]));
}
function confirmNew(chatId, w) {
  const d = w.data;
  ask(chatId, { ...w, step: 'ok' });
  const cast = d.from ? `• Nhân vật, giọng, màu, nhạc: giữ như "${d.fromName}"` : `• Nhân vật: ${CASTS[d.cast].desc}${CASTS[d.cast].characters.length ? ` — ${CASTS[d.cast].characters.map((c) => c.name).join(', ')}` : ''}`;
  return reply(chatId, [d.from ? 'Tạo series mới (nhân bản):' : 'Tạo series mới hoàn toàn:', `• Tên: ${d.name}`, `• Ý tưởng: ${d.idea.slice(0, 500)}`, `• ${d.episodes} tập × ${d.duration} giây`, cast, '', 'Tạo xong xưởng tự lập kế hoạch các tập để bạn duyệt.'].join('\n'), [[btn('✅ Tạo và lập kế hoạch', 'nok'), btn('✖️ Thôi', 'nno')]]);
}
async function createSeries(chatId, w) {
  const d = w.data;
  waiting.delete(chatId);
  const base = { name: d.name, idea: d.idea, episodes: d.episodes, duration: d.duration };
  const cast = CASTS[d.cast] ?? CASTS.misa;
  const { slug } = d.from
    ? await local('POST', `/api/series/${d.from}/clone`, base)
    : await local('POST', '/api/series', { ...base, characterMode: cast.characters.length ? 'dong-nhat' : 'khong', characters: cast.characters });
  update({ series: slug });
  await reply(chatId, `✓ Đã tạo series "${d.name}" và chọn làm series đang làm việc.${!d.from && cast.characters.length ? ' Bảng nhân vật: /nhanvat (vẽ sau khi lập kế hoạch xong).' : ''}`);
  try { await startAi(chatId, slug, 'plan', null); }
  catch (e) { await reply(chatId, `Chưa lập kế hoạch được: ${e.message}`, [[btn('🧠 Lập kế hoạch', `lap:${sk(slug)}`)]]); }
}

async function command(chatId, text) {
  const m = /^\/([a-z_]+)(?:@\w+)?\s*([\s\S]*)$/i.exec(text.trim());
  if (!m) return reply(chatId, 'Gõ /giup để xem các lệnh.');
  const cmd = m[1].toLowerCase(), args = m[2].trim();
  switch (cmd) {
    case 'start': case 'giup': case 'help': return reply(chatId, HELP);
    case 'trangthai': case 'status': return reply(chatId, await statusText());
    case 'hang': return reply(chatId, queueText((await local('GET', '/api/job')).queue));
    case 'series': {
      const list = await seriesList();
      const cur = read().series;
      return reply(chatId, list.length ? `Series đang chọn: ${list.find((s) => s.slug === cur)?.name ?? '(chưa chọn)'}\nBấm để chọn:` : 'Chưa có series nào — /seriesmoi để tạo.', seriesButtons(list));
    }
    case 'kehoach': { const s = await activeSeries(chatId); return s && planView(chatId, s.slug); }
    case 'tap': case 'storyboard': {
      const s = await activeSeries(chatId);
      if (!s) return;
      const n = nums(args)[0];
      return n ? episodeView(chatId, s.slug, n) : episodesView(chatId, s.slug);
    }
    case 'nhanvat': { const s = await activeSeries(chatId); return s && charactersView(chatId, s.slug); }
    // không nhận "/dung" — dễ hiểu nhầm "dựng" với "dừng"
    case 'dungphim': { const s = await activeSeries(chatId); return s && startEpisodes(chatId, s.slug, nums(args), 'render'); }
    case 'suagiong': { const s = await activeSeries(chatId); return s && startEpisodes(chatId, s.slug, nums(args).slice(0, 1), 'voicefix'); }
    case 'gopy': {
      const s = await activeSeries(chatId);
      if (!s) return;
      const g = /^(\d{1,2})(?:\s+([\s\S]+))?$/.exec(args);
      if (!g) return reply(chatId, 'Cách dùng: /gopy 11 nội dung góp ý — hoặc /gopy 11 rồi nhắn góp ý ở tin sau. AI sửa kịch bản tập 11, rồi dựng lại nếu tập đã có phim.');
      if (g[2]) return startAi(chatId, s.slug, 'fix', +g[1], g[2]);
      ask(chatId, { kind: 'fix', slug: s.slug, n: +g[1] });
      return reply(chatId, `Nhắn góp ý cho tập ${g[1]} (cảnh nào, câu nào cần sửa…). /huybo để thôi.`);
    }
    case 'xem': {
      const s = await activeSeries(chatId);
      const n = nums(args)[0];
      if (!s) return;
      if (!n) return reply(chatId, 'Ghi số tập, ví dụ: /xem 11');
      return sendVideo(chatId, s.slug, n);
    }
    case 'duyetkb': {
      const s = await activeSeries(chatId);
      return s ? reviewView(chatId, s.slug) : undefined;
    }
    case 'baidang': {
      const s = await activeSeries(chatId);
      const n = nums(args)[0];
      if (!s) return;
      if (!n) return reply(chatId, 'Ghi số tập, ví dụ: /baidang 11 — AI viết bài ngắn (dưới 100 từ) và bài dài (dưới 300 từ) theo kịch bản tập đó.');
      return postView(chatId, s.slug, n);
    }
    case 'dang': {
      const s = await activeSeries(chatId);
      const n = nums(args)[0];
      if (!s) return;
      if (!n) return reply(chatId, 'Ghi số tập, ví dụ: /dang 11 — chọn kênh, duyệt nội dung rồi đăng ngay hoặc hẹn giờ.');
      return shareView(chatId, s.slug, n, { fresh: true });
    }
    case 'lichdang': return scheduleList(chatId);
    case 'seriesmoi': {
      if (!(await seriesList()).length) return startNew(chatId);
      ask(chatId, { kind: 'new', step: 'type', data: {} });
      return reply(chatId, 'Tạo series mới — làm từ đầu, hay nhân bản một series có sẵn? (/huybo để thôi)', [[btn('✨ Tạo mới hoàn toàn', 'nm')], [btn('📑 Nhân bản series có sẵn (giữ nhân vật, giọng, màu, nhạc)', 'nb')]]);
    }
    case 'huybo': return reply(chatId, waiting.delete(chatId) ? 'Đã thôi.' : 'Không có gì đang chờ.');
    case 'huy': {
      const { job } = await local('GET', '/api/job');
      if (job?.status !== 'running') return reply(chatId, 'Không có việc nào đang chạy.');
      await local('POST', '/api/job/stop', {});
      return reply(chatId, `■ Đã dừng: ${job.label}${job.episode ? ` · tập ${job.episode}` : ''}. Hàng đợi tạm dừng — /tieptuc để chạy tiếp.`);
    }
    case 'tieptuc': {
      const r = await local('POST', '/api/queue/resume', {});
      return reply(chatId, r.job?.status === 'running' ? `▶ Đang chạy: ${r.job.label}${r.job.episode ? ` · tập ${r.job.episode}` : ''}` : r.queue.items.length ? 'Đã chạy tiếp hàng đợi.' : 'Hàng đợi trống.');
    }
    default: return reply(chatId, `Không có lệnh /${cmd}. Gõ /giup để xem các lệnh.`);
  }
}

async function callback(q) {
  const chatId = q.message?.chat?.id;
  await call('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
  const [act, a, b, c4] = String(q.data ?? '').split(':');
  // nút theo mã bài đăng (lịch đăng): đăng ngay / huỷ
  if (act === 'pdn' || act === 'pdx') {
    try {
      if (act === 'pdn') { const r = await local('PUT', `/api/social/posts/${a}`, { at: null }); return reply(chatId, `🚀 Đang đăng lên ${KIND_T[r.post.kind]} · ${r.post.destName} — xong sẽ báo.`); }
      await local('DELETE', `/api/social/posts/${a}`);
      return reply(chatId, 'Đã huỷ / bỏ bài này.');
    } catch (e) { return reply(chatId, e.message); }
  }
  // bước tạo series không mang mã series
  if (['nm', 'nb', 'nc', 'ne', 'nd', 'nok', 'nno'].includes(act)) {
    const w = waitingFor(chatId);
    if (w?.kind !== 'new') return reply(chatId, 'Phiên tạo series đã hết — gõ /seriesmoi để làm lại.');
    if (act === 'nno') { waiting.delete(chatId); return reply(chatId, 'Đã thôi tạo series.'); }
    if (act === 'nm') return startNew(chatId);
    if (act === 'nb') { ask(chatId, { ...w, step: 'src' }); return reply(chatId, 'Giữ nhân vật, giọng đọc, bộ màu, nhạc, watermark của series nào?', seriesButtons(await seriesList(), 'ns')); }
    if (act === 'nc') { if (w.step !== 'cast' || !CASTS[a]) return; w.data.cast = a; return confirmNew(chatId, w); }
    if (act === 'nok' && w.step !== 'ok') return reply(chatId, 'Chưa đủ thông tin — làm tiếp các bước ở trên.');
    if (act === 'ne') return setEps(chatId, w, +a);
    if (act === 'nd') return setDur(chatId, w, +a);
    return createSeries(chatId, w);
  }
  const s = await bySk(a);
  if (!s) return reply(chatId, 'Không còn series này.');
  const slug = s.slug, n = +b || 0;
  switch (act) {
    case 'chon': update({ series: slug }); await reply(chatId, `Đã chọn: ${s.name}`); return episodesView(chatId, slug);
    case 'ns': {
      const w = waitingFor(chatId);
      if (w?.kind !== 'new') return reply(chatId, 'Phiên tạo series đã hết — gõ /seriesmoi để làm lại.');
      w.data.from = slug; w.data.fromName = s.name;
      ask(chatId, { ...w, step: 'name' });
      return reply(chatId, `Giữ nhân vật của "${s.name}". Tên series mới là gì?`);
    }
    case 'kh': return planView(chatId, slug);
    case 'ep': update({ series: slug }); return episodeView(chatId, slug, n);
    case 'sb': { const e = (await seriesFull(slug)).episodes.find((x) => x.number === n); return e ? sendBoard(chatId, slug, e) : null; }
    case 'kb': return sendScript(chatId, slug, n);
    case 'xem': return sendVideo(chatId, slug, n);
    case 'bd': return postView(chatId, slug, n);
    case 'dkl': return reviewView(chatId, slug);
    case 'xkb': return reviewEpisode(chatId, slug, n);
    case 'dk': return approveScripts(chatId, slug, [n]);
    case 'dka': { const s2 = await seriesFull(slug); const nums = needFilm(s2).filter((e) => !e.scriptOk).map((e) => e.number); return nums.length ? approveScripts(chatId, slug, nums) : reviewView(chatId, slug); }
    case 'sxa': return produce(chatId, slug, false);
    case 'sxo': return produce(chatId, slug, true);
    case 'vka': return writeAll(chatId, slug);
    case 'ep0': return reply(chatId, 'Được rồi. Khi nào muốn sản xuất, gõ /duyetkb.');
    case 'bdv': return postView(chatId, slug, n, true);
    case 'dmx': return shareView(chatId, slug, n, { fresh: true });
    case 'dmb': return shareView(chatId, slug, n);
    case 'dmt': case 'dmc': case 'dmp': {
      const d = drafts.get(chatId);
      if (!d || d.slug !== slug || d.n !== n) return shareView(chatId, slug, n, { fresh: true });
      if (act === 'dmt') { const { dests: D } = await local('GET', '/api/social'); const x = D[+c4]; if (x) d.sel = d.sel.includes(x.id) ? d.sel.filter((y) => y !== x.id) : [...d.sel, x.id]; }
      if (act === 'dmc') { const p = (await seriesFull(slug)).episodes.find((x) => x.number === n)?.post; const v = c4 === 'l' ? 'long' : 'short'; if (p?.[v]) { d.caption = p[v]; d.ver = v; } }
      if (act === 'dmp') d.tt = TT_P[+c4]?.[0] ?? d.tt;
      return shareView(chatId, slug, n, { msgId: q.message?.message_id });
    }
    case 'dme': { if (!drafts.get(chatId)) return shareView(chatId, slug, n, { fresh: true }); ask(chatId, { kind: 'sharecap' }); return reply(chatId, 'Nhắn nội dung đăng mới (thay toàn bộ nội dung hiện tại). /huybo để thôi.'); }
    case 'dmh': ask(chatId, { kind: 'sharetime' }); return reply(chatId, 'Đăng lúc mấy giờ? Nhắn ví dụ: 19:30 (hôm nay, qua giờ thì mai) hoặc 19:30 28/11. /huybo để thôi.');
    case 'dmn': return shareConfirm(chatId, null);
    case 'dmy': return shareGo(chatId);
    case 'nv': return charactersView(chatId, slug);
    case 'vnv': { const r = await local('POST', `/api/series/${slug}/jobs`, { action: 'characters' }); return reply(chatId, `▶ ${r.job.label} — xong sẽ báo.`); }
    case 'dp': return startEpisodes(chatId, slug, [n], 'render');
    case 'sg': return startEpisodes(chatId, slug, [n], 'voicefix');
    case 'dy': case 'dyall': {
      const full = await seriesFull(slug);
      const pick = act === 'dy' ? [n] : full.episodes.filter((e) => !e.approved).map((e) => e.number);
      if (!pick.length) return reply(chatId, 'Không còn tập nào chờ duyệt.');
      await local('POST', `/api/series/${slug}/approve`, { episodes: pick });
      return reply(chatId, `✅ Đã duyệt ${pick.length === 1 ? `tập ${pick[0]}` : `${pick.length} tập (${pick.join(', ')})`}. Bước tiếp: viết kịch bản + storyboard (mỗi lần một tập).`, [[btn(`✍️ Viết kịch bản tập ${pick[0]}`, `vk:${a}:${pick[0]}`)]]);
    }
    case 'vk': return startAi(chatId, slug, 'script', n);
    case 'lap': return startAi(chatId, slug, 'plan', null);
    case 'vkn': ask(chatId, { kind: 'note', slug, n }); return reply(chatId, `Nhắn lưu ý cho tập ${n} (AI đọc trước khi viết). /huybo để thôi.`);
    case 'gy': ask(chatId, { kind: 'fix', slug, n }); return reply(chatId, `Nhắn góp ý cho tập ${n}: cảnh nào, câu nào cần sửa… AI sửa xong${(await seriesFull(slug)).episodes.find((e) => e.number === n)?.mp4 ? ' sẽ dựng lại phim' : ' sẽ vẽ lại storyboard'}. /huybo để thôi.`);
    case 'gyk': ask(chatId, { kind: 'planfb', slug }); return reply(chatId, 'Nhắn góp ý / lưu ý cho kế hoạch (thêm bớt tập, đổi góc nhìn, thứ tự…). Tập đã duyệt hoặc đã có kịch bản được giữ nguyên trừ khi bạn yêu cầu đổi. /huybo để thôi.');
    default: return reply(chatId, 'Nút này không còn dùng được.');
  }
}

async function handle(u) {
  const c = read();
  const msg = u.message, q = u.callback_query;
  const chatId = msg?.chat?.id ?? q?.message?.chat?.id;
  if (!chatId) return;
  if (!c.chatId) {
    // chưa liên kết: chỉ nhận "/start <mã>" (hoặc gõ thẳng mã) từ chat riêng
    if (msg?.chat?.type !== 'private') return;
    const code = /(\d{6})/.exec(msg.text ?? '')?.[1];
    if (code && code === c.code) {
      update({ chatId, chatName: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || '', code: '' });
      return reply(chatId, `✓ Đã liên kết với Xưởng phim trên máy ${os.hostname()}. Từ giờ xong / lỗi sẽ báo vào đây.\n\n${HELP}`);
    }
    return reply(chatId, 'Gửi mã liên kết 6 số hiện ở trang Thiết lập của Xưởng phim (ví dụ: /start 123456).');
  }
  if (chatId !== c.chatId) return msg?.chat?.type === 'private' ? reply(chatId, 'Đây là bot riêng — không nhận lệnh từ tài khoản này.') : undefined;
  try {
    if (q) return await callback(q);
    if (msg?.text?.startsWith('/')) return await command(chatId, msg.text);
    if (msg?.text) return await onText(chatId, msg.text);
  } catch (e) {
    return reply(chatId, `✗ ${e.message}`);
  }
}

async function loop(my) {
  polling = true;
  let wait = 0;
  while (my === gen) {
    const c = read();
    if (!c.token) break;
    abort = new AbortController();
    try {
      const ups = await fetch(`${BASE}/bot${c.token}/getUpdates`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ offset: c.offset || undefined, timeout: 50, allowed_updates: ['message', 'callback_query'] }),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(65000)]),
      }).then(async (r) => { const j = await r.json(); if (!j.ok) throw new TgError(j.description, j.error_code); return j.result; });
      if (my !== gen) break;
      for (const u of ups) {
        update({ offset: u.update_id + 1 }); // ghi trước khi xử lý → lệnh lỗi không bị chạy lại mãi
        handle(u).catch((e) => { lastError = e.message; });
      }
      lastError = ''; wait = 0;
    } catch (e) {
      if (my !== gen) break;
      if (e.code === 401 || e.code === 404) { lastError = 'Mã bot không còn hiệu lực — nhập lại mã ở trang Thiết lập.'; break; }
      lastError = e.code === 409 ? 'Có chương trình khác đang dùng bot này (vd Xưởng phim trên máy khác) — mỗi bot chỉ một máy.' : `Mất kết nối Telegram: ${e.message}`;
      wait = Math.min(60000, wait ? wait * 2 : 3000);
      await sleep(e.code === 409 ? 30000 : wait, abort.signal);
    }
  }
  if (my === gen) polling = false;
}

function restart() {
  gen++; abort?.abort();
  if (read().token) loop(gen);
}

// gọi một lần khi máy chủ mở; cập nhật danh sách lệnh (menu "/") theo bản mã hiện tại
export function init({ port, root }) {
  ctx = { port, root };
  if (read().token) call('setMyCommands', { commands: COMMANDS.map(([command, description]) => ({ command, description })) }).catch(() => {});
  restart();
}
