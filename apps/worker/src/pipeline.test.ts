import {mkdtemp,mkdir,readFile,rm,stat,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname,join} from "node:path";
import {SyntheticWavProvider} from "@studytube/tts";
import {afterEach,describe,expect,it,vi} from "vitest";
import {runStudyTubeJob,StudyTubeJobError} from "./pipeline";

const roots:string[]=[];
const makeRoot=async()=>{const root=await mkdtemp(join(tmpdir(),"studytube-worker-"));roots.push(root);return root;};
afterEach(async()=>{await Promise.all(roots.splice(0).map((root)=>rm(root,{recursive:true,force:true})));});

const writeProject=async(root:string,missingAsset=false)=>{
  const sourceDir=join(root,"source");
  await mkdir(join(sourceDir,"assets"),{recursive:true});
  if(!missingAsset) await writeFile(join(sourceDir,"assets","diagram.svg"),"<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
  const project={version:"1.0",metadata:{title:"Pipeline Test",language:"nl-NL",targetDuration:30,style:"educational-explainer"},assets:{diagram:{type:"image",path:"assets/diagram.svg",alt:"Diagram"}},chapters:[{id:"intro",title:"Intro",scenes:[{id:"one",type:"image",narration:"Dit is een test van de automatische renderpipeline.",visual:{assetId:"diagram",fit:"contain"}},{id:"two",type:"kineticText",narration:"Daarna volgt automatisch een tweede scene.",visual:{text:"Volledig automatisch"}}]}]};
  const projectPath=join(sourceDir,"pipeline.studytube.json");
  await writeFile(projectPath,JSON.stringify(project));
  return projectPath;
};

describe("runStudyTubeJob",()=>{
  it("stages assets and narration and completes a render job",async()=>{
    const root=await makeRoot();
    const projectPath=await writeProject(root);
    const render=vi.fn(async({publicDir,outputPath,props,onProgress})=>{
      expect((await stat(join(publicDir,"assets","diagram.svg"))).isFile()).toBe(true);
      expect((await stat(join(publicDir,"audio","one.wav"))).isFile()).toBe(true);
      expect(props.project.totalFrames).toBeGreaterThan(0);
      expect(props.narration?.one.captions.length).toBeGreaterThan(0);
      await onProgress?.({progress:.5,stage:"rendering"});
      await mkdir(dirname(outputPath),{recursive:true});
      await writeFile(outputPath,"fake mp4");
    });

    const result=await runStudyTubeJob({projectPath,dataDir:join(root,"data"),jobId:"job-test",ttsProvider:"synthetic"},{provider:new SyntheticWavProvider(),render});
    expect(render).toHaveBeenCalledTimes(1);
    expect((await readFile(result.paths.statusFile,"utf8"))).toContain('"state": "completed"');
    expect((await readFile(result.paths.logFile,"utf8"))).toContain("render.completed");
    expect((await stat(result.outputPath)).isFile()).toBe(true);
  });

  it("preserves failed status and logs when an asset cannot be staged",async()=>{
    const root=await makeRoot();
    const projectPath=await writeProject(root,true);
    const render=vi.fn(async()=>undefined);
    await expect(runStudyTubeJob({projectPath,dataDir:join(root,"data"),jobId:"job-fail",ttsProvider:"synthetic"},{provider:new SyntheticWavProvider(),render})).rejects.toBeInstanceOf(StudyTubeJobError);
    expect(render).not.toHaveBeenCalled();
    const status=await readFile(join(root,"data","jobs","job-fail","status.json"),"utf8");
    const logs=await readFile(join(root,"data","jobs","job-fail","logs.ndjson"),"utf8");
    expect(status).toContain('"state": "failed"');
    expect(logs).toContain("job.failed");
  });
});
