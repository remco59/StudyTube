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

type Scene = NormalizedScene["scene"];
type SceneOf<T extends Scene["type"]> = Extract<Scene, {type: T}>;

export const SceneRenderer = ({
  normalizedScene,
}: {
  normalizedScene: NormalizedScene;
}) => {
  const {scene} = normalizedScene;

  switch (scene.type) {
    case "title":
      return <TitleScene scene={scene} />;
    case "chapterIntro":
      return <ChapterIntroScene scene={scene} />;
    case "kineticText":
      return <KineticTextScene scene={scene} />;
    case "definition":
      return <DefinitionScene scene={scene} />;
    case "bigNumber":
      return <BigNumberScene scene={scene} />;
    case "comparison":
      return <ComparisonScene scene={scene} />;
    case "question":
      return <QuestionScene scene={scene} />;
    case "recap":
      return <RecapScene scene={scene} />;
    default:
      throw new Error(
        `StudyTube renderer does not implement scene type "${scene.type}" yet.`,
      );
  }
};

const TitleScene = ({scene}: {scene: SceneOf<"title">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const titleStyle = revealStyle(frame, fps, 0);
  const subtitleStyle = revealStyle(frame, fps, 5);

  return (
    <FullStage>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxWidth: 1450,
          width: "100%",
        }}
      >
        {scene.visual.eyebrow ? (
          <div
            style={{
              ...typography.label,
              ...revealStyle(frame, fps, 0),
              color: colors.accent,
              marginBottom: spacing.md,
              textTransform: "uppercase",
            }}
          >
            {scene.visual.eyebrow}
          </div>
        ) : null}
        <div
          style={{
            ...typography.display,
            ...titleStyle,
            fontSize: 126,
            maxWidth: 1420,
          }}
        >
          {scene.visual.title}
        </div>
        {scene.visual.subtitle ? (
          <div
            style={{
              ...typography.body,
              ...subtitleStyle,
              color: colors.textMuted,
              marginTop: spacing.lg,
              maxWidth: 980,
            }}
          >
            {scene.visual.subtitle}
          </div>
        ) : null}
        <div
          style={{
            ...revealStyle(frame, fps, 10),
            background: `linear-gradient(90deg, ${colors.accentStrong}, ${colors.accent})`,
            borderRadius: radii.pill,
            height: 10,
            marginTop: spacing.xl,
            width: 260,
          }}
        />
      </div>
    </FullStage>
  );
};

