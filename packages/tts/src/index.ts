import {createHash,randomUUID} from "node:crypto";
import {mkdir,readFile,rename,stat,unlink,writeFile} from "node:fs/promises";
import {dirname,join} from "node:path";

export type TtsRequest={
  text:string;
  language?:string;
  voice?:string;
  lengthScale?:number;
};

export type TtsProviderResult={voice?:string};

export interface TtsProvider{
  readonly id:string;
  synthesize(request:TtsRequest,outputPath:string):Promise<TtsProviderResult>;
}

export type NarrationAudio={
  path:string;
  durationSeconds:number;
  sampleRate:number;
  channels:number;
  bitsPerSample:number;
  cacheHit:boolean;
  providerId:string;
  voice?:string;
};

export type WavMetadata={
  durationSeconds:number;
  sampleRate:number;
  channels:number;
  bitsPerSample:number;
  dataBytes:number;
};

export class StudyTubeTtsError extends Error{
  constructor(message:string){super(message);this.name="StudyTubeTtsError";}
}

export const DEFAULT_DUTCH_LANGUAGE="nl-NL";
export const DEFAULT_PIPER_URL="http://piper:5000";

export type DutchPiperConfig={
  language:"nl-NL";
  baseUrl:string;
  voice?:string;
  lengthScale?:number;
};

export const getDutchPiperConfig=(env:NodeJS.ProcessEnv=process.env):DutchPiperConfig=>{
  const parsedLengthScale=env.PIPER_LENGTH_SCALE?Number(env.PIPER_LENGTH_SCALE):undefined;
  if(parsedLengthScale!==undefined&&(!Number.isFinite(parsedLengthScale)||parsedLengthScale<=0)){
    throw new StudyTubeTtsError("PIPER_LENGTH_SCALE must be a positive number");
  }
  return {
    language:"nl-NL",
    baseUrl:env.PIPER_URL?.trim()||DEFAULT_PIPER_URL,
    voice:env.PIPER_VOICE?.trim()||undefined,
    lengthScale:parsedLengthScale,
  };
};

export type PiperHttpProviderOptions={
  baseUrl?:string;
  defaultVoice?:string;
  defaultLanguage?:string;
  defaultLengthScale?:number;
  timeoutMs?:number;
  fetchImpl?:typeof fetch;
};

export class PiperHttpProvider implements TtsProvider{
  readonly id="piper-http-v1";
  private readonly baseUrl:string;
  private readonly defaultVoice?:string;
  private readonly defaultLanguage:string;
  private readonly defaultLengthScale?:number;
  private readonly timeoutMs:number;
  private readonly fetchImpl:typeof fetch;

  constructor(options:PiperHttpProviderOptions={}){
    this.baseUrl=(options.baseUrl??DEFAULT_PIPER_URL).replace(/\/+$/u,"");
    this.defaultVoice=options.defaultVoice;
    this.defaultLanguage=options.defaultLanguage??DEFAULT_DUTCH_LANGUAGE;
    this.defaultLengthScale=options.defaultLengthScale;
    this.timeoutMs=options.timeoutMs??120_000;
    this.fetchImpl=options.fetchImpl??fetch;
  }

  async synthesize(request:TtsRequest,outputPath:string):Promise<TtsProviderResult>{
    assertText(request.text);
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),this.timeoutMs);
    const voice=request.voice??this.defaultVoice;
    const lengthScale=request.lengthScale??this.defaultLengthScale;
    const payload:Record<string,unknown>={text:request.text};
    if(voice) payload.voice=voice;
    if(lengthScale!==undefined) payload.length_scale=lengthScale;

    try{
      const response=await this.fetchImpl(`${this.baseUrl}/synthesize`,{
        method:"POST",
        headers:{"content-type":"application/json","accept":"audio/wav"},
        body:JSON.stringify(payload),
        signal:controller.signal,
      });
      if(!response.ok){
        const detail=(await response.text()).slice(0,400);
        throw new StudyTubeTtsError(`Piper synthesis failed (${response.status}): ${detail||response.statusText}`);
      }
      const wav=Buffer.from(await response.arrayBuffer());
      parseWavMetadata(wav);
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,wav);
      return {voice};
    }catch(error){
      if(error instanceof StudyTubeTtsError) throw error;
      if(error instanceof Error&&error.name==="AbortError") throw new StudyTubeTtsError(`Piper synthesis timed out after ${this.timeoutMs}ms`);
      throw new StudyTubeTtsError(`Piper synthesis failed: ${error instanceof Error?error.message:String(error)}`);
    }finally{
      clearTimeout(timeout);
    }
  }

  get language():string{return this.defaultLanguage;}
}

