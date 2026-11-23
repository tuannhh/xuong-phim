#!/usr/bin/env node
// Trang web của Xưởng phim (chạy tại máy): điền form → duyệt kế hoạch → duyệt kịch bản/storyboard → dựng phim.
//   pnpm web            → http://localhost:4710
// Phần cần sáng tác (kế hoạch, kịch bản, sửa theo góp ý) giao cho Claude Code chạy ngầm (`claude -p`, skill series — "Chế độ form").
// Phần máy móc (voice → timing → trộn âm → render) chạy thẳng `tools/ep.mjs`, không cần Claude.
// Chỉ nghe ở 127.0.0.1; mọi lệnh ghi yêu cầu header x-xuong để trang web khác không gọi lén được.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { FORMATS, PRESETS, ROOT, readJSON, writeJSON } from '../lib.mjs';
import { HAIRS, KINDS, MASCOTS, SETS, allHairs } from '../../shared/catalog.mjs';
import { WM_DEFAULT, cleanWatermark } from '../../shared/watermark.mjs';
import { MUSIC_EXT, MUSIC_MAX, musicDir, musicTracks } from '../music-source.mjs';
import { saveStream } from './upload.mjs';
import { suggest } from './suggest.mjs';
import * as ai from './ai.mjs';
import * as autostart from '../autostart.mjs';
import { VIENEU } from '../voices.mjs';
import * as drive from './drive.mjs';
import { checks as doctorChecks } from '../doctor.mjs';
import * as output from '../output.mjs';
import * as mat from './materials.mjs';
import { createQueue } from './queue.mjs';

const PORT = +(process.env.PORT ?? 4710);
const SERIES = path.join(ROOT, 'series');
const WEB = path.join(ROOT, 'web');
const SLUG = /^[a-z0-9][a-z0-9-]{0,58}$/;
const CLAUDE = ai.BIN.claude;

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
    export: mp4 ? output.episodeExport(ed, id) : null,
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
  const aDir = path.join(dir, 'assets');
  const assets = fs.existsSync(aDir) ? fs.readdirSync(aDir).filter((f) => ASSET_EXT.test(f)).sort() : [];
  const tracks = musicTracks(dir, bible.music).map((t) => ({ name: path.basename(t), uploaded: path.dirname(t) === musicDir(dir), size: fs.statSync(t).size }));
  const mPath = bible.music?.path ? String(bible.music.path) : '';
  return { ...base, bible, assets, music: { tracks, pathOk: !mPath || fs.existsSync(mPath.replace(/^~(?=\/|$)/, os.homedir())) }, brief: readJSON(path.join(dir, 'brief.json'), null), episodes, materials: mat.summary(dir), outputDir: output.displayPath(output.seriesOutputDir(bible.name || slug)), charactersPng: fs.existsSync(pic) ? fs.statSync(pic).mtimeMs : 0, notes: fs.existsSync(path.join(dir, '.studio/ghi-chu.md')) ? fs.readFileSync(path.join(dir, '.studio/ghi-chu.md'), 'utf8') : '' };
};
const listSeries = () => (fs.existsSync(SERIES) ? fs.readdirSync(SERIES).filter((d) => SLUG.test(d)).map((d) => seriesInfo(d)).filter(Boolean) : []);

