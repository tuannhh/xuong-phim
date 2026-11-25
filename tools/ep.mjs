#!/usr/bin/env node
// Lệnh sản xuất một tập.  node tools/ep.mjs <thư-mục-tập> <bước> [--force] [--preview]
//   check       kiểm tra episode.json (template, nhân vật, assets, độ dài câu)
//   script      sinh script.md (kịch bản chi tiết dạng bảng để duyệt)
//   storyboard  ảnh tĩnh mỗi cảnh + storyboard/index.html (dùng thời lượng ước lượng nếu chưa có voice)
//   voice       đọc lời bằng tts-vi (chỉ câu mới/đổi; --force đọc lại hết)
//   timing      tính thời gian từ voice thật → build/timed.json, audio.json, out/<id>.srt
//   audio       nhạc nền + SFX + voice → build/mix.wav, build/mouth.json
//   render      xuất MP4 (out/<id>.mp4); --preview = nửa độ phân giải, nhanh
//   all         voice → timing → audio → render
//   voice-fix   chỉ sửa giọng: đọc lại câu đã đổi lời → trộn lại âm → thay tiếng vào MP4 cũ (không vẽ lại hình, ~30 giây).
//               Hình/chữ trên màn hình đổi, hoặc câu mới không vừa chỗ cũ → tự dựng lại đầy đủ (báo lý do).
//   studio      mở Remotion Studio để xem/chỉnh trực tiếp
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { ROOT, die, dirs, episodeLines, loadEpisode, readJSON, voiceSig, writeJSON } from './lib.mjs';
import { castVoices } from './voices.mjs';
import { buildTiming } from './timing.mjs';
import { SETS } from '../shared/catalog.mjs';
import { ttsVi, which, spawnBin } from './platform.mjs';

const [, , epArg, step = 'check', ...rest] = process.argv;
if (!epArg) die('cách dùng: node tools/ep.mjs <thư-mục-tập> <check|script|storyboard|voice|timing|audio|render|all|voice-fix|studio>');
const flags = new Set(rest);
// --gemini: làm bản voice Gemini TTS song song (voice-gemini/, build-gemini/, out/<id>-gemini.mp4) để so sánh
if (flags.has('--gemini')) process.env.SERIES_ENGINE = 'gemini';
const ctx = loadEpisode(epArg);
const { epDir, bible, episode } = ctx;
const rel = (p) => path.relative(process.cwd(), p) || '.';
const TEMPLATES = ['hook', 'title', 'bullets', 'stat', 'quote', 'compare', 'steps', 'icons', 'chart', 'kinetic', 'chat', 'phone', 'alert', 'figure', 'photo', 'character', 'talk', 'story', 'outro', 'custom'];
// giữ khớp với POSE_LIST / EXPR_LIST trong remotion/kit/Character.tsx
const POSES = ['dung', 'chao', 'chi', 'tay-mo', 'giai-thich', 'nghi', 'vui', 'ngac-nhien', 'khoanh-tay', 'buon', 'dien-thoai', 'nghe-may', 'om-dau', 'chong-nanh', 'like', 'nhun-vai', 'di-bo', 'go-phim', 'dat-tay'];
const EXPRS = ['binh-thuong', 'cuoi', 'vui', 'cuoi-lon', 'buon', 'khoc', 'gian', 'ngac-nhien', 'so', 'lo-lang', 'nghi', 'nghi-ngo', 'tu-tin', 'gian-xao'];

