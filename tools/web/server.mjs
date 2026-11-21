#!/usr/bin/env node
// Trang web của Xưởng series (chạy tại máy): điền form → duyệt kế hoạch → duyệt kịch bản/storyboard → dựng phim.
//   pnpm web            → http://localhost:4710
// Phần cần sáng tác (kế hoạch, kịch bản, sửa theo góp ý) giao cho Claude Code chạy ngầm (`claude -p`, skill series — "Chế độ form").
// Phần máy móc (voice → timing → trộn âm → render) chạy thẳng `tools/ep.mjs`, không cần Claude.
// Chỉ nghe ở 127.0.0.1; mọi lệnh ghi yêu cầu header x-xuong để trang web khác không gọi lén được.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { FORMATS, PRESETS, ROOT, readJSON, writeJSON } from '../lib.mjs';
import { VIENEU } from '../voices.mjs';
import * as drive from './drive.mjs';
import { checks as doctorChecks } from '../doctor.mjs';

const PORT = +(process.env.PORT ?? 4710);
const SERIES = path.join(ROOT, 'series');
const WEB = path.join(ROOT, 'web');
const SLUG = /^[a-z0-9][a-z0-9-]{0,58}$/;
const CLAUDE = process.env.STUDIO_CLAUDE_BIN || spawnSync('which', ['claude'], { encoding: 'utf8' }).stdout.trim() || null;

