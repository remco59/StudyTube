import type {StockProvider,StudyTubeAsset} from "@studytube/schema";
import {getStockCredentials,readAppSettings,type StockCredentials,type StockProviderName} from "@/lib/appSettings";

export type StockAssetKind="image"|"video";
type StockRequestAsset=Extract<StudyTubeAsset,{type:"stockImage"|"stockVideo"}>;
type ResolvedStockAsset=Extract<StudyTubeAsset,{type:"image"|"video"}>;

export type StockSearchResult={
  provider:StockProvider;
  providerId:string;
  kind:StockAssetKind;
  previewUrl:string;
  downloadUrl:string;
  downloadLocation?:string;
  width?:number;
  height?:number;
  durationSeconds?:number;
  creator?:string;
  creatorUrl?:string;
  sourceUrl?:string;
  alt?:string;
  attributionText?:string;
  licenseLabel:string;
};

export type PublicStockSearchResult=Omit<StockSearchResult,"downloadUrl"|"downloadLocation">;

const IMAGE_PROVIDER_ORDER:StockProviderName[]=["unsplash","pexels","pixabay"];
const VIDEO_PROVIDER_ORDER:StockProviderName[]=["pexels","pixabay"];
const MAX_DOWNLOAD_BYTES=100_000_000;
const PIXABAY_CACHE_MS=24*60*60*1000;
const DEFAULT_CACHE_MS=5*60*1000;
const searchCache=new Map<string,{expires:number;results:StockSearchResult[]}>();

export class StockAssetError extends Error{
  constructor(message:string){super(message);this.name="StockAssetError";}
}

export const searchStockAssets=async(input:{query:string;kind:StockAssetKind;providers?:StockProviderName[];limitPerProvider?:number})=>{
  const query=input.query.trim();
  if(!query)throw new StockAssetError("Stock media search query cannot be empty");
  const settings=await readAppSettings();
  const credentials=await getStockCredentials();
  const requested=input.providers?.length?input.providers:(input.kind==="video"?VIDEO_PROVIDER_ORDER:IMAGE_PROVIDER_ORDER);
  const providers=requested.filter((provider)=>supports(provider,input.kind)&&settings.assets.providers[provider]&&hasCredential(provider,credentials));
  if(providers.length===0)throw new StockAssetError(`No enabled ${input.kind} stock provider is configured. Add a Pixabay${input.kind==="video"?" or Pexels":" , Pexels or Unsplash"} API key in Settings.`);

  const results:StockSearchResult[]=[];
  const failures:string[]=[];
  for(const provider of providers){
    try{
      results.push(...await searchProvider(provider,query,input.kind,credentials,Math.max(1,Math.min(20,input.limitPerProvider??6))));
    }catch(error){failures.push(`${provider}: ${error instanceof Error?error.message:"search failed"}`);}
  }
  if(results.length===0&&failures.length>0)throw new StockAssetError(`Stock media search failed. ${failures.join("; ")}`);
  return results;
};

export const publicStockSearchResult=(result:StockSearchResult):PublicStockSearchResult=>{
  const publicResult={...result} as StockSearchResult&Partial<Pick<StockSearchResult,"downloadUrl"|"downloadLocation">>;
  delete publicResult.downloadUrl;
  delete publicResult.downloadLocation;
  return publicResult;
};

export const resolveStockAsset=async(request:StockRequestAsset):Promise<{asset:ResolvedStockAsset;data:Uint8Array}>=>{
  const kind:StockAssetKind=request.type==="stockVideo"?"video":"image";
  const preferred=request.provider&&request.provider!=="auto"?[request.provider as StockProviderName]:undefined;
  const results=await searchStockAssets({query:request.query,kind,providers:preferred,limitPerProvider:8});
  const selected=pickBestResult(results,kind);
  if(!selected)throw new StockAssetError(`No suitable ${kind} found for “${request.query}”. Try a broader stock-media query.`);

  const credentials=await getStockCredentials();
  const downloadUrl=selected.provider==="unsplash"?await triggerUnsplashDownload(selected,credentials):selected.downloadUrl;
  const downloaded=await downloadBinary(downloadUrl,kind);
  const extension=extensionFor(downloaded.contentType,kind,downloadUrl);
  const safeId=selected.providerId.replace(/[^a-zA-Z0-9_-]+/gu,"-").slice(0,80)||"asset";
  const path=`assets/stock/${selected.provider}-${safeId}.${extension}`;
  const alt=request.alt?.trim()||selected.alt||`${request.query} stock ${kind}`;
  const asset:ResolvedStockAsset={
    type:kind,
    path,
    alt:alt.slice(0,300),
    source:{
      provider:selected.provider,
      providerId:selected.providerId,
      query:request.query,
      creator:selected.creator,
      creatorUrl:selected.creatorUrl,
      sourceUrl:selected.sourceUrl,
      attributionText:selected.attributionText,
      licenseLabel:selected.licenseLabel,
    },
  } as ResolvedStockAsset;
  return {asset,data:downloaded.data};
};

