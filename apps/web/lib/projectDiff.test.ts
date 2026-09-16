import type {StudyTubeProject} from "@studytube/schema";
import {describe,expect,it} from "vitest";
import {diffStudyTubeProjects} from "./projectDiff";

const project=(scenes:{id:string;narration:string}[]):StudyTubeProject=>({
  version:"1.0",
  metadata:{title:"Diff Test",language:"nl-NL",targetDuration:30,style:"educational-explainer"},
  chapters:[{id:"intro",title:"Intro",scenes:scenes.map((scene)=>({id:scene.id,type:"kineticText",narration:scene.narration,visual:{text:scene.narration}}))}],
} as unknown as StudyTubeProject);

describe("diffStudyTubeProjects",()=>{
  it("marks every scene unchanged when nothing differs",()=>{
    const current=project([{id:"one",narration:"Hello"},{id:"two",narration:"World"}]);
    const previous=project([{id:"one",narration:"Hello"},{id:"two",narration:"World"}]);
    const diff=diffStudyTubeProjects(current,previous);
    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
    expect(diff.modified).toBe(0);
    expect(diff.unchanged).toBe(2);
    expect(diff.entries.every((entry)=>entry.status==="unchanged")).toBe(true);
  });

  it("detects a scene whose narration changed",()=>{
    const current=project([{id:"one",narration:"Hello there"},{id:"two",narration:"World"}]);
    const previous=project([{id:"one",narration:"Hello"},{id:"two",narration:"World"}]);
    const diff=diffStudyTubeProjects(current,previous);
    expect(diff.modified).toBe(1);
    expect(diff.unchanged).toBe(1);
    const modifiedEntry=diff.entries.find((entry)=>entry.sceneId==="one");
    expect(modifiedEntry?.status).toBe("modified");
  });

  it("detects added and removed scenes",()=>{
    const current=project([{id:"one",narration:"Hello"},{id:"three",narration:"New scene"}]);
    const previous=project([{id:"one",narration:"Hello"},{id:"two",narration:"World"}]);
    const diff=diffStudyTubeProjects(current,previous);
    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
    expect(diff.unchanged).toBe(1);
    expect(diff.entries.find((entry)=>entry.sceneId==="three")?.status).toBe("added");
    expect(diff.entries.find((entry)=>entry.sceneId==="two")?.status).toBe("removed");
  });

  it("truncates long narration in the preview text",()=>{
    const longNarration="a".repeat(200);
    const current=project([{id:"one",narration:longNarration}]);
    const previous=project([]);
    const diff=diffStudyTubeProjects(current,previous);
    const entry=diff.entries.find((item)=>item.sceneId==="one");
    expect(entry?.narrationPreview.length).toBe(141);
    expect(entry?.narrationPreview.endsWith("…")).toBe(true);
  });
});
