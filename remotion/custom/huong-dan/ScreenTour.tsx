import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../../kit/Background';
import { clamp, ease, revealFrames, springAt } from '../../kit/anim';
import { alpha, useLayout, useTheme } from '../../kit/theme';
import { RichText } from '../../kit/RichText';
import type { SceneProps } from '../../scenes/common';

// Cảnh "tham quan màn hình" cho video hướng dẫn: ảnh chụp THẬT của trang Xưởng phim trong khung trình duyệt,
// máy quay zoom vào vùng đang nói, con trỏ đi tới + bấm, khung nổi bật + nhãn chú thích.
//   props: { src: "assets/x.png", w, h (px ảnh), url?, title?, steps: [{ beat?|at?, focus?: [x,y,w,h], zoom?, cursor?: [x,y], click?, label?, side? }] }
//   focus/cursor theo tỉ lệ ảnh 0..1. Mỗi bước bắt đầu ở câu `beat` (0 = câu đầu) — SFX click/whoosh do timing.mjs đặt cùng lịch (shared/reveal.mjs).
type Step = { beat?: number; at?: number; focus?: [number, number, number, number] | null; zoom?: number; cursor?: [number, number] | null; click?: boolean; label?: string; side?: 'top' | 'bottom' | 'left' | 'right' };

