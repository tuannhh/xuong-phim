import React from 'react';
import { Img, staticFile } from 'remotion';
import { useEp, useLayout } from './theme';
import { MisaLogo } from './MisaLogo';

// Watermark người dùng đặt cho cả series (bible.watermark): chữ và/hoặc logo, mỗi thứ một vị trí + độ mờ riêng.
// Vị trí là TÂM của chữ/logo theo tỉ lệ khung (0..1) để kéo thả trên trang web khớp với khung hình ở mọi tỉ lệ 9:16 / 16:9 / 1:1.
// data-watermark: LayoutProbe bỏ qua (watermark cố ý nằm đè lên nội dung).
export const Watermark: React.FC = () => {
  const { ep } = useEp();
  const { W, H, u } = useLayout();
  const wm = ep.watermark;
  if (!wm) return null;
  const at = (x: number, y: number): React.CSSProperties => ({ position: 'absolute', left: x * W, top: y * H, transform: 'translate(-50%, -50%)', pointerEvents: 'none' });
  const t = wm.text;
  const l = wm.logo;
  return (
    <>
      {l && l.opacity > 0 && (
        <div data-watermark style={{ ...at(l.x, l.y), opacity: l.opacity, lineHeight: 0 }}>
          {l.src === 'misa' ? (
            // logo MISA đầy đủ có khẩu hiệu, giữ nguyên hình (không đổi màu)
            <div style={{ background: 'rgba(255,255,255,.92)', borderRadius: 14 * u, padding: `${10 * u}px ${14 * u}px` }}>
              <MisaLogo width={l.width * W} />
            </div>
          ) : (
            <Img src={staticFile(l.src)} style={{ width: l.width * W, height: 'auto', display: 'block' }} />
          )}
        </div>
      )}
      {t && t.content && t.opacity > 0 && (
        <div
          data-watermark
          style={{
            ...at(t.x, t.y),
            opacity: t.opacity,
            color: t.color,
            fontFamily: ep.theme.fontBody,
            fontWeight: t.bold === false ? 500 : 800,
            fontSize: t.size * u,
            whiteSpace: 'nowrap',
            textShadow: '0 1px 3px rgba(0,0,0,.35)',
          }}
        >
          {t.content}
        </div>
      )}
    </>
  );
};
