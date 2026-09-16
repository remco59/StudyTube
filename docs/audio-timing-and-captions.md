# Audio-driven timing and captions

StudyTube no longer needs to guess final scene duration once narration audio exists.

## Preparation flow

`prepareProjectNarration()` synthesizes every scene through the configured `NarrationAudioCache`, reads the real WAV duration and then calls `normalizeStudyTubeProject()` with those measured durations. Scene padding remains configurable and is added after the spoken audio.

This gives the renderer deterministic start/end frames derived from actual narration rather than word-count estimates.

## Captions

The default Edge TTS sidecar captures the `WordBoundary` events emitted while the narration is synthesized. Those word timestamps are embedded in a small custom `sttm` chunk inside the generated WAV file, so timing metadata travels with the cached audio without a separate sidecar file.

StudyTube splits narration into short phrases (eight words by default) and maps those phrases onto the real word boundaries. A caption starts when its first word starts and changes when the next phrase starts. The final caption ends with its final spoken word rather than extending into visual scene padding.

Providers that do not expose word timings, such as the Piper fallback, continue to use the measured narration duration and proportional phrase timing. This keeps captions available even when exact word alignment is unavailable.

## Renderer manifest

The shared `NarrationManifest` contains, per scene:

- a renderer-local `sourcePath`
- measured `durationSeconds`
- phrase caption cues

The TTS preparation step initially knows cache file paths. `toRendererNarrationManifest()` accepts a path mapper so cached WAV files can be copied/staged into a render job and converted to safe renderer-local paths.

## Caption behavior

Captions are optional at composition level. They use a restrained bottom overlay inside the video safe area rather than occupying the center of every frame. This keeps them readable while preserving the educational visual hierarchy.
