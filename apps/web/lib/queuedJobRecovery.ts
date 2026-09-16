import {readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import type {TtsJobSettings,TtsProviderKind} from "@studytube/worker";
import type {RenderEngine} from "@studytube/worker/types";
import {isActiveJob,registerActiveJob,unregisterActiveJob} from "@/lib/activeJobs";
import {assertJobId,getDataDir,readJobStatus} from "@/lib/jobs";
import {enqueueRenderJob} from "@/lib/renderQueue";

export type QueuedJobRecoveryData={
  projectPath:string;
  dataDir:string;
  uploadRoot:string;
  renderEngine:RenderEngine;
  ttsProvider:TtsProviderKind;
  ttsSettings:TtsJobSettings;
  baseJobId?:string;
};

const recoveryPath=(jobId:string)=>join(getDataDir(),"jobs",assertJobId(jobId),"queue.json");

export const persistQueuedJobRecovery=async(jobId:string,data:QueuedJobRecoveryData):Promise<void>=>{
  await writeFile(recoveryPath(jobId),`${JSON.stringify(data,null,2)}\n`,`utf8`);
};

export const recoverQueuedJob=async(jobId:string):Promise<boolean>=>{
  if(isActiveJob(jobId))return true;
  const status=await readJobStatus(jobId);
  if(status.state!=="queued")return false;

  let data:QueuedJobRecoveryData;
  try{
    data=JSON.parse(await readFile(recoveryPath(jobId),"utf8")) as QueuedJobRecoveryData;
  }catch{
    return false;
  }

  if(isActiveJob(jobId))return true;
  const signal=registerActiveJob(jobId);
  try{
    enqueueRenderJob({...data,jobId,signal});
    return true;
  }catch(error){
    unregisterActiveJob(jobId);
    throw error;
  }
};
