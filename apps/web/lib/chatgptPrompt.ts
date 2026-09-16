type PromptOptions={
  targetDurationMinutes:number;
  language:"nl-NL"|"en-US";
  scope:string;
};

const languageNames:Record<PromptOptions["language"],string>={
  "nl-NL":"Dutch",
  "en-US":"English",
};

export const buildChatGptPrompt=({targetDurationMinutes,language,scope}:PromptOptions)=>{
  const targetDuration=Math.max(30,Math.min(7200,Math.round(targetDurationMinutes*60)));
  const scopeInstruction=scope.trim()
    ?`Focus specifically on this scope: ${scope.trim()}`
    :"Cover the important concepts in the supplied study material.";

  return `Create a complete StudyTube video project from the study material I provide in this chat.

Your goal is to turn the material into an engaging educational explainer video that helps me understand and remember the important concepts, rather than simply summarizing the source.

Return one finished downloadable StudyTube project file:
- If the project uses no external image or document assets, return a .studytube.json file.
- If the project uses one or more image or document assets, return a .studytube.zip file containing project.studytube.json at the archive root plus every referenced asset at its exact project-relative path.
- Never return a JSON project that references assets separately. Assets belong inside the ZIP.

VIDEO SETTINGS
- Language: ${language} (${languageNames[language]})
- Target duration: ${targetDuration} seconds (about ${targetDurationMinutes} minutes)
- Style: educational-explainer
- ${scopeInstruction}

CONTENT REQUIREMENTS
- Base the educational claims in the video only on the supplied study material.
- Explain concepts clearly at higher-education level.
- Prioritize understanding over reproducing the wording of the source.
- Preserve important terminology from the source.
- Explain difficult concepts with examples, comparisons or visual structures where useful.
- Do not invent facts that are not supported by the material.
- Never invent or paraphrase a quotation and present it as a direct quote. Use a quote scene only for wording that appears in the supplied material, and preserve that wording accurately.
- Structure the video into logical chapters.
- Start with an engaging introduction.
- End important sections with short recaps where useful.
- End the complete video with a recap of the main learning points.
- Use questions occasionally to encourage active recall.
- Keep on-screen text concise. Narration may contain more explanation than the visual.
- Treat every visual field as a strict screen-space budget: titles should usually stay below 9 words, kinetic text below 16 words, comparison side titles below 5 words, comparison bodies below 18 words, and recap points below 14 words.
- For comparison scenes, versusLabel must be a very short connector of at most 3 short words such as "vs.", "of", or "tegenover". Never put a sentence or the full comparison message in versusLabel.
- Vary the visual presentation. Do not make every scene a title card or bullet list.
- Prefer a semantically specific scene such as cycle, matrix, workedExample, hierarchy, dataChart, annotatedImage or quote over forcing the content into a generic card layout.
- Write narration as natural spoken ${languageNames[language]}, not academic written prose.
- Aim for approximately 130-160 spoken words per minute.

VISUAL ASSETS
- When a real image would genuinely improve understanding or visual variety, you may use an image found on the internet or generate a suitable image with ChatGPT.
- Only use an internet image if you can actually obtain the image file and include it in the final ZIP. Do not put a remote web URL in asset.path.
- Prefer generated images, public-domain material, or openly licensed/reusable images when practical.
- Keep illustrative images faithful to the supplied study material. An image may illustrate a concept, but it must not introduce unsupported factual claims.
- Save packaged assets below assets/ using safe simple filenames, for example assets/design-cycle.png.
- For an image asset, include a useful alt description.
- If you cannot include the actual asset file, do not reference it from the project.

STRICT STUDYTUBE FORMAT
The root object must have this structure:
{
  "version": "1.0",
  "metadata": {
    "title": "...",
    "language": "${language}",
    "targetDuration": ${targetDuration},
    "style": "educational-explainer",
    "description": "..."
  },
  "assets": {},
  "chapters": []
}

assets is optional when there are no assets. When assets exist, the project must be delivered as a .studytube.zip and every asset path must exist inside that ZIP.

Example image asset:
"assets": {
  "design-cycle": {
    "type": "image",
    "path": "assets/design-cycle.png",
    "alt": "Schematic design cycle"
  }
}

All chapter IDs, scene IDs, asset IDs and flowchart node IDs must contain only letters, numbers, hyphens or underscores and must be unique where required.

Every scene must contain: id, type, narration and visual.
Every scene may optionally contain: motion and sources.
Allowed motion values: fade, slide, scale, slam, draw, reveal, cameraPush, parallax, counter.

Only use the following scene types and exactly the visual fields listed below.

title
{"eyebrow":"optional","title":"required","subtitle":"optional"}

chapterIntro
{"chapterLabel":"optional","title":"required","subtitle":"optional"}

kineticText
{"text":"required","emphasis":["optional, maximum 4"]}

definition
{"term":"required","definition":"required","example":"optional"}

bigNumber
{"value":"required","label":"required","context":"optional"}

comparison
{"left":{"title":"required","body":"optional","icon":"optional"},"right":{"title":"required","body":"optional","icon":"optional"},"versusLabel":"optional, maximum 3 short words"}

timeline
{"title":"optional","items":[{"label":"required","title":"required","description":"optional"}]}
Use 2-8 timeline items.

process
{"title":"optional","steps":[{"title":"required","description":"optional","icon":"optional"}]}
Use 2-8 process steps.

flowchart
{"title":"optional","nodes":[{"id":"required","label":"required","detail":"optional"}],"edges":[{"from":"existing-node-id","to":"existing-node-id","label":"optional"}]}
Every edge must reference node IDs that exist in the same flowchart.

diagram
{"center":"required","items":[{"label":"required","detail":"optional","icon":"optional"}]}
Use 2-8 diagram items.

iconScene
{"title":"optional","items":[{"icon":"required","label":"required","detail":"optional"}]}
Use 1-6 items.

question
{"question":"required","prompt":"optional"}

visualGag
{"preset":"giantReport | absurdScale | redArrow | fakeLoading | spotlight","label":"optional","punchline":"optional"}
Use visualGag only occasionally and only when it supports the explanation.

recap
{"title":"optional","points":["2 to 6 concise points"]}

bulletReveal
{"title":"optional","points":["2 to 6 concise points"]}
Use bulletReveal when several related points should appear progressively during one explanation. Do not use it as a default replacement for more meaningful visual structures.

dataChart
{"title":"optional","chartType":"bar | line | donut","data":[{"label":"required","value":0}],"unit":"optional","sourceLabel":"optional"}
Use 2-8 non-negative data points. Only visualize numeric values explicitly supported by the supplied material.

matrix
{"title":"optional","xAxis":{"low":"optional label","high":"optional label"},"yAxis":{"low":"optional label","high":"optional label"},"quadrants":{"topLeft":{"title":"required","detail":"optional"},"topRight":{"title":"required","detail":"optional"},"bottomLeft":{"title":"required","detail":"optional"},"bottomRight":{"title":"required","detail":"optional"}}}
Use matrix for genuine two-dimensional frameworks or classifications.

cycle
{"title":"optional","center":"optional","steps":[{"title":"required","detail":"optional","icon":"optional"}]}
Use 3-8 steps. Use cycle only when the final step conceptually feeds back into the first.

multipleChoice
{"question":"required","options":[{"label":"required","explanation":"optional"}],"correctIndex":0,"revealAfterSeconds":"optional number, default 3"}
Use 2-5 options. correctIndex is zero-based and must point to an existing option. Only include a correct answer when it is supported by the material.

workedExample
{"title":"optional","problem":"required","steps":[{"label":"optional","title":"required","body":"required"}],"result":"optional"}
Use 1-5 concise steps. Use workedExample to demonstrate applying a method, model, calculation or reasoning process.

hierarchy
{"title":"optional","direction":"topDown | bottomUp","levels":[{"label":"required","detail":"optional"}]}
Use 2-6 levels and only when the source implies a genuine ordering, layering or hierarchy.

quote
{"quote":"required","author":"optional","work":"optional","locator":"optional","context":"optional"}
Use quote for a short, exact passage from the supplied literature when the original wording itself matters. Preserve the wording exactly, keep the visible quotation concise, and include author/work/locator when those details are identifiable from the source. Never invent a quote or attribution.

Use these scene types only when the corresponding asset is present in the project package:

image
{"assetId":"existing image asset ID","fit":"contain | cover","caption":"optional"}

annotatedImage
{"assetId":"existing image asset ID","fit":"contain | cover","title":"optional","annotations":[{"label":"required","x":50,"y":50,"targetX":"optional 0-100","targetY":"optional 0-100"}],"caption":"optional"}
Coordinates are percentages from the top-left. Keep annotations sparse, normally 1-5, and place labels so they do not overlap important image content.

document
{"assetId":"existing document asset ID","page":1,"caption":"optional"}

documentHighlight
{"assetId":"existing document asset ID","page":1,"highlightText":"required","caption":"optional"}

If sources from the supplied material are identifiable, scenes may contain:
"sources":[{"label":"Chapter 2, p. 34","note":"Optional clarification"}]
Do not invent URLs or source details.

VIDEO DESIGN
Think in scenes rather than slides.
Prefer definition for terminology, comparison for contrasts, process for one-way sequential methods, cycle for repeating processes, flowchart for decisions and relationships, diagram for connected concepts, hierarchy for levels, matrix for two-dimensional frameworks, timeline for chronology, dataChart for supported numeric evidence, workedExample for applying knowledge, multipleChoice for active recall, quote when exact wording from the literature deserves emphasis, bigNumber for meaningful figures, kineticText for a short important statement, question for reflection, and recap for consolidation.
Use annotatedImage when labels or callouts make an image teach something that the image alone would not communicate.
Use bulletReveal for short progressive lists, but avoid falling back to it when another scene type expresses the relationships more clearly.
Use image scenes selectively when a photograph, illustration, diagram or generated visual adds something the structured StudyTube scenes cannot communicate as well.
Do not repeat the narration verbatim in the visual.
Make transitions between scenes logical so the narration feels like one coherent video rather than disconnected cards.

VALIDATION BEFORE OUTPUT
Before returning the file, internally check that:
1. The root uses version 1.0.
2. metadata.language is ${language}.
3. metadata.style is exactly educational-explainer.
4. targetDuration is exactly ${targetDuration}.
5. There is at least one chapter and every chapter has at least one scene.
6. Every chapter ID is unique.
7. Every scene ID is globally unique.
8. Every scene uses a supported scene type.
9. Every visual object contains only fields supported by that scene type.
10. Every flowchart edge references an existing node.
11. Every multipleChoice correctIndex references an existing option.
12. Every quote is copied accurately from the supplied material and is not invented or misattributed.
13. No image, annotatedImage or document scene references a nonexistent asset.
14. Every declared asset exists at the exact same path inside the ZIP.
15. A text-only project contains no declared assets and is returned as .studytube.json.
16. A project with assets is returned as .studytube.zip with project.studytube.json at the archive root.
17. The project JSON is valid JSON with no comments, trailing commas or placeholders.

OUTPUT
Return the finished file as a downloadable attachment, not as explanatory prose.
Use .studytube.json for a project without assets.
Use .studytube.zip for a project with assets.
For ZIP projects, place project.studytube.json at the archive root and include all assets at their referenced relative paths.
Do not add an explanation before or after the file.`;
};