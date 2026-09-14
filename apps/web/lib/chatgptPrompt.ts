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

Return the finished result as a valid .studytube.json project that can be imported directly into StudyTube.

VIDEO SETTINGS
- Language: ${language} (${languageNames[language]})
- Target duration: ${targetDuration} seconds (about ${targetDurationMinutes} minutes)
- Style: educational-explainer
- ${scopeInstruction}

CONTENT REQUIREMENTS
- Base the video only on the supplied study material.
- Explain concepts clearly at higher-education level.
- Prioritize understanding over reproducing the wording of the source.
- Preserve important terminology from the source.
- Explain difficult concepts with examples, comparisons or visual structures where useful.
- Do not invent facts that are not supported by the material.
- Structure the video into logical chapters.
- Start with an engaging introduction.
- End important sections with short recaps where useful.
- End the complete video with a recap of the main learning points.
- Use questions occasionally to encourage active recall.
- Keep on-screen text concise. Narration may contain more explanation than the visual.
- Vary the visual presentation. Do not make every scene a title card or bullet list.
- Write narration as natural spoken ${languageNames[language]}, not academic written prose.
- Aim for approximately 130-160 spoken words per minute.

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
  "chapters": []
}

assets is optional. Do not create image or document assets unless I explicitly provide usable asset paths for StudyTube.

All chapter IDs, scene IDs and flowchart node IDs must contain only letters, numbers, hyphens or underscores and must be unique where required.

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
{"left":{"title":"required","body":"optional","icon":"optional"},"right":{"title":"required","body":"optional","icon":"optional"},"versusLabel":"optional"}

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

Only use these scene types when valid StudyTube assets have explicitly been supplied:

image
{"assetId":"existing image asset ID","fit":"contain | cover","caption":"optional"}

document
{"assetId":"existing document asset ID","page":1,"caption":"optional"}

documentHighlight
{"assetId":"existing document asset ID","page":1,"highlightText":"required","caption":"optional"}

If sources from the supplied material are identifiable, scenes may contain:
"sources":[{"label":"Chapter 2, p. 34","note":"Optional clarification"}]
Do not invent URLs.

VIDEO DESIGN
Think in scenes rather than slides.
Prefer definition for terminology, comparison for contrasts, process for sequential methods, flowchart for decisions and relationships, diagram for connected concepts, timeline for chronology, bigNumber for meaningful figures, kineticText for a short important statement, question for active recall, and recap for consolidation.
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
11. No image or document scene references a nonexistent asset.
12. The output is valid JSON with no comments, trailing commas or placeholders.

OUTPUT
Return only the final valid JSON.
Do not put it inside a Markdown code block.
Do not add an explanation before or after it.
Do not include notes outside the JSON.
The result must be ready to save directly as a .studytube.json file.`;
};
