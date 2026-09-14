# StudyTube

StudyTube is a self-hosted pipeline for turning structured educational video projects into complete 1080p explainer videos without manual timeline editing.

The content and creative direction come from a versioned `.studytube.json` file. StudyTube handles validation, local narration, timing, motion graphics, captions and rendering.

See [`PLAN.md`](./PLAN.md) for the full architecture and stacked implementation roadmap.

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
  tts/          Local TTS provider + narration cache
```

## Docker quick start

StudyTube v1 runs with a local Piper TTS service:

```bash
cp .env.example .env
docker compose up -d --build
```

Then open `http://localhost:3000`.

For Unraid installation, persistent paths, updates and optional Intel `/dev/dri` passthrough, see [`docs/UNRAID.md`](./docs/UNRAID.md).

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

Render a project directly from the CLI once a Piper service is available:

```bash
npm run render:project -- /path/to/project.studytube.json
```

## Persistence

The production container writes jobs, narration cache, logs and MP4 output below `STUDYTUBE_DATA_DIR` (`/data` in Docker). Keep that directory mounted to persistent storage.