const ASSET_EXT = /\.(png|webp|jpe?g|svg)$/i;
// nhạc nền: nguồn (tự tổng hợp theo mood / nhạc của tôi), âm lượng 0..0.3 (thanh 0–100% trên trang), đường dẫn trên máy
const cleanMusic = (f, old = {}) => {
  const vol = f.musicVolume != null && Number.isFinite(+f.musicVolume) ? Math.min(0.3, Math.max(0, +f.musicVolume)) : old.volume ?? 0.12;
  const out = { ...old, volume: +vol.toFixed(3), mood: String(f.music ?? old.mood ?? 'tension'), source: (f.musicSource ?? old.source) === 'file' ? 'file' : 'tao' };
  const mp = 'musicPath' in f ? String(f.musicPath ?? '').trim().slice(0, 500) : old.path ?? '';
  if (mp) out.path = mp; else delete out.path;
  return out;
};
// form → brief.json + bible.json (+ brief.md cho người đọc)
const cleanChar = (c, i) => {
  const out = { id: slugify(c.id || c.name || `nv${i + 1}`).replace(/-/g, '') || `nv${i + 1}`, name: String(c.name || `Nhân vật ${i + 1}`).slice(0, 40), gender: c.gender === 'nu' ? 'nu' : 'nam', kind: KINDS[c.kind] || c.kind === 'mascot' ? c.kind : 'misa', hair: allHairs()[c.hair] ? c.hair : c.gender === 'nu' ? 'dai' : 'ngan' };
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
  if (out.kind === 'mascot') {
    // mascot vẽ sẵn (MASCOTS) hoặc ảnh người dùng tải lên series/<slug>/assets/ (Remotion đọc ở series-assets/)
    const img = String(c.image ?? '').replace(/^series-assets\//, '');
    if (c.mascot === 'anh' && ASSET_EXT.test(img) && !img.includes('/')) Object.assign(out, { mascot: 'anh', image: `series-assets/${img}` });
    else out.mascot = MASCOTS[c.mascot] ? c.mascot : Object.keys(MASCOTS)[0] ?? 'anh';
    delete out.hair;
  }
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
    episodes: Math.max(1, Math.min(30, +f.episodes || 5)), duration: Math.max(20, Math.min(300, +f.duration || 60)), format: FORMATS[f.format] ? f.format : '9:16',
    theme: PRESETS[f.theme] ? f.theme : 'misa-vang', style: ['tinh-huong', 'thong-tin', 'ket-hop'].includes(f.style) ? f.style : 'tinh-huong',
    sets: (f.sets ?? []).filter((s) => SETS[s]), tone: String(f.tone ?? ''), music: String(f.music ?? 'tension'),
    characterMode: mode, narrator, logo: f.logo === 'none' ? 'none' : 'misa', cta: String(f.cta ?? ''), notes: String(f.notes ?? ''),
    sourceMode: mat.MODES[f.sourceMode] ? f.sourceMode : 'claude', materials: mat.cleanMaterials(f.materials),
    driveAuto: !!f.driveAuto, driveFolder: String(f.driveFolder ?? '').replace(/[\\/]+/g, ' ').trim().slice(0, 80), updated: new Date().toISOString(),
  };
  writeJSON(path.join(dir, 'brief.json'), brief);
  const old = readJSON(path.join(dir, 'bible.json'), {});
  writeJSON(path.join(dir, 'bible.json'), {
    ...old, name: brief.name, slug, channel: brief.channel, episodes: brief.episodes, format: brief.format, fps: old.fps ?? 30, engine: old.engine ?? 'remotion',
    theme: { ...(typeof old.theme === 'object' ? old.theme : {}), preset: brief.theme }, captions: old.captions ?? 'pill',
    voice: characters.find((c) => c.id === narrator)?.voice ?? old.voice ?? 'Hải Đăng', narrator, characterMode: mode, characters,
    music: cleanMusic(f, old.music),
    watermark: 'watermark' in f ? cleanWatermark(f.watermark) : old.watermark ?? null, sfx: old.sfx ?? { auto: true, volume: 0.6 }, transition: old.transition ?? { type: 'slide', frames: 12 },
    chrome: old.chrome ?? { handle: false, progress: true, tag: true }, pronounce: old.pronounce ?? {},
  });
  if (isNew) writeJSON(path.join(dir, 'plan.json'), { brief: {}, episodes: [] });
  const L = { 'tinh-huong': 'phim tình huống (cảnh story)', 'thong-tin': 'đồ hoạ thông tin', 'ket-hop': 'kết hợp tình huống + thông tin' };
  fs.writeFileSync(path.join(dir, 'brief.md'), `# Đề bài — ${brief.name}\n\n- Ý tưởng: ${brief.idea}\n- Số tập: ${brief.episodes}\n- Thời lượng mỗi tập: ${brief.duration} giây\n- Kiểu kể: ${L[brief.style]}\n- Bộ màu: ${brief.theme}\n- Khung hình: ${brief.format}\n- Bối cảnh ưu tiên: ${brief.sets.join(', ') || 'tuỳ nội dung'}\n- Giọng điệu: ${brief.tone}\n- Nhân vật: ${mode} — ${characters.map((c) => `${c.name} (${c.gender === 'nu' ? 'nữ' : 'nam'}, ${c.kind}${c.role ? `, ${c.role}` : ''})`).join('; ')}\n- Người dẫn chuyện: ${narrator ?? '—'}\n- Khán giả: ${brief.audience}\n- Nền tảng: ${brief.platform}\n- Lời kêu gọi cuối tập: ${brief.cta}\n- Ghi chú: ${brief.notes}\n- Nguồn nội dung: ${mat.MODES[brief.sourceMode]}${brief.materials.length ? ` — ${brief.materials.map((m) => m.ref).join('; ')}` : ''}\n\n_File này sinh từ trang web của xưởng; nguồn chính là brief.json._\n`);
  return brief;
};

// ───────── công việc chạy nền (mỗi lúc một việc)
let job = null;
let seq = 0;
const LABEL = { plan: 'Lập kế hoạch', script: 'Viết kịch bản + storyboard', fix: 'Sửa theo góp ý', render: 'Dựng phim', characters: 'Vẽ bảng nhân vật', upload: 'Đẩy lên Google Drive', storyboard: 'Vẽ lại storyboard' };
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
const finish = (j, code) => {
  j.status = j.status === 'stopping' ? 'stopped' : code === 0 && !j.failed ? 'done' : 'error';
  j.ended = Date.now();
  logLine(j, j.status === 'done' ? '✓ Xong.' : j.status === 'stopped' ? '■ Đã dừng.' : `✗ Lỗi (mã ${code}).`);
  if (j.queued) queue.done({ slug: j.slug, episode: j.episode }, j.status);
  // bấm Dừng = dừng tập đang dựng và TẠM DỪNG hàng đợi (không tự nhảy sang tập sau); tập lỗi thì vẫn dựng tiếp tập sau
  if (j.status === 'stopped' && queue.size) queue.pause();
  setImmediate(pump);
};

