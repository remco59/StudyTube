import {createHash} from "node:crypto";
import type {NormalizedStudyTubeProject} from "@studytube/core";
import type {StudyTubeScene} from "@studytube/schema";

export type SceneManifestEntry={id:string;contentHash:string;startFrame:number;endFrameExclusive:number};

export type SceneManifest={
  fps:number;
  ttsProvider:string;
  ttsSettingsSignature:string;
  renderEngine:string;
  scenes:SceneManifestEntry[];
};

export type SceneRun={
  kind:"render"|"reuse";
  sceneIds:string[];
  startFrame:number;
  endFrameExclusive:number;
  baseStartFrame?:number;
  baseEndFrameExclusive?:number;
};

export const hashJson=(value:unknown):string=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const hashScene=(scene:StudyTubeScene):string=>hashJson(scene);

export const buildSceneManifest=(
  normalizedProject:NormalizedStudyTubeProject,
  options:{ttsProvider:string;ttsSettingsSignature:string;renderEngine:string},
):SceneManifest=>({
  fps:normalizedProject.fps,
  ttsProvider:options.ttsProvider,
  ttsSettingsSignature:options.ttsSettingsSignature,
  renderEngine:options.renderEngine,
  scenes:normalizedProject.chapters.flatMap((chapter)=>chapter.scenes).map((scene)=>({
    id:scene.scene.id,
    contentHash:hashScene(scene.scene),
    startFrame:scene.startFrame,
    endFrameExclusive:scene.endFrameExclusive,
  })),
});

// Returns null when the base render is incompatible or shares no unchanged scene with the current one.
export const planSceneRuns=(current:SceneManifest,base:SceneManifest|undefined|null):SceneRun[]|null=>{
  if(!base)return null;
  if(base.fps!==current.fps||base.ttsProvider!==current.ttsProvider||base.ttsSettingsSignature!==current.ttsSettingsSignature||base.renderEngine!==current.renderEngine)return null;

  const baseById=new Map(base.scenes.map((scene)=>[scene.id,scene]));
  const reusable=current.scenes.map((scene)=>{
    const match=baseById.get(scene.id);
    if(!match||match.contentHash!==scene.contentHash)return false;
    return (match.endFrameExclusive-match.startFrame)===(scene.endFrameExclusive-scene.startFrame);
  });
  if(!reusable.some(Boolean))return null;

  const runs:SceneRun[]=[];
  for(const [index,scene] of current.scenes.entries()){
    const isReuse=reusable[index];
    const last=runs.at(-1);
    if(last&&(last.kind==="reuse")===isReuse){
      last.sceneIds.push(scene.id);
      last.endFrameExclusive=scene.endFrameExclusive;
      if(isReuse)last.baseEndFrameExclusive=baseById.get(scene.id)?.endFrameExclusive;
      continue;
    }
    const match=isReuse?baseById.get(scene.id):undefined;
    runs.push({
      kind:isReuse?"reuse":"render",
      sceneIds:[scene.id],
      startFrame:scene.startFrame,
      endFrameExclusive:scene.endFrameExclusive,
      ...(match?{baseStartFrame:match.startFrame,baseEndFrameExclusive:match.endFrameExclusive}:{}),
    });
  }
  return runs;
};
