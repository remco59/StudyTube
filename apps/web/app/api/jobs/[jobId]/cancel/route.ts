import {cancelActiveJob} from "@/lib/activeJobs";
import {markJobInterrupted,readJobStatus} from "@/lib/jobs";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(_request:Request,{params}:{params:Promise<{jobId:string}>}){
  try{
    const {jobId}=await params;
    const status=await readJobStatus(jobId);
    if(status.state==="completed"||status.state==="failed"||status.state==="cancelled"){
      return Response.json({error:`Job is already ${status.state}`,status},{status:409});
    }
    if(!cancelActiveJob(jobId)){
      const interrupted=await markJobInterrupted(jobId);
      return Response.json({ok:true,jobId,interrupted:true,status:interrupted});
    }
    return Response.json({ok:true,jobId},{status:202});
  }catch{
    return Response.json({error:"Job not found"},{status:404});
  }
}
