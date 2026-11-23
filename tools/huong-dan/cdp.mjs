// Điều khiển Chrome không giao diện qua DevTools Protocol (không cần thư viện): mở trang, chạy JS, chụp PNG.
// Dùng cho công cụ chụp màn hình video hướng dẫn (tools/huong-dan/chup.mjs).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from '../lib.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function chromePath() {
  const base = path.join(ROOT, 'node_modules/.remotion/chrome-headless-shell');
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base)) {
      const dir = path.join(base, d);
      for (const sub of fs.readdirSync(dir)) {
        const exe = path.join(dir, sub, 'chrome-headless-shell');
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(mac)) return mac;
  throw new Error('Không thấy Chrome — chạy một lần pnpm ep … storyboard để Remotion tải Chrome.');
}

export async function launch({ width = 1440, height = 900, scale = 2 } = {}) {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'xuong-cdp-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(chromePath(), ['--headless', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--no-first-run', '--hide-scrollbars', '--lang=vi-VN', `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 50 && !ws; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const pg = list.find((t) => t.type === 'page');
      if (pg) ws = pg.webSocketDebuggerUrl;
    } catch {}
  }
  if (!ws) { proc.kill(); throw new Error('Chrome không mở được cổng DevTools.'); }
  const sock = new WebSocket(ws);
  await new Promise((ok, no) => { sock.onopen = ok; sock.onerror = no; });
  let id = 0;
  const wait = new Map();
  sock.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { const [ok, no] = wait.get(m.id); wait.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); } };
  const send = (method, params = {}) => new Promise((ok, no) => { const i = ++id; wait.set(i, [ok, no]); sock.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result?.value;
  };
  return {
    send, evaluate, sleep,
    async goto(url, settle = 1200) { await send('Page.navigate', { url }); await sleep(settle); },
    // chụp cả khung nhìn, hoặc một vùng { x, y, width, height } theo px CSS
    async shot(file, clip) {
      const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}), captureBeyondViewport: !!clip });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    },
    async close() { try { sock.close(); } catch {} proc.kill(); await sleep(400); try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3 }); } catch {} },
  };
}
