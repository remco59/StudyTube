# ChatGPT authoring specification

This is the content contract for generating StudyTube v1 projects with ChatGPT.

StudyTube starts at the project-file boundary. ChatGPT decides what matters, writes the spoken explanation, chooses semantic scene types and, when useful, supplies real media assets. StudyTube owns exact timing, voice synthesis, layout, animation, captions and rendering.

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

## Output package

StudyTube uses one file per project:

- **No assets:** return a `.studytube.json` file. It must not declare image or document assets.
- **One or more assets:** return a `.studytube.zip` file. It must contain `project.studytube.json` at the archive root and every referenced asset at its exact project-relative path.

Example ZIP:

```text
lesson.studytube.zip
├── project.studytube.json
└── assets
    ├── cycle.png
    └── reader.pdf
```

Do not use remote URLs as asset paths. Images found on the internet or generated with ChatGPT must be included as actual files in the ZIP.

## Pacing

For Dutch narration, plan around 145–165 spoken words per minute. The renderer never trusts an estimated scene duration: narration is synthesized first and StudyTube measures the audio.

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

`assets` may be omitted for text-only projects.

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
- `image`: a real image asset included in the project ZIP.
- `video`: a packaged or resolved video asset when motion footage helps the explanation.
- `document`: a real document asset included in the project ZIP when source context matters visually.
- `documentHighlight`: one short important passage/idea from an included document.
- `annotatedImage`: an image with semantic callouts that point to important regions.
- `bulletReveal`: a short set of points revealed progressively when sequencing matters.
- `dataChart`: supported numeric evidence shown as a chart; never invent data to use it.
- `matrix`: a two-dimensional framework or classification.
- `cycle`: a repeating process where the final stage connects back to the start.
- `multipleChoice`: an active-recall question with answer options and a correct answer.
- `workedExample`: a compact step-by-step application of a concept or method.
- `hierarchy`: levels, ranks or parent-child relationships.
- `quote`: exact wording from supplied literature when the wording itself deserves emphasis.
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

When an image genuinely improves understanding or visual variety, ChatGPT may use an image found online or generate one. Only reference it when the actual file can be included in the ZIP. Prefer generated, public-domain or openly reusable images when practical.

Declare packaged assets with project-relative paths:

```json
"assets": {
  "cycle": {
    "type": "image",
    "path": "assets/cycle.png",
    "alt": "Schematische onderzoekscyclus"
  },
  "reader": {
    "type": "document",
    "path": "assets/reader.pdf",
    "title": "Course reader"
  }
}
```

Paths must be project-relative. Never use absolute paths, `..` traversal, Windows drive paths, backslashes or web URLs as asset paths. Every declared asset must exist at the exact same path inside the `.studytube.zip`.

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

1. JSON is valid and contains no comments or placeholders.
2. `version` is `1.0` and style is `educational-explainer` or `midnight-focus`.
3. IDs are unique and schema-safe.
4. Every media scene references an existing asset of the correct type.
5. Every declared asset is actually present in the ZIP at the declared path.
6. Every flowchart edge points to a node in the same scene.
7. Every scene type and motion intent is from the supported v1 lists above.
8. On-screen copy stays compact.
9. Narration word count roughly matches the requested duration.
10. The sequence has enough visual variation to avoid a spoken PowerPoint.
11. Claims stay faithful to the supplied material.
12. No source, quotation, statistic or asset path is invented.
13. Projects without assets are returned as `.studytube.json`.
14. Projects with assets are returned as `.studytube.zip` with `project.studytube.json` at the archive root.

## Reusable ChatGPT prompt

```text
Create a StudyTube v1 project from the supplied study material.

Goal: a Dutch educational YouTube-style explainer for study and revision.
Target duration: 15 minutes.
Language: nl-NL.

Follow docs/AUTHORING.md exactly. Use only StudyTube v1 scene types and motion intents. Write natural spoken narration, keep on-screen copy compact, vary scene types based on explanatory purpose, and use chapter recaps. Do not invent facts, citations, quotations or statistics.

You may use useful images from the internet or generate images when they improve the explanation, but only if you can include the actual image files in the final project package.

If the project has no assets, return one downloadable .studytube.json file. If it has assets, return one downloadable .studytube.zip containing project.studytube.json at the root and every declared asset at its project-relative path. Never leave assets as separate uploads or remote URLs.

Before output, check schema consistency, unique IDs, flowchart references, media asset types, package completeness and approximate narration word count.
```

`examples/design-science-15min.studytube.json` is the reference for a substantial project, not a rigid content template.
