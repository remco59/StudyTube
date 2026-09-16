import type {NormalizedStudyTubeProject} from "@studytube/core";
import {staticFile} from "remotion";

type Project=NormalizedStudyTubeProject["project"];
type ProjectAsset=NonNullable<Project["assets"]>[string];
type ImageAsset=Extract<ProjectAsset,{type:"image"}>;
type VideoAsset=Extract<ProjectAsset,{type:"video"}>;
type DocumentAsset=Extract<ProjectAsset,{type:"document"}>;
type LocalProjectAsset=ImageAsset|VideoAsset|DocumentAsset;
export type ResolvedProjectAsset<T extends LocalProjectAsset=LocalProjectAsset>=T&{id:string;path:string;src:string};

export class StudyTubeAssetError extends Error{constructor(message:string){super(message);this.name="StudyTubeAssetError";}}

export const normalizeProjectAssetPath=(input:string):string=>{
  const trimmed=input.trim();
  if(!trimmed) throw new StudyTubeAssetError("Asset path cannot be empty");
  if(trimmed.includes("\\")) throw new StudyTubeAssetError("Asset paths must use forward slashes");
  if(trimmed.startsWith("/")||/^[a-zA-Z][a-zA-Z0-9+.-]*:/u.test(trimmed)) throw new StudyTubeAssetError("Asset paths must be project-local relative paths");
  const normalized=trimmed.replace(/^\.\//u,"");
  const segments=normalized.split("/");
  if(segments.some((segment)=>segment===".."||segment==="."||segment==="")) throw new StudyTubeAssetError("Asset paths cannot contain traversal or empty segments");
  return normalized;
};

export function resolveProjectAsset(project:Project,assetId:string,expectedType:"image"):ResolvedProjectAsset<ImageAsset>;
export function resolveProjectAsset(project:Project,assetId:string,expectedType:"video"):ResolvedProjectAsset<VideoAsset>;
export function resolveProjectAsset(project:Project,assetId:string,expectedType:"document"):ResolvedProjectAsset<DocumentAsset>;
export function resolveProjectAsset(project:Project,assetId:string):ResolvedProjectAsset;
export function resolveProjectAsset(project:Project,assetId:string,expectedType?:LocalProjectAsset["type"]):ResolvedProjectAsset{
  const asset=project.assets?.[assetId];
  if(!asset) throw new StudyTubeAssetError(`Unknown project asset: ${assetId}`);
  if(asset.type==="stockImage"||asset.type==="stockVideo")throw new StudyTubeAssetError(`Asset ${assetId} was not resolved before rendering`);
  if(expectedType&&asset.type!==expectedType) throw new StudyTubeAssetError(`Asset ${assetId} is ${asset.type}, expected ${expectedType}`);
  const path=normalizeProjectAssetPath(asset.path);
  return {...asset,id:assetId,path,src:staticFile(path)} as ResolvedProjectAsset;
}
