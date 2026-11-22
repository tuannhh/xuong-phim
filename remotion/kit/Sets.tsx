import React, { useId } from 'react';
import { MisaLogo, MISA_LOGO_RATIO } from './MisaLogo';
import { SETS } from '../../shared/catalog.mjs';

// Bối cảnh nhiều lớp cho cảnh `story` — vẽ vector trong "thế giới" 1080×1920 (dư 200 hai bên để máy quay lia/phóng).
// Mỗi bối cảnh có 3 lớp: SetBack (tường, cửa kính, thành phố, đồ đạc) → SetMid (bàn phía sau che nửa người phụ + sương mù tách lớp)
// → [nhân vật chính] → SetFront (mặt bàn tiền cảnh, nơi đặt phụ đề). Mép bàn tiền cảnh luôn ở y = WORLD.deskY.
// set + time: danh mục ở shared/catalog.mjs (SETS — buổi đầu tiên là mặc định). Thêm bối cảnh = thêm mục SETS + vẽ ở đây (BACK, FRONT,
// DressNew, SEATS nếu cần ghế) — id phải khớp. Vùng thấy được ở cỡ toàn: x 0..1080; dải trên y < 400 bên trái bị khung tên tập che;
// mặt nhân vật ngồi ở y ≈ 560–760 quanh x 0.29/0.71 — giữ phía sau mặt yên, không chi tiết rối.
export const WORLD = { W: 1080, H: 1920, bleed: 200, deskY: 1170 };
const X0 = -WORLD.bleed, XW = WORLD.W + WORLD.bleed * 2;

const rnd = (seed: number) => { let s = seed % 2147483647 || 1; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; };

const Skyline: React.FC<{ seed: number; x0: number; x1: number; base: number; h: [number, number]; w: [number, number]; fill: string; dot?: string; lit?: string; litP?: number }> = ({ seed, x0, x1, base, h, w, fill, dot, lit, litP = 0 }) => {
  const r = rnd(seed);
  const out: React.ReactNode[] = [];
  let x = x0, i = 0;
  while (x < x1) {
    const bw = w[0] + r() * (w[1] - w[0]), bh = h[0] + r() * (h[1] - h[0]), cap = r();
    out.push(<rect key={`b${i}`} x={x} y={base - bh} width={bw} height={bh} fill={fill} />);
    if (cap > 0.62) out.push(<rect key={`c${i}`} x={x + bw * 0.3} y={base - bh - 22} width={bw * 0.4} height={22} fill={fill} />);
    if (cap > 0.86) out.push(<rect key={`a${i}`} x={x + bw * 0.48} y={base - bh - 62} width={5} height={40} fill={fill} />);
    if (dot)
      for (let yy = base - bh + 18; yy < base - 14; yy += 30)
        for (let xx = x + 10; xx < x + bw - 12; xx += 20) {
          const on = r() < litP;
          out.push(<rect key={`d${i}-${xx.toFixed(0)}-${yy.toFixed(0)}`} x={xx} y={yy} width={9} height={14} fill={on ? lit : dot} opacity={on ? 0.95 : 0.4} />);
        }
    x += bw + r() * 10;
    i++;
  }
  return <g>{out}</g>;
};

const Cloud: React.FC<{ x: number; y: number; k: number; fill: string; o?: number }> = ({ x, y, k, fill, o = 0.9 }) => (
  <g transform={`translate(${x} ${y}) scale(${k})`} fill={fill} opacity={o}>
    <ellipse cx={0} cy={0} rx={90} ry={26} /><ellipse cx={-36} cy={-18} rx={44} ry={28} /><ellipse cx={26} cy={-26} rx={54} ry={36} /><ellipse cx={74} cy={-8} rx={40} ry={22} />
  </g>
);

const Plant: React.FC<{ x: number; y: number; k?: number; pot?: string }> = ({ x, y, k = 1, pot = '#D9774B' }) => (
  <g transform={`translate(${x} ${y}) scale(${k})`}>
    {[[-44, -150, -24], [0, -196, 0], [44, -150, 24], [-22, -116, -40], [24, -116, 40], [-64, -100, -58], [64, -100, 58]].map(([px, py, rot], i) => (
      <ellipse key={i} cx={px} cy={py} rx={24} ry={72} fill={i % 2 ? '#3E8E5A' : '#57B077'} transform={`rotate(${rot} ${px} ${py})`} />
    ))}
    <path d="M -50 -72 L 50 -72 L 38 0 L -38 0 Z" fill={pot} />
    <rect x={-56} y={-84} width={112} height={18} rx={6} fill={pot} />
    <rect x={-56} y={-70} width={112} height={5} fill="#000" opacity={0.12} />
  </g>
);

// ════════════ VĂN PHÒNG ════════════
const OFFICE: Record<string, { sky: [string, string]; far: string; near: string; dot: string; lit: string; litP: number; wall: [string, string]; pillar: string; ceil: string; floor: string; cloud: string; cab: string; haze: string }> = {
  ngay: { sky: ['#7FC1F0', '#E3F4FD'], far: '#B4CCE2', near: '#86A4C4', dot: '#E9F4FC', lit: '#fff', litP: 0, wall: ['#F3EADB', '#E6D9C3'], pillar: '#DCCDB3', ceil: '#F8F4EA', floor: '#93A3B6', cloud: '#FFFFFF', cab: '#D9C8AC', haze: 'rgba(238,244,250,.16)' },
  chieu: { sky: ['#F47F4E', '#FFD890'], far: '#D98A66', near: '#96503F', dot: '#FFD9A0', lit: '#FFF1B8', litP: 0.3, wall: ['#F5E1C8', '#E9CBA6'], pillar: '#DDB98F', ceil: '#F9EAD6', floor: '#9C8B86', cloud: '#FFE7C6', cab: '#D2B088', haze: 'rgba(255,170,90,.14)' },
  toi: { sky: ['#0E1533', '#2C3A70'], far: '#1E2955', near: '#131A3B', dot: '#27325F', lit: '#FFD76A', litP: 0.5, wall: ['#666C88', '#50556E'], pillar: '#4A4F68', ceil: '#727894', floor: '#3C4258', cloud: '#34406E', cab: '#444A62', haze: 'rgba(18,22,60,.22)' },
};

const OfficeBack: React.FC<{ time: string; frame: number; logo?: boolean; id: string }> = ({ time, frame, logo, id }) => {
  const P = OFFICE[time] ?? OFFICE.ngay;
  const drift = frame * 0.1;
  const sec = (frame / 30) * 6;
  const clock = { x: 936, y: logo ? 590 : 430, r: 50 };
  return (
    <g>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.sky[0]} /><stop offset="1" stopColor={P.sky[1]} /></linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.wall[0]} /><stop offset="1" stopColor={P.wall[1]} /></linearGradient>
        <clipPath id={`${id}c`}><rect x={X0} y={300} width={960} height={700} /></clipPath>
      </defs>
      {/* trần + đèn */}
      <rect x={X0} y={0} width={XW} height={300} fill={P.ceil} />
      {[100, 540, 980].map((x) => (
        <g key={x}>
          {time !== 'ngay' && <ellipse cx={x} cy={196} rx={230} ry={70} fill="#FFF3C4" opacity={0.3} />}
          <path d={`M ${x - 120} 150 L ${x + 120} 150 L ${x + 150} 194 L ${x - 150} 194 Z`} fill={time === 'ngay' ? '#FFFFFF' : '#FFF6D2'} />
          <path d={`M ${x - 150} 194 L ${x + 150} 194 L ${x + 150} 202 L ${x - 150} 202 Z`} fill="#000" opacity={0.1} />
        </g>
      ))}
      <rect x={X0} y={262} width={XW} height={38} fill={P.pillar} />
      <rect x={X0} y={294} width={XW} height={6} fill="#000" opacity={0.12} />
      {/* ngoài cửa kính: trời, mây, thành phố hai lớp */}
      <g clipPath={`url(#${id}c)`}>
        <rect x={X0} y={300} width={960} height={700} fill={`url(#${id}s)`} />
        {time === 'chieu' && <g><circle cx={470} cy={800} r={170} fill="#FFE9A8" opacity={0.35} /><circle cx={470} cy={800} r={92} fill="#FFF4CF" /></g>}
        {time === 'toi' && <g><circle cx={560} cy={420} r={70} fill="#FFF4C2" opacity={0.18} /><circle cx={560} cy={420} r={40} fill="#FFF6D0" /></g>}
        <Cloud x={-140 + (drift % 1200)} y={410} k={1.25} fill={P.cloud} />
        <Cloud x={300 + ((drift * 0.6) % 900)} y={500} k={0.8} fill={P.cloud} o={0.75} />
        <Cloud x={-600 + ((drift * 0.8) % 1500)} y={360} k={0.95} fill={P.cloud} o={0.8} />
        <Skyline seed={7} x0={X0} x1={770} base={1000} h={[230, 480]} w={[70, 130]} fill={P.far} />
        <Skyline seed={41} x0={X0} x1={770} base={1000} h={[110, 330]} w={[80, 150]} fill={P.near} dot={P.dot} lit={P.lit} litP={P.litP} />
        <path d="M -40 300 L 120 300 L -120 1000 L -200 1000 Z M 330 300 L 400 300 L 160 1000 L 90 1000 Z M 640 300 L 700 300 L 460 1000 L 400 1000 Z" fill="#fff" opacity={0.09} />
      </g>
      {/* khung cửa kính */}
      {[-212, 108, 428].map((x) => <rect key={x} x={x} y={300} width={26} height={700} fill={P.pillar} />)}
      <rect x={X0} y={434} width={960} height={10} fill={P.pillar} />
      {/* mảng tường bên phải: logo / đồng hồ / kệ hồ sơ */}
      <rect x={748} y={300} width={XW} height={700} fill={`url(#${id}w)`} />
      <rect x={748} y={300} width={30} height={700} fill={P.pillar} />
      <rect x={778} y={300} width={8} height={700} fill="#000" opacity={0.06} />
      {logo && (
        <g transform="translate(812 346)">
          <rect width={250} height={132} rx={10} fill="#fff" stroke={P.pillar} strokeWidth={7} />
          <g transform={`translate(22 ${(132 - 206 * MISA_LOGO_RATIO) / 2})`}><MisaLogo width={206} /></g>
        </g>
      )}
      <g>
        <circle cx={clock.x} cy={clock.y} r={clock.r + 7} fill="#3A3F4B" />
        <circle cx={clock.x} cy={clock.y} r={clock.r} fill="#FBFBF8" />
        {Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return <line key={i} x1={clock.x + Math.sin(a) * clock.r * 0.76} y1={clock.y - Math.cos(a) * clock.r * 0.76} x2={clock.x + Math.sin(a) * clock.r * 0.9} y2={clock.y - Math.cos(a) * clock.r * 0.9} stroke="#3A3F4B" strokeWidth={3} />; })}
        <line x1={clock.x} y1={clock.y} x2={clock.x} y2={clock.y - clock.r * 0.5} stroke="#3A3F4B" strokeWidth={6} strokeLinecap="round" transform={`rotate(${time === 'ngay' ? 5 : time === 'chieu' ? 165 : 250} ${clock.x} ${clock.y})`} />
        <line x1={clock.x} y1={clock.y} x2={clock.x} y2={clock.y - clock.r * 0.74} stroke="#3A3F4B" strokeWidth={4} strokeLinecap="round" transform={`rotate(${90 + sec / 60} ${clock.x} ${clock.y})`} />
        <line x1={clock.x} y1={clock.y + 10} x2={clock.x} y2={clock.y - clock.r * 0.8} stroke="#E2342B" strokeWidth={2} transform={`rotate(${sec} ${clock.x} ${clock.y})`} />
      </g>
      <g transform="translate(806 760)">
        {[['#E2574C', 34, 104], ['#3E7BD6', 30, 116], ['#F2B93B', 36, 98], ['#4FA86C', 30, 110], ['#8E6CC9', 34, 102], ['#5B6474', 30, 114]].map(([c, w, h], i) => <g key={i}><rect x={i * 38} y={-(h as number)} width={w as number} height={h as number} rx={4} fill={c as string} /><rect x={i * 38 + 8} y={-(h as number) + 16} width={(w as number) - 16} height={22} rx={3} fill="#fff" opacity={0.8} /></g>)}
        <rect x={-14} y={0} width={270} height={14} rx={4} fill={P.cab} />
        <rect x={-14} y={14} width={270} height={6} fill="#000" opacity={0.12} />
      </g>
      {/* tủ thấp chân cửa kính + sàn */}
      <rect x={X0} y={1000} width={XW} height={94} fill={P.cab} />
      <rect x={X0} y={1000} width={XW} height={12} fill="#fff" opacity={0.28} />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={X0 + 20 + i * 166} y={1024} width={150} height={58} rx={4} fill="#000" opacity={0.06} />)}
      <rect x={X0} y={1094} width={XW} height={830} fill={P.floor} />
      <rect x={X0} y={1094} width={XW} height={10} fill="#000" opacity={0.14} />
      <Plant x={30} y={1002} k={0.62} pot="#F2F2F2" />
      <g transform="translate(600 1000)"><rect x={0} y={-22} width={110} height={22} rx={3} fill="#3E7BD6" /><rect x={8} y={-42} width={96} height={20} rx={3} fill="#F2B93B" /><rect x={2} y={-60} width={104} height={18} rx={3} fill="#E2574C" /></g>
      <Plant x={1170} y={1160} k={1.25} />
    </g>
  );
};

