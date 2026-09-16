import base64
import io
import os
import tempfile
import threading
from pathlib import Path
from typing import Optional

import soundfile as sf
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from TTS.api import TTS

app = FastAPI(title="StudyTube XTTS v2")
DEVICE = os.getenv("XTTS_DEVICE", "cpu").strip() or "cpu"
MODEL_NAME = os.getenv("XTTS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")
_model = None
_model_lock = threading.Lock()
_synthesis_lock = threading.Lock()


class SynthesisRequest(BaseModel):
    text: str = Field(min_length=1)
    language: str = "nl"
    speaker: str = "Ana Florence"
    speed: float = Field(default=1.0, gt=0.0, le=3.0)
    referenceAudio: Optional[str] = None
    referenceAudioName: Optional[str] = None


def license_accepted():
    return os.getenv("COQUI_TOS_AGREED", "").strip() == "1"


def get_model():
    global _model
    if not license_accepted():
        raise HTTPException(status_code=503, detail="XTTS requires acceptance of the Coqui Public Model License. Read https://coqui.ai/cpml and set COQUI_TOS_AGREED=1 if you agree.")
    if _model is not None:
        return _model
    with _model_lock:
        if _model is None:
            _model = TTS(MODEL_NAME, progress_bar=False).to(DEVICE)
    return _model


def make_reference(request: SynthesisRequest):
    if not request.referenceAudio:
        return None
    try:
        audio = base64.b64decode(request.referenceAudio, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid reference audio: {exc}") from exc
    suffix = Path(request.referenceAudioName or "reference.wav").suffix or ".wav"
    handle = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    handle.write(audio)
    handle.close()
    return handle.name


@app.get("/health")
def health():
    return {"ok": True, "device": DEVICE, "modelLoaded": _model is not None, "licenseAccepted": license_accepted(), "model": MODEL_NAME}


@app.post("/synthesize")
def synthesize(request: SynthesisRequest):
    with _synthesis_lock:
        reference = None
        try:
            model = get_model()
            reference = make_reference(request)
            kwargs = {
                "text": request.text,
                "language": request.language,
                "speed": request.speed,
                "split_sentences": True,
            }
            if reference:
                kwargs["speaker_wav"] = reference
            else:
                kwargs["speaker"] = request.speaker
            wav = model.tts(**kwargs)
            sample_rate = int(model.synthesizer.output_sample_rate)
            buffer = io.BytesIO()
            sf.write(buffer, wav, sample_rate, format="WAV", subtype="PCM_16")
            return Response(content=buffer.getvalue(), media_type="audio/wav")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"XTTS generation failed: {type(exc).__name__}: {exc}") from exc
        finally:
            if reference:
                try:
                    os.unlink(reference)
                except OSError:
                    pass
