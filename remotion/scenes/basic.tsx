import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { RichText, tokenize } from '../kit/RichText';
import { Icon } from '../kit/Icon';
import { clamp, ease, revealFrames, springAt } from '../kit/anim';
import { useEp, useLayout, useTheme, alpha } from '../kit/theme';
import { MisaLogo } from '../kit/MisaLogo';
import { Card, Heading, Kicker, SceneShell, type SceneProps } from './common';

// ───────── hook: câu mở đầu thật to, từng cụm từ bật ra; *từ* = nhấn màu.
// props: { text, kicker?, icon?, sub? }
export const Hook: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, portrait } = useLayout();
  const { text = '', kicker, icon, sub } = scene.props;
  const words = tokenize(text).flatMap((t) => (t.k === 'br' ? [{ t: '\n', k: 'br' as const }] : t.t.split(/(\s+)/).filter(Boolean).map((w) => ({ t: w, k: t.k }))));
  let n = 0;
  return (
    <SceneShell scene={scene}>
      {icon && (
        <div style={{ marginBottom: 30 * u, transform: `scale(${springAt(f, 0, fps, 9)}) rotate(${Math.sin(f / 5) * 4}deg)`, alignSelf: 'flex-start' }}>
          <div style={{ width: 150 * u, height: 150 * u, borderRadius: 40 * u, background: alpha(th.accent, 0.18), display: 'grid', placeItems: 'center', border: `${4 * u}px solid ${th.accent}` }}>
            <Icon name={icon} size={86 * u} color={th.accent} stroke={2.4} />
          </div>
        </div>
      )}
      <Kicker text={kicker} />
      <div style={{ fontFamily: th.fontDisplay, fontWeight: 900, fontSize: (portrait ? 108 : 112) * u, lineHeight: 1.18, color: th.fg, textWrap: 'balance' as any }}>
        {words.map((w, i) => {
          if (w.k === 'br') return <br key={i} />;
          if (/^\s+$/.test(w.t)) return <span key={i}> </span>;
          const p = springAt(f, 2 + n++ * 3, fps, 11);
          const color = w.k === 'a' ? th.accent : w.k === 'b' ? th.accent2 : w.k === 'del' ? th.bad : th.fg;
          return (
            <span key={i} style={{ display: 'inline-block', color, opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 60 * u}px) scale(${0.7 + 0.3 * p})`, background: w.k === 'hl' ? alpha(th.accent, 0.35) : undefined, padding: w.k === 'hl' ? `0 ${8 * u}px` : undefined }}>
              {w.t}
            </span>
          );
        })}
      </div>
      {sub && (
        <div style={{ marginTop: 34 * u, fontFamily: th.fontBody, fontSize: 40 * u, fontWeight: 500, color: th.muted, opacity: ease(f, 2 + n * 3 + 6, 12) }}>
          <RichText text={sub} />
        </div>
      )}
    </SceneShell>
  );
};

// ───────── title: thẻ tên tập. props: { title, sub?, number? } — số to chỉ hiện khi ghi rõ `number` (không tự lấy số tập: tập đăng không theo thứ tự)
export const Title: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const { ep } = useEp();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const p = springAt(f, 0, fps, 12);
  const num = scene.props.number;
  return (
    <SceneShell scene={scene}>
      <div style={{ textAlign: 'center' }}>
        {num != null && (
          <div style={{ display: 'inline-block', fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 200 * u, lineHeight: 1, color: 'transparent', WebkitTextStroke: `${4 * u}px ${th.accent}`, transform: `scale(${0.6 + 0.4 * p})`, opacity: p }}>
            {String(num).padStart(2, '0')}
          </div>
        )}
        <div style={{ height: 8 * u, width: `${ease(f, 6, 16) * 40}%`, margin: `${24 * u}px auto`, background: th.accent, borderRadius: 8 * u }} />
        <Heading text={scene.props.title ?? ep.episode.title} at={8} size={84} align="center" />
        {scene.props.sub && <div style={{ fontFamily: th.fontBody, fontSize: 40 * u, color: th.muted, opacity: ease(f, 16, 14) }}><RichText text={scene.props.sub} /></div>}
      </div>
    </SceneShell>
  );
};

// ───────── bullets: tiêu đề + danh sách hiện theo lời đọc.
// props: { heading, kicker?, items: [{ text, icon?, beat?, tone? } | string], numbered? }
export const Bullets: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const items = (scene.props.items ?? []).map((x: any) => (typeof x === 'string' ? { text: x } : x));
  const at = revealFrames(scene, items.length, items, fps);
  return (
    <SceneShell scene={scene}>
      <Kicker text={scene.props.kicker} />
      <Heading text={scene.props.heading} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 * u }}>
        {items.map((it: any, i: number) => {
          const p = springAt(f, at[i], fps);
          const active = f >= at[i] && (i === items.length - 1 || f < at[i + 1]);
          const c = it.tone === 'bad' ? th.bad : it.tone === 'good' ? th.good : th.accent;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26 * u, opacity: Math.min(1, p * 1.4) * (active || f < at[i] ? 1 : 0.62), transform: `translateX(${(1 - p) * 80 * u}px)` }}>
              <div style={{ flex: 'none', width: 84 * u, height: 84 * u, borderRadius: 24 * u, background: active ? c : alpha(c, 0.18), display: 'grid', placeItems: 'center', fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 40 * u, color: active ? th.bg : c }}>
                {it.icon ? <Icon name={it.icon} size={46 * u} color={active ? th.bg : c} /> : scene.props.numbered === false ? '•' : i + 1}
              </div>
              <div style={{ fontFamily: th.fontBody, fontWeight: 650, fontSize: 46 * u, lineHeight: 1.38, color: th.fg }}>
                <RichText text={it.text} />
              </div>
            </div>
          );
        })}
      </div>
    </SceneShell>
  );
};

// ───────── stat: con số lớn đếm lên. props: { value, prefix?, suffix?, decimals?, label, source?, icon? }
export const Stat: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { u } = useLayout();
  const { value = 0, prefix = '', suffix = '', decimals = 0, label, source, icon } = scene.props;
  const p = ease(f, 4, Math.min(45, scene.duration * 0.45));
  const v = (value * p).toLocaleString('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const done = p >= 1 ? interpolate(f % 40, [0, 20, 40], [1, 1.04, 1]) : 1;
  return (
    <SceneShell scene={scene}>
      <div style={{ textAlign: 'center' }}>
        {icon && <div style={{ marginBottom: 20 * u, opacity: ease(f, 0, 10) }}><Icon name={icon} size={110 * u} color={th.accent} /></div>}
        <div style={{ fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 210 * u, lineHeight: 1, color: th.accent, transform: `scale(${done})`, fontVariantNumeric: 'tabular-nums' }}>
          {prefix}
          {v}
          <span style={{ fontSize: 120 * u }}>{suffix}</span>
        </div>
        <div style={{ marginTop: 26 * u, fontFamily: th.fontBody, fontWeight: 700, fontSize: 52 * u, lineHeight: 1.38, color: th.fg, opacity: ease(f, 14, 14) }}>
          <RichText text={label ?? ''} />
        </div>
        {source && <div style={{ marginTop: 22 * u, fontFamily: th.fontBody, fontSize: 28 * u, color: th.muted, opacity: ease(f, 24, 14) }}>Nguồn: {source}</div>}
      </div>
    </SceneShell>
  );
};

// ───────── quote: trích dẫn. props: { text, author?, role? }
export const Quote: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { u } = useLayout();
  return (
    <SceneShell scene={scene}>
      <div style={{ fontFamily: th.fontDisplay, fontSize: 260 * u, lineHeight: 0.6, color: th.accent, opacity: ease(f, 0, 10), height: 120 * u }}>“</div>
      <div style={{ fontFamily: th.fontDisplay, fontWeight: 700, fontSize: 64 * u, lineHeight: 1.44, color: th.fg }}>
        <RichText text={scene.props.text ?? ''} hl={ease(f, 10, 30)} />
      </div>
      {scene.props.author && (
        <div style={{ marginTop: 40 * u, fontFamily: th.fontBody, fontSize: 36 * u, color: th.muted, opacity: ease(f, 18, 14) }}>
          — <b style={{ color: th.fg }}>{scene.props.author}</b>
          {scene.props.role ? `, ${scene.props.role}` : ''}
        </div>
      )}
    </SceneShell>
  );
};

// ───────── compare: hai cột (sai/đúng, trước/sau). props: { heading?, left: {title, items[], tone?}, right: {...} }
export const Compare: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, portrait } = useLayout();
  const L = scene.props.left ?? { title: '', items: [] };
  const R = scene.props.right ?? { title: '', items: [] };
  const all = [...(L.items ?? []), ...(R.items ?? [])];
  const at = revealFrames(scene, all.length + 2, undefined, fps);
  const col = (side: any, tone: 'bad' | 'good', base: number, off: number) => {
    const c = tone === 'bad' ? th.bad : th.good;
    const p = springAt(f, at[base] ?? 0, fps);
    return (
      <Card tone={tone} style={{ flex: 1, opacity: p, transform: `translateY(${(1 - p) * 50 * u}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 * u, fontFamily: th.fontDisplay, fontWeight: 800, fontSize: 44 * u, color: c, marginBottom: 18 * u }}>
          <Icon name={tone === 'bad' ? 'circle-x' : 'circle-check'} size={48 * u} color={c} /> <RichText text={side.title} />
        </div>
        {(side.items ?? []).map((t: string, i: number) => {
          const q = springAt(f, at[off + i] ?? 0, fps);
          return (
            <div key={i} style={{ fontFamily: th.fontBody, fontSize: 38 * u, lineHeight: 1.44, color: th.fg, margin: `${12 * u}px 0`, opacity: q, transform: `translateX(${(1 - q) * 30 * u}px)` }}>
              <RichText text={t} />
            </div>
          );
        })}
      </Card>
    );
  };
  const nl = (L.items ?? []).length;
  return (
    <SceneShell scene={scene}>
      <Heading text={scene.props.heading} />
      <div style={{ display: 'flex', flexDirection: portrait ? 'column' : 'row', gap: 28 * u }}>
        {col(L, L.tone ?? 'bad', 0, 1)}
        {col(R, R.tone ?? 'good', nl + 1, nl + 2)}
      </div>
    </SceneShell>
  );
};

// ───────── steps: các bước có đường nối. props: { heading?, steps: [{title, text?, icon?}] }
export const Steps: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const steps = scene.props.steps ?? [];
  const at = revealFrames(scene, steps.length, steps, fps);
  return (
    <SceneShell scene={scene}>
      <Heading text={scene.props.heading} />
      <div style={{ position: 'relative' }}>
        {steps.map((s: any, i: number) => {
          const p = springAt(f, at[i], fps);
          const line = i < steps.length - 1 ? ease(f, at[i] + 6, Math.max(8, (at[i + 1] ?? at[i] + 20) - at[i] - 6)) : 0;
          return (
            <div key={i} style={{ position: 'relative', display: 'flex', gap: 28 * u, paddingBottom: 34 * u, opacity: Math.min(1, p * 1.4) }}>
              {i < steps.length - 1 && <div style={{ position: 'absolute', left: 43 * u, top: 90 * u, width: 6 * u, height: `calc(${line * 100}% - ${70 * u}px)`, background: th.accent, borderRadius: 3 * u }} />}
              <div style={{ flex: 'none', width: 92 * u, height: 92 * u, borderRadius: '50%', background: th.accent, color: th.bg, display: 'grid', placeItems: 'center', fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 44 * u, transform: `scale(${p})` }}>
                {s.icon ? <Icon name={s.icon} size={46 * u} color={th.bg} /> : i + 1}
              </div>
              <div style={{ paddingTop: 12 * u, transform: `translateX(${(1 - p) * 40 * u}px)` }}>
                <div style={{ fontFamily: th.fontDisplay, fontWeight: 800, fontSize: 46 * u, color: th.fg }}><RichText text={s.title} /></div>
                {s.text && <div style={{ fontFamily: th.fontBody, fontSize: 34 * u, lineHeight: 1.44, color: th.muted, marginTop: 6 * u }}><RichText text={s.text} /></div>}
              </div>
            </div>
          );
        })}
      </div>
    </SceneShell>
  );
};