// ════════════ NHÀ ════════════
const HOME: Record<string, { wall: [string, string]; sky: [string, string]; city: string; lit: string; litP: number; floor: string; sofa: string; sofa2: string; curtain: string; night: boolean; haze: string }> = {
  dem: { wall: ['#5E4E86', '#41345F'], sky: ['#0C1230', '#2A3470'], city: '#161C42', lit: '#FFD76A', litP: 0.42, floor: '#33272E', sofa: '#2F9189', sofa2: '#257770', curtain: '#D06D92', night: true, haze: 'rgba(40,24,90,.16)' },
  ngay: { wall: ['#F6E8D6', '#EBD5BC'], sky: ['#8CC8F2', '#E6F5FD'], city: '#A9C3DB', lit: '#fff', litP: 0, floor: '#B58562', sofa: '#3FA39B', sofa2: '#328A83', curtain: '#F0A7B8', night: false, haze: 'rgba(255,245,230,.10)' },
};
const HomeBack: React.FC<{ time: string; frame: number; id: string }> = ({ time, frame, id }) => {
  const P = HOME[time] ?? HOME.dem;
  const r = rnd(99);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.sky[0]} /><stop offset="1" stopColor={P.sky[1]} /></linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.wall[0]} /><stop offset="1" stopColor={P.wall[1]} /></linearGradient>
        <radialGradient id={`${id}g`}><stop offset="0" stopColor="#FFD08A" stopOpacity={0.55} /><stop offset="1" stopColor="#FFD08A" stopOpacity={0} /></radialGradient>
        <clipPath id={`${id}c`}><rect x={90} y={410} width={380} height={500} /></clipPath>
      </defs>
      <rect x={X0} y={0} width={XW} height={1104} fill={`url(#${id}w)`} />
      <rect x={X0} y={0} width={XW} height={220} fill="#000" opacity={0.12} />
      <rect x={X0} y={220} width={XW} height={14} fill="#fff" opacity={0.1} />
      {/* cửa sổ */}
      <rect x={72} y={392} width={416} height={536} rx={10} fill="#EADFCF" />
      <g clipPath={`url(#${id}c)`}>
        <rect x={90} y={410} width={380} height={500} fill={`url(#${id}s)`} />
        {P.night ? (
          <>
            <circle cx={372} cy={500} r={78} fill="#FFF4C2" opacity={0.16} />
            <circle cx={372} cy={500} r={44} fill="#FFF6D0" />
            <circle cx={356} cy={488} r={9} fill="#E9DDAA" opacity={0.7} />
            {Array.from({ length: 16 }, (_, i) => { const x = 100 + r() * 360, y = 420 + r() * 220, tw = 0.45 + 0.55 * Math.abs(Math.sin(frame / 14 + i * 1.7)); return <circle key={i} cx={x} cy={y} r={2.2 + r() * 1.6} fill="#fff" opacity={tw} />; })}
          </>
        ) : <Cloud x={220} y={520} k={0.8} fill="#fff" />}
        <Skyline seed={5} x0={80} x1={480} base={910} h={[110, 300]} w={[50, 96]} fill={P.city} dot={P.night ? '#232B5C' : '#E9F4FC'} lit={P.lit} litP={P.litP} />
      </g>
      <rect x={274} y={410} width={12} height={500} fill="#EADFCF" />
      <rect x={90} y={650} width={380} height={12} fill="#EADFCF" />
      <rect x={60} y={924} width={440} height={22} rx={6} fill="#D9CBB6" />
      {/* rèm */}
      <rect x={30} y={366} width={500} height={14} rx={7} fill="#8C6B4A" />
      {[[36, 1], [432, -1]].map(([x, d], i) => (
        <g key={i}>
          <path d={`M ${x} 380 L ${x + 96} 380 Q ${x + 96 - d * 14} 660 ${x + 96 - (d > 0 ? 30 : -6)} 960 L ${x + (d > 0 ? -4 : 30)} 960 Q ${x + d * 6} 660 ${x} 380 Z`} fill={P.curtain} />
          {[22, 46, 70].map((o) => <path key={o} d={`M ${x + o} 384 Q ${x + o - d * 6} 660 ${x + o - d * 4} 956`} fill="none" stroke="#000" strokeOpacity={0.14} strokeWidth={5} />)}
        </g>
      ))}
      {/* dây đèn nháy */}
      <path d="M -200 286 Q 120 372 440 300 Q 760 236 1280 318" fill="none" stroke="#2A2238" strokeWidth={4} />
      {Array.from({ length: 15 }, (_, i) => { const t = i / 14, x = -160 + t * 1400; const y = t < 0.43 ? 286 + Math.sin((t / 0.43) * Math.PI) * 50 : 300 - Math.sin(((t - 0.43) / 0.57) * Math.PI) * 30 + (t - 0.43) * 30; const on = 0.5 + 0.5 * Math.sin(frame / 9 + i * 2.1); const c = ['#FFD76A', '#FF8FA3', '#8FD3FF', '#B5F0A5'][i % 4]; return <g key={i}><circle cx={x} cy={y + 14} r={22} fill={c} opacity={0.14 + on * 0.2} /><circle cx={x} cy={y + 14} r={9} fill={c} opacity={0.65 + on * 0.35} /></g>; })}
      {/* tranh + kệ sách */}
      <g transform="translate(610 430)">
        <rect width={230} height={190} rx={6} fill="#D9B36A" />
        <rect x={14} y={14} width={202} height={162} fill="#F8D9B8" />
        <circle cx={150} cy={70} r={26} fill="#FF9E6B" />
        <path d="M 14 176 L 14 132 L 70 84 L 118 130 L 150 104 L 216 150 L 216 176 Z" fill="#6C8FB8" />
        <path d="M 14 176 L 14 150 L 60 122 L 120 160 L 216 136 L 216 176 Z" fill="#40618C" />
      </g>
      <g transform="translate(600 770)">
        {[['#E2574C', 26, 96], ['#F2B93B', 22, 84], ['#3E7BD6', 30, 104], ['#EDE6DA', 22, 90], ['#4FA86C', 26, 98]].map(([c, w, h], i) => <rect key={i} x={i * 32} y={-(h as number)} width={w as number} height={h as number} rx={3} fill={c as string} />)}
        <Plant x={212} y={0} k={0.4} pot="#F2F2F2" />
        <rect x={-14} y={0} width={270} height={14} rx={4} fill="#8C6B4A" />
      </g>
      {/* đèn cây */}
      <circle cx={990} cy={560} r={400} fill={`url(#${id}g)`} opacity={P.night ? 1 : 0.3} />
      <rect x={984} y={600} width={12} height={520} fill="#2A2238" />
      <path d="M 930 600 L 1050 600 L 1024 480 L 956 480 Z" fill={P.night ? '#FFE3A6' : '#F5E7C8'} />
      <ellipse cx={990} cy={1112} rx={60} ry={12} fill="#2A2238" />
      {/* sàn + sofa */}
      <rect x={X0} y={1104} width={XW} height={820} fill={P.floor} />
      <rect x={X0} y={1092} width={XW} height={14} fill="#000" opacity={0.2} />
      <rect x={130} y={860} width={820} height={360} rx={70} fill={P.sofa} />
      <rect x={130} y={860} width={820} height={60} rx={30} fill="#fff" opacity={0.08} />
      <rect x={84} y={960} width={130} height={280} rx={56} fill={P.sofa2} />
      <rect x={866} y={960} width={130} height={280} rx={56} fill={P.sofa2} />
      <rect x={236} y={950} width={150} height={150} rx={30} fill="#F2B93B" transform="rotate(-8 311 1025)" />
      <rect x={720} y={960} width={130} height={130} rx={26} fill="#F28FA6" transform="rotate(10 785 1025)" />
    </g>
  );
};

// ════════════ Ổ LỪA ĐẢO ════════════
const DenBack: React.FC<{ frame: number; id: string }> = ({ frame, id }) => {
  const r = rnd(321);
  const tick = Math.floor(frame / 5);
  const mon = (x: number, y: number, w: number, h: number, glow: string, body: React.ReactNode) => (
    <g>
      <rect x={x - 30} y={y - 30} width={w + 60} height={h + 60} rx={30} fill={glow} opacity={0.16} filter={`url(#${id}b)`} />
      <rect x={x - 10} y={y - 10} width={w + 20} height={h + 20} rx={12} fill="#0A0C16" />
      <svg x={x} y={y} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>{body}</svg>
      <rect x={x + w / 2 - 14} y={y + h + 10} width={28} height={44} fill="#0A0C16" />
      <rect x={x + w / 2 - 70} y={y + h + 50} width={140} height={12} rx={6} fill="#0A0C16" />
    </g>
  );
  return (
    <g>
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1B2038" /><stop offset="1" stopColor="#0D101E" /></linearGradient>
        <filter id={`${id}b`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="26" /></filter>
        <radialGradient id={`${id}v`} cx="0.5" cy="0.5" r="0.75"><stop offset="0.45" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.6} /></radialGradient>
      </defs>
      <rect x={X0} y={0} width={XW} height={1104} fill={`url(#${id}w)`} />
      {Array.from({ length: 13 }, (_, i) => <path key={i} d={`M ${X0} ${300 + i * 62} L ${X0 + XW} ${300 + i * 62}`} stroke="#fff" strokeOpacity={0.035} strokeWidth={3} />)}
      {Array.from({ length: 60 }, (_, i) => { const row = Math.floor(i / 10), col = i % 10; return <path key={i} d={`M ${X0 + col * 150 + (row % 2) * 75} ${300 + row * 62} l 0 62`} stroke="#fff" strokeOpacity={0.03} strokeWidth={3} />; })}
      {/* dải LED trần */}
      <rect x={X0} y={270} width={XW} height={40} fill="#FF2E7E" opacity={0.5} filter={`url(#${id}b)`} />
      <rect x={X0} y={288} width={XW} height={7} fill="#FF5C9A" />
      {/* giá điện thoại "nuôi nick" */}
      <g transform="translate(34 356)">
        <rect x={-14} y={-14} width={300} height={204} rx={12} fill="#11142A" stroke="#2B3050" strokeWidth={4} />
        {Array.from({ length: 12 }, (_, i) => { const on = (tick + i * 5) % 13 !== 0; const c = ['#35E0A1', '#4EA8FF', '#FFD76A', '#FF6B8B'][i % 4]; return <g key={i} transform={`translate(${(i % 6) * 46} ${Math.floor(i / 6) * 92})`}><rect width={36} height={76} rx={7} fill="#05060C" /><rect x={3} y={6} width={30} height={62} rx={4} fill={c} opacity={on ? 0.85 : 0.2} /><rect x={8} y={14} width={20} height={5} rx={2} fill="#fff" opacity={on ? 0.8 : 0.1} /><rect x={8} y={26} width={14} height={5} rx={2} fill="#fff" opacity={on ? 0.6 : 0.1} /></g>; })}
      </g>
      {/* bảng "kịch bản" */}
      <g transform="translate(770 344)">
        <rect width={290} height={214} rx={8} fill="#6E5236" stroke="#3E2D1C" strokeWidth={8} />
        {[[18, 20, '#FFE066', -5], [112, 16, '#FF9DB0', 4], [202, 26, '#F4F4F0', -3], [30, 112, '#F4F4F0', 5], [124, 108, '#FFE066', -4], [206, 116, '#9AD8FF', 6]].map(([x, y, c, rot], i) => <g key={i} transform={`rotate(${rot} ${(x as number) + 35} ${(y as number) + 38})`}><rect x={x as number} y={y as number} width={70} height={76} fill={c as string} /><rect x={(x as number) + 9} y={(y as number) + 16} width={50} height={5} fill="#000" opacity={0.3} /><rect x={(x as number) + 9} y={(y as number) + 30} width={40} height={5} fill="#000" opacity={0.3} /><rect x={(x as number) + 9} y={(y as number) + 44} width={46} height={5} fill="#000" opacity={0.3} /><circle cx={(x as number) + 35} cy={(y as number) + 6} r={5} fill="#E2342B" /></g>)}
        <path d="M 53 26 L 147 22 L 237 32 L 241 122 L 159 114 L 65 118 Z" fill="none" stroke="#E2342B" strokeWidth={3} />
      </g>
      {/* ba màn hình */}
      <rect x={X0} y={940} width={XW} height={70} fill="#1E2340" />
      {mon(40, 610, 300, 220, '#35E0A1', (
        <g>
          <rect width={300} height={220} fill="#04130D" />
          {Array.from({ length: 11 }, (_, i) => { const w = 60 + r() * 200; const k = (i + tick) % 11; return <rect key={i} x={14} y={12 + k * 18} width={w} height={8} rx={3} fill="#35E0A1" opacity={k === 10 ? 1 : 0.35 + (k / 11) * 0.5} />; })}
        </g>
      ))}
      {mon(390, 570, 300, 230, '#4EA8FF', (
        <g>
          <rect width={300} height={230} fill="#0B1226" />
          {Array.from({ length: 5 }, (_, i) => <g key={i}><circle cx={30} cy={30 + i * 42} r={14} fill="#4EA8FF" opacity={0.8} /><rect x={54} y={20 + i * 42} width={120 + ((i * 53) % 90)} height={8} rx={3} fill="#fff" opacity={0.6} /><rect x={54} y={34 + i * 42} width={80 + ((i * 31) % 70)} height={6} rx={3} fill="#fff" opacity={0.3} /></g>)}
        </g>
      ))}
      {mon(740, 610, 300, 220, '#FF4D6D', (
        <g>
          <rect width={300} height={220} fill="#170A12" />
          <path d="M 14 180 L 60 150 L 100 160 L 150 110 L 196 122 L 240 60 L 286 34" fill="none" stroke="#FF4D6D" strokeWidth={6} strokeLinejoin="round" />
          <path d="M 14 180 L 60 150 L 100 160 L 150 110 L 196 122 L 240 60 L 286 34 L 286 206 L 14 206 Z" fill="#FF4D6D" opacity={0.16} />
          <rect x={14} y={14} width={110} height={10} rx={4} fill="#fff" opacity={0.7} />
          <rect x={14} y={32} width={70} height={18} rx={4} fill="#FFD76A" />
        </g>
      ))}
      <rect x={X0} y={1010} width={XW} height={94} fill="#161A30" />
      <rect x={X0} y={1104} width={XW} height={820} fill="#0C0E1A" />
      <rect x={X0} y={0} width={XW} height={1920} fill={`url(#${id}v)`} />
    </g>
  );
};

// ════════════ chi tiết dùng chung cho các bối cảnh ngoài văn phòng ════════════
const FONT = "'Barlow', 'Google Sans', sans-serif";

// đèn thả trần; glow = buổi tối, bật quầng sáng ấm
const Pendant: React.FC<{ x: number; y: number; c: string; glow: string | null; k?: number }> = ({ x, y, c, glow, k = 1 }) => (
  <g>
    {glow && <ellipse cx={x} cy={y + 30 * k} rx={230 * k} ry={170 * k} fill={`url(#${glow})`} />}
    <line x1={x} y1={0} x2={x} y2={y - 60 * k} stroke="#2A2230" strokeWidth={4} />
    <rect x={x - 9 * k} y={y - 74 * k} width={18 * k} height={16 * k} rx={3} fill="#2A2230" />
    <path d={`M ${x - 58 * k} ${y} Q ${x - 54 * k} ${y - 62 * k} ${x} ${y - 62 * k} Q ${x + 54 * k} ${y - 62 * k} ${x + 58 * k} ${y} Z`} fill={c} />
    <path d={`M ${x - 30 * k} ${y - 44 * k} Q ${x - 10 * k} ${y - 56 * k} ${x + 6 * k} ${y - 56 * k}`} fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={5} strokeLinecap="round" />
    <ellipse cx={x} cy={y + 2} rx={30 * k} ry={10 * k} fill={glow ? '#FFF0BE' : '#FFF8E8'} />
  </g>
);

// nhà ống phố Việt: mặt tiền hẹp, cửa sổ chớp, ban công lan can
const Shophouse: React.FC<{ x: number; w: number; h: number; base: number; c: string; trim: string; win: string; lit: string; litP: number; seed: number }> = ({ x, w, h, base, c, trim, win, lit, litP, seed }) => {
  const r = rnd(seed);
  const top = base - h;
  const floors = Math.max(1, Math.floor((h - 90) / 118));
  const two = w > 140;
  const ww = two ? w / 2 - 26 : Math.min(64, w - 40);
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} fill={c} />
      <rect x={x - 6} y={top - 16} width={w + 12} height={18} rx={3} fill={trim} />
      <rect x={x} y={top + 2} width={w} height={8} fill="#000" opacity={0.08} />
      <rect x={x + w - 10} y={top} width={10} height={h} fill="#000" opacity={0.07} />
      {Array.from({ length: floors }, (_, f) => {
        const y = top + 36 + f * 118;
        const xs = two ? [x + 18, x + w / 2 + 8] : [x + (w - ww) / 2];
        return (
          <g key={f}>
            {xs.map((wx, j) => {
              const on = r() < litP;
              return (
                <g key={j}>
                  <rect x={wx - 5} y={y - 8} width={ww + 10} height={9} fill={trim} />
                  <rect x={wx} y={y} width={ww} height={62} fill={on ? lit : win} opacity={on ? 0.95 : 1} />
                  <rect x={wx + ww / 2 - 1.5} y={y} width={3} height={62} fill={trim} opacity={0.7} />
                </g>
              );
            })}
            <rect x={x + 8} y={y + 70} width={w - 16} height={7} fill={trim} />
            {Array.from({ length: Math.floor((w - 20) / 15) }, (_, b) => <rect key={b} x={x + 13 + b * 15} y={y + 76} width={3} height={22} fill={trim} opacity={0.8} />)}
            <rect x={x + 8} y={y + 96} width={w - 16} height={5} fill={trim} />
          </g>
        );
      })}
    </g>
  );
};

