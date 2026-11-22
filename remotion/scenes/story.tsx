import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Person } from '../kit/Character';
import { castState } from '../kit/Stage';
import { SetBack, SetFront, SetMid, WORLD, type DeskItem } from '../kit/Sets';
import { RichText } from '../kit/RichText';
import { Icon } from '../kit/Icon';
import { clamp, ease, springAt } from '../kit/anim';
import { useEp, useLayout } from '../kit/theme';
import { storyTimes } from '../../shared/reveal.mjs';
import type { CharacterSpec } from '../types';
import type { SceneProps } from './common';

// ───────── story: cảnh kể chuyện kiểu phim hoạt hình — bối cảnh nhiều lớp, nhân vật sau bàn tiền cảnh, máy quay đổi cỡ cảnh
// và đẩy chậm, nhãn/thẻ bật ra theo lời đọc, chèn màn hình điện thoại hoặc bảng tổng kết. Phụ đề nằm trên mặt bàn (không đè nhân vật).
// props:
//   set: van-phong | nha | hang-o        time: ngay | chieu | toi | dem        logo: bool (khung logo MISA trên tường văn phòng)
//   shot: toan (mặc định) | trung | can   focus: id nhân vật máy quay hướng vào (trung/can)   push: mức đẩy máy (mặc định 0.035)
//   label: nhãn phần (dòng vàng dưới tên tập, chỉ hiện ở toan/trung)
//   actors: [{ id, x?: 0..1, pose?, expr?, prop?: laptop, stand?: true (không ghế), flip? }]
//   desk: [{ kind: coc|dien-thoai|cay|giay|ban-phim|lon|tien|laptop, x: 0..1 }]     extras: false để bỏ đồng nghiệp phía sau
//   pops: [{ kind: tag|chip|alert|big|note, text, icon?, tone?, over?: id | at?: [x, y] (0..1), on?: số câu, off?: số câu, delay?, rot? }]
//   screen: { device: dien-thoai, app, sub?, avatar?, clock?, items: [{ in | out | sys | task (+reward) | balance (+from, label) | btn (+tone) | warn | transfer (+to), on? }] }
//         | { device: bang, title, icon?, rows: [{ text, sub?, on? }] }
// Mỗi câu: { text, speaker?, expr?, pose?, react? } — câu không ghi speaker là lời người dẫn chuyện.
const INK = '#141826';
const HIPU = 628; // toạ độ y (khung nhân vật) trùng mép bàn tiền cảnh
const DESK = WORLD.deskY;
const SHOT: Record<string, number> = { toan: 1, trung: 1.18, can: 1.42, 'man-hinh': 1.12 };
const EXTRAS: CharacterSpec[] = [
  { id: '_x1', name: '', gender: 'nu', kind: 'so-mi', outfitColor: '#F4C6D0', hair: 'bob', logo: false },
  { id: '_x2', name: '', gender: 'nam', kind: 'ao-thun', outfitColor: '#5B8DEF', hair: 'ngan', glasses: true, logo: false },
  { id: '_x3', name: '', gender: 'nu', kind: 'ao-thun', outfitColor: '#7BC8A4', hair: 'buoc', logo: false },
];
type Actor = { id: string; x?: number; pose?: string; expr?: string; prop?: string; stand?: boolean; flip?: boolean };
type Pop = { kind?: string; text: string; icon?: string; tone?: string; over?: string; at?: [number, number]; on?: number; off?: number; delay?: number; rot?: number };
const TONE: Record<string, string> = { vang: '#FFD21F', do: '#FF4B3E', xanh: '#33D17A', trang: '#FFFFFF', cam: '#FF8A1F' };
const money = (n: number) => Math.round(n).toLocaleString('de-DE') + 'đ';

