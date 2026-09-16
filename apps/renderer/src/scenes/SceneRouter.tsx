import type {NormalizedScene,NormalizedStudyTubeProject} from "@studytube/core";
import {MediaSceneRenderer} from "./MediaScenes";
import {SafeComparisonScene} from "./SafeComparisonScene";
import {SceneRenderer} from "./SceneRenderer";
import {StructuredSceneRenderer} from "./StructuredScenes";

type Project=NormalizedStudyTubeProject["project"];

export const SceneRouter=({normalizedScene,project}:{normalizedScene:NormalizedScene;project:Project})=>{
  switch(normalizedScene.scene.type){
    case "comparison":return <SafeComparisonScene scene={normalizedScene.scene}/>;
    case "timeline":case "process":case "flowchart":case "diagram":case "iconScene":return <StructuredSceneRenderer normalizedScene={normalizedScene}/>;
    case "image":case "document":case "documentHighlight":case "visualGag":return <MediaSceneRenderer normalizedScene={normalizedScene} project={project}/>;
    default:return <SceneRenderer normalizedScene={normalizedScene}/>;
  }
};
