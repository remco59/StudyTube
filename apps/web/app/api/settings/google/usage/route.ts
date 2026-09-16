import {getGoogleChirpUsage} from "@/lib/googleChirpUsage";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  try{
    const usage=await getGoogleChirpUsage();
    return Response.json(usage,{headers:{"cache-control":"no-store"}});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Could not load Google Chirp usage"},{status:503,headers:{"cache-control":"no-store"}});
  }
}
