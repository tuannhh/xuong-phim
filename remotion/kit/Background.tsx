import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { noise2D } from '@remotion/noise';
import { useTheme, useLayout, alpha } from './theme';

// Nền động nhẹ, đổi theo theme.background. Chuyển động chậm để không tranh với nội dung.
export const Background: React.FC<{ variant?: string; tint?: string }> = ({ variant, tint }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { W, H, u } = useLayout();
  const v = variant ?? th.background;
  const base: React.CSSProperties = { background: `linear-gradient(160deg, ${th.bg} 0%, ${th.bg2} 100%)` };

  if (v === 'solid') return <AbsoluteFill style={{ background: th.bg }} />;

  if (v === 'grid' || v === 'dots') {
    const s = 72 * u;
    const off = (f * 0.4 * u) % s;
    const img =
      v === 'grid'
        ? `linear-gradient(${alpha(th.fg, 0.06)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(th.fg, 0.06)} 1px, transparent 1px)`
        : `radial-gradient(${alpha(th.fg, 0.14)} ${2.2 * u}px, transparent ${2.6 * u}px)`;
    return (
      <AbsoluteFill style={base}>
        <AbsoluteFill style={{ backgroundImage: img, backgroundSize: `${s}px ${s}px`, backgroundPosition: `${off}px ${off}px` }} />
        <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 35%, ${alpha(tint ?? th.accent, 0.16)}, transparent 60%)` }} />
      </AbsoluteFill>
    );
  }

  if (v === 'paper') {
    return (
      <AbsoluteFill style={{ background: th.bg }}>
        <svg width={W} height={H} style={{ position: 'absolute', opacity: 0.35 }}>
          <filter id="pn"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" /><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0.18 0" /></filter>
          <rect width="100%" height="100%" filter="url(#pn)" />
        </svg>
      </AbsoluteFill>
    );
  }

  if (v === 'spotlight') {
    const x = 50 + noise2D('sx', f / 240, 0) * 12;
    const y = 38 + noise2D('sy', 0, f / 240) * 8;
    return (
      <AbsoluteFill style={{ background: th.bg }}>
        <AbsoluteFill style={{ background: `radial-gradient(circle at ${x}% ${y}%, ${alpha(tint ?? th.accent, 0.28)}, transparent 55%)` }} />
      </AbsoluteFill>
    );
  }

  // gradient-blobs (mặc định)
  const blobs = [
    { c: tint ?? th.accent, x: 0.2, y: 0.18, r: 0.55, s: 'a' },
    { c: th.accent2, x: 0.85, y: 0.55, r: 0.5, s: 'b' },
    { c: th.accent, x: 0.35, y: 0.92, r: 0.45, s: 'c' },
  ];
  return (
    <AbsoluteFill style={base}>
      {blobs.map((b) => {
        const dx = noise2D(b.s, f / 300, 0) * 0.08;
        const dy = noise2D(b.s + 'y', 0, f / 300) * 0.06;
        const R = Math.max(W, H) * b.r;
        return (
          <div key={b.s} style={{ position: 'absolute', left: (b.x + dx) * W - R / 2, top: (b.y + dy) * H - R / 2, width: R, height: R, borderRadius: '50%', background: `radial-gradient(circle, ${alpha(b.c, 0.32)}, transparent 68%)`, filter: `blur(${30 * u}px)` }} />
        );
      })}
    </AbsoluteFill>
  );
};
