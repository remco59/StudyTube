# Design system and composition shell

PR 4 establishes the visual contract used by all later StudyTube scene implementations.

## Design system

`@studytube/design-system` owns shared deterministic tokens:

- 1920×1080 video geometry and safe areas
- dark canvas and off-white typography palette
- one purple accent family
- typography scales
- spacing and radii
- shadows
- basic motion timing values

Scene components should consume these tokens instead of inventing isolated values. This keeps independently implemented scene types visually coherent.

## Composition shell

The renderer now exposes a single `StudyTube` Remotion composition. Its input is a `NormalizedStudyTubeProject` produced by `@studytube/core`.

The composition does not calculate scene timing. It maps normalized scenes onto Remotion `Sequence` ranges using the exact `startFrame` and `durationInFrames` values supplied by core.

A renderer-local fixture provides default props for Remotion Studio and the sample render command. Later render jobs will pass normalized projects as input props.

## Scene frame

Every scene currently renders through the shared `SceneFrame` shell. It provides:

- safe-area padding
- consistent background treatment
- chapter and scene metadata
- typography and layout defaults
- controlled entrance/exit motion

The center content is deliberately a development placeholder. PR 5 replaces that placeholder behavior for the first real scene types while preserving the shell.

## Motion intents

Project JSON describes motion intent, not arbitrary animation code. The renderer currently maps the schema vocabulary to safe defaults:

- `fade`
- `slide`
- `scale`
- `slam`
- `reveal`
- `cameraPush`
- `parallax`

Other intents safely fall back to opacity-only motion until a scene-specific implementation uses them. This keeps authoring stable while the motion system grows.

## Dynamic metadata

The Remotion composition derives final duration and FPS from the normalized project through `calculateMetadata`. This keeps previews and future render jobs aligned with the timing model rather than a hard-coded demo duration.
