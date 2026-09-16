import {describe,expect,it} from "vitest";
import {fittedImageRect,percentPointInRect,percentPointInSize} from "./annotatedImageLayout";

describe("annotated image layout",()=>{
  it("maps contained image coordinates into the visible image rect",()=>{
    const rect=fittedImageRect({width:1600,height:700},{width:800,height:550},"contain");

    expect(rect.left).toBeCloseTo(290.909,3);
    expect(rect.top).toBeCloseTo(0,3);
    expect(rect.width).toBeCloseTo(1018.182,3);
    expect(rect.height).toBeCloseTo(700,3);
    expect(percentPointInRect(rect,50,50)).toEqual({x:800,y:350});
  });

  it("maps covered image coordinates through the cropped image rect",()=>{
    const rect=fittedImageRect({width:1600,height:700},{width:800,height:550},"cover");

    expect(rect).toEqual({left:0,top:-200,width:1600,height:1100});
    expect(percentPointInRect(rect,50,50)).toEqual({x:800,y:350});
    expect(percentPointInRect(rect,50,0)).toEqual({x:800,y:-200});
  });

  it("keeps label coordinates relative to the annotation stage",()=>{
    expect(percentPointInSize({width:1600,height:700},10,25)).toEqual({x:160,y:175});
  });
});
