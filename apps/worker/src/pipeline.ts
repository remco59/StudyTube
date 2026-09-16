import {randomUUID} from "node:crypto";
import {copyFile,mkdir,readFile,writeFile} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import type {NarrationManifest,NormalizedStudyTubeProject} from "@studytube/core";
import {parseStudyTubeProject} from "@studytube/schema";
import {
  EdgeTtsHttpProvider,
  getDutchPiperConfig,
  getEdgeTtsConfig,
  NarrationAudioCache,
  PiperHttpProvider,
  prepareProjectNarration,
  SyntheticWavProvider,
  type TtsProvider,
} from "@studytube/tts";
import {appendJobLog,createJobPaths,initializeJobPaths,writeJobStatus} from "./jobStore";
import {normalizeRelativeProjectPath,resolveInside} from "./pathSafety";
import {parseRenderEngine,renderEngineLabels} from "./renderEngine";
import {renderStudyTubeComposition} from "./remotionRender";
import type {JobPaths,JobState,RenderEngine,RenderProgress,StudyTubeJobStatus} from "./types";

export type StudyTubeRenderProps={
  project:NormalizedStudyTubeProject;
  narration?:NarrationManifest;
  showCaptions?:boolean;
};

export type PipelineRenderFunction=(options:{
  entryPoint:string;
  publicDir:string;
  outputPath:string;
  props:StudyTubeRenderProps;
  renderEngine?:RenderEngine;
  signal?:AbortSignal;
  onProgress?:(progress:RenderProgress)=>void|Promise<void>;
})=>Promise<void>;

export type TtsProviderKind="edge"|"piper"|"synthetic";

export type RunStudyTubeJobOptions={
  projectPath:string;
  dataDir?:string;
  jobId?:string;
  ttsProvider?:TtsProviderKind;
  renderEngine?:RenderEngine;
  showCaptions?:boolean;
  fps?:number;
  scenePaddingSeconds?:number;
  signal?:AbortSignal;
};

export type PipelineDependencies={
  provider?:TtsProvider;
  render?:PipelineRenderFunction;
  now?:()=>Date;
};

export type StudyTubeJobResult={jobId:string;paths:JobPaths;status:StudyTubeJobStatus;outputPath:string};

export class StudyTubeJobError extends Error{
  readonly jobId:string;
  readonly jobDir:string;
  constructor(jobId:string,jobDir:string,cause:unknown){
    super(`StudyTube job ${jobId} failed: ${cause instanceof Error?cause.message:String(cause)}`,{cause});
    this.name="StudyTubeJobError";this.jobId=jobId;this.jobDir=jobDir;
  }
}

export class StudyTubeJobCancelledError extends Error{
  readonly jobId:string;
  readonly jobDir:string;
  constructor(jobId:string,jobDir:string,cause?:unknown){
    super(`StudyTube job ${jobId} was cancelled`,cause===undefined?undefined:{cause});
    this.name="StudyTubeJobCancelledError";this.jobId=jobId;this.jobDir=jobDir;
  }
}

export const resolveRendererEntryPoint=(env:NodeJS.ProcessEnv=process.env,metaUrl=import.meta.url):string=>{
  const configured=env.STUDYTUBE_RENDERER_ENTRY?.trim();
  if(configured)return resolve(configured);
  const repoRoot=resolve(fileURLToPath(new URL("../../..",metaUrl)));
  return join(repoRoot,"apps","renderer","src","index.ts");
};

export const resolveTtsProviderKind=(value?:string):TtsProviderKind=>{
  const normalized=(value?.trim().toLowerCase()||"edge");
  if(normalized==="edge"||normalized==="piper"||normalized==="synthetic")return normalized;
  throw new Error(`Unsupported STUDYTUBE_TTS_PROVIDER "${value}". Use edge, piper or synthetic.`);
};

