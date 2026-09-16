import {describe,expect,it} from "vitest";
import {colorPresets,colors,defaultStylePreset,radii,resolveStylePresetVariables,spacing,studyTubeTheme,typography,video} from "./index";

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

  it("resolves every color token to a CSS custom property so a style preset can swap the palette at the composition root",()=>{
    for(const value of Object.values(colors)){
      expect(value).toMatch(/^var\(--st-color-[a-zA-Z]+\)$/u);
    }
  });
});

describe("style presets",()=>{
  it("defines a hex value for every color token in each preset",()=>{
    for(const preset of Object.values(colorPresets)){
      for(const key of Object.keys(colors)){
        expect(preset[key as keyof typeof preset]).toMatch(/^#[0-9a-f]{6}$/u);
      }
    }
  });

  it("gives each preset a distinct palette",()=>{
    const [first,second]=Object.values(colorPresets);
    expect(first).not.toEqual(second);
  });

  it("resolves the default preset's variables when no style id is given",()=>{
    expect(resolveStylePresetVariables()).toEqual(resolveStylePresetVariables(defaultStylePreset));
  });

  it("falls back to the default preset for an unknown style id",()=>{
    expect(resolveStylePresetVariables("not-a-real-preset")).toEqual(resolveStylePresetVariables(defaultStylePreset));
  });

  it("maps every color key to its CSS custom property name",()=>{
    const variables=resolveStylePresetVariables("midnight-focus");
    expect(variables["--st-color-canvas"]).toBe(colorPresets["midnight-focus"].canvas);
    expect(variables["--st-color-accent"]).toBe(colorPresets["midnight-focus"].accent);
  });
});
