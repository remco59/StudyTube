import {randomUUID} from "node:crypto";
import {mkdir,rm,writeFile} from "node:fs/promises";
import {dirname,join} from "node:path";
import {parseStudyTubeProject,StudyTubeValidationError} from "@studytube/schema";
import {runStudyTubeJob} from "@studytube/worker";
import {registerActiveJob,unregisterActiveJob} from "@/lib/activeJobs";
import {cleanupExpiredJobs,getDataDir,listJobStatuses} from "@/lib/jobs";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  try{
    return Response.json({jobs:await listJobStatuses()},{headers:{"cache-control":"no-store"}});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Could not load jobs"},{status:500});
  }
}

export async function POST(request:Request){
  try{
    await cleanupExpiredJobs();
    const form=await request.formData();
    const projectPart=form.get("project");
    if(!(projectPart instanceof File)) return Response.json({error:"Upload a .studytube.json project"},{status:400});
    if(projectPart.size>5_000_000) return Response.json({error:"Project JSON is too large"},{status:413});

    const project=parseStudyTubeProject(JSON.parse(await projectPart.text()));
    const jobId=`web-${Date.now()}-${randomUUID().slice(0,8)}`;
    const dataDir=getDataDir();
    const uploadRoot=join(dataDir,"uploads",jobId);
    await mkdir(uploadRoot,{recursive:true});
    const projectPath=join(uploadRoot,"project.studytube.json");
    await writeFile(projectPath,`${JSON.stringify(project,null,2)}\n`,`utf8`);

    for(const [assetId,asset] of Object.entries(project.assets??{})){
      const file=form.get(`asset:${assetId}`);
      if(!(file instanceof File)){
        await rm(uploadRoot,{recursive:true,force:true});
        return Response.json({error:`Missing required asset: ${asset.path}`,assetId},{status:400});
      }
      if(file.size>100_000_000){
        await rm(uploadRoot,{recursive:true,force:true});
        return Response.json({error:`Asset is too large: ${asset.path}`},{status:413});
      }
      const relative=safeRelativePath(asset.path);
      const destination=join(uploadRoot,...relative.split("/"));
      await mkdir(dirname(destination),{recursive:true});
      await writeFile(destination,new Uint8Array(await file.arrayBuffer()));
    }

    const createdAt=new Date().toISOString();
    const jobRoot=join(dataDir,"jobs",jobId);
    await mkdir(jobRoot,{recursive:true});
    await writeFile(join(jobRoot,"status.json"),`${JSON.stringify({jobId,state:"queued",progress:0,createdAt,updatedAt:createdAt,projectTitle:project.metadata.title},null,2)}\n`,`utf8`);

    const signal=registerActiveJob(jobId);
    void runStudyTubeJob({projectPath,dataDir,jobId,signal})
      .catch(()=>undefined)
      .finally(()=>{
        unregisterActiveJob(jobId);
        return rm(uploadRoot,{recursive:true,force:true}).catch(()=>undefined);
      });

    return Response.json({jobId},{status:202});
  }catch(error){
    if(error instanceof StudyTubeValidationError) return Response.json({error:"Invalid StudyTube project",issues:error.issues},{status:422});
    return Response.json({error:error instanceof Error?error.message:"Could not start render"},{status:400});
  }
}

const safeRelativePath=(input:string)=>{
  const path=input.trim().replace(/^\.\//u,"");
  const segments=path.split("/");
  if(!path||path.startsWith("/")||path.includes("\\")||segments.some((segment)=>!segment||segment==="."||segment==="..")||(segments[0]?.includes(":")??false)) throw new Error(`Unsafe asset path: ${input}`);
  return path;
};
