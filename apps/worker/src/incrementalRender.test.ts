import {describe,expect,it} from "vitest";
import {buildSceneManifest,planSceneRuns,type SceneManifest} from "./incrementalRender";

const manifest=(scenes:{id:string;contentHash:string;frames:number}[],overrides:Partial<SceneManifest>={}):SceneManifest=>{
  let cursor=0;
  const entries=scenes.map((scene)=>{
    const startFrame=cursor;cursor+=scene.frames;
    return {id:scene.id,contentHash:scene.contentHash,startFrame,endFrameExclusive:cursor};
  });
  return {fps:30,ttsProvider:"edge",ttsSettingsSignature:"sig",renderEngine:"cpu",scenes:entries,...overrides};
};

describe("buildSceneManifest",()=>{
  it("captures a stable content hash and frame range per scene",()=>{
    const normalizedProject={
      fps:30,
      chapters:[{scenes:[
        {scene:{id:"one",type:"title",narration:"Hello"},startFrame:0,endFrameExclusive:30},
        {scene:{id:"two",type:"title",narration:"World"},startFrame:30,endFrameExclusive:60},
      ]}],
    } as unknown as Parameters<typeof buildSceneManifest>[0];

    const result=buildSceneManifest(normalizedProject,{ttsProvider:"edge",ttsSettingsSignature:"sig",renderEngine:"cpu"});
    expect(result.scenes).toEqual([
      {id:"one",contentHash:expect.any(String),startFrame:0,endFrameExclusive:30},
      {id:"two",contentHash:expect.any(String),startFrame:30,endFrameExclusive:60},
    ]);
    expect(result.scenes[0]?.contentHash).not.toBe(result.scenes[1]?.contentHash);

    const rebuilt=buildSceneManifest(normalizedProject,{ttsProvider:"edge",ttsSettingsSignature:"sig",renderEngine:"cpu"});
    expect(rebuilt.scenes[0]?.contentHash).toBe(result.scenes[0]?.contentHash);
  });
});

describe("planSceneRuns",()=>{
  it("returns null when there is no base render to compare against",()=>{
    const current=manifest([{id:"one",contentHash:"a",frames:30}]);
    expect(planSceneRuns(current,undefined)).toBeNull();
  });

  it("returns null when the base render used different settings",()=>{
    const current=manifest([{id:"one",contentHash:"a",frames:30}]);
    const base=manifest([{id:"one",contentHash:"a",frames:30}],{ttsProvider:"piper"});
    expect(planSceneRuns(current,base)).toBeNull();
  });

  it("returns null when no scene can be reused",()=>{
    const current=manifest([{id:"one",contentHash:"a",frames:30}]);
    const base=manifest([{id:"one",contentHash:"b",frames:30}]);
    expect(planSceneRuns(current,base)).toBeNull();
  });

  it("returns null when a scene's duration changed even if its content hash matches",()=>{
    const current=manifest([{id:"one",contentHash:"a",frames:45}]);
    const base=manifest([{id:"one",contentHash:"a",frames:30}]);
    expect(planSceneRuns(current,base)).toBeNull();
  });

  it("groups contiguous unchanged and changed scenes into runs",()=>{
    const current=manifest([
      {id:"one",contentHash:"a",frames:30},
      {id:"two",contentHash:"changed",frames:30},
      {id:"three",contentHash:"c",frames:30},
      {id:"four",contentHash:"d",frames:30},
    ]);
    const base=manifest([
      {id:"one",contentHash:"a",frames:30},
      {id:"two",contentHash:"b",frames:30},
      {id:"three",contentHash:"c",frames:30},
      {id:"four",contentHash:"d",frames:30},
    ]);

    const runs=planSceneRuns(current,base);
    expect(runs).toEqual([
      {kind:"reuse",sceneIds:["one"],startFrame:0,endFrameExclusive:30,baseStartFrame:0,baseEndFrameExclusive:30},
      {kind:"render",sceneIds:["two"],startFrame:30,endFrameExclusive:60},
      {kind:"reuse",sceneIds:["three","four"],startFrame:60,endFrameExclusive:120,baseStartFrame:60,baseEndFrameExclusive:120},
    ]);
  });

  it("treats a scene missing from the base render as changed",()=>{
    const current=manifest([
      {id:"one",contentHash:"a",frames:30},
      {id:"new-scene",contentHash:"z",frames:30},
    ]);
    const base=manifest([{id:"one",contentHash:"a",frames:30}]);
    const runs=planSceneRuns(current,base);
    expect(runs).toEqual([
      {kind:"reuse",sceneIds:["one"],startFrame:0,endFrameExclusive:30,baseStartFrame:0,baseEndFrameExclusive:30},
      {kind:"render",sceneIds:["new-scene"],startFrame:30,endFrameExclusive:60},
    ]);
  });
});
