#!/usr/bin/env node
import {resolve} from "node:path";
import {runStudyTubeJob} from "./pipeline";

const args=process.argv.slice(2);
const projectArg=args.find((arg)=>!arg.startsWith("--"));
if(!projectArg){
  console.error("Usage: npm run render:project -- <project.studytube.json> [--synthetic] [--no-captions]");
  process.exitCode=1;
}else{
  const result=await runStudyTubeJob({
    projectPath:resolve(projectArg),
    ttsProvider:args.includes("--synthetic")?"synthetic":"piper",
    showCaptions:!args.includes("--no-captions"),
  });
  console.log(JSON.stringify({jobId:result.jobId,outputPath:result.outputPath,statusPath:result.paths.statusFile},null,2));
}
