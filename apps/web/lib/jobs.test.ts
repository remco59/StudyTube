import {mkdir,mkdtemp,readdir,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach,beforeEach,describe,expect,it} from "vitest";

const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map((root)=>rm(root,{recursive:true,force:true})));});

const useDataDir=async()=>{
  const root=await mkdtemp(join(tmpdir(),"studytube-web-jobs-"));
  roots.push(root);
  process.env.STUDYTUBE_DATA_DIR=root;
  return root;
};

const writeStatus=async(root:string,jobId:string,status:Record<string,unknown>)=>{
  const jobRoot=join(root,"jobs",jobId);
  await mkdir(jobRoot,{recursive:true});
  await writeFile(join(jobRoot,"status.json"),JSON.stringify(status));
};

describe("jobs",()=>{
  beforeEach(()=>{delete process.env.STUDYTUBE_DATA_DIR;});

  it("rejects job ids that are empty, too long, or contain unsafe characters",async()=>{
    const {assertJobId}=await import("./jobs");
    expect(assertJobId("web-1234-abcd")).toBe("web-1234-abcd");
    expect(()=>assertJobId("")).toThrow(/Invalid job id/);
    expect(()=>assertJobId("a".repeat(121))).toThrow(/Invalid job id/);
    expect(()=>assertJobId("../../etc/passwd")).toThrow(/Invalid job id/);
    expect(()=>assertJobId("job/with/slashes")).toThrow(/Invalid job id/);
  });

  it("marks a non-active, non-terminal job as failed and cleans up its working data",async()=>{
    const root=await useDataDir();
    const {markJobInterrupted,readJobStatus}=await import("./jobs");
    await writeStatus(root,"job-1",{jobId:"job-1",state:"rendering",progress:.4,createdAt:"2024-01-01T00:00:00.000Z",updatedAt:"2024-01-01T00:00:00.000Z"});
    await mkdir(join(root,"jobs","job-1","public"),{recursive:true});

    const result=await markJobInterrupted("job-1");
    expect(result.state).toBe("failed");
    expect(result.error).toMatch(/restarted or stopped/);

    const persisted=await readJobStatus("job-1");
    expect(persisted.state).toBe("failed");
  });

  it("leaves an active job's status untouched",async()=>{
    const root=await useDataDir();
    const {registerActiveJob,unregisterActiveJob}=await import("./activeJobs");
    const {markJobInterrupted}=await import("./jobs");
    await writeStatus(root,"job-2",{jobId:"job-2",state:"rendering",progress:.2,createdAt:"2024-01-01T00:00:00.000Z",updatedAt:"2024-01-01T00:00:00.000Z"});
    registerActiveJob("job-2");
    try{
      const result=await markJobInterrupted("job-2");
      expect(result.state).toBe("rendering");
    }finally{
      unregisterActiveJob("job-2");
    }
  });

  it("lists jobs newest first and caps the total returned",async()=>{
    const root=await useDataDir();
    const {listJobStatuses}=await import("./jobs");
    for(let index=0;index<3;index++){
      const createdAt=new Date(2024,0,index+1).toISOString();
      await writeStatus(root,`job-${index}`,{jobId:`job-${index}`,state:"completed",progress:1,createdAt,updatedAt:createdAt,outputPath:join(root,"out.mp4")});
    }
    const statuses=await listJobStatuses();
    expect(statuses.map((status)=>status.jobId)).toEqual(["job-2","job-1","job-0"]);
  });

  it("returns an empty list when the jobs directory does not exist yet",async()=>{
    await useDataDir();
    const {listJobStatuses}=await import("./jobs");
    expect(await listJobStatuses()).toEqual([]);
  });

  it("rejects downloading a job that has not completed",async()=>{
    const root=await useDataDir();
    const {markJobDownloaded}=await import("./jobs");
    await writeStatus(root,"job-pending",{jobId:"job-pending",state:"rendering",progress:.5,createdAt:"2024-01-01T00:00:00.000Z",updatedAt:"2024-01-01T00:00:00.000Z"});
    await expect(markJobDownloaded("job-pending")).rejects.toThrow(/not ready/);
  });

  it("records a download timestamp once and keeps it on repeat downloads",async()=>{
    const root=await useDataDir();
    const {markJobDownloaded}=await import("./jobs");
    await writeStatus(root,"job-done",{jobId:"job-done",state:"completed",progress:1,createdAt:"2024-01-01T00:00:00.000Z",updatedAt:"2024-01-01T00:00:00.000Z",outputPath:join(root,"video.mp4")});

    const first=await markJobDownloaded("job-done");
    expect(first.downloadedAt).toBeDefined();

    const second=await markJobDownloaded("job-done");
    expect(second.downloadedAt).toBe(first.downloadedAt);
  });

  it("prunes completed renders of the same project beyond the retention count, oldest first",async()=>{
    const root=await useDataDir();
    const {MAX_COMPLETED_RENDERS_PER_PROJECT,pruneOldRenders}=await import("./jobs");
    for(let index=0;index<MAX_COMPLETED_RENDERS_PER_PROJECT+2;index++){
      const createdAt=new Date(2024,0,index+1).toISOString();
      await writeStatus(root,`job-${index}`,{jobId:`job-${index}`,state:"completed",progress:1,projectTitle:"My video",createdAt,updatedAt:createdAt});
    }
    await pruneOldRenders();
    const remaining=await readdir(join(root,"jobs"));
    expect(remaining.sort()).toEqual(["job-2","job-3","job-4","job-5","job-6"]);
  });

  it("does not prune jobs from other projects or non-completed jobs",async()=>{
    const root=await useDataDir();
    const {pruneOldRenders}=await import("./jobs");
    await writeStatus(root,"other-project",{jobId:"other-project",state:"completed",progress:1,projectTitle:"Another video",createdAt:"2024-01-01T00:00:00.000Z",updatedAt:"2024-01-01T00:00:00.000Z"});
    await writeStatus(root,"still-rendering",{jobId:"still-rendering",state:"rendering",progress:.5,projectTitle:"My video",createdAt:"2024-01-01T00:00:00.000Z",updatedAt:"2024-01-01T00:00:00.000Z"});
    await pruneOldRenders();
    const remaining=await readdir(join(root,"jobs"));
    expect(remaining.sort()).toEqual(["other-project","still-rendering"]);
  });

  it("finds the most recently completed job with a matching project title",async()=>{
    const root=await useDataDir();
    const {findLatestCompletedJobByTitle}=await import("./jobs");
    await writeStatus(root,"job-older",{jobId:"job-older",state:"completed",progress:1,projectTitle:"My video",createdAt:"2024-01-01T00:00:00.000Z",updatedAt:"2024-01-01T00:00:00.000Z"});
    await writeStatus(root,"job-newer",{jobId:"job-newer",state:"completed",progress:1,projectTitle:"My video",createdAt:"2024-02-01T00:00:00.000Z",updatedAt:"2024-02-01T00:00:00.000Z"});
    await writeStatus(root,"job-other-title",{jobId:"job-other-title",state:"completed",progress:1,projectTitle:"Another video",createdAt:"2024-03-01T00:00:00.000Z",updatedAt:"2024-03-01T00:00:00.000Z"});
    await writeStatus(root,"job-not-completed",{jobId:"job-not-completed",state:"failed",progress:1,projectTitle:"My video",createdAt:"2024-04-01T00:00:00.000Z",updatedAt:"2024-04-01T00:00:00.000Z"});

    const match=await findLatestCompletedJobByTitle("My video");
    expect(match?.jobId).toBe("job-newer");
    expect(await findLatestCompletedJobByTitle("No such project")).toBeNull();
  });

  it("reads a job's stored project file",async()=>{
    const root=await useDataDir();
    const {readJobProjectFile}=await import("./jobs");
    await mkdir(join(root,"jobs","job-with-project"),{recursive:true});
    await writeFile(join(root,"jobs","job-with-project","project.studytube.json"),JSON.stringify({title:"stored"}));
    expect(JSON.parse(await readJobProjectFile("job-with-project"))).toEqual({title:"stored"});
  });
});
