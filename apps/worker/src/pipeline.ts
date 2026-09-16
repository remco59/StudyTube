import {randomUUID} from "node:crypto";
import {access,copyFile,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {buildGlobalCaptionCues,captionCuesToSrt,captionCuesToVtt,type NarrationManifest,type NormalizedScene,type NormalizedStudyTubeProject} from "@studytube/core";
import {parseStudyTubeProject} from "@studytube/schema";
import {validateProjectAssets} from "./assetValidation";
import {buildSceneManifest,hashJson,planSceneRuns,type SceneManifest,type SceneRun} from "./incrementalRender";
import {
  AzureSpeechHttpProvider,
  ChatterboxHttpProvider,
  EdgeTtsHttpProvider,
  getDutchPiperConfig,
  getEdgeTtsConfig,
  getOmniVoiceConfig,
  GoogleChirpHttpProvider,
  NarrationAudioCache,
  OmniVoiceHttpProvider,
  PiperHttpProvider,
  prepareProjectNarration,
  SyntheticWavProvider,
  XttsHttpProvider,
  type TtsProvider,
} from "@studytube/tts";
import {appendJobLog,createJobPaths,initializeJobPaths,writeJobStatus} from "./jobStore";
import {normalizeRelativeProjectPath,resolveInside} from "./pathSafety";
import {parseRenderEngine,renderEngineLabels} from "./renderEngine";
import {renderStudyTubeComposition,renderStudyTubeThumbnail} from "./remotionRender";
import {concatenateSegments,extractSegment} from "./segmentEncoder";
import type {JobPaths,JobState,RenderEngine,RenderProgress,SceneProgress,StudyTubeJobStatus} from "./types";

export type StudyTubeRenderProps={project:NormalizedStudyTubeProject;narration?:NarrationManifest;showCaptions?:boolean};
export type PipelineRenderFunction=(options:{entryPoint:string;publicDir:string;outputPath:string;props:StudyTubeRenderProps;renderEngine?:RenderEngine;frameRange?:[number,number];signal?:AbortSignal;onProgress?:(progress:RenderProgress)=>void|Promise<void>})=>Promise<void>;
export type PipelineThumbnailFunction=(options:{entryPoint:string;publicDir:string;outputPath:string;props:StudyTubeRenderProps;frame:number;signal?:AbortSignal})=>Promise<void>;

export type TtsProviderKind="edge"|"piper"|"omnivoice"|"chatterbox"|"xtts"|"google-chirp"|"azure"|"synthetic";
export type TtsJobSettings={
  edge?:{voice?:string;rate?:string};
  piper?:{voice?:string;lengthScale?:number};
  omnivoice?:{speed?:number;numSteps?:number;instruction?:string;normalizeText?:boolean;referenceAudioPath?:string;referenceText?:string};
  chatterbox?:{t3Model?:"v2"|"v3";exaggeration?:number;cfgWeight?:number;temperature?:number;referenceAudioPath?:string};
  xtts?:{speaker?:string;speed?:number;referenceAudioPath?:string};
  googleChirp?:{voice?:string};
  azure?:{voice?:string};
};

export type RunStudyTubeJobOptions={projectPath:string;dataDir?:string;jobId?:string;ttsProvider?:TtsProviderKind;ttsSettings?:TtsJobSettings;renderEngine?:RenderEngine;showCaptions?:boolean;fps?:number;scenePaddingSeconds?:number;signal?:AbortSignal;baseJobId?:string};
export type PipelineDependencies={
  provider?:TtsProvider;
  render?:PipelineRenderFunction;
  renderThumbnail?:PipelineThumbnailFunction;
  now?:()=>Date;
  extractSegment?:typeof extractSegment;
  concatenateSegments?:typeof concatenateSegments;
};
export type StudyTubeJobResult={jobId:string;paths:JobPaths;status:StudyTubeJobStatus;outputPath:string};

export class StudyTubeJobError extends Error{readonly jobId:string;readonly jobDir:string;constructor(jobId:string,jobDir:string,cause:unknown){super(`StudyTube job ${jobId} failed: ${cause instanceof Error?cause.message:String(cause)}`,{cause});this.name="StudyTubeJobError";this.jobId=jobId;this.jobDir=jobDir;}}
export class StudyTubeJobCancelledError extends Error{readonly jobId:string;readonly jobDir:string;constructor(jobId:string,jobDir:string,cause?:unknown){super(`StudyTube job ${jobId} was cancelled`,cause===undefined?undefined:{cause});this.name="StudyTubeJobCancelledError";this.jobId=jobId;this.jobDir=jobDir;}}

export const resolveRendererEntryPoint=(env:NodeJS.ProcessEnv=process.env,metaUrl=import.meta.url):string=>{const configured=env.STUDYTUBE_RENDERER_ENTRY?.trim();if(configured)return resolve(configured);const repoRoot=resolve(fileURLToPath(new URL("../../..",metaUrl)));return join(repoRoot,"apps","renderer","src","index.ts");};
export const resolveTtsProviderKind=(value?:string):TtsProviderKind=>{const normalized=(value?.trim().toLowerCase()||"edge");if(["edge","piper","omnivoice","chatterbox","xtts","google-chirp","azure","synthetic"].includes(normalized))return normalized as TtsProviderKind;throw new Error(`Unsupported STUDYTUBE_TTS_PROVIDER "${value}".`);};

export const runStudyTubeJob=async(options:RunStudyTubeJobOptions,deps:PipelineDependencies={}):Promise<StudyTubeJobResult>=>{
  const now=deps.now??(()=>new Date());
  const jobId=options.jobId??createJobId(now());
  const dataDir=resolve(options.dataDir??process.env.STUDYTUBE_DATA_DIR??"data");
  const renderEngine=parseRenderEngine(options.renderEngine);
  const providerKind=resolveTtsProviderKind(options.ttsProvider??process.env.STUDYTUBE_TTS_PROVIDER);
  const paths=createJobPaths(dataDir,jobId);
  const createdAt=now().toISOString();
  let status:StudyTubeJobStatus={jobId,state:"queued",progress:0,createdAt,updatedAt:createdAt,renderEngine,ttsProvider:providerKind,...(options.baseJobId?{baseJobId:options.baseJobId}:{})};
  let statusQueue=Promise.resolve();let logQueue=Promise.resolve();
  const update=(state:JobState,progress:number,extra:Partial<StudyTubeJobStatus>={})=>{status={...status,...extra,state,progress:clamp(progress),updatedAt:now().toISOString()};const snapshot={...status};statusQueue=statusQueue.then(()=>writeJobStatus(paths,snapshot));return statusQueue;};
  const log=(event:string,message:string,data?:unknown)=>{logQueue=logQueue.then(()=>appendJobLog(paths,event,message,data));return logQueue;};
  const checkCancelled=()=>{if(options.signal?.aborted)throw new Error("Render cancelled");};

  await initializeJobPaths(paths);await writeJobStatus(paths,status);await log("job.created","Render job created",{projectPath:options.projectPath,renderEngine,ttsProvider:providerKind});
  try{
    checkCancelled();await update("validating",.03);await log("project.reading","Reading and analyzing StudyTube project");
    const sourceProjectPath=resolve(options.projectPath);const raw=await readFile(sourceProjectPath,"utf8");checkCancelled();const project=parseStudyTubeProject(JSON.parse(raw));
    await writeFile(paths.projectFile,`${JSON.stringify(project,null,2)}\n`,`utf8`);await update("validating",.08,{projectTitle:project.metadata.title});await log("project.validated","Project JSON validated",{title:project.metadata.title,chapters:project.chapters.length,scenes:project.chapters.reduce((count,chapter)=>count+chapter.scenes.length,0)});

    const sourceRoot=dirname(sourceProjectPath);
    checkCancelled();await validateProjectAssets(project,sourceRoot);await log("assets.validated","Referenced assets exist and match their declared type",{assets:Object.keys(project.assets??{}).length});

    checkCancelled();await update("synthesizing",.1);await log("narration.started","Generating narration audio",{provider:providerKind});
    const provider=deps.provider??createProvider(providerKind,options.ttsSettings);const cache=new NarrationAudioCache(join(dataDir,"cache","tts"),provider);const narrationOverrides=providerKind==="piper"?getPiperNarrationOverrides(options.ttsSettings?.piper):{};
    const prepared=await prepareProjectNarration(project,cache,{fps:options.fps,scenePaddingSeconds:options.scenePaddingSeconds,language:project.metadata.language,...narrationOverrides});
    checkCancelled();await update("staging",.35);await log("narration.ready","Narration synthesized and measured",{scenes:Object.keys(prepared.tracks).length,provider:provider.id,ttsProvider:providerKind});

    await log("assets.staging","Preparing project assets and narration for the renderer",{assets:Object.keys(project.assets??{}).length});await stageProjectAssets(project.assets??{},sourceRoot,paths.publicDir);checkCancelled();const narration=await stageNarration(prepared.tracks,paths.publicDir);checkCancelled();
    const props:StudyTubeRenderProps={project:prepared.normalizedProject,narration,showCaptions:options.showCaptions??true};await writeFile(paths.renderPropsFile,`${JSON.stringify(props,null,2)}\n`,`utf8`);
    const outputBaseName=`${slugify(project.metadata.title)||"studytube"}-${jobId}`;const outputName=`${outputBaseName}.mp4`;const outputPath=join(paths.outputDir,outputName);
    const globalCaptionCues=buildGlobalCaptionCues(prepared.normalizedProject,narration);const srtPath=join(paths.outputDir,`${outputBaseName}.srt`);const vttPath=join(paths.outputDir,`${outputBaseName}.vtt`);
    await mkdir(paths.outputDir,{recursive:true});await Promise.all([writeFile(srtPath,captionCuesToSrt(globalCaptionCues),"utf8"),writeFile(vttPath,captionCuesToVtt(globalCaptionCues),"utf8")]);
    await update("bundling",.4);await log("render.started","Building renderer and starting MP4 render",{frames:prepared.normalizedProject.totalFrames,renderEngine,label:renderEngineLabels[renderEngine],ttsProvider:providerKind});checkCancelled();
    const entryPoint=resolveRendererEntryPoint();const render=deps.render??renderStudyTubeComposition;const doExtractSegment=deps.extractSegment??extractSegment;const doConcatenateSegments=deps.concatenateSegments??concatenateSegments;
    const flatScenes=prepared.normalizedProject.chapters.flatMap((chapter)=>chapter.scenes);const totalFrames=prepared.normalizedProject.totalFrames;const renderStartedAt=now().getTime();
    const ttsSettingsSignature=hashJson(options.ttsSettings??{});
    const currentManifest=buildSceneManifest(prepared.normalizedProject,{ttsProvider:providerKind,ttsSettingsSignature,renderEngine});
    await writeFile(paths.sceneManifestFile,`${JSON.stringify(currentManifest,null,2)}\n`,`utf8`);

    let lastRenderBucket=-1;let lastRenderStage="";
    const reportProgress=(fractionComplete:number,rawStage:string|undefined,absoluteFrame:number|undefined)=>{
      if(options.signal?.aborted)return;
      const safeProgress=clamp(fractionComplete);const state=rawStage==="bundling"?"bundling":"rendering";const mapped=.4+safeProgress*.58;
      const elapsedSeconds=(now().getTime()-renderStartedAt)/1000;const etaSeconds=safeProgress>.02?Math.max(0,elapsedSeconds*(1-safeProgress)/safeProgress):undefined;
      const sceneProgress=locateSceneProgress(flatScenes,totalFrames,absoluteFrame,etaSeconds);
      void update(state,mapped,{sceneProgress});
      const bucket=Math.floor(safeProgress*10)*10;const stageName=rawStage??state;
      if(bucket>lastRenderBucket||stageName!==lastRenderStage){lastRenderBucket=bucket;lastRenderStage=stageName;void log("render.progress",`${stageName==="bundling"?"Bundling":stageName==="reusing"?"Reusing":"Rendering"} video: ${Math.min(100,bucket)}%`,{stage:stageName,progress:safeProgress,renderEngine,sceneProgress});}
    };

    const basePlan=options.baseJobId?await loadIncrementalPlan(dataDir,options.baseJobId,currentManifest).catch((error)=>{void log("render.base-unavailable",`Could not reuse render ${options.baseJobId}: ${error instanceof Error?error.message:String(error)}`).catch(logSwallowedError(jobId,"log render.base-unavailable"));return null;}):null;

    if(basePlan){
      const reusedScenes=basePlan.runs.filter((run)=>run.kind==="reuse").flatMap((run)=>run.sceneIds).length;
      await log("render.incremental","Reusing unchanged scenes from a previous render",{baseJobId:options.baseJobId,reusedScenes,totalScenes:flatScenes.length});
      try{
        await renderIncremental({runs:basePlan.runs,baseOutputPath:basePlan.baseOutputPath,fps:prepared.normalizedProject.fps,entryPoint,publicDir:paths.publicDir,outputPath,props,renderEngine,render,extractSegment:doExtractSegment,concatenateSegments:doConcatenateSegments,segmentsDir:join(paths.root,"segments"),signal:options.signal,reportProgress});
      }catch(error){
        checkCancelled();
        await log("render.incremental-failed",`Falling back to a full render: ${error instanceof Error?error.message:String(error)}`).catch(logSwallowedError(jobId,"log render.incremental-failed"));
        lastRenderBucket=-1;lastRenderStage="";
        await renderFull({entryPoint,publicDir:paths.publicDir,outputPath,props,renderEngine,render,signal:options.signal,reportProgress});
      }
    }else{
      await renderFull({entryPoint,publicDir:paths.publicDir,outputPath,props,renderEngine,render,signal:options.signal,reportProgress});
    }

    checkCancelled();
    const thumbnailPath=await generateThumbnail({entryPoint,publicDir:paths.publicDir,outputDir:paths.outputDir,outputBaseName,props,flatScenes,renderThumbnail:deps.renderThumbnail??renderStudyTubeThumbnail,signal:options.signal})
      .catch((error)=>{logSwallowedError(jobId,"generate a video thumbnail")(error);return undefined;});

    checkCancelled();await Promise.all([statusQueue,logQueue]);await log("render.completed","MP4 render completed",{outputPath,totalFrames:prepared.normalizedProject.totalFrames,renderEngine,ttsProvider:providerKind});await update("completed",1,{outputPath,captions:{srtPath,vttPath},...(thumbnailPath?{thumbnailPath}:{})});await Promise.all([statusQueue,logQueue]);return {jobId,paths,status,outputPath};
  }catch(error){
    if(options.signal?.aborted){await log("job.cancelled","Render cancelled by user").catch(logSwallowedError(jobId,"log job.cancelled"));await update("cancelled",status.progress,{error:undefined}).catch(logSwallowedError(jobId,"update status to cancelled"));await Promise.all([statusQueue.catch(logSwallowedError(jobId,"flush status queue")),logQueue.catch(logSwallowedError(jobId,"flush log queue"))]);throw new StudyTubeJobCancelledError(jobId,paths.root,error);}
    const message=error instanceof Error?error.message:String(error);await log("job.failed",message).catch(logSwallowedError(jobId,"log job.failed"));await update("failed",status.progress,{error:message}).catch(logSwallowedError(jobId,"update status to failed"));await Promise.all([statusQueue.catch(logSwallowedError(jobId,"flush status queue")),logQueue.catch(logSwallowedError(jobId,"flush log queue"))]);throw new StudyTubeJobError(jobId,paths.root,error);
  }
};

const createProvider=(kind:TtsProviderKind,settings:TtsJobSettings={}):TtsProvider=>{
  if(kind==="synthetic")return new SyntheticWavProvider();
  if(kind==="edge"){const config=getEdgeTtsConfig();return new EdgeTtsHttpProvider({baseUrl:config.baseUrl,defaultVoice:settings.edge?.voice?.trim()||config.voice,defaultRate:settings.edge?.rate?.trim()||config.rate});}
  if(kind==="omnivoice"){const config=getOmniVoiceConfig();return new OmniVoiceHttpProvider({baseUrl:config.baseUrl,speed:settings.omnivoice?.speed??config.speed,numSteps:settings.omnivoice?.numSteps??config.numSteps,instruction:settings.omnivoice?.instruction??config.instruction,normalizeText:settings.omnivoice?.normalizeText??config.normalizeText,referenceAudioPath:settings.omnivoice?.referenceAudioPath,referenceText:settings.omnivoice?.referenceText});}
  if(kind==="chatterbox")return new ChatterboxHttpProvider({t3Model:settings.chatterbox?.t3Model,exaggeration:settings.chatterbox?.exaggeration,cfgWeight:settings.chatterbox?.cfgWeight,temperature:settings.chatterbox?.temperature,referenceAudioPath:settings.chatterbox?.referenceAudioPath});
  if(kind==="xtts")return new XttsHttpProvider({speaker:settings.xtts?.speaker,speed:settings.xtts?.speed,referenceAudioPath:settings.xtts?.referenceAudioPath});
  if(kind==="google-chirp")return new GoogleChirpHttpProvider({voice:settings.googleChirp?.voice});
  if(kind==="azure")return new AzureSpeechHttpProvider({voice:settings.azure?.voice});
  const config=getDutchPiperConfig();return new PiperHttpProvider({baseUrl:config.baseUrl,defaultVoice:settings.piper?.voice?.trim()||config.voice,defaultLanguage:config.language,defaultLengthScale:settings.piper?.lengthScale??config.lengthScale});
};

const getPiperNarrationOverrides=(settings:TtsJobSettings["piper"]={})=>{const config=getDutchPiperConfig();return {voice:settings.voice?.trim()||config.voice,lengthScale:settings.lengthScale??config.lengthScale};};
const stageProjectAssets=async(assets:Record<string,{path:string}>,sourceRoot:string,publicDir:string)=>{for(const [assetId,asset] of Object.entries(assets)){const relative=normalizeRelativeProjectPath(asset.path);const source=resolveInside(sourceRoot,relative);const destination=resolveInside(publicDir,relative);await mkdir(dirname(destination),{recursive:true});try{await copyFile(source,destination);}catch(error){throw new Error(`Could not stage asset ${assetId} (${relative}): ${error instanceof Error?error.message:String(error)}`);}}};
const stageNarration=async(tracks:Record<string,{cachePath:string;durationSeconds:number;captions:NarrationManifest[string]["captions"]}>,publicDir:string):Promise<NarrationManifest>=>{const manifest:NarrationManifest={};for(const [sceneId,track] of Object.entries(tracks)){const safeName=`${sceneId}.wav`;const relative=join("audio",safeName).replaceAll("\\","/");const destination=resolveInside(publicDir,relative);await mkdir(dirname(destination),{recursive:true});await copyFile(track.cachePath,destination);manifest[sceneId]={sourcePath:relative,durationSeconds:track.durationSeconds,captions:track.captions};}return manifest;};
const logSwallowedError=(jobId:string,action:string)=>(error:unknown)=>{console.error(`StudyTube job ${jobId}: failed to ${action}`,error);};

type IncrementalPlan={runs:SceneRun[];baseOutputPath:string};

const loadIncrementalPlan=async(dataDir:string,baseJobId:string,currentManifest:SceneManifest):Promise<IncrementalPlan|null>=>{
  if(![...baseJobId].every((char)=>/[a-zA-Z0-9_-]/u.test(char))||baseJobId.length>120){
    throw new Error(`Invalid base job id: ${baseJobId}`);
  }
  const baseRoot=join(dataDir,"jobs",baseJobId);
  const baseStatus=JSON.parse(await readFile(join(baseRoot,"status.json"),"utf8")) as StudyTubeJobStatus;
  if(baseStatus.state!=="completed"||!baseStatus.outputPath){
    throw new Error(`Base job ${baseJobId} has no completed output to reuse`);
  }
  await access(baseStatus.outputPath);
  const baseManifest=JSON.parse(await readFile(join(baseRoot,"scene-manifest.json"),"utf8")) as SceneManifest;
  const runs=planSceneRuns(currentManifest,baseManifest);
  if(!runs)return null;
  return {runs,baseOutputPath:baseStatus.outputPath};
};

const generateThumbnail=async(args:{entryPoint:string;publicDir:string;outputDir:string;outputBaseName:string;props:StudyTubeRenderProps;flatScenes:NormalizedScene[];renderThumbnail:PipelineThumbnailFunction;signal?:AbortSignal}):Promise<string>=>{
  const firstScene=args.flatScenes[0];
  const frame=firstScene?Math.floor((firstScene.startFrame+firstScene.endFrameExclusive)/2):0;
  const outputPath=join(args.outputDir,`${args.outputBaseName}.jpg`);
  await args.renderThumbnail({entryPoint:args.entryPoint,publicDir:args.publicDir,outputPath,props:args.props,frame,signal:args.signal});
  return outputPath;
};

const renderFull=async(args:{entryPoint:string;publicDir:string;outputPath:string;props:StudyTubeRenderProps;renderEngine:RenderEngine;render:PipelineRenderFunction;signal?:AbortSignal;reportProgress:(fraction:number,stage:string|undefined,absoluteFrame:number|undefined)=>void})=>{
  await args.render({
    entryPoint:args.entryPoint,publicDir:args.publicDir,outputPath:args.outputPath,props:args.props,renderEngine:args.renderEngine,signal:args.signal,
    onProgress:({progress,stage,renderedFrames})=>{args.reportProgress(progress,stage,renderedFrames);},
  });
};

const renderIncremental=async(args:{
  runs:SceneRun[];baseOutputPath:string;fps:number;entryPoint:string;publicDir:string;outputPath:string;props:StudyTubeRenderProps;renderEngine:RenderEngine;
  render:PipelineRenderFunction;extractSegment:typeof extractSegment;concatenateSegments:typeof concatenateSegments;segmentsDir:string;signal?:AbortSignal;
  reportProgress:(fraction:number,stage:string|undefined,absoluteFrame:number|undefined)=>void;
})=>{
  const extractWeight=.2;
  const totalWork=args.runs.reduce((sum,run)=>sum+(run.endFrameExclusive-run.startFrame)*(run.kind==="reuse"?extractWeight:1),0);
  let completedWork=0;
  const segmentPaths:string[]=[];
  await mkdir(args.segmentsDir,{recursive:true});

  try{
    for(const [index,run] of args.runs.entries()){
      if(args.signal?.aborted)throw new Error("Render cancelled");
      const frameCount=run.endFrameExclusive-run.startFrame;
      const segmentPath=join(args.segmentsDir,`segment-${index}.mp4`);
      if(run.kind==="reuse"){
        await args.extractSegment(args.baseOutputPath,run.baseStartFrame??run.startFrame,frameCount,args.fps,segmentPath,args.signal);
        completedWork+=frameCount*extractWeight;
        args.reportProgress(completedWork/totalWork,"reusing",run.endFrameExclusive);
      }else{
        await args.render({
          entryPoint:args.entryPoint,publicDir:args.publicDir,outputPath:segmentPath,props:args.props,renderEngine:args.renderEngine,
          frameRange:[run.startFrame,run.endFrameExclusive-1],signal:args.signal,
          onProgress:({progress,stage,renderedFrames})=>{
            const runFraction=clamp(progress);
            const absoluteFrame=Math.min(run.endFrameExclusive,run.startFrame+Math.round(runFraction*frameCount));
            args.reportProgress((completedWork+runFraction*frameCount)/totalWork,stage,absoluteFrame);
          },
        });
        completedWork+=frameCount;
        args.reportProgress(completedWork/totalWork,"rendering",run.endFrameExclusive);
      }
      segmentPaths.push(segmentPath);
    }

    await args.concatenateSegments(segmentPaths,args.outputPath,args.signal);
  }finally{
    await rm(args.segmentsDir,{recursive:true,force:true}).catch((error)=>{console.error(`StudyTube render: failed to remove segment directory ${args.segmentsDir}`,error);});
  }
};
const createJobId=(date:Date)=>`${date.toISOString().replaceAll(":","").replaceAll(".","-")}-${randomUUID().slice(0,8)}`;
const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/gu,"-").replace(/^-+|-+$/gu,"").slice(0,70);
const clamp=(value:number)=>Math.min(1,Math.max(0,value));
const locateSceneProgress=(scenes:NormalizedScene[],totalFrames:number,renderedFrames:number|undefined,etaSeconds:number|undefined):SceneProgress|undefined=>{
  if(scenes.length===0)return undefined;
  const frames=Math.min(totalFrames,Math.max(0,renderedFrames??0));
  const currentIndex=scenes.findIndex((scene)=>frames<scene.endFrameExclusive);
  const index=currentIndex===-1?scenes.length-1:currentIndex;
  return {
    currentSceneId:scenes[index]?.scene.id,
    currentSceneIndex:index,
    completedScenes:currentIndex===-1?scenes.length:currentIndex,
    totalScenes:scenes.length,
    etaSeconds,
  };
};