const CURSOR = (s: number) => (
  <svg width={s} height={s * 1.25} viewBox="0 0 20 25" style={{ display: 'block', filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.35))' }}>
    <path d="M2 1.5 L2 20 L6.6 15.8 L9.8 23 L13 21.6 L9.9 14.6 L16.4 14.6 Z" fill="#fff" stroke="#111" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

// cột trái: chấm tiến độ các bước của cảnh (bước đang nói sáng lên)
const st0Label = (steps: Step[], k: number, f: number, starts: number[], fps: number, th: any) =>
  steps.length > 1 ? (
    <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
      {steps.map((_, i) => <i key={i} style={{ display: 'block', height: 10, borderRadius: 99, width: i === k ? 46 : 14, background: i <= k ? th.accent : alpha(th.fg, 0.2), opacity: i === 0 ? 1 : 0.4 + 0.6 * springAt(f, starts[i], fps) }} />)}
    </div>
  ) : null;

export const ScreenTour: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { W, H } = useLayout();
  const p = scene.props;
  const steps: Step[] = p.steps?.length ? p.steps : [{}];
  const starts = revealFrames(scene, steps.length, steps, fps).map((s: number, i: number) => (i === 0 ? Math.min(s, 10) : s));
  let k = 0;
  starts.forEach((s: number, i: number) => { if (f >= s) k = i; });

  // bố cục 16:9: cột trái số bước + tiêu đề, khung trình duyệt bên phải (chừa đáy cho phụ đề), giữ tỉ lệ ảnh
  const imgW = +p.w || 2880, imgH = +p.h || 1800;
  const bar = 54, top = 64, bottom = 128, right = 70;
  const colW = p.title ? Math.round(W * 0.2) : 0;
  const maxH = H - top - bottom - bar, maxW = W - right - colW - 90;
  const vw = Math.min(maxW, (maxH * imgW) / imgH), vh = (vw * imgH) / imgW;
  const fx = W - right - vw, fy = top + (maxH - vh) / 2;

  // máy quay: zoom + dời để tâm vùng focus ra giữa khung (không lộ mép ảnh)
  const cam = (s: Step) => {
    const fo = s.focus;
    if (!fo) return { z: 1, tx: 0, ty: 0 };
    const z = Math.max(1, Math.min(s.zoom ?? 2.4, Math.min(1 / fo[2], 1 / fo[3]) * 0.78));
    const cx = (fo[0] + fo[2] / 2) * vw, cy = (fo[1] + fo[3] / 2) * vh;
    const tx = Math.min(0, Math.max(vw - vw * z, vw / 2 - cx * z));
    const ty = Math.min(0, Math.max(vh - vh * z, vh / 2 - cy * z));
    return { z, tx, ty };
  };
  const a = cam(steps[Math.max(0, k - 1)]), b = cam(steps[k]);
  const t = k === 0 ? 1 : ease(f, starts[k] + 4, 26, Easing.inOut(Easing.cubic));
  const z = a.z + (b.z - a.z) * t, tx = a.tx + (b.tx - a.tx) * t, ty = a.ty + (b.ty - a.ty) * t;
  const P = (x: number, y: number) => [x * vw * z + tx, y * vh * z + ty];

  // con trỏ: đi tới điểm của bước trong 14 frame TRƯỚC lúc bắt đầu bước, bấm đúng lúc bắt đầu
  const curOf = (i: number): [number, number] | null => {
    for (let j = i; j >= 0; j--) if (steps[j].cursor) return steps[j].cursor as [number, number];
    return null;
  };
  let kk = k;
  for (let i = steps.length - 1; i > k; i--) if (f >= starts[i] - 14 && steps[i].cursor) { kk = i; break; }
  const target = curOf(kk), from = curOf(kk - 1) ?? (target ? [target[0] + 0.12, target[1] + 0.18] as [number, number] : null);
  const mv = kk === 0 ? ease(f, Math.max(0, starts[0] - 14), 14, Easing.inOut(Easing.cubic)) : ease(f, starts[kk] - 14, 14, Easing.inOut(Easing.cubic));
  const cpos = target && from ? [from[0] + (target[0] - from[0]) * mv, from[1] + (target[1] - from[1]) * mv] : null;
  const clickAt = steps[k].click ? starts[k] : -999;
  const press = f >= clickAt && f < clickAt + 6 ? 0.82 : 1;
  const ripple = f >= clickAt && f < clickAt + 18 ? (f - clickAt) / 18 : -1;

  // khung nổi bật + nhãn của bước hiện tại (hiện sau khi máy quay dừng)
  const st = steps[k];
  const hl = st.focus ? ease(f, starts[k] + (k === 0 ? 6 : 26), 12) : 0;
  const [hx, hy] = st.focus ? P(st.focus[0], st.focus[1]) : [0, 0];
  const hw = st.focus ? st.focus[2] * vw * z : 0, hh = st.focus ? st.focus[3] * vh * z : 0;
  const lab = st.label ? springAt(f, starts[k] + (k === 0 ? 10 : 30), fps) : 0;
  const side = st.side ?? (hy + hh / 2 > vh * 0.55 ? 'top' : 'bottom');
  const enter = springAt(f, 0, fps);

  return (
    <AbsoluteFill>
      <Background variant={p.bg?.variant ?? 'grid'} tint={p.bg?.tint} />
      {p.title && (
        <div style={{ position: 'absolute', left: 70, top: fy + 20, width: fx - 70 - 50, display: 'flex', flexDirection: 'column', gap: 22, opacity: enter, transform: `translateX(${(1 - enter) * -40}px)` }}>
          {p.kicker && <span style={{ width: 96, height: 96, borderRadius: 999, display: 'grid', placeItems: 'center', fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 54, color: '#fff', background: th.accent, boxShadow: `0 12px 28px ${alpha(th.accent, 0.4)}` }}>{p.kicker}</span>}
          <span style={{ fontFamily: th.fontDisplay, fontWeight: 800, fontSize: 58, lineHeight: 1.16, color: th.fg, textWrap: 'balance' as any }}><RichText text={p.title} /></span>
          {st0Label(steps, k, f, starts, fps, th)}
        </div>
      )}
      <div style={{ position: 'absolute', left: fx, top: fy, width: vw, height: vh + bar, borderRadius: 22, overflow: 'hidden', background: '#fff', boxShadow: `0 30px 80px ${alpha('#000', 0.35)}`, opacity: enter, transform: `translateY(${(1 - enter) * 50}px) scale(${0.96 + 0.04 * enter})` }}>
        <div style={{ height: bar, background: '#ECEEF2', display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', borderBottom: '1px solid #D8DBE2' }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <i key={c} style={{ width: 15, height: 15, borderRadius: 99, background: c, display: 'block' }} />)}
          <div style={{ marginLeft: 18, flex: 1, maxWidth: 560, height: 32, borderRadius: 9, background: '#fff', fontFamily: th.fontBody, fontSize: 19, color: '#555', display: 'flex', alignItems: 'center', padding: '0 14px' }}>{p.url ?? 'localhost:4710'}</div>
        </div>
        <div style={{ position: 'relative', width: vw, height: vh, overflow: 'hidden' }}>
          <Img src={staticFile(p.src)} style={{ position: 'absolute', left: 0, top: 0, width: vw, height: vh, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${z})` }} />
          {hl > 0 && (
            <div style={{ position: 'absolute', left: hx - 8, top: hy - 8, width: hw + 16, height: hh + 16, borderRadius: 16, border: `5px solid ${th.accent}`, boxShadow: `0 0 0 4000px ${alpha('#0B1530', 0.42 * hl)}`, opacity: hl }} />
          )}
          {lab > 0.01 && st.label && (() => {
            const lx = Math.min(vw - 40, Math.max(40, hx + hw / 2));
            // giữ nhãn trong khung ảnh (ước chiều cao nhãn ~ 2 dòng) — không để mép khung cắt chữ
            const labH = 110;
            const top = side === 'top' ? Math.max(hy - 26, labH + 16) : side === 'bottom' ? Math.min(hy + hh + 26, vh - labH - 16) : hy + hh / 2;
            const tr = side === 'top' ? 'translate(-50%,-100%)' : side === 'bottom' ? 'translate(-50%,0)' : side === 'left' ? 'translate(-100%,-50%)' : 'translate(0,-50%)';
            const left = side === 'left' ? hx - 26 : side === 'right' ? hx + hw + 26 : lx;
            return (
              <div style={{ position: 'absolute', left, top, transform: `${tr} scale(${0.7 + 0.3 * lab})`, opacity: Math.min(1, lab * 1.5), maxWidth: vw * 0.46, background: th.accent, color: '#fff', fontFamily: th.fontDisplay, fontWeight: 800, fontSize: 34, lineHeight: 1.2, padding: '14px 24px', borderRadius: 16, boxShadow: `0 14px 34px ${alpha('#000', 0.3)}`, textAlign: 'center' }}>
                <RichText text={st.label} />
              </div>
            );
          })()}
          {cpos && (() => {
            const [cx, cy] = P(cpos[0], cpos[1]);
            return (
              <>
                {ripple >= 0 && <div style={{ position: 'absolute', left: cx - 40 * ripple - 6, top: cy - 40 * ripple - 6, width: 80 * ripple + 12, height: 80 * ripple + 12, borderRadius: 999, border: `4px solid ${th.accent}`, opacity: 1 - ripple }} />}
                <div style={{ position: 'absolute', left: cx - 3, top: cy - 2, transform: `scale(${press})`, transformOrigin: '3px 2px', opacity: interpolate(f, [Math.max(0, starts[0] - 14), Math.max(1, starts[0] - 6)], [0, 1], clamp) }}>{CURSOR(34)}</div>
              </>
            );
          })()}
        </div>
      </div>
    </AbsoluteFill>
  );
};
