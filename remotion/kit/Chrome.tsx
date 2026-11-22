import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { useEp, useLayout, alpha } from './theme';

// Lớp phủ cố định cả tập: tên series, tên kênh, thanh tiến độ mảnh.
// Không ghi số tập ("TẬP 1/10"): người dùng chỉ duyệt một số tập và đăng không theo thứ tự (yêu cầu 2026-11-22).
export const Chrome: React.FC = () => {
  const { ep, theme: th } = useEp();
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { W, u, safe, portrait } = useLayout();
  const c = { handle: true, progress: true, tag: true, ...(ep.chrome ?? {}) };
  const top = portrait ? safe.top - 90 * u : 40 * u;
  return (
    <>
      {c.progress && (
        <div style={{ position: 'absolute', left: safe.left, right: safe.left, top: top + 70 * u, height: 6 * u, borderRadius: 6 * u, background: 'rgba(15,18,30,.25)', overflow: 'hidden' }}>
          <div style={{ width: `${(f / Math.max(1, durationInFrames - 1)) * 100}%`, height: '100%', background: th.accent }} />
        </div>
      )}
      <div style={{ position: 'absolute', left: safe.left, right: safe.left, top, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: th.fontBody, color: alpha(th.fg, 0.85) }}>
        {c.tag ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 * u, fontSize: 30 * u, fontWeight: 700 }}>
            <span style={{ maxWidth: W * 0.62, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff', background: 'rgba(15,18,30,.55)', padding: `${4 * u}px ${14 * u}px`, borderRadius: 999 }}>{ep.series.name}</span>
          </div>
        ) : (
          <span />
        )}
        {c.handle && ep.series.channel && <span style={{ fontSize: 28 * u, fontWeight: 600, opacity: 0.8 }}>{ep.series.channel}</span>}
      </div>
    </>
  );
};
