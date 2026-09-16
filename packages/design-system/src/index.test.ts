import {describe,expect,it} from "vitest";
import {colors,radii,spacing,studyTubeTheme,typography,video} from "./index";

describe("studyTubeTheme",()=>{
  it("exposes the same values through the aggregate theme and individual exports",()=>{
    expect(studyTubeTheme.video).toBe(video);
    expect(studyTubeTheme.colors).toBe(colors);
    expect(studyTubeTheme.typography).toBe(typography);
    expect(studyTubeTheme.spacing).toBe(spacing);
    expect(studyTubeTheme.radii).toBe(radii);
  });

  it("defines a 16:9 video frame",()=>{
    expect(video.width/video.height).toBeCloseTo(16/9,2);
  });

  it("defines hex colors for every palette entry",()=>{
    for(const value of Object.values(colors)){
      expect(value).toMatch(/^#[0-9a-f]{6}$/u);
    }
  });
});
