#!/usr/bin/env node
import {resolve} from "node:path";
import {runStudyTubeJob,type TtsProviderKind} from "./pipeline";

const args=process.argv.slice(2);
const projectArg=args.find((arg)=>!arg.startsWith("--"));
if(!projectArg){
  console.error("Usage: npm run render:project -- <project.studytube.json> [--piper|--synthetic] [--no-captions]");
  process.exitCode=1;
}else{
  const ttsProvider:TtsProviderKind=args.includes("--synthetic")?"synthetic":args.includes("--piper")?"piper":"edge";
  const result=await runStudyTubeJob({
    projectPath:resolve(projectArg),
    ttsProvider,
    showCaptions:!args.includes("--no-captions"),
  });
  console.log(JSON.stringify({jobId:result.jobId,outputPath:result.outputPath,statusPath:result.paths.statusFile},null,2));
}
