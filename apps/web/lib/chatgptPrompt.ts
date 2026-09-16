import {buildTeachingPromptSection,defaultPromptTeachingConfig,type PromptTeachingConfig} from "./promptConfig";

export type PromptAssetType="web-images"|"stock-video"|"generated-images"|"source-documents";
export type PromptAssetAmount="few"|"some"|"many"|"lots";

type PromptOptions={
  targetDurationMinutes:number;
  language:"nl-NL"|"en-US";
  scope:string;
  useAssets?:boolean;
  assetTypes?:PromptAssetType[];
  assetAmount?:PromptAssetAmount;
  teaching?:PromptTeachingConfig;
};

const languageNames:Record<PromptOptions["language"],string>={
  "nl-NL":"Dutch",
  "en-US":"English",
};

const assetTypeLabels:Record<PromptAssetType,string>={
  "web-images":"stock images (Pixabay, Pexels or Unsplash)",
  "stock-video":"stock video (Pixabay or Pexels)",
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
  few:"Use assets sparingly at a handful of high-value moments where they clearly improve the explanation.",
  some:"Use assets regularly across the video, especially for important concepts, examples and transitions.",
  many:"Use assets frequently across nearly every major section. Avoid long stretches made only from cards, text or abstract UI scenes.",
  lots:"Treat images and video as a primary visual language, not occasional decoration. Use asset-backed scenes continuously throughout the video and avoid long stretches made only from cards, text or abstract UI scenes.",
};

const assetCadenceSeconds:Record<PromptAssetAmount,{min:number;max:number}>={
  few:{min:60,max:90},
  some:{min:30,max:45},
  many:{min:15,max:25},
  lots:{min:8,max:15},
};

const assetTypeInstructions:Record<PromptAssetType,string>={
  "web-images":"For stock photography, declare stockImage assets with a concise search query and provider \"auto\". Do not search the web yourself, invent a remote URL or put a path on a stockImage request. StudyTube will resolve the request through enabled Pixabay, Pexels or Unsplash providers during import.",
  "stock-video":"For useful B-roll, declare stockVideo assets with a concise search query and provider \"auto\". Use video scenes to show them and reuse stock-video throughout the project when the selected asset amount is high. Do not invent a remote URL or put a path on a stockVideo request. StudyTube will resolve the request through enabled Pexels or Pixabay providers during import.",
  "generated-images":"Generate purpose-built illustrations or images when they can explain a concept more clearly than a generic visual. Package the actual generated image file in the ZIP and reference it with an image asset path.",
  "source-documents":"Use supplied source documents or useful pages from them with document/documentHighlight scenes when that helps explain the material. Package the actual referenced document file in the ZIP.",
};