// xe máy chạy ngang (hướng sang phải; đi ngược thì lật bằng scale)
const Moto: React.FC<{ x: number; y: number; c: string; shirt: string; helmet: string; light?: boolean; flip?: boolean }> = ({ x, y, c, shirt, helmet, light, flip }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
    {light && <path d="M 56 -34 L 230 -70 L 230 6 Z" fill="#FFF3B0" opacity={0.22} />}
    <circle cx={-40} cy={-16} r={17} fill="#1C1F2A" /><circle cx={44} cy={-16} r={17} fill="#1C1F2A" />
    <circle cx={-40} cy={-16} r={6} fill="#9AA0AE" /><circle cx={44} cy={-16} r={6} fill="#9AA0AE" />
    <path d="M -58 -28 Q -46 -52 -12 -50 L 22 -50 L 50 -32 L 32 -24 L -54 -24 Z" fill={c} />
    <path d="M 34 -44 L 50 -72 L 60 -70" fill="none" stroke="#1C1F2A" strokeWidth={5} strokeLinecap="round" />
    <path d="M -8 -52 L 18 -30" stroke="#2B3040" strokeWidth={11} strokeLinecap="round" />
    <path d="M -26 -50 L -16 -106 L 10 -106 L 16 -60 L 2 -50 Z" fill={shirt} />
    <path d="M 4 -98 L 50 -72" stroke={shirt} strokeWidth={12} strokeLinecap="round" />
    <circle cx={-2} cy={-122} r={18} fill={helmet} />
    <rect x={-2} y={-124} width={20} height={8} rx={3} fill="#1C1F2A" opacity={0.5} />
    {light && <circle cx={56} cy={-36} r={6} fill="#FFF6C8" />}
  </g>
);

// cây tán tròn
const Tree: React.FC<{ x: number; base: number; h: number; r: number; c: string[]; trunk: string }> = ({ x, base, h, r: R, c, trunk }) => (
  <g>
    <path d={`M ${x - 18} ${base} Q ${x - 8} ${base - h * 0.5} ${x - 7} ${base - h} L ${x + 7} ${base - h} Q ${x + 10} ${base - h * 0.5} ${x + 22} ${base} Z`} fill={trunk} />
    {([[-0.62, 0.22, 0.72, 2], [0.66, 0.18, 0.74, 2], [0, 0.05, 1, 0], [-0.34, -0.42, 0.68, 1], [0.38, -0.36, 0.64, 1], [0.05, 0.4, 0.62, 2]] as const).map(([dx, dy, s, ci], i) => (
      <circle key={i} cx={x + dx * R} cy={base - h + dy * R} r={R * s} fill={c[ci]} />
    ))}
    <circle cx={x - R * 0.3} cy={base - h - R * 0.5} r={R * 0.26} fill="#fff" opacity={0.1} />
  </g>
);

// ════════════ QUÁN CÀ PHÊ ════════════
type CafeP = { wall: [string, string]; brick: string[]; mortar: string; ceil: string; beam: string; sky: [string, string]; far: string; houses: string[]; trim: string; win: string; lit: string; litP: number; road: string; frame: string; wain: [string, string]; night: boolean; cloud: string; leaf: string[]; lamp: string; haze: string };
const CAFE: Record<string, CafeP> = {
  ngay: { wall: ['#F3E4CF', '#E7D0B3'], brick: ['#C77457', '#B4634A', '#D6896A', '#BE6C50'], mortar: '#E6D2BA', ceil: '#5E4130', beam: '#4A3123', sky: ['#9BD0F3', '#E6F5FD'], far: '#C4D6E6', houses: ['#F2C14E', '#9CCBB4', '#F2A08E', '#A9C6E8', '#F3DFAE', '#E8B4C8'], trim: '#FFFFFF', win: '#7F9DB5', lit: '#FFFFFF', litP: 0, road: '#9E9A92', frame: '#5A3B28', wain: ['#9A6A47', '#875B3C'], night: false, cloud: '#FFFFFF', leaf: ['#5BA86A', '#77C083', '#418A52'], lamp: '#2F5D50', haze: 'rgba(255,240,220,.10)' },
  toi: { wall: ['#6E4F3E', '#563D30'], brick: ['#7A4536', '#6A3A2D', '#8A5241', '#733F31'], mortar: '#5A3F33', ceil: '#2A1D16', beam: '#1F150F', sky: ['#0D1534', '#28346C'], far: '#1E2852', houses: ['#4E4A68', '#3E4E66', '#5E4458', '#44547A', '#5A5468', '#4A4060'], trim: '#77738E', win: '#1E2444', lit: '#FFD27A', litP: 0.55, road: '#262838', frame: '#3A2518', wain: ['#5E3E2C', '#4E3324'], night: true, cloud: '#34406E', leaf: ['#244432', '#305A3E', '#1A3326'], lamp: '#C9A15A', haze: 'rgba(40,20,10,.16)' },
};
const CafeBack: React.FC<{ time: string; frame: number; id: string }> = ({ time, frame, id }) => {
  const P = CAFE[time] ?? CAFE.ngay;
  const r = rnd(77);
  const gx = 214, gy = 340, gw = 600, gh = 620; // ô kính mặt tiền
  const span = gw + 640;
  const bikeA = gx - 300 + ((frame * 3.4) % span);
  const bikeB = gx + gw + 300 - ((frame * 2.4 + 520) % span);
  const houses: React.ReactNode[] = [];
  for (let hx = gx - 50, i = 0; hx < gx + gw + 40; i++) {
    const w = 128 + r() * 64, h = 330 + r() * 150;
    houses.push(<Shophouse key={i} x={hx} w={w} h={h} base={830} c={P.houses[i % P.houses.length]} trim={P.trim} win={P.win} lit={P.lit} litP={P.litP} seed={200 + i} />);
    hx += w + 4;
  }
  const bricks: React.ReactNode[] = [];
  for (let row = 0; row < 22; row++)
    for (let bx = X0 - (row % 2) * 48; bx < 200; bx += 96) bricks.push(<rect key={`${row}-${bx}`} x={bx + 3} y={272 + row * 34 + 3} width={90} height={28} rx={3} fill={P.brick[Math.floor(r() * P.brick.length)]} />);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.sky[0]} /><stop offset="1" stopColor={P.sky[1]} /></linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.wall[0]} /><stop offset="1" stopColor={P.wall[1]} /></linearGradient>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.wain[0]} /><stop offset="1" stopColor={P.wain[1]} /></linearGradient>
        <clipPath id={`${id}c`}><rect x={gx} y={gy} width={gw} height={gh} /></clipPath>
        <clipPath id={`${id}k`}><rect x={X0} y={268} width={200 - X0} height={740} /></clipPath>
        <radialGradient id={`${id}h`}><stop offset="0" stopColor="#FFD58A" stopOpacity={0.42} /><stop offset="1" stopColor="#FFD58A" stopOpacity={0} /></radialGradient>
      </defs>
      <rect x={X0} y={0} width={XW} height={1104} fill={`url(#${id}w)`} />
      {/* trần gỗ + xà */}
      <rect x={X0} y={0} width={XW} height={262} fill={P.ceil} />
      {Array.from({ length: 10 }, (_, k) => <rect key={k} x={X0 + 40 + k * 160} y={0} width={16} height={262} fill={P.beam} />)}
      <rect x={X0} y={244} width={XW} height={26} fill={P.beam} />
      <rect x={X0} y={268} width={XW} height={6} fill="#000" opacity={0.15} />
      {/* tường gạch trần bên trái + bảng phấn */}
      <g clipPath={`url(#${id}k)`}><rect x={X0} y={268} width={400} height={740} fill={P.mortar} />{bricks}</g>
      <rect x={190} y={268} width={14} height={740} fill="#000" opacity={0.1} />
      <g transform="translate(14 446)">
        <rect x={-10} y={-10} width={182} height={262} rx={8} fill="#7A5236" />
        <rect width={162} height={242} rx={4} fill="#2D3A33" />
        <text x={81} y={46} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={34} letterSpacing={3} fill="#F4F1E6" opacity={0.9}>MENU</text>
        <path d="M 30 60 Q 81 70 132 60" fill="none" stroke="#F2C14E" strokeWidth={3} opacity={0.8} />
        {[0, 1, 2, 3, 4].map((i) => <g key={i}><rect x={22} y={86 + i * 28} width={[70, 58, 76, 52, 64][i]} height={7} rx={3} fill="#F4F1E6" opacity={0.6} /><circle cx={134} cy={89 + i * 28} r={5} fill="#F4F1E6" opacity={0.6} /></g>)}
        <path d="M 60 222 l 6 -16 h 30 l 6 16 z M 102 210 q 12 0 10 -8" fill="none" stroke="#F4F1E6" strokeOpacity={0.7} strokeWidth={3} />
      </g>
      {/* ô kính mặt tiền nhìn ra phố */}
      <rect x={gx - 20} y={gy - 20} width={gw + 40} height={gh + 40} rx={6} fill={P.frame} />
      <g clipPath={`url(#${id}c)`}>
        <rect x={gx} y={gy} width={gw} height={gh} fill={`url(#${id}s)`} />
        {P.night ? (
          <g><circle cx={680} cy={420} r={64} fill="#FFF4C2" opacity={0.16} /><circle cx={680} cy={420} r={34} fill="#FFF6D0" /></g>
        ) : (
          <g><Cloud x={gx + 40 + ((frame * 0.12) % 700)} y={430} k={0.9} fill={P.cloud} /><Cloud x={gx - 300 + ((frame * 0.08 + 300) % 900)} y={380} k={0.6} fill={P.cloud} o={0.75} /></g>
        )}
        <Skyline seed={12} x0={gx - 60} x1={gx + gw + 60} base={700} h={[90, 300]} w={[60, 110]} fill={P.far} />
        {houses}
        <Tree x={gx + 380} base={834} h={230} r={80} c={P.leaf} trunk={P.night ? '#2A1E18' : '#6B4A34'} />
        <rect x={gx} y={826} width={gw} height={14} fill={P.night ? '#3A3C4E' : '#C9C3B6'} />
        <rect x={gx} y={840} width={gw} height={90} fill={P.road} />
        {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={gx - 60 + i * 160} y={884} width={70} height={5} fill="#fff" opacity={0.5} />)}
        <rect x={gx} y={930} width={gw} height={30} fill={P.night ? '#34364A' : '#D6D0C4'} />
        {[gx + 300].map((lx) => <g key={lx}>{P.night && <circle cx={lx} cy={590} r={80} fill="#FFD27A" opacity={0.18} />}<rect x={lx - 3} y={590} width={6} height={240} fill={P.night ? '#141826' : '#4A5060'} /><circle cx={lx} cy={590} r={11} fill={P.night ? '#FFE7A6' : '#E9EEF3'} /></g>)}
        <Moto x={bikeA} y={898} c="#E2574C" shirt="#3E7BD6" helmet="#F2C14E" light={P.night} />
        <Moto x={bikeB} y={922} c="#3E7BD6" shirt="#F2F2F2" helmet="#E2574C" light={P.night} flip />
        <path d={`M ${gx + 40} ${gy} L ${gx + 150} ${gy} L ${gx - 60} ${gy + gh} L ${gx - 170} ${gy + gh} Z M ${gx + 330} ${gy} L ${gx + 380} ${gy} L ${gx + 170} ${gy + gh} L ${gx + 120} ${gy + gh} Z`} fill="#fff" opacity={P.night ? 0.05 : 0.12} />
      </g>
      {[gx + gw / 3, gx + (gw * 2) / 3].map((x) => <rect key={x} x={x - 8} y={gy} width={16} height={gh} fill={P.frame} />)}
      <rect x={gx} y={gy + 118} width={gw} height={14} fill={P.frame} />
      <rect x={gx - 36} y={gy + gh + 16} width={gw + 72} height={24} rx={5} fill={P.wain[0]} />
      <rect x={gx - 36} y={gy + gh + 34} width={gw + 72} height={6} fill="#000" opacity={0.15} />
      {/* dây đèn bóng tròn trên ô kính */}
      <path d={`M ${gx - 40} ${gy + 20} Q ${gx + gw / 2} ${gy + 110} ${gx + gw + 40} ${gy + 20}`} fill="none" stroke="#2A2230" strokeWidth={3} />
      {Array.from({ length: 9 }, (_, i) => {
        const t = (i + 0.5) / 9, x = gx - 40 + t * (gw + 80), y = gy + 20 + 4 * t * (1 - t) * 90 + 10;
        return <g key={i}>{P.night && <circle cx={x} cy={y} r={22} fill="#FFD27A" opacity={0.25 + 0.1 * Math.sin(frame / 10 + i)} />}<circle cx={x} cy={y} r={8} fill={P.night ? '#FFE7A6' : '#F6EFD8'} /></g>;
      })}
      {/* tường phải: tranh + kệ cốc */}
      <g transform="translate(872 330)">
        <rect width={170} height={150} rx={6} fill="#3A2A20" />
        <rect x={10} y={10} width={150} height={130} fill={P.night ? '#E8D2B0' : '#F4E3C8'} />
        <path d="M 52 70 L 118 70 L 112 118 Q 85 128 58 118 Z" fill="#7A4A30" />
        <path d="M 116 80 q 22 2 18 20 q -4 14 -22 12" fill="none" stroke="#7A4A30" strokeWidth={8} />
        {[0, 1].map((i) => <path key={i} d={`M ${76 + i * 18} 60 q 8 -12 0 -24 q -8 -12 0 -22`} fill="none" stroke="#7A4A30" strokeOpacity={0.5} strokeWidth={4} strokeLinecap="round" />)}
      </g>
      {[560, 740].map((sy, s) => (
        <g key={sy}>
          {Array.from({ length: 5 }, (_, i) => {
            const x = 892 + i * 42;
            return s === 0 ? (
              <g key={i}><rect x={x} y={sy - 40} width={30} height={40} rx={5} fill={['#F4F4F0', '#E2574C', '#F4F4F0', '#3E7BD6', '#F4F4F0'][i]} /><path d={`M ${x + 30} ${sy - 30} q 12 2 10 12 q -2 8 -10 8`} fill="none" stroke={['#F4F4F0', '#E2574C', '#F4F4F0', '#3E7BD6', '#F4F4F0'][i]} strokeWidth={4} /></g>
            ) : (
              <g key={i}><rect x={x} y={sy - 62} width={32} height={62} rx={6} fill="#fff" opacity={0.45} /><rect x={x + 3} y={sy - 40} width={26} height={37} rx={4} fill={['#6B4630', '#4A2E1E', '#8A5A3A', '#6B4630', '#C79A5A'][i]} /><rect x={x - 2} y={sy - 68} width={36} height={10} rx={3} fill="#3A2A20" /></g>
            );
          })}
          <rect x={872} y={sy} width={240} height={14} rx={4} fill={P.wain[0]} />
          <rect x={872} y={sy + 14} width={240} height={5} fill="#000" opacity={0.15} />
        </g>
      ))}
      {/* ốp gỗ chân tường + sàn */}
      <rect x={X0} y={1000} width={XW} height={104} fill={`url(#${id}p)`} />
      {Array.from({ length: 38 }, (_, i) => <rect key={i} x={X0 + i * 40} y={1000} width={3} height={104} fill="#000" opacity={0.1} />)}
      <rect x={X0} y={994} width={XW} height={12} fill={P.wain[0]} />
      <rect x={X0} y={1104} width={XW} height={820} fill={P.night ? '#3A2A22' : '#A27855'} />
      <rect x={X0} y={1094} width={XW} height={12} fill="#000" opacity={0.2} />
      <Plant x={1010} y={1004} k={0.7} pot="#3A2A20" />
      {/* đèn thả */}
      <Pendant x={340} y={318} c={P.lamp} glow={P.night ? `${id}h` : null} />
      <Pendant x={760} y={300} c={P.lamp} glow={P.night ? `${id}h` : null} />
      <Pendant x={1150} y={330} c={P.lamp} glow={P.night ? `${id}h` : null} />
      <Pendant x={-60} y={300} c={P.lamp} glow={P.night ? `${id}h` : null} />
    </g>
  );
};

