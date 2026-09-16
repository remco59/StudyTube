import {mkdir,readFile,rename,rm,writeFile} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";
import {getDataDir} from "@/lib/jobs";

export type PromptLanguage="nl-NL"|"en-US";
export type RenderEngine="cpu"|"intel"|"nvidia";
export type TtsProviderChoice="edge"|"piper"|"omnivoice"|"chatterbox"|"xtts"|"google-chirp"|"azure";

export type StoredTtsSettings={
  provider:TtsProviderChoice;
  language:string;
  edge:{voice:string;rate:string};
  piper:{voice:string;lengthScale:number};
  omnivoice:{speed:number;numSteps:number;instruction:string;normalizeText:boolean;referenceText:string};
  chatterbox:{t3Model:"v2"|"v3";exaggeration:number;cfgWeight:number;temperature:number};
  xtts:{speaker:string;speed:number};
  googleChirp:{voice:string};
  azure:{voice:string};
};

export type AppSettings={
  promptDurationMinutes:number;
  promptLanguage:PromptLanguage;
  renderEngine:RenderEngine;
  tts:StoredTtsSettings;
};

export type CloudProviderStatus={
  googleConfigured:boolean;
  azureConfigured:boolean;
  serviceAvailable:boolean;
  error?:string;
};

const ttsProviders:TtsProviderChoice[]=["edge","piper","omnivoice","chatterbox","xtts","google-chirp","azure"];
const renderEngines:RenderEngine[]=["cpu","intel","nvidia"];
const promptLanguages:PromptLanguage[]=["nl-NL","en-US"];

export const defaultAppSettings=():AppSettings=>({
  promptDurationMinutes:8,
  promptLanguage:"nl-NL",
  renderEngine:"cpu",
  tts:{
    provider:ttsProviders.includes(process.env.STUDYTUBE_TTS_PROVIDER as TtsProviderChoice)?process.env.STUDYTUBE_TTS_PROVIDER as TtsProviderChoice:"edge",
    language:"nl-NL",
    edge:{voice:process.env.EDGE_TTS_VOICE?.trim()||"nl-NL-MaartenNeural",rate:process.env.EDGE_TTS_RATE?.trim()||"+0%"},
    piper:{voice:process.env.PIPER_VOICE?.trim()||"nl_NL-mls-medium",lengthScale:numberEnv("PIPER_LENGTH_SCALE",1,.4,3)},
    omnivoice:{speed:numberEnv("OMNIVOICE_SPEED",1,.4,3),numSteps:integerEnv("OMNIVOICE_NUM_STEPS",16,8,64),instruction:"male, young adult, medium pitch",normalizeText:booleanEnv("OMNIVOICE_NORMALIZE_TEXT",true),referenceText:""},
    chatterbox:{t3Model:process.env.CHATTERBOX_T3_MODEL==="v3"?"v3":"v2",exaggeration:numberEnv("CHATTERBOX_EXAGGERATION",.5,0,2),cfgWeight:numberEnv("CHATTERBOX_CFG_WEIGHT",.5,0,1),temperature:numberEnv("CHATTERBOX_TEMPERATURE",.8,.05,5)},
    xtts:{speaker:process.env.XTTS_SPEAKER?.trim()||"Ana Florence",speed:numberEnv("XTTS_SPEED",1,.4,3)},
    googleChirp:{voice:process.env.GOOGLE_CHIRP_VOICE?.trim()||"nl-NL-Chirp3-HD-Charon"},
    azure:{voice:process.env.AZURE_TTS_VOICE?.trim()||"nl-NL-MaartenNeural"},
  },
});

export const readAppSettings=async():Promise<AppSettings>=>{
  const defaults=defaultAppSettings();
  try{
    const parsed=JSON.parse(await readFile(settingsPath(),"utf8")) as unknown;
    return normalizeAppSettings(parsed,defaults);
  }catch(error){
    if(isMissing(error))return defaults;
    if(error instanceof SyntaxError)return defaults;
    throw error;
  }
};

export const writeAppSettings=async(input:unknown):Promise<AppSettings>=>{
  const current=await readAppSettings();
  const settings=normalizeAppSettings(input,current);
  const path=settingsPath();
  const temporary=`${path}.tmp`;
  await mkdir(dirname(path),{recursive:true});
  await writeFile(temporary,`${JSON.stringify(settings,null,2)}\n`,{encoding:"utf8",mode:0o600});
  await rename(temporary,path);
  return settings;
};