export const buildChatGptPrompt=({targetDurationMinutes,language,scope,useAssets=false,assetTypes=["web-images","stock-video","generated-images"],assetAmount="some",teaching=defaultPromptTeachingConfig}:PromptOptions)=>{
  const targetDuration=Math.max(30,Math.min(7200,Math.round(targetDurationMinutes*60)));
  const scopeInstruction=scope.trim()?`Focus specifically on this scope: ${scope.trim()}`:"Cover the important concepts in the supplied study material.";
  const selectedAssetTypes=assetTypes.length>0?assetTypes:["web-images"] as PromptAssetType[];
  const assetTypeList=selectedAssetTypes.map((type)=>assetTypeLabels[type]).join(", ");
  const teachingInstruction=buildTeachingPromptSection(teaching);
  const cadence=assetCadenceSeconds[assetAmount];
  const targetAssetMin=Math.max(1,Math.floor(targetDuration/cadence.max));
  const targetAssetMax=Math.max(targetAssetMin,Math.ceil(targetDuration/cadence.min));
  const assetCadenceInstruction=`- For this ${targetDuration}-second video, use roughly ${targetAssetMin}-${targetAssetMax} asset-backed scenes as a planning target (about one every ${cadence.min}-${cadence.max} seconds). This is a density target, not a hard quota: prioritize pacing and explanation quality.`;
  const fullscreenMediaInstruction=assetAmount==="lots"
    ?"- Make full-frame media the default visual treatment when the asset can carry the scene. For photographic images, prefer image variant=\"full\"; for video, prefer a full-frame video scene with fit=\"cover\" when safe. Aim for roughly two thirds of image/video scenes to be full-frame, using split layouts mainly when text or a second visual genuinely adds value."
    :assetAmount==="many"
      ?"- Use full-frame images and video often. Prefer media-led scenes over placing every visual inside a split card, while still using split layouts when the explanation needs adjacent text or comparison."
      :"- Use full-frame image or video scenes when the visual itself deserves focus; use split layouts when adjacent text or comparison improves understanding.";
  const stockVideoInstruction=selectedAssetTypes.includes("stock-video")
    ?assetAmount==="lots"
      ?"- Stock video should recur throughout the project rather than appearing once or twice. When suitable footage exists, aim for about one video scene for every two to three image scenes, especially for real-world examples, transitions and contextual B-roll."
      :assetAmount==="many"
        ?"- Use stock video repeatedly as B-roll across multiple sections, not only as a single novelty clip."
        :"- Use stock video where motion adds context, pacing or a clearer real-world example."
    :"";
  const outputInstruction=useAssets
    ?`Return one finished downloadable .studytube.zip file containing project.studytube.json at the archive root plus every local packaged asset at its exact project-relative path.\n- stockImage and stockVideo declarations are resolver requests and intentionally do not have local files yet; StudyTube downloads them during import.\n- Generated images and source documents must be included in the ZIP at their declared paths.\n- Never reference a remote media URL in project JSON.`
    :`Return one finished downloadable .studytube.json file.\n- This project must be text-only: do not declare image, video, document or stock assets.\n- Do not use image, annotatedImage, video, document or documentHighlight scenes.`;
  const assetSettings=useAssets
    ?`- Assets: enabled\n- Asset types: ${assetTypeList}\n- Asset amount: ${assetAmountLabels[assetAmount]}`
    :"- Assets: disabled (text-only project)";
  const visualAssetsInstruction=useAssets
    ?`VISUAL ASSETS\n- Use only these requested asset types: ${assetTypeList}.\n- ${assetAmountInstructions[assetAmount]}\n${assetCadenceInstruction}\n${fullscreenMediaInstruction}\n${stockVideoInstruction?`${stockVideoInstruction}\n`:""}${selectedAssetTypes.map((type)=>`- ${assetTypeInstructions[type]}`).join("\n")}\n- Change the visual frequently enough to feel like an edited YouTube explainer rather than a narrated slide deck. Asset-backed scenes may be short B-roll beats under continuous narration when that improves pacing.\n- Keep illustrative assets faithful to the supplied study material. An asset may illustrate a concept, but it must not introduce unsupported factual claims.\n- For local packaged assets, save them below assets/ using safe simple filenames, for example assets/design-cycle.png.\n- For stock assets, write a broad visual search query describing what should literally be visible. Prefer English search terms even when narration is Dutch because stock libraries generally match them better.\n- Use provider \"auto\" unless a provider is essential. Unsplash supports stockImage only; Pixabay and Pexels support stockImage and stockVideo.\n- For every image or video asset, include a useful alt description.\n- Never place API keys, provider download URLs or temporary CDN URLs in project JSON.`
    :`VISUAL ASSETS\n- Do not use external image, video or document assets in this project.\n- Do not declare an assets object.\n- Do not use image, annotatedImage, video, document or documentHighlight scenes.\n- Use the structured StudyTube scene types below to create visual variety without external files.`;
  const assetSchemaInstruction=useAssets
    ?"assets is required for this project because assets are enabled. Packaged image/document assets use a project-local path. stockImage/stockVideo requests use query/provider/alt and must not include path."
    :"Do not include assets in this text-only project.";
  const assetExample=useAssets?`\nExamples:\n"assets": {\n  "campus-photo": {\n    "type": "stockImage",\n    "query": "university students collaborating around laptop",\n    "provider": "auto",\n    "alt": "Students collaborating around a laptop"\n  },\n  "wind-broll": {\n    "type": "stockVideo",\n    "query": "aerial wind turbines green landscape",\n    "provider": "auto",\n    "alt": "Aerial footage of wind turbines"\n  },\n  "design-cycle": {\n    "type": "image",\n    "path": "assets/design-cycle.png",\n    "alt": "Schematic design cycle"\n  }\n}\n`:"";
  const assetSceneRules=useAssets
    ?`Use these scene types only when the corresponding asset is declared:\n\nimage\n{"assetId":"existing image or stockImage asset ID","variant":"full | split-text | split-image","layout":"image-left | image-right","splitRatio":"40/60 | 50/50 | 60/40","fit":"contain | cover","title":"optional","text":"optional","caption":"optional","secondaryAssetId":"required for split-image","secondaryFit":"contain | cover","secondaryCaption":"optional"}\nOmit variant or use full for the classic full-width image scene. Use full for photographic or cinematic visuals that should dominate the frame. Use split-text when an image supports a concise explanation; it requires at least title or text and layout controls which side contains the image. Use split-image for side-by-side comparison and always provide secondaryAssetId referencing another image or stockImage asset. Prefer fit=contain for portrait, square, screenshot, diagram or infographic assets so important content is not cropped. splitRatio describes the first pane versus the second pane.\n\nannotatedImage\n{"assetId":"existing image or stockImage asset ID","fit":"contain | cover","title":"optional","annotations":[{"label":"required","x":50,"y":50,"targetX":"optional 0-100","targetY":"optional 0-100"}],"caption":"optional"}\nCoordinates are percentages from the top-left. Keep annotations sparse, normally 1-5, and place labels so they do not overlap important image content.\n\nvideo\n{"assetId":"existing video or stockVideo asset ID","fit":"contain | cover","caption":"optional"}\nUse stock video as supporting B-roll under narration, not as a source of factual claims. Prefer fit=cover for cinematic full-frame B-roll when important content will not be cropped. Keep visible captions concise. The stock clip audio is muted during rendering.\n\ndocument\n{"assetId":"existing document asset ID","page":1,"caption":"optional"}\n\ndocumentHighlight\n{"assetId":"existing document asset ID","page":1,"highlightText":"required","caption":"optional"}`
    :"Do not use the image, annotatedImage, video, document or documentHighlight scene types because assets are disabled.";
  const assetValidation=useAssets
    ?`13. Every image, annotatedImage, video or document scene references an existing compatible asset, and every split-image scene references a valid second image or stockImage asset.\n14. Every local image or document asset exists at the exact same path inside the ZIP. stockImage and stockVideo requests do not have paths or packaged files.\n15. The project contains at least one asset declaration and is returned as .studytube.zip with project.studytube.json at the archive root.`
    :`13. The project contains no declared assets.\n14. The project contains no image, annotatedImage, video, document or documentHighlight scenes.\n15. The project is returned as .studytube.json.`;
  const outputEnding=useAssets
    ?`Return the finished .studytube.zip file as a downloadable attachment, not as explanatory prose.\nPlace project.studytube.json at the archive root. Include all local generated/document assets at their referenced relative paths. Do not try to download stockImage or stockVideo requests yourself; StudyTube resolves those after import.`
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
- Do not invent facts that are not supported by the material.
- Never invent or paraphrase a quotation and present it as a direct quote. Use a quote scene only for wording that appears in the supplied material, and preserve that wording accurately.
- Structure the video into logical chapters.
- Start with an engaging introduction.
- End the complete video with a recap of the main learning points.
- Keep on-screen text concise. Narration may contain more explanation than the visual.
- Treat every visual field as a strict screen-space budget: titles should usually stay below 9 words, kinetic text below 16 words, comparison side titles below 5 words, comparison bodies below 18 words, and recap points below 14 words.
- For comparison scenes, versusLabel must be a very short connector of at most 3 short words such as "vs.", "of", or "tegenover". Never put a sentence or the full comparison message in versusLabel.
- Vary the visual presentation. Do not make every scene a title card or bullet list.
- Prefer a semantically specific scene such as cycle, matrix, workedExample, hierarchy, dataChart, annotatedImage or quote over forcing the content into a generic card layout.
- Write narration as natural spoken ${languageNames[language]}, not academic written prose.
- Aim for approximately 130-160 spoken words per minute.

${teachingInstruction}

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
${useAssets?"Use stock video for contextual B-roll and real-world examples, stock images for photographic context, generated images for purpose-built explanatory visuals, annotatedImage when labels or callouts make an image teach something that the image alone would not communicate, and document scenes when the source itself should be visible. Prefer full image scenes when a photographic or cinematic visual can carry the moment. Use image variant split-text when adjacent explanation is genuinely useful, especially for portrait, square, screenshot, diagram or infographic assets that would crop badly in a full-width frame. Prefer split-image for meaningful visual comparisons or two complementary examples, including stock images when appropriate. With high asset amounts, do not let split layouts crowd out full-screen imagery and B-roll. Do not use stock media merely as decoration when a native diagram would explain the concept better.":"Create visual variety with the structured scene types above instead of relying on external assets."}
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
