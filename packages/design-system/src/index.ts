export const video = {
  width: 1920,
  height: 1080,
  fps: 30,
  safeArea: {
    top: 88,
    right: 112,
    bottom: 88,
    left: 112,
  },
} as const;

const colorKeys = [
  "canvas",
  "canvasSoft",
  "surface",
  "surfaceRaised",
  "text",
  "textMuted",
  "accent",
  "accentStrong",
  "accentSoft",
  "line",
  "paper",
  "paperText",
  "success",
  "warning",
] as const;

type ColorKey = (typeof colorKeys)[number];
type ColorPalette = Record<ColorKey, string>;
type StylePresetId = "educational-explainer" | "midnight-focus";

// Style presets swap only the color palette: typography, spacing and motion
// stay identical so every preset shares StudyTube's one consistent layout.
export const colorPresets: Record<StylePresetId, ColorPalette> = {
  "educational-explainer": {
    canvas: "#08131f",
    canvasSoft: "#0a2024",
    surface: "#0d1b26",
    surfaceRaised: "#102630",
    text: "#f3f7f6",
    textMuted: "#a8bab9",
    accent: "#1fc7a3",
    accentStrong: "#0ca783",
    accentSoft: "#123b38",
    line: "#1c4448",
    paper: "#f3f1e9",
    paperText: "#18201f",
    success: "#78d6a5",
    warning: "#f0c744",
  },
  "midnight-focus": {
    canvas: "#09111f",
    canvasSoft: "#0d1829",
    surface: "#101d2f",
    surfaceRaised: "#14253a",
    text: "#eef4ff",
    textMuted: "#9cacc3",
    accent: "#61cdea",
    accentStrong: "#34b1d5",
    accentSoft: "#143543",
    line: "#203b50",
    paper: "#eef3ff",
    paperText: "#101a2c",
    success: "#7be0b0",
    warning: "#ffcd6b",
  },
};

export const defaultStylePreset: StylePresetId = "educational-explainer";
export type { StylePresetId };

const cssVariableName = (key: ColorKey) => `--st-color-${key}`;

// Every color token below resolves through a CSS custom property instead of a
// literal value, so a single style-preset swap at the composition root
// (see resolveStylePresetVariables) recolors every consumer with no changes
// to the many files that already reference colors.<token>.
export const colors: ColorPalette = Object.fromEntries(
  colorKeys.map((key) => [key, `var(${cssVariableName(key)})`]),
) as ColorPalette;

export const resolveStylePresetVariables = (styleId?: string): Record<string, string> => {
  const preset = colorPresets[styleId as StylePresetId] ?? colorPresets[defaultStylePreset];
  return Object.fromEntries(colorKeys.map((key) => [cssVariableName(key), preset[key]]));
};

export const typography = {
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  display: {
    fontSize: 112,
    lineHeight: 0.94,
    fontWeight: 820,
    letterSpacing: -5.5,
  },
  heading: {
    fontSize: 64,
    lineHeight: 1.02,
    fontWeight: 780,
    letterSpacing: -2.2,
  },
  body: {
    fontSize: 36,
    lineHeight: 1.24,
    fontWeight: 520,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 760,
    letterSpacing: 2.4,
  },
} as const;

export const spacing = {
  xs: 12,
  sm: 20,
  md: 32,
  lg: 48,
  xl: 72,
  xxl: 104,
} as const;

export const radii = {
  sm: 10,
  md: 18,
  lg: 26,
  pill: 999,
} as const;

export const shadows = {
  soft: "0 10px 36px rgba(0, 0, 0, 0.12)",
  raised: "0 18px 64px rgba(0, 0, 0, 0.2)",
} as const;

export const motion = {
  entranceFrames: 14,
  exitFrames: 10,
  slideDistance: 54,
  subtleScale: 0.965,
  cameraScale: 1.045,
} as const;

export const studyTubeTheme = {
  video,
  colors,
  typography,
  spacing,
  radii,
  shadows,
  motion,
} as const;

export type StudyTubeTheme = typeof studyTubeTheme;