// ───────── icons: lưới thẻ icon. props: { heading?, items: [{icon, label, tone?}], cols? }
export const Icons: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, portrait } = useLayout();
  const items = scene.props.items ?? [];
  const cols = scene.props.cols ?? (portrait ? 2 : Math.min(4, items.length));
  const at = revealFrames(scene, items.length, items, fps);
  const row = cols === 1;
  return (
    <SceneShell scene={scene}>
      <Heading text={scene.props.heading} />
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 24 * u }}>
        {items.map((it: any, i: number) => {
          const p = springAt(f, at[i], fps, 11);
          const c = it.tone === 'bad' ? th.bad : it.tone === 'good' ? th.good : th.accent;
          return (
            <Card key={i} tone={it.tone ?? 'plain'} style={{ textAlign: row ? 'left' : 'center', display: row ? 'flex' : 'block', alignItems: 'center', gap: 26 * u, transform: `scale(${0.5 + 0.5 * p})`, opacity: Math.min(1, p * 1.5), padding: row ? `${22 * u}px ${28 * u}px` : `${30 * u}px ${18 * u}px` }}>
              <Icon name={it.icon} size={(row ? 64 : 84) * u} color={c} />
              <div style={{ marginTop: row ? 0 : 16 * u, fontFamily: th.fontBody, fontWeight: 700, fontSize: (row ? 42 : 36) * u, lineHeight: 1.34, color: th.fg }}><RichText text={it.label} /></div>
            </Card>
          );
        })}
      </div>
    </SceneShell>
  );
};