export const getCloudProviderStatus=async():Promise<CloudProviderStatus>=>{
  const baseUrl=(process.env.CLOUD_TTS_URL??"http://cloud-tts:5070").replace(/\/$/u,"");
  try{
    const response=await fetch(`${baseUrl}/health`,{cache:"no-store",signal:AbortSignal.timeout(4000)});
    if(!response.ok)throw new Error(`Cloud TTS returned HTTP ${response.status}`);
    const result=await response.json() as {googleConfigured?:unknown;azureConfigured?:unknown};
    return {googleConfigured:result.googleConfigured===true,azureConfigured:result.azureConfigured===true,serviceAvailable:true};
  }catch(error){
    return {googleConfigured:false,azureConfigured:false,serviceAvailable:false,error:error instanceof Error?error.message:"Cloud TTS is unavailable"};
  }
};

export const getAzurePublicConfiguration=async()=>{
  const stored=await readCloudCredentials();
  return {
    region:stored.azureSpeechRegion??process.env.AZURE_SPEECH_REGION?.trim()??"",
    endpoint:stored.azureSpeechEndpoint??process.env.AZURE_SPEECH_ENDPOINT?.trim()??"",
  };
};

export const writeGoogleCredentials=async(contents:string)=>{
  if(Buffer.byteLength(contents,"utf8")>512_000)throw new Error("Google credentials file is too large");
  let parsed:unknown;
  try{parsed=JSON.parse(contents);}catch{throw new Error("Google credentials must be valid JSON");}
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("Google credentials must contain a JSON object");
  await ensureCredentialsDir();
  await writeFile(join(credentialsDir(),"google.json"),`${JSON.stringify(parsed,null,2)}\n`,{encoding:"utf8",mode:0o600});
};

export const removeGoogleCredentials=()=>rm(join(credentialsDir(),"google.json"),{force:true});

