import {readLiveJobStatus,removeJob} from "@/lib/jobs";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(_request:Request,{params}:{params:Promise<{jobId:string}>}){
  try{
    const {jobId}=await params;
    return Response.json(await readLiveJobStatus(jobId),{headers:{"cache-control":"no-store"}});
  }catch{
    return Response.json({error:"Job not found"},{status:404});
  }
}

export async function DELETE(_request:Request,{params}:{params:Promise<{jobId:string}>}){
  try{
    const {jobId}=await params;
    const status=await readLiveJobStatus(jobId);
    if(!isTerminal(status.state))return Response.json({error:"Active jobs cannot be deleted. Cancel the render first."},{status:409});
    await removeJob(jobId);
    return Response.json({deleted:true,jobId});
  }catch{
    return Response.json({error:"Job not found"},{status:404});
  }
}

const isTerminal=(state:string)=>state==="completed"||state==="failed"||state==="cancelled";
