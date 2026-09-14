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

export const renderStudyTubeComposition=async(options:RenderStudyTubeOptions):Promise<void>=>{
  await options.onProgress?.({progress:0,stage:"bundling"});
  const serveUrl=await bundle({
    entryPoint:options.entryPoint,
    publicDir:options.publicDir,
    onProgress:(progress)=>{void options.onProgress?.({progress:progress*.12,stage:"bundling"});},
  });
  const inputProps=options.props as unknown as Record<string,unknown>;
  const composition=await selectComposition({serveUrl,id:"StudyTube",inputProps});
  await renderMedia({
    serveUrl,
    composition,
    codec:"h264",
    outputLocation:options.outputPath,
    inputProps,
    overwrite:true,
    onProgress:({progress,stitchStage})=>{void options.onProgress?.({progress:.12+progress*.88,stage:stitchStage});},
  });
};
