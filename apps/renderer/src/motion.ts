import type {NormalizedScene} from "@studytube/core";
import {motion} from "@studytube/design-system";
import type {CSSProperties} from "react";
import {interpolate, spring} from "remotion";

type MotionIntent = NonNullable<NormalizedScene["scene"]["motion"]>;

type SceneMotionOptions = {
  frame: number;
  durationInFrames: number;
  fps: number;
  intent: MotionIntent;
};

export const getSceneMotionStyle = ({
  frame,
  durationInFrames,
  fps,
  intent,
}: SceneMotionOptions): CSSProperties => {
  const entranceFrames = Math.min(
    motion.entranceFrames,
    Math.max(1, Math.floor(durationInFrames / 3)),
  );
  const exitFrames = Math.min(
    motion.exitFrames,
    Math.max(1, Math.floor(durationInFrames / 4)),
  );
  const exitStart = Math.max(entranceFrames, durationInFrames - exitFrames);

  const enter = interpolate(frame, [0, entranceFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const leave = interpolate(frame, [exitStart, Math.max(exitStart + 1, durationInFrames - 1)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(enter, leave);

  if (intent === "slide" || intent === "reveal") {
    return {
      opacity,
      transform: `translateY(${(1 - enter) * motion.slideDistance}px)`,
    };
  }

  if (intent === "scale") {
    const scale = motion.subtleScale + enter * (1 - motion.subtleScale);
    return {opacity, transform: `scale(${scale})`};
  }

  if (intent === "cameraPush" || intent === "parallax") {
    const scale = 1 + enter * (motion.cameraScale - 1);
    const translateX = intent === "parallax" ? (1 - enter) * 28 : 0;
    return {
      opacity,
      transform: `translateX(${translateX}px) scale(${scale})`,
    };
  }

  if (intent === "slam") {
    const impact = spring({
      frame,
      fps,
      config: {damping: 12, mass: 0.7, stiffness: 170},
      durationInFrames: entranceFrames + 8,
    });
    return {
      opacity,
      transform: `scale(${0.78 + impact * 0.22})`,
    };
  }

  return {opacity};
};
