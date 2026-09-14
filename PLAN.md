# StudyTube Build Plan

StudyTube turns a structured `.studytube.json` project into a complete educational video without manual editing.

The intended workflow is:

```text
Study material
    ↓
ChatGPT Plus
    ↓
.studytube.json
    ↓
StudyTube on Unraid
    ├─ validate project
    ├─ generate Dutch voice-over
    ├─ resolve assets
    ├─ derive scene timing
    ├─ render Remotion scenes
    ├─ add captions
    └─ encode MP4
    ↓
1080p educational video
```

## Product goals

- Fully automatic from valid `.studytube.json` to final MP4.
- No paid API dependency for rendering.
- Designed for the existing Unraid server: Intel Core i3-14100, 24 GB RAM and Intel UHD 730.
- Visual language inspired by modern educational YouTube explainers: fast pacing, strong visual hierarchy, diagrams, kinetic typography, document highlights, simple visual jokes and recurring examples.
- Consistent visual system rather than AI-generated visuals for every shot.
- Old StudyTube project files should remain renderable as the application evolves.
- Docker-first deployment for Unraid.

## Out of scope for v1

- Local LLM / Ollama.
- Generative video.
- Generative images as a required dependency.
- Blender or complex 3D rendering.
- Full timeline/video editor.
- Accounts, authentication and multi-user collaboration.
- Automatic ChatGPT website integration.

ChatGPT is used manually to produce the structured project JSON. StudyTube starts at that JSON boundary.

---

# Architecture

StudyTube will use a monorepo so the web UI, renderer and project specification can share types without becoming tightly coupled.

```text
studytube/
├─ apps/
│  ├─ web/                 # Next.js web interface and job management
│  └─ renderer/            # Remotion compositions and render worker
├─ packages/
│  ├─ schema/              # Versioned StudyTube schema + validation
│  ├─ design-system/       # Shared tokens and visual primitives
│  └─ core/                # Timing, project normalization and utilities
├─ examples/               # Example .studytube.json projects
├─ docs/                   # Architecture and format documentation
├─ Dockerfile
├─ docker-compose.yml
└─ PLAN.md
```

Primary technologies:

- TypeScript
- React
- Next.js App Router
- Remotion
- Zod for runtime validation
- FFmpeg for media processing/encoding where useful
- Local TTS behind a provider interface, initially targeting Piper-compatible Dutch speech
- Docker / Docker Compose

The renderer must not depend on Next.js internals. The schema/core packages should remain reusable by both applications.

---

# StudyTube project contract

A `.studytube.json` file is the contract between ChatGPT and the renderer.

At a high level it contains:

```json
{
  "version": "1.0",
  "metadata": {
    "title": "Design Science uitgelegd",
    "language": "nl-NL",
    "targetDuration": 900,
    "style": "educational-explainer"
  },
  "chapters": [
    {
      "id": "intro",
      "title": "Waarom Design Science?",
      "scenes": []
    }
  ]
}
```

Scene duration should ultimately be based on generated narration audio rather than trusting duration estimates from ChatGPT.

The schema is explicitly versioned so migrations can be introduced later.

---

# Initial scene library

The first useful version should support a compact but flexible scene set:

1. `title`
2. `chapterIntro`
3. `kineticText`
4. `definition`
5. `bigNumber`
6. `comparison`
7. `timeline`
8. `process`
9. `flowchart`
10. `diagram`
11. `iconScene`
12. `document`
13. `documentHighlight`
14. `image`
15. `question`
16. `visualGag`
17. `recap`

Each scene type can have multiple layouts/variants. This gives visual variation without requiring dozens of independent render systems.

StudyTube owns the exact animation implementation. JSON should describe intent, not arbitrary CSS/React animation code.

---

# Motion system

The renderer will expose a small controlled motion vocabulary, for example:

- `fade`
- `slide`
- `scale`
- `slam`
- `draw`
- `reveal`
- `cameraPush`
- `parallax`
- `counter`

