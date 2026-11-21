import React from 'react';
import { Composition } from 'remotion';
import { CharacterSheet } from './CharacterSheet';
import { Episode } from './Episode';
import sample from './sample.json';
import type { TimedEpisode } from './types';

// Episode: props = build/timed.json của một tập (tools/render.mjs truyền vào). sample.json chỉ để mở Studio không cần tập.
export const Root: React.FC = () => (
  <>
    <Composition
      id="Episode"
      component={Episode as any}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={sample as unknown as TimedEpisode}
      calculateMetadata={({ props }: { props: TimedEpisode }) => ({ durationInFrames: props.durationInFrames, fps: props.fps, width: props.width, height: props.height })}
    />
    <Composition id="CharacterSheet" component={CharacterSheet} durationInFrames={90} fps={30} width={3150} height={1060} defaultProps={{}} />
  </>
);
