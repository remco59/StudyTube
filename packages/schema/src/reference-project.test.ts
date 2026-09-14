import referenceProject from "../../../examples/design-science-15min.studytube.json";
import {describe,expect,it} from "vitest";
import {parseStudyTubeProject} from "./index";

const ALL_SCENE_TYPES=[
  "title",
  "chapterIntro",
  "kineticText",
  "definition",
  "bigNumber",
  "comparison",
  "timeline",
  "process",
  "flowchart",
  "diagram",
  "iconScene",
  "document",
  "documentHighlight",
  "image",
  "question",
  "visualGag",
  "recap",
] as const;

const countWords=(value:string)=>value.trim().split(/\s+/u).filter(Boolean).length;

describe("15-minute reference project",()=>{
  const project=parseStudyTubeProject(referenceProject);
  const scenes=project.chapters.flatMap((chapter)=>chapter.scenes);

  it("stays valid and exercises the complete v1 scene contract",()=>{
    expect(project.metadata.language).toBe("nl-NL");
    expect(project.metadata.targetDuration).toBe(900);
    expect(scenes).toHaveLength(47);
    expect(new Set(scenes.map((scene)=>scene.type))).toEqual(new Set(ALL_SCENE_TYPES));
  });

  it("contains enough spoken material for a substantial study video",()=>{
    const words=scenes.reduce((total,scene)=>total+countWords(scene.narration),0);
    expect(words).toBeGreaterThanOrEqual(2100);
    expect(words).toBeLessThanOrEqual(2450);
  });

  it("keeps visual gags occasional and chapter recaps recurring",()=>{
    const visualGags=scenes.filter((scene)=>scene.type==="visualGag");
    const recaps=scenes.filter((scene)=>scene.type==="recap");
    expect(visualGags.length).toBeLessThanOrEqual(4);
    expect(recaps.length).toBeGreaterThanOrEqual(4);
  });
});
