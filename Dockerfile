FROM node:24-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    STUDYTUBE_DATA_DIR=/data \
    STUDYTUBE_RENDERER_ENTRY=/app/apps/renderer/src/index.ts

# System packages mirror Remotion's documented Debian Chrome dependencies,
# with ffmpeg/curl/fonts added for rendering and health checks.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    fonts-liberation \
    fonts-noto-core \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libgbm-dev \
    libnss3 \
    libpango-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon-dev \
    libxrandr2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .
# Build-time tools such as TypeScript and @remotion/cli are devDependencies,
# so install them before switching the runtime environment to production.
RUN npm install
RUN npm run build
RUN npx remotion browser ensure

ENV NODE_ENV=production

RUN mkdir -p /data

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["npm", "run", "start", "--workspace", "@studytube/web"]
