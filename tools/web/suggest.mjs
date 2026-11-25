// Nút "Gợi ý" cạnh các ô nhập trên trang: hỏi nhanh Claude hoặc Codex (model nhẹ, không công cụ) 3 phương án cho một ô,
// dựa trên những gì người dùng đã điền. Không ghi file, không đi qua hàng việc nền (chạy song song được với việc dựng phim).
// Công cụ + model + effort lấy từ Thiết lập AI (vai trò "suggest", tools/web/ai.mjs).
import { spawnBin } from '../platform.mjs';
import os from 'node:os';

// Ô nào gợi ý được + Claude cần viết gì cho ô đó
export const FIELDS = {
  name: 'tên series (ngắn, dễ nhớ, ≤ 8 chữ)',
  channel: 'tên kênh / handle mạng xã hội (bắt đầu bằng @, ≤ 30 ký tự)',
  idea: 'ý tưởng series: chủ đề, thông điệp, mỗi tập nói gì (2–4 câu)',
  audience: 'khán giả mục tiêu (1 câu: ai, độ tuổi, nghề nghiệp, mối quan tâm)',
  tone: 'giọng điệu (vài từ, vd "gần gũi, hài nhẹ, có cảnh báo")',
  cta: 'lời kêu gọi cuối tập (≤ 12 chữ, vd "Chia sẻ cho người thân cùng cảnh giác")',
  notes: 'ghi chú thêm cho người viết kịch bản (1–3 gạch đầu dòng ngắn: điều nên/không nên)',
  role: 'vai trò của nhân vật trong series (≤ 10 chữ)',
  charName: 'tên nhân vật Việt Nam hợp vai (≤ 3 chữ, có thể kèm "anh/chị")',
  watermark: 'chữ watermark trên video (≤ 6 chữ, vd tên kênh hoặc tên đơn vị)',
  feedback: 'góp ý sửa tập phim (2–3 ý cụ thể, câu ngắn, giọng người duyệt)',
  topic: 'ý tưởng một tập mới (1–2 câu)',
  batchIdea: 'nội dung cho đợt tập thêm vào series đang có: chủ đề mới chưa có trong các tập cũ, các tập mới nói gì (2–3 câu)',
};

let busy = false;

const promptOf = (field, ctx) => {
  const known = Object.entries(ctx ?? {})
    .filter(([, v]) => v != null && String(v).trim())
    .map(([k, v]) => `- ${k}: ${String(v).slice(0, 600)}`)
    .join('\n');
  return `Bạn giúp người dùng điền form "Xưởng phim" — xưởng làm series phim ngắn mạng xã hội (TikTok/Reels/Shorts) bằng tiếng Việt.
Cần gợi ý cho ô: ${FIELDS[field]}.
Thông tin người dùng đã điền:
${known || '- (chưa điền gì)'}
Đưa đúng 3 phương án khác nhau, tiếng Việt có dấu, hợp với thông tin trên, không bịa số liệu, không nhắc "tập sau".
CHỈ trả về một mảng JSON 3 chuỗi, không giải thích, không markdown. Ví dụ: ["…","…","…"]`;
};

// lấy câu trả lời cuối của mỗi công cụ
const answerOf = {
  claude: (out) => String(JSON.parse(out).result ?? ''),
  codex: (out) => {
    let last = '';
    for (const line of out.split('\n')) { try { const m = JSON.parse(line); if (m.type === 'item.completed' && m.item?.type === 'agent_message') last = m.item.text ?? ''; } catch {} }
    return last;
  },
};
const argsOf = {
  claude: (prompt, model, effort) => ['-p', prompt, '--output-format', 'json', '--model', model || process.env.STUDIO_SUGGEST_MODEL || 'haiku', ...(effort ? ['--effort', effort] : []), '--max-turns', '1', '--disallowedTools', 'Bash', 'Edit', 'Write', 'WebSearch', 'WebFetch'],
  codex: (prompt, model, effort) => ['exec', '--json', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-C', os.tmpdir(), ...(model ? ['-m', model] : []), ...(effort ? ['-c', `model_reasoning_effort="${effort}"`] : []), prompt],
};

// ai = { engine: 'claude'|'codex', bin, model, effort } (ai.pick('suggest'))
export function suggest(ai, env, field, ctx, timeoutMs = 90000) {
  const name = ai.engine === 'codex' ? 'codex' : 'claude';
  if (!FIELDS[field]) return Promise.reject(Object.assign(new Error('ô này không có gợi ý'), { code: 400 }));
  if (!ai.bin) return Promise.reject(Object.assign(new Error(`Máy chưa có lệnh ${name} (cần cài và đăng nhập để dùng gợi ý — đổi công cụ ở Thiết lập).`), { code: 400 }));
  if (busy) return Promise.reject(Object.assign(new Error('Đang lấy một gợi ý khác — thử lại sau vài giây.'), { code: 409 }));
  busy = true;
  return new Promise((ok, no) => {
    const child = spawnBin(ai.bin, argsOf[name](promptOf(field, ctx), ai.model, ai.effort), { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); no(new Error('Gợi ý quá lâu — thử lại.')); }, timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => { clearTimeout(timer); no(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const text = answerOf[name](out);
        const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
        const list = arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 3);
        if (!list.length) throw new Error('rỗng');
        ok(list);
      } catch {
        no(new Error(code === 0 ? 'Trả lời không đúng dạng — bấm gợi ý lại.' : `Không lấy được gợi ý${/login|auth|401/i.test(err + out) ? ` (lệnh ${name} chưa đăng nhập)` : /model/i.test(err + out) ? ` (model "${ai.model}" không dùng được — đổi ở Thiết lập)` : ''}.`));
      }
    });
  }).finally(() => { busy = false; });
}
