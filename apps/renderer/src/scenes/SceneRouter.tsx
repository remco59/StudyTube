import type {NormalizedScene,NormalizedStudyTubeProject} from "@studytube/core";
import {AnnotatedImageScene} from "./AnnotatedImageScene";
import {MediaSceneRenderer} from "./MediaScenes";
import {QuoteScene} from "./QuoteScene";
import {SafeComparisonScene} from "./SafeComparisonScene";
import {SafeFlowchartScene} from "./SafeFlowchartScene";
import {SceneRenderer} from "./SceneRenderer";
import {StructuredSceneRenderer} from "./StructuredScenes";
import {VersatileSceneRenderer} from "./VersatileScenes";

type Project=NormalizedStudyTubeProject["project"];

export const SceneRouter=({normalizedScene,project,documentPages}:{normalizedScene:NormalizedScene;project:Project;documentPages?:Record<string,string>})=>{
  switch(normalizedScene.scene.type){
    case "comparison":return <SafeComparisonScene scene={normalizedScene.scene}/>;
    case "flowchart":return <SafeFlowchartScene scene={normalizedScene.scene}/>;
    case "quote":return <QuoteScene scene={normalizedScene.scene}/>;
    case "annotatedImage":return <AnnotatedImageScene scene={normalizedScene.scene} project={project}/>;
    case "timeline":case "process":case "diagram":case "iconScene":return <StructuredSceneRenderer normalizedScene={normalizedScene}/>;
    case "image":case "video":case "document":case "documentHighlight":case "visualGag":return <MediaSceneRenderer normalizedScene={normalizedScene} project={project} documentPages={documentPages}/>;
    case "bulletReveal":case "dataChart":case "matrix":case "cycle":case "multipleChoice":case "workedExample":case "hierarchy":return <VersatileSceneRenderer normalizedScene={normalizedScene} project={project}/>;
    default:return <SceneRenderer normalizedScene={normalizedScene}/>;
  }
};