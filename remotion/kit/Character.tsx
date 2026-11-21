import React, { useId } from 'react';
import { MisaLogo, MISA_LOGO_RATIO } from './MisaLogo';
import type { CharacterSpec } from '../types';

// Nhân vật người — minh hoạ phẳng, TOÀN THÂN, dáng ĐẦY ĐẶN (~6 đầu: vai rộng, thân dày, tay chân to vừa phải), khung 600×1200, gốc trên-trái.
// Mốc: đỉnh đầu y≈14 · cằm 204 · vai 290 · eo 480 · hông 640 · gối 886 · mắt cá 1120 · đế giày 1164.
// Cách vẽ: mỗi khối (tay, quần, mặt, tóc…) vẽ HAI LƯỢT — lượt viền (nét cùng tông màu, đậm hơn) rồi lượt tô — nên các đoạn
// trong cùng một khối liền nhau, không lộ khớp khuỷu/gối/cổ tay. Có khớp vai/khuỷu/cổ tay/hông/gối → tư thế chuyển dần.
// Trang phục: misa (polo vàng đồng phục: cổ + nẹp than, sọc đỏ, logo MISA đầy đủ ngực trái) · so-mi · vest · hoodie · ao-thun · cardigan; quần hoặc váy.
// Khung máy (FRAMING): toan-than · trung-canh (tới trên gối) · can-canh (tới ngực).

export const SHIRT = { yellow: '#F6D21F', yellowShade: '#E3B90C', dark: '#2B2E36', red: '#E2342B', button: '#C9CCD3' };
const EYELINE = '#2A1C1A';
const MOUTH = '#5E1A22';
const TONGUE = '#E57880';
const LIP = '#D4636C';

