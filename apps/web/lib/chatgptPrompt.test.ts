import {describe,expect,it} from "vitest";
import {buildChatGptPrompt} from "./chatgptPrompt";
import {applyTeachingPreset,defaultPromptTeachingConfig} from "./promptConfig";

describe("buildChatGptPrompt asset options",()=>{
  it("forces a text-only JSON project when assets are disabled",()=>{
    const prompt=buildChatGptPrompt({targetDurationMinutes:8,language:"nl-NL",scope:"",useAssets:false});
    expect(prompt).toContain("Assets: disabled (text-only project)");
    expect(prompt).toContain("Return one finished downloadable .studytube.json file");
    expect(prompt).toContain("Do not use image, annotatedImage, video, document or documentHighlight scenes");
    expect(prompt).not.toContain('"assets": {}');
  });

  it("includes selected asset types and qualitative amount when enabled",()=>{
    const prompt=buildChatGptPrompt({
      targetDurationMinutes:8,
      language:"en-US",
      scope:"Chapters 1-3",
      useAssets:true,
      assetTypes:["generated-images","source-documents"],
      assetAmount:"lots",
    });
    expect(prompt).toContain("Return one finished downloadable .studytube.zip file");
    expect(prompt).toContain("Asset types: AI-generated images, source documents/pages");
    expect(prompt).toContain("Asset amount: A lot");
    expect(prompt).toContain("Use assets very frequently throughout the video");
    expect(prompt).toContain('"assets": {},\n  "chapters": []');
    expect(prompt).not.toContain('"assets": {},\\n');
    expect(prompt).toContain("annotatedImage");
    expect(prompt).toContain("workedExample");
    expect(prompt).toContain("quote");
  });

  it("documents and recommends the image scene variants",()=>{
    const prompt=buildChatGptPrompt({
      targetDurationMinutes:5,
      language:"en-US",
      scope:"",
      useAssets:true,
      assetTypes:["generated-images"],
    });
    expect(prompt).toContain('"variant":"full | split-text | split-image"');
    expect(prompt).toContain('"splitRatio":"40/60 | 50/50 | 60/40"');
    expect(prompt).toContain("split-text when an image supports a concise explanation");
    expect(prompt).toContain("split-image for side-by-side comparison");
    expect(prompt).toContain("Prefer fit=contain for portrait, square, screenshot, diagram or infographic assets");
    expect(prompt).toContain("every split-image scene references a valid second image or stockImage asset");
  });

  it("describes provider-backed stock images and video",()=>{
    const prompt=buildChatGptPrompt({
      targetDurationMinutes:5,
      language:"en-US",
      scope:"",
      useAssets:true,
      assetTypes:["web-images","stock-video"],
      assetAmount:"some",
    });
    expect(prompt).toContain("stock images (Pixabay, Pexels or Unsplash)");
    expect(prompt).toContain("stock video (Pixabay or Pexels)");
    expect(prompt).toContain('"type": "stockImage"');
    expect(prompt).toContain('"type": "stockVideo"');
    expect(prompt).toContain('"provider": "auto"');
    expect(prompt).toContain("Unsplash supports stockImage only");
    expect(prompt).toContain("The stock clip audio is muted during rendering");
  });
});

describe("buildChatGptPrompt teaching strategy",()=>{
  it("uses the adaptive balanced teaching defaults",()=>{
    const prompt=buildChatGptPrompt({targetDurationMinutes:8,language:"nl-NL",scope:""});
    expect(prompt).toContain("TEACHING STRATEGY");
    expect(prompt).toContain("Primary explanation method: auto");
    expect(prompt).toContain("Explanation depth: balanced");
    expect(prompt).toContain("Use active-recall questions regularly");
    expect(prompt).toContain("Surface likely misconceptions");
  });

  it("honors a preset and explicit personal-example context",()=>{
    const preset=applyTeachingPreset("deep-understanding");
    const teaching={
      ...preset,
      techniques:{...preset.techniques,personalExamples:true,activeRecall:"off" as const,sectionRecaps:false},
      personalExampleMode:"provided-context" as const,
      personalContext:"I race bicycles and create media productions",
    };
    const prompt=buildChatGptPrompt({targetDurationMinutes:10,language:"en-US",scope:"Chapter 2",teaching});
    expect(prompt).toContain("Primary explanation method: conceptual");
    expect(prompt).toContain("Explanation depth: deep");
    expect(prompt).toContain("I race bicycles and create media productions");
    expect(prompt).toContain("Do not invent any personal details beyond this context");
    expect(prompt).not.toContain("Use active-recall questions regularly");
    expect(prompt).not.toContain("End substantial sections with a short synthesis");
  });

  it("does not invent personal details when known-context personalization is enabled",()=>{
    const teaching={
      ...defaultPromptTeachingConfig,
      techniques:{...defaultPromptTeachingConfig.techniques,personalExamples:true},
    };
    const prompt=buildChatGptPrompt({targetDurationMinutes:6,language:"nl-NL",scope:"",teaching});
    expect(prompt).toContain("only from context the learner has actually shared");
    expect(prompt).toContain("Never invent personal details");
  });
});