Scenes use shared easing, timing and spacing rules so the finished video feels like one product rather than a collection of templates.

---

# Audio and timing

The intended render pipeline is:

```text
project JSON
    ↓
validate and normalize
    ↓
generate narration audio per scene
    ↓
measure real audio duration
    ↓
derive scene/frame timings
    ↓
generate captions
    ↓
render Remotion composition
    ↓
encode final video
```

This means ChatGPT does not need to predict exact speech duration.

TTS is behind an interface so the initial local engine can later be replaced without changing project files or scene components.

---

# Captions

Captions are derived from the known narration text rather than requiring speech-to-text.

V1 can use sentence/phrase timing derived from scene narration. Later versions may add word-level alignment.

Captions should support the explainer rather than dominate every frame.

---

# Assets

V1 prioritizes deterministic and inexpensive visuals:

- SVG icons
- geometric shapes
- diagrams
- text
- charts
- user-provided images
- images extracted/provided from source documents
- screenshots and document pages

External/free asset lookup can be added later. Generative image/video services must not be required for the core pipeline.

---

# Web UI

The first web interface should focus on the rendering workflow rather than editing.

Core flow:

```text
Drop .studytube.json
        ↓
Validate
        ↓
Show project summary
        ↓
Preview
        ↓
Generate video
        ↓
Progress/status
        ↓
Download MP4
```

Expected summary information:

- title
- language
- chapter count
- scene count
- estimated/final duration
- validation errors

A full timeline editor is deliberately postponed.

---

# Unraid deployment

Target deployment directory can be:

```text
/mnt/user/appdata/studytube
```

Persistent storage should contain project jobs, generated audio, cached assets, logs and final renders.

The container should be able to receive `/dev/dri` so Intel Quick Sync can be evaluated for FFmpeg encoding on the UHD 730.

Example future mapping:

```yaml
devices:
  - /dev/dri:/dev/dri
```

CPU rendering must still work when Quick Sync is unavailable.

---

# Build strategy: stacked pull requests

Every implementation step gets its own commit/branch/PR. Each new branch is based on the previous step rather than directly on `main` until earlier PRs are merged.

This keeps changes reviewable while allowing continuous development.

## PR 1 — Repository foundation

Goal: establish the runnable monorepo and development standards.

Deliverables:

- npm workspaces
- TypeScript configuration
- Next.js web app skeleton
- Remotion renderer skeleton
- shared package structure
- lint/typecheck/build scripts
- `.gitignore`
- basic README

Acceptance criteria:

- dependencies install cleanly
- web app starts
- renderer has a valid Remotion entry point
- workspace typecheck succeeds

## PR 2 — Versioned StudyTube schema

Goal: define the durable contract between ChatGPT and StudyTube.

Deliverables:

- Zod schema
- TypeScript types
- version field
- metadata/chapter/scene structures
- supported scene discriminated union
- validation API
- sample `.studytube.json`
- validation tests

Acceptance criteria:

- valid sample passes
- malformed/unsupported projects fail with useful errors
- scene types are strongly typed

## PR 3 — Core timing and normalization

Goal: transform raw project JSON into renderer-ready data.

Deliverables:

- project normalization
- scene ordering
- FPS/frame helpers
- duration model
- placeholder narration-duration provider
- chapter/project frame calculations
- tests

Acceptance criteria:

- normalized project has deterministic start/end frames
- renderer never has to calculate business rules itself

## PR 4 — Design system and Remotion composition shell

Goal: establish a coherent visual foundation.

Deliverables:

- typography
- color tokens
- spacing/radius/shadow tokens
- safe areas
- base scene frame
- chapter/video composition
- transition primitives
- animation helpers

Acceptance criteria:

- sample project renders through one composition
- visual primitives are shared across scene implementations

## PR 5 — First scene set

Goal: make a short real explainer visually useful.

Initial implementations:

- title
- chapterIntro
- kineticText
- definition
- bigNumber
- comparison
- question
- recap

Acceptance criteria:

