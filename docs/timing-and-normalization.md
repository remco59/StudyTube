# Timing and normalization

The renderer should not contain business rules for deciding where scenes start or how long they last. `@studytube/core` converts a validated StudyTube project into deterministic renderer-ready frame ranges.

## Why frame ranges are normalized first

Remotion renders in frames while authoring and TTS naturally work in seconds. Keeping conversion in one place avoids cumulative rounding drift and keeps the renderer simple.

Each normalized scene contains:

- chapter and scene indexes
- global scene index
- `startFrame`
- `endFrameExclusive`
- `durationInFrames`
- measured/estimated narration duration
- final scene duration in seconds

Chapter and project ranges are derived from those scene ranges.

## Duration providers

The core package accepts a `NarrationDurationProvider`:

```ts
type NarrationDurationProvider = (
  scene: StudyTubeScene,
) => number | Promise<number>;
```

For now the default provider estimates speech duration using word count. This makes the renderer usable before TTS integration exists.

Later, the TTS pipeline can generate audio, measure its real duration and pass those measured values through the exact same interface. No renderer or project-format changes are required.

## Padding

A small amount of scene padding is added after narration so visual cuts do not happen on the final spoken syllable. The default is currently 0.35 seconds and can be overridden by the render pipeline.

## Authoring target vs final duration

`metadata.targetDuration` remains an authoring target for ChatGPT. It does not dictate actual frame count. The final video duration is the sum of actual scene durations, which will ultimately come from generated narration audio.
