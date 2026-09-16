FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models/huggingface \
    CHATTERBOX_DEVICE=cpu \
    TRANSFORMERS_ATTN_IMPLEMENTATION=eager

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ffmpeg git libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.6.0 torchaudio==2.6.0 \
    && python -m pip install --no-cache-dir chatterbox-tts==0.1.7 fastapi "uvicorn[standard]" soundfile requests

WORKDIR /app
COPY server.py /app/server.py

EXPOSE 5080

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
  CMD curl --fail --silent http://127.0.0.1:5080/health >/dev/null || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5080", "--workers", "1"]
