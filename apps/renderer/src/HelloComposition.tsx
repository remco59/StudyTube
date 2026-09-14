import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const HelloComposition = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = spring({fps, frame, config: {damping: 14}});
  const opacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        backgroundColor: "#0d0f12",
        color: "#f4f1e8",
        display: "flex",
        fontFamily: "Inter, Arial, sans-serif",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity,
          textAlign: "center",
          transform: `scale(${0.9 + entrance * 0.1})`,
        }}
      >
        <div
          style={{
            color: "#a99cff",
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: 8,
            marginBottom: 28,
            textTransform: "uppercase",
          }}
        >
          StudyTube
        </div>
        <div
          style={{
            fontSize: 108,
            fontWeight: 800,
            letterSpacing: -7,
            lineHeight: 0.95,
          }}
        >
          Renderer online.
        </div>
      </div>
    </AbsoluteFill>
  );
};
