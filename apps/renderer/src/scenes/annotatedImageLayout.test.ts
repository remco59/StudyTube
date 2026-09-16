import {describe,expect,it} from "vitest";
import {fittedImageRect,percentPointInRect,percentPointInSize} from "./annotatedImageLayout";

describe("annotated image layout",()=>{
  it("maps contained image coordinates into the visible image rect",()=>{
    const rect=fittedImageRect({width:1600,height:700},{width:800,height:550},"contain");
    const center=percentPointInRect(rect,50,50);

    expect(rect.left).toBeCloseTo(290.909,3);
    expect(rect.top).toBeCloseTo(0,3);
    expect(rect.width).toBeCloseTo(1018.182,3);
    expect(rect.height).toBeCloseTo(700,3);
    expect(center.x).toBeCloseTo(800,6);
    expect(center.y).toBeCloseTo(350,6);
  });

  it("maps covered image coordinates through the cropped image rect",()=>{
    const rect=fittedImageRect({width:1600,height:700},{width:800,height:550},"cover");
    const center=percentPointInRect(rect,50,50);
    const topCenter=percentPointInRect(rect,50,0);

    expect(rect).toEqual({left:0,top:-200,width:1600,height:1100});
    expect(center.x).toBeCloseTo(800,6);
    expect(center.y).toBeCloseTo(350,6);
    expect(topCenter.x).toBeCloseTo(800,6);
    expect(topCenter.y).toBeCloseTo(-200,6);
  });

  it("keeps label coordinates relative to the annotation stage",()=>{
    expect(percentPointInSize({width:1600,height:700},10,25)).toEqual({x:160,y:175});
  });
});
