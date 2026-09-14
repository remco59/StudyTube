import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach,describe,expect,it} from "vitest";
import {
  createSilentWavBuffer,
  getDutchPiperConfig,
  NarrationAudioCache,
  parseWavMetadata,
  PiperHttpProvider,
  SyntheticWavProvider,
} from "./index";

const tempDirs:string[]=[];
const tempDir=async()=>{const dir=await mkdtemp(join(tmpdir(),"studytube-tts-"));tempDirs.push(dir);return dir;};
afterEach(async()=>{await Promise.all(tempDirs.splice(0).map((dir)=>rm(dir,{recursive:true,force:true})));});

describe("WAV metadata",()=>{
  it("measures generated PCM duration",()=>{
    const wav=createSilentWavBuffer(1.25,16_000);
    const metadata=parseWavMetadata(wav);
    expect(metadata.sampleRate).toBe(16_000);
    expect(metadata.channels).toBe(1);
    expect(metadata.bitsPerSample).toBe(16);
    expect(metadata.durationSeconds).toBeCloseTo(1.25,3);
  });
});

describe("NarrationAudioCache",()=>{
  it("generates once and then reuses the WAV",async()=>{
    const dir=await tempDir();
    const cache=new NarrationAudioCache(dir,new SyntheticWavProvider());
    const first=await cache.synthesize({text:"Dit is een korte Nederlandse testzin.",language:"nl-NL"});
    const second=await cache.synthesize({text:"Dit is een korte Nederlandse testzin.",language:"nl-NL"});
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.path).toBe(first.path);
    expect(second.durationSeconds).toBeGreaterThan(0);
    expect((await readFile(second.path)).subarray(0,4).toString("ascii")).toBe("RIFF");
  });
});

describe("PiperHttpProvider",()=>{
  it("posts Piper-compatible synthesis JSON and writes WAV",async()=>{
    const dir=await tempDir();
    let posted:unknown;
    const provider=new PiperHttpProvider({
      baseUrl:"http://piper.test:5000/",
      defaultVoice:"nl_NL-test-medium",
      defaultLengthScale:1.05,
      fetchImpl:async (_input,init)=>{
        posted=JSON.parse(String(init?.body));
        const wav=createSilentWavBuffer(.8);
        const body=wav.buffer.slice(wav.byteOffset,wav.byteOffset+wav.byteLength) as ArrayBuffer;
        return new Response(body,{status:200,headers:{"content-type":"audio/wav"}});
      },
    });
    const output=join(dir,"voice.wav");
    const result=await provider.synthesize({text:"Hallo vanuit StudyTube."},output);
    expect(posted).toEqual({text:"Hallo vanuit StudyTube.",voice:"nl_NL-test-medium",length_scale:1.05});
    expect(result.voice).toBe("nl_NL-test-medium");
    expect(parseWavMetadata(await readFile(output)).durationSeconds).toBeCloseTo(.8,2);
  });
});

describe("Dutch Piper config",()=>{
  it("reads Unraid-friendly environment variables",()=>{
    expect(getDutchPiperConfig({PIPER_URL:"http://tts:5000",PIPER_VOICE:"nl_NL-demo",PIPER_LENGTH_SCALE:"0.95"})).toEqual({language:"nl-NL",baseUrl:"http://tts:5000",voice:"nl_NL-demo",lengthScale:.95});
  });
});
