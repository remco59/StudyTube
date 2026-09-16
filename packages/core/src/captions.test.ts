import {describe,expect,it} from "vitest";
import {createPhraseCaptionCues,splitNarrationIntoPhrases} from "./captions";

describe("caption phrases",()=>{
  it("splits sentences and long phrases",()=>{
    expect(splitNarrationIntoPhrases("Dit is kort. Dit is een tweede zin met wat meer woorden.",4)).toEqual(["Dit is kort.","Dit is een tweede","zin met wat meer","woorden."]);
  });

  it("also limits phrase length so long words do not create three-line captions",()=>{
    const phrases=splitNarrationIntoPhrases("Deze uitleg bevat meerdere relatief lange begrippen waardoor acht woorden samen visueel veel te breed kunnen worden.",8,44);
    expect(phrases.length).toBeGreaterThan(2);
    expect(phrases.every((phrase)=>phrase.length<=44||!phrase.includes(" "))).toBe(true);
  });

  it("creates contiguous cues that fill narration time",()=>{
    const cues=createPhraseCaptionCues("Eén korte zin. Daarna volgt nog een uitleg.",4,30,4);
    expect(cues[0].startFrame).toBe(0);
    expect(cues.at(-1)?.endFrameExclusive).toBe(120);
    for(let index=1;index<cues.length;index++) expect(cues[index].startFrame).toBe(cues[index-1].endFrameExclusive);
    expect(cues.every((cue)=>cue.durationInFrames>0)).toBe(true);
  });
});
