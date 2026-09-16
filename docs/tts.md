# Narration / TTS architecture

StudyTube synthesizes narration before Remotion renders the video. TTS therefore lives behind the Node-side `@studytube/tts` provider interface and every provider returns validated WAV audio to the same timing/caption pipeline.

## Available engines

The Create → Render screen selects TTS per render. Edge TTS, Piper and Google Chirp 3 HD are part of the standard Docker stack. Large local engines are optional Docker Compose profiles so normal StudyTube updates do not rebuild several heavy PyTorch images unnecessarily.

- `edge` (default): Microsoft neural voices through `edge-tts`. Fast and lightweight; internet required, no API key configured by StudyTube.
- `google-chirp`: Google Cloud Chirp 3 HD. Cloud credentials and enabled billing/project are required. Default Dutch voice: `nl-NL-Chirp3-HD-Charon`.
- `piper`: lightweight fully local/offline speech. Default Dutch model: `nl_NL-mls-medium`.
- `azure`: optional Azure Speech provider. Requires `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`. It shares the lightweight cloud proxy used by Google Chirp.
- `omnivoice`: optional local multilingual OmniVoice with voice design and reference-audio cloning.
- `chatterbox`: optional local Chatterbox Multilingual with Dutch support and zero-shot voice cloning. V2 is the default; V3 remains selectable.
- `xtts`: optional local XTTS v2 with Dutch support, built-in speakers and reference-audio cloning. The model uses the Coqui Public Model License and synthesis stays disabled until the user explicitly sets `COQUI_TOS_AGREED=1` after accepting that license.
- `synthetic`: deterministic silent WAV generation for CI/tests only; it is not exposed as a normal production option.

Every user-facing engine has a settings button in the render UI. The selected provider is stored in the job status. Provider settings are job-specific, and provider/settings identity is included in narration caching so incompatible audio is not reused.

## Normal Docker startup

The normal stack needs no profiles:

```bash
docker compose up -d --build
```

This starts StudyTube plus Edge TTS, Piper and the lightweight cloud TTS proxy used by Google Chirp 3 HD. The cloud proxy starts successfully even when Google credentials are not configured; Google Chirp only returns a configuration error when it is selected without credentials.

OmniVoice, Chatterbox and XTTS are excluded from the normal build/start path.

## Optional local engines

Start one optional engine by enabling its profile:

```bash
docker compose --profile omnivoice up -d --build
docker compose --profile chatterbox up -d --build
docker compose --profile xtts up -d --build
```

To enable all optional local engines at once:

```bash
docker compose --profile optional up -d --build
```

Once an optional container has been built, later starts can omit `--build` unless its Dockerfile or dependencies changed.

## Edge TTS

Environment defaults:

- `EDGE_TTS_VOICE=nl-NL-MaartenNeural`
- `EDGE_TTS_RATE=+0%`

The UI can override voice and rate per job.

## Google Chirp 3 HD

Put Google Application Default Credentials/service-account JSON at:

```text
${STUDYTUBE_CREDENTIALS_PATH}/google.json
```

The Compose service maps it to `/credentials/google.json` and sets `GOOGLE_APPLICATION_CREDENTIALS` for the cloud sidecar. Google Cloud Text-to-Speech must be enabled in the associated project and billing must be enabled even if usage stays inside Google's free usage allowance.

Default voice:

```text
nl-NL-Chirp3-HD-Charon
```

The selected voice can be changed in the render settings.

## Azure Speech

Configure:

- `AZURE_SPEECH_KEY`
- `AZURE_SPEECH_REGION`
- optionally `AZURE_SPEECH_ENDPOINT`
- `AZURE_TTS_VOICE` (default `nl-NL-MaartenNeural`)

Azure is an optional provider in the UI but shares the standard lightweight cloud proxy with Google Chirp, so it does not add another Docker image to the normal build. Azure synthesis uses 24 kHz, 16-bit mono PCM WAV output so it can enter the same StudyTube narration pipeline directly.

## Piper

Environment defaults:

- `PIPER_VOICE=nl_NL-mls-medium`
- `PIPER_LENGTH_SCALE=1`

Lower length scale speaks faster; higher values speak slower.

## OmniVoice

Environment defaults:

- `OMNIVOICE_DEVICE=cpu`
- `OMNIVOICE_MODEL=k2-fsa/OmniVoice`
- `OMNIVOICE_SPEED=1`
- `OMNIVOICE_NUM_STEPS=16`
- `OMNIVOICE_NORMALIZE_TEXT=true`

Reference audio switches the provider to voice cloning. Supplying a transcript avoids loading OmniVoice's ASR model for that reference clip.

## Chatterbox Multilingual

Environment defaults:

- `CHATTERBOX_DEVICE=cpu`
- `CHATTERBOX_T3_MODEL=v2`
- `CHATTERBOX_EXAGGERATION=0.5`
- `CHATTERBOX_CFG_WEIGHT=0.5`
- `CHATTERBOX_TEMPERATURE=0.8`

V2 and V3 are selectable per job. A user-uploaded reference clip enables voice cloning; without one the sidecar uses a Dutch reference voice for Dutch projects. Long StudyTube scenes are chunked before synthesis and joined back into one WAV.

## XTTS v2

Environment defaults:

- `XTTS_DEVICE=cpu`
- `XTTS_MODEL=tts_models/multilingual/multi-dataset/xtts_v2`
- `XTTS_SPEAKER=Ana Florence`
- `XTTS_SPEED=1`
- `COQUI_TOS_AGREED=0`

The container can run with `COQUI_TOS_AGREED=0`, but synthesis is blocked. StudyTube deliberately does not set this to `1` automatically because doing so represents explicit acceptance of Coqui's model license. A reference audio upload replaces the built-in speaker with voice cloning.

## Persistent paths

For Unraid, `.env` can keep the TTS data on appdata/cache-backed storage:

```text
PIPER_DATA_PATH=/mnt/user/appdata/studytube/piper
OMNIVOICE_DATA_PATH=/mnt/user/appdata/studytube/omnivoice
CHATTERBOX_DATA_PATH=/mnt/user/appdata/studytube/chatterbox
XTTS_DATA_PATH=/mnt/user/appdata/studytube/xtts
STUDYTUBE_CREDENTIALS_PATH=/mnt/user/appdata/studytube/credentials
```

The credentials directory and local model-data directories are ignored by Git so cloud keys/model caches cannot accidentally be committed through the normal project workflow.
