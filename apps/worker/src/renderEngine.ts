import {execFile} from "node:child_process";
import {access,readdir} from "node:fs/promises";
import {promisify} from "node:util";
import type {FfmpegOverrideFn} from "@remotion/renderer";
import type {RenderEngine} from "./types";

const execFileAsync=promisify(execFile);

export type RenderEngineCapability={
  id:RenderEngine;
  label:string;
  available:boolean;
  detail:string;
};

export type RenderCapabilities={
  engines:RenderEngineCapability[];
  intelDevice?:string;
};

export const renderEngineLabels:Record<RenderEngine,string>={
  cpu:"CPU (software)",
  intel:"Intel GPU (VAAPI)",
  nvidia:"NVIDIA NVENC",
};

export const parseRenderEngine=(value:unknown):RenderEngine=>{
  if(value===undefined||value===null||value==="")return "cpu";
  if(value==="cpu"||value==="intel"||value==="nvidia")return value;
  throw new Error(`Unsupported render engine "${String(value)}". Use cpu, intel or nvidia.`);
};

const pathExists=async(path:string)=>{
  try{await access(path);return true;}catch{return false;}
};

const findIntelRenderDevice=async():Promise<string|undefined>=>{
  try{
    const entries=(await readdir("/dev/dri")).filter((entry)=>entry.startsWith("renderD")).sort();
    return entries[0]?`/dev/dri/${entries[0]}`:undefined;
  }catch{return undefined;}
};

const systemFfmpegHasEncoder=async(encoder:string):Promise<boolean>=>{
  try{
    const {stdout,stderr}=await execFileAsync("/usr/bin/ffmpeg",["-hide_banner","-encoders"],{timeout:8_000,maxBuffer:4_000_000});
    return `${stdout}\n${stderr}`.includes(encoder);
  }catch{return false;}
};

export const detectRenderCapabilities=async():Promise<RenderCapabilities>=>{
  const intelDevice=await findIntelRenderDevice();
  const intelEncoder=intelDevice?await systemFfmpegHasEncoder("h264_vaapi"):false;
  const nvidiaDevice=(await pathExists("/dev/nvidia0"))||(await pathExists("/dev/nvidiactl"));
  const nvidiaArchitecture=process.arch==="x64";

  return {
    engines:[
      {id:"cpu",label:renderEngineLabels.cpu,available:true,detail:"Software H.264 encoding. Works on every StudyTube server."},
      {
        id:"intel",
        label:renderEngineLabels.intel,
        available:Boolean(intelDevice&&intelEncoder),
        detail:!intelDevice?"Intel /dev/dri device is not available inside the container.":!intelEncoder?"This container's FFmpeg does not expose the h264_vaapi encoder.":`Intel VAAPI device ${intelDevice} is available.`,
      },
      {
        id:"nvidia",
        label:renderEngineLabels.nvidia,
        available:nvidiaDevice&&nvidiaArchitecture,
        detail:!nvidiaDevice?"NVIDIA device is not available inside the container.":!nvidiaArchitecture?"Remotion NVENC requires the Linux x64 renderer build.":"NVIDIA device is available; Remotion will require NVENC for this job.",
      },
    ],
    ...(intelDevice?{intelDevice}:{}),
  };
};

export const requireRenderEngine=async(engine:RenderEngine):Promise<RenderCapabilities>=>{
  const capabilities=await detectRenderCapabilities();
  const capability=capabilities.engines.find((item)=>item.id===engine);
  if(!capability?.available)throw new Error(`${renderEngineLabels[engine]} is unavailable: ${capability?.detail??"No capability information available."}`);
  return capabilities;
};

const removeOption=(args:string[],option:string):string[]=>{
  const result:string[]=[];
  for(let index=0;index<args.length;index++){
    if(args[index]===option){index++;continue;}
    result.push(args[index]);
  }
  return result;
};

const replaceOptionValue=(args:string[],option:string,value:string):string[]=>{
  const next=[...args];
  const index=next.lastIndexOf(option);
  if(index>=0&&index+1<next.length){next[index+1]=value;return next;}
  const outputIndex=Math.max(0,next.length-1);
  next.splice(outputIndex,0,option,value);
  return next;
};

const replaceSystemFfmpegAudioEncoder=(args:string[]):string[]=>
  args.map((arg)=>arg==="libfdk_aac"?"aac":arg);

const addVaapiFilter=(args:string[]):string[]=>{
  const next=[...args];
  const filterIndex=next.lastIndexOf("-vf");
  if(filterIndex>=0&&filterIndex+1<next.length){
    const current=next[filterIndex+1];
    if(!current.includes("hwupload"))next[filterIndex+1]=`${current},format=nv12,hwupload`;
    return next;
  }
  const outputIndex=Math.max(0,next.length-1);
  next.splice(outputIndex,0,"-vf","format=nv12,hwupload");
  return next;
};

export const createIntelVaapiFfmpegOverride=(device:string):FfmpegOverrideFn=>({type,args})=>{
  let next=replaceSystemFfmpegAudioEncoder(args);
  if(type!=="stitcher")return next;
  next=removeOption(next,"-pix_fmt");
  next=replaceOptionValue(next,"-c:v","h264_vaapi");
  next=addVaapiFilter(next);
  if(!next.includes("-vaapi_device"))next=["-vaapi_device",device,...next];
  return next;
};