// ───────── tiện ích
const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'series';
const epId = (n) => `ep${String(n).padStart(2, '0')}`;
const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const fail = (res, code, msg) => send(res, code, { error: msg });
const readBody = (req) => new Promise((ok, no) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 2e6) { no(new Error('quá lớn')); req.destroy(); } });
  req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { no(new Error('JSON không hợp lệ')); } });
});
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.srt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.wav': 'audio/wav' };
const serveFile = (req, res, file) => {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return fail(res, 404, 'không có file');
  const st = fs.statSync(file);
  const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (m) {
    const a = m[1] ? +m[1] : 0, b = m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${a}-${b}/${st.size}`, 'accept-ranges': 'bytes', 'content-length': b - a + 1 });
    return fs.createReadStream(file, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
};

// ───────── dữ liệu series
const seriesDir = (slug) => path.join(SERIES, slug);
const episodeState = (slug, e) => {
  const id = e.id ?? epId(e.number);
  const ed = path.join(seriesDir(slug), 'episodes', id);
  const has = (p) => fs.existsSync(path.join(ed, p));
  const ep = readJSON(path.join(ed, 'episode.json'), null);
  const scenes = ep?.scenes?.length ?? 0;
  const layout = readJSON(path.join(ed, 'storyboard/layout.json'), null);
  const issues = layout ? Object.entries(layout).flatMap(([k, v]) => (v ?? []).map((x) => `${k}: ${x}`)) : null;
  const board = has('storyboard') ? fs.readdirSync(path.join(ed, 'storyboard')).filter((f) => f.endsWith('.jpg')).sort() : [];
  const mp4 = has(`out/${id}.mp4`);
  const newer = (a, b) => has(a) && has(b) && fs.statSync(path.join(ed, a)).mtimeMs > fs.statSync(path.join(ed, b)).mtimeMs + 1000;
  const timed = readJSON(path.join(ed, 'build/timed.json'), null);
  return {
    number: e.number, id, title: ep?.title || e.title, logline: e.logline, hook: e.hook, beats: e.beats, visual: e.visual, cta: e.cta, duration: e.duration,
    approved: ['duyet', 'kich-ban', 'storyboard', 'voice', 'xong'].includes(e.status) || scenes > 0,
    scenes, board, issues, mp4, srt: has(`out/${id}.srt`), script: has('script.md'),
    seconds: timed ? +(timed.durationInFrames / timed.fps).toFixed(1) : null,
    stale: mp4 && newer('episode.json', `out/${id}.mp4`), // kịch bản đã sửa sau lần dựng gần nhất
    mtime: mp4 ? fs.statSync(path.join(ed, `out/${id}.mp4`)).mtimeMs : 0,
    drive: mp4 ? drive.episodeDrive(ed, id) : null,
  };
};
const seriesInfo = (slug, full = false) => {
  const dir = seriesDir(slug);
  const bible = readJSON(path.join(dir, 'bible.json'), null);
  if (!bible) return null;
  const plan = readJSON(path.join(dir, 'plan.json'), { brief: {}, episodes: [] });
  const known = new Set(plan.episodes.map((e) => e.id ?? epId(e.number)));
  // tập có thư mục nhưng chưa nằm trong kế hoạch (làm tay) vẫn hiện
  const extra = fs.existsSync(path.join(dir, 'episodes')) ? fs.readdirSync(path.join(dir, 'episodes')).filter((d) => /^ep\d+$/.test(d) && !known.has(d)).map((d) => ({ number: +d.slice(2), id: d, title: readJSON(path.join(dir, 'episodes', d, 'episode.json'), {}).title ?? d })) : [];
  const episodes = [...plan.episodes, ...extra].sort((a, b) => a.number - b.number).map((e) => episodeState(slug, e));
  const base = { slug, name: bible.name, channel: bible.channel, total: bible.episodes, format: bible.format, theme: bible.theme?.preset ?? bible.theme, characters: (bible.characters ?? []).length, planned: plan.episodes.length, done: episodes.filter((e) => e.mp4).length, episodes: episodes.length };
  if (!full) return base;
  const pic = path.join(dir, 'characters.png');
  return { ...base, bible, brief: readJSON(path.join(dir, 'brief.json'), null), episodes, charactersPng: fs.existsSync(pic) ? fs.statSync(pic).mtimeMs : 0, notes: fs.existsSync(path.join(dir, '.studio/ghi-chu.md')) ? fs.readFileSync(path.join(dir, '.studio/ghi-chu.md'), 'utf8') : '' };
};
const listSeries = () => (fs.existsSync(SERIES) ? fs.readdirSync(SERIES).filter((d) => SLUG.test(d)).map((d) => seriesInfo(d)).filter(Boolean) : []);

// form → brief.json + bible.json (+ brief.md cho người đọc)
const cleanChar = (c, i) => {
  const out = { id: slugify(c.id || c.name || `nv${i + 1}`).replace(/-/g, '') || `nv${i + 1}`, name: String(c.name || `Nhân vật ${i + 1}`).slice(0, 40), gender: c.gender === 'nu' ? 'nu' : 'nam', kind: ['misa', 'so-mi', 'vest', 'hoodie', 'ao-thun', 'cardigan'].includes(c.kind) ? c.kind : 'misa', hair: c.hair || (c.gender === 'nu' ? 'dai' : 'ngan') };
  if (out.kind !== 'misa' && /^#[0-9a-fA-F]{6}$/.test(c.outfitColor ?? '')) out.outfitColor = c.outfitColor;
  if (c.bottom === 'vay' && out.gender === 'nu') out.bottom = 'vay';
  if (/^#[0-9a-fA-F]{6}$/.test(c.hairColor ?? '')) out.hairColor = c.hairColor;
  if (c.glasses) out.glasses = true;
  if (c.age === 'trung-nien') out.age = 'trung-nien';
  if (c.villain) out.villain = true;
  if (c.voice && VIENEU[c.voice] === out.gender) out.voice = c.voice;
  if (c.geminiVoice) out.geminiVoice = c.geminiVoice;
  if (c.role) out.role = String(c.role).slice(0, 120);
  for (const k of ['beard', 'logo']) if (typeof c[k] === 'boolean') out[k] = c[k];
  for (const k of ['skin', 'bottomColor']) if (/^#[0-9a-fA-F]{6}$/.test(c[k] ?? '')) out[k] = c[k];
  return out;
};
const saveBrief = (slug, f, isNew) => {
  const dir = seriesDir(slug);
  fs.mkdirSync(path.join(dir, 'episodes'), { recursive: true });
  const mode = ['dong-nhat', 'moi-tap', 'khong'].includes(f.characterMode) ? f.characterMode : 'dong-nhat';
  const seen = new Set();
  const characters = mode === 'khong' ? [] : (f.characters ?? []).slice(0, 8).map(cleanChar).map((c) => { let id = c.id; for (let k = 2; seen.has(id); k++) id = `${c.id}${k}`; seen.add(id); return { ...c, id }; });
  const narrator = characters.find((c) => c.id === f.narrator || c.name === f.narrator)?.id ?? characters.find((c) => !c.villain)?.id ?? null;
  const brief = {
    name: String(f.name).slice(0, 80), channel: String(f.channel ?? '').slice(0, 60), idea: String(f.idea ?? ''), audience: String(f.audience ?? ''), platform: String(f.platform ?? ''),
    episodes: Math.max(1, Math.min(30, +f.episodes || 5)), duration: Math.max(20, Math.min(180, +f.duration || 60)), format: FORMATS[f.format] ? f.format : '9:16',
    theme: PRESETS[f.theme] ? f.theme : 'misa-vang', style: ['tinh-huong', 'thong-tin', 'ket-hop'].includes(f.style) ? f.style : 'tinh-huong',
    sets: (f.sets ?? []).filter((s) => ['van-phong', 'nha', 'hang-o'].includes(s)), tone: String(f.tone ?? ''), music: String(f.music ?? 'tension'),
    characterMode: mode, narrator, logo: f.logo === 'none' ? 'none' : 'misa', cta: String(f.cta ?? ''), notes: String(f.notes ?? ''),
    driveAuto: !!f.driveAuto, driveFolder: String(f.driveFolder ?? '').replace(/[\\/]+/g, ' ').trim().slice(0, 80), updated: new Date().toISOString(),
  };
  writeJSON(path.join(dir, 'brief.json'), brief);
  const old = readJSON(path.join(dir, 'bible.json'), {});
  writeJSON(path.join(dir, 'bible.json'), {
    ...old, name: brief.name, slug, channel: brief.channel, episodes: brief.episodes, format: brief.format, fps: old.fps ?? 30, engine: old.engine ?? 'remotion',
    theme: { ...(typeof old.theme === 'object' ? old.theme : {}), preset: brief.theme }, captions: old.captions ?? 'pill',
    voice: characters.find((c) => c.id === narrator)?.voice ?? old.voice ?? 'Hải Đăng', narrator, characterMode: mode, characters,
    music: { volume: 0.12, ...(old.music ?? {}), mood: brief.music }, sfx: old.sfx ?? { auto: true, volume: 0.6 }, transition: old.transition ?? { type: 'slide', frames: 12 },
    chrome: old.chrome ?? { handle: false, progress: true, tag: true }, pronounce: old.pronounce ?? {},
  });
  if (isNew) writeJSON(path.join(dir, 'plan.json'), { brief: {}, episodes: [] });
  const L = { 'tinh-huong': 'phim tình huống (cảnh story)', 'thong-tin': 'đồ hoạ thông tin', 'ket-hop': 'kết hợp tình huống + thông tin' };
  fs.writeFileSync(path.join(dir, 'brief.md'), `# Đề bài — ${brief.name}\n\n- Ý tưởng: ${brief.idea}\n- Số tập: ${brief.episodes}\n- Thời lượng mỗi tập: ${brief.duration} giây\n- Kiểu kể: ${L[brief.style]}\n- Bộ màu: ${brief.theme}\n- Khung hình: ${brief.format}\n- Bối cảnh ưu tiên: ${brief.sets.join(', ') || 'tuỳ nội dung'}\n- Giọng điệu: ${brief.tone}\n- Nhân vật: ${mode} — ${characters.map((c) => `${c.name} (${c.gender === 'nu' ? 'nữ' : 'nam'}, ${c.kind}${c.role ? `, ${c.role}` : ''})`).join('; ')}\n- Người dẫn chuyện: ${narrator ?? '—'}\n- Khán giả: ${brief.audience}\n- Nền tảng: ${brief.platform}\n- Lời kêu gọi cuối tập: ${brief.cta}\n- Ghi chú: ${brief.notes}\n\n_File này sinh từ trang web của xưởng; nguồn chính là brief.json._\n`);
  return brief;
};

// ───────── công việc chạy nền (mỗi lúc một việc)
let job = null;
let seq = 0;
const LABEL = { plan: 'Lập kế hoạch', script: 'Viết kịch bản + storyboard', fix: 'Sửa theo góp ý', render: 'Dựng phim', characters: 'Vẽ bảng nhân vật', upload: 'Đẩy lên Google Drive' };
const logLine = (j, s) => {
  for (const part of String(s).split(/\r?\n|\r/)) {
    const t = part.replace(/\s+$/, '');
    if (!t) continue;
    const prog = /^\s*(render|ảnh) \d/.test(t);
    if (prog && j.log.length && /^\s*(render|ảnh) \d/.test(j.log[j.log.length - 1])) j.log[j.log.length - 1] = t;
    else j.log.push(t);
  }
  if (j.log.length > 1500) j.log.splice(0, j.log.length - 1500);
};
// việc nối tiếp khi bước chính xong (vd tự đẩy lên Drive sau khi dựng phim) — chạy trong cùng một việc để trang theo dõi liền mạch
const runAfter = async (j, code) => {
  if (code === 0 && !j.failed && j.status === 'running' && j.after) {
    try { await j.after(j); } catch (e) { j.failed = true; logLine(j, `✗ ${e.message}`); if (e instanceof drive.DriveError) j.hint = e.message; }
  }
  finish(j, code);
};
const finish = (j, code) => {
  j.status = j.status === 'stopping' ? 'stopped' : code === 0 && !j.failed ? 'done' : 'error';
  j.ended = Date.now();
  logLine(j, j.status === 'done' ? '✓ Xong.' : j.status === 'stopped' ? '■ Đã dừng.' : `✗ Lỗi (mã ${code}).`);
};
const pipeLines = (stream, onLine) => {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (c) => { buf += c; const parts = buf.split(/\r\n|\n|\r/); buf = parts.pop(); parts.forEach(onLine); });
  stream.on('end', () => buf && onLine(buf));
};
export const startJob = (meta, cmd, args, { claude = false, after = null } = {}) => {
  const env = { ...process.env, FORCE_COLOR: '0' };
  // trang được mở từ trong một phiên Claude (vd ứng dụng desktop) → bỏ biến của phiên đó để `claude -p` dùng đăng nhập riêng của máy
  if (claude && (env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT)) for (const k of Object.keys(env)) if ((/^CLAUDE/.test(k) && k !== 'CLAUDE_CONFIG_DIR') || k === 'ANTHROPIC_BASE_URL') delete env[k];
  const child = spawn(cmd, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const j = (job = { id: ++seq, ...meta, label: LABEL[meta.action] ?? meta.action, status: 'running', log: [], started: Date.now(), ended: 0, child, after, abort: new AbortController(), summary: '', hint: '', failed: false });
  logLine(j, `▶ ${j.label}${meta.episode ? ` · tập ${meta.episode}` : ''}${claude ? ' — Claude đang làm (thường mất vài phút)…' : '…'}`);
  if (claude)
    pipeLines(child.stdout, (line) => {
      let m;
      try { m = JSON.parse(line); } catch { return logLine(j, line); }
      if (m.type === 'assistant')
        for (const c of m.message?.content ?? []) {
          if (c.type === 'text' && c.text.trim()) logLine(j, c.text.trim());
          if (c.type === 'tool_use') {
            const i = c.input ?? {};
            const d = c.name === 'Bash' ? i.command : i.file_path ?? i.path ?? i.pattern ?? i.skill ?? '';
            logLine(j, `  ▸ ${c.name}${d ? `: ${String(d).replace(ROOT + '/', '').split('\n')[0].slice(0, 150)}` : ''}`);
          }
        }
      if (m.type === 'result') {
        if (!m.is_error) return void (j.summary = m.result ?? '');
        j.failed = true;
        logLine(j, `✗ ${m.result ?? 'Claude báo lỗi'}`);
        if (/authenticat|oauth|log ?in|api key|credit/i.test(m.result ?? '')) j.hint = 'Lệnh claude trên máy này chưa đăng nhập hoặc phiên đăng nhập đã hết hạn. Mở Terminal, chạy "claude", gõ /login và đăng nhập, rồi bấm lại nút. Trong lúc chờ, bạn có thể dùng mục "Làm trong Claude Code thay vì bấm nút" ở cột bên phải.';
      }
    });
  else pipeLines(child.stdout, (l) => logLine(j, l));
  pipeLines(child.stderr, (l) => !/HF_TOKEN|unauthenticated requests/.test(l) && logLine(j, l));
  child.on('error', (e) => { logLine(j, `✗ ${e.message}`); finish(j, 1); });
  child.on('close', (code) => j.status === 'running' || j.status === 'stopping' ? runAfter(j, code) : null);
  return j;
};
// việc chạy ngay trong máy chủ (không mở tiến trình con), vd tải lên Drive
const startTask = (meta, fn) => {
  const j = (job = { id: ++seq, ...meta, label: LABEL[meta.action] ?? meta.action, status: 'running', log: [], started: Date.now(), ended: 0, child: null, after: null, abort: new AbortController(), summary: '', hint: '', failed: false });
  logLine(j, `▶ ${j.label}${meta.episode ? ` · tập ${meta.episode}` : ''}…`);
  fn(j).then(() => finish(j, 0), (e) => {
    if (j.status !== 'stopping') { logLine(j, `✗ ${e.message}`); if (e instanceof drive.DriveError) j.hint = e.message; }
    finish(j, 1);
  });
  return j;
};
// đẩy một tập lên Drive (dùng cho nút "Đẩy lên Drive" và cho việc tự đẩy sau khi dựng)
const uploadStep = (slug, n) => async (j) => {
  const dir = seriesDir(slug), id = epId(n), ed = path.join(dir, 'episodes', id);
  const brief = readJSON(path.join(dir, 'brief.json'), {}), bible = readJSON(path.join(dir, 'bible.json'), {});
  const ep = readJSON(path.join(ed, 'episode.json'), {});
  logLine(j, '— Đẩy phim lên Google Drive —');
  await drive.uploadEpisode({ seriesDir: dir, epDir: ed, id, title: ep.title, folderName: brief.driveFolder || bible.name || slug, signal: j.abort.signal, log: (s) => logLine(j, s) });
  j.summary = 'Đã đẩy phim lên Google Drive.';
};
// tự đẩy khi series bật "tự đẩy" và đã kết nối, và MP4 vừa đổi (chỉ khi có MP4 mới)
const autoUpload = (slug, n) => {
  const dir = seriesDir(slug), id = epId(n), mp4 = path.join(dir, 'episodes', id, 'out', `${id}.mp4`);
  const before = fs.existsSync(mp4) ? fs.statSync(mp4).mtimeMs : 0;
  return async (j) => {
    if (!readJSON(path.join(dir, 'brief.json'), {}).driveAuto) return;
    if (!fs.existsSync(mp4) || fs.statSync(mp4).mtimeMs === before) return;
    if (!drive.status().connected) return void logLine(j, '! Series bật tự đẩy lên Google Drive nhưng máy chưa kết nối Drive — bỏ qua.');
    await uploadStep(slug, n)(j);
  };
};
export const jobView = (j, from = 0) => j && { id: j.id, action: j.action, label: j.label, slug: j.slug, episode: j.episode ?? null, status: j.status, started: j.started, ended: j.ended, summary: j.summary, hint: j.hint, total: j.log.length, log: j.log.slice(from) };
const claudeArgs = (prompt) => ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits',
  '--allowedTools', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', 'Bash(pnpm ep:*)', 'Bash(pnpm series:*)', 'Bash(pnpm typecheck)', 'Bash(node tools/:*)', 'Bash(ffmpeg:*)', 'Bash(ffprobe:*)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(mkdir:*)',
  ...(process.env.STUDIO_CLAUDE_MODEL ? ['--model', process.env.STUDIO_CLAUDE_MODEL] : [])];
