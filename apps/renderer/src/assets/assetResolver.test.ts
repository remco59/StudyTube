import {describe,expect,it} from "vitest";
import {normalizeProjectAssetPath,resolveProjectAsset,StudyTubeAssetError} from "./assetResolver";

const project={version:"1.0" as const,metadata:{title:"Assets",language:"nl-NL",targetDuration:60,style:"educational-explainer" as const},assets:{hero:{type:"image" as const,path:"assets/hero.svg",alt:"Hero"},paper:{type:"document" as const,path:"documents/paper.pdf",title:"Paper"}},chapters:[]};

describe("project asset paths",()=>{
  it("normalizes safe relative paths",()=>{expect(normalizeProjectAssetPath("./assets/hero.svg")).toBe("assets/hero.svg");});
  it.each(["../secret.png","/absolute/file.png","https://example.com/a.png","assets\\hero.png","assets//hero.png"])("rejects unsafe path %s",(path)=>{expect(()=>normalizeProjectAssetPath(path)).toThrow(StudyTubeAssetError);});
});

describe("resolveProjectAsset",()=>{
  it("resolves a typed project asset",()=>{const asset=resolveProjectAsset(project,"hero","image");expect(asset.id).toBe("hero");expect(asset.path).toBe("assets/hero.svg");});
  it("rejects missing or mismatched assets",()=>{expect(()=>resolveProjectAsset(project,"missing")).toThrow("Unknown project asset");expect(()=>resolveProjectAsset(project,"paper","image")).toThrow("expected image");});
});
