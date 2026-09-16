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

Currently exactly `1.0`. Future breaking project-format changes must use a new version and an explicit migration path rather than silently changing v1 semantics.

### `metadata`

Required fields:

- `title`
- `language`, for example `nl-NL`
- `targetDuration` in seconds
- `style`, a design-system style preset: `educational-explainer` (default) or `midnight-focus`. Both presets share the same layout, typography and motion; only the color palette changes. See `packages/design-system`'s `colorPresets`.

`targetDuration` is an authoring target. Final duration will later be calculated from generated narration audio.

### `assets`

Optional dictionary keyed by stable asset ID. V1 defines `image` and `document` assets. The actual asset resolver is implemented in a later PR.

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
- image scenes refer to image assets
- document scenes refer to document assets

This makes validation useful before any expensive narration or render work starts.

See `examples/design-science.studytube.json` for a minimal complete project.
