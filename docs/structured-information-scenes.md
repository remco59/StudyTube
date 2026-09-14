# Structured information scenes

PR 6 adds the five scene types that turn lists and relationships into visual structures rather than text-heavy slides.

## Scene types

- `timeline`: adaptive card timeline for 2–8 milestones.
- `process`: numbered process cards for 2–8 steps; small processes stay on one row while longer processes rebalance automatically.
- `flowchart`: deterministic graph canvas for 2–12 nodes and up to 20 edges. The author supplies only node IDs and edges; StudyTube calculates coordinates and draws connections.
- `diagram`: one central concept with 2–8 automatically distributed orbit items.
- `iconScene`: adaptive 1–6 item overview for examples/categories.

## Layout rules

Authors never provide pixel positions. `structuredLayout.ts` owns placement rules and can evolve without changing `.studytube.json` files.

`getAdaptiveGridColumns()` balances larger sets into multiple rows. `getFlowchartPositions()` keeps supported node counts within a fixed render canvas. `getOrbitPositions()` distributes diagram items around a stable center.

The layout helpers are pure functions with unit tests so common item-count variations can be checked without rendering video frames.

## Rendering behavior

Each structured scene reuses the global StudyTube safe area, colors, typography, radii and motion system. Internal items reveal with small staggered delays so the viewer can follow structure formation instead of receiving the entire diagram at once.

The sample Remotion project includes deliberately larger examples (five timeline/process/diagram nodes and six icon cards) to exercise multi-row and dense layouts during every bundle/build.
