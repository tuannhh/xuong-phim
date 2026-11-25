// Thiết lập AI của xưởng: chọn công cụ (Claude Code / Codex) + model và effort cho từng vai trò.
// Lưu theo MÁY ở ~/.config/xuong-phim/ai.json (ngoài repo) — mỗi máy một tài khoản, một bộ model.
//   { engine: 'claude'|'codex', claude: { plan|script|fix|suggest: { model, effort } }, codex: { …như trên } }
// model '' = để công cụ tự chọn (mặc định của tài khoản). Danh sách model Codex hỏi thẳng Codex (`codex app-server`,
// lệnh model/list) nên có model mới là trang tự hiện; Claude dùng tên tắt opus/sonnet/haiku = luôn bản mới nhất.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { which, spawnBin, spawnBinSync } from '../platform.mjs';

export const ROLES = {
  plan: 'Lập kế hoạch + thiết kế nhân vật',
  script: 'Viết kịch bản từng tập',
  fix: 'Sửa tập theo góp ý',
  suggest: 'Nút "Gợi ý"',
};
export const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const CLAUDE_MODELS = [
  { id: 'opus', label: 'Opus (bản mới nhất)' },
  { id: 'sonnet', label: 'Sonnet (bản mới nhất)' },
  { id: 'haiku', label: 'Haiku (bản mới nhất)' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5' },
];
export const DEFAULTS = {
  engine: 'claude',
  claude: {
    plan: { model: 'opus', effort: 'medium' },
    script: { model: 'sonnet', effort: 'medium' },
    fix: { model: 'sonnet', effort: 'medium' },
    suggest: { model: 'haiku', effort: 'low' },
  },
  codex: {
    plan: { model: '', effort: 'medium' },
    script: { model: '', effort: 'medium' },
    fix: { model: '', effort: 'medium' },
    suggest: { model: '', effort: 'low' },
  },
};

const FILE = () => path.join(process.env.XUONG_CONFIG_DIR || path.join(os.homedir(), '.config/xuong-phim'), 'ai.json');
const MODEL_RE = /^[\w.\-:[\]]{0,80}$/;
const EFFORT_RE = /^[a-z]{0,12}$/;

export const BIN = {
  claude: process.env.STUDIO_CLAUDE_BIN || which('claude'),
  codex: process.env.STUDIO_CODEX_BIN || which('codex'),
};

function clean(v) {
  const out = { engine: v?.engine === 'codex' ? 'codex' : 'claude' };
  for (const eng of ['claude', 'codex']) {
    out[eng] = {};
    for (const r of Object.keys(ROLES)) {
      const d = DEFAULTS[eng][r], x = v?.[eng]?.[r] ?? {};
      const model = typeof x.model === 'string' && MODEL_RE.test(x.model.trim()) ? x.model.trim() : d.model;
      let effort = typeof x.effort === 'string' && EFFORT_RE.test(x.effort) ? x.effort : d.effort;
      if (eng === 'claude' && effort && !CLAUDE_EFFORTS.includes(effort)) effort = d.effort;
      out[eng][r] = { model, effort };
    }
  }
  return out;
}

export function load() {
  try { return clean(JSON.parse(fs.readFileSync(FILE(), 'utf8'))); } catch { return clean(DEFAULTS); }
}
export function save(v) {
  const c = clean(v);
  fs.mkdirSync(path.dirname(FILE()), { recursive: true });
  fs.writeFileSync(FILE(), JSON.stringify(c, null, 2) + '\n');
  return c;
}
// công cụ + model + effort cho một vai trò (engine ép từ ngoài nếu cần)
export function pick(role, engine) {
  const c = load();
  const eng = engine ?? c.engine;
  return { engine: eng, bin: BIN[eng], ...(c[eng][role] ?? DEFAULTS[eng][role]) };
}

// ───────── danh sách model Codex — hỏi thẳng Codex (app-server JSON-RPC: initialize → model/list), giữ 10 phút
let codexCache = { at: 0, list: null, error: '' };
export function codexModels({ refresh = false, timeoutMs = 20000 } = {}) {
  if (!BIN.codex) return Promise.resolve({ list: [], error: 'Máy chưa có lệnh codex.' });
  if (!refresh && codexCache.list && Date.now() - codexCache.at < 10 * 60 * 1000) return Promise.resolve(codexCache);
  return new Promise((ok) => {
    const child = spawnBin(BIN.codex, ['app-server'], { stdio: ['pipe', 'pipe', 'ignore'] });
    const list = [];
    let buf = '', id = 1, done = false;
    const end = (error = '') => {
      if (done) return;
      done = true; clearTimeout(timer); child.kill();
      if (!error) codexCache = { at: Date.now(), list, error: '' };
      ok(error ? { list: codexCache.list ?? [], error } : codexCache);
    };
    const timer = setTimeout(() => end('Codex không trả lời danh sách model (quá 20 giây).'), timeoutMs);
    const send = (o) => child.stdin.write(JSON.stringify(o) + '\n');
    const ask = (cursor) => send({ method: 'model/list', id: ++id, params: cursor ? { cursor } : {} });
    child.on('error', (e) => end(e.message));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (c) => {
      buf += c;
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.id === 1) { send({ method: 'initialized' }); ask(); continue; }
        if (m.id !== id) continue;
        if (m.error) return end(m.error.message ?? 'Codex báo lỗi khi lấy danh sách model.');
        for (const x of m.result?.data ?? []) {
          if (x.hidden) continue;
          list.push({ id: x.model ?? x.id, label: x.displayName ?? x.id, description: x.description ?? '', efforts: (x.supportedReasoningEfforts ?? []).map((e) => e.reasoningEffort), defaultEffort: x.defaultReasoningEffort ?? '', isDefault: !!x.isDefault });
        }
        if (m.result?.nextCursor && id < 20) ask(m.result.nextCursor); else end();
      }
    });
    send({ method: 'initialize', id: 1, params: { clientInfo: { name: 'xuong-phim', title: 'Xưởng phim', version: '1.0' } } });
  });
}

