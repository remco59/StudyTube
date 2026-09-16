import type {Dirent} from "node:fs";
import {readdir,readFile,rename,rm,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import type {JobLogEntry,StudyTubeJobStatus} from "@studytube/worker/types";
import {isActiveJob} from "@/lib/activeJobs";

const DOWNLOAD_RETENTION_MS=60*60*1000;
const MAX_LISTED_JOBS=50;
const MAX_LOG_ENTRIES=300;
const INTERRUPTED_MESSAGE="Render interrupted because the StudyTube server process restarted or stopped.";

export const getDataDir=()=>resolve(process.env.STUDYTUBE_DATA_DIR??"data");

export const assertJobId=(jobId:string)=>{
  if(!jobId||jobId.length>120||![...jobId].every((char)=>/[a-zA-Z0-9_-]/u.test(char))) throw new Error("Invalid job id");
  return jobId;
};

const getJobRoot=(jobId:string)=>join(getDataDir(),"jobs",assertJobId(jobId));
const getUploadRoot=(jobId:string)=>join(getDataDir(),"uploads",assertJobId(jobId));
const getStatusPath=(jobId:string)=>join(getJobRoot(jobId),"status.json");
const isTerminalState=(state:StudyTubeJobStatus["state"])=>state==="completed"||state==="failed"||state==="cancelled";

export const readJobStatus=async(jobId:string):Promise<StudyTubeJobStatus>=>
  JSON.parse(await readFile(getStatusPath(jobId),"utf8")) as StudyTubeJobStatus;

export const cleanupJobWorkingData=async(jobId:string)=>{
  const root=getJobRoot(jobId);
  await Promise.all([
    rm(join(root,"public"),{recursive:true,force:true}),
    rm(join(root,"output"),{recursive:true,force:true}),
    rm(join(root,"project.studytube.json"),{force:true}),
    rm(join(root,"render-props.json"),{force:true}),
    rm(getUploadRoot(jobId),{recursive:true,force:true}),
  ]);
};

export const cleanupCancelledJobWorkingData=async(jobId:string):Promise<StudyTubeJobStatus>=>{
  const status=await readJobStatus(jobId);
  if(status.state==="cancelled")await cleanupJobWorkingData(jobId);
  return status;
};

export const markJobInterrupted=async(jobId:string):Promise<StudyTubeJobStatus>=>{
  const status=await readJobStatus(jobId);
  if(isTerminalState(status.state)||isActiveJob(jobId))return status;
  const next:StudyTubeJobStatus={
    ...status,
    state:"failed",
    error:INTERRUPTED_MESSAGE,
    updatedAt:new Date().toISOString(),
  };
  await writeStatusAtomic(jobId,next);
  await cleanupJobWorkingData(jobId).catch(logSwallowedError(jobId,"clean up working data for interrupted job"));
  return next;
};

export const readLiveJobStatus=async(jobId:string):Promise<StudyTubeJobStatus>=>{
  const status=await readJobStatus(jobId);
  if(isTerminalState(status.state)||isActiveJob(jobId))return status;
  return markJobInterrupted(jobId);
};

export const listJobStatuses=async():Promise<StudyTubeJobStatus[]>=>{
  await cleanupExpiredJobs();
  const jobsRoot=join(getDataDir(),"jobs");
  let entries:Dirent[];
  try{entries=await readdir(jobsRoot,{withFileTypes:true});}catch(error){
    if(isMissing(error))return [];
    throw error;
  }
  const statuses=await Promise.all(entries.filter((entry)=>entry.isDirectory()).map(async(entry)=>{
    try{return await readLiveJobStatus(entry.name);}catch{return null;}
  }));
  return statuses
    .filter((status):status is StudyTubeJobStatus=>status!==null)
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))
    .slice(0,MAX_LISTED_JOBS);
};

export const readJobLogs=async(jobId:string):Promise<JobLogEntry[]>=>{
  const path=join(getJobRoot(jobId),"logs.ndjson");
  let text:string;
  try{text=await readFile(path,"utf8");}catch(error){
    if(isMissing(error))return [];
    throw error;
  }
  return text.split("\n").filter(Boolean).flatMap((line)=>{
    try{return [JSON.parse(line) as JobLogEntry];}catch{return [];}
  }).slice(-MAX_LOG_ENTRIES);
};

export const markJobDownloaded=async(jobId:string):Promise<StudyTubeJobStatus>=>{
  const status=await readJobStatus(jobId);
  if(status.state!=="completed"||!status.outputPath)throw new Error("Video is not ready");
  if(status.downloadedAt&&status.expiresAt)return status;
  const downloadedAt=new Date();
  const next:StudyTubeJobStatus={
    ...status,
    downloadedAt:downloadedAt.toISOString(),
    expiresAt:new Date(downloadedAt.getTime()+DOWNLOAD_RETENTION_MS).toISOString(),
    updatedAt:downloadedAt.toISOString(),
  };
  await writeStatusAtomic(jobId,next);
  return next;
};

export const removeJob=async(jobId:string)=>Promise.all([
  rm(getJobRoot(jobId),{recursive:true,force:true}),
  rm(getUploadRoot(jobId),{recursive:true,force:true}),
]);

export const scheduleJobCleanup=(jobId:string,expiresAt:string)=>{
  const delay=Math.max(0,Date.parse(expiresAt)-Date.now());
  const timer:NodeJS.Timeout=setTimeout(()=>{void removeJob(jobId).catch(logSwallowedError(jobId,"remove expired job"));},delay);
  timer.unref();
};

export const cleanupExpiredJobs=async()=>{
  const jobsRoot=join(getDataDir(),"jobs");
  let entries:Dirent[];
  try{entries=await readdir(jobsRoot,{withFileTypes:true});}catch(error){
    if(isMissing(error))return;
    throw error;
  }
  const now=Date.now();
  await Promise.all(entries.filter((entry)=>entry.isDirectory()).map(async(entry)=>{
    try{
      const status=await readJobStatus(entry.name);
      if(status.expiresAt&&Date.parse(status.expiresAt)<=now)await removeJob(entry.name);
    }catch{
      // Ignore incomplete or transient job directories. Active workers may still be creating them.
    }
  }));
};

const writeStatusAtomic=async(jobId:string,status:StudyTubeJobStatus)=>{
  const path=getStatusPath(jobId);
  const temporary=`${path}.${process.pid}.tmp`;
  await writeFile(temporary,`${JSON.stringify(status,null,2)}\n`,`utf8`);
  await rename(temporary,path);
};

const isMissing=(error:unknown)=>error instanceof Error&&"code" in error&&(error as NodeJS.ErrnoException).code==="ENOENT";
const logSwallowedError=(jobId:string,action:string)=>(error:unknown)=>{console.error(`StudyTube job ${jobId}: failed to ${action}`,error);};
