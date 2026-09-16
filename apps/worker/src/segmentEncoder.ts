import {execFile} from "node:child_process";
import {mkdir,writeFile} from "node:fs/promises";
import {dirname} from "node:path";
import {promisify} from "node:util";

const execFileAsync=promisify(execFile);
const ffmpegBinary=()=>process.env.STUDYTUBE_FFMPEG_PATH?.trim()||"/usr/bin/ffmpeg";
const ffmpegTimeoutMs=()=>{
  const configured=Number(process.env.STUDYTUBE_FFMPEG_TIMEOUT_MS);
  return Number.isFinite(configured)&&configured>0?configured:120_000;
};
const ffmpegExecOptions=(signal?:AbortSignal)=>({maxBuffer:16_000_000,timeout:ffmpegTimeoutMs(),killSignal:"SIGKILL" as const,...(signal?{signal}:{})});

export const extractSegment=async(sourcePath:string,startFrame:number,frameCount:number,fps:number,destPath:string,signal?:AbortSignal):Promise<void>=>{
  await mkdir(dirname(destPath),{recursive:true});
  const startSeconds=(startFrame/fps).toFixed(6);
  const durationSeconds=(frameCount/fps).toFixed(6);
  await execFileAsync(ffmpegBinary(),["-y","-i",sourcePath,"-ss",startSeconds,"-t",durationSeconds,"-map","0","-c:v","libx264","-preset","veryfast","-crf","18","-c:a","aac","-avoid_negative_ts","make_zero",destPath],ffmpegExecOptions(signal));
};

export const concatenateSegments=async(segmentPaths:string[],destPath:string,signal?:AbortSignal):Promise<void>=>{
  await mkdir(dirname(destPath),{recursive:true});
  const listPath=`${destPath}.concat.txt`;
  const listContents=segmentPaths.map((path)=>`file '${path.replaceAll("'","'\\''")}'`).join("\n");
  await writeFile(listPath,`${listContents}\n`,"utf8");
  await execFileAsync(ffmpegBinary(),["-y","-f","concat","-safe","0","-i",listPath,"-c","copy",destPath],ffmpegExecOptions(signal));
};
