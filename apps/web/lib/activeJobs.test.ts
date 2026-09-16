import {afterEach,describe,expect,it} from "vitest";
import {cancelActiveJob,isActiveJob,registerActiveJob,unregisterActiveJob} from "./activeJobs";

const registered:string[]=[];
const register=(jobId:string)=>{
  registered.push(jobId);
  return registerActiveJob(jobId);
};

afterEach(()=>{
  for(const jobId of registered.splice(0))unregisterActiveJob(jobId);
});

describe("active job cancellation",()=>{
  it("aborts the exact signal handed to the worker",()=>{
    const signal=register("cancel-signal-test");
    expect(signal.aborted).toBe(false);
    expect(isActiveJob("cancel-signal-test")).toBe(true);

    expect(cancelActiveJob("cancel-signal-test")).toBe(true);
    expect(signal.aborted).toBe(true);
  });

  it("does not report success for a job that is not active",()=>{
    expect(cancelActiveJob("missing-job")).toBe(false);
  });

  it("keeps a cancelled job registered until the worker cleanup path unregisters it",()=>{
    const signal=register("cancel-cleanup-test");
    cancelActiveJob("cancel-cleanup-test");

    expect(signal.aborted).toBe(true);
    expect(isActiveJob("cancel-cleanup-test")).toBe(true);

    unregisterActiveJob("cancel-cleanup-test");
    registered.splice(registered.indexOf("cancel-cleanup-test"),1);
    expect(isActiveJob("cancel-cleanup-test")).toBe(false);
  });
});