export class SyntheticWavProvider implements TtsProvider{
  readonly id="synthetic-wav-v1";
  private readonly wordsPerMinute:number;
  constructor(wordsPerMinute=155){
    if(!Number.isFinite(wordsPerMinute)||wordsPerMinute<=0) throw new StudyTubeTtsError("wordsPerMinute must be positive");
    this.wordsPerMinute=wordsPerMinute;
  }
  async synthesize(request:TtsRequest,outputPath:string):Promise<TtsProviderResult>{
    assertText(request.text);
    const words=request.text.trim().split(/\s+/u).filter(Boolean).length;
    const duration=Math.max(.6,(words/this.wordsPerMinute)*60);
    await mkdir(dirname(outputPath),{recursive:true});
    await writeFile(outputPath,createSilentWavBuffer(duration));
    return {voice:request.voice??"synthetic"};
  }
}

export class NarrationAudioCache{
  constructor(private readonly cacheDir:string,private readonly provider:TtsProvider){}

  async synthesize(request:TtsRequest):Promise<NarrationAudio>{
    assertText(request.text);
    await mkdir(this.cacheDir,{recursive:true});
    const key=createHash("sha256").update(JSON.stringify({provider:this.provider.id,request})).digest("hex");
    const outputPath=join(this.cacheDir,`${key}.wav`);
    if(await fileExists(outputPath)){
      const metadata=await readWavMetadata(outputPath);
      return {...metadata,path:outputPath,cacheHit:true,providerId:this.provider.id,voice:request.voice};
    }

    const tempPath=join(this.cacheDir,`${key}.${process.pid}.${randomUUID()}.tmp.wav`);
    try{
      const providerResult=await this.provider.synthesize(request,tempPath);
      const metadata=await readWavMetadata(tempPath);
      await rename(tempPath,outputPath);
      return {...metadata,path:outputPath,cacheHit:false,providerId:this.provider.id,voice:providerResult.voice??request.voice};
    }finally{
      await unlink(tempPath).catch(()=>undefined);
    }
  }
}

export const readWavMetadata=async(path:string):Promise<WavMetadata>=>parseWavMetadata(await readFile(path));

export const parseWavMetadata=(buffer:Buffer):WavMetadata=>{
  if(buffer.length<44||buffer.toString("ascii",0,4)!=="RIFF"||buffer.toString("ascii",8,12)!=="WAVE") throw new StudyTubeTtsError("Audio is not a valid RIFF/WAVE file");
  let offset=12;let sampleRate=0;let channels=0;let bitsPerSample=0;let byteRate=0;let dataBytes=0;
  while(offset+8<=buffer.length){
    const id=buffer.toString("ascii",offset,offset+4);const size=buffer.readUInt32LE(offset+4);const body=offset+8;
    if(body+size>buffer.length) throw new StudyTubeTtsError(`Invalid WAV chunk ${id}`);
    if(id==="fmt "){
      if(size<16) throw new StudyTubeTtsError("Invalid WAV fmt chunk");
      channels=buffer.readUInt16LE(body+2);sampleRate=buffer.readUInt32LE(body+4);byteRate=buffer.readUInt32LE(body+8);bitsPerSample=buffer.readUInt16LE(body+14);
    }else if(id==="data") dataBytes=size;
    offset=body+size+(size%2);
  }
  if(!sampleRate||!channels||!bitsPerSample||!byteRate||!dataBytes) throw new StudyTubeTtsError("WAV file is missing required fmt/data metadata");
  return {durationSeconds:dataBytes/byteRate,sampleRate,channels,bitsPerSample,dataBytes};
};

export const createSilentWavBuffer=(durationSeconds:number,sampleRate=22_050):Buffer=>{
  if(!Number.isFinite(durationSeconds)||durationSeconds<=0) throw new StudyTubeTtsError("durationSeconds must be positive");
  if(!Number.isInteger(sampleRate)||sampleRate<=0) throw new StudyTubeTtsError("sampleRate must be a positive integer");
  const channels=1;const bitsPerSample=16;const bytesPerSample=bitsPerSample/8;const frameCount=Math.max(1,Math.round(durationSeconds*sampleRate));const dataBytes=frameCount*channels*bytesPerSample;const buffer=Buffer.alloc(44+dataBytes);
  buffer.write("RIFF",0,"ascii");buffer.writeUInt32LE(36+dataBytes,4);buffer.write("WAVE",8,"ascii");buffer.write("fmt ",12,"ascii");buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(channels,22);buffer.writeUInt32LE(sampleRate,24);const byteRate=sampleRate*channels*bytesPerSample;buffer.writeUInt32LE(byteRate,28);buffer.writeUInt16LE(channels*bytesPerSample,32);buffer.writeUInt16LE(bitsPerSample,34);buffer.write("data",36,"ascii");buffer.writeUInt32LE(dataBytes,40);
  return buffer;
};

const fileExists=async(path:string):Promise<boolean>=>{try{return (await stat(path)).isFile();}catch{return false;}};
const assertText=(text:string)=>{if(!text.trim()) throw new StudyTubeTtsError("TTS text cannot be empty");};
