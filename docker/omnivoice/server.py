import base64
import hashlib
import io
import os
import tempfile
import threading
from pathlib import Path
from typing import Optional

import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from omnivoice import OmniVoice
from pydantic import BaseModel, Field

app = FastAPI(title="StudyTube OmniVoice TTS")
MODEL_NAME = os.getenv("OMNIVOICE_MODEL", "k2-fsa/OmniVoice")
DEVICE = os.getenv("OMNIVOICE_DEVICE", "cpu").strip() or "cpu"

_model = None
_model_lock = threading.Lock()
_synthesis_lock = threading.Lock()
_clone_prompts = {}


class SynthesisRequest(BaseModel):
    text: str = Field(min_length=1)
    language: Optional[str] = None
    speed: float = Field(default=1.0, gt=0.0, le=3.0)
    numSteps: int = Field(default=16, ge=8, le=64)
    instruction: Optional[str] = None
    normalizeText: bool = True
    referenceAudio: Optional[str] = None
    referenceAudioName: Optional[str] = None
    referenceText: Optional[str] = None


def get_model():
    global _model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is None:
            dtype = torch.float32 if DEVICE == "cpu" else torch.float16
            _model = OmniVoice.from_pretrained(MODEL_NAME, device_map=DEVICE, dtype=dtype)
    return _model


def get_clone_prompt(model, request: SynthesisRequest):
    if not request.referenceAudio:
        return None
    try:
        audio_bytes = base64.b64decode(request.referenceAudio, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid reference audio: {exc}") from exc

    key = hashlib.sha256(audio_bytes + (request.referenceText or "").encode("utf-8")).hexdigest()
    if key in _clone_prompts:
        return _clone_prompts[key]

    suffix = Path(request.referenceAudioName or "reference.wav").suffix or ".wav"
    path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
            handle.write(audio_bytes)
            path = handle.name
        prompt = model.create_voice_clone_prompt(ref_audio=path, ref_text=request.referenceText or None)
        _clone_prompts[key] = prompt
        return prompt
    finally:
        if path:
            try:
                os.unlink(path)
            except OSError:
                pass


@app.get("/health")
def health():
    return {"ok": True, "modelLoaded": _model is not None, "device": DEVICE, "model": MODEL_NAME}


@app.post("/synthesize")
def synthesize(request: SynthesisRequest):
    with _synthesis_lock:
        try:
            model = get_model()
            clone_prompt = get_clone_prompt(model, request)
            kwargs = {
                "text": request.text.strip(),
                "language": request.language or None,
                "num_step": request.numSteps,
                "speed": request.speed,
                "normalize_text": request.normalizeText,
            }
            if clone_prompt is not None:
                kwargs["voice_clone_prompt"] = clone_prompt
            elif request.instruction and request.instruction.strip():
                kwargs["instruct"] = request.instruction.strip()

            audio = model.generate(**kwargs)
            if not audio:
                raise RuntimeError("OmniVoice returned no audio")
            buffer = io.BytesIO()
            sf.write(buffer, audio[0], model.sampling_rate, format="WAV", subtype="PCM_16")
            return Response(content=buffer.getvalue(), media_type="audio/wav")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"OmniVoice generation failed: {type(exc).__name__}: {exc}") from exc
