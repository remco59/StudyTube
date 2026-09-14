import {describe,expect,it} from "vitest";
import {findActiveCaption} from "./CaptionOverlay";

const cues=[
  {text:"Eerste",startFrame:0,endFrameExclusive:30,durationInFrames:30},
  {text:"Tweede",startFrame:30,endFrameExclusive:60,durationInFrames:30},
];

describe("findActiveCaption",()=>{
  it("selects captions using scene-local frames",()=>{
    expect(findActiveCaption(cues,0)?.text).toBe("Eerste");
    expect(findActiveCaption(cues,29)?.text).toBe("Eerste");
    expect(findActiveCaption(cues,30)?.text).toBe("Tweede");
    expect(findActiveCaption(cues,60)).toBeUndefined();
  });
});
