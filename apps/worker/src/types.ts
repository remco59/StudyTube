export type JobState="queued"|"validating"|"synthesizing"|"staging"|"bundling"|"rendering"|"completed"|"failed";

export type StudyTubeJobStatus={
  jobId:string;
  state:JobState;
  progress:number;
  createdAt:string;
  updatedAt:string;
  projectTitle?:string;
  outputPath?:string;
  error?:string;
};

export type JobPaths={
  root:string;
  publicDir:string;
  outputDir:string;
  projectFile:string;
  statusFile:string;
  logFile:string;
  renderPropsFile:string;
};

export type RenderProgress={progress:number;stage?:string};
