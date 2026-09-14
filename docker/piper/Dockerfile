FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIPER_VOICE=nl_NL-mls-medium \
    PIPER_DATA_DIR=/data

RUN python -m pip install --no-cache-dir "piper-tts[http]>=1.4,<2"

COPY entrypoint.sh /usr/local/bin/studytube-piper
RUN chmod +x /usr/local/bin/studytube-piper && mkdir -p /data

EXPOSE 5000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/info', timeout=4).read()" || exit 1

ENTRYPOINT ["/usr/local/bin/studytube-piper"]