const ChapterIntroScene = ({scene}: {scene: SceneOf<"chapterIntro">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <FullStage>
      <div
        style={{
          alignItems: "flex-start",
          display: "grid",
          gap: spacing.xl,
          gridTemplateColumns: "240px 1fr",
          width: "100%",
        }}
      >
        <div
          style={{
            ...revealStyle(frame, fps, 0),
            alignItems: "center",
            aspectRatio: "1",
            backgroundColor: colors.accentSoft,
            border: `1px solid ${colors.accentStrong}`,
            borderRadius: radii.lg,
            color: colors.accent,
            display: "flex",
            fontSize: 92,
            fontWeight: 850,
            justifyContent: "center",
          }}
        >
          §
        </div>
        <div>
          <div
            style={{
              ...typography.label,
              ...revealStyle(frame, fps, 2),
              color: colors.accent,
              marginBottom: spacing.md,
              textTransform: "uppercase",
            }}
          >
            {scene.visual.chapterLabel ?? "Nieuw hoofdstuk"}
          </div>
          <div
            style={{
              ...typography.display,
              ...revealStyle(frame, fps, 5),
              fontSize: 112,
              maxWidth: 1160,
            }}
          >
            {scene.visual.title}
          </div>
          {scene.visual.subtitle ? (
            <div
              style={{
                ...typography.body,
                ...revealStyle(frame, fps, 10),
                color: colors.textMuted,
                marginTop: spacing.lg,
                maxWidth: 980,
              }}
            >
              {scene.visual.subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </FullStage>
  );
};

const KineticTextScene = ({scene}: {scene: SceneOf<"kineticText">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const emphasis = new Set(
    (scene.visual.emphasis ?? []).map((item) => normalizeWord(item)),
  );

  return (
    <FullStage centered>
      <div
        style={{
          ...typography.display,
          fontSize: 118,
          maxWidth: 1500,
          textAlign: "center",
        }}
      >
        {scene.visual.text.split(/\s+/u).map((word, index) => {
          const isEmphasized = emphasis.has(normalizeWord(word));
          return (
            <span
              key={`${word}-${index}`}
              style={{
                ...revealStyle(frame, fps, index * 2),
                color: isEmphasized ? colors.accent : colors.text,
                display: "inline-block",
                marginRight: 24,
                position: "relative",
              }}
            >
              {word}
              {isEmphasized ? (
                <span
                  style={{
                    backgroundColor: colors.accentStrong,
                    borderRadius: radii.pill,
                    bottom: -10,
                    height: 7,
                    left: 0,
                    opacity: 0.9,
                    position: "absolute",
                    right: 0,
                  }}
                />
              ) : null}
            </span>
          );
        })}
      </div>
    </FullStage>
  );
};

const DefinitionScene = ({scene}: {scene: SceneOf<"definition">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <FullStage centered>
      <div
        style={{
          display: "grid",
          gap: spacing.xl,
          gridTemplateColumns: "0.72fr 1.28fr",
          maxWidth: 1500,
          width: "100%",
        }}
      >
        <div style={revealStyle(frame, fps, 0)}>
          <div
            style={{
              ...typography.label,
              color: colors.accent,
              marginBottom: spacing.md,
              textTransform: "uppercase",
            }}
          >
            Definitie
          </div>
          <div
            style={{
              ...typography.heading,
              fontSize: 76,
              overflowWrap: "anywhere",
            }}
          >
            {scene.visual.term}
          </div>
        </div>
        <Surface style={revealStyle(frame, fps, 5)}>
          <div style={{...typography.heading, fontSize: 52}}>
            {scene.visual.definition}
          </div>
          {scene.visual.example ? (
            <div
              style={{
                ...typography.body,
                backgroundColor: colors.accentSoft,
                borderRadius: radii.md,
                color: colors.textMuted,
                marginTop: spacing.lg,
                padding: spacing.md,
              }}
            >
              <strong style={{color: colors.accent}}>Voorbeeld:</strong>{" "}
              {scene.visual.example}
            </div>
          ) : null}
        </Surface>
      </div>
    </FullStage>
  );
};

const BigNumberScene = ({scene}: {scene: SceneOf<"bigNumber">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <FullStage centered>
      <div style={{maxWidth: 1500, textAlign: "center", width: "100%"}}>
        <div
          style={{
            ...revealStyle(frame, fps, 0),
            color: colors.accent,
            fontSize: 230,
            fontWeight: 900,
            letterSpacing: -12,
            lineHeight: 0.82,
          }}
        >
          {scene.visual.value}
        </div>
        <div
          style={{
            ...typography.heading,
            ...revealStyle(frame, fps, 4),
            marginTop: spacing.xl,
          }}
        >
          {scene.visual.label}
        </div>
        {scene.visual.context ? (
          <div
            style={{
              ...typography.body,
              ...revealStyle(frame, fps, 8),
              color: colors.textMuted,
              margin: `${spacing.md}px auto 0`,
              maxWidth: 980,
            }}
          >
            {scene.visual.context}
          </div>
        ) : null}
      </div>
    </FullStage>
  );
};

const ComparisonScene = ({scene}: {scene: SceneOf<"comparison">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <FullStage centered>
      <div
        style={{
          alignItems: "stretch",
          display: "grid",
          gap: spacing.lg,
          gridTemplateColumns: "1fr 130px 1fr",
          maxWidth: 1540,
          width: "100%",
        }}
      >
        <ComparisonCard
          body={scene.visual.left.body}
          icon={scene.visual.left.icon}
          side="left"
          style={revealStyle(frame, fps, 0, -36)}
          title={scene.visual.left.title}
        />
        <div
          style={{
            ...revealStyle(frame, fps, 5),
            alignItems: "center",
            color: colors.accent,
            display: "flex",
            fontSize: 64,
            fontWeight: 900,
            justifyContent: "center",
          }}
        >
          {scene.visual.versusLabel ?? "VS"}
        </div>
        <ComparisonCard
          body={scene.visual.right.body}
          icon={scene.visual.right.icon}
          side="right"
          style={revealStyle(frame, fps, 8, 36)}
          title={scene.visual.right.title}
        />
      </div>
    </FullStage>
  );
};

const QuestionScene = ({scene}: {scene: SceneOf<"question">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <FullStage centered>
      <div style={{maxWidth: 1460, textAlign: "center"}}>
        <div
          style={{
            ...revealStyle(frame, fps, 0),
            color: colors.accent,
            fontSize: 72,
            fontWeight: 900,
            marginBottom: spacing.lg,
          }}
        >
          ?
        </div>
        <div
          style={{
            ...typography.display,
            ...revealStyle(frame, fps, 3),
            fontSize: 106,
          }}
        >
          {scene.visual.question}
        </div>
        {scene.visual.prompt ? (
          <div
            style={{
              ...typography.body,
              ...revealStyle(frame, fps, 9),
              color: colors.textMuted,
              marginTop: spacing.xl,
            }}
          >
            {scene.visual.prompt}
          </div>
        ) : null}
      </div>
    </FullStage>
  );
};

const RecapScene = ({scene}: {scene: SceneOf<"recap">}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <FullStage>
      <div style={{maxWidth: 1500, width: "100%"}}>
        <div
          style={{
            ...typography.label,
            ...revealStyle(frame, fps, 0),
            color: colors.accent,
            marginBottom: spacing.md,
            textTransform: "uppercase",
          }}
        >
          Samengevat
        </div>
        <div
          style={{
            ...typography.heading,
            ...revealStyle(frame, fps, 2),
            fontSize: 70,
            marginBottom: spacing.xl,
          }}
        >
          {scene.visual.title ?? "Dit moet je onthouden"}
        </div>
        <div style={{display: "grid", gap: spacing.sm}}>
          {scene.visual.points.map((point, index) => (
            <div
              key={`${point}-${index}`}
              style={{
                ...revealStyle(frame, fps, 5 + index * 3, 22),
                alignItems: "center",
                backgroundColor: colors.surface,
                border: `1px solid ${colors.line}`,
                borderRadius: radii.md,
                display: "grid",
                gap: spacing.md,
                gridTemplateColumns: "72px 1fr",
                padding: `${spacing.sm}px ${spacing.md}px`,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  backgroundColor: colors.accentSoft,
                  borderRadius: radii.sm,
                  color: colors.accent,
                  display: "flex",
                  fontSize: 30,
                  fontWeight: 850,
                  height: 56,
                  justifyContent: "center",
                  width: 56,
                }}
              >
                {index + 1}
              </div>
              <div style={{...typography.body, fontSize: 34}}>{point}</div>
            </div>
          ))}
        </div>
      </div>
    </FullStage>
  );
};

const FullStage = ({
  children,
  centered = false,
}: {
  children: ReactNode;
  centered?: boolean;
}) => (
  <div
    style={{
      alignItems: centered ? "center" : "flex-start",
      display: "flex",
      flex: 1,
      justifyContent: "center",
      minHeight: 0,
      width: "100%",
    }}
  >
    {children}
  </div>
);

const Surface = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <div
    style={{
      backgroundColor: colors.surface,
      border: `1px solid ${colors.line}`,
      borderRadius: radii.lg,
      boxShadow: shadows.soft,
      padding: spacing.xl,
      ...style,
    }}
  >
    {children}
  </div>
);

const ComparisonCard = ({
  body,
  icon,
  side,
  style,
  title,
}: {
  body?: string;
  icon?: string;
  side: "left" | "right";
  style: CSSProperties;
  title: string;
}) => (
  <Surface style={{...style, minHeight: 420}}>
    <div
      style={{
        ...typography.label,
        color: side === "left" ? colors.textMuted : colors.accent,
        marginBottom: spacing.lg,
        textTransform: "uppercase",
      }}
    >
      {icon ?? (side === "left" ? "A" : "B")}
    </div>
    <div style={{...typography.heading, fontSize: 62}}>{title}</div>
    {body ? (
      <div
        style={{
          ...typography.body,
          color: colors.textMuted,
          marginTop: spacing.lg,
        }}
      >
        {body}
      </div>
    ) : null}
  </Surface>
);

const revealStyle = (
  frame: number,
  fps: number,
  delayFrames: number,
  distance = 34,
): CSSProperties => {
  const duration = Math.max(8, Math.round(fps * 0.42));
  const progress = interpolate(
    frame,
    [delayFrames, delayFrames + duration],
    [0, 1],
    {extrapolateLeft: "clamp", extrapolateRight: "clamp"},
  );

  return {
    opacity: progress,
    transform: `translateY(${(1 - progress) * distance}px)`,
  };
};

const normalizeWord = (value: string) =>
  value.toLocaleLowerCase("nl-NL").replace(/[^\p{L}\p{N}]+/gu, "");
