import type {NormalizedScene} from "@studytube/core";
import {SceneRenderer} from "./SceneRenderer";
import {StructuredSceneRenderer} from "./StructuredScenes";

export const SceneRouter = ({
  normalizedScene,
}: {
  normalizedScene: NormalizedScene;
}) => {
  switch (normalizedScene.scene.type) {
    case "timeline":
    case "process":
    case "flowchart":
    case "diagram":
    case "iconScene":
      return <StructuredSceneRenderer normalizedScene={normalizedScene} />;
    default:
      return <SceneRenderer normalizedScene={normalizedScene} />;
  }
};
