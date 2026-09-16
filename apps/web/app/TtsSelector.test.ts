import {describe,expect,it} from "vitest";
import {applyProjectLanguage,defaultTtsSelection} from "./TtsSelector";

describe("applyProjectLanguage",()=>{
  it("switches the default voices to match a known project language",()=>{
    const next=applyProjectLanguage(defaultTtsSelection,"en-US");
    expect(next.language).toBe("en-US");
    expect(next.edge.voice).toBe("en-US-GuyNeural");
    expect(next.azure.voice).toBe("en-US-GuyNeural");
    expect(next.googleChirp.voice).toBe("en-US-Chirp3-HD-Charon");
  });

  it("leaves the selection untouched for an unrecognized project language",()=>{
    const next=applyProjectLanguage(defaultTtsSelection,"ja-JP");
    expect(next).toBe(defaultTtsSelection);
  });

  it("is a no-op when the language already matches",()=>{
    const next=applyProjectLanguage(defaultTtsSelection,"nl-NL");
    expect(next).toBe(defaultTtsSelection);
  });

  it("does not touch a custom voice id that isn't in the catalog when re-applied for the same language",()=>{
    const custom={...defaultTtsSelection,edge:{...defaultTtsSelection.edge,voice:"nl-NL-CustomNeural"}};
    const next=applyProjectLanguage(custom,"nl-NL");
    expect(next).toBe(custom);
  });
});
