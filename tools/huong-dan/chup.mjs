// Chụp màn hình THẬT của trang Xưởng phim cho video hướng dẫn (series/huong-dan-xuong-phim) và tự điền vị trí
// các vùng cần zoom / con trỏ bấm vào episode.json (bước có "el": "<khoá>" → focus [x,y,w,h], cursor [x,y]).
// Giao diện đổi → chạy lại: node tools/huong-dan/chup.mjs  rồi  pnpm ep series/huong-dan-xuong-phim/episodes/ep01 all
// Cần xưởng đang chạy ở http://localhost:4710. Chỉ đọc + bấm thử trên trang, KHÔNG lưu gì (không bấm Tạo series / Lưu).
// Email (tài khoản Google Drive) bị che trước khi chụp.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJSON, writeJSON } from '../lib.mjs';
import { launch } from './cdp.mjs';

const URL0 = process.env.XUONG_URL || 'http://localhost:4710/';
const EP = path.join(ROOT, 'series/huong-dan-xuong-phim/episodes/ep01');
const W = 1440, H = 900, SCALE = 2;
// series có phim đã dựng: chỉ định bằng HUONG_DAN_SERIES, không thì lấy series đầu tiên trên máy có MP4 (series của người dùng không có trên GitHub)
const hasFilm = (d) => { const e = path.join(ROOT, 'series', d, 'episodes'); return fs.existsSync(e) && fs.readdirSync(e).some((x) => fs.existsSync(path.join(e, x, 'out', `${x}.mp4`))); };
const DEMO = process.env.HUONG_DAN_SERIES || (fs.existsSync(path.join(ROOT, 'series')) ? fs.readdirSync(path.join(ROOT, 'series')).find((d) => d !== 'huong-dan-xuong-phim' && hasFilm(d)) : null);
if (!DEMO) { console.error('Cần một series có phim đã dựng để chụp (đặt HUONG_DAN_SERIES=<slug>).'); process.exit(1); }
const DEMO_SB = process.env.HUONG_DAN_SB || DEMO; // series có tập đang chờ duyệt storyboard (không có → giữ ảnh cũ)

// hàm tiện ích nạp vào trang
const HELP = `
window.$t = (sel, text, root = document) => { const all = [...(root ?? document).querySelectorAll(sel)], tx = (e) => e.textContent.replace(/\\s+/g, ' ').trim(); return all.find((e) => tx(e).startsWith(text)) ?? all.find((e) => tx(e).includes(text) && tx(e).length < text.length + 12); };
window.$all = (...words) => [...document.querySelectorAll('div')].filter((e) => words.every((w) => e.textContent.includes(w))).sort((a, b) => a.textContent.length - b.textContent.length)[0];
window.$sec = (title) => [...document.querySelectorAll('.sec')].find((s) => s.querySelector('h2')?.textContent.includes(title));
window.$f = (label, root = document) => [...root.querySelectorAll('.f')].find((f) => f.querySelector(':scope > span')?.textContent.trim().startsWith(label));
window.$set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
window.$top = (el, off = 84) => { const y = el.getBoundingClientRect().top + scrollY - off; scrollTo({ top: Math.max(0, y), behavior: 'instant' }); };
document.documentElement.style.scrollBehavior = 'auto';
if (!document.getElementById('hd-style')) document.head.insertAdjacentHTML('beforeend', '<style id="hd-style">#jobpill{display:none!important}html{scroll-behavior:auto!important}</style>');
window.$wait = async (fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 250)); } return null; };
window.$scrub = () => {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (/[\\w.+-]+@[\\w-]+\\.[\\w.]+/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/[\\w.+-]+@[\\w-]+\\.[\\w.]+/g, 'tai-khoan@…');
  for (const el of document.querySelectorAll('input')) if (/@[\\w-]+\\.[\\w.]+/.test(el.value)) el.value = 'tai-khoan@…';
  const jp = document.getElementById('jobpill'); if (jp) jp.style.display = 'none';
};
`;

