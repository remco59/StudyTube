import type {NormalizedStudyTubeProject} from "@studytube/core";
import {colors,typography} from "@studytube/design-system";
import {AbsoluteFill,Sequence} from "remotion";
import {SceneFrame} from "./components/SceneFrame";

export type StudyTubeCompositionProps={project:NormalizedStudyTubeProject};

export const StudyTubeComposition=({project}:StudyTubeCompositionProps)=><AbsoluteFill style={{backgroundColor:colors.canvas,color:colors.text,fontFamily:typography.fontFamily}}>{project.chapters.flatMap((chapter)=>chapter.scenes.map((normalizedScene)=><Sequence key={normalizedScene.scene.id} from={normalizedScene.startFrame} durationInFrames={normalizedScene.durationInFrames} name={`${chapter.title} / ${normalizedScene.scene.id}`}><SceneFrame chapterTitle={chapter.title} normalizedScene={normalizedScene} project={project.project}/></Sequence>))}</AbsoluteFill>;
