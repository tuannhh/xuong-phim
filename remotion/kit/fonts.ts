import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import fonts from '../../assets/fonts/fonts-inline.json';

// Font tiếng Việt nhúng sẵn (base64, sinh bởi tools/sync-fonts.mjs). Khai báo @font-face một lần,
// rồi mỗi component gốc (Episode, CharacterSheet) giữ một delayRender tới khi font giải mã xong.
// (delayRender ở cấp module không được giải phóng đúng khi render nhiều tab — phải đặt trong component.)
type F = { family: string; weight: string; unicodeRange: string; data: string };
let ready: Promise<unknown> | null = null;
const loadAll = () => {
  if (ready) return ready;
  const list = fonts as F[];
  const style = document.createElement('style');
  style.textContent = list
    .map((f) => `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${f.data}) format('woff2');unicode-range:${f.unicodeRange}}`)
    .join('\n');
  document.head.appendChild(style);
  const combos = [...new Set(list.map((f) => `${f.weight}|${f.family}`))];
  const sample = 'Aa Ăă Ââ Đđ Êê Ôô Ơơ Ưư Ạạ Ảả Ấấ Ầầ Ẩẩ Ẫẫ Ậậ 0123';
  ready = Promise.race([
    Promise.all(combos.map((c) => { const [w, fam] = c.split('|'); return document.fonts.load(`${w} 40px "${fam}"`, sample).catch(() => null); })),
    new Promise((r) => setTimeout(r, 10000)),
  ]);
  return ready;
};

export const useFonts = () => {
  const [h] = useState(() => delayRender('fonts', { timeoutInMilliseconds: 30000, retries: 2 }));
  useEffect(() => {
    let alive = true;
    loadAll().then(() => alive && continueRender(h));
    return () => { alive = false; continueRender(h); };
  }, [h]);
};
