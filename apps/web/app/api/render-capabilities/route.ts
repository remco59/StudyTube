import {detectRenderCapabilities} from "@studytube/worker/render-engine";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  try{
    return Response.json(await detectRenderCapabilities(),{headers:{"cache-control":"no-store"}});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Could not detect render capabilities"},{status:500});
  }
}
