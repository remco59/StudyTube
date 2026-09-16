import type {NormalizedScene,NormalizedStudyTubeProject} from "@studytube/core";
import {describe,expect,it} from "vitest";
import {AnnotatedImageScene} from "./AnnotatedImageScene";
import {SafeComparisonScene} from "./SafeComparisonScene";
import {SafeFlowchartScene} from "./SafeFlowchartScene";
import {SceneRouter} from "./SceneRouter";

const project={} as NormalizedStudyTubeProject["project"];
const normalizedScene=(type:"comparison"|"flowchart"|"annotatedImage")=>({scene:{type}}) as NormalizedScene;

describe("SceneRouter dedicated scene routing",()=>{
  it("keeps comparison scenes on SafeComparisonScene",()=>{
    expect(SceneRouter({normalizedScene:normalizedScene("comparison"),project}).type).toBe(SafeComparisonScene);
  });

  it("keeps flowchart scenes on SafeFlowchartScene",()=>{
    expect(SceneRouter({normalizedScene:normalizedScene("flowchart"),project}).type).toBe(SafeFlowchartScene);
  });

  it("keeps annotated images on the letterbox-aware dedicated renderer",()=>{
    expect(SceneRouter({normalizedScene:normalizedScene("annotatedImage"),project}).type).toBe(AnnotatedImageScene);
  });
});
