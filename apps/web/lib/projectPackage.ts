import {mkdir,writeFile} from "node:fs/promises";
import {dirname,join} from "node:path";
import {normalizeStudyTubeProject} from "@studytube/core";
import {parseStudyTubeProject,type StudyTubeProject} from "@studytube/schema";
import {normalizeRelativeProjectPath,StudyTubeJobPathError} from "@studytube/worker/path-safety";
import {strFromU8,unzipSync} from "fflate";

export const STUDYTUBE_PROJECT_JSON="project.studytube.json";

const MAX_JSON_BYTES=5_000_000;
const MAX_ZIP_BYTES=200_000_000;
const MAX_ZIP_ENTRIES=512;
const MAX_ASSET_BYTES=100_000_000;
const MAX_UNCOMPRESSED_BYTES=300_000_000;

type PackageType="json"|"zip";

export type ParsedProjectPackage={
  project:StudyTubeProject;
  packageType:PackageType;
  assetEntries:Map<string,Uint8Array>;
};

export class StudyTubePackageError extends Error{
  readonly status:number;
  constructor(message:string,status=400){
    super(message);
    this.name="StudyTubePackageError";
    this.status=status;
  }
}

export async function parseProjectPackage(file:File):Promise<ParsedProjectPackage>{
  const lowerName=file.name.toLowerCase();
  if(lowerName.endsWith(".zip"))return parseZipPackage(file);
  if(lowerName.endsWith(".json"))return parseJsonPackage(file);
  throw new StudyTubePackageError("Upload a .studytube.json or .studytube.zip project file");
}

export async function stageProjectPackage(parsed:ParsedProjectPackage,root:string){
  await mkdir(root,{recursive:true});
  const projectPath=join(root,STUDYTUBE_PROJECT_JSON);
  await writeFile(projectPath,`${JSON.stringify(parsed.project,null,2)}\n`,`utf8`);

  for(const asset of Object.values(parsed.project.assets??{})){
    const relative=safeRelativePath(asset.path);
    const data=parsed.assetEntries.get(relative);
    if(!data)throw new StudyTubePackageError(`Missing packaged asset: ${asset.path}`);
    const destination=join(root,...relative.split("/"));
    await mkdir(dirname(destination),{recursive:true});
    await writeFile(destination,data);
  }

  return projectPath;
}

export async function summarizeProjectPackage(parsed:ParsedProjectPackage){
  const scenes=parsed.project.chapters.flatMap((chapter)=>chapter.scenes);
  const assets=Object.entries(parsed.project.assets??{}).map(([id,asset])=>({
    id,
    type:asset.type,
    path:asset.path,
    fileName:asset.path.split("/").at(-1)??asset.path,
  }));
  const preview=await buildProjectPreview(parsed.project);
  return {
    valid:true as const,
    packageType:parsed.packageType,
    summary:{
      title:parsed.project.metadata.title,
      language:parsed.project.metadata.language,
      targetDuration:parsed.project.metadata.targetDuration,
      chapters:parsed.project.chapters.length,
      scenes:scenes.length,
      assets:assets.length,
      estimatedDurationSeconds:preview.estimatedDurationSeconds,
    },
    assets,
    preview,
  };
}

export type ProjectPreviewScene={id:string;type:string;narration:string;estimatedDurationSeconds:number};
export type ProjectPreviewChapter={id:string;title:string;estimatedDurationSeconds:number;scenes:ProjectPreviewScene[]};
export type ProjectPreview={estimatedDurationSeconds:number;chapters:ProjectPreviewChapter[]};

async function buildProjectPreview(project:StudyTubeProject):Promise<ProjectPreview>{
  const normalized=await normalizeStudyTubeProject(project);
  return {
    estimatedDurationSeconds:normalized.totalDurationSeconds,
    chapters:normalized.chapters.map((chapter)=>({
      id:chapter.id,
      title:chapter.title,
      estimatedDurationSeconds:chapter.durationSeconds,
      scenes:chapter.scenes.map((scene)=>({
        id:scene.scene.id,
        type:scene.scene.type,
        narration:scene.scene.narration,
        estimatedDurationSeconds:scene.durationSeconds,
      })),
    })),
  };
}

async function parseJsonPackage(file:File):Promise<ParsedProjectPackage>{
  if(file.size>MAX_JSON_BYTES)throw new StudyTubePackageError("Project JSON is too large",413);
  const project=parseJson(await file.text());
  const assets=Object.keys(project.assets??{});
  if(assets.length>0){
    throw new StudyTubePackageError("Projects with assets must be packaged as .studytube.zip with project.studytube.json and all referenced asset files");
  }
  return {project,packageType:"json",assetEntries:new Map()};
}

