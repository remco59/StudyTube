export type PromptAssetType="web-images"|"generated-images"|"source-documents";
export type PromptAssetAmount="few"|"some"|"many"|"lots";

type PromptOptions={
  targetDurationMinutes:number;
  language:"nl-NL"|"en-US";
  scope:string;
  useAssets?:boolean;
  assetTypes?:PromptAssetType[];
  assetAmount?:PromptAssetAmount;
};

const languageNames:Record<PromptOptions["language"],string>={
  "nl-NL":"Dutch",
  "en-US":"English",
};

const assetTypeLabels:Record<PromptAssetType,string>={
  "web-images":"internet images",
  "generated-images":"AI-generated images",
  "source-documents":"source documents/pages",
};

const assetAmountLabels:Record<PromptAssetAmount,string>={
  few:"A few",
  some:"Some",
  many:"Many",
  lots:"A lot",
};

const assetAmountInstructions:Record<PromptAssetAmount,string>={
  few:"Use assets sparingly, only at a few key moments where they add clear explanatory value.",
  some:"Use a moderate amount of assets throughout the video, especially for the most important concepts and transitions.",
  many:"Use assets frequently across most major sections while keeping each scene clear and uncluttered.",
  lots:"Use assets very frequently throughout the video. Prefer an asset whenever it meaningfully improves understanding or visual variety, while keeping each scene readable.",
};

const assetTypeInstructions:Record<PromptAssetType,string>={
  "web-images":"Use relevant images found on the internet only when you can obtain the actual image file and package it in the ZIP. Prefer public-domain or openly licensed/reusable material when practical.",
  "generated-images":"Generate purpose-built illustrations or images when they can explain a concept more clearly than a generic visual. Keep them faithful to the supplied study material.",
  "source-documents":"Use supplied source documents or useful pages from them with document/documentHighlight scenes when that helps explain the material. Package the actual referenced document file in the ZIP.",
};

