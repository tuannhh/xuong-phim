// Render bằng Remotion (bundle 1 lần): storyboard (ảnh tĩnh mỗi cảnh) hoặc video MP4.
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { ROOT, copyDir, dirs, readJSON } from './lib.mjs';

// Thư mục public riêng cho mỗi tập: font, logo, SFX dùng chung + assets/ và mix.wav của tập.
export function preparePublic(epDir) {
  const pub = path.join(epDir, dirs().build, 'public');
  fs.rmSync(pub, { recursive: true, force: true });
  fs.mkdirSync(pub, { recursive: true });
  copyDir(path.join(ROOT, 'assets/fonts'), path.join(pub, 'fonts'));
  copyDir(path.join(ROOT, 'assets/brand'), path.join(pub, 'brand'));
  if (fs.existsSync(path.join(epDir, 'assets'))) copyDir(path.join(epDir, 'assets'), path.join(pub, 'assets'));
  // ảnh dùng chung cả series (logo watermark, ảnh mascot) — series/<slug>/assets/ → series-assets/
  const sAssets = path.join(path.dirname(path.dirname(epDir)), 'assets');
  if (fs.existsSync(sAssets)) copyDir(sAssets, path.join(pub, 'series-assets'));
  const mix = path.join(epDir, dirs().build, 'mix.wav');
  if (fs.existsSync(mix)) fs.copyFileSync(mix, path.join(pub, 'mix.wav'));
  return pub;
}

async function make(epDir, publicDir) {
  const t = Date.now();
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'remotion/index.ts'), publicDir, outDir: path.join(epDir, dirs().build, 'bundle') });
  console.log(`  bundle ${((Date.now() - t) / 1000).toFixed(1)}s`);
  return serveUrl;
}

export function loadProps(epDir, { still = false } = {}) {
  const timed = readJSON(path.join(epDir, dirs().build, 'timed.json'));
  if (!timed) throw new Error('chưa có build/timed.json — chạy timing trước');
  const mouth = readJSON(path.join(epDir, dirs().build, 'mouth.json'), {});
  const hasMix = fs.existsSync(path.join(epDir, dirs().build, 'mix.wav'));
  return { ...timed, mouth, still, audio: hasMix && !still ? 'mix.wav' : null };
}

// Frame chụp storyboard cho mỗi cảnh: lúc mọi thứ đã hiện, trước khi chuyển cảnh sau.
export function storyboardFrames(timed) {
  return timed.scenes.map((s, i) => {
    const next = timed.scenes[i + 1];
    const Tn = next ? next.transition.frames : 0;
    const f = s.from + s.duration - Tn - Math.round(timed.fps * 0.25);
    return Math.max(s.from + s.transition.frames + 1, Math.min(f, timed.durationInFrames - 1));
  });
}

// Dòng tiến độ: ở terminal ghi đè tại chỗ (`\r`); khi bị gọi từ trang web (stdout là pipe) mỗi mốc một dòng để hiện ngay.
const TTY = !!process.stdout.isTTY;
const progressLine = (t) => process.stdout.write(TTY ? `\r${t}` : `${t}\n`);
const progressDone = () => TTY && process.stdout.write('\n');

export async function renderStoryboard(epDir) {
  const props = loadProps(epDir, { still: true });
  const serveUrl = await make(epDir, preparePublic(epDir));
  const comp = await selectComposition({ serveUrl, id: 'Episode', inputProps: props });
  const frames = storyboardFrames(props);
  const out = path.join(epDir, 'storyboard');
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (f.endsWith('.jpg')) fs.rmSync(path.join(out, f));
  const files = [];
  const layout = {};
  for (let i = 0; i < frames.length; i++) {
    const file = path.join(out, `${String(i + 1).padStart(2, '0')}-${props.scenes[i].id}.jpg`);
    const sid = props.scenes[i].id;
    await renderStill({
      composition: comp, serveUrl, inputProps: props, frame: frames[i], output: file, imageFormat: 'jpeg', jpegQuality: 82, scale: 0.5,
      onBrowserLog: (l) => { const m = l.text.match(/^LAYOUT (.*)$/); if (m) layout[sid] = JSON.parse(m[1]).issues; },
    });
    files.push(path.basename(file));
    progressLine(`  ảnh ${i + 1}/${frames.length}`);
  }
  progressDone();
  fs.writeFileSync(path.join(out, 'layout.json'), JSON.stringify(layout, null, 1));
  const bad = Object.entries(layout).filter(([, v]) => v.length);
  if (bad.length) { console.log(`  ⚠ bố cục: ${bad.length} cảnh có chồng lấn/tràn:`); for (const [k, v] of bad) for (const x of v) console.log(`    ${k}: ${x}`); }
  else console.log('  ✓ bố cục: không chữ nào đè chữ, đè nhân vật hay tràn khung');
  return { props, files, frames, layout };
}

