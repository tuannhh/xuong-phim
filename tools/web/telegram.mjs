// Bot Telegram của Xưởng phim: báo lên điện thoại khi dựng xong / lỗi, và nhận lệnh từ xa (dựng, sửa giọng, xem phim…).
// Máy chủ tự hỏi Telegram có tin mới không (getUpdates, long polling) → không cần mở cổng, không cần IP tĩnh.
// Cấu hình lưu theo MÁY ở ~/.config/xuong-phim/telegram.json (ngoài repo, chứa mã bot — không đưa lên GitHub):
//   { token, botName, chatId, chatName, code, series, notify: { done, error, boot }, offset }
// Liên kết: người dùng gửi "/start <mã 6 số>" (mã hiện ở trang Thiết lập) → chat đó thành chủ bot; chat khác bị bỏ qua.
// Lệnh gọi lại chính API của máy chủ (http://127.0.0.1:<cổng>, header x-xuong) → dùng chung mọi kiểm tra / hàng đợi với trang web.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
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
  await call('setMyCommands', { commands: COMMANDS.map(([command, description]) => ({ command, description })) }).catch(() => {});
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

// ───────── gửi tin
export async function send(text, buttons = null) {
  const c = read();
  if (!c.token || !c.chatId) return false;
  try {
    await call('sendMessage', { chat_id: c.chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true, ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}) });
    return true;
  } catch (e) { lastError = `Gửi tin lỗi: ${e.message}`; return false; }
}
const reply = (chatId, text, buttons = null) => call('sendMessage', { chat_id: chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true, ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}) }).catch((e) => { lastError = `Gửi tin lỗi: ${e.message}`; });

export async function sendTest() {
  const c = read();
  if (!c.chatId) throw new TgError('Chưa liên kết — mở bot trên Telegram và gửi mã liên kết trước.', 400);
  await call('sendMessage', { chat_id: c.chatId, text: `✓ Xưởng phim trên máy ${os.hostname()} gửi thử. Gõ /giup để xem các lệnh.` });
  return status();
}

const dur = (ms) => { const s = Math.round(ms / 1000); return s < 60 ? `${s} giây` : `${Math.floor(s / 60)} phút ${s % 60} giây`; };

// máy chủ gọi khi một việc kết thúc. info = { job (jobView), title, queueLeft, queueEnded }
export function jobFinished({ job: j, title, queueLeft = 0, queueEnded = false, log = [] }) {
  const c = read();
  if (!c.token || !c.chatId || !j) return;
  const n = { ...NOTIFY_DEFAULT, ...c.notify };
  if (j.status === 'done' && !n.done) return;
  if (j.status === 'error' && !n.error) return;
  if (j.status === 'stopped') return; // chính người dùng bấm dừng
  const head = j.status === 'done' ? '✅' : '❌';
  const lines = [`${head} ${j.label}${j.status === 'done' ? ' xong' : ' bị lỗi'} — ${dur((j.ended || Date.now()) - j.started)}`];
  if (title) lines.push(title);
  if (j.summary) lines.push('', j.summary.slice(0, 600));
  if (j.status === 'error') {
    if (j.hint) lines.push('', `Gợi ý: ${j.hint}`);
    const tail = log.filter((l) => typeof l === 'string').slice(-6);
    if (tail.length) lines.push('', ...tail.map((l) => l.slice(0, 200)));
  }
  if (queueLeft) lines.push('', `Còn ${queueLeft} tập trong hàng đợi.`);
  else if (queueEnded) lines.push('', 'Hàng đợi đã dựng xong hết.');
  const buttons = [];
  if (j.slug && j.episode) {
    if (j.status === 'done' && ['render', 'voicefix', 'fix'].includes(j.action)) buttons.push([{ text: '🎬 Xem phim', callback_data: `xem:${j.slug}:${j.episode}` }]);
    if (j.status === 'error' && ['render', 'voicefix'].includes(j.action)) buttons.push([{ text: '🔁 Dựng lại', callback_data: `dp:${j.slug}:${j.episode}` }]);
  }
  send(lines.join('\n'), buttons.length ? buttons : null);
}