// ───────── hàng đợi dựng phim (tools/web/queue.mjs): bấm dựng khi máy đang bận → xếp hàng; xong việc này tự dựng tập kế
const queue = createQueue(path.join(output.CONF_DIR, 'queue.json'));
const queueTitle = (i) => {
  const ep = readJSON(path.join(seriesDir(i.slug), 'episodes', epId(i.episode), 'episode.json'), null);
  return `${readJSON(path.join(seriesDir(i.slug), 'bible.json'), {}).name ?? i.slug} · Tập ${i.episode}${ep?.title ? `: ${ep.title}` : ''}`;
};
const busyNow = () => job?.status === 'running' || job?.status === 'stopping';
const renderDir = (slug, n) => path.join('series', slug, 'episodes', epId(n));
const startRender = (slug, n, queued = false) =>
  startJob({ action: 'render', slug, episode: n, queued }, process.execPath, ['tools/ep.mjs', renderDir(slug, n), 'all'], { after: autoUpload(slug, n) });
function pump() {
  if (busyNow()) return;
  for (let it = queue.take(); it; it = queue.take()) {
    if (SLUG.test(it.slug) && fs.existsSync(path.join(ROOT, renderDir(it.slug, it.episode), 'episode.json'))) return void startRender(it.slug, it.episode, true);
    queue.done(it, 'skipped'); // tập đã bị xoá / chưa có kịch bản
  }
}
const pipeLines = (stream, onLine) => {
  let buf = '';
  stream.setEncoding('utf8');
  stream.on('data', (c) => { buf += c; const parts = buf.split(/\r\n|\n|\r/); buf = parts.pop(); parts.forEach(onLine); });
  stream.on('end', () => buf && onLine(buf));
};
// Một "việc" = chuỗi bước chạy trong máy chủ; mỗi bước có thể mở tiến trình con (runChild). Mỗi lúc chỉ một việc.
const startTask = (meta, fn, intro) => {
  const j = (job = { id: ++seq, ...meta, label: LABEL[meta.action] ?? meta.action, status: 'running', log: [], started: Date.now(), ended: 0, child: null, abort: new AbortController(), summary: '', hint: '', failed: false });
  logLine(j, intro ?? `▶ ${j.label}${meta.episode ? ` · tập ${meta.episode}` : ''}…`);
  fn(j).then(() => finish(j, 0), (e) => {
    if (j.status !== 'stopping' && e.message) { logLine(j, `✗ ${e.message}`); if (e instanceof drive.DriveError) j.hint = e.message; }
    finish(j, e.exitCode ?? 1);
  });
  return j;
};
const childEnv = (claude) => {
  const env = { ...process.env, FORCE_COLOR: '0' };
  // trang được mở từ trong một phiên Claude (vd ứng dụng desktop) → bỏ biến của phiên đó để `claude -p` dùng đăng nhập riêng của máy
  if (claude && (env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT)) for (const k of Object.keys(env)) if ((/^CLAUDE/.test(k) && k !== 'CLAUDE_CONFIG_DIR' && k !== 'CLAUDE_CODE_OAUTH_TOKEN') || k === 'ANTHROPIC_BASE_URL') delete env[k];
  return env;
};
// chạy một tiến trình con trong việc j, đẩy log lên trang; xong mã 0 → resolve, còn lại → reject
const runChild = (j, cmd, args, { claude = false, codex = false } = {}) => new Promise((ok, no) => {
  if (j.status !== 'running') return no(new Error(''));
  const child = (j.child = spawn(cmd, args, { cwd: ROOT, env: childEnv(claude || codex), stdio: ['ignore', 'pipe', 'pipe'] }));
  if (codex)
    pipeLines(child.stdout, (line) => {
      let m;
      try { m = JSON.parse(line); } catch { return line.trim() && logLine(j, line); }
      const r = ai.codexLine(m, ROOT);
      if (!r) return;
      if (r.text) logLine(j, r.text);
      if (r.message) j.summary = r.message;
      if (r.failed) {
        j.failed = true;
        if (/auth|log ?in|401|unauthori/i.test(r.failed)) j.hint = 'Lệnh codex trên máy này chưa đăng nhập. Mở Terminal, chạy "codex login", đăng nhập rồi bấm lại nút — hoặc đổi sang Claude ở trang Thiết lập.';
        else if (/model/i.test(r.failed)) j.hint = 'Model Codex đang chọn không dùng được với tài khoản / phiên bản Codex này. Vào Thiết lập → AI, bấm "Cập nhật danh sách" rồi chọn model khác.';
      }
    });
  else if (claude)
    pipeLines(child.stdout, (line) => {
      let m;
      try { m = JSON.parse(line); } catch { return logLine(j, line); }
      if (m.type === 'assistant')
        for (const c of m.message?.content ?? []) {
          if (c.type === 'text' && c.text.trim()) logLine(j, c.text.trim());
          if (c.type === 'tool_use') {
            const i = c.input ?? {};
            const d = c.name === 'Bash' ? i.command : i.file_path ?? i.path ?? i.pattern ?? i.skill ?? i.query ?? i.url ?? '';
            logLine(j, `  ▸ ${c.name}${d ? `: ${String(d).replace(ROOT + '/', '').split('\n')[0].slice(0, 150)}` : ''}`);
          }
        }
      if (m.type === 'result') {
        if (!m.is_error) return void (j.summary = m.result ?? '');
        j.failed = true;
        logLine(j, `✗ ${m.result ?? 'Claude báo lỗi'}`);
        if (/authenticat|oauth|log ?in|api key|credit/i.test(m.result ?? '')) j.hint = process.env.XUONG_DOCKER ? 'Lệnh claude trong Docker chưa đăng nhập. Trên máy thật chạy "claude setup-token", dán mã vào CLAUDE_CODE_OAUTH_TOKEN trong file .env rồi khởi động lại: docker compose up -d.' : 'Lệnh claude trên máy này chưa đăng nhập hoặc phiên đăng nhập đã hết hạn. Mở Terminal, chạy "claude", gõ /login và đăng nhập, rồi bấm lại nút. Trong lúc chờ, bạn có thể dùng mục "Làm trong Claude Code thay vì bấm nút" ở cột bên phải.';
      }
    });
  else pipeLines(child.stdout, (l) => logLine(j, l));
  pipeLines(child.stderr, (l) => !/HF_TOKEN|unauthenticated requests/.test(l) && logLine(j, l));
  child.on('error', (e) => { j.child = null; no(e); });
  child.on('close', (code) => {
    j.child = null;
    if (code === 0 && !j.failed) ok();
    else no(Object.assign(new Error(j.status === 'stopping' || j.failed ? '' : `${path.basename(cmd)} dừng với mã ${code}`), { exitCode: code || 1 }));
  });
});
// việc một tiến trình (dựng phim, vẽ nhân vật…) + bước nối tiếp tuỳ chọn (vd tự đẩy lên Drive sau khi dựng)
export const startJob = (meta, cmd, args, { claude = false, codex = false, after = null, before = null, who = '' } = {}) =>
  startTask(meta, async (j) => {
    const extra = before ? await before(j) : null;
    await runChild(j, cmd, typeof args === 'function' ? args(extra) : args, { claude, codex });
    if (after && j.status === 'running') await after(j);
  }, `▶ ${LABEL[meta.action] ?? meta.action}${meta.episode ? ` · tập ${meta.episode}` : ''}${claude || codex ? ` — ${who || (codex ? 'Codex' : 'Claude')} đang làm (thường mất vài phút)…` : '…'}`);
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
// sourceMode "tu-lieu" (chỉ tư liệu người dùng) → không cho tìm trên mạng; addDirs = thư mục tư liệu trên máy để Claude xem file gốc
const claudeArgs = ai.claudeArgs;
// Codex không mở được Chrome trong hộp cát → sau khi Codex viết/sửa xong, máy chủ chạy check → script → storyboard;
// storyboard còn chồng lấn (hoặc check lỗi) thì gọi Codex sửa tiếp, tối đa 2 lần. fix + tập đã có MP4 → dựng lại.
const tail = (j, from) => j.log.slice(from).map((l) => l.t ?? l).filter((x) => typeof x === 'string').slice(-25).join('\n');
const codexFollowUp = (slug, n, action, pk, sourceMode, hadMp4) => async (j) => {
  const ed = path.join('series', slug, 'episodes', epId(n));
  if (!fs.existsSync(path.join(ROOT, ed, 'episode.json'))) throw new Error('Codex chưa viết episode.json cho tập này.');
  logLine(j, '— Máy chủ kiểm tra kịch bản + vẽ storyboard —');
  for (let round = 0; ; round++) {
    let problem = '';
    const from = j.log.length;
    try {
      await runChild(j, process.execPath, ['tools/ep.mjs', ed, 'check']);
      await runChild(j, process.execPath, ['tools/ep.mjs', ed, 'script']);
      await runChild(j, process.execPath, ['tools/ep.mjs', ed, 'storyboard']);
      const lay = readJSON(path.join(ROOT, ed, 'storyboard', 'layout.json'), {});
      const bad = Object.entries(lay).filter(([, v]) => v?.length);
      if (bad.length) problem = `Storyboard báo bố cục chưa đạt (chữ đè chữ / đè nhân vật / tràn khung):\n${bad.flatMap(([k, v]) => v.map((x) => `- cảnh ${k}: ${x}`)).join('\n')}`;
    } catch (e) {
      if (j.status !== 'running') throw e;
      j.failed = false;
      problem = `Lệnh kiểm tra báo lỗi:\n${tail(j, from)}`;
    }
    if (!problem) break;
    if (round >= 2) { logLine(j, '! Đã nhờ Codex sửa 2 lần mà storyboard vẫn chưa sạch — xem ảnh storyboard và góp ý để sửa tiếp.'); if (/Lệnh kiểm tra báo lỗi/.test(problem)) throw new Error('Kịch bản vẫn chưa qua bước kiểm tra.'); break; }
    logLine(j, `— Gọi Codex sửa (lần ${round + 1}) —`);
    const prompt = `Làm theo skill "series" (skill/SKILL.md), mục "Chế độ form". Series: ${slug}. Tập: ${n}. ${problem}\nSửa series/${slug}/episodes/${epId(n)}/episode.json cho hết lỗi trên (giữ nội dung, chỉ chỉnh chữ/bố cục/nhân vật cần thiết), chạy lại \`node tools/ep.mjs ${ed} check\` và \`script\` cho sạch rồi dừng.${ai.CODEX_NOTE}`;
    await runChild(j, pk.bin, ai.codexArgs(prompt, ROOT, { sourceMode, model: pk.model, effort: pk.effort }), { codex: true });
  }
  if (action === 'fix' && hadMp4) { logLine(j, '— Dựng lại phim (giọng chỉ đọc lại câu đã đổi) —'); await runChild(j, process.execPath, ['tools/ep.mjs', ed, 'all']); }
  j.summary ||= 'Codex đã viết xong; storyboard đã vẽ.';
};
export const promptFor = (action, slug, episode, hasFeedback, extra = '') =>
  `Làm theo skill "series" (đọc skill/SKILL.md trong thư mục này), mục "Chế độ form". Giai đoạn: ${action}. Series: ${slug}.${episode ? ` Tập: ${episode}.` : ''}${hasFeedback ? ` Có góp ý của người dùng ở series/${slug}/.studio/gop-y.md — đọc và làm theo.` : ''}${extra} Không có ai trả lời câu hỏi trong lúc chạy: tự quyết theo mặc định của skill, làm xong đúng giai đoạn này thì dừng.`;

