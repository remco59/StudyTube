import {mkdir,writeFile} from "node:fs/promises";
import {dirname} from "node:path";
import {
  parseWavMetadata,
  StudyTubeTtsError,
  type TtsProvider,
  type TtsProviderResult,
  type TtsRequest,
} from "./index";

export const DEFAULT_EDGE_TTS_URL="http://neural-tts:5050";
export const DEFAULT_EDGE_TTS_VOICE="nl-NL-MaartenNeural";
export const DEFAULT_EDGE_TTS_RATE="+0%";

export type EdgeTtsConfig={
  baseUrl:string;
  voice:string;
  rate:string;
};

export const getEdgeTtsConfig=(env:NodeJS.ProcessEnv=process.env):EdgeTtsConfig=>{
  const rate=env.EDGE_TTS_RATE?.trim()||DEFAULT_EDGE_TTS_RATE;
  if(!/^[+-]\d{1,3}%$/u.test(rate))throw new StudyTubeTtsError("EDGE_TTS_RATE must look like +0%, -5% or +10%");
  return {
    baseUrl:env.EDGE_TTS_URL?.trim()||DEFAULT_EDGE_TTS_URL,
    voice:env.EDGE_TTS_VOICE?.trim()||DEFAULT_EDGE_TTS_VOICE,
    rate,
  };
};

export type EdgeTtsHttpProviderOptions={
  baseUrl?:string;
  defaultVoice?:string;
  defaultRate?:string;
  timeoutMs?:number;
  fetchImpl?:typeof fetch;
};

export class EdgeTtsHttpProvider implements TtsProvider{
  readonly id:string;
  private readonly baseUrl:string;
  private readonly defaultVoice:string;
  private readonly defaultRate:string;
  private readonly timeoutMs:number;
  private readonly fetchImpl:typeof fetch;

  constructor(options:EdgeTtsHttpProviderOptions={}){
    this.baseUrl=(options.baseUrl??DEFAULT_EDGE_TTS_URL).replace(/\/+$/u,"");
    this.defaultVoice=options.defaultVoice??DEFAULT_EDGE_TTS_VOICE;
    this.defaultRate=options.defaultRate??DEFAULT_EDGE_TTS_RATE;
    this.timeoutMs=options.timeoutMs??180_000;
    this.fetchImpl=options.fetchImpl??fetch;
    this.id=`edge-tts-http-v1:${this.defaultVoice}:${this.defaultRate}`;
  }

  async synthesize(request:TtsRequest,outputPath:string):Promise<TtsProviderResult>{
    if(!request.text.trim())throw new StudyTubeTtsError("TTS text cannot be empty");
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),this.timeoutMs);
    const voice=request.voice??this.voiceForLanguage(request.language);

    try{
      const response=await this.fetchImpl(`${this.baseUrl}/synthesize`,{
        method:"POST",
        headers:{"content-type":"application/json","accept":"audio/wav"},
        body:JSON.stringify({text:request.text,voice,rate:this.defaultRate}),
        signal:controller.signal,
      });
      if(!response.ok){
        const detail=(await response.text()).slice(0,400);
        throw new StudyTubeTtsError(`Neural TTS synthesis failed (${response.status}): ${detail||response.statusText}`);
      }
      const wav=Buffer.from(await response.arrayBuffer());
      parseWavMetadata(wav);
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,wav);
      return {voice};
    }catch(error){
      if(error instanceof StudyTubeTtsError)throw error;
      if(error instanceof Error&&error.name==="AbortError")throw new StudyTubeTtsError(`Neural TTS synthesis timed out after ${this.timeoutMs}ms`);
      throw new StudyTubeTtsError(`Neural TTS synthesis failed: ${error instanceof Error?error.message:String(error)}`);
    }finally{
      clearTimeout(timeout);
    }
  }

  private voiceForLanguage(language?:string):string{
    if(language==="en-US")return "en-US-GuyNeural";
    return this.defaultVoice;
  }
}
