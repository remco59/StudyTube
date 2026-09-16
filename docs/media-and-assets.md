# Media, documents and project-local assets

StudyTube v1 resolves media from project-local relative paths. The `.studytube.json` file references an asset by ID; the asset table maps that ID to a path copied into the renderer's public/job asset directory.

## Safety rules

Asset paths must be relative and use forward slashes. Absolute paths, URL schemes, backslashes, traversal (`..`) and empty path segments are rejected by the renderer. The schema already checks asset IDs and media/document type compatibility, while the renderer repeats those checks defensively.

## Image scenes

`image` resolves the image with Remotion `staticFile()` and supports `cover` or `contain`. The renderer may apply a subtle deterministic camera push but does not modify the underlying asset.

## Document scenes

StudyTube does not rely on Chromium's PDF viewer. Before Remotion starts, the worker rasterizes every PDF page referenced by a `document` or `documentHighlight` scene to a cached PNG using Poppler's `pdftoppm`. The generated page image is staged into the job's public directory and rendered with `object-fit: contain`, so photographs, diagrams and page layout from the source PDF remain visible without cropping.

Rasterized pages are cached by PDF content hash, page number and render DPI. Repeated use of the same source page therefore reuses the generated PNG. If rasterization fails, or if the document asset is not a PDF, the renderer falls back to the existing deterministic paper treatment using the document metadata, requested page number, caption and authored highlight text.

`documentHighlight` uses the same real page render and places the authored highlight text as a readable callout over the page.

## Visual gags

The first deterministic presets are `giantReport`, `absurdScale`, `redArrow`, `fakeLoading` and `spotlight`. They are intentionally simple, reusable visual punctuation rather than generative video.

## File existence

This renderer layer validates references and safe paths. Job-level existence checks belong to the automated render pipeline (PR 10), because that layer knows the concrete job directory before Remotion is bundled/rendered.
