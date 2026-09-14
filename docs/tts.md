# Local TTS architecture

StudyTube generates narration before Remotion renders the video. TTS therefore lives in the Node-side `@studytube/tts` package rather than inside React/Remotion components.

## Providers

`TtsProvider` exposes one operation: synthesize text to a WAV file. The first real provider is `PiperHttpProvider`, which targets Piper's local `/synthesize` HTTP endpoint. Piper's own documentation recommends the HTTP server for repeated synthesis because reloading a voice model for every CLI invocation is slower.

For CI and tests, `SyntheticWavProvider` creates deterministic silent PCM WAV files using the same text-to-duration estimate. It never needs network access or a downloaded model.

## Dutch configuration

StudyTube defaults to language `nl-NL` and expects the Piper service to be started with a Dutch voice. Configuration is read from:

- `PIPER_URL` (default `http://piper:5000`)
- `PIPER_VOICE` (optional; if omitted Piper's server default voice is used)
- `PIPER_LENGTH_SCALE` (optional speech-speed control)

Keeping the exact voice model configurable avoids coupling `.studytube.json` files to one particular voice package.

## Narration cache

`NarrationAudioCache` hashes the provider ID plus synthesis request. Repeating identical narration reuses the existing WAV. New synthesis is written to a temporary file first, validated as WAV, and atomically renamed into the cache.

The cache returns real audio metadata including duration, sample rate, channel count and bit depth. PR 9 uses that measured duration to replace estimated scene timing.

## WAV validation

StudyTube parses RIFF/WAVE chunks itself. For Piper's WAV output this avoids adding FFprobe as a dependency merely to determine narration duration. FFmpeg remains useful later for final media processing.

## Deployment direction

On Unraid, Piper can run as a sidecar/container on the internal Docker network. StudyTube talks to it over HTTP; no paid API or internet connection is required during synthesis once the selected voice files are present locally.