export const buildChatGptPrompt=({targetDurationMinutes,language,scope,useAssets=false,assetTypes=["web-images","generated-images"],assetAmount="some"}:PromptOptions)=>{
  const targetDuration=Math.max(30,Math.min(7200,Math.round(targetDurationMinutes*60)));
  const scopeInstruction=scope.trim()?`Focus specifically on this scope: ${scope.trim()}`:"Cover the important concepts in the supplied study material.";
  const selectedAssetTypes=assetTypes.length>0?assetTypes:["generated-images"] as PromptAssetType[];
  const assetTypeList=selectedAssetTypes.map((type)=>assetTypeLabels[type]).join(", ");
  const outputInstruction=useAssets
    ?`Return one finished downloadable .studytube.zip file containing project.studytube.json at the archive root plus every referenced asset at its exact project-relative path.\n- This project must use assets, so include at least one packaged image or document asset.\n- Never return a JSON project that references assets separately. Assets belong inside the ZIP.`
    :`Return one finished downloadable .studytube.json file.\n- This project must be text-only: do not declare external image or document assets.\n- Do not use image, annotatedImage, document or documentHighlight scenes.`;
  const assetSettings=useAssets
    ?`- Assets: enabled\n- Asset types: ${assetTypeList}\n- Asset amount: ${assetAmountLabels[assetAmount]}`
    :"- Assets: disabled (text-only project)";
  const visualAssetsInstruction=useAssets
    ?`VISUAL ASSETS\n- Use only these requested asset types: ${assetTypeList}.\n- ${assetAmountInstructions[assetAmount]}\n${selectedAssetTypes.map((type)=>`- ${assetTypeInstructions[type]}`).join("\n")}\n- Only reference an asset when the actual file can be included in the final ZIP. Never put a remote web URL in asset.path.\n- Keep illustrative assets faithful to the supplied study material. An asset may illustrate a concept, but it must not introduce unsupported factual claims.\n- Save packaged assets below assets/ using safe simple filenames, for example assets/design-cycle.png.\n- For every image asset, include a useful alt description.\n- If a requested asset cannot be packaged, replace it with another selected asset type that can be packaged rather than leaving a broken reference.`
    :`VISUAL ASSETS\n- Do not use external image or document assets in this project.\n- Do not declare an assets object.\n- Do not use image, annotatedImage, document or documentHighlight scenes.\n- Use the structured StudyTube scene types below to create visual variety without external files.`;
  const assetSchemaInstruction=useAssets
    ?"assets is required for this project because assets are enabled. Every declared asset path must exist inside the .studytube.zip."
    :"Do not include assets in this text-only project.";
  const assetExample=useAssets?`\nExample image asset:\n"assets": {\n  "design-cycle": {\n    "type": "image",\n    "path": "assets/design-cycle.png",\n    "alt": "Schematic design cycle"\n  }\n}\n`:"";
  const assetSceneRules=useAssets
    ?`Use these scene types only when the corresponding asset is present in the project package:\n\nimage\n{"assetId":"existing image asset ID","fit":"contain | cover","caption":"optional"}\n\nannotatedImage\n{"assetId":"existing image asset ID","fit":"contain | cover","title":"optional","annotations":[{"label":"required","x":50,"y":50,"targetX":"optional 0-100","targetY":"optional 0-100"}],"caption":"optional"}\nCoordinates are percentages from the top-left. Keep annotations sparse, normally 1-5, and place labels so they do not overlap important image content.\n\ndocument\n{"assetId":"existing document asset ID","page":1,"caption":"optional"}\n\ndocumentHighlight\n{"assetId":"existing document asset ID","page":1,"highlightText":"required","caption":"optional"}`
    :"Do not use the image, annotatedImage, document or documentHighlight scene types because assets are disabled.";
  const assetValidation=useAssets
    ?`13. Every image, annotatedImage or document scene references an existing asset.\n14. Every declared asset exists at the exact same path inside the ZIP.\n15. The project contains at least one asset and is returned as .studytube.zip with project.studytube.json at the archive root.`
    :`13. The project contains no declared assets.\n14. The project contains no image, annotatedImage, document or documentHighlight scenes.\n15. The project is returned as .studytube.json.`;
  const outputEnding=useAssets
    ?`Return the finished .studytube.zip file as a downloadable attachment, not as explanatory prose.\nPlace project.studytube.json at the archive root and include all assets at their referenced relative paths.`
    :"Return the finished .studytube.json file as a downloadable attachment, not as explanatory prose.";
  const assetRootLine=useAssets?'  "assets": {},\n':'';

  return `Create a complete StudyTube video project from the study material I provide in this chat.

Your goal is to turn the material into an engaging educational explainer video that helps me understand and remember the important concepts, rather than simply summarizing the source.

${outputInstruction}

VIDEO SETTINGS
- Language: ${language} (${languageNames[language]})
- Target duration: ${targetDuration} seconds (about ${targetDurationMinutes} minutes)
- Style: educational-explainer
- ${scopeInstruction}
${assetSettings}

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

${visualAssetsInstruction}

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
${assetRootLine}  "chapters": []
}

${assetSchemaInstruction}
${assetExample}
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

${assetSceneRules}

If sources from the supplied material are identifiable, scenes may contain:
"sources":[{"label":"Chapter 2, p. 34","note":"Optional clarification"}]
Do not invent URLs or source details.

VIDEO DESIGN
Think in scenes rather than slides.
Prefer definition for terminology, comparison for contrasts, process for one-way sequential methods, cycle for repeating processes, flowchart for decisions and relationships, diagram for connected concepts, hierarchy for levels, matrix for two-dimensional frameworks, timeline for chronology, dataChart for supported numeric evidence, workedExample for applying knowledge, multipleChoice for active recall, quote when exact wording from the literature deserves emphasis, bigNumber for meaningful figures, kineticText for a short important statement, question for reflection, and recap for consolidation.
${useAssets?"Use annotatedImage when labels or callouts make an image teach something that the image alone would not communicate. Use image/document scenes according to the requested asset amount, but only when the asset genuinely improves the explanation or visual variety.":"Create visual variety with the structured scene types above instead of relying on external assets."}
Use bulletReveal for short progressive lists, but avoid falling back to it when another scene type expresses the relationships more clearly.
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
${assetValidation}
16. The project JSON is valid JSON with no comments, trailing commas or placeholders.

OUTPUT
${outputEnding}
Do not add an explanation before or after the file.`;
};