// Sửa lời thoại ngay trên trang (bước duyệt kịch bản/storyboard): chỉ đổi chữ của câu, giữ mọi thứ khác.
// Câu đổi chữ thì bỏ "say" cũ (cách đọc của câu cũ). Voice tự đọc lại đúng câu đổi khi dựng.
const saveLines = (slug, n, edits) => {
  const f = path.join(seriesDir(slug), 'episodes', epId(n), 'episode.json');
  const ep = readJSON(f, null);
  if (!ep) throw Object.assign(new Error('Tập này chưa có kịch bản.'), { code: 400 });
  let changed = 0;
  for (const e of Array.isArray(edits) ? edits.slice(0, 500) : []) {
    const sc = ep.scenes.find((x) => x.id === e.scene), i = Math.floor(+e.line);
    const text = String(e.text ?? '').replace(/\r/g, '').trim();
    if (!sc || !(i >= 0 && i < (sc.lines ?? []).length)) continue;
    if (!text) throw Object.assign(new Error(`Cảnh ${e.scene}: câu ${i + 1} đang để trống.`), { code: 400 });
    if (text.length > 400) throw Object.assign(new Error(`Cảnh ${e.scene}: câu ${i + 1} quá dài.`), { code: 400 });
    const cur = sc.lines[i];
    const old = typeof cur === 'string' ? cur : cur.text;
    if (old === text) continue;
    if (typeof cur === 'string') sc.lines[i] = text;
    else { const { say, ...rest } = cur; sc.lines[i] = { ...rest, text }; }
    changed++;
  }
  if (changed) writeJSON(f, ep);
  return changed;
};
const sceneLines = (slug, n) => {
  const ep = readJSON(path.join(seriesDir(slug), 'episodes', epId(n), 'episode.json'), null);
  if (!ep) return null;
  const bible = readJSON(path.join(seriesDir(slug), 'bible.json'), {});
  const names = Object.fromEntries([...(bible.characters ?? []), ...(ep.characters ?? [])].map((c) => [c.id, c.name]));
  return ep.scenes.map((sc) => ({ id: sc.id, type: sc.type, lines: (sc.lines ?? []).map((l) => (typeof l === 'string' ? { text: l } : { text: l.text, speaker: l.speaker ? names[l.speaker] ?? l.speaker : null })) }));
};

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
        voices: VIENEU, formats: Object.keys(FORMATS), claude: !!CLAUDE, root: ROOT, docker: !!process.env.XUONG_DOCKER, sourceModes: mat.MODES,
        hairs: HAIRS, kinds: KINDS, sets: Object.fromEntries(Object.entries(SETS).map(([k, v]) => [k, v.label])), mascots: MASCOTS, wmDefault: WM_DEFAULT,
        moods: ['tension', 'lofi', 'upbeat', 'inspire', 'playful', 'calm'],
      });
    if (req.method === 'GET' && p === '/api/series') return send(res, 200, listSeries());
    if (req.method === 'POST' && p === '/api/suggest') {
      const b = await readBody(req);
      try { return send(res, 200, { items: await suggest(ai.pick('suggest'), childEnv(true), String(b.field ?? ''), b.context ?? {}) }); }
      catch (e) { return fail(res, e.code ?? 500, e.message); }
    }
    if (req.method === 'GET' && p === '/api/job') return send(res, 200, { job: jobView(job, +(url.searchParams.get('from') ?? 0)), queue: queue.view(queueTitle) });
    if (p === '/api/queue' && req.method === 'DELETE') {
      const slug = url.searchParams.get('slug'), n = +url.searchParams.get('episode');
      if (slug) queue.remove(slug, n); else queue.clear();
      return send(res, 200, { queue: queue.view(queueTitle) });
    }
    if (p === '/api/queue/pause' && req.method === 'POST') { queue.pause(); return send(res, 200, { queue: queue.view(queueTitle) }); }
    if (p === '/api/queue/resume' && req.method === 'POST') { queue.resume(); pump(); return send(res, 200, { job: jobView(job), queue: queue.view(queueTitle) }); }

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
    if (p === '/api/brand/misa-logo.svg' && req.method === 'GET') return serveFile(req, res, path.join(ROOT, 'assets/brand/misa-logo.svg'));
    // Thiết lập AI: công cụ + model/effort từng vai trò (lưu theo máy, ngoài repo)
    if (p === '/api/ai') {
      if (req.method === 'PUT') return send(res, 200, { config: ai.save(await readBody(req)) });
      return send(res, 200, { config: ai.load(), defaults: ai.DEFAULTS, roles: ai.ROLES, status: ai.status(), claude: { models: ai.CLAUDE_MODELS, efforts: ai.CLAUDE_EFFORTS } });
    }
    if (req.method === 'GET' && p === '/api/ai/codex-models') return send(res, 200, await ai.codexModels({ refresh: url.searchParams.get('refresh') === '1' }));
    // tự mở xưởng khi đăng nhập máy
    if (p === '/api/autostart') {
      if (req.method === 'PUT') { const b = await readBody(req); return send(res, 200, b.on ? autostart.enable() : autostart.disable()); }
      return send(res, 200, autostart.status());
    }
    if (p === '/api/settings') {
      const view = () => ({ outputDir: output.displayPath(output.outputDir()), defaultOutputDir: output.defaultOutputDir(), locked: output.outputLocked(), canOpen: !process.env.XUONG_DOCKER && ['darwin', 'linux'].includes(process.platform), docker: !!process.env.XUONG_DOCKER });
      if (req.method === 'GET') return send(res, 200, view());
      if (req.method === 'PUT') {
        try { output.setOutputDir((await readBody(req)).outputDir); } catch (e) { return fail(res, 400, e.message); }
        return send(res, 200, view());
      }
    }
    if (p === '/api/open-output' && req.method === 'POST') {
      if (process.env.XUONG_DOCKER) return fail(res, 400, 'Đang chạy trong Docker — mở thư mục trên máy thật: ' + output.displayPath(output.outputDir()));
      const b = await readBody(req);
      let dir = output.outputDir();
      if (b.slug && SLUG.test(b.slug)) { const bible = readJSON(path.join(seriesDir(b.slug), 'bible.json'), null); if (bible) dir = output.seriesOutputDir(bible.name || b.slug); }
      fs.mkdirSync(dir, { recursive: true });
      spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [dir], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
      return send(res, 200, { ok: true, dir: output.displayPath(dir) });
    }
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
        if (req.method === 'POST' && p === '/api/drive/connect') { const b = await readBody(req); return send(res, 200, { url: drive.authUrl(PORT, b.back, { read: !!b.read || drive.status().canRead }) }); }
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
      if (m[2] === '/upload') {
        const name = url.searchParams.get('name') ?? '';
        try {
          if (req.method === 'POST') return send(res, 200, await mat.saveUpload(dir, name, req));
          if (req.method === 'DELETE') { mat.removeUpload(dir, name); return send(res, 200, mat.summary(dir)); }
        } catch (e) { return fail(res, 400, e.message); }
      }
      if (m[2] === '/asset' || m[2] === '/music') {
        // ảnh dùng chung của series (logo watermark, ảnh mascot) → assets/; nhạc nền → nhac/  (cả hai ngoài git)
        const isMusic = m[2] === '/music';
        const base = isMusic ? musicDir(dir) : path.join(dir, 'assets');
        const raw = mat.safeName(url.searchParams.get('name') ?? '');
        const kind = ['logo', 'mascot'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'anh';
        const name = isMusic || req.method === 'DELETE' ? raw : `${kind}-${raw}`.replace(/\s+/g, '-');
        try {
          if (!name || !(isMusic ? MUSIC_EXT : ASSET_EXT).test(name)) throw new Error(isMusic ? 'Chỉ nhận nhạc MP3, WAV, M4A, AAC, OGG, FLAC.' : 'Chỉ nhận ảnh PNG (nên nền trong suốt), WEBP, JPG, SVG.');
          if (req.method === 'POST') return send(res, 200, await saveStream(base, name, req, isMusic ? MUSIC_MAX : 15 * 1024 * 1024, isMusic ? 'File nhạc quá 80 MB.' : 'Ảnh quá 15 MB.'));
          if (req.method === 'DELETE') { fs.rmSync(path.join(base, name), { force: true }); return send(res, 200, { ok: true }); }
        } catch (e) { return fail(res, 400, e.message); }
      }
      if (m[2] === '/lines') {
        const n = Math.floor(+(url.searchParams.get('episode') ?? 0));
        if (!(n > 0 && n < 100)) return fail(res, 400, 'thiếu số tập');
        if (req.method === 'GET') { const sc = sceneLines(slug, n); return sc ? send(res, 200, { scenes: sc }) : fail(res, 404, 'Tập này chưa có kịch bản.'); }
        if (req.method === 'PUT') {
          if (job?.status === 'running' && job.slug === slug && job.episode === n) return fail(res, 409, `Đang chạy "${job.label}" cho tập này — chờ xong rồi sửa.`);
          return send(res, 200, { changed: saveLines(slug, n, (await readBody(req)).edits) });
        }
      }
      if (req.method === 'POST' && m[2] === '/approve') {
        const b = await readBody(req);
        const plan = readJSON(path.join(dir, 'plan.json'), { episodes: [] });
        const pick = new Set((b.episodes ?? []).map(Number));
        for (const e of plan.episodes) if (pick.has(e.number) && (e.status ?? 'de-xuat') === 'de-xuat') e.status = 'duyet';
        writeJSON(path.join(dir, 'plan.json'), plan);
        return send(res, 200, { ok: true });
      }
      // xếp hàng dựng nhiều tập: { episodes: [n…] } — chỉ tập đã có kịch bản
      if (req.method === 'POST' && m[2] === '/queue') {
        const b = await readBody(req);
        const eps = [...new Set((Array.isArray(b.episodes) ? b.episodes : []).map(Number))].filter((n) => Number.isInteger(n) && n > 0 && n < 100 && fs.existsSync(path.join(ROOT, renderDir(slug, n), 'episode.json')));
        if (!eps.length) return fail(res, 400, 'Chưa chọn tập nào có kịch bản.');
        const running = busyNow() && job.action === 'render' && job.slug === slug ? job.episode : null;
        const added = queue.add(slug, eps.filter((n) => n !== running));
        if (!busyNow()) { queue.resume(); pump(); }
        return send(res, 200, { added, job: jobView(job), queue: queue.view(queueTitle) });
      }
      if (req.method === 'POST' && m[2] === '/jobs') {
        const b = await readBody(req);
        // dựng phim khi máy đang bận → xếp hàng thay vì báo lỗi
        if (b.action === 'render' && busyNow()) {
          const n = Math.floor(+b.episode);
          if (!(n > 0 && n < 100) || !fs.existsSync(path.join(ROOT, renderDir(slug, n), 'episode.json'))) return fail(res, 400, 'Tập này chưa có kịch bản.');
          if (job.action === 'render' && job.slug === slug && job.episode === n) return fail(res, 409, 'Tập này đang được dựng.');
          queue.add(slug, [n]);
          const v = queue.view(queueTitle);
          return send(res, 200, { queued: v.items.findIndex((i) => i.slug === slug && i.episode === n) + 1, queue: v });
        }
        if (busyNow()) return fail(res, 409, `Đang chạy: ${job.label}. Chờ xong hoặc bấm Dừng.`);
        const n = b.episode ? Math.floor(+b.episode) : null;
        const fb = String(b.feedback ?? '').trim();
        if (['script', 'fix', 'render', 'upload', 'storyboard'].includes(b.action) && !(n > 0 && n < 100)) return fail(res, 400, 'thiếu số tập');
        if (['plan', 'script', 'fix'].includes(b.action)) {
          const pk = ai.pick(b.action);
          if (!pk.bin) return fail(res, 400, pk.engine === 'codex' ? 'Máy chưa có lệnh `codex` — cài Codex (npm i -g @openai/codex, rồi codex login) hoặc đổi sang Claude ở Thiết lập.' : 'Máy chưa có lệnh `claude` — dán câu lệnh thay thế vào Claude Code, hoặc đổi sang Codex ở Thiết lập.');
          if (b.action === 'fix' && !fb) return fail(res, 400, 'Cần ghi góp ý.');
          fs.mkdirSync(path.join(dir, '.studio'), { recursive: true });
          const fbFile = path.join(dir, '.studio/gop-y.md');
          if (fb) fs.writeFileSync(fbFile, `# Góp ý (${b.action}${n ? ` · tập ${n}` : ''}) — ${new Date().toLocaleString('vi-VN')}\n\n${fb}\n`); else fs.rmSync(fbFile, { force: true });
          const brief = readJSON(path.join(dir, 'brief.json'), {});
          // chế độ có tư liệu → gom + đọc tư liệu trước, rồi mới gọi Claude
          const before = mat.needsMaterials(brief) ? async (j) => { logLine(j, '— Chuẩn bị tư liệu —'); return mat.prepare(dir, brief, { log: (x) => logLine(j, x), run: (c, a) => runChild(j, c, a), signal: j.abort.signal }); } : null;
          const who = `${pk.engine === 'codex' ? 'Codex' : 'Claude'}${pk.model ? ` ${pk.model}` : ''}${pk.effort ? ` · ${pk.effort}` : ''}`;
          const up = b.action === 'fix' ? autoUpload(slug, n) : null;
          let j;
          if (pk.engine === 'codex') {
            const hadMp4 = n ? fs.existsSync(path.join(dir, 'episodes', epId(n), 'out', `${epId(n)}.mp4`)) : false;
            const args = (prepared) => ai.codexArgs(promptFor(b.action, slug, n, !!fb, mat.promptPart(slug, brief, prepared)) + ai.CODEX_NOTE, ROOT, { sourceMode: brief.sourceMode, model: pk.model, effort: pk.effort });
            const follow = b.action === 'plan' ? null : codexFollowUp(slug, n, b.action, pk, brief.sourceMode, hadMp4);
            j = startJob({ action: b.action, slug, episode: n }, pk.bin, args, { codex: true, who, before, after: follow || up ? async (jj) => { if (follow) await follow(jj); if (up && jj.status === 'running') await up(jj); } : null });
          } else {
            const args = (prepared) => claudeArgs(promptFor(b.action, slug, n, !!fb, mat.promptPart(slug, brief, prepared)), { sourceMode: brief.sourceMode, addDirs: prepared?.localDirs ?? [], model: pk.model, effort: pk.effort });
            j = startJob({ action: b.action, slug, episode: n }, pk.bin, args, { claude: true, who, before, after: up });
          }
          return send(res, 200, { job: jobView(j) });
        }
        if (b.action === 'render') {
          if (!fs.existsSync(path.join(ROOT, renderDir(slug, n), 'episode.json'))) return fail(res, 400, 'Tập này chưa có kịch bản.');
          queue.remove(slug, n); // bấm dựng ngay thì bỏ khỏi hàng đợi (nếu có)
          return send(res, 200, { job: jobView(startRender(slug, n)) });
        }
        if (b.action === 'storyboard') {
          const ed = path.join('series', slug, 'episodes', epId(n));
          if (!fs.existsSync(path.join(ROOT, ed, 'episode.json'))) return fail(res, 400, 'Tập này chưa có kịch bản.');
          return send(res, 200, { job: jobView(startTask({ action: 'storyboard', slug, episode: n }, async (j) => {
            await runChild(j, process.execPath, ['tools/ep.mjs', ed, 'check']);
            await runChild(j, process.execPath, ['tools/ep.mjs', ed, 'script']);
            await runChild(j, process.execPath, ['tools/ep.mjs', ed, 'storyboard']);
            j.summary = 'Đã cập nhật kịch bản và vẽ lại storyboard theo lời thoại mới. Duyệt xong bấm "Duyệt và dựng phim" (hoặc "Dựng lại") — giọng chỉ đọc lại những câu đã đổi.';
          })) });
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
    fail(res, e.code === 400 ? 400 : 500, e.message);
  }
});
if (import.meta.url === `file://${process.argv[1]}`) {
  // cổng đã có Xưởng phim khác chạy (vd bản tự mở khi bật máy) → thoát êm, mã 0 (launchd/systemd không chạy lại vòng lặp)
  // HOST=0.0.0.0 chỉ dùng trong Docker (cổng được publish ra 127.0.0.1 của máy thật); chạy thẳng trên máy luôn là 127.0.0.1
  const listen = () => server.listen(PORT, process.env.XUONG_DOCKER ? process.env.HOST || '0.0.0.0' : '127.0.0.1', () => console.log(`Xưởng phim: http://localhost:${PORT}${CLAUDE ? '' : '  (chưa thấy lệnh claude — các bước sáng tác phải dán lệnh vào Claude Code)'}`));
  let waiting = false;
  server.on('error', (e) => {
    if (e.code !== 'EADDRINUSE') throw e;
    // bản tự mở khi bật máy: đứng chờ, bản kia tắt thì tự nhận cổng (không để trang chết khi bản chạy tay đóng lại)
    if (process.env.XUONG_AUTOSTART) {
      if (!waiting) console.log(`Cổng ${PORT} đang có Xưởng phim khác — chờ cổng trống để tự nhận…`);
      waiting = true;
      return void setTimeout(listen, 10000);
    }
    console.log(`Cổng ${PORT} đã có Xưởng phim đang chạy — mở http://localhost:${PORT}. (Muốn chạy bản này: tắt bản kia trước.)`);
    process.exit(0);
  });
  listen();
}
