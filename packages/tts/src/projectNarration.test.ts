import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename,join} from "node:path";
import type {StudyTubeProject} from "@studytube/schema";
import {afterEach,describe,expect,it} from "vitest";
import {NarrationAudioCache,SyntheticWavProvider} from "./index";
import {prepareProjectNarration,toRendererNarrationManifest} from "./projectNarration";

const tempDirs:string[]=[];
afterEach(async()=>{await Promise.all(tempDirs.splice(0).map((dir)=>rm(dir,{recursive:true,force:true})));});

const project:StudyTubeProject={
  version:"1.0",
  metadata:{title:"Narration timing",language:"nl-NL",targetDuration:30,style:"educational-explainer"},
  chapters:[{id:"intro",title:"Intro",scenes:[
    {id:"a",type:"kineticText",narration:"Dit is een korte eerste zin.",visual:{text:"Eerste zin"}},
    {id:"b",type:"question",narration:"Daarna volgt een tweede uitleg met iets meer woorden.",visual:{question:"Wat volgt?"}}
  ]}]
};

describe("prepareProjectNarration",()=>{
  it("uses measured WAV durations for normalized scene timing and captions",async()=>{
    const dir=await mkdtemp(join(tmpdir(),"studytube-project-tts-"));tempDirs.push(dir);
    const prepared=await prepareProjectNarration(project,new NarrationAudioCache(dir,new SyntheticWavProvider()),{fps:30,scenePaddingSeconds:.5,captionMaxWords:4});
    const scenes=prepared.normalizedProject.chapters[0].scenes;
    expect(scenes).toHaveLength(2);
    for(const scene of scenes){
      const track=prepared.tracks[scene.scene.id];
      expect(scene.narrationDurationSeconds).toBeCloseTo(track.durationSeconds,5);
      expect(track.captions.length).toBeGreaterThan(0);
      expect(track.captions.at(-1)?.endFrameExclusive).toBe(Math.ceil(track.durationSeconds*30));
    }
    expect(scenes[1].startFrame).toBe(scenes[0].endFrameExclusive);

    const manifest=toRendererNarrationManifest(prepared,(path,sceneId)=>`audio/${sceneId}-${basename(path)}`);
    expect(manifest.a.sourcePath).toMatch(/^audio\/a-/u);
    expect(manifest.b.durationSeconds).toBeGreaterThan(0);
  });
});
