// Sinh docs/lemo-styles.md từ thư viện lemo-opuscar (~/lemo-opuscar/styles/*/style.json).
// Chạy lại mỗi khi thư viện cập nhật: pnpm series styles
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from './lib.mjs';
import { isMain } from './platform.mjs';

export function buildLemoStyles(lib = process.env.LEMO_LIB || path.join(os.homedir(), 'lemo-opuscar')) {
  const dir = path.join(lib, 'styles');
  if (!fs.existsSync(dir)) throw new Error(`không thấy thư viện lemo-opuscar ở ${lib}`);
  const list = fs.readdirSync(dir)
    .map((d) => path.join(dir, d, 'style.json'))
    .filter((f) => fs.existsSync(f))
    .map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))
    .sort((a, b) => (a.category_en || '').localeCompare(b.category_en || '') || Number(a.num) - Number(b.num));
  let rev = '';
  try { rev = fs.readFileSync(path.join(lib, '.git/HEAD'), 'utf8').trim(); if (rev.startsWith('ref:')) rev = fs.readFileSync(path.join(lib, '.git', rev.slice(5)), 'utf8').trim(); } catch {}
  const out = [`# Phong cách lemo-opuscar (${list.length})`, '',
    `Sinh tự động từ \`${lib.replace(os.homedir(), '~')}\`${rev ? ` @ ${rev.slice(0, 7)}` : ''} — đừng sửa tay, chạy \`pnpm series styles\`.`,
    'Chọn phong cách cho một tập: `"engine": "lemo-opuscar", "style": "<folder>"` trong episode.json → gọi skill `lemo-opuscar:lemo-opuscar` với kịch bản đã duyệt + voice của xưởng.', ''];
  let cat = '';
  for (const s of list) {
    if (s.category_en !== cat) { cat = s.category_en; out.push('', `## ${cat}`, '', '| Folder | Phong cách | Hợp cho |', '|---|---|---|'); }
    out.push(`| \`${s.slug}\` | ${s.en} (${s.cn}) | ${(s.uses || []).join(', ')} |`);
  }
  fs.writeFileSync(path.join(ROOT, 'docs/lemo-styles.md'), out.join('\n') + '\n');
  return list.length;
}
if (isMain(import.meta.url)) console.log(`lemo-opuscar: ${buildLemoStyles()} phong cách → docs/lemo-styles.md`);
