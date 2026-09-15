import {bundle} from "@remotion/bundler";
import {renderMedia,selectComposition} from "@remotion/renderer";
import type {NarrationManifest,NormalizedStudyTubeProject} from "@studytube/core";
import type {RenderProgress} from "./types";

export type RenderStudyTubeOptions={
  entryPoint:string;
  publicDir:string;
  outputPath:string;
  props:{project:NormalizedStudyTubeProject;narration?:NarrationManifest;showCaptions?:boolean};
  signal?:AbortSignal;
  onProgress?:(progress:RenderProgress)=>void|Promise<void>;
};

export type RemotionRenderSettings={
  concurrency:number;
  timeoutInMilliseconds:number;
};

const readPositiveInteger=(env:NodeJS.ProcessEnv,name:string,fallback:number):number=>{
  const raw=env[name]?.trim();
  if(!raw)return fallback;
  const parsed=Number(raw);
  if(!Number.isInteger(parsed)||parsed<1)throw new Error(`${name} must be a positive integer, received "${raw}"`);
  return parsed;
};

export const resolveRemotionRenderSettings=(env:NodeJS.ProcessEnv=process.env):RemotionRenderSettings=>({
  concurrency:readPositiveInteger(env,"STUDYTUBE_RENDER_CONCURRENCY",2),
  timeoutInMilliseconds:readPositiveInteger(env,"STUDYTUBE_RENDER_TIMEOUT_MS",120_000),
});

const throwIfCancelled=(signal?:AbortSignal)=>{
  if(signal?.aborted)throw new Error("Render cancelled");
};

const makeRemotionCancelSignal=(signal:AbortSignal):NonNullable<Parameters<typeof renderMedia>[0]["cancelSignal"]>=>
  (cancel)=>{
    if(signal.aborted){cancel();return;}
    signal.addEventListener("abort",cancel,{once:true});
  };

export const renderStudyTubeComposition=async(options:RenderStudyTubeOptions):Promise<void>=>{
  throwIfCancelled(options.signal);
  await options.onProgress?.({progress:0,stage:"bundling"});
  const serveUrl=await bundle({
    entryPoint:options.entryPoint,
    publicDir:options.publicDir,
    onProgress:(progress)=>{void options.onProgress?.({progress:progress*.12,stage:"bundling"});},
  });
  throwIfCancelled(options.signal);
  const inputProps=options.props as unknown as Record<string,unknown>;
  const composition=await selectComposition({serveUrl,id:"StudyTube",inputProps});
  throwIfCancelled(options.signal);
  const renderSettings=resolveRemotionRenderSettings();
  await renderMedia({
    serveUrl,
    composition,
    codec:"h264",
    outputLocation:options.outputPath,
    inputProps,
    overwrite:true,
    concurrency:renderSettings.concurrency,
    timeoutInMilliseconds:renderSettings.timeoutInMilliseconds,
    cancelSignal:options.signal?makeRemotionCancelSignal(options.signal):undefined,
    onProgress:({progress,stitchStage})=>{void options.onProgress?.({progress:.12+progress*.88,stage:stitchStage});},
  });
};