export async function renderVideo(epDir, { preview = false } = {}) {
  const props = loadProps(epDir);
  if (!props.audio) console.log('  ! chưa có build/mix.wav — video sẽ không có tiếng');
  const serveUrl = await make(epDir, preparePublic(epDir));
  const comp = await selectComposition({ serveUrl, id: 'Episode', inputProps: props });
  const name = `${props.episode.id}${dirs().out}${preview ? '-preview' : ''}.mp4`;
  const output = path.join(epDir, 'out', name);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const t = Date.now();
  let last = -1;
  await renderMedia({
    composition: comp, serveUrl, inputProps: props, codec: 'h264', outputLocation: output,
    crf: preview ? 28 : 18, scale: preview ? 0.5 : 1, audioBitrate: '192k', pixelFormat: 'yuv420p',
    concurrency: Math.max(2, Math.min(4, Math.floor((await import('node:os')).cpus().length / 2))),
    timeoutInMilliseconds: 120000,
    // In mỗi khi qua một mốc 5% (tiến độ hay nhảy cóc 36 → 38 → 41: so "đúng bội số 5" sẽ bỏ lỡ mốc và đứng yên mãi — bẫy 20).
    // Kèm số khung đã vẽ để người xem biết máy vẫn chạy. Trang web đọc stdout theo dòng → xuống dòng `\n` (in `\r` thì trang chậm một nhịp).
    onProgress: ({ progress, renderedFrames }) => {
      const p = Math.floor(progress * 100), b = p - (p % 5);
      if (b > last) { last = b; progressLine(`  render ${p}% · khung ${renderedFrames}/${comp.durationInFrames}`); }
    },
  });
  progressDone();
  console.log(`  xong ${((Date.now() - t) / 1000).toFixed(0)}s → ${path.relative(process.cwd(), output)}`);
  return output;
}

// Bảng nhân vật của series (mọi tư thế) → <series>/characters.png
// opts.faces (vd [1, -1]) → bảng kiểm tra hướng cử chỉ: characters-huong.png
export async function renderCharacterSheet(seriesDir, characters, opts = {}) {
  const pub = path.join(seriesDir, '.build/public');
  fs.rmSync(pub, { recursive: true, force: true });
  fs.mkdirSync(pub, { recursive: true });
  copyDir(path.join(ROOT, 'assets/fonts'), path.join(pub, 'fonts'));
  copyDir(path.join(ROOT, 'assets/brand'), path.join(pub, 'brand'));
  // ảnh mascot người dùng tải lên (series/<slug>/assets/) — nhân vật trỏ tới series-assets/<file>
  if (fs.existsSync(path.join(seriesDir, 'assets'))) copyDir(path.join(seriesDir, 'assets'), path.join(pub, 'series-assets'));
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'remotion/index.ts'), publicDir: pub, outDir: path.join(seriesDir, '.build/bundle') });
  const inputProps = opts.faces ? { characters, faces: opts.faces } : { characters };
  const comp = await selectComposition({ serveUrl, id: 'CharacterSheet', inputProps });
  const height = 60 + characters.length * 760;
  const output = path.join(seriesDir, opts.faces ? 'characters-huong.png' : 'characters.png');
  await renderStill({ composition: { ...comp, height }, serveUrl, inputProps, frame: 10, output });
  return output;
}
