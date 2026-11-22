import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, delayRender, continueRender } from 'remotion';
import { RichText } from '../kit/RichText';
import { Icon } from '../kit/Icon';
import { ease, revealFrames, springAt } from '../kit/anim';
import { useLayout, useTheme, alpha } from '../kit/theme';
import { Background } from '../kit/Background';
import { CharacterLayer, Heading, Kicker, SceneShell, useContentBox, type SceneProps } from './common';

// Khung điện thoại vector dùng chung cho chat/call/notification.
const PhoneFrame: React.FC<{ children: React.ReactNode; w: number; h: number; header?: React.ReactNode; dark?: boolean }> = ({ children, w, h, header, dark }) => {
  const { u } = useLayout();
  return (
    <div style={{ width: w, height: h, borderRadius: 64 * u, background: '#111', padding: 16 * u, boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,.45)`, alignSelf: 'center', flex: 'none' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 50 * u, overflow: 'hidden', background: dark ? '#0d1117' : '#eef1f6', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'absolute', top: 14 * u, left: '50%', transform: 'translateX(-50%)', width: 150 * u, height: 36 * u, borderRadius: 20 * u, background: '#000', zIndex: 3 }} />
        {header}
        {children}
      </div>
    </div>
  );
};

// ───────── chat: hội thoại tin nhắn, mỗi tin hiện theo lời đọc.
// props: { name, avatar? (icon), status?, messages: [{ from: 'them'|'me', text, beat?, link?, warn? }], heading?, warnLabel? }
export const Chat: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, portrait, H } = useLayout();
  const msgs = scene.props.messages ?? [];
  const at = revealFrames(scene, msgs.length, msgs, fps);
  const w = portrait ? 700 * u : 560 * u;
  const h = portrait ? Math.min(1040 * u, H * 0.52) : 860 * u;
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 * u, padding: `${66 * u}px ${26 * u}px ${18 * u}px`, background: '#fff', borderBottom: '1px solid #dde2ea' }}>
      <div style={{ width: 66 * u, height: 66 * u, borderRadius: '50%', background: alpha(th.accent2, 0.9), display: 'grid', placeItems: 'center' }}>
        <Icon name={scene.props.avatar ?? 'user'} size={36 * u} color="#fff" />
      </div>
      <div style={{ fontFamily: th.fontBody }}>
        <div style={{ fontWeight: 800, fontSize: 32 * u, color: '#111' }}>{scene.props.name ?? 'Người lạ'}</div>
        <div style={{ fontSize: 22 * u, color: '#22a35a' }}>{scene.props.status ?? 'Đang hoạt động'}</div>
      </div>
    </div>
  );
  // cuộn: giữ tin mới nhất trong khung
  const shown = at.filter((a) => f >= a).length;
  const scroll = Math.max(0, shown - (portrait ? 5 : 6)) * 120 * u;
  return (
    <SceneShell scene={scene}>
      {scene.props.heading && <Heading text={scene.props.heading} size={60} />}
      <PhoneFrame w={w} h={h} header={header}>
        <div style={{ flex: 1, padding: `${24 * u}px ${22 * u}px`, display: 'flex', flexDirection: 'column', gap: 16 * u, transform: `translateY(${-scroll}px)` }}>
          {msgs.map((m: any, i: number) => {
            const p = springAt(f, at[i], fps, 13);
            if (f < at[i] - 18) return null;
            const me = m.from === 'me';
            const typing = f < at[i] && f >= at[i] - 18 && !me;
            return (
              <div key={i} style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                {typing ? (
                  <div style={{ background: '#fff', borderRadius: 26 * u, padding: `${18 * u}px ${24 * u}px`, display: 'flex', gap: 8 * u }}>
                    {[0, 1, 2].map((d) => (
                      <div key={d} style={{ width: 12 * u, height: 12 * u, borderRadius: '50%', background: '#9aa3b2', transform: `translateY(${Math.sin((f + d * 4) / 3) * 4 * u}px)` }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ position: 'relative', transform: `scale(${0.7 + 0.3 * p})`, transformOrigin: me ? 'right bottom' : 'left bottom', opacity: Math.min(1, p * 1.6), background: me ? th.accent : '#fff', color: me ? th.bg : '#111', borderRadius: 26 * u, padding: `${16 * u}px ${22 * u}px`, fontFamily: th.fontBody, fontSize: 30 * u, lineHeight: 1.46, boxShadow: m.warn ? `0 0 0 ${4 * u}px ${th.bad}` : '0 1px 2px rgba(0,0,0,.1)' }}>
                    <RichText text={m.text} />
                    {m.link && <div style={{ marginTop: 8 * u, color: '#1a63d8', textDecoration: 'underline', wordBreak: 'break-all', fontSize: 26 * u }}>{m.link}</div>}
                    {m.warn && f >= at[i] + 10 && (
                      <div style={{ position: 'absolute', right: -20 * u, top: -26 * u, background: th.bad, color: '#fff', borderRadius: 999, padding: `${4 * u}px ${14 * u}px`, fontSize: 22 * u, fontWeight: 800, transform: `scale(${springAt(f, at[i] + 10, fps, 8)}) rotate(6deg)` }}>
                        {scene.props.warnLabel ?? 'DẤU HIỆU LỪA ĐẢO'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PhoneFrame>
    </SceneShell>
  );
};

// ───────── phone: màn hình cuộc gọi đến / thông báo.
// props: { mode: 'call'|'notify', caller?, number?, label?, notifications?: [{app, icon, title, text, beat?}] , heading? }
export const Phone: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, portrait, H } = useLayout();
  const w = portrait ? 640 * u : 520 * u;
  const h = portrait ? Math.min(1060 * u, H * 0.52) : 860 * u;
  const mode = scene.props.mode ?? 'call';
  const shake = mode === 'call' ? Math.sin(f * 1.6) * (Math.floor(f / 20) % 2 ? 0 : 3) * u : 0;
  if (mode === 'notify') {
    const ns = scene.props.notifications ?? [];
    const at = revealFrames(scene, ns.length, ns, fps);
    return (
      <SceneShell scene={scene}>
        {scene.props.heading && <Heading text={scene.props.heading} size={60} />}
        <PhoneFrame w={w} h={h} dark>
          <div style={{ textAlign: 'center', color: '#fff', fontFamily: th.fontDisplay, fontWeight: 300, fontSize: 120 * u, marginTop: 90 * u }}>{scene.props.time ?? '09:41'}</div>
          <div style={{ padding: 22 * u, display: 'flex', flexDirection: 'column', gap: 16 * u }}>
            {ns.map((n: any, i: number) => {
              const p = springAt(f, at[i], fps, 13);
              return (
                <div key={i} style={{ background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(10px)', borderRadius: 30 * u, padding: 20 * u, display: 'flex', gap: 16 * u, opacity: p, transform: `translateY(${(1 - p) * -60 * u}px)`, border: n.warn ? `${3 * u}px solid ${th.bad}` : 'none' }}>
                  <div style={{ flex: 'none', width: 64 * u, height: 64 * u, borderRadius: 16 * u, background: n.color ?? th.accent, display: 'grid', placeItems: 'center' }}>
                    <Icon name={n.icon ?? 'bell'} size={36 * u} color="#fff" />
                  </div>
                  <div style={{ fontFamily: th.fontBody, color: '#fff' }}>
                    <div style={{ fontSize: 22 * u, opacity: 0.7 }}>{n.app}</div>
                    <div style={{ fontWeight: 800, fontSize: 28 * u }}>{n.title}</div>
                    <div style={{ fontSize: 26 * u, lineHeight: 1.44 }}><RichText text={n.text} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </PhoneFrame>
      </SceneShell>
    );
  }
  const ring = (k: number) => {
    const t = ((f + k * 15) % 45) / 45;
    return <div key={k} style={{ position: 'absolute', inset: -t * 90 * u, borderRadius: '50%', border: `${3 * u}px solid rgba(255,255,255,${0.5 * (1 - t)})` }} />;
  };
  return (
    <SceneShell scene={scene}>
      {scene.props.heading && <Heading text={scene.props.heading} size={60} />}
      <div style={{ transform: `translateX(${shake}px)`, alignSelf: 'center' }}>
        <PhoneFrame w={w} h={h} dark>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 120 * u, background: `linear-gradient(180deg, #1f2937, #0b0f17)`, fontFamily: th.fontBody, color: '#fff' }}>
            <div style={{ fontSize: 28 * u, opacity: 0.7 }}>{scene.props.label ?? 'Cuộc gọi đến'}</div>
            <div style={{ fontSize: 56 * u, fontWeight: 800, marginTop: 14 * u, textAlign: 'center', padding: `0 ${20 * u}px` }}>{scene.props.caller ?? 'Không xác định'}</div>
            <div style={{ fontSize: 32 * u, opacity: 0.8, marginTop: 8 * u }}>{scene.props.number ?? ''}</div>
            <div style={{ position: 'relative', marginTop: 90 * u, width: 190 * u, height: 190 * u, borderRadius: '50%', background: '#374151', display: 'grid', placeItems: 'center' }}>
              {[0, 1, 2].map(ring)}
              <Icon name={scene.props.avatar ?? 'user-round'} size={110 * u} color="#cbd5e1" />
            </div>
            <div style={{ marginTop: 'auto', marginBottom: 80 * u, display: 'flex', gap: 150 * u }}>
              <div style={{ width: 110 * u, height: 110 * u, borderRadius: '50%', background: '#ef4444', display: 'grid', placeItems: 'center' }}><Icon name="phone-off" size={52 * u} color="#fff" /></div>
              <div style={{ width: 110 * u, height: 110 * u, borderRadius: '50%', background: '#22c55e', display: 'grid', placeItems: 'center', transform: `scale(${1 + Math.sin(f / 4) * 0.06})` }}><Icon name="phone" size={52 * u} color="#fff" /></div>
            </div>
          </div>
        </PhoneFrame>
      </div>
    </SceneShell>
  );
};

// ───────── alert: cảnh báo đỏ + dấu hiệu nhận biết. props: { title, items?: string[], icon?, kicker? }
export const Alert: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const items: string[] = scene.props.items ?? [];
  const at = revealFrames(scene, items.length, undefined, fps);
  const p = springAt(f, 0, fps, 8);
  const flash = f < 20 ? (Math.floor(f / 4) % 2 ? 0.18 : 0) : 0;
  return (
    <SceneShell scene={{ ...scene, props: { ...scene.props, bg: scene.props.bg ?? { tint: th.bad } } }}>
      <AbsoluteFill style={{ background: th.bad, opacity: flash, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 26 * u, marginBottom: 34 * u }}>
        <div style={{ flex: 'none', width: 140 * u, height: 140 * u, borderRadius: 36 * u, background: th.bad, display: 'grid', placeItems: 'center', transform: `scale(${p}) rotate(${Math.sin(f / 2.5) * (f < 30 ? 8 : 2)}deg)` }}>
          <Icon name={scene.props.icon ?? 'triangle-alert'} size={84 * u} color="#fff" stroke={2.6} />
        </div>
        <div>
          <Kicker text={scene.props.kicker ?? 'Cảnh báo'} />
        </div>
      </div>
      <Heading text={scene.props.title} size={80} />
      {items.map((t, i) => {
        const q = springAt(f, at[i], fps);
        return (
          <div key={i} style={{ display: 'flex', gap: 20 * u, alignItems: 'flex-start', margin: `${12 * u}px 0`, opacity: Math.min(1, q * 1.4), transform: `translateX(${(1 - q) * 60 * u}px)` }}>
            <Icon name="flag" size={46 * u} color={th.bad} />
            <div style={{ fontFamily: th.fontBody, fontWeight: 650, fontSize: 44 * u, lineHeight: 1.38, color: th.fg }}><RichText text={t} /></div>
          </div>
        );
      })}
    </SceneShell>
  );
};

// ───────── figure: hình minh hoạ SVG (Claude vẽ, để trong assets/ của tập) — nét tự vẽ dần + chú thích.
// props: { src: 'assets/x.svg', caption?, heading?, draw?: true }
const svgCache: Record<string, string> = {};
export const Figure: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { u } = useLayout();
  const src = scene.props.src as string;
  const [svg, setSvg] = React.useState<string | null>(svgCache[src] ?? null);
  const [handle] = React.useState(() => (svgCache[src] ? null : delayRender(`svg ${src}`)));
  React.useEffect(() => {
    if (svg || !src) return;
    fetch(staticFile(src))
      .then((r) => r.text())
      .then((t) => {
        // pathLength=1 cho mọi nét để vẽ dần bằng stroke-dashoffset
        const s = t.replace(/<(path|line|polyline|polygon|circle|ellipse|rect)(\s)/g, '<$1 pathLength="1"$2');
        svgCache[src] = s;
        setSvg(s);
        if (handle != null) continueRender(handle);
      })
      .catch(() => handle != null && continueRender(handle));
  }, [src]);
  const draw = scene.props.draw === false ? 1 : ease(f, 2, Math.min(60, scene.duration * 0.5));
  const fill = scene.props.draw === false ? 1 : ease(f, 30, 24);
  return (
    <SceneShell scene={scene}>
      <Heading text={scene.props.heading} size={64} />
      <div
        className="fig"
        style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ['--d' as any]: 1 - draw, ['--fo' as any]: fill }}
      >
        <style>{`.fig svg{width:100%;height:100%;max-height:100%} .fig svg [pathLength]{stroke-dasharray:1;stroke-dashoffset:var(--d);fill-opacity:var(--fo)}`}</style>
        {svg && <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svg }} />}
      </div>
      {scene.props.caption && <div style={{ marginTop: 20 * u, fontFamily: th.fontBody, fontSize: 38 * u, color: th.muted, textAlign: 'center', opacity: ease(f, 20, 14) }}><RichText text={scene.props.caption} /></div>}
    </SceneShell>
  );
};