// đăng nhập của từng công cụ (chỉ kiểm tra có lệnh + codex login status; claude kiểm tra khi chạy)
let codexLogin = { at: 0, ok: false };
export function status() {
  if (BIN.codex && Date.now() - codexLogin.at > 60000) {
    const r = spawnBinSync(BIN.codex, ['login', 'status'], { encoding: 'utf8', timeout: 10000 });
    codexLogin = { at: Date.now(), ok: r.status === 0 && !/not logged in/i.test(r.stdout + r.stderr) };
  }
  return {
    claude: { installed: !!BIN.claude },
    codex: { installed: !!BIN.codex, loggedIn: BIN.codex ? codexLogin.ok : false },
  };
}

// ───────── tham số dòng lệnh
// Claude: danh sách công cụ cho phép (không hỏi lại); model/effort theo vai trò
export const claudeArgs = (prompt, { sourceMode = 'claude', addDirs = [], model = '', effort = '' } = {}) => ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits',
  '--allowedTools', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Skill', 'Bash(pnpm ep:*)', 'Bash(pnpm series:*)', 'Bash(pnpm typecheck)', 'Bash(node tools/:*)', 'Bash(uv run tools/:*)', 'Bash(ffmpeg:*)', 'Bash(ffprobe:*)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(mkdir:*)', 'Bash(cp:*)',
  ...(sourceMode === 'tu-lieu' ? [] : ['WebSearch', 'WebFetch']),
  ...addDirs.flatMap((d) => ['--add-dir', d]),
  ...((model || process.env.STUDIO_CLAUDE_MODEL) ? ['--model', model || process.env.STUDIO_CLAUDE_MODEL] : []),
  ...(effort ? ['--effort', effort] : [])];

// Codex: chạy trong hộp cát workspace-write (chỉ ghi được trong thư mục xưởng; đọc được file trên máy — tư liệu),
// không mạng cho lệnh; tìm web bằng công cụ web_search của Codex (tắt khi "chỉ dùng tư liệu").
// Chrome không mở được trong hộp cát macOS → Codex KHÔNG vẽ storyboard; máy chủ vẽ sau (xem codexFollowUp ở server).
export const codexArgs = (prompt, root, { sourceMode = 'claude', model = '', effort = '' } = {}) => [
  ...(sourceMode === 'tu-lieu' ? [] : ['--search']),
  'exec', '--json', '--skip-git-repo-check', '-s', 'workspace-write', '-C', root,
  ...(model ? ['-m', model] : []),
  ...(effort ? ['-c', `model_reasoning_effort="${effort}"`] : []),
  prompt];

export const CODEX_NOTE = ' Bạn là Codex, chạy trong hộp cát: KHÔNG mở được Chrome nên KHÔNG chạy `storyboard`, `render`, `voice`, `audio`, `all` của tools/ep.mjs và KHÔNG chạy `pnpm series characters` — chỉ chạy `check` và `script` (với giai đoạn plan: `pnpm series plan <slug>`). Máy chủ xưởng sẽ tự vẽ storyboard sau khi bạn xong, nếu bố cục chưa đạt sẽ gọi bạn sửa tiếp.';

// đọc một dòng JSONL của `codex exec --json` → dòng log cho trang (null = bỏ qua)
export function codexLine(m, root) {
  const rel = (s) => String(s ?? '').replaceAll(root + '/', '').replaceAll(root + '\\', '');
  if (m.type === 'item.completed' || m.type === 'item.started') {
    const it = m.item ?? {};
    if (m.type === 'item.started' && it.type !== 'command_execution') return null;
    if (it.type === 'agent_message' && it.text?.trim()) return { text: it.text.trim(), message: it.text.trim() };
    if (it.type === 'command_execution') {
      if (m.type === 'item.started') return { text: `  ▸ Lệnh: ${rel(it.command).replace(/^\/bin\/(z|ba)sh -lc /, '').replace(/^"|"$/g, '').split('\n')[0].slice(0, 150)}` };
      return it.exit_code ? { text: `    (lệnh dừng mã ${it.exit_code})${it.aggregated_output ? ' ' + rel(it.aggregated_output).trim().split('\n').slice(-2).join(' · ').slice(0, 200) : ''}` } : null;
    }
    if (it.type === 'file_change') return { text: (it.changes ?? []).map((c) => `  ▸ ${c.kind === 'add' ? 'Tạo' : c.kind === 'delete' ? 'Xoá' : 'Sửa'}: ${rel(c.path)}`).join('\n') || null };
    if (it.type === 'web_search') return it.query ? { text: `  ▸ Tìm web: ${it.query}` } : null;
    if (it.type === 'error') return { text: `! ${it.message}` };
    return null;
  }
  if (m.type === 'turn.failed') return { text: `✗ ${m.error?.message ?? 'Codex báo lỗi'}`, failed: m.error?.message ?? 'Codex báo lỗi' };
  if (m.type === 'error') return { text: `✗ ${m.message ?? 'Codex báo lỗi'}`, failed: m.message ?? 'Codex báo lỗi' };
  return null;
}
