import {removeAzureCredentials,writeAzureCredentials} from "@/lib/appSettings";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function PUT(request:Request){
  try{
    const body=await request.json() as {key?:unknown;region?:unknown;endpoint?:unknown};
    await writeAzureCredentials({
      key:typeof body.key==="string"?body.key:undefined,
      region:typeof body.region==="string"?body.region:undefined,
      endpoint:typeof body.endpoint==="string"?body.endpoint:undefined,
    });
    return Response.json({ok:true});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Could not save Azure credentials"},{status:400});
  }
}

export async function DELETE(){
  try{await removeAzureCredentials();return Response.json({ok:true});}
  catch(error){return Response.json({error:error instanceof Error?error.message:"Could not remove Azure credentials"},{status:500});}
}
