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

export type SceneFrameProps = {
  chapterTitle: string;
  normalizedScene: NormalizedScene;
};

export const SceneFrame = ({chapterTitle, normalizedScene}: SceneFrameProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {scene, durationInFrames} = normalizedScene;
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

        <div
          style={{
            alignItems: "center",
            display: "flex",
            flex: 1,
            justifyContent: "center",
            padding: `${spacing.xl}px 0`,
          }}
        >
          <div
            style={{
              maxWidth: 1320,
              textAlign: "center",
            }}
          >
            <div
              style={{
                ...typography.display,
                fontSize: 88,
                marginBottom: spacing.lg,
              }}
            >
              {getPlaceholderHeadline(scene.type)}
            </div>
            <div
              style={{
                ...typography.body,
                color: colors.textMuted,
                margin: "0 auto",
                maxWidth: 1120,
              }}
            >
              {scene.narration}
            </div>
          </div>
        </div>

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
          <span>StudyTube composition shell</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const getPlaceholderHeadline = (sceneType: NormalizedScene["scene"]["type"]): string => {
  switch (sceneType) {
    case "title":
      return "Title scene";
    case "chapterIntro":
      return "Chapter intro";
    case "kineticText":
      return "Kinetic text";
    case "definition":
      return "Definition";
    case "bigNumber":
      return "Big number";
    case "comparison":
      return "Comparison";
    case "timeline":
      return "Timeline";
    case "process":
      return "Process";
    case "flowchart":
      return "Flowchart";
    case "diagram":
      return "Diagram";
    case "iconScene":
      return "Icon scene";
    case "document":
      return "Document";
    case "documentHighlight":
      return "Document highlight";
    case "image":
      return "Image";
    case "question":
      return "Question";
    case "visualGag":
      return "Visual gag";
    case "recap":
      return "Recap";
  }
};
