import React from 'react';
import { useCurrentFrame } from 'remotion';
import { useEp, useLayout, alpha } from './theme';
import { springAt } from './anim';

// Phụ đề đốt cứng, từng cụm ≤ ~6 từ, tô sáng từ đang đọc (thời điểm từ ước theo độ dài âm tiết).
export const Captions: React.FC = () => {
  const { ep, theme: th } = useEp();
  const f = useCurrentFrame();
  const { W, H, u, safe, captionY, captionMidY, portrait } = useLayout();
  if (th.captionStyle === 'none') return null;
  // cảnh đang chiếu (cảnh sau thắng khi đang chuyển cảnh)
  const scene = [...ep.scenes].reverse().find((s) => f >= s.from && f < s.from + s.duration);
  // hội thoại: bóng thoại đã là phụ đề
  if (scene && (scene.type === 'talk' || scene.type === 'character') && scene.props.bubble !== false) return null;
  let cap = ep.captions.find((c) => f >= c.from && f < c.to);
  // storyboard: hiện cụm phụ đề dài nhất của cảnh để soát chồng lấn
  if (ep.still && scene) cap = ep.captions.filter((c) => c.from >= scene.from && c.from < scene.from + scene.duration).sort((a, b) => b.words.map((w) => w.w).join(' ').length - a.words.map((w) => w.w).join(' ').length)[0];
  if (!cap) return null;
  if (scene?.type === 'story') {
    // cảnh story: chữ trắng viền đậm đặt trên mặt bàn tiền cảnh, từ khoá vàng, từng từ bật lên khi đọc tới; nhãn tên người nói phía trên
    const uw = W / 1080;
    const top0 = Math.max(0, (H - 1920 * uw) / 2);
    const line = scene.lines.find((l) => cap!.from >= scene.from + l.from - 1 && cap!.from <= scene.from + l.to);
    const spk = line && !line.narr ? ep.characters.find((c) => c.id === line.speaker) : undefined;
    const INK = '#141826';
    return (
      <div data-caption style={{ position: 'absolute', left: safe.left, width: W - safe.left - safe.right, top: top0 + 1236 * uw, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 * uw }}>
        <div style={{ height: 46 * uw, display: 'flex', alignItems: 'center' }}>
          {spk && (
            <div style={{ fontFamily: th.fontBody, fontWeight: 800, fontSize: 28 * uw, lineHeight: 1.3, letterSpacing: 1 * uw, textTransform: 'uppercase', color: spk.villain ? '#fff' : INK, background: spk.villain ? '#E5322D' : '#FFD21F', border: `${3 * uw}px solid ${INK}`, borderRadius: 999, padding: `${1 * uw}px ${20 * uw}px`, boxShadow: `0 ${4 * uw}px 0 ${INK}` }}>{spk.name}</div>
          )}
        </div>
        <div style={{ fontFamily: th.fontDisplay, fontWeight: 800, fontSize: 60 * uw, lineHeight: 1.3, textAlign: 'center', color: '#fff', WebkitTextStroke: `${11 * uw}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 ${5 * uw}px 0 ${INK}` }}>
          {cap.words.map((w, i) => {
            const said = ep.still || f >= w.from;
            const e = ep.still ? 1 : springAt(f, w.from, ep.fps, 11);
            return (
              <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', color: w.em ? '#FFD21F' : '#fff', opacity: said ? 1 : 0.32, transform: said ? `translateY(${(1 - e) * 14 * uw}px) scale(${0.82 + 0.18 * e})` : undefined }}>
                {w.w}
                {i < cap!.words.length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </div>
      </div>
    );
  }
  const top = scene?.character && portrait ? captionMidY : captionY;
  const p = ep.still ? 1 : springAt(f, cap.from, ep.fps, 18);
  const bold = th.captionStyle === 'bold';
  return (
    <div data-caption style={{ position: 'absolute', left: 0, width: W, top, display: 'flex', justifyContent: 'center', padding: `0 ${90 * u}px`, boxSizing: 'border-box' }}>
      <div
        style={{
          fontFamily: th.fontDisplay,
          fontWeight: 800,
          fontSize: (bold ? 64 : 50) * u,
          lineHeight: 1.38,
          textAlign: 'center',
          color: '#fff',
          padding: bold ? 0 : `${14 * u}px ${28 * u}px`,
          borderRadius: 22 * u,
          background: bold ? 'none' : 'rgba(10,12,20,0.72)',
          textShadow: bold ? `0 ${4 * u}px 0 #000, 0 0 ${18 * u}px rgba(0,0,0,.6)` : 'none',
          WebkitTextStroke: bold ? `${2.5 * u}px #000` : undefined,
          paintOrder: 'stroke fill',
          transform: `scale(${0.92 + 0.08 * p})`,
          opacity: p,
          maxWidth: W * 0.84,
        }}
      >
        {cap.words.map((w, i) => {
          const on = !ep.still && f >= w.from && f < w.to;
          const done = f >= w.to;
          return (
            <span key={i} style={{ color: on ? th.accent : done || !bold ? '#fff' : alpha('#ffffff', 0.85), transition: 'none' }}>
              {w.w}
              {i < cap.words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
};
