import {resolve,sep} from "node:path";

export class StudyTubeJobPathError extends Error{
  constructor(message:string){super(message);this.name="StudyTubeJobPathError";}
}

export const normalizeRelativeProjectPath=(input:string):string=>{
  const path=input.trim().replace(/^\.\//u,"");
  const firstSegment=path.split("/")[0]??"";
  const hasScheme=firstSegment.includes(":");
  if(!path||path.includes("\\")||path.startsWith("/")||hasScheme){
    throw new StudyTubeJobPathError(`Unsafe project-local path: ${input}`);
  }
  const segments=path.split("/");
  if(segments.some((segment)=>segment===""||segment==="."||segment==="..")){
    throw new StudyTubeJobPathError(`Unsafe project-local path: ${input}`);
  }
  return path;
};

export const resolveInside=(root:string,relativePath:string):string=>{
  const normalized=normalizeRelativeProjectPath(relativePath);
  const absolute=resolve(root,normalized);
  const rootPrefix=resolve(root)+sep;
  if(!absolute.startsWith(rootPrefix)) throw new StudyTubeJobPathError(`Path escapes project root: ${relativePath}`);
  return absolute;
};
