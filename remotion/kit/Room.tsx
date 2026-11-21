import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { useLayout } from './theme';
import { MisaLogo } from './MisaLogo';

// Phông nền phòng vẽ vector (sau lưng nhân vật). Màu sáng, chi tiết ít để không tranh với nhân vật và bóng thoại.
// room: van-phong | phong-hop | nha | dem (văn phòng buổi tối)
const PAL: Record<string, { wall: string; wall2: string; floor: string; trim: string; sky: string; sky2: string }> = {
  'van-phong': { wall: '#F1E7D6', wall2: '#E6D8C1', floor: '#C9A47A', trim: '#B98E62', sky: '#BFE3F7', sky2: '#E8F5FC' },
  'phong-hop': { wall: '#E4EAF1', wall2: '#D3DCE6', floor: '#8E99A8', trim: '#6F7B8B', sky: '#BFE3F7', sky2: '#E8F5FC' },
  nha: { wall: '#F4E3D3', wall2: '#EBCFB8', floor: '#B07D5A', trim: '#93623F', sky: '#FFD9A8', sky2: '#FFF0DA' },
  dem: { wall: '#3A3F55', wall2: '#2E3246', floor: '#4A3A35', trim: '#2A2230', sky: '#1C2340', sky2: '#38406A' },
};

export const Room: React.FC<{ room?: string; logo?: boolean }> = ({ room = 'van-phong', logo }) => {
  const f = useCurrentFrame();
  const { W, H, u, portrait } = useLayout();
  const p = PAL[room] ?? PAL['van-phong'];
  const floorY = portrait ? H * 0.8 : H * 0.78;
  const win = portrait ? { x: W * 0.06, y: H * 0.2, w: W * 0.4, h: H * 0.26 } : { x: W * 0.06, y: H * 0.12, w: W * 0.26, h: H * 0.42 };
  const clock = portrait ? { x: W * 0.78, y: H * 0.27, r: 54 * u } : { x: W * 0.86, y: H * 0.2, r: 50 * u };
  const ang = (f / 30) * 6; // kim giây chạy thật
  return (
    <AbsoluteFill>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="rw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.wall} /><stop offset="1" stopColor={p.wall2} /></linearGradient>
          <linearGradient id="rs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.sky} /><stop offset="1" stopColor={p.sky2} /></linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#rw)" />
        {/* cửa sổ + rèm lá */}
        <rect x={win.x - 10 * u} y={win.y - 10 * u} width={win.w + 20 * u} height={win.h + 20 * u} rx={8 * u} fill={p.trim} />
        <rect x={win.x} y={win.y} width={win.w} height={win.h} fill="url(#rs)" />
        {room !== 'dem' && <g fill="#fff" opacity={0.85}><ellipse cx={win.x + win.w * 0.3} cy={win.y + win.h * 0.32} rx={win.w * 0.14} ry={win.h * 0.06} /><ellipse cx={win.x + win.w * 0.4} cy={win.y + win.h * 0.28} rx={win.w * 0.1} ry={win.h * 0.07} /></g>}
        {Array.from({ length: 9 }, (_, i) => <rect key={i} x={win.x} y={win.y + (i * win.h) / 9} width={win.w} height={win.h / 9 * 0.32} fill="#fff" opacity={0.35} />)}
        <rect x={win.x + win.w / 2 - 4 * u} y={win.y} width={8 * u} height={win.h} fill={p.trim} />
        {/* đồng hồ treo tường */}
        <circle cx={clock.x} cy={clock.y} r={clock.r + 6 * u} fill="#3A3F4B" />
        <circle cx={clock.x} cy={clock.y} r={clock.r} fill="#FBFBF8" />
        {Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return <line key={i} x1={clock.x + Math.sin(a) * clock.r * 0.78} y1={clock.y - Math.cos(a) * clock.r * 0.78} x2={clock.x + Math.sin(a) * clock.r * 0.9} y2={clock.y - Math.cos(a) * clock.r * 0.9} stroke="#3A3F4B" strokeWidth={3 * u} />; })}
        <line x1={clock.x} y1={clock.y} x2={clock.x} y2={clock.y - clock.r * 0.55} stroke="#3A3F4B" strokeWidth={5 * u} strokeLinecap="round" transform={`rotate(${300 + ang / 720} ${clock.x} ${clock.y})`} />
        <line x1={clock.x} y1={clock.y} x2={clock.x} y2={clock.y - clock.r * 0.75} stroke="#3A3F4B" strokeWidth={4 * u} strokeLinecap="round" transform={`rotate(${60 + ang / 60} ${clock.x} ${clock.y})`} />
        <line x1={clock.x} y1={clock.y + 10 * u} x2={clock.x} y2={clock.y - clock.r * 0.8} stroke="#E2342B" strokeWidth={2 * u} transform={`rotate(${ang} ${clock.x} ${clock.y})`} />
        {/* kệ + khung logo */}
        {logo && (
          <g transform={`translate(${portrait ? W * 0.56 : W * 0.4} ${portrait ? H * 0.23 : H * 0.16})`}>
            <rect width={300 * u} height={120 * u} rx={10 * u} fill="#fff" stroke={p.trim} strokeWidth={6 * u} />
            <g transform={`translate(${30 * u} ${22 * u})`}><MisaLogo width={240 * u} /></g>
          </g>
        )}
        {/* sàn + chân tường */}
        <rect x={0} y={floorY} width={W} height={H - floorY} fill={p.floor} />
        <rect x={0} y={floorY - 14 * u} width={W} height={14 * u} fill={p.trim} />
        {Array.from({ length: 6 }, (_, i) => <line key={i} x1={0} y1={floorY + (i + 1) * 60 * u} x2={W} y2={floorY + (i + 1) * 60 * u} stroke="#000" strokeOpacity={0.06} strokeWidth={2 * u} />)}
        {/* chậu cây */}
        <g transform={`translate(${W * 0.9} ${floorY})`}>
          {[[-40, -150, -18], [0, -190, 0], [40, -150, 18], [-20, -120, -30], [22, -120, 30]].map(([x, y, r], i) => <ellipse key={i} cx={x * u} cy={y * u} rx={26 * u} ry={70 * u} fill={i % 2 ? '#3E8E5A' : '#4FA86C'} transform={`rotate(${r} ${x * u} ${y * u})`} />)}
          <path d={`M ${-48 * u} ${-70 * u} L ${48 * u} ${-70 * u} L ${36 * u} 0 L ${-36 * u} 0 Z`} fill="#D9774B" />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
