import React from 'react';
import { continueRender, delayRender, useCurrentFrame } from 'remotion';
import { useEp } from './theme';

// Chỉ chạy khi chụp storyboard: đo hộp từng dòng chữ và thân nhân vật trên khung hình hiện tại, rồi in một dòng
// "LAYOUT {json}" ra console (render.mjs đọc qua onBrowserLog). Báo: chữ đè chữ, chữ đè nhân vật, chữ tràn khung.
type R = { x: number; y: number; w: number; h: number };
const inter = (a: R, b: R) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const visible = (el: Element | null): boolean => {
  let op = 1;
  for (let e = el as HTMLElement | null; e && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    op *= parseFloat(cs.opacity || '1');
  }
  return op > 0.25;
};
const block = (n: Node): Element | null => {
  for (let e = n.parentElement; e; e = e.parentElement) { const d = getComputedStyle(e).display; if (d !== 'inline' && d !== 'contents') return e; }
  return null;
};

export const LayoutProbe: React.FC = () => {
  const { ep } = useEp();
  const f = useCurrentFrame();
  const [h] = React.useState(() => delayRender('layout-probe'));
  React.useEffect(() => {
    if (!ep.still) { continueRender(h); return; }
    const t = setTimeout(() => {
      const root = document.getElementById('remotion-root') ?? document.body;
      const rr = (root.querySelector('div') ?? root).getBoundingClientRect();
      const W = ep.width, H = ep.height, sx = W / rr.width, sy = H / rr.height;
      const norm = (r: DOMRect): R => ({ x: (r.left - rr.left) * sx, y: (r.top - rr.top) * sy, w: r.width * sx, h: r.height * sy });
      // dòng chữ
      const texts: { r: R; b: Element | null; t: string; cap: boolean; bubble: boolean }[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const s = (n.textContent ?? '').trim();
        if (!s || !visible(n.parentElement)) continue;
        if ((n.parentElement as Element).closest('svg')) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        // vùng nhìn thấy của chữ: giao với mọi khung cha có overflow hidden (vd nội dung cuộn trong màn hình điện thoại)
        let clip: DOMRect | null = null;
        for (let e = n.parentElement; e && e !== root; e = e.parentElement) if (getComputedStyle(e).overflow === 'hidden') { const c = e.getBoundingClientRect(); clip = clip ? new DOMRect(Math.max(clip.left, c.left), Math.max(clip.top, c.top), Math.max(0, Math.min(clip.right, c.right) - Math.max(clip.left, c.left)), Math.max(0, Math.min(clip.bottom, c.bottom) - Math.max(clip.top, c.top))) : c; }
        const seen = (r: DOMRect) => !clip || (r.top >= clip.top - 2 && r.bottom <= clip.bottom + 2 && r.left >= clip.left - 2 && r.right <= clip.right + 2);
        for (const r of Array.from(range.getClientRects())) if (r.width > 2 && r.height > 2 && seen(r)) texts.push({ r: norm(r), b: block(n), t: s.slice(0, 40), cap: !!(n.parentElement as Element).closest('[data-caption]'), bubble: !!(n.parentElement as Element).closest('[data-bubble]') });
      }
      // thân nhân vật: phần đầu + thân (bỏ khoảng trống quanh khung SVG)
      const people = Array.from(document.querySelectorAll('[data-person]')).filter(visible).map((el) => {
        // data-exact: hộp đã là đúng phần thân nhìn thấy (cảnh story — nửa dưới khuất sau bàn)
        if (el.hasAttribute('data-exact')) return { id: el.getAttribute('data-person'), r: norm(el.getBoundingClientRect()) };
        const r = norm((el.querySelector('svg') ?? el).getBoundingClientRect());
        return { id: el.getAttribute('data-person'), r: { x: r.x + r.w * 0.22, y: r.y + r.h * 0.02, w: r.w * 0.56, h: r.h * 0.98 } };
      });
      const issues: string[] = [];
      for (let i = 0; i < texts.length; i++) {
        const a = texts[i];
        if (a.r.x < -2 || a.r.y < -2 || a.r.x + a.r.w > W + 2 || a.r.y + a.r.h > H + 2) issues.push(`tràn khung: "${a.t}"`);
        for (const p of people) { const o = inter(a.r, p.r) / (a.r.w * a.r.h); if (o > 0.12 && !a.bubble) issues.push(`chữ đè nhân vật ${p.id}: "${a.t}"`); }
        for (let j = i + 1; j < texts.length; j++) {
          const b = texts[j];
          if (a.b === b.b || (a.b && b.b && (a.b.contains(b.b) || b.b.contains(a.b)))) continue;
          const o = inter(a.r, b.r) / Math.min(a.r.w * a.r.h, b.r.w * b.r.h);
          if (o > 0.15) issues.push(`chữ đè chữ: "${a.t}" × "${b.t}"`);
        }
      }
      console.log('LAYOUT ' + JSON.stringify({ frame: f, issues: [...new Set(issues)] }));
      continueRender(h);
    }, 50);
    return () => clearTimeout(t);
  }, [f, ep.still, h]);
  return null;
};