- sample project demonstrates every implemented scene
- scenes animate in/out consistently
- renderer fails clearly for unsupported scene data

## PR 6 — Diagram and structured-information scenes

Implement:

- timeline
- process
- flowchart
- diagram
- iconScene

Acceptance criteria:

- layouts handle realistic variation in item count/text length
- content remains inside video safe areas

## PR 7 — Media/document scenes

Implement:

- image
- document
- documentHighlight
- asset resolver
- local asset references
- visualGag primitive/presets

Acceptance criteria:

- project-local images/documents can be resolved safely
- missing assets result in clear validation/render errors

## PR 8 — TTS provider architecture

Goal: generate narration locally and cache it.

Deliverables:

- TTS provider interface
- local provider integration
- Dutch voice configuration
- narration audio cache
- audio metadata/duration measurement
- fallback/test provider

Acceptance criteria:

- a scene narration can generate an audio file
- repeated renders can reuse cached audio
- real audio duration is available to timing code

## PR 9 — Audio-driven timing and captions

Goal: make final timing follow real narration.

Deliverables:

- recalculate frames from actual audio
- narration placement
- phrase captions
- caption styling
- configurable scene padding

Acceptance criteria:

- narration and scene boundaries stay synchronized
- project length derives from generated audio

## PR 10 — Automated render pipeline

Goal: one command turns a project into an MP4.

Deliverables:

- job directory convention
- validate → TTS → normalize → render pipeline
- render CLI/service
- progress states
- output naming
- structured errors/logging

Acceptance criteria:

- a valid project produces an MP4 without editing
- failed jobs preserve useful logs

## PR 11 — StudyTube web workflow

Goal: expose the pipeline through a simple browser interface.

Deliverables:

- JSON upload/dropzone
- validation results
- project summary
- render button
- job progress
- completed download
- basic Remotion preview where practical

Acceptance criteria:

- normal usage needs no terminal access

## PR 12 — Docker and Unraid deployment

Goal: run StudyTube reliably on Tower.

Deliverables:

- production Dockerfile
- Docker Compose file
- persistent volume mapping
- healthcheck
- `/dev/dri` optional device mapping
- environment documentation
- Unraid install/update instructions

Acceptance criteria:

- clean Docker build
- persistent jobs/renders survive container replacement
- CPU fallback works without `/dev/dri`

## PR 13 — Quality pass and 15-minute reference project

Goal: prove the MVP against the actual use case.

Deliverables:

- a longer reference `.studytube.json`
- layout edge-case fixes
- render performance improvements
- consistency pass
- render documentation
- ChatGPT authoring prompt/specification

Acceptance criteria:

- StudyTube can turn a representative educational project into a complete 1080p video without manual timeline editing
- authoring instructions are sufficient for ChatGPT to reliably output valid project JSON

---

# Later milestones

After the MVP is stable, possible additions include:

- automatic Wikimedia Commons asset retrieval
- map scenes
- animated charts
- reusable characters
- recurring/running visual gags
- richer document parsing/highlighting
- music/sound-effect system
- word-level caption alignment
- better local TTS engines
- multiple themes
- project migration tooling
- optional simple editor for fixing a single scene
- automated source/citation cards
- simple Blender-generated spatial scenes

These should not block the first usable release.

---

# Definition of MVP success

StudyTube v1 is successful when the following workflow works reliably:

1. Study material is uploaded to ChatGPT.
2. ChatGPT outputs a valid `.studytube.json` using the StudyTube authoring specification.
3. The JSON is uploaded to StudyTube.
4. StudyTube validates it.
5. StudyTube generates Dutch narration locally.
6. Scene timing is derived from the actual narration.
7. Visual scenes and captions are generated automatically.
8. Remotion renders the composition.
9. StudyTube produces a downloadable 1080p MP4.
10. No manual video editing or paid generation API is required.

The first quality target is a fast, visually varied educational explainer rather than custom 3D documentary production. Once the deterministic renderer is strong, every new scene component improves all future videos at once.
