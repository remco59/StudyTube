  const outputPath=join(args.outputDir,`${args.outputBaseName}.jpg`);
  await args.renderThumbnail({entryPoint:args.entryPoint,publicDir:args.publicDir,outputPath,props:args.props,frame,signal:args.signal});
  return outputPath;
};

const renderFull=async(args:{entryPoint:string;publicDir:string;outputPath:string;props:StudyTubeRenderProps;renderEngine:RenderEngine;render:PipelineRenderFunction;signal?:AbortSignal;reportProgress:(fraction:number,stage:string|undefined,absoluteFrame:number|undefined)=>void})=>{
  await args.render({
    entryPoint:args.entryPoint,publicDir:args.publicDir,outputPath:args.outputPath,props:args.props,renderEngine:args.renderEngine,signal:args.signal,
    onProgress:({progress,stage,renderedFrames})=>{args.reportProgress(progress,stage,renderedFrames);},
  });
};

const renderIncremental=async(args:{
  runs:SceneRun[];baseOutputPath:string;fps:number;entryPoint:string;publicDir:string;outputPath:string;props:StudyTubeRenderProps;renderEngine:RenderEngine;
  render:PipelineRenderFunction;extractSegment:typeof extractSegment;concatenateSegments:typeof concatenateSegments;segmentsDir:string;signal?:AbortSignal;
  reportProgress:(fraction:number,stage:string|undefined,absoluteFrame:number|undefined)=>void;
})=>{
  const extractWeight=.2;
  const totalWork=args.runs.reduce((sum,run)=>sum+(run.endFrameExclusive-run.startFrame)*(run.kind==="reuse"?extractWeight:1),0);
  let completedWork=0;
  const segmentPaths:string[]=[];
  await mkdir(args.segmentsDir,{recursive:true});

  try{
    for(const [index,run] of args.runs.entries()){
      if(args.signal?.aborted)throw new Error("Render cancelled");
      const frameCount=run.endFrameExclusive-run.startFrame;
      const segmentPath=join(args.segmentsDir,`segment-${index}.mp4`);
      if(run.kind==="reuse"){
        await args.extractSegment(args.baseOutputPath,run.baseStartFrame??run.startFrame,frameCount,args.fps,segmentPath,args.signal);
        completedWork+=frameCount*extractWeight;
        args.reportProgress(completedWork/totalWork,"reusing",run.endFrameExclusive);
      }else{
        await args.render({
          entryPoint:args.entryPoint,publicDir:args.publicDir,outputPath:segmentPath,props:args.props,renderEngine:args.renderEngine,
          frameRange:[run.startFrame,run.endFrameExclusive-1],signal:args.signal,
          onProgress:({progress,stage,renderedFrames})=>{
            const runFraction=clamp(progress);
            const absoluteFrame=Math.min(run.endFrameExclusive,run.startFrame+Math.round(runFraction*frameCount));
            args.reportProgress((completedWork+runFraction*frameCount)/totalWork,stage,absoluteFrame);
          },
        });
        completedWork+=frameCount;
        args.reportProgress(completedWork/totalWork,"rendering",run.endFrameExclusive);
      }
      segmentPaths.push(segmentPath);
    }

    await args.concatenateSegments(segmentPaths,args.outputPath,args.signal);
  }finally{
    await rm(args.segmentsDir,{recursive:true,force:true}).catch((error)=>{console.error(`StudyTube render: failed to remove segment directory ${args.segmentsDir}`,error);});
  }
};
const createJobId=(date:Date)=>`${date.toISOString().replaceAll(":","").replaceAll(".","-")}-${randomUUID().slice(0,8)}`;
const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/gu,"-").replace(/^-+|-+$/gu,"").slice(0,70);
const clamp=(value:number)=>Math.min(1,Math.max(0,value));
const locateSceneProgress=(scenes:NormalizedScene[],totalFrames:number,renderedFrames:number|undefined,etaSeconds:number|undefined):SceneProgress|undefined=>{
  if(scenes.length===0)return undefined;
  const frames=Math.min(totalFrames,Math.max(0,renderedFrames??0));
  const currentIndex=scenes.findIndex((scene)=>frames<scene.endFrameExclusive);
  const index=currentIndex===-1?scenes.length-1:currentIndex;
  return {
    currentSceneId:scenes[index]?.scene.id,
    currentSceneIndex:index,
    completedScenes:currentIndex===-1?scenes.length:currentIndex,
    totalScenes:scenes.length,
    etaSeconds,
  };
};