import html
import os
from pathlib import Path
from typing import Optional

import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from google.cloud import texttospeech
from pydantic import BaseModel, Field

app = FastAPI(title="StudyTube Cloud TTS")
_google_client = None


class CloudSynthesisRequest(BaseModel):
    text: str = Field(min_length=1)
    language: str = "nl-NL"
    voice: str


def google_configured() -> bool:
    path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    return bool(path and Path(path).is_file())


def azure_configured() -> bool:
    return bool(os.getenv("AZURE_SPEECH_KEY", "").strip() and os.getenv("AZURE_SPEECH_REGION", "").strip())


def get_google_client():
    global _google_client
    if not google_configured():
        raise HTTPException(status_code=503, detail="Google Chirp is not configured. Put credentials at /credentials/google.json or set GOOGLE_APPLICATION_CREDENTIALS.")
    if _google_client is None:
        try:
            _google_client = texttospeech.TextToSpeechClient()
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Could not initialize Google Cloud TTS: {exc}") from exc
    return _google_client


@app.get("/health")
def health():
    return {
        "ok": True,
        "googleConfigured": google_configured(),
        "azureConfigured": azure_configured(),
    }


@app.post("/google/synthesize")
def google_synthesize(request: CloudSynthesisRequest):
    try:
        client = get_google_client()
        response = client.synthesize_speech(
            input=texttospeech.SynthesisInput(text=request.text),
            voice=texttospeech.VoiceSelectionParams(language_code=request.language, name=request.voice),
            audio_config=texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.LINEAR16),
        )
        return Response(content=response.audio_content, media_type="audio/wav")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Google Chirp generation failed: {type(exc).__name__}: {exc}") from exc


@app.post("/azure/synthesize")
def azure_synthesize(request: CloudSynthesisRequest):
    key = os.getenv("AZURE_SPEECH_KEY", "").strip()
    region = os.getenv("AZURE_SPEECH_REGION", "").strip()
    if not key or not region:
        raise HTTPException(status_code=503, detail="Azure Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.")

    endpoint = os.getenv("AZURE_SPEECH_ENDPOINT", "").strip() or f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    ssml = (
        f"<speak version='1.0' xml:lang='{html.escape(request.language, quote=True)}'>"
        f"<voice name='{html.escape(request.voice, quote=True)}'>"
        f"{html.escape(request.text)}"
        "</voice></speak>"
    )
    try:
        response = requests.post(
            endpoint,
            headers={
                "Ocp-Apim-Subscription-Key": key,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm",
                "User-Agent": "StudyTube",
            },
            data=ssml.encode("utf-8"),
            timeout=180,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Azure Speech request failed: {exc}") from exc

    if not response.ok:
        detail = response.text[:600] if response.text else response.reason
        raise HTTPException(status_code=response.status_code, detail=f"Azure Speech generation failed: {detail}")
    return Response(content=response.content, media_type="audio/wav")
