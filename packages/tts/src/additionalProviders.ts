import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {mkdir,writeFile} from "node:fs/promises";
import {basename,dirname} from "node:path";
import {parseWavMetadata,StudyTubeTtsError,type TtsProvider,type TtsProviderResult,type TtsRequest} from "./index";

export const DEFAULT_CHATTERBOX_URL="http://chatterbox:5080";
export const DEFAULT_XTTS_URL="http://xtts:5090";
export const DEFAULT_CLOUD_TTS_URL="http://cloud-tts:5070";
export const DEFAULT_GOOGLE_CHIRP_VOICE="nl-NL-Chirp3-HD-Charon";
export const DEFAULT_AZURE_VOICE="nl-NL-MaartenNeural";

export type ChatterboxHttpProviderOptions={
  baseUrl?:string;
  t3Model?:"v2"|"v3";
  exaggeration?:number;
  cfgWeight?:number;
  temperature?:number;
  referenceAudioPath?:string;
  timeoutMs?:number;
  fetchImpl?:typeof fetch;
};

export class ChatterboxHttpProvider implements TtsProvider{
  readonly id:string;
  private readonly baseUrl:string;
  private readonly t3Model:"v2"|"v3";
  private readonly exaggeration:number;
  private readonly cfgWeight:number;
  private readonly temperature:number;
  private readonly referenceAudioPath?:string;
  private readonly timeoutMs:number;
  private readonly fetchImpl:typeof fetch;
  private referenceAudioPromise?:Promise<string>;

  constructor(options:ChatterboxHttpProviderOptions={}){
    this.baseUrl=(options.baseUrl??process.env.CHATTERBOX_URL??DEFAULT_CHATTERBOX_URL).replace(/\/+$/u,"");
    this.t3Model=options.t3Model??(process.env.CHATTERBOX_T3_MODEL==="v3"?"v3":"v2");
    this.exaggeration=options.exaggeration??envNumber("CHATTERBOX_EXAGGERATION",.5);
    this.cfgWeight=options.cfgWeight??envNumber("CHATTERBOX_CFG_WEIGHT",.5);
    this.temperature=options.temperature??envNumber("CHATTERBOX_TEMPERATURE",.8);
    this.referenceAudioPath=options.referenceAudioPath;
    this.timeoutMs=options.timeoutMs??1_800_000;
    this.fetchImpl=options.fetchImpl??fetch;
    this.id=`chatterbox-http-v1:${hash({t3Model:this.t3Model,exaggeration:this.exaggeration,cfgWeight:this.cfgWeight,temperature:this.temperature,referenceAudioPath:this.referenceAudioPath})}`;
  }

  synthesize(request:TtsRequest,outputPath:string):Promise<TtsProviderResult>{
    return postWav({
      providerName:"Chatterbox",
      url:`${this.baseUrl}/synthesize`,
      outputPath,
      timeoutMs:this.timeoutMs,
      fetchImpl:this.fetchImpl,
      payload:async()=>({
        text:request.text,
        language:shortLanguage(request.language),
        t3Model:this.t3Model,
        exaggeration:this.exaggeration,
        cfgWeight:this.cfgWeight,
        temperature:this.temperature,
        referenceAudio:this.referenceAudioPath?await this.referenceAudio():undefined,
        referenceAudioName:this.referenceAudioPath?basename(this.referenceAudioPath):undefined,
      }),
      voice:this.referenceAudioPath?"voice-clone":`multilingual-${this.t3Model}`,
    });
  }

  private referenceAudio(){
    if(!this.referenceAudioPath)throw new StudyTubeTtsError("Chatterbox reference audio path is missing");
    this.referenceAudioPromise??=readFile(this.referenceAudioPath).then((buffer)=>buffer.toString("base64"));
    return this.referenceAudioPromise;
  }
}

export type XttsHttpProviderOptions={
  baseUrl?:string;
  speaker?:string;
  speed?:number;
  referenceAudioPath?:string;
  timeoutMs?:number;
  fetchImpl?:typeof fetch;
};

export class XttsHttpProvider implements TtsProvider{
  readonly id:string;
  private readonly baseUrl:string;
  private readonly speaker:string;
  private readonly speed:number;
  private readonly referenceAudioPath?:string;
  private readonly timeoutMs:number;
  private readonly fetchImpl:typeof fetch;
  private referenceAudioPromise?:Promise<string>;

  constructor(options:XttsHttpProviderOptions={}){
    this.baseUrl=(options.baseUrl??process.env.XTTS_URL??DEFAULT_XTTS_URL).replace(/\/+$/u,"");
    this.speaker=options.speaker?.trim()||process.env.XTTS_SPEAKER?.trim()||"Ana Florence";
    this.speed=options.speed??envNumber("XTTS_SPEED",1);
    this.referenceAudioPath=options.referenceAudioPath;
    this.timeoutMs=options.timeoutMs??1_800_000;
    this.fetchImpl=options.fetchImpl??fetch;
    this.id=`xtts-http-v1:${hash({speaker:this.speaker,speed:this.speed,referenceAudioPath:this.referenceAudioPath})}`;
  }