// ════════════ NGÂN HÀNG (sảnh giao dịch) ════════════
const BANK = { wall: ['#EEF2F6', '#DCE3EB'], ceil: '#F7F9FB', brand: '#1F4E8C', gold: '#F2B93B', floor: '#C3C9D2', counter: '#24477A', top: '#ECE8E0', glass: '#CFE7F7', post: '#AEB8C6', haze: 'rgba(235,242,250,.10)' };
const BankBack: React.FC<{ frame: number; id: string }> = ({ frame, id }) => {
  const P = BANK;
  const num = 247 + Math.floor(frame / 150);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.wall[0]} /><stop offset="1" stopColor={P.wall[1]} /></linearGradient>
      </defs>
      <rect x={X0} y={0} width={XW} height={1104} fill={`url(#${id}w)`} />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={X0 + 90 + i * 180} y={290} width={3} height={700} fill="#000" opacity={0.05} />)}
      {/* trần + đèn âm trần */}
      <rect x={X0} y={0} width={XW} height={272} fill={P.ceil} />
      {[-40, 340, 720, 1100].map((x) => <g key={x}><rect x={x - 110} y={168} width={220} height={26} rx={6} fill="#FFFFFF" /><rect x={x - 110} y={190} width={220} height={6} fill="#000" opacity={0.08} /></g>)}
      <rect x={X0} y={262} width={XW} height={20} fill={P.brand} />
      <rect x={X0} y={282} width={XW} height={6} fill={P.gold} />
      {/* biển ngân hàng (không mang thương hiệu thật) */}
      <g transform="translate(752 330)">
        <rect width={312} height={100} rx={12} fill={P.brand} />
        <circle cx={54} cy={50} r={32} fill={P.gold} />
        <path d="M 32 44 L 54 30 L 76 44 Z M 36 68 h 36 M 40 48 v 16 M 54 48 v 16 M 68 48 v 16" fill="#fff" stroke="#fff" strokeWidth={4} strokeLinejoin="round" />
        <text x={102} y={52} fontFamily={FONT} fontWeight={800} fontSize={36} letterSpacing={1} fill="#fff">NGÂN HÀNG</text>
        <text x={103} y={80} fontFamily={FONT} fontWeight={600} fontSize={21} fill="#fff" opacity={0.8}>Quầy giao dịch</text>
      </g>
      {/* mảng tường nhấn giữa + ba đồng hồ múi giờ (vùng trên đầu nhân vật để trống cho nhãn bật) */}
      <rect x={292} y={430} width={496} height={520} rx={14} fill="#E2E9F1" />
      <rect x={292} y={430} width={496} height={8} rx={4} fill={P.gold} />
      {[388, 540, 692].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={500} r={38} fill="#3A3F4B" />
          <circle cx={x} cy={500} r={32} fill="#FBFBF8" />
          <line x1={x} y1={500} x2={x} y2={482} stroke="#3A3F4B" strokeWidth={5} strokeLinecap="round" transform={`rotate(${[300, 0, 150][i]} ${x} 500)`} />
          <line x1={x} y1={500} x2={x} y2={474} stroke="#3A3F4B" strokeWidth={3} strokeLinecap="round" transform={`rotate(${(frame / 30) * 0.1 + i * 40} ${x} 500)`} />
          <rect x={x - 34} y={546} width={68} height={8} rx={4} fill="#8A97A8" />
        </g>
      ))}
      {/* bảng gọi số (trái) */}
      <g transform="translate(22 440)">
        <rect width={232} height={118} rx={10} fill="#1A2233" />
        <rect x={146} y={14} width={3} height={90} fill="#fff" opacity={0.15} />
        <text x={16} y={34} fontFamily={FONT} fontWeight={700} fontSize={19} letterSpacing={1} fill="#9FB3CC">SỐ THỨ TỰ</text>
        <text x={14} y={96} fontFamily="'JetBrains Mono', monospace" fontWeight={700} fontSize={54} fill="#FF5A4E">{String(num).padStart(4, '0')}</text>
        <text x={164} y={34} fontFamily={FONT} fontWeight={700} fontSize={19} letterSpacing={1} fill="#9FB3CC">QUẦY</text>
        <text x={172} y={96} fontFamily="'JetBrains Mono', monospace" fontWeight={700} fontSize={54} fill="#35E0A1">{(num % 3) + 1}</text>
      </g>
      {/* áp phích cảnh giác (phải) */}
      <g transform="translate(890 478)">
        <rect width={172} height={226} rx={8} fill="#fff" stroke="#C8D2DE" strokeWidth={4} />
        <path d="M 0 8 Q 0 0 8 0 L 164 0 Q 172 0 172 8 L 172 52 L 0 52 Z" fill="#E2342B" />
        <text x={86} y={35} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={22} letterSpacing={0.5} fill="#fff">CẢNH GIÁC</text>
        <path d="M 86 70 L 118 84 Q 118 126 86 144 Q 54 126 54 84 Z" fill="#FFE3DF" stroke="#E2342B" strokeWidth={5} strokeLinejoin="round" />
        <path d="M 72 106 l 10 10 l 20 -22" fill="none" stroke="#E2342B" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
        <text x={86} y={178} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={21} fill="#141826">Không cung cấp</text>
        <text x={86} y={206} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={24} fill="#E2342B">mã OTP</text>
      </g>
      <Plant x={-110} y={1004} k={0.9} pot="#E9EEF3" />
      <rect x={X0} y={1104} width={XW} height={820} fill={P.floor} />
    </g>
  );
};
// quầy giao dịch phía sau (vách kính + giao dịch viên), vẽ ở lớp giữa để che nửa dưới người phụ
const BankCounter: React.FC = () => {
  const P = BANK;
  return (
    <g>
      <rect x={X0} y={780} width={XW} height={170} fill={P.glass} opacity={0.22} />
      <path d="M 0 780 L 60 780 L -40 950 L -100 950 Z M 420 780 L 450 780 L 350 950 L 320 950 Z M 820 780 L 880 780 L 780 950 L 720 950 Z" fill="#fff" opacity={0.18} />
      <rect x={X0} y={772} width={XW} height={12} rx={4} fill={P.post} />
      {[-75, 335, 745, 1155].map((x) => <rect key={x} x={x - 7} y={772} width={14} height={180} fill={P.post} />)}
      <rect x={X0} y={944} width={XW} height={22} rx={4} fill={P.top} />
      <rect x={X0} y={964} width={XW} height={140} fill={P.counter} />
      <rect x={X0} y={964} width={XW} height={10} fill="#000" opacity={0.18} />
      <rect x={X0} y={1014} width={XW} height={8} fill={P.gold} opacity={0.9} />
      {[130, 540, 950].map((x, i) => <g key={x}><circle cx={x} cy={1062} r={24} fill={P.gold} /><text x={x} y={1072} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={28} fill={P.counter}>{i + 1}</text></g>)}
    </g>
  );
};

// ════════════ PHÒNG HỌP ════════════
type MeetP = { wall: [string, string]; slat: [string, string]; ceil: string; sky: [string, string]; far: string; near: string; dot: string; lit: string; litP: number; frame: string; floor: string; cab: string; night: boolean; cloud: string; haze: string };
const MEET: Record<string, MeetP> = {
  ngay: { wall: ['#EFEAE2', '#E1D9CD'], slat: ['#BE8E60', '#A87A50'], ceil: '#F7F4EE', sky: ['#86C4EF', '#E4F4FD'], far: '#B9CEE2', near: '#8DA8C5', dot: '#E9F4FC', lit: '#fff', litP: 0, frame: '#4A505E', floor: '#8F98A6', cab: '#5C4A3E', night: false, cloud: '#FFFFFF', haze: 'rgba(240,244,250,.12)' },
  toi: { wall: ['#5E6278', '#4B4F63'], slat: ['#6E5440', '#5A4433'], ceil: '#666A80', sky: ['#0E1533', '#2C3A70'], far: '#1E2955', near: '#131A3B', dot: '#27325F', lit: '#FFD76A', litP: 0.5, frame: '#2A2E3A', floor: '#3C4254', cab: '#3A2F27', night: true, cloud: '#34406E', haze: 'rgba(18,22,60,.2)' },
};
const MeetBack: React.FC<{ time: string; frame: number; logo?: boolean; id: string }> = ({ time, frame, logo, id }) => {
  const P = MEET[time] ?? MEET.ngay;
  const grow = Math.min(1, frame / 45);
  const wb = { x: 884, y: logo ? 510 : 400, w: 236, h: logo ? 300 : 340 };
  return (
    <g>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.sky[0]} /><stop offset="1" stopColor={P.sky[1]} /></linearGradient>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.wall[0]} /><stop offset="1" stopColor={P.wall[1]} /></linearGradient>
        <radialGradient id={`${id}g`}><stop offset="0" stopColor="#CFE6FF" stopOpacity={0.5} /><stop offset="1" stopColor="#CFE6FF" stopOpacity={0} /></radialGradient>
        <clipPath id={`${id}c`}><rect x={X0} y={300} width={450} height={700} /></clipPath>
      </defs>
      <rect x={X0} y={0} width={XW} height={1104} fill={`url(#${id}w)`} />
      <rect x={X0} y={0} width={XW} height={286} fill={P.ceil} />
      <rect x={-40} y={170} width={1160} height={22} rx={11} fill={P.night ? '#FFF6D2' : '#FFFFFF'} />
      {P.night && <ellipse cx={540} cy={200} rx={640} ry={70} fill="#FFF3C4" opacity={0.22} />}
      <rect x={X0} y={272} width={XW} height={14} fill="#000" opacity={0.08} />
      {/* cửa kính trái nhìn ra thành phố, rèm sáo kéo nửa */}
      <g clipPath={`url(#${id}c)`}>
        <rect x={X0} y={300} width={450} height={700} fill={`url(#${id}s)`} />
        {P.night ? <g><circle cx={110} cy={470} r={60} fill="#FFF4C2" opacity={0.16} /><circle cx={110} cy={470} r={32} fill="#FFF6D0" /></g> : <Cloud x={-120 + ((frame * 0.1) % 600)} y={520} k={0.9} fill={P.cloud} />}
        <Skyline seed={23} x0={X0} x1={260} base={1000} h={[240, 470]} w={[70, 120]} fill={P.far} />
        <Skyline seed={57} x0={X0} x1={260} base={1000} h={[110, 300]} w={[80, 140]} fill={P.near} dot={P.dot} lit={P.lit} litP={P.litP} />
        {Array.from({ length: 9 }, (_, i) => <rect key={i} x={X0} y={300 + i * 17} width={450} height={13} fill={P.night ? '#9AA0B6' : '#F4F1EA'} />)}
        <rect x={X0} y={452} width={450} height={8} fill={P.frame} opacity={0.5} />
        <path d="M -60 460 L 20 460 L -120 1000 L -200 1000 Z M 140 460 L 180 460 L 40 1000 L 0 1000 Z" fill="#fff" opacity={0.1} />
      </g>
      <rect x={30} y={300} width={16} height={700} fill={P.frame} />
      <rect x={244} y={300} width={22} height={700} fill={P.frame} />
      {/* mảng ốp lam gỗ + màn hình trình chiếu */}
      <rect x={316} y={286} width={448} height={714} fill={P.slat[1]} />
      {Array.from({ length: 20 }, (_, i) => <rect key={i} x={322 + i * 22} y={286} width={12} height={714} fill={P.slat[0]} />)}
      <rect x={316} y={286} width={448} height={714} fill="#000" opacity={P.night ? 0.12 : 0} />
      <circle cx={540} cy={510} r={260} fill={`url(#${id}g)`} opacity={P.night ? 1 : 0.5} />
      <g transform="translate(372 414)">
        <rect x={-12} y={-12} width={360} height={212} rx={10} fill="#141824" />
        <rect width={336} height={188} rx={3} fill="#FFFFFF" />
        <rect width={336} height={34} fill="#1F4E8C" />
        <rect x={14} y={12} width={130} height={10} rx={5} fill="#fff" opacity={0.85} />
        <circle cx={316} cy={17} r={8} fill="#FFD21F" />
        {[0, 1, 2, 3].map((i) => { const h = [58, 84, 70, 118][i] * grow; return <rect key={i} x={24 + i * 40} y={170 - h} width={26} height={h} rx={3} fill={i === 3 ? '#E2342B' : '#5B8DEF'} />; })}
        <rect x={16} y={170} width={170} height={3} fill="#141826" opacity={0.3} />
        <circle cx={262} cy={110} r={44} fill="#E6ECF4" />
        <path d={`M 262 110 L 262 66 A 44 44 0 ${grow > 0.5 ? 1 : 0} 1 ${262 + 44 * Math.sin(grow * 4.2)} ${110 - 44 * Math.cos(grow * 4.2)} Z`} fill="#FFD21F" />
        <rect x={210} y={164} width={104} height={8} rx={4} fill="#141826" opacity={0.25} />
      </g>
      {/* logo + bảng trắng (phải) */}
      {logo && (
        <g transform="translate(812 346)">
          <rect width={250} height={132} rx={10} fill="#fff" stroke={P.frame} strokeWidth={6} />
          <g transform={`translate(22 ${(132 - 206 * MISA_LOGO_RATIO) / 2})`}><MisaLogo width={206} /></g>
        </g>
      )}
      <g transform={`translate(${wb.x} ${wb.y})`}>
        <rect x={-10} y={-10} width={wb.w + 20} height={wb.h + 20} rx={8} fill="#B8BEC9" />
        <rect width={wb.w} height={wb.h} rx={4} fill="#FBFCFD" />
        <rect x={20} y={28} width={70} height={42} rx={6} fill="none" stroke="#3E7BD6" strokeWidth={4} />
        <rect x={130} y={28} width={70} height={42} rx={6} fill="none" stroke="#3E7BD6" strokeWidth={4} />
        <path d="M 90 49 L 126 49 M 118 41 l 9 8 l -9 8" fill="none" stroke="#3E7BD6" strokeWidth={4} strokeLinecap="round" />
        <path d="M 165 70 L 165 110 M 157 102 l 8 9 l 8 -9" fill="none" stroke="#E2342B" strokeWidth={4} strokeLinecap="round" />
        <circle cx={165} cy={146} r={30} fill="none" stroke="#E2342B" strokeWidth={4} />
        <path d="M 151 146 l 10 10 l 18 -20" fill="none" stroke="#E2342B" strokeWidth={4} strokeLinecap="round" />
        {[0, 1, 2].map((i) => <rect key={i} x={22} y={110 + i * 24} width={[86, 64, 76][i]} height={6} rx={3} fill="#141826" opacity={0.35} />)}
        <rect x={20} y={wb.h - 92} width={64} height={64} fill="#FFE566" transform={`rotate(-4 52 ${wb.h - 60})`} />
        <rect x={98} y={wb.h - 86} width={60} height={60} fill="#9AD8FF" transform={`rotate(5 128 ${wb.h - 56})`} />
        <rect x={-10} y={wb.h + 6} width={wb.w + 20} height={12} rx={4} fill="#9AA3B5" />
        <rect x={40} y={wb.h - 2} width={40} height={10} rx={4} fill="#E2342B" /><rect x={92} y={wb.h - 2} width={40} height={10} rx={4} fill="#3E7BD6" />
      </g>
      {/* tủ thấp dưới màn hình + sàn */}
      <rect x={X0} y={1094} width={XW} height={830} fill={P.floor} />
      <rect x={X0} y={1094} width={XW} height={10} fill="#000" opacity={0.14} />
      <rect x={330} y={968} width={420} height={128} rx={6} fill={P.cab} />
      <rect x={330} y={968} width={420} height={12} rx={4} fill="#fff" opacity={0.15} />
      {[0, 1, 2].map((i) => <rect key={i} x={344 + i * 136} y={992} width={124} height={92} rx={4} fill="#000" opacity={0.1} />)}
      <Plant x={1120} y={1160} k={1.15} pot="#E9E5DE" />
      <Plant x={-90} y={1150} k={1.0} pot="#E9E5DE" />
    </g>
  );
};

