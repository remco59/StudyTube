export type GoogleChirpUsage={
  period:string;
  usedCharacters:number;
  limitCharacters:number;
  remainingCharacters:number;
  percentUsed:number;
  exhausted:boolean;
  resetsAt:string;
  trackingScope:string;
};

const cloudTtsBaseUrl=()=> (process.env.CLOUD_TTS_URL??"http://cloud-tts:5070").replace(/\/$/u,"");

export const getGoogleChirpUsage=async():Promise<GoogleChirpUsage>=>{
  let response:Response;
  try{
    response=await fetch(`${cloudTtsBaseUrl()}/google/usage`,{cache:"no-store",signal:AbortSignal.timeout(4000)});
  }catch{
    throw new Error("Could not verify Google Chirp free-tier usage. Rendering with Chirp is blocked to avoid paid usage.");
  }
  if(!response.ok){
    let detail="";
    try{const body=await response.json() as {detail?:unknown};if(typeof body.detail==="string")detail=body.detail;}catch{}
    throw new Error(detail||`Could not verify Google Chirp free-tier usage (HTTP ${response.status}). Rendering with Chirp is blocked to avoid paid usage.`);
  }
  const value=await response.json() as Partial<GoogleChirpUsage>;
  if(
    typeof value.period!=="string"||
    typeof value.usedCharacters!=="number"||
    typeof value.limitCharacters!=="number"||
    typeof value.remainingCharacters!=="number"||
    typeof value.percentUsed!=="number"||
    typeof value.exhausted!=="boolean"||
    typeof value.resetsAt!=="string"
  )throw new Error("Google Chirp usage response is invalid. Rendering with Chirp is blocked to avoid paid usage.");
  return {...value,trackingScope:typeof value.trackingScope==="string"?value.trackingScope:"StudyTube"} as GoogleChirpUsage;
};
