import {describe,expect,it} from "vitest";
import {resolveRemotionRenderSettings} from "./remotionRender";

describe("resolveRemotionRenderSettings",()=>{
  it("uses conservative defaults for server renders",()=>{
    expect(resolveRemotionRenderSettings({})).toEqual({
      concurrency:2,
      timeoutInMilliseconds:120_000,
    });
  });

  it("allows render settings to be overridden through environment variables",()=>{
    expect(resolveRemotionRenderSettings({
      STUDYTUBE_RENDER_CONCURRENCY:"1",
      STUDYTUBE_RENDER_TIMEOUT_MS:"180000",
    })).toEqual({
      concurrency:1,
      timeoutInMilliseconds:180_000,
    });
  });

  it("rejects invalid render settings instead of silently using them",()=>{
    expect(()=>resolveRemotionRenderSettings({STUDYTUBE_RENDER_CONCURRENCY:"0"})).toThrow(/STUDYTUBE_RENDER_CONCURRENCY/);
    expect(()=>resolveRemotionRenderSettings({STUDYTUBE_RENDER_TIMEOUT_MS:"not-a-number"})).toThrow(/STUDYTUBE_RENDER_TIMEOUT_MS/);
  });
});
