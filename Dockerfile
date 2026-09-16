FROM node:24-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    STUDYTUBE_DATA_DIR=/data \
    STUDYTUBE_RENDERER_ENTRY=/app/apps/renderer/src/index.ts

# System packages mirror Remotion's documented Debian Chrome dependencies,
# with ffmpeg/curl/fonts and Intel VAAPI support added for rendering and health checks.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    fonts-liberation \
    fonts-noto-core \
    intel-media-va-driver \
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

# Install dependencies in a cache-friendly layer. Source-code changes no longer
# invalidate npm install; this layer is rebuilt only when a workspace manifest changes.
COPY package.json package-lock.json ./
COPY apps/renderer/package.json apps/renderer/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/schema/package.json packages/schema/package.json
COPY packages/tts/package.json packages/tts/package.json

# Build-time tools such as TypeScript and @remotion/cli are devDependencies,
# so install them before switching the runtime environment to production.
RUN npm ci

# Copy application source only after dependency installation so normal code edits
# can reuse the cached npm layer.
COPY . .

# Intel VAAPI needs the system FFmpeg, but Debian does not ship libfdk_aac.
# Remotion's binariesDirectory must contain the complete native compositor runtime,
# including its bundled libav*.so/libsw*.so libraries. Copy the whole platform
# package first, then replace only ffmpeg/ffprobe with StudyTube's Intel choices.
RUN mkdir -p /opt/studytube-intel-ffmpeg \
    && cp -a /app/node_modules/@remotion/compositor-linux-x64-gnu/. /opt/studytube-intel-ffmpeg/ \
    && cp /app/docker/ffmpeg-intel/ffmpeg /opt/studytube-intel-ffmpeg/ffmpeg \
    && chmod +x /opt/studytube-intel-ffmpeg/ffmpeg /opt/studytube-intel-ffmpeg/remotion \
    && ln -sf /usr/bin/ffprobe /opt/studytube-intel-ffmpeg/ffprobe \
    && test -f /opt/studytube-intel-ffmpeg/libavcodec.so \
    && test -f /opt/studytube-intel-ffmpeg/libavformat.so \
    && if ldd /opt/studytube-intel-ffmpeg/remotion | grep -q 'not found'; then \
         echo 'Remotion compositor has unresolved shared-library dependencies'; \
         ldd /opt/studytube-intel-ffmpeg/remotion; \
         exit 1; \
       fi

RUN npm run build
RUN npx remotion browser ensure

ENV NODE_ENV=production

RUN mkdir -p /data

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["npm", "run", "start", "--workspace", "@studytube/web"]