export const promptFor = (action, slug, episode, hasFeedback) =>
  `Làm theo skill "series" (đọc skill/SKILL.md trong thư mục này), mục "Chế độ form". Giai đoạn: ${action}. Series: ${slug}.${episode ? ` Tập: ${episode}.` : ''}${hasFeedback ? ` Có góp ý của người dùng ở series/${slug}/.studio/gop-y.md — đọc và làm theo.` : ''} Không có ai trả lời câu hỏi trong lúc chạy: tự quyết theo mặc định của skill, làm xong đúng giai đoạn này thì dừng.`;

// ───────── HTTP
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = decodeURIComponent(url.pathname);
    const host = String(req.headers.host ?? '').split(':')[0];
    if (!['localhost', '127.0.0.1'].includes(host)) return fail(res, 403, 'chỉ dùng tại máy');
    if (req.method !== 'GET') {
      const origin = req.headers.origin;
      if (req.headers['x-xuong'] !== '1' || (origin && new URL(origin).host !== req.headers.host)) return fail(res, 403, 'yêu cầu không hợp lệ');
    }
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return serveFile(req, res, path.join(WEB, 'index.html'));
    if (req.method === 'GET' && p.startsWith('/files/')) {
      const [slug, ...rest] = p.slice(7).split('/');
      if (!SLUG.test(slug)) return fail(res, 400, 'slug sai');
      const file = path.resolve(seriesDir(slug), rest.join('/'));
      if (!file.startsWith(seriesDir(slug) + path.sep)) return fail(res, 403, 'ngoài thư mục series');
      return serveFile(req, res, file);
    }
    if (req.method === 'GET' && p === '/api/meta')
      return send(res, 200, {
        themes: Object.entries(PRESETS).map(([id, t]) => ({ id, bg: t.bg, fg: t.fg, accent: t.accent, accent2: t.accent2, card: t.card })),
        voices: VIENEU, formats: Object.keys(FORMATS), claude: !!CLAUDE, root: ROOT,
        hairs: { nam: ['ngan', 'vuot', 'tia', 'xoan', 'hoi'], nu: ['dai', 'buoc', 'bob', 'bui'] }, kinds: ['misa', 'so-mi', 'vest', 'hoodie', 'ao-thun', 'cardigan'],
        moods: ['tension', 'lofi', 'upbeat', 'inspire', 'playful', 'calm'],
      });
    if (req.method === 'GET' && p === '/api/series') return send(res, 200, listSeries());
    if (req.method === 'GET' && p === '/api/job') return send(res, 200, { job: jobView(job, +(url.searchParams.get('from') ?? 0)) });

    if (req.method === 'POST' && p === '/api/series') {
      const f = await readBody(req);
      if (!String(f.name ?? '').trim() || !String(f.idea ?? '').trim()) return fail(res, 400, 'Cần tên series và ý tưởng.');
      let slug = slugify(f.name);
      for (let k = 2; fs.existsSync(seriesDir(slug)); k++) slug = `${slugify(f.name)}-${k}`;
      saveBrief(slug, f, true);
      return send(res, 200, { slug });
    }
    if (req.method === 'POST' && p === '/api/job/stop') {
      if (job?.status === 'running') { job.status = 'stopping'; job.child?.kill('SIGTERM'); job.abort?.abort(); }
      return send(res, 200, { ok: true });
    }
    if (p === '/api/doctor' && req.method === 'GET') return send(res, 200, doctorChecks());
    if (p.startsWith('/api/drive')) {
      const back = (b) => `http://localhost:${PORT}/${b}`;
      if (req.method === 'GET' && p === '/api/drive') return send(res, 200, drive.status());
      if (req.method === 'GET' && p === '/api/drive/callback') {
        let to;
        try { to = await drive.handleCallback(url.searchParams); to += `${to.includes('?') ? '&' : '?'}drive=ok`; }
        catch (e) { to = `${e.back ?? '#/drive'}${(e.back ?? '').includes('?') ? '&' : '?'}drive_err=${encodeURIComponent(e.message)}`; }
        res.writeHead(302, { location: back(to), 'cache-control': 'no-store' });
        return res.end();
      }
      try {
        if (req.method === 'PUT' && p === '/api/drive/client') { drive.saveClient(await readBody(req)); return send(res, 200, drive.status()); }
        if (req.method === 'DELETE' && p === '/api/drive/client') { await drive.disconnect(); drive.forgetClient(); return send(res, 200, drive.status()); }
        if (req.method === 'POST' && p === '/api/drive/connect') { const b = await readBody(req); return send(res, 200, { url: drive.authUrl(PORT, b.back) }); }
        if (req.method === 'POST' && p === '/api/drive/disconnect') { await drive.disconnect(); return send(res, 200, drive.status()); }
      } catch (e) { if (e instanceof drive.DriveError) return fail(res, 400, e.message); throw e; }
      return fail(res, 404, 'không có');
    }
    const m = /^\/api\/series\/([^/]+)(\/[a-z-]+)?$/.exec(p);
    if (m) {
      const slug = m[1];
      if (!SLUG.test(slug) || !fs.existsSync(path.join(seriesDir(slug), 'bible.json'))) return fail(res, 404, 'không có series này');
      const dir = seriesDir(slug);
      if (req.method === 'GET' && !m[2]) return send(res, 200, seriesInfo(slug, true));
      if (req.method === 'PUT' && m[2] === '/brief') { saveBrief(slug, await readBody(req), false); return send(res, 200, { ok: true }); }
      if (req.method === 'POST' && m[2] === '/approve') {
        const b = await readBody(req);
        const plan = readJSON(path.join(dir, 'plan.json'), { episodes: [] });
        const pick = new Set((b.episodes ?? []).map(Number));
        for (const e of plan.episodes) if (pick.has(e.number) && (e.status ?? 'de-xuat') === 'de-xuat') e.status = 'duyet';
        writeJSON(path.join(dir, 'plan.json'), plan);
        return send(res, 200, { ok: true });
      }
      if (req.method === 'POST' && m[2] === '/jobs') {
        if (job?.status === 'running' || job?.status === 'stopping') return fail(res, 409, `Đang chạy: ${job.label}. Chờ xong hoặc bấm Dừng.`);
        const b = await readBody(req);
        const n = b.episode ? Math.floor(+b.episode) : null;
        const fb = String(b.feedback ?? '').trim();
        if (['script', 'fix', 'render', 'upload'].includes(b.action) && !(n > 0 && n < 100)) return fail(res, 400, 'thiếu số tập');
        if (['plan', 'script', 'fix'].includes(b.action)) {
          if (!CLAUDE) return fail(res, 400, 'Máy chưa có lệnh `claude` — dán câu lệnh thay thế vào Claude Code.');
          if (b.action === 'fix' && !fb) return fail(res, 400, 'Cần ghi góp ý.');
          fs.mkdirSync(path.join(dir, '.studio'), { recursive: true });
          const fbFile = path.join(dir, '.studio/gop-y.md');
          if (fb) fs.writeFileSync(fbFile, `# Góp ý (${b.action}${n ? ` · tập ${n}` : ''}) — ${new Date().toLocaleString('vi-VN')}\n\n${fb}\n`); else fs.rmSync(fbFile, { force: true });
          const j = startJob({ action: b.action, slug, episode: n }, CLAUDE, claudeArgs(promptFor(b.action, slug, n, !!fb)), { claude: true, after: b.action === 'fix' ? autoUpload(slug, n) : null });
          return send(res, 200, { job: jobView(j) });
        }
        if (b.action === 'render') {
          const ed = path.join('series', slug, 'episodes', epId(n));
          if (!fs.existsSync(path.join(ROOT, ed, 'episode.json'))) return fail(res, 400, 'Tập này chưa có kịch bản.');
          return send(res, 200, { job: jobView(startJob({ action: 'render', slug, episode: n }, process.execPath, ['tools/ep.mjs', ed, 'all'], { after: autoUpload(slug, n) })) });
        }
        if (b.action === 'upload') {
          if (!drive.status().connected) return fail(res, 400, 'Chưa kết nối Google Drive — vào trang Google Drive để kết nối.');
          if (!fs.existsSync(path.join(dir, 'episodes', epId(n), 'out', `${epId(n)}.mp4`))) return fail(res, 400, 'Tập này chưa có MP4.');
          return send(res, 200, { job: jobView(startTask({ action: 'upload', slug, episode: n }, uploadStep(slug, n))) });
        }
        if (b.action === 'characters') {
          if (!(readJSON(path.join(dir, 'bible.json')).characters ?? []).length) return fail(res, 400, 'Series chưa có nhân vật.');
          return send(res, 200, { job: jobView(startJob({ action: 'characters', slug }, process.execPath, ['tools/series.mjs', 'characters', slug])) });
        }
        return fail(res, 400, 'không có việc này');
      }
    }
    fail(res, 404, 'không có');
  } catch (e) {
    fail(res, 500, e.message);
  }
});
if (import.meta.url === `file://${process.argv[1]}`)
  server.listen(PORT, '127.0.0.1', () => console.log(`Xưởng series: http://localhost:${PORT}${CLAUDE ? '' : '  (chưa thấy lệnh claude — các bước sáng tác phải dán lệnh vào Claude Code)'}`));
