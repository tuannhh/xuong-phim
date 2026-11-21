// Dùng chung cho Remotion (hình) và tools/timing.mjs (đặt SFX đúng lúc) — sửa một chỗ, hình và tiếng luôn khớp.
// Thời điểm (frame trong scene) mục thứ i của danh sách n mục xuất hiện:
// - mục có `at` (giây) → đúng lúc đó; mục có `beat` → bám câu thoại đó
// - số câu = n+1 (câu đầu là tiêu đề) → mục i ở câu i+1; số câu = n → mục i ở câu i
// - còn lại → rải đều từ câu đầu tới 70% scene
export function revealFrames(scene, n, items, fps = 30) {
  const b = scene.beats || [];
  const start = (b[0] ?? 0) + Math.round(fps * 0.35);
  return Array.from({ length: n }, (_, i) => {
    const it = items && items[i];
    if (it && typeof it === 'object' && it.at != null) return Math.round(it.at * fps);
    if (it && typeof it === 'object' && it.beat != null && b[it.beat] != null) return b[it.beat];
    if (b.length === n + 1) return b[i + 1];
    if (b.length === n) return b[i];
    const end = Math.max(start + n * 6, Math.round(scene.duration * 0.7));
    return n <= 1 ? start : Math.round(start + ((end - start) * i) / (n - 1));
  });
}

// Danh sách "mục" mà mỗi template hiện dần — để timing.mjs biết chỗ đặt tiếng pop/tick.
export function revealItems(scene) {
  const p = scene.props || {};
  switch (scene.type) {
    case 'bullets': return { items: (p.items || []).map((x) => (typeof x === 'string' ? {} : x)), sfx: 'pop' };
    case 'steps': return { items: p.steps || [], sfx: 'pop' };
    case 'icons': return { items: p.items || [], sfx: 'pop-high' };
    case 'chart': return { items: p.bars || [], sfx: 'tick' };
    case 'alert': return { items: (p.items || []).map(() => ({})), sfx: 'tick' };
    case 'chat': return { items: p.messages || [], sfx: (it) => (it.from === 'me' ? 'send' : 'bubble') };
    case 'phone': return p.mode === 'notify' ? { items: p.notifications || [], sfx: 'notify' } : null;
    case 'kinetic': return { items: (p.phrases || scene.lines.map(() => ({}))).map(() => ({})), sfx: 'tick' };
    case 'compare': {
      const n = (p.left?.items?.length || 0) + (p.right?.items?.length || 0) + 2;
      return { items: Array.from({ length: n }, () => ({})), sfx: 'tick' };
    }
    default: return null;
  }
}

// Cảnh `story`: thời điểm (frame trong scene) từng mục của một danh sách (nhãn bật, mục trên màn hình điện thoại, dòng trên bảng).
// Mỗi mục: { on: <số thứ tự câu, 1 = câu đầu>, delay: <giây> } hoặc { at: <giây trong cảnh> } (at dạng mảng là VỊ TRÍ của nhãn, không phải thời điểm). Nhiều mục cùng một câu → tự rải đều trong câu đó.
export function storyTimes(scene, items, fps = 30) {
  const L = scene.lines || [];
  const groups = new Map();
  (items || []).forEach((it, i) => {
    const k = Math.max(1, Math.min(L.length || 1, (it && it.on) || 1));
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  });
  const out = new Array((items || []).length).fill(0);
  for (const [k, idx] of groups) {
    const l = L[k - 1];
    const a = l ? l.from : Math.round(fps * 0.3);
    const b = l ? l.to : Math.max(a + fps, scene.duration - fps * 0.6);
    const span = Math.max(0, (b - a) * 0.82);
    idx.forEach((i, j) => {
      const it = items[i] || {};
      out[i] = typeof it.at === 'number' ? Math.round(it.at * fps) : Math.round(a + (idx.length > 1 ? (span * j) / idx.length : 0) + (it.delay != null ? it.delay : idx.length > 1 ? 0.05 : 0.2) * fps);
    });
  }
  return out;
}

// Tiếng động cho từng loại mục của cảnh `story`
export const STORY_SFX = {
  pop: { tag: 'pop', chip: 'whoosh-soft', alert: 'error', big: 'impact', note: 'pop-soft' },
  item: (it) => (it.out != null ? 'send' : it.in != null ? 'bubble' : it.task != null ? 'ding' : it.balance != null ? 'cash' : it.btn != null ? 'click' : it.warn != null ? 'error' : it.transfer != null ? 'send' : it.row != null || it.text != null ? 'pop' : 'tick'),
};