export function bootNotice() {
  const c = read();
  if (c.chatId && { ...NOTIFY_DEFAULT, ...c.notify }.boot) send(`🟢 Xưởng phim đã chạy trên máy ${os.hostname()} (${new Date().toLocaleString('vi-VN')}).`);
}

// ───────── gọi API của chính máy chủ
async function local(method, p, body) {
  const r = await fetch(`http://127.0.0.1:${ctx.port}${p}`, { method, headers: method === 'GET' ? {} : { 'content-type': 'application/json', 'x-xuong': '1' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new TgError(j.error || `Lỗi ${r.status}`, r.status);
  return j;
}

const COMMANDS = [
  ['trangthai', 'Máy đang làm gì'],
  ['series', 'Danh sách series, chọn series để ra lệnh'],
  ['tap', 'Các tập của series đang chọn'],
  ['dungphim', 'Dựng phim: /dungphim 11 (nhiều tập: /dungphim 3 4 5)'],
  ['suagiong', 'Chỉ sửa giọng: /suagiong 11'],
  ['gopy', 'Sửa tập theo góp ý: /gopy 11 nội dung góp ý'],
  ['xem', 'Gửi phim về điện thoại: /xem 11'],
  ['hang', 'Hàng đợi dựng phim'],
  ['tieptuc', 'Chạy tiếp hàng đợi'],
  ['huy', 'Dừng việc đang chạy (tạm dừng hàng đợi)'],
  ['giup', 'Danh sách lệnh'],
];
const HELP = ['Các lệnh của Xưởng phim:', ...COMMANDS.map(([c, d]) => `/${c} — ${d}`), '', 'Lệnh theo tập dùng series đang chọn (/series để đổi).'].join('\n');

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
  const list = await local('GET', '/api/series');
  const cur = read().series;
  const s = list.find((x) => x.slug === cur) ?? (list.length === 1 ? list[0] : null);
  if (!s) { await reply(chatId, list.length ? 'Chọn series trước:' : 'Chưa có series nào.', seriesButtons(list)); return null; }
  return s;
}
const seriesButtons = (list) => list.slice(0, 20).map((s) => [{ text: `${s.name} (${s.done}/${s.episodes} tập đã dựng)`, callback_data: `chon:${s.slug}`.slice(0, 64) }]);
const nums = (args) => [...new Set(args.split(/[\s,]+/).filter(Boolean).map(Number))].filter((n) => Number.isInteger(n) && n > 0 && n < 100);

async function episodesText(slug) {
  const s = await local('GET', `/api/series/${slug}`);
  const rows = s.episodes.map((e) => `${e.mp4 ? (e.stale ? '🟡' : '🎬') : e.scenes ? '📝' : '·'} ${e.number}. ${e.title ?? ''}${e.seconds ? ` (${Math.round(e.seconds)}s)` : ''}${e.stale ? ' — kịch bản đã sửa, chưa dựng lại' : ''}`);
  return [`${s.name}`, ...rows, '', '🎬 đã dựng · 📝 có kịch bản · 🟡 cần dựng lại'].join('\n');
}

async function sendVideo(chatId, slug, n) {
  const s = await local('GET', `/api/series/${slug}`);
  const e = s.episodes.find((x) => x.number === n);
  if (!e) return reply(chatId, `Series này không có tập ${n}.`);
  if (!e.mp4) return reply(chatId, `Tập ${n} chưa dựng phim.`, [[{ text: '▶ Dựng tập này', callback_data: `dp:${slug}:${n}` }]]);
  const file = path.join(ctx.root, 'series', slug, 'episodes', e.id, 'out', `${e.id}.mp4`);
  const size = fs.statSync(file).size;
  const caption = `${s.name} · Tập ${n}${e.title ? `: ${e.title}` : ''}`;
  if (size > VIDEO_MAX) return reply(chatId, `${caption}\nPhim nặng ${(size / 1048576).toFixed(0)} MB, quá giới hạn 50 MB của bot Telegram.${e.drive?.link ? `\nXem trên Google Drive: ${e.drive.link}` : ''}`);
  await call('sendChatAction', { chat_id: chatId, action: 'upload_video' }).catch(() => {});
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('caption', caption);
  form.append('supports_streaming', 'true');
  form.append('video', await fs.openAsBlob(file, { type: 'video/mp4' }), `${e.id}.mp4`);
  await call('sendVideo', {}, { form, timeout: 10 * 60000 });
}

async function startEpisodes(chatId, slug, list, action) {
  if (!list.length) return reply(chatId, 'Ghi số tập, ví dụ: /dungphim 11');
  if (action === 'render' && list.length > 1) {
    const r = await local('POST', `/api/series/${slug}/queue`, { episodes: list });
    return reply(chatId, `Đã xếp ${r.added} tập vào hàng đợi.${r.job?.status === 'running' ? ` Đang chạy: ${r.job.label}${r.job.episode ? ` · tập ${r.job.episode}` : ''}.` : ''}`);
  }
  const r = await local('POST', `/api/series/${slug}/jobs`, { action, episode: list[0] });
  if (r.queued) return reply(chatId, `Máy đang bận — đã xếp tập ${list[0]} vào hàng đợi (vị trí ${r.queued}). Xong sẽ báo.`);
  return reply(chatId, `▶ ${r.job.label} · tập ${list[0]} — xong sẽ báo.`);
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
      const list = await local('GET', '/api/series');
      const cur = read().series;
      return reply(chatId, list.length ? `Series đang chọn: ${list.find((s) => s.slug === cur)?.name ?? '(chưa chọn)'}\nBấm để chọn:` : 'Chưa có series nào.', seriesButtons(list));
    }
    case 'tap': { const s = await activeSeries(chatId); return s && reply(chatId, await episodesText(s.slug)); }
    // không nhận "/dung" — dễ hiểu nhầm "dựng" với "dừng"
    case 'dungphim': { const s = await activeSeries(chatId); return s && startEpisodes(chatId, s.slug, nums(args), 'render'); }
    case 'suagiong': { const s = await activeSeries(chatId); return s && startEpisodes(chatId, s.slug, nums(args).slice(0, 1), 'voicefix'); }
    case 'gopy': {
      const g = /^(\d{1,2})\s+([\s\S]+)$/.exec(args);
      if (!g) return reply(chatId, 'Cách dùng: /gopy 11 nội dung góp ý (AI sẽ sửa kịch bản tập 11, rồi dựng lại nếu tập đã có phim).');
      const s = await activeSeries(chatId);
      if (!s) return;
      const r = await local('POST', `/api/series/${s.slug}/jobs`, { action: 'fix', episode: +g[1], feedback: g[2] });
      return reply(chatId, `▶ ${r.job.label} · tập ${g[1]} — AI đang sửa (thường vài phút), xong sẽ báo.`);
    }
    case 'xem': {
      const s = await activeSeries(chatId);
      const n = nums(args)[0];
      if (!s) return;
      if (!n) return reply(chatId, 'Ghi số tập, ví dụ: /xem 11');
      return sendVideo(chatId, s.slug, n);
    }
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
  const [act, slug, n] = String(q.data ?? '').split(':');
  if (act === 'chon') {
    const list = await local('GET', '/api/series');
    const s = list.find((x) => x.slug === slug);
    if (!s) return reply(chatId, 'Không còn series này.');
    update({ series: slug });
    return reply(chatId, `Đã chọn: ${s.name}\n\n${await episodesText(slug)}`);
  }
  if (act === 'xem') return sendVideo(chatId, slug, +n);
  if (act === 'dp') return startEpisodes(chatId, slug, [+n], 'render');
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
      return reply(chatId, `✓ Đã liên kết với Xưởng phim trên máy ${os.hostname()}. Từ giờ dựng xong / lỗi sẽ báo vào đây.\n\n${HELP}`);
    }
    return reply(chatId, 'Gửi mã liên kết 6 số hiện ở trang Thiết lập của Xưởng phim (ví dụ: /start 123456).');
  }
  if (chatId !== c.chatId) return msg?.chat?.type === 'private' ? reply(chatId, 'Đây là bot riêng — không nhận lệnh từ tài khoản này.') : undefined;
  try {
    if (q) return await callback(q);
    if (msg?.text) return await command(chatId, msg.text);
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

// gọi một lần khi máy chủ mở
export function init({ port, root }) {
  ctx = { port, root };
  restart();
}
