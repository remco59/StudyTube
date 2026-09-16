import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {mkdir,writeFile} from "node:fs/promises";
import {basename,dirname} from "node:path";
import {
  parseWavMetadata,
  StudyTubeTtsError,
  type TtsProvider,
  type TtsProviderResult,
  type TtsRequest,
} from "./index";

export const DEFAULT_OMNIVOICE_URL="http://omnivoice:5060";
export const DEFAULT_OMNIVOICE_SPEED=1;
export const DEFAULT_OMNIVOICE_NUM_STEPS=16;

export type OmniVoiceConfig={
  baseUrl:string;
  speed:number;
  numSteps:number;
  instruction?:string;
  normalizeText:boolean;
};

export const getOmniVoiceConfig=(env:NodeJS.ProcessEnv=process.env):OmniVoiceConfig=>{
  const speed=parsePositiveNumber(env.OMNIVOICE_SPEED,DEFAULT_OMNIVOICE_SPEED,"OMNIVOICE_SPEED");
  const numSteps=parseInteger(env.OMNIVOICE_NUM_STEPS,DEFAULT_OMNIVOICE_NUM_STEPS,"OMNIVOICE_NUM_STEPS",8,64);
  return {
    baseUrl:env.OMNIVOICE_URL?.trim()||DEFAULT_OMNIVOICE_URL,
    speed,
    numSteps,
    instruction:env.OMNIVOICE_INSTRUCTION?.trim()||undefined,
    normalizeText:parseBoolean(env.OMNIVOICE_NORMALIZE_TEXT,true),
  };
};

export type OmniVoiceHttpProviderOptions={
  baseUrl?:string;
  speed?:number;
  numSteps?:number;
  instruction?:string;
  normalizeText?:boolean;
  referenceAudioPath?:string;
  referenceText?:string;
  timeoutMs?:number;
  fetchImpl?:typeof fetch;
};

export class OmniVoiceHttpProvider implements TtsProvider{
  readonly id:string;
  private readonly baseUrl:string;
  private readonly speed:number;
  private readonly numSteps:number;
  private readonly instruction?:string;
  private readonly normalizeText:boolean;
  private readonly referenceAudioPath?:string;
  private readonly referenceText?:string;
  private readonly timeoutMs:number;
  private readonly fetchImpl:typeof fetch;
  private referenceAudioPromise?:Promise<string>;

  constructor(options:OmniVoiceHttpProviderOptions={}){
    const config=getOmniVoiceConfig();
    this.baseUrl=(options.baseUrl??config.baseUrl).replace(/\/+$/u,"");
    this.speed=options.speed??config.speed;
    this.numSteps=options.numSteps??config.numSteps;
    this.instruction=options.instruction?.trim()||config.instruction;
    this.normalizeText=options.normalizeText??config.normalizeText;
    this.referenceAudioPath=options.referenceAudioPath;
    this.referenceText=options.referenceText?.trim()||undefined;
    this.timeoutMs=options.timeoutMs??1_800_000;
    this.fetchImpl=options.fetchImpl??fetch;
    if(!Number.isFinite(this.speed)||this.speed<=0)throw new StudyTubeTtsError("OmniVoice speed must be a positive number");
    if(!Number.isInteger(this.numSteps)||this.numSteps<8||this.numSteps>64)throw new StudyTubeTtsError("OmniVoice numSteps must be an integer from 8 to 64");
    const signature=JSON.stringify({speed:this.speed,numSteps:this.numSteps,instruction:this.instruction,normalizeText:this.normalizeText,referenceAudioPath:this.referenceAudioPath,referenceText:this.referenceText});
    this.id=`omnivoice-http-v1:${createHash("sha256").update(signature).digest("hex").slice(0,16)}`;
  }

  async synthesize(request:TtsRequest,outputPath:string):Promise<TtsProviderResult>{
    if(!request.text.trim())throw new StudyTubeTtsError("TTS text cannot be empty");
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{
      const referenceAudio=this.referenceAudioPath?await this.getReferenceAudio():undefined;
      const response=await this.fetchImpl(`${this.baseUrl}/synthesize`,{
        method:"POST",
        headers:{"content-type":"application/json","accept":"audio/wav"},
        body:JSON.stringify({
          text:request.text,
          language:languageCode(request.language),
          speed:this.speed,
          numSteps:this.numSteps,
          instruction:this.instruction,
          normalizeText:this.normalizeText,
          referenceAudio,
          referenceAudioName:this.referenceAudioPath?basename(this.referenceAudioPath):undefined,
          referenceText:this.referenceText,
        }),
        signal:controller.signal,
      });
      if(!response.ok){
        const detail=(await response.text()).slice(0,500);
        throw new StudyTubeTtsError(`OmniVoice synthesis failed (${response.status}): ${detail||response.statusText}`);
      }
      const wav=Buffer.from(await response.arrayBuffer());
      parseWavMetadata(wav);
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,wav);
      return {voice:this.referenceAudioPath?"voice-clone":this.instruction?"voice-design":"auto"};
    }catch(error){
      if(error instanceof StudyTubeTtsError)throw error;
      if(error instanceof Error&&error.name==="AbortError")throw new StudyTubeTtsError(`OmniVoice synthesis timed out after ${this.timeoutMs}ms`);
      throw new StudyTubeTtsError(`OmniVoice synthesis failed: ${error instanceof Error?error.message:String(error)}`);
    }finally{
      clearTimeout(timeout);
    }
  }

  private getReferenceAudio():Promise<string>{
    if(!this.referenceAudioPath)throw new StudyTubeTtsError("OmniVoice reference audio path is missing");
    this.referenceAudioPromise??=readFile(this.referenceAudioPath).then((buffer)=>buffer.toString("base64"));
    return this.referenceAudioPromise;
  }
}

const languageCode=(language?:string)=>{
  if(!language)return undefined;
  return language.split("-")[0]?.toLowerCase()||undefined;
};

const parsePositiveNumber=(value:string|undefined,fallback:number,name:string)=>{
  if(!value?.trim())return fallback;
  const parsed=Number(value);
  if(!Number.isFinite(parsed)||parsed<=0)throw new StudyTubeTtsError(`${name} must be a positive number`);
  return parsed;
};

const parseInteger=(value:string|undefined,fallback:number,name:string,min:number,max:number)=>{
  if(!value?.trim())return fallback;
  const parsed=Number(value);
  if(!Number.isInteger(parsed)||parsed<min||parsed>max)throw new StudyTubeTtsError(`${name} must be an integer from ${min} to ${max}`);
  return parsed;
};

const parseBoolean=(value:string|undefined,fallback:boolean)=>{
  if(value===undefined)return fallback;
  return !["0","false","no","off"].includes(value.trim().toLowerCase());
};