  synthesize(request:TtsRequest,outputPath:string):Promise<TtsProviderResult>{
    return postWav({
      providerName:"XTTS",
      url:`${this.baseUrl}/synthesize`,
      outputPath,
      timeoutMs:this.timeoutMs,
      fetchImpl:this.fetchImpl,
      payload:async()=>({
        text:request.text,
        language:shortLanguage(request.language),
        speaker:this.speaker,
        speed:this.speed,
        referenceAudio:this.referenceAudioPath?await this.referenceAudio():undefined,
        referenceAudioName:this.referenceAudioPath?basename(this.referenceAudioPath):undefined,
      }),
      voice:this.referenceAudioPath?"voice-clone":this.speaker,
    });
  }

  private referenceAudio(){
    if(!this.referenceAudioPath)throw new StudyTubeTtsError("XTTS reference audio path is missing");
    this.referenceAudioPromise??=readFile(this.referenceAudioPath).then((buffer)=>buffer.toString("base64"));
    return this.referenceAudioPromise;
  }
}

export type GoogleChirpHttpProviderOptions={baseUrl?:string;voice?:string;timeoutMs?:number;fetchImpl?:typeof fetch};
export class GoogleChirpHttpProvider implements TtsProvider{
  readonly id:string;
  private readonly baseUrl:string;
  private readonly voice:string;
  private readonly timeoutMs:number;
  private readonly fetchImpl:typeof fetch;
  constructor(options:GoogleChirpHttpProviderOptions={}){
    this.baseUrl=(options.baseUrl??process.env.CLOUD_TTS_URL??DEFAULT_CLOUD_TTS_URL).replace(/\/+$/u,"");
    this.voice=options.voice?.trim()||process.env.GOOGLE_CHIRP_VOICE?.trim()||DEFAULT_GOOGLE_CHIRP_VOICE;
    this.timeoutMs=options.timeoutMs??180_000;
    this.fetchImpl=options.fetchImpl??fetch;
    this.id=`google-chirp3-http-v1:${this.voice}`;
  }
  synthesize(request:TtsRequest,outputPath:string){
    return postWav({providerName:"Google Chirp 3",url:`${this.baseUrl}/google/synthesize`,outputPath,timeoutMs:this.timeoutMs,fetchImpl:this.fetchImpl,payload:async()=>({text:request.text,language:request.language??"nl-NL",voice:this.voice}),voice:this.voice});
  }
}

export type AzureSpeechHttpProviderOptions={baseUrl?:string;voice?:string;timeoutMs?:number;fetchImpl?:typeof fetch};
export class AzureSpeechHttpProvider implements TtsProvider{
  readonly id:string;
  private readonly baseUrl:string;
  private readonly voice:string;
  private readonly timeoutMs:number;
  private readonly fetchImpl:typeof fetch;
  constructor(options:AzureSpeechHttpProviderOptions={}){
    this.baseUrl=(options.baseUrl??process.env.CLOUD_TTS_URL??DEFAULT_CLOUD_TTS_URL).replace(/\/+$/u,"");
    this.voice=options.voice?.trim()||process.env.AZURE_TTS_VOICE?.trim()||DEFAULT_AZURE_VOICE;
    this.timeoutMs=options.timeoutMs??180_000;
    this.fetchImpl=options.fetchImpl??fetch;
    this.id=`azure-speech-http-v1:${this.voice}`;
  }
  synthesize(request:TtsRequest,outputPath:string){
    return postWav({providerName:"Azure Speech",url:`${this.baseUrl}/azure/synthesize`,outputPath,timeoutMs:this.timeoutMs,fetchImpl:this.fetchImpl,payload:async()=>({text:request.text,language:request.language??"nl-NL",voice:this.voice}),voice:this.voice});
  }
}

const postWav=async(options:{providerName:string;url:string;outputPath:string;timeoutMs:number;fetchImpl:typeof fetch;payload:()=>Promise<Record<string,unknown>>;voice:string}):Promise<TtsProviderResult>=>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),options.timeoutMs);
  try{
    const response=await options.fetchImpl(options.url,{method:"POST",headers:{"content-type":"application/json","accept":"audio/wav"},body:JSON.stringify(await options.payload()),signal:controller.signal});
    if(!response.ok){
      const detail=(await response.text()).slice(0,600);
      throw new StudyTubeTtsError(`${options.providerName} synthesis failed (${response.status}): ${detail||response.statusText}`);
    }
    const wav=Buffer.from(await response.arrayBuffer());
    parseWavMetadata(wav);
    await mkdir(dirname(options.outputPath),{recursive:true});
    await writeFile(options.outputPath,wav);
    return {voice:options.voice};
  }catch(error){
    if(error instanceof StudyTubeTtsError)throw error;
    if(error instanceof Error&&error.name==="AbortError")throw new StudyTubeTtsError(`${options.providerName} synthesis timed out after ${options.timeoutMs}ms`);
    throw new StudyTubeTtsError(`${options.providerName} synthesis failed: ${error instanceof Error?error.message:String(error)}`);
  }finally{clearTimeout(timeout);}
};

const shortLanguage=(language?:string)=>language?.split("-")[0]?.toLowerCase()||"nl";
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0,16);
const envNumber=(name:string,fallback:number)=>{const raw=process.env[name]?.trim();if(!raw)return fallback;const parsed=Number(raw);if(!Number.isFinite(parsed))throw new StudyTubeTtsError(`${name} must be a number`);return parsed;};
