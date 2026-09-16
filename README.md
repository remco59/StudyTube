# StudyTube

StudyTube is a self-hosted pipeline for turning structured educational video projects into complete 1080p explainer videos without manual timeline editing.

The content and creative direction come from a versioned `.studytube.json` file. StudyTube handles validation, narration, timing, motion graphics, captions and rendering.

See [`PLAN.md`](./PLAN.md) for the full architecture and implementation roadmap.

## Repository structure

```text
apps/
  web/          Next.js interface + job API
  renderer/     Remotion compositions
  worker/       Automated JSON → MP4 pipeline
packages/
  schema/       Versioned StudyTube project contract
  core/         Timing, captions and project normalization
  design-system Shared visual tokens and primitives
  tts/          TTS providers + narration cache
examples/       Reference StudyTube project and local assets
```

## Create a study video

1. Give ChatGPT your study material and ask it to create a StudyTube v1 project using [`docs/AUTHORING.md`](./docs/AUTHORING.md).
2. Save the returned JSON as a `.studytube.json` file.
3. Open StudyTube and select the project file.
4. Add any local image or document assets referenced by the project.
5. Choose the render engine in the Render step and press **Generate video**.
6. Follow or manage the render from the **Jobs** tab and download the completed MP4.

StudyTube always supports CPU rendering. When the corresponding hardware is exposed to the container, the web interface also offers Intel VAAPI and NVIDIA NVENC as per-job render engines.

The substantial reference project is [`examples/design-science-15min.studytube.json`](./examples/design-science-15min.studytube.json). It targets roughly fifteen minutes, uses all v1 scene types and ships with its required local example assets.

For pacing, quality checks and rendering behavior, see [`docs/QUALITY.md`](./docs/QUALITY.md).

## Docker quick start

StudyTube defaults to a Dutch Microsoft neural voice through the lightweight `studytube-neural-tts` sidecar. Narration synthesis therefore needs internet access, but StudyTube does not require a speech API key. Piper remains available as an offline fallback.

```bash
cp .env.example .env
docker compose up -d --build
```

Then open `http://localhost:3000`.

For Unraid installation, persistent paths, updates, offline TTS and optional Intel/NVIDIA GPU passthrough, see [`docs/UNRAID.md`](./docs/UNRAID.md).

## Local development

Requirements:

- Node.js 24+
- npm

Install dependencies:

```bash
npm install
```

Start the web interface:

```bash
npm run dev:web
```

Start Remotion Studio:

```bash
npm run dev:renderer
```

Run the complete project checks:

```bash
npm run check
```

Render a project directly from the CLI while the configured TTS service is available:

```bash
npm run render:project -- examples/design-science-15min.studytube.json
```

Use `--piper` for the offline Piper provider or `--synthetic` for test audio.

## Persistence

The production container writes jobs, narration cache, logs and MP4 output below `STUDYTUBE_DATA_DIR` (`/data` in Docker). Keep that directory mounted to persistent storage.
