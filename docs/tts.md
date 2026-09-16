# Narration / TTS architecture

StudyTube generates narration before Remotion renders the video. TTS therefore lives in the Node-side `@studytube/tts` package rather than inside React/Remotion components.

## Providers

`TtsProvider` exposes one operation: synthesize text to a WAV file.

The default production provider is `EdgeTtsHttpProvider`. It talks to the lightweight `studytube-neural-tts` sidecar, which uses `edge-tts` for Microsoft neural voices and converts the result to a 24 kHz mono WAV for the existing timing pipeline. The default Dutch voice is `nl-NL-MaartenNeural`.

`PiperHttpProvider` is the lightweight fully local/offline fallback. It uses the existing Piper HTTP service and Dutch `nl_NL-mls-medium` model unless configured otherwise.

`OmniVoiceHttpProvider` is an experimental local multilingual option. It talks to an optional Python sidecar running `k2-fsa/OmniVoice`. StudyTube supports auto/voice-design generation as well as voice cloning from a reference audio upload. The sidecar serializes synthesis to one request at a time because local CPU inference is resource intensive.

For CI and tests, `SyntheticWavProvider` creates deterministic silent PCM WAV files. It never needs network access or a downloaded model.

## Provider selection

The Create → Render screen selects the TTS provider per job. Changing the TTS for one render does not change the server default or another queued render. The available user-facing choices are:

- `edge` (default): Microsoft neural speech; fast and good quality, internet required while synthesizing
- `piper`: lightweight local/offline speech; start Docker Compose with `--profile offline-tts`
- `omnivoice`: experimental local multilingual TTS with voice design and cloning; start Docker Compose with `--profile omnivoice`

Each provider has a settings button in the render UI. The job API stores the selected provider in `status.json`; provider-specific settings are passed only to the synthesis pipeline.

`STUDYTUBE_TTS_PROVIDER` still defines the default for CLI/server jobs that do not explicitly choose a provider. `synthetic` remains available only for development/test rendering.

### Edge TTS settings

- `EDGE_TTS_URL` (Docker default `http://neural-tts:5050`)
- `EDGE_TTS_VOICE` (default `nl-NL-MaartenNeural`)
- `EDGE_TTS_RATE` (default `+0%`)

The render UI can override voice and rate for one job. For `en-US` projects the provider can use `en-US-GuyNeural` when no explicit voice is supplied.

### Piper settings

- `PIPER_URL` (default `http://piper:5000`)
- `PIPER_VOICE` (default in Docker `nl_NL-mls-medium`)
- `PIPER_LENGTH_SCALE` (default `1`; lower speaks faster, higher speaks slower)

### OmniVoice settings

- `OMNIVOICE_URL` (Docker default `http://omnivoice:5060`)
- `OMNIVOICE_MODEL` (default `k2-fsa/OmniVoice`)
- `OMNIVOICE_DEVICE` (default `cpu`)
- `OMNIVOICE_SPEED` (default `1`)
- `OMNIVOICE_NUM_STEPS` (default `16`; 32 favors quality over speed)
- `OMNIVOICE_NORMALIZE_TEXT` (default `true`)

The UI also supports an optional voice-design instruction and a reference audio file. When reference audio is supplied, voice cloning takes priority over voice design. A transcript is optional; supplying one avoids needing ASR for the reference clip.

## Narration cache

`NarrationAudioCache` hashes the provider ID plus synthesis request. Edge includes its configured voice/rate in the provider ID. OmniVoice includes its generation settings and reference-audio path signature. Piper passes voice and length scale in the synthesis request. This prevents a render from reusing cached narration created with incompatible voice settings.

New synthesis is written to a temporary file first, validated as WAV, and atomically renamed into the cache. The cache returns real audio metadata including duration, sample rate, channel count and bit depth. The measured duration is then used for deterministic scene timing and captions.

## Deployment

The normal Docker stack runs `studytube` plus `studytube-neural-tts`. The neural sidecar is local, but Edge speech generation itself uses an online Microsoft voice endpoint through `edge-tts`; no API key is configured by StudyTube.

Start Piper when you want the offline fallback:

```bash
docker compose --profile offline-tts up -d --build
```

Start OmniVoice when you want to experiment with the larger local model:

```bash
docker compose --profile omnivoice up -d --build
```

Both optional profiles can be enabled together:

```bash
docker compose --profile offline-tts --profile omnivoice up -d --build
```

The first OmniVoice synthesis can take considerably longer because the model must be downloaded and loaded. Model files are retained under `OMNIVOICE_DATA_PATH`.
