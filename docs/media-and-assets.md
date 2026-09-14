# Media, documents and project-local assets

StudyTube v1 resolves media from project-local relative paths. The `.studytube.json` file references an asset by ID; the asset table maps that ID to a path copied into the renderer's public/job asset directory.

## Safety rules

Asset paths must be relative and use forward slashes. Absolute paths, URL schemes, backslashes, traversal (`..`) and empty path segments are rejected by the renderer. The schema already checks asset IDs and media/document type compatibility, while the renderer repeats those checks defensively.

## Image scenes

`image` resolves the image with Remotion `staticFile()` and supports `cover` or `contain`. The renderer may apply a subtle deterministic camera push but does not modify the underlying asset.

## Document scenes

StudyTube does not rely on Chromium's PDF viewer. In v1, `document` and `documentHighlight` render a consistent paper treatment using the document's metadata, requested page number, caption and authored highlight text. A later ingestion pipeline can rasterize actual PDF pages into project-local image assets without changing the scene contract.

## Visual gags

The first deterministic presets are `giantReport`, `absurdScale`, `redArrow`, `fakeLoading` and `spotlight`. They are intentionally simple, reusable visual punctuation rather than generative video.

## File existence

This renderer layer validates references and safe paths. Job-level existence checks belong to the automated render pipeline (PR 10), because that layer knows the concrete job directory before Remotion is bundled/rendered.
