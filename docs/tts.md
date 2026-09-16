# Narration / TTS architecture

StudyTube generates narration before Remotion renders the video. TTS therefore lives in the Node-side `@studytube/tts` package rather than inside React/Remotion components.

## Providers

`TtsProvider` exposes one operation: synthesize text to a WAV file.

The default production provider is `EdgeTtsHttpProvider`. It talks to the lightweight `studytube-neural-tts` sidecar, which uses `edge-tts` for Microsoft neural voices and converts the result to a 24 kHz mono WAV for the existing timing pipeline. The default Dutch voice is `nl-NL-MaartenNeural`.

`PiperHttpProvider` remains available as the fully local/offline fallback. It uses the existing Piper HTTP service and Dutch `nl_NL-mls-medium` model unless configured otherwise.

For CI and tests, `SyntheticWavProvider` creates deterministic silent PCM WAV files. It never needs network access or a downloaded model.

## Provider selection

Set `STUDYTUBE_TTS_PROVIDER` to one of:

- `edge` (default): higher-quality neural speech; internet connection required while synthesizing
- `piper`: local/offline speech; start Docker Compose with `--profile offline-tts`
- `synthetic`: test-only silent WAV generation

Neural TTS configuration:

- `EDGE_TTS_URL` (Docker default `http://neural-tts:5050`)
- `EDGE_TTS_VOICE` (default `nl-NL-MaartenNeural`)
- `EDGE_TTS_RATE` (default `+0%`)

Piper fallback configuration:

- `PIPER_URL` (default `http://piper:5000`)
- `PIPER_VOICE` (default in Docker `nl_NL-mls-medium`)
- `PIPER_LENGTH_SCALE` (optional speech-speed control)

For `en-US` projects the neural provider automatically uses `en-US-GuyNeural` unless a voice is explicitly supplied.

## Narration cache

`NarrationAudioCache` hashes the provider ID plus synthesis request. The neural provider ID includes its configured voice and rate, so changing voice settings cannot accidentally reuse audio from the previous voice. Repeating identical narration with the same provider settings reuses the existing WAV.

New synthesis is written to a temporary file first, validated as WAV, and atomically renamed into the cache. The cache returns real audio metadata including duration, sample rate, channel count and bit depth. The measured duration is then used for deterministic scene timing and captions.

## Deployment

The normal Docker stack runs `studytube` plus `studytube-neural-tts`. The neural sidecar is local, but the speech generation itself uses an online Microsoft voice endpoint through `edge-tts`; no API key is configured by StudyTube.

If internet-independent narration matters more than voice quality, set `STUDYTUBE_TTS_PROVIDER=piper` and start the optional Piper profile:

```bash
docker compose --profile offline-tts up -d --build
```

The rest of the render pipeline is identical because both providers return validated WAV files.