const searchProvider=async(provider:StockProviderName,query:string,kind:StockAssetKind,credentials:StockCredentials,limit:number)=>{
  const cacheKey=`${provider}:${kind}:${limit}:${query.toLowerCase()}`;
  const cached=searchCache.get(cacheKey);
  if(cached&&cached.expires>Date.now())return cached.results;
  let results:StockSearchResult[];
  if(provider==="pixabay")results=await searchPixabay(query,kind,credentials.pixabayApiKey!,limit);
  else if(provider==="pexels")results=await searchPexels(query,kind,credentials.pexelsApiKey!,limit);
  else results=await searchUnsplash(query,credentials.unsplashAccessKey!,limit);
  searchCache.set(cacheKey,{expires:Date.now()+(provider==="pixabay"?PIXABAY_CACHE_MS:DEFAULT_CACHE_MS),results});
  return results;
};

const searchPixabay=async(query:string,kind:StockAssetKind,key:string,limit:number):Promise<StockSearchResult[]>=>{
  const endpoint=kind==="video"?"https://pixabay.com/api/videos/":"https://pixabay.com/api/";
  const params=new URLSearchParams({key,q:query,safesearch:"true",per_page:String(Math.max(3,limit))});
  if(kind==="image"){params.set("image_type","photo");params.set("orientation","horizontal");}
  const response=await fetch(`${endpoint}?${params}`,{headers:{accept:"application/json"},signal:AbortSignal.timeout(12_000)});
  if(!response.ok)throw new StockAssetError(`Pixabay returned HTTP ${response.status}`);
  const payload=await response.json() as {hits?:unknown[]};
  return (payload.hits??[]).map((raw)=>{
    const hit=asRecord(raw);
    if(!hit)return null;
    const id=String(hit.id??"");
    if(!id)return null;
    if(kind==="image"){
      const downloadUrl=text(hit.largeImageURL)||text(hit.webformatURL);
      if(!downloadUrl)return null;
      const creator=text(hit.user);
      return {
        provider:"pixabay" as const,providerId:id,kind,previewUrl:text(hit.webformatURL)||downloadUrl,downloadUrl,
        width:number(hit.imageWidth),height:number(hit.imageHeight),creator,sourceUrl:text(hit.pageURL),alt:text(hit.tags),
        attributionText:creator?`Image by ${creator} on Pixabay`:"Image from Pixabay",licenseLabel:"Pixabay Content License",
      };
    }
    const videos=asRecord(hit.videos);
    const chosen=choosePixabayVideo(videos);
    if(!chosen)return null;
    const creator=text(hit.user);
    return {
      provider:"pixabay" as const,providerId:id,kind,previewUrl:chosen.url,downloadUrl:chosen.url,width:chosen.width,height:chosen.height,
      durationSeconds:number(hit.duration),creator,sourceUrl:text(hit.pageURL),alt:text(hit.tags),
      attributionText:creator?`Video by ${creator} on Pixabay`:"Video from Pixabay",licenseLabel:"Pixabay Content License",
    };
  }).filter(isPresent).slice(0,limit);
};

