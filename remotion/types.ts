// Dữ liệu một tập sau bước timing (tools/timing.mjs) — đây là inputProps của composition "Episode".
// Mọi thời gian tính bằng FRAME. Thời gian trong scene là tương đối so với đầu scene.

export type Theme = {
  bg: string;
  bg2: string;
  fg: string;
  muted: string;
  accent: string;
  accent2: string;
  good: string;
  bad: string;
  card: string; // nền thẻ/khối
  background: 'gradient-blobs' | 'grid' | 'dots' | 'solid' | 'paper' | 'spotlight';
  radius: number;
  fontDisplay: string;
  fontBody: string;
  captionStyle: 'pill' | 'bold' | 'none';
};

export type CharacterSpec = {
  id: string;
  name: string;
  kind?: 'misa' | 'so-mi' | 'vest' | 'hoodie' | 'ao-thun' | 'cardigan'; // misa = polo vàng đồng phục MISA (mặc định)
  outfitColor?: string; // màu áo cho kind khác misa
  bottom?: 'quan' | 'vay';
  bottomColor?: string;
  gender: 'nam' | 'nu';
  hair?: 'ngan' | 'vuot' | 'tia' | 'xoan' | 'hoi' | 'dai' | 'buoc' | 'bob' | 'bui';
  age?: 'tre' | 'trung-nien';
  beard?: boolean;
  voice?: string; // giọng VieNeu của nhân vật (khoá theo giới tính)
  geminiVoice?: string; // giọng Gemini TTS của nhân vật
  hairColor?: string;
  skin?: string;
  glasses?: boolean;
  logo?: boolean; // logo MISA ở ngực trái (mặc định có)
  villain?: boolean; // vai phản diện — nhãn tên màu đỏ ở phụ đề cảnh story
};

export type Line = {
  id: string;
  text: string;
  from: number; // frame, tương đối trong scene
  to: number;
  speaker?: string; // id nhân vật đang nói (để nhép miệng)
  raw?: string; // chữ hiển thị gốc (giữ *nhấn*), dùng cho bóng thoại
  narr?: boolean; // lời người dẫn chuyện (câu không ghi speaker)
  expr?: string; // biểu cảm người nói ở câu này
  pose?: string; // tư thế người nói ở câu này
  react?: Record<string, string | { expr?: string; pose?: string }>; // phản ứng của người nghe
};

export type CharacterPlacement = {
  id: string;
  pose?: string; // xem POSE_LIST trong kit/Character.tsx
  expr?: string; // biểu cảm, xem EXPR_LIST
  position?: 'left' | 'right' | 'center' | 'bottom-left' | 'bottom-right';
  scale?: number;
  flip?: boolean;
};

export type TimedScene = {
  id: string;
  type: string;
  props: Record<string, any>;
  from: number; // frame tuyệt đối (chỉ để tham chiếu)
  duration: number;
  transition: { type: 'none' | 'fade' | 'slide' | 'slide-up' | 'wipe' | 'zoom' | 'flip'; frames: number };
  beats: number[]; // frame bắt đầu mỗi câu thoại trong scene
  lines: Line[];
  character?: CharacterPlacement | null;
};

export type CaptionWord = { w: string; from: number; to: number; em?: boolean };
export type Caption = { from: number; to: number; words: CaptionWord[] };

export type TimedEpisode = {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  series: { name: string; channel?: string; slug: string };
  episode: { id: string; number: number; total?: number; title: string };
  theme: Theme;
  characters: CharacterSpec[];
  scenes: TimedScene[];
  captions: Caption[];
  audio: string | null; // đường dẫn trong public dir (vd "mix.wav")
  mouth?: Record<string, number[]>; // id nhân vật → độ mở miệng 0..1 theo từng frame tuyệt đối
  chrome?: { handle?: boolean; progress?: boolean; tag?: boolean };
  still?: boolean; // đang chụp storyboard
};
