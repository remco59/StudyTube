FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TTS_HOME=/models/coqui \
    XTTS_DEVICE=cpu

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch==2.6.0 torchaudio==2.6.0 \
    && python -m pip install --no-cache-dir coqui-tts==0.27.5 fastapi "uvicorn[standard]" soundfile

WORKDIR /app
COPY server.py /app/server.py

EXPOSE 5090
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5090", "--workers", "1"]