const searchPexels=async(query:string,kind:StockAssetKind,key:string,limit:number):Promise<StockSearchResult[]>=>{
  const endpoint=kind==="video"?"https://api.pexels.com/v1/videos/search":"https://api.pexels.com/v1/search";
  const params=new URLSearchParams({query,per_page:String(limit),orientation:"landscape"});
  const response=await fetch(`${endpoint}?${params}`,{headers:{Authorization:key,accept:"application/json"},signal:AbortSignal.timeout(12_000)});
  if(!response.ok)throw new StockAssetError(`Pexels returned HTTP ${response.status}`);
  const payload=await response.json() as Record<string,unknown>;
  const items=Array.isArray(kind==="video"?payload.videos:payload.photos)?kind==="video"?payload.videos as unknown[]:payload.photos as unknown[]:[];
  return items.map((raw)=>{
    const item=asRecord(raw);if(!item)return null;const id=String(item.id??"");if(!id)return null;
    if(kind==="image"){
      const src=asRecord(item.src);const downloadUrl=text(src?.large2x)||text(src?.large)||text(src?.original);if(!downloadUrl)return null;
      const creator=text(item.photographer);
      return {provider:"pexels" as const,providerId:id,kind,previewUrl:text(src?.large)||downloadUrl,downloadUrl,width:number(item.width),height:number(item.height),creator,creatorUrl:text(item.photographer_url),sourceUrl:text(item.url),alt:text(item.alt),attributionText:creator?`Photo by ${creator} on Pexels`:"Photo from Pexels",licenseLabel:"Pexels License"};
    }
    const chosen=choosePexelsVideo(Array.isArray(item.video_files)?item.video_files:[]);if(!chosen)return null;
    const user=asRecord(item.user);const creator=text(user?.name);
    return {provider:"pexels" as const,providerId:id,kind,previewUrl:text(item.image)||chosen.link,downloadUrl:chosen.link,width:chosen.width??number(item.width),height:chosen.height??number(item.height),durationSeconds:number(item.duration),creator,creatorUrl:text(user?.url),sourceUrl:text(item.url),alt:`${query} stock video`,attributionText:creator?`Video by ${creator} on Pexels`:"Video from Pexels",licenseLabel:"Pexels License"};
  }).filter(isPresent);
};

const searchUnsplash=async(query:string,key:string,limit:number):Promise<StockSearchResult[]>=>{
  const params=new URLSearchParams({query,per_page:String(limit),orientation:"landscape",content_filter:"high"});
  const response=await fetch(`https://api.unsplash.com/search/photos?${params}`,{headers:{Authorization:`Client-ID ${key}`,"Accept-Version":"v1",accept:"application/json"},signal:AbortSignal.timeout(12_000)});
  if(!response.ok)throw new StockAssetError(`Unsplash returned HTTP ${response.status}`);
  const payload=await response.json() as {results?:unknown[]};
  return (payload.results??[]).map((raw)=>{
    const item=asRecord(raw);if(!item)return null;const id=text(item.id);if(!id)return null;
    const urls=asRecord(item.urls);const links=asRecord(item.links);const user=asRecord(item.user);const userLinks=asRecord(user?.links);
    const downloadUrl=text(urls?.full)||text(urls?.regular);const previewUrl=text(urls?.regular)||downloadUrl;const downloadLocation=text(links?.download_location);if(!downloadUrl||!previewUrl||!downloadLocation)return null;
    const creator=text(user?.name);
    return {provider:"unsplash" as const,providerId:id,kind:"image" as const,previewUrl,downloadUrl,downloadLocation,width:number(item.width),height:number(item.height),creator,creatorUrl:text(userLinks?.html),sourceUrl:text(links?.html),alt:text(item.alt_description)||text(item.description),attributionText:creator?`Photo by ${creator} on Unsplash`:"Photo from Unsplash",licenseLabel:"Unsplash License"};
  }).filter(isPresent);
};

const triggerUnsplashDownload=async(result:StockSearchResult,credentials:StockCredentials)=>{
  if(!result.downloadLocation||!credentials.unsplashAccessKey)throw new StockAssetError("Unsplash download tracking information is missing");
  const response=await fetch(result.downloadLocation,{headers:{Authorization:`Client-ID ${credentials.unsplashAccessKey}`,"Accept-Version":"v1",accept:"application/json"},signal:AbortSignal.timeout(12_000)});
  if(!response.ok)throw new StockAssetError(`Unsplash download tracking returned HTTP ${response.status}`);
  const payload=await response.json() as {url?:unknown};
  const url=text(payload.url);if(!url)throw new StockAssetError("Unsplash did not return a downloadable image URL");return url;
};

