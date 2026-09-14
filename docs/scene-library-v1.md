# Scene library v1

PR 5 introduces the first production scene renderers used by the StudyTube composition.

Implemented scene types:

- `title`
- `chapterIntro`
- `kineticText`
- `definition`
- `bigNumber`
- `comparison`
- `question`
- `recap`

The JSON describes content and broad motion intent. StudyTube owns layout, typography, spacing, easing, entrance/exit motion and visual hierarchy.

## Rendering rules

- Scene content stays inside the shared video safe area.
- Text-heavy scenes use shared maximum widths and typography tokens.
- Scene-specific animation is deterministic from the current Remotion frame.
- Global scene entrance/exit motion remains handled by `SceneFrame`.
- Unsupported scene types fail with a clear renderer error until their implementation lands in later PRs.

## Visual direction

The initial scene set aims for a fast educational explainer rather than slideware:

- large single-purpose typography
- staggered reveals instead of static cards
- restrained surfaces and borders
- visual comparison rather than bullet-only layouts
- strong hierarchy with limited simultaneous text
- subtle chapter and scene metadata outside the main visual focus

Future scene PRs should reuse the same primitives instead of introducing one-off styling systems.
