import {readFile} from "node:fs/promises";
import {splitNarrationIntoPhrases,type CaptionCue} from "@studytube/core";

const TIMING_CHUNK_ID="sttm";
const EDGE_TICKS_PER_SECOND=10_000_000;

type EmbeddedWord={
  text:string;
  offset:number;
  duration:number;
};

type EmbeddedTimingPayload={
  version:number;
  words:EmbeddedWord[];
};

export type WordTiming={
  text:string;
  startSeconds:number;
  endSeconds:number;
};

export const readEmbeddedWordTimings=async(path:string):Promise<WordTiming[]|undefined>=>{
  const buffer=await readFile(path);
  if(buffer.length<12||buffer.toString("ascii",0,4)!=="RIFF"||buffer.toString("ascii",8,12)!=="WAVE")return undefined;

  let offset=12;
  while(offset+8<=buffer.length){
    const id=buffer.toString("ascii",offset,offset+4);
    const size=buffer.readUInt32LE(offset+4);
    const body=offset+8;
    if(body+size>buffer.length)return undefined;
    if(id===TIMING_CHUNK_ID){
      try{
        const payload=JSON.parse(buffer.toString("utf8",body,body+size)) as EmbeddedTimingPayload;
        if(payload.version!==1||!Array.isArray(payload.words))return undefined;
        const timings=payload.words
          .filter((word)=>typeof word.text==="string"&&Number.isFinite(word.offset)&&word.offset>=0&&Number.isFinite(word.duration)&&word.duration>=0)
          .map((word)=>({
            text:word.text,
            startSeconds:word.offset/EDGE_TICKS_PER_SECOND,
            endSeconds:(word.offset+word.duration)/EDGE_TICKS_PER_SECOND,
          }));
        return timings.length>0?timings:undefined;
      }catch{
        return undefined;
      }
    }
    offset=body+size+(size%2);
  }
  return undefined;
};

export const createWordTimedCaptionCues=(
  text:string,
  timings:WordTiming[],
  durationSeconds:number,
  fps:number,
  maxWords=8,
):CaptionCue[]|undefined=>{
  if(!Number.isFinite(durationSeconds)||durationSeconds<=0)return undefined;
  if(!Number.isFinite(fps)||fps<=0)return undefined;
  const phrases=splitNarrationIntoPhrases(text,maxWords);
  if(phrases.length===0)return [];

  const usableTimings=timings.filter((timing)=>/[\p{L}\p{N}]/u.test(timing.text));
  const wordCounts=phrases.map((phrase)=>phrase.trim().split(/\s+/u).filter(Boolean).length);
  const expectedWords=wordCounts.reduce((sum,count)=>sum+count,0);
  if(expectedWords!==usableTimings.length)return undefined;

  const totalFrames=Math.max(1,Math.ceil(durationSeconds*fps));
  let timingIndex=0;
  const cues:CaptionCue[]=[];

  for(let phraseIndex=0;phraseIndex<phrases.length;phraseIndex++){
    const count=wordCounts[phraseIndex];
    const first=usableTimings[timingIndex];
    const last=usableTimings[timingIndex+count-1];
    const next=usableTimings[timingIndex+count];
    if(!first||!last)return undefined;

    const startFrame=Math.min(totalFrames-1,Math.max(0,Math.floor(first.startSeconds*fps)));
    const proposedEnd=next
      ?Math.floor(next.startSeconds*fps)
      :Math.ceil(last.endSeconds*fps);
    const endFrameExclusive=Math.min(totalFrames,Math.max(startFrame+1,proposedEnd));
    cues.push({
      text:phrases[phraseIndex],
      startFrame,
      endFrameExclusive,
      durationInFrames:endFrameExclusive-startFrame,
    });
    timingIndex+=count;
  }

  return cues;
};
