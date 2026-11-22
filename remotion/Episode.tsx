import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';
import { Easing } from 'remotion';
import { EpisodeProvider, useTheme, useLayout } from './kit/theme';
import { useFonts } from './kit/fonts';
import { Captions } from './kit/Captions';
import { Chrome } from './kit/Chrome';
import { Watermark } from './kit/Watermark';
import { LayoutProbe } from './kit/LayoutProbe';
import { resolveScene } from './scenes';
import type { TimedEpisode, TimedScene } from './types';

const presentation = (t: TimedScene['transition']['type']): any => {
  switch (t) {
    case 'slide': return slide({ direction: 'from-right' });
    case 'slide-up': return slide({ direction: 'from-bottom' });
    case 'wipe': return wipe({ direction: 'from-left' });
    case 'flip': return flip({ direction: 'from-right' });
    case 'zoom': return zoomIn();
    default: return fade();
  }
};

// Phóng to + mờ dần vào.
const zoomIn = () => ({
  component: ({ children, presentationDirection, presentationProgress }: any) => {
    const p = presentationProgress;
    const style = presentationDirection === 'entering' ? { opacity: p, transform: `scale(${1.25 - 0.25 * p})` } : { opacity: 1, transform: `scale(${1 + 0.15 * p})` };
    return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
  },
  props: {},
});

const Missing: React.FC<{ type: string }> = ({ type }) => {
  const th = useTheme();
  const { u } = useLayout();
  return <AbsoluteFill style={{ background: '#400', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 50 * u, fontFamily: th.fontBody }}>Thiếu template "{type}"</AbsoluteFill>;
};

export const Episode: React.FC<TimedEpisode> = (ep) => {
  useFonts();
  const items: React.ReactNode[] = [];
  ep.scenes.forEach((s, i) => {
    if (i > 0 && s.transition.type !== 'none' && s.transition.frames > 0) {
      items.push(
        <TransitionSeries.Transition key={`t${i}`} presentation={presentation(s.transition.type)} timing={linearTiming({ durationInFrames: s.transition.frames, easing: Easing.inOut(Easing.cubic) })} />,
      );
    }
    const C = resolveScene(s.type, s.props);
    items.push(
      <TransitionSeries.Sequence key={s.id} durationInFrames={s.duration} name={`${s.id} · ${s.type}`}>
        {C ? <C scene={s} /> : <Missing type={s.type} />}
      </TransitionSeries.Sequence>,
    );
  });
  return (
    <EpisodeProvider ep={ep}>
      <AbsoluteFill style={{ background: ep.theme.bg }}>
        <TransitionSeries>{items}</TransitionSeries>
        <Chrome />
        <Watermark />
        <Captions />
        {ep.audio && !ep.still && <Audio src={staticFile(ep.audio)} />}
        {ep.still && <LayoutProbe />}
      </AbsoluteFill>
    </EpisodeProvider>
  );
};
