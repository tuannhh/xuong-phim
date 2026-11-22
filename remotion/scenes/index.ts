import type React from 'react';
import type { SceneProps } from './common';
import { Bullets, Chart, Compare, Hook, Icons, Kinetic, Outro, Quote, Stat, Steps, Title } from './basic';
import { Alert, Chat, Figure, Phone, Photo } from './special';
import { Talk } from './talk';
import { Story } from './story';
import { CUSTOM } from '../custom';

// Bảng template cảnh. Tên ở đây = trường "type" trong episode.json. Xem docs/scenes.md.
export const SCENES: Record<string, React.FC<SceneProps>> = {
  hook: Hook,
  title: Title,
  bullets: Bullets,
  stat: Stat,
  quote: Quote,
  compare: Compare,
  steps: Steps,
  icons: Icons,
  chart: Chart,
  kinetic: Kinetic,
  chat: Chat,
  phone: Phone,
  alert: Alert,
  figure: Figure,
  photo: Photo,
  character: Talk,
  talk: Talk,
  story: Story,
  outro: Outro,
};

export const resolveScene = (type: string, props: Record<string, any>): React.FC<SceneProps> | null => {
  if (type === 'custom') return CUSTOM[props.component] ?? null;
  return SCENES[type] ?? null;
};
