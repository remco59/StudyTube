export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  return Response.json({ok:true,service:"studytube"},{headers:{"cache-control":"no-store"}});
}
