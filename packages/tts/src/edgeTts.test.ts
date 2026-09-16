import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach,describe,expect,it} from "vitest";
import {createSilentWavBuffer,parseWavMetadata} from "./index";
import {EdgeTtsHttpProvider,getEdgeTtsConfig} from "./edgeTts";

const tempDirs:string[]=[];
const tempDir=async()=>{const dir=await mkdtemp(join(tmpdir(),"studytube-edge-tts-"));tempDirs.push(dir);return dir;};
afterEach(async()=>{await Promise.all(tempDirs.splice(0).map((dir)=>rm(dir,{recursive:true,force:true})));});

describe("EdgeTtsHttpProvider",()=>{
  it("posts a Dutch neural voice request and writes WAV",async()=>{
    const dir=await tempDir();
    let posted:unknown;
    const provider=new EdgeTtsHttpProvider({
      baseUrl:"http://neural.test:5050/",
      defaultVoice:"nl-NL-MaartenNeural",
      defaultRate:"-2%",
      fetchImpl:async (_input,init)=>{
        posted=JSON.parse(String(init?.body));
        const wav=createSilentWavBuffer(.8,24_000);
        const body=wav.buffer.slice(wav.byteOffset,wav.byteOffset+wav.byteLength) as ArrayBuffer;
        return new Response(body,{status:200,headers:{"content-type":"audio/wav"}});
      },
    });
    const output=join(dir,"voice.wav");
    const result=await provider.synthesize({text:"Hallo vanuit StudyTube.",language:"nl-NL"},output);
    expect(posted).toEqual({text:"Hallo vanuit StudyTube.",voice:"nl-NL-MaartenNeural",rate:"-2%"});
    expect(result.voice).toBe("nl-NL-MaartenNeural");
    expect(parseWavMetadata(await readFile(output)).sampleRate).toBe(24_000);
  });

  it("uses an English neural voice for en-US projects",async()=>{
    let posted:unknown;
    const provider=new EdgeTtsHttpProvider({
      fetchImpl:async (_input,init)=>{
        posted=JSON.parse(String(init?.body));
        const wav=createSilentWavBuffer(.7);
        return new Response(wav.buffer.slice(wav.byteOffset,wav.byteOffset+wav.byteLength) as ArrayBuffer,{status:200});
      },
    });
    const dir=await tempDir();
    await provider.synthesize({text:"Hello from StudyTube.",language:"en-US"},join(dir,"en.wav"));
    expect(posted).toMatchObject({voice:"en-US-GuyNeural"});
  });
});

describe("Edge TTS config",()=>{
  it("reads neural voice settings from the environment",()=>{
    expect(getEdgeTtsConfig({EDGE_TTS_URL:"http://tts:5050",EDGE_TTS_VOICE:"nl-NL-ColetteNeural",EDGE_TTS_RATE:"-5%"})).toEqual({baseUrl:"http://tts:5050",voice:"nl-NL-ColetteNeural",rate:"-5%"});
  });
});
