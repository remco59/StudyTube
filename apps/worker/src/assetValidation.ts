import {stat} from "node:fs/promises";
import {extname} from "node:path";
import type {StudyTubeProject} from "@studytube/schema";
import {resolveInside,StudyTubeJobPathError} from "./pathSafety";

export class StudyTubeAssetValidationError extends Error{
  readonly issues:string[];
  constructor(issues:string[]){
    super(`Invalid project assets:\n${issues.map((issue)=>`- ${issue}`).join("\n")}`);
    this.name="StudyTubeAssetValidationError";
    this.issues=issues;
  }
}

const imageExtensions=new Set([".png",".jpg",".jpeg",".gif",".webp",".bmp",".avif",".svg"]);
const videoExtensions=new Set([".mp4",".webm",".mov",".m4v"]);

export const validateProjectAssets=async(project:StudyTubeProject,sourceRoot:string):Promise<void>=>{
  const issues:string[]=[];
  for(const [assetId,asset] of Object.entries(project.assets??{})){
    if(asset.type==="stockImage"||asset.type==="stockVideo"){
      issues.push(`${assetId}: unresolved ${asset.type} request reached the render worker`);
      continue;
    }
    let resolvedPath:string;
    try{
      resolvedPath=resolveInside(sourceRoot,asset.path);
    }catch(error){
      issues.push(`${assetId} (${asset.path}): ${error instanceof StudyTubeJobPathError?error.message:String(error)}`);
      continue;
    }

    const fileStat=await stat(resolvedPath).catch(()=>null);
    if(!fileStat){
      issues.push(`${assetId} (${asset.path}): file not found`);
      continue;
    }
    if(!fileStat.isFile()){
      issues.push(`${assetId} (${asset.path}): not a regular file`);
      continue;
    }
    if(asset.type==="image"&&!imageExtensions.has(extname(asset.path).toLowerCase())){
      issues.push(`${assetId} (${asset.path}): expected an image file (${[...imageExtensions].join(", ")})`);
    }
    if(asset.type==="video"&&!videoExtensions.has(extname(asset.path).toLowerCase())){
      issues.push(`${assetId} (${asset.path}): expected a video file (${[...videoExtensions].join(", ")})`);
    }
  }
  if(issues.length>0)throw new StudyTubeAssetValidationError(issues);
};