// ───── màu
const hex = (h: string) => { const n = h.replace('#', ''); const v = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n.slice(0, 6), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const mix = (a: string, b: string, t: number) => { const A = hex(a), B = hex(b); return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join(''); };
const shade = (c: string, t = 0.16) => mix(c, '#1A1020', t);
const light = (c: string, t = 0.2) => mix(c, '#ffffff', t);
const ol = (c: string) => mix(mix(c, '#000000', 0.5), '#4A1E2A', 0.3); // màu nét viền của một mảng màu

// ───── vẽ hai lượt (viền → tô)
type Pass = 'o' | 'f';
const LW = 2.7; // độ dày nét viền nhìn thấy (đơn vị khung 600)
const sp = (pass: Pass, d: string, fill: string, key?: React.Key, line?: string) =>
  pass === 'o'
    ? <path key={key} d={d} fill={line ?? ol(fill)} stroke={line ?? ol(fill)} strokeWidth={LW * 2} strokeLinejoin="round" strokeLinecap="round" />
    : <path key={key} d={d} fill={fill} />;
const Two: React.FC<{ r: (pass: Pass) => React.ReactNode }> = ({ r }) => <>{r('o')}{r('f')}</>;

// ───── hình học
type V = [number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (P: V, Q: V, t: number): V => [lerp(P[0], Q[0], t), lerp(P[1], Q[1], t)];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const ik = (S: V, T: V, a: number, b: number, bend: number): V => {
  const dx = T[0] - S[0], dy = T[1] - S[1];
  let d = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / d, uy = dy / d;
  d = Math.min(d, a + b - 0.5);
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  return [S[0] + ux * x - uy * h * bend, S[1] + uy * x + ux * h * bend];
};
const ang = (P: V, Q: V) => (Math.atan2(-(Q[0] - P[0]), Q[1] - P[1]) * 180) / Math.PI;
const rad = (a: number) => (a * Math.PI) / 180;
// đoạn chi thon: từ P (rộng w1) tới Q (rộng w2), hai đầu bo tròn
const limb = (P: V, Q: V, w1: number, w2: number, capP = true, capQ = true) => {
  const dx = Q[0] - P[0], dy = Q[1] - P[1], d = Math.max(0.01, Math.hypot(dx, dy));
  const ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
  const a: V = [P[0] + (nx * w1) / 2, P[1] + (ny * w1) / 2], b: V = [Q[0] + (nx * w2) / 2, Q[1] + (ny * w2) / 2];
  const c: V = [Q[0] - (nx * w2) / 2, Q[1] - (ny * w2) / 2], e: V = [P[0] - (nx * w1) / 2, P[1] - (ny * w1) / 2];
  const k2 = capQ ? w2 * 0.66 : 0, k1 = capP ? w1 * 0.66 : 0;
  const n = (v: number) => v.toFixed(1);
  return `M ${n(a[0])} ${n(a[1])} L ${n(b[0])} ${n(b[1])} C ${n(b[0] + ux * k2)} ${n(b[1] + uy * k2)} ${n(c[0] + ux * k2)} ${n(c[1] + uy * k2)} ${n(c[0])} ${n(c[1])} L ${n(e[0])} ${n(e[1])} C ${n(e[0] - ux * k1)} ${n(e[1] - uy * k1)} ${n(a[0] - ux * k1)} ${n(a[1] - uy * k1)} ${n(a[0])} ${n(a[1])} Z`;
};
const band = (P: V, Q: V, w1: number, w2 = w1) => limb(P, Q, w1, w2, false, false);
const ell = (cx: number, cy: number, rx: number, ry: number) => `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
// lật ngang một path chỉ gồm lệnh tuyệt đối M/L/C/Q (các số đi theo cặp x y)
const mir = (d: string) => d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${-parseFloat(x)} ${y}`);
// dải bóng dọc theo một đoạn chi (phía dưới / phía trong thân)
const shadeStrip = (P: V, Q: V, w1: number, w2: number, side: number) => {
  const dx = Q[0] - P[0], dy = Q[1] - P[1], d = Math.max(0.01, Math.hypot(dx, dy));
  let nx = -dy / d, ny = dx / d;
  if (nx * side * 0.6 + ny < 0) { nx = -nx; ny = -ny; }
  return limb([P[0] + nx * w1 * 0.27, P[1] + ny * w1 * 0.27], [Q[0] + nx * w2 * 0.27, Q[1] + ny * w2 * 0.27], w1 * 0.4, w2 * 0.4);
};

// ───── biểu cảm
type Side = [number, number]; // [đầu trong, đầu ngoài] — lệch y của lông mày (âm = nhướn lên)
type Eye = 'open' | 'wide' | 'smiley' | 'arc' | 'half' | 'closed';
type MouthKey = 'neutral' | 'smile' | 'grin' | 'laugh' | 'frown' | 'cry' | 'grit' | 'o' | 'wavy' | 'side' | 'smirk' | 'sly' | 'worried';
type ExprDef = {
  brow: { L: Side; R: Side };
  eye: Eye;
  lid?: { kc: number; bias: number }; // mí trên: kc = độ cong (2 = mở hết), bias >0 cao phía ngoài (giận), <0 cao phía trong (buồn)
  iris?: { y?: number; r?: number };
  mouth: MouthKey;
  talk: 'up' | 'down' | 'flat' | 'square';
  blush?: number;
  extra?: ('tear' | 'tears' | 'sweat' | 'vein' | 'lines' | 'pale' | 'red')[];
  tilt?: number;
  motion?: 'laugh' | 'shake' | 'tremble';
};
const B = (i: number, o: number, i2 = i, o2 = o) => ({ L: [i, o] as Side, R: [i2, o2] as Side });
export const EXPRS: Record<string, ExprDef> = {
  'binh-thuong': { brow: B(0, 0), eye: 'open', mouth: 'neutral', talk: 'flat' },
  cuoi: { brow: B(-3, -2), eye: 'open', mouth: 'smile', talk: 'up', blush: 0.22 },
  vui: { brow: B(-7, -4), eye: 'smiley', mouth: 'grin', talk: 'up', blush: 0.34 },
  'cuoi-lon': { brow: B(-9, -5), eye: 'arc', mouth: 'laugh', talk: 'up', blush: 0.45, motion: 'laugh' },
  buon: { brow: B(-12, 6), eye: 'open', lid: { kc: 1.45, bias: -0.8 }, iris: { y: 3 }, mouth: 'frown', talk: 'down', tilt: 5 },
  khoc: { brow: B(-15, 7), eye: 'arc', mouth: 'cry', talk: 'down', blush: 0.3, extra: ['tears'], tilt: 4, motion: 'tremble' },
  gian: { brow: B(14, -7), eye: 'open', lid: { kc: 1.25, bias: 0.85 }, mouth: 'grit', talk: 'square', extra: ['vein', 'red'], motion: 'shake' },
  'ngac-nhien': { brow: B(-18, -15), eye: 'wide', iris: { r: 8.5 }, mouth: 'o', talk: 'flat', extra: ['lines'] },
  so: { brow: B(-15, -2), eye: 'wide', iris: { r: 7.5 }, mouth: 'wavy', talk: 'down', extra: ['sweat', 'pale'], motion: 'tremble' },
  'lo-lang': { brow: B(-11, 4), eye: 'open', lid: { kc: 1.75, bias: -0.5 }, mouth: 'worried', talk: 'down', extra: ['sweat'] },
  nghi: { brow: B(-11, -13, 3, 2), eye: 'open', iris: { y: -6 }, mouth: 'side', talk: 'flat', tilt: -4 },
  'nghi-ngo': { brow: B(7, 2, -10, -13), eye: 'half', lid: { kc: 0.95, bias: 0.2 }, mouth: 'side', talk: 'flat', tilt: 3 },
  'tu-tin': { brow: B(-2, -6), eye: 'half', lid: { kc: 1.3, bias: 0 }, mouth: 'smirk', talk: 'up', blush: 0.12 },
  'gian-xao': { brow: B(10, -8), eye: 'half', lid: { kc: 1.05, bias: 0.6 }, mouth: 'sly', talk: 'up' },
};
export const EXPR_LIST = Object.keys(EXPRS);
const EXPR_ALIAS: Record<string, string> = { smile: 'cuoi', happy: 'vui', surprised: 'ngac-nhien', think: 'nghi', sad: 'buon', neutral: 'binh-thuong', angry: 'gian' };

// ════════════════════════════ ĐẦU — hệ toạ độ riêng: gốc (0,0) giữa hai mắt, nửa bề ngang mặt = 100, đỉnh sọ −135, cằm +122 ════════════════════════════
const FACE_M = 'M -98 -20 C -100 -96 -60 -135 0 -135 C 60 -135 100 -96 98 -20 C 98 30 91 66 64 95 C 46 114 23 122 0 122 C -23 122 -46 114 -64 95 C -91 66 -98 30 -98 -20 Z';
const FACE_F = 'M -95 -22 C -97 -96 -58 -135 0 -135 C 58 -135 97 -96 95 -22 C 95 28 84 66 55 97 C 38 115 19 122 0 122 C -19 122 -38 115 -55 97 C -84 66 -95 28 -95 -22 Z';

// ───── tóc
type HairDef = { back?: string[]; front: string[]; hi?: string[]; lines?: string[]; tie?: V };
const LOCK = 'M -100 -14 C -114 60 -112 170 -98 262 C -86 276 -66 268 -62 250 C -74 170 -78 84 -82 6 Z';
const BOB_SIDE = 'M -103 -6 C -113 36 -114 80 -108 116 C -98 124 -86 122 -80 112 C -86 72 -86 30 -85 -22 Z';
const HOI_SIDE = 'M -101 10 C -110 -30 -106 -72 -89 -96 C -80 -72 -77 -40 -79 -2 Z';
const HAIR: Record<string, HairDef> = {
  ngan: {
    front: ['M -102 8 C -113 -62 -92 -151 2 -153 C 92 -153 115 -64 102 8 C 99 -20 94 -44 84 -64 C 62 -78 22 -72 -8 -97 C -28 -77 -60 -67 -86 -62 C -94 -42 -99 -18 -102 8 Z'],
    hi: ['M -34 -127 C 6 -144 62 -136 86 -94 C 54 -118 8 -124 -30 -115 Z'],
  },
  vuot: {
    front: ['M -101 6 C -111 -54 -105 -113 -63 -141 C -20 -172 76 -170 101 -112 C 113 -72 107 -30 101 6 C 98 -24 92 -48 82 -68 C 40 -97 -40 -99 -81 -70 C -92 -48 -98 -22 -101 6 Z'],
    lines: ['M -62 -92 C -44 -132 14 -156 74 -140', 'M -24 -96 C 0 -126 44 -140 88 -118'],
  },
  tia: {
    front: ['M -102 8 C -110 -50 -100 -98 -74 -124 L -82 -152 L -50 -138 L -36 -168 L -8 -143 L 16 -172 L 34 -143 L 68 -160 L 68 -128 C 98 -104 110 -52 102 8 C 99 -22 94 -44 86 -60 L 70 -86 L 56 -62 L 38 -90 L 22 -64 L 2 -92 L -16 -64 L -36 -90 L -52 -62 L -70 -84 L -86 -58 C -94 -40 -99 -18 -102 8 Z'],
    hi: ['M -8 -143 L 16 -160 L 32 -134 L 62 -146 C 80 -124 90 -104 92 -84 C 66 -112 28 -124 -10 -122 Z'],
  },
  xoan: {
    front: [[-94, -36, 24], [-90, -82, 28], [-60, -122, 32], [-16, -142, 34], [32, -140, 34], [72, -114, 30], [93, -74, 28], [97, -34, 22], [-42, -92, 26], [8, -100, 28], [52, -90, 24]].map(([x, y, r]) => ell(x, y, r, r)),
    lines: ['M -70 -130 Q -56 -146 -40 -136', 'M -10 -152 Q 8 -166 26 -152', 'M 54 -128 Q 70 -136 82 -120'],
  },
  hoi: { front: [HOI_SIDE, mir(HOI_SIDE)] },
  dai: {
    back: ['M -108 -20 C -118 -112 -60 -157 0 -157 C 60 -157 118 -112 108 -20 C 112 80 124 190 130 290 C 100 318 62 310 46 290 L 0 190 L -46 290 C -62 310 -100 318 -130 290 C -124 190 -112 80 -108 -20 Z'],
    front: ['M -104 12 C -115 -70 -88 -153 0 -155 C 88 -153 115 -70 104 12 C 100 -24 94 -52 82 -74 C 40 -80 -10 -98 -34 -122 C -44 -92 -68 -72 -88 -60 C -96 -40 -101 -16 -104 12 Z', LOCK, mir(LOCK)],
    hi: ['M -20 -134 C 24 -146 74 -128 90 -88 C 60 -112 22 -122 -16 -122 Z'],
  },
  bob: {
    back: ['M -110 -20 C -118 -114 -60 -157 0 -157 C 60 -157 118 -114 110 -20 L 116 108 C 96 126 70 122 58 108 L -58 108 C -70 122 -96 126 -116 108 Z'],
    front: ['M -104 20 C -115 -70 -88 -153 0 -155 C 88 -153 115 -70 104 20 C 100 -10 96 -36 90 -58 C 60 -48 30 -60 0 -55 C -30 -60 -60 -48 -90 -58 C -96 -36 -100 -10 -104 20 Z', BOB_SIDE, mir(BOB_SIDE)],
    hi: ['M -52 -130 C -10 -146 52 -140 82 -104 C 44 -122 -4 -126 -46 -118 Z'],
  },
  buoc: {
    back: ['M 62 -116 C 130 -128 164 -62 154 22 C 147 94 120 152 94 184 C 108 112 104 40 82 -22 Z'],
    tie: [82, -106],
    front: ['M -102 10 C -113 -66 -88 -151 0 -153 C 88 -151 113 -66 102 10 C 98 -30 86 -62 62 -86 C 30 -73 -14 -77 -40 -94 C -66 -76 -90 -40 -102 10 Z'],
    hi: ['M -30 -132 C 14 -146 66 -132 86 -94 C 56 -116 16 -122 -26 -120 Z'],
  },
  bui: {
    back: [ell(0, -160, 46, 42)],
    front: ['M -102 8 C -113 -68 -86 -151 0 -153 C 86 -151 113 -68 102 8 C 96 -40 74 -86 6 -98 L -6 -98 C -74 -86 -96 -40 -102 8 Z'],
    lines: ['M 0 -150 L 0 -100', 'M -22 -176 Q 0 -192 22 -174'],
  },
};
const Hair: React.FC<{ style: string; c: string; layer: 'back' | 'front' }> = ({ style, c, layer }) => {
  const h = HAIR[style] ?? HAIR.ngan;
  const ds = layer === 'back' ? h.back : h.front;
  if (!ds?.length) return null;
  return (
    <g>
      <Two r={(p) => ds.map((d, i) => sp(p, d, c, i))} />
      {layer === 'front' && h.hi?.map((d, i) => <path key={i} d={d} fill={light(c, 0.3)} opacity={0.5} />)}
      {layer === 'front' && h.lines?.map((d, i) => <path key={i} d={d} fill="none" stroke={light(c, 0.34)} strokeWidth={3.5} strokeLinecap="round" opacity={0.6} />)}
      {layer === 'back' && h.tie && <ellipse cx={h.tie[0]} cy={h.tie[1]} rx={15} ry={19} fill={SHIRT.red} stroke={ol(SHIRT.red)} strokeWidth={LW} />}
    </g>
  );
};

// ───── mặt
const Face: React.FC<{ e: ExprDef; mouth: number; blink: boolean; look: [number, number]; female: boolean; skin: string; brow: string; glasses?: boolean; uid: string; age?: string; beard?: boolean; frame: number }> = ({ e, mouth, blink, look, female, skin, brow, glasses, uid, age, beard, frame }) => {
  const sLine = mix(skin, '#7A3A26', 0.6); // nét trên da (mũi, nếp)
  const eyeEl = (cx: number, side: -1 | 1) => {
    const outer = side;
    const wide = e.eye === 'wide';
    const rx = wide ? 22 : 21, ry = wide ? 16.5 : female ? 13.5 : 11.5;
    const kind: Eye = blink && e.eye !== 'arc' ? 'closed' : e.eye;
    const lash = female ? <path d={`M ${cx + outer * (rx - 1)} -1 q ${outer * 8} -2 ${outer * 12} -11`} fill="none" stroke={EYELINE} strokeWidth={3.6} strokeLinecap="round" /> : null;
    if (kind === 'arc')
      return (
        <g>
          <path d={`M ${cx - 20} 6 Q ${cx} -17 ${cx + 20} 6`} fill="none" stroke={EYELINE} strokeWidth={6} strokeLinecap="round" />
          {female && <path d={`M ${cx + outer * 19} 4 l ${outer * 9} -6`} stroke={EYELINE} strokeWidth={3.4} strokeLinecap="round" />}
        </g>
      );
    if (kind === 'closed')
      return <path d={`M ${cx - 21} 1 Q ${cx} 10 ${cx + 21} 1`} fill="none" stroke={EYELINE} strokeWidth={5.5} strokeLinecap="round" />;
    const lid = e.lid ?? { kc: wide ? 2.25 : 2, bias: 0 };
    const kc = kind === 'half' ? Math.min(lid.kc, 1.3) : lid.kc;
    const ctrl: V = [cx + lid.bias * outer * rx * 0.75, -ry * kc];
    const Lp: V = [cx - rx, 2], Rp: V = [cx + rx, 2];
    const ir = e.iris?.r ?? 10.5;
    const almond = `M ${cx - outer * rx} 3 Q ${cx + outer * 2} ${-ry * 2.3} ${cx + outer * rx} -1 Q ${cx} ${ry * 1.7} ${cx - outer * rx} 3 Z`;
    const ix = cx + look[0] * 6.5, iy = 1 + (e.iris?.y ?? 0) + look[1] * 4;
    const clip = `${uid}e${side}`;
    return (
      <g>
        <clipPath id={clip}><path d={almond} /></clipPath>
        <g clipPath={`url(#${clip})`}>
          <path d={almond} fill="#FBF8F3" />
          <circle cx={ix} cy={iy} r={ir} fill="#4A2F1E" />
          <circle cx={ix} cy={iy} r={ir * 0.52} fill="#150D09" />
          <circle cx={ix + ir * 0.4} cy={iy - ir * 0.42} r={Math.max(2.6, ir * 0.3)} fill="#fff" />
          <circle cx={ix - ir * 0.42} cy={iy + ir * 0.38} r={1.6} fill="#fff" opacity={0.75} />
          <path d={`M ${cx - rx - 6} ${-ry - 44} L ${cx + rx + 6} ${-ry - 44} L ${Rp[0] + 6} ${Rp[1]} L ${Rp[0]} ${Rp[1]} Q ${ctrl[0]} ${ctrl[1]} ${Lp[0]} ${Lp[1]} L ${Lp[0] - 6} ${Lp[1]} Z`} fill={skin} />
          {kind === 'smiley' && <ellipse cx={cx} cy={ry * 1.3} rx={rx * 1.3} ry={ry * 0.9} fill={skin} />}
        </g>
        {/* nếp mí */}
        {kind !== 'smiley' && kc > 1.2 && <path d={`M ${Lp[0] + 4} ${-ry * 0.5 * kc - 3} Q ${ctrl[0]} ${ctrl[1] * 0.5 - ry * 0.9} ${Rp[0] - 3} ${-ry * 0.45 * kc - 3}`} fill="none" stroke={sLine} strokeWidth={2} strokeLinecap="round" opacity={0.45} />}
        <path d={`M ${Lp[0]} ${Lp[1]} Q ${ctrl[0]} ${ctrl[1]} ${Rp[0]} ${Rp[1]} l ${outer * 4} -2`} fill="none" stroke={EYELINE} strokeWidth={female ? 5.8 : 5} strokeLinecap="round" />
        {kind === 'smiley'
          ? <path d={`M ${cx - rx * 0.9} ${ry * 0.6} Q ${cx} 0 ${cx + rx * 0.9} ${ry * 0.6}`} fill="none" stroke={sLine} strokeWidth={3} strokeLinecap="round" />
          : <path d={`M ${cx - rx * 0.7} ${ry * 0.75} Q ${cx} ${ry * 1.15} ${cx + rx * 0.7} ${ry * 0.75}`} fill="none" stroke={sLine} strokeWidth={2} strokeLinecap="round" opacity={0.4} />}
        {lash}
      </g>
    );
  };

  const browEl = (cx: number, side: -1 | 1, d: Side) => {
    const inX = cx - side * 25, outX = cx + side * 29;
    const by = -37;
    const yi = by + d[0], yo = by + 5 + d[1];
    const mx = (inX + outX) / 2, my = Math.min(yi, yo) - 9;
    const t = female ? 6.5 : 10;
    return <path d={`M ${inX} ${yi - t / 2} Q ${mx} ${my - t / 2} ${outX} ${yo} Q ${mx} ${my + t / 2 + 1.5} ${inX} ${yi + t / 2} Q ${inX - side * 3.5} ${yi} ${inX} ${yi - t / 2} Z`} fill={brow} />;
  };

  // miệng
  const open = Math.max(0, Math.min(1, mouth));
  const my = 74;
  const lipEdge = female ? LIP : MOUTH;
  const openShape = (w: number, h: number, c: number, teethTop = true, teethBot = false) => {
    const d = `M ${-w} ${my + c} Q 0 ${my - 3 - c * 0.3} ${w} ${my + c} Q ${w * 0.7} ${my + c + h * 1.15} 0 ${my + c + h * 1.2} Q ${-w * 0.7} ${my + c + h * 1.15} ${-w} ${my + c} Z`;
    const id = `${uid}m`;
    return (
      <g>
        <clipPath id={id}><path d={d} /></clipPath>
        <path d={d} fill={MOUTH} />
        <g clipPath={`url(#${id})`}>
          {teethTop && h > 9 && <rect x={-w} y={my - 14} width={w * 2} height={14 + Math.min(10, h * 0.36)} fill="#fff" />}
          {teethBot && h > 9 && <rect x={-w} y={my + c + h * 1.2 - 9} width={w * 2} height={13} fill="#fff" />}
          {h > 15 && <ellipse cx={0} cy={my + c + h * 1.18} rx={w * 0.55} ry={h * 0.36} fill={TONGUE} />}
        </g>
        <path d={d} fill="none" stroke={lipEdge} strokeWidth={female ? 5.5 : 3.6} strokeLinejoin="round" />
      </g>
    );
  };
  // miệng khép: nam = một nét; nữ = môi son + nét giữa
  const line = (d: string, w = 4.6) => (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {female && <path d={d} stroke={LIP} strokeWidth={w + 3.6} />}
      <path d={d} stroke={female ? '#8E2F3A' : mix(skin, '#5A1E1E', 0.82)} strokeWidth={female ? 2.6 : w} />
    </g>
  );
  let m: React.ReactNode;
  if (open > 0.06) {
    const h = 7 + open * 33;
    if (e.talk === 'up') m = openShape(27 + open * 3, h, -6);
    else if (e.talk === 'down') m = openShape(20, h * 0.8, 4);
    else if (e.talk === 'square') m = openShape(27, h * 0.85, 2, true, true);
    else m = openShape(22, h, 0);
  } else {
    switch (e.mouth) {
      case 'smile': m = line(`M -26 ${my - 6} Q 0 ${my + 19} 26 ${my - 6}`); break;
      case 'grin': m = openShape(31, 21, -8); break;
      case 'laugh': m = openShape(36, 33 + Math.abs(Math.sin(frame / 2.6)) * 6, -9); break;
      case 'frown': m = line(`M -20 ${my + 12} Q 0 ${my - 4} 20 ${my + 12}`); break;
      case 'cry': m = openShape(24, 15 + Math.abs(Math.sin(frame / 3)) * 4, 8, false); break;
      case 'grit':
        m = (
          <g>
            <path d={`M -26 ${my - 3} Q 0 ${my - 10} 26 ${my - 3} L 22 ${my + 17} Q 0 ${my + 23} -22 ${my + 17} Z`} fill="#fff" stroke={lipEdge} strokeWidth={female ? 5 : 3.6} strokeLinejoin="round" />
            <path d={`M -23 ${my + 7} Q 0 ${my + 5} 23 ${my + 7} M -11 ${my - 5} L -10 ${my + 19} M 0 ${my - 6} L 0 ${my + 20} M 11 ${my - 5} L 10 ${my + 19}`} fill="none" stroke="#B9A9A4" strokeWidth={2} />
          </g>
        );
        break;
      case 'o': m = <ellipse cx={0} cy={my + 5} rx={13} ry={17} fill={MOUTH} stroke={lipEdge} strokeWidth={female ? 5.5 : 3.6} />; break;
      case 'wavy': m = line(`M -24 ${my + 5} Q -18 ${my - 3} -12 ${my + 5} Q -6 ${my + 13} 0 ${my + 5} Q 6 ${my - 3} 12 ${my + 5} Q 18 ${my + 13} 24 ${my + 5}`, 4.2); break;
      case 'side': m = line(`M -16 ${my + 5} Q 4 ${my + 8} 20 ${my - 3}`); break;
      case 'smirk': m = line(`M -22 ${my + 1} Q 0 ${my + 10} 25 ${my - 8}`); break;
      case 'sly': m = openShape(27, 14, -7); break;
      case 'worried': m = line(`M -18 ${my + 5} Q -9 ${my - 3} 0 ${my + 3} Q 9 ${my + 9} 18 ${my + 1}`, 4.2); break;
      default: m = line(`M -19 ${my + 2} Q 0 ${my + 6} 19 ${my + 1}`);
    }
  }

  const ex = e.extra ?? [];
  const tearY = (frame % 36) / 36;
  const tear = (x: number, t: number) => <path d={`M ${x} ${18 + t * 56} q -8 13 0 18 q 8 -5 0 -18 Z`} fill="#8FD0FF" stroke="#4C9BD6" strokeWidth={2} opacity={1 - t * 0.6} />;
  return (
    <g>
      {(e.blush ?? 0) > 0 && (
        <g fill="#F2787C" opacity={e.blush}>
          <ellipse cx={-62} cy={44} rx={22} ry={11} />
          <ellipse cx={62} cy={44} rx={22} ry={11} />
        </g>
      )}
      {ex.includes('red') && <g fill="#FF4B3E" opacity={0.26}><ellipse cx={-62} cy={42} rx={26} ry={13} /><ellipse cx={62} cy={42} rx={26} ry={13} /></g>}
      {browEl(-43, -1, e.brow.L)}
      {browEl(43, 1, e.brow.R)}
      {eyeEl(-43, -1)}
      {eyeEl(43, 1)}
      {/* mũi */}
      <path d={female ? 'M -10 45 Q -5 54 3 52 Q 8 52 10 46' : 'M -5 24 Q -11 40 -13 45 Q -10 54 2 53 Q 9 53 12 46'} fill="none" stroke={sLine} strokeWidth={female ? 3.4 : 3.8} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      {age === 'trung-nien' && <g fill="none" stroke={sLine} strokeWidth={2.6} opacity={0.5} strokeLinecap="round"><path d="M -36 44 Q -44 62 -36 82" /><path d="M 36 44 Q 44 62 36 82" /><path d="M -24 -74 Q 0 -79 24 -74" /></g>}
      {beard && <path d={`M -34 ${my - 14} Q 0 ${my - 28} 34 ${my - 14} Q 20 ${my - 18} 0 ${my - 16} Q -20 ${my - 18} -34 ${my - 14} Z`} fill={brow} />}
      {m}
      {glasses && (
        <g fill="none" stroke="#2A2D34" strokeWidth={4.5}>
          <rect x={-78} y={-27} width={66} height={50} rx={16} fill="#ffffff" fillOpacity={0.14} />
          <rect x={12} y={-27} width={66} height={50} rx={16} fill="#ffffff" fillOpacity={0.14} />
          <path d="M -12 -6 Q 0 -13 12 -6 M -78 -10 L -99 -15 M 78 -10 L 99 -15" />
        </g>
      )}
      {(ex.includes('tear') || ex.includes('tears')) && <g>{tear(-56, tearY)}{ex.includes('tears') && tear(56, (tearY + 0.5) % 1)}</g>}
      {ex.includes('sweat') && <path d="M 104 -84 q -12 20 0 28 q 12 -8 0 -28 Z" fill="#A6DDFF" stroke="#4C9BD6" strokeWidth={2.4} />}
      {ex.includes('pale') && <g stroke="#6E7FD8" strokeWidth={3.6} strokeLinecap="round" opacity={0.65}>{[-40, -20, 0, 20, 40].map((x) => <path key={x} d={`M ${x} -88 L ${x} -60`} />)}</g>}
      {ex.includes('vein') && <g stroke="#E2342B" strokeWidth={5} strokeLinecap="round" fill="none"><path d="M 70 -118 q 9 7 0 16" /><path d="M 84 -124 q -7 9 5 14" /><path d="M 90 -104 q -9 5 -16 -2" /></g>}
      {ex.includes('lines') && <g stroke="#3A3F4B" strokeWidth={5.5} strokeLinecap="round"><path d="M -84 -176 L -98 -200" /><path d="M 0 -190 L 0 -218" /><path d="M 84 -176 L 98 -200" /></g>}
    </g>
  );
};

// ════════════════════════════ THÂN ════════════════════════════
type Hand = 'relax' | 'fist' | 'open' | 'point' | 'thumb' | 'phone' | 'palm';
// t = vị trí CỔ TAY so với vai cùng bên, tính theo chiều dài tay: [ra ngoài thân (+) / vào trong (−), xuống (+) / lên (−)]
// e (tuỳ chọn) = vị trí KHUỶU cùng hệ — dùng cho tư thế tay đưa ra trước (hình chiếu ngắn lại); không có e thì tự tính theo chiều dài xương.
type ArmDef = { t: V; e?: V; bend?: 'out' | 'down'; hand?: Hand }; // khuỷu mặc định chĩa ra ngoài thân; 'down' = khuỷu thấp
type Legs = 'stand' | 'wide' | 'walk';
type PoseDef = { L: ArmDef; R: ArmDef; expr: string; legs?: Legs; front?: 'L' | 'R'; look?: [number, number]; shrug?: number; lean?: number; head?: number };
const HANG: ArmDef = { t: [0.05, 0.993], hand: 'relax' };
// Nguyên tắc: khuỷu tay luôn ở gần thân (không chĩa ngang ra ngoài), cử chỉ nằm ở cẳng tay + bàn tay; không giơ hai tay quá đầu.
const LOW: V = [0.09, 0.5]; // khuỷu buông cạnh sườn
export const POSES: Record<string, PoseDef> = {
  dung: { L: HANG, R: HANG, expr: 'cuoi' },
  chao: { L: HANG, R: { e: [0.2, 0.46], t: [0.33, 0.03], hand: 'open' }, expr: 'vui' },
  chi: { L: HANG, R: { e: [0.3, 0.4], t: [0.74, 0.22], hand: 'point' }, expr: 'cuoi', head: 3 },
  'tay-mo': { L: HANG, R: { e: LOW, t: [0.4, 0.36], hand: 'palm' }, expr: 'cuoi' },
  'giai-thich': { L: { e: LOW, t: [0.3, 0.4], hand: 'palm' }, R: { e: LOW, t: [0.38, 0.31], hand: 'palm' }, expr: 'binh-thuong' },
  nghi: { L: { e: [0.03, 0.5], t: [-0.38, 0.5], hand: 'fist' }, R: { e: [-0.06, 0.4], t: [-0.25, -0.02], hand: 'fist' }, expr: 'nghi', front: 'R', head: -4 },
  vui: { L: HANG, R: { e: [0.16, 0.45], t: [0.27, 0.02], hand: 'fist' }, expr: 'vui', shrug: 4, head: -3 },
  'ngac-nhien': { L: { e: LOW, t: [0.3, 0.3], hand: 'open' }, R: { e: [0.05, 0.5], t: [-0.2, 0.2], hand: 'open' }, expr: 'ngac-nhien', lean: -1.5, shrug: 6, front: 'R' },
  'khoanh-tay': { L: { e: [-0.02, 0.47], t: [-0.47, 0.4], hand: 'fist' }, R: { e: [-0.02, 0.47], t: [-0.47, 0.46], hand: 'fist' }, expr: 'tu-tin', front: 'R' },
  buon: { L: { t: [0.02, 0.996], hand: 'relax' }, R: { t: [0.02, 0.996], hand: 'relax' }, expr: 'buon', shrug: -7, head: 7 },
  'dien-thoai': { L: HANG, R: { e: [0.05, 0.49], t: [-0.14, 0.2], hand: 'phone' }, expr: 'binh-thuong', look: [0, 1], head: 8, front: 'R' },
  'nghe-may': { L: HANG, R: { e: [0.13, 0.36], t: [-0.06, -0.13], hand: 'phone' }, expr: 'binh-thuong', front: 'R', head: -4, shrug: 4 },
  'om-dau': { L: HANG, R: { e: [0.16, 0.32], t: [0.04, -0.23], hand: 'open' }, expr: 'so', shrug: 7, head: -6, front: 'R' },
  'chong-nanh': { L: { e: [0.27, 0.43], t: [0.03, 0.74], hand: 'fist' }, R: { e: [0.27, 0.43], t: [0.03, 0.74], hand: 'fist' }, expr: 'gian' },
  like: { L: HANG, R: { e: [0.1, 0.48], t: [0.2, 0.1], hand: 'thumb' }, expr: 'vui' },
  'nhun-vai': { L: { e: LOW, t: [0.4, 0.4], hand: 'palm' }, R: { e: LOW, t: [0.4, 0.4], hand: 'palm' }, expr: 'lo-lang', shrug: 13, head: 5 },
  'di-bo': { L: HANG, R: HANG, expr: 'binh-thuong', legs: 'walk' },
  // ngồi bàn: hai tay đặt lên mặt bàn / bàn phím (cảnh story)
  'go-phim': { L: { e: [0.06, 0.47], t: [-0.16, 0.66], hand: 'relax' }, R: { e: [0.06, 0.47], t: [-0.16, 0.66], hand: 'relax' }, expr: 'binh-thuong', look: [0, 0.6], head: 3 },
  'dat-tay': { L: { e: [0.07, 0.48], t: [-0.3, 0.68], hand: 'relax' }, R: { e: [0.07, 0.48], t: [-0.3, 0.74], hand: 'relax' }, expr: 'binh-thuong', front: 'R' },
};
export const POSE_LIST = Object.keys(POSES);
// Khung máy: vùng khung (y) cần thấy — scene dùng để phóng/cắt
export const FRAMING = { 'toan-than': [-14, 1200], 'trung-canh': [-14, 800], 'can-canh': [-14, 470] } as const;
export type Framing = keyof typeof FRAMING;
// Mốc đầu trong khung (cho bóng thoại, bố cục)
export const HEAD = { top: -8, bottom: 208, half: 170 };

type Body = { sh: number; shY: number; UP: number; FO: number; wU: number; wE: number; wW: number; hip: number; wT: number; wK: number; wHem: number; wAnk: number; ankX: number; neck: number; hand: number; hk: number; hcy: number };
const bodyOf = (f: boolean): Body =>
  f
    ? { sh: 110, shY: 289, UP: 150, FO: 132, wU: 58, wE: 49, wW: 36, hip: 57, wT: 120, wK: 88, wHem: 66, wAnk: 44, ankX: 50, neck: 26, hand: 1.08, hk: 0.77, hcy: 110 }
    : { sh: 126, shY: 292, UP: 158, FO: 138, wU: 68, wE: 57, wW: 42, hip: 60, wT: 124, wK: 94, wHem: 80, wAnk: 44, ankX: 60, neck: 30, hand: 1.25, hk: 0.79, hcy: 108 };
const HIP_Y = 640, ANK_Y = 1120, TH = 246, SHN = 234;

// giải vị trí khuỷu (hệ chuẩn hoá: vai = gốc, x+ = ra ngoài thân, y+ = xuống)
const solveArm = (d: ArmDef, b: Body): ArmDef => {
  if (d.e) return d;
  const R = b.UP + b.FO;
  const T: V = [d.t[0] * R, d.t[1] * R];
  const Ea = ik([0, 0], T, b.UP, b.FO, 1), Eb = ik([0, 0], T, b.UP, b.FO, -1);
  const E = d.bend === 'down' ? (Ea[1] > Eb[1] ? Ea : Eb) : Ea[0] > Eb[0] ? Ea : Eb;
  const e: V = [E[0] / R, E[1] / R];
  // cổ tay theo đúng chiều dài cẳng tay (khi mục tiêu ngoài tầm với)
  const dx = d.t[0] - e[0], dy = d.t[1] - e[1], l = Math.max(0.001, Math.hypot(dx, dy)), k = b.FO / R / l;
  return { ...d, e, t: [e[0] + dx * k, e[1] + dy * k] };
};

// ───── trang phục
type Outfit = { kind: string; top: string; topS: string; sleeve: 'short' | 'long'; bottom: string; bottomKind: 'quan' | 'vay'; shoe: string; hemY: number; hemW: number; tucked: boolean };
const outfitOf = (spec: CharacterSpec, f: boolean): Outfit => {
  const k = spec.kind ?? 'misa';
  const def: Record<string, string> = { misa: SHIRT.yellow, 'so-mi': '#EAF1FA', vest: '#2C3346', hoodie: '#3B404C', 'ao-thun': '#4C8BF5', cardigan: '#C9A27E' };
  const top = k === 'misa' ? SHIRT.yellow : spec.outfitColor ?? def[k] ?? '#4C8BF5';
  const vay = spec.bottom === 'vay';
  const bottom = spec.bottomColor ?? (k === 'hoodie' ? '#46689A' : k === 'vest' ? shade(top, 0.06) : vay ? '#2E3445' : '#2F3B57');
  const hem: Record<string, [number, number]> = { misa: [640, f ? 122 : 128], 'ao-thun': [640, f ? 122 : 128], hoodie: [650, f ? 126 : 133], 'so-mi': [602, f ? 110 : 124], vest: [690, f ? 127 : 134], cardigan: [684, f ? 128 : 132] };
  const [hemY, hemW] = hem[k] ?? hem.misa;
  return { kind: k, top, topS: k === 'misa' ? SHIRT.yellowShade : shade(top, 0.14), sleeve: k === 'ao-thun' || k === 'misa' ? 'short' : 'long', bottom, bottomKind: vay ? 'vay' : 'quan', shoe: k === 'hoodie' ? '#F1F3F7' : f ? '#3A2A2A' : '#26282E', hemY, hemW, tucked: k === 'so-mi' };
};

// ───── bàn tay (hệ toạ độ cẳng tay: gốc ở cổ tay, +y hướng ra đầu ngón; tx = ±1 phía đặt ngón cái)
const handShapes = (kind: Hand, tx: number): { d: string[]; lines?: string } => {
  const finger = (x: number, y0: number, len: number, rot: number, w = 11.5) => limb([x, y0], [x + Math.sin(rad(rot)) * len, y0 + Math.cos(rad(rot)) * len], w, w * 0.84);
  const palm = 'M -15 -8 C -23 10 -25 30 -22 48 L 22 48 C 25 30 23 10 15 -8 Z';
  const fist = 'M -16 -8 C -24 8 -27 30 -23 45 C -19 57 -9 61 2 61 C 14 61 22 55 24 43 C 27 28 24 8 16 -8 Z';
  const thumbIn = limb([tx * 19, 12], [tx * 9, 40], 14, 12);
  if (kind === 'open') return { d: [finger(-16, 42, 36, -14), finger(-5.5, 45, 45, -4.5), finger(5.5, 45, 43, 4.5), finger(16, 42, 33, 14), palm, limb([tx * 17, 14], [tx * 46, 34], 14, 11)] };
  if (kind === 'palm') return { d: [finger(-15.5, 42, 38, -5), finger(-5.2, 44, 46, -1.5), finger(5.2, 44, 44, 1.5), finger(15.5, 42, 35, 5), palm, limb([tx * 17, 14], [tx * 42, 40], 14, 11)], lines: 'M -12 20 Q 0 32 12 20' };
  if (kind === 'point') return { d: [finger(tx * 11, 40, 56, 0, 12.5), fist, thumbIn], lines: `M ${-tx * 2} 44 L ${-tx * 2} 60 M ${-tx * 12} 42 L ${-tx * 12} 58` };
  // giơ ngón cái: nắm tay nhìn nghiêng (các ngón gập nằm ngang) + ngón cái to, ngắn, dựng ở mép trong
  if (kind === 'thumb') return { d: [limb([tx * 15, 40], [tx * 19, 92], 25, 21), 'M -19 -8 C -26 6 -27 30 -24 46 C -21 58 -10 62 2 62 C 14 62 23 56 25 44 C 28 28 25 8 19 -8 Z'], lines: 'M -4 12 L 20 12 M -6 27 L 21 27 M -5 42 L 20 42' };
  if (kind === 'fist' || kind === 'phone') return { d: kind === 'fist' ? [fist, thumbIn] : [fist], lines: 'M -10 44 L -10 60 M 0 46 L 0 61 M 10 44 L 10 60' };
  // relax: bàn tay buông, các ngón khép hơi cong
  return { d: ['M -14 -8 C -21 12 -23 34 -21 52 C -19 76 -10 97 2 98 C 14 98 21 78 22 54 C 23 34 21 12 14 -8 Z', limb([tx * 17, 20], [tx * 22, 60], 14, 11)], lines: 'M -8 60 Q -7 80 -3 92 M 3 60 Q 5 80 8 90' };
};
const HandG: React.FC<{ pass: Pass; kind: Hand; skin: string; dir: number; tx: number; k: number }> = ({ pass, kind, skin, dir, tx, k }) => {
  const hs = handShapes(kind, tx);
  return (
    <g transform={`scale(${k})`}>
      {kind === 'phone' && (
        <g transform={`rotate(${-dir} 0 26)`}>
          {sp(pass, 'M -20 -46 L 20 -46 Q 26 -46 26 -40 L 26 44 Q 26 50 20 50 L -20 50 Q -26 50 -26 44 L -26 -40 Q -26 -46 -20 -46 Z', '#20232B')}
          {pass === 'f' && <><rect x={-21} y={-39} width={42} height={80} rx={4} fill="#5CC0F8" /><rect x={-21} y={-39} width={42} height={16} rx={4} fill="#B5E4FF" /><rect x={-15} y={-12} width={30} height={5} rx={2.5} fill="#fff" opacity={0.8} /><rect x={-15} y={0} width={22} height={5} rx={2.5} fill="#fff" opacity={0.6} /></>}
        </g>
      )}
      {hs.d.map((d, i) => sp(pass, d, skin, i))}
      {pass === 'f' && hs.lines && <path d={hs.lines} fill="none" stroke={mix(skin, '#7A3A26', 0.45)} strokeWidth={2.2} strokeLinecap="round" opacity={0.7} />}
    </g>
  );
};

const Arm: React.FC<{ S: V; def: ArmDef; side: 1 | -1; skin: string; o: Outfit; b: Body; wave: number; gesture: number }> = ({ S, def, side, skin, o, b, wave, gesture }) => {
  const R = b.UP + b.FO;
  const E: V = [S[0] - side * def.e![0] * R, S[1] + def.e![1] * R];
  const T: V = [S[0] - side * def.t[0] * R, S[1] + def.t[1] * R];
  const fo = Math.hypot(T[0] - E[0], T[1] - E[1]);
  const a2 = ang(E, T) + wave + gesture; // cử chỉ khi nói: cẳng tay lắc quanh khuỷu
  const W: V = [E[0] - Math.sin(rad(a2)) * fo, E[1] + Math.cos(rad(a2)) * fo];
  const tx = Math.cos(rad(a2)) * side * 0.6 - Math.sin(rad(a2)) >= 0 ? 1 : -1; // ngón cái hướng vào trong thân / lên trên
  const long = o.sleeve === 'long';
  const pad = long ? (o.kind === 'hoodie' ? 10 : o.kind === 'vest' ? 8 : 6) : 0;
  const wU = b.wU + pad, wE = b.wE + pad, wW = b.wW + pad * (o.kind === 'hoodie' ? 1.1 : 0.8);
  const armC = long ? o.top : skin;
  const cuff0 = o.kind === 'vest' ? 0.92 : 0.86;
  const cuffC = o.kind === 'vest' ? '#F4F6FA' : o.kind === 'so-mi' ? light(o.top, 0.45) : o.kind === 'hoodie' ? o.topS : shade(o.top, 0.1);
  const mid = lerpV(S, E, 0.5);
  const sW = b.wU + 10;
  return (
    <Two
      r={(p) => (
        <>
          {sp(p, limb(E, long ? lerpV(E, W, 1.0) : W, wE, wW), armC)}
          <g transform={`translate(${W[0].toFixed(1)} ${W[1].toFixed(1)}) rotate(${a2.toFixed(1)})`}>
            <HandG pass={p} kind={def.hand ?? 'relax'} skin={skin} dir={a2} tx={tx} k={b.hand} />
          </g>
          {long && sp(p, band(lerpV(E, W, cuff0), lerpV(E, W, 1.02), wW + 5, wW + 4), cuffC)}
          {sp(p, limb(S, E, wU, wE), armC)}
          {!long && sp(p, limb(S, mid, sW, sW - 5, true, false), o.top)}
          {!long && o.kind === 'misa' && sp(p, band(lerpV(S, E, 0.405), mid, sW - 4, sW - 5), SHIRT.dark)}
          {p === 'f' && (
            <>
              <path d={shadeStrip(E, W, wE, wW, side)} fill={shade(armC, 0.1)} opacity={0.75} />
              <path d={shadeStrip(S, E, wU, wE, side)} fill={shade(armC, 0.1)} opacity={0.75} />
              {!long && <path d={limb(S, mid, sW, sW - 5, true, false)} fill={o.top} />}
              {!long && o.kind === 'misa' && <path d={band(lerpV(S, E, 0.405), mid, sW - 4, sW - 5)} fill={SHIRT.dark} />}
              {!long && o.kind === 'misa' && <path d={band(lerpV(S, E, 0.438), lerpV(S, E, 0.458), sW - 4.4, sW - 4.6)} fill={SHIRT.red} />}
              {!long && o.kind !== 'misa' && <path d={band(lerpV(S, E, 0.455), mid, sW - 4.6, sW - 5)} fill={o.topS} />}
              {long && <path d={band(lerpV(E, W, cuff0), lerpV(E, W, 1.02), wW + 5, wW + 4)} fill={cuffC} />}
              {long && o.kind === 'hoodie' && [0.9, 0.94, 0.98].map((t) => <path key={t} d={band(lerpV(E, W, t), lerpV(E, W, t + 0.008), wW + 4)} fill={shade(o.top, 0.3)} />)}
              {long && o.kind === 'so-mi' && <circle cx={lerpV(E, W, 0.94)[0]} cy={lerpV(E, W, 0.94)[1]} r={2.6} fill={shade(o.top, 0.3)} />}
            </>
          )}
        </>
      )}
    />
  );
};

// giày: A = mắt cá, o = hướng mũi giày (−1 trái, +1 phải)
const shoeD = (x: number, y: number, o: number, w: number) => {
  const h = w / 2;
  return `M ${x - o * h} ${y - 12} L ${x + o * h} ${y - 12} C ${x + o * (h + 4)} ${y + 6} ${x + o * (h + 30)} ${y + 12} ${x + o * (h + 36)} ${y + 28} Q ${x + o * (h + 41)} ${y + 44} ${x + o * (h + 26)} ${y + 44} L ${x - o * (h - 2)} ${y + 44} Q ${x - o * (h + 7)} ${y + 44} ${x - o * (h + 4)} ${y + 28} Z`;
};
const soleD = (x: number, y: number, o: number, w: number) => {
  const h = w / 2;
  return `M ${x - o * (h + 5)} ${y + 35} L ${x + o * (h + 39)} ${y + 35} Q ${x + o * (h + 41)} ${y + 44} ${x + o * (h + 26)} ${y + 44} L ${x - o * (h - 2)} ${y + 44} Q ${x - o * (h + 7)} ${y + 44} ${x - o * (h + 5)} ${y + 35} Z`;
};

// thân áo đối xứng: khai nửa trái đi từ cổ xuống gấu, nửa phải tự lật
const symPath = (top: V, segs: [V, V, V][]) => {
  const m = (p: V) => `${600 - p[0]} ${p[1]}`, n = (p: V) => `${p[0]} ${p[1]}`;
  let d = `M ${n(top)}`;
  for (const s of segs) d += ` C ${n(s[0])} ${n(s[1])} ${n(s[2])}`;
  d += ` L ${m(segs[segs.length - 1][2])}`;
  for (let i = segs.length - 1; i >= 0; i--) d += ` C ${m(segs[i][1])} ${m(segs[i][0])} ${m(i ? segs[i - 1][2] : top)}`;
  return d + ' Z';
};
const torsoD = (f: boolean, hemY: number, hw: number, belly = 0) =>
  f
    ? symPath([278, 232], [[[258, 234], [228, 240], [202, 248]], [[176, 252], [160, 266], [160, 288]], [[160, 312], [174, 336], [182, 360]], [[188, 394], [200, 432], [200, 470]], [[200, 514], [300 - hw - 4, hemY - 70], [300 - hw, hemY]]])
    : symPath([272, 232], [[[248, 234], [212, 240], [182, 250]], [[154, 255], [138, 270], [138, 294]], [[138, 322], [150, 352], [158, 386]], [[164, 422], [168 - belly, 454], [170 - belly, 488]], [[172 - belly, 534], [300 - hw - 2, hemY - 56], [300 - hw, hemY]]]);

const Torso: React.FC<{ o: Outfit; f: boolean; skin: string; logo: boolean; flip: boolean; uid: string; belly: number }> = ({ o, f, skin, logo, flip, uid, belly }) => {
  const body = torsoD(f, o.hemY, o.hemW, belly);
  const crease = shade(o.top, 0.24);
  const lineP = { fill: 'none', stroke: ol(o.top), strokeWidth: LW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const logoW = f ? 62 : 74, logoX = f ? 322 : 330, logoY = f ? 322 : 326;
  const logoEl = logo && (
    <g transform={flip ? `translate(${logoX + logoW} ${logoY}) scale(-1 1)` : `translate(${logoX} ${logoY})`}>
      <MisaLogo width={logoW} reg={false} />
    </g>
  );
  const wing = (d: string, fill: string) => <Two r={(p) => <>{sp(p, d, fill, 'a')}{sp(p, mir300(d), fill, 'b')}</>} />;
  let detail: React.ReactNode = null;
  if (o.kind === 'misa')
    detail = (
      <g>
        <path d="M 274 230 L 300 288 L 326 230 Z" fill={skin} />
        <path d="M 274 230 L 300 288 L 326 230 L 322 244 L 300 290 L 278 244 Z" fill={shade(skin, 0.16)} opacity={0.6} />
        <Two r={(p) => sp(p, 'M 291 282 L 309 282 L 309 368 Q 309 372 305 372 L 295 372 Q 291 372 291 368 Z', SHIRT.dark)} />
        <circle cx={300} cy={310} r={3.2} fill={SHIRT.button} />
        <circle cx={300} cy={342} r={3.2} fill={SHIRT.button} />
        {wing('M 271 224 L 239 247 L 261 308 L 300 285 L 279 234 Z', SHIRT.dark)}
        <path d="M 246 252 L 265 301" stroke={SHIRT.red} strokeWidth={3.6} strokeLinecap="round" />
        <path d="M 354 252 L 335 301" stroke={SHIRT.red} strokeWidth={3.6} strokeLinecap="round" />
        {logoEl}
        <path d={`M ${300 - o.hemW + 4} ${o.hemY - 9} L ${300 + o.hemW - 4} ${o.hemY - 9}`} stroke={crease} strokeWidth={2} opacity={0.5} />
      </g>
    );
  else if (o.kind === 'so-mi')
    detail = (
      <g>
        <path d="M 278 230 L 300 270 L 322 230 Z" fill={skin} />
        <path d={`M 300 270 L 300 ${o.hemY}`} stroke={crease} strokeWidth={2.4} opacity={0.8} />
        {[310, 362, 414, 466, 518, 570].map((y) => <circle key={y} cx={306} cy={y} r={3} fill={shade(o.top, 0.3)} />)}
        {wing('M 272 224 L 247 241 L 266 288 L 300 268 L 280 232 Z', light(o.top, 0.5))}
        <path d="M 336 330 L 384 327 L 385 366 Q 361 380 337 370 Z" {...lineP} stroke={crease} strokeWidth={2.2} />
      </g>
    );
  else if (o.kind === 'vest')
    detail = (
      <g>
        <path d="M 266 228 L 300 440 L 334 228 Z" fill="#F4F6FA" />
        <Two r={(p) => sp(p, 'M 291 262 L 309 262 L 306 280 L 315 396 L 300 418 L 285 396 L 294 280 Z', '#B5262F')} />
        <path d="M 293 279 L 307 279" stroke={shade('#B5262F', 0.3)} strokeWidth={2.2} />
        {wing('M 274 224 L 254 238 L 270 276 L 300 262 L 282 232 Z', '#FFFFFF')}
        {wing(`M 268 226 L 240 248 L 258 322 L 245 334 L 300 452 L 300 420 Z`, shade(o.top, 0.1))}
        <path d={`M 300 452 Q 304 550 298 ${o.hemY}`} {...lineP} />
        {[490, 566].map((y) => <circle key={y} cx={308} cy={y} r={5.5} fill={shade(o.top, 0.4)} />)}
        <path d="M 344 344 L 380 338 L 381 350 L 345 356 Z" fill="#F4F6FA" />
        <path d={f ? 'M 210 606 L 250 602 M 350 602 L 390 606' : 'M 200 606 L 244 602 M 356 602 L 400 606'} stroke={crease} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    );
  else if (o.kind === 'hoodie')
    detail = (
      <g>
        <path d="M 274 230 Q 300 262 326 230 Z" fill={skin} />
        <Two r={(p) => sp(p, 'M 258 232 Q 300 300 342 232 Q 338 282 300 292 Q 262 282 258 232 Z', o.topS)} />
        <path d="M 287 288 L 283 366 M 313 288 L 317 366" stroke="#EEF0F4" strokeWidth={4} strokeLinecap="round" />
        <path d="M 283 366 L 283 378 M 317 366 L 317 378" stroke="#C9CCD3" strokeWidth={5.5} strokeLinecap="round" />
        <path d={f ? 'M 232 520 L 368 520 L 386 600 L 214 600 Z' : 'M 222 516 L 378 516 L 400 602 L 200 602 Z'} {...lineP} stroke={crease} strokeWidth={2.4} />
        <path d={`M ${300 - o.hemW + 1} ${o.hemY - 22} L ${300 + o.hemW - 1} ${o.hemY - 22} L ${300 + o.hemW} ${o.hemY} L ${300 - o.hemW} ${o.hemY} Z`} fill={o.topS} />
        {Array.from({ length: 13 }, (_, i) => <path key={i} d={`M ${300 - o.hemW + 12 + i * ((o.hemW * 2 - 24) / 12)} ${o.hemY - 19} l 0 16`} stroke={shade(o.top, 0.34)} strokeWidth={1.8} opacity={0.7} />)}
      </g>
    );
  else if (o.kind === 'cardigan')
    detail = (
      <g>
        <path d={`M 264 228 C 256 300 262 480 282 ${o.hemY} L 318 ${o.hemY} C 338 480 344 300 336 228 Q 300 250 264 228 Z`} fill="#F7F3EC" />
        <path d="M 272 230 Q 300 282 328 230 Z" fill={skin} />
        <path d="M 272 230 Q 300 282 328 230" fill="none" stroke={shade('#F7F3EC', 0.22)} strokeWidth={3} />
        <path d={`M 264 228 C 256 300 262 480 282 ${o.hemY} M 336 228 C 344 300 338 480 318 ${o.hemY}`} {...lineP} />
        {[450, 530, 610].map((y) => <circle key={y} cx={250 + (y - 450) * 0.12} cy={y} r={4.6} fill={shade(o.top, 0.4)} />)}
      </g>
    );
  else
    detail = (
      <g>
        <path d="M 270 230 Q 300 270 330 230 Z" fill={skin} />
        <path d="M 268 229 Q 300 274 332 229" fill="none" stroke={shade(o.top, 0.2)} strokeWidth={6.5} strokeLinecap="round" />
        <path d={`M ${300 - o.hemW + 4} ${o.hemY - 9} L ${300 + o.hemW - 4} ${o.hemY - 9}`} stroke={crease} strokeWidth={2} opacity={0.5} />
      </g>
    );
  return (
    <g>
      <Two r={(p) => sp(p, body, o.top)} />
      <clipPath id={`${uid}t`}><path d={body} /></clipPath>
      <g clipPath={`url(#${uid}t)`}>
        <path d={body} fill={o.topS} opacity={0.75} />
        <path d={body} fill={o.top} transform="translate(-24 0)" />
      </g>
      {f && <path d="M 226 366 Q 256 404 292 382 M 308 382 Q 344 404 374 366" fill="none" stroke={crease} strokeWidth={2.4} strokeLinecap="round" opacity={0.5} />}
      {!f && o.kind !== 'vest' && <path d="M 214 566 Q 248 580 276 572 M 326 574 Q 352 580 386 566" fill="none" stroke={crease} strokeWidth={2.2} strokeLinecap="round" opacity={0.45} />}
      {detail}
    </g>
  );
};
// lật ngang quanh trục x = 300 (path tuyệt đối M/L/C/Q)
const mir300 = (d: string) => d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${600 - parseFloat(x)} ${y}`);

export type PersonProps = {
  spec: CharacterSpec;
  pose?: string;
  poseFrom?: string; // tư thế trước (chuyển dần sang `pose` theo poseT 0..1)
  poseT?: number;
  expr?: string; // ghi đè biểu cảm của tư thế
  mouth?: number;
  frame?: number;
  look?: number; // -1 … 1 (hướng nhìn ngang)
  turn?: number; // -1 … 1 (quay mặt nhẹ sang trái/phải)
  height: number; // chiều cao vẽ của khung 600×1200
  flip?: boolean;
  walk?: number; // pha bước chân (khi pose = di-bo)
  style?: React.CSSProperties;
};

export const Person: React.FC<PersonProps> = ({ spec, pose = 'dung', poseFrom, poseT = 1, expr, mouth = 0, frame = 0, look = 0, turn = 0, height, flip, walk, style }) => {
  const uid = 'p' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const f = spec.gender === 'nu';
  const b = bodyOf(f);
  const P1 = POSES[pose] ?? POSES.dung;
  const P0 = poseFrom && POSES[poseFrom] && poseT < 1 ? POSES[poseFrom] : P1;
  const t = P0 === P1 ? 1 : Math.max(0, Math.min(1, poseT));
  const te = t * t * (3 - 2 * t);
  const mixArm = (a0: ArmDef, b0: ArmDef): ArmDef => { const a = solveArm(a0, b), c = solveArm(b0, b); return { t: lerpV(a.t, c.t, te), e: lerpV(a.e!, c.e!, te), hand: t < 0.5 ? a.hand : c.hand }; };
  const P: PoseDef = { ...P1, L: mixArm(P0.L, P1.L), R: mixArm(P0.R, P1.R), shrug: lerp(P0.shrug ?? 0, P1.shrug ?? 0, te), lean: lerp(P0.lean ?? 0, P1.lean ?? 0, te), head: lerp(P0.head ?? 0, P1.head ?? 0, te) };
  const ek = EXPR_ALIAS[expr ?? ''] ?? expr ?? P1.expr;
  const E = EXPRS[ek] ?? EXPRS['binh-thuong'];
  const skin = spec.skin ?? '#F2C3A0';
  const hairC = spec.hairColor ?? '#2A1D18';
  const hair = spec.hair ?? (f ? 'dai' : 'ngan');
  const o = outfitOf(spec, f);
  const seed = hash(spec.id);
  const period = 96 + (seed % 34);
  const blink = (frame + (seed % period)) % period < 4;
  const breathe = Math.sin(frame / 26 + seed) * 2.2;
  const talking = mouth > 0.06;

  // chuyển động theo biểu cảm + khi nói
  let tilt = (E.tilt ?? 0) + (P.head ?? 0) + (talking ? Math.sin(frame / 3.6) * 1.6 : Math.sin(frame / 42 + seed) * 0.8);
  let hx = 0, hy = 0, bodyY = 0, lean = P.lean ?? 0;
  let shrug = P.shrug ?? 0;
  if (E.motion === 'laugh') { const k = Math.abs(Math.sin(frame / 2.8)); hy = -k * 4; bodyY = -k * 4; lean -= 2.5; tilt += Math.sin(frame / 5) * 2.5; shrug += k * 5; }
  if (E.motion === 'shake') { hx = Math.sin(frame * 1.9) * 1.6; lean += 1.5; }
  if (E.motion === 'tremble') { hx = Math.sin(frame * 2.7) * 1; shrug += 4; }
  if (ek === 'buon' || ek === 'khoc') shrug -= 4;
  const nod = talking ? Math.sin(frame / 4.2) * 1.4 * mouth : 0;
  const gest = talking ? Math.sin(frame / 5.5 + seed) * 9 * Math.min(1, mouth * 1.6) : 0;
  const gestureR = ['tay-mo', 'giai-thich', 'chi', 'nhun-vai'].includes(pose) ? gest : 0;
  const gestureL = ['giai-thich', 'nhun-vai'].includes(pose) ? -gest * 0.8 : 0;
  const wave = pose === 'chao' ? Math.sin(frame / 3.6) * 11 : 0;

  // chân
  const vay = o.bottomKind === 'vay';
  const legs = P1.legs ?? 'stand';
  const ph = (walk ?? frame / 7) % (Math.PI * 2);
  const ax = b.ankX * (legs === 'wide' ? (vay ? 1.1 : 1.5) : 1);
  let aL: V = [300 - ax, ANK_Y], aR: V = [300 + ax, ANK_Y];
  if (legs === 'walk') { aL = [300 - ax + Math.sin(ph) * 8, ANK_Y - Math.max(0, Math.sin(ph)) * 26]; aR = [300 + ax - Math.sin(ph) * 8, ANK_Y - Math.max(0, -Math.sin(ph)) * 26]; bodyY += -Math.abs(Math.cos(ph)) * 4; }
  const hipL: V = [300 - b.hip, HIP_Y], hipR: V = [300 + b.hip, HIP_Y];
  const knee = (H: V, A: V, dir: number): V => { const K = lerpV(H, A, TH / (TH + SHN)); return [K[0] + dir * 3, K[1]]; };
  const kL = knee(hipL, aL, -1), kR = knee(hipR, aR, 1);
  const LEGS: [V, V, V, number][] = [[hipL, kL, aL, -1], [hipR, kR, aR, 1]];
  const shoeW = f ? (vay ? 42 : 52) : 68;
  const shoes = LEGS.map(([, , A, dir], i) => (
    <g key={i}>
      <Two r={(p) => sp(p, shoeD(A[0], A[1], dir, shoeW), o.shoe)} />
      <path d={soleD(A[0], A[1], dir, shoeW)} fill={o.kind === 'hoodie' ? '#B9BEC9' : shade(o.shoe, 0.45)} />
      {o.kind === 'hoodie' && <path d={`M ${A[0] - dir * 8} ${A[1] + 6} l ${dir * 22} 8 M ${A[0] - dir * 4} ${A[1] + 16} l ${dir * 22} 8`} stroke="#B9BEC9" strokeWidth={2.6} strokeLinecap="round" />}
    </g>
  ));
  const pelvis = f ? 'M 186 588 L 414 588 L 418 690 L 300 714 L 182 690 Z' : 'M 180 590 L 420 590 L 424 692 L 300 718 L 176 692 Z';
  const bShade = shade(o.bottom, 0.14);
  const lowerBody = vay ? (
    <g>
      <Two r={(p) => LEGS.map(([H, K, A], i) => <React.Fragment key={i}>{sp(p, limb(H, K, b.wT - 14, b.wK - 10), skin)}{sp(p, limb(K, [A[0], A[1] + 6], b.wK - 10, b.wAnk), skin)}</React.Fragment>)} />
      {LEGS.map(([, K, A, dir], i) => <path key={i} d={shadeStrip(K, A, b.wK - 10, b.wAnk, -dir)} fill={shade(skin, 0.1)} opacity={0.7} />)}
      {shoes}
      <Two r={(p) => sp(p, 'M 184 586 L 416 586 C 428 660 428 770 412 884 L 188 884 C 172 770 172 660 184 586 Z', o.bottom)} />
      <path d="M 416 586 C 428 660 428 770 412 884 L 382 884 C 394 770 394 660 388 586 Z" fill={bShade} opacity={0.7} />
      <path d="M 300 824 L 300 884" stroke={shade(o.bottom, 0.3)} strokeWidth={2.4} />
    </g>
  ) : (
    <g>
      {shoes}
      <Two r={(p) => <>{sp(p, pelvis, o.bottom)}{LEGS.map(([H, K, A], i) => <React.Fragment key={i}>{sp(p, limb(H, K, b.wT, b.wK), o.bottom)}{sp(p, limb(K, [A[0], A[1] + 2], b.wK, b.wHem, true, false), o.bottom)}</React.Fragment>)}</>} />
      {LEGS.map(([H, K, A, dir], i) => (
        <g key={i}>
          <path d={shadeStrip(H, K, b.wT, b.wK, -dir)} fill={bShade} opacity={0.8} />
          <path d={shadeStrip(K, A, b.wK, b.wHem, -dir)} fill={bShade} opacity={0.8} />
          <path d={`M ${H[0] - dir * 2} ${HIP_Y + 90} L ${K[0]} ${K[1]} L ${A[0]} ${A[1] - 4}`} fill="none" stroke={shade(o.bottom, 0.3)} strokeWidth={1.8} strokeLinejoin="round" opacity={0.5} />
        </g>
      ))}
      <path d="M 300 600 L 300 706" stroke={shade(o.bottom, 0.34)} strokeWidth={2.4} />
      <path d={f ? 'M 214 600 Q 226 632 198 654 M 386 600 Q 374 632 402 654' : 'M 204 602 Q 218 636 186 660 M 396 602 Q 382 636 414 660'} fill="none" stroke={shade(o.bottom, 0.34)} strokeWidth={2.2} strokeLinecap="round" />
      {o.tucked && (
        <g>
          <path d={f ? 'M 187 594 L 413 594 L 414 622 L 186 622 Z' : 'M 177 596 L 423 596 L 424 626 L 176 626 Z'} fill="#2B2320" />
          <rect x={285} y={f ? 592 : 594} width={30} height={f ? 32 : 34} rx={4} fill="#C9A24A" stroke="#7A5E1E" strokeWidth={2} />
          <rect x={293} y={f ? 600 : 602} width={14} height={f ? 16 : 18} rx={2} fill="#2B2320" />
        </g>
      )}
    </g>
  );

  const shL: V = [300 - b.sh, b.shY - shrug], shR: V = [300 + b.sh, b.shY - shrug];
  const armL = <Arm S={shL} def={P.L} side={1} skin={skin} o={o} b={b} wave={0} gesture={gestureL} />;
  const armR = <Arm S={shR} def={P.R} side={-1} skin={skin} o={o} b={b} wave={wave} gesture={-gestureR} />;
  const lk: [number, number] = [P1.look?.[0] ?? look, P1.look?.[1] ?? 0];
  const w = height * 0.5;
  const nk = b.neck;
  const neck = `M ${300 - nk} 150 L ${300 + nk} 150 L ${300 + nk + 1} 226 Q ${300 + nk + 16} 240 ${300 + nk + 46} 246 L ${300 - nk - 46} 246 Q ${300 - nk - 16} 240 ${300 - nk - 1} 226 Z`;
  const headT = `translate(${(300 + hx).toFixed(2)} ${(b.hcy + hy + nod).toFixed(2)}) scale(${b.hk}) rotate(${tilt.toFixed(2)} 0 150)`;
  const faceD = f ? FACE_F : FACE_M;
  const earX = f ? 96 : 99;

  return (
    <svg viewBox="0 0 600 1200" width={w} height={height} style={{ overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined, ...style }}>
      <ellipse cx={300} cy={1168} rx={vay ? 140 : 176} ry={14} fill="#000" opacity={0.16} />
      {lowerBody}
      <g transform={`translate(0 ${bodyY.toFixed(2)}) rotate(${lean.toFixed(2)} 300 ${HIP_Y})`}>
        {o.kind === 'hoodie' && <Two r={(p) => sp(p, 'M 214 258 C 196 188 250 146 300 146 C 350 146 404 188 386 258 Z', o.topS)} />}
        <g transform={headT}><Hair style={hair} c={hairC} layer="back" /></g>
        <Two r={(p) => sp(p, neck, skin)} />
        <path d={`M ${300 - nk} 176 L ${300 + nk} 176 L ${300 + nk} 204 Q 300 232 ${300 - nk} 204 Z`} fill={shade(skin, 0.17)} opacity={0.8} />
        <g transform={`translate(300 300) scale(1 ${(1 + breathe / 600).toFixed(4)}) translate(-300 -300)`}>
          <Torso o={o} f={f} skin={skin} logo={spec.logo !== false && o.kind === 'misa'} flip={!!flip} uid={uid} belly={!f && spec.age === 'trung-nien' ? 8 : 0} />
        </g>
        {/* đầu */}
        <g transform={headT}>
          <Two r={(p) => <>{sp(p, ell(-earX - turn * 6, 18, 13, 25), skin, 'l')}{sp(p, ell(earX - turn * 6, 18, 13, 25), skin, 'r')}{sp(p, faceD, skin, 'f')}</>} />
          <path d={`M ${-earX - turn * 6 - 3} 8 q -6 10 2 22 M ${earX - turn * 6 + 3} 8 q 6 10 -2 22`} fill="none" stroke={mix(skin, '#7A3A26', 0.5)} strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
          <path d={f ? 'M 94 -16 C 94 30 84 66 55 97 C 38 115 19 122 0 122 C 32 104 64 70 74 6 Z' : 'M 97 -14 C 97 34 90 68 64 95 C 46 114 23 122 0 122 C 36 104 72 70 80 6 Z'} fill={shade(skin, 0.13)} opacity={0.5} />
          <g transform={`translate(${(turn * 8).toFixed(2)} 0)`}>
            <Face e={E} mouth={mouth} blink={blink} look={lk} female={f} skin={skin} brow={mix(hairC, '#000000', 0.1)} glasses={spec.glasses} uid={uid} age={spec.age} beard={spec.beard} frame={frame} />
          </g>
          <Hair style={hair} c={hairC} layer="front" />
        </g>
        {P.front === 'L' ? <>{armR}{armL}</> : <>{armL}{armR}</>}
      </g>
    </svg>
  );
};

// Tương thích tên cũ
export const MisaCharacter = Person;
export { MISA_LOGO_RATIO };
