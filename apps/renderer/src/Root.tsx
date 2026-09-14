import {Composition} from "remotion";
import {video} from "@studytube/design-system";
import {
  StudyTubeComposition,
  type StudyTubeCompositionProps,
} from "./StudyTubeComposition";
import {SAMPLE_NORMALIZED_PROJECT} from "./sampleProject";

export const RemotionRoot = () => {
  return (
    <Composition
      id="StudyTube"
      component={StudyTubeComposition}
      defaultProps={{project: SAMPLE_NORMALIZED_PROJECT}}
      durationInFrames={SAMPLE_NORMALIZED_PROJECT.totalFrames}
      fps={SAMPLE_NORMALIZED_PROJECT.fps}
      width={video.width}
      height={video.height}
      calculateMetadata={({props}) => ({
        durationInFrames: props.project.totalFrames,
        fps: props.project.fps,
      })}
    />
  );
};

export type {StudyTubeCompositionProps};
