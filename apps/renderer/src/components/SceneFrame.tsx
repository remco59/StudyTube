import type {NormalizedScene} from "@studytube/core";
import {
  colors,
  radii,
  spacing,
  typography,
  video,
} from "@studytube/design-system";
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion";
import {getSceneMotionStyle} from "../motion";
import {SceneRouter} from "../scenes/SceneRouter";

export type SceneFrameProps = {
  chapterTitle: string;
  normalizedScene: NormalizedScene;
};

export const SceneFrame = ({chapterTitle, normalizedScene}: SceneFrameProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {scene, durationInFrames} = normalizedScene;
  const immersive = scene.type === "title" || scene.type === "chapterIntro";
  const animatedStyle = getSceneMotionStyle({
    frame,
    durationInFrames,
    fps,
    intent: scene.motion ?? "fade",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 82% 18%, rgba(179, 164, 255, 0.12), transparent 28%), linear-gradient(135deg, #101216 0%, #151820 100%)",
        paddingTop: video.safeArea.top,
        paddingRight: video.safeArea.right,
        paddingBottom: video.safeArea.bottom,
        paddingLeft: video.safeArea.left,
      }}
    >
      <div
        style={{
          ...animatedStyle,
          display: "flex",
          flex: 1,
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {!immersive ? (
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                ...typography.label,
                color: colors.accent,
                textTransform: "uppercase",
              }}
            >
              {chapterTitle}
            </div>
            <div
              style={{
                ...typography.label,
                backgroundColor: colors.surface,
                border: `1px solid ${colors.line}`,
                borderRadius: radii.pill,
                color: colors.textMuted,
                padding: `${spacing.xs}px ${spacing.sm}px`,
                textTransform: "uppercase",
              }}
            >
              {scene.type}
            </div>
          </div>
        ) : null}

        <div
          style={{
            alignItems: "stretch",
            display: "flex",
            flex: 1,
            justifyContent: "center",
            minHeight: 0,
            padding: immersive ? 0 : `${spacing.lg}px 0`,
          }}
        >
          <SceneRouter normalizedScene={normalizedScene} />
        </div>

        {!immersive ? (
          <div
            style={{
              ...typography.label,
              color: colors.textMuted,
              display: "flex",
              justifyContent: "space-between",
              textTransform: "uppercase",
            }}
          >
            <span>{scene.id}</span>
            <span>StudyTube</span>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
