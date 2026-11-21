#!/usr/bin/env bash
# Cài lệnh `tts-vi` trên máy mới (macOS Apple Silicon / Linux x86_64).
#   bash tools/tts-vi/install.sh
# Việc làm: tải VieNeu-TTS (bản ghim) → `uv sync` → tạo config.env từ mẫu (nếu chưa có) → tạo lệnh ~/.local/bin/tts-vi.
# Không đụng tới khoá: muốn có Gemini dự phòng thì tự điền đường dẫn file khoá vào config.env.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
VIENEU_DIR="${VIENEU_DIR:-$HOME/VieNeu-TTS}"
VIENEU_REF="${VIENEU_REF:-6566468}" # release 3.8.5 — bản đã kiểm chứng với xưởng
BIN="${TTS_BIN_DIR:-$HOME/.local/bin}"

command -v uv >/dev/null || { echo "Thiếu uv — cài: curl -LsSf https://astral.sh/uv/install.sh | sh"; exit 1; }
command -v git >/dev/null || { echo "Thiếu git"; exit 1; }

if [ ! -d "$VIENEU_DIR/.git" ]; then
  echo "→ Tải VieNeu-TTS vào $VIENEU_DIR"
  git clone https://github.com/pnnbao97/VieNeu-TTS.git "$VIENEU_DIR"
fi
git -C "$VIENEU_DIR" fetch -q origin || true
git -C "$VIENEU_DIR" checkout -q "$VIENEU_REF"
echo "→ Cài môi trường Python của VieNeu (uv sync)"
(cd "$VIENEU_DIR" && uv sync)

if [ ! -f "$HERE/config.env" ]; then
  sed "s|^VIENEU_DIR=.*|VIENEU_DIR=$VIENEU_DIR|" "$HERE/config.example.env" > "$HERE/config.env"
  echo "→ Tạo $HERE/config.env (chưa có khoá Gemini — chỉ dùng VieNeu)"
fi

mkdir -p "$BIN"
cat > "$BIN/tts-vi" <<EOF
#!/usr/bin/env bash
# Sinh lời đọc tiếng Việt: VieNeu-TTS local → Gemini API → Gemini Agent Platform. Xem: tts-vi -h
exec "$VIENEU_DIR/.venv/bin/python" -I "$HERE/tts_vi.py" "\$@"
EOF
chmod +x "$BIN/tts-vi"
echo "→ Lệnh: $BIN/tts-vi"
case ":$PATH:" in *":$BIN:"*) ;; *) echo "  ! Thêm $BIN vào PATH (vd: echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc)";; esac

echo "→ Thử: lần đầu VieNeu tải model từ Hugging Face (vài trăm MB)"
"$BIN/tts-vi" --voices | head -5
echo "Xong."