export const writeAzureCredentials=async(input:{key?:string;region?:string;endpoint?:string})=>{
  const current=await readCloudCredentials();
  const key=input.key?.trim()||current.azureSpeechKey||"";
  const region=input.region?.trim()||"";
  const endpoint=input.endpoint?.trim()||"";
  if(!region)throw new Error("Azure region is required");
  if(endpoint&&!/^https:\/\//iu.test(endpoint))throw new Error("Azure endpoint must start with https://");
  if(!key&&!process.env.AZURE_SPEECH_KEY?.trim())throw new Error("Azure Speech key is required");
  await writeCloudCredentials({azureSpeechKey:key||undefined,azureSpeechRegion:region,azureSpeechEndpoint:endpoint||undefined});
};

export const removeAzureCredentials=async()=>{
  const current=await readCloudCredentials();
  delete current.azureSpeechKey;
  delete current.azureSpeechRegion;
  delete current.azureSpeechEndpoint;
  if(Object.keys(current).length===0){await rm(cloudCredentialsPath(),{force:true});return;}
  await writeCloudCredentials(current);
};

export const normalizeAppSettings=(input:unknown,fallback=defaultAppSettings()):AppSettings=>{
  const root=record(input);
  const tts=record(root?.tts);
  const edge=record(tts?.edge);
  const piper=record(tts?.piper);
  const omnivoice=record(tts?.omnivoice);
  const chatterbox=record(tts?.chatterbox);
  const xtts=record(tts?.xtts);
  const googleChirp=record(tts?.googleChirp);
  const azure=record(tts?.azure);
  return {
    promptDurationMinutes:numberValue(root?.promptDurationMinutes,fallback.promptDurationMinutes,.5,120),
    promptLanguage:enumValue(root?.promptLanguage,promptLanguages,fallback.promptLanguage),
    renderEngine:enumValue(root?.renderEngine,renderEngines,fallback.renderEngine),
    tts:{
      provider:enumValue(tts?.provider,ttsProviders,fallback.tts.provider),
      language:textValue(tts?.language,fallback.tts.language,24),
      edge:{voice:textValue(edge?.voice,fallback.tts.edge.voice,160),rate:rateValue(edge?.rate,fallback.tts.edge.rate)},
      piper:{voice:textValue(piper?.voice,fallback.tts.piper.voice,160),lengthScale:numberValue(piper?.lengthScale,fallback.tts.piper.lengthScale,.4,3)},
      omnivoice:{speed:numberValue(omnivoice?.speed,fallback.tts.omnivoice.speed,.4,3),numSteps:integerValue(omnivoice?.numSteps,fallback.tts.omnivoice.numSteps,8,64),instruction:textValue(omnivoice?.instruction,fallback.tts.omnivoice.instruction,300),normalizeText:booleanValue(omnivoice?.normalizeText,fallback.tts.omnivoice.normalizeText),referenceText:textValue(omnivoice?.referenceText,fallback.tts.omnivoice.referenceText,1200,true)},
      chatterbox:{t3Model:enumValue(chatterbox?.t3Model,["v2","v3"] as const,fallback.tts.chatterbox.t3Model),exaggeration:numberValue(chatterbox?.exaggeration,fallback.tts.chatterbox.exaggeration,0,2),cfgWeight:numberValue(chatterbox?.cfgWeight,fallback.tts.chatterbox.cfgWeight,0,1),temperature:numberValue(chatterbox?.temperature,fallback.tts.chatterbox.temperature,.05,5)},
      xtts:{speaker:textValue(xtts?.speaker,fallback.tts.xtts.speaker,160),speed:numberValue(xtts?.speed,fallback.tts.xtts.speed,.4,3)},
      googleChirp:{voice:textValue(googleChirp?.voice,fallback.tts.googleChirp.voice,200)},
      azure:{voice:textValue(azure?.voice,fallback.tts.azure.voice,200)},
    },
  };
};

type CloudCredentials={azureSpeechKey?:string;azureSpeechRegion?:string;azureSpeechEndpoint?:string};
const settingsPath=()=>join(getDataDir(),"settings.json");
const credentialsDir=()=>resolve(process.env.STUDYTUBE_CREDENTIALS_DIR??"credentials");
const cloudCredentialsPath=()=>join(credentialsDir(),"cloud.json");
const ensureCredentialsDir=()=>mkdir(credentialsDir(),{recursive:true});

const readCloudCredentials=async():Promise<CloudCredentials>=>{
  try{
    const parsed=JSON.parse(await readFile(cloudCredentialsPath(),"utf8")) as unknown;
    const value=record(parsed);
    if(!value)return {};
    return {
      azureSpeechKey:optionalText(value.azureSpeechKey,1000),
      azureSpeechRegion:optionalText(value.azureSpeechRegion,120),
      azureSpeechEndpoint:optionalText(value.azureSpeechEndpoint,600),
    };
  }catch(error){if(isMissing(error)||error instanceof SyntaxError)return {};throw error;}
};

const writeCloudCredentials=async(value:CloudCredentials)=>{
  await ensureCredentialsDir();
  const path=cloudCredentialsPath();
  const temporary=`${path}.tmp`;
  await writeFile(temporary,`${JSON.stringify(value,null,2)}\n`,{encoding:"utf8",mode:0o600});
  await rename(temporary,path);
};

const record=(value:unknown):Record<string,unknown>|undefined=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
const optionalText=(value:unknown,max:number)=>typeof value==="string"&&value.trim()?value.trim().slice(0,max):undefined;
const textValue=(value:unknown,fallback:string,max:number,allowEmpty=false)=>{if(typeof value!=="string")return fallback;const text=value.trim();return text||allowEmpty?text.slice(0,max):fallback;};
const numberValue=(value:unknown,fallback:number,min:number,max:number)=>{const parsed=typeof value==="number"?value:Number(value);return Number.isFinite(parsed)&&parsed>=min&&parsed<=max?parsed:fallback;};
const integerValue=(value:unknown,fallback:number,min:number,max:number)=>{const parsed=numberValue(value,fallback,min,max);return Number.isInteger(parsed)?parsed:fallback;};
const booleanValue=(value:unknown,fallback:boolean)=>typeof value==="boolean"?value:fallback;
const enumValue=<T extends string>(value:unknown,allowed:readonly T[],fallback:T):T=>typeof value==="string"&&allowed.includes(value as T)?value as T:fallback;
const rateValue=(value:unknown,fallback:string)=>typeof value==="string"&&/^[+-]\d{1,3}%$/u.test(value.trim())?value.trim():fallback;
const isMissing=(error:unknown)=>error instanceof Error&&"code" in error&&(error as NodeJS.ErrnoException).code==="ENOENT";
const numberEnv=(key:string,fallback:number,min:number,max:number)=>numberValue(process.env[key],fallback,min,max);
const integerEnv=(key:string,fallback:number,min:number,max:number)=>integerValue(process.env[key],fallback,min,max);
const booleanEnv=(key:string,fallback:boolean)=>process.env[key]===undefined?fallback:!["0","false","no","off"].includes(process.env[key]!.trim().toLowerCase());