// ════════════ NGOÀI TRỜI (công viên bờ hồ) ════════════
type ParkP = { sky: [string, string]; sun: string; far: string; near: string; dot: string; lit: string; litP: number; trees: string[]; shore: string; water: [string, string]; grass: [string, string]; trunk: string; cloud: string; lamp: string; night: boolean; bench: [string, string]; haze: string };
const PARK: Record<string, ParkP> = {
  ngay: { sky: ['#6FB8EE', '#DDF1FC'], sun: '#FFF6D0', far: '#BBD0E2', near: '#9DB7CF', dot: '#E9F4FC', lit: '#fff', litP: 0, trees: ['#4E9A5E', '#6BB878', '#3D7F4C'], shore: '#4A8A58', water: ['#7FC3E6', '#B2DDF2'], grass: ['#7DBA66', '#64A350'], trunk: '#6B4A34', cloud: '#FFFFFF', lamp: '#2E3440', night: false, bench: ['#C58A55', '#A8723F'], haze: 'rgba(235,245,255,.10)' },
  chieu: { sky: ['#F27A4A', '#FFD58A'], sun: '#FFF1C2', far: '#DC9472', near: '#A9624C', dot: '#FFD9A0', lit: '#FFF1B8', litP: 0.25, trees: ['#5E7A3E', '#7A9248', '#4A6230'], shore: '#566A34', water: ['#F09A68', '#FFD08E'], grass: ['#93A452', '#798B40'], trunk: '#4E3222', cloud: '#FFE2BE', lamp: '#3A2E2A', night: false, bench: ['#B8783F', '#9A6232'], haze: 'rgba(255,170,90,.12)' },
  toi: { sky: ['#0B1230', '#26336A'], sun: '#FFF4C8', far: '#1C2552', near: '#141B3E', dot: '#27325F', lit: '#FFD76A', litP: 0.5, trees: ['#1E3A2C', '#2A4C36', '#162E22'], shore: '#14261C', water: ['#16224C', '#2A3A72'], grass: ['#2A4A30', '#1F3A26'], trunk: '#241B1A', cloud: '#2E3A66', lamp: '#141824', night: true, bench: ['#6E4A30', '#563823'], haze: 'rgba(14,18,50,.2)' },
};
const ParkBack: React.FC<{ time: string; frame: number; id: string }> = ({ time, frame, id }) => {
  const P = PARK[time] ?? PARK.ngay;
  const r = rnd(515);
  const sun = time === 'chieu' ? { x: 640, y: 770, r: 86 } : P.night ? { x: 800, y: 440, r: 40 } : { x: 860, y: 420, r: 54 };
  const stars = Array.from({ length: 26 }, () => [X0 + r() * XW, 300 + r() * 360, 1.6 + r() * 1.8]);
  return (
    <g>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.sky[0]} /><stop offset="1" stopColor={P.sky[1]} /></linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.water[0]} /><stop offset="1" stopColor={P.water[1]} /></linearGradient>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.grass[0]} /><stop offset="1" stopColor={P.grass[1]} /></linearGradient>
        <radialGradient id={`${id}h`}><stop offset="0" stopColor="#FFD98A" stopOpacity={0.6} /><stop offset="1" stopColor="#FFD98A" stopOpacity={0} /></radialGradient>
      </defs>
      <rect x={X0} y={0} width={XW} height={880} fill={`url(#${id}s)`} />
      {P.night && stars.map(([x, y, s], i) => <circle key={i} cx={x} cy={y} r={s} fill="#fff" opacity={0.4 + 0.5 * Math.abs(Math.sin(frame / 15 + i * 1.3))} />)}
      <circle cx={sun.x} cy={sun.y} r={sun.r * 2.2} fill={P.sun} opacity={time === 'chieu' ? 0.35 : 0.18} />
      <circle cx={sun.x} cy={sun.y} r={sun.r} fill={P.sun} />
      {P.night && <circle cx={sun.x - 12} cy={sun.y - 10} r={8} fill="#E9DDAA" opacity={0.7} />}
      <Cloud x={-160 + ((frame * 0.1) % 1500)} y={400} k={1.1} fill={P.cloud} o={P.night ? 0.6 : 0.9} />
      <Cloud x={420 + ((frame * 0.06) % 900)} y={500} k={0.7} fill={P.cloud} o={P.night ? 0.5 : 0.75} />
      {!P.night && [0, 1, 2].map((i) => { const bx = 200 + ((frame * 1.2 + i * 70) % 1200) - 300, by = 470 + i * 26 + Math.sin(frame / 8 + i) * 6, w = Math.sin(frame / 4 + i * 2) * 6; return <path key={i} d={`M ${bx - 14} ${by - w} Q ${bx - 6} ${by - 4} ${bx} ${by} Q ${bx + 6} ${by - 4} ${bx + 14} ${by - w}`} fill="none" stroke="#2A3040" strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" />; })}
      <Skyline seed={88} x0={X0} x1={X0 + XW} base={820} h={[120, 300]} w={[60, 120]} fill={P.far} />
      <Skyline seed={31} x0={X0} x1={X0 + XW} base={830} h={[50, 150]} w={[70, 130]} fill={P.near} dot={P.dot} lit={P.lit} litP={P.litP} />
      {/* hàng cây bờ xa */}
      {Array.from({ length: 22 }, (_, i) => <ellipse key={i} cx={X0 + i * 72 + (i % 3) * 10} cy={842} rx={56 + (i % 4) * 8} ry={34 + (i % 3) * 8} fill={P.trees[i % 2 ? 2 : 0]} />)}
      <rect x={X0} y={842} width={XW} height={16} fill={P.shore} />
      {/* mặt hồ */}
      <rect x={X0} y={856} width={XW} height={140} fill={`url(#${id}l)`} />
      {time === 'chieu' && <path d={`M ${sun.x - 70} 858 L ${sun.x + 70} 858 L ${sun.x + 30} 996 L ${sun.x - 30} 996 Z`} fill="#FFF1C2" opacity={0.35} />}
      {Array.from({ length: 18 }, (_, i) => { const y = 872 + (i % 6) * 21, x = X0 + ((i * 97 + frame * (0.6 + (i % 3) * 0.3)) % XW); return <rect key={i} x={x} y={y} width={40 + (i % 4) * 16} height={4} rx={2} fill={P.night && i % 2 ? '#FFD76A' : '#fff'} opacity={P.night ? 0.35 : 0.45} />; })}
      {/* bờ cỏ + lối đi */}
      <rect x={X0} y={994} width={XW} height={110} fill={`url(#${id}g)`} />
      <rect x={X0} y={994} width={XW} height={8} fill="#fff" opacity={0.12} />
      <rect x={X0} y={1104} width={XW} height={820} fill={P.night ? '#2E3040' : '#CDBB98'} />
      <rect x={X0} y={1094} width={XW} height={12} fill="#000" opacity={0.12} />
      {/* cây lớn hai bên */}
      <Tree x={20} base={1104} h={560} r={170} c={P.trees} trunk={P.trunk} />
      <Tree x={1210} base={1104} h={620} r={180} c={P.trees} trunk={P.trunk} />
      {/* cột đèn phố */}
      <g>
        {P.night && <circle cx={990} cy={420} r={260} fill={`url(#${id}h)`} />}
        <rect x={984} y={430} width={12} height={674} fill={P.lamp} />
        <rect x={974} y={1060} width={32} height={44} rx={4} fill={P.lamp} />
        <path d="M 990 450 Q 950 450 940 420 M 990 450 Q 1030 450 1040 420" fill="none" stroke={P.lamp} strokeWidth={6} />
        {[940, 1040].map((x) => <g key={x}><path d={`M ${x - 20} 420 L ${x + 20} 420 L ${x + 14} 380 L ${x - 14} 380 Z`} fill={P.night ? '#FFE7A6' : '#F4F1E6'} /><rect x={x - 22} y={372} width={44} height={10} rx={3} fill={P.lamp} /></g>)}
      </g>
      {/* lá rơi */}
      {[0, 1, 2, 3].map((i) => { const t = ((frame + i * 50) % 200) / 200, x = [120, 300, 860, 960][i] + Math.sin(t * 9 + i) * 40, y = 260 + t * 800; return <ellipse key={i} cx={x} cy={y} rx={10} ry={5} fill={P.trees[1]} opacity={0.9 * Math.min(1, (1 - t) * 4)} transform={`rotate(${t * 400 + i * 40} ${x} ${y})`} />; })}
    </g>
  );
};
// ghế đá công viên: tựa lưng gỗ sau lưng nhân vật (thay cho ghế văn phòng)
const ParkBench: React.FC<{ P: ParkP }> = ({ P }) => (
  <g>
    {[60, 540, 1020].map((x) => <rect key={x} x={x - 9} y={900} width={18} height={280} rx={6} fill="#2E3440" />)}
    {[910, 972].map((y) => <g key={y}><rect x={20} y={y} width={1040} height={48} rx={12} fill={P.bench[0]} /><rect x={20} y={y + 36} width={1040} height={12} rx={6} fill={P.bench[1]} /><rect x={36} y={y + 8} width={1008} height={5} rx={2} fill="#fff" opacity={0.15} /></g>)}
    {[60, 540, 1020].map((x) => <circle key={x} cx={x} cy={958} r={7} fill="#2E3440" />)}
  </g>
);

// ════════════ CỬA HÀNG (tạp hoá / tiện lợi) ════════════
const SHOP = { wall: ['#FBF3E4', '#F1E2C8'], ceil: '#FFFFFF', unit: '#D5DAE1', edge: '#E2574C', floor: '#D8D2C6', haze: 'rgba(255,250,240,.08)' };
const ShopShelf: React.FC<{ x0: number; x1: number; seed: number }> = ({ x0, x1, seed }) => {
  const r = rnd(seed);
  const C = ['#E2574C', '#3E7BD6', '#F2B93B', '#4FA86C', '#8E6CC9', '#FF8A5B', '#2FB5B0', '#F4F4F0'];
  const items: React.ReactNode[] = [];
  [480, 630, 780, 930].forEach((sy, s) => {
    for (let x = x0 + 14; x < x1 - 40; ) {
      const kind = r(), c = C[Math.floor(r() * C.length)];
      if (kind < 0.4) { const w = 30 + r() * 26, h = 70 + r() * 50; items.push(<g key={`${s}-${x}`}><rect x={x} y={sy - h} width={w} height={h} rx={3} fill={c} /><rect x={x + 5} y={sy - h + 14} width={w - 10} height={16} rx={2} fill="#fff" opacity={0.75} /></g>); x += w + 4; }
      else if (kind < 0.72) { const h = 80 + r() * 30; items.push(<g key={`${s}-${x}`}><rect x={x + 6} y={sy - h - 14} width={12} height={16} rx={2} fill="#F4F4F0" /><rect x={x} y={sy - h} width={24} height={h} rx={9} fill={c} /><rect x={x} y={sy - h * 0.6} width={24} height={20} fill="#fff" opacity={0.6} /></g>); x += 28; }
      else { const n = 2 + Math.floor(r() * 2); for (let k = 0; k < n; k++) items.push(<g key={`${s}-${x}-${k}`}><rect x={x + k * 26} y={sy - 50} width={22} height={50} rx={5} fill={c} /><rect x={x + k * 26} y={sy - 50} width={22} height={7} rx={3} fill="#C9CCD3" /></g>); x += n * 26 + 6; }
    }
  });
  return (
    <g>
      <rect x={x0} y={300} width={x1 - x0} height={804} fill={SHOP.unit} />
      <rect x={x0 + 8} y={310} width={x1 - x0 - 16} height={790} fill="#000" opacity={0.08} />
      {items}
      {[480, 630, 780, 930].map((sy) => <g key={sy}><rect x={x0} y={sy} width={x1 - x0} height={16} fill="#F4F4F0" /><rect x={x0} y={sy + 4} width={x1 - x0} height={10} fill={SHOP.edge} opacity={0.85} />{Array.from({ length: Math.floor((x1 - x0) / 90) }, (_, i) => <rect key={i} x={x0 + 20 + i * 90} y={sy + 3} width={34} height={12} rx={2} fill="#FFE566" />)}</g>)}
      <rect x={x0} y={300} width={x1 - x0} height={24} fill={SHOP.edge} />
    </g>
  );
};
const ShopBack: React.FC<{ frame: number; id: string }> = ({ frame, id }) => {
  const P = SHOP;
  const sec = (frame / 30) * 6;
  const ck = { x: 770, y: 470, r: 42 };
  return (
    <g>
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.wall[0]} /><stop offset="1" stopColor={P.wall[1]} /></linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#EAF7FF" /><stop offset="1" stopColor="#C9E6F7" /></linearGradient>
      </defs>
      <rect x={X0} y={0} width={XW} height={1104} fill={`url(#${id}w)`} />
      <rect x={X0} y={0} width={XW} height={280} fill={P.ceil} />
      {[100, 540, 980].map((x) => <g key={x}><rect x={x - 160} y={176} width={320} height={18} rx={9} fill="#F4FBFF" /><rect x={x - 160} y={190} width={320} height={5} fill="#000" opacity={0.08} /></g>)}
      <rect x={X0} y={270} width={XW} height={12} fill="#000" opacity={0.07} />
      {/* cờ dây */}
      {[0, 1].map((j) => (
        <g key={j}>
          <path d={`M ${X0} ${300 + j * 6} Q 540 ${360 + j * 30} ${X0 + XW} ${300 + j * 6}`} fill="none" stroke="#5B6474" strokeWidth={2} />
          {Array.from({ length: 18 }, (_, i) => { const t = (i + 0.5 + j * 0.5) / 18, x = X0 + t * XW, y = 300 + j * 6 + 4 * t * (1 - t) * (60 + j * 24); return <path key={i} d={`M ${x - 18} ${y} L ${x + 18} ${y} L ${x} ${y + 36} Z`} fill={['#E2574C', '#F2B93B', '#3E7BD6', '#4FA86C'][(i + j) % 4]} />; })}
        </g>
      ))}
      <ShopShelf x0={X0} x1={250} seed={61} />
      <ShopShelf x0={830} x1={X0 + XW} seed={62} />
      {/* tủ mát đồ uống */}
      <g>
        <rect x={398} y={466} width={284} height={630} rx={14} fill="#F4F6F8" />
        <rect x={398} y={466} width={284} height={64} rx={14} fill="#3E7BD6" />
        <rect x={398} y={512} width={284} height={18} fill="#3E7BD6" />
        <path d="M 540 482 q 16 18 0 32 q -16 -14 0 -32 z" fill="#fff" />
        <rect x={416} y={544} width={248} height={530} rx={6} fill={`url(#${id}f)`} />
        {[650, 760, 870, 980].map((sy, s) => (
          <g key={sy}>
            {Array.from({ length: 7 }, (_, i) => { const c = [['#E2574C', '#4FA86C', '#F2B93B'], ['#3E7BD6', '#E2574C', '#FF8A5B'], ['#4FA86C', '#8E6CC9', '#F2B93B'], ['#2FB5B0', '#E2574C', '#3E7BD6']][s][i % 3]; return <g key={i}><rect x={428 + i * 34} y={sy - 84} width={24} height={84} rx={8} fill={c} /><rect x={434 + i * 34} y={sy - 96} width={12} height={14} rx={2} fill="#F4F4F0" /><rect x={428 + i * 34} y={sy - 52} width={24} height={18} fill="#fff" opacity={0.55} /></g>; })}
            <rect x={416} y={sy} width={248} height={8} fill="#B9C6D2" />
          </g>
        ))}
        <path d="M 430 560 L 480 560 L 430 700 Z M 540 560 L 560 560 L 470 1060 L 450 1060 Z" fill="#fff" opacity={0.25} />
        <rect x={640} y={700} width={12} height={150} rx={6} fill="#C3CBD4" />
      </g>
      {/* đồng hồ */}
      <g>
        <circle cx={ck.x} cy={ck.y} r={ck.r + 6} fill="#3A3F4B" />
        <circle cx={ck.x} cy={ck.y} r={ck.r} fill="#FBFBF8" />
        <line x1={ck.x} y1={ck.y} x2={ck.x} y2={ck.y - ck.r * 0.5} stroke="#3A3F4B" strokeWidth={5} strokeLinecap="round" transform={`rotate(300 ${ck.x} ${ck.y})`} />
        <line x1={ck.x} y1={ck.y} x2={ck.x} y2={ck.y - ck.r * 0.74} stroke="#3A3F4B" strokeWidth={4} strokeLinecap="round" transform={`rotate(${60 + sec / 60} ${ck.x} ${ck.y})`} />
        <line x1={ck.x} y1={ck.y + 8} x2={ck.x} y2={ck.y - ck.r * 0.8} stroke="#E2342B" strokeWidth={2} transform={`rotate(${sec} ${ck.x} ${ck.y})`} />
      </g>
      <rect x={X0} y={1104} width={XW} height={820} fill={P.floor} />
      <rect x={X0} y={1094} width={XW} height={12} fill="#000" opacity={0.14} />
    </g>
  );
};

