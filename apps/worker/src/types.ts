export type JobState="queued"|"validating"|"synthesizing"|"staging"|"bundling"|"rendering"|"completed"|"failed"|"cancelled";

export type StudyTubeJobStatus={
  jobId:string;
  state:JobState;
  progress:number;
  createdAt:string;
  updatedAt:string;
  projectTitle?:string;
  outputPath?:string;
  error?:string;
  downloadedAt?:string;
  expiresAt?:string;
};

export type JobLogEntry={
  timestamp:string;
  event:string;
  message:string;
  data?:unknown;
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
