FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN python -m pip install --no-cache-dir fastapi "uvicorn[standard]" requests google-cloud-texttospeech

WORKDIR /app
COPY server.py /app/server.py
COPY test_server.py /app/test_server.py

EXPOSE 5070

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:5070/health >/dev/null || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5070", "--workers", "1"]