async function parseZipPackage(file:File):Promise<ParsedProjectPackage>{
  if(file.size>MAX_ZIP_BYTES)throw new StudyTubePackageError("StudyTube ZIP is too large",413);
  const bytes=new Uint8Array(await file.arrayBuffer());
  preflightZip(bytes);

  let unzipped:Record<string,Uint8Array>;
  try{
    unzipped=unzipSync(bytes);
  }catch(error){
    throw new StudyTubePackageError(error instanceof Error?`Could not read StudyTube ZIP: ${error.message}`:"Could not read StudyTube ZIP");
  }

  const entries=new Map<string,Uint8Array>();
  for(const [rawPath,data] of Object.entries(unzipped)){
    if(rawPath.endsWith("/"))continue;
    const relative=safeRelativePath(rawPath);
    if(data.byteLength>MAX_ASSET_BYTES)throw new StudyTubePackageError(`Packaged file is too large: ${relative}`,413);
    entries.set(relative,data);
  }

  const projectBytes=entries.get(STUDYTUBE_PROJECT_JSON);
  if(!projectBytes){
    throw new StudyTubePackageError(`StudyTube ZIP must contain ${STUDYTUBE_PROJECT_JSON} at the archive root`);
  }
  if(projectBytes.byteLength>MAX_JSON_BYTES)throw new StudyTubePackageError("Packaged project JSON is too large",413);

  const project=parseJson(strFromU8(projectBytes));
  const assets=Object.entries(project.assets??{});
  if(assets.length===0){
    throw new StudyTubePackageError("This project has no assets. Use a .studytube.json file instead of a ZIP");
  }

  const assetEntries=new Map<string,Uint8Array>();
  for(const [,asset] of assets){
    const relative=safeRelativePath(asset.path);
    const data=entries.get(relative);
    if(!data)throw new StudyTubePackageError(`Missing packaged asset: ${asset.path}`);
    assetEntries.set(relative,data);
  }

  return {project,packageType:"zip",assetEntries};
}

function parseJson(text:string){
  try{
    return parseStudyTubeProject(JSON.parse(text));
  }catch(error){
    if(error instanceof SyntaxError)throw new StudyTubePackageError(`Invalid project JSON: ${error.message}`);
    throw error;
  }
}

export function safeRelativePath(input:string){
  try{
    return normalizeRelativeProjectPath(input);
  }catch(error){
    if(error instanceof StudyTubeJobPathError)throw new StudyTubePackageError(`Unsafe project path: ${input}`);
    throw error;
  }
}

function preflightZip(bytes:Uint8Array){
  if(bytes.byteLength<22)throw new StudyTubePackageError("Invalid ZIP archive");
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const minOffset=Math.max(0,bytes.byteLength-65_557);
  let eocd=-1;
  for(let index=bytes.byteLength-22;index>=minOffset;index--){
    if(view.getUint32(index,true)===0x06054b50){eocd=index;break;}
  }
  if(eocd<0)throw new StudyTubePackageError("Invalid ZIP archive: end record not found");

  const entryCount=view.getUint16(eocd+10,true);
  const centralOffset=view.getUint32(eocd+16,true);
  if(entryCount===0xffff||centralOffset===0xffffffff)throw new StudyTubePackageError("ZIP64 project packages are not supported");
  if(entryCount>MAX_ZIP_ENTRIES)throw new StudyTubePackageError("StudyTube ZIP contains too many files",413);

  let cursor=centralOffset;
  let totalUncompressed=0;
  for(let index=0;index<entryCount;index++){
    if(cursor+46>eocd||view.getUint32(cursor,true)!==0x02014b50)throw new StudyTubePackageError("Invalid ZIP central directory");
    const flags=view.getUint16(cursor+8,true);
    const method=view.getUint16(cursor+10,true);
    const uncompressed=view.getUint32(cursor+24,true);
    const nameLength=view.getUint16(cursor+28,true);
    const extraLength=view.getUint16(cursor+30,true);
    const commentLength=view.getUint16(cursor+32,true);
    if(flags&1)throw new StudyTubePackageError("Encrypted ZIP project packages are not supported");
    if(method!==0&&method!==8)throw new StudyTubePackageError(`Unsupported ZIP compression method: ${method}`);
    if(uncompressed===0xffffffff)throw new StudyTubePackageError("ZIP64 project packages are not supported");
    if(uncompressed>MAX_ASSET_BYTES)throw new StudyTubePackageError("A packaged file exceeds the 100 MB limit",413);
    totalUncompressed+=uncompressed;
    if(totalUncompressed>MAX_UNCOMPRESSED_BYTES)throw new StudyTubePackageError("StudyTube ZIP expands beyond the 300 MB limit",413);
    cursor+=46+nameLength+extraLength+commentLength;
  }
}
