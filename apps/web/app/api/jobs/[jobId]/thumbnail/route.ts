import {readFile} from "node:fs/promises";
import {basename} from "node:path";
import {readJobStatus} from "@/lib/jobs";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(_request:Request,{params}:{params:Promise<{jobId:string}>}){
  try{
    const {jobId}=await params;
    const status=await readJobStatus(jobId);
    if(status.state!=="completed"||!status.thumbnailPath)return Response.json({error:"Thumbnail is not ready"},{status:409});
    const thumbnail=await readFile(status.thumbnailPath);
    return new Response(new Uint8Array(thumbnail),{headers:{"content-type":"image/jpeg","content-disposition":`inline; filename="${basename(status.thumbnailPath)}"`,"cache-control":"private, max-age=3600"}});
  }catch{
    return Response.json({error:"Thumbnail not found"},{status:404});
  }
}
