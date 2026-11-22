#!/usr/bin/env node
// Lệnh cấp series.  node tools/series.mjs <lệnh> <slug> [...]
//   new <slug> "Tên series"   tạo khung series/<slug>/ (brief.md, bible.json, plan.json)
//   plan <slug>               sinh plan.html — trang duyệt kế hoạch sơ bộ (bộ nhận diện + dàn ý từng tập)
//   characters <slug>         vẽ bảng nhân vật (mọi tư thế) → characters.png
//   characters <slug> --huong vẽ bảng kiểm tra hướng cử chỉ (mọi tư thế khi quay sang phải / sang trái) → characters-huong.png
//   ep <slug> <số>            tạo khung thư mục tập epNN/ với episode.json mẫu
//   status <slug>             tình trạng từng tập
//   export <slug>             chép mọi phim đã dựng vào thư mục xuất chung (tools/output.mjs)
//   styles                    cập nhật danh mục phong cách lemo-opuscar → docs/lemo-styles.md
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, die, readJSON, resolveTheme, writeJSON } from './lib.mjs';

import { buildLemoStyles } from './lemo-styles.mjs';

const [, , cmd, slug, ...args] = process.argv;
if (cmd === 'styles') { console.log(`lemo-opuscar: ${buildLemoStyles()} phong cách → docs/lemo-styles.md`); process.exit(0); }
if (!cmd || !slug) die('cách dùng: node tools/series.mjs <new|plan|characters|ep|status|export> <slug> …');
const dir = path.join(ROOT, 'series', slug);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const STATUS = { 'de-xuat': 'Đề xuất', duyet: 'Đã duyệt', 'kich-ban': 'Có kịch bản', storyboard: 'Có storyboard', voice: 'Đã đọc voice', xong: 'Đã xuất MP4' };