export const Story: React.FC<SceneProps> = ({ scene }) => {
  const { ep, theme: th } = useEp();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { W, H, safe } = useLayout();
  const u = W / WORLD.W;
  const top0 = Math.max(0, (H - WORLD.H * u) / 2);
  const p = scene.props;
  const scr = p.screen as any;
  const shot: string = scr ? 'man-hinh' : p.shot ?? 'toan';
  const set: string = p.set ?? 'van-phong';
  const still = !!ep.still;

  // ── nhân vật
  const actors: Actor[] = p.actors ?? [];
  const n = actors.length;
  const k = n >= 3 ? 0.8 : 0.9;
  const defX = n === 1 ? [0.5] : n === 2 ? [0.29, 0.71] : n === 3 ? [0.19, 0.5, 0.81] : actors.map((_, i) => (i + 0.5) / n);
  const placed = actors.map((a, i) => ({ ...a, wx: (a.x ?? defX[i]) * WORLD.W }));
  const cur = [...scene.lines].reverse().find((l) => f >= l.from);
  const speaker = placed.find((a) => a.id === cur?.speaker);

  // ── máy quay
  const focus = placed.find((a) => a.id === (p.focus ?? (n === 1 ? actors[0].id : undefined)));
  const prog = still ? 1 : interpolate(f, [0, scene.duration], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const s = (SHOT[shot] ?? 1) * (1 + (p.push ?? 0.035) * prog);
  const fx = shot === 'toan' || shot === 'man-hinh' || !focus ? WORLD.W / 2 : focus.wx;
  let tx = WORLD.W / 2 - fx;
  tx = Math.max(WORLD.W - fx - (WORLD.W + WORLD.bleed - fx) * s, Math.min(-fx + (WORLD.bleed + fx) * s, tx));
  const toScreen = (x: number, y: number): [number, number] => [(fx + (x - fx) * s + tx) * u, top0 + (DESK + (y - DESK) * s) * u];
  const layer: React.CSSProperties = { position: 'absolute', left: -WORLD.bleed * u, top: 0, width: (WORLD.W + WORLD.bleed * 2) * u, height: WORLD.H * u };
  const blurBack = shot === 'can' ? 2.2 : shot === 'trung' ? 1 : 0;

  // ── nhân vật phụ phía sau (văn phòng)
  const extraX = set === 'van-phong' && p.extras !== false ? [130, 540, 950].filter((c) => placed.every((a) => Math.abs(a.wx - c) > 212)) : [];
  const ek = 0.44;

  // ── nhãn bật
  const pops: Pop[] = p.pops ?? [];
  const popAt = storyTimes(scene, pops, fps);
  const showBadge = (shot === 'toan' || shot === 'trung') && p.badge !== false;

  return (
    <AbsoluteFill style={{ background: '#0E1120', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: top0, width: WORLD.W * u, height: WORLD.H * u, transformOrigin: `${fx * u}px ${DESK * u}px`, transform: `translateX(${tx * u}px) scale(${s})`, filter: scr ? `blur(${7 * u}px) brightness(.5) saturate(.8)` : undefined }}>
        <div style={{ ...layer, filter: blurBack ? `blur(${blurBack * u}px)` : undefined }}>
          <SetBack set={set} time={p.time} frame={scene.from + f} logo={p.logo} />
        </div>
        {extraX.map((x, i) => (
          <div key={x} style={{ position: 'absolute', left: (x - 300 * ek) * u, top: 742 * u, filter: `saturate(.8) blur(${(0.8 + blurBack) * u}px)` }}>
            <Person spec={EXTRAS[(i + (x > 500 ? 1 : 0)) % EXTRAS.length]} pose="go-phim" expr="binh-thuong" frame={scene.from + f + i * 40} height={1200 * ek * u} look={x < 540 ? 0.5 : -0.5} />
          </div>
        ))}
        <div style={{ ...layer, filter: blurBack ? `blur(${blurBack * u}px)` : undefined }}>
          <SetMid set={set} time={p.time} extras={extraX} />
        </div>
        {/* ghế sau lưng nhân vật ngồi bàn */}
        {set !== 'nha' && (
          <svg style={{ ...layer }} viewBox={`${-WORLD.bleed} 0 ${WORLD.W + WORLD.bleed * 2} ${WORLD.H}`}>
            {placed.filter((a) => !a.stand).map((a) => {
              const den = set === 'hang-o';
              const w = (den ? 196 : 182) * k, t = DESK - (den ? 500 : 408) * k;
              return (
                <g key={a.id}>
                  <rect x={a.wx - w} y={t} width={w * 2} height={DESK - t + 30} rx={70 * k} fill={den ? '#10121E' : '#3E4658'} />
                  <rect x={a.wx - w + 16 * k} y={t + 16 * k} width={w * 2 - 32 * k} height={DESK - t} rx={56 * k} fill={den ? '#1A1D2E' : '#4A5368'} />
                  {den && <><rect x={a.wx - w + 16 * k} y={t + 60 * k} width={22 * k} height={DESK - t} fill="#E2342B" /><rect x={a.wx + w - 38 * k} y={t + 60 * k} width={22 * k} height={DESK - t} fill="#E2342B" /></>}
                </g>
              );
            })}
          </svg>
        )}
        {placed.map((a) => {
          const spec = ep.characters.find((c) => c.id === a.id);
          if (!spec) return null;
          const st = castState(scene, { id: a.id, pose: a.pose ?? 'dat-tay', expr: a.expr }, f);
          const poseT = st.poseFrom ? Math.min(1, (f - st.poseAt) / 9) : 1;
          // lời dẫn chuyện (câu không ghi speaker) là tiếng ngoài hình → không nhép miệng
          const mouth = still || cur?.narr ? 0 : ep.mouth?.[a.id]?.[scene.from + f] ?? 0;
          const others = placed.filter((o) => o.id !== a.id);
          const target = speaker && speaker.id !== a.id ? speaker.wx : others.length ? others.reduce((m, o) => (Math.abs(o.wx - a.wx) < Math.abs(m.wx - a.wx) ? o : m)).wx : a.wx;
          const look = Math.max(-1, Math.min(1, (target - a.wx) / 300));
          // hướng cử chỉ cố định cả cảnh: quay về bạn diễn gần nhất; một mình lệch một bên → cử chỉ một tay quay vào giữa
          const mate = others.length ? others.reduce((m, o) => (Math.abs(o.wx - a.wx) < Math.abs(m.wx - a.wx) ? o : m)).wx : null;
          const face = mate == null ? 0 : Math.sign(mate - a.wx);
          const aim = mate == null && Math.abs(a.wx - WORLD.W / 2) > WORLD.W * 0.12 ? Math.sign(WORLD.W / 2 - a.wx) : 0;
          return (
            <React.Fragment key={a.id}>
              <div style={{ position: 'absolute', left: (a.wx - 300 * k) * u, top: (DESK - HIPU * k) * u }}>
                <Person spec={spec} pose={st.pose} poseFrom={st.poseFrom} poseT={poseT} expr={st.expr} mouth={mouth} frame={scene.from + f} look={look} turn={look * 0.4} height={1200 * k * u} flip={a.flip} face={face} aim={aim} />
              </div>
              {/* hộp phần thân nhìn thấy (đầu → mép bàn) cho bộ soát bố cục */}
              {!scr && <div data-person={a.id} data-exact style={{ position: 'absolute', left: (a.wx - 160 * k) * u, top: (DESK - (HIPU + 8) * k) * u, width: 320 * k * u, height: (HIPU + 8) * k * u }} />}
            </React.Fragment>
          );
        })}
        <div style={layer}>
          <SetFront set={set} time={p.time} frame={scene.from + f} items={[...placed.filter((a) => a.prop).map((a) => ({ kind: a.prop!, x: a.wx })), ...((p.desk ?? []) as DeskItem[]).map((d) => ({ kind: d.kind, x: d.x * WORLD.W }))]} />
        </div>
      </div>
      {/* tối nhẹ phía trên cho dải tên tập */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: 420 * u, background: 'linear-gradient(rgba(10,12,24,.42), rgba(10,12,24,0))' }} />

      {showBadge && (
        <div style={{ position: 'absolute', left: safe.left, top: top0 + 238 * u, maxWidth: W - safe.left - safe.right, background: 'rgba(16,19,34,.92)', borderRadius: 22 * u, padding: `${14 * u}px ${26 * u}px ${16 * u}px`, boxShadow: `0 ${8 * u}px ${24 * u}px rgba(0,0,0,.28)` }}>
          <div style={{ fontFamily: th.fontDisplay, fontWeight: 800, fontSize: 38 * u, lineHeight: 1.3, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 * u }}>{ep.episode.title}</div>
          {p.label && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 * u, marginTop: 2 * u, fontFamily: th.fontBody, fontWeight: 700, fontSize: 30 * u, lineHeight: 1.35, color: '#FFD21F', opacity: still ? 1 : ease(f, 2, 10), transform: `translateX(${(1 - (still ? 1 : ease(f, 2, 12))) * -24 * u}px)` }}>
              <span style={{ width: 10 * u, height: 10 * u, borderRadius: 99, background: '#FFD21F', display: 'inline-block' }} />
              {p.label}
            </div>
          )}
        </div>
      )}

      {pops.map((q, i) => {
        const t0 = popAt[i];
        const off = q.off ? scene.lines[q.off - 1]?.from ?? Infinity : Infinity;
        if (f < t0 || f >= off + 6) return null;
        const e = still ? 1 : springAt(f, t0, fps, 10);
        const out = f >= off ? 1 - (f - off) / 6 : 1;
        const a = placed.find((x) => x.id === q.over);
        const [px, py] = a ? toScreen(a.wx, DESK - (HIPU + 8) * k) : [(q.at?.[0] ?? 0.5) * W, top0 + (q.at?.[1] ?? 0.22) * WORLD.H * u];
        const anchor = a ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)';
        const y = a ? py - 22 * u : py;
        const age = f - t0;
        const wig = still ? 0 : Math.sin(age / 2.6) * 4 * Math.exp(-age / 10);
        const kind = q.kind ?? 'tag';
        const base: React.CSSProperties = { position: 'absolute', left: px, top: y, opacity: Math.min(1, e * 1.8) * out, whiteSpace: 'nowrap', transformOrigin: a ? '50% 100%' : '50% 50%' };
        if (kind === 'chip')
          return (
            <div key={i} style={{ ...base, transform: `${anchor} translateX(${(1 - e) * -90 * u}px)`, display: 'flex', alignItems: 'center', gap: 12 * u, background: '#fff', color: INK, border: `${4 * u}px solid ${INK}`, borderRadius: 18 * u, padding: `${9 * u}px ${22 * u}px`, boxShadow: `0 ${6 * u}px 0 ${INK}`, fontFamily: th.fontBody, fontWeight: 700, fontSize: 34 * u, lineHeight: 1.3 }}>
              <Icon name={q.icon ?? 'map-pin'} size={34 * u} color="#F26B1D" stroke={2.6} />
              <span>{q.text}</span>
            </div>
          );
        if (kind === 'alert')
          return (
            <div key={i} style={{ ...base, transform: `${anchor} rotate(${wig * 0.8}deg) scale(${0.5 + 0.5 * e})`, display: 'flex', alignItems: 'center', gap: 14 * u, background: '#E5322D', color: '#fff', border: `${5 * u}px solid ${INK}`, borderRadius: 20 * u, padding: `${12 * u}px ${26 * u}px`, boxShadow: `0 ${8 * u}px 0 ${INK}`, fontFamily: th.fontDisplay, fontWeight: 800, fontSize: 40 * u, lineHeight: 1.3, textTransform: 'uppercase' }}>
              <Icon name={q.icon ?? 'triangle-alert'} size={42 * u} color="#FFE066" stroke={2.8} />
              <span>{q.text}</span>
            </div>
          );
        if (kind === 'big') {
          const e2 = still ? 1 : springAt(f, t0, fps, 8);
          return (
            <div key={i} style={{ ...base, transform: `${anchor} rotate(${(q.rot ?? -5) + wig * 0.5}deg) scale(${2.3 - 1.3 * e2})`, fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 124 * u, lineHeight: 1.2, color: TONE[q.tone ?? 'vang'] ?? q.tone, WebkitTextStroke: `${16 * u}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 ${10 * u}px 0 ${INK}`, letterSpacing: -1 * u }}>
              {q.text}
            </div>
          );
        }
        if (kind === 'note')
          return (
            <div key={i} style={{ ...base, whiteSpace: 'normal', width: 330 * u, transform: `${anchor} rotate(${(q.rot ?? 4) + wig}deg) scale(${0.5 + 0.5 * e})`, background: '#FFE566', color: INK, padding: `${30 * u}px ${24 * u}px ${22 * u}px`, boxShadow: `0 ${10 * u}px ${18 * u}px rgba(0,0,0,.35)`, fontFamily: th.fontBody, fontWeight: 700, fontSize: 30 * u, lineHeight: 1.45 }}>
              <div style={{ position: 'absolute', left: '50%', top: -14 * u, width: 110 * u, height: 30 * u, marginLeft: -55 * u, background: 'rgba(255,255,255,.55)', transform: 'rotate(-3deg)' }} />
              <RichText text={q.text} accent="#D4301F" accent2="#1565C0" />
            </div>
          );
        return (
          <div key={i} style={{ ...base, transform: `${anchor} rotate(${(q.rot ?? -4) + wig}deg) scale(${0.4 + 0.6 * e})`, display: 'flex', alignItems: 'center', gap: 12 * u, background: TONE[q.tone ?? 'cam'] ?? q.tone, color: INK, border: `${5 * u}px solid ${INK}`, borderRadius: 999, padding: `${8 * u}px ${28 * u}px`, boxShadow: `0 ${8 * u}px 0 ${INK}`, fontFamily: th.fontDisplay, fontWeight: 800, fontSize: 38 * u, lineHeight: 1.3, textTransform: 'uppercase' }}>
            <span>{q.text}</span>
            {q.icon && <Icon name={q.icon} size={38 * u} color={INK} stroke={2.8} />}
          </div>
        );
      })}

      {scr && (scr.device === 'bang' ? <Board scr={scr} scene={scene} top={top0 + 268 * u} u={u} /> : <PhoneScreen scr={scr} scene={scene} top={top0 + 246 * u} u={u} />)}
    </AbsoluteFill>
  );
};

