import {mkdtemp,mkdir,readFile,rm,stat,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname,join,resolve} from "node:path";
import {SyntheticWavProvider} from "@studytube/tts";
import {afterEach,describe,expect,it,vi} from "vitest";
import {resolveRendererEntryPoint,runStudyTubeJob,StudyTubeJobCancelledError,StudyTubeJobError} from "./pipeline";

const roots:string[]=[];
const makeRoot=async()=>{const root=await mkdtemp(join(tmpdir(),"studytube-worker-"));roots.push(root);return root;};
afterEach(async()=>{await Promise.all(roots.splice(0).map((root)=>rm(root,{recursive:true,force:true})));});
const noopThumbnail=vi.fn(async()=>undefined);

const writeProject=async(root:string,missingAsset=false,sceneTwoNarration="Daarna volgt automatisch een tweede scene.")=>{
  const sourceDir=join(root,"source");
  await mkdir(join(sourceDir,"assets"),{recursive:true});
  if(!missingAsset) await writeFile(join(sourceDir,"assets","diagram.svg"),"<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
  const project={version:"1.0",metadata:{title:"Pipeline Test",language:"nl-NL",targetDuration:30,style:"educational-explainer"},assets:{diagram:{type:"image",path:"assets/diagram.svg",alt:"Diagram"}},chapters:[{id:"intro",title:"Intro",scenes:[{id:"one",type:"image",narration:"Dit is een test van de automatische renderpipeline.",visual:{assetId:"diagram",fit:"contain"}},{id:"two",type:"kineticText",narration:sceneTwoNarration,visual:{text:"Volledig automatisch"}}]}]};
  const projectPath=join(sourceDir,"pipeline.studytube.json");
  await writeFile(projectPath,JSON.stringify(project));
  return projectPath;
};

describe("resolveRendererEntryPoint",()=>{
  it("uses an explicit container/runtime entry point when configured",()=>{
    expect(resolveRendererEntryPoint({STUDYTUBE_RENDERER_ENTRY:"/app/apps/renderer/src/index.ts"} as NodeJS.ProcessEnv)).toBe(resolve("/app/apps/renderer/src/index.ts"));
  });
});

describe("runStudyTubeJob",()=>{
  it("stages assets and narration and completes a render job",async()=>{
    const root=await makeRoot();
    const projectPath=await writeProject(root);
    const render=vi.fn(async({publicDir,outputPath,props,onProgress})=>{
      expect((await stat(join(publicDir,"assets","diagram.svg"))).isFile()).toBe(true);
      expect((await stat(join(publicDir,"audio","one.wav"))).isFile()).toBe(true);
      expect(props.project.totalFrames).toBeGreaterThan(0);
      expect(props.narration?.one.captions.length).toBeGreaterThan(0);
      await onProgress?.({progress:.5,stage:"rendering"});
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,"fake mp4");
    });

    const result=await runStudyTubeJob({projectPath,dataDir:join(root,"data"),jobId:"job-test",ttsProvider:"synthetic"},{provider:new SyntheticWavProvider(),render,renderThumbnail:noopThumbnail});
    expect(render).toHaveBeenCalledTimes(1);
    const status=await readFile(result.paths.statusFile,"utf8");
    const logs=await readFile(result.paths.logFile,"utf8");
    expect(status).toContain('"state": "completed"');
    expect(logs).toContain("project.reading");
    expect(logs).toContain("render.progress");
    expect(logs).toContain("render.completed");
    expect((await stat(result.outputPath)).isFile()).toBe(true);

    expect(result.status.captions).toBeDefined();
    const srt=await readFile(result.status.captions!.srtPath,"utf8");
    const vtt=await readFile(result.status.captions!.vttPath,"utf8");
    expect(srt).toMatch(/^1\n00:00:00,000 --> /);
    expect(srt).toContain("Dit is een test van de automatische renderpipeline.");
    expect(srt).toContain("Daarna volgt automatisch een tweede scene.");
    expect(vtt).toMatch(/^WEBVTT\n\n00:00:00\.000 --> /);
    const secondCueStart=vtt.split("\n\n")[2]?.split(" --> ")[0];
    expect(secondCueStart).not.toBe("00:00:00.000");
  });

  it("generates a thumbnail from the midpoint of the first scene",async()=>{
    const root=await makeRoot();
    const projectPath=await writeProject(root);
    let firstSceneRange:{startFrame:number;endFrameExclusive:number}|undefined;
    const render=vi.fn(async({outputPath,props}:{outputPath:string;props:{project:{chapters:{scenes:{startFrame:number;endFrameExclusive:number}[]}[]}}})=>{
      firstSceneRange=props.project.chapters[0]?.scenes[0];
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,"fake mp4");
    });
    const renderThumbnail=vi.fn(async({outputPath}:{outputPath:string;frame:number})=>{
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,"fake jpeg");
    });

    const result=await runStudyTubeJob({projectPath,dataDir:join(root,"data"),jobId:"job-thumbnail",ttsProvider:"synthetic"},{provider:new SyntheticWavProvider(),render,renderThumbnail});
    expect(renderThumbnail).toHaveBeenCalledTimes(1);
    const call=renderThumbnail.mock.calls[0]?.[0] as {outputPath:string;frame:number};
    expect(firstSceneRange).toBeDefined();
    expect(call.frame).toBe(Math.floor((firstSceneRange!.startFrame+firstSceneRange!.endFrameExclusive)/2));
    expect(call.outputPath).toBe(result.status.thumbnailPath);
    expect(dirname(call.outputPath)).toBe(result.paths.outputDir);
    expect((await stat(call.outputPath)).isFile()).toBe(true);
  });

  it("does not fail the job when thumbnail generation fails",async()=>{
    const root=await makeRoot();
    const projectPath=await writeProject(root);
    const render=vi.fn(async({outputPath}:{outputPath:string})=>{
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,"fake mp4");
    });
    const renderThumbnail=vi.fn(async()=>{throw new Error("thumbnail renderer crashed");});

    const result=await runStudyTubeJob({projectPath,dataDir:join(root,"data"),jobId:"job-thumbnail-fail",ttsProvider:"synthetic"},{provider:new SyntheticWavProvider(),render,renderThumbnail});
    expect(result.status.state).toBe("completed");
    expect(result.status.thumbnailPath).toBeUndefined();
  });

  it("reports which scene is currently rendering and an ETA",async()=>{
    const root=await makeRoot();
    const projectPath=await writeProject(root);
    const render=vi.fn(async({outputPath,props,onProgress})=>{
      const secondScene=props.project.chapters[0]?.scenes[1];
      await onProgress?.({progress:.7,stage:"rendering",renderedFrames:secondScene?.startFrame});
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,"fake mp4");
    });

    const result=await runStudyTubeJob({projectPath,dataDir:join(root,"data"),jobId:"job-scene-progress",ttsProvider:"synthetic"},{provider:new SyntheticWavProvider(),render,renderThumbnail:noopThumbnail});
    expect(result.status.sceneProgress).toEqual({
      currentSceneId:"two",
      currentSceneIndex:1,
      completedScenes:1,
      totalScenes:2,
      etaSeconds:expect.any(Number),
    });
  });

  it("marks a render as cancelled when its abort signal is triggered",async()=>{
    const root=await makeRoot();
    const projectPath=await writeProject(root);
    const controller=new AbortController();
    const render=vi.fn(async({signal})=>{
      controller.abort();
      expect(signal?.aborted).toBe(true);
      throw new Error("renderMedia() was cancelled");
    });

    await expect(runStudyTubeJob({projectPath,dataDir:join(root,"data"),jobId:"job-cancel",ttsProvider:"synthetic",signal:controller.signal},{provider:new SyntheticWavProvider(),render})).rejects.toBeInstanceOf(StudyTubeJobCancelledError);
    const status=await readFile(join(root,"data","jobs","job-cancel","status.json"),"utf8");
    const logs=await readFile(join(root,"data","jobs","job-cancel","logs.ndjson"),"utf8");
    expect(status).toContain('"state": "cancelled"');
    expect(status).not.toContain('"state": "failed"');
    expect(logs).toContain("job.cancelled");
  });

  it("preserves failed status and logs when an asset cannot be staged",async()=>{
    const root=await makeRoot();
    const projectPath=await writeProject(root,true);
    const render=vi.fn(async()=>undefined);
    await expect(runStudyTubeJob({projectPath,dataDir:join(root,"data"),jobId:"job-fail",ttsProvider:"synthetic"},{provider:new SyntheticWavProvider(),render})).rejects.toBeInstanceOf(StudyTubeJobError);
    expect(render).not.toHaveBeenCalled();
    const status=await readFile(join(root,"data","jobs","job-fail","status.json"),"utf8");
    const logs=await readFile(join(root,"data","jobs","job-fail","logs.ndjson"),"utf8");
    expect(status).toContain('"state": "failed"');
    expect(logs).toContain("job.failed");
  });

  it("fails fast on a wrong-type asset before any narration is synthesized",async()=>{
    const root=await makeRoot();
    const sourceDir=join(root,"source");
    await mkdir(join(sourceDir,"assets"),{recursive:true});
    await writeFile(join(sourceDir,"assets","diagram.svg"),"not actually svg content, but wrong extension below");
    await writeFile(join(sourceDir,"assets","diagram.txt"),"this is not an image");
    const project={version:"1.0",metadata:{title:"Wrong Type Test",language:"nl-NL",targetDuration:30,style:"educational-explainer"},assets:{diagram:{type:"image",path:"assets/diagram.txt"}},chapters:[{id:"intro",title:"Intro",scenes:[{id:"one",type:"image",narration:"Een test scene.",visual:{assetId:"diagram",fit:"contain"}}]}]};
    const projectPath=join(sourceDir,"wrong-type.studytube.json");
    await writeFile(projectPath,JSON.stringify(project));

    const provider=new SyntheticWavProvider();
    const synthesizeSpy=vi.spyOn(provider,"synthesize");
    const render=vi.fn(async()=>undefined);
    await expect(runStudyTubeJob({projectPath,dataDir:join(root,"data"),jobId:"job-wrong-type",ttsProvider:"synthetic"},{provider,render})).rejects.toBeInstanceOf(StudyTubeJobError);
    expect(synthesizeSpy).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
    const logs=await readFile(join(root,"data","jobs","job-wrong-type","logs.ndjson"),"utf8");
    expect(logs).toContain("expected an image file");
  });

  it("reuses an unchanged scene from a base job and only re-renders the scene that changed",async()=>{
    const root=await makeRoot();
    const dataDir=join(root,"data");
    const baseProjectPath=await writeProject(root);
    const fullRender=vi.fn(async({outputPath}:{outputPath:string})=>{
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,"base mp4");
    });
    await runStudyTubeJob({projectPath:baseProjectPath,dataDir,jobId:"job-a",ttsProvider:"synthetic"},{provider:new SyntheticWavProvider(),render:fullRender,renderThumbnail:noopThumbnail});

    const changedProjectPath=await writeProject(root,false,"Dit tweede scene-script is helemaal herschreven.");
    const extractSegment=vi.fn(async(_sourcePath:string,_startFrame:number,_frameCount:number,_fps:number,destPath:string)=>{
      await mkdir(dirname(destPath),{recursive:true});
      await writeFile(destPath,"reused segment");
    });
    const concatenateSegments=vi.fn(async(segmentPaths:string[],destPath:string)=>{
      await mkdir(dirname(destPath),{recursive:true});
      await writeFile(destPath,`concat:${segmentPaths.length}`);
    });
    const incrementalRender=vi.fn(async({outputPath,frameRange,onProgress}:{outputPath:string;frameRange?:[number,number];onProgress?:(progress:{progress:number;stage?:string;renderedFrames?:number})=>void|Promise<void>})=>{
      expect(frameRange).toBeDefined();
      await onProgress?.({progress:1,stage:"rendering",renderedFrames:frameRange?frameRange[1]-frameRange[0]+1:0});
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,"changed scene segment");
    });

    const result=await runStudyTubeJob(
      {projectPath:changedProjectPath,dataDir,jobId:"job-b",ttsProvider:"synthetic",baseJobId:"job-a"},
      {provider:new SyntheticWavProvider(),render:incrementalRender,extractSegment,concatenateSegments,renderThumbnail:noopThumbnail},
    );

    expect(extractSegment).toHaveBeenCalledTimes(1);
    expect(extractSegment.mock.calls[0]?.[1]).toBe(0);
    expect(incrementalRender).toHaveBeenCalledTimes(1);
    expect(concatenateSegments).toHaveBeenCalledTimes(1);
    expect(concatenateSegments.mock.calls[0]?.[0]).toHaveLength(2);
    expect(concatenateSegments.mock.calls[0]?.[1]).toBe(result.outputPath);

    expect(result.status.state).toBe("completed");
    expect((await stat(result.outputPath)).isFile()).toBe(true);
    const logs=await readFile(join(dataDir,"jobs","job-b","logs.ndjson"),"utf8");
    expect(logs).toContain("render.incremental");
    await expect(stat(join(dataDir,"jobs","job-b","segments"))).rejects.toThrow();
  });

  it("falls back to a full render when the base job's output is missing",async()=>{
    const root=await makeRoot();
    const dataDir=join(root,"data");
    const baseProjectPath=await writeProject(root);
    const fullRender=vi.fn(async({outputPath}:{outputPath:string})=>{
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,"base mp4");
    });
    const baseResult=await runStudyTubeJob({projectPath:baseProjectPath,dataDir,jobId:"job-base-missing",ttsProvider:"synthetic"},{provider:new SyntheticWavProvider(),render:fullRender,renderThumbnail:noopThumbnail});
    await rm(baseResult.outputPath,{force:true});

    const secondProjectPath=await writeProject(root);
    const render=vi.fn(async({outputPath}:{outputPath:string})=>{
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,"fallback mp4");
    });
    const result=await runStudyTubeJob(
      {projectPath:secondProjectPath,dataDir,jobId:"job-b-missing",ttsProvider:"synthetic",baseJobId:"job-base-missing"},
      {provider:new SyntheticWavProvider(),render,renderThumbnail:noopThumbnail},
    );

    expect(result.status.state).toBe("completed");
    const logs=await readFile(join(dataDir,"jobs","job-b-missing","logs.ndjson"),"utf8");
    expect(logs).toContain("render.base-unavailable");
  });
});
