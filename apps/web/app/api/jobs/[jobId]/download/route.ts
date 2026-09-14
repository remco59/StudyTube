import {readFile} from "node:fs/promises";
import {basename} from "node:path";
import {readJobStatus} from "@/lib/jobs";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(_request:Request,{params}:{params:Promise<{jobId:string}>}){
  try{
    const {jobId}=await params;
    const status=await readJobStatus(jobId);
    if(status.state!=="completed"||!status.outputPath) return Response.json({error:"Video is not ready"},{status:409});
    const video=await readFile(status.outputPath);
    return new Response(new Uint8Array(video),{headers:{"content-type":"video/mp4","content-disposition":`attachment; filename="${basename(status.outputPath)}"`,"cache-control":"private, max-age=3600"}});
  }catch{
    return Response.json({error:"Video not found"},{status:404});
  }
}
