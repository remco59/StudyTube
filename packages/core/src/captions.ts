export type CaptionCue={
  text:string;
  startFrame:number;
  endFrameExclusive:number;
  durationInFrames:number;
};

export type NarrationTrack={
  sourcePath:string;
  durationSeconds:number;
  captions:CaptionCue[];
};

export type NarrationManifest=Record<string,NarrationTrack>;

export const splitNarrationIntoPhrases=(text:string,maxWords=8,maxCharacters=64):string[]=>{
  if(!Number.isInteger(maxWords)||maxWords<1) throw new Error("maxWords must be a positive integer");
  if(!Number.isInteger(maxCharacters)||maxCharacters<1) throw new Error("maxCharacters must be a positive integer");
  const sentences=text.trim().split(/(?<=[.!?])\s+/u).filter(Boolean);
  const phrases:string[]=[];
  for(const sentence of sentences){
    const words=sentence.trim().split(/\s+/u).filter(Boolean);
    let current:string[]=[];
    for(const word of words){
      const candidate=current.length===0?word:`${current.join(" ")} ${word}`;
      if(current.length>0&&(current.length>=maxWords||candidate.length>maxCharacters)){
        phrases.push(current.join(" "));
        current=[word];
      }else{
        current.push(word);
      }
    }
    if(current.length>0)phrases.push(current.join(" "));
  }
  return phrases;
};

export const createPhraseCaptionCues=(text:string,durationSeconds:number,fps:number,maxWords=8):CaptionCue[]=>{
  if(!Number.isFinite(durationSeconds)||durationSeconds<=0) throw new Error("durationSeconds must be positive");
  if(!Number.isFinite(fps)||fps<=0) throw new Error("fps must be positive");
  const phrases=splitNarrationIntoPhrases(text,maxWords);
  if(phrases.length===0) return [];
  const totalFrames=Math.max(phrases.length,Math.ceil(durationSeconds*fps));
  const weights=phrases.map((phrase)=>phrase.split(/\s+/u).length);
  const totalWeight=weights.reduce((sum,value)=>sum+value,0);
  let cursor=0;let cumulativeWeight=0;
  return phrases.map((phrase,index)=>{
    cumulativeWeight+=weights[index];
    const proposedEnd=index===phrases.length-1?totalFrames:Math.round((cumulativeWeight/totalWeight)*totalFrames);
    const endFrameExclusive=Math.max(cursor+1,proposedEnd);
    const cue={text:phrase,startFrame:cursor,endFrameExclusive,durationInFrames:endFrameExclusive-cursor};
    cursor=endFrameExclusive;
    return cue;
  });
};
