import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { Room } from '../kit/Room';
import { Background } from '../kit/Background';
import { Stage, layoutCast, type CastMember } from '../kit/Stage';
import { RichText } from '../kit/RichText';
import { springAt } from '../kit/anim';
import { useLayout, useTheme } from '../kit/theme';
import type { SceneProps } from './common';
import type { Framing } from '../kit/Character';

// ───────── talk: hội thoại nhiều nhân vật trong phòng, bóng thoại hiện trên đầu người đang nói (thay phụ đề).
// props: { cast: [{id, pose?, expr?, x?, flip?}], shot?: toan-than|trung-canh|can-canh, room?: van-phong|phong-hop|nha|dem|none,
//          logo?: bool (khung logo MISA trên tường), title?: string (nhãn nhỏ góc trên), bubble?: false }
// Mỗi câu: { text, speaker, expr?, pose?, react?: { <id>: "<biểu cảm>" | {expr, pose} } }
export const Talk: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { W, H, u, portrait, safe } = useLayout();
  const p = scene.props;
  const cast: CastMember[] = p.cast ?? (scene.character ? [{ id: scene.character.id, pose: scene.character.pose, expr: scene.character.expr }] : []);
  const shot: Framing = p.shot ?? (cast.length >= 3 ? 'trung-canh' : cast.length === 1 ? 'trung-canh' : 'trung-canh');
  const zoneTop = portrait ? H * (shot === 'toan-than' ? 0.36 : 0.42) : H * 0.3;
  const zoneBottom = H;
  const placed = layoutCast(cast, { W, zoneTop, zoneBottom, shot });
  const cur = [...scene.lines].reverse().find((l) => f >= l.from);
  const who = placed.find((q) => q.id === cur?.speaker);
  const text = cur?.raw ?? cur?.text ?? '';
  const pop = springAt(f, cur?.from ?? 0, fps, 13);
  const bw = portrait ? W * 0.74 : W * 0.4;
  const anchor = who?.cx ?? W / 2;
  const left = Math.max(safe.left, Math.min(W - safe.right - bw, anchor - bw / 2));
  const tailX = Math.max(50 * u, Math.min(bw - 50 * u, anchor - left));
  const bottom = (who?.headTop ?? zoneTop) - 40 * u;
  const top = p.title ? safe.top + 90 * u : safe.top;
  return (
    <AbsoluteFill>
      {p.room === 'none' ? <Background variant={p.bg?.variant} tint={p.bg?.tint} /> : <Room room={p.room} logo={p.logo} />}
      <Stage scene={scene} cast={cast} shot={shot} zoneTop={zoneTop} zoneBottom={zoneBottom} />
      {p.title && (
        <div style={{ position: 'absolute', left: safe.left, top: safe.top, fontFamily: th.fontDisplay, fontWeight: 800, fontSize: 40 * u, lineHeight: 1.3, color: '#fff', background: 'rgba(20,24,40,.82)', padding: `${10 * u}px ${24 * u}px`, borderRadius: 14 * u }}>
          <RichText text={p.title} />
        </div>
      )}
      {text && p.bubble !== false && cur && (
        <div data-bubble style={{ position: 'absolute', left, width: bw, top, height: bottom - top, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', pointerEvents: 'none' }}>
          <div style={{ position: 'relative', background: '#fff', color: '#16181D', border: `${4 * u}px solid #1F2229`, borderRadius: 34 * u, padding: `${26 * u}px ${34 * u}px`, fontFamily: th.fontBody, fontWeight: 600, fontSize: (portrait ? 46 : 40) * u, lineHeight: 1.42, textAlign: 'center', transform: `scale(${0.86 + 0.14 * pop})`, transformOrigin: `${tailX}px 100%`, opacity: Math.min(1, pop * 1.6) }}>
            {who == null && cur.speaker && <div style={{ fontSize: 28 * u, fontWeight: 700, color: th.accent2, marginBottom: 6 * u }}>{cur.speaker}</div>}
            <RichText text={text} accent="#D4301F" accent2="#1565C0" />
            <svg style={{ position: 'absolute', left: tailX - 26 * u, bottom: -34 * u, overflow: 'visible' }} width={52 * u} height={36 * u} viewBox="0 0 52 36">
              <path d="M 2 0 L 26 34 L 50 0" fill="#fff" stroke="#1F2229" strokeWidth={4} strokeLinejoin="round" />
              <rect x={4} y={-6} width={44} height={8} fill="#fff" />
            </svg>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
