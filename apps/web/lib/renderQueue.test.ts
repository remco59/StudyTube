import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";

type StudyTubeGlobal=typeof globalThis&{__studytubeRenderQueue?:unknown};

const runStudyTubeJob=vi.fn();
vi.mock("@studytube/worker",()=>({runStudyTubeJob:(...args:unknown[])=>runStudyTubeJob(...args)}));
vi.mock("@/lib/activeJobs",()=>({unregisterActiveJob:vi.fn()}));
vi.mock("@/lib/jobs",()=>({cleanupCancelledJobWorkingData:vi.fn(async()=>undefined)}));
vi.mock("node:fs/promises",()=>({rm:vi.fn(async()=>undefined)}));

const job=(jobId:string)=>({
  jobId,
  projectPath:`/tmp/${jobId}.studytube.json`,
  dataDir:"/tmp/data",
  uploadRoot:`/tmp/uploads/${jobId}`,
  renderEngine:"cpu" as const,
  ttsProvider:"synthetic" as const,
  ttsSettings:{},
  signal:new AbortController().signal,
});

beforeEach(()=>{
  vi.resetModules();
  runStudyTubeJob.mockReset();
  delete (globalThis as StudyTubeGlobal).__studytubeRenderQueue;
});

afterEach(()=>{
  delete (globalThis as StudyTubeGlobal).__studytubeRenderQueue;
});

describe("renderQueue",()=>{
  it("runs queued jobs one at a time, in FIFO order",async()=>{
    const {enqueueRenderJob,getQueueSnapshot}=await import("./renderQueue");
    const order:string[]=[];
    let resolveFirst:(()=>void)|undefined;
    runStudyTubeJob.mockImplementation(async({jobId}:{jobId:string})=>{
      order.push(`start:${jobId}`);
      if(jobId==="job-a")await new Promise<void>((resolve)=>{resolveFirst=resolve;});
      order.push(`end:${jobId}`);
    });

    enqueueRenderJob(job("job-a"));
    enqueueRenderJob(job("job-b"));
    await Promise.resolve();
    await Promise.resolve();

    expect(order).toEqual(["start:job-a"]);
    expect(getQueueSnapshot()).toEqual(["job-b"]);

    resolveFirst?.();
    await vi.waitFor(()=>expect(order).toEqual(["start:job-a","end:job-a","start:job-b","end:job-b"]));
    expect(getQueueSnapshot()).toEqual([]);
  });

  it("reorders a pending job within the queue",async()=>{
    const {enqueueRenderJob,getQueueSnapshot,moveQueuedJob}=await import("./renderQueue");
    let release:(()=>void)|undefined;
    runStudyTubeJob.mockImplementation(async()=>{await new Promise<void>((resolve)=>{release=resolve;});});

    enqueueRenderJob(job("job-a"));
    enqueueRenderJob(job("job-b"));
    enqueueRenderJob(job("job-c"));
    await Promise.resolve();

    expect(getQueueSnapshot()).toEqual(["job-b","job-c"]);
    expect(moveQueuedJob("job-c","up")).toBe(true);
    expect(getQueueSnapshot()).toEqual(["job-c","job-b"]);
    expect(moveQueuedJob("job-c","up")).toBe(false);
    expect(moveQueuedJob("job-a","up")).toBe(false);
    expect(moveQueuedJob("missing","up")).toBe(false);

    release?.();
  });

  it("continues to the next job even when one fails",async()=>{
    const {enqueueRenderJob,getQueueSnapshot}=await import("./renderQueue");
    runStudyTubeJob.mockImplementation(async({jobId}:{jobId:string})=>{
      if(jobId==="job-a")throw new Error("boom");
    });

    enqueueRenderJob(job("job-a"));
    enqueueRenderJob(job("job-b"));

    await vi.waitFor(()=>expect(getQueueSnapshot()).toEqual([]));
    expect(runStudyTubeJob).toHaveBeenCalledTimes(2);
  });

  it("annotates a queued status with its position, and leaves other states untouched",async()=>{
    const {enqueueRenderJob,withQueuePosition}=await import("./renderQueue");
    let release:(()=>void)|undefined;
    runStudyTubeJob.mockImplementation(async()=>{await new Promise<void>((resolve)=>{release=resolve;});});

    enqueueRenderJob(job("job-a"));
    enqueueRenderJob(job("job-b"));
    await Promise.resolve();

    expect(withQueuePosition({jobId:"job-b",state:"queued",progress:0,createdAt:"",updatedAt:""})).toEqual({jobId:"job-b",state:"queued",progress:0,createdAt:"",updatedAt:"",queuePosition:1,queueLength:1});
    expect(withQueuePosition({jobId:"job-a",state:"queued",progress:0,createdAt:"",updatedAt:""})).toEqual({jobId:"job-a",state:"queued",progress:0,createdAt:"",updatedAt:""});
    expect(withQueuePosition({jobId:"job-a",state:"rendering",progress:.5,createdAt:"",updatedAt:""})).toEqual({jobId:"job-a",state:"rendering",progress:.5,createdAt:"",updatedAt:""});

    release?.();
  });

  it("rejects new jobs when the pending queue reaches its cap",async()=>{
    const {enqueueRenderJob,getAvailableQueueSlots,getQueueSnapshot,MAX_PENDING_RENDER_JOBS,RenderQueueFullError}=await import("./renderQueue");
    let releaseRunning:(()=>void)|undefined;
    runStudyTubeJob.mockImplementation(async({jobId}:{jobId:string})=>{
      if(jobId==="running")await new Promise<void>((resolve)=>{releaseRunning=resolve;});
    });

    enqueueRenderJob(job("running"));
    await Promise.resolve();
    expect(getAvailableQueueSlots()).toBe(MAX_PENDING_RENDER_JOBS);

    for(let index=0;index<MAX_PENDING_RENDER_JOBS;index+=1){
      enqueueRenderJob(job(`queued-${index}`));
    }

    expect(getQueueSnapshot()).toHaveLength(MAX_PENDING_RENDER_JOBS);
    expect(getAvailableQueueSlots()).toBe(0);
    expect(()=>enqueueRenderJob(job("overflow"))).toThrow(RenderQueueFullError);

    releaseRunning?.();
    await vi.waitFor(()=>expect(getQueueSnapshot()).toEqual([]));
  });
});
