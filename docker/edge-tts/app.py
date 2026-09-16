import asyncio
import json
import os
import struct
import tempfile
from pathlib import Path

import edge_tts
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="StudyTube Neural TTS")
DEFAULT_VOICE = os.getenv("EDGE_TTS_VOICE", "nl-NL-MaartenNeural")
DEFAULT_RATE = os.getenv("EDGE_TTS_RATE", "+0%")
TIMING_CHUNK_ID = b"sttm"


class SynthesisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)
    voice: str | None = None
    rate: str | None = None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "voice": DEFAULT_VOICE}


def append_word_timings(wav_bytes: bytes, word_boundaries: list[dict[str, int | str]]) -> bytes:
    if not word_boundaries:
        return wav_bytes
    if len(wav_bytes) < 12 or wav_bytes[:4] != b"RIFF" or wav_bytes[8:12] != b"WAVE":
        raise RuntimeError("ffmpeg did not produce a valid RIFF/WAVE file")

    payload = json.dumps(
        {"version": 1, "words": word_boundaries},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    padding = b"\x00" if len(payload) % 2 else b""
    timing_chunk = TIMING_CHUNK_ID + struct.pack("<I", len(payload)) + payload + padding
    result = bytearray(wav_bytes)
    result.extend(timing_chunk)
    struct.pack_into("<I", result, 4, len(result) - 8)
    return bytes(result)


@app.post("/synthesize")
async def synthesize(request: SynthesisRequest) -> Response:
    voice = request.voice or DEFAULT_VOICE
    rate = request.rate or DEFAULT_RATE

    try:
        with tempfile.TemporaryDirectory(prefix="studytube-tts-") as temp_dir:
            mp3_path = Path(temp_dir) / "speech.mp3"
            wav_path = Path(temp_dir) / "speech.wav"
            communicate = edge_tts.Communicate(request.text, voice=voice, rate=rate)
            word_boundaries: list[dict[str, int | str]] = []

            with mp3_path.open("wb") as mp3_file:
                async for chunk in communicate.stream():
                    chunk_type = chunk.get("type")
                    if chunk_type == "audio":
                        mp3_file.write(chunk["data"])
                    elif chunk_type == "WordBoundary":
                        word_boundaries.append(
                            {
                                "text": str(chunk.get("text", "")),
                                "offset": int(chunk.get("offset", 0)),
                                "duration": int(chunk.get("duration", 0)),
                            }
                        )

            process = await asyncio.create_subprocess_exec(
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(mp3_path),
                "-ac",
                "1",
                "-ar",
                "24000",
                str(wav_path),
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await process.communicate()
            if process.returncode != 0:
                detail = stderr.decode("utf-8", errors="replace")[:400]
                raise RuntimeError(f"ffmpeg conversion failed: {detail}")

            wav_bytes = append_word_timings(wav_path.read_bytes(), word_boundaries)
            return Response(content=wav_bytes, media_type="audio/wav")
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"TTS synthesis failed: {error}") from error