const downloadBinary=async(url:string,kind:StockAssetKind)=>{
  const response=await fetch(url,{headers:{accept:kind==="video"?"video/*":"image/*"},redirect:"follow",signal:AbortSignal.timeout(30_000)});
  if(!response.ok)throw new StockAssetError(`Could not download selected ${kind}: HTTP ${response.status}`);
  const contentLength=Number(response.headers.get("content-length")??0);
  if(Number.isFinite(contentLength)&&contentLength>MAX_DOWNLOAD_BYTES)throw new StockAssetError(`Selected ${kind} exceeds the 100 MB project-asset limit`);
  const data=new Uint8Array(await response.arrayBuffer());
  if(data.byteLength>MAX_DOWNLOAD_BYTES)throw new StockAssetError(`Selected ${kind} exceeds the 100 MB project-asset limit`);
  if(data.byteLength===0)throw new StockAssetError(`Selected ${kind} downloaded as an empty file`);
  return {data,contentType:response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()??""};
};

const pickBestResult=(results:StockSearchResult[],kind:StockAssetKind)=>results
  .filter((result)=>result.kind===kind)
  .sort((a,b)=>scoreResult(b,kind)-scoreResult(a,kind))[0];

const scoreResult=(result:StockSearchResult,kind:StockAssetKind)=>{
  let score=0;
  const width=result.width??0;const height=result.height??0;
  if(width>=1280)score+=4;if(width>=1920)score+=2;if(width>height)score+=3;
  if(kind==="video"){const duration=result.durationSeconds??0;if(duration>=6)score+=4;if(duration>=10)score+=2;if(duration>120)score-=2;}
  return score;
};

const choosePixabayVideo=(videos:Record<string,unknown>|undefined)=>{
  if(!videos)return null;
  const candidates=["medium","large","small","tiny"].map((key)=>asRecord(videos[key])).filter((value):value is Record<string,unknown>=>Boolean(value)).map((value)=>({url:text(value.url),width:number(value.width),height:number(value.height)})).filter((value):value is {url:string;width:number|undefined;height:number|undefined}=>Boolean(value.url));
  return candidates[0]??null;
};

const choosePexelsVideo=(files:unknown[])=>{
  const candidates=files.map(asRecord).filter((value):value is Record<string,unknown>=>Boolean(value)).filter((value)=>text(value.file_type)?.includes("mp4")).map((value)=>({link:text(value.link),width:number(value.width),height:number(value.height),quality:text(value.quality)})).filter((value):value is {link:string;width:number|undefined;height:number|undefined;quality:string|undefined}=>Boolean(value.link));
  candidates.sort((a,b)=>{const aWidth=a.width??0,bWidth=b.width??0;const aDistance=Math.abs(1920-aWidth),bDistance=Math.abs(1920-bWidth);return aDistance-bDistance;});
  return candidates[0]??null;
};

const supports=(provider:StockProviderName,kind:StockAssetKind)=>kind==="image"||provider!=="unsplash";
const hasCredential=(provider:StockProviderName,credentials:StockCredentials)=>provider==="pixabay"?Boolean(credentials.pixabayApiKey):provider==="pexels"?Boolean(credentials.pexelsApiKey):Boolean(credentials.unsplashAccessKey);
const asRecord=(value:unknown):Record<string,unknown>|undefined=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
const isPresent=<T>(value:T|null|undefined):value is T=>value!==null&&value!==undefined;
const text=(value:unknown)=>typeof value==="string"&&value.trim()?value.trim():undefined;
const number=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)?value:typeof value==="string"&&Number.isFinite(Number(value))?Number(value):undefined;
const extensionFor=(contentType:string,kind:StockAssetKind,url:string)=>{
  if(contentType==="image/png")return "png";if(contentType==="image/webp")return "webp";if(contentType==="image/jpeg"||contentType==="image/jpg")return "jpg";
  if(contentType==="video/webm")return "webm";if(contentType==="video/mp4")return "mp4";
  const pathname=new URL(url).pathname.toLowerCase();const match=pathname.match(/\.([a-z0-9]{2,5})$/u);if(match&&["jpg","jpeg","png","webp","mp4","webm"].includes(match[1]!))return match[1]==="jpeg"?"jpg":match[1]!;
  return kind==="video"?"mp4":"jpg";
};
