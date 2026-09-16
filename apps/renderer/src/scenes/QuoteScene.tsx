import type {NormalizedScene} from "@studytube/core";
import {colors, radii, shadows, spacing, typography} from "@studytube/design-system";
import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";

type Scene = NormalizedScene["scene"];
type QuoteSceneType = Extract<Scene, {type: "quote"}>;

export const QuoteScene = ({scene}: {scene: QuoteSceneType}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const quoteOpacity = interpolate(frame, [0, fps * 0.65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const metaOpacity = interpolate(frame, [fps * 0.45, fps * 1.05], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fontSize = scene.visual.quote.length > 420 ? 38 : scene.visual.quote.length > 260 ? 44 : scene.visual.quote.length > 140 ? 52 : 62;
  const attribution = [scene.visual.author, scene.visual.work].filter(Boolean).join(" — ");

  return (
    <div style={{alignItems: "center", display: "flex", flex: 1, justifyContent: "center", minHeight: 0, width: "100%"}}>
      <div style={{background: `linear-gradient(145deg, ${colors.surface}, ${colors.surfaceRaised})`, border: `1px solid ${colors.line}`, borderRadius: radii.lg, boxShadow: shadows.raised, maxWidth: 1460, padding: `${spacing.xxl}px ${spacing.xxl}px ${spacing.xl}px`, position: "relative", width: "100%"}}>
        <div aria-hidden="true" style={{color: colors.accent, fontFamily: "Georgia, serif", fontSize: 180, fontWeight: 900, left: spacing.xl, lineHeight: 0.8, opacity: 0.28, position: "absolute", top: spacing.lg}}>“</div>

        {scene.visual.context ? (
          <div style={{...typography.label, color: colors.accent, marginBottom: spacing.lg, opacity: metaOpacity, textTransform: "uppercase"}}>
            {scene.visual.context}
          </div>
        ) : null}

        <blockquote style={{borderLeft: `7px solid ${colors.accent}`, margin: 0, opacity: quoteOpacity, padding: `0 0 0 ${spacing.xl}px`, transform: `translateY(${(1 - quoteOpacity) * 24}px)`}}>
          <div style={{color: colors.text, fontFamily: "Georgia, serif", fontSize, fontStyle: "italic", fontWeight: 600, letterSpacing: -1.1, lineHeight: 1.2}}>
            “{scene.visual.quote}”
          </div>
        </blockquote>

        {(attribution || scene.visual.locator) ? (
          <div style={{alignItems: "baseline", display: "flex", flexWrap: "wrap", gap: 12, marginLeft: spacing.xl + 7, marginTop: spacing.xl, opacity: metaOpacity}}>
            {attribution ? <div style={{fontSize: 27, fontWeight: 850}}>{attribution}</div> : null}
            {scene.visual.locator ? <div style={{color: colors.textMuted, fontSize: 23}}>{scene.visual.locator}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};