import {listProjectRenderHistory} from "@/lib/jobs";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  try{
    const title=new URL(request.url).searchParams.get("title");
    if(!title)return Response.json({error:"Missing title query parameter"},{status:400});
    return Response.json({jobs:await listProjectRenderHistory(title)},{headers:{"cache-control":"no-store"}});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Could not load render history"},{status:500});
  }
}
