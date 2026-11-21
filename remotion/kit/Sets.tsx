import React, { useId } from 'react';
import { MisaLogo, MISA_LOGO_RATIO } from './MisaLogo';

// Bối cảnh nhiều lớp cho cảnh `story` — vẽ vector trong "thế giới" 1080×1920 (dư 200 hai bên để máy quay lia/phóng).
// Mỗi bối cảnh có 3 lớp: SetBack (tường, cửa kính, thành phố, đồ đạc) → SetMid (bàn phía sau che nửa người phụ + sương mù tách lớp)
// → [nhân vật chính] → SetFront (mặt bàn tiền cảnh, nơi đặt phụ đề). Mép bàn tiền cảnh luôn ở y = WORLD.deskY.
// set: van-phong (time: ngay | chieu | toi) · nha (dem | ngay) · hang-o (ổ lừa đảo, luôn tối)
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

export const defaultTime = (set: string) => (set === 'nha' ? 'dem' : set === 'hang-o' ? 'toi' : 'ngay');

export const SetBack: React.FC<{ set: string; time?: string; frame: number; logo?: boolean }> = ({ set, time, frame, logo }) => {
  const id = 's' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const t = time ?? defaultTime(set);
  return (
    <svg width="100%" height="100%" viewBox={`${X0} 0 ${XW} ${WORLD.H}`} style={{ display: 'block' }}>
      {set === 'nha' ? <HomeBack time={t} frame={frame} id={id} /> : set === 'hang-o' ? <DenBack frame={frame} id={id} /> : <OfficeBack time={t} frame={frame} logo={logo} id={id} />}
    </svg>
  );
};

// Lớp giữa: bàn + màn hình của nhân vật phụ (che nửa dưới của họ) và lớp sương tách hậu cảnh khỏi nhân vật chính
export const SetMid: React.FC<{ set: string; time?: string; extras: number[] }> = ({ set, time, extras }) => {
  const t = time ?? defaultTime(set);
  const haze = set === 'nha' ? (HOME[t] ?? HOME.dem).haze : set === 'hang-o' ? 'rgba(10,8,30,.2)' : (OFFICE[t] ?? OFFICE.ngay).haze;
  const cab = set === 'van-phong' ? (OFFICE[t] ?? OFFICE.ngay).cab : '#555';
  return (
    <svg width="100%" height="100%" viewBox={`${X0} 0 ${XW} ${WORLD.H}`} style={{ display: 'block' }}>
      {extras.map((x) => (
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

export const SetFront: React.FC<{ set: string; time?: string; frame: number; items?: DeskItem[] }> = ({ set, time, frame, items = [] }) => {
  const id = 'f' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const t = time ?? defaultTime(set);
  const C = set === 'hang-o' ? ['#22263F', '#161929', '#343A5C'] : set === 'nha' ? (t === 'dem' ? ['#7A5642', '#5E3F30', '#96705A'] : ['#B98558', '#A06F45', '#D6A479']) : t === 'toi' ? ['#7C6250', '#63493A', '#9A7C66'] : t === 'chieu' ? ['#C98452', '#B06C3E', '#E7A873'] : ['#CE9A68', '#B98050', '#E8BC8E'];
  const y = WORLD.deskY;
  return (
    <svg width="100%" height="100%" viewBox={`${X0} 0 ${XW} ${WORLD.H}`} style={{ display: 'block' }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C[0]} /><stop offset="1" stopColor={C[1]} /></linearGradient></defs>
      <rect x={X0} y={y - 26} width={XW} height={40} fill="#000" opacity={0.16} />
      <rect x={X0} y={y} width={XW} height={WORLD.H - y + 400} fill={`url(#${id})`} />
      <rect x={X0} y={y} width={XW} height={14} fill={C[2]} />
      {[130, 250, 390, 520, 650].map((o, i) => <path key={i} d={`M ${X0} ${y + o} Q ${200 + i * 90} ${y + o - 14 + (i % 2) * 26} ${X0 + XW} ${y + o + 6}`} fill="none" stroke="#000" strokeOpacity={0.05} strokeWidth={5} />)}
      <Dress set={set} />
      {items.map((it, i) => <DeskProp key={i} it={it} frame={frame} dark={set === 'hang-o'} />)}
    </svg>
  );
};