function check() {
  const errs = [], warns = [];
  const chars = new Set((episode.characters ?? bible.characters ?? []).map((c) => c.id));
  const ids = new Set();
  for (const s of episode.scenes) {
    if (!s.id) errs.push('có cảnh thiếu id');
    if (ids.has(s.id)) errs.push(`trùng id cảnh ${s.id}`);
    ids.add(s.id);
    if (!TEMPLATES.includes(s.type)) errs.push(`${s.id}: không có template "${s.type}"`);
    // không báo trước tập sau (người dùng duyệt/đăng tập nào, theo thứ tự nào là việc của họ)
    if (s.props?.next != null) errs.push(`${s.id}: bỏ trường "next" — cảnh kết không ghi "Tập sau" nữa`);
    for (const l of s.lines ?? []) if (/tập (sau|tới|tiếp theo|kế tiếp)/i.test(typeof l === 'string' ? l : l?.text ?? '')) warns.push(`${s.id}: lời đọc nhắc "tập sau" — dễ sai khi người dùng đăng không theo thứ tự: "${(typeof l === 'string' ? l : l.text).slice(0, 60)}"`);
    if (s.character) {
      if (!chars.has(s.character.id)) errs.push(`${s.id}: nhân vật "${s.character.id}" chưa khai báo trong bible.characters`);
      if (s.character.pose && !POSES.includes(s.character.pose)) errs.push(`${s.id}: tư thế "${s.character.pose}" không có (${POSES.join(', ')})`);
    }
    if (s.type === 'character' && !s.character) errs.push(`${s.id}: cảnh "character" cần trường character`);
    if (s.character?.expr && !EXPRS.includes(s.character.expr)) errs.push(`${s.id}: biểu cảm "${s.character.expr}" không có (${EXPRS.join(', ')})`);
    for (const m of s.props?.cast ?? []) {
      if (!chars.has(m.id)) errs.push(`${s.id}: nhân vật "${m.id}" chưa khai báo`);
      if (m.pose && !POSES.includes(m.pose)) errs.push(`${s.id}: tư thế "${m.pose}" không có`);
      if (m.expr && !EXPRS.includes(m.expr)) errs.push(`${s.id}: biểu cảm "${m.expr}" không có`);
    }
    for (const m of s.props?.actors ?? []) {
      if (!chars.has(m.id)) errs.push(`${s.id}: nhân vật "${m.id}" chưa khai báo`);
      if (m.pose && !POSES.includes(m.pose)) errs.push(`${s.id}: tư thế "${m.pose}" không có`);
      if (m.expr && !EXPRS.includes(m.expr)) errs.push(`${s.id}: biểu cảm "${m.expr}" không có`);
    }
    if (s.type === 'story') {
      if (!SETS[s.props?.set ?? 'van-phong']) errs.push(`${s.id}: bối cảnh "${s.props.set}" không có (${Object.keys(SETS).join(', ')})`);
      for (const q of s.props?.pops ?? []) { if (q.over && !(s.props.actors ?? []).some((a) => a.id === q.over)) errs.push(`${s.id}: nhãn "${q.text}" gắn vào "${q.over}" không có trong actors`); if ((q.on ?? 1) > (s.lines ?? []).length && (s.lines ?? []).length) errs.push(`${s.id}: nhãn "${q.text}" on=${q.on} vượt số câu`); }
    }
    if (s.type === 'talk' && !(s.props?.cast ?? []).length) errs.push(`${s.id}: cảnh talk cần props.cast`);
    for (const l of s.lines ?? []) {
      if (typeof l !== 'object') continue;
      if (l.expr && !EXPRS.includes(l.expr)) errs.push(`${s.id}: biểu cảm "${l.expr}" không có`);
      if (l.pose && !POSES.includes(l.pose)) errs.push(`${s.id}: tư thế "${l.pose}" không có`);
      for (const [k, v] of Object.entries(l.react ?? {})) { const e = typeof v === 'string' ? v : v.expr; if (e && !EXPRS.includes(e)) errs.push(`${s.id}: react ${k} biểu cảm "${e}" không có`); }
    }
    if (s.type === 'figure' && !fs.existsSync(path.join(epDir, s.props?.src ?? '-'))) errs.push(`${s.id}: thiếu file ${s.props?.src}`);
    if (s.type === 'photo')
      for (const src of s.props?.images?.length ? s.props.images.map((x) => x?.src) : [s.props?.src]) {
        if (!src || !/^assets\/[^/].*\.(jpe?g|png|webp)$/i.test(src)) errs.push(`${s.id}: ảnh phải là assets/<tên>.jpg|png|webp (chép từ .studio/tu-lieu/images/)`);
        else if (!fs.existsSync(path.join(epDir, src))) errs.push(`${s.id}: thiếu file ${src}`);
      }
    if (!(s.lines ?? []).length && !s.hold) warns.push(`${s.id}: không có lời đọc (đặt "hold": giây nếu cố ý)`);
  }
  const cv = castVoices(episode.characters ?? bible.characters ?? [], bible);
  cv.errors.forEach((e) => errs.push(`giọng: ${e}`));
  for (const l of episodeLines(bible, episode)) {
    for (const w of l.norm.warnings) warns.push(`${l.id}: ${w.code === 'UNKNOWN_ACRONYM' ? `chưa có cách đọc cho "${w.src}" (thêm vào bible.pronounce nếu máy đọc sai)` : `${w.code} ${w.src ?? ''}`}`);
    const n = l.text.split(/\s+/).length;
    if (n > 32) warns.push(`${l.id}: câu dài ${n} chữ — nên tách để phụ đề và hình bám nhịp tốt hơn`);
    if (l.speaker && !chars.has(l.speaker)) errs.push(`${l.id}: người nói "${l.speaker}" chưa khai báo`);
  }
  if (episode.target) {
    const r = buildTiming(epDir);
    const over = r.seconds / episode.target;
    if (over > 1.1) warns.push(`dài ${r.seconds.toFixed(0)}s so với mục tiêu ${episode.target}s (+${Math.round((over - 1) * 100)}%) — rút gọn lời đọc`);
    if (over < 0.8) warns.push(`ngắn ${r.seconds.toFixed(0)}s so với mục tiêu ${episode.target}s`);
  }
  warns.forEach((w) => console.log(`  ! ${w}`));
  errs.forEach((e) => console.log(`  ✗ ${e}`));
  if (errs.length) die(`${errs.length} lỗi trong ${rel(path.join(epDir, 'episode.json'))}`);
  console.log(`check: ổn (${episode.scenes.length} cảnh${warns.length ? `, ${warns.length} lưu ý` : ''})`);
}

