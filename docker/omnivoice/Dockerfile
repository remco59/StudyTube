FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models/huggingface \
    OMNIVOICE_DEVICE=cpu

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.8.0 torchaudio==2.8.0 \
    && python -m pip install --no-cache-dir omnivoice fastapi "uvicorn[standard]" soundfile

WORKDIR /app
COPY server.py /app/server.py

EXPOSE 5060

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
  CMD curl --fail --silent http://127.0.0.1:5060/health >/dev/null || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5060", "--workers", "1"]