// ════════════ PHÒNG TIẾP DÂN (trụ sở công an phường) — vẽ chung chung, không phù hiệu/quốc huy ════════════
const POLICE = { wall: ['#F7E9B6', '#EEDA98'], ceil: '#FBF8EE', wain: ['#6E7F6A', '#5E6E5A'], floor: '#D9CDB4', banner: '#C8261E', gold: '#FFD84A', wood: ['#8A5A3A', '#6E452C'], haze: 'rgba(255,245,215,.08)' };
const PoliceBack: React.FC<{ frame: number; id: string }> = ({ frame, id }) => {
  const P = POLICE;
  const fan = (cx: number, ph: number) => {
    const a = frame * 0.5 + ph;
    return (
      <g>
        <rect x={cx - 3} y={0} width={6} height={176} fill="#5B6474" />
        {[0, 1, 2].map((i) => { const t = a + (i * 2 * Math.PI) / 3; const ex = Math.cos(t) * 120, ey = Math.sin(t) * 22; return <ellipse key={i} cx={cx + ex / 2} cy={196 + ey / 2} rx={Math.max(14, Math.abs(ex) / 2 + 12)} ry={9} fill="#8A6A4A" opacity={0.9} />; })}
        <ellipse cx={cx} cy={190} rx={26} ry={16} fill="#5B6474" />
        <ellipse cx={cx} cy={182} rx={16} ry={8} fill="#7A8494" />
      </g>
    );
  };
  return (
    <g>
      <defs>
        <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={P.wall[0]} /><stop offset="1" stopColor={P.wall[1]} /></linearGradient>
      </defs>
      <rect x={X0} y={0} width={XW} height={1104} fill={`url(#${id}w)`} />
      <rect x={X0} y={0} width={XW} height={270} fill={P.ceil} />
      <rect x={X0} y={262} width={XW} height={16} fill="#E2CF8E" />
      {fan(250, 0)}
      {fan(830, 1.3)}
      {/* băng rôn đỏ chữ vàng */}
      <g>
        <rect x={40} y={432} width={1000} height={84} rx={4} fill={P.banner} />
        <rect x={40} y={432} width={1000} height={8} fill="#000" opacity={0.12} />
        {[40, 1040].map((x) => <rect key={x} x={x - 6} y={424} width={12} height={100} rx={4} fill="#8A1A14" />)}
        <text x={540} y={488} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={38} letterSpacing={1.5} fill={P.gold}>CẢNH GIÁC LỪA ĐẢO QUA MẠNG</text>
      </g>
      {/* bảng thông báo */}
      <g transform="translate(14 572)">
        <rect width={186} height={230} rx={6} fill="#7A5236" />
        <rect x={10} y={10} width={166} height={210} fill="#D9B98A" />
        {[[22, 22, 64, 84, -4, '#fff'], [98, 20, 66, 72, 3, '#FFF6C8'], [24, 120, 70, 88, 2, '#fff'], [104, 104, 60, 96, -3, '#E8F2FF']].map(([x, y, w, h, r, c], i) => (
          <g key={i} transform={`rotate(${r} ${(x as number) + (w as number) / 2} ${y as number})`}>
            <rect x={x as number} y={y as number} width={w as number} height={h as number} fill={c as string} />
            {[0, 1, 2, 3].map((k) => <rect key={k} x={(x as number) + 8} y={(y as number) + 16 + k * 14} width={(w as number) - 16 - (k % 2) * 12} height={5} rx={2} fill="#141826" opacity={0.3} />)}
            <circle cx={(x as number) + (w as number) / 2} cy={(y as number) + 5} r={5} fill="#E2342B" />
          </g>
        ))}
      </g>
      {/* đồng hồ treo */}
      <g>
        <circle cx={540} cy={620} r={44} fill="#3A3F4B" />
        <circle cx={540} cy={620} r={38} fill="#FBFBF8" />
        <line x1={540} y1={620} x2={540} y2={598} stroke="#3A3F4B" strokeWidth={5} strokeLinecap="round" transform="rotate(280 540 620)" />
        <line x1={540} y1={620} x2={540} y2={590} stroke="#3A3F4B" strokeWidth={3} strokeLinecap="round" transform={`rotate(${(frame / 30) * 0.1 + 60} 540 620)`} />
        <line x1={540} y1={626} x2={540} y2={588} stroke="#E2342B" strokeWidth={2} transform={`rotate(${(frame / 30) * 6} 540 620)`} />
      </g>
      {/* tủ hồ sơ kính */}
      <g transform="translate(870 560)">
        <rect width={250} height={480} rx={6} fill={P.wood[0]} />
        <rect x={14} y={14} width={222} height={296} rx={3} fill="#CFE3EE" opacity={0.55} />
        {[0, 1].map((r) => <g key={r}>{Array.from({ length: 7 }, (_, i) => <rect key={i} x={24 + i * 30} y={30 + r * 146} width={24} height={118} rx={3} fill={['#2F6DB5', '#C8261E', '#E9C46A', '#2F6DB5', '#4FA86C', '#E9C46A', '#2F6DB5'][(i + r * 3) % 7]} />)}<rect x={14} y={150 + r * 146} width={222} height={8} fill={P.wood[1]} /></g>)}
        <rect x={122} y={14} width={6} height={296} fill={P.wood[1]} />
        <path d="M 30 24 L 70 24 L 30 120 Z" fill="#fff" opacity={0.25} />
        <rect x={14} y={324} width={222} height={142} rx={3} fill={P.wood[1]} />
        <rect x={122} y={324} width={6} height={142} fill={P.wood[0]} />
        <circle cx={110} cy={394} r={6} fill={P.gold} /><circle cx={140} cy={394} r={6} fill={P.gold} />
      </g>
      {/* ốp chân tường + sàn gạch */}
      <rect x={X0} y={960} width={XW} height={144} fill={P.wain[0]} />
      <rect x={X0} y={956} width={XW} height={10} fill={P.wain[1]} />
      <rect x={X0} y={1104} width={XW} height={820} fill={P.floor} />
      <rect x={X0} y={1094} width={XW} height={12} fill="#000" opacity={0.14} />
      <Plant x={1180} y={1140} k={1.1} pot="#C8261E" />
    </g>
  );
};