// ───────── chart: biểu đồ cột ngang. props: { heading?, unit?, bars: [{label, value, highlight?}] }
export const Chart: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const bars = scene.props.bars ?? [];
  const max = Math.max(1, ...bars.map((b: any) => b.value));
  const at = revealFrames(scene, bars.length, bars, fps);
  return (
    <SceneShell scene={scene}>
      <Heading text={scene.props.heading} />
      {bars.map((b: any, i: number) => {
        const p = ease(f, at[i], 22);
        return (
          <div key={i} style={{ marginBottom: 26 * u }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: th.fontBody, fontWeight: 700, fontSize: 36 * u, color: th.fg, marginBottom: 10 * u, opacity: Math.min(1, p * 3) }}>
              <span><RichText text={b.label} /></span>
              <span style={{ color: b.highlight ? th.accent : th.muted, fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(b.value * p).toLocaleString('vi-VN')}
                {scene.props.unit ?? ''}
              </span>
            </div>
            <div style={{ height: 46 * u, borderRadius: 14 * u, background: alpha(th.fg, 0.08), overflow: 'hidden' }}>
              <div style={{ width: `${(b.value / max) * 100 * p}%`, height: '100%', borderRadius: 14 * u, background: b.highlight ? th.accent : alpha(th.accent, 0.45) }} />
            </div>
          </div>
        );
      })}
    </SceneShell>
  );
};

