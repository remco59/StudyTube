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

export const colors = {
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
} as const;

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
