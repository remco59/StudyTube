import {readJobLogs,readJobStatus} from "@/lib/jobs";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(_request:Request,{params}:{params:Promise<{jobId:string}>}){
  try{
    const {jobId}=await params;
    await readJobStatus(jobId);
    return Response.json({logs:await readJobLogs(jobId)},{headers:{"cache-control":"no-store"}});
  }catch{
    return Response.json({error:"Job not found"},{status:404});
  }
}
