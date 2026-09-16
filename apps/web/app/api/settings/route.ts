import {getAzurePublicConfiguration,getCloudProviderStatus,readAppSettings,writeAppSettings} from "@/lib/appSettings";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  try{
    const [settings,status,azure]=await Promise.all([
      readAppSettings(),
      getCloudProviderStatus(),
      getAzurePublicConfiguration(),
    ]);
    return Response.json({
      settings,
      providers:{
        google:{configured:status.googleConfigured},
        azure:{configured:status.azureConfigured,region:azure.region,endpoint:azure.endpoint},
        cloudService:{available:status.serviceAvailable,error:status.error},
      },
    },{headers:{"cache-control":"no-store"}});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Could not load settings"},{status:500});
  }
}

export async function PUT(request:Request){
  try{
    const body=await request.json() as unknown;
    const root=body&&typeof body==="object"&&!Array.isArray(body)?body as Record<string,unknown>:{};
    const settings=await writeAppSettings(root.settings??body);
    return Response.json({settings});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Could not save settings"},{status:400});
  }
}
