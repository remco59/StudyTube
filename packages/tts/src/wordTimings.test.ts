import {mkdtemp,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach,describe,expect,it} from "vitest";
import {createSilentWavBuffer} from "./index";
import {createWordTimedCaptionCues,readEmbeddedWordTimings} from "./wordTimings";

const dirs:string[]=[];
afterEach(async()=>{
  await Promise.all(dirs.splice(0).map((dir)=>rm(dir,{recursive:true,force:true})));
});

const appendTimingChunk=(wav:Buffer,words:Array<{text:string;offset:number;duration:number}>):Buffer=>{
  const payload=Buffer.from(JSON.stringify({version:1,words}),"utf8");
  const header=Buffer.alloc(8);
  header.write("sttm",0,"ascii");
  header.writeUInt32LE(payload.length,4);
  const padding=payload.length%2?Buffer.from([0]):Buffer.alloc(0);
  const result=Buffer.concat([wav,header,payload,padding]);
  result.writeUInt32LE(result.length-8,4);
  return result;
};

describe("embedded Edge TTS word timings",()=>{
  it("reads timing metadata from a WAV chunk",async()=>{
    const dir=await mkdtemp(join(tmpdir(),"studytube-word-timings-"));
    dirs.push(dir);
    const path=join(dir,"voice.wav");
    await writeFile(path,appendTimingChunk(createSilentWavBuffer(2),[
      {text:"Hallo",offset:1_000_000,duration:2_000_000},
      {text:"wereld",offset:4_000_000,duration:2_000_000},
    ]));

    const timings=await readEmbeddedWordTimings(path);
    expect(timings).toEqual([
      {text:"Hallo",startSeconds:.1,endSeconds:.3},
      {text:"wereld",startSeconds:.4,endSeconds:.6},
    ]);
  });

  it("changes captions on the real next-word boundary",()=>{
    const cues=createWordTimedCaptionCues(
      "Dit is kort. Daarna volgt uitleg.",
      [
        {text:"Dit",startSeconds:.1,endSeconds:.2},
        {text:"is",startSeconds:.22,endSeconds:.3},
        {text:"kort",startSeconds:.32,endSeconds:.55},
        {text:"Daarna",startSeconds:1,endSeconds:1.25},
        {text:"volgt",startSeconds:1.27,endSeconds:1.5},
        {text:"uitleg",startSeconds:1.52,endSeconds:1.8},
      ],
      2,
      30,
      4,
    );

    expect(cues?.[0].startFrame).toBe(3);
    expect(cues?.[0].endFrameExclusive).toBe(30);
    expect(cues?.[1].startFrame).toBe(30);
    expect(cues?.[1].endFrameExclusive).toBe(54);
  });

  it("falls back when word boundaries cannot be matched safely",()=>{
    expect(createWordTimedCaptionCues(
      "Twee woorden.",
      [{text:"Twee",startSeconds:0,endSeconds:.2}],
      1,
      30,
    )).toBeUndefined();
  });
});
