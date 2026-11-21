import React from 'react';
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../kit/Background';
import { Stage } from '../kit/Stage';
import { springAt } from '../kit/anim';
import { useEp, useLayout, useTheme, alpha } from '../kit/theme';
import { RichText } from '../kit/RichText';
import type { TimedScene } from '../types';

export type SceneProps = { scene: TimedScene };

// Vùng nội dung của scene (đã trừ vùng an toàn + chỗ của nhân vật nếu có).
export const useContentBox = (scene: TimedScene) => {
  const L = useLayout();
  const { W, H, safe, portrait } = L;
  const ch = scene.character;
  let x = safe.left, y = safe.top, w = W - safe.left - safe.right, h = H - safe.top - safe.bottom;
  if (ch && scene.type !== 'character') {
    if (portrait) h = L.contentBottomWithChar - y;
    else {
      const cw = W * 0.34;
      if ((ch.position ?? 'left').includes('left')) x += cw;
      w -= cw;
    }
  }
  return { x, y, w, h, ...L };
};

// Khung chung: nền + vùng nội dung (tự thu nhỏ nếu tràn — không bao giờ lấn sang vùng phụ đề/nhân vật) + nhân vật.
export const SceneShell: React.FC<SceneProps & { children: React.ReactNode; center?: boolean }> = ({ scene, children, center = true }) => {
  const box = useContentBox(scene);
  const bg = scene.props.bg as { variant?: string; tint?: string } | undefined;
  return (
    <AbsoluteFill>
      <Background variant={bg?.variant} tint={bg?.tint} />
      {scene.character && scene.type !== 'character' && <CharacterLayer scene={scene} />}
      <FitBox x={box.x} y={box.y} w={box.w} h={box.h} center={center}>{children}</FitBox>
    </AbsoluteFill>
  );
};

// Đo nội dung một lần; cao hơn hộp thì thu nhỏ (CSS zoom, giữ bố cục) cho vừa.
export const FitBox: React.FC<{ x: number; y: number; w: number; h: number; center?: boolean; children: React.ReactNode }> = ({ x, y, w, h, center = true, children }) => {
  const inner = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState<number | null>(null);
  const [handle] = React.useState(() => delayRender('fitbox'));
  React.useLayoutEffect(() => {
    const el = inner.current;
    if (zoom == null && el) {
      const need = el.scrollHeight, needW = el.scrollWidth;
      const z = Math.min(1, (h - 2) / Math.max(1, need), w / Math.max(1, needW));
      setZoom(z < 0.995 ? Math.max(0.55, z) : 1);
    }
    if (zoom != null) continueRender(handle);
  }, [zoom, h, w, handle]);
  React.useEffect(() => () => continueRender(handle), [handle]);
  return (
    <div data-box="content" style={{ position: 'absolute', left: x, top: y, width: w, height: h, display: 'flex', flexDirection: 'column', justifyContent: center ? 'center' : 'flex-start' }}>
      <div ref={inner} style={{ display: 'flex', flexDirection: 'column', zoom: zoom ?? 1, width: zoom ? w / zoom : w, maxHeight: zoom == null ? undefined : h / zoom }}>{children}</div>
    </div>
  );
};

export const useMouth = (scene: TimedScene, id?: string) => {
  const { ep } = useEp();
  const f = useCurrentFrame();
  if (!id || ep.still) return 0;
  return ep.mouth?.[id]?.[scene.from + f] ?? 0;
};

// Một nhân vật đứng cạnh nội dung: 9:16 → trung cảnh ở vùng dưới (dưới dải phụ đề); 16:9 → cột bên.
export const CharacterLayer: React.FC<SceneProps> = ({ scene }) => {
  const { W, H, portrait, charTop } = useLayout();
  const ch = scene.character!;
  const pos = ch.position ?? 'left';
  const x = pos.includes('left') ? (portrait ? 0.24 : 0.17) : pos.includes('right') ? (portrait ? 0.72 : 0.83) : 0.5;
  return (
    <Stage
      scene={scene}
      cast={[{ id: ch.id, pose: ch.pose, expr: ch.expr, x, flip: ch.flip, enter: (ch as any).enter }]}
      shot={(ch as any).shot ?? 'trung-canh'}
      zoneTop={portrait ? charTop : H * 0.12}
      zoneBottom={H * (ch.scale ?? 1) + (portrait ? 0 : 0)}
    />
  );
};

export const Kicker: React.FC<{ text?: string; at?: number }> = ({ text, at = 0 }) => {
  const th = useTheme();
  const { u } = useLayout();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!text) return null;
  const p = springAt(f, at, fps);
  return (
    <div style={{ alignSelf: 'flex-start', marginBottom: 22 * u, fontFamily: th.fontBody, fontWeight: 800, fontSize: 30 * u, letterSpacing: 2 * u, textTransform: 'uppercase', color: th.bg, background: th.accent, padding: `${8 * u}px ${20 * u}px`, borderRadius: 999, opacity: p, transform: `translateX(${(1 - p) * -40 * u}px)` }}>
      {text}
    </div>
  );
};

export const Heading: React.FC<{ text?: string; at?: number; size?: number; align?: 'left' | 'center' }> = ({ text, at = 0, size = 76, align = 'left' }) => {
  const th = useTheme();
  const { u } = useLayout();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!text) return null;
  const p = springAt(f, at, fps);
  return (
    <div style={{ fontFamily: th.fontDisplay, fontWeight: 800, fontSize: size * u, lineHeight: 1.24, color: th.fg, textAlign: align, marginBottom: 36 * u, opacity: p, transform: `translateY(${(1 - p) * 40 * u}px)`, textWrap: 'balance' as any }}>
      <RichText text={text} />
    </div>
  );
};

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; tone?: 'good' | 'bad' | 'accent' | 'plain' }> = ({ children, style, tone = 'plain' }) => {
  const th = useTheme();
  const { u } = useLayout();
  const edge = tone === 'good' ? th.good : tone === 'bad' ? th.bad : tone === 'accent' ? th.accent : alpha(th.fg, 0.12);
  return (
    <div style={{ background: th.card, border: `${3 * u}px solid ${edge}`, borderRadius: th.radius * u, padding: `${26 * u}px ${30 * u}px`, boxShadow: `0 ${18 * u}px ${40 * u}px ${alpha('#000000', 0.22)}`, ...style }}>
      {children}
    </div>
  );
};
