import {Composition} from "remotion";
import {HelloComposition} from "./HelloComposition";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="StudyTubeHello"
        component={HelloComposition}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
