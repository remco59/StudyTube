import {publicStockSearchResult,searchStockAssets,type StockAssetKind,StockAssetError} from "@/lib/stockAssets";
import type {StockProviderName} from "@/lib/appSettings";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:Request){
  try{
    const body=await request.json() as Record<string,unknown>;
    const query=typeof body.query==="string"?body.query.trim():"";
    const kind=body.kind==="video"?"video":body.kind==="image"?"image":null;
    if(!query)return Response.json({error:"Search query is required"},{status:400});
    if(!kind)return Response.json({error:"kind must be image or video"},{status:400});
    const providers=Array.isArray(body.providers)?body.providers.filter(isProvider):undefined;
    const limit=typeof body.limitPerProvider==="number"?body.limitPerProvider:undefined;
    const results=await searchStockAssets({query,kind:kind as StockAssetKind,providers,limitPerProvider:limit});
    return Response.json({results:results.map(publicStockSearchResult)},{headers:{"cache-control":"no-store"}});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Stock media search failed"},{status:error instanceof StockAssetError?400:500});
  }
}

const isProvider=(value:unknown):value is StockProviderName=>value==="pixabay"||value==="pexels"||value==="unsplash";
