import {rm} from "node:fs/promises";
import {runStudyTubeJob,type TtsJobSettings,type TtsProviderKind} from "@studytube/worker";
import type {RenderEngine,StudyTubeJobStatus} from "@studytube/worker/types";
import {unregisterActiveJob} from "@/lib/activeJobs";
import {cleanupCancelledJobWorkingData} from "@/lib/jobs";

export type QueuedRenderJob={
  jobId:string;
  projectPath:string;
  dataDir:string;
  uploadRoot:string;
  renderEngine:RenderEngine;
  ttsProvider:TtsProviderKind;
  ttsSettings:TtsJobSettings;
  baseJobId?:string;
  signal:AbortSignal;
};

type StudyTubeGlobal=typeof globalThis&{
  __studytubeRenderQueue?:{pending:QueuedRenderJob[];running:boolean};
};

const runtimeGlobal=globalThis as StudyTubeGlobal;
const queueState=runtimeGlobal.__studytubeRenderQueue??=(runtimeGlobal.__studytubeRenderQueue={pending:[],running:false});

export const enqueueRenderJob=(job:QueuedRenderJob):void=>{
  queueState.pending.push(job);
  void processQueue();
};

export const getQueueSnapshot=():string[]=>queueState.pending.map((job)=>job.jobId);

export const withQueuePosition=(status:StudyTubeJobStatus):StudyTubeJobStatus&{queuePosition?:number;queueLength?:number}=>{
  if(status.state!=="queued")return status;
  const queueOrder=getQueueSnapshot();
  const position=queueOrder.indexOf(status.jobId);
  return position===-1?status:{...status,queuePosition:position+1,queueLength:queueOrder.length};
};

export const moveQueuedJob=(jobId:string,direction:"up"|"down"):boolean=>{
  const index=queueState.pending.findIndex((job)=>job.jobId===jobId);
  if(index===-1)return false;
  const targetIndex=direction==="up"?index-1:index+1;
  if(targetIndex<0||targetIndex>=queueState.pending.length)return false;
  const [job]=queueState.pending.splice(index,1);
  queueState.pending.splice(targetIndex,0,job);
  return true;
};

const processQueue=async():Promise<void>=>{
  if(queueState.running)return;
  queueState.running=true;
  try{
    while(queueState.pending.length>0){
      const job=queueState.pending.shift();
      if(job)await runQueuedJob(job);
    }
  }finally{
    queueState.running=false;
  }
};

const runQueuedJob=async(job:QueuedRenderJob):Promise<void>=>{
  try{
    await runStudyTubeJob({
      projectPath:job.projectPath,
      dataDir:job.dataDir,
      jobId:job.jobId,
      signal:job.signal,
      renderEngine:job.renderEngine,
      ttsProvider:job.ttsProvider,
      ttsSettings:job.ttsSettings,
      baseJobId:job.baseJobId,
    });
  }catch(error){
    console.error(`StudyTube queue: job ${job.jobId} failed`,error);
  }finally{
    unregisterActiveJob(job.jobId);
    await rm(job.uploadRoot,{recursive:true,force:true}).catch((error)=>{console.error(`StudyTube job ${job.jobId}: failed to remove upload directory`,error);});
    await cleanupCancelledJobWorkingData(job.jobId).catch((error)=>{console.error(`StudyTube job ${job.jobId}: failed to clean up cancelled job data`,error);});
  }
};
