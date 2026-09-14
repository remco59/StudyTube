# ChatGPT authoring specification

This is the content contract for generating StudyTube v1 projects with ChatGPT.

StudyTube starts at the `.studytube.json` boundary. ChatGPT decides what matters, writes the spoken explanation and chooses semantic scene types. StudyTube owns exact timing, voice synthesis, layout, animation, captions and rendering.

## Goal

Create an educational YouTube-style explainer that is useful for studying, not a narrated slide deck.

A good project should:

- explain why a concept matters before introducing jargon;
- use concrete examples when theory becomes abstract;
- keep one main visual thought per scene;
- vary visual structures based on explanatory purpose;
- repeat important ideas through different representations rather than repeating sentences;
- use humor sparingly and only when it reinforces the explanation;
- stay faithful to the supplied source material;
- preserve uncertainty and limitations.

## Pacing

For Dutch narration, plan around 145–165 spoken words per minute. The renderer never trusts an estimated scene duration: Piper synthesizes the narration first and StudyTube measures the WAV.

Typical planning targets:

| Video | Narration |
| --- | ---: |
| 5 min | 700–800 words |
| 10 min | 1,450–1,650 words |
| 15 min | 2,150–2,400 words |

Prefer a new visual composition roughly every 6–15 seconds where the material supports it. Internal animation can create additional movement inside a longer scene.

## Required project shell

```json
{
  "version": "1.0",
  "metadata": {
    "title": "Human-readable title",
    "language": "nl-NL",
    "targetDuration": 900,
    "style": "educational-explainer"
  },
  "assets": {},
  "chapters": []
}
```

All IDs must start with a letter or number and use only letters, numbers, hyphens and underscores. Scene IDs must be unique across the project.

Do not put CSS, coordinates, frame numbers, React code, transition durations or camera keyframes in JSON. Describe semantic intent and let StudyTube render it.

## Scene types

Use only these v1 types:

- `title`: opening title; normally once.
- `chapterIntro`: meaningful chapter transition.
- `kineticText`: short phrase worth typographic emphasis.
- `definition`: term + concise definition + optional example.
- `bigNumber`: one meaningful value; never invent a statistic just to use this scene.
- `comparison`: two alternatives, states or interpretations.
- `timeline`: chronological or clearly staged sequence.
- `process`: ordered procedure of 2–8 steps.
- `flowchart`: explicit directional relationships between nodes.
- `diagram`: one central concept with 2–8 surrounding factors.
- `iconScene`: scan-friendly set of examples or categories.
- `image`: a real locally supplied image asset.
- `document`: a real locally supplied document when source context matters visually.
- `documentHighlight`: one short important passage/idea from a supplied document.
- `question`: a real conceptual question or transition.
- `visualGag`: occasional visual joke using an existing preset.
- `recap`: 2–6 compact takeaways at the end of a substantial chapter.

Visual-gag presets are `giantReport`, `absurdScale`, `redArrow`, `fakeLoading` and `spotlight`.

## Motion vocabulary

Optional `motion` values are:

`fade`, `slide`, `scale`, `slam`, `draw`, `reveal`, `cameraPush`, `parallax`, `counter`.

Do not randomize motion for novelty. Prefer `draw` for flows, `counter` for values, `cameraPush` for media/detail and restrained `fade`/`slide` for ordinary explanation.

## Spoken narration

Write for speaking rather than reading:

- use natural Dutch;
- prefer active sentences;
- keep each scene focused on one thought;
- expand unclear abbreviations on first use;
- keep URLs and citation syntax out of narration;
- do not narrate every visual literally;
- let narration and visual complement each other.

Visible text should be much shorter than narration. Good targets are under 9 words for titles, under 16 for kinetic text and recap points, and under roughly 30 words per comparison side.

## Sources

Optional scene sources can preserve traceability:

```json
"sources": [
  {
    "label": "Course reader, chapter 3",
    "note": "Basis voor het ontwerpprincipe in deze scene"
  }
]
```

Never invent an author, URL, page number, quote, statistic or source. A source reference does not create a media asset automatically.

## Assets

Only declare files the user can provide alongside the JSON:

```json
"assets": {
  "cycle": {
    "type": "image",
    "path": "assets/cycle.svg",
    "alt": "Schematische onderzoekscyclus"
  },
  "reader": {
    "type": "document",
    "path": "assets/reader.pdf",
    "title": "Course reader"
  }
}
```

Paths must be project-relative. Never use absolute paths, `..` traversal, Windows drive paths or web URLs as local asset paths.

## Recommended chapter rhythm

A useful, non-mandatory rhythm is:

1. chapter intro;
2. concrete problem/example;
3. definition only when needed;
4. model/process/comparison;
5. question or another visual reset;
6. application/evidence;
7. recap.

Do not follow this mechanically. Scene choice follows the material.

## Self-check before output

Before returning a finished project, verify:

1. JSON is valid and contains no Markdown fence.
2. `version` is `1.0` and style is `educational-explainer`.
3. IDs are unique and schema-safe.
4. Every media scene references an existing asset of the correct type.
5. Every flowchart edge points to a node in the same scene.
6. No unsupported scene type or motion intent is used.
7. On-screen copy stays compact.
8. Narration word count roughly matches the requested duration.
9. The sequence has enough visual variation to avoid a spoken PowerPoint.
10. Claims stay faithful to the supplied material.
11. No source, quotation, statistic or asset path is invented.

## Reusable ChatGPT prompt

```text
Create a StudyTube v1 project from the supplied study material.

Goal: a Dutch educational YouTube-style explainer for study and revision.
Target duration: 15 minutes.
Language: nl-NL.

Follow docs/AUTHORING.md exactly. Use only StudyTube v1 scene types and motion intents. Write natural spoken narration, keep on-screen copy compact, vary scene types based on explanatory purpose, and use chapter recaps. Do not invent facts, citations, quotations, statistics or asset files. If no real asset files are supplied, do not use image/document scene types.

Before output, check schema consistency, unique IDs, flowchart references, media asset types and approximate narration word count. Return only the complete `.studytube.json` content.
```

`examples/design-science-15min.studytube.json` is the reference for a substantial project, not a rigid content template.
