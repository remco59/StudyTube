FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    EDGE_TTS_VOICE=nl-NL-MaartenNeural \
    EDGE_TTS_RATE=+0%

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt
COPY app.py ./

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD curl --fail --silent http://127.0.0.1:5050/health >/dev/null || exit 1

CMD ["uvicorn","app:app","--host","0.0.0.0","--port","5050"]
