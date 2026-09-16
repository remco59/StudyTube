import {mkdir,mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
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

  it("sets an expiry window on first download and keeps it on repeat downloads",async()=>{
    const root=await useDataDir();
    const {markJobDownloaded}=await import("./jobs");
    await writeStatus(root,"job-done",{jobId:"job-done",state:"completed",progress:1,createdAt:"2024-01-01T00:00:00.000Z",updatedAt:"2024-01-01T00:00:00.000Z",outputPath:join(root,"video.mp4")});

    const first=await markJobDownloaded("job-done");
    expect(first.expiresAt).toBeDefined();

    const second=await markJobDownloaded("job-done");
    expect(second.expiresAt).toBe(first.expiresAt);
  });

  it("removes jobs whose retention window has expired",async()=>{
    const root=await useDataDir();
    const {cleanupExpiredJobs}=await import("./jobs");
    const expiredAt=new Date(Date.now()-1000).toISOString();
    await writeStatus(root,"job-expired",{jobId:"job-expired",state:"completed",progress:1,createdAt:"2024-01-01T00:00:00.000Z",updatedAt:"2024-01-01T00:00:00.000Z",expiresAt:expiredAt});
    await cleanupExpiredJobs();
    await expect(readFile(join(root,"jobs","job-expired","status.json"),"utf8")).rejects.toThrow();
  });
});
