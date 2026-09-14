# StudyTube

StudyTube is a self-hosted pipeline for turning structured educational video projects into complete 1080p explainer videos without manual timeline editing.

The content and creative direction come from a versioned `.studytube.json` file. StudyTube handles validation, narration, timing, motion graphics, captions and rendering.

See [`PLAN.md`](./PLAN.md) for the full architecture and stacked implementation roadmap.

## Repository structure

```text
apps/
  web/          Next.js interface
  renderer/     Remotion renderer
packages/
  schema/       Versioned StudyTube project contract
  core/         Timing and project normalization
  design-system Shared visual tokens and primitives
```

## Requirements

- Node.js 24+
- npm

## Install

```bash
npm install
```

## Development

Start the web interface:

```bash
npm run dev:web
```

Start Remotion Studio:

```bash
npm run dev:renderer
```

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```

## Current status

StudyTube is being built in stacked pull requests. The first milestone establishes the repository foundation; later PRs add the versioned project schema, renderer scene system, local TTS, automatic timing, web workflow and Unraid deployment.