export const runStudyTubeJob=async(options:RunStudyTubeJobOptions,deps:PipelineDependencies={}):Promise<StudyTubeJobResult>=>{
  const now=deps.now??(()=>new Date());
  const jobId=options.jobId??createJobId(now());
  const dataDir=resolve(options.dataDir??process.env.STUDYTUBE_DATA_DIR??"data");
  const renderEngine=parseRenderEngine(options.renderEngine);
  const paths=createJobPaths(dataDir,jobId);
  const createdAt=now().toISOString();
  let status:StudyTubeJobStatus={jobId,state:"queued",progress:0,createdAt,updatedAt:createdAt,renderEngine};
  let statusQueue=Promise.resolve();
  let logQueue=Promise.resolve();

  const update=(state:JobState,progress:number,extra:Partial<StudyTubeJobStatus>={})=>{
    status={...status,...extra,state,progress:clamp(progress),updatedAt:now().toISOString()};
    const snapshot={...status};
    statusQueue=statusQueue.then(()=>writeJobStatus(paths,snapshot));
    return statusQueue;
  };
  const log=(event:string,message:string,data?:unknown)=>{
    logQueue=logQueue.then(()=>appendJobLog(paths,event,message,data));
    return logQueue;
  };
  const checkCancelled=()=>{
    if(options.signal?.aborted)throw new Error("Render cancelled");
  };

  await initializeJobPaths(paths);
  await writeJobStatus(paths,status);
  await log("job.created","Render job created",{projectPath:options.projectPath,renderEngine});

  try{
    checkCancelled();
    await update("validating",.03);
    await log("project.reading","Reading and analyzing StudyTube project");
    const sourceProjectPath=resolve(options.projectPath);
    const raw=await readFile(sourceProjectPath,"utf8");
    checkCancelled();
    const project=parseStudyTubeProject(JSON.parse(raw));
    await writeFile(paths.projectFile,`${JSON.stringify(project,null,2)}\n`,`utf8`);
    await update("validating",.08,{projectTitle:project.metadata.title});
    await log("project.validated","Project JSON validated",{title:project.metadata.title,chapters:project.chapters.length,scenes:project.chapters.reduce((count,chapter)=>count+chapter.scenes.length,0)});

    checkCancelled();
    await update("synthesizing",.1);
    const providerKind=resolveTtsProviderKind(options.ttsProvider??process.env.STUDYTUBE_TTS_PROVIDER);
    await log("narration.started","Generating narration audio",{provider:providerKind});
    const provider=deps.provider??createProvider(providerKind);
    const cache=new NarrationAudioCache(join(dataDir,"cache","tts"),provider);
    const narrationOverrides=providerKind==="piper"?getPiperNarrationOverrides():{};
    const prepared=await prepareProjectNarration(project,cache,{
      fps:options.fps,
      scenePaddingSeconds:options.scenePaddingSeconds,
      language:project.metadata.language,
      ...narrationOverrides,
    });
    checkCancelled();
    await update("staging",.35);
    await log("narration.ready","Narration synthesized and measured",{scenes:Object.keys(prepared.tracks).length,provider:provider.id});

    await log("assets.staging","Preparing project assets and narration for the renderer",{assets:Object.keys(project.assets??{}).length});
    const sourceRoot=dirname(sourceProjectPath);
    await stageProjectAssets(project.assets??{},sourceRoot,paths.publicDir);
    checkCancelled();
    const narration=await stageNarration(prepared.tracks,paths.publicDir);
    checkCancelled();
    const props:StudyTubeRenderProps={project:prepared.normalizedProject,narration,showCaptions:options.showCaptions??true};
    await writeFile(paths.renderPropsFile,`${JSON.stringify(props,null,2)}\n`,`utf8`);

    const outputName=`${slugify(project.metadata.title)||"studytube"}-${jobId}.mp4`;
    const outputPath=join(paths.outputDir,outputName);
    await update("bundling",.4);
    await log("render.started","Building renderer and starting MP4 render",{frames:prepared.normalizedProject.totalFrames,renderEngine,label:renderEngineLabels[renderEngine]});
    checkCancelled();
    const entryPoint=resolveRendererEntryPoint();
    const render=deps.render??renderStudyTubeComposition;
    let lastRenderBucket=-1;
    let lastRenderStage="";
    await render({
      entryPoint,
      publicDir:paths.publicDir,
      outputPath,
      props,
      renderEngine,
      signal:options.signal,
      onProgress:({progress,stage})=>{
        if(options.signal?.aborted)return;
        const safeProgress=clamp(progress);
        const state=stage==="bundling"?"bundling":"rendering";
        const mapped=.4+safeProgress*.58;
        void update(state,mapped);
        const bucket=Math.floor(safeProgress*10)*10;
        const stageName=stage??state;
        if(bucket>lastRenderBucket||stageName!==lastRenderStage){
          lastRenderBucket=bucket;
          lastRenderStage=stageName;
          void log("render.progress",`${stageName==="bundling"?"Bundling":"Rendering"} video: ${Math.min(100,bucket)}%`,{stage:stageName,progress:safeProgress,renderEngine});
        }
      },
    });
    checkCancelled();
    await Promise.all([statusQueue,logQueue]);

    await log("render.completed","MP4 render completed",{outputPath,totalFrames:prepared.normalizedProject.totalFrames,renderEngine});
    await update("completed",1,{outputPath});
    await Promise.all([statusQueue,logQueue]);
    return {jobId,paths,status,outputPath};
  }catch(error){
    if(options.signal?.aborted){
      await log("job.cancelled","Render cancelled by user").catch(()=>undefined);
      await update("cancelled",status.progress,{error:undefined}).catch(()=>undefined);
      await Promise.all([statusQueue.catch(()=>undefined),logQueue.catch(()=>undefined)]);
      throw new StudyTubeJobCancelledError(jobId,paths.root,error);
    }
    const message=error instanceof Error?error.message:String(error);
    await log("job.failed",message).catch(()=>undefined);
    await update("failed",status.progress,{error:message}).catch(()=>undefined);
    await Promise.all([statusQueue.catch(()=>undefined),logQueue.catch(()=>undefined)]);
    throw new StudyTubeJobError(jobId,paths.root,error);
  }
};

