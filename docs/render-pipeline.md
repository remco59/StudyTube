# Automated render pipeline

PR 10 introduces the first end-to-end StudyTube worker. A valid `.studytube.json` can now move through validation, local narration generation, measured timing, asset staging and Remotion rendering without manual editing.

## One-command workflow

From the repository root:

```bash
npm run render:project -- /path/to/project.studytube.json
```

For CI/development without Piper:

```bash
npm run render:project -- /path/to/project.studytube.json --synthetic
```

The normal path uses the local Piper provider configured by `PIPER_URL`, `PIPER_VOICE` and `PIPER_LENGTH_SCALE`.

## Data directory

`STUDYTUBE_DATA_DIR` controls persistent worker storage and defaults to `./data`.

Each render gets an isolated directory:

```text
data/
├─ cache/
│  └─ tts/
└─ jobs/
   └─ <job-id>/
      ├─ project.studytube.json
      ├─ status.json
      ├─ logs.ndjson
      ├─ render-props.json
      ├─ public/
      │  ├─ audio/
      │  └─ <project assets>
      └─ output/
         └─ <title>-<job-id>.mp4
```

## Job states

The worker persists `queued`, `validating`, `synthesizing`, `staging`, `bundling`, `rendering`, `completed` or `failed` with progress between 0 and 1. Errors are written both to `status.json` and append-only NDJSON logs before the exception is returned to the caller.

## Asset staging

Asset paths are resolved relative to the directory containing the uploaded project file and copied into the job's Remotion public directory. Relative-path safety is checked before filesystem access. Narration WAV files are copied from the shared TTS cache into `public/audio` and the renderer receives only project-local URLs.

## Rendering

The worker uses `@remotion/bundler` and `@remotion/renderer` programmatically. It bundles the StudyTube renderer with the job-specific public directory, resolves the `StudyTube` composition using the normalized input props, then renders H.264 to the job output directory.

The render function is dependency-injected in tests, so CI validates the complete job lifecycle without launching Chromium or rendering a real video. The production path uses the real Remotion server-side renderer.
