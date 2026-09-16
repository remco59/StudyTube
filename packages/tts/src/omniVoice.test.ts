import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach,describe,expect,it} from "vitest";
import {createSilentWavBuffer,parseWavMetadata} from "./index";
import {getOmniVoiceConfig,OmniVoiceHttpProvider} from "./omniVoice";

const tempDirs:string[]=[];
const tempDir=async()=>{const dir=await mkdtemp(join(tmpdir(),"studytube-omnivoice-"));tempDirs.push(dir);return dir;};
afterEach(async()=>{await Promise.all(tempDirs.splice(0).map((dir)=>rm(dir,{recursive:true,force:true})));});

describe("OmniVoiceHttpProvider",()=>{
  it("posts generation settings and writes WAV",async()=>{
    const dir=await tempDir();
    let posted:Record<string,unknown>={};
    const provider=new OmniVoiceHttpProvider({
      baseUrl:"http://omnivoice.test:5060/",
      speed:1.05,
      numSteps:24,
      instruction:"male, young adult, medium pitch",
      normalizeText:true,
      fetchImpl:async (_input,init)=>{
        posted=JSON.parse(String(init?.body)) as Record<string,unknown>;
        const wav=createSilentWavBuffer(.8,24_000);
        return new Response(wav.buffer.slice(wav.byteOffset,wav.byteOffset+wav.byteLength) as ArrayBuffer,{status:200});
      },
    });
    const output=join(dir,"voice.wav");
    const result=await provider.synthesize({text:"Hallo vanuit StudyTube.",language:"nl-NL"},output);
    expect(posted).toMatchObject({text:"Hallo vanuit StudyTube.",language:"nl",speed:1.05,numSteps:24,instruction:"male, young adult, medium pitch",normalizeText:true});
    expect(result.voice).toBe("voice-design");
    expect(parseWavMetadata(await readFile(output)).sampleRate).toBe(24_000);
  });

  it("sends reference audio for voice cloning",async()=>{
    const dir=await tempDir();
    const reference=join(dir,"reference.wav");
    await writeFile(reference,createSilentWavBuffer(.5,24_000));
    let posted:Record<string,unknown>={};
    const provider=new OmniVoiceHttpProvider({
      referenceAudioPath:reference,
      referenceText:"Dit is de referentie.",
      fetchImpl:async (_input,init)=>{
        posted=JSON.parse(String(init?.body)) as Record<string,unknown>;
        const wav=createSilentWavBuffer(.8,24_000);
        return new Response(wav.buffer.slice(wav.byteOffset,wav.byteOffset+wav.byteLength) as ArrayBuffer,{status:200});
      },
    });
    await provider.synthesize({text:"Nieuwe tekst.",language:"nl-NL"},join(dir,"clone.wav"));
    expect(typeof posted.referenceAudio).toBe("string");
    expect(String(posted.referenceAudio).length).toBeGreaterThan(20);
    expect(posted.referenceAudioName).toBe("reference.wav");
    expect(posted.referenceText).toBe("Dit is de referentie.");
  });
});

describe("OmniVoice config",()=>{
  it("reads local defaults from the environment",()=>{
    expect(getOmniVoiceConfig({OMNIVOICE_URL:"http://omni:5060",OMNIVOICE_SPEED:"1.1",OMNIVOICE_NUM_STEPS:"32",OMNIVOICE_NORMALIZE_TEXT:"false"})).toEqual({baseUrl:"http://omni:5060",speed:1.1,numSteps:32,instruction:undefined,normalizeText:false});
  });
});
