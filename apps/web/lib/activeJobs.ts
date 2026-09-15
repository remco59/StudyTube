type StudyTubeGlobal=typeof globalThis&{
  __studytubeActiveJobs?:Map<string,AbortController>;
};

const runtimeGlobal=globalThis as StudyTubeGlobal;
const activeJobs=runtimeGlobal.__studytubeActiveJobs??=new Map<string,AbortController>();

export const registerActiveJob=(jobId:string):AbortSignal=>{
  if(activeJobs.has(jobId))throw new Error(`Job ${jobId} is already active`);
  const controller=new AbortController();
  activeJobs.set(jobId,controller);
  return controller.signal;
};

export const cancelActiveJob=(jobId:string):boolean=>{
  const controller=activeJobs.get(jobId);
  if(!controller)return false;
  controller.abort();
  return true;
};

export const unregisterActiveJob=(jobId:string)=>{
  activeJobs.delete(jobId);
};
