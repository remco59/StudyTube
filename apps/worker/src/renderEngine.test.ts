import {describe,expect,it} from "vitest";
import {createIntelVaapiFfmpegOverride,parseRenderEngine} from "./renderEngine";

describe("parseRenderEngine",()=>{
  it("defaults to CPU and accepts supported engines",()=>{
    expect(parseRenderEngine(undefined)).toBe("cpu");
    expect(parseRenderEngine("cpu")).toBe("cpu");
    expect(parseRenderEngine("intel")).toBe("intel");
    expect(parseRenderEngine("nvidia")).toBe("nvidia");
  });

  it("rejects unsupported engine values",()=>{
    expect(()=>parseRenderEngine("auto")).toThrow(/Unsupported render engine/);
  });
});

describe("createIntelVaapiFfmpegOverride",()=>{
  it("leaves unrelated pre-stitcher commands unchanged",()=>{
    const override=createIntelVaapiFfmpegOverride("/dev/dri/renderD128");
    const args=["-i","frames-%d.jpeg","-c:v","libx264","out.mp4"];
    expect(override({type:"pre-stitcher",args})).toEqual(args);
  });

  it("uses Debian FFmpeg's native AAC encoder for audio preprocessing",()=>{
    const override=createIntelVaapiFfmpegOverride("/dev/dri/renderD128");
    const result=override({type:"pre-stitcher",args:[
      "-i","merged.wav","-c:a","libfdk_aac","-f","adts","-b:a","320k","audio.aac",
    ]});

    expect(result).toContain("aac");
    expect(result).not.toContain("libfdk_aac");
    expect(result[result.indexOf("-c:a")+1]).toBe("aac");
  });

  it("switches the final encoder to VAAPI and uploads NV12 frames",()=>{
    const override=createIntelVaapiFfmpegOverride("/dev/dri/renderD128");
    const result=override({type:"stitcher",args:[
      "-r","30","-i","frames-%d.jpeg","-c:v","libx264","-pix_fmt","yuv420p","-vf","zscale=matrix=709:matrixin=709:range=limited","-b:v","8M","out.mp4",
    ]});

    expect(result.slice(0,2)).toEqual(["-vaapi_device","/dev/dri/renderD128"]);
    expect(result).toContain("h264_vaapi");
    expect(result).not.toContain("libx264");
    expect(result).not.toContain("-pix_fmt");
    expect(result[result.indexOf("-vf")+1]).toBe("zscale=matrix=709:matrixin=709:range=limited,format=nv12,hwupload");
    expect(result).toContain("8M");
  });
});
