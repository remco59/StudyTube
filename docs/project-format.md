# StudyTube project format v1.0

A `.studytube.json` file is the durable contract between the authoring step (currently ChatGPT) and the StudyTube render pipeline.

The runtime contract lives in `@studytube/schema`. Files that do not validate must not enter the render pipeline.

## Top-level structure

```json
{
  "version": "1.0",
  "metadata": {},
  "assets": {},
  "chapters": []
}
```

### `version`

Currently exactly `1.0`. The v1 runtime schema intentionally remains strict: a project with another version must not be interpreted as v1 by accident.

Migration infrastructure lives in `@studytube/schema/migrations`. Before a new project-format version becomes current, add a parser for that version plus an explicit `StudyTubeProjectMigration` step from every still-supported predecessor. `upgradeStudyTubeProject` dispatches to the parser registered for the source version, applies migration steps in order, and validates every intermediate version with its own registered parser. Missing migration paths, cycles, unsupported versions, and migration steps that return the wrong version fail explicitly.

A future v2 therefore must not be introduced by merely changing the v1 `z.literal`. Keep the v1 parser available, add the v2 parser, register the v1 → v2 migration, and add a fixture test proving an existing v1 project upgrades without losing its data. This keeps format changes explicit rather than silently changing v1 semantics.

### `metadata`

Required fields:

- `title`
- `language`, for example `nl-NL`
- `targetDuration` in seconds
- `style`, a design-system style preset: `educational-explainer` (default) or `midnight-focus`. Both presets share the same layout, typography and motion; only the color palette changes. See `packages/design-system`'s `colorPresets`.

`targetDuration` is an authoring target. Final duration will later be calculated from generated narration audio.

### `assets`

Optional dictionary keyed by stable asset ID. V1 supports five asset types:

- `image`: packaged image with required project-relative `path`; optional `alt` and stock-source metadata.
- `video`: packaged video with required project-relative `path`; optional `alt` and stock-source metadata.
- `document`: packaged document with required project-relative `path`; optional `title`.
- `stockImage`: resolver request with required `query`, optional `provider` (`auto`, `pixabay`, `pexels`, `unsplash`) and optional `alt`. `path` is `""` until import resolves the request.
- `stockVideo`: resolver request with required `query`, optional `provider` (`auto`, `pixabay`, `pexels`) and optional `alt`. `path` is `""` until import resolves the request.

Packaged asset paths must never be remote URLs. A resolved packaged image/video may carry `source` metadata with provider, provider ID, source URL, creator and attribution fields, but those values describe provenance rather than replacing the local `path`.

### `chapters`

One or more ordered chapters. Chapter IDs must be unique. Scene IDs must be unique across the entire project.

## Common scene fields

Every scene contains:

- `id`: stable unique identifier
- `type`: supported scene type
- `narration`: text spoken during the scene
- `visual`: data used by that scene renderer
- `motion`: optional motion intent
- `sources`: optional source references

The JSON describes visual intent. It does not contain CSS, React code, keyframes or arbitrary animation instructions.

## Supported scene types

v1.0 reserves these scene types:

- `title`
- `chapterIntro`
- `kineticText`
- `definition`
- `bigNumber`
- `comparison`
- `timeline`
- `process`
- `flowchart`
- `diagram`
- `iconScene`
- `document`
- `documentHighlight`
- `image`
- `video`
- `annotatedImage`
- `bulletReveal`
- `dataChart`
- `matrix`
- `cycle`
- `multipleChoice`
- `workedExample`
- `hierarchy`
- `quote`
- `question`
- `visualGag`
- `recap`

The schema for each scene is intentionally bounded so ChatGPT can create varied videos without inventing fields the renderer cannot support.

## Motion intents

Supported high-level motion intents are:

- `fade`
- `slide`
- `scale`
- `slam`
- `draw`
- `reveal`
- `cameraPush`
- `parallax`
- `counter`

These are intents, not exact animations. The design system and scene renderer decide the actual easing, distances and timing.

## Cross-reference validation

The schema also checks rules that cannot be expressed by field types alone:

- chapter IDs are unique
- scene IDs are unique globally
- flowchart edges refer to existing nodes
- image/annotated-image scenes refer to image-compatible assets
- video scenes refer to video-compatible assets
- document scenes refer to document assets

This makes validation useful before any expensive narration or render work starts.

See `examples/design-science.studytube.json` for a minimal complete project.