// ───────── photo: ảnh thật từ tư liệu người dùng (không phải ảnh AI) — trôi chậm kiểu Ken Burns, chú thích + nguồn.
// props: { src: 'assets/x.jpg', ratio?: cao/rộng của ảnh (lấy từ index.md tư liệu, vd 500/800 = 0.625), heading?, caption?, source?,
//          fit?: 'cover'|'contain', focus?: [x,y] 0..1, zoom?: 'in'|'out'|'none' }
//     hoặc images: [{ src, caption?, beat?, at? }] (2–4 ảnh) — mỗi ảnh hiện theo câu thoại, ảnh trước mờ dần.
export const Photo: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const box = useContentBox(scene);
  const p = scene.props;
  const list: { src: string; caption?: string; beat?: number; at?: number }[] = p.images?.length ? p.images.slice(0, 4) : [{ src: p.src, caption: p.caption }];
  const starts = list.length > 1 ? revealFrames(scene, list.length, list, fps) : [0];
  let cur = 0;
  starts.forEach((s0, i) => { if (f >= s0) cur = i; });
  const headH = p.heading ? 110 * u : 0;
  const capText = list[cur]?.caption ?? (list.length > 1 ? null : p.caption);
  const footH = (capText ? 70 * u : 0) + (p.source ? 46 * u : 0);
  const ratio = Math.min(1.6, Math.max(0.4, +p.ratio || 1)); // khung theo tỉ lệ ảnh để không cắt mất nội dung
  const imgH = Math.max(200 * u, Math.min(box.h - headH - footH - 24 * u, box.w * ratio));
  const fit = p.fit === 'contain' ? 'contain' : 'cover';
  const [fx, fy] = Array.isArray(p.focus) ? p.focus : [0.5, 0.5];
  return (
    <AbsoluteFill>
      <Background variant={p.bg?.variant} tint={p.bg?.tint} />
      {scene.character && <CharacterLayer scene={scene} />}
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 * u }}>
        {p.heading && <Heading text={p.heading} size={64} />}
        <div style={{ position: 'relative', width: '100%', height: imgH, borderRadius: 28 * u, overflow: 'hidden', background: alpha(th.fg, 0.08), boxShadow: `0 ${18 * u}px ${50 * u}px rgba(0,0,0,.28)`, border: `${6 * u}px solid ${th.card ?? '#fff'}`, opacity: ease(f, 0, 10), transform: `scale(${0.94 + 0.06 * springAt(f, 0, fps)})` }}>
          {list.map((im, i) => {
            const s0 = starts[i], s1 = starts[i + 1] ?? scene.duration + 30;
            const vis = i === 0 ? 1 - ease(f, s1, 10) : ease(f, s0, 12) * (1 - ease(f, s1, 10));
            if (vis <= 0.001 && i !== cur) return null;
            const t = Math.min(1, Math.max(0, (f - s0) / Math.max(30, s1 - s0)));
            const z = p.zoom === 'none' ? 1 : p.zoom === 'out' ? 1.12 - 0.12 * t : 1 + 0.12 * t;
            return (
              <Img key={i} src={staticFile(im.src)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, objectPosition: `${fx * 100}% ${fy * 100}%`, opacity: vis, transform: `scale(${z})`, transformOrigin: `${fx * 100}% ${fy * 100}%` }} />
            );
          })}
        </div>
        {capText && <div style={{ fontFamily: th.fontBody, fontSize: 38 * u, lineHeight: 1.3, color: th.fg, textAlign: 'center', opacity: ease(f, (starts[cur] ?? 0) + 6, 12) }}><RichText text={capText} /></div>}
        {p.source && <div style={{ fontFamily: th.fontBody, fontSize: 26 * u, color: th.muted, textAlign: 'right' }}>Nguồn: {p.source}</div>}
      </div>
    </AbsoluteFill>
  );
};
