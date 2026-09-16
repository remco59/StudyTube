import {describe,expect,it} from "vitest";
import {buildChatGptPrompt} from "./chatgptPrompt";

describe("buildChatGptPrompt asset options",()=>{
  it("forces a text-only JSON project when assets are disabled",()=>{
    const prompt=buildChatGptPrompt({targetDurationMinutes:8,language:"nl-NL",scope:"",useAssets:false});
    expect(prompt).toContain("Assets: disabled (text-only project)");
    expect(prompt).toContain("Return one finished downloadable .studytube.json file");
    expect(prompt).toContain("Do not use image, document or documentHighlight scenes");
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
  });
});
