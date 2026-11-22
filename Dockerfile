# Xưởng phim trong Docker: trang web + dựng phim (Remotion/Chrome headless) + giọng đọc VieNeu + âm thanh (uv) + Claude CLI.
#   docker compose up -d --build      → http://localhost:4710
# Dữ liệu không nằm trong image: series/ (gắn từ repo), thư mục xuất phim, cấu hình Drive, cache model — xem docker-compose.yml.
FROM node:24-bookworm-slim

# ffmpeg + thư viện Chrome headless theo hướng dẫn Docker của Remotion + font emoji
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg git ca-certificates curl \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 \
      libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.13.9 /uv /uvx /usr/local/bin/
ENV UV_PYTHON_INSTALL_DIR=/opt/uv-python UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1 \
    HF_HOME=/data/cache/huggingface PNPM_HOME=/opt/pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Giọng đọc VieNeu-TTS (bản ghim đã kiểm chứng với xưởng) — lớp riêng để đổi mã xưởng không phải cài lại
ARG VIENEU_REF=6566468
RUN git clone https://github.com/pnnbao97/VieNeu-TTS.git /opt/vieneu \
    && git -C /opt/vieneu checkout -q ${VIENEU_REF} \
    && cd /opt/vieneu && uv sync --frozen --no-dev

# Claude Code CLI cho các nút AI (đăng nhập bằng biến CLAUDE_CODE_OAUTH_TOKEN hoặc ANTHROPIC_API_KEY)
ARG WITH_CLAUDE=1
RUN if [ "$WITH_CLAUDE" = 1 ]; then npm install -g @anthropic-ai/claude-code && npm cache clean --force; fi

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen
RUN pnpm exec remotion browser ensure

COPY . .
RUN node tools/sync-fonts.mjs && uv run tools/audio/sfx_bank.py \
    && sed "s|^VIENEU_DIR=.*|VIENEU_DIR=/opt/vieneu|" tools/tts-vi/config.example.env > tools/tts-vi/config.env \
    && printf '#!/bin/sh\nexec /opt/vieneu/.venv/bin/python -I /app/tools/tts-vi/tts_vi.py "$@"\n' > /usr/local/bin/tts-vi \
    && chmod +x /usr/local/bin/tts-vi docker/entrypoint.sh \
    && mkdir -p /root/.claude/skills && ln -sfn /app/skill /root/.claude/skills/series

ENV HOST=0.0.0.0 PORT=4710 XUONG_DOCKER=1 XUONG_CONFIG_DIR=/data/config XUONG_OUTPUT_DIR=/data/output
EXPOSE 4710
ENTRYPOINT ["docker/entrypoint.sh"]
CMD ["node", "tools/web/server.mjs"]
