#!/bin/sh
set -eu

VOICE="${PIPER_VOICE:-nl_NL-mls-medium}"
DATA_DIR="${PIPER_DATA_DIR:-/data}"
MODEL="${DATA_DIR}/${VOICE}.onnx"
CONFIG="${DATA_DIR}/${VOICE}.onnx.json"

mkdir -p "${DATA_DIR}"

if [ ! -f "${MODEL}" ] || [ ! -f "${CONFIG}" ]; then
  echo "Downloading Piper voice ${VOICE} into ${DATA_DIR}"
  python -m piper.download_voices --data-dir "${DATA_DIR}" "${VOICE}"
fi

echo "Starting Piper HTTP server with ${VOICE}"
exec python -m piper.http_server \
  --host 0.0.0.0 \
  --port 5000 \
  --data-dir "${DATA_DIR}" \
  -m "${VOICE}"
