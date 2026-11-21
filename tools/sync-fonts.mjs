// Chép font tiếng Việt (OFL) từ @fontsource vào assets/fonts + sinh fonts.json (cho Remotion) và fonts.css (cho HTML/HyperFrames).
// Thêm font: cài @fontsource/<ten> rồi thêm vào FAMILIES.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/fonts');
const SUBSETS = ['vietnamese', 'latin-ext', 'latin'];

// family hiển thị → gói fontsource + các độ đậm cần dùng
export const FAMILIES = {
  Barlow: { pkg: 'barlow', weights: [500, 600, 700, 800, 900] },           // tiêu đề, số lớn
  'Google Sans': { pkg: 'google-sans', weights: [400, 500, 600, 700] },     // nội dung, phụ đề, bóng thoại
  'JetBrains Mono': { pkg: 'jetbrains-mono', weights: [400, 700] },
};

fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
const css = [];
for (const [family, { pkg, weights }] of Object.entries(FAMILIES)) {
  const dir = path.join(ROOT, 'node_modules/@fontsource', pkg);
  for (const w of weights) {
    const src = fs.readFileSync(path.join(dir, `${w}.css`), 'utf8');
    for (const block of src.split('@font-face').slice(1)) {
      const file = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
      const range = block.match(/unicode-range:\s*([^;]+);/)?.[1];
      if (!file || !/-normal\.woff2$/.test(file)) continue;
      if (!SUBSETS.some((s) => file.includes(`-${s}-${w}-`))) continue;
      fs.copyFileSync(path.join(dir, 'files', file), path.join(OUT, file));
      manifest.push({ family, weight: String(w), file, unicodeRange: range });
      css.push(`@font-face{font-family:'${family}';font-weight:${w};font-style:normal;font-display:block;src:url(${file}) format('woff2');unicode-range:${range}}`);
    }
  }
}
fs.writeFileSync(path.join(OUT, 'fonts.json'), JSON.stringify(manifest, null, 1));
// bản nhúng sẵn (base64) cho Remotion: không phải tải font lúc render → không thể treo
fs.writeFileSync(path.join(OUT, 'fonts-inline.json'), JSON.stringify(manifest.map((f) => ({ ...f, data: fs.readFileSync(path.join(OUT, f.file)).toString('base64') }))));
fs.writeFileSync(path.join(OUT, 'fonts.css'), css.join('\n') + '\n');
console.log(`fonts: ${manifest.length} tệp, ${Object.keys(FAMILIES).length} họ → assets/fonts`);
