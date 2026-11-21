#!/usr/bin/env bash
# Cài Xưởng phim trên máy mới — chạy một lần sau khi clone (chạy lại bao nhiêu lần cũng được, bước nào có rồi thì bỏ qua):
#   bash setup.sh
# Cài: Homebrew (nếu thiếu, sẽ hỏi mật khẩu máy) → git, Node, pnpm, uv, ffmpeg → thư viện Node/Python → font, kho SFX,
#      Chrome headless cho Remotion → giọng đọc VieNeu + lệnh tts-vi → skill /series → Claude Code CLI (cho nút AI trên trang web).
# Biến tuỳ chọn: XUONG_SKIP_TTS=1 (bỏ giọng đọc), XUONG_SKIP_SKILL=1 (không gắn skill), XUONG_SKIP_CLAUDE=1 (không cài claude CLI).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
say() { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }
ok() { printf '  ✓ %s\n' "$*"; }
has() { command -v "$1" >/dev/null 2>&1; }

OS="$(uname -s)"
say "Phần mềm hệ thống ($OS $(uname -m))"
if [ "$OS" = "Darwin" ]; then
  if ! has brew; then
    for p in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$p" ] && eval "$("$p" shellenv)"; done
  fi
  if ! has brew; then
    echo "  Chưa có Homebrew — cài bằng bộ cài chính thức (sẽ hỏi mật khẩu máy Mac)."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    for p in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$p" ] && eval "$("$p" shellenv)"; done
    has brew || { echo "  ✗ Cài Homebrew chưa xong — chạy lại: bash setup.sh"; exit 1; }
  fi
  ok "Homebrew $(brew --version | head -1 | cut -d' ' -f2)"
  need=()
  for t in git node pnpm uv ffmpeg; do has "$t" || need+=("$t"); done
  if has node && [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then echo "  Node $(node -v) quá cũ — cần ≥ 20"; need+=(node); fi
  if [ ${#need[@]} -gt 0 ]; then echo "  Cài: ${need[*]}"; brew install "${need[@]}"; fi
elif [ "$OS" = "Linux" ]; then
  if has apt-get; then
    miss=(); for t in git ffmpeg curl; do has "$t" || miss+=("$t"); done
    [ ${#miss[@]} -gt 0 ] && sudo apt-get update && sudo apt-get install -y "${miss[@]}"
  fi
  has uv || { curl -LsSf https://astral.sh/uv/install.sh | sh; export PATH="$HOME/.local/bin:$PATH"; }
  has node || { echo "  ✗ Cần Node ≥ 20 (vd: https://nodejs.org hoặc nvm) rồi chạy lại."; exit 1; }
  has pnpm || { corepack enable 2>/dev/null || npm install -g pnpm@9; }
else
  echo "  ✗ Chỉ hỗ trợ macOS và Linux (Windows: dùng WSL)."; exit 1
fi
for t in git node pnpm uv ffmpeg; do has "$t" || { echo "  ✗ Thiếu $t"; exit 1; }; done
ok "git $(git --version | cut -d' ' -f3) · node $(node -v) · pnpm $(pnpm -v) · $(uv --version) · ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3)"

say "Thư viện Node (pnpm install)"
pnpm install --frozen-lockfile
say "Font tiếng Việt"
node tools/sync-fonts.mjs
say "Môi trường Python cho âm thanh (uv sync) + kho SFX"
uv sync
[ -n "$(ls assets/sfx/*.wav 2>/dev/null)" ] && ok "kho SFX đã có" || uv run tools/audio/sfx_bank.py
say "Chrome headless cho Remotion"
pnpm exec remotion browser ensure

if [ "${XUONG_SKIP_TTS:-}" != 1 ]; then
  say "Giọng đọc VieNeu + lệnh tts-vi"
  bash tools/tts-vi/install.sh
fi

if [ "${XUONG_SKIP_SKILL:-}" != 1 ]; then
  say "Skill /series cho Claude Code"
  dst="$HOME/.claude/skills/series"
  mkdir -p "$HOME/.claude/skills"
  if [ -L "$dst" ] || [ ! -e "$dst" ]; then ln -sfn "$ROOT/skill" "$dst"; ok "$dst → $ROOT/skill"
  else echo "  ! $dst là thư mục thật — không ghi đè. Xoá nó rồi chạy lại nếu muốn dùng skill của repo này."; fi
fi

if [ "${XUONG_SKIP_CLAUDE:-}" != 1 ]; then
  say "Claude Code CLI (cho nút AI trên trang web)"
  if has claude; then ok "claude $(claude --version 2>/dev/null | head -1)"
  else npm install -g @anthropic-ai/claude-code && ok "đã cài claude"; fi
  echo "  Nhớ đăng nhập một lần: chạy  claude  rồi gõ  /login"
fi

say "Kiểm tra"
node tools/doctor.mjs
printf '\nXong. Mở trang web: pnpm web  →  http://localhost:4710\n'
