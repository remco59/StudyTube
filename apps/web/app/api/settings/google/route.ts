import {removeGoogleCredentials,writeGoogleCredentials} from "@/lib/appSettings";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request){
  try{
    const form=await request.formData();
    const file=form.get("credentials");
    if(!(file instanceof File)||file.size===0)return Response.json({error:"Choose a Google credentials JSON file"},{status:400});
    if(file.size>512_000)return Response.json({error:"Google credentials file is too large (max 512 KB)"},{status:413});
    await writeGoogleCredentials(await file.text());
    return Response.json({ok:true});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Could not save Google credentials"},{status:400});
  }
}

export async function DELETE(){
  try{await removeGoogleCredentials();return Response.json({ok:true});}
  catch(error){return Response.json({error:error instanceof Error?error.message:"Could not remove Google credentials"},{status:500});}
}