// đồ bày mép dưới mặt bàn/quầy của các bối cảnh mới
const DressNew: React.FC<{ set: string; time: string; frame: number }> = ({ set, time, frame }) => {
  const night = time === 'toi' || time === 'dem';
  if (set === 'quan-ca-phe')
    return (
      <g>
        {/* cà phê phin trên ly */}
        <ellipse cx={250} cy={1868} rx={150} ry={26} fill="#000" opacity={0.2} />
        <ellipse cx={250} cy={1850} rx={140} ry={30} fill="#F4F1EA" />
        <path d="M 170 1630 L 330 1630 L 316 1848 Q 250 1866 184 1848 Z" fill="#fff" opacity={0.55} />
        <path d="M 178 1720 L 322 1720 L 316 1848 Q 250 1866 184 1848 Z" fill="#5A3322" />
        <path d="M 182 1790 L 318 1790 L 316 1848 Q 250 1866 184 1848 Z" fill="#E9D7B8" />
        <rect x={186} y={1640} width={14} height={190} rx={7} fill="#fff" opacity={0.4} />
        <ellipse cx={250} cy={1630} rx={96} ry={18} fill="#C9CED6" />
        <path d="M 196 1520 L 304 1520 L 300 1626 L 200 1626 Z" fill="#D7DCE3" />
        <rect x={196} y={1520} width={108} height={14} fill="#B8BFC9" />
        <ellipse cx={250} cy={1508} rx={60} ry={14} fill="#C9CED6" />
        <rect x={238} y={1484} width={24} height={20} rx={6} fill="#B8BFC9" />
        <rect x={214} y={1550} width={12} height={60} rx={6} fill="#fff" opacity={0.5} />
        {/* ly latte vẽ hình trái tim + đĩa */}
        <ellipse cx={690} cy={1800} rx={190} ry={54} fill="#000" opacity={0.18} />
        <ellipse cx={690} cy={1780} rx={180} ry={52} fill="#F7F3EA" />
        <ellipse cx={690} cy={1774} rx={120} ry={30} fill="#E9E2D4" />
        <path d={`M 800 1690 q 70 -6 64 44 q -6 40 -64 36`} fill="none" stroke="#F4F4F0" strokeWidth={22} />
        <path d="M 570 1660 L 810 1660 L 790 1770 Q 690 1800 590 1770 Z" fill="#F4F4F0" />
        <ellipse cx={690} cy={1660} rx={120} ry={34} fill="#B5835A" />
        <path d="M 690 1676 C 650 1650 650 1630 672 1630 C 684 1630 690 1640 690 1646 C 690 1640 696 1630 708 1630 C 730 1630 730 1650 690 1676 Z" fill="#F7EBDD" />
        {[0, 1].map((i) => <path key={i} d={`M ${672 + i * 36} 1610 q ${10 * Math.sin(frame / 12 + i)} -26 0 -52 q ${-10 * Math.sin(frame / 12 + i)} -24 0 -48`} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={6} strokeLinecap="round" />)}
        {/* bình hoa nhỏ */}
        <g transform="translate(960 1700)">
          <path d="M -30 0 Q -44 60 -24 120 L 24 120 Q 44 60 30 0 Z" fill={night ? '#9AA9C8' : '#BFD8EE'} opacity={0.85} />
          <path d="M 0 0 Q -10 -70 -30 -120 M 0 0 Q 8 -60 24 -130 M 0 0 Q 2 -50 0 -90" fill="none" stroke="#3E8E5A" strokeWidth={5} />
          {[[-30, -120, '#F28FA6'], [24, -130, '#FFD21F'], [0, -90, '#fff']].map(([x, y, c], i) => <g key={i}>{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={(x as number) + 12 * Math.cos((a * Math.PI) / 180)} cy={(y as number) + 12 * Math.sin((a * Math.PI) / 180)} r={10} fill={c as string} />)}<circle cx={x as number} cy={y as number} r={7} fill="#F2B93B" /></g>)}
        </g>
      </g>
    );
  if (set === 'ngan-hang')
    return (
      <g>
        {/* xấp giấy nộp tiền + giá bút có dây */}
        <g transform="rotate(-5 250 1720)">
          {[2, 1, 0].map((i) => <rect key={i} x={70 + i * 8} y={1580 - i * 8} width={380} height={270} rx={6} fill={i ? '#E7EDF4' : '#FFFFFF'} stroke="#C8D2DE" strokeWidth={3} />)}
          <rect x={70} y={1580} width={380} height={50} rx={6} fill="#1F4E8C" />
          <rect x={92} y={1596} width={180} height={16} rx={6} fill="#fff" opacity={0.85} />
          {[0, 1, 2, 3, 4].map((i) => <g key={i}><rect x={96} y={1658 + i * 36} width={110} height={10} rx={5} fill="#141826" opacity={0.3} /><rect x={220} y={1668 + i * 36} width={200} height={3} fill="#141826" opacity={0.25} /></g>)}
        </g>
        <path d="M 600 1820 C 560 1760 640 1740 600 1690 C 570 1650 620 1630 610 1600" fill="none" stroke="#9AA3B5" strokeWidth={5} strokeDasharray="10 5" />
        <ellipse cx={600} cy={1836} rx={70} ry={20} fill="#2B303B" />
        <rect x={576} y={1800} width={48} height={36} rx={8} fill="#3A404D" />
        <g transform="rotate(30 640 1580)"><rect x={628} y={1480} width={20} height={200} rx={8} fill="#1F4E8C" /><path d="M 628 1680 L 648 1680 L 638 1712 Z" fill="#F2D2A9" /></g>
        {/* chuông quầy + phiếu số */}
        <ellipse cx={900} cy={1840} rx={110} ry={22} fill="#000" opacity={0.2} />
        <rect x={800} y={1806} width={200} height={30} rx={10} fill="#2B303B" />
        <path d="M 820 1808 Q 820 1700 900 1700 Q 980 1700 980 1808 Z" fill="#E7C766" />
        <path d="M 850 1760 Q 860 1724 892 1716" fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={8} strokeLinecap="round" />
        <rect x={890} y={1676} width={20} height={26} rx={6} fill="#C9A23A" />
        <g transform="rotate(-10 820 1640)">
          <rect x={740} y={1590} width={150} height={96} rx={6} fill="#FFFDF5" stroke="#E2D9C2" strokeWidth={3} />
          <text x={815} y={1652} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight={700} fontSize={40} fill="#E2342B">0248</text>
        </g>
      </g>
    );
  if (set === 'phong-hop')
    return (
      <g>
        {/* sổ + bút */}
        <g transform="rotate(-6 260 1720)">
          <rect x={70} y={1570} width={360} height={290} rx={14} fill="#2F3B57" />
          <rect x={86} y={1584} width={328} height={262} rx={6} fill="#FBF8F0" />
          {Array.from({ length: 7 }, (_, i) => <rect key={i} x={106} y={1616 + i * 32} width={[240, 200, 260, 180, 230, 150, 210][i]} height={8} rx={4} fill="#141826" opacity={0.2} />)}
          <rect x={106} y={1610} width={110} height={20} rx={4} fill="#9AD8FF" opacity={0.8} />
        </g>
        <g transform="rotate(28 500 1700)"><rect x={488} y={1580} width={20} height={230} rx={8} fill="#141826" /><path d="M 488 1810 L 508 1810 L 498 1842 Z" fill="#C9CED6" /></g>
        {/* loa hội nghị */}
        <ellipse cx={700} cy={1640} rx={130} ry={30} fill="#000" opacity={0.18} />
        <path d="M 590 1630 Q 700 1560 810 1630 Q 700 1670 590 1630 Z" fill="#2B303B" />
        <path d="M 600 1626 Q 700 1574 800 1626" fill="none" stroke="#454C5C" strokeWidth={6} />
        <circle cx={700} cy={1612} r={10} fill={Math.floor(frame / 15) % 2 ? '#35E0A1' : '#1F8F64'} />
        {/* chai nước + cốc */}
        <g transform="translate(930 1640)">
          <ellipse cx={0} cy={232} rx={70} ry={14} fill="#000" opacity={0.18} />
          <rect x={-46} y={0} width={92} height={232} rx={26} fill="#CFE7F7" opacity={0.75} />
          <rect x={-46} y={80} width={92} height={60} fill="#3E7BD6" opacity={0.8} />
          <rect x={-22} y={-36} width={44} height={40} rx={8} fill="#3E7BD6" />
          <rect x={-34} y={20} width={12} height={180} rx={6} fill="#fff" opacity={0.5} />
        </g>
      </g>
    );
  if (set === 'ngoai-troi')
    return (
      <g>
        {/* hai cốc trà đá */}
        {[[170, 1700], [370, 1740]].map(([x, y], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y + 150} rx={86} ry={18} fill="#000" opacity={0.2} />
            <path d={`M ${x - 78} ${y - 30} L ${x + 78} ${y - 30} L ${x + 64} ${y + 150} L ${x - 64} ${y + 150} Z`} fill="#fff" opacity={0.4} />
            <path d={`M ${x - 72} ${y + 10} L ${x + 72} ${y + 10} L ${x + 64} ${y + 150} L ${x - 64} ${y + 150} Z`} fill="#C9782E" opacity={0.85} />
            {[[-30, 30], [16, 46], [-8, 80], [34, 90]].map(([dx, dy], k) => <rect key={k} x={x + dx - 18} y={y + dy - 18} width={36} height={34} rx={6} fill="#fff" opacity={0.45} transform={`rotate(${k * 23} ${x + dx} ${y + dy})`} />)}
            <rect x={x - 66} y={y - 20} width={14} height={160} rx={7} fill="#fff" opacity={0.45} />
          </g>
        ))}
        {/* bánh mì gói giấy */}
        <g transform="rotate(-12 800 1760)">
          <ellipse cx={800} cy={1860} rx={200} ry={26} fill="#000" opacity={0.18} />
          <path d="M 620 1760 Q 640 1680 800 1676 Q 960 1680 980 1760 Q 960 1840 800 1844 Q 640 1840 620 1760 Z" fill="#D9984E" />
          <path d="M 650 1730 Q 800 1700 950 1730" fill="none" stroke="#B87430" strokeWidth={8} strokeLinecap="round" />
          <path d="M 680 1760 L 720 1720 M 760 1752 L 800 1712 M 840 1752 L 880 1714" stroke="#F2C98A" strokeWidth={8} strokeLinecap="round" />
          <path d="M 600 1780 L 1000 1780 L 960 1880 L 640 1880 Z" fill="#F4ECDC" />
          <path d="M 600 1780 L 1000 1780 L 990 1800 L 610 1800 Z" fill="#000" opacity={0.06} />
          <rect x={720} y={1820} width={160} height={10} rx={5} fill="#E2574C" opacity={0.6} />
        </g>
        {/* lá rụng */}
        {[[520, 1600, 30], [960, 1620, -40], [560, 1880, 70]].map(([x, y, a], i) => <g key={i} transform={`rotate(${a} ${x} ${y})`}><ellipse cx={x} cy={y} rx={34} ry={15} fill={time === 'chieu' ? '#E0A040' : night ? '#3E5A3A' : '#7DBA66'} /><path d={`M ${x - 34} ${y} L ${x + 34} ${y}`} stroke="#000" strokeOpacity={0.2} strokeWidth={3} /></g>)}
      </g>
    );
  if (set === 'cong-an')
    return (
      <g>
        {/* đơn trình báo + con dấu */}
        <g transform="rotate(-5 260 1720)">
          <rect x={70} y={1560} width={380} height={300} rx={6} fill="#FFFFFF" />
          <rect x={70} y={1560} width={380} height={300} rx={6} fill="none" stroke="#000" strokeOpacity={0.1} strokeWidth={3} />
          <text x={260} y={1612} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={28} fill="#141826">ĐƠN TRÌNH BÁO</text>
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={100} y={1644 + i * 34} width={[310, 270, 300, 240, 200][i]} height={9} rx={4} fill="#141826" opacity={0.22} />)}
          <circle cx={380} cy={1810} r={34} fill="none" stroke="#C8261E" strokeWidth={5} opacity={0.75} />
        </g>
        <g transform="translate(560 1660)">
          <ellipse cx={0} cy={150} rx={80} ry={16} fill="#000" opacity={0.2} />
          <rect x={-60} y={110} width={120} height={40} rx={8} fill="#C8261E" />
          <rect x={-46} y={30} width={92} height={84} rx={10} fill="#3A2A20" />
          <rect x={-22} y={-30} width={44} height={64} rx={20} fill="#3A2A20" />
          <ellipse cx={0} cy={-30} rx={24} ry={10} fill="#5A4030" />
        </g>
        {/* ấm chén trà */}
        <g transform="translate(860 1720)">
          <ellipse cx={0} cy={150} rx={200} ry={30} fill="#000" opacity={0.18} />
          <ellipse cx={0} cy={140} rx={190} ry={34} fill="#C9A86A" />
          <path d="M -70 20 Q -90 120 -40 140 L 40 140 Q 90 120 70 20 Z" fill="#F4F1EA" />
          <path d="M 64 50 Q 130 30 140 -10" fill="none" stroke="#F4F1EA" strokeWidth={18} strokeLinecap="round" />
          <path d="M -66 40 Q -120 60 -90 110" fill="none" stroke="#F4F1EA" strokeWidth={14} />
          <ellipse cx={0} cy={20} rx={70} ry={16} fill="#E4DED2" />
          <circle cx={0} cy={6} r={14} fill="#E4DED2" />
          <path d="M -60 80 Q 0 96 60 80" fill="none" stroke="#2F6DB5" strokeWidth={6} />
          {[[-140, 120], [130, 126]].map(([x, y], i) => <g key={i}><path d={`M ${x - 30} ${y - 40} L ${x + 30} ${y - 40} L ${x + 22} ${y} L ${x - 22} ${y} Z`} fill="#F4F1EA" /><ellipse cx={x} cy={y - 40} rx={30} ry={8} fill="#B8742E" /><path d={`M ${x - 22} ${y - 20} L ${x + 22} ${y - 20}`} stroke="#2F6DB5" strokeWidth={4} /></g>)}
        </g>
      </g>
    );
  if (set === 'cua-hang') {
    const q = rnd(4242);
    return (
      <g>
        {/* bảng mã QR thanh toán trên quầy */}
        <g transform="rotate(-4 250 1720)">
          <rect x={150} y={1840} width={200} height={26} rx={8} fill="#B9C3CF" />
          <rect x={110} y={1500} width={280} height={350} rx={18} fill="#fff" stroke="#D5DCE4" strokeWidth={5} />
          <rect x={110} y={1500} width={280} height={60} rx={18} fill="#E2342B" />
          <rect x={110} y={1540} width={280} height={20} fill="#E2342B" />
          <text x={250} y={1542} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={30} letterSpacing={1} fill="#fff">QUÉT MÃ</text>
          <g transform="translate(150 1580)">
            <rect width={200} height={200} fill="#fff" />
            {Array.from({ length: 100 }, (_, i) => { const cx = i % 10, cy = Math.floor(i / 10); const corner = (cx < 3 && cy < 3) || (cx > 6 && cy < 3) || (cx < 3 && cy > 6); return !corner && q() > 0.5 ? <rect key={i} x={cx * 20} y={cy * 20} width={20} height={20} fill="#141826" /> : null; })}
            {[[0, 0], [140, 0], [0, 140]].map(([x, y], i) => <g key={i}><rect x={x} y={y} width={60} height={60} fill="#141826" /><rect x={x + 10} y={y + 10} width={40} height={40} fill="#fff" /><rect x={x + 20} y={y + 20} width={20} height={20} fill="#141826" /></g>)}
          </g>
          <rect x={160} y={1800} width={180} height={12} rx={6} fill="#141826" opacity={0.3} />
        </g>
        {/* máy quẹt thẻ */}
        <g transform="rotate(8 680 1740)">
          <ellipse cx={680} cy={1880} rx={120} ry={20} fill="#000" opacity={0.2} />
          <path d="M 600 1600 L 760 1600 L 780 1870 L 580 1870 Z" fill="#2B303B" />
          <rect x={614} y={1616} width={132} height={90} rx={8} fill={Math.floor(frame / 24) % 2 ? '#4EA8FF' : '#7FC1FF'} />
          <rect x={628} y={1636} width={70} height={10} rx={5} fill="#fff" opacity={0.85} />
          <rect x={628} y={1658} width={100} height={22} rx={5} fill="#fff" opacity={0.5} />
          {Array.from({ length: 12 }, (_, i) => <rect key={i} x={614 + (i % 3) * 46} y={1728 + Math.floor(i / 3) * 34} width={38} height={26} rx={6} fill={i === 9 ? '#E2574C' : i === 11 ? '#35C47A' : '#454C5C'} />)}
        </g>
        {/* hũ kẹo */}
        <g transform="translate(940 1720)">
          <ellipse cx={0} cy={150} rx={96} ry={18} fill="#000" opacity={0.18} />
          <path d="M -80 -40 Q -96 60 -70 150 L 70 150 Q 96 60 80 -40 Z" fill="#E6F3FA" opacity={0.7} />
          {[[-40, 100, '#E2574C'], [10, 110, '#F2B93B'], [44, 90, '#4FA86C'], [-20, 60, '#8E6CC9'], [30, 50, '#3E7BD6'], [-50, 30, '#FF8A5B'], [0, 20, '#E2574C']].map(([x, y, c], i) => <circle key={i} cx={x as number} cy={y as number} r={24} fill={c as string} />)}
          <rect x={-70} y={-62} width={140} height={28} rx={8} fill="#E2574C" />
          <rect x={-60} y={-30} width={10} height={170} rx={5} fill="#fff" opacity={0.5} />
        </g>
      </g>
    );
  }
  return null;
};

export const defaultTime = (set: string) => SETS[set]?.times[0] ?? 'ngay';

type BackProps = { time: string; frame: number; logo?: boolean; id: string };
const BACK: Record<string, React.FC<BackProps>> = {
  'van-phong': OfficeBack,
  nha: HomeBack,
  'hang-o': DenBack,
  'quan-ca-phe': CafeBack,
  'ngan-hang': BankBack,
  'phong-hop': MeetBack,
  'ngoai-troi': ParkBack,
  'cua-hang': ShopBack,
  'cong-an': PoliceBack,
};
const HAZE: Record<string, (t: string) => string> = {
  'van-phong': (t) => (OFFICE[t] ?? OFFICE.ngay).haze,
  nha: (t) => (HOME[t] ?? HOME.dem).haze,
  'hang-o': () => 'rgba(10,8,30,.2)',
  'quan-ca-phe': (t) => (CAFE[t] ?? CAFE.ngay).haze,
  'ngan-hang': () => BANK.haze,
  'phong-hop': (t) => (MEET[t] ?? MEET.ngay).haze,
  'ngoai-troi': (t) => (PARK[t] ?? PARK.ngay).haze,
  'cua-hang': () => SHOP.haze,
  'cong-an': () => POLICE.haze,
};

// ghế tựa sau lưng nhân vật ngồi (story.tsx vẽ); null = không ghế (ở nhà: sofa; ngoài trời: ghế đá vẽ sẵn; cửa hàng: đứng quầy)
export type Seat = { back: string; pad: string; tall?: boolean; stripe?: string };
const SEATS: Record<string, Seat | null> = {
  'van-phong': { back: '#3E4658', pad: '#4A5368' },
  nha: null,
  'hang-o': { back: '#10121E', pad: '#1A1D2E', tall: true, stripe: '#E2342B' },
  'quan-ca-phe': { back: '#6E4A33', pad: '#87603F' },
  'ngan-hang': { back: '#3E4658', pad: '#4A5368' },
  'phong-hop': { back: '#2C303B', pad: '#3A404E', tall: true },
  'ngoai-troi': null,
  'cua-hang': null,
  'cong-an': { back: '#6E4A33', pad: '#87603F' },
};
export const seatFor = (set: string): Seat | null => (set in SEATS ? SEATS[set] : SEATS['van-phong']);
// bối cảnh có người phụ ngồi phía sau (đồng nghiệp / khách quán / giao dịch viên)
export const hasExtras = (set: string) => set === 'van-phong' || set === 'quan-ca-phe' || set === 'ngan-hang';

export const SetBack: React.FC<{ set: string; time?: string; frame: number; logo?: boolean }> = ({ set, time, frame, logo }) => {
  const id = 's' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const t = time ?? defaultTime(set);
  return (
    <svg width="100%" height="100%" viewBox={`${X0} 0 ${XW} ${WORLD.H}`} style={{ display: 'block' }}>
      {React.createElement(BACK[set] ?? OfficeBack, { time: t, frame, logo, id })}
    </svg>
  );
};

// Lớp giữa: bàn + màn hình của nhân vật phụ (che nửa dưới của họ) và lớp sương tách hậu cảnh khỏi nhân vật chính
export const SetMid: React.FC<{ set: string; time?: string; extras: number[] }> = ({ set, time, extras }) => {
  const t = time ?? defaultTime(set);
  const haze = (HAZE[set] ?? HAZE['van-phong'])(t);
  const cab = set === 'van-phong' ? (OFFICE[t] ?? OFFICE.ngay).cab : '#555';
  const cafe = set === 'quan-ca-phe' ? CAFE[t] ?? CAFE.ngay : null;
  return (
    <svg width="100%" height="100%" viewBox={`${X0} 0 ${XW} ${WORLD.H}`} style={{ display: 'block' }}>
      {set === 'ngan-hang' && <BankCounter />}
      {set === 'ngoai-troi' && <ParkBench P={PARK[t] ?? PARK.ngay} />}
      {cafe && extras.map((x) => (
        <g key={x}>
          <rect x={x - 74} y={900} width={148} height={98} rx={10} fill="#BFC6D1" />
          <circle cx={x} cy={948} r={12} fill="#fff" opacity={0.6} />
          <rect x={x - 90} y={994} width={180} height={10} rx={5} fill="#9AA2AE" />
          <rect x={x + 96} y={968} width={30} height={34} rx={6} fill="#F4F4F0" />
          <path d={`M ${x + 126} ${976} q 10 2 8 12 q -2 8 -8 8`} fill="none" stroke="#F4F4F0" strokeWidth={4} />
          <rect x={x - 190} y={1002} width={380} height={22} rx={7} fill={cafe.night ? '#8A6A52' : '#D9B48A'} />
          <rect x={x - 178} y={1024} width={356} height={160} fill={cafe.wain[1]} />
          {Array.from({ length: 9 }, (_, i) => <rect key={i} x={x - 170 + i * 40} y={1024} width={3} height={160} fill="#000" opacity={0.12} />)}
          <rect x={x - 178} y={1024} width={356} height={10} fill="#000" opacity={0.15} />
        </g>
      ))}
      {set === 'van-phong' && extras.map((x) => (
        <g key={x}>
          <rect x={x - 78} y={880} width={156} height={100} rx={10} fill="#39404F" />
          <rect x={x - 66} y={892} width={132} height={76} rx={5} fill="#4A5263" />
          <rect x={x - 10} y={980} width={20} height={26} fill="#2B303B" />
          <rect x={x - 190} y={1002} width={380} height={24} rx={7} fill="#F2E9DB" />
          <rect x={x - 178} y={1026} width={356} height={160} fill={cab} />
          <rect x={x - 178} y={1026} width={356} height={10} fill="#000" opacity={0.12} />
          <rect x={x + 96} y={966} width={36} height={38} rx={6} fill="#fff" />
        </g>
      ))}
      <rect x={X0} y={0} width={XW} height={WORLD.H} fill={haze} />
    </svg>
  );
};