if (cmd === 'new') {
  if (fs.existsSync(dir)) die(`đã có ${dir}`);
  const name = args[0] ?? slug;
  fs.mkdirSync(path.join(dir, 'episodes'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'brief.md'), `# Brief — ${name}\n\n- Ý tưởng:\n- Số tập:\n- Thời lượng mỗi tập:\n- Phong cách:\n- Khung hình: 9:16\n- Nhân vật: đồng nhất / mỗi tập khác / không\n- Khán giả:\n- Ghi chú:\n`);
  writeJSON(path.join(dir, 'bible.json'), {
    name, slug, channel: '', episodes: 0, format: '9:16', fps: 30, engine: 'remotion',
    theme: { preset: 'misa-vang' }, captions: 'pill', voice: 'Hải Đăng', voices: {}, narrator: null,
    characterMode: 'khong', characters: [], music: { mood: 'lofi', volume: 0.14 }, sfx: { auto: true, volume: 0.6 },
    transition: { type: 'slide', frames: 12 }, chrome: { handle: true, progress: true, tag: true },
  });
  writeJSON(path.join(dir, 'plan.json'), { brief: {}, episodes: [] });
  console.log(`series: tạo ${path.relative(process.cwd(), dir)}`);
} else if (cmd === 'ep') {
  const n = +args[0];
  const id = `ep${String(n).padStart(2, '0')}`;
  const ed = path.join(dir, 'episodes', id);
  if (fs.existsSync(path.join(ed, 'episode.json'))) die(`đã có ${ed}/episode.json`);
  const p = readJSON(path.join(dir, 'plan.json'), { episodes: [] }).episodes.find((e) => e.number === n) ?? {};
  writeJSON(path.join(ed, 'episode.json'), { id, number: n, title: p.title ?? '', logline: p.logline ?? '', target: p.duration ?? 60, scenes: [] });
  fs.mkdirSync(path.join(ed, 'assets'), { recursive: true });
  console.log(`tập: ${path.relative(process.cwd(), ed)}`);
} else if (cmd === 'characters') {
  const bible = readJSON(path.join(dir, 'bible.json'));
  if (!bible?.characters?.length) die('bible.characters trống');
  const { renderCharacterSheet } = await import('./render.mjs');
  const out = await renderCharacterSheet(dir, bible.characters, process.argv.includes('--huong') ? { faces: [1, -1] } : {});
  console.log(`nhân vật: ${path.relative(process.cwd(), out)}`);
} else if (cmd === 'export') {
  const { exportEpisode, displayPath, seriesOutputDir } = await import('./output.mjs');
  const eps = fs.existsSync(path.join(dir, 'episodes')) ? fs.readdirSync(path.join(dir, 'episodes')).filter((d) => /^ep\d+$/.test(d)).sort() : [];
  let n = 0;
  for (const id of eps) { const d = exportEpisode(dir, id); if (d) { n++; console.log(`  ${id} → ${displayPath(d)}`); } }
  console.log(`xuất: ${n} phim → ${displayPath(seriesOutputDir(readJSON(path.join(dir, 'bible.json'), {}).name ?? slug))}`);
} else if (cmd === 'status') {
  const plan = readJSON(path.join(dir, 'plan.json'), { episodes: [] });
  for (const e of plan.episodes) {
    const ed = path.join(dir, 'episodes', e.id ?? `ep${String(e.number).padStart(2, '0')}`);
    const has = (p) => fs.existsSync(path.join(ed, p));
    const st = has(`out/${e.id}.mp4`) ? 'xong' : has('voice/dur.json') ? 'voice' : has('storyboard/index.html') ? 'storyboard' : has('episode.json') ? 'kich-ban' : e.status ?? 'de-xuat';
    console.log(`  ${String(e.number).padStart(2)}. ${e.title}  —  ${STATUS[st] ?? st}`);
  }
} else if (cmd === 'plan') {
  const bible = readJSON(path.join(dir, 'bible.json'));
  const plan = readJSON(path.join(dir, 'plan.json'));
  if (!bible || !plan) die('thiếu bible.json hoặc plan.json');
  const th = resolveTheme(bible);
  const b = plan.brief ?? {};
  const sw = ['bg', 'card', 'fg', 'accent', 'accent2', 'good', 'bad'].map((k) => `<div class="sw"><i style="background:${th[k]}"></i><span>${k}<br><code>${th[k]}</code></span></div>`).join('');
  const charImg = fs.existsSync(path.join(dir, 'characters.png')) ? `<img class="chars" src="characters.png" alt="Bảng nhân vật">` : '';
  const chars = (bible.characters ?? []).map((c) => `<li><b>${esc(c.name)}</b> · ${c.gender === 'nu' ? 'nữ' : 'nam'} · tóc ${esc(c.hair ?? '')}${c.glasses ? ' · đeo kính' : ''} · giọng ${esc(bible.voices?.[c.id] ?? bible.voice)}${c.role ? ` — ${esc(c.role)}` : ''}</li>`).join('');
  const eps = plan.episodes.map((e) => `<article><header><span class="n">${String(e.number).padStart(2, '0')}</span><div><h3>${esc(e.title)}</h3><div class="meta">${e.duration ?? ''}s · ${esc(STATUS[e.status] ?? e.status ?? 'Đề xuất')}${e.format ? ` · ${esc(e.format)}` : ''}</div></div></header>
<p class="log">${esc(e.logline)}</p>
${e.hook ? `<p><span class="k">Mở đầu</span>${esc(e.hook)}</p>` : ''}
${e.beats?.length ? `<ol>${e.beats.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
${e.visual ? `<p><span class="k">Hình</span>${esc(e.visual)}</p>` : ''}
${e.cta ? `<p><span class="k">Kết</span>${esc(e.cta)}</p>` : ''}</article>`).join('\n');
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kế hoạch · ${esc(bible.name)}</title>
<style>:root{--bg:#f5f3ee;--fg:#1d2028;--mut:#666c7a;--card:#fff;--line:#e4e1d8;--ac:#e2342b;--y:#f4d81c}@media (prefers-color-scheme:dark){:root{--bg:#111318;--fg:#eceef3;--mut:#9aa0ad;--card:#1b1e26;--line:#2a2e38}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15.5px/1.6 system-ui,'Google Sans',sans-serif}main{max-width:1100px;margin:0 auto;padding:28px 16px 60px}
h1{font-size:30px;line-height:1.2;margin:0}.lead{color:var(--mut);margin:6px 0 24px}h2{font-size:19px;margin:34px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--line)}
.brief{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.brief div{background:var(--card);border-radius:12px;padding:10px 14px}.brief b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}
.sws{display:flex;flex-wrap:wrap;gap:12px}.sw{display:flex;gap:8px;align-items:center;font-size:12.5px}.sw i{width:38px;height:38px;border-radius:10px;border:1px solid var(--line)}code{font-size:11.5px;color:var(--mut)}
.chars{width:100%;border-radius:14px;margin-top:12px;background:#f3f1ea}
.eps{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}article{background:var(--card);border-radius:16px;padding:18px 18px 8px;border:1px solid var(--line)}
article header{display:flex;gap:12px;align-items:center}.n{font:800 26px/1 system-ui;background:var(--y);color:#222;border-radius:12px;padding:10px 10px}h3{margin:0;font-size:17px;line-height:1.3}.meta{font-size:12.5px;color:var(--mut)}
.log{font-weight:600;margin:12px 0 8px}ol{margin:6px 0 10px;padding-left:20px}ol li{margin:2px 0}.k{display:inline-block;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ac);margin-right:8px}article p{margin:6px 0}</style></head>
<body><main><h1>${esc(bible.name)}</h1><p class="lead">Kế hoạch sơ bộ · ${plan.episodes.length} tập · ${esc(bible.format)} · ${esc(bible.channel ?? '')}</p>
<h2>Brief</h2><div class="brief">${Object.entries({ 'Ý tưởng': b.idea, 'Số tập': b.episodes, 'Thời lượng': b.duration, 'Phong cách': b.style, 'Khán giả': b.audience, 'Nhân vật': b.characterMode, 'Nền tảng': b.platform }).filter(([, v]) => v).map(([k, v]) => `<div><b>${k}</b>${esc(v)}</div>`).join('')}</div>
<h2>Bộ nhận diện</h2><div class="sws">${sw}</div><p>Font: <b>${esc(th.fontDisplay)}</b> / ${esc(th.fontBody)} · Phụ đề: ${esc(th.captionStyle)} · Nhạc nền: ${esc(bible.music?.mood ?? 'tắt')} · Giọng đọc: <b>${esc(bible.voice)}</b> · Chuyển cảnh: ${esc(bible.transition?.type ?? 'slide')}</p>
${chars ? `<h2>Nhân vật</h2><ul>${chars}</ul>${charImg}` : ''}
<h2>Các tập</h2><div class="eps">${eps}</div></main></body></html>`;
  fs.writeFileSync(path.join(dir, 'plan.html'), html);
  console.log(`kế hoạch: ${path.relative(process.cwd(), path.join(dir, 'plan.html'))}`);
} else die(`không có lệnh "${cmd}"`);