// mỗi ảnh: trang, việc chuẩn bị, chỗ cuộn tới, các vùng cần đo (biểu thức JS trả về phần tử)
const SHOTS = [
  { file: '01-trang-chu.jpg', hash: '#/', prep: `for (const c of document.querySelectorAll('.list > *')) if (/Hướng dẫn Xưởng phim|Cảnh giác mã OTP/.test(c.textContent)) c.remove();`, els: { list: `document.querySelector('.list')`, newBtn: `$t('a,button', '+ Tạo series mới')` } },
  {
    file: '02-y-tuong.jpg', hash: '#/new',
    prep: `$set(document.querySelector('input[placeholder^="vd: Người MISA"]'), 'Mẹo an toàn mạng');
      $set(document.querySelector('textarea'), 'Mỗi tập một chiêu lừa đảo qua mạng hay gặp: dấu hiệu nhận biết và cách xử lý, kể bằng tình huống đời thường.');
      const b = [...document.querySelectorAll('button')].filter((x) => x.textContent.includes('Gợi ý'))[2];
      b.click(); await $wait(() => document.querySelectorAll('.sugs .sug').length >= 3, 60000);`,
    els: {
      idea: `$f('Ý tưởng')`,
      sugBtn: `[...document.querySelectorAll('button')].filter((x) => x.textContent.includes('Gợi ý'))[2]`,
      chips: `[...document.querySelectorAll('.sugs')].find((s) => s.children.length)`,
    },
  },
  { file: '03-nguon-quy-mo.jpg', hash: '#/new', scroll: `$sec('Nguồn nội dung')`, els: { source: `$sec('Nguồn nội dung').querySelector('.seg')`, scale: `$sec('Quy mô').querySelector('.grid')` } },
  { file: '04-phong-cach.jpg', hash: '#/new', scroll: `$sec('Phong cách')`, els: { style: `$f('Kiểu kể')`, sets: `$f('Bối cảnh ưu tiên')` } },
  {
    file: '05-nhac-nen.jpg', hash: '#/new', scroll: `$f('Nhạc nền')`,
    prep: `$t('.seg button', 'Nhạc của tôi', $f('Nhạc nền')).click(); await new Promise((r) => setTimeout(r, 300));`,
    els: { musicSeg: `$t('.seg button', 'Nhạc của tôi', $f('Nhạc nền'))`, drop: `$f('Nhạc nền').querySelector('.drop, [class*=drop]') || $f('Nhạc nền')`, volume: `$f('Âm lượng nhạc nền')` },
  },
  {
    file: '06-nhan-vat.jpg', hash: '#/new',
    prep: `$t('button', '+ Mascot').click(); await new Promise((r) => setTimeout(r, 300)); $top(document.querySelectorAll('.chr')[0], 96);`,
    els: { char1: `document.querySelectorAll('.chr')[0]`, mascotBtn: `$t('button', '+ Mascot')`, mascot: `[...document.querySelectorAll('.chr')].at(-1)` },
  },
  {
    file: '07-watermark.jpg', hash: `#/s/${DEMO}/edit`, scroll: `$sec('Watermark')`,
    prep: `const s = $sec('Watermark');
      for (const lab of ['Chữ watermark', 'Logo watermark']) { const c = $t('label', lab, s)?.querySelector('input'); if (c && !c.checked) c.click(); }
      const t = s.querySelector('input[type=text]'); if (t && !t.value) $set(t, '@Người MISA luôn cảnh giác');
      const nx = s.nextElementSibling; if (nx) nx.style.visibility = 'hidden';
      await new Promise((r) => setTimeout(r, 400));`,
    els: { stage: `$sec('Watermark').querySelector('.wmstage') || $sec('Watermark').querySelector('.wm')`, opacity: `$f('Độ đậm nhạt', $sec('Watermark'))` },
  },
  {
    file: '08-ke-hoach.jpg', hash: `#/s/${DEMO}`,
    prep: `const c1 = [...document.querySelectorAll('.card')].find((x) => /^\\s*01/.test(x.textContent)); if (c1) c1.style.display = 'none'; scrollTo({ top: 0, behavior: 'instant' });`,
    els: {
      progress: `$all('Kế hoạch', 'Kịch bản + storyboard', 'Phim', 'đã dựng')`,
      ep: `[...document.querySelectorAll('.ep, .card')].find((x) => /^\\s*02/.test(x.textContent))`,
      writeBtn: `$t('button', 'Viết kịch bản + storyboard', [...document.querySelectorAll('.ep, .card')].find((x) => /^\\s*02/.test(x.textContent)))`,
    },
  },
  {
    file: '09-storyboard.jpg', hash: `#/s/${DEMO_SB}`, need: `$t('button', 'Duyệt và dựng phim')`,
    prep: `const jb = document.getElementById('jobbox'); if (jb) jb.style.display = 'none';
      const d = [...document.querySelectorAll('details')].find((x) => x.querySelector('summary')?.textContent.includes('Storyboard')); if (d) d.open = true;
      await new Promise((r) => setTimeout(r, 900));
      const c = $t('button', 'Duyệt và dựng phim')?.closest('.card'); if (c) $top(c, 96);`,
    els: {
      board: `[...document.querySelectorAll('div')].find((d) => d.querySelectorAll(':scope > img, :scope > a > img').length >= 3)`,
      edit: `[...document.querySelectorAll('details')].find((x) => x.querySelector('summary')?.textContent.includes('Sửa lời thoại'))`,
      approve: `$t('button', 'Duyệt và dựng phim')`,
    },
  },
  {
    file: '10-phim-xong.jpg', hash: `#/s/${DEMO}`,
    prep: `const c = [...document.querySelectorAll('.ep, .card')].find((x) => /^\\s*01/.test(x.textContent)); if (c) $top(c, 96);`,
    els: { video: `document.querySelector('video')`, files: `$t('button,a', 'Tải MP4')?.parentElement`, drive: `$t('div', 'Google Drive:')` },
  },
  { file: '11-thiet-lap-ai.jpg', hash: '#/settings', els: { engine: `$t('.card', 'AI viết kịch bản').querySelector('.seg')`, roles: `$t('.card', 'AI viết kịch bản').querySelector('.airow')` } },
  {
    file: '12-thiet-lap-codex.jpg', hash: '#/settings',
    prep: `$t('.seg button', 'Codex').click(); await $wait(() => document.querySelector('.airow select')?.options.length > 3, 30000); await new Promise((r) => setTimeout(r, 300));`,
    els: { codexModel: `document.querySelector('.airow select')`, refresh: `$t('button', 'Cập nhật danh sách model')` },
  },
  { file: '13-tu-mo.jpg', hash: '#/settings', scroll: `$t('.card', 'Tự mở Xưởng phim')`, els: { auto: `$t('.card', 'Tự mở Xưởng phim').querySelector('label.ck')` } },
];

