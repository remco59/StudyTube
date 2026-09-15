import {bundle} from "@remotion/bundler";
import {renderMedia,selectComposition} from "@remotion/renderer";
import type {NarrationManifest,NormalizedStudyTubeProject} from "@studytube/core";
import type {RenderProgress} from "./types";

export type RenderStudyTubeOptions={
  entryPoint:string;
  publicDir:string;
  outputPath:string;
  props:{project:NormalizedStudyTubeProject;narration?:NarrationManifest;showCaptions?:boolean};
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

export const renderStudyTubeComposition=async(options:RenderStudyTubeOptions):Promise<void>=>{
  await options.onProgress?.({progress:0,stage:"bundling"});
  const serveUrl=await bundle({
    entryPoint:options.entryPoint,
    publicDir:options.publicDir,
    onProgress:(progress)=>{void options.onProgress?.({progress:progress*.12,stage:"bundling"});},
  });
  const inputProps=options.props as unknown as Record<string,unknown>;
  const composition=await selectComposition({serveUrl,id:"StudyTube",inputProps});
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
    onProgress:({progress,stitchStage})=>{void options.onProgress?.({progress:.12+progress*.88,stage:stitchStage});},
  });
};
