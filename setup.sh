#!/usr/bin/env bash
# Cài Xưởng phim trên máy mới — chạy một lần sau khi clone (chạy lại bao nhiêu lần cũng được, bước nào có rồi thì bỏ qua):
#   bash setup.sh
# Cài: Homebrew (nếu thiếu, sẽ hỏi mật khẩu máy) → git, Node, pnpm, uv, ffmpeg → thư viện Node/Python → font, kho SFX,
#      Chrome headless cho Remotion → giọng đọc VieNeu + lệnh tts-vi → skill /series → Claude Code CLI (cho nút AI trên trang web).
# Biến tuỳ chọn: XUONG_SKIP_TTS=1 (bỏ giọng đọc), XUONG_SKIP_SKILL=1 (không gắn skill), XUONG_SKIP_CLAUDE=1 (không cài claude CLI),
#               XUONG_SKIP_THU=1 (không dựng thử tập mẫu ở cuối).
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
  # Linux và Windows (WSL2, Ubuntu). Gói hệ thống giống Dockerfile: ffmpeg + thư viện Chrome headless của Remotion + font emoji.
  SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
  if has apt-get; then
    pkgs=(git ffmpeg curl ca-certificates xz-utils libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libxrandr2 libxkbcommon-dev libxfixes3
          libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 fonts-noto-color-emoji)
    # libasound2 đổi tên thành libasound2t64 trên Ubuntu 24.04
    if apt-cache show libasound2t64 >/dev/null 2>&1; then pkgs+=(libasound2t64); else pkgs+=(libasound2); fi
    miss=(); for p in "${pkgs[@]}"; do dpkg -s "$p" >/dev/null 2>&1 || miss+=("$p"); done
    if [ ${#miss[@]} -gt 0 ]; then echo "  Cài gói hệ thống (có thể hỏi mật khẩu): ${miss[*]}"; $SUDO apt-get update && $SUDO apt-get install -y --no-install-recommends "${miss[@]}"; fi
  else
    echo "  ! Không có apt-get — tự cài git, ffmpeg, curl và thư viện Chrome headless (xem Dockerfile) rồi chạy lại."
  fi
  export PATH="$HOME/.local/bin:$PATH"
  has uv || curl -LsSf https://astral.sh/uv/install.sh | sh
  if ! has node || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
    # Node 24 bản chính thức vào ~/.local (không cần quyền root, không đụng Node có sẵn của hệ thống)
    NODE_V=24.11.1; arch="$(uname -m)"; case "$arch" in x86_64) arch=x64;; aarch64|arm64) arch=arm64;; esac
    echo "  Cài Node $NODE_V vào ~/.local"
    curl -fsSL "https://nodejs.org/dist/v$NODE_V/node-v$NODE_V-linux-$arch.tar.xz" | tar -xJ -C "$HOME/.local" --strip-components=1
    hash -r
  fi
  has pnpm || npm install -g --prefix "$HOME/.local" pnpm@9.15.9
  grep -qs 'HOME/.local/bin' "$HOME/.bashrc" || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
  case "$(pwd)" in /mnt/*) echo "  ! Thư mục đang ở ổ Windows (/mnt/…) — chạy rất chậm. Nên clone vào thư mục nhà của WSL (~/)";; esac
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
if [ "${XUONG_SKIP_TTS:-}" != 1 ] && [ "${XUONG_SKIP_THU:-}" != 1 ]; then
  say "Dựng thử một tập mẫu ~9 giây (kiểm tra cả dây chuyền + đo tốc độ máy)"
  node tools/doctor.mjs --thu
fi
printf '\nXong. Mở trang web: pnpm web  →  http://localhost:4710\n'
