# Rendering and quality guide

## End-to-end flow

```text
study material
  ↓
ChatGPT + AUTHORING.md
  ↓
.studytube.json + optional local assets
  ↓
StudyTube web UI or render CLI
  ↓
validate → Piper narration → measure WAV → normalize timing/captions
  ↓
stage assets/audio → Remotion bundle → H.264 render
  ↓
1080p MP4
```

The browser and CLI use the same worker. The browser is only a thin upload/status layer; it does not reinterpret or edit scenes.

## Browser workflow

1. Open StudyTube.
2. Select a `.studytube.json` project.
3. Add any referenced image/document files shown in the Assets panel.
4. Press **Generate video**.
5. Follow persisted job progress.
6. Download the MP4 when complete.

## CLI workflow

With Piper available through `PIPER_URL`:

```bash
npm run render:project -- examples/design-science-15min.studytube.json
```

Typical local environment:

```bash
export STUDYTUBE_DATA_DIR=./data
export STUDYTUBE_RENDERER_ENTRY="$PWD/apps/renderer/src/index.ts"
export PIPER_URL=http://127.0.0.1:5000
export PIPER_VOICE=nl_NL-mls-medium
export PIPER_LENGTH_SCALE=1
```

## Job output

Every render keeps an isolated job directory:

```text
<STUDYTUBE_DATA_DIR>/jobs/<job-id>/
  project.studytube.json
  status.json
  logs.ndjson
  render-props.json
  public/
  output/*.mp4
```

Narration is cached separately in `<STUDYTUBE_DATA_DIR>/cache/tts/`. The cache key includes provider and synthesis request, so unchanged narration can be reused.

## Reference project

`examples/design-science-15min.studytube.json` is a long-form Dutch Design Science explainer used to exercise the complete v1 contract. It includes every scene type, chapter transitions, recaps, real local image/document assets and enough narration to target roughly fifteen minutes. Actual duration comes from the selected Piper voice rather than the metadata estimate.

Keep these assets next to the project:

```text
examples/assets/design-science-cycle.svg
examples/assets/reference-notes.txt
```

## Quality checklist

Before calling a project render-ready:

- validate the JSON;
- check narration word count against the requested duration;
- verify every referenced media asset exists;
- keep visible copy much shorter than narration;
- avoid several dense information scenes in a row;
- use chapter recaps for retention;
- never invent numeric claims just to use `bigNumber`;
- keep visual gags occasional;
- keep labels comfortably inside schema limits;
- preserve failures through the job logs rather than hiding them.

## Duration

`metadata.targetDuration` is an editorial target. Scene timing is never forced to match it. StudyTube synthesizes narration first, measures the real WAV duration, adds configured scene padding and derives the Remotion frame timeline from that result.

If a video is too long or short, change the script or `PIPER_LENGTH_SCALE`; do not hard-code scene durations.

## Layout safety

Every scene is rendered inside the shared 1080p safe area and the scene frame clips overflow. Semantic JSON contains no pixel coordinates, so renderer layout improvements do not require project migrations.

For long labels, shorten visible copy and keep the explanation in narration instead of shrinking text until it becomes unreadable.

## Performance

The v1 renderer favors reliability over aggressive optimization:

- CPU rendering is the supported baseline;
- the optional Unraid `/dev/dri` override exposes Intel graphics but v1 does not depend on Quick Sync;
- Remotion controls frame-render concurrency;
- one long render at a time is recommended on the target i3-14100 / 24 GB server;
- narration caching avoids repeated TTS work;
- the Remotion bundle is currently produced per job because staged public assets are job-specific.

Future performance work can benchmark reusable bundles and Intel-assisted final encoding without changing the `.studytube.json` contract.

## Troubleshooting

### A referenced asset is missing

Keep paths relative to the JSON file and provide/upload every required asset. The worker rejects unsafe traversal and preserves a failed job log.

### Narration is too fast or slow

Adjust `PIPER_LENGTH_SCALE`. The scene timeline automatically follows the new measured audio duration.

### A render fails late

Inspect `status.json` and `logs.ndjson`. Failed jobs intentionally remain on disk so the failure is reproducible.

### The video is not exactly fifteen minutes

That is expected. The reference target is approximate; real voice cadence controls final duration.
