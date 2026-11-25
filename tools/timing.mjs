// episode.json + bible.json + voice/dur.json → build/timed.json (props cho Remotion), build/audio.json (cho bộ trộn), out/<id>.srt
// Chưa có voice thì ước lượng thời lượng (dùng cho storyboard). Gọi: node tools/timing.mjs <thư-mục-tập>
import fs from 'node:fs';
import path from 'node:path';
import { FORMATS, dirs, episodeLines, estimateDur, loadEpisode, readJSON, resolveTheme, voiceSig, writeJSON } from './lib.mjs';
import { revealFrames, revealItems, storyTimes, STORY_SFX } from '../shared/reveal.mjs';
import { watermarkProps } from '../shared/watermark.mjs';
import { pickTrack } from './music-source.mjs';
import { isMain } from './platform.mjs';

const TRANS_DEFAULT = { type: 'slide', frames: 12 };

// opts.durOverride: { idCâu: giây } — ép thời lượng từng câu (voice-fix dựng lại đúng lịch hình của bản đã render)
// opts.write=false: chỉ tính, không ghi timed.json / audio.json / .srt
export function buildTiming(epArg, { durOverride = null, write = true } = {}) {
  const D = dirs();
  const { epDir, bible, episode } = loadEpisode(epArg);
  const fps = episode.fps ?? bible.fps ?? 30;
  const [width, height] = FORMATS[episode.format ?? bible.format ?? '9:16'];
  const lines = episodeLines(bible, episode);
  // chỉ tin thời lượng voice của câu chưa đổi chữ (manifest khớp chữ ký)
  const man = readJSON(path.join(epDir, D.voice, 'manifest.json'), {});
  const rawDur = readJSON(path.join(epDir, D.voice, 'dur.json'), {});
  const dur = Object.fromEntries(lines.filter((l) => rawDur[l.id] != null && man[l.id] === voiceSig(l)).map((l) => [l.id, rawDur[l.id]]));
  const staleVoice = lines.filter((l) => rawDur[l.id] != null && man[l.id] !== voiceSig(l)).map((l) => l.id);
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
  let estimated = 0;
  const F = (sec) => Math.round(sec * fps);

  const scenes = [];
  const voiceLines = [];
  const cues = [];
  const sfxOn = bible.sfx?.auto !== false;
  const sfxVol = bible.sfx?.volume ?? 0.6;
  const cue = (frame, name, vol = 1) => cues.push({ t: +(frame / fps).toFixed(3), name, vol: +(vol * sfxVol).toFixed(3) });
  let prevChar = null;

  episode.scenes.forEach((s, i) => {
    const tr = i === 0 ? { type: 'none', frames: 0 } : { ...TRANS_DEFAULT, ...(bible.transition ?? {}), ...(typeof s.transition === 'string' ? { type: s.transition } : s.transition ?? {}) };
    if (tr.type === 'none') tr.frames = 0;
    const T = tr.frames;
    const lead = i === 0 ? F(0.15) : T + F(0.12);
    let pos = lead;
    const sl = [];
    const beats = [];
    for (const l of lines.filter((x) => x.scene === s.id)) {
      let d = durOverride?.[l.id] ?? dur[l.id];
      if (d == null) {
        d = estimateDur(l.say ?? l.text);
        estimated++;
      }
      const from = pos;
      const to = pos + F(d);
      sl.push({ id: l.id, text: l.text, raw: l.raw, narr: l.narr || undefined, from, to, speaker: l.speaker ?? undefined, expr: l.expr, pose: l.pose, react: l.react });
      beats.push(from);
      pos = to + F(l.pause ?? s.gap ?? bible.gap ?? 0.18);
    }
    const contentEnd = sl.length ? sl[sl.length - 1].to : lead + F(s.hold ?? 2.5);
    const duration = Math.max(contentEnd + F(s.pad ?? bible.pad ?? 0.45), F(s.min ?? 0), T + F(0.8));
    const prev = scenes[i - 1];
    const from = prev ? prev.from + prev.duration - T : 0;
    // nhân vật: không chạy lại hiệu ứng vào nếu cảnh trước cùng nhân vật cùng chỗ
    const ch = s.character ? { ...s.character } : null;
    if (ch && prevChar && prevChar.id === ch.id && (prevChar.position ?? 'left') === (ch.position ?? 'left') && s.type !== 'character') ch.enter = false;
    prevChar = ch;
    const scene = { id: s.id, type: s.type, props: s.props ?? {}, from, duration, transition: tr, beats, lines: sl, character: ch };
    scenes.push(scene);

    for (const l of sl) voiceLines.push({ id: l.id, file: `${D.voice}/${l.id}.wav`, start: +((from + l.from) / fps).toFixed(3), speaker: l.speaker ?? null });

    // ── SFX tự động
    if (sfxOn && s.sfxAuto !== false) {
      if (i > 0 && T > 0) cue(from, tr.type === 'zoom' ? 'swoosh-up' : 'whoosh', 0.55);
      if (ch && ch.enter !== false) cue(from + T, 'pop-soft', 0.5);
      const ri = revealItems(scene);
      if (ri && ri.items.length) {
        const at = revealFrames(scene, ri.items.length, ri.items, fps);
        at.forEach((a, k) => cue(from + a, typeof ri.sfx === 'function' ? ri.sfx(ri.items[k]) : ri.sfx, 0.7));
      }
      const p = scene.props;
      if (s.type === 'hook') cue(from + 2, 'impact', i === 0 ? 0.9 : 0.6);
      if (s.type === 'title') { cue(from + T, 'swoosh-up', 0.6); cue(from + T + 8, 'ding', 0.6); }
      if (s.type === 'stat') { cue(from + 4, 'riser', 0.5); cue(from + 4 + Math.round(Math.min(45, duration * 0.45)), 'impact', 0.7); }
      if (s.type === 'alert') cue(from + T, 'alarm', 0.6);
      if (s.type === 'phone' && (p.mode ?? 'call') === 'call') for (let t = T; t < duration - fps; t += fps * 2.2) cue(from + t, 'ring', 0.45);
      if (s.type === 'outro') cue(from + T + 10, 'chime', 0.7);
      if (s.type === 'figure' && p.draw !== false) cue(from + 2, 'draw', 0.5);
      if (s.type === 'photo') cue(from + 2, 'camera', 0.35);
      if (s.type === 'story') {
        const pops = p.pops ?? [];
        storyTimes(scene, pops, fps).forEach((a, k) => cue(from + a, STORY_SFX.pop[pops[k].kind ?? 'tag'] ?? 'pop', pops[k].kind === 'big' ? 0.8 : 0.65));
        const its = p.screen ? p.screen.items ?? p.screen.rows ?? [] : [];
        if (p.screen) cue(from + T + 1, 'swoosh-up', 0.5);
        storyTimes(scene, its, fps).forEach((a, k) => cue(from + a, STORY_SFX.item(its[k]), 0.6));
      }
      if (s.type === 'chat') (p.messages ?? []).forEach((m, k) => m.warn && cue(from + revealFrames(scene, p.messages.length, p.messages, fps)[k] + 10, 'error', 0.6));
    }
    // ── SFX khai báo tay: [{ at: 'start'|'end'|'line:2'|<giây trong cảnh>, name, vol }]
    for (const x of s.sfx ?? []) {
      let a = 0;
      if (x.at === 'end') a = duration - F(0.3);
      else if (typeof x.at === 'string' && x.at.startsWith('line:')) a = beats[+x.at.slice(5) - 1] ?? 0;
      else if (typeof x.at === 'number') a = F(x.at);
      cue(from + a, x.name, x.vol ?? 1);
    }
  });

  const last = scenes[scenes.length - 1];
  const durationInFrames = last.from + last.duration;

  // ── phụ đề: cụm ≤ 6 từ / ≤ 32 ký tự, ngắt ở dấu câu; thời điểm từ chia theo độ dài
  const captions = [];
  for (const s of scenes)
    for (const l of s.lines) {
      const words = l.text.split(/\s+/).filter(Boolean);
      // từ nằm trong *nhấn* / ==dạ quang== của chữ gốc → tô màu ở phụ đề
      const rawW = (l.raw ?? '').split(/\s+/).filter(Boolean);
      let inEm = false;
      const ems = rawW.map((w) => { const c = (w.match(/\*|==/g) ?? []).length; const e = inEm || c > 0; if (c % 2) inEm = !inEm; return e; });
      const emOk = rawW.length === words.length;
      const wt = words.map((w) => 1 + (/[,.;:!?…]$/.test(w) ? 0.6 : 0) + Math.max(0, w.length - 5) * 0.05);
      const total = wt.reduce((a, b) => a + b, 0);
      const len = l.to - l.from;
      let acc = 0;
      const timed = words.map((w, k) => {
        const a = s.from + l.from + Math.round((acc / total) * len);
        acc += wt[k];
        return { w, from: a, to: s.from + l.from + Math.round((acc / total) * len), ...(emOk && ems[k] ? { em: true } : {}) };
      });
      let cur = [];
      const flush = () => {
        if (cur.length) captions.push({ from: cur[0].from, to: cur[cur.length - 1].to, words: cur });
        cur = [];
      };
      for (const t of timed) {
        cur.push(t);
        const chars = cur.map((x) => x.w).join(' ').length;
        if (cur.length >= 6 || chars >= 30 || (/[.!?…;]$/.test(t.w) && cur.length >= 2) || (/[:,]$/.test(t.w) && cur.length >= 3)) flush();
      }
      flush();
    }
  // giữ phụ đề tới khi cụm sau bắt đầu (tối đa +0.4s) để không nháy
  captions.forEach((c, k) => {
    const nx = captions[k + 1];
    c.to = Math.min(nx ? nx.from : c.to + F(0.4), c.to + F(0.4));
  });

  const timed = {
    fps, width, height, durationInFrames,
    series: { name: bible.name, channel: bible.channel, slug: bible.slug },
    episode: { id: episode.id, number: episode.number, total: bible.episodes ?? undefined, title: episode.title },
    theme: resolveTheme(bible),
    characters: episode.characters ?? bible.characters ?? [],
    scenes, captions,
    audio: 'mix.wav',
    chrome: { ...(bible.chrome ?? {}), ...(episode.chrome ?? {}) },
    watermark: episode.watermark === null ? undefined : watermarkProps(bible.watermark),
  };
  const audio = {
    fps, duration: +(durationInFrames / fps).toFixed(3), voiceLines, cues: cues.sort((a, b) => a.t - b.t),
    music: episode.music === null ? null : { mood: 'lofi', volume: 0.14, ...(bible.music ?? {}), ...(episode.music ?? {}), seed: episode.number ?? 1 },
  };
  if (bible.music === null && episode.music == null) audio.music = null;
  if (audio.music) {
    // nhạc của người dùng (file tải lên / đường dẫn trên máy) thay nhạc tự tổng hợp; không thấy bài nào → quay về nhạc theo mood
    const track = pickTrack(path.dirname(path.dirname(epDir)), bible.music, episode);
    if (track) audio.music.file = track;
    else if ((episode.music?.source ?? bible.music?.source) === 'file') console.log('  ! series chọn nhạc của tôi nhưng chưa có bài nào — dùng nhạc tự tổng hợp');
  }
  if (!write) return { timed, audio, estimated, staleVoice, total: lines.length, seconds: durationInFrames / fps };
  writeJSON(path.join(epDir, D.build, 'timed.json'), timed);
  writeJSON(path.join(epDir, D.build, 'audio.json'), audio);

  // SRT (tải kèm lên nền tảng nếu muốn phụ đề mềm)
  const ts = (fr) => {
    const ms = Math.round((fr / fps) * 1000);
    const p = (n, k = 2) => String(n).padStart(k, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  fs.mkdirSync(path.join(epDir, 'out'), { recursive: true });
  fs.writeFileSync(path.join(epDir, 'out', `${episode.id}${D.out}.srt`), captions.map((c, k) => `${k + 1}\n${ts(c.from)} --> ${ts(c.to)}\n${c.words.map((w) => w.w).join(' ')}\n`).join('\n'));

  return { timed, audio, estimated, staleVoice, total: lines.length, seconds: durationInFrames / fps };
}

if (isMain(import.meta.url)) {
  const r = buildTiming(process.argv[2] ?? '.');
  console.log(`timing: ${r.timed.scenes.length} cảnh, ${r.seconds.toFixed(1)}s${r.estimated ? ` (ước lượng ${r.estimated}/${r.total} câu — chưa có voice)` : ''}`);
}
