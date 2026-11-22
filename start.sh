#!/usr/bin/env bash
# Mở Xưởng phim — chọn cách chạy một lần, lần sau tự nhớ:
#   bash start.sh            chạy theo cách đã chọn (lần đầu sẽ hỏi)
#   bash start.sh --chon     chọn lại
#   bash start.sh thang      chạy thẳng trên máy (nhanh hơn — khuyên dùng)
#   bash start.sh docker     chạy trong Docker (không phải cài từng phần mềm, nhưng chậm hơn trên Mac/Windows)
# Lựa chọn lưu ở .xuong-mode (ngoài git).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
PORT="${PORT:-4710}"
URL="http://localhost:$PORT"
MODE_FILE="$ROOT/.xuong-mode"
say() { printf '\n\033[1;33m▶ %s\033[0m\n' "$*"; }
has() { command -v "$1" >/dev/null 2>&1; }
open_url() { (sleep 2; if has open; then open "$URL"; elif has xdg-open; then xdg-open "$URL" >/dev/null 2>&1; elif has wslview; then wslview "$URL"; fi) & }

mode="${1:-}"
[ "$mode" = "--chon" ] && { rm -f "$MODE_FILE"; mode=""; }
[ -z "$mode" ] && [ -f "$MODE_FILE" ] && mode="$(cat "$MODE_FILE")"
if [ -z "$mode" ]; then
  cat <<'EOF'

Xưởng phim — chọn cách chạy:
  1) Chạy thẳng trên máy  (khuyên dùng — nhanh hơn: đọc giọng ~8 lần, dựng hình ~1,8 lần so với Docker trên Mac)
                          lần đầu tự cài phần mềm còn thiếu (bash setup.sh), mất 10–20 phút
  2) Chạy trong Docker    (chỉ cần Docker Desktop; chậm hơn trên Mac/Windows)
EOF
  read -r -p "Chọn 1 hoặc 2 [1]: " ans
  case "${ans:-1}" in 2) mode=docker ;; *) mode=thang ;; esac
  echo "$mode" > "$MODE_FILE"
  echo "Đã nhớ lựa chọn. Đổi lại: bash start.sh --chon"
fi

# Cổng đang bận: nếu là Xưởng phim đang dựng dở thì không được dừng (mất việc đang chạy)
if curl -fsS "$URL/api/job" >/dev/null 2>&1; then
  if curl -fsS "$URL/api/job" | grep -q '"status":"\(running\|stopping\)"'; then
    echo "Xưởng phim đang chạy một việc (dựng phim / viết kịch bản) ở $URL — chờ xong rồi chạy lại lệnh này."
    open_url; exit 0
  fi
fi

if [ "$mode" = "docker" ]; then
  has docker || { echo "✗ Chưa có Docker — cài Docker Desktop (https://www.docker.com/products/docker-desktop/) rồi chạy lại, hoặc: bash start.sh thang"; exit 1; }
  docker info >/dev/null 2>&1 || { echo "✗ Docker Desktop chưa mở — mở ứng dụng Docker rồi chạy lại."; exit 1; }
  if [ ! -f .env ]; then
    cp .env.example .env
    sed -i.bak "s|^XUONG_OUTPUT_DIR=.*|XUONG_OUTPUT_DIR=$HOME/Movies/Xưởng phim|; s|^TU_LIEU_DIR=.*|TU_LIEU_DIR=$HOME/Documents|" .env && rm -f .env.bak
    echo "Đã tạo file .env. Muốn dùng các nút AI trong Docker: chạy  claude setup-token  rồi dán mã vào dòng CLAUDE_CODE_OAUTH_TOKEN trong .env."
  fi
  pgrep -f "tools/web/server.mjs" >/dev/null 2>&1 && { echo "Đang có bản chạy thẳng mở ở cổng $PORT — tắt nó (Ctrl+C ở cửa sổ đang chạy pnpm web) rồi chạy lại."; exit 1; }
  say "Dựng và mở Xưởng phim trong Docker (lần đầu tải vài GB)"
  docker compose up -d --build
  echo "Mở $URL — dừng: docker compose stop"
  open_url
  exit 0
fi

# chạy thẳng
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx xuong-phim; then
  say "Dừng bản Docker đang chạy (máy này chuyển sang chạy thẳng)"
  docker compose stop
fi
if curl -fsS "$URL/api/job" >/dev/null 2>&1; then
  echo "Xưởng phim đang mở sẵn ở $URL."; open_url; exit 0
fi
if ! node tools/doctor.mjs >/dev/null 2>&1; then
  say "Máy chưa cài đủ — chạy bash setup.sh (lần đầu 10–20 phút)"
  bash setup.sh
fi
say "Mở Xưởng phim: $URL  (dừng: Ctrl+C)"
open_url
exec node tools/web/server.mjs
