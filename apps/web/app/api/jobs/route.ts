import {randomUUID} from "node:crypto";
import {mkdir,rm,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {StudyTubeValidationError} from "@studytube/schema";
import {runStudyTubeJob} from "@studytube/worker";
import {parseRenderEngine,requireRenderEngine} from "@studytube/worker/render-engine";
import {registerActiveJob,unregisterActiveJob} from "@/lib/activeJobs";
import {cleanupCancelledJobWorkingData,cleanupExpiredJobs,getDataDir,listJobStatuses} from "@/lib/jobs";
import {parseProjectPackage,stageProjectPackage,StudyTubePackageError} from "@/lib/projectPackage";

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
  let uploadRoot:string|undefined;
  try{
    await cleanupExpiredJobs();
    const form=await request.formData();
    const projectPart=form.get("project");
    if(!(projectPart instanceof File))return Response.json({error:"Upload a .studytube.json or .studytube.zip project"},{status:400});

    const renderEngine=parseRenderEngine(form.get("renderEngine"));
    await requireRenderEngine(renderEngine);
    const parsed=await parseProjectPackage(projectPart);
    const project=parsed.project;
    const jobId=`web-${Date.now()}-${randomUUID().slice(0,8)}`;
    const dataDir=getDataDir();
    uploadRoot=join(dataDir,"uploads",jobId);
    const projectPath=await stageProjectPackage(parsed,uploadRoot);

    const createdAt=new Date().toISOString();
    const jobRoot=join(dataDir,"jobs",jobId);
    await mkdir(jobRoot,{recursive:true});
    await writeFile(join(jobRoot,"status.json"),`${JSON.stringify({jobId,state:"queued",progress:0,createdAt,updatedAt:createdAt,projectTitle:project.metadata.title,renderEngine},null,2)}\n`,`utf8`);

    const signal=registerActiveJob(jobId);
    void runStudyTubeJob({projectPath,dataDir,jobId,signal,renderEngine})
      .catch(()=>undefined)
      .finally(async()=>{
        unregisterActiveJob(jobId);
        await rm(uploadRoot!,{recursive:true,force:true}).catch(()=>undefined);
        await cleanupCancelledJobWorkingData(jobId).catch(()=>undefined);
      });

    return Response.json({jobId,renderEngine},{status:202});
  }catch(error){
    if(uploadRoot)await rm(uploadRoot,{recursive:true,force:true}).catch(()=>undefined);
    if(error instanceof StudyTubeValidationError)return Response.json({error:"Invalid StudyTube project",issues:error.issues},{status:422});
    if(error instanceof StudyTubePackageError)return Response.json({error:error.message},{status:error.status});
    return Response.json({error:error instanceof Error?error.message:"Could not start render"},{status:400});
  }
}
