# Audio-driven timing and captions

StudyTube no longer needs to guess final scene duration once narration audio exists.

## Preparation flow

`prepareProjectNarration()` synthesizes every scene through the configured `NarrationAudioCache`, reads the real WAV duration and then calls `normalizeStudyTubeProject()` with those measured durations. Scene padding remains configurable and is added after the spoken audio.

This gives the renderer deterministic start/end frames derived from actual narration rather than word-count estimates.

## Captions

Narration is split into short phrases (eight words by default). Phrase timing is distributed across the measured narration duration according to word count, producing scene-local frame cues. The last cue ends exactly at the narration boundary, before any visual scene padding.

The Remotion composition looks up the narration track for each scene and places both the audio and caption overlay inside that scene's `Sequence`. Because Remotion sequence time is local, caption cues start at frame zero for every scene and do not need global timeline offsets.

## Renderer manifest

The shared `NarrationManifest` contains, per scene:

- a renderer-local `sourcePath`
- measured `durationSeconds`
- phrase caption cues

The TTS preparation step initially knows cache file paths. `toRendererNarrationManifest()` accepts a path mapper so PR 10 can copy/stage cached WAV files into a render job and convert them to safe renderer-local paths.

## Caption behavior

Captions are optional at composition level. They use a restrained bottom overlay inside the video safe area rather than occupying the center of every frame. This keeps them readable while preserving the educational visual hierarchy.