// ───────── kinetic: chữ động toàn màn hình, mỗi câu thoại một khối chữ to. props: { phrases?: string[] } (mặc định = lời thoại)
export const Kinetic: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const phrases: string[] = scene.props.phrases ?? scene.lines.map((l) => l.text);
  const at = revealFrames(scene, phrases.length, undefined, fps);
  let idx = 0;
  at.forEach((a, i) => { if (f >= a) idx = i; });
  const p = springAt(f, at[idx] ?? 0, fps, 12);
  return (
    <SceneShell scene={scene}>
      <div key={idx} style={{ fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 118 * u, lineHeight: 1.18, color: th.fg, textAlign: 'center', transform: `scale(${0.8 + 0.2 * p}) rotate(${(1 - p) * (idx % 2 ? 3 : -3)}deg)`, opacity: Math.min(1, p * 1.5), textWrap: 'balance' as any }}>
        <RichText text={phrases[idx] ?? ''} />
      </div>
    </SceneShell>
  );
};

// ───────── outro: lời kêu gọi + kênh. props: { cta?, handle?, logo? ('misa') }
// Không có dòng "Tập sau": tập nào được duyệt/đăng và đăng theo thứ tự nào là việc của người dùng — báo trước tập sau dễ sai (người dùng 2026-11-22).
export const Outro: React.FC<SceneProps> = ({ scene }) => {
  const th = useTheme();
  const { ep } = useEp();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const p = springAt(f, 0, fps, 11);
  const pulse = 1 + Math.sin(f / 6) * 0.03;
  return (
    <SceneShell scene={scene}>
      <div style={{ textAlign: 'center' }}>
        {scene.props.logo === 'misa' && (
          <div style={{ display: 'inline-block', background: '#fff', borderRadius: 28 * u, padding: `${20 * u}px ${34 * u}px`, marginBottom: 40 * u, transform: `scale(${p})` }}>
            <MisaLogo width={300 * u} />
          </div>
        )}
        <Heading text={scene.props.cta ?? 'Theo dõi để xem tập tiếp theo'} align="center" size={78} />
        {scene.props.handle !== false && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16 * u, background: th.accent, color: th.bg, fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 44 * u, padding: `${22 * u}px ${44 * u}px`, borderRadius: 999, transform: `scale(${springAt(f, 10, fps, 9) * pulse})` }}>
            <Icon name="bell-ring" size={46 * u} color={th.bg} /> {scene.props.handle ?? ep.series.channel ?? 'Theo dõi'}
          </div>
        )}
      </div>
    </SceneShell>
  );
};

export { clamp };