const only = process.argv[2];
const b = await launch({ width: W, height: H, scale: SCALE });
const rects = {};
try {
  for (const s of SHOTS) {
    if (only && !s.file.includes(only)) continue;
    await b.goto('about:blank', 50);
    await b.goto(URL0 + s.hash, 2200);
    await b.evaluate(HELP);
    if (s.need && !(await b.evaluate(`return !!(${s.need})`))) { console.log(`– ${s.file}: trang không có thứ cần chụp (vd chưa có tập chờ duyệt storyboard — đặt HUONG_DAN_SB=<series>) → giữ ảnh cũ`); continue; }
    if (s.scroll) await b.evaluate(`const e = ${s.scroll}; if (e) $top(e);`);
    if (s.prep) await b.evaluate(s.prep);
    if (s.scroll && s.prep) await b.evaluate(`const e = ${s.scroll}; if (e) $top(e);`);
    await b.evaluate('$scrub(); document.activeElement?.blur();');
    await b.sleep(500);
    const r = await b.evaluate(`const out = {}; ${Object.entries(s.els ?? {}).map(([k, e]) => `{ const el = ${e}; if (el) { const q = el.getBoundingClientRect(); out[${JSON.stringify(k)}] = [q.left, q.top, q.width, q.height]; } }`).join('\n')} return out;`);
    const shot = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 });
    fs.mkdirSync(path.join(EP, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(EP, 'assets', s.file), Buffer.from(shot.data, 'base64'));
    rects[s.file] = r;
    const miss = Object.keys(s.els ?? {}).filter((k) => !r[k]);
    console.log(`✓ ${s.file}${miss.length ? `  (không thấy: ${miss.join(', ')})` : ''}`);
  }
} finally { await b.close(); }

// điền focus/cursor vào episode.json theo vùng đo được (tỉ lệ khung nhìn, nới 10px, cắt trong khung)
const epFile = path.join(EP, 'episode.json');
const ep = readJSON(epFile);
const pad = 10;
let filled = 0;
for (const sc of ep.scenes) {
  const name = path.basename(sc.props?.src ?? '');
  const r = rects[name];
  if (!r) continue;
  for (const st of sc.props.steps ?? []) {
    const q = st.el && r[st.el];
    if (!q) continue;
    let [x, y, w, h] = q;
    x = Math.max(0, x - pad); y = Math.max(0, y - pad); w = Math.min(W - x, w + pad * 2); h = Math.min(H - y, h + pad * 2);
    const n = (v, d) => +(v / d).toFixed(4);
    st.focus = [n(x, W), n(y, H), n(w, W), n(h, H)];
    if (st.click) st.cursor = st.cursorAt === 'left' ? [n(x + pad + 12, W), n(y + h * 0.5, H)] : [n(x + w * 0.5, W), n(y + h * 0.55, H)];
    filled++;
  }
}
writeJSON(epFile, ep);
console.log(`→ ${Object.keys(rects).length} ảnh ở ${path.relative(ROOT, path.join(EP, 'assets'))}; điền ${filled} vùng vào episode.json`);
