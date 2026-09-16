import html
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from google.api_core.exceptions import Unauthenticated
from google.auth import load_credentials_from_file
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.cloud import texttospeech
from pydantic import BaseModel, Field

app = FastAPI(title="StudyTube Cloud TTS")
_google_client = None
_google_credentials = None
_google_credentials_mtime = None
_google_usage_lock = threading.Lock()
GOOGLE_CLOUD_SCOPE = "https://www.googleapis.com/auth/cloud-platform"
CREDENTIALS_DIR = Path(os.getenv("STUDYTUBE_CREDENTIALS_DIR", "/credentials"))
CLOUD_SETTINGS_PATH = CREDENTIALS_DIR / "cloud.json"
GOOGLE_CHIRP_USAGE_PATH = Path(os.getenv("GOOGLE_CHIRP_USAGE_PATH", "/data/google-chirp-usage.json"))
GOOGLE_CHIRP_MONTHLY_FREE_CHARACTERS = 1_000_000


class CloudSynthesisRequest(BaseModel):
    text: str = Field(min_length=1)
    language: str = "nl-NL"
    voice: str


def google_credentials_path() -> Optional[Path]:
    value = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    return Path(value) if value else None


def google_configured() -> bool:
    path = google_credentials_path()
    return bool(path and path.is_file())


def read_cloud_settings() -> dict:
    try:
        value = json.loads(CLOUD_SETTINGS_PATH.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def azure_values():
    settings = read_cloud_settings()
    key = os.getenv("AZURE_SPEECH_KEY", "").strip() or str(settings.get("azureSpeechKey", "")).strip()
    region = os.getenv("AZURE_SPEECH_REGION", "").strip() or str(settings.get("azureSpeechRegion", "")).strip()
    endpoint = os.getenv("AZURE_SPEECH_ENDPOINT", "").strip() or str(settings.get("azureSpeechEndpoint", "")).strip()
    return key, region, endpoint


def azure_configured() -> bool:
    key, region, _ = azure_values()
    return bool(key and region)


def reset_google_client():
    global _google_client, _google_credentials, _google_credentials_mtime
    _google_client = None
    _google_credentials = None
    _google_credentials_mtime = None


def _google_credentials_file():
    path = google_credentials_path()
    if not path or not path.is_file():
        raise HTTPException(status_code=503, detail="Google Chirp is not configured. Open StudyTube Settings and upload Google credentials.")
    try:
        return path, path.stat().st_mtime_ns
    except OSError as exc:
        raise HTTPException(status_code=503, detail=f"Could not read Google Cloud credentials: {exc}") from exc


def get_google_client(force_refresh: bool = False):
    global _google_client, _google_credentials, _google_credentials_mtime
    path, mtime = _google_credentials_file()
    if _google_client is not None and _google_credentials_mtime == mtime and not force_refresh:
        return _google_client

    try:
        credentials, _ = load_credentials_from_file(str(path), scopes=[GOOGLE_CLOUD_SCOPE])
        if force_refresh:
            credentials.refresh(GoogleAuthRequest())
        _google_client = texttospeech.TextToSpeechClient(credentials=credentials)
        _google_credentials = credentials
        _google_credentials_mtime = mtime
    except Exception as exc:
        reset_google_client()
        action = "refresh" if force_refresh else "initialize"
        raise HTTPException(status_code=503, detail=f"Could not {action} Google Cloud TTS credentials: {type(exc).__name__}: {exc}") from exc
    return _google_client


def is_google_auth_error(exc: Exception) -> bool:
    if isinstance(exc, (Unauthenticated, RefreshError)):
        return True
    message = str(exc).upper()
    return "ACCESS_TOKEN_EXPIRED" in message or "UNAUTHENTICATED" in message


def synthesize_google(client, request: CloudSynthesisRequest):
    return client.synthesize_speech(
        input=texttospeech.SynthesisInput(text=request.text),
        voice=texttospeech.VoiceSelectionParams(language_code=request.language, name=request.voice),
        audio_config=texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.LINEAR16),
    )


def _usage_period(now: Optional[datetime] = None) -> str:
    current = now or datetime.now(timezone.utc)
    return current.strftime("%Y-%m")


