import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { FRAMING, HEAD, MASCOT_GROUND, Person, mascotBox, type Framing } from './Character';
import { springAt } from './anim';
import { useEp, useLayout } from './theme';
import type { CharacterSpec, TimedScene } from '../types';

// Sân khấu: đặt 1..n nhân vật trong một vùng (zoneTop → zoneBottom) theo khung máy, tự đổi biểu cảm/tư thế theo
// từng câu thoại (line.expr / line.pose cho người nói, line.react cho người nghe), nhép miệng theo voice, nhìn về người đang nói.
export type CastMember = { id: string; pose?: string; expr?: string; x?: number; flip?: boolean; enter?: boolean; turn?: number };
export type Placed = { id: string; cx: number; headTop: number; headBottom: number; left: number; right: number; k: number };

const BLEND = 9; // số frame chuyển tư thế

type State = { pose: string; expr?: string; poseFrom?: string; poseAt: number };
export const castState = (scene: TimedScene, m: CastMember, f: number): State => {
  let st: State = { pose: m.pose ?? 'dung', expr: m.expr, poseAt: -99 };
  for (const l of scene.lines) {
    if (l.from > f) break;
    const mine = l.speaker === m.id;
    const r = l.react?.[m.id];
    const next = mine ? { pose: l.pose, expr: l.expr } : typeof r === 'string' ? { expr: r } : r ? { pose: r.pose, expr: r.expr } : null;
    if (!next) continue;
    if (next.expr) st = { ...st, expr: next.expr };
    if (next.pose && next.pose !== st.pose) st = { ...st, poseFrom: st.pose, pose: next.pose, poseAt: l.from };
  }
  return st;
};

// chars (tuỳ chọn): danh sách nhân vật để biết ai là mascot → hộp đầu thấp hơn (bóng thoại đặt đúng trên đầu mascot)
export const layoutCast = (cast: CastMember[], opts: { W: number; zoneTop: number; zoneBottom: number; shot: Framing; xs?: number[]; chars?: CharacterSpec[] }): Placed[] => {
  const [y0, y1] = FRAMING[opts.shot];
  const n = cast.length;
  // to vừa vùng nhưng không chen nhau: mỗi người rộng ~420 đơn vị (cả tay) trong một ô W/n
  const k = Math.min((opts.zoneBottom - opts.zoneTop) / (y1 - y0), opts.W / Math.max(1, n) / 400);
  const def = n === 1 ? [0.5] : n === 2 ? [0.27, 0.73] : n === 3 ? [0.2, 0.5, 0.8] : cast.map((_, i) => (i + 0.5) / n);
  return cast.map((m, i) => {
    const cx = (m.x ?? opts.xs?.[i] ?? def[i]) * opts.W;
    const top = opts.zoneTop - y0 * k;
    if (opts.chars?.find((c) => c.id === m.id)?.kind === 'mascot') {
      const mb = mascotBox(MASCOT_GROUND[opts.shot]);
      return { id: m.id, cx, headTop: top + mb.top * k, headBottom: top + mb.head * k, left: cx - mb.h * 0.36 * k, right: cx + mb.h * 0.36 * k, k };
    }
    return { id: m.id, cx, headTop: top + HEAD.top * k, headBottom: top + HEAD.bottom * k, left: cx - HEAD.half * k, right: cx + HEAD.half * k, k };
  });
};

export const Stage: React.FC<{ scene: TimedScene; cast: CastMember[]; shot?: Framing; zoneTop: number; zoneBottom: number; xs?: number[]; enterAll?: boolean }> = ({ scene, cast, shot = 'trung-canh', zoneTop, zoneBottom, xs, enterAll = true }) => {
  const { ep } = useEp();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { W } = useLayout();
  const placed = layoutCast(cast, { W, zoneTop, zoneBottom, shot, xs, chars: ep.characters });
  const cur = [...scene.lines].reverse().find((l) => f >= l.from);
  const speakerX = placed.find((p) => p.id === cur?.speaker)?.cx;
  return (
    <>
      {cast.map((m, i) => {
        const spec = ep.characters.find((c) => c.id === m.id);
        if (!spec) return null;
        const pl = placed[i];
        const st = castState(scene, m, f);
        const poseT = st.poseFrom ? Math.min(1, (f - st.poseAt) / BLEND) : 1;
        const mouth = ep.still ? 0 : ep.mouth?.[m.id]?.[scene.from + f] ?? 0;
        const others = placed.filter((p) => p.id !== m.id);
        const target = speakerX != null && cur?.speaker !== m.id ? speakerX : others.length ? others.reduce((a, b) => (Math.abs(b.cx - pl.cx) < Math.abs(a.cx - pl.cx) ? b : a)).cx : pl.cx;
        const look = Math.max(-1, Math.min(1, (target - pl.cx) / (W * 0.25)));
        // hướng cử chỉ (cố định cả cảnh, không đổi theo người nói để tay không giật): có bạn diễn → quay về người gần nhất;
        // đứng một mình lệch một bên → cử chỉ một tay quay vào giữa khung hình
        const mate = others.length ? others.reduce((a, b) => (Math.abs(b.cx - pl.cx) < Math.abs(a.cx - pl.cx) ? b : a)).cx : null;
        const face = mate == null ? 0 : Math.sign(mate - pl.cx);
        const aim = mate == null && Math.abs(pl.cx - W / 2) > W * 0.12 ? Math.sign(W / 2 - pl.cx) : 0;
        const enter = m.enter === false || !enterAll || ep.still ? 1 : springAt(f, i * 4, fps, 14);
        const h = 1200 * pl.k;
        return (
          <div key={m.id} data-person={m.id} style={{ position: 'absolute', left: pl.cx - 300 * pl.k, top: zoneTop - FRAMING[shot][0] * pl.k + (1 - enter) * 160 * pl.k, opacity: Math.min(1, enter * 1.4) }}>
            <Person spec={spec} pose={st.pose} poseFrom={st.poseFrom} poseT={poseT} expr={st.expr} mouth={mouth} frame={scene.from + f} look={look} turn={m.turn ?? look * 0.4} height={h} flip={m.flip} face={face} aim={aim} ground={MASCOT_GROUND[shot]} />
          </div>
        );
      })}
    </>
  );
};
