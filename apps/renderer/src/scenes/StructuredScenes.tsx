import type {NormalizedScene} from "@studytube/core";
import {
  colors,
  radii,
  shadows,
  spacing,
  typography,
} from "@studytube/design-system";
import type {CSSProperties, ReactNode} from "react";
import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {IconGlyph} from "./IconGlyph";
import {
  getAdaptiveGridColumns,
  getFlowchartPositions,
  getOrbitPositions,
} from "./structuredLayout";

type Scene = NormalizedScene["scene"];
type SceneOf<T extends Scene["type"]> = Extract<Scene, {type: T}>;

export const StructuredSceneRenderer = ({
  normalizedScene,
}: {
  normalizedScene: NormalizedScene;
}) => {
  const {scene} = normalizedScene;
  switch (scene.type) {
    case "timeline":
      return <TimelineScene scene={scene} />;
    case "process":
      return <ProcessScene scene={scene} />;
    case "flowchart":
      return <FlowchartScene scene={scene} />;
    case "diagram":
      return <DiagramScene scene={scene} />;
    case "iconScene":
      return <IconScene scene={scene} />;
    default:
      throw new Error(`Structured scene renderer cannot render "${scene.type}".`);
  }
};

const TimelineScene = ({scene}: {scene: SceneOf<"timeline">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const columns = getAdaptiveGridColumns(scene.visual.items.length, 4);

  return (
    <Stage>
      <SceneTitle title={scene.visual.title ?? "Tijdlijn"} />
      <div
        style={{
          display: "grid",
          gap: spacing.md,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          width: "100%",
        }}
      >
        {scene.visual.items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            style={{
              ...reveal(frame, fps, index * 3),
              backgroundColor: colors.surface,
              border: `1px solid ${colors.line}`,
              borderRadius: radii.md,
              boxShadow: shadows.soft,
              minHeight: scene.visual.items.length > 4 ? 190 : 260,
              padding: spacing.md,
              position: "relative",
            }}
          >
            <div
              style={{
                backgroundColor: colors.accent,
                borderRadius: radii.pill,
                height: 10,
                left: spacing.md,
                position: "absolute",
                right: spacing.md,
                top: 0,
              }}
            />
            <div style={{...typography.label, color: colors.accent, marginTop: spacing.sm}}>
              {item.label}
            </div>
            <div style={{...typography.heading, fontSize: 38, marginTop: spacing.sm}}>
              {item.title}
            </div>
            {item.description ? (
              <div style={{...typography.body, color: colors.textMuted, fontSize: 27, marginTop: spacing.sm}}>
                {item.description}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Stage>
  );
};

const ProcessScene = ({scene}: {scene: SceneOf<"process">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const columns = getAdaptiveGridColumns(scene.visual.steps.length, 4);

  return (
    <Stage>
      <SceneTitle title={scene.visual.title ?? "Proces"} />
      <div
        style={{
          display: "grid",
          gap: spacing.md,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          width: "100%",
        }}
      >
        {scene.visual.steps.map((step, index) => (
          <div
            key={`${step.title}-${index}`}
            style={{
              ...reveal(frame, fps, index * 3),
              backgroundColor: index === 0 ? colors.accentSoft : colors.surface,
              border: `1px solid ${index === 0 ? colors.accentStrong : colors.line}`,
              borderRadius: radii.lg,
              minHeight: scene.visual.steps.length > 4 ? 190 : 300,
              padding: spacing.md,
              position: "relative",
            }}
          >
            <div style={{alignItems: "center", display: "flex", gap: spacing.sm}}>
              <div
                style={{
                  alignItems: "center",
                  backgroundColor: colors.accent,
                  borderRadius: radii.pill,
                  color: colors.canvas,
                  display: "flex",
                  flexShrink: 0,
                  fontSize: 26,
                  fontWeight: 900,
                  height: 52,
                  justifyContent: "center",
                  width: 52,
                }}
              >
                {index + 1}
              </div>
              {step.icon ? <IconGlyph icon={step.icon} size={36} /> : null}
            </div>
            <div style={{...typography.heading, fontSize: 38, marginTop: spacing.md}}>{step.title}</div>
            {step.description ? (
              <div style={{...typography.body, color: colors.textMuted, fontSize: 27, marginTop: spacing.sm}}>
                {step.description}
              </div>
            ) : null}
            {index < scene.visual.steps.length - 1 && scene.visual.steps.length <= 4 ? (
              <div
                style={{
                  color: colors.accent,
                  fontSize: 42,
                  fontWeight: 900,
                  position: "absolute",
                  right: -spacing.lg,
                  top: "45%",
                  zIndex: 4,
                }}
              >
                →
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Stage>
  );
};

const FlowchartScene = ({scene}: {scene: SceneOf<"flowchart">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const width = 1500;
  const height = 500;
  const positions = getFlowchartPositions(scene.visual.nodes.length, width, height);
  const positionById = new Map(scene.visual.nodes.map((node, index) => [node.id, positions[index]]));

  return (
    <Stage>
      <SceneTitle title={scene.visual.title ?? "Flowchart"} />
      <div style={{height, margin: "0 auto", position: "relative", width}}>
        <svg height={height} style={{left: 0, overflow: "visible", position: "absolute", top: 0}} width={width}>
          <defs>
            <marker id="studytube-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
              <path d="M0,0 L8,4 L0,8 z" fill={colors.accentStrong} />
            </marker>
          </defs>
          {scene.visual.edges.map((edge, index) => {
            const from = positionById.get(edge.from);
            const to = positionById.get(edge.to);
            if (!from || !to) return null;
            const progress = interpolate(frame, [6 + index * 2, 18 + index * 2], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            return (
              <g key={`${edge.from}-${edge.to}-${index}`} opacity={progress}>
                <path
                  d={`M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`}
                  fill="none"
                  markerEnd="url(#studytube-arrow)"
                  stroke={colors.accentStrong}
                  strokeWidth={5}
                />
                {edge.label ? (
                  <text fill={colors.textMuted} fontFamily={typography.fontFamily} fontSize={22} textAnchor="middle" x={midX} y={midY - 12}>
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {scene.visual.nodes.map((node, index) => {
          const point = positions[index];
          return (
            <div
              key={node.id}
              style={{
                ...reveal(frame, fps, index * 2),
                backgroundColor: colors.surfaceRaised,
                border: `1px solid ${colors.line}`,
                borderRadius: radii.md,
                boxShadow: shadows.soft,
                left: point.x - 135,
                minHeight: 100,
                padding: `${spacing.sm}px ${spacing.md}px`,
                position: "absolute",
                top: point.y - 50,
                width: 270,
                zIndex: 2,
              }}
            >
              <div style={{fontSize: 29, fontWeight: 800, lineHeight: 1.05}}>{node.label}</div>
              {node.detail ? (
                <div style={{color: colors.textMuted, fontSize: 21, lineHeight: 1.2, marginTop: 8}}>{node.detail}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

const DiagramScene = ({scene}: {scene: SceneOf<"diagram">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const width = 1450;
  const height = 560;
  const center = {x: width / 2, y: height / 2};
  const positions = getOrbitPositions(scene.visual.items.length, center, 510, 205);

  return (
    <Stage>
      <div style={{height, margin: "0 auto", position: "relative", width}}>
        <svg height={height} style={{left: 0, position: "absolute", top: 0}} width={width}>
          {positions.map((point, index) => (
            <line
              key={`line-${index}`}
              opacity={interpolate(frame, [4 + index * 2, 16 + index * 2], [0, 0.75], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}
              stroke={colors.line}
              strokeWidth={4}
              x1={center.x}
              x2={point.x}
              y1={center.y}
              y2={point.y}
            />
          ))}
        </svg>
        <div
          style={{
            ...reveal(frame, fps, 0),
            alignItems: "center",
            background: `linear-gradient(135deg, ${colors.accentSoft}, ${colors.surfaceRaised})`,
            border: `2px solid ${colors.accentStrong}`,
            borderRadius: radii.lg,
            display: "flex",
            fontSize: 38,
            fontWeight: 850,
            height: 150,
            justifyContent: "center",
            left: center.x - 155,
            padding: spacing.sm,
            position: "absolute",
            textAlign: "center",
            top: center.y - 75,
            width: 310,
            zIndex: 3,
          }}
        >
          {scene.visual.center}
        </div>
        {scene.visual.items.map((item, index) => {
          const point = positions[index];
          return (
            <div
              key={`${item.label}-${index}`}
              style={{
                ...reveal(frame, fps, 4 + index * 2),
                backgroundColor: colors.surface,
                border: `1px solid ${colors.line}`,
                borderRadius: radii.md,
                left: point.x - 135,
                minHeight: 92,
                padding: spacing.sm,
                position: "absolute",
                textAlign: "center",
                top: point.y - 46,
                width: 270,
                zIndex: 2,
              }}
            >
              {item.icon ? (
                <div style={{display: "flex", justifyContent: "center", marginBottom: 6}}>
                  <IconGlyph icon={item.icon} size={28} />
                </div>
              ) : null}
              <div style={{fontSize: 27, fontWeight: 800}}>{item.label}</div>
              {item.detail ? <div style={{color: colors.textMuted, fontSize: 19, marginTop: 4}}>{item.detail}</div> : null}
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

const IconScene = ({scene}: {scene: SceneOf<"iconScene">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const columns = getAdaptiveGridColumns(scene.visual.items.length, 3);

  return (
    <Stage>
      <SceneTitle title={scene.visual.title ?? "Overzicht"} />
      <div
        style={{
          display: "grid",
          gap: spacing.md,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          width: "100%",
        }}
      >
        {scene.visual.items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            style={{
              ...reveal(frame, fps, index * 3),
              alignItems: "center",
              backgroundColor: colors.surface,
              border: `1px solid ${colors.line}`,
              borderRadius: radii.lg,
              display: "flex",
              flexDirection: "column",
              minHeight: scene.visual.items.length > 3 ? 205 : 300,
              padding: spacing.md,
              textAlign: "center",
            }}
          >
            <div
              style={{
                alignItems: "center",
                backgroundColor: colors.accentSoft,
                border: `1px solid ${colors.accentStrong}`,
                borderRadius: radii.lg,
                color: colors.accent,
                display: "flex",
                fontSize: 54,
                height: 94,
                justifyContent: "center",
                width: 94,
              }}
            >
              <IconGlyph icon={item.icon} size={54} />
            </div>
            <div style={{fontSize: 34, fontWeight: 820, marginTop: spacing.sm}}>{item.label}</div>
            {item.detail ? (
              <div style={{...typography.body, color: colors.textMuted, fontSize: 24, marginTop: spacing.xs}}>{item.detail}</div>
            ) : null}
          </div>
        ))}
      </div>
    </Stage>
  );
};

const Stage = ({children}: {children: ReactNode}) => (
  <div
    style={{
      display: "flex",
      flex: 1,
      flexDirection: "column",
      justifyContent: "center",
      minHeight: 0,
      width: "100%",
    }}
  >
    {children}
  </div>
);

const SceneTitle = ({title}: {title: string}) => (
  <div style={{...typography.heading, fontSize: 54, marginBottom: spacing.lg}}>{title}</div>
);

const reveal = (
  frame: number,
  fps: number,
  delayFrames: number,
): CSSProperties => {
  const progress = interpolate(
    frame,
    [delayFrames, delayFrames + Math.max(8, Math.round(fps * 0.35))],
    [0, 1],
    {extrapolateLeft: "clamp", extrapolateRight: "clamp"},
  );
  return {
    opacity: progress,
    transform: `translateY(${(1 - progress) * 24}px)`,
  };
};
