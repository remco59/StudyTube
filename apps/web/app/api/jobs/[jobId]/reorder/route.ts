import {moveQueuedJob} from "@/lib/renderQueue";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request,{params}:{params:Promise<{jobId:string}>}){
  try{
    const {jobId}=await params;
    const body=await request.json() as {direction?:unknown};
    if(body.direction!=="up"&&body.direction!=="down")return Response.json({error:"direction must be \"up\" or \"down\""},{status:400});
    const moved=moveQueuedJob(jobId,body.direction);
    if(!moved)return Response.json({error:"Job is not waiting in the queue"},{status:409});
    return Response.json({ok:true});
  }catch{
    return Response.json({error:"Could not reorder job"},{status:400});
  }
}