function voice() {
  const lines = episodeLines(bible, episode);
  const D = dirs();
  const vdir = path.join(epDir, D.voice);
  fs.mkdirSync(vdir, { recursive: true });
  const manPath = path.join(vdir, 'manifest.json');
  const man = flags.has('--force') ? {} : readJSON(manPath, {});
  const sig = voiceSig;
  const todo = lines.filter((l) => man[l.id] !== sig(l) || !fs.existsSync(path.join(vdir, `${l.id}.wav`)));
  // dọn câu đã bỏ
  const keep = new Set(lines.map((l) => l.id));
  const dur = readJSON(path.join(vdir, 'dur.json'), {});
  for (const id of Object.keys(dur)) if (!keep.has(id)) { delete dur[id]; delete man[id]; fs.rmSync(path.join(vdir, `${id}.wav`), { force: true }); }
  writeJSON(path.join(vdir, 'dur.json'), dur);
  if (!todo.length) return console.log(`voice: ${lines.length} câu đã có, không đọc lại`);
  console.log(`voice: đọc ${todo.length}/${lines.length} câu bằng tts-vi…`);
  const tmp = path.join(epDir, D.build, 'voice-todo.json');
  writeJSON(tmp, todo.map((l) => ({ id: l.id, text: l.text, ...(l.say ? { say: l.say } : {}), ...(l.voice && D.engine !== 'gemini' ? { voice: l.voice } : {}), gemini_voice: l.geminiVoice })));
  // bảng lời đọc đã chuẩn hoá (để soát cách đọc)
  fs.writeFileSync(path.join(vdir, 'loi-doc.md'), `| câu | người nói | giọng | chữ hiển thị | máy đọc |\n|---|---|---|---|---|\n` + lines.map((l) => `| ${l.id} | ${l.speaker ?? ''} | ${D.engine === 'gemini' ? l.geminiVoice : l.voice ?? ''} | ${l.text} | ${l.say ?? '='} |`).join('\n') + '\n');
  const engines = readJSON(path.join(vdir, 'engines.json'), {});
  const tts = ttsVi();
  if (!tts) die('chưa có lệnh tts-vi — cài: ' + (process.platform === 'win32' ? 'setup.cmd' : 'bash setup.sh'));
  const r = spawnSync(tts.cmd, [...tts.pre, '--lines', tmp, '-d', vdir, ...(D.engine === 'gemini' ? ['--engine', 'gemini-api'] : [])], { stdio: 'inherit' });
  if (r.status !== 0) die('tts-vi lỗi (xem log ở trên)');
  Object.assign(engines, readJSON(path.join(vdir, 'engine.json'), {}));
  writeJSON(path.join(vdir, 'engines.json'), engines);
  for (const l of todo) man[l.id] = sig(l);
  writeJSON(manPath, man);
  const used = Object.values(engines).reduce((a, e) => ((a[e] = (a[e] ?? 0) + 1), a), {});
  console.log(`voice: xong · engine: ${Object.entries(used).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

function timing() {
  const r = buildTiming(epDir);
  const target = episode.target ?? null;
  console.log(`timing: ${r.timed.scenes.length} cảnh · ${r.seconds.toFixed(1)}s${target ? ` (mục tiêu ${target}s)` : ''}${r.estimated ? ` · ước lượng ${r.estimated}/${r.total} câu` : ''}`);
  return r;
}

function audio() {
  const r = spawnSync('uv', ['run', '--project', ROOT, path.join(ROOT, 'tools/audio/mix.py'), epDir], { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) die('trộn âm thanh lỗi');
}

function script() {
  const r = buildTiming(epDir);
  const fps = r.timed.fps;
  const sum = (p) => {
    const keys = Object.entries(p ?? {}).filter(([k]) => !['bg'].includes(k));
    return keys.map(([k, v]) => `**${k}**: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('<br>').replace(/\|/g, '\\|');
  };
  const rows = r.timed.scenes.map((s, i) => {
    const src = episode.scenes[i];
    const lines = (src.lines ?? []).map((l) => (typeof l === 'string' ? l : `${l.speaker ? `[${l.speaker}] ` : ''}${l.text}`)).join('<br>');
    const ch = s.character ? `<br>👤 ${s.character.id} · ${s.character.pose ?? 'dung'} · ${s.character.position ?? ''}` : '';
    return `| ${i + 1} | \`${s.type}\`${ch} | ${sum(src.props)} | ${lines.replace(/\|/g, '\\|')} | ${(s.duration / fps).toFixed(1)}s · ${s.transition.type} |`;
  });
  const md = `# ${bible.name} — Tập ${episode.number}: ${episode.title}

- Khung: ${episode.format ?? bible.format ?? '9:16'} · ${fps} fps · thời lượng ${r.estimated ? 'ước lượng' : ''} **${r.seconds.toFixed(1)} giây**${episode.target ? ` (mục tiêu ${episode.target}s)` : ''}
- Giọng: ${bible.voice ?? 'mặc định tts-vi'} · Nhạc: ${episode.music === null ? 'tắt' : (episode.music?.mood ?? bible.music?.mood ?? 'lofi')} · Phụ đề: ${r.timed.theme.captionStyle}
${episode.logline ? `- Ý chính: ${episode.logline}\n` : ''}
| # | Cảnh | Hình / chữ trên màn hình | Lời đọc | Thời lượng · chuyển |
|---|---|---|---|---|
${rows.join('\n')}

_Sinh tự động từ episode.json bằng \`pnpm ep ${rel(epDir)} script\` — sửa episode.json rồi chạy lại._
`;
  fs.writeFileSync(path.join(epDir, 'script.md'), md);
  console.log(`script: ${rel(path.join(epDir, 'script.md'))}`);
}

