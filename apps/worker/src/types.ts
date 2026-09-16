export type JobState="queued"|"validating"|"synthesizing"|"staging"|"bundling"|"rendering"|"completed"|"failed"|"cancelled";
export type RenderEngine="cpu"|"intel"|"nvidia";
export type JobTtsProvider="edge"|"piper"|"omnivoice"|"chatterbox"|"xtts"|"google-chirp"|"azure"|"synthetic";

export type SceneProgress={
  currentSceneId?:string;
  currentSceneIndex:number;
  completedScenes:number;
  totalScenes:number;
  etaSeconds?:number;
};

export type StudyTubeJobStatus={
  jobId:string;
  state:JobState;
  progress:number;
  createdAt:string;
  updatedAt:string;
  projectTitle?:string;
  renderEngine?:RenderEngine;
  ttsProvider?:JobTtsProvider;
  outputPath?:string;
  error?:string;
  downloadedAt?:string;
  expiresAt?:string;
  sceneProgress?:SceneProgress;
  baseJobId?:string;
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
  sceneManifestFile:string;
};

export type RenderProgress={progress:number;stage?:string;renderedFrames?:number};
