import React, { useId } from 'react';
import { Img, staticFile } from 'remotion';
import { MisaLogo, MISA_LOGO_RATIO } from './MisaLogo';
import { useStill } from './theme';
import type { CharacterSpec } from '../types';

// Nhân vật người — minh hoạ phẳng, TOÀN THÂN, dáng ĐẦY ĐẶN (~6 đầu: vai rộng, thân dày, tay chân to vừa phải), khung 600×1200, gốc trên-trái.
// Mốc: đỉnh đầu y≈14 · cằm 204 · vai 290 · eo 480 · hông 640 · gối 886 · mắt cá 1120 · đế giày 1164.
// Cách vẽ: mỗi khối (tay, quần, mặt, tóc…) vẽ HAI LƯỢT — lượt viền (nét cùng tông màu, đậm hơn) rồi lượt tô — nên các đoạn
// trong cùng một khối liền nhau, không lộ khớp khuỷu/gối/cổ tay. Có khớp vai/khuỷu/cổ tay/hông/gối → tư thế chuyển dần.
// Trang phục: misa (polo vàng đồng phục: cổ + nẹp than, sọc đỏ, logo MISA đầy đủ ngực trái) · so-mi · vest · hoodie · ao-thun · cardigan
//   · ao-dai (áo dài: cổ đứng, vạt chéo, tà trước/sau, quần ống rộng) · vay-lien · blazer-nu · ao-len · polo (trơn) · ao-khoac (bomber) · dong-phuc (công việc chung) · ao-so-mi-ke; quần hoặc váy.
// Mascot (kind 'mascot'): xem mục MASCOT cuối file.
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
// fade = phần tóc cắt sát (undercut, húi cua) — tô màu tóc pha da, không viền; tieF = dây buộc vẽ ở lớp trước (bím tóc)
type HairDef = { back?: string[]; front: string[]; hi?: string[]; lines?: string[]; tie?: V; fade?: string[]; tieF?: V; soft?: boolean }; // soft: lớp trước không viền đậm (tóc cắt sát)
const LOCK = 'M -100 -14 C -114 60 -112 170 -98 262 C -86 276 -66 268 -62 250 C -74 170 -78 84 -82 6 Z';
const BOB_SIDE = 'M -103 -6 C -113 36 -114 80 -108 116 C -98 124 -86 122 -80 112 C -86 72 -86 30 -85 -22 Z';
const HOI_SIDE = 'M -101 10 C -110 -30 -106 -72 -89 -96 C -80 -72 -77 -40 -79 -2 Z';
const WAVE_LOCK = 'M -100 -14 C -118 40 -100 84 -116 132 C -128 182 -104 222 -114 264 C -98 286 -70 278 -64 258 C -80 222 -66 182 -78 140 C -88 100 -74 52 -82 6 Z';
const UNDER_SIDE = 'M -101 4 C -108 -40 -107 -92 -94 -114 L -66 -100 L -80 -74 C -89 -48 -97 -22 -101 4 Z';
const PIXIE_SIDE = 'M -100 -12 C -106 10 -104 30 -96 46 C -91 30 -89 8 -87 -22 Z';
const braid = (x0: number, y0: number, n: number, dx: number, dy: number) =>
  Array.from({ length: n }, (_, i) => ell(x0 + i * dx + (i % 2 ? 7 : -7), y0 + i * dy, 25 - i * 0.9, 27 - i * 0.6));
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
  // ── nam (thêm 23/11/2026)
  'hui-cua': {
    // húi cua: cả đầu cắt sát sát da (màu tóc hơi pha da, không viền), chân tóc trán có góc lùi ở thái dương, chấm lấm tấm chân tóc
    front: ['M -101 2 C -109 -70 -88 -149 0 -150 C 88 -149 109 -70 101 2 C 98 -26 95 -44 90 -58 L 80 -72 C 56 -82 28 -86 0 -86 C -28 -86 -56 -82 -80 -72 L -90 -58 C -95 -44 -98 -26 -101 2 Z'],
    soft: true,
    hi: ['M -40 -128 C 0 -142 52 -136 76 -110 C 46 -124 6 -128 -34 -120 Z'],
    lines: ['M -58 -100 L -56 -108', 'M -30 -106 L -29 -116', 'M 0 -108 L 0 -118', 'M 30 -106 L 29 -116', 'M 58 -100 L 56 -108', 'M -44 -126 L -42 -134', 'M 14 -130 L 14 -138', 'M 46 -124 L 44 -132', 'M -84 -40 L -86 -48', 'M 84 -40 L 86 -48'],
  },
  mai: {
    // mái ngố: tóc phủ trán, đuôi mái so le (không che lông mày)
    front: ['M -102 6 C -114 -66 -92 -158 0 -160 C 92 -158 114 -66 102 6 C 99 -18 96 -38 91 -54 L 78 -60 L 66 -52 L 50 -64 L 34 -55 L 16 -66 L 0 -57 L -18 -66 L -36 -56 L -54 -65 L -70 -55 L -84 -61 L -91 -54 C -96 -38 -99 -18 -102 6 Z'],
    hi: ['M -40 -134 C 0 -150 56 -142 82 -108 C 50 -126 6 -130 -34 -122 Z'],
    lines: ['M -50 -110 L -40 -72', 'M 0 -116 L 4 -70', 'M 46 -108 L 40 -72'],
  },
  're-ngoi': {
    // rẽ ngôi lệch: ngôi bên phải nhân vật, tóc chải sang bên kia
    front: ['M -102 8 C -112 -62 -100 -134 -48 -151 C 10 -169 92 -150 105 -80 C 109 -50 105 -20 102 8 C 98 -24 92 -46 82 -62 C 48 -84 -2 -88 -36 -106 L -42 -94 C -62 -82 -80 -72 -88 -62 C -95 -42 -99 -18 -102 8 Z'],
    hi: ['M -30 -128 C 10 -150 66 -142 92 -104 C 56 -126 12 -128 -24 -116 Z'],
    lines: ['M -40 -108 C -6 -134 46 -132 86 -96', 'M -42 -96 C -70 -84 -86 -70 -92 -50'],
  },
  undercut: {
    // undercut: hai bên cắt sát, đỉnh để dài vuốt cao
    fade: [UNDER_SIDE, mir(UNDER_SIDE)],
    front: ['M -90 -104 C -100 -136 -72 -166 -10 -170 C 56 -174 102 -148 92 -102 C 76 -84 50 -76 24 -78 C 0 -80 -30 -70 -58 -74 C -72 -78 -84 -90 -90 -104 Z'],
    hi: ['M -40 -150 C 0 -170 58 -166 84 -128 C 50 -148 4 -152 -34 -140 Z'],
    lines: ['M -56 -84 C -40 -132 10 -160 70 -152', 'M -16 -72 C 0 -120 40 -146 86 -130'],
  },
  'dai-buoc': {
    // tóc dài buộc gọn sau gáy (búi nhỏ trên đỉnh nhìn thấy từ phía trước)
    back: [ell(0, -166, 36, 30)],
    front: ['M -101 6 C -111 -54 -105 -113 -63 -141 C -20 -170 76 -168 101 -112 C 113 -72 107 -30 101 6 C 98 -24 92 -48 82 -68 C 40 -95 -40 -97 -81 -70 C -92 -48 -98 -22 -101 6 Z'],
    lines: ['M -62 -92 C -44 -130 0 -150 -2 -150', 'M 62 -92 C 44 -130 2 -150 2 -150', 'M -14 -180 Q 0 -190 16 -178'],
  },
  // ── nữ (thêm 23/11/2026)
  'xoa-dai': {
    // dài xoã gợn sóng
    back: ['M -110 -20 C -120 -112 -60 -158 0 -158 C 60 -158 120 -112 110 -20 C 128 40 112 100 132 160 C 148 220 124 262 142 302 C 110 330 70 318 54 296 L 0 200 L -54 296 C -70 318 -110 330 -142 302 C -124 262 -148 220 -132 160 C -112 100 -128 40 -110 -20 Z'],
    front: ['M -104 12 C -115 -70 -88 -155 0 -157 C 88 -155 115 -70 104 12 C 100 -24 94 -52 82 -74 C 50 -84 10 -104 -18 -126 C -36 -96 -66 -74 -88 -60 C -96 -40 -101 -16 -104 12 Z', WAVE_LOCK, mir(WAVE_LOCK)],
    hi: ['M 0 -136 C 34 -146 76 -128 90 -90 C 62 -114 30 -124 2 -124 Z'],
    lines: ['M -104 60 C -96 100 -110 130 -100 170', 'M 104 60 C 96 100 110 130 100 170', 'M -24 -122 C -50 -96 -72 -80 -86 -72'],
  },
  'duoi-ngua': {
    // đuôi ngựa buộc cao sau đỉnh đầu
    back: ['M 26 -162 C 96 -206 168 -150 154 -56 C 146 12 128 76 104 118 C 112 52 106 -10 90 -60 C 78 -100 58 -128 26 -140 Z'],
    tie: [40, -152],
    front: ['M -102 10 C -113 -66 -88 -153 0 -155 C 88 -153 113 -66 102 10 C 98 -28 88 -60 66 -84 C 34 -96 -20 -98 -50 -88 C -76 -72 -94 -40 -102 10 Z'],
    hi: ['M -34 -132 C 10 -148 62 -136 84 -100 C 54 -120 12 -124 -28 -120 Z'],
    lines: ['M -50 -88 C -20 -120 20 -140 40 -150', 'M 66 -84 C 56 -116 48 -136 40 -150'],
  },
  'toc-ngan': {
    // tóc tém (pixie): ngắn, mái lệch phủ một bên trán
    front: ['M -100 0 C -110 -72 -88 -154 0 -156 C 90 -154 112 -72 100 0 C 98 -22 96 -38 92 -50 C 78 -62 60 -66 44 -72 C 16 -80 -14 -66 -42 -60 C -66 -56 -84 -54 -92 -42 C -96 -28 -99 -14 -100 0 Z', PIXIE_SIDE, mir(PIXIE_SIDE)],
    hi: ['M -30 -132 C 10 -148 62 -138 86 -102 C 54 -122 14 -126 -24 -120 Z'],
    lines: ['M 40 -76 C 10 -100 -30 -104 -70 -76', 'M 70 -96 C 40 -120 0 -124 -40 -110'],
  },
  'mai-thua': {
    // dài có mái thưa ngang trán
    back: ['M -108 -20 C -118 -112 -60 -157 0 -157 C 60 -157 118 -112 108 -20 C 112 80 124 190 130 290 C 100 318 62 310 46 290 L 0 190 L -46 290 C -62 310 -100 318 -130 290 C -124 190 -112 80 -108 -20 Z'],
    front: ['M -104 12 C -116 -70 -90 -157 0 -159 C 90 -157 116 -70 104 12 C 101 -16 97 -36 92 -50 C 70 -56 52 -54 40 -60 C 26 -54 12 -56 0 -61 C -12 -56 -26 -54 -40 -60 C -52 -54 -70 -56 -92 -50 C -97 -36 -101 -16 -104 12 Z', LOCK, mir(LOCK)],
    hi: ['M -40 -136 C 0 -150 56 -142 84 -108 C 50 -126 6 -130 -34 -124 Z'],
    lines: ['M -60 -100 L -56 -62', 'M -20 -104 L -20 -64', 'M 20 -104 L 20 -64', 'M 60 -100 L 56 -62'],
  },
  'toc-tet': {
    // tết một bím vắt qua vai trái nhân vật (phía phải khung vẽ)
    back: ['M -108 -20 C -118 -112 -60 -157 0 -157 C 60 -157 118 -112 108 -20 C 108 20 104 40 96 50 L -96 50 C -104 40 -108 20 -108 -20 Z'],
    front: ['M -102 10 C -113 -66 -88 -153 0 -155 C 88 -153 113 -66 102 10 C 98 -28 88 -60 66 -84 C 34 -96 -20 -98 -50 -88 C -76 -72 -94 -40 -102 10 Z', 'M 64 -86 C 100 -64 112 -24 106 22 L 82 18 C 88 -16 84 -52 58 -78 Z', ...braid(98, 34, 8, 2.6, 34), 'M 108 296 L 92 344 L 106 336 L 116 352 L 124 334 L 138 340 L 124 294 Z'],
    hi: ['M -34 -132 C 10 -148 62 -136 84 -100 C 54 -120 12 -124 -28 -120 Z'],
    tieF: [114, 292],
  },
};
export const HAIR_LIST = Object.keys(HAIR);
const Hair: React.FC<{ style: string; c: string; layer: 'back' | 'front'; skin?: string }> = ({ style, c, layer, skin = '#F2C3A0' }) => {
  const h = HAIR[style] ?? HAIR.ngan;
  const ds = layer === 'back' ? h.back : h.front;
  if (!ds?.length) return null;
  return (
    <g>
      {layer === 'front' && h.fade?.map((d, i) => <path key={'fd' + i} d={d} fill={mix(c, skin, 0.42)} />)}
      {layer === 'front' && h.soft ? ds.map((d, i) => <path key={i} d={d} fill={mix(c, skin, 0.1)} stroke={mix(c, skin, 0.3)} strokeWidth={2} />) : <Two r={(p) => ds.map((d, i) => sp(p, d, c, i))} />}
      {layer === 'front' && h.tieF && <ellipse cx={h.tieF[0]} cy={h.tieF[1]} rx={17} ry={11} fill={SHIRT.red} stroke={ol(SHIRT.red)} strokeWidth={LW} />}
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
// Nguyên tắc: khuỷu tay ở gần thân (không chĩa ngang ra ngoài), cử chỉ nằm ở cẳng tay + bàn tay; không giơ hai tay quá đầu.
// Tay mở ra ngoài thì cả cánh tay cùng đưa ra (bắp tay nghiêng ~20°, góc khuỷu rộng), không ghim bắp tay thẳng đứng rồi bẻ cẳng tay ngang — trông như gãy khuỷu.
const LOW: V = [0.09, 0.5]; // khuỷu buông cạnh sườn (tay gập vào trong / tay nghỉ)
const OUT: V = [0.17, 0.46]; // khuỷu hơi đưa ra ngoài — dùng cho tay MỞ RA phía ngoài (bẫy 18: đừng ghim khuỷu sát sườn rồi bẻ cẳng tay ngang ra)
export const POSES: Record<string, PoseDef> = {
  dung: { L: HANG, R: HANG, expr: 'cuoi' },
  chao: { L: HANG, R: { e: [0.2, 0.46], t: [0.33, 0.03], hand: 'open' }, expr: 'vui' },
  chi: { L: HANG, R: { e: [0.3, 0.4], t: [0.74, 0.22], hand: 'point' }, expr: 'cuoi', head: 3 },
  'tay-mo': { L: HANG, R: { e: OUT, t: [0.5, 0.42], hand: 'palm' }, expr: 'cuoi' },
  'giai-thich': { L: { e: [0.16, 0.47], t: [0.42, 0.5], hand: 'palm' }, R: { e: OUT, t: [0.48, 0.4], hand: 'palm' }, expr: 'binh-thuong' },
  nghi: { L: { e: [0.03, 0.5], t: [-0.38, 0.5], hand: 'fist' }, R: { e: [-0.06, 0.4], t: [-0.25, -0.02], hand: 'fist' }, expr: 'nghi', front: 'R', head: -4 },
  vui: { L: HANG, R: { e: [0.16, 0.45], t: [0.27, 0.02], hand: 'fist' }, expr: 'vui', shrug: 4, head: -3 },
  'ngac-nhien': { L: { e: OUT, t: [0.42, 0.36], hand: 'open' }, R: { e: [0.05, 0.5], t: [-0.2, 0.2], hand: 'open' }, expr: 'ngac-nhien', lean: -1.5, shrug: 6, front: 'R' },
  'khoanh-tay': { L: { e: [-0.02, 0.47], t: [-0.47, 0.4], hand: 'fist' }, R: { e: [-0.02, 0.47], t: [-0.47, 0.46], hand: 'fist' }, expr: 'tu-tin', front: 'R' },
  buon: { L: { t: [0.02, 0.996], hand: 'relax' }, R: { t: [0.02, 0.996], hand: 'relax' }, expr: 'buon', shrug: -7, head: 7 },
  'dien-thoai': { L: HANG, R: { e: [0.05, 0.49], t: [-0.14, 0.2], hand: 'phone' }, expr: 'binh-thuong', look: [0, 1], head: 8, front: 'R' },
  'nghe-may': { L: HANG, R: { e: [0.13, 0.36], t: [-0.06, -0.13], hand: 'phone' }, expr: 'binh-thuong', front: 'R', head: -4, shrug: 4 },
  'om-dau': { L: HANG, R: { e: [0.3, 0.26], t: [0.1, -0.2], hand: 'open' }, expr: 'so', shrug: 7, head: -6, front: 'R' },
  'chong-nanh': { L: { e: [0.27, 0.43], t: [0.03, 0.74], hand: 'fist' }, R: { e: [0.27, 0.43], t: [0.03, 0.74], hand: 'fist' }, expr: 'gian' },
  like: { L: HANG, R: { e: [0.1, 0.48], t: [0.2, 0.1], hand: 'thumb' }, expr: 'vui' },
  'nhun-vai': { L: { e: [0.16, 0.47], t: [0.46, 0.46], hand: 'palm' }, R: { e: [0.16, 0.47], t: [0.46, 0.46], hand: 'palm' }, expr: 'lo-lang', shrug: 13, head: 5 },
  'di-bo': { L: HANG, R: HANG, expr: 'binh-thuong', legs: 'walk' },
  // ngồi bàn: hai tay đặt lên mặt bàn / bàn phím (cảnh story)
  'go-phim': { L: { e: [0.06, 0.47], t: [-0.16, 0.66], hand: 'relax' }, R: { e: [0.06, 0.47], t: [-0.16, 0.66], hand: 'relax' }, expr: 'binh-thuong', look: [0, 0.6], head: 3 },
  'dat-tay': { L: { e: [0.07, 0.48], t: [-0.3, 0.68], hand: 'relax' }, R: { e: [0.07, 0.48], t: [-0.3, 0.74], hand: 'relax' }, expr: 'binh-thuong', front: 'R' },
};
export const POSE_LIST = Object.keys(POSES);

// ───── HƯỚNG CỬ CHỈ (luật cứng — đừng bỏ): tay đưa ra phải hướng VỀ phía nhân vật đang quay tới (người nghe / giữa khung hình).
// Người quay mặt sang phải mà tay lại mở ngang sang trái thì trông như bẻ tay ra sau lưng ("tay bị ngược").
// Tư thế trong POSES chỉ viết MỘT chiều; hàm này tự xoay theo `dir` (+1 = quay sang phải khung vẽ, −1 = sang trái, 0 = nhìn thẳng máy quay):
//   • chỉ một tay mở mà lại nằm phía xa  → lật trái–phải cả tư thế (tay cử chỉ luôn là tay phía gần);
//   • cả hai tay mở (giai-thich, nhun-vai) và đang quay về người nghe (`fold`) → tay phía xa gập ra trước bụng, không mở ra sau.
// "Tay mở" = cẳng tay đưa NGANG ra ngoài thân (chi, tay-mo, giai-thich, nhun-vai, ngac-nhien). Bàn tay giơ thẳng cạnh vai/đầu
// (chao, vui, like, om-dau, nghe-may) không tính: không có hướng, và lật sang phía bạn diễn chỉ làm hai bàn tay chạm nhau ở cảnh cận.
export const armOpen = (d: ArmDef) => d.t[0] >= 0.25 && d.t[1] > 0.15 && d.t[1] < 0.7;
const FAR_FOLD: ArmDef = { e: [0.09, 0.5], t: [-0.14, 0.53], hand: 'open' }; // bàn tay ngang bụng, dưới logo ngực
const mirrorPose = (p: PoseDef): PoseDef => ({ ...p, L: p.R, R: p.L, front: p.front === 'L' ? 'R' : p.front === 'R' ? 'L' : undefined, look: p.look && [-p.look[0], p.look[1]], head: -(p.head ?? 0), lean: -(p.lean ?? 0) });
export const orientPose = (p: PoseDef, dir: number, fold: boolean): { pose: PoseDef; mirrored: boolean } => {
  if (!dir) return { pose: p, mirrored: false };
  const far = (q: PoseDef) => (dir > 0 ? q.L : q.R), near = (q: PoseDef) => (dir > 0 ? q.R : q.L);
  const mirrored = armOpen(far(p)) && !armOpen(near(p));
  let q = mirrored ? mirrorPose(p) : p;
  if (fold && armOpen(far(q)) && armOpen(near(q))) q = dir > 0 ? { ...q, L: FAR_FOLD, front: 'L' } : { ...q, R: FAR_FOLD, front: 'R' };
  return { pose: q, mirrored };
};
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
// pad = tay áo dài rộng hơn cánh tay bao nhiêu; cuff = kiểu cổ tay áo (band: viền màu cuffC · rib: bo len có sọc · none: liền tay như áo dài)
// pat = id pattern kẻ ô (áo sơ mi kẻ) phủ lên thân + tay; wideLeg = quần ống rộng (áo dài)
type Outfit = { kind: string; top: string; topS: string; sleeve: 'short' | 'long'; bottom: string; bottomKind: 'quan' | 'vay'; shoe: string; hemY: number; hemW: number; tucked: boolean; pad: number; padW: number; cuff: 'band' | 'rib' | 'none'; cuffC: string; cuff0: number; pat?: string; wideLeg?: boolean };
// màu áo mặc định của từng kiểu (kind khác misa đổi bằng outfitColor)
const TOP_DEF: Record<string, string> = {
  misa: SHIRT.yellow, 'so-mi': '#EAF1FA', vest: '#2C3346', hoodie: '#3B404C', 'ao-thun': '#4C8BF5', cardigan: '#C9A27E',
  'ao-dai': '#B8283A', 'vay-lien': '#3F6FB5', 'blazer-nu': '#3A4A6E', 'ao-len': '#8E3B4A', polo: '#2F7A5A', 'ao-khoac': '#4A5A44', 'dong-phuc': '#5E7FA3', 'ao-so-mi-ke': '#C2463C',
};
const outfitOf = (spec: CharacterSpec, f: boolean, pat?: string): Outfit => {
  const k = spec.kind ?? 'misa';
  const top = k === 'misa' ? SHIRT.yellow : spec.outfitColor ?? TOP_DEF[k] ?? '#4C8BF5';
  // váy liền: phần váy cùng màu áo; áo dài luôn mặc quần (ống rộng, mặc định trắng)
  const vay = k === 'vay-lien' || (spec.bottom === 'vay' && k !== 'ao-dai');
  const bottom = spec.bottomColor ?? (k === 'vay-lien' ? top : k === 'ao-dai' ? '#F4F1EA' : k === 'hoodie' ? '#46689A' : k === 'vest' || k === 'blazer-nu' ? shade(top, 0.06) : k === 'dong-phuc' ? '#2E3646' : vay ? '#2E3445' : '#2F3B57');
  const hem: Record<string, [number, number]> = {
    misa: [640, f ? 122 : 128], 'ao-thun': [640, f ? 122 : 128], hoodie: [650, f ? 126 : 133], 'so-mi': [602, f ? 110 : 124], vest: [690, f ? 127 : 134], cardigan: [684, f ? 128 : 132],
    'ao-dai': [f ? 500 : 520, f ? 101 : 131], 'vay-lien': [600, f ? 116 : 124], 'blazer-nu': [672, f ? 126 : 133], 'ao-len': [650, f ? 125 : 131], polo: [640, f ? 122 : 128],
    'ao-khoac': [640, f ? 124 : 131], 'dong-phuc': [602, f ? 110 : 124], 'ao-so-mi-ke': [646, f ? 124 : 130],
  };
  const [hemY, hemW] = hem[k] ?? hem.misa;
  const sleeve = k === 'ao-thun' || k === 'misa' || k === 'polo' || k === 'vay-lien' ? 'short' : 'long';
  const pad = ({ hoodie: 10, vest: 8, 'blazer-nu': 7, 'ao-dai': 2, 'ao-len': 9, 'ao-khoac': 11 } as Record<string, number>)[k] ?? 6;
  const padW = k === 'hoodie' || k === 'ao-khoac' ? 1.1 : k === 'ao-len' ? 1 : 0.8;
  const cuffC = k === 'vest' || k === 'blazer-nu' ? '#F4F6FA' : k === 'so-mi' ? light(top, 0.45) : k === 'hoodie' ? shade(top, 0.14) : k === 'ao-khoac' ? shade(top, 0.3) : k === 'ao-so-mi-ke' ? top : shade(top, 0.1);
  return {
    kind: k, top, topS: k === 'misa' ? SHIRT.yellowShade : shade(top, 0.14), sleeve, bottom, bottomKind: vay ? 'vay' : 'quan',
    shoe: k === 'hoodie' ? '#F1F3F7' : f ? '#3A2A2A' : '#26282E', hemY, hemW, tucked: k === 'so-mi' || k === 'dong-phuc',
    pad, padW, cuff: k === 'ao-dai' ? 'none' : k === 'hoodie' || k === 'ao-len' || k === 'ao-khoac' ? 'rib' : 'band', cuffC, cuff0: k === 'vest' || k === 'blazer-nu' ? 0.92 : 0.86,
    pat: k === 'ao-so-mi-ke' ? pat : undefined, wideLeg: k === 'ao-dai',
  };
};

// ───── bàn tay (hệ toạ độ cẳng tay: gốc ở cổ tay, +y hướng ra đầu ngón; tx = ±1 phía đặt ngón cái)
const handShapes = (kind: Hand, tx: number): { d: string[]; lines?: string } => {
  const finger = (x: number, y0: number, len: number, rot: number, w = 11.5) => limb([x, y0], [x + Math.sin(rad(rot)) * len, y0 + Math.cos(rad(rot)) * len], w, w * 0.84);
  const palm = 'M -15 -8 C -23 10 -25 30 -22 48 L 22 48 C 25 30 23 10 15 -8 Z';
  const fist = 'M -16 -8 C -24 8 -27 30 -23 45 C -19 57 -9 61 2 61 C 14 61 22 55 24 43 C 27 28 24 8 16 -8 Z';
  const thumbIn = limb([tx * 19, 12], [tx * 9, 40], 14, 12);
  if (kind === 'open') return { d: [finger(-16, 42, 36, -14), finger(-5.5, 45, 45, -4.5), finger(5.5, 45, 43, 4.5), finger(16, 42, 33, 14), palm, limb([tx * 17, 14], [tx * 46, 34], 14, 11)] };
  if (kind === 'palm') return { d: [finger(-15.5, 42, 38, -5), finger(-5.2, 44, 46, -1.5), finger(5.2, 44, 44, 1.5), finger(15.5, 42, 35, 5), palm, limb([tx * 17, 14], [tx * 42, 40], 14, 11)] };
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
  // PHÍA NGÓN CÁI (luật cứng — bẫy 18). Bàn tay xoè (open/palm) luôn vẽ nhìn từ MU bàn tay: ngón cái nằm về phía `side`
  // (tay phải nhân vật — bên trái khung vẽ — ngón cái ở +x của hệ bàn tay, tay trái ngược lại). Cố định theo TAY, không theo góc cẳng tay,
  // nên không bao giờ ra "bàn tay trái gắn vào tay phải" và ngón cái không nhảy phía khi tay lắc. Tay nắm/chỉ/giơ ngón cái: ngón cái vào trong/lên trên.
  const flat = def.hand === 'palm' || def.hand === 'open';
  const tx = flat ? side : Math.cos(rad(a2)) * side * 0.6 - Math.sin(rad(a2)) >= 0 ? 1 : -1;
  const long = o.sleeve === 'long';
  const pad = long ? o.pad : 0;
  const wU = b.wU + pad, wE = b.wE + pad, wW = b.wW + pad * o.padW;
  const armC = long ? o.top : skin;
  const { cuff0, cuffC } = o;
  const cuffOn = long && o.cuff !== 'none';
  const patF = long && o.pat ? `url(#${o.pat})` : null; // kẻ ô phủ lên tay áo (sơ mi kẻ)
  const mid = lerpV(S, E, 0.5);
  const sW = b.wU + 10;
  const shadeC = mix(armC, shade(armC, 0.1), 0.75);
  // THỨ TỰ LỚP (luật cứng — bẫy 18): bắp tay + tay áo vẽ TRƯỚC, cẳng tay + bàn tay vẽ SAU (nằm trên).
  // Khuỷu người chỉ gập ra phía trước, nên nhìn chính diện cẳng tay luôn ở trước bắp tay; vẽ ngược lại thì tay giơ lên
  // trông như luồn ra sau vai/tay áo ("tay bị ngược").
  const kJ = 0.74; // đoạn cuối bắp tay tô đè lại để xoá nét viền đầu tròn của cẳng tay ngay khớp khuỷu (không lộ đường nối)
  const J = lerpV(S, E, kJ), wJ = lerp(wU, wE, kJ);
  const upper = (p: Pass) => (
    <>
      {sp(p, limb(S, E, wU, wE), armC)}
      {!long && sp(p, limb(S, mid, sW, sW - 5, true, false), o.top)}
      {!long && o.kind === 'misa' && sp(p, band(lerpV(S, E, 0.405), mid, sW - 4, sW - 5), SHIRT.dark)}
      {p === 'f' && (
        <>
          <path d={shadeStrip(S, J, wU, wJ, side)} fill={shadeC} />
          {patF && <path d={limb(S, E, wU, wE)} fill={patF} />}
          {!long && <path d={limb(S, mid, sW, sW - 5, true, false)} fill={o.top} />}
          {!long && o.kind === 'misa' && <path d={band(lerpV(S, E, 0.405), mid, sW - 4, sW - 5)} fill={SHIRT.dark} />}
          {!long && o.kind === 'misa' && <path d={band(lerpV(S, E, 0.438), lerpV(S, E, 0.458), sW - 4.4, sW - 4.6)} fill={SHIRT.red} />}
          {!long && o.kind !== 'misa' && <path d={band(lerpV(S, E, 0.455), mid, sW - 4.6, sW - 5)} fill={o.topS} />}
        </>
      )}
    </>
  );
  const fore = (p: Pass) => (
    <>
      {sp(p, limb(E, long ? lerpV(E, W, 1.0) : W, wE, wW), armC)}
      <g transform={`translate(${W[0].toFixed(1)} ${W[1].toFixed(1)}) rotate(${a2.toFixed(1)})`}>
        <HandG pass={p} kind={def.hand ?? 'relax'} skin={skin} dir={a2} tx={tx} k={b.hand} />
      </g>
      {cuffOn && sp(p, band(lerpV(E, W, cuff0), lerpV(E, W, 1.02), wW + 5, wW + 4), cuffC)}
      {p === 'f' && (
        <>
          <path d={limb(J, E, wJ, wE, false, true)} fill={armC} />
          <path d={shadeStrip(E, W, wE, wW, side)} fill={shadeC} />
          {patF && <><path d={limb(J, E, wJ, wE, false, true)} fill={patF} /><path d={limb(E, W, wE, wW, false, false)} fill={patF} /></>}
          {cuffOn && <path d={band(lerpV(E, W, cuff0), lerpV(E, W, 1.02), wW + 5, wW + 4)} fill={cuffC} />}
          {cuffOn && patF && <path d={band(lerpV(E, W, cuff0), lerpV(E, W, 1.02), wW + 5, wW + 4)} fill={patF} />}
          {cuffOn && o.cuff === 'rib' && [0.9, 0.94, 0.98].map((t) => <path key={t} d={band(lerpV(E, W, t), lerpV(E, W, t + 0.008), wW + 4)} fill={shade(o.top, 0.3)} />)}
          {cuffOn && (o.kind === 'so-mi' || o.kind === 'dong-phuc' || o.kind === 'ao-so-mi-ke') && <circle cx={lerpV(E, W, 0.94)[0]} cy={lerpV(E, W, 0.94)[1]} r={2.6} fill={shade(o.top, 0.3)} />}
        </>
      )}
    </>
  );
  return (
    <>
      <Two r={upper} />
      <Two r={fore} />
    </>
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
// gấu ngắn tới eo (áo dài: thân ôm tới eo rồi xẻ tà) → đoạn cuối đi thẳng xuống, không vòng ngược
const torsoD = (f: boolean, hemY: number, hw: number, belly = 0) =>
  f
    ? symPath([278, 232], [[[258, 234], [228, 240], [202, 248]], [[176, 252], [160, 266], [160, 288]], [[160, 312], [174, 336], [182, 360]], [[188, 394], [200, 432], [200, 470]], hemY < 560 ? [[200, 480], [300 - hw, hemY - 12], [300 - hw, hemY]] : [[200, 514], [300 - hw - 4, hemY - 70], [300 - hw, hemY]]])
    : symPath([272, 232], [[[248, 234], [212, 240], [182, 250]], [[154, 255], [138, 270], [138, 294]], [[138, 322], [150, 352], [158, 386]], [[164, 422], [168 - belly, 454], [170 - belly, 488]], hemY < 560 ? [[172 - belly, 498], [300 - hw, hemY - 12], [300 - hw, hemY]] : [[172 - belly, 534], [300 - hw - 2, hemY - 56], [300 - hw, hemY]]]);

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
  else if (o.kind === 'ao-dai') {
    // áo dài: cổ đứng (cổ tàu), vạt cài chéo từ cổ sang nách phải người mặc (bên trái khung vẽ), thân ôm tới eo; vạt trước/sau vẽ ở Person
    const nk = f ? 26 : 30, sx0 = f ? 196 : 172;
    detail = (
      <g>
        <path d={`M ${300 - nk - 2} 238 Q ${260} ${252} ${sx0} ${f ? 296 : 302}`} {...lineP} stroke={shade(o.top, 0.32)} strokeWidth={2.6} />
        {[0.3, 0.62].map((t) => { const x = lerp(300 - nk - 2, sx0, t), y = lerp(238, f ? 296 : 302, t) - Math.sin(t * Math.PI) * 6; return <circle key={t} cx={x} cy={y} r={3.4} fill={light(o.top, 0.55)} stroke={shade(o.top, 0.35)} strokeWidth={1.2} />; })}
        <Two r={(p) => sp(p, `M ${300 - nk - 4} 204 L ${300 + nk + 4} 204 L ${300 + nk + 6} 236 Q 300 246 ${300 - nk - 6} 236 Z`, o.top)} />
        <path d={`M ${300 - nk - 5} 212 L ${300 + nk + 5} 212`} stroke={light(o.top, 0.4)} strokeWidth={2.2} opacity={0.8} />
        <path d={`M ${300 - nk - 1} 205 L ${300 - nk - 1} 236`} stroke={shade(o.top, 0.3)} strokeWidth={2} opacity={0.7} />
        <path d={f ? 'M 230 372 Q 260 400 292 386 M 308 386 Q 340 400 370 372' : 'M 214 560 Q 250 572 280 566'} fill="none" stroke={crease} strokeWidth={2} strokeLinecap="round" opacity={0.35} />
      </g>
    );
  } else if (o.kind === 'vay-lien')
    // váy liền: cổ tròn có viền, thắt đai eo; phần váy là lowerBody 'vay' cùng màu áo
    detail = (
      <g>
        <path d="M 272 230 Q 300 270 328 230 Z" fill={skin} />
        <path d="M 270 229 Q 300 274 330 229" fill="none" stroke={light(o.top, 0.35)} strokeWidth={5} strokeLinecap="round" />
        <Two r={(p) => sp(p, f ? 'M 201 462 L 399 462 L 399 482 L 201 482 Z' : 'M 168 478 L 432 478 L 432 498 L 168 498 Z', shade(o.top, 0.28))} />
        <path d={f ? 'M 292 460 L 308 460 L 308 484 L 292 484 Z' : 'M 292 476 L 308 476 L 308 500 L 292 500 Z'} fill={light(o.top, 0.5)} stroke={shade(o.top, 0.4)} strokeWidth={1.6} />
        <path d={f ? 'M 236 488 Q 234 540 222 596 M 364 488 Q 366 540 378 596' : 'M 206 504 Q 204 556 194 600 M 394 504 Q 396 556 406 600'} fill="none" stroke={crease} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
      </g>
    );
  else if (o.kind === 'blazer-nu') {
    // blazer + áo blouse cổ tròn bên trong, một khuy ở eo
    const inner = '#F7F4EF';
    detail = (
      <g>
        <path d="M 266 228 L 300 420 L 334 228 Z" fill={inner} />
        <path d="M 280 230 Q 300 258 320 230 Z" fill={skin} />
        <path d="M 278 231 Q 300 262 322 231" fill="none" stroke={shade(inner, 0.18)} strokeWidth={2.4} />
        {wing('M 268 226 L 242 250 L 260 320 L 248 332 L 300 430 L 300 402 Z', shade(o.top, 0.1))}
        <path d={`M 300 430 Q 304 540 298 ${o.hemY}`} {...lineP} />
        <circle cx={307} cy={452} r={5.5} fill={shade(o.top, 0.42)} />
        <path d={f ? 'M 212 598 L 252 594 M 348 594 L 388 598' : 'M 200 600 L 244 596 M 356 596 L 400 600'} stroke={crease} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    );
  } else if (o.kind === 'ao-len') {
    // áo len cổ tròn: cổ, gấu bo len có sọc + hai đường vặn thừng mờ
    const rib = shade(o.top, 0.1);
    detail = (
      <g>
        <path d="M 272 230 Q 300 262 328 230 Z" fill={skin} />
        <Two r={(p) => sp(p, 'M 262 228 Q 300 286 338 228 L 326 229 Q 300 264 274 229 Z', rib)} />
        {[-24, -12, 0, 12, 24].map((x) => <path key={x} d={`M ${300 + x * 1.2} ${250 + Math.abs(x) * -0.6 + 12} l ${x * 0.08} 12`} stroke={shade(o.top, 0.3)} strokeWidth={1.6} opacity={0.6} />)}
        {[262, 338].map((x) => <path key={x} d={`M ${x} 300 ${Array.from({ length: 8 }, (_, i) => `q ${i % 2 ? 7 : -7} 20 0 40`).join(' ')}`} fill="none" stroke={shade(o.top, 0.22)} strokeWidth={2.4} opacity={0.4} />)}
        <path d={`M ${300 - o.hemW + 1} ${o.hemY - 24} L ${300 + o.hemW - 1} ${o.hemY - 24} L ${300 + o.hemW} ${o.hemY} L ${300 - o.hemW} ${o.hemY} Z`} fill={rib} />
        {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M ${300 - o.hemW + 10 + i * ((o.hemW * 2 - 20) / 14)} ${o.hemY - 21} l 0 18`} stroke={shade(o.top, 0.32)} strokeWidth={1.8} opacity={0.6} />)}
      </g>
    );
  } else if (o.kind === 'polo')
    // polo trơn (không logo): cổ bẻ + nẹp cùng màu áo, 2 khuy
    detail = (
      <g>
        <path d="M 274 230 L 300 282 L 326 230 Z" fill={skin} />
        <Two r={(p) => sp(p, 'M 291 278 L 309 278 L 309 362 Q 309 366 305 366 L 295 366 Q 291 366 291 362 Z', o.top)} />
        <circle cx={300} cy={304} r={3.2} fill={light(o.top, 0.6)} />
        <circle cx={300} cy={336} r={3.2} fill={light(o.top, 0.6)} />
        {wing('M 271 224 L 241 247 L 262 304 L 300 283 L 279 234 Z', light(o.top, 0.08))}
        <path d={`M ${300 - o.hemW + 4} ${o.hemY - 9} L ${300 + o.hemW - 4} ${o.hemY - 9}`} stroke={crease} strokeWidth={2} opacity={0.5} />
      </g>
    );
  else if (o.kind === 'ao-khoac') {
    // áo khoác bomber: cổ + gấu bo len sẫm, khoá kéo giữa, túi chéo hai bên
    const rib = shade(o.top, 0.3);
    detail = (
      <g>
        <path d="M 276 230 Q 300 250 324 230 Z" fill={skin} />
        <Two r={(p) => sp(p, 'M 260 226 Q 300 262 340 226 L 344 244 Q 300 284 256 244 Z', rib)} />
        {[-30, -15, 0, 15, 30].map((x) => <path key={x} d={`M ${300 + x} ${252 + Math.abs(x) * -0.3} l 0 12`} stroke={shade(o.top, 0.45)} strokeWidth={1.6} opacity={0.6} />)}
        <path d={`M 300 262 L 300 ${o.hemY - 24}`} stroke={shade(o.top, 0.4)} strokeWidth={6} />
        <path d={`M 300 262 L 300 ${o.hemY - 24}`} stroke="#C9CCD3" strokeWidth={2.4} strokeDasharray="3 4" />
        <rect x={295} y={276} width={10} height={20} rx={3} fill="#C9CCD3" stroke="#7A7F8A" strokeWidth={1.6} />
        <path d={f ? 'M 226 500 L 246 574 M 374 500 L 354 574' : 'M 206 502 L 230 580 M 394 502 L 370 580'} stroke={shade(o.top, 0.35)} strokeWidth={4} strokeLinecap="round" />
        <path d={`M ${300 - o.hemW + 1} ${o.hemY - 26} L ${300 + o.hemW - 1} ${o.hemY - 26} L ${300 + o.hemW - 4} ${o.hemY} L ${300 - o.hemW + 4} ${o.hemY} Z`} fill={rib} />
        {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M ${300 - o.hemW + 10 + i * ((o.hemW * 2 - 20) / 14)} ${o.hemY - 23} l 0 19`} stroke={shade(o.top, 0.45)} strokeWidth={1.8} opacity={0.6} />)}
      </g>
    );
  } else if (o.kind === 'dong-phuc')
    // đồng phục công việc chung (không phù hiệu, không cầu vai): đô vai sẫm, hai túi ngực nắp, bảng tên trống
    detail = (
      <g>
        <g clipPath={`url(#${uid}t)`}><path d="M 0 220 L 600 220 L 600 292 Q 300 306 0 292 Z" fill={shade(o.top, 0.2)} /></g>
        <path d="M 0 292 Q 300 306 600 292" clipPath={`url(#${uid}t)`} fill="none" stroke={shade(o.top, 0.36)} strokeWidth={2.2} />
        <path d="M 280 230 L 300 266 L 320 230 Z" fill={skin} />
        <path d={`M 300 266 L 300 ${o.hemY}`} stroke={crease} strokeWidth={2.4} opacity={0.8} />
        {[318, 380, 442, 504, 566].map((y) => <circle key={y} cx={306} cy={y} r={3} fill={shade(o.top, 0.36)} />)}
        {wing('M 272 224 L 247 241 L 266 286 L 300 266 L 280 232 Z', light(o.top, 0.12))}
        {[1, -1].map((s) => (
          <g key={s} transform={s < 0 ? 'translate(600 0) scale(-1 1)' : undefined}>
            <path d="M 222 336 L 272 334 L 273 382 Q 247 394 223 384 Z" {...lineP} stroke={crease} strokeWidth={2.2} />
            <Two r={(p) => sp(p, 'M 220 328 L 274 326 L 274 346 Q 247 352 220 348 Z', o.top)} />
          </g>
        ))}
        <rect x={330} y={300} width={40} height={16} rx={3} fill="#F7F8FA" stroke={shade(o.top, 0.36)} strokeWidth={1.6} />
      </g>
    );
  else if (o.kind === 'ao-so-mi-ke')
    // sơ mi kẻ ô, bỏ ngoài quần (pattern phủ ở dưới)
    detail = (
      <g>
        <path d="M 278 230 L 300 270 L 322 230 Z" fill={skin} />
        <path d={`M 300 270 L 300 ${o.hemY}`} stroke={shade(o.top, 0.3)} strokeWidth={2.6} opacity={0.8} />
        {[310, 362, 414, 466, 518, 570].map((y) => <circle key={y} cx={306} cy={y} r={3} fill={light(o.top, 0.7)} stroke={shade(o.top, 0.4)} strokeWidth={1} />)}
        {wing('M 272 224 L 247 241 L 266 288 L 300 268 L 280 232 Z', o.top)}
        <path d="M 336 330 L 384 327 L 385 366 Q 361 380 337 370 Z" {...lineP} stroke={shade(o.top, 0.36)} strokeWidth={2.2} />
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
      {o.pat && <path d={body} fill={`url(#${o.pat})`} />}
      {f && <path d="M 226 366 Q 256 404 292 382 M 308 382 Q 344 404 374 366" fill="none" stroke={crease} strokeWidth={2.4} strokeLinecap="round" opacity={0.5} />}
      {!f && o.kind !== 'vest' && o.kind !== 'ao-dai' && o.kind !== 'blazer-nu' && <path d="M 214 566 Q 248 580 276 572 M 326 574 Q 352 580 386 566" fill="none" stroke={crease} strokeWidth={2.2} strokeLinecap="round" opacity={0.45} />}
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
  face?: number; // nhân vật đang quay về phía nào TRÊN MÀN HÌNH để nói chuyện (+1 phải, −1 trái, 0 thẳng) → tay cử chỉ hướng về đó, tay kia gập trước bụng. Không truyền thì suy từ `look`.
  aim?: number; // đứng một mình lệch một bên: phía giữa khung hình (+1/−1) → cử chỉ một tay (chi, tay-mo…) quay vào trong, không gập tay kia
  walk?: number; // pha bước chân (khi pose = di-bo)
  ground?: number; // mascot: y khung nơi đặt chân (mặc định 1164 = sàn khi toàn thân; cảnh truyền theo khung máy / mép bàn — xem MASCOT_GROUND)
  style?: React.CSSProperties;
};

// Nhân vật: người (Human) hoặc mascot (kind 'mascot') — mọi cảnh gọi qua đây nên mascot dùng được như một diễn viên.
export const Person: React.FC<PersonProps> = (props) => (props.spec.kind === 'mascot' ? <Mascot {...props} /> : <Human {...props} />);

const Human: React.FC<PersonProps> = ({ spec, pose = 'dung', poseFrom, poseT = 1, expr, mouth = 0, frame = 0, look: lookS = 0, turn: turnS = 0, height, flip, face, aim, walk, style }) => {
  // `flip` lật ngang cả khung vẽ → mọi hướng tính theo màn hình phải đổi dấu, nếu không nhân vật lật sẽ nhìn/quay/đưa tay ngược phía
  const sx = flip ? -1 : 1;
  const look = lookS * sx, turn = turnS * sx;
  const faceDir = Math.sign(face ?? (Math.abs(lookS) > 0.3 ? lookS : 0)) * sx;
  const dir = faceDir || Math.sign(aim ?? 0) * sx;
  const uid = 'p' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const f = spec.gender === 'nu';
  const b = bodyOf(f);
  const O1 = orientPose(POSES[pose] ?? POSES.dung, dir, faceDir !== 0);
  const P1 = O1.pose;
  const blend = !!poseFrom && !!POSES[poseFrom] && poseT < 1 && poseFrom !== pose;
  const P0 = blend ? orientPose(POSES[poseFrom!], dir, faceDir !== 0).pose : P1;
  const t = blend ? Math.max(0, Math.min(1, poseT)) : 1;
  const te = t * t * (3 - 2 * t);
  const mixArm = (a0: ArmDef, b0: ArmDef): ArmDef => { const a = solveArm(a0, b), c = solveArm(b0, b); return { t: lerpV(a.t, c.t, te), e: lerpV(a.e!, c.e!, te), hand: t < 0.5 ? a.hand : c.hand }; };
  const P: PoseDef = { ...P1, L: mixArm(P0.L, P1.L), R: mixArm(P0.R, P1.R), shrug: lerp(P0.shrug ?? 0, P1.shrug ?? 0, te), lean: lerp(P0.lean ?? 0, P1.lean ?? 0, te), head: lerp(P0.head ?? 0, P1.head ?? 0, te) };
  const ek = EXPR_ALIAS[expr ?? ''] ?? expr ?? P1.expr;
  const E = EXPRS[ek] ?? EXPRS['binh-thuong'];
  const skin = spec.skin ?? '#F2C3A0';
  const hairC = spec.hairColor ?? '#2A1D18';
  const hair = spec.hair ?? (f ? 'dai' : 'ngan');
  const o = outfitOf(spec, f, `${uid}pk`);
  const seed = hash(spec.id);
  const period = 96 + (seed % 34);
  const blink = !useStill() && (frame + (seed % period)) % period < 4;
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
  // tay chính (R trong POSES; là L khi tư thế bị lật) lắc mạnh, tay còn lại của tư thế hai tay lắc nhẹ hơn
  const gMain = ['tay-mo', 'giai-thich', 'chi', 'nhun-vai'].includes(pose) ? gest : 0;
  const gSub = ['giai-thich', 'nhun-vai'].includes(pose) ? gest * 0.8 : 0;
  const wave = pose === 'chao' ? Math.sin(frame / 3.6) * 11 : 0;
  const flipped = O1.mirrored; // tư thế đã bị lật trái–phải

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
  const wK = b.wK * (o.wideLeg ? 1.14 : 1), wHem = b.wHem * (o.wideLeg ? 1.6 : 1); // áo dài: quần ống rộng
  // áo dài: thân áo chỉ tới eo → cạp quần kéo lên tới eo để chỗ xẻ tà hai bên hông lộ quần (không hở nền)
  const pelvis = o.wideLeg
    ? f ? 'M 202 478 L 398 478 C 408 520 414 560 414 588 L 418 690 L 300 714 L 182 690 L 186 588 C 186 560 192 520 202 478 Z' : 'M 172 494 L 428 494 C 424 540 420 570 420 590 L 424 692 L 300 718 L 176 692 L 180 590 C 180 570 176 540 172 494 Z'
    : f ? 'M 186 588 L 414 588 L 418 690 L 300 714 L 182 690 Z' : 'M 180 590 L 420 590 L 424 692 L 300 718 L 176 692 Z';
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
      <Two r={(p) => <>{sp(p, pelvis, o.bottom)}{LEGS.map(([H, K, A], i) => <React.Fragment key={i}>{sp(p, limb(H, K, b.wT, wK), o.bottom)}{sp(p, limb(K, [A[0], A[1] + 2], wK, wHem, true, false), o.bottom)}</React.Fragment>)}</>} />
      {LEGS.map(([H, K, A, dir], i) => (
        <g key={i}>
          <path d={shadeStrip(H, K, b.wT, wK, -dir)} fill={bShade} opacity={0.8} />
          <path d={shadeStrip(K, A, wK, wHem, -dir)} fill={bShade} opacity={0.8} />
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

  // áo dài: tà trước buông từ eo phủ trước quần, tà sau (sẫm hơn) lộ ra giữa hai ống quần; xẻ tà hai bên hông để lộ quần
  let flapBack: React.ReactNode = null, flapFront: React.ReactNode = null, flapSeam: React.ReactNode = null;
  if (o.kind === 'ao-dai') {
    const y0 = o.hemY - 24, y1 = f ? 1010 : 930, w1 = o.hemW - 9, w2 = o.hemW - 1;
    // che nét gấu thân áo ở eo: tà trước liền một mảnh với thân (không thành áo + váy)
    const wm = w1 + (w2 - w1) * (36 / (y1 - y0));
    flapSeam = <g><path d={`M ${300 - w1 + 1} ${o.hemY - 30} L ${300 + w1 - 1} ${o.hemY - 30} L ${300 + wm - 1} ${o.hemY + 12} L ${300 - wm + 1} ${o.hemY + 12} Z`} fill={o.top} /><path d={`M ${300 + w1 - 30} ${o.hemY - 30} L ${300 + w1 - 2} ${o.hemY - 30} L ${300 + wm - 2} ${o.hemY + 12} L ${300 + w1 - 28} ${o.hemY + 12} Z`} fill={o.topS} opacity={0.7} /></g>;
    const flap = (a: number, c: number, y: number) => `M ${300 - a} ${y0} L ${300 + a} ${y0} L ${300 + c} ${y - 14} Q ${300 + c} ${y} ${300 + c - 14} ${y} L ${300 - c + 14} ${y} Q ${300 - c} ${y} ${300 - c} ${y - 14} Z`;
    flapBack = <Two r={(p) => sp(p, flap(w1, w2 + 12, y1 - 6), shade(o.top, 0.2))} />;
    flapFront = (
      <g>
        <Two r={(p) => sp(p, flap(w1, w2, y1), o.top)} />
        <path d={`M ${300 + w1 - 30} ${y0} L ${300 + w2 - 22} ${y1 - 8} L ${300 + w2 - 2} ${y1 - 8} L ${300 + w1 - 2} ${y0} Z`} fill={o.topS} opacity={0.7} />
        <path d={`M ${300 - 34} ${y0 + 60} Q ${300 - 40} ${(y0 + y1) / 2} ${300 - 30} ${y1 - 20}`} fill="none" stroke={shade(o.top, 0.22)} strokeWidth={2.2} strokeLinecap="round" opacity={0.45} />
        {f && [[262, y1 - 120, 1], [300, y1 - 70, 0.8], [334, y1 - 150, 0.9]].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`} fill={light(o.top, 0.42)} opacity={0.9}>
            {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx={0} cy={-11} rx={7} ry={11} transform={`rotate(${a})`} />)}
            <circle r={5} fill={SHIRT.yellow} />
          </g>
        ))}
      </g>
    );
  }
  const shL: V = [300 - b.sh, b.shY - shrug], shR: V = [300 + b.sh, b.shY - shrug];
  // tư thế hai tay: tay phía gần người nghe lắc mạnh, tay phía xa (đang gập trước bụng) chỉ nhúc nhích
  const gL = gSub ? (dir < 0 ? gMain : -gSub * (dir > 0 ? 0.5 : 1)) : flipped ? gMain : 0;
  const gR = gSub ? (dir < 0 ? gSub * 0.5 : -gMain) : flipped ? 0 : -gMain;
  const armL = <Arm S={shL} def={P.L} side={1} skin={skin} o={o} b={b} wave={flipped ? -wave : 0} gesture={gL} />;
  const armR = <Arm S={shR} def={P.R} side={-1} skin={skin} o={o} b={b} wave={flipped ? 0 : wave} gesture={gR} />;
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
      {o.pat && (
        <defs>
          <pattern id={o.pat} width={46} height={46} patternUnits="userSpaceOnUse">
            <rect x={0} y={0} width={16} height={46} fill={shade(o.top, 0.5)} opacity={0.32} />
            <rect x={0} y={0} width={46} height={16} fill={shade(o.top, 0.5)} opacity={0.32} />
            <rect x={28} y={0} width={4} height={46} fill="#fff" opacity={0.35} />
            <rect x={0} y={28} width={46} height={4} fill="#fff" opacity={0.35} />
          </pattern>
        </defs>
      )}
      {flapBack}
      {lowerBody}
      {flapFront}
      <g transform={`translate(0 ${bodyY.toFixed(2)}) rotate(${lean.toFixed(2)} 300 ${HIP_Y})`}>
        {o.kind === 'hoodie' && <Two r={(p) => sp(p, 'M 214 258 C 196 188 250 146 300 146 C 350 146 404 188 386 258 Z', o.topS)} />}
        <g transform={headT}><Hair style={hair} c={hairC} layer="back" /></g>
        <Two r={(p) => sp(p, neck, skin)} />
        <path d={`M ${300 - nk} 176 L ${300 + nk} 176 L ${300 + nk} 204 Q 300 232 ${300 - nk} 204 Z`} fill={shade(skin, 0.17)} opacity={0.8} />
        <g transform={`translate(300 300) scale(1 ${(1 + breathe / 600).toFixed(4)}) translate(-300 -300)`}>
          <Torso o={o} f={f} skin={skin} logo={spec.logo !== false && o.kind === 'misa'} flip={!!flip} uid={uid} belly={!f && spec.age === 'trung-nien' ? 8 : 0} />
        </g>
        {flapSeam}
        {/* đầu */}
        <g transform={headT}>
          <Two r={(p) => <>{sp(p, ell(-earX - turn * 6, 18, 13, 25), skin, 'l')}{sp(p, ell(earX - turn * 6, 18, 13, 25), skin, 'r')}{sp(p, faceD, skin, 'f')}</>} />
          <path d={`M ${-earX - turn * 6 - 3} 8 q -6 10 2 22 M ${earX - turn * 6 + 3} 8 q 6 10 -2 22`} fill="none" stroke={mix(skin, '#7A3A26', 0.5)} strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
          <path d={f ? 'M 94 -16 C 94 30 84 66 55 97 C 38 115 19 122 0 122 C 32 104 64 70 74 6 Z' : 'M 97 -14 C 97 34 90 68 64 95 C 46 114 23 122 0 122 C 36 104 72 70 80 6 Z'} fill={shade(skin, 0.13)} opacity={0.5} />
          <g transform={`translate(${(turn * 8).toFixed(2)} 0)`}>
            <Face e={E} mouth={mouth} blink={blink} look={lk} female={f} skin={skin} brow={mix(hairC, '#000000', 0.1)} glasses={spec.glasses} uid={uid} age={spec.age} beard={spec.beard} frame={frame} />
          </g>
          <Hair style={hair} c={hairC} layer="front" skin={skin} />
        </g>
        {P.front === 'L' ? <>{armR}{armL}</> : <>{armL}{armR}</>}
      </g>
    </svg>
  );
};

// ════════════════════════════ MASCOT (kind 'mascot') ════════════════════════════
// Vẽ trong cùng khung 600×1200 với người nhưng THẤP HƠN: cao MASCOT_H × (ground + 14), chân đặt ở y = `ground` của khung.
// ground mặc định 1164 (sàn, toàn thân → cao ≈ 0,68 người). Cảnh trung/cận cảnh truyền MASCOT_GROUND[shot] để mascot không bị cắt mất nửa dưới;
// cảnh story truyền mép bàn → mascot đứng trên mặt bàn tiền cảnh như đồ vật trên bàn.
// mascot: 'khien' (khiên) · 'robot' (rô-bốt trợ lý) · 'anh' (ảnh PNG người dùng tải lên: spec.image = đường dẫn trong thư mục public).
// Biểu cảm lấy từ EXPRS (mắt/lông mày/miệng/má/mồ hôi/nước mắt), miệng mở theo `mouth` (nhép theo voice).
// Tư thế: vài cử chỉ tay đơn giản; tư thế khác đứng nghỉ. Tay cử chỉ viết ở bên phải khung (R) và tự lật khi quay sang trái (như orientPose).
export const MASCOT_H = 0.68;
export const MASCOT_GROUND: Record<Framing, number> = { 'toan-than': 1164, 'trung-canh': 780, 'can-canh': 455 };
export const mascotBox = (ground = 1164) => { const h = MASCOT_H * (ground + 14); return { top: ground - h, bottom: ground, h, head: ground - h * 0.55 }; };
export const MASCOT_LIST = ['khien', 'robot'];

type MHand = 'mitt' | 'open' | 'point' | 'thumb' | 'fist' | 'phone';
type MArm = { t: V; hand?: MHand }; // t = cổ tay so với vai, đơn vị khung mascot (cao 1000): [ra ngoài thân (+), xuống (+)]
type MPose = { L: MArm; R: MArm; shrug?: number; droop?: number; look?: [number, number]; bounce?: number };
const MREST: MArm = { t: [74, 198], hand: 'mitt' }; // tay buông hơi chếch ra ngoài để không lẫn vào viền thân
const MPOSES: Record<string, MPose> = {
  dung: { L: MREST, R: MREST },
  chao: { L: MREST, R: { t: [96, -150], hand: 'open' } },
  chi: { L: MREST, R: { t: [222, -24], hand: 'point' } },
  'tay-mo': { L: MREST, R: { t: [186, 74], hand: 'open' } },
  'giai-thich': { L: { t: [150, 100], hand: 'open' }, R: { t: [186, 64], hand: 'open' } },
  nghi: { L: MREST, R: { t: [-200, 40], hand: 'fist' } },
  vui: { L: MREST, R: { t: [60, -196], hand: 'fist' }, bounce: 1 },
  'ngac-nhien': { L: { t: [130, -70], hand: 'open' }, R: { t: [130, -70], hand: 'open' }, shrug: 14 },
  'khoanh-tay': { L: { t: [-160, 140], hand: 'fist' }, R: { t: [-160, 166], hand: 'fist' } },
  buon: { L: { t: [12, 224], hand: 'mitt' }, R: { t: [12, 224], hand: 'mitt' }, droop: 1 },
  'dien-thoai': { L: MREST, R: { t: [-150, 116], hand: 'phone' }, look: [0, 1] },
  'nghe-may': { L: MREST, R: { t: [-56, -116], hand: 'phone' } },
  'om-dau': { L: MREST, R: { t: [-40, -196], hand: 'open' } },
  'chong-nanh': { L: { t: [-24, 150], hand: 'fist' }, R: { t: [-24, 150], hand: 'fist' } },
  like: { L: MREST, R: { t: [150, -60], hand: 'thumb' } },
  'nhun-vai': { L: { t: [170, 40], hand: 'open' }, R: { t: [170, 40], hand: 'open' }, shrug: 22 },
  'di-bo': { L: MREST, R: MREST },
  'go-phim': { L: { t: [-70, 200], hand: 'mitt' }, R: { t: [-70, 200], hand: 'mitt' }, look: [0, 0.6] },
  'dat-tay': { L: MREST, R: MREST },
};
// rounded rect thành path (cho sp hai lượt)
const rr = (x: number, y: number, w: number, h: number, r: number) => `M ${x + r} ${y} L ${x + w - r} ${y} Q ${x + w} ${y} ${x + w} ${y + r} L ${x + w} ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} L ${x + r} ${y + h} Q ${x} ${y + h} ${x} ${y + h - r} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;

// ───── mặt mascot (gốc giữa hai mắt; mắt x ±100, lông mày y −64, miệng y 110)
const MFace: React.FC<{ e: ExprDef; mouth: number; blink: boolean; look: [number, number]; frame: number; ink: string; bg: string; mouthC: string; glow?: boolean; mouthY?: number }> = ({ e, mouth, blink, look, frame, ink, bg, mouthC, glow, mouthY = 110 }) => {
  const kind: Eye = blink && e.eye !== 'arc' ? 'closed' : e.eye;
  const eye = (cx: number, s: -1 | 1) => {
    if (kind === 'closed') return <path d={`M ${cx - 25} 2 Q ${cx} 16 ${cx + 25} 2`} fill="none" stroke={ink} strokeWidth={10} strokeLinecap="round" />;
    if (kind === 'smiley' || kind === 'arc') return <path d={`M ${cx - 26} 10 Q ${cx} ${kind === 'arc' ? -34 : -26} ${cx + 26} 10`} fill="none" stroke={ink} strokeWidth={12} strokeLinecap="round" />;
    const wide = kind === 'wide';
    const rx = wide ? 31 : 26, ry = wide ? 40 : 34;
    const ix = cx + look[0] * 12, iy = look[1] * 8 + (e.iris?.y ?? 0) * 1.2;
    const kc = kind === 'half' ? Math.min(e.lid?.kc ?? 1.3, 1.3) : e.lid?.kc ?? 2;
    const bias = e.lid?.bias ?? 0;
    const cover = Math.max(0, Math.min(0.62, (2 - kc) / 1.6));
    const base = iy - ry + 2 * ry * cover;
    const yIn = base + (bias > 0 ? ry * 0.5 * bias : 0), yOut = base + (bias < 0 ? ry * 0.5 * -bias : 0);
    const xIn = ix - s * (rx + 6), xOut = ix + s * (rx + 6);
    return (
      <g>
        <ellipse cx={ix} cy={iy} rx={rx} ry={ry} fill={ink} />
        <circle cx={ix + 9} cy={iy - 13} r={wide ? 11 : 9} fill="#fff" opacity={glow ? 0.85 : 1} />
        <circle cx={ix - 9} cy={iy + 12} r={4.5} fill="#fff" opacity={0.7} />
        {cover > 0.02 && (
          <>
            <path d={`M ${xIn} ${yIn} L ${xOut} ${yOut} L ${xOut} ${iy - ry - 24} L ${xIn} ${iy - ry - 24} Z`} fill={bg} />
            <path d={`M ${xIn + s * 4} ${yIn} L ${xOut - s * 4} ${yOut}`} stroke={ink} strokeWidth={7} strokeLinecap="round" />
          </>
        )}
      </g>
    );
  };
  const brow = (cx: number, s: -1 | 1, d: Side) => <path d={`M ${cx - s * 24} ${-66 + d[0] * 1.3} Q ${cx + s * 4} ${-78 + Math.min(d[0], d[1]) * 1.3} ${cx + s * 30} ${-62 + d[1] * 1.3}`} fill="none" stroke={ink} strokeWidth={10} strokeLinecap="round" />;
  const open = Math.max(0, Math.min(1, mouth));
  const y0 = mouthY;
  const D = (w: number, h: number, c = 0) => (
    <g>
      <path d={`M ${-w} ${y0 + c} Q 0 ${y0 - 4} ${w} ${y0 + c} Q ${w * 0.8} ${y0 + c + h * 1.3} 0 ${y0 + c + h * 1.35} Q ${-w * 0.8} ${y0 + c + h * 1.3} ${-w} ${y0 + c} Z`} fill={mouthC} stroke={ink} strokeWidth={glow ? 0 : 5} strokeLinejoin="round" />
      {h > 14 && <ellipse cx={0} cy={y0 + c + h * 1.05} rx={w * 0.45} ry={h * 0.26} fill={TONGUE} />}
    </g>
  );
  const ln = (d: string, w = 9) => <path d={d} fill="none" stroke={ink} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
  let m: React.ReactNode;
  if (open > 0.06) {
    const h = 10 + open * 40;
    m = e.talk === 'up' ? D(36, h, -6) : e.talk === 'square' ? D(32, h * 0.85) : <ellipse cx={0} cy={y0 + h * 0.55} rx={22 + open * 6} ry={h * 0.6} fill={mouthC} stroke={ink} strokeWidth={glow ? 0 : 5} />;
  } else {
    switch (e.mouth) {
      case 'smile': m = ln(`M -34 ${y0} Q 0 ${y0 + 30} 34 ${y0}`); break;
      case 'grin': m = D(38, 22, -6); break;
      case 'laugh': m = D(44, 32 + Math.abs(Math.sin(frame / 2.6)) * 6, -8); break;
      case 'frown': m = ln(`M -28 ${y0 + 18} Q 0 ${y0 - 6} 28 ${y0 + 18}`); break;
      case 'cry': m = <ellipse cx={0} cy={y0 + 14} rx={24} ry={16 + Math.abs(Math.sin(frame / 3)) * 4} fill={mouthC} stroke={ink} strokeWidth={glow ? 0 : 5} />; break;
      case 'grit': m = <g><rect x={-32} y={y0 - 6} width={64} height={24} rx={8} fill="#fff" stroke={ink} strokeWidth={6} /><path d={`M -30 ${y0 + 6} L 30 ${y0 + 6}`} stroke={ink} strokeWidth={3} /></g>; break;
      case 'o': m = <ellipse cx={0} cy={y0 + 10} rx={15} ry={19} fill={mouthC} stroke={ink} strokeWidth={glow ? 0 : 5} />; break;
      case 'wavy': m = ln(`M -30 ${y0 + 6} Q -22 ${y0 - 4} -15 ${y0 + 6} Q -8 ${y0 + 16} 0 ${y0 + 6} Q 8 ${y0 - 4} 15 ${y0 + 6} Q 22 ${y0 + 16} 30 ${y0 + 6}`, 8); break;
      case 'side': m = ln(`M -20 ${y0 + 6} Q 4 ${y0 + 10} 26 ${y0 - 4}`); break;
      case 'smirk': m = ln(`M -26 ${y0 + 2} Q 0 ${y0 + 14} 30 ${y0 - 10}`); break;
      case 'sly': m = D(30, 14, -6); break;
      case 'worried': m = ln(`M -24 ${y0 + 6} Q -12 ${y0 - 4} 0 ${y0 + 4} Q 12 ${y0 + 12} 24 ${y0 + 2}`, 8); break;
      default: m = ln(`M -22 ${y0 + 4} Q 0 ${y0 + 9} 22 ${y0 + 4}`);
    }
  }
  const ex = e.extra ?? [];
  const tY = (frame % 36) / 36;
  const tear = (x: number, t: number) => <path d={`M ${x} ${36 + t * 70} q -11 17 0 24 q 11 -7 0 -24 Z`} fill="#8FD0FF" stroke="#4C9BD6" strokeWidth={3} opacity={1 - t * 0.6} />;
  return (
    <g>
      {(e.blush ?? 0) > 0 && <g fill="#F2787C" opacity={Math.min(0.7, (e.blush ?? 0) * 1.6)}><ellipse cx={-126} cy={58} rx={28} ry={14} /><ellipse cx={126} cy={58} rx={28} ry={14} /></g>}
      {ex.includes('red') && <g fill="#FF4B3E" opacity={0.3}><ellipse cx={-126} cy={56} rx={32} ry={16} /><ellipse cx={126} cy={56} rx={32} ry={16} /></g>}
      {brow(-100, -1, e.brow.L)}
      {brow(100, 1, e.brow.R)}
      {eye(-100, -1)}
      {eye(100, 1)}
      {m}
      {(ex.includes('tear') || ex.includes('tears')) && <g>{tear(-110, tY)}{ex.includes('tears') && tear(110, (tY + 0.5) % 1)}</g>}
      {ex.includes('sweat') && <path d="M 170 -96 q -16 26 0 36 q 16 -10 0 -36 Z" fill="#A6DDFF" stroke="#4C9BD6" strokeWidth={3} />}
      {ex.includes('vein') && <g stroke="#E2342B" strokeWidth={7} strokeLinecap="round" fill="none"><path d="M 150 -150 q 12 9 0 21" /><path d="M 168 -158 q -9 12 7 18" /></g>}
      {ex.includes('lines') && <g stroke={glow ? ink : '#3A3F4B'} strokeWidth={8} strokeLinecap="round"><path d="M -150 -150 L -170 -180" /><path d="M 0 -170 L 0 -204" /><path d="M 150 -150 L 170 -180" /></g>}
    </g>
  );
};

// ───── bàn tay mascot (găng tròn): gốc cổ tay, +y theo cẳng tay; tx = phía ngón cái (cố định theo tay)
const mHand = (kind: MHand, tx: number): string[] => {
  const thumb = limb([tx * 22, 16], [tx * 40, 36], 22, 18);
  if (kind === 'open') return [ell(-19, 66, 11, 15), ell(0, 72, 11, 16), ell(19, 66, 11, 15), ell(0, 34, 35, 38), thumb];
  if (kind === 'fist' || kind === 'phone' || kind === 'thumb') return [ell(0, 28, 32, 32)];
  if (kind === 'point') return [limb([0, 40], [0, 100], 21, 19), ell(0, 28, 32, 32)];
  return [ell(0, 32, 33, 37), thumb];
};

type MStyle = { sh: V; a: number; b: number; w: number; armC: string; handC: string; hk: number };
const MArmG: React.FC<{ S: V; def: MArm; s: -1 | 1; st: MStyle; rot: number }> = ({ S, def, s, st, rot }) => {
  const T: V = [S[0] + s * def.t[0], S[1] + def.t[1]];
  const Ea = ik(S, T, st.a, st.b, 1), Eb = ik(S, T, st.a, st.b, -1);
  const E = s * Ea[0] > s * Eb[0] ? Ea : Eb; // khuỷu chĩa ra ngoài thân
  const a0 = ang(E, T) + rot;
  const W: V = [E[0] - Math.sin(rad(a0)) * st.b, E[1] + Math.cos(rad(a0)) * st.b];
  const hand = def.hand ?? 'mitt';
  return (
    <>
      <Two r={(p) => <>{sp(p, limb(S, E, st.w, st.w * 0.94), st.armC, 'u')}{sp(p, limb(E, W, st.w * 0.94, st.w * 0.86), st.armC, 'f')}</>} />
      <g transform={`translate(${W[0].toFixed(1)} ${W[1].toFixed(1)}) rotate(${a0.toFixed(1)}) scale(${st.hk})`}>
        {hand === 'phone' && (
          <g transform={`rotate(${-a0} 0 30)`}>
            <Two r={(p) => sp(p, rr(-30, -26, 60, 108, 12), '#20232B')} />
            <rect x={-23} y={-18} width={46} height={88} rx={6} fill="#5CC0F8" />
            <rect x={-23} y={-18} width={46} height={18} rx={6} fill="#B5E4FF" />
          </g>
        )}
        <Two r={(p) => mHand(hand, -s).map((d, i) => sp(p, d, st.handC, i))} />
      </g>
      {hand === 'thumb' && <Two r={(p) => sp(p, limb([W[0], W[1] + 6], [W[0], W[1] - 56 * st.hk], 26 * st.hk, 22 * st.hk), st.handC)} />}
    </>
  );
};

const KHIEN = { navy: '#1F3B73', yellow: SHIRT.yellow, yShade: '#E3B90C', red: SHIRT.red };
const VectorMascot: React.FC<PersonProps> = ({ spec, pose = 'dung', expr, mouth = 0, frame = 0, look: lookS = 0, turn: turnS = 0, height, flip, face, aim, walk, ground = 1164, style }) => {
  const uid = 'm' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = spec.mascot === 'robot' ? 'robot' : 'khien';
  const sx = flip ? -1 : 1;
  const look = lookS * sx, turn = turnS * sx;
  const faceDir = Math.sign(face ?? (Math.abs(lookS) > 0.3 ? lookS : 0)) * sx;
  const dir = faceDir || Math.sign(aim ?? 0) * sx;
  const P0 = MPOSES[pose] ?? MPOSES.dung;
  const mirrored = dir < 0; // tay cử chỉ (R) chuyển sang phía người nghe bên trái
  const P: MPose = mirrored ? { ...P0, L: P0.R, R: P0.L, look: P0.look && [-P0.look[0], P0.look[1]] } : P0;
  const ek = EXPR_ALIAS[expr ?? ''] ?? expr ?? (POSES[pose]?.expr ?? 'cuoi');
  const E = EXPRS[ek] ?? EXPRS['binh-thuong'];
  const seed = hash(spec.id);
  const period = 96 + (seed % 34);
  const blink = !useStill() && (frame + (seed % period)) % period < 4;
  const talking = mouth > 0.06;
  // chuyển động: nhún nhẹ khi đứng, nảy khi nói, theo biểu cảm
  let bob = Math.sin(frame / 15 + seed) * 9 + (talking ? -Math.abs(Math.sin(frame / 3.2)) * 10 * Math.min(1, mouth * 1.5) : 0);
  let tilt = (E.tilt ?? 0) * 0.7 + (talking ? Math.sin(frame / 3.6) * 1.8 : Math.sin(frame / 40 + seed) * 1);
  let hx = 0;
  if (E.motion === 'laugh' || P.bounce) bob -= Math.abs(Math.sin(frame / 2.8)) * 18;
  if (E.motion === 'shake') hx = Math.sin(frame * 1.9) * 5;
  if (E.motion === 'tremble') hx = Math.sin(frame * 2.7) * 3;
  if (P.droop) { bob += 14; tilt += 3; }
  const breath = 1 + Math.sin(frame / 15 + seed) * 0.012 + (talking ? mouth * 0.02 : 0);
  const shrug = P.shrug ?? 0;
  const gest = talking ? Math.sin(frame / 5.5 + seed) * 10 * Math.min(1, mouth * 1.6) : 0;
  const wave = pose === 'chao' ? Math.sin(frame / 3.6) * 14 : 0;
  const gestR = ['tay-mo', 'giai-thich', 'chi', 'nhun-vai'].includes(pose) ? gest : 0;
  const rotR = mirrored ? 0 : wave - gestR, rotL = mirrored ? -wave + gestR : 0;
  const lk: [number, number] = [P.look?.[0] ?? look, P.look?.[1] ?? 0];
  // bước chân khi di-bo
  const ph = (walk ?? frame / 7) % (Math.PI * 2);
  const lift = (s: number) => (pose === 'di-bo' ? Math.max(0, Math.sin(ph) * s) * 30 : 0);

  const box = mascotBox(ground);
  const sc = box.h / 1000;
  const w = height * 0.5;
  const st: MStyle = id === 'robot' ? { sh: [196, -470], a: 116, b: 110, w: 52, armC: '#C9CEDA', handC: '#2B3A63', hk: 1.15 } : { sh: [300, -640], a: 120, b: 114, w: 58, armC: KHIEN.navy, handC: '#FFFFFF', hk: 1.3 };
  const SL: V = [-st.sh[0], st.sh[1] - shrug], SR: V = [st.sh[0], st.sh[1] - shrug];
  const arms = (
    <>
      <MArmG S={SL} def={P.L} s={-1} st={st} rot={rotL} />
      <MArmG S={SR} def={P.R} s={1} st={st} rot={rotR} />
    </>
  );
  let body: React.ReactNode, faceEl: React.ReactNode;
  if (id === 'robot') {
    const white = '#F4F6FA', grey = '#C9CEDA', screen = '#1E2A4A', glow = '#FFD84A';
    body = (
      <g>
        {[-1, 1].map((s) => <Two key={s} r={(p) => <>{sp(p, limb([s * 82, -210], [s * 86, -52], 56, 52), grey)}{sp(p, ell(s * 94, -30 - lift(s), 64, 30), KHIEN.navy)}</>} />)}
        <Two r={(p) => <>{sp(p, rr(-195, -535, 390, 350, 120), white, 'b')}{sp(p, rr(-50, -580, 100, 60, 16), grey, 'n')}</>} />
        <path d="M -150 -300 Q 0 -250 150 -300" fill="none" stroke={grey} strokeWidth={6} strokeLinecap="round" />
        <Two r={(p) => sp(p, rr(-92, -470, 184, 124, 34), KHIEN.yellow)} />
        <circle cx={0} cy={-408} r={40} fill={KHIEN.navy} />
        <path d="M -20 -408 L -6 -392 L 22 -424" fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
        {[-1, 1].map((s) => <circle key={s} cx={s * 196} cy={-470 - shrug} r={30} fill="#AEB5C6" stroke={ol('#AEB5C6')} strokeWidth={LW * 2} />)}
        <path d="M 0 -900 L 0 -968" stroke="#8C93A6" strokeWidth={12} strokeLinecap="round" />
        <circle cx={0} cy={-982} r={24} fill={KHIEN.yellow} stroke={ol(KHIEN.yellow)} strokeWidth={LW * 2} />
        {[-1, 1].map((s) => <Two key={'e' + s} r={(p) => sp(p, ell(s * 258, -735, 34, 46), KHIEN.yellow)} />)}
        <Two r={(p) => sp(p, rr(-250, -905, 500, 345, 130), white)} />
        <path d={rr(-250, -905, 500, 345, 130)} fill={grey} opacity={0.35} transform="translate(26 0)" clipPath={`url(#${uid}h)`} />
        <clipPath id={`${uid}h`}><path d={rr(-250, -905, 500, 345, 130)} /></clipPath>
        <Two r={(p) => sp(p, rr(-205, -872, 410, 272, 96), screen)} />
        <path d="M -150 -838 Q -60 -856 40 -846" fill="none" stroke="#fff" strokeWidth={10} strokeLinecap="round" opacity={0.18} />
      </g>
    );
    faceEl = <g transform={`translate(${(turn * 22).toFixed(1)} -768) scale(0.95)`}><MFace e={E} mouth={mouth} blink={blink} look={lk} frame={frame} ink={glow} bg={screen} mouthC={glow} glow mouthY={84} /></g>;
  } else {
    const OUTER = 'M 0 -985 C 120 -985 240 -955 330 -905 C 342 -780 340 -650 322 -540 C 290 -360 160 -230 0 -150 C -160 -230 -290 -360 -322 -540 C -340 -650 -342 -780 -330 -905 C -240 -955 -120 -985 0 -985 Z';
    const INNER = 'M 0 -945 C 110 -945 215 -918 294 -876 C 304 -770 302 -655 286 -556 C 258 -398 146 -282 0 -206 C -146 -282 -258 -398 -286 -556 C -302 -655 -304 -770 -294 -876 C -215 -918 -110 -945 0 -945 Z';
    body = (
      <g>
        {[-1, 1].map((s) => <Two key={s} r={(p) => <>{sp(p, limb([s * 92, -260], [s * 96, -46], 64, 58), KHIEN.navy)}{sp(p, ell(s * 106, -28 - lift(s), 66, 30), KHIEN.red)}</>} />)}
        {[-1, 1].map((s) => <path key={'so' + s} d={`M ${s * 106 - 60} ${-14 - lift(s)} Q ${s * 106} ${-2 - lift(s)} ${s * 106 + 60} ${-14 - lift(s)}`} fill="none" stroke="#fff" strokeWidth={7} strokeLinecap="round" opacity={0.85} />)}
        <Two r={(p) => sp(p, OUTER, KHIEN.navy)} />
        <path d={INNER} fill={KHIEN.yShade} />
        <clipPath id={`${uid}i`}><path d={INNER} /></clipPath>
        <path d={INNER} fill={KHIEN.yellow} transform="translate(-26 4)" clipPath={`url(#${uid}i)`} />
        <path d="M -246 -862 Q -196 -904 -120 -918" fill="none" stroke="#fff" strokeWidth={18} strokeLinecap="round" opacity={0.55} />
        <path d="M -46 -350 L -14 -318 L 50 -386" fill="none" stroke={KHIEN.navy} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
    faceEl = <g transform={`translate(${(turn * 30).toFixed(1)} -730) scale(1.5)`}><MFace e={E} mouth={mouth} blink={blink} look={lk} frame={frame} ink="#1B1D2E" bg={KHIEN.yellow} mouthC={MOUTH} /></g>;
  }
  return (
    <svg viewBox="0 0 600 1200" width={w} height={height} style={{ overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined, ...style }}>
      <g transform={`translate(${300 + hx} ${ground}) scale(${sc.toFixed(4)})`}>
        <ellipse cx={0} cy={4} rx={id === 'robot' ? 230 : 250} ry={22} fill="#000" opacity={0.16} />
        <g transform={`translate(0 ${bob.toFixed(1)}) rotate(${tilt.toFixed(2)} 0 0) scale(1 ${breath.toFixed(4)})`}>
          {body}
          {faceEl}
          {arms}
        </g>
      </g>
    </svg>
  );
};

// Mascot là ảnh PNG người dùng tải lên (nền trong): giữ tỉ lệ, đáy ảnh đặt ở `ground`, nhún nhẹ; khi nói co–giãn nhẹ để thấy đang nói.
// Quay mặt: ảnh coi như nhìn sang phải; quay về người nghe bên trái thì lật ngang (hoặc `flip`).
const ImageMascot: React.FC<PersonProps> = ({ spec, mouth = 0, frame = 0, height, flip, face, aim, ground = 1164, style }) => {
  const box = mascotBox(ground);
  const w = height * 0.5, k = height / 1200;
  const seed = hash(spec.id);
  const m = Math.max(0, Math.min(1, mouth));
  const talk = m > 0.06 ? m : 0;
  const bob = Math.sin(frame / 15 + seed) * 6 - (talk ? Math.abs(Math.sin(frame / 3.2)) * 8 * Math.min(1, talk * 1.5) : 0);
  const sy = 1 + Math.sin(frame / 15 + seed) * 0.01 + talk * 0.06, sxk = 1 - talk * 0.035;
  const screenDir = Math.sign(face ?? aim ?? 0);
  const mir = !flip && screenDir < 0 ? -1 : 1; // flip đã lật cả khối ngoài
  const bw = box.h * 0.95;
  return (
    <div style={{ position: 'relative', width: w, height, overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined, ...style }}>
      <svg viewBox="0 0 600 1200" width={w} height={height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <ellipse cx={300} cy={ground + 4} rx={box.h * 0.28} ry={box.h * 0.025} fill="#000" opacity={0.16} />
      </svg>
      <div style={{ position: 'absolute', left: (300 - bw / 2) * k, top: box.top * k, width: bw * k, height: box.h * k, transformOrigin: '50% 100%', transform: `translateY(${(bob * k).toFixed(2)}px) scale(${(mir * sxk).toFixed(4)}, ${sy.toFixed(4)})` }}>
        <Img src={staticFile((spec.image ?? '').replace(/^\/+/, ''))} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: '50% 100%', display: 'block' }} />
      </div>
    </div>
  );
};

const Mascot: React.FC<PersonProps> = (props) => (props.spec.mascot === 'anh' && props.spec.image ? <ImageMascot {...props} /> : <VectorMascot {...props} />);

// Tương thích tên cũ
export const MisaCharacter = Person;
export { MISA_LOGO_RATIO };
