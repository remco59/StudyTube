import {getStockProviderStatus,removeStockCredential,writeStockCredentials,type StockProviderName} from "@/lib/appSettings";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function PUT(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;
    await writeStockCredentials({
      pixabayApiKey:text(body.pixabayApiKey),
      pexelsApiKey:text(body.pexelsApiKey),
      unsplashAccessKey:text(body.unsplashAccessKey),
    });
    return Response.json({providers:await getStockProviderStatus()});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Could not save stock provider credentials"},{status:400});}
}

export async function DELETE(request:Request){
  try{
    const provider=new URL(request.url).searchParams.get("provider");
    if(provider!=="pixabay"&&provider!=="pexels"&&provider!=="unsplash")return Response.json({error:"Choose pixabay, pexels or unsplash"},{status:400});
    await removeStockCredential(provider as StockProviderName);
    return Response.json({providers:await getStockProviderStatus()});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Could not remove stock provider credentials"},{status:400});}
}

const text=(value:unknown)=>typeof value==="string"?value:undefined;