// ───── đồ trên bàn tiền cảnh (x = tâm, đáy đặt gần mép bàn)
export type DeskItem = { kind: string; x: number };
const DeskProp: React.FC<{ it: DeskItem; frame: number; dark: boolean }> = ({ it, frame, dark }) => {
  const x = it.x, y = WORLD.deskY;
  switch (it.kind) {
    case 'laptop':
      return (
        <g>
          <ellipse cx={x} cy={y + 30} rx={200} ry={16} fill="#000" opacity={0.18} />
          <rect x={x - 168} y={y - 196} width={336} height={216} rx={16} fill={dark ? '#2B3044' : '#C3C9D4'} />
          <rect x={x - 168} y={y - 196} width={336} height={216} rx={16} fill="none" stroke="#000" strokeOpacity={0.14} strokeWidth={4} />
          <circle cx={x} cy={y - 92} r={20} fill="#fff" opacity={dark ? 0.2 : 0.55} />
          <rect x={x - 190} y={y + 16} width={380} height={18} rx={9} fill={dark ? '#1C2033' : '#A9B0BD'} />
        </g>
      );
    case 'coc':
      return (
        <g>
          <ellipse cx={x} cy={y + 76} rx={52} ry={10} fill="#000" opacity={0.18} />
          {[0, 1].map((i) => <path key={i} d={`M ${x - 12 + i * 22} ${y - 34} q ${8 * Math.sin(frame / 12 + i)} -22 0 -44 q ${-8 * Math.sin(frame / 12 + i)} -20 0 -40`} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={5} strokeLinecap="round" />)}
          <path d={`M ${x + 34} ${y - 2} q 40 4 36 34 q -4 24 -40 20`} fill="none" stroke="#F4F4F0" strokeWidth={11} />
          <path d={`M ${x - 40} ${y - 22} L ${x + 40} ${y - 22} L ${x + 34} ${y + 66} Q ${x} ${y + 78} ${x - 34} ${y + 66} Z`} fill="#F4F4F0" />
          <ellipse cx={x} cy={y - 22} rx={40} ry={9} fill="#6B4630" />
          <rect x={x - 38} y={y + 14} width={76} height={12} fill="#E2342B" />
        </g>
      );
    case 'dien-thoai':
      return (
        <g transform={`rotate(-9 ${x} ${y + 50})`}>
          <path d={`M ${x - 52} ${y + 24} L ${x + 52} ${y + 24} L ${x + 66} ${y + 84} L ${x - 66} ${y + 84} Z`} fill="#14161F" />
          <path d={`M ${x - 45} ${y + 30} L ${x + 45} ${y + 30} L ${x + 56} ${y + 78} L ${x - 56} ${y + 78} Z`} fill={Math.floor(frame / 20) % 3 ? '#3F86F6' : '#7FB2FF'} />
        </g>
      );
    case 'cay':
      return <Plant x={x} y={y + 70} k={0.5} pot="#F2F2F2" />;
    case 'giay':
      return (
        <g>
          <path d={`M ${x - 80} ${y + 22} L ${x + 70} ${y + 18} L ${x + 92} ${y + 80} L ${x - 96} ${y + 84} Z`} fill="#fff" />
          <path d={`M ${x - 70} ${y + 30} L ${x + 80} ${y + 26} L ${x + 102} ${y + 86} L ${x - 86} ${y + 90} Z`} fill="#F4F2EA" />
          {[0, 1, 2].map((i) => <path key={i} d={`M ${x - 56 - i * 4} ${y + 44 + i * 13} l ${120 - i * 20} -3`} stroke="#9AA3B5" strokeWidth={4} strokeLinecap="round" />)}
        </g>
      );
    case 'ban-phim':
      return (
        <g>
          <path d={`M ${x - 170} ${y + 24} L ${x + 170} ${y + 24} L ${x + 196} ${y + 84} L ${x - 196} ${y + 84} Z`} fill="#0B0D18" />
          {Array.from({ length: 36 }, (_, i) => { const row = Math.floor(i / 12), col = i % 12; const lit = (Math.floor(frame / 4) + i * 7) % 19 === 0; return <rect key={i} x={x - 160 - row * 8 + col * (27 + row * 1.3)} y={y + 30 + row * 17} width={20} height={11} rx={3} fill={lit ? '#FF5C9A' : '#2B3050'} />; })}
        </g>
      );
    case 'lon':
      return (
        <g>
          {[0, 46].map((o, i) => <g key={i}><rect x={x - 22 + o} y={y - 36 + i * 8} width={40} height={96} rx={8} fill={i ? '#35E0A1' : '#E2342B'} /><rect x={x - 22 + o} y={y - 36 + i * 8} width={40} height={12} rx={6} fill="#C9CCD3" /><rect x={x - 14 + o} y={y - 4 + i * 8} width={24} height={30} rx={4} fill="#fff" opacity={0.3} /></g>)}
        </g>
      );
    case 'tien':
      return (
        <g>
          {[0, 1, 2].map((i) => <g key={i}><rect x={x - 70 + i * 6} y={y + 52 - i * 16} width={140} height={22} rx={4} fill="#3DA35D" /><rect x={x - 12 + i * 6} y={y + 52 - i * 16} width={24} height={22} fill="#F4F2EA" /></g>)}
        </g>
      );
    default:
      return null;
  }
};


// đồ bày ở mép dưới mặt bàn (gần máy quay, vẽ to) — lấp khoảng trống dưới dải phụ đề
const Dress: React.FC<{ set: string }> = ({ set }) => {
  if (set === 'hang-o')
    return (
      <g>
        {[[150, 1640, -14, '#35E0A1'], [300, 1700, 8, '#4EA8FF'], [210, 1800, -4, '#FF6B8B']].map(([x, y, r, c], i) => (
          <g key={i} transform={`rotate(${r} ${x} ${y})`}><rect x={(x as number) - 70} y={(y as number) - 120} width={140} height={250} rx={22} fill="#05060C" /><rect x={(x as number) - 60} y={(y as number) - 104} width={120} height={218} rx={12} fill={c as string} opacity={0.75} /><rect x={(x as number) - 44} y={(y as number) - 80} width={80} height={12} rx={6} fill="#fff" opacity={0.7} /><rect x={(x as number) - 44} y={(y as number) - 54} width={56} height={12} rx={6} fill="#fff" opacity={0.45} /></g>
        ))}
        <g transform="rotate(7 800 1720)">
          <rect x={620} y={1570} width={360} height={300} rx={10} fill="#F4F2EA" />
          <rect x={620} y={1570} width={360} height={46} rx={10} fill="#E2342B" />
          {[0, 1, 2, 3, 4].map((i) => <g key={i}><rect x={648} y={1642 + i * 44} width={22} height={22} rx={4} fill="none" stroke="#141826" strokeWidth={4} /><rect x={686} y={1648 + i * 44} width={[240, 190, 260, 170, 220][i]} height={10} rx={5} fill="#141826" opacity={0.45} /></g>)}
          <path d="M 650 1652 l 8 9 l 14 -18 M 650 1696 l 8 9 l 14 -18" fill="none" stroke="#E2342B" strokeWidth={5} strokeLinecap="round" />
        </g>
        {[[520, 1860], [470, 1800], [560, 1790]].map(([x, y], i) => <g key={i} transform={`rotate(${i * 34 - 20} ${x} ${y})`}><rect x={x - 24} y={y - 16} width={48} height={32} rx={5} fill="#F2B93B" /><rect x={x - 12} y={y - 8} width={24} height={16} rx={2} fill="#B8860B" /></g>)}
      </g>
    );
  if (set === 'nha')
    return (
      <g>
        <g transform="rotate(-7 250 1700)">
          <rect x={60} y={1560} width={400} height={300} rx={8} fill="#F6F1E7" />
          <rect x={60} y={1560} width={400} height={120} rx={8} fill="#F28FA6" />
          <rect x={86} y={1586} width={220} height={22} rx={6} fill="#fff" />
          <rect x={86} y={1622} width={150} height={14} rx={6} fill="#fff" opacity={0.7} />
          {[0, 1, 2, 3].map((i) => <rect key={i} x={86} y={1708 + i * 34} width={[340, 300, 320, 220][i]} height={12} rx={6} fill="#141826" opacity={0.22} />)}
        </g>
        <ellipse cx={800} cy={1760} rx={170} ry={62} fill="#000" opacity={0.2} />
        <path d="M 640 1690 Q 800 1790 960 1690 L 930 1750 Q 800 1830 670 1750 Z" fill="#E9E2D4" />
        <ellipse cx={800} cy={1690} rx={160} ry={46} fill="#F7F3EA" />
        {[[720, 1680, '#F2B93B'], [770, 1664, '#E2574C'], [820, 1684, '#F2B93B'], [866, 1670, '#8E6CC9'], [800, 1700, '#4FA86C'], [750, 1704, '#E2574C'], [846, 1702, '#F2B93B']].map(([x, y, c], i) => <circle key={i} cx={x as number} cy={y as number} r={22} fill={c as string} />)}
      </g>
    );
  return (
    <g>
      {/* sổ tay mở + bút */}
      <g transform="rotate(-6 270 1700)">
        <rect x={50} y={1560} width={440} height={300} rx={12} fill="#2F3B57" />
        <rect x={62} y={1568} width={206} height={284} rx={6} fill="#FBF8F0" />
        <rect x={272} y={1568} width={206} height={284} rx={6} fill="#F6F2E8" />
        {[0, 1, 2, 3, 4, 5].map((i) => <g key={i}><rect x={82} y={1600 + i * 38} width={[160, 130, 150, 110, 140, 90][i]} height={9} rx={4} fill="#141826" opacity={0.25} /><rect x={292} y={1600 + i * 38} width={[150, 160, 100, 140, 120, 150][i]} height={9} rx={4} fill="#141826" opacity={0.18} /></g>)}
        <rect x={82} y={1594} width={90} height={20} rx={4} fill="#FFD21F" opacity={0.7} />
      </g>
      <g transform="rotate(24 560 1700)"><rect x={548} y={1560} width={22} height={250} rx={8} fill="#E2342B" /><path d="M 548 1810 L 570 1810 L 559 1846 Z" fill="#F2D2A9" /><rect x={548} y={1560} width={22} height={30} rx={8} fill="#141826" /></g>
      {/* xấp giấy nhớ + chuột */}
      <g transform="rotate(9 760 1650)"><rect x={690} y={1580} width={150} height={150} fill="#FFE566" /><rect x={690} y={1580} width={150} height={150} fill="none" stroke="#000" strokeOpacity={0.12} strokeWidth={4} /><rect x={710} y={1614} width={100} height={9} rx={4} fill="#141826" opacity={0.35} /><rect x={710} y={1640} width={70} height={9} rx={4} fill="#141826" opacity={0.35} /></g>
      <ellipse cx={940} cy={1830} rx={84} ry={18} fill="#000" opacity={0.18} />
      <rect x={870} y={1690} width={140} height={200} rx={68} fill="#F4F4F0" />
      <rect x={870} y={1690} width={140} height={200} rx={68} fill="none" stroke="#000" strokeOpacity={0.12} strokeWidth={4} />
      <path d="M 940 1694 L 940 1768" stroke="#000" strokeOpacity={0.16} strokeWidth={4} />
      <rect x={930} y={1716} width={20} height={36} rx={10} fill="#9AA3B5" />
    </g>
  );
};

// mặt bàn/quầy tiền cảnh của các bối cảnh mới: c = [đỉnh, đáy, gờ]; look: go (vân gỗ) | van (vân đá) | da (đá chấm) | bong (mặt bóng)
const FRONT: Record<string, (t: string) => { c: string[]; look: 'go' | 'van' | 'da' | 'bong'; band?: string }> = {
  'quan-ca-phe': (t) => ({ c: t === 'toi' ? ['#7A5440', '#5C3D2C', '#97705A'] : ['#D8A675', '#C18C5A', '#EBC394'], look: 'go' }),
  'ngan-hang': () => ({ c: ['#7F8996', '#68717E', '#24477A'], look: 'van', band: '#F2B93B' }),
  'phong-hop': (t) => ({ c: t === 'toi' ? ['#4C515C', '#3B3F49', '#686E7A'] : ['#6E7480', '#5A5F6A', '#8C929E'], look: 'bong' }),
  'ngoai-troi': (t) => ({ c: t === 'toi' ? ['#4E5064', '#3C3E4E', '#66687E'] : t === 'chieu' ? ['#C7AC90', '#AE9378', '#DDC3A8'] : ['#A9A59C', '#928E86', '#C4C1B9'], look: 'da' }),
  'cua-hang': () => ({ c: ['#9AA3AE', '#848D99', '#E2574C'], look: 'bong', band: '#C9463C' }),
  'cong-an': () => ({ c: ['#9A6644', '#7E5134', '#B07A55'], look: 'go' }),
};

export const SetFront: React.FC<{ set: string; time?: string; frame: number; items?: DeskItem[] }> = ({ set, time, frame, items = [] }) => {
  const id = 'f' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const t = time ?? defaultTime(set);
  const F = FRONT[set]?.(t);
  const C = F ? F.c : set === 'hang-o' ? ['#22263F', '#161929', '#343A5C'] : set === 'nha' ? (t === 'dem' ? ['#7A5642', '#5E3F30', '#96705A'] : ['#B98558', '#A06F45', '#D6A479']) : t === 'toi' ? ['#7C6250', '#63493A', '#9A7C66'] : t === 'chieu' ? ['#C98452', '#B06C3E', '#E7A873'] : ['#CE9A68', '#B98050', '#E8BC8E'];
  const look = F?.look ?? 'go';
  const y = WORLD.deskY;
  const sp = rnd(909);
  return (
    <svg width="100%" height="100%" viewBox={`${X0} 0 ${XW} ${WORLD.H}`} style={{ display: 'block' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C[0]} /><stop offset="1" stopColor={C[1]} /></linearGradient></defs>
      <rect x={X0} y={y - 26} width={XW} height={40} fill="#000" opacity={0.16} />
      <rect x={X0} y={y} width={XW} height={WORLD.H - y + 400} fill={`url(#${id})`} />
      <rect x={X0} y={y} width={XW} height={14} fill={C[2]} />
      {F?.band && <rect x={X0} y={y + 14} width={XW} height={8} fill={F.band} />}
      {look === 'go' && [130, 250, 390, 520, 650].map((o, i) => <path key={i} d={`M ${X0} ${y + o} Q ${200 + i * 90} ${y + o - 14 + (i % 2) * 26} ${X0 + XW} ${y + o + 6}`} fill="none" stroke="#000" strokeOpacity={0.05} strokeWidth={5} />)}
      {look === 'van' && [[60, 300, 140], [420, 520, 210], [900, 380, 120], [-100, 620, 260], [640, 700, 180]].map(([x0, yy, w], i) => <path key={i} d={`M ${x0} ${y + yy} q ${w * 0.4} -30 ${w} 10 t ${w} -16`} fill="none" stroke="#fff" strokeOpacity={0.14} strokeWidth={4} />)}
      {look === 'da' && Array.from({ length: 140 }, (_, i) => <circle key={i} cx={X0 + sp() * XW} cy={y + 30 + sp() * 720} r={2 + sp() * 4} fill={i % 3 ? '#000' : '#fff'} opacity={i % 3 ? 0.08 : 0.14} />)}
      {look === 'bong' && <path d={`M ${X0} ${y + 60} L ${X0 + XW} ${y + 30} L ${X0 + XW} ${y + 90} L ${X0} ${y + 130} Z`} fill="#fff" opacity={0.18} />}
      {F ? <DressNew set={set} time={t} frame={frame} /> : <Dress set={set} />}
      {items.map((it, i) => <DeskProp key={i} it={it} frame={frame} dark={set === 'hang-o'} />)}
    </svg>
  );
};
