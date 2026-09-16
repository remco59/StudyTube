import asyncio
import os
import tempfile
from pathlib import Path

import edge_tts
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="StudyTube Neural TTS")
DEFAULT_VOICE = os.getenv("EDGE_TTS_VOICE", "nl-NL-MaartenNeural")
DEFAULT_RATE = os.getenv("EDGE_TTS_RATE", "+0%")


class SynthesisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)
    voice: str | None = None
    rate: str | None = None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "voice": DEFAULT_VOICE}


@app.post("/synthesize")
async def synthesize(request: SynthesisRequest) -> Response:
    voice = request.voice or DEFAULT_VOICE
    rate = request.rate or DEFAULT_RATE

    try:
        with tempfile.TemporaryDirectory(prefix="studytube-tts-") as temp_dir:
            mp3_path = Path(temp_dir) / "speech.mp3"
            wav_path = Path(temp_dir) / "speech.wav"
            communicate = edge_tts.Communicate(request.text, voice=voice, rate=rate)
            await communicate.save(str(mp3_path))

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

            return Response(content=wav_path.read_bytes(), media_type="audio/wav")
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"TTS synthesis failed: {error}") from error
