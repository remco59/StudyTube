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
  const scopeInstruction=scope.trim()
    ?`Focus specifically on this scope: ${scope.trim()}`
    :"Cover the important concepts in the supplied study material.";
  const selectedAssetTypes=assetTypes.length>0?assetTypes:["generated-images"] as PromptAssetType[];
  const assetTypeList=selectedAssetTypes.map((type)=>assetTypeLabels[type]).join(", ");
  const outputInstruction=useAssets
    ?`Return one finished downloadable .studytube.zip file containing project.studytube.json at the archive root plus every referenced asset at its exact project-relative path.\n- This project must use assets, so include at least one packaged image or document asset.\n- Never return a JSON project that references assets separately. Assets belong inside the ZIP.`
    :`Return one finished downloadable .studytube.json file.\n- This project must be text-only: do not declare external image or document assets.\n- Do not use image, document or documentHighlight scenes.`;
  const assetSettings=useAssets
    ?`- Assets: enabled\n- Asset types: ${assetTypeList}\n- Asset amount: ${assetAmountLabels[assetAmount]}`
    :"- Assets: disabled (text-only project)";
  const visualAssetsInstruction=useAssets
    ?`VISUAL ASSETS\n- Use only these requested asset types: ${assetTypeList}.\n- ${assetAmountInstructions[assetAmount]}\n${selectedAssetTypes.map((type)=>`- ${assetTypeInstructions[type]}`).join("\n")}\n- Only reference an asset when the actual file can be included in the final ZIP. Never put a remote web URL in asset.path.\n- Keep illustrative assets faithful to the supplied study material. An asset may illustrate a concept, but it must not introduce unsupported factual claims.\n- Save packaged assets below assets/ using safe simple filenames, for example assets/design-cycle.png.\n- For every image asset, include a useful alt description.\n- If a requested asset cannot be packaged, replace it with another selected asset type that can be packaged rather than leaving a broken reference.`
    :`VISUAL ASSETS\n- Do not use external image or document assets in this project.\n- Do not declare an assets object.\n- Do not use image, document or documentHighlight scenes.\n- Use the structured StudyTube scene types below to create visual variety without external files.`;
  const assetSchemaInstruction=useAssets
    ?`assets is required for this project because assets are enabled. Every declared asset path must exist inside the .studytube.zip.`
    :`Do not include assets in this text-only project.`;
  const assetExample=useAssets
    ?`\nExample image asset:\n\"assets\": {\n  \"design-cycle\": {\n    \"type\": \"image\",\n    \"path\": \"assets/design-cycle.png\",\n    \"alt\": \"Schematic design cycle\"\n  }\n}\n`
    :"";
  const assetSceneRules=useAssets
    ?`Use these scene types only when the corresponding asset is present in the project package:\n\nimage\n{\"assetId\":\"existing image asset ID\",\"fit\":\"contain | cover\",\"caption\":\"optional\"}\n\ndocument\n{\"assetId\":\"existing document asset ID\",\"page\":1,\"caption\":\"optional\"}\n\ndocumentHighlight\n{\"assetId\":\"existing document asset ID\",\"page\":1,\"highlightText\":\"required\",\"caption\":\"optional\"}`
    :"Do not use the image, document or documentHighlight scene types because assets are disabled.";
  const assetValidation=useAssets
    ?`11. Every image or document scene references an existing asset.\n12. Every declared asset exists at the exact same path inside the ZIP.\n13. The project contains at least one asset and is returned as .studytube.zip with project.studytube.json at the archive root.`
    :`11. The project contains no declared assets.\n12. The project contains no image, document or documentHighlight scenes.\n13. The project is returned as .studytube.json.`;
  const outputEnding=useAssets
    ?`Return the finished .studytube.zip file as a downloadable attachment, not as explanatory prose.\nPlace project.studytube.json at the archive root and include all assets at their referenced relative paths.`
    :`Return the finished .studytube.json file as a downloadable attachment, not as explanatory prose.`;

  return `Create a complete StudyTube video project from the study material I provide in this chat.\n\nYour goal is to turn the material into an engaging educational explainer video that helps me understand and remember the important concepts, rather than simply summarizing the source.\n\n${outputInstruction}\n\nVIDEO SETTINGS\n- Language: ${language} (${languageNames[language]})\n- Target duration: ${targetDuration} seconds (about ${targetDurationMinutes} minutes)\n- Style: educational-explainer\n- ${scopeInstruction}\n${assetSettings}\n\nCONTENT REQUIREMENTS\n- Base the educational claims in the video only on the supplied study material.\n- Explain concepts clearly at higher-education level.\n- Prioritize understanding over reproducing the wording of the source.\n- Preserve important terminology from the source.\n- Explain difficult concepts with examples, comparisons or visual structures where useful.\n- Do not invent facts that are not supported by the material.\n- Structure the video into logical chapters.\n- Start with an engaging introduction.\n- End important sections with short recaps where useful.\n- End the complete video with a recap of the main learning points.\n- Use questions occasionally to encourage active recall.\n- Keep on-screen text concise. Narration may contain more explanation than the visual.\n- Treat every visual field as a strict screen-space budget: titles should usually stay below 9 words, kinetic text below 16 words, comparison side titles below 5 words, comparison bodies below 18 words, and recap points below 14 words.\n- For comparison scenes, versusLabel must be a very short connector of at most 3 short words such as \"vs.\", \"of\", or \"tegenover\". Never put a sentence or the full comparison message in versusLabel.\n- Vary the visual presentation. Do not make every scene a title card or bullet list.\n- Write narration as natural spoken ${languageNames[language]}, not academic written prose.\n- Aim for approximately 130-160 spoken words per minute.\n\n${visualAssetsInstruction}\n\nSTRICT STUDYTUBE FORMAT\nThe root object must have this structure:\n{\n  \"version\": \"1.0\",\n  \"metadata\": {\n    \"title\": \"...\",\n    \"language\": \"${language}\",\n    \"targetDuration\": ${targetDuration},\n    \"style\": \"educational-explainer\",\n    \"description\": \"...\"\n  },\n  ${useAssets?'\"assets\": {},\\n  ':''}\"chapters\": []\n}\n\n${assetSchemaInstruction}\n${assetExample}\nAll chapter IDs, scene IDs, asset IDs and flowchart node IDs must contain only letters, numbers, hyphens or underscores and must be unique where required.\n\nEvery scene must contain: id, type, narration and visual.\nEvery scene may optionally contain: motion and sources.\nAllowed motion values: fade, slide, scale, slam, draw, reveal, cameraPush, parallax, counter.\n\nOnly use the following scene types and exactly the visual fields listed below.\n\ntitle\n{\"eyebrow\":\"optional\",\"title\":\"required\",\"subtitle\":\"optional\"}\n\nchapterIntro\n{\"chapterLabel\":\"optional\",\"title\":\"required\",\"subtitle\":\"optional\"}\n\nkineticText\n{\"text\":\"required\",\"emphasis\":[\"optional, maximum 4\"]}\n\ndefinition\n{\"term\":\"required\",\"definition\":\"required\",\"example\":\"optional\"}\n\nbigNumber\n{\"value\":\"required\",\"label\":\"required\",\"context\":\"optional\"}\n\ncomparison\n{\"left\":{\"title\":\"required\",\"body\":\"optional\",\"icon\":\"optional\"},\"right\":{\"title\":\"required\",\"body\":\"optional\",\"icon\":\"optional\"},\"versusLabel\":\"optional, maximum 3 short words\"}\n\ntimeline\n{\"title\":\"optional\",\"items\":[{\"label\":\"required\",\"title\":\"required\",\"description\":\"optional\"}]}\nUse 2-8 timeline items.\n\nprocess\n{\"title\":\"optional\",\"steps\":[{\"title\":\"required\",\"description\":\"optional\",\"icon\":\"optional\"}]}\nUse 2-8 process steps.\n\nflowchart\n{\"title\":\"optional\",\"nodes\":[{\"id\":\"required\",\"label\":\"required\",\"detail\":\"optional\"}],\"edges\":[{\"from\":\"existing-node-id\",\"to\":\"existing-node-id\",\"label\":\"optional\"}]}\nEvery edge must reference node IDs that exist in the same flowchart.\n\ndiagram\n{\"center\":\"required\",\"items\":[{\"label\":\"required\",\"detail\":\"optional\",\"icon\":\"optional\"}]}\nUse 2-8 diagram items.\n\niconScene\n{\"title\":\"optional\",\"items\":[{\"icon\":\"required\",\"label\":\"required\",\"detail\":\"optional\"}]}\nUse 1-6 items.\n\nquestion\n{\"question\":\"required\",\"prompt\":\"optional\"}\n\nvisualGag\n{\"preset\":\"giantReport | absurdScale | redArrow | fakeLoading | spotlight\",\"label\":\"optional\",\"punchline\":\"optional\"}\nUse visualGag only occasionally and only when it supports the explanation.\n\nrecap\n{\"title\":\"optional\",\"points\":[\"2 to 6 concise points\"]}\n\n${assetSceneRules}\n\nIf sources from the supplied material are identifiable, scenes may contain:\n\"sources\":[{\"label\":\"Chapter 2, p. 34\",\"note\":\"Optional clarification\"}]\nDo not invent URLs or source details.\n\nVIDEO DESIGN\nThink in scenes rather than slides.\nPrefer definition for terminology, comparison for contrasts, process for sequential methods, flowchart for decisions and relationships, diagram for connected concepts, timeline for chronology, bigNumber for meaningful figures, kineticText for a short important statement, question for active recall, and recap for consolidation.\n${useAssets?"Use image/document scenes according to the requested asset amount, but only when the asset genuinely improves the explanation or visual variety.":"Create visual variety with the structured scene types above instead of relying on external assets."}\nDo not repeat the narration verbatim in the visual.\nMake transitions between scenes logical so the narration feels like one coherent video rather than disconnected cards.\n\nVALIDATION BEFORE OUTPUT\nBefore returning the file, internally check that:\n1. The root uses version 1.0.\n2. metadata.language is ${language}.\n3. metadata.style is exactly educational-explainer.\n4. targetDuration is exactly ${targetDuration}.\n5. There is at least one chapter and every chapter has at least one scene.\n6. Every chapter ID is unique.\n7. Every scene ID is globally unique.\n8. Every scene uses a supported scene type.\n9. Every visual object contains only fields supported by that scene type.\n10. Every flowchart edge references an existing node.\n${assetValidation}\n14. The project JSON is valid JSON with no comments, trailing commas or placeholders.\n\nOUTPUT\n${outputEnding}\nDo not add an explanation before or after the file.`;
};