const createProvider=(kind:TtsProviderKind):TtsProvider=>{
  if(kind==="synthetic")return new SyntheticWavProvider();
  if(kind==="edge"){
    const config=getEdgeTtsConfig();
    return new EdgeTtsHttpProvider({baseUrl:config.baseUrl,defaultVoice:config.voice,defaultRate:config.rate});
  }
  const config=getDutchPiperConfig();
  return new PiperHttpProvider({baseUrl:config.baseUrl,defaultVoice:config.voice,defaultLanguage:config.language,defaultLengthScale:config.lengthScale});
};

const getPiperNarrationOverrides=()=>{
  const config=getDutchPiperConfig();
  return {voice:config.voice,lengthScale:config.lengthScale};
};

const stageProjectAssets=async(assets:Record<string,{path:string}>,sourceRoot:string,publicDir:string)=>{
  for(const [assetId,asset] of Object.entries(assets)){
    const relative=normalizeRelativeProjectPath(asset.path);
    const source=resolveInside(sourceRoot,relative);
    const destination=resolveInside(publicDir,relative);
    await mkdir(dirname(destination),{recursive:true});
    try{await copyFile(source,destination);}catch(error){throw new Error(`Could not stage asset ${assetId} (${relative}): ${error instanceof Error?error.message:String(error)}`);}
  }
};

const stageNarration=async(
  tracks:Record<string,{cachePath:string;durationSeconds:number;captions:NarrationManifest[string]["captions"]}>,
  publicDir:string,
):Promise<NarrationManifest>=>{
  const manifest:NarrationManifest={};
  for(const [sceneId,track] of Object.entries(tracks)){
    const safeName=`${sceneId}.wav`;
    const relative=join("audio",safeName).replaceAll("\\","/");
    const destination=resolveInside(publicDir,relative);
    await mkdir(dirname(destination),{recursive:true});
    await copyFile(track.cachePath,destination);
    manifest[sceneId]={sourcePath:relative,durationSeconds:track.durationSeconds,captions:track.captions};
  }
  return manifest;
};

const createJobId=(date:Date)=>`${date.toISOString().replaceAll(":","").replaceAll(".","-")}-${randomUUID().slice(0,8)}`;
const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/gu,"-").replace(/^-+|-+$/gu,"").slice(0,70);
const clamp=(value:number)=>Math.min(1,Math.max(0,value));