// ───── bảng tổng kết: tiêu đề đỏ + các dòng đánh số trượt vào theo lời đọc
const Board: React.FC<{ scr: any; scene: SceneProps['scene']; top: number; u: number }> = ({ scr, scene, top, u }) => {
  const { ep, theme: th } = useEp();
  const f = useCurrentFrame();
  const { fps, width: W } = useVideoConfig();
  const rows: any[] = scr.rows ?? [];
  const at = storyTimes(scene, rows, fps);
  const still = !!ep.still;
  const e0 = still ? 1 : springAt(f, 2, fps, 13);
  const bw = 900 * u;
  return (
    <div style={{ position: 'absolute', left: (W - bw) / 2, top, width: bw, background: '#FFFDF6', border: `${6 * u}px solid ${INK}`, borderRadius: 44 * u, boxShadow: `0 ${14 * u}px 0 ${INK}`, overflow: 'hidden', transform: `translateY(${(1 - e0) * 160 * u}px) scale(${0.9 + 0.1 * e0})`, opacity: Math.min(1, e0 * 1.6) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 * u, background: '#E5322D', color: '#fff', padding: `${24 * u}px ${36 * u}px`, fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 54 * u, lineHeight: 1.25, textTransform: 'uppercase', borderBottom: `${6 * u}px solid ${INK}` }}>
        <Icon name={scr.icon ?? 'shield-alert'} size={62 * u} color="#FFE066" stroke={2.6} />
        <span>{scr.title}</span>
      </div>
      {rows.map((r, i) => {
        const e = still ? 1 : springAt(f, at[i], fps, 12);
        const on = still || f >= at[i];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 28 * u, padding: `${30 * u}px ${36 * u}px`, borderTop: i ? `${3 * u}px dashed #D9D2C2` : undefined }}>
            <div style={{ flex: 'none', width: 92 * u, height: 92 * u, borderRadius: 99, background: on ? '#FFD21F' : '#EAE4D6', border: `${5 * u}px solid ${on ? INK : '#CFC8B8'}`, display: 'grid', placeItems: 'center', fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 52 * u, lineHeight: 1, color: on ? INK : '#B5AE9E', transform: `scale(${on ? 0.7 + 0.3 * e : 1})` }}>{i + 1}</div>
            <div style={{ opacity: on ? Math.min(1, e * 1.5) : 0, transform: `translateX(${(1 - (on ? e : 0)) * 90 * u}px)` }}>
              <div style={{ fontFamily: th.fontBody, fontWeight: 700, fontSize: 46 * u, lineHeight: 1.36, color: INK }}><RichText text={r.text ?? r.row ?? ''} accent="#D4301F" accent2="#1565C0" /></div>
              {r.sub && <div style={{ fontFamily: th.fontBody, fontWeight: 500, fontSize: 32 * u, lineHeight: 1.4, color: '#5B6170', marginTop: 4 * u }}>{r.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ───── màn hình điện thoại: tin nhắn / nhiệm vụ / số dư / nút / cảnh báo hiện dần theo lời đọc
const PhoneScreen: React.FC<{ scr: any; scene: SceneProps['scene']; top: number; u: number }> = ({ scr, scene, top, u }) => {
  const { ep, theme: th } = useEp();
  const f = useCurrentFrame();
  const { fps, width: W } = useVideoConfig();
  const items: any[] = scr.items ?? [];
  const at = storyTimes(scene, items, fps);
  const still = !!ep.still;
  const e0 = still ? 1 : springAt(f, 2, fps, 13);
  const pw = 640 * u, ph = 990 * u;
  const body: React.CSSProperties = { fontFamily: th.fontBody, fontSize: 35 * u, lineHeight: 1.4, fontWeight: 500 };
  return (
    <div style={{ position: 'absolute', left: (W - pw) / 2, top, width: pw, height: ph, background: '#0C0E17', borderRadius: 74 * u, padding: 16 * u, boxSizing: 'border-box', boxShadow: `0 ${30 * u}px ${70 * u}px rgba(0,0,0,.55), 0 0 0 ${4 * u}px #2A2E3F`, transform: `translateY(${(1 - e0) * 300 * u}px) rotate(${(1 - e0) * 6 - 1.5}deg)`, opacity: Math.min(1, e0 * 1.6) }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 60 * u, overflow: 'hidden', background: scr.bg ?? '#EEF1F6', display: 'flex', flexDirection: 'column' }}>
        {/* thanh trạng thái + đầu trang */}
        <div style={{ flex: 'none', background: scr.color ?? '#1C6BF2', color: '#fff', padding: `${14 * u}px ${30 * u}px ${18 * u}px` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: th.fontBody, fontWeight: 700, fontSize: 24 * u, lineHeight: 1.3, opacity: 0.9 }}>
            <span>{scr.clock ?? '12:15'}</span>
            <span style={{ display: 'flex', gap: 8 * u, alignItems: 'center' }}><Icon name="signal" size={24 * u} color="#fff" stroke={2.6} /><Icon name="wifi" size={24 * u} color="#fff" stroke={2.6} /><Icon name="battery-medium" size={28 * u} color="#fff" stroke={2.4} /></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 * u, marginTop: 10 * u }}>
            <div style={{ flex: 'none', width: 66 * u, height: 66 * u, borderRadius: 99, background: '#fff', color: scr.color ?? '#1C6BF2', display: 'grid', placeItems: 'center', fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 36 * u, lineHeight: 1 }}>{scr.avatar ?? (scr.app ?? '?').slice(0, 1)}</div>
            <div>
              <div style={{ fontFamily: th.fontBody, fontWeight: 700, fontSize: 34 * u, lineHeight: 1.3 }}>{scr.app}</div>
              {scr.sub && <div style={{ fontFamily: th.fontBody, fontWeight: 500, fontSize: 24 * u, lineHeight: 1.3, opacity: 0.85 }}>{scr.sub}</div>}
            </div>
          </div>
        </div>
        {/* nội dung: mục mới ở dưới, mục cũ trôi lên */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 16 * u, padding: `${20 * u}px ${24 * u}px ${28 * u}px`, overflow: 'hidden' }}>
          {items.map((it, i) => {
            if (!still && f < at[i]) return null;
            const e = still ? 1 : springAt(f, at[i], fps, 12);
            return <div key={i} style={{ flex: 'none', display: 'flex', flexDirection: 'column' }}>{renderItem(it, i, e)}</div>;
          })}
        </div>
      </div>
    </div>
  );

  function renderItem(it: any, i: number, e: number): React.ReactNode {
    {
            const age = f - at[i];
            const pop: React.CSSProperties = { opacity: Math.min(1, e * 1.6), transform: `translateY(${(1 - e) * 30 * u}px) scale(${0.9 + 0.1 * e})` };
            if (it.in != null || it.out != null) {
              const me = it.out != null;
              return (
                <div key={i} style={{ ...pop, ...body, alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '84%', background: me ? '#1C6BF2' : '#fff', color: me ? '#fff' : INK, borderRadius: 30 * u, borderBottomRightRadius: me ? 8 * u : 30 * u, borderBottomLeftRadius: me ? 30 * u : 8 * u, padding: `${14 * u}px ${24 * u}px`, boxShadow: `0 ${3 * u}px ${8 * u}px rgba(20,24,38,.1)`, transformOrigin: me ? '100% 100%' : '0 100%' }}>
                  <RichText text={me ? it.out : it.in} accent={me ? '#FFE066' : '#D4301F'} accent2="#1565C0" />
                </div>
              );
            }
            if (it.sys != null) return <div key={i} style={{ ...pop, ...body, alignSelf: 'center', fontSize: 26 * u, color: '#7A8194', background: 'rgba(20,24,38,.06)', borderRadius: 99, padding: `${4 * u}px ${20 * u}px` }}>{it.sys}</div>;
            if (it.task != null)
              return (
                <div key={i} style={{ ...pop, display: 'flex', alignItems: 'center', gap: 16 * u, background: '#fff', borderRadius: 24 * u, padding: `${14 * u}px ${20 * u}px`, boxShadow: `0 ${3 * u}px ${8 * u}px rgba(20,24,38,.1)` }}>
                  <div style={{ flex: 'none', width: 60 * u, height: 60 * u, borderRadius: 99, background: '#FFE3E8', display: 'grid', placeItems: 'center', transform: `scale(${1 + Math.max(0, Math.sin(age / 2.5)) * 0.25 * Math.exp(-age / 14)})` }}><Icon name={it.icon ?? 'heart'} size={34 * u} color="#F0435A" stroke={2.8} /></div>
                  <div style={{ ...body, flex: 1, fontWeight: 600, color: INK, fontSize: 32 * u }}>{it.task}</div>
                  <div style={{ fontFamily: th.fontDisplay, fontWeight: 800, fontSize: 36 * u, lineHeight: 1.3, color: '#11A85F' }}>{it.reward}</div>
                </div>
              );
            if (it.balance != null) {
              const v = still ? it.balance : (it.from ?? 0) + (it.balance - (it.from ?? 0)) * ease(f, at[i] + 4, 26);
              return (
                <div key={i} style={{ ...pop, background: it.frozen ? 'linear-gradient(135deg,#6B7386,#4A5163)' : 'linear-gradient(135deg,#12B76A,#07864C)', color: '#fff', borderRadius: 28 * u, padding: `${18 * u}px ${28 * u}px ${20 * u}px`, boxShadow: `0 ${6 * u}px ${16 * u}px rgba(7,134,76,.3)` }}>
                  <div style={{ ...body, fontSize: 27 * u, fontWeight: 600, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 10 * u }}><Icon name={it.frozen ? 'lock' : 'wallet'} size={28 * u} color="#fff" stroke={2.6} />{it.label ?? 'Số dư ví'}</div>
                  <div style={{ fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 74 * u, lineHeight: 1.2 }}>{money(v)}</div>
                </div>
              );
            }
            if (it.btn != null) {
              const press = still ? 0 : Math.max(0, 1 - Math.abs(age - 12) / 5);
              const c = it.tone === 'do' ? '#E5322D' : it.tone === 'khoa' ? '#8A91A3' : '#11A85F';
              return (
                <div key={i} style={{ ...pop, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 * u, background: c, color: '#fff', borderRadius: 22 * u, padding: `${16 * u}px ${24 * u}px`, fontFamily: th.fontDisplay, fontWeight: 800, fontSize: 40 * u, lineHeight: 1.3, textTransform: 'uppercase', transform: `scale(${(0.9 + 0.1 * e) * (1 - press * 0.06)})`, filter: `brightness(${1 - press * 0.18})`, boxShadow: `0 ${6 * u}px 0 rgba(0,0,0,.22)` }}>
                  {it.tone === 'khoa' && <Icon name="lock" size={38 * u} color="#fff" stroke={2.8} />}
                  <span>{it.btn}</span>
                </div>
              );
            }
            if (it.warn != null)
              return (
                <div key={i} style={{ ...pop, ...body, display: 'flex', gap: 14 * u, alignItems: 'flex-start', background: '#FFE9E7', border: `${4 * u}px solid #E5322D`, color: '#A31712', fontWeight: 700, fontSize: 32 * u, borderRadius: 22 * u, padding: `${14 * u}px ${20 * u}px`, transform: `translateX(${still ? 0 : Math.sin(age / 1.4) * 9 * u * Math.exp(-age / 9)}px)` }}>
                  <div style={{ flex: 'none', marginTop: 4 * u }}><Icon name="triangle-alert" size={40 * u} color="#E5322D" stroke={2.8} /></div>
                  <div><RichText text={it.warn} accent="#E5322D" accent2="#1565C0" /></div>
                </div>
              );
            if (it.transfer != null)
              return (
                <div key={i} style={{ ...pop, alignSelf: 'flex-end', width: '86%', background: '#fff', borderRadius: 26 * u, overflow: 'hidden', boxShadow: `0 ${4 * u}px ${12 * u}px rgba(20,24,38,.14)` }}>
                  <div style={{ ...body, display: 'flex', alignItems: 'center', gap: 10 * u, background: '#0F2D6B', color: '#fff', fontWeight: 700, fontSize: 27 * u, padding: `${8 * u}px ${20 * u}px` }}><Icon name="circle-check" size={30 * u} color="#5BE49B" stroke={2.8} />Chuyển tiền thành công</div>
                  <div style={{ padding: `${10 * u}px ${20 * u}px ${14 * u}px` }}>
                    <div style={{ fontFamily: th.fontDisplay, fontWeight: 900, fontSize: 56 * u, lineHeight: 1.25, color: '#D4301F' }}>−{it.transfer}</div>
                    {it.to && <div style={{ ...body, fontSize: 26 * u, color: '#5B6170' }}>Tới: {it.to}</div>}
                  </div>
                </div>
              );
            return null;
    }
  }
};
