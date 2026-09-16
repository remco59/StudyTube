import {appendFile,mkdir,rename,writeFile} from "node:fs/promises";
import {dirname,join} from "node:path";
import type {JobPaths,StudyTubeJobStatus} from "./types";

export const createJobPaths=(dataDir:string,jobId:string):JobPaths=>{
  const root=join(dataDir,"jobs",jobId);
  return {
    root,
    publicDir:join(root,"public"),
    outputDir:join(root,"output"),
    projectFile:join(root,"project.studytube.json"),
    statusFile:join(root,"status.json"),
    logFile:join(root,"logs.ndjson"),
    renderPropsFile:join(root,"render-props.json"),
    sceneManifestFile:join(root,"scene-manifest.json"),
  };
};

export const initializeJobPaths=async(paths:JobPaths)=>{
  await Promise.all([
    mkdir(paths.publicDir,{recursive:true}),
    mkdir(paths.outputDir,{recursive:true}),
    mkdir(dirname(paths.statusFile),{recursive:true}),
  ]);
};

export const writeJobStatus=async(paths:JobPaths,status:StudyTubeJobStatus)=>{
  const temporary=`${paths.statusFile}.tmp`;
  await writeFile(temporary,`${JSON.stringify(status,null,2)}\n`,`utf8`);
  await rename(temporary,paths.statusFile);
};

export const appendJobLog=async(paths:JobPaths,event:string,message:string,data?:unknown)=>{
  const entry={timestamp:new Date().toISOString(),event,message,...(data===undefined?{}:{data})};
  await appendFile(paths.logFile,`${JSON.stringify(entry)}\n`,`utf8`);
};
