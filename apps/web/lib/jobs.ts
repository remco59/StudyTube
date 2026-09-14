import {readFile} from "node:fs/promises";
import {join,resolve} from "node:path";
import type {StudyTubeJobStatus} from "@studytube/worker/types";

export const getDataDir=()=>resolve(process.env.STUDYTUBE_DATA_DIR??"data");

export const assertJobId=(jobId:string)=>{
  if(!jobId||jobId.length>120||![...jobId].every((char)=>/[a-zA-Z0-9_-]/u.test(char))) throw new Error("Invalid job id");
  return jobId;
};

export const readJobStatus=async(jobId:string):Promise<StudyTubeJobStatus>=>{
  const safe=assertJobId(jobId);
  const statusPath=join(getDataDir(),"jobs",safe,"status.json");
  return JSON.parse(await readFile(statusPath,"utf8")) as StudyTubeJobStatus;
};
