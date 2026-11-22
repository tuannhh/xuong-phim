// Hàng đợi dựng phim: người dùng duyệt kịch bản nhiều tập → máy dựng lần lượt từng tập (mỗi lúc vẫn chỉ một việc).
// Lưu ra file để máy chủ khởi động lại không mất danh sách; tập đang dựng dở lúc tắt được xếp lại lên đầu.
// Sau khi khởi động lại, hàng đợi ở trạng thái TẠM DỪNG — người dùng bấm "Chạy tiếp" (không tự chạy ngầm khi họ không để ý).
import fs from 'node:fs';
import path from 'node:path';

const MAX = 100, HIST = 20;
const key = (i) => `${i.slug}#${i.episode}`;

export function createQueue(file) {
  const raw = (() => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } })();
  const clean = (list) => (Array.isArray(list) ? list : []).filter((i) => typeof i?.slug === 'string' && Number.isInteger(i?.episode)).map((i) => ({ slug: i.slug, episode: i.episode, added: i.added ?? Date.now() }));
  let items = clean(raw.items);
  if (raw.current?.slug) items = [...clean([raw.current]), ...items.filter((i) => key(i) !== key(raw.current))];
  let current = null;
  let paused = items.length > 0; // vừa khởi động lại mà còn tập → chờ người dùng bấm Chạy tiếp
  const history = (Array.isArray(raw.history) ? raw.history : []).filter((h) => typeof h?.slug === 'string' && Number.isInteger(h?.episode)).map((h) => ({ slug: h.slug, episode: h.episode, status: String(h.status ?? ''), ended: +h.ended || 0 })).slice(0, HIST);

  const save = () => {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
      fs.writeFileSync(file, JSON.stringify({ items, current, history }, null, 1));
    } catch { /* không ghi được cấu hình — hàng đợi vẫn chạy trong bộ nhớ */ }
  };

  return {
    get size() { return items.length; },
    get paused() { return paused; },
    has: (slug, episode) => items.some((i) => i.slug === slug && i.episode === episode),
    // thêm các tập (bỏ tập đã có trong hàng); trả về số tập vừa thêm
    add(slug, episodes) {
      let n = 0;
      for (const episode of episodes) {
        if (items.length >= MAX || items.some((i) => i.slug === slug && i.episode === episode)) continue;
        if (current && current.slug === slug && current.episode === episode) continue;
        items.push({ slug, episode, added: Date.now() });
        n++;
      }
      if (n) save();
      return n;
    },
    remove(slug, episode) { items = items.filter((i) => !(i.slug === slug && i.episode === episode)); save(); },
    clear() { items = []; paused = false; save(); },
    pause() { paused = true; },
    resume() { paused = false; },
    // lấy tập kế tiếp để dựng (null khi trống hoặc đang tạm dừng)
    take() {
      if (paused || !items.length) return null;
      current = items.shift();
      save();
      return current;
    },
    // tập vừa dựng xong / lỗi / bị dừng
    done(item, status) {
      if (current && key(current) === key(item)) current = null;
      history.unshift({ slug: item.slug, episode: item.episode, status, ended: Date.now() });
      history.length = Math.min(history.length, HIST);
      save();
    },
    view: (title) => ({
      paused,
      items: items.map((i) => ({ ...i, title: title(i) })),
      history: history.slice(0, 8).map((h) => ({ ...h, title: title(h) })),
    }),
  };
}
