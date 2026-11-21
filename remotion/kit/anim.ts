import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Tiến độ 0→1 bắt đầu tại frame `at` (spring mềm, hơi nảy).
export const useSpringAt = (at: number, opts: { damping?: number; mass?: number; stiffness?: number } = {}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - at, fps, config: { damping: opts.damping ?? 14, mass: opts.mass ?? 0.7, stiffness: opts.stiffness ?? 120 } });
};

export const springAt = (f: number, at: number, fps: number, damping = 14) =>
  spring({ frame: f - at, fps, config: { damping, mass: 0.7, stiffness: 120 } });

// Tiến độ tuyến tính có easing trong [at, at+len].
export const ease = (f: number, at: number, len: number, e: (t: number) => number = Easing.out(Easing.cubic)) =>
  interpolate(f, [at, at + len], [0, 1], { ...clamp, easing: e });

// Hiện dần: trượt lên + mờ → rõ.
export const rise = (p: number, dist = 40) => ({ opacity: p, transform: `translateY(${(1 - p) * dist}px)` });
export const pop = (p: number) => ({ opacity: Math.min(1, p * 1.6), transform: `scale(${0.6 + 0.4 * p})` });

// Lịch hiện mục: dùng chung với tools/timing.mjs để SFX khớp hình.
export { revealFrames } from '../../shared/reveal.mjs';
