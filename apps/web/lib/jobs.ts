import type {Dirent} from "node:fs";
import {readdir,readFile,rename,rm,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import type {JobLogEntry,StudyTubeJobStatus} from "@studytube/worker/types";
import {isActiveJob} from "@/lib/activeJobs";

const MAX_LISTED_JOBS=50;
const MAX_LOG_ENTRIES=300;
const INTERRUPTED_MESSAGE="Render interrupted because the StudyTube server process restarted or stopped.";
export const MAX_COMPLETED_RENDERS_PER_PROJECT=5;

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
  if(status.state==="queued"){
    const {recoverQueuedJob}=await import("@/lib/queuedJobRecovery");
    if(await recoverQueuedJob(jobId))return readJobStatus(jobId);
  }
  return markJobInterrupted(jobId);
};

const listAllJobDirectories=async():Promise<string[]>=>{
  const jobsRoot=join(getDataDir(),"jobs");
  let entries:Dirent[];
  try{entries=await readdir(jobsRoot,{withFileTypes:true});}catch(error){
    if(isMissing(error))return [];
    throw error;
  }
  return entries.filter((entry)=>entry.isDirectory()).map((entry)=>entry.name);
};

export const listJobStatuses=async():Promise<StudyTubeJobStatus[]>=>{
  await pruneOldRenders();
  const jobIds=await listAllJobDirectories();
  const statuses=await Promise.all(jobIds.map(async(jobId)=>{
    try{return await readLiveJobStatus(jobId);}catch{return null;}
  }));
  return statuses
    .filter((status):status is StudyTubeJobStatus=>status!==null)
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))
    .slice(0,MAX_LISTED_JOBS);
};

export const readJobProjectFile=async(jobId:string):Promise<string>=>
  readFile(join(getJobRoot(jobId),"project.studytube.json"),"utf8");

export const findLatestCompletedJobByTitle=async(title:string):Promise<StudyTubeJobStatus|null>=>{
  const history=await listProjectRenderHistory(title);
  return history[0]??null;
};

// Uncapped by MAX_LISTED_JOBS, unlike listJobStatuses, so a project's older
// renders are still browsable even once the server has more than 50 jobs
// total across every project.
export const listProjectRenderHistory=async(projectTitle:string):Promise<StudyTubeJobStatus[]>=>{
  const jobIds=await listAllJobDirectories();
  const statuses=await Promise.all(jobIds.map(async(jobId)=>{
    try{return await readJobStatus(jobId);}catch{return null;}
  }));
  return statuses
    .filter((status):status is StudyTubeJobStatus=>status!==null&&status.state==="completed"&&status.projectTitle===projectTitle)
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
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
  if(status.downloadedAt)return status;
  const downloadedAt=new Date().toISOString();
  const next:StudyTubeJobStatus={...status,downloadedAt,updatedAt:downloadedAt};
  await writeStatusAtomic(jobId,next);
  return next;
};

export const removeJob=async(jobId:string)=>Promise.all([
  rm(getJobRoot(jobId),{recursive:true,force:true}),
  rm(getUploadRoot(jobId),{recursive:true,force:true}),
]);

// Keeps the most recent MAX_COMPLETED_RENDERS_PER_PROJECT completed jobs for
// each project title (downloaded or not) and removes older ones, so a
// project's render history sticks around across re-renders instead of
// disappearing shortly after it's downloaded.
export const pruneOldRenders=async():Promise<void>=>{
  const jobIds=await listAllJobDirectories();
  const statuses=await Promise.all(jobIds.map(async(jobId)=>{
    try{return await readJobStatus(jobId);}catch{return null;}
  }));
  const completedByProject=new Map<string,StudyTubeJobStatus[]>();
  for(const status of statuses){
    if(!status||status.state!=="completed")continue;
    const key=status.projectTitle??"";
    const list=completedByProject.get(key)??[];
    list.push(status);
    completedByProject.set(key,list);
  }
  const overflow=[...completedByProject.values()].flatMap((list)=>
    list.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(MAX_COMPLETED_RENDERS_PER_PROJECT));
  await Promise.all(overflow.map((status)=>removeJob(status.jobId).catch(logSwallowedError(status.jobId,"prune an old render"))));
};

const writeStatusAtomic=async(jobId:string,status:StudyTubeJobStatus)=>{
  const path=getStatusPath(jobId);
  const temporary=`${path}.${process.pid}.tmp`;
  await writeFile(temporary,`${JSON.stringify(status,null,2)}\n`,`utf8`);
  await rename(temporary,path);
};

const isMissing=(error:unknown)=>error instanceof Error&&"code" in error&&(error as NodeJS.ErrnoException).code==="ENOENT";
const logSwallowedError=(jobId:string,action:string)=>(error:unknown)=>{console.error(`StudyTube job ${jobId}: failed to ${action}`,error);};
