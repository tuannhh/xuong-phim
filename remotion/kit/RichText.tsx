import React from 'react';
import { useTheme, alpha } from './theme';

// Cú pháp nhấn mạnh trong chữ trên màn hình:
//   *chữ*    → màu accent        _chữ_ → màu accent2
//   ==chữ==  → bút dạ quang       ~~chữ~~ → gạch ngang (màu bad)
//   \n       → xuống dòng
type Tok = { t: string; k: 'n' | 'a' | 'b' | 'hl' | 'del' | 'br' };
export const tokenize = (s: string): Tok[] => {
  const out: Tok[] = [];
  const re = /(\*[^*]+\*|_[^_]+_|==[^=]+==|~~[^~]+~~|\n)/g;
  let last = 0;
  for (const m of s.matchAll(re)) {
    if (m.index! > last) out.push({ t: s.slice(last, m.index), k: 'n' });
    const v = m[0];
    if (v === '\n') out.push({ t: '', k: 'br' });
    else if (v.startsWith('==')) out.push({ t: v.slice(2, -2), k: 'hl' });
    else if (v.startsWith('~~')) out.push({ t: v.slice(2, -2), k: 'del' });
    else if (v.startsWith('*')) out.push({ t: v.slice(1, -1), k: 'a' });
    else out.push({ t: v.slice(1, -1), k: 'b' });
    last = m.index! + v.length;
  }
  if (last < s.length) out.push({ t: s.slice(last), k: 'n' });
  return out;
};
export const plain = (s: string) => tokenize(s).map((x) => (x.k === 'br' ? ' ' : x.t)).join('');

// accent/accent2: ghi đè màu nhấn (vd chữ trong bóng thoại nền trắng cần màu đậm)
export const RichText: React.FC<{ text: string; style?: React.CSSProperties; hl?: number; accent?: string; accent2?: string }> = ({ text, style, hl = 1, accent, accent2 }) => {
  const th0 = useTheme();
  const th = { ...th0, accent: accent ?? th0.accent, accent2: accent2 ?? th0.accent2 };
  return (
    <span style={style}>
      {tokenize(text ?? '').map((x, i) => {
        if (x.k === 'br') return <br key={i} />;
        if (x.k === 'a') return <span key={i} style={{ color: th.accent }}>{x.t}</span>;
        if (x.k === 'b') return <span key={i} style={{ color: th.accent2 }}>{x.t}</span>;
        if (x.k === 'del') return <span key={i} style={{ color: th.bad, textDecoration: 'line-through', textDecorationThickness: '0.08em' }}>{x.t}</span>;
        if (x.k === 'hl')
          return (
            <span key={i} style={{ backgroundImage: `linear-gradient(${alpha(th.accent, 0.45)},${alpha(th.accent, 0.45)})`, backgroundSize: `${hl * 100}% 0.42em`, backgroundPosition: '0 88%', backgroundRepeat: 'no-repeat', padding: '0 0.08em' }}>
              {x.t}
            </span>
          );
        return <React.Fragment key={i}>{x.t}</React.Fragment>;
      })}
    </span>
  );
};
