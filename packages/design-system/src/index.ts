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
    canvas: "#101216",
    canvasSoft: "#171a20",
    surface: "#1d2129",
    surfaceRaised: "#252a34",
    text: "#f4f1e8",
    textMuted: "#a9adb8",
    accent: "#b3a4ff",
    accentStrong: "#8f7cff",
    accentSoft: "#302a52",
    line: "#343946",
    paper: "#f4f1e8",
    paperText: "#17191d",
    success: "#8ed9ad",
    warning: "#f2cd73",
  },
  "midnight-focus": {
    canvas: "#0b1220",
    canvasSoft: "#101a2c",
    surface: "#152238",
    surfaceRaised: "#1c2d47",
    text: "#eef3ff",
    textMuted: "#9fb0c9",
    accent: "#5fd0ff",
    accentStrong: "#33b8f2",
    accentSoft: "#173247",
    line: "#223350",
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
  sm: 14,
  md: 24,
  lg: 36,
  pill: 999,
} as const;

export const shadows = {
  soft: "0 18px 70px rgba(0, 0, 0, 0.22)",
  raised: "0 28px 110px rgba(0, 0, 0, 0.34)",
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
