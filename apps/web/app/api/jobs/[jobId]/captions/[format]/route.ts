import {readFile} from "node:fs/promises";
import {basename} from "node:path";
import {readJobStatus} from "@/lib/jobs";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const contentTypes={srt:"text/plain; charset=utf-8",vtt:"text/vtt; charset=utf-8"} as const;

export async function GET(_request:Request,{params}:{params:Promise<{jobId:string;format:string}>}){
  try{
    const {jobId,format}=await params;
    if(format!=="srt"&&format!=="vtt")return Response.json({error:"Unsupported caption format"},{status:400});
    const status=await readJobStatus(jobId);
    const captionPath=format==="srt"?status.captions?.srtPath:status.captions?.vttPath;
    if(status.state!=="completed"||!captionPath)return Response.json({error:"Captions are not ready"},{status:409});
    const captions=await readFile(captionPath,"utf8");
    return new Response(captions,{headers:{"content-type":contentTypes[format],"content-disposition":`attachment; filename="${basename(captionPath)}"`,"cache-control":"private, no-store"}});
  }catch{
    return Response.json({error:"Captions not found"},{status:404});
  }
}