def _next_usage_reset(now: Optional[datetime] = None) -> str:
    current = now or datetime.now(timezone.utc)
    year = current.year + (1 if current.month == 12 else 0)
    month = 1 if current.month == 12 else current.month + 1
    return datetime(year, month, 1, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def _read_google_usage_record() -> dict:
    try:
        value = json.loads(GOOGLE_CHIRP_USAGE_PATH.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def _write_google_usage_record(period: str, used_characters: int) -> None:
    GOOGLE_CHIRP_USAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = GOOGLE_CHIRP_USAGE_PATH.with_suffix(f"{GOOGLE_CHIRP_USAGE_PATH.suffix}.tmp")
    temporary.write_text(
        json.dumps({"period": period, "usedCharacters": max(0, int(used_characters))}, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(GOOGLE_CHIRP_USAGE_PATH)


def _google_usage_snapshot_unlocked(now: Optional[datetime] = None) -> dict:
    period = _usage_period(now)
    record = _read_google_usage_record()
    used = int(record.get("usedCharacters", 0)) if record.get("period") == period else 0
    used = max(0, used)
    limit = GOOGLE_CHIRP_MONTHLY_FREE_CHARACTERS
    remaining = max(0, limit - used)
    return {
        "period": period,
        "usedCharacters": used,
        "limitCharacters": limit,
        "remainingCharacters": remaining,
        "percentUsed": min(100.0, (used / limit) * 100 if limit else 100.0),
        "exhausted": remaining <= 0,
        "resetsAt": _next_usage_reset(now),
        "trackingScope": "StudyTube",
    }


def google_usage_snapshot(now: Optional[datetime] = None) -> dict:
    with _google_usage_lock:
        return _google_usage_snapshot_unlocked(now)


def reserve_google_usage(character_count: int) -> str:
    with _google_usage_lock:
        usage = _google_usage_snapshot_unlocked()
        remaining = usage["remainingCharacters"]
        if character_count > remaining:
            if remaining <= 0:
                detail = (
                    f"Google Chirp free monthly allowance is exhausted for {usage['period']} "
                    f"({usage['usedCharacters']:,}/{usage['limitCharacters']:,} characters used). "
                    "Choose another TTS provider or wait for the monthly reset."
                )
            else:
                detail = (
                    f"Google Chirp free monthly allowance would be exceeded: this request needs {character_count:,} characters "
                    f"but only {remaining:,} of {usage['limitCharacters']:,} remain for {usage['period']}. "
                    "Choose another TTS provider or reduce the narration."
                )
            raise HTTPException(status_code=429, detail=detail)
        _write_google_usage_record(usage["period"], usage["usedCharacters"] + character_count)
        return usage["period"]


def release_google_usage(character_count: int, period: str) -> None:
    with _google_usage_lock:
        record = _read_google_usage_record()
        if record.get("period") != period:
            return
        try:
            used = max(0, int(record.get("usedCharacters", 0)) - character_count)
        except (TypeError, ValueError):
            used = 0
        _write_google_usage_record(period, used)


@app.get("/health")
def health():
    return {
        "ok": True,
        "googleConfigured": google_configured(),
        "azureConfigured": azure_configured(),
    }


@app.get("/google/usage")
def google_usage():
    return google_usage_snapshot()


@app.post("/google/synthesize")
def google_synthesize(request: CloudSynthesisRequest):
    character_count = len(request.text)
    reserved_period = reserve_google_usage(character_count)
    succeeded = False
    try:
        try:
            response = synthesize_google(get_google_client(), request)
        except HTTPException:
            raise
        except Exception as exc:
            if not is_google_auth_error(exc):
                raise HTTPException(status_code=502, detail=f"Google Chirp generation failed: {type(exc).__name__}: {exc}") from exc

            # Google access tokens are short-lived. The client normally refreshes them
            # automatically, but if Google rejects a cached token, reload the credential
            # file, force a refresh and retry this synthesis exactly once.
            reset_google_client()
            try:
                response = synthesize_google(get_google_client(force_refresh=True), request)
            except HTTPException:
                raise
            except Exception as retry_exc:
                raise HTTPException(status_code=502, detail=f"Google Chirp generation failed after refreshing credentials: {type(retry_exc).__name__}: {retry_exc}") from retry_exc

        succeeded = True
        return Response(content=response.audio_content, media_type="audio/wav")
    finally:
        if not succeeded:
            release_google_usage(character_count, reserved_period)


@app.post("/azure/synthesize")
def azure_synthesize(request: CloudSynthesisRequest):
    key, region, configured_endpoint = azure_values()
    if not key or not region:
        raise HTTPException(status_code=503, detail="Azure Speech is not configured. Open StudyTube Settings and add Azure Speech credentials.")

    endpoint = configured_endpoint or f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
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
