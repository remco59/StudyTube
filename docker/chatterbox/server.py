import base64
import io
import os
import re
import tempfile
import threading
from pathlib import Path
from typing import Literal, Optional

import numpy as np
import requests
import soundfile as sf
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="StudyTube Chatterbox TTS")
DEVICE = os.getenv("CHATTERBOX_DEVICE", "cpu").strip() or "cpu"
MODEL_DIR = Path(os.getenv("CHATTERBOX_DATA_DIR", "/models"))
_models = {}
_model_lock = threading.Lock()
_synthesis_lock = threading.Lock()

DEFAULT_PROMPTS = {
    "nl": "https://storage.googleapis.com/chatterbox-demo-samples/mtl_prompts/nl_m.flac",
    "en": "https://storage.googleapis.com/chatterbox-demo-samples/mtl_prompts/en_f1.flac",
}


class SynthesisRequest(BaseModel):
    text: str = Field(min_length=1)
    language: str = "nl"
    t3Model: Literal["v2", "v3"] = "v2"
    exaggeration: float = Field(default=0.5, ge=0.0, le=2.0)
    cfgWeight: float = Field(default=0.5, ge=0.0, le=1.0)
    temperature: float = Field(default=0.8, gt=0.0, le=5.0)
    referenceAudio: Optional[str] = None
    referenceAudioName: Optional[str] = None


def get_model(version: str):
    if version in _models:
        return _models[version]
    with _model_lock:
        if version not in _models:
            _models[version] = ChatterboxMultilingualTTS.from_pretrained(device=DEVICE, t3_model=version)
    return _models[version]


def chunks(text: str, max_chars: int = 280):
    text = " ".join(text.split())
    if len(text) <= max_chars:
        return [text]
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]
    result = []
    current = ""
    for sentence in sentences:
        if len(sentence) > max_chars:
            words = sentence.split()
            for word in words:
                proposed = f"{current} {word}".strip()
                if current and len(proposed) > max_chars:
                    result.append(current)
                    current = word
                else:
                    current = proposed
            continue
        proposed = f"{current} {sentence}".strip()
        if current and len(proposed) > max_chars:
            result.append(current)
            current = sentence
        else:
            current = proposed
    if current:
        result.append(current)
    return result or [text[:max_chars]]


def download_default_prompt(language: str):
    url = DEFAULT_PROMPTS.get(language)
    if not url:
        return None
    prompts = MODEL_DIR / "prompts"
    prompts.mkdir(parents=True, exist_ok=True)
    path = prompts / f"{language}-default.flac"
    if not path.exists():
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        path.write_bytes(response.content)
    return str(path)


def reference_path(request: SynthesisRequest):
    if not request.referenceAudio:
        return download_default_prompt(request.language)
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
    return {"ok": True, "device": DEVICE, "loadedModels": sorted(_models.keys())}


@app.post("/synthesize")
def synthesize(request: SynthesisRequest):
    with _synthesis_lock:
        temp_reference = None
        try:
            model = get_model(request.t3Model)
            ref = reference_path(request)
            if request.referenceAudio:
                temp_reference = ref
            generated = []
            for part in chunks(request.text):
                kwargs = {
                    "language_id": request.language,
                    "exaggeration": request.exaggeration,
                    "cfg_weight": request.cfgWeight,
                    "temperature": request.temperature,
                }
                if ref:
                    kwargs["audio_prompt_path"] = ref
                wav = model.generate(part, **kwargs)
                generated.append(wav.squeeze(0).detach().cpu().numpy())
            pause = np.zeros(int(model.sr * 0.12), dtype=np.float32)
            combined = generated[0] if len(generated) == 1 else np.concatenate([item for index, wav in enumerate(generated) for item in ((pause if index else np.array([], dtype=np.float32)), wav)])
            buffer = io.BytesIO()
            sf.write(buffer, combined, model.sr, format="WAV", subtype="PCM_16")
            return Response(content=buffer.getvalue(), media_type="audio/wav")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Chatterbox generation failed: {type(exc).__name__}: {exc}") from exc
        finally:
            if temp_reference:
                try:
                    os.unlink(temp_reference)
                except OSError:
                    pass
