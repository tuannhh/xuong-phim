import React, { createContext, useContext } from 'react';
import { useVideoConfig } from 'remotion';
import type { CharacterSpec, TimedEpisode, Theme } from '../types';

type Ctx = { ep: TimedEpisode; theme: Theme };
const C = createContext<Ctx | null>(null);

export const EpisodeProvider: React.FC<{ ep: TimedEpisode; children: React.ReactNode }> = ({ ep, children }) => (
  <C.Provider value={{ ep, theme: ep.theme }}>{children}</C.Provider>
);

export const useEp = () => {
  const c = useContext(C);
  if (!c) throw new Error('EpisodeProvider thiếu');
  return c;
};
export const useTheme = () => useEp().theme;
export const useCharacter = (id?: string): CharacterSpec | undefined => {
  const { ep } = useEp();
  return id ? ep.characters.find((c) => c.id === id) : undefined;
};

// Bố cục theo khung hình. `u` = 1 đơn vị thiết kế (thiết kế trên khung rộng 1080).
// Vùng an toàn cho 9:16: tránh 220px trên (tên kênh), 420px dưới (mô tả + nút), 150px phải (nút like/share).
export const useLayout = () => {
  const { width: W, height: H } = useVideoConfig();
  const portrait = H > W * 1.2;
  const square = !portrait && H > W * 0.8;
  const u = portrait || square ? W / 1080 : H / 1080;
  const safe = portrait
    ? { top: 230 * u, bottom: 470 * u, left: 80 * u, right: 150 * u }
    : square
      ? { top: 80 * u, bottom: 170 * u, left: 80 * u, right: 80 * u }
      : { top: 80 * u, bottom: 170 * u, left: 120 * u, right: 120 * u };
  const captionY = portrait ? H - 440 * u : H - 150 * u; // mép trên vùng phụ đề (cảnh không có nhân vật)
  // Chia vùng khi cảnh có nhân vật (9:16): nội dung ở trên → dải phụ đề → nhân vật ở dưới. Không vùng nào chồng vùng nào.
  const charTop = portrait ? H * 0.6 : H * 0.12; // mép trên vùng nhân vật (đỉnh đầu)
  const captionMidY = portrait ? charTop - 150 * u : H - 150 * u; // dải phụ đề khi có nhân vật
  const contentBottomWithChar = portrait ? captionMidY - 24 * u : H - safe.bottom;
  return { W, H, u, portrait, square, landscape: !portrait && !square, safe, captionY, charTop, captionMidY, contentBottomWithChar };
};

export const alpha = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const v = parseInt(n, 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
};
