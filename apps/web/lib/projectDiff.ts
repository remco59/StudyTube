import {createHash} from "node:crypto";
import type {StudyTubeProject,StudyTubeScene} from "@studytube/schema";

export type SceneDiffStatus="added"|"removed"|"modified"|"unchanged";
export type SceneDiffEntry={
  sceneId:string;
  chapterId:string;
  chapterTitle:string;
  narrationPreview:string;
  status:SceneDiffStatus;
};
export type ProjectDiffSummary={
  added:number;
  removed:number;
  modified:number;
  unchanged:number;
  entries:SceneDiffEntry[];
};

const hashScene=(scene:StudyTubeScene):string=>createHash("sha256").update(JSON.stringify(scene)).digest("hex");
const narrationPreview=(scene:StudyTubeScene):string=>scene.narration.length>140?`${scene.narration.slice(0,140)}…`:scene.narration;

export const diffStudyTubeProjects=(current:StudyTubeProject,previous:StudyTubeProject):ProjectDiffSummary=>{
  const previousScenes=new Map<string,{scene:StudyTubeScene;chapterId:string;chapterTitle:string}>();
  for(const chapter of previous.chapters){
    for(const scene of chapter.scenes)previousScenes.set(scene.id,{scene,chapterId:chapter.id,chapterTitle:chapter.title});
  }

  const currentSceneIds=new Set<string>();
  const entries:SceneDiffEntry[]=[];

  for(const chapter of current.chapters){
    for(const scene of chapter.scenes){
      currentSceneIds.add(scene.id);
      const match=previousScenes.get(scene.id);
      const status:SceneDiffStatus=!match?"added":hashScene(match.scene)===hashScene(scene)?"unchanged":"modified";
      entries.push({sceneId:scene.id,chapterId:chapter.id,chapterTitle:chapter.title,narrationPreview:narrationPreview(scene),status});
    }
  }

  for(const [sceneId,{scene,chapterId,chapterTitle}] of previousScenes){
    if(currentSceneIds.has(sceneId))continue;
    entries.push({sceneId,chapterId,chapterTitle,narrationPreview:narrationPreview(scene),status:"removed"});
  }

  return {
    added:entries.filter((entry)=>entry.status==="added").length,
    removed:entries.filter((entry)=>entry.status==="removed").length,
    modified:entries.filter((entry)=>entry.status==="modified").length,
    unchanged:entries.filter((entry)=>entry.status==="unchanged").length,
    entries,
  };
};
