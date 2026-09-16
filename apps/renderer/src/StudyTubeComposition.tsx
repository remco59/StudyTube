import type {NarrationManifest,NormalizedStudyTubeProject} from "@studytube/core";
import {colors,resolveStylePresetVariables,typography} from "@studytube/design-system";
import type {CSSProperties} from "react";
import {AbsoluteFill,Audio,Sequence,staticFile} from "remotion";
import {normalizeProjectAssetPath} from "./assets/assetResolver";
import {CaptionOverlay} from "./components/CaptionOverlay";
import {SceneFrame} from "./components/SceneFrame";

export type StudyTubeCompositionProps={
  project:NormalizedStudyTubeProject;
  narration?:NarrationManifest;
  showCaptions?:boolean;
};

export const StudyTubeComposition=({project,narration,showCaptions=true}:StudyTubeCompositionProps)=>{
  const themeVariables=resolveStylePresetVariables(project.project.metadata.style);
  return <AbsoluteFill style={{...themeVariables,backgroundColor:colors.canvas,color:colors.text,fontFamily:typography.fontFamily} as CSSProperties}>{project.chapters.flatMap((chapter)=>chapter.scenes.map((normalizedScene)=>{
  const track=narration?.[normalizedScene.scene.id];
  const captionsVisible=Boolean(track&&showCaptions);
  return <Sequence key={normalizedScene.scene.id} from={normalizedScene.startFrame} durationInFrames={normalizedScene.durationInFrames} name={`${chapter.title} / ${normalizedScene.scene.id}`}>
    <SceneFrame chapterTitle={chapter.title} normalizedScene={normalizedScene} project={project.project} hasCaptions={captionsVisible}/>
    {track?<Audio src={staticFile(normalizeProjectAssetPath(track.sourcePath))}/>:null}
    {track&&showCaptions?<CaptionOverlay cues={track.captions}/>:null}
  </Sequence>;
}))}</AbsoluteFill>;
};
