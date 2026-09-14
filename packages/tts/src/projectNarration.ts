import {
  createPhraseCaptionCues,
  normalizeStudyTubeProject,
  type CaptionCue,
  type NarrationManifest,
  type NormalizedStudyTubeProject,
} from "@studytube/core";
import type {StudyTubeProject} from "@studytube/schema";
import {DEFAULT_DUTCH_LANGUAGE,NarrationAudioCache} from "./index";

export type PreparedNarrationTrack={
  cachePath:string;
  durationSeconds:number;
  cacheHit:boolean;
  providerId:string;
  voice?:string;
  captions:CaptionCue[];
};

export type PreparedNarrationProject={
  normalizedProject:NormalizedStudyTubeProject;
  tracks:Record<string,PreparedNarrationTrack>;
};

export type PrepareProjectNarrationOptions={
  fps?:number;
  scenePaddingSeconds?:number;
  language?:string;
  voice?:string;
  lengthScale?:number;
  captionMaxWords?:number;
};

export const prepareProjectNarration=async(
  project:StudyTubeProject,
  cache:NarrationAudioCache,
  options:PrepareProjectNarrationOptions={},
):Promise<PreparedNarrationProject>=>{
  const audioBySceneId=new Map<string,Awaited<ReturnType<NarrationAudioCache["synthesize"]>>>();
  for(const chapter of project.chapters){
    for(const scene of chapter.scenes){
      const audio=await cache.synthesize({
        text:scene.narration,
        language:options.language??DEFAULT_DUTCH_LANGUAGE,
        voice:options.voice,
        lengthScale:options.lengthScale,
      });
      audioBySceneId.set(scene.id,audio);
    }
  }

  const normalizedProject=await normalizeStudyTubeProject(project,{
    fps:options.fps,
    scenePaddingSeconds:options.scenePaddingSeconds,
    narrationDurationProvider:(scene)=>{
      const audio=audioBySceneId.get(scene.id);
      if(!audio) throw new Error(`Missing prepared narration for scene ${scene.id}`);
      return audio.durationSeconds;
    },
  });

  const tracks:Record<string,PreparedNarrationTrack>={};
  for(const chapter of normalizedProject.chapters){
    for(const normalizedScene of chapter.scenes){
      const audio=audioBySceneId.get(normalizedScene.scene.id);
      if(!audio) throw new Error(`Missing prepared narration for scene ${normalizedScene.scene.id}`);
      tracks[normalizedScene.scene.id]={
        cachePath:audio.path,
        durationSeconds:audio.durationSeconds,
        cacheHit:audio.cacheHit,
        providerId:audio.providerId,
        voice:audio.voice,
        captions:createPhraseCaptionCues(
          normalizedScene.scene.narration,
          audio.durationSeconds,
          normalizedProject.fps,
          options.captionMaxWords,
        ),
      };
    }
  }

  return {normalizedProject,tracks};
};

export const toRendererNarrationManifest=(
  prepared:PreparedNarrationProject,
  sourcePathForFile:(cachePath:string,sceneId:string)=>string,
):NarrationManifest=>Object.fromEntries(
  Object.entries(prepared.tracks).map(([sceneId,track])=>[
    sceneId,
    {
      sourcePath:sourcePathForFile(track.cachePath,sceneId),
      durationSeconds:track.durationSeconds,
      captions:track.captions,
    },
  ]),
);
