// Watermark của series (bible.watermark) — làm sạch dùng chung cho máy chủ (lưu từ form) và timing (đưa vào khung hình).
//   { text: { on, content, x, y, size, color, opacity, bold }, logo: { on, src, x, y, width, opacity } }
//   x, y: TÂM theo tỉ lệ khung 0..1 · size: cỡ chữ px ở cạnh ngắn 1080 · width: bề rộng logo theo tỉ lệ bề ngang khung
//   logo.src: 'misa' (logo MISA đầy đủ có khẩu hiệu) hoặc tên file ảnh trong series/<slug>/assets/
const num = (v, d, lo = 0, hi = 1) => (v !== '' && v != null && Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
const IMG = /^[\w.\- ]{1,80}\.(png|webp|jpe?g|svg)$/i;

export const WM_DEFAULT = {
  text: { on: false, content: '', x: 0.5, y: 0.9, size: 34, color: '#ffffff', opacity: 0.6, bold: true },
  logo: { on: false, src: 'misa', x: 0.84, y: 0.06, width: 0.18, opacity: 0.7 },
};

export function cleanWatermark(w) {
  if (!w || typeof w !== 'object') return null;
  const t = w.text ?? {}, l = w.logo ?? {};
  const src = l.src === 'misa' ? 'misa' : IMG.test(String(l.src ?? '')) ? String(l.src) : 'misa';
  const out = {
    text: {
      on: !!t.on, content: String(t.content ?? '').replace(/[\r\n]+/g, ' ').slice(0, 80),
      x: num(t.x, WM_DEFAULT.text.x), y: num(t.y, WM_DEFAULT.text.y), size: num(t.size, WM_DEFAULT.text.size, 12, 120),
      color: /^#[0-9a-fA-F]{6}$/.test(t.color ?? '') ? t.color : WM_DEFAULT.text.color, opacity: num(t.opacity, WM_DEFAULT.text.opacity), bold: t.bold !== false,
    },
    logo: { on: !!l.on, src, x: num(l.x, WM_DEFAULT.logo.x), y: num(l.y, WM_DEFAULT.logo.y), width: num(l.width, WM_DEFAULT.logo.width, 0.05, 0.6), opacity: num(l.opacity, WM_DEFAULT.logo.opacity) },
  };
  return out.text.on || out.logo.on ? out : null;
}

// props cho Remotion (TimedEpisode.watermark): chỉ phần đang bật; logo file → đường dẫn trong public dir của tập
export function watermarkProps(w) {
  const c = cleanWatermark(w);
  if (!c) return undefined;
  const out = {};
  if (c.text.on && c.text.content.trim()) { const { on, ...t } = c.text; out.text = t; }
  if (c.logo.on) { const { on, ...l } = c.logo; out.logo = { ...l, src: l.src === 'misa' ? 'misa' : `series-assets/${l.src}` }; }
  return Object.keys(out).length ? out : undefined;
}