async function storyboard() {
  check();
  const r = buildTiming(epDir);
  const { renderStoryboard } = await import('./render.mjs');
  const { props, files } = await renderStoryboard(epDir);
  const fps = props.fps;
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const audioPlan = readJSON(path.join(epDir, dirs().build, 'audio.json'));
  const cards = props.scenes.map((s, i) => {
    const sfx = audioPlan.cues.filter((c) => c.t * fps >= s.from && c.t * fps < s.from + s.duration).map((c) => c.name);
    const uniq = [...new Set(sfx)];
    return `<article><img src="${files[i]}" loading="lazy"><div class="m"><b>${i + 1}</b><span class="t">${esc(s.type)}</span><span>${(s.duration / fps).toFixed(1)}s</span>${i ? `<span>↪ ${esc(s.transition.type)}</span>` : ''}</div>
<p>${s.lines.map((l) => esc(l.text)).join('<br>') || '<i>(không lời)</i>'}</p>${uniq.length ? `<p class="sfx">♪ ${uniq.map(esc).join(' · ')}</p>` : ''}${s.character ? `<p class="sfx">👤 ${esc(s.character.id)} · ${esc(s.character.pose ?? 'dung')}</p>` : ''}</article>`;
  });
  const portrait = props.height > props.width;
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Storyboard · ${esc(episode.title)}</title>
<style>:root{--bg:#f4f2ec;--fg:#1d2028;--mut:#6b7080;--card:#fff;--ac:#e2342b}@media (prefers-color-scheme:dark){:root{--bg:#121419;--fg:#eceef3;--mut:#9aa0ad;--card:#1c1f27}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,'Google Sans',sans-serif;padding:24px 16px}h1{margin:0 0 4px;font-size:22px}.sub{color:var(--mut);margin-bottom:20px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(${portrait ? 220 : 340}px,1fr));gap:16px}article{background:var(--card);border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.08)}img{width:100%;display:block;aspect-ratio:${props.width}/${props.height};object-fit:cover;background:#000}
.m{display:flex;gap:8px;align-items:center;padding:10px 12px 0;font-size:13px;color:var(--mut)}.m b{background:var(--ac);color:#fff;border-radius:6px;padding:0 7px}.m .t{font-weight:700;color:var(--fg)}p{margin:6px 12px 12px;font-size:14px}.sfx{color:var(--mut);font-size:12.5px;margin-top:-6px}</style></head>
<body><h1>${esc(bible.name)} · Tập ${episode.number}: ${esc(episode.title)}</h1><div class="sub">${props.scenes.length} cảnh · ${(props.durationInFrames / fps).toFixed(1)} giây${r.estimated ? ' (ước lượng — chưa có voice thật)' : ''} · ${props.width}×${props.height}</div>
<div class="g">${cards.join('\n')}</div></body></html>`;
  fs.writeFileSync(path.join(epDir, 'storyboard/index.html'), html);
  console.log(`storyboard: ${files.length} cảnh → ${rel(path.join(epDir, 'storyboard/index.html'))}`);
}

async function render() {
  const { renderVideo } = await import('./render.mjs');
  await renderVideo(epDir, { preview: flags.has('--preview') });
  if (flags.has('--preview')) return;
  // lịch hình của bản MP4 vừa dựng — voice-fix ghép tiếng mới theo đúng lịch này
  fs.copyFileSync(path.join(epDir, dirs().build, 'timed.json'), path.join(epDir, dirs().build, 'rendered.json'));
  if (flags.has('--gemini')) return; // bản so sánh Gemini không chép ra thư mục xuất
  await exportOut();
}

async function exportOut() {
  const { exportEpisode, displayPath } = await import('./output.mjs');
  const dst = exportEpisode(path.dirname(path.dirname(epDir)), path.basename(epDir));
  if (dst) console.log(`  xuất → ${displayPath(dst)}`);
}

// ───── chỉ sửa giọng (memory-bank bẫy 29)
// Câu mới được đặt vào đúng chỗ (khung hình) của câu cũ: ngắn hơn → để lặng phần thừa; dài hơn tối đa FIT_FAST → nói nhanh lên (atempo, giữ cao độ).
const FIT_FAST = 1.12, FIT_SLOW = 0.7;
async function voiceFix() {
  const D = dirs();
  const b = (f) => path.join(epDir, D.build, f);
  const mp4 = path.join(epDir, 'out', `${episode.id}${D.out}.mp4`);
  const t0 = Date.now();
  // lịch hình của bản đã dựng: rendered.json (ghi sau mỗi lần render); bản dựng trước khi có tính năng này → timed.json nếu không mới hơn MP4
  let old = readJSON(b('rendered.json'), null);
  if (!old && fs.existsSync(mp4) && fs.existsSync(b('timed.json')) && fs.statSync(b('timed.json')).mtimeMs <= fs.statSync(mp4).mtimeMs) old = readJSON(b('timed.json'));
  const full = async (why) => {
    console.log(`voice-fix: ${why} → dựng lại đầy đủ`);
    timing(); audio(); await render();
  };
  check();
  voice();
  if (!fs.existsSync(mp4) || !old) return full('chưa có bản dựng trước (hoặc không rõ lịch hình của nó) để ghép tiếng');
  const fps = old.fps;
  const slots = {};
  for (const s of old.scenes) for (const l of s.lines) slots[l.id] = (l.to - l.from) / fps;
  // dựng lại lịch với thời lượng câu cũ: trùng khít bản đã render nghĩa là hình + chữ không đổi, chỉ giọng đổi
  const sim = buildTiming(epDir, { durOverride: slots, write: false });
  if (JSON.stringify(sim.timed) !== JSON.stringify(old)) return full('hình, chữ trên màn hình hoặc số câu đã đổi — không chỉ giọng');
  const dur = readJSON(path.join(epDir, D.voice, 'dur.json'), {});
  const fitDir = b('voice-fit');
  fs.rmSync(fitDir, { recursive: true, force: true });
  const plan = [];
  for (const v of sim.audio.voiceLines) {
    const slot = slots[v.id], d = dur[v.id];
    if (d == null) return full(`câu ${v.id} chưa có giọng`);
    const r = d / slot;
    if (Math.abs(r - 1) < 0.02) continue;
    const pct = `${r > 1 ? '+' : ''}${Math.round((r - 1) * 100)}%`;
    if (r > FIT_FAST) return full(`câu ${v.id} dài hơn chỗ cũ ${pct} (tối đa +${Math.round((FIT_FAST - 1) * 100)}%)`);
    if (r < FIT_SLOW) return full(`câu ${v.id} ngắn hơn chỗ cũ ${pct} — miệng nhân vật và phụ đề sẽ lệch rõ`);
    plan.push({ v, r, pct });
  }
  for (const { v, r } of plan.filter((p) => p.r > 1)) {
    fs.mkdirSync(fitDir, { recursive: true });
    const out = path.join(fitDir, `${v.id}.wav`);
    const f = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(epDir, v.file), '-filter:a', `atempo=${r.toFixed(4)}`, out], { stdio: 'inherit' });
    if (f.status !== 0) die(`ffmpeg lỗi khi nén câu ${v.id}`);
    v.file = `${D.build}/voice-fit/${v.id}.wav`;
  }
  plan.forEach((p) => console.log(`  ${p.v.id}: ${p.pct} so với chỗ cũ → ${p.r > 1 ? 'nói nhanh lên cho vừa' : 'để lặng phần thừa'}`));
  // ghi lại lịch đúng như bản đã render (timed.json, phụ đề .srt) rồi trộn âm theo lịch đó
  buildTiming(epDir, { durOverride: slots });
  writeJSON(b('audio.json'), sim.audio);
  audio();
  const tmp = mp4.replace(/\.mp4$/, '.voice-fix.mp4');
  const mux = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-i', b('mix.wav'), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-t', (old.durationInFrames / fps).toFixed(3), '-movflags', '+faststart', tmp], { stdio: 'inherit' });
  if (mux.status !== 0 || !fs.existsSync(tmp)) { fs.rmSync(tmp, { force: true }); die('ffmpeg lỗi khi ghép tiếng vào MP4'); }
  fs.renameSync(tmp, mp4);
  fs.copyFileSync(b('timed.json'), b('rendered.json'));
  console.log(`  xong ${((Date.now() - t0) / 1000).toFixed(0)}s → ${rel(mp4)} (chỉ thay tiếng, giữ nguyên hình)`);
  if (!flags.has('--gemini')) await exportOut();
}

async function studio() {
  const { preparePublic, loadProps } = await import('./render.mjs');
  const pub = preparePublic(epDir);
  const props = path.join(epDir, dirs().build, 'props.json');
  writeJSON(props, loadProps(epDir));
  spawnBin(which('npx') ?? 'npx', ['remotion', 'studio', 'remotion/index.ts', `--props=${props}`, `--public-dir=${pub}`], { stdio: 'inherit', cwd: ROOT });
}

const steps = { check, script, storyboard, voice, timing, audio, render, studio, 'voice-fix': voiceFix };
if (step === 'all') {
  check(); voice(); timing(); audio(); await render();
} else if (steps[step]) await steps[step]();
else die(`không có bước "${step}"`);
